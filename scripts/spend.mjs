#!/usr/bin/env node
// The one CLI for legal spend. Every slash command in .claude/commands drives it.
//   npm run spend -- <command> [entity] [record] --field=value --actor=Name [--json]
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {getDb,REPO_ROOT} from './lib/db.mjs';
import {parseCsv,pick} from './lib/csv.mjs';
import {table} from './lib/format.mjs';

export const entities={
 firms:['name','owner','country','tax_id','panel_status','panel_expiry','guidelines_accepted_on','contact_email','status'],
 timekeepers:['name','firm_id','classification','approved_rate','rate_from','rate_to','status'],
 matters:['name','owner','matter_number','firm_id','business_unit','category','status','opened_on','closed_on','fee_arrangement','budget','estimate_updated_on','currency'],
 invoices:['name','owner','firm_id','matter_id','invoice_date','received_on','due_date','billing_start','billing_end','currency','subtotal','gst','total','buyer_identified','status'],
 line_items:['invoice_id','line_no','kind','item_date','timekeeper_name','classification','units','rate','adjustment','amount','task_code','activity_code','expense_code','description'],
 settings:['max_daily_hours','min_description_words','vague_terms','disallowed_expense_codes','submit_within_days','budget_warning_pct','estimate_stale_days']
};
const DATES=['panel_expiry','guidelines_accepted_on','rate_from','rate_to','opened_on','closed_on','estimate_updated_on','invoice_date','received_on','due_date','billing_start','billing_end','item_date'];
const NUMBERS=['approved_rate','budget','subtotal','gst','total','units','rate','adjustment','amount','max_daily_hours'];
const INTEGERS=['line_no','min_description_words','submit_within_days','budget_warning_pct','estimate_stale_days'];
const OPEN=`('received','in-review')`;

export const reads={
 firms:'select name,country,tax_id,panel_status,panel_expiry,guidelines_accepted_on,status from firms order by name',
 'rate-card':'select f.name as firm,t.name as timekeeper,t.classification,t.approved_rate,t.rate_from,t.rate_to,t.status from timekeepers t join firms f on f.id=t.firm_id order by f.name,t.approved_rate desc nulls last',
 matters:'select name,matter_number,owner,firm,fee_arrangement,budget,forecast,burn_pct,status from budget_position order by matter_number nulls last,name',
 invoices:'select name,firm,matter_number,status,invoice_date,currency,total,flags,at_stake from invoice_queue order by invoice_date desc,name',
 'invoice-review':`select name,firm,matter_number,reviewer,currency,total,flags,at_stake,days_waiting,days_to_due from invoice_queue where status in ${OPEN} order by at_stake desc,days_waiting desc,name`,
 'guideline-breaches':`select invoice,firm,line_no,item_date,timekeeper_name,rule,at_stake from line_flags where invoice_status in ${OPEN} order by at_stake desc,invoice,line_no,rule`,
 'budget-burn':"select name,matter_number,owner,budget,approved,pending,accrued,forecast,burn_pct,estimate_updated_on from budget_position where status='open' and (budget is null or burn_pct>=(select budget_warning_pct from settings)) order by burn_pct desc nulls first,name",
 'accruals-due':'select name,matter_number,firm,period,last_month from accrual_status where this_month is null order by firm nulls first,name',
 'accrual-schedule':'select name,matter_number,firm,period,this_month,last_month,basis from accrual_status order by firm nulls first,name',
 'panel-scorecard':'select name,country,panel_status,panel_expiry,invoices,billed,approved,reduced,flags,avg_days_to_bill from firm_scorecard order by billed desc,name',
 'rate-variance':'select firm,timekeeper_name,classification,billed_rate,card_rate,hours,above_card from rate_variance order by above_card desc,firm,timekeeper_name',
 'spend-by-unit':"select coalesce(business_unit,'Unallocated') as business_unit,coalesce(category,'Uncategorised') as category,count(*) as matters,sum(approved) as approved,sum(pending) as pending,sum(accrued) as accrued from matter_spend group by 1,2 order by sum(approved) desc,1,2",
 'payments-due':"select i.name,f.name as firm,i.currency,i.approved_amount,i.due_date,i.due_date-current_date as days_left from invoices i join firms f on f.id=i.firm_id where i.status in ('approved','adjusted') order by i.due_date nulls first,i.name",
 decisions:'select i.name as invoice,d.decision,d.approved_amount,d.reason,d.actor,d.created_at from decisions d join invoices i on i.id=d.invoice_id order by d.created_at desc',
 compliance:'select rule,record,firm,finding from compliance_findings order by rule,record',
 attention:`select 'Invoice waiting over 10 days' as issue,name as record from invoice_queue where status in ${OPEN} and days_waiting>10
  union all select 'Invoice due within 7 days, not decided',name from invoice_queue where status in ${OPEN} and days_to_due<=7
  union all select 'Invoice without a matter',name from invoice_queue where matter is null
  union all select 'Open matter without a budget',name from matters where status='open' and budget is null
  union all select 'Accrual missing this month',name from accrual_status where this_month is null
  union all select 'Panel appointment expired or ends within 60 days',name from firms where status='active' and panel_expiry<=current_date+60
  order by issue,record`,
 settings:'select max_daily_hours,min_description_words,vague_terms,disallowed_expense_codes,submit_within_days,budget_warning_pct,estimate_stale_days,version from settings',
 history:'select entity,record_id,action,actor,created_at from audit_log order by created_at desc,id'
};
export const commands=[...Object.keys(reads),'show','add','update','log','decide','reduce','accrue','import','export','weekly-review','draft-adjustment','draft-accrual-request','help'];

const fail=message=>{throw Error(message);};
const today=()=>new Date().toISOString().slice(0,10);
export function parse(args){
 const positional=[],opts={};
 for(const a of args){if(!a.startsWith('--')){positional.push(a);continue;}const i=a.indexOf('=');const k=a.slice(2,i<0?undefined:i).replaceAll('-','_');if(k in opts)fail(`Duplicate option ${k}`);opts[k]=i<0?true:a.slice(i+1);}
 return {positional,opts};
}
function allowed(o,keys){for(const k of Object.keys(o))if(![...keys,'json'].includes(k))fail(`Unknown option --${k.replaceAll('_','-')}`);for(const k of ['json','dry_run','update_existing','day_first'])if(k in o&&o[k]!==true)fail(`--${k.replaceAll('_','-')} takes no value`);}
function required(v,name){if(typeof v!=='string'||!v.trim())fail(`${name} is required`);return v.trim();}
export function date(v){if(!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v))||new Date(v+'T00:00:00Z').toISOString().slice(0,10)!==v)fail(`Expected a real date YYYY-MM-DD: ${v}`);return v;}
function amount(v,name){const s=String(v).replace(/[,\s]/g,'').replace(/^[A-Z]{3}/i,'').replace(/^\$/,'');if(!/^-?\d+(\.\d+)?$/.test(s))fail(`${name} must be a number: ${v}`);return Number(s);}
function known(t){if(!entities[t])fail(`Unknown entity ${t}`);return t;}

async function match(db,t,q){
 known(t);
 if(t==='settings')return (await db.query('select * from settings where id=1'))[0];
 required(q,'record');
 const all=t==='line_items'?(await db.query('select l.*,i.name||\' line \'||l.line_no as name from line_items l join invoices i on i.id=l.invoice_id order by name,l.id')):await db.query(`select * from ${t} order by name,id`);
 const s=q.toLowerCase();
 let hits=all.filter(r=>r.name.toLowerCase()===s||r.id===q||(r.matter_number&&r.matter_number.toLowerCase()===s));
 if(!hits.length)hits=all.filter(r=>r.id.startsWith(q)||r.name.toLowerCase().includes(s));
 if(hits.length!==1)fail(`${hits.length?'Ambiguous':'No match'} ${t}: ${q}\n${(hits.length?hits:all).slice(0,20).map(r=>r.id+' '+r.name).join('\n')}`);
 return hits[0];
}
async function transaction(db,actor,fn,dry=false){required(actor,'actor');await db.exec('BEGIN');try{await db.query("select set_config('app.actor',$1,true)",[actor]);const result=await fn();await db.exec(dry?'ROLLBACK':'COMMIT');return result;}catch(e){await db.exec('ROLLBACK');throw e;}}
async function values(db,t,o){
 const v={};
 for(const k of entities[t]){
  if(!(k in o))continue;let x=o[k];if(x===true)fail(`${k} needs a value`);x=x.trim()||null;
  if(x===null){v[k]=x;continue;}
  if(DATES.includes(k))date(x);
  if(NUMBERS.includes(k))x=amount(x,k);
  if(INTEGERS.includes(k)){if(!/^\d+$/.test(x))fail(`${k} must be a whole number`);x=Number(x);}
  if(k==='buyer_identified'){if(!['yes','no'].includes(x.toLowerCase()))fail('buyer_identified is yes or no');x=x.toLowerCase()==='yes';}
  if(k==='firm_id')x=(await match(db,'firms',x)).id;
  if(k==='matter_id')x=(await match(db,'matters',x)).id;
  if(k==='invoice_id')x=(await match(db,'invoices',x)).id;
  v[k]=x;
 }
 return v;
}
async function insert(db,t,v){const keys=Object.keys(v);return (await db.query(`insert into ${t} (${keys.join(',')}) values (${keys.map((_,i)=>'$'+(i+1)).join(',')}) returning *`,Object.values(v)))[0];}
async function update(db,t,id,v,expected){const keys=Object.keys(v);if(!keys.length)fail('No editable fields supplied');const rows=await db.query(`update ${t} set ${keys.map((k,i)=>k+'=$'+(i+1)).join(',')} where id=$${keys.length+1} and version=$${keys.length+2} returning *`,[...Object.values(v),id,expected]);if(!rows.length)fail('Record changed; read show again');return rows[0];}
function expectVersion(o,r){if(!/^\d+$/.test(String(o.expected_version))||Number(o.expected_version)!==r.version)fail('Expected version required or record changed; read show');}

// ---------------------------------------------------------------- invoice decisions

async function decide(db,q,o){
 allowed(o,['decision','reason','actor','expected_version']);
 const decision=required(o.decision,'decision');if(!['approved','adjusted','rejected'].includes(decision))fail('decision is approved, adjusted or rejected');
 const reason=typeof o.reason==='string'?o.reason.trim()||null:null;
 return transaction(db,o.actor,async()=>{
  const inv=await match(db,'invoices',q);expectVersion(o,inv);
  if(!['received','in-review'].includes(inv.status))fail(`Invoice is ${inv.status}; only received or in-review invoices can be decided`);
  if(decision==='rejected'){
   if(!reason)fail('A rejection needs --reason');
   const r=await update(db,'invoices',inv.id,{status:'rejected',decision_note:reason,decided_on:today(),owner:inv.owner||o.actor},inv.version);
   await insert(db,'decisions',{invoice_id:inv.id,invoice_version:r.version,decision,reason,actor:o.actor});return r;
  }
  if(!inv.matter_id)fail('Allocate the invoice to a matter before approving it');
  const reductions=Number((await db.query('select coalesce(sum(reduction),0) as r from line_items where invoice_id=$1',[inv.id]))[0].r);
  if(decision==='approved'&&reductions>0)fail('This invoice has line reductions: decide it as adjusted');
  if(decision==='adjusted'&&reductions===0)fail('Adjusted needs at least one line reduction (use reduce first)');
  const unresolved=await db.query('select distinct g.line_no,g.rule from line_flags g join line_items l on l.id=g.id where g.invoice_id=$1 and g.at_stake>0 and l.reduction=0 order by 1',[inv.id]);
  if(unresolved.length&&!reason)fail(`Flags with money at stake have no reduction: ${unresolved.map(x=>'line '+x.line_no+' '+x.rule).join(', ')}. Reduce them, or record why you accept them with --reason`);
  const ratio=inv.subtotal&&inv.gst?Number(inv.gst)/Number(inv.subtotal):0;
  const approved=Math.round((Number(inv.total)-reductions*(1+ratio))*100)/100;
  const r=await update(db,'invoices',inv.id,{status:decision,approved_amount:approved,decision_note:reason,decided_on:today(),owner:inv.owner||o.actor},inv.version);
  await insert(db,'decisions',{invoice_id:inv.id,invoice_version:r.version,decision,approved_amount:approved,reason,actor:o.actor});
  return r;
 });
}
async function reduce(db,q,lineNo,o){
 allowed(o,['amount','reason','actor']);
 if(!/^\d+$/.test(String(lineNo)))fail('reduce <invoice> <line number> --amount=N --reason=...');
 const value=amount(required(o.amount,'amount'),'amount');if(value<0)fail('amount cannot be negative');
 const reason=value>0?required(o.reason,'reason'):null;
 return transaction(db,o.actor,async()=>{
  const inv=await match(db,'invoices',q);
  if(!['received','in-review'].includes(inv.status))fail(`Invoice is ${inv.status}; reductions only apply before a decision`);
  const line=(await db.query('select * from line_items where invoice_id=$1 and line_no=$2',[inv.id,Number(lineNo)]))[0];if(!line)fail(`No line ${lineNo} on ${inv.name}`);
  if(line.kind==='adjustment')fail('Adjustment lines cannot be reduced');
  if(value>Math.abs(Number(line.amount)))fail('A reduction cannot exceed the line amount');
  const r=await update(db,'line_items',line.id,{reduction:value,reduction_reason:reason},line.version);
  if(inv.status==='received')await update(db,'invoices',inv.id,{status:'in-review'},inv.version);
  return r;
 });
}
async function accrue(db,q,o){
 allowed(o,['amount','basis','period','actor','expected_version']);
 const value=amount(required(o.amount,'amount'),'amount');if(value<0)fail('amount cannot be negative');
 const period=o.period?date(o.period):today().slice(0,8)+'01';if(!period.endsWith('-01'))fail('period is the first day of the month, YYYY-MM-01');
 const basis=required(o.basis,'basis');
 return transaction(db,o.actor,async()=>{
  const m=await match(db,'matters',q);
  const old=(await db.query('select * from accruals where matter_id=$1 and period=$2',[m.id,period]))[0];
  if(old){expectVersion(o,old);return update(db,'accruals',old.id,{amount:value,basis,actor:o.actor},old.version);}
  return insert(db,'accruals',{matter_id:m.id,period,amount:value,basis,actor:o.actor});
 });
}

// ---------------------------------------------------------------- imports

const sorted=x=>Array.isArray(x)?x.map(sorted):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,sorted(x[k])])):x;
const canonical=x=>JSON.stringify(sorted(x));
function importDate(v,dayFirst,name){
 v=String(v||'').trim();if(!v)return null;
 if(/^\d{4}-\d{2}-\d{2}/.test(v))return date(v.slice(0,10));
 if(/^\d{8}$/.test(v))return date(`${v.slice(0,4)}-${v.slice(4,6)}-${v.slice(6,8)}`);
 const m=v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
 if(m){if(!dayFirst)fail(`${name} "${v}" is ambiguous: add --day-first for DD/MM/YYYY exports`);return date(`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`);}
 fail(`${name} is not a date: ${v}`);
}
async function firmByName(db,name,create){
 const hit=(await db.query('select * from firms where lower(name)=lower($1)',[name]))[0];
 if(hit||!create)return hit;
 return insert(db,'firms',{name});
}

// Brightflag AP batch export: one row per approved invoice, header level (help.brightflag.com, "Configuring Your AP Batch Export File").
async function importBrightflag(db,o){
 allowed(o,['file','mapping','actor','dry_run','update_existing','day_first']);
 const rows=parseCsv(fs.readFileSync(required(o.file,'file'),'utf8'));if(!rows.length)fail('CSV has no data rows');
 const aliases={vendor:['Vendor Name','Vendor'],invoice_number:['Invoice Number'],invoice_date:['Invoice Date'],due_date:['Invoice Due Date','Due Date'],currency:['Currency Code','Currency'],total:['Invoice Totals','Invoice Total','Total'],
  approved_on:['Approved Date'],source_state:['Invoice Status','Review Stage'],business_unit:['Department'],matter_number:['Matter Number'],matter_name:['Matter Name'],category:['Matter Category'],matter_status:['Matter Status'],matter_lead:['Matter Lead'],
  billing_start:['Billing Start Date'],billing_end:['Billing End Date']};
 const mapping=o.mapping?JSON.parse(fs.readFileSync(o.mapping,'utf8')):{};
 for(const [k,v] of Object.entries(mapping)){if(!aliases[k]||typeof v!=='string')fail('Invalid mapping field '+k);if(!(v in rows[0]))fail('Mapped header is missing: '+v);}
 const seen=new Set();
 const batch=rows.map((row,i)=>{
  const v={};for(const k of Object.keys(aliases))v[k]=String(mapping[k]?row[mapping[k]]:pick(row,...aliases[k])).trim()||null;
  required(v.vendor,`Row ${i+2}: Vendor Name (use --mapping for custom headers)`);required(v.invoice_number,`Row ${i+2}: Invoice Number`);required(v.total,`Row ${i+2}: Invoice Totals`);
  for(const k of ['invoice_date','due_date','approved_on','billing_start','billing_end'])v[k]=importDate(v[k],o.day_first,`Row ${i+2} ${k}`);
  if(!v.invoice_date)fail(`Row ${i+2}: Invoice Date is required`);
  v.total=amount(v.total,`Row ${i+2} total`);v.source_id=`brightflag:${v.vendor.toLowerCase()}:${v.invoice_number}`;
  if(seen.has(v.source_id))fail('Duplicate invoice in file: '+v.vendor+' '+v.invoice_number);seen.add(v.source_id);v.row=row;return v;
 });
 return transaction(db,o.actor,async()=>{
  const counts={added:0,unchanged:0,updated:0,firms_created:0,matters_created:0,dry_run:!!o.dry_run};
  for(const v of batch){
   let firm=await firmByName(db,v.vendor,false);if(!firm){firm=await firmByName(db,v.vendor,true);counts.firms_created++;}
   let matter=null;
   if(v.matter_number){
    matter=(await db.query('select * from matters where lower(matter_number)=lower($1)',[v.matter_number]))[0];
    if(!matter){matter=await insert(db,'matters',{name:v.matter_name||v.matter_number,matter_number:v.matter_number,owner:v.matter_lead,firm_id:firm.id,business_unit:v.business_unit,category:v.category,
     status:/closed/i.test(v.matter_status||'')?'closed':'open',currency:v.currency||'NZD',source_data:{brightflag:{name:v.matter_name,status:v.matter_status,lead:v.matter_lead}}});counts.matters_created++;}
   }
   const header={name:v.invoice_number,firm_id:firm.id,matter_id:matter?.id||null,invoice_date:v.invoice_date,due_date:v.due_date,billing_start:v.billing_start,billing_end:v.billing_end,currency:v.currency||'NZD',total:v.total,
    status:v.approved_on?'approved':'received',approved_amount:v.approved_on?v.total:null,decided_on:v.approved_on,decision_note:v.approved_on?`Approved in Brightflag on ${v.approved_on}`:null,source_id:v.source_id,source_state:v.source_state,source_data:v.row};
   const old=(await db.query('select * from invoices where source_id=$1 or (firm_id=$2 and name=$3)',[v.source_id,firm.id,v.invoice_number]))[0];
   if(!old){await insert(db,'invoices',header);counts.added++;continue;}
   if(old.source_data&&canonical(old.source_data)===canonical(v.row)){counts.unchanged++;continue;}
   if(!o.update_existing)fail('Invoice already here with different details; inspect it and use --update-existing: '+v.vendor+' '+v.invoice_number);
   await update(db,'invoices',old.id,header,old.version);counts.updated++;
  }
  return counts;
 },o.dry_run);
}

// LEDES 1998B: the published pipe-delimited e-billing format (ledes.org). One row per line item, invoice fields repeated.
export function parseLedes(text){
 const lines=String(text).replace(/^﻿/,'').split(/\r?\n/).map(l=>l.trim()).filter(Boolean).map(l=>l.replace(/\[\]$/,''));
 if(!lines.length||!/^LEDES1998B$/i.test(lines[0]))fail('Not a LEDES 1998B file: the first line must be LEDES1998B[]');
 const header=(lines[1]||'').split('|').map(h=>h.trim().toUpperCase());
 for(const need of ['INVOICE_DATE','INVOICE_NUMBER','INVOICE_TOTAL','LINE_ITEM_NUMBER','EXP/FEE/INV_ADJ_TYPE','LINE_ITEM_TOTAL','LAW_FIRM_ID'])if(!header.includes(need))fail('LEDES header is missing '+need);
 return lines.slice(2).map((l,i)=>{const f=l.split('|');if(f.length!==header.length)fail(`LEDES row ${i+3}: expected ${header.length} fields, found ${f.length}`);return Object.fromEntries(header.map((h,j)=>[h,f[j].trim()]));});
}
const tkName=n=>{n=String(n||'').trim();if(!n)return null;const m=n.match(/^([^,]+),\s*(.+)$/);return m?`${m[2]} ${m[1]}`:n;};
const digits=s=>String(s||'').replace(/\D/g,'');
async function importLedes(db,o){
 allowed(o,['file','firm','actor','dry_run','update_existing']);
 const rows=parseLedes(fs.readFileSync(required(o.file,'file'),'utf8'));if(!rows.length)fail('LEDES file has no line items');
 const groups=new Map();
 for(const r of rows){const key=r.LAW_FIRM_ID+'|'+r.INVOICE_NUMBER;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r);}
 const kinds={F:'fee',E:'expense',IF:'adjustment',IE:'adjustment'};
 const parsed=[...groups.values()].map(rs=>{
  const h=rs[0];
  for(const r of rs)for(const k of ['INVOICE_DATE','INVOICE_TOTAL','BILLING_START_DATE','BILLING_END_DATE'])if((r[k]||'')!==(h[k]||''))fail(`Invoice ${h.INVOICE_NUMBER}: ${k} differs between its lines`);
  const nos=new Set();
  const lines=rs.map(r=>{
   const kind=kinds[String(r['EXP/FEE/INV_ADJ_TYPE']).toUpperCase()];if(!kind)fail(`Invoice ${h.INVOICE_NUMBER}: unknown line type ${r['EXP/FEE/INV_ADJ_TYPE']}`);
   const no=Number(r.LINE_ITEM_NUMBER);if(!Number.isInteger(no)||nos.has(no))fail(`Invoice ${h.INVOICE_NUMBER}: line number ${r.LINE_ITEM_NUMBER} missing or repeated`);nos.add(no);
   const num=(k)=>r[k]===undefined||r[k]===''?null:amount(r[k],`${h.INVOICE_NUMBER} line ${no} ${k}`);
   return {line_no:no,kind,item_date:importDate(r.LINE_ITEM_DATE,false,`line ${no} date`),timekeeper_name:tkName(r.TIMEKEEPER_NAME),timekeeper_ref:r.TIMEKEEPER_ID||null,classification:r.TIMEKEEPER_CLASSIFICATION||null,
    units:num('LINE_ITEM_NUMBER_OF_UNITS'),rate:num('LINE_ITEM_UNIT_COST'),adjustment:num('LINE_ITEM_ADJUSTMENT_AMOUNT')||0,amount:num('LINE_ITEM_TOTAL'),
    task_code:r.LINE_ITEM_TASK_CODE||null,activity_code:r.LINE_ITEM_ACTIVITY_CODE||null,expense_code:r.LINE_ITEM_EXPENSE_CODE||null,description:r.LINE_ITEM_DESCRIPTION||null};
  });
  if(lines.some(l=>l.amount===null))fail(`Invoice ${h.INVOICE_NUMBER}: every line needs LINE_ITEM_TOTAL`);
  return {h,lines,source:{invoice:Object.fromEntries(Object.entries(h).filter(([k])=>!k.startsWith('LINE_ITEM')&&!k.startsWith('TIMEKEEPER')&&k!=='EXP/FEE/INV_ADJ_TYPE')),lines:rs}};
 });
 return transaction(db,o.actor,async()=>{
  const counts={added:0,unchanged:0,updated:0,lines:0,dry_run:!!o.dry_run};
  const firms=await db.query('select * from firms');
  for(const {h,lines,source} of parsed){
   const firm=o.firm?await match(db,'firms',o.firm):firms.find(f=>digits(f.tax_id)&&digits(f.tax_id)===digits(h.LAW_FIRM_ID));
   if(!firm)fail(`No firm has tax ID ${h.LAW_FIRM_ID}: add it to the firm record or pass --firm=<name>`);
   const matter=h.CLIENT_MATTER_ID?(await db.query('select * from matters where lower(matter_number)=lower($1)',[h.CLIENT_MATTER_ID]))[0]:null;
   const header={name:h.INVOICE_NUMBER,firm_id:firm.id,matter_id:matter?.id||null,invoice_date:importDate(h.INVOICE_DATE,false,'INVOICE_DATE'),received_on:today(),billing_start:importDate(h.BILLING_START_DATE,false,'BILLING_START_DATE'),
    billing_end:importDate(h.BILLING_END_DATE,false,'BILLING_END_DATE'),currency:matter?.currency||(firm.country==='AU'?'AUD':'NZD'),subtotal:Math.round(lines.reduce((s,l)=>s+l.amount,0)*100)/100,total:amount(h.INVOICE_TOTAL,'INVOICE_TOTAL'),
    source_id:`ledes:${digits(h.LAW_FIRM_ID)||h.LAW_FIRM_ID}:${h.INVOICE_NUMBER}`,source_state:'LEDES 1998B',source_data:source};
   const old=(await db.query('select * from invoices where source_id=$1 or (firm_id=$2 and name=$3)',[header.source_id,firm.id,h.INVOICE_NUMBER]))[0];
   if(old&&old.source_data&&canonical(old.source_data)===canonical(source)){counts.unchanged++;continue;}
   let inv;
   if(old){
    if(!o.update_existing)fail(`Invoice ${h.INVOICE_NUMBER} is already here with different details; inspect it and use --update-existing`);
    if(!['received','in-review'].includes(old.status))fail(`Invoice ${h.INVOICE_NUMBER} is ${old.status}; a decided invoice is not replaced`);
    await db.query('delete from line_items where invoice_id=$1',[old.id]);
    inv=await update(db,'invoices',old.id,{...header,status:'received'},old.version);counts.updated++;
   }else{inv=await insert(db,'invoices',header);counts.added++;}
   for(const l of lines){await insert(db,'line_items',{...l,invoice_id:inv.id});counts.lines++;}
  }
  return counts;
 },o.dry_run);
}

// ---------------------------------------------------------------- drafts

function writeDraft(name,intro,sections){
 const dir=path.resolve(process.env.OUTPUT_DIR||REPO_ROOT,'drafts');fs.mkdirSync(dir,{recursive:true});
 const file=path.join(dir,name+'-'+randomUUID().slice(0,8)+'.md');
 fs.writeFileSync(file,`# DRAFT: ${name}\n\n${intro}\n\n`+sections.map(s=>'## '+s.title+'\n\n'+format(s.rows)).join('\n\n')+'\n',{flag:'wx',mode:0o600});
 return {file};
}

export async function execute(db,args){
 const {positional:p,opts:o}=parse(args);const [cmd='help',t,q]=p;
 if(reads[cmd]){allowed(o,[]);if(p.length!==1)fail('Unexpected arguments');return db.query(reads[cmd]);}
 if(cmd==='help'){allowed(o,[]);return {commands,entities,usage:'spend <command> [entity] [record] --field=value --actor=Name; updates need --expected-version=N from show; dates YYYY-MM-DD; money in the invoice currency'};}
 if(cmd==='show'){
  allowed(o,[]);const r=await match(db,known(t),q);const out={...r,history:await db.query('select action,actor,created_at from audit_log where entity=$1 and record_id=$2 order by created_at',[t,String(r.id)])};
  if(t==='invoices'){out.lines=await db.query('select line_no,kind,item_date,timekeeper_name,units,rate,amount,reduction,reduction_reason,description from line_items where invoice_id=$1 order by line_no',[r.id]);out.flags=await db.query('select line_no,rule,at_stake from line_flags where invoice_id=$1 order by line_no,rule',[r.id]);out.decisions=await db.query('select decision,approved_amount,reason,actor,created_at from decisions where invoice_id=$1 order by created_at',[r.id]);}
  if(t==='matters'){out.spend=(await db.query('select budget,approved,pending,accrued,forecast,burn_pct from budget_position where id=$1',[r.id]))[0];out.invoices=await db.query('select name,status,invoice_date,total,approved_amount from invoices where matter_id=$1 order by invoice_date',[r.id]);out.notes=await db.query('select body,actor,created_at from notes where matter_id=$1 order by created_at',[r.id]);}
  return out;
 }
 if(cmd==='add'||cmd==='update'){
  known(t);allowed(o,[...entities[t],'actor','expected_version']);
  if(cmd==='add'&&t==='settings')fail('Settings has one row: use update settings');
  if(t==='invoices'&&['approved','adjusted','rejected'].includes(o.status))fail('Use decide to approve, adjust or reject an invoice');
  const v=await values(db,t,o);
  if(cmd==='add'&&t!=='line_items')required(v.name,'name');
  return transaction(db,o.actor,async()=>{
   const old=cmd==='update'?await match(db,t,t==='settings'?'1':q):null;
   if(old)expectVersion(o,old);
   if(t==='invoices'&&old&&v.status==='paid'&&!['approved','adjusted'].includes(old.status))fail('Only an approved or adjusted invoice can be marked paid');
   if(t==='invoices'&&old&&!['received','in-review'].includes(old.status)&&Object.keys(v).some(k=>['total','subtotal','gst','firm_id'].includes(k)))fail(`Invoice is ${old.status}; its amounts are locked`);
   return old?update(db,t,old.id,v,old.version):insert(db,t,v);
  });
 }
 if(cmd==='log'){allowed(o,['body','actor']);return transaction(db,o.actor,async()=>{const m=await match(db,'matters',t);return insert(db,'notes',{matter_id:m.id,body:required(o.body,'body'),actor:o.actor});});}
 if(cmd==='decide'){if(p.length!==2)fail('decide <invoice> --decision=approved|adjusted|rejected');return decide(db,t,o);}
 if(cmd==='reduce'){if(p.length!==3)fail('reduce <invoice> <line number> --amount=N --reason=...');return reduce(db,t,q,o);}
 if(cmd==='accrue'){if(p.length!==2)fail('accrue <matter> --amount=N --basis=...');return accrue(db,t,o);}
 if(cmd==='import'){if(t==='brightflag')return importBrightflag(db,o);if(t==='ledes')return importLedes(db,o);fail('Use import brightflag (AP batch CSV) or import ledes (LEDES 1998B file)');}
 if(cmd==='export'){allowed(o,['file']);const out={};for(const k of [...Object.keys(entities),'accruals','decisions','notes','audit_log'])out[k]=await db.query(`select * from ${k} order by id`);if(o.file)fs.writeFileSync(o.file,JSON.stringify(out,null,2)+'\n',{flag:'wx',mode:0o600});return o.file?{file:o.file}:out;}
 if(cmd==='weekly-review'){
  allowed(o,[]);const sections=[];
  for(const c of ['invoice-review','guideline-breaches','budget-burn','accruals-due'])sections.push({title:c,rows:await execute(db,[c])});
  return writeDraft('weekly-review','Internal review only. Nothing has been sent or approved. Check each figure against the invoice before acting.',sections);
 }
 if(cmd==='draft-adjustment'){
  allowed(o,[]);const inv=await match(db,'invoices',t);const firm=(await db.query('select name from firms where id=$1',[inv.firm_id]))[0];
  return writeDraft('draft-adjustment',`Draft note to ${firm.name} about invoice ${inv.name}. Not sent. A person checks the reductions against the engagement terms and sends it.`,[
   {title:'Invoice',rows:[{invoice:inv.name,firm:firm.name,invoice_date:inv.invoice_date,currency:inv.currency,total:inv.total,status:inv.status}]},
   {title:'Reductions',rows:await db.query('select line_no,item_date,timekeeper_name,amount,reduction,reduction_reason from line_items where invoice_id=$1 and reduction>0 order by line_no',[inv.id])},
   {title:'Lines to query',rows:await db.query("select g.line_no,g.rule,g.description from line_flags g join line_items l on l.id=g.id where g.invoice_id=$1 and l.reduction=0 order by g.line_no",[inv.id])}]);
 }
 if(cmd==='draft-accrual-request'){
  allowed(o,[]);const firm=await match(db,'firms',t);
  const rows=await db.query('select name,matter_number,period,last_month from accrual_status where firm=$1 and this_month is null order by name',[firm.name]);
  return writeDraft('draft-accrual-request',`Draft month-end request to ${firm.name}${firm.contact_email?' ('+firm.contact_email+')':''}: please send your estimate of work done but not yet billed on each matter below, as at the end of this month. Not sent.`,[{title:'Matters needing an estimate',rows}]);
 }
 fail('Unknown command '+cmd);
}
export function format(value){if(!Array.isArray(value))return JSON.stringify(value,null,2);if(!value.length)return '(none)';return table(value,Object.keys(value[0]).map(k=>({key:k,label:k,width:48,format:x=>x instanceof Date?x.toISOString().slice(0,16).replace('T',' '):typeof x==='object'&&x!==null?JSON.stringify(x):x})));}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){let db;try{db=await getDb();const result=await execute(db,process.argv.slice(2));console.log(process.argv.includes('--json')?JSON.stringify(result,null,2):format(result));}catch(e){console.error(e.message);process.exitCode=1;}finally{if(db)await db.close();}}

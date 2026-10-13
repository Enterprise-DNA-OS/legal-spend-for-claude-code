// npm test: a temporary database, the migration, the seed, every CLI command, both importers, the reports.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {getDb,REPO_ROOT} from './lib/db.mjs';
import {migrate} from './migrate.mjs';
import {execute,reads,commands,parseLedes} from './spend.mjs';
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'legal-spend-test-'));
process.env.DATABASE_URL=process.env.TEST_DATABASE_URL||'';process.env.DATA_DIR=path.join(temp,'db');process.env.OUTPUT_DIR=temp;
let db,checks=0;const covered=new Set();
const ok=(x,label)=>{assert.ok(x,label);checks++;};
const eq=(a,b,label)=>{assert.equal(a,b,label);checks++;};
const run=(...args)=>{covered.add(args[0]);return execute(db,args);};
const rejects=async(args,re)=>{covered.add(args[0]);await assert.rejects(()=>execute(db,args),re);checks++;};
const child=(file,args=[],expected=0)=>{const p=spawnSync(process.execPath,[file,...args],{cwd:REPO_ROOT,env:process.env,encoding:'utf8'});assert.equal(p.status,expected,p.stderr||p.stdout);checks++;return p;};
const num=x=>Number(x);
try{
 db=await getDb();if(db.mode==='postgres')ok((await db.query("select table_name from information_schema.tables where table_schema='public'")).length===0,'Test database must be empty');
 await migrate(db);ok((await migrate(db)).ran.length===0,'Migration repeats safely');
 const seed=fs.readFileSync(path.join(REPO_ROOT,'supabase/seed.sql'),'utf8');await db.exec(seed);const logs=(await run('history')).length;await db.exec(seed);
 eq((await run('firms')).length,4,'Seed is idempotent');eq((await run('history')).length,logs,'Seed repetition adds no audit events');
 for(const c of Object.keys(reads))ok(Array.isArray(await run(c)),c);

 // The guideline checks find what the seed hides.
 const flags=await run('guideline-breaches');const has=(inv,line,rule)=>flags.some(f=>f.invoice===inv&&f.line_no===line&&f.rule===rule);
 ok(has('KLL-4532',1,'RATE-ABOVE-CARD')&&num(flags.find(f=>f.rule==='RATE-ABOVE-CARD'&&f.invoice==='KLL-4532').at_stake)===300,'Rate above card: 6 hours at 50 over');
 ok(has('KLL-4532',4,'TIMEKEEPER-NOT-ON-CARD'),'Timekeeper missing from the rate card');
 ok(has('KLL-4532',1,'BLOCK-BILLING'),'Block billing');ok(has('KLL-4532',2,'DAILY-HOURS')&&has('KLL-4532',3,'DAILY-HOURS'),'Over 10 hours in a day');
 ok(has('KLL-4532',4,'VAGUE-DESCRIPTION')&&has('SCL-20931',3,'VAGUE-DESCRIPTION'),'Vague descriptions');
 ok(has('KLL-4532',5,'DISALLOWED-EXPENSE')&&has('KLL-4532',6,'OUTSIDE-BILLING-PERIOD'),'Expense checks');
 ok(has('PEL-1187',2,'ARITHMETIC'),'Line arithmetic');ok(!flags.some(f=>f.invoice==='KLL-4471'),'Decided invoices leave the review list');
 eq((await run('invoice-review'))[0].name,'TC-0098','Most money at stake first');
 const burn=await run('budget-burn');ok(burn.some(b=>b.matter_number==='HL-2026-014'&&num(b.burn_pct)>=80),'Budget warning');ok(burn.some(b=>b.budget===null),'Missing budget stays visible');
 eq((await run('accruals-due')).length,3,'Three matters need an accrual');
 const comp=await run('compliance');for(const rule of ['NZ-GST-TAX-INVOICE','NZ-GST-BUYER','LOCAL-PANEL','LOCAL-GUIDELINES','LOCAL-LATE-INVOICE','LOCAL-ESTIMATE'])ok(comp.some(c=>c.rule===rule),rule);
 ok((await run('rate-variance')).some(r=>r.timekeeper_name==='Aroha Ngata'&&num(r.above_card)===300),'Rate variance');

 // Matching and validation.
 const firm=await run('add','firms','--name=Rimu Legal','--country=NZ','--tax-id=111-222-333','--panel-status=panel','--actor=Hana');
 eq((await run('show','firms','rimu legal')).id,firm.id,'Case insensitive match');eq((await run('show','firms',firm.id.slice(0,8))).id,firm.id,'Partial id');
 eq((await run('show','matters','hl-2026-030')).name,'Restructure consultation','Matter number match');
 await rejects(['show','firms','Law'],/Ambiguous/);await rejects(['show','firms','Nobody'],/No match/);
 await rejects(['add','firms','--name=No actor'],/actor/);await rejects(['add','firms','--name=Bad','--panel-expiry=2026-02-30','--actor=Hana'],/real date/);
 await rejects(['add','matters','--name=Bad budget','--budget=lots','--actor=Hana'],/number/);await rejects(['add','firms','--name=X','--colour=red','--actor=Hana'],/Unknown option/);
 await rejects(['add','invoices','--name=X','--status=approved','--actor=Hana'],/decide/);await rejects(['add','settings','--actor=Hana'],/one row/);
 await run('add','timekeepers','--name=Kiri Rimu',`--firm-id=${firm.id}`,'--classification=Partner','--approved-rate=500','--actor=Hana');
 const matter=await run('add','matters','--name=Shareholder agreement','--matter-number=HL-2026-040',`--firm-id=${firm.id}`,'--budget=5000','--actor=Hana');
 const inv=await run('add','invoices','--name=RL-1',`--firm-id=${firm.id}`,'--invoice-date=2026-09-30','--billing-start=2026-09-01','--billing-end=2026-09-30','--subtotal=1300','--gst=195','--total=1495','--buyer-identified=yes','--actor=Hana');
 await run('add','line_items','--invoice-id=RL-1','--line-no=1','--kind=fee','--item-date=2026-09-10','--timekeeper-name=Kiri Rimu','--units=2','--rate=550','--amount=1100','--description=Draft shareholder agreement drag along terms','--actor=Hana');
 await run('add','line_items','--invoice-id=RL-1','--line-no=2','--kind=fee','--item-date=2026-09-12','--timekeeper-name=Kiri Rimu','--units=0.4','--rate=500','--amount=200','--description=Call with founders about vesting clause','--actor=Hana');

 // Decisions: allocation, reductions, overrides, versions.
 let cur=await run('show','invoices','RL-1');eq(cur.flags.length,1,'One flag on the new invoice');
 await rejects(['decide','RL-1','--decision=approved','--actor=Hana',`--expected-version=${cur.version}`],/matter/);
 await run('update','invoices','RL-1',`--matter-id=${matter.id}`,`--expected-version=${cur.version}`,'--actor=Hana');cur=await run('show','invoices','RL-1');
 await rejects(['decide','RL-1','--decision=approved','--actor=Hana',`--expected-version=${cur.version}`],/RATE-ABOVE-CARD/);
 await rejects(['decide','RL-1','--decision=adjusted','--actor=Hana',`--expected-version=${cur.version}`],/reduce first/);
 await rejects(['reduce','RL-1','1','--amount=100','--actor=Hana'],/reason/);await rejects(['reduce','RL-1','1','--amount=5000','--reason=x','--actor=Hana'],/exceed/);await rejects(['reduce','RL-1','9','--amount=1','--reason=x','--actor=Hana'],/No line/);
 await run('reduce','RL-1','1','--amount=100','--reason=Billed above the agreed partner rate','--actor=Hana');cur=await run('show','invoices','RL-1');eq(cur.status,'in-review','A reduction moves the invoice into review');
 await rejects(['decide','RL-1','--decision=approved','--actor=Hana',`--expected-version=${cur.version}`],/adjusted/);
 await rejects(['decide','RL-1','--decision=adjusted','--actor=Hana','--expected-version=1'],/version/);
 const decided=await run('decide','RL-1','--decision=adjusted','--actor=Hana',`--expected-version=${cur.version}`);eq(num(decided.approved_amount),1380,'Approved amount takes off the reduction and its GST');
 await rejects(['reduce','RL-1','2','--amount=10','--reason=x','--actor=Hana'],/before a decision/);
 await rejects(['update','invoices','RL-1','--total=1','--actor=Hana',`--expected-version=${decided.version}`],/locked/);
 const paid=await run('update','invoices','RL-1','--status=paid','--actor=Hana',`--expected-version=${decided.version}`);eq(paid.status,'paid','Paid after approval');
 cur=await run('show','invoices','PEL-1187');await rejects(['update','invoices','PEL-1187','--status=paid','--actor=Liam',`--expected-version=${cur.version}`],/approved or adjusted/);
 cur=await run('show','invoices','PEL-1187');await rejects(['decide','PEL-1187','--decision=rejected','--actor=Liam',`--expected-version=${cur.version}`],/reason/);
 eq((await run('decide','PEL-1187','--decision=approved','--reason=Line 2 undercharged by the firm; accepted','--actor=Liam',`--expected-version=${cur.version}`)).status,'approved','Override recorded with a reason');
 cur=await run('show','invoices','TC-0098');eq((await run('decide','TC-0098','--decision=rejected','--reason=Off-panel firm engaged without approval','--actor=Hana',`--expected-version=${cur.version}`)).status,'rejected','Rejection');
 ok((await run('decisions')).length===5,'Every decision recorded');

 // Accruals, notes, settings.
 await run('accrue','HL-2026-030','--amount=3500','--basis=Pohutukawa estimate by email','--actor=Liam');
 const acc=(await db.query("select * from accruals where amount=3500"))[0];await rejects(['accrue','HL-2026-030','--amount=4000','--basis=Revised','--actor=Liam'],/version/);
 await run('accrue','HL-2026-030','--amount=4000','--basis=Revised estimate','--actor=Liam',`--expected-version=${acc.version}`);eq((await run('accruals-due')).length,3,'Accrual recorded (one new matter added)');
 await rejects(['accrue','HL-2026-030','--amount=1','--basis=x','--period=2026-10-15','--actor=Liam'],/first day/);
 await run('log','HL-2026-014','--body=Firm asked for a revised estimate before mediation','--actor=Hana');eq((await run('show','matters','HL-2026-014')).notes.length,1,'Matter note');
 const st=(await run('settings'))[0];await run('update','settings','--max-daily-hours=12','--actor=Hana',`--expected-version=${st.version}`);ok(!(await run('guideline-breaches')).some(f=>f.rule==='DAILY-HOURS'),'Guideline settings drive the checks');

 // Brightflag AP batch import.
 const bf=['import','brightflag',`--file=${path.join(REPO_ROOT,'examples/brightflag-ap-batch.csv')}`,'--actor=Hana'];
 const before=(await run('invoices')).length;await run(...bf,'--dry-run');eq((await run('invoices')).length,before,'Dry run leaves no records');
 await rejects([...bf,'--dry-run=no'],/takes no value/);
 const r1=await run(...bf);ok(r1.added===2&&r1.firms_created===1&&r1.matters_created===2,'Brightflag invoices, firms and matters');eq((await run(...bf)).unchanged,2,'Brightflag import is idempotent');
 const bfInv=await run('show','invoices','KLL-3980');ok(bfInv.status==='approved'&&num(bfInv.approved_amount)===8625&&bfInv.source_data['Invoice Status']==='Approved','Approved history keeps its source fields');
 const file=path.join(temp,'bf.csv');const hdr='Vendor Name,Invoice Number,Invoice Date,Invoice Totals\n';
 fs.writeFileSync(file,hdr+'New Firm A,A-1,2026-01-05,100\nNew Firm B,B-1,05/01/2026,100\n');await rejects(['import','brightflag',`--file=${file}`,'--actor=Hana'],/day-first/);ok(!(await run('firms')).some(f=>f.name==='New Firm A'),'Failed batch changes nothing');
 eq((await run('import','brightflag',`--file=${file}`,'--day-first','--actor=Hana')).added,2,'Day-first dates');
 fs.writeFileSync(file,hdr+'New Firm A,A-1,2026-01-05,150\n');await rejects(['import','brightflag',`--file=${file}`,'--actor=Hana'],/update-existing/);
 eq((await run('import','brightflag',`--file=${file}`,'--update-existing','--actor=Hana')).updated,1,'Explicit update');
 fs.writeFileSync(file,'Supplier,Inv No,Inv Date,Amount,Matter\nMapped Firm,M-9,2026-02-01,"1,250.00",HL-2026-014\n');
 eq((await run('import','brightflag',`--file=${file}`,`--mapping=${path.join(REPO_ROOT,'examples/mapping.json')}`,'--actor=Hana')).added,1,'Custom headers through a mapping');

 // LEDES 1998B import.
 const ledes=path.join(REPO_ROOT,'examples/kauri-lane-ledes98b.txt');const ld=['import','ledes',`--file=${ledes}`,'--actor=Hana'];
 const l1=await run(...ld);ok(l1.added===1&&l1.lines===3,'LEDES invoice and lines');eq((await run(...ld)).unchanged,1,'LEDES import is idempotent');
 const li=await run('show','invoices','KLL-4600');ok(li.lines[0].timekeeper_name==='Aroha Ngata'&&num(li.lines[1].amount)===1610&&li.matter_id,'Names, adjustments and matter mapped');eq(li.flags.length,0,'Clean LEDES lines raise no flags');
 fs.writeFileSync(file,fs.readFileSync(ledes,'utf8').replace('123-456-789','999-999-999').replaceAll('123-456-789','999-999-999'));await rejects(['import','ledes',`--file=${file}`,'--actor=Hana'],/tax ID/);
 await rejects(['import','ledes',`--file=${file}`,'--firm=Kauri Lane','--dry-run','--actor=Hana'],/update-existing/);
 assert.throws(()=>parseLedes('INVOICE_DATE|X\n'),/LEDES1998B/);checks++;assert.throws(()=>parseLedes('LEDES1998B[]\nINVOICE_DATE|INVOICE_NUMBER\n1|2[]\n'),/missing/);checks++;
 fs.writeFileSync(file,fs.readFileSync(ledes,'utf8').replace('|1625.00|','|1700.00|'));await rejects(['import','ledes',`--file=${file}`,'--actor=Hana'],/update-existing/);
 eq((await run('import','ledes',`--file=${file}`,'--update-existing','--actor=Hana')).updated,1,'Replaced while still in review');
 await rejects(['import','other'],/brightflag|ledes/);

 // Export, drafts, help, privacy of tables, audit.
 const exported=await run('export');ok(exported.decisions.length===5&&exported.notes.length===1&&exported.audit_log.length>logs,'Full export');
 const dest=path.join(temp,'export.json');await run('export',`--file=${dest}`);await rejects(['export',`--file=${dest}`],/EEXIST/);
 for(const [c,ref] of [['weekly-review'],['draft-adjustment','RL-1'],['draft-accrual-request','Southern Cross']])ok(fs.existsSync((await run(c,...(ref?[ref]:[]))).file),c);
 ok(fs.readFileSync((await run('draft-adjustment','RL-1')).file,'utf8').includes('Billed above the agreed partner rate'),'Adjustment note carries the reason');
 eq((await run('help')).commands.length,commands.length,'Help inventory');
 const missed=commands.filter(c=>!covered.has(c));ok(!missed.length,'Every CLI command covered: '+missed.join(','));
 const tables=await db.query("select relname,relrowsecurity from pg_class where relname in ('firms','timekeepers','matters','invoices','line_items','accruals','decisions','settings','notes','audit_log')");ok(tables.length===10&&tables.every(x=>x.relrowsecurity),'Tables private by default');
 await assert.rejects(()=>db.query("insert into firms(name) values ('Unaudited')"),/actor/);checks++;
 const fresh=await run('show','firms',firm.id);await run('update','firms',firm.id,'--name=Rimu Legal <script>alert(1)</script>',`--expected-version=${fresh.version}`,'--actor=Hana');
 await db.close();db=null;
 JSON.parse(child('scripts/spend.mjs',['invoice-review','--json']).stdout);child('scripts/spend.mjs',['show','firms','Law'],1);child('scripts/spend.mjs',['oops'],1);
 child('scripts/view.mjs');child('scripts/docs.mjs');
 eq(fs.readdirSync(path.join(temp,'views')).length,2,'Two reports');ok(fs.readdirSync(path.join(temp,'docs-out','matter-spend-report')).length>=6,'Matter spend reports');
 eq(fs.readdirSync(path.join(temp,'docs-out','accrual-schedule')).length,1,'Accrual schedule');ok(fs.readdirSync(path.join(temp,'docs-out','invoice-review-note')).length>=3,'Invoice review notes');
 const html=fs.readFileSync(path.join(temp,'views','panel.html'),'utf8');ok(html.includes('Rimu Legal')&&!html.includes('<script>alert(1)</script>'),'Reports render and escape');
 console.log(`PASS: ${checks} assertions; ${commands.length} CLI commands exercised; ${process.env.TEST_DATABASE_URL?'Postgres':'PGlite'}; isolated database.`);
}finally{if(db)await db.close();fs.rmSync(temp,{recursive:true,force:true});}

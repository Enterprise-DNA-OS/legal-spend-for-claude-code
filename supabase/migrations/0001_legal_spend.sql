-- Legal spend: the outside counsel panel, its rate card, matters, invoices, line items and month-end accruals.
-- Money is numeric(12,2) in the invoice currency. Dates are calendar dates. Every write carries an actor.

create table firms (id uuid primary key default gen_random_uuid(), name text not null unique check (length(trim(name))>0), owner text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1,
 country text check (country in ('NZ','AU','other')), tax_id text, panel_status text not null default 'approved' check (panel_status in ('panel','approved','off-panel')), panel_expiry date, guidelines_accepted_on date, contact_email text, status text not null default 'active' check (status in ('active','retired')));

create table timekeepers (id uuid primary key default gen_random_uuid(), name text not null check (length(trim(name))>0), owner text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1,
 firm_id uuid not null references firms(id), classification text, approved_rate numeric(10,2) check (approved_rate>=0), rate_from date, rate_to date, status text not null default 'active' check (status in ('active','retired')), check (rate_to is null or rate_from is null or rate_to>=rate_from));

create table matters (id uuid primary key default gen_random_uuid(), name text not null check (length(trim(name))>0), owner text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1,
 matter_number text unique, firm_id uuid references firms(id), business_unit text, category text, status text not null default 'open' check (status in ('open','closed')), opened_on date, closed_on date,
 fee_arrangement text not null default 'hourly' check (fee_arrangement in ('hourly','fixed','capped')), budget numeric(12,2) check (budget>=0), estimate_updated_on date, currency text not null default 'NZD', source_data jsonb);

create table invoices (id uuid primary key default gen_random_uuid(), name text not null check (length(trim(name))>0), owner text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1,
 firm_id uuid not null references firms(id), matter_id uuid references matters(id), invoice_date date not null, received_on date, due_date date, billing_start date, billing_end date, currency text not null default 'NZD',
 subtotal numeric(12,2), gst numeric(12,2), total numeric(12,2) not null, buyer_identified boolean, status text not null default 'received' check (status in ('received','in-review','approved','adjusted','rejected','paid')),
 approved_amount numeric(12,2), decision_note text, decided_on date, source_id text unique, source_state text, source_data jsonb,
 unique (firm_id,name), check (billing_end is null or billing_start is null or billing_end>=billing_start), check (status not in ('approved','adjusted','paid') or approved_amount is not null));

create table line_items (id uuid primary key default gen_random_uuid(), invoice_id uuid not null references invoices(id) on delete cascade, line_no integer not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1,
 kind text not null check (kind in ('fee','expense','adjustment')), item_date date, timekeeper_name text, timekeeper_ref text, classification text, units numeric(10,2), rate numeric(10,2), adjustment numeric(12,2) not null default 0, amount numeric(12,2) not null,
 task_code text, activity_code text, expense_code text, description text, reduction numeric(12,2) not null default 0 check (reduction>=0), reduction_reason text,
 unique (invoice_id,line_no), check (reduction=0 or nullif(trim(reduction_reason),'') is not null), check (kind='adjustment' or reduction<=abs(amount)));

create table accruals (id uuid primary key default gen_random_uuid(), matter_id uuid not null references matters(id), period date not null check (extract(day from period)=1), amount numeric(12,2) not null check (amount>=0), basis text not null, actor text not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1, unique (matter_id,period));

create table decisions (id uuid primary key default gen_random_uuid(), invoice_id uuid not null references invoices(id), invoice_version integer not null, decision text not null check (decision in ('approved','adjusted','rejected')), approved_amount numeric(12,2), reason text, actor text not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), check (decision<>'rejected' or nullif(trim(reason),'') is not null));

-- The billing guidelines the team enforces. One row. Change it with /customise or update settings.
create table settings (id integer primary key default 1 check (id=1), max_daily_hours numeric(5,2) not null default 10, min_description_words integer not null default 4, vague_terms text not null default 'attention to file,work on matter,review file,various matters',
 disallowed_expense_codes text not null default 'E101,E105,E108,E111', submit_within_days integer not null default 60, budget_warning_pct integer not null default 80, estimate_stale_days integer not null default 90,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1);
insert into settings(id) values (1);

create table notes (id uuid primary key default gen_random_uuid(), matter_id uuid not null references matters(id), body text not null, actor text not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table audit_log (id uuid primary key default gen_random_uuid(), entity text not null, record_id text not null, action text not null, actor text not null, before_data jsonb, after_data jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now());

create function record_change() returns trigger language plpgsql as $$
declare who text;
begin
 who := nullif(current_setting('app.actor', true),'');
 if who is null then raise exception 'An actor is required'; end if;
 insert into audit_log(entity,record_id,action,actor,before_data,after_data) values (TG_TABLE_NAME,NEW.id::text,TG_OP,who,case when TG_OP='UPDATE' then to_jsonb(OLD) else null end,to_jsonb(NEW));
 return NEW;
end $$;
create function touch_record() returns trigger language plpgsql as $$ begin NEW.updated_at=now(); NEW.version=OLD.version+1; return NEW; end $$;

create trigger track_firms after insert or update on firms for each row execute function record_change();
create trigger track_timekeepers after insert or update on timekeepers for each row execute function record_change();
create trigger track_matters after insert or update on matters for each row execute function record_change();
create trigger track_invoices after insert or update on invoices for each row execute function record_change();
create trigger track_line_items after insert or update on line_items for each row execute function record_change();
create trigger track_accruals after insert or update on accruals for each row execute function record_change();
create trigger track_decisions after insert on decisions for each row execute function record_change();
create trigger track_settings after update on settings for each row execute function record_change();
create trigger touch_firms before update on firms for each row execute function touch_record();
create trigger touch_timekeepers before update on timekeepers for each row execute function touch_record();
create trigger touch_matters before update on matters for each row execute function touch_record();
create trigger touch_invoices before update on invoices for each row execute function touch_record();
create trigger touch_line_items before update on line_items for each row execute function touch_record();
create trigger touch_accruals before update on accruals for each row execute function touch_record();
create trigger touch_settings before update on settings for each row execute function touch_record();

alter table firms enable row level security; revoke all on firms from public;
alter table timekeepers enable row level security; revoke all on timekeepers from public;
alter table matters enable row level security; revoke all on matters from public;
alter table invoices enable row level security; revoke all on invoices from public;
alter table line_items enable row level security; revoke all on line_items from public;
alter table accruals enable row level security; revoke all on accruals from public;
alter table decisions enable row level security; revoke all on decisions from public;
alter table settings enable row level security; revoke all on settings from public;
alter table notes enable row level security; revoke all on notes from public;
alter table audit_log enable row level security; revoke all on audit_log from public;

-- Every line item against the rate card and the guidelines. One row per line per rule broken.
-- at_stake is the money a reviewer can ask the firm to take off; 0 means "query it".
create view line_flags as
with l as (
 select l.*, i.name as invoice, i.firm_id, i.billing_start, i.billing_end, i.status as invoice_status, f.name as firm,
  (select t.approved_rate from timekeepers t where t.firm_id=i.firm_id and lower(trim(t.name))=lower(trim(l.timekeeper_name)) and t.status='active'
    and (t.rate_from is null or l.item_date is null or l.item_date>=t.rate_from) and (t.rate_to is null or l.item_date is null or l.item_date<=t.rate_to) order by t.rate_from desc nulls last limit 1) as card_rate
 from line_items l join invoices i on i.id=l.invoice_id join firms f on f.id=i.firm_id
), s as (select * from settings where id=1),
day_hours as (select firm_id, lower(trim(timekeeper_name)) as tk, item_date, sum(units) as hours from l where kind='fee' and timekeeper_name is not null and item_date is not null group by 1,2,3)
select l.id, l.invoice_id, l.invoice, l.firm, l.invoice_status, l.line_no, l.item_date, l.timekeeper_name, l.units, l.rate, l.card_rate, l.amount, l.description, x.rule, x.at_stake
from l cross join s cross join lateral (values
 ('RATE-ABOVE-CARD', case when l.kind='fee' and l.card_rate is not null and l.rate>l.card_rate then round((l.rate-l.card_rate)*coalesce(l.units,0),2) end),
 ('TIMEKEEPER-NOT-ON-CARD', case when l.kind='fee' and l.timekeeper_name is not null and l.units is not null and l.card_rate is null then l.amount end),
 ('OUTSIDE-BILLING-PERIOD', case when l.kind<>'adjustment' and l.item_date is not null and (l.item_date<l.billing_start or l.item_date>l.billing_end) then l.amount end),
 ('DISALLOWED-EXPENSE', case when l.kind='expense' and upper(coalesce(l.expense_code,'')) = any (string_to_array(upper(replace(s.disallowed_expense_codes,' ','')),',')) then l.amount end),
 ('ARITHMETIC', case when l.kind='fee' and l.units is not null and l.rate is not null and abs(round(l.units*l.rate+l.adjustment,2)-l.amount)>0.01 then greatest(round(l.amount-(l.units*l.rate+l.adjustment),2),0) end),
 ('BLOCK-BILLING', case when l.kind='fee' and coalesce(l.units,0)>1 and length(coalesce(l.description,''))-length(replace(coalesce(l.description,''),';',''))>=2 then 0 end),
 ('VAGUE-DESCRIPTION', case when l.kind='fee' and (coalesce(array_length(regexp_split_to_array(trim(coalesce(l.description,'')),'\s+'),1),0)<s.min_description_words
   or exists (select 1 from unnest(string_to_array(s.vague_terms,',')) v where length(trim(v))>0 and position(lower(trim(v)) in lower(coalesce(l.description,'')))>0)) then 0 end),
 ('DAILY-HOURS', case when l.kind='fee' and exists (select 1 from day_hours d where d.firm_id=l.firm_id and d.tk=lower(trim(l.timekeeper_name)) and d.item_date=l.item_date and d.hours>s.max_daily_hours) then 0 end)
) as x(rule, at_stake)
where x.at_stake is not null;

create view invoice_queue as
select i.id, i.name, f.name as firm, m.name as matter, m.matter_number, i.owner as reviewer, i.status, i.currency, i.invoice_date, i.received_on, i.due_date, i.total,
 (select coalesce(sum(reduction),0) from line_items x where x.invoice_id=i.id) as reductions,
 (select count(*) from line_flags g where g.invoice_id=i.id) as flags,
 (select coalesce(sum(at_stake),0) from line_flags g where g.invoice_id=i.id) as at_stake,
 current_date-coalesce(i.received_on,i.invoice_date) as days_waiting, i.due_date-current_date as days_to_due, i.version
from invoices i join firms f on f.id=i.firm_id left join matters m on m.id=i.matter_id;

create view matter_spend as
select m.id, m.name, m.matter_number, m.owner, f.name as firm, m.business_unit, m.category, m.status, m.fee_arrangement, m.currency, m.budget, m.estimate_updated_on,
 coalesce(sum(case when i.status in ('approved','adjusted','paid') then i.approved_amount end),0) as approved,
 coalesce(sum(case when i.status in ('received','in-review') then i.total end),0) as pending,
 coalesce((select a.amount from accruals a where a.matter_id=m.id and a.period=date_trunc('month',current_date)::date),0) as accrued,
 coalesce(sum(case when i.status in ('approved','adjusted','paid') then i.approved_amount when i.status in ('received','in-review') then i.total end),0)
  + coalesce((select a.amount from accruals a where a.matter_id=m.id and a.period=date_trunc('month',current_date)::date),0) as forecast
from matters m left join firms f on f.id=m.firm_id left join invoices i on i.matter_id=m.id
group by m.id, f.name;

create view budget_position as
select id, name, matter_number, owner, firm, fee_arrangement, budget, approved, pending, accrued, forecast,
 case when budget>0 then round(100*forecast/budget) end as burn_pct, estimate_updated_on, status
from matter_spend;

create view accrual_status as
select m.id, m.name, m.matter_number, m.owner, f.name as firm, f.contact_email, date_trunc('month',current_date)::date as period,
 a.amount as this_month, p.amount as last_month, a.basis
from matters m left join firms f on f.id=m.firm_id
left join accruals a on a.matter_id=m.id and a.period=date_trunc('month',current_date)::date
left join accruals p on p.matter_id=m.id and p.period=(date_trunc('month',current_date)-interval '1 month')::date
where m.status='open';

create view firm_scorecard as
select f.id, f.name, f.country, f.panel_status, f.panel_expiry, count(i.id) as invoices, coalesce(sum(i.total),0) as billed,
 coalesce(sum(case when i.status in ('approved','adjusted','paid') then i.approved_amount end),0) as approved,
 coalesce(sum(case when i.status in ('approved','adjusted','paid') then i.total-i.approved_amount end),0) as reduced,
 (select count(*) from line_flags g join invoices gi on gi.id=g.invoice_id where gi.firm_id=f.id) as flags,
 round(avg(i.invoice_date-i.billing_end)) as avg_days_to_bill
from firms f left join invoices i on i.firm_id=f.id
group by f.id;

create view rate_variance as
select f.name as firm, l.timekeeper_name, l.classification, round(sum(l.rate*l.units)/nullif(sum(l.units),0),2) as billed_rate,
 max(t.approved_rate) as card_rate, sum(l.units) as hours,
 round(sum(greatest(l.rate-coalesce(t.approved_rate,l.rate),0)*l.units),2) as above_card
from line_items l join invoices i on i.id=l.invoice_id join firms f on f.id=i.firm_id
left join timekeepers t on t.firm_id=i.firm_id and lower(trim(t.name))=lower(trim(l.timekeeper_name)) and t.status='active'
where l.kind='fee' and l.units>0
group by f.name, l.timekeeper_name, l.classification;

create view compliance_findings as
select 'NZ-GST-TAX-INVOICE'::text as rule, i.name as record, f.name as firm, 'NZ supplier invoice over the threshold has no supplier GST number on file'::text as finding
 from invoices i join firms f on f.id=i.firm_id where f.country='NZ' and i.total>200 and nullif(trim(f.tax_id),'') is null
union all select 'NZ-GST-BUYER', i.name, f.name, 'NZ invoice over the higher threshold: buyer details not confirmed' from invoices i join firms f on f.id=i.firm_id where f.country='NZ' and i.total>1000 and i.buyer_identified is not true
union all select 'AU-TAX-INVOICE', i.name, f.name, 'AU supplier invoice has no ABN on file' from invoices i join firms f on f.id=i.firm_id where f.country='AU' and nullif(trim(f.tax_id),'') is null
union all select 'AU-TAX-INVOICE-BUYER', i.name, f.name, 'AU invoice at or over the threshold: buyer identity or ABN not confirmed' from invoices i join firms f on f.id=i.firm_id where f.country='AU' and i.total>=1000 and i.buyer_identified is not true
union all select 'LOCAL-GST-RATE', i.name, f.name, 'GST is not the standard rate of the subtotal: confirm zero-rated or GST-free lines' from invoices i join firms f on f.id=i.firm_id
 where i.gst is not null and i.subtotal is not null and f.country in ('NZ','AU') and abs(i.gst-round(i.subtotal*case f.country when 'NZ' then 0.15 else 0.10 end,2))>0.05
union all select 'LOCAL-TOTALS', i.name, f.name, 'Line items do not add up to the invoice subtotal' from invoices i join firms f on f.id=i.firm_id
 where exists (select 1 from line_items x where x.invoice_id=i.id) and abs((select sum(amount) from line_items x where x.invoice_id=i.id)-coalesce(i.subtotal,i.total))>0.01
union all select 'LOCAL-PANEL', i.name, f.name, 'Invoice from an off-panel firm or after the panel appointment expired' from invoices i join firms f on f.id=i.firm_id
 where i.status in ('received','in-review') and (f.panel_status='off-panel' or (f.panel_expiry is not null and i.invoice_date>f.panel_expiry))
union all select 'LOCAL-GUIDELINES', f.name, f.name, 'Firm has not accepted the billing guidelines' from firms f where f.status='active' and f.guidelines_accepted_on is null
union all select 'LOCAL-LATE-INVOICE', i.name, f.name, 'Invoice issued after the guideline submission window' from invoices i join firms f on f.id=i.firm_id cross join settings s
 where i.billing_end is not null and i.invoice_date-i.billing_end>s.submit_within_days
union all select 'LOCAL-ESTIMATE', b.name, b.firm, 'Forecast spend past the budget warning level and no recent revised estimate from the firm' from budget_position b cross join settings s
 where b.status='open' and b.burn_pct>=s.budget_warning_pct and (b.estimate_updated_on is null or b.estimate_updated_on<current_date-s.estimate_stale_days)
union all select 'LOCAL-MATTER', i.name, f.name, 'Invoice is not allocated to a matter' from invoices i join firms f on f.id=i.firm_id where i.matter_id is null;

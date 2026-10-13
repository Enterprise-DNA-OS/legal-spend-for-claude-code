-- Fictional demo records for Harbourline Group's in-house legal team. Dates move with today.
-- Deliberate problems: a rate above the card, a timekeeper not on the card, block billing, a 11.5 hour day,
-- a disallowed meals expense, travel outside the billing period, an off-panel firm with no GST number,
-- an expired panel appointment, an arithmetic error, a matter near its budget with a stale estimate, missing accruals.
begin;
select set_config('app.actor','Demo seed',true);
insert into firms(id,name,owner,country,tax_id,panel_status,panel_expiry,guidelines_accepted_on,contact_email) values
('10000000-0000-0000-0000-000000000001','Kauri Lane Lawyers','Hana','NZ','123-456-789','panel',current_date+300,current_date-400,'billing@kaurilane.example'),
('10000000-0000-0000-0000-000000000002','Southern Cross Legal','Liam','AU','51 824 753 556','panel',current_date+200,current_date-380,'accounts@southerncross.example'),
('10000000-0000-0000-0000-000000000003','Totara Chambers','Hana','NZ',null,'off-panel',null,null,'clerk@totara.example'),
('10000000-0000-0000-0000-000000000004','Pohutukawa Employment Law','Liam','NZ','98-765-432','panel',current_date-20,current_date-700,'office@pohutukawa.example') on conflict(id) do nothing;
insert into timekeepers(id,name,firm_id,classification,approved_rate,rate_from) values
('20000000-0000-0000-0000-000000000001','Aroha Ngata','10000000-0000-0000-0000-000000000001','Partner',650,current_date-400),
('20000000-0000-0000-0000-000000000002','James Whitlock','10000000-0000-0000-0000-000000000001','Senior Associate',420,current_date-400),
('20000000-0000-0000-0000-000000000003','Mei Chen','10000000-0000-0000-0000-000000000001','Solicitor',290,current_date-400),
('20000000-0000-0000-0000-000000000004','Olivia Hart','10000000-0000-0000-0000-000000000002','Partner',720,current_date-380),
('20000000-0000-0000-0000-000000000005','Tom Riley','10000000-0000-0000-0000-000000000002','Associate',380,current_date-380),
('20000000-0000-0000-0000-000000000006','Rachel Moana','10000000-0000-0000-0000-000000000004','Partner',560,current_date-700) on conflict(id) do nothing;
insert into matters(id,name,owner,matter_number,firm_id,business_unit,category,status,opened_on,closed_on,fee_arrangement,budget,estimate_updated_on,currency) values
('30000000-0000-0000-0000-000000000001','Supply agreement dispute','Hana','HL-2026-014','10000000-0000-0000-0000-000000000001','Commercial','Litigation','open',current_date-200,null,'hourly',40000,current_date-150,'NZD'),
('30000000-0000-0000-0000-000000000002','Distribution centre lease renewal','Hana','HL-2026-021','10000000-0000-0000-0000-000000000001','Property','Property','closed',current_date-260,current_date-60,'fixed',12000,null,'NZD'),
('30000000-0000-0000-0000-000000000003','Trade mark opposition','Liam','HL-2026-027','10000000-0000-0000-0000-000000000002','Brand','Intellectual property','open',current_date-120,null,'capped',25000,current_date-30,'AUD'),
('30000000-0000-0000-0000-000000000004','Restructure consultation','Liam','HL-2026-030','10000000-0000-0000-0000-000000000004','People','Employment','open',current_date-45,null,'hourly',18000,null,'NZD'),
('30000000-0000-0000-0000-000000000005','Privacy incident advice','Hana','HL-2026-033','10000000-0000-0000-0000-000000000003','Technology','Regulatory','open',current_date-35,null,'hourly',null,null,'NZD') on conflict(id) do nothing;
insert into invoices(id,name,owner,firm_id,matter_id,invoice_date,received_on,due_date,billing_start,billing_end,currency,subtotal,gst,total,buyer_identified,status,approved_amount,decided_on,decision_note) values
('40000000-0000-0000-0000-000000000001','KLL-4471','Hana','10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',current_date-40,current_date-38,current_date-20,current_date-75,current_date-45,'NZD',12160,1824,13984,true,'approved',13984,current_date-30,null),
('40000000-0000-0000-0000-000000000002','KLL-4532','Hana','10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',current_date-6,current_date-4,current_date+14,current_date-35,current_date-7,'NZD',10578.50,1586.78,12165.28,null,'received',null,null,null),
('40000000-0000-0000-0000-000000000003','SCL-20931','Liam','10000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000003',current_date-9,current_date-8,current_date+5,current_date-38,current_date-9,'AUD',5340,534,5874,true,'in-review',null,null,null),
('40000000-0000-0000-0000-000000000004','TC-0098','Hana','10000000-0000-0000-0000-000000000003','30000000-0000-0000-0000-000000000005',current_date-15,current_date-14,current_date+6,current_date-45,current_date-16,'NZD',3000,450,3450,null,'received',null,null,null),
('40000000-0000-0000-0000-000000000005','PEL-1187','Liam','10000000-0000-0000-0000-000000000004','30000000-0000-0000-0000-000000000004',current_date-2,current_date-1,current_date+18,current_date-32,current_date-3,'NZD',4460,669,5129,true,'received',null,null,null),
('40000000-0000-0000-0000-000000000006','KLL-4390','Hana','10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002',current_date-70,current_date-68,current_date-50,current_date-230,current_date-170,'NZD',11500,1725,13225,true,'paid',13225,current_date-60,null) on conflict(id) do nothing;
insert into line_items(id,invoice_id,line_no,kind,item_date,timekeeper_name,classification,units,rate,amount,expense_code,description) values
('50000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001',1,'fee',current_date-70,'Aroha Ngata','Partner',9,650,5850,null,'Strategy for statement of defence and counterclaim'),
('50000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000001',2,'fee',current_date-65,'James Whitlock','Senior Associate',9.5,420,3990,null,'Draft statement of defence and counterclaim'),
('50000000-0000-0000-0000-000000000003','40000000-0000-0000-0000-000000000001',3,'fee',current_date-60,'Mei Chen','Solicitor',8,290,2320,null,'Prepare discovery list and document review protocol'),
('50000000-0000-0000-0000-000000000004','40000000-0000-0000-0000-000000000002',1,'fee',current_date-20,'Aroha Ngata','Partner',6,700,4200,null,'Prepare for mediation; review expert report; call with opposing counsel'),
('50000000-0000-0000-0000-000000000005','40000000-0000-0000-0000-000000000002',2,'fee',current_date-19,'James Whitlock','Senior Associate',7.5,420,3150,null,'Draft mediation submissions on damages quantum'),
('50000000-0000-0000-0000-000000000006','40000000-0000-0000-0000-000000000002',3,'fee',current_date-19,'James Whitlock','Senior Associate',4,420,1680,null,'Review correspondence and evidence bundle index'),
('50000000-0000-0000-0000-000000000007','40000000-0000-0000-0000-000000000002',4,'fee',current_date-15,'Ben Foster','Solicitor',3,350,1050,null,'Attention to file'),
('50000000-0000-0000-0000-000000000008','40000000-0000-0000-0000-000000000002',5,'expense',current_date-12,null,null,1,86.50,86.50,'E111','Working lunch'),
('50000000-0000-0000-0000-000000000009','40000000-0000-0000-0000-000000000002',6,'expense',current_date-40,null,null,1,412,412,'E110','Flight Auckland to Wellington for mediation'),
('50000000-0000-0000-0000-000000000010','40000000-0000-0000-0000-000000000003',1,'fee',current_date-20,'Olivia Hart','Partner',2.5,720,1800,null,'Settle evidence in answer to the opposition'),
('50000000-0000-0000-0000-000000000011','40000000-0000-0000-0000-000000000003',2,'fee',current_date-18,'Tom Riley','Associate',8,395,3160,null,'Research prior use evidence and draft declaration'),
('50000000-0000-0000-0000-000000000012','40000000-0000-0000-0000-000000000003',3,'fee',current_date-17,'Tom Riley','Associate',1,380,380,null,'Emails'),
('50000000-0000-0000-0000-000000000013','40000000-0000-0000-0000-000000000004',1,'fee',current_date-30,'Sione Taufa','Barrister',5,600,3000,null,'Advise on notifiable privacy breach assessment and notice to the Commissioner'),
('50000000-0000-0000-0000-000000000014','40000000-0000-0000-0000-000000000005',1,'fee',current_date-10,'Rachel Moana','Partner',6,560,3360,null,'Prepare consultation documents and proposal letter for affected roles'),
('50000000-0000-0000-0000-000000000015','40000000-0000-0000-0000-000000000005',2,'fee',current_date-9,'Rachel Moana','Partner',2,560,1100,null,'Meeting with HR lead on consultation timetable'),
('50000000-0000-0000-0000-000000000016','40000000-0000-0000-0000-000000000006',1,'fee',current_date-200,null,null,null,null,11500,null,'Fixed fee: lease renewal negotiation stage one') on conflict(id) do nothing;
insert into decisions(id,invoice_id,invoice_version,decision,approved_amount,reason,actor,created_at) values
('60000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001',1,'approved',13984,null,'Hana',now()-interval '30 days'),
('60000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000006',1,'approved',13225,null,'Hana',now()-interval '60 days') on conflict(id) do nothing;
insert into accruals(id,matter_id,period,amount,basis,actor) values
('70000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',date_trunc('month',current_date)::date,9000,'Kauri Lane estimate of unbilled work','Hana'),
('70000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000001',(date_trunc('month',current_date)-interval '1 month')::date,7500,'Kauri Lane estimate of unbilled work','Hana'),
('70000000-0000-0000-0000-000000000003','30000000-0000-0000-0000-000000000003',(date_trunc('month',current_date)-interval '1 month')::date,4000,'Southern Cross estimate of unbilled work','Liam') on conflict(id) do nothing;
commit;

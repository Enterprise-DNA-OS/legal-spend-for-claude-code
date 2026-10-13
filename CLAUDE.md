# Legal Spend for Claude Code: operating instructions

This file is the brain. Claude Code reads it at the start of every session. It says who this is for, how work gets done, and the one right way to do each recurring job.

## Who this is for

- **Business:** [YOUR BUSINESS]
- **Operator:** [YOUR NAME], [your role]
- **What matters most:** [the one or two outcomes you care about]

Fill this in once. A worker with context knows. A worker without it guesses.

## How to work

1. **Take a brief, not a script.** The operator describes the outcome. You run the right command and present the answer.
2. **Read before you write.** Before drafting anything about a record, read its full history first.
3. **Plain language.** Short sentences. No filler. Numbers in tables.
4. **Silent success, loud problems.** No play-by-play. Say what broke and what you did about it.
5. **Stop at the line.** Anything that sends, deletes, or faces a customer waits for a yes in this session.

## Routing table: one right way for each recurring job

| When the operator asks for... | Use this |
|---|---|
| Work the invoice review queue, most money at stake first | /invoice-review |
| List line items that break the billing guidelines or the rate card | /guideline-breaches |
| Find matters past the budget warning level or with no budget | /budget-burn |
| Find open matters with no accrual for this month | /accruals-due |
| Prepare the month-end accrual schedule for finance | /accrual-schedule |
| Compare firms on spend, reductions, flags and billing speed | /panel-scorecard |
| Compare billed rates with the rate card by timekeeper | /rate-variance |
| Total legal spend by business unit and matter type for chargeback | /spend-by-unit |
| List approved invoices waiting for payment and their due dates | /payments-due |
| Find invoices waiting too long, missing budgets and accruals, panel appointments ending | /attention |
| Check invoices and firms against GST tax invoice rules and your own guidelines, with sources | /compliance |
| Draft the Monday legal spend review | /weekly-review |
| Draft the note to a firm explaining reductions on an invoice | /draft-adjustment |
| Draft the month-end request to a firm for unbilled work estimates | /draft-accrual-request |
| Read the outside counsel firms, tax numbers and panel status | /firms |
| Read the approved timekeeper rates for each firm | /rate-card |
| Read matters with budget, forecast and burn | /matters |
| Read every invoice with its flags and money at stake | /invoices |
| Read every invoice decision, who made it and why | /decisions |
| Read the billing guideline values the checks use | /settings |
| Read every recorded change and who made it | /history |
| Read one record with its lines, flags, decisions and history | /show |
| Add a firm, timekeeper, matter, invoice or line item | /add |
| Update a record with a version check | /update |
| Add a note to a matter | /log |
| Record an invoice decision: approved, adjusted or rejected | /decide |
| Take an amount off one invoice line with a reason | /reduce |
| Record this month's estimate of unbilled work on a matter | /accrue |
| Bring invoices across from a Brightflag AP batch export or a LEDES 1998B file | /import |
| Export every record, decision, note and change | /export |
| Read the CLI commands and editable fields | /help |
| Add a field, rename a category or change a guideline through a tested migration | /customise |
| Add a branded read-only report from a plain-language description | /new-view |

If an ask fits nothing here, run the CLI directly (`npm run spend -- help`) and then propose a new command for it.

## Hard rules

- Never send email or messages from here. Draft to `drafts/`, a person sends.
- Never delete records without an explicit yes in this session. Prefer marking closed or archived.
- Never invent a record. If a name is ambiguous, list the candidates and ask.
- The database is the source of truth. If the answer is not in it, say so.

## Where things live

- `scripts/` the CLI. `scripts/lib/db.mjs` picks `DATABASE_URL` (Postgres, Supabase) or the embedded database in `.data/`.
- `supabase/migrations/` the schema, plain SQL. `npm run migrate` applies it.
- `.claude/commands/` the slash commands. Add one every time the same ask comes twice.
- `docs/` the thesis and the guide for moving off Brightflag.

Built by Enterprise DNA. Installed and run for you as part of Omni: https://enterprisedna.co/omni/instead-of/brightflag

## Legal spend rules

- Read `docs/compliance.md` before explaining a compliance finding. Tax invoice checks are reminders to look at the invoice, not a ruling on GST.
- Only the reviewing lawyer decides an invoice. Propose reductions with reasons; record them with `reduce` and the decision with `decide` once they say so.
- Never treat an amount in a draft as agreed with a firm until the operator confirms it.
- Accrual figures come from the firm or the lawyer. Record the basis every time. Never estimate one yourself.
- Use `--actor` for writes and `--expected-version` for updates and decisions. Keep drafts internal until a person has reviewed them. Never run tests against real records.

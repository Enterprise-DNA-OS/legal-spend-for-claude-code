<h1 align="center">Legal Spend for Claude Code</h1>

<p align="center">
  <strong>The open-source legal spend and e-billing system that is just a database and Claude Code.</strong>
</p>

<p align="center">
  Created by <a href="https://www.enterprisedna.co"><strong>Enterprise DNA</strong></a>. Free and open source. Works with Claude Code, Codex, OpenCode or Cursor.
</p>

<!-- three-doors -->
<table align="center">
  <tr>
    <td align="center"><strong>Do it yourself</strong><br/>Clone it, run it, own it. Free, MIT.<br/><a href="#quick-start">Quick start</a></td>
    <td align="center"><strong>We customise it</strong><br/>Your fields, your rules, your Brightflag data brought across.<br/><a href="https://enterprisedna.co/omni/book/?utm_source=github&utm_medium=readme&utm_campaign=brightflag">Book a call</a></td>
    <td align="center"><strong>We run it for you</strong><br/>Installed, connected and operated inside Omni. Setup fee, then a retainer.<br/><a href="https://enterprisedna.co/omni/instead-of/brightflag?utm_source=github&utm_medium=readme&utm_campaign=brightflag">How it works</a></td>
  </tr>
</table>

<p align="center">
  <a href="#what-is-this">What is this</a> &bull;
  <a href="#why-no-front-end">Why no front end</a> &bull;
  <a href="#quick-start">Quick start</a> &bull;
  <a href="#the-commands">Commands</a> &bull;
  <a href="#instead-of-brightflag">Instead of Brightflag</a> &bull;
  <a href="#want-it-installed-and-run-for-you">Installed for you</a> &bull;
  <a href="#license">License</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node-20+-339933?style=flat-square" alt="Node 20+" />
  <img src="https://img.shields.io/badge/PostgreSQL-any-336791?style=flat-square" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/PGlite-embedded-3ecf8e?style=flat-square" alt="PGlite" />
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square" alt="MIT License" />
</p>

---

## What is this

Legal Spend for Claude Code does the job you pay Brightflag for, as a Postgres database and a set of agent commands. There is no web front end. You open the folder in [Claude Code](https://claude.com/claude-code) (or Codex, OpenCode, Cursor: see `AGENTS.md`) and ask for what you want in plain language. It runs the right query against your own records, and you can add a new question whenever the business asks one.

Brightflag publishes no price list. Its own FAQ says the price is a fixed one-time implementation fee plus an annual subscription based on your annual outside counsel spend, so the bill grows as your legal spend grows ([Brightflag FAQ](https://brightflag.com/brightflag-faq/), checked 13 October 2026).

Want the same thing with a web front end, or built on a different stack? That is a customisation, and it is exactly what Enterprise DNA does: [book a call](https://enterprisedna.co/omni/book/?utm_source=github&utm_medium=readme&utm_campaign=brightflag).

Built for the in-house legal team that pays outside law firms: the general counsel, the legal operations lead and the finance partner who asks for accruals every month. It holds the panel, each firm's rate card, matters and budgets, invoices and their line items, and month-end accruals. Every line is checked against the rate card and your billing guidelines, so the review starts with the money at stake, not a PDF. It does not run a portal for firms to upload invoices or read PDF invoices for you: firms send LEDES files or you load the AP export, and Enterprise DNA builds the portal or the PDF reading into your version if you want them.

## Why no front end

- The front end was only ever there because the database was hard to talk to. That is no longer true.
- Your data sits in plain Postgres tables you own. Any tool can read them. No export, no lock-in.
- No seats, no tiers, no add-ons. Read [docs/why-no-front-end.md](docs/why-no-front-end.md) for the honest trade-offs too.

## Quick start

Sixty seconds, no database install (an embedded Postgres runs inside Node):

```bash
git clone https://github.com/Enterprise-DNA-OS/legal-spend-for-claude-code.git
cd legal-spend-for-claude-code
npm install
npm run demo
```

Then open the folder in Claude Code and type a slash command. Start with /invoice-review, then /guideline-breaches. For real records, choose an empty `DATA_DIR` and run `npm run migrate` without the fictional seed.

### Use it with your own Postgres or Supabase

Copy `.env.example` to `.env`, set `DATABASE_URL`, then `npm run migrate`. Same commands, shared data, no per-seat fee.

## The commands

| Command | What it does |
|---|---|
| /invoice-review | Work the invoice review queue, most money at stake first |
| /guideline-breaches | List line items that break the billing guidelines or the rate card |
| /budget-burn | Find matters past the budget warning level or with no budget |
| /accruals-due | Find open matters with no accrual for this month |
| /accrual-schedule | Prepare the month-end accrual schedule for finance |
| /panel-scorecard | Compare firms on spend, reductions, flags and billing speed |
| /rate-variance | Compare billed rates with the rate card by timekeeper |
| /spend-by-unit | Total legal spend by business unit and matter type for chargeback |
| /payments-due | List approved invoices waiting for payment and their due dates |
| /attention | Find invoices waiting too long, missing budgets and accruals, panel appointments ending |
| /compliance | Check invoices and firms against GST tax invoice rules and your own guidelines, with sources |
| /weekly-review | Draft the Monday legal spend review |
| /draft-adjustment | Draft the note to a firm explaining reductions on an invoice |
| /draft-accrual-request | Draft the month-end request to a firm for unbilled work estimates |
| /firms | Read the outside counsel firms, tax numbers and panel status |
| /rate-card | Read the approved timekeeper rates for each firm |
| /matters | Read matters with budget, forecast and burn |
| /invoices | Read every invoice with its flags and money at stake |
| /decisions | Read every invoice decision, who made it and why |
| /settings | Read the billing guideline values the checks use |
| /history | Read every recorded change and who made it |
| /show | Read one record with its lines, flags, decisions and history |
| /add | Add a firm, timekeeper, matter, invoice or line item |
| /update | Update a record with a version check |
| /log | Add a note to a matter |
| /decide | Record an invoice decision: approved, adjusted or rejected |
| /reduce | Take an amount off one invoice line with a reason |
| /accrue | Record this month's estimate of unbilled work on a matter |
| /import | Bring invoices across from a Brightflag AP batch export or a LEDES 1998B file |
| /export | Export every record, decision, note and change |
| /help | Read the CLI commands and editable fields |
| /customise | Add a field, rename a category or change a guideline through a tested migration |
| /new-view | Add a branded read-only report from a plain-language description |

## Instead of Brightflag

Two one-command imports. The AP batch export (CSV) brings your approved invoice history with firms and matters: `npm run spend -- import brightflag --file=export.csv --actor=You --dry-run`, then again without `--dry-run`. LEDES 1998B files, which firms already produce for e-billing, bring the line items: `npm run spend -- import ledes --file=invoice.txt --actor=You`. Rehearse first, compare counts, then load. [Switching guide](docs/replace-brightflag.md).

## Architecture

```
legal-spend-for-claude-code/
  CLAUDE.md                 how the operator wants this run (routing table + house rules)
  AGENTS.md                 the same, for Codex / OpenCode / Cursor / Gemini CLI
  .claude/commands/         the slash commands
  scripts/                  the CLI the commands drive
  scripts/lib/db.mjs        one adapter: DATABASE_URL (pg) or embedded PGlite
  supabase/migrations/      plain SQL schema
  supabase/seed.sql         demo data
  docs/                     the thesis and the migration guide
```

## Built for coding agents

The database, CLI and command recipes work with Claude Code, Codex, OpenCode or Cursor. Ask your coding agent for a new command and have it implement and test the change against the same records.

## Contributing

Issues and pull requests are welcome. Keep the shape: plain SQL, a small CLI, a slash command per recurring job, no front end.

## Want it installed and run for you?

Enterprise DNA installs Legal Spend for Claude Code for your business, migrates your Brightflag data, connects it to the rest of your tools, and runs it for you as part of **Omni**, our managed Command Center. One setup fee, then a monthly retainer.

- Book a call: [enterprisedna.co/omni/book](https://enterprisedna.co/omni/book/?offer=replace-software&utm_source=github&utm_medium=readme&utm_campaign=brightflag)
- Read more: [enterprisedna.co/omni/instead-of/brightflag](https://enterprisedna.co/omni/instead-of/brightflag?utm_source=github&utm_medium=readme&utm_campaign=brightflag)

## License

MIT. Copyright (c) 2026 Enterprise DNA.

## How the checks work

Every line item is checked against the firm's rate card and the guideline values in the settings table: rate above the card, timekeeper not on the card, work dated outside the billing period, disallowed expense codes (copying, telephone, postage and meals by default), line arithmetic, block billing, vague descriptions and more than ten hours in a day. The first five carry money at stake. The rest are queries to put to the firm. Change any value with `update settings`.

An invoice is decided with `decide`, never edited into approval. A decision needs a matter. Reductions make it adjusted, and the approved amount takes off each reduction and its GST. Flags with money at stake and no reduction need a written reason. Every write needs `--actor`, updates need `--expected-version`, and every change lands in the audit log. Names match case insensitively, id prefixes and matter numbers work, and ambiguous matches list the candidates and exit 1. [Rules and sources](docs/compliance.md).

## Reports and paperwork

`npm run view` renders the week (invoices to review, breaches with money at stake, budgets past the warning level) and the panel review (firm scorecard, billed rates against the card, record checks). `npm run docs` renders an invoice review note per open or adjusted invoice, a spend report per matter, and the month-end accrual schedule for finance. Edit `brand.json` for your business name, logo and colours. Drafts never send.

## Ten questions to ask of your legal spend

Each one is answered by the free version today.

1. Which invoices carry the most money we could ask a firm to take off? `invoice-review`
2. Which lines bill a rate above the agreed card, and by how much? `guideline-breaches`
3. Who billed us that is not on the firm's approved rate card? `guideline-breaches`
4. Which matters will pass their budget once this month's work is billed? `budget-burn`
5. Which matters still have no accrual for month end? `accruals-due`
6. What does each business unit owe for legal work this year? `spend-by-unit`
7. Which firm takes longest to bill after the work is done? `panel-scorecard`
8. Which timekeepers bill above their card rate most often? `rate-variance`
9. Which invoices are missing a GST number, ABN or buyer details? `compliance`
10. Who approved this invoice, when, and why did they accept a flag? `decisions`

## Your first hour: ten things to ask for

1. Put our name and logo in brand.json.
2. Rehearse our Brightflag AP export.
3. Load last month's LEDES files from our panel firms.
4. Add each panel firm's rate card.
5. Show me the invoices with money at stake.
6. Set our guideline values: daily hours, disallowed expenses, submission window.
7. Find matters past 80 percent of budget.
8. Draft the month-end accrual requests.
9. Draft our Monday spend review.
10. Add a cost centre field to matters with /customise.

## Verification

`npm test` creates a temporary database, exercises every CLI command, and checks the guideline flags, decision rules, GST on reductions, version conflicts, transactional imports, unchanged re-imports, LEDES parsing, audit attribution and escaped reports. Windows and Linux CI run Node 20 and 22, and a separate Postgres 17 job runs the same tests. `TEST_DATABASE_URL` must point to an empty disposable database.

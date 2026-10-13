# Record checks and their sources

Checked 13 October 2026. `npm run spend -- compliance` runs every check below. This is a record tool for an in-house legal team. It does not give tax or legal advice, decide whether GST applies to a supply, or certify an invoice. The finance team and your adviser decide those. A finding is a reminder to look at the invoice.

| Check | What the data shows | Basis |
|---|---|---|
| NZ-GST-TAX-INVOICE | An NZ firm's invoice over $200 and no GST number recorded for the firm | Inland Revenue taxable supply information, link below |
| NZ-GST-BUYER | An NZ invoice over $1,000 where nobody has confirmed the buyer's details are on it | Inland Revenue taxable supply information |
| AU-TAX-INVOICE | An AU firm with no ABN recorded | ATO tax invoice requirements, link below |
| AU-TAX-INVOICE-BUYER | An AU invoice of $1,000 or more where nobody has confirmed the buyer's identity or ABN is on it | ATO tax invoice requirements |
| LOCAL-GST-RATE | GST is not 15% (NZ) or 10% (AU) of the subtotal | Local arithmetic check. Zero-rated, GST-free and overseas supplies are legitimate reasons |
| LOCAL-TOTALS | Line items do not add up to the invoice subtotal | Local arithmetic check |
| LOCAL-PANEL | An invoice under review from an off-panel firm, or dated after the firm's panel appointment ended | Your panel terms |
| LOCAL-GUIDELINES | An active firm has not accepted your billing guidelines | Your billing guidelines |
| LOCAL-LATE-INVOICE | An invoice issued more days after the billing period than the guidelines allow (60 by default) | Your billing guidelines |
| LOCAL-ESTIMATE | An open matter's forecast is past the budget warning level (80% by default) and the firm has not revised its estimate in 90 days | Your engagement terms |
| LOCAL-MATTER | An invoice not allocated to a matter | Local completeness rule |

## New Zealand

Inland Revenue sets out what a supplier must show as taxable supply information. Over $200 and up to $1,000: the supplier's name and GST number, the date, a description, and the amounts with GST shown. Over $1,000, add the buyer's name and an identifier such as an address, phone number, email, NZBN or website. A registered buyer can ask for the information and the supplier must provide it within 28 days. [Inland Revenue: how taxable supply information works](https://www.ird.govt.nz/gst/tax-invoices-for-gst/how-tax-invoices-for-gst-work).

The tool checks what it can see: whether the firm record carries a GST number, and whether a person has ticked `buyer_identified` after looking at the invoice. It does not read the PDF.

## Australia

The ATO lists what a tax invoice must show: that it is a tax invoice, the seller's identity and ABN, the date, a description, the GST amount (or a statement that the total includes GST) and the extent each sale is taxable. Sales of $1,000 or more also need the buyer's identity or ABN. Without the supplier's ABN, the payer may have to withhold under the no-ABN withholding rules. [ATO: tax invoices](https://www.ato.gov.au/businesses-and-organisations/gst-excise-and-indirect-taxes/gst/tax-invoices) and GSTR 2013/1.

## Line item checks

These live in the `line_flags` view and read their values from the `settings` table, so each team sets its own guidelines.

| Rule | Flag | Money at stake |
|---|---|---|
| RATE-ABOVE-CARD | A fee line billed above the timekeeper's approved rate on the date of the work | (billed rate minus card rate) times hours |
| TIMEKEEPER-NOT-ON-CARD | A fee line from someone with no active rate on that firm's card | The line amount |
| OUTSIDE-BILLING-PERIOD | Work or expense dated outside the invoice's billing period | The line amount |
| DISALLOWED-EXPENSE | An expense code on the disallowed list. Default E101 copying, E105 telephone, E108 postage, E111 meals | The line amount |
| ARITHMETIC | Hours times rate plus adjustment does not equal the line total | The overcharge, if any |
| BLOCK-BILLING | Several tasks in one entry (two or more semicolons) over one hour | Query only |
| VAGUE-DESCRIPTION | Fewer than four words, or a phrase on the vague list such as "attention to file" | Query only |
| DAILY-HOURS | One timekeeper billing more than ten hours on one day for this firm | Query only |

Expense codes follow the UTBMS code set used in LEDES files. The defaults are a starting point, not a standard: every guideline is your own policy, set in `settings`.

## Record keeping

Keep invoices and the decision trail for as long as your tax records must be kept: generally seven years in New Zealand ([Inland Revenue: keeping business records](https://www.ird.govt.nz/managing-my-tax/keeping-business-records)) and five years in Australia ([ATO: record keeping](https://www.ato.gov.au/businesses-and-organisations/preparing-lodging-and-paying/record-keeping-for-business)). The audit log records each change with its actor. Database owners can alter history, so it is not tamper-proof.

## Operating security

Invoices name matters, people and disputes. Use a protected device, encrypted storage, restricted backups and least-privilege database credentials. Tables have row level security enabled and no public grants. There is no login or permission system in the free version: the CLI is for a trusted operator. Exports, drafts and reports carry the same information and need the same care. Actor names are attribution, not authenticated identities.

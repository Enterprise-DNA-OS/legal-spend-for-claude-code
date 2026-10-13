# Move from Brightflag

Two imports cover the history most teams need: the approved invoices from the AP batch export, and line items from LEDES files. Both rehearse first, run in one transaction, and skip invoices already loaded.

## 1. Export the approved invoices

In Brightflag, an admin creates and downloads an AP batch export. CSV is the common format. Brightflag documents the fields it can include: Vendor Name, Entity Name, Invoice Number, Invoice Date, Invoice Due Date, Currency Code, Invoice Totals, Approved Date, Invoice Status, Department, Matter Number, Matter Name, Matter Category, Matter Status, Matter Lead, Billing Start Date and Billing End Date, among others. Your Customer Success Manager can change the fields, their order and their names. [Configuring your AP batch export file](https://help.brightflag.com/en/articles/753252-configuring-your-ap-batch-export-file), checked 13 October 2026.

Keep the original file. The fixture in `examples/brightflag-ap-batch.csv` is synthetic, built from the documented field names, not a captured customer export.

## 2. Rehearse and load it

```bash
npm run migrate
npm run spend -- import brightflag --file=export.csv --actor=Hana --dry-run
npm run spend -- import brightflag --file=export.csv --actor=Hana
```

- Firms are matched by name and created if new. Matters are matched by matter number and created if new, with the department, category, lead and status.
- A row with an Approved Date loads as an approved invoice, approved amount equal to the invoice total, with a note saying it was approved in Brightflag. A row without one loads as received.
- Dates in `YYYY-MM-DD` load as they are. `DD/MM/YYYY` needs `--day-first`, so a date is never guessed.
- Renamed headers: copy `examples/mapping.json`, point each field at your heading, and add `--mapping=mapping.json`.
- Every original column is kept on the invoice as source data.

## 3. Bring the line items with LEDES

Brightflag lets you download an invoice's LEDES file when the firm submitted one ([How to download invoice files](https://help.brightflag.com/en/articles/753125-how-to-download-invoice-files)). Most panel firms can also produce LEDES 1998B from their own billing system, the published pipe-delimited format from [ledes.org](https://ledes.org/ledes-98b-format/).

```bash
npm run spend -- import ledes --file=KLL-4600.txt --actor=Hana --dry-run
npm run spend -- import ledes --file=KLL-4600.txt --actor=Hana
```

- The firm is found by matching `LAW_FIRM_ID` to the tax ID on the firm record, digits only. If it does not match, pass `--firm=<name>`.
- `CLIENT_MATTER_ID` is matched to your matter number. An unmatched invoice loads without a matter and shows in /attention.
- `F` lines are fees, `E` expenses, `IF` and `IE` invoice adjustments. "Ngata, Aroha" becomes "Aroha Ngata" so it meets the rate card.
- If the same invoice is already here (the same firm and invoice number) with different details, the import stops. Compare, then add `--update-existing`. A decided invoice is never replaced.

## 4. Reconcile

Compare the export's row count with added plus unchanged plus updated. Run `npm run spend -- invoices` and `npm run spend -- spend-by-unit` and check the totals against a Brightflag report for the same period. Add each panel firm's rate card and tax ID, and set your guideline values in `settings`, before reviewing new invoices.

## What does not come across

Invoice PDFs and attachments, Brightflag's review comments and approval chains, budgets, accrual history, benchmarking data and the automatic work classifications stay in Brightflag. The AP export holds invoice headers, not line items: line detail comes from LEDES files. Download what you need to keep before your subscription ends. Mapping other exports, entering budgets and accrual history, and building a portal for firms to submit invoices are custom work Enterprise DNA scopes with you.

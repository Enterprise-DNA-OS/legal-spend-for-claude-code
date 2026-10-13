---
description: Bring invoices across from a Brightflag AP batch export or a LEDES 1998B file.
---

Read CLAUDE.md. Run npm run spend -- import brightflag --file=<export.csv> --actor=<name> --dry-run. Use --json when you need to work further with the rows. Never invent a figure that is not in the records.

Confirm the record and values with the operator first. Every write needs --actor. Before update, decide or a second accrue on the same month, read show and pass --expected-version. If a name matches more than one record, list them and ask which one. Always rehearse with --dry-run first and compare counts. For LEDES use import ledes --file=<file.txt>. The firm is found by its tax ID or named with --firm. Dates written DD/MM/YYYY need --day-first. Never add --update-existing until the changed invoices have been compared. See docs/replace-brightflag.md.

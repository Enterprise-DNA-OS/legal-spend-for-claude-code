---
description: Record an invoice decision: approved, adjusted or rejected.
---

Read CLAUDE.md. Run npm run spend -- decide <invoice> --decision=approved|adjusted|rejected --expected-version=N --actor=<name> [--reason="..."]. Use --json when you need to work further with the rows. Never invent a figure that is not in the records.

Confirm the record and values with the operator first. Every write needs --actor. Before update, decide or a second accrue on the same month, read show and pass --expected-version. If a name matches more than one record, list them and ask which one. A decision needs a matter. Reductions mean adjusted. Flags with money at stake and no reduction need a --reason saying why they were accepted. A rejection always needs a reason. Only the reviewing lawyer decides.

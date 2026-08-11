# JinTai FactoryOps Agent Instructions

## System boundary

- FactoryOps is a standalone manufacturing-operations system.
- PDM is an external read-only master-data source.
- Never add PDM write credentials, Git Data writes, ref updates, or mutation APIs.
- Production, purchasing, inventory, receipts, and shipments belong only to the FactoryOps database.
- A released production order owns an immutable BOM snapshot tied to the source PDM commit and revision.

## Data integrity

- Inventory is derived from posted ledger transactions; never edit balances directly.
- Posted documents are immutable. Correct them with a reversal transaction.
- Use exact document state transitions and optimistic version checks.
- Preserve source-document links from purchase requirements through receipts and from production through shipments.
- Keep audit events append-only.

## User interface

- User-facing production UI is zh-CN.
- Code, comments, identifiers, and technical logs are English.
- Reuse the JinTai PDM visual language without coupling the two runtimes.

## Verification

- Add or update tests for behavior changes.
- Run `npm test`, `npm run lint`, and `npm run db:generate` when the schema changes.
- Do not commit secrets, database snapshots, local runtime state, or generated deployment output.

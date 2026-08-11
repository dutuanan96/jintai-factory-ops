# JinTai FactoryOps Architecture

FactoryOps is a standalone manufacturing-operations application. It manages production planning, MRP, purchasing, raw-material inventory, production execution, finished-goods inventory, and shipping.

## Boundaries

```text
PDM published shards (read-only)
  -> commit-pinned validation
  -> staged FactoryOps master-data snapshot
  -> active PDM commit pointer
  -> production-order BOM snapshot

FactoryOps documents
  -> FactoryOps D1 database only
  -> append-only audit and inventory ledgers
```

The PDM connector has a hard-coded repository and issues GET requests only. It does not accept a user-provided repository URL and has no PDM write path.

## Transaction rules

- A production order is created against the active PDM snapshot.
- Releasing it copies the exact BOM lines into immutable order-owned rows.
- MRP uses the order snapshot, not the current PDM BOM.
- Purchase requirements retain links to the source order and BOM line.
- Stock is the sum of posted inventory transaction deltas.
- Corrections use reversal transactions.
- Every state transition uses optimistic version control and emits an audit event.

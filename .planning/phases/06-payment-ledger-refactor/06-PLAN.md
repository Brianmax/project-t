# Phase 06 — Payment Ledger Refactor (single payment kind, tenant credit balance)

> Goal: Replace the typed/linked Payment model with a single-kind Payment that
> flows through a tenant-credit ledger ("balance"). Balance is consumed
> automatically by unpaid receipts in FIFO order (oldest month first); excess
> persists as credit and applies to future receipts. The change subsumes the
> BUG-001 fix and the open recommendations from the payment-system map.

This is a plan only. No source files are modified by this document.

---

## Decisions captured up front

| # | Decision | Source |
|---|---|---|
| 1 | Single `Payment` kind. `PaymentType` enum (`rent / water / light / advance / guarantee / refund`) is removed entirely. | User S1–S3 |
| 2 | Refunds are plain payments with a negative `amount`. No special enum value, no separate flow. | User |
| 3 | `Contract.advancePayment` and `Contract.guaranteeDeposit` remain unchanged. They are deposits on the contract, **not** credit-ledger entries. | User |
| 4 | `Payment.receiptId` becomes a **UX hint only** ("operator said this payment was made on the day of receipt X"). It does NOT participate in any totals calculation. Kept in the schema for audit and for the existing per-receipt payments list. | New (a) |
| 5 | Balance is **derived on read**, not stored. Formula: `SUM(Payment.amount where contract_id = X) − SUM(ReceiptEntity.totalDue where contract_id = X and receipt is issued)`. No new column. | New (a) |
| 6 | Auto-apply runs **eagerly inside the same DB transaction** on every Payment create/update/delete AND on every Receipt issue/regenerate. Single function: `ContractLedgerService.recalculate(contractId, manager)`. | New (b) |
| 7 | Application order is **FIFO by `(year ASC, month ASC)`**, ties broken by `ReceiptEntity.createdAt ASC`. | New (c) |
| 8 | Receipt status stays **binary** (`paid` / `unpaid`). No "partial" state. A receipt is `paid` iff cumulative FIFO-applied credit ≥ `totalDue`. | New (d) |
| 9 | Deleting a payment runs `recalculate()`, which **may flip a paid receipt back to unpaid** and clear its `paidAt` / `paidBy`. Deterministic. | New (e) |
| 10 | One-shot migration script (`apps/api/src/seed/migrate-to-ledger.ts`) recomputes everything; rollback path is a SQL dump of the dropped `payment.type` column. | New (f) |

---

## Linear tickets and execution order

Parent epic: **[TEN-18](https://linear.app/tenant-aqp/issue/TEN-18)** — Phase 06 — Payment ledger refactor.

Tickets must be executed **strictly in numerical order**. Each one assumes the
previous has shipped (merged + deployed to the dev DB). Skipping forward will
leave the system in a half-built state where receipt totals and the ledger
disagree.

| Order | Ticket | Scope | Blocked by | Touches |
|---|---|---|---|---|
| 1 | **[TEN-19](https://linear.app/tenant-aqp/issue/TEN-19)** — 06.1 Schema: drop `PaymentType` | Remove the enum from entity, DTOs, services, and every client surface. One kind of payment. | — | `payment.entity.ts`, `*.dto.ts`, `payment.service.ts`, `Payments.tsx`, `PropertyDetail.tsx`, `TenantDashboard.tsx` |
| 2 | **[TEN-20](https://linear.app/tenant-aqp/issue/TEN-20)** — 06.2 `ContractLedgerService.computeLedger` + `GET /contracts/:id/ledger` | Read-only ledger snapshot. No writes back to receipts yet. | TEN-19 | new `contract-ledger.service.ts`, `contract.controller.ts` |
| 3 | **[TEN-21](https://linear.app/tenant-aqp/issue/TEN-21)** — 06.3 Receipt projector (`recalculate`) | Same service gains `recalculate()` that writes `status / paidAt / totalPayments / balance` from the FIFO walk. Old roll-up paths deleted. | TEN-20 | `contract-ledger.service.ts`, `receipt.service.ts`, `payment.service.ts` (delete `recomputeReceipt`) |
| 4 | **[TEN-22](https://linear.app/tenant-aqp/issue/TEN-22)** — 06.4 Wire `recalculate` into every write; remove "Marcar como pagado" | Hook `recalculate()` into `PaymentService.{create,update,remove}` and `ReceiptService.issueReceipt`. Delete the manual status-flip route and button. | TEN-21 | `payment.service.ts`, `receipt.service.ts`, `contract.controller.ts`, `DepartmentBilling.tsx`, `OPERATOR_GUIDE.md` |
| 5 | **[TEN-23](https://linear.app/tenant-aqp/issue/TEN-23)** — 06.5 Migration script + deletion semantics + rollback | One-shot script that backs up `payment.type`, drops the column, and calls `recalculate()` for every contract. New deletion tests. Rollback runbook. | TEN-22 | new `seed/migrate-to-ledger.ts`, `payment.service.spec.ts`, `apps/api/package.json`, `CLAUDE.md` |

### Why this order

- **TEN-19 first** so every downstream change targets the simplified shape; no
  ticket carries dead branches for an enum that's about to disappear.
- **TEN-20 before TEN-21** so the read path is tested in isolation. Until
  TEN-21 lands the receipt-table columns can lag, but the API and UI can
  already read truthful totals from `/contracts/:id/ledger`.
- **TEN-21 before TEN-22** because TEN-22 deletes the legacy code paths
  (`PaymentService.recomputeReceipt`, `updateReceiptStatus`). If TEN-22 ships
  without TEN-21, the receipt columns become unmaintained.
- **TEN-23 last** because the migration script depends on `recalculate()`
  existing, and the deletion-semantics tests assert behavior the wiring in
  TEN-22 establishes.

### Shippable checkpoints

- After TEN-19: production runs fine with no `type` field. Standalone payments
  still work via the existing `recomputeReceipt`. No new ledger surface yet.
- After TEN-20: operators get a `/contracts/:id/ledger` endpoint to consult.
  Stored receipt columns are still maintained by the legacy path.
- After TEN-21: legacy roll-up is gone, projector is the only writer. **Do not
  pause here in prod** — the manual "Marcar como pagado" still exists but now
  fights the projector. Ship TEN-22 in the same release.
- After TEN-22: feature-complete. Migration in TEN-23 is the cleanup pass.
- After TEN-23: `payment.type` column is gone from disk; rollback procedure is
  documented.

---

## 1. Mental model (read this before the rest)

The system today asks two questions in awkwardly coupled ways:
- "How much has this tenant paid?"
- "Is this specific receipt paid?"

After this phase, those collapse into **one** primitive: a ledger.

```
For a given contract:
  totalPaid    = SUM(payment.amount)                          (refunds are negative)
  totalBilled  = SUM(receipt.totalDue) for issued receipts
  balance      = totalPaid − totalBilled
                 (positive → tenant credit, negative → tenant owes)

Per-receipt paid?
  Walk issued receipts oldest-first.
  Consume `totalPaid` against each receipt's `totalDue`.
  When cumulative consumed ≥ receipt.totalDue, that receipt is `paid`.
  Stop walking when consumed runs out.
```

The three user scenarios in the new vocabulary:

| Scenario | Start `totalBilled` | Action | End `totalPaid` | `balance` | Receipt status |
|---|---|---|---|---|---|
| S1 | 1400 | Pay 1400 | 1400 | 0 | paid |
| S2 | 1400 | Pay 700  | 700  | −700 | unpaid (700 of 1400 covered) |
| S3a | 1400 | Pay 1500 | 1500 | +100 | paid |
| S3b | 1400 + 1400 = 2800 | Pay 1300 more | 2800 | 0 | both paid (the +100 credit absorbed the 100 shortfall) |

That is the entire model. Everything below is plumbing.

---

## 2. Schema changes — [TEN-19](https://linear.app/tenant-aqp/issue/TEN-19) (column drop) and [TEN-23](https://linear.app/tenant-aqp/issue/TEN-23) (migration script)

### `apps/api/src/payment/entities/payment.entity.ts`

- **Remove** the `PaymentType` enum and the `@Column type` field.
- **Remove** the `PaymentMethod` enum? **No — keep it.** `cash / yape / plin / bank_transfer / other` is still useful audit metadata.
- Keep `amount`, `date`, `description`, `method`, `reference`, `contractId`,
  `receiptId` (nullable), `recordedBy`, `createdAt`, `updatedAt`.
- `receiptId` keeps its `ON DELETE SET NULL` semantics. It is now purely audit.

### `apps/api/src/receipt/entities/receipt.entity.ts`

Two options were considered. **Chosen: keep the columns, populate them via the
projector.** Reasons: the PDF renderer reads `paidAt`, the unpaid-receipts
endpoint filters on `status`, and removing them forces a wide blast radius into
phase 04 (PDF) code. The projector keeps the columns truthful.

- `totalPayments`, `balance`, `status`, `paidAt`, `paidBy` remain on the table.
- They are **write-only via `ContractLedgerService.recalculate()`**. No other
  code path may touch them.
- Add a tiny invariant comment on the entity explaining this.

### `apps/api/src/seed/migrate-to-ledger.ts`

New script, runnable via `npm run --prefix apps/api migrate:ledger`. Steps:

1. `BEGIN;`
2. Dump existing `payment.type` values to `apps/api/migrations/backups/payment-type-<timestamp>.sql` for rollback.
3. `ALTER TABLE payment DROP COLUMN type;`
4. For each `contract.id`, call `ContractLedgerService.recalculate(id, manager)`.
5. `COMMIT;`

Idempotent: re-running after a successful run is a no-op (column already
dropped → catch and skip; recalculate is naturally idempotent).

---

## 3. New service: `ContractLedgerService` — [TEN-20](https://linear.app/tenant-aqp/issue/TEN-20) (`computeLedger`) and [TEN-21](https://linear.app/tenant-aqp/issue/TEN-21) (`recalculate`)

`apps/api/src/contract/contract-ledger.service.ts` (new file).

```ts
@Injectable()
export class ContractLedgerService {
  async computeLedger(contractId: string): Promise<LedgerSnapshot>;
  async recalculate(contractId: string, manager: EntityManager): Promise<void>;
}

interface LedgerSnapshot {
  contractId: string;
  totalPaid: number;
  totalBilled: number;
  balance: number;                          // totalPaid − totalBilled
  receipts: Array<{
    id: string;
    month: number;
    year: number;
    totalDue: number;
    appliedCredit: number;                  // how much of totalPaid was consumed by this receipt
    remaining: number;                      // totalDue − appliedCredit (0 if paid)
    status: 'paid' | 'unpaid';
    paidAt: Date | null;
  }>;
  creditRemaining: number;                  // balance not yet consumed by any receipt (positive surplus)
}
```

### `recalculate(contractId, manager)` algorithm

```
1. Lock all receipts for this contract for write (pessimistic lock, ordered).
2. Load payments for this contract; running = SUM(amount).
3. Load issued receipts ORDER BY year ASC, month ASC, createdAt ASC.
4. For each receipt:
     applied = MIN(running, receipt.totalDue)
     running -= applied
     if applied >= receipt.totalDue:
        status = PAID
        if previously UNPAID → paidAt = NOW(), paidBy = actorUserId
     else:
        status = UNPAID
        paidAt = NULL, paidBy = NULL
     totalPayments = applied            (the slice of credit consumed by this receipt)
     balance       = applied − totalDue (negative or zero; convenient for legacy callers)
     SAVE
5. creditRemaining = running (≥ 0)      (surplus credit not yet consumed)
```

### Who calls `recalculate`

| Caller | When |
|---|---|
| `PaymentService.create` | After insert, inside the existing transaction. |
| `PaymentService.update` | After save, inside the existing transaction. If `contractId` changed, recalculate BOTH old and new contracts. |
| `PaymentService.remove` | After delete, inside the existing transaction. |
| `ReceiptService.issueReceipt` | After save, inside the existing transaction. |
| `migrate-to-ledger.ts` | Once per contract, after the column drop. |

### Removed code

| File | What goes |
|---|---|
| `PaymentService.STANDALONE_PAYMENT_TYPES`, `assertTypeAndAmount` | Replaced by a single `amount !== 0` check. |
| `PaymentService.recomputeReceipt` | Subsumed by `ContractLedgerService.recalculate`. |
| `ReceiptService.calculateReceipt` payments-rollup branch (lines 379–474 after BUG-001 fix) | The receipt no longer computes its own `totalPayments`/`balance`. Snapshot is just rent + utilities + extra charges. The ledger fills the totals after. |
| `ReceiptService.findUnpaidReceipts` filter logic | Stays the same — reads from the projector-maintained `status` column. |

---

## 4. API surface — [TEN-20](https://linear.app/tenant-aqp/issue/TEN-20) (new `/ledger`) and [TEN-22](https://linear.app/tenant-aqp/issue/TEN-22) (route removal)

### New endpoints

| Route | Returns |
|---|---|
| `GET /contracts/:id/ledger` | `LedgerSnapshot` for the contract. |

### Unchanged endpoints

| Route | Note |
|---|---|
| `POST /payments`, `PATCH /payments/:id`, `DELETE /payments/:id` | Behavior unchanged externally; DTOs drop `type`. |
| `GET /payments`, `GET /payments?contractId&receiptId` | Same response shape minus the `type` field. |
| `GET /receipts/:receiptId/payments` | Unchanged (`payment.receiptId` still indexes this list). |
| `GET /contracts/:id/receipts?month&year` (preview) | Returns `totalPayments` and `balance` computed from the ledger snapshot, not from the receipt row. |
| `POST /contracts/:id/receipts` (issue) | Persists receipt with `totalDue` only; `recalculate()` populates totals/status. |
| `GET /contracts/receipts/unpaid` | Reads `status = UNPAID` from the projector. |

### Removed surface

| Route | Why |
|---|---|
| `PATCH /contracts/:id/receipts/status` ("Marcar como pagado" manual flip) | Status is now derived from payments. There is no manual "mark as paid" — record a payment instead. |

This is a behavior change for operators: paying = recording a payment of the
right amount. The button "Marcar como pagado" disappears from the UI.

---

## 5. Frontend changes — [TEN-19](https://linear.app/tenant-aqp/issue/TEN-19) (drop type UI) and [TEN-22](https://linear.app/tenant-aqp/issue/TEN-22) (modal pre-fill, remove "Marcar como pagado")

### `apps/client/src/pages/Payments.tsx`

- Remove `PaymentType`, `STANDALONE_TYPES`, `typeLabels`, `typeColors`.
- Drop the Tipo column from the table and the Tipo selector from the modal.
- Receipt selector keeps working as-is (still useful as a UX hint).
- The amount pre-fill on receipt selection now reads from the **ledger snapshot**
  endpoint, not from `receipt.balance`. Pre-fill = the `remaining` field for
  the selected receipt in the ledger.

### `apps/client/src/pages/DepartmentBilling.tsx`

- Remove the "Marcar como pagado" button and its handler.
- "Pagado el X por Y" provenance line still works (reads `receipt.paidAt` / `receipt.paidBy` which the projector fills).
- The receipt modal gains a small "Saldo del contrato" line summarizing `LedgerSnapshot.balance` (positive = credito, negative = deuda).
- Payment modal pre-fill: same change as `Payments.tsx`.

### `apps/client/src/pages/TenantDashboard.tsx`

- The current `p.type` branching for icons (`rent / water / light`) goes away.
  Replace with a single "Pago" label. Refunds (negative amount) render with a
  reversed icon and red tint.

### `apps/client/src/pages/PropertyDetail.tsx`

- The payments table on the property detail page reads `p.type`; collapse to
  "Pago" / "Reembolso" based on amount sign.

### Client typecheck

After all of the above, `npx tsc --noEmit` must pass with zero errors.

---

## 6. Test plan — coverage spans [TEN-20](https://linear.app/tenant-aqp/issue/TEN-20), [TEN-21](https://linear.app/tenant-aqp/issue/TEN-21), [TEN-23](https://linear.app/tenant-aqp/issue/TEN-23)

### Unit / service tests

`apps/api/src/contract/contract-ledger.service.spec.ts` (new):

- **S1**: contract with one receipt `totalDue=1400`, one payment `amount=1400` → `balance=0`, receipt paid.
- **S2**: contract with one receipt `totalDue=1400`, one payment `amount=700` → `balance=-700`, receipt unpaid, `appliedCredit=700`, `remaining=700`.
- **S3a**: contract with one receipt `totalDue=1400`, one payment `amount=1500` → `balance=100`, receipt paid, `creditRemaining=100`.
- **S3b**: extend S3a with a second receipt `totalDue=1400` and a payment `amount=1300` → both receipts paid, `creditRemaining=0`.
- **FIFO**: two unpaid receipts months 3 and 4, single payment covers exactly month 3 → month 3 paid, month 4 unpaid.
- **Deletion**: S1 setup, then delete the payment → receipt flips back to unpaid, `paidAt` cleared.
- **Refund mid-stream**: S3a setup, then add a payment of −200 → balance drops to −100, receipt flips back to unpaid.
- **Out-of-order receipts**: receipts issued in non-monotonic order (e.g., month 4 issued before month 3 because operator backfilled) → FIFO still applies credit to month 3 first.

### Existing test impact

- `apps/api/src/payment/payment.service.spec.ts` — drop type-required and standalone-type tests, keep validation and recompute-on-create/update/delete. Adjust to call ledger service.
- `apps/api/src/receipt/receipt.service.spec.ts` — keep BUG-001 regression (still valid; ledger never absorbs unlinked payments because it computes by contract-wide sum). Adjust the "issueReceipt absorbs no payments" test to assert via ledger projector.

### Migration script test

`apps/api/src/seed/migrate-to-ledger.spec.ts` (new):

- Seed a contract with mixed-type payments using the OLD schema (insert raw SQL or use a fixture from the pre-migration commit).
- Run the migration.
- Assert the `payment.type` column is gone, the ledger snapshot matches the
  expected per-contract balance, and re-running the migration is a no-op.

---

## 7. Migration runbook — [TEN-23](https://linear.app/tenant-aqp/issue/TEN-23)

```bash
# 1. Backup
docker compose exec postgres pg_dump -U user -d property_management > backup-pre-ledger-$(date +%s).sql

# 2. Stop the API
docker compose stop api 2>/dev/null || pkill -f "nest start" || true

# 3. Pull the new branch, install deps, build
git pull
npm install
npm run build

# 4. Run the migration
npm run --prefix apps/api migrate:ledger

# 5. Start the API; sanity-check GET /contracts/:id/ledger for one contract
docker compose up -d
curl -s http://localhost:3001/contracts/$KNOWN_CONTRACT/ledger | jq .

# 6. Spot-check the UI for one contract that previously had standalone advance payments
```

Run in dev first. Confirm `LedgerSnapshot` matches manual SQL math for at least
two contracts before promoting to any shared environment.

---

## 8. Rollback — [TEN-23](https://linear.app/tenant-aqp/issue/TEN-23)

Layered, cheapest-first:

1. **Revert the deploy / git revert the merge commit.** The migration script
   dropped `payment.type`. To restore it:
   ```sql
   ALTER TABLE payment ADD COLUMN type varchar(32);
   \i apps/api/migrations/backups/payment-type-<timestamp>.sql
   ```
   The backup file is a list of `UPDATE payment SET type = '<old>' WHERE id = '<id>';` rows.
2. **Receipt projector columns**: no rollback needed; they were kept and remain
   correct under the OLD model because the OLD `recomputeReceipt` logic is
   identical (both sum payments by `receipt_id`).
3. **Frontend changes**: small, isolated to the payment forms and the
   department-billing modal. Reverting the frontend commit alone is safe.

Sequencing during rollback: revert frontend → revert backend → restore `type`
column. Out-of-order is OK because the API still accepts `type` in the DTO
during the brief overlap (we keep the field in the create DTO until the
backend revert lands? — **no**, the simpler answer: rollback together).

---

## 9. Risks

| Risk | Mitigation |
|---|---|
| FIFO order surprises operator who expected "apply to receipt I clicked on" | Document in OPERATOR_GUIDE.md §G (new subsection "Pagos y el saldo del inquilino"). Show the ledger snapshot in the payment modal so the operator sees where the money landed. |
| `recalculate()` becomes slow on contracts with many receipts | Acceptable today (single tenant, max ~24 receipts per contract). Index `(contract_id, year, month)` on `receipt_entity` to keep it sub-millisecond. |
| Migration script fails mid-way leaving partial state | Wrap the whole script in a single transaction. On failure, `ROLLBACK;` returns the DB to pre-migration state. Backup SQL dump is the second line of defense. |
| PDF renderer references `totalPayments`/`balance` and breaks if those columns drift after the projector runs | Add a contract test (`receipt-pdf.renderer.spec.ts`) asserting the renderer reads `paidAt` and not raw `payment.type`. Already partially covered. |
| Manual "Marcar como pagado" removal confuses operators mid-month | OPERATOR_GUIDE update + a small in-modal banner on first run: "El estado del recibo ahora se calcula automáticamente desde los pagos. Para marcar pagado, registra el pago." |

---

## 10. Out of scope (deferred)

- **Per-receipt manual application override.** If the operator wants to force a
  payment against a specific receipt even when FIFO would route it elsewhere,
  that's a new feature. Tracked separately; not in this phase.
- **Late fees / mora.** Still on hold (TEN-6).
- **Multi-currency.** All amounts remain in S/.
- **Refund as a first-class operation** (linking a refund to the payment it
  reverses). Today a refund is a negative-amount payment; if you delete the
  original, you must also delete the refund. Tracked as tech debt.

---

## 11. Open questions

All resolved in the decisions table above. If new questions surface during
implementation, log them as Linear comments on the parent issue.

---

## 12. Related work

- BUG-001 (`.planning/tickets/BUG-001-may-payment-prefill-shows-stale-balance.md`)
  is subsumed by this phase. The minimal fix landed first to unblock; this phase
  removes the class of bug entirely.
- Phase 05 (Receipt Status Refactor) introduced the binary `paid/unpaid` model
  that this phase keeps but makes derived.
- Phase 04 (Receipt PDF) is unaffected at the renderer level; it reads
  `paidAt`/`paidBy` which the projector continues to populate.

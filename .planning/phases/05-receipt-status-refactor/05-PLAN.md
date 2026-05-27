# Phase 05 — Receipt Status Refactor (paid / unpaid)

> Goal: Replace the three-state workflow (`pending_review` / `approved` / `denied`) with a two-state billing model (`unpaid` / `paid`). Generating a receipt persists it immediately; the operator flips it to `paid` manually once they've received payment.

This is a plan only. No source files are modified by this document.

---

## Decisions captured up front

| #   | Decision                                                                                                                                                     | Source    |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- |
| 1   | `paid` is operator-flipped (manual), **not** auto-derived from balance                                                                                       | Confirmed |
| 2   | Generating a receipt persists immediately as `unpaid` — no Confirmar/Aprobar step                                                                            | Confirmed |
| 3   | Existing receipt rows: wipe-and-reseed (dev DB) — no migration script                                                                                        | Confirmed |
| 4   | `paid` is **terminal** in this phase: regenerar disabled, status-flip rejected, items locked                                                                 | Q1        |
| 5   | Revert `paid → unpaid` not allowed in this phase (tech debt — [TEN-5](https://linear.app/tenant-aqp/issue/TEN-5))                                            | Q3        |
| 6   | Late-fee (mora) logic removed entirely (on hold — [TEN-6](https://linear.app/tenant-aqp/issue/TEN-6))                                                        | Q4        |
| 7   | Status flip records `paidAt: timestamptz` and `paidBy: uuid` columns                                                                                         | Q6        |
| 8   | Marking paid while `balance < 0` is silently allowed for now — [TEN-7](https://linear.app/tenant-aqp/issue/TEN-7) (revisit after payment-recording UI lands) | Q2        |

---

## 1. State model migration

### Before

```ts
enum ReceiptStatus {
  PENDING_REVIEW = 'pending_review',
  APPROVED = 'approved',
  DENIED = 'denied',
}
```

Transitions:

- `pending_review` → `approved` (Aprobar)
- `pending_review` → `denied` (Denegar)
- `denied` → `pending_review` (Regenerar)
- `approved` → `pending_review` (Regenerar with `force=true`)

### After

```ts
enum ReceiptStatus {
  UNPAID = 'unpaid',
  PAID = 'paid',
}
```

Transitions:

- `(new)` → `unpaid` (Generar Recibo)
- `unpaid` → `paid` (Marcar como pagado — terminal)
- `unpaid` → `unpaid` (Regenerar — overwrites items, totals; stays unpaid)
- `paid` → ⊥ (no transitions allowed in this phase; revert is tech debt — see [TEN-5](https://linear.app/tenant-aqp/issue/TEN-5))

### Schema impact

Postgres enum type `receipts_status_enum` must change. Under `synchronize: true`, TypeORM should drop and recreate the type cleanly **when the table has no rows**. With existing rows it will fail. Hence the wipe-and-reseed decision.

**Boot-time safeguard:** add a one-liner to the seed service that truncates `receipt_entity` if any row still has the old enum values, so a developer who forgot to wipe can still boot.

---

## 2. Backend changes

### `apps/api/src/receipt/entities/receipt.entity.ts`

- Update `ReceiptStatus` enum members (`UNPAID`, `PAID`).
- Change `@Column` `default` from `PENDING_REVIEW` to `UNPAID`.
- Add `@Column({ name: 'paid_at', type: 'timestamptz', nullable: true }) paidAt: Date | null;`
- Add `@Column({ name: 'paid_by', type: 'uuid', nullable: true }) paidBy: string | null;` (FK to user.id; soft FK or `@ManyToOne` is fine — keep it simple as a uuid column).

### `apps/api/src/receipt/receipt.service.ts`

- `issueReceipt`: stop branching on `force` and on existing status. Always upsert by `(contractId, month, year)`. **Reject with `RECEIPT_LOCKED` (409) if the existing row has `status === PAID`** — paid receipts are immutable in this phase. New rows default `status = UNPAID`. Regeneration of an `unpaid` row keeps it `unpaid`.
- `updateReceiptStatus(receiptId, newStatus, actorUserId)`: signature gains the actor id. Accepts only `unpaid → paid` in this phase. On flip to `paid`, write `paidAt = new Date()` and `paidBy = actorUserId`. **Reject `paid → unpaid` with `RECEIPT_PAID_IMMUTABLE` (409)** until the revert tech-debt ticket is resolved.
- `findPendingReceipts` → rename to `findUnpaidReceipts` (also rename the SQL/where clause to `ReceiptStatus.UNPAID`).
- Remove the entire `force` parameter from `issueReceipt`'s signature, the controller layer, and the frontend call site.

### `apps/api/src/contract/contract.controller.ts`

- `POST /contracts/:id/receipts`: drop `force` query param. Returns 409 `RECEIPT_LOCKED` when targeting a paid period.
- `PATCH /contracts/:id/receipts/status`: body schema changes to `{ status: 'paid' }` (only flip direction allowed). Update `UpdateReceiptStatusDto`. Pulls `actorUserId` from the auth context.
- `GET /contracts/receipts/pending` → rename route to `GET /contracts/receipts/unpaid` (consumer is the Tenants page "Recibos Pendientes de Pago" section).

### `apps/api/src/receipt/receipt.service.spec.ts`

- Existing tests assert on `PENDING_REVIEW` strings. Update fixtures and expectations. Two existing test names (`findPendingReceipts queries PENDING_REVIEW`) should be renamed.
- Add tests: `issueReceipt rejects when existing row is paid`, `updateReceiptStatus rejects paid → unpaid`, `updateReceiptStatus writes paidAt and paidBy on flip`.

### Late-fee detection — REMOVED

Per Q4 (TEN-6), the existing mora generation in `extra-charge.service.ts` is removed entirely. Concretely:

- Delete the mora-generation method and its callers.
- Delete any frontend trigger (Generar mora button or auto-call).
- Delete tests asserting mora behavior.
- The `extra-charge.service.ts` continues to handle manual extra charges (cable, cleaning, damages); only the auto-mora path goes.

Re-implementation waits on stakeholder input documented in TEN-6.

---

## 3. Frontend changes

### `DepartmentBilling.tsx`

**Status pill colors:**

| Old                      | New              |
| ------------------------ | ---------------- |
| `pending_review` (amber) | — removed        |
| `approved` (emerald)     | `paid` (emerald) |
| `denied` (red)           | — removed        |
| —                        | `unpaid` (amber) |

**Modal action buttons:**

| Before                              | After                                                                                               |
| ----------------------------------- | --------------------------------------------------------------------------------------------------- |
| `Aprobar` (when pending)            | — gone                                                                                              |
| `Denegar` (when pending)            | — gone                                                                                              |
| —                                   | `Marcar como pagado` (when unpaid)                                                                  |
| —                                   | _Revert button — NOT in this phase (tech debt, [TEN-5](https://linear.app/tenant-aqp/issue/TEN-5))_ |
| `Enviar por WhatsApp` (placeholder) | unchanged                                                                                           |
| `Descargar PDF` (phase 04)          | always available once row exists                                                                    |

**Paid receipts are read-only:**

- `Regenerar Recibo` button is **hidden or disabled** when `receipt.status === 'paid'`. Hover tooltip: `Recibo pagado — no se puede regenerar`.
- `Marcar como pagado` button is hidden when already paid.
- No revert button. Operator cannot mutate a paid row.
- Below the status pill, render `Pagado el <fecha localizada> por <user name>` so the operator has provenance.

**Generar Recibo flow:**

- Remove the special-case logic that adds `force=true` when re-issuing a `pending_review` receipt.
- Remove the workaround documented in `OPERATOR_GUIDE.md` §G.12 (Denegar → Regenerar dance).
- One click always works for `unpaid` rows; regeneration is idempotent. For `paid` rows the endpoint returns 409 — the button shouldn't be reachable, but the server enforces.

**State variable cleanup:** drop the `pendingReceipts` typing on the Tenants page, replace with `unpaidReceipts`. Same data shape, new key.

### `Tenants.tsx`

- Section title `Recibos Pendientes de Pago` stays (still accurate).
- Fetch endpoint changes to `/contracts/receipts/unpaid`.
- The `PendingReceipt` TS interface's `status` field becomes `'paid' | 'unpaid'`.

### `OPERATOR_GUIDE.md` updates required

Several sections become wrong after this refactor:

| Section                                                                          | Edit                                                                                                                                                                                                                                                             |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B (Vocabulary)                                                                   | Remove "Pendiente de revisión", "Aprobado", "Denegado". Add "No pagado", "Pagado".                                                                                                                                                                               |
| G.7 (Mora generator)                                                             | **Delete the section entirely.** Mora logic is removed in this phase; future reintroduction tracked in TEN-6.                                                                                                                                                    |
| G.10–G.13 (status machine, Aprobar/Denegar, regeneration gotcha, status diagram) | Replace with the new 2-state model. The Mermaid stateDiagram in G.13 collapses to two nodes with one transition (`unpaid → paid`). Add note: "paid is terminal in this phase; revert is tracked in TEN-5."                                                       |
| K.2 (Receipt-completeness gate)                                                  | Update copy: counts any receipt with status `paid` or `unpaid`.                                                                                                                                                                                                  |
| N (FAQ)                                                                          | Drop the "approved receipt won't regenerate — how do I refresh?" Q&A; the answer is now "just click Generar Recibo (only works on unpaid rows)." Add: "Why can't I edit a paid receipt? Paid is terminal in this phase — see TEN-5 for the planned revert flow." |

I will produce these doc edits as part of implementation, not as a separate planning phase.

---

## 4. Removed concepts

The following can be deleted entirely once the refactor lands:

- `force` query parameter on `POST /contracts/:id/receipts` — controller, service, and frontend call sites.
- The "Denegar then Generar" workaround documented in G.12.
- `Aprobar` / `Denegar` button handlers in `DepartmentBilling.tsx`.
- Approval-related toasts (`Recibo aprobado exitosamente`, `Recibo denegado`).
- Status badge variants for `pending_review` and `denied`.
- Auto-mora generation in `extra-charge.service.ts` and any frontend trigger for it. Re-implementation tracked in TEN-6.

---

## 5. PDF phase (04) impact

`04-PLAN.md` has been rewritten to be **status-agnostic** — it does not depend on the 3-state vs 2-state model:

- PDF generation is operator-triggered via a manual button, not auto-generated on any status change.
- The PDF renderer does not draw a status pill or watermark.
- The internal `DELETE …/pdf` endpoint is called from `issueReceipt`'s regenerate branch regardless of which status caused the regeneration.

The only cross-phase coupling is `receipt.service.ts → issueReceipt()`: Phase 04 adds `tenantDocumentId: tenant.documentId` to the snapshot; this phase adds the `RECEIPT_LOCKED` guard for paid rows. Whoever lands second resolves a small textual conflict.

→ No updates to `04-PLAN.md` are required after this phase ships.

---

## 6. Open questions

All resolved. Deferrals are tracked in Linear:

| #   | Resolution                                                                                                                               |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | **Paid is terminal.** Regenerar disabled for `paid` rows; server enforces 409 `RECEIPT_LOCKED`.                                          |
| Q2  | **Silent-allow** (no warning). Revisit once tenant-payment recording UI exists — **[TEN-7](https://linear.app/tenant-aqp/issue/TEN-7)**. |
| Q3  | **No revert in this phase.** Tech debt — **TEN-5**.                                                                                      |
| Q4  | **Mora logic removed entirely.** Stakeholder input required before reintroducing — **TEN-6**.                                            |
| Q5  | Keep "Recibos Pendientes de Pago" title.                                                                                                 |
| Q6  | Add `paidAt: timestamptz` + `paidBy: uuid` columns. `updateReceiptStatus` writes them from the auth context.                             |

---

## Risks & rollback

### Risks

- **Enum migration failure.** Postgres `ALTER TYPE` is constrained; TypeORM's `synchronize: true` typically drops and recreates the enum, which fails if values are referenced by existing rows. **Mitigation:** the wipe-and-reseed safeguard in the seed service truncates `receipt_entity` if any old-enum row is detected at boot.
- **Lost operator review step.** Today the `Aprobar` step is a deliberate "check before sharing externally" gate. Removing it puts more burden on the operator to verify numbers before clicking Generar Recibo. **Mitigation:** keep the "Generar Recibo" → modal preview → close flow. Operator can still inspect before any external action (like Descargar PDF or Enviar). The modal becomes the de-facto review surface.
- **Mora ambiguity.** With operator-driven `paid`, a receipt can be `unpaid` AND `balance >= 0` (payments cover it but operator hasn't flipped). The mora UI currently keys off `balance < 0`; need to verify the existing condition still excludes these cases (it does — `balance < 0` is the financial check, status is independent).
- **Pending-receipts page semantics.** The Tenants page lists `unpaid` receipts (was: pending-review). Operators might miss new "paid but with balance < 0" anomalies. **Mitigation:** out of scope for this phase, but worth a future "balance ≠ status" report.

### Rollback

- Migration is irreversible in dev sense (data wiped), but the **schema rollback** is symmetric: revert the enum change, restore the three-state members, redeploy. Nothing else persisted depends on the new strings.
- Frontend code changes are isolated to receipt-status display, modal actions, and one fetch URL — straightforward to revert if needed.
- PDF phase (04) updates are gated on this phase landing; no work in 04 is invalidated, only re-anchored.

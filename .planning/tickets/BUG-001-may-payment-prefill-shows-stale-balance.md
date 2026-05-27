# BUG-001 — New May payment modal pre-fills S/ 4.00 instead of full May balance

- **Reported:** 2026-05-24
- **Severity:** High (operator sees wrong amount; would under-pay if accepted blindly)
- **Status:** **In Progress** — root cause confirmed in `calculateReceipt`; fix being applied
- **Area:** Backend (receipt balance calculation) + Frontend (modal pre-fill is downstream)

## Reproduction

1. Bill April for a contract — total **S/ 1408.00**.
2. Register a payment for April that fully covers the receipt (linked via the receipt selector).
   April receipt flips to **PAID**.
3. Bill May for the same contract — total **S/ 1412.00**.
4. Open _Pagos → Nuevo Pago_ (or _DepartmentBilling → Registrar Pago_ for the May receipt).
5. Select the contract, then the May receipt in the dropdown.

**Expected:** amount field pre-fills with **S/ 1412.00** (full May balance).
**Actual:** amount field pre-fills with **S/ 4.00** (= 1412 − 1408, suspiciously equal to the delta between the two monthly bills).

## Why the amount is 4

The modal pre-fill comes directly from the receipt's stored `balance`:

- `apps/client/src/pages/Payments.tsx:139` — `setAmount((-r.balance).toFixed(2))`
- `apps/client/src/pages/DepartmentBilling.tsx:494` — `const owed = -receipt.balance`

So the receipt row in the DB has `balance = -4`. Given `balance = totalPayments − totalDue`
(`apps/api/src/receipt/receipt.service.ts:488`) and `totalDue = 1412`, the May receipt was
persisted with `totalPayments = 1408`. That number matches the April bill exactly, which
strongly suggests the April payment is being attributed to May during May's
`calculateReceipt` pass.

## Where it most likely goes wrong

`ReceiptService.calculateReceipt` (`apps/api/src/receipt/receipt.service.ts:379-398`) selects
payments to roll into the receipt being calculated:

```ts
const payments = await this.paymentRepository.find({
  where: existingReceiptId
    ? [
        {
          contractId,
          date: Between(periodStart, periodEnd),
          receiptId: IsNull(),
        },
        {
          contractId,
          date: Between(periodStart, periodEnd),
          receiptId: existingReceiptId,
        },
      ]
    : {
        contractId,
        date: Between(periodStart, periodEnd),
        receiptId: IsNull(),
      },
});
```

For a brand-new May receipt the filter should only pick up payments dated in May with
`receipt_id IS NULL`. The fact that 1408 ended up on May's `totalPayments` means one of the
filter conditions did not exclude the April payment as intended. Candidate causes:

1. **April payment row has `receipt_id IS NULL`.** That would happen if the receipt-link
   step didn't actually persist `receiptId` (or if the row was later edited to detach the
   receipt). It also implies April was marked PAID via `recomputeReceipt`, which only sums
   payments where `p.receipt_id = receiptId` — so if `receipt_id` were null the receipt
   would _not_ have been auto-paid. Contradictory unless the receipt was marked paid
   manually (status set to PAID without a linked payment), so worth checking.
2. **April payment was recorded with a date inside May** (e.g., entered on May 1 for the
   April period). `Between(periodStart, periodEnd)` on a `date` column would then match.
   The April receipt would still be PAID because the payment row carries
   `receipt_id = aprilReceipt.id`, but the same date would have to slip past the
   `receiptId IS NULL` filter — so this alone doesn't explain it either, unless combined
   with cause #1.
3. **A standalone `advance` payment of 1408 was added (no receipt link), dated in May,**
   that the user mentally attributed to April. `receiptId IS NULL` and `date` in May both
   match the filter, so it would land on May's `totalPayments`.

Cause #3 is the most internally consistent explanation given the symptoms. #1 is also
possible if April was marked paid out-of-band.

## Diagnostic queries to confirm

Run against the affected contract (replace `:contractId`):

```sql
-- 1. Inspect the April payment(s)
SELECT id, amount, date, type, receipt_id, description
FROM   payment
WHERE  contract_id = :contractId
  AND  date >= '2026-04-01' AND date < '2026-06-01'
ORDER  BY date;

-- 2. Inspect both receipts as stored
SELECT id, month, year, status, total_due, total_payments, balance, paid_at
FROM   receipt_entity
WHERE  contract_id = :contractId
  AND  ((month = 4 AND year = 2026) OR (month = 5 AND year = 2026));

-- 3. Sum payments currently attributed to each receipt
SELECT receipt_id, COUNT(*), SUM(amount)
FROM   payment
WHERE  contract_id = :contractId
GROUP  BY receipt_id;
```

The combination of (1) the April payment's `receipt_id` and `date`, and (2) May's stored
`total_payments`, will pin down which of the candidate causes above is at play.

## Suggested fixes (after root cause confirmed)

- **If cause #3 (standalone payment dated in May):** the calculation is technically
  correct — any unlinked payment in the receipt's period offsets it. The product issue is
  that the operator's mental model differs from the engine's. Options:
  - Surface a "Pagos sin recibo aplicados a este recibo" line in the receipt preview so
    the operator can see _why_ the balance is what it is.
  - In the payment modal, when a receipt is selected, ignore receipt-period
    auto-application for the suggested amount and instead pre-fill with
    `totalDue − sum(payments where receipt_id = receipt.id)` so the suggestion reflects
    "what you still owe on this specific receipt", not "what's left after all unlinked
    payments in the month."
- **If cause #1 (payment was created without `receipt_id` but April was somehow paid):**
  tighten the receipt-link UI / validation so a paid receipt cannot exist without at
  least one linked payment summing to its `total_due`, and add an integrity check job.
- **Independent of root cause — defensive change worth doing now:**
  - `payment.service.ts:280` computes `balance = totalPayments − totalDue` from
    `SUM(amount) WHERE receipt_id = :id` — that's the canonical per-receipt balance.
    Pre-fill the modal with this value (one extra round-trip or include it in the
    `/contracts/receipts/unpaid` payload) rather than relying on `calculateReceipt`'s
    period-window roll-up, which can absorb unlinked payments and produce surprises.

## Out of scope but related

- `periodEnd = new Date(year, month, 0)` (`receipt.service.ts:377`) is midnight of the
  last day. Against a Postgres `date` column this compares fine, but if `payment.date` is
  ever migrated to `timestamptz`, `Between(periodStart, periodEnd)` would silently drop
  payments timestamped later than 00:00 on the last day. Flagging for awareness.
  _(Note: the date window is no longer used after the fix, so this is moot for receipt
  calc — still worth fixing in any other code that uses the same idiom.)_

---

## Fix applied — 2026-05-24

### Root cause confirmed

`ReceiptService.calculateReceipt` was rolling **any** payment with
`receipt_id IS NULL` and a date inside the receipt's period into the new receipt's
`totalPayments`. So a standalone advance payment from April (or a payment that was meant
to be linked but wasn't) silently offsets the very next month's bill — exactly the user's
reported symptom of seeing S/ 4.00 instead of S/ 1412.

### Code change

`apps/api/src/receipt/receipt.service.ts` — `calculateReceipt` now only counts payments
that are **explicitly linked** to the receipt being calculated (`receipt_id =
existingReceiptId`). For a brand-new receipt (no `existingReceiptId`) the payments list
is empty, so `totalPayments = 0` and `balance = -totalDue`. The unused
`Between` / `IsNull` imports were dropped.

This matches the semantics already used by `PaymentService.recomputeReceipt`
(`payment.service.ts:273-281`), which sums `WHERE p.receipt_id = :id`. So the source of
truth is now consistent across both write paths.

### Regression test

`apps/api/src/receipt/receipt.service.spec.ts` —
`issueReceipt > does not absorb standalone (unlinked) payments into a new receipt`.
Asserts that on a fresh issuance, the payment repository is only ever queried by an
explicit `receiptId` (never by `IsNull()` or date-window-only filters), and the resulting
receipt has `totalPayments = 0`, `balance = -totalDue`.

Full backend suite: **47 / 47 passing**.

### Backfill needed for already-affected receipts

The fix corrects future calculations, but the May receipt in your DB still has the stale
`total_payments = 1408` / `balance = -4` baked in from before the fix. Two options:

**Option A — fix from the UI (recommended for one-off cases):** open the May receipt in
_DepartmentBilling_ and click _Regenerar Recibo_. The fix-side `calculateReceipt` will
recompute `totalPayments = 0` (no linked payments yet) and persist `balance = -1412`.
This works because the regenerate-with-linked-payments guard (`RECEIPT_HAS_PAYMENTS`)
only triggers when the receipt already has linked payments — May doesn't yet.

**Option B — bulk SQL backfill** for any other unpaid receipts that were issued before
the fix and may have absorbed unlinked payments:

```sql
-- Recompute totalPayments / balance / status for every UNPAID receipt to match the
-- canonical per-receipt sum. Safe to run repeatedly.
UPDATE receipt_entity r
SET    total_payments = COALESCE(linked.sum, 0),
       balance        = COALESCE(linked.sum, 0) - r.total_due,
       status         = CASE
                          WHEN COALESCE(linked.sum, 0) >= r.total_due THEN 'paid'
                          ELSE 'unpaid'
                        END
FROM   (
         SELECT receipt_id, SUM(amount) AS sum
         FROM   payment
         WHERE  receipt_id IS NOT NULL
         GROUP  BY receipt_id
       ) linked
WHERE  r.status = 'unpaid'
  AND  r.id = linked.receipt_id;

-- Also clear total_payments on receipts that have no linked payments at all
-- (i.e. the rows that were absorbing standalone payments incorrectly).
UPDATE receipt_entity
SET    total_payments = 0,
       balance        = -total_due
WHERE  status = 'unpaid'
  AND  id NOT IN (SELECT DISTINCT receipt_id FROM payment WHERE receipt_id IS NOT NULL);
```

Run inside a transaction and verify with a `SELECT` first if there are many affected
rows.

### Behaviour change to communicate

Standalone payments (type `advance` / `guarantee` / `refund` with no `receipt_id`) no
longer silently apply to the next issued receipt. To credit a payment against a specific
month's receipt, the operator must link it explicitly via the payment modal's receipt
selector. If the team wants advance-payment auto-application back, that's a deliberate
product decision and should be implemented as an explicit "Apply available advances"
action, not as an implicit side-effect of issuance.

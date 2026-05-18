---
phase: 02-contract-payment-history
verified: 2026-03-12T00:00:00Z
status: human_needed
score: 9/9 must-haves verified
re_verification: false
human_verification:
  - test: 'Navigate to /tenants, click any tenant, and verify the active contract section shows property name, department name, monthly rent, and start/end dates'
    expected: 'All four fields are populated with real data — no blank property name or department name'
    why_human: 'Requires a running app with real database records to confirm the department.property relation resolves correctly end-to-end'
  - test: 'Verify the payments sidebar shows a list of payments for the active contract, each entry displaying amount and date'
    expected: "Each payment row shows 'S/ X.XX' and a formatted date"
    why_human: 'Requires real payment data in the database to confirm the /payments?contractId=X endpoint returns results that render correctly'
  - test: 'Navigate to a tenant who has no payments recorded on their active contract'
    expected: "The payments sidebar shows the EmptyState component with an icon and 'Sin pagos registrados' heading — not a plain italic text"
    why_human: 'Requires a specific test case (tenant with active contract but no payments)'
  - test: 'Open the browser network tab while on /tenants/:id and verify the two targeted requests'
    expected: 'Network tab shows GET /contracts?tenantId=X and GET /payments?contractId=X — not bare /contracts or /payments'
    why_human: 'Runtime network behavior cannot be verified statically'
---

# Phase 2: Contract + Payment History Verification Report

**Phase Goal:** User can see the tenant's active rental contract and every payment they have made
**Verified:** 2026-03-12
**Status:** human_needed — all automated checks pass, runtime confirmation required
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                                | Status   | Evidence                                                                                                                                                                                 |
| --- | ---------------------------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | GET /contracts?tenantId=X returns contracts with department.property.name populated                  | VERIFIED | `contract.service.ts` line 70: `relations: ['tenant', 'department', 'department.property']`; controller line 51-54 passes `tenantId` as first arg to `findAll`                           |
| 2   | GET /contracts?departmentId=X continues to work (backward-compatible)                                | VERIFIED | `contract.service.ts` line 64-71 builds where clause from whichever params are present; controller passes both                                                                           |
| 3   | GET /payments?contractId=X returns only payments for that contract, ordered by date DESC             | VERIFIED | `payment.service.ts` lines 43-48: `findByContract` uses `where: { contractId }, order: { date: 'DESC' }`; controller dispatches to it conditionally                                      |
| 4   | TenantDashboard fetches /contracts?tenantId=X instead of /contracts (full table)                     | VERIFIED | `TenantDashboard.tsx` line 91: ``apiFetch<Contract[]>(`/contracts?tenantId=${tenantId}`)``; old client-side filter `allContracts.filter` removed                                         |
| 5   | TenantDashboard fetches /payments?contractId=X for active contract instead of /payments (full table) | VERIFIED | `TenantDashboard.tsx` line 105: ``apiFetch<Payment[]>(`/payments?contractId=${active.id}`)`` chained after active contract found                                                         |
| 6   | The active contract section shows property name, department name, rent amount, and start/end dates   | VERIFIED | Lines 195-213: renders `activeContract.department?.name`, `activeContract.department?.property?.name`, `activeContract.rentAmount`, `activeContract.startDate`, `activeContract.endDate` |
| 7   | The payments sidebar shows each payment's amount and date                                            | VERIFIED | Lines 342-343: renders `S/ {Number(p.amount).toFixed(2)}` and `{formatDate(p.date)}`                                                                                                     |
| 8   | When no payments exist, the payments section shows the EmptyState component (not a plain p tag)      | VERIFIED | Lines 330-335: `payments.length === 0` renders `<EmptyState icon={CreditCard} title="Sin pagos registrados" .../>`                                                                       |
| 9   | All spec tests GREEN after implementation                                                            | VERIFIED | 7/7 test suites pass (16 tests); contract.service.spec.ts 4 PASS, payment.service.spec.ts 3 PASS, contract.overlap.spec.ts unaffected                                                    |

**Score:** 9/9 truths verified

### Required Artifacts

| Artifact                                         | Expected                                                              | Status   | Details                                                                                                |
| ------------------------------------------------ | --------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------ |
| `apps/api/src/contract/contract.service.spec.ts` | Unit tests covering CONT-01 through CONT-04                           | VERIFIED | 4 tests in `describe('findAll')` — all pass GREEN                                                      |
| `apps/api/src/payment/payment.service.spec.ts`   | Unit tests covering PAY-01 and PAY-02                                 | VERIFIED | 3 tests in `describe('findByContract')` — all pass GREEN                                               |
| `apps/api/src/contract/contract.service.ts`      | `findAll(tenantId?, departmentId?)` with department.property relation | VERIFIED | Signature updated line 64; `'department.property'` present in relations line 70                        |
| `apps/api/src/contract/contract.controller.ts`   | GET /contracts accepts `?tenantId` query param                        | VERIFIED | `@Query('tenantId')` at line 51; passed to service as first arg line 54                                |
| `apps/api/src/payment/payment.service.ts`        | `findByContract(contractId)` method                                   | VERIFIED | Method at lines 43-48; `where: { contractId }`, `order: { date: 'DESC' }`                              |
| `apps/api/src/payment/payment.controller.ts`     | GET /payments accepts `?contractId` query param                       | VERIFIED | `@Query('contractId')` at line 27; dispatches to `findByContract` conditionally lines 28-31            |
| `apps/client/src/pages/TenantDashboard.tsx`      | Targeted API fetches replacing full-table fetches                     | VERIFIED | `contracts?tenantId` at line 91; `payments?contractId` at line 105; no client-side filter loops remain |

### Key Link Verification

| From                       | To                              | Via                                             | Status   | Details                                                                                     |
| -------------------------- | ------------------------------- | ----------------------------------------------- | -------- | ------------------------------------------------------------------------------------------- |
| `contract.service.spec.ts` | `ContractService.findAll`       | Jest mock of contractRepository.find            | VERIFIED | `mockContractRepository.find` mocked and asserted in all 4 tests                            |
| `payment.service.spec.ts`  | `PaymentService.findByContract` | Jest mock of paymentRepository.find             | VERIFIED | `mockPaymentRepository.find` mocked and asserted in all 3 tests                             |
| `contract.controller.ts`   | `ContractService.findAll`       | `@Query('tenantId')` passed as first arg        | VERIFIED | Pattern `findAll(tenantId` present at line 54                                               |
| `payment.controller.ts`    | `PaymentService.findByContract` | `@Query('contractId')` conditional dispatch     | VERIFIED | Pattern `findByContract` present at line 29                                                 |
| `TenantDashboard.tsx`      | GET /contracts?tenantId         | apiFetch in useEffect                           | VERIFIED | Pattern `contracts?tenantId` present at line 91                                             |
| `TenantDashboard.tsx`      | GET /payments?contractId        | apiFetch chained after active contract is found | VERIFIED | Pattern `payments?contractId` present at line 105; chained `.then(setPayments)` at line 109 |

### Requirements Coverage

| Requirement | Source Plan         | Description                                                                      | Status   | Evidence                                                                                                   |
| ----------- | ------------------- | -------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------- |
| CONT-01     | 02-01, 02-02, 02-03 | Tenant detail page displays the tenant's active contract property name           | VERIFIED | `department.property` relation loaded in `contract.service.ts`; rendered at `TenantDashboard.tsx` line 196 |
| CONT-02     | 02-01, 02-02, 02-03 | Tenant detail page displays the department name/number                           | VERIFIED | `activeContract.department?.name` rendered at line 195                                                     |
| CONT-03     | 02-01, 02-02, 02-03 | Tenant detail page displays the monthly rent amount                              | VERIFIED | `activeContract.rentAmount` rendered as `S/ X.XX` at line 211                                              |
| CONT-04     | 02-01, 02-02, 02-03 | Tenant detail page displays contract start date and end date                     | VERIFIED | `activeContract.startDate` and `activeContract.endDate` rendered at line 204                               |
| PAY-01      | 02-01, 02-02, 02-03 | Tenant detail page displays a list of all payments made on the tenant's contract | VERIFIED | Payments fetched via `/payments?contractId=${active.id}` and rendered in sidebar                           |
| PAY-02      | 02-01, 02-02, 02-03 | Each payment entry shows amount and date                                         | VERIFIED | Lines 342-343 render `p.amount` and `p.date` per payment                                                   |

No orphaned requirements — all six IDs (CONT-01 through CONT-04, PAY-01, PAY-02) are mapped to Phase 2 in REQUIREMENTS.md and all three plans claim them.

### Anti-Patterns Found

| File | Line | Pattern    | Severity | Impact |
| ---- | ---- | ---------- | -------- | ------ |
| —    | —    | None found | —        | —      |

No TODO/FIXME/placeholder comments, no stub implementations, no empty handlers, no client-side filter loops remaining in any modified file.

### Human Verification Required

#### 1. Active Contract Section — End-to-End Data Display

**Test:** Start the dev server (`npm run dev` from project root). Navigate to `/tenants`, click any tenant who has an active contract. Look at the "Contrato Actual" card.
**Expected:** Property name (e.g., "Edificio Central"), department name (e.g., "Depto 101"), address, monthly rent formatted as "S/ 1500.00", and start/end dates are all visible and non-blank.
**Why human:** Confirms the `department.property` relation resolves correctly against a live PostgreSQL database. The API code is correct but the database must have property data seeded for the relation to return values.

#### 2. Payments Sidebar — Populated State

**Test:** On the same `/tenants/:id` page for a tenant who has payment records, inspect the right sidebar.
**Expected:** Each payment row shows `S/ X.XX` (amount) and a formatted date. The list is ordered newest first (date DESC).
**Why human:** Confirms the `/payments?contractId=X` query returns real data and the payment rows render correctly.

#### 3. Payments Sidebar — Empty State

**Test:** Navigate to a tenant whose active contract has no payment records.
**Expected:** The payments sidebar shows the EmptyState component with a CreditCard icon, "Sin pagos registrados" heading, and "No hay pagos registrados para este contrato." description — not a plain italic `<p>` tag.
**Why human:** Requires a tenant + contract with zero payments to be present in the test database.

#### 4. Network Tab — Targeted Requests

**Test:** Open browser DevTools Network tab, then navigate to `/tenants/:id`.
**Expected:** Two requests are visible: `GET /contracts?tenantId={uuid}` and `GET /payments?contractId={uuid}`. There must be no bare `GET /contracts` or `GET /payments` (full-table) requests.
**Why human:** Runtime network behavior is not verifiable statically.

### Gaps Summary

No automated gaps found. All code is substantive, properly wired, and all tests pass. All six requirements are satisfied at the implementation level.

Automated checks passing:

- All 7 backend test suites pass (16 tests, 0 failures)
- TypeScript compiles clean for both `apps/api` and `apps/client` with no errors
- No client-side filter anti-patterns remaining in TenantDashboard.tsx
- EmptyState component used (not inline `<p>` tag) for empty payments
- Both targeted API calls present in useEffect

Pending human confirmation:

- Visual display of contract fields with real database data (CONT-01 through CONT-04)
- Payment list display with real data (PAY-01, PAY-02)
- EmptyState display with a tenant who has no payments

---

_Verified: 2026-03-12_
_Verifier: Claude (gsd-verifier)_

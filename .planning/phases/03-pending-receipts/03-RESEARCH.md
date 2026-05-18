# Phase 3: Pending Receipts - Research

**Researched:** 2026-03-12
**Domain:** NestJS receipt service bug fix + React view-only section with empty state
**Confidence:** HIGH

---

<phase_requirements>

## Phase Requirements

| ID      | Description                                                                         | Research Support                                                                                                                                                                         |
| ------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RCPT-01 | Tenant detail page displays a section listing receipts with `pending_review` status | Backend `findPendingReceipts()` has a bug — queries `APPROVED` not `PENDING_REVIEW`; fix is a one-line where-clause change. Frontend fetch + filter is already wired in TenantDashboard. |
| RCPT-02 | Each pending receipt entry shows the billing period (month/year) and total amount   | `Receipt` interface already exposes `period` (string like "March 2026") and `totalDue` (number). TenantDashboard already renders both fields.                                            |
| RCPT-03 | If no pending receipts exist, the section shows an empty state message              | Current UI only renders the section when `pendingReceipts.length > 0` — no empty state is shown when zero. An unconditional section with `EmptyState` when array is empty must be added. |

</phase_requirements>

---

## Summary

Phase 3 is almost entirely pre-built from prior work. The `TenantDashboard.tsx` already contains the `PendingReceipt` interface, the `pendingReceipts` state, the fetch call to `GET /contracts/receipts/pending`, client-side filtering by contract IDs, and a rich card-based display section. There is no new page, no new route, and no new backend endpoint to create.

Two targeted defects must be fixed. First, `ReceiptService.findPendingReceipts()` queries `status: ReceiptStatus.APPROVED` instead of `status: ReceiptStatus.PENDING_REVIEW`, meaning it never returns `pending_review` receipts (RCPT-01 is broken end-to-end). Second, the TenantDashboard section wraps its render in `{pendingReceipts.length > 0 && ...}`, so when the array is empty the section simply vanishes with no message to the user (RCPT-03 is unmet).

**Primary recommendation:** Fix the one-line status bug in `ReceiptService.findPendingReceipts()`, add a `ReceiptService` unit test spec covering that fix, and change the conditional render in TenantDashboard to always show the section with `EmptyState` when empty.

---

## Standard Stack

### Core

| Library                  | Version                                     | Purpose                          | Why Standard                          |
| ------------------------ | ------------------------------------------- | -------------------------------- | ------------------------------------- |
| NestJS / TypeORM         | already installed                           | Backend query with status filter | Project standard                      |
| React + apiFetch         | already installed                           | Frontend fetch via `apiFetch<T>` | Project standard                      |
| EmptyState component     | `apps/client/src/components/EmptyState.tsx` | Standardised no-data placeholder | Used by payments section in same page |
| Jest / `@nestjs/testing` | already installed                           | Unit tests for service layer     | Used in all Phase 2 specs             |

### No new dependencies required.

---

## Architecture Patterns

### Existing Pattern: Global Pending Receipts Endpoint + Client-Side Filter

The current approach (already wired in TenantDashboard):

```
GET /contracts/receipts/pending   →  returns all pending receipts across all contracts
Client filters by:  contractIds that belong to this tenant
```

This route is registered BEFORE the `GET /contracts/:id` wildcard in the controller — this ordering is deliberate (NestJS matches top-to-bottom) and must not be changed.

### Pattern: NestJS Where Clause by Enum Value

```typescript
// Source: apps/api/src/receipt/receipt.service.ts (corrected)
const receipts = await this.receiptRepository.find({
  where: {
    status: ReceiptStatus.PENDING_REVIEW, // was APPROVED — this is the bug
  },
  order: {
    year: 'DESC',
    month: 'DESC',
  },
});
```

The `balance < 0` filter can be dropped: `pending_review` receipts represent billing not yet resolved; filtering by negative balance is the semantics of a different concern (unpaid approved receipts). The phase requirement is simply `pending_review` status.

### Pattern: Always-Visible Section with EmptyState

All sections in TenantDashboard that can have zero items use `EmptyState`. Payments already does this (lines 330-337 in TenantDashboard.tsx). The Pending Receipts section must follow the same pattern:

```typescript
// Current (broken for RCPT-03):
{pendingReceipts.length > 0 && (
  <section>...</section>
)}

// Correct pattern (matches payments section):
<section>
  <h2 ...>Recibos Pendientes</h2>
  {pendingReceipts.length === 0 ? (
    <EmptyState
      icon={AlertCircle}
      title="Sin recibos pendientes"
      description="No hay recibos pendientes de revisión para este inquilino."
    />
  ) : (
    <div className="space-y-3">
      {pendingReceipts.map(...)}
    </div>
  )}
</section>
```

### Pattern: TDD Spec for ReceiptService

Phase 2 established the spec file pattern for new service methods. A `receipt.service.spec.ts` does not yet exist — it must be created. It follows the exact same three-mock / TestingModule / `jest.clearAllMocks()` structure as `contract.service.spec.ts` and `payment.service.spec.ts`.

The `ReceiptService` constructor has 5 injected dependencies:

- `Repository<Contract>` (via `getRepositoryToken(Contract)`)
- `Repository<Payment>` (via `getRepositoryToken(Payment)`)
- `Repository<ExtraCharge>` (via `getRepositoryToken(ExtraCharge)`)
- `Repository<ReceiptEntity>` (via `getRepositoryToken(ReceiptEntity)`)
- `ConsumptionService` (injectable service)

The test for `findPendingReceipts` only needs `mockReceiptRepository.find` — the other four can be stub objects.

### Anti-Patterns to Avoid

- **Removing the `balance < 0` filter without changing the status filter first:** The `APPROVED` + `balance < 0` combination has different semantics. Fix the status to `PENDING_REVIEW` first; then evaluate whether the balance filter is still needed (it is not for this phase).
- **Adding a new dedicated endpoint `GET /contracts/:id/receipts?status=pending`:** This would require a larger change to `GET :id/receipts` (currently requires `month` and `year` query params with `ParseIntPipe` — mandatory). The existing global endpoint is sufficient and already wired.
- **Rendering EmptyState only in a nested conditional:** Section heading should always render so the page layout is stable regardless of data state.

---

## Don't Hand-Roll

| Problem            | Don't Build                         | Use Instead                    | Why                                                   |
| ------------------ | ----------------------------------- | ------------------------------ | ----------------------------------------------------- |
| Empty state UI     | Custom "no data" div                | `EmptyState` component         | Already used for payments on same page; consistent UX |
| Status enum string | Hardcoded `'pending_review'` string | `ReceiptStatus.PENDING_REVIEW` | Type-safe, rename-proof                               |

---

## Common Pitfalls

### Pitfall 1: `findPendingReceipts` Queries Wrong Status

**What goes wrong:** The method has `status: ReceiptStatus.APPROVED` — no `pending_review` receipts are ever returned. The frontend renders correctly only for the zero-results path (and even that is broken by RCPT-03). End-to-end, RCPT-01 is a dead letter until this is fixed.
**Why it happens:** Likely a copy-paste or logic error during original implementation; the endpoint name says "pending" but the query says "approved".
**How to avoid:** Fix to `ReceiptStatus.PENDING_REVIEW`. Remove the `balance < 0` post-filter — it belongs to "unpaid approved receipts" semantics, not "awaiting review".
**Warning signs:** `GET /contracts/receipts/pending` returns an empty array even when `pending_review` receipts exist in the DB.

### Pitfall 2: `GET /contracts/receipts/pending` Route Ordering

**What goes wrong:** If the `@Get('receipts/pending')` handler is moved below `@Get(':id')`, NestJS will match `/contracts/receipts/pending` as `id = 'receipts'` and then look for `GET /contracts/receipts` which returns a 404.
**Why it happens:** NestJS route matching is top-to-bottom within a controller class.
**How to avoid:** Do not reorder controller methods. The current order is correct — `receipts/pending` before `:id`.

### Pitfall 3: `totalDue` Arrives as String from TypeORM Decimal Column

**What goes wrong:** TypeORM `decimal` columns return JS strings, not numbers. `receipt.totalDue.toFixed(2)` throws `toFixed is not a function`.
**Why it happens:** TypeORM decimal/numeric columns serialize to string to preserve precision.
**How to avoid:** `ReceiptService.toReceipt()` already wraps totals with `Number(record.totalDue)` — this is correct. The `Receipt` interface defines `totalDue: number`. No additional conversion needed in the frontend if the service is used correctly.

### Pitfall 4: Missing Empty State When Array Is Empty

**What goes wrong:** The section simply disappears when `pendingReceipts.length === 0`, leaving no feedback to the user. RCPT-03 is unmet.
**Why it happens:** Original implementation wrapped the entire section in a length guard. This is a common "don't render when empty" shortcut that conflicts with the "show an empty state" requirement.
**How to avoid:** Always render the section heading and use conditional rendering inside to toggle between list and EmptyState.

---

## Code Examples

### Fix: `ReceiptService.findPendingReceipts` (backend)

```typescript
// Source: apps/api/src/receipt/receipt.service.ts — corrected version
async findPendingReceipts(): Promise<Receipt[]> {
  const receipts = await this.receiptRepository.find({
    where: {
      status: ReceiptStatus.PENDING_REVIEW,  // was APPROVED
    },
    order: {
      year: 'DESC',
      month: 'DESC',
    },
  });
  return receipts.map((r) => this.toReceipt(r));
  // balance < 0 filter removed — not relevant to pending_review semantics
}
```

### Fix: Pending Receipts Section (frontend)

```typescript
// apps/client/src/pages/TenantDashboard.tsx
// Replace the {pendingReceipts.length > 0 && (...)} block with:
<section>
  <h2 className="text-lg font-semibold text-on-surface-strong mb-3 flex items-center gap-2">
    <AlertCircle size={19} className="text-amber-600 dark:text-amber-400" />
    Recibos Pendientes de Pago
  </h2>
  {pendingReceipts.length === 0 ? (
    <EmptyState
      icon={AlertCircle}
      title="Sin recibos pendientes"
      description="No hay recibos pendientes de revisión."
    />
  ) : (
    <>
      <div className="space-y-3">
        {pendingReceipts.map((receipt) => (
          /* existing card markup unchanged */
        ))}
      </div>
      {/* existing total-adeudado summary block unchanged */}
    </>
  )}
</section>
```

### Spec: `receipt.service.spec.ts` scaffold

```typescript
// apps/api/src/receipt/receipt.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ReceiptService } from './receipt.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ReceiptEntity, ReceiptStatus } from './entities/receipt.entity';
import { Contract } from '../contract/entities/contract.entity';
import { Payment } from '../payment/entities/payment.entity';
import { ExtraCharge } from '../extra-charge/entities/extra-charge.entity';
import { ConsumptionService } from '../consumption/consumption.service';

describe('ReceiptService', () => {
  let service: ReceiptService;

  const mockReceiptRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
  };
  const mockContractRepository = { findOne: jest.fn() };
  const mockPaymentRepository = { find: jest.fn() };
  const mockExtraChargeRepository = { find: jest.fn() };
  const mockConsumptionService = { calculateConsumptionForPeriod: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReceiptService,
        {
          provide: getRepositoryToken(ReceiptEntity),
          useValue: mockReceiptRepository,
        },
        {
          provide: getRepositoryToken(Contract),
          useValue: mockContractRepository,
        },
        {
          provide: getRepositoryToken(Payment),
          useValue: mockPaymentRepository,
        },
        {
          provide: getRepositoryToken(ExtraCharge),
          useValue: mockExtraChargeRepository,
        },
        { provide: ConsumptionService, useValue: mockConsumptionService },
      ],
    }).compile();
    service = module.get<ReceiptService>(ReceiptService);
  });

  describe('findPendingReceipts', () => {
    it('should call find with status: PENDING_REVIEW', async () => {
      mockReceiptRepository.find.mockResolvedValue([]);
      await service.findPendingReceipts();
      expect(mockReceiptRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: ReceiptStatus.PENDING_REVIEW },
        }),
      );
    });

    it('should return mapped Receipt objects for all pending_review receipts', async () => {
      const stub = {
        id: 'r1',
        contractId: 'c1',
        month: 3,
        year: 2026,
        startDay: null,
        endDay: null,
        status: ReceiptStatus.PENDING_REVIEW,
        tenantName: 'Ana',
        departmentName: 'Depto 1',
        propertyAddress: 'Av. Lima 1',
        period: 'March 2026',
        items: [],
        totalPayments: '0',
        totalDue: '1500',
        balance: '-1500',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockReceiptRepository.find.mockResolvedValue([stub]);
      const result = await service.findPendingReceipts();
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe(ReceiptStatus.PENDING_REVIEW);
      expect(result[0].totalDue).toBe(1500);
    });
  });
});
```

---

## Validation Architecture

### Test Framework

| Property           | Value                                                               |
| ------------------ | ------------------------------------------------------------------- |
| Framework          | Jest (NestJS default, `@nestjs/testing`)                            |
| Config file        | `apps/api/package.json` (jest config inline)                        |
| Quick run command  | `cd apps/api && npm test -- --testPathPattern=receipt.service.spec` |
| Full suite command | `cd apps/api && npm test`                                           |

### Phase Requirements to Test Map

| Req ID  | Behavior                                                               | Test Type     | Automated Command                                                   | File Exists? |
| ------- | ---------------------------------------------------------------------- | ------------- | ------------------------------------------------------------------- | ------------ |
| RCPT-01 | `findPendingReceipts()` queries `PENDING_REVIEW` status                | unit          | `cd apps/api && npm test -- --testPathPattern=receipt.service.spec` | Wave 0       |
| RCPT-02 | Returned `Receipt` objects have numeric `totalDue` and string `period` | unit          | same                                                                | Wave 0       |
| RCPT-03 | EmptyState renders when no pending receipts                            | manual visual | N/A — React component, no test framework for frontend               | manual-only  |

RCPT-03 is manual-only: the project has no frontend testing framework (no Vitest, Playwright, or React Testing Library found in `apps/client`). Verification is visual inspection in the browser with zero pending receipts for a tenant.

### Sampling Rate

- **Per task commit:** `cd apps/api && npm test -- --testPathPattern=receipt.service.spec --passWithNoTests`
- **Per wave merge:** `cd apps/api && npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `apps/api/src/receipt/receipt.service.spec.ts` — covers RCPT-01, RCPT-02

---

## Sources

### Primary (HIGH confidence)

- Direct source read: `apps/api/src/receipt/receipt.service.ts` — `findPendingReceipts` implementation
- Direct source read: `apps/api/src/contract/contract.controller.ts` — route ordering and `GET receipts/pending`
- Direct source read: `apps/client/src/pages/TenantDashboard.tsx` — full existing UI and fetch logic
- Direct source read: `apps/api/src/receipt/entities/receipt.entity.ts` — `ReceiptStatus` enum and column types
- Direct source read: `apps/api/src/contract/contract.service.spec.ts` — spec scaffolding pattern
- Direct source read: `apps/api/src/payment/payment.service.spec.ts` — spec scaffolding pattern

### Secondary (MEDIUM confidence)

- `.planning/STATE.md` accumulated decisions — confirmed view-only requirement, `pending_review` only requirement
- `.planning/REQUIREMENTS.md` — confirmed RCPT-01/02/03 scope

---

## Metadata

**Confidence breakdown:**

- Backend bug identification: HIGH — read the source directly, confirmed `APPROVED` vs `PENDING_REVIEW` mismatch
- Frontend gap identification: HIGH — read TenantDashboard directly, confirmed `length > 0` guard with no EmptyState
- Test pattern: HIGH — read two existing spec files, pattern is fully established
- No-frontend-test assertion: HIGH — globbed all spec files, none in `apps/client/src`

**Research date:** 2026-03-12
**Valid until:** 2026-04-12 (stable domain, no external dependencies added)

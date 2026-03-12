# Phase 2: Contract + Payment History — Research

**Researched:** 2026-03-12
**Domain:** NestJS REST API (query filtering) + React page component (data display)
**Confidence:** HIGH

---

## Summary

Phase 2 adds contract details and payment history to the `TenantDashboard` page at `/tenants/:id`. The page already exists and already fetches contract and payment data — both are rendered in the current `TenantDashboard.tsx`. However, the fetching strategy is inefficient: it calls `GET /contracts` (all contracts, unfiltered) and `GET /payments` (all payments, unfiltered) and then filters client-side. The work for this phase is split into two concerns:

**Backend gap:** `GET /contracts` supports `?departmentId` filtering but not `?tenantId` filtering. `GET /payments` has no query filtering at all. Both services need a `findByContractId` / `findByTenantId` path to avoid loading the entire table into memory.

**Frontend gap:** The existing `TenantDashboard.tsx` already renders an "Active Contract" section and a "Ultimos Pagos" sidebar — the UI scaffolding is already there, matching CONT-01 through CONT-04 and PAY-01/PAY-02. However it uses an inefficient full-table fetch + client-side filter pattern. The requirements can be satisfied by switching to targeted API calls.

The `department.property` relation is NOT loaded in `ContractService.findAll()` or `findOne()` — only `['tenant', 'department']` are loaded. The department entity has a `propertyId` FK and a `@ManyToOne` to `Property`, but `ContractService.findOne()` does not include `department.property` in its relations array. This means property name (CONT-01) is currently missing from the API response; the nested relation must be explicitly requested.

**Primary recommendation:** Add `?tenantId` filter to `GET /contracts` with deep relation loading (`department.property`), add `?contractId` filter to `GET /payments`, then update `TenantDashboard.tsx` to use these targeted endpoints instead of full-table fetches.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CONT-01 | Display active contract property name | Requires `department.property` deep relation in ContractService — not currently loaded |
| CONT-02 | Display department name/number | `contract.department.name` already available in existing `findOne`/`findAll` with `['tenant', 'department']` |
| CONT-03 | Display monthly rent amount | `contract.rentAmount` already on Contract entity |
| CONT-04 | Display contract start date and end date | `contract.startDate` / `contract.endDate` already on Contract entity |
| PAY-01 | Display list of all payments on the contract | Requires either `GET /payments?contractId=X` (new filter) or deep relation loading on contract |
| PAY-02 | Each payment shows amount and date | `payment.amount` + `payment.date` already on Payment entity; `PaymentType` enum available for type label |
</phase_requirements>

---

## Standard Stack

### Core (no new dependencies required)

| Component | Current Version | Purpose | Why Standard |
|-----------|----------------|---------|--------------|
| NestJS `@Query()` decorator | Already in use | Add query param filtering to controllers | Project-established pattern (`?departmentId` on contracts) |
| TypeORM `Repository.find({ where: { ... } })` | Already in use | Filter payments by contractId | Project-established pattern |
| TypeORM deep relations | Already in use | Load `department.property` via nested relations string | Standard TypeORM pattern |
| React `useEffect` + `useState` | Already in use | Fetch targeted data on mount | Project-established pattern |
| `apiFetch<T>()` | Already in use | Type-safe HTTP calls from frontend | Project-established pattern |
| `EmptyState` component | Already in use | Show empty state when no payments exist | Already imported in TenantDashboard |

**No new packages needed.** This phase is purely additive within the existing stack.

---

## Architecture Patterns

### Recommended Project Structure

No new files or directories are needed. Changes are modifications to existing files:

```
apps/api/src/
  contract/
    contract.service.ts       ← Add tenantId filter + department.property relation
    contract.controller.ts    ← Add @Query('tenantId') to findAll handler
  payment/
    payment.service.ts        ← Add findByContractId method
    payment.controller.ts     ← Add @Query('contractId') to findAll handler

apps/client/src/
  pages/
    TenantDashboard.tsx       ← Switch to targeted API calls, use EmptyState for no-payments case
```

### Pattern 1: Query Parameter Filtering in NestJS Controller

**What:** Accept an optional query param and pass it to the service for WHERE clause filtering.
**When to use:** When the frontend needs to fetch a subset of a resource by a FK relationship.

```typescript
// Source: existing contract.controller.ts pattern (departmentId filter)
@Get()
findAll(
  @Query('tenantId') tenantId?: string,
  @Query('departmentId') departmentId?: string,
) {
  return this.contractService.findAll(tenantId, departmentId);
}
```

### Pattern 2: Deep Relation Loading in TypeORM

**What:** Load nested relations using dot-notation string in the `relations` array.
**When to use:** When you need a related entity's related entity (e.g., `contract -> department -> property`).

```typescript
// Source: TypeORM docs — nested relations
const contract = await this.contractRepository.find({
  where: { tenantId },
  relations: ['tenant', 'department', 'department.property'],
});
```

Note: `'department'` must still be listed explicitly alongside `'department.property'` in TypeORM v0.3+ for the eager load to work correctly.

### Pattern 3: Frontend Targeted Fetch (Replace Full-Table Pattern)

**What:** Call filtered API endpoints instead of fetching all rows and filtering client-side.
**When to use:** Always when an appropriate server-side filter exists.

```typescript
// Source: project pattern (apiFetch in TenantDashboard.tsx)
// BEFORE (inefficient):
apiFetch<Contract[]>(`/contracts`)  // loads all contracts
  .then(all => all.filter(c => c.tenant?.id === tenantId))

// AFTER (targeted):
apiFetch<Contract[]>(`/contracts?tenantId=${tenantId}`)
```

### Pattern 4: EmptyState Component

**What:** Use the existing `EmptyState` component for zero-item sections.
**When to use:** PAY-01 success criterion requires explicit empty state for no payments.

```typescript
// Source: TenantDashboard.tsx already imports EmptyState
// Existing usage reference: apps/client/src/components/EmptyState.tsx
{payments.length === 0 ? (
  <EmptyState
    icon={CreditCard}
    title="Sin pagos registrados"
    description="No hay pagos registrados para este contrato."
  />
) : (
  // payment list...
)}
```

The current code uses `<p>` text for the empty case — switching to `EmptyState` satisfies the explicit requirement.

### Anti-Patterns to Avoid

- **Full-table fetch + client-side filter:** `GET /payments` currently loads all payments with `relations: ['contract']` — this is the existing anti-pattern to replace. Do not extend it.
- **Reusing `findAll` return type for filtered results:** When adding `tenantId` filter to contracts, `findAll` must also include `department.property` relation to satisfy CONT-01. The existing `findAll` does not load this relation; amend it carefully so that non-filtered calls (used elsewhere, e.g., Contracts.tsx) also get the deeper relation without breaking other pages.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Property name on contract | Custom join query or separate property fetch | TypeORM nested relation `'department.property'` | TypeORM handles the JOIN; one-line addition to relations array |
| Payments filtered by contract | Custom pagination/filtering layer | TypeORM `find({ where: { contractId } })` | Standard TypeORM WHERE clause; no custom query builder needed |
| Empty state UI | Custom inline div | Existing `EmptyState` component | Already imported in TenantDashboard; consistent UX |

---

## Common Pitfalls

### Pitfall 1: Missing `department.property` Relation

**What goes wrong:** `contract.department.property` returns `undefined` even though the FK `departmentId` is set, so property name shows blank.
**Why it happens:** TypeORM lazy-loads relations by default; `relations: ['tenant', 'department']` does not traverse further to `department.property`.
**How to avoid:** Add `'department.property'` to the relations array in both `findAll` and `findOne` in `ContractService`. Verify in the response that `department.property.name` is a string, not undefined.
**Warning signs:** `activeContract.department?.property?.name` renders empty string or "undefined" in the UI.

### Pitfall 2: `GET /contracts` Change Breaks Other Pages

**What goes wrong:** Adding `tenantId` filter or changing the relations array in `ContractService.findAll` breaks other pages that call `GET /contracts` (e.g., `Contracts.tsx`, `DepartmentBilling.tsx`).
**Why it happens:** The method is shared; adding a deeper relation changes the response shape.
**How to avoid:** Adding `'department.property'` to the relations array is purely additive (more data returned) — it should not break existing consumers that only read `department.name`. Adding the optional `tenantId` param is backward-compatible. Verify `Contracts.tsx` still works after the change.
**Warning signs:** TypeScript type errors in other pages after modifying the Contract interface.

### Pitfall 3: `decimal` Columns Returned as String

**What goes wrong:** `payment.amount` and `contract.rentAmount` display as `"1500"` (string) instead of a number in the UI, and `Number(...).toFixed(2)` must be called explicitly.
**Why it happens:** TypeORM returns `decimal` / `numeric` PostgreSQL columns as strings in JavaScript to avoid float precision loss.
**How to avoid:** Always use `Number(payment.amount).toFixed(2)` on the frontend (already done in the existing active contract section). Do not compare amounts with `===` to a number literal.
**Warning signs:** Amount displays as "1500" instead of "1,500.00" or toFixed throws.

### Pitfall 4: Date Comparison for "Active" Contract

**What goes wrong:** `new Date(c.endDate) >= new Date()` produces wrong results when `endDate` is a `DATE` (not `DATETIME`) column — time zone offset shifts the date by one day.
**Why it happens:** PostgreSQL `DATE` columns are returned as `"2026-03-31"` strings; `new Date("2026-03-31")` is parsed as UTC midnight, but `new Date()` is local time.
**How to avoid:** The existing `TenantDashboard.tsx` already uses this pattern; it is an existing known issue. Do not change the active/past contract logic for this phase — it is out of scope. Note it exists.
**Warning signs:** A contract shows as "past" on the last day of the contract.

### Pitfall 5: `ContractService.findAll` Relations Impact

**What goes wrong:** `ContractService.findAll()` currently loads `['tenant', 'department']`. Adding `'department.property'` adds a JOIN on every call, including the list page (`Contracts.tsx`) which may not need property data.
**Why it happens:** TypeORM adds a JOIN for each relation in the array.
**How to avoid:** The performance impact is negligible for typical property management scale (tens to hundreds of contracts). Accept the deeper join. If performance becomes an issue, add a separate `findByTenant` method instead of modifying `findAll`.

---

## Code Examples

### ContractService: Add tenantId filter + department.property relation

```typescript
// Source: existing contract.service.ts adapted with TypeORM nested relations
async findAll(tenantId?: string, departmentId?: string): Promise<Contract[]> {
  const where: Record<string, string> = {};
  if (tenantId) where.tenantId = tenantId;
  if (departmentId) where.departmentId = departmentId;

  return this.contractRepository.find({
    where,
    relations: ['tenant', 'department', 'department.property'],
  });
}
```

### PaymentService: Add findByContractId method

```typescript
// Source: existing payment.service.ts pattern (findAll) adapted
async findByContract(contractId: string): Promise<Payment[]> {
  return this.paymentRepository.find({
    where: { contractId },
    order: { date: 'DESC' },
  });
}
```

### PaymentController: Add contractId query filter

```typescript
// Source: existing contract.controller.ts pattern (departmentId query param)
@Get()
findAll(@Query('contractId') contractId?: string) {
  if (contractId) {
    return this.paymentService.findByContract(contractId);
  }
  return this.paymentService.findAll();
}
```

### TenantDashboard: Targeted fetches

```typescript
// Source: project pattern in TenantDashboard.tsx useEffect
useEffect(() => {
  Promise.all([
    apiFetch<Tenant>(`/tenants/${tenantId}`),
    apiFetch<Contract[]>(`/contracts?tenantId=${tenantId}`),
  ])
    .then(([t, tenantContracts]) => {
      setTenant(t);
      tenantContracts.sort((a, b) => b.endDate.localeCompare(a.endDate));
      setContracts(tenantContracts);

      const active = tenantContracts.find(c => new Date(c.endDate) >= new Date());
      if (active) {
        return apiFetch<Payment[]>(`/payments?contractId=${active.id}`);
      }
      return Promise.resolve([]);
    })
    .then(setPayments)
    .catch(err => {
      console.error(err);
      setError('Error al cargar datos del inquilino');
    })
    .finally(() => setLoading(false));
}, [tenantId]);
```

---

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|-----------------|-------|
| Full-table fetch + client filter | Targeted `?tenantId` / `?contractId` filter | This phase introduces the better pattern |
| `relations: ['tenant', 'department']` | `relations: ['tenant', 'department', 'department.property']` | Additive — no breaking change |
| Inline `<p>` for no-payments empty state | `EmptyState` component | Satisfies explicit PAY-01 success criterion |

---

## Open Questions

1. **Should payments show ALL contracts or only the active contract?**
   - What we know: PAY-01 says "all payments made on the tenant's contract" (singular). The current TenantDashboard fetches payments for all of the tenant's contracts.
   - What's unclear: Whether the intent is all contracts (full history) or only the active one.
   - Recommendation: Show payments for the active contract only for simplicity, since the requirement says "the tenant's contract" (singular). If the tenant has no active contract, show all payments across all their contracts. This is a planner decision.

2. **`GET /contracts` findAll relations change scope**
   - What we know: `ContractService.findAll` is used by multiple pages (`Contracts.tsx`, `DepartmentBilling.tsx`). Adding `department.property` changes the JOIN depth.
   - What's unclear: Whether other pages depend on `department.property` being absent (they don't — it's additive).
   - Recommendation: Add the relation to `findAll` — it's safe and additive.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest 30 + ts-jest |
| Config file | `apps/api/package.json` (inline jest config) |
| Quick run command | `cd apps/api && npm test -- --testPathPattern="contract\|payment" --passWithNoTests` |
| Full suite command | `cd apps/api && npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CONT-01 | `findAll` with tenantId filter returns contracts with `department.property.name` | unit | `cd apps/api && npm test -- --testPathPattern="contract.service"` | ❌ Wave 0 |
| CONT-02 | Contract response includes `department.name` | unit | same | ❌ Wave 0 |
| CONT-03 | Contract response includes `rentAmount` | unit | same | ❌ Wave 0 |
| CONT-04 | Contract response includes `startDate` / `endDate` | unit | same | ❌ Wave 0 |
| PAY-01 | `findByContract(contractId)` returns payments for correct contract | unit | `cd apps/api && npm test -- --testPathPattern="payment.service"` | ❌ Wave 0 |
| PAY-02 | Payment response includes `amount` and `date` | unit | same | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `cd apps/api && npm test -- --testPathPattern="contract\|payment" --passWithNoTests`
- **Per wave merge:** `cd apps/api && npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `apps/api/src/contract/contract.service.spec.ts` — covers CONT-01 through CONT-04 (tenantId filter, department.property relation)
- [ ] `apps/api/src/payment/payment.service.spec.ts` — covers PAY-01, PAY-02 (findByContract filter)

*(Existing `contract.overlap.spec.ts` tests a different concern — contract date overlap logic — not the query filter pattern.)*

---

## Sources

### Primary (HIGH confidence)

- Direct code inspection: `apps/api/src/contract/contract.service.ts` — confirmed `findAll` only loads `['tenant', 'department']`, no `department.property`
- Direct code inspection: `apps/api/src/contract/contract.controller.ts` — confirmed `GET /contracts` has `?departmentId` but no `?tenantId` filter
- Direct code inspection: `apps/api/src/payment/payment.controller.ts` — confirmed `GET /payments` has no query filtering
- Direct code inspection: `apps/api/src/payment/payment.service.ts` — confirmed `findAll()` loads all payments; `contractId` FK is present on entity
- Direct code inspection: `apps/client/src/pages/TenantDashboard.tsx` — confirmed existing UI structure renders contract and payment sections; uses full-table fetch pattern
- Direct code inspection: `apps/api/src/contract/entities/contract.entity.ts` — confirmed entity fields (`rentAmount`, `startDate`, `endDate`, `tenantId`, `departmentId`)
- Direct code inspection: `apps/api/src/payment/entities/payment.entity.ts` — confirmed `amount`, `date`, `type` (PaymentType enum), `contractId` FK
- Direct code inspection: `apps/api/src/department/entities/department.entity.ts` — confirmed `@ManyToOne(() => Property)` relation exists

### Secondary (MEDIUM confidence)

- TypeORM nested relations pattern (`'department.property'`) — well-established TypeORM v0.3 feature, consistent with existing codebase style

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in use; no new dependencies needed
- Architecture: HIGH — patterns directly observed in existing codebase files
- Pitfalls: HIGH — decimal-as-string and missing-relation issues confirmed by direct entity inspection
- API gaps: HIGH — confirmed by reading controller and service source directly

**Research date:** 2026-03-12
**Valid until:** 2026-04-12 (stable codebase; no fast-moving dependencies)

# PropManager — Tenant Detail Page

## What This Is

PropManager is a property management system for managing rental properties, tenants, contracts, meter readings, and billing. This milestone adds a tenant detail page: clicking a tenant card in `/tenants` navigates to `/tenants/:id`, showing all tenant information plus a view-only section of pending receipts.

## Core Value

Managers can quickly see the full picture of a tenant — who they are, their active contract, payment history, meter readings, and any outstanding billing — all in one place.

## Requirements

### Validated

- ✓ Tenant list page at `/tenants` with tenant cards — existing
- ✓ Tenant entity with personal data (name, phone, email, document) — existing
- ✓ Contract entity linking tenants to departments/properties — existing
- ✓ Receipt entity with `pending_review` status — existing
- ✓ Payment records per contract — existing
- ✓ Meter readings per department — existing

### Active

- [ ] Tenant cards in `/tenants` are clickable and navigate to `/tenants/:id`
- [ ] Tenant detail page shows personal data (name, phone, email, ID/document)
- [ ] Tenant detail page shows active contract (property, department, rent amount, start/end dates)
- [ ] Tenant detail page shows payment history for the tenant's contract
- [ ] Tenant detail page shows meter readings for the tenant's department
- [ ] Tenant detail page has a "Pending Receipts" section (view only, `pending_review` status only)

### Out of Scope

- Receipt actions (approve/deny/send) from the tenant detail page — already handled in DepartmentBilling
- Editing tenant information from the detail page — out of scope for this milestone
- Multiple active contracts per tenant — current model is one active contract

## Context

- Existing `/tenants` page renders tenant cards but they are not clickable
- Backend already has `GET /tenants/:id` or similar; receipts are nested under contracts
- Frontend uses `apiFetch<T>()` with React `useEffect` + `useState` per page
- Routing is defined in `apps/client/src/App.tsx` using React Router v7

## Constraints

- **Tech Stack**: Must use existing React Router, apiFetch helpers, and Tailwind semantic tokens
- **Auth**: All new routes must be protected (behind `ProtectedRoute`)
- **API**: Use existing endpoints where possible; add backend endpoint only if needed

## Key Decisions

| Decision | Rationale | Outcome |
|---|---|---|
| Route: `/tenants/:id` | Matches English convention used in existing routes | — Pending |
| Pending receipts: view only | Actions handled in DepartmentBilling, no duplication needed | — Pending |
| Pending receipts: `pending_review` only | Reduces noise; actionable receipts are the priority | — Pending |

---
*Last updated: 2026-03-11 after initialization*

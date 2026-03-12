# Roadmap: PropManager — Tenant Detail Page

## Overview

This milestone delivers a tenant detail page at `/tenants/:id`. Starting from clickable tenant cards, the work builds up in three layers: navigation + personal info (get the user to the page with basic data), contract + payment history (the financial picture), and pending receipts (outstanding billing visibility). Each phase delivers a coherent, usable slice of the page.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Navigation + Personal Info** - Clickable tenant cards navigate to a detail page showing personal data (completed 2026-03-12)
- [x] **Phase 2: Contract + Payment History** - Detail page shows active contract details and full payment history (completed 2026-03-12)
- [ ] **Phase 3: Pending Receipts** - Detail page shows a view-only section of pending billing receipts

## Phase Details

### Phase 1: Navigation + Personal Info
**Goal**: User can click a tenant card and land on a detail page showing who the tenant is
**Depends on**: Nothing (first phase)
**Requirements**: NAV-01, PERS-01, PERS-02, PERS-03, PERS-04
**Success Criteria** (what must be TRUE):
  1. Clicking any tenant card in `/tenants` navigates to `/tenants/:id` without a full page reload
  2. The detail page displays the tenant's full name, phone number, email address, and document/ID number
  3. The route is protected behind `ProtectedRoute` consistent with other app routes
  4. Navigating directly to `/tenants/:id` via URL loads the correct tenant's data
**Plans**: 2 plans

Plans:
- [ ] 01-01-PLAN.md — Add documentId to Tenant entity + DTO and display all personal fields in TenantDashboard
- [ ] 01-02-PLAN.md — Wire clickable Link navigation on tenant rows in Tenants.tsx

### Phase 2: Contract + Payment History
**Goal**: User can see the tenant's active rental contract and every payment they have made
**Depends on**: Phase 1
**Requirements**: CONT-01, CONT-02, CONT-03, CONT-04, PAY-01, PAY-02
**Success Criteria** (what must be TRUE):
  1. The detail page shows the property name, department name/number, monthly rent, and contract start/end dates
  2. The detail page shows a list of all payments on the contract, each with its amount and date
  3. If no payments exist, the payments section shows an empty state rather than a blank area
**Plans**: 3 plans

Plans:
- [ ] 02-01-PLAN.md — Create failing unit test scaffolds for ContractService (tenantId filter + department.property) and PaymentService (findByContract)
- [ ] 02-02-PLAN.md — Add tenantId filter + department.property relation to contracts API; add contractId filter to payments API
- [ ] 02-03-PLAN.md — Update TenantDashboard.tsx to use targeted API calls and EmptyState for no-payments case

### Phase 3: Pending Receipts
**Goal**: User can see all outstanding billing receipts that are awaiting review for this tenant
**Depends on**: Phase 2
**Requirements**: RCPT-01, RCPT-02, RCPT-03
**Success Criteria** (what must be TRUE):
  1. The detail page has a "Pending Receipts" section listing all receipts with `pending_review` status
  2. Each pending receipt entry shows the billing period (month/year) and total amount
  3. When no pending receipts exist, the section displays a clear empty state message
  4. The section is view-only — no approve/deny/send actions are present
**Plans**: 2 plans

Plans:
- [ ] 03-01-PLAN.md — TDD: write failing spec for findPendingReceipts, fix APPROVED→PENDING_REVIEW bug in ReceiptService
- [ ] 03-02-PLAN.md — Replace pendingReceipts length guard with always-visible section + EmptyState in TenantDashboard

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Navigation + Personal Info | 2/2 | Complete    | 2026-03-12 |
| 2. Contract + Payment History | 1/3 | Complete    | 2026-03-12 |
| 3. Pending Receipts | 0/2 | Not started | - |

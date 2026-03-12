# Requirements: PropManager — Tenant Detail Page

**Defined:** 2026-03-11
**Core Value:** Managers can quickly see the full picture of a tenant — personal info, active contract, payment history, and pending billing — all in one place.

## v1 Requirements

### Navigation

- [x] **NAV-01**: User can click a tenant card in `/tenants` and navigate to `/tenants/:id`

### Personal Info

- [x] **PERS-01**: Tenant detail page displays tenant's full name
- [x] **PERS-02**: Tenant detail page displays tenant's phone number
- [x] **PERS-03**: Tenant detail page displays tenant's email address
- [x] **PERS-04**: Tenant detail page displays tenant's document/ID number

### Contract

- [x] **CONT-01**: Tenant detail page displays the tenant's active contract property name
- [x] **CONT-02**: Tenant detail page displays the department name/number
- [x] **CONT-03**: Tenant detail page displays the monthly rent amount
- [x] **CONT-04**: Tenant detail page displays contract start date and end date

### Payments

- [x] **PAY-01**: Tenant detail page displays a list of all payments made on the tenant's contract
- [x] **PAY-02**: Each payment entry shows amount and date

### Pending Receipts

- [ ] **RCPT-01**: Tenant detail page displays a section listing receipts with `pending_review` status
- [ ] **RCPT-02**: Each pending receipt entry shows the billing period (month/year) and total amount
- [ ] **RCPT-03**: If no pending receipts exist, the section shows an empty state message

## v2 Requirements

### Meter Readings

- **METER-01**: Tenant detail page displays meter reading history for the tenant's department
- **METER-02**: Meter readings show date, value, and meter type (LIGHT/WATER)

## Out of Scope

| Feature | Reason |
|---|---|
| Edit tenant info from detail page | Editing handled in tenant management flow |
| Receipt actions (approve/deny/send) | Already handled in DepartmentBilling page |
| Multiple active contracts | Current model is one active contract per tenant |
| Meter readings | Deferred to v2 |

## Traceability

| Requirement | Phase | Status |
|---|---|---|
| NAV-01 | Phase 1 | Complete |
| PERS-01 | Phase 1 | Complete |
| PERS-02 | Phase 1 | Complete |
| PERS-03 | Phase 1 | Complete |
| PERS-04 | Phase 1 | Complete |
| CONT-01 | Phase 2 | Complete |
| CONT-02 | Phase 2 | Complete |
| CONT-03 | Phase 2 | Complete |
| CONT-04 | Phase 2 | Complete |
| PAY-01 | Phase 2 | Complete |
| PAY-02 | Phase 2 | Complete |
| RCPT-01 | Phase 3 | Pending |
| RCPT-02 | Phase 3 | Pending |
| RCPT-03 | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 14 total
- Mapped to phases: 14
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-11*
*Last updated: 2026-03-11 after roadmap creation*

---
phase: 2
slug: contract-payment-history
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-11
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest (backend) — `apps/api` |
| **Config file** | `apps/api/jest.config.js` |
| **Quick run command** | `cd apps/api && npm test -- --testPathPattern="contract|payment"` |
| **Full suite command** | `cd apps/api && npm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd apps/api && npm test -- --testPathPattern="contract|payment"`
- **After every plan wave:** Run `cd apps/api && npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 20 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 2-01-01 | 02-01 | 1 | CONT-01–04 | unit | `cd apps/api && npm test -- --testPathPattern=contract` | ✅ | ⬜ pending |
| 2-01-02 | 02-01 | 1 | PAY-01–02 | unit | `cd apps/api && npm test -- --testPathPattern=payment` | ✅ | ⬜ pending |
| 2-02-01 | 02-02 | 1 | CONT-01–04, PAY-01–02 | manual | Browse /tenants/:id, verify contract + payments sections | ✅ | ⬜ pending |

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. The existing Jest suite covers contract and payment services. No new test infrastructure needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Contract section shows property name, department, rent, dates | CONT-01–04 | UI rendering | Open /tenants/:id, verify all contract fields visible |
| Payment list shows amount and date per payment | PAY-01–02 | UI rendering | Open /tenants/:id with a tenant that has payments, verify list |
| Empty state shown when no payments | PAY-01 | UI rendering | Open /tenants/:id for tenant with no payments, verify EmptyState component |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

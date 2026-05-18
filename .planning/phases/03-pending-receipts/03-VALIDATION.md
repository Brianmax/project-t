---
phase: 3
slug: pending-receipts
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-12
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                  |
| ---------------------- | ------------------------------------------------------ |
| **Framework**          | Jest (backend) — `apps/api`                            |
| **Config file**        | `apps/api/jest.config.js`                              |
| **Quick run command**  | `cd apps/api && npm test -- --testPathPattern=receipt` |
| **Full suite command** | `cd apps/api && npm test`                              |
| **Estimated runtime**  | ~15 seconds                                            |

---

## Sampling Rate

- **After every task commit:** Run `cd apps/api && npm test -- --testPathPattern=receipt`
- **After every plan wave:** Run `cd apps/api && npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 20 seconds

---

## Per-Task Verification Map

| Task ID | Plan  | Wave | Requirement | Test Type | Automated Command                                      | File Exists | Status     |
| ------- | ----- | ---- | ----------- | --------- | ------------------------------------------------------ | ----------- | ---------- |
| 3-01-01 | 03-01 | 1    | RCPT-01     | unit      | `cd apps/api && npm test -- --testPathPattern=receipt` | ❌ W0       | ⬜ pending |
| 3-02-01 | 03-02 | 2    | RCPT-01     | unit      | `cd apps/api && npm test -- --testPathPattern=receipt` | ✅ after W0 | ⬜ pending |
| 3-02-02 | 03-02 | 2    | RCPT-02,03  | manual    | Browse /tenants/:id, verify pending receipts section   | ✅          | ⬜ pending |

---

## Wave 0 Requirements

- [ ] `apps/api/src/receipt/receipt.service.spec.ts` — unit tests for `findPendingReceipts` returning only `pending_review` records

---

## Manual-Only Verifications

| Behavior                                               | Requirement | Why Manual   | Test Instructions                                               |
| ------------------------------------------------------ | ----------- | ------------ | --------------------------------------------------------------- |
| Pending receipts section lists pending_review receipts | RCPT-01     | UI rendering | Open /tenants/:id, verify section appears with pending receipts |
| Each entry shows month/year and total amount           | RCPT-02     | UI rendering | Verify billing period and amount visible per receipt row        |
| Empty state when no pending receipts                   | RCPT-03     | UI rendering | Open tenant with no pending receipts, verify EmptyState shown   |
| Section is view-only (no actions)                      | RCPT-01     | UI rendering | Confirm no approve/deny/send buttons present                    |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

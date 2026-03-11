---
phase: 1
slug: navigation-personal-info
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-11
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest (backend) — `apps/api` |
| **Config file** | `apps/api/jest.config.js` |
| **Quick run command** | `cd apps/api && npm test -- --testPathPattern=tenant` |
| **Full suite command** | `cd apps/api && npm test` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd apps/api && npm test -- --testPathPattern=tenant`
- **After every plan wave:** Run `cd apps/api && npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 1 | NAV-01 | manual | navigate to /tenants, click card | ✅ | ⬜ pending |
| 1-01-02 | 01 | 1 | PERS-04 | unit | `cd apps/api && npm test -- --testPathPattern=tenant` | ✅ | ⬜ pending |
| 1-01-03 | 01 | 1 | PERS-01–04 | manual | navigate to /tenants/:id, verify all fields | ✅ | ⬜ pending |

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No new test files needed — TypeScript compilation (`npx tsc --noEmit`) and the existing Jest suite cover entity changes.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Clicking tenant card navigates to detail page | NAV-01 | Frontend routing — no automated test | Open /tenants, click any card, verify URL changes to /tenants/:id |
| Detail page shows all personal fields | PERS-01–04 | UI rendering — no automated test | Open /tenants/:id, verify name, phone, email, documentId all appear |
| Protected route redirects unauthenticated | NAV-01 | Auth flow — existing pattern | Logout, navigate to /tenants/:id, verify redirect to login |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

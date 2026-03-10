# Codebase Concerns

**Analysis Date:** 2026-03-09

## Tech Debt

**Hardcoded Database Credentials in app.module.ts:**
- Issue: PostgreSQL connection config (host, username, password, database name) is hardcoded directly in `app.module.ts` instead of using `ConfigService` or environment variables.
- Files: `apps/api/src/app.module.ts` lines 31–37
- Impact: Cannot change database credentials without a code change. Credentials will be committed to version control if `.env` is missing. Completely blocks environment-specific deployments.
- Fix approach: Replace hardcoded values with `ConfigService.getOrThrow()` inside `TypeOrmModule.forRootAsync()`.

**TypeORM `synchronize: true` Enabled:**
- Issue: `synchronize: true` is set in the TypeORM config in `app.module.ts`. This auto-applies schema changes on every boot.
- Files: `apps/api/src/app.module.ts` line 37
- Impact: Any entity change will immediately mutate the production database schema, potentially causing data loss (dropped columns, changed types). Should only ever be `true` in local development.
- Fix approach: Set `synchronize: false` and introduce a TypeORM migration workflow (`typeorm migration:generate`, `migration:run`).

**Hardcoded `API_BASE` URL in Two Places:**
- Issue: `http://localhost:3001` is hardcoded in both `apps/client/src/lib/api.ts` (line 1) and `apps/client/src/contexts/AuthContext.tsx` (line 26).
- Files: `apps/client/src/lib/api.ts`, `apps/client/src/contexts/AuthContext.tsx`
- Impact: Deploying the frontend to any non-local environment requires a code change, not a config change. The duplication risks the two values drifting.
- Fix approach: Read from `import.meta.env.VITE_API_BASE` with a local default fallback.

**`receipt.service.ts` Uses `as any` Cast for JSONB Items:**
- Issue: On receipt update, `existing.items = calculated.items as any` bypasses TypeScript's type system.
- Files: `apps/api/src/receipt/receipt.service.ts` line 88
- Impact: Silent type mismatch between `ReceiptItem[]` and the JSONB column type `Array<{ description: string; amount: number }>` could cause runtime errors if the shapes ever diverge.
- Fix approach: Define a single shared type for receipt items and use it in both the entity and the service interface.

**`CreateContractTerminationDto` Missing Class-Validator Decorators:**
- Issue: The DTO class has no `@IsString()`, `@IsNumber()`, `@IsDateString()`, or other class-validator decorators. The global `ValidationPipe` with `whitelist: true` will not validate or sanitize this input.
- Files: `apps/api/src/contract-termination/dto/create-contract-termination.dto.ts`
- Impact: Malformed or missing fields (e.g., a non-date `actualDepartureDate`) pass directly to business logic, which then does `new Date(dto.actualDepartureDate)` without error handling — producing `Invalid Date` in the database.
- Fix approach: Add `class-validator` decorators to match the pattern used in other DTOs.

**`ContractSettlementService` is Unused / Orphaned:**
- Issue: `ContractSettlementService.calculateFinalSettlement()` is exposed as `GET /contracts/:id/settlement` but the frontend has no UI for this endpoint. The service logic also has a dead variable `advancePaymentUsed` that is always `false` and never set.
- Files: `apps/api/src/contract-settlement/contract-settlement.service.ts`
- Impact: Dead code adds maintenance surface and the dead variable (`advancePaymentUsed`) hints at incomplete financial logic. Settlement calculations ignore utility consumption entirely.
- Fix approach: Either implement a UI for settlement, or consolidate into `ContractTerminationService` which handles the same domain.

**`ConsumptionService.calculateCurrentConsumption()` Makes N+1 Queries:**
- Issue: The method runs two separate `departmentMeterRepository.findOne()` calls inside a `for` loop iterating over meter types, after already calling `findOne` once before the loop.
- Files: `apps/api/src/consumption/consumption.service.ts` lines 118–131
- Impact: Three DB round-trips for what should be one query per department. This will degrade as the number of readings grows.
- Fix approach: Fetch all meters for the department in a single `find({ where: { departmentId } })` call before the loop.

**`findPendingReceipts()` Method Name Mismatch:**
- Issue: `ReceiptService.findPendingReceipts()` queries for receipts with `status: APPROVED` (not `PENDING_REVIEW`) and then filters for negative balances. The name is misleading.
- Files: `apps/api/src/receipt/receipt.service.ts` lines 128–143
- Impact: Causes confusion for any developer reading the code. If the intent is "find approved receipts with outstanding balances" the name should reflect that.
- Fix approach: Rename to `findApprovedWithBalance()` or similar and document intent.

## Known Bugs

**Negative Consumption Not Guarded:**
- Symptoms: If a new meter reading is lower than the previous one (data entry error), `consumption` is negative. The `if (consumption > 0)` check in `receipt.service.ts` prevents the line from appearing on the receipt, but the cost is silently zero. No error is surfaced.
- Files: `apps/api/src/consumption/consumption.service.ts` line 77, `apps/api/src/receipt/receipt.service.ts` lines 243, 251
- Trigger: Enter a meter reading value lower than the previous reading for the same meter.
- Workaround: None — the receipt simply shows no electricity/water line, which can be confused with "no readings available."

**Contract `findAll` Returns Both Active and Terminated Contracts:**
- Symptoms: `GET /contracts?departmentId=X` returns all contracts regardless of status. The frontend takes `contracts[0]` as the active contract.
- Files: `apps/api/src/contract/contract.service.ts` line 65, `apps/client/src/pages/DepartmentBilling.tsx` line 176
- Trigger: A department that has had two contracts (one terminated, one active) will return the terminated contract first if ordering is insertion order and termination happened after a newer contract was created.
- Workaround: The terminated contract banner fires based on `contract.status`, so it is mostly cosmetic, but receipt generation would attempt to generate for a terminated contract.

**`actualDepartureDate` Passed as String, Used as Date:**
- Symptoms: `ContractSettlementService.calculateFinalSettlement()` receives `actualEndDate` as `new Date(query.actualEndDate)` where the query string is not validated. An empty or malformed string produces `Invalid Date`, causing `NaN` in arithmetic comparisons that silently produce wrong financial outputs.
- Files: `apps/api/src/contract/contract.controller.ts` line 114, `apps/api/src/contract-settlement/contract-settlement.service.ts` line 46
- Trigger: Call `GET /contracts/:id/settlement` with a missing or malformed `actualEndDate` query param.
- Workaround: None.

## Security Considerations

**CORS Locked to `localhost:5173` (No Production Config):**
- Risk: CORS origin is hardcoded to `http://localhost:5173` in `main.ts`. Deploying the API to any environment without changing this will block all frontend requests.
- Files: `apps/api/src/main.ts` line 11
- Current mitigation: None.
- Recommendations: Read allowed origins from an environment variable (`CORS_ORIGIN`) and support a comma-separated list.

**Refresh Token Cookie Missing `secure` Flag:**
- Risk: The `refreshToken` httpOnly cookie is set without `secure: true`, meaning it will be sent over plain HTTP. In a non-HTTPS environment (or if HTTPS is misconfigured) the refresh token can be intercepted.
- Files: `apps/api/src/auth/auth.service.ts` lines 73–78
- Current mitigation: `httpOnly: true` and `sameSite: 'lax'` reduce XSS and CSRF risk respectively, but the token is not protected from network interception.
- Recommendations: Add `secure: process.env.NODE_ENV === 'production'` to the cookie options.

**No Rate Limiting on Auth Endpoints:**
- Risk: `POST /auth/login` and `POST /auth/register` have no rate limiting. An attacker can perform unlimited brute-force attempts against credentials.
- Files: `apps/api/src/auth/auth.controller.ts`
- Current mitigation: None.
- Recommendations: Apply `@nestjs/throttler` with a `ThrottlerGuard` on auth routes (e.g., 5 attempts per minute per IP).

**Admin Endpoints Rely on Role from JWT Only:**
- Risk: `AdminController` uses `RolesGuard` which reads `role` directly from the JWT payload without re-validating it against the database. If a user's role is changed in the DB, their existing JWT still grants admin access until it expires.
- Files: `apps/api/src/admin/admin.controller.ts`, `apps/api/src/auth/guards/roles.guard.ts`
- Current mitigation: 15-minute access token expiry limits the window.
- Recommendations: For elevated actions (approve/reject user), consider re-fetching the user's role from the DB rather than trusting only the token payload.

**No Authorization Scoping — Any Authenticated User Can Access Any Resource:**
- Risk: All non-admin endpoints (properties, departments, contracts, receipts, payments) are protected only by `JwtGuard` (is the user authenticated?). There is no ownership check (e.g., does this user own this property?). Any authenticated user can read and mutate any other user's data.
- Files: All service and controller files under `apps/api/src/`
- Current mitigation: Only internal/trusted users are expected to register (pending admin approval).
- Recommendations: Add a `userId` (owner) foreign key to `Property` and enforce it in queries, or document the single-landlord assumption explicitly so it is not forgotten at scale.

## Performance Bottlenecks

**`DepartmentBilling.tsx` Fetches Six Endpoints Sequentially on Load:**
- Problem: Initial load fires three parallel requests, then on contract resolution fires two more in series, then a receipt preview. The chain is `[dept, contracts, consumption]` → `[charges, termination]` → `[receipt preview]`. The receipt preview is always a round-trip even when no receipt exists for the period.
- Files: `apps/client/src/pages/DepartmentBilling.tsx` lines 162–213
- Cause: Sequential `await` inside `fetchData` — the third group cannot start until the second resolves.
- Improvement path: Parallelise the receipt preview fetch alongside charges/termination once `activeContract.id` is known.

**No Pagination on Any List Endpoint:**
- Problem: All `findAll` methods return the entire table. `GET /meter-readings` returns every reading ever recorded; `GET /contracts` returns every contract.
- Files: All `*.service.ts` `findAll` methods
- Cause: No `take`/`skip` or cursor-based pagination implemented.
- Improvement path: Add `page`/`limit` query params with a sensible default (e.g., 50 records) and return total count for frontend pagination controls.

## Fragile Areas

**`department.isAvailable` Flag is Not Atomic:**
- Files: `apps/api/src/contract/contract.service.ts` lines 58–61, 119–123
- Why fragile: Contract creation sets `department.isAvailable = false` in two separate `save()` calls (one for the department, one for the contract). A crash between the two leaves data inconsistent. Similarly, `remove()` restores availability after deleting the contract but does not use a transaction.
- Safe modification: Wrap both operations in a `dataSource.transaction()` block (as is done in `property.service.ts`).
- Test coverage: The spec for `ContractService` (`contract.overlap.spec.ts`) tests the flag toggle but does not cover the failure/rollback path.

**Receipt Regeneration Resets `status` to `PENDING_REVIEW` Without Warning:**
- Files: `apps/api/src/receipt/receipt.service.ts` lines 79–93
- Why fragile: Calling "Regenerar Recibo" on an already-approved receipt silently resets its status back to `PENDING_REVIEW` and overwrites all line items. There is no guard or confirmation before the overwrite.
- Safe modification: Return a 409 Conflict if the receipt is already `APPROVED`, or require an explicit `force=true` flag. Add a UI confirmation step.
- Test coverage: No tests cover receipt update/regeneration.

**`PropertyService.remove()` Deletes Tenants as a Side Effect:**
- Files: `apps/api/src/property/property.service.ts` lines 91–104
- Why fragile: Deleting a property cascades to delete tenants who have no other contracts. This is surprising behaviour — a tenant record represents a real person and should not be deleted purely because a property was removed. This also creates a data integrity risk if a tenant has concurrent contracts under different properties.
- Safe modification: Remove the orphan tenant deletion logic. Tenants should only be deleted explicitly.
- Test coverage: No test covers the tenant side-effect of `PropertyService.remove()`.

## Scaling Limits

**Single Admin User Design:**
- Current capacity: `UserService.findAdmin()` uses `findOneBy({ role: 'admin' })` — returns only one admin. `SeedService` skips seeding if any admin exists.
- Limit: A second admin cannot be created through the current registration flow. Only one admin is created at startup. Admin actions are not audited.
- Scaling path: Change the admin seed check to find-by-email, allow multiple admin users by removing the uniqueness assumption in `findAdmin()`.

## Dependencies at Risk

**`cookie-parser` Required via `require()` Hack:**
- Risk: The `require()` workaround in `main.ts` is needed because `cookie-parser`'s TypeScript types conflict with NestJS's `isolatedModules + emitDecoratorMetadata`. This is a known incompatibility and indicates `@types/cookie-parser` or NestJS's type expectations may lag behind.
- Files: `apps/api/src/main.ts` line 5
- Impact: IDE loses type inference for cookie-parser middleware. If `cookie-parser` updates its types, the cast may silently break.
- Migration plan: Monitor `@types/cookie-parser` and NestJS releases. Consider switching to the NestJS-native cookie handling approach when available.

## Missing Critical Features

**WhatsApp Notification Not Implemented:**
- Problem: The "Enviar por WhatsApp" button in the receipt modal calls `alert()` with a placeholder message. No actual notification delivery exists.
- Files: `apps/client/src/pages/DepartmentBilling.tsx` line 344
- Blocks: The approved-receipt workflow has no delivery step, making approval a no-op from the tenant's perspective.

**No Input Validation on Contract Date Range:**
- Problem: `CreateContractDto` accepts `startDate` and `endDate` but there is no check that `startDate < endDate` or that the date range does not overlap with an existing active contract for the same department.
- Files: `apps/api/src/contract/contract.service.ts`, `apps/api/src/contract/dto/create-contract.dto.ts`
- Blocks: A landlord can accidentally create a contract where `startDate > endDate`, causing silent calculation errors in billing and settlement.

**No Email Notification for Registration Approval:**
- Problem: When a user registers, they get the message "Account pending approval". When an admin approves or rejects them (via `AdminController`), no email is sent. The user has no way to know their status changed.
- Files: `apps/api/src/admin/admin.controller.ts` lines 17–25
- Blocks: The user registration flow has no feedback loop.

## Test Coverage Gaps

**Receipt Service Has Zero Tests:**
- What's not tested: `issueReceipt`, `previewReceipt`, `updateReceiptStatus`, `calculateReceipt`, `findPendingReceipts`.
- Files: `apps/api/src/receipt/receipt.service.ts`
- Risk: The most complex billing logic in the system — pro-rating, consumption accumulation, balance calculation — has no automated validation. Regressions in billing amounts will go unnoticed.
- Priority: High

**Consumption Service Has Zero Tests:**
- What's not tested: `calculateConsumptionForPeriod`, `calculateCurrentConsumption`, rate application logic.
- Files: `apps/api/src/consumption/consumption.service.ts`
- Risk: Rate calculation (property-specific vs default fallback) and period boundary handling are untested. A regression here produces wrong amounts on every receipt.
- Priority: High

**Contract Termination Service Has Zero Tests:**
- What's not tested: `terminate`, `findByContract`, guarantee/rent refund arithmetic.
- Files: `apps/api/src/contract-termination/contract-termination.service.ts`
- Risk: Financial settlement calculations for departing tenants are unverified. Edge cases (services exceeding rent refund, guarantee fully consumed) are likely to regress.
- Priority: High

**Frontend Pages Have No Tests at All:**
- What's not tested: All React pages under `apps/client/src/pages/`.
- Files: `apps/client/src/pages/`
- Risk: UI workflows (billing period selection, receipt generation, termination form) are exercised only manually. No regression detection for the UI layer.
- Priority: Medium

**Existing Controller Specs Are Smoke Tests Only:**
- What's not tested: Actual controller or service behaviour — only that the class instantiates.
- Files: `apps/api/src/property/property.controller.spec.ts`, `apps/api/src/app.controller.spec.ts`
- Risk: The spec suite passes green while covering near-zero logic.
- Priority: Medium

---

*Concerns audit: 2026-03-09*

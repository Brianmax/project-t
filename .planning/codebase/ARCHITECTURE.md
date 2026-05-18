# Architecture

**Analysis Date:** 2026-03-09

## Pattern Overview

**Overall:** Full-stack monorepo with a domain-driven NestJS REST API backend and a React SPA frontend, communicating over HTTP with JWT authentication.

**Key Characteristics:**

- Backend is NestJS with a module-per-domain pattern; each domain owns its entity, DTOs, controller, service, and module file
- Frontend is a React SPA where each route maps to one page component; all server communication goes through helper functions in `lib/api.ts`
- Authentication uses short-lived JWT access tokens held in-memory plus long-lived refresh tokens in httpOnly cookies
- Schema is managed by TypeORM with `synchronize: true` (auto-migration on startup)
- No shared runtime code between frontend and backend; `packages/` holds only ESLint config, TypeScript config, and a stub UI library

## Layers

**Domain Modules (Backend):**

- Purpose: Encapsulate business logic for one domain entity (property, department, tenant, contract, etc.)
- Location: `apps/api/src/[module-name]/`
- Contains: Entity class, DTOs, controller (routing), service (business logic), module definition
- Depends on: TypeORM `Repository<Entity>`, sibling services injected via NestJS DI
- Used by: `AppModule` which imports all domain modules; controllers are reached via HTTP

**Auth Layer (Backend):**

- Purpose: JWT issuance, validation, refresh, logout, role enforcement
- Location: `apps/api/src/auth/`
- Contains: `AuthController`, `AuthService`, `JwtGuard` (global access guard), `JwtRefreshGuard`, `@Public()` decorator, `@CurrentUser()` decorator, `@Roles()` decorator
- Depends on: `@nestjs/jwt`, `UserModule`, `ConfigService`
- Used by: `AppModule` registers `JwtGuard` as `APP_GUARD`; `AdminModule` uses `RolesGuard`

**Global Guard (Backend):**

- Purpose: Protect all routes by default; opt-out via `@Public()`
- Location: `apps/api/src/auth/guards/jwt.guard.ts`
- Registered as: `{ provide: APP_GUARD, useClass: JwtGuard }` in `apps/api/src/app.module.ts`
- Attaches: Decoded `JwtPayload` to `request.user`

**Cross-Domain Services (Backend):**

- Purpose: Calculations that span multiple domain tables (not a single entity owner)
- Examples:
  - `apps/api/src/consumption/consumption.service.ts` — reads `DepartmentMeter` + `MeterReading` + `Property` to compute utility costs
  - `apps/api/src/receipt/receipt.service.ts` — aggregates contract, payments, extra charges, consumption into a billing receipt
  - `apps/api/src/contract-settlement/contract-settlement.service.ts` — computes end-of-contract financial balance
  - `apps/api/src/contract-termination/contract-termination.service.ts` — persists and resolves contract terminations

**Page Layer (Frontend):**

- Purpose: One component per route; owns local state, data fetching via `useEffect`, and page-specific UI
- Location: `apps/client/src/pages/`
- Depends on: `apiFetch`, `apiPost`, `apiPatch`, `apiDelete` from `lib/api.ts`; shared components from `components/`
- Used by: React Router routes in `apps/client/src/App.tsx`

**Context Layer (Frontend):**

- Purpose: App-wide state shared across the component tree
- Location: `apps/client/src/contexts/`
- Contains: `AuthContext.tsx` — user identity, access token, login/logout/register, silent refresh
- Used by: `ProtectedRoute`, `AdminRoute`, pages that need auth state

**Component Layer (Frontend):**

- Purpose: Reusable UI primitives; not tied to domain data
- Location: `apps/client/src/components/`
- Contains: `Layout`, `Sidebar`, `Modal`, `PageHeader`, `EmptyState`, `Spinner`, `DatePicker`, `ThemeToggle`, `ProtectedRoute`, `AdminRoute`
- Depends on: `lib/styles.ts` for shared Tailwind class strings

## Data Flow

**Authenticated API Request:**

1. Page component calls `apiFetch<T>('/endpoint')` in `apps/client/src/lib/api.ts`
2. `apiFetch` attaches `Authorization: Bearer <accessToken>` header (token stored in module-level variable `_accessToken`)
3. If response is `401` and `_onRefresh` is set, `apiFetch` silently calls `POST /auth/refresh` (httpOnly cookie auto-sent), retries once with new token
4. NestJS `JwtGuard` (global) verifies Bearer token on every non-`@Public()` route; attaches payload to `request.user`
5. Controller receives request, delegates to service
6. Service queries TypeORM repositories, calls sibling services if needed, returns domain object or DTO
7. Controller serializes and returns JSON response

**Receipt Generation Flow:**

1. User selects month/year in `apps/client/src/pages/DepartmentBilling.tsx`
2. Frontend calls `POST /contracts/:id/receipts?month=X&year=Y`
3. `ContractController.issueReceipt()` in `apps/api/src/contract/contract.controller.ts` delegates to `ReceiptService.issueReceipt()`
4. `ReceiptService.calculateReceipt()` in `apps/api/src/receipt/receipt.service.ts`:
   - Loads contract with relations (`tenant`, `department`, `department.property`)
   - Calls `ConsumptionService.calculateConsumptionForPeriod()` for LIGHT and WATER
   - Queries `ExtraCharge` records for the period
   - Queries `Payment` records for the period
   - Assembles `ReceiptItem[]` and totals
5. Receipt saved or updated in DB with status `pending_review`
6. Frontend displays receipt; user can approve/deny via `PATCH /contracts/:id/receipts/status`

**Auth Flow:**

1. User submits login form → `POST /auth/login`
2. `AuthService.login()` validates credentials, issues 15-min access token + 7-day refresh token (hashed in DB, sent as httpOnly cookie)
3. `AuthContext` stores access token in React state; calls `setAccessToken()` to make it available to `apiFetch`
4. On page reload: `AuthProvider` calls `POST /auth/refresh` (cookie sent automatically); on success, applies new access token
5. On logout: `POST /auth/logout` clears cookie, nullifies DB refresh token hash

**State Management:**

- No global client-side state library; each page manages its own state with `useState` + `useEffect`
- Auth state is global via `AuthContext` (React Context)
- Dark mode preference persisted to `localStorage` via `useTheme` hook in `apps/client/src/hooks/useTheme.ts`

## Key Abstractions

**NestJS Domain Module:**

- Purpose: Self-contained vertical slice for one business entity
- Pattern: Each module exports its service if needed by siblings; registers its entity with `TypeOrmModule.forFeature([Entity])`
- Examples: `apps/api/src/property/property.module.ts`, `apps/api/src/contract/contract.module.ts`

**TypeORM Entity:**

- Purpose: Defines table schema and ORM relationships via decorators
- Pattern: `@PrimaryGeneratedColumn('uuid')` for IDs; `@ManyToOne` + explicit FK `@Column` for foreign keys; `@CreateDateColumn`/`@UpdateDateColumn` for audit columns
- Examples: `apps/api/src/contract/entities/contract.entity.ts`, `apps/api/src/receipt/entities/receipt.entity.ts`, `apps/api/src/user/entities/user.entity.ts`

**DTO (Data Transfer Object):**

- Purpose: Validates and shapes incoming request bodies; decorated with `class-validator` annotations
- Pattern: `CreateXxxDto` for creation, `UpdateXxxDto` extends `PartialType(CreateXxxDto)` for updates
- Location: `apps/api/src/[module]/dto/`

**apiFetch / apiPost / apiPatch / apiDelete:**

- Purpose: Centralized HTTP client with auth header injection and 401 silent-refresh retry
- Location: `apps/client/src/lib/api.ts`
- Pattern: Generic typed return `apiFetch<T>(path, options?)` → parses JSON as `T`

**ReceiptStatus Enum:**

- Purpose: Tracks billing receipt lifecycle
- Values: `pending_review` → `approved` or `denied`
- Location: `apps/api/src/receipt/entities/receipt.entity.ts`

**@Public() Decorator:**

- Purpose: Opt specific routes out of the global `JwtGuard`
- Location: `apps/api/src/auth/decorators/public.decorator.ts`
- Usage: Applied to `POST /auth/login`, `POST /auth/register`, `POST /auth/refresh`

## Entry Points

**API Bootstrap:**

- Location: `apps/api/src/main.ts`
- Responsibilities: Creates NestJS app, attaches `cookie-parser`, configures CORS (origin `http://localhost:5173`), registers global `ValidationPipe`, listens on port 3001

**API Root Module:**

- Location: `apps/api/src/app.module.ts`
- Responsibilities: Imports all domain modules, TypeORM global config, ConfigModule; registers `JwtGuard` as global APP_GUARD

**Client Root:**

- Location: `apps/client/src/App.tsx`
- Responsibilities: Wraps app in `BrowserRouter` + `AuthProvider`; declares all React Router routes with `ProtectedRoute` and `AdminRoute` guards

**Client Entry:**

- Location: `apps/client/src/main.tsx` (standard Vite entry)
- Triggers: Mounts `<App />` into DOM

## Error Handling

**Strategy:** Throw-and-catch at service layer; NestJS exception filters handle HTTP serialization

**Patterns:**

- Services throw `NotFoundException` when a required entity is not found; NestJS serializes this to `404`
- Services throw `BadRequestException` for business rule violations (e.g., department not available); serialized to `400`
- Frontend `apiFetch` throws `Error` with response body text on non-OK responses; pages catch errors and set local `error` state string for display
- 401 responses trigger a silent token refresh before re-throwing as `'Session expired'`

## Cross-Cutting Concerns

**Logging:** `console.log` only; no structured logging framework
**Validation:** Global `ValidationPipe` with `{ whitelist: true, transform: true }` on all incoming request bodies via class-validator DTOs
**Authentication:** Global `JwtGuard` on all routes; `@Public()` to opt out; `RolesGuard` + `@Roles('admin')` for admin-only routes in `AdminModule`
**CORS:** Single allowed origin `http://localhost:5173` with credentials; configured in `apps/api/src/main.ts`
**Dark Mode:** CSS custom properties toggled via `.dark` class on `<html>`; managed by `useTheme` hook; sidebar permanently dark

---

_Architecture analysis: 2026-03-09_

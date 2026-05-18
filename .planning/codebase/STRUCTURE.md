# Codebase Structure

**Analysis Date:** 2026-03-09

## Directory Layout

```
project-t/                          # Monorepo root
├── apps/
│   ├── api/                        # NestJS backend (port 3001)
│   │   └── src/
│   │       ├── admin/              # Admin user management endpoints
│   │       ├── auth/               # JWT auth: login, register, refresh, logout
│   │       │   ├── decorators/     # @Public(), @CurrentUser(), @Roles()
│   │       │   ├── dto/            # RegisterDto, LoginDto
│   │       │   └── guards/         # JwtGuard (global), JwtRefreshGuard, RolesGuard
│   │       ├── consumption/        # ConsumptionService (cross-domain calculation)
│   │       ├── contract/           # Rental contracts; also hosts receipt/settlement routes
│   │       │   ├── dto/            # CreateContractDto, UpdateContractDto, UpdateReceiptStatusDto
│   │       │   └── entities/       # contract.entity.ts
│   │       ├── contract-settlement/ # End-of-contract financial settlement calculation
│   │       ├── contract-termination/ # Contract termination records
│   │       ├── department/         # Rental units within a property
│   │       ├── department-meter/   # Utility meters assigned to a department
│   │       ├── extra-charge/       # Ad-hoc charges (cable, cleaning, etc.)
│   │       ├── meter-reading/      # Meter reading log entries
│   │       ├── payment/            # Payment records against a contract
│   │       ├── property/           # Buildings/properties
│   │       ├── property-meter/     # Property-level meters (not per-department)
│   │       ├── receipt/            # Receipt entity and ReceiptService
│   │       ├── seed/               # Database seeding (SeedModule, SeedService)
│   │       ├── tenant/             # Tenant profiles
│   │       ├── user/               # User accounts (auth identity)
│   │       ├── app.controller.ts   # Root health-check controller
│   │       ├── app.module.ts       # Root module; registers all domain modules + global guard
│   │       ├── app.service.ts      # Root service (minimal)
│   │       └── main.ts             # Bootstrap: CORS, cookie-parser, ValidationPipe, listen
│   │   └── test/                   # E2E test directory
│   │
│   └── client/                     # React + Vite frontend (port 5173)
│       └── src/
│           ├── assets/             # Static assets (images, icons)
│           ├── components/         # Shared UI components (not page-specific)
│           ├── contexts/           # React context providers
│           │   └── AuthContext.tsx # Auth state, login/logout, silent refresh
│           ├── hooks/              # Custom React hooks
│           │   └── useTheme.ts    # Dark mode toggle with localStorage persistence
│           ├── lib/
│           │   ├── api.ts         # HTTP client: apiFetch, apiPost, apiPatch, apiDelete
│           │   └── styles.ts      # Shared Tailwind class strings (inputCls, btnPrimaryCls, etc.)
│           ├── pages/             # One component per route
│           │   └── admin/         # Admin-only pages
│           ├── App.tsx            # Router setup, AuthProvider wrapping, route declarations
│           ├── index.css          # Global styles, Tailwind v4 imports, CSS custom properties
│           └── main.tsx           # Vite entry point
│
├── packages/
│   ├── eslint-config/             # Shared ESLint configuration
│   ├── typescript-config/         # Shared tsconfig base files
│   └── ui/                        # Stub shared UI component library (button, card, code)
│       └── src/
│
├── .agents/                       # Agent skills/references (not runtime code)
├── .husky/                        # Git hooks (commit-msg for commitlint)
├── .planning/                     # GSD planning documents
│   └── codebase/                  # Codebase analysis documents
├── docker-compose.yml             # PostgreSQL container definition
├── turbo.json                     # Turborepo pipeline configuration
├── package.json                   # Root workspace manifest
└── CLAUDE.md                      # Project instructions for Claude Code
```

## Directory Purposes

**`apps/api/src/[module-name]/`:**

- Purpose: One NestJS module per domain entity
- Contains: `[name].module.ts`, `[name].controller.ts`, `[name].service.ts`, `entities/[name].entity.ts`, `dto/` with `create-[name].dto.ts` and `update-[name].dto.ts`
- Key modules: `contract`, `property`, `department`, `tenant`, `receipt`, `consumption`, `auth`, `user`

**`apps/api/src/auth/`:**

- Purpose: All authentication concerns: login, register, refresh, logout, guards, decorators
- Key files: `auth.controller.ts`, `auth.service.ts`, `guards/jwt.guard.ts`, `guards/jwt-refresh.guard.ts`, `guards/roles.guard.ts`, `decorators/public.decorator.ts`, `decorators/current-user.decorator.ts`

**`apps/api/src/receipt/`:**

- Purpose: Receipt entity and `ReceiptService`; note that receipt-related HTTP routes live in `ContractController` (`apps/api/src/contract/contract.controller.ts`)
- Key files: `receipt.service.ts`, `entities/receipt.entity.ts`, `receipt.module.ts`

**`apps/api/src/consumption/`:**

- Purpose: Cross-domain service only; no controller or entity; calculates utility consumption from meter readings
- Key files: `consumption.service.ts`, `consumption.module.ts`

**`apps/api/src/seed/`:**

- Purpose: Populates the database with initial data for development/testing
- Key files: `seed.service.ts`, `seed.module.ts`

**`apps/client/src/pages/`:**

- Purpose: One component per application route; responsible for data fetching, local state, and rendering
- Key files: `Dashboard.tsx`, `DepartmentBilling.tsx`, `DepartmentDashboard.tsx`, `MeterReadings.tsx`, `Properties.tsx`, `PropertyDetail.tsx`, `Contracts.tsx`, `Tenants.tsx`, `TenantDashboard.tsx`, `Meters.tsx`, `Payments.tsx`, `Login.tsx`, `Register.tsx`
- Admin pages: `pages/admin/AdminUsers.tsx`

**`apps/client/src/components/`:**

- Purpose: Reusable layout and UI primitives shared across pages
- Key files: `Layout.tsx` (sidebar + outlet), `Sidebar.tsx`, `Modal.tsx`, `PageHeader.tsx`, `EmptyState.tsx`, `Spinner.tsx`, `DatePicker.tsx`, `ThemeToggle.tsx`, `ProtectedRoute.tsx`, `AdminRoute.tsx`

**`apps/client/src/lib/`:**

- Purpose: Utilities used across pages and components
- `api.ts`: HTTP client with auth header injection, 401 retry, and `apiFetch`/`apiPost`/`apiPatch`/`apiDelete` helpers
- `styles.ts`: Shared Tailwind className strings (`inputCls`, `labelCls`, `btnPrimaryCls`, `btnSecondaryCls`, `btnDangerCls`, `cardCls`)

**`packages/ui/src/`:**

- Purpose: Placeholder shared component library (button, card, code) — minimally used; apps define their own components
- Not currently imported by either app in practice

## Key File Locations

**Entry Points:**

- `apps/api/src/main.ts`: API bootstrap
- `apps/api/src/app.module.ts`: Root NestJS module (all imports + global guard)
- `apps/client/src/main.tsx`: Vite/React entry
- `apps/client/src/App.tsx`: Router and all route declarations

**Authentication (Backend):**

- `apps/api/src/auth/auth.controller.ts`: `/auth/*` endpoints
- `apps/api/src/auth/auth.service.ts`: Token issuance, hashing, refresh logic
- `apps/api/src/auth/guards/jwt.guard.ts`: Global route guard
- `apps/api/src/auth/guards/jwt-refresh.guard.ts`: Refresh-only guard
- `apps/api/src/auth/guards/roles.guard.ts`: Role-based access control
- `apps/api/src/auth/decorators/public.decorator.ts`: `@Public()` opt-out
- `apps/api/src/auth/decorators/current-user.decorator.ts`: `@CurrentUser()` param decorator

**Authentication (Frontend):**

- `apps/client/src/contexts/AuthContext.tsx`: Auth state, silent refresh, login/logout
- `apps/client/src/components/ProtectedRoute.tsx`: Redirects unauthenticated users to `/login`
- `apps/client/src/components/AdminRoute.tsx`: Redirects non-admin users to `/`

**HTTP Client:**

- `apps/client/src/lib/api.ts`: All API calls go through this file

**Billing Core:**

- `apps/api/src/receipt/receipt.service.ts`: Receipt calculation and persistence
- `apps/api/src/consumption/consumption.service.ts`: Utility consumption calculation
- `apps/api/src/contract/contract.controller.ts`: Receipt, settlement, and termination endpoints (alongside CRUD)

**Styling:**

- `apps/client/src/index.css`: CSS custom properties, Tailwind v4 setup, semantic color tokens, dark mode overrides
- `apps/client/src/lib/styles.ts`: Shared className constants

**Database:**

- `docker-compose.yml`: PostgreSQL container (port 5432, database `property_management`, user/password credentials)
- `apps/api/src/app.module.ts`: TypeORM connection config (inline, reads from `process.env`)

**Config Packages:**

- `packages/typescript-config/`: Base `tsconfig.json` files extended by each app
- `packages/eslint-config/`: Shared ESLint rules

## Naming Conventions

**Backend Files:**

- Module files: `[domain-name].module.ts` (e.g., `contract.module.ts`)
- Controllers: `[domain-name].controller.ts`
- Services: `[domain-name].service.ts`
- Entities: `[domain-name].entity.ts` inside `entities/` subdirectory
- DTOs: `create-[domain-name].dto.ts`, `update-[domain-name].dto.ts` inside `dto/` subdirectory
- Guards: `[name].guard.ts` inside `guards/` subdirectory
- Decorators: `[name].decorator.ts` inside `decorators/` subdirectory
- Multi-word domains use kebab-case: `contract-settlement`, `department-meter`, `extra-charge`

**Frontend Files:**

- Pages: PascalCase matching the route concept (`DepartmentBilling.tsx`, `MeterReadings.tsx`)
- Components: PascalCase (`PageHeader.tsx`, `EmptyState.tsx`)
- Hooks: camelCase with `use` prefix (`useTheme.ts`)
- Lib utilities: camelCase (`api.ts`, `styles.ts`)
- Context files: PascalCase with `Context` suffix (`AuthContext.tsx`)

**Classes and Enums:**

- TypeORM entities: PascalCase class names matching domain (e.g., `Contract`, `ReceiptEntity`)
- Enums: PascalCase enum name, UPPER_SNAKE_CASE values (e.g., `ContractStatus.ACTIVE`, `ReceiptStatus.PENDING_REVIEW`)
- NestJS modules/controllers/services: PascalCase with suffix (`ContractModule`, `ContractController`, `ContractService`)

**Database Columns:**

- Entity properties: camelCase
- Explicit column names: snake_case via `@Column({ name: 'tenant_id' })`

## Where to Add New Code

**New Domain Module (Backend):**

1. Create `apps/api/src/[module-name]/` directory
2. Add `[name].entity.ts` in `entities/` subdirectory — TypeORM entity with `@PrimaryGeneratedColumn('uuid')`
3. Add `create-[name].dto.ts` and `update-[name].dto.ts` in `dto/` subdirectory
4. Add `[name].service.ts` — inject `Repository<Entity>` via `@InjectRepository`
5. Add `[name].controller.ts` — delegate to service; use standard REST decorators
6. Add `[name].module.ts` — import `TypeOrmModule.forFeature([Entity])`, register controller + service; export service if needed by other modules
7. Import the new module in `apps/api/src/app.module.ts`

**New Frontend Page:**

1. Create `apps/client/src/pages/[PageName].tsx`
2. Add route in `apps/client/src/App.tsx` inside the `<Route element={<ProtectedRoute />}>` block (or `<AdminRoute>` if admin-only)
3. Fetch data with `apiFetch<T>('/endpoint')` inside `useEffect`; manage with `useState`

**New Shared UI Component:**

- Place in `apps/client/src/components/[ComponentName].tsx`
- Use semantic tokens from `index.css` (e.g., `bg-surface`, `text-on-surface`) and shared class strings from `apps/client/src/lib/styles.ts`

**New API Endpoint on Existing Domain:**

- Add method to the domain's service file (`apps/api/src/[module]/[name].service.ts`)
- Add route handler to the domain's controller (`apps/api/src/[module]/[name].controller.ts`)
- If input needs validation, add or extend a DTO in `apps/api/src/[module]/dto/`

**New Custom Hook (Frontend):**

- Place in `apps/client/src/hooks/[useHookName].ts`

**New Utility Styles:**

- Add exported `const` to `apps/client/src/lib/styles.ts`

## Special Directories

**`.planning/codebase/`:**

- Purpose: GSD codebase analysis documents (this file)
- Generated: By GSD mapping agents
- Committed: Yes

**`.agents/`:**

- Purpose: Agent skill definitions and reference documents
- Generated: No (checked in)
- Committed: Yes

**`apps/api/dist/`:**

- Purpose: Compiled TypeScript output for the API
- Generated: Yes (`npm run build`)
- Committed: No (in `.gitignore`)

**`apps/api/src/seed/`:**

- Purpose: One-time database seeding for development; not a migration system
- Committed: Yes

---

_Structure analysis: 2026-03-09_

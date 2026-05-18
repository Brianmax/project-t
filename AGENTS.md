# AGENTS.md

## Setup prerequisites

- PostgreSQL must be running before starting the API: `docker-compose up -d`
- Then `npm install && npm run dev` from repo root
- Backend: http://localhost:3001 | Frontend: http://localhost:5173

## Key commands

```bash
npm run dev                          # Start all apps
npx turbo dev --filter=client        # Frontend only
npx turbo dev --filter=api           # Backend only

npm run build                        # Build all (tsc + vite for client, nest build for api)
npm run check-types                  # Typecheck all packages via turbo
npm run lint                         # Lint all packages via turbo
npm run format                       # Prettier write across monorepo

cd apps/api && npm test              # Backend unit tests (Jest)
cd apps/api && npm run test:e2e      # Backend E2E tests
cd apps/api && npx tsc --noEmit      # Backend typecheck only
```

There is no frontend test runner configured. Only `apps/api` has tests.

## Monorepo structure

- **`apps/api`** — NestJS backend (TypeORM + PostgreSQL). Entry: `src/main.ts`, modules wired in `src/app.module.ts`
- **`apps/client`** — React 19 + Vite + Tailwind CSS v4. Entry: `src/App.tsx`, routing defined there
- **`packages/ui`** — `@repo/ui` shared React component library (subpath exports: `@repo/ui/button` etc.)
- **`packages/eslint-config`** / **`packages/typescript-config`** — shared configs

## Non-obvious architecture facts

- **Auth**: JWT-based with access + refresh tokens. `JwtGuard` is a global guard on every route. Frontend stores access token in memory, refresh token in httpOnly cookie. Auto-refresh on 401 is handled in `apps/client/src/lib/api.ts`.
- **Database**: TypeORM `synchronize: true` — schema auto-updates on restart. No migration files. Connection hardcoded in `app.module.ts` (not from `.env`). DB credentials match `docker-compose.yml`.
- **Backend port**: 3001 (set in `main.ts`), NOT 3000 despite what INSTRUCTIONS.md says.
- **Admin seed**: `apps/api/.env` sets `ADMIN_EMAIL` / `ADMIN_PASSWORD` for initial seed via `SeedModule`.
- **CORS**: API only allows origin `http://localhost:5173` with credentials.

## Styling conventions

- Tailwind CSS v4 with `@tailwindcss/vite` plugin (no `tailwind.config` file)
- Semantic color tokens defined in `apps/client/src/index.css` — use tokens like `bg-surface`, `text-on-surface`, NOT raw colors
- Reusable className strings in `apps/client/src/lib/styles.ts` (`inputCls`, `btnPrimaryCls`, `cardCls`, etc.) — prefer these over duplicating classes
- Dark mode: `.dark` class on `<html>`, managed by `useTheme` hook. Sidebar always dark.
- Icons: Lucide React only

## Business logic gotchas

- **Month indexing**: Backend uses 1-indexed months (January = 1). JavaScript Date months are 0-indexed — be careful at the boundary.
- **Receipt generation**: Uses `calculateConsumptionForPeriod()` (date-range based), NOT `calculateCurrentConsumption()` (latest two readings only). This is a common source of bugs.
- **Receipt workflow**: `pending_review` → approved/denied. Receipts without an `id` are previews.
- **Consumption formula**: `lastReading - firstReading` within the billing period date range.

## Git conventions

- Conventional commits enforced via Husky + commitlint (`@commitlint/config-conventional`)
- Pre-commit hook runs `npm test` (backend tests only — no frontend tests exist)
- Format: `feat:`, `fix:`, `chore:`, etc.

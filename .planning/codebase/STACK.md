# Technology Stack

**Analysis Date:** 2026-03-09

## Languages

**Primary:**

- TypeScript 5.9.x - Used in both frontend (`apps/client`) and backend (`apps/api`)

**Secondary:**

- JavaScript (CommonJS) - Used only for config files (e.g., `commitlint.config.js`)

## Runtime

**Environment:**

- Node.js >=18 (enforced via `engines` field in root `package.json`)

**Package Manager:**

- npm 10.9.2 (enforced via `packageManager` field)
- Lockfile: `package-lock.json` present at root

## Monorepo

**Orchestrator:**

- Turborepo 2.8.3 - Task runner for build, dev, lint, test, check-types
- Config: `turbo.json` at root
- Workspaces: `apps/*` and `packages/*` via npm workspaces

**Shared Packages:**

- `packages/eslint-config` - Shared ESLint configuration
- `packages/typescript-config` - Shared tsconfig bases (`base.json`, `nextjs.json`, `react-library.json`)
- `packages/ui` - Shared UI component library (not yet heavily used)

## Frameworks

**Backend (`apps/api`):**

- NestJS 11.x - Core framework (`@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`)
- NestJS Config 4.x (`@nestjs/config`) - Environment variable management via `.env`
- NestJS JWT 11.x (`@nestjs/jwt`) - JWT token signing and verification
- Express (via `@nestjs/platform-express`) - Underlying HTTP server

**Frontend (`apps/client`):**

- React 19.2 - UI framework
- React Router DOM 7.13 - Client-side routing
- Vite 7.x - Dev server and build tool
- Tailwind CSS 4.x (via `@tailwindcss/vite`) - Utility-first CSS, integrated as Vite plugin

**Testing (Backend):**

- Jest 30.x - Test runner
- ts-jest 29.x - TypeScript transformer for Jest
- Supertest 7.x - HTTP integration testing
- `@nestjs/testing` - NestJS testing utilities

## Key Dependencies

**Critical (Backend):**

- `typeorm` 0.3.28 - ORM for database access
- `@nestjs/typeorm` 11.x - NestJS TypeORM integration
- `pg` 8.18 - PostgreSQL driver
- `bcrypt` 6.x - Password and refresh-token hashing
- `class-validator` 0.14 - DTO validation decorators
- `class-transformer` 0.5 - DTO transformation
- `cookie-parser` 1.4.7 - Parses `refreshToken` httpOnly cookie

**Critical (Frontend):**

- `lucide-react` 0.563 - Icon library
- `react-day-picker` 9.13 - Date picker component (for billing period selection)

**Dev Tooling (Root):**

- Prettier 3.7 - Code formatting
- Husky 9.x - Git hooks
- `@commitlint/cli` + `@commitlint/config-conventional` 20.x - Commit message linting

## Configuration

**Environment:**

- Backend reads from `apps/api/.env` (loaded by `@nestjs/config` / `ConfigModule.forRoot({ isGlobal: true })`)
- Required env vars: `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`, `PORT` (optional, defaults to 3001)
- Database credentials are hardcoded in `apps/api/src/app.module.ts` (host: localhost, port: 5432, user/password, db: property_management) — not from env

**Build:**

- Backend: `nest build` → outputs to `dist/`
- Frontend: `tsc -b && vite build` → outputs to `dist/`
- Root orchestration: `turbo run build` runs both

**TypeScript:**

- Root: `tsconfig.json` delegates to workspaces
- Backend: `apps/api/tsconfig.json` + `tsconfig.build.json`
- Frontend: `apps/client/tsconfig.json` + `tsconfig.app.json` + `tsconfig.node.json`

**Linting:**

- ESLint 9.x in both apps + shared config in `packages/eslint-config`
- `eslint-plugin-react-hooks` and `eslint-plugin-react-refresh` for frontend
- `typescript-eslint` + `eslint-config-prettier` for both apps

**Formatting:**

- Prettier 3.x — runs from root via `npm run format` on `**/*.{ts,tsx,md}`

**Git Hooks:**

- Husky: `prepare` script installs hooks
- commitlint enforces conventional commit format (e.g., `feat:`, `fix:`, `chore:`)

## Platform Requirements

**Development:**

- Node.js >=18
- PostgreSQL running on localhost:5432, database `property_management`, user `user`, password `password`
- Frontend dev server: http://localhost:5173
- Backend dev server: http://localhost:3001

**Production:**

- No deployment platform configured
- Backend: `node dist/main` (standard Node process)
- Frontend: Static build output from Vite

---

_Stack analysis: 2026-03-09_

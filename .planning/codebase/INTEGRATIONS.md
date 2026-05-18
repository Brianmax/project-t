# External Integrations

**Analysis Date:** 2026-03-09

## APIs & External Services

**None detected beyond own backend.**

- The frontend communicates only with the local NestJS API at `http://localhost:3001`
- No third-party REST APIs, GraphQL APIs, or SaaS platforms are integrated
- No payment processors (Stripe, PayPal, etc.)
- No messaging services (SendGrid, Twilio, etc.) — WhatsApp sharing referenced in business docs but not implemented in code

## Data Storage

**Databases:**

- PostgreSQL
  - Host: `localhost:5432` (hardcoded in `apps/api/src/app.module.ts`)
  - Database name: `property_management`
  - Credentials: username `user`, password `password` (hardcoded — not from env)
  - Client/ORM: TypeORM 0.3.28 via `@nestjs/typeorm`
  - Schema sync: `synchronize: true` — TypeORM auto-updates schema on startup (not safe for production)
  - Driver: `pg` 8.18

**File Storage:**

- Local filesystem only — no cloud file storage (no S3, GCS, Azure Blob, etc.)

**Caching:**

- None — no Redis, Memcached, or in-memory cache layer

## Authentication & Identity

**Auth Provider:**

- Custom JWT-based auth (no third-party provider — no Auth0, Clerk, Firebase Auth, etc.)
  - Implementation: `apps/api/src/auth/` module
  - Access token: Short-lived JWT (15 min default), signed with `JWT_ACCESS_SECRET`
  - Refresh token: Long-lived JWT (7 days), signed with `JWT_REFRESH_SECRET`, stored as bcrypt hash in `users.refreshTokenHash` column
  - Delivery: Access token returned in JSON response body; refresh token set as `httpOnly SameSite=Lax` cookie
  - Guard: `JwtGuard` registered globally as `APP_GUARD` in `apps/api/src/app.module.ts`
  - Public routes: Use `@Public()` decorator from `apps/api/src/auth/decorators/public.decorator.ts`
  - Roles: `RolesGuard` in `apps/api/src/auth/guards/roles.guard.ts`; roles: `user` | `admin`
  - User approval workflow: New users have status `pending` until an admin approves them

**Frontend Auth:**

- `AuthContext` in `apps/client/src/contexts/AuthContext.tsx` holds `user`, `accessToken`, `isLoading`
- Silent refresh on app mount via `POST /auth/refresh` (cookie auto-sent by browser)
- `setAccessToken()` / `setRefreshCallback()` in `apps/client/src/lib/api.ts` avoid circular imports
- 401 retry logic in `apiFetch()`: calls `_onRefresh()`, retries once with new token

**Password Hashing:**

- bcrypt 6.x (`apps/api/src/auth/auth.service.ts`) — 10 salt rounds

## Monitoring & Observability

**Error Tracking:**

- None — no Sentry, Datadog, New Relic, or similar

**Logs:**

- `console.log` in `apps/api/src/main.ts` logs startup URL
- NestJS default logger for framework-level events (no custom logger configured)
- No structured logging or log aggregation

## CI/CD & Deployment

**Hosting:**

- No deployment platform configured (no Vercel, Railway, Fly.io, Heroku, AWS, etc.)

**CI Pipeline:**

- None — no GitHub Actions, CircleCI, or other CI configured

**Containerization:**

- `docker-compose.yml` present at root (contents not read — may define PostgreSQL service)

## Environment Configuration

**Required env vars (backend — `apps/api/.env`):**

- `JWT_ACCESS_SECRET` - Secret for signing access tokens
- `JWT_REFRESH_SECRET` - Secret for signing refresh tokens
- `JWT_ACCESS_EXPIRES_IN` - Access token TTL (e.g., `15m`)
- `JWT_REFRESH_EXPIRES_IN` - Refresh token TTL (e.g., `7d`)
- `PORT` - Optional, defaults to `3001`

**Database credentials:**

- Hardcoded in `apps/api/src/app.module.ts` — not configurable via env

**Secrets location:**

- `apps/api/.env` — not committed to git (standard .gitignore exclusion)

## Webhooks & Callbacks

**Incoming:**

- None — no external service sends webhooks to this app

**Outgoing:**

- None — app does not send webhook requests to external services

## Frontend-to-Backend Communication

**Protocol:** REST over HTTP

- Base URL hardcoded: `http://localhost:3001` in `apps/client/src/lib/api.ts` and `apps/client/src/contexts/AuthContext.tsx`
- CORS: Configured in `apps/api/src/main.ts` to allow `http://localhost:5173` with credentials
- Helpers: `apiFetch<T>()`, `apiPost<T>()`, `apiPatch<T>()`, `apiDelete()` in `apps/client/src/lib/api.ts`
- Auth header: `Authorization: Bearer <accessToken>` on all non-public requests

---

_Integration audit: 2026-03-09_

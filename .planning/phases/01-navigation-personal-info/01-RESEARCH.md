# Phase 1: Navigation + Personal Info - Research

**Researched:** 2026-03-11
**Domain:** React Router navigation + NestJS entity extension (brownfield)
**Confidence:** HIGH

---

<phase_requirements>

## Phase Requirements

| ID      | Description                                                               | Research Support                                                                   |
| ------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| NAV-01  | User can click a tenant card in `/tenants` and navigate to `/tenants/:id` | Route exists; Tenants.tsx rows need `<Link>` wrapping                              |
| PERS-01 | Tenant detail page displays tenant's full name                            | `TenantDashboard.tsx` already renders `tenant.name`                                |
| PERS-02 | Tenant detail page displays tenant's phone number                         | `TenantDashboard.tsx` already renders `tenant.phone` (optional)                    |
| PERS-03 | Tenant detail page displays tenant's email address                        | `TenantDashboard.tsx` already renders `tenant.email`                               |
| PERS-04 | Tenant detail page displays tenant's document/ID number                   | `documentId` field does NOT exist on Tenant entity — must add to entity + DTO + UI |

</phase_requirements>

---

## Summary

This phase is largely a brownfield completion task. The route `tenants/:id` pointing to `TenantDashboard.tsx` already exists in `App.tsx` and is already wrapped inside `<ProtectedRoute>` via the parent `<Route element={<ProtectedRoute />}>`. The detail page already fetches `GET /tenants/:id` (confirmed in the backend `TenantController`) and renders the tenant's name, email, and phone. The backend `GET /tenants/:id` is fully implemented and throws `NotFoundException` on missing IDs.

The two genuine gaps are: (1) the tenant list in `Tenants.tsx` renders rows as plain `<tr>` elements with no navigation — clicking a tenant does nothing; (2) the `Tenant` entity has no `documentId` column, so PERS-04 cannot be satisfied without a backend + frontend schema extension.

**Primary recommendation:** Wire up `<Link>` navigation on tenant rows in `Tenants.tsx`, then add a `documentId` field to the Tenant entity (TypeORM `synchronize: true` handles the migration) and expose it in the DTO and UI.

---

## Standard Stack

### Core

| Library          | Version                | Purpose                                    | Why Standard                                                        |
| ---------------- | ---------------------- | ------------------------------------------ | ------------------------------------------------------------------- |
| react-router-dom | v7 (already installed) | Client-side routing, `useParams`, `<Link>` | Already used throughout the app                                     |
| TypeORM          | already in use         | Entity definition, auto-sync schema        | Project ORM; `synchronize: true` removes need for manual migrations |
| class-validator  | already in use         | DTO validation decorators                  | Global `ValidationPipe` enforces it on all POST/PATCH bodies        |

### Supporting

| Library      | Version           | Purpose                                    | When to Use                               |
| ------------ | ----------------- | ------------------------------------------ | ----------------------------------------- |
| lucide-react | already installed | Icons (e.g., `IdCard` for document number) | Already used for all icons in the project |

### Alternatives Considered

None — stack is fixed by existing codebase. No new libraries required for this phase.

**Installation:**

No new packages needed.

---

## Architecture Patterns

### Recommended Project Structure

No new directories needed. Changes land in:

```
apps/
  api/src/tenant/
    entities/tenant.entity.ts    # Add documentId column
    dto/create-tenant.dto.ts     # Add documentId field
    dto/update-tenant.dto.ts     # Inherits via PartialType
  client/src/
    pages/
      Tenants.tsx                # Add <Link> to row cells
      TenantDashboard.tsx        # Add documentId display
```

### Pattern 1: Row Navigation via React Router Link

**What:** Wrap the name cell (or the entire row) with `<Link to={/tenants/${t.id}}>` using `react-router-dom`. The existing row is a `<tr>` — the cleanest approach for table rows is to make the name cell a `<Link>` or add an explicit "Ver" link column.

**When to use:** Whenever a list item should navigate to a detail page without a full page reload.

**Example:**

```typescript
// Source: apps/client/src/pages/Tenants.tsx (current pattern to modify)
// Current: plain <tr> with no navigation
// Target: name cell becomes a Link
<td className="px-5 py-3.5">
  <Link to={`/tenants/${t.id}`} className="flex items-center gap-3 hover:underline">
    <div className="w-8 h-8 rounded-full bg-gradient-to-br ...">
      {t.name.charAt(0).toUpperCase()}
    </div>
    <span className="font-medium text-on-surface">{t.name}</span>
  </Link>
</td>
```

**Note on whole-row linking:** Making an entire `<tr>` a link is not valid HTML. Use a `<Link>` inside the name cell, or add `cursor-pointer` + `onClick` with `useNavigate`. The `<Link>` in the name cell is the simplest approach consistent with existing `Link` usage in this file (which already imports and uses `Link` from `react-router-dom`).

### Pattern 2: Adding a Nullable Column to a TypeORM Entity

**What:** Add a new `@Column({ nullable: true })` property to the entity. Because `synchronize: true` is enabled, the PostgreSQL column is added on next app startup with no manual migration needed.

**When to use:** Any time a new optional field is added to an existing entity in this project.

**Example:**

```typescript
// Source: apps/api/src/tenant/entities/tenant.entity.ts
@Entity()
export class Tenant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  email: string;

  @Column({ nullable: true })
  phone: string;

  // New field for PERS-04
  @Column({ nullable: true })
  documentId: string;
}
```

### Pattern 3: DTO Extension with class-validator

**What:** Add an optional validated field to `CreateTenantDto`. `UpdateTenantDto` inherits via `PartialType` so no change needed there.

**Example:**

```typescript
// Source: apps/api/src/tenant/dto/create-tenant.dto.ts
export class CreateTenantDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsOptional()
  phone?: string;

  // New field for PERS-04
  @IsString()
  @IsOptional()
  documentId?: string;
}
```

### Pattern 4: Displaying an Optional Field in TenantDashboard

**What:** Read `tenant.documentId` from the already-fetched `apiFetch<Tenant>('/tenants/:id')` response and render it conditionally. If `null`, show a dash or skip the row.

**When to use:** The `Tenant` TypeScript interface in `TenantDashboard.tsx` must be updated to include `documentId?: string`.

### Anti-Patterns to Avoid

- **Making the entire `<tr>` a `<Link>`:** Not valid HTML; use a link inside the name cell instead.
- **Creating a new backend endpoint:** `GET /tenants/:id` already exists and returns all tenant fields. No new endpoint is needed for Phase 1.
- **Adding a `documentId` column as `NOT NULL`:** Existing tenants have no document ID. The column must be `nullable: true` or existing rows will fail to load/save after schema sync.
- **Duplicating the `Tenant` interface:** Both `Tenants.tsx` and `TenantDashboard.tsx` define their own `interface Tenant`. Do not create a shared type file — that is out of scope and inconsistent with this codebase's pattern of local per-page interfaces.

---

## Don't Hand-Roll

| Problem                   | Don't Build                              | Use Instead                                      | Why                                                                        |
| ------------------------- | ---------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------- |
| Client-side navigation    | Custom `window.location.href` assignment | `<Link to="...">` from react-router-dom          | Prevents full page reload; consistent with every other nav link in the app |
| Database schema migration | Manual SQL `ALTER TABLE`                 | TypeORM `synchronize: true`                      | Already configured; runs on startup automatically                          |
| Route protection          | Custom auth check in page component      | Existing `<ProtectedRoute>` wrapper in `App.tsx` | Route is already inside `<ProtectedRoute>` — nothing to add                |

---

## Common Pitfalls

### Pitfall 1: Route Already Exists — Do Not Duplicate

**What goes wrong:** Creating a new `<Route path="tenants/:id" ...>` in App.tsx when one already exists (line 39), causing a routing conflict or the new route being silently ignored.

**Why it happens:** Not reading App.tsx before adding routes.

**How to avoid:** Verify `App.tsx` before any route changes. The route `tenants/:id` → `TenantDashboard` is already declared and inside `ProtectedRoute`.

**Warning signs:** Two routes with the same path in App.tsx.

### Pitfall 2: documentId Column Non-Nullable on Existing Data

**What goes wrong:** Adding `@Column()` (without `nullable: true`) for `documentId` causes TypeORM `synchronize` to add a `NOT NULL` column. Any existing rows with NULL documentId cause a database error or the sync fails.

**Why it happens:** Forgetting that production/dev database already has tenant rows without this field.

**How to avoid:** Always use `@Column({ nullable: true })` for any new field added to an entity that already has data.

**Warning signs:** Database error on API startup after adding the column.

### Pitfall 3: Tenant Interface Out of Sync

**What goes wrong:** `TenantDashboard.tsx` has a local `interface Tenant` that does not include `documentId`. After the backend returns the field, it is ignored by TypeScript and not rendered.

**Why it happens:** Each page defines its own interface — when the entity gains a new field, every page interface that uses Tenant needs updating.

**How to avoid:** Update the `interface Tenant` in both `Tenants.tsx` (for the create form) and `TenantDashboard.tsx` (for the display).

**Warning signs:** TypeScript error when accessing `tenant.documentId`, or field is `undefined` at runtime despite backend returning it.

### Pitfall 4: Tenants.tsx Property ID Number Coercion Bug

**What goes wrong:** `Tenants.tsx` line 75 has `d.property?.id === Number(selectedPropertyId)` — comparing a UUID string to `Number(...)` will always be `false` (returns `NaN`). This is a pre-existing bug unrelated to Phase 1 but may cause confusion when reading the file.

**Why it happens:** Pre-existing code that was written before UUIDs replaced numeric IDs.

**How to avoid:** Do not touch this line; it is out of scope for Phase 1. Note it as a pre-existing bug for future cleanup.

---

## Code Examples

### Fetch Tenant by ID (already implemented)

```typescript
// Source: apps/api/src/tenant/tenant.service.ts
async findOne(id: string): Promise<Tenant> {
  const tenant = await this.tenantRepository.findOne({ where: { id } });
  if (!tenant) {
    throw new NotFoundException(`Tenant with ID "${id}" not found`);
  }
  return tenant;
}
```

### Frontend fetch in TenantDashboard (already implemented)

```typescript
// Source: apps/client/src/pages/TenantDashboard.tsx
const { id } = useParams<{ id: string }>();
const tenantId = id!;

useEffect(() => {
  apiFetch<Tenant>(`/tenants/${tenantId}`)
    .then(setTenant)
    .catch((err) => setError('Error al cargar datos del inquilino'))
    .finally(() => setLoading(false));
}, [tenantId]);
```

Note: `TenantDashboard.tsx` currently fetches 4 endpoints in `Promise.all`. For Phase 1, only the tenant fetch is strictly needed, but it is acceptable to leave the full `Promise.all` as-is since those other sections already exist in the page.

### React Router Link in table row (pattern to apply)

```typescript
// Source: react-router-dom docs / existing usage in Tenants.tsx
import { Link } from 'react-router-dom';

// Inside the <tbody> map:
<td className="px-5 py-3.5">
  <Link to={`/tenants/${t.id}`} className="flex items-center gap-3">
    {/* avatar + name */}
  </Link>
</td>
```

---

## State of the Art

| Old Approach          | Current Approach            | Impact                                                        |
| --------------------- | --------------------------- | ------------------------------------------------------------- |
| Numeric IDs in routes | UUID strings in routes      | `useParams()` returns string directly; no `parseInt()` needed |
| Manual SQL migrations | TypeORM `synchronize: true` | New columns added automatically on restart                    |

**Pre-existing issues (not blocking Phase 1):**

- `Tenants.tsx` line 75: `d.property?.id === Number(selectedPropertyId)` — UUID vs number comparison bug. Pre-existing, out of scope.

---

## Open Questions

1. **Does `documentId` need to be added to the tenant creation form in Tenants.tsx?**
   - What we know: PERS-04 requires the field to be _displayed_ on the detail page. REQUIREMENTS.md says editing is out of scope.
   - What's unclear: Whether the "Nuevo Inquilino" modal form in Tenants.tsx should also accept `documentId` on creation. The requirements only say "display" not "create/edit".
   - Recommendation: Phase 1 planner should add `documentId` as an optional input to the creation modal for practical usability (otherwise tenants can never get a documentId without a separate edit flow), but treat it as a discretionary decision since the spec only mandates display.

2. **TenantDashboard.tsx already has significant content — does Phase 1 replace or extend it?**
   - What we know: The file already renders contract info, payments, and pending receipts — these are Phase 2 and 3 requirements, already implemented.
   - What's unclear: Whether to strip those sections out (they depend on data fetches that work) or leave them.
   - Recommendation: Leave the existing content intact. It works correctly and removing it would be destructive. Phase 1 work is additive: (a) add NAV link in Tenants.tsx, (b) add documentId field backend + frontend.

---

## Validation Architecture

### Test Framework

| Property           | Value                                                 |
| ------------------ | ----------------------------------------------------- |
| Framework          | Jest + NestJS testing utilities (apps/api)            |
| Config file        | `apps/api/package.json` (jest config inline)          |
| Quick run command  | `cd apps/api && npm test -- --testPathPattern=tenant` |
| Full suite command | `cd apps/api && npm test`                             |

### Phase Requirements → Test Map

| Req ID  | Behavior                                        | Test Type                                       | Automated Command                                     | File Exists?      |
| ------- | ----------------------------------------------- | ----------------------------------------------- | ----------------------------------------------------- | ----------------- |
| NAV-01  | Clicking tenant row navigates to `/tenants/:id` | manual (React Router navigation)                | n/a — browser test                                    | N/A — manual only |
| PERS-01 | Detail page displays tenant name                | manual (visual verification)                    | n/a                                                   | N/A — manual only |
| PERS-02 | Detail page displays phone                      | manual (visual verification)                    | n/a                                                   | N/A — manual only |
| PERS-03 | Detail page displays email                      | manual (visual verification)                    | n/a                                                   | N/A — manual only |
| PERS-04 | Detail page displays documentId                 | unit — TenantService.findOne returns documentId | `cd apps/api && npm test -- --testPathPattern=tenant` | ❌ Wave 0         |

### Sampling Rate

- **Per task commit:** `cd apps/api && npm test -- --testPathPattern=tenant`
- **Per wave merge:** `cd apps/api && npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `apps/api/src/tenant/tenant.service.spec.ts` — covers PERS-04 (documentId returned by findOne); check if file exists, create if not

---

## Sources

### Primary (HIGH confidence)

- Direct source read: `apps/api/src/tenant/entities/tenant.entity.ts` — confirmed no `documentId` field
- Direct source read: `apps/api/src/tenant/tenant.controller.ts` — confirmed `GET /tenants/:id` exists
- Direct source read: `apps/api/src/tenant/tenant.service.ts` — confirmed `findOne` with `NotFoundException`
- Direct source read: `apps/client/src/App.tsx` — confirmed `tenants/:id` route exists, inside ProtectedRoute
- Direct source read: `apps/client/src/pages/Tenants.tsx` — confirmed rows are plain `<tr>`, no navigation
- Direct source read: `apps/client/src/pages/TenantDashboard.tsx` — confirmed page already renders name/email/phone, no documentId
- Direct source read: `apps/api/src/tenant/dto/create-tenant.dto.ts` — confirmed no documentId field
- Direct source read: `apps/client/src/components/ProtectedRoute.tsx` — confirmed pattern: renders `<Outlet />` or redirects

### Secondary (MEDIUM confidence)

- `.planning/STATE.md` — confirms backend `GET /tenants/:id` existence was flagged as "unconfirmed" (now confirmed HIGH)

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all libraries directly verified from source files
- Architecture: HIGH — all patterns verified from existing page and component files
- Pitfalls: HIGH — documentId nullable requirement is a direct inference from entity inspection; route duplication risk is directly observable from App.tsx

**Research date:** 2026-03-11
**Valid until:** 2026-04-10 (stable codebase, no fast-moving dependencies)

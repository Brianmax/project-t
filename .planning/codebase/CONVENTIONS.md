# Coding Conventions

**Analysis Date:** 2026-03-09

## Naming Patterns

**Files:**
- Backend modules: `kebab-case` matching domain name (e.g., `contract.service.ts`, `contract.controller.ts`, `contract.module.ts`)
- Backend entities: `kebab-case` in an `entities/` subdirectory (e.g., `entities/contract.entity.ts`)
- Backend DTOs: `kebab-case` in a `dto/` subdirectory (e.g., `dto/create-contract.dto.ts`, `dto/update-contract.dto.ts`)
- Frontend pages: `PascalCase.tsx` (e.g., `DepartmentBilling.tsx`, `TenantDashboard.tsx`)
- Frontend components: `PascalCase.tsx` (e.g., `Modal.tsx`, `PageHeader.tsx`, `EmptyState.tsx`)
- Frontend hooks: `camelCase.ts` prefixed with `use` (e.g., `useTheme.ts`)
- Frontend context files: `PascalCase.tsx` suffixed with `Context` (e.g., `AuthContext.tsx`)

**Functions:**
- Backend service methods: camelCase, verb-first (e.g., `findAll`, `findOne`, `create`, `update`, `remove`)
- Frontend: camelCase for helpers, PascalCase for component functions (e.g., `apiFetch`, `apiPost`, `decodeJwtPayload`)
- Default exports for pages/components: `export default function ComponentName`

**Variables:**
- camelCase throughout (TypeScript standard)
- Boolean flags use `is`/`has` prefix (e.g., `isAvailable`, `isLoading`, `isValid`)
- Loading states: `[entity]Loading` (e.g., `receiptLoading`, `terminationLoading`)
- Submitting states: `submitting`

**Types / Interfaces:**
- PascalCase for interfaces and types
- Frontend interfaces defined at top of page file under a `// ── Types ──` section comment
- Backend uses both `interface` and `class` for DTOs; DTOs are `class` decorated with `class-validator`
- Enums are PascalCase name, UPPER_SNAKE_CASE values (e.g., `ContractStatus.ACTIVE`, `MeterType.LIGHT`)

## Code Style

**Formatting:**
- Tool: Prettier
- Single quotes for strings: `singleQuote: true`
- Trailing commas everywhere: `trailingComma: "all"`
- End of line: auto (platform-neutral)

**Linting:**
- Backend: `typescript-eslint` recommendedTypeChecked + `eslint-plugin-prettier/recommended`
  - `@typescript-eslint/no-explicit-any` is turned **off**
  - `@typescript-eslint/no-floating-promises` is **warn**
  - `@typescript-eslint/no-unsafe-argument` is **warn**
- Frontend: `typescript-eslint` recommended + `eslint-plugin-react-hooks` + `eslint-plugin-react-refresh`

## Import Organization

**Backend (NestJS modules):**
1. NestJS framework imports (`@nestjs/common`, `@nestjs/typeorm`, etc.)
2. TypeORM imports (`typeorm`)
3. Local entity/DTO/service imports (relative paths)

**Frontend (React components):**
1. React and React Router (`react`, `react-router-dom`)
2. Third-party libraries (e.g., `lucide-react`)
3. Local API helpers (`../lib/api`)
4. Local components (`../components/...`)
5. Local shared styles (`../lib/styles`)

**Path Aliases:**
- None configured; all imports use relative paths

## Error Handling

**Backend patterns:**
- Throw NestJS built-in HTTP exceptions directly from service methods:
  - `NotFoundException` for missing resources: `throw new NotFoundException(\`Contract with ID "${id}" not found\`)`
  - `BadRequestException` for validation/business rule failures: `throw new BadRequestException(\`Department "${name}" is not available\`)`
  - `UnauthorizedException` and `ForbiddenException` in auth service
- Guard-level auth errors use `UnauthorizedException` / `ForbiddenException`
- No custom exception filters observed

**Frontend patterns:**
- `apiFetch` throws `Error` with server response text on non-OK responses
- Pages catch errors in `.catch(() => setError('Message'))` inside `useEffect`
- Error state displayed inline in the page, not via global error boundaries
- 401 responses trigger silent token refresh with a single retry in `lib/api.ts`

## Logging

**Framework:** None — no structured logger configured; NestJS default logger is used implicitly

## Comments

**Section dividers** — used in larger frontend files to separate logical blocks:
```typescript
// ── Types ──────────────────────────────────────────────
// ── Component ──────────────────────────────────────────
```

**Inline clarification comments** on entity columns to explain business meaning:
```typescript
@Column({ type: 'decimal', precision: 10, scale: 2 })
advancePayment: number; // Represents one month's rent upfront
```

**JSDoc/TSDoc:** Not used.

## Function Design

**Size:** Service methods are focused — one method per CRUD operation or domain action. No service method exceeds ~30 lines.

**Parameters:** Controller methods receive decorated params (`@Param`, `@Body`, `@Query`). Services receive plain typed values.

**Return Values:**
- Backend services return entity types or custom interfaces wrapped in `Promise<T>`
- `remove` methods return `Promise<void>` with `@HttpCode(HttpStatus.NO_CONTENT)` on controller
- Frontend API helpers are generic: `apiFetch<T>(...): Promise<T>`

## Module Design

**Backend (NestJS):**
- Every domain module registers its entities, exports its service
- `@Injectable()` on all services, `@Controller('route-name')` on controllers
- TypeORM repositories injected via `@InjectRepository(Entity)`
- Cross-module dependencies injected via constructor (DI), never imported directly

**Frontend:**
- Shared reusable Tailwind class strings live in `apps/client/src/lib/styles.ts` (exported as named constants: `inputCls`, `btnPrimaryCls`, `btnSecondaryCls`, `btnDangerCls`, `cardCls`, `labelCls`)
- No barrel `index.ts` files — direct relative imports to each file
- Context providers (`AuthContext.tsx`) export both the provider component and a typed hook
- Page-local interfaces are defined at the top of each page file, not shared

## TypeORM Entity Patterns

- `@PrimaryGeneratedColumn('uuid')` for all primary keys (UUID string)
- Foreign key columns carry both the relation (`@ManyToOne`) and the raw FK column with explicit `name`:
  ```typescript
  @ManyToOne(() => Tenant, (tenant) => tenant.id)
  tenant: Tenant;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;
  ```
- Decimal money columns always use `{ type: 'decimal', precision: 10, scale: 2 }`
- Enums defined as TypeScript `enum` and referenced in `@Column({ type: 'enum', enum: EnumName })`
- `synchronize: true` is active — schema auto-updates from entity definitions

## DTO Patterns

- DTOs are `class` (not `interface`) to support `class-validator` decorators
- `CreateXxxDto` has all required fields decorated with validators
- `UpdateXxxDto` extends `PartialType(CreateXxxDto)` via `@nestjs/mapped-types`
- `class-validator` decorators used: `@IsString()`, `@IsNumber()`, `@IsUUID()`, `@IsDateString()`, `@IsNotEmpty()`, `@IsOptional()`, `@IsEnum()`

---

*Convention analysis: 2026-03-09*

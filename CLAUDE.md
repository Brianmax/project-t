# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PropManager - A property management system for managing rental properties, tenants, contracts, meter readings, billing, and receipts. Built as a full-stack TypeScript monorepo using Turborepo.

## Technology Stack

- **Monorepo**: Turborepo with npm workspaces
- **Frontend** (`apps/client`): React 19 + TypeScript + Vite + React Router + Tailwind CSS v4
- **Backend** (`apps/api`): NestJS + TypeORM + PostgreSQL
- **Icons**: Lucide React

## Development Commands

```bash
# Install dependencies (from root)
npm install

# Start all apps in development mode
npm run dev

# Start specific app
npx turbo dev --filter=client  # Frontend only (http://localhost:5173)
npx turbo dev --filter=api     # Backend only (http://localhost:3001)

# Build all apps
npm run build

# Type checking
npm run check-types
npx tsc --noEmit  # Frontend only (run from root or apps/client)
cd apps/api && npx tsc --noEmit  # Backend only

# Linting
npm run lint

# Formatting
npm run format

# Backend tests
cd apps/api
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:cov      # With coverage
npm run test:e2e      # E2E tests
```

## Architecture

### Backend (NestJS + TypeORM)

**Module Structure** - Each domain module follows NestJS conventions:
```
src/[module-name]/
  ├── entities/[name].entity.ts    # TypeORM entity
  ├── dto/                         # Data transfer objects
  ├── [name].controller.ts         # REST endpoints
  ├── [name].service.ts            # Business logic
  └── [name].module.ts             # Module definition
```

**Core Domain Modules:**
- `property` - Properties (buildings)
- `department` - Individual rental units within properties
- `tenant` - Tenants (renters)
- `contract` - Rental contracts linking tenants to departments
- `department-meter` / `property-meter` - Utility meters (water/electricity)
- `meter-reading` - Meter reading entries with dates
- `consumption` - Calculates utility consumption and costs from readings
- `extra-charge` - Additional charges (cable, cleaning, etc.)
- `receipt` - Monthly billing receipts with approval workflow
- `payment` - Payment records
- `contract-settlement` - Final settlement calculations when contracts end

**Database:**
- PostgreSQL (localhost:5432)
- Database: `property_management`
- Default credentials: user/password
- TypeORM sync enabled (synchronize: true) - schema auto-updates

### Frontend (React + TypeScript)

**File Structure:**
```
src/
  ├── components/         # Shared UI components
  │   ├── Layout.tsx     # Main layout with sidebar
  │   ├── Sidebar.tsx    # Navigation sidebar
  │   ├── Modal.tsx      # Modal dialog
  │   ├── PageHeader.tsx # Page headers with actions
  │   ├── EmptyState.tsx # Empty state placeholder
  │   └── Spinner.tsx    # Loading spinner
  ├── pages/             # Page components (one per route)
  ├── hooks/             # Custom React hooks
  │   └── useTheme.ts   # Dark mode theme management
  ├── lib/
  │   ├── api.ts        # API client functions
  │   └── styles.ts     # Shared Tailwind class constants
  ├── App.tsx           # Root component with routing
  └── index.css         # Global styles + Tailwind + theme tokens
```

**Routing** - React Router v7 with nested routes in App.tsx

**API Communication:**
- Backend runs on `http://localhost:3001`
- Helper functions: `apiFetch()` and `apiPost()` in `lib/api.ts`

### Styling System

**Tailwind CSS v4** with semantic color tokens for dark mode support:

**Semantic tokens** (defined in `index.css`):
- Surfaces: `surface`, `surface-alt`, `surface-raised`
- Borders: `border`, `border-light`, `border-ring`
- Text: `on-surface`, `on-surface-strong`, `on-surface-medium`, `on-surface-muted`, `on-surface-faint`, `on-surface-ghost`
- Status colors: `status-danger-*`, `status-warning-*`, `status-success-*`
- Shadow: `shadow`

**Dark mode:**
- Toggled via `.dark` class on `<html>` element
- Managed by `useTheme` hook with localStorage persistence
- Theme toggle button in sidebar

**Shared styles** - Reusable className strings in `lib/styles.ts` (e.g., `inputCls`, `btnPrimaryCls`, `cardCls`)

## Key Business Logic

### Receipt Generation & Billing

**Period-specific calculations** - Receipts calculate consumption for a specific month/year:
- `receipt.service.ts` uses `calculateConsumptionForPeriod()` to get meter readings within the billing period
- NOT `calculateCurrentConsumption()` which only gets latest 2 readings

**Receipt workflow:**
1. User selects month/year in DepartmentBilling page
2. "Generar Recibo" button calls `POST /contract/:id/receipt?month=X&year=Y`
3. Backend calculates: rent + period-specific water cost + period-specific electricity cost + extra charges
4. Receipt created with status `pending_review`
5. Receipt can be approved/denied before sending via WhatsApp

**Important:** When month/year changes in UI:
- Receipt state is cleared if no receipt exists for that period
- Existing receipts are loaded by checking `receipt.id` (previews have no ID)
- Consumption display uses receipt data if available, falls back to current consumption

### Meter Reading & Consumption

**Consumption calculation:**
- `calculateConsumptionForPeriod(departmentId, meterType, startDate, endDate)` finds readings within date range
- Calculates: `consumption = lastReading - firstReading`
- Applies property-specific or default rates (`lightCostPerUnit`, `waterCostPerUnit`)

**Meter types:**
- `LIGHT` (electricity)
- `WATER`

### Dark Mode

Theme persisted to localStorage. Supports:
- Manual toggle via sidebar button
- System preference detection (`prefers-color-scheme`)
- CSS custom properties override in `.dark` selector

## Common Patterns

### API Endpoints

Backend follows REST conventions:
```
GET    /[resource]           # List all
GET    /[resource]/:id       # Get one
POST   /[resource]           # Create
PATCH  /[resource]/:id       # Update
DELETE /[resource]/:id       # Delete
```

### Frontend Data Fetching

```typescript
// In pages, use useEffect + useState:
useEffect(() => {
  apiFetch<Type[]>('/endpoint')
    .then(setData)
    .catch(() => setError('Message'))
    .finally(() => setLoading(false));
}, []);
```

### TypeORM Entities

- Use decorators: `@Entity()`, `@Column()`, `@PrimaryGeneratedColumn()`, `@ManyToOne()`, etc.
- Relationships use `relations: ['property', 'tenant']` in queries
- Date columns: `@CreateDateColumn()`, `@UpdateDateColumn()`

## Important Notes

- **Month indexing:** JavaScript months are 0-indexed, but UI displays 1-indexed (January = 1). Backend uses 1-indexed months.
- **Receipt regeneration:** Clicking "Regenerar Recibo" recalculates with current readings and extra charges for that period.
- **Sidebar colors:** Sidebar has permanent dark theme (not affected by semantic tokens).
- **Git hooks:** Husky + commitlint configured for conventional commits.

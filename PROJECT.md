# PropManager — Project Overview

## What is PropManager?

PropManager is a **property management system** for landlords who own one or more residential buildings.
It handles the full lifecycle of a rental unit: from listing a vacant apartment and signing a tenant,
through monthly utility billing, to closing the contract and settling deposits.

The system is built as a full-stack TypeScript monorepo:

| Layer | Stack |
|-------|-------|
| Frontend | React 19, Vite, React Router v7, Tailwind CSS v4 |
| Backend | NestJS, TypeORM |
| Database | PostgreSQL |
| Auth | JWT (access token 15 min + httpOnly refresh cookie 7 days) |
| Ports | Client → `5173`, API → `3001` |

---

## Domain Model

The core domain follows this hierarchy:

```
Property (building)
└── Department (individual rental unit)
    ├── DepartmentMeter  ──►  MeterReading
    └── Contract
        ├── Tenant
        ├── ExtraCharge
        ├── Payment
        ├── Receipt
        └── ContractTermination
```

### Property
A physical building. Stores the electricity and water rates used for billing.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | |
| name | string | |
| address | string | |
| lightCostPerUnit | decimal | Default 0.25 (S/ per unit) |
| waterCostPerUnit | decimal | Default 0.15 (S/ per unit) |

### Department
An individual rental unit inside a property (an apartment, room, etc.).

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | |
| name | string | e.g. "Apt 3B" |
| floor | number | |
| numberOfRooms | number | |
| propertyId | UUID | FK → Property |
| isAvailable | boolean | True = no active contract |

### Tenant
A person renting a unit.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | |
| name | string | |
| email | string | Unique |
| phone | string | Nullable |

### Contract
Links one Tenant to one Department for a date range.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | |
| startDate | date | |
| endDate | date | Expected end of lease |
| rentAmount | decimal | Monthly rent |
| advancePayment | decimal | One month's rent paid upfront; applied to last month |
| guaranteeDeposit | decimal | Security deposit; returned at end minus deductions |
| tenantId | UUID | FK → Tenant |
| departmentId | UUID | FK → Department |
| status | enum | `active` \| `terminated` |

Creating a contract marks the department as unavailable.
Deleting or terminating a contract marks it available again.

### DepartmentMeter / PropertyMeter
Each unit has its own meters for electricity and water.
A meter has a `meterType` of `LIGHT` or `WATER`.

### MeterReading
A reading taken from a DepartmentMeter at a specific date.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | |
| reading | decimal | Current meter value |
| date | date | Date reading was taken |
| departmentMeterId | UUID | FK → DepartmentMeter |
| billingMonth | int | 1–12, auto-calculated |
| billingYear | int | e.g. 2026, auto-calculated |

**Billing period calculation rule:** If the reading date is the 1st of a month, the reading belongs to the previous month's billing period (end of previous cycle). Otherwise it belongs to the current month.

### ExtraCharge
An additional charge for a specific contract in a specific month.
Examples: cable TV, cleaning service, parking.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | |
| description | string | |
| amount | decimal | |
| month | int | 1–12 |
| year | int | |
| contractId | UUID | FK → Contract |

### Payment
A payment received from a tenant.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | |
| amount | decimal | |
| date | date | |
| description | string | Nullable |
| type | enum | `rent` \| `water` \| `light` \| `advance` \| `guarantee` \| `refund` |
| contractId | UUID | FK → Contract |

### Receipt
A generated monthly billing invoice. This is the main billing artifact.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | |
| contractId | UUID | FK → Contract |
| month | int | 1–12 |
| year | int | |
| startDay | int | Nullable; set when prorating for partial month |
| endDay | int | Nullable |
| tenantName | string | Snapshot at time of generation |
| departmentName | string | Snapshot |
| propertyAddress | string | Snapshot |
| period | string | Display string, e.g. "March 2026" or "1–15 March 2026" |
| items | JSONB `{ description, amount }[]` | Line items: rent, light, water, extras |
| totalDue | decimal | Sum of items |
| totalPayments | decimal | Payments recorded for this period |
| balance | decimal | `totalPayments - totalDue` (negative = tenant owes) |
| status | enum | `pending_review` \| `approved` \| `denied` |

A receipt can be regenerated (it overwrites the existing one for that contract+month+year).
Only `approved` receipts are eligible to be sent to the tenant.

### ContractTermination
Created when a contract is formally closed. Stores the audit record and financial settlement.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | |
| contractId | UUID | FK → Contract (unique — one per contract) |
| expectedDepartureDate | date | Snapshot of `contract.endDate` |
| actualDepartureDate | date | User-entered; may differ from expected |
| apartmentCondition | text | Nullable; qualitative note |
| advanceApplied | decimal | Snapshot of `contract.advancePayment`; covers last month's rent |
| guaranteeDeposit | decimal | Snapshot of `contract.guaranteeDeposit` |
| guaranteeDeduction | decimal | User-entered; damages, cleaning, overdue, etc. |
| guaranteeReturn | decimal | `max(0, guaranteeDeposit - guaranteeDeduction)` |

Terminating a contract sets `contract.status = 'terminated'` and `department.isAvailable = true`.

### User (Authentication)
An account that can log in to PropManager.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | |
| email | string | Unique |
| passwordHash | string | bcrypt |
| refreshTokenHash | string | Nullable; bcrypt hash of current refresh token |
| role | enum | `user` \| `admin` |
| status | enum | `pending` \| `approved` \| `rejected` |
| isActive | boolean | |

New users register with status `pending` and cannot log in until an admin approves them.

---

## Key Business Workflows

### 1 — Setting Up a Property

1. Create a **Property** (name, address, utility rates).
2. Create one or more **Departments** inside it.
   - During creation, optionally provide `initialWaterReading` / `initialElectricityReading`.
   - The system auto-creates the corresponding **DepartmentMeter** and an initial **MeterReading**.

### 2 — Onboarding a Tenant

1. Create a **Tenant** (name, email, phone).
2. Create a **Contract** linking the tenant to a department.
   - Set `rentAmount`, `advancePayment`, `guaranteeDeposit`, `startDate`, `endDate`.
   - Department `isAvailable` flips to `false`.

### 3 — Monthly Billing Cycle

1. At the end of each month, **enter meter readings** for each department.
   - Billing month/year is auto-calculated from the reading date.
2. Open the **DepartmentBilling** page for the department:
   - Select the billing month/year.
   - The page shows a running total: rent + light cost + water cost + extra charges.
   - Optionally add **ExtraCharges** (cable, cleaning, etc.).
3. Click **Generar Recibo** → the backend:
   - Calls `calculateConsumptionForPeriod()` to find readings tagged to that month/year.
   - Calculates `consumption = lastReading - firstReading`, then `cost = consumption × rate`.
   - Fetches payments made within the period.
   - Saves a **Receipt** with all line items and a balance.
4. Review the receipt in the modal. **Approve** or **Deny** it.
5. (Future) Send the approved receipt to the tenant via WhatsApp.

### 4 — Prorating Rent for Partial Month

On the **DepartmentBilling** page, click "Indicar salida anticipada":
- Enter the departure **day** (e.g. 15).
- Optionally check "Prorratear alquiler" to prorate rent as `(days / daysInMonth) × rentAmount`.
- The receipt will cover only days 1–`endDay` of that month.

### 5 — Contract Termination

Still on the DepartmentBilling page, inside the departure panel:
- Enter the **actual departure date** (pre-filled with `contract.endDate`).
- Optionally describe the **apartment condition**.
- Enter any **guarantee deduction** (damages, unpaid charges, etc.).
- The page shows the computed **amount to return**: `max(0, deposit - deduction)`.
- The **advance payment** is always noted as covering the last month's rent.
- Click **Confirmar cierre de contrato** → `POST /contracts/:id/termination`.
  - Contract status becomes `terminated`.
  - Department becomes available.
  - Panel switches to a read-only summary with a "Contrato cerrado" badge.
  - A red banner appears at the top of the page.
  - Billing and charge actions are disabled.

On page reload, the termination record is fetched automatically and the panel re-opens in read-only mode.

### 6 — User Registration & Admin Approval

1. User registers at `/register` (status = `pending`).
2. An admin visits `/admin/users` and approves the account.
3. User can now log in and access the system.

---

## Consumption Calculation (important detail)

The service has two methods:

| Method | When used | How |
|--------|-----------|-----|
| `calculateConsumptionForPeriod(departmentId, type, month, year)` | Receipt generation | Finds all readings whose `billingMonth/Year` match; uses `last - first` |
| `calculateCurrentConsumption(departmentId)` | Live display on dashboard | Fetches the two most recent readings; uses `last - first` |

When generating a receipt, **always** use the period-specific method. The current-consumption method is only for dashboards.

Rates are taken from `property.lightCostPerUnit` / `property.waterCostPerUnit`. Defaults are 0.25 and 0.15 (S/ per unit).

---

## API Route Reference

### Auth
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | Public | Register (status = pending) |
| POST | `/auth/login` | Public | Login → access token + refresh cookie |
| POST | `/auth/refresh` | Public | Silent refresh (uses httpOnly cookie) |
| POST | `/auth/logout` | JWT | Clear tokens |
| GET | `/auth/me` | JWT | Get current user |

### Admin
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/admin/users` | Admin | List all users |
| PATCH | `/admin/users/:id/approve` | Admin | Approve pending user |
| PATCH | `/admin/users/:id/reject` | Admin | Reject pending user |

### Properties
| Method | Path | Description |
|--------|------|-------------|
| POST | `/properties` | Create |
| GET | `/properties` | List all |
| GET | `/properties/:id` | Get one |
| GET | `/properties/:id/departments` | Departments in property |
| GET | `/properties/:id/tenants` | Tenants in property |
| PATCH | `/properties/:id` | Update |
| DELETE | `/properties/:id` | Delete (cascades) |

### Departments
| Method | Path | Description |
|--------|------|-------------|
| POST | `/departments` | Create (with optional initial readings) |
| GET | `/departments` | List all |
| GET | `/departments/:id` | Get one |
| GET | `/departments/:id/consumption` | Current consumption (light + water) |
| PATCH | `/departments/:id` | Update |
| DELETE | `/departments/:id` | Delete |

### Tenants
| Method | Path | Description |
|--------|------|-------------|
| POST | `/tenants` | Create |
| GET | `/tenants` | List all |
| GET | `/tenants/:id` | Get one |
| PATCH | `/tenants/:id` | Update |
| DELETE | `/tenants/:id` | Delete |

### Contracts
| Method | Path | Description |
|--------|------|-------------|
| POST | `/contracts` | Create (marks dept unavailable) |
| GET | `/contracts` | List (filter: `?departmentId=`) |
| GET | `/contracts/:id` | Get one |
| PATCH | `/contracts/:id` | Update |
| DELETE | `/contracts/:id` | Delete (marks dept available) |
| GET | `/contracts/receipts/pending` | Approved receipts with negative balance |
| GET | `/contracts/:id/receipts?month=&year=` | Preview receipt (no save) |
| POST | `/contracts/:id/receipts?month=&year=[&startDay=&endDay=&prorateRent=]` | Generate/save receipt |
| PATCH | `/contracts/:id/receipts/status?month=&year=` | Approve \| Deny receipt |
| GET | `/contracts/:id/settlement?actualEndDate=` | Final settlement calculation |
| POST | `/contracts/:id/termination` | Terminate contract |
| GET | `/contracts/:id/termination` | Get termination record (null if none) |

### Meter Readings
| Method | Path | Description |
|--------|------|-------------|
| POST | `/meter-readings` | Create reading (billingMonth/Year auto-calculated) |
| GET | `/meter-readings` | List all |
| GET | `/meter-readings/:id` | Get one |
| PATCH | `/meter-readings/:id` | Update |
| DELETE | `/meter-readings/:id` | Delete |

### Extra Charges
| Method | Path | Description |
|--------|------|-------------|
| POST | `/extra-charges` | Create |
| GET | `/extra-charges` | List (filter: `?contractId=&month=&year=`) |
| DELETE | `/extra-charges/:id` | Delete |

### Payments
| Method | Path | Description |
|--------|------|-------------|
| POST | `/payments` | Create |
| GET | `/payments` | List all |
| GET | `/payments/:id` | Get one |
| PATCH | `/payments/:id` | Update |
| DELETE | `/payments/:id` | Delete |

---

## Frontend Pages

| Route | Page | Purpose |
|-------|------|---------|
| `/login` | Login.tsx | Email + password form |
| `/register` | Register.tsx | Self-registration (pending approval) |
| `/` | Dashboard.tsx | Summary stats: counts of properties, depts, tenants, contracts, payments |
| `/properties` | Properties.tsx | List/create properties; set utility rates |
| `/properties/:id` | PropertyDetail.tsx | Departments and tenants for one property |
| `/departments` | Departments.tsx | List/create departments with initial meter readings |
| `/departments/:id` | DepartmentDashboard.tsx | Unit detail, active contract, current consumption |
| `/departments/:id/billing` | DepartmentBilling.tsx | Full billing UI (see below) |
| `/tenants` | Tenants.tsx | List/create tenants |
| `/tenants/:id` | TenantDashboard.tsx | Tenant info and contract history |
| `/contracts` | Contracts.tsx | List/create contracts |
| `/meters` | Meters.tsx | List property and department meters |
| `/readings` | MeterReadings.tsx | Enter and view meter readings |
| `/payments` | Payments.tsx | Record and view payments |
| `/admin/users` | AdminUsers.tsx | Approve/reject user registrations (admin only) |

### DepartmentBilling.tsx — Detailed Behaviour

This is the most complex page. It:

1. Loads department, current contract, consumption, extra charges, and existing receipt for the selected period.
2. Fetches any existing **ContractTermination** — if found, auto-opens the departure panel in read-only mode.
3. Lets the user switch the billing **month/year**; all data reloads.
4. Shows a **Billing Summary** card: rent + light + water + extra charges + total.
   - Consumption figures come from the saved receipt if one exists; otherwise from current consumption.
5. Has an **Add Extra Charge** form (hidden if contract is terminated).
6. Has a **Generate Receipt** button (hidden if terminated).
7. Inside the receipt modal: line items, balance, Approve / Deny buttons, and (future) Send WhatsApp.
8. Has an "Indicar salida anticipada" button that expands a departure panel containing:
   - Billing day / prorate controls (for partial-month receipt generation).
   - A "Cierre de contrato" section with the termination form or read-only summary.

---

## Authentication Flow

```
Register → pending status → admin approves → can login
Login → { accessToken (15 min) } + httpOnly cookie (refresh token, 7 days)
Every request → Bearer: <accessToken> header
401 received → apiFetch retries once after calling POST /auth/refresh
Page load → AuthContext calls POST /auth/refresh silently (cookie auto-sent)
Logout → clears accessToken in state + POST /auth/logout clears cookie
```

**Guards:**
- `JwtGuard` is the global `APP_GUARD` — all routes protected by default.
- `@Public()` decorator opts out (register, login, refresh).
- `@Roles('admin')` restricts to admin users.

---

## Important Implementation Details

- **Month indexing:** Backend and UI both use 1-indexed months (January = 1). JavaScript `Date.getMonth()` returns 0-indexed — always add 1 when passing to the API.
- **Decimal columns:** TypeORM returns decimal columns as strings. Always wrap with `Number(...)` before arithmetic.
- **Receipt regeneration:** `POST /contracts/:id/receipts` upserts — it overwrites the existing receipt for that month/year. Changing extra charges or meter readings and regenerating is the intended workflow.
- **Cascade deletes:** Deleting a Property cascades to all its Departments, which cascade to Contracts, Receipts, Payments, ExtraCharges, ContractTerminations, and MeterReadings.
- **Termination uniqueness:** `contractTermination.contractId` has a unique constraint — only one termination per contract. A second `POST /contracts/:id/termination` returns `409 Conflict`.
- **Department availability:** Managed automatically. Creating a contract → `isAvailable = false`. Deleting a contract or terminating it → `isAvailable = true`.
- **Sidebar theme:** The sidebar always uses a dark theme regardless of the global dark/light mode setting.
- **Dark mode:** Toggled via `.dark` class on `<html>`, persisted to localStorage, managed by `useTheme` hook.

---

## Technology Decisions & Rationale

| Decision | Reason |
|----------|--------|
| TypeORM `synchronize: true` | Schema auto-updates during development; no migration files needed |
| httpOnly SameSite=Lax refresh cookie | Prevents XSS from stealing the long-lived token |
| Access token in React state (not localStorage) | Avoids XSS token theft; token lost on page close (refresh cookie re-issues it) |
| `@Public()` opt-out guard | Secure by default; less error-prone than opt-in |
| JSONB `items` on Receipt | Receipt is a point-in-time snapshot; denormalized so historical receipts are never affected by rate/name changes |
| `billingMonth/Year` on MeterReading | Decouples reading date from billing period; readings taken on the 1st are attributed to the previous month |

---

## Pending / Planned Features

- **WhatsApp sending** (noted as TODO in `DepartmentBilling.tsx`): send approved receipts via Twilio + BullMQ message queue.
- **Contract Settlement view**: `GET /contracts/:id/settlement` is implemented in the backend but not yet surfaced in a dedicated UI page.
- **Seed data**: `SeedModule` exists in the backend for populating demo data.

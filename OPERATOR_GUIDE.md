# PropManager — Operator's Guide

> This guide is for the **landlord, property administrator, or any non-technical operator** who runs PropManager day-to-day. It walks through every recurring workflow as a step-by-step recipe, names every button and menu in the Spanish UI, calls out constraints ("you can't do X if Y"), and zooms in on **receipt generation** — the heart of the system — so you can verify current behavior and capture proposed changes in the `📝 Adjustments / Notes` blocks under each step.
>
> Companion document for engineers: **`TECHNICAL_REFERENCE.md`**.

---

## Table of Contents

- [A. The Big Picture](#a-the-big-picture)
- [B. Vocabulary in 60 Seconds](#b-vocabulary-in-60-seconds)
- [C. First Login & Account Approval](#c-first-login--account-approval)
- [D. Step-by-Step: Building Out Your Inventory](#d-step-by-step-building-out-your-inventory)
   - [D.1 Create a Property (Building)](#d1-create-a-property-building)
   - [D.2 Create a Department (Apartment / Unit)](#d2-create-a-department-apartment--unit)
   - [D.3 Register a Tenant](#d3-register-a-tenant)
- [E. Step-by-Step: Starting a Rental](#e-step-by-step-starting-a-rental)
   - [E.1 Create a Contract](#e1-create-a-contract)
- [F. Step-by-Step: Utility Metering](#f-step-by-step-utility-metering)
   - [F.1 Add a Meter Reading](#f1-add-a-meter-reading)
   - [F.2 How Consumption Is Calculated](#f2-how-consumption-is-calculated)
- [G. Step-by-Step: Monthly Billing (Receipts)](#g-step-by-step-monthly-billing-receipts)
   - [G.1 Opening the Billing Page](#g1-opening-the-billing-page)
   - [G.2 The Month / Year Selector](#g2-the-month--year-selector)
   - [G.3 The Consumption Panel](#g3-the-consumption-panel)
   - [G.4 The Extra Charges Panel](#g4-the-extra-charges-panel)
   - [G.5 The "Indicar salida anticipada" Toggle](#g5-the-indicar-salida-anticipada-toggle)
   - [G.6 The "Prorratear alquiler" Checkbox](#g6-the-prorratear-alquiler-checkbox)
   - [G.7 The Mora (Late Fee) Generator](#g7-the-mora-late-fee-generator)
   - [G.8 The Preview Pane](#g8-the-preview-pane)
   - [G.9 The "Generar Recibo" Button](#g9-the-generar-recibo-button)
   - [G.10 The Receipt Modal](#g10-the-receipt-modal)
   - [G.11 The "Aprobar" and "Denegar" Actions](#g11-the-aprobar-and-denegar-actions)
   - [G.12 Regenerating a Receipt](#g12-regenerating-a-receipt)
   - [G.13 Receipt Status Machine](#g13-receipt-status-machine)
   - [G.14 Receipt Anatomy — Field by Field](#g14-receipt-anatomy--field-by-field)
   - [G.15 Worked Example: Proration Math](#g15-worked-example-proration-math)
   - [G.16 Worked Example: Day-1 Attribution Rule](#g16-worked-example-day-1-attribution-rule)
   - [G.17 Worked Example: Late-Fee Grace Period](#g17-worked-example-late-fee-grace-period)
   - [G.18 Worked Example: Negative Consumption Fallback](#g18-worked-example-negative-consumption-fallback)
   - [G.19 Failure Scenarios & Recovery](#g19-failure-scenarios--recovery)
- [H. Step-by-Step: Payments](#h-step-by-step-payments)
- [I. Step-by-Step: Extra Charges](#i-step-by-step-extra-charges)
   - [I.1 Manual Extra Charges](#i1-manual-extra-charges)
   - [I.2 Auto Late Fees](#i2-auto-late-fees)
- [J. Step-by-Step: Mid-Month Departures (Prorating)](#j-step-by-step-mid-month-departures-prorating)
- [K. Step-by-Step: Closing a Contract](#k-step-by-step-closing-a-contract)
   - [K.1 Settlement Preview](#k1-settlement-preview)
   - [K.2 Termination (Final Closure)](#k2-termination-final-closure)
- [L. Admin Tasks](#l-admin-tasks)
   - [L.1 Approve or Reject New Users](#l1-approve-or-reject-new-users)
- [M. Constraints Cheat Sheet — "Why Can't I…?"](#m-constraints-cheat-sheet--why-cant-i)
- [N. Frequently Asked Questions](#n-frequently-asked-questions)
- [O. Glossary](#o-glossary)

---

## How to Read the Adjustments Callouts

Every subsection in the receipt-related chapters (consumption, billing, payments, extras, prorating, termination) ends with a callout that looks like this:

> **📝 Adjustments / Notes**
>
> _TODO: capture proposed changes here._

Fill these in with what you want to change about that step. They are intentionally short prompts — write a one-line summary in the block, and capture detail in your team's ticket tracker if needed.

---

## A. The Big Picture

PropManager helps you go from "I own a building with empty apartments" to "I send a fully-priced monthly bill to each tenant and track who has paid". The end-to-end flow is:

```mermaid
flowchart LR
    A[1.Crear<br/>Propiedad] --> B[2.Crear<br/>Departamento]
    B --> C[3.Crear<br/>Inquilino]
    C --> D[4.Crear<br/>Contrato]
    B --> E[5.Lecturas<br/>de medidor]
    D --> F[6.Generar<br/>Recibo del mes]
    E --> F
    F --> G[7.Registrar<br/>Pago del inquilino]
    F --> H[8.Aprobar<br/>o regenerar recibo]
    F -. atrasado .-> I[Generar<br/>Mora]
    G --> J{¿El inquilino se va?}
    J -- sí --> K[9.Liquidación<br/>previa]
    K --> L[10.Terminar<br/>contrato]
    L --> M[Departamento<br/>vuelve disponible]
    J -- no --> F
```

The operator never has to manually compute anything. Once readings and payments are recorded, every receipt is calculated from real data: `monthly rent + electricity consumption × rate + water consumption × rate + extra charges − payments = balance`.

**Tip:** the most common task is generating a monthly receipt. Everything else (creating properties, departments, tenants, contracts) is one-time setup or rare events.

---

## B. Vocabulary in 60 Seconds

| Spanish UI Label | What it means | Real-world example |
| :-- | :-- | :-- |
| **Propiedad** | A whole building you manage. | "Edificio Arequipa 1234". |
| **Departamento** | One rentable unit inside a property. | "Depto 201", "Studio A". |
| **Inquilino** | A real person who rents a department. | "Juan Pérez". |
| **Contrato** | The agreement linking one inquilino to one departamento for a date range. | "Juan rents Depto 201 from 2026-01-01 to 2026-12-31 at S/ 1500/month". |
| **Adelanto** | Upfront one-month rent paid at the start. Refundable at termination. | S/ 1500. |
| **Garantía** | Security deposit. Refundable minus damages/unpaid services. | S/ 1500. |
| **Medidor** | A water or electricity meter on a department. | A single kWh counter on the wall. |
| **Lectura** | A meter reading (a value at a moment in time). | "Day 1 of May: 4520 kWh". |
| **Consumo** | How much the tenant used = current reading − previous reading. | "300 kWh this month". |
| **Recibo** | The monthly bill: rent + water + light + extras − payments = balance. | "April receipt for Depto 201". |
| **Cargo extra** | Any one-off line item: cable, cleaning, repairs. | "Limpieza: S/ 50". |
| **Pago** | Money received from the tenant. | "Tenant paid S/ 1000 on April 5". |
| **Liquidación** | Read-only forecast of "what does the tenant owe / how much do we refund" at checkout. | — |
| **Terminación** | The final, persisted closure of a contract. | — |
| **No pagado / Pagado** | Receipt status. `No pagado` is the default on creation. `Pagado` is set manually by the operator and is terminal (cannot be regenerated or reverted in this version — see [TEN-5](https://linear.app/tenant-aqp/issue/TEN-5)). | — |
| **Indicar salida anticipada** | UI toggle to declare a mid-month departure on the billing page. | — |
| **Prorratear alquiler** | Checkbox that scales the rent by `daysOccupied / daysInMonth`. | — |

---

## C. First Login & Account Approval

### What you need
- A web browser pointed at the PropManager URL (in development: `http://localhost:5173`).
- An email and password.

### Step-by-step

1. Open the app. You'll land on the **Iniciar sesión** screen.
2. If you already have an account → enter email + password → **Iniciar sesión**.
3. If you don't → click **Regístrate**. Fill the form (password must be **at least 8 characters**) and submit. You'll see *"Account pending approval"*.
4. **Wait.** Your account starts as `Pendiente`. An admin must approve you before you can log in. Until then, every login attempt will show *"Your account is pending admin approval"*.
5. Once approved, log in normally.

### What happens behind the scenes
- The system gives your browser a short-lived **access token** (15 min) and a **refresh token** stored as a cookie (7 days). When the short token expires, the system silently issues a new one — you stay logged in without re-entering credentials.
- If you close the tab and reopen it within 7 days, you'll be logged back in automatically.

### Constraints
| Scenario | What happens |
| :-- | :-- |
| You try to log in with the wrong password | Error: *"Invalid credentials"*. |
| Your account is still `Pendiente` | 403: *"pending admin approval"*. Wait for an admin. |
| Your account was `Rechazado` | 403: *"Your account has been rejected"*. Contact the admin. |
| Email already registered | 409: *"Email already in use"*. Recover the password offline. |
| You sign in from a second browser/device | The previous browser is **kicked out** on its next silent refresh. PropManager allows only one active session per account. |

---

## D. Step-by-Step: Building Out Your Inventory

This is what you do **once** when you start using PropManager (or each time you acquire a new building/unit).

### D.1 Create a Property (Building)

A *Propiedad* is the building you own. It owns the **electricity rate** (`S/ / kWh`) and **water rate** (`S/ / m³`) that all its units inherit.

**Where:** sidebar → **Propiedades** → click the **+** button (top of page).

**Fields:**

| Field | Required | Notes |
| :-- | :-- | :-- |
| Nombre | yes | Display name. Example: "Edificio Centro". |
| Dirección | yes | Free-text address. Example: "Av. Arequipa 1234, Lima". |
| Costo por kWh (light) | optional | Default `S/ 0.25`. Used to compute electricity charges. |
| Costo por m³ (water) | optional | Default `S/ 0.15`. Used to compute water charges. |

**Constraints:**
- The two cost fields are **per property**, not per department. Every department in the building uses the same rates.
- You can update the rates later; the change applies to **future receipts only**. Receipts already issued for prior months keep their original amounts because `items[]` was frozen when the receipt was generated.
> **📝 Adjustments / Notes**
>
> _✅ DONE: We should be able to edit the rates in a future._ — Property edit modal added on the PropertyDetail page; supports editing name, address, light rate, and water rate. Forward-only: existing receipts keep their frozen `items[]`.

### D.2 Create a Department (Apartment / Unit)

A *Departamento* is one rentable space inside a property.

**Where:** sidebar → **Departamentos** → **+**. Or from the **Propiedades** detail page click "Agregar departamento".

**Fields:**

| Field | Required | Notes |
| :-- | :-- | :-- |
| Nombre | yes | "Depto 201", "Estudio A". |
| Piso | yes | Numeric floor. |
| Número de habitaciones | yes | Numeric. |
| Propiedad | yes | The building this unit belongs to. |
| Lectura inicial de agua | optional | If you have one already, enter it now so the first receipt has a baseline. |
| Fecha lectura inicial agua | optional | The date that initial water reading was taken. |
| Lectura inicial de luz | optional | Same idea for electricity. |
| Fecha lectura inicial luz | optional | — |
| Mes/año de facturación inicial | optional | Force the initial reading into a specific billing month (used if you are seeding historical data). |

**What happens when you fill the optional readings:**
- The system **automatically creates a water meter and/or an electricity meter** for the department.
- The system **records the initial reading** with the date you provided.
- From now on, every new reading you add for that meter computes consumption against the previous reading.

**Constraints:**
- You can create a department **without** initial readings, but then your first receipt will show no electricity/water charges until you have **two readings** (the system needs two to compute consumption).
- A new department starts as **`isAvailable = true`** ("disponible"). You can immediately attach a contract to it.
- A department can have at most **one water meter and one electricity meter**.

> **📝 Adjustments / Notes**
>
> _✅ DONE: The initial readings should be required, not optional._ — DTO `CreateDepartmentDto` now requires `initialWaterReading`, `initialWaterReadingDate`, `initialElectricityReading`, `initialElectricityReadingDate` (numbers must be ≥ 0). Both frontend forms (`Departments.tsx`, `PropertyDetail.tsx`) mark these inputs as `required`. Service unconditionally creates both meters + initial readings.
>
> _✅ DONE: By default, the dates for initial readings should be the same, but they can be adjusted._ — Both forms now show **two** separate date pickers (water + light), each defaulting to today. The operator can adjust them independently.

### D.3 Register a Tenant

An *Inquilino* is the actual person renting. They are **not** a system user — they don't log in.

**Where:** sidebar → **Inquilinos** → **+**.

**Fields:**

| Field | Required | Notes |
| :-- | :-- | :-- |
| Nombre | yes | Full name. |
| Email | yes | Must be unique across all tenants. |
| Teléfono | optional | Used for contact (future WhatsApp integration). |
| Documento de identidad | optional | DNI / passport number. |

**Constraints:**
- Email is **unique** at the database level. Trying to create a second tenant with the same email will fail.
- Tenants can hold contracts across multiple properties — they are not tied to a single building.
- Deleting a tenant with active contracts is **blocked**: you must terminate or remove the contracts first.

> **📝 Adjustments / Notes**
>
> _✅ DONE: The email should be optional, not required._ — `Tenant.email` is now `nullable: true` (still `unique` for non-null values; multiple NULLs allowed). DTO marks email `@IsOptional()`. Frontend forms (`Tenants.tsx`, `PropertyDetail.tsx`, `TenantDashboard.tsx`, `DepartmentDashboard.tsx`) updated to label email as "(Opcional)" and skip rendering when null.
>
> _✅ DONE: The phone number should be mandatory, not optional._ — `Tenant.phone` is now non-nullable; DTO requires it (`@IsNotEmpty()`). Frontend forms mark the input `required`.
>
> _✅ DONE: The Document of Identity should be mandatory, not optional. Also it should be unique across all tenants._ — `Tenant.documentId` is now `unique: true`, non-nullable; DTO requires it. Both creation forms include a required "Documento de Identidad" field. Duplicate-DNI rejection bubbles up with a clear toast message.

---

## E. Step-by-Step: Starting a Rental

### E.1 Create a Contract

The *Contrato* binds one tenant to one department for a date range and captures the financial terms.

**Where:** sidebar → **Contratos** → **+**. Or from the inquilino's or departamento's detail page.

**Fields:**

| Field | Required | Notes |
| :-- | :-- | :-- |
| Inquilino | yes | Pick from the list. |
| Departamento | yes | **Only available departments appear in the dropdown.** |
| Fecha de inicio | yes | Contract start. |
| Fecha de fin | yes | Contract end. |
| Renta mensual | yes | Monthly rent in S/. |
| Adelanto | yes | Upfront month of rent. Refundable at termination. |
| Garantía | yes | Security deposit. Refundable minus deductions. |

**What happens behind the scenes when you click Save:**

```mermaid
sequenceDiagram
    actor Op as Operator
    participant App
    Op->>App: Click "Crear contrato"
    App->>App: Validate department.isAvailable == true
    alt department already taken
        App-->>Op: Error: "Department is not available for rent"
    else
        App->>App: INSERT new contract (status=active)
        App->>App: UPDATE department.isAvailable = false
        App-->>Op: ✅ Contract created
    end
```

**Constraints:**

| Scenario | What happens |
| :-- | :-- |
| The department is already rented (has an active contract) | Blocked: *"Department X is not available for rent"*. |
| You forget to pick a tenant or department | Validation error before submit. |
| Two contracts on overlapping dates for the same unit | Blocked by the `isAvailable` check, **but** PropManager does not check date overlaps directly. If you somehow free the unit and re-rent it, dates can in principle overlap. Keep this in mind for record-keeping. |
| You delete a contract | The department flips back to **`isAvailable = true`** automatically. |

---

## F. Step-by-Step: Utility Metering

This is the recurring task that drives accurate billing.

### F.1 Add a Meter Reading

**Where:** sidebar → **Lecturas** → **+**. Or from the department's dashboard.

**Fields:**

| Field | Required | Notes |
| :-- | :-- | :-- |
| Medidor | yes | Pick the specific meter (water or light on a specific department). |
| Valor de lectura | yes | The number on the physical meter today. |
| Fecha de lectura | yes | When you read it. Stored as a `date` (no time component). |
| Mes / año de facturación | optional | Override the billing period this reading counts toward. Leave blank to auto-derive. |

**How the system attributes a reading to a billing period (auto-derive rule):**

- If the reading date is **day 1 of a month**, it counts toward the **previous month**. Rationale: a reading taken on May 1 captures all consumption that happened during April.
- For any other day, it counts toward the **current month** of the reading date.

You can override this in the form by setting "Mes/año de facturación" explicitly.

> **📝 Adjustments / Notes**
>
> _✅ DONE: When the reading date is more than 1 day after the first of the month, it should count toward the current month._ — Confirmed already implemented in `deriveBillingPeriod()` (`meter-reading.service.ts:131-139` and `department.service.ts`). Day 1 → previous month; day 2-31 → current month. No code change.
> 
> _✅ DONE: This scenario only will happens when the tenant leaves at mid of the month._ — Same logic; mid-month-departure readings naturally fall under the "day 2-31 → current month" branch.

### F.2 How Consumption Is Calculated

When the system generates a receipt for, say, April 2026:

1. It finds the **latest reading** whose billing period is `April 2026` → this is `currentReading`.
2. It finds the **latest reading** whose billing period is strictly before April 2026 → this is `previousReading`.
3. `consumption = currentReading − previousReading`.
4. `cost = consumption × propiedad.costoPorUnidad`.

**Worked example:**

| Date entered | Reading | Billing period (auto) |
| :-- | :-- | :-- |
| 2026-04-01 | 4520 kWh | March 2026 |
| 2026-05-01 | 4820 kWh | April 2026 |

April 2026 receipt: `consumption = 4820 − 4520 = 300 kWh`, `cost = 300 × 0.25 = S/ 75.00`.

**Period mode (used when you set Day-of-departure):** instead of using the `billingMonth/billingYear` fields, the system uses the **date range** `[day startDay … day endDay] of (month, year)`:
- `currentReading` = newest reading with `date <= endDay`.
- `previousReading` = newest reading with `date < startDay`.

This is how a partial-month receipt gets honest consumption math.

**Constraints & common pitfalls:**

| Scenario | What happens |
| :-- | :-- |
| Only one reading exists for the meter | The April receipt will show **no electricity charge** (no baseline to subtract from). |
| You record two readings with the **same billing period** (e.g. two readings both flagged April) | The system uses **only the most recent by date**; the earlier reading is ignored. |
| The new reading is **lower** than the previous (broken meter, replaced unit) | The system treats `consumption = 0` and silently logs a warning. **Manually verify** the receipt — your tenant won't be charged anything that month. See [G.18](#g18-worked-example-negative-consumption-fallback). |
| You enter the reading on day 1 expecting it to bill that month | It will bill the **previous** month instead. Use the explicit "mes/año" override if you don't want that behavior. |
| You forgot to take a reading this month | Take a reading next month covering both months' usage. The receipt will charge the cumulative consumption for the period when you record it. |

> **📝 Adjustments / Notes**
>
> _TODO: capture proposed changes here._

---

## G. Step-by-Step: Monthly Billing (Receipts)

This chapter is the most detailed in the guide because billing is where the most adjustments are needed. Each subsection covers a single UI control or one piece of receipt logic, in the order you encounter them on the billing page.

### G.1 Opening the Billing Page

**Where:** sidebar → **Departamentos** → click a department → **Facturación** tab. URL: `/departments/:id/billing`.

The page header reads `Facturacion — {departmentName}` with the property name underneath. If the contract on this department has already been terminated, you'll see a red banner:

> **Contrato terminado. No se pueden generar nuevos recibos.**

The Generar Recibo button is still rendered but operations on a terminated contract are not the intended use case.

**What the page loads on entry (5 requests in parallel + 1 sequential):**

| # | Request | Purpose |
| :-- | :-- | :-- |
| 1 | `GET /departments/:id` | Department metadata for the header. |
| 2 | `GET /contracts?departmentId=:id` | Active contract on this department. |
| 3 | `GET /departments/:id/consumption/period?month&year` | Period-scoped electricity + water consumption (used as fallback if no receipt exists). |
| 4 | `GET /extra-charges?contractId&month&year` | Extra charges for the selected period. |
| 5 | `GET /contracts/:id/termination` | If terminated, the snapshot. |
| 6 | `GET /contracts/:id/receipts?month&year` | Receipt preview — returns the persisted receipt if it exists, otherwise an on-the-fly computation. |

If any request fails, you'll see the toast *"No se pudieron cargar los datos de facturacion"*.

> **📝 Adjustments / Notes**
>
> _TODO: capture proposed changes here._

### G.2 The Month / Year Selector

Two controls at the top of the page:

- **Mes** dropdown (Enero through Diciembre).
- **Año** numeric input.

Changing either:
- **Clears** the `receipt` and `previewReceipt` state.
- If a termination already exists, the page leaves the "Salida" panel open; otherwise the departure inputs (`departureDay`, `prorateRent`) are cleared.
- Re-fires all 6 requests from G.1.

**Constraint:** the dropdown is **1-indexed for the API** (Enero = 1, Febrero = 2 …), even though JavaScript natively uses 0-indexed months. The frontend stores `month = i + 1` where `i` is the dropdown index.

> **📝 Adjustments / Notes**
>
> _TODO: capture proposed changes here._

### G.3 The Consumption Panel

This panel displays the **electricity** and **water** consumption + cost for the selected period.

There are two sources for these numbers and the panel prefers whichever is available:

1. **If a receipt already exists** (`receipt.id` is set), use the cost from the receipt's `items[]` array. Look up the line whose description contains `electricity / luz` and the one containing `water / agua`. The number of units is **not** stored on the receipt entity directly — only the cost — so the units column is shown as `null` when reading from a persisted receipt.
2. **If no receipt yet exists**, fall back to the `GET /departments/:id/consumption/period` response, which returns `{ consumption: number, cost: number }` for both meter types.

| Field shown | When receipt exists | When only preview exists |
| :-- | :-- | :-- |
| Light cost | Extracted from `items[].amount` matching `"electricity"` / `"luz"` | `consumption.light.cost` from the API |
| Light has readings | `lightCost > 0` | `consumption.light.consumption > 0` |
| Water cost | Same logic for `"water"` / `"agua"` | `consumption.water.cost` |
| Units displayed | `null` (not visible) | `consumption.light.consumption` |

**Constraint:** if a property's per-unit rate changes after a receipt is issued, the panel will still show the **old** cost for that month (because it reads from the persisted `items[]`). Future months will use the new rate.

> **📝 Adjustments / Notes**
>
> _✅ DONE: The receipt should be able to recalculate using the last reading meter for the month._ — Flipped the display precedence: the consumption panel (and resulting `total`) now always prefers live values from `GET /departments/:id/consumption/period` (latest readings × latest property rates) over the frozen `items[]` of any persisted receipt. The persisted receipt's frozen amounts remain visible in the receipt modal (G.10) for audit. To commit the updated figures to the receipt itself, click **Regenerar Recibo** (which already pulls fresh consumption + extras and rebuilds `items[]`).
>
> Example:
>   - The current billed period for electricity is `S/ 10` and `S/ 20` for water
>   - The month rent is `S/ 1500.00`.
>   - So the complete billing for that period will be `S/ 1530.00`
>
> But, if for some reason the price for the services change or if we add a new service charge, the pricing screen should be able to show the new billing using the latest values from the API.

### G.4 The Extra Charges Panel

Lists every `ExtraCharge` row whose `(contractId, month, year)` matches the selected period.

For each row the panel shows:
- Description (`Limpieza`, `Cable TV`, `Mora por recibo atrasado (N dias x S/ R/dia)`).
- Amount.
- A **delete** button — except for late-fee rows, whose delete is disabled (a 400 is returned by the API if you try).

Below the list there is an inline form to **add** a new manual extra charge:

| Field | Notes |
| :-- | :-- |
| Descripción | Free-text. |
| Monto | Amount in S/. |
| (Hidden) Mes, Año, Contrato | Taken from the page context. |

Clicking **+ Agregar** submits `POST /extra-charges`, then refetches the extra charges list AND the receipt preview, so the new charge immediately surfaces in the preview totals.

**Constraint:** the extras list, the preview, and the persisted receipt can fall out of sync if the receipt was **approved** before the extra was added. You'll see the extra row, you'll see it in the preview totals, but the **persisted approved receipt's** `items[]` will not include it until you **Regenerar** (see G.12).

> **📝 Adjustments / Notes**
>
> _TODO: capture proposed changes here._

### G.5 The "Indicar salida anticipada" Toggle

A text button that reveals the mid-month departure controls. Visible only when there's an active contract and the contract is not already terminated.

Clicking it:
- Sets `showDeparture = true`.
- Pre-fills `actualDepartureDate` with the contract's original `endDate` (date portion only, in `YYYY-MM-DD`).
- Reveals the inputs described in G.6 and the "Cerrar contrato" form.

If a termination already exists in the database for this contract, the page **auto-opens** this panel on load and shows a read-only "Contrato cerrado" badge with the persisted figures (no editing possible).

> **📝 Adjustments / Notes**
>
> _TODO: capture proposed changes here._
>
> _✅ DONE: The "Dia de salida" value should be come from the last reading date was taken_. — New endpoint `GET /departments/:id/meter-readings/latest` returns `{ date }` (max across both meters). When the operator clicks "Indicar salida anticipada", if the latest reading falls within the selected billing month/year, `departureDay` is pre-filled with the day-of-month and `prorateRent` is set to `true`. If the reading is in a different period (or no readings exist), the field stays blank.

### G.6 The "Prorratear alquiler" Checkbox

Inside the departure panel:

- **Día de salida** — a number input (1-31). Stored as `departureDay` (string).
- **Prorratear alquiler** — checkbox that only renders **after** you've typed a departure day. Stored as `prorateRent` (boolean).
- **Cancelar** — clears departureDay, prorateRent, actualDepartureDate, apartmentCondition, guaranteeDeduction.

The combination of these inputs changes how the receipt is generated:

| `prorateRent` | `departureDay` | Effect on receipt |
| :-- | :-- | :-- |
| false (or no checkbox) | empty | Full month rent. Consumption uses the **billing-period mode** (`billingMonth/billingYear` matching). |
| false | filled (e.g. `15`) | Full month rent. Consumption uses **period mode** (`startDay=1, endDay=15`) — utilities are scoped to those days. |
| true | filled | Rent is prorated `(daysOccupied / daysInMonth) × rentAmount`. Consumption uses period mode. |
| true | empty | Has no effect — the checkbox is hidden until `departureDay` is filled. |

The mid-month math is detailed in [G.15](#g15-worked-example-proration-math).

> **📝 Adjustments / Notes**
>
> _TODO: Capture proposed changes here._
>
> _✅ DONE: The "Día de salida" value should come from the last reading date taken._ — Duplicate of G.5 TODO. See implementation note in G.5.
>
> _✅ DONE: The "Prorratear alquiler" option should be enabled by default._ — Superseded: the checkbox was removed entirely. Per current policy, when a `Día de salida` is set the rent is **always** prorated (daysOccupied / daysInMonth × full rent). A short inline hint reads "Alquiler se cobra solo por días ocupados." Both the preview fetch and Generar Recibo always pass `prorateRent=true` when a departure day is present.
>
> _✅ DONE: The UI for this feature should include three key sections:_ — Salida card now uses a 2-column grid (left = `Cierre de contrato` form, right = three stacked panels):
>
> - **Créditos disponibles** (emerald) — advance + (guarantee − deduction). Sums to `Total créditos`. Period payments and prorated-rent refunds are **not** credits in this model: the tenant never pays the last month separately (advance covers it), and rent for days stayed is charged on the bill side rather than refunded on the credit side.
> - **Total facturado del mes** (red) — prorated rent (always prorated when a departure day is set) + light + water + manual extras/repairs + mora. Sums to `Total facturado`.
> - **Resumen** — shows `+ Créditos`, `− Facturado`, then either `A devolver al inquilino`, `Saldo a cobrar al inquilino`, or `Balance` depending on sign.
>
> Panels render only while `!termination` (the snapshot view replaces them after closure).
>
> _✅ DONE: The "Agregar cargo extra" section should be renamed to "Agregar cargo extra o reparación". This is just a suggestion, so choose the best option for the UI. This change should only apply when "Indicar salida anticipada" is enabled. The section should also include additional charges and repair costs for any property damage._ — Heading switches to "Agregar Cargo Extra o Reparación" while `showDeparture` is true; description placeholder also widens to suggest repair examples ("Reparación de lavabo, Pintura, etc."). Backend unchanged — repairs are free-text extra-charge rows under the same `ExtraCharge` entity.
>
> _✅ DONE: Make sure to provide a clear UI/UX that shows how the credits are being applied to cover all charges._ — The `Resumen` panel displays the math explicitly: `+ Créditos`, `− Facturado`, then the net result labeled either `A devolver al inquilino` (positive, emerald) or `Saldo a cobrar al inquilino` (negative, red). Per-line breakdowns in the Créditos and Facturado panels show which components are being applied (advance, guarantee, payments, prorated refund vs. rent, services, extras, mora).

### G.7 The Mora (Late Fee) Generator — REMOVED

The auto mora generator was removed in Phase 05. The previous rule (day-15 calendar gate × `ratePerDay`) was never validated against business policy and was tangled with the deprecated `pending_review` / `approved` status machine.

Reintroduction (with stakeholder-confirmed rules) is tracked in [TEN-6](https://linear.app/tenant-aqp/issue/TEN-6).

Historical `late_fee` extra-charge rows continue to display correctly on the billing page; only the generator UI and backend endpoint are gone.

> **📝 Adjustments / Notes**
>
> _✅ DONE: Mora generator removed in Phase 05 (see TEN-6 for future reintroduction)._

### G.8 The Preview Pane

This is the running tally you see while you tweak inputs. It shows:

| Line | Source |
| :-- | :-- |
| Renta mensual (or `Renta (X/Y dias)` if prorated) | `rentAmount` (full or prorated) |
| Consumo de luz | `lightCost` from G.3 |
| Consumo de agua | `waterCost` from G.3 |
| Cargos extras | `extraTotal = sum(extraCharges.amount)` |
| **Total** | `rentAmount + lightCost + waterCost + extraTotal` |

The preview is **deterministic from current page state** — it does **not** call the API. It is purely a UI computation so the operator sees the impact of toggles immediately. The actual receipt body is produced by the backend when you click Generar Recibo (G.9).

**Important nuance:** the preview's "Total" is the `totalDue` only. It does **not** subtract payments. The persisted receipt does include payments as negative line items and computes `balance = totalPayments − totalDue`. Always check the receipt modal (G.10) for the final balance, not the inline preview.

> **📝 Adjustments / Notes**
>
> _TODO: capture proposed changes here._

### G.9 The "Generar Recibo" Button

The main call to action.

**What it sends:**

```
POST /contracts/{contractId}/receipts?month={M}&year={Y}
   [&startDay=1&endDay={departureDay}&prorateRent=true]
```

- `startDay` is hardcoded to `1` on the frontend; only `endDay` and `prorateRent` come from the operator.
- There is no `force` flag any more. Regeneration is allowed for any `unpaid` receipt; clicking on a `paid` row is server-side rejected with `409 RECEIPT_LOCKED` (and the button is disabled in the UI before that point).

**What the backend does:**

```mermaid
sequenceDiagram
    participant FE as Operator (Billing page)
    participant API as ContractController
    participant R as ReceiptService
    participant DB as PostgreSQL

    FE->>API: POST /contracts/:id/receipts?...
    API->>R: issueReceipt(contractId, month, year, sDay, eDay, prorate)
    R->>DB: SELECT existing receipt by (contractId, month, year)
    alt existing.status == paid
        R-->>FE: 409 RECEIPT_LOCKED "Receipt for M/Y is paid and cannot be regenerated"
    else existing.status == unpaid
        R->>R: recalc items, totals
        R->>DB: UPDATE receipt (status stays unpaid)
    else no row yet
        R->>R: recalc items, totals
        R->>DB: INSERT receipt, status=UNPAID
    end
    R-->>FE: Receipt JSON
    FE->>FE: open receipt modal (G.10)
```

**Result:** the receipt is persisted with status **`unpaid`** (new) or stays **`unpaid`** (regen of existing unpaid row).

**Toast on success:** *"Recibo generado exitosamente"*.

**Failure modes:**
- Targeting a paid period → 409 `RECEIPT_LOCKED`. The UI hides the button before that point, so this is defense-in-depth.
- Network error → toast: *"Error al generar recibo (details)"*.
- Race condition (two operators clicking at once) → the second click upserts the same row; the unique constraint `(contractId, month, year)` keeps things consistent.

> **📝 Adjustments / Notes**
>
> _✅ DONE: Phase 05 — dropped the `force` flag; paid receipts are now terminal._

### G.10 The Receipt Modal

Right after a successful Generar Recibo (or when the operator opens an existing receipt), a modal slides in showing the full receipt: tenant name, department name, property address, period, every line item with amount, totals, balance, and a status pill.

The status pill colors:

| Status | Pill text | Color |
| :-- | :-- | :-- |
| `unpaid` | No pagado | amber |
| `paid` | Pagado | emerald |

When the receipt is `paid`, a sub-line beneath the pill shows `Pagado el <fecha> por <user-id-short>` (provenance from the `paidAt` / `paidBy` columns).

The modal includes action buttons depending on status (see G.11) and a "Enviar por WhatsApp" placeholder button that currently shows an alert ("WhatsApp sending will be implemented in next phase") — it does not send anything.

> **📝 Adjustments / Notes**
>
> _✅ DONE: Phase 05 collapsed the 3-state pill to 2 states; added paid-provenance line._

### G.11 The "Marcar como pagado" Action

Visible in the receipt modal **only** while status is `unpaid`.

| Button | API call | What it sets |
| :-- | :-- | :-- |
| **Marcar como pagado** | `PATCH /contracts/:id/receipts/status?month&year` with `{ status: "paid" }` | `status = paid`, `paidAt = now()`, `paidBy = <current user>`. |

The call goes through `ReceiptService.updateReceiptStatus`. The receipt's `items[]`, `totalDue`, `totalPayments`, and `balance` are **not** recomputed — only `status`, `paidAt`, and `paidBy` change.

**Toast:** *"Recibo marcado como pagado"*.

**`paid` is terminal in this version.** There is no Revertir button. The endpoint refuses any `paid → unpaid` flip with `409 RECEIPT_PAID_IMMUTABLE`. Reintroduction of a revert path (with conditions like supervisor role or time-window) is tracked in [TEN-5](https://linear.app/tenant-aqp/issue/TEN-5).

> **📝 Adjustments / Notes**
>
> _✅ DONE: Phase 05 — replaced Aprobar/Denegar with single-button Marcar como pagado; flip is audited via paidAt + paidBy._

### G.12 Regenerating a Receipt

"Regenerating" means asking the backend to recompute from current data and overwrite the existing receipt row.

When you click Generar Recibo and a receipt already exists for the period:

| Existing status | Result |
| :-- | :-- |
| `unpaid` | Always upserts. Status stays `unpaid`. Idempotent — click as many times as you want; the receipt picks up the latest readings / extra charges / payments. |
| `paid` | **409 `RECEIPT_LOCKED`**: *"Receipt for M/Y is paid and cannot be regenerated."* The UI also disables the Regenerar Recibo button in this case with hover tooltip *"Recibo pagado — no se puede regenerar"*. |

There is no `force` flag any more. There is no Denegar → Regenerar workaround. The flow is: as long as the receipt is `unpaid`, click Generar Recibo to refresh.

> **📝 Adjustments / Notes**
>
> _✅ DONE: Phase 05 — dropped the `force` flag and the Denegar → Regenerar dance._

### G.13 Receipt Status Machine

```mermaid
stateDiagram-v2
    [*] --> unpaid: issueReceipt
    unpaid --> unpaid: Generar Recibo (refresh items)
    unpaid --> paid: Marcar como pagado
    paid --> [*]: terminal in this version
```

Key rules:
- A receipt is **always created** with status `unpaid`.
- `unpaid → unpaid` regeneration refreshes `items[]` and totals.
- `unpaid → paid` is a one-way door in this phase. Writes `paidAt` and `paidBy` audit columns. See [TEN-5](https://linear.app/tenant-aqp/issue/TEN-5) for the planned revert flow.
- `paid` rows are locked: regeneration is blocked at both the UI and the server (`409 RECEIPT_LOCKED`).
- The unique constraint `(contractId, month, year)` ensures one row per period.

> **📝 Adjustments / Notes**
>
> _✅ DONE: Phase 05 — 3-state machine collapsed to 2 states with paid as terminal._

### G.14 Receipt Anatomy — Field by Field

When you fetch `GET /contracts/:id/receipts?month&year` you receive an object with these fields. Every field is shown in the UI somewhere; every field affects displayed totals or the receipt's status flow.

| Field | Type | Source | Meaning / how it's shown |
| :-- | :-- | :-- | :-- |
| `id` | UUID (or absent) | Persisted only. If absent, this is an on-the-fly preview, not stored yet. | Determines whether the page treats this as a "preview" vs. a real receipt. |
| `contractId` | UUID | Path parameter | Which contract this receipt belongs to. |
| `month` | int 1-12 | Query param | Billing month. |
| `year` | int | Query param | Billing year. |
| `startDay` | int or null | Query param, persisted | First day of the partial period if a prorated receipt; otherwise null. |
| `endDay` | int or null | Query param, persisted | Last day of the partial period; otherwise null. |
| `status` | enum | Persisted; default `unpaid` | One of `unpaid`, `paid`. `paid` is terminal in this version (no revert; see [TEN-5](https://linear.app/tenant-aqp/issue/TEN-5)). |
| `paidAt` | timestamptz or null | Set when status flips to `paid` | Audit column. |
| `paidBy` | uuid or null | Set when status flips to `paid` — value is the user ID of the operator who clicked the button | Audit column. |
| `tenantName` | string | Snapshotted from `contract.tenant.name` at issue time | Frozen — does **not** update if you later rename the tenant. |
| `departmentName` | string | Snapshotted from `contract.department.name` | Frozen. |
| `propertyAddress` | string | Snapshotted from `contract.department.property.address` | Frozen. |
| `period` | string | Built at issue time | `"April 2026"` (full month) or `"1–15 April 2026"` (prorated). |
| `items[]` | jsonb array of `{description, amount}` | Built at issue time | Every line on the receipt, in order: rent, electricity, water, manual extras (each prefixed `Otros:`), late-fee extras (also `Otros:`), then payments (with **negative** amounts). |
| `totalPayments` | decimal(10,2) | Sum of positive payment amounts | Used to compute balance. |
| `totalDue` | decimal(10,2) | `rent + light + water + sum(extras)` | The amount the tenant is being billed. |
| `balance` | decimal(10,2) | `totalPayments − totalDue` | **Positive** = tenant has credit / overpaid. **Negative** = tenant owes. |
| `createdAt` / `updatedAt` | timestamp | Auto | TypeORM timestamps. |

**Worked example of `items[]`:**

```text
[
  { "description": "Monthly Rent (15/30 days)",          "amount":  750.00 },
  { "description": "Electricity Consumption (42 units)", "amount":   10.50 },
  { "description": "Water Consumption (8 units)",        "amount":    1.20 },
  { "description": "Otros: Limpieza",                    "amount":   30.00 },
  { "description": "Otros: Mora por recibo atrasado (5 dias x S/ 5.00/dia)", "amount":   25.00 },
  { "description": "Payment (rent) - Mar 28 transfer",   "amount": -300.00 }
]
```

`totalDue = 750 + 10.50 + 1.20 + 30 + 25 = 816.70`
`totalPayments = 300`
`balance = 300 − 816.70 = −516.70` → tenant owes S/ 516.70.

> **📝 Adjustments / Notes**
>
> _TODO: capture proposed changes here._

### G.15 Worked Example: Proration Math

**Setup:** monthly rent S/ 1500, contract covers April 2026 in full but tenant leaves on April 15.

When you toggle Salida, set Día de salida = 15, and check Prorratear alquiler:

| Step | Computation | Value |
| :-- | :-- | :-- |
| effectiveStartDay | `startDay ?? 1` | `1` |
| daysInMonth | `new Date(2026, 4, 0).getDate()` (note: month=4 in JS gives "last day of April") | `30` |
| daysOccupied | `endDay − effectiveStartDay + 1 = 15 − 1 + 1` | `15` |
| ratio | `daysOccupied / daysInMonth` | `0.5` |
| `rentAmount` | `ratio × 1500` | `750.00` |
| Description | template | `"Monthly Rent (15/30 days)"` |

**Consumption in period mode:**

| Reading | Date | Used? |
| :-- | :-- | :-- |
| 4500 kWh | 2026-03-30 | Used as `previousReading` (`date < 2026-04-01`). |
| 4520 kWh | 2026-04-01 | Skipped — its date is in the range start. The query uses **strictly less than** `rangeStart`, so the day-1 reading is **not** `previousReading`. |
| 4820 kWh | 2026-04-15 | Used as `currentReading` (newest with `date <= 2026-04-15`). |

`consumption = 4820 − 4500 = 320 kWh`. (Note this is subtly different from billing-period mode and is worth verifying for your use case.)

> **📝 Adjustments / Notes**
>
> _TODO: capture proposed changes here._

### G.16 Worked Example: Day-1 Attribution Rule

**Setup:** you record a single reading on **May 1, 2026 at 12:00 local time**, value 5200 kWh, with no explicit `billingMonth`/`billingYear`.

The system runs `deriveBillingPeriod(2026-05-01)`:

| Date condition | Branch | `billingMonth` | `billingYear` |
| :-- | :-- | :-- | :-- |
| `date.getDate() === 1` and `month === 0` (January) | previous year December | 12 | year − 1 |
| `date.getDate() === 1` and `month > 0` | previous month, same year | `month` (which is 0-indexed JS month, so for May 1 → 4 → "April") | year |
| any other day | current month | `month + 1` | year |

For May 1, 2026: branch 2 → `billingMonth = 4 (April)`, `billingYear = 2026`.

The April 2026 receipt will see this as the `currentReading` for April.

**Gotcha:** if the operator wants this reading to bill **May** instead of **April**, they must explicitly set "Mes/año de facturación = 5 / 2026" in the form.

> **📝 Adjustments / Notes**
>
> _TODO: capture proposed changes here._

### G.17 Worked Example: Late-Fee Grace Period

**Setup:** receipt for **March 2026** has `balance = −500` (tenant owes S/ 500). Operator clicks Generar Mora on **April 25, 2026** at 10:00 with `ratePerDay = 5.00`.

| Step | Computation | Value |
| :-- | :-- | :-- |
| Receipt found | `(contractId, month=3, year=2026)` | exists |
| Balance check | `balance >= 0`? | `false` (it's negative — OK to proceed). |
| Deadline | `new Date(2026, 3, 15)` ← **month=3 in JS is April** | April 15, 2026 |
| Today | `new Date()` normalized to midnight | April 25, 2026 |
| Past deadline? | `today > deadline` | `true` |
| Days overdue | `floor((today − deadline) / 86400000)` | `10` |
| Amount | `5.00 × 10` | `50.00` |
| Existing late fee? | search by `sourceReceiptId = receipt.id, type = LATE_FEE` | absent |
| Action | INSERT new `ExtraCharge` with `month=3, year=2026, type=LATE_FEE, amount=50.00, sourceReceiptId=receipt.id, ratePerDay=5.00, daysOverdue=10, description="Mora por recibo atrasado (10 dias x S/ 5.00/dia)"` | — |

**Re-running Generar Mora later:**
- On April 30 (5 more days passed) it now finds the existing row and **updates** it to `daysOverdue=15, amount=75.00`. Description updated to `"Mora por recibo atrasado (15 dias x S/ 5.00/dia)"`.

**Important caveats:**
- The deadline math `new Date(year, month, 15)` mixes 1-indexed `month` from the receipt with 0-indexed JS `Date.month`. The off-by-one is **intentional** here: a receipt for month=3 (March) ends up checking April 15 — i.e. **day 15 of the month AFTER the billing month**.
- The late fee is itself a manual line item in the **same period** (March). When you Regenerar the March receipt, the new `totalDue` will include the late fee. The next Generar Mora call recomputes `daysOverdue × ratePerDay` from scratch, so this does not compound or double-charge.

> **📝 Adjustments / Notes**
>
> _TODO: capture proposed changes here._

### G.18 Worked Example: Negative Consumption Fallback

**Setup:** the previous reading was 4820 kWh in March. The meter was replaced in mid-April; the technician set the new meter to 0. On April 30 the operator records the new physical reading: 150 kWh.

The system computes `consumption = 150 − 4820 = −4670`. This is impossible in reality — it's an artifact of meter replacement.

**What the system does:**
- Logs a warning server-side: `"Negative consumption detected for meter {id}: current=150 previous=4820 consumption=-4670"`.
- Returns `{ consumption: 0, cost: 0 }`.

**Result on the receipt:** the electricity line is **omitted entirely** (the code only adds the line when `consumption > 0`). The tenant pays no electricity that month.

**Why this is a problem:** the operator may not notice that the tenant skipped a month of electricity costs. There is no UI alert; only a backend log.

**Manual workaround:** if you know the meter rolled over or was replaced, you can manually edit the previous reading to "0" (the new starting baseline) for the month of replacement so consumption math becomes correct from then on. Better: capture the swap moment as a separate reading dated on the swap day with the new meter's starting value.

> **📝 Adjustments / Notes**
>
> _TODO: capture proposed changes here._

### G.19 Failure Scenarios & Recovery

| Scenario | Symptom | Root cause | Recovery |
| :-- | :-- | :-- | :-- |
| Receipt shows S/ 0 for utilities | Only one reading exists for the meter | No baseline | Take/back-date a second reading and Regenerar. |
| Receipt shows S/ 0 for utilities, but you know consumption happened | Latest reading is **lower** than previous | Meter rolled over or was replaced | See G.18 — fix the previous reading or insert a swap-day reading. |
| Receipt total didn't update after I added a payment | Receipt was approved before payment | `items[]` is a snapshot | Regenerar; status reverts to `pending_review`. If approved, may need to Denegar first (see G.12). |
| Receipt shows the wrong tenant name | Tenant was renamed after issue | Snapshot fields | Regenerar to refresh. |
| Two receipts for the same period | Shouldn't happen | Unique constraint blocks it | If you see it in the DB, it's a bug — report it. |
| Receipt was generated, then I added an extra charge, but it's not on the receipt | Same as the payment case | Snapshot | Regenerar. |
| Mid-month rent prorated incorrectly | `daysOccupied` calculated wrong | `endDay − startDay + 1` rule | Verify: 1 to 15 should give 15 days. 1 to 30 should give 30 days. 5 to 20 should give 16 days. If different, double-check the inputs you entered. |
| Mora button doesn't appear even though the tenant is late | Either receipt balance is ≥ 0 (payments cover the dues) or today is on/before day 15 of the next month, or a late fee already exists | Frontend filter | Verify each condition (see G.7). |
| Mora button appears but clicking it gives an error | Backend recomputed and the balance is now ≥ 0 (e.g. recent payment) | Frontend/backend out of sync | Reload the page; if the situation persists, the receipt's balance should match the latest payments. |
| Generar Recibo button gives 400 "already approved" | Receipt is approved, force flag not added | See G.12 | Workaround: Denegar then Generar Recibo. |
| Approved receipt was already shared with the tenant externally, then I Regenerar'd | External version is stale | No notification system | Re-send externally; consider re-Approving afterward to lock the new version. |

> **📝 Adjustments / Notes**
>
> _TODO: capture proposed changes here._

---

## H. Step-by-Step: Payments

**Where:** sidebar → **Pagos** → **+**. Or from the contract's detail page.

**Fields:**

| Field | Required | Notes |
| :-- | :-- | :-- |
| Contrato | yes | Pick the contract receiving the payment. |
| Monto | yes | Amount in S/. |
| Fecha | yes | The date the payment was received. **This date determines which receipt the payment shows on.** |
| Tipo | yes | One of: `rent`, `water`, `light`, `advance`, `guarantee`, `refund`. Informational only — does not change math. |
| Descripción | optional | Free text: "Yape transfer", "Cash", etc. |

**How payments interact with receipts:**

- A receipt for `(contractId, month, year)` includes every payment whose `date` falls within `[periodStart, periodEnd]` of that month.
- `periodStart = new Date(year, month-1, 1)`. `periodEnd = new Date(year, month, 0)` (last day of the month at midnight local time).
- Each payment becomes a **negative** line item in the receipt's `items[]`. The description is `"Payment ({type}) - {description || 'N/A'}"`.
- `totalPayments` is the sum of positive payment amounts. `balance = totalPayments − totalDue`.

**Constraints:**

| Scenario | What happens |
| :-- | :-- |
| You backdate a payment to the previous month | It will appear on **that month's receipt**, not the current one. You'll need to regenerate that month's receipt to see the effect. |
| You record the same payment twice | Two payment rows. No idempotency check. Verify before saving. |
| You delete a payment that was already on an approved receipt | The approved receipt is **not** automatically updated. Regenerate to refresh (see G.12). |
| You record an advance payment dated outside the billing period | It still belongs to the contract but **does not** affect that period's receipt. It will only appear in the receipt for the period containing its date. |

> **📝 Adjustments / Notes**
>
> _TODO: capture proposed changes here._

---

## I. Step-by-Step: Extra Charges

### I.1 Manual Extra Charges

**Where:** Department billing page → "Cargos extras" section. Or sidebar → from a contract's page.

**Fields:**

| Field | Required | Notes |
| :-- | :-- | :-- |
| Descripción | yes | E.g. "Cable TV", "Limpieza profunda". |
| Monto | yes | Amount in S/. |
| Mes / año | yes | Which billing period this charge belongs to. |
| Contrato | yes | The contract (auto-filled if you opened from the billing page). |

**Constraints:**
- Manual charges **can be deleted** any time before approval.
- A manual charge is included in the receipt for its `mes/año` automatically. Regenerate the receipt to see the line.
- The receipt's `items[]` will show this as `"Otros: {description}"` with the amount.

> **📝 Adjustments / Notes**
>
> _TODO: capture proposed changes here._

### I.2 Auto Late Fees — REMOVED

Removed in Phase 05. See [G.7](#g7-the-mora-late-fee-generator--removed). Reintroduction tracked in [TEN-6](https://linear.app/tenant-aqp/issue/TEN-6).

> **📝 Adjustments / Notes**
>
> _✅ DONE: Mora removed; legacy `late_fee` rows still display correctly._

---

## J. Step-by-Step: Mid-Month Departures (Prorating)

When a tenant leaves on, say, the 15th instead of the last day of the month, you can prorate the rent.

**Where:** Department billing page → toggle **"Indicar salida anticipada"** → enter:

| Field | Notes |
| :-- | :-- |
| Día de salida | The day-of-month the tenant left. |
| Prorratear alquiler | Checkbox. If checked, rent is multiplied by `daysOccupied / daysInMonth`. |

**What changes in the receipt:**

- **Rent line description** becomes `"Monthly Rent (X/Y days)"` and amount becomes `(X/Y) × rentMensual`.
- **Electricity and water consumption** are scoped to readings within `[day 1 … day endDay]` of the month using **period mode** (see F.2).
- **Extra charges and payments** are unaffected by the toggle — they belong to the month as a whole.

**Constraints:**

| Scenario | What happens |
| :-- | :-- |
| You toggle Salida but **don't** check Prorratear alquiler | Utilities are still scoped to days 1-`endDay`, but rent stays at the full amount. Useful if the contract specifies "full month rent regardless of departure date". |
| No reading exists on or before the departure day | Consumption falls back to 0. Take a final reading on the departure day. |
| You toggle Salida after already approving a receipt | The preview reflects the toggle but the persisted receipt does not. Regenerate to apply (see G.12). |

> **📝 Adjustments / Notes**
>
> _TODO: capture proposed changes here._

---

## K. Step-by-Step: Closing a Contract

When the tenant leaves permanently you do two things: preview the math (Liquidación) and then commit it (Terminación).

### K.1 Settlement Preview

The settlement is a **read-only forecast** — it does not change any data.

**Where:** **Contratos** page → click the contract → "Calcular liquidación".

**Inputs:**

| Field | Notes |
| :-- | :-- |
| Fecha real de fin | The date the tenant actually leaves. Can be before or after the contracted end date. |

**Outputs shown:**

- Total cargos (rent through `actualEndDate`, plus any overstay deduction against the guarantee).
- Total pagos.
- Deducción de garantía (only if `actualEndDate > contract.endDate`: overstayed days × daily rent, capped at the guarantee).
- **Final balance** = total payments − total charges. Positive ⇒ owed back to tenant; negative ⇒ tenant owes.

⚠️ **Note:** The settlement only counts **rent** in `total charges`; it does **not** include utilities or extra charges. The actual final number you should refund/collect comes from the Terminación step (next), which is the persisted truth.

### K.2 Termination (Final Closure)

This **persists** the closure, marks the contract `Terminado`, and frees the department.

**Where:** Department billing page → "Cerrar contrato" form (inside the Salida panel).

**Fields:**

| Field | Required | Notes |
| :-- | :-- | :-- |
| Fecha real de salida | yes | Tenant's actual move-out date. |
| Condición del departamento | optional | Free-text notes: "Pintura en buen estado", "Lavabo roto", etc. |
| Deducción de garantía | yes | Money you keep from the security deposit (damages, penalty). Min 0. |
| Costo de servicios | optional | Unbilled utility cost up to departure. The frontend auto-passes `lightCost + waterCost + extraTotal` from the current preview. |
| Monto prorrateado de renta | optional | If the tenant left mid-month, this is the prorated rent amount. Used to compute the rent refund. The frontend auto-passes `rentAmount` if both prorateRent and departureDay are set. |

**What the system computes:**

```text
rentRefundRaw          = max(0, contract.rentAmount − proratedRentAmount)
servicesFromGuarantee  = max(0, servicesCost − rentRefundRaw)
rentRefund             = max(0, rentRefundRaw − servicesCost)
guaranteeReturn        = max(0, contract.guaranteeDeposit − guaranteeDeduction − servicesFromGuarantee)
```

In plain language: **services are first absorbed by the leftover rent the tenant prepaid; whatever services remain are taken from the guarantee. Damages are also taken from the guarantee. Whatever's left of the guarantee is returned.**

**Worked example:** Tenant prepaid full April rent (S/ 1500) but left on April 15. Light + water + cable bill comes to S/ 200 for the partial month. Damages: S/ 100. Guarantee: S/ 1500.

- `rentRefundRaw = max(0, 1500 − 750) = 750` (half the month is owed back).
- `servicesFromGuarantee = max(0, 200 − 750) = 0` (services fit inside the refund).
- `rentRefund = max(0, 750 − 200) = 550` (rent refund net of services).
- `guaranteeReturn = max(0, 1500 − 100 − 0) = 1400`.

**Total refund to tenant: S/ 550 + S/ 1400 = S/ 1950.**

**Constraints:**

| Scenario | What happens |
| :-- | :-- |
| Contract is already `Terminado` | Blocked: 409 *"Contract is already terminated"*. View the existing termination snapshot instead. |
| You enter a negative deduction or services cost | Validation error. All money fields must be ≥ 0. |
| You leave Deducción de garantía empty | Treated as 0. |
| Termination crashes between steps | The system writes the termination row first, then flips `contract.status = TERMINATED`, then flips `department.isAvailable = true`. These three writes are **not** wrapped in a transaction — a crash between any two could leave inconsistent state. If you see a contract that has a termination snapshot but still shows `Activo`, contact a developer. |
| You forgot to record the last reading before termination | Take that reading now (date = actual departure), and **regenerate the receipt** before terminating. Termination's auto-suggested `servicesCost` comes from the current preview's `lightCost + waterCost + extraTotal`. |

After termination:
- The contract `status` is `Terminado`.
- The department's `isAvailable` is `true` — ready for a new contract.
- The termination snapshot is **immutable**. There is no "undo".

**Receipt-completeness gate:** `Confirmar cierre de contrato` is disabled until every billing month from `contract.startDate` through the currently selected month has a persisted receipt (any status — `unpaid` or `paid` both count), **except the earliest month with readings**, which is treated as a baseline/setup period and does not require a receipt (its single reading is the baseline for the next month's consumption). If receipts are missing, the button shows an inline notice listing the missing months (e.g. `Faltan recibos: Mar 2026, Abr 2026`). Backed by `GET /contracts/:id/receipts/months` + `GET /departments/:id/meter-readings/earliest-billing-period`. The list re-checks live after each Generar Recibo, so the button re-enables in the same session.

> **📝 Adjustments / Notes**
>
> _TODO: capture proposed changes here._

---

## L. Admin Tasks

These are visible **only** when your user role is `admin`.

### L.1 Approve or Reject New Users

Whenever someone registers via **Regístrate**, their account is created with status `Pendiente`. They cannot log in until you approve them.

**Where:** sidebar → under the **Admin** section → **Usuarios**.

**You see:** a table of all non-admin users: email, status (Pendiente / Aprobado / Rechazado), registration date.

**Actions per row:**

| Button | Effect |
| :-- | :-- |
| **Aprobar** | Sets status to `Aprobado`. The user can now log in. |
| **Rechazar** | Sets status to `Rechazado`. The user is permanently blocked unless re-approved. |

**Constraints:**

| Scenario | What happens |
| :-- | :-- |
| You try to access `/admin/users` as a non-admin | Redirected to `/`. The Admin section is hidden in the sidebar. |
| The user has already been Aprobado | Only "Rechazar" is shown. |
| The user has already been Rechazado | A dash `—` is shown. To re-approve, you'd need to "Aprobar" but the UI currently hides it for rejected users; ask a developer to flip status directly if you change your mind. |
| No notification is sent | The user must **try logging in** to discover their new status. There is no email/SMS yet. |

---

## M. Constraints Cheat Sheet — "Why Can't I…?"

| What I tried to do | Why it's blocked | How to unblock |
| :-- | :-- | :-- |
| **Log in** | Account is `Pendiente` | Ask the admin to approve you at `/admin/users`. |
| **Log in** | Account is `Rechazado` | Ask the admin. There's no self-service recovery. |
| **Create a contract** on a department | Department is `No disponible` (already rented) | Terminate or delete the existing contract first. |
| **Generate a receipt** | No contract on the department for that period | Create the contract first. |
| **See electricity / water charges** on a receipt | Only one reading exists for the meter | Take a second reading and regenerate. |
| **See electricity / water charges** | Current reading is lower than previous (meter replaced or rolled over) | Verify physically. The system treats this as 0 consumption (see G.18). |
| **Regenerate an approved receipt** | The frontend does not auto-send `force=true` when status is `approved` | Click **Denegar** first, then **Generar Recibo**. |
| **Generate Mora** | Receipt's balance is `≥ 0` | The tenant is paid up; no late fee applies. |
| **Generate Mora** | Today is on or before day 15 of the month after the billing month | Wait until the grace period ends. |
| **Generate Mora** | No receipt exists for that period | Generate the receipt first. |
| **Delete a late fee** | It's auto-generated (`LATE_FEE`) | You cannot. Either record the payment so the receipt becomes balanced or contact a developer. |
| **Terminate a contract** | Contract is already `Terminado` | Look up the existing termination — there can only be one. |
| **Add a tenant** with an email that already exists | DB unique constraint on email | Use a different email or look up the existing tenant. |
| **Add two readings in the same billing month** and see them both contribute | Only the latest by date is used | Adjust the explicit `mes/año` fields or merge readings logically. |
| **See an advance payment** on a specific month's receipt | Payment date is outside that month's range | Edit the payment's date to fall within the period, or regenerate the receipt of the period containing its date. |
| **Approve a property delete** | (Not blocked — it just cascades) | Be aware: deleting a property removes all its departments, contracts, payments, extra charges, receipts, and orphan tenants. No undo. |

---

## N. Frequently Asked Questions

**Q: I just took a meter reading on the 1st of the month, but the receipt says it's "March consumption" when I expected April. Why?**
A: A reading on day 1 is automatically attributed to the **previous** month, because by the time someone reads the meter on May 1 they're capturing what was consumed during April. If you actually want it billed against May, set "Mes/año de facturación" explicitly in the form. See G.16.

**Q: I added a new payment after marking the receipt as paid. It's not showing on the receipt — what do I do?**
A: Paid receipts are terminal in this version. The "Regenerar Recibo" button is disabled for them and the server returns `409 RECEIPT_LOCKED` if you bypass the UI. If the payment really should be on this receipt, you cannot edit it in-place. The future revert flow is tracked in [TEN-5](https://linear.app/tenant-aqp/issue/TEN-5).

**Q: Why can't I edit a paid receipt?**
A: By design — `paid` is treated as terminal so the receipt represents what was actually settled. Future work (see [TEN-5](https://linear.app/tenant-aqp/issue/TEN-5)) will add a controlled revert path.

**Q: My tenant overpaid by S/ 200. How do I refund?**
A: There are two options:
  - **Apply to next month:** the system does **not** carry over credits automatically. You can either add a manual `cargo extra` of `−200` on next month, or record a `Pago` of type `refund` for the difference when you hand them cash.
  - **Cash refund now:** record a `Pago` with `tipo = refund` for the overpaid amount. The receipt's `totalPayments` drops by that amount (because `balance = totalPayments − totalDue`).

**Q: A tenant gave me a partial payment. How do I record it?**
A: Just add a `Pago` for the actual amount. The receipt's balance will reflect "tenant still owes the difference". (Mora generation was removed in Phase 05 — see [TEN-6](https://linear.app/tenant-aqp/issue/TEN-6).)

**Q: I created a department but forgot to set the initial reading. Can I add it later?**
A: Yes. Go to **Lecturas → +**, pick the meter (which may not exist yet — you may need to create one via **Medidores** first), enter the historical reading with the historical date. The next reading you add will compute consumption against it.

**Q: Where did the Generar Mora button go?**
A: Removed in Phase 05. The previous rule was never validated against business policy. Reintroduction with stakeholder-confirmed rules is tracked in [TEN-6](https://linear.app/tenant-aqp/issue/TEN-6).

**Q: Where is the WhatsApp / email sending of receipts?**
A: Not yet implemented. The "Enviar" button currently shows a placeholder. Future work.

**Q: Can two operators use PropManager at the same time?**
A: Functionally yes — anyone with an Aprobado account can log in. But there is **no separation**: every operator sees and edits everything. There is no per-building or per-team scoping.

**Q: A tenant transfers to a different unit in the same building. What do I do?**
A: Terminate the old contract (Cerrar contrato), then create a new contract on the new department for the same tenant. The two contracts will sit on the tenant's history independently.

**Q: Can I undo a termination?**
A: No. Terminations are immutable. If a tenant decides to stay after termination, create a brand-new contract for them on the same (now-available) department.

**Q: My receipt is missing an extra charge I added. Why?**
A: The receipt was generated **before** the extra charge was added. Click **Regenerar** to recompute.

**Q: I see a row "Payment (rent) - …" with a negative amount on the receipt. What is it?**
A: That's how payments are displayed inside the receipt's `items[]` — with a minus sign so the math (`totalPayments − totalDue`) works out visually. It is **not** an extra charge.

**Q: Can I export receipts as PDF?**
A: Not yet. Receipts live in the database with their `items[]` array; rendering to PDF is future work.

---

## O. Glossary

| Term | Meaning |
| :-- | :-- |
| **Propiedad** | A building owned/managed by the operator. Has many departments. |
| **Departamento** | One rental unit (apartment, studio, room). Belongs to one property. May be available or rented. |
| **Inquilino / Tenant** | The real human renting a department. Not a system user. |
| **Contrato** | The agreement binding a tenant to a department for a date range. Carries rent, advance, and guarantee. |
| **Adelanto / Advance Payment** | One month's rent paid upfront, refundable on termination (less any deductions). |
| **Garantía / Guarantee Deposit** | The security deposit. Refundable minus damages and unbilled services. |
| **Medidor** | Physical utility meter — water or electricity. Tied to a department. |
| **Lectura / Meter Reading** | Single timestamped value of a meter, with an explicit or derived billing period. |
| **Billing Period** | The (month, year) tuple a meter reading is attributed to. A day-1-of-month reading is attributed to the *previous* month. |
| **Consumo** | `currentReading − previousReading` for a meter inside a billing period. Negative values are clamped to zero. |
| **Recibo / Receipt** | The monthly bill for a contract: rent + utilities + extras − payments → balance. |
| **Status: Pendiente de revisión** | Issued but not yet approved by the operator. |
| **Status: Aprobado** | Operator has confirmed the figures. Cannot be regenerated without `force=true`. |
| **Status: Denegado** | Rejected; can be reissued (regeneration resets it to Pendiente de revisión). |
| **Cargo Extra (manual)** | Ad-hoc line item: cable, cleaning, repairs. Can be deleted before approval. |
| **Mora / LATE_FEE** | Auto-generated extra charge created via Generar Mora. Cannot be deleted manually. `amount = daysOverdue × ratePerDay`. |
| **Liquidación / Settlement** | Read-only checkout forecast based on rent + overstay deduction. Does not include utilities or extras. |
| **Terminación** | Persisted closure record: snapshots advance, guarantee, deductions, services cost, refund. Flips contract status to `Terminado`. |
| **Indicar salida anticipada** | UI toggle to declare a mid-month departure. Enables departure day input, prorate toggle, and the close-contract form. |
| **Prorratear alquiler** | Checkbox that multiplies the rent by `daysOccupied / daysInMonth`. |
| **Generar Recibo** | Issue/reissue a receipt. Sends `force=true` automatically only when current status is `pending_review`. |
| **Regenerar** | Same backend call as Generar Recibo; the UI re-issues with the current data. |
| **Period Mode** | Consumption calculation that uses a date range `[startDay, endDay]` instead of `(billingMonth, billingYear)`. Triggered when the operator sets a Día de salida. |
| **S/** | Symbol for the Peruvian sol, used in receipt and late-fee descriptions. |

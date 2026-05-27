# Phase 07 — SEAL Integration (general electricity meter per property)

> Goal: For each Property, pull monthly electricity data (kWh + bill amount +
> PDF) from the SEAL Oficina Virtual portal using the operator's stored
> credentials. SEAL data is **reference-only** — it never feeds tenant
> receipt calculation. Operators trigger sync manually from the Property
> Detail screen and download individual bill PDFs streamed through the API.

This is a plan only. No source files are modified by this document.

---

## Decisions captured up front

| #   | Decision                                                                                                                                                                | Source |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 1   | One general SEAL meter per Property (1:1). Modeled as fields on the `Property` row, not a new entity.                                                                   | User   |
| 2   | SEAL bill amounts are **reference data only**. They are displayed in the UI but do **not** flow into `ReceiptEntity.totalDue`, `MeterReading`, or the ledger.            | User   |
| 3   | Sync is **manual** via a "Sincronizar con SEAL" button on Property Detail. No cron job in v1.                                                                            | User   |
| 4   | PDF receipts are **streamed** through the API (`GET /properties/:id/seal-bills/:billId/pdf`). No signed URLs; the file flows through the backend so auth is enforced.   | User   |
| 5   | SEAL credentials are global (one operator account holds every suministro). Stored in env: `SEAL_EMAIL`, `SEAL_PASSWORD`, `SEAL_BASE_URL`. Never logged.                  | New    |
| 6   | Session = the `ASP.NET_SessionId` cookie issued by SEAL. Held in-memory by a singleton `SealSession` service. Auto re-login on expiry, single retry per call.            | New    |
| 7   | HTML parsing uses `cheerio` (new dependency). Parsers are pure functions tested against committed HTML fixtures captured from the live portal.                          | New    |
| 8   | New `seal_bill` table is append-only per `(property_id, periodo_comercial)`. Re-syncs upsert rows; PDFs are fetched lazily and stored in MinIO.                          | New    |
| 9   | SEAL detalle page exposes **only the last 6 months**. v1 accepts that limitation; deeper history accumulates over time as sync runs.                                    | New    |
| 10  | Sync concurrency = 1 globally. SEAL is single-session per credential — parallel logins would invalidate each other. Enforced with a Redis mutex on the BullMQ queue.    | New    |

---

## Linear tickets and execution order

Parent epic: **TEN-TBD** — Phase 07 — SEAL integration (will be filled in after ticket creation).

Tickets must be executed **strictly in numerical order**. Each one assumes the
previous has shipped (merged + deployed to the dev DB). Skipping forward will
leave the system in a half-built state.

| Order | Ticket   | Scope                                                                                                                                                                  | Blocked by | Touches                                                                                                                                  |
| ----- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | TEN-TBD  | **07.1 SEAL HTTP client + HTML parser**: `SealClient` with `login`, `getSupplyDetail`, `downloadInvoicePdf`. Pure parsers + fixture tests. No DB, no NestJS DI yet.     | —          | new `apps/api/src/seal/` (`seal.client.ts`, `seal.parser.ts`, `seal.session.ts`, `seal.config.ts`, `seal.errors.ts`, `__fixtures__/`)    |
| 2     | TEN-TBD  | **07.2 Schema: Property fields + `seal_bill` entity**: add `seal_supply_code`, `seal_branch_code` to `Property`; create `SealBill` entity. Migration via `synchronize`. | 07.1       | `property.entity.ts`, `property.service.ts` (validation), new `apps/api/src/seal-bill/` entity + module                                  |
| 3     | TEN-TBD  | **07.3 Sync service + queue + manual trigger**: `SealSyncService.syncProperty(id)`, BullMQ worker, single-concurrency global mutex. PDFs fetched + stored in MinIO.    | 07.2       | new `seal-sync.service.ts`, `seal-sync.processor.ts`, `apps/api/src/queue/queue.module.ts` (register queue), reuses `S3ReceiptStorage`   |
| 4     | TEN-TBD  | **07.4 REST endpoints + PDF streaming**: 4 endpoints (configure, sync-now, list bills, stream PDF). Zod-validated DTOs, domain-specific error codes, structured logs.  | 07.3       | new `seal.controller.ts`, integration with existing auth guard, `seal-bill.service.ts`                                                  |
| 5     | TEN-TBD  | **07.5 UI: SEAL card on Property Detail**: configure form, "Sincronizar ahora" button with polling, bills table (6 rows) + kWh sparkline, PDF download icon per row.  | 07.4       | `apps/client/src/pages/PropertyDetail.tsx`, new `apps/client/src/components/seal/` (`SealCard.tsx`, `SealBillsTable.tsx`), `lib/api.ts` |

### Why this order

- **07.1 first** because the client + parsers are the brittle, externally-dependent piece. Locking them down with fixture tests before any DB or HTTP plumbing lets every later ticket build on a stable foundation.
- **07.2 before 07.3** because the sync service needs `Property.seal_supply_code` to know what to fetch and `SealBill` to write into.
- **07.3 before 07.4** so the endpoints have something to call. Endpoints without a working sync are useless to test.
- **07.4 before 07.5** so the UI talks to real APIs from day one. No mocked-client phase.

### Shippable checkpoints

- After 07.1: `apps/api/src/seal/` is independently usable from a CLI script. Run `npx ts-node scripts/seal-probe.ts 50888` and it logs structured JSON.
- After 07.2: schema is in place. `seal_bill` table exists, `Property` has the two new columns, but no rows yet.
- After 07.3: operators can hit a private route or a `nest start` REPL call and trigger sync. PDFs appear in MinIO.
- After 07.4: feature-complete on the backend. Frontend still has no SEAL card.
- After 07.5: ship-ready. Operators see and sync SEAL data per Property.

---

## 1. Mental model (read this before the rest)

SEAL has no API. The "Oficina Virtual" is a server-rendered ASP.NET MVC 5 app
that gates everything behind a session cookie. We've already reverse-engineered
the flow:

1. `GET /Home/Login` → server issues `ASP.NET_SessionId` (Set-Cookie) and an
   anti-CSRF token (`__RequestVerificationToken`) as both a cookie and a
   hidden form field.
2. `POST /Home/Login` with the credentials + both halves of the anti-CSRF
   token. Success returns `302 Found` → `/`. Failure re-renders the login
   form (200 with the form HTML).
3. Every subsequent authed request just needs `Cookie: ASP.NET_SessionId=…`.
   There is no JWT. The session cookie IS the credential.
4. `GET /Suministros/Detalle?strCodigoSuministro=<id>&strCodigoSucursal=1`
   returns HTML with two tables: last 6 receipts (`#tblRecibos`) and last 6
   months of kWh consumption (`#tblConsumos`).
5. `GET /Suministros/Duplicado?CodigoPeriodoComercial=<YYYYMM>&CodigoComprobante=<19-digit>`
   returns `application/pdf` with `Content-Disposition: attachment; filename="Recibo<supply>.pdf"`.

Implications:

- **Treat the session like a short-lived bearer token.** Cache it in memory,
  re-login on 401-equivalent (redirect to `/Home/Login` or login form HTML
  echoed back). Never persist it to disk or DB.
- **The detalle table only shows 6 months.** We can't backfill 2024 data on
  day one; the historical window expands month by month as we sync.
- **Carry-forward bills exist.** December 2025 in the sample was "Acumulado
  para el siguiente mes" — its amount rolled into January 2026's bill.
  Status enum must distinguish `PAID` / `PENDING` / `CARRY_FORWARD`.

---

## 2. Domain model changes

### 2.1 `Property` table additions

```ts
// apps/api/src/property/entities/property.entity.ts
@Column({ name: 'seal_supply_code', type: 'varchar', length: 20, nullable: true, unique: true })
sealSupplyCode: string | null;

@Column({ name: 'seal_branch_code', type: 'varchar', length: 5, nullable: true, default: '1' })
sealBranchCode: string | null;

@Column({ name: 'seal_last_synced_at', type: 'timestamptz', nullable: true })
sealLastSyncedAt: Date | null;

@Column({ name: 'seal_last_sync_error', type: 'text', nullable: true })
sealLastSyncError: string | null;
```

Unique index on `seal_supply_code` (partial: `WHERE seal_supply_code IS NOT NULL`)
enforces decision #1 — a single suministro cannot be claimed by two properties.

### 2.2 New entity: `SealBill`

```ts
// apps/api/src/seal-bill/entities/seal-bill.entity.ts
export enum SealBillStatus {
  PAID = 'paid',
  PENDING = 'pending',
  CARRY_FORWARD = 'carry_forward',
}

@Entity('seal_bill')
@Unique(['property', 'periodoComercial'])
export class SealBill {
  @PrimaryGeneratedColumn('uuid') id: string;

  @ManyToOne(() => Property, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'property_id' })
  property: Property;
  @Column({ name: 'property_id', type: 'uuid' }) propertyId: string;

  @Column({ name: 'periodo_comercial', type: 'char', length: 6 })
  periodoComercial: string;        // 'YYYYMM'

  @Column({ name: 'comprobante_code', type: 'char', length: 19, unique: true })
  comprobanteCode: string;

  @Column({ name: 'due_date', type: 'date' }) dueDate: string;
  @Column({ name: 'payment_date', type: 'date', nullable: true }) paymentDate: string | null;
  @Column({ type: 'enum', enum: SealBillStatus }) status: SealBillStatus;

  @Column({ name: 'amount_pen', type: 'decimal', precision: 10, scale: 4 })
  amountPen: string;

  @Column({ type: 'int' }) kwh: number;

  @Column({ name: 'pdf_storage_key', type: 'varchar', length: 255, nullable: true })
  pdfStorageKey: string | null;

  @Column({ name: 'pdf_fetched_at', type: 'timestamptz', nullable: true })
  pdfFetchedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
```

Note: we deliberately do **not** add `MeterReading` rows from SEAL data. The
SEAL kWh value is reference-only (decision #2). If an operator wants the
SEAL number to influence the tenant receipt, they re-enter it manually as a
regular `MeterReading` — a deliberate human-in-the-loop step.

---

## 3. SEAL client (`apps/api/src/seal/`)

A self-contained module with no NestJS DI in the inner layers, so the parser
and HTTP code stay unit-testable.

### 3.1 Files

```
apps/api/src/seal/
├── seal.config.ts            // reads SEAL_EMAIL, SEAL_PASSWORD, SEAL_BASE_URL via @nestjs/config
├── seal.errors.ts            // SealAuthError, SealSessionExpiredError, SealParseError, SealSupplyNotFoundError
├── seal.session.ts           // in-memory { cookie, expiresAt }; thread-safe via single Promise<void>
├── seal.client.ts            // login(), getSupplyDetail(), downloadInvoicePdf()
├── seal.parser.ts            // pure: parseLoginForm(), parseSupplyDetail(), isLoginPage()
├── seal.module.ts            // exports SealClient as a singleton provider
└── __fixtures__/
    ├── login.html
    ├── login-failed.html
    ├── detalle-50888.html    // captured 2026-05-26 in this investigation
    └── duplicado-sample.pdf  // golden file for byte equality on a known invoice
```

### 3.2 Login flow

```ts
async login(): Promise<string /* sessionCookie */> {
  // 1. GET /Home/Login — capture both anti-forgery halves
  const loginPage = await fetch(`${baseUrl}/Home/Login`);
  const cookies = parseSetCookie(loginPage.headers.getSetCookie());
  const sessionCookie = cookies['ASP.NET_SessionId'];
  const csrfCookie = cookies['__RequestVerificationToken'];
  const csrfForm = parser.extractCsrfFormToken(await loginPage.text());

  // 2. POST /Home/Login with both halves + creds
  const post = await fetch(`${baseUrl}/Home/Login`, {
    method: 'POST',
    redirect: 'manual',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: `ASP.NET_SessionId=${sessionCookie}; __RequestVerificationToken=${csrfCookie}`,
      Origin: baseUrl,
      Referer: `${baseUrl}/Home/Login`,
    },
    body: new URLSearchParams({
      __RequestVerificationToken: csrfForm,
      CorreoElectronico: email,
      Contrasena: password,
    }).toString(),
  });

  if (post.status !== 302) throw new SealAuthError('Login did not return 302');
  return sessionCookie;
}
```

### 3.3 Session caching

`SealSession` exposes `getCookie(): Promise<string>`:

- Holds a single `Promise<string>` in flight — concurrent callers share it.
- If the cookie is older than `SEAL_SESSION_TTL_MS` (default: 15 minutes), it
  triggers a re-login before returning.
- On `SealSessionExpiredError` from a downstream call, the calling code can
  invoke `session.invalidate()` and retry once.

### 3.4 Public API

```ts
interface SupplyDetail {
  supplyCode: string;
  branchCode: string;
  fetchedAt: Date;
  receipts: Array<{
    periodoComercial: string;       // 'YYYYMM'
    comprobanteCode: string;        // 19 digits
    status: 'paid' | 'pending' | 'carry_forward';
    paymentDate: string | null;     // ISO date
    dueDate: string;                // ISO date
    amountPen: string;              // decimal as string
  }>;
  consumption: Array<{
    periodoComercial: string;
    kwh: number;
  }>;
}

class SealClient {
  getSupplyDetail(supplyCode: string, branchCode = '1'): Promise<SupplyDetail>;
  downloadInvoicePdf(periodoComercial: string, comprobanteCode: string): Promise<Buffer>;
}
```

### 3.5 New dependency

`cheerio` (~600KB, MIT). Added to `apps/api/package.json` in ticket 07.1.

---

## 4. Sync service (`apps/api/src/seal/seal-sync.service.ts`)

```ts
async syncProperty(propertyId: string): Promise<{ inserted: number; updated: number; pdfsDownloaded: number }> {
  const prop = await this.propertyRepo.findOneOrFail({ where: { id: propertyId } });
  if (!prop.sealSupplyCode) throw new SealNotConfiguredError(propertyId);

  let detail: SupplyDetail;
  try {
    detail = await this.sealClient.getSupplyDetail(prop.sealSupplyCode, prop.sealBranchCode ?? '1');
  } catch (err) {
    await this.recordSyncError(prop, err);
    throw err;
  }

  // Index consumption by periodo for join
  const kwhByPeriodo = new Map(detail.consumption.map(c => [c.periodoComercial, c.kwh]));

  let inserted = 0, updated = 0, pdfsDownloaded = 0;
  for (const r of detail.receipts) {
    const existing = await this.billRepo.findOne({
      where: { propertyId, periodoComercial: r.periodoComercial },
    });

    const kwh = kwhByPeriodo.get(r.periodoComercial) ?? 0;
    const row = existing ?? this.billRepo.create({ propertyId, periodoComercial: r.periodoComercial });
    Object.assign(row, {
      comprobanteCode: r.comprobanteCode,
      status: r.status,
      paymentDate: r.paymentDate,
      dueDate: r.dueDate,
      amountPen: r.amountPen,
      kwh,
    });

    if (!existing) inserted++; else updated++;
    await this.billRepo.save(row);

    if (!row.pdfStorageKey) {
      const pdf = await this.sealClient.downloadInvoicePdf(r.periodoComercial, r.comprobanteCode);
      const key = `seal/${prop.id}/${r.periodoComercial}-${r.comprobanteCode}.pdf`;
      await this.storage.putObject(key, pdf, 'application/pdf');
      row.pdfStorageKey = key;
      row.pdfFetchedAt = new Date();
      await this.billRepo.save(row);
      pdfsDownloaded++;
    }
  }

  prop.sealLastSyncedAt = new Date();
  prop.sealLastSyncError = null;
  await this.propertyRepo.save(prop);

  return { inserted, updated, pdfsDownloaded };
}
```

### 4.1 Queue + global mutex

- New BullMQ queue `seal-sync` registered in `apps/api/src/queue/queue.module.ts`.
- Single processor with `concurrency: 1`.
- Worker job payload: `{ propertyId }`. Idempotent.
- Manual trigger endpoint enqueues a job and returns its `jobId` immediately.
  The UI then polls `GET /properties/:id/seal-sync/status?jobId=…`.

---

## 5. API surface

Follows the endpoint blueprint (input/output schemas, structured logs, redacted
secrets, request-lifecycle order).

| Method | Path                                              | Body / Query                            | Returns                                                                    | Notes                                                              |
| ------ | ------------------------------------------------- | --------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| PATCH  | `/properties/:id/seal`                            | `{ sealSupplyCode, sealBranchCode? }`  | `200 { property }`                                                         | Attach/detach supply. `sealSupplyCode: null` to unlink.            |
| POST   | `/properties/:id/seal/sync`                       | —                                       | `202 { jobId }`                                                            | Enqueue sync job. 409 if a job is already running for this prop.   |
| GET    | `/properties/:id/seal/sync/status?jobId=…`        | —                                       | `200 { state: 'waiting'\|'active'\|'completed'\|'failed', result?, error? }` | Frontend polls every 1s while button is in loading state.          |
| GET    | `/properties/:id/seal/bills`                      | `?limit=12`                             | `200 { bills: SealBill[] }`                                                | Ordered by `periodo_comercial` DESC.                                |
| GET    | `/properties/:id/seal/bills/:billId/pdf`          | —                                       | `application/pdf` stream                                                   | Streams from MinIO. `Content-Disposition: inline; filename=…`.     |

### 5.1 Error codes

| Code                       | HTTP | When                                                    |
| -------------------------- | ---- | ------------------------------------------------------- |
| `SEAL_NOT_CONFIGURED`      | 400  | Property has no `seal_supply_code`                       |
| `SEAL_SUPPLY_CONFLICT`     | 409  | `seal_supply_code` already linked to another property    |
| `SEAL_AUTH_FAILED`         | 502  | Login POST didn't 302 (creds rotated upstream)           |
| `SEAL_PARSE_FAILED`        | 502  | HTML structure unexpected — needs operator intervention  |
| `SEAL_SUPPLY_NOT_FOUND`    | 502  | SEAL returned login page instead of detalle for our id   |
| `SEAL_SYNC_IN_PROGRESS`    | 409  | Another sync job is active for this property             |
| `SEAL_BILL_NOT_FOUND`      | 404  | `:billId` doesn't belong to `:id`                        |
| `SEAL_PDF_NOT_FETCHED_YET` | 404  | Bill exists but `pdf_storage_key` is still null          |

---

## 6. UI surface (`apps/client/src/pages/PropertyDetail.tsx`)

New "Servicio Eléctrico SEAL" card, rendered after the existing meters block.

### 6.1 Empty state (no `sealSupplyCode`)

```
┌─────────────────────────────────────────────────────────────────┐
│ Servicio Eléctrico SEAL                              [ Vincular ]│
│                                                                  │
│ Esta propiedad no tiene un suministro SEAL vinculado.            │
│ Ingresa el código de suministro para empezar a sincronizar       │
│ recibos y consumos.                                              │
└─────────────────────────────────────────────────────────────────┘
```

Clicking **Vincular** opens a modal with two fields:

- `Código de Suministro` (required, 4–10 digits)
- `Sucursal` (select, defaults to "1 — Arequipa")

### 6.2 Linked state

```
┌─────────────────────────────────────────────────────────────────┐
│ Servicio Eléctrico SEAL              [ Editar ] [ Sincronizar ] │
│ Suministro 50888 · Sucursal Arequipa                             │
│ Última sincronización: hace 5 min · 6 recibos                    │
│                                                                  │
│ ▁▂▃▅▆█  ← sparkline kWh (last 6 months)                          │
│                                                                  │
│ │ Periodo   │ Vence    │ Estado    │ kWh │ Monto S/. │ PDF │     │
│ │ MAY-2026  │ 30/05/26 │ Pagado    │ 301 │   265.20  │ 📄  │     │
│ │ ABR-2026  │ 30/04/26 │ Pagado    │ 272 │   222.60  │ 📄  │     │
│ │ MAR-2026  │ 31/03/26 │ Pagado    │ 249 │   208.20  │ 📄  │     │
│ │ FEB-2026  │ 03/03/26 │ Pagado    │ 247 │   221.30  │ 📄  │     │
│ │ ENE-2026  │ 31/01/26 │ Pagado    │ 232 │   524.90  │ 📄  │     │
│ │ DIC-2025  │ 30/12/25 │ Acumulado │ 357 │   315.30  │ 📄  │     │
└─────────────────────────────────────────────────────────────────┘
```

### 6.3 Sync button behavior

1. Click → `POST /properties/:id/seal/sync` → receive `{ jobId }`.
2. Button enters spinner state; disabled.
3. Frontend polls `GET …/sync/status?jobId=…` every 1s.
4. On `completed`: refetch bills, refresh "última sincronización" timestamp,
   re-enable button. Toast: "6 recibos sincronizados, 1 PDF descargado".
5. On `failed`: toast with `error.message`, re-enable button. Property card
   shows the persisted `sealLastSyncError` until the next successful sync.

PDF icon → opens `/properties/:id/seal/bills/:billId/pdf` in a new tab.
Streamed inline (browser preview), not downloaded.

---

## 7. Configuration

New environment variables in `apps/api/.env`:

```bash
SEAL_BASE_URL=https://oficinavirtual.seal.com.pe
SEAL_EMAIL=<operator-email>
SEAL_PASSWORD=<operator-password>
SEAL_SESSION_TTL_MS=900000          # 15 min, conservative
SEAL_REQUEST_INTERVAL_MS=500        # politeness delay between SEAL calls in a single sync
SEAL_PDF_BUCKET=seal-invoices       # MinIO bucket, auto-created on boot if missing
```

`SealConfig` validates these at boot. Missing creds = boot fails fast (don't
silently degrade — the user will think sync works and lose hours debugging).

---

## 8. Risks & mitigations

| Risk                                                                                    | Mitigation                                                                                                                  |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| SEAL changes the HTML structure                                                         | Pure parsers + fixture tests catch breakage early. `SEAL_PARSE_FAILED` surfaces to the operator immediately, not silently.    |
| SEAL credentials rotate / get locked                                                    | `SEAL_AUTH_FAILED` raises to 502 with a clear message. No retry loops that could trigger account lockout.                    |
| Concurrent sessions invalidate each other (operator logs in via browser mid-sync)       | Re-login on next call. Worst case = one job fails and is retried. Single-concurrency queue prevents us self-interfering.     |
| 6-month window means new clients can't see older bills                                  | Documented limitation. Backfill happens naturally as months pass. A 30-min probe of the SEAL portal JS may reveal pagination — flag as a follow-up. |
| Bill amount in the detalle may not equal the PDF's grand total (carry-forward math)     | We store both. UI shows the detalle row amount; the PDF is authoritative. No reconciliation needed because amount is reference-only. |
| Operators expect SEAL kWh to feed tenant receipts                                       | Decision #2 makes this explicit. UI copy says "referencia" and there's no "Importar como lectura" button.                    |
| SEAL credentials in env get logged                                                      | `SealConfig` redacts `password` in any structured log via the existing redact helper. Code review must enforce.              |

---

## 9. Out of scope (v1)

- Water service. SEAL is light-only. Water has its own provider per region.
- Multi-tenant SEAL credentials (per-operator login). The system has one
  operator credential globally.
- Auto-applying SEAL kWh to receipt generation (explicit decision #2).
- Historical backfill beyond the 6-month detalle window.
- Email/SMS alerts when a new bill arrives.
- Anomaly detection on consumption jumps.
- A daily/weekly cron. Decision #3 — manual only in v1.
- A combined "all properties" dashboard. Each property's SEAL data lives on
  its own detail page.

---

## 10. File-touch summary

| Ticket | New                                                                                                                                                                                                | Modified                                                                                                  |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 07.1   | `apps/api/src/seal/{seal.config,seal.errors,seal.session,seal.client,seal.parser,seal.module}.ts` + `__fixtures__/*` + `seal.parser.spec.ts` + `seal.client.spec.ts`                                | `apps/api/package.json` (add `cheerio`), `apps/api/.env.example`                                          |
| 07.2   | `apps/api/src/seal-bill/{entities/seal-bill.entity,seal-bill.module,seal-bill.service}.ts`                                                                                                          | `apps/api/src/property/entities/property.entity.ts`, `apps/api/src/app.module.ts`                         |
| 07.3   | `apps/api/src/seal/{seal-sync.service,seal-sync.processor}.ts` + spec                                                                                                                              | `apps/api/src/queue/queue.module.ts`, `apps/api/src/seal/seal.module.ts`                                  |
| 07.4   | `apps/api/src/seal/{seal.controller,dto/*}.ts` + e2e spec                                                                                                                                          | `apps/api/src/seal/seal.module.ts`                                                                        |
| 07.5   | `apps/client/src/components/seal/{SealCard,SealBillsTable,SealLinkModal,SealKwhSparkline}.tsx`                                                                                                     | `apps/client/src/pages/PropertyDetail.tsx`, `apps/client/src/lib/api.ts`, `apps/client/src/types/seal.ts` |

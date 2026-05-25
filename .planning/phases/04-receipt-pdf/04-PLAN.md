# Phase 04 — Receipt PDF Generation + S3-Backed Storage

> Goal: Render a printable PDF for every receipt, persist it behind an S3-compatible storage interface (MinIO in dev, AWS S3 in prod), and drive generation through a BullMQ async job triggered manually from the receipt modal. Auto-regeneration when the underlying receipt is rebuilt.

This is a plan only. No source files are modified by this document.

---

## 0. Locked decisions

| Decision | Choice |
|---|---|
| Trigger | **Manual button in the receipt modal.** No auto-generation on status change. |
| Async strategy | **BullMQ + Redis**, in-process worker. No Lambda. |
| Storage | **S3 API**, one implementation. **MinIO** in dev, **AWS S3** in prod (swap = env var). |
| Library | `pdfkit` + `Roboto-Regular.ttf` for Unicode. |
| Regeneration | When `POST /contract/:id/receipt` rewrites a receipt that already has a `pdfKey`, **auto-enqueue** a fresh PDF job overwriting the same key. |
| Content | Receipt header + tenant full name + **tenant DNI** + property address + items table + totals. **No logo, no header image, no status pill.** |
| Locale | Spanish only (`es-PE`). |
| Status agnostic | PDF can be generated regardless of receipt status. Works under the current 3-state model and the planned 2-state model from Phase 05 with no rewrite. |

---

## 1. Trigger model

### Manual (primary)

User clicks **`Generar PDF`** in the receipt modal:

1. `POST /contracts/:contractId/receipts/:receiptId/pdf` → enqueues a BullMQ job.
2. Endpoint returns `202 Accepted` with `{ jobId, pdfStatus: 'queued' }`.
3. Frontend flips the button to a spinner labeled `Generando PDF…` and starts polling `GET …/pdf/status` every 1.5 s (max 60 s).
4. On `pdfStatus === 'ready'`, button swaps to `Descargar PDF`; on `'failed'`, swaps to `Reintentar` with an inline error chip.

### Auto-regeneration (secondary)

When `POST /contract/:contractId/receipt?month=&year=` rewrites a receipt:

- If the existing receipt row has `pdfKey != null` → call `pdfService.enqueueGeneration(receiptId)` after the receipt save commits. The same storage key is overwritten in place (no versioning).
- If `pdfKey IS NULL` → do nothing; the operator still must click `Generar PDF` for the first time.

### What the trigger does NOT depend on

- Receipt status (works for `pending_review` / `approved` / `denied` today, and for `unpaid` / `paid` post-Phase-05).
- Whether the receipt has a non-zero balance.

---

## 2. PDF content & layout

### Library: `pdfkit`

- **New runtime dep:** `pdfkit` (~1 MB install, no native binaries).
- **Font:** bundle `Roboto-Regular.ttf` (Apache 2.0) at `apps/api/src/receipt/pdf/fonts/` and register at module init. Default Helvetica is WinAnsi and renders Spanish accents incorrectly.
- **Output:** single-page A4 portrait, ~30 KB.

### Page sections (top → bottom)

| Section | Content | Source |
|---|---|---|
| Title block | `RECIBO DE ALQUILER` (24 pt) + period (`Mayo 2026`) + receipt ID short form | `period`, `id` |
| Tenant block | `Inquilino: <full name>` + `DNI: <documentId>` | `tenantName`, `tenantDocumentId` (new snapshot column, §4) |
| Property block | `Departamento: <name>` + `Dirección: <address>` | `departmentName`, `propertyAddress` |
| Items table | Two columns: `Descripción` / `Monto`. One row per `items[]` entry. Payments render with negative amounts (`- S/ 500.00`). | `items[]` |
| Totals block | `Total facturado: S/ X` / `Total pagado: S/ Y` / **bold** `Saldo: S/ Z` | `totalDue`, `totalPayments`, `balance` |
| Footer | `Generado el <fecha hora>` | `pdfGeneratedAt` |

### Formatting

- Currency: `Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' })` → `S/ 1,500.00`.
- Dates: `19 de mayo de 2026` via `toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' })`.
- Filename for `Content-Disposition`: `recibo-{contractIdShort}-{year}-{monthPadded}.pdf` (e.g. `recibo-c8a3-2026-05.pdf`).
- Storage key: `receipts/{contractId}/{receiptId}.pdf`.

### Explicitly out of scope

- Logos, brand colors, watermarks, status pills, signature lines, QR codes.
- Multi-page support (none expected; cap at one page).

---

## 3. Storage abstraction

Single driver: **S3 SDK pointing at any S3-compatible endpoint**. MinIO in dev is wire-compatible with AWS S3, so the storage layer has **one** implementation.

### Interface

```ts
// apps/api/src/storage/receipt-storage.interface.ts
export interface ReceiptStorage {
  upload(key: string, body: Buffer, contentType: string): Promise<void>;
  getDownloadUrl(key: string, opts?: {
    expiresInSec?: number;
    filename?: string;
  }): Promise<string>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

export const RECEIPT_STORAGE = Symbol('ReceiptStorage');
```

### Implementation

```ts
// apps/api/src/storage/s3-receipt-storage.ts
@Injectable()
export class S3ReceiptStorage implements ReceiptStorage {
  private client: S3Client;
  private bucket: string;

  constructor(config: ConfigService) {
    this.bucket = config.getOrThrow('AWS_S3_BUCKET');
    this.client = new S3Client({
      region: config.get('AWS_REGION', 'us-east-1'),
      endpoint: config.get('AWS_S3_ENDPOINT'),        // set → MinIO; unset → AWS
      forcePathStyle: !!config.get('AWS_S3_ENDPOINT'), // required for MinIO
      credentials: {
        accessKeyId: config.getOrThrow('AWS_ACCESS_KEY_ID'),
        secretAccessKey: config.getOrThrow('AWS_SECRET_ACCESS_KEY'),
      },
    });
  }

  upload(key, body, contentType) { /* PutObjectCommand */ }
  getDownloadUrl(key, opts)      { /* getSignedUrl + ResponseContentDisposition */ }
  delete(key)                    { /* DeleteObjectCommand */ }
  exists(key)                    { /* HeadObjectCommand, 404 → false */ }
}
```

Consumers inject with `@Inject(RECEIPT_STORAGE) private storage: ReceiptStorage`.

### MinIO setup (dev)

New `docker-compose.dev.yml` at repo root (or extend an existing compose file):

```yaml
services:
  minio:
    image: minio/minio:latest
    ports: ['9000:9000', '9001:9001']  # 9000=API, 9001=web console
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    command: server /data --console-address ':9001'
    volumes: [minio-data:/data]

  redis:
    image: redis:7-alpine
    ports: ['6379:6379']
    volumes: [redis-data:/data]

volumes:
  minio-data:
  redis-data:
```

Bucket bootstrap: on API boot, call `HeadBucket`; if 404, `CreateBucket`. No CLI step needed.

### Env config

| Var | Dev value | Prod value |
|---|---|---|
| `AWS_S3_BUCKET` | `receipts` | `<real bucket>` |
| `AWS_S3_ENDPOINT` | `http://localhost:9000` | *unset* |
| `AWS_REGION` | `us-east-1` | `<real region>` |
| `AWS_ACCESS_KEY_ID` | `minioadmin` | IAM-issued |
| `AWS_SECRET_ACCESS_KEY` | `minioadmin` | IAM-issued |
| `STORAGE_URL_TTL_SECONDS` | `300` | `300` |
| `REDIS_HOST` / `REDIS_PORT` | `localhost` / `6379` | managed Redis |

Production swap = unset `AWS_S3_ENDPOINT` + swap creds. No code change.

---

## 4. Job queue (BullMQ)

### Setup

- New deps: `bullmq`, `@nestjs/bullmq`, `ioredis`.
- Queue name: `receipt-pdf`.
- Concurrency: 2 workers in-process (sufficient for human-driven volume).
- Retry policy: 3 attempts, exponential backoff (1 s → 4 s → 16 s). After 3 fails → `pdfStatus='failed'`, manual retry only.
- Job data: `{ receiptId: string }` (everything else loaded from DB inside the worker).

### Worker flow

```ts
async process(job: Job<{ receiptId: string }>) {
  const receipt = await receiptRepo.findOne({ where: { id: job.data.receiptId } });
  if (!receipt) throw new ReceiptNotFoundError(job.data.receiptId);

  await receiptRepo.update(receipt.id, { pdfStatus: 'rendering' });

  const buffer = await pdfRenderer.render(receipt);
  const key = `receipts/${receipt.contractId}/${receipt.id}.pdf`;
  await storage.upload(key, buffer, 'application/pdf');

  await receiptRepo.update(receipt.id, {
    pdfKey: key,
    pdfContentType: 'application/pdf',
    pdfGeneratedAt: new Date(),
    pdfStatus: 'ready',
    pdfError: null,
  });
}
```

`onFailed` handler writes `pdfStatus='failed'`, `pdfError=<message>`. `pdfJobId` is updated on enqueue so the operator-facing endpoint can return current job state.

### Observability

- BullMQ Bull Board UI mounted at `/admin/queues` (gated by admin role) — out of scope for this phase, but the queue setup must support it.
- Structured logs in the worker include `receiptId`, `contractId`, `attempt`, `duration_ms`.

---

## 5. Persistence — `receipt_entity` additions

```ts
// Snapshot at issue/regen time (mirrors how tenantName is snapshotted)
@Column({ name: 'tenant_document_id', type: 'varchar', length: 32, nullable: true })
tenantDocumentId: string | null;

// PDF metadata
@Column({ name: 'pdf_key', type: 'varchar', length: 512, nullable: true })
pdfKey: string | null;

@Column({ name: 'pdf_generated_at', type: 'timestamptz', nullable: true })
pdfGeneratedAt: Date | null;

@Column({ name: 'pdf_content_type', type: 'varchar', length: 64, nullable: true })
pdfContentType: string | null;

@Column({
  name: 'pdf_status',
  type: 'varchar',
  length: 16,
  nullable: false,
  default: 'idle',
})
pdfStatus: 'idle' | 'queued' | 'rendering' | 'ready' | 'failed';

@Column({ name: 'pdf_error', type: 'text', nullable: true })
pdfError: string | null;

@Column({ name: 'pdf_job_id', type: 'varchar', length: 64, nullable: true })
pdfJobId: string | null;
```

### Snapshot logic update

`receipt.service.ts → createOrRegenerate()` must set `tenantDocumentId: tenant.documentId` alongside the existing `tenantName: tenant.fullName`. Old receipts persist with `tenantDocumentId = null`; the PDF renderer falls back to `—` for missing DNI (won't happen for new receipts).

### Migration safety

All new columns are nullable (or have safe defaults). `synchronize: true` picks them up without manual DDL. No backfill required.

---

## 6. API surface

| Verb | Path | Purpose |
|---|---|---|
| `POST` | `/contracts/:contractId/receipts/:receiptId/pdf` | Enqueue generation. Returns `202 { jobId, pdfStatus: 'queued' }`. Idempotent — if `pdfStatus IN ('queued','rendering')` already, returns the existing job. If `pdfStatus='ready'`, behaves as regenerate (overwrite). |
| `GET` | `/contracts/:contractId/receipts/:receiptId/pdf/status` | Returns `{ pdfStatus, pdfGeneratedAt, pdfError }`. Used by frontend polling. |
| `GET` | `/contracts/:contractId/receipts/:receiptId/pdf` | 302 redirect to a 5-min signed URL with `ResponseContentDisposition: attachment; filename="<localized>"`. 404 if `pdfKey IS NULL`. |
| `DELETE` | `/contracts/:contractId/receipts/:receiptId/pdf` | Removes the stored object and nulls the columns. **Internal only** — called by the receipt regenerate path on auto-update, and by Phase 05's status-revert flow if it lands. Not exposed to the UI. |

### Existing routes — adjustment

`POST /contract/:contractId/receipt` (Regenerar): after the receipt row save, **if the prior row had `pdfKey != null`**, call `pdfService.enqueueGeneration(receiptId)`. This satisfies the "regeneration updates the S3 PDF" rule.

### Error codes

| Code | When |
|---|---|
| `RECEIPT_NOT_FOUND` | 404 — no row for `(contractId, receiptId)` |
| `PDF_NOT_READY` | 404 — `GET …/pdf` when `pdfStatus != 'ready'` |
| `PDF_RENDER_FAILED` | 500 — worker exception; surfaces in `pdfError` |
| `STORAGE_UNAVAILABLE` | 503 — S3/MinIO 5xx or timeout |
| `QUEUE_UNAVAILABLE` | 503 — Redis unreachable |

---

## 7. Frontend touchpoints

### Receipt modal (`apps/client/src/pages/DepartmentBilling.tsx`)

Add a `Generar PDF` / `Descargar PDF` button to the receipt modal footer, **next to** the existing `Enviar por WhatsApp` placeholder.

State machine:

| `receipt.pdfStatus` | Button label | Behavior |
|---|---|---|
| `idle` (or absent) | `Generar PDF` | POST → start polling |
| `queued` / `rendering` | `Generando PDF…` (disabled, spinner) | poll `…/pdf/status` every 1.5 s |
| `ready` | `Descargar PDF` | window.location = `/contracts/:id/receipts/:id/pdf` (follows 302) |
| `failed` | `Reintentar` + small error chip | POST again |

### Extra UI

- Below the button: muted-text `Generado: <localized timestamp>` when `pdfGeneratedAt != null`.
- If the receipt is regenerated while the modal is open (operator clicks `Regenerar Recibo` after a PDF exists), reset the button state to `Generando PDF…` and resume polling — the auto-enqueue from §1 already started.

### Polling timeout

- Cap at 60 s. After timeout, button reverts to `Reintentar` with chip `Tiempo agotado, intenta de nuevo`.
- No websockets — keep the transport simple. Volume is low.

### Types

Extend the frontend `GeneratedReceipt` interface:

```ts
pdfKey: string | null;
pdfGeneratedAt: string | null;
pdfStatus: 'idle' | 'queued' | 'rendering' | 'ready' | 'failed';
pdfError: string | null;
```

---

## 8. Open questions

Only one remaining — everything else is locked.

| # | Question | Default if no answer |
|---|---|---|
| Q1 | Does the regenerate-on-update rule apply even if the operator regenerates the same receipt many times in a row (rapid clicks)? Should the queue debounce? | No debounce; BullMQ collapses to the most recent job because the queue uses `jobId = receiptId` (unique constraint per receipt). Older queued jobs get superseded. |

---

## 9. Risks & rollback

### Risks

- **Redis dependency in production.** New infra requirement. Mitigation: document in `.env.example` and deploy checklist; refuse to start if `REDIS_HOST` is unset.
- **Font Unicode mismatch.** Default `pdfkit` font breaks Spanish accents. Mitigation: bundle and register `Roboto-Regular.ttf` at module init; smoke test asserts `é`, `ñ`, `á` render correctly.
- **MinIO drift to prod.** Misconfiguring `AWS_S3_ENDPOINT` in prod points at MinIO inadvertently. Mitigation: boot-time assertion — refuse to start in `NODE_ENV=production` if `AWS_S3_ENDPOINT` is set to a `localhost` / private-IP address.
- **Stale signed URLs.** 5-min TTL; operator copies link and shares later. Mitigation: documented behavior; UI re-fetches via the `…/pdf` redirect each click.
- **Worker silent failure.** If the worker process dies, jobs queue up unprocessed. Mitigation: BullMQ stalled-job detection (default 30 s); health check endpoint exposes queue depth.
- **DNI null on old receipts.** Backfill not in scope. Renderer prints `—` for `tenantDocumentId IS NULL`. Acceptable since these are historical and never regenerated.
- **Bucket cost accumulation (S3 prod).** ~30 KB per receipt; no deletion policy. Confirm retention with stakeholders before go-live.

### Rollback

- Feature gate: `RECEIPT_PDF_ENABLED=true|false`, default `false`. When `false`:
  - `POST/GET/DELETE …/pdf` return `404 FEATURE_DISABLED`.
  - Worker does not register with BullMQ.
  - Frontend hides the `Generar PDF` button.
- Schema changes are additive nullable columns → safe to leave in place on rollback or drop in a separate migration.
- Auto-enqueue on `Regenerar` is gated by `pdfKey != null` → if PDFs were never generated, no behavioral change.

---

## 10. Sequencing vs Phase 05

This plan is **status-agnostic**. No code path here depends on the 3-state vs 2-state receipt model:

- The PDF renderer does not draw a status pill.
- The trigger is operator-driven, not status-driven.
- The DELETE endpoint is invoked by internal callers regardless of which status they care about.

→ Phase 04 can land **before, after, or in parallel** with Phase 05. No cross-phase merge conflicts expected. The only file Phase 05 will revisit in `apps/api/src/receipt/receipt.service.ts` is `createOrRegenerate()`, which Phase 04 also extends (to set `tenantDocumentId`). Whoever lands second resolves a small textual conflict in that one method.

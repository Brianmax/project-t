# Payments PDF Report — Implementation Plan

Status: drafted 2026-05-25. Linear epic: [TEN-25](https://linear.app/tenant-aqp/issue/TEN-25).
Children: TEN-26 (B1) · TEN-27 (B2) · TEN-28 (B3) · TEN-29 (F1) · TEN-30 (F2) · TEN-31 (F3).

## 1. Open questions

These must be answered before phase 1 begins. They override the original assumptions where conflict exists.

- **Payment `type` column.** `OPERATOR_GUIDE.md` describes `advance` / `guarantee` / `refund` types and validations (`PAYMENT_TYPE_REQUIRED`, `INVALID_STANDALONE_TYPE`, `NEGATIVE_AMOUNT_REQUIRES_REFUND`, `FUTURE_PAYMENT_DATE`), but `apps/api/src/payment/entities/payment.entity.ts` has no `type` column and `create-payment.dto.ts` has no future-date or negative-amount validator. Confirm: do we (a) treat the report as type-agnostic and group only by `method`, or (b) add the `type` column first as a prerequisite phase? **Recommended: (a).** Group standalone payments under "Sin recibo" and skip the type subtotals from constraint #5 until the column exists.
- **Scope shape.** Three concrete shapes; pick one for v1:
  1. Per-contract statement (`GET /contracts/:contractId/payments/report`).
  2. Per-tenant rollup across all their contracts.
  3. Per-property rollup across all units.
     **Recommended: (1) only for v1.** Property/tenant rollups in v2.
- **Sync vs async generation.** The receipt PDF flow uses BullMQ + S3 + signed URL (async). For a payments report, a per-contract statement is small (one query, no per-row I/O); a synchronous endpoint returning `application/pdf` is simpler and avoids polling UX. **Recommended: sync** for v1, matching the small payload. Revisit if any single statement exceeds ~500 rows.
- **Auth.** Confirm the JWT guard from `apps/api/src/auth/guards/jwt.guard.ts` is applied globally (via `APP_GUARD`) or per-controller. The report endpoint must require auth.
- **Ownership model.** What identifies "the owning operator/admin"? `recordedBy` on Payment is set but Contract has no `ownerId` visible from the entity scan. Confirm the existing pattern used by `payment.controller.ts findAll` — it currently has no scoping. The report endpoint must not be looser than payment listing.
- **Currency / locale.** Reuse `Intl.NumberFormat('es-PE', { currency: 'PEN' })` and `es-PE` dates already used in `receipt-pdf.renderer.ts`. Confirm.

---

## 2. Backend plan

### Phase B1 — Report query service (TEN-26)

- **Goal.** Build a read-only query that returns the ordered payment rows + summary needed by the PDF.
- **Files to create.**
  - `apps/api/src/payment/report/payment-report.service.ts`
  - `apps/api/src/payment/report/payment-report.types.ts`
  - `apps/api/src/payment/report/payment-report.service.spec.ts`
- **Files to modify.**
  - `apps/api/src/payment/payment.module.ts` — register `PaymentReportService`.
- **Service method.**
  ```ts
  buildReport(input: {
    contractId: string;
    from?: Date;          // inclusive, payment.date >= from
    to?: Date;            // inclusive, payment.date <= to
    method?: PaymentMethod;
  }): Promise<PaymentReportData>
  ```
  Query: `payments JOIN contract JOIN tenant JOIN department JOIN property` plus `LEFT JOIN receipt` (for the linked-receipt period column). Order by `payment.date ASC, payment.createdAt ASC` (deterministic).
- **Returned shape (`PaymentReportData`).**
  ```ts
  {
    header: {
      contractId: string;
      tenantName: string;
      departmentName: string;
      propertyAddress: string;
      contractStart: string;
      contractEnd: string | null;
    }
    filters: {
      from: string | null;
      to: string | null;
      method: PaymentMethod | null;
    }
    rows: Array<{
      id: string;
      date: string; // YYYY-MM-DD
      method: PaymentMethod;
      reference: string | null;
      receiptPeriod: string | null; // e.g. "Apr 2026" or null = "Sin recibo"
      description: string | null;
      amount: number;
    }>;
    totals: {
      gross: number; // sum of all rows
      byMethod: Record<PaymentMethod, number>;
      refunds: number; // sum of negative rows
      receivedNet: number; // gross (already includes refunds since refunds are negative)
    }
  }
  ```
- **Validation rules.** None at this layer (input is already DTO-validated).
- **Acceptance checks.**
  - Unit test: contract with 0 payments → empty `rows`, all totals 0.
  - Unit test: contract with 3 payments (one negative refund) → totals add up; `refunds` is the sum of the negative one only.
  - Unit test: `method` filter applied → only matching rows returned, but `byMethod` totals still computed over the filtered set.
  - Unit test: `from`/`to` boundaries are inclusive.

### Phase B2 — DTO + controller endpoint (TEN-27)

- **Goal.** Expose the data and PDF endpoints with input validation.
- **Files to create.**
  - `apps/api/src/payment/report/payment-report.controller.ts`
  - `apps/api/src/payment/report/dto/payment-report-query.dto.ts`
- **Files to modify.**
  - `apps/api/src/payment/payment.module.ts` — register `PaymentReportController`.
- **DTO (`PaymentReportQueryDto`).**
  ```ts
  @IsDateString() @IsOptional() from?: string;
  @IsDateString() @IsOptional() to?: string;
  @IsEnum(PaymentMethod) @IsOptional() method?: PaymentMethod;
  ```
  Cross-field validation in the controller (or a custom validator): if both set, `to >= from`; reject `to > today`.
- **Endpoints.**
  - `GET /contracts/:contractId/payments/report` → `200 application/json` returning `PaymentReportData` (used by the UI to render an in-page preview before downloading).
  - `GET /contracts/:contractId/payments/report.pdf` → `200 application/pdf`, `Content-Disposition: attachment; filename="reporte-pagos-<contractShort>-<from>-<to>.pdf"`.
- **Error codes.**
  - `404 CONTRACT_NOT_FOUND` — contract id does not exist.
  - `400 INVALID_DATE_RANGE` — `to < from` or `to > today`.
  - `400 INVALID_METHOD` — out of enum (class-validator covers, but normalise error code).
- **Auth.** Apply the same JWT guard already used by `PaymentController`. Do not add new role requirements; match `findAll`.
- **Acceptance checks.**
  - `curl -H 'Authorization: Bearer …' .../contracts/<id>/payments/report` returns 200 with the shape above.
  - Missing contract returns 404 with `CONTRACT_NOT_FOUND`.
  - `?to=2099-01-01` returns 400 with `INVALID_DATE_RANGE`.
  - `report.pdf` returns a non-zero-length PDF (`file -` reports `PDF document`).

### Phase B3 — PDF renderer (sync, in-process) (TEN-28)

- **Goal.** Stream a PDF to the HTTP response, reusing `pdfkit` exactly like the receipt path.
- **Files to create.**
  - `apps/api/src/payment/report/payment-report.renderer.ts`
  - `apps/api/src/payment/report/payment-report.renderer.spec.ts`
- **Reuse.** Copy the font setup, currency formatter, and palette constants from `apps/api/src/receipt/pdf/receipt-pdf.renderer.ts` (do not introduce a new font directory — load the same files from `receipt/pdf/fonts/`). If duplication grows, extract `apps/api/src/pdf/common/` in a follow-up; do not do it preemptively.
- **Renderer signature.**
  ```ts
  render(data: PaymentReportData, generatedAt: Date, operatorName: string): NodeJS.ReadableStream
  ```
- **Pagination.** `pdfkit` adds pages automatically; check `doc.y > pageBottom - rowHeight` before each row and call `doc.addPage()` + re-draw the column header.
- **Determinism.** Only `generatedAt` (passed in by the controller as `new Date()`) is non-deterministic. The renderer itself takes no `new Date()`.
- **Acceptance checks.**
  - Spec: golden-snapshot the page count and first-page text for a fixed `PaymentReportData` + fixed `generatedAt`.
  - Spec: a 60-row dataset produces ≥ 2 pages; the second page has the column header.
  - Spec: a row with `amount = -150` renders with a leading minus and in the negative colour.

---

## 3. PDF rendering plan

Reused stack — see `apps/api/src/receipt/pdf/receipt-pdf.renderer.ts`:

- `pdfkit` `A4`, `margin: 56`.
- Fonts `Roboto-Regular.ttf` / `Roboto-Bold.ttf` from `apps/api/src/receipt/pdf/fonts/`.
- Palette and `Intl.NumberFormat('es-PE', { currency: 'PEN' })`.

Layout sketch:

```
┌──────────────────────────────────────────────────────────────┐
│ REPORTE DE PAGOS                              <generated-at>  │
│ Propiedad: <propertyAddress>                                  │
│ Depto: <departmentName> · Inquilino: <tenantName>             │
│ Contrato: <start> – <end ?? "vigente">                        │
├──────────────────────────────────────────────────────────────┤
│ Filtros: desde <from?>  hasta <to?>  método <method?>         │
├───────────┬────────┬──────────────┬───────────┬───────┬──────┤
│ Fecha     │ Método │ Referencia   │ Recibo    │ Notas │ Monto│
├───────────┼────────┼──────────────┼───────────┼───────┼──────┤
│ 2026-04-05│ yape   │ #TX-9182     │ Abr 2026  │ —     │ 1 200│
│ 2026-04-12│ cash   │ —            │ Sin recibo│ adelanto│ 500│
│ 2026-04-20│ yape   │ #TX-9201     │ Abr 2026  │ refund│ -150│
├───────────┴────────┴──────────────┴───────────┴───────┴──────┤
│ Subtotal por método: cash 500.00 · yape 1 050.00              │
│ Reembolsos: -150.00                                           │
│ Total recibido (neto): S/ 1 550.00                            │
├──────────────────────────────────────────────────────────────┤
│ Generado: <generatedAt> por <operatorName>                    │
└──────────────────────────────────────────────────────────────┘
```

- Amount column right-aligned. Negative amounts use `COLOR.negative` and a leading `-`.
- Zebra striping on rows using `COLOR.rowAlt` (already in `receipt-pdf.renderer.ts`).
- On a new page, redraw only the column header strip (not the document header).

---

## 4. Frontend plan

### Phase F1 — API client + types (TEN-29)

- **Goal.** Add the two endpoints to the API client.
- **Files to modify.**
  - `apps/client/src/lib/api.ts` — add `getPaymentReport(contractId, query)` returning `PaymentReportData`, and `downloadPaymentReportPdf(contractId, query)` that fetches the PDF as a `Blob` and triggers a save via `URL.createObjectURL` + a synthetic `<a download>`. No barrel files.
- **Files to create.**
  - `apps/client/src/types/payment-report.ts` — local mirror of the backend `PaymentReportData` shape (TypeScript-only, hand-maintained).
- **Acceptance checks.**
  - Manually call `getPaymentReport` from `Payments.tsx` (temp button) → shape matches.

### Phase F2 — Trigger UI on the existing Payments page (TEN-30)

- **Goal.** Add a "Generar reporte" button + filter modal on `apps/client/src/pages/Payments.tsx`. v1 only allows per-contract; the contract picker reuses the same dropdown logic already on that page.
- **Files to create.**
  - `apps/client/src/components/payments/PaymentReportModal.tsx` — modal with: contract select (required), date range (`from`, `to`), method select. Submit button labelled "Descargar PDF".
- **Files to modify.**
  - `apps/client/src/pages/Payments.tsx` — add the trigger button in `PageHeader` actions; wire to `PaymentReportModal`.
- **Filter controls.**
  - `contractId` — required; default to currently filtered contract if any.
  - `from`, `to` — both optional; if both set, client-side check `to >= from` (mirror the backend rule) and disable submit otherwise.
  - `method` — optional select including a "Todos" sentinel.
- **States.** Use semantic Tailwind tokens (`surface`, `on-surface`, `status-danger-*`) from `lib/styles.ts`. Loading: spinner inside submit button. Error: inline alert showing the backend error code mapped to Spanish. Empty result (zero rows): backend still returns a PDF; client downloads it — no special UI.
- **Acceptance checks.**
  - Click "Descargar PDF" downloads a file named `reporte-pagos-…pdf`.
  - With `from` > `to`, submit is disabled.
  - With a non-existent `contractId` (manually crafted), the modal shows "Contrato no encontrado".

### Phase F3 — Trigger UI inside the contract / receipt context (TEN-31)

- **Goal.** Surface the same report from `DepartmentBilling.tsx` so operators can pull a statement without leaving the billing view.
- **Files to modify.**
  - `apps/client/src/pages/DepartmentBilling.tsx` — add a secondary action button next to the existing "Pagos registrados" section header that opens `PaymentReportModal` pre-filled with the current contract.
- **Acceptance checks.**
  - Opening the modal from this page shows `Contrato` field locked to the current contract.
  - Downloaded PDF header matches the current contract.

---

## 5. Roll-out & verification

- **Migrations.** Expected: **none.** Confirm by running `cd apps/api && npx tsc --noEmit` and `docker compose up -d` against a fresh DB to ensure `synchronize: true` does not propose schema changes. If `Payment.type` is added later (see Open Questions), that is a separate phase with its own migration.
- **Feature flag.** Mirror `ReceiptPdfFeatureGuard` if a soft-launch is desired (`PAYMENT_REPORT_ENABLED=true`); otherwise ship directly. Decision: skip the guard for v1 — the feature is low-risk and read-only.
- **Manual QA script.**
  1. Seed contract A with 3 payments in April 2026, 1 refund of -150 in April, 1 standalone advance of 500 in May.
  2. Open Payments page → click "Generar reporte" → select contract A, no date filter → download.
  3. Verify PDF lists 5 rows in date order, refund row is red with leading `-`, total recibido = sum of amounts.
  4. Re-open modal → set `from=2026-04-01`, `to=2026-04-30` → download. Confirm only April rows appear and totals recompute.
  5. Re-open → method = `yape` → confirm only yape rows; `Subtotal por método` shows only `yape`.
  6. Re-open with contract B that has 0 payments → confirm a 1-page PDF rendering "Total recibido: S/ 0.00".
  7. Seed contract C with 70 payments → confirm the PDF is multi-page and the column header appears on page 2+.
  8. Set `to=2099-01-01` → confirm UI blocks submit and (if forced via devtools) backend returns 400 `INVALID_DATE_RANGE`.
- **Risk list.**
  - **Timezone drift.** `payment.date` is `type: 'date'` (no time). Compare in UTC consistently in the query; render with `es-PE` and no time. Detect: fixture with a payment on the from/to boundary date.
  - **Decimal rounding.** TypeORM returns `decimal` columns as strings. Coerce to `number` once in `payment-report.service.ts`, never inside the renderer. Detect: assertion that totals match a hand-computed sum exactly.
  - **Missing receipt link.** Payments without `receiptId` must render as "Sin recibo". Detect: golden snapshot of mixed dataset.
  - **PDF stream backpressure.** `pdfkit` streams; verify the controller pipes to `res` via `.pipe(res)` and awaits `end`. Detect: large dataset still completes (phase B3 test 2).
  - **Concurrent downloads.** Two clicks within a second start two requests. Acceptable — endpoint is read-only.

---

## 6. Out of scope for v1

- Per-tenant rollup across multiple contracts.
- Per-property rollup.
- CSV / Excel export.
- Charts or visualisations (e.g., payments by month).
- Email or WhatsApp delivery.
- Scheduled / recurring report generation.
- Persisting generated PDFs in S3 / MinIO (current plan streams sync).
- Per-method or per-type subtotals beyond what's listed in section 3 (revisit once the `Payment.type` column lands).
- Tenant self-service download.

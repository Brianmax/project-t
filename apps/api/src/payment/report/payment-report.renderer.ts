import { join } from 'path';
import PDFDocument from 'pdfkit';
import { PaymentMethod } from '../entities/payment.entity';
import { PaymentReportData, PaymentReportRow } from './payment-report.types';

const FONTS_DIR = join(__dirname, '..', '..', 'receipt', 'pdf', 'fonts');
const FONT_REGULAR = join(FONTS_DIR, 'Roboto-Regular.ttf');
const FONT_BOLD = join(FONTS_DIR, 'Roboto-Bold.ttf');

const COLOR = {
  accent: '#2563eb',
  ink: '#111827',
  text: '#374151',
  muted: '#6b7280',
  border: '#e5e7eb',
  rowAlt: '#f9fafb',
  cardBg: '#f3f4f6',
  positive: '#059669',
  negative: '#dc2626',
} as const;

const currency = new Intl.NumberFormat('es-PE', {
  style: 'currency',
  currency: 'PEN',
});

const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Efectivo',
  bank_transfer: 'Transferencia',
  yape: 'Yape',
  plin: 'Plin',
  other: 'Otro',
};

const PAGE_MARGIN = 56;
const ROW_HEIGHT = 20;
const COL_HEADER_HEIGHT = 22;

const COLUMNS = [
  { key: 'date', header: 'Fecha', width: 72 },
  { key: 'method', header: 'Método', width: 80 },
  { key: 'reference', header: 'Referencia', width: 88 },
  { key: 'receiptPeriod', header: 'Recibo', width: 72 },
  { key: 'description', header: 'Notas', width: 120 },
  { key: 'amount', header: 'Monto', width: 80 },
] as const;

export class PaymentReportRenderer {
  render(
    data: PaymentReportData,
    generatedAt: Date,
    operatorName: string,
  ): NodeJS.ReadableStream {
    const doc = new PDFDocument({
      size: 'A4',
      margin: PAGE_MARGIN,
      bufferPages: true,
    });

    doc.registerFont('regular', FONT_REGULAR);
    doc.registerFont('bold', FONT_BOLD);

    this.layout(doc, data, generatedAt, operatorName);
    doc.end();
    return doc;
  }

  private layout(
    doc: PDFKit.PDFDocument,
    data: PaymentReportData,
    generatedAt: Date,
    operatorName: string,
  ): void {
    const pageW = doc.page.width;
    const left = PAGE_MARGIN;
    const right = pageW - PAGE_MARGIN;
    const W = right - left;
    const pageBottom = doc.page.height - PAGE_MARGIN;

    doc.rect(0, 0, pageW, 6).fill(COLOR.accent);

    doc
      .fillColor(COLOR.ink)
      .font('bold')
      .fontSize(22)
      .text('REPORTE DE PAGOS', left, 42);

    const genStr = generatedAt.toLocaleDateString('es-PE', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    const genTime = generatedAt.toLocaleTimeString('es-PE', {
      hour: '2-digit',
      minute: '2-digit',
    });
    doc
      .fillColor(COLOR.muted)
      .font('regular')
      .fontSize(9)
      .text(`${genStr} · ${genTime}`, left, doc.y + 2, {
        width: W,
        align: 'right',
      });

    let y = 82;
    this.divider(doc, left, right, y);

    y += 14;
    doc
      .fillColor(COLOR.muted)
      .font('bold')
      .fontSize(8)
      .text('PROPIEDAD', left, y, { characterSpacing: 1.2 })
      .text('INQUILINO', left + W / 2, y, { characterSpacing: 1.2 });

    doc
      .fillColor(COLOR.ink)
      .font('bold')
      .fontSize(11)
      .text(data.header.propertyAddress, left, y + 13, {
        width: W / 2 - 8,
        lineBreak: false,
        ellipsis: true,
      })
      .text(data.header.tenantName, left + W / 2, y + 13, {
        width: W / 2 - 8,
        lineBreak: false,
        ellipsis: true,
      });

    y += 30;
    doc
      .fillColor(COLOR.text)
      .font('regular')
      .fontSize(9)
      .text(`Depto: ${data.header.departmentName}`, left, y, {
        width: W / 2 - 8,
      });
    const contractEnd = data.header.contractEnd ?? 'vigente';
    doc.text(
      `Contrato: ${data.header.contractStart} – ${contractEnd}`,
      left + W / 2,
      y,
      { width: W / 2 - 8 },
    );

    y += 20;
    this.divider(doc, left, right, y);

    y += 10;
    const filterParts: string[] = [];
    if (data.filters.from) filterParts.push(`desde ${data.filters.from}`);
    if (data.filters.to) filterParts.push(`hasta ${data.filters.to}`);
    if (data.filters.method)
      filterParts.push(`método ${METHOD_LABELS[data.filters.method]}`);
    if (filterParts.length > 0) {
      doc
        .fillColor(COLOR.muted)
        .font('regular')
        .fontSize(9)
        .text(`Filtros: ${filterParts.join('  ·  ')}`, left, y, { width: W });
      y += 16;
    }

    y += 6;
    this.drawColumnHeader(doc, left, y, W);
    y += COL_HEADER_HEIGHT;

    for (let i = 0; i < data.rows.length; i++) {
      if (y + ROW_HEIGHT > pageBottom) {
        doc.addPage();
        y = PAGE_MARGIN;
        this.drawColumnHeader(doc, left, y, W);
        y += COL_HEADER_HEIGHT;
      }
      const row = data.rows[i];
      if (i % 2 === 1) {
        doc.rect(left, y, W, ROW_HEIGHT).fill(COLOR.rowAlt);
      }
      this.drawRow(doc, left, y, row);
      y += ROW_HEIGHT;
    }

    if (data.rows.length > 0) {
      doc
        .rect(
          left,
          y - ROW_HEIGHT * data.rows.length - COL_HEADER_HEIGHT,
          W,
          ROW_HEIGHT * data.rows.length + COL_HEADER_HEIGHT,
        )
        .lineWidth(0.5)
        .strokeColor(COLOR.border)
        .stroke();
    }

    y += 18;
    if (y + 100 > pageBottom) {
      doc.addPage();
      y = PAGE_MARGIN;
    }

    this.divider(doc, left, right, y);
    y += 12;

    const methodParts = Object.entries(data.totals.byMethod)
      .filter(([, v]) => v !== 0)
      .map(
        ([k, v]) =>
          `${METHOD_LABELS[k as PaymentMethod]} ${currency.format(v)}`,
      );
    if (methodParts.length > 0) {
      doc
        .fillColor(COLOR.text)
        .font('regular')
        .fontSize(9)
        .text(`Subtotal por método: ${methodParts.join(' · ')}`, left, y, {
          width: W,
        });
      y += 14;
    }

    if (data.totals.refunds < 0) {
      doc
        .fillColor(COLOR.negative)
        .font('regular')
        .fontSize(9)
        .text(`Reembolsos: ${currency.format(data.totals.refunds)}`, left, y, {
          width: W,
        });
      y += 14;
    }

    doc
      .fillColor(COLOR.ink)
      .font('bold')
      .fontSize(11)
      .text(
        `Total recibido (neto): ${currency.format(data.totals.receivedNet)}`,
        left,
        y,
        { width: W },
      );

    y += 30;
    if (y + 20 > pageBottom) {
      doc.addPage();
      y = PAGE_MARGIN;
    }
    this.divider(doc, left, right, y);
    doc
      .fillColor(COLOR.muted)
      .font('regular')
      .fontSize(8)
      .text(
        `Generado: ${genStr} · ${genTime} por ${operatorName || '—'}`,
        left,
        y + 10,
        { width: W, align: 'center' },
      );
  }

  private drawColumnHeader(
    doc: PDFKit.PDFDocument,
    left: number,
    y: number,
    W: number,
  ): void {
    doc.rect(left, y, W, COL_HEADER_HEIGHT).fill(COLOR.cardBg);
    let x = left;
    for (const col of COLUMNS) {
      doc
        .fillColor(COLOR.muted)
        .font('bold')
        .fontSize(8)
        .text(col.header, x + 6, y + 7, {
          width: col.width - 12,
          characterSpacing: 0.8,
          lineBreak: false,
        });
      x += col.width;
    }
  }

  private drawRow(
    doc: PDFKit.PDFDocument,
    left: number,
    y: number,
    row: PaymentReportRow,
  ): void {
    let x = left;

    for (const col of COLUMNS) {
      const key = col.key as keyof PaymentReportRow;
      const val = row[key];
      let text: string;
      let color: string = COLOR.text;
      let font: string = 'regular';
      let align: 'left' | 'right' = 'left';

      switch (col.key) {
        case 'date':
          text = String(val);
          break;
        case 'method':
          text = METHOD_LABELS[val as PaymentMethod] ?? String(val);
          break;
        case 'reference':
          text = val ? String(val) : '—';
          break;
        case 'receiptPeriod':
          text = val ? String(val) : 'Sin recibo';
          break;
        case 'description':
          text = val ? String(val) : '—';
          break;
        case 'amount': {
          const amt = Number(val);
          text =
            amt < 0
              ? `- ${currency.format(Math.abs(amt))}`
              : currency.format(amt);
          color = amt < 0 ? COLOR.negative : COLOR.ink;
          font = 'bold';
          align = 'right';
          break;
        }
        default:
          text = String(val ?? '');
      }

      doc
        .fillColor(color)
        .font(font)
        .fontSize(8)
        .text(text, x + 6, y + 6, {
          width: col.width - 12,
          align,
          lineBreak: false,
          ellipsis: true,
        });
      x += col.width;
    }
  }

  private divider(
    doc: PDFKit.PDFDocument,
    left: number,
    right: number,
    y: number,
  ): void {
    doc
      .moveTo(left, y)
      .lineTo(right, y)
      .lineWidth(0.5)
      .strokeColor(COLOR.border)
      .stroke();
  }
}

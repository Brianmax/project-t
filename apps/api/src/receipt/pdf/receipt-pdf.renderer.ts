import { Injectable } from '@nestjs/common';
import { join } from 'path';
import PDFDocument from 'pdfkit';
import { ReceiptEntity } from '../entities/receipt.entity';

const FONTS_DIR = join(__dirname, 'fonts');
const FONT_REGULAR = join(FONTS_DIR, 'Roboto-Regular.ttf');
const FONT_BOLD = join(FONTS_DIR, 'Roboto-Bold.ttf');

// Palette — neutral with a single blue accent and red/green for the saldo.
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

function fmtDateTime(d: Date): string {
  const date = d.toLocaleDateString('es-PE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const time = d.toLocaleTimeString('es-PE', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${date} · ${time}`;
}

function formatAmount(amount: number): { text: string; negative: boolean } {
  const negative = amount < 0;
  const text = negative
    ? `- ${currency.format(Math.abs(amount))}`
    : currency.format(amount);
  return { text, negative };
}

@Injectable()
export class ReceiptPdfRenderer {
  async render(receipt: ReceiptEntity): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 56 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.registerFont('regular', FONT_REGULAR);
      doc.registerFont('bold', FONT_BOLD);

      try {
        this.layout(doc, receipt);
        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  private layout(doc: PDFKit.PDFDocument, r: ReceiptEntity): void {
    const pageW = doc.page.width;
    const left = doc.page.margins.left;
    const right = pageW - doc.page.margins.right;
    const W = right - left;

    // ── Accent bar (full bleed across the top) ──────────────────────
    doc.rect(0, 0, pageW, 6).fill(COLOR.accent);

    // ── Title block ────────────────────────────────────────────────
    doc
      .fillColor(COLOR.ink)
      .font('bold')
      .fontSize(26)
      .text('RECIBO DE ALQUILER', left, 48, { characterSpacing: 0.4 });

    doc
      .fillColor(COLOR.muted)
      .font('regular')
      .fontSize(12)
      .text(`Período · ${r.period}`, left, doc.y + 2);

    // Receipt id (top-right)
    if (r.id) {
      const idValue = r.id.slice(0, 8).toUpperCase();
      doc
        .fillColor(COLOR.muted)
        .font('regular')
        .fontSize(8)
        .text('RECIBO N°', right - 130, 52, {
          width: 130,
          align: 'right',
          characterSpacing: 1.2,
        });
      doc
        .fillColor(COLOR.ink)
        .font('bold')
        .fontSize(11)
        .text(idValue, right - 130, 64, {
          width: 130,
          align: 'right',
        });
    }

    // ── Divider after title ────────────────────────────────────────
    let y = 112;
    this.divider(doc, left, right, y);

    // ── Two-column info block ──────────────────────────────────────
    y += 18;
    const colW = (W - 24) / 2;
    const col1X = left;
    const col2X = left + colW + 24;

    doc
      .fillColor(COLOR.muted)
      .font('bold')
      .fontSize(8)
      .text('INQUILINO', col1X, y, { characterSpacing: 1.2 })
      .text('PROPIEDAD', col2X, y, { characterSpacing: 1.2 });

    doc
      .fillColor(COLOR.ink)
      .font('bold')
      .fontSize(13)
      .text(r.tenantName, col1X, y + 14, { width: colW });

    doc.text(r.departmentName, col2X, y + 14, { width: colW });

    doc
      .fillColor(COLOR.text)
      .font('regular')
      .fontSize(10)
      .text(`DNI: ${r.tenantDocumentId ?? '—'}`, col1X, y + 32, {
        width: colW,
      });

    doc.text(r.propertyAddress, col2X, y + 32, { width: colW });

    // ── Divider before items ───────────────────────────────────────
    y += 70;
    this.divider(doc, left, right, y);

    // ── Items table header ─────────────────────────────────────────
    y += 14;
    const tableHeaderH = 22;
    doc.rect(left, y, W, tableHeaderH).fill(COLOR.cardBg);

    doc
      .fillColor(COLOR.muted)
      .font('bold')
      .fontSize(9)
      .text('DESCRIPCIÓN', left + 12, y + 7, {
        characterSpacing: 1,
      })
      .text('MONTO', left, y + 7, {
        width: W - 12,
        align: 'right',
        characterSpacing: 1,
      });

    y += tableHeaderH;

    // ── Items rows (zebra stripes) ─────────────────────────────────
    const items = r.items ?? [];
    const rowH = 22;
    items.forEach((item, i) => {
      if (i % 2 === 1) {
        doc.rect(left, y, W, rowH).fill(COLOR.rowAlt);
      }
      const amount = Number(item.amount);
      const { text, negative } = formatAmount(amount);

      doc
        .fillColor(COLOR.text)
        .font('regular')
        .fontSize(10)
        .text(item.description, left + 12, y + 6, {
          width: W - 130,
          lineBreak: false,
          ellipsis: true,
        });

      doc
        .fillColor(negative ? COLOR.muted : COLOR.ink)
        .font('regular')
        .fontSize(10)
        .text(text, left, y + 6, {
          width: W - 12,
          align: 'right',
        });

      y += rowH;
    });

    // Border around the table
    doc
      .rect(
        left,
        y - rowH * items.length - tableHeaderH,
        W,
        rowH * items.length + tableHeaderH,
      )
      .lineWidth(0.5)
      .strokeColor(COLOR.border)
      .stroke();

    // ── Carry forward debts (if any) ──────────────────────────────
    const carryForward = (r as any).carryForwardDetails as Array<{
      period: string;
      balance: number;
    }> | null;
    let totalCarryForward = 0;

    if (carryForward && carryForward.length > 0) {
      y += 24;
      doc
        .fillColor(COLOR.muted)
        .font('bold')
        .fontSize(9)
        .text('SALDO ANTERIOR (DEUDA PENDIENTE)', left, y, {
          characterSpacing: 1,
        });
      y += 14;

      carryForward.forEach((item) => {
        const amount = Number(item.balance);
        totalCarryForward += amount;
        doc
          .fillColor(COLOR.text)
          .font('regular')
          .fontSize(10)
          .text(`Saldo pendiente · ${item.period}`, left + 12, y);

        doc
          .fillColor(COLOR.negative)
          .text(currency.format(amount), left, y, {
            width: W - 12,
            align: 'right',
          });
        y += 16;
      });
      y += 8;
      this.divider(doc, left, right, y);
    }

    // ── Totals card (right-aligned) ────────────────────────────────
    y += 22;
    const cardW = 240;
    const cardX = right - cardW;
    const hasCarryForward = totalCarryForward > 0;
    const cardH = hasCarryForward ? 114 : 96;
    const balance = Number(r.balance);
    const balanceColor = balance < 0 ? COLOR.negative : COLOR.positive;

    doc
      .rect(cardX, y, cardW, cardH)
      .lineWidth(0.5)
      .strokeColor(COLOR.border)
      .stroke();

    const innerL = cardX + 16;
    const innerR = cardX + cardW - 16;
    const innerW = innerR - innerL;

    // Line: Total facturado
    let lineY = y + 14;
    doc
      .fillColor(COLOR.muted)
      .font('regular')
      .fontSize(9)
      .text('Total mes actual', innerL, lineY, { characterSpacing: 0.6 });
    doc
      .fillColor(COLOR.text)
      .font('regular')
      .fontSize(11)
      .text(currency.format(Number(r.totalDue)), innerL, lineY - 1, {
        width: innerW,
        align: 'right',
      });

    // Line: Saldo anterior (if applicable)
    if (hasCarryForward) {
      lineY = y + 32;
      doc
        .fillColor(COLOR.muted)
        .font('regular')
        .fontSize(9)
        .text('Saldo anterior', innerL, lineY, { characterSpacing: 0.6 });
      doc
        .fillColor(COLOR.negative)
        .font('regular')
        .fontSize(11)
        .text(currency.format(totalCarryForward), innerL, lineY - 1, {
          width: innerW,
          align: 'right',
        });
    }

    // Line: Total pagado
    lineY = y + (hasCarryForward ? 50 : 32);
    doc
      .fillColor(COLOR.muted)
      .font('regular')
      .fontSize(9)
      .text('Total pagado', innerL, lineY, { characterSpacing: 0.6 });
    doc
      .fillColor(COLOR.text)
      .font('regular')
      .fontSize(11)
      .text(currency.format(Number(r.totalPayments)), innerL, lineY - 1, {
        width: innerW,
        align: 'right',
      });

    // Separator inside card
    const sepY = hasCarryForward ? 74 : 56;
    doc
      .moveTo(innerL, y + sepY)
      .lineTo(innerR, y + sepY)
      .lineWidth(0.5)
      .strokeColor(COLOR.border)
      .stroke();

    // Line: Saldo (emphasized)
    lineY = hasCarryForward ? 88 : 70;
    const totalBalance = balance - totalCarryForward;
    const totalBalanceColor = totalBalance < 0 ? COLOR.negative : COLOR.positive;

    doc
      .fillColor(COLOR.ink)
      .font('bold')
      .fontSize(10)
      .text('TOTAL DEUDA', innerL, lineY, { characterSpacing: 1 });
    doc
      .fillColor(totalBalanceColor)
      .font('bold')
      .fontSize(15)
      .text(currency.format(Math.abs(totalBalance)), innerL, lineY - 4, {
        width: innerW,
        align: 'right',
      });

    // ── Footer ─────────────────────────────────────────────────────
    const footY = y + cardH + 36;
    this.divider(doc, left, right, footY);

    doc
      .fillColor(COLOR.muted)
      .font('regular')
      .fontSize(8)
      .text(`Generado el ${fmtDateTime(new Date())}`, left, footY + 10, {
        width: W,
        align: 'center',
      });
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

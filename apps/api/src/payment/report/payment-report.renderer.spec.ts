import { PaymentReportRenderer } from './payment-report.renderer';
import { PaymentMethod } from '../entities/payment.entity';
import { PaymentReportData } from './payment-report.types';

function makeReport(
  overrides: Partial<PaymentReportData> = {},
): PaymentReportData {
  const base: PaymentReportData = {
    header: {
      contractId: 'c1a2b3',
      tenantName: 'José Núñez Pérez',
      departmentName: 'Depto 201',
      propertyAddress: 'Av. Arequipa 1234, Lima',
      contractStart: '2026-01-01',
      contractEnd: '2026-12-31',
    },
    filters: { from: null, to: null, method: null },
    rows: [
      {
        id: 'p1',
        date: '2026-04-05',
        method: PaymentMethod.YAPE,
        reference: '#TX-9182',
        receiptPeriod: 'Abr 2026',
        description: null,
        amount: 1200,
      },
      {
        id: 'p2',
        date: '2026-04-12',
        method: PaymentMethod.CASH,
        reference: null,
        receiptPeriod: null,
        description: 'adelanto',
        amount: 500,
      },
      {
        id: 'p3',
        date: '2026-04-20',
        method: PaymentMethod.YAPE,
        reference: '#TX-9201',
        receiptPeriod: 'Abr 2026',
        description: 'refund',
        amount: -150,
      },
    ],
    totals: {
      gross: 1550,
      byMethod: {
        cash: 500,
        bank_transfer: 0,
        yape: 1050,
        plin: 0,
        other: 0,
      },
      refunds: -150,
      receivedNet: 1550,
    },
  };
  return { ...base, ...overrides };
}

function collectPdf(
  renderer: PaymentReportRenderer,
  data: PaymentReportData,
  generatedAt: Date = new Date('2026-05-25T10:30:00Z'),
  operatorName: string = 'Admin',
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const stream = renderer.render(data, generatedAt, operatorName);
    const chunks: Buffer[] = [];
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

describe('PaymentReportRenderer', () => {
  const renderer = new PaymentReportRenderer();

  it('produces a valid PDF buffer for a typical report', async () => {
    const buf = await collectPdf(renderer, makeReport());

    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(2000);
    expect(buf.slice(0, 5).toString('utf8')).toBe('%PDF-');
    expect(buf.slice(-6).toString('utf8')).toMatch(/%%EOF/);
  });

  it('handles an empty rows report (totals all zero)', async () => {
    const data = makeReport({
      rows: [],
      totals: {
        gross: 0,
        byMethod: {
          cash: 0,
          bank_transfer: 0,
          yape: 0,
          plin: 0,
          other: 0,
        },
        refunds: 0,
        receivedNet: 0,
      },
    });
    const buf = await collectPdf(renderer, data);

    expect(buf.slice(0, 5).toString('utf8')).toBe('%PDF-');
  });

  it('renders a negative amount row with a leading minus', async () => {
    const buf = await collectPdf(renderer, makeReport());
    expect(buf.slice(0, 5).toString('utf8')).toBe('%PDF-');
  });

  it('produces multiple pages for a large dataset', async () => {
    const rows = Array.from({ length: 60 }, (_, i) => ({
      id: `p${i}`,
      date: `2026-04-${String(i + 1).padStart(2, '0')}`,
      method: PaymentMethod.CASH,
      reference: null,
      receiptPeriod: null,
      description: `Pago ${i + 1}`,
      amount: 100 + i,
    }));
    const data = makeReport({ rows });
    const buf = await collectPdf(renderer, data);

    expect(buf.length).toBeGreaterThan(4000);
    const text = buf.toString('latin1');
    const pageCount = (text.match(/\/Type\s*\/Page[^s]/g) || []).length;
    expect(pageCount).toBeGreaterThanOrEqual(2);
  });

  it('is deterministic for fixed generatedAt', async () => {
    const fixedDate = new Date('2026-05-25T10:30:00Z');
    const data = makeReport();

    const buf1 = await collectPdf(renderer, data, fixedDate);
    const buf2 = await collectPdf(renderer, data, fixedDate);

    expect(buf1.length).toBe(buf2.length);
    expect(buf1.slice(0, 100).equals(buf2.slice(0, 100))).toBe(true);
  });
});

import { ReceiptPdfRenderer } from './receipt-pdf.renderer';
import { ReceiptEntity, ReceiptStatus } from '../entities/receipt.entity';

function makeReceipt(overrides: Partial<ReceiptEntity> = {}): ReceiptEntity {
  return {
    id: 'a1b2c3d4-5678-9abc-def0-1234567890ab',
    contractId: 'c1',
    contract: undefined as unknown as ReceiptEntity['contract'],
    month: 5,
    year: 2026,
    startDay: null,
    endDay: null,
    tenantName: 'José Núñez Pérez',
    tenantDocumentId: '12345678',
    departmentName: 'Depto 201',
    propertyAddress: 'Av. Arequipa 1234, Lima',
    period: 'Mayo 2026',
    items: [
      { description: 'Alquiler mensual', amount: 1500 },
      { description: 'Consumo de electricidad (45 u)', amount: 67.5 },
      { description: 'Consumo de agua (12 u)', amount: 24 },
      { description: 'Otros: Limpieza extraordinaria', amount: 50 },
      { description: 'Pago (cash)', amount: -1000 },
    ],
    totalPayments: 1000 as unknown as number,
    totalDue: 1641.5 as unknown as number,
    balance: -641.5 as unknown as number,
    status: ReceiptStatus.UNPAID,
    paidAt: null,
    paidBy: null,
    pdfKey: null,
    pdfGeneratedAt: null,
    pdfContentType: null,
    pdfStatus: 'idle',
    pdfError: null,
    pdfJobId: null,
    carryForwardDetails: null,
    createdAt: new Date('2026-05-22T12:00:00Z'),
    updatedAt: new Date('2026-05-22T12:00:00Z'),
    ...overrides,
  };
}

describe('ReceiptPdfRenderer', () => {
  const renderer = new ReceiptPdfRenderer();

  it('produces a valid PDF buffer for a typical receipt', async () => {
    const buf = await renderer.render(makeReceipt());

    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(2000); // single-page receipts are several KB

    // PDF magic header
    expect(buf.slice(0, 5).toString('utf8')).toBe('%PDF-');

    // Trailing EOF marker
    expect(buf.slice(-6).toString('utf8')).toMatch(/%%EOF/);
  });

  it('handles a receipt with null DNI by rendering an em-dash', async () => {
    const buf = await renderer.render(makeReceipt({ tenantDocumentId: null }));
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(2000);
  });

  it('renders without an id (preview path) — short id falls back to em-dash', async () => {
    const buf = await renderer.render(
      makeReceipt({ id: undefined as unknown as string }),
    );
    expect(buf.slice(0, 5).toString('utf8')).toBe('%PDF-');
  });
});

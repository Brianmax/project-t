/* eslint-disable @typescript-eslint/no-unsafe-argument,
                   @typescript-eslint/no-unsafe-return,
                   @typescript-eslint/no-unsafe-assignment,
                   @typescript-eslint/no-unsafe-member-access */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Payment, PaymentMethod } from '../entities/payment.entity';
import { Contract } from '../../contract/entities/contract.entity';
import { ReceiptEntity } from '../../receipt/entities/receipt.entity';
import { PaymentReportService } from './payment-report.service';

describe('PaymentReportService', () => {
  let service: PaymentReportService;

  const contract = {
    id: 'c1',
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-12-31'),
    tenant: { id: 't1', name: 'Ana López' },
    department: {
      id: 'd1',
      name: 'Depto 201',
      property: { id: 'p1', name: 'Edificio A', address: 'Av. Arequipa 123' },
    },
  };

  const mockPaymentRepo = { createQueryBuilder: jest.fn() };
  const mockContractRepo = { findOne: jest.fn() };
  const mockReceiptRepo = {};

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentReportService,
        { provide: getRepositoryToken(Payment), useValue: mockPaymentRepo },
        { provide: getRepositoryToken(Contract), useValue: mockContractRepo },
        {
          provide: getRepositoryToken(ReceiptEntity),
          useValue: mockReceiptRepo,
        },
      ],
    }).compile();

    service = module.get<PaymentReportService>(PaymentReportService);
  });

  function mockQb(payments: Partial<Payment>[]) {
    const qb: any = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(payments),
    };
    mockPaymentRepo.createQueryBuilder.mockReturnValue(qb);
    return qb;
  }

  it('throws CONTRACT_NOT_FOUND for missing contract', async () => {
    mockContractRepo.findOne.mockResolvedValue(null);
    await expect(
      service.buildReport({ contractId: 'missing' }),
    ).rejects.toMatchObject({
      response: { code: 'CONTRACT_NOT_FOUND' },
    });
  });

  it('returns empty rows and zero totals when contract has no payments', async () => {
    mockContractRepo.findOne.mockResolvedValue(contract);
    mockQb([]);

    const result = await service.buildReport({ contractId: 'c1' });

    expect(result.rows).toHaveLength(0);
    expect(result.totals.gross).toBe(0);
    expect(result.totals.refunds).toBe(0);
    expect(result.totals.receivedNet).toBe(0);
    expect(result.header.tenantName).toBe('Ana López');
    expect(result.header.propertyAddress).toBe('Av. Arequipa 123');
  });

  it('computes totals correctly including a negative refund', async () => {
    mockContractRepo.findOne.mockResolvedValue(contract);
    const payments = [
      {
        id: 'p1',
        date: new Date('2026-04-05'),
        method: PaymentMethod.YAPE,
        reference: '#TX-1' as string | null,
        receipt: { month: 4, year: 2026 },
        receiptId: 'r1',
        description: null as string | null,
        amount: 1200,
        createdAt: new Date('2026-04-05'),
      },
      {
        id: 'p2',
        date: new Date('2026-04-12'),
        method: PaymentMethod.CASH,
        reference: null as string | null,
        receipt: null,
        receiptId: null,
        description: 'adelanto' as string | null,
        amount: 500,
        createdAt: new Date('2026-04-12'),
      },
      {
        id: 'p3',
        date: new Date('2026-04-20'),
        method: PaymentMethod.YAPE,
        reference: '#TX-2' as string | null,
        receipt: { month: 4, year: 2026 },
        receiptId: 'r1',
        description: 'refund' as string | null,
        amount: -150,
        createdAt: new Date('2026-04-20'),
      },
    ] as any[];
    mockQb(payments);

    const result = await service.buildReport({ contractId: 'c1' });

    expect(result.rows).toHaveLength(3);
    expect(result.totals.gross).toBe(1550);
    expect(result.totals.refunds).toBe(-150);
    expect(result.totals.receivedNet).toBe(1550);
    expect(result.totals.byMethod[PaymentMethod.YAPE]).toBe(1050);
    expect(result.totals.byMethod[PaymentMethod.CASH]).toBe(500);
    expect(result.rows[2].amount).toBe(-150);
  });

  it('filters by method and still computes byMethod over filtered set', async () => {
    mockContractRepo.findOne.mockResolvedValue(contract);
    const payments = [
      {
        id: 'p1',
        date: new Date('2026-04-05'),
        method: PaymentMethod.YAPE,
        reference: null,
        receipt: null,
        receiptId: null,
        description: null,
        amount: 1200,
        createdAt: new Date('2026-04-05'),
      },
    ] as any[];
    const qb = mockQb(payments);

    const result = await service.buildReport({
      contractId: 'c1',
      method: PaymentMethod.YAPE,
    });

    expect(qb.andWhere).toHaveBeenCalledWith('p.method = :method', {
      method: PaymentMethod.YAPE,
    });
    expect(result.rows).toHaveLength(1);
    expect(result.totals.byMethod[PaymentMethod.YAPE]).toBe(1200);
    expect(result.totals.byMethod[PaymentMethod.CASH]).toBe(0);
  });

  it('applies from/to date boundaries inclusively', async () => {
    mockContractRepo.findOne.mockResolvedValue(contract);
    const payments = [
      {
        id: 'p1',
        date: new Date('2026-04-01'),
        method: PaymentMethod.CASH,
        reference: null,
        receipt: null,
        receiptId: null,
        description: null,
        amount: 100,
        createdAt: new Date('2026-04-01'),
      },
      {
        id: 'p2',
        date: new Date('2026-04-30'),
        method: PaymentMethod.CASH,
        reference: null,
        receipt: null,
        receiptId: null,
        description: null,
        amount: 200,
        createdAt: new Date('2026-04-30'),
      },
    ] as any[];
    const qb = mockQb(payments);

    await service.buildReport({
      contractId: 'c1',
      from: new Date('2026-04-01'),
      to: new Date('2026-04-30'),
    });

    expect(qb.andWhere).toHaveBeenCalledWith('p.date >= :from', {
      from: expect.any(Date),
    });
    expect(qb.andWhere).toHaveBeenCalledWith('p.date <= :to', {
      to: expect.any(Date),
    });
  });
});

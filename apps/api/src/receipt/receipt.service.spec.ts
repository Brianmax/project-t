/* eslint-disable @typescript-eslint/no-unsafe-assignment,
                   @typescript-eslint/no-unsafe-call,
                   @typescript-eslint/no-unsafe-member-access,
                   @typescript-eslint/no-unsafe-return,
                   @typescript-eslint/require-await */
import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { ReceiptService } from './receipt.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ReceiptEntity, ReceiptStatus } from './entities/receipt.entity';
import { Contract } from '../contract/entities/contract.entity';
import { Payment } from '../payment/entities/payment.entity';
import { ExtraCharge } from '../extra-charge/entities/extra-charge.entity';
import { ConsumptionService } from '../consumption/consumption.service';
import { ContractLedgerService } from '../contract/contract-ledger.service';
import { DataSource } from 'typeorm';

describe('ReceiptService', () => {
  let service: ReceiptService;

  const mockReceiptRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
  };
  const mockContractRepository = { findOne: jest.fn() };
  const mockPaymentRepository = {
    find: jest.fn(),
    count: jest.fn().mockResolvedValue(0),
  };
  const mockExtraChargeRepository = { find: jest.fn() };
  const mockConsumptionService = {
    calculateConsumptionForPeriod: jest.fn(),
    findMetersMissingReadingsForPeriod: jest.fn().mockResolvedValue([]),
  };
  const mockDataSource = {
    transaction: jest.fn(async (cb: any) =>
      cb({
        save: jest.fn(async (entity: any) => entity),
        create: jest.fn((_target: any, partial: any) => partial),
      }),
    ),
  };
  const mockLedgerService = {
    computeLedger: jest.fn(async () => ({
      contractId: 'c1',
      totalPaid: 0,
      totalBilled: 0,
      balance: 0,
      receipts: [],
      creditRemaining: 0,
    })),
    recalculate: jest.fn(async () => {}),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReceiptService,
        {
          provide: getRepositoryToken(ReceiptEntity),
          useValue: mockReceiptRepository,
        },
        {
          provide: getRepositoryToken(Contract),
          useValue: mockContractRepository,
        },
        {
          provide: getRepositoryToken(Payment),
          useValue: mockPaymentRepository,
        },
        {
          provide: getRepositoryToken(ExtraCharge),
          useValue: mockExtraChargeRepository,
        },
        {
          provide: ConsumptionService,
          useValue: mockConsumptionService,
        },
        { provide: DataSource, useValue: mockDataSource },
        { provide: ContractLedgerService, useValue: mockLedgerService },
      ],
    }).compile();
    service = module.get<ReceiptService>(ReceiptService);
  });

  const stubReceiptRow = (overrides: Partial<ReceiptEntity> = {}) =>
    ({
      id: 'r1',
      contractId: 'c1',
      month: 3,
      year: 2026,
      startDay: null,
      endDay: null,
      status: ReceiptStatus.UNPAID,
      paidAt: null,
      paidBy: null,
      tenantName: 'Ana',
      departmentName: 'Depto 1',
      propertyAddress: 'Av. Lima 1',
      period: 'March 2026',
      items: [],
      totalPayments: '0',
      totalDue: '1500',
      balance: '-1500',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    }) as unknown as ReceiptEntity;

  describe('findUnpaidReceipts', () => {
    it('calls find with status: UNPAID', async () => {
      mockReceiptRepository.find.mockResolvedValue([]);
      await service.findUnpaidReceipts();
      expect(mockReceiptRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: ReceiptStatus.UNPAID },
        }),
      );
    });

    it('returns mapped Receipt objects for all unpaid receipts', async () => {
      mockReceiptRepository.find.mockResolvedValue([stubReceiptRow()]);
      const result = await service.findUnpaidReceipts();
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe(ReceiptStatus.UNPAID);
      expect(result[0].totalDue).toBe(1500);
      expect(result[0].paidAt).toBeNull();
      expect(result[0].paidBy).toBeNull();
    });
  });

  describe('issueReceipt', () => {
    it('rejects regenerating a paid receipt with RECEIPT_LOCKED', async () => {
      const row = stubReceiptRow({
        status: ReceiptStatus.PAID,
        paidAt: new Date(),
        paidBy: 'user-x',
      });
      mockReceiptRepository.findOne.mockResolvedValue(row);

      await expect(service.issueReceipt('c1', 3, 2026)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('rejects regenerating an unpaid receipt that has linked payments (RECEIPT_HAS_PAYMENTS)', async () => {
      const row = stubReceiptRow({ status: ReceiptStatus.UNPAID });
      mockReceiptRepository.findOne.mockResolvedValue(row);
      mockPaymentRepository.count.mockResolvedValueOnce(2);

      const promise = service.issueReceipt('c1', 3, 2026);
      await expect(promise).rejects.toBeInstanceOf(ConflictException);
      await expect(promise).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'RECEIPT_HAS_PAYMENTS' }),
      });
      expect(mockReceiptRepository.save).not.toHaveBeenCalled();
    });

    it('rejects when any meter is missing a reading for the period (READINGS_REQUIRED)', async () => {
      mockReceiptRepository.findOne.mockResolvedValue(null);
      mockContractRepository.findOne.mockResolvedValue({
        id: 'c1',
        department: { id: 'd1' },
      });
      mockConsumptionService.findMetersMissingReadingsForPeriod.mockResolvedValueOnce(
        ['light'],
      );

      const promise = service.issueReceipt('c1', 3, 2026);
      await expect(promise).rejects.toBeInstanceOf(ConflictException);
      await expect(promise).rejects.toMatchObject({
        response: expect.objectContaining({
          code: 'READINGS_REQUIRED',
          missingMeterTypes: ['light'],
        }),
      });
      expect(mockReceiptRepository.save).not.toHaveBeenCalled();
    });

    // BUG-001 regression: a standalone payment from a prior month with
    // receipt_id IS NULL must NOT be absorbed into a freshly issued receipt's
    // totalPayments. Only payments explicitly linked via receiptId count.
    it('does not absorb standalone (unlinked) payments into a new receipt', async () => {
      mockReceiptRepository.findOne.mockResolvedValue(null);
      mockContractRepository.findOne.mockResolvedValue({
        id: 'c1',
        department: { id: 'd1', property: { address: 'Av. Lima 1' } },
        tenant: { name: 'Ana', documentId: null },
        rentAmount: '1400',
      });
      mockConsumptionService.calculateConsumptionForPeriod.mockResolvedValue({
        consumption: 0,
        cost: 0,
      });
      mockExtraChargeRepository.find.mockResolvedValue([]);
      mockReceiptRepository.create.mockImplementation((x: unknown) => x);
      mockReceiptRepository.save.mockImplementation(async (x: unknown) => ({
        ...(x as object),
        id: 'r-new',
      }));

      const result = await service.issueReceipt('c1', 5, 2026);

      // payment repo must be queried only by explicit receipt link (or not at
      // all for a brand-new receipt with no existingReceiptId).
      const calls = mockPaymentRepository.find.mock.calls;
      for (const [arg] of calls) {
        expect(arg?.where?.receiptId).not.toBeUndefined();
        expect(arg?.where?.receiptId).not.toBeNull();
      }

      expect(result.totalPayments).toBe(0);
      expect(result.totalDue).toBe(1400);
      expect(result.balance).toBe(-1400);
    });
  });
});

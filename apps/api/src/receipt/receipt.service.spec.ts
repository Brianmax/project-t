import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { ReceiptService } from './receipt.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ReceiptEntity, ReceiptStatus } from './entities/receipt.entity';
import { Contract } from '../contract/entities/contract.entity';
import { Payment } from '../payment/entities/payment.entity';
import { ExtraCharge } from '../extra-charge/entities/extra-charge.entity';
import { ConsumptionService } from '../consumption/consumption.service';

describe('ReceiptService', () => {
  let service: ReceiptService;

  const mockReceiptRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
  };
  const mockContractRepository = { findOne: jest.fn() };
  const mockPaymentRepository = { find: jest.fn() };
  const mockExtraChargeRepository = { find: jest.fn() };
  const mockConsumptionService = { calculateConsumptionForPeriod: jest.fn() };

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

  describe('updateReceiptStatus', () => {
    const actorId = 'user-abc';

    it('flips unpaid → paid and writes paidAt + paidBy', async () => {
      const row = stubReceiptRow({ status: ReceiptStatus.UNPAID });
      mockReceiptRepository.findOne.mockResolvedValue(row);
      mockReceiptRepository.save.mockImplementation(async (r: ReceiptEntity) => r);

      const result = await service.updateReceiptStatus(
        'c1',
        3,
        2026,
        ReceiptStatus.PAID,
        actorId,
      );

      expect(result.status).toBe(ReceiptStatus.PAID);
      expect(result.paidBy).toBe(actorId);
      expect(result.paidAt).not.toBeNull();
    });

    it('rejects paid → unpaid with RECEIPT_PAID_IMMUTABLE', async () => {
      const row = stubReceiptRow({
        status: ReceiptStatus.PAID,
        paidAt: new Date(),
        paidBy: 'someone-else',
      });
      mockReceiptRepository.findOne.mockResolvedValue(row);

      await expect(
        service.updateReceiptStatus(
          'c1',
          3,
          2026,
          ReceiptStatus.UNPAID,
          actorId,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('is idempotent on unpaid → unpaid (no audit columns written)', async () => {
      const row = stubReceiptRow({
        status: ReceiptStatus.UNPAID,
        paidAt: null,
        paidBy: null,
      });
      mockReceiptRepository.findOne.mockResolvedValue(row);
      mockReceiptRepository.save.mockImplementation(async (r: ReceiptEntity) => r);

      const result = await service.updateReceiptStatus(
        'c1',
        3,
        2026,
        ReceiptStatus.UNPAID,
        actorId,
      );

      expect(result.status).toBe(ReceiptStatus.UNPAID);
      expect(result.paidBy).toBeNull();
      expect(result.paidAt).toBeNull();
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

      await expect(
        service.issueReceipt('c1', 3, 2026),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });
});

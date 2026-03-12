import { Test, TestingModule } from '@nestjs/testing';
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

  describe('findPendingReceipts', () => {
    it('should call find with status: PENDING_REVIEW', async () => {
      mockReceiptRepository.find.mockResolvedValue([]);
      await service.findPendingReceipts();
      expect(mockReceiptRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: ReceiptStatus.PENDING_REVIEW },
        }),
      );
    });

    it('should return mapped Receipt objects for all pending_review receipts', async () => {
      const stub = {
        id: 'r1',
        contractId: 'c1',
        month: 3,
        year: 2026,
        startDay: null,
        endDay: null,
        status: ReceiptStatus.PENDING_REVIEW,
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
      };
      mockReceiptRepository.find.mockResolvedValue([stub]);
      const result = await service.findPendingReceipts();
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe(ReceiptStatus.PENDING_REVIEW);
      expect(result[0].totalDue).toBe(1500);
    });
  });
});

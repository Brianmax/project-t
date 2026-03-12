import { Test, TestingModule } from '@nestjs/testing';
import { PaymentService } from './payment.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Payment } from './entities/payment.entity';
import { Contract } from '../contract/entities/contract.entity';

describe('PaymentService', () => {
  let service: PaymentService;

  const mockPaymentRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    remove: jest.fn(),
  };

  const mockContractRepository = {
    findOne: jest.fn(),
  };

  const mockPayments = [
    {
      id: 'pay1',
      contractId: 'c1',
      amount: '500',
      date: '2026-02-01',
      type: 'rent',
      contract: { id: 'c1' },
    },
    {
      id: 'pay2',
      contractId: 'c1',
      amount: '120',
      date: '2026-01-01',
      type: 'water',
      contract: { id: 'c1' },
    },
  ];

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        {
          provide: getRepositoryToken(Payment),
          useValue: mockPaymentRepository,
        },
        {
          provide: getRepositoryToken(Contract),
          useValue: mockContractRepository,
        },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
  });

  describe('findByContract', () => {
    it('should call find with where: { contractId } and order: { date: DESC }', async () => {
      mockPaymentRepository.find.mockResolvedValue(mockPayments);

      await service.findByContract('c1');

      expect(mockPaymentRepository.find).toHaveBeenCalledWith({
        where: { contractId: 'c1' },
        order: { date: 'DESC' },
      });
    });

    it('should return only payments matching the contractId', async () => {
      mockPaymentRepository.find.mockResolvedValue(mockPayments);

      const result = await service.findByContract('c1');

      expect(result).toHaveLength(2);
      expect(result.every((p) => p.contractId === 'c1')).toBe(true);
    });

    it('should return payments with amount and date fields defined', async () => {
      mockPaymentRepository.find.mockResolvedValue(mockPayments);

      const result = await service.findByContract('c1');

      result.forEach((payment) => {
        expect(payment.amount).toBeDefined();
        expect(payment.date).toBeDefined();
      });
    });
  });
});

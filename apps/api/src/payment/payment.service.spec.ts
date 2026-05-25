/* eslint-disable @typescript-eslint/no-unsafe-argument,
                   @typescript-eslint/no-unsafe-call,
                   @typescript-eslint/no-unsafe-return,
                   @typescript-eslint/require-await */
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource, EntityManager } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PaymentService } from './payment.service';
import { Payment, PaymentMethod } from './entities/payment.entity';
import { Contract } from '../contract/entities/contract.entity';
import { ReceiptEntity } from '../receipt/entities/receipt.entity';
import { ContractLedgerService } from '../contract/contract-ledger.service';

type SaveSpy = jest.Mock;

interface TxState {
  contract: { id: string } | null;
  receipt: Partial<ReceiptEntity> | null;
  existingPayment: Partial<Payment> | null;
  removed: Partial<Payment>[];
  saved: Array<Partial<Payment> | Partial<ReceiptEntity>>;
}

function buildManager(state: TxState): EntityManager {
  const save: SaveSpy = jest.fn(async (entity: any) => {
    state.saved.push(entity);
    return entity;
  });

  const findOne = jest.fn(async (target: any) => {
    if (target === Contract) return state.contract;
    if (target === ReceiptEntity) return state.receipt;
    if (target === Payment) return state.existingPayment;
    return null;
  });

  const remove = jest.fn(async (entity: any) => {
    state.removed.push(entity);
    return entity;
  });

  const createCreator = jest.fn((_target: any, partial: any) => ({
    ...partial,
  }));
  const mergeCreator = jest.fn((_target: any, base: any, patch: any) => {
    Object.assign(base, patch);
    return base;
  });

  return {
    findOne,
    save,
    remove,
    create: createCreator,
    merge: mergeCreator,
  } as unknown as EntityManager;
}

describe('PaymentService', () => {
  let service: PaymentService;
  let state: TxState;
  let ledgerRecalculateSpy: jest.Mock;

  const mockPaymentRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
  };
  const mockContractRepository = { findOne: jest.fn() };
  const mockReceiptRepository = { findOne: jest.fn() };

  const mockDataSource = {
    transaction: jest.fn(async (cb: any) => cb(buildManager(state))),
  };

  const mockLedgerService = {
    computeLedger: jest.fn(),
    recalculate: jest.fn(async () => {}),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    state = {
      contract: { id: 'c1' },
      receipt: null,
      existingPayment: null,
      removed: [],
      saved: [],
    };
    ledgerRecalculateSpy = mockLedgerService.recalculate;
    mockDataSource.transaction = jest.fn(async (cb: any) =>
      cb(buildManager(state)),
    );

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
        {
          provide: getRepositoryToken(ReceiptEntity),
          useValue: mockReceiptRepository,
        },
        { provide: DataSource, useValue: mockDataSource },
        { provide: ContractLedgerService, useValue: mockLedgerService },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
  });

  describe('create', () => {
    const yesterday = new Date(Date.now() - 86400000)
      .toISOString()
      .slice(0, 10);

    it('rejects future dates', async () => {
      const future = new Date(Date.now() + 86400000 * 2)
        .toISOString()
        .slice(0, 10);
      await expect(
        service.create(
          {
            amount: 100,
            date: future,
            method: PaymentMethod.CASH,
            contractId: 'c1',
          },
          null,
        ),
      ).rejects.toMatchObject({
        response: { code: 'FUTURE_PAYMENT_DATE' },
      });
    });

    it('rejects zero amount', async () => {
      await expect(
        service.create(
          {
            amount: 0,
            date: yesterday,
            method: PaymentMethod.CASH,
            contractId: 'c1',
          },
          null,
        ),
      ).rejects.toMatchObject({
        response: { code: 'ZERO_AMOUNT' },
      });
    });

    it('rejects when receipt does not belong to the contract', async () => {
      state.receipt = {
        id: 'r1',
        contractId: 'c-other',
        totalDue: 100,
      } as Partial<ReceiptEntity>;

      await expect(
        service.create(
          {
            amount: 100,
            date: yesterday,
            method: PaymentMethod.CASH,
            contractId: 'c1',
            receiptId: 'r1',
          },
          null,
        ),
      ).rejects.toMatchObject({
        response: { code: 'RECEIPT_CONTRACT_MISMATCH' },
      });
    });

    it('rejects when contract is missing', async () => {
      state.contract = null;
      await expect(
        service.create(
          {
            amount: 100,
            date: yesterday,
            method: PaymentMethod.CASH,
            contractId: 'c-missing',
          },
          null,
        ),
      ).rejects.toMatchObject({
        response: { code: 'CONTRACT_NOT_FOUND' },
      });
    });

    it('calls ledger.recalculate after saving a payment', async () => {
      state.receipt = {
        id: 'r1',
        contractId: 'c1',
        totalDue: 480,
      } as Partial<ReceiptEntity>;

      await service.create(
        {
          amount: 480,
          date: yesterday,
          method: PaymentMethod.BANK_TRANSFER,
          contractId: 'c1',
          receiptId: 'r1',
        },
        'user-1',
      );

      expect(ledgerRecalculateSpy).toHaveBeenCalledWith(
        'c1',
        expect.anything(),
        'user-1',
      );
    });

    it('calls ledger.recalculate even for standalone payments', async () => {
      await service.create(
        {
          amount: 1500,
          date: yesterday,
          method: PaymentMethod.BANK_TRANSFER,
          contractId: 'c1',
        },
        'user-1',
      );

      expect(ledgerRecalculateSpy).toHaveBeenCalledWith(
        'c1',
        expect.anything(),
        'user-1',
      );
    });

    it('allows negative amount (refund) without receiptId', async () => {
      await service.create(
        {
          amount: -50,
          date: yesterday,
          method: PaymentMethod.CASH,
          contractId: 'c1',
        },
        'user-1',
      );

      expect(state.saved.some((s) => (s as Payment).amount === -50)).toBe(true);
    });
  });

  describe('update', () => {
    const yesterday = new Date(Date.now() - 86400000)
      .toISOString()
      .slice(0, 10);

    it('calls recalculate for both old and new contract when contractId changes', async () => {
      state.existingPayment = {
        id: 'pay1',
        contractId: 'c1',
        receiptId: null,
        amount: 500,
        date: new Date(yesterday),
      } as Partial<Payment>;
      state.contract = { id: 'c2' };

      await service.update('pay1', { contractId: 'c2', amount: 600 }, 'user-1');

      const calledContractIds = ledgerRecalculateSpy.mock.calls.map(
        (c: any[]) => c[0],
      );
      expect(calledContractIds).toContain('c1');
      expect(calledContractIds).toContain('c2');
    });
  });

  describe('remove', () => {
    const yesterday = new Date(Date.now() - 86400000)
      .toISOString()
      .slice(0, 10);

    it('calls ledger.recalculate after removing a payment', async () => {
      state.existingPayment = {
        id: 'pay1',
        contractId: 'c1',
        receiptId: 'r1',
        amount: 280,
        date: new Date(yesterday),
      } as Partial<Payment>;

      await service.remove('pay1', 'user-2');

      expect(ledgerRecalculateSpy).toHaveBeenCalledWith(
        'c1',
        expect.anything(),
        'user-2',
      );
    });
  });

  describe('findByContract', () => {
    it('queries with the right filter and ordering', async () => {
      mockPaymentRepository.find.mockResolvedValue([]);
      await service.findByContract('c1');
      expect(mockPaymentRepository.find).toHaveBeenCalledWith({
        where: { contractId: 'c1' },
        order: { date: 'DESC' },
      });
    });
  });

  describe('findByReceipt', () => {
    it('queries with the right filter and ordering', async () => {
      mockPaymentRepository.find.mockResolvedValue([]);
      await service.findByReceipt('r1');
      expect(mockPaymentRepository.find).toHaveBeenCalledWith({
        where: { receiptId: 'r1' },
        order: { date: 'DESC' },
      });
    });
  });
});

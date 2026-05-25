/* eslint-disable @typescript-eslint/no-unsafe-argument,
                   @typescript-eslint/no-unsafe-assignment,
                   @typescript-eslint/no-unsafe-return,
                   @typescript-eslint/require-await */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { ContractLedgerService } from './contract-ledger.service';
import { Payment } from '../payment/entities/payment.entity';
import {
  ReceiptEntity,
  ReceiptStatus,
} from '../receipt/entities/receipt.entity';
import { Contract } from './entities/contract.entity';

function makePayment(
  overrides: Partial<Payment> & { amount: number },
): Payment {
  return { contractId: 'c1', ...overrides } as Payment;
}

function makeReceipt(
  overrides: Partial<ReceiptEntity> & {
    id: string;
    month: number;
    year: number;
    totalDue: number;
  },
): ReceiptEntity {
  return {
    contractId: 'c1',
    createdAt: new Date(),
    paidAt: null,
    ...overrides,
  } as ReceiptEntity;
}

describe('ContractLedgerService', () => {
  let service: ContractLedgerService;
  let paymentFindResult: Payment[];
  let receiptFindResult: ReceiptEntity[];
  let contractFindResult: Contract | null;

  const mockPaymentRepo = {
    find: jest.fn(async () => paymentFindResult),
  };
  const mockReceiptRepo = {
    find: jest.fn(async () => receiptFindResult),
  };
  const mockContractRepo = {
    findOne: jest.fn(async () => contractFindResult),
  };

  beforeEach(async () => {
    paymentFindResult = [];
    receiptFindResult = [];
    contractFindResult = { id: 'c1' } as Contract;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContractLedgerService,
        { provide: getRepositoryToken(Payment), useValue: mockPaymentRepo },
        {
          provide: getRepositoryToken(ReceiptEntity),
          useValue: mockReceiptRepo,
        },
        { provide: getRepositoryToken(Contract), useValue: mockContractRepo },
      ],
    }).compile();

    service = module.get<ContractLedgerService>(ContractLedgerService);
  });

  it('throws NotFoundException for unknown contract', async () => {
    contractFindResult = null;
    await expect(service.computeLedger('bad')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('S1: one receipt 1400, one payment 1400 → paid, balance 0', async () => {
    receiptFindResult = [
      makeReceipt({ id: 'r1', month: 1, year: 2026, totalDue: 1400 }),
    ];
    paymentFindResult = [makePayment({ amount: 1400 })];

    const snapshot = await service.computeLedger('c1');

    expect(snapshot.totalPaid).toBe(1400);
    expect(snapshot.totalBilled).toBe(1400);
    expect(snapshot.balance).toBe(0);
    expect(snapshot.creditRemaining).toBe(0);
    expect(snapshot.receipts).toHaveLength(1);
    expect(snapshot.receipts[0].status).toBe('paid');
    expect(snapshot.receipts[0].appliedCredit).toBe(1400);
    expect(snapshot.receipts[0].remaining).toBe(0);
  });

  it('S2: one receipt 1400, one payment 700 → unpaid, balance -700', async () => {
    receiptFindResult = [
      makeReceipt({ id: 'r1', month: 1, year: 2026, totalDue: 1400 }),
    ];
    paymentFindResult = [makePayment({ amount: 700 })];

    const snapshot = await service.computeLedger('c1');

    expect(snapshot.totalPaid).toBe(700);
    expect(snapshot.balance).toBe(-700);
    expect(snapshot.creditRemaining).toBe(0);
    expect(snapshot.receipts[0].status).toBe('unpaid');
    expect(snapshot.receipts[0].appliedCredit).toBe(700);
    expect(snapshot.receipts[0].remaining).toBe(700);
  });

  it('S3a: one receipt 1400, one payment 1500 → paid, creditRemaining 100', async () => {
    receiptFindResult = [
      makeReceipt({ id: 'r1', month: 1, year: 2026, totalDue: 1400 }),
    ];
    paymentFindResult = [makePayment({ amount: 1500 })];

    const snapshot = await service.computeLedger('c1');

    expect(snapshot.totalPaid).toBe(1500);
    expect(snapshot.balance).toBe(100);
    expect(snapshot.creditRemaining).toBe(100);
    expect(snapshot.receipts[0].status).toBe('paid');
    expect(snapshot.receipts[0].appliedCredit).toBe(1400);
  });

  it('S3b: two receipts of 1400, payments total 2800 (1500+1300) → both paid', async () => {
    receiptFindResult = [
      makeReceipt({ id: 'r1', month: 1, year: 2026, totalDue: 1400 }),
      makeReceipt({ id: 'r2', month: 2, year: 2026, totalDue: 1400 }),
    ];
    paymentFindResult = [
      makePayment({ amount: 1500 }),
      makePayment({ amount: 1300 }),
    ];

    const snapshot = await service.computeLedger('c1');

    expect(snapshot.totalPaid).toBe(2800);
    expect(snapshot.totalBilled).toBe(2800);
    expect(snapshot.balance).toBe(0);
    expect(snapshot.creditRemaining).toBe(0);
    expect(snapshot.receipts[0].status).toBe('paid');
    expect(snapshot.receipts[0].appliedCredit).toBe(1400);
    expect(snapshot.receipts[1].status).toBe('paid');
    expect(snapshot.receipts[1].appliedCredit).toBe(1400);
  });

  it('FIFO: two receipts months 3+4, single payment covers only month 3', async () => {
    receiptFindResult = [
      makeReceipt({ id: 'r1', month: 3, year: 2026, totalDue: 1400 }),
      makeReceipt({ id: 'r2', month: 4, year: 2026, totalDue: 1400 }),
    ];
    paymentFindResult = [makePayment({ amount: 1400 })];

    const snapshot = await service.computeLedger('c1');

    expect(snapshot.receipts[0].status).toBe('paid');
    expect(snapshot.receipts[1].status).toBe('unpaid');
    expect(snapshot.receipts[1].appliedCredit).toBe(0);
    expect(snapshot.creditRemaining).toBe(0);
  });

  it('out-of-order issuance: month 4 created before month 3, FIFO still goes month 3 first', async () => {
    const olderDate = new Date('2026-04-01');
    const newerDate = new Date('2026-04-02');
    receiptFindResult = [
      makeReceipt({
        id: 'r3',
        month: 3,
        year: 2026,
        totalDue: 1400,
        createdAt: newerDate,
      }),
      makeReceipt({
        id: 'r4',
        month: 4,
        year: 2026,
        totalDue: 1400,
        createdAt: olderDate,
      }),
    ];
    paymentFindResult = [makePayment({ amount: 1400 })];

    const snapshot = await service.computeLedger('c1');

    expect(snapshot.receipts[0].month).toBe(3);
    expect(snapshot.receipts[0].id).toBe('r3');
    expect(snapshot.receipts[0].status).toBe('paid');
    expect(snapshot.receipts[1].month).toBe(4);
    expect(snapshot.receipts[1].id).toBe('r4');
    expect(snapshot.receipts[1].status).toBe('unpaid');
  });

  it('refund mid-stream lowers balance and flips receipt to unpaid', async () => {
    receiptFindResult = [
      makeReceipt({ id: 'r1', month: 1, year: 2026, totalDue: 1400 }),
    ];
    paymentFindResult = [
      makePayment({ amount: 1500 }),
      makePayment({ amount: -200 }),
    ];

    const snapshot = await service.computeLedger('c1');

    expect(snapshot.totalPaid).toBe(1300);
    expect(snapshot.balance).toBe(-100);
    expect(snapshot.receipts[0].status).toBe('unpaid');
    expect(snapshot.receipts[0].appliedCredit).toBe(1300);
    expect(snapshot.receipts[0].remaining).toBe(100);
  });

  it('empty contract: no receipts, no payments', async () => {
    const snapshot = await service.computeLedger('c1');

    expect(snapshot.totalPaid).toBe(0);
    expect(snapshot.totalBilled).toBe(0);
    expect(snapshot.balance).toBe(0);
    expect(snapshot.receipts).toHaveLength(0);
    expect(snapshot.creditRemaining).toBe(0);
  });

  describe('recalculate', () => {
    function makeMockManager(receipts: ReceiptEntity[], payments: Payment[]) {
      const qb = {
        setLock: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn(async () => receipts),
      };
      const manager = {
        createQueryBuilder: jest.fn().mockReturnValue(qb),
        find: jest.fn(async () => payments),
        save: jest.fn(async (entity: any) => entity),
      };
      return { manager: manager as any, saveSpy: manager.save };
    }

    it('payment fully covers receipt → status=paid, paidAt set', async () => {
      const receipt = makeReceipt({
        id: 'r1',
        month: 1,
        year: 2026,
        totalDue: 1400,
        status: ReceiptStatus.UNPAID,
        paidAt: null,
        paidBy: null,
        totalPayments: 0,
        balance: -1400,
      });
      const payments = [makePayment({ amount: 1400 })];
      const { manager, saveSpy } = makeMockManager([receipt], payments);

      await service.recalculate('c1', manager, 'user-1');

      expect(saveSpy).toHaveBeenCalledTimes(1);
      expect(receipt.status).toBe(ReceiptStatus.PAID);
      expect(receipt.paidAt).toBeInstanceOf(Date);
      expect(receipt.paidBy).toBe('user-1');
      expect(receipt.totalPayments).toBe(1400);
      expect(receipt.balance).toBe(0);
    });

    it('deleting the payment that paid a receipt flips it back to unpaid and clears paidAt', async () => {
      const receipt = makeReceipt({
        id: 'r1',
        month: 1,
        year: 2026,
        totalDue: 1400,
        status: ReceiptStatus.PAID,
        paidAt: new Date('2026-01-15'),
        paidBy: 'user-1',
        totalPayments: 1400,
        balance: 0,
      });
      const { manager, saveSpy } = makeMockManager([receipt], []);

      await service.recalculate('c1', manager);

      expect(saveSpy).toHaveBeenCalledTimes(1);
      expect(receipt.status).toBe(ReceiptStatus.UNPAID);
      expect(receipt.paidAt).toBeNull();
      expect(receipt.paidBy).toBeNull();
      expect(receipt.totalPayments).toBe(0);
      expect(receipt.balance).toBe(-1400);
    });

    it('standalone payment for empty contract (no receipts) is a no-op', async () => {
      const payments = [makePayment({ amount: 1400 })];
      const { manager, saveSpy } = makeMockManager([], payments);

      await service.recalculate('c1', manager);

      expect(saveSpy).not.toHaveBeenCalled();
    });

    it('FIFO applies credit to oldest receipt first', async () => {
      const r1 = makeReceipt({
        id: 'r1',
        month: 3,
        year: 2026,
        totalDue: 1400,
        status: ReceiptStatus.UNPAID,
        paidAt: null,
        paidBy: null,
        totalPayments: 0,
        balance: -1400,
      });
      const r2 = makeReceipt({
        id: 'r2',
        month: 4,
        year: 2026,
        totalDue: 1400,
        status: ReceiptStatus.UNPAID,
        paidAt: null,
        paidBy: null,
        totalPayments: 0,
        balance: -1400,
      });
      const payments = [makePayment({ amount: 1400 })];
      const { manager, saveSpy } = makeMockManager([r1, r2], payments);

      await service.recalculate('c1', manager, 'user-1');

      expect(saveSpy).toHaveBeenCalledTimes(2);

      expect(r1.status).toBe(ReceiptStatus.PAID);
      expect(r1.totalPayments).toBe(1400);
      expect(r1.balance).toBe(0);
      expect(r1.paidAt).toBeInstanceOf(Date);
      expect(r1.paidBy).toBe('user-1');

      expect(r2.status).toBe(ReceiptStatus.UNPAID);
      expect(r2.totalPayments).toBe(0);
      expect(r2.balance).toBe(-1400);
      expect(r2.paidAt).toBeNull();
      expect(r2.paidBy).toBeNull();
    });
  });
});

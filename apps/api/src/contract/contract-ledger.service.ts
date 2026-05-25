import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Payment } from '../payment/entities/payment.entity';
import {
  ReceiptEntity,
  ReceiptStatus,
} from '../receipt/entities/receipt.entity';
import { Contract } from './entities/contract.entity';

export interface LedgerReceiptSnapshot {
  id: string;
  month: number;
  year: number;
  totalDue: number;
  appliedCredit: number;
  remaining: number;
  status: 'paid' | 'unpaid';
  paidAt: Date | null;
}

export interface LedgerSnapshot {
  contractId: string;
  totalPaid: number;
  totalBilled: number;
  balance: number;
  receipts: LedgerReceiptSnapshot[];
  creditRemaining: number;
}

@Injectable()
export class ContractLedgerService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(ReceiptEntity)
    private readonly receiptRepository: Repository<ReceiptEntity>,
    @InjectRepository(Contract)
    private readonly contractRepository: Repository<Contract>,
  ) {}

  async computeLedger(contractId: string): Promise<LedgerSnapshot> {
    const contract = await this.contractRepository.findOne({
      where: { id: contractId },
    });
    if (!contract) {
      throw new NotFoundException(`Contract with ID "${contractId}" not found`);
    }

    const payments = await this.paymentRepository.find({
      where: { contractId },
    });
    const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);

    const receipts = await this.receiptRepository.find({
      where: { contractId },
      order: { year: 'ASC', month: 'ASC', createdAt: 'ASC' },
    });

    let running = totalPaid;
    let totalBilled = 0;
    const receiptSnapshots: LedgerReceiptSnapshot[] = [];

    for (const receipt of receipts) {
      const due = Number(receipt.totalDue);
      totalBilled += due;

      const applied = Math.min(Math.max(running, 0), due);
      running -= applied;
      const remaining = due - applied;
      const status = applied >= due ? 'paid' : 'unpaid';

      receiptSnapshots.push({
        id: receipt.id,
        month: receipt.month,
        year: receipt.year,
        totalDue: due,
        appliedCredit: applied,
        remaining,
        status,
        paidAt: receipt.paidAt,
      });
    }

    const creditRemaining = Math.max(running, 0);

    return {
      contractId,
      totalPaid,
      totalBilled,
      balance: totalPaid - totalBilled,
      receipts: receiptSnapshots,
      creditRemaining,
    };
  }

  async recalculate(
    contractId: string,
    manager: EntityManager,
    actorUserId?: string | null,
  ): Promise<void> {
    const receipts = await manager
      .createQueryBuilder(ReceiptEntity, 'r')
      .setLock('pessimistic_write')
      .where('r.contract_id = :contractId', { contractId })
      .orderBy('r.year', 'ASC')
      .addOrderBy('r.month', 'ASC')
      .addOrderBy('r.created_at', 'ASC')
      .getMany();

    if (receipts.length === 0) return;

    const payments = await manager.find(Payment, {
      where: { contractId },
    });
    let running = payments.reduce((sum, p) => sum + Number(p.amount), 0);

    for (const receipt of receipts) {
      const due = Number(receipt.totalDue);
      const applied = Math.min(Math.max(running, 0), due);
      running -= applied;
      const nextStatus =
        applied >= due ? ReceiptStatus.PAID : ReceiptStatus.UNPAID;

      receipt.totalPayments = applied;
      receipt.balance = applied - due;

      if (nextStatus === ReceiptStatus.PAID) {
        receipt.status = ReceiptStatus.PAID;
        if (!receipt.paidAt) {
          receipt.paidAt = new Date();
          receipt.paidBy = actorUserId ?? null;
        }
      } else {
        receipt.status = ReceiptStatus.UNPAID;
        receipt.paidAt = null;
        receipt.paidBy = null;
      }

      await manager.save(receipt);
    }
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment, PaymentMethod } from '../entities/payment.entity';
import { Contract } from '../../contract/entities/contract.entity';
import { ReceiptEntity } from '../../receipt/entities/receipt.entity';
import {
  PaymentReportData,
  PaymentReportRow,
  PaymentReportTotals,
} from './payment-report.types';

const MONTH_NAMES = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
];

@Injectable()
export class PaymentReportService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(Contract)
    private readonly contractRepo: Repository<Contract>,
    @InjectRepository(ReceiptEntity)
    private readonly receiptRepo: Repository<ReceiptEntity>,
  ) {}

  async buildReport(input: {
    contractId: string;
    from?: Date;
    to?: Date;
    method?: PaymentMethod;
  }): Promise<PaymentReportData> {
    const contract = await this.contractRepo.findOne({
      where: { id: input.contractId },
      relations: ['tenant', 'department', 'department.property'],
    });
    if (!contract) {
      throw new NotFoundException({
        code: 'CONTRACT_NOT_FOUND',
        message: `Contract "${input.contractId}" not found`,
      });
    }

    const qb = this.paymentRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.receipt', 'r')
      .where('p.contract_id = :cid', { cid: input.contractId })
      .orderBy('p.date', 'ASC')
      .addOrderBy('p.created_at', 'ASC');

    if (input.from) {
      qb.andWhere('p.date >= :from', { from: input.from });
    }
    if (input.to) {
      qb.andWhere('p.date <= :to', { to: input.to });
    }
    if (input.method) {
      qb.andWhere('p.method = :method', { method: input.method });
    }

    const payments = await qb.getMany();

    const receiptPeriodCache = new Map<string, string | null>();
    const rows: PaymentReportRow[] = payments.map((p) => ({
      id: p.id,
      date: this.toDateString(p.date),
      method: p.method,
      reference: p.reference,
      receiptPeriod: this.getReceiptPeriod(
        p.receiptId,
        p.receipt,
        receiptPeriodCache,
      ),
      description: p.description,
      amount: Number(p.amount),
    }));

    const totals = this.computeTotals(rows);

    const propAddr = contract.department?.property?.address ?? '';
    const deptName = contract.department?.name ?? '';

    return {
      header: {
        contractId: contract.id,
        tenantName: contract.tenant?.name ?? '',
        departmentName: deptName,
        propertyAddress: propAddr,
        contractStart: this.toDateString(contract.startDate),
        contractEnd: contract.endDate
          ? this.toDateString(contract.endDate)
          : null,
      },
      filters: {
        from: input.from ? this.toDateString(input.from) : null,
        to: input.to ? this.toDateString(input.to) : null,
        method: input.method ?? null,
      },
      rows,
      totals,
    };
  }

  private computeTotals(rows: PaymentReportRow[]): PaymentReportTotals {
    const byMethod = {} as Record<PaymentMethod, number>;
    const allMethods: PaymentMethod[] = [
      PaymentMethod.CASH,
      PaymentMethod.BANK_TRANSFER,
      PaymentMethod.YAPE,
      PaymentMethod.PLIN,
      PaymentMethod.OTHER,
    ];
    for (const m of allMethods) byMethod[m] = 0;

    let gross = 0;
    let refunds = 0;

    for (const row of rows) {
      const amt = row.amount;
      gross += amt;
      byMethod[row.method] = (byMethod[row.method] ?? 0) + amt;
      if (amt < 0) refunds += amt;
    }

    return { gross, byMethod, refunds, receivedNet: gross };
  }

  private getReceiptPeriod(
    receiptId: string | null,
    receipt: ReceiptEntity | null,
    cache: Map<string, string | null>,
  ): string | null {
    if (!receiptId) return null;
    if (cache.has(receiptId)) return cache.get(receiptId)!;
    if (receipt) {
      const period = `${MONTH_NAMES[receipt.month - 1]} ${receipt.year}`;
      cache.set(receiptId, period);
      return period;
    }
    cache.set(receiptId, null);
    return null;
  }

  private toDateString(d: Date | string): string {
    const date = d instanceof Date ? d : new Date(d);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}

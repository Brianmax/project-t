import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { DataSource, Repository } from 'typeorm';
import { Contract } from '../contract/entities/contract.entity';
import { Payment } from '../payment/entities/payment.entity';
import { ExtraCharge } from '../extra-charge/entities/extra-charge.entity';
import { ConsumptionService } from '../consumption/consumption.service';
import { MeterType } from '../department-meter/entities/department-meter.entity';
import { RECEIPT_PDF_QUEUE } from '../queue/queue.constants';
import {
  PdfStatus,
  ReceiptEntity,
  ReceiptStatus,
} from './entities/receipt.entity';
import { ContractLedgerService } from '../contract/contract-ledger.service';

export interface ReceiptItem {
  description: string;
  amount: number;
}

export interface Receipt {
  id?: string;
  contractId: string;
  month: number;
  year: number;
  startDay?: number | null;
  endDay?: number | null;
  status: ReceiptStatus;
  paidAt: string | null;
  paidBy: string | null;
  tenantName: string;
  tenantDocumentId: string | null;
  departmentName: string;
  propertyAddress: string;
  period: string;
  items: ReceiptItem[];
  totalPayments: number;
  totalDue: number;
  balance: number;
  carryForwardDetails: Array<{ period: string; balance: number }> | null;
  carryForwardBalance: number;
  pdfKey: string | null;
  pdfGeneratedAt: string | null;
  pdfStatus: PdfStatus;
  pdfError: string | null;
}

@Injectable()
export class ReceiptService {
  private readonly logger = new Logger(ReceiptService.name);

  constructor(
    @InjectRepository(Contract)
    private readonly contractRepository: Repository<Contract>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(ExtraCharge)
    private readonly extraChargeRepository: Repository<ExtraCharge>,
    @InjectRepository(ReceiptEntity)
    private readonly receiptRepository: Repository<ReceiptEntity>,
    private readonly consumptionService: ConsumptionService,
    private readonly dataSource: DataSource,
    private readonly ledgerService: ContractLedgerService,
    @Optional()
    @InjectQueue(RECEIPT_PDF_QUEUE)
    private readonly pdfQueue?: Queue,
  ) {}

  async previewReceipt(
    contractId: string,
    month: number,
    year: number,
    startDay?: number,
    endDay?: number,
    prorateRent?: boolean,
  ): Promise<Receipt> {
    const existing = await this.receiptRepository.findOne({
      where: { contractId, month, year },
    });
    if (existing) {
      return this.toReceipt(existing);
    }

    const calculated = await this.calculateReceipt(
      contractId,
      month,
      year,
      startDay,
      endDay,
      prorateRent,
    );
    return {
      ...calculated,
      status: ReceiptStatus.UNPAID,
      paidAt: null,
      paidBy: null,
      pdfKey: null,
      pdfGeneratedAt: null,
      pdfStatus: 'idle',
      pdfError: null,
    };
  }

  async issueReceipt(
    contractId: string,
    month: number,
    year: number,
    startDay?: number,
    endDay?: number,
    prorateRent?: boolean,
  ): Promise<Receipt> {
    const existing = await this.receiptRepository.findOne({
      where: { contractId, month, year },
    });

    if (existing && existing.status === ReceiptStatus.PAID) {
      throw new ConflictException({
        code: 'RECEIPT_LOCKED',
        message: `Receipt for ${month}/${year} is paid and cannot be regenerated.`,
      });
    }

    if (existing) {
      const linkedCount = await this.paymentRepository.count({
        where: { receiptId: existing.id },
      });
      if (linkedCount > 0) {
        throw new ConflictException({
          code: 'RECEIPT_HAS_PAYMENTS',
          message: `Receipt for ${month}/${year} has ${linkedCount} linked payment(s); delete them before regenerating.`,
        });
      }
    }

    const contract = await this.contractRepository.findOne({
      where: { id: contractId },
      relations: ['department'],
    });
    if (!contract) {
      throw new NotFoundException(`Contract with ID "${contractId}" not found`);
    }

    const missingMeterTypes =
      await this.consumptionService.findMetersMissingReadingsForPeriod(
        contract.department.id,
        month,
        year,
        endDay,
      );
    if (missingMeterTypes.length > 0) {
      throw new ConflictException({
        code: 'READINGS_REQUIRED',
        message: `No se puede generar recibo para ${month}/${year}: faltan lecturas de ${missingMeterTypes.join(', ')}.`,
        missingMeterTypes,
      });
    }

    const calculated = await this.calculateReceipt(
      contractId,
      month,
      year,
      startDay,
      endDay,
      prorateRent,
    );

    if (existing) {
      const hadPdf = existing.pdfKey != null;
      existing.startDay = startDay ?? null;
      existing.endDay = endDay ?? null;
      existing.tenantName = calculated.tenantName;
      existing.tenantDocumentId = calculated.tenantDocumentId;
      existing.departmentName = calculated.departmentName;
      existing.propertyAddress = calculated.propertyAddress;
      existing.period = calculated.period;
      existing.items = calculated.items as any;
      existing.totalPayments = calculated.totalPayments;
      existing.totalDue = calculated.totalDue;
      existing.balance = calculated.balance;
      existing.carryForwardDetails = calculated.carryForwardDetails;
      const saved = await this.dataSource.transaction(async (manager) => {
        const s = await manager.save(existing);
        await this.ledgerService.recalculate(contractId, manager);
        return s;
      });

      if (hadPdf) {
        await this.enqueuePdfRegeneration(saved.id, saved.contractId);
      }

      return this.toReceipt(saved);
    }

    const saved = await this.dataSource.transaction(async (manager) => {
      const s = await manager.save(
        manager.create(ReceiptEntity, {
          ...calculated,
          startDay: startDay ?? null,
          endDay: endDay ?? null,
          status: ReceiptStatus.UNPAID,
        }),
      );
      await this.ledgerService.recalculate(contractId, manager);
      return s;
    });
    return this.toReceipt(saved);
  }

  private async enqueuePdfRegeneration(
    receiptId: string,
    contractId: string,
  ): Promise<void> {
    if (!this.pdfQueue) return;
    try {
      await this.receiptRepository.update(receiptId, {
        pdfStatus: 'queued',
        pdfError: null,
      });
      const job = await this.pdfQueue.add('render', { receiptId });
      await this.receiptRepository.update(receiptId, {
        pdfJobId: job.id ?? null,
      });
      this.logger.log({
        operation: 'receipt-pdf.auto-regen-enqueued',
        receiptId,
        contractId,
        jobId: job.id,
      });
    } catch (err) {
      this.logger.warn({
        operation: 'receipt-pdf.auto-regen-failed',
        receiptId,
        contractId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async findReceiptMonthsByContract(
    contractId: string,
  ): Promise<Array<{ month: number; year: number; status: string }>> {
    const rows = await this.receiptRepository.find({
      where: { contractId },
      select: ['month', 'year', 'status'],
      order: { year: 'ASC', month: 'ASC' },
    });
    return rows.map((r) => ({
      month: r.month,
      year: r.year,
      status: r.status,
    }));
  }

  async findUnpaidReceipts(): Promise<Receipt[]> {
    const receipts = await this.receiptRepository.find({
      where: {
        status: ReceiptStatus.UNPAID,
      },
      order: {
        year: 'DESC',
        month: 'DESC',
      },
    });

    return receipts.map((r) => this.toReceipt(r));
  }

  async findAllReceipts(departmentId?: string): Promise<Receipt[]> {
    if (departmentId) {
      // Find all contracts for this department
      const contracts = await this.contractRepository.find({
        where: { departmentId },
        select: ['id'],
      });
      const contractIds = contracts.map((c) => c.id);

      if (contractIds.length === 0) return [];

      const receipts = await this.receiptRepository
        .createQueryBuilder('r')
        .where('r.contractId IN (:...contractIds)', { contractIds })
        .orderBy('r.year', 'DESC')
        .addOrderBy('r.month', 'DESC')
        .getMany();

      return receipts.map((r) => this.toReceipt(r));
    }

    const receipts = await this.receiptRepository.find({
      order: {
        year: 'DESC',
        month: 'DESC',
      },
    });

    return receipts.map((r) => this.toReceipt(r));
  }

  private toReceipt(record: ReceiptEntity): Receipt {
    const carryForwardDetails = record.carryForwardDetails ?? null;
    const carryForwardBalance = (carryForwardDetails ?? []).reduce(
      (sum, item) => sum + Number(item.balance),
      0,
    );

    return {
      id: record.id,
      contractId: record.contractId,
      month: record.month,
      year: record.year,
      startDay: record.startDay,
      endDay: record.endDay,
      status: record.status,
      paidAt: record.paidAt ? record.paidAt.toISOString() : null,
      paidBy: record.paidBy,
      tenantName: record.tenantName,
      tenantDocumentId: record.tenantDocumentId,
      departmentName: record.departmentName,
      propertyAddress: record.propertyAddress,
      period: record.period,
      items: (record.items ?? []).map((item) => ({
        description: item.description,
        amount: Number(item.amount),
      })),
      totalPayments: Number(record.totalPayments),
      totalDue: Number(record.totalDue),
      balance: Number(record.balance),
      carryForwardDetails,
      carryForwardBalance,
      pdfKey: record.pdfKey,
      pdfGeneratedAt: record.pdfGeneratedAt
        ? record.pdfGeneratedAt.toISOString()
        : null,
      pdfStatus: record.pdfStatus,
      pdfError: record.pdfError,
    };
  }

  private async calculateReceipt(
    contractId: string,
    month: number,
    year: number,
    startDay?: number,
    endDay?: number,
    prorateRent?: boolean,
  ): Promise<
    Omit<
      Receipt,
      | 'id'
      | 'status'
      | 'paidAt'
      | 'paidBy'
      | 'pdfKey'
      | 'pdfGeneratedAt'
      | 'pdfStatus'
      | 'pdfError'
    >
  > {
    const contract = await this.contractRepository.findOne({
      where: { id: contractId },
      relations: ['tenant', 'department', 'department.property'],
    });

    if (!contract) {
      throw new NotFoundException(`Contract with ID "${contractId}" not found`);
    }

    const periodStart = new Date(year, month - 1, 1);

    // Calculate carry-forward details from previous months
    const ledger = await this.ledgerService.computeLedger(contractId);
    const carryForwardDetails: Array<{ period: string; balance: number }> = [];

    for (const snap of ledger.receipts) {
      // Only carry forward if the receipt period is strictly before the current one
      const isPast =
        snap.year < year || (snap.year === year && snap.month < month);

      if (isPast && snap.remaining > 0) {
        const snapPeriod = new Date(snap.year, snap.month - 1, 1).toLocaleString(
          'es-PE',
          { month: 'long', year: 'numeric' },
        );
        carryForwardDetails.push({
          period: snapPeriod,
          balance: snap.remaining,
        });
      }
    }

    const carryForwardBalance = carryForwardDetails.reduce(
      (sum, item) => sum + item.balance,
      0,
    );

    const lightConsumptionData =
      await this.consumptionService.calculateConsumptionForPeriod(
        contract.department.id,
        MeterType.LIGHT,
        month,
        year,
        startDay,
        endDay,
      );
    const waterConsumptionData =
      await this.consumptionService.calculateConsumptionForPeriod(
        contract.department.id,
        MeterType.WATER,
        month,
        year,
        startDay,
        endDay,
      );

    const lightConsumption = {
      consumption: lightConsumptionData.consumption,
      cost: lightConsumptionData.cost,
    };
    const waterConsumption = {
      consumption: waterConsumptionData.consumption,
      cost: waterConsumptionData.cost,
    };

    const receiptItems: ReceiptItem[] = [];

    let rentAmount: number;
    let rentDescription: string;
    if (endDay !== undefined && prorateRent) {
      const effectiveStartDay = startDay ?? 1;
      const daysInMonth = new Date(year, month, 0).getDate();
      const daysOccupied = endDay - effectiveStartDay + 1;
      rentAmount = (daysOccupied / daysInMonth) * Number(contract.rentAmount);
      rentDescription = `Alquiler mensual (${daysOccupied}/${daysInMonth} días)`;
    } else {
      rentAmount = Number(contract.rentAmount);
      rentDescription = 'Alquiler mensual';
    }

    let totalDue = rentAmount;

    receiptItems.push({
      description: rentDescription,
      amount: rentAmount,
    });

    if (lightConsumption.consumption > 0) {
      receiptItems.push({
        description: `Consumo de electricidad (${lightConsumption.consumption} unidades)`,
        amount: lightConsumption.cost,
      });
      totalDue += lightConsumption.cost;
    }

    if (waterConsumption.consumption > 0) {
      receiptItems.push({
        description: `Consumo de agua (${waterConsumption.consumption} unidades)`,
        amount: waterConsumption.cost,
      });
      totalDue += waterConsumption.cost;
    }

    const extraCharges = await this.extraChargeRepository.find({
      where: { contractId: contract.id, month, year },
    });

    extraCharges.forEach((extraCharge) => {
      receiptItems.push({
        description: `Otros: ${extraCharge.description}`,
        amount: Number(extraCharge.amount),
      });
      totalDue += Number(extraCharge.amount);
    });

    const monthName = periodStart.toLocaleString('es-PE', {
      month: 'long',
      year: 'numeric',
    });
    const effectiveStartDay = startDay ?? 1;
    const period = endDay
      ? `${effectiveStartDay}–${endDay} ${monthName}`
      : monthName;

    return {
      contractId: contract.id,
      month,
      year,
      tenantName: contract.tenant.name,
      tenantDocumentId: contract.tenant.documentId ?? null,
      departmentName: contract.department.name,
      propertyAddress: contract.department.property.address,
      period,
      items: receiptItems,
      totalPayments: 0,
      totalDue,
      balance: -totalDue,
      carryForwardDetails,
      carryForwardBalance,
    };
  }
}

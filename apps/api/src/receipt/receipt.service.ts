import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { Contract } from '../contract/entities/contract.entity';
import { Payment } from '../payment/entities/payment.entity';
import { ExtraCharge } from '../extra-charge/entities/extra-charge.entity';
import { ConsumptionService } from '../consumption/consumption.service';
import { MeterType } from '../department-meter/entities/department-meter.entity';
import { ReceiptEntity, ReceiptStatus } from './entities/receipt.entity';

export interface ReceiptItem {
  description: string;
  amount: number;
}

export interface Receipt {
  id?: string;
  contractId: string;
  month: number;
  year: number;
  status: ReceiptStatus;
  tenantName: string;
  departmentName: string;
  propertyAddress: string;
  period: string;
  items: ReceiptItem[];
  totalPayments: number;
  totalDue: number;
  balance: number;
}

@Injectable()
export class ReceiptService {
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
  ) {}

  async previewReceipt(
    contractId: string,
    month: number,
    year: number,
  ): Promise<Receipt> {
    const existing = await this.receiptRepository.findOne({
      where: { contractId, month, year },
    });
    if (existing) {
      return this.toReceipt(existing);
    }

    const calculated = await this.calculateReceipt(contractId, month, year);
    return { ...calculated, status: ReceiptStatus.PENDING_REVIEW };
  }

  async issueReceipt(
    contractId: string,
    month: number,
    year: number,
  ): Promise<Receipt> {
    // Always recalculate to get the latest extra charges and consumption
    const calculated = await this.calculateReceipt(contractId, month, year);

    const existing = await this.receiptRepository.findOne({
      where: { contractId, month, year },
    });

    if (existing) {
      // Update existing receipt with new calculation
      existing.tenantName = calculated.tenantName;
      existing.departmentName = calculated.departmentName;
      existing.propertyAddress = calculated.propertyAddress;
      existing.period = calculated.period;
      existing.items = calculated.items as any;
      existing.totalPayments = calculated.totalPayments;
      existing.totalDue = calculated.totalDue;
      existing.balance = calculated.balance;
      const saved = await this.receiptRepository.save(existing);
      return this.toReceipt(saved);
    }

    // Create new receipt
    const saved = await this.receiptRepository.save(
      this.receiptRepository.create({
        ...calculated,
        status: ReceiptStatus.PENDING_REVIEW,
      }),
    );
    return this.toReceipt(saved);
  }

  async updateReceiptStatus(
    contractId: string,
    month: number,
    year: number,
    status: ReceiptStatus,
  ): Promise<Receipt> {
    const receipt = await this.receiptRepository.findOne({
      where: { contractId, month, year },
    });
    if (!receipt) {
      throw new NotFoundException(
        `Issued receipt not found for contract ${contractId} (${month}/${year})`,
      );
    }

    receipt.status = status;
    const saved = await this.receiptRepository.save(receipt);
    return this.toReceipt(saved);
  }

  async findPendingReceipts(): Promise<Receipt[]> {
    const receipts = await this.receiptRepository.find({
      where: {
        status: ReceiptStatus.APPROVED,
      },
      order: {
        year: 'DESC',
        month: 'DESC',
      },
    });

    // Filter receipts with negative balance (amount owed)
    return receipts
      .map((r) => this.toReceipt(r))
      .filter((r) => r.balance < 0);
  }

  private toReceipt(record: ReceiptEntity): Receipt {
    return {
      id: record.id,
      contractId: record.contractId,
      month: record.month,
      year: record.year,
      status: record.status,
      tenantName: record.tenantName,
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
    };
  }

  private async calculateReceipt(
    contractId: string,
    month: number,
    year: number,
  ): Promise<Omit<Receipt, 'id' | 'status'>> {
    const contract = await this.contractRepository.findOne({
      where: { id: contractId },
      relations: ['tenant', 'department', 'department.property'],
    });

    if (!contract) {
      throw new NotFoundException(`Contract with ID "${contractId}" not found`);
    }

    const periodStart = new Date(year, month - 1, 1);
    const periodEnd = new Date(year, month, 0);

    const payments = await this.paymentRepository.find({
      where: {
        contractId: contract.id,
        date: Between(periodStart, periodEnd),
      },
    });

    // Use period-specific consumption instead of current consumption
    const lightConsumptionData =
      await this.consumptionService.calculateConsumptionForPeriod(
        contract.department.id,
        MeterType.LIGHT,
        periodStart,
        periodEnd,
      );
    const waterConsumptionData =
      await this.consumptionService.calculateConsumptionForPeriod(
        contract.department.id,
        MeterType.WATER,
        periodStart,
        periodEnd,
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
    let totalPayments = 0;
    let totalDue = Number(contract.rentAmount);

    receiptItems.push({
      description: 'Monthly Rent',
      amount: Number(contract.rentAmount),
    });

    if (lightConsumption.consumption > 0) {
      receiptItems.push({
        description: `Electricity Consumption (${lightConsumption.consumption} units)`,
        amount: lightConsumption.cost,
      });
      totalDue += lightConsumption.cost;
    }

    if (waterConsumption.consumption > 0) {
      receiptItems.push({
        description: `Water Consumption (${waterConsumption.consumption} units)`,
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

    payments.forEach((payment) => {
      receiptItems.push({
        description: `Payment (${payment.type}) - ${payment.description || 'N/A'}`,
        amount: -Number(payment.amount),
      });
      totalPayments += Number(payment.amount);
    });

    const balance = totalPayments - totalDue;

    return {
      contractId: contract.id,
      month,
      year,
      tenantName: contract.tenant.name,
      departmentName: contract.department.name,
      propertyAddress: contract.department.property.address,
      period: periodStart.toLocaleString('en-US', {
        month: 'long',
        year: 'numeric',
      }),
      items: receiptItems,
      totalPayments,
      totalDue,
      balance,
    };
  }
}

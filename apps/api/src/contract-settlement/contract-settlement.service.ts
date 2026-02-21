import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Contract } from '../contract/entities/contract.entity';
import { Payment } from '../payment/entities/payment.entity';
import { ConsumptionService } from '../consumption/consumption.service';

export interface SettlementResult {
  contractId: string;
  tenantName: string;
  departmentName: string;
  propertyAddress: string;
  contractStartDate: Date;
  contractEndDate: Date;
  actualEndDate: Date;
  totalCharges: number;
  totalPayments: number;
  advancePaymentUsed: boolean;
  guaranteeDeduction: number;
  finalBalance: number; // Positive if tenant owes, negative if landlord owes
}

@Injectable()
export class ContractSettlementService {
  constructor(
    @InjectRepository(Contract)
    private readonly contractRepository: Repository<Contract>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    private readonly consumptionService: ConsumptionService,
  ) {}

  async calculateFinalSettlement(
    contractId: string,
    actualEndDate: Date,
  ): Promise<SettlementResult> {
    const contract = await this.contractRepository.findOne({
      where: { id: contractId },
      relations: ['tenant', 'department', 'department.property'],
    });

    if (!contract) {
      throw new NotFoundException(`Contract with ID "${contractId}" not found`);
    }

    const effectiveEndDate =
      actualEndDate > contract.endDate ? actualEndDate : contract.endDate;

    let totalCharges = 0;
    let totalPayments = 0;
    const advancePaymentUsed = false;
    let guaranteeDeduction = 0;

    // Calculate rent charges up to actualEndDate
    const currentMonth = new Date(contract.startDate);
    while (currentMonth <= effectiveEndDate) {
      totalCharges += contract.rentAmount;
      currentMonth.setMonth(currentMonth.getMonth() + 1);
    }

    // Fetch all payments for this contract
    const allPayments = await this.paymentRepository.find({
      where: { contractId: contract.id },
      order: { date: 'ASC' },
    });

    for (const payment of allPayments) {
      totalPayments += payment.amount;
    }

    // If actualEndDate is after contractEndDate, deduct from guarantee
    if (actualEndDate > contract.endDate) {
      const daysOverstayed = Math.ceil(
        (actualEndDate.getTime() - contract.endDate.getTime()) /
          (1000 * 60 * 60 * 24),
      );
      const dailyRent = contract.rentAmount / 30;
      guaranteeDeduction = Math.min(
        daysOverstayed * dailyRent,
        contract.guaranteeDeposit,
      );
      totalCharges += guaranteeDeduction;
    }

    const finalBalance = totalPayments - totalCharges;

    return {
      contractId: contract.id,
      tenantName: contract.tenant.name,
      departmentName: contract.department.name,
      propertyAddress: contract.department.property.address,
      contractStartDate: contract.startDate,
      contractEndDate: contract.endDate,
      actualEndDate: actualEndDate,
      totalCharges: totalCharges,
      totalPayments: totalPayments,
      advancePaymentUsed: advancePaymentUsed,
      guaranteeDeduction: guaranteeDeduction,
      finalBalance: finalBalance,
    };
  }
}

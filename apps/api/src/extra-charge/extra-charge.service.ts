import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExtraCharge, ExtraChargeType } from './entities/extra-charge.entity';
import { CreateExtraChargeDto } from './dto/create-extra-charge.dto';
import { GenerateLateFeeDto } from './dto/generate-late-fee.dto';
import { Contract } from '../contract/entities/contract.entity';
import { ReceiptEntity } from '../receipt/entities/receipt.entity';

@Injectable()
export class ExtraChargeService {
  private readonly logger = new Logger(ExtraChargeService.name);

  constructor(
    @InjectRepository(ExtraCharge)
    private readonly extraChargeRepository: Repository<ExtraCharge>,
    @InjectRepository(Contract)
    private readonly contractRepository: Repository<Contract>,
    @InjectRepository(ReceiptEntity)
    private readonly receiptRepository: Repository<ReceiptEntity>,
  ) {}

  async create(dto: CreateExtraChargeDto): Promise<ExtraCharge> {
    const contract = await this.contractRepository.findOne({
      where: { id: dto.contractId },
    });
    if (!contract) {
      throw new BadRequestException(
        `Contract with ID "${dto.contractId}" not found`,
      );
    }

    const extraCharge = this.extraChargeRepository.create({
      ...dto,
      contract,
    });
    return this.extraChargeRepository.save(extraCharge);
  }

  async findAll(
    contractId?: string,
    month?: number,
    year?: number,
  ): Promise<ExtraCharge[]> {
    const where: Record<string, string | number> = {};
    if (contractId) where.contractId = contractId;
    if (month) where.month = month;
    if (year) where.year = year;

    return this.extraChargeRepository.find({
      where,
      relations: ['contract'],
    });
  }

  async findByContractAndPeriod(
    contractId: string,
    month: number,
    year: number,
  ): Promise<ExtraCharge[]> {
    return this.extraChargeRepository.find({
      where: { contractId, month, year },
      relations: ['contract'],
    });
  }

  async findOne(id: string): Promise<ExtraCharge> {
    const extraCharge = await this.extraChargeRepository.findOne({
      where: { id },
      relations: ['contract'],
    });
    if (!extraCharge) {
      throw new NotFoundException(`ExtraCharge with ID "${id}" not found`);
    }
    return extraCharge;
  }

  async generateLateFee(dto: GenerateLateFeeDto): Promise<ExtraCharge> {
    const { contractId, month, year, ratePerDay } = dto;

    const receipt = await this.receiptRepository.findOne({
      where: { contractId, month, year },
    });

    if (!receipt) {
      throw new NotFoundException(
        `No receipt found for contract ${contractId} (${month}/${year})`,
      );
    }

    if (Number(receipt.balance) >= 0) {
      throw new BadRequestException(
        `Receipt for ${month}/${year} has a positive balance (S/ ${Number(receipt.balance).toFixed(2)}). No late fee applicable.`,
      );
    }

    const overdueDate = new Date(year, month, 15);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (today <= overdueDate) {
      throw new BadRequestException(
        `Receipt for ${month}/${year} is not yet overdue. Grace period ends on ${overdueDate.toISOString().slice(0, 10)}.`,
      );
    }

    const msPerDay = 24 * 60 * 60 * 1000;
    const daysOverdue = Math.floor(
      (today.getTime() - overdueDate.getTime()) / msPerDay,
    );

    const amount = ratePerDay * daysOverdue;

    const existing = await this.extraChargeRepository.findOne({
      where: {
        contractId,
        type: ExtraChargeType.LATE_FEE,
        sourceReceiptId: receipt.id,
      },
    });

    if (existing) {
      existing.amount = amount;
      existing.ratePerDay = ratePerDay;
      existing.daysOverdue = daysOverdue;
      existing.description = `Mora por recibo atrasado (${daysOverdue} dias x S/ ${ratePerDay.toFixed(2)}/dia)`;
      this.logger.log(
        `Updating late fee for receipt ${receipt.id}: ${daysOverdue} days, S/ ${amount.toFixed(2)}`,
      );
      return this.extraChargeRepository.save(existing);
    }

    const contract = await this.contractRepository.findOne({
      where: { id: contractId },
    });
    if (!contract) {
      throw new NotFoundException(`Contract with ID "${contractId}" not found`);
    }

    const lateFee = this.extraChargeRepository.create({
      description: `Mora por recibo atrasado (${daysOverdue} dias x S/ ${ratePerDay.toFixed(2)}/dia)`,
      amount,
      month,
      year,
      contractId,
      type: ExtraChargeType.LATE_FEE,
      sourceReceiptId: receipt.id,
      ratePerDay,
      daysOverdue,
      contract,
    });

    this.logger.log(
      `Creating late fee for receipt ${receipt.id}: ${daysOverdue} days, S/ ${amount.toFixed(2)}`,
    );
    return this.extraChargeRepository.save(lateFee);
  }

  async remove(id: string): Promise<void> {
    const extraCharge = await this.findOne(id);

    if (extraCharge.type === ExtraChargeType.LATE_FEE) {
      throw new BadRequestException(
        'Cannot delete auto-generated late fee charges. Regenerate the receipt instead.',
      );
    }

    await this.extraChargeRepository.remove(extraCharge);
  }
}

import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExtraCharge } from './entities/extra-charge.entity';
import { CreateExtraChargeDto } from './dto/create-extra-charge.dto';
import { Contract } from '../contract/entities/contract.entity';

@Injectable()
export class ExtraChargeService {
  constructor(
    @InjectRepository(ExtraCharge)
    private readonly extraChargeRepository: Repository<ExtraCharge>,
    @InjectRepository(Contract)
    private readonly contractRepository: Repository<Contract>,
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
    contractId?: number,
    month?: number,
    year?: number,
  ): Promise<ExtraCharge[]> {
    const where: Record<string, number> = {};
    if (contractId) where.contractId = contractId;
    if (month) where.month = month;
    if (year) where.year = year;

    return this.extraChargeRepository.find({
      where,
      relations: ['contract'],
    });
  }

  async findByContractAndPeriod(
    contractId: number,
    month: number,
    year: number,
  ): Promise<ExtraCharge[]> {
    return this.extraChargeRepository.find({
      where: { contractId, month, year },
      relations: ['contract'],
    });
  }

  async findOne(id: number): Promise<ExtraCharge> {
    const extraCharge = await this.extraChargeRepository.findOne({
      where: { id },
      relations: ['contract'],
    });
    if (!extraCharge) {
      throw new NotFoundException(`ExtraCharge with ID "${id}" not found`);
    }
    return extraCharge;
  }

  async remove(id: number): Promise<void> {
    const extraCharge = await this.findOne(id);
    await this.extraChargeRepository.remove(extraCharge);
  }
}

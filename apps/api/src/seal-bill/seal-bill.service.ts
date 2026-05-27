import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SealBill } from './entities/seal-bill.entity';

@Injectable()
export class SealBillService {
  private readonly logger = new Logger(SealBillService.name);

  constructor(
    @InjectRepository(SealBill)
    private readonly billRepo: Repository<SealBill>,
  ) {}

  async findByProperty(propertyId: string, limit = 12): Promise<SealBill[]> {
    return this.billRepo.find({
      where: { propertyId },
      order: { periodoComercial: 'DESC' },
      take: limit,
    });
  }

  async findOneByPropertyAndBillId(
    propertyId: string,
    billId: string,
  ): Promise<SealBill | null> {
    return this.billRepo.findOne({
      where: { id: billId, propertyId },
    });
  }
}

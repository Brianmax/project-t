import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExtraChargeController } from './extra-charge.controller';
import { ExtraChargeService } from './extra-charge.service';
import { ExtraCharge } from './entities/extra-charge.entity';
import { Contract } from '../contract/entities/contract.entity';
import { ReceiptEntity } from '../receipt/entities/receipt.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ExtraCharge, Contract, ReceiptEntity])],
  controllers: [ExtraChargeController],
  providers: [ExtraChargeService],
})
export class ExtraChargeModule {}

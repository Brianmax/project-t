import { Module } from '@nestjs/common';
import { ContractSettlementService } from './contract-settlement.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Contract } from '../contract/entities/contract.entity';
import { Payment } from '../payment/entities/payment.entity';
import { ConsumptionModule } from '../consumption/consumption.module';

@Module({
  imports: [TypeOrmModule.forFeature([Contract, Payment]), ConsumptionModule],
  providers: [ContractSettlementService],
  exports: [ContractSettlementService],
})
export class ContractSettlementModule {}

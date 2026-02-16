import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContractService } from './contract.service';
import { ContractController } from './contract.controller';
import { Contract } from './entities/contract.entity';
import { Tenant } from '../tenant/entities/tenant.entity';
import { Department } from '../department/entities/department.entity';
import { ReceiptModule } from '../receipt/receipt.module';
import { ContractSettlementModule } from '../contract-settlement/contract-settlement.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Contract, Tenant, Department]),
    ReceiptModule,
    ContractSettlementModule,
  ],
  controllers: [ContractController],
  providers: [ContractService],
})
export class ContractModule {}

import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContractService } from './contract.service';
import { ContractController } from './contract.controller';
import { Contract } from './entities/contract.entity';
import { Tenant } from '../tenant/entities/tenant.entity';
import { Department } from '../department/entities/department.entity';
import { Payment } from '../payment/entities/payment.entity';
import { ReceiptEntity } from '../receipt/entities/receipt.entity';
import { ReceiptModule } from '../receipt/receipt.module';
import { ContractSettlementModule } from '../contract-settlement/contract-settlement.module';
import { ContractTerminationModule } from '../contract-termination/contract-termination.module';
import { ContractLedgerService } from './contract-ledger.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Contract,
      Tenant,
      Department,
      Payment,
      ReceiptEntity,
    ]),
    forwardRef(() => ReceiptModule),
    ContractSettlementModule,
    ContractTerminationModule,
  ],
  controllers: [ContractController],
  providers: [ContractService, ContractLedgerService],
  exports: [ContractLedgerService],
})
export class ContractModule {}

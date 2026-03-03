import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContractTermination } from './entities/contract-termination.entity';
import { Contract } from '../contract/entities/contract.entity';
import { Department } from '../department/entities/department.entity';
import { ContractTerminationService } from './contract-termination.service';

@Module({
  imports: [TypeOrmModule.forFeature([ContractTermination, Contract, Department])],
  providers: [ContractTerminationService],
  exports: [ContractTerminationService],
})
export class ContractTerminationModule {}

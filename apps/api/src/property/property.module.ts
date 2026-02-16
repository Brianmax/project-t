import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PropertyService } from './property.service';
import { PropertyController } from './property.controller';
import { Property } from './entities/property.entity';
import { Contract } from '../contract/entities/contract.entity';
import { Department } from '../department/entities/department.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Property, Contract, Department])],
  controllers: [PropertyController],
  providers: [PropertyService],
})
export class PropertyModule {}

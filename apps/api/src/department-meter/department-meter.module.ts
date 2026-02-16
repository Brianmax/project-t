import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DepartmentMeterController } from './department-meter.controller';
import { DepartmentMeterService } from './department-meter.service';
import { DepartmentMeter } from './entities/department-meter.entity';
import { Department } from '../department/entities/department.entity';

@Module({
  imports: [TypeOrmModule.forFeature([DepartmentMeter, Department])],
  controllers: [DepartmentMeterController],
  providers: [DepartmentMeterService],
})
export class DepartmentMeterModule {}

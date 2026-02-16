import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DepartmentService } from './department.service';
import { DepartmentController } from './department.controller';
import { Department } from './entities/department.entity';
import { Property } from '../property/entities/property.entity';
import { DepartmentMeter } from '../department-meter/entities/department-meter.entity';
import { MeterReading } from '../meter-reading/entities/meter-reading.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Department,
      Property,
      DepartmentMeter,
      MeterReading,
    ]),
  ],
  controllers: [DepartmentController],
  providers: [DepartmentService],
})
export class DepartmentModule {}

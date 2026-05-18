import { Module } from '@nestjs/common';
import { ConsumptionService } from './consumption.service';
import { ConsumptionController } from './consumption.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DepartmentMeter } from '../department-meter/entities/department-meter.entity';
import { MeterReading } from '../meter-reading/entities/meter-reading.entity';
import { Property } from '../property/entities/property.entity';
import { MeterReadingModule } from '../meter-reading/meter-reading.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([DepartmentMeter, MeterReading, Property]),
    MeterReadingModule,
  ],
  controllers: [ConsumptionController],
  providers: [ConsumptionService],
  exports: [ConsumptionService],
})
export class ConsumptionModule {}

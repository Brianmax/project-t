import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MeterReadingController } from './meter-reading.controller';
import { MeterReadingService } from './meter-reading.service';
import { MeterReading } from './entities/meter-reading.entity';
import { DepartmentMeter } from '../department-meter/entities/department-meter.entity';

@Module({
  imports: [TypeOrmModule.forFeature([MeterReading, DepartmentMeter])],
  controllers: [MeterReadingController],
  providers: [MeterReadingService],
})
export class MeterReadingModule {}

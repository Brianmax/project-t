import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PropertyMeterService } from './property-meter.service';
import { PropertyMeterController } from './property-meter.controller';
import { PropertyMeter } from './entities/property-meter.entity';
import { Property } from '../property/entities/property.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PropertyMeter, Property])],
  controllers: [PropertyMeterController],
  providers: [PropertyMeterService],
})
export class PropertyMeterModule {}

import { IsEnum, IsNotEmpty, IsNumber } from 'class-validator';
import { MeterType } from '../../department-meter/entities/department-meter.entity';

export class CreatePropertyMeterDto {
  @IsEnum(MeterType)
  @IsNotEmpty()
  meterType: MeterType;

  @IsNumber()
  @IsNotEmpty()
  propertyId: number;
}

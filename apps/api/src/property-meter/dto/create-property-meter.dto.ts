import { IsEnum, IsNotEmpty, IsUUID } from 'class-validator';
import { MeterType } from '../../department-meter/entities/department-meter.entity';

export class CreatePropertyMeterDto {
  @IsEnum(MeterType)
  @IsNotEmpty()
  meterType: MeterType;

  @IsUUID()
  @IsNotEmpty()
  propertyId: string;
}

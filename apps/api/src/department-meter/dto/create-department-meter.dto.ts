import { IsEnum, IsNotEmpty, IsNumber } from 'class-validator';
import { MeterType } from '../entities/department-meter.entity';

export class CreateDepartmentMeterDto {
  @IsEnum(MeterType)
  @IsNotEmpty()
  meterType: MeterType;

  @IsNumber()
  @IsNotEmpty()
  departmentId: number;
}

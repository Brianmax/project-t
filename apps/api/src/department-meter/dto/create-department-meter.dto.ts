import { IsEnum, IsNotEmpty, IsUUID } from 'class-validator';
import { MeterType } from '../entities/department-meter.entity';

export class CreateDepartmentMeterDto {
  @IsEnum(MeterType)
  @IsNotEmpty()
  meterType: MeterType;

  @IsUUID()
  @IsNotEmpty()
  departmentId: string;
}

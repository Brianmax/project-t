import { PartialType } from '@nestjs/mapped-types';
import { CreateDepartmentMeterDto } from './create-department-meter.dto';

export class UpdateDepartmentMeterDto extends PartialType(
  CreateDepartmentMeterDto,
) {}

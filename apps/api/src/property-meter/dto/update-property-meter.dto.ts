import { PartialType } from '@nestjs/mapped-types';
import { CreatePropertyMeterDto } from './create-property-meter.dto';

export class UpdatePropertyMeterDto extends PartialType(
  CreatePropertyMeterDto,
) {}

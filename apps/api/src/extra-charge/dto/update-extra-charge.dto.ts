import { PartialType } from '@nestjs/mapped-types';
import { CreateExtraChargeDto } from './create-extra-charge.dto';

export class UpdateExtraChargeDto extends PartialType(CreateExtraChargeDto) {}

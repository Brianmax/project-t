import {
  IsString,
  IsOptional,
  IsIn,
  Matches,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ConfigureSealDto {
  @IsString()
  @Matches(/^\d{4,20}$/, { message: 'Supply code must be 4–20 digits' })
  sealSupplyCode: string | null;

  @IsOptional()
  @IsString()
  @IsIn(['1', '2', '3', '4', '5'])
  sealBranchCode?: string;
}

export class ListBillsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 12;
}

export class SyncStatusQueryDto {
  @IsString()
  jobId: string;
}

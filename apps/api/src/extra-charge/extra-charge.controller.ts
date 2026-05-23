import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ExtraChargeService } from './extra-charge.service';
import { CreateExtraChargeDto } from './dto/create-extra-charge.dto';

@Controller('extra-charges')
export class ExtraChargeController {
  constructor(private readonly extraChargeService: ExtraChargeService) {}

  @Post()
  create(@Body() dto: CreateExtraChargeDto) {
    return this.extraChargeService.create(dto);
  }

  @Get()
  findAll(
    @Query('contractId') contractId?: string,
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    return this.extraChargeService.findAll(
      contractId ? contractId : undefined,
      month ? +month : undefined,
      year ? +year : undefined,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.extraChargeService.findOne(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.extraChargeService.remove(id);
  }
}

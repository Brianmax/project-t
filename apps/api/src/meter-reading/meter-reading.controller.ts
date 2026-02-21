import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { MeterReadingService } from './meter-reading.service';
import { CreateMeterReadingDto } from './dto/create-meter-reading.dto';
import { UpdateMeterReadingDto } from './dto/update-meter-reading.dto';

@Controller('meter-readings')
export class MeterReadingController {
  constructor(private readonly meterReadingService: MeterReadingService) {}

  @Post()
  create(@Body() createMeterReadingDto: CreateMeterReadingDto) {
    return this.meterReadingService.create(createMeterReadingDto);
  }

  @Get()
  findAll() {
    return this.meterReadingService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.meterReadingService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateMeterReadingDto: UpdateMeterReadingDto,
  ) {
    return this.meterReadingService.update(id, updateMeterReadingDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.meterReadingService.remove(id);
  }
}

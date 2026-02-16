import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { PropertyMeterService } from './property-meter.service';
import { CreatePropertyMeterDto } from './dto/create-property-meter.dto';
import { UpdatePropertyMeterDto } from './dto/update-property-meter.dto';

@Controller('property-meter')
export class PropertyMeterController {
  constructor(private readonly propertyMeterService: PropertyMeterService) {}

  @Post()
  create(@Body() createPropertyMeterDto: CreatePropertyMeterDto) {
    return this.propertyMeterService.create(createPropertyMeterDto);
  }

  @Get()
  findAll() {
    return this.propertyMeterService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.propertyMeterService.findOne(+id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updatePropertyMeterDto: UpdatePropertyMeterDto,
  ) {
    return this.propertyMeterService.update(+id, updatePropertyMeterDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.propertyMeterService.remove(+id);
  }
}

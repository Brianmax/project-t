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
import { DepartmentMeterService } from './department-meter.service';
import { CreateDepartmentMeterDto } from './dto/create-department-meter.dto';
import { UpdateDepartmentMeterDto } from './dto/update-department-meter.dto';

@Controller('department-meters')
export class DepartmentMeterController {
  constructor(
    private readonly departmentMeterService: DepartmentMeterService,
  ) {}

  @Post()
  create(@Body() createDepartmentMeterDto: CreateDepartmentMeterDto) {
    return this.departmentMeterService.create(createDepartmentMeterDto);
  }

  @Get()
  findAll() {
    return this.departmentMeterService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.departmentMeterService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateDepartmentMeterDto: UpdateDepartmentMeterDto,
  ) {
    return this.departmentMeterService.update(id, updateDepartmentMeterDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.departmentMeterService.remove(id);
  }
}

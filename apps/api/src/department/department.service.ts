import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Department } from './entities/department.entity';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { Property } from '../property/entities/property.entity';

import {
  DepartmentMeter,
  MeterType,
} from '../department-meter/entities/department-meter.entity';
import { MeterReading } from '../meter-reading/entities/meter-reading.entity';

@Injectable()
export class DepartmentService {
  constructor(
    @InjectRepository(Department)
    private readonly departmentRepository: Repository<Department>,
    @InjectRepository(Property)
    private readonly propertyRepository: Repository<Property>,
    @InjectRepository(DepartmentMeter)
    private readonly departmentMeterRepository: Repository<DepartmentMeter>,
    @InjectRepository(MeterReading)
    private readonly meterReadingRepository: Repository<MeterReading>,
  ) {}

  async create(createDepartmentDto: CreateDepartmentDto): Promise<Department> {
    const property = await this.propertyRepository.findOne({
      where: { id: createDepartmentDto.propertyId },
    });
    if (!property) {
      throw new BadRequestException(
        `Property with ID "${createDepartmentDto.propertyId}" not found`,
      );
    }

    const department = this.departmentRepository.create({
      ...createDepartmentDto,
      property: property,
    });
    const savedDepartment = await this.departmentRepository.save(department);

    const resolveReadingDate = (
      providedDate: string | undefined,
      readingType: 'water' | 'electricity',
    ): Date => {
      if (!providedDate) {
        return new Date();
      }
      const parsedDate = new Date(providedDate);
      if (Number.isNaN(parsedDate.getTime())) {
        throw new BadRequestException(
          `Invalid initial ${readingType} reading date`,
        );
      }
      return parsedDate;
    };

    // Handle initial water reading
    if (createDepartmentDto.initialWaterReading !== undefined) {
      const waterMeter = this.departmentMeterRepository.create({
        meterType: MeterType.WATER,
        department: savedDepartment,
      });
      const savedWaterMeter =
        await this.departmentMeterRepository.save(waterMeter);

      const reading = this.meterReadingRepository.create({
        reading: createDepartmentDto.initialWaterReading,
        date: resolveReadingDate(
          createDepartmentDto.initialWaterReadingDate,
          'water',
        ),
        departmentMeter: savedWaterMeter,
      });
      await this.meterReadingRepository.save(reading);
    }

    // Handle initial electricity reading
    if (createDepartmentDto.initialElectricityReading !== undefined) {
      const lightMeter = this.departmentMeterRepository.create({
        meterType: MeterType.LIGHT,
        department: savedDepartment,
      });
      const savedLightMeter =
        await this.departmentMeterRepository.save(lightMeter);

      const reading = this.meterReadingRepository.create({
        reading: createDepartmentDto.initialElectricityReading,
        date: resolveReadingDate(
          createDepartmentDto.initialElectricityReadingDate,
          'electricity',
        ),
        departmentMeter: savedLightMeter,
      });
      await this.meterReadingRepository.save(reading);
    }

    return savedDepartment;
  }

  async findAll(): Promise<Department[]> {
    return this.departmentRepository.find({ relations: ['property'] });
  }

  async findOne(id: string): Promise<Department> {
    const department = await this.departmentRepository.findOne({
      where: { id },
      relations: ['property'],
    });
    if (!department) {
      throw new NotFoundException(`Department with ID "${id}" not found`);
    }
    return department;
  }

  async update(
    id: string,
    updateDepartmentDto: UpdateDepartmentDto,
  ): Promise<Department> {
    const department = await this.findOne(id);

    if (updateDepartmentDto.propertyId) {
      const property = await this.propertyRepository.findOne({
        where: { id: updateDepartmentDto.propertyId },
      });
      if (!property) {
        throw new BadRequestException(
          `Property with ID "${updateDepartmentDto.propertyId}" not found`,
        );
      }
      department.property = property;
    }

    this.departmentRepository.merge(department, updateDepartmentDto);
    return this.departmentRepository.save(department);
  }

  async remove(id: string): Promise<void> {
    const department = await this.findOne(id);
    await this.departmentRepository.remove(department);
  }
}

import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MeterReading } from './entities/meter-reading.entity';
import { CreateMeterReadingDto } from './dto/create-meter-reading.dto';
import { UpdateMeterReadingDto } from './dto/update-meter-reading.dto';
import { DepartmentMeter } from '../department-meter/entities/department-meter.entity';

@Injectable()
export class MeterReadingService {
  constructor(
    @InjectRepository(MeterReading)
    private readonly meterReadingRepository: Repository<MeterReading>,
    @InjectRepository(DepartmentMeter)
    private readonly departmentMeterRepository: Repository<DepartmentMeter>,
  ) {}

  async create(
    createMeterReadingDto: CreateMeterReadingDto,
  ): Promise<MeterReading> {
    const departmentMeter = await this.departmentMeterRepository.findOne({
      where: { id: createMeterReadingDto.departmentMeterId },
    });
    if (!departmentMeter) {
      throw new BadRequestException(
        `DepartmentMeter with ID "${createMeterReadingDto.departmentMeterId}" not found`,
      );
    }

    const meterReading = this.meterReadingRepository.create({
      ...createMeterReadingDto,
      departmentMeter: departmentMeter,
    });
    return this.meterReadingRepository.save(meterReading);
  }

  async findAll(): Promise<MeterReading[]> {
    return this.meterReadingRepository.find({ relations: ['departmentMeter'] });
  }

  async findOne(id: number): Promise<MeterReading> {
    const meterReading = await this.meterReadingRepository.findOne({
      where: { id },
      relations: ['departmentMeter'],
    });
    if (!meterReading) {
      throw new NotFoundException(`MeterReading with ID "${id}" not found`);
    }
    return meterReading;
  }

  async update(
    id: number,
    updateMeterReadingDto: UpdateMeterReadingDto,
  ): Promise<MeterReading> {
    const meterReading = await this.findOne(id);

    if (updateMeterReadingDto.departmentMeterId) {
      const departmentMeter = await this.departmentMeterRepository.findOne({
        where: { id: updateMeterReadingDto.departmentMeterId },
      });
      if (!departmentMeter) {
        throw new BadRequestException(
          `DepartmentMeter with ID "${updateMeterReadingDto.departmentMeterId}" not found`,
        );
      }
      meterReading.departmentMeter = departmentMeter;
    }

    this.meterReadingRepository.merge(meterReading, updateMeterReadingDto);
    return this.meterReadingRepository.save(meterReading);
  }

  async remove(id: number): Promise<void> {
    const meterReading = await this.findOne(id);
    await this.meterReadingRepository.remove(meterReading);
  }
}

import {
  Injectable,
  Logger,
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
  private readonly logger = new Logger(MeterReadingService.name);

  constructor(
    @InjectRepository(MeterReading)
    private readonly meterReadingRepository: Repository<MeterReading>,
    @InjectRepository(DepartmentMeter)
    private readonly departmentMeterRepository: Repository<DepartmentMeter>,
  ) {}

  async create(
    createMeterReadingDto: CreateMeterReadingDto,
  ): Promise<MeterReading> {
    const { departmentMeterId, reading, date } = createMeterReadingDto;
    this.logger.log(
      `Creating reading: meterId=${departmentMeterId} reading=${reading} date=${date}`,
    );

    const departmentMeter = await this.departmentMeterRepository.findOne({
      where: { id: departmentMeterId },
      relations: ['department'],
    });
    if (!departmentMeter) {
      this.logger.warn(`DepartmentMeter not found: id=${departmentMeterId}`);
      throw new BadRequestException(
        `DepartmentMeter with ID "${departmentMeterId}" not found`,
      );
    }
    this.logger.log(
      `Meter resolved: type=${departmentMeter.meterType} departmentId=${departmentMeter.departmentId}`,
    );

    const lastReading = await this.meterReadingRepository.findOne({
      where: { departmentMeterId },
      order: { date: 'DESC' },
    });
    if (lastReading) {
      this.logger.log(
        `Previous reading: value=${lastReading.reading} date=${lastReading.date}`,
      );
    } else {
      this.logger.log(`No previous reading found for meter ${departmentMeterId}`);
    }

    const meterReading = this.meterReadingRepository.create({
      ...createMeterReadingDto,
      departmentMeter,
    });
    const saved = await this.meterReadingRepository.save(meterReading);
    this.logger.log(`Reading saved: id=${saved.id}`);
    return saved;
  }

  async findAll(): Promise<MeterReading[]> {
    return this.meterReadingRepository.find({ relations: ['departmentMeter'] });
  }

  async findOne(id: string): Promise<MeterReading> {
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
    id: string,
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

  async remove(id: string): Promise<void> {
    const meterReading = await this.findOne(id);
    await this.meterReadingRepository.remove(meterReading);
  }
}

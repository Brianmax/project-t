import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DepartmentMeter } from './entities/department-meter.entity';
import { CreateDepartmentMeterDto } from './dto/create-department-meter.dto';
import { UpdateDepartmentMeterDto } from './dto/update-department-meter.dto';
import { Department } from '../department/entities/department.entity';

@Injectable()
export class DepartmentMeterService {
  constructor(
    @InjectRepository(DepartmentMeter)
    private readonly departmentMeterRepository: Repository<DepartmentMeter>,
    @InjectRepository(Department)
    private readonly departmentRepository: Repository<Department>,
  ) {}

  async create(
    createDepartmentMeterDto: CreateDepartmentMeterDto,
  ): Promise<DepartmentMeter> {
    const department = await this.departmentRepository.findOne({
      where: { id: createDepartmentMeterDto.departmentId },
    });
    if (!department) {
      throw new BadRequestException(
        `Department with ID "${createDepartmentMeterDto.departmentId}" not found`,
      );
    }

    const departmentMeter = this.departmentMeterRepository.create({
      ...createDepartmentMeterDto,
      department: department,
    });
    return this.departmentMeterRepository.save(departmentMeter);
  }

  async findAll(): Promise<DepartmentMeter[]> {
    return this.departmentMeterRepository.find({ relations: ['department'] });
  }

  async findOne(id: string): Promise<DepartmentMeter> {
    const departmentMeter = await this.departmentMeterRepository.findOne({
      where: { id },
      relations: ['department'],
    });
    if (!departmentMeter) {
      throw new NotFoundException(`DepartmentMeter with ID "${id}" not found`);
    }
    return departmentMeter;
  }

  async update(
    id: string,
    updateDepartmentMeterDto: UpdateDepartmentMeterDto,
  ): Promise<DepartmentMeter> {
    const departmentMeter = await this.findOne(id);

    if (updateDepartmentMeterDto.departmentId) {
      const department = await this.departmentRepository.findOne({
        where: { id: updateDepartmentMeterDto.departmentId },
      });
      if (!department) {
        throw new BadRequestException(
          `Department with ID "${updateDepartmentMeterDto.departmentId}" not found`,
        );
      }
      departmentMeter.department = department;
    }

    this.departmentMeterRepository.merge(
      departmentMeter,
      updateDepartmentMeterDto,
    );
    return this.departmentMeterRepository.save(departmentMeter);
  }

  async remove(id: string): Promise<void> {
    const departmentMeter = await this.findOne(id);
    await this.departmentMeterRepository.remove(departmentMeter);
  }
}

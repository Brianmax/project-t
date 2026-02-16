import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Contract } from './entities/contract.entity';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import { Tenant } from '../tenant/entities/tenant.entity';
import { Department } from '../department/entities/department.entity';

@Injectable()
export class ContractService {
  constructor(
    @InjectRepository(Contract)
    private readonly contractRepository: Repository<Contract>,
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    @InjectRepository(Department)
    private readonly departmentRepository: Repository<Department>,
  ) {}

  async create(createContractDto: CreateContractDto): Promise<Contract> {
    const tenant = await this.tenantRepository.findOne({
      where: { id: createContractDto.tenantId },
    });
    if (!tenant) {
      throw new BadRequestException(
        `Tenant with ID "${createContractDto.tenantId}" not found`,
      );
    }

    const department = await this.departmentRepository.findOne({
      where: { id: createContractDto.departmentId },
    });
    if (!department) {
      throw new BadRequestException(
        `Department with ID "${createContractDto.departmentId}" not found`,
      );
    }

    // Check if department is available
    if (!department.isAvailable) {
      throw new BadRequestException(
        `Department "${department.name}" is not available for rent.`,
      );
    }

    const contract = this.contractRepository.create({
      ...createContractDto,
      tenant: tenant,
      department: department,
    });

    // Mark department as unavailable
    department.isAvailable = false;
    await this.departmentRepository.save(department);

    return this.contractRepository.save(contract);
  }

  async findAll(): Promise<Contract[]> {
    return this.contractRepository.find({
      relations: ['tenant', 'department'],
    });
  }

  async findOne(id: number): Promise<Contract> {
    const contract = await this.contractRepository.findOne({
      where: { id },
      relations: ['tenant', 'department'],
    });
    if (!contract) {
      throw new NotFoundException(`Contract with ID "${id}" not found`);
    }
    return contract;
  }

  async update(
    id: number,
    updateContractDto: UpdateContractDto,
  ): Promise<Contract> {
    const contract = await this.findOne(id);

    if (updateContractDto.tenantId) {
      const tenant = await this.tenantRepository.findOne({
        where: { id: updateContractDto.tenantId },
      });
      if (!tenant) {
        throw new BadRequestException(
          `Tenant with ID "${updateContractDto.tenantId}" not found`,
        );
      }
      contract.tenant = tenant;
    }

    if (updateContractDto.departmentId) {
      const department = await this.departmentRepository.findOne({
        where: { id: updateContractDto.departmentId },
      });
      if (!department) {
        throw new BadRequestException(
          `Department with ID "${updateContractDto.departmentId}" not found`,
        );
      }
      contract.department = department;
    }

    this.contractRepository.merge(contract, updateContractDto);
    return this.contractRepository.save(contract);
  }

  async remove(id: number): Promise<void> {
    const contract = await this.findOne(id);

    // Mark department as available again
    if (contract.department) {
      contract.department.isAvailable = true;
      await this.departmentRepository.save(contract.department);
    }

    await this.contractRepository.remove(contract);
  }
}

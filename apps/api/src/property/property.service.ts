import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Property } from './entities/property.entity';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { Contract } from '../contract/entities/contract.entity';
import { Tenant } from '../tenant/entities/tenant.entity';
import { Department } from '../department/entities/department.entity';
import { ExtraCharge } from '../extra-charge/entities/extra-charge.entity';
import { Payment } from '../payment/entities/payment.entity';
import { DepartmentMeter } from '../department-meter/entities/department-meter.entity';
import { PropertyMeter } from '../property-meter/entities/property-meter.entity';

@Injectable()
export class PropertyService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectRepository(Property)
    private readonly propertyRepository: Repository<Property>,
    @InjectRepository(Contract)
    private readonly contractRepository: Repository<Contract>,
    @InjectRepository(Department)
    private readonly departmentRepository: Repository<Department>,
  ) {}

  async create(createPropertyDto: CreatePropertyDto): Promise<Property> {
    const property = this.propertyRepository.create(createPropertyDto);
    return this.propertyRepository.save(property);
  }

  async findAll(): Promise<Property[]> {
    return this.propertyRepository.find();
  }

  async findOne(id: string): Promise<Property> {
    const property = await this.propertyRepository.findOne({ where: { id } });
    if (!property) {
      throw new NotFoundException(`Property with ID "${id}" not found`);
    }
    return property;
  }

  async update(
    id: string,
    updatePropertyDto: UpdatePropertyDto,
  ): Promise<Property> {
    const property = await this.findOne(id);
    this.propertyRepository.merge(property, updatePropertyDto);
    return this.propertyRepository.save(property);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);

    await this.dataSource.transaction(async (manager) => {
      const departments = await manager.find(Department, {
        where: { propertyId: id },
        select: ['id'],
      });
      const departmentIds = departments.map((department) => department.id);

      let relatedTenantIds: string[] = [];

      if (departmentIds.length > 0) {
        const contracts = await manager.find(Contract, {
          where: { departmentId: In(departmentIds) },
          select: ['id', 'tenantId'],
        });
        const contractIds = contracts.map((contract) => contract.id);
        relatedTenantIds = Array.from(
          new Set(contracts.map((contract) => contract.tenantId)),
        );

        if (contractIds.length > 0) {
          await manager.delete(ExtraCharge, { contractId: In(contractIds) });
          await manager.delete(Payment, { contractId: In(contractIds) });
          await manager.delete(Contract, { id: In(contractIds) });
        }

        await manager.delete(DepartmentMeter, {
          departmentId: In(departmentIds),
        });
        await manager.delete(Department, { id: In(departmentIds) });
      }

      await manager.delete(PropertyMeter, { propertyId: id });
      await manager.delete(Property, { id });

      if (relatedTenantIds.length > 0) {
        const remainingContracts = await manager.find(Contract, {
          where: { tenantId: In(relatedTenantIds) },
          select: ['tenantId'],
        });
        const tenantIdsWithContracts = new Set(
          remainingContracts.map((contract) => contract.tenantId),
        );
        const orphanTenantIds = relatedTenantIds.filter(
          (tenantId) => !tenantIdsWithContracts.has(tenantId),
        );
        if (orphanTenantIds.length > 0) {
          await manager.delete(Tenant, { id: In(orphanTenantIds) });
        }
      }
    });
  }

  async findTenantsByProperty(id: string): Promise<Tenant[]> {
    await this.findOne(id);

    const contracts = await this.contractRepository.find({
      where: {
        department: {
          propertyId: id,
        },
      },
      relations: ['tenant'],
    });

    const tenants = contracts
      .map((contract) => contract.tenant)
      .filter(Boolean); // filter out nulls if any
    const uniqueTenants = [
      ...new Map(tenants.map((item) => [item.id, item])).values(),
    ];

    return uniqueTenants;
  }

  async findDepartmentsByProperty(id: string): Promise<Department[]> {
    await this.findOne(id);

    return this.departmentRepository.find({
      where: { propertyId: id },
    });
  }
}

import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContractTermination } from './entities/contract-termination.entity';
import { Contract, ContractStatus } from '../contract/entities/contract.entity';
import { Department } from '../department/entities/department.entity';
import { CreateContractTerminationDto } from './dto/create-contract-termination.dto';

export interface TerminationResult {
  id: string;
  contractId: string;
  tenantName: string;
  departmentName: string;
  expectedDepartureDate: Date;
  actualDepartureDate: Date;
  apartmentCondition: string | null;
  advanceApplied: number;
  guaranteeDeposit: number;
  guaranteeDeduction: number;
  servicesCost: number;
  guaranteeReturn: number;
  rentRefund: number;
  createdAt: Date;
}

@Injectable()
export class ContractTerminationService {
  constructor(
    @InjectRepository(ContractTermination)
    private readonly terminationRepository: Repository<ContractTermination>,
    @InjectRepository(Contract)
    private readonly contractRepository: Repository<Contract>,
    @InjectRepository(Department)
    private readonly departmentRepository: Repository<Department>,
  ) {}

  async terminate(
    contractId: string,
    dto: CreateContractTerminationDto,
  ): Promise<TerminationResult> {
    const contract = await this.contractRepository.findOne({
      where: { id: contractId },
      relations: ['tenant', 'department', 'department.property'],
    });

    if (!contract) {
      throw new NotFoundException(`Contract with ID "${contractId}" not found`);
    }

    if (contract.status === ContractStatus.TERMINATED) {
      throw new ConflictException(
        `Contract with ID "${contractId}" is already terminated`,
      );
    }

    const advanceApplied = Number(contract.advancePayment);
    const guaranteeDeposit = Number(contract.guaranteeDeposit);
    const guaranteeDeduction = Number(dto.guaranteeDeduction) || 0;
    const servicesCost = Number(dto.servicesCost) || 0;

    const rentRefundRaw =
      dto.proratedRentAmount != null
        ? Math.max(0, Number(contract.rentAmount) - dto.proratedRentAmount)
        : 0;

    // Services are absorbed by the rent refund first, then the remainder hits the guarantee
    const servicesFromGuarantee = Math.max(0, servicesCost - rentRefundRaw);
    const rentRefund = Math.max(0, rentRefundRaw - servicesCost);
    const guaranteeReturn = Math.max(0, guaranteeDeposit - guaranteeDeduction - servicesFromGuarantee);

    const termination = this.terminationRepository.create({
      contractId,
      expectedDepartureDate: contract.endDate,
      actualDepartureDate: new Date(dto.actualDepartureDate),
      apartmentCondition: dto.apartmentCondition ?? null,
      advanceApplied,
      guaranteeDeposit,
      guaranteeDeduction,
      servicesCost,
      guaranteeReturn,
      rentRefund,
    });

    const saved = await this.terminationRepository.save(termination);

    contract.status = ContractStatus.TERMINATED;
    await this.contractRepository.save(contract);

    await this.departmentRepository.update(contract.departmentId, {
      isAvailable: true,
    });

    return this.toResult(saved, contract);
  }

  async findByContract(contractId: string): Promise<TerminationResult | null> {
    const termination = await this.terminationRepository.findOne({
      where: { contractId },
      relations: ['contract', 'contract.tenant', 'contract.department'],
    });

    if (!termination) return null;

    return this.toResult(termination, termination.contract);
  }

  private toResult(
    termination: ContractTermination,
    contract: Contract,
  ): TerminationResult {
    return {
      id: termination.id,
      contractId: termination.contractId,
      tenantName: contract.tenant.name,
      departmentName: contract.department.name,
      expectedDepartureDate: termination.expectedDepartureDate,
      actualDepartureDate: termination.actualDepartureDate,
      apartmentCondition: termination.apartmentCondition,
      advanceApplied: Number(termination.advanceApplied),
      guaranteeDeposit: Number(termination.guaranteeDeposit),
      guaranteeDeduction: Number(termination.guaranteeDeduction),
      servicesCost: Number(termination.servicesCost),
      guaranteeReturn: Number(termination.guaranteeReturn),
      rentRefund: Number(termination.rentRefund),
      createdAt: termination.createdAt,
    };
  }
}

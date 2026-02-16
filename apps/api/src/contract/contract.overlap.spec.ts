import { Test, TestingModule } from '@nestjs/testing';
import { ContractService } from './contract.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Contract } from './entities/contract.entity';
import { Tenant } from '../tenant/entities/tenant.entity';
import { Department } from '../department/entities/department.entity';
import { BadRequestException } from '@nestjs/common';

describe('ContractService Availability Check', () => {
  let service: ContractService;

  const mockContractRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
    // createQueryBuilder removed as it is no longer used for this check
  };

  const mockTenantRepository = {
    findOne: jest.fn(),
  };

  const mockDepartmentRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContractService,
        {
          provide: getRepositoryToken(Contract),
          useValue: mockContractRepository,
        },
        {
          provide: getRepositoryToken(Tenant),
          useValue: mockTenantRepository,
        },
        {
          provide: getRepositoryToken(Department),
          useValue: mockDepartmentRepository,
        },
      ],
    }).compile();

    service = module.get<ContractService>(ContractService);
  });

  describe('create', () => {
    it('should throw BadRequestException if department is not available', async () => {
      const createDto = {
        tenantId: 1,
        departmentId: 1,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        rentAmount: 1000,
        advancePayment: 1000,
        guaranteeDeposit: 1000,
      };

      mockTenantRepository.findOne.mockResolvedValue({ id: 1 });
      // Department exists but isAvailable = false
      mockDepartmentRepository.findOne.mockResolvedValue({
        id: 1,
        name: 'Dept 101',
        isAvailable: false,
      });

      await expect(service.create(createDto)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockDepartmentRepository.save).not.toHaveBeenCalled();
      expect(mockContractRepository.save).not.toHaveBeenCalled();
    });

    it('should create contract and mark department as unavailable if available', async () => {
      const createDto = {
        tenantId: 1,
        departmentId: 1,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        rentAmount: 1000,
        advancePayment: 1000,
        guaranteeDeposit: 1000,
      };

      mockTenantRepository.findOne.mockResolvedValue({ id: 1 });
      // Department exists and isAvailable = true
      const mockDepartment = { id: 1, name: 'Dept 101', isAvailable: true };
      mockDepartmentRepository.findOne.mockResolvedValue(mockDepartment);

      mockContractRepository.create.mockReturnValue(createDto);
      mockContractRepository.save.mockResolvedValue({ id: 1, ...createDto });

      const result = await service.create(createDto);

      expect(result).toBeDefined();
      // Check that department was saved with isAvailable = false
      expect(mockDepartment.isAvailable).toBe(false);
      expect(mockDepartmentRepository.save).toHaveBeenCalledWith(
        mockDepartment,
      );
      expect(mockContractRepository.save).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should remove contract and mark department as available', async () => {
      const mockDepartment = { id: 1, name: 'Dept 101', isAvailable: false };
      const mockContract = { id: 1, department: mockDepartment };

      mockContractRepository.findOne.mockResolvedValue(mockContract);

      await service.remove(1);

      expect(mockDepartment.isAvailable).toBe(true);
      expect(mockDepartmentRepository.save).toHaveBeenCalledWith(
        mockDepartment,
      );
      expect(mockContractRepository.remove).toHaveBeenCalledWith(mockContract);
    });
  });
});

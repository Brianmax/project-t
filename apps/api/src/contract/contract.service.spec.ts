import { Test, TestingModule } from '@nestjs/testing';
import { ContractService } from './contract.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Contract } from './entities/contract.entity';
import { Tenant } from '../tenant/entities/tenant.entity';
import { Department } from '../department/entities/department.entity';

describe('ContractService', () => {
  let service: ContractService;

  const mockContractRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
  };

  const mockTenantRepository = {
    findOne: jest.fn(),
  };

  const mockDepartmentRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const mockContract = {
    id: 'c1',
    tenantId: 't1',
    rentAmount: '1500',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    department: {
      id: 'd1',
      name: 'Depto 101',
      property: {
        id: 'p1',
        name: 'Edificio Central',
        address: 'Av. Lima 123',
      },
    },
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

  describe('findAll', () => {
    it('should call find with department.property relation when no args provided', async () => {
      mockContractRepository.find.mockResolvedValue([mockContract]);

      await service.findAll();

      expect(mockContractRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          relations: expect.arrayContaining(['department.property']),
        }),
      );
    });

    it('should call find with where: { tenantId } and department.property relation when tenantId provided', async () => {
      mockContractRepository.find.mockResolvedValue([mockContract]);

      await service.findAll('t1');

      expect(mockContractRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: 't1' },
          relations: expect.arrayContaining(['department.property']),
        }),
      );
    });

    it('should call find with where: { departmentId } when departmentId provided', async () => {
      mockContractRepository.find.mockResolvedValue([mockContract]);

      await service.findAll(undefined, 'd1');

      expect(mockContractRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { departmentId: 'd1' },
        }),
      );
    });

    it('should return contracts with nested department.property.name', async () => {
      mockContractRepository.find.mockResolvedValue([mockContract]);

      const result = await service.findAll('t1');

      expect(result[0].department.property.name).toEqual('Edificio Central');
    });
  });
});

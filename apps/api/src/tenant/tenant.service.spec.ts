import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { Tenant } from './entities/tenant.entity';

describe('TenantService', () => {
  let service: TenantService;

  const mockTenantRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    merge: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantService,
        {
          provide: getRepositoryToken(Tenant),
          useValue: mockTenantRepository,
        },
      ],
    }).compile();

    service = module.get<TenantService>(TenantService);
    jest.clearAllMocks();
  });

  describe('findOne', () => {
    it('should return a tenant including documentId when found', async () => {
      const tenantId = 'test-uuid-1234';
      const mockTenant: Tenant = {
        id: tenantId,
        name: 'Juan Perez',
        email: 'juan@example.com',
        phone: '987654321',
        documentId: 'DNI-123',
      };

      mockTenantRepository.findOne.mockResolvedValue(mockTenant);

      const result = await service.findOne(tenantId);

      expect(result).toEqual(mockTenant);
      expect(result.documentId).toBe('DNI-123');
      expect(mockTenantRepository.findOne).toHaveBeenCalledWith({
        where: { id: tenantId },
      });
    });

    it('should return a tenant with null email when email is not set', async () => {
      const tenantId = 'test-uuid-5678';
      const mockTenant: Tenant = {
        id: tenantId,
        name: 'Maria Lopez',
        email: null,
        phone: '987654321',
        documentId: 'DNI-456',
      };

      mockTenantRepository.findOne.mockResolvedValue(mockTenant);

      const result = await service.findOne(tenantId);

      expect(result).toEqual(mockTenant);
      expect(result.email).toBeNull();
      expect(result.phone).toBe('987654321');
      expect(result.documentId).toBe('DNI-456');
    });

    it('should throw NotFoundException when tenant does not exist', async () => {
      mockTenantRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});

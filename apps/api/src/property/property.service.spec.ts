import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken, getDataSourceToken } from '@nestjs/typeorm';
import { PropertyService } from './property.service';
import { Property } from './entities/property.entity';
import { Contract } from '../contract/entities/contract.entity';
import { Department } from '../department/entities/department.entity';

describe('PropertyService', () => {
  let service: PropertyService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PropertyService,
        { provide: getDataSourceToken(), useValue: {} },
        { provide: getRepositoryToken(Property), useValue: {} },
        { provide: getRepositoryToken(Contract), useValue: {} },
        { provide: getRepositoryToken(Department), useValue: {} },
      ],
    }).compile();

    service = module.get<PropertyService>(PropertyService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

# Testing Patterns

**Analysis Date:** 2026-03-09

## Test Framework

**Runner:**
- Jest 30.x
- Config: inline in `apps/api/package.json` under `"jest"` key
- E2E config: `apps/api/test/jest-e2e.json`

**Assertion Library:**
- Jest built-in (`expect`, matchers)

**Transform:**
- `ts-jest` for TypeScript compilation

**Run Commands:**
```bash
cd apps/api
npm test              # Run all unit tests (*.spec.ts in src/)
npm run test:watch    # Watch mode
npm run test:cov      # With coverage report (output: apps/api/coverage/)
npm run test:e2e      # E2E tests (apps/api/test/*.e2e-spec.ts)
```

**No frontend test framework** is configured — the `apps/client` package has no Jest or Vitest setup.

## Test File Organization

**Location:**
- Unit tests: co-located with source files inside `apps/api/src/`
- E2E tests: separate directory at `apps/api/test/`

**Naming:**
- Unit tests: `[name].spec.ts` (e.g., `contract.overlap.spec.ts`, `property.service.spec.ts`)
- E2E tests: `[name].e2e-spec.ts` (e.g., `app.e2e-spec.ts`)
- Spec file names may differ from module name to describe the scenario tested (e.g., `contract.overlap.spec.ts` tests availability/overlap logic, not the full `ContractService`)

**Jest configuration:**
```json
{
  "rootDir": "src",
  "testRegex": ".*\\.spec\\.ts$",
  "transform": { "^.+\\.(t|j)s$": "ts-jest" },
  "collectCoverageFrom": ["**/*.(t|j)s"],
  "coverageDirectory": "../coverage",
  "testEnvironment": "node"
}
```

## Test Structure

**Suite Organization:**
```typescript
describe('ContractService Availability Check', () => {
  let service: ContractService;

  // Mock repositories defined at module scope
  const mockContractRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContractService,
        { provide: getRepositoryToken(Contract), useValue: mockContractRepository },
        // ... other mocked repositories
      ],
    }).compile();

    service = module.get<ContractService>(ContractService);
  });

  describe('create', () => {
    it('should throw BadRequestException if department is not available', async () => {
      // arrange mocks
      mockTenantRepository.findOne.mockResolvedValue({ id: '1' });
      mockDepartmentRepository.findOne.mockResolvedValue({ id: '1', isAvailable: false });

      // act + assert
      await expect(service.create(createDto)).rejects.toThrow(BadRequestException);
    });
  });
});
```

**Patterns:**
- `beforeEach`: reconstruct the NestJS testing module and call `jest.clearAllMocks()`
- No `afterEach` or `afterAll` teardown observed
- Nested `describe` blocks group by method name (e.g., `describe('create', ...)`, `describe('remove', ...)`)
- Smoke tests (`it('should be defined')`) used in controller/service specs with minimal mock setup

## Mocking

**Framework:** Jest built-in mocks (`jest.fn()`)

**Repository mocking pattern:**
```typescript
const mockContractRepository = {
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  remove: jest.fn(),
};

// Provided via NestJS testing module DI:
{ provide: getRepositoryToken(Contract), useValue: mockContractRepository }
```

**Configuring mock return values per test:**
```typescript
mockTenantRepository.findOne.mockResolvedValue({ id: '1' });
mockDepartmentRepository.findOne.mockResolvedValue({
  id: '1',
  name: 'Dept 101',
  isAvailable: false,
});
mockContractRepository.save.mockResolvedValue({ id: '1', ...createDto });
```

**DataSource mocking** (for services that inject DataSource):
```typescript
{ provide: getDataSourceToken(), useValue: {} }
```

**What to mock:**
- TypeORM repositories (all injected via `getRepositoryToken(Entity)`)
- TypeORM DataSource when injected directly
- External services injected into the module under test

**What NOT to mock:**
- The service/controller under test itself
- NestJS framework internals

## Fixtures and Factories

**Test data:** Inline object literals within each test case — no shared factory functions or fixture files observed.

```typescript
const createDto = {
  tenantId: '1',
  departmentId: '1',
  startDate: '2024-01-01',
  endDate: '2024-12-31',
  rentAmount: 1000,
  advancePayment: 1000,
  guaranteeDeposit: 1000,
};
```

**Location:** No dedicated fixtures directory — data is defined inline per test.

## Coverage

**Requirements:** None enforced (no coverage thresholds in Jest config).

**View Coverage:**
```bash
cd apps/api && npm run test:cov
# Output written to: apps/api/coverage/
```

**collectCoverageFrom:** All `.ts` and `.js` files in `src/` are included in coverage collection, even if untested.

## Test Types

**Unit Tests:**
- Scope: individual NestJS service or controller in isolation
- Approach: NestJS `Test.createTestingModule` with mocked repositories
- Files: `apps/api/src/**/*.spec.ts`

**Integration / Smoke Tests:**
- Some `.spec.ts` files only verify instantiation (`expect(service).toBeDefined()`) using empty `{}` mock values — these are scaffolded stubs rather than real integration tests

**E2E Tests:**
- Framework: `supertest` against a running NestJS app
- Files: `apps/api/test/*.e2e-spec.ts`
- Coverage: Only the root `GET /` endpoint is tested in the default scaffold (`apps/api/test/app.e2e-spec.ts`)
- Module: Uses the real `AppModule` — requires a live database connection to run successfully

## Common Patterns

**Async testing:**
```typescript
// Expect a promise to reject with a specific exception
await expect(service.create(createDto)).rejects.toThrow(BadRequestException);

// Expect a promise to resolve
const result = await service.create(createDto);
expect(result).toBeDefined();
```

**Side-effect verification:**
```typescript
// Verify that save was NOT called
expect(mockDepartmentRepository.save).not.toHaveBeenCalled();

// Verify save was called with specific object
expect(mockDepartmentRepository.save).toHaveBeenCalledWith(mockDepartment);

// Verify mutation happened on the mock object
expect(mockDepartment.isAvailable).toBe(false);
```

**E2E request pattern:**
```typescript
it('/ (GET)', () => {
  return request(app.getHttpServer())
    .get('/')
    .expect(200)
    .expect('Hello World!');
});
```

## Coverage Gaps

Most domain modules (`receipt`, `consumption`, `meter-reading`, `tenant`, `department`, `auth`, `payment`, `contract-settlement`, `contract-termination`, `extra-charge`) have **no test files**. Only the following have spec coverage:
- `apps/api/src/contract/contract.overlap.spec.ts` — availability check logic
- `apps/api/src/property/property.service.spec.ts` — smoke test only
- `apps/api/src/property/property.controller.spec.ts` — smoke test only
- `apps/api/src/app.controller.spec.ts` — hello world smoke test

The entire frontend (`apps/client`) has **no test infrastructure** configured.

---

*Testing analysis: 2026-03-09*

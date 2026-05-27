import { loadSealConfig } from './seal.config';

describe('loadSealConfig', () => {
  const validEnv = {
    SEAL_BASE_URL: 'https://oficinavirtual.seal.com.pe',
    SEAL_EMAIL: 'test@example.com',
    SEAL_PASSWORD: 'secret123',
  };

  it('loads config from valid env', () => {
    const cfg = loadSealConfig(validEnv);
    expect(cfg.baseUrl).toBe('https://oficinavirtual.seal.com.pe');
    expect(cfg.email).toBe('test@example.com');
    expect(cfg.password).toBe('secret123');
    expect(cfg.sessionTtlMs).toBe(900_000);
    expect(cfg.requestIntervalMs).toBe(500);
  });

  it('applies custom TTL and interval', () => {
    const cfg = loadSealConfig({
      ...validEnv,
      SEAL_SESSION_TTL_MS: '600000',
      SEAL_REQUEST_INTERVAL_MS: '1000',
    });
    expect(cfg.sessionTtlMs).toBe(600_000);
    expect(cfg.requestIntervalMs).toBe(1000);
  });

  it('throws when SEAL_BASE_URL is missing', () => {
    expect(() =>
      loadSealConfig({ SEAL_EMAIL: 'a@b.com', SEAL_PASSWORD: 'x' }),
    ).toThrow(/SEAL_BASE_URL/);
  });

  it('throws when SEAL_EMAIL is missing', () => {
    expect(() =>
      loadSealConfig({
        SEAL_BASE_URL: 'https://seal.com',
        SEAL_PASSWORD: 'x',
      }),
    ).toThrow(/SEAL_EMAIL/);
  });

  it('throws when SEAL_PASSWORD is missing', () => {
    expect(() =>
      loadSealConfig({
        SEAL_BASE_URL: 'https://seal.com',
        SEAL_EMAIL: 'a@b.com',
      }),
    ).toThrow(/SEAL_PASSWORD/);
  });
});

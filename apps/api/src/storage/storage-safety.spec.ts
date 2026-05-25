import { assertProductionEndpointSafety } from './storage-safety';

describe('assertProductionEndpointSafety', () => {
  it('is a no-op when NODE_ENV is not production', () => {
    expect(() =>
      assertProductionEndpointSafety('http://localhost:9000', 'development'),
    ).not.toThrow();
    expect(() =>
      assertProductionEndpointSafety('http://localhost:9000', 'test'),
    ).not.toThrow();
    expect(() =>
      assertProductionEndpointSafety('http://localhost:9000', undefined),
    ).not.toThrow();
  });

  it('is a no-op in production when endpoint is unset (real AWS S3)', () => {
    expect(() =>
      assertProductionEndpointSafety(undefined, 'production'),
    ).not.toThrow();
  });

  it('throws in production when endpoint is localhost', () => {
    expect(() =>
      assertProductionEndpointSafety('http://localhost:9000', 'production'),
    ).toThrow(/Refusing to boot/);
    expect(() =>
      assertProductionEndpointSafety('http://127.0.0.1:9000', 'production'),
    ).toThrow(/Refusing to boot/);
    expect(() =>
      assertProductionEndpointSafety(
        'http://host.docker.internal:9000',
        'production',
      ),
    ).toThrow(/Refusing to boot/);
  });

  it('throws in production when endpoint is a private-IP range', () => {
    expect(() =>
      assertProductionEndpointSafety('http://10.0.0.5:9000', 'production'),
    ).toThrow(/Refusing to boot/);
    expect(() =>
      assertProductionEndpointSafety('http://192.168.1.100:9000', 'production'),
    ).toThrow(/Refusing to boot/);
    expect(() =>
      assertProductionEndpointSafety('http://172.16.0.5:9000', 'production'),
    ).toThrow(/Refusing to boot/);
  });

  it('allows real AWS endpoints in production', () => {
    expect(() =>
      assertProductionEndpointSafety(
        'https://s3.us-east-1.amazonaws.com',
        'production',
      ),
    ).not.toThrow();
  });
});

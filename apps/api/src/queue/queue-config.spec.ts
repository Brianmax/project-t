import { assertQueueConfig } from './queue-config';

describe('assertQueueConfig', () => {
  it('is a no-op when the feature is disabled', () => {
    expect(() => assertQueueConfig(false, undefined)).not.toThrow();
    expect(() => assertQueueConfig(false, 'localhost')).not.toThrow();
  });

  it('is a no-op when feature is enabled and host is set', () => {
    expect(() => assertQueueConfig(true, 'localhost')).not.toThrow();
    expect(() => assertQueueConfig(true, 'redis.internal')).not.toThrow();
  });

  it('throws when feature is enabled but host is unset', () => {
    expect(() => assertQueueConfig(true, undefined)).toThrow(/REDIS_HOST/);
    expect(() => assertQueueConfig(true, '')).toThrow(/REDIS_HOST/);
  });
});

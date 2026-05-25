/**
 * Boot-time guard: when the PDF feature is enabled, Redis must be configured.
 * Throw a clear error at module init rather than failing later when the
 * worker tries to dial Redis.
 */
export function assertQueueConfig(
  featureEnabled: boolean,
  redisHost: string | undefined,
): void {
  if (featureEnabled && !redisHost) {
    throw new Error(
      '[QueueModule] RECEIPT_PDF_ENABLED=true but REDIS_HOST is unset. ' +
        'Set REDIS_HOST (and REDIS_PORT) in .env, or disable the feature.',
    );
  }
}

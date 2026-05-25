/**
 * Production safety: refuse to boot when NODE_ENV=production and the S3 endpoint
 * points at localhost or a private-IP range. Prevents a developer from shipping
 * MinIO config to prod by mistake.
 */
const LOCAL_HOST_MARKERS = ['localhost', '127.0.0.1', 'host.docker.internal'];
const PRIVATE_IP_REGEX =
  /(\b|:\/\/)(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/;

export function assertProductionEndpointSafety(
  endpoint: string | undefined,
  nodeEnv: string | undefined,
): void {
  if (nodeEnv !== 'production' || !endpoint) return;

  const lower = endpoint.toLowerCase();
  const matchesLocal = LOCAL_HOST_MARKERS.some((m) => lower.includes(m));
  const matchesPrivateIp = PRIVATE_IP_REGEX.test(lower);

  if (matchesLocal || matchesPrivateIp) {
    throw new Error(
      `[StorageModule] Refusing to boot in NODE_ENV=production with ` +
        `AWS_S3_ENDPOINT="${endpoint}". Local/private endpoints are dev-only. ` +
        `Unset AWS_S3_ENDPOINT for AWS S3, or correct the endpoint URL.`,
    );
  }
}

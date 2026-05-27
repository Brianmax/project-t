export interface SealConfigValues {
  baseUrl: string;
  email: string;
  password: string;
  sessionTtlMs: number;
  requestIntervalMs: number;
}

export function loadSealConfig(env: {
  SEAL_BASE_URL?: string;
  SEAL_EMAIL?: string;
  SEAL_PASSWORD?: string;
  SEAL_SESSION_TTL_MS?: string;
  SEAL_REQUEST_INTERVAL_MS?: string;
}): SealConfigValues {
  const baseUrl = env.SEAL_BASE_URL;
  const email = env.SEAL_EMAIL;
  const password = env.SEAL_PASSWORD;

  if (!baseUrl || !email || !password) {
    throw new Error(
      '[SealConfig] Missing required env vars. ' +
        'Set SEAL_BASE_URL, SEAL_EMAIL, and SEAL_PASSWORD.',
    );
  }

  return {
    baseUrl,
    email,
    password,
    sessionTtlMs: Number(env.SEAL_SESSION_TTL_MS) || 900_000,
    requestIntervalMs: Number(env.SEAL_REQUEST_INTERVAL_MS) || 500,
  };
}

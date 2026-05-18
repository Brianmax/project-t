const API_BASE = 'http://localhost:3001';

let _accessToken: string | null = null;
let _onRefresh: (() => Promise<string | null>) | null = null;

export function setAccessToken(token: string | null) {
  _accessToken = token;
}

export function setRefreshCallback(cb: () => Promise<string | null>) {
  _onRefresh = cb;
}

export async function apiFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const authHeader = _accessToken
    ? { Authorization: `Bearer ${_accessToken}` }
    : {};

  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
      ...authHeader,
    },
  });

  if (res.status === 401 && _onRefresh) {
    const newToken = await _onRefresh();
    if (newToken) {
      const retryAuth = { Authorization: `Bearer ${newToken}` };
      const retry = await fetch(`${API_BASE}${path}`, {
        credentials: 'include',
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
          ...retryAuth,
        },
      });
      if (!retry.ok) {
        const body = await retry.text();
        throw new Error(body || `Error ${retry.status}: ${retry.statusText}`);
      }
      if (retry.status === 204) return undefined as T;
      return retry.json() as Promise<T>;
    }
    throw new Error('Session expired');
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || `Error ${res.status}: ${res.statusText}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export function apiPost<T>(path: string, body: unknown): Promise<T> {
  return apiFetch<T>(path, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function apiPatch<T>(path: string, body: unknown): Promise<T> {
  return apiFetch<T>(path, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function apiDelete(path: string): Promise<void> {
  return apiFetch<void>(path, { method: 'DELETE' });
}

const API_BASE = 'http://localhost:3001';

let _accessToken: string | null = null;
let _onRefresh: (() => Promise<string | null>) | null = null;

export function setAccessToken(token: string | null) {
  _accessToken = token;
}

export function getAccessToken(): string | null {
  return _accessToken;
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

const API_BASE_URL = API_BASE;

export async function getPaymentReport(
  contractId: string,
  query?: { from?: string; to?: string; method?: string },
): Promise<import('../types/payment-report').PaymentReportData> {
  const params = new URLSearchParams();
  if (query?.from) params.set('from', query.from);
  if (query?.to) params.set('to', query.to);
  if (query?.method) params.set('method', query.method);
  const qs = params.toString();
  const path = `/contracts/${contractId}/payments/report${qs ? `?${qs}` : ''}`;
  return apiFetch<import('../types/payment-report').PaymentReportData>(path);
}

export async function downloadPaymentReportPdf(
  contractId: string,
  query?: { from?: string; to?: string; method?: string },
): Promise<void> {
  const params = new URLSearchParams();
  if (query?.from) params.set('from', query.from);
  if (query?.to) params.set('to', query.to);
  if (query?.method) params.set('method', query.method);
  const qs = params.toString();
  const url = `${API_BASE_URL}/contracts/${contractId}/payments/report/pdf${qs ? `?${qs}` : ''}`;

  const res = await fetch(url, {
    credentials: 'include',
    headers: {
      Authorization: _accessToken ? `Bearer ${_accessToken}` : '',
    } as Record<string, string>,
  });

  if (res.status === 401 && _onRefresh) {
    const newToken = await _onRefresh();
    if (newToken) {
      const retry = await fetch(url, {
        credentials: 'include',
        headers: {
          Authorization: `Bearer ${newToken}`,
        },
      });
      if (!retry.ok) {
        const body = await retry.text();
        throw new Error(body || `Error ${retry.status}`);
      }
      const blob = await retry.blob();
      triggerDownload(blob, retry.headers);
      return;
    }
    throw new Error('Session expired');
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || `Error ${res.status}`);
  }

  const blob = await res.blob();
  triggerDownload(blob, res.headers);
}

function triggerDownload(blob: Blob, headers: Headers) {
  const disposition = headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename="?([^"]+)"?/);
  const filename = match ? match[1] : 'reporte-pagos.pdf';
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(objectUrl);
}

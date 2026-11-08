/**
 * Authenticated fetch wrapper for CENTENARYO API calls.
 * Automatically attaches the JWT Bearer token from sessionStorage.
 */
export const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api').replace(/\/+$/, '');

export function resolveMediaUrl(path?: string | null): string {
  if (!path) return '';
  if (
    path.startsWith('http://') ||
    path.startsWith('https://') ||
    path.startsWith('blob:') ||
    path.startsWith('data:')
  ) {
    return path;
  }
  const host = API_BASE.replace(/\/api\/?$/, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${host}${cleanPath}`;
}

export async function safeParseResponse<T = any>(
  res: Response
): Promise<{ ok: boolean; data: T | null; errorMessage: string }> {
  const contentType = res.headers.get('content-type') || '';
  let data: any = null;
  let rawText = '';

  if (contentType.includes('application/json')) {
    try {
      data = await res.json();
    } catch {
      data = null;
    }
  }

  if (data === null) {
    try {
      rawText = await res.text();
    } catch {
      rawText = '';
    }
  }

  let errorMessage = '';
  if (!res.ok) {
    if (data && typeof data === 'object') {
      if (typeof data.detail === 'string') {
        errorMessage = data.detail;
      } else if (typeof data.error === 'string') {
        errorMessage = data.error;
      } else if (typeof data.message === 'string') {
        errorMessage = data.message;
      } else {
        errorMessage = Object.entries(data)
          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
          .join('\n');
      }
    } else if (rawText) {
      if (rawText.includes('<!DOCTYPE') || rawText.includes('<html')) {
        errorMessage = `Server Error (${res.status}: ${res.statusText || 'Internal Server Error'})`;
      } else {
        errorMessage = rawText.slice(0, 300);
      }
    } else {
      errorMessage = `Request failed with status ${res.status}`;
    }
  }

  return { ok: res.ok, data, errorMessage };
}

export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = typeof window !== 'undefined' ? sessionStorage.getItem('centenaryo_access_token') : null;

  const headers: Record<string, string> = {
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Only set Content-Type for non-GET requests that have a body
  if (options.body && !headers['Content-Type'] && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  return fetch(url, {
    ...options,
    headers,
  });
}

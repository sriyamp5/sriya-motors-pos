/**
 * Thin wrapper around fetch for the local API.
 *
 * - attaches the session token
 * - converts error responses into ApiError with a user friendly message and
 *   per-field validation errors
 * - broadcasts session expiry and database outages so the app shell can react
 */

const TOKEN_KEY = 'sm-token';
const REQUEST_TIMEOUT_MS = 30000;

export const AUTH_EXPIRED_EVENT = 'sm:auth-expired';
export const DB_UNAVAILABLE_EVENT = 'sm:db-unavailable';

export class ApiError extends Error {
  constructor(message, { status = 0, code = 'UNKNOWN', fields = null, details = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fields = fields;
    this.details = details;
  }
}

export const tokenStore = {
  get: () => sessionStorage.getItem(TOKEN_KEY),
  set: (token) => sessionStorage.setItem(TOKEN_KEY, token),
  clear: () => sessionStorage.removeItem(TOKEN_KEY),
};

function buildUrl(path, params) {
  const url = new URL(`/api${path}`, window.location.origin);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value);
    }
  }
  return url;
}

async function request(method, path, { body, params, signal } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  signal?.addEventListener('abort', () => controller.abort());

  const token = tokenStore.get();
  let response;
  try {
    response = await fetch(buildUrl(path, params), {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    const timedOut = error.name === 'AbortError';
    throw new ApiError(
      timedOut
        ? 'The request took too long. Please try again.'
        : 'Cannot reach the POS service. Please wait a moment and try again.',
      { code: timedOut ? 'TIMEOUT' : 'NETWORK' },
    );
  } finally {
    clearTimeout(timeout);
  }

  if (response.status === 204) return null;

  let payload;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const error = payload?.error ?? {};
    const apiError = new ApiError(error.message || `Request failed (${response.status})`, {
      status: response.status,
      code: error.code,
      fields: error.details?.fields ?? null,
      details: error.details ?? null,
    });
    if (response.status === 401 && token)
      window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT, { detail: apiError.message }));
    if (error.code === 'DB_UNAVAILABLE') window.dispatchEvent(new CustomEvent(DB_UNAVAILABLE_EVENT));
    throw apiError;
  }
  return payload;
}

export const api = {
  get: (path, params, options) => request('GET', path, { params, ...options }),
  post: (path, body) => request('POST', path, { body: body ?? {} }),
  put: (path, body) => request('PUT', path, { body }),
  patch: (path, body) => request('PATCH', path, { body }),
  delete: (path) => request('DELETE', path),
};

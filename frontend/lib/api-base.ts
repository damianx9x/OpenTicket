export type ApiMeta = Record<string, unknown>;

export const API_BASE_OVERRIDE_KEY = 'ts_api_base_url';

export interface ApiEnvelope<T> {
  data: T;
  meta?: ApiMeta;
  error?: unknown;
  success?: boolean;
}

export class ApiRequestError extends Error {
  readonly status: number;
  readonly payload: unknown;

  constructor(status: number, message: string, payload: unknown) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.payload = payload;
  }
}

function isAbsoluteUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

export function normalizeApiBaseUrl(value: string): string {
  const normalized = value.trim();
  if (!normalized) {
    return '';
  }

  const parsed = new URL(normalized);
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('API base must use http:// or https://');
  }

  parsed.pathname = '';
  parsed.search = '';
  parsed.hash = '';
  return parsed.toString().replace(/\/+$/, '');
}

export function getApiBaseOverride(): string | null {
  return safeLocalStorageGet(API_BASE_OVERRIDE_KEY);
}

export function setApiBaseOverride(value: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const normalized = normalizeApiBaseUrl(value);
    if (!normalized) {
      safeLocalStorageRemove(API_BASE_OVERRIDE_KEY);
      return;
    }
    window.localStorage.setItem(API_BASE_OVERRIDE_KEY, normalized);
  } catch {
    safeLocalStorageRemove(API_BASE_OVERRIDE_KEY);
  }
}

export function clearApiBaseOverride(): void {
  safeLocalStorageRemove(API_BASE_OVERRIDE_KEY);
}

export function getApiBase(): string {
  const override = getApiBaseOverride();
  if (override) {
    return override.replace(/\/+$/, '');
  }

  const explicitApiBase = process.env.NEXT_PUBLIC_API_URL;
  if (explicitApiBase) {
    return explicitApiBase.replace(/\/+$/, '');
  }

  if (typeof window === 'undefined') {
    return 'http://127.0.0.1:3000';
  }

  return window.location.origin;
}

export function buildApiUrl(pathname: string): string {
  if (isAbsoluteUrl(pathname)) {
    return pathname;
  }
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `${getApiBase()}${normalizedPath}`;
}

function safeLocalStorageGet(key: string): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeLocalStorageRemove(key: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore storage access errors
  }
}

function getApiTimeoutMs(): number {
  const raw = process.env.NEXT_PUBLIC_API_TIMEOUT_MS;
  const parsed = raw ? Number(raw) : NaN;
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }

  return 12000;
}

async function parseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function toEnvelope<T>(payload: unknown): ApiEnvelope<T> {
  if (payload && typeof payload === 'object' && !Array.isArray(payload) && 'data' in payload) {
    const obj = payload as Record<string, unknown>;
    return {
      data: obj.data as T,
      meta: (obj.meta as ApiMeta | undefined) ?? undefined,
      error: obj.error,
      success: typeof obj.success === 'boolean' ? obj.success : undefined,
    };
  }

  return { data: payload as T };
}

function pickErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object') {
    return fallback;
  }

  const obj = payload as Record<string, unknown>;

  if (typeof obj.message === 'string' && obj.message.trim().length > 0) {
    return obj.message;
  }

  if (Array.isArray(obj.message)) {
    return obj.message.join(', ');
  }

  if (typeof obj.error === 'string' && obj.error.trim().length > 0) {
    return obj.error;
  }

  if (obj.data && typeof obj.data === 'object') {
    const nested = obj.data as Record<string, unknown>;
    if (typeof nested.message === 'string' && nested.message.trim().length > 0) {
      return nested.message;
    }
  }

  return fallback;
}

export async function requestEnvelope<T>(pathname: string, init?: RequestInit): Promise<ApiEnvelope<T>> {
  const headers = new Headers(init?.headers ?? undefined);
  const localToken = safeLocalStorageGet('ts_auth_token');

  if (localToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${localToken}`);
  }

  if (init?.body && !headers.has('Content-Type') && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  const timeoutMs = getApiTimeoutMs();
  const canUseAbortController = typeof AbortController !== 'undefined' && !init?.signal;
  const controller = canUseAbortController ? new AbortController() : null;
  const timeoutId = controller
    ? globalThis.setTimeout(() => {
        controller.abort();
      }, timeoutMs)
    : null;

  try {
    const response = await fetch(buildApiUrl(pathname), {
      ...init,
      headers,
      cache: init?.cache ?? 'no-store',
      signal: init?.signal ?? controller?.signal,
    });

    const payload = await parseBody(response);

    if (!response.ok) {
      if (response.status === 401 && typeof window !== 'undefined') {
        safeLocalStorageRemove('ts_auth_token');
        safeLocalStorageRemove('ts_auth_user');
      }
      const message = pickErrorMessage(payload, `Request failed with status ${response.status}`);
      throw new ApiRequestError(response.status, message, payload);
    }

    return toEnvelope<T>(payload);
  } catch (error) {
    if (typeof DOMException !== 'undefined' && error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiRequestError(408, `Request timeout after ${timeoutMs}ms`, {
        message: 'Request timeout',
        timeoutMs,
      });
    }

    throw error;
  } finally {
    if (timeoutId !== null) {
      globalThis.clearTimeout(timeoutId);
    }
  }
}

export async function requestData<T>(pathname: string, init?: RequestInit): Promise<T> {
  const envelope = await requestEnvelope<T>(pathname, init);
  return envelope.data;
}

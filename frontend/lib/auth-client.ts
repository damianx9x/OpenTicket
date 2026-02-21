import { requestData } from '@/lib/api-base';

const TOKEN_KEY = 'ts_auth_token';
const USER_KEY = 'ts_auth_user';

function safeGetLocalStorageItem(key: string): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetLocalStorageItem(key: string, value: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(key, value);
  } catch {
    // ignore storage errors (for example restricted Safari privacy mode)
  }
}

function safeRemoveLocalStorageItem(key: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore storage errors
  }
}

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  phone: string | null;
}

export interface LoginResult {
  token: string;
  expiresAt: string;
  user: AuthUser;
}

export function getStoredToken(): string | null {
  return safeGetLocalStorageItem(TOKEN_KEY);
}

export function getStoredUser(): AuthUser | null {
  const raw = safeGetLocalStorageItem(USER_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function storeSession(session: LoginResult): void {
  safeSetLocalStorageItem(TOKEN_KEY, session.token);
  safeSetLocalStorageItem(USER_KEY, JSON.stringify(session.user));
}

export function clearSession(): void {
  safeRemoveLocalStorageItem(TOKEN_KEY);
  safeRemoveLocalStorageItem(USER_KEY);
}

export async function login(email: string, password: string): Promise<LoginResult> {
  const data = await requestData<LoginResult>('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  storeSession(data);
  return data;
}

export async function logout(): Promise<void> {
  try {
    await requestData('/api/v1/auth/logout', { method: 'POST' });
  } catch {
    // ignore remote logout errors
  } finally {
    clearSession();
  }
}

export async function getMe(): Promise<AuthUser> {
  const data = await requestData<AuthUser>('/api/v1/auth/me');
  safeSetLocalStorageItem(USER_KEY, JSON.stringify(data));
  return data;
}

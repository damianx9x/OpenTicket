import { requestData } from '@/lib/api-base';

export interface AppUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  phone?: string | null;
  disabledAt?: string | null;
  uiPreferences?: Record<string, unknown>;
}

export interface UserNote {
  id: string;
  body: string;
  isInternal: boolean;
  createdAt: string;
  authorUser?: {
    id: string;
    name?: string | null;
    email?: string;
    role?: string;
  } | null;
}

export async function listUsers(includeDisabled = false): Promise<AppUser[]> {
  const suffix = includeDisabled ? '?includeDisabled=1' : '';
  return requestData<AppUser[]>(`/api/v1/users${suffix}`);
}

export async function createUser(payload: {
  email: string;
  name?: string;
  role?: string;
  phone?: string;
  password?: string;
}): Promise<AppUser> {
  return requestData<AppUser>('/api/v1/users', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateUser(
  userId: string,
  payload: {
    email?: string;
    name?: string | null;
    role?: string;
    phone?: string | null;
    password?: string;
    disabled?: boolean;
  },
): Promise<AppUser> {
  return requestData<AppUser>(`/api/v1/users/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function listUserNotes(userId: string): Promise<UserNote[]> {
  return requestData<UserNote[]>(`/api/v1/users/${userId}/notes`);
}

export async function addUserNote(
  userId: string,
  payload: { body: string; isInternal?: boolean },
): Promise<UserNote> {
  return requestData<UserNote>(`/api/v1/users/${userId}/notes`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getMyPreferences(): Promise<Record<string, unknown>> {
  return requestData<Record<string, unknown>>('/api/v1/users/me/preferences');
}

export async function saveMyPreferences(preferences: Record<string, unknown>): Promise<{
  userId: string;
  uiPreferences: Record<string, unknown>;
}> {
  return requestData('/api/v1/users/me/preferences', {
    method: 'PATCH',
    body: JSON.stringify({ preferences }),
  });
}

export async function registerTechnician(payload: {
  signupCode: string;
  email: string;
  name?: string;
  phone?: string;
  password: string;
}): Promise<AppUser> {
  return requestData<AppUser>('/api/v1/users/register-technician', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function setTechnicianSignupCode(payload: {
  code: string;
  enabled: boolean;
}): Promise<{ success: boolean }> {
  return requestData('/api/v1/users/technician-signup-code', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

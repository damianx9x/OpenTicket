export type AuthRole = 'ADMIN' | 'AGENT' | 'REPORTER' | 'VIEWER';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  phone: string | null;
}

export interface AuthSessionResult {
  token: string;
  expiresAt: Date;
  user: AuthenticatedUser;
}

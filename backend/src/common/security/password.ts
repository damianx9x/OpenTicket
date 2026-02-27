import * as crypto from 'crypto';

// OWASP Password Storage Cheat Sheet (2026): PBKDF2 is acceptable fallback when Argon2id isn't available.
// We use a stronger baseline for sha512 and auto-upgrade hashes on successful login.
const PBKDF2_ITERATIONS = 210_000;
const PBKDF2_KEY_LENGTH = 64;
const PBKDF2_DIGEST = 'sha512';

export function hashPassword(password: string): string {
  const normalized = password.trim();
  if (normalized.length < 8) {
    throw new Error('Password must have at least 8 characters');
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto
    .pbkdf2Sync(normalized, salt, PBKDF2_ITERATIONS, PBKDF2_KEY_LENGTH, PBKDF2_DIGEST)
    .toString('hex');

  return `pbkdf2$${PBKDF2_ITERATIONS}$${salt}$${hash}`;
}

export function verifyPassword(password: string, encodedHash: string): boolean {
  const parts = encodedHash.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') {
    return false;
  }

  const iterations = Number(parts[1]);
  const salt = parts[2];
  const expected = parts[3];

  if (!Number.isFinite(iterations) || iterations <= 0 || !salt || !expected) {
    return false;
  }

  const actual = crypto
    .pbkdf2Sync(password.trim(), salt, iterations, PBKDF2_KEY_LENGTH, PBKDF2_DIGEST)
    .toString('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

export function needsPasswordRehash(encodedHash: string): boolean {
  const parts = encodedHash.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') {
    return true;
  }
  const iterations = Number(parts[1]);
  if (!Number.isFinite(iterations) || iterations <= 0) {
    return true;
  }
  return iterations < PBKDF2_ITERATIONS;
}

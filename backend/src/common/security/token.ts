import * as crypto from 'crypto';

export function generateAccessToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function hashAccessToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

import * as crypto from 'crypto';
import * as fs from 'fs';
import { pipeline } from 'stream/promises';

const MAGIC = Buffer.from('OTBK1');
const SALT_BYTES = 16;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const HEADER_BYTES = MAGIC.length + SALT_BYTES + IV_BYTES;
const MIN_KEY_LENGTH = 16;

function deriveKey(passphrase: string, salt: Buffer): Buffer {
  return crypto.scryptSync(passphrase, salt, 32);
}

export function normalizeBackupEncryptionKey(rawKey?: string): string {
  const normalized = (rawKey || '').trim();
  if (normalized.length < MIN_KEY_LENGTH) {
    throw new Error(`Klucz szyfrowania backupu musi mieć co najmniej ${MIN_KEY_LENGTH} znaków.`);
  }
  return normalized;
}

export function generateBackupEncryptionKey(): string {
  const raw = crypto.randomBytes(20).toString('hex').toUpperCase();
  const groups = raw.match(/.{1,5}/g) || [raw];
  return `OTK-${groups.join('-')}`;
}

export function buildBackupKeyHint(encryptionKey: string): string {
  const normalized = normalizeBackupEncryptionKey(encryptionKey);
  return `••••••••-${normalized.slice(-6)}`;
}

export function isEncryptedBackupFile(filePath: string): boolean {
  if (!fs.existsSync(filePath)) {
    return false;
  }
  const stat = fs.statSync(filePath);
  if (!stat.isFile() || stat.size < HEADER_BYTES + TAG_BYTES + 1) {
    return false;
  }
  const fd = fs.openSync(filePath, 'r');
  try {
    const header = Buffer.alloc(MAGIC.length);
    fs.readSync(fd, header, 0, MAGIC.length, 0);
    return header.equals(MAGIC);
  } finally {
    fs.closeSync(fd);
  }
}

export async function encryptArchiveToBackupFile(params: {
  inputArchivePath: string;
  outputBackupPath: string;
  encryptionKey: string;
}): Promise<void> {
  const { inputArchivePath, outputBackupPath } = params;
  const encryptionKey = normalizeBackupEncryptionKey(params.encryptionKey);
  const salt = crypto.randomBytes(SALT_BYTES);
  const iv = crypto.randomBytes(IV_BYTES);
  const key = deriveKey(encryptionKey, salt);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  fs.writeFileSync(outputBackupPath, Buffer.concat([MAGIC, salt, iv]), { mode: 0o600 });

  try {
    await pipeline(
      fs.createReadStream(inputArchivePath),
      cipher,
      fs.createWriteStream(outputBackupPath, { flags: 'a', mode: 0o600 }),
    );
    fs.appendFileSync(outputBackupPath, cipher.getAuthTag());
  } catch (error) {
    fs.rmSync(outputBackupPath, { force: true });
    throw error;
  }
}

export async function decryptBackupFileToArchive(params: {
  inputBackupPath: string;
  outputArchivePath: string;
  encryptionKey: string;
}): Promise<void> {
  const { inputBackupPath, outputArchivePath } = params;
  const encryptionKey = normalizeBackupEncryptionKey(params.encryptionKey);
  const stat = fs.statSync(inputBackupPath);
  const minSize = HEADER_BYTES + TAG_BYTES + 1;

  if (stat.size < minSize) {
    throw new Error('Plik backupu jest uszkodzony lub niekompletny.');
  }

  const fd = fs.openSync(inputBackupPath, 'r');
  let salt: Buffer;
  let iv: Buffer;
  let authTag: Buffer;

  try {
    const header = Buffer.alloc(HEADER_BYTES);
    fs.readSync(fd, header, 0, HEADER_BYTES, 0);
    if (!header.subarray(0, MAGIC.length).equals(MAGIC)) {
      throw new Error('Plik backupu nie jest zaszyfrowanym archiwum OpenTicket (.otbackup).');
    }

    salt = header.subarray(MAGIC.length, MAGIC.length + SALT_BYTES);
    iv = header.subarray(MAGIC.length + SALT_BYTES, HEADER_BYTES);

    authTag = Buffer.alloc(TAG_BYTES);
    fs.readSync(fd, authTag, 0, TAG_BYTES, stat.size - TAG_BYTES);
  } finally {
    fs.closeSync(fd);
  }

  const key = deriveKey(encryptionKey, salt);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  try {
    await pipeline(
      fs.createReadStream(inputBackupPath, {
        start: HEADER_BYTES,
        end: stat.size - TAG_BYTES - 1,
      }),
      decipher,
      fs.createWriteStream(outputArchivePath, { mode: 0o600 }),
    );
  } catch (error: any) {
    fs.rmSync(outputArchivePath, { force: true });
    const reason = String(error?.message || '').toLowerCase();
    if (
      reason.includes('unable to authenticate') ||
      reason.includes('unsupported state') ||
      reason.includes('auth tag')
    ) {
      throw new Error('Nieprawidłowy klucz szyfrowania backupu lub uszkodzony plik backupu.');
    }
    throw error;
  }
}

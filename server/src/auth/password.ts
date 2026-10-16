import crypto from 'node:crypto';

const N = 16384, R = 8, P = 1, LEN = 64;

function scrypt(password: string, salt: Buffer) {
  return new Promise<Buffer>((resolve, reject) =>
    crypto.scrypt(password, salt, LEN, { N, r: R, p: P, maxmem: 64 * 1024 * 1024 }, (err, key) => (err ? reject(err) : resolve(key))));
}

export async function hashPassword(password: string) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt);
  return `scrypt$${N}$${salt.toString('base64')}$${key.toString('base64')}`;
}

export const sha256 = (s: string) => crypto.createHash('sha256').update(s, 'utf8').digest('hex');

/** Aceita o formato atual (scrypt) e o da versão em planilha (sha256$salt$hex). */
export async function verifyPassword(password: string, stored: string): Promise<{ ok: boolean; legacy: boolean }> {
  const parts = String(stored || '').split('$');
  if (parts[0] === 'scrypt' && parts.length === 4) {
    const key = await scrypt(password, Buffer.from(parts[2], 'base64'));
    const expected = Buffer.from(parts[3], 'base64');
    return { ok: key.length === expected.length && crypto.timingSafeEqual(key, expected), legacy: false };
  }
  if (parts[0] === 'sha256' && parts.length === 3) {
    const a = Buffer.from(sha256(parts[1] + ':' + password)), b = Buffer.from(parts[2]);
    return { ok: a.length === b.length && crypto.timingSafeEqual(a, b), legacy: true };
  }
  return { ok: false, legacy: false };
}

export function passwordError(pw: unknown): string | null {
  const s = String(pw ?? '');
  if (s.length < 6) return 'A senha deve ter pelo menos 6 caracteres.';
  if (s.length > 200) return 'A senha é longa demais.';
  return null;
}

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

/** Senha temporária legível, sem caracteres ambíguos. */
export function temporaryPassword() {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  const bytes = crypto.randomBytes(10);
  let out = '';
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out.slice(0, 4) + '-' + out.slice(4, 8);
}

import { createHash, randomBytes, randomInt } from 'node:crypto';

/** 256 bits d'aléa, en base64url (43 caractères). */
export const newToken = () => randomBytes(32).toString('base64url');
export const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

// Sans I, L, O ni 0, 1 : un code se recopie à la main depuis un tableau ou un mail.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_RE = /^[A-HJKMNP-Z2-9]{8}$/;

export function newCohortCode(): string {
  let code = '';
  for (let i = 0; i < 8; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return code;
}

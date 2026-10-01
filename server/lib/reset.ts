import type { Db } from '../db.ts';
import { newToken, sha256 } from './tokens.ts';

/** Crée un jeton de réinitialisation à usage unique et invalide les précédents. Renvoie le jeton en clair, une seule fois. */
export function createResetToken(db: Db, userId: number, now: number, ttlMs: number): string {
  const token = newToken();
  db.transaction(() => {
    db.prepare('DELETE FROM reset_tokens WHERE user_id = ?').run(userId);
    db.prepare('INSERT INTO reset_tokens (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(sha256(token), userId, now + ttlMs);
  })();
  return token;
}

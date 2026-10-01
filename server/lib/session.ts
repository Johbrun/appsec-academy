import type { Request, RequestHandler, Response } from 'express';
import { parseCookie, stringifySetCookie } from 'cookie';
import type { Config } from '../config.ts';
import type { Db } from '../db.ts';
import { HttpError } from './http.ts';
import { TOKEN_RE, newToken, sha256 } from './tokens.ts';
import type { Clock } from './deps.ts';

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  role: 'student' | 'teacher';
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
      sessionHash?: string;
    }
  }
}

interface SessionRow extends AuthUser {
  token_hash: string;
  created_at: number;
  last_seen_at: number;
  expires_at: number;
}

export interface Sessions {
  /** Attache `req.user` si le cookie porte une session valide. Ne refuse jamais une requête. */
  middleware: RequestHandler;
  /** Ouvre une session pour l'utilisateur et la pose dans un cookie. */
  start(res: Response, userId: number): void;
  /** Supprime la session présentée par la requête, s'il y en a une. */
  revoke(req: Request): void;
  /** Supprime la session présentée et efface le cookie. */
  end(req: Request, res: Response): void;
  clearCookie(res: Response): void;
  tokenHashOf(req: Request): string | undefined;
  revokeAllFor(userId: number, exceptHash?: string): void;
  purgeExpired(): void;
}

export function createSessions(db: Db, config: Config, clock: Clock): Sessions {
  const { idleMs, maxMs, touchMs } = config.session;

  const cookieBase = {
    name: config.cookieName,
    httpOnly: true,
    secure: config.secureCookies,
    sameSite: 'lax' as const,
    path: '/',
  };

  const tokenHashOf = (req: Request): string | undefined => {
    const raw = parseCookie(req.headers.cookie ?? '')[config.cookieName];
    return raw && TOKEN_RE.test(raw) ? sha256(raw) : undefined;
  };

  const clearCookie = (res: Response) => {
    res.append('Set-Cookie', stringifySetCookie({ ...cookieBase, value: '', maxAge: 0 }));
  };

  const find = db.prepare(`
    SELECT s.token_hash, s.created_at, s.last_seen_at, s.expires_at, u.id, u.email, u.name, u.role
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ?`);
  const drop = db.prepare('DELETE FROM sessions WHERE token_hash = ?');
  const touch = db.prepare('UPDATE sessions SET last_seen_at = ?, expires_at = ? WHERE token_hash = ?');

  return {
    middleware(req, _res, next) {
      const hash = tokenHashOf(req);
      if (!hash) return next();
      const row = find.get(hash) as SessionRow | undefined;
      if (!row) return next();
      const now = clock.now();
      // Deux bornes : inactivité (glissante) et durée de vie absolue.
      if (now >= row.expires_at || now >= row.created_at + maxMs) {
        drop.run(hash);
        return next();
      }
      if (now - row.last_seen_at >= touchMs) {
        touch.run(now, Math.min(now + idleMs, row.created_at + maxMs), hash);
      }
      req.user = { id: row.id, email: row.email, name: row.name, role: row.role };
      req.sessionHash = hash;
      next();
    },

    start(res, userId) {
      const token = newToken();
      const now = clock.now();
      db.prepare('INSERT INTO sessions (token_hash, user_id, created_at, last_seen_at, expires_at) VALUES (?, ?, ?, ?, ?)')
        .run(sha256(token), userId, now, now, now + Math.min(idleMs, maxMs));
      res.append('Set-Cookie', stringifySetCookie({ ...cookieBase, value: token, maxAge: Math.floor(maxMs / 1000) }));
    },

    revoke(req) {
      const hash = tokenHashOf(req);
      if (hash) drop.run(hash);
    },

    end(req, res) {
      const hash = tokenHashOf(req);
      if (hash) drop.run(hash);
      clearCookie(res);
    },

    clearCookie,

    tokenHashOf,

    revokeAllFor(userId, exceptHash) {
      if (exceptHash) db.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash <> ?').run(userId, exceptHash);
      else db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
    },

    purgeExpired() {
      const now = clock.now();
      db.prepare('DELETE FROM sessions WHERE expires_at <= ? OR created_at + ? <= ?').run(now, maxMs, now);
      db.prepare('DELETE FROM reset_tokens WHERE expires_at <= ? OR used_at IS NOT NULL').run(now);
    },
  };
}

export function requireUser(req: Request): AuthUser {
  if (!req.user) throw new HttpError(401, 'Authentification requise');
  return req.user;
}

/** Le rôle est relu en base à chaque requête : une rétrogradation prend effet immédiatement. */
export function requireTeacher(req: Request): AuthUser {
  const user = requireUser(req);
  if (user.role !== 'teacher') throw new HttpError(403, 'Réservé aux enseignants');
  return user;
}

export const mustBeUser: RequestHandler = (req, _res, next) => { requireUser(req); next(); };
export const mustBeTeacher: RequestHandler = (req, _res, next) => { requireTeacher(req); next(); };

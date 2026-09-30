// CORRIGÉ de server/lib/auth.ts.
//
// Couvre try-catch-fail-open et cookie-deserialization.

import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { readToken } from './jwt.ts';

export interface Principal {
  email: string;
  role: string;
  tenantId: string;
  trusted: boolean;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: Principal;
      prefs?: Prefs;
      authzSkipped?: boolean;
    }
  }
}

// ── Préférences transportées par cookie ─────────────────────────────────────

// CORRIGÉ (cookie-deserialization) : clé issue d'un générateur cryptographique,
// hors du code source. Mais la clé n'était que la moitié du sujet.
const PREFS_KEY = process.env.NOVAFACT_PREFS_KEY ?? crypto.randomBytes(32).toString('hex');

export class Prefs {
  theme = 'light';
  locale = 'fr';
  density = 'confortable';
  constructor(init: Record<string, unknown> = {}) {
    if (typeof init.theme === 'string') this.theme = init.theme;
    if (typeof init.locale === 'string') this.locale = init.locale;
    if (typeof init.density === 'string') this.density = init.density;
  }
}

/**
 * CORRIGÉ (cookie-deserialization) : le format ne reconstruit AUCUN type. Le
 * cookie transporte trois chaînes, et seulement trois ; tout le reste est
 * ignoré. Il n'y a plus de champ `$t`, donc plus de constructeur à choisir —
 * l'autre moitié du correctif est d'avoir supprimé la classe `Session` : l'état
 * d'authentification reste côté serveur, référencé par le jeton signé.
 */
const SCHEMA = {
  theme: new Set(['light', 'dark']),
  locale: new Set(['fr', 'en']),
  density: new Set(['confortable', 'compact']),
} as const;

export const serializeNovaser = (value: Prefs, _type: string): string => {
  const json = JSON.stringify({ theme: value.theme, locale: value.locale, density: value.density });
  const body = Buffer.from(json, 'utf8').toString('base64url');
  return `${body}.${crypto.createHmac('sha256', PREFS_KEY).update(body).digest('base64url')}`;
};

function readPrefs(cookie: string): Prefs | null {
  const [body, mac] = cookie.split('.');
  if (!body || !mac) return null;
  const expected = crypto.createHmac('sha256', PREFS_KEY).update(body).digest('base64url');
  if (mac.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;

  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;

  const prefs = new Prefs();
  for (const [field, allowed] of Object.entries(SCHEMA)) {
    const v = raw[field];
    if (v !== undefined && !(typeof v === 'string' && (allowed as Set<string>).has(v))) return null;
    if (typeof v === 'string') (prefs as unknown as Record<string, string>)[field] = v;
  }
  return prefs;
}

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = Object.create(null);
  for (const part of (header ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

// ── Authentification ────────────────────────────────────────────────────────

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    const result = readToken(header.slice(7));
    if (result) {
      req.user = {
        email: result.claims.sub,
        role: result.claims.role,
        tenantId: result.claims.tenantId,
        trusted: result.trusted,
      };
    }
  }

  // Le cookie ne porte plus que de l'affichage : il ne peut plus toucher à
  // l'identité, quoi qu'il contienne.
  const cookie = parseCookies(req.headers.cookie)['novafact_prefs'];
  if (cookie) {
    const prefs = readPrefs(cookie);
    if (prefs) req.prefs = prefs;
  }

  next();
}

export function requireUser(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'authentification requise' });
    return;
  }
  next();
}

// ── Autorisation ────────────────────────────────────────────────────────────

/**
 * CORRIGÉ (try-catch-fail-open) : le moteur valide le TYPE de ce qu'il reçoit
 * et répond false. Il ne lève plus, donc il n'y a plus d'exception à avaler.
 */
export function can(principal: Principal | undefined, action: string, resource: unknown): boolean {
  if (!principal) return false;
  if (typeof resource !== 'string' || !resource) return false;
  const target = resource.toLowerCase();
  if (principal.role === 'admin') return true;
  if (action === 'directory:read') return target === principal.tenantId.toLowerCase();
  return false;
}

/**
 * CORRIGÉ (try-catch-fail-open) : un contrôle qui ne sait pas répondre REFUSE.
 * Le `catch` répond 403 et n'appelle jamais `next()` : l'échec sûr est le
 * comportement par défaut, pas une option.
 */
export function requireDirectoryAccess(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'authentification requise' });
    return;
  }
  const requested = req.query.tenant ?? req.user.tenantId;
  let allowed = false;
  try {
    allowed = can(req.user, 'directory:read', requested);
  } catch {
    allowed = false;
  }
  if (!allowed) {
    res.status(403).json({ error: 'accès refusé à cet annuaire' });
    return;
  }
  next();
}

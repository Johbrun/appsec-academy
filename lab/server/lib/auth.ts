// Middleware d'authentification et moteur d'autorisation.
//
// Exercices portés par ce fichier :
//   · try-catch-fail-open     le contrôle d'accès échoue OUVERT
//   · cookie-deserialization  un cookie signé reconstruit des objets typés
//
// Le défaut de jwt-decode, lui, est dans readToken() (server/lib/jwt.ts) : ici
// on se contente de lui faire confiance.

import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { readToken } from './jwt.ts';
import { solve } from '../store.ts';

export interface Principal {
  email: string;
  role: string;
  tenantId: string;
  /** false quand la signature du jeton n'a pas été validée. */
  trusted: boolean;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: Principal;
      /** Préférences d'affichage désérialisées depuis le cookie. */
      prefs?: Prefs;
      /** Posé quand le moteur d'autorisation a levé et qu'on a continué. */
      authzSkipped?: boolean;
    }
  }
}

// ── Préférences transportées par cookie ─────────────────────────────────────
//
// Le cookie `novafact_prefs` transporte un objet sérialisé dans un petit format
// maison — « novaser » — qui reconstruit des TYPES et pas seulement des données.
// Il est signé, donc « on ne peut pas le modifier ». C'est le raisonnement qui
// a produit CVE-2017-5941 (node-serialize), les désérialisations Rails, et la
// famille entière des cookies de session PHP.

/**
 * VULNÉRABLE (cookie-deserialization) : clé de signature courte et devinable.
 * Cinq caractères se cassent hors ligne en quelques secondes — c'est
 * exactement ce que fait `flask-unsign` sur les sessions Flask.
 *
 * Correctif attendu : clé issue d'un générateur cryptographique (32 octets au
 * moins), hors du code source. Mais la clé n'est que la moitié du sujet : voir
 * `reviveNovaser`.
 */
const PREFS_KEY = 'nova1';

export class Prefs {
  theme = 'light';
  locale = 'fr';
  density = 'confortable';
  constructor(init: Record<string, unknown> = {}) {
    Object.assign(this, { theme: init.theme, locale: init.locale, density: init.density });
    if (typeof this.theme !== 'string') this.theme = 'light';
    if (typeof this.locale !== 'string') this.locale = 'fr';
    if (typeof this.density !== 'string') this.density = 'confortable';
  }
}

/**
 * Cache de session, écrit par le back pour s'épargner un aller-retour vers le
 * magasin d'identités. Ce type n'a rien à faire dans un cookie de préférences —
 * mais le désérialiseur ne le sait pas.
 */
export class Session {
  email = '';
  role = 'user';
  tenantId = '';
  constructor(init: Record<string, unknown> = {}) {
    this.email = String(init.email ?? '');
    this.role = String(init.role ?? 'user');
    this.tenantId = String(init.tenantId ?? '');
  }
}

/** Types que le format sait reconstruire. Il n'y a pas de liste d'autorisation. */
const NOVASER_TYPES: Record<string, new (init: Record<string, unknown>) => object> = {
  Prefs,
  Session,
};

export const serializeNovaser = (value: object, type: string): string => {
  const json = JSON.stringify({ $t: type, ...value });
  const body = Buffer.from(json, 'utf8').toString('base64url');
  return `${body}.${crypto.createHmac('sha256', PREFS_KEY).update(body).digest('base64url').slice(0, 22)}`;
};

/**
 * VULNÉRABLE (cookie-deserialization) : le champ `$t` du document désigne le
 * constructeur à appeler. N'importe quel type enregistré est donc
 * reconstructible depuis un cookie — y compris `Session`, que le code
 * appelant traite ensuite comme une identité déjà établie.
 *
 * Correctif attendu : JSON + schéma strict, et un format qui ne reconstruit
 * AUCUN type — les données d'un cookie sont des données, jamais des objets.
 * L'état sensible reste côté serveur, référencé par un identifiant opaque. La
 * signature ne sauve pas un format dangereux : elle retarde seulement.
 */
function reviveNovaser(cookie: string): object | null {
  const [body, mac] = cookie.split('.');
  if (!body || !mac) return null;
  const expected = crypto
    .createHmac('sha256', PREFS_KEY)
    .update(body)
    .digest('base64url')
    .slice(0, 22);
  if (mac !== expected) return null;

  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }
  const Ctor = NOVASER_TYPES[String(raw.$t ?? '')];
  if (!Ctor) return null;
  return new Ctor(raw);
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

  const cookie = parseCookies(req.headers.cookie)['novafact_prefs'];
  if (cookie) {
    const revived = reviveNovaser(cookie);
    if (revived instanceof Prefs) {
      req.prefs = revived;
    } else if (revived instanceof Session) {
      // Le lab constate : un type que le cookie n'était pas censé transporter
      // a été reconstruit depuis une donnée du client, et il devient l'identité
      // de la requête.
      solve('cookie-deserialization');
      req.user = {
        email: revived.email,
        role: revived.role,
        tenantId: revived.tenantId,
        trusted: true,
      };
    }
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
 * Moteur d'autorisation maison. Il refuse en levant ou en renvoyant false —
 * et il suppose que ses arguments sont des chaînes.
 */
export function can(principal: Principal | undefined, action: string, resource: unknown): boolean {
  if (!principal) return false;
  // `resource` vient de la requête : si ce n'est pas une chaîne, ceci lève.
  const target = (resource as string).toLowerCase();
  if (principal.role === 'admin') return true;
  if (action === 'directory:read') return target === principal.tenantId.toLowerCase();
  return false;
}

/**
 * VULNÉRABLE (try-catch-fail-open) : l'appel au moteur d'autorisation est
 * enveloppé dans un `catch` qui avale l'exception, et l'exécution continue
 * comme si l'accès avait été accordé. Une entrée malformée — un tableau là où
 * une chaîne est attendue, ce que l'analyseur de query string d'Express
 * fabrique avec `?tenant[]=globex` — suffit donc à sauter le contrôle.
 *
 * Correctif attendu : un contrôle qui ne sait pas répondre REFUSE. `catch`
 * autour d'une décision d'autorisation ⇒ 403, jamais `next()`. Et le type est
 * validé par schéma avant d'atteindre le moteur. Semgrep trouve le motif en
 * une règle ; c'est aussi la raison d'être de A10:2025.
 */
export function requireDirectoryAccess(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'authentification requise' });
    return;
  }
  const requested = req.query.tenant ?? req.user.tenantId;
  try {
    if (!can(req.user, 'directory:read', requested)) {
      res.status(403).json({ error: 'accès refusé à cet annuaire' });
      return;
    }
  } catch {
    // Rien. On continue.
    req.authzSkipped = true;
  }
  next();
}

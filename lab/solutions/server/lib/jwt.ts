// CORRIGÉ de server/lib/jwt.ts.
//
// Couvre jwt-decode, jwt-kid-traversal, jwt-jku-jwk, jwt-no-audience et
// session-not-revocable. Le fil commun tient en une phrase : le jeton ne décide
// de RIEN. Ni de l'algorithme, ni de la clé, ni de sa propre validité.

import crypto from 'node:crypto';

const SECRET = process.env.NOVAFACT_JWT_SECRET ?? 'lab-secret-novafact';
const DEFAULT_KID = 'hs-2024';
const ISSUER = 'https://novafact.example';

// CORRIGÉ (jwt-kid-traversal) : le trousseau est en mémoire et connu d'avance.
// `kid` sert à y CHERCHER, jamais à construire un chemin de fichier ni une
// requête. Un identifiant inconnu fait refuser le jeton, point.
const KEYRING: Record<string, string> = { [DEFAULT_KID]: SECRET };

// CORRIGÉ (jwt-decode) : la liste d'algorithmes est fixée ici, côté serveur, et
// n'est jamais lue dans le jeton.
const ALLOWED_ALGS = new Set(['HS256']);

const b64url = (buf: Buffer | string) =>
  Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const unb64url = (s: string) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

export interface Claims {
  sub: string;
  role: string;
  tenantId: string;
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string;
}

interface JwtHeader {
  alg?: string;
  typ?: string;
  kid?: string;
  jwk?: unknown;
  jku?: unknown;
  x5u?: unknown;
}

const hmac = (data: string, key: string) =>
  b64url(crypto.createHmac('sha256', key).update(data).digest());

// CORRIGÉ (jwt-no-audience) : chaque jeton porte son émetteur ET son audience.
// Une signature valide prouve l'origine ; `aud` prouve la destination.
export function sign(claims: Claims, audience: string = claims.tenantId): string {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT', kid: DEFAULT_KID }));
  const now = Math.floor(Date.now() / 1000);
  const payload = b64url(
    JSON.stringify({ ...claims, iss: ISSUER, aud: audience, iat: now, exp: now + 3600 }),
  );
  return `${header}.${payload}.${hmac(`${header}.${payload}`, SECRET)}`;
}

// CORRIGÉ (session-not-revocable) : la déconnexion a un effet CÔTÉ SERVEUR. En
// production, cette liste est un magasin partagé (Redis) purgé à l'expiration
// des jetons — la durée de vie courte est ce qui la garde petite.
const revoked = new Set<string>();

export function markLoggedOut(token: string): void {
  const signature = token.split('.')[2];
  if (signature) revoked.add(signature);
}

export function resetJwtState(): void {
  revoked.clear();
}

export interface ReadResult {
  claims: Claims;
  trusted: boolean;
}

/**
 * CORRIGÉ (jwt-decode) : rien n'est renvoyé si la vérification échoue. Le
 * drapeau `trusted` ne peut donc plus valoir autre chose que true.
 */
export function readToken(token: string): ReadResult | null {
  const claims = verifyStrict(token);
  return claims ? { claims, trusted: true } : null;
}

export function verifyStrict(token: string): Claims | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;

  let header: JwtHeader;
  try {
    header = JSON.parse(unb64url(h).toString('utf8'));
  } catch {
    return null;
  }

  if (!header.alg || !ALLOWED_ALGS.has(header.alg)) return null;

  // CORRIGÉ (jwt-jku-jwk) : le jeton ne choisit jamais sa clé de vérification.
  // `jwk`, `jku` et `x5u` sont des en-têtes que ce serveur n'honore pas — leur
  // seule présence est un signal, donc un refus.
  if (header.jwk !== undefined || header.jku !== undefined || header.x5u !== undefined) return null;

  const key = KEYRING[header.kid ?? DEFAULT_KID];
  if (!key) return null;

  const expected = hmac(`${h}.${p}`, key);
  if (expected.length !== s.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(s))) return null;

  // CORRIGÉ (session-not-revocable) : la révocation est consultée à CHAQUE
  // lecture, et l'expiration est vérifiée ici — pas laissée au client.
  if (revoked.has(s)) return null;

  try {
    const claims = JSON.parse(unb64url(p).toString('utf8')) as Claims;
    const now = Math.floor(Date.now() / 1000);
    if (typeof claims.exp !== 'number' || claims.exp < now) return null;
    if (claims.iss !== ISSUER) return null;
    if (typeof claims.aud !== 'string' || !claims.aud) return null;
    return claims;
  } catch {
    return null;
  }
}

/**
 * L'audience pour laquelle ce jeton a été émis, lue dans le jeton VÉRIFIÉ.
 *
 * CORRIGÉ (jwt-no-audience) : plus besoin d'un registre en mémoire pour le
 * savoir — la revendication le dit, et elle est couverte par la signature.
 */
export const audienceOf = (token: string): string | undefined => verifyStrict(token)?.aud;

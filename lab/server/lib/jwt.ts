// JWT écrit à la main pour que les défauts soient lisibles et les correctifs
// courts.
//
// Exercices portés par ce fichier :
//   · jwt-decode            readToken() décode sans vérifier la signature
//   · jwt-kid-traversal     `kid` sert à construire un chemin de fichier
//   · jwt-jku-jwk           la clé de vérification vient de l'en-tête du jeton
//   · jwt-no-audience       ni `iss` ni `aud`, et une seule clé pour tous
//   · session-not-revocable ni `exp` vérifié, ni liste de révocation

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { solve } from '../store.ts';

const SECRET = 'lab-secret-novafact';

/** Identifiant de la clé courante. Tous les jetons du lab le portent. */
const DEFAULT_KID = 'hs-2024';

/** Trousseau en mémoire : le seul endroit d'où une clé devrait sortir. */
const KEYRING: Record<string, string> = { [DEFAULT_KID]: SECRET };

/** Répertoire où l'application range ses fichiers de clé. */
const KEYS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'secrets');

const b64url = (buf: Buffer | string) =>
  Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const unb64url = (s: string) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

export interface Claims {
  sub: string;
  role: string;
  tenantId: string;
  iat?: number;
  exp?: number;
  /** Jamais émis, jamais vérifié : c'est tout l'exercice jwt-no-audience. */
  iss?: string;
  aud?: string;
}

interface JwtHeader {
  alg?: string;
  typ?: string;
  kid?: string;
  /** Clé publique embarquée dans le jeton (RFC 7515 §4.1.3). */
  jwk?: JsonWebKey;
  /** URL du JWKS, même défaut que `jwk` avec un aller-retour réseau en plus. */
  jku?: string;
}

function hmac(data: string, key: Buffer | string): string {
  return b64url(crypto.createHmac('sha256', key).update(data).digest());
}

/**
 * Résout un identifiant de clé.
 *
 * VULNÉRABLE (jwt-kid-traversal) : quand le `kid` n'est pas dans le trousseau,
 * il est concaténé dans un chemin de fichier sans normalisation. `kid` est un
 * identifiant opaque choisi par le porteur du jeton : le laisser désigner un
 * fichier, c'est lui laisser choisir la clé qui vérifie sa propre signature.
 * Il suffit alors de pointer vers un fichier au contenu connu — `/dev/null`
 * donne une clé vide, que n'importe qui peut reproduire.
 *
 * Correctif attendu : `kid` ne sert qu'à chercher dans un trousseau connu
 * d'avance (`KEYRING[kid]`), jamais à construire un chemin ni une requête. Si
 * l'identifiant est inconnu, le jeton est refusé. RFC 8725 §3.9.
 */
function keyFor(kid: string): { key: Buffer; escaped: boolean } | null {
  if (Object.prototype.hasOwnProperty.call(KEYRING, kid)) {
    return { key: Buffer.from(KEYRING[kid], 'utf8'), escaped: false };
  }
  const resolved = path.resolve(KEYS_DIR, kid);
  try {
    return { key: fs.readFileSync(resolved), escaped: !resolved.startsWith(KEYS_DIR + path.sep) };
  } catch {
    return null;
  }
}

// ── Émission ────────────────────────────────────────────────────────────────

/**
 * Registre lab : pour quel déploiement chaque jeton a été émis.
 *
 * N'existe que pour que le serveur puisse CONSTATER qu'un jeton émis ailleurs
 * a été accepté ici. Dans du vrai code, c'est précisément le rôle de la
 * revendication `aud` — absente ci-dessous — et rien ne trace l'abus.
 */
const mintedFor = new Map<string, string>();

/**
 * VULNÉRABLE (jwt-no-audience) : le jeton ne porte ni `iss` ni `aud`, et la
 * même clé signe pour tous les déploiements. Une signature valide prouve
 * l'origine, pas la destination : un jeton du déploiement ACME est donc
 * indiscernable d'un jeton du déploiement Globex.
 *
 * Correctif attendu : émettre `iss` et `aud`, les vérifier à la lecture au même
 * titre que la signature, et une clé par périmètre.
 */
export function sign(claims: Claims, audience: string = claims.tenantId): string {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT', kid: DEFAULT_KID }));
  const now = Math.floor(Date.now() / 1000);
  const payload = b64url(JSON.stringify({ ...claims, iat: now, exp: now + 3600 }));
  const signature = hmac(`${header}.${payload}`, SECRET);
  mintedFor.set(signature, audience);
  return `${header}.${payload}.${signature}`;
}

/** Le déploiement pour lequel ce jeton a été émis, si le lab l'a vu naître. */
export const audienceOf = (token: string): string | undefined =>
  mintedFor.get(token.split('.')[2] ?? '');

// ── Révocation (ou plutôt : son absence) ────────────────────────────────────

/** Signatures des jetons passés par /api/auth/logout. */
const loggedOut = new Set<string>();
let sawLoggedOutReuse = false;
let sawExpiredAccepted = false;

/**
 * VULNÉRABLE (session-not-revocable) : se déconnecter n'a aucun effet côté
 * serveur. La route /logout efface le cookie du navigateur ; le jeton, lui,
 * reste accepté. Et `exp` n'est jamais lu, donc il ne périme rien non plus.
 *
 * Ce registre n'existe que pour que le lab voie les deux abus. Le code
 * vulnérable, lui, ne consulte rien — c'est tout le problème.
 *
 * Correctif attendu : vérifier `exp` à chaque lecture, durée de vie courte,
 * rotation du jeton de rafraîchissement, et liste de révocation consultée pour
 * les cas qui comptent (déconnexion, changement de mot de passe, compromission).
 */
export function markLoggedOut(token: string): void {
  const signature = token.split('.')[2];
  if (signature) loggedOut.add(signature);
}

function watchSession(signature: string, claims: Claims): void {
  if (signature && loggedOut.has(signature)) sawLoggedOutReuse = true;
  if (typeof claims.exp === 'number' && claims.exp < Math.floor(Date.now() / 1000)) {
    sawExpiredAccepted = true;
  }
  if (sawLoggedOutReuse && sawExpiredAccepted) solve('session-not-revocable');
}

/** Remis à zéro par /api/lab/reset (via resetAuthState). */
export function resetJwtState(): void {
  loggedOut.clear();
  mintedFor.clear();
  sawLoggedOutReuse = false;
  sawExpiredAccepted = false;
}

// ── Lecture ─────────────────────────────────────────────────────────────────

export interface ReadResult {
  claims: Claims;
  /** false = la signature n'a pas été validée par le serveur. */
  trusted: boolean;
}

/**
 * VULNÉRABLE (jwt-decode) : lit les revendications sans vérifier la signature,
 * et accepte l'algorithme annoncé par le jeton lui-même.
 *
 * Le drapeau `trusted` n'existe que pour le lab : il permet au serveur de
 * constater qu'un jeton forgé a été accepté. Dans du vrai code, ce défaut ne
 * laisse aucune trace — c'est justement le problème.
 *
 * Correctif attendu : refuser tout jeton dont la signature HS256 ne correspond
 * pas, avec la liste d'algorithmes fixée côté serveur (jamais lue dans le
 * jeton), puis contrôler iss / aud / exp. Voir RFC 8725, et `verifyStrict`.
 */
export function readToken(token: string): ReadResult | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;

  let header: JwtHeader;
  let claims: Claims;
  try {
    header = JSON.parse(unb64url(h).toString('utf8'));
    claims = JSON.parse(unb64url(p).toString('utf8'));
  } catch {
    return null;
  }

  // L'algorithme vient du jeton : c'est l'erreur.
  const alg = header.alg ?? 'none';
  let trusted = false;

  if ((alg === 'RS256' || alg === 'PS256') && (header.jwk || header.jku)) {
    // VULNÉRABLE (jwt-jku-jwk) : la clé publique de vérification est lue DANS
    // le jeton. Quiconque sait générer une paire de clés signe donc ce qu'il
    // veut : il embarque sa propre clé publique et le serveur s'en sert.
    // `jku` est le même défaut avec un aller-retour réseau en plus ; le lab
    // n'implémente que la variante en en-tête pour que readToken reste
    // synchrone, mais le motif et le correctif sont identiques.
    //
    // Correctif attendu : le jeton ne choisit jamais sa clé de vérification.
    // Le serveur connaît son JWKS, son émetteur et sa liste d'algorithmes, et
    // ignore purement et simplement `jwk`, `jku` et `x5u`. RFC 8725 §3.8.
    try {
      const pub = crypto.createPublicKey({ key: header.jwk as JsonWebKey, format: 'jwk' });
      trusted = crypto.verify('RSA-SHA256', Buffer.from(`${h}.${p}`), pub, unb64url(s));
    } catch {
      trusted = false;
    }
    // Le lab constate : une signature a été validée avec une clé fournie par
    // celui-là même qui présente le jeton.
    if (trusted) solve('jwt-jku-jwk');
  } else if (alg === 'HS256') {
    const entry = keyFor(header.kid ?? DEFAULT_KID);
    if (entry) {
      const expected = hmac(`${h}.${p}`, entry.key);
      trusted =
        expected.length === s.length &&
        crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(s));
      // Le lab constate : le `kid` a fait sortir la lecture du répertoire de
      // clés, et la signature calculée avec ce fichier correspond.
      if (trusted && entry.escaped) solve('jwt-kid-traversal');
    }
  } else if (alg === 'none') {
    trusted = false; // …et pourtant on laisse passer, plus bas.
  }

  // Ni expiration, ni révocation : le jeton est accepté tel quel.
  watchSession(s, claims);

  // Le jeton est retourné quelle que soit l'issue de la vérification.
  return { claims, trusted };
}

/** Version correcte, fournie pour le corrigé et les tests de vérification. */
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
  if (header.alg !== 'HS256') return null; // liste d'algorithmes fixée côté serveur
  if (header.jwk || header.jku) return null; // le jeton ne choisit pas sa clé
  if (header.kid && !Object.prototype.hasOwnProperty.call(KEYRING, header.kid)) return null;
  const expected = hmac(`${h}.${p}`, KEYRING[header.kid ?? DEFAULT_KID]);
  if (expected.length !== s.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(s))) return null;
  try {
    const claims = JSON.parse(unb64url(p).toString('utf8')) as Claims;
    if (claims.exp && claims.exp < Math.floor(Date.now() / 1000)) return null;
    if (loggedOut.has(s)) return null;
    return claims;
  } catch {
    return null;
  }
}

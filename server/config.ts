import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export interface ArgonParams { memoryCost: number; timeCost: number; parallelism: number }

/** Recommandation OWASP pour argon2id : 19 MiB, 2 passes, 1 thread. */
export const PRODUCTION_ARGON: ArgonParams = { memoryCost: 19456, timeCost: 2, parallelism: 1 };

export interface Limits {
  windowMs: number;
  loginPerIp: number;
  signupPerIp: number;
  resetPerIp: number;
  joinPerUser: number;
}

export interface Config {
  env: 'development' | 'production' | 'test';
  host: string;
  port: number;
  /** Origines autorisées pour les requêtes qui modifient l'état ; la première sert à construire les liens. */
  allowedOrigins: string[];
  databasePath: string;
  distDir: string;
  /** Nombre de reverse proxys de confiance devant le serveur (0 = aucun). */
  trustProxy: number;
  secureCookies: boolean;
  cookieName: string;
  argon: ArgonParams;
  session: { idleMs: number; maxMs: number; touchMs: number };
  resetTtlMs: number;
  limits: Limits;
  logErrors: boolean;
}

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

export const cookieNameFor = (secure: boolean) => (secure ? '__Host-appsec_sid' : 'appsec_sid');

const defaults = {
  session: { idleMs: 7 * DAY, maxMs: 30 * DAY, touchMs: MINUTE },
  resetTtlMs: DAY,
  limits: { windowMs: 15 * MINUTE, loginPerIp: 30,signupPerIp: 20, resetPerIp: 10, joinPerUser: 10 },
};

function intFrom(raw: string | undefined, name: string, def: number, min: number, max: number): number {
  if (raw === undefined || raw === '') return def;
  if (!/^\d+$/.test(raw)) throw new Error(`${name} doit être un entier`);
  const n = Number(raw);
  if (n < min || n > max) throw new Error(`${name} doit être compris entre ${min} et ${max}`);
  return n;
}

function parseOrigins(raw: string, production: boolean): string[] {
  const origins = raw.split(',').map((s) => s.trim()).filter(Boolean).map((s) => {
    let url: URL;
    try { url = new URL(s); } catch { throw new Error(`PUBLIC_ORIGIN invalide : « ${s} »`); }
    // Une origine, rien d'autre : pas de chemin, pas de paramètres.
    if (s.replace(/\/$/, '') !== url.origin) throw new Error(`PUBLIC_ORIGIN doit être une origine (schéma + hôte + port), pas « ${s} »`);
    if (production && url.protocol !== 'https:') throw new Error(`PUBLIC_ORIGIN doit être en https en production : « ${s} »`);
    return url.origin;
  });
  if (!origins.length) throw new Error('PUBLIC_ORIGIN est vide');
  return [...new Set(origins)];
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const production = env.NODE_ENV === 'production';
  if (production && !env.PUBLIC_ORIGIN) throw new Error('PUBLIC_ORIGIN est obligatoire en production (ex. https://academy.example.org)');
  if (production && !env.DATABASE_PATH) throw new Error('DATABASE_PATH est obligatoire en production (ex. /data/appsec.db)');

  const port = intFrom(env.PORT, 'PORT', 4300, 1, 65535);
  // En développement, le front tourne aussi sur Vite (5173) et appelle l'API à travers son proxy.
  const devOrigins = [`http://127.0.0.1:${port}`, `http://localhost:${port}`, 'http://127.0.0.1:5173', 'http://localhost:5173'].join(',');

  return {
    env: production ? 'production' : 'development',
    host: env.HOST || '127.0.0.1',
    port,
    allowedOrigins: parseOrigins(env.PUBLIC_ORIGIN || devOrigins, production),
    databasePath: env.DATABASE_PATH || path.join(APP_ROOT, 'data', 'appsec.db'),
    distDir: env.DIST_DIR ? path.resolve(env.DIST_DIR) : path.join(APP_ROOT, 'dist'),
    trustProxy: intFrom(env.TRUST_PROXY, 'TRUST_PROXY', 0, 0, 10),
    secureCookies: production,
    cookieName: cookieNameFor(production),
    argon: PRODUCTION_ARGON,
    ...defaults,
    logErrors: true,
  };
}

/** Configuration des tests : argon2 réduit pour aller vite, limites basses pour les atteindre. */
export function testConfig(over: Partial<Config> = {}): Config {
  return {
    env: 'test',
    host: '127.0.0.1',
    port: 0,
    allowedOrigins: ['https://academy.test'],
    databasePath: ':memory:',
    distDir: path.join(APP_ROOT, 'dist'),
    trustProxy: 0,
    secureCookies: false,
    cookieName: cookieNameFor(false),
    argon: { memoryCost: 1024, timeCost: 1, parallelism: 1 },
    ...defaults,
    limits: { windowMs: 15 * MINUTE, loginPerIp: 8,signupPerIp: 1000, resetPerIp: 6, joinPerUser: 5 },
    logErrors: false,
    ...over,
  };
}

/** Pour les points d'entrée : une configuration invalide s'affiche en une ligne claire, sans pile d'appels. */
export function loadConfigOrExit(env: NodeJS.ProcessEnv = process.env): Config {
  try {
    return loadConfig(env);
  } catch (e) {
    console.error(`Configuration invalide : ${(e as Error).message}`);
    process.exit(1);
  }
}

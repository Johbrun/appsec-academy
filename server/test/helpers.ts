import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createApp, type AppHandle } from '../app.ts';
import { testConfig, type Config } from '../config.ts';
import { openDb, type Db } from '../db.ts';
import { createPasswords } from '../lib/password.ts';
import { newCohortCode, newToken, sha256 } from '../lib/tokens.ts';

export const PASSWORD = 'correct horse battery';

export interface Actor {
  id: number;
  email: string;
  name: string;
  role: 'student' | 'teacher';
  password: string;
  /** Cookie de session courant (« nom=valeur »), absent tant que l'acteur n'est pas connecté. */
  cookie?: string;
}

export interface Reply<T = any> {
  status: number;
  body: T;
  headers: Headers;
  raw: string;
}

export interface CallOptions {
  as?: Actor | null;
  method?: string;
  body?: unknown;
  /** Origin envoyé ; `null` pour ne pas en envoyer. Par défaut, l'origine légitime. */
  origin?: string | null;
  contentType?: string | null;
  headers?: Record<string, string>;
  cookie?: string;
  rawBody?: string;
}

export interface World {
  url: string;
  db: Db;
  app: AppHandle;
  config: Config;
  close(): Promise<void>;
  call<T = any>(route: string, opts?: CallOptions): Promise<Reply<T>>;
  /** Insère un compte directement en base (rapide) et lui ouvre une session. */
  user(role?: 'student' | 'teacher', name?: string): Promise<Actor>;
  /** Connexion réelle par l'API : pose le cookie sur l'acteur. */
  login(actor: Actor): Promise<Reply>;
  /** Crée une promo appartenant à `owner` (en base) et renvoie son id et son code. */
  cohort(owner: Actor, name?: string): { id: number; code: string };
  join(student: Actor, cohortId: number): void;
  setClock(ms: number): void;
  advance(ms: number): void;
  now(): number;
  /** Photographie de toutes les tables : sert à prouver qu'une requête refusée n'a rien modifié. */
  snapshot(): string;
}

const TABLES = ['users', 'sessions', 'progress', 'cohorts', 'cohort_members', 'reset_tokens'];

let counter = 0;
const hashCache = new Map<string, Promise<string>>();

export async function startWorld(overrides: Partial<Config> = {}): Promise<World> {
  const config = testConfig(overrides);
  const db = openDb(':memory:');
  let clock = Date.now();
  const app = createApp({ db, config, clock: { now: () => clock } });
  const server: Server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  const passwords = createPasswords(config.argon);
  // Un seul hachage par jeu de paramètres : tous les comptes de test partagent le même mot de passe.
  const key = JSON.stringify(config.argon);
  if (!hashCache.has(key)) hashCache.set(key, passwords.hash(PASSWORD));
  const passwordHash = await hashCache.get(key)!;

  const world: World = {
    url, db, app, config,
    now: () => clock,
    setClock: (ms) => { clock = ms; },
    advance: (ms) => { clock += ms; },

    async close() {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      db.close();
    },

    async call(route, opts = {}) {
      const method = opts.method ?? (opts.body !== undefined || opts.rawBody !== undefined ? 'POST' : 'GET');
      const headers: Record<string, string> = { ...opts.headers };
      const origin = opts.origin === undefined ? config.allowedOrigins[0] : opts.origin;
      if (origin) headers.Origin = origin;
      const unsafe = !['GET', 'HEAD', 'OPTIONS'].includes(method);
      const contentType = opts.contentType === undefined ? (unsafe ? 'application/json' : null) : opts.contentType;
      if (contentType) headers['Content-Type'] = contentType;
      const cookie = opts.cookie ?? opts.as?.cookie;
      if (cookie) headers.Cookie = cookie;
      const payload = opts.rawBody ?? (opts.body === undefined ? (unsafe && contentType === 'application/json' ? '{}' : undefined) : JSON.stringify(opts.body));

      const res = await fetch(url + route, { method, headers, body: payload, redirect: 'manual' });
      const raw = await res.text();
      let body: unknown = raw;
      try { body = raw ? JSON.parse(raw) : null; } catch { /* corps non JSON : on garde le texte */ }
      // Garde le cookie de l'acteur à jour, comme un navigateur.
      if (opts.as) {
        for (const line of res.headers.getSetCookie()) {
          const [pair, ...attrs] = line.split(';');
          const expired = attrs.some((a) => /^\s*max-age=0\s*$/i.test(a));
          opts.as.cookie = expired ? undefined : pair.trim();
        }
      }
      return { status: res.status, body: body as never, headers: res.headers, raw };
    },

    async user(role = 'student', name) {
      const n = ++counter;
      const email = `${role}${n}@academy.test`;
      const id = Number(db.prepare('INSERT INTO users (email, name, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)')
        .run(email, name ?? `${role} ${n}`, passwordHash, role, clock).lastInsertRowid);
      const token = newToken();
      db.prepare('INSERT INTO sessions (token_hash, user_id, created_at, last_seen_at, expires_at) VALUES (?, ?, ?, ?, ?)')
        .run(sha256(token), id, clock, clock, clock + config.session.idleMs);
      return { id, email, name: name ?? `${role} ${n}`, role, password: PASSWORD, cookie: `${config.cookieName}=${token}` };
    },

    login(actor) {
      actor.cookie = undefined;
      return world.call('/api/auth/login', { as: actor, body: { email: actor.email, password: actor.password } });
    },

    cohort(owner, name = 'Promo test') {
      const code = newCohortCode();
      const id = Number(db.prepare('INSERT INTO cohorts (name, code, owner_id, created_at) VALUES (?, ?, ?, ?)').run(name, code, owner.id, clock).lastInsertRowid);
      return { id, code };
    },

    join(student, cohortId) {
      db.prepare('INSERT INTO cohort_members (cohort_id, user_id, joined_at) VALUES (?, ?, ?)').run(cohortId, student.id, clock);
    },

    snapshot() {
      return JSON.stringify(TABLES.map((t) => db.prepare(`SELECT * FROM ${t} ORDER BY rowid`).all()));
    },
  };
  return world;
}

/** Dossier `dist` factice pour tester le service des fichiers statiques. */
export function fakeDist(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'appsec-dist-'));
  fs.mkdirSync(path.join(dir, 'assets'));
  fs.writeFileSync(path.join(dir, 'index.html'), '<!doctype html><title>AppSec Academy</title><script src="./theme.js"></script>');
  fs.writeFileSync(path.join(dir, 'theme.js'), '/* thème */');
  fs.writeFileSync(path.join(dir, 'assets', 'index-abc123.js'), 'console.log(1)');
  return dir;
}

/** Les routes enregistrées sur le routeur de l'API, telles qu'Express les connaît. */
export function registeredRoutes(app: AppHandle): { method: string; path: string }[] {
  const routes: { method: string; path: string }[] = [];
  for (const layer of (app.locals.apiRouter as unknown as { stack: any[] }).stack) {
    if (!layer.route) continue;
    for (const method of Object.keys(layer.route.methods)) routes.push({ method: method.toUpperCase(), path: `/api${layer.route.path}` });
  }
  return routes;
}

/** Routes posées directement sur l'application, hors du routeur de l'API (il ne doit pas y en avoir). */
export function strayRoutes(app: AppHandle): string[] {
  const stack: any[] = (app as unknown as { router: { stack: any[] } }).router.stack;
  return stack.filter((l) => l.route).map((l) => String(l.route.path));
}

export interface Scene {
  w: World;
  /** Enseignant propriétaire de la promo. */
  T1: Actor;
  /** Un autre enseignant, étranger à la promo. */
  T2: Actor;
  /** Étudiant membre de la promo. */
  A: Actor;
  /** Étudiant qui n'en est pas membre : il est inscrit chez l'autre enseignant (T2), ce qui est le cas piégeux. */
  B: Actor;
  cohort: { id: number; code: string };
  /** La promo de T2, où B est inscrit. */
  cohort2: { id: number; code: string };
}

/**
 * Un petit monde complet : deux enseignants, deux étudiants, deux promos.
 * A est dans la promo de T1, B dans celle de T2. Chaque étudiant est donc « membre de quelque chose » :
 * un contrôle qui vérifierait l'appartenance sans la lier à la bonne promo laisserait passer.
 */
export async function scene(overrides: Partial<Config> = {}): Promise<Scene> {
  const w = await startWorld(overrides);
  const T1 = await w.user('teacher');
  const T2 = await w.user('teacher');
  const A = await w.user('student');
  const B = await w.user('student');
  const cohort = w.cohort(T1, 'Promo de T1');
  const cohort2 = w.cohort(T2, 'Promo de T2');
  w.join(A, cohort.id);
  w.join(B, cohort2.id);
  return { w, T1, T2, A, B, cohort, cohort2 };
}

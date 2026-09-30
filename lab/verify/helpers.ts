// Outils communs aux tests de régression.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const API = process.env.LAB_API ?? 'http://127.0.0.1:4317/api';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const readSource = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');

/**
 * Le code sans ses commentaires.
 *
 * Indispensable pour les contrôles statiques : sans ça, un commentaire qui
 * décrit le correctif (« assainir avec DOMPurify ») suffit à faire passer le
 * test. C'est la version miniature d'un faux positif de SAST — et l'inverse de
 * ce qu'on veut mesurer.
 */
export const readCode = (relative: string) =>
  readSource(relative)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ')
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, ' ');

export interface Res<T = unknown> {
  status: number;
  body: T;
  text: string;
  headers: Headers;
}

export async function call<T = unknown>(
  route: string,
  init: RequestInit & { token?: string } = {},
): Promise<Res<T>> {
  const { token, ...rest } = init;
  const res = await fetch(`${API}${route}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(rest.headers ?? {}),
    },
  });
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: res.status, body: body as T, text, headers: res.headers };
}

export async function ensureUp(): Promise<void> {
  try {
    const res = await call('/health');
    if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
  } catch (err) {
    throw new Error(
      `Le lab ne répond pas sur ${API}.\n` +
        '  Lance-le dans un autre terminal :  npm run dev:api\n' +
        `  (${String(err)})`,
    );
  }
}

export const reset = () => call('/lab/reset', { method: 'POST' });

export async function login(email: string, password: unknown): Promise<string | null> {
  const res = await call<{ token?: string }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  return res.body?.token ?? null;
}

export async function devToken(): Promise<string> {
  const token = await login('dev@acme.example', 'dev');
  if (!token) throw new Error('Le compte dev@acme.example ne peut plus se connecter : la correction a cassé le cas légitime.');
  return token;
}

/** Forge un jeton non signé, comme le ferait un attaquant. */
export function forgeToken(claims: Record<string, unknown>, alg = 'none'): string {
  const b64 = (o: unknown) =>
    Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg, typ: 'JWT' })}.${b64(claims)}.`;
}

/** Un statut de refus : 4xx, quel que soit le code retenu par la correction. */
export const refused = (status: number) => status >= 400 && status < 500;

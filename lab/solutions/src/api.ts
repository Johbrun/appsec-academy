// Client HTTP du lab et état de session — version CORRIGÉE.

export interface SessionUser {
  email: string;
  name: string;
  role: string;
  tenantId: string;
}

const TOKEN_KEY = 'novafact-lab-token';
const USER_KEY = 'novafact-lab-user';

export const getToken = () => localStorage.getItem(TOKEN_KEY);

export function getUser(): SessionUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionUser;
  } catch {
    return null;
  }
}

export function setSession(token: string, user: SessionUser): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

// ── Audience ────────────────────────────────────────────────────────────────

/**
 * CORRIGÉ (secret-in-bundle) : plus aucune clé côté client. Le préfixe `VITE_`
 * est une DÉCLARATION DE PUBLICATION : tout ce qu'il désigne se retrouve en
 * clair dans le bundle, source maps ou non.
 *
 * Ce qui exige un secret passe par le serveur : le navigateur demande le ping,
 * le serveur le signe avec la clé qu'il est seul à détenir. Et la clé qui a été
 * publiée est RÉVOQUÉE — la retirer du code ne suffit pas, elle a déjà circulé.
 */
export function pingAnalytics(): void {
  void fetch('/api/surface/analytics').catch(() => {});
}

// ── Préférences d'affichage ─────────────────────────────────────────────────

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * CORRIGÉ (client-proto-pollution) : la cible est un objet SANS PROTOTYPE, les
 * clés spéciales sont refusées, et seules les clés attendues sont recopiées.
 *
 * Trois barrières, parce qu'une seule ne suffit jamais : pas de prototype à
 * polluer, pas de clé pour y arriver, pas de champ imprévu pour en sortir. La
 * quatrième est Trusted Types, qui transforme le passage par un puits DOM en
 * erreur d'exécution (voir src/main.tsx).
 */
const ALLOWED_PREF_KEYS = new Set(['compact', 'theme', 'density']);

function safeMerge(target: Record<string, unknown>, source: Record<string, unknown>): void {
  for (const key of Object.keys(source)) {
    if (FORBIDDEN_KEYS.has(key) || !ALLOWED_PREF_KEYS.has(key)) continue;
    const value = source[key];
    if (isObject(value)) continue; // les préférences sont plates, par construction
    target[key] = value;
  }
}

const prefs: Record<string, unknown> = Object.create(null);
let prefsLoaded = false;

export function loadPrefs(): Record<string, unknown> {
  if (prefsLoaded) return prefs;
  prefsLoaded = true;
  const q = location.hash.indexOf('?');
  if (q === -1) return prefs;
  const raw = new URLSearchParams(location.hash.slice(q + 1)).get('prefs');
  if (!raw) return prefs;
  try {
    safeMerge(prefs, JSON.parse(raw) as Record<string, unknown>);
  } catch {
    /* préférences illisibles : on garde les valeurs par défaut */
  }
  return prefs;
}

/**
 * Les préférences ne produisent plus d'attributs : elles produisent une classe
 * CSS, choisie dans un ensemble fini. Aucune donnée d'URL ne devient un nom
 * d'attribut, et encore moins un attribut d'événement.
 */
export function presentationFor(section: string): { className: string } {
  const compact = loadPrefs().compact === true;
  return { className: `section-${section}${compact ? ' compact' : ''}` };
}

// ── Base d'URL de l'API ─────────────────────────────────────────────────────

/**
 * CORRIGÉ (dom-clobbering) : la base est DÉCLARÉE ici, dans le module. Elle
 * n'est plus lue sur `window`, donc aucun élément nommé du DOM ne peut la
 * fabriquer. Le DOM écrit dans l'espace global : tout ce qu'on y lit sans
 * l'avoir écrit est une entrée attaquant.
 *
 * L'autre moitié du correctif est dans l'assainisseur des notes, qui ne doit
 * plus laisser passer `id` ni `name` — le DOM clobbering n'a pas besoin de
 * script pour opérer.
 */
const API_BASE = '/api';

export async function api<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    const message = (body as { error?: string })?.error ?? `HTTP ${res.status}`;
    throw Object.assign(new Error(message), { status: res.status, body });
  }
  return body as T;
}

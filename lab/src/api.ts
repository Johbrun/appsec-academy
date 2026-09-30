// Client HTTP du lab et état de session, volontairement minimal.
//
// Exercices portés par ce fichier :
//   · dom-clobbering ........... la base d'URL de l'API est lue sur `window`
//   · client-proto-pollution ... les préférences d'affichage du fragment d'URL
//                                sont fusionnées par un deepMerge maison
//   · secret-in-bundle ......... la clé d'audience est livrée dans le bundle

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

// ── Clé d'audience ──────────────────────────────────────────────────────────

/**
 * VULNÉRABLE (secret-in-bundle) : cette clé est livrée au navigateur. Le
 * préfixe `VITE_` est une DÉCLARATION DE PUBLICATION : Vite remplace la lecture
 * par la valeur littérale au moment du build, et la valeur se retrouve en clair
 * dans le bundle — que les source maps soient publiées ou non, elles ne font
 * qu'épargner la lecture du code minifié.
 *
 * Correctif attendu : ce qui exige un secret passe par le serveur (un endpoint
 * qui signe ou relaie), les source maps ne sont pas publiées, et la clé se
 * révoque — la retirer du code ne suffit pas, elle a déjà circulé.
 *
 * Valeur fictive et inerte : c'est un lab.
 */
export const ANALYTICS_KEY: string =
  (import.meta.env as unknown as Record<string, string | undefined>).VITE_NOVAFACT_ANALYTICS_KEY ??
  'nvf_live_pk_8Qd2LzR4mKx7Tb1eH0aS';

/** Ping d'audience, envoyé avec la clé publiée. */
export function pingAnalytics(): void {
  void fetch('/api/surface/analytics', { headers: { 'X-Novafact-Key': ANALYTICS_KEY } }).catch(() => {});
}

// ── Préférences d'affichage, lues dans le fragment d'URL ────────────────────

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * VULNÉRABLE (client-proto-pollution) : fusion récursive qui recopie toutes les
 * clés, y compris `__proto__`. `target['__proto__']` passe par l'accesseur et
 * renvoie Object.prototype : la descente écrit donc dans le prototype partagé
 * par tous les objets de la page.
 *
 * Le même défaut que côté serveur, avec des conséquences différentes : ici, le
 * gadget est le moteur de rendu. React recopie dans le DOM les propriétés qu'on
 * lui passe — y compris celles qu'il a trouvées sur le prototype.
 *
 * Correctif attendu : objets sans prototype (`Object.create(null)`) ou Map pour
 * les données venant du réseau ou de l'URL, refus des clés `__proto__`,
 * `constructor` et `prototype`, schéma strict. Puis une deuxième barrière :
 * Trusted Types, qui transforme le passage par un puits DOM en erreur
 * d'exécution.
 */
function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): void {
  for (const key of Object.keys(source)) {
    const value = source[key];
    if (isObject(value)) {
      if (!isObject(target[key])) target[key] = {};
      deepMerge(target[key] as Record<string, unknown>, value);
    } else {
      target[key] = value;
    }
  }
}

const prefs: Record<string, unknown> = {};
let prefsLoaded = false;

/** Les préférences déclarées dans le fragment : `#/invoices/INV-1001?prefs={…}`. */
export function loadPrefs(): Record<string, unknown> {
  if (prefsLoaded) return prefs;
  prefsLoaded = true;
  const q = location.hash.indexOf('?');
  if (q === -1) return prefs;
  const raw = new URLSearchParams(location.hash.slice(q + 1)).get('prefs');
  if (!raw) return prefs;
  try {
    deepMerge(prefs, JSON.parse(raw) as Record<string, unknown>);
  } catch {
    /* préférences illisibles : on garde les valeurs par défaut */
  }
  return prefs;
}

/**
 * Les attributs de présentation d'une section, tels que déclarés par les
 * préférences. `prefs[section]` n'existe pas : la lecture remonte la chaîne de
 * prototypes, et c'est tout ce dont la pollution a besoin.
 */
export function presentationFor(section: string): Record<string, unknown> {
  const p = loadPrefs()[section];
  return isObject(p) ? p : {};
}

// ── Base d'URL de l'API ─────────────────────────────────────────────────────

declare global {
  interface Window {
    /** Configuration injectée par le serveur… quand il l'injecte. */
    novafactConfig?: { apiBase?: string };
  }
}

/**
 * VULNÉRABLE (dom-clobbering) : la base d'URL est lue sur `window` sans avoir
 * jamais été déclarée. Or le DOM écrit dans l'espace global : tout élément
 * nommé — `id` ou `name` — y crée une variable. Deux ancres suffisent à
 * fabriquer `window.novafactConfig.apiBase`, et une ancre se convertit en
 * chaîne… par son `href`.
 *
 * Correctif attendu : déclarer la valeur (`const API_BASE = '/api'`), ou la lire
 * depuis un module, jamais depuis l'espace global. Et retirer `id` / `name` de
 * ce que l'assainisseur des notes laisse passer — le DOM clobbering n'a pas
 * besoin de script pour opérer.
 */
function apiBase(): string {
  return String(window.novafactConfig?.apiBase ?? '/api');
}

export async function api<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${apiBase()}${path}`, {
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

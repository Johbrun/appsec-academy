import type { Request, RequestHandler } from 'express';

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const notFound = () => new HttpError(404, 'Introuvable');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Défense CSRF en plus de SameSite=Lax : toute requête qui modifie l'état doit
 * venir d'une origine connue et déclarer du JSON (un formulaire HTML ne le peut pas).
 */
export function csrfGuard(allowedOrigins: string[]): RequestHandler {
  return (req, _res, next) => {
    if (SAFE_METHODS.has(req.method)) return next();
    const origin = req.get('origin');
    if (!origin || !allowedOrigins.includes(origin)) throw new HttpError(403, 'Origine non autorisée');
    if (!/^application\/json\s*(;|$)/i.test(req.get('content-type') ?? '')) {
      throw new HttpError(415, 'Content-Type application/json requis');
    }
    next();
  };
}

export type Body = Record<string, unknown>;

const isPlainObject = (v: unknown): v is Body => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Le corps doit être un objet JSON ; un corps absent vaut `{}`. */
export function bodyOf(req: Request): Body {
  const body: unknown = req.body ?? {};
  if (!isPlainObject(body)) throw new HttpError(400, 'Le corps doit être un objet JSON');
  return body;
}

export { isPlainObject };

// Caractères de contrôle (NUL, sauts de ligne, C1), séparateurs de ligne/paragraphe et marques d'inversion
// bidirectionnelle : invisibles ou trompeurs quand un enseignant lit un nom ou ouvre un export CSV.
const FORBIDDEN_CHARS = /[\u0000-\u001F\u007F-\u009F\u2028\u2029\u202A-\u202E\u2066-\u2069]/;

export function text(body: Body, key: string, label: string, min: number, max: number): string {
  const v = body[key];
  if (typeof v !== 'string') throw new HttpError(400, `${label} : texte attendu`);
  const s = v.trim();
  if (s.length < min || s.length > max) throw new HttpError(400, `${label} : entre ${min} et ${max} caractères`);
  if (FORBIDDEN_CHARS.test(s)) throw new HttpError(400, `${label} : caractères non autorisés`);
  return s;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Email normalisé (minuscules, sans espaces autour). `strict` vérifie aussi le format. */
export function email(body: Body, strict: boolean): string {
  const v = body.email;
  if (typeof v !== 'string') throw new HttpError(400, 'Email : texte attendu');
  const s = v.trim().toLowerCase();
  if (s.length < 1 || s.length > 254) throw new HttpError(400, 'Email : longueur invalide');
  if (FORBIDDEN_CHARS.test(s)) throw new HttpError(400, 'Email : caractères non autorisés');
  if (strict && !EMAIL_RE.test(s)) throw new HttpError(400, 'Email : format invalide');
  return s;
}

/** Les mots de passe ne sont jamais tronqués ni « nettoyés » ; la borne haute limite le coût du hachage. */
export function password(body: Body, key: string, label: string, min: number): string {
  const v = body[key];
  if (typeof v !== 'string') throw new HttpError(400, `${label} : texte attendu`);
  if (v.length < min || v.length > 128) throw new HttpError(400, `${label} : entre ${min} et 128 caractères`);
  return v;
}

export function integer(v: unknown, label: string, min: number): number {
  if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < min) throw new HttpError(400, `${label} : entier ≥ ${min} attendu`);
  return v;
}

/** Identifiant dans l'URL : uniquement des chiffres, sinon la ressource n'existe pas. */
export function idParam(v: unknown): number {
  if (typeof v !== 'string' || !/^[1-9]\d{0,14}$/.test(v)) throw notFound();
  return Number(v);
}

// CORRIGÉ de server/routes/auth.ts.
//
// Couvre nosql-auth, no-rate-limit, host-header, regex-unanchored,
// unicode-normalization, email-parsing-differential, user-enumeration,
// race-partial-construction, input-truncation, weak-random,
// reset-token-collision, timing-attack, open-redirect et xff-spoof.

import crypto from 'node:crypto';
import { Router } from 'express';
import type { Request } from 'express';
import { audit, db, sendMail } from '../store.ts';
import { audienceOf, markLoggedOut, resetJwtState, sign } from '../lib/jwt.ts';
import { Prefs, requireDirectoryAccess, requireUser, serializeNovaser } from '../lib/auth.ts';
import { resetOauthState } from './oauth.ts';
import { resetSamlState } from './saml.ts';
import type { User } from '../store.ts';

export const authRoutes = Router();

// CORRIGÉ (host-header) : l'origine publique vient de la configuration, jamais
// de la requête.
const PUBLIC_URL = process.env.PUBLIC_URL ?? 'http://127.0.0.1:5199';

const isString = (v: unknown): v is string => typeof v === 'string';

// ── Limitation de débit ─────────────────────────────────────────────────────
//
// CORRIGÉ (xff-spoof) : la clé de comptage réseau est l'adresse de la socket.
// Derrière un CDN, on lirait `X-Forwarded-For` à une position CONNUE de la
// chaîne — `app.set('trust proxy', <nombre exact de proxys>)` — ou l'en-tête
// signé du CDN. Jamais la première valeur, que le client écrit.
//
// CORRIGÉ (no-rate-limit) : et surtout, on limite AUSSI par compte. Le compte
// visé, lui, ne se falsifie pas : c'est la seule limite que le credential
// stuffing ne contourne pas en changeant d'adresse.

const IP_BUDGET = 100;
const IP_WINDOW_MS = 60_000;
const MAX_FAILURES = 10;
const LOCK_WINDOW_MS = 15 * 60_000;

const ipHits = new Map<string, { n: number; since: number }>();
const failures = new Map<string, { n: number; since: number }>();

const networkKey = (req: Request) => req.socket.remoteAddress ?? 'inconnu';

function bump(map: Map<string, { n: number; since: number }>, key: string, windowMs: number): number {
  const now = Date.now();
  const cur = map.get(key);
  const bucket = cur && now - cur.since < windowMs ? cur : { n: 0, since: now };
  bucket.n += 1;
  map.set(key, bucket);
  return bucket.n;
}

const counted = (map: Map<string, { n: number; since: number }>, key: string, windowMs: number) => {
  const cur = map.get(key);
  return cur && Date.now() - cur.since < windowMs ? cur.n : 0;
};

// ── Inscription ─────────────────────────────────────────────────────────────

const STAFF_DOMAIN = 'novafact.example';

// CORRIGÉ (regex-unanchored) : plus d'expression du tout. Le domaine est
// extrait par un découpage explicite et comparé PAR ÉGALITÉ à une liste. Une
// sous-chaîne ne peut plus satisfaire le contrôle, parce qu'il n'y a plus de
// recherche de sous-chaîne.
const TENANT_BY_DOMAIN: Record<string, { tenantId: string; role: User['role'] }> = {
  'acme.example': { tenantId: 'acme', role: 'user' },
  'globex.example': { tenantId: 'globex', role: 'user' },
  [STAFF_DOMAIN]: { tenantId: 'acme', role: 'accountant' },
};

/** Longueur maximale admise par le schéma d'entrée — et par la colonne. */
const EMAIL_MAX = 32;

let nextUserId = 100;

/**
 * CORRIGÉ (unicode-normalization, email-parsing-differential) : UNE seule
 * analyse de l'adresse, qui produit une forme canonique. Elle normalise avant
 * toute comparaison, refuse les adresses à plusieurs arobases (donc les
 * découpages divergents), et c'est cette forme — et elle seule — qui sert
 * ensuite à comparer, à ranger, à router le courrier et à décider du tenant.
 *
 * CORRIGÉ (input-truncation) : la longueur est une contrainte du schéma
 * d'entrée. Au-delà, on REFUSE ; aucune transformation ne suit la validation.
 */
function parseAddress(raw: string): { address: string; domain: string } | null {
  const address = raw.normalize('NFKC').toLowerCase().trim();
  if (address.length > EMAIL_MAX) return null;
  const parts = address.split('@');
  if (parts.length !== 2) return null;
  const [local, domain] = parts;
  if (!/^[a-z0-9!#$%&'*+/=?^_`{|}~.-]+$/.test(local)) return null;
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain)) return null;
  return { address, domain };
}

/**
 * CORRIGÉ (user-enumeration) : une seule réponse, quelle que soit l'issue. Le
 * détail part par e-mail à l'adresse concernée — « bienvenue » si le compte
 * vient d'être créé, « quelqu'un a tenté de s'inscrire avec votre adresse »
 * sinon. La réponse HTTP, elle, ne dit plus rien.
 */
const NEUTRAL = {
  ok: true,
  message: 'Si cette adresse peut être utilisée, un message vient de partir.',
};

authRoutes.post('/register', (req, res) => {
  const { email, password, name } = req.body ?? {};
  if (!isString(email) || !isString(password) || password.length < 3) {
    res.status(400).json({ error: 'email et password (3 caractères au moins) requis' });
    return;
  }

  const parsed = parseAddress(email);
  const grant = parsed ? TENANT_BY_DOMAIN[parsed.domain] : undefined;
  const selfService = parsed && parsed.domain !== STAFF_DOMAIN;

  if (parsed && grant && selfService && !db.users.some((u) => u.email === parsed.address)) {
    // CORRIGÉ (race-partial-construction) : l'enregistrement est construit
    // ENTIER avant d'être publié. Rien d'observable entre les deux, donc
    // aucune fenêtre. En base : une transaction, ou une insertion dans un état
    // `pending` que la connexion refuse.
    const user: User = {
      id: `u${(nextUserId += 1)}`,
      email: parsed.address,
      password,
      name: isString(name) && name.trim() ? name.trim() : parsed.address.split('@')[0],
      tenantId: grant.tenantId,
      role: grant.role,
      mfa: false,
    };
    db.users.push(user);
    audit(user.email, 'compte.créé', `tenant=${user.tenantId} rôle=${user.role}`);
    sendMail(
      user.email,
      'Bienvenue sur Novafact',
      `Bonjour ${user.name},\n\nVotre compte est actif sur l’espace ${user.tenantId}.`,
      'Amazon SES',
    );
  } else if (parsed) {
    sendMail(
      parsed.address,
      'Tentative d’inscription avec votre adresse',
      'Quelqu’un a tenté de créer un compte Novafact avec cette adresse.',
      'Amazon SES',
    );
  }

  res.status(202).json(NEUTRAL);
});

// ── Inscription partenaire ──────────────────────────────────────────────────

const PARTNER_ROOTS: Record<string, string> = {
  'acme.example': 'acme',
  'globex.example': 'globex',
};

const rootOf = (domain: string): string | undefined =>
  Object.keys(PARTNER_ROOTS).find((d) => domain === d || domain.endsWith(`.${d}`));

authRoutes.post('/register/partner', (req, res) => {
  const { email, password, name } = req.body ?? {};
  if (!isString(email) || !isString(password) || password.length < 3) {
    res.status(400).json({ error: 'email et password (3 caractères au moins) requis' });
    return;
  }
  // CORRIGÉ (input-truncation) : la longueur est contrôlée AVANT, et une
  // adresse trop longue est refusée — jamais raccourcie.
  const parsed = parseAddress(email);
  const root = parsed ? rootOf(parsed.domain) : undefined;
  if (!parsed || !root) {
    res.status(403).json({ error: 'adresse invalide ou domaine hors clients Novafact' });
    return;
  }
  if (db.users.some((u) => u.email === parsed.address)) {
    res.status(409).json({ error: 'cette adresse est déjà utilisée' });
    return;
  }

  // La valeur validée EST la valeur stockée : aucune transformation entre les
  // deux, donc rien ne peut changer le tenant après coup.
  const user: User = {
    id: `u${(nextUserId += 1)}`,
    email: parsed.address,
    password,
    name: isString(name) && name.trim() ? name.trim() : parsed.address.split('@')[0],
    tenantId: PARTNER_ROOTS[root],
    role: 'user',
    mfa: false,
  };
  db.users.push(user);
  audit(user.email, 'compte.créé', `partenaire ${root} tenant=${user.tenantId}`);
  res.status(201).json({ email: user.email, tenantId: user.tenantId, role: user.role });
});

// ── Connexion ───────────────────────────────────────────────────────────────

authRoutes.post('/login', (req, res) => {
  if (bump(ipHits, networkKey(req), IP_WINDOW_MS) > IP_BUDGET) {
    res.status(429).json({ error: 'trop de requêtes depuis cette adresse' });
    return;
  }

  const { email, password } = req.body ?? {};

  // CORRIGÉ (nosql-auth) : schéma avant la couche de données. Aucun objet ne
  // peut plus atteindre le moteur de requêtes, donc aucun opérateur ne peut
  // être injecté.
  if (!isString(email) || !isString(password)) {
    res.status(400).json({ error: 'email et password doivent être des chaînes' });
    return;
  }

  const account = email.normalize('NFKC').toLowerCase();
  if (counted(failures, account, LOCK_WINDOW_MS) >= MAX_FAILURES) {
    res.status(429).json({ error: 'trop de tentatives, réessayez plus tard' });
    return;
  }

  db.loginAttempts += 1;
  // CORRIGÉ (race-partial-construction) : un mot de passe vide n'est jamais une
  // correspondance valide, quel que soit l'état de l'enregistrement.
  const user =
    password.length > 0
      ? db.users.find((u) => u.email === account && u.password === password)
      : undefined;

  if (!user) {
    const n = bump(failures, account, LOCK_WINDOW_MS);
    audit(account, 'auth.échec', `tentative ${n}`);
    res.status(401).json({ error: 'identifiants invalides' });
    return;
  }
  failures.delete(account);

  audit(user.email, 'auth.succès', `rôle=${user.role}`);
  const body = {
    token: sign({ sub: user.email, role: user.role, tenantId: user.tenantId }),
    user: { email: user.email, name: user.name, role: user.role, tenantId: user.tenantId },
    attemptsBefore: 0,
  };

  // CORRIGÉ (open-redirect) : seul un CHEMIN relatif est accepté — il commence
  // par `/`, jamais par `//` ni par `/\`, et ne contient pas de schéma. Tout le
  // reste est ignoré silencieusement.
  const next = req.body?.next;
  if (isString(next)) {
    if (/^\/(?![/\\])[^\s]*$/.test(next)) {
      res.status(303).location(next).json(body);
      return;
    }
    res.status(400).json({ error: 'destination de retour invalide' });
    return;
  }

  res.json(body);
});

authRoutes.post('/logout', (req, res) => {
  const header = req.headers.authorization;
  // CORRIGÉ (session-not-revocable) : la déconnexion révoque le jeton côté
  // serveur. readToken() consulte cette liste à chaque lecture.
  if (header?.startsWith('Bearer ')) markLoggedOut(header.slice(7));
  res.setHeader('Set-Cookie', 'novafact_session=; Path=/; Max-Age=0');
  res.json({ ok: true, message: 'session fermée' });
});

// ── Réinitialisation de mot de passe ────────────────────────────────────────

interface Ticket {
  email: string;
  token: string;
  expiresAt: number;
  probes: number;
}

const tickets = new Map<string, Ticket>();
const TOKEN_TTL_MS = 15 * 60_000;
const MAX_PROBES = 5;

// CORRIGÉ (weak-random, reset-token-collision) : générateur cryptographique, et
// rien d'autre. 32 octets, donc aucune collision à redouter et aucun état à
// reconstruire. La fonction existe pour que `Math.random` ne soit plus à portée
// de main quand on génère un secret.
const secretToken = () => crypto.randomBytes(32).toString('hex');

authRoutes.post('/forgot', (req, res) => {
  const { email } = req.body ?? {};
  const account = isString(email) ? email.normalize('NFKC').toLowerCase() : '';
  const user = db.users.find((u) => u.email === account);

  if (user) {
    const token = secretToken();
    tickets.set(user.email, {
      email: user.email,
      token,
      expiresAt: Date.now() + TOKEN_TTL_MS,
      probes: 0,
    });
    const link = `${PUBLIC_URL}/reset?token=${token}&email=${encodeURIComponent(user.email)}`;
    sendMail(
      user.email,
      'Réinitialisation de votre mot de passe Novafact',
      `Bonjour ${user.name},\n\nPour choisir un nouveau mot de passe : ${link}\n\nCe lien expire dans quinze minutes.`,
      'Amazon SES',
    );
  }

  res.json({ ok: true, message: 'Si un compte existe, un mail vient de partir.' });
});

authRoutes.post('/reset', (req, res) => {
  const { email, token, password } = req.body ?? {};
  if (!isString(email) || !isString(token) || !isString(password)) {
    res.status(400).json({ error: 'email, token et password requis' });
    return;
  }

  const invalid = () => res.status(400).json({ error: 'jeton invalide ou expiré' });
  const ticket = tickets.get(email.normalize('NFKC').toLowerCase());
  if (!ticket || ticket.expiresAt < Date.now()) {
    invalid();
    return;
  }
  // Le nombre d'essais est borné : même un canal parfait ne donne plus le temps
  // de reconstituer quoi que ce soit.
  if ((ticket.probes += 1) > MAX_PROBES) {
    tickets.delete(ticket.email);
    invalid();
    return;
  }

  // CORRIGÉ (timing-attack) : comparaison à temps constant, sur des tampons de
  // longueur fixe. Elle ne s'arrête pas au premier écart, donc le temps de
  // réponse ne dit plus rien du préfixe.
  const a = Buffer.from(ticket.token, 'utf8');
  const b = Buffer.from(token, 'utf8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    invalid();
    return;
  }

  const target = db.users.find((u) => u.email === ticket.email);
  if (target) target.password = password;
  tickets.delete(ticket.email);
  audit(ticket.email, 'auth.réinitialisation', 'mot de passe changé par jeton');
  res.json({ ok: true });
});

// ── Annuaire du tenant ──────────────────────────────────────────────────────

authRoutes.get('/directory', requireDirectoryAccess, (req, res) => {
  const requested = String(req.query.tenant ?? req.user!.tenantId);
  const members = db.users
    .filter((u) => u.tenantId === requested)
    .map((u) => ({ email: u.email, name: u.name, role: u.role, mfa: u.mfa }));
  res.json({ tenant: requested, members });
});

// ── Déploiement par tenant ──────────────────────────────────────────────────

authRoutes.get('/deployment/:tenantId/whoami', requireUser, (req, res) => {
  const deployment = req.params.tenantId;
  const tenant = db.tenants.find((t) => t.id === deployment);
  if (!tenant) {
    res.status(404).json({ error: 'déploiement inconnu' });
    return;
  }

  // CORRIGÉ (jwt-no-audience) : vérifier l'audience fait partie de la
  // vérification, au même titre que la signature. Un jeton émis pour un autre
  // déploiement est refusé ici, même parfaitement signé.
  if (audienceOf((req.headers.authorization ?? '').slice(7)) !== deployment) {
    res.status(403).json({ error: 'ce jeton n’a pas été émis pour ce déploiement' });
    return;
  }

  res.json({ deployment, name: tenant.name, actor: req.user!.email, role: req.user!.role });
});

// ── Préférences d'affichage ─────────────────────────────────────────────────

authRoutes.get('/prefs', (req, res) => res.json(req.prefs ?? new Prefs()));

authRoutes.post('/prefs', (req, res) => {
  const prefs = new Prefs(req.body ?? {});
  const cookie = encodeURIComponent(serializeNovaser(prefs, 'Prefs'));
  res.setHeader('Set-Cookie', `novafact_prefs=${cookie}; Path=/; SameSite=Lax; HttpOnly`);
  res.json(prefs);
});

export const resetAuthState = (): void => {
  ipHits.clear();
  failures.clear();
  tickets.clear();
  nextUserId = 100;
  resetJwtState();
  resetOauthState();
  resetSamlState();
};

// Connexion, inscription, réinitialisation de mot de passe, annuaire.
//
// Exercices portés par ce fichier :
//   · nosql-auth                 opérateur Mongo passé en mot de passe
//   · no-rate-limit              les échecs sont comptés, jamais freinés
//   · host-header                l'origine du lien de réinitialisation
//   · regex-unanchored           liste blanche de domaines sans ancres
//   · unicode-normalization      unicité vérifiée avant normalisation
//   · email-parsing-differential deux découpages de la même adresse
//   · user-enumeration           l'inscription dit si un compte existe
//   · race-partial-construction  compte inséré avant son mot de passe
//   · input-truncation           adresse tronquée après validation
//   · weak-random                jeton tiré d'un générateur reconstructible
//   · reset-token-collision      deux demandes, une milliseconde, un jeton
//   · timing-attack              comparaison de jeton à temps variable
//   · open-redirect              paramètre de retour suivi tel quel
//   · xff-spoof                  limitation comptée sur X-Forwarded-For
//
// Et la surface HTTP de trois exercices dont le défaut vit dans server/lib/ :
// try-catch-fail-open et cookie-deserialization (lib/auth.ts),
// jwt-no-audience et session-not-revocable (lib/jwt.ts).

import { Router } from 'express';
import type { Request } from 'express';
import { audit, db, findOne, sendMail, solve } from '../store.ts';
import { audienceOf, markLoggedOut, resetJwtState, sign } from '../lib/jwt.ts';
import { Prefs, requireDirectoryAccess, requireUser, serializeNovaser } from '../lib/auth.ts';
import { resetOauthState } from './oauth.ts';
import { resetSamlState } from './saml.ts';
import type { User } from '../store.ts';

export const authRoutes = Router();

/** Tentatives d'authentification par compte. Comptées, mais jamais limitées. */
const attempts = new Map<string, number>();

// Les hôtes que l'application devrait accepter. Sert uniquement au lab à
// constater l'empoisonnement — le code vulnérable, lui, ne consulte rien.
const EXPECTED_HOSTS = new Set(['127.0.0.1', 'localhost', 'novafact.example']);

// ── Limitation de débit ─────────────────────────────────────────────────────
//
// C'est la SEULE limitation de l'application : elle compte par adresse IP. Il
// n'y a rien par compte (voir no-rate-limit), et l'adresse IP est lue dans un
// en-tête que le client écrit lui-même (voir xff-spoof).

const IP_BUDGET = 100;
const IP_WINDOW_MS = 60_000;
const ipHits = new Map<string, number>();
let ipWindow = { hits: 0, since: Date.now() };

/**
 * VULNÉRABLE (xff-spoof) : la clé de comptage est la PREMIÈRE valeur de
 * `X-Forwarded-For`, que le client contrôle entièrement. Il suffit de changer
 * l'en-tête à chaque requête pour ne jamais retomber dans le même compteur.
 *
 * Correctif attendu : derrière un CDN, la vraie adresse est à une position
 * connue de la chaîne — `trust proxy` réglé au nombre EXACT de proxys de
 * confiance (pas `true`), ou lecture de l'en-tête signé du CDN. Et limiter
 * aussi par compte, qui ne se falsifie pas.
 */
function rateKey(req: Request): string {
  const xff = req.headers['x-forwarded-for'];
  const first = (Array.isArray(xff) ? xff[0] : xff)?.split(',')[0]?.trim();
  return first || req.socket.remoteAddress || 'inconnu';
}

/** @returns true si la requête doit être refusée. */
function overBudget(req: Request): boolean {
  const now = Date.now();
  if (now - ipWindow.since > IP_WINDOW_MS) {
    ipWindow = { hits: 0, since: now };
    ipHits.clear();
  }
  ipWindow.hits += 1;

  const key = rateKey(req);
  const hits = (ipHits.get(key) ?? 0) + 1;
  ipHits.set(key, hits);
  if (hits > IP_BUDGET) return true;

  // Le lab constate le contournement : le budget d'une fenêtre entière a été
  // dépassé, personne n'a été refusé, et la clé de comptage a changé presque à
  // chaque requête. Seul un en-tête écrit par le client fait ça.
  if (ipWindow.hits > IP_BUDGET && ipHits.size > IP_BUDGET / 2 && req.headers['x-forwarded-for']) {
    audit(key, 'invariant.rompu', `${ipWindow.hits} connexions, ${ipHits.size} adresses annoncées`);
    solve('xff-spoof');
  }
  return false;
}

// ── Inscription ─────────────────────────────────────────────────────────────

/** Domaine du personnel Novafact : jamais auto-inscriptible. */
const STAFF_DOMAIN = 'novafact.example';

/** Domaines ouverts à l'inscription, et ce à quoi ils donnent droit. */
const TENANT_BY_KEY: Record<string, { tenantId: string; role: User['role'] }> = {
  acme: { tenantId: 'acme', role: 'user' },
  globex: { tenantId: 'globex', role: 'user' },
  novafact: { tenantId: 'acme', role: 'accountant' },
};

/**
 * VULNÉRABLE (regex-unanchored) : l'expression n'a pas d'ancres. Elle décrit
 * donc une SOUS-CHAÎNE, pas la valeur : `pirate@acme.example.attaquant.test`
 * la satisfait, et hérite du tenant qu'elle désigne.
 *
 * Correctif attendu : ancrer (`^…$`) — ou mieux, ne pas valider un domaine par
 * expression du tout : découper explicitement sur le dernier arobase et
 * comparer la partie droite par égalité à une liste.
 */
const SIGNUP_DOMAINS = /(acme|globex|novafact)\.example/i;

/** Compteur d'identifiants, pour que deux comptes créés ne se confondent pas. */
let nextUserId = 100;

/** Adresses dont l'inscription a confirmé l'existence. */
const probed = new Set<string>();

/** Simule l'appel au service de hachage : c'est la fenêtre de la course. */
const hashRoundtrip = () => new Promise((r) => setTimeout(r, 40));

authRoutes.post('/register', async (req, res) => {
  const { email, password, name } = req.body ?? {};
  if (typeof email !== 'string' || typeof password !== 'string' || password.length < 3) {
    res.status(400).json({ error: 'email et password (3 caractères au moins) requis' });
    return;
  }
  if (!/^[^\s@]+(?:@[^\s@]+)+$/.test(email)) {
    res.status(400).json({ error: 'adresse mal formée' });
    return;
  }

  const parts = email.split('@');

  // La forme canonique de l'adresse : c'est elle qu'on contrôle et qu'on range.
  const canonical = email.normalize('NFKC').toLowerCase();
  const cparts = canonical.split('@');
  const clast = cparts[cparts.length - 1];

  const match = SIGNUP_DOMAINS.exec(canonical);
  if (!match) {
    res.status(403).json({ error: 'ce domaine n’est pas ouvert à l’inscription' });
    return;
  }
  const grant = TENANT_BY_KEY[match[1].toLowerCase()];

  // VULNÉRABLE (user-enumeration) : la réponse distingue « déjà utilisée » de
  // « acceptée ». L'inscription devient un oracle d'existence, et alimente le
  // credential stuffing.
  //
  // Correctif attendu : même statut, même corps et même temps de réponse dans
  // les trois parcours (inscription, connexion, réinitialisation), et la
  // différence communiquée par e-mail à l'adresse concernée — jamais dans la
  // réponse HTTP.
  if (db.users.some((u) => u.email === email)) {
    probed.add(email);
    // Le lab constate : l'oracle a servi à confirmer plusieurs comptes.
    if (probed.size >= 3) {
      audit('inconnu', 'invariant.rompu', `${probed.size} comptes confirmés par /register`);
      solve('user-enumeration');
    }
    res.status(409).json({ error: 'cette adresse est déjà utilisée' });
    return;
  }

  // Les comptes du personnel Novafact sont provisionnés par l'IT.
  //
  // VULNÉRABLE (email-parsing-differential) : ce garde-fou découpe sur le
  // PREMIER arobase (`parts[1]`), et sur l'adresse brute. L'appartenance au
  // tenant, elle, vient de l'expression appliquée à la forme canonique — donc
  // du domaine de FIN. Deux composants qui analysent la même chaîne
  // différemment forment une faille d'authentification.
  //
  // Correctif attendu : une seule bibliothèque d'analyse, une forme canonique
  // stockée, une seule lecture du domaine — et l'appartenance au tenant décidée
  // par une invitation, pas devinée depuis un domaine. *Splitting the email
  // atom*, Gareth Heyes, 2024.
  if (parts[1]?.toLowerCase() === STAFF_DOMAIN) {
    res.status(403).json({ error: 'les comptes Novafact sont provisionnés par l’IT' });
    return;
  }

  // VULNÉRABLE (unicode-normalization) : l'unicité vient d'être vérifiée sur
  // l'adresse BRUTE ; la forme rangée, elle, est normalisée NFKC puis mise en
  // minuscules. Deux couches qui normalisent différemment, c'est une faille
  // d'authentification : `admin@ｎｏｖａｆａｃｔ.example` passe le contrôle
  // d'unicité et se range sous `admin@novafact.example`.
  //
  // Correctif attendu : normaliser AVANT de comparer, une seule fois, stocker
  // la forme normalisée et poser l'unicité dessus. Pièges connus : le İ turc
  // sous toLowerCase, les équivalences NFKC, les caractères invisibles.
  const stored = canonical;
  const collides = db.users.some((u) => u.email === stored);

  // La couche d'envoi, elle, découpe sur le premier arobase : tout ce qui suit
  // est le domaine de destination.
  const mailTo = cparts.slice(0, 2).join('@');

  const user: User = {
    id: `u${(nextUserId += 1)}`,
    email: stored,
    // VULNÉRABLE (race-partial-construction) : l'enregistrement est inséré
    // AVANT que son mot de passe soit écrit. Pendant l'aller-retour vers le
    // service de hachage, le champ est vide — et la comparaison de /login
    // laisse passer une valeur absente au lieu de la refuser.
    //
    // Correctif attendu : créer en une transaction, ou insérer d'abord dans un
    // état inutilisable (`status = 'pending'`) et n'activer qu'ensuite. Et une
    // comparaison de mot de passe qui refuse une valeur vide.
    // *Partial construction*, Smashing the state machine, 2025.
    password: '',
    name: typeof name === 'string' && name.trim() ? name.trim() : stored.split('@')[0],
    tenantId: grant.tenantId,
    role: grant.role,
    mfa: false,
  };
  db.users.push(user);
  await hashRoundtrip();
  user.password = password;

  // ── Le lab constate, une fois le compte réellement créé ──────────────────

  if (cparts.length === 2 && clast !== match[0]) {
    audit(stored, 'invariant.rompu', `domaine ${clast} accepté par la sous-chaîne ${match[0]}`);
    solve('regex-unanchored');
  }
  if (cparts.length > 2 && cparts[1] !== clast) {
    audit(stored, 'invariant.rompu', `tenant lu sur ${clast}, courrier envoyé vers ${cparts[1]}`);
    solve('email-parsing-differential');
  }
  if (collides) {
    audit(stored, 'invariant.rompu', `deux comptes résolvent vers ${stored}`);
    solve('unicode-normalization');
  }

  sendMail(
    mailTo,
    'Bienvenue sur Novafact',
    `Bonjour ${user.name},\n\nVotre compte est actif sur l’espace ${user.tenantId}.\nRôle attribué : ${user.role}.`,
    'Amazon SES',
  );
  audit(stored, 'compte.créé', `tenant=${user.tenantId} rôle=${user.role}`);
  res.status(201).json({
    email: user.email,
    name: user.name,
    tenantId: user.tenantId,
    role: user.role,
  });
});

// ── Inscription partenaire ──────────────────────────────────────────────────
//
// Les clients ont des sous-domaines (`compta.acme.example`, `fr.globex.example`)
// : ce parcours les accepte, contrairement au libre-service.

/** Largeur de la colonne `email` en base. Historique, jamais migrée. */
const EMAIL_COLUMN = 32;

const PARTNER_ROOTS: Record<string, string> = {
  'acme.example': 'acme',
  'globex.example': 'globex',
};

/** Le domaine racine dont relève ce domaine, sous-domaines compris. */
const rootOf = (domain: string): string | undefined =>
  Object.keys(PARTNER_ROOTS).find((d) => domain === d || domain.endsWith(`.${d}`));

authRoutes.post('/register/partner', (req, res) => {
  const { email, password, name } = req.body ?? {};
  if (typeof email !== 'string' || typeof password !== 'string' || password.length < 3) {
    res.status(400).json({ error: 'email et password (3 caractères au moins) requis' });
    return;
  }
  const address = email.toLowerCase();
  const validated = rootOf(address.split('@').pop() ?? '');
  if (!validated) {
    res.status(403).json({ error: 'ce domaine ne relève d’aucun client Novafact' });
    return;
  }
  if (db.users.some((u) => u.email === address)) {
    res.status(409).json({ error: 'cette adresse est déjà utilisée' });
    return;
  }

  // VULNÉRABLE (input-truncation) : l'adresse validée est ensuite ramenée à la
  // largeur de la colonne. Toute transformation POSTÉRIEURE à la validation
  // invalide la validation — ici elle change le domaine, donc le client, donc
  // le tenant de rattachement.
  //
  // Correctif attendu : la longueur est une contrainte du schéma d'ENTRÉE, pas
  // de la base : au-delà, on REFUSE, on ne corrige pas en silence. Et la valeur
  // validée est la valeur stockée, sans transformation intermédiaire.
  const stored = address.slice(0, EMAIL_COLUMN);
  const effective = rootOf(stored.split('@').pop() ?? '') ?? validated;
  const tenantId = PARTNER_ROOTS[effective];

  const user: User = {
    id: `u${(nextUserId += 1)}`,
    email: stored,
    password,
    name: typeof name === 'string' && name.trim() ? name.trim() : stored.split('@')[0],
    tenantId,
    role: 'user',
    mfa: false,
  };
  db.users.push(user);

  // Le lab constate : le compte est rattaché à un client que l'adresse validée
  // ne désignait pas.
  if (effective !== validated) {
    audit(stored, 'invariant.rompu', `validé pour ${validated}, rattaché à ${effective}`);
    solve('input-truncation');
  }

  audit(stored, 'compte.créé', `partenaire ${effective} tenant=${tenantId}`);
  res.status(201).json({ email: user.email, tenantId: user.tenantId, role: user.role });
});

// ── Connexion ───────────────────────────────────────────────────────────────

authRoutes.post('/login', (req, res) => {
  if (overBudget(req)) {
    res.status(429).json({ error: 'trop de requêtes depuis cette adresse' });
    return;
  }

  const { email, password } = req.body ?? {};

  // VULNÉRABLE (nosql-auth) : le corps de la requête part tel quel dans la
  // requête de données. Si password est un objet, ses clés sont interprétées
  // comme des opérateurs.
  //
  // Correctif attendu : valider par schéma (zod/ajv) avant cette ligne, imposer
  // typeof string, refuser toute clé commençant par $.
  const user = findOne(db.users as unknown as Record<string, unknown>[], { email, password }) as
    | User
    | undefined;

  db.loginAttempts += 1;
  const key = typeof email === 'string' ? email : '?';

  if (!user) {
    attempts.set(key, (attempts.get(key) ?? 0) + 1);
    // VULNÉRABLE (no-rate-limit) : on compte, on ne ralentit pas, on ne
    // verrouille pas, on ne défie pas. Aucun signal n'est émis non plus.
    audit(key, 'auth.échec', `tentative ${attempts.get(key)}`);
    res.status(401).json({ error: 'identifiants invalides' });
    return;
  }

  // Le lab constate l'injection : un opérateur a été passé là où une chaîne
  // était attendue, et la requête a quand même renvoyé un compte.
  if (typeof password !== 'string' || typeof email !== 'string') {
    solve('nosql-auth');
  }

  // Le lab constate la course : le compte trouvé n'a pas encore de mot de passe.
  if (user.password === '') {
    audit(user.email, 'invariant.rompu', 'session ouverte sur un compte à moitié construit');
    solve('race-partial-construction');
  }

  // Le lab constate la force brute : succès après une rafale d'échecs.
  // Le mot de passe cible est en 33e position de la wordlist ; le seuil est
  // placé en deçà pour que la rafale soit reconnue sans ambiguïté.
  const failed = attempts.get(key) ?? 0;
  if (failed >= 20 && typeof password === 'string') {
    solve('no-rate-limit');
  }
  attempts.delete(key);

  audit(user.email, 'auth.succès', `rôle=${user.role}`);
  const body = {
    token: sign({ sub: user.email, role: user.role, tenantId: user.tenantId }),
    user: { email: user.email, name: user.name, role: user.role, tenantId: user.tenantId },
    attemptsBefore: failed,
  };

  const next = typeof req.body?.next === 'string' ? req.body.next : undefined;
  if (next) {
    // VULNÉRABLE (open-redirect) : la destination de retour vient du client et
    // est suivie telle quelle. Une redirection ouverte est rarement isolée :
    // elle sert de tremplin au vol de code OAuth et au contournement de filtres
    // SSRF.
    //
    // Correctif attendu : n'accepter qu'un CHEMIN relatif (commençant par `/`
    // et pas par `//`), ou une liste blanche de destinations — jamais une URL
    // absolue reprise du client.
    let host = '';
    try {
      host = new URL(next, `http://${req.headers.host ?? '127.0.0.1'}`).hostname;
    } catch {
      host = '';
    }
    if (host && !EXPECTED_HOSTS.has(host)) {
      audit(user.email, 'invariant.rompu', `redirection après connexion vers ${host}`);
      solve('open-redirect');
    }
    res.status(303).location(next).json(body);
    return;
  }

  res.json(body);
});

authRoutes.post('/logout', (req, res) => {
  const header = req.headers.authorization;
  // VULNÉRABLE (session-not-revocable) : la déconnexion efface le cookie du
  // navigateur, et c'est tout. Le jeton présenté reste accepté par readToken(),
  // qui ne consulte ni liste de révocation ni date d'expiration.
  // `markLoggedOut` ne sert qu'au lab, à constater la réutilisation.
  if (header?.startsWith('Bearer ')) markLoggedOut(header.slice(7));
  res.setHeader('Set-Cookie', 'novafact_session=; Path=/; Max-Age=0');
  res.json({ ok: true, message: 'session fermée côté navigateur' });
});

// ── Réinitialisation de mot de passe ────────────────────────────────────────

interface Ticket {
  email: string;
  token: string;
  probes: number;
  bestPrefix: number;
}

const tickets = new Map<string, Ticket>();
/** Jetons soumis à /reset et refusés. Sert au lab à constater la prédiction. */
const guesses = new Set<string>();

/**
 * VULNÉRABLE (weak-random) : xorshift32 amorcé sur l'horloge. Non
 * cryptographique : son état tient sur 32 bits, et la sortie EST l'état — une
 * seule valeur observée suffit donc à reconstituer toute la suite.
 * `Math.random()` a exactement le même défaut avec 128 bits d'état : ce n'est
 * pas plus imprévisible, c'est seulement plus long à reconstruire.
 *
 * VULNÉRABLE (reset-token-collision) : le générateur n'avance qu'une fois par
 * milliseconde. Deux demandes traitées dans la même milliseconde reçoivent le
 * MÊME jeton, y compris quand elles visent deux comptes différents.
 *
 * Correctif attendu : `crypto.randomBytes(32).toString('hex')` et rien d'autre,
 * derrière une fonction maison pour que le mauvais choix ne soit plus à portée
 * de main. L'unicité se garantit par une contrainte en base, pas par l'espoir
 * que deux appels ne tombent pas au même instant. Et le jeton expire.
 */
let prngState = Date.now() >>> 0;
let lastMint = 0;
let lastToken = '';

function mintResetToken(): string {
  const now = Date.now();
  if (now === lastMint) return lastToken;
  lastMint = now;
  let x = prngState;
  x ^= x << 13;
  x >>>= 0;
  x ^= x >>> 17;
  x ^= x << 5;
  x >>>= 0;
  prngState = x;
  lastToken = x.toString(16).padStart(8, '0');
  return lastToken;
}

authRoutes.post('/forgot', (req, res) => {
  const { email } = req.body ?? {};
  const user = typeof email === 'string' ? db.users.find((u) => u.email === email) : undefined;

  // VULNÉRABLE (host-header) : l'origine du lien absolu vient de la requête.
  // Express renseigne req.hostname depuis X-Forwarded-Host dès que « trust
  // proxy » est actif (il l'est dans server/index.ts, comme derrière un ALB).
  //
  // Correctif attendu : origine issue de la configuration
  // (process.env.PUBLIC_URL), jamais de la requête.
  const host = String(req.headers['x-forwarded-host'] ?? req.headers.host ?? 'localhost');
  const token = mintResetToken();

  // Le lab constate la prédiction : ce jeton avait déjà été soumis à /reset,
  // avant même d'exister.
  if (guesses.has(token)) {
    audit(String(email), 'invariant.rompu', `jeton ${token} deviné avant émission`);
    solve('weak-random');
  }

  if (user) {
    // Le lab constate la collision : ce jeton est déjà celui d'un autre compte.
    for (const t of tickets.values()) {
      if (t.token === token && t.email !== user.email) {
        audit(user.email, 'invariant.rompu', `jeton ${token} partagé avec ${t.email}`);
        solve('reset-token-collision');
      }
    }
    tickets.set(user.email, { email: user.email, token, probes: 0, bestPrefix: 0 });

    const link = `http://${host}/reset?token=${token}&email=${encodeURIComponent(user.email)}`;
    sendMail(
      user.email,
      'Réinitialisation de votre mot de passe Novafact',
      `Bonjour ${user.name},\n\nPour choisir un nouveau mot de passe : ${link}\n\nCe lien expire dans une heure.`,
      'Amazon SES',
    );
    const bare = host.split(':')[0];
    if (!EXPECTED_HOSTS.has(bare)) solve('host-header');
  }

  // Réponse identique que le compte existe ou non : ce contrôle-là est correct.
  res.json({ ok: true, message: 'Si un compte existe, un mail vient de partir.' });
});

/** Aller-retour vers l'index des jetons, payé pour chaque caractère validé. */
const indexLookup = () => new Promise((r) => setTimeout(r, 4));

authRoutes.post('/reset', async (req, res) => {
  const { email, token, password } = req.body ?? {};
  if (typeof email !== 'string' || typeof token !== 'string' || typeof password !== 'string') {
    res.status(400).json({ error: 'email, token et password requis' });
    return;
  }

  const ticket = tickets.get(email.toLowerCase());
  if (!ticket) {
    guesses.add(token);
    res.status(400).json({ error: 'jeton invalide ou expiré' });
    return;
  }

  // VULNÉRABLE (timing-attack) : comparaison caractère par caractère qui
  // s'arrête au premier écart, et dont chaque caractère validé coûte un
  // aller-retour vers l'index. Le temps de réponse trahit donc la longueur du
  // préfixe correct, et le jeton se reconstitue caractère par caractère.
  //
  // En production ce coût par caractère est de l'ordre de la nanoseconde : le
  // canal existe quand même, il faut seulement des milliers de mesures au lieu
  // de quelques centaines. Il est amplifié ici pour être mesurable à la main.
  //
  // Correctif attendu : `crypto.timingSafeEqual` sur des tampons de longueur
  // fixe, ou comparaison d'empreintes plutôt que de secrets. Et un jeton assez
  // court-vécu, à usage unique et à nombre d'essais limité pour que la mesure
  // n'ait pas le temps d'aboutir.
  const priorProbes = ticket.probes;
  const priorPrefix = ticket.bestPrefix;

  let prefix = 0;
  let ok = token.length === ticket.token.length;
  if (ok) {
    for (; prefix < ticket.token.length; prefix += 1) {
      if (token[prefix] !== ticket.token[prefix]) {
        ok = false;
        break;
      }
      await indexLookup();
    }
  }

  ticket.probes += 1;
  if (prefix > ticket.bestPrefix) ticket.bestPrefix = prefix;

  if (!ok) {
    guesses.add(token);
    res.status(400).json({ error: 'jeton invalide ou expiré' });
    return;
  }

  // Le lab constate la fouille : le jeton a été reconstitué préfixe après
  // préfixe, par une rafale d'essais, et non reçu par courrier.
  if (priorProbes >= 24 && priorPrefix >= 6) {
    audit(ticket.email, 'invariant.rompu', `jeton reconstitué en ${priorProbes} essais`);
    solve('timing-attack');
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

  // Le lab constate : le moteur d'autorisation a levé, la requête a continué,
  // et l'annuaire d'un autre tenant part dans la réponse.
  if (req.authzSkipped && requested !== req.user!.tenantId) {
    audit(req.user!.email, 'invariant.rompu', `annuaire de ${requested} servi à ${req.user!.tenantId}`);
    solve('try-catch-fail-open');
  }

  res.json({ tenant: requested, members });
});

// ── Déploiement par tenant ──────────────────────────────────────────────────
//
// Chaque client a son déploiement (acme.novafact.example, globex.novafact…).
// Même code, même binaire — et, comme on va le voir, même clé de signature.

authRoutes.get('/deployment/:tenantId/whoami', requireUser, (req, res) => {
  const deployment = req.params.tenantId;
  const tenant = db.tenants.find((t) => t.id === deployment);
  if (!tenant) {
    res.status(404).json({ error: 'déploiement inconnu' });
    return;
  }

  // Le lab constate : un jeton émis par un autre déploiement vient d'être
  // accepté ici. Rien dans le jeton ne dit à qui il était destiné — ni `aud`,
  // ni `iss` — et la clé est la même partout. Le défaut est dans
  // server/lib/jwt.ts (jwt-no-audience) ; ce point d'entrée ne fait que le
  // rendre visible.
  const minted = audienceOf((req.headers.authorization ?? '').slice(7));
  if (minted && minted !== deployment) {
    audit(req.user!.email, 'invariant.rompu', `jeton de ${minted} accepté sur ${deployment}`);
    solve('jwt-no-audience');
  }

  res.json({
    deployment,
    name: tenant.name,
    actor: req.user!.email,
    role: req.user!.role,
  });
});

// ── Préférences d'affichage ─────────────────────────────────────────────────

authRoutes.get('/prefs', (req, res) => res.json(req.prefs ?? new Prefs()));

authRoutes.post('/prefs', (req, res) => {
  const prefs = new Prefs(req.body ?? {});
  const cookie = encodeURIComponent(serializeNovaser(prefs, 'Prefs'));
  res.setHeader('Set-Cookie', `novafact_prefs=${cookie}; Path=/; SameSite=Lax`);
  res.json(prefs);
});

/** Remis à zéro par /api/lab/reset : ces états vivent hors des données. */
export const resetAuthState = (): void => {
  attempts.clear();
  ipHits.clear();
  ipWindow = { hits: 0, since: Date.now() };
  probed.clear();
  tickets.clear();
  guesses.clear();
  nextUserId = 100;
  resetJwtState();
  resetOauthState();
  resetSamlState();
};

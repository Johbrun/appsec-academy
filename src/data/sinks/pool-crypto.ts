// Crypto, identité, sortie réseau et disponibilité — extraits du jeu Spot the Sink.

import type { Snippet } from './types';

/** Les CWE qu'introduit ce fichier, ajoutées au catalogue du jeu. */
export const cwe: Record<string, string> = {
  'CWE-208': 'Fuite d’information par écart de temps d’exécution',
  'CWE-209': 'Message d’erreur qui révèle des informations',
  'CWE-294': 'Contournement d’authentification par rejeu',
  'CWE-330': 'Utilisation de valeurs insuffisamment aléatoires',
  'CWE-338': 'Générateur pseudo-aléatoire non cryptographique',
  'CWE-347': 'Vérification incorrecte d’une signature',
  'CWE-532': 'Insertion d’informations sensibles dans un journal',
  'CWE-613': 'Expiration de session insuffisante',
  'CWE-636': 'Échec non sécurisé (fail open)',
  'CWE-770': 'Allocation de ressources sans limite',
  'CWE-916': 'Empreinte de mot de passe à effort de calcul insuffisant',
  'CWE-918': 'Server-side request forgery',
  'CWE-1333': 'Regex à complexité excessive (ReDoS)',
  'CWE-20': 'Validation d’entrée incorrecte',
};

export const snippets: Snippet[] = [
  // ————————————————————————————————— niveau 1 —————————————————————————————————
  {
    id: 'n1-session-jwt-decode',
    level: 1,
    file: 'middleware/session.ts',
    lang: 'ts',
    line: 11,
    cwe: 'CWE-347',
    options: ['CWE-347', 'CWE-613', 'CWE-208', 'CWE-330'],
    code: `import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import { db } from '../lib/db';

const SESSION_SECRET = process.env.SESSION_SECRET!;

export async function loadSession(req: Request, res: Response, next: NextFunction) {
  const header = req.get('authorization') ?? '';
  if (!header.startsWith('Bearer ')) return res.status(401).json({ error: 'jeton absent' });

  const claims = jwt.decode(header.slice(7)) as { sub?: string; tid?: string } | null;
  if (!claims?.sub || !claims.tid) return res.status(401).json({ error: 'jeton illisible' });

  const user = await db.users.findActive(claims.sub, claims.tid);
  if (!user) return res.status(401).json({ error: 'session expirée' });

  req.user = { id: user.id, tenantId: user.tenantId, role: user.role };
  next();
}`,
    explain:
      'jwt.decode lit la charge utile sans jamais toucher à la signature : n’importe qui peut fabriquer un jeton avec le sub et le tid de son choix, et la recherche en base le confirmera puisque l’utilisateur visé existe. Le secret déclaré en haut du fichier n’est utilisé nulle part — c’est le symptôme. La classe de bugs est « deux fonctions à un caractère près, l’une vérifie et l’autre non » : le correctif structurel est d’interdire l’import direct de la bibliothèque et de n’exposer qu’un module maison verifySessionToken(), impossible à appeler sans clé ni liste d’algorithmes.',
  },
  {
    id: 'n1-api-key-random',
    level: 1,
    file: 'routes/api-keys.ts',
    lang: 'ts',
    line: 14,
    cwe: 'CWE-338',
    options: ['CWE-338', 'CWE-208', 'CWE-916', 'CWE-330'],
    code: `import { Router } from 'express';
import { db } from '../lib/db';
import { sha256 } from '../lib/hash';
import { requireRole } from '../lib/auth';

export const router = Router();

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

router.post('/api-keys', requireRole('admin'), async (req, res) => {
  const label = String(req.body?.label ?? '').slice(0, 60);

  let secret = 'nf_';
  for (let i = 0; i < 32; i++) secret += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];

  await db.apiKeys.insert({ tenantId: req.user.tenantId, label, digest: sha256(secret) });

  res.status(201).json({ label, secret });
});`,
    explain:
      'La clé fait trente-deux caractères, mais Math.random tire dans un générateur déterministe dont l’état interne se reconstitue à partir de quelques sorties observées : un attaquant qui crée une clé pour son propre tenant peut prédire celles générées juste après pour les autres. La longueur n’a jamais été la mesure de l’entropie. Le correctif structurel est de bannir Math.random du code serveur par une règle de lint et de faire passer tout secret par un unique helper randomToken() bâti sur crypto.randomBytes.',
  },
  {
    id: 'n1-webhook-hmac-compare',
    level: 1,
    file: 'routes/webhooks.ts',
    lang: 'ts',
    line: 12,
    cwe: 'CWE-208',
    options: ['CWE-208', 'CWE-347', 'CWE-294', 'CWE-330'],
    code: `import crypto from 'node:crypto';
import { Router, raw } from 'express';
import { enqueue } from '../lib/queue';

const PROVIDER_SECRET = process.env.PAYMENTS_WEBHOOK_SECRET!;
export const router = Router();

router.post('/webhooks/payments', raw({ type: 'application/json' }), (req, res) => {
  const signature = req.get('x-provider-signature') ?? '';
  const expected = crypto.createHmac('sha256', PROVIDER_SECRET).update(req.body).digest('hex');

  if (signature !== expected) return res.status(401).json({ error: 'signature invalide' });

  const event = JSON.parse(req.body.toString('utf8'));
  enqueue('payments.event', { id: event.id, type: event.type, tenantId: event.tenant_id });

  res.json({ received: true });
});`,
    explain:
      'La signature est bien recalculée sur le corps brut, avec le bon algorithme et le bon secret — mais !== sur des chaînes s’arrête au premier caractère qui diffère, et ce temps d’arrêt se mesure. En rejouant la même requête des milliers de fois, un attaquant reconstruit la signature caractère par caractère sans jamais connaître le secret. La comparaison de tout ce qui est secret passe par crypto.timingSafeEqual sur des Buffer de même longueur ; le correctif structurel est d’enfermer la vérification dans un verifyWebhook() unique, pour que personne n’écrive jamais cette comparaison à la main.',
  },
  {
    id: 'n1-password-fast-hash',
    level: 1,
    file: 'services/accounts.ts',
    lang: 'ts',
    line: 15,
    cwe: 'CWE-916',
    options: ['CWE-916', 'CWE-338', 'CWE-208', 'CWE-330'],
    code: `import crypto from 'node:crypto';
import { db } from '../lib/db';

export interface NewAccount {
  email: string;
  password: string;
  tenantId: string;
}

export async function createAccount(input: NewAccount) {
  const email = input.email.trim().toLowerCase();
  if (input.password.length < 12) throw new Error('mot de passe trop court');

  const salt = crypto.randomBytes(16).toString('hex');
  const digest = crypto.createHash('sha256').update(salt + input.password).digest('hex');

  return db.users.insert({
    email,
    tenantId: input.tenantId,
    passwordHash: \`sha256\$\$\{salt}\$\$\{digest}\`,
    createdAt: new Date(),
  });
}`,
    explain:
      'Le sel est présent, aléatoire et propre à chaque compte — il fait son travail, qui est d’interdire les tables précalculées et de masquer les mots de passe identiques. Ce qu’il ne fait pas, c’est ralentir l’attaquant : SHA-256 se calcule par milliards par seconde sur un GPU, et une base volée se déroule en quelques heures. Un mot de passe se hache avec une fonction à coût réglable — argon2id, ou bcrypt à défaut — et le correctif structurel est un module hashPassword()/verifyPassword() qui embarque les paramètres et sait les augmenter avec le temps.',
  },
  {
    id: 'n1-login-log-body',
    level: 1,
    file: 'routes/auth.ts',
    lang: 'ts',
    line: 12,
    cwe: 'CWE-532',
    options: ['CWE-532', 'CWE-209', 'CWE-208', 'CWE-613'],
    code: `import { Router } from 'express';
import { logger } from '../lib/logger';
import { verifyPassword, issueSession } from '../services/accounts';
import { rateLimit } from '../lib/rate-limit';

export const router = Router();

router.post('/auth/login', rateLimit({ perIp: 10, windowMs: 60_000 }), async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const password = String(req.body?.password ?? '');

  logger.info({ route: 'auth.login', body: req.body }, 'tentative de connexion');

  const user = await verifyPassword(email, password);
  if (!user) return res.status(401).json({ error: 'identifiants invalides' });

  const session = await issueSession(user);
  res.cookie('nf_sid', session.token, { httpOnly: true, secure: true, sameSite: 'lax' });
  res.json({ ok: true });
});`,
    explain:
      'Journaliser le corps complet d’une requête de connexion écrit le mot de passe en clair dans un fichier qui part vers l’agrégateur de logs, y est conservé un an et se lit sans être administrateur de la base. Le journal est un canal de sortie comme un autre, et l’objet req.body n’a pas de contrat : le jour où le formulaire gagne un champ, il part aussi. Le correctif structurel est un logger qui n’accepte que des champs nommés, plus une liste de clés expurgées (password, token, authorization, iban) appliquée au niveau du sérialiseur — pas à la vigilance de l’auteur de chaque appel.',
  },

  // ————————————————————————————————— niveau 2 —————————————————————————————————
  {
    id: 'n2-partner-jwt-alg',
    level: 2,
    file: 'middleware/partner-auth.ts',
    lang: 'ts',
    line: 23,
    cwe: 'CWE-347',
    options: ['CWE-347', 'CWE-338', 'CWE-208', 'CWE-636'],
    decoys: [12, 24],
    code: `import fs from 'node:fs';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import { db } from '../lib/db';
import { logger } from '../lib/logger';

const PARTNER_PUBLIC_KEY = fs.readFileSync(process.env.PARTNER_JWT_PUBLIC_KEY!, 'utf8');

/** Identifiant d'affichage : relie entre elles les traces d'un même lot d'appels. */
function traceId(): string {
  return 'trc_' + Math.random().toString(36).slice(2, 10);
}

export async function partnerAuth(req: Request, res: Response, next: NextFunction) {
  const token = (req.get('authorization') ?? '').replace(/^Bearer /, '');
  if (!token) return res.status(401).json({ error: 'jeton absent' });

  const header = JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString('utf8'));

  let claims: jwt.JwtPayload;
  try {
    claims = jwt.verify(token, PARTNER_PUBLIC_KEY, { algorithms: [header.alg] }) as jwt.JwtPayload;
  } catch {
    return res.status(401).json({ error: 'jeton refusé' });
  }

  const partner = await db.partners.findActive(String(claims.sub));
  if (!partner) return res.status(403).json({ error: 'partenaire inconnu' });

  const fingerprint = crypto.createHash('sha256').update(token).digest('hex');
  logger.info({ trace: traceId(), partner: partner.id, fingerprint }, 'appel partenaire');

  req.partner = partner;
  next();
}`,
    explain:
      'La liste des algorithmes acceptés est lue dans l’en-tête du jeton, c’est-à-dire dans la partie que l’attaquant écrit lui-même. Le partenaire signe en RS256 avec sa clé privée ; l’attaquant, lui, annonce alg: HS256 et signe en HMAC avec la clé publique — qui est publique — et jwt.verify valide. Les deux leurres : le Math.random de la ligne 12 ne produit qu’un identifiant de trace, jamais un secret, et le catch de la ligne 24 refuse le jeton au lieu de le laisser passer. Les algorithmes acceptés sont une constante du code, jamais une donnée d’entrée.',
  },
  {
    id: 'n2-invite-token-guessable',
    level: 2,
    file: 'services/invites.ts',
    lang: 'ts',
    line: 20,
    cwe: 'CWE-330',
    options: ['CWE-330', 'CWE-338', 'CWE-916', 'CWE-613'],
    decoys: [18, 21],
    code: `import crypto from 'node:crypto';
import { db } from '../lib/db';
import { sendMail } from '../lib/mail';

const INVITE_TTL_MS = 7 * 24 * 3_600_000;

/** Compteur d'invitations par tenant, incrémenté atomiquement en base. */
async function nextSequence(tenantId: string): Promise<number> {
  const row = await db.counters.increment('invites', tenantId);
  return row.value;
}

export async function inviteMember(tenantId: string, email: string, invitedBy: string) {
  const normalized = email.trim().toLowerCase();
  const seq = await nextSequence(tenantId);

  /** Référence courte affichée dans la liste des invitations en attente. */
  const ref = 'INV-' + Math.random().toString(36).slice(2, 7).toUpperCase();

  const token = Buffer.from(\`\$\{tenantId}:\$\{seq}:\$\{Date.now()}\`).toString('base64url');
  const digest = crypto.createHash('sha256').update(token).digest('hex');

  await db.invites.insert({ tenantId, ref, email: normalized, invitedBy, digest,
    expiresAt: new Date(Date.now() + INVITE_TTL_MS) });

  await sendMail({
    to: normalized,
    subject: 'Invitation à rejoindre Novafact',
    body: \`Rejoignez l'espace : https://app.novafact.io/invites/\$\{token}\`,
  });

  return { ref, email: normalized };
}`,
    explain:
      'Le jeton d’invitation est un base64 de trois valeurs connues ou devinables : l’identifiant du tenant, un compteur qui s’incrémente de un, et l’horodatage à la milliseconde près. Un attaquant qui se fait inviter une fois connaît le format, le tenant et le voisinage temporel : il lui reste quelques milliers d’essais pour rejoindre un espace client. L’encodage n’est pas du secret. Les deux leurres : le Math.random de la ligne 18 ne sert qu’à une référence affichée à l’écran, et le SHA-256 de la ligne 21 est le bon geste — on ne stocke que l’empreinte du jeton, pas le jeton. Un jeton se tire avec crypto.randomBytes(32), point.',
  },
  {
    id: 'n2-bank-details-redos',
    level: 2,
    file: 'lib/validate-bank.ts',
    lang: 'ts',
    line: 10,
    cwe: 'CWE-1333',
    options: ['CWE-1333', 'CWE-20', 'CWE-770', 'CWE-209'],
    decoys: [4, 23],
    code: `import { z } from 'zod';

/** IBAN : deux lettres, deux chiffres, puis 11 à 30 caractères alphanumériques. */
const IBAN = /^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/;

/** BIC : huit ou onze caractères, ancré des deux côtés. */
const BIC = /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/;

/** Titulaire tel qu'il figure sur le relevé : mots séparés par des espaces. */
const HOLDER = /^([A-Za-z0-9]+\\s?)+$/;

export const bankDetailsSchema = z.object({
  iban: z.string().max(34),
  bic: z.string().max(11),
  holder: z.string().max(140),
});

export function validateBankDetails(raw: unknown) {
  const parsed = bankDetailsSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: 'coordonnées incomplètes' };

  const { iban, bic, holder } = parsed.data;
  const compact = iban.replace(/\\s+/g, '').toUpperCase();

  if (!IBAN.test(compact)) return { ok: false as const, error: 'IBAN invalide' };
  if (!BIC.test(bic.toUpperCase())) return { ok: false as const, error: 'BIC invalide' };
  if (!HOLDER.test(holder)) return { ok: false as const, error: 'titulaire invalide' };

  return { ok: true as const, value: { iban: compact, bic, holder } };
}`,
    explain:
      'Le motif du titulaire imbrique deux quantificateurs sur des ensembles qui se recouvrent — un + à l’intérieur d’un groupe répété, avec un espace facultatif. Sur une chaîne qui ne correspond pas, le moteur explore toutes les découpes possibles : cent quarante caractères suffisent à bloquer la boucle d’événements pendant des minutes, et le plafond max(140) du schéma ne protège de rien, parce que le coût est exponentiel et non linéaire. Les deux leurres : l’IBAN de la ligne 4 n’a que des quantificateurs bornés et disjoints, et le replace de la ligne 23 n’applique qu’un \\s+ simple, linéaire. On remplace ce motif par un test caractère par caractère, et on impose un moteur à temps linéaire (RE2) pour les regex qui touchent des entrées externes.',
  },
  {
    id: 'n2-entitlement-fail-open',
    level: 2,
    file: 'middleware/entitlements.ts',
    lang: 'ts',
    line: 16,
    cwe: 'CWE-636',
    options: ['CWE-636', 'CWE-770', 'CWE-209', 'CWE-613'],
    decoys: [15, 32],
    code: `import type { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger';
import { billing } from '../lib/billing-client';
import { db } from '../lib/db';

/** Vérifie que le tenant est en règle avant toute action facturable. */
export function requireEntitlement(feature: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const tenantId = req.user.tenantId;

    let subscription;
    try {
      subscription = await billing.getSubscription(tenantId, { timeoutMs: 2_000 });
    } catch (err) {
      logger.warn({ tenantId, err }, 'service de facturation indisponible');
      return next();
    }

    if (subscription.status !== 'active') {
      return res.status(402).json({ error: 'abonnement inactif' });
    }

    if (!subscription.features.includes(feature)) {
      return res.status(403).json({ error: 'option non incluse' });
    }

    try {
      const used = await db.usage.countThisMonth(tenantId, feature);
      if (used >= subscription.quota[feature]) {
        return res.status(429).json({ error: 'quota mensuel atteint' });
      }
    } catch (err) {
      logger.error({ tenantId, err }, 'compteur d’usage illisible');
      return res.status(503).json({ error: 'service temporairement indisponible' });
    }

    next();
  };
}`,
    explain:
      'Quand le service de facturation ne répond pas, le contrôle laisse passer la requête : il suffit donc de le faire tomber — ou simplement d’attendre une panne, ou de saturer ses deux secondes de délai — pour obtenir toutes les options payantes sur tous les tenants. Un contrôle qui ne peut pas conclure doit refuser, pas conclure à l’inverse. Les deux leurres : le log de la ligne 15 reste côté serveur et ne révèle rien au client, et le catch de la ligne 32 fait exactement ce qu’il faut en renvoyant un 503. Le correctif structurel est un type de retour à trois états — autorisé, refusé, indéterminé — où l’indéterminé n’a pas de chemin vers next().',
  },
  {
    id: 'n2-export-error-detail',
    level: 2,
    file: 'routes/exports.ts',
    lang: 'ts',
    line: 28,
    cwe: 'CWE-209',
    options: ['CWE-209', 'CWE-532', 'CWE-636', 'CWE-770'],
    decoys: [18, 27],
    code: `import { Router } from 'express';
import { z } from 'zod';
import { logger } from '../lib/logger';
import { requireUser } from '../lib/auth';
import { buildLedgerExport } from '../services/ledger-export';

export const router = Router();

const querySchema = z.object({
  from: z.string().date(),
  to: z.string().date(),
  format: z.enum(['csv', 'fec', 'xlsx']),
});

router.get('/exports/ledger', requireUser, async (req, res) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: 'paramètres invalides' });
  }

  const { from, to, format } = parsed.data;

  try {
    const file = await buildLedgerExport(req.user.tenantId, { from, to, format });
    res.type(file.mime).attachment(file.name).send(file.body);
  } catch (err) {
    logger.error({ tenantId: req.user.tenantId, from, to, err }, 'export comptable en échec');
    res.status(500).json({ error: 'export impossible', detail: (err as Error).stack });
  }
});`,
    explain:
      'La pile d’appel part au client : chemins absolus du serveur, noms de modules et de versions, et le message d’origine — souvent une erreur de la base qui livre un nom de table, une contrainte, parfois un fragment de requête avec des valeurs. C’est de la cartographie gratuite offerte à qui déclenche une erreur exprès. Les deux leurres : le message générique de la ligne 18 ne dit rien d’exploitable, et le logger.error de la ligne 27 est le bon endroit pour l’erreur complète — un journal serveur n’est pas une réponse HTTP. Le correctif structurel est un gestionnaire d’erreurs unique qui journalise l’objet et ne renvoie qu’un identifiant de corrélation.',
  },
  {
    id: 'n2-session-never-expires',
    level: 2,
    file: 'services/sessions.ts',
    lang: 'ts',
    line: 16,
    cwe: 'CWE-613',
    options: ['CWE-613', 'CWE-330', 'CWE-916', 'CWE-294'],
    decoys: [9, 28],
    code: `import crypto from 'node:crypto';
import { db } from '../lib/db';

const IDLE_TIMEOUT_MS = 30 * 60_000;

/** Ouvre une session après une authentification réussie. */
export async function issueSession(user: { id: string; tenantId: string }) {
  const token = crypto.randomBytes(32).toString('base64url');
  const digest = crypto.createHash('sha256').update(token).digest('hex');

  await db.sessions.insert({
    userId: user.id,
    tenantId: user.tenantId,
    digest,
    lastSeenAt: new Date(),
    expiresAt: null,
  });

  return { token };
}

/** Retrouve la session portée par une requête entrante. */
export async function loadSession(token: string) {
  const digest = crypto.createHash('sha256').update(token).digest('hex');
  const row = await db.sessions.findByDigest(digest);
  if (!row) return null;

  if (Date.now() - row.lastSeenAt.getTime() > IDLE_TIMEOUT_MS) {
    await db.sessions.revoke(row.id);
    return null;
  }

  await db.sessions.touch(row.id);
  return row;
}`,
    explain:
      'La session n’a pas de fin de vie absolue : expiresAt vaut null, et le seul garde-fou est l’inactivité, que le porteur du jeton volé remet à zéro à chaque appel. Un jeton exfiltré d’un poste ou d’un journal reste donc valide des années, sans rotation ni révocation au changement de mot de passe. Les deux leurres : le SHA-256 des lignes 9 et 24 est correct ici — on hache un jeton de 256 bits pour le retrouver en base, ce n’est pas un mot de passe qu’il faudrait ralentir — et la coupure d’inactivité de la ligne 28 fait exactement ce qu’elle annonce, elle ne manque que d’un plafond absolu à côté d’elle. Le correctif structurel est une durée absolue obligatoire dans le type de la ligne, plus une table de sessions qu’on sait purger par utilisateur.',
  },

  // ————————————————————————————————— niveau 3 —————————————————————————————————
  {
    id: 'n3-webhook-replay',
    level: 3,
    file: 'routes/webhooks/payments.ts',
    lang: 'ts',
    line: 31,
    cwe: 'CWE-294',
    options: ['CWE-294', 'CWE-347', 'CWE-208', 'CWE-636'],
    decoys: [25, 35],
    code: `import crypto from 'node:crypto';
import { Router, raw } from 'express';
import { db } from '../lib/db';
import { logger } from '../lib/logger';
import { applyPayment } from '../services/payments';

const SECRET = process.env.PAYMENTS_WEBHOOK_SECRET!;
export const router = Router();

/** Découpe l'en-tête « t=1730...,v1=abcd... » envoyé par le prestataire. */
function parseSignatureHeader(header: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of header.split(',')) {
    const [k, v] = part.split('=');
    if (k && v) out[k.trim()] = v.trim();
  }
  return out;
}

/** Compare la signature reçue à celle recalculée sur le corps brut. */
function signatureMatches(body: Buffer, provided: string): boolean {
  const expected = crypto.createHmac('sha256', SECRET).update(body).digest('hex');
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(provided, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

router.post('/webhooks/payments', raw({ type: 'application/json' }), async (req, res) => {
  const parts = parseSignatureHeader(req.get('x-provider-signature') ?? '');

  if (!signatureMatches(req.body, parts.v1 ?? '')) {
    return res.status(401).json({ error: 'signature invalide' });
  }

  const event = JSON.parse(req.body.toString('utf8'));
  logger.info({ eventId: event.id, type: event.type }, 'webhook paiement reçu');

  const invoice = await db.invoices.findByRef(event.data.invoice_ref);
  if (!invoice) return res.status(404).json({ error: 'facture inconnue' });

  await applyPayment(invoice, { amount: event.data.amount_cents, provider: 'stripe' });
  res.json({ received: true });
});`,
    explain:
      'Le défaut est une absence, et la ligne 31 est celle qui aurait dû la porter : la signature est vérifiée correctement, mais rien d’autre ne l’est. L’en-tête transporte un horodatage — parts.t, découpé à la ligne 29 et jamais relu — qui n’entre pas dans le calcul du HMAC et n’est comparé à aucune fenêtre ; et event.id n’est jamais confronté à une table d’événements déjà traités. Une requête légitime capturée une fois reste donc indéfiniment rejouable, et chaque rejeu solde à nouveau la facture. Les deux leurres : le timingSafeEqual de la ligne 25 est exemplaire, et le JSON.parse de la ligne 35 porte sur un corps dont la signature vient d’être validée. Il faut signer l’horodatage avec le corps, refuser au-delà de cinq minutes, et enregistrer event.id sous contrainte d’unicité — l’insertion qui échoue devient l’anti-rejeu.',
  },
  {
    id: 'n3-logo-import-redirect',
    level: 3,
    file: 'services/logo-import.ts',
    lang: 'ts',
    line: 33,
    cwe: 'CWE-918',
    options: ['CWE-918', 'CWE-770', 'CWE-20', 'CWE-1333'],
    decoys: [16, 21],
    code: `import dns from 'node:dns/promises';
import net from 'node:net';
import { storage } from '../lib/storage';
import { logger } from '../lib/logger';

const ALLOWED_PROTOCOLS = new Set(['https:']);
const MAX_BYTES = 2 * 1024 * 1024;

/** Rejette les adresses internes : boucle locale, RFC 1918, lien-local. */
function isPrivateAddress(ip: string): boolean {
  if (!net.isIP(ip)) return true;
  if (ip.startsWith('127.') || ip === '::1') return true;
  if (ip.startsWith('10.') || ip.startsWith('192.168.')) return true;
  if (ip.startsWith('169.254.') || ip.startsWith('fd')) return true;
  const [a, b] = ip.split('.').map(Number);
  return a === 172 && b >= 16 && b <= 31;
}

/** Contrôle l'URL fournie par le tenant avant tout appel sortant. */
async function assertPublicUrl(raw: string): Promise<URL> {
  const url = new URL(raw);
  if (!ALLOWED_PROTOCOLS.has(url.protocol)) throw new Error('protocole refusé');

  const { address } = await dns.lookup(url.hostname);
  if (isPrivateAddress(address)) throw new Error('adresse interne refusée');

  return url;
}

export async function importTenantLogo(tenantId: string, source: string) {
  const url = await assertPublicUrl(source);

  const response = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(5_000) });
  if (!response.ok) throw new Error('logo inaccessible');

  const body = Buffer.from(await response.arrayBuffer());
  if (body.byteLength > MAX_BYTES) throw new Error('logo trop volumineux');

  logger.info({ tenantId, host: url.hostname }, 'logo importé');
  return storage.put(\`tenants/\$\{tenantId}/logo\`, body);
}`,
    explain:
      'La validation est sérieuse mais ne s’applique qu’à la première URL : redirect: follow fait suivre à fetch une redirection 302 vers http://169.254.169.254/ ou vers un service interne, sans repasser par assertPublicUrl. L’attaquant héberge une page publique parfaitement conforme dont le seul rôle est de rediriger. Les deux leurres : le new URL de la ligne 21 ne fait qu’analyser la chaîne, il n’émet rien, et la plage 172.16/12 de la ligne 16 est correctement calculée. Le correctif structurel n’est pas de revalider à chaque saut — la résolution DNS peut changer entre le contrôle et la connexion — mais de sortir par un proxy sortant qui applique la politique, ou de se connecter à l’adresse IP déjà validée en forçant le nom d’hôte.',
  },
  {
    id: 'n3-ledger-export-unbounded',
    level: 3,
    file: 'services/ledger-export.ts',
    lang: 'ts',
    line: 29,
    cwe: 'CWE-770',
    options: ['CWE-770', 'CWE-1333', 'CWE-636', 'CWE-209'],
    decoys: [20, 38],
    code: `import { db } from '../lib/db';
import { logger } from '../lib/logger';
import { toCsvRow } from '../lib/csv';

const PAGE_SIZE = 500;
const MAX_RANGE_DAYS = 366;

export interface ExportOptions {
  from: string;
  to: string;
  format: 'csv' | 'fec' | 'xlsx';
}

/** Refuse les plages de dates absurdes avant de toucher la base. */
function assertRange(opts: ExportOptions): void {
  const from = new Date(opts.from);
  const to = new Date(opts.to);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) throw new Error('dates invalides');
  if (to < from) throw new Error('plage inversée');
  if ((to.getTime() - from.getTime()) / 86_400_000 > MAX_RANGE_DAYS) throw new Error('plage trop large');
}

export async function buildLedgerExport(tenantId: string, opts: ExportOptions) {
  assertRange(opts);

  const rows: string[] = [];
  let cursor: string | null = null;

  while (true) {
    const page = await db.entries.page({
      tenantId,
      from: opts.from,
      to: opts.to,
      after: cursor,
      limit: PAGE_SIZE,
    });

    for (const entry of page.items) rows.push(toCsvRow(entry));
    if (!page.nextCursor) break;
    cursor = page.nextCursor;
  }

  logger.info({ tenantId, rows: rows.length }, 'export comptable constitué');
  return { name: \`ledger-\$\{opts.from}_\$\{opts.to}.csv\`, mime: 'text/csv', body: rows.join('\\n') };
}`,
    explain:
      'Le défaut est une absence, et la ligne 29 est celle qui aurait dû la porter : la boucle de pagination n’a pas d’autre condition d’arrêt que l’épuisement du curseur, et tout s’accumule en mémoire avant le premier octet envoyé. Le contrôle de plage borne les dates, jamais le volume — un an de journal chez un gros tenant, c’est plusieurs millions de lignes, et quelques requêtes concurrentes suffisent à faire tomber le processus pour tout le monde. Les deux leurres : la vérification de la ligne 20 est présente et juste, et le push de la ligne 38 est borné à PAGE_SIZE par tour. Un export se traite en flux — on écrit chaque page dans la réponse ou dans un objet de stockage — avec un plafond de lignes explicite et un compteur de travaux simultanés par tenant.',
  },
];

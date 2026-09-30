// Contrôle d'accès et logique métier — extraits du jeu Spot the Sink.
//
// Toutes les routes viennent de Novafact, un SaaS de facturation multi-tenant
// en Express + TypeScript : factures, avoirs, clients, pièces jointes,
// webhooks, export comptable.

import type { Snippet } from './types';

/** Les CWE qu'introduit ce fichier, ajoutées au catalogue du jeu. */
export const cwe: Record<string, string> = {
  'CWE-285': 'Autorisation incorrecte (BFLA)',
  'CWE-862': 'Autorisation absente',
  'CWE-213': 'Exposition intentionnelle de données non nécessaires',
  'CWE-289': 'Contournement du contrôle par un nom alternatif',
  'CWE-841': 'Application incorrecte du déroulement attendu',
  'CWE-840': 'Erreur de logique métier',
  'CWE-681': 'Conversion incorrecte entre types numériques',
  'CWE-190': 'Dépassement d’entier ou bouclage',
  'CWE-362': 'Accès concurrent à une ressource partagée sans synchronisation',
  'CWE-367': 'Fenêtre entre la vérification et l’usage (TOCTOU)',
};

export const snippets: Snippet[] = [
  // ─────────────────────────────── Niveau 1 ───────────────────────────────
  {
    id: 'acc-n1-export-tenant-param',
    level: 1,
    file: 'routes/exports.ts',
    lang: 'ts',
    line: 17,
    cwe: 'CWE-639',
    options: ['CWE-639', 'CWE-285', 'CWE-213', 'CWE-915'],
    code: `import { Router } from 'express';
import { z } from 'zod';
import { db } from '../lib/db';
import { requireUser } from '../lib/auth';
import { toCsv } from '../lib/csv';

export const router = Router();

const querySchema = z.object({
  tenantId: z.string().uuid(),
  from: z.coerce.date(),
  to: z.coerce.date(),
});

router.get('/exports/ledger', requireUser, async (req, res) => {
  const { tenantId, from, to } = querySchema.parse(req.query);
  const rows = await db.ledger.entriesBetween(tenantId, from, to);

  res.type('text/csv').send(toCsv(rows));
});`,
    explain:
      'Le tenant qui sert de clé d’autorisation arrive dans la requête : le schéma garantit que c’est un UUID, pas que c’est *votre* UUID. Changer une valeur dans l’URL sort du périmètre du compte et exporte le grand livre du voisin. La règle : une clé de périmètre ne se lit jamais dans l’entrée, elle se lit dans la session (req.user.tenantId) — et ce cloisonnement appartient à la couche d’accès aux données, pas à chaque route, sans quoi la prochaine route l’oubliera.',
  },

  {
    id: 'acc-n1-profile-patch',
    level: 1,
    file: 'routes/profile.ts',
    lang: 'ts',
    line: 18,
    cwe: 'CWE-915',
    options: ['CWE-915', 'CWE-639', 'CWE-213', 'CWE-285'],
    code: `import { Router } from 'express';
import { z } from 'zod';
import { db } from '../lib/db';
import { requireUser } from '../lib/auth';

export const router = Router();

const profileSchema = z.object({
  displayName: z.string().min(1).max(80),
  locale: z.enum(['fr', 'en', 'de']),
  signature: z.string().max(500).optional(),
});

router.patch('/me', requireUser, async (req, res) => {
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'profil invalide' });

  const user = await db.users.update(req.user.id, req.body);
  res.json({ id: user.id, displayName: user.displayName, locale: user.locale });
});`,
    explain:
      'La validation a bien lieu, mais son résultat est jeté : c’est req.body brut qui part en base. Un schéma zod object accepte les clés inconnues et se contente de les retirer de parsed.data — « role », « tenantId » ou « plan » traversent donc la validation sans la contredire et atterrissent dans l’UPDATE. Le correctif n’est pas de blâmer cette ligne mais de rendre la faute impossible : on n’écrit que des champs issus de parsed.data, et le dépôt n’accepte en paramètre qu’un type de mise à jour restreint.',
  },

  {
    id: 'acc-n1-client-detail',
    level: 1,
    file: 'routes/clients.ts',
    lang: 'ts',
    line: 20,
    cwe: 'CWE-213',
    options: ['CWE-213', 'CWE-639', 'CWE-915', 'CWE-285'],
    code: `import { Router } from 'express';
import { db } from '../lib/db';
import { requireUser } from '../lib/auth';
import { toPublicClient } from '../serializers/client';

export const router = Router();

router.get('/clients', requireUser, async (req, res) => {
  const rows = await db.clients.findMany({ tenantId: req.user.tenantId });
  res.json(rows.map(toPublicClient));
});

router.get('/clients/:id', requireUser, async (req, res) => {
  const client = await db.clients.findOne({
    id: req.params.id,
    tenantId: req.user.tenantId,
  });
  if (!client) return res.status(404).json({ error: 'client introuvable' });

  res.json(client);
});`,
    explain:
      'La liste passe par le sérialiseur, le détail renvoie la ligne de base telle quelle : notes internes, score de risque, identifiant de facturation chez le prestataire de paiement, tout ce que la table porte part au client. C’est une exposition de données excessive, et elle est invisible à la revue parce que la réponse « a l’air » correcte dans l’interface qui n’affiche que trois champs. Le correctif est structurel : aucune route ne renvoie une entité de base directement, la sérialisation est le seul chemin de sortie — idéalement par un type de retour qui ne contient pas les champs sensibles.',
  },

  {
    id: 'acc-n1-vat-float',
    level: 1,
    file: 'routes/invoice-lines.ts',
    lang: 'ts',
    line: 18,
    cwe: 'CWE-681',
    options: ['CWE-681', 'CWE-190', 'CWE-840', 'CWE-20'],
    code: `import { Router } from 'express';
import { z } from 'zod';
import { db } from '../lib/db';
import { requireUser } from '../lib/auth';

export const router = Router();
const VAT_RATE = 0.2;

const lineSchema = z.object({
  label: z.string().min(1).max(120),
  unitPriceCents: z.number().int().min(0).max(10_000_000),
  quantity: z.number().int().min(1).max(1_000),
});

router.post('/invoices/:id/lines', requireUser, async (req, res) => {
  const line = lineSchema.parse(req.body);
  const subtotalCents = line.unitPriceCents * line.quantity;
  const totalCents = subtotalCents + subtotalCents * VAT_RATE;

  await db.invoiceLines.insert({ tenantId: req.user.tenantId, ...line, totalCents });
  res.status(201).json({ subtotalCents, totalCents });
});`,
    explain:
      'Tout le reste du fichier travaille en centimes entiers — le schéma l’impose avec .int() — et cette ligne multiplie par un flottant : 1999 centimes donnent 2398,8 centimes, une valeur qui n’existe pas. Le montant stocké n’est plus un entier, les comparaisons de solde ne tombent jamais juste, et l’erreur se cumule ligne après ligne jusqu’à des factures qui ne s’équilibrent pas. L’argent se manipule en entiers de la plus petite unité : le taux s’exprime en points de base et l’arrondi se fait explicitement, à un seul endroit documenté.',
  },

  {
    id: 'acc-n1-admin-router-order',
    level: 1,
    file: 'routes/admin.ts',
    lang: 'ts',
    line: 10,
    cwe: 'CWE-862',
    options: ['CWE-862', 'CWE-285', 'CWE-639', 'CWE-289'],
    code: `import { Router } from 'express';
import { requireUser, requireRole } from '../lib/auth';
import { listTenants, tenantDetail, updatePlan, impersonate } from '../controllers/admin';

export const router = Router();

router.use(requireUser);

// Console d'administration : réservée aux opérateurs Novafact.
router.get('/admin/tenants', listTenants);

router.use(requireRole('operator'));

router.get('/admin/tenants/:id', tenantDetail);
router.post('/admin/tenants/:id/plan', updatePlan);
router.post('/admin/tenants/:id/impersonate', impersonate);`,
    explain:
      'Express applique les middlewares dans l’ordre de déclaration : une route enregistrée avant router.use(requireRole(...)) n’est jamais traversée par ce garde. Le listing de tous les tenants de la plateforme est donc accessible à n’importe quel utilisateur connecté, alors que ses trois voisines sont protégées. Un contrôle posé par position dans un fichier se perd au premier déplacement de ligne : le garde doit être attaché à la route (router.get(path, requireRole(\'operator\'), handler)) ou, mieux, porté par un routeur d’administration monté derrière son propre garde.',
  },

  // ─────────────────────────────── Niveau 2 ───────────────────────────────
  {
    id: 'acc-n2-nested-attachment',
    level: 2,
    file: 'routes/attachments.ts',
    lang: 'ts',
    line: 20,
    cwe: 'CWE-639',
    options: ['CWE-639', 'CWE-22', 'CWE-213', 'CWE-285'],
    decoys: [17, 23],
    code: `import { Router } from 'express';
import { z } from 'zod';
import { db } from '../lib/db';
import { storage } from '../lib/storage';
import { requireUser } from '../lib/auth';

export const router = Router();

const paramsSchema = z.object({
  invoiceId: z.string().uuid(),
  attachmentId: z.string().uuid(),
});

router.get('/invoices/:invoiceId/attachments/:attachmentId', requireUser, async (req, res) => {
  const { invoiceId, attachmentId } = paramsSchema.parse(req.params);

  const invoice = await db.invoices.findOne({ id: invoiceId, tenantId: req.user.tenantId });
  if (!invoice) return res.status(404).json({ error: 'facture introuvable' });

  const attachment = await db.attachments.findOne({ id: attachmentId });
  if (!attachment) return res.status(404).json({ error: 'pièce jointe introuvable' });

  const stream = await storage.read(attachment.storageKey);
  res.setHeader(
    'Content-Disposition',
    \`attachment; filename="\${encodeURIComponent(attachment.fileName)}"\`,
  );
  req.log.info({ invoiceId, attachmentId }, 'téléchargement de pièce jointe');
  stream.pipe(res.type(attachment.mimeType));
});`,
    explain:
      'La ressource imbriquée n’hérite pas du contrôle de sa parente : la facture est bien cloisonnée, mais la pièce jointe est cherchée par son seul identifiant, sans tenant ni lien avec la facture de l’URL. N’importe quelle facture à soi sert alors de laissez-passer pour télécharger la pièce jointe de n’importe qui. Les deux leurres : la ligne 17 prend elle aussi un identifiant dans l’URL mais la requête filtre par tenant, et la ligne 23 ressemble à une lecture de fichier pilotée par le client alors que storageKey est une clé opaque produite par le serveur, jamais un chemin reçu. Le correctif est un dépôt dont toutes les méthodes exigent le tenant en paramètre — un contrôle recopié route par route sera oublié à la prochaine route.',
  },

  {
    id: 'acc-n2-webhook-patch',
    level: 2,
    file: 'routes/webhooks.ts',
    lang: 'ts',
    line: 31,
    cwe: 'CWE-915',
    options: ['CWE-915', 'CWE-1321', 'CWE-639', 'CWE-213'],
    decoys: [20, 29],
    code: `import { Router } from 'express';
import { z } from 'zod';
import { db } from '../lib/db';
import { requireUser } from '../lib/auth';

export const router = Router();

const ALLOWED_HEADERS = ['x-signature', 'x-request-id', 'user-agent'] as const;

const webhookSchema = z.object({
  url: z.string().url().startsWith('https://'),
  events: z.array(z.enum(['invoice.paid', 'invoice.sent', 'credit_note.issued'])),
  active: z.boolean(),
  headers: z.record(z.string(), z.string()).default({}),
});

function pickHeaders(raw: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of ALLOWED_HEADERS) {
    if (raw[key] !== undefined) out[key] = raw[key];
  }
  return out;
}

router.patch('/webhooks/:id', requireUser, async (req, res) => {
  const parsed = webhookSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'webhook invalide' });

  const current = await db.webhooks.findOne({ id: req.params.id, tenantId: req.user.tenantId });
  if (!current) return res.status(404).json({ error: 'webhook introuvable' });
  const next = { ...current, ...req.body, headers: pickHeaders(parsed.data.headers) };
  await db.webhooks.update({ id: current.id, tenantId: current.tenantId }, next);

  res.json({ id: current.id, url: next.url, active: next.active });
});`,
    explain:
      'L’objet fusionné est construit à partir de req.body et non de parsed.data : les clés que le schéma ignore écrasent celles de l’enregistrement existant, y compris id et tenantId, ce qui déplace un webhook — et le flux de données qu’il transporte — vers un autre tenant. Le leurre de la ligne 20 est l’inverse exact : une écriture dans un objet à partir d’une entrée brute, mais bornée à une liste blanche fermée, donc saine ; celui de la ligne 29 prend l’identifiant dans l’URL en filtrant par tenant. Un objet de mise à jour ne se construit jamais par étalement d’une entrée : on nomme les champs, et le dépôt refuse d’écrire les colonnes d’identité.',
  },

  {
    id: 'acc-n2-admin-prefix-guard',
    level: 2,
    file: 'app.ts',
    lang: 'ts',
    line: 21,
    cwe: 'CWE-289',
    options: ['CWE-289', 'CWE-862', 'CWE-285', 'CWE-639'],
    decoys: [14, 27],
    code: `import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import { requireUser, requireRole } from './lib/auth';
import { logger } from './lib/logger';
import { router as invoices } from './routes/invoices';
import { router as admin } from './routes/admin';

export const app = express();

app.use(express.json({ limit: '1mb' }));
app.use(requireUser);

app.use((req: Request, _res: Response, next: NextFunction) => {
  const clean = req.originalUrl.split('?')[0];
  logger.info({ path: clean, user: req.user.id }, 'requête');
  next();
});

// Toute la console d'administration passe par le garde de rôle.
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.path.startsWith('/api/admin/')) {
    return requireRole('operator')(req, res, next);
  }
  next();
});

app.set('case sensitive routing', false);
app.use('/api', invoices);
app.use('/api', admin);

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err }, 'erreur non rattrapée');
  res.status(500).json({ error: 'erreur interne' });
});`,
    explain:
      'Le routage et le garde ne lisent pas l’URL de la même façon : Express achemine /api/Admin/tenants vers le routeur d’administration, mais startsWith compare caractère par caractère et ne reconnaît pas la majuscule. Le même écart s’ouvre sur un double slash, un segment /./ ou un %61 selon la normalisation. Les leurres : la ligne 14 découpe l’URL à la main mais n’en fait qu’une trace de journal, et la ligne 27 est le comportement par défaut d’Express, assumé et documenté — ce n’est pas elle le défaut, c’est le garde qui prétend décider de l’autorisation à partir d’une chaîne. Une autorisation ne se déduit pas de la forme d’une URL : elle s’attache au routeur ou au gestionnaire, là où le cadre a déjà fait la résolution.',
  },

  {
    id: 'acc-n2-credit-note-cap',
    level: 2,
    file: 'routes/credit-notes.ts',
    lang: 'ts',
    line: 27,
    cwe: 'CWE-840',
    options: ['CWE-840', 'CWE-190', 'CWE-681', 'CWE-639'],
    decoys: [19, 26],
    code: `import { Router } from 'express';
import { z } from 'zod';
import { db } from '../lib/db';
import { requireUser } from '../lib/auth';

export const router = Router();

const creditSchema = z.object({
  invoiceId: z.string().uuid(),
  amountCents: z.number().int().min(1).max(100_000_000),
  reason: z.string().min(3).max(200),
});

router.post('/credit-notes', requireUser, async (req, res) => {
  const parsed = creditSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'avoir invalide' });
  const { invoiceId, amountCents, reason } = parsed.data;

  const invoice = await db.invoices.findOne({ id: invoiceId, tenantId: req.user.tenantId });
  if (!invoice) return res.status(404).json({ error: 'facture introuvable' });
  if (invoice.status !== 'sent' && invoice.status !== 'paid') {
    return res.status(409).json({ error: 'facture non éligible à un avoir' });
  }

  const previous = await db.creditNotes.findMany({ invoiceId, tenantId: req.user.tenantId });
  const alreadyCredited = previous.reduce((sum, n) => sum + n.amountCents, 0);
  if (amountCents > invoice.totalCents) {
    return res.status(422).json({ error: 'avoir supérieur au montant de la facture' });
  }

  const note = await db.creditNotes.insert({ tenantId: req.user.tenantId, invoiceId, amountCents, reason });
  req.log.info({ invoiceId, amountCents, alreadyCredited }, 'avoir émis');
  res.status(201).json({ id: note.id, amountCents: note.amountCents });
});`,
    explain:
      'L’invariant à tenir n’est pas « un avoir ne dépasse pas la facture » mais « la somme des avoirs ne dépasse pas la facture » : le total déjà avoiré est calculé juste au-dessus, puis seulement journalisé. Dix appels successifs remboursent dix fois la facture, et chaque appel passe le contrôle. Les leurres : la ligne 19 prend l’identifiant de facture dans le corps de la requête mais filtre par tenant, et la ligne 26 additionne de l’argent sans flottant, en centimes entiers. Un invariant métier qui se vérifie en lisant l’état puis en écrivant depuis la route sera un jour contourné : il appartient à la couche qui écrit — contrainte en base, ou insertion conditionnelle qui recalcule la somme dans la même transaction.',
  },

  {
    id: 'acc-n2-payment-import',
    level: 2,
    file: 'routes/payments.ts',
    lang: 'ts',
    line: 23,
    cwe: 'CWE-681',
    options: ['CWE-681', 'CWE-190', 'CWE-840', 'CWE-20'],
    decoys: [20, 27],
    code: `import { Router } from 'express';
import { z } from 'zod';
import { db } from '../lib/db';
import { requireUser } from '../lib/auth';
import { parseCsv } from '../lib/csv';

export const router = Router();

const rowSchema = z.object({
  reference: z.string().regex(/^FA-\\d{4}-\\d{4}$/),
  amount: z.string().regex(/^\\d{1,9}(\\.\\d{2})?$/),
  valueDate: z.coerce.date(),
});

router.post('/payments/import', requireUser, async (req, res) => {
  const rows = parseCsv(String(req.body.content ?? '')).map((r) => rowSchema.parse(r));
  const applied: string[] = [];

  for (const row of rows) {
    const invoice = await db.invoices.findOne({ ref: row.reference, tenantId: req.user.tenantId });
    if (!invoice) continue;

    const amountCents = Math.trunc(Number(row.amount) * 100);
    await db.payments.insert({ tenantId: req.user.tenantId, invoiceId: invoice.id, amountCents, valueDate: row.valueDate });

    const paidCents = await db.payments.sumForInvoice(invoice.id, req.user.tenantId);
    if (paidCents >= invoice.totalCents) {
      await db.invoices.markPaid(invoice.id, req.user.tenantId);
    }
    applied.push(invoice.ref);
  }

  res.json({ applied: applied.length, refs: applied });
});`,
    explain:
      'Le passage par un flottant perd le montant avant de l’arrondir : Number(\'8.20\') * 100 vaut 819,9999999999999, et Math.trunc en fait 819 centimes. Le relevé bancaire et la base divergent d’un centime sur une partie des lignes, dans un sens décidé par la valeur elle-même — et la même conversion, côté remboursement, rend plus que ce qui a été encaissé. Les leurres : la ligne 20 cherche la facture par une référence lue dans un fichier, mais la requête filtre par tenant, et la ligne 27 compare bien des entiers avec >= et non une égalité de flottants. Une chaîne décimale se convertit en centimes sans flottant : on découpe sur le point, ou on utilise un type décimal, du bord de l’application jusqu’à la colonne.',
  },

  {
    id: 'acc-n2-membership-denylist',
    level: 2,
    file: 'routes/billing-settings.ts',
    lang: 'ts',
    line: 23,
    cwe: 'CWE-285',
    options: ['CWE-285', 'CWE-639', 'CWE-862', 'CWE-915'],
    decoys: [20, 27],
    code: `import { Router } from 'express';
import { z } from 'zod';
import { db } from '../lib/db';
import { requireUser } from '../lib/auth';

export const router = Router();

const settingsSchema = z.object({
  tenantId: z.string().uuid(),
  iban: z.string().min(15).max(34),
  legalName: z.string().min(1).max(120),
});

router.put('/billing-settings', requireUser, async (req, res) => {
  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'paramètres invalides' });
  const { tenantId, iban, legalName } = parsed.data;
  const normalizedIban = iban.replace(/\\s+/g, '').toUpperCase();

  const membership = await db.memberships.findOne({ userId: req.user.id, tenantId });
  if (!membership) return res.status(403).json({ error: 'accès refusé' });

  if (membership.role === 'viewer') {
    return res.status(403).json({ error: 'rôle insuffisant' });
  }

  await db.tenants.updateBillingSettings(tenantId, { iban: normalizedIban, legalName });
  req.log.warn({ tenantId, actor: req.user.id }, 'coordonnées bancaires modifiées');
  res.json({ ok: true });
});`,
    explain:
      'Le rôle est filtré par liste noire : tout ce qui n’est pas « viewer » peut changer l’IBAN sur lequel les clients du tenant paieront. Le jour où l’on ajoute un rôle — « guest », « integration », « accountant-readonly » — il obtient ce droit sans que personne ne relise cette route. Les leurres : la ligne 20 prend le tenant dans le corps de la requête, ce qui est sain puisque l’appartenance est vérifiée contre ce tenant précis, et la ligne 27 est l’écriture sensible mais elle est bien gardée. Une autorisation s’exprime en permission accordée, pas en rôle exclu : une table de permissions par rôle, consultée par une fonction unique (can(user, \'billing.write\', tenantId)) que les routes ne peuvent pas contourner.',
  },

  // ─────────────────────────────── Niveau 3 ───────────────────────────────
  {
    id: 'acc-n3-payment-confirm',
    level: 3,
    file: 'routes/payment-confirm.ts',
    lang: 'ts',
    line: 41,
    cwe: 'CWE-841',
    options: ['CWE-841', 'CWE-347', 'CWE-362', 'CWE-639'],
    decoys: [24, 34],
    code: `import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../lib/db';
import { requireUser } from '../lib/auth';

export const router = Router();
const PSP_SECRET = process.env.PSP_SECRET ?? '';

const confirmSchema = z.object({
  intentId: z.string().uuid(),
  pspReference: z.string().max(64),
  signature: z.string().length(64),
});

/** Le prestataire de paiement signe « intentId.pspReference ». */
function signatureValide(intentId: string, pspReference: string, given: string): boolean {
  const expected = crypto
    .createHmac('sha256', PSP_SECRET)
    .update(\`\${intentId}.\${pspReference}\`)
    .digest('hex');
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(given, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Étape 1 — POST /payments/intents : vérifie que le montant couvre le solde
// dû, puis enregistre une intention au statut « pending ».

// Étape 2 — le navigateur revient du prestataire avec la confirmation.
router.post('/payments/confirm', requireUser, async (req, res) => {
  const { intentId, pspReference, signature } = confirmSchema.parse(req.body);

  const intent = await db.paymentIntents.findOne({ id: intentId, tenantId: req.user.tenantId });
  if (!intent) return res.status(404).json({ error: 'intention introuvable' });

  if (!signatureValide(intent.id, pspReference, signature)) {
    return res.status(401).json({ error: 'signature du prestataire invalide' });
  }

  await db.paymentIntents.update({ id: intent.id }, { status: 'captured', pspReference });
  await db.invoices.markPaid(intent.invoiceId, req.user.tenantId);
  await db.payments.insert({
    tenantId: req.user.tenantId,
    invoiceId: intent.invoiceId,
    amountCents: intent.amountCents,
    pspReference,
  });
  res.json({ ok: true, invoiceId: intent.invoiceId });
});`,
    explain:
      'Le défaut est une absence, et c’est la ligne 41 qui aurait dû la porter : la transition vers « captured » s’écrit sans exiger l’état précédent. L’étape 2 croit que l’étape 1 a eu lieu et qu’elle n’a eu lieu qu’une fois, alors que rien ne le vérifie — rejouer la même confirmation signée encaisse deux fois, et une intention annulée, expirée ou déjà remboursée se confirme aussi bien. Tout le reste est irréprochable, ce qui rend le trou difficile à voir : la signature est comparée en temps constant après contrôle de longueur (ligne 24) et l’intention est cloisonnée par tenant (ligne 34). Une machine à états ne se garde pas par un if dans une route : la mise à jour doit être conditionnelle (UPDATE … SET status = \'captured\' WHERE id = $1 AND status = \'pending\'), et l’on n’avance que si une ligne a bougé.',
  },

  {
    id: 'acc-n3-wallet-debit',
    level: 3,
    file: 'routes/dispatch.ts',
    lang: 'ts',
    line: 43,
    cwe: 'CWE-362',
    options: ['CWE-362', 'CWE-367', 'CWE-840', 'CWE-639'],
    decoys: [29, 40],
    code: `import { Router } from 'express';
import { z } from 'zod';
import { db } from '../lib/db';
import { requireUser } from '../lib/auth';
import { sendInvoice } from '../services/dispatch';

export const router = Router();

const sendSchema = z.object({
  channel: z.enum(['email', 'chorus', 'postal']),
});

const COST_CENTS: Record<'email' | 'chorus' | 'postal', number> = {
  email: 5,
  chorus: 25,
  postal: 180,
};

/** Le solde prépayé est partagé par tous les membres du tenant. */
async function soldeDisponible(tenantId: string): Promise<number> {
  const wallet = await db.wallets.findOne({ tenantId });
  return wallet?.balanceCents ?? 0;
}

router.post('/invoices/:id/send', requireUser, async (req, res) => {
  const { channel } = sendSchema.parse(req.body);
  const cost = COST_CENTS[channel];

  const invoice = await db.invoices.findOne({ id: req.params.id, tenantId: req.user.tenantId });
  if (!invoice) return res.status(404).json({ error: 'facture introuvable' });
  if (invoice.status !== 'draft') {
    return res.status(409).json({ error: 'facture déjà envoyée' });
  }

  const solde = await soldeDisponible(req.user.tenantId);
  if (solde < cost) {
    return res.status(402).json({ error: 'solde prépayé insuffisant' });
  }

  const claimed = await db.invoices.markSentIfDraft(invoice.id, req.user.tenantId);
  if (!claimed) return res.status(409).json({ error: 'facture déjà envoyée' });

  await db.wallets.update({ tenantId: req.user.tenantId }, { balanceCents: solde - cost });
  await sendInvoice(invoice, channel);
  res.json({ ok: true, balanceCents: solde - cost });
});`,
    explain:
      'Le défaut est une absence d’atomicité, et la ligne 43 est celle qui aurait dû la porter : elle écrit une valeur absolue calculée à partir d’une lecture faite huit lignes plus haut. Deux requêtes parallèles lisent le même solde, passent toutes deux le contrôle et écrivent toutes deux « solde − coût » : un débit disparaît, et en lançant cent envois postaux d’un coup on consomme un crédit qu’on ne possède pas. Les leurres : la ligne 29 prend l’identifiant dans l’URL mais filtre par tenant, et la ligne 40 est exactement le motif correct — une mise à jour conditionnelle dont on exploite le résultat pour réserver la facture, ce qui protège l’envoi double sans protéger le solde. Lire, décider, écrire depuis l’application est toujours une course : le décrément doit être une seule instruction conditionnelle (UPDATE wallets SET balance_cents = balance_cents − $1 WHERE tenant_id = $2 AND balance_cents >= $1), ou la lecture doit verrouiller la ligne dans la transaction qui écrit.',
  },

  {
    id: 'acc-n3-accounting-export-overflow',
    level: 3,
    file: 'routes/accounting-export.ts',
    lang: 'ts',
    line: 27,
    cwe: 'CWE-190',
    options: ['CWE-190', 'CWE-681', 'CWE-840', 'CWE-213'],
    decoys: [26, 28],
    code: `import { Router } from 'express';
import { z } from 'zod';
import { db } from '../lib/db';
import { requireUser, requireRole } from '../lib/auth';

export const router = Router();

const exportSchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
});

interface EcritureComptable {
  ref: string;
  totalCents: number;
  tvaCents: number;
}

/**
 * Format d'échange du logiciel comptable : enregistrements de 32 octets,
 * référence sur 20 octets ASCII puis deux montants en centimes,
 * chacun sur 4 octets signés en gros-boutien.
 */
function encodeEcriture(e: EcritureComptable): Buffer {
  const buf = Buffer.alloc(32);
  buf.write(e.ref.slice(0, 20).padEnd(20, ' '), 0, 20, 'ascii');
  buf.writeInt32BE(e.totalCents | 0, 20);
  buf.writeInt32BE(e.tvaCents, 24);
  return buf;
}

router.post('/exports/accounting', requireUser, requireRole('accountant'), async (req, res) => {
  const { from, to } = exportSchema.parse(req.body);
  if (from > to) return res.status(400).json({ error: 'période invalide' });

  const rows = await db.ledger.entriesBetween(req.user.tenantId, from, to);
  const chunks = rows.map(encodeEcriture);

  await db.exports.insert({
    tenantId: req.user.tenantId,
    from,
    to,
    count: rows.length,
    actor: req.user.id,
  });

  res.type('application/octet-stream').send(Buffer.concat(chunks));
});`,
    explain:
      'L’opérateur | 0 n’est pas une coquetterie de style : il convertit en entier signé sur 32 bits avec bouclage, donc une facture de 30 000 000 € (3 000 000 000 centimes) ressort à −1 294 967 296 centimes et entre dans la comptabilité comme un avoir géant. La valeur traverse une fonction auxiliaire, loin de la route, et personne ne relit un encodeur. Les leurres : la ligne 26 tronque la référence à 20 octets, ce qui est le format lui-même et porte sur une chaîne produite par le serveur ; et la ligne 28 est le même appel sans | 0 — c’est elle qui est correcte, puisque writeInt32BE lève ERR_OUT_OF_RANGE hors bornes, c’est-à-dire qu’elle échoue bruyamment au lieu de corrompre en silence. Le domaine des montants se borne là où ils naissent (schéma et colonne), le format d’échange doit être assez large pour le contenir, et un encodeur assert au lieu de rogner.',
  },
];

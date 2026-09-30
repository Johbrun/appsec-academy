// M1 · injections — extraits du jeu Spot the Sink.

import type { Snippet } from './types';

/** Les CWE qu'introduit ce fichier, ajoutées au catalogue du jeu. */
export const cwe: Record<string, string> = {
  'CWE-88': 'Injection d’arguments dans une commande',
  'CWE-90': 'Injection dans un filtre LDAP',
  'CWE-93': 'Injection CRLF dans des en-têtes',
  'CWE-94': 'Injection de code',
  'CWE-95': 'Injection dans une évaluation dynamique (eval)',
  'CWE-116': 'Échappement incorrect de la sortie',
  'CWE-502': 'Désérialisation de données non fiables',
  'CWE-611': 'Traitement d’entités XML externes (XXE)',
  'CWE-1236': 'Injection de formule dans un fichier tableur',
};

export const snippets: Snippet[] = [
  // ─────────────────────────────── Niveau 1 ───────────────────────────────
  {
    id: 'inj-n1-client-search',
    level: 1,
    file: 'routes/clients.ts',
    lang: 'ts',
    line: 14,
    cwe: 'CWE-89',
    options: ['CWE-89', 'CWE-943', 'CWE-20', 'CWE-116'],
    code: `import { Router } from 'express';
import { z } from 'zod';
import { db } from '../lib/db';
import { requireUser } from '../lib/auth';

export const router = Router();

const searchSchema = z.object({ q: z.string().min(1).max(120) });

router.get('/clients/search', requireUser, async (req, res) => {
  const parsed = searchSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: 'recherche invalide' });

  const sql = \`SELECT id, name, siret FROM clients WHERE tenant_id = $1 AND name ILIKE '%\${parsed.data.q}%'\`;

  const rows = await db.query(sql, [req.user.tenantId]);
  res.json({ count: rows.rowCount, clients: rows.rows });
});`,
    explain:
      'La requête est paramétrée pour le tenant et concaténée pour le terme recherché : il suffit d’un apostrophe dans « q » pour sortir du littéral et enchaîner sur le reste de la base. Le schéma zod contraint le type et la longueur, jamais le sens — une chaîne de 120 caractères reste une chaîne de 120 caractères de SQL. La correction est structurelle : le terme passe en paramètre lié ($2) au même titre que le tenant, et le caractère « % » se pose autour de la valeur côté serveur.',
  },

  {
    id: 'inj-n1-pdf-render',
    level: 1,
    file: 'services/pdf.ts',
    lang: 'ts',
    line: 17,
    cwe: 'CWE-78',
    options: ['CWE-78', 'CWE-88', 'CWE-22', 'CWE-94'],
    code: `import { exec } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { db } from '../lib/db';

const run = promisify(exec);
const RENDER_DIR = path.resolve(process.cwd(), 'storage/render');

/** Rend en PDF une facture déjà écrite en HTML par le moteur de gabarits. */
export async function renderInvoicePdf(tenantId: string, invoiceId: string) {
  const invoice = await db.invoices.findOne({ tenantId, id: invoiceId });
  if (!invoice) throw new Error('facture introuvable');

  const src = path.join(RENDER_DIR, \`\${invoice.id}.html\`);
  const out = path.join(RENDER_DIR, \`\${invoice.id}.pdf\`);

  await run(\`wkhtmltopdf --title "\${invoice.ref}" \${src} \${out}\`);

  return out;
}`,
    explain:
      'exec passe la chaîne entière à /bin/sh : la référence de facture, saisie par l’utilisateur au moment de la création, devient du shell une fois rendue entre guillemets — un simple " puis ; suffit. Le fait que la donnée vienne de la base et non de req.body ne change rien, c’est une injection de second ordre. Le correctif n’est pas d’échapper les guillemets mais de ne plus construire de ligne de commande : execFile(\'wkhtmltopdf\', [\'--title\', invoice.ref, src, out]) ne fait jamais intervenir de shell.',
  },

  {
    id: 'inj-n1-audit-filter',
    level: 1,
    file: 'routes/audit.ts',
    lang: 'ts',
    line: 15,
    cwe: 'CWE-943',
    options: ['CWE-943', 'CWE-89', 'CWE-20', 'CWE-639'],
    code: `import { Router } from 'express';
import { db } from '../lib/db';
import { requireUser } from '../lib/auth';

export const router = Router();

/** Journal d'audit du tenant : réservé aux administrateurs. */
router.get('/audit', requireUser, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'réservé aux administrateurs' });

  const { actor, action } = req.query;
  const limit = Math.min(Number(req.query.limit) || 50, 200);

  const events = await db.auditEvents
    .find({ tenantId: req.user.tenantId, actor, action })
    .sort({ at: -1 })
    .limit(limit)
    .toArray();

  res.json({ count: events.length, events });
});`,
    explain:
      'Express analyse ?actor[$ne]= en objet : « actor » n’est pas forcément une chaîne, et le filtre reçoit un opérateur Mongo au lieu d’une valeur. Le tenant est bien dans le filtre, mais un $ne ou un $regex sur « actor » suffit à balayer tout le journal du tenant, et un opérateur sur tenantId lui-même en ferait autant. Ce n’est pas un problème d’échappement mais de typage : un schéma strict à l’entrée, ou String(actor), ramène la valeur à ce que la requête attend.',
  },

  {
    id: 'inj-n1-line-formula',
    level: 1,
    file: 'routes/invoice-lines.ts',
    lang: 'ts',
    line: 19,
    cwe: 'CWE-95',
    options: ['CWE-95', 'CWE-1336', 'CWE-1333', 'CWE-20'],
    code: `import { Router } from 'express';
import { z } from 'zod';
import { requireUser } from '../lib/auth';

export const router = Router();

const previewSchema = z.object({
  formula: z.string().max(200),
  quantity: z.number().nonnegative(),
  unitPrice: z.number().nonnegative(),
});

/** Aperçu d'une ligne de facture calculée par une formule personnalisée. */
router.post('/invoices/lines/preview', requireUser, async (req, res) => {
  const parsed = previewSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'aperçu invalide' });
  const { formula, quantity, unitPrice } = parsed.data;

  const total = eval(formula.replace(/q/g, String(quantity)).replace(/p/g, String(unitPrice)));

  res.json({ total: Number(total.toFixed(2)) });
});`,
    explain:
      'eval exécute la chaîne dans le processus Node, avec require, process et les secrets d’environnement à portée de main : « q*p » et « process.mainModule.require(\'child_process\') » sont la même chose pour l’interpréteur. Les substitutions de q et p ne filtrent rien, elles ne font qu’injecter des nombres dans du code que l’appelant écrit. Une formule utilisateur se traite avec un évaluateur d’expressions arithmétiques dédié, qui analyse une grammaire fermée et n’a aucun accès à l’environnement.',
  },

  {
    id: 'inj-n1-mail-headers',
    level: 1,
    file: 'services/mailer.ts',
    lang: 'ts',
    line: 16,
    cwe: 'CWE-93',
    options: ['CWE-93', 'CWE-20', 'CWE-116', 'CWE-79'],
    code: `import { z } from 'zod';
import { db } from '../lib/db';
import { smtp } from '../lib/smtp';

const sendSchema = z.object({ invoiceId: z.string().uuid(), to: z.string().email() });

/** Envoie la facture au client via le relais SMTP, en MIME construit à la main. */
export async function mailInvoice(tenantId: string, input: unknown) {
  const { invoiceId, to } = sendSchema.parse(input);
  const invoice = await db.invoices.findOne({ tenantId, id: invoiceId });
  if (!invoice) throw new Error('facture introuvable');

  const message = [
    'From: facturation@novafact.io',
    \`To: \${to}\`,
    \`Subject: Facture \${invoice.ref}\`,
    'Content-Type: text/plain; charset=utf-8',
    '',
    \`Votre facture \${invoice.ref} est disponible dans votre espace client.\`,
  ].join('\\r\\n');

  await smtp.sendRaw({ envelopeTo: to, message });
}`,
    explain:
      'La référence de facture est libre et atterrit dans un en-tête : un CR LF à l’intérieur ferme Subject et ouvre l’en-tête suivant, par exemple un Bcc vers l’extérieur, ou une ligne vide qui transforme le reste en corps de message. La ligne 15 ressemble au même défaut mais n’en est pas un : zod a déjà validé « to » comme adresse, et aucune adresse valide ne contient de saut de ligne. Toute valeur qui entre dans un protocole à en-têtes doit voir ses caractères de contrôle refusés à la source — ou, mieux, passer par une bibliothèque MIME qui encode les en-têtes elle-même.',
  },

  // ─────────────────────────────── Niveau 2 ───────────────────────────────
  {
    id: 'inj-n2-credit-note-report',
    level: 2,
    file: 'routes/credit-notes.ts',
    lang: 'ts',
    line: 27,
    cwe: 'CWE-89',
    options: ['CWE-89', 'CWE-943', 'CWE-116', 'CWE-209'],
    decoys: [23, 28],
    code: `import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireUser } from '../lib/auth';
import { logger } from '../lib/logger';

export const router = Router();

const reportSchema = z.object({
  from: z.string().regex(/^\\d{4}-\\d{2}-\\d{2}$/),
  to: z.string().regex(/^\\d{4}-\\d{2}-\\d{2}$/),
  currency: z.string().length(3).default('EUR'),
  groupBy: z.string().max(32).default('month'),
});

router.get('/credit-notes/report', requireUser, async (req, res) => {
  const parsed = reportSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: 'période invalide' });
  const { from, to, currency, groupBy } = parsed.data;

  const totals = await prisma.$queryRaw\`
    SELECT SUM(amount) AS total FROM credit_note
    WHERE tenant_id = \${req.user.tenantId} AND currency = \${currency}
      AND issued_at BETWEEN \${from}::date AND \${to}::date\`;

  const buckets = await prisma.$queryRawUnsafe(
    \`SELECT date_trunc('\${groupBy}', issued_at) AS bucket, SUM(amount) AS total
       FROM credit_note WHERE tenant_id = $1 GROUP BY 1 ORDER BY 1\`,
    req.user.tenantId,
  );

  logger.info({ tenantId: req.user.tenantId, groupBy }, 'rapport avoirs');
  res.json({ totals, buckets });
});`,
    explain:
      'Le premier argument de $queryRawUnsafe est du SQL assemblé : « groupBy » y entre dans un littéral que l’appelant referme à volonté, et la présence de $1 juste en dessous ne protège que le tenant. Les deux leurres sont là pour ça : la ligne 23 utilise un template balisé, donc Prisma transforme chaque \${…} en paramètre lié malgré l’apparence d’une interpolation, et la ligne 28 passe bien le tenant en $1. Le nom d’une fonction ou d’une unité de date ne se paramètre pas — il se choisit dans une liste blanche (\'day\' | \'month\' | \'year\'), typée par un z.enum plutôt que par un z.string().max(32).',
  },

  {
    id: 'inj-n2-webhook-search',
    level: 2,
    file: 'routes/webhooks.ts',
    lang: 'ts',
    line: 22,
    cwe: 'CWE-943',
    options: ['CWE-943', 'CWE-89', 'CWE-95', 'CWE-1321'],
    decoys: [19, 21],
    code: `import { Router } from 'express';
import { z } from 'zod';
import { mongo } from '../lib/mongo';
import { requireUser } from '../lib/auth';

export const router = Router();

const querySchema = z.object({
  event: z.enum(['invoice.paid', 'invoice.sent', 'creditnote.issued']).optional(),
  endpointIds: z.array(z.string().uuid()).max(50).optional(),
  match: z.string().max(200).optional(),
});

router.post('/webhooks/subscriptions/search', requireUser, async (req, res) => {
  const parsed = querySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'critères invalides' });
  const { event, endpointIds, match } = parsed.data;

  const filter: Record<string, unknown> = { tenantId: req.user.tenantId };
  if (event) filter.event = event;
  if (endpointIds) filter.endpointId = { $in: endpointIds };
  if (match) filter.$where = \`this.url.indexOf('\${match}') !== -1\`;

  const subs = await mongo.collection('subscriptions').find(filter).limit(100).toArray();
  res.json({ count: subs.length, subscriptions: subs });
});`,
    explain:
      'La clause $where fait évaluer du JavaScript par le serveur Mongo, et « match » en écrit le corps : une apostrophe suivie de ") || true || (" rend le filtre vrai pour toutes les collections, tenant compris, puisque $where s’évalue document par document sans se soucier des autres clés. Les deux leurres sont sains : la ligne 19 fixe le tenant dès la construction du filtre, et la ligne 21 construit un $in à partir d’un tableau que zod a déjà validé en UUID — un opérateur écrit par le code, pas reçu de l’appelant. Une recherche de sous-chaîne se fait avec un index texte ou un $regex dont le motif est échappé, jamais en concaténant du code envoyé à la base.',
  },

  {
    id: 'inj-n2-reminder-template',
    level: 2,
    file: 'routes/templates.ts',
    lang: 'ts',
    line: 30,
    cwe: 'CWE-1336',
    options: ['CWE-1336', 'CWE-79', 'CWE-502', 'CWE-116'],
    decoys: [25, 33],
    code: `import { Router } from 'express';
import { z } from 'zod';
import ejs from 'ejs';
import { db } from '../lib/db';
import { requireUser } from '../lib/auth';
import { escapeHtml } from '../lib/html';

export const router = Router();

const previewSchema = z.object({
  subject: z.string().max(120),
  body: z.string().max(5000),
});

/** Aperçu d'un modèle de relance personnalisé par le tenant. */
router.post('/templates/reminder/preview', requireUser, async (req, res) => {
  const parsed = previewSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'modèle invalide' });
  const { subject, body } = parsed.data;

  const tenant = await db.tenants.findOne({ id: req.user.tenantId });
  const sample = await db.invoices.lastFor(req.user.tenantId);

  const data = {
    societe: escapeHtml(tenant.name),
    reference: escapeHtml(sample?.ref ?? 'FA-2025-0001'),
    montant: sample?.total ?? 0,
  };

  const render = ejs.compile(body, { cache: false });
  const html = render(data);

  res.json({ subject: escapeHtml(subject), html });
});`,
    explain:
      'ejs.compile transforme le gabarit en fonction JavaScript exécutée dans le processus : un <%= %> affiche une variable, mais <% %> exécute ce qu’on veut, y compris un require(\'child_process\'). Ici le gabarit lui-même vient de la requête, donc l’utilisateur ne remplit pas un modèle, il en écrit le code — c’est une exécution à distance déguisée en fonctionnalité de personnalisation. Les deux leurres sont des échappements corrects appliqués au mauvais problème : escapeHtml aux lignes 25 et 33 protège l’affichage des valeurs, pas la compilation du gabarit. Un modèle édité par le client se rend dans un moteur sans logique (Mustache strict, ou un remplacement de jetons {{…}} sur une liste fermée), dans un processus isolé.',
  },

  {
    id: 'inj-n2-profile-import',
    avoid: ['inj-n2-ubl-import'],
    level: 2,
    file: 'routes/export-profiles.ts',
    lang: 'ts',
    line: 23,
    cwe: 'CWE-502',
    options: ['CWE-502', 'CWE-94', 'CWE-20', 'CWE-1321'],
    decoys: [22, 25],
    code: `import { Router } from 'express';
import multer from 'multer';
import yaml from 'js-yaml';
import { z } from 'zod';
import { db } from '../lib/db';
import { requireUser } from '../lib/auth';

export const router = Router();
const upload = multer({ limits: { fileSize: 256 * 1024 } });

const profileSchema = z.object({
  name: z.string().max(80),
  columns: z.array(z.string().max(40)).max(60),
  separator: z.enum([',', ';', '\\t']),
});

/** Import d'un profil d'export comptable au format YAML. */
router.post('/exports/profiles/import', requireUser, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'fichier manquant' });
  const text = req.file.buffer.toString('utf8');

  const defaults = yaml.load(await db.tenants.defaultProfile(req.user.tenantId), { schema: yaml.JSON_SCHEMA });
  const imported = yaml.load(text, { schema: yaml.DEFAULT_FULL_SCHEMA });

  const merged = profileSchema.safeParse({ ...defaults, ...imported });
  if (!merged.success) return res.status(400).json({ error: 'profil illisible' });

  await db.exportProfiles.upsert({ tenantId: req.user.tenantId, ...merged.data });
  res.json({ imported: merged.data.name });
});`,
    explain:
      'DEFAULT_FULL_SCHEMA autorise les types YAML qui construisent des objets JavaScript, dont !!js/function : le fichier envoyé ne décrit plus des données, il fabrique du code que la moindre traversée de l’objet déclenchera. C’est la classe « désérialisation de types arbitraires » — le format choisi décide de ce que l’attaquant peut fabriquer, avant toute validation. Les deux leurres le montrent : la ligne 22 appelle exactement la même fonction sur une donnée serveur mais avec JSON_SCHEMA, qui ne produit que des scalaires, des tableaux et des objets simples ; et la validation zod de la ligne 25 arrive trop tard, l’objet dangereux existe déjà. On lit du YAML de confiance nulle avec un schéma restreint, puis on valide.',
  },

  {
    id: 'inj-n2-csv-export',
    level: 2,
    file: 'routes/exports.ts',
    lang: 'ts',
    line: 29,
    cwe: 'CWE-1236',
    options: ['CWE-1236', 'CWE-116', 'CWE-79', 'CWE-89'],
    decoys: [15, 23],
    code: `import { Router } from 'express';
import { z } from 'zod';
import { db } from '../lib/db';
import { requireUser } from '../lib/auth';

export const router = Router();

const rangeSchema = z.object({
  from: z.string().regex(/^\\d{4}-\\d{2}-\\d{2}$/),
  to: z.string().regex(/^\\d{4}-\\d{2}-\\d{2}$/),
});

/** Échappe un champ pour la grammaire CSV : guillemets doublés, champ encadré. */
function csvField(value: string): string {
  return \`"\${String(value).replace(/"/g, '""')}"\`;
}

router.get('/exports/invoices.csv', requireUser, async (req, res) => {
  const parsed = rangeSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: 'période invalide' });

  const rows = await db.query(
    'SELECT ref, client_name, label, total FROM invoices WHERE tenant_id = $1 AND issued_at BETWEEN $2 AND $3',
    [req.user.tenantId, parsed.data.from, parsed.data.to],
  );

  const lines = ['Référence;Client;Libellé;Total'];
  for (const r of rows.rows) {
    lines.push([r.ref, csvField(r.client_name), csvField(r.label), r.total].join(';'));
  }

  res.type('text/csv').send(lines.join('\\r\\n'));
});`,
    explain:
      'Un libellé de facture qui commence par =, +, - ou @ redevient une formule quand le comptable ouvre l’export dans son tableur : =cmd|\' /C calc\'!A1 ou un HYPERLINK qui exfiltre les cellules voisines vers un serveur distant. Le sink est la ligne qui assemble la ligne du fichier, car c’est là que des valeurs venues de la saisie client deviennent des cellules — et « ref » y passe même sans encadrement. Le leurre de la ligne 15 est l’essentiel de la leçon : csvField est un échappement correct, mais pour la grammaire CSV, pas pour le moteur de calcul, qui retire les guillemets avant d’interpréter la cellule. Le leurre de la ligne 23 est une requête paramétrée et filtrée par tenant. Il faut préfixer par une apostrophe les valeurs qui commencent par un caractère de formule, ou produire un vrai .xlsx où le type de cellule est explicite.',
  },

  {
    id: 'inj-n2-ubl-import',
    avoid: ['inj-n2-profile-import'],
    level: 2,
    file: 'routes/import-ubl.ts',
    lang: 'ts',
    line: 25,
    cwe: 'CWE-611',
    options: ['CWE-611', 'CWE-918', 'CWE-22', 'CWE-20'],
    decoys: [15, 31],
    code: `import { Router } from 'express';
import multer from 'multer';
import libxmljs from 'libxmljs2';
import { db } from '../lib/db';
import { requireUser } from '../lib/auth';
import { logger } from '../lib/logger';

export const router = Router();
const upload = multer({ limits: { fileSize: 2 * 1024 * 1024 } });

const UBL_NS = { cbc: 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2' };

/** Contrôle de format : lecture stricte, sans DTD ni entités ni accès réseau. */
function isUbl(xml: string): boolean {
  const doc = libxmljs.parseXml(xml, { noent: false, dtdload: false, nonet: true });
  return doc.root()?.name() === 'Invoice';
}

router.post('/invoices/import/ubl', requireUser, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'fichier manquant' });
  const xml = req.file.buffer.toString('utf8');

  if (!isUbl(xml)) return res.status(415).json({ error: 'format non reconnu' });

  const doc = libxmljs.parseXml(xml, { noent: true, dtdload: true, nonet: false });
  const ref = doc.get('//cbc:ID', UBL_NS)?.text();
  const total = Number(doc.get('//cbc:PayableAmount', UBL_NS)?.text() ?? 0);

  if (!ref) return res.status(422).json({ error: 'référence absente' });

  const invoice = await db.invoices.insertDraft({ tenantId: req.user.tenantId, ref, total });
  logger.info({ tenantId: req.user.tenantId, invoiceId: invoice.id }, 'facture UBL importée');
  res.json({ id: invoice.id, ref, total });
});`,
    explain:
      'La deuxième lecture active tout ce que la première avait coupé : noent résout les entités, dtdload charge la déclaration, nonet: false laisse l’analyseur aller la chercher. Une entité pointant sur file:///etc/passwd ou sur une URL interne se retrouve dans le champ <cbc:ID>, donc dans la référence de la facture créée — lecture de fichiers et SSRF par le même fichier. Le leurre de la ligne 15 est le même appel, correctement configuré : c’est la comparaison qui doit sauter aux yeux, deux parseXml côte à côte avec des options opposées, et le contrôle de format ne dit rien de ce que fera la lecture suivante. Le leurre de la ligne 31 est le filtrage par tenant, bien présent. Les options sûres doivent être posées dans un point d’entrée unique, pas répétées à chaque appel.',
  },

  // ─────────────────────────────── Niveau 3 ───────────────────────────────
  {
    id: 'inj-n3-vault-archive',
    level: 3,
    file: 'routes/vault.ts',
    lang: 'ts',
    line: 39,
    cwe: 'CWE-78',
    options: ['CWE-78', 'CWE-88', 'CWE-22', 'CWE-20'],
    decoys: [22, 27],
    code: `import { Router } from 'express';
import { exec, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { z } from 'zod';
import { db } from '../lib/db';
import { requireUser } from '../lib/auth';

const run = promisify(exec);
const runFile = promisify(execFile);
const VAULT = path.resolve(process.cwd(), 'storage/vault');

export const router = Router();

const archiveSchema = z.object({
  year: z.number().int().min(2015).max(2100),
  password: z.string().min(8).max(64),
});

/** Coffre d'un tenant : l'identifiant est un UUID émis par le serveur. */
function vaultDir(tenantId: string): string {
  return path.join(VAULT, tenantId);
}

router.post('/vault/verify', requireUser, async (req, res) => {
  const dir = vaultDir(req.user.tenantId);
  await runFile('7z', ['t', path.join(dir, 'archive.7z')]);
  res.json({ ok: true });
});

router.post('/vault/archive', requireUser, async (req, res) => {
  const parsed = archiveSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'paramètres invalides' });
  const { year, password } = parsed.data;

  const dir = vaultDir(req.user.tenantId);
  const out = path.join(dir, \`archive-\${year}.7z\`);

  await run(\`7z a -p\${password} \${out} \${path.join(dir, String(year))}\`);

  await db.vaultJobs.insert({ tenantId: req.user.tenantId, year, at: new Date() });
  res.json({ archive: path.basename(out) });
});`,
    explain:
      'Deux routes appellent le même binaire ; une seule construit une ligne de commande. Le mot de passe est validé en longueur mais reste une chaîne libre, et exec l’interprète dans un shell : « motdepasse; curl … | sh » s’exécute avec les droits du service. L’année est bien un entier et le chemin est dérivé d’un UUID serveur — regarder la validation ne suffit pas, il faut regarder la fonction d’exécution. Les deux leurres sont sains : la ligne 27 fait le même travail avec execFile et un tableau d’arguments, ce qui supprime le shell, et la ligne 22 compose un chemin à partir d’un identifiant que le client ne choisit pas. La règle est structurelle : exec n’a aucune raison d’exister dans une base de code, execFile ou spawn avec un tableau couvre tous les usages.',
  },

  {
    id: 'inj-n3-webhook-rules',
    level: 3,
    file: 'routes/webhook-rules.ts',
    lang: 'ts',
    line: 26,
    cwe: 'CWE-94',
    options: ['CWE-94', 'CWE-1336', 'CWE-1321', 'CWE-20'],
    decoys: [20, 25],
    code: `import vm from 'node:vm';
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../lib/db';
import { requireUser } from '../lib/auth';
import { logger } from '../lib/logger';

export const router = Router();

const ruleSchema = z.object({
  name: z.string().max(60),
  expression: z.string().max(300),
});

const ALLOWED_FIELDS = ['event', 'amount', 'currency', 'clientId'] as const;

/** Refuse une expression qui mentionne autre chose que les champs autorisés. */
function mentionsOnlyAllowedFields(expression: string): boolean {
  const identifiers = expression.match(/[A-Za-z_$][A-Za-z0-9_$]*/g) ?? [];
  return identifiers.every((id) => (ALLOWED_FIELDS as readonly string[]).includes(id));
}

/** Évalue la règle sur un événement d'exemple, pour l'aperçu de l'interface. */
function evaluate(expression: string, sample: Record<string, unknown>): boolean {
  const context = vm.createContext({ ...sample });
  return Boolean(vm.runInContext(expression, context, { timeout: 50 }));
}

router.post('/webhooks/rules', requireUser, async (req, res) => {
  const parsed = ruleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'règle invalide' });
  const { name, expression } = parsed.data;

  const sample = await db.webhookEvents.lastFor(req.user.tenantId);
  const preview = evaluate(expression, {
    event: sample?.type ?? 'invoice.paid',
    amount: sample?.amount ?? 0,
    currency: sample?.currency ?? 'EUR',
    clientId: sample?.clientId ?? null,
  });

  await db.webhookRules.insert({ tenantId: req.user.tenantId, name, expression, preview });
  logger.info({ tenantId: req.user.tenantId, name }, 'règle de webhook enregistrée');
  res.json({ name, preview });
});`,
    explain:
      'node:vm n’est pas un bac à sable, la documentation le dit : le contexte partage les primitives du processus, et this.constructor.constructor(\'return process\')() en ressort en une expression. L’expression de la règle vient du client et arrive telle quelle dans runInContext, donc c’est une exécution de code à distance, avec ou sans timeout. Deux leurres travaillent ensemble : mentionsOnlyAllowedFields est une liste blanche d’identifiants écrite correctement mais que personne n’appelle — le défaut est ici autant une absence qu’une ligne — et createContext donne l’impression d’une frontière de sécurité alors qu’il ne fait qu’isoler des variables globales. Une règle client s’exprime dans une grammaire fermée qu’on analyse soi-même (champ, opérateur, littéral) ; si du vrai code doit tourner, c’est dans un processus séparé, sans réseau et sans système de fichiers.',
  },

  {
    id: 'inj-n3-sso-provision',
    level: 3,
    file: 'routes/sso.ts',
    lang: 'ts',
    line: 36,
    cwe: 'CWE-90',
    options: ['CWE-90', 'CWE-943', 'CWE-116', 'CWE-89'],
    decoys: [21, 32],
    code: `import { Router } from 'express';
import { z } from 'zod';
import { ldap } from '../lib/ldap';
import { db } from '../lib/db';
import { requireUser } from '../lib/auth';

export const router = Router();

const lookupSchema = z.object({
  login: z.string().min(1).max(64),
  group: z.string().min(1).max(64),
});

/** Échappe les caractères spéciaux d'un nom distinctif (RFC 4514). */
function escapeDn(value: string): string {
  return value.replace(/([\\\\,+"<>;=#])/g, '\\\\$1');
}

/** Échappe les caractères spéciaux d'un filtre de recherche (RFC 4515). */
function escapeFilter(value: string): string {
  return value.replace(/([*()\\\\\\u0000])/g, (c) => '\\\\' + c.charCodeAt(0).toString(16).padStart(2, '0'));
}

router.post('/sso/provision', requireUser, async (req, res) => {
  const parsed = lookupSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'demande invalide' });
  const { login, group } = parsed.data;

  const directory = await db.directories.findOne({ tenantId: req.user.tenantId });
  if (!directory) return res.status(409).json({ error: 'aucun annuaire configuré' });

  const groupDn = \`cn=\${escapeDn(group)},\${directory.groupsBaseDn}\`;

  const entries = await ldap.search(directory.usersBaseDn, {
    scope: 'sub',
    filter: \`(&(objectClass=inetOrgPerson)(memberOf=\${escapeDn(groupDn)})(uid=\${escapeDn(login)}))\`,
  });

  if (entries.length !== 1) return res.status(404).json({ error: 'compte introuvable' });

  await db.users.upsert({ tenantId: req.user.tenantId, login, dn: entries[0].dn, source: 'ldap' });
  res.json({ provisioned: login, dn: entries[0].dn });
});`,
    explain:
      'Le filtre est bien échappé — avec la mauvaise fonction. escapeDn neutralise les caractères d’un nom distinctif et laisse passer les parenthèses, les étoiles et les esperluettes, qui sont précisément la syntaxe d’un filtre : un login comme « *)(uid=* » transforme la recherche en « n’importe quel compte » et provisionne un utilisateur qui n’a jamais existé dans le groupe demandé. Les deux leurres disent pourquoi c’est difficile à voir : la ligne 32 applique escapeDn là où il faut, à la construction d’un DN, et la ligne 21 contient l’échappement correct pour le filtre, écrit, testé, mais jamais appelé. Un échappement n’est valable que pour une grammaire ; le nommage des helpers doit rendre la confusion impossible, et une recherche d’annuaire se fait avec un client qui assemble le filtre à partir de valeurs typées plutôt qu’à partir de chaînes.',
  },
];

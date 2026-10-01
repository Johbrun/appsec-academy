// PR du jeu « Diff Review » (M16). Chaque ligne de diff commence par '+', '-' ou ' '.
// Un problème est rattaché aux lignes qui contiennent l'une de ses chaînes `match`.
//
// Le jeu demande de commenter les lignes à risque, de qualifier chaque
// commentaire, puis de décider : approuver ou demander des changements. La
// difficulté ne vient pas de la gravité du défaut, mais de ce qu'il faut lire
// pour le voir, et de ce qu'il ne faut pas commenter.
//
//   N1 · Une PR courte, un fichier, un défaut net dans les lignes ajoutées.
//        Rien d'autre ne ressemble à un problème et la décision va de soi. On
//        apprend à lire un diff et à qualifier un commentaire.
//
//   N2 · Une PR de taille réelle (deux fichiers, ou une trentaine de lignes)
//        avec des **lignes saines qui attirent l'œil** : une requête SQL
//        paramétrée à côté d'une qui ne l'est pas, une valeur convertie par
//        String() à côté d'une qui ne l'est pas, une signature HMAC correcte.
//        Ou une PR bonne dont le seul défaut est une suggestion : il faut
//        savoir approuver.
//
//   N3 · Le défaut n'existe que par **ce que la PR retire ou déplace** : un
//        contrôle supprimé dans un « nettoyage », un middleware remonté ou
//        descendu, une vérification qui ne précède plus l'effet, un `select`
//        qui disparaît. Ou bien la PR est juste malgré des lignes alarmantes
//        (execFile, rm récursif, un 200 renvoyé sans traitement), et la bonne
//        décision est d'approuver sans commentaire.

import { defineSeries, type SeriesProfile } from '../lib/series';

export type Severity = 'bloquant' | 'corriger' | 'suggestion';
export const severityLabels: Record<Severity, string> = { bloquant: 'Bloquant', corriger: 'À corriger', suggestion: 'Suggestion' };

export type PrFile = { path: string; lang: string; lines: string[] };
export type PrIssue = { file: number; match: string[]; sev: Severity; text: string };
/** Une ligne saine qui attire l'œil, expliquée à la correction. */
export type PrDecoy = { file: number; match: string; text: string };
export type PullRequest = {
  id: string; number: number; title: string; author: string; bot?: boolean; body: string; files: PrFile[]; issues: PrIssue[];
  level: 1 | 2 | 3;
  decoys?: PrDecoy[];
  /** Ce que la correction dit de la décision, quand elle mérite une explication (PR à approuver). */
  verdict?: string;
  /** `retrait` : le défaut tient à une ligne retirée ou déplacée ; `approuver` : la bonne décision est d'approuver. */
  tags?: string[];
  avoid?: string[];
};

export const pullRequests: PullRequest[] = [
  {
    id: 'pdf',
    level: 1,
    number: 412,
    title: 'feat(invoices): téléchargement du PDF d’une facture',
    author: 'lea-m',
    body: 'Ajoute un lien de téléchargement direct du PDF depuis la liste des factures. Testé en local sur mon tenant.',
    files: [{
      path: 'apps/api/src/routes/invoices-pdf.ts', lang: 'ts', lines: [
        " import { Router } from 'express';",
        " import { prisma } from '../db';",
        " import { requireAuth } from '../auth';",
        "+import { presign } from '../storage';",
        " ",
        " export const router = Router();",
        "+",
        "+router.get('/invoices/:id/pdf', requireAuth, async (req, res) => {",
        "+  const invoice = await prisma.invoice.findUnique({ where: { id: req.params.id } });",
        "+  const url = await presign(invoice.pdfKey, 7 * 24 * 3600);",
        "+  res.redirect(url);",
        "+});",
      ],
    }],
    issues: [
      { file: 0, match: ['findUnique'], sev: 'bloquant', text: 'Lecture par identifiant sans filtre de tenant : n’importe quel utilisateur connecté télécharge la facture d’un autre tenant (BOLA). Passer par invoices.get(tenantOf(req), id).' },
      { file: 0, match: ['presign('], sev: 'corriger', text: 'Une URL présignée de 7 jours circule (e-mails, historique, proxys) bien après la session. Quelques minutes suffisent pour une redirection immédiate.' },
    ],
  },
  {
    id: 'ci',
    level: 1,
    number: 418,
    title: 'chore(ci): déploiement de preview pour chaque PR',
    author: 'karim-devops',
    body: 'Chaque PR, y compris celles des contributeurs externes du SDK, obtient une URL de preview. Le token Vercel est dans les secrets du dépôt.',
    files: [{
      path: '.github/workflows/preview.yml', lang: 'yaml', lines: [
        '+name: preview',
        '+on:',
        '+  pull_request_target:',
        '+    types: [opened, synchronize]',
        '+permissions: write-all',
        '+jobs:',
        '+  preview:',
        '+    runs-on: ubuntu-latest',
        '+    steps:',
        '+      - uses: actions/checkout@v4',
        '+        with:',
        '+          ref: ${{ github.event.pull_request.head.sha }}',
        '+      - uses: actions/setup-node@v4',
        '+        with:',
        '+          node-version: 22',
        '+      - run: npm ci && npm run build',
        '+      - run: echo "Preview de ${{ github.event.pull_request.title }}"',
        '+      - run: npx vercel deploy --token ${{ secrets.VERCEL_TOKEN }}',
      ],
    }],
    issues: [
      { file: 0, match: ['head.sha', 'npm ci'], sev: 'bloquant', text: 'pull_request_target s’exécute avec les secrets et un jeton en écriture. Récupérer puis construire le code de la PR (npm ci exécute ses scripts) donne ce contexte à du code externe : c’est la poisoned pipeline execution (CICD-SEC-4). Construire dans un workflow pull_request sans secrets.' },
      { file: 0, match: ['pull_request.title'], sev: 'bloquant', text: 'Une donnée contrôlée par l’auteur de la PR est interpolée dans un script shell : injection de commande. Passer la valeur par une variable d’environnement.' },
      { file: 0, match: ['write-all'], sev: 'corriger', text: 'Le GITHUB_TOKEN reçoit tous les droits. Déclarer le minimum nécessaire (contents: read).' },
      { file: 0, match: ['actions/checkout@v4', 'actions/setup-node@v4'], sev: 'suggestion', text: 'Épingler les actions tierces par SHA de commit plutôt que par tag mutable.' },
    ],
  },
  {
    id: 'agent',
    level: 2,
    number: 425,
    title: 'feat(assistant): outil MCP de recherche de clients',
    author: 'novafact-agent[bot]',
    bot: true,
    body: 'Généré à partir de l’issue #398 « L’assistant doit pouvoir retrouver un client par son nom ». Ajoute un outil search_customers au serveur MCP.',
    files: [
      {
        path: 'apps/assistant/package.json', lang: 'json', lines: [
          '   "dependencies": {',
          '     "@modelcontextprotocol/sdk": "^1.12.0",',
          '+    "mcp-prisma-helpers": "^1.0.2",',
          '     "@prisma/client": "^6.8.0",',
          '     "zod": "^3.25.0"',
          '   }',
        ],
      },
      {
        path: 'apps/assistant/src/tools/search-customers.ts', lang: 'ts', lines: [
          "+import { defineTool } from 'mcp-prisma-helpers';",
          "+import { prisma } from '../db';",
          '+',
          '+export const searchCustomers = defineTool({',
          "+  name: 'search_customers',",
          "+  description: 'Recherche des clients par nom',",
          '+  handler: async ({ q }, ctx) => {',
          "+    console.log('search_customers', q, ctx.token);",
          '+    return prisma.$queryRawUnsafe(',
          '+      `SELECT id, name, email, iban FROM "Customer" ` +',
          "+      `WHERE name ILIKE '%${q}%'`",
          '+    );',
          '+  },',
          '+});',
        ],
      },
    ],
    issues: [
      { file: 0, match: ['mcp-prisma-helpers'], sev: 'bloquant', text: 'Paquet inconnu de l’équipe, ajouté par un agent : vérifier qu’il existe, qui le publie et depuis quand. Ici il a été publié il y a trois jours par un compte anonyme : un cas typique de slopsquatting.' },
      { file: 1, match: ['queryRawUnsafe', 'ILIKE'], sev: 'bloquant', text: 'Requête SQL construite par interpolation d’une valeur fournie par le modèle : injection. Utiliser prisma.customer.findMany avec contains, ou $queryRaw en template balisé.' },
      { file: 1, match: ['SELECT id'], sev: 'bloquant', text: 'Aucun filtre de tenant, et l’IBAN est renvoyé au modèle : l’outil expose les clients de tous les tenants, avec des données inutiles à la tâche.' },
      { file: 1, match: ['ctx.token'], sev: 'corriger', text: 'Le jeton de l’utilisateur part dans les logs. Journaliser l’outil et le tenant, jamais les secrets.' },
    ],
  },
  {
    id: 'webhook',
    level: 3,
    tags: ['approuver'],
    verdict: 'La PR remplace une comparaison fragile par la vérification officielle, à temps constant et avec tolérance d’horodatage, et ignore les rejeux. Savoir approuver vite une bonne PR fait aussi partie du travail.',
    number: 431,
    title: 'fix(webhooks): vérification Stripe via le SDK officiel',
    author: 'sam-b',
    body: 'Remplace notre comparaison maison par constructEvent (comparaison à temps constant, tolérance de 5 minutes) et ignore les événements déjà traités.',
    files: [{
      path: 'apps/api/src/webhooks/stripe.ts', lang: 'ts', lines: [
        "-router.post('/webhooks/stripe', express.raw({ type: 'application/json' }), (req, res) => {",
        "+router.post('/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {",
        "   const header = req.header('stripe-signature') ?? '';",
        '-  const expected = sign(req.body, secret);',
        '-  if (header !== expected) return res.sendStatus(400);',
        '+  let event: Stripe.Event;',
        '+  try {',
        '+    event = stripe.webhooks.constructEvent(req.body, header, secret, 300);',
        '+  } catch {',
        '+    return res.sendStatus(400);',
        '+  }',
        '+  if (await processed.has(event.id)) return res.sendStatus(200);',
        '   await handle(event);',
        '+  await processed.add(event.id);',
        '   res.sendStatus(200);',
        ' });',
      ],
    }],
    issues: [],
    decoys: [
      { file: 0, match: "express.raw({ type: 'application/json' }), async", text: 'Le corps brut est indispensable : la signature Stripe porte sur les octets reçus, et un corps déjà parsé puis resérialisé ne la vérifie plus.' },
      { file: 0, match: 'processed.has(event.id)', text: 'Répondre 200 à un événement déjà traité, sans le rejouer, est exactement ce que Stripe attend : il réessaie tant qu’il n’a pas reçu de 2xx. La vérification de signature a déjà eu lieu au-dessus.' },
    ],
  },
  {
    id: 'notes',
    level: 1,
    number: 437,
    title: 'feat(web): aperçu des notes de facture en Markdown',
    author: 'ines-front',
    body: 'Les clients peuvent désormais mettre en forme la note de leurs factures (gras, listes, liens). Rendu avec marked.',
    files: [{
      path: 'apps/web/src/invoices/NotePreview.tsx', lang: 'tsx', lines: [
        "+import { marked } from 'marked';",
        '+',
        '+export function NotePreview({ invoice }: { invoice: Invoice }) {',
        '+  return (',
        '+    <aside className="note">',
        '+      <h3>{invoice.customer.name}</h3>',
        '+      <a href={invoice.customer.website}>Site du client</a>',
        '+      {/* eslint-disable-next-line react/no-danger */}',
        '+      <div dangerouslySetInnerHTML={{ __html: marked.parse(invoice.note) }} />',
        '+    </aside>',
        '+  );',
        '+}',
      ],
    }],
    issues: [
      { file: 0, match: ['dangerouslySetInnerHTML', 'eslint-disable'], sev: 'bloquant', text: 'Du HTML produit à partir d’une saisie client, sans assainissement : XSS stockée, vue par tous les destinataires. Passer par le composant SafeMarkdown (DOMPurify) de l’équipe, et ne pas désactiver la règle de lint.' },
      { file: 0, match: ['href={invoice'], sev: 'corriger', text: 'Une URL saisie par un client est rendue en lien sans contrôle du schéma : javascript: reste possible, React ne fait qu’avertir. Valider https: à l’enregistrement et à l’affichage.' },
    ],
  },
  {
    id: 'refactor',
    level: 3,
    tags: ['retrait'],
    number: 442,
    title: 'refactor(api): simplification de la route des avoirs',
    author: 'theo-api',
    body: 'Nettoyage : suppression d’un import inutilisé et ajout d’un log pour le support.',
    files: [{
      path: 'apps/api/src/routes/credit-notes.ts', lang: 'ts', lines: [
        " import { defineRoute } from '../http';",
        "-import { requireRole } from '../auth';",
        " import { creditNotes } from '../dal';",
        " import { logger } from '../log';",
        ' ',
        ' export const createCreditNote = defineRoute({',
        "   method: 'POST',",
        "   path: '/invoices/:id/credit-notes',",
        '   schema: CreateCreditNote,',
        "-  guard: requireRole('accountant'),",
        '   handler: async ({ tenant, params, body }) => {',
        '-    return creditNotes.create(tenant, params.id, body);',
        '+    const note = await creditNotes.create(tenant, params.id, body);',
        "+    logger.info({ note, body }, 'credit note created');",
        '+    return note;',
        '   },',
        ' });',
      ],
    }],
    issues: [
      { file: 0, match: ["guard: requireRole", "import { requireRole }"], sev: 'bloquant', text: 'Le contrôle de rôle disparaît dans un « nettoyage » : tout membre du tenant, même Lecteur, peut émettre un avoir (BFLA). Une ligne supprimée se relit aussi.' },
      { file: 0, match: ['logger.info'], sev: 'suggestion', text: 'Le corps complet est journalisé. L’identifiant de l’avoir et le montant suffisent au support ; éviter d’y faire passer des données personnelles.' },
    ],
    decoys: [
      { file: 0, match: '+    const note = await creditNotes.create(tenant', text: 'Le tenant vient toujours du contexte de la requête : l’avoir reste cloisonné. Ce que la PR retire est le contrôle de rôle, pas le contrôle de tenant.' },
    ],
  },

  // ── N1 ────────────────────────────────────────────────────────────────────
  {
    id: 'attachments',
    level: 1,
    number: 446,
    title: 'feat(attachments): téléchargement des pièces jointes',
    author: 'nadia-api',
    body: 'Les pièces jointes sont rangées par tenant sur le volume partagé. Cette route les sert à l’utilisateur connecté, dans le dossier de son tenant.',
    files: [{
      path: 'apps/api/src/routes/attachments.ts', lang: 'ts', lines: [
        " import path from 'node:path';",
        " import { Router } from 'express';",
        " import { requireAuth } from '../auth';",
        ' ',
        ' export const router = Router();',
        " const UPLOAD_DIR = '/var/novafact/uploads';",
        '+',
        "+router.get('/attachments', requireAuth, (req, res) => {",
        '+  const file = path.join(UPLOAD_DIR, req.user.tenantId, String(req.query.name));',
        '+  res.sendFile(file);',
        '+});',
      ],
    }],
    issues: [
      { file: 0, match: ['path.join(UPLOAD_DIR', 'res.sendFile(file)'], sev: 'bloquant', text: 'path.join résout les « .. » au lieu de les refuser : name=../t_42/contrat.pdf sort du dossier du tenant, et ../../../../etc/passwd du volume. Donner le dossier en option root (res.sendFile(name, { root })), qui rejette toute remontée, ou vérifier que le chemin résolu commence bien par le dossier du tenant.' },
    ],
  },
  {
    id: 'jwt-decode',
    level: 1,
    number: 449,
    title: 'fix(auth): accepter les jetons du nouveau fournisseur SSO',
    author: 'theo-api',
    body: 'Les clients passés sur le SSO recevaient des 401 depuis ce matin. Correctif rapide en attendant la récupération des clés du fournisseur.',
    files: [{
      path: 'apps/api/src/auth/require-auth.ts', lang: 'ts', lines: [
        " import jwt from 'jsonwebtoken';",
        ' ',
        ' export function requireAuth(req: Request, res: Response, next: NextFunction) {',
        "   const token = req.header('authorization')?.replace(/^Bearer /, '');",
        '   if (!token) return res.sendStatus(401);',
        '   try {',
        "-    req.user = jwt.verify(token, publicKey, { algorithms: ['RS256'], issuer: ISSUER });",
        '+    // Le SSO signe avec une clé que nous ne récupérons pas encore : on lit le jeton en attendant.',
        '+    req.user = jwt.decode(token) as AuthUser;',
        '     next();',
        '-  } catch {',
        '-    res.sendStatus(401);',
        '+  } catch (err) {',
        '+    res.status(401).json({ error: (err as Error).message });',
        '   }',
        ' }',
      ],
    }],
    issues: [
      { file: 0, match: ['jwt.decode', 'on lit le jeton en attendant'], sev: 'bloquant', text: 'decode lit le contenu du jeton sans vérifier la signature : n’importe qui fabrique un jeton { "sub": "…", "role": "admin" } et il est accepté. Récupérer les clés publiques du fournisseur (JWKS) et garder verify, avec l’algorithme et l’émetteur attendus.' },
      { file: 0, match: ['(err as Error).message'], sev: 'suggestion', text: 'Le message d’erreur part au client. Un 401 sans détail suffit ; la cause va dans les journaux.' },
    ],
  },

  // ── N2 ────────────────────────────────────────────────────────────────────
  {
    id: 'search-sort',
    level: 2,
    number: 451,
    title: 'feat(invoices): recherche et tri dans la liste des factures',
    author: 'lea-m',
    body: 'Recherche par nom de client, tri par colonne, pagination. Requête SQL écrite à la main pour profiter de l’index trigramme sur customer_name.',
    files: [
      {
        path: 'apps/api/src/routes/invoices-search.ts', lang: 'ts', lines: [
          " import { Router } from 'express';",
          " import { z } from 'zod';",
          " import { requireAuth, tenantOf } from '../auth';",
          "+import { searchInvoices } from '../dal/invoices-search';",
          ' ',
          ' export const router = Router();',
          '+',
          '+const Query = z.object({',
          "+  q: z.string().max(100).default(''),",
          "+  sort: z.string().default('issued_at'),",
          "+  dir: z.enum(['asc', 'desc']).default('desc'),",
          '+  limit: z.coerce.number().int().min(1).max(200).default(50),',
          '+});',
          '+',
          "+router.get('/invoices/search', requireAuth, async (req, res) => {",
          '+  const query = Query.parse(req.query);',
          '+  res.json(await searchInvoices(tenantOf(req), query));',
          '+});',
        ],
      },
      {
        path: 'apps/api/src/dal/invoices-search.ts', lang: 'ts', lines: [
          "+import { Prisma } from '@prisma/client';",
          "+import { prisma } from '../db';",
          '+',
          "+type Search = { q: string; sort: string; dir: 'asc' | 'desc'; limit: number };",
          '+',
          '+export function searchInvoices(tenantId: string, { q, sort, dir, limit }: Search) {',
          '+  return prisma.$queryRaw`',
          '+    SELECT id, number, customer_name, total, issued_at',
          '+    FROM invoices',
          '+    WHERE tenant_id = ${tenantId}',
          "+      AND customer_name ILIKE ${'%' + q + '%'}",
          '+    ORDER BY ${Prisma.raw(sort)} ${Prisma.raw(dir)}',
          '+    LIMIT ${limit}',
          '+  `;',
          '+}',
        ],
      },
    ],
    issues: [
      { file: 1, match: ['Prisma.raw(sort)'], sev: 'bloquant', text: 'Prisma.raw insère le texte tel quel dans la requête, et sort est une chaîne libre : injection SQL (un CASE WHEN … glissé dans sort extrait des données bit à bit, par l’ordre des résultats). Un nom de colonne ne se paramètre pas ; il se choisit dans une liste : z.enum([\'issued_at\', \'total\', \'number\']).' },
    ],
    decoys: [
      { file: 1, match: 'prisma.$queryRaw`', text: '$queryRaw employé comme gabarit balisé transforme chaque ${…} en paramètre lié : ce n’est pas de la concaténation. C’est Prisma.raw, plus bas, qui sort de ce mécanisme.' },
      { file: 1, match: "ILIKE ${'%' + q + '%'}", text: 'La concaténation se fait en JavaScript, puis la chaîne entière est passée comme paramètre : aucune injection possible. Les jokers % et _ saisis par l’utilisateur restent actifs, ce qui n’est qu’une question de pertinence.' },
      { file: 0, match: "dir: z.enum(['asc', 'desc'])", text: 'dir passe aussi par Prisma.raw, mais zod le réduit à deux valeurs connues : c’est exactement le traitement qui manque à sort, une ligne au-dessus.' },
    ],
  },
  {
    id: 'reset-host',
    level: 2,
    number: 455,
    title: 'feat(auth): réinitialisation du mot de passe par e-mail',
    author: 'sam-b',
    body: 'Jeton aléatoire de 256 bits, stocké haché, valable 30 minutes. Le lien pointe vers le domaine d’où vient la requête pour fonctionner aussi en préproduction.',
    files: [{
      path: 'apps/api/src/routes/password-reset.ts', lang: 'ts', lines: [
        "+import { createHash, randomBytes } from 'node:crypto';",
        "+import { Router } from 'express';",
        "+import { resetTokens, users } from '../dal';",
        "+import { mailer } from '../mail';",
        '+',
        '+export const router = Router();',
        "+const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');",
        '+',
        "+router.post('/password-reset', async (req, res) => {",
        '+  const user = await users.byEmail(String(req.body.email));',
        "+  if (!user) return res.status(404).json({ error: 'Aucun compte pour cette adresse' });",
        "+  const token = randomBytes(32).toString('base64url');",
        '+  await resetTokens.create(user.id, sha256(token), new Date(Date.now() + 30 * 60_000));',
        '+  const link = `https://${req.headers.host}/reset?token=${token}`;',
        "+  await mailer.send(user.email, 'Réinitialiser votre mot de passe', link);",
        '+  res.sendStatus(204);',
        '+});',
      ],
    }],
    issues: [
      { file: 0, match: ['req.headers.host'], sev: 'bloquant', text: 'L’en-tête Host est choisi par l’appelant. L’attaquant demande une réinitialisation pour la victime avec Host: novafact.attaquant.example : la victime reçoit un vrai e-mail de Novafact, clique, et le jeton part chez l’attaquant. L’URL publique vient de la configuration, jamais de la requête.' },
      { file: 0, match: ['Aucun compte pour cette adresse'], sev: 'corriger', text: 'Un 404 distinct révèle quelles adresses ont un compte. Répondre 204 dans tous les cas, et garder un temps de réponse comparable (envoi en file d’attente).' },
    ],
    decoys: [
      { file: 0, match: "randomBytes(32).toString('base64url')", text: '256 bits issus du générateur cryptographique : impossible à deviner.' },
      { file: 0, match: 'sha256(token)', text: 'Un hachage rapide suffit pour un jeton aléatoire de 256 bits : il n’y a pas de dictionnaire à tester. Argon2 ou bcrypt ne servent que pour des secrets choisis par des humains.' },
    ],
  },
  {
    id: 'argon2-rehash',
    level: 2,
    number: 458,
    title: 'chore(auth): migration des empreintes de bcrypt vers Argon2id',
    author: 'theo-api',
    tags: ['approuver'],
    body: 'Les nouvelles empreintes passent en Argon2id (paramètres OWASP). Les anciennes sont migrées à la volée, à la prochaine connexion réussie ; bcrypt sera retiré quand il n’en restera plus.',
    files: [{
      path: 'apps/api/src/auth/passwords.ts', lang: 'ts', lines: [
        " import bcrypt from 'bcrypt';",
        "+import argon2 from 'argon2';",
        " import { users } from '../dal';",
        "+import { logger } from '../log';",
        ' ',
        '-export async function verifyPassword(user: User, password: string) {',
        '-  return bcrypt.compare(password, user.passwordHash);',
        '-}',
        '+const ARGON2 = { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 };',
        '+',
        '+export async function verifyPassword(user: User, password: string) {',
        "+  if (user.passwordHash.startsWith('$2')) {",
        '+    // Ancienne empreinte bcrypt : on vérifie, puis on ré-empreinte au passage.',
        '+    const ok = await bcrypt.compare(password, user.passwordHash);',
        '+    if (ok) {',
        '+      await users.setPasswordHash(user.id, await argon2.hash(password, ARGON2));',
        "+      logger.info({ email: user.email }, 'empreinte migrée vers argon2id');",
        '+    }',
        '+    return ok;',
        '+  }',
        '+  return argon2.verify(user.passwordHash, password);',
        '+}',
        '+',
        '+export const hashPassword = (password: string) => argon2.hash(password, ARGON2);',
      ],
    }],
    issues: [
      { file: 0, match: ['email: user.email'], sev: 'suggestion', text: 'L’adresse e-mail n’apporte rien à ce journal et en fait une donnée personnelle à gérer. user.id suffit pour suivre la migration.' },
    ],
    verdict: 'Une suggestion ne bloque pas une fusion. La PR suit la méthode recommandée : Argon2id aux paramètres minimaux de l’OWASP (19 Mio, 2 passes), ré-empreinte au moment où le mot de passe en clair est disponible, c’est-à-dire après une connexion réussie. Garder bcrypt.compare pendant la transition est le prix de cette migration, pas un défaut.',
    decoys: [
      { file: 0, match: '+    const ok = await bcrypt.compare', text: 'bcrypt reste nécessaire tant qu’il existe des empreintes bcrypt : sans lui, ces utilisateurs ne pourraient plus se connecter.' },
      { file: 0, match: "startsWith('$2')", text: 'Les empreintes bcrypt commencent par $2a$, $2b$ ou $2y$ ; celles d’Argon2 par $argon2id$. Le préfixe identifie l’algorithme sans ambiguïté.' },
    ],
  },
  {
    id: 'magic-link',
    level: 2,
    number: 461,
    title: 'feat(portal): connexion au portail client par lien magique',
    author: 'nadia-api',
    body: 'Les contacts clients se connectent au portail sans mot de passe : un lien valable 15 minutes, à usage unique. Limitation de débit sur la vérification.',
    files: [{
      path: 'apps/portal/src/routes/magic-link.ts', lang: 'ts', lines: [
        " import { Router } from 'express';",
        " import { db } from '../mongo';",
        " import { rateLimit } from '../limits';",
        "+import { issueSession } from '../session';",
        ' ',
        ' export const router = Router();',
        '+',
        "+router.post('/magic-link/verify', rateLimit({ max: 10, windowMs: 60_000 }), async (req, res) => {",
        '+  const email = String(req.body.email).trim().toLowerCase();',
        "+  const contact = await db.collection('contacts').findOne({",
        '+    email,',
        '+    magicToken: req.body.token,',
        '+    magicTokenExpiresAt: { $gt: new Date() },',
        '+  });',
        '+  if (!contact) return res.sendStatus(401);',
        "+  await db.collection('contacts').updateOne({ _id: contact._id }, { $unset: { magicToken: '' } });",
        '+  res.json(await issueSession(contact));',
        '+});',
      ],
    }],
    issues: [
      { file: 0, match: ['magicToken: req.body.token'], sev: 'bloquant', text: 'Le corps JSON peut contenir un objet : { "token": { "$ne": null } } devient un opérateur MongoDB, et il suffit de demander un lien pour la victime puis de le « vérifier » sans le connaître. C’est la famille de CVE-2021-22911 (Rocket.Chat, 2021), où $regex permettait d’extraire un jeton de réinitialisation caractère par caractère. String(req.body.token), ou un schéma qui impose une chaîne.' },
    ],
    decoys: [
      { file: 0, match: 'String(req.body.email)', text: 'String() transforme tout objet en « [object Object] » : l’e-mail ne peut plus porter d’opérateur. C’est le traitement qui manque au jeton, trois lignes plus bas.' },
      { file: 0, match: '$gt: new Date()', text: 'Un opérateur écrit par le serveur, avec une valeur du serveur : c’est une requête, pas une injection.' },
      { file: 0, match: 'rateLimit({ max: 10', text: 'La limite de débit freine la recherche d’un jeton par force brute, mais pas l’injection : un seul essai suffit avec $ne.' },
    ],
  },
  {
    id: 'webhook-ssrf',
    level: 2,
    number: 464,
    title: 'feat(integrations): webhooks sortants configurables',
    author: 'lea-m',
    body: 'Les administrateurs d’un tenant déclarent une URL qui reçoit les événements de facturation, signés en HMAC. Le journal des livraisons affiche la réponse du destinataire pour aider au débogage.',
    files: [
      {
        path: 'apps/api/src/routes/webhooks.ts', lang: 'ts', lines: [
          "+router.post('/webhooks', requireAuth, requireRole('admin'), async (req, res) => {",
          '+  const url = new URL(String(req.body.url));',
          "+  if (url.protocol !== 'https:' || url.hostname === 'localhost') {",
          "+    return res.status(400).json({ error: 'URL non autorisée' });",
          '+  }',
          "+  const hook = await webhooks.create(tenantOf(req), url.toString(), randomBytes(32).toString('hex'));",
          '+  res.status(201).json(hook);',
          '+});',
        ],
      },
      {
        path: 'apps/api/src/integrations/deliver.ts', lang: 'ts', lines: [
          "+import { createHmac } from 'node:crypto';",
          "+import { webhooks } from '../dal';",
          '+',
          '+export async function deliver(tenantId: string, event: InvoiceEvent) {',
          '+  for (const hook of await webhooks.list(tenantId)) {',
          '+    const body = JSON.stringify(event);',
          "+    const signature = createHmac('sha256', hook.secret).update(body).digest('hex');",
          '+    const res = await fetch(hook.url, {',
          "+      method: 'POST',",
          "+      headers: { 'content-type': 'application/json', 'x-novafact-signature': signature },",
          '+      body,',
          '+      signal: AbortSignal.timeout(5000),',
          '+    });',
          '+    await webhooks.logDelivery(hook.id, res.status, await res.text());',
          '+  }',
          '+}',
        ],
      },
    ],
    issues: [
      { file: 0, match: ["url.hostname === 'localhost'"], sev: 'bloquant', text: 'Refuser « localhost » ne refuse ni 127.0.0.1, ni 10.0.0.0/8, ni un nom public qui se résout vers une adresse interne. Et fetch suit les redirections : une URL https externe peut renvoyer vers un service interne en http. C’est une SSRF qui a mené aux identifiants du rôle d’instance chez Capital One en 2019. Résoudre le nom, refuser les plages privées et de lien local au moment de l’envoi, et ne pas suivre les redirections.' },
      { file: 1, match: ['logDelivery'], sev: 'corriger', text: 'Afficher le corps de la réponse au client transforme une SSRF aveugle en lecture : tout ce que renvoie un service interne s’affiche dans le journal. Le statut et la durée suffisent au débogage.' },
    ],
    decoys: [
      { file: 1, match: "createHmac('sha256', hook.secret)", text: 'Signer le corps en HMAC avec un secret propre à chaque webhook permet au destinataire de vérifier l’origine. Bonne pratique.' },
      { file: 1, match: 'AbortSignal.timeout(5000)', text: 'Un délai maximal évite qu’un destinataire lent bloque la file de livraison. Utile, sans rapport avec la destination.' },
      { file: 0, match: "requireRole('admin')", text: 'Seuls les administrateurs du tenant déclarent un webhook : c’est le bon rôle. Mais tout client de Novafact a un administrateur, et la SSRF vise l’infrastructure de Novafact, pas le tenant.' },
    ],
  },

  // ── N3 ────────────────────────────────────────────────────────────────────
  {
    id: 'middleware-order',
    level: 3,
    number: 467,
    title: 'refactor(api): regrouper la configuration des middlewares',
    author: 'karim-devops',
    tags: ['retrait'],
    body: 'Rangement de app.ts : la configuration générale en haut, les routes au milieu, les limitations de débit ensemble à la fin. Ajout de trust proxy, nécessaire derrière l’ALB. Aucun changement fonctionnel attendu.',
    files: [{
      path: 'apps/api/src/app.ts', lang: 'ts', lines: [
        " import express from 'express';",
        " import helmet from 'helmet';",
        " import cors from 'cors';",
        " import { apiLimiter, loginLimiter } from './limits';",
        " import { requireAuth } from './auth';",
        " import { apiRouter, authRouter } from './routes';",
        ' ',
        ' export const app = express();',
        '-app.use(helmet());',
        "-app.use(cors({ origin: ['https://app.novafact.example'], credentials: true }));",
        "+app.set('trust proxy', 1);",
        " app.use(express.json({ limit: '1mb' }));",
        "-app.use('/api/auth', loginLimiter);",
        '+app.use(helmet());',
        "+app.use(cors({ origin: ['https://app.novafact.example'], credentials: true }));",
        '+',
        '+// Routes',
        " app.use('/api/auth', authRouter);",
        " app.use('/api', requireAuth, apiLimiter, apiRouter);",
        '+',
        '+// Limitations de débit',
        "+app.use('/api/auth', loginLimiter);",
      ],
    }],
    issues: [
      { file: 0, match: ["app.use('/api/auth', loginLimiter)"], sev: 'bloquant', text: 'Express exécute les middlewares dans l’ordre d’enregistrement. authRouter répond à /api/auth/login et termine la requête : le limiteur placé après ne s’exécute plus jamais pour cette route. La force brute sur les mots de passe redevient illimitée, et aucun test fonctionnel ne le verra.' },
    ],
    decoys: [
      { file: 0, match: "app.set('trust proxy', 1)", text: 'Derrière un seul ALB, trust proxy à 1 est le bon réglage : req.ip devient l’adresse du client, et le limiteur compte par client au lieu de compter tout le monde comme l’ALB.' },
      { file: 0, match: "+app.use(cors({ origin: ['https://app.novafact.example']", text: 'Une origine fixe avec credentials: true est la configuration correcte. helmet et cors déplacés restent enregistrés avant les routes : ils s’appliquent toujours.' },
    ],
  },
  {
    id: 'team-include',
    level: 3,
    number: 470,
    title: 'perf(team): une seule requête pour la page Équipe',
    author: 'theo-api',
    tags: ['retrait'],
    body: 'Remplace deux requêtes et une jointure en JavaScript par un include Prisma. La page Équipe passe de 180 à 40 ms sur les gros tenants.',
    files: [{
      path: 'apps/api/src/dal/team.ts', lang: 'ts', lines: [
        " import { prisma } from '../db';",
        ' ',
        ' export async function listMembers(tenantId: string) {',
        '-  const members = await prisma.membership.findMany({',
        '-    where: { tenantId },',
        '-    select: { role: true, userId: true },',
        '-  });',
        '-  const users = await prisma.user.findMany({',
        '-    where: { id: { in: members.map((m) => m.userId) } },',
        '-    select: { id: true, name: true, email: true, avatarUrl: true },',
        '-  });',
        '-  return members.map((m) => ({ ...users.find((u) => u.id === m.userId), role: m.role }));',
        '+  const members = await prisma.membership.findMany({',
        '+    where: { tenantId },',
        '+    include: { user: true },',
        "+    orderBy: { createdAt: 'asc' },",
        '+  });',
        '+  return members.map(({ user, role }) => ({ ...user, role }));',
        ' }',
      ],
    }],
    issues: [
      { file: 0, match: ['include: { user: true }', 'select: { id: true, name: true', '...user, role'], sev: 'bloquant', text: 'Le second select retiré (id, name, email, avatarUrl) était le filtre. include: { user: true } ramène tous les champs scalaires de l’utilisateur, dont passwordHash et totpSecret dans le modèle de Novafact, et la route les renvoie en JSON à chaque membre du tenant. include: { user: { select: { id, name, email, avatarUrl } } }.' },
    ],
    decoys: [
      { file: 0, match: '+    where: { tenantId },', text: 'Le filtre de tenant est conservé : la PR ne mélange pas les tenants. Le défaut est dans les colonnes, pas dans les lignes.' },
    ],
  },
  {
    id: 'send-parallel',
    level: 3,
    number: 473,
    title: 'perf(invoices): lancer l’envoi pendant le chargement de la facture',
    author: 'lea-m',
    tags: ['retrait'],
    body: 'Le rendu du PDF prend jusqu’à 2 s : on le démarre sans attendre la lecture de la facture. Le 404 et le journal d’audit sont conservés.',
    files: [{
      path: 'apps/api/src/routes/invoices-send.ts', lang: 'ts', lines: [
        " router.post('/invoices/:id/send', requireAuth, requireRole('accountant'), async (req, res) => {",
        '   const tenant = tenantOf(req);',
        '-  const invoice = await invoices.get(tenant, req.params.id);',
        '-  if (!invoice) return res.sendStatus(404);',
        '-  await mailer.sendInvoice(invoice.id, req.body.cc);',
        '+  const [invoice] = await Promise.all([',
        '+    invoices.get(tenant, req.params.id),',
        '+    mailer.sendInvoice(req.params.id, req.body.cc),',
        '+  ]);',
        '+  if (!invoice) return res.sendStatus(404);',
        "   await audit.log(tenant, req.user.id, 'invoice.sent', invoice.id);",
        '   res.sendStatus(202);',
        ' });',
      ],
    }],
    issues: [
      { file: 0, match: ['mailer.sendInvoice(req.params.id', 'Promise.all'], sev: 'bloquant', text: 'Le contrôle de tenant existe toujours, mais il ne précède plus l’effet : l’envoi part avant que invoices.get ait répondu, avec un identifiant brut. Un comptable de n’importe quel tenant reçoit en copie la facture d’un autre, puis obtient un 404. Et rien n’arrive au journal d’audit. La vérification doit précéder l’action, pas l’accompagner.' },
    ],
    decoys: [
      { file: 0, match: "+  if (!invoice) return res.sendStatus(404);", text: 'Le 404 est bien là, et c’est ce qui trompe : il répond à l’appelant, mais ne rappelle pas un e-mail déjà parti.' },
    ],
  },
  {
    id: 'pdf-thumbnail',
    level: 3,
    number: 476,
    title: 'feat(invoices): miniature de la première page',
    author: 'sam-b',
    tags: ['approuver'],
    body: 'Le worker génère une miniature PNG des factures qu’il vient de rendre, pour la liste. Appel à pdftoppm (poppler), déjà présent dans l’image.',
    files: [{
      path: 'apps/worker/src/thumbnail.ts', lang: 'ts', lines: [
        "+import { execFile } from 'node:child_process';",
        "+import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';",
        "+import { tmpdir } from 'node:os';",
        "+import path from 'node:path';",
        "+import { promisify } from 'node:util';",
        '+',
        '+const run = promisify(execFile);',
        '+',
        '+// pdf : une facture que le worker vient lui-même de rendre.',
        '+export async function thumbnail(pdf: Buffer): Promise<Buffer> {',
        "+  const dir = await mkdtemp(path.join(tmpdir(), 'thumb-'));",
        '+  try {',
        "+    const input = path.join(dir, 'in.pdf');",
        '+    await writeFile(input, pdf);',
        "+    await run('pdftoppm', ['-png', '-r', '72', '-f', '1', '-l', '1', '-singlefile', input, path.join(dir, 'out')], {",
        '+      timeout: 10_000,',
        '+      maxBuffer: 1024 * 1024,',
        '+    });',
        "+    return await readFile(path.join(dir, 'out.png'));",
        '+  } finally {',
        '+    await rm(dir, { recursive: true, force: true });',
        '+  }',
        '+}',
      ],
    }],
    issues: [],
    verdict: 'Rien à redire : execFile lance le binaire sans shell, avec des arguments en tableau, et aucun d’eux ne vient d’un utilisateur ; les chemins sont construits dans un dossier créé par mkdtemp, au nom imprévisible. Le PDF est produit par Novafact, pas téléversé. Commenter execFile ou rm par réflexe coûte du temps à l’auteur et de la crédibilité à la revue.',
    decoys: [
      { file: 0, match: "run('pdftoppm'", text: 'execFile n’invoque pas de shell : les caractères ; | $ n’ont aucun sens, et chaque élément du tableau arrive tel quel au programme. Aucun n’est d’ailleurs contrôlé par un utilisateur.' },
      { file: 0, match: 'rm(dir, { recursive: true, force: true })', text: 'Une suppression récursive, mais d’un dossier que la fonction vient de créer avec mkdtemp : le chemin ne dépend d’aucune entrée. C’est le nettoyage attendu.' },
      { file: 0, match: "mkdtemp(path.join(tmpdir(), 'thumb-'))", text: 'mkdtemp ajoute un suffixe aléatoire et crée le dossier de façon atomique : pas de collision entre deux rendus, pas de dossier prévisible à piéger.' },
    ],
  },
];

// ── Les séries ──────────────────────────────────────────────────────────────

const mix = (n1: number, n2: number, n3: number): [number, number, number] => [n1, n2, n3];

const PROFILES: SeriesProfile<PullRequest>[] = [
  { id: 'premieres-pr', title: 'Premières PR', mix: mix(3, 0, 0), level: 1,
    text: 'Des PR courtes, un défaut net dans les lignes ajoutées. On apprend à commenter et à qualifier.' },
  { id: 'mise-en-jambe', title: 'Mise en jambe', mix: mix(2, 1, 0), level: 1,
    text: 'La troisième PR fait la taille d’une vraie, avec des lignes saines qui attirent l’œil.' },
  { id: 'taille-reelle', title: 'Taille réelle', mix: mix(0, 3, 0), level: 2,
    text: 'Deux fichiers, une requête paramétrée à côté d’une qui ne l’est pas : le défaut est une ligne parmi d’autres.' },
  { id: 'approuver-ou-pas', title: 'Approuver ou pas', ids: ['argon2-rehash', 'magic-link', 'pdf-thumbnail'], level: 2,
    text: 'Au moins une de ces PR se fusionne telle quelle. Commenter par réflexe coûte des points.' },
  { id: 'revue-complete', title: 'Revue complète', mix: mix(1, 1, 1), level: 2,
    text: 'Une PR de chaque niveau, de la plus lisible à celle qui ne se lit qu’en regardant ce qui disparaît.' },
  { id: 'ce-qui-disparait', title: 'Ce qui disparaît', filter: (p) => (p.tags ?? []).includes('retrait'), mix: mix(0, 0, 3), level: 3,
    text: 'Un contrôle supprimé, un middleware déplacé, une vérification qui ne précède plus l’effet : relire les lignes rouges.' },
  { id: 'expert', title: 'Expert', ids: ['middleware-order', 'webhook', 'send-parallel'], level: 3,
    text: 'Les lignes alarmantes sont saines et les lignes anodines sont le défaut. Une de ces PR s’approuve.' },
  { id: 'melee', title: 'Mêlée', mix: mix(1, 1, 1), level: 2, shuffleEachTime: true,
    text: 'Tous niveaux confondus, recomposée à chaque partie.' },
];

export const diffSeries = defineSeries(pullRequests, PROFILES);

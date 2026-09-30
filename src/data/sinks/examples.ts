// Trois extraits de référence, un par niveau. Ils fixent la barre pour les
// autres fichiers du pool : longueur, densité de code sain, rôle des leurres.

import type { Snippet } from './types';

export const examples: Snippet[] = [
  {
    id: 'ex-n1-upload-path',
    level: 1,
    file: 'routes/attachments.ts',
    lang: 'ts',
    line: 12,
    cwe: 'CWE-22',
    options: ['CWE-22', 'CWE-434', 'CWE-639', 'CWE-200'],
    code: `import path from 'node:path';
import fs from 'node:fs/promises';
import { Router } from 'express';
import { requireUser } from '../lib/auth';

const ATTACHMENTS = path.resolve(process.cwd(), 'storage/attachments');
export const router = Router();

router.get('/attachments/:name', requireUser, async (req, res) => {
  const { name } = req.params;

  const target = path.join(ATTACHMENTS, name);

  try {
    const body = await fs.readFile(target, 'utf8');
    res.type('text/plain').send(body);
  } catch {
    res.status(404).json({ error: 'pièce jointe introuvable' });
  }
});`,
    explain:
      'path.join résout les segments « .. » et sort donc du dossier : le nom vient du client, le chemin aussi. Le correctif n’est pas de filtrer les « .. » — le double encodage revient par la fenêtre — mais de ne pas dériver de chemin du client : un identifiant opaque, un index côté serveur. La vérification path.resolve + préfixe reste en garde-fou, pas en défense principale.',
  },

  {
    id: 'ex-n2-invoice-search',
    level: 2,
    file: 'routes/invoices.ts',
    lang: 'ts',
    line: 24,
    cwe: 'CWE-89',
    options: ['CWE-89', 'CWE-943', 'CWE-20', 'CWE-639'],
    decoys: [17, 30],
    code: `import { Router } from 'express';
import { z } from 'zod';
import { db } from '../lib/db';
import { requireUser } from '../lib/auth';

export const router = Router();

const filterSchema = z.object({
  client: z.string().max(80).optional(),
  status: z.enum(['draft', 'sent', 'paid']).optional(),
  sort: z.string().max(20).optional(),
});

router.get('/invoices', requireUser, async (req, res) => {
  const parsed = filterSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: 'filtre invalide' });
  const { client, status, sort } = parsed.data;

  const rows = await db.query(
    'SELECT id, ref, total FROM invoices WHERE tenant_id = $1 AND ($2::text IS NULL OR client ILIKE $2)',
    [req.user.tenantId, client ?? null],
  );

  const ordered = await db.query(
    \`SELECT * FROM invoices WHERE tenant_id = $1 ORDER BY \${sort ?? 'created_at'} DESC\`,
    [req.user.tenantId],
  );

  res.json({ matches: rows.length, invoices: ordered.rows, status });
});`,
    explain:
      'Le tri est concaténé dans la requête : le schéma valide que « sort » est une chaîne courte, pas qu’elle est un nom de colonne. Une clause ORDER BY ne se paramètre pas — il faut une liste blanche de colonnes autorisées. Les deux leurres : la requête de la ligne 17 est paramétrée et saine malgré le ILIKE, et le filtrage par tenant de la ligne 30 est bien présent. Un schéma qui contraint le type ne contraint pas le sens.',
  },

  {
    id: 'ex-n3-reset-token',
    level: 3,
    file: 'routes/password.ts',
    lang: 'ts',
    line: 14,
    cwe: 'CWE-640',
    options: ['CWE-640', 'CWE-208', 'CWE-330', 'CWE-307'],
    decoys: [21, 36],
    code: `import crypto from 'node:crypto';
import { Router } from 'express';
import { db } from '../lib/db';
import { sendMail } from '../lib/mail';
import { rateLimit } from '../lib/rate-limit';

export const router = Router();

/** Construit le lien absolu envoyé dans les courriels sortants. */
function publicUrl(req: import('express').Request, pathname: string): string {
  const configured = process.env.PUBLIC_URL;
  if (configured) return new URL(pathname, configured).toString();

  const host = req.get('x-forwarded-host') ?? req.get('host') ?? 'localhost';
  return \`https://\${host}\${pathname}\`;
}

router.post('/password/forgot', rateLimit({ perAccount: 5, windowMs: 900_000 }), async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase();

  const token = crypto.randomBytes(32).toString('base64url');
  const digest = crypto.createHash('sha256').update(token).digest('hex');

  const user = await db.users.findByEmail(email);
  if (user) {
    await db.resetTokens.insert({
      userId: user.id,
      digest,
      expiresAt: new Date(Date.now() + 3_600_000),
    });

    await sendMail({
      to: user.email,
      subject: 'Réinitialisation de votre mot de passe',
      body: \`Pour choisir un nouveau mot de passe : \${publicUrl(req, \`/reset?token=\${token}\`)}\`,
    });
  }

  res.json({ ok: true, message: 'Si un compte existe, un courriel vient de partir.' });
});`,
    explain:
      'Le repli de la ligne 14 lit l’hôte dans la requête : derrière un proxy de confiance, X-Forwarded-Host est fourni par l’appelant, et le lien de réinitialisation part vers son domaine avec un jeton valide. Tout le reste de l’extrait est bon, et c’est ce qui rend le défaut difficile à voir : le jeton vient d’un générateur cryptographique, seule son empreinte est stockée, il expire en une heure, la réponse est identique que le compte existe ou non, et la limitation de débit est en place. L’origine publique vient de la configuration — jamais de la requête.',
  },
];

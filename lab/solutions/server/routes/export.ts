// Corrigé de server/routes/export.ts.
// Défauts éliminés : cmd-injection, csv-formula-injection, cache-deception-pdf,
// ssrf-pdf-renderer, ssti-render-options.

import { Router } from 'express';
import { execFile } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from '../store.ts';
import { requireUser } from '../lib/auth.ts';
import { renderTemplate } from './templates.ts';
import type { Invoice } from '../store.ts';

export const exportRoutes = Router();

const here = path.dirname(fileURLToPath(import.meta.url));
const EXPORT_DIR = path.resolve(here, '../data/exports');
fs.mkdirSync(EXPORT_DIR, { recursive: true });

const renderInvoice = (i: Invoice) =>
  `%PDF-1.4\nNovafact — ${i.ref}\nClient : ${i.client}\nStatut : ${i.status}\nTotal : ${i.total} €\n${i.note}\n%%EOF`;

// CORRIGÉ (cache-deception-pdf) : il n'y a plus de cache partagé devant une
// réponse authentifiée, et il n'y a plus deux lectures différentes du même
// chemin. L'origine ne « nettoie » aucun suffixe : `INV-1001.pdf` n'est pas un
// identifiant de facture, donc c'est un 404. Les deux couches, si un CDN est
// ajouté plus tard, verront exactement la même URL — et `Cache-Control:
// private, no-store` lui interdit de toute façon de stocker.
exportRoutes.use(requireUser);

exportRoutes.get('/invoice/:id', (req, res) => {
  const invoice = db.invoices.find((i) => i.id === req.params.id && i.tenantId === req.user!.tenantId);
  if (!invoice) {
    res.status(404).json({ error: 'facture introuvable' });
    return;
  }
  res
    .set('Cache-Control', 'private, no-store')
    .set('X-Lab-Cache', 'BYPASS')
    .type('application/pdf')
    .send(renderInvoice(invoice));
});

// ── Génération par binaire externe ──────────────────────────────────────────

// CORRIGÉ (cmd-injection) : `execFile` avec un TABLEAU d'arguments. Il n'y a
// plus de shell, donc plus rien à échapper : le titre est un argument, quels
// que soient les caractères qu'il contient. Et le nom du fichier produit est
// généré côté serveur — il ne se reprend pas du client.
exportRoutes.post('/pdf', (req, res) => {
  const invoice = db.invoices.find(
    (i) => i.id === String(req.body?.invoiceId ?? '') && i.tenantId === req.user!.tenantId,
  );
  if (!invoice) {
    res.status(404).json({ error: 'facture introuvable' });
    return;
  }

  const title = String(req.body?.name ?? invoice.client).slice(0, 200);
  const outFile = path.join(EXPORT_DIR, `export-${crypto.randomBytes(8).toString('hex')}.pdf`);
  const document = `%PDF-1.4 ${invoice.ref} ${title}`;

  execFile(
    '/usr/bin/env',
    ['printf', '%s', document],
    { timeout: 2000, maxBuffer: 64 * 1024, env: { PATH: '/usr/bin:/bin', HOME: os.tmpdir() } },
    (err, stdout, stderr) => {
      let produced: string | null = null;
      try {
        fs.writeFileSync(outFile, stdout, 'utf8');
        produced = fs.readFileSync(outFile, 'utf8');
      } catch {
        produced = null;
      }
      fs.rmSync(outFile, { force: true });

      res.json({
        command: 'execFile(printf, ["%s", <titre>])',
        produced,
        stdout: '',
        stderr: stderr.slice(0, 2000),
        error: err ? 'génération impossible' : null,
      });
    },
  );
});

// ── Export CSV ──────────────────────────────────────────────────────────────

const FORMULA_LEAD = /^[=+\-@\t\r]/;

// CORRIGÉ (csv-formula-injection) : chaque cellule texte est neutralisée avant
// d'être écrite. Le tableur du destinataire est un interpréteur : une cellule
// qui commence par `=`, `+`, `-`, `@`, une tabulation ou un retour chariot est
// préfixée d'une apostrophe, et les guillemets sont doublés. La vulnérabilité
// ne s'exécute pas chez toi — elle s'exécute chez ton client.
const csvCell = (value: string): string => {
  const neutral = FORMULA_LEAD.test(value) ? `'${value}` : value;
  return `"${neutral.replace(/"/g, '""')}"`;
};

exportRoutes.get('/csv', (req, res) => {
  const invoices = db.invoices.filter((i) => i.tenantId === req.user!.tenantId);
  const lines = ['ref;client;statut;total'];
  for (const i of invoices) {
    lines.push([csvCell(i.ref), csvCell(i.client), csvCell(i.status), i.total.toFixed(2)].join(';'));
  }
  res.type('text/csv').set('Content-Disposition', 'attachment; filename="factures.csv"').send(lines.join('\r\n'));
});

// ── Moteur de rendu HTML → PDF ──────────────────────────────────────────────

// CORRIGÉ (ssrf-pdf-renderer) : le rendu ne va plus chercher quoi que ce soit.
// Le bloc d'en-tête du tenant est traité comme une DONNÉE — échappée, jamais
// interprétée — et le document produit n'a ni ressource externe ni cadre. En
// production, ce rendu tourne dans un processus isolé, sans accès réseau ni
// système de fichiers, à partir d'un gabarit dont les données sont échappées.
const escapeText = (v: string) =>
  v.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

exportRoutes.post('/render', (req, res) => {
  const tenant = db.tenants.find((t) => t.id === req.user!.tenantId);
  const block = String(req.body?.header ?? tenant?.settings.pdfHeader ?? '').slice(0, 4000);
  if (tenant) tenant.settings.pdfHeader = block;

  const text =
    `%PDF-1.4\nNovafact — ${escapeText(req.user!.tenantId)}\n` +
    `${escapeText(block)}\n` +
    `Édité le ${new Date().toISOString()}\n%%EOF`;

  res.json({ resources: [], pdf: text.slice(0, 4000) });
});

// ── Aperçu ──────────────────────────────────────────────────────────────────

const PREVIEW_TEMPLATE = 'Facture {{ ref }} — {{ client }} — {{ total }} €';

// CORRIGÉ (ssti-render-options) : `req.query` n'est plus étalé nulle part. Les
// options se lisent une par une, dans une liste fermée, et leur valeur est
// validée contre un ensemble connu. Et comme le moteur ne compile plus rien
// (voir solutions/server/routes/templates.ts), il n'y a même plus de source
// dans laquelle injecter.
const ALLOWED_ESCAPES = new Set(['htmlEscape', 'raw']);

exportRoutes.get('/preview', (req, res) => {
  const escape = typeof req.query.escape === 'string' ? req.query.escape : 'htmlEscape';
  if (!ALLOWED_ESCAPES.has(escape)) {
    res.status(400).json({ error: `fonction d’échappement inconnue : ${escape}` });
    return;
  }

  const invoice = db.invoices.find((i) => i.tenantId === req.user!.tenantId);
  const rendered = renderTemplate(PREVIEW_TEMPLATE, {
    ref: invoice?.ref ?? 'INV-0000',
    client: invoice?.client ?? 'Client',
    total: invoice?.total ?? 0,
  });

  res.json({ options: { open: '{{', close: '}}', escape }, rendered, error: null });
});

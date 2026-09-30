// Export comptable : PDF de facture, CSV, rendu d'aperçu.
//
// Exercices portés par ce fichier : cmd-injection, csv-formula-injection,
// cache-deception-pdf, ssrf-pdf-renderer, ssti-render-options.
//
// Tout est local et inerte : le « générateur de PDF » produit du texte, le
// moteur de rendu ne joint que la boucle locale, et le cache est une Map.

import { Router } from 'express';
import { exec } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { audit, db, solve } from '../store.ts';
import { requireUser } from '../lib/auth.ts';
import { callBounded } from '../lib/validate.ts';
import { compileTemplate, DEFAULT_OPTIONS, type RenderOptions } from './templates.ts';
import type { Invoice } from '../store.ts';

export const exportRoutes = Router();

const here = path.dirname(fileURLToPath(import.meta.url));
const EXPORT_DIR = path.resolve(here, '../data/exports');
fs.mkdirSync(EXPORT_DIR, { recursive: true });

/** Le « PDF » du lab : du texte, lisible dans un terminal. */
const renderInvoice = (i: Invoice) =>
  `%PDF-1.4\nNovafact — ${i.ref}\nClient : ${i.client}\nStatut : ${i.status}\nTotal : ${i.total} €\n${i.note}\n%%EOF`;

// ════════════════════════════════════════════════════════════════════════════
//  Le cache « CDN », monté AVANT l'authentification
// ════════════════════════════════════════════════════════════════════════════

/** Ce que le cache considère comme un fichier statique : une extension. */
const STATIC_SUFFIX = /\.(pdf|css|js|png|jpe?g|ico|svg|woff2?)$/i;

const PDF_TTL_MS = 60_000;

/**
 * VULNÉRABLE (cache-deception-pdf) : le cache décide de stocker sur
 * l'EXTENSION du chemin, l'origine ignore le suffixe et sert la ressource
 * authentifiée. Les deux couches ne lisent pas la même URL — c'est tout le
 * défaut. Il suffit qu'un utilisateur connecté ouvre un lien suffixé pour que
 * sa facture atterrisse dans un cache partagé, sous une clé que n'importe qui
 * peut redemander sans session.
 *
 * Correctif attendu : les deux couches doivent lire le chemin pareil —
 * normalisation identique, pas de stockage décidé sur une extension devinée, et
 * `Cache-Control: private` sur tout ce qui dépend de l'utilisateur.
 * « Gotta cache 'em all », 2024.
 */
exportRoutes.get('/invoice/:id', (req, res, next) => {
  if (!STATIC_SUFFIX.test(req.path)) {
    next();
    return;
  }

  const hit = db.caches.pdf.get(req.path);
  if (!hit || Date.now() - hit.at > PDF_TTL_MS) {
    // Le cache retiendra la réponse de l'origine, quelle qu'elle soit.
    res.locals.cacheKey = req.path;
    next();
    return;
  }

  if (!req.user || req.user.tenantId !== hit.forTenant) {
    audit(req.user?.email ?? 'anonyme', 'cache.deception', `${req.path} servi depuis le cache (tenant ${hit.forTenant})`);
    solve('cache-deception-pdf');
  }

  res.set('X-Lab-Cache', 'HIT').type('application/pdf').send(hit.body as string);
});

exportRoutes.use(requireUser);

// ════════════════════════════════════════════════════════════════════════════

/** L'origine : elle « nettoie » le suffixe et sert la facture du tenant. */
exportRoutes.get('/invoice/:id', (req, res) => {
  const id = String(req.params.id).replace(STATIC_SUFFIX, '');
  const invoice = db.invoices.find((i) => i.id === id && i.tenantId === req.user!.tenantId);
  if (!invoice) {
    res.status(404).json({ error: 'facture introuvable' });
    return;
  }

  const body = renderInvoice(invoice);
  if (typeof res.locals.cacheKey === 'string') {
    db.caches.pdf.set(res.locals.cacheKey, { body, at: Date.now(), forTenant: req.user!.tenantId });
  }

  res
    .set('X-Lab-Cache', 'MISS')
    .set('Cache-Control', 'public, max-age=60')
    .type('application/pdf')
    .send(body);
});

// ── Génération par binaire externe ──────────────────────────────────────────

/**
 * VULNÉRABLE (cmd-injection) : la commande est assemblée en CHAÎNE, puis
 * confiée à un shell. Le nom du document vient du client : tout ce qu'un shell
 * interprète — `;`, `|`, `&&`, `$( )`, les accents graves — est interprété.
 *
 * Correctif attendu : `execFile` avec un tableau d'arguments plutôt qu'`exec`
 * avec une chaîne — il n'y a alors plus de shell à échapper. Et le nom de
 * fichier se génère côté serveur, il ne se reprend pas du client.
 *
 * Le lab borne la commande à deux secondes et à 64 Ko de sortie, pour qu'une
 * charge utile mal réglée ne fige pas la séance. C'est bien une exécution de
 * commande réelle : elle n'a d'autre limite que celle-là.
 */
exportRoutes.post('/pdf', (req, res) => {
  const invoice = db.invoices.find(
    (i) => i.id === String(req.body?.invoiceId ?? '') && i.tenantId === req.user!.tenantId,
  );
  if (!invoice) {
    res.status(404).json({ error: 'facture introuvable' });
    return;
  }

  const title = String(req.body?.name ?? invoice.client);
  const outFile = path.join(EXPORT_DIR, `export-${crypto.randomBytes(4).toString('hex')}.pdf`);
  const expected = `%PDF-1.4 ${invoice.ref} ${title}`;

  const command = `printf '%s' "%PDF-1.4 ${invoice.ref} ${title}" > ${JSON.stringify(outFile)}`;

  exec(
    command,
    { timeout: 2000, maxBuffer: 64 * 1024, env: { PATH: process.env.PATH ?? '/usr/bin:/bin', HOME: os.tmpdir() } },
    (err, stdout, stderr) => {
      let produced: string | null = null;
      try {
        produced = fs.readFileSync(outFile, 'utf8');
      } catch {
        produced = null;
      }
      fs.rmSync(outFile, { force: true });

      // Le point de rupture : le shell n'a pas fait ce que le code lui
      // demandait. Soit quelque chose a écrit sur la sortie standard — le
      // générateur, lui, redirige tout dans le fichier —, soit le document
      // produit n'est pas celui qui était demandé.
      const extraOutput = stdout.trim().length > 0;
      const wrongDocument = produced !== expected;
      if (extraOutput || wrongDocument) {
        audit(req.user!.email, 'commande.injectée', command.slice(0, 160));
        solve('cmd-injection');
      }

      res.json({
        command,
        produced,
        stdout: stdout.slice(0, 2000),
        stderr: stderr.slice(0, 2000),
        error: err ? String(err.message) : null,
      });
    },
  );
});

// ── Export CSV ──────────────────────────────────────────────────────────────

/** Les caractères qui, en tête de cellule, font d'une donnée une formule. */
const FORMULA_LEAD = /^[=+\-@\t\r]/;

/**
 * VULNÉRABLE (csv-formula-injection) : les champs texte sont écrits tels quels
 * dans les cellules. Le tableur du destinataire est un interpréteur : une
 * cellule qui commence par `=`, `+`, `-`, `@`, une tabulation ou un retour
 * chariot y devient une formule, avec ce que la suite décrit — `DDE`,
 * `HYPERLINK`, `WEBSERVICE`.
 *
 * Correctif attendu : préfixer ces cellules (apostrophe, ou espace
 * insécable), ou produire un format qui n'exécute rien. La vulnérabilité ne
 * s'exécute pas chez toi — elle s'exécute chez ton client.
 */
exportRoutes.get('/csv', (req, res) => {
  const invoices = db.invoices.filter((i) => i.tenantId === req.user!.tenantId);

  const lines = ['ref;client;statut;total'];
  const dangerous: string[] = [];
  for (const i of invoices) {
    // Seules les cellules TEXTE viennent d'une saisie ; le total est formaté
    // par le serveur, un montant négatif n'est donc pas une formule.
    for (const cell of [i.ref, i.client, i.status]) {
      if (FORMULA_LEAD.test(cell)) dangerous.push(cell);
    }
    lines.push(`${i.ref};${i.client};${i.status};${i.total.toFixed(2)}`);
  }

  if (dangerous.length > 0) {
    audit(req.user!.email, 'csv.formule', `cellule exécutable dans l’export : ${dangerous[0].slice(0, 80)}`);
    solve('csv-formula-injection');
  }

  res.type('text/csv').set('Content-Disposition', 'attachment; filename="factures.csv"').send(lines.join('\r\n'));
});

// ── Moteur de rendu HTML → PDF ──────────────────────────────────────────────

/** La boucle locale et le lien-local : tout ce que le lab accepte de joindre. */
const INTERNAL_HOST =
  /^(localhost|127\.\d+\.\d+\.\d+|::1|0\.0\.0\.0|169\.254\.\d+\.\d+|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/;

interface Resource {
  src: string;
  scheme: string;
  bytes: number;
}

/**
 * VULNÉRABLE (ssrf-pdf-renderer) : un moteur de rendu HTML est un navigateur.
 * Il suit les `src` qu'on lui donne, y compris `file:` et les adresses
 * internes, et il inline ce qu'il récupère dans le document produit. Le bloc
 * d'en-tête étant contrôlé par le tenant, c'est le tenant qui choisit ce que le
 * serveur va lire, et il le relit ensuite dans son PDF.
 *
 * Correctif attendu : rendu dans un processus isolé, sans accès réseau ni
 * système de fichiers, à partir d'un gabarit dont les données sont échappées.
 * Et, si des ressources externes sont nécessaires : liste blanche d'origines,
 * résolution DNS vérifiée, schémas `http(s)` seulement.
 */
async function renderToPdf(html: string): Promise<{ text: string; resources: Resource[] }> {
  const resources: Resource[] = [];
  let out = html;

  const refs = [...html.matchAll(/<(?:img|iframe|embed|object)\b[^>]*\b(?:src|data)\s*=\s*["']([^"']+)["']/gi)];
  for (const ref of refs.slice(0, 5)) {
    const src = ref[1];
    let body: string | null = null;
    let scheme = 'inconnu';

    try {
      const url = new URL(src);
      scheme = url.protocol.replace(':', '');
      if (scheme === 'file') {
        body = fs.readFileSync(url.pathname, 'utf8');
      } else if ((scheme === 'http' || scheme === 'https') && INTERNAL_HOST.test(url.hostname)) {
        const upstream = await fetch(url, { signal: AbortSignal.timeout(2000) });
        body = await upstream.text();
      } else {
        // Garde-fou du lab : rien ne sort de la machine.
        scheme = `${scheme} (refusé par le lab : hors boucle locale)`;
      }
    } catch (err) {
      out += `\n--- ressource ${src} : ${String((err as Error).message ?? err)} ---\n`;
      body = null;
    }

    if (body !== null) {
      const slice = body.slice(0, 2000);
      resources.push({ src, scheme, bytes: slice.length });
      out += `\n--- ressource ${src} ---\n${slice}\n`;
    }
  }

  return { text: `%PDF-1.4\n${out}\n%%EOF`, resources };
}

exportRoutes.post('/render', async (req, res) => {
  const tenant = db.tenants.find((t) => t.id === req.user!.tenantId);
  const block = String(req.body?.header ?? tenant?.settings.pdfHeader ?? '');
  if (tenant) tenant.settings.pdfHeader = block;

  const html = `<header>Novafact — ${req.user!.tenantId}</header>\n${block}\n<footer>Édité le ${new Date().toISOString()}</footer>`;
  const { text, resources } = await renderToPdf(html);

  const local = resources.filter((r) => r.scheme === 'file' || r.scheme === 'http' || r.scheme === 'https');
  if (local.length > 0) {
    audit(req.user!.email, 'ssrf', `le moteur de rendu a inliné ${local[0].src}`);
    solve('ssrf-pdf-renderer');
  }

  res.json({ resources, pdf: text.slice(0, 4000) });
});

// ── Aperçu : le gabarit est figé, les OPTIONS ne le sont pas ────────────────

const PREVIEW_TEMPLATE = 'Facture {{ ref }} — {{ client }} — {{ total }} €';

/** Un nom de fonction ou de variable, et rien d'autre. */
const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

/** Les deux options dont la valeur atterrit VERBATIM dans le code compilé. */
const COMPILED_OPTIONS = ['outputFunctionName', 'escape'] as const;

/**
 * VULNÉRABLE (ssti-render-options) : `req.query` est étalé dans l'objet
 * d'options du moteur. Le gabarit, lui, est en dur — le client n'y touche
 * jamais. Mais les options de COMPILATION d'un moteur sont du code au même
 * titre que son gabarit : `escape` nomme une fonction, et ce nom est recopié
 * tel quel dans la source produite.
 *
 * Correctif attendu : ne jamais étaler `req.query` ni `req.body` dans un objet
 * d'options. Les options se lisent une par une, dans une liste fermée, et leur
 * valeur est validée. CVE-2022-29078 (EJS) repose exactement là-dessus.
 */
exportRoutes.get('/preview', async (req, res) => {
  const options = { ...DEFAULT_OPTIONS, ...(req.query as Record<string, unknown>) } as RenderOptions;

  const invoice = db.invoices.find((i) => i.tenantId === req.user!.tenantId);
  const locals = {
    ref: invoice?.ref ?? 'INV-0000',
    client: invoice?.client ?? 'Client',
    total: invoice?.total ?? 0,
  };

  const source = compileTemplate(PREVIEW_TEMPLATE, options);
  const run = await callBounded(source, 'locals', locals);

  const injected = COMPILED_OPTIONS.filter((k) => !IDENTIFIER.test(String(options[k])));
  if (injected.length > 0 && !run.error && !run.timedOut) {
    audit(req.user!.email, 'code.injecté', `option de compilation ${injected[0]} = ${String(options[injected[0]]).slice(0, 80)}`);
    solve('ssti-render-options');
  }

  res.json({
    options,
    rendered: run.timedOut ? null : run.text,
    error: run.timedOut ? 'budget de rendu dépassé' : run.error,
  });
});

// Corrigé de server/routes/attachments.ts.
// Défauts éliminés : path-traversal, toctou-upload, upload-pipeline,
// attachment-same-origin, svg-logo.

import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { db } from '../store.ts';
import { requireUser } from '../lib/auth.ts';
import type { Upload } from '../store.ts';

export const attachmentRoutes = Router();
attachmentRoutes.use(requireUser);

const here = path.dirname(fileURLToPath(import.meta.url));
const ATTACH_DIR = path.resolve(here, '../data/attachments');

// ── Téléversement ───────────────────────────────────────────────────────────

/** Le type est DÉDUIT du contenu, jamais de l'annonce du client. */
function sniff(content: string): string {
  if (/^%PDF-/.test(content)) return 'application/pdf';
  if (content.startsWith('\x89PNG')) return 'image/png';
  if (content.startsWith('\xFF\xD8\xFF')) return 'image/jpeg';
  if (/^[\s﻿]*<(\?xml|!doctype|svg|html|script)/i.test(content)) return 'text/plain';
  return 'text/plain';
}

/** Ce que le pipeline accepte de stocker. */
const ALLOWED_TYPES = new Set(['application/pdf', 'image/png', 'image/jpeg', 'text/plain']);

/**
 * CORRIGÉ (toctou-upload) : on valide AVANT de rendre disponible. Le contenu
 * n'existe publiquement qu'une fois accepté — il n'y a plus de fenêtre entre le
 * contrôle et l'usage, puisqu'il n'y a plus d'intervalle du tout.
 *
 * CORRIGÉ (upload-pipeline) : le type vient du contenu, le nom est généré côté
 * serveur, et seuls des types inertes sont conservés.
 */
attachmentRoutes.post('/', (req, res) => {
  const { content } = (req.body ?? {}) as Record<string, unknown>;
  const body = String(content ?? '');
  if (body.length > 1_000_000) {
    res.status(413).json({ error: 'pièce jointe trop volumineuse' });
    return;
  }

  const contentType = sniff(body);
  if (!ALLOWED_TYPES.has(contentType)) {
    res.status(415).json({ error: `type de fichier refusé : ${contentType}` });
    return;
  }
  // Un document actif n'est pas une pièce jointe de facture.
  if (/<script[\s>]|<iframe\b|\son[a-z]+\s*=/i.test(body)) {
    res.status(415).json({ error: 'contenu actif refusé' });
    return;
  }

  const id = crypto.randomBytes(12).toString('hex');
  const upload: Upload = {
    id,
    tenantId: req.user!.tenantId,
    name: `${id}${contentType === 'application/pdf' ? '.pdf' : contentType === 'image/png' ? '.png' : '.txt'}`,
    contentType,
    content: body,
    published: true, // publié seulement maintenant : la validation est passée
    verdict: 'accepted',
    served: false,
  };
  db.uploads.push(upload);

  res.status(201).json({ id: upload.id, url: `/api/attachments/u/${upload.id}`, status: 'acceptée' });
});

/**
 * CORRIGÉ (upload-pipeline, attachment-same-origin) : type déduit du contenu,
 * `X-Content-Type-Options: nosniff`, `Content-Disposition: attachment` et un
 * nom généré. En production, ce contenu se sert depuis une origine distincte —
 * c'est la seule défense complète —, et la CSP ci-dessous n'est qu'une ceinture
 * de plus.
 */
attachmentRoutes.get('/u/:id', (req, res) => {
  const upload = db.uploads.find((u) => u.id === req.params.id && u.tenantId === req.user!.tenantId);
  if (!upload || !upload.published) {
    res.status(404).json({ error: 'pièce jointe introuvable' });
    return;
  }
  upload.served = true;
  res
    .set('Content-Type', upload.contentType)
    .set('X-Content-Type-Options', 'nosniff')
    .set('Content-Disposition', `attachment; filename="${upload.name}"`)
    .set('Content-Security-Policy', "sandbox; default-src 'none'")
    .set('Cache-Control', 'private, no-store')
    .send(upload.content);
});

// ── Logo du tenant ──────────────────────────────────────────────────────────

/**
 * CORRIGÉ (svg-logo) : un SVG est un document XML ACTIF, pas une image. On
 * l'assainit à la réception — scripts, gestionnaires d'événements, liens
 * `javascript:` et éléments actifs retirés — et on le sert avec `nosniff` et
 * une CSP en bac à sable. Les autres formats acceptés sont rasterisés par
 * nature. En production, le logo se sert depuis une autre origine, et le rendre
 * dans une balise `<img>` suffit à empêcher l'exécution.
 */
function sanitizeSvg(svg: string): string {
  return svg
    .replace(/<script[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<script\b[^>]*\/?>/gi, '')
    .replace(/<(foreignObject|handler|set|animate)\b[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<(foreignObject|handler|set|animate)\b[^>]*\/?>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript:/gi, 'about:blank#');
}

const LOGO_TYPES = new Set(['image/svg+xml', 'image/png', 'image/jpeg']);

attachmentRoutes.post('/logo', (req, res) => {
  const tenant = db.tenants.find((t) => t.id === req.user!.tenantId);
  if (!tenant) {
    res.status(404).json({ error: 'tenant introuvable' });
    return;
  }
  const { contentType, content } = (req.body ?? {}) as Record<string, unknown>;
  const type = String(contentType ?? 'image/png');
  if (!LOGO_TYPES.has(type)) {
    res.status(415).json({ error: `type de logo refusé : ${type}` });
    return;
  }
  const body = String(content ?? '');
  tenant.settings.logo = {
    contentType: type,
    content: type === 'image/svg+xml' ? sanitizeSvg(body) : body,
  };
  res.status(201).json({ ok: true, url: `/api/attachments/logo/${tenant.id}` });
});

attachmentRoutes.get('/logo/:tenantId', (req, res) => {
  const tenant = db.tenants.find((t) => t.id === req.params.tenantId);
  const logo = tenant?.settings.logo as { contentType: string; content: string } | undefined;
  if (!logo) {
    res.status(404).json({ error: 'aucun logo pour ce tenant' });
    return;
  }
  res
    .set('Content-Type', logo.contentType)
    .set('X-Content-Type-Options', 'nosniff')
    .set('Content-Security-Policy', "sandbox; default-src 'none'; script-src 'none'")
    .send(logo.content);
});

// ── Lecture des pièces jointes historiques ──────────────────────────────────

// CORRIGÉ (path-traversal) : index côté serveur. Le client nomme une pièce
// jointe connue ; il ne construit jamais de chemin. La vérification de préfixe
// reste en garde-fou.
const INDEX: Record<string, string> = {
  'contrat-globex.txt': 'contrat-globex.txt',
};

attachmentRoutes.get('/*', (req, res) => {
  const name = (req.params as unknown as Record<string, string>)[0] ?? '';
  const file = INDEX[name];
  if (!file) {
    res.status(404).json({ error: 'pièce jointe introuvable' });
    return;
  }

  const resolved = path.resolve(ATTACH_DIR, file);
  if (!resolved.startsWith(ATTACH_DIR + path.sep)) {
    res.status(400).json({ error: 'chemin refusé' });
    return;
  }
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    res.status(404).json({ error: 'pièce jointe introuvable' });
    return;
  }
  res.type('text/plain').send(fs.readFileSync(resolved, 'utf8'));
});

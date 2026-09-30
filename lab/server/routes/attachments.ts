// Pièces jointes des factures et logo du tenant.
//
// Exercices portés par ce fichier : path-traversal, toctou-upload,
// upload-pipeline, attachment-same-origin, svg-logo.

import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { audit, db, solve } from '../store.ts';
import { requireUser } from '../lib/auth.ts';
import type { Upload } from '../store.ts';

export const attachmentRoutes = Router();
attachmentRoutes.use(requireUser);

const here = path.dirname(fileURLToPath(import.meta.url));
const ATTACH_DIR = path.resolve(here, '../data/attachments');

// ── Téléversement ───────────────────────────────────────────────────────────

/** Ce que le pipeline est censé accepter. */
const ALLOWED_NAME = /\.(pdf|png|jpe?g|txt|csv)$/i;

/** Les types qui, servis sur l'origine de l'application, y exécutent du code. */
const EXECUTABLE_TYPE =
  /^(text\/html|application\/xhtml\+xml|image\/svg\+xml|(text|application)\/(java|ecma)script|application\/x-javascript)/i;

/** Les contextes où le navigateur PARSE la réponse au lieu de la dessiner. */
const SCRIPTING_DEST = new Set(['document', 'iframe', 'frame', 'object', 'embed']);

/** Du SVG qui n'est plus une image mais un document actif. */
const ACTIVE_SVG = /<script[\s>]|\son[a-z]+\s*=|<(foreignObject|handler|set|animate)\b|javascript:/i;

/**
 * VULNÉRABLE (toctou-upload) : le fichier est enregistré et rendu
 * téléchargeable (`published: true`) AVANT d'être validé. La validation part
 * ensuite de son côté, et supprime la pièce jointe si elle ne convient pas.
 *
 * Entre les deux, il y a une fenêtre — ici 400 ms de « scan antivirus », en
 * vrai la latence d'un service tiers — pendant laquelle le contenu refusé est
 * servi à qui le demande. C'est la définition du TOCTOU : entre le contrôle et
 * l'usage, tout peut arriver.
 *
 * Correctif attendu : valider AVANT de rendre disponible. Écriture dans un
 * emplacement non servi, validation complète, puis publication atomique — et
 * l'identifiant public n'existe qu'après.
 */
attachmentRoutes.post('/', (req, res) => {
  const { name, contentType, content } = (req.body ?? {}) as Record<string, unknown>;

  const upload: Upload = {
    id: crypto.randomBytes(6).toString('hex'),
    tenantId: req.user!.tenantId,
    name: String(name ?? 'piece-jointe.bin'),
    // VULNÉRABLE (upload-pipeline) : le type est celui que le client ANNONCE.
    // Rien ne le déduit du contenu, rien ne le confronte au nom du fichier.
    contentType: String(contentType ?? 'application/octet-stream'),
    content: String(content ?? ''),
    published: true,   // ← disponible immédiatement
    verdict: 'pending',
    served: false,
  };
  db.uploads.push(upload);

  res.status(201).json({
    id: upload.id,
    url: `/api/attachments/u/${upload.id}`,
    status: 'analyse antivirus en cours',
  });

  // La validation, après coup.
  setTimeout(() => {
    const ok = ALLOWED_NAME.test(upload.name) && !EXECUTABLE_TYPE.test(upload.contentType);
    upload.verdict = ok ? 'accepted' : 'rejected';
    if (ok) return;

    upload.published = false;
    if (upload.served) {
      audit(upload.tenantId, 'toctou', `${upload.name} servi avant d’être refusé par la validation`);
      solve('toctou-upload');
    }
  }, 400);
});

/**
 * VULNÉRABLE (upload-pipeline, attachment-same-origin) : la pièce jointe est
 * servie depuis l'origine de l'application, avec le `Content-Type` annoncé par
 * le client, sans `X-Content-Type-Options: nosniff` et sans
 * `Content-Disposition: attachment`. Un fichier téléversé est du contenu
 * d'attaquant hébergé par toi : servi comme ça, il s'exécute dans ta propre
 * origine, avec la session de celui qui l'ouvre.
 *
 * Correctif attendu : servir depuis une origine distincte — c'est la seule
 * défense complète. À défaut : `Content-Disposition: attachment`,
 * `X-Content-Type-Options: nosniff`, type déduit du contenu et non de
 * l'annonce, nom généré côté serveur, et rendu dans un service séparé.
 */
attachmentRoutes.get('/u/:id', (req, res) => {
  const upload = db.uploads.find((u) => u.id === req.params.id);
  if (!upload || !upload.published) {
    res.status(404).json({ error: 'pièce jointe introuvable' });
    return;
  }

  upload.served = true;

  if (EXECUTABLE_TYPE.test(upload.contentType)) {
    audit(req.user!.email, 'contenu.actif', `${upload.name} servi en ${upload.contentType} sur l’origine de l’application`);
    solve('upload-pipeline');

    const dest = String(req.headers['sec-fetch-dest'] ?? '');
    if (SCRIPTING_DEST.has(dest)) {
      // Le navigateur ne dessine pas ce document : il le parse, dans l'origine
      // de Novafact, avec la session de l'utilisateur qui l'a ouvert.
      audit(req.user!.email, 'xss', `${upload.name} parsé comme ${dest} sur l’origine de l’application`);
      solve('attachment-same-origin');
    }
  }

  res.set('Content-Type', upload.contentType).send(upload.content);
});

// ── Logo du tenant ──────────────────────────────────────────────────────────

/**
 * VULNÉRABLE (svg-logo) : le champ « logo » accepte le SVG. Un SVG n'est pas
 * une image, c'est un document XML actif : il porte des `<script>`, des
 * gestionnaires d'événements et des liens `javascript:`. Stocké tel quel, il
 * sera rendu tel quel.
 *
 * Correctif attendu : le rendre en `<img>` (qui n'exécute pas de script), le
 * rasteriser à la réception, ou l'assainir avec une bibliothèque dédiée — et
 * le servir depuis une autre origine.
 */
attachmentRoutes.post('/logo', (req, res) => {
  const tenant = db.tenants.find((t) => t.id === req.user!.tenantId);
  if (!tenant) {
    res.status(404).json({ error: 'tenant introuvable' });
    return;
  }
  const { contentType, content } = (req.body ?? {}) as Record<string, unknown>;
  tenant.settings.logo = {
    contentType: String(contentType ?? 'image/svg+xml'),
    content: String(content ?? ''),
  };
  res.status(201).json({ ok: true, url: `/api/attachments/logo/${tenant.id}` });
});

/** La fiche du tenant, côté plateforme, affiche ce logo. */
attachmentRoutes.get('/logo/:tenantId', (req, res) => {
  const tenant = db.tenants.find((t) => t.id === req.params.tenantId);
  const logo = tenant?.settings.logo as { contentType: string; content: string } | undefined;
  if (!logo) {
    res.status(404).json({ error: 'aucun logo pour ce tenant' });
    return;
  }

  const dest = String(req.headers['sec-fetch-dest'] ?? '');
  const active = /svg/i.test(logo.contentType) && ACTIVE_SVG.test(logo.content);
  const viewerIsSomeoneElse = req.user!.tenantId !== req.params.tenantId || req.user!.role === 'admin';

  if (active && SCRIPTING_DEST.has(dest) && viewerIsSomeoneElse) {
    audit(req.user!.email, 'xss', `logo SVG actif de ${req.params.tenantId} rendu comme ${dest}`);
    solve('svg-logo');
  }

  res.set('Content-Type', logo.contentType).send(logo.content);
});

// ── Lecture des pièces jointes historiques ──────────────────────────────────

attachmentRoutes.get('/*', (req, res) => {
  const name = (req.params as unknown as Record<string, string>)[0] ?? '';

  // VULNÉRABLE (path-traversal) : le chemin est dérivé du nom fourni par le
  // client. path.join résout les segments « .. » et sort du dossier.
  //
  // Correctif attendu : ne pas dériver de chemin du client. Un identifiant
  // opaque de pièce jointe → un chemin lu dans un index côté serveur. À défaut,
  // path.resolve puis vérifier que le résultat commence bien par ATTACH_DIR
  // (avec le séparateur, sinon « /data/attachments-evil » passe).
  const target = path.join(ATTACH_DIR, name);

  const resolved = path.resolve(target);
  if (!resolved.startsWith(ATTACH_DIR + path.sep)) {
    audit(req.user!.email, 'traversée', resolved);
    solve('path-traversal');
  }

  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
    res.status(404).json({ error: 'pièce jointe introuvable', tried: target });
    return;
  }

  res.type('text/plain').send(fs.readFileSync(target, 'utf8'));
});

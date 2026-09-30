// Corrigé de server/routes/templates.ts.
// Défauts éliminés : ssti-email-template, deserialization.

import { Router } from 'express';
import { db } from '../store.ts';
import { requireUser } from '../lib/auth.ts';
import type { EmailTemplate } from '../store.ts';

export const templateRoutes = Router();
templateRoutes.use(requireUser);

// ── Le moteur de gabarits ───────────────────────────────────────────────────
//
// CORRIGÉ (ssti-email-template, ssti-render-options) : le moteur ne compile
// plus rien. Il ne sait faire qu'une chose — remplacer `{{ nom }}` par la
// valeur de `nom` dans le contexte, quand ce nom figure dans la liste des
// variables autorisées. Il n'y a plus de source produite, donc plus de code à
// injecter : ni depuis le gabarit, ni depuis les options.
//
// C'est le principe d'un moteur « sans logique » (Mustache strict) : la donnée
// va dans le contexte, jamais dans le gabarit.

export interface RenderOptions {
  open: string;
  close: string;
  /** Conservées pour la compatibilité de signature ; elles ne servent plus. */
  outputFunctionName: string;
  escape: string;
}

export const DEFAULT_OPTIONS: RenderOptions = {
  open: '{{',
  close: '}}',
  outputFunctionName: 'out',
  escape: 'htmlEscape',
};

/** Les seules variables qu'un gabarit a le droit de nommer. */
export const ALLOWED_VARS = ['ref', 'client', 'total'] as const;

const htmlEscape = (v: unknown) =>
  String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

/** Rend le gabarit. Aucune compilation, aucune évaluation. */
export function renderTemplate(src: string, locals: Record<string, unknown>): string {
  return src.replace(/\{\{\s*([A-Za-z_][\w]*)\s*\}\}/g, (whole, name: string) =>
    (ALLOWED_VARS as readonly string[]).includes(name) ? htmlEscape(locals[name]) : whole,
  );
}

/** Conservée pour la compatibilité : elle ne produit plus de source. */
export const compileTemplate = (src: string, _options: RenderOptions): string => src;

// ── Gabarits de relance ─────────────────────────────────────────────────────

const own = (id: string, tenantId: string) =>
  db.templates.find((t) => t.id === id && t.tenantId === tenantId);

templateRoutes.get('/', (req, res) => {
  res.json(db.templates.filter((t) => t.tenantId === req.user!.tenantId));
});

templateRoutes.put('/:id', (req, res) => {
  const tpl = own(req.params.id, req.user!.tenantId);
  if (!tpl) {
    res.status(404).json({ error: 'gabarit introuvable' });
    return;
  }
  const { subject, body } = (req.body ?? {}) as Record<string, unknown>;
  if (typeof subject === 'string') tpl.subject = subject.slice(0, 500);
  if (typeof body === 'string') tpl.body = body.slice(0, 20_000);
  res.json(tpl);
});

templateRoutes.post('/:id/preview', (req, res) => {
  const tpl = own(req.params.id, req.user!.tenantId);
  if (!tpl) {
    res.status(404).json({ error: 'gabarit introuvable' });
    return;
  }

  const invoice = db.invoices.find((i) => i.tenantId === req.user!.tenantId);
  const rendered = renderTemplate(tpl.body, {
    ref: invoice?.ref ?? 'INV-0000',
    client: invoice?.client ?? 'Client',
    total: invoice?.total ?? 0,
  });

  res.json({ id: tpl.id, subject: tpl.subject, rendered, error: null });
});

// ── Import d'un modèle de facture ───────────────────────────────────────────
//
// CORRIGÉ (deserialization) : le format n'accepte plus de types arbitraires —
// il n'accepte plus de types du tout. C'est du JSON validé par un schéma
// strict : une désérialisation reconstruit des DONNÉES, pas des objets vivants.
// Tout champ `$type` restant est traité comme une donnée suspecte et refusé.

function hasTypedNode(node: unknown, depth = 0): boolean {
  if (depth > 20) return true;
  if (Array.isArray(node)) return node.some((v) => hasTypedNode(v, depth + 1));
  if (typeof node !== 'object' || node === null) return false;
  const obj = node as Record<string, unknown>;
  if ('$type' in obj || '$invoke' in obj) return true;
  return Object.values(obj).some((v) => hasTypedNode(v, depth + 1));
}

templateRoutes.post('/import', (req, res) => {
  const { model } = (req.body ?? {}) as { model?: unknown };
  if (typeof model !== 'object' || model === null || Array.isArray(model)) {
    res.status(400).json({ error: 'champ « model » requis (objet)' });
    return;
  }

  if (hasTypedNode(model)) {
    res.status(400).json({ error: 'format refusé : le document ne peut pas désigner de type à reconstruire' });
    return;
  }

  const doc = model as Record<string, unknown>;
  const name = doc.name;
  const subject = doc.subject ?? 'Facture {{ref}}';
  const body = doc.body ?? '';
  if (typeof name !== 'string' || typeof subject !== 'string' || typeof body !== 'string') {
    res.status(400).json({ error: 'modèle invalide : name, subject et body doivent être des chaînes' });
    return;
  }

  const tpl: EmailTemplate = {
    id: `TPL-${db.templates.length + 1}`,
    tenantId: req.user!.tenantId,
    name: name.slice(0, 200),
    subject: subject.slice(0, 500),
    body: body.slice(0, 20_000),
  };
  db.templates.push(tpl);

  res.status(201).json({ imported: tpl, executed: [] });
});

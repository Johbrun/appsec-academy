// Gabarits d'e-mail et modèles de facture du tenant.
//
// Exercices portés par ce fichier : ssti-email-template, deserialization.
//
// Le moteur de gabarits ci-dessous est volontairement minimal — il n'a que ce
// qu'il faut pour porter le défaut : il compile le gabarit en source
// JavaScript, puis exécute cette source. Rien ne sort de la machine.

import { Router } from 'express';
import { audit, db, solve } from '../store.ts';
import { requireUser } from '../lib/auth.ts';
import { callBounded, HOST_SECRET } from '../lib/validate.ts';
import type { EmailTemplate } from '../store.ts';

export const templateRoutes = Router();
templateRoutes.use(requireUser);

// ── Le moteur de gabarits ───────────────────────────────────────────────────

export interface RenderOptions {
  /** Délimiteur ouvrant d'une expression. */
  open: string;
  /** Délimiteur fermant. */
  close: string;
  /** Nom de la variable qui accumule la sortie. */
  outputFunctionName: string;
  /** Nom de la fonction d'échappement appliquée à chaque expression. */
  escape: string;
}

export const DEFAULT_OPTIONS: RenderOptions = {
  open: '{{',
  close: '}}',
  outputFunctionName: 'out',
  escape: 'htmlEscape',
};

/** Les deux fonctions que le préambule du code compilé met à disposition. */
const PREAMBLE = `
function htmlEscape(v) {
  return String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
function raw(v) { return String(v); }
`;

/**
 * Compile un gabarit en source JavaScript.
 *
 * Deux choses de ce qui suit finissent VERBATIM dans le programme produit :
 *   · le contenu de chaque expression `{{ … }}` du gabarit — c'est le défaut de
 *     ssti-email-template, où le gabarit est éditable par le tenant ;
 *   · les valeurs des options `outputFunctionName` et `escape` — c'est le
 *     défaut de ssti-render-options (server/routes/export.ts), où ces options
 *     viennent de la query string.
 *
 * Correctif attendu : un moteur sans logique (Mustache strict), une liste de
 * variables autorisées, la donnée toujours dans le contexte et jamais dans le
 * gabarit — et un rendu dans un processus séparé. Les options de configuration
 * d'un moteur sont aussi dangereuses que son gabarit : CVE-2022-29078 (EJS)
 * repose exactement là-dessus.
 */
export function compileTemplate(src: string, options: RenderOptions): string {
  const { open, close, outputFunctionName: out, escape } = options;
  let body = `${PREAMBLE}\nlet ${out} = "";\nwith (locals) {\n`;

  let i = 0;
  while (i < src.length) {
    const start = src.indexOf(open, i);
    if (start < 0) {
      body += `${out} += ${JSON.stringify(src.slice(i))};\n`;
      break;
    }
    body += `${out} += ${JSON.stringify(src.slice(i, start))};\n`;
    const end = src.indexOf(close, start + open.length);
    if (end < 0) {
      body += `${out} += ${JSON.stringify(src.slice(start))};\n`;
      break;
    }
    body += `${out} += ${escape}(${src.slice(start + open.length, end)});\n`;
    i = end + close.length;
  }

  body += `}\nreturn ${out};`;
  return body;
}

// ── Gabarits de relance ─────────────────────────────────────────────────────

const own = (id: string, tenantId: string) =>
  db.templates.find((t) => t.id === id && t.tenantId === tenantId);

templateRoutes.get('/', (req, res) => {
  res.json(db.templates.filter((t) => t.tenantId === req.user!.tenantId));
});

/** Le gabarit est un réglage du tenant : il l'édite librement. */
templateRoutes.put('/:id', (req, res) => {
  const tpl = own(req.params.id, req.user!.tenantId);
  if (!tpl) {
    res.status(404).json({ error: 'gabarit introuvable' });
    return;
  }
  const { subject, body } = (req.body ?? {}) as Record<string, unknown>;
  if (typeof subject === 'string') tpl.subject = subject;
  if (typeof body === 'string') tpl.body = body;
  res.json(tpl);
});

/**
 * VULNÉRABLE (ssti-email-template) : le gabarit édité par le tenant est
 * COMPILÉ. Ce que l'utilisateur écrit n'arrive donc pas dans les données du
 * rendu, mais dans le programme qui produit le rendu. Un gabarit fourni par
 * l'utilisateur est du code, et il s'exécute avec tous les droits du processus.
 *
 * Correctif attendu : moteur sans logique, liste de variables autorisées, rendu
 * dans un processus séparé. La donnée va dans le contexte, jamais dans le
 * gabarit.
 */
templateRoutes.post('/:id/preview', async (req, res) => {
  const tpl = own(req.params.id, req.user!.tenantId);
  if (!tpl) {
    res.status(404).json({ error: 'gabarit introuvable' });
    return;
  }

  const invoice = db.invoices.find((i) => i.tenantId === req.user!.tenantId);
  const locals = {
    ref: invoice?.ref ?? 'INV-0000',
    client: invoice?.client ?? 'Client',
    total: invoice?.total ?? 0,
  };

  const source = compileTemplate(tpl.body, DEFAULT_OPTIONS);
  const run = await callBounded(source, 'locals', locals);

  if (!run.error && run.text.includes(HOST_SECRET)) {
    audit(req.user!.email, 'ssti', `le secret de signature est apparu dans le rendu de ${tpl.id}`);
    solve('ssti-email-template');
  }

  res.json({
    id: tpl.id,
    subject: tpl.subject,
    rendered: run.timedOut ? null : run.text,
    error: run.timedOut ? 'budget de rendu dépassé' : run.error,
  });
});

// ── Import d'un modèle de facture ───────────────────────────────────────────
//
// Format « novamodel » : du JSON, plus un champ `$type` par nœud. Il ne
// transporte pas des données, il transporte des OBJETS — c'est-à-dire du
// comportement. C'est la même idée que `!!js/function` en YAML, que
// `node-serialize` (CVE-2017-5941) ou que les sessions PHP.

/** Les types que le modèle de facture est censé contenir. */
const MODEL_TYPES = new Set(['Template', 'Line', 'Date']);

interface Thunk {
  /** Source JavaScript à exécuter au chargement du modèle. */
  $invoke: string;
}

const isThunk = (v: unknown): v is Thunk =>
  typeof v === 'object' && v !== null && typeof (v as Thunk).$invoke === 'string';

/**
 * VULNÉRABLE (deserialization) : c'est le DOCUMENT qui choisit le type à
 * reconstruire. Il n'y a pas de liste d'autorisation, et le type `Function`
 * produit un objet appelable — donc du comportement importé depuis une entrée.
 *
 * Correctif attendu : des formats qui n'acceptent jamais de types arbitraires —
 * JSON avec schéma strict, `js-yaml` en schéma sûr. La désérialisation
 * reconstruit des données, pas des objets vivants. Et si des types sont
 * nécessaires, ils viennent d'une liste fermée qui ne contient rien
 * d'appelable.
 */
function revive(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(revive);
  if (typeof node !== 'object' || node === null) return node;

  const raw = node as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) if (k !== '$type') out[k] = revive(v);

  const type = typeof raw.$type === 'string' ? raw.$type : null;
  if (!type) return out;

  if (type === 'Date') return new Date(String(out.value ?? ''));
  if (type === 'Function') return { $invoke: String(out.source ?? '') };
  return { $type: type, ...out };
}

/** Parcourt le modèle et exécute tout ce qui est appelable. */
async function hydrate(node: unknown, actor: string, seen: string[]): Promise<unknown> {
  if (Array.isArray(node)) {
    const out: unknown[] = [];
    for (const v of node) out.push(await hydrate(v, actor, seen));
    return out;
  }
  if (typeof node !== 'object' || node === null) return node;

  if (isThunk(node)) {
    // Le point de rupture : l'import vient de reconstruire un objet appelable,
    // et on l'appelle. L'invariant « un import ne transporte que des données »
    // est rompu ici.
    //
    // (Le lab exécute dans un worker jetable, tué au bout d'une seconde et
    // demie. Du vrai code écrirait `new Function(source)(model)` ici même.)
    const run = await callBounded(node.$invoke, 'model', null);
    audit(actor, 'désérialisation', `type appelable reconstruit et exécuté : ${node.$invoke.slice(0, 80)}`);
    solve('deserialization');
    seen.push(run.timedOut ? 'budget dépassé' : run.error ? `erreur : ${run.error}` : run.text);
    return run.timedOut ? null : (run.value ?? null);
  }

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
    out[k] = await hydrate(v, actor, seen);
  }
  return out;
}

templateRoutes.post('/import', async (req, res) => {
  const { model } = (req.body ?? {}) as { model?: unknown };
  if (model === undefined) {
    res.status(400).json({ error: 'champ « model » requis' });
    return;
  }

  // Le seul contrôle du format : le type de la RACINE. Il ne dit rien des
  // nœuds qu'elle contient — et c'est là que le document reprend la main.
  const declared = typeof (model as Record<string, unknown>)?.$type === 'string'
    ? String((model as Record<string, unknown>).$type)
    : 'Template';
  if (!MODEL_TYPES.has(declared)) {
    res.status(400).json({ error: `type de modèle inconnu : ${declared}` });
    return;
  }

  const revived = revive(model) as Record<string, unknown>;
  const executed: string[] = [];
  const hydrated = (await hydrate(revived, req.user!.email, executed)) as Record<string, unknown>;

  const tpl: EmailTemplate = {
    id: `TPL-${db.templates.length + 1}`,
    tenantId: req.user!.tenantId,
    name: String(hydrated.name ?? 'Modèle importé'),
    subject: String(hydrated.subject ?? 'Facture {{ref}}'),
    body: String(hydrated.body ?? ''),
  };
  db.templates.push(tpl);

  res.status(201).json({ imported: tpl, executed });
});

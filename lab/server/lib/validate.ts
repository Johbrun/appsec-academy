// Validation des entrées et garde-fous d'exécution du lab.
//
// Exercice porté par ce fichier : json-duplicate-keys.
//
// On y trouve aussi les deux bornes d'exécution du lab. Plusieurs challenges
// (eval-formula, ssti-render-options, ssti-email-template, deserialization)
// exécutent réellement du code fourni par l'apprenant : sans borne, une boucle
// infinie tapée par distraction bloque la boucle d'événements et le lab est
// mort jusqu'au redémarrage. Ces bornes appartiennent à l'échafaudage
// pédagogique, pas au défaut : dans du vrai code, l'exécution aurait lieu dans
// le processus principal, sans filet.

import { Worker } from 'node:worker_threads';
import { audit, solve } from '../store.ts';
import type { InvoiceLine } from '../store.ts';

/**
 * Le secret de signature des jetons, tel que le processus le porte.
 *
 * C'est la même valeur que `SECRET` dans server/lib/jwt.ts. Elle est posée dans
 * l'environnement du processus pour que les challenges d'exécution de code
 * (vm-escape, ssti-email-template) aient une cible réaliste : ce que cherche un
 * attaquant qui obtient une exécution, c'est exactement ça — une clé, une
 * variable d'environnement, un identifiant de base.
 */
export const HOST_SECRET = 'lab-secret-novafact';
process.env.NOVAFACT_JWT_SECRET = HOST_SECRET;

// ── Bornes d'exécution ──────────────────────────────────────────────────────

/** Au-delà, le worker est tué : c'est le seul rempart contre `while (true) {}`. */
const BUDGET_MS = 1500;

export interface BoundedResult {
  value: unknown;
  /** La valeur rendue lisible, quelle que soit sa nature. */
  text: string;
  error: string | null;
  timedOut: boolean;
}

/**
 * Le corps commun des workers jetables. `kind` choisit ce qui est exécuté ;
 * tout le reste transite par `workerData`, donc par structuredClone : rien du
 * processus principal n'est passé par référence.
 */
const WORKER_SOURCE = `
const { parentPort, workerData } = require('node:worker_threads');
let value = null;
let error = null;
try {
  if (workerData.kind === 'eval') {
    const names = Object.keys(workerData.scope);
    const args = names.map((n) => workerData.scope[n]);
    // eval direct dans une fonction : les variables déclarées sont en portée.
    const fn = new Function(...names, 'return eval(' + JSON.stringify(workerData.code) + ')');
    value = fn(...args);
  } else {
    const fn = new Function(workerData.argName, workerData.code);
    value = fn(workerData.arg);
  }
} catch (e) {
  error = String((e && e.message) || e);
}
let text;
try { text = typeof value === 'string' ? value : JSON.stringify(value) ?? String(value); }
catch { text = String(value); }
try { parentPort.postMessage({ value, text, error }); }
catch { parentPort.postMessage({ value: text, text, error }); }
`;

function runInWorker(data: Record<string, unknown>): Promise<BoundedResult> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (r: BoundedResult) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      void worker.terminate();
      resolve(r);
    };
    const worker = new Worker(WORKER_SOURCE, { eval: true, workerData: data });
    const timer = setTimeout(
      () => finish({ value: null, text: '', error: `budget de ${BUDGET_MS} ms dépassé`, timedOut: true }),
      BUDGET_MS,
    );
    worker.on('message', (m: { value: unknown; text: string; error: string | null }) =>
      finish({ value: m.value, text: m.text ?? '', error: m.error, timedOut: false }));
    worker.on('error', (e: Error) => finish({ value: null, text: '', error: e.message, timedOut: false }));
  });
}

/** `eval(code)` avec `scope` en portée, borné en temps. */
export const evalBounded = (code: string, scope: Record<string, unknown>): Promise<BoundedResult> =>
  runInWorker({ kind: 'eval', code, scope });

/** `new Function(argName, body)(arg)`, borné en temps. */
export const callBounded = (body: string, argName: string, arg: unknown): Promise<BoundedResult> =>
  runInWorker({ kind: 'call', code: body, argName, arg });

// ── json-duplicate-keys ─────────────────────────────────────────────────────

/** La règle métier : une ligne de facture, c'est ça et rien d'autre. */
const MAX_UNIT_PRICE = 100_000;
const MAX_QTY = 1_000;

/**
 * La passe de schéma « rapide » : elle lit le corps brut, sans le parser.
 *
 * VULNÉRABLE (json-duplicate-keys) : `String.prototype.match` sans `g` s'arrête
 * à la PREMIÈRE occurrence de chaque clé, là où `JSON.parse` retient la
 * DERNIÈRE. Deux analyseurs d'un même format, deux lectures du même document :
 * c'est la famille des parser differentials.
 *
 * Correctif attendu : valider l'objet ISSU du parsing, jamais son texte. Et si
 * la duplication de clés est elle-même à refuser, c'est un analyseur strict
 * qu'il faut, pas une expression régulière.
 */
function textualSchemaPass(raw: string): string | null {
  if (raw.length > 64_000) return 'document trop volumineux';

  const price = raw.match(/"unitPrice"\s*:\s*(-?\d+(?:\.\d+)?)/);
  if (price) {
    const v = Number(price[1]);
    if (!(v >= 0 && v <= MAX_UNIT_PRICE)) return `unitPrice hors bornes : ${v}`;
  }

  const qty = raw.match(/"qty"\s*:\s*(-?\d+(?:\.\d+)?)/);
  if (qty) {
    const v = Number(qty[1]);
    if (!Number.isInteger(v) || v <= 0 || v > MAX_QTY) return `qty hors bornes : ${v}`;
  }

  return null;
}

/** La même règle, appliquée à l'objet. C'est elle qui dit la vérité. */
function objectSchemaPass(lines: InvoiceLine[]): string | null {
  for (const l of lines) {
    if (!(l.unitPrice >= 0 && l.unitPrice <= MAX_UNIT_PRICE)) return `unitPrice hors bornes : ${l.unitPrice}`;
    if (!Number.isInteger(l.qty) || l.qty <= 0 || l.qty > MAX_QTY) return `qty hors bornes : ${l.qty}`;
  }
  return null;
}

export interface RawInvoice {
  client: string;
  lines: InvoiceLine[];
}

export type RawInvoiceResult =
  | { ok: true; value: RawInvoice }
  | { ok: false; error: string };

/**
 * Valide puis analyse un document de facture reçu en texte brut.
 *
 * L'ordre est le défaut : le schéma passe sur le texte, l'application travaille
 * sur l'objet. Le lab constate l'écart au moment précis où il apparaît.
 */
export function validateRawInvoice(raw: string, actor: string): RawInvoiceResult {
  const refusedByText = textualSchemaPass(raw);
  if (refusedByText) return { ok: false, error: refusedByText };

  let parsed: { client?: unknown; lines?: unknown };
  try {
    parsed = JSON.parse(raw) as { client?: unknown; lines?: unknown };
  } catch {
    return { ok: false, error: 'JSON invalide' };
  }

  if (!Array.isArray(parsed.lines) || parsed.lines.length === 0) {
    return { ok: false, error: 'au moins une ligne est requise' };
  }

  const lines: InvoiceLine[] = (parsed.lines as Partial<InvoiceLine>[]).map((l) => ({
    label: String(l.label ?? 'Ligne'),
    qty: Number(l.qty ?? 1),
    unitPrice: Number(l.unitPrice ?? 0),
  }));

  // Le point de rupture : le schéma a dit oui, la règle dit non sur le même
  // document. Ce qui sera stocké est exactement ce que le schéma refusait.
  const refusedByObject = objectSchemaPass(lines);
  if (refusedByObject) {
    audit(actor, 'schéma.contourné', `texte accepté, objet refusé — ${refusedByObject}`);
    solve('json-duplicate-keys');
  }

  return { ok: true, value: { client: String(parsed.client ?? 'Client'), lines } };
}

// Corrigé de server/lib/validate.ts.
// Défaut éliminé : json-duplicate-keys.
//
// Les deux bornes d'exécution (evalBounded / callBounded) disparaissent : le
// corrigé n'exécute plus de code fourni par un utilisateur, donc il n'y a plus
// rien à borner. Elles restent exportées, inertes, pour que les modules qui les
// importaient encore ne cassent pas — et elles refusent toujours.

import type { InvoiceLine } from '../store.ts';

export const HOST_SECRET = 'lab-secret-novafact';

export interface BoundedResult {
  value: unknown;
  text: string;
  error: string | null;
  timedOut: boolean;
}

const refuse = (): Promise<BoundedResult> =>
  Promise.resolve({
    value: null,
    text: '',
    error: 'exécution de code fournie par l’utilisateur : refusée',
    timedOut: false,
  });

export const evalBounded = refuse;
export const callBounded = refuse;

// ── json-duplicate-keys ─────────────────────────────────────────────────────

const MAX_UNIT_PRICE = 100_000;
const MAX_QTY = 1_000;

export interface RawInvoice {
  client: string;
  lines: InvoiceLine[];
}

export type RawInvoiceResult =
  | { ok: true; value: RawInvoice }
  | { ok: false; error: string };

function checkLines(lines: InvoiceLine[]): string | null {
  for (const l of lines) {
    if (!Number.isFinite(l.unitPrice) || l.unitPrice < 0 || l.unitPrice > MAX_UNIT_PRICE) {
      return `unitPrice hors bornes : ${l.unitPrice}`;
    }
    if (!Number.isInteger(l.qty) || l.qty <= 0 || l.qty > MAX_QTY) {
      return `qty hors bornes : ${l.qty}`;
    }
  }
  return null;
}

/**
 * CORRIGÉ : on parse d'abord, on valide ensuite — et on ne valide que l'OBJET,
 * jamais son texte.
 *
 * Deux analyseurs d'un même format ne sont jamais d'accord sur les cas limites
 * (clés dupliquées, nombres hors plage, échappements Unicode) ; un seul a donc
 * le droit de décider : celui dont le résultat sera réellement utilisé. Le
 * schéma valide ici exactement la structure qui sera persistée, avec des
 * contrôles de type explicites plutôt que des conversions.
 *
 * En complément — et seulement en complément — un analyseur strict qui REFUSE
 * les clés dupliquées supprime la divergence à la source. `JSON.parse` ne sait
 * pas le faire : il faut un parseur qui expose chaque paire lue.
 */
export function validateRawInvoice(raw: string, _actor: string): RawInvoiceResult {
  if (raw.length > 64_000) return { ok: false, error: 'document trop volumineux' };

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'JSON invalide' };
  }

  const doc = value as { client?: unknown; lines?: unknown };
  if (!Array.isArray(doc.lines) || doc.lines.length === 0 || doc.lines.length > 500) {
    return { ok: false, error: 'au moins une ligne est requise' };
  }

  const lines: InvoiceLine[] = [];
  for (const l of doc.lines as Partial<InvoiceLine>[]) {
    if (typeof l !== 'object' || l === null) return { ok: false, error: 'ligne invalide' };
    if (typeof l.qty !== 'number' || typeof l.unitPrice !== 'number') {
      return { ok: false, error: 'qty et unitPrice doivent être des nombres' };
    }
    lines.push({ label: String(l.label ?? 'Ligne').slice(0, 200), qty: l.qty, unitPrice: l.unitPrice });
  }

  // La règle s'applique à l'objet, et à lui seul.
  const refused = checkLines(lines);
  if (refused) return { ok: false, error: refused };

  return { ok: true, value: { client: String(doc.client ?? 'Client').slice(0, 200), lines } };
}

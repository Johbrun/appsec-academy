// Corrigé de server/routes/clients.ts.
// Défaut éliminé : param-pollution.

import { Router } from 'express';
import { db } from '../store.ts';
import { requireUser } from '../lib/auth.ts';
import type { Client } from '../store.ts';

export const clientRoutes = Router();
clientRoutes.use(requireUser);

const PROJECTION = ['id', 'name', 'email'] as const;
const ALL_COLUMNS = ['id', 'tenantId', 'name', 'email', 'siret', 'iban'] as const;

/**
 * Le service annuaire interne.
 *
 * CORRIGÉ (param-pollution), côté service : un paramètre présent deux fois
 * n'est plus arbitré en silence, il est REFUSÉ. Un appelant qui envoie deux
 * fois `fields` ne sait pas ce qu'il demande, et le service n'a pas à le
 * deviner à sa place.
 */
function directoryService(params: URLSearchParams): Record<string, unknown>[] {
  for (const key of new Set(params.keys())) {
    if (params.getAll(key).length > 1) throw new Error(`paramètre en double : ${key}`);
  }

  const term = (params.get('q') ?? '').toLowerCase();
  const tenant = params.get('tenant') ?? '';
  const requested = (params.get('fields') ?? 'id,name').split(',').map((f) => f.trim());
  const columns = requested.filter((f) => (ALL_COLUMNS as readonly string[]).includes(f));

  return db.clients
    .filter((c) => c.tenantId === tenant && c.name.toLowerCase().includes(term))
    .map((c) => Object.fromEntries(columns.map((f) => [f, c[f as keyof Client]])));
}

/**
 * CORRIGÉ (param-pollution), côté appelant : la requête sortante est construite
 * avec un ENCODEUR à partir de valeurs validées, jamais par concaténation. Un
 * `&` dans le terme de recherche reste un `&` dans la valeur du paramètre `q`,
 * et ne devient jamais un séparateur. Les appels internes sont une surface
 * d'attaque au même titre que l'API publique.
 */
clientRoutes.get('/', (req, res) => {
  const raw = req.query.q ?? '';
  if (typeof raw !== 'string' || raw.length > 120) {
    res.status(400).json({ error: 'terme de recherche invalide' });
    return;
  }

  const params = new URLSearchParams();
  params.set('q', raw);
  params.set('tenant', req.user!.tenantId);
  params.set('fields', PROJECTION.join(','));

  try {
    res.json({ upstream: params.toString(), results: directoryService(params) });
  } catch {
    res.status(400).json({ error: 'requête interne refusée' });
  }
});

// Annuaire des clients du tenant.
// Exercice porté par ce fichier : param-pollution.

import { Router } from 'express';
import { audit, db, solve } from '../store.ts';
import { requireUser } from '../lib/auth.ts';
import type { Client } from '../store.ts';

export const clientRoutes = Router();
clientRoutes.use(requireUser);

/** Les seules colonnes que l'API publique est censée rendre. */
const PROJECTION = ['id', 'name', 'email'] as const;

const ALL_COLUMNS = ['id', 'tenantId', 'name', 'email', 'siret', 'iban'] as const;

/**
 * Le « service annuaire » interne.
 *
 * Il vit dans le même processus — tout reste local — mais il se comporte comme
 * un vrai service derrière HTTP : il reçoit une query string, la parse, et fait
 * confiance à ce qu'elle dit. Notamment : quand un paramètre apparaît deux
 * fois, `URLSearchParams.get` renvoie la PREMIÈRE occurrence. Un autre service,
 * un autre framework, garderait la dernière — c'est précisément ce désaccord
 * que la pollution de paramètres exploite.
 */
function directoryService(queryString: string): Record<string, unknown>[] {
  const q = new URLSearchParams(queryString);
  const term = (q.get('q') ?? '').toLowerCase();
  const tenant = q.get('tenant') ?? '';
  const requested = (q.get('fields') ?? 'id,name').split(',').map((f) => f.trim());

  const columns: readonly string[] = requested.includes('*')
    ? ALL_COLUMNS
    : requested.filter((f) => (ALL_COLUMNS as readonly string[]).includes(f));

  return db.clients
    .filter((c) => c.tenantId === tenant && c.name.toLowerCase().includes(term))
    .map((c) => Object.fromEntries(columns.map((f) => [f, c[f as keyof Client]])));
}

/**
 * VULNÉRABLE (param-pollution) : la requête sortante est fabriquée par
 * concaténation de chaînes, avec la valeur reçue du client telle quelle. Un
 * `&` dans le terme de recherche ne reste pas une donnée : il devient un
 * séparateur de paramètres dans l'appel interne, et tout ce qui suit devient un
 * paramètre que l'appelant public n'avait pas le droit de poser.
 *
 * Deux paramètres se laissent ainsi ajouter : `fields`, qui élargit la
 * projection jusqu'aux colonnes bancaires, et `tenant`, qui déplace la
 * recherche chez le voisin.
 *
 * Correctif attendu : construire la requête sortante à partir de valeurs
 * validées, avec un encodeur (`URLSearchParams`), jamais par concaténation. Et
 * côté service interne : refuser les paramètres en double plutôt que d'en
 * choisir un. Les appels internes sont une surface d'attaque au même titre que
 * l'API publique.
 */
clientRoutes.get('/', (req, res) => {
  const term = String(req.query.q ?? '');
  const upstream = `q=${term}&tenant=${req.user!.tenantId}&fields=${PROJECTION.join(',')}`;

  const results = directoryService(upstream);

  const extraColumns = results.some((row) =>
    Object.keys(row).some((k) => !(PROJECTION as readonly string[]).includes(k)),
  );
  const foreignTenant = results.some(
    (row) => typeof row.tenantId === 'string' && row.tenantId !== req.user!.tenantId,
  );

  if (extraColumns || foreignTenant) {
    audit(
      req.user!.email,
      'paramètre.injecté',
      `appel interne pollué : ${upstream.slice(0, 120)}`,
    );
    solve('param-pollution');
  }

  res.json({ upstream, results });
});

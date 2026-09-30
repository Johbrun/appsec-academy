// Réglages du tenant, calcul des pénalités de retard et export comptable.
//
// Exercices portés par ce fichier : proto-pollution, eval-formula, vm-escape,
// dual-use-endpoint, et la configuration qui alimente third-party-script (la
// page de paiement, côté client).

import { Router } from 'express';
import vm from 'node:vm';
import { audit, db, solve } from '../store.ts';
import { requireUser } from '../lib/auth.ts';
import { evalBounded, HOST_SECRET } from '../lib/validate.ts';

export const settingsRoutes = Router();

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * VULNÉRABLE (proto-pollution) : fusion récursive qui recopie toutes les clés
 * du client, y compris __proto__ et constructor.
 *
 * JSON.parse crée bien « __proto__ » comme propriété propre ; en revanche
 * target['__proto__'] passe par l'accesseur et renvoie Object.prototype. La
 * descente écrit donc dans le prototype partagé par tous les objets du
 * processus.
 *
 * Correctif attendu : refuser les clés __proto__ / constructor / prototype,
 * travailler sur des objets sans prototype (Object.create(null)) ou des Map, et
 * valider par schéma strict. Surtout : ne jamais faire dépendre une décision
 * d'autorisation d'une propriété héritée.
 */
function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): void {
  for (const key of Object.keys(source)) {
    const value = source[key];
    if (isObject(value)) {
      const current = (target as Record<string, unknown>)[key];
      if (!isObject(current)) (target as Record<string, unknown>)[key] = {};
      deepMerge((target as Record<string, unknown>)[key] as Record<string, unknown>, value);
    } else {
      (target as Record<string, unknown>)[key] = value;
    }
  }
}

settingsRoutes.get('/settings', requireUser, (req, res) => {
  const tenant = db.tenants.find((t) => t.id === req.user!.tenantId);
  res.json(tenant?.settings ?? {});
});

/** Lecture des réglages de la plateforme. Publique : ils n'ont rien de secret. */
settingsRoutes.get('/platform', requireUser, (_req, res) => {
  res.json(db.platform);
});

/**
 * VULNÉRABLE (dual-use-endpoint) : une seule route pour deux périmètres de
 * privilège. Le champ `scope` du corps décide si l'écriture atterrit dans les
 * réglages du tenant ou dans ceux de la plateforme — autrement dit, la portée
 * de l'écriture est une décision d'autorisation prise par le client.
 *
 * Correctif attendu : deux niveaux de privilège, deux routes, deux contrôles.
 * `PUT /settings` pour le tenant, `PUT /admin/platform` derrière un contrôle de
 * rôle explicite. Aucun champ du corps ne choisit un périmètre.
 */
settingsRoutes.put('/settings', requireUser, (req, res) => {
  const tenant = db.tenants.find((t) => t.id === req.user!.tenantId);
  if (!tenant) {
    res.status(404).json({ error: 'tenant introuvable' });
    return;
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const platformScope = body.scope === 'platform';
  const target = platformScope ? db.platform : tenant.settings;
  const before = JSON.stringify(db.platform);

  deepMerge(target, body);
  delete (target as Record<string, unknown>).scope;

  if (platformScope && req.user!.role !== 'admin' && JSON.stringify(db.platform) !== before) {
    audit(req.user!.email, 'privilège.franchi', `réglage plateforme écrit depuis ${req.user!.tenantId}`);
    solve('dual-use-endpoint');
  }

  // Le lab constate la pollution du prototype partagé.
  if (({} as Record<string, unknown>).canExport !== undefined) {
    audit(req.user!.email, 'prototype.pollué', 'Object.prototype.canExport');
  }

  res.json(target);
});

// ── Pénalités de retard ─────────────────────────────────────────────────────
//
// La formule est un réglage du tenant. Deux moteurs la calculent : celui qui
// « va vite » et celui qui « est isolé ». Aucun des deux ne tient.

/** Les seules variables qu'une formule de pénalité a le droit de nommer. */
const FORMULA_VARS = ['amount', 'days', 'rate'] as const;

/**
 * La grammaire fermée du langage de formules : nombres, variables déclarées,
 * opérateurs arithmétiques, parenthèses. Rien d'autre.
 *
 * Elle n'est PAS utilisée pour filtrer l'entrée — elle sert d'oracle au lab.
 * Quand l'interpréteur accepte une formule que cette grammaire refuse, c'est
 * qu'il exécute autre chose que du calcul : l'invariant est rompu à cet
 * instant précis. C'est aussi, mot pour mot, le correctif attendu.
 */
function isArithmetic(formula: string): boolean {
  const tokens = formula.match(/[A-Za-z_$][\w$]*|\d+(?:\.\d+)?|\S/g) ?? [];
  for (const t of tokens) {
    if (/^\d/.test(t)) continue;
    if (/^[+\-*/%()]$/.test(t)) continue;
    if ((FORMULA_VARS as readonly string[]).includes(t)) continue;
    return false;
  }
  return true;
}

settingsRoutes.post('/settings/penalty', requireUser, async (req, res) => {
  const tenant = db.tenants.find((t) => t.id === req.user!.tenantId);
  if (!tenant) {
    res.status(404).json({ error: 'tenant introuvable' });
    return;
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const formula = String(body.formula ?? tenant.settings.penaltyFormula ?? 'amount * days * rate');
  const scope = {
    amount: Number(body.amount ?? 1000),
    days: Number(body.days ?? 30),
    rate: Number(tenant.settings.penaltyRate ?? 0.001),
  };
  tenant.settings.penaltyFormula = formula;

  if (formula.length > 400) {
    res.status(400).json({ error: 'formule trop longue' });
    return;
  }

  if (body.engine === 'sandbox') {
    // VULNÉRABLE (vm-escape) : `node:vm` isole les variables globales, pas les
    // capacités — sa propre documentation le dit. L'objet passé en contexte
    // vient du realm hôte : `this.constructor` y renvoie l'`Object` de l'hôte,
    // et `Object.constructor` son `Function`. À partir de là, tout le processus
    // est joignable.
    //
    // Correctif attendu : isolation par processus séparé, `isolated-vm`, ou —
    // le seul correctif complet — pas d'exécution de code du tout. `vm2`, qui
    // prétendait le contraire, est abandonné après une série d'évasions.
    let value: unknown;
    let error: string | null = null;
    try {
      value = vm.runInNewContext(formula, { ...scope }, { timeout: 1000 });
    } catch (err) {
      error = String((err as Error).message ?? err);
    }

    const text = typeof value === 'string' ? value : JSON.stringify(value) ?? String(value);
    if (typeof text === 'string' && text.includes(HOST_SECRET)) {
      audit(req.user!.email, 'bac.à.sable.percé', 'le secret de signature est sorti du contexte vm');
      solve('vm-escape');
    }

    res.json({ engine: 'sandbox', formula, penalty: value ?? null, error });
    return;
  }

  // VULNÉRABLE (eval-formula) : la formule d'un tenant est passée à `eval()`.
  // Une expression métier n'a pas besoin d'un interpréteur complet : ce qui
  // entre ici, c'est le langage tout entier, avec ses capacités.
  //
  // Correctif attendu : un mini-évaluateur à grammaire fermée — voir
  // `isArithmetic` juste au-dessus, et le corrigé qui l'accompagne. Opérateurs
  // et variables déclarés, rien d'autre ne s'évalue. L'injection JS côté serveur
  // est le A1 de NodeGoat.
  //
  // (Le lab exécute dans un worker jetable, tué au bout d'une seconde et demie,
  // pour qu'une boucle infinie tapée par distraction ne fige pas la séance. Dans
  // du vrai code, l'évaluation aurait lieu ici même, sur la boucle d'événements.)
  const run = await evalBounded(formula, scope);

  if (!run.error && !run.timedOut && !isArithmetic(formula)) {
    audit(req.user!.email, 'code.exécuté', `formule hors grammaire évaluée : ${formula.slice(0, 80)}`);
    solve('eval-formula');
  }

  res.json({
    engine: 'eval',
    formula,
    penalty: run.value ?? null,
    rendered: run.text,
    error: run.timedOut ? 'budget de calcul dépassé' : run.error,
  });
});

// L'export comptable : la décision d'autorisation lit une propriété sur un
// objet d'options fraîchement créé. Sur un objet ordinaire, cette propriété
// n'existe pas… sauf si le prototype a été pollué.
settingsRoutes.get('/export', requireUser, (req, res) => {
  const options: Record<string, unknown> = {};

  const allowed = options.canExport === true || req.user!.role === 'admin';
  if (!allowed) {
    res.status(403).json({ error: 'export réservé aux comptes autorisés' });
    return;
  }

  if (options.canExport === true && req.user!.role !== 'admin') {
    audit(req.user!.email, 'export.autorisé', 'via propriété héritée');
    solve('proto-pollution');
  }

  res.json({
    generatedAt: new Date().toISOString(),
    invoices: db.invoices.map((i) => ({ ref: i.ref, tenant: i.tenantId, client: i.client, total: i.total, status: i.status })),
  });
});

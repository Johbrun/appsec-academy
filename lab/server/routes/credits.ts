// Avoirs. Exercices portés par ce fichier : race-credit, multistep-authz.

import { Router } from 'express';
import { audit, db, solve } from '../store.ts';
import { requireUser } from '../lib/auth.ts';
import type { CreditDraft } from '../store.ts';

export const creditRoutes = Router();
creditRoutes.use(requireUser);

/** Total réellement consommé, pour que le lab voie le dépassement. */
const applied = new Map<string, number>();

/** Remis à zéro par /api/lab/reset. */
export const resetCreditState = () => applied.clear();

/** Simule l'aller-retour vers la base : c'est la fenêtre de la course. */
const roundtrip = () => new Promise((r) => setTimeout(r, 15));

creditRoutes.get('/', (req, res) => {
  res.json(db.credits.filter((c) => c.tenantId === req.user!.tenantId));
});

creditRoutes.post('/apply', async (req, res) => {
  const amount = Number(req.body?.amount ?? 0);
  const credit = db.credits.find((c) => c.tenantId === req.user!.tenantId);
  if (!credit || amount <= 0) {
    res.status(400).json({ error: 'montant ou avoir invalide' });
    return;
  }

  // VULNÉRABLE (race-credit) : lecture, attente, vérification, attente,
  // écriture. Tout ce qui se passe entre la lecture et l'écriture est perdu.
  // En Node, un seul `await` entre la vérification et l'action suffit : la
  // boucle d'événements traite les autres requêtes pendant ce temps.
  //
  // Correctif attendu : rendre l'opération atomique. Update conditionnel
  // (UPDATE … SET balance = balance - $1 WHERE id = $2 AND balance >= $1),
  // transaction avec SELECT … FOR UPDATE, $inc atomique côté Mongo, ou clé
  // d'idempotence. Le correctif est dans la base, pas dans le code applicatif.
  const balance = credit.balance;
  await roundtrip();

  if (balance < amount) {
    res.status(409).json({ error: 'solde insuffisant', balance });
    return;
  }

  await roundtrip();
  credit.balance = balance - amount;

  const total = (applied.get(credit.id) ?? 0) + amount;
  applied.set(credit.id, total);

  const initial = 100; // solde de départ de CN-500
  if (total > initial) {
    audit(req.user!.email, 'invariant.rompu', `avoir ${credit.id} : ${total} € consommés pour ${initial} € de solde`);
    solve('race-credit');
  }

  res.json({ ok: true, applied: amount, balance: credit.balance, totalApplied: total });
});

// ── Émission d'un avoir : le flux en trois étapes ───────────────────────────
//
// Étape 1 : ouvrir le brouillon        — réservée au rôle comptable
// Étape 2 : y poser le montant         — « simple saisie »
// Étape 3 : émettre l'avoir            — « simple validation »
//
// C'est le découpage qui fait le défaut : chaque étape est un endpoint public,
// atteignable dans n'importe quel ordre, par n'importe qui.

const ACCOUNTING_ROLES = new Set(['accountant', 'admin']);

/** Étape 1 — la seule qui vérifie quoi que ce soit. */
creditRoutes.post('/drafts', (req, res) => {
  if (!ACCOUNTING_ROLES.has(req.user!.role)) {
    res.status(403).json({ error: 'réservé au rôle comptable' });
    return;
  }
  const draft: CreditDraft = {
    id: `CND-${db.drafts.length + 1}`,
    tenantId: req.user!.tenantId,
    amount: 0,
    approvedBy: req.user!.email,
    issued: false,
  };
  db.drafts.push(draft);
  res.status(201).json(draft);
});

/**
 * Étape 2.
 *
 * VULNÉRABLE (multistep-authz) : aucun contrôle de rôle — « l'étape 1 l'a déjà
 * fait ». Et, pour être idempotente, elle crée le brouillon quand il n'existe
 * pas : l'étape qui vérifiait le rôle devient alors parfaitement facultative.
 *
 * Correctif attendu : chaque étape d'un flux est un endpoint public — elle
 * vérifie le droit ET l'état attendu. Un jeton d'étape signé, ou une machine à
 * états côté serveur où seule une transition depuis « approuvé » mène à
 * « émis », rend l'ordre non contournable.
 */
creditRoutes.post('/drafts/:id/lines', (req, res) => {
  let draft = db.drafts.find((d) => d.id === req.params.id);
  if (!draft) {
    draft = {
      id: req.params.id,
      tenantId: req.user!.tenantId,
      amount: 0,
      approvedBy: null, // personne n'a approuvé : le brouillon est né ici
      issued: false,
    };
    db.drafts.push(draft);
  }
  draft.amount = Number(req.body?.amount ?? 0);
  res.json(draft);
});

/**
 * Étape 3.
 *
 * VULNÉRABLE (multistep-authz) : ni rôle, ni état d'arrivée vérifiés. Le
 * brouillon devient un avoir utilisable, quel que soit le chemin parcouru.
 */
creditRoutes.post('/drafts/:id/issue', (req, res) => {
  const draft = db.drafts.find((d) => d.id === req.params.id && d.tenantId === req.user!.tenantId);
  if (!draft) {
    res.status(404).json({ error: 'brouillon introuvable' });
    return;
  }
  if (draft.issued) {
    res.status(409).json({ error: 'avoir déjà émis' });
    return;
  }
  if (!(draft.amount > 0)) {
    res.status(400).json({ error: 'montant requis' });
    return;
  }

  draft.issued = true;
  const note = { id: `CN-${600 + db.credits.length}`, tenantId: draft.tenantId, balance: draft.amount };
  db.credits.push(note);

  // Le point de rupture : un avoir opposable vient d'être créé alors qu'aucune
  // étape n'a jamais vu de rôle comptable.
  if (!draft.approvedBy) {
    audit(req.user!.email, 'flux.contourné', `${note.id} émis sans l’étape comptable (rôle ${req.user!.role})`);
    solve('multistep-authz');
  }

  res.status(201).json({ ...note, approvedBy: draft.approvedBy });
});

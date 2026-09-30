// Corrigé de server/routes/credits.ts.
// Défauts éliminés : race-credit, multistep-authz.

import { Router } from 'express';
import { db } from '../store.ts';
import { requireUser } from '../lib/auth.ts';
import type { CreditDraft } from '../store.ts';

export const creditRoutes = Router();
creditRoutes.use(requireUser);

/** Attendu par /api/lab/reset : la version corrigée ne garde plus d'état. */
export const resetCreditState = () => {};

creditRoutes.get('/', (req, res) => res.json(db.credits.filter((c) => c.tenantId === req.user!.tenantId)));

creditRoutes.post('/apply', (req, res) => {
  const amount = Number(req.body?.amount ?? 0);
  const credit = db.credits.find((c) => c.tenantId === req.user!.tenantId);
  if (!credit || !Number.isFinite(amount) || amount <= 0) {
    res.status(400).json({ error: 'montant ou avoir invalide' });
    return;
  }

  // CORRIGÉ (race-credit) : vérification et écriture dans le même tour de
  // boucle, sans await entre les deux. C'est l'équivalent applicatif d'un
  // update conditionnel (UPDATE … SET balance = balance - $1 WHERE id = $2 AND
  // balance >= $1) : en production c'est la base qui doit porter la garantie,
  // pas le code.
  if (credit.balance < amount) {
    res.status(409).json({ error: 'solde insuffisant', balance: credit.balance });
    return;
  }
  credit.balance -= amount;

  res.json({ ok: true, applied: amount, balance: credit.balance, totalApplied: amount });
});

// ── Émission d'un avoir ─────────────────────────────────────────────────────
//
// CORRIGÉ (multistep-authz) : chaque étape est un endpoint public, donc chaque
// étape vérifie le DROIT et l'ÉTAT attendu. Le brouillon n'est créé que par
// l'étape qui contrôle le rôle — plus d'upsert « pour être idempotent » —, et
// l'émission n'accepte qu'un brouillon issu de cette étape-là. L'ordre devient
// non contournable parce que la machine à états est côté serveur.

const ACCOUNTING_ROLES = new Set(['accountant', 'admin']);
const isAccounting = (role: string) => ACCOUNTING_ROLES.has(role);

creditRoutes.post('/drafts', (req, res) => {
  if (!isAccounting(req.user!.role)) {
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

/** L'étape 2 vérifie le rôle, le tenant, et que l'étape 1 a bien eu lieu. */
creditRoutes.post('/drafts/:id/lines', (req, res) => {
  if (!isAccounting(req.user!.role)) {
    res.status(403).json({ error: 'réservé au rôle comptable' });
    return;
  }
  const draft = db.drafts.find((d) => d.id === req.params.id && d.tenantId === req.user!.tenantId);
  if (!draft || !draft.approvedBy) {
    res.status(404).json({ error: 'brouillon introuvable' });
    return;
  }
  if (draft.issued) {
    res.status(409).json({ error: 'avoir déjà émis' });
    return;
  }
  const amount = Number(req.body?.amount ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    res.status(400).json({ error: 'montant invalide' });
    return;
  }
  draft.amount = amount;
  res.json(draft);
});

/** L'étape 3 aussi : rôle, tenant, et transition « approuvé → émis ». */
creditRoutes.post('/drafts/:id/issue', (req, res) => {
  if (!isAccounting(req.user!.role)) {
    res.status(403).json({ error: 'réservé au rôle comptable' });
    return;
  }
  const draft = db.drafts.find((d) => d.id === req.params.id && d.tenantId === req.user!.tenantId);
  if (!draft || !draft.approvedBy) {
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
  res.status(201).json({ ...note, approvedBy: draft.approvedBy });
});

// Profil utilisateur. Exercice porté par ce fichier : mass-assignment.

import { Router } from 'express';
import { audit, db, solve } from '../store.ts';
import { requireUser } from '../lib/auth.ts';
import { sign } from '../lib/jwt.ts';

export const profileRoutes = Router();
profileRoutes.use(requireUser);

profileRoutes.get('/', (req, res) => {
  const user = db.users.find((u) => u.email === req.user!.email);
  if (!user) {
    res.status(404).json({ error: 'compte introuvable' });
    return;
  }
  const { password, ...safe } = user;
  void password;
  res.json(safe);
});

profileRoutes.patch('/', (req, res) => {
  const user = db.users.find((u) => u.email === req.user!.email);
  if (!user) {
    res.status(404).json({ error: 'compte introuvable' });
    return;
  }

  const before = user.role;

  // VULNÉRABLE (mass-assignment) : tout le corps de la requête est recopié dans
  // l'entité persistée, « pour ne pas avoir à lister les champs ».
  //
  // Correctif attendu : construire explicitement l'objet des champs autorisés
  // (name, et rien d'autre ici). Un DTO d'entrée distinct du modèle persisté
  // rend l'oubli impossible plutôt qu'improbable.
  Object.assign(user, req.body ?? {});

  if (before !== 'admin' && user.role === 'admin') {
    audit(user.email, 'privilège.élevé', `${before} → admin via PATCH /api/me`);
    solve('mass-assignment');
  }

  const { password, ...safe } = user;
  void password;
  // Le jeton est réémis avec le rôle courant : l'élévation est immédiatement utilisable.
  res.json({ ...safe, token: sign({ sub: user.email, role: user.role, tenantId: user.tenantId }) });
});

import { Router } from 'express';
import { db } from '../store.ts';
import { requireUser } from '../lib/auth.ts';
import { sign } from '../lib/jwt.ts';

export const profileRoutes = Router();
profileRoutes.use(requireUser);

profileRoutes.get('/', (req, res) => {
  const user = db.users.find((u) => u.email === req.user!.email);
  if (!user) { res.status(404).json({ error: 'compte introuvable' }); return; }
  const { password, ...safe } = user; void password;
  res.json(safe);
});

profileRoutes.patch('/', (req, res) => {
  const user = db.users.find((u) => u.email === req.user!.email);
  if (!user) { res.status(404).json({ error: 'compte introuvable' }); return; }

  // CORRIGÉ : liste blanche explicite. Le rôle, le tenant et l'identifiant ne
  // viennent jamais du client.
  const { name } = req.body ?? {};
  if (typeof name === 'string' && name.trim()) user.name = name.trim();

  const { password, ...safe } = user; void password;
  res.json({ ...safe, token: sign({ sub: user.email, role: user.role, tenantId: user.tenantId }) });
});

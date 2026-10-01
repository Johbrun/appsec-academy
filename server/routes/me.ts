import type { Router } from 'express';
import { HttpError, bodyOf, password, text } from '../lib/http.ts';
import type { Deps } from '../lib/deps.ts';
import { requireUser } from '../lib/session.ts';

export function registerMeRoutes(api: Router, { db, clock, passwords, sessions }: Deps) {
  const memberships = (userId: number) => db.prepare(`
    SELECT c.id, c.name, t.name AS teacher, m.joined_at AS joinedAt
    FROM cohort_members m JOIN cohorts c ON c.id = m.cohort_id JOIN users t ON t.id = c.owner_id
    WHERE m.user_id = ? ORDER BY c.id`).all(userId);

  api.get('/me', (req, res) => {
    const user = requireUser(req);
    res.json({ user, cohorts: memberships(user.id) });
  });

  api.patch('/me', (req, res) => {
    const user = requireUser(req);
    // Seul le nom est modifiable ici. Tout autre champ du corps est ignoré.
    const name = text(bodyOf(req), 'name', 'Nom', 1, 80);
    db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name, user.id);
    res.json({ user: { ...user, name } });
  });

  api.post('/me/password', async (req, res) => {
    const user = requireUser(req);
    const body = bodyOf(req);
    const current = password(body, 'current', 'Mot de passe actuel', 1);
    const next = password(body, 'next', 'Nouveau mot de passe', 10);
    const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(user.id) as { password_hash: string };
    // 403 et non 401 : le client traite 401 comme « session expirée ».
    if (!(await passwords.verify(row.password_hash, current))) throw new HttpError(403, 'Mot de passe actuel incorrect');
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(await passwords.hash(next), user.id);
    sessions.revokeAllFor(user.id, req.sessionHash);
    res.json({ ok: true });
  });

  api.get('/me/export', (req, res) => {
    const user = requireUser(req);
    const account = db.prepare('SELECT id, email, name, role, created_at AS createdAt FROM users WHERE id = ?').get(user.id);
    const progress = db.prepare('SELECT data, rev, updated_at AS updatedAt FROM progress WHERE user_id = ?').get(user.id) as
      { data: string; rev: number; updatedAt: number } | undefined;
    const owned = db.prepare('SELECT id, name, code, created_at AS createdAt FROM cohorts WHERE owner_id = ?').all(user.id);
    res.json({
      exportedAt: clock.now(),
      user: account,
      progress: progress ? { data: JSON.parse(progress.data), rev: progress.rev, updatedAt: progress.updatedAt } : null,
      cohorts: memberships(user.id),
      ownedCohorts: owned,
    });
  });

  api.delete('/me', async (req, res) => {
    const user = requireUser(req);
    const pwd = password(bodyOf(req), 'password', 'Mot de passe', 1);
    const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(user.id) as { password_hash: string };
    if (!(await passwords.verify(row.password_hash, pwd))) throw new HttpError(403, 'Mot de passe incorrect');
    // Les clés étrangères en cascade emportent sessions, progression, appartenances, jetons et promos possédées.
    db.prepare('DELETE FROM users WHERE id = ?').run(user.id);
    sessions.clearCookie(res);
    res.json({ ok: true });
  });
}

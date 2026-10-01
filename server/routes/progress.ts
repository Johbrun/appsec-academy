import type { Router } from 'express';
import { HttpError, bodyOf, integer, isPlainObject } from '../lib/http.ts';
import type { Deps } from '../lib/deps.ts';
import { requireUser } from '../lib/session.ts';

interface Row { data: string; rev: number; updated_at: number }

export function registerProgressRoutes(api: Router, { db, clock }: Deps) {
  api.get('/progress', (req, res) => {
    const user = requireUser(req);
    const row = db.prepare('SELECT data, rev, updated_at FROM progress WHERE user_id = ?').get(user.id) as Row | undefined;
    res.json(row ? { data: JSON.parse(row.data), rev: row.rev, updatedAt: row.updated_at } : { data: null, rev: 0 });
  });

  // Concurrence optimiste : on n'écrase que la révision qu'on a lue. Sinon 409 avec l'état du serveur,
  // et le client fusionne avant de réessayer.
  api.put('/progress', (req, res) => {
    const user = requireUser(req);
    const body = bodyOf(req);
    const rev = integer(body.rev, 'rev', 0);
    const data = body.data;
    if (!isPlainObject(data)) throw new HttpError(400, 'data : objet attendu');
    // `version` est la seule exigence : le reste du document est libre, pour qu'un nouveau jeu ne change rien côté serveur.
    integer(data.version, 'data.version', 1);

    const json = JSON.stringify(data);
    const now = clock.now();
    const result = db.transaction(() => {
      const current = db.prepare('SELECT data, rev FROM progress WHERE user_id = ?').get(user.id) as { data: string; rev: number } | undefined;
      if (!current) {
        if (rev !== 0) return { conflict: { data: null, rev: 0 } };
        db.prepare('INSERT INTO progress (user_id, data, rev, updated_at) VALUES (?, ?, 1, ?)').run(user.id, json, now);
        return { rev: 1 };
      }
      if (current.rev !== rev) return { conflict: { data: JSON.parse(current.data) as unknown, rev: current.rev } };
      db.prepare('UPDATE progress SET data = ?, rev = rev + 1, updated_at = ? WHERE user_id = ?').run(json, now, user.id);
      return { rev: current.rev + 1 };
    }).immediate();

    if ('conflict' in result) {
      res.status(409).json({ error: 'Conflit de version', ...result.conflict });
      return;
    }
    res.json({ rev: result.rev, updatedAt: now });
  });

  api.delete('/progress', (req, res) => {
    const user = requireUser(req);
    db.prepare('DELETE FROM progress WHERE user_id = ?').run(user.id);
    res.json({ ok: true });
  });
}

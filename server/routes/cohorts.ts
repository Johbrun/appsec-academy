import type { Router } from 'express';
import { HttpError, bodyOf, idParam, notFound } from '../lib/http.ts';
import type { Deps } from '../lib/deps.ts';
import { requireUser } from '../lib/session.ts';
import { CODE_RE } from '../lib/tokens.ts';

/** Côté étudiant : rejoindre une promo avec son code, la quitter. */
export function registerCohortRoutes(api: Router, { db, clock, limiters }: Deps) {
  api.post('/cohorts/join', limiters.join, (req, res) => {
    const user = requireUser(req);
    if (user.role !== 'student') throw new HttpError(403, 'Seuls les étudiants rejoignent une promo');
    const raw = bodyOf(req).code;
    if (typeof raw !== 'string') throw new HttpError(400, 'Code : texte attendu');
    const code = raw.toUpperCase().replace(/[\s-]/g, '');
    // Format invalide et code inconnu : même réponse, pour ne rien révéler.
    const cohort = CODE_RE.test(code)
      ? db.prepare('SELECT id, name FROM cohorts WHERE code = ?').get(code) as { id: number; name: string } | undefined
      : undefined;
    if (!cohort) throw new HttpError(404, 'Code de promo invalide');
    const added = db.prepare('INSERT OR IGNORE INTO cohort_members (cohort_id, user_id, joined_at) VALUES (?, ?, ?)')
      .run(cohort.id, user.id, clock.now()).changes > 0;
    res.json({ cohort, joined: added });
  });

  // On ne quitte que sa propre appartenance : l'identité vient de la session, jamais de l'URL ou du corps.
  api.delete('/cohorts/:id/membership', (req, res) => {
    const user = requireUser(req);
    const id = idParam(req.params.id);
    const { changes } = db.prepare('DELETE FROM cohort_members WHERE cohort_id = ? AND user_id = ?').run(id, user.id);
    if (!changes) throw notFound();
    res.json({ ok: true });
  });
}

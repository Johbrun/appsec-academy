import type { Router } from 'express';
import { HttpError, bodyOf, idParam, notFound, text } from '../lib/http.ts';
import type { Deps } from '../lib/deps.ts';
import { createResetToken } from '../lib/reset.ts';
import { requireTeacher } from '../lib/session.ts';
import { newCohortCode } from '../lib/tokens.ts';
import { summarize } from '../summary.ts';

interface CohortRow { id: number; name: string; code: string; created_at: number }

/**
 * Espace enseignant. Règle unique, appliquée par `ownedCohort` et `memberOf` : une promo
 * n'existe que pour son propriétaire, un étudiant que s'il en est membre. Dans tous les
 * autres cas la réponse est un 404 identique, qu'il s'agisse d'un id inconnu ou interdit.
 */
export function registerTeacherRoutes(api: Router, { db, config, clock }: Deps) {
  const ownedCohort = (teacherId: number, cohortId: number): CohortRow => {
    const cohort = db.prepare('SELECT id, name, code, created_at FROM cohorts WHERE id = ? AND owner_id = ?').get(cohortId, teacherId) as CohortRow | undefined;
    if (!cohort) throw notFound();
    return cohort;
  };

  const memberOf = (cohortId: number, studentId: number) => {
    const row = db.prepare(`
      SELECT u.id, u.name, u.email, u.role, m.joined_at AS joinedAt
      FROM cohort_members m JOIN users u ON u.id = m.user_id
      WHERE m.cohort_id = ? AND m.user_id = ?`).get(cohortId, studentId) as
      { id: number; name: string; email: string; role: string; joinedAt: number } | undefined;
    if (!row) throw notFound();
    return row;
  };

  const present = (c: CohortRow) => ({ id: c.id, name: c.name, code: c.code, createdAt: c.created_at });

  api.get('/teacher/cohorts', (req, res) => {
    const teacher = requireTeacher(req);
    const rows = db.prepare(`
      SELECT c.id, c.name, c.code, c.created_at AS createdAt,
             (SELECT COUNT(*) FROM cohort_members m WHERE m.cohort_id = c.id) AS members
      FROM cohorts c WHERE c.owner_id = ? ORDER BY c.id DESC`).all(teacher.id);
    res.json({ cohorts: rows });
  });

  api.post('/teacher/cohorts', (req, res) => {
    const teacher = requireTeacher(req);
    const name = text(bodyOf(req), 'name', 'Nom de la promo', 1, 80);
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = newCohortCode();
      try {
        const id = Number(db.prepare('INSERT INTO cohorts (name, code, owner_id, created_at) VALUES (?, ?, ?, ?)')
          .run(name, code, teacher.id, clock.now()).lastInsertRowid);
        res.status(201).json({ cohort: present(ownedCohort(teacher.id, id)) });
        return;
      } catch (e) {
        if ((e as { code?: string }).code !== 'SQLITE_CONSTRAINT_UNIQUE') throw e;
      }
    }
    throw new HttpError(500, 'Impossible de générer un code de promo');
  });

  api.post('/teacher/cohorts/:id/code', (req, res) => {
    const teacher = requireTeacher(req);
    const cohort = ownedCohort(teacher.id, idParam(req.params.id));
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        db.prepare('UPDATE cohorts SET code = ? WHERE id = ?').run(newCohortCode(), cohort.id);
        res.json({ cohort: present(ownedCohort(teacher.id, cohort.id)) });
        return;
      } catch (e) {
        if ((e as { code?: string }).code !== 'SQLITE_CONSTRAINT_UNIQUE') throw e;
      }
    }
    throw new HttpError(500, 'Impossible de générer un code de promo');
  });

  api.get('/teacher/cohorts/:id', (req, res) => {
    const teacher = requireTeacher(req);
    const cohort = ownedCohort(teacher.id, idParam(req.params.id));
    const rows = db.prepare(`
      SELECT u.id, u.name, u.email, m.joined_at AS joinedAt, p.data, p.updated_at AS lastActive
      FROM cohort_members m JOIN users u ON u.id = m.user_id LEFT JOIN progress p ON p.user_id = u.id
      WHERE m.cohort_id = ? ORDER BY u.name COLLATE NOCASE, u.id`).all(cohort.id) as
      { id: number; name: string; email: string; joinedAt: number; data: string | null; lastActive: number | null }[];
    res.json({
      cohort: present(cohort),
      members: rows.map((r) => ({
        id: r.id, name: r.name, email: r.email, joinedAt: r.joinedAt,
        lastActive: r.lastActive,
        summary: summarize(r.data ? JSON.parse(r.data) : null),
      })),
    });
  });

  api.get('/teacher/cohorts/:id/students/:uid', (req, res) => {
    const teacher = requireTeacher(req);
    const cohort = ownedCohort(teacher.id, idParam(req.params.id));
    const student = memberOf(cohort.id, idParam(req.params.uid));
    const progress = db.prepare('SELECT data, rev, updated_at AS updatedAt FROM progress WHERE user_id = ?').get(student.id) as
      { data: string; rev: number; updatedAt: number } | undefined;
    res.json({
      cohort: { id: cohort.id, name: cohort.name },
      student: { id: student.id, name: student.name, email: student.email, joinedAt: student.joinedAt },
      progress: progress ? { data: JSON.parse(progress.data), rev: progress.rev, updatedAt: progress.updatedAt } : null,
    });
  });

  api.post('/teacher/cohorts/:id/students/:uid/reset-link', (req, res) => {
    const teacher = requireTeacher(req);
    const cohort = ownedCohort(teacher.id, idParam(req.params.id));
    const student = memberOf(cohort.id, idParam(req.params.uid));
    // Un membre devenu enseignant n'est plus un étudiant : son compte n'appartient pas à l'ancien enseignant de sa promo.
    if (student.role !== 'student') throw notFound();
    const token = createResetToken(db, student.id, clock.now(), config.resetTtlMs);
    // Le jeton voyage dans le fragment d'URL : il n'atteint jamais un journal d'accès.
    res.json({ token, link: `${config.allowedOrigins[0]}/#/reinitialiser?token=${token}`, expiresAt: clock.now() + config.resetTtlMs });
  });

  api.delete('/teacher/cohorts/:id/students/:uid', (req, res) => {
    const teacher = requireTeacher(req);
    const cohort = ownedCohort(teacher.id, idParam(req.params.id));
    const student = memberOf(cohort.id, idParam(req.params.uid));
    db.prepare('DELETE FROM cohort_members WHERE cohort_id = ? AND user_id = ?').run(cohort.id, student.id);
    res.json({ ok: true });
  });
}

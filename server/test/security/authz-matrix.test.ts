import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createResetToken } from '../../lib/reset.ts';
import { registeredRoutes, scene, startWorld, strayRoutes, type Actor, type Scene } from '../helpers.ts';

/**
 * La matrice des droits : pour CHAQUE route de l'API, le statut attendu pour chaque type d'acteur.
 * Un test de complétude échoue si une route existe sans ligne ici (ou l'inverse) : on ne peut
 * pas ajouter une route sans déclarer qui a le droit de l'appeler.
 */
type Who = 'anon' | 'studentA' | 'studentB' | 'teacherOwner' | 'teacherOther' | 'teacherOwnerVsOutsider';

interface Row {
  /** « MÉTHODE /api/chemin » tel qu'enregistré dans Express. */
  route: string;
  request(s: Scene, actor: Actor | null, who: Who): { path: string; body?: unknown } | Promise<{ path: string; body?: unknown }>;
  expect: Partial<Record<Who, number>>;
}

/** Toute personne connectée est servie ; les anonymes reçoivent 401. */
const signedIn: Row['expect'] = { anon: 401, studentA: 200, studentB: 200, teacherOwner: 200, teacherOther: 200 };
/** Réservé aux enseignants : 401 sans session, 403 pour un étudiant. */
const teachersOnly = (ok: number): Row['expect'] => ({ anon: 401, studentA: 403, studentB: 403, teacherOwner: ok, teacherOther: ok });
/** Sur une promo précise : seul son propriétaire passe ; l'autre enseignant reçoit un 404 identique à « n'existe pas ». */
const ownerOnly = (ok: number): Row['expect'] => ({ anon: 401, studentA: 403, studentB: 403, teacherOwner: ok, teacherOther: 404 });
/** Idem, sur un étudiant : le propriétaire ne passe que si l'étudiant est membre de SA promo. */
const ownerOfMember = (ok: number): Row['expect'] => ({ ...ownerOnly(ok), teacherOwnerVsOutsider: 404 });

const cohortPath = (s: Scene, suffix = '') => ({ path: `/api/teacher/cohorts/${s.cohort.id}${suffix}` });
const studentPath = (s: Scene, who: Who, suffix = '') => ({
  // « Hors promo » : le propriétaire vise l'étudiant B, qui n'est pas membre.
  path: `/api/teacher/cohorts/${s.cohort.id}/students/${who === 'teacherOwnerVsOutsider' ? s.B.id : s.A.id}${suffix}`,
});

const rows: Row[] = [
  // ---- publiques
  { route: 'POST /api/auth/signup', expect: { anon: 201, studentA: 201 },
    request: (_s, _a) => ({ path: '/api/auth/signup', body: { email: `nouveau${Math.random().toString(36).slice(2)}@academy.test`, name: 'Nouveau', password: 'un mot de passe solide' } }) },
  { route: 'POST /api/auth/login', expect: { anon: 200 },
    request: (s) => ({ path: '/api/auth/login', body: { email: s.A.email, password: s.A.password } }) },
  { route: 'POST /api/auth/logout', expect: { anon: 200, studentA: 200 },
    request: () => ({ path: '/api/auth/logout', body: {} }) },
  { route: 'POST /api/auth/reset', expect: { anon: 200 },
    request: (s) => ({ path: '/api/auth/reset', body: { token: createResetToken(s.w.db, s.A.id, s.w.now(), 60_000), password: 'un mot de passe solide' } }) },

  // ---- compte : chacun n'agit que sur le sien
  { route: 'GET /api/me', expect: signedIn, request: () => ({ path: '/api/me' }) },
  { route: 'PATCH /api/me', expect: signedIn, request: () => ({ path: '/api/me', body: { name: 'Nouveau nom' } }) },
  { route: 'POST /api/me/password', expect: signedIn,
    request: (_s, a) => ({ path: '/api/me/password', body: { current: a?.password ?? 'x', next: 'un autre mot de passe' } }) },
  { route: 'GET /api/me/export', expect: signedIn, request: () => ({ path: '/api/me/export' }) },
  { route: 'DELETE /api/me', expect: signedIn, request: (_s, a) => ({ path: '/api/me', body: { password: a?.password ?? 'x' } }) },

  // ---- progression : celle de l'appelant, jamais une autre
  { route: 'GET /api/progress', expect: signedIn, request: () => ({ path: '/api/progress' }) },
  { route: 'PUT /api/progress', expect: signedIn, request: () => ({ path: '/api/progress', body: { data: { version: 1, xp: 1 }, rev: 0 } }) },
  { route: 'DELETE /api/progress', expect: signedIn, request: () => ({ path: '/api/progress' }) },

  // ---- promos côté étudiant
  { route: 'POST /api/cohorts/join', expect: { anon: 401, studentA: 200, studentB: 200, teacherOwner: 403, teacherOther: 403 },
    request: (s) => ({ path: '/api/cohorts/join', body: { code: s.cohort.code } }) },
  { route: 'DELETE /api/cohorts/:id/membership', expect: { anon: 401, studentA: 200, studentB: 404, teacherOwner: 404, teacherOther: 404 },
    request: (s) => ({ path: `/api/cohorts/${s.cohort.id}/membership` }) },

  // ---- espace enseignant
  { route: 'GET /api/teacher/cohorts', expect: teachersOnly(200), request: () => ({ path: '/api/teacher/cohorts' }) },
  { route: 'POST /api/teacher/cohorts', expect: teachersOnly(201), request: () => ({ path: '/api/teacher/cohorts', body: { name: 'Nouvelle promo' } }) },
  { route: 'POST /api/teacher/cohorts/:id/code', expect: ownerOnly(200), request: (s) => cohortPath(s, '/code') },
  { route: 'GET /api/teacher/cohorts/:id', expect: ownerOnly(200), request: (s) => cohortPath(s) },
  { route: 'GET /api/teacher/cohorts/:id/students/:uid', expect: ownerOfMember(200), request: (s, _a, who) => studentPath(s, who) },
  { route: 'POST /api/teacher/cohorts/:id/students/:uid/reset-link', expect: ownerOfMember(200), request: (s, _a, who) => studentPath(s, who, '/reset-link') },
  { route: 'DELETE /api/teacher/cohorts/:id/students/:uid', expect: ownerOfMember(200), request: (s, _a, who) => studentPath(s, who) },
];

const method = (route: string) => route.split(' ')[0];
const actorFor = (s: Scene, who: Who): Actor | null => ({
  anon: null, studentA: s.A, studentB: s.B, teacherOwner: s.T1, teacherOther: s.T2, teacherOwnerVsOutsider: s.T1,
}[who]);

describe('matrice des droits', () => {
  it('chaque route enregistrée a sa ligne dans la matrice, et réciproquement', async () => {
    const w = await startWorld();
    try {
      const registered = registeredRoutes(w.app).map((r) => `${r.method} ${r.path}`).sort();
      const declared = rows.map((r) => r.route).sort();
      assert.deepEqual(registered, declared);
      assert.deepEqual(strayRoutes(w.app), [], 'aucune route ne doit être posée hors du routeur de l’API');
    } finally { await w.close(); }
  });

  it('toute route protégée refuse les anonymes avec 401', () => {
    const publicRoutes = new Set(['POST /api/auth/signup', 'POST /api/auth/login', 'POST /api/auth/logout', 'POST /api/auth/reset']);
    for (const row of rows) {
      if (publicRoutes.has(row.route)) continue;
      assert.equal(row.expect.anon, 401, `${row.route} doit exiger une session`);
    }
  });

  for (const row of rows) {
    for (const [who, expected] of Object.entries(row.expect) as [Who, number][]) {
      it(`${row.route} · ${who} → ${expected}`, async () => {
        const s = await scene();       // un monde neuf par cas : une écriture réussie ne fausse pas le suivant
        try {
          const actor = actorFor(s, who);
          const req = await row.request(s, actor, who);
          const before = s.w.snapshot();
          const reply = await s.w.call(req.path, { as: actor, method: method(row.route), body: req.body });
          assert.equal(reply.status, expected, `${row.route} en tant que ${who} : ${reply.raw}`);
          if (expected >= 400) {
            // Un refus ne suffit pas : il ne doit avoir modifié aucune donnée.
            assert.equal(s.w.snapshot(), before, `${row.route} refusé (${expected}) mais la base a changé`);
          }
        } finally { await s.w.close(); }
      });
    }
  }
});

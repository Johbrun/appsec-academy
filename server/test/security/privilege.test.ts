import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { registeredRoutes, scene, type Scene } from '../helpers.ts';

let s: Scene;
before(async () => { s = await scene(); });
after(() => s.w.close());

const roleOf = (id: number) => (s.w.db.prepare('SELECT role FROM users WHERE id = ?').get(id) as { role: string }).role;

describe('élévation de privilèges', () => {
  it('l’inscription ignore role, id et password_hash', async () => {
    const r = await s.w.call('/api/auth/signup', {
      body: { email: 'pirate@academy.test', name: 'Pirate', password: 'un mot de passe solide', role: 'teacher', id: 1, password_hash: 'x', is_admin: true },
    });
    assert.equal(r.status, 201);
    assert.equal(r.body.user.role, 'student');
    assert.notEqual(r.body.user.id, 1);
    const row = s.w.db.prepare('SELECT role, password_hash FROM users WHERE email = ?').get('pirate@academy.test') as { role: string; password_hash: string };
    assert.equal(row.role, 'student');
    assert.match(row.password_hash, /^\$argon2id\$/);
  });

  it('PATCH /api/me ne change ni le rôle, ni l’email, ni l’id, ni le hash', async () => {
    const before = s.w.db.prepare('SELECT id, email, role, password_hash FROM users WHERE id = ?').get(s.B.id);
    const r = await s.w.call('/api/me', { as: s.B, method: 'PATCH', body: { name: 'Nouveau nom', role: 'teacher', email: 'autre@academy.test', id: 1, password_hash: 'x' } });
    assert.equal(r.status, 200);
    assert.deepEqual(s.w.db.prepare('SELECT id, email, role, password_hash FROM users WHERE id = ?').get(s.B.id), before);
    assert.equal(roleOf(s.B.id), 'student');
  });

  it('un document de progression qui porte des champs de compte ne change pas le compte', async () => {
    const before = s.w.db.prepare('SELECT id, email, role, password_hash FROM users WHERE id = ?').get(s.B.id);
    await s.w.call('/api/progress', { as: s.B, method: 'PUT', body: { data: { version: 1, role: 'teacher', email: 'x@y.z', password_hash: 'x', id: 1 }, rev: 0 } });
    assert.deepEqual(s.w.db.prepare('SELECT id, email, role, password_hash FROM users WHERE id = ?').get(s.B.id), before);
    assert.equal((await s.w.call('/api/teacher/cohorts', { as: s.B })).status, 403);
  });

  it('un étudiant n’accède à aucune route /api/teacher', async () => {
    const teacherRoutes = registeredRoutes(s.w.app).filter((r) => r.path.startsWith('/api/teacher/'));
    assert.ok(teacherRoutes.length >= 7);
    for (const { method, path } of teacherRoutes) {
      const url = path.replace(':id', String(s.cohort.id)).replace(':uid', String(s.A.id));
      for (const student of [s.A, s.B]) {
        const r = await s.w.call(url, { as: student, method, body: method === 'GET' ? undefined : { name: 'x' } });
        assert.equal(r.status, 403, `${method} ${url}`);
      }
    }
  });

  it('le middleware ferme tout /api/teacher aux étudiants, même là où aucun handler ne répond', async () => {
    for (const student of [s.A, s.B]) {
      assert.equal((await s.w.call('/api/teacher/inconnu', { as: student })).status, 403);
    }
    assert.equal((await s.w.call('/api/teacher/inconnu')).status, 401);
    assert.equal((await s.w.call('/api/teacher/inconnu', { as: s.T1 })).status, 404);
  });

  it('rejoindre une promo ne donne aucun droit sur elle', async () => {
    const t = await s.w.user('teacher');
    const c = s.w.cohort(t);
    const student = await s.w.user();
    assert.equal((await s.w.call('/api/cohorts/join', { as: student, body: { code: c.code } })).status, 200);
    assert.equal((await s.w.call(`/api/teacher/cohorts/${c.id}`, { as: student })).status, 403);
    assert.equal((await s.w.call(`/api/teacher/cohorts/${c.id}/students/${student.id}`, { as: student })).status, 403);
    assert.equal(roleOf(student.id), 'student');
  });

  it('un enseignant ne rejoint pas une promo : il ne s’y retrouverait pas observé', async () => {
    const r = await s.w.call('/api/cohorts/join', { as: s.T2, body: { code: s.cohort.code } });
    assert.equal(r.status, 403);
  });

  it('un enseignant rétrogradé perd l’accès dès la requête suivante, session existante comprise', async () => {
    const t = await s.w.user('teacher');
    assert.equal((await s.w.call('/api/teacher/cohorts', { as: t })).status, 200);
    s.w.db.prepare("UPDATE users SET role = 'student' WHERE id = ?").run(t.id);   // ce que fait `npm run user -- set-role`
    assert.equal((await s.w.call('/api/teacher/cohorts', { as: t })).status, 403);
    assert.equal((await s.w.call('/api/me', { as: t })).body.user.role, 'student');
  });

  it('un membre devenu enseignant n’est plus à la merci de l’ancien propriétaire de sa promo', async () => {
    const owner = await s.w.user('teacher');
    const c = s.w.cohort(owner);
    const promoted = await s.w.user();
    s.w.join(promoted, c.id);
    s.w.db.prepare("UPDATE users SET role = 'teacher' WHERE id = ?").run(promoted.id);

    const before = s.w.snapshot();
    const r = await s.w.call(`/api/teacher/cohorts/${c.id}/students/${promoted.id}/reset-link`, { as: owner, method: 'POST' });
    assert.equal(r.status, 404, 'pas de lien de réinitialisation sur un compte enseignant');
    assert.equal(s.w.snapshot(), before);
  });

  it('seule la CLI promeut : aucune route ne change un rôle', () => {
    for (const { method, path } of registeredRoutes(s.w.app)) {
      assert.ok(!/role|admin|promote/i.test(path), `${method} ${path}`);
    }
  });
});

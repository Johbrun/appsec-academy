import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createResetToken } from '../../lib/reset.ts';
import { scene, type Scene } from '../helpers.ts';

let s: Scene;
before(async () => { s = await scene(); });
after(() => s.w.close());

describe('compte', () => {
  it('PATCH /api/me change le nom affiché', async () => {
    const r = await s.w.call('/api/me', { as: s.A, method: 'PATCH', body: { name: '  Ada Lovelace  ' } });
    assert.equal(r.status, 200);
    assert.equal(r.body.user.name, 'Ada Lovelace');
    assert.equal((await s.w.call('/api/me', { as: s.A })).body.user.name, 'Ada Lovelace');
  });

  it('GET /api/me liste les promos rejointes, avec le nom de l’enseignant', async () => {
    const r = await s.w.call('/api/me', { as: s.A });
    assert.equal(r.body.cohorts.length, 1);
    assert.equal(r.body.cohorts[0].id, s.cohort.id);
    assert.equal(r.body.cohorts[0].teacher, s.T1.name);
  });

  it('l’export RGPD contient le compte, la progression et les promos, sans hash ni jeton', async () => {
    const student = await s.w.user();
    s.w.join(student, s.cohort.id);
    await s.w.call('/api/progress', { as: student, method: 'PUT', body: { data: { version: 1, xp: 5 }, rev: 0 } });
    createResetToken(s.w.db, student.id, s.w.now(), 1000);

    const r = await s.w.call('/api/me/export', { as: student });
    assert.equal(r.status, 200);
    assert.equal(r.body.user.email, student.email);
    assert.equal(r.body.progress.data.xp, 5);
    assert.equal(r.body.cohorts[0].id, s.cohort.id);

    const tokenHashes = (s.w.db.prepare('SELECT token_hash FROM sessions UNION SELECT token_hash FROM reset_tokens').all() as { token_hash: string }[]).map((x) => x.token_hash);
    assert.ok(tokenHashes.length > 0);
    assert.ok(!/password|argon2/i.test(r.raw), 'aucun hash de mot de passe dans l’export');
    for (const h of tokenHashes) assert.ok(!r.raw.includes(h), 'aucun hash de jeton dans l’export');
    assert.ok(!('code' in (r.body.cohorts[0] ?? {})), 'un étudiant ne reçoit pas le code de la promo');
  });

  it('la suppression du compte efface tout, en cascade', async () => {
    const teacher = await s.w.user('teacher');
    const cohort = s.w.cohort(teacher);
    const student = await s.w.user();
    s.w.join(student, cohort.id);
    await s.w.call('/api/progress', { as: student, method: 'PUT', body: { data: { version: 1 }, rev: 0 } });
    createResetToken(s.w.db, student.id, s.w.now(), 1000);

    const wrong = await s.w.call('/api/me', { as: student, method: 'DELETE', body: { password: 'pas le bon mot de passe' } });
    assert.equal(wrong.status, 403);
    assert.equal((await s.w.call('/api/me', { as: student })).status, 200);

    const del = await s.w.call('/api/me', { as: student, method: 'DELETE', body: { password: student.password } });
    assert.equal(del.status, 200);
    const count = (sql: string, id: number) => (s.w.db.prepare(sql).get(id) as { n: number }).n;
    assert.equal(count('SELECT COUNT(*) n FROM users WHERE id = ?', student.id), 0);
    assert.equal(count('SELECT COUNT(*) n FROM sessions WHERE user_id = ?', student.id), 0);
    assert.equal(count('SELECT COUNT(*) n FROM progress WHERE user_id = ?', student.id), 0);
    assert.equal(count('SELECT COUNT(*) n FROM cohort_members WHERE user_id = ?', student.id), 0);
    assert.equal(count('SELECT COUNT(*) n FROM reset_tokens WHERE user_id = ?', student.id), 0);

    // Supprimer un enseignant emporte ses promos et leurs appartenances, sans toucher les étudiants.
    const delTeacher = await s.w.call('/api/me', { as: teacher, method: 'DELETE', body: { password: teacher.password } });
    assert.equal(delTeacher.status, 200);
    assert.equal(count('SELECT COUNT(*) n FROM cohorts WHERE owner_id = ?', teacher.id), 0);
    assert.equal(count('SELECT COUNT(*) n FROM cohort_members WHERE cohort_id = ?', cohort.id), 0);
  });
});

import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { scene, type Scene } from '../helpers.ts';

let s: Scene;
before(async () => { s = await scene(); });
after(() => s.w.close());

describe('promos', () => {
  it('l’enseignant crée une promo, l’étudiant la rejoint avec le code', async () => {
    const created = await s.w.call('/api/teacher/cohorts', { as: s.T1, body: { name: 'M2 Cyber 2026' } });
    assert.equal(created.status, 201);
    const { id, code } = created.body.cohort;
    assert.match(code, /^[A-HJKMNP-Z2-9]{8}$/);

    const student = await s.w.user();
    const joined = await s.w.call('/api/cohorts/join', { as: student, body: { code } });
    assert.equal(joined.status, 200);
    assert.equal(joined.body.cohort.id, id);
    assert.equal(joined.body.joined, true);

    // Le code se tape à la main : casse, espaces et tirets sont tolérés. Rejoindre deux fois ne duplique rien.
    const sloppy = `${code.slice(0, 4).toLowerCase()} - ${code.slice(4)}`;
    const again = await s.w.call('/api/cohorts/join', { as: student, body: { code: sloppy } });
    assert.equal(again.status, 200);
    assert.equal(again.body.joined, false);
    assert.equal((s.w.db.prepare('SELECT COUNT(*) n FROM cohort_members WHERE cohort_id = ?').get(id) as { n: number }).n, 1);
  });

  it('un code inconnu ou mal formé est refusé', async () => {
    const student = await s.w.user();
    for (const code of ['ABCDEFGH', 'nope', '', '00000000']) {
      assert.equal((await s.w.call('/api/cohorts/join', { as: student, body: { code } })).status, 404, `code « ${code} »`);
    }
  });

  it('l’enseignant voit ses étudiants et leur résumé', async () => {
    await s.w.call('/api/progress', {
      as: s.A, method: 'PUT',
      body: { data: { version: 1, xp: 340, lessons: { a: 'd', b: 'd', c: 'd' }, modules: ['m01'], labs: ['x'], badges: ['first-lesson'], scores: { 'spot-the-sink': 80, 'spot-the-sink:decouverte': 80, 'spot-the-sink:expert': 55, 'exam-a': 75 } }, rev: 0 },
    });
    const list = await s.w.call('/api/teacher/cohorts', { as: s.T1 });
    assert.equal(list.body.cohorts.find((c: { id: number }) => c.id === s.cohort.id).members, 1);

    const r = await s.w.call(`/api/teacher/cohorts/${s.cohort.id}`, { as: s.T1 });
    assert.equal(r.status, 200);
    assert.equal(r.body.cohort.code, s.cohort.code);
    assert.equal(r.body.members.length, 1);
    const m = r.body.members[0];
    assert.equal(m.id, s.A.id);
    assert.equal(m.email, s.A.email);
    assert.deepEqual(m.summary, { xp: 340, lessons: 3, modules: 1, labs: 1, badges: 1, games: 1, exams: { 'exam-a': 75 } });
    assert.ok(m.lastActive > 0);
  });

  it('un étudiant sans progression a un résumé à zéro', async () => {
    const t = await s.w.user('teacher');
    const c = s.w.cohort(t);
    const student = await s.w.user();
    s.w.join(student, c.id);
    const r = await s.w.call(`/api/teacher/cohorts/${c.id}`, { as: t });
    assert.deepEqual(r.body.members[0].summary, { xp: 0, lessons: 0, modules: 0, labs: 0, badges: 0, games: 0, exams: {} });
    assert.equal(r.body.members[0].lastActive, null);
  });

  it('la vue détaillée renvoie la progression complète', async () => {
    const r = await s.w.call(`/api/teacher/cohorts/${s.cohort.id}/students/${s.A.id}`, { as: s.T1 });
    assert.equal(r.status, 200);
    assert.equal(r.body.student.email, s.A.email);
    assert.equal(r.body.progress.data.xp, 340);
    assert.ok(!/password|argon2/i.test(r.raw));
  });

  it('l’enseignant retire un étudiant, l’étudiant quitte une promo', async () => {
    const t = await s.w.user('teacher');
    const c = s.w.cohort(t);
    const gone = await s.w.user();
    const leaving = await s.w.user();
    s.w.join(gone, c.id);
    s.w.join(leaving, c.id);

    assert.equal((await s.w.call(`/api/teacher/cohorts/${c.id}/students/${gone.id}`, { as: t, method: 'DELETE' })).status, 200);
    assert.equal((await s.w.call(`/api/cohorts/${c.id}/membership`, { as: leaving, method: 'DELETE' })).status, 200);
    assert.equal((await s.w.call(`/api/teacher/cohorts/${c.id}`, { as: t })).body.members.length, 0);
    // Les comptes existent toujours.
    assert.equal((await s.w.call('/api/me', { as: gone })).status, 200);
  });

  it('régénérer le code invalide l’ancien', async () => {
    const t = await s.w.user('teacher');
    const c = s.w.cohort(t);
    const regen = await s.w.call(`/api/teacher/cohorts/${c.id}/code`, { as: t, body: {} });
    assert.equal(regen.status, 200);
    assert.notEqual(regen.body.cohort.code, c.code);

    const student = await s.w.user();
    assert.equal((await s.w.call('/api/cohorts/join', { as: student, body: { code: c.code } })).status, 404);
    assert.equal((await s.w.call('/api/cohorts/join', { as: student, body: { code: regen.body.cohort.code } })).status, 200);
  });

  it('le lien de réinitialisation d’un étudiant fonctionne une fois', async () => {
    const student = await s.w.user();
    s.w.join(student, s.cohort.id);
    const r = await s.w.call(`/api/teacher/cohorts/${s.cohort.id}/students/${student.id}/reset-link`, { as: s.T1, body: {} });
    assert.equal(r.status, 200);
    assert.match(r.body.link, /^https:\/\/academy\.test\/#\/reinitialiser\?token=[A-Za-z0-9_-]{43}$/);

    const next = 'nouveau mot de passe étudiant';
    assert.equal((await s.w.call('/api/auth/reset', { body: { token: r.body.token, password: next } })).status, 200);
    assert.equal((await s.w.call('/api/auth/login', { body: { email: student.email, password: next } })).status, 200);
    assert.equal((await s.w.call('/api/auth/reset', { body: { token: r.body.token, password: next } })).status, 400);
  });
});

import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { scene, type Scene } from '../helpers.ts';

let s: Scene;
before(async () => { s = await scene(); });
after(() => s.w.close());

const progressOf = (id: number) => s.w.db.prepare('SELECT data, rev FROM progress WHERE user_id = ?').get(id) as { data: string; rev: number } | undefined;

describe('IDOR : accès à la ressource d’un autre', () => {
  it('un enseignant ne lit, ne modifie ni ne régénère la promo d’un autre', async () => {
    const codeBefore = (s.w.db.prepare('SELECT code FROM cohorts WHERE id = ?').get(s.cohort.id) as { code: string }).code;
    const before = s.w.snapshot();
    const id = s.cohort.id;
    for (const [method, path] of [
      ['GET', `/api/teacher/cohorts/${id}`],
      ['POST', `/api/teacher/cohorts/${id}/code`],
      ['GET', `/api/teacher/cohorts/${id}/students/${s.A.id}`],
      ['POST', `/api/teacher/cohorts/${id}/students/${s.A.id}/reset-link`],
      ['DELETE', `/api/teacher/cohorts/${id}/students/${s.A.id}`],
    ] as const) {
      const r = await s.w.call(path, { as: s.T2, method });
      assert.equal(r.status, 404, `${method} ${path}`);
    }
    assert.equal(s.w.snapshot(), before);
    assert.equal((s.w.db.prepare('SELECT code FROM cohorts WHERE id = ?').get(id) as { code: string }).code, codeBefore);
  });

  it('le propriétaire ne touche pas un étudiant qui n’est pas membre de sa promo', async () => {
    const before = s.w.snapshot();
    for (const [method, suffix] of [['GET', ''], ['POST', '/reset-link'], ['DELETE', '']] as const) {
      const r = await s.w.call(`/api/teacher/cohorts/${s.cohort.id}/students/${s.B.id}${suffix}`, { as: s.T1, method });
      assert.equal(r.status, 404, `${method} ${suffix}`);
    }
    assert.equal(s.w.snapshot(), before);
  });

  it('un étudiant inscrit chez un autre enseignant est inatteignable depuis ma promo', async () => {
    // B est membre de la promo de T2. T1 le vise avec SA promo : l'appartenance doit être liée à la bonne promo.
    const before = s.w.snapshot();
    for (const [method, suffix] of [['GET', ''], ['POST', '/reset-link'], ['DELETE', '']] as const) {
      const r = await s.w.call(`/api/teacher/cohorts/${s.cohort.id}/students/${s.B.id}${suffix}`, { as: s.T1, method });
      assert.equal(r.status, 404, `${method} ${suffix}`);
    }
    // Et inversement : la promo de T2 ne m'appartient pas.
    for (const path of [`/api/teacher/cohorts/${s.cohort2.id}`, `/api/teacher/cohorts/${s.cohort2.id}/students/${s.B.id}`]) {
      assert.equal((await s.w.call(path, { as: s.T1 })).status, 404, path);
    }
    assert.equal(s.w.snapshot(), before);
    assert.equal((s.w.db.prepare('SELECT COUNT(*) n FROM cohort_members WHERE cohort_id = ? AND user_id = ?').get(s.cohort2.id, s.B.id) as { n: number }).n, 1);
  });

  it('contrôle positif : T2 accède bien à son propre étudiant, sinon les 404 ci-dessus ne prouvent rien', async () => {
    assert.equal((await s.w.call(`/api/teacher/cohorts/${s.cohort2.id}`, { as: s.T2 })).status, 200);
    assert.equal((await s.w.call(`/api/teacher/cohorts/${s.cohort2.id}/students/${s.B.id}`, { as: s.T2 })).status, 200);
    assert.equal((await s.w.call(`/api/teacher/cohorts/${s.cohort.id}/students/${s.A.id}`, { as: s.T1 })).status, 200);
  });

  it('un id inexistant et un id interdit donnent exactement la même réponse', async () => {
    const forbidden = await s.w.call(`/api/teacher/cohorts/${s.cohort.id}`, { as: s.T2 });
    const missing = await s.w.call('/api/teacher/cohorts/999999', { as: s.T2 });
    assert.equal(forbidden.status, missing.status);
    assert.equal(forbidden.raw, missing.raw);

    const forbiddenStudent = await s.w.call(`/api/teacher/cohorts/${s.cohort.id}/students/${s.B.id}`, { as: s.T1 });
    const missingStudent = await s.w.call(`/api/teacher/cohorts/${s.cohort.id}/students/999999`, { as: s.T1 });
    assert.equal(forbiddenStudent.status, missingStudent.status);
    assert.equal(forbiddenStudent.raw, missingStudent.raw);
  });

  it('les identifiants qui ne sont pas de simples nombres sont refusés', async () => {
    for (const bad of ['1e3', '-1', '0', '0x1', '01', '1.0', '1%20OR%201=1', '1;DROP%20TABLE%20users', '..%2F1', '%00', 'NaN', '99999999999999999999']) {
      const r = await s.w.call(`/api/teacher/cohorts/${bad}`, { as: s.T1 });
      assert.equal(r.status, 404, `id « ${bad} »`);
    }
    assert.equal((s.w.db.prepare('SELECT COUNT(*) n FROM users').get() as { n: number }).n, 4);
  });

  it('un étudiant ne lit ni n’écrit la progression d’un autre : l’identité vient de la session seule', async () => {
    const a = await s.w.user();
    const b = await s.w.user();
    await s.w.call('/api/progress', { as: a, method: 'PUT', body: { data: { version: 1, xp: 500 }, rev: 0 } });
    const aBefore = progressOf(a.id);

    // B tente de désigner A par tous les moyens : requête, corps, en-têtes.
    const read = await s.w.call(`/api/progress?userId=${a.id}&user_id=${a.id}&id=${a.id}`, { as: b, headers: { 'X-User-Id': String(a.id) } });
    assert.deepEqual(read.body, { data: null, rev: 0 });

    const write = await s.w.call(`/api/progress?userId=${a.id}`, {
      as: b, method: 'PUT', headers: { 'X-User-Id': String(a.id) },
      body: { userId: a.id, user_id: a.id, id: a.id, data: { version: 1, xp: 1, userId: a.id }, rev: 0 },
    });
    assert.equal(write.status, 200);
    assert.deepEqual(progressOf(a.id), aBefore, 'la progression de A est intacte');
    assert.equal(JSON.parse(progressOf(b.id)!.data).xp, 1, 'l’écriture a atterri chez B');

    assert.equal((await s.w.call(`/api/progress?userId=${a.id}`, { as: b, method: 'DELETE', body: { userId: a.id } })).status, 200);
    assert.ok(progressOf(a.id), 'la suppression n’a pas touché A');
    assert.equal(progressOf(b.id), undefined);
  });

  it('un étudiant ne peut pas quitter une promo à la place d’un autre', async () => {
    const before = s.w.snapshot();
    const r = await s.w.call(`/api/cohorts/${s.cohort.id}/membership`, { as: s.B, method: 'DELETE', body: { userId: s.A.id, user_id: s.A.id } });
    assert.equal(r.status, 404);
    assert.equal(s.w.snapshot(), before);
    assert.equal((s.w.db.prepare('SELECT COUNT(*) n FROM cohort_members WHERE user_id = ?').get(s.A.id) as { n: number }).n, 1);
  });

  it('les données des autres comptes n’apparaissent jamais dans les réponses de /api/me', async () => {
    const r = await s.w.call('/api/me', { as: s.B });
    assert.ok(!r.raw.includes(s.A.email));
    assert.ok(!r.raw.includes(s.cohort.code), 'le code d’une promo n’est pas donné à un non-membre');
    const exported = await s.w.call('/api/me/export', { as: s.A });
    assert.ok(!exported.raw.includes(s.B.email));
    assert.ok(!exported.raw.includes(s.cohort.code), 'l’export d’un étudiant ne contient pas le code de sa promo');
  });
});

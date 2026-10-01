import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createResetToken } from '../../lib/reset.ts';
import { PASSWORD, scene, startWorld } from '../helpers.ts';

const DAY = 24 * 60 * 60 * 1000;

describe('connexion', () => {
  it('email inconnu et mauvais mot de passe : même statut, même message', async () => {
    const w = await startWorld();
    try {
      const u = await w.user();
      const wrongPassword = await w.call('/api/auth/login', { body: { email: u.email, password: 'pas le bon mot de passe' } });
      const unknownEmail = await w.call('/api/auth/login', { body: { email: 'inconnu@academy.test', password: 'pas le bon mot de passe' } });
      assert.equal(wrongPassword.status, 401);
      assert.equal(unknownEmail.status, 401);
      assert.equal(wrongPassword.raw, unknownEmail.raw);
      assert.deepEqual(wrongPassword.headers.getSetCookie(), []);
    } finally { await w.close(); }
  });

  it('pas de verrouillage par email : des échecs répétés ne bloquent pas le propriétaire du compte', async () => {
    const w = await startWorld();
    try {
      const u = await w.user();
      // Moins que la limite par IP (8 en test) : seul un blocage par email pourrait refuser la suite.
      for (let i = 1; i <= 6; i++) {
        assert.equal((await w.call('/api/auth/login', { body: { email: u.email, password: `mauvais ${i}` } })).status, 401, `essai ${i}`);
      }
      assert.equal((await w.call('/api/auth/login', { body: { email: u.email, password: PASSWORD } })).status, 200);
    } finally { await w.close(); }
  });

  it('limite par IP : un X-Forwarded-For forgé ne la contourne pas quand aucun proxy n’est de confiance', async () => {
    const w = await startWorld({ trustProxy: 0 });
    try {
      const statuses: number[] = [];
      for (let i = 1; i <= 10; i++) {
        const r = await w.call('/api/auth/login', { headers: { 'X-Forwarded-For': `203.0.113.${i}` }, body: { email: `inconnu${i}@academy.test`, password: 'mauvais mot de passe' } });
        statuses.push(r.status);
      }
      assert.deepEqual(statuses.slice(0, 8), Array(8).fill(401));
      assert.deepEqual(statuses.slice(8), [429, 429]);
    } finally { await w.close(); }
  });

  it('derrière un proxy de confiance, la limite suit l’IP transmise (et seulement celle-là)', async () => {
    const w = await startWorld({ trustProxy: 1 });
    try {
      for (let i = 1; i <= 10; i++) {
        const r = await w.call('/api/auth/login', { headers: { 'X-Forwarded-For': `203.0.113.${i}` }, body: { email: `inconnu${i}@academy.test`, password: 'mauvais mot de passe' } });
        assert.equal(r.status, 401, `IP ${i}`);
      }
      for (let i = 1; i <= 8; i++) {
        await w.call('/api/auth/login', { headers: { 'X-Forwarded-For': '198.51.100.7' }, body: { email: `x${i}@academy.test`, password: 'mauvais mot de passe' } });
      }
      const blocked = await w.call('/api/auth/login', { headers: { 'X-Forwarded-For': '198.51.100.7' }, body: { email: 'y@academy.test', password: 'mauvais mot de passe' } });
      assert.equal(blocked.status, 429);
    } finally { await w.close(); }
  });

  it('une connexion réussie ne consomme pas la limite', async () => {
    const w = await startWorld();
    try {
      const u = await w.user();
      for (let i = 0; i < 12; i++) assert.equal((await w.call('/api/auth/login', { body: { email: u.email, password: PASSWORD } })).status, 200);
    } finally { await w.close(); }
  });
});

describe('réinitialisation du mot de passe', () => {
  it('le jeton est à usage unique', async () => {
    const w = await startWorld();
    try {
      const u = await w.user();
      const token = createResetToken(w.db, u.id, w.now(), w.config.resetTtlMs);
      assert.equal((await w.call('/api/auth/reset', { body: { token, password: 'premier nouveau mot de passe' } })).status, 200);
      assert.equal((await w.call('/api/auth/reset', { body: { token, password: 'second nouveau mot de passe' } })).status, 400);
      assert.equal((await w.call('/api/auth/login', { body: { email: u.email, password: 'premier nouveau mot de passe' } })).status, 200);
    } finally { await w.close(); }
  });

  it('le jeton expire au bout de 24 h', async () => {
    const w = await startWorld();
    try {
      const u = await w.user();
      const token = createResetToken(w.db, u.id, w.now(), w.config.resetTtlMs);
      w.advance(DAY - 1000);
      const still = await w.call('/api/auth/reset', { body: { token, password: 'un mot de passe solide' } });
      assert.equal(still.status, 200);

      const late = createResetToken(w.db, u.id, w.now(), w.config.resetTtlMs);
      w.advance(DAY + 1000);
      assert.equal((await w.call('/api/auth/reset', { body: { token: late, password: 'un mot de passe solide' } })).status, 400);
    } finally { await w.close(); }
  });

  it('le jeton d’un utilisateur ne change que le mot de passe de cet utilisateur', async () => {
    const w = await startWorld();
    try {
      const a = await w.user();
      const b = await w.user();
      const token = createResetToken(w.db, a.id, w.now(), w.config.resetTtlMs);
      await w.call('/api/auth/reset', { body: { token, password: 'nouveau mot de passe de A', email: b.email, userId: b.id } });
      assert.equal((await w.call('/api/auth/login', { body: { email: b.email, password: PASSWORD } })).status, 200, 'B n’est pas touché');
      assert.equal((await w.call('/api/auth/login', { body: { email: a.email, password: 'nouveau mot de passe de A' } })).status, 200);
    } finally { await w.close(); }
  });

  it('un nouveau lien invalide le précédent', async () => {
    const w = await startWorld();
    try {
      const u = await w.user();
      const first = createResetToken(w.db, u.id, w.now(), w.config.resetTtlMs);
      const second = createResetToken(w.db, u.id, w.now(), w.config.resetTtlMs);
      assert.equal((await w.call('/api/auth/reset', { body: { token: first, password: 'un mot de passe solide' } })).status, 400);
      assert.equal((await w.call('/api/auth/reset', { body: { token: second, password: 'un mot de passe solide' } })).status, 200);
    } finally { await w.close(); }
  });

  it('les jetons inventés ou mal formés sont refusés, et les essais sont limités', async () => {
    const w = await startWorld();
    try {
      const statuses: number[] = [];
      for (const token of ['A'.repeat(43), 'court', '', "' OR 1=1 --", 42, null, ['x'], { a: 1 }, 'B'.repeat(43), 'C'.repeat(43)]) {
        statuses.push((await w.call('/api/auth/reset', { body: { token, password: 'un mot de passe solide' } })).status);
      }
      assert.deepEqual(statuses.slice(0, 6), Array(6).fill(400));
      assert.ok(statuses.slice(6).every((s) => s === 429), 'au-delà de 6 échecs, 429');
    } finally { await w.close(); }
  });

  it('un étudiant ne peut pas se fabriquer un lien : seule la route enseignant en émet', async () => {
    const s = await scene();
    try {
      const before = s.w.snapshot();
      const r = await s.w.call(`/api/teacher/cohorts/${s.cohort.id}/students/${s.A.id}/reset-link`, { as: s.A, method: 'POST' });
      assert.equal(r.status, 403);
      assert.equal(s.w.snapshot(), before);
    } finally { await s.w.close(); }
  });
});

describe('validation des mots de passe et des types', () => {
  it('trop court ou trop long : 400', async () => {
    const w = await startWorld();
    try {
      const base = { email: 'a@academy.test', name: 'A' };
      assert.equal((await w.call('/api/auth/signup', { body: { ...base, password: 'x'.repeat(9) } })).status, 400);
      assert.equal((await w.call('/api/auth/signup', { body: { ...base, password: 'x'.repeat(129) } })).status, 400);
      assert.equal((await w.call('/api/auth/signup', { body: { ...base, password: 'x'.repeat(10) } })).status, 201);
      assert.equal((await w.call('/api/auth/signup', { body: { ...base, email: 'b@academy.test', password: 'x'.repeat(128) } })).status, 201);
      assert.equal((await w.call('/api/auth/login', { body: { email: 'a@academy.test', password: 'x'.repeat(5000) } })).status, 400);
    } finally { await w.close(); }
  });

  it('les types inattendus (opérateurs NoSQL, tableaux, nombres, null) donnent 400, jamais 500', async () => {
    const s = await scene();
    try {
      const weird: unknown[] = [{ $ne: null }, { $gt: '' }, ['a@academy.test'], 42, true, null, { toString: 'x' }, { __proto__: { admin: true } }, '\u0000'];
      const attempts: [string, (v: unknown) => unknown, import('../helpers.ts').Actor | null][] = [
        ['/api/auth/login', (v) => ({ email: v, password: v }), null],
        ['/api/auth/login', (v) => ({ email: 'a@academy.test', password: v }), null],
        ['/api/auth/signup', (v) => ({ email: v, name: v, password: v }), null],
        ['/api/auth/reset', (v) => ({ token: v, password: v }), null],
        ['/api/cohorts/join', (v) => ({ code: v }), s.B],
        ['/api/me', (v) => ({ name: v }), s.B],
        ['/api/me/password', (v) => ({ current: v, next: v }), s.B],
        ['/api/progress', (v) => ({ data: v, rev: v }), s.B],
        ['/api/teacher/cohorts', (v) => ({ name: v }), s.T1],
      ];
      for (const [path, make, as] of attempts) {
        const method = path === '/api/me' ? 'PATCH' : path === '/api/progress' ? 'PUT' : 'POST';
        for (const v of weird) {
          const r = await s.w.call(path, { as, method, body: make(v) });
          assert.ok(r.status >= 400 && r.status < 500, `${method} ${path} avec ${JSON.stringify(v)} → ${r.status}`);
        }
      }
      // Les corps qui ne sont pas des objets.
      for (const raw of ['[]', '"texte"', '42', 'null', 'true']) {
        const r = await s.w.call('/api/auth/login', { rawBody: raw });
        assert.ok(r.status >= 400 && r.status < 500, `corps ${raw} → ${r.status}`);
      }
    } finally { await s.w.close(); }
  });
});

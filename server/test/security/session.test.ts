import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sha256 } from '../../lib/tokens.ts';
import { scene, startWorld, type Actor } from '../helpers.ts';

const DAY = 24 * 60 * 60 * 1000;
const tokenOf = (a: Actor) => a.cookie!.split('=')[1];

describe('cookie de session', () => {
  it('HttpOnly, SameSite=Lax, Path=/, sans Domain', async () => {
    const w = await startWorld();
    try {
      const u = await w.user();
      const r = await w.login(u);
      const cookie = r.headers.getSetCookie()[0];
      assert.equal(r.headers.getSetCookie().length, 1, 'un seul cookie posé');
      assert.match(cookie, /^appsec_sid=[A-Za-z0-9_-]{43};/);
      assert.match(cookie, /HttpOnly/i);
      assert.match(cookie, /SameSite=Lax/i);
      assert.match(cookie, /Path=\//i);
      assert.doesNotMatch(cookie, /Domain=/i);
      assert.match(cookie, /Max-Age=\d+/i);
      assert.doesNotMatch(cookie, /Secure/i, 'pas de Secure en développement (http)');
    } finally { await w.close(); }
  });

  it('en production : Secure et préfixe __Host-', async () => {
    const w = await startWorld({ secureCookies: true, cookieName: '__Host-appsec_sid' });
    try {
      const u = await w.user();
      const cookie = (await w.login(u)).headers.getSetCookie()[0];
      assert.match(cookie, /^__Host-appsec_sid=/);
      assert.match(cookie, /; Secure/i);
      assert.match(cookie, /HttpOnly/i);
      assert.match(cookie, /Path=\//i);
      assert.doesNotMatch(cookie, /Domain=/i);   // le préfixe __Host- l'interdit
    } finally { await w.close(); }
  });

  it('la déconnexion efface le cookie', async () => {
    const w = await startWorld();
    try {
      const u = await w.user();
      const r = await w.call('/api/auth/logout', { as: u, body: {} });
      assert.match(r.headers.getSetCookie()[0], /Max-Age=0/i);
    } finally { await w.close(); }
  });
});

describe('jeton de session', () => {
  it('en base, seul le sha256 du jeton est stocké', async () => {
    const w = await startWorld();
    try {
      const u = await w.user();
      await w.login(u);
      const token = tokenOf(u);
      const hashes = (w.db.prepare('SELECT token_hash FROM sessions WHERE user_id = ?').all(u.id) as { token_hash: string }[]).map((r) => r.token_hash);
      assert.ok(hashes.includes(sha256(token)));
      const dump = JSON.stringify(['users', 'sessions', 'progress', 'cohorts', 'cohort_members', 'reset_tokens'].map((t) => w.db.prepare(`SELECT * FROM ${t}`).all()));
      assert.ok(!dump.includes(token), 'le jeton en clair n’apparaît nulle part dans la base');
    } finally { await w.close(); }
  });

  it('un jeton forgé, modifié ou mal formé est refusé', async () => {
    const w = await startWorld();
    try {
      const u = await w.user();
      const real = tokenOf(u);
      const flipped = real.slice(0, -1) + (real.endsWith('A') ? 'B' : 'A');
      for (const value of ['A'.repeat(43), flipped, real.slice(1), `${real}x`, '', 'admin', "' OR 1=1 --", '../etc/passwd']) {
        const r = await w.call('/api/me', { cookie: `appsec_sid=${value}` });
        assert.equal(r.status, 401, `jeton « ${value} »`);
      }
      assert.equal((await w.call('/api/me', { as: u })).status, 200, 'le vrai jeton fonctionne toujours');
    } finally { await w.close(); }
  });

  it('un jeton choisi par le client n’est jamais adopté à la connexion (pas de fixation de session)', async () => {
    const w = await startWorld();
    try {
      const u = await w.user();
      const chosen = 'F'.repeat(43);
      const r = await w.call('/api/auth/login', { cookie: `appsec_sid=${chosen}`, body: { email: u.email, password: u.password } });
      assert.equal(r.status, 200);
      const issued = r.headers.getSetCookie()[0].split(';')[0].split('=')[1];
      assert.notEqual(issued, chosen);
      assert.equal((await w.call('/api/me', { cookie: `appsec_sid=${chosen}` })).status, 401);
    } finally { await w.close(); }
  });

  it('se reconnecter avec une session ouverte révoque l’ancienne et en émet une nouvelle', async () => {
    const w = await startWorld();
    try {
      const u = await w.user();
      const old = u.cookie!;
      const r = await w.call('/api/auth/login', { as: u, body: { email: u.email, password: u.password } });
      assert.equal(r.status, 200);
      assert.notEqual(u.cookie, old);
      assert.equal((await w.call('/api/me', { cookie: old })).status, 401);
      assert.equal((await w.call('/api/me', { as: u })).status, 200);
    } finally { await w.close(); }
  });

  it('la déconnexion invalide le jeton côté serveur : le rejouer échoue', async () => {
    const w = await startWorld();
    try {
      const u = await w.user();
      const stolen = u.cookie!;
      await w.call('/api/auth/logout', { as: u, body: {} });
      assert.equal((await w.call('/api/me', { cookie: stolen })).status, 401);
    } finally { await w.close(); }
  });

  it('deux connexions distinctes donnent deux sessions distinctes, indépendantes', async () => {
    const w = await startWorld();
    try {
      const u = await w.user();
      const laptop: Actor = { ...u, cookie: undefined };
      const phone: Actor = { ...u, cookie: undefined };
      await w.login(laptop);
      await w.login(phone);
      assert.notEqual(laptop.cookie, phone.cookie);
      await w.call('/api/auth/logout', { as: laptop, body: {} });
      assert.equal((await w.call('/api/me', { as: phone })).status, 200);
    } finally { await w.close(); }
  });
});

describe('expiration', () => {
  it('l’inactivité expire la session (7 jours), l’activité la prolonge', async () => {
    const w = await startWorld();
    try {
      const u = await w.user();
      w.advance(6 * DAY);
      assert.equal((await w.call('/api/me', { as: u })).status, 200);   // glissante : repart de zéro
      w.advance(6 * DAY);
      assert.equal((await w.call('/api/me', { as: u })).status, 200);
      w.advance(7 * DAY + 1000);
      assert.equal((await w.call('/api/me', { as: u })).status, 401);
      // La session expirée est supprimée, pas seulement ignorée.
      assert.equal((w.db.prepare('SELECT COUNT(*) n FROM sessions WHERE user_id = ?').get(u.id) as { n: number }).n, 0);
    } finally { await w.close(); }
  });

  it('même active, une session meurt au bout de 30 jours', async () => {
    const w = await startWorld();
    try {
      const u = await w.user();
      for (const day of [6, 12, 18, 24]) {
        w.advance(6 * DAY);
        assert.equal((await w.call('/api/me', { as: u })).status, 200, `jour ${day}`);
      }
      w.advance(5 * DAY);   // jour 29 : encore valide, malgré des requêtes régulières
      assert.equal((await w.call('/api/me', { as: u })).status, 200, 'jour 29');
      w.advance(2 * DAY);   // jour 31 : la durée de vie absolue l'emporte sur l'activité
      assert.equal((await w.call('/api/me', { as: u })).status, 401, 'jour 31');
    } finally { await w.close(); }
  });
});

describe('révocation', () => {
  it('changer de mot de passe révoque les autres sessions, pas la courante', async () => {
    const w = await startWorld();
    try {
      const u = await w.user();
      const other: Actor = { ...u, cookie: undefined };
      await w.login(other);
      const r = await w.call('/api/me/password', { as: u, method: 'POST', body: { current: u.password, next: 'un autre mot de passe' } });
      assert.equal(r.status, 200);
      assert.equal((await w.call('/api/me', { as: u })).status, 200);
      assert.equal((await w.call('/api/me', { as: other })).status, 401);
    } finally { await w.close(); }
  });

  it('une réinitialisation de mot de passe révoque toutes les sessions', async () => {
    const s = await scene();
    try {
      const student = await s.w.user();
      s.w.join(student, s.cohort.id);
      const link = await s.w.call(`/api/teacher/cohorts/${s.cohort.id}/students/${student.id}/reset-link`, { as: s.T1, method: 'POST' });
      assert.equal((await s.w.call('/api/me', { as: student })).status, 200);
      assert.equal((await s.w.call('/api/auth/reset', { body: { token: link.body.token, password: 'un nouveau mot de passe' } })).status, 200);
      assert.equal((await s.w.call('/api/me', { as: student })).status, 401);
    } finally { await s.w.close(); }
  });
});

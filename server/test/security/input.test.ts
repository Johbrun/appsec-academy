import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { scene, type Reply, type Scene } from '../helpers.ts';

let s: Scene;
before(async () => { s = await scene(); });
after(() => s.w.close());

const seen: Reply[] = [];
const call: Scene['w']['call'] = async (route, opts) => { const r = await s.w.call(route, opts); seen.push(r); return r; };

describe('validation des entrées', () => {
  it('un corps de plus de 256 Ko : 413', async () => {
    const big = { data: { version: 1, bourrage: 'x'.repeat(300_000) }, rev: 0 };
    const before = s.w.snapshot();
    const r = await call('/api/progress', { as: s.B, method: 'PUT', body: big });
    assert.equal(r.status, 413);
    assert.equal(s.w.snapshot(), before);
  });

  it('un document proche de la limite passe', async () => {
    const r = await call('/api/progress', { as: s.B, method: 'PUT', body: { data: { version: 1, texte: 'x'.repeat(200_000) }, rev: 0 } });
    assert.equal(r.status, 200);
  });

  it('un JSON malformé : 400', async () => {
    for (const rawBody of ['{"data":', '{', '}{', "{'a':1}", '{"a":1,}', '\u0000']) {
      const r = await call('/api/me', { as: s.A, method: 'PATCH', rawBody });
      assert.equal(r.status, 400, rawBody);
    }
  });

  it('data sans version, ou qui n’est pas un objet : 400', async () => {
    const user = await s.w.user();
    for (const data of [{}, { xp: 1 }, { version: '1' }, { version: 1.5 }, { version: 0 }, { version: -1 }, [], 'texte', 42, null]) {
      const before = s.w.snapshot();
      const r = await call('/api/progress', { as: user, method: 'PUT', body: { data, rev: 0 } });
      assert.equal(r.status, 400, JSON.stringify(data));
      assert.equal(s.w.snapshot(), before);
    }
  });

  it('rev doit être un entier positif ou nul', async () => {
    const user = await s.w.user();
    for (const rev of [-1, 1.5, '0', null, undefined, 2 ** 60]) {
      const r = await call('/api/progress', { as: user, method: 'PUT', body: { data: { version: 1 }, rev } });
      assert.equal(r.status, 400, String(rev));
    }
  });

  it('les noms sont bornés : 80 caractères, jamais vides', async () => {
    assert.equal((await call('/api/me', { as: s.A, method: 'PATCH', body: { name: 'x'.repeat(81) } })).status, 400);
    assert.equal((await call('/api/me', { as: s.A, method: 'PATCH', body: { name: 'x'.repeat(80) } })).status, 200);
    assert.equal((await call('/api/me', { as: s.A, method: 'PATCH', body: { name: '' } })).status, 400);
    assert.equal((await call('/api/me', { as: s.A, method: 'PATCH', body: { name: '    ' } })).status, 400);
    assert.equal((await call('/api/teacher/cohorts', { as: s.T1, body: { name: 'x'.repeat(81) } })).status, 400);
    assert.equal((await call('/api/teacher/cohorts', { as: s.T1, body: { name: '  ' } })).status, 400);
    assert.equal((await call('/api/auth/signup', { body: { email: 'n@academy.test', name: 'x'.repeat(81), password: 'un mot de passe solide' } })).status, 400);
    assert.equal((await call('/api/auth/signup', { body: { email: `${'x'.repeat(250)}@a.co`, name: 'N', password: 'un mot de passe solide' } })).status, 400);
    assert.equal((await call('/api/auth/signup', { body: { email: 'pas-un-email', name: 'N', password: 'un mot de passe solide' } })).status, 400);
  });

  it('les caractères de contrôle et d’inversion bidirectionnelle sont refusés dans les noms et les emails', async () => {
    const before = s.w.snapshot();
    for (const name of ['a\u0000b', 'ligne1\nligne2', 'tab\tulation', 'retour\rchariot', 'rtl\u202Eevil', 'iso\u2066x', 'sep\u2028ligne', 'c1\u0085x', '\u007F']) {
      assert.equal((await call('/api/me', { as: s.A, method: 'PATCH', body: { name } })).status, 400, JSON.stringify(name));
      assert.equal((await call('/api/teacher/cohorts', { as: s.T1, body: { name } })).status, 400, JSON.stringify(name));
      assert.equal((await call('/api/auth/signup', { body: { email: 'c@academy.test', name, password: 'un mot de passe solide' } })).status, 400, JSON.stringify(name));
    }
    for (const email of ['a\u0000@academy.test', 'a\n@academy.test', 'a@academy.test\r\nBcc: x@y.z']) {
      assert.equal((await call('/api/auth/signup', { body: { email, name: 'N', password: 'un mot de passe solide' } })).status, 400, JSON.stringify(email));
    }
    assert.equal(s.w.snapshot(), before);
  });

  it('les accents, les emojis et les écritures non latines restent permis', async () => {
    for (const name of ['Éloïse Brûlé', 'Zoë 🦊', '李雷', 'Мария', "O'Brien-Smith"]) {
      const r = await call('/api/me', { as: s.A, method: 'PATCH', body: { name } });
      assert.equal(r.status, 200, name);
      assert.equal(r.body.user.name, name);
    }
  });

  it('du HTML ou du SQL dans un nom est stocké tel quel, sans effet', async () => {
    const payload = `<img src=x onerror=alert(1)>'; DROP TABLE users; --`;
    const r = await call('/api/me', { as: s.A, method: 'PATCH', body: { name: payload } });
    assert.equal(r.status, 200);
    assert.equal(r.body.user.name, payload);
    assert.equal((s.w.db.prepare('SELECT COUNT(*) n FROM users').get() as { n: number }).n >= 4, true);
    // La réponse est du JSON et non du HTML : le navigateur ne l'interprétera pas.
    assert.match(r.headers.get('content-type') ?? '', /^application\/json/);
    assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  });
});

describe('les erreurs ne divulguent rien', () => {
  it('une erreur interne renvoie un message générique, sans pile, chemin ni SQL', async () => {
    const t = await scene();
    try {
      t.w.db.close();   // la base disparaît : toute requête authentifiée échoue en interne
      const r = await t.w.call('/api/me', { as: t.A });
      seen.push(r);
      assert.equal(r.status, 500);
      assert.deepEqual(r.body, { error: 'Erreur interne' });
    } finally { await t.w.close().catch(() => {}); }
  });

  it('aucune réponse d’erreur observée dans ce fichier ne contient de pile, de chemin ni de SQL', () => {
    const errors = seen.filter((r) => r.status >= 400);
    assert.ok(errors.length >= 20, `${errors.length} erreurs observées`);
    for (const r of errors) {
      assert.doesNotMatch(r.raw, /\bat\s+\S+\s+\(.*:\d+:\d+\)/, 'pile d’appels');
      assert.doesNotMatch(r.raw, /node_modules|\/home\/|\/appsec\/|server\/|\.ts\b|\.js\b/, 'chemin de fichier');
      assert.doesNotMatch(r.raw, /SQLITE|SELECT |INSERT |UPDATE |DELETE FROM|better-sqlite3|no such table|syntax error/i, 'SQL');
      assert.doesNotMatch(r.raw, /Unexpected (token|end)|JSON\.parse|SyntaxError|TypeError|ReferenceError/i, 'message de bibliothèque');
      assert.ok(r.body && typeof r.body === 'object' && typeof r.body.error === 'string', 'forme { error }');
    }
  });
});

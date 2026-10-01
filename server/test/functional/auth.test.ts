import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createPasswords } from '../../lib/password.ts';
import { createResetToken } from '../../lib/reset.ts';
import { PASSWORD, startWorld, type Actor, type World } from '../helpers.ts';

let w: World;
before(async () => { w = await startWorld(); });
after(() => w.close());

const browser = (): Actor => ({ id: 0, email: '', name: '', role: 'student', password: '' });
let n = 0;
const fresh = () => ({ email: `etudiant${++n}@academy.test`, name: `Étudiant ${n}`, password: 'un mot de passe solide' });

describe('inscription, connexion, déconnexion', () => {
  it("l'inscription ouvre une session", async () => {
    const me = browser();
    const account = fresh();
    const signup = await w.call('/api/auth/signup', { as: me, body: account });
    assert.equal(signup.status, 201);
    assert.equal(signup.body.user.email, account.email);
    assert.equal(signup.body.user.role, 'student');

    const who = await w.call('/api/me', { as: me });
    assert.equal(who.status, 200);
    assert.equal(who.body.user.email, account.email);
    assert.deepEqual(who.body.cohorts, []);
  });

  it('la déconnexion ferme la session', async () => {
    const me = browser();
    await w.call('/api/auth/signup', { as: me, body: fresh() });
    const out = await w.call('/api/auth/logout', { as: me, body: {} });
    assert.equal(out.status, 200);
    assert.equal((await w.call('/api/me', { as: me })).status, 401);
  });

  it('on peut se reconnecter avec ses identifiants', async () => {
    const account = fresh();
    await w.call('/api/auth/signup', { as: browser(), body: account });
    const me = browser();
    const login = await w.call('/api/auth/login', { as: me, body: { email: account.email, password: account.password } });
    assert.equal(login.status, 200);
    assert.equal((await w.call('/api/me', { as: me })).status, 200);
  });

  it("l'email est insensible à la casse, à la connexion comme à l'inscription", async () => {
    const account = fresh();
    await w.call('/api/auth/signup', { as: browser(), body: account });
    const login = await w.call('/api/auth/login', { as: browser(), body: { email: account.email.toUpperCase(), password: account.password } });
    assert.equal(login.status, 200);
    const again = await w.call('/api/auth/signup', { body: { ...account, email: account.email.toUpperCase() } });
    assert.equal(again.status, 409);
  });
});

describe('mots de passe', () => {
  it('le hash stocké est de l’argon2id', async () => {
    const account = fresh();
    await w.call('/api/auth/signup', { body: account });
    const row = w.db.prepare('SELECT password_hash FROM users WHERE email = ?').get(account.email) as { password_hash: string };
    assert.match(row.password_hash, /^\$argon2id\$v=19\$m=\d+,t=\d+,p=\d+\$/);
    assert.ok(!row.password_hash.includes(account.password));
  });

  it('un hash aux paramètres plus faibles est recalculé à la connexion', async () => {
    const weak = createPasswords({ memoryCost: 512, timeCost: 1, parallelism: 1 });
    const user = await w.user('student');
    w.db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(await weak.hash(PASSWORD), user.id);
    const before = (w.db.prepare('SELECT password_hash FROM users WHERE id = ?').get(user.id) as { password_hash: string }).password_hash;
    assert.match(before, /m=512,/);

    assert.equal((await w.login(user)).status, 200);
    const after = (w.db.prepare('SELECT password_hash FROM users WHERE id = ?').get(user.id) as { password_hash: string }).password_hash;
    assert.match(after, /m=1024,/);
    // Le mot de passe, lui, n'a pas changé.
    assert.equal((await w.login(user)).status, 200);
  });

  it('le changement de mot de passe refuse l’ancien et accepte le nouveau', async () => {
    const account = fresh();
    const me = browser();
    await w.call('/api/auth/signup', { as: me, body: account });
    const next = 'un autre mot de passe';

    const wrong = await w.call('/api/me/password', { as: me, method: 'POST', body: { current: 'pas le bon mot de passe', next } });
    assert.equal(wrong.status, 403);

    const ok = await w.call('/api/me/password', { as: me, method: 'POST', body: { current: account.password, next } });
    assert.equal(ok.status, 200);
    assert.equal((await w.call('/api/auth/login', { body: { email: account.email, password: account.password } })).status, 401);
    assert.equal((await w.call('/api/auth/login', { body: { email: account.email, password: next } })).status, 200);
  });

  it('un lien de réinitialisation permet de choisir un nouveau mot de passe', async () => {
    const user = await w.user('student');
    const token = createResetToken(w.db, user.id, w.now(), w.config.resetTtlMs);
    const next = 'mot de passe tout neuf';

    const reset = await w.call('/api/auth/reset', { body: { token, password: next } });
    assert.equal(reset.status, 200);
    assert.equal((await w.call('/api/auth/login', { body: { email: user.email, password: PASSWORD } })).status, 401);
    assert.equal((await w.call('/api/auth/login', { body: { email: user.email, password: next } })).status, 200);
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { BOOTSTRAP_LOGIN, bootstrapTeacher } from '../../lib/bootstrap.ts';
import { createPasswords } from '../../lib/password.ts';
import { startWorld } from '../helpers.ts';

const tmpFile = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'appsec-boot-')), 'teacher-initial-password.txt');
const passwordOf = (content: string) => /mot de passe : (\S+)/.exec(content)![1]!;
const passwordIn = (file: string) => passwordOf(fs.readFileSync(file, 'utf8'));

describe('compte enseignant initial', () => {
  it('sans enseignant : crée « teacher », mot de passe dans un fichier privé, connexion possible', async () => {
    const w = await startWorld();
    try {
      const file = tmpFile();
      assert.equal(await bootstrapTeacher(w.db, createPasswords(w.config.argon), w.now(), file), true);

      assert.equal(fs.statSync(file).mode & 0o777, 0o600);
      const login = await w.call('/api/auth/login', { body: { email: BOOTSTRAP_LOGIN, password: passwordIn(file) } });
      assert.equal(login.status, 200);
      assert.equal(login.body.user.role, 'teacher');
      assert.equal((await w.call('/api/teacher/cohorts', { cookie: login.headers.getSetCookie()[0]!.split(';')[0]! })).status, 200);
    } finally { await w.close(); }
  });

  it('le mot de passe n’est stocké qu’en argon2id et diffère à chaque installation', async () => {
    const [a, b] = [await startWorld(), await startWorld()];
    try {
      const [fa, fb] = [tmpFile(), tmpFile()];
      await bootstrapTeacher(a.db, createPasswords(a.config.argon), a.now(), fa);
      await bootstrapTeacher(b.db, createPasswords(b.config.argon), b.now(), fb);
      assert.notEqual(passwordIn(fa), passwordIn(fb));
      const row = a.db.prepare('SELECT password_hash FROM users WHERE email = ?').get(BOOTSTRAP_LOGIN) as { password_hash: string };
      assert.match(row.password_hash, /^\$argon2id\$/);
      assert.ok(!row.password_hash.includes(passwordIn(fa)));
    } finally { await a.close(); await b.close(); }
  });

  it('un redémarrage ne change rien : ni nouveau mot de passe, ni nouveau fichier', async () => {
    const w = await startWorld();
    try {
      const file = tmpFile();
      const passwords = createPasswords(w.config.argon);
      await bootstrapTeacher(w.db, passwords, w.now(), file);
      const before = fs.readFileSync(file, 'utf8');
      fs.rmSync(file);
      assert.equal(await bootstrapTeacher(w.db, passwords, w.now(), file), false);
      assert.equal(fs.existsSync(file), false);
      assert.equal(await passwords.verify((w.db.prepare('SELECT password_hash FROM users WHERE email = ?').get(BOOTSTRAP_LOGIN) as { password_hash: string }).password_hash, passwordOf(before)), true);
    } finally { await w.close(); }
  });

  it('si un enseignant existe déjà, rien n’est créé', async () => {
    const w = await startWorld();
    try {
      await w.user('teacher');
      const file = tmpFile();
      assert.equal(await bootstrapTeacher(w.db, createPasswords(w.config.argon), w.now(), file), false);
      assert.equal(fs.existsSync(file), false);
      assert.equal(w.db.prepare('SELECT 1 FROM users WHERE email = ?').get(BOOTSTRAP_LOGIN), undefined);
    } finally { await w.close(); }
  });

  it('l’inscription ne permet pas de réserver l’identifiant « teacher »', async () => {
    const w = await startWorld();
    try {
      const r = await w.call('/api/auth/signup', { body: { email: BOOTSTRAP_LOGIN, name: 'Intrus', password: 'un mot de passe solide' } });
      assert.equal(r.status, 400);
    } finally { await w.close(); }
  });
});

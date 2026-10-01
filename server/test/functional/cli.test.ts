import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { APP_ROOT } from '../../config.ts';
import { openDb } from '../../db.ts';
import { PASSWORD } from '../helpers.ts';
import { createPasswords } from '../../lib/password.ts';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'appsec-cli-'));
const dbFile = path.join(dir, 'appsec.db');
const cli = (...args: string[]) => execFileSync(process.execPath, ['--import', 'tsx', path.join(APP_ROOT, 'server/cli.ts'), ...args], {
  env: { ...process.env, NODE_ENV: 'development', DATABASE_PATH: dbFile, PUBLIC_ORIGIN: 'http://127.0.0.1:4300' },
  encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
});

describe('CLI', () => {
  it('list-users, set-role, reset-link et backup fonctionnent sur une vraie base', async () => {
    const db = openDb(dbFile);
    const hash = await createPasswords({ memoryCost: 1024, timeCost: 1, parallelism: 1 }).hash(PASSWORD);
    db.prepare('INSERT INTO users (email, name, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)').run('prof@academy.test', 'Prof', hash, 'student', Date.now());
    db.close();

    assert.match(cli('list-users'), /prof@academy\.test/);

    assert.match(cli('set-role', 'PROF@academy.test', 'teacher'), /student → teacher/);
    const check = openDb(dbFile);
    assert.equal((check.prepare('SELECT role FROM users WHERE email = ?').get('prof@academy.test') as { role: string }).role, 'teacher');

    const link = cli('reset-link', 'prof@academy.test');
    assert.match(link, /^http:\/\/127\.0\.0\.1:4300\/#\/reinitialiser\?token=[A-Za-z0-9_-]{43}/);
    assert.equal((check.prepare('SELECT COUNT(*) n FROM reset_tokens').get() as { n: number }).n, 1);
    check.close();

    const backup = path.join(dir, 'copie.db');
    cli('backup', backup);
    const copy = openDb(backup);
    assert.equal((copy.prepare('SELECT COUNT(*) n FROM users').get() as { n: number }).n, 1);
    copy.close();
  });

  it('refuse un rôle inconnu, un compte inconnu, une commande inconnue', () => {
    for (const args of [['set-role', 'prof@academy.test', 'admin'], ['set-role', 'inconnu@academy.test', 'teacher'], ['nimporte-quoi'], []]) {
      assert.throws(() => cli(...args), Error, args.join(' '));
    }
    const db = openDb(dbFile);
    assert.equal((db.prepare('SELECT role FROM users WHERE email = ?').get('prof@academy.test') as { role: string }).role, 'teacher');
    db.close();
  });
});

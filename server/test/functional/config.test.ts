import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PRODUCTION_ARGON, loadConfig } from '../../config.ts';

const prod = { NODE_ENV: 'production', PUBLIC_ORIGIN: 'https://academy.example.org', DATABASE_PATH: '/data/appsec.db' };

describe('configuration', () => {
  it('la production garde les paramètres argon2id recommandés par l’OWASP', () => {
    assert.deepEqual(PRODUCTION_ARGON, { memoryCost: 19456, timeCost: 2, parallelism: 1 });
    assert.deepEqual(loadConfig(prod).argon, PRODUCTION_ARGON);
  });

  it('la production impose cookie Secure préfixé __Host-', () => {
    const c = loadConfig(prod);
    assert.equal(c.secureCookies, true);
    assert.equal(c.cookieName, '__Host-appsec_sid');
    assert.deepEqual(c.allowedOrigins, ['https://academy.example.org']);
  });

  it('refuse de démarrer si la production est mal configurée', () => {
    assert.throws(() => loadConfig({ NODE_ENV: 'production', DATABASE_PATH: '/d' }), /PUBLIC_ORIGIN/);
    assert.throws(() => loadConfig({ NODE_ENV: 'production', PUBLIC_ORIGIN: 'https://a.org' }), /DATABASE_PATH/);
    assert.throws(() => loadConfig({ ...prod, PUBLIC_ORIGIN: 'http://academy.example.org' }), /https/);
    assert.throws(() => loadConfig({ ...prod, PUBLIC_ORIGIN: 'https://academy.example.org/app' }), /origine/);
    assert.throws(() => loadConfig({ ...prod, PUBLIC_ORIGIN: 'pas une url' }), /invalide/);
    assert.throws(() => loadConfig({ ...prod, PORT: 'abc' }), /PORT/);
    assert.throws(() => loadConfig({ ...prod, TRUST_PROXY: '-1' }), /TRUST_PROXY/);
  });

  it('en développement, le front Vite et le serveur sont autorisés, sans cookie Secure', () => {
    const c = loadConfig({});
    assert.equal(c.secureCookies, false);
    assert.equal(c.cookieName, 'appsec_sid');
    assert.ok(c.allowedOrigins.includes('http://localhost:5173'));
    assert.ok(c.allowedOrigins.includes('http://127.0.0.1:4300'));
    assert.equal(c.host, '127.0.0.1');
  });
});

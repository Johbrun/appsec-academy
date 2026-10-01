import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { fakeDist, scene, type Scene } from '../helpers.ts';

let s: Scene;
before(async () => { s = await scene({ distDir: fakeDist() }); });
after(() => s.w.close());

const csp = (value: string | null) => {
  const out: Record<string, string[]> = {};
  for (const part of (value ?? '').split(';')) {
    const [name, ...sources] = part.trim().split(/\s+/);
    if (name) out[name] = sources;
  }
  return out;
};

const pages = ['/', '/theme.js', '/assets/index-abc123.js', '/api/me', '/api/inconnue', '/nimporte/quoi'];

describe('en-têtes de sécurité', () => {
  it('la CSP interdit le code en ligne et n’autorise que l’essentiel', async () => {
    for (const page of pages) {
      const r = await s.w.call(page, { as: s.A });
      const policy = csp(r.headers.get('content-security-policy'));
      assert.deepEqual(policy['default-src'], ["'self'"], page);
      assert.deepEqual(policy['script-src'], ["'self'"], page);
      assert.deepEqual(policy['style-src'], ["'self'", 'https://fonts.googleapis.com'], page);
      assert.deepEqual(policy['font-src'], ['https://fonts.gstatic.com'], page);
      assert.deepEqual(policy['img-src'], ["'self'", 'data:'], page);
      assert.deepEqual(policy['connect-src'], ["'self'"], page);
      assert.deepEqual(policy['frame-ancestors'], ["'none'"], page);
      assert.deepEqual(policy['object-src'], ["'none'"], page);
      assert.deepEqual(policy['base-uri'], ["'none'"], page);
      assert.deepEqual(policy['form-action'], ["'self'"], page);
      const everything = Object.values(policy).flat().join(' ');
      assert.doesNotMatch(everything, /unsafe-inline|unsafe-eval|\*|https?:\s|^http:/, page);
    }
  });

  it('les autres en-têtes de durcissement sont présents partout', async () => {
    for (const page of pages) {
      const h = (await s.w.call(page, { as: s.A })).headers;
      assert.equal(h.get('x-content-type-options'), 'nosniff', page);
      assert.equal(h.get('referrer-policy'), 'no-referrer', page);
      assert.equal(h.get('cross-origin-opener-policy'), 'same-origin', page);
      assert.equal(h.get('cross-origin-resource-policy'), 'same-origin', page);
      assert.equal(h.get('x-frame-options'), 'DENY', page);
      assert.match(h.get('permissions-policy') ?? '', /camera=\(\)/, page);
      assert.equal(h.get('x-powered-by'), null, page);
    }
  });

  it('les réponses de l’API ne sont jamais mises en cache', async () => {
    for (const page of ['/api/me', '/api/progress', '/api/me/export', '/api/inconnue']) {
      assert.equal((await s.w.call(page, { as: s.A })).headers.get('cache-control'), 'no-store', page);
    }
    const teacher = await s.w.call('/api/teacher/cohorts', { as: s.T1 });
    assert.equal(teacher.headers.get('cache-control'), 'no-store');
  });

  it('aucun CORS : une origine étrangère ne lit rien', async () => {
    for (const page of ['/api/me', '/', '/api/auth/login']) {
      const get = await s.w.call(page, { as: s.A, origin: 'https://evil.test' });
      assert.equal(get.headers.get('access-control-allow-origin'), null, page);
      assert.equal(get.headers.get('access-control-allow-credentials'), null, page);
    }
    const preflight = await s.w.call('/api/me', {
      as: null, method: 'OPTIONS', origin: 'https://evil.test',
      headers: { 'Access-Control-Request-Method': 'PATCH', 'Access-Control-Request-Headers': 'content-type' },
    });
    assert.equal(preflight.headers.get('access-control-allow-origin'), null);
  });

  it('la 404 d’une route inconnue ne trahit pas le serveur', async () => {
    const r = await s.w.call('/api/inconnue', { as: s.A });
    assert.equal(r.headers.get('server'), null);
    assert.equal(r.headers.get('x-powered-by'), null);
  });
});

import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { fakeDist, scene, type Scene } from '../helpers.ts';

let s: Scene;
before(async () => { s = await scene({ distDir: fakeDist() }); });
after(() => s.w.close());

describe('fichiers statiques', () => {
  it('/ sert index.html sans cache', async () => {
    const r = await s.w.call('/');
    assert.equal(r.status, 200);
    assert.match(r.raw, /AppSec Academy/);
    assert.equal(r.headers.get('cache-control'), 'no-cache');
  });

  it('les fichiers de /assets sont servis en immutable', async () => {
    const r = await s.w.call('/assets/index-abc123.js');
    assert.equal(r.status, 200);
    assert.match(r.headers.get('cache-control') ?? '', /public, max-age=31536000, immutable/);
  });

  it('le script de thème est servi depuis la racine, sans cache long', async () => {
    const r = await s.w.call('/theme.js');
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('cache-control'), 'no-cache');
  });

  it('les statiques sont publics : le contenu n’est pas secret', async () => {
    assert.equal((await s.w.call('/', { as: null })).status, 200);
  });

  it('une route /api inconnue renvoie un 404 JSON', async () => {
    const r = await s.w.call('/api/n-existe-pas', { as: s.A });
    assert.equal(r.status, 404);
    assert.match(r.headers.get('content-type') ?? '', /application\/json/);
    assert.deepEqual(r.body, { error: 'Introuvable' });
  });

  it('un chemin inconnu hors /api renvoie un 404', async () => {
    assert.equal((await s.w.call('/nimporte/quoi')).status, 404);
    assert.equal((await s.w.call('/.env')).status, 404);
  });
});

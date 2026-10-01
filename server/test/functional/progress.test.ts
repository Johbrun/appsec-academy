import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { startWorld, type Actor, type World } from '../helpers.ts';

let w: World;
let me: Actor;
before(async () => { w = await startWorld(); });
after(() => w.close());

const doc = (extra: Record<string, unknown> = {}) => ({
  version: 1, xp: 120, lessons: { 'm01-l01': '2026-09-01' }, modules: [], scores: { 'spot-the-sink': 80 }, labs: [], leitner: {}, badges: [], checkpoints: {}, ...extra,
});

describe('progression', () => {
  it('un compte neuf n’a pas de progression', async () => {
    me = await w.user();
    const r = await w.call('/api/progress', { as: me });
    assert.equal(r.status, 200);
    assert.deepEqual(r.body, { data: null, rev: 0 });
  });

  it('un PUT suivi d’un GET renvoie le même document, révision incrémentée', async () => {
    me = await w.user();
    const put = await w.call('/api/progress', { as: me, method: 'PUT', body: { data: doc(), rev: 0 } });
    assert.equal(put.status, 200);
    assert.equal(put.body.rev, 1);

    const get = await w.call('/api/progress', { as: me });
    assert.deepEqual(get.body.data, doc());
    assert.equal(get.body.rev, 1);

    const again = await w.call('/api/progress', { as: me, method: 'PUT', body: { data: doc({ xp: 200 }), rev: 1 } });
    assert.equal(again.body.rev, 2);
    assert.equal((await w.call('/api/progress', { as: me })).body.data.xp, 200);
  });

  it('un PUT avec une révision périmée renvoie 409 et l’état du serveur', async () => {
    me = await w.user();
    await w.call('/api/progress', { as: me, method: 'PUT', body: { data: doc({ xp: 10 }), rev: 0 } });
    await w.call('/api/progress', { as: me, method: 'PUT', body: { data: doc({ xp: 20 }), rev: 1 } });

    const stale = await w.call('/api/progress', { as: me, method: 'PUT', body: { data: doc({ xp: 999 }), rev: 1 } });
    assert.equal(stale.status, 409);
    assert.equal(stale.body.rev, 2);
    assert.equal(stale.body.data.xp, 20);
    // Rien n'a été écrasé.
    assert.equal((await w.call('/api/progress', { as: me })).body.data.xp, 20);
  });

  it('une première écriture exige la révision 0', async () => {
    me = await w.user();
    const r = await w.call('/api/progress', { as: me, method: 'PUT', body: { data: doc(), rev: 3 } });
    assert.equal(r.status, 409);
    assert.deepEqual({ data: r.body.data, rev: r.body.rev }, { data: null, rev: 0 });
  });

  it('DELETE puis GET renvoie une progression vide', async () => {
    me = await w.user();
    await w.call('/api/progress', { as: me, method: 'PUT', body: { data: doc(), rev: 0 } });
    assert.equal((await w.call('/api/progress', { as: me, method: 'DELETE' })).status, 200);
    assert.deepEqual((await w.call('/api/progress', { as: me })).body, { data: null, rev: 0 });
  });

  it('une clé inconnue est acceptée telle quelle : ajouter un jeu ne demande aucune migration', async () => {
    me = await w.user();
    const withNewGame = doc({ scores: { 'spot-the-sink': 80, 'un-jeu-ajoute-demain': 55 }, unChampFutur: { a: [1, 2, 3] } });
    await w.call('/api/progress', { as: me, method: 'PUT', body: { data: withNewGame, rev: 0 } });
    assert.deepEqual((await w.call('/api/progress', { as: me })).body.data, withNewGame);
  });
});

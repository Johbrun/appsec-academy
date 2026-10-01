import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { registeredRoutes, scene, type Actor, type Scene } from '../helpers.ts';

let s: Scene;
before(async () => { s = await scene(); });
after(() => s.w.close());

// Toutes les routes qui modifient l'état, tirées du routeur : une nouvelle route est couverte d'office.
const mutations = () => registeredRoutes(s.w.app).filter((r) => r.method !== 'GET');

/** Un acteur qui aurait le droit d'appeler la route : le refus ne doit venir que de la protection CSRF. */
const authorized = (path: string): Actor => (path.startsWith('/api/teacher/') ? s.T1 : s.A);
const concrete = (path: string) => path.replace(':id', String(s.cohort.id)).replace(':uid', String(s.A.id));

describe('CSRF : Origin et Content-Type', () => {
  it('il y a des mutations à tester', () => {
    assert.ok(mutations().length >= 15);
  });

  it('sans en-tête Origin : 403, et rien ne change', async () => {
    for (const { method, path } of mutations()) {
      const before = s.w.snapshot();
      const r = await s.w.call(concrete(path), { as: authorized(path), method, body: {}, origin: null });
      assert.equal(r.status, 403, `${method} ${path}`);
      assert.equal(s.w.snapshot(), before, `${method} ${path} a modifié la base`);
    }
  });

  it('avec une origine étrangère : 403, et rien ne change', async () => {
    for (const { method, path } of mutations()) {
      const before = s.w.snapshot();
      const r = await s.w.call(concrete(path), { as: authorized(path), method, body: {}, origin: 'https://evil.test' });
      assert.equal(r.status, 403, `${method} ${path}`);
      assert.equal(s.w.snapshot(), before, `${method} ${path} a modifié la base`);
    }
  });

  it('les origines qui ressemblent à la bonne sont refusées', async () => {
    const before = s.w.snapshot();
    for (const origin of [
      'http://academy.test',               // autre schéma
      'https://academy.test:8443',         // autre port
      'https://academy.test.evil.test',    // préfixe
      'https://evil.test/https://academy.test',
      'https://ACADEMY.test',              // la comparaison est exacte
      'null',                              // iframe sandboxée, redirections
      '',
    ]) {
      const r = await s.w.call('/api/me', { as: s.A, method: 'PATCH', body: { name: 'Piraté' }, origin });
      assert.equal(r.status, 403, `origine « ${origin} »`);
    }
    assert.equal(s.w.snapshot(), before);
  });

  it('un corps qui n’est pas du JSON (formulaire, texte) : 415, et rien ne change', async () => {
    for (const { method, path } of mutations()) {
      for (const contentType of ['text/plain', 'application/x-www-form-urlencoded', 'multipart/form-data; boundary=x', null]) {
        const before = s.w.snapshot();
        const r = await s.w.call(concrete(path), { as: authorized(path), method, rawBody: 'name=Pirate&password=x', contentType });
        assert.equal(r.status, 415, `${method} ${path} (${contentType})`);
        assert.equal(s.w.snapshot(), before, `${method} ${path} a modifié la base`);
      }
    }
  });

  it('la requête légitime passe : le test ne protège pas en refusant tout', async () => {
    const r = await s.w.call('/api/me', { as: s.A, method: 'PATCH', body: { name: 'Légitime' } });
    assert.equal(r.status, 200);
  });

  it('le cookie n’est pas envoyé en contexte tiers (SameSite=Lax) : le test de la protection ne s’y limite pas', async () => {
    const r = await s.w.login({ ...s.A, cookie: undefined });
    assert.match(r.headers.getSetCookie()[0], /SameSite=Lax/i);
  });
});

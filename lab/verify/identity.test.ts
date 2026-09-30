// Tests de régression : identité, session et fédération.
//
// Ils ÉCHOUENT sur le code livré : c'est leur rôle. Chacun exige deux choses,
// et c'est ce couple qui compte :
//
//   1. le contrôle REFUSE l'attaque ;
//   2. le cas légitime MARCHE ENCORE.
//
// Un correctif qui casse la connexion, l'inscription ou le SSO fait échouer le
// test aussi sûrement qu'un correctif absent. Lance le lab (`npm run dev:api`),
// corrige, relance `npm run verify` jusqu'au vert.

import { before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { call, devToken, ensureUp, login, refused, reset } from './helpers.ts';

before(ensureUp);
beforeEach(reset);

// ── Outils ──────────────────────────────────────────────────────────────────

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

const post = <T = Record<string, unknown>>(route: string, body: unknown, init = {}) =>
  call<T>(route, { method: 'POST', body: JSON.stringify(body), ...init });

const register = (body: Record<string, unknown>) => post('/auth/register', body);

interface Mail { to: string; body: string }

/** Déclenche une réinitialisation et relit le jeton dans la boîte du lab. */
async function resetTokenFor(email: string): Promise<string> {
  await post('/auth/forgot', { email });
  const mails = await call<Mail[]>('/lab/mails');
  const mine = mails.body.find((m) => m.to === email);
  const token = mine ? /token=([0-9a-f]+)/.exec(mine.body)?.[1] : undefined;
  assert.ok(token, `aucun jeton de réinitialisation émis pour ${email}`);
  return token;
}

/** Un jeton HS256 signé avec la clé `key`, en-tête libre. */
function forge(header: Record<string, unknown>, claims: Record<string, unknown>, key: Buffer) {
  const h = b64({ typ: 'JWT', ...header });
  const p = b64({
    iss: 'https://novafact.example',
    aud: 'acme',
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...claims,
  });
  return `${h}.${p}.${crypto.createHmac('sha256', key).update(`${h}.${p}`).digest('base64url')}`;
}

const idpRegister = async (body: Record<string, unknown>) =>
  (await post<{ idp_session: string }>('/oauth/idp/register', body)).body;

/**
 * Déroule le flux fédéré jusqu'au retour, et rend la query string du callback.
 * Passe par /oauth/start pour récupérer le `state` quand il y en a un.
 */
async function oauthFlow(idpSession: string, token?: string): Promise<string> {
  const start = await call<{ authorize: string }>(`/oauth/start?idp_session=${idpSession}`, { token });
  const authorize = new URL(start.body.authorize);
  const res = await call(`/oauth/authorize${authorize.search}`, { token, redirect: 'manual' });
  const location = res.headers.get('location');
  return location ? new URL(location).search : '';
}

// ─── M2 ─────────────────────────────────────────────────────────────────────

describe('regex-unanchored · liste blanche de domaines à l’inscription', () => {
  const pirate = 'p@acme.example.evil.test';

  it('refuse une adresse dont le domaine n’est pas exactement celui de la liste', async () => {
    await register({ email: pirate, password: 'pw123' });
    assert.equal(
      await login(pirate, 'pw123'),
      null,
      'un compte est né sur un domaine que la liste blanche devait refuser',
    );
  });

  it('laisse s’inscrire sur un domaine autorisé', async () => {
    const res = await register({ email: 'neuf@acme.example', password: 'pw123' });
    assert.ok(res.status < 400, `inscription légitime refusée — HTTP ${res.status}`);
    assert.ok(await login('neuf@acme.example', 'pw123'), 'le compte créé ne peut pas se connecter');
  });
});

describe('unicode-normalization · unicité de l’adresse', () => {
  // Domaine écrit en caractères pleine chasse : NFKC le replie sur l'ASCII.
  const collision = 'admin@ｎｏｖａｆａｃｔ.example';

  it('ne laisse pas créer un compte qui résout vers l’adresse d’un autre', async () => {
    await register({ email: collision, password: 'pw123' });
    const token = await devToken();
    const dir = await call<{ members: { email: string }[] }>('/auth/directory', { token });
    const doublons = (dir.body.members ?? []).filter((m) => m.email === 'admin@novafact.example');
    assert.ok(
      doublons.length <= 1,
      `${doublons.length} comptes résolvent désormais vers admin@novafact.example`,
    );
  });

  it('laisse s’inscrire avec une adresse ordinaire', async () => {
    const res = await register({ email: 'claire@acme.example', password: 'pw123' });
    assert.ok(res.status < 400, `inscription légitime refusée — HTTP ${res.status}`);
    assert.ok(await login('claire@acme.example', 'pw123'), 'le compte créé ne peut pas se connecter');
  });
});

describe('input-truncation · longueur de l’adresse', () => {
  const longue = `${'a'.repeat(17)}@globex.example.acme.example`;

  it('refuse une adresse plus longue que ce que la base peut stocker', async () => {
    await post('/auth/register/partner', { email: longue, password: 'pw123' });
    const tronquee = longue.slice(0, 32);
    assert.equal(
      await login(tronquee, 'pw123'),
      null,
      `un compte est né sous ${tronquee}, chez un client que l’adresse validée ne désignait pas`,
    );
  });

  it('laisse s’inscrire depuis un sous-domaine client', async () => {
    const res = await post<{ tenantId: string }>('/auth/register/partner', {
      email: 'bob@compta.acme.example',
      password: 'pw123',
    });
    assert.equal(res.status, 201, `inscription partenaire légitime refusée — HTTP ${res.status}`);
    assert.equal(res.body.tenantId, 'acme', 'le partenaire n’est plus rattaché au bon client');
  });
});

describe('try-catch-fail-open · contrôle d’accès à l’annuaire', () => {
  it('refuse l’annuaire d’un autre tenant, même avec un paramètre malformé', async () => {
    const token = await devToken();
    const res = await call<{ members?: { email: string }[] }>('/auth/directory?tenant[]=globex', { token });
    const fuite = res.status === 200 && (res.body.members ?? []).some((m) => m.email === 'compta@globex.example');
    assert.equal(fuite, false, 'l’annuaire de Globex a été servi à un compte ACME');
  });

  it('sert toujours l’annuaire de son propre tenant', async () => {
    const token = await devToken();
    const res = await call<{ members: { email: string }[] }>('/auth/directory', { token });
    assert.equal(res.status, 200, `annuaire légitime refusé — HTTP ${res.status}`);
    assert.ok(res.body.members.some((m) => m.email === 'dev@acme.example'), 'l’annuaire est vide');
  });
});

describe('timing-attack · comparaison du jeton de réinitialisation', () => {
  it('ne laisse pas le temps de réponse trahir le préfixe du jeton', async () => {
    const flip = (c: string) => (c === '0' ? '1' : '0');
    const presque: number[] = [];
    const loin: number[] = [];

    for (let round = 0; round < 8; round += 1) {
      const vrai = await resetTokenFor('admin@novafact.example');
      const candidats: [number[], string][] = [
        [presque, vrai.slice(0, -1) + flip(vrai.slice(-1))],
        [loin, flip(vrai[0]) + vrai.slice(1)],
        [presque, vrai.slice(0, -1) + flip(vrai.slice(-1))],
        [loin, flip(vrai[0]) + vrai.slice(1)],
      ];
      for (const [bucket, token] of candidats) {
        const t0 = process.hrtime.bigint();
        await post('/auth/reset', { email: 'admin@novafact.example', token, password: 'x' });
        bucket.push(Number(process.hrtime.bigint() - t0) / 1e6);
      }
    }

    const ecart = median(presque) - median(loin);
    assert.ok(
      ecart < 8,
      `un préfixe presque juste répond ${ecart.toFixed(1)} ms plus lentement : le jeton se reconstitue caractère par caractère`,
    );
  });

  it('accepte toujours le bon jeton', async () => {
    // Sur un compte que les autres suites n'utilisent pas par mot de passe :
    // `npm run verify` lance les fichiers de test en parallèle.
    const token = await resetTokenFor('admin@novafact.example');
    const res = await post('/auth/reset', { email: 'admin@novafact.example', token, password: 'nouveauadmin' });
    assert.equal(res.status, 200, `réinitialisation légitime refusée — HTTP ${res.status}`);
    assert.ok(await login('admin@novafact.example', 'nouveauadmin'), 'le nouveau mot de passe ne marche pas');
  });
});

describe('open-redirect · retour après connexion', () => {
  it('ne redirige pas vers un domaine externe', async () => {
    const res = await post('/auth/login', {
      email: 'dev@acme.example', password: 'dev', next: 'https://attaquant.test/vol',
    }, { redirect: 'manual' });
    const location = res.headers.get('location') ?? '';
    assert.ok(
      refused(res.status) || !/attaquant\.test/.test(location),
      `la connexion redirige vers ${location}`,
    );
  });

  it('suit toujours un chemin de retour interne', async () => {
    const res = await post('/auth/login', {
      email: 'dev@acme.example', password: 'dev', next: '/factures',
    }, { redirect: 'manual' });
    assert.equal(res.status, 303, `retour interne refusé — HTTP ${res.status}`);
    assert.equal(res.headers.get('location'), '/factures', 'la destination interne a changé');
  });
});

// ─── M3 ─────────────────────────────────────────────────────────────────────

describe('race-partial-construction · création de compte', () => {
  const email = 'course@acme.example';

  it('n’ouvre jamais de session sur un compte à moitié construit', async () => {
    const creation = register({ email, password: 'motdepassesecret' });
    let ouverte = false;
    for (let i = 0; i < 60 && !ouverte; i += 1) {
      const res = await post('/auth/login', { email, password: '' });
      if (res.status === 200) ouverte = true;
    }
    await creation;
    assert.equal(ouverte, false, 'une session a été ouverte avec un mot de passe vide pendant la création');
  });

  it('laisse se connecter une fois le compte créé', async () => {
    const res = await register({ email, password: 'motdepassesecret' });
    assert.ok(res.status < 400, `inscription refusée — HTTP ${res.status}`);
    assert.ok(await login(email, 'motdepassesecret'), 'le compte créé ne peut pas se connecter');
  });
});

describe('reset-token-collision · unicité des jetons', () => {
  it('n’émet jamais le même jeton pour deux comptes', async () => {
    for (let i = 0; i < 40; i += 1) {
      await Promise.all([
        post('/auth/forgot', { email: 'dev@acme.example' }),
        post('/auth/forgot', { email: 'admin@novafact.example' }),
      ]);
    }
    const mails = await call<Mail[]>('/lab/mails');
    const porteurs = new Map<string, Set<string>>();
    for (const m of mails.body) {
      const token = /token=([0-9a-f]+)/.exec(m.body)?.[1];
      if (!token) continue;
      if (!porteurs.has(token)) porteurs.set(token, new Set());
      porteurs.get(token)!.add(m.to);
    }
    const partages = [...porteurs.entries()].filter(([, who]) => who.size > 1).map(([t]) => t);
    assert.deepEqual(partages, [], 'un jeton de réinitialisation vaut pour deux comptes à la fois');
  });

  it('émet toujours un jeton utilisable', async () => {
    const token = await resetTokenFor('admin@novafact.example');
    const res = await post('/auth/reset', { email: 'admin@novafact.example', token, password: 'motdepasse2' });
    assert.equal(res.status, 200, `réinitialisation légitime refusée — HTTP ${res.status}`);
  });
});

describe('email-parsing-differential · analyse de l’adresse', () => {
  it('refuse une adresse que deux composants liraient différemment', async () => {
    await register({ email: 'p@evil.test@novafact.example', password: 'pw123' });
    const mails = await call<Mail[]>('/lab/mails');
    assert.ok(
      !mails.body.some((m) => String(m.to).endsWith('@evil.test')),
      'du courrier Novafact est parti vers un domaine que le contrôle d’inscription n’avait pas vu',
    );
  });

  it('laisse s’inscrire avec une adresse ordinaire', async () => {
    const res = await register({ email: 'sarah@globex.example', password: 'pw123' });
    assert.ok(res.status < 400, `inscription légitime refusée — HTTP ${res.status}`);
    assert.ok(await login('sarah@globex.example', 'pw123'), 'le compte créé ne peut pas se connecter');
  });
});

describe('cookie-deserialization · cookie de préférences', () => {
  const forgeCookie = () => {
    const body = Buffer.from(
      JSON.stringify({ $t: 'Session', email: 'dev@acme.example', role: 'admin', tenantId: 'acme' }),
      'utf8',
    ).toString('base64url');
    const mac = crypto.createHmac('sha256', 'nova1').update(body).digest('base64url').slice(0, 22);
    return `novafact_prefs=${encodeURIComponent(`${body}.${mac}`)}`;
  };

  it('ne laisse pas un cookie de préférences décider du rôle', async () => {
    const res = await call('/auth/directory?tenant=globex', { headers: { Cookie: forgeCookie() } });
    assert.ok(refused(res.status), `un cookie forgé a ouvert l’annuaire de Globex — HTTP ${res.status}`);
  });

  it('applique toujours des préférences légitimes', async () => {
    const set = await call('/auth/prefs', { method: 'POST', body: JSON.stringify({ theme: 'dark' }) });
    const cookie = (set.headers.get('set-cookie') ?? '').split(';')[0];
    const lu = await call<{ theme: string }>('/auth/prefs', { headers: { Cookie: cookie } });
    assert.equal(lu.body.theme, 'dark', 'le cookie de préférences ne fait plus effet');
  });
});

describe('jwt-kid-traversal · résolution de la clé', () => {
  it('refuse un jeton dont le kid désigne un fichier', async () => {
    const token = forge(
      { alg: 'HS256', kid: `${'../'.repeat(12)}dev/null` },
      { sub: 'admin@novafact.example', role: 'admin', tenantId: 'acme' },
      Buffer.alloc(0),
    );
    const res = await call('/auth/deployment/acme/whoami', { token });
    assert.ok(refused(res.status), `un jeton signé avec /dev/null a été accepté — HTTP ${res.status}`);
  });

  it('accepte toujours un jeton émis par le serveur', async () => {
    const res = await call('/auth/deployment/acme/whoami', { token: await devToken() });
    assert.equal(res.status, 200, `jeton légitime refusé — HTTP ${res.status}`);
  });
});

describe('jwt-jku-jwk · origine de la clé de vérification', () => {
  it('refuse un jeton qui embarque sa propre clé publique', async () => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const h = b64({ alg: 'RS256', typ: 'JWT', jwk: publicKey.export({ format: 'jwk' }) });
    const p = b64({
      sub: 'admin@novafact.example', role: 'admin', tenantId: 'acme',
      iss: 'https://novafact.example', aud: 'acme', exp: Math.floor(Date.now() / 1000) + 3600,
    });
    const sig = crypto.sign('RSA-SHA256', Buffer.from(`${h}.${p}`), privateKey).toString('base64url');
    const res = await call('/auth/deployment/acme/whoami', { token: `${h}.${p}.${sig}` });
    assert.ok(refused(res.status), `un jeton signé par l’attaquant a été accepté — HTTP ${res.status}`);
  });

  it('accepte toujours un jeton émis par le serveur', async () => {
    const res = await call('/auth/deployment/acme/whoami', { token: await devToken() });
    assert.equal(res.status, 200, `jeton légitime refusé — HTTP ${res.status}`);
  });
});

describe('jwt-no-audience · portée du jeton', () => {
  it('refuse sur un déploiement un jeton émis pour un autre', async () => {
    const res = await call('/auth/deployment/globex/whoami', { token: await devToken() });
    assert.ok(refused(res.status), `un jeton du déploiement acme a été accepté sur globex — HTTP ${res.status}`);
  });

  it('accepte le jeton sur son propre déploiement', async () => {
    const res = await call('/auth/deployment/acme/whoami', { token: await devToken() });
    assert.equal(res.status, 200, `jeton légitime refusé sur son déploiement — HTTP ${res.status}`);
  });
});

describe('session-not-revocable · fin de session', () => {
  it('refuse un jeton après déconnexion', async () => {
    const token = await devToken();
    const avant = await call('/auth/deployment/acme/whoami', { token });
    assert.equal(avant.status, 200, 'le jeton ne marchait déjà pas avant la déconnexion');
    await call('/auth/logout', { method: 'POST', token, body: '{}' });
    const apres = await call('/auth/deployment/acme/whoami', { token });
    assert.ok(refused(apres.status), 'le jeton reste accepté après /logout');
  });

  it('refuse un jeton dont la date d’expiration est passée', async () => {
    const perime = forge(
      { alg: 'HS256' },
      { sub: 'dev@acme.example', role: 'user', tenantId: 'acme', exp: Math.floor(Date.now() / 1000) - 7200 },
      Buffer.from('lab-secret-novafact', 'utf8'),
    );
    const res = await call('/auth/deployment/acme/whoami', { token: perime });
    assert.ok(refused(res.status), `un jeton périmé a été accepté — HTTP ${res.status}`);
  });
});

// ─── M8 ─────────────────────────────────────────────────────────────────────

describe('weak-random · jeton de réinitialisation', () => {
  const xorshift32 = (hex: string) => {
    let x = parseInt(hex, 16) >>> 0;
    x ^= x << 13; x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5; x >>>= 0;
    return x.toString(16).padStart(8, '0');
  };

  it('n’émet pas un jeton que le précédent permet de calculer', async () => {
    const t1 = await resetTokenFor('dev@acme.example');
    await delay(5);
    const t2 = await resetTokenFor('compta@globex.example');
    assert.ok(
      t1.length >= 32,
      `un jeton de ${t1.length} caractères hexadécimaux, soit ${t1.length * 4} bits : c’est un espace qu’on énumère`,
    );
    assert.notEqual(t2, xorshift32(t1), 'le jeton suivant se calcule depuis le précédent');
  });

  it('le lien de réinitialisation reste utilisable', async () => {
    const token = await resetTokenFor('admin@novafact.example');
    const res = await post('/auth/reset', { email: 'admin@novafact.example', token, password: 'motdepasse3' });
    assert.equal(res.status, 200, `réinitialisation légitime refusée — HTTP ${res.status}`);
    assert.ok(await login('admin@novafact.example', 'motdepasse3'), 'le nouveau mot de passe ne marche pas');
  });
});

// ─── M9 ─────────────────────────────────────────────────────────────────────

describe('oauth-redirect · validation de la redirect_uri', () => {
  const enregistree = 'http://127.0.0.1:5199/oauth/callback';
  const pirate = `${enregistree}.attaquant.test/vol`;

  it('refuse une redirect_uri qui se contente de commencer par celle enregistrée', async () => {
    const idp = await idpRegister({ sub: 'pirate-1', email: 'pirate@globex-id.example' });
    const res = await call(
      `/oauth/authorize?client_id=novafact-web&response_type=code&state=abc&redirect_uri=${encodeURIComponent(pirate)}&idp_session=${idp.idp_session}`,
      { redirect: 'manual' },
    );
    const location = res.headers.get('location') ?? '';
    assert.ok(!location.startsWith(pirate), `le code d’autorisation est parti vers ${location}`);
  });

  it('accepte toujours la redirect_uri enregistrée', async () => {
    const idp = await idpRegister({ sub: 'client-1', email: 'client@globex-id.example', email_verified: true });
    const query = await oauthFlow(idp.idp_session);
    assert.ok(/[?&]code=/.test(query), 'le flux légitime ne délivre plus de code d’autorisation');
  });
});

describe('oauth-state · origine du flux fédéré', () => {
  it('refuse un code obtenu dans une autre session', async () => {
    const attaquant = await devToken();
    const victime = await login('compta@globex.example', 'printemps2024');
    const idp = await idpRegister({ sub: 'pirate-2', email: 'pirate@globex-id.example', email_verified: true });
    const query = await oauthFlow(idp.idp_session, attaquant);
    const res = await call<{ linked?: boolean }>(`/oauth/callback${query}`, { token: victime ?? undefined });
    assert.notEqual(
      res.body?.linked, true,
      'le compte de la victime a été rattaché à l’identité fédérée de l’attaquant',
    );
  });

  it('rattache toujours dans la session qui a ouvert le flux', async () => {
    const token = await devToken();
    const idp = await idpRegister({ sub: 'moi-1', email: 'moi@globex-id.example', email_verified: true });
    const query = await oauthFlow(idp.idp_session, token);
    const res = await call<{ linked?: boolean }>(`/oauth/callback${query}`, { token });
    assert.equal(res.body?.linked, true, `rattachement légitime refusé — HTTP ${res.status}`);
  });
});

describe('oauth-email-unverified · rapprochement de comptes', () => {
  it('ne rapproche pas un compte local sur un e-mail non vérifié', async () => {
    const idp = await idpRegister({ sub: 'pirate-3', email: 'admin@novafact.example' });
    const query = await oauthFlow(idp.idp_session);
    const res = await call<{ user?: { email: string } }>(`/oauth/callback${query}`);
    assert.notEqual(
      res.body?.user?.email, 'admin@novafact.example',
      'une session administrateur a été ouverte depuis un e-mail que le fournisseur n’a pas vérifié',
    );
  });

  it('connecte toujours une identité fédérée déjà rattachée', async () => {
    const token = await devToken();
    const idp = await idpRegister({ sub: 'moi-2', email: 'moi@globex-id.example', email_verified: true });
    const lien = await call(`/oauth/callback${await oauthFlow(idp.idp_session, token)}`, { token });
    assert.equal(lien.status, 200, `rattachement légitime refusé — HTTP ${lien.status}`);
    const res = await call<{ user?: { email: string } }>(`/oauth/callback${await oauthFlow(idp.idp_session)}`);
    assert.equal(
      res.body?.user?.email, 'dev@acme.example',
      `connexion fédérée légitime cassée — HTTP ${res.status}`,
    );
  });
});

describe('saml-wrapping · assertion signée', () => {
  const forgee =
    '<saml:Assertion ID="_evil" IssueInstant="2026-01-01T00:00:00.000Z" Version="2.0">' +
    '<saml:Issuer>https://sso.acme.example/idp</saml:Issuer>' +
    '<saml:Subject><saml:NameID Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress">admin@novafact.example</saml:NameID></saml:Subject>' +
    '</saml:Assertion>';

  it('refuse un document dont le sujet lu n’est pas celui qui a été signé', async () => {
    const assertion = await post<{ xml: string }>('/saml/idp/assert', { email: 'dev@acme.example' });
    const xml = assertion.body.xml.replace(/(<samlp:Response[^>]*>)/, `$1${forgee}`);
    const res = await post<{ user?: { email: string } }>('/saml/acs', {
      SAMLResponse: Buffer.from(xml, 'utf8').toString('base64'),
    });
    assert.notEqual(
      res.body?.user?.email, 'admin@novafact.example',
      'une assertion enveloppée a ouvert une session administrateur',
    );
  });

  it('accepte toujours une assertion intacte', async () => {
    const assertion = await post<{ SAMLResponse: string }>('/saml/idp/assert', { email: 'dev@acme.example' });
    const res = await post<{ user?: { email: string } }>('/saml/acs', {
      SAMLResponse: assertion.body.SAMLResponse,
    });
    assert.equal(res.status, 200, `SSO légitime refusé — HTTP ${res.status}`);
    assert.equal(res.body.user?.email, 'dev@acme.example', 'le SSO ne connecte plus le bon compte');
  });
});

// ─── M10 ────────────────────────────────────────────────────────────────────

describe('user-enumeration · l’inscription comme oracle', () => {
  it('répond la même chose pour une adresse prise et pour une adresse libre', async () => {
    const prise = await register({ email: 'dev@acme.example', password: 'pw123' });
    const libre = await register({ email: 'libre@acme.example', password: 'pw123' });
    assert.equal(
      prise.status, libre.status,
      `l’inscription distingue les comptes existants (${prise.status} contre ${libre.status})`,
    );
    assert.equal(prise.text, libre.text, 'le corps de la réponse distingue les comptes existants');
  });

  it('crée tout de même un compte utilisable', async () => {
    await register({ email: 'lea@acme.example', password: 'pw123' });
    assert.ok(await login('lea@acme.example', 'pw123'), 'l’inscription ne crée plus de compte');
  });
});

describe('xff-spoof · limitation de la connexion', () => {
  it('limite la rafale même quand X-Forwarded-For change à chaque requête', async () => {
    let freinees = 0;
    for (let i = 0; i < 130; i += 1) {
      const res = await post('/auth/login',
        { email: 'compta@globex.example', password: `essai${i}` },
        { headers: { 'X-Forwarded-For': `203.0.113.${i % 255}, 10.0.0.1` } },
      );
      if (res.status === 429) freinees += 1;
    }
    assert.ok(freinees > 0, '130 tentatives de connexion sur le même compte, aucune n’a été freinée');
  });

  it('laisse un client ordinaire se connecter', async () => {
    assert.ok(await login('dev@acme.example', 'dev'), 'la connexion légitime est bloquée dès le premier essai');
  });
});

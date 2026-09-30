// Tests de régression : surface HTTP et client.
//
// Ils ÉCHOUENT sur le code livré : c'est leur rôle. Chacun exige deux choses,
// et c'est ce couple qui compte :
//
//   1. le contrôle REFUSE l'attaque ;
//   2. le cas légitime MARCHE ENCORE.
//
// Aucun test ne regarde la liste des exercices résolus : un drapeau déjà obtenu
// ne se retire pas, il ne dit donc rien de la correction. Ce qui est vérifié,
// ce sont des effets observables — en-têtes servis, valeurs réellement écrites,
// réponses rendues indiscernables.
//
// Les challenges purement navigateur (Trusted Types, pollution de prototype
// côté client, DOM clobbering, postMessage, URL javascript:, secret du bundle)
// sont contrôlés sur le source, avec readCode() : les commentaires sont retirés
// avant l'analyse, pour qu'une phrase décrivant le correctif ne suffise pas.

import { before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { API, call, devToken, ensureUp, readCode, refused, reset } from './helpers.ts';
import { sign } from '../server/lib/jwt.ts';

before(ensureUp);
beforeEach(reset);

// ── Outils communs ──────────────────────────────────────────────────────────

const JSON_CT = { 'Content-Type': 'application/json' };
const FORM_CT = { 'Content-Type': 'application/x-www-form-urlencoded' };

/** Ouvre une session cookie sur la surface rendue par le serveur. */
async function surfaceCookie(): Promise<string> {
  const token = await devToken();
  const res = await fetch(`${API}/surface/login?token=${token}`, { redirect: 'manual' });
  const sid = /nf_session=([a-f0-9]+)/.exec(res.headers.get('set-cookie') ?? '')?.[1];
  assert.ok(sid, 'la surface HTTP ne délivre plus de session : le cas légitime est cassé');
  return `nf_session=${sid}`;
}

const csrfToken = async () => (await call<{ csrf: string }>('/surface/csrf')).body.csrf;

const readIban = async (cookie: string) =>
  (await call<{ iban: string }>('/billing/iban', { headers: { Cookie: cookie } })).body?.iban ?? '';

/** Enregistre un IBAN comme l'application le fait : JSON, jeton, ressaisie. */
async function setIbanLegitimately(cookie: string, iban: string) {
  return call('/billing/iban', {
    method: 'POST',
    headers: { ...JSON_CT, 'X-CSRF-Token': await csrfToken(), Cookie: cookie },
    body: JSON.stringify({ iban, ibanConfirm: iban }),
  });
}

const csp = async () => (await call('/health')).headers.get('content-security-policy') ?? '';

const gql = (query: string, token: string, headers: Record<string, string> = JSON_CT, body?: string) =>
  call<{ data?: Record<string, unknown>; errors?: { message: string }[] }>('/graphql', {
    method: 'POST',
    token,
    headers,
    body: body ?? JSON.stringify({ query }),
  });

// ═══ M2 ═════════════════════════════════════════════════════════════════════

describe('url-prefix-authz · contrôle d’accès par préfixe d’URL', () => {
  it('refuse l’export comptable quelle que soit la casse de l’URL', async () => {
    const token = await devToken();
    for (const path of ['/admin/exports/ledger', '/Admin/exports/ledger', '/ADMIN/EXPORTS/ledger']) {
      const res = await call(`${path}`, { token });
      assert.ok(refused(res.status), `${path} servi à un compte ordinaire — HTTP ${res.status}`);
    }
  });

  it('sert toujours l’export comptable à un administrateur', async () => {
    const admin = sign({ sub: 'admin@novafact.example', role: 'admin', tenantId: 'acme' });
    const res = await call<{ lignes?: unknown[] }>('/admin/exports/ledger', { token: admin });
    assert.equal(res.status, 200, 'l’export comptable n’est plus accessible à un administrateur');
    assert.ok(Array.isArray(res.body.lignes), 'l’export comptable ne renvoie plus de lignes');
  });
});

// ═══ M3 ═════════════════════════════════════════════════════════════════════

describe('content-type-confusion · anti-CSRF conditionnel', () => {
  it('refuse une mutation en formulaire encodé sans jeton', async () => {
    const cookie = await surfaceCookie();
    const before = await readIban(cookie);
    const res = await call('/billing/iban', {
      method: 'POST',
      headers: { ...FORM_CT, Cookie: cookie },
      body: 'iban=FR7612345678901234567890123',
    });
    assert.ok(refused(res.status), `mutation en formulaire encodé acceptée — HTTP ${res.status}`);
    assert.equal(await readIban(cookie), before, 'l’IBAN a été modifié sans vérification anti-CSRF');
  });

  it('accepte toujours la mutation légitime de l’application', async () => {
    const cookie = await surfaceCookie();
    const res = await setIbanLegitimately(cookie, 'FR7630004000031234567890143');
    assert.equal(res.status, 200, `la mutation légitime ne marche plus — HTTP ${res.status}`);
    assert.equal(await readIban(cookie), 'FR7630004000031234567890143');
  });
});

describe('ssrf-redirect-bypass · redirection non revalidée', () => {
  const origin = new URL(API).origin;
  const RELAY = `${origin}/api/webhooks/relay`;
  const INTERNAL = `${origin}/api/internal/rotate-keys`;

  it('ne suit pas une redirection vers une destination hors liste blanche', async () => {
    const token = await devToken();
    const res = await call<{ ok?: boolean; finalUrl?: string }>('/webhooks/deliver', {
      method: 'POST', token,
      body: JSON.stringify({ url: `${RELAY}?to=${encodeURIComponent(INTERNAL)}` }),
    });
    assert.ok(
      !res.body?.ok,
      'la livraison a abouti après une redirection vers une route interne',
    );
    assert.ok(
      !String(res.body?.finalUrl ?? '').includes('/api/internal/'),
      `le client HTTP a été conduit jusqu’à ${res.body?.finalUrl}`,
    );
  });

  it('livre toujours vers une destination de la liste blanche', async () => {
    const token = await devToken();
    const res = await call<{ error?: string }>('/webhooks/deliver', {
      method: 'POST', token,
      body: JSON.stringify({ url: RELAY, event: 'invoice.paid' }),
    });
    assert.equal(res.status, 200, `la livraison légitime est refusée — HTTP ${res.status}`);
    assert.notEqual(res.body?.error, 'destination hors liste blanche', 'la liste blanche refuse ses propres entrées');
  });
});

describe('graphql-introspection · introspection et coût', () => {
  it('ne sert plus le schéma par introspection', async () => {
    const token = await devToken();
    const res = await gql('{ __schema { types { name } } }', token);
    assert.ok(
      refused(res.status) || !res.body?.data?.__schema,
      'le schéma complet est encore servi par introspection',
    );
  });

  it('refuse une requête profondément imbriquée', async () => {
    const token = await devToken();
    let inner = 'note';
    for (let i = 0; i < 7; i++) inner = `owner { invoices { ${inner} } }`;
    const res = await gql(`{ invoices { ${inner} } }`, token);
    assert.ok(
      refused(res.status) || (res.body?.errors?.length ?? 0) > 0,
      'une requête de profondeur 16 a été exécutée sans budget ni limite',
    );
  });

  it('exécute toujours une requête ordinaire', async () => {
    const token = await devToken();
    const res = await gql('{ me { email } }', token);
    assert.equal(res.status, 200, `une requête ordinaire est refusée — HTTP ${res.status}`);
    assert.equal(
      (res.body?.data as { me?: { email?: string } })?.me?.email,
      'dev@acme.example',
      'la requête ordinaire ne renvoie plus les données attendues',
    );
  });
});

describe('graphql-clairvoyance · suggestions et champs internes', () => {
  it('ne suggère plus le nom d’un champ absent du schéma public', async () => {
    const token = await devToken();
    const res = await gql('{ invoices { internalMarg } }', token);
    assert.ok(
      !res.text.includes('internalMargin'),
      'le message d’erreur nomme le champ interne : le schéma se reconstruit à coups de fautes de frappe',
    );
  });

  it('refuse la sélection d’un champ interne', async () => {
    const token = await devToken();
    const res = await gql('{ invoices { ref internalMargin } }', token);
    assert.ok(
      refused(res.status) || (res.body?.errors?.length ?? 0) > 0,
      'un champ interne a été résolu pour un client',
    );
  });

  it('sert toujours les champs publics', async () => {
    const token = await devToken();
    const res = await gql('{ invoices { ref client } }', token);
    assert.equal(res.status, 200, `les champs publics sont refusés — HTTP ${res.status}`);
    assert.ok(Array.isArray(res.body?.data?.invoices), 'la liste des factures n’est plus servie');
  });
});

describe('graphql-csrf · type de contenu du point d’accès', () => {
  const READ = '{ me { billingAddress } }';
  const address = async (token: string) =>
    ((await gql(READ, token)).body?.data as { me?: { billingAddress?: string } })?.me?.billingAddress;

  it('refuse une mutation envoyée en formulaire encodé', async () => {
    const token = await devToken();
    const before = await address(token);
    const res = await gql('', token, FORM_CT, `query=${encodeURIComponent('mutation{setBillingAddress(address:"1 rue de l Attaquant"){billingAddress}}')}`);
    assert.ok(refused(res.status), `mutation en formulaire encodé acceptée — HTTP ${res.status}`);
    assert.equal(await address(token), before, 'l’adresse de facturation a été changée depuis une requête simple');
  });

  it('accepte toujours la mutation en JSON', async () => {
    const token = await devToken();
    const res = await gql('mutation{setBillingAddress(address:"9 quai Légitime"){billingAddress}}', token);
    assert.equal(res.status, 200, `la mutation légitime est refusée — HTTP ${res.status}`);
    assert.equal(await address(token), '9 quai Légitime', 'la mutation légitime ne change plus rien');
  });
});

describe('graphql-batching · la limite compte la mauvaise unité', () => {
  it('refuse des centaines d’opérations dans une seule requête', async () => {
    const token = await devToken();
    const aliases = Array.from({ length: 200 }, (_, i) => `a${i}:verifyCode(code:"${String(i).padStart(4, '0')}"){ok}`);
    const res = await gql(`mutation{${aliases.join(' ')}}`, token);
    assert.ok(
      refused(res.status) || (res.body?.errors?.length ?? 0) > 0,
      '200 vérifications de code ont été exécutées dans une seule requête HTTP',
    );
  });

  it('vérifie toujours un code, une opération à la fois', async () => {
    const token = await devToken();
    const res = await gql('mutation{verifyCode(code:"0000"){ok}}', token);
    assert.equal(res.status, 200, `la vérification légitime est refusée — HTTP ${res.status}`);
    assert.ok(
      (res.body?.data as { verifyCode?: { ok?: string } })?.verifyCode?.ok !== undefined,
      'la vérification de code ne répond plus',
    );
  });
});

// ═══ M4 ═════════════════════════════════════════════════════════════════════

describe('cors-origin-reflection & cors-null-origin · liste d’origines', () => {
  it('ne reflète pas une origine inconnue', async () => {
    const token = await devToken();
    const res = await call('/invoices', { token, headers: { Origin: 'http://evil.example' } });
    assert.notEqual(
      res.headers.get('access-control-allow-origin'),
      'http://evil.example',
      'l’origine de la requête est recopiée dans Access-Control-Allow-Origin',
    );
  });

  it('n’autorise pas l’origine null', async () => {
    const token = await devToken();
    const res = await call('/invoices', { token, headers: { Origin: 'null' } });
    assert.notEqual(
      res.headers.get('access-control-allow-origin'),
      'null',
      '`null` figure encore dans la liste des origines autorisées',
    );
  });

  it('autorise toujours l’origine de l’application', async () => {
    const token = await devToken();
    const res = await call('/invoices', { token, headers: { Origin: 'http://127.0.0.1:5199' } });
    assert.equal(res.status, 200, `l’application ne peut plus appeler son API — HTTP ${res.status}`);
    assert.equal(
      res.headers.get('access-control-allow-origin'),
      'http://127.0.0.1:5199',
      'l’origine de l’application n’est plus autorisée : le cas légitime est cassé',
    );
  });
});

describe('csp-nonce-reuse · nonce tiré par réponse', () => {
  const nonceOf = (policy: string) => /'nonce-([^']+)'/.exec(policy)?.[1] ?? null;

  it('ne réutilise pas le même nonce d’une réponse à l’autre', async () => {
    const first = nonceOf(await csp());
    const second = nonceOf(await csp());
    assert.ok(first && second, 'la CSP ne déclare plus de nonce');
    assert.notEqual(first, second, 'le nonce est constant : c’est un unsafe-inline qui se cache');
  });

  it('sert toujours une CSP qui autorise les scripts de l’application', async () => {
    const policy = await csp();
    assert.match(policy, /script-src/, 'la CSP ne déclare plus de script-src');
  });
});

describe('csp-gadget · origines autorisées en bloc', () => {
  it('n’autorise plus un répertoire de bibliothèques ni l’évaluation dynamique', async () => {
    const policy = await csp();
    const scriptSrc = /script-src([^;]*)/.exec(policy)?.[1] ?? '';
    assert.ok(!scriptSrc.includes('/api/vendor/'), 'script-src autorise encore un répertoire entier');
    assert.ok(!scriptSrc.includes("'unsafe-eval'"), "script-src conserve 'unsafe-eval' : le gadget garde de quoi exécuter");
  });

  it('garde une CSP à nonce, donc une application qui fonctionne', async () => {
    const policy = await csp();
    assert.match(policy, /'nonce-/, 'la CSP n’a plus de nonce : plus aucun script de l’application ne passe');
  });
});

describe('clickjacking & clickjacking-prefilled · encadrement', () => {
  it('interdit l’encadrement par frame-ancestors', async () => {
    const policy = await csp();
    const directive = /frame-ancestors([^;]*)/.exec(policy)?.[1]?.trim() ?? '';
    assert.ok(directive.length > 0, 'la CSP ne déclare aucun frame-ancestors');
    assert.ok(!directive.includes('*'), `frame-ancestors est permissif : « ${directive} »`);
  });

  it('ne pré-remplit plus le champ IBAN depuis l’URL', async () => {
    const cookie = await surfaceCookie();
    const res = await call('/billing?iban=FR7699999999999999999999999', { headers: { Cookie: cookie } });
    assert.ok(
      !res.text.includes('FR7699999999999999999999999'),
      'la valeur de l’URL est recopiée dans le champ sensible',
    );
  });

  it('sert toujours les pages de facturation et de paiement', async () => {
    const cookie = await surfaceCookie();
    for (const path of ['/billing', '/pay/confirm']) {
      const res = await call(path, { headers: { Cookie: cookie } });
      assert.equal(res.status, 200, `${path} ne répond plus — HTTP ${res.status}`);
    }
  });
});

describe('samesite-method-override · surcharge de méthode', () => {
  it('ne mute rien sur une navigation GET', async () => {
    const cookie = await surfaceCookie();
    await setIbanLegitimately(cookie, 'FR7630004000031234567890143');
    // Une navigation de premier niveau : pas de type de contenu, un Accept de
    // document. C'est tout ce dont dispose un lien sur un site tiers.
    await fetch(`${API}/billing/iban?_method=POST&iban=FR7600000000000000000000000`, {
      headers: { Cookie: cookie, Accept: 'text/html' },
      redirect: 'manual',
    });
    assert.equal(
      await readIban(cookie),
      'FR7630004000031234567890143',
      'une navigation GET a exécuté une mutation',
    );
  });

  it('laisse la consultation en GET fonctionner', async () => {
    const cookie = await surfaceCookie();
    const res = await call<{ iban?: string }>('/billing/iban', { headers: { Cookie: cookie } });
    assert.equal(res.status, 200, `la consultation des coordonnées bancaires ne marche plus — HTTP ${res.status}`);
    assert.ok(res.body?.iban, 'la consultation ne renvoie plus d’IBAN');
  });
});

describe('referrer-leak · secret dans l’URL', () => {
  it('déclare une politique de référent restrictive', async () => {
    const policy = (await call('/health')).headers.get('referrer-policy') ?? '';
    assert.ok(policy.length > 0, 'aucune politique de référent n’est déclarée');
    assert.ok(
      !['unsafe-url', 'no-referrer-when-downgrade', 'origin-when-cross-origin'].includes(policy),
      `Referrer-Policy: ${policy} laisse partir l’URL complète`,
    );
  });

  it('ne laisse plus de jeton dans l’URL de la page publique', async () => {
    const token = await devToken();
    const share = await call<{ link: string; token: string }>('/surface/share?invoice=INV-1001', { token });
    assert.equal(share.status, 200, 'le partage de facture ne marche plus');
    // On suit la redirection comme un navigateur : en reportant le cookie que
    // la réponse a posé.
    const origin = new URL(API).origin;
    let res = await fetch(`${origin}${share.body.link}`, { redirect: 'manual' });
    let body = await res.text();
    let finalUrl = `${origin}${share.body.link}`;
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location') ?? '';
      const cookie = (res.headers.get('set-cookie') ?? '').split(';')[0];
      finalUrl = new URL(location, finalUrl).toString();
      res = await fetch(finalUrl, { headers: cookie ? { Cookie: cookie } : {} });
      body = await res.text();
    }
    assert.ok(!finalUrl.includes(share.body.token), `le jeton reste dans l’URL de la page : ${finalUrl}`);
    assert.ok(body.includes('INV-1001'), 'le lien public ne montre plus la facture : le cas légitime est cassé');
  });
});

describe('xsleak-frame-count · comptage de cadres', () => {
  const frames = (html: string) => (html.match(/<iframe/g) ?? []).length;

  it('rend un nombre de cadres indépendant du nombre de résultats', async () => {
    const cookie = await surfaceCookie();
    const hit = await call('/surface/clients?q=Dupont', { headers: { Cookie: cookie } });
    const miss = await call('/surface/clients?q=zzzzzzzz', { headers: { Cookie: cookie } });
    assert.equal(
      frames(hit.text),
      frames(miss.text),
      `le nombre de cadres révèle le nombre de résultats (${frames(hit.text)} contre ${frames(miss.text)})`,
    );
  });

  it('isole la fenêtre par Cross-Origin-Opener-Policy', async () => {
    const coop = (await call('/health')).headers.get('cross-origin-opener-policy');
    assert.equal(coop, 'same-origin', `COOP absent ou trop permissif : ${coop}`);
  });

  it('rend toujours la page de recherche', async () => {
    const cookie = await surfaceCookie();
    const res = await call('/surface/clients?q=Dupont', { headers: { Cookie: cookie } });
    assert.equal(res.status, 200, `la recherche de clients ne répond plus — HTTP ${res.status}`);
    assert.ok(res.text.includes('Dupont'), 'la recherche n’affiche plus la requête');
  });
});

describe('xsleak-error-events · réponses discernables', () => {
  it('répond de la même façon que la ressource existe ou non', async () => {
    const headers = { 'Sec-Fetch-Site': 'cross-site', 'Sec-Fetch-Dest': 'image' };
    const exists = await call('/surface/invoice-asset/INV-1003', { headers });
    const absent = await call('/surface/invoice-asset/INV-9999', { headers });
    assert.equal(
      exists.status,
      absent.status,
      `l’existence d’une facture se lit dans le code de réponse (${exists.status} contre ${absent.status})`,
    );
    assert.equal(exists.text.length, absent.text.length, 'la taille de la réponse révèle l’existence de la facture');
  });

  it('interdit le chargement inter-origines par Cross-Origin-Resource-Policy', async () => {
    const corp = (await call('/health')).headers.get('cross-origin-resource-policy');
    assert.equal(corp, 'same-origin', `CORP absent ou trop permissif : ${corp}`);
  });

  it('sert toujours la ressource à l’application', async () => {
    const res = await call('/surface/invoice-asset/INV-1001', { headers: { 'Sec-Fetch-Site': 'same-origin' } });
    assert.equal(res.status, 200, `la ressource n’est plus servie — HTTP ${res.status}`);
    assert.match(res.headers.get('content-type') ?? '', /image\//, 'la ressource n’est plus une image');
  });
});

// ═══ M17 ════════════════════════════════════════════════════════════════════

describe('debug-endpoint · route de diagnostic', () => {
  it('ne sert plus la configuration sans authentification', async () => {
    const res = await call('/debug/config');
    assert.ok(refused(res.status), `la configuration est servie sans authentification — HTTP ${res.status}`);
  });

  it('sert toujours la route de santé', async () => {
    const res = await call<{ ok: boolean }>('/health');
    assert.equal(res.status, 200, 'la route de santé a disparu avec la route de diagnostic');
    assert.equal(res.body.ok, true);
  });
});

// ═══ Contrôles statiques : ce qui se joue dans le navigateur ════════════════
//
// readCode() retire les commentaires : une phrase qui décrit le correctif ne
// fait pas passer le test.

describe('react-javascript-url · schéma de l’URL de paiement', () => {
  const code = () => readCode('src/pages/InvoiceDetail.tsx');

  it('valide le schéma de l’URL avant de la rendre', () => {
    const src = code();
    assert.match(src, /new URL\(/, 'aucune URL n’est analysée avant d’être rendue');
    assert.match(src, /protocol/, 'le schéma de l’URL n’est jamais examiné');
    assert.match(src, /https:/, 'aucune liste de schémas autorisés');
  });

  it('ne rend jamais directement une valeur d’URL non validée', () => {
    const src = code();
    assert.ok(
      !/href=\{\s*(search\.get|paymentUrl)\b/.test(src),
      'une valeur venue de l’URL part directement dans un attribut href',
    );
  });

  it('garde le lien de paiement', () => {
    assert.match(code(), /href=\{/, 'le lien de paiement a disparu : le cas légitime est cassé');
  });
});

describe('client-proto-pollution · fusion des préférences', () => {
  const code = () => readCode('src/api.ts');

  it('ne fusionne plus les clés spéciales dans un objet à prototype', () => {
    const src = code();
    assert.ok(
      /Object\.create\(null\)/.test(src) || /['"]__proto__['"]/.test(src),
      'la fusion des préférences n’écarte ni le prototype ni les clés spéciales',
    );
  });

  it('ne transforme plus une préférence en attribut arbitraire', () => {
    const src = code();
    const body = /export function presentationFor[\s\S]*?\n}/.exec(src)?.[0] ?? '';
    assert.ok(body.length > 0, 'presentationFor a disparu : le cas légitime est cassé');
    assert.ok(
      !/return\s+isObject\(/.test(body) && !/as Record<string, unknown>;\s*$/m.test(body.trim()),
      'presentationFor renvoie encore un objet d’attributs venu des préférences',
    );
  });

  it('garde les préférences d’affichage', () => {
    assert.match(code(), /export function loadPrefs/, 'les préférences d’affichage ont disparu');
  });
});

describe('dom-clobbering · base d’URL de l’API', () => {
  const code = () => readCode('src/api.ts');

  it('ne lit plus la configuration sur window', () => {
    const src = code();
    assert.ok(!/window\s*\.\s*novafactConfig/.test(src), 'la base d’URL est encore lue sur window');
    assert.ok(!/window\s+as\s+/.test(src), 'le code lit encore une propriété non déclarée de window');
  });

  it('déclare sa base d’URL', () => {
    assert.match(code(), /const\s+\w+\s*(:\s*string\s*)?=\s*['"]\/api['"]/, 'aucune base d’URL déclarée dans le module');
  });

  it('garde le client HTTP', () => {
    assert.match(code(), /export async function api</, 'le client HTTP a disparu : le cas légitime est cassé');
  });
});

describe('secret-in-bundle · clé livrée au navigateur', () => {
  const code = () => readCode('src/api.ts');

  it('ne livre plus de clé d’API dans le bundle', () => {
    const src = code();
    assert.ok(!/nvf_live_pk_/.test(src), 'la clé d’API est encore écrite en clair dans le code client');
    assert.ok(!/VITE_\w*KEY/.test(src), 'une variable d’environnement publique porte encore un secret');
    assert.ok(!/X-Novafact-Key/i.test(src), 'le client envoie encore la clé depuis le navigateur');
  });

  it('garde le ping d’audience', () => {
    assert.match(code(), /export function pingAnalytics/, 'le ping d’audience a disparu : le cas légitime est cassé');
  });
});

describe('trusted-types-default · politique par défaut', () => {
  const code = () => readCode('src/main.tsx');

  it('ne rend plus l’identité dans la politique par défaut', () => {
    const src = code();
    const identityForms = [
      /createHTML\s*:\s*identity/,
      /createHTML\s*:\s*\(\s*(\w+)(\s*:\s*string)?\s*\)\s*=>\s*\1\s*[,})]/,
      /createHTML\s*\(\s*(\w+)[^)]*\)\s*\{\s*return\s+\1\s*;?\s*\}/,
    ];
    for (const form of identityForms) {
      assert.ok(!form.test(src), `la politique par défaut rend encore son entrée telle quelle (${form})`);
    }
  });

  it('installe toujours une politique Trusted Types', () => {
    assert.match(code(), /createPolicy\(/, 'plus aucune politique Trusted Types n’est installée');
  });
});

describe('postmessage-origin · contrôle d’origine du récepteur', () => {
  const code = () => readCode('src/pages/Checkout.tsx');

  it('vérifie l’origine avant d’agir sur un message', () => {
    const src = code();
    assert.match(src, /addEventListener\('message'/, 'la page n’écoute plus les messages : le cas légitime est cassé');
    assert.ok(
      /if\s*\([^)]*event\.origin/.test(src),
      'aucune condition ne porte sur event.origin : la forme du message suffit encore',
    );
  });

  it('ne transmet plus une confirmation de paiement venue du navigateur', () => {
    assert.ok(
      !/payment-callback/.test(code()),
      'un message du navigateur déclenche encore une confirmation de paiement côté serveur',
    );
  });
});

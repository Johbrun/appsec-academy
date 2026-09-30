// Corpus d'authentification : bourrage d'identifiants, pulvérisage, réponse
// graduée, caviardage, champs à normaliser.
//
// Chaque leurre est là pour casser une règle naïve précise, et c'est ce qui
// fait l'exercice :
//
//   le test de charge         casse la règle qui ne compte que les échecs
//   l'application mobile      casse la règle qui ne compte que les échecs
//   la passerelle SSO         casse la règle sans fenêtre
//   la suite d'intégration    casse la règle qui ne compte que les comptes
//   l'utilisateur maladroit   casse la règle au seuil trop bas

import {
  BASE, UA_BROWSER, accountPool, authEvent, ipFactory, nextId, iso, publicIp, privateIp,
  resetIds, rng, webEvent, writeCorpus,
} from './lib.mjs';

const UA_K6 = 'k6/0.49.0 (https://k6.io/)';
const UA_MOBILE = 'Novafact/3.2.1 (iOS 18.3; iPhone15,2)';
const UA_E2E = 'novafact-e2e/1.4 (playwright)';
const UA_PROBE = 'novafact-healthcheck/1.0';

const fail = (o) => authEvent({ ...o, action: 'authn_login_fail', outcome: 'failure', status: 401 });
const ok = (o) => authEvent({ ...o, action: 'authn_login_success', outcome: 'success', status: 200 });

const MIN = 60_000;

/**
 * Le corpus de bourrage d'identifiants.
 *
 * `variant` règle la difficulté : `easy` se sépare parfaitement, `hard` ajoute
 * trois attaques discrètes et un test d'intrusion autorisé qui se comporte
 * exactement comme une attaque — la séparation parfaite devient impossible, et
 * c'est là que le réglage de seuil commence.
 */
export function makeCs(seed, variant, prefixId) {
  const r = rng(seed);
  const newIp = ipFactory(r);
  resetIds(prefixId);
  const events = [];
  const cases = [];
  const pool = accountPool(r, 600);
  const add = (id, malicious, label) => cases.push({ id, malicious, label });

  // ── Douze bourrages d'identifiants ────────────────────────────────────────
  for (let i = 1; i <= 12; i += 1) {
    const id = `attaque-${String(i).padStart(2, '0')}`;
    add(id, true, `l’attaque n°${i}`);
    const ip = newIp();
    const n = r.int(34, 48);
    const start = BASE + r.int(0, 150) * MIN;
    const span = r.int(4, 8) * MIN;
    const users = r.shuffle(pool).slice(0, n);
    for (let k = 0; k < n; k += 1) {
      const ts = start + (k / n) * span + r.int(0, 1500);
      const hit = k > 3 && r.next() < 0.02;
      events.push((hit ? ok : fail)({ ts, user: users[k], ip, ua: r.pick(UA_BROWSER), caseId: id }));
    }
  }

  if (variant === 'hard') {
    // Trois attaques discrètes : juste sous le seuil évident.
    const volumes = [20, 21, 22];
    for (const [i, n] of volumes.entries()) {
      const id = `attaque-discrete-${i + 1}`;
      add(id, true, `l’attaque discrète n°${i + 1}`);
      const ip = newIp();
      const start = BASE + r.int(10, 140) * MIN;
      const users = r.shuffle(pool).slice(0, n);
      for (let k = 0; k < n; k += 1) {
        events.push(fail({
          ts: start + (k / n) * 9 * MIN + r.int(0, 2000),
          user: users[k], ip, ua: r.pick(UA_BROWSER), caseId: id,
        }));
      }
    }
    // Le test d'intrusion autorisé : même comportement qu'une attaque. Aucune
    // règle ne peut l'écarter — c'est le faux positif qu'on assume.
    const id = 'pentest-autorise';
    add(id, false, 'le test d’intrusion autorisé par le client');
    const ip = newIp();
    const start = BASE + 95 * MIN;
    const users = r.shuffle(pool).slice(0, 70);
    for (let k = 0; k < 70; k += 1) {
      events.push(fail({
        ts: start + (k / 70) * 6 * MIN + r.int(0, 1500),
        user: users[k], ip, ua: 'BurpSuite/2025.2', caseId: id,
      }));
    }
  }

  // ── Deux tests de charge ──────────────────────────────────────────────────
  for (let i = 1; i <= 2; i += 1) {
    const id = `test-de-charge-${i}`;
    add(id, false, 'le test de charge');
    const ip = newIp();
    const start = BASE + r.int(20, 120) * MIN;
    for (let k = 0; k < 120; k += 1) {
      events.push(fail({
        ts: start + (k / 120) * 12 * MIN + r.int(0, 800),
        user: 'loadtest@novafact.example', ip, ua: UA_K6, caseId: id,
      }));
    }
  }

  // ── Trois passerelles SSO ─────────────────────────────────────────────────
  for (let i = 1; i <= 3; i += 1) {
    const id = `passerelle-sso-${i}`;
    add(id, false, 'la passerelle SSO du client');
    const ip = newIp();
    const users = r.shuffle(pool).slice(0, 150);
    for (let k = 0; k < 160; k += 1) {
      const ts = BASE + (k / 160) * 170 * MIN + r.int(0, 20_000);
      const bad = r.next() < 0.2; // fautes de frappe : réparties sur trois heures
      events.push((bad ? fail : ok)({ ts, user: users[k % users.length], ip, ua: r.pick(UA_BROWSER), caseId: id }));
    }
  }

  // ── Dix applications mobiles qui réessaient ───────────────────────────────
  for (let i = 1; i <= 10; i += 1) {
    const id = `mobile-${String(i).padStart(2, '0')}`;
    add(id, false, 'l’application mobile qui réessaie avec un jeton périmé');
    const ip = newIp();
    const user = pool[r.int(0, pool.length - 1)];
    const n = r.int(22, 30);
    const start = BASE + r.int(0, 150) * MIN;
    for (let k = 0; k < n; k += 1) {
      events.push(fail({ ts: start + k * 25_000 + r.int(0, 4000), user, ip, ua: UA_MOBILE, caseId: id }));
    }
  }

  // ── Quinze utilisateurs maladroits ────────────────────────────────────────
  for (let i = 1; i <= 15; i += 1) {
    const id = `maladroit-${String(i).padStart(2, '0')}`;
    add(id, false, 'un utilisateur qui se trompe de mot de passe');
    const ip = newIp();
    const user = pool[r.int(0, pool.length - 1)];
    const ua = r.pick(UA_BROWSER);
    const start = BASE + r.int(0, 165) * MIN;
    const n = r.int(2, 5);
    for (let k = 0; k < n; k += 1) events.push(fail({ ts: start + k * 35_000, user, ip, ua, caseId: id }));
    events.push(ok({ ts: start + n * 35_000 + 12_000, user, ip, ua, caseId: id }));
  }

  // ── Cinq mots de passe oubliés ────────────────────────────────────────────
  for (let i = 1; i <= 5; i += 1) {
    const id = `oubli-${i}`;
    add(id, false, 'une procédure de mot de passe oublié');
    const ip = newIp();
    const user = pool[r.int(0, pool.length - 1)];
    const ua = r.pick(UA_BROWSER);
    const start = BASE + r.int(0, 130) * MIN;
    const n = r.int(6, 9);
    for (let k = 0; k < n; k += 1) {
      events.push(fail({ ts: start + (k / n) * 40 * MIN + r.int(0, 9000), user, ip, ua, caseId: id }));
    }
    events.push(authEvent({
      ts: start + 42 * MIN, action: 'authn_password_change', outcome: 'success',
      user, ip, ua, status: 200, caseId: id,
    }));
  }

  // ── Trois sondes de supervision ───────────────────────────────────────────
  for (let i = 1; i <= 3; i += 1) {
    const id = `sonde-${i}`;
    add(id, false, 'une sonde de supervision');
    const ip = newIp(true);
    for (let k = 0; k < 45; k += 1) {
      const bad = r.next() < 0.05;
      events.push((bad ? fail : ok)({
        ts: BASE + k * 4 * MIN + r.int(0, 3000),
        user: 'healthcheck@novafact.example', ip, ua: UA_PROBE, caseId: id,
      }));
    }
  }

  // ── Deux suites d'intégration nocturnes ───────────────────────────────────
  for (let i = 1; i <= 2; i += 1) {
    const id = `integration-${i}`;
    add(id, false, 'la suite d’intégration qui teste le chemin d’échec');
    const ip = newIp(true);
    const users = Array.from({ length: 15 }, (_, k) => `svc-e2e-${k + 1}@novafact.example`);
    for (let run = 0; run < 3; run += 1) {
      const start = BASE + (20 + run * 50 + i * 7) * MIN;
      for (const [k, user] of users.entries()) {
        events.push(fail({ ts: start + k * 30_000, user, ip, ua: UA_E2E, caseId: id }));
      }
    }
  }

  return { events, cases };
}

/** Le corpus de pulvérisage : un échec par compte, sur des centaines de comptes. */
export function makeSpray(seed, prefixId) {
  const r = rng(seed);
  const newIp = ipFactory(r);
  resetIds(prefixId);
  const events = [];
  const cases = [];
  const pool = accountPool(r, 600);
  const add = (id, malicious, label) => cases.push({ id, malicious, label });

  for (let i = 1; i <= 6; i += 1) {
    const id = `pulverisage-${i}`;
    add(id, true, `le pulvérisage n°${i}`);
    const ip = newIp();
    const n = r.int(95, 130);
    const start = BASE + r.int(0, 120) * MIN;
    const span = r.int(25, 45) * MIN;
    const users = r.shuffle(pool).slice(0, n);
    for (let k = 0; k < n; k += 1) {
      events.push(fail({ ts: start + (k / n) * span + r.int(0, 2500), user: users[k], ip, ua: r.pick(UA_BROWSER), caseId: id }));
    }
  }

  for (let i = 1; i <= 3; i += 1) {
    const id = `mobile-${i}`;
    add(id, false, 'un client mobile bloqué sur un jeton périmé');
    const ip = newIp();
    const user = pool[r.int(0, pool.length - 1)];
    for (let k = 0; k < 120; k += 1) {
      events.push(fail({ ts: BASE + r.int(0, 60) * MIN + k * 6000, user, ip, ua: UA_MOBILE, caseId: id }));
    }
  }

  for (let i = 1; i <= 2; i += 1) {
    const id = `integration-cassee-${i}`;
    add(id, false, 'une intégration cassée qui martèle huit comptes de service');
    const ip = newIp(true);
    const users = Array.from({ length: 8 }, (_, k) => `svc-${k + 1}@novafact.example`);
    const start = BASE + r.int(0, 90) * MIN;
    for (let k = 0; k < 120; k += 1) {
      events.push(fail({ ts: start + k * 9000, user: users[k % 8], ip, ua: UA_E2E, caseId: id }));
    }
  }

  for (let i = 1; i <= 25; i += 1) {
    const id = `isole-${String(i).padStart(2, '0')}`;
    add(id, false, 'un échec isolé d’utilisateur');
    const ip = newIp();
    const user = pool[r.int(0, pool.length - 1)];
    const ua = r.pick(UA_BROWSER);
    const start = BASE + r.int(0, 170) * MIN;
    for (let k = 0; k < r.int(1, 3); k += 1) events.push(fail({ ts: start + k * 40_000, user, ip, ua, caseId: id }));
    events.push(ok({ ts: start + 3 * MIN, user, ip, ua, caseId: id }));
  }

  for (let i = 1; i <= 2; i += 1) {
    const id = `passerelle-sso-${i}`;
    add(id, false, 'la passerelle SSO du client');
    const ip = newIp();
    const users = r.shuffle(pool).slice(0, 120);
    for (let k = 0; k < 120; k += 1) {
      const bad = r.next() < 0.12;
      events.push((bad ? fail : ok)({
        ts: BASE + (k / 120) * 170 * MIN + r.int(0, 20_000),
        user: users[k], ip, ua: r.pick(UA_BROWSER), caseId: id,
      }));
    }
  }

  const id = 'test-de-charge';
  add(id, false, 'le test de charge');
  const ip = newIp();
  for (let k = 0; k < 180; k += 1) {
    events.push(fail({ ts: BASE + 40 * MIN + k * 3000, user: 'loadtest@novafact.example', ip, ua: UA_K6, caseId: id }));
  }

  return { events, cases };
}

/**
 * Le corpus de la réponse graduée.
 *
 * Les paliers attendus sont publiés avec le corpus : ce n'est pas une devinette,
 * c'est une spécification. Le travail est de trouver l'axe d'agrégation, la
 * fenêtre et les quatre seuils qui la réalisent — et qui ne verrouillent pas le
 * bureau partagé.
 */
export function makeGraduated(seed) {
  const r = rng(seed);
  const newIp = ipFactory(r);
  resetIds('g');
  const events = [];
  const cases = [];
  const expected = {};
  const pool = accountPool(r, 400);
  const add = (id, label, stage) => {
    cases.push({ id, malicious: stage === 'verrouillage', label });
    expected[id] = stage;
  };

  for (let i = 1; i <= 3; i += 1) {
    const id = `attaquant-${i}`;
    add(id, 'un bourrage d’identifiants', 'verrouillage');
    const ip = newIp();
    const users = r.shuffle(pool).slice(0, 80);
    const start = BASE + r.int(0, 120) * MIN;
    for (let k = 0; k < 80; k += 1) {
      events.push(fail({ ts: start + (k / 80) * 6 * MIN + r.int(0, 1200), user: users[k], ip, ua: r.pick(UA_BROWSER), caseId: id }));
    }
  }

  for (let i = 1; i <= 2; i += 1) {
    const id = `integration-cassee-${i}`;
    add(id, 'une intégration cassée sur un compte de service', 'ralentissement');
    const ip = newIp(true);
    const start = BASE + r.int(0, 140) * MIN;
    for (let k = 0; k < 40; k += 1) {
      events.push(fail({ ts: start + k * 14_000, user: `svc-factures-${i}@novafact.example`, ip, ua: UA_E2E, caseId: id }));
    }
  }

  for (let i = 1; i <= 4; i += 1) {
    const id = `oubli-${i}`;
    add(id, 'un mot de passe oublié', 'alerte');
    const ip = newIp();
    const user = pool[r.int(0, pool.length - 1)];
    const ua = r.pick(UA_BROWSER);
    const start = BASE + r.int(0, 150) * MIN;
    for (let k = 0; k < 12; k += 1) events.push(fail({ ts: start + k * 55_000, user, ip, ua, caseId: id }));
  }

  for (let i = 1; i <= 8; i += 1) {
    const id = `maladroit-${i}`;
    add(id, 'un client qui se trompe puis se connecte', 'trace');
    const ip = newIp();
    const user = pool[r.int(0, pool.length - 1)];
    const ua = r.pick(UA_BROWSER);
    const start = BASE + r.int(0, 160) * MIN;
    for (let k = 0; k < r.int(3, 4); k += 1) events.push(fail({ ts: start + k * 30_000, user, ip, ua, caseId: id }));
    events.push(ok({ ts: start + 3 * MIN, user, ip, ua, caseId: id }));
  }

  for (let i = 1; i <= 2; i += 1) {
    const id = `bureau-partage-${i}`;
    add(id, 'un bureau partagé derrière une seule adresse', 'aucun');
    const ip = newIp();
    const users = r.shuffle(pool).slice(0, 12);
    for (let k = 0; k < 12; k += 1) {
      const ua = r.pick(UA_BROWSER);
      events.push(fail({ ts: BASE + (k / 12) * 150 * MIN + r.int(0, 60_000), user: users[k], ip, ua, caseId: id }));
      events.push(ok({ ts: BASE + (k / 12) * 150 * MIN + 90_000, user: users[k], ip, ua, caseId: id }));
    }
  }

  return { events, cases, expected };
}

/**
 * Un corpus d'authentification réduit, réutilisé par deux challenges : le
 * caviardage (où il porte des secrets) et la normalisation des champs (où il
 * est émis avec les mauvais noms). Même vérité terrain, même règle de
 * référence — c'est ce qui permet de vérifier qu'une transformation n'a pas
 * détruit le signal.
 */
export function makeSmallCs(seed, prefixId) {
  const r = rng(seed);
  const newIp = ipFactory(r);
  resetIds(prefixId);
  const events = [];
  const cases = [];
  const pool = accountPool(r, 300);
  const add = (id, malicious, label) => cases.push({ id, malicious, label });

  for (let i = 1; i <= 12; i += 1) {
    const id = `attaque-${String(i).padStart(2, '0')}`;
    add(id, true, `l’attaque n°${i}`);
    const ip = newIp();
    const n = r.int(19, 24);
    const start = BASE + r.int(0, 140) * MIN;
    const users = r.shuffle(pool).slice(0, n);
    for (let k = 0; k < n; k += 1) {
      events.push(fail({ ts: start + (k / n) * 5 * MIN + r.int(0, 1200), user: users[k], ip, ua: r.pick(UA_BROWSER), caseId: id }));
    }
  }
  for (let i = 1; i <= 2; i += 1) {
    const id = `test-de-charge-${i}`;
    add(id, false, 'le test de charge');
    const ip = newIp();
    const start = BASE + r.int(10, 120) * MIN;
    for (let k = 0; k < 80; k += 1) {
      events.push(fail({ ts: start + k * 4000, user: 'loadtest@novafact.example', ip, ua: UA_K6, caseId: id }));
    }
  }
  for (let i = 1; i <= 2; i += 1) {
    const id = `passerelle-sso-${i}`;
    add(id, false, 'la passerelle SSO du client');
    const ip = newIp();
    const users = r.shuffle(pool).slice(0, 80);
    for (let k = 0; k < 80; k += 1) {
      const bad = r.next() < 0.2;
      events.push((bad ? fail : ok)({
        ts: BASE + (k / 80) * 170 * MIN + r.int(0, 20_000),
        user: users[k], ip, ua: r.pick(UA_BROWSER), caseId: id,
      }));
    }
  }
  for (let i = 1; i <= 5; i += 1) {
    const id = `mobile-${i}`;
    add(id, false, 'l’application mobile qui réessaie');
    const ip = newIp();
    const user = pool[r.int(0, pool.length - 1)];
    const start = BASE + r.int(0, 150) * MIN;
    for (let k = 0; k < 15; k += 1) events.push(fail({ ts: start + k * 30_000, user, ip, ua: UA_MOBILE, caseId: id }));
  }
  // Deux leurres que seule la normalisation correcte écarte : ils ne sont
  // distingués que par le résultat, l'action et la méthode. Une correspondance
  // qui pose ces champs en dur les fait tous les deux passer pour des échecs
  // de connexion, et la règle fournie se met à lever sur eux.
  for (let i = 1; i <= 3; i += 1) {
    const id = `rush-matinal-${i}`;
    add(id, false, 'la vague de connexions réussies du matin');
    const ip = newIp();
    const users = r.shuffle(pool).slice(0, 30);
    const start = BASE + r.int(0, 30) * MIN;
    for (let k = 0; k < 30; k += 1) {
      events.push(ok({ ts: start + (k / 30) * 6 * MIN + r.int(0, 2000), user: users[k], ip, ua: r.pick(UA_BROWSER), caseId: id }));
    }
  }
  for (let i = 1; i <= 3; i += 1) {
    const id = `sonde-de-session-${i}`;
    add(id, false, 'la vérification de session du client web');
    const ip = newIp();
    const users = r.shuffle(pool).slice(0, 20);
    const start = BASE + r.int(40, 150) * MIN;
    for (let k = 0; k < 20; k += 1) {
      events.push(webEvent({
        ts: start + (k / 20) * 5 * MIN + r.int(0, 2000),
        action: 'session_check', outcome: 'success', user: users[k], ip,
        ua: r.pick(UA_BROWSER), method: 'GET', path: '/api/session', status: 200, caseId: id,
      }));
    }
  }
  for (let i = 1; i <= 8; i += 1) {
    const id = `maladroit-${i}`;
    add(id, false, 'un utilisateur qui se trompe de mot de passe');
    const ip = newIp();
    const user = pool[r.int(0, pool.length - 1)];
    const ua = r.pick(UA_BROWSER);
    const start = BASE + r.int(0, 165) * MIN;
    for (let k = 0; k < r.int(2, 4); k += 1) events.push(fail({ ts: start + k * 35_000, user, ip, ua, caseId: id }));
    events.push(ok({ ts: start + 4 * MIN, user, ip, ua, caseId: id }));
  }
  return { events, cases };
}

// ── Caviardage ──────────────────────────────────────────────────────────────

const IBANS = ['FR7630006000011234567890189', 'FR1420041010050500013M02606', 'FR7630004000031234567890143'];
const PANS = ['4539578763621486', '5425233430109903', '4716224871234567'];

/** Le même corpus, mais journalisé comme on ne devrait jamais le faire. */
export function addSecrets(seed, corpus) {
  const r = rng(seed);
  const secrets = new Set();
  const events = corpus.events.map((ev, i) => {
    const password = r.pick(['Printemps2024!', 'Novafact2026', 'azerty123', 'Soleil!92', 'Facture$2025']);
    secrets.add(password);
    const token = `nvf_live_${String(r.int(0, 1e9)).padStart(9, '0')}${'abcdef'[i % 6]}`;
    secrets.add(token);
    const out = {
      ...ev,
      http: {
        ...ev.http,
        request: {
          ...ev.http.request,
          // Le corps entier journalisé « pour le support » : c'est le défaut.
          body: JSON.stringify({ email: ev.user.name, password, remember: true }),
          headers: { 'user-agent': ev.user_agent.original, authorization: `Bearer ${token}` },
        },
      },
    };
    if (i % 9 === 0) {
      const iban = r.pick(IBANS);
      const pan = r.pick(PANS);
      secrets.add(iban);
      secrets.add(pan);
      out.novafact = { iban, card_number: pan, reset_token: `nvf_rst_${String(r.int(0, 1e9)).padStart(9, '0')}` };
      secrets.add(out.novafact.reset_token);
    }
    if (i % 17 === 0) {
      out.user = { ...out.user, password };
    }
    return out;
  });
  return { events, cases: corpus.cases, secrets: [...secrets] };
}

// ── Champs à normaliser ─────────────────────────────────────────────────────

/** Le même corpus, émis par une application qui ignore le format normalisé. */
export function denormalise(corpus) {
  const NAMES = { authn_login_success: 'login_ok', authn_login_fail: 'login_failed' };
  return corpus.events.map((ev) => ({
    ts: ev['@timestamp'],
    evt: NAMES[ev.event.action] ?? ev.event.action,
    ok: ev.event.outcome === 'success',
    who: ev.user.name,
    ip: ev.source.ip,
    verb: ev.http.request.method.toLowerCase(),
    route: ev.url.path,
    agent: ev.user_agent.original,
    _case: ev._case,
  }));
}

export { writeCorpus, iso, nextId, BASE, MIN, publicIp, privateIp, UA_BROWSER, UA_K6, UA_MOBILE, UA_E2E, UA_PROBE, fail, ok };

// Corpus applicatifs : assistant, honeytokens, points de détection AppSensor,
// corpus avant/après correctif, journal d'incident, inventaire.

import {
  BASE, UA_BROWSER, accountPool, ipFactory, iso, nextId, publicIp, privateIp, resetIds, rng, webEvent,
} from './lib.mjs';

const MIN = 60_000;
const UA_MOBILE = 'Novafact/3.2.1 (iOS 18.3; iPhone15,2)';

const base = ({ ts, action, outcome, category, type, caseId, extra = {} }) => ({
  '@timestamp': iso(ts),
  event: {
    id: nextId(), kind: 'event', category, type, action, outcome,
    module: 'novafact', dataset: 'novafact.app',
  },
  ...extra,
  _case: caseId,
});

// ── L'assistant et ses appels d'outils ──────────────────────────────────────

export const INTERNAL_DOMAINS = ['novafact.example', 'novafact-internal.example'];
const CLIENT_DOMAINS = ['acme.example', 'globex.example', 'initech.example', 'dupont-fils.example'];

function toolCall({ ts, tool, origin, target, domain, user, ip, doc, caseId }) {
  return base({
    ts, action: 'tool_call', outcome: 'success', category: ['process'], type: ['info'], caseId,
    extra: {
      user: { name: user },
      source: { ip },
      destination: domain ? { domain } : undefined,
      novafact: {
        assistant: {
          tool,
          // Le champ qui rend l'injection indirecte détectable : d'où vient
          // l'instruction qui a déclenché l'appel.
          origin,
          target,
          ...(doc ? { source_document: doc } : {}),
        },
      },
      service: { name: 'novafact-assistant' },
    },
  });
}

export function makeAssistant(seed) {
  const r = rng(seed);
  resetIds('as');
  const events = [];
  const cases = [];
  const pool = accountPool(r, 60);
  const add = (id, malicious, label) => cases.push({ id, malicious, label });

  // Six appels dictés par un document et visant l'extérieur.
  const payloads = [
    { tool: 'send_mail', domain: 'evil.example' },
    { tool: 'send_mail', domain: 'collect.attacker.example' },
    { tool: 'http_fetch', domain: 'exfil.attacker.example' },
    { tool: 'send_mail', domain: 'pastebin.example' },
    { tool: 'http_fetch', domain: 'webhook.site.example' },
    { tool: 'send_mail', domain: 'attacker-mail.example' },
  ];
  for (const [i, p] of payloads.entries()) {
    const id = `injection-${i + 1}`;
    add(id, true, `l’injection indirecte n°${i + 1}`);
    const user = pool[i];
    const ip = publicIp(r);
    const ts = BASE + r.int(0, 150) * MIN;
    const doc = `INV-${1200 + i}`;
    // La question de l'utilisateur, légitime, précède l'appel dicté.
    events.push(toolCall({ ts, tool: 'read_invoice', origin: 'user', target: 'internal', user, ip, caseId: id }));
    events.push(toolCall({ ts: ts + 1400, ...p, origin: 'document', target: 'external', user, ip, doc, caseId: id }));
  }

  // Trente usages légitimes, dont douze qui sortent vraiment vers l'extérieur.
  let n = 0;
  const legit = (label, make) => {
    n += 1;
    const id = `legitime-${String(n).padStart(2, '0')}`;
    add(id, false, label);
    make(id);
  };
  for (let i = 0; i < 12; i += 1) {
    legit('un envoi de facture demandé par l’utilisateur', (id) => {
      const ts = BASE + r.int(0, 160) * MIN;
      const user = pool[r.int(0, pool.length - 1)];
      const ip = publicIp(r);
      events.push(toolCall({ ts, tool: 'read_invoice', origin: 'user', target: 'internal', user, ip, caseId: id }));
      events.push(toolCall({
        ts: ts + 900, tool: 'send_mail', origin: 'user', target: 'external',
        domain: r.pick(CLIENT_DOMAINS), user, ip, caseId: id,
      }));
    });
  }
  for (let i = 0; i < 8; i += 1) {
    legit('un résumé de facture, où le document ne demande que de la lecture', (id) => {
      const ts = BASE + r.int(0, 160) * MIN;
      const user = pool[r.int(0, pool.length - 1)];
      const ip = publicIp(r);
      events.push(toolCall({
        ts, tool: 'read_invoice', origin: 'document', target: 'internal',
        user, ip, doc: `INV-${1001 + i}`, caseId: id,
      }));
      events.push(toolCall({
        ts: ts + 700, tool: 'search_invoices', origin: 'document', target: 'internal',
        user, ip, doc: `INV-${1001 + i}`, caseId: id,
      }));
    });
  }
  for (let i = 0; i < 6; i += 1) {
    legit('une tâche planifiée qui écrit dans le système interne', (id) => {
      const ts = BASE + i * 25 * MIN;
      events.push(toolCall({
        ts, tool: 'create_credit_note', origin: 'system', target: 'internal',
        domain: INTERNAL_DOMAINS[0], user: 'scheduler@novafact.example', ip: privateIp(r), caseId: id,
      }));
    });
  }
  for (let i = 0; i < 4; i += 1) {
    legit('un appel à un partenaire approuvé, demandé par l’utilisateur', (id) => {
      const ts = BASE + r.int(0, 160) * MIN;
      events.push(toolCall({
        ts, tool: 'http_fetch', origin: 'user', target: 'external', domain: 'api.partenaire-compta.example',
        user: pool[r.int(0, pool.length - 1)], ip: publicIp(r), caseId: id,
      }));
    });
  }
  return { events, cases };
}

// ── Honeytokens ─────────────────────────────────────────────────────────────

export const HONEY = {
  path: '/api/admin/export-all',
  invoice: '/api/invoices/INV-9999',
  key: 'nvf_live_ht_7d2c91',
};

export function makeHoneytoken(seed) {
  const r = rng(seed);
  resetIds('ht');
  const events = [];
  const cases = [];
  const pool = accountPool(r, 80);
  const add = (id, malicious, label) => cases.push({ id, malicious, label });

  const req = ({ ts, user, ip, method, path: p, status, caseId, key }) => webEvent({
    ts, action: 'http_request', outcome: status < 400 ? 'success' : 'failure',
    user, ip, ua: r.pick(UA_BROWSER), method, path: p, status, caseId,
    extra: key ? { novafact: { api_key: { id: key } } } : {},
  });

  // Quatre accès aux leurres : rien de légitime ne les atteint jamais.
  const touches = [
    { p: HONEY.path, key: null, label: 'la route d’export total' },
    { p: HONEY.invoice, key: null, label: 'la facture leurre' },
    { p: '/api/invoices', key: HONEY.key, label: 'la clé d’API leurre' },
    { p: HONEY.path, key: HONEY.key, label: 'la route et la clé leurres' },
  ];
  for (const [i, t] of touches.entries()) {
    const id = `acces-leurre-${i + 1}`;
    add(id, true, `l’accès à ${t.label}`);
    const user = pool[r.int(0, pool.length - 1)];
    const ip = publicIp(r);
    const ts = BASE + r.int(10, 160) * MIN;
    events.push(req({ ts, user, ip, method: 'GET', path: '/api/invoices', status: 200, caseId: id }));
    events.push(req({ ts: ts + 5000, user, ip, method: 'GET', path: t.p, status: 200, caseId: id, key: t.key }));
  }

  // Quarante parcours légitimes, avec les quasi-jumeaux des trois leurres.
  const nearPaths = [
    '/api/admin/export', '/api/admin/export-status', '/api/admin/exports/2026-02',
    '/api/invoices/INV-999', '/api/invoices/INV-9998', '/api/invoices/INV-1001',
    '/api/invoices/INV-1002', '/api/invoices', '/api/me', '/api/settings',
  ];
  const nearKeys = ['nvf_live_ab_7d2c91', 'nvf_live_ht_7d2c', 'nvf_live_zz_001122', 'nvf_test_ht_7d2c91'];
  for (let i = 1; i <= 40; i += 1) {
    const id = `parcours-${String(i).padStart(2, '0')}`;
    add(id, false, 'un parcours légitime');
    const user = pool[r.int(0, pool.length - 1)];
    const ip = publicIp(r);
    const start = BASE + r.int(0, 165) * MIN;
    const n = r.int(6, 14);
    for (let k = 0; k < n; k += 1) {
      events.push(req({
        ts: start + k * r.int(8, 40) * 1000,
        user, ip, method: k % 7 === 6 ? 'POST' : 'GET',
        path: r.pick(nearPaths),
        status: r.next() < 0.08 ? 404 : 200,
        caseId: id,
        key: r.next() < 0.3 ? r.pick(nearKeys) : null,
      }));
    }
  }
  return { events, cases };
}

// ── Points de détection AppSensor ───────────────────────────────────────────

export function makeAppsensor(seed) {
  const r = rng(seed);
  const newIp = ipFactory(r);
  resetIds('ap');
  const events = [];
  const cases = [];
  const pool = accountPool(r, 60);
  const add = (id, malicious, label) => cases.push({ id, malicious, label });

  const req = ({ ts, user, ip, method = 'GET', path: p, status = 200, session, caseId, extra = {} }) =>
    webEvent({
      ts, action: 'http_request', outcome: status < 400 ? 'success' : 'failure',
      user, ip, ua: r.pick(UA_BROWSER), method, path: p, status, caseId,
      extra: { novafact: { session: { id: session } }, ...extra },
    });

  // AE1 — plusieurs identifiants depuis une même source.
  {
    const id = 'hostile-ae1';
    add(id, true, 'l’essai de plusieurs identifiants depuis une même source (AE1)');
    const ip = newIp();
    const users = r.shuffle(pool).slice(0, 9);
    for (const [k, user] of users.entries()) {
      events.push(webEvent({
        ts: BASE + 20 * MIN + k * 20_000, action: 'authn_login_fail', outcome: 'failure',
        user, ip, ua: r.pick(UA_BROWSER), method: 'POST', path: '/api/auth/login', status: 401, caseId: id,
        extra: { novafact: { session: { id: 'sess-ae1' } } },
      }));
    }
  }
  // ACE3 — navigation forcée sur des identifiants d'objets successifs.
  {
    const id = 'hostile-ace3';
    add(id, true, 'la navigation forcée sur des identifiants successifs (ACE3)');
    const ip = newIp();
    const user = pool[0];
    for (let k = 0; k < 14; k += 1) {
      events.push(req({
        ts: BASE + 40 * MIN + k * 8000, user, ip, path: `/api/invoices/INV-${2000 + k}`,
        status: 403, session: 'sess-ace3', caseId: id,
      }));
    }
  }
  // RE2 — méthode HTTP non supportée.
  {
    const id = 'hostile-re2';
    add(id, true, 'l’invocation d’une méthode HTTP non supportée (RE2)');
    const ip = newIp();
    const user = pool[1];
    for (const [k, method] of ['TRACE', 'PUT', 'CONNECT'].entries()) {
      events.push(req({
        ts: BASE + 60 * MIN + k * 12_000, user, ip, method, path: '/api/invoices',
        status: 405, session: 'sess-re2', caseId: id,
      }));
    }
  }
  // SE5 — changement de source au milieu d'une session.
  {
    const id = 'hostile-se5';
    add(id, true, 'le changement d’adresse source au milieu d’une session (SE5)');
    const user = pool[2];
    const ips = [newIp(), newIp(), newIp()];
    for (let k = 0; k < 9; k += 1) {
      events.push(req({
        ts: BASE + 80 * MIN + k * 30_000, user, ip: ips[k % 3], path: '/api/invoices',
        session: 'sess-se5', caseId: id,
      }));
    }
  }
  // HT2 — ressource leurre demandée.
  {
    const id = 'hostile-ht2';
    add(id, true, 'la demande d’une ressource leurre (HT2)');
    const ip = newIp();
    events.push(req({
      ts: BASE + 100 * MIN, user: pool[3], ip, path: HONEY.path, session: 'sess-ht2', caseId: id,
    }));
  }
  // IE5 — violation d'intégrité des données métier stockées : le journal d'audit.
  {
    const id = 'hostile-ie5';
    add(id, true, 'la rupture de la chaîne d’intégrité du journal (IE5)');
    const ip = newIp();
    events.push(base({
      ts: BASE + 120 * MIN, action: 'audit_log_tampered', outcome: 'failure',
      category: ['file'], type: ['change'], caseId: id,
      extra: {
        user: { name: pool[4] }, source: { ip },
        novafact: { audit: { integrity: 'broken', expected_hash: 'a3f1…', actual_hash: '77bc…' }, session: { id: 'sess-ie5' } },
        service: { name: 'novafact-api' },
      },
    }));
  }

  // Le parcours légitime, avec ses quasi-jumeaux.
  const benign = [
    ['un comptable qui parcourt ses propres factures', (id) => {
      const ip = newIp();
      const user = pool[10];
      for (let k = 0; k < 18; k += 1) {
        events.push(req({ ts: BASE + 10 * MIN + k * 9000, user, ip, path: `/api/invoices/INV-${1000 + k}`, status: 200, session: 'sess-b1', caseId: id }));
      }
    }],
    ['un poste partagé où trois personnes se connectent', (id) => {
      const ip = newIp();
      for (const [k, user] of r.shuffle(pool).slice(0, 3).entries()) {
        events.push(webEvent({
          ts: BASE + 30 * MIN + k * 4 * MIN, action: 'authn_login_success', outcome: 'success',
          user, ip, ua: r.pick(UA_BROWSER), method: 'POST', path: '/api/auth/login', status: 200, caseId: id,
          extra: { novafact: { session: { id: `sess-b2-${k}` } } },
        }));
      }
    }],
    ['un navigateur qui fait ses préchecks CORS', (id) => {
      const ip = newIp();
      const user = pool[11];
      for (let k = 0; k < 6; k += 1) {
        events.push(req({ ts: BASE + 45 * MIN + k * 15_000, user, ip, method: k % 2 ? 'OPTIONS' : 'HEAD', path: '/api/invoices', status: 204, session: 'sess-b3', caseId: id }));
      }
    }],
    ['un client mobile qui change de réseau entre deux sessions', (id) => {
      const user = pool[12];
      for (const [k, ip] of [newIp(), newIp()].entries()) {
        for (let j = 0; j < 4; j += 1) {
          events.push(webEvent({
            ts: BASE + (70 + k * 20) * MIN + j * 20_000, action: 'http_request', outcome: 'success',
            user, ip, ua: UA_MOBILE, method: 'GET', path: '/api/invoices', status: 200, caseId: id,
            extra: { novafact: { session: { id: `sess-b4-${k}` } } },
          }));
        }
      }
    }],
    ['un administrateur qui lance l’export officiel', (id) => {
      const ip = newIp();
      events.push(req({ ts: BASE + 95 * MIN, user: 'admin@novafact.example', ip, path: '/api/admin/export', status: 200, session: 'sess-b5', caseId: id }));
      events.push(req({ ts: BASE + 96 * MIN, user: 'admin@novafact.example', ip, path: '/api/admin/export-status', status: 200, session: 'sess-b5', caseId: id }));
    }],
    ['un utilisateur qui se trompe deux fois de mot de passe', (id) => {
      const ip = newIp();
      const user = pool[13];
      for (let k = 0; k < 2; k += 1) {
        events.push(webEvent({
          ts: BASE + 110 * MIN + k * 25_000, action: 'authn_login_fail', outcome: 'failure',
          user, ip, ua: r.pick(UA_BROWSER), method: 'POST', path: '/api/auth/login', status: 401, caseId: id,
          extra: { novafact: { session: { id: 'sess-b6' } } },
        }));
      }
    }],
    ['une intégration qui relit le journal d’audit sans y toucher', (id) => {
      const ip = newIp(true);
      for (let k = 0; k < 5; k += 1) {
        events.push(base({
          ts: BASE + 125 * MIN + k * 30_000, action: 'audit_log_read', outcome: 'success',
          category: ['file'], type: ['access'], caseId: id,
          extra: {
            user: { name: 'svc-audit@novafact.example' }, source: { ip },
            novafact: { audit: { integrity: 'ok' }, session: { id: 'sess-b7' } },
            service: { name: 'novafact-api' },
          },
        }));
      }
    }],
    ['un comptable qui reçoit quelques 403 en cherchant une facture archivée', (id) => {
      const ip = newIp();
      const user = pool[14];
      for (let k = 0; k < 4; k += 1) {
        events.push(req({ ts: BASE + 140 * MIN + k * 45_000, user, ip, path: `/api/invoices/INV-${3000 + k}`, status: 403, session: 'sess-b8', caseId: id }));
      }
    }],
  ];
  for (const [i, [label, make]] of benign.entries()) {
    const id = `legitime-${String(i + 1).padStart(2, '0')}`;
    add(id, false, label);
    make(id);
  }
  return { events, cases };
}

// ── Avant / après correctif ─────────────────────────────────────────────────

/**
 * Le même trafic, avant et après le correctif d'autorisation.
 *
 * Avant : le sondage d'identifiants d'un autre tenant réussit (200). Après : il
 * est refusé (403) — le trafic est identique, le résultat ne l'est plus. Une
 * règle écrite avant le correctif et jamais relue continue de lever après.
 */
export function makeSilent(seed, fixed) {
  const r = rng(seed);
  resetIds(fixed ? 'sa' : 'sb');
  const events = [];
  const cases = [];
  const pool = accountPool(r, 40);
  const add = (id, malicious, label) => cases.push({ id, malicious, label });

  const req = ({ ts, user, ip, path: p, status, match, caseId }) => webEvent({
    ts,
    action: status < 400 ? 'invoice_read' : 'authz_fail',
    outcome: status < 400 ? 'success' : 'failure',
    user, ip, ua: r.pick(UA_BROWSER), method: 'GET', path: p, status, caseId,
    extra: { novafact: { tenant: { match } } },
  });

  for (let i = 1; i <= 3; i += 1) {
    const id = `sondage-${i}`;
    add(id, !fixed, `le sondage d’identifiants n°${i}`);
    const ip = publicIp(r);
    const user = pool[i];
    const start = BASE + r.int(10, 140) * MIN;
    for (let k = 0; k < 14; k += 1) {
      events.push(req({
        ts: start + k * 12_000, user, ip, path: `/api/invoices/INV-${4000 + k}`,
        status: fixed ? 403 : 200, match: false, caseId: id,
      }));
    }
  }
  for (let i = 1; i <= 20; i += 1) {
    const id = `comptable-${String(i).padStart(2, '0')}`;
    add(id, false, 'un comptable qui parcourt les factures de son tenant');
    const ip = publicIp(r);
    const user = pool[r.int(0, pool.length - 1)];
    const start = BASE + r.int(0, 160) * MIN;
    const n = r.int(12, 28);
    for (let k = 0; k < n; k += 1) {
      events.push(req({ ts: start + k * 9000, user, ip, path: `/api/invoices/INV-${1000 + k}`, status: 200, match: true, caseId: id }));
    }
  }
  return { events, cases };
}

// ── Journal d'incident ──────────────────────────────────────────────────────

/**
 * Quatre mille lignes, un incident dedans.
 *
 * Les identifiants sont attribués APRÈS le tri chronologique : rien dans le
 * numéro d'un événement ne trahit son appartenance à l'incident, et la vérité
 * terrain vit dans la vérification, pas dans la fixture.
 */
export function makeIncident(seed) {
  const r = rng(seed);
  const rows = [];
  const pool = accountPool(r, 120);
  const ATTACKER_IP = '203.0.113.207';
  const VICTIM = 'compta@globex.example';

  const mk = (ts, action, outcome, extra) => rows.push({
    incident: false,
    row: {
      '@timestamp': iso(ts),
      event: { kind: 'event', action, outcome, module: 'novafact', dataset: 'novafact.app' },
      ...extra,
    },
  });

  // Le bruit : trois heures d'activité ordinaire.
  const paths = ['/api/invoices', '/api/invoices/INV-1001', '/api/me', '/api/settings', '/api/credits', '/api/auth/login'];
  for (let k = 0; k < 900; k += 1) {
    const user = pool[r.int(0, pool.length - 1)];
    const ip = publicIp(r);
    const good = r.next() < 0.93;
    mk(BASE + r.int(0, 180 * 60) * 1000, good ? 'http_request' : 'authn_login_fail', good ? 'success' : 'failure', {
      user: { name: user },
      source: { ip },
      http: { request: { method: 'GET' }, response: { status_code: good ? 200 : 401 } },
      url: { path: r.pick(paths) },
      user_agent: { original: r.pick(UA_BROWSER) },
      trace: { id: `T-${String(r.int(1000, 9999))}` },
      service: { name: 'novafact-api' },
    });
  }

  // L'incident : quatorze événements, deux identifiants de corrélation.
  const t0 = BASE + 62 * MIN;
  const A = 'T-4417';
  const B = 'T-8820';
  const step = (offset, action, outcome, extra, trace) => {
    rows.push({
      incident: true,
      row: {
        '@timestamp': iso(t0 + offset),
        event: { kind: 'event', action, outcome, module: 'novafact', dataset: 'novafact.app' },
        user: { name: VICTIM },
        source: { ip: ATTACKER_IP },
        trace: { id: trace },
        service: { name: 'novafact-api' },
        ...extra,
      },
    });
  };
  step(0, 'authn_login_success', 'success', {
    user_agent: { original: UA_BROWSER[0] },
    http: { request: { method: 'POST' }, response: { status_code: 200 } },
    url: { path: '/api/auth/login' },
  }, A);
  step(4_000, 'session_created', 'success', { url: { path: '/api/auth/login' } }, A);
  step(65_000, 'authz_fail', 'failure', {
    http: { request: { method: 'GET' }, response: { status_code: 403 } },
    url: { path: '/api/admin/settings' },
  }, A);
  step(130_000, 'malicious_direct_reference', 'failure', {
    http: { request: { method: 'GET' }, response: { status_code: 403 } },
    url: { path: '/api/invoices/INV-1003' },
  }, A);
  step(220_000, 'sensitive_read', 'success', {
    url: { path: '/api/invoices' }, novafact: { export: { rows: 412 } },
  }, A);
  step(300_000, 'privilege_permissions_changed', 'success', {
    url: { path: '/api/me' }, novafact: { role: { from: 'accountant', to: 'admin' } },
  }, A);
  step(360_000, 'authn_token_created', 'success', {
    url: { path: '/api/tokens' }, novafact: { api_key: { id: 'nvf_live_9f21ab' } },
  }, B);
  step(400_000, 'sys_monitor_disabled', 'success', {
    url: { path: '/api/admin/audit' }, novafact: { audit: { integrity: 'disabled' } },
  }, B);
  step(455_000, 'authz_admin', 'success', {
    url: { path: '/api/admin/export' }, http: { request: { method: 'POST' }, response: { status_code: 200 } },
  }, B);
  step(500_000, 'sensitive_read', 'success', {
    url: { path: '/api/admin/export-all' }, novafact: { export: { rows: 18_402 } },
  }, B);
  step(560_000, 'webhook_sent', 'success', {
    url: { path: '/api/webhooks/test' }, destination: { domain: 'exfil.attacker.example' },
    novafact: { export: { rows: 18_402 } },
  }, B);
  step(640_000, 'user_created', 'success', {
    url: { path: '/api/admin/users' }, novafact: { created_user: 'support-backup@novafact.example' },
  }, B);
  step(680_000, 'authn_token_created', 'success', {
    url: { path: '/api/tokens' }, novafact: { api_key: { id: 'nvf_live_c40de2' } },
  }, B);
  step(740_000, 'sys_monitor_enabled', 'success', {
    url: { path: '/api/admin/audit' }, novafact: { audit: { integrity: 'enabled' } },
  }, B);

  rows.sort((a, b) => (a.row['@timestamp'] < b.row['@timestamp'] ? -1 : a.row['@timestamp'] > b.row['@timestamp'] ? 1 : 0));
  const truth = [];
  const events = rows.map((entry, i) => {
    const id = `l${String(i + 1).padStart(5, '0')}`;
    if (entry.incident) truth.push(id);
    return { ...entry.row, event: { id, ...entry.row.event } };
  });
  return { events, truth };
}

// ── Inventaire de journalisation ────────────────────────────────────────────

/** Ce que la suite de bout en bout fait réellement émettre à l'application. */
export function makeInventory(seed) {
  const r = rng(seed);
  resetIds('iv');
  const pool = accountPool(r, 40);
  const events = [];
  const emit = (n, action, make) => {
    for (let k = 0; k < n; k += 1) events.push(make(k));
  };
  const who = () => pool[r.int(0, pool.length - 1)];

  // Tous les événements ne portent pas les mêmes champs, et c'est le sujet :
  // l'inventaire se lit dans ce que l'application émet, pas dans un gabarit.
  const auth = (action, outcome, status, opts = {}) => (k) => base({
    ts: BASE + r.int(0, 60) * MIN + k * 1000, action, outcome,
    category: ['authentication'], type: [outcome === 'success' ? 'start' : 'info'], caseId: 'e2e',
    extra: {
      ...(opts.anonymous ? {} : { user: { name: who() } }),
      source: { ip: publicIp(r) },
      ...(opts.noHttp ? {} : {
        http: { request: { method: 'POST' }, response: { status_code: status } },
        url: { path: '/api/auth/login' },
      }),
    },
  });
  const web = (action, outcome, status, p, method = 'GET', opts = {}) => (k) => base({
    ts: BASE + r.int(0, 60) * MIN + k * 1000, action, outcome,
    category: ['web'], type: [outcome === 'success' ? 'access' : 'denied'], caseId: 'e2e',
    extra: {
      // `sometimes` : le champ n'est présent qu'une fois sur deux — il ne peut
      // donc pas figurer dans l'inventaire comme s'il l'était toujours.
      ...(opts.anonymous || (opts.sometimes && k % 3 === 0) ? {} : { user: { name: who() } }),
      source: { ip: publicIp(r) },
      http: { request: { method }, response: { status_code: status } },
      url: { path: p },
    },
  });

  emit(40, 'authn_login_success', auth('authn_login_success', 'success', 200));
  emit(18, 'authn_login_fail', auth('authn_login_fail', 'failure', 401));
  emit(4, 'authn_login_lock', auth('authn_login_lock', 'failure', 423, { noHttp: true }));
  emit(6, 'authn_password_change', auth('authn_password_change', 'success', 200));
  emit(12, 'session_created', web('session_created', 'success', 200, '/api/auth/login', 'POST'));
  emit(9, 'session_expired', web('session_expired', 'success', 401, '/api/me', 'GET', { anonymous: true }));
  emit(22, 'authz_fail', web('authz_fail', 'failure', 403, '/api/admin/settings'));
  emit(7, 'authz_admin', web('authz_admin', 'success', 200, '/api/admin/export', 'POST'));
  emit(31, 'sensitive_read', web('sensitive_read', 'success', 200, '/api/invoices'));
  emit(5, 'sensitive_create', web('sensitive_create', 'success', 201, '/api/invoices', 'POST'));
  emit(3, 'user_created', web('user_created', 'success', 201, '/api/admin/users', 'POST'));
  emit(11, 'input_validation_fail', web('input_validation_fail', 'failure', 400, '/api/invoices', 'POST', { sometimes: true }));
  emit(8, 'excess_rate_limit_exceeded', web('excess_rate_limit_exceeded', 'failure', 429, '/api/auth/login', 'POST', { anonymous: true }));
  emit(2, 'privilege_permissions_changed', web('privilege_permissions_changed', 'success', 200, '/api/admin/users', 'PATCH'));
  return events.map(({ _case, ...ev }) => ev);
}

export { base };

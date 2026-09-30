// Fixtures non aléatoires : la bibliothèque de règles, les scénarios de
// couverture, le corpus à linter, les scénarios de vocabulaire, les catalogues.

import { dump } from 'js-yaml';
import { BASE, UA_BROWSER, iso, publicIp, rng, writeFile, writeJson, writeNdjson } from './lib.mjs';
import { HONEY } from './apps.mjs';

const MIN = 60_000;
export const yaml = (value) => dump(value, { lineWidth: -1, noRefs: true, quotingType: '"' });

// ── La bibliothèque de règles ───────────────────────────────────────────────
//
// Douze règles. Cinq portent un défaut de métadonnée — et seulement de
// métadonnée : la requête, elle, est juste. C'est ce qui permet au lint
// d'exiger que la requête reste intacte, et donc d'interdire de « corriger »
// une règle en la vidant.

const RULES = [
  {
    id: 'credential-stuffing',
    name: 'Bourrage d’identifiants depuis une source unique',
    description: 'Nombreux échecs d’authentification sur des comptes distincts depuis une même adresse source.',
    severity: 'high', risk_score: 73,
    tags: ['Domaine: Identité', 'Tactique: Credential Access', 'Technique: T1110.004'],
    interval: '5m', from: 'now-15m',
    note: '## Triage\n\n1. Confronter la source aux listes de proxys connus.\n2. Vérifier si l’un des comptes visés a été pris.\n3. Forcer la réinitialisation des comptes compromis.',
    query: {
      window: '10m',
      where: [{ field: 'event.action', op: 'eq', value: 'authn_login_fail' }],
      group_by: ['source.ip'],
      having: [
        { metric: 'count', op: 'gte', value: 20 },
        { metric: 'distinct', field: 'user.name', op: 'gte', value: 10 },
      ],
    },
  },
  {
    id: 'password-spray',
    name: 'Pulvérisage de mot de passe',
    description: 'Un échec par compte, sur un grand nombre de comptes distincts, depuis une même source.',
    severity: 'high', risk_score: 68,
    tags: ['Domaine: Identité', 'Tactique: Credential Access', 'Technique: T1110.003', 'Domaine: Identité'],
    defect: 'étiquette dupliquée',
    interval: '10m', from: 'now-45m',
    note: '## Triage\n\n1. Compter les comptes distincts touchés par la source.\n2. Chercher une connexion réussie dans la même fenêtre.',
    query: {
      window: '30m',
      where: [{ field: 'event.action', op: 'eq', value: 'authn_login_fail' }],
      group_by: ['source.ip'],
      having: [{ metric: 'distinct', field: 'user.name', op: 'gte', value: 50 }],
    },
  },
  {
    id: 'honeytoken-access',
    name: 'Accès à un leurre',
    description: 'Une ressource leurre a été demandée. Aucun usage légitime ne l’atteint.',
    severity: 'medium', risk_score: 88,
    defect: 'score de risque hors de la plage de sa sévérité',
    tags: ['Domaine: Application', 'Tactique: Discovery', 'Technique: T1213'],
    interval: '1m', from: 'now-10m',
    note: '## Triage\n\n1. Identifier le compte et la session qui ont touché le leurre.\n2. Traiter comme une compromission jusqu’à preuve du contraire.',
    query: {
      where: [{
        any_of: [
          { field: 'url.path', op: 'eq', value: HONEY.path },
          { field: 'url.path', op: 'eq', value: HONEY.invoice },
          { field: 'novafact.api_key.id', op: 'eq', value: HONEY.key },
        ],
      }],
    },
  },
  {
    id: 'admin-role-change',
    name: 'Élévation de rôle',
    description: 'Les permissions d’un compte ont changé.',
    severity: 'high', risk_score: 60,
    tags: ['Domaine: Identité', 'Tactique: Privilege Escalation', 'Technique: T1098'],
    interval: '5m', from: 'now-15m',
    note: '## Triage\n\n1. Vérifier la demande de changement associée.\n2. Confirmer que l’auteur avait le droit de l’accorder.',
    query: { where: [{ field: 'event.action', op: 'eq', value: 'privilege_permissions_changed' }] },
  },
  {
    id: 'audit-log-tampering',
    name: 'Altération du journal d’audit',
    description: 'La chaîne d’intégrité du journal est rompue, ou la journalisation a été désactivée.',
    severity: 'critical', risk_score: 90,
    tags: ['Domaine: Plateforme', 'Tactique: Defense Evasion', 'Technique: T1562.008'],
    interval: '1m', from: 'now-10m',
    note: 'Regarder ce qui s’est passé juste avant et juste après.',
    defect: 'note sans section de triage',
    query: { where: [{ field: 'event.action', op: 'in', value: ['sys_monitor_disabled', 'audit_log_tampered'] }] },
  },
  {
    id: 'idor-probing',
    name: 'Sondage d’identifiants d’objets',
    description: 'Un même compte lit plusieurs objets d’un autre tenant, et y parvient.',
    severity: 'high', risk_score: 70,
    tags: ['Domaine: Application', 'Tactique: Collection', 'Technique: T1213'],
    interval: '5m',
    defect: 'fenêtre d’historique absente',
    note: '## Triage\n\n1. Lister les objets réellement lus.\n2. Prévenir le tenant concerné.',
    query: {
      window: '5m',
      where: [
        { field: 'url.path', op: 'starts_with', value: '/api/invoices/' },
        { field: 'novafact.tenant.match', op: 'eq', value: false },
        { field: 'event.outcome', op: 'eq', value: 'success' },
      ],
      group_by: ['user.name'],
      having: [{ metric: 'distinct', field: 'url.path', op: 'gte', value: 8 }],
    },
  },
  {
    id: 'prompt-injection-external',
    name: 'Appel d’outil dicté par un document et visant l’extérieur',
    description: 'L’assistant a appelé un outil sortant sur instruction d’un document, pas de l’utilisateur.',
    severity: 'high', risk_score: 65,
    tags: ['Domaine: IA', 'Tactique: Exfiltration', 'Technique: T1567'],
    interval: '5m', from: 'now-15m',
    note: '## Triage\n\n1. Retrouver le document source.\n2. Vérifier ce qui est sorti.',
    query: {
      where: [
        { field: 'novafact.assistant.origin', op: 'eq', value: 'document' },
        { field: 'novafact.assistant.target', op: 'eq', value: 'external' },
      ],
    },
  },
  {
    id: 'unsupported-http-method',
    name: 'Méthode HTTP non supportée',
    description: 'Une méthode que l’application n’implémente pas a été invoquée.',
    severity: 'low', risk_score: 15,
    tags: ['Domaine: Application', 'Tactique: Discovery', 'Technique: T1190'],
    interval: '10m', from: 'now-30m',
    note: '## Triage\n\n1. Regarder si la source enchaîne d’autres anomalies.',
    query: { where: [{ field: 'http.request.method', op: 'in', value: ['TRACE', 'CONNECT', 'TRACK'] }] },
  },
  {
    id: 'session-ip-change',
    name: 'Changement d’adresse source en cours de session',
    description: 'Une même session est utilisée depuis plusieurs adresses en peu de temps.',
    severity: 'medium', risk_score: 42,
    tags: ['Domaine: Identité', 'Tactique: Credential Access', 'Technique: T1539'],
    interval: '5m', from: 'now-20m',
    note: '## Triage\n\n1. Comparer les adresses : opérateur mobile ou continents différents ?',
    query: {
      window: '10m',
      where: [{ field: 'novafact.session.id', op: 'exists' }],
      group_by: ['novafact.session.id'],
      having: [{ metric: 'distinct', field: 'source.ip', op: 'gte', value: 2 }],
    },
  },
  {
    id: 'rate-limit-exceeded',
    name: 'Limite de débit franchie de façon répétée',
    description: 'Une source déclenche la limitation de débit plusieurs fois de suite.',
    severity: 'medium', risk_score: 30,
    tags: ['Domaine: Application', 'Tactique: Impact', 'Technique: T1499'],
    interval: '5m', from: 'now-20m',
    note: '## Triage\n\n1. Vérifier s’il s’agit d’un client mal configuré.',
    query: {
      window: '15m',
      where: [{ field: 'event.action', op: 'eq', value: 'excess_rate_limit_exceeded' }],
      group_by: ['source.ip'],
      having: [{ metric: 'count', op: 'gte', value: 5 }],
    },
  },
  {
    id: 'mass-export',
    name: 'Export massif de données',
    description: 'Une lecture sensible porte sur un très grand nombre de lignes.',
    severity: 'high', risk_score: 80,
    defect: 'score de risque hors de la plage de sa sévérité',
    tags: ['Domaine: Données', 'Tactique: Collection', 'Technique: T1213'],
    interval: '5m', from: 'now-15m',
    note: '## Triage\n\n1. Comparer au volume habituel du compte.\n2. Vérifier la destination.',
    query: {
      where: [
        { field: 'event.action', op: 'eq', value: 'sensitive_read' },
        { field: 'novafact.export.rows', op: 'gte', value: 1000 },
      ],
    },
  },
  {
    id: 'new-api-key',
    name: 'Création d’une clé d’API',
    description: 'Une clé d’API a été créée.',
    severity: 'medium', risk_score: 35,
    tags: ['Domaine: Identité', 'Tactique: Persistence', 'Technique: T1098'],
    interval: '5m', from: 'now-15m',
    note: '## Triage\n\n1. Rapprocher de la demande qui l’a motivée.',
    query: { where: [{ field: 'event.action', op: 'eq', value: 'authn_token_created' }] },
  },
];

/** Les plages de score d'Elastic, reprises telles quelles. */
const RANGE = { low: [0, 21], medium: [22, 47], high: [48, 73], critical: [74, 99] };

/** La version corrigée d'une règle : seules les métadonnées changent. */
function repaired(rule) {
  const out = { ...rule };
  delete out.defect;
  if (rule.defect === 'étiquette dupliquée') out.tags = [...new Set(rule.tags)];
  if (rule.defect === 'score de risque hors de la plage de sa sévérité') {
    const [lo, hi] = RANGE[rule.severity];
    out.risk_score = Math.min(hi, Math.max(lo, Math.round((lo + hi) / 2)));
  }
  if (rule.defect === 'note sans section de triage') {
    out.note = `## Triage\n\n1. ${rule.note}\n2. Remonter la chaîne : qui a désactivé quoi, et depuis quelle session ?`;
  }
  if (rule.defect === 'fenêtre d’historique absente') out.from = 'now-15m';
  return out;
}

const order = ['id', 'name', 'description', 'severity', 'risk_score', 'tags', 'interval', 'from', 'note', 'query'];
const serialise = (rule) => {
  const out = {};
  for (const k of order) if (rule[k] !== undefined) out[k] = rule[k];
  return yaml(out);
};

export function writeRules() {
  for (const rule of RULES) {
    writeFile(`rules/${rule.id}.yaml`, serialise(rule));
  }
  return RULES.map((r) => ({ id: r.id, repaired: serialise(repaired(r)), broken: Boolean(r.defect) }));
}

export const ruleIds = () => RULES.map((r) => r.id);

// ── Scénarios de couverture ─────────────────────────────────────────────────

export function writeCoverageScenarios(seed) {
  const r = rng(seed);
  let n = 0;
  const id = () => `x${String((n += 1)).padStart(4, '0')}`;
  const ev = (ts, action, outcome, extra) => ({
    '@timestamp': iso(ts),
    event: { id: id(), kind: 'event', action, outcome, module: 'novafact', dataset: 'novafact.app' },
    ...extra,
  });

  const scenarios = {};

  // sc-01 — bourrage d'identifiants
  {
    const ip = publicIp(r);
    scenarios['sc-01-bourrage'] = Array.from({ length: 30 }, (_, k) => ev(
      BASE + k * 8000, 'authn_login_fail', 'failure',
      {
        user: { name: `cible${k}@acme.example` }, source: { ip },
        http: { request: { method: 'POST' }, response: { status_code: 401 } },
        url: { path: '/api/auth/login' }, user_agent: { original: UA_BROWSER[0] },
      },
    ));
  }
  // sc-02 — pulvérisage : étalé pour rester sous le seuil du bourrage
  {
    const ip = publicIp(r);
    const spacing = Math.floor((75 * MIN) / 139);
    scenarios['sc-02-pulverisage'] = Array.from({ length: 140 }, (_, k) => ev(
      BASE + k * spacing, 'authn_login_fail', 'failure',
      {
        user: { name: `compte${k}@globex.example` }, source: { ip },
        http: { request: { method: 'POST' }, response: { status_code: 401 } },
        url: { path: '/api/auth/login' }, user_agent: { original: UA_BROWSER[1] },
      },
    ));
  }
  // sc-03 — prise de contrôle : rôle, clé, export massif
  {
    const ip = publicIp(r);
    const user = { name: 'compta@globex.example' };
    scenarios['sc-03-prise-de-controle'] = [
      ev(BASE, 'authn_login_success', 'success', { user, source: { ip }, url: { path: '/api/auth/login' } }),
      ev(BASE + 2 * MIN, 'privilege_permissions_changed', 'success', { user, source: { ip }, url: { path: '/api/me' }, novafact: { role: { from: 'accountant', to: 'admin' } } }),
      ev(BASE + 4 * MIN, 'authn_token_created', 'success', { user, source: { ip }, url: { path: '/api/tokens' }, novafact: { api_key: { id: 'nvf_live_9f21ab' } } }),
      ev(BASE + 6 * MIN, 'sensitive_read', 'success', { user, source: { ip }, url: { path: '/api/admin/export' }, novafact: { export: { rows: 18_402 } } }),
    ];
  }
  // sc-04 — effacement des traces
  {
    const ip = publicIp(r);
    const user = { name: 'compta@globex.example' };
    scenarios['sc-04-effacement'] = [
      ev(BASE, 'sys_monitor_disabled', 'success', { user, source: { ip }, url: { path: '/api/admin/audit' } }),
      ev(BASE + 90_000, 'audit_log_tampered', 'failure', { user, source: { ip }, novafact: { audit: { integrity: 'broken' } } }),
      ev(BASE + 5 * MIN, 'sys_monitor_enabled', 'success', { user, source: { ip }, url: { path: '/api/admin/audit' } }),
    ];
  }
  // sc-05 — le leurre touché
  {
    const ip = publicIp(r);
    const user = { name: 'dev@acme.example' };
    scenarios['sc-05-leurre'] = [
      ev(BASE, 'http_request', 'success', { user, source: { ip }, url: { path: '/api/invoices' }, http: { request: { method: 'GET' }, response: { status_code: 200 } } }),
      ev(BASE + 40_000, 'http_request', 'success', { user, source: { ip }, url: { path: HONEY.path }, http: { request: { method: 'GET' }, response: { status_code: 200 } } }),
    ];
  }
  // sc-06 — injection indirecte
  {
    const ip = publicIp(r);
    const user = { name: 'dev@acme.example' };
    scenarios['sc-06-injection'] = [
      ev(BASE, 'tool_call', 'success', { user, source: { ip }, novafact: { assistant: { tool: 'read_invoice', origin: 'user', target: 'internal' } } }),
      ev(BASE + 3000, 'tool_call', 'success', { user, source: { ip }, destination: { domain: 'exfil.attacker.example' }, novafact: { assistant: { tool: 'send_mail', origin: 'document', target: 'external', source_document: 'INV-1003' } } }),
    ];
  }
  // sc-07 — sondage d'identifiants d'objets
  {
    const ip = publicIp(r);
    const user = { name: 'dev@acme.example' };
    scenarios['sc-07-sondage'] = Array.from({ length: 11 }, (_, k) => ev(
      BASE + k * 20_000, 'invoice_read', 'success',
      {
        user, source: { ip }, url: { path: `/api/invoices/INV-${4000 + k}` },
        http: { request: { method: 'GET' }, response: { status_code: 200 } },
        novafact: { tenant: { match: false } },
      },
    ));
  }
  // sc-08 — détournement de session
  {
    const ips = [publicIp(r), publicIp(r)];
    const user = { name: 'compta@globex.example' };
    scenarios['sc-08-detournement-session'] = [
      ...Array.from({ length: 6 }, (_, k) => ev(
        BASE + k * 60_000, 'http_request', 'success',
        {
          user, source: { ip: ips[k % 2] }, url: { path: '/api/invoices' },
          http: { request: { method: 'GET' }, response: { status_code: 200 } },
          novafact: { session: { id: 'sess-hijack' } },
        },
      )),
      ev(BASE + 7 * MIN, 'http_request', 'failure', {
        user, source: { ip: ips[1] }, url: { path: '/api/invoices' },
        http: { request: { method: 'TRACE' }, response: { status_code: 405 } },
        novafact: { session: { id: 'sess-hijack' } },
      }),
    ];
  }

  for (const [name, rows] of Object.entries(scenarios)) {
    writeNdjson(`coverage/scenarios/${name}.ndjson`, rows);
  }
  return Object.keys(scenarios);
}

// ── Catalogue ATT&CK ────────────────────────────────────────────────────────

export function writeAttack() {
  writeJson('coverage/attack.json', {
    _note: 'Extrait de MITRE ATT&CK Enterprise, réduit à ce dont le lab a besoin.',
    techniques: [
      { id: 'T1110', name: 'Brute Force', deprecated: false },
      { id: 'T1110.003', name: 'Password Spraying', deprecated: false },
      { id: 'T1110.004', name: 'Credential Stuffing', deprecated: false },
      { id: 'T1078', name: 'Valid Accounts', deprecated: false },
      { id: 'T1098', name: 'Account Manipulation', deprecated: false },
      { id: 'T1136.001', name: 'Create Account: Local Account', deprecated: false },
      { id: 'T1190', name: 'Exploit Public-Facing Application', deprecated: false },
      { id: 'T1213', name: 'Data from Information Repositories', deprecated: false },
      { id: 'T1499', name: 'Endpoint Denial of Service', deprecated: false },
      { id: 'T1528', name: 'Steal Application Access Token', deprecated: false },
      { id: 'T1539', name: 'Steal Web Session Cookie', deprecated: false },
      { id: 'T1562.008', name: 'Impair Defenses: Disable or Modify Cloud Logs', deprecated: false },
      { id: 'T1567', name: 'Exfiltration Over Web Service', deprecated: false },
      { id: 'T1070', name: 'Indicator Removal', deprecated: false },
      { id: 'T1035', name: 'Service Execution', deprecated: true },
      { id: 'T1064', name: 'Scripting', deprecated: true },
      { id: 'T1086', name: 'PowerShell', deprecated: true },
    ],
  });
}

// ── Catalogue AppSensor ─────────────────────────────────────────────────────

export function writeAppsensorCatalogue() {
  writeFile('appsensor/catalogue.yaml', yaml({
    _note: 'Extrait du catalogue de points de détection d’OWASP AppSensor, réduit aux six points que le challenge demande.',
    points: [
      { id: 'AE1', family: 'Authentication Exception', name: 'Use of Multiple Usernames', description: 'Une même source tente plusieurs identifiants différents en peu de temps.' },
      { id: 'ACE3', family: 'Access Control Exception', name: 'Force Browsing Attempt', description: 'Un compte demande en série des ressources qui lui sont refusées.' },
      { id: 'RE2', family: 'Request Exception', name: 'Attempt to Invoke Unsupported HTTP Method', description: 'Une méthode que l’application n’implémente pas est invoquée.' },
      { id: 'SE5', family: 'Session Exception', name: 'Source Location Changes During Session', description: 'Une même session est utilisée depuis plusieurs adresses source.' },
      { id: 'HT2', family: 'Honey Trap', name: 'Honey Trap Resource Requested', description: 'Une ressource leurre, qu’aucun usage légitime n’atteint, a été demandée.' },
      { id: 'IE5', family: 'Input Exception', name: 'Violation of Stored Business Data Integrity', description: 'L’intégrité d’une donnée métier stockée est rompue — ici, la chaîne d’empreintes du journal d’audit.' },
    ],
  }));
}

// ── Corpus à linter ─────────────────────────────────────────────────────────

const lintRow = (id, ts, message, body) => ({
  '@timestamp': iso(BASE + ts * MIN),
  event: { id, ...body.event },
  message,
  ...Object.fromEntries(Object.entries(body).filter(([k]) => k !== 'event')),
});

export function lintCorpus() {
  const ip = '203.0.113.42';
  const rows = [];
  const push = (...args) => rows.push(lintRow(...args));

  // Huit lignes correctes, qui servent de modèle.
  push('c01', 1, 'Connexion réussie', { event: { kind: 'event', category: ['authentication'], type: ['start'], action: 'authn_login_success', outcome: 'success' }, user: { name: 'marie.dupont@acme.example' }, source: { ip } });
  push('c02', 2, 'Échec de connexion', { event: { kind: 'event', category: ['authentication'], type: ['info'], action: 'authn_login_fail', outcome: 'failure' }, user: { name: 'lucas.martin@globex.example' }, source: { ip } });
  push('c03', 3, 'Facture consultée', { event: { kind: 'event', category: ['web'], type: ['access'], action: 'invoice_read', outcome: 'success' }, user: { name: 'marie.dupont@acme.example' }, source: { ip }, url: { path: '/api/invoices/INV-1001' }, http: { request: { method: 'GET' }, response: { status_code: 200 } } });
  push('c04', 4, 'Accès refusé à la configuration', { event: { kind: 'event', category: ['web'], type: ['denied'], action: 'authz_fail', outcome: 'failure' }, user: { name: 'dev@acme.example' }, source: { ip }, url: { path: '/api/admin/settings' }, http: { request: { method: 'GET' }, response: { status_code: 403 } } });
  push('c05', 5, 'Alerte de détection levée', { event: { kind: 'alert', category: ['intrusion_detection'], type: ['info'], action: 'rule_triggered', outcome: 'success' }, rule: { name: 'credential-stuffing', id: 'credential-stuffing' }, source: { ip } });
  push('c06', 6, 'Session expirée', { event: { kind: 'event', category: ['session'], type: ['end'], action: 'session_expired', outcome: 'success' }, user: { name: 'dev@acme.example' }, source: { ip } });
  push('c07', 7, 'Mot de passe changé', { event: { kind: 'event', category: ['authentication'], type: ['info'], action: 'authn_password_change', outcome: 'success' }, user: { name: 'dev@acme.example' }, source: { ip } });
  push('c08', 8, 'Export de factures', { event: { kind: 'event', category: ['web'], type: ['access'], action: 'sensitive_read', outcome: 'success' }, user: { name: 'admin@novafact.example' }, source: { ip }, url: { path: '/api/admin/export' }, http: { request: { method: 'POST' }, response: { status_code: 200 } } });

  // Neuf lignes fautives : valeurs hors énumération et contraintes croisées.
  push('b01', 9, 'Échec de connexion', { event: { kind: 'events', category: ['authentication'], type: ['info'], action: 'authn_login_fail', outcome: 'failure' }, user: { name: 'sofia.roux@acme.example' }, source: { ip } });
  push('b02', 10, 'Connexion réussie', { event: { kind: 'event', category: ['auth'], type: ['start'], action: 'authn_login_success', outcome: 'success' }, user: { name: 'hugo.petit@acme.example' }, source: { ip } });
  push('b03', 11, 'Échec de connexion', { event: { kind: 'event', category: ['authentication'], type: ['failure'], action: 'authn_login_fail', outcome: 'failure' }, user: { name: 'ines.leroy@globex.example' }, source: { ip } });
  push('b04', 12, 'Échec de connexion', { event: { kind: 'event', category: ['authentication'], type: ['info'], action: 'authn_login_fail', outcome: 'failed' }, user: { name: 'nathan.simon@acme.example' }, source: { ip } });
  push('b05', 13, 'Connexion réussie', { event: { kind: 'event', category: ['authentication'], type: ['start'], action: 'authn_login_success' }, user: { name: 'clara.moreau@acme.example' }, source: { ip } });
  push('b06', 14, 'Compte bloqué après cinq échecs', { event: { kind: 'event', category: ['authentication'], type: ['access'], action: 'authn_login_lock', outcome: 'failure' }, user: { name: 'karim.bonnet@globex.example' }, source: { ip } });
  push('b07', 15, 'Facture consultée', { event: { kind: 'event', category: ['web'], type: ['access'], action: 'invoice_read', outcome: 'success' }, user: { name: 'elsa.girard@acme.example' }, source: { ip }, url: { path: '/api/invoices/INV-1002' }, http: { response: { status_code: 200 } } });
  push('b08', 16, 'Alerte de détection levée', { event: { kind: 'alert', category: ['intrusion_detection'], type: ['info'], action: 'rule_triggered', outcome: 'success' }, source: { ip } });
  push('b09', 17, 'Accès refusé à l’export', { event: { kind: 'event', category: ['web'], type: ['denied'], action: 'authz_fail', outcome: 'success' }, user: { name: 'paul.fontaine@acme.example' }, source: { ip }, url: { path: '/api/admin/export' }, http: { request: { method: 'POST' }, response: { status_code: 403 } } });

  return rows;
}

/** La version corrigée : on répare la valeur, jamais l'horodatage ni le message. */
export function lintCorpusFixed() {
  const rows = lintCorpus().map((row) => JSON.parse(JSON.stringify(row)));
  const at = (id) => rows.find((r) => r.event.id === id);
  at('b01').event.kind = 'event';
  at('b02').event.category = ['authentication'];
  at('b03').event.type = ['info'];
  at('b04').event.outcome = 'failure';
  at('b05').event.outcome = 'success';
  at('b06').event.type = ['info'];
  at('b07').http.request = { method: 'GET' };
  at('b08').rule = { name: 'credential-stuffing', id: 'credential-stuffing' };
  at('b09').event.outcome = 'failure';
  return rows;
}

// ── Scénarios de vocabulaire ────────────────────────────────────────────────

export const VOCABULARY = [
  {
    id: 'S1',
    line: 'échec de connexion pour marie.dupont@acme.example',
    context: { user: 'marie.dupont@acme.example', ip: '203.0.113.44', outcome: 'failure', path: '/api/auth/login' },
    event: 'authn_login_fail',
  },
  {
    id: 'S2',
    line: 'compte bloqué après 5 tentatives : lucas.martin@globex.example',
    context: { user: 'lucas.martin@globex.example', ip: '203.0.113.44', outcome: 'failure', path: '/api/auth/login' },
    event: 'authn_login_lock',
  },
  {
    id: 'S3',
    line: 'accès refusé : rôle insuffisant sur /api/admin/settings',
    context: { user: 'dev@acme.example', ip: '198.51.100.10', outcome: 'failure', path: '/api/admin/settings' },
    event: 'authz_fail',
  },
  {
    id: 'S4',
    line: 'facture INV-1003 demandée par un utilisateur d’un autre tenant',
    context: { user: 'dev@acme.example', ip: '198.51.100.10', outcome: 'failure', path: '/api/invoices/INV-1003' },
    event: 'malicious_direct_reference',
  },
  {
    id: 'S5',
    line: 'trop de requêtes, appel rejeté',
    context: { user: 'dev@acme.example', ip: '192.0.2.77', outcome: 'failure', path: '/api/auth/login' },
    event: 'excess_rate_limit_exceeded',
  },
  {
    id: 'S6',
    line: 'le rôle de compta@globex.example passe de accountant à admin',
    context: { user: 'admin@novafact.example', ip: '203.0.113.9', outcome: 'success', path: '/api/admin/users' },
    event: 'privilege_permissions_changed',
  },
  {
    id: 'S7',
    line: 'export de 412 factures',
    context: { user: 'compta@globex.example', ip: '203.0.113.207', outcome: 'success', path: '/api/invoices' },
    event: 'sensitive_read',
  },
  {
    id: 'S8',
    line: 'nouveau compte créé : support-backup@novafact.example',
    context: { user: 'admin@novafact.example', ip: '203.0.113.9', outcome: 'success', path: '/api/admin/users' },
    event: 'user_created',
  },
];

/** Le vocabulaire d'OWASP, publié pour que le challenge reste un exercice de choix. */
export const OWASP_EVENTS = [
  'authn_login_success', 'authn_login_successafterfail', 'authn_login_fail', 'authn_login_fail_max',
  'authn_login_lock', 'authn_password_change', 'authn_password_change_fail', 'authn_impossible_travel',
  'authn_token_created', 'authn_token_revoke', 'authn_token_reuse', 'authn_token_delete',
  'authz_fail', 'authz_change', 'authz_admin',
  'excess_rate_limit_exceeded',
  'file_upload_complete',
  'input_validation_fail',
  'malicious_excess_404', 'malicious_extraneous', 'malicious_attack_tool', 'malicious_cors',
  'malicious_direct_reference',
  'privilege_permissions_changed',
  'sensitive_create', 'sensitive_read', 'sensitive_delete', 'sensitive_rename',
  'sequence_fail',
  'session_created', 'session_renewed', 'session_expired', 'session_use_after_expire',
  'sys_startup', 'sys_shutdown', 'sys_restart', 'sys_crash', 'sys_monitor_disabled', 'sys_monitor_enabled',
  'user_created', 'user_updated', 'user_archived', 'user_deleted',
];

export function writeVocabulary() {
  writeJson('vocabulary/scenarios.json', {
    _note: 'Huit scénarios que l’application journalise aujourd’hui en texte libre. `context` est ce dont le code dispose au moment d’écrire la ligne.',
    scenarios: VOCABULARY.map(({ id, line, context }) => ({ id, line, context })),
  });
  writeFile('vocabulary/owasp-events.txt', [
    '# Vocabulaire de journalisation d’OWASP (OWASP Logging Vocabulary), extrait.',
    '# Un identifiant d’événement se choisit dans cette liste — on n’en invente pas.',
    '',
    ...OWASP_EVENTS,
  ].join('\n'));
}

export { RANGE, RULES };

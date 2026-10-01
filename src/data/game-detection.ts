// Jeu « Detection Builder » (M24) : assembler une règle par blocs, la tester sur des événements, mesurer précision et rappel.
//
// Les événements portent des champs ECS (Elastic Common Schema) tels que les produisent les journaux
// applicatifs de Novafact (pino au format ECS) et l'intégration AWS d'Elastic pour CloudTrail
// (`aws.cloudtrail.*`). Les blocs sont écrits en KQL et se combinent par ET ; certains scénarios
// ajoutent un **seuil** : la règle n'alerte que sur les groupes (par IP, par utilisateur, par identité)
// qui dépassent un nombre d'événements, ou de valeurs distinctes d'un champ — l'équivalent d'une règle
// « threshold » d'Elastic, avec ou sans cardinalité.
//
// La difficulté ne vient pas de la technique ATT&CK visée, mais de ce qu'il faut pour séparer les
// événements malveillants des légitimes :
//
//   N1 · Un seul champ discriminant suffit. Les autres blocs sont tentants mais faux pour une raison
//        visible : ils attrapent du bruit, ou manquent l'événement le plus grave (le succès parmi les
//        échecs, l'appel qui ne demande aucune permission).
//
//   N2 · Le bloc évident attrape aussi une activité légitime : la précision ne tient qu'avec une ou
//        deux **exclusions** (le pipeline, le robot de supervision, la passerelle NAT, la sonde). Et
//        le bloc le plus parlant (le pays, le code 403) est souvent un piège.
//
//   N3 · Aucun événement n'est suspect seul : il faut un **seuil** ou une **agrégation** (comptes
//        distincts par IP, factures distinctes par utilisateur, actions sensibles distinctes par
//        compte), parfois après une exclusion. Des événements légitimes ressemblent à l'attaque (le
//        cabinet derrière son NAT, la comptable pressée, la sauvegarde) et c'est la valeur du seuil
//        qui les sépare.

import { defineSeries, type Leveled, type SeriesProfile } from '../lib/series';

export type Fields = Record<string, string | number>;
export type DetEvent = { id: string; label: string; fields: Fields; malicious: boolean };
export type Condition = { id: string; text: string; test: (f: Fields) => boolean };
export type Threshold = {
  /** Seuils proposés au joueur. */
  available: number[];
  /** Le champ qui forme les groupes. */
  groupBy: string;
  /** Si présent, on compte les valeurs distinctes de ce champ plutôt que les événements. */
  distinct?: string;
  label: string;
  ideal: number;
};
export type DetScenario = Leveled & {
  title: string;
  goal: string;
  fieldsShown: string[];
  events: DetEvent[];
  conditions: Condition[];
  threshold?: Threshold;
  idealConditions: string[];
  why: string;
  /** Technique MITRE ATT&CK visée, identifiant et nom officiels. */
  attack?: { id: string; name: string };
  /** Un cas public dont le scénario reprend le signal. */
  realCase?: { title: string; text: string };
};

/** Évalue une règle : blocs combinés par ET, puis seuil éventuel par groupe. */
export function evaluateRule(sc: DetScenario, picked: string[], threshold: number | null) {
  const conds = sc.conditions.filter((c) => picked.includes(c.id));
  const filtered = conds.length ? sc.events.filter((e) => conds.every((c) => c.test(e.fields))) : [];
  let matched = filtered;
  if (sc.threshold && threshold) {
    const { groupBy, distinct } = sc.threshold;
    const groups = new Map<string, DetEvent[]>();
    filtered.forEach((e) => {
      const k = String(e.fields[groupBy] ?? '');
      groups.set(k, [...(groups.get(k) ?? []), e]);
    });
    matched = [...groups.values()]
      .filter((g) => (distinct ? new Set(g.map((e) => String(e.fields[distinct] ?? ''))).size : g.length) >= threshold)
      .flat();
  }
  const ids = new Set(matched.map((e) => e.id));
  const totalMal = sc.events.filter((e) => e.malicious).length;
  const tp = matched.filter((e) => e.malicious).length;
  const fp = matched.length - tp;
  const precision = matched.length ? tp / matched.length : 0;
  const recall = totalMal ? tp / totalMal : 0;
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
  return { ids, matched: matched.length, tp, fp, precision, recall, f1 };
}

// ── Aides de test ───────────────────────────────────────────────────────────

const s = (f: Fields, k: string) => String(f[k] ?? '');
/** `source.ip : "10.0.0.0/16"` — les CIDR du jeu sont des /16, un préfixe suffit. */
const in16 = (ip: string, prefix: string) => ip.startsWith(prefix);

const ACCOUNT = '111122223333';
const role = (name: string, session: string) => `arn:aws:sts::${ACCOUNT}:assumed-role/${name}/${session}`;
const iamUser = (name: string) => `arn:aws:iam::${ACCOUNT}:user/${name}`;

// ── N1 · Un champ suffit ────────────────────────────────────────────────────

const root: DetScenario = {
  id: 'root',
  level: 1,
  title: 'Repérer l’usage du compte root AWS',
  goal: 'Chez Novafact, personne n’utilise le compte root : les accès passent par IAM Identity Center. Alerter sur toute activité root, sans bruit sur les connexions quotidiennes de l’équipe.',
  fieldsShown: ['event.action', 'event.outcome', 'aws.cloudtrail.user_identity.type', 'source.ip'],
  events: [
    { id: 'e1', label: 'Connexion console root réussie', fields: { 'event.action': 'ConsoleLogin', 'event.outcome': 'success', 'aws.cloudtrail.user_identity.type': 'Root', 'source.ip': '203.0.113.24' }, malicious: true },
    { id: 'e2', label: 'Root crée une clé d’accès', fields: { 'event.action': 'CreateAccessKey', 'event.outcome': 'success', 'aws.cloudtrail.user_identity.type': 'Root', 'source.ip': '203.0.113.24' }, malicious: true },
    { id: 'e3', label: 'Tentative de connexion root échouée', fields: { 'event.action': 'ConsoleLogin', 'event.outcome': 'failure', 'aws.cloudtrail.user_identity.type': 'Root', 'source.ip': '198.51.100.61' }, malicious: true },
    { id: 'e4', label: 'Connexion SSO d’une développeuse', fields: { 'event.action': 'ConsoleLogin', 'event.outcome': 'success', 'aws.cloudtrail.user_identity.type': 'AssumedRole', 'source.ip': '192.0.2.10' }, malicious: false },
    { id: 'e5', label: 'Utilisateur IAM de la comptabilité, mot de passe erroné', fields: { 'event.action': 'ConsoleLogin', 'event.outcome': 'failure', 'aws.cloudtrail.user_identity.type': 'IAMUser', 'source.ip': '192.0.2.44' }, malicious: false },
    { id: 'e6', label: 'Pipeline Terraform crée une clé KMS', fields: { 'event.action': 'CreateKey', 'event.outcome': 'success', 'aws.cloudtrail.user_identity.type': 'AssumedRole', 'source.ip': '10.0.9.1' }, malicious: false },
    { id: 'e7', label: 'Lambda lit un secret', fields: { 'event.action': 'GetSecretValue', 'event.outcome': 'success', 'aws.cloudtrail.user_identity.type': 'AssumedRole', 'source.ip': '10.0.4.7' }, malicious: false },
  ],
  conditions: [
    { id: 'login', text: 'event.action : "ConsoleLogin"', test: (f) => f['event.action'] === 'ConsoleLogin' },
    { id: 'root', text: 'aws.cloudtrail.user_identity.type : "Root"', test: (f) => f['aws.cloudtrail.user_identity.type'] === 'Root' },
    { id: 'fail', text: 'event.outcome : "failure"', test: (f) => f['event.outcome'] === 'failure' },
    { id: 'ext', text: 'not source.ip : "10.0.0.0/16"', test: (f) => !in16(s(f, 'source.ip'), '10.0.') },
  ],
  idealConditions: ['root'],
  why: 'Le type d’identité suffit : tout ce que fait root est suspect ici, qu’il se connecte, crée une clé ou échoue. Filtrer sur ConsoleLogin manque la clé d’accès créée, pourtant l’action la plus grave, puisqu’elle installe une persistance ; filtrer sur les échecs laisse passer la connexion réussie. Surveiller l’usage de root fait partie des alarmes recommandées par le CIS AWS Foundations Benchmark.',
  attack: { id: 'T1078.004', name: 'Valid Accounts: Cloud Accounts' },
};

const pathScan: DetScenario = {
  id: 'path-scan',
  level: 1,
  title: 'Repérer un scanner de fichiers exposés',
  goal: 'Les journaux HTTP de l’API (pino, format ECS) montrent des requêtes vers des fichiers qui n’existent pas chez Novafact. Alerter sur la recherche de fichiers sensibles, pas sur les liens cassés ni sur les intégrations en curl.',
  fieldsShown: ['url.path', 'http.response.status_code', 'user_agent.original', 'source.ip'],
  events: [
    { id: 'e1', label: 'Recherche d’un fichier .env', fields: { 'url.path': '/.env', 'http.response.status_code': 404, 'user_agent.original': 'python-requests/2.32.3', 'source.ip': '203.0.113.77' }, malicious: true },
    { id: 'e2', label: 'Recherche d’une configuration Git', fields: { 'url.path': '/.git/config', 'http.response.status_code': 404, 'user_agent.original': 'python-requests/2.32.3', 'source.ip': '203.0.113.77' }, malicious: true },
    { id: 'e3', label: 'Fichier Git servi par erreur', fields: { 'url.path': '/.git/HEAD', 'http.response.status_code': 200, 'user_agent.original': 'Mozilla/5.0 (X11; Linux x86_64)', 'source.ip': '198.51.100.23' }, malicious: true },
    { id: 'e4', label: 'Recherche d’un endpoint Spring Actuator', fields: { 'url.path': '/actuator/env', 'http.response.status_code': 404, 'user_agent.original': 'python-requests/2.32.3', 'source.ip': '203.0.113.77' }, malicious: true },
    { id: 'e5', label: 'Favicon absent', fields: { 'url.path': '/favicon.ico', 'http.response.status_code': 404, 'user_agent.original': 'Mozilla/5.0 (Windows NT 10.0) Chrome/141.0', 'source.ip': '192.0.2.50' }, malicious: false },
    { id: 'e6', label: 'Ancien lien vers une facture', fields: { 'url.path': '/app/factures/2023', 'http.response.status_code': 404, 'user_agent.original': 'Mozilla/5.0 (Macintosh) Safari/605.1.15', 'source.ip': '192.0.2.51' }, malicious: false },
    { id: 'e7', label: 'Intégration partenaire en curl', fields: { 'url.path': '/api/v1/invoices', 'http.response.status_code': 200, 'user_agent.original': 'curl/8.7.1', 'source.ip': '192.0.2.80' }, malicious: false },
    { id: 'e8', label: 'Utilisateur sur son tableau de bord', fields: { 'url.path': '/app/dashboard', 'http.response.status_code': 200, 'user_agent.original': 'Mozilla/5.0 (Windows NT 10.0) Chrome/141.0', 'source.ip': '192.0.2.50' }, malicious: false },
  ],
  conditions: [
    { id: 'sensitive', text: 'url.path : ("/.env" or /.git/* or /actuator/*)', test: (f) => { const p = s(f, 'url.path'); return p === '/.env' || p.startsWith('/.git/') || p.startsWith('/actuator/'); } },
    { id: 'notfound', text: 'http.response.status_code : 404', test: (f) => f['http.response.status_code'] === 404 },
    { id: 'script', text: 'user_agent.original : python-requests*', test: (f) => s(f, 'user_agent.original').startsWith('python-requests') },
    { id: 'ip', text: 'source.ip : "203.0.113.77"', test: (f) => f['source.ip'] === '203.0.113.77' },
  ],
  idealConditions: ['sensitive'],
  why: 'Le chemin demandé suffit : aucune route de Novafact ne commence par /.git ou /actuator (d’ailleurs, l’API est en Node, pas en Spring). Les 404 attrapent aussi les liens cassés et manquent le seul appel qui a réussi, /.git/HEAD servi par erreur, justement celui à traiter en premier. Le User-Agent et l’IP décrivent ce scanner-ci, pas le suivant.',
  attack: { id: 'T1595.003', name: 'Active Scanning: Wordlist Scanning' },
  realCase: {
    title: 'EmeraldWhale (Sysdig, octobre 2024)',
    text: 'Une campagne a scanné massivement des serveurs web à la recherche de configurations Git exposées. Elle en a tiré plus de 15 000 identifiants de services cloud et des accès à plus de 10 000 dépôts privés.',
  },
};

const honeykey: DetScenario = {
  id: 'honeykey',
  level: 1,
  title: 'Repérer l’usage d’une clé leurre',
  goal: 'Novafact a laissé dans un vieux fichier .env.backup du dépôt la clé d’accès d’un utilisateur IAM honey-deploy, sans aucune permission. Personne ne doit jamais s’en servir : alerter dès qu’elle sert.',
  fieldsShown: ['event.action', 'event.outcome', 'aws.cloudtrail.user_identity.arn', 'user_agent.original'],
  events: [
    { id: 'e1', label: 'Qui suis-je ? (sts:GetCallerIdentity)', fields: { 'event.action': 'GetCallerIdentity', 'event.outcome': 'success', 'aws.cloudtrail.user_identity.arn': iamUser('honey-deploy'), 'user_agent.original': 'aws-cli/2.17.20' }, malicious: true },
    { id: 'e2', label: 'Liste des buckets, refusée', fields: { 'event.action': 'ListBuckets', 'event.outcome': 'failure', 'aws.cloudtrail.user_identity.arn': iamUser('honey-deploy'), 'user_agent.original': 'aws-cli/2.17.20' }, malicious: true },
    { id: 'e3', label: 'Liste des utilisateurs IAM, refusée', fields: { 'event.action': 'ListUsers', 'event.outcome': 'failure', 'aws.cloudtrail.user_identity.arn': iamUser('honey-deploy'), 'user_agent.original': 'Boto3/1.35.0' }, malicious: true },
    { id: 'e4', label: 'CI : vérification d’identité avant déploiement', fields: { 'event.action': 'GetCallerIdentity', 'event.outcome': 'success', 'aws.cloudtrail.user_identity.arn': role('terraform-ci', 'gha-4812'), 'user_agent.original': 'aws-cli/2.17.20' }, malicious: false },
    { id: 'e5', label: 'Développeuse : action refusée, droit manquant', fields: { 'event.action': 'DescribeInstances', 'event.outcome': 'failure', 'aws.cloudtrail.user_identity.arn': role('dev-team', 'lea'), 'user_agent.original': 'aws-cli/2.17.20' }, malicious: false },
    { id: 'e6', label: 'API lit un secret', fields: { 'event.action': 'GetSecretValue', 'event.outcome': 'success', 'aws.cloudtrail.user_identity.arn': role('novafact-api', 'ecs-task-7f3a'), 'user_agent.original': 'aws-sdk-js/3.600.0' }, malicious: false },
  ],
  conditions: [
    { id: 'honey', text: 'aws.cloudtrail.user_identity.arn : *user/honey-deploy', test: (f) => s(f, 'aws.cloudtrail.user_identity.arn').endsWith('user/honey-deploy') },
    { id: 'fail', text: 'event.outcome : "failure"', test: (f) => f['event.outcome'] === 'failure' },
    { id: 'whoami', text: 'event.action : "GetCallerIdentity"', test: (f) => f['event.action'] === 'GetCallerIdentity' },
    { id: 'cli', text: 'user_agent.original : aws-cli*', test: (f) => s(f, 'user_agent.original').startsWith('aws-cli') },
  ],
  idealConditions: ['honey'],
  why: 'Le leurre n’a aucun usage légitime : son identité suffit, quelle que soit l’action ou son issue. Filtrer les échecs manque le premier appel, le plus révélateur : GetCallerIdentity ne demande aucune permission et réussit même sous un refus explicite, d’où le réflexe de qui teste une clé trouvée. Mais le filtrer seul attrape la CI, qui fait la même vérification avant chaque déploiement.',
  attack: { id: 'T1552.001', name: 'Unsecured Credentials: Credentials In Files' },
};

const exfil: DetScenario = {
  id: 'exfil',
  level: 1,
  avoid: ['mass-read'],
  title: 'Détecter l’exfiltration depuis S3',
  goal: 'Le bucket des factures n’est lu que par des services internes, qui passent par un point de terminaison VPC : dans les événements de données S3 de CloudTrail, leur source.ip est privée. Repérer les lectures venues d’ailleurs.',
  fieldsShown: ['event.action', 'aws.cloudtrail.user_identity.arn', 'source.ip', 'user_agent.original'],
  events: [
    { id: 'e1', label: 'Rôle analytics, lecture depuis Internet', fields: { 'event.action': 'GetObject', 'aws.cloudtrail.user_identity.arn': role('analytics', 'ecs-task-91c2'), 'source.ip': '203.0.113.9', 'user_agent.original': 'aws-cli/2.17.20' }, malicious: true },
    { id: 'e2', label: 'Clé d’un ancien utilisateur, lecture depuis Internet', fields: { 'event.action': 'GetObject', 'aws.cloudtrail.user_identity.arn': iamUser('legacy-export'), 'source.ip': '198.51.100.140', 'user_agent.original': 'aws-sdk-js/3.600.0' }, malicious: true },
    { id: 'e3', label: 'Worker PDF lit une facture', fields: { 'event.action': 'GetObject', 'aws.cloudtrail.user_identity.arn': role('pdf-worker', 'ecs-task-22b0'), 'source.ip': '10.0.2.31', 'user_agent.original': 'aws-sdk-js/3.600.0' }, malicious: false },
    { id: 'e4', label: 'Worker PDF, pointe de charge', fields: { 'event.action': 'GetObject', 'aws.cloudtrail.user_identity.arn': role('pdf-worker', 'ecs-task-22b1'), 'source.ip': '10.0.2.32', 'user_agent.original': 'aws-sdk-js/3.600.0' }, malicious: false },
    { id: 'e5', label: 'Sauvegarde nocturne', fields: { 'event.action': 'GetObject', 'aws.cloudtrail.user_identity.arn': role('backup-nightly', 'run-0412'), 'source.ip': '10.0.5.4', 'user_agent.original': 'aws-cli/2.17.20' }, malicious: false },
    { id: 'e6', label: 'API écrit un PDF', fields: { 'event.action': 'PutObject', 'aws.cloudtrail.user_identity.arn': role('novafact-api', 'ecs-task-7f3a'), 'source.ip': '10.0.2.14', 'user_agent.original': 'aws-sdk-js/3.600.0' }, malicious: false },
  ],
  conditions: [
    { id: 'get', text: 'event.action : "GetObject"', test: (f) => f['event.action'] === 'GetObject' },
    { id: 'ext', text: 'not source.ip : "10.0.0.0/16"', test: (f) => !in16(s(f, 'source.ip'), '10.0.') },
    { id: 'cli', text: 'user_agent.original : aws-cli*', test: (f) => s(f, 'user_agent.original').startsWith('aws-cli') },
    { id: 'analytics', text: 'aws.cloudtrail.user_identity.arn : *assumed-role/analytics/*', test: (f) => s(f, 'aws.cloudtrail.user_identity.arn').includes('assumed-role/analytics/') },
  ],
  idealConditions: ['ext'],
  why: 'Ici, l’origine réseau suffit : tout service légitime passe par le point de terminaison VPC. GetObject seul noie l’alerte dans l’activité normale ; cibler le rôle analytics surapprend l’incident et manque la vieille clé ; l’aws-cli sert aussi à la sauvegarde. Garde en tête l’hypothèse qui porte la règle : le jour où un service sort par une passerelle NAT, son IP devient publique.',
  attack: { id: 'T1530', name: 'Data from Cloud Storage' },
};

// ── N2 · L'exclusion qui tient ──────────────────────────────────────────────

const privesc: DetScenario = {
  id: 'privesc',
  level: 2,
  title: 'Détecter la modification d’IAM hors pipeline',
  goal: 'Alerter quand IAM est modifié par autre chose que le rôle du pipeline Terraform, sans bruit sur l’activité normale.',
  fieldsShown: ['event.provider', 'event.action', 'aws.cloudtrail.user_identity.arn'],
  events: [
    { id: 'e1', label: 'Rôle support réécrit sa politique', fields: { 'event.provider': 'iam.amazonaws.com', 'event.action': 'CreatePolicyVersion', 'aws.cloudtrail.user_identity.arn': role('support-tools', 'k.martin') }, malicious: true },
    { id: 'e2', label: 'Rôle support s’attache une politique admin', fields: { 'event.provider': 'iam.amazonaws.com', 'event.action': 'AttachRolePolicy', 'aws.cloudtrail.user_identity.arn': role('support-tools', 'k.martin') }, malicious: true },
    { id: 'e3', label: 'Rôle support crée une clé d’accès', fields: { 'event.provider': 'iam.amazonaws.com', 'event.action': 'CreateAccessKey', 'aws.cloudtrail.user_identity.arn': role('support-tools', 'k.martin') }, malicious: true },
    { id: 'e4', label: 'Clé volée d’un ancien utilisateur : ajout au groupe admin', fields: { 'event.provider': 'iam.amazonaws.com', 'event.action': 'AddUserToGroup', 'aws.cloudtrail.user_identity.arn': iamUser('legacy-export') }, malicious: true },
    { id: 'e5', label: 'Pipeline applique un changement IAM', fields: { 'event.provider': 'iam.amazonaws.com', 'event.action': 'AttachRolePolicy', 'aws.cloudtrail.user_identity.arn': role('terraform-ci', 'gha-4812') }, malicious: false },
    { id: 'e6', label: 'Pipeline crée un rôle', fields: { 'event.provider': 'iam.amazonaws.com', 'event.action': 'CreateRole', 'aws.cloudtrail.user_identity.arn': role('terraform-ci', 'gha-4812') }, malicious: false },
    { id: 'e7', label: 'Lecture de configuration par un dev', fields: { 'event.provider': 'iam.amazonaws.com', 'event.action': 'GetRole', 'aws.cloudtrail.user_identity.arn': role('dev-team', 'lea') }, malicious: false },
    { id: 'e8', label: 'API écrit dans DynamoDB', fields: { 'event.provider': 'dynamodb.amazonaws.com', 'event.action': 'PutItem', 'aws.cloudtrail.user_identity.arn': role('novafact-api', 'ecs-task-7f3a') }, malicious: false },
  ],
  conditions: [
    { id: 'write', text: 'event.provider : "iam.amazonaws.com" and event.action : (Create* or Attach* or Put* or Update* or Delete* or Add*)', test: (f) => f['event.provider'] === 'iam.amazonaws.com' && /^(Create|Attach|Put|Update|Delete|Add)/.test(s(f, 'event.action')) },
    { id: 'read', text: 'event.action : (Get* or List*)', test: (f) => /^(Get|List)/.test(s(f, 'event.action')) },
    { id: 'notci', text: 'not aws.cloudtrail.user_identity.arn : *assumed-role/terraform-ci/*', test: (f) => !s(f, 'aws.cloudtrail.user_identity.arn').includes('assumed-role/terraform-ci/') },
    { id: 'support', text: 'aws.cloudtrail.user_identity.arn : *assumed-role/support-tools/*', test: (f) => s(f, 'aws.cloudtrail.user_identity.arn').includes('assumed-role/support-tools/') },
  ],
  idealConditions: ['write', 'notci'],
  why: 'Toute écriture IAM sauf celle du pipeline : les quatre actions malveillantes remontent, sans le bruit des lectures ni du pipeline légitime. Le filtre sur event.provider compte aussi : sans lui, un PutItem DynamoDB passerait pour une écriture IAM. Cibler le seul rôle support surapprend l’incident et manque déjà la seconde identité compromise.',
  attack: { id: 'T1098.003', name: 'Account Manipulation: Additional Cloud Roles' },
};

const impersonation: DetScenario = {
  id: 'impersonation',
  level: 2,
  title: 'Repérer un accès du support sans ticket',
  goal: 'Le support de Novafact peut ouvrir la session d’un client pour déboguer. La règle interne : jamais sans numéro de ticket. Un robot de supervision ouvre chaque heure la session du tenant de démonstration, sans ticket, et c’est prévu.',
  fieldsShown: ['event.action', 'user.name', 'organization.id', 'labels.ticket_id'],
  events: [
    { id: 'e1', label: 'k.martin ouvre la session de Globex, sans ticket', fields: { 'event.action': 'support_impersonation_start', 'user.name': 'k.martin', 'organization.id': 'globex' }, malicious: true },
    { id: 'e2', label: 'k.martin ouvre la session d’Initech, sans ticket', fields: { 'event.action': 'support_impersonation_start', 'user.name': 'k.martin', 'organization.id': 'initech' }, malicious: true },
    { id: 'e3', label: 's.roux ouvre la session d’Acme, sans ticket', fields: { 'event.action': 'support_impersonation_start', 'user.name': 's.roux', 'organization.id': 'acme' }, malicious: true },
    { id: 'e4', label: 'Support, session Acme avec ticket', fields: { 'event.action': 'support_impersonation_start', 'user.name': 's.roux', 'organization.id': 'acme', 'labels.ticket_id': 'SUP-4821' }, malicious: false },
    { id: 'e5', label: 'Support, session Durand avec ticket', fields: { 'event.action': 'support_impersonation_start', 'user.name': 'k.martin', 'organization.id': 'durand', 'labels.ticket_id': 'SUP-4830' }, malicious: false },
    { id: 'e6', label: 'Supervision, tenant de démonstration (9 h)', fields: { 'event.action': 'support_impersonation_start', 'user.name': 'synthetics-bot', 'organization.id': 'demo' }, malicious: false },
    { id: 'e7', label: 'Supervision, tenant de démonstration (10 h)', fields: { 'event.action': 'support_impersonation_start', 'user.name': 'synthetics-bot', 'organization.id': 'demo' }, malicious: false },
    { id: 'e8', label: 'Comptable de Globex exporte ses factures', fields: { 'event.action': 'invoice_export', 'user.name': 'c.dupont', 'organization.id': 'globex' }, malicious: false },
  ],
  conditions: [
    { id: 'imp', text: 'event.action : "support_impersonation_start"', test: (f) => f['event.action'] === 'support_impersonation_start' },
    { id: 'noticket', text: 'not labels.ticket_id : *', test: (f) => !f['labels.ticket_id'] },
    { id: 'notbot', text: 'not user.name : "synthetics-bot"', test: (f) => f['user.name'] !== 'synthetics-bot' },
    { id: 'kmartin', text: 'user.name : "k.martin"', test: (f) => f['user.name'] === 'k.martin' },
  ],
  idealConditions: ['imp', 'noticket', 'notbot'],
  why: 'Trois blocs : l’action, l’absence de ticket (not champ : * teste l’existence du champ), et l’exclusion du robot. Sans l’exclusion, la supervision déclenche une alerte par heure et l’équipe apprend à l’ignorer ; sans le filtre sur l’action, tout événement sans ticket remonte, export de comptable compris. L’exclusion vise un compte précis, pas un motif large comme *bot* qu’un compte malveillant n’aurait qu’à imiter. Et cibler k.martin manque s.roux.',
  realCase: {
    title: 'Twitter (juillet 2020)',
    text: 'En se faisant passer pour le support informatique, des attaquants ont obtenu les identifiants d’employés, puis se sont servis des outils internes d’administration pour prendre le contrôle de comptes de personnalités. Le rapport du régulateur new-yorkais (NYDFS) pointe des contrôles d’accès et une surveillance insuffisants sur ces outils.',
  },
};

const natCreds: DetScenario = {
  id: 'nat-creds',
  level: 2,
  title: 'Repérer des identifiants de rôle utilisés hors de Novafact',
  goal: 'Le rôle novafact-api n’existe que dans les tâches ECS de l’API. Ses appels AWS passent par des points de terminaison VPC (IP privées) ou, pour les services qui n’en ont pas chez Novafact, par la passerelle NAT, dont l’IP publique est 198.51.100.7. Repérer ses identifiants utilisés ailleurs.',
  fieldsShown: ['event.action', 'aws.cloudtrail.user_identity.arn', 'source.ip', 'source.geo.country_iso_code'],
  events: [
    { id: 'e1', label: 'Rôle API : « qui suis-je ? » depuis un VPS', fields: { 'event.action': 'GetCallerIdentity', 'aws.cloudtrail.user_identity.arn': role('novafact-api', 'ecs-task-7f3a'), 'source.ip': '203.0.113.50', 'source.geo.country_iso_code': 'FR' }, malicious: true },
    { id: 'e2', label: 'Rôle API liste les buckets depuis le VPS', fields: { 'event.action': 'ListBuckets', 'aws.cloudtrail.user_identity.arn': role('novafact-api', 'ecs-task-7f3a'), 'source.ip': '203.0.113.50', 'source.geo.country_iso_code': 'FR' }, malicious: true },
    { id: 'e3', label: 'Rôle API lit un secret depuis le VPS', fields: { 'event.action': 'GetSecretValue', 'aws.cloudtrail.user_identity.arn': role('novafact-api', 'ecs-task-7f3a'), 'source.ip': '203.0.113.50', 'source.geo.country_iso_code': 'FR' }, malicious: true },
    { id: 'e4', label: 'API lit un secret (point de terminaison VPC)', fields: { 'event.action': 'GetSecretValue', 'aws.cloudtrail.user_identity.arn': role('novafact-api', 'ecs-task-7f3a'), 'source.ip': '10.0.2.14' }, malicious: false },
    { id: 'e5', label: 'API déchiffre avec KMS (point de terminaison VPC)', fields: { 'event.action': 'Decrypt', 'aws.cloudtrail.user_identity.arn': role('novafact-api', 'ecs-task-7f3a'), 'source.ip': '10.0.2.15' }, malicious: false },
    { id: 'e6', label: 'API lit un paramètre SSM, par le NAT', fields: { 'event.action': 'GetParameter', 'aws.cloudtrail.user_identity.arn': role('novafact-api', 'ecs-task-7f3a'), 'source.ip': '198.51.100.7', 'source.geo.country_iso_code': 'FR' }, malicious: false },
    { id: 'e7', label: 'Développeuse, depuis le bureau', fields: { 'event.action': 'DescribeTasks', 'aws.cloudtrail.user_identity.arn': role('dev-team', 'lea'), 'source.ip': '192.0.2.10', 'source.geo.country_iso_code': 'FR' }, malicious: false },
    { id: 'e8', label: 'Worker PDF lit une facture', fields: { 'event.action': 'GetObject', 'aws.cloudtrail.user_identity.arn': role('pdf-worker', 'ecs-task-22b0'), 'source.ip': '10.0.2.31' }, malicious: false },
  ],
  conditions: [
    { id: 'api', text: 'aws.cloudtrail.user_identity.arn : *assumed-role/novafact-api/*', test: (f) => s(f, 'aws.cloudtrail.user_identity.arn').includes('assumed-role/novafact-api/') },
    { id: 'notvpc', text: 'not source.ip : "10.0.0.0/16"', test: (f) => !in16(s(f, 'source.ip'), '10.0.') },
    { id: 'notnat', text: 'not source.ip : "198.51.100.7"', test: (f) => f['source.ip'] !== '198.51.100.7' },
    { id: 'foreign', text: 'not source.geo.country_iso_code : "FR"', test: (f) => f['source.geo.country_iso_code'] !== 'FR' },
    { id: 'whoami', text: 'event.action : "GetCallerIdentity"', test: (f) => f['event.action'] === 'GetCallerIdentity' },
  ],
  idealConditions: ['api', 'notvpc', 'notnat'],
  why: 'L’identité du rôle, puis deux exclusions : ni le VPC, ni la passerelle NAT. Oublier le NAT, c’est alerter à chaque appel légitime vers un service sans point de terminaison ; oublier le rôle, c’est alerter sur les développeurs au bureau. Le pays ne dit rien : l’attaquant loue un VPS en France, et une IP privée n’a pas de pays du tout. GetCallerIdentity seul ne voit que le premier pas.',
  attack: { id: 'T1078.004', name: 'Valid Accounts: Cloud Accounts' },
  realCase: {
    title: 'Capital One (2019)',
    text: 'Une SSRF à travers un pare-feu applicatif mal configuré a permis d’interroger le service de métadonnées d’une instance EC2 (IMDSv1) et d’en tirer les identifiants temporaires de son rôle. Utilisés depuis l’extérieur, ils ont servi à lister les buckets S3 puis à en synchroniser le contenu : environ 106 millions de personnes touchées aux États-Unis et au Canada. Le même signal que cette règle : les identifiants d’un rôle d’infrastructure, utilisés hors de l’infrastructure.',
  },
};

const adminRoute: DetScenario = {
  id: 'admin-route',
  level: 2,
  title: 'Repérer l’accès aux routes d’administration',
  goal: 'Les routes /admin/* de l’API ne servent qu’au back-office, joint par le VPN (10.8.0.0/16). Une sonde de supervision externe interroge /admin/healthz chaque minute. Repérer les accès aux routes d’administration venus d’ailleurs, qu’ils réussissent ou non.',
  fieldsShown: ['url.path', 'http.response.status_code', 'source.ip', 'user.name'],
  events: [
    { id: 'e1', label: 'Compte d’essai appelle la liste des tenants, refusé', fields: { 'url.path': '/admin/tenants', 'http.response.status_code': 403, 'source.ip': '203.0.113.61', 'user.name': 'trial-7781' }, malicious: true },
    { id: 'e2', label: 'Même compte, export des utilisateurs, accepté', fields: { 'url.path': '/admin/users/export', 'http.response.status_code': 200, 'source.ip': '203.0.113.61', 'user.name': 'trial-7781' }, malicious: true },
    { id: 'e3', label: 'Même compte, fiche du tenant Globex, acceptée', fields: { 'url.path': '/admin/tenants/globex', 'http.response.status_code': 200, 'source.ip': '203.0.113.61', 'user.name': 'trial-7781' }, malicious: true },
    { id: 'e4', label: 'Back-office via le VPN', fields: { 'url.path': '/admin/tenants', 'http.response.status_code': 200, 'source.ip': '10.8.0.12', 'user.name': 'a.bernard' }, malicious: false },
    { id: 'e5', label: 'Back-office via le VPN, export', fields: { 'url.path': '/admin/users/export', 'http.response.status_code': 200, 'source.ip': '10.8.0.12', 'user.name': 'a.bernard' }, malicious: false },
    { id: 'e6', label: 'Sonde de supervision', fields: { 'url.path': '/admin/healthz', 'http.response.status_code': 200, 'source.ip': '192.0.2.200' }, malicious: false },
    { id: 'e7', label: 'Sonde de supervision, second point de mesure', fields: { 'url.path': '/admin/healthz', 'http.response.status_code': 200, 'source.ip': '192.0.2.201' }, malicious: false },
    { id: 'e8', label: 'Client consulte ses factures', fields: { 'url.path': '/api/invoices', 'http.response.status_code': 200, 'source.ip': '192.0.2.77', 'user.name': 'c.dupont' }, malicious: false },
  ],
  conditions: [
    { id: 'admin', text: 'url.path : /admin/*', test: (f) => s(f, 'url.path').startsWith('/admin/') },
    { id: 'notvpn', text: 'not source.ip : "10.8.0.0/16"', test: (f) => !in16(s(f, 'source.ip'), '10.8.') },
    { id: 'nothealth', text: 'not url.path : "/admin/healthz"', test: (f) => f['url.path'] !== '/admin/healthz' },
    { id: 'denied', text: 'http.response.status_code : 403', test: (f) => f['http.response.status_code'] === 403 },
  ],
  idealConditions: ['admin', 'notvpn', 'nothealth'],
  why: 'Le préfixe, puis deux exclusions : le VPN et le chemin exact de la sonde. Exclure son chemin plutôt que ses IP : une sonde change de point de mesure, et une exclusion d’IP publique couvre aussi quiconque la partage. Les 403 ne montrent que la tentative ratée ; les deux accès acceptés, la vraie faille (API5:2023 Broken Function Level Authorization), passent dessous.',
  attack: { id: 'T1190', name: 'Exploit Public-Facing Application' },
};

// ── N3 · Compter, corréler ──────────────────────────────────────────────────

const login = (email: string, ip: string, ua: string, ok: boolean): Fields => ({
  'event.action': ok ? 'authn_login_success' : 'authn_login_fail', 'source.ip': ip, 'user.email': email, 'user_agent.original': ua,
});
const BOT = '203.0.113.7';
const OKHTTP = 'okhttp/4.12.0';
const FIREFOX = 'Mozilla/5.0 (Windows NT 10.0) Firefox/143.0';

const stuffing: DetScenario = {
  id: 'stuffing',
  level: 3,
  title: 'Détecter le credential stuffing',
  goal: 'Alerter sur le rejeu d’identifiants volés sans déclencher sur les fautes de frappe, ni sur le cabinet comptable dont plusieurs salariés sortent par la même IP. Échantillon : 10 minutes de connexions.',
  fieldsShown: ['event.action', 'source.ip', 'user.email', 'user_agent.original'],
  events: [
    { id: 'e1', label: 'Bot : échec, compte 1', fields: login('a@acme.example', BOT, OKHTTP, false), malicious: true },
    { id: 'e2', label: 'Bot : échec, compte 2', fields: login('b@globex.example', BOT, 'Mozilla/5.0 (Windows NT 10.0) Chrome/141.0', false), malicious: true },
    { id: 'e3', label: 'Bot : échec, compte 3', fields: login('c@initech.example', BOT, OKHTTP, false), malicious: true },
    { id: 'e4', label: 'Bot : échec, compte 4', fields: login('e@durand.example', BOT, FIREFOX, false), malicious: true },
    { id: 'e5', label: 'Bot : succès (mot de passe réutilisé)', fields: login('d@acme.example', BOT, OKHTTP, true), malicious: true },
    { id: 'e6', label: 'Utilisatrice : faute de frappe', fields: login('lea@acme.example', '192.0.2.20', 'Mozilla/5.0 (Macintosh) Safari/605.1.15', false), malicious: false },
    { id: 'e7', label: 'Cabinet (NAT) : faute de frappe', fields: login('p@cabinet-durand.example', '192.0.2.99', FIREFOX, false), malicious: false },
    { id: 'e8', label: 'Cabinet (NAT) : succès', fields: login('m@cabinet-durand.example', '192.0.2.99', FIREFOX, true), malicious: false },
    { id: 'e9', label: 'Cabinet (NAT) : succès', fields: login('j@cabinet-durand.example', '192.0.2.99', FIREFOX, true), malicious: false },
    { id: 'e10', label: 'Application mobile', fields: login('s@acme.example', '198.51.100.30', OKHTTP, true), malicious: false },
    { id: 'e11', label: 'Application mobile', fields: login('n@globex.example', '198.51.100.31', OKHTTP, true), malicious: false },
  ],
  conditions: [
    { id: 'login', text: 'event.action : ("authn_login_fail" or "authn_login_success")', test: (f) => /^authn_login_(fail|success)$/.test(s(f, 'event.action')) },
    { id: 'fail', text: 'event.action : "authn_login_fail"', test: (f) => f['event.action'] === 'authn_login_fail' },
    { id: 'success', text: 'event.action : "authn_login_success"', test: (f) => f['event.action'] === 'authn_login_success' },
    { id: 'ua', text: 'user_agent.original : "okhttp/4.12.0"', test: (f) => f['user_agent.original'] === OKHTTP },
  ],
  threshold: { available: [2, 3, 4, 6], groupBy: 'source.ip', distinct: 'user.email', label: 'comptes distincts par source.ip', ideal: 4 },
  idealConditions: ['login'],
  why: 'Le signal n’est pas un événement, c’est un nombre : une même IP qui essaie beaucoup de comptes différents. À 3 comptes, le cabinet derrière son NAT ressemble à un bot ; à 4, seul le bot passe. Compter les succès avec les échecs, c’est attraper la ligne qui compte le plus : le compte effectivement compromis. Le User-Agent, lui, change d’un essai à l’autre, et l’application mobile utilise le même que le bot. Limite connue : réparti sur des milliers d’IP résidentielles, le même rejeu passe sous tout seuil par IP.',
  attack: { id: 'T1110.004', name: 'Brute Force: Credential Stuffing' },
  realCase: {
    title: '23andMe (2023)',
    text: 'Par credential stuffing, des attaquants ont accédé à environ 14 000 comptes, 0,1 % des utilisateurs. Par la fonction DNA Relatives, ces comptes ouvraient les profils d’environ 6,9 millions de personnes : le succès isolé comptait plus que tous les échecs.',
  },
};

const inv = (user: string, path: string, status: number): Fields => ({ 'user.name': user, 'url.path': path, 'http.response.status_code': status });

const bolaEnum: DetScenario = {
  id: 'bola-enum',
  level: 3,
  title: 'Repérer l’énumération de factures',
  goal: 'L’API répond 404 quand une facture n’existe pas ou appartient à un autre tenant. Repérer un utilisateur qui parcourt les identifiants de factures, sans alerter sur la comptable qui ouvre ses factures en série ni sur les liens périmés. Échantillon : 5 minutes.',
  fieldsShown: ['user.name', 'url.path', 'http.response.status_code'],
  events: [
    { id: 'e1', label: 'trial-7781 : facture 10231', fields: inv('trial-7781', '/api/invoices/10231', 404), malicious: true },
    { id: 'e2', label: 'trial-7781 : facture 10232', fields: inv('trial-7781', '/api/invoices/10232', 404), malicious: true },
    { id: 'e3', label: 'trial-7781 : facture 10233', fields: inv('trial-7781', '/api/invoices/10233', 404), malicious: true },
    { id: 'e4', label: 'trial-7781 : facture 10234', fields: inv('trial-7781', '/api/invoices/10234', 404), malicious: true },
    { id: 'e5', label: 'm.leroy (comptable) ouvre ses factures', fields: inv('m.leroy', '/api/invoices/8812', 200), malicious: false },
    { id: 'e6', label: 'm.leroy (comptable) ouvre ses factures', fields: inv('m.leroy', '/api/invoices/8813', 200), malicious: false },
    { id: 'e7', label: 'm.leroy (comptable) ouvre ses factures', fields: inv('m.leroy', '/api/invoices/8817', 200), malicious: false },
    { id: 'e8', label: 'j.petit suit un lien périmé', fields: inv('j.petit', '/api/invoices/7040', 404), malicious: false },
    { id: 'e9', label: 'j.petit suit un autre lien périmé', fields: inv('j.petit', '/api/invoices/7102', 404), malicious: false },
    { id: 'e10', label: 'j.petit ouvre la liste', fields: inv('j.petit', '/api/invoices', 200), malicious: false },
  ],
  conditions: [
    { id: 'inv', text: 'url.path : /api/invoices/*', test: (f) => s(f, 'url.path').startsWith('/api/invoices/') },
    { id: 'nf', text: 'http.response.status_code : 404', test: (f) => f['http.response.status_code'] === 404 },
    { id: 'ok', text: 'http.response.status_code : 200', test: (f) => f['http.response.status_code'] === 200 },
  ],
  threshold: { available: [2, 3, 5], groupBy: 'user.name', distinct: 'url.path', label: 'factures distinctes par user.name', ideal: 3 },
  idealConditions: ['inv', 'nf'],
  why: 'Un 404 isolé est un lien périmé, une série de 200 est une comptable efficace : c’est la combinaison, beaucoup d’identifiants distincts refusés pour un même utilisateur, qui trahit l’énumération. À 2, j.petit et ses deux liens périmés déclenchent ; à 5, l’attaquant passe. Répondre 404 plutôt que 403 ne cache rien au SIEM, les deux se comptent pareil. Et si la faille existe (API1:2023 Broken Object Level Authorization), la facture trouvée répondra 200 : c’est l’activité entière de ce compte qu’il faut relire.',
};

const massRead: DetScenario = {
  id: 'mass-read',
  level: 3,
  avoid: ['exfil'],
  title: 'Repérer une lecture massive depuis l’intérieur',
  goal: 'Une tâche ECS du service analytics est compromise : l’attaquant lit les factures depuis le VPC, avec le rôle de la tâche. La sauvegarde nocturne lit elle aussi beaucoup d’objets. Échantillon : 5 minutes d’événements de données S3.',
  fieldsShown: ['event.action', 'aws.cloudtrail.user_identity.arn', 'source.ip'],
  events: [
    ...[1, 2, 3, 4].map((n) => ({ id: `e${n}`, label: `Analytics lit la facture ${n}`, fields: { 'event.action': 'GetObject', 'aws.cloudtrail.user_identity.arn': role('analytics', 'ecs-task-91c2'), 'source.ip': '10.0.3.21' }, malicious: true })),
    ...[5, 6, 7, 8].map((n) => ({ id: `e${n}`, label: `Sauvegarde nocturne, objet ${n - 4}`, fields: { 'event.action': 'GetObject', 'aws.cloudtrail.user_identity.arn': role('backup-nightly', 'run-0412'), 'source.ip': '10.0.5.4' }, malicious: false })),
    { id: 'e9', label: 'Worker PDF lit une facture', fields: { 'event.action': 'GetObject', 'aws.cloudtrail.user_identity.arn': role('pdf-worker', 'ecs-task-22b0'), 'source.ip': '10.0.2.31' }, malicious: false },
    { id: 'e10', label: 'Worker PDF lit une autre facture', fields: { 'event.action': 'GetObject', 'aws.cloudtrail.user_identity.arn': role('pdf-worker', 'ecs-task-22b0'), 'source.ip': '10.0.2.31' }, malicious: false },
    { id: 'e11', label: 'API écrit un PDF', fields: { 'event.action': 'PutObject', 'aws.cloudtrail.user_identity.arn': role('novafact-api', 'ecs-task-7f3a'), 'source.ip': '10.0.2.14' }, malicious: false },
  ],
  conditions: [
    { id: 'get', text: 'event.action : "GetObject"', test: (f) => f['event.action'] === 'GetObject' },
    { id: 'notbackup', text: 'not aws.cloudtrail.user_identity.arn : *assumed-role/backup-nightly/*', test: (f) => !s(f, 'aws.cloudtrail.user_identity.arn').includes('assumed-role/backup-nightly/') },
    { id: 'ext', text: 'not source.ip : "10.0.0.0/16"', test: (f) => !in16(s(f, 'source.ip'), '10.0.') },
  ],
  threshold: { available: [2, 3, 5], groupBy: 'aws.cloudtrail.user_identity.arn', label: 'GetObject par identité', ideal: 3 },
  idealConditions: ['get', 'notbackup'],
  why: 'L’origine réseau ne sert plus : l’attaquant est dans le VPC, avec des identifiants légitimes. Reste le volume par identité, et il faut d’abord retirer la sauvegarde, seule à lire autant par nature. L’exclusion vise le rôle exact, que l’attaquant ne choisit pas, plutôt qu’un motif comme *backup*. À 2, le worker PDF déclenche ; en production, le seuil se cale sur la ligne de base de chaque rôle, ou sur une règle de machine learning d’Elastic.',
  attack: { id: 'T1530', name: 'Data from Cloud Storage' },
};

const audit = (user: string, action: string, country: string): Fields => ({ 'user.name': user, 'event.action': action, 'source.geo.country_iso_code': country });

const atoSequence: DetScenario = {
  id: 'ato-sequence',
  level: 3,
  title: 'Repérer une prise de contrôle de compte',
  goal: 'Journal d’audit des 30 dernières minutes. Une prise de contrôle se reconnaît à un enchaînement : retirer la MFA, changer l’adresse e-mail du compte, exporter les factures. Prise seule, chacune de ces actions est courante.',
  fieldsShown: ['user.name', 'event.action', 'source.geo.country_iso_code'],
  events: [
    { id: 'e1', label: 'marc : MFA désactivée', fields: audit('marc@acme.example', 'authn_mfa_disabled', 'FR'), malicious: true },
    { id: 'e2', label: 'marc : adresse e-mail changée', fields: audit('marc@acme.example', 'user_email_changed', 'FR'), malicious: true },
    { id: 'e3', label: 'marc : export de toutes les factures', fields: audit('marc@acme.example', 'invoice_export', 'FR'), malicious: true },
    { id: 'e4', label: 'claire, en déplacement : adresse e-mail changée', fields: audit('claire@globex.example', 'user_email_changed', 'ES'), malicious: false },
    { id: 'e5', label: 'claire, en déplacement : export de factures', fields: audit('claire@globex.example', 'invoice_export', 'ES'), malicious: false },
    { id: 'e6', label: 'julien : MFA désactivée (nouveau téléphone)', fields: audit('julien@initech.example', 'authn_mfa_disabled', 'FR'), malicious: false },
    { id: 'e7', label: 'nadia : facture créée', fields: audit('nadia@durand.example', 'invoice_created', 'FR'), malicious: false },
    { id: 'e8', label: 'nadia : facture créée', fields: audit('nadia@durand.example', 'invoice_created', 'FR'), malicious: false },
  ],
  conditions: [
    { id: 'sensitive', text: 'event.action : ("authn_mfa_disabled" or "user_email_changed" or "invoice_export")', test: (f) => ['authn_mfa_disabled', 'user_email_changed', 'invoice_export'].includes(s(f, 'event.action')) },
    { id: 'abroad', text: 'not source.geo.country_iso_code : "FR"', test: (f) => f['source.geo.country_iso_code'] !== 'FR' },
    { id: 'mfa', text: 'event.action : "authn_mfa_disabled"', test: (f) => f['event.action'] === 'authn_mfa_disabled' },
  ],
  threshold: { available: [2, 3], groupBy: 'user.name', distinct: 'event.action', label: 'actions sensibles distinctes par user.name', ideal: 3 },
  idealConditions: ['sensitive'],
  why: 'Aucune de ces actions n’est suspecte seule, et claire en fait deux en voyage. C’est l’enchaînement des trois par le même compte qui signe la prise de contrôle : la MFA retirée pour garder la main, l’e-mail changé pour couper les alertes au vrai titulaire, puis l’export. Le pays ne sert à rien, l’attaquant passe par un proxy résidentiel français. Un seuil compte sans ordonner : dans Elastic, une règle EQL « sequence by user.name with maxspan=30m » exprime l’ordre et la fenêtre.',
  attack: { id: 'T1556.006', name: 'Modify Authentication Process: Multi-Factor Authentication' },
};

// ── Le pool et les séries ───────────────────────────────────────────────────

export const detScenarios: DetScenario[] = [
  root, pathScan, honeykey, exfil,
  privesc, impersonation, natCreds, adminRoute,
  stuffing, bolaEnum, massRead, atoSequence,
];

const PROFILES: SeriesProfile<DetScenario>[] = [
  { id: 'un-champ', title: 'Un champ suffit', level: 1, ids: ['root', 'path-scan'],
    text: 'Un seul champ sépare l’attaque du reste. Les autres blocs attrapent du bruit, ou manquent l’événement le plus grave.' },
  { id: 'le-bon-champ', title: 'Le bon champ', level: 1, ids: ['honeykey', 'exfil'],
    text: 'Toujours un seul champ, mais les blocs tentants sont plus proches : un échec qui manque le premier appel, un rôle qui surapprend l’incident.' },
  { id: 'exclusions', title: 'L’exclusion qui tient', level: 2, ids: ['privesc', 'impersonation'],
    text: 'La précision ne tient qu’avec une exclusion : le pipeline Terraform, le robot de supervision. Exclure juste, sans ouvrir d’angle mort.' },
  { id: 'bruit-legitime', title: 'Le bruit légitime', level: 2, ids: ['nat-creds', 'admin-route'],
    text: 'Deux exclusions par règle : le VPC et le NAT, le VPN et la sonde. Le bloc le plus parlant, le pays ou le 403, est un piège.' },
  { id: 'compter', title: 'Compter plutôt que filtrer', level: 3, ids: ['stuffing', 'bola-enum'],
    text: 'Aucun événement n’est suspect seul : il faut un seuil. Le cabinet derrière son NAT et la comptable pressée ressemblent à l’attaque.' },
  { id: 'exclure-puis-correler', title: 'Exclure, puis corréler', level: 3, ids: ['mass-read', 'ato-sequence'],
    text: 'Une exclusion avant le seuil, puis un enchaînement d’actions par compte. Les indices réseau et géographiques ne servent plus.' },
  { id: 'melee', title: 'Mêlée', level: 2, mix: [0, 1, 1], shuffleEachTime: true,
    text: 'Une règle à exclusion et une règle à seuil, tirées à chaque partie. On ne sait pas laquelle arrive en premier.' },
];

export const detSeries = defineSeries(detScenarios, PROFILES);

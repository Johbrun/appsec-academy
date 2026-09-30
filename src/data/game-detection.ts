// Jeu « Detection Builder » (M18) : assembler une règle par blocs, la tester sur des événements, mesurer précision et rappel.

export type DetEvent = { id: string; label: string; fields: Record<string, string | number>; malicious: boolean };
export type Condition = { id: string; text: string; test: (f: Record<string, string | number>) => boolean };
export type DetScenario = {
  id: string;
  title: string;
  goal: string;
  fieldsShown: string[];
  events: DetEvent[];
  conditions: Condition[];
  threshold?: { available: number[]; groupBy: string; label: string; ideal: number };
  idealConditions: string[];
  why: string;
};

export const detScenarios: DetScenario[] = [
  {
    id: 'stuffing',
    title: 'Détecter le credential stuffing',
    goal: 'Alerter sur le rejeu d’identifiants sans déclencher sur les fautes de frappe d’un utilisateur ni sur le bureau derrière un NAT.',
    fieldsShown: ['event.action', 'source.ip', 'user.email', 'user_agent'],
    events: [
      { id: 'e1', label: 'Bot : échec, compte 1', fields: { 'event.action': 'login.failure', 'source.ip': '45.10.0.7', 'user.email': 'a@acme', user_agent: 'okhttp/4' }, malicious: true },
      { id: 'e2', label: 'Bot : échec, compte 2', fields: { 'event.action': 'login.failure', 'source.ip': '45.10.0.7', 'user.email': 'b@globex', user_agent: 'okhttp/4' }, malicious: true },
      { id: 'e3', label: 'Bot : échec, compte 3', fields: { 'event.action': 'login.failure', 'source.ip': '45.10.0.7', 'user.email': 'c@initech', user_agent: 'okhttp/4' }, malicious: true },
      { id: 'e4', label: 'Bot : succès (mdp réutilisé)', fields: { 'event.action': 'login.success', 'source.ip': '45.10.0.7', 'user.email': 'd@acme', user_agent: 'okhttp/4' }, malicious: true },
      { id: 'e5', label: 'Utilisateur : faute de frappe', fields: { 'event.action': 'login.failure', 'source.ip': '88.120.5.2', 'user.email': 'lea@acme', user_agent: 'Chrome/141' }, malicious: false },
      { id: 'e6', label: 'Utilisateur : succès', fields: { 'event.action': 'login.success', 'source.ip': '88.120.5.2', 'user.email': 'lea@acme', user_agent: 'Chrome/141' }, malicious: false },
      { id: 'e7', label: 'Cabinet (NAT) : succès', fields: { 'event.action': 'login.success', 'source.ip': '90.30.1.1', 'user.email': 'p@durand', user_agent: 'Firefox/142' }, malicious: false },
      { id: 'e8', label: 'API mobile légitime', fields: { 'event.action': 'login.success', 'source.ip': '17.5.2.9', 'user.email': 's@acme', user_agent: 'okhttp/4' }, malicious: false },
    ],
    conditions: [
      { id: 'fail', text: 'event.action == "login.failure"', test: (f) => f['event.action'] === 'login.failure' },
      { id: 'success', text: 'event.action == "login.success"', test: (f) => f['event.action'] === 'login.success' },
      { id: 'ua', text: 'user_agent == "okhttp/4"', test: (f) => f.user_agent === 'okhttp/4' },
      { id: 'ip', text: 'source.ip == "45.10.0.7"', test: (f) => f['source.ip'] === '45.10.0.7' },
    ],
    idealConditions: ['fail', 'ua'],
    why: 'Cibler les échecs de connexion depuis un client automatisé attrape les tentatives du bot sans toucher les utilisateurs légitimes. Ajouter l’IP surapprend un seul attaquant ; se fier au seul user-agent frappe l’API mobile. Un seuil par IP affinerait encore la règle.',
  },
  {
    id: 'privesc',
    title: 'Détecter la modification d’IAM hors pipeline',
    goal: 'Alerter quand IAM est modifié par autre chose que le rôle du pipeline Terraform, sans bruit sur l’activité normale.',
    fieldsShown: ['eventName', 'userIdentity.arn', 'sourceIPAddress'],
    events: [
      { id: 'e1', label: 'Rôle support réécrit sa politique', fields: { eventName: 'CreatePolicyVersion', 'userIdentity.arn': 'role/support-tools', sourceIPAddress: '10.0.3.4' }, malicious: true },
      { id: 'e2', label: 'Rôle support s’attache admin', fields: { eventName: 'AttachRolePolicy', 'userIdentity.arn': 'role/support-tools', sourceIPAddress: '10.0.3.4' }, malicious: true },
      { id: 'e3', label: 'Création de clé pour admin', fields: { eventName: 'CreateAccessKey', 'userIdentity.arn': 'role/support-tools', sourceIPAddress: '10.0.3.4' }, malicious: true },
      { id: 'e4', label: 'Pipeline applique un changement IAM', fields: { eventName: 'AttachRolePolicy', 'userIdentity.arn': 'role/terraform-ci', sourceIPAddress: '10.0.9.1' }, malicious: false },
      { id: 'e5', label: 'Pipeline crée un rôle', fields: { eventName: 'CreateRole', 'userIdentity.arn': 'role/terraform-ci', sourceIPAddress: '10.0.9.1' }, malicious: false },
      { id: 'e6', label: 'Lecture de config par un dev', fields: { eventName: 'GetRole', 'userIdentity.arn': 'role/dev-team', sourceIPAddress: '10.0.3.9' }, malicious: false },
      { id: 'e7', label: 'API lit un secret', fields: { eventName: 'GetSecretValue', 'userIdentity.arn': 'role/novafact-api', sourceIPAddress: '10.0.2.2' }, malicious: false },
    ],
    conditions: [
      { id: 'write', text: 'eventName in {Create*, Attach*, Put*} (écriture IAM)', test: (f) => /^(Create|Attach|Put|Update|Delete)/.test(String(f.eventName)) },
      { id: 'read', text: 'eventName in {Get*, List*} (lecture)', test: (f) => /^(Get|List)/.test(String(f.eventName)) },
      { id: 'notci', text: 'userIdentity.arn != "role/terraform-ci"', test: (f) => f['userIdentity.arn'] !== 'role/terraform-ci' },
      { id: 'support', text: 'userIdentity.arn == "role/support-tools"', test: (f) => f['userIdentity.arn'] === 'role/support-tools' },
    ],
    idealConditions: ['write', 'notci'],
    why: 'Alerter sur toute écriture IAM sauf celle du pipeline attrape les trois actions malveillantes sans le bruit des lectures ni du pipeline légitime. Cibler le seul rôle support surapprend un incident précis et manquera le prochain compte compromis.',
  },
  {
    id: 'exfil',
    title: 'Détecter l’exfiltration depuis S3',
    goal: 'Repérer un accès massif au bucket des factures depuis l’extérieur, sans alerter sur le worker PDF légitime.',
    fieldsShown: ['eventName', 'principal', 'network', 'objects'],
    events: [
      { id: 'e1', label: 'Rôle compromis lit en masse (externe)', fields: { eventName: 'GetObject', principal: 'role/analytics', network: 'externe', objects: 5000 }, malicious: true },
      { id: 'e2', label: 'Clé volée liste le bucket (externe)', fields: { eventName: 'ListObjects', principal: 'user/legacy', network: 'externe', objects: 1 }, malicious: true },
      { id: 'e3', label: 'Worker PDF lit une facture (interne)', fields: { eventName: 'GetObject', principal: 'role/pdf-worker', network: 'interne', objects: 1 }, malicious: false },
      { id: 'e4', label: 'Worker PDF, pointe de charge (interne)', fields: { eventName: 'GetObject', principal: 'role/pdf-worker', network: 'interne', objects: 400 }, malicious: false },
      { id: 'e5', label: 'Sauvegarde interne', fields: { eventName: 'GetObject', principal: 'role/backup', network: 'interne', objects: 5000 }, malicious: false },
      { id: 'e6', label: 'API écrit un PDF (interne)', fields: { eventName: 'PutObject', principal: 'role/novafact-api', network: 'interne', objects: 1 }, malicious: false },
    ],
    conditions: [
      { id: 'get', text: 'eventName in {GetObject, ListObjects}', test: (f) => f.eventName === 'GetObject' || f.eventName === 'ListObjects' },
      { id: 'ext', text: 'network == "externe"', test: (f) => f.network === 'externe' },
      { id: 'many', text: 'objects >= 1000', test: (f) => Number(f.objects) >= 1000 },
      { id: 'put', text: 'eventName == "PutObject"', test: (f) => f.eventName === 'PutObject' },
    ],
    idealConditions: ['get', 'ext'],
    why: 'La lecture d’objets depuis le réseau externe distingue l’exfiltration (rôle et clé hors du VPC) de toute l’activité interne légitime, y compris la sauvegarde qui lit pourtant 5 000 objets. Se fier au seul volume déclencherait sur la sauvegarde et manquerait le listing furtif.',
  },
];

// Scénarios du jeu « Log Detective AppSec » (M18) : lire des événements et nommer l'attaque + la technique ATT&CK.
//
// Règle d'écriture : **les noms d'attaques sont de longueur comparable**. Tant
// que « Injection SQL » voisinait avec « SSRF vers les métadonnées d'instance »,
// le nom le plus précis était le bon, et il se repérait sans lire un seul
// événement. Les libellés font donc tous entre trente et quarante caractères, et
// les distracteurs de chaque cas sont des lectures défendables des mêmes lignes.
//
// `npm run games` vérifie que la bonne réponse n'est pas la plus longue.

export type LogEvent = { source: string; line: string; suspect?: boolean };
export type LogCase = {
  id: string;
  context: string;
  events: LogEvent[];
  attack: string;
  attackOptions: string[]; // sans la bonne réponse
  technique: string; // ex. "T1110"
  techniqueName: string;
  techniqueOptions: { id: string; name: string }[]; // sans la bonne réponse
  why: string;
};

export const attackChoices = [
  'Rejeu massif d’identifiants volés',
  'Force brute ciblée sur un compte',
  'Énumération d’objets par un client',
  'Exfiltration massive depuis S3',
  'Escalade de privilèges dans IAM',
  'Injection SQL aveugle sur la recherche',
  'SSRF vers le service de métadonnées',
  'Détournement d’une session valide',
  'Reconnaissance des points d’entrée',
  'Déni de service par expression régulière',
  'Compromission de la chaîne de build',
  'Contournement du second facteur',
  'Récupération de secrets en clair',
  'Exfiltration par un service web tiers',
];

export const techniqueChoices = [
  { id: 'T1110', name: 'Brute Force' },
  { id: 'T1110.004', name: 'Credential Stuffing' },
  { id: 'T1078', name: 'Valid Accounts' },
  { id: 'T1580', name: 'Cloud Infrastructure Discovery' },
  { id: 'T1530', name: 'Data from Cloud Storage' },
  { id: 'T1548', name: 'Abuse Elevation Control Mechanism' },
  { id: 'T1190', name: 'Exploit Public-Facing Application' },
  { id: 'T1526', name: 'Cloud Service Discovery' },
  { id: 'T1071', name: 'Application Layer Protocol' },
  { id: 'T1499', name: 'Endpoint Denial of Service' },
  { id: 'T1111', name: 'Multi-Factor Authentication Interception' },
  { id: 'T1552', name: 'Unsecured Credentials' },
  { id: 'T1567', name: 'Exfiltration Over Web Service' },
  { id: 'T1195.002', name: 'Compromise Software Supply Chain' },
];

export const logCases: LogCase[] = [
  {
    id: 'stuffing',
    context: 'Journaux d’authentification de l’API (pino/ECS), fenêtre de 2 minutes.',
    events: [
      { source: 'api.auth', line: 'event.action=login.failure user.email=a.martin@acme.example source.ip=45.map[…] http.request.headers.user-agent="okhttp/4"', suspect: true },
      { source: 'api.auth', line: 'event.action=login.failure user.email=c.durand@globex.example source.ip=45.map[…] user-agent="okhttp/4"', suspect: true },
      { source: 'api.auth', line: 'event.action=login.failure user.email=p.bernard@initech.example source.ip=45.map[…] user-agent="okhttp/4"', suspect: true },
      { source: 'api.auth', line: 'event.action=login.success user.email=s.leroy@acme.example source.ip=45.map[…] user-agent="okhttp/4"', suspect: true },
      { source: 'api.auth', line: '… 1 200 tentatives sur 1 150 comptes distincts en 90 s, un seul essai par compte' },
    ],
    attack: 'Rejeu massif d’identifiants volés',
    attackOptions: ['Force brute ciblée sur un compte', 'Reconnaissance des points d’entrée', 'Déni de service par expression régulière'],
    technique: 'T1110.004',
    techniqueName: 'Credential Stuffing',
    techniqueOptions: [{ id: 'T1110', name: 'Brute Force' }, { id: 'T1078', name: 'Valid Accounts' }, { id: 'T1071', name: 'Application Layer Protocol' }],
    why: 'Beaucoup de comptes distincts, un seul essai chacun, depuis peu d’adresses : c’est du rejeu d’identifiants volés ailleurs (T1110.004), et non une force brute qui s’acharne sur un compte. Le succès isolé signale une réutilisation de mot de passe.',
  },
  {
    id: 'imds',
    context: 'Journaux applicatifs de l’API et flux VPC de la tâche ECS.',
    events: [
      { source: 'api.http', line: 'event.action=pdf.import url.path=/api/imports body.logo_url="http://169.254.169.254/latest/meta-data/iam/security-credentials/"', suspect: true },
      { source: 'api.egress', line: 'destination.ip=169.254.169.254 destination.port=80 process=node http.response.status_code=200', suspect: true },
      { source: 'aws.cloudtrail', line: 'eventName=GetCallerIdentity userAgent=aws-sdk-js sourceIPAddress=203.0.113.map[…] (hors du VPC)', suspect: true },
      { source: 'aws.cloudtrail', line: 'eventName=ListBuckets sourceIPAddress=203.0.113.map[…]', suspect: true },
    ],
    attack: 'SSRF vers le service de métadonnées',
    attackOptions: ['Exfiltration massive depuis S3', 'Injection SQL aveugle sur la recherche', 'Escalade de privilèges dans IAM'],
    technique: 'T1580',
    techniqueName: 'Cloud Infrastructure Discovery',
    techniqueOptions: [{ id: 'T1530', name: 'Data from Cloud Storage' }, { id: 'T1190', name: 'Exploit Public-Facing Application' }, { id: 'T1110', name: 'Brute Force' }],
    why: 'Une URL fournie par l’utilisateur vise 169.254.169.254, la tâche y accède, puis les identifiants du rôle servent depuis une adresse externe. L’escalade IAM est la suite possible, pas ce que montrent ces lignes. IMDSv2 (M16) aurait bloqué la première étape.',
  },
  {
    id: 'bola',
    context: 'Journaux d’accès de l’API, un seul utilisateur authentifié.',
    events: [
      { source: 'api.http', line: 'user.id=u_881 tenant=acme event.action=invoice.read invoice.id=inv_acme_0450 status=200' },
      { source: 'api.http', line: 'user.id=u_881 tenant=acme event.action=invoice.read invoice.id=inv_acme_0451 status=404', suspect: true },
      { source: 'api.http', line: 'user.id=u_881 tenant=acme event.action=invoice.read invoice.id=inv_acme_0452 status=404', suspect: true },
      { source: 'api.http', line: 'user.id=u_881 … 4 000 lectures séquentielles en 5 min, 99 % de 404, quelques 200', suspect: true },
    ],
    attack: 'Énumération d’objets par un client',
    attackOptions: ['Exfiltration massive depuis S3', 'Rejeu massif d’identifiants volés', 'Déni de service par expression régulière'],
    technique: 'T1526',
    techniqueName: 'Cloud Service Discovery',
    techniqueOptions: [{ id: 'T1530', name: 'Data from Cloud Storage' }, { id: 'T1110', name: 'Brute Force' }, { id: 'T1078', name: 'Valid Accounts' }],
    why: 'Un seul compte parcourt des identifiants séquentiels avec une écrasante majorité de 404 : c’est de la découverte, à la recherche d’objets accessibles. Le contrôle par tenant tient — ce sont les 404 — et le comportement mérite quand même une alerte. Des identifiants non devinables (M8) fermeraient la question.',
  },
  {
    id: 'privesc',
    context: 'CloudTrail, compte de production.',
    events: [
      { source: 'aws.cloudtrail', line: 'eventName=CreatePolicyVersion userIdentity.arn=role/support-tools requestParameters.setAsDefault=true', suspect: true },
      { source: 'aws.cloudtrail', line: 'eventName=AttachRolePolicy roleName=support-tools policyArn=…/AdministratorAccess', suspect: true },
      { source: 'aws.cloudtrail', line: 'eventName=GetCallerIdentity userIdentity.arn=role/support-tools' },
      { source: 'aws.cloudtrail', line: 'eventName=CreateAccessKey userName=break-glass-admin', suspect: true },
    ],
    attack: 'Escalade de privilèges dans IAM',
    attackOptions: ['Exfiltration massive depuis S3', 'Détournement d’une session valide', 'Reconnaissance des points d’entrée'],
    technique: 'T1548',
    techniqueName: 'Abuse Elevation Control Mechanism',
    techniqueOptions: [{ id: 'T1078', name: 'Valid Accounts' }, { id: 'T1580', name: 'Cloud Infrastructure Discovery' }, { id: 'T1190', name: 'Exploit Public-Facing Application' }],
    why: 'Un rôle publie une version de sa propre politique, s’attache AdministratorAccess, puis crée une clé pour un compte d’urgence : c’est la séquence d’élévation du Pathfinder (M15). Toute gestion d’IAM hors du pipeline d’infrastructure devrait alerter immédiatement.',
  },
  {
    id: 'token-theft',
    context: 'Journaux d’authentification et d’accès, compte d’un administrateur de tenant.',
    events: [
      { source: 'api.auth', line: 'event.action=session.start user.id=u_204 source.ip=88.map[FR] user-agent="Chrome/141 macOS"' },
      { source: 'api.http', line: 'user.id=u_204 event.action=invoice.read source.ip=88.map[FR] user-agent="Chrome/141 macOS"' },
      { source: 'api.http', line: 'user.id=u_204 event.action=settings.update source.ip=196.map[ZA] user-agent="python-requests/2"', suspect: true },
      { source: 'api.http', line: 'user.id=u_204 event.action=apikey.create source.ip=196.map[ZA] user-agent="python-requests/2"', suspect: true },
    ],
    attack: 'Détournement d’une session valide',
    attackOptions: ['Rejeu massif d’identifiants volés', 'Force brute ciblée sur un compte', 'Contournement du second facteur'],
    technique: 'T1078',
    techniqueName: 'Valid Accounts',
    techniqueOptions: [{ id: 'T1110', name: 'Brute Force' }, { id: 'T1110.004', name: 'Credential Stuffing' }, { id: 'T1530', name: 'Data from Cloud Storage' }],
    why: 'La même session passe de la France à l’Afrique du Sud et d’un navigateur à un client script en quelques minutes : c’est un jeton rejoué ailleurs, pas une authentification forcée — aucun échec ne précède. Lier la session à un contexte et réauthentifier les actions sensibles limite l’impact.',
  },
  {
    id: 's3-dump',
    context: 'CloudTrail données et journaux d’accès S3, nuit de samedi.',
    events: [
      { source: 'aws.cloudtrail', line: 'eventName=GetObject bucket=novafact-invoices key=pdf/acme/… userIdentity.arn=role/api-task sourceIPAddress=203.0.113.map[…]', suspect: true },
      { source: 'aws.s3', line: '… 48 000 GetObject en 40 min, 214 préfixes de tenants distincts, 11 Go transférés', suspect: true },
      { source: 'aws.cloudtrail', line: 'eventName=ListObjectsV2 bucket=novafact-invoices prefix="" (racine du compartiment)', suspect: true },
      { source: 'api.http', line: 'aucune requête applicative correspondante sur la même période' },
    ],
    attack: 'Exfiltration massive depuis S3',
    attackOptions: ['Énumération d’objets par un client', 'SSRF vers le service de métadonnées', 'Escalade de privilèges dans IAM'],
    technique: 'T1530',
    techniqueName: 'Data from Cloud Storage',
    techniqueOptions: [{ id: 'T1526', name: 'Cloud Service Discovery' }, { id: 'T1567', name: 'Exfiltration Over Web Service' }, { id: 'T1078', name: 'Valid Accounts' }],
    why: 'Le rôle applicatif lit le compartiment depuis une adresse hors du VPC, à un volume sans rapport avec le trafic applicatif — lequel est nul. On lit les objets, on ne cherche pas lesquels existent : c’est de la collecte, pas de la découverte. Les identifiants du rôle ont fuité avant cette ligne.',
  },
  {
    id: 'blind-sqli',
    context: 'Journaux d’accès de l’API et métriques de latence de la base.',
    events: [
      { source: 'api.http', line: 'url.path=/api/customers/search query.q="acme\' AND SLEEP(5)--" status=200 event.duration=5 041 ms', suspect: true },
      { source: 'api.http', line: 'url.path=/api/customers/search query.q="acme\' AND SLEEP(1)--" status=200 event.duration=1 038 ms', suspect: true },
      { source: 'api.http', line: '… 3 400 requêtes de recherche en 20 min, durées régulièrement étagées', suspect: true },
      { source: 'postgres', line: 'aucune erreur de syntaxe journalisée sur la période' },
    ],
    attack: 'Injection SQL aveugle sur la recherche',
    attackOptions: ['Déni de service par expression régulière', 'Énumération d’objets par un client', 'Reconnaissance des points d’entrée'],
    technique: 'T1190',
    techniqueName: 'Exploit Public-Facing Application',
    techniqueOptions: [{ id: 'T1499', name: 'Endpoint Denial of Service' }, { id: 'T1526', name: 'Cloud Service Discovery' }, { id: 'T1552', name: 'Unsecured Credentials' }],
    why: 'Les réponses sont en 200 et l’information circule par la durée : c’est une injection en aveugle, que la corrélation entre le délai demandé et la latence observée trahit. L’absence d’erreur SQL est le piège — une injection réussie n’en produit pas.',
  },
  {
    id: 'redos',
    context: 'Métriques du processus Node et journaux de la passerelle.',
    events: [
      { source: 'api.http', line: 'url.path=/api/invoices query.label="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa!" status=504', suspect: true },
      { source: 'node.metrics', line: 'event_loop_delay p99=8 400 ms cpu=99 % heap stable, aucune allocation anormale', suspect: true },
      { source: 'api.http', line: '12 requêtes en tout sur la période, dont 4 vers /api/invoices avec un libellé long', suspect: true },
      { source: 'alb', line: 'target 5xx sur les trois instances, health checks en échec' },
    ],
    attack: 'Déni de service par expression régulière',
    attackOptions: ['Injection SQL aveugle sur la recherche', 'Exfiltration par un service web tiers', 'Reconnaissance des points d’entrée'],
    technique: 'T1499',
    techniqueName: 'Endpoint Denial of Service',
    techniqueOptions: [{ id: 'T1190', name: 'Exploit Public-Facing Application' }, { id: 'T1071', name: 'Application Layer Protocol' }, { id: 'T1110', name: 'Brute Force' }],
    why: 'Douze requêtes suffisent à saturer trois instances : le volume ne fait pas le déni de service, c’est le coût unitaire. La boucle d’événements bloquée avec un tas stable écarte la fuite mémoire et désigne un calcul, ici un motif à retour arrière catastrophique.',
  },
  {
    id: 'mfa-replay',
    context: 'Journaux d’authentification, compte d’un gestionnaire de paie.',
    events: [
      { source: 'api.auth', line: 'event.action=mfa.verify user.id=u_517 code=482913 result=success source.ip=91.map[FR]' },
      { source: 'api.auth', line: 'event.action=mfa.verify user.id=u_517 code=482913 result=success source.ip=91.map[FR]', suspect: true },
      { source: 'api.auth', line: 'event.action=mfa.verify user.id=u_517 code=482913 result=success source.ip=91.map[FR]', suspect: true },
      { source: 'api.auth', line: '3 sessions ouvertes en 900 ms, même code, même adresse, trois empreintes de client', suspect: true },
    ],
    attack: 'Contournement du second facteur',
    attackOptions: ['Détournement d’une session valide', 'Force brute ciblée sur un compte', 'Rejeu massif d’identifiants volés'],
    technique: 'T1111',
    techniqueName: 'Multi-Factor Authentication Interception',
    techniqueOptions: [{ id: 'T1078', name: 'Valid Accounts' }, { id: 'T1110', name: 'Brute Force' }, { id: 'T1110.004', name: 'Credential Stuffing' }],
    why: 'Le même code est accepté trois fois en moins d’une seconde : le facteur existe et sa consommation n’est pas atomique. Ce n’est pas du devinage — il n’y a aucun échec — mais un rejeu qui traverse la fenêtre entre la vérification et le marquage (voir « Race Window »).',
  },
  {
    id: 'ci-secrets',
    context: 'Journaux de la forge et du registre de paquets, après une pull request externe.',
    events: [
      { source: 'github.actions', line: 'workflow=e2e.yml event=pull_request_target ref=refs/pull/318/merge actor=nouveau-contributeur', suspect: true },
      { source: 'github.actions', line: 'step="Run e2e" command="node scripts/e2e.js ${{ github.event.pull_request.title }}"', suspect: true },
      { source: 'runner.egress', line: 'destination=paste.example.net bytes_out=4 812 durant l’étape « Run e2e »', suspect: true },
      { source: 'npm.registry', line: 'aucune publication anormale sur la période' },
    ],
    attack: 'Récupération de secrets en clair',
    attackOptions: ['Compromission de la chaîne de build', 'Exfiltration par un service web tiers', 'Injection SQL aveugle sur la recherche'],
    technique: 'T1552',
    techniqueName: 'Unsecured Credentials',
    techniqueOptions: [{ id: 'T1195.002', name: 'Compromise Software Supply Chain' }, { id: 'T1567', name: 'Exfiltration Over Web Service' }, { id: 'T1190', name: 'Exploit Public-Facing Application' }],
    why: 'Un titre de pull request interpolé dans une commande, sur un déclencheur qui donne accès aux secrets : le runner exécute ce que le contributeur a écrit, et les variables d’environnement partent. Rien n’est encore publié, donc la chaîne de build n’est pas compromise — les secrets, si.',
  },
  {
    id: 'action-tamper',
    context: 'Journaux de la forge, sur l’ensemble des dépôts de l’organisation.',
    events: [
      { source: 'github.actions', line: 'uses=tiers/changed-files@v42 resolved_sha=b4ec3a… (le tag pointait sur 9f1c02… la veille)', suspect: true },
      { source: 'runner.log', line: 'step "changed-files" a exécuté un script distant non présent dans le dépôt de l’action', suspect: true },
      { source: 'github.actions', line: '214 workflows dans 41 dépôts ont exécuté cette étape en 6 heures', suspect: true },
      { source: 'github.audit', line: 'plusieurs secrets d’organisation apparaissent en clair dans des journaux de build publics', suspect: true },
    ],
    attack: 'Compromission de la chaîne de build',
    attackOptions: ['Récupération de secrets en clair', 'Escalade de privilèges dans IAM', 'Exfiltration par un service web tiers'],
    technique: 'T1195.002',
    techniqueName: 'Compromise Software Supply Chain',
    techniqueOptions: [{ id: 'T1552', name: 'Unsecured Credentials' }, { id: 'T1567', name: 'Exfiltration Over Web Service' }, { id: 'T1078', name: 'Valid Accounts' }],
    why: 'Un tag mutable a été déplacé vers un commit malveillant, et tout ce qui référençait ce tag l’a exécuté : la fuite de secrets est la conséquence, la compromission de la dépendance est la cause. L’épinglage par SHA complet (M14) l’aurait empêché sur les 41 dépôts.',
  },
  {
    id: 'webhook-exfil',
    context: 'Journaux applicatifs et flux sortants, fonctionnalité de webhooks clients.',
    events: [
      { source: 'api.http', line: 'event.action=webhook.update tenant=globex url="https://hooks.example.io/T0/B4/xxxx"' },
      { source: 'api.egress', line: 'destination=hooks.example.io bytes_out=38 payload=invoice.created (nominal)' },
      { source: 'api.http', line: 'event.action=export.run tenant=globex rows=412 000 destination=webhook', suspect: true },
      { source: 'api.egress', line: 'destination=hooks.example.io bytes_out=96 Mo en 12 min, 412 000 événements', suspect: true },
    ],
    attack: 'Exfiltration par un service web tiers',
    attackOptions: ['Exfiltration massive depuis S3', 'Énumération d’objets par un client', 'SSRF vers le service de métadonnées'],
    technique: 'T1567',
    techniqueName: 'Exfiltration Over Web Service',
    techniqueOptions: [{ id: 'T1530', name: 'Data from Cloud Storage' }, { id: 'T1526', name: 'Cloud Service Discovery' }, { id: 'T1071', name: 'Application Layer Protocol' }],
    why: 'La destination est légitime, déclarée par le client, et c’est ce qui rend le flux invisible aux règles de sortie : seul le volume dénonce. Les données quittent l’application par une fonctionnalité prévue — le contrôle manquant est une limite de débit sur les exports, pas un filtre réseau.',
  },
];

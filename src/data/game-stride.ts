// DFD et cartes de menaces du jeu « STRIDE Cards » (M11).

export type DfdKind = 'entity' | 'process' | 'store';
export type DfdNode = { id: string; label: string; kind: DfdKind; x: number; y: number };

export const dfdNodes: DfdNode[] = [
  { id: 'user', label: 'Utilisateur', kind: 'entity', x: 95, y: 215 },
  { id: 'stripe', label: 'Stripe', kind: 'entity', x: 470, y: 42 },
  { id: 'bff', label: 'BFF', kind: 'process', x: 285, y: 215 },
  { id: 'api', label: 'API Express', kind: 'process', x: 470, y: 215 },
  { id: 'ai', label: 'Assistant IA', kind: 'process', x: 285, y: 370 },
  { id: 'worker', label: 'Worker PDF', kind: 'process', x: 470, y: 370 },
  { id: 'db', label: 'Postgres', kind: 'store', x: 735, y: 135 },
  { id: 'logs', label: 'Logs Elastic', kind: 'store', x: 735, y: 250 },
  { id: 's3', label: 'S3 factures', kind: 'store', x: 735, y: 370 },
];

// [de, vers, bidirectionnel]
export const dfdFlows: [string, string, boolean][] = [
  ['user', 'bff', true],
  ['bff', 'api', true],
  ['stripe', 'api', false],
  ['api', 'db', true],
  ['api', 'logs', false],
  ['api', 'worker', false],
  ['worker', 's3', false],
  ['bff', 'ai', true],
  ['ai', 'api', true],
];

export type Stride = 'S' | 'T' | 'R' | 'I' | 'D' | 'E';
export const strideNames: Record<Stride, string> = {
  S: 'Usurpation',
  T: 'Altération',
  R: 'Répudiation',
  I: 'Divulgation',
  D: 'Déni de service',
  E: 'Élévation de privilèges',
};

export type ThreatCard = { text: string; el: string[]; stride: Stride; mitigation: string };

export const threatCards: ThreatCard[] = [
  { text: 'Un faux webhook, non signé, se fait passer pour Stripe et annonce qu’une facture est payée.', el: ['stripe', 'api'], stride: 'S', mitigation: 'Vérifier la signature HMAC du webhook avec son horodatage, rejeter les événements trop anciens ou déjà traités.' },
  { text: 'Le montant d’une facture déjà émise est modifié par un endpoint d’import qui écrit directement en base.', el: ['db', 'api'], stride: 'T', mitigation: 'Facture émise immuable : toute écriture passe par la machine à états, avec une contrainte en base et un avoir pour corriger.' },
  { text: 'Un comptable nie avoir émis un avoir de 12 000 €, et rien ne permet de prouver qui l’a fait.', el: ['logs', 'api'], stride: 'R', mitigation: 'Journal d’audit en ajout seul : identité, tenant, action, objet et horodatage, conservé hors de portée des administrateurs applicatifs.' },
  { text: 'Les PDF de factures sont servis par des URL publiques permanentes.', el: ['s3'], stride: 'I', mitigation: 'Bucket privé avec Block Public Access, URL présignées courtes délivrées après contrôle d’autorisation.' },
  { text: 'Les logs applicatifs contiennent les jetons d’accès et les IBAN des clients.', el: ['logs'], stride: 'I', mitigation: 'Liste blanche des champs journalisés et masquage à la source, avant l’envoi vers Elastic.' },
  { text: 'Un tenant lance 50 000 générations de PDF d’un coup et bloque la file pour tous les autres.', el: ['worker'], stride: 'D', mitigation: 'Quotas par tenant, file équitable entre tenants, limites de taille et de durée par tâche.' },
  { text: 'L’assistant appelle l’outil de remboursement avec son compte de service, quel que soit l’utilisateur qui le demande.', el: ['ai'], stride: 'E', mitigation: 'L’agent agit avec les droits délégués de l’utilisateur ; les actions sensibles demandent une confirmation humaine.' },
  { text: 'Un utilisateur au rôle Lecteur envoie role=admin dans la mise à jour de son profil, et l’API l’enregistre.', el: ['api'], stride: 'E', mitigation: 'Liste blanche des champs modifiables par action, et autorisation par fonction pour les changements de rôle.' },
  { text: 'Le BFF conserve le même identifiant de session avant et après la connexion.', el: ['bff'], stride: 'S', mitigation: 'Régénérer l’identifiant de session à l’authentification ; cookie __Host-, Secure, HttpOnly, SameSite.' },
  { text: 'Le worker lit une file où tous les services internes peuvent écrire des messages « générer la facture X du tenant Y ».', el: ['worker'], stride: 'T', mitigation: 'File dédiée avec une politique d’écriture limitée à l’API, et vérification du tenant par le worker lui-même.' },
  { text: 'Un tenant lit les factures d’un autre en changeant l’identifiant dans l’URL.', el: ['api'], stride: 'I', mitigation: 'Filtre par tenant imposé dans la couche d’accès aux données, doublé de la RLS Postgres.' },
  { text: 'Des requêtes à l’assistant avec d’énormes documents font exploser la facture du fournisseur de modèle.', el: ['ai'], stride: 'D', mitigation: 'Limites de taille et de jetons par requête, quotas et budgets par tenant, coupure automatique.' },
];

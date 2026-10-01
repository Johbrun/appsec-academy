// Registre des exercices du lab. Partagé par l'API (qui décerne les drapeaux),
// l'interface (qui les affiche) et les tests de `npm run verify`.
//
// Un exercice est résolu quand le serveur constate lui-même que l'invariant de
// sécurité est rompu — jamais sur déclaration de l'apprenant. La chaîne est donc
// : exploiter (drapeau) → corriger le code → `npm run verify` (le test exige que
// l'attaque échoue ET que la fonctionnalité légitime marche encore).

export type Level = 1 | 2 | 3;
export type Csslp = 'D1' | 'D2' | 'D3' | 'D4' | 'D5' | 'D6' | 'D7' | 'D8';

/**
 * `live` : le challenge est jouable, son défaut est dans le code du lab.
 * `planned` : il est spécifié mais pas encore implémenté. Il figure dans
 * CHALLENGES.md et nulle part ailleurs — l'API, l'interface et les tests ne
 * servent que les `live`.
 */
export type Status = 'live' | 'planned';

/**
 * `exploit` : on atteint l'objectif par des requêtes, le serveur constate.
 *
 * `fix` : le défaut est dans un artefact de configuration (workflow, Terraform,
 * Dockerfile, politique IAM). Il n'y a rien à exploiter depuis le navigateur :
 * on l'audite et on le corrige, et c'est la correction qui est vérifiée.
 *
 * `artifact` : l'apprenant **produit** un fichier — une règle, un test, un
 * document VEX, un modèle de menaces — et c'est ce fichier qui est jugé. C'est
 * ce qui rend praticables les domaines qui résistent autrement : exigences,
 * triage, threat modeling, revue de code.
 *
 * Deux motifs de correction tiennent ces exercices, et aucun autre n'est aussi
 * solide. Le **double passage** : l'artefact de l'apprenant doit échouer contre
 * le code vulnérable et passer contre `solutions/` — un test qui passe partout
 * ne prouve rien, un test qui échoue partout casse la fonctionnalité. Et le
 * **différentiel valide/invalide** : la règle écrite est exécutée contre des
 * jeux que le harnais détient, ce qui interdit de coder le résultat en dur.
 */
export type Kind = 'exploit' | 'fix' | 'artifact';

export interface ExerciseDef {
  id: string;
  module: string;        // "m02" — renvoie au module du PROGRAMME
  title: string;
  status: Status;
  kind: Kind;
  level: Level;
  csslp: Csslp[];
  cwe: string;
  /** Le contexte métier Novafact. */
  brief: string;
  /** L'objectif, formulé comme une violation d'invariant observable. */
  goal: string;
  /**
   * Le fichier qui porte le défaut — ou, pour un challenge `artifact`, le
   * fichier que l'apprenant doit produire.
   */
  file: string;
  /**
   * Leçons du site qui traitent cette classe de bugs, « module/leçon ».
   * La première est la leçon de référence de l'exercice.
   */
  lessons: string[];
  hints: string[];
  /** La classe de bugs à éliminer, pas juste l'instance. */
  fix: string;
  k?: number[];          // chapitres Kohnfelder
}

const baseExercises: ExerciseDef[] = [
  // ─── m02 · Vulnérabilités web, écosystème JS ────────────────────────────────
  {
    id: 'nosql-auth',
    module: 'm02',
    title: 'Injection NoSQL dans la connexion',
    status: 'live',
    kind: 'exploit',
    level: 1,
    csslp: ['D5'],
    cwe: 'CWE-943',
    k: [10],
    brief:
      'Le formulaire de connexion passe `req.body` tel quel au moteur de requêtes des comptes. Le moteur du lab reproduit les opérateurs de Mongo ($ne, $gt, $regex, $in).',
    goal: 'Te connecter en tant que admin@novafact.example sans connaître son mot de passe.',
    file: 'server/routes/auth.ts',
    lessons: ['m02/l01', 'm02/l09'],
    hints: [
      'Le champ mot de passe n’est pas forcément une chaîne : JSON accepte un objet.',
      'Quel opérateur Mongo est vrai pour à peu près n’importe quelle valeur stockée ?',
      'Essaie {"email":"admin@novafact.example","password":{"$ne":null}} sur POST /api/auth/login.',
    ],
    fix: 'Valider par schéma (zod/ajv) avant la couche de données, et refuser toute clé commençant par $. Le schéma doit être imposé par le framework, pas rappelé dans chaque route.',
  },
  {
    id: 'mass-assignment',
    module: 'm02',
    title: 'Mass assignment sur le profil',
    status: 'live',
    kind: 'exploit',
    level: 1,
    csslp: ['D5'],
    cwe: 'CWE-915',
    brief:
      'La mise à jour du profil fusionne le corps de la requête dans l’objet utilisateur, pour « ne pas avoir à lister les champs ».',
    goal: 'Faire passer ton compte dev@acme.example au rôle admin.',
    file: 'server/routes/profile.ts',
    lessons: ['m02/l01', 'm12/l03'],
    hints: [
      'Regarde ce que la route fait exactement du corps de la requête.',
      'Quels champs de l’utilisateur ne sont pas censés venir du client ?',
      'PATCH /api/me avec {"role":"admin"}.',
    ],
    fix: 'Construire explicitement l’objet des champs autorisés (liste blanche), jamais Object.assign / spread du corps brut. Séparer le DTO d’entrée du modèle persisté.',
  },
  {
    id: 'bola-invoice',
    module: 'm02',
    title: 'BOLA : la facture du voisin',
    status: 'live',
    kind: 'exploit',
    level: 1,
    csslp: ['D5'],
    cwe: 'CWE-639',
    brief:
      'GET /api/invoices/:id vérifie que tu es authentifié, puis charge la facture par son identifiant. L’autorisation est laissée « à la charge de chaque route ».',
    goal: 'Lire une facture du tenant globex depuis ton compte acme.',
    file: 'server/routes/invoices.ts',
    lessons: ['m02/l01', 'm09/l02', 'm12/l05'],
    hints: [
      'Authentifié ne veut pas dire autorisé.',
      'Les identifiants de facture sont séquentiels : INV-1001, INV-1002…',
      'Liste tes factures, puis demande un identifiant voisin.',
    ],
    fix: 'Filtrer par tenant dans la couche d’accès aux données elle-même (un repository qui exige le tenant, ou RLS PostgreSQL), pour qu’aucune route ne puisse l’oublier.',
  },
  {
    id: 'proto-pollution',
    module: 'm02',
    title: 'Prototype pollution côté serveur',
    status: 'live',
    kind: 'exploit',
    level: 2,
    csslp: ['D5'],
    cwe: 'CWE-1321',
    k: [8],
    brief:
      'Les préférences utilisateur sont fusionnées récursivement dans les réglages stockés, avec un deepMerge maison.',
    goal:
      'Polluer Object.prototype pour que le contrôle d’accès de l’export comptable te croie autorisé, puis déclencher GET /api/export.',
    file: 'server/routes/settings.ts',
    lessons: ['m02/l03', 'm03/l09'],
    hints: [
      'Le deepMerge recopie toutes les clés, y compris celles qui ont un sens particulier.',
      'L’export vérifie une propriété qui n’existe pas sur les objets ordinaires.',
      'PUT /api/settings avec {"__proto__":{"canExport":true}} puis GET /api/export.',
    ],
    fix: 'Objets sans prototype (Object.create(null)) ou Map pour les données venant du réseau, rejet des clés __proto__ / constructor / prototype, schéma strict. Ne jamais faire dépendre une décision d’autorisation d’une propriété héritée.',
  },
  {
    id: 'money-float',
    module: 'm02',
    title: 'Arithmétique de l’argent',
    status: 'live',
    kind: 'exploit',
    level: 1,
    csslp: ['D5'],
    cwe: 'CWE-681',
    k: [9],
    brief:
      'Les lignes de facture sont calculées en flottants et les quantités ne sont pas bornées côté serveur.',
    goal: 'Créer une facture dont le total est strictement négatif.',
    file: 'server/routes/invoices.ts',
    lessons: ['m02/l02', 'm10/l06'],
    hints: [
      'Qui valide la quantité et le prix unitaire ?',
      'Une remise, une quantité, un prix : lequel accepte un signe moins ?',
      'POST /api/invoices avec une ligne de quantité négative.',
    ],
    fix: 'Montants en centimes entiers (ou décimal), quantités entières positives imposées par le schéma, total recalculé côté serveur et invariant « total >= 0 » vérifié avant persistance.',
  },
  {
    id: 'redos',
    module: 'm02',
    title: 'ReDoS sur la référence de facture',
    status: 'live',
    kind: 'exploit',
    level: 2,
    csslp: ['D5'],
    cwe: 'CWE-1333',
    brief:
      'La recherche de factures valide la référence fournie avec une expression régulière à quantificateurs imbriqués, sur la boucle d’événements.',
    goal: 'Faire dépasser 1 seconde de calcul à la route de recherche avec une seule requête.',
    file: 'server/routes/invoices.ts',
    lessons: ['m02/l03', 'm13/l05'],
    hints: [
      'Regarde la forme de la regex : un groupe répété, lui-même répété.',
      'Le pire cas se déclenche sur une chaîne longue qui presque correspond.',
      'GET /api/invoices/search?ref= suivi d’une vingtaine de « a » et d’un « ! » final.',
    ],
    fix: 'Regex linéaires (pas de quantificateur imbriqué), longueur d’entrée bornée avant le test, ou moteur RE2. Le CPU de la boucle d’événements est une ressource partagée : la disponibilité est une exigence de sécurité (K12).',
  },
  {
    id: 'path-traversal',
    module: 'm02',
    title: 'Traversée de chemin sur les pièces jointes',
    status: 'live',
    kind: 'exploit',
    level: 2,
    csslp: ['D5'],
    cwe: 'CWE-22',
    brief:
      'Le téléchargement d’une pièce jointe concatène le nom demandé au dossier des pièces jointes du lab.',
    goal: 'Lire le fichier server/secrets/aws-credentials.txt via la route de téléchargement.',
    file: 'server/routes/attachments.ts',
    lessons: ['m02/l03', 'm08/l02'],
    hints: [
      'path.join ne quitte pas le dossier ; il l’accepte pourtant si on le lui demande.',
      'Les segments ../ sont interprétés avant que le chemin final soit ouvert.',
      'GET /api/attachments/../../secrets/aws-credentials.txt (pense à l’encodage).',
    ],
    fix: 'Ne jamais dériver un chemin du client : identifiant opaque → chemin résolu depuis un index côté serveur. À défaut, path.resolve puis vérifier que le résultat commence par la racine autorisée.',
  },
  {
    id: 'ssrf-imds',
    module: 'm02',
    title: 'SSRF vers le service de métadonnées',
    status: 'live',
    kind: 'exploit',
    level: 2,
    csslp: ['D5', 'D7'],
    cwe: 'CWE-918',
    brief:
      'Le test de webhook récupère l’URL fournie par le client pour montrer la réponse. Le lab héberge un faux service de métadonnées d’instance (IMDSv1) sur la boucle locale — rien ne sort de ta machine.',
    goal:
      'Récupérer le rôle de la tâche ECS de Novafact depuis le faux IMDS, via la route de test de webhook.',
    file: 'server/routes/webhooks.ts',
    lessons: ['m02/l03', 'm03/l11', 'm15/l03'],
    hints: [
      'Le test accepte n’importe quelle URL, y compris une adresse locale.',
      'Le faux IMDS du lab écoute sur 127.0.0.1:4318, chemin /latest/meta-data/iam/security-credentials/.',
      'POST /api/webhooks/test avec {"url":"http://127.0.0.1:4318/latest/meta-data/iam/security-credentials/novafact-task-role"}.',
    ],
    fix: 'Proxy de sortie avec liste blanche de destinations, résolution DNS puis vérification de l’IP obtenue (et re-vérification après redirection), IMDSv2 exigé au niveau de l’instance, pas de réponse renvoyée au client.',
  },

  // ─── m03 · Web avancé ───────────────────────────────────────────────────────
  {
    id: 'race-credit',
    module: 'm03',
    title: 'Race condition : l’avoir dépensé deux fois',
    status: 'live',
    kind: 'exploit',
    level: 2,
    csslp: ['D5'],
    cwe: 'CWE-362',
    brief:
      'L’application d’un avoir lit le solde, vérifie qu’il est suffisant, puis débite. Il y a un await entre la vérification et l’écriture.',
    goal: 'Consommer plus que le solde de ton avoir en le dépensant plusieurs fois en parallèle.',
    file: 'server/routes/credits.ts',
    lessons: ['m03/l01', 'm02/l04'],
    hints: [
      'Le contrôle et l’écriture ne sont pas atomiques : la fenêtre est le temps du await.',
      'Envoie plusieurs requêtes en parallèle plutôt qu’à la suite (Promise.all, ou l’onglet Course du lab).',
      'POST /api/credits/apply ×5 simultanément.',
    ],
    fix: 'Rendre l’opération atomique : contrainte unique, transaction avec SELECT … FOR UPDATE, update conditionnel (WHERE solde >= montant), opérateur atomique Mongo, ou clé d’idempotence. Le correctif est dans la base, pas dans le code applicatif.',
  },
  {
    id: 'host-header',
    module: 'm03',
    title: 'Empoisonnement du lien de réinitialisation',
    status: 'live',
    kind: 'exploit',
    level: 2,
    csslp: ['D5'],
    cwe: 'CWE-640',
    brief:
      'Le mail de réinitialisation construit son lien absolu à partir de l’en-tête Host de la requête, « pour marcher dans tous les environnements ».',
    goal:
      'Provoquer un mail de réinitialisation pour admin@novafact.example dont le lien pointe vers un domaine que tu contrôles.',
    file: 'server/routes/auth.ts',
    lessons: ['m03/l02', 'm09/l01'],
    hints: [
      'Regarde d’où vient l’origine du lien dans le mail.',
      'Express fait confiance à X-Forwarded-Host quand trust proxy est actif.',
      'POST /api/auth/forgot avec l’en-tête X-Forwarded-Host: evil.example — le mail part dans la boîte d’envoi du lab (onglet Mails).',
    ],
    fix: 'L’URL publique vient de la configuration, jamais de la requête. Si un en-tête doit être lu, liste blanche d’hôtes attendus et trust proxy réglé au nombre exact de proxys.',
  },
  {
    id: 'jwt-decode',
    module: 'm03',
    title: 'JWT : décoder n’est pas vérifier',
    status: 'live',
    kind: 'exploit',
    level: 2,
    csslp: ['D1', 'D5'],
    cwe: 'CWE-347',
    brief:
      'Le middleware d’API lit les revendications du jeton avec un décodage sans vérification, et accepte l’algorithme annoncé par le jeton.',
    goal: 'Obtenir une réponse de GET /api/admin/audit avec un jeton que tu as forgé toi-même.',
    file: 'server/lib/jwt.ts',
    lessons: ['m09/l05', 'm03/l10'],
    hints: [
      'Le jeton porte son propre algorithme. Qui décide : le jeton ou le serveur ?',
      'Un jeton est trois parties base64url séparées par des points ; la troisième peut être vide.',
      'Forge {"alg":"none","typ":"JWT"} avec {"sub":"admin@novafact.example","role":"admin"} et une signature vide.',
    ],
    fix: 'verify() avec la liste d’algorithmes attendue fixée côté serveur, et contrôle de iss / aud / exp. Ne jamais lire de revendication avant vérification de la signature (RFC 8725).',
  },
  {
    id: 'cache-poison',
    module: 'm03',
    title: 'Empoisonnement du cache par une entrée hors clé',
    status: 'live',
    kind: 'exploit',
    level: 3,
    csslp: ['D5', 'D7'],
    cwe: 'CWE-444',
    brief:
      'Le lab place un cache devant /api/branding. La clé de cache est l’URL ; la réponse, elle, reflète un en-tête.',
    goal:
      'Empoisonner l’entrée de cache de /api/branding pour qu’elle serve ta charge utile à la requête suivante, faite sans ton en-tête.',
    file: 'server/routes/branding.ts',
    lessons: ['m03/l06', 'm03/l07'],
    hints: [
      'Une entrée qui change la réponse sans entrer dans la clé de cache est une entrée hors clé.',
      'Regarde quel en-tête la réponse recopie.',
      'GET /api/branding avec X-Forwarded-Host: <charge>, puis refais la requête sans l’en-tête.',
    ],
    fix: 'Ne jamais refléter une entrée hors clé dans une réponse mise en cache. Clé de cache conçue explicitement (Vary maîtrisé, politique CloudFront), Cache-Control: private sur tout ce qui dépend de l’utilisateur.',
  },

  // ─── m04 · Client & scripts tiers ───────────────────────────────────────────
  {
    id: 'dom-xss',
    module: 'm04',
    title: 'XSS stockée dans la note de facture',
    status: 'live',
    kind: 'exploit',
    level: 1,
    csslp: ['D5'],
    cwe: 'CWE-79',
    k: [11],
    brief:
      'Les notes de facture acceptent du Markdown, rendu par un convertisseur maison puis injecté avec dangerouslySetInnerHTML.',
    goal:
      'Faire exécuter du script dans le navigateur d’un autre utilisateur qui consulte la facture — le lab détecte l’exécution.',
    file: 'src/pages/InvoiceDetail.tsx',
    lessons: ['m04/l02', 'm04/l06', 'm04/l05'],
    hints: [
      'Le convertisseur Markdown ne neutralise pas le HTML brut qu’on lui donne.',
      'Il n’y a pas que <script> : un attribut d’événement suffit.',
      'Mets <img src=x onerror="fetch(\'/api/lab/xss\')"> dans la note.',
    ],
    fix: 'Laisser React échapper (pas de dangerouslySetInnerHTML), ou assainir avec DOMPurify / la Sanitizer API avant rendu. Puis CSP stricte avec nonce et Trusted Types comme deuxième barrière.',
  },
  {
    id: 'third-party-script',
    module: 'm04',
    title: 'Script tiers piloté par la configuration',
    status: 'live',
    kind: 'exploit',
    level: 2,
    csslp: ['D4', 'D8'],
    cwe: 'CWE-829',
    k: [4],
    brief:
      'Le tag manager charge son script depuis une URL stockée dans les réglages du tenant, modifiable par n’importe quel utilisateur du tenant. C’est l’anti-pattern « third-party hooks » de Kohnfelder.',
    goal:
      'Faire charger par la page de paiement un script d’une origine que tu choisis, et qu’il s’exécute.',
    file: 'src/pages/Checkout.tsx',
    lessons: ['m04/l03', 'm04/l04', 'm04/l08', 'm08/l04'],
    hints: [
      'Qui peut écrire le champ analyticsUrl des réglages ?',
      'La page de paiement insère ce script sans contrainte d’origine.',
      'PUT /api/settings avec analyticsUrl vers /api/lab/evil-script.js, puis ouvre la page de paiement.',
    ],
    fix: 'Inventaire et propriétaire par script, origines en liste blanche dans la CSP (pas de configuration qui pilote une origine), SRI, auto-hébergement, et isolation du paiement dans l’iframe du prestataire (PCI DSS 6.4.3).',
  },

  // ─── M14 / M15 · Identité et anti-abus ──────────────────────────────────────
  {
    id: 'no-rate-limit',
    module: 'm10',
    title: 'Credential stuffing sans limite',
    status: 'live',
    kind: 'exploit',
    level: 1,
    csslp: ['D5'],
    cwe: 'CWE-307',
    brief:
      'La connexion n’a ni limitation de débit, ni verrouillage, ni délai croissant. Le lab fournit une liste de mots de passe courants.',
    goal: 'Trouver le mot de passe de compta@globex.example par force brute sur la wordlist du lab.',
    file: 'server/routes/auth.ts',
    lessons: ['m10/l02', 'm10/l03'],
    hints: [
      'Rien ne compte tes échecs.',
      'La liste est à /api/lab/wordlist.',
      'Le lab compte les tentatives : l’exercice se valide à la connexion réussie après une rafale.',
    ],
    fix: 'Limitation par compte ET par IP ET par tenant (token bucket ou fenêtre glissante, Redis), réponses graduées, MFA/passkeys, mots de passe comparés à Pwned Passwords. Sans jamais faire du verrouillage une arme de déni de service (NIST SP 800-63B).',
  },
  {
    id: 'invoice-state',
    module: 'm10',
    title: 'Invariant métier : rouvrir une facture payée',
    status: 'live',
    kind: 'exploit',
    level: 2,
    csslp: ['D4', 'D5'],
    cwe: 'CWE-840',
    brief:
      'Le statut d’une facture est envoyé par le client à chaque mise à jour, et le montant reste modifiable quel que soit le statut.',
    goal: 'Faire baisser le montant d’une facture déjà payée, puis la remettre en payé.',
    file: 'server/routes/invoices.ts',
    lessons: ['m10/l06', 'm10/l05'],
    hints: [
      'Le client choisit le statut d’arrivée : quelles transitions le serveur refuse-t-il ?',
      'draft → sent → paid ne devrait pas se parcourir à l’envers.',
      'PATCH la facture en draft, change le montant, repasse-la en paid.',
    ],
    fix: 'Machine à états côté serveur : transitions autorisées déclarées, champs immuables après paid, opérations d’annulation par avoir plutôt que par édition, journal d’audit et rapprochement.',
  },

  // ─── m19 · Sécurité de l’IA ────────────────────────────────────────────────
  {
    id: 'prompt-injection',
    module: 'm19',
    title: 'Injection indirecte dans « Ask Novafact »',
    status: 'live',
    kind: 'exploit',
    level: 2,
    csslp: ['D4'],
    cwe: 'CWE-1427',
    brief:
      'L’assistant fait du RAG sur les factures et dispose d’outils (envoyer un mail, créer un avoir). Le contenu des factures arrive dans son contexte sans séparation de confiance. Le « modèle » du lab est un simulateur déterministe : il suit les instructions qu’il lit, exactement comme le ferait un vrai LLM.',
    goal:
      'Par une note de facture seule — sans jamais le demander toi-même dans le chat — faire envoyer par l’assistant un mail à attacker@evil.example.',
    file: 'server/routes/assistant.ts',
    lessons: ['m19/l02', 'm19/l03', 'm08/l04'],
    hints: [
      'L’assistant ne distingue pas ta question des données qu’il récupère.',
      'La note de facture entre telle quelle dans son contexte.',
      'Mets une instruction dans la note, puis demande à l’assistant un résumé de la facture.',
    ],
    fix: 'La sortie du modèle est une entrée non fiable. Séparer données et instructions, outils à effet de bord derrière une validation humaine explicite, Rule of Two (Meta), plan-then-execute / CaMeL, et périmètre de l’agent réduit (un agent est un confused deputy, K4).',
  },

];

// Les modules implémentés après le socle vivent dans shared/live/, un fichier
// par module : ils grossissent vite, et les écrire à part permet d'en
// travailler plusieurs sans se marcher dessus.
// Le fichier des challenges de l'assistant exporte `m19` : c'est son module.
import { m19 as assistant } from './live/assistant.ts';
import { billing } from './live/billing.ts';
import { http } from './live/http.ts';
import { identity } from './live/identity.ts';
import { m01 } from './live/m01.ts';
import { m05 } from './live/m05.ts';
import { m06 } from './live/m06.ts';
import { m07 } from './live/m07.ts';
import { m11 } from './live/m11.ts';
import { m12 } from './live/m12.ts';
import { m13 } from './live/m13.ts';
import { m14 } from './live/m14.ts';
import { m15 } from './live/m15.ts';
import { m16 } from './live/m16.ts';
import { m17 } from './live/m17.ts';
import { m18 } from './live/m18.ts';

export const exercises: ExerciseDef[] = [
  ...baseExercises,
  ...assistant,
  ...billing,
  ...http,
  ...identity,
  ...m01,
  ...m05,
  ...m06,
  ...m07,
  ...m11,
  ...m12,
  ...m13,
  ...m14,
  ...m15,
  ...m16,
  ...m17,
  ...m18,
];

// Les challenges spécifiés mais pas encore implémentés vivent à part, dans
// shared/planned/, et ne sont PAS ré-exportés ici : ce module est importé par
// l'interface, et une ré-export empêche l'élagage — les 278 spécifications se
// retrouveraient dans le bundle du navigateur, qui ne s'en sert jamais.
// Le générateur de documentation et les tests les importent directement.

export const exerciseById = (id: string) => exercises.find((e) => e.id === id);
export const exercisesForModule = (m: string) => exercises.filter((e) => e.module === m);

export const moduleTitles: Record<string, string> = {
  m01: 'M3 · Présentation de l’AppSec',
  m02: 'M7 · Vulnérabilités côté serveur',
  m03: 'M9 · Web avancé',
  m04: 'M8 · Vulnérabilités côté client & scripts tiers',
  m05: 'M26 · Gestion des vulnérabilités',
  m06: 'M30 · Faire adopter la sécurité',
  m07: 'M12 · Exigences, vie privée & conformité',
  m08: 'M13 · Spécifier et concevoir',
  m09: 'M14 · Identité : authentification, autorisation, OAuth & SAML',
  m10: 'M15 · Anti-abus, ATO & fraude',
  m11: 'M11 · Threat modeling & MITRE',
  m12: 'M16 · Revue de code sécurité',
  m13: 'M17 · Tests & analyse de code',
  m14: 'M18 · Pipeline, supply chain & fournisseurs',
  m15: 'M19 · IAM AWS',
  m16: 'M20 · Infrastructure as Code',
  m17: 'M21 · Déploiement, exploitation & résilience',
  m18: 'M23 · Journalisation & SIEM (Elastic)',
  m19: 'M27 · Sécurité des applications LLM',
  m20: 'M32 · Capstone : revue de sécurité de Novafact',
  m21: 'M1 · Cybersécurité et panorama de la menace',
  m22: 'M2 · MITRE ATT&CK et la menace SaaS',
  m23: 'M4 · Les métiers de l’AppSec',
  m24: 'M5 · Maturité et posture de sécurité',
  m25: 'M6 · Le web et ses protections',
  m26: 'M10 · Analyse de risques',
  m27: 'M22 · SOC et renseignement sur la menace',
  m28: 'M24 · Detection engineering',
  m29: 'M25 · Réponse à incident',
  m30: 'M28 · Agents & MCP',
  m31: 'M29 · MCP & OAuth',
  m32: 'M31 · Le programme AppSec',
};

// ── Lien avec le site ───────────────────────────────────────────────────────
//
// Les titres sont recopiés de src/data/catalog.ts du site : le lab est un
// paquet séparé, il n'importe rien du site. Si une leçon est renommée là-bas,
// `npm run verify` le signale (verify/links.test.ts compare les deux).

export const lessonTitles: Record<string, string> = {
  'm01/l01': 'Du pentest à l’AppSec',
  'm01/l05': 'Principes DevSecOps',
  'm24/l02': 'OWASP SAMM v2',
  'm24/l03': 'BSIMM16 : se comparer',
  'm32/l03': 'Jalons, portes et exceptions',
  'm32/l04': 'Mesurer un programme',
  'm26/l06': 'Risque et acceptation',
  'm32/l05': 'Cyber Resilience Act et roadmap',
  'm25/l08': 'Top 10 2025, API Top 10 et CWE Top 25',
  'm02/l01': 'Entrées non fiables dans Express',
  'm02/l02': 'Footguns JavaScript et argent',
  'm02/l03': 'Spécificités Node.js',
  'm02/l04': 'Erreurs, exceptions et atomicité',
  'm04/l02': 'React et le navigateur',
  'm02/l09': 'Éliminer une classe entière',
  'm03/l01': 'Race conditions',
  'm03/l02': 'En-tête Host',
  'm03/l03': 'API avancée et GraphQL',
  'm03/l04': 'Chaînes de vulnérabilités',
  'm03/l06': 'Cache poisoning et cache deception',
  'm03/l07': 'Parser differentials et fuites via l’ORM',
  'm03/l08': 'SSTI et injection de code',
  'm03/l09': 'Désérialisation et prototype pollution avancées',
  'm03/l10': 'Protocoles d’authentification avancés',
  'm03/l11': 'SSRF avancée',
  'm03/l12': 'Client avancé : DOM, CSP et XS-Leaks',
  'm03/l13': 'Web LLM attacks et recherche assistée par IA',
  'm04/l01': 'Le client n’est pas sous ton contrôle',
  'm04/l03': 'Scripts tiers',
  'm04/l04': 'Réduire la confiance',
  'm04/l05': 'CSP stricte en pratique',
  'm04/l06': 'Trusted Types et Sanitizer API',
  'm04/l07': 'Isolation d’origine',
  'm04/l08': 'PCI DSS 4.0.1 : 6.4.3 et 11.6.1',
  'm04/l09': 'Surveiller le client',
  'm05/l01': 'Cycle de vie d’une vulnérabilité',
  'm05/l02': 'CVSS 4.0',
  'm05/l03': 'Prioriser par le risque',
  'm05/l04': 'Faut-il un exploit pour faire corriger ?',
  'm05/l05': 'Outillage, SLA et dépendances npm',
  'm05/l06': 'Divulgation, bug bounty et CRA',
  'm05/l07': 'Gérer une critique à J+0',
  'm23/l01': 'Le rôle : une équipe qui rend capable',
  'm06/l01': 'Écrire un finding qui sera corrigé',
  'm23/l04': 'Security Champions',
  'm06/l04': 'Former au code sécurisé',
  'm06/l05': 'Le paved road comme produit',
  'm06/l06': 'Piloter la sécurité offensive',
  'm01/l02': 'La confiance',
  'm01/l03': 'C-I-A et Gold Standard',
  'm07/l01': 'Exigences et abuse cases',
  'm07/l02': 'Matrice de traçabilité',
  'm07/l03': 'Classification des données',
  'm07/l04': 'Vie privée et RGPD',
  'm07/l05': 'Conformité : NIS2, CRA, PCI DSS',
  'm07/l06': 'Provisionnement des accès',
  'm08/l02': 'Mitigations structurelles',
  'm08/l03': 'Les 14 patterns',
  'm08/l04': 'Les 4 anti-patterns',
  'm08/l09': 'La spécification technique : le design doc',
  'm08/l10': 'Mener une Security Design Review',
  'm09/l01': 'Authentification applicative',
  'm09/l02': 'Autorisation et multi-tenant',
  'm08/l07': 'Crypto pour développeurs',
  'm08/l06': 'Conception d’interfaces',
  'm08/l05': 'Patterns d’architecture',
  'm09/l03': 'OAuth 2.1 et Authorization Code + PKCE',
  'm09/l04': 'SPA : RFC 10017 et BFF',
  'm09/l05': 'Valider un JWT dans Express',
  'm09/l06': 'Attaques OAuth et OIDC',
  'm09/l07': 'RFC 9700, DPoP, PAR et FAPI',
  'm09/l08': 'SAML en entreprise',
  'm10/l01': 'Taxonomie des menaces automatisées',
  'm10/l02': 'Credential stuffing et prise de contrôle',
  'm10/l03': 'Limitation de débit bien conçue',
  'm10/l04': 'Bots et Fraud Control',
  'm10/l05': 'Abus de fonctionnalités',
  'm10/l06': 'Invariants métier',
  'm10/l07': 'Détecter et répondre à la fraude',
  'm11/l01': 'Les 4 questions et la démarche',
  'm11/l02': 'STRIDE par élément',
  'm11/l03': 'Choisir sa méthode',
  'm11/l04': 'MITRE pour l’AppSec',
  'm11/l05': 'Threat modeling agile et as code',
  'm11/l06': 'Modéliser l’IA, la supply chain et le dev',
  'm12/l01': 'Pourquoi et quand relire',
  'm12/l02': 'Méthode sur une base inconnue',
  'm12/l03': 'Revoir une PR en 10 minutes',
  'm12/l04': 'Lire des correctifs de CVE',
  'm12/l05': 'Revue orientée autorisation',
  'm12/l06': 'Revoir du code généré par IA',
  'm12/l07': 'Audit ciblé et limité dans le temps',
  'm13/l01': 'Stratégie de test de sécurité',
  'm13/l02': 'Tests de sécurité écrits par les devs',
  'm13/l03': 'SAST pour JavaScript',
  'm13/l04': 'Écrire ses règles',
  'm13/l05': 'Fuzzing et tests de disponibilité',
  'm13/l06': 'SCA et SBOM',
  'm13/l07': 'DAST et secrets',
  'm13/l08': 'Données de test',
  'm13/l09': 'Inspecter du code malveillant',
  'm13/l10': 'L’IA dans l’analyse de code',
  'm13/l11': 'Bâtir la plateforme',
  'm14/l01': 'OWASP Top 10 CI/CD',
  'm14/l02': 'Durcir GitHub Actions',
  'm14/l03': 'Sécuriser l’environnement de dev',
  'm14/l04': 'Outils du pipeline',
  'm14/l05': 'npm : installer et publier',
  'm14/l06': 'Choisir un composant',
  'm14/l08': 'Cas réels de supply chain',
  'm14/l09': 'Fournisseurs et tiers',
  'm14/l10': 'SLSA, Sigstore et provenance',
  'm14/l11': 'Répondre à un incident supply chain',
  'm15/l01': 'Le modèle IAM et la logique d’évaluation',
  'm15/l02': 'Zéro utilisateur IAM',
  'm15/l03': 'Workloads Node.js',
  'm15/l04': 'Escalade et abus',
  'm15/l05': 'Moindre privilège en pratique',
  'm15/l06': 'Multi-comptes et data perimeter',
  'm16/l01': 'L’IaC comme surface',
  'm16/l02': 'Scanners IaC',
  'm16/l03': 'Policy as code',
  'm16/l04': 'State, pipeline et supply chain IaC',
  'm16/l05': 'Dérive et runtime',
  'm17/l01': 'Configuration de production',
  'm17/l02': 'Conteneurs Node.js',
  'm17/l03': 'Publier en sécurité',
  'm17/l04': 'Plateformes AWS',
  'm17/l05': 'En-têtes en production',
  'm17/l06': 'Résilience et continuité',
  'm17/l07': 'Fin de vie',
  'm17/l08': 'Protection à l’exécution',
  'm18/l01': 'Journaliser pour la sécurité',
  'm18/l03': 'Ingestion dans Elastic',
  'm18/l04': 'KQL, EQL et ES|QL',
  'm28/l03': 'Règles, Sigma et detection-as-code',
  'm28/l05': 'Détections applicatives',
  'm28/l06': 'Maturité et réponse à incident',
  'm19/l01': 'OWASP LLM Top 10 2026',
  'm19/l02': 'Prompt injection et règle de deux',
  'm19/l03': 'Patterns de conception pour agents',
  'm19/l04': 'Applications JS avec LLM',
  'm30/l01': 'Agents et MCP : vue d’ensemble',
  'm19/l05': 'MITRE ATLAS et OWASP AI Exchange',
  'm19/l06': 'Red teaming des LLM',
  'm19/l07': 'L’IA dans le SDLC',
  'm20/l03': 'Exigences et traçabilité',
  'm20/l04': 'Design doc et revue de conception',
  'm20/l02': 'Threat model',
  'm20/l06': 'Revue de PR, règles et tests',
  'm20/l08': 'Page de paiement',
  'm20/l05': 'Contrôles anti-abus',
  'm20/l09': 'Pipeline et supply chain',
  'm20/l10': 'IAM au moindre privilège',
  'm20/l07': 'Vulnérabilités avancées',
  'm20/l11': 'Cinq détections Elastic',
  'm20/l14': 'Roadmap SAMM à 12 mois',
  'm20/l15': 'Plan d’adoption et restitution',
};

/**
 * Où tourne AppSec Academy. `shared/` est lu par le serveur comme par le
 * client, donc pas d'import.meta ici : le client passe sa propre valeur.
 */
export const DEFAULT_SITE_URL = 'http://127.0.0.1:5173';

/** L'URL d'une leçon du site, à partir d'une référence « m02/l01 ». */
export const lessonUrl = (ref: string, siteUrl: string = DEFAULT_SITE_URL) =>
  `${siteUrl}/#/modules/${ref}`;

export const lessonLabel = (ref: string) => lessonTitles[ref] ?? ref;

// Items du jeu « Tri des tactiques » (M2) : une technique ATT&CK, une procédure
// observée, et la tactique qu'elle sert.
//
// Référentiel : `attack.ts` (Enterprise v19). Les tactiques valides d'un item ne
// sont pas écrites ici : elles sont lues dans le référentiel, et le chargement
// échoue si un leurre se révèle être une tactique valide. Un item ne peut donc
// pas dériver d'ATT&CK sans que ça se voie.
//
// ── Les techniques multi-tactiques ───────────────────────────────────────────
//
// Une technique peut servir plusieurs tactiques : T1078 Valid Accounts en sert
// quatre. Le jeu ne fait pas semblant du contraire. Pour ces items, `shown`
// désigne **une** des tactiques valides, la seule qui figure parmi les quatre
// options ; les trois leurres ne sont jamais valides. Toute tactique valide
// affichée est donc acceptée, et l'explication liste toutes celles d'ATT&CK.
//
// ── Ce que mesure le niveau ──────────────────────────────────────────────────
//
// Pas la notoriété de la technique, mais la distance entre son nom et son but :
//
//   N1 · Le nom dit la tactique (« Discovery », « Exfiltration Over… »,
//        « Steal… Token »). On apprend les quinze tactiques et leur vocabulaire.
//
//   N2 · Le nom ne la dit pas : il faut savoir ce que l'adversaire cherche.
//        Une règle de transfert collecte, elle n'exfiltre pas ; l'appel au
//        support est un accès initial, le même appel pour se renseigner est de
//        la reconnaissance. Un leurre est la lecture « au premier degré ».
//
//   N3 · Le piège tient à ATT&CK lui-même : la scission de Defense Evasion en
//        v19 (Stealth contre Defense Impairment), les techniques révoquées et
//        déplacées, les rattachements contre-intuitifs (rejouer un cookie est
//        un mouvement latéral, créer une instance cloud neutralise une défense).

import type { Level } from './catalog';
import { defineSeries, type Leveled, type SeriesProfile } from '../lib/series';
import { technique, type TacticId } from './attack';

export interface TacticItem extends Leveled {
  /** Identifiant ATT&CK de la technique. */
  technique: string;
  /** Ce qu'on a observé, en une phrase. */
  procedure: string;
  /** Pour une technique multi-tactique : la tactique valide proposée. */
  shown?: TacticId;
  /** Trois tactiques que la technique ne sert pas. */
  decoys: [TacticId, TacticId, TacticId];
  note: string;
}

const i = (
  id: string, level: Level, tech: string, decoys: [TacticId, TacticId, TacticId], procedure: string, note: string,
  extra: { shown?: TacticId; avoid?: string[] } = {},
): TacticItem => ({ id, level, technique: tech, decoys, procedure, note, ...extra });

export const tacticItems: TacticItem[] = [
  // ── N1 · Le nom dit la tactique ──────────────────────────────────────────
  i('cloud-account-discovery', 1, 'T1087.004', ['TA0043', 'TA0006', 'TA0009'],
    'Juste après la connexion, le compte appelle Graph pour lister tous les utilisateurs du tenant Entra ID.',
    'Discovery : on est déjà dedans et on cartographie. La reconnaissance, elle, se fait avant l’accès, depuis l’extérieur.'),
  i('webhook-exfil', 1, 'T1567.004', ['TA0011', 'TA0009', 'TA0008'],
    'Un script poste les exports CSV du support vers un webhook Discord.',
    'Exfiltration : les données sortent par un service web légitime. Le webhook n’est pas un canal de commande, rien ne revient vers le script.'),
  i('password-spraying', 1, 'T1110.003', ['TA0001', 'TA0043', 'TA0007'],
    'Un même mot de passe saisonnier est essayé une fois sur chacun des trois mille comptes Microsoft 365.',
    'Credential Access : le but est d’obtenir un mot de passe valide. L’accès initial viendra ensuite, avec T1078.'),
  i('crm-collection', 1, 'T1213.004', ['TA0010', 'TA0007', 'TA0006'],
    'Requêtes par l’API Salesforce sur les objets Account et Contact, table après table.',
    'Collection : on rassemble ce qui intéresse. La sortie hors de l’environnement est une autre étape, avec ses propres techniques.'),
  i('open-websites', 1, 'T1593', ['TA0042', 'TA0007', 'TA0001'],
    'Repérage sur LinkedIn des salariés du support informatique et de leurs managers.',
    'Reconnaissance : tout se passe avant l’intrusion, sur des sources publiques. Rien n’est encore acquis ni installé.'),
  i('acquire-access', 1, 'T1650', ['TA0001', 'TA0043', 'TA0006'],
    'Un accès VPN à une filiale est acheté à un courtier d’accès initial sur un forum.',
    'Resource Development : acheter l’accès, c’est se doter d’une ressource. Son utilisation, plus tard, sera de l’accès initial.'),
  i('exploit-public-app', 1, 'T1190', ['TA0002', 'TA0004', 'TA0043'],
    'Une injection dans le générateur de PDF exposé sur Internet donne une exécution sur le serveur.',
    'Initial Access : la faille d’une application exposée est la porte d’entrée. Ce qui s’exécute ensuite relève d’autres techniques.'),
  i('cloud-api', 1, 'T1059.009', ['TA0007', 'TA0003', 'TA0001'],
    'L’attaquant pilote le tenant par des appels Graph en PowerShell plutôt que par la console.',
    'Execution : Command and Scripting Interpreter, appliqué aux API cloud. Ce que font ces appels (lister, créer) a ses propres tactiques.'),
  i('cloud-infra-discovery', 1, 'T1580', ['TA0009', 'TA0043', 'TA0004'],
    'Avec les clés volées, ListBuckets puis DescribeInstances sur chaque région.',
    'Discovery : on inventorie l’infrastructure IaaS. Télécharger le contenu des buckets serait de la collecte.'),
  i('steal-app-token', 1, 'T1528', ['TA0008', 'TA0009', 'TA0001'],
    'Le jeton OAuth d’une intégration est récupéré dans la configuration d’un runner de CI.',
    'Credential Access : voler le jeton. L’utiliser pour entrer ailleurs sera T1550.001, en Lateral Movement.', { avoid: ['app-token-reuse'] }),
  i('steal-cookie', 1, 'T1539', ['TA0009', 'TA0001', 'TA0005'],
    'Un infostealer copie les cookies du navigateur d’un ingénieur, dont la session SSO.',
    'Credential Access : le cookie est un identifiant. Le rejouer sera T1550.004.', { avoid: ['cookie-replay'] }),
  i('financial-theft', 1, 'T1657', ['TA0009', 'TA0010', 'TA0042'],
    'Une demande de rançon en bitcoins, sous 72 h, accompagne un échantillon des données volées.',
    'Impact : l’extorsion est l’objectif final. ATT&CK la range sous Financial Theft, avec la fraude au virement.'),
  i('data-cloud-storage', 1, 'T1530', ['TA0010', 'TA0007', 'TA0006'],
    'Une commande sync copie le contenu d’un bucket S3 de sauvegardes vers la machine de l’attaquant.',
    'Collection : lire le contenu d’un stockage cloud. ATT&CK sépare la collecte de la sortie elle-même.'),
  i('ransomware', 1, 'T1486', ['TA0112', 'TA0009', 'TA0005'],
    'Les hyperviseurs ESXi sont chiffrés un dimanche soir ; une note de rançon apparaît.',
    'Impact : rendre les données inutilisables. Rien n’est neutralisé côté détection, tout est au contraire très visible.'),
  i('serverless-exec', 1, 'T1648', ['TA0003', 'TA0040', 'TA0007'],
    'Un flux Power Automate créé par le compte compromis lance des actions toutes les heures.',
    'Execution : faire tourner une automatisation de la plate-forme. Sa répétition sert la persistance, mais la technique est classée en exécution.'),

  // ── N2 · Le but, pas le nom ──────────────────────────────────────────────
  i('email-hiding-rules', 2, 'T1564.008', ['TA0003', 'TA0009', 'TA0112'],
    'Une règle de boîte de réception déplace vers « Flux RSS » tout message contenant « virement » et le marque comme lu.',
    'Stealth : la règle cache les messages à la victime, sans toucher aux contrôles de sécurité. C’est la marque de Stealth en v19.'),
  i('forwarding-rule', 2, 'T1114.003', ['TA0010', 'TA0003', 'TA0005'],
    'Une règle transfère automatiquement chaque message entrant vers une adresse Gmail.',
    'Collection : ATT&CK range la règle de transfert sous Email Collection. Elle sort bien les messages, mais la technique décrit leur collecte.'),
  i('cloud-app-integration', 2, 'T1671', ['TA0001', 'TA0006', 'TA0008'],
    'Le compte compromis consent à une application tierce qui garde l’accès à la messagerie (offline_access).',
    'Persistence : l’intégration survit au changement de mot de passe et parfois à la désactivation du compte qui a consenti.'),
  i('mfa-fatigue', 2, 'T1621', ['TA0001', 'TA0005', 'TA0004'],
    'Quatorze notifications push refusées en six minutes, puis une acceptée à 2 h 47.',
    'Credential Access : la validation arrachée est un facteur d’authentification volé. L’accès qu’elle ouvre relève ensuite de T1078.'),
  i('internal-spearphishing', 2, 'T1534', ['TA0001', 'TA0043', 'TA0009'],
    'Depuis la boîte de la comptable, un lien piégé part vers deux cents collègues.',
    'Lateral Movement : l’attaquant est déjà dedans et s’appuie sur la confiance entre collègues pour gagner d’autres comptes.'),
  i('taint-shared-content', 2, 'T1080', ['TA0040', 'TA0003', 'TA0002'],
    'Un modèle de facture partagé sur le Drive de l’équipe est remplacé par une version piégée.',
    'Lateral Movement : le contenu partagé sert de vecteur vers les autres utilisateurs qui l’ouvrent.'),
  i('transfer-cloud-account', 2, 'T1537', ['TA0009', 'TA0008', 'TA0040'],
    'Un instantané de base de données est partagé avec un compte AWS extérieur à l’organisation.',
    'Exfiltration : les données quittent l’organisation sans quitter le fournisseur. Les flux réseau sortants n’en voient rien.'),
  i('password-policy-discovery', 2, 'T1201', ['TA0043', 'TA0006', 'TA0112'],
    'Avant la pulvérisation, le compte lit la politique de mots de passe et de verrouillage du tenant.',
    'Discovery : la lecture se fait de l’intérieur, avec un compte. Elle sert à calibrer une attaque d’identifiants à venir.'),
  i('cloud-dashboard', 2, 'T1538', ['TA0002', 'TA0009', 'TA0001'],
    'L’attaquant parcourt la console d’administration Google Workspace pour voir les services actifs.',
    'Discovery : la console sert à comprendre l’environnement. Ni exécution ni collecte : on regarde.'),
  i('chat-credentials', 2, 'T1552.008', ['TA0009', 'TA0007', 'TA0008'],
    'Dans un canal Slack de l’équipe infra, un message épinglé contient le mot de passe de la sauvegarde.',
    'Credential Access : l’objet est un identifiant laissé en clair. Fouiller Slack pour ses données serait T1213.005, en Collection.'),
  i('cloud-service-hijacking', 2, 'T1496.004', ['TA0006', 'TA0002', 'TA0042'],
    'Une clé d’API volée sert à faire tourner des requêtes vers un modèle d’IA payant, aux frais de la victime.',
    'Impact : la ressource payée par la victime est détournée. ATT&CK le classe en Resource Hijacking, sous Impact.'),
  i('create-cloud-account', 2, 'T1136.003', ['TA0004', 'TA0042', 'TA0001'],
    'Un compte « svc-backup » est créé dans le tenant, sans propriétaire connu.',
    'Persistence : un compte de plus pour revenir. Il n’élève rien par lui-même ; s’il reçoit un rôle, c’est une autre technique.'),
  i('remote-access-tools', 2, 'T1219', ['TA0008', 'TA0002', 'TA0003'],
    'Le faux support fait installer un outil commercial d’assistance à distance sur le poste du salarié.',
    'Command and Control : l’outil sert à piloter le poste. ATT&CK le classe en C2, même si l’installation passe par la victime.'),
  i('voice-access', 2, 'T1566.004', ['TA0043', 'TA0006', 'TA0005'],
    'Un appel au salarié, depuis un numéro usurpé, le guide pas à pas vers un faux portail de connexion.',
    'Initial Access : l’appel vise à entrer. Le même appel pour soutirer une information serait T1598.004, en reconnaissance.', { avoid: ['voice-recon'] }),
  i('trusted-relationship', 2, 'T1199', ['TA0008', 'TA0003', 'TA0042'],
    'L’attaquant entre par le compte d’administration délégué d’un prestataire d’infogérance.',
    'Initial Access : la relation de confiance est la porte. Elle est déjà là, l’attaquant n’a rien eu à créer.'),
  i('supply-chain', 2, 'T1195.002', ['TA0002', 'TA0042', 'TA0003'],
    'La mise à jour signée d’un agent de supervision embarque une porte dérobée insérée chez l’éditeur.',
    'Initial Access : la chaîne logicielle compromise est un moyen d’entrer chez tous les clients de l’éditeur.'),
  i('imds-credentials', 2, 'T1552.005', ['TA0007', 'TA0001', 'TA0004'],
    'Une SSRF interroge 169.254.169.254 et renvoie les identifiants temporaires du rôle de l’instance.',
    'Credential Access : le service de métadonnées livre des identifiants. La SSRF qui y mène est T1190.'),
  i('email-bombing', 2, 'T1667', ['TA0005', 'TA0002', 'TA0001'],
    'Des milliers d’inscriptions à des lettres d’information noient la boîte d’un salarié, juste avant l’appel du « support ».',
    'Impact : la boîte est rendue inutilisable. Le bombardement prépare souvent un appel de faux support, mais la technique est classée en Impact.'),

  // ── N3 · Les pièges d'ATT&CK ─────────────────────────────────────────────
  i('cloud-logs-off', 3, 'T1685.002', ['TA0005', 'TA0003', 'TA0040'],
    'StopLogging sur le trail CloudTrail, puis DeleteTrail vingt minutes plus tard.',
    'Defense Impairment (v19) : couper les journaux casse un contrôle. Avant la v19, c’était T1562.008 sous Defense Evasion ; ni l’une ni l’autre n’existe plus.'),
  i('impersonation', 3, 'T1684.001', ['TA0001', 'TA0112', 'TA0042'],
    'Au téléphone, l’attaquant se présente au support comme un salarié et cite son matricule.',
    'Stealth : en v19, Impersonation (ex-T1656) devient une sous-technique de Social Engineering, dans Stealth. On se fond dans le légitime, on ne casse rien.'),
  i('clear-mailbox', 3, 'T1070.008', ['TA0112', 'TA0040', 'TA0009'],
    'Les alertes « nouvelle connexion » sont supprimées de la boîte du salarié au fil de l’eau.',
    'Stealth : effacer des traces dans la boîte ne touche à aucun contrôle de sécurité. Indicator Removal reste en Stealth en v19.'),
  i('masquerade-account', 3, 'T1036.010', ['TA0003', 'TA0112', 'TA0042'],
    'Le compte créé s’appelle « admin-sauvegarde », comme les comptes de service de l’équipe.',
    'Stealth : le nom sert à passer inaperçu. La création du compte, elle, est T1136.003, en Persistence.'),
  i('unused-regions', 3, 'T1535', ['TA0112', 'TA0007', 'TA0040'],
    'Des instances de minage tournent dans une région AWS que l’entreprise n’utilise jamais.',
    'Stealth : on se cache là où personne ne regarde, sans rien désactiver. La frontière v19 : se cacher contre éteindre la lumière.'),
  i('create-instance', 3, 'T1578.002', ['TA0005', 'TA0002', 'TA0003'],
    'Une instance éphémère est créée pour monter l’instantané d’un disque, hors des règles qui s’appliquent à l’instance d’origine.',
    'Defense Impairment : depuis la v19, Modify Cloud Compute Infrastructure y est classée. L’instance sert à contourner les contrôles posés sur l’existante.'),
  i('cookie-replay', 3, 'T1550.004', ['TA0006', 'TA0001', 'TA0005'],
    'Une session SSO validée par la 2FA est rejouée depuis un VPS, sans nouvelle authentification.',
    'Lateral Movement : en v19, T1550 n’est plus rattachée qu’à cette tactique. Voler le cookie (T1539) est de l’accès aux identifiants ; s’en servir, du mouvement latéral.', { avoid: ['steal-cookie', 'app-token-reuse'] }),
  i('app-token-reuse', 3, 'T1550.001', ['TA0006', 'TA0003', 'TA0009'],
    'Des jetons OAuth d’une intégration tierce ouvrent les instances Salesforce de ses clients.',
    'Lateral Movement : le jeton volé fait passer d’un service à un autre. Le vol lui-même était T1528.', { avoid: ['steal-app-token', 'cookie-replay'] }),
  i('device-registration', 3, 'T1098.005', ['TA0006', 'TA0005', 'TA0112'],
    'Dix jours après la compromission, un nouvel authentificateur est enrôlé sur le compte depuis l’étranger.',
    'ATT&CK range Device Registration en Persistence et en Privilege Escalation : l’une des deux figure parmi les options, l’une ou l’autre est juste.',
    { shown: 'TA0003' }),
  i('modify-mfa', 3, 'T1556.006', ['TA0005', 'TA0004', 'TA0001'],
    'L’administrateur compromis exclut un groupe de comptes de l’exigence de MFA.',
    'T1556 sert trois tactiques : Persistence, Defense Impairment et Credential Access. Affaiblir l’authentification, c’est casser un contrôle : Defense Impairment, et non Stealth.',
    { shown: 'TA0112' }),
  i('trust-modification', 3, 'T1484.002', ['TA0003', 'TA0005', 'TA0001'],
    'Un fournisseur d’identité externe est ajouté au tenant Okta, avec liaison automatique des comptes.',
    'ATT&CK range Trust Modification en Privilege Escalation et en Defense Impairment, pas en Persistence : l’IdP pirate permet de se connecter comme n’importe qui.',
    { shown: 'TA0004' }),
  i('valid-cloud-accounts', 3, 'T1078.004', ['TA0006', 'TA0008', 'TA0112'],
    'Toute l’intrusion se fait avec les identifiants légitimes d’un prestataire, aux heures de bureau.',
    'Valid Accounts sert quatre tactiques : Initial Access, Persistence, Privilege Escalation et Stealth. Ici, c’est son rôle de camouflage qui est proposé.',
    { shown: 'TA0005' }),
  i('voice-recon', 3, 'T1598.004', ['TA0001', 'TA0006', 'TA0042'],
    'Un faux auditeur appelle le standard pour connaître le nom de l’outil de MFA et le numéro du support.',
    'Reconnaissance : l’appel vise une information, pas un accès. Phishing for Information est rangé en reconnaissance, Phishing (T1566) en accès initial.', { avoid: ['voice-access'] }),
  i('saml-forgery', 3, 'T1606.002', ['TA0003', 'TA0008', 'TA0005'],
    'Avec le certificat de signature volé, des jetons SAML sont fabriqués pour n’importe quel utilisateur fédéré.',
    'Credential Access : fabriquer le jeton, c’est se forger un identifiant. Ce qu’il permet ensuite (revenir, se déplacer) relève d’autres techniques.'),
  i('poisoned-pipeline', 3, 'T1677', ['TA0001', 'TA0003', 'TA0004'],
    'Une pull request depuis un fork modifie le script de test, que la CI exécute avec les secrets du dépôt.',
    'Execution : Poisoned Pipeline Execution est classée en exécution, sur la plate-forme SaaS. L’entrée dans la chaîne logicielle serait T1195.'),
  i('resource-hierarchy', 3, 'T1666', ['TA0004', 'TA0005', 'TA0003'],
    'Le compte AWS compromis est sorti de l’organisation, et avec lui des SCP qui l’encadraient.',
    'Defense Impairment : quitter l’organisation fait tomber ses garde-fous. On ne gagne aucun droit nouveau, on retire ceux qui bridaient.'),
];

// Contrôle au chargement : un leurre qui serait une tactique valide, ou une
// tactique affichée qui ne le serait pas, fausserait la correction en silence.
for (const it of tacticItems) {
  const valid = technique(it.technique).tactics;
  const bad = it.decoys.filter((d) => valid.includes(d));
  if (bad.length) throw new Error(`Tri des tactiques · ${it.id} : leurre valide ${bad.join(', ')}`);
  if (valid.length > 1 && !it.shown) throw new Error(`Tri des tactiques · ${it.id} : technique multi-tactique sans « shown »`);
  if (it.shown && !valid.includes(it.shown)) throw new Error(`Tri des tactiques · ${it.id} : « shown » n’est pas une tactique valide`);
}

/** La tactique valide proposée parmi les options. */
export const shownTactic = (it: TacticItem): TacticId => it.shown ?? technique(it.technique).tactics[0];

// ── Les séries ──────────────────────────────────────────────────────────────

const mix = (n1: number, n2: number, n3: number): [number, number, number] => [n1, n2, n3];

const V19_IDS = ['cloud-logs-off', 'impersonation', 'clear-mailbox', 'masquerade-account', 'unused-regions', 'create-instance', 'email-hiding-rules', 'modify-mfa', 'resource-hierarchy', 'trust-modification'];
const MULTI_IDS = ['valid-cloud-accounts', 'device-registration', 'modify-mfa', 'trust-modification', 'cookie-replay', 'app-token-reuse', 'steal-cookie', 'voice-recon', 'voice-access', 'forwarding-rule'];

const PROFILES: SeriesProfile<TacticItem>[] = [
  { id: 'noms-parlants', title: 'Noms parlants', mix: mix(10, 0, 0), level: 1,
    text: 'Le nom de la technique contient sa tactique. On apprend les quinze tactiques de la v19 et leur ordre.' },
  { id: 'echauffement', title: 'Échauffement', mix: mix(6, 4, 0), level: 1,
    text: 'Quatre techniques dont le nom ne dit rien se glissent dans le lot : il faut connaître le but de l’adversaire.' },
  { id: 'le-but', title: 'Le but, pas le nom', mix: mix(0, 10, 0), level: 2,
    text: 'Règle de transfert, appel au support, compte de service : chaque leurre est la lecture au premier degré.' },
  { id: 'furtivite-ou-neutralisation', title: 'Se cacher ou éteindre ?', ids: V19_IDS, level: 3,
    text: 'La scission de Defense Evasion en v19 : Stealth se fond dans le légitime, Defense Impairment casse les contrôles.' },
  { id: 'multi-tactiques', title: 'Plusieurs tactiques', ids: MULTI_IDS, level: 3,
    text: 'Techniques à plusieurs tactiques et paires voisines : voler puis rejouer, appeler pour entrer ou pour savoir.' },
  { id: 'pieges', title: 'Les pièges d’ATT&CK', mix: mix(0, 2, 8), level: 3,
    text: 'Surtout du niveau 3 : techniques révoquées en v19, rattachements contre-intuitifs, tactiques multiples.' },
  { id: 'melee', title: 'Mêlée', mix: mix(4, 4, 4), level: 2, shuffleEachTime: true,
    text: 'Tous niveaux confondus, recomposée à chaque partie.' },
];

export const tacticSeries = defineSeries(tacticItems, PROFILES);

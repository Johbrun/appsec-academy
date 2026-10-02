// Scénarios du jeu « Le bon rempart » (M2) : une technique ATT&CK observée chez
// Novafact ou chez un client, quatre mesures, une seule casse vraiment la
// technique.
//
// Chaque option porte la mitigation ATT&CK dont elle relève (`m`). La bonne
// réponse est toujours la première du tableau (l'affichage mélange) et sa
// mitigation **doit** être de celles qu'ATT&CK relie à la technique : c'est
// vérifié au chargement, contre `attack.ts` (v19). Les leurres, eux, peuvent
// relever d'une mitigation qu'ATT&CK cite aussi : être cité ne veut pas dire
// suffire, et c'est souvent tout l'objet de la question. Chaque leurre a son
// `flaw`, la raison nommable pour laquelle il ne tient pas ici.
//
// ── Ce que mesure le niveau ──────────────────────────────────────────────────
//
//   N1 · Les leurres visent une autre technique, ou une autre étape : une
//        sauvegarde contre un vol, un antivirus contre une attaque qui ne passe
//        pas par le poste. Il suffit de relier la mesure au mécanisme.
//
//   N2 · Les leurres sont de vrais contrôles de la même famille, mais
//        partiels ou tardifs : la revue trimestrielle contre le blocage, le
//        verrouillage que la pulvérisation passe par-dessous, la formation qui
//        compte sur le salarié à 3 h du matin.
//
//   N3 · Le contrôle « évident » est le piège : la MFA face à un jeton OAuth
//        ou un cookie volé après authentification, la signature d'un artefact
//        déjà empoisonné, la mise à jour immédiate face à un paquet piégé. Il
//        faut nommer ce que la technique contourne pour trouver ce qui la casse.
//
// Les options d'un même scénario restent de longueur comparable : `npm run
// games` refuse qu'on gagne en choisissant la plus longue.

import { defineSeries, type Leveled, type SeriesProfile } from '../lib/series';
import { mitigation, technique } from './attack';

export interface Rampart {
  /** Mitigation ATT&CK dont relève la mesure. */
  m: string;
  text: string;
  /** Pour un leurre : pourquoi il ne casse pas la technique. */
  flaw?: string;
}

export interface RampartItem extends Leveled {
  technique: string;
  situation: string;
  /** La bonne mesure en premier. */
  options: Rampart[];
  why: string;
}

const r = (m: string, text: string, flaw?: string): Rampart => ({ m, text, ...(flaw ? { flaw } : {}) });

export const rampartItems: RampartItem[] = [
  // ── N1 · Une autre technique, une autre étape ────────────────────────────
  {
    id: 'spray-test-tenant', level: 1, technique: 'T1110.003',
    situation: 'Un ancien compte de recette, sans MFA, reçoit un mot de passe courant toutes les heures depuis des proxys résidentiels.',
    options: [
      r('M1032', 'Imposer la MFA à tous les comptes, tenants de test compris'),
      r('M1049', 'Installer un antimaliciel sur le poste du titulaire', 'La pulvérisation vise le service d’authentification ; elle ne passe par aucun poste.'),
      r('M1053', 'Sauvegarder chaque nuit la boîte mail du compte de recette', 'Une sauvegarde restaure ce qui a été perdu ; elle n’empêche ni la connexion ni la lecture.'),
      r('M1036', 'Verrouiller le compte après cinq échecs', 'Un essai par heure reste sous n’importe quel seuil de verrouillage : c’est le principe de la pulvérisation.'),
    ],
    why: 'Le mot de passe deviné ne suffit plus si un second facteur est exigé. C’est par un compte de test oublié, sans MFA, que Midnight Blizzard est entré chez Microsoft fin 2023 : les environnements de test font partie de la surface.',
  },
  {
    id: 'slack-secret', level: 1, technique: 'T1552.008',
    situation: 'Le mot de passe du compte d’administration de la sauvegarde est épinglé dans un canal Slack de l’équipe infra.',
    options: [
      r('M1047', 'Scanner les messageries à la recherche de secrets, et les révoquer'),
      r('M1032', 'Imposer la MFA à l’ouverture de l’espace de travail Slack', 'L’attaquant qui lit le canal est déjà connecté avec un compte valide ; la MFA ne masque rien à un membre.'),
      r('M1041', 'Chiffrer au repos, chez l’éditeur, tous les messages de l’espace Slack', 'Le chiffrement au repos protège les disques de l’éditeur ; tout membre du canal lit le message en clair.'),
      r('M1030', 'Isoler le réseau de l’équipe infra du reste de l’entreprise', 'Le secret vit dans un SaaS joignable de partout ; la segmentation interne ne le touche pas.'),
    ],
    why: 'ATT&CK recommande d’auditer les messageries pour y trouver les identifiants en clair. Un secret trouvé se révoque : le supprimer du canal ne suffit pas, il a pu être lu.',
  },
  {
    id: 'hiding-rule', level: 1, technique: 'T1564.008',
    situation: 'Sur la boîte de la comptabilité, une règle déplace vers « Flux RSS » et marque comme lu tout message contenant « virement ».',
    options: [
      r('M1047', 'Alerter sur toute nouvelle règle de boîte qui déplace ou marque lu'),
      r('M1057', 'Activer une règle DLP sur les IBAN des messages sortants', 'La règle cache des messages entrants à la victime ; rien ne sort, la DLP ne voit rien.'),
      r('M1021', 'Bloquer au proxy web les catégories de sites malveillants connus', 'La règle se crée dans le service de messagerie avec un compte valide, sans site malveillant.'),
      r('M1053', 'Sauvegarder les boîtes mail chaque nuit chez un prestataire', 'Les messages ne sont pas supprimés, juste cachés ; la sauvegarde ne révèle pas la règle.'),
    ],
    why: 'ATT&CK ne cite qu’une mitigation pour T1564.008 : l’audit. La création d’une règle qui déplace, supprime ou marque lu sur des mots comme « virement » est un signal fort, à alerter dès qu’elle apparaît.',
  },
  {
    id: 'webhook-exfil', level: 1, technique: 'T1567.004',
    situation: 'Un script installé sur un poste du support poste chaque nuit les exports clients vers un webhook Discord.',
    options: [
      r('M1057', 'Bloquer par DLP l’envoi de données clients vers des webhooks'),
      r('M1032', 'Exiger la MFA pour ouvrir l’outil de support client', 'Le script tourne dans une session déjà ouverte ; la MFA a été validée avant lui.'),
      r('M1053', 'Copier les exports dans un bucket versionné et verrouillé', 'Le versionnement protège la disponibilité des exports, pas leur confidentialité.'),
      r('M1047', 'Revoir chaque trimestre les droits d’accès à l’outil de support', 'Le compte a légitimement accès aux exports ; une revue trimestrielle arrive des mois après la fuite.'),
    ],
    why: 'Le webhook est un service web légitime, souvent autorisé en sortie. Seule une inspection du contenu sortant, la DLP, distingue un export clients d’un message de chat ; c’est l’unique mitigation qu’ATT&CK cite.',
  },
  {
    id: 'crm-export', level: 1, technique: 'T1213.004',
    situation: 'Un compte commercial compromis exporte par l’API toutes les fiches Account et Contact du CRM.',
    options: [
      r('M1018', 'Réserver l’API et l’export en masse à quelques profils nommés'),
      r('M1041', 'Chiffrer au repos les champs sensibles des fiches du CRM', 'Un utilisateur autorisé lit les champs déchiffrés : l’API les lui rend en clair.'),
      r('M1053', 'Sauvegarder l’instance CRM chaque semaine chez un tiers', 'La sauvegarde protège contre la perte, pas contre la lecture par un compte légitime.'),
      r('M1049', 'Passer à l’antivirus les pièces jointes du CRM', 'Rien n’est exécuté : l’attaquant lit des enregistrements, il ne dépose pas de fichier.'),
    ],
    why: 'Le moindre privilège coupe la technique là où elle passe : un commercial n’a pas besoin de l’API ni de l’export en masse. Les campagnes de 2025 contre Salesforce ont toutes reposé sur des accès API trop larges.',
  },
  {
    id: 'esxi-ransom', level: 1, technique: 'T1486',
    situation: 'Un administrateur compromis chiffre les hyperviseurs ESXi un dimanche soir.',
    options: [
      r('M1053', 'Garder des sauvegardes hors ligne, hors annuaire, testées'),
      r('M1041', 'Chiffrer les disques des machines virtuelles avec une clé dédiée', 'L’attaquant chiffre par-dessus : un disque déjà chiffré se rechiffre aussi bien.'),
      r('M1047', 'Auditer chaque mois les comptes d’administration des hyperviseurs', 'Le compte utilisé est légitime et l’attaque tient en une nuit ; l’audit mensuel la constate après coup.'),
      r('M1051', 'Appliquer chaque mois tous les correctifs de sécurité des hyperviseurs', 'Un administrateur n’exploite aucune faille : il utilise ses droits.'),
    ],
    why: 'Quand l’attaquant a les droits d’un administrateur, la seule mesure qui tient est la capacité de restaurer : des sauvegardes qu’il ne peut pas atteindre avec ces mêmes droits, et une restauration testée.',
  },
  {
    id: 'sms-pumping', level: 1, technique: 'T1496.003',
    situation: 'Le formulaire « recevoir mon code par SMS » de Novafact envoie des milliers de messages vers des numéros surtaxés.',
    options: [
      r('M1013', 'Protéger l’envoi de SMS par un CAPTCHA et des plafonds'),
      r('M1032', 'Exiger la MFA par SMS pour tous les comptes clients', 'Plus de SMS envoyés, c’est plus de surface pour le pompage : la mesure aggrave le problème.'),
      r('M1041', 'Chiffrer en base les numéros de téléphone des clients', 'Les numéros visés ne sont pas ceux des clients : l’attaquant saisit les siens.'),
      r('M1047', 'Rapprocher chaque mois la facture de l’opérateur SMS du budget prévu', 'L’écart se verra, mais un mois de pompage est déjà facturé.'),
    ],
    why: 'Le SMS pumping abuse d’une fonction légitime pour faire payer la victime. ATT&CK range la parade dans les consignes aux développeurs : CAPTCHA sur le formulaire, plafonds par numéro et par pays, et blocage des destinations sans clients.',
  },
  {
    id: 'imds-ssrf', level: 1, technique: 'T1552.005',
    situation: 'Une SSRF dans le générateur de PDF interroge 169.254.169.254 et renvoie les identifiants du rôle de l’instance.',
    options: [
      r('M1042', 'Désactiver IMDSv1 et imposer IMDSv2 sur les instances'),
      r('M1032', 'Imposer la MFA aux utilisateurs IAM de la console AWS', 'Les identifiants du rôle de l’instance ne passent jamais par une MFA humaine.'),
      r('M1041', 'Chiffrer tous les volumes EBS de l’instance avec une clé KMS dédiée', 'Le service de métadonnées ne lit pas le disque ; le chiffrement ne change rien à sa réponse.'),
      r('M1053', 'Sauvegarder les instances chaque nuit avec AWS Backup', 'Rien n’est détruit : les identifiants sont lus, puis utilisés ailleurs.'),
    ],
    why: 'ATT&CK recommande de désactiver les versions non sûres du service de métadonnées. IMDSv2 exige un jeton obtenu par un PUT avec en-tête : une SSRF simple ne l’obtient pas. Capital One (2019) reste le cas d’école ; la vraie correction reste la SSRF elle-même.',
  },

  // ── N2 · Un vrai contrôle, mais partiel ou tardif ────────────────────────
  {
    id: 'mfa-fatigue', level: 2, technique: 'T1621',
    situation: 'Le mot de passe d’un prestataire est connu ; l’attaquant déclenche des dizaines de notifications push jusqu’à ce qu’une soit acceptée.',
    options: [
      r('M1032', 'Remplacer le push simple par la saisie d’un nombre affiché'),
      r('M1017', 'Rappeler à tous de refuser une demande non initiée', 'Utile, mais il suffit d’une erreur, à 3 h du matin, sur des dizaines de demandes : chez Uber (2022), le prestataire en avait d’abord refusé plusieurs.'),
      r('M1027', 'Allonger les mots de passe des prestataires', 'L’attaquant a déjà le mot de passe ; sa longueur ne joue plus.'),
      r('M1036', 'Verrouiller le compte après cinq mots de passe erronés', 'Le mot de passe saisi est le bon : les échecs sont des refus de MFA, pas des erreurs de mot de passe.'),
    ],
    why: 'ATT&CK recommande de remplacer le push en un clic par une MFA qui exige une action liée à la connexion, comme recopier un nombre affiché à l’écran. Une notification acceptée par lassitude ne suffit alors plus.',
  },
  {
    id: 'forwarding-external', level: 2, technique: 'T1114.003',
    situation: 'Une règle transfère chaque message de la direction financière vers une adresse Gmail ; elle survit au changement de mot de passe.',
    options: [
      r('M1042', 'Désactiver le transfert automatique vers l’extérieur'),
      r('M1047', 'Lister une fois par trimestre les règles de transfert existantes', 'C’est une mitigation ATT&CK, mais trois mois de courrier de la direction financière seront partis avant.'),
      r('M1032', 'Imposer la MFA à l’ouverture de la messagerie web', 'La règle s’exécute côté serveur, sans session : la MFA ne la concerne plus une fois créée.'),
      r('M1053', 'Archiver chaque nuit les boîtes de la direction financière', 'L’archive garde une copie ; elle n’empêche pas l’envoi de l’autre copie vers l’extérieur.'),
    ],
    why: 'Désactiver le transfert externe supprime la technique entière, quel que soit le compte compromis. L’audit des règles reste utile pour les transferts internes, mais il arrive après.',
  },
  {
    id: 'snowflake-creds', level: 2, technique: 'T1078.004',
    situation: 'Des identifiants d’une plate-forme de données, volés par un infostealer il y a trois ans, fonctionnent toujours.',
    options: [
      r('M1032', 'Rendre la MFA obligatoire sur chaque compte'),
      r('M1027', 'Faire tourner une fois par an tous les mots de passe de la plate-forme', 'Ça aurait invalidé des identifiants vieux de trois ans, pas ceux volés le mois dernier.'),
      r('M1041', 'Chiffrer les tables avec des clés gérées par le client', 'L’attaquant se connecte en utilisateur légitime : les requêtes lui rendent les données déchiffrées.'),
      r('M1047', 'Revoir chaque année la liste des comptes encore actifs', 'Les comptes utilisés étaient actifs et légitimes : la revue les aurait gardés.'),
    ],
    why: 'Dans la campagne UNC5537 contre des clients de Snowflake (2024), les comptes visés n’avaient ni MFA ni liste d’adresses autorisées. La rotation réduit la fenêtre ; la MFA, elle, rend inutilisable un mot de passe volé, quel que soit son âge.',
  },
  {
    id: 'helpdesk-vishing', level: 2, technique: 'T1566.004',
    situation: 'Un appelant, qui connaît le matricule et le manager d’un salarié, demande au support de réinitialiser ses facteurs MFA.',
    options: [
      r('M1017', 'Rappeler sur un numéro connu et faire valider par le manager'),
      r('M1032', 'Imposer la MFA à tous les comptes du service support', 'Le support ne se fait pas voler son compte : il réinitialise de bonne foi la MFA d’un autre.'),
      r('M1021', 'Bloquer au proxy les sites d’hameçonnage connus', 'L’attaque passe par un appel téléphonique, pas par un site.'),
      r('M1047', 'Enregistrer et réécouter chaque semaine tous les appels reçus par le support', 'La réécoute éclaire l’enquête ; l’attaquant a déjà ses accès quand elle a lieu.'),
    ],
    why: 'ATT&CK ne cite qu’une mitigation pour l’hameçonnage vocal : apprendre à vérifier l’identité de l’appelant. Au support, ça devient une procédure : rappel sur un numéro connu à l’avance et validation par le manager avant toute réinitialisation. C’est le maillon que décrivent les récits de l’attaque contre MGM (2023).',
  },
  {
    id: 'drive-external-share', level: 2, technique: 'T1537',
    situation: 'Un compte compromis partage 1 300 fichiers du dossier « Clients » avec un compte Gmail personnel.',
    options: [
      r('M1054', 'Bloquer le partage externe hors des domaines approuvés'),
      r('M1041', 'Chiffrer les fichiers du dossier « Clients » au repos', 'Le destinataire du partage ouvre les fichiers par le service, qui les lui déchiffre.'),
      r('M1053', 'Sauvegarder le Drive chez un prestataire chaque nuit', 'Les fichiers ne sont ni perdus ni modifiés : ils sont copiés ailleurs.'),
      r('M1047', 'Revoir chaque trimestre tous les liens de partage existants du Drive', 'La revue les trouvera, mais le compte Gmail aura déjà tout téléchargé.'),
    ],
    why: 'Les données ne quittent pas le fournisseur, elles changent de compte : un pare-feu ou un proxy n’en voit rien. Le réglage du service est le seul point de passage, et ATT&CK cite justement la restriction du partage externe.',
  },
  {
    id: 'cloudtrail-stop', level: 2, technique: 'T1685.002',
    situation: 'Un rôle compromis appelle StopLogging sur le trail CloudTrail, puis DeleteTrail vingt minutes plus tard.',
    options: [
      r('M1018', 'Retirer StopLogging et DeleteTrail à tous les rôles par une SCP'),
      r('M1047', 'Relire chaque semaine les événements CloudTrail du compte', 'Une fois le trail coupé, il n’y a plus rien à relire pour la période qui compte.'),
      r('M1032', 'Imposer la MFA à tous les utilisateurs IAM humains', 'L’appel vient d’un rôle, dont les identifiants temporaires ne passent pas par une MFA.'),
      r('M1041', 'Chiffrer les journaux CloudTrail avec une clé KMS dédiée', 'Le chiffrement protège ce qui est écrit ; il n’empêche pas d’arrêter l’écriture.'),
    ],
    why: 'La seule mitigation qu’ATT&CK cite est de réserver la modification de la journalisation à qui en a besoin. Une SCP d’organisation l’impose même à un administrateur du compte, et une alerte sur la tentative la rend visible.',
  },
  {
    id: 'device-enrolment', level: 2, technique: 'T1098.005',
    situation: 'Dix jours après une compromission, un nouvel authentificateur est enrôlé sur le compte d’un juriste depuis un pays inhabituel.',
    options: [
      r('M1032', 'Exiger MFA et lieu de confiance pour enrôler un appareil'),
      r('M1027', 'Imposer un mot de passe différent pour chaque service', 'Le mot de passe est déjà compromis ; c’est l’enrôlement qui donne la persistance.'),
      r('M1047', 'Revoir chaque trimestre la liste des appareils enregistrés pour chaque compte', 'La revue trouve l’appareil des semaines plus tard ; il a servi entre-temps.'),
      r('M1053', 'Sauvegarder la boîte du juriste chez un prestataire', 'Rien n’est détruit : l’attaquant lit et revient.'),
    ],
    why: 'ATT&CK relie Device Registration à la MFA, appliquée à l’enrôlement lui-même : exiger une MFA déjà enrôlée et un lieu ou un appareil de confiance pour en ajouter une. APT29 enrôle ses propres appareils ainsi.',
  },
  {
    id: 'public-cve', level: 2, technique: 'T1190',
    situation: 'Une CVE critique de la passerelle de transfert de fichiers exposée sur Internet est publiée, preuve de concept comprise.',
    options: [
      r('M1051', 'Corriger sous 24 heures les services exposés'),
      r('M1050', 'Ajouter devant la passerelle une règle WAF générique contre l’injection SQL', 'Un filet utile en attendant, mais une variante de la charge passe à côté : il ne corrige rien.'),
      r('M1032', 'Imposer la MFA sur la console d’administration de la passerelle', 'La faille s’exploite sans authentification, avant toute console.'),
      r('M1053', 'Sauvegarder chaque nuit les fichiers transférés', 'Les fichiers sont volés, pas détruits : la sauvegarde ne change rien à la fuite.'),
    ],
    why: 'Face à une faille publique avec preuve de concept, la course est contre l’exploitation de masse : pour MOVEit Transfer (2023), elle avait même commencé avant la publication du correctif. Le WAF achète du temps, le correctif ferme la porte.',
  },
  {
    id: 'secrets-manager', level: 2, technique: 'T1555.006',
    situation: 'Un rôle de traitement compromis appelle GetSecretValue sur tous les secrets du compte, dont ceux de la base de production.',
    options: [
      r('M1026', 'Limiter GetSecretValue de chaque rôle à ses propres secrets'),
      r('M1032', 'Imposer la MFA aux utilisateurs IAM qui lisent les secrets', 'Un rôle n’a pas de MFA : la mesure ne concerne que les humains.'),
      r('M1047', 'Relire chaque mois les appels GetSecretValue', 'Le compte rendu mensuel décrira une fuite déjà exploitée.'),
      r('M1053', 'Répliquer les secrets dans un second compte de secours', 'Une copie de plus, c’est une exposition de plus, pas une protection.'),
    ],
    why: 'ATT&CK ne cite qu’une mitigation pour les coffres de secrets cloud : limiter qui peut les interroger, et à quoi. Un rôle qui lit tous les secrets transforme toute compromission en compromission totale.',
  },

  // ── N3 · Le contrôle évident est le piège ────────────────────────────────
  {
    id: 'circleci-cookie', level: 3, technique: 'T1539',
    situation: 'Un logiciel malveillant sur le portable d’un ingénieur copie sa session SSO, déjà validée par la 2FA.',
    options: [
      r('M1054', 'Raccourcir les sessions SSO et les lier à l’appareil'),
      r('M1032', 'Exiger une clé FIDO2 à chaque connexion SSO', 'FIDO2 bloque le vol par proxy d’hameçonnage ; ici, le cookie est copié après une connexion légitime.'),
      r('M1027', 'Imposer une rotation trimestrielle des mots de passe SSO de l’équipe', 'La session volée ne dépend plus du mot de passe : elle reste valide jusqu’à son expiration.'),
      r('M1041', 'Chiffrer le disque du portable de l’ingénieur', 'Le logiciel malveillant tourne dans la session ouverte ; le disque est déjà déchiffré.'),
    ],
    why: 'ATT&CK recommande de réduire la durée de validité des cookies : une session courte, liée à l’appareil, laisse moins de temps au rejeu. Chez CircleCI (2022-2023), le cookie volé portait déjà la 2FA : aucune MFA ne pouvait plus l’arrêter.',
  },
  {
    id: 'consent-app', level: 3, technique: 'T1671',
    situation: 'Un salarié consent à « PDF Viewer Pro », éditeur non vérifié, qui demande Mail.Read et offline_access.',
    options: [
      r('M1042', 'Interdire aux utilisateurs de consentir à une application'),
      r('M1032', 'Exiger une MFA résistante à l’hameçonnage avant tout consentement OAuth', 'Le salarié consent lui-même, MFA comprise : le jeton accordé survit ensuite sans elle.'),
      r('M1027', 'Forcer la réinitialisation du mot de passe du salarié', 'Le consentement ne dépend pas du mot de passe : l’application garde son accès.'),
      r('M1017', 'Apprendre à repérer les fausses pages de connexion', 'L’écran de consentement est le vrai, sur le domaine de l’éditeur : il n’y a rien de faux à repérer.'),
    ],
    why: 'ATT&CK cite la désactivation du consentement utilisateur (option « Do not allow user consent » d’Entra ID) et l’audit des intégrations. Une fois accordé, l’accès d’une application ne dépend plus ni du mot de passe ni de la MFA : seul le révoquer le coupe.',
  },
  {
    id: 'npm-worm', level: 3, technique: 'T1195.001',
    situation: 'Une nouvelle version piégée d’une dépendance npm très utilisée vole les jetons des postes qui l’installent.',
    options: [
      r('M1033', 'Passer par un registre interne qui retient les versions récentes'),
      r('M1051', 'Mettre à jour automatiquement chaque dépendance dès qu’une version sort', 'C’est le chemin le plus court vers la version piégée.'),
      r('M1016', 'Bloquer en CI les dépendances qui ont une CVE connue', 'Une version malveillante n’a pas de CVE le jour de sa publication.'),
      r('M1032', 'Imposer la MFA aux comptes npm de l’équipe', 'Ça protège ce que l’équipe publie, pas ce qu’elle installe.'),
    ],
    why: 'ATT&CK recommande de passer par un dépôt interne de paquets vérifiés. Retenir les versions de quelques jours laisse au registre et aux chercheurs le temps de retirer un paquet piégé : en septembre 2025, les versions piégées de chalk et de debug ont été retirées le jour même.',
  },
  {
    id: 'pipeline-pr', level: 3, technique: 'T1677',
    situation: 'Une pull request ouverte depuis un fork modifie le script de test ; la CI l’exécute avec le jeton de publication du dépôt.',
    options: [
      r('M1054', 'Exécuter le code des forks sans secrets, sur un runner isolé'),
      r('M1032', 'Imposer la MFA à tous les mainteneurs du dépôt', 'L’attaquant n’a besoin d’aucun compte du dépôt : il ouvre une pull request.'),
      r('M1045', 'Signer tous les artefacts produits par la CI avant leur publication', 'La CI signerait l’artefact empoisonné : la signature prouve d’où il vient, pas qu’il est sain.'),
      r('M1016', 'Ajouter un scan SAST obligatoire à chaque pull request', 'Le scan tourne dans le même pipeline, après que le script piégé a lu les secrets.'),
    ],
    why: 'ATT&CK recommande de ne pas exécuter de code non relu avec des secrets, et cite pull_request_target. La pull request apporte son propre code : seul ce que le pipeline lui donne compte.',
  },
  {
    id: 'drift-tokens', level: 3, technique: 'T1550.001',
    situation: 'Des jetons OAuth volés chez un éditeur d’intégration ouvrent les instances Salesforce de ses clients, depuis Tor.',
    options: [
      r('M1036', 'Limiter les jetons de l’intégration à ses adresses IP connues'),
      r('M1032', 'Exiger la MFA de tous les utilisateurs Salesforce', 'Le jeton OAuth est accepté sans connexion utilisateur : la MFA n’est jamais sollicitée.'),
      r('M1027', 'Réinitialiser les mots de passe de tous les utilisateurs Salesforce', 'Les jetons de l’intégration ne dépendent d’aucun mot de passe utilisateur.'),
      r('M1041', 'Chiffrer les champs sensibles des tickets clients', 'L’intégration a le droit de lire les tickets : le service les lui rend déchiffrés.'),
    ],
    why: 'ATT&CK recommande de restreindre l’usage des jetons hors de leur contexte attendu. Une intégration appelle depuis les adresses de son éditeur : la même requête venue d’ailleurs est refusée. C’est le cas de la campagne UNC6395 (août 2025) : des jetons de l’intégration Drift rejoués hors de chez l’éditeur.',
  },
  {
    id: 'golden-saml', level: 3, technique: 'T1606.002',
    situation: 'Avec le certificat de signature volé sur le serveur de fédération, l’attaquant fabrique des jetons SAML pour n’importe quel utilisateur.',
    options: [
      r('M1026', 'N’administrer la fédération que depuis des postes dédiés'),
      r('M1032', 'Imposer la MFA à tous les utilisateurs fédérés', 'Le jeton forgé déclare lui-même que la MFA a eu lieu : le service le croit.'),
      r('M1027', 'Faire tourner les mots de passe des comptes de service', 'Le certificat de signature n’est pas un mot de passe : la rotation ne l’invalide pas.'),
      r('M1053', 'Sauvegarder chaque jour toute la configuration du serveur de fédération', 'Restaurer la configuration remettrait en place le même certificat volé.'),
    ],
    why: 'Une fois le certificat volé, plus rien en aval ne distingue un jeton forgé d’un vrai. ATT&CK place la défense sur le serveur de fédération : accès réservé à des postes d’administration dédiés. Pour contenir l’incident, il faut faire tourner deux fois le certificat.',
  },
  {
    id: 'rogue-idp', level: 3, technique: 'T1484.002',
    situation: 'Un administrateur Okta compromis ajoute un fournisseur d’identité externe, avec liaison automatique des comptes.',
    options: [
      r('M1018', 'Réserver l’ajout d’un IdP à un rôle restreint, sous alerte'),
      r('M1032', 'Imposer la MFA à tous les utilisateurs finaux du tenant', 'Les connexions passent par l’IdP de l’attaquant, qui affirme lui-même l’authentification.'),
      r('M1027', 'Allonger et renouveler les mots de passe des salariés', 'Aucun mot de passe n’est demandé : l’IdP pirate suffit pour se connecter.'),
      r('M1053', 'Sauvegarder la configuration du tenant Okta chaque nuit', 'La sauvegarde aide à revenir en arrière, pas à empêcher ni à voir l’ajout.'),
    ],
    why: 'ATT&CK recommande de limiter qui peut créer des fournisseurs d’identité. Okta a décrit ce mode opératoire en 2023 : support usurpé, droits de super-administrateur, puis IdP ajouté pour se connecter comme n’importe qui.',
  },
  {
    id: 'app-credentials', level: 3, technique: 'T1098.001',
    situation: 'Un compte compromis ajoute un nouveau secret client à une application Entra ID qui lit toutes les boîtes mail.',
    options: [
      r('M1018', 'Interdire aux comptes ordinaires d’ajouter des secrets d’application'),
      r('M1032', 'Exiger la MFA de tous les utilisateurs du tenant', 'Le secret ajouté authentifie l’application, qui ne passe jamais par une MFA.'),
      r('M1027', 'Réinitialiser le mot de passe du compte compromis', 'Le secret de l’application survit au changement de mot de passe du compte qui l’a créé.'),
      r('M1041', 'Chiffrer toutes les boîtes mail du tenant avec des clés gérées par le client', 'L’application est autorisée à lire les boîtes : le service les lui déchiffre.'),
    ],
    why: 'ATT&CK recommande que les comptes peu privilégiés ne puissent pas ajouter d’identifiants. Un secret ajouté à une application déjà puissante est une persistance qui ignore les mots de passe et la MFA des utilisateurs.',
  },
];

// Contrôle au chargement : la mesure présentée comme la bonne doit relever
// d'une mitigation qu'ATT&CK relie à la technique, sinon le jeu enseigne un
// lien qui n'existe pas.
for (const it of rampartItems) {
  const t = technique(it.technique);
  it.options.forEach((o) => mitigation(o.m));
  if (!t.mitigations.includes(it.options[0].m)) {
    throw new Error(`Le bon rempart · ${it.id} : ${it.options[0].m} n’est pas une mitigation ATT&CK de ${t.id}`);
  }
  if (it.options.slice(1).some((o) => !o.flaw)) throw new Error(`Le bon rempart · ${it.id} : un leurre sans « flaw »`);
}

// ── Les séries ──────────────────────────────────────────────────────────────

const mix = (n1: number, n2: number, n3: number): [number, number, number] => [n1, n2, n3];

const IDENTITY_IDS = ['spray-test-tenant', 'mfa-fatigue', 'snowflake-creds', 'helpdesk-vishing', 'device-enrolment', 'consent-app', 'rogue-idp', 'golden-saml'];
const APPSEC_IDS = ['imds-ssrf', 'sms-pumping', 'public-cve', 'secrets-manager', 'cloudtrail-stop', 'npm-worm', 'pipeline-pr'];
const MFA_TRAP_IDS = ['circleci-cookie', 'consent-app', 'drift-tokens', 'golden-saml', 'rogue-idp', 'app-credentials'];

const PROFILES: SeriesProfile<RampartItem>[] = [
  { id: 'premier-rempart', title: 'Premier rempart', mix: mix(6, 0, 0), level: 1,
    text: 'Les leurres visent une autre technique ou une autre étape. On apprend à relier la mesure au mécanisme.' },
  { id: 'controle-partiel', title: 'Le contrôle partiel', mix: mix(1, 6, 0), level: 2,
    text: 'Revue trimestrielle, verrouillage, formation : de vrais contrôles, mais trop tardifs ou contournés par la technique.' },
  { id: 'identite', title: 'Identité et IdP', ids: IDENTITY_IDS, level: 2,
    text: 'Pulvérisation, fatigue MFA, support usurpé, consentement OAuth, IdP pirate : la menace SaaS passe par l’identité.' },
  { id: 'appsec-cloud', title: 'Code, pipeline et cloud', ids: APPSEC_IDS, level: 2,
    text: 'SSRF vers l’IMDS, CVE exposée, paquet piégé, pull request de fork : les techniques qui passent par le code et le pipeline.' },
  { id: 'piege-mfa', title: 'Quand la MFA ne sert à rien', ids: MFA_TRAP_IDS, level: 3,
    text: 'Cookie, jeton OAuth, assertion SAML, secret d’application : la MFA est toujours proposée, et toujours à côté.' },
  { id: 'melee', title: 'Mêlée', mix: mix(2, 3, 2), level: 2, shuffleEachTime: true,
    text: 'Tous niveaux confondus, recomposée à chaque partie.' },
];

export const rampartSeries = defineSeries(rampartItems, PROFILES);

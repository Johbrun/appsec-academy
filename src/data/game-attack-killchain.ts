// Incidents du jeu « Kill Chain » (M2) : remettre dans l'ordre les étapes d'un
// incident réel, chaque étape étiquetée de sa technique ATT&CK v19.
//
// Tous les incidents sont documentés par une source primaire (victime,
// enquêteur mandaté, autorité), citée dans `source`. Les étapes restent au
// niveau de détail de ces sources et de la leçon M2 · 5 : ce qui s'est passé,
// pas comment le refaire. Une étape qui ne repose que sur une revendication de
// l'attaquant n'est pas retenue ; quand une source ne dit pas un détail, il
// n'est pas inventé. Les étapes de détection ou de réponse n'ont pas de
// technique (`technique: null`) : elles se placent dans la même chronologie.
//
// Les techniques sont lues dans `attack.ts` (v19) : un identifiant révoqué ou
// mal saisi casse le chargement.
//
// ── Ce que mesure le niveau ──────────────────────────────────────────────────
//
//   N1 · Quatre à cinq étapes qui suivent l'ordre des tactiques (accès,
//        découverte, collecte, impact). Connaître la grammaire d'ATT&CK suffit
//        à reconstituer la chaîne.
//
//   N2 · Cinq à six étapes, dont une détection ou une réponse à placer, et une
//        paire voisine (voler puis rejouer, créer puis attribuer) qu'il faut
//        lire pour ne pas l'inverser.
//
//   N3 · L'ordre des tactiques trompe : une compromission initiale qui précède
//        l'incident de plusieurs mois, une extorsion qui arrive longtemps après
//        la collecte, une découverte faite par un client avant l'éditeur. Il
//        faut lire les dates et les liens de cause, pas la matrice.

import { defineSeries, type Leveled, type SeriesProfile } from '../lib/series';
import { technique } from './attack';

export interface ChainStep {
  text: string;
  /** Technique ATT&CK v19 ; `null` pour une étape de détection ou de réponse. */
  technique: string | null;
}

export interface ChainIncident extends Leveled {
  name: string;
  date: string;
  /** Qui a écrit les faits retenus. */
  source: string;
  /** Les étapes, dans l'ordre chronologique. */
  steps: ChainStep[];
  /** Ce que la chaîne enseigne, une fois remise dans l'ordre. */
  lesson: string;
}

const s = (technique: string | null, text: string): ChainStep => ({ technique, text });

export const chainIncidents: ChainIncident[] = [
  // ── N1 · L'ordre des tactiques suffit ────────────────────────────────────
  {
    id: 'capital-one', level: 1,
    name: 'Capital One', date: '2019',
    source: 'Plainte pénale du ministère américain de la Justice (juillet 2019) et communiqué de Capital One.',
    steps: [
      s('T1190', 'Un pare-feu applicatif mal configuré relaie une requête forgée vers le service de métadonnées de l’instance.'),
      s('T1552.005', 'Le service de métadonnées renvoie les identifiants temporaires du rôle attaché à l’instance.'),
      s('T1580', 'Avec ces identifiants, les buckets S3 accessibles au rôle sont listés.'),
      s('T1530', 'Le contenu des buckets est copié hors de l’environnement.'),
      s(null, 'Le 17 juillet 2019, un tiers signale à Capital One des données publiées en ligne.'),
    ],
    lesson: 'Une seule faille applicative (une SSRF) suffit quand le rôle de l’instance lit tout. IMDSv2 et un rôle réduit au strict besoin cassent la chaîne dès la deuxième étape.',
  },
  {
    id: 'uber', level: 1,
    name: 'Uber', date: 'septembre 2022',
    source: 'Uber, « Security update » (septembre 2022).',
    steps: [
      s('T1589.001', 'Le mot de passe d’un prestataire, probablement volé par un malware sur son appareil personnel, est acheté sur le dark web.'),
      s('T1621', 'Des tentatives de connexion répétées déclenchent des demandes d’approbation ; le prestataire finit par en accepter une.'),
      s('T1078', 'D’autres comptes d’employés donnent ensuite des droits élevés sur plusieurs outils, dont G-Suite et Slack.'),
      s('T1491.001', 'Un message est posté sur un canal Slack de toute l’entreprise et une image s’affiche sur des sites internes.'),
      s(null, 'La supervision d’Uber identifie l’incident : comptes bloqués, outils coupés, clés internes renouvelées.'),
    ],
    lesson: 'Le premier contrôle qui pouvait tenir est la MFA, et elle s’approuvait d’un geste. Une MFA à correspondance de nombre ou FIDO2, plus une alerte sur une rafale de refus, casse la chaîne à la deuxième étape.',
  },
  {
    id: 'snowflake', level: 1,
    name: 'Clients de Snowflake (UNC5537)', date: 'avril – juin 2024',
    source: 'Mandiant, « UNC5537 Targets Snowflake Customer Instances » (juin 2024).',
    steps: [
      s('T1555.003', 'Des infostealers, sur des machines de prestataires, volent des identifiants ; les plus anciennes infections remontent à novembre 2020.'),
      s('T1078.004', 'Ces identifiants ouvrent des comptes clients qui n’ont ni MFA ni liste d’adresses autorisées.'),
      s('T1087.004', 'Un outil de reconnaissance liste utilisateurs, rôles et tables.'),
      s('T1074', 'Les tables visées sont copiées dans une zone de préparation temporaire.'),
      s('T1657', 'Les victimes sont extorquées, et des données proposées à la vente.'),
    ],
    lesson: 'Mandiant ne relève aucune compromission de la plate-forme elle-même : des identifiants vieux de plusieurs années, sans MFA, suffisaient. La rotation et la MFA cassent la chaîne dès la deuxième étape.',
  },

  // ── N2 · Une détection à placer, une paire voisine ───────────────────────
  {
    id: 'circleci', level: 2,
    name: 'CircleCI', date: 'décembre 2022 – janvier 2023',
    source: 'CircleCI, rapport d’incident du 4 janvier 2023.',
    steps: [
      s('T1539', '16 décembre : un malware non détecté vole, sur le portable d’un ingénieur, une session SSO déjà validée par la 2FA.'),
      s('T1550.004', 'La session est rejouée depuis un autre lieu : l’attaquant agit sous l’identité de l’ingénieur.'),
      s('T1078', 'Les droits de l’ingénieur donnent accès à une partie des systèmes de production.'),
      s('T1213.006', '22 décembre : des variables d’environnement, jetons et clés de clients sont extraits de bases de données.'),
      s(null, '29 décembre : un client signale une activité OAuth GitHub suspecte.'),
      s(null, '4 janvier 2023 : CircleCI publie l’incident et demande aux clients de faire tourner leurs secrets.'),
    ],
    lesson: 'Voler le cookie (T1539) puis le rejouer (T1550.004) : deux techniques, deux tactiques. Une session validée par la 2FA vaut la 2FA ; seules des sessions courtes et liées à l’appareil réduisent la fenêtre.',
  },
  {
    id: 'midnight-blizzard', level: 2,
    name: 'Microsoft (Midnight Blizzard)', date: 'novembre 2023 – janvier 2024',
    source: 'Microsoft Security Blog, guide pour les équipes de réponse (25 janvier 2024).',
    steps: [
      s('T1110.003', 'Une pulvérisation de mots de passe compromet un compte d’un tenant de test hérité, sans MFA.'),
      s('T1078.004', 'Une ancienne application OAuth de test, dotée d’un accès élevé à l’environnement de production, est compromise.'),
      s('T1136.003', 'Un nouveau compte utilisateur est créé pour donner son consentement à des applications malveillantes.'),
      s('T1098.003', 'Une application obtient un rôle Exchange Online qui ouvre l’accès aux boîtes mail.'),
      s('T1114.002', 'Des boîtes de dirigeants et d’équipes sécurité et juridique sont lues à distance.'),
      s(null, '12 janvier 2024 : Microsoft détecte l’intrusion.'),
    ],
    lesson: 'Créer le compte (T1136.003) précède l’attribution du rôle (T1098.003). Microsoft précise qu’aucune vulnérabilité de ses produits n’est en cause : un tenant de test oublié et une identité applicative trop puissante ont suffi.',
  },
  {
    id: 'scattered-spider', level: 2,
    name: 'Scattered Spider', date: 'avis CISA, novembre 2023',
    source: 'CISA et FBI, avis AA23-320A (novembre 2023, mis à jour en 2025). Mode opératoire du groupe, pas la chronologie d’une victime donnée.',
    steps: [
      s('T1598.004', 'Des appels, en se présentant comme le support informatique, servent à obtenir des identifiants.'),
      s('T1556.006', 'Sur les comptes compromis, l’attaquant enregistre ses propres facteurs MFA.'),
      s('T1219', 'Des outils légitimes d’accès à distance sont installés pour garder la main.'),
      s('T1213.002', 'SharePoint est fouillé à la recherche de documentation et d’identifiants.'),
      s('T1567.002', 'Les données sont exfiltrées vers un service de stockage en ligne.'),
      s('T1486', 'Des serveurs VMware ESXi sont chiffrés, et une rançon est demandée.'),
    ],
    lesson: 'Le groupe n’exploite pas de faille : il se fait aider par le support puis s’installe avec des outils légitimes. L’attaque contre MGM (septembre 2023) lui est attribuée, mais son mode opératoire précis n’y est connu que par des revendications.',
  },
  {
    id: 'okta-support', level: 2,
    name: 'Système de support d’Okta', date: 'septembre – octobre 2023',
    source: 'Okta, « Root Cause and Remediation » (3 novembre 2023).',
    steps: [
      s('T1555.003', 'Les identifiants d’un compte de service du support, enregistrés dans le profil Google personnel d’un salarié, sont compromis.'),
      s('T1078.004', '28 septembre – 17 octobre : le compte de service ouvre le système de gestion des tickets du support.'),
      s('T1213', 'Des fichiers joints aux tickets de 134 clients sont consultés, dont des fichiers HAR contenant des jetons de session.'),
      s('T1550.004', 'Les jetons servent à détourner les sessions Okta légitimes de cinq clients.'),
      s(null, '29 septembre et 2 octobre : 1Password puis BeyondTrust signalent une activité suspecte à Okta.'),
      s(null, '17 octobre : Okta désactive le compte de service et met fin à ses sessions.'),
    ],
    lesson: 'Les signalements des clients arrivent pendant la collecte, pas après : l’ordre se lit aux dates. Un fichier HAR transmis au support emporte les jetons de session qu’il contient.',
  },

  // ── N3 · La matrice trompe, les dates tranchent ──────────────────────────
  {
    id: 'storm-0558', level: 3,
    name: 'Storm-0558 et Exchange Online', date: 'mai – juillet 2023',
    source: 'Cyber Safety Review Board, rapport du 20 mars 2024.',
    steps: [
      s(null, '2016 : Microsoft crée une clé de signature MSA grand public, censée être retirée en 2021 ; la rotation est arrêtée.'),
      s('T1606', 'Avec cette clé, obtenue par un moyen que Microsoft n’a pas établi, l’acteur forge des jetons d’authentification.'),
      s('T1550.001', 'Une faille de validation fait accepter ces jetons par Exchange Online d’entreprise, à partir du 15 mai 2023.'),
      s('T1114.002', 'Des boîtes mail de 22 organisations et de 503 comptes personnels sont lues.'),
      s(null, '15–16 juin : le Département d’État repère l’activité grâce à une règle maison sur le journal MailItemsAccessed et prévient Microsoft.'),
    ],
    lesson: 'La première étape n’est pas une action de l’attaquant : c’est une décision de cycle de vie prise des années plus tôt. La détection est venue d’un client qui payait le journal adéquat, pas de l’éditeur.',
  },
  {
    id: 'salesforce-vishing', level: 3,
    name: 'Instances Salesforce (UNC6040)', date: '2025',
    source: 'Google Threat Intelligence Group, « The Cost of a Call » (4 juin 2025, mis à jour en août 2025) ; campagne C0059 d’ATT&CK.',
    steps: [
      s('T1684.001', 'Au téléphone, l’attaquant se présente comme le support informatique d’un salarié.'),
      s('T1671', 'Le salarié est guidé pour autoriser, dans Salesforce, une application connectée déguisée en outil de chargement de données.'),
      s('T1213.004', 'L’application interroge le CRM, d’abord par petites requêtes, puis table entière.'),
      s('T1078', 'Des identifiants obtenus en parallèle servent à atteindre d’autres plates-formes cloud de la victime.'),
      s('T1657', 'Plusieurs mois plus tard, un acteur distinct réclame une rançon au nom d’un groupe connu.'),
    ],
    lesson: 'L’extorsion arrive longtemps après la collecte, et d’un autre acteur : la chronologie ne se déduit pas de la matrice. Interdire aux utilisateurs d’autoriser seuls une application connectée casse la chaîne à la deuxième étape.',
  },
  {
    id: 'salesloft-drift', level: 3,
    name: 'Intégration Salesloft Drift (UNC6395)', date: 'mars – août 2025',
    source: 'Google Threat Intelligence Group (26 août 2025, mis à jour le 28) et mise à jour de Salesloft sur l’enquête de Mandiant (septembre 2025).',
    steps: [
      s('T1213.003', 'Mars – juin 2025 : le compte GitHub de Salesloft est compromis ; des dépôts privés sont téléchargés.'),
      s('T1528', 'Depuis l’environnement AWS de Drift, des jetons OAuth de l’intégration appartenant aux clients sont volés.'),
      s('T1550.001', '8–18 août : les jetons ouvrent les instances Salesforce de nombreux clients de l’intégration.'),
      s('T1552', 'Les données exportées sont fouillées à la recherche de clés AWS, de mots de passe et de jetons d’autres services.'),
      s(null, '20 août : Salesloft et Salesforce révoquent tous les jetons de l’application Drift.'),
    ],
    lesson: 'La victime finale n’a rien fait de mal : la chaîne commence chez l’éditeur d’une intégration, des mois avant. Restreindre l’usage des jetons d’intégration à leurs adresses attendues limite le rejeu.',
  },
];

// Contrôle au chargement : une technique inconnue de `attack.ts` casse ici,
// pas à l'affichage de la correction.
for (const inc of chainIncidents) {
  inc.steps.forEach((st) => { if (st.technique) technique(st.technique); });
  if (inc.steps.length < 4) throw new Error(`Kill Chain · ${inc.id} : moins de quatre étapes`);
}

// ── Les séries ──────────────────────────────────────────────────────────────

const PROFILES: SeriesProfile<ChainIncident>[] = [
  { id: 'premieres-chaines', title: 'Premières chaînes', ids: ['capital-one', 'uber', 'snowflake'], level: 1,
    text: 'Trois incidents dont l’ordre suit celui des tactiques : accès, découverte, collecte, impact.' },
  { id: 'cas-de-la-lecon', title: 'Les cas de la leçon', ids: ['uber', 'scattered-spider', 'circleci', 'snowflake', 'midnight-blizzard', 'storm-0558'], level: 2,
    text: 'Uber, Scattered Spider, CircleCI, Snowflake, Midnight Blizzard et Storm-0558, chaîne par chaîne.' },
  { id: 'identite-saas', title: 'Par l’identité', ids: ['uber', 'scattered-spider', 'midnight-blizzard', 'okta-support'], level: 2,
    text: 'Fatigue MFA, support usurpé, tenant de test oublié, compte de service : aucune faille de code.' },
  { id: 'sessions-jetons', title: 'Sessions et jetons', ids: ['circleci', 'okta-support', 'storm-0558', 'salesloft-drift'], level: 3,
    text: 'Voler puis rejouer, forger puis faire accepter : des paires d’étapes faciles à inverser.' },
  { id: 'donnees-saas', title: 'Données SaaS', ids: ['snowflake', 'salesforce-vishing', 'salesloft-drift'], level: 3,
    text: 'Plates-formes de données et CRM : la collecte précède de loin l’extorsion, et la chaîne commence parfois chez un tiers.' },
  { id: 'melee', title: 'Mêlée', mix: [1, 2, 1], level: 2, shuffleEachTime: true,
    text: 'Tous niveaux confondus, recomposée à chaque partie.' },
];

export const chainSeries = defineSeries(chainIncidents, PROFILES);

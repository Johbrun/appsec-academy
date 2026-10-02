// Référentiel MITRE ATT&CK partagé par les jeux du module M2 (m22) et CTI Mapper.
//
// Version : **ATT&CK Enterprise v19** (avril 2026), contrôlée sur la publication
// 19.2 du 5 août 2026. Chaque identifiant de tactique, de technique, de
// sous-technique et de mitigation ci-dessous a été vérifié le 1er octobre 2026
// sur attack.mitre.org et dans ses données STIX officielles
// (github.com/mitre-attack/attack-stix-data). Les rattachements aux tactiques et
// les mitigations listées sont ceux d'ATT&CK, recopiés tels quels : un jeu qui
// déclare « la bonne mitigation » doit pouvoir montrer qu'ATT&CK la relie bien à
// la technique.
//
// Ce que la v19 a changé, et qui piège les supports plus anciens :
//
//   · Defense Evasion (TA0005) n'existe plus. L'identifiant TA0005 désigne
//     désormais **Stealth** (se fondre dans l'activité normale sans toucher aux
//     contrôles) ; une nouvelle tactique **Defense Impairment** (TA0112) réunit
//     ce qui casse ou aveugle les contrôles. La frontière : se cacher contre
//     éteindre la lumière.
//   · Impair Defenses (T1562) est révoquée. La coupure des journaux cloud est
//     devenue T1685.002 (Disable or Modify Cloud Log), sous Defense Impairment.
//   · Impersonation (T1656) est révoquée au profit de T1684.001, sous-technique
//     de Social Engineering (T1684), tactique Stealth.
//
// Les noms anglais sont ceux d'ATT&CK, sous-technique préfixée de sa technique
// parente ; les noms français sont une traduction maison, pas une nomenclature
// officielle. `platforms` ne retient que les plates-formes cloud et PRE qui
// intéressent ce parcours (ATT&CK en liste d'autres pour la plupart).
//
// Une technique peut servir plusieurs tactiques (T1078 en sert quatre) : les
// jeux qui demandent « quelle tactique ? » doivent en tenir compte.

export type TacticId =
  | 'TA0043' | 'TA0042' | 'TA0001' | 'TA0002' | 'TA0003' | 'TA0004' | 'TA0005' | 'TA0112'
  | 'TA0006' | 'TA0007' | 'TA0008' | 'TA0009' | 'TA0011' | 'TA0010' | 'TA0040';

export interface Tactic {
  id: TacticId;
  name: string;
  nameFr: string;
  /** Le « pourquoi » de l'adversaire, reformulé depuis la définition d'ATT&CK. */
  goal: string;
}

/** Les quinze tactiques Enterprise v19, dans l'ordre de la matrice. */
export const tactics: Tactic[] = [
  { id: 'TA0043', name: 'Reconnaissance', nameFr: 'Reconnaissance', goal: 'Réunir, avant d’agir, ce qui servira à préparer l’attaque : personnes, adresses, technologies, identifiants déjà fuités.' },
  { id: 'TA0042', name: 'Resource Development', nameFr: 'Développement de ressources', goal: 'Se doter de moyens : domaines, comptes, outils, ou un accès acheté à un courtier.' },
  { id: 'TA0001', name: 'Initial Access', nameFr: 'Accès initial', goal: 'Prendre pied dans l’environnement visé.' },
  { id: 'TA0002', name: 'Execution', nameFr: 'Exécution', goal: 'Faire tourner du code, une commande ou une automatisation qu’il contrôle.' },
  { id: 'TA0003', name: 'Persistence', nameFr: 'Persistance', goal: 'Garder l’accès malgré un redémarrage, un changement de mot de passe ou une session coupée.' },
  { id: 'TA0004', name: 'Privilege Escalation', nameFr: 'Élévation de privilèges', goal: 'Obtenir des droits plus élevés que ceux du premier accès.' },
  { id: 'TA0005', name: 'Stealth', nameFr: 'Furtivité', goal: 'Se fondre dans l’activité normale pour ne pas être remarqué, sans toucher aux contrôles.' },
  { id: 'TA0112', name: 'Defense Impairment', nameFr: 'Neutralisation des défenses', goal: 'Casser, couper ou fausser les contrôles et la journalisation pour que les défenseurs ne voient plus rien de fiable.' },
  { id: 'TA0006', name: 'Credential Access', nameFr: 'Accès aux identifiants', goal: 'Voler des mots de passe, des jetons, des cookies ou des clés.' },
  { id: 'TA0007', name: 'Discovery', nameFr: 'Découverte', goal: 'Comprendre l’environnement une fois dedans : comptes, groupes, services, ressources.' },
  { id: 'TA0008', name: 'Lateral Movement', nameFr: 'Mouvement latéral', goal: 'Passer d’un compte, d’un service ou d’un système à un autre.' },
  { id: 'TA0009', name: 'Collection', nameFr: 'Collecte', goal: 'Rassembler les données qui l’intéressent.' },
  { id: 'TA0011', name: 'Command and Control', nameFr: 'Commande et contrôle', goal: 'Piloter à distance ce qu’il a installé ou compromis.' },
  { id: 'TA0010', name: 'Exfiltration', nameFr: 'Exfiltration', goal: 'Sortir les données de l’environnement.' },
  { id: 'TA0040', name: 'Impact', nameFr: 'Impact', goal: 'Perturber, détruire, chiffrer ou monnayer.' },
];

export interface Technique {
  id: string;
  name: string;
  nameFr: string;
  /** Toutes les tactiques qu'ATT&CK lui rattache, dans l'ordre de la matrice. */
  tactics: TacticId[];
  platforms: string[];
  /** Les mitigations qu'ATT&CK relie à la technique (relations « mitigates »). */
  mitigations: string[];
}

const t = (id: string, name: string, nameFr: string, tacs: TacticId[], platforms: string[], mitigations: string[]): Technique =>
  ({ id, name, nameFr, tactics: tacs, platforms, mitigations });

export const techniques: Technique[] = [
  t('T1593', 'Search Open Websites/Domains', 'Recherche sur les sites et domaines publics', ['TA0043'], ['PRE'], ['M1013', 'M1047']),
  t('T1589.001', 'Gather Victim Identity Information: Credentials', 'Collecte d’identifiants de la victime', ['TA0043'], ['PRE'], ['M1056']),
  t('T1598.004', 'Phishing for Information: Spearphishing Voice', 'Hameçonnage vocal pour obtenir des informations', ['TA0043'], ['PRE'], ['M1017']),
  t('T1597.002', 'Search Closed Sources: Purchase Technical Data', 'Achat de données techniques', ['TA0043'], ['PRE'], ['M1056']),
  t('T1583.001', 'Acquire Infrastructure: Domains', 'Achat de noms de domaine', ['TA0042'], ['PRE'], ['M1056']),
  t('T1585', 'Establish Accounts', 'Création de comptes', ['TA0042'], ['PRE'], ['M1056']),
  t('T1586.003', 'Compromise Accounts: Cloud Accounts', 'Compromission de comptes cloud', ['TA0042'], ['PRE'], ['M1056']),
  t('T1650', 'Acquire Access', 'Achat d’un accès', ['TA0042'], ['PRE'], ['M1056']),
  t('T1190', 'Exploit Public-Facing Application', 'Exploitation d’une application exposée', ['TA0001'], ['Containers', 'IaaS'], ['M1016', 'M1026', 'M1030', 'M1035', 'M1037', 'M1048', 'M1050', 'M1051']),
  t('T1195.001', 'Supply Chain Compromise: Compromise Software Dependencies and Development Tools', 'Compromission des dépendances et outils de développement', ['TA0001'], [], ['M1013', 'M1016', 'M1033', 'M1051']),
  t('T1195.002', 'Supply Chain Compromise: Compromise Software Supply Chain', 'Compromission de la chaîne logicielle', ['TA0001'], [], ['M1016', 'M1051']),
  t('T1199', 'Trusted Relationship', 'Relation de confiance', ['TA0001'], ['IaaS', 'Identity Provider', 'Office Suite', 'SaaS'], ['M1018', 'M1030', 'M1032']),
  t('T1566.002', 'Phishing: Spearphishing Link', 'Hameçonnage par lien ciblé', ['TA0001'], ['Identity Provider', 'Office Suite', 'SaaS'], ['M1017', 'M1018', 'M1021', 'M1047', 'M1054']),
  t('T1566.004', 'Phishing: Spearphishing Voice', 'Hameçonnage vocal ciblé', ['TA0001'], ['Identity Provider'], ['M1017']),
  t('T1078', 'Valid Accounts', 'Comptes valides', ['TA0001', 'TA0003', 'TA0004', 'TA0005'], ['Containers', 'IaaS', 'Identity Provider', 'Office Suite', 'SaaS'], ['M1013', 'M1015', 'M1017', 'M1018', 'M1026', 'M1027', 'M1032', 'M1036']),
  t('T1078.004', 'Valid Accounts: Cloud Accounts', 'Comptes cloud valides', ['TA0001', 'TA0003', 'TA0004', 'TA0005'], ['IaaS', 'Identity Provider', 'Office Suite', 'SaaS'], ['M1015', 'M1017', 'M1018', 'M1026', 'M1027', 'M1032', 'M1036']),
  t('T1189', 'Drive-by Compromise', 'Compromission par navigation', ['TA0001'], ['Identity Provider'], ['M1017', 'M1021', 'M1048', 'M1050', 'M1051']),
  t('T1059.009', 'Command and Scripting Interpreter: Cloud API', 'API cloud', ['TA0002'], ['IaaS', 'Identity Provider', 'Office Suite', 'SaaS'], ['M1026', 'M1038']),
  t('T1648', 'Serverless Execution', 'Exécution serverless', ['TA0002'], ['SaaS', 'IaaS', 'Office Suite'], ['M1018', 'M1036']),
  t('T1651', 'Cloud Administration Command', 'Commande d’administration cloud', ['TA0002'], ['IaaS'], ['M1026']),
  t('T1677', 'Poisoned Pipeline Execution', 'Exécution de pipeline empoisonnée', ['TA0002'], ['SaaS'], ['M1018', 'M1054']),
  t('T1136.003', 'Create Account: Cloud Account', 'Création d’un compte cloud', ['TA0003'], ['IaaS', 'SaaS', 'Office Suite', 'Identity Provider'], ['M1026', 'M1030', 'M1032']),
  t('T1671', 'Cloud Application Integration', 'Intégration d’application cloud', ['TA0003'], ['Office Suite', 'SaaS'], ['M1042', 'M1047']),
  t('T1098.001', 'Account Manipulation: Additional Cloud Credentials', 'Identifiants cloud supplémentaires', ['TA0003', 'TA0004'], ['IaaS', 'Identity Provider', 'SaaS'], ['M1018', 'M1026', 'M1030', 'M1032', 'M1042']),
  t('T1098.002', 'Account Manipulation: Additional Email Delegate Permissions', 'Délégation de boîte mail supplémentaire', ['TA0003', 'TA0004'], ['Office Suite'], ['M1026', 'M1032', 'M1042']),
  t('T1098.003', 'Account Manipulation: Additional Cloud Roles', 'Rôles cloud supplémentaires', ['TA0003', 'TA0004'], ['IaaS', 'Identity Provider', 'Office Suite', 'SaaS'], ['M1018', 'M1026', 'M1032']),
  t('T1098.005', 'Account Manipulation: Device Registration', 'Enregistrement d’un appareil', ['TA0003', 'TA0004'], ['Identity Provider'], ['M1032']),
  t('T1137.005', 'Office Application Startup: Outlook Rules', 'Règles Outlook', ['TA0003'], ['Office Suite'], ['M1040', 'M1051']),
  t('T1525', 'Implant Internal Image', 'Image interne piégée', ['TA0003'], ['IaaS', 'Containers'], ['M1026', 'M1045', 'M1047']),
  t('T1556.006', 'Modify Authentication Process: Multi-Factor Authentication', 'Modification de la MFA', ['TA0003', 'TA0112', 'TA0006'], ['IaaS', 'Identity Provider', 'Office Suite', 'SaaS'], ['M1018', 'M1032', 'M1047']),
  t('T1548.005', 'Abuse Elevation Control Mechanism: Temporary Elevated Cloud Access', 'Élévation temporaire d’accès cloud', ['TA0004'], ['IaaS', 'Office Suite', 'Identity Provider'], ['M1018']),
  t('T1484.002', 'Domain or Tenant Policy Modification: Trust Modification', 'Modification de la fédération', ['TA0004', 'TA0112'], ['Identity Provider'], ['M1018', 'M1026']),
  t('T1564.008', 'Hide Artifacts: Email Hiding Rules', 'Règles de masquage d’e-mails', ['TA0005'], ['Office Suite'], ['M1047']),
  t('T1684.001', 'Social Engineering: Impersonation', 'Usurpation d’identité', ['TA0005'], ['Office Suite', 'SaaS'], ['M1017', 'M1019']),
  t('T1070.008', 'Indicator Removal: Clear Mailbox Data', 'Effacement de données de boîte mail', ['TA0005'], ['Office Suite'], ['M1022', 'M1029', 'M1047']),
  t('T1036.010', 'Masquerading: Masquerade Account Name', 'Nom de compte trompeur', ['TA0005'], ['Containers', 'IaaS', 'Identity Provider', 'Office Suite', 'SaaS'], ['M1018', 'M1047']),
  t('T1070', 'Indicator Removal', 'Suppression d’indicateurs', ['TA0005'], ['Containers', 'Office Suite'], ['M1022', 'M1029', 'M1041']),
  t('T1535', 'Unused/Unsupported Cloud Regions', 'Régions cloud inutilisées', ['TA0005'], ['IaaS'], ['M1054']),
  t('T1685.002', 'Disable or Modify Tools: Disable or Modify Cloud Log', 'Désactivation ou modification des journaux cloud', ['TA0112'], ['IaaS', 'SaaS', 'Identity Provider', 'Office Suite'], ['M1018']),
  t('T1556.009', 'Modify Authentication Process: Conditional Access Policies', 'Modification des politiques d’accès conditionnel', ['TA0003', 'TA0112', 'TA0006'], ['IaaS', 'Identity Provider'], ['M1018']),
  t('T1578.002', 'Modify Cloud Compute Infrastructure: Create Cloud Instance', 'Création d’une instance cloud', ['TA0112'], ['IaaS'], ['M1018', 'M1047']),
  t('T1666', 'Modify Cloud Resource Hierarchy', 'Modification de la hiérarchie des ressources cloud', ['TA0112'], ['IaaS'], ['M1018', 'M1047', 'M1054']),
  t('T1110.001', 'Brute Force: Password Guessing', 'Devinette de mot de passe', ['TA0006'], ['Containers', 'IaaS', 'Identity Provider', 'Office Suite', 'SaaS'], ['M1027', 'M1032', 'M1036', 'M1051']),
  t('T1110.003', 'Brute Force: Password Spraying', 'Pulvérisation de mots de passe', ['TA0006'], ['Containers', 'IaaS', 'Identity Provider', 'Office Suite', 'SaaS'], ['M1027', 'M1032', 'M1036']),
  t('T1110.004', 'Brute Force: Credential Stuffing', 'Rejeu d’identifiants volés', ['TA0006'], ['Containers', 'IaaS', 'Identity Provider', 'Office Suite', 'SaaS'], ['M1018', 'M1027', 'M1032', 'M1036']),
  t('T1621', 'Multi-Factor Authentication Request Generation', 'Bombardement de demandes MFA', ['TA0006'], ['IaaS', 'SaaS', 'Office Suite', 'Identity Provider'], ['M1017', 'M1032', 'M1036']),
  t('T1111', 'Multi-Factor Authentication Interception', 'Interception de la MFA', ['TA0006'], [], ['M1017']),
  t('T1528', 'Steal Application Access Token', 'Vol de jeton d’application', ['TA0006'], ['Containers', 'IaaS', 'Identity Provider', 'Office Suite', 'SaaS'], ['M1017', 'M1018', 'M1021', 'M1047']),
  t('T1539', 'Steal Web Session Cookie', 'Vol de cookie de session', ['TA0006'], ['Office Suite', 'SaaS'], ['M1017', 'M1021', 'M1032', 'M1047', 'M1051', 'M1054']),
  t('T1606', 'Forge Web Credentials', 'Falsification d’identifiants web', ['TA0006'], ['SaaS', 'IaaS', 'Office Suite', 'Identity Provider'], ['M1018', 'M1026', 'M1047', 'M1054']),
  t('T1606.001', 'Forge Web Credentials: Web Cookies', 'Falsification de cookies', ['TA0006'], ['SaaS', 'IaaS'], ['M1047', 'M1054']),
  t('T1606.002', 'Forge Web Credentials: SAML Tokens', 'Falsification de jetons SAML', ['TA0006'], ['SaaS', 'IaaS', 'Office Suite', 'Identity Provider'], ['M1015', 'M1018', 'M1026', 'M1047']),
  t('T1552', 'Unsecured Credentials', 'Identifiants non protégés', ['TA0006'], ['SaaS', 'IaaS', 'Containers', 'Office Suite', 'Identity Provider'], ['M1015', 'M1017', 'M1022', 'M1026', 'M1027', 'M1028', 'M1035', 'M1037', 'M1041', 'M1047', 'M1051']),
  t('T1552.001', 'Unsecured Credentials: Credentials In Files', 'Identifiants dans des fichiers', ['TA0006'], ['Containers', 'IaaS'], ['M1017', 'M1022', 'M1027', 'M1047']),
  t('T1552.005', 'Unsecured Credentials: Cloud Instance Metadata API', 'API de métadonnées d’instance', ['TA0006'], ['IaaS'], ['M1035', 'M1037', 'M1042']),
  t('T1552.008', 'Unsecured Credentials: Chat Messages', 'Identifiants dans les messageries', ['TA0006'], ['SaaS', 'Office Suite'], ['M1017', 'M1047']),
  t('T1555.006', 'Credentials from Password Stores: Cloud Secrets Management Stores', 'Coffres de secrets cloud', ['TA0006'], ['IaaS'], ['M1026']),
  t('T1555.003', 'Credentials from Password Stores: Credentials from Web Browsers', 'Identifiants enregistrés dans les navigateurs', ['TA0006'], [], ['M1017', 'M1018', 'M1021', 'M1027', 'M1051']),
  t('T1087.004', 'Account Discovery: Cloud Account', 'Découverte de comptes cloud', ['TA0007'], ['IaaS', 'Identity Provider', 'Office Suite', 'SaaS'], ['M1018', 'M1047']),
  t('T1069.003', 'Permission Groups Discovery: Cloud Groups', 'Découverte des groupes cloud', ['TA0007'], ['SaaS', 'IaaS', 'Office Suite', 'Identity Provider'], []),
  t('T1526', 'Cloud Service Discovery', 'Découverte des services cloud', ['TA0007'], ['IaaS', 'Identity Provider', 'Office Suite', 'SaaS'], []),
  t('T1538', 'Cloud Service Dashboard', 'Console du service cloud', ['TA0007'], ['IaaS', 'SaaS', 'Office Suite', 'Identity Provider'], ['M1018']),
  t('T1201', 'Password Policy Discovery', 'Découverte de la politique de mots de passe', ['TA0007'], ['IaaS', 'Identity Provider', 'SaaS', 'Office Suite'], ['M1027']),
  t('T1580', 'Cloud Infrastructure Discovery', 'Découverte de l’infrastructure cloud', ['TA0007'], ['IaaS'], ['M1018']),
  t('T1550.001', 'Use Alternate Authentication Material: Application Access Token', 'Jeton d’accès applicatif', ['TA0008'], ['Containers', 'IaaS', 'Identity Provider', 'Office Suite', 'SaaS'], ['M1013', 'M1021', 'M1036', 'M1041', 'M1047']),
  t('T1550.004', 'Use Alternate Authentication Material: Web Session Cookie', 'Cookie de session web', ['TA0008'], ['IaaS', 'Office Suite', 'SaaS'], ['M1054']),
  t('T1534', 'Internal Spearphishing', 'Hameçonnage interne', ['TA0008'], ['Office Suite', 'SaaS'], []),
  t('T1080', 'Taint Shared Content', 'Contamination de contenu partagé', ['TA0008'], ['SaaS', 'Office Suite'], ['M1022', 'M1038', 'M1049', 'M1050']),
  t('T1021.007', 'Remote Services: Cloud Services', 'Services cloud', ['TA0008'], ['IaaS', 'Identity Provider', 'Office Suite', 'SaaS'], ['M1026', 'M1032']),
  t('T1114.002', 'Email Collection: Remote Email Collection', 'Collecte d’e-mails à distance', ['TA0009'], ['Office Suite'], ['M1032', 'M1041', 'M1060']),
  t('T1114.003', 'Email Collection: Email Forwarding Rule', 'Règle de transfert d’e-mails', ['TA0009'], ['Office Suite'], ['M1041', 'M1042', 'M1047', 'M1060']),
  t('T1213.002', 'Data from Information Repositories: Sharepoint', 'SharePoint', ['TA0009'], ['Office Suite'], ['M1017', 'M1018', 'M1047']),
  t('T1213.003', 'Data from Information Repositories: Code Repositories', 'Dépôts de code', ['TA0009'], ['SaaS'], ['M1017', 'M1018', 'M1032', 'M1047']),
  t('T1213.004', 'Data from Information Repositories: Customer Relationship Management Software', 'Logiciel de CRM', ['TA0009'], ['SaaS'], ['M1017', 'M1018', 'M1047', 'M1054']),
  t('T1213.005', 'Data from Information Repositories: Messaging Applications', 'Applications de messagerie', ['TA0009'], ['Office Suite', 'SaaS'], ['M1017', 'M1047', 'M1060']),
  t('T1213.006', 'Data from Information Repositories: Databases', 'Bases de données', ['TA0009'], ['IaaS', 'SaaS'], ['M1017', 'M1018', 'M1041', 'M1047', 'M1054']),
  t('T1213', 'Data from Information Repositories', 'Données des référentiels d’information', ['TA0009'], ['SaaS', 'IaaS', 'Office Suite'], ['M1017', 'M1018', 'M1032', 'M1041', 'M1047', 'M1054', 'M1060']),
  t('T1530', 'Data from Cloud Storage', 'Données du stockage cloud', ['TA0009'], ['IaaS', 'Office Suite', 'SaaS'], ['M1018', 'M1022', 'M1032', 'M1037', 'M1041', 'M1047']),
  t('T1119', 'Automated Collection', 'Collecte automatisée', ['TA0009'], ['IaaS', 'Office Suite', 'SaaS'], ['M1029', 'M1041']),
  t('T1074', 'Data Staged', 'Données préparées avant sortie', ['TA0009'], ['IaaS'], []),
  t('T1219', 'Remote Access Tools', 'Outils d’accès à distance', ['TA0011'], [], ['M1031', 'M1034', 'M1037', 'M1038', 'M1042']),
  t('T1090.003', 'Proxy: Multi-hop Proxy', 'Proxy multi-sauts', ['TA0011'], [], ['M1037']),
  t('T1567.002', 'Exfiltration Over Web Service: Exfiltration to Cloud Storage', 'Exfiltration vers un stockage cloud', ['TA0010'], [], ['M1021']),
  t('T1567.004', 'Exfiltration Over Web Service: Exfiltration Over Webhook', 'Exfiltration par webhook', ['TA0010'], ['Office Suite', 'SaaS'], ['M1057']),
  t('T1567', 'Exfiltration Over Web Service', 'Exfiltration par un service web', ['TA0010'], ['Office Suite', 'SaaS'], ['M1021', 'M1057']),
  t('T1537', 'Transfer Data to Cloud Account', 'Transfert vers un compte cloud', ['TA0010'], ['IaaS', 'Office Suite', 'SaaS'], ['M1018', 'M1037', 'M1054', 'M1057']),
  t('T1048', 'Exfiltration Over Alternative Protocol', 'Exfiltration par un protocole alternatif', ['TA0010'], ['IaaS', 'Office Suite', 'SaaS'], ['M1018', 'M1022', 'M1030', 'M1031', 'M1037', 'M1057']),
  t('T1020', 'Automated Exfiltration', 'Exfiltration automatisée', ['TA0010'], [], []),
  t('T1657', 'Financial Theft', 'Vol financier', ['TA0040'], ['Office Suite', 'SaaS'], ['M1017', 'M1018']),
  t('T1531', 'Account Access Removal', 'Suppression de l’accès aux comptes', ['TA0040'], ['SaaS', 'IaaS', 'Office Suite'], []),
  t('T1486', 'Data Encrypted for Impact', 'Chiffrement de données pour impact', ['TA0040'], ['IaaS'], ['M1040', 'M1053']),
  t('T1485', 'Data Destruction', 'Destruction de données', ['TA0040'], ['Containers', 'IaaS'], ['M1018', 'M1032', 'M1053']),
  t('T1490', 'Inhibit System Recovery', 'Entrave à la restauration', ['TA0040'], ['Containers', 'IaaS'], ['M1018', 'M1028', 'M1038', 'M1053']),
  t('T1496.003', 'Resource Hijacking: SMS Pumping', 'SMS pumping', ['TA0040'], ['SaaS'], ['M1013']),
  t('T1496.004', 'Resource Hijacking: Cloud Service Hijacking', 'Détournement de service cloud', ['TA0040'], ['SaaS'], []),
  t('T1667', 'Email Bombing', 'Bombardement d’e-mails', ['TA0040'], ['Office Suite'], ['M1017', 'M1054']),
  t('T1491.001', 'Defacement: Internal Defacement', 'Défiguration interne', ['TA0040'], [], ['M1053']),
];

export interface Mitigation {
  id: string;
  name: string;
  nameFr: string;
}

/** Les mitigations ATT&CK citées par les techniques ci-dessus. */
export const mitigations: Mitigation[] = [
  { id: 'M1013', name: 'Application Developer Guidance', nameFr: 'Consignes aux développeurs' },
  { id: 'M1015', name: 'Active Directory Configuration', nameFr: 'Configuration d’Active Directory' },
  { id: 'M1016', name: 'Vulnerability Scanning', nameFr: 'Recherche de vulnérabilités' },
  { id: 'M1017', name: 'User Training', nameFr: 'Sensibilisation des utilisateurs' },
  { id: 'M1018', name: 'User Account Management', nameFr: 'Gestion des comptes utilisateurs' },
  { id: 'M1019', name: 'Threat Intelligence Program', nameFr: 'Programme de renseignement sur la menace' },
  { id: 'M1021', name: 'Restrict Web-Based Content', nameFr: 'Restriction du contenu web' },
  { id: 'M1022', name: 'Restrict File and Directory Permissions', nameFr: 'Restriction des droits sur fichiers et dossiers' },
  { id: 'M1026', name: 'Privileged Account Management', nameFr: 'Gestion des comptes à privilèges' },
  { id: 'M1027', name: 'Password Policies', nameFr: 'Politiques de mots de passe' },
  { id: 'M1028', name: 'Operating System Configuration', nameFr: 'Configuration du système' },
  { id: 'M1029', name: 'Remote Data Storage', nameFr: 'Stockage distant des données' },
  { id: 'M1030', name: 'Network Segmentation', nameFr: 'Segmentation réseau' },
  { id: 'M1031', name: 'Network Intrusion Prevention', nameFr: 'Prévention d’intrusion réseau' },
  { id: 'M1032', name: 'Multi-factor Authentication', nameFr: 'Authentification multifacteur' },
  { id: 'M1033', name: 'Limit Software Installation', nameFr: 'Limitation des installations logicielles' },
  { id: 'M1034', name: 'Limit Hardware Installation', nameFr: 'Limitation des installations matérielles' },
  { id: 'M1035', name: 'Limit Access to Resource Over Network', nameFr: 'Limitation de l’accès réseau aux ressources' },
  { id: 'M1036', name: 'Account Use Policies', nameFr: 'Politiques d’usage des comptes' },
  { id: 'M1037', name: 'Filter Network Traffic', nameFr: 'Filtrage du trafic réseau' },
  { id: 'M1038', name: 'Execution Prevention', nameFr: 'Prévention de l’exécution' },
  { id: 'M1040', name: 'Behavior Prevention on Endpoint', nameFr: 'Blocage comportemental sur le poste' },
  { id: 'M1041', name: 'Encrypt Sensitive Information', nameFr: 'Chiffrement des informations sensibles' },
  { id: 'M1042', name: 'Disable or Remove Feature or Program', nameFr: 'Désactivation ou retrait d’une fonction' },
  { id: 'M1045', name: 'Code Signing', nameFr: 'Signature de code' },
  { id: 'M1047', name: 'Audit', nameFr: 'Audit' },
  { id: 'M1048', name: 'Application Isolation and Sandboxing', nameFr: 'Isolation et bac à sable applicatifs' },
  { id: 'M1049', name: 'Antivirus/Antimalware', nameFr: 'Antivirus et antimaliciel' },
  { id: 'M1050', name: 'Exploit Protection', nameFr: 'Protection contre l’exploitation' },
  { id: 'M1051', name: 'Update Software', nameFr: 'Mise à jour logicielle' },
  { id: 'M1053', name: 'Data Backup', nameFr: 'Sauvegarde des données' },
  { id: 'M1054', name: 'Software Configuration', nameFr: 'Configuration logicielle' },
  { id: 'M1056', name: 'Pre-compromise', nameFr: 'Avant la compromission' },
  { id: 'M1057', name: 'Data Loss Prevention', nameFr: 'Prévention des fuites de données' },
  { id: 'M1060', name: 'Out-of-Band Communications Channel', nameFr: 'Canal de communication hors bande' },
];

const techniqueIndex = new Map(techniques.map((x) => [x.id, x]));
const tacticIndex = new Map(tactics.map((x) => [x.id, x]));
const mitigationIndex = new Map(mitigations.map((x) => [x.id, x]));

/**
 * Lèvent une erreur sur un identifiant inconnu : une faute de frappe dans un
 * fichier de jeu doit casser au chargement, pas afficher « undefined ».
 */
export const technique = (id: string): Technique => {
  const x = techniqueIndex.get(id);
  if (!x) throw new Error(`ATT&CK : technique inconnue « ${id} »`);
  return x;
};
export const tactic = (id: TacticId): Tactic => tacticIndex.get(id)!;
export const mitigation = (id: string): Mitigation => {
  const x = mitigationIndex.get(id);
  if (!x) throw new Error(`ATT&CK : mitigation inconnue « ${id} »`);
  return x;
};

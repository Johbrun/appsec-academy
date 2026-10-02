// Rapports du jeu « CTI Mapper » (M2 et M27) : lire un extrait de rapport et
// cocher toutes les techniques ATT&CK v19 qu'il décrit.
//
// Les rapports sont **fictifs**, mais chaque phrase décrit un comportement tiré
// de cas documentés (cités en tête du fichier de la leçon M2 · 5) et traduit en
// technique v19 vérifiée dans `attack.ts`. Un rapport ne nomme jamais la
// technique : le geste consiste à la reconnaître derrière la prose, comme pour
// un vrai rapport de renseignement.
//
// `correct` liste les techniques présentes ; `decoys` des techniques voisines
// que le rapport **ne** décrit pas, mais qu'une lecture rapide pourrait cocher.
// Le score d'un rapport est « bonnes cases − fausses cases », plancher à zéro :
// cocher au hasard ne paie pas. Toutes les puces (correct + leurres) sont lues
// dans `attack.ts`, donc un identifiant faux casse le chargement.
//
// ── Ce que mesure le niveau ──────────────────────────────────────────────────
//
//   N1 · Trois ou quatre techniques, chacune décrite par une phrase nette ; les
//        leurres visent une autre étape évidente. On apprend à relier une phrase
//        à une technique.
//
//   N2 · Quatre à cinq techniques, du bruit légitime dans le texte, et des
//        leurres de la même famille (voler contre rejouer, collecter contre
//        exfiltrer). Il faut lire précisément.
//
//   N3 · Techniques proches à départager (deux sous-techniques d'une même
//        parente), ordre v19 contre-intuitif, et des leurres très défendables.

import { defineSeries, type Leveled, type SeriesProfile } from '../lib/series';
import { technique } from './attack';

export interface CtiReport extends Leveled {
  title: string;
  report: string;
  /** Techniques présentes dans le rapport. */
  correct: string[];
  /** Techniques voisines, absentes du rapport. */
  decoys: string[];
}

export const ctiReports: CtiReport[] = [
  // ── N1 · Une phrase, une technique ────────────────────────────────────────
  {
    id: 'cabinet-conseil', level: 1,
    title: 'Note de triage — cabinet de conseil',
    report: "Le compte d’une consultante est ouvert avec un mot de passe retrouvé dans une fuite ancienne. Une fois connecté, l’acteur crée une règle de boîte qui déplace vers un dossier obscur tout message contenant « sécurité », puis ajoute une règle de transfert automatique de chaque message entrant vers une adresse externe.",
    correct: ['T1078.004', 'T1564.008', 'T1114.003'],
    decoys: ['T1110.004', 'T1485', 'T1606'],
  },
  {
    id: 'editeur-saas', level: 1,
    title: 'Note de triage — éditeur SaaS',
    report: "Un infostealer sur le poste d’un développeur dérobe les cookies de son navigateur. Les sessions sont rejouées depuis un serveur distant. L’acteur parcourt ensuite le dépôt de code interne et y lit les secrets qui y traînent.",
    correct: ['T1539', 'T1550.004', 'T1213.003'],
    decoys: ['T1621', 'T1136.003', 'T1486'],
  },
  {
    id: 'distributeur', level: 1,
    title: 'Note de triage — distributeur',
    report: "Après avoir lu la politique de mots de passe du tenant, l’acteur essaie un mot de passe courant sur l’ensemble des comptes. Avec un compte d’administration ainsi obtenu, il crée un nouveau compte cloud discret, puis bloque l’accès des administrateurs légitimes.",
    correct: ['T1201', 'T1110.003', 'T1136.003', 'T1531'],
    decoys: ['T1110.004', 'T1534', 'T1528'],
  },
  {
    id: 'ssrf-cloud', level: 1,
    title: 'Note de triage — application exposée',
    report: "Une fonctionnalité d’import d’image sur une application exposée est détournée pour interroger le service de métadonnées de l’instance, qui renvoie les identifiants du rôle. Avec eux, l’acteur liste les buckets du compte, puis en copie le contenu hors de l’environnement.",
    correct: ['T1190', 'T1552.005', 'T1580', 'T1530'],
    decoys: ['T1537', 'T1486', 'T1110.001'],
  },

  // ── N2 · Du bruit, des leurres de même famille ────────────────────────────
  {
    id: 'cabinet-mfa', level: 2,
    title: 'Rapport d’incident — services financiers',
    report: "Le mot de passe d’un prestataire est connu de l’acteur. Celui-ci déclenche des dizaines de notifications d’approbation jusqu’à ce que l’une soit acceptée, un matin tôt. Il atteint ensuite d’autres comptes et obtient des droits élevés sur les outils collaboratifs. Une sauvegarde nocturne de routine apparaît dans les journaux, sans lien avec l’incident.",
    correct: ['T1621', 'T1078'],
    decoys: ['T1110.003', 'T1111', 'T1486'],
  },
  {
    id: 'crm-vishing', level: 2,
    title: 'Rapport d’incident — CRM commercial',
    report: "Un appel, en se faisant passer pour le support informatique, amène un salarié à autoriser dans le CRM une application connectée déguisée en outil de chargement de données. L’application interroge d’abord le CRM par petites requêtes de test, puis exporte des tables entières. Des identifiants récupérés au passage servent à atteindre une autre plate-forme cloud de l’entreprise.",
    correct: ['T1684.001', 'T1671', 'T1213.004', 'T1078'],
    decoys: ['T1566.002', 'T1114.003', 'T1486'],
  },
  {
    id: 'exchange-oauth', level: 2,
    title: 'Rapport d’incident — messagerie d’entreprise',
    report: "Une pulvérisation de mots de passe compromet un compte d’un tenant de test sans MFA. L’acteur s’appuie sur une ancienne application OAuth aux droits élevés, crée un compte pour consentir à de nouvelles applications, puis obtient un rôle qui ouvre les boîtes mail. Il lit à distance le courrier de dirigeants.",
    correct: ['T1110.003', 'T1078.004', 'T1136.003', 'T1098.003', 'T1114.002'],
    decoys: ['T1114.003', 'T1621', 'T1486'],
  },
  {
    id: 'helpdesk-reset', level: 2,
    title: 'Rapport d’incident — groupe hôtelier',
    report: "Un appelant qui connaît le matricule et le manager d’un salarié obtient du support la réinitialisation de ses facteurs. Il enregistre alors ses propres facteurs MFA sur le compte, installe un outil commercial d’accès à distance pour garder la main, et fouille les espaces SharePoint à la recherche d’identifiants.",
    correct: ['T1684.001', 'T1556.006', 'T1219', 'T1213.002'],
    decoys: ['T1621', 'T1098.005', 'T1534'],
  },

  // ── N3 · Sous-techniques à départager, leurres très proches ───────────────
  {
    id: 'session-vs-token', level: 3,
    title: 'Rapport de chasse — plate-forme CI/CD',
    report: "Un maliciel vole, sur le portable d’un ingénieur, une session déjà validée par la double authentification ; elle est rejouée depuis un autre lieu. Plus tard, séparément, des jetons OAuth d’une intégration tierce sont réutilisés pour ouvrir les instances de ses clients. Les deux réutilisations relèvent du mouvement latéral, mais pas de la même sous-technique.",
    correct: ['T1539', 'T1550.004', 'T1528', 'T1550.001'],
    decoys: ['T1078', 'T1606.002', 'T1621'],
  },
  {
    id: 'logs-vs-stealth', level: 3,
    title: 'Rapport de chasse — compte AWS de production',
    report: "L’acteur fait tourner des instances de calcul dans une région que l’entreprise n’utilise jamais, pour passer inaperçu. Puis il arrête puis supprime le journal d’audit du compte. La première action se fond dans l’environnement sans toucher aux contrôles ; la seconde casse un contrôle. En v19, ces deux gestes relèvent de deux tactiques distinctes.",
    correct: ['T1535', 'T1685.002'],
    decoys: ['T1578.002', 'T1070.008', 'T1666'],
  },
  {
    id: 'forge-vs-replay', level: 3,
    title: 'Rapport de chasse — fédération d’identité',
    report: "Avec un certificat de signature volé sur le serveur de fédération, l’acteur fabrique des jetons SAML pour n’importe quel utilisateur, puis les présente comme matériel d’authentification pour accéder aux services. En parallèle, un administrateur compromis ajoute un fournisseur d’identité externe au tenant, avec liaison automatique des comptes.",
    correct: ['T1606.002', 'T1550.001', 'T1484.002'],
    decoys: ['T1556.006', 'T1078.004', 'T1606.001'],
  },
  {
    id: 'supply-chain-saas', level: 3,
    title: 'Rapport de chasse — chaîne d’intégration',
    report: "Le dépôt de code d’un éditeur d’intégration est compromis et ses dépôts privés téléchargés. Depuis son environnement cloud, les jetons OAuth de l’intégration appartenant à ses clients sont volés, puis utilisés pour ouvrir leurs instances CRM. Les exports sont fouillés à la recherche de clés d’accès cloud et de jetons d’autres services.",
    correct: ['T1213.003', 'T1528', 'T1550.001', 'T1552'],
    decoys: ['T1195.002', 'T1213.004', 'T1606.002'],
  },
];

// Contrôle au chargement : chaque identifiant (présent ou leurre) doit exister
// en v19, et aucun leurre ne doit figurer parmi les techniques présentes.
for (const rep of ctiReports) {
  [...rep.correct, ...rep.decoys].forEach((id) => technique(id));
  const clash = rep.decoys.filter((d) => rep.correct.includes(d));
  if (clash.length) throw new Error(`CTI Mapper · ${rep.id} : leurre présent dans le rapport ${clash.join(', ')}`);
  if (rep.correct.length < 2) throw new Error(`CTI Mapper · ${rep.id} : moins de deux techniques à cocher`);
}

// ── Les séries ────────────────────────────────────────────────────────────────

const mix = (n1: number, n2: number, n3: number): [number, number, number] => [n1, n2, n3];

const PROFILES: SeriesProfile<CtiReport>[] = [
  { id: 'premiers-rapports', title: 'Premiers rapports', mix: mix(4, 0, 0), level: 1,
    text: 'Chaque phrase décrit une technique nette ; les leurres visent une autre étape. On apprend à lire un rapport.' },
  { id: 'entre-les-lignes', title: 'Entre les lignes', mix: mix(1, 4, 0), level: 2,
    text: 'Du bruit légitime dans le texte et des leurres de la même famille : collecter contre exfiltrer, voler contre rejouer.' },
  { id: 'identite-saas', title: 'Menace sur l’identité', ids: ['cabinet-conseil', 'cabinet-mfa', 'crm-vishing', 'exchange-oauth', 'helpdesk-reset'], level: 2,
    text: 'Fatigue MFA, consentement OAuth, support usurpé, applications déléguées : la menace SaaS passe par l’identité.' },
  { id: 'sous-techniques', title: 'Départager les sous-techniques', ids: ['session-vs-token', 'logs-vs-stealth', 'forge-vs-replay', 'supply-chain-saas'], level: 3,
    text: 'Deux sous-techniques d’une même parente, la scission Stealth / Defense Impairment de la v19 : il faut trancher.' },
  { id: 'rapports-experts', title: 'Rapports de chasse', mix: mix(0, 1, 4), level: 3,
    text: 'Techniques proches, leurres très défendables : surtout du niveau 3, pour s’entraîner sur de vrais rapports.' },
  { id: 'melee', title: 'Mêlée', mix: mix(2, 2, 2), level: 2, shuffleEachTime: true,
    text: 'Tous niveaux confondus, recomposée à chaque partie.' },
];

export const ctiSeries = defineSeries(ctiReports, PROFILES);

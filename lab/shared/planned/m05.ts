// m05 · Gestion des vulnérabilités — challenges spécifiés.
//
// Le domaine se prête bien mieux au lab qu'il n'y paraît, parce que les données
// de référence sont publiques et embarquables : catalogue KEV, scores EPSS,
// tables de décision SSVC, schémas OpenVEX et CycloneDX. La correction devient
// un recalcul ou un lookup, jamais une appréciation.
//
// Faits vérifiés en exécution, à ne pas re-supposer au moment d'implémenter :
//   · CVSS 4.0 → `ae-cvss-calculator` (sans dépendance). `@pandatix/js-cvss`
//     est cassé sur Node 22 (imports sans extension dans son dist).
//   · SSVC → tables publiées en JSON plat, 72 lignes pour l'arbre « Deployer ».
//     Le format vectoriel `SSVCv2/...` n'est PAS normatif : ne pas l'utiliser.
//   · CycloneDX → schéma en draft-07, avec spdx et jsf à enregistrer en plus.
//   · Atteignabilité → aucun outil hors ligne ne couvre JavaScript. L'analyse
//     par AST est la solution, pas un pis-aller.
//   · KEV → `knownRansomwareCampaignUse` vaut Known ou Unknown, jamais No, et
//     le catalogue porte désormais aussi `cwes[]`. Son JSON Schema annoncé par
//     l'éditeur n'est pas récupérable par script : écrire sa propre validation.
//   · EPSS a changé d'hébergeur en 2026 : vérifier l'URL avant d'automatiser.
//   · Les délais de remédiation de référence suivent depuis juin 2026 la
//     décision SSVC (3 / 14 / 60 jours) et non plus une échéance unique.

import { P } from './helper.ts';
import type { ExerciseDef } from '../exercises.ts';

export const m05: ExerciseDef[] = [
  P('cvss4-vector', 'm05', 'Le vecteur CVSS 4.0 qui se recalcule', 1, 'artifact', 'CWE-1059', ['D6'],
    'Trois défauts jouables du lab — BOLA, SSRF vers les métadonnées, jeton forgé — n’ont pas de note. Chacun « semble critique » à celui qui vient de l’exploiter.',
    'Écrire le vecteur CVSS 4.0 de chacun, métriques environnementales de Novafact comprises, et mesurer l’écart avec le score de base seul.',
    'vulns/cvss.yaml', ['m05/l02', 'm05/l03'],
    'La bibliothèque rejette un vecteur dont les métriques sont dans le désordre, hors énumération ou incomplètes : la nomenclature est notée en même temps que le score. Et c’est l’écart entre le score de base et le score environnemental qui porte la leçon — un même défaut ne vaut pas la même chose selon où il vit.'),

  P('regression-not-poc', 'm05', 'Le test de régression plutôt que la preuve d’exploitation', 2, 'artifact', 'CWE-1059', ['D6'],
    'L’équipe produit refuse de prioriser un défaut « tant qu’on n’a pas vu qu’il est exploitable ». Écrire la preuve d’exploitation prendrait deux jours.',
    'Fournir à la place le test de régression qui déclenche le bug, et montrer qu’il suffit à emporter la décision.',
    'verify/bola.regression.test.ts', ['m05/l04', 'm13/l02'],
    'Le test doit échouer contre le code livré et passer contre le corrigé : c’est la même démonstration qu’une preuve d’exploitation, pour une fraction du coût, et il reste dans la CI après la correction. Kohnfelder soutient qu’une preuve d’exploitation est rarement nécessaire — c’est l’occasion de confronter cette position à ta pratique de pentester.'),
];

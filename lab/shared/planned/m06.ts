// m06 · Faire adopter la sécurité — challenges spécifiés.
//
// Le module le plus rétif au lab, et il faut le dire franchement : la
// négociation avec le produit (m06/l02) et la traduction en risque métier pour
// une direction (m06/l03) NE SE VÉRIFIENT PAS. Une charte de champions ou un
// modèle FAIR se juge sur des estimations d'expert — c'est-à-dire précisément
// sur le jugement qu'on voudrait évaluer. Ces deux leçons restent au site, où
// le jeu Pushback fait déjà le travail.
//
// Les Security Champions (m23/l04) confirment la même limite par un autre
// chemin : il n'existe aucun format machine pour une charte de champions — que
// des PDF et des présentations. Seul le routage de revue, lui, se vérifie.
//
// Ce qui suit est ce qui reste, et qui se vérifie vraiment. Outils utiles à
// l'implémentation : `security-txt-parser` (RFC 9116, avec codes de
// diagnostic), `codeowners-utils` et `codeowners-validator` pour la résolution
// GitHub, `@microsoft/jest-sarif` pour valider un finding structuré, et les
// schémas Backstage pour un gabarit de service.

import { P } from './helper.ts';
import type { ExerciseDef } from '../exercises.ts';

export const m06: ExerciseDef[] = [
  P('finding-with-test', 'm06', 'Le correctif qu’on peut fusionner', 2, 'artifact', 'CWE-1059', ['D2', 'D6'],
    'Le constat est juste, mais il arrive seul. L’équipe doit deviner comment prouver qu’elle l’a corrigé.',
    'Accompagner le finding du test de régression qui échoue aujourd’hui et passera après correction.',
    'findings/bola-invoice.test.ts', ['m06/l01', 'm13/l02'],
    'Double passage : le test doit échouer contre le code livré et passer contre le corrigé. Un test qui passe partout ne prouve rien, un test qui échoue partout casse la fonctionnalité. C’est la vérification la plus solide du lab — et une PR de correctif vaut mieux qu’un PDF.'),
];

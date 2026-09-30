// M12 · Revue de code sécurité — challenges spécifiés.
//
// Limite assumée : l'audit ciblé et limité dans le temps (m12/l07) se note sur
// son résultat, jamais sur la stratégie. Et la qualité d'un commentaire de
// revue, qui relève de la persuasion, reste hors de portée.
//
// Notes d'implémentation :
//   · **SecBench.js** est le seul corpus qui fournisse des exploits JavaScript
//     réellement exécutables, avec l'emplacement du sink établi par ses
//     auteurs. C'est ce qui rend `secbench-sink` notable.
//   · La base OSV npm complète pèse une vingtaine de méga-octets : embarquer
//     les quelques avis du scénario, pas la base.
//   · Pour `review-ai-pr`, la liste npm hors ligne complète dépasse 90 Mo :
//     embarquer un instantané réduit au scénario.

import { P } from './helper.ts';
import type { ExerciseDef } from '../exercises.ts';

export const m12: ExerciseDef[] = [
  P('variant-hunt', 'm12', 'Chasse aux variantes', 2, 'fix', 'CWE-1006', ['D5', 'D6'],
    'Une des classes déjà corrigées subsiste à trois autres endroits, sous une forme un peu différente.',
    'Trouver les trois variantes restantes et les corriger toutes — le test ne passe que si aucune ne subsiste.',
    'server/', ['m12/l02', 'm13/l04'],
    'Le seuil « toutes ou rien » est exactement l’enjeu : un finding est une classe, pas une instance. Après chaque correctif, chercher le même motif ailleurs (ripgrep, puis une règle), et transformer la règle en garde-fou de CI pour que la classe ne revienne pas.'),
];

// M7 · Fondations, exigences & vie privée — challenges spécifiés.
//
// Il n'en reste qu'un. Les huit autres sont jouables : voir shared/live/m07.ts
// et les vérifications de server/audit/m07.ts.
//
// Ce qui bloque celui-ci : le **double passage**. Un abuse case n'a de valeur
// que s'il échoue contre le code livré ET passe contre le corrigé — sinon on
// note un fichier qui compile. Le moteur d'audit est synchrone et n'exécute
// aujourd'hui qu'un seul arbre ; `server/audit/fixed-tree.ts` contient la
// mécanique du second (copie du lab, application de `solutions/`, second
// serveur), mais aucune vérification ne s'en sert encore.

import { P } from './helper.ts';
import type { ExerciseDef } from '../exercises.ts';

export const m07: ExerciseDef[] = [
  P('abuse-cases', 'm07', 'L’abuse case exécutable', 2, 'artifact', 'CWE-1059', ['D3', 'D6'],
    'Les user stories décrivent ce que l’utilisateur veut faire. Rien ne décrit ce qu’un utilisateur malveillant voudrait en faire.',
    'Écrire trois cas d’abus de Novafact et le code qui les incarne, sur trois routes distinctes.',
    'requirements/abuse-cases.feature', ['m07/l03', 'm11/l02'],
    'Chaque scénario doit échouer contre le code livré et passer contre le corrigé. Un abuse case qu’on ne sait pas exécuter n’est pas un abuse case : c’est une inquiétude. Le passage à l’exécutable est ce qui le fait entrer dans la définition de « terminé ».'),
];

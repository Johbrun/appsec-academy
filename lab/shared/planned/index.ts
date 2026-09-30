// Challenges spécifiés, pas encore implémentés, groupés par module.
//
// Ils figurent dans CHALLENGES.md et nulle part ailleurs : `exercises` (dans
// shared/exercises.ts) ne contient que les challenges jouables, donc l'API,
// l'interface et les tests de régression ignorent tout ce dossier.
//
// Écrire la spécification avant le code a une raison : c'est elle qui dit si un
// challenge a sa place ici. Un défaut qui ne peut être ni exploité par une
// requête ni constaté sur un artefact du dépôt n'est pas un exercice de lab —
// c'est un jeu ou un atelier, et sa place est sur le site.
//
// Un fichier par module, pour que chacun reste relisable.

import type { ExerciseDef } from '../exercises.ts';
import { m01 } from './m01.ts';
import { m02 } from './m02.ts';
import { m03 } from './m03.ts';
import { m04 } from './m04.ts';
import { m05 } from './m05.ts';
import { m06 } from './m06.ts';
import { m07 } from './m07.ts';
import { m08 } from './m08.ts';
import { m09 } from './m09.ts';
import { m10 } from './m10.ts';
import { m11 } from './m11.ts';
import { m12 } from './m12.ts';
import { m13 } from './m13.ts';
import { m14 } from './m14.ts';
import { m15 } from './m15.ts';
import { m16 } from './m16.ts';
import { m17 } from './m17.ts';
import { m18 } from './m18.ts';
import { m19 } from './m19.ts';
import { m20 } from './m20.ts';

export const plannedExercises: ExerciseDef[] = [
  ...m01,
  ...m02,
  ...m03,
  ...m04,
  ...m05,
  ...m06,
  ...m07,
  ...m08,
  ...m09,
  ...m10,
  ...m11,
  ...m12,
  ...m13,
  ...m14,
  ...m15,
  ...m16,
  ...m17,
  ...m18,
  ...m19,
  ...m20,
];

// Fabrique des challenges spécifiés. Voir shared/planned/index.ts pour le
// pourquoi de ce découpage, et shared/exercises.ts pour le type.

import type { ExerciseDef, Csslp, Kind, Level } from '../exercises.ts';

export const P = (
  id: string,
  module: string,
  title: string,
  level: Level,
  kind: Kind,
  cwe: string,
  csslp: Csslp[],
  brief: string,
  goal: string,
  file: string,
  lessons: string[],
  fix: string,
  k?: number[],
): ExerciseDef => ({
  id, module, title, status: 'planned', kind, level, csslp, cwe,
  brief, goal, file, lessons, fix, hints: [], ...(k ? { k } : {}),
});

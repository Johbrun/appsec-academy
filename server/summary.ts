import { isPlainObject } from './lib/http.ts';

export interface ProgressSummary {
  xp: number;
  lessons: number;
  modules: number;
  labs: number;
  badges: number;
  games: number;
  /** Meilleur score (%) par examen, clés « exam-* ». */
  exams: Record<string, number>;
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const count = (v: unknown) => (Array.isArray(v) ? v.length : isPlainObject(v) ? Object.keys(v).length : 0);

/**
 * Résumé d'une progression pour l'enseignant. Le document vient du navigateur de
 * l'étudiant : on n'en suppose rien, chaque champ est borné à un type sûr.
 */
export function summarize(data: unknown): ProgressSummary {
  const p = isPlainObject(data) ? data : {};
  const scores = isPlainObject(p.scores) ? p.scores : {};
  const exams: Record<string, number> = {};
  let games = 0;
  for (const [key, value] of Object.entries(scores)) {
    if (key.startsWith('exam-')) exams[key] = num(value);
    // « jeu:série » est le record d'une série, pas un jeu de plus : le jeu a déjà
    // sa propre clé, écrite à chaque fin de série.
    else if (!key.includes(':')) games += 1;
  }
  return {
    xp: num(p.xp),
    lessons: count(p.lessons),
    modules: count(p.modules),
    labs: count(p.labs),
    badges: count(p.badges),
    games,
    exams,
  };
}

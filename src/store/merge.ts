import type { LeitnerCard, Progress } from './progress';

const earliest = (a: string, b: string) => (a <= b ? a : b);
const union = (a: string[], b: string[]) => [...new Set([...a, ...b])];

function mergeCard(a: LeitnerCard | undefined, b: LeitnerCard | undefined): LeitnerCard | undefined {
  if (!a || !b) return a ?? b;
  if (a.box !== b.box) return a.box > b.box ? a : b;
  return a.due >= b.due ? a : b;
}

/**
 * Fusionne deux états de progression, `local` (cet onglet) et `server` (ce que le serveur a reçu d'ailleurs).
 *
 * Elle est monotone : on ne perd jamais une leçon validée, un score ou un badge, quel que soit
 * l'ordre dans lequel deux onglets ou deux appareils ont écrit. Le résultat est le même dans
 * les deux sens, ce qui permet de réessayer sans risque.
 *
 * Limite assumée : les labs se cochent ET se décochent, et une union ne sait pas distinguer une
 * suppression d'un oubli. Un lab décoché peut donc réapparaître si deux onglets écrivent en même temps.
 */
export function mergeProgress(local: Progress, server: Progress): Progress {
  const lessons: Record<string, string> = { ...server.lessons };
  for (const [key, date] of Object.entries(local.lessons)) lessons[key] = key in lessons ? earliest(lessons[key], date) : date;

  const scores: Record<string, number> = { ...server.scores };
  for (const [key, pct] of Object.entries(local.scores)) scores[key] = Math.max(scores[key] ?? 0, pct);

  const leitner: Record<string, LeitnerCard> = {};
  for (const key of new Set([...Object.keys(local.leitner), ...Object.keys(server.leitner)])) {
    const card = mergeCard(local.leitner[key], server.leitner[key]);
    if (card) leitner[key] = card;
  }

  const checkpoints: Progress['checkpoints'] = {};
  for (const id of new Set([...Object.keys(local.checkpoints), ...Object.keys(server.checkpoints)])) {
    const l = local.checkpoints[id] ?? {};
    const s = server.checkpoints[id] ?? {};
    const merged: { avant?: number; apres?: number } = {};
    // « Avant » est gelé au premier passage : la valeur déjà enregistrée l'emporte.
    const avant = s.avant ?? l.avant;
    if (avant !== undefined) merged.avant = avant;
    const apres = l.apres === undefined ? s.apres : s.apres === undefined ? l.apres : Math.max(l.apres, s.apres);
    if (apres !== undefined) merged.apres = apres;
    checkpoints[id] = merged;
  }

  return {
    version: 2,
    name: local.name,
    xp: Math.max(local.xp, server.xp),
    lessons,
    modules: union(server.modules, local.modules),
    scores,
    labs: union(server.labs, local.labs),
    leitner,
    badges: union(server.badges, local.badges),
    checkpoints,
  };
}

import { lessonKey, type ModuleMeta } from '../data/catalog';
import type { Progress } from '../store/progress';

/**
 * Les leçons d'un module ne s'ouvrent qu'une fois le diagnostic d'entrée passé :
 * lu après une leçon, il ne mesure plus le point de départ.
 *
 * Exception : un module déjà entamé (au moins une leçon validée) reste ouvert.
 * Ses leçons ont été lues avant l'arrivée des diagnostics, et le passer
 * maintenant ne donnerait plus une ligne de départ, seulement un verrou.
 *
 * Tous les modules ont un diagnostic (`check-quiz` le vérifie) : on ne charge
 * pas `checkpoints.ts` ici, il pèse une soixantaine de kilo-octets.
 */
export function lessonsUnlocked(p: Progress, m: ModuleMeta) {
  return p.checkpoints[m.id]?.avant !== undefined
    || m.lessons.some((l) => p.lessons[lessonKey(m.id, l.id)]);
}

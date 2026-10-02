// Migration des progressions enregistrées avant la restructuration du parcours
// en blocs A à H (format 1 → 2).
//
// Les identifiants de module ne changent pas, seul leur numéro affiché bouge :
// les flashcards (`m02-c7`), les labs et les jeux restent valides tels quels.
// Ce qui bouge, ce sont les leçons déplacées d'un module à l'autre ou
// renumérotées dans leur module : leur clé `mXX-lYY` suit la table ci-dessous.
//
// La table s'applique en un seul passage, jamais en chaîne : `m02-l02` devient
// `m02-l01` pendant que `m02-l01` devient `m25-l08`, sans collision.
//
// Le format passe à 2 pour qu'un onglet resté sur l'ancienne version du site
// refuse le document migré (il ne sait lire que 1) au lieu de le réécrire avec
// les anciennes clés.

const LEGACY_LESSONS: Record<string, string> = {
  'm01-l02': 'm01-l05', 'm07-l01': 'm01-l02', 'm07-l02': 'm01-l03', 'm01-l03': 'm24-l02',
  'm01-l04': 'm24-l03', 'm01-l05': 'm32-l03', 'm01-l06': 'm32-l04', 'm01-l07': 'm26-l06',
  'm01-l08': 'm32-l05', 'm06-l01': 'm23-l01', 'm06-l05': 'm23-l04', 'm08-l11': 'm25-l04',
  'm02-l01': 'm25-l08', 'm02-l02': 'm02-l01', 'm02-l03': 'm02-l02', 'm02-l04': 'm02-l03',
  'm02-l05': 'm02-l04', 'm02-l09': 'm02-l05', 'm02-l10': 'm02-l06', 'm02-l07': 'm02-l08',
  'm02-l08': 'm02-l09', 'm02-l06': 'm04-l02', 'm04-l02': 'm04-l03', 'm04-l03': 'm04-l04',
  'm04-l04': 'm04-l05', 'm04-l05': 'm04-l06', 'm04-l06': 'm04-l07', 'm04-l07': 'm04-l08',
  'm04-l08': 'm04-l09', 'm07-l03': 'm07-l01', 'm07-l04': 'm07-l02', 'm07-l05': 'm07-l03',
  'm07-l06': 'm07-l04', 'm07-l07': 'm07-l05', 'm07-l08': 'm07-l06', 'm08-l01': 'm08-l02',
  'm08-l02': 'm08-l03', 'm08-l03': 'm08-l04', 'm08-l10': 'm08-l05', 'm08-l09': 'm08-l07',
  'm08-l08': 'm08-l08', 'm08-l12': 'm08-l09', 'm08-l04': 'm08-l10', 'm08-l05': 'm08-l11',
  'm08-l06': 'm09-l01', 'm08-l07': 'm09-l02', 'm09-l01': 'm09-l03', 'm09-l02': 'm09-l04',
  'm09-l03': 'm09-l05', 'm09-l04': 'm09-l06', 'm09-l05': 'm09-l07', 'm09-l06': 'm09-l08',
  'm14-l07': 'm14-l08', 'm14-l08': 'm14-l09', 'm14-l09': 'm14-l10', 'm14-l10': 'm14-l11',
  'm18-l02': 'm18-l03', 'm18-l03': 'm18-l04', 'm18-l04': 'm28-l03', 'm18-l05': 'm28-l05',
  'm18-l06': 'm28-l06', 'm19-l05': 'm30-l01', 'm19-l06': 'm19-l05', 'm19-l07': 'm19-l06',
  'm19-l08': 'm19-l07', 'm06-l02': 'm06-l01', 'm06-l03': 'm06-l02', 'm06-l04': 'm06-l03',
  'm06-l06': 'm06-l04', 'm06-l07': 'm06-l05', 'm06-l08': 'm06-l06', 'm20-l03': 'm20-l02',
  'm20-l01': 'm20-l03', 'm20-l02': 'm20-l04', 'm20-l06': 'm20-l05', 'm20-l04': 'm20-l06',
  'm20-l09': 'm20-l07', 'm20-l05': 'm20-l08', 'm20-l07': 'm20-l09', 'm20-l08': 'm20-l10',
  'm20-l10': 'm20-l11', 'm20-l11': 'm20-l14', 'm20-l12': 'm20-l15',
};

/**
 * Modules dont le diagnostic d'entrée ne mesure plus la même chose : m01 est
 * passé de « Programme AppSec » à « Présentation de l'AppSec ». Le score gelé
 * de l'ancien questionnaire ne dirait plus rien du point de départ.
 */
const RESET_CHECKPOINTS = ['m01'];

export interface V1 {
  version: 1;
  lessons?: Record<string, string>;
  checkpoints?: Record<string, unknown>;
}

/**
 * Remet un document au format 1 dans la forme du format 2. `modules` (modules
 * validés) est gardé tel quel : la fusion avec le serveur est une union, une
 * suppression ici reviendrait au prochain échange.
 */
export function migrateV1<T extends V1>(doc: T): Omit<T, 'version'> & { version: 2 } {
  const lessons: Record<string, string> = {};
  for (const [key, date] of Object.entries(doc.lessons ?? {})) lessons[LEGACY_LESSONS[key] ?? key] = date;
  const checkpoints = { ...(doc.checkpoints ?? {}) };
  for (const id of RESET_CHECKPOINTS) delete checkpoints[id];
  return { ...doc, version: 2, lessons, checkpoints };
}

// m18 · Surveillance, logging & SIEM — challenges spécifiés.
//
// Aucun cluster Elastic n'est nécessaire : le lab produit des journaux, embarque
// un corpus d'événements étiquetés, et l'apprenant écrit des règles que des
// tests évaluent en précision et en rappel. C'est le detection engineering
// réduit à ce qui compte, et c'est entièrement déterministe.

import { P } from './helper.ts';
import type { ExerciseDef } from '../exercises.ts';

export const m18: ExerciseDef[] = [
  P('tamper-evident-log', 'm18', 'Le journal infalsifiable', 2, 'exploit', 'CWE-778', ['D7'],
    'Une route d’administration permet de supprimer des lignes d’audit après coup. Rien ne le détecte.',
    'Effacer la trace d’une action, puis poser le contrôle d’intégrité qui nomme l’endroit exact où la chaîne rompt.',
    'server/routes/admin.ts', ['m18/l01', 'm01/l03'],
    'Chaînage par empreinte, ou export en écriture seule vers un stockage verrouillé. Effacer ses traces est une étape standard : si le journal est altérable par le compte compromis, il ne prouve rien. Le « A » du Gold Standard suppose l’intégrité.', [1]),
];

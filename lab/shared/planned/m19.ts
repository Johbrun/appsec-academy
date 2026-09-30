// M19 · Sécurité de l'IA — challenges spécifiés.
//
// Le lab n'a pas de vrai modèle : le simulateur déterministe exécute les
// instructions qu'il lit. C'est suffisant — et même préférable — pour démontrer
// l'injection directe et indirecte, l'empoisonnement d'outils et les fuites de
// RAG, parce que le résultat est reproductible. Ce qui n'est PAS démontrable
// ainsi, et qu'il faut dire : la robustesse d'un vrai modèle face à des
// formulations adverses, qui demande un modèle réel et un budget d'évaluation.

import { P } from './helper.ts';
import type { ExerciseDef } from '../exercises.ts';

export const m19: ExerciseDef[] = [
  P('rule-of-two-profile', 'm19', 'Le profil de la session', 2, 'artifact', 'CWE-1059', ['D4'],
    'Chaque session de l’assistant cumule trois capacités : lire du contenu non fiable, accéder à des données sensibles, agir vers l’extérieur.',
    'Configurer l’agent pour qu’une même charge utile réussisse avec les trois, et échoue dès qu’on en retire une seule, quelle qu’elle soit.',
    'server/routes/assistant.ts', ['m19/l03', 'm19/l01'],
    'C’est la démonstration expérimentale de la lethal trifecta et de la Rule of Two : ce n’est pas une capacité qui est dangereuse, c’est leur cumul. Et c’est ce qui donne un critère de conception plutôt qu’une liste de bonnes intentions.'),

  P('atlas-mapping', 'm19', 'Cartographier avec ATLAS', 2, 'artifact', 'CWE-1059', ['D4'],
    'Les challenges IA du lab ne sont rattachés à aucun référentiel : impossible de dire ce que la défense couvre.',
    'Rattacher chaque challenge à sa technique ATLAS et au risque du Top 10 correspondant, et repérer les trous.',
    'threats/atlas-coverage.csv', ['m19/l06', 'm11/l04'],
    'Le harnais vérifie que chaque technique citée existe et n’est pas dépréciée. ATLAS est à l’IA ce qu’ATT&CK est au reste : il donne un vocabulaire commun aux équipes de détection et de développement — dont les ajouts agentiques récents.'),
];

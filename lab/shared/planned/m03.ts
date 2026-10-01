// m03 · Web avancé — challenges spécifiés.
//
// Le request smuggling (m03/l05) est volontairement absent : il demande une
// vraie chaîne de proxys avec des analyseurs HTTP divergents. Le simuler en
// local donnerait une fausse intuition du mécanisme.

import { P } from './helper.ts';
import type { ExerciseDef } from '../exercises.ts';

export const m03: ExerciseDef[] = [
  P('vuln-chain', 'm03', 'Chaîne de vulnérabilités', 2, 'exploit', 'CWE-691', ['D5', 'D6'],
    'Trois défauts jugés mineurs cohabitent : une énumération, une redirection ouverte et une fuite d’identifiant dans un en-tête. Chacun a été classé « informatif » au triage.',
    'Les enchaîner jusqu’à une prise de contrôle de compte, puis désigner le correctif unique qui casse le plus de chaînes.',
    'server/', ['m03/l04', 'm05/l03'],
    'La sévérité ne s’additionne pas, elle se compose : c’est ce que le triage par CVSS de base rate systématiquement. Chercher les chaînes fait partie de la revue de conception, et un seul contrôle bien placé en coupe souvent plusieurs.', [8]),
];

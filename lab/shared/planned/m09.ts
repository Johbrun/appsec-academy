// m09 · OAuth 2.x / OIDC / SAML — challenges spécifiés, pas encore implémentés.

import { P } from './helper.ts';
import type { ExerciseDef } from '../exercises.ts';

export const m09: ExerciseDef[] = [
  P('dpop-binding', 'm09', 'Lier le jeton à son porteur', 3, 'fix', 'CWE-294', ['D1', 'D5'],
    'Les jetons d’accès sont au porteur : quiconque en vole un peut l’utiliser, depuis n’importe où.',
    'Lier chaque jeton à une clé détenue par le client, et refuser sa réutilisation ailleurs.',
    'server/lib/jwt.ts', ['m09/l07', 'm03/l10'],
    'Un jeton lié transforme un vol de jeton en vol inutile : il faut aussi la clé privée. C’est ce que résolvent DPoP et les jetons liés à mTLS, et ce que le BCP de sécurité OAuth recommande pour tout ce qui compte. Le harnais rejoue un jeton volé depuis un autre client et exige un refus.', [5]),
];

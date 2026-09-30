// M2 · Vulnérabilités web, écosystème JS — challenges spécifiés.

import { P } from './helper.ts';
import type { ExerciseDef } from '../exercises.ts';

export const m02: ExerciseDef[] = [
  P('top10-mapping', 'm02', 'Cartographier les défauts du lab', 1, 'fix', 'CWE-1008', ['D5', 'D6'],
    'Le lab contient des dizaines de défauts connus, mais aucun inventaire : personne ne sait ce qu’il couvre ni ce qu’il laisse de côté.',
    'Produire la table de correspondance de chaque défaut vers OWASP Top 10:2025, API Top 10 et CWE Top 25, et la garder juste.',
    'inventory.json', ['m02/l01', 'm05/l01'],
    'Les référentiels ne servent pas à classer pour classer : le Top 10 sensibilise, l’API Top 10 cible les endpoints, le CWE Top 25 nomme la cause racine. C’est la correspondance qui révèle les angles morts — et c’est elle qu’on présente à une direction.'),

  P('crlf-email-header', 'm02', 'Injection d’en-tête dans l’e-mail de facture', 2, 'exploit', 'CWE-93', ['D5'],
    'Le nom du destinataire est interpolé dans les en-têtes du message sans filtrer les retours à la ligne.',
    'Faire partir une copie de la facture vers une adresse qui ne figure dans aucun champ destinataire.',
    'server/store.ts', ['m02/l02', 'm10/l05'],
    'Tout protocole à en-têtes séparés par des retours de ligne est injectable : refuser `\\r` et `\\n` dans les valeurs, et construire le message avec une bibliothèque qui encode les en-têtes plutôt que par concaténation.', [10]),
];

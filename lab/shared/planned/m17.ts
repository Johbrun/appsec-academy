// M17 · Déploiement, exploitation & résilience — challenges spécifiés.

import { P } from './helper.ts';
import type { ExerciseDef } from '../exercises.ts';

export const m17: ExerciseDef[] = [
  P('missing-headers', 'm17', 'En-têtes de sécurité absents', 1, 'fix', 'CWE-693', ['D7'],
    'Aucun en-tête de sécurité n’est servi : ni transport strict, ni non-reniflage, ni politique de référent, ni politique de permissions.',
    'Poser les en-têtes au bon endroit et vérifier qu’ils survivent au déploiement.',
    'server/index.ts', ['m17/l01', 'm17/l05'],
    'Une bibliothèque d’en-têtes pour la base, puis ceux conçus en M4 appliqués soit dans l’application, soit dans la politique de réponse du CDN — mais à un seul endroit, et vérifiés après chaque déploiement. Deux endroits qui posent des en-têtes finissent par se contredire.'),

  P('secret-fallback', 'm17', 'Le secret de repli', 1, 'fix', 'CWE-1188', ['D7'],
    'La clé de signature a une valeur de repli codée en dur, utilisée quand la variable d’environnement est absente. Elle l’a été une fois en production.',
    'Faire échouer le démarrage plutôt que de continuer avec une valeur connue de tous.',
    'server/lib/jwt.ts', ['m17/l01', 'm08/l08'],
    'Un repli sur une valeur de développement est un échec silencieux, donc le pire type d’échec : l’application démarre, sert, et tous ses jetons sont forgeables. Échouer bruyamment au démarrage est ici le comportement sûr.', [5]),

  P('csp-permissive', 'm17', 'La CSP qui ne protège de rien', 2, 'fix', 'CWE-693', ['D7'],
    'Une politique de sécurité du contenu existe, mais elle autorise l’inline, l’évaluation dynamique et toutes les origines en HTTPS.',
    'La resserrer jusqu’à ce qu’elle arrête réellement les charges utiles, sans casser l’application.',
    'server/index.ts', ['m17/l05', 'm04/l04'],
    'Une CSP permissive est pire qu’aucune : elle rassure les audits et n’arrête rien. Nonce plutôt qu’inline, diffusion dynamique plutôt que liste d’origines, et déploiement en observation d’abord pour mesurer ce qui casse.'),

  P('express-resilience', 'm17', 'Aucun garde-fou de disponibilité', 2, 'fix', 'CWE-770', ['D7'],
    'Pas de limite de taille de corps, pas de délai d’expiration serveur, pas d’arrêt gracieux : une coupure de tâche perd les requêtes en vol.',
    'Poser les limites et l’arrêt gracieux, et le prouver par une requête surdimensionnée et un signal d’arrêt.',
    'server/index.ts', ['m17/l06', 'm13/l05'],
    'La disponibilité est une propriété de sécurité : une limite de corps absente, c’est une mémoire épuisable par une requête. Et un arrêt gracieux est ce qui rend un déploiement invisible pour les clients, donc fréquent, donc sûr.'),

  P('decommission', 'm17', 'Éteindre un service proprement', 2, 'artifact', 'CWE-1059', ['D2', 'D7'],
    'L’ancien service d’export a été remplacé il y a six mois. Son enregistrement DNS, son rôle, sa clé d’API et ses données sont toujours là.',
    'Écrire et exécuter la procédure de mise hors service, et prouver qu’il ne reste rien d’atteignable.',
    'runbooks/decommission.md', ['m17/l07', 'm07/l05'],
    'Le harnais vérifie chaque étape sur l’état fourni : enregistrement retiré, identifiants révoqués, données archivées selon leur durée de conservation, dépendances prévenues. Un service oublié est une surface qui n’est plus patchée et que plus personne ne surveille — c’est l’anti-pattern du composant non patchable.', [4]),

];

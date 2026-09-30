// M8 · Conception sécurisée & architecture — challenges spécifiés, pas encore implémentés.

import { P } from './helper.ts';
import type { ExerciseDef } from '../exercises.ts';

export const m08: ExerciseDef[] = [
  P('webhook-replay', 'm08', 'Webhook signé mais rejouable', 2, 'exploit', 'CWE-294', ['D1', 'D5'],
    'Les webhooks entrants du prestataire de paiement sont signés, mais la signature ne couvre ni horodatage ni identifiant unique.',
    'Rejouer une notification de paiement pour créditer deux fois la même facture.',
    'server/routes/webhooks.ts', ['m08/l08', 'm10/l06'],
    'Un MAC ne prouve que l’origine, pas la fraîcheur : horodatage signé et fenêtre d’acceptation courte, identifiant d’événement conservé pour rejeter les doublons. L’idempotence est la vraie défense.', [5]),

  P('fast-hash', 'm08', 'Mots de passe hachés trop vite', 2, 'fix', 'CWE-916', ['D1', 'D5'],
    'Les mots de passe sont stockés en SHA-256 sans sel. Rapide à vérifier, donc rapide à casser hors ligne.',
    'Migrer vers argon2id sans déconnecter les comptes existants ni stocker un seul mot de passe en clair.',
    'server/store.ts', ['m08/l06', 'm08/l08'],
    'argon2id avec des paramètres tenus à jour, sel par compte, et migration opportuniste au prochain login. Le coût de vérification est un paramètre de sécurité, pas de performance.', [5]),

  P('secret-rotation', 'm08', 'Clé de signature unique et éternelle', 3, 'fix', 'CWE-321', ['D1', 'D7'],
    'Une seule clé signe les jetons de tous les tenants, codée en dur, sans identifiant de version ni moyen de rotation.',
    'Rendre la clé rotative sans invalider les jetons en cours, et sans redéploiement.',
    'server/lib/jwt.ts', ['m08/l08', 'm17/l08'],
    'Agilité cryptographique : identifiant de clé (`kid`) dans l’en-tête, trousseau qui accepte l’ancienne et la nouvelle pendant la transition, clés dans Secrets Manager, rotation planifiée et testée. Une clé qu’on ne sait pas tourner est une clé qu’on ne tournera pas après une fuite.', [5]),

  P('pattern-inventory', 'm08', 'Nommer les patterns déjà présents', 1, 'artifact', 'CWE-1059', ['D1', 'D4'],
    'Novafact applique déjà plusieurs patterns de conception sans les nommer, et souffre d’au moins trois anti-patterns que personne n’a qualifiés.',
    'Rattacher chaque contrôle existant au pattern qu’il implémente, et chaque défaut structurel à son anti-pattern.',
    'threats/patterns.yaml', ['m08/l02', 'm08/l03'],
    'Le harnais vérifie que chaque pattern cité appartient aux quatorze, chaque anti-pattern aux quatre, et que le fichier désigné existe et contient bien le contrôle. Nommer sert à discuter : « c’est un confused deputy » fait avancer une revue là où « ce n’est pas très propre » l’enlise.', [4]),
];

// m04 · Sécurité côté client & scripts tiers — challenges spécifiés.
//
// Plusieurs de ces challenges portent aussi la leçon « Client avancé » de M9
// (m03/l12) : DOM clobbering, contournements de CSP, XS-Leaks.

import { P } from './helper.ts';
import type { ExerciseDef } from '../exercises.ts';

export const m04: ExerciseDef[] = [
  P('iframe-sandbox', 'm04', 'Iframe de paiement sans sandbox', 2, 'fix', 'CWE-1021', ['D4', 'D5'],
    'L’iframe du prestataire est chargée sans attribut `sandbox` ni `allow`, et peut naviguer la fenêtre parente.',
    'Depuis le contenu de l’iframe, faire naviguer la page de Novafact vers une origine choisie — puis empêcher que ce soit possible.',
    'src/pages/Checkout.tsx', ['m04/l04', 'm04/l08'],
    '`sandbox` avec les seules capacités nécessaires, `allow` minimal, et `frame-ancestors` côté prestataire. Isoler le paiement dans une iframe n’a de valeur que si l’iframe est réellement contrainte — c’est l’esprit de l’exigence PCI 6.4.3.'),

  P('csrf-token-not-bound', 'm04', 'Jeton anti-CSRF non lié à la session', 2, 'exploit', 'CWE-352', ['D5'],
    'Les jetons anti-CSRF sont tirés d’un pool commun et validés sans être rattachés à la session qui les a reçus.',
    'Exécuter une mutation sur le compte d’un autre utilisateur avec un jeton obtenu depuis le tien.',
    'server/lib/auth.ts', ['m04/l07', 'm04/l02'],
    'Le jeton est lié à la session et vérifié comme tel. Un jeton « valide dans l’absolu » ne prouve rien sur l’auteur de la requête. Et Fetch Metadata offre une défense qui ne dépend d’aucun jeton.'),

  P('no-csp', 'm04', 'Page de paiement sans CSP', 2, 'fix', 'CWE-1021', ['D5', 'D7'],
    'Aucune politique de sécurité du contenu n’est servie : une XSS stockée s’exécute sans rencontrer la moindre barrière.',
    'Écrire la CSP stricte de la page de paiement : les fonctionnalités marchent toujours, les charges utiles connues ne passent plus.',
    'server/index.ts', ['m04/l05', 'm17/l05'],
    'CSP à nonce avec `strict-dynamic`, déployée en observation puis en blocage, rapports collectés. La CSP est aussi un capteur : ses rapports disent ce qui tente de s’exécuter.'),

  P('cookie-flags', 'm04', 'Cookie de session mal attribué', 2, 'exploit', 'CWE-1004', ['D5'],
    'Le cookie de session n’a ni restriction de transport, ni protection contre la lecture par script, ni politique d’envoi inter-sites.',
    'Voler la session depuis une XSS, puis déclencher une action authentifiée depuis un autre site.',
    'server/lib/auth.ts', ['m04/l07', 'm04/l02'],
    'Préfixe `__Host-` (donc `Secure`, `Path=/`, sans `Domain`), `HttpOnly`, `SameSite`. Les valeurs par défaut du framework devraient suffire : si l’on doit y penser, c’est que le chemin sûr n’est pas le plus facile.'),

  P('client-monitoring', 'm04', 'Surveiller ce que la page charge', 3, 'fix', 'CWE-778', ['D7', 'D8'],
    'Rien ne détecte qu’un script de la page de paiement a changé : ni empreinte, ni rapport, ni alerte. Un skimmer y vivrait indéfiniment.',
    'Mettre en place la collecte des rapports de CSP et la surveillance d’intégrité des scripts, et le prouver en modifiant un script.',
    'server/routes/lab.ts', ['m04/l09', 'm28/l05'],
    'Point de collecte des rapports (Reporting API), inventaire des scripts avec leur empreinte, comparaison à chaque déploiement, et alerte sur écart. C’est l’exigence PCI 11.6.1, et c’est ce qui aurait raccourci Magecart et polyfill.io de plusieurs mois.'),
];

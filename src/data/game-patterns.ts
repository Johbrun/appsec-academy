// Situations du jeu « Pattern Match » : les 14 patterns et 4 anti-patterns de Kohnfelder (K4).

export const patternNames = [
  'Economy of Design', 'Transparent Design', 'Least Privilege', 'Least Information', 'Secure by Default',
  'Allowlists over Blocklists', 'Avoid Predictability', 'Fail Securely', 'Complete Mediation', 'Least Common Mechanism',
  'Defense in Depth', 'Separation of Privilege', 'Reluctance to Trust', 'Accept Security Responsibility',
  'Confused Deputy', 'Backflow of Trust', 'Third-Party Hooks', 'Unpatchable Components',
] as const;

export type PatternName = typeof patternNames[number];
export const antiPatterns: PatternName[] = ['Confused Deputy', 'Backflow of Trust', 'Third-Party Hooks', 'Unpatchable Components'];

export const situations: { text: string; answer: PatternName; why: string }[] = [
  { text: 'Le service PDF n’a accès qu’au préfixe pdf/ du bucket des factures, en lecture seule.', answer: 'Least Privilege', why: 'Juste les droits nécessaires à sa tâche.' },
  { text: 'L’API de profil ne renvoie que le nom et la langue, alors que l’appelant n’a besoin de rien d’autre.', answer: 'Least Information', why: 'Ne fournir que l’information nécessaire réduit ce qui peut fuir.' },
  { text: 'Un nouveau tenant démarre avec la MFA obligatoire pour ses administrateurs.', answer: 'Secure by Default', why: 'La configuration initiale est la plus sûre ; l’assouplir demande une action explicite.' },
  { text: 'Les identifiants de factures sont des UUID aléatoires plutôt que des numéros séquentiels.', answer: 'Avoid Predictability', why: 'Ce qui est prévisible ne reste pas privé : volume d’activité et énumération.' },
  { text: 'Si le service d’autorisation ne répond pas, l’API renvoie 403.', answer: 'Fail Securely', why: 'En cas de doute ou de panne, on refuse.' },
  { text: 'Toutes les lectures de factures passent par un seul repository qui vérifie le tenant.', answer: 'Complete Mediation', why: 'Un seul chemin vérifié vers chaque ressource, pas plusieurs gardes différentes.' },
  { text: 'Un remboursement de plus de 5 000 € doit être validé par un second administrateur.', answer: 'Separation of Privilege', why: 'Une action critique exige plusieurs parties.' },
  { text: 'La CSP stricte s’ajoute à l’échappement automatique de React.', answer: 'Defense in Depth', why: 'Deux couches indépendantes : si l’une cède, l’autre tient.' },
  { text: 'Le service interne de grand livre vérifie lui-même l’autorisation, sans supposer que l’API publique l’a fait.', answer: 'Accept Security Responsibility', why: 'Chaque composant assume sa part de la sécurité.' },
  { text: 'Les webhooks entrants sont refusés s’ils ne sont pas signés et horodatés.', answer: 'Reluctance to Trust', why: 'Toute entrée externe est non fiable jusqu’à preuve du contraire.' },
  { text: 'Un seul middleware d’autorisation, court et testé, remplace quinze vérifications écrites à la main.', answer: 'Economy of Design', why: 'Une conception plus simple a moins de bugs.' },
  { text: 'Les origines autorisées par CORS sont listées explicitement.', answer: 'Allowlists over Blocklists', why: 'Lister ce qui est permis plutôt que ce qui est interdit.' },
  { text: 'Chaque tenant a sa propre clé de chiffrement de données, plutôt qu’une clé commune à tous.', answer: 'Least Common Mechanism', why: 'Éviter les mécanismes partagés entre utilisateurs limite les effets croisés.' },
  { text: 'La sécurité de la console d’administration repose sur le fait que son URL n’est documentée nulle part.', answer: 'Transparent Design', why: 'Pattern violé : une protection ne doit jamais reposer sur le secret de la conception (sécurité par l’obscurité).' },
  { text: 'L’assistant IA exécute les actions avec son compte de service, quel que soit l’utilisateur qui les demande.', answer: 'Confused Deputy', why: 'Un composant privilégié agit au-delà des droits de son demandeur.' },
  { text: 'Le runner CI des pull requests externes possède les identifiants de déploiement en production.', answer: 'Backflow of Trust', why: 'Un composant peu fiable contrôle un composant très fiable.' },
  { text: 'Un widget de chat tiers est chargé directement dans la page de paiement.', answer: 'Third-Party Hooks', why: 'Un tiers dispose d’un accès direct au cœur du système.' },
  { text: 'L’export PDF dépend d’une bibliothèque dont le dernier commit date d’il y a quatre ans.', answer: 'Unpatchable Components', why: 'Un composant qu’on ne peut plus corriger devient une dette permanente.' },
];

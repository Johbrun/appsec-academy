// Scénarios du jeu « Stepping Stones » : relier des findings faibles en une chaîne, puis la casser.
//
// Règle d'écriture : **les quatre correctifs sont des mesures qu'on prendrait
// vraiment**, de longueur comparable. Celui qui vaut 40 points casse la classe
// entière ; ceux qui valent 20 ou 10 cassent cette chaîne-ci, ou la ralentissent ;
// celui qui vaut 0 est un correctif légitime sur un finding hors chaîne. La
// question n'est jamais « lequel est sérieux », mais « lequel achète le plus ».
//
// `npm run games` vérifie que le correctif à 40 points n'est pas le plus long.
//
// ── Ce qui fait la difficulté d'une chaîne ────────────────────────────────────
//
// Pas le sujet, mais la **structure** de l'inférence. Un scénario n'est pas plus
// dur parce que la faille est pointue ; il l'est parce qu'il faut plus de sauts
// pour la reconstituer, ou parce que le geste évident n'est pas le bon.
//
//   N1 · Chaîne de deux ou trois maillons, évidente. Les findings hors chaîne
//        sont visiblement à côté de la plaque, et le correctif le plus rentable
//        tombe sur le maillon qu'on regarderait en premier. On apprend à relier.
//
//   N2 · Chaîne de trois ou quatre maillons, avec au moins un **finding leurre**
//        qui a tout l'air d'appartenir à la chaîne (une bonne pratique voisine,
//        un finding « moyen » plus grave que ceux qui comptent) et n'y sert à
//        rien. Il faut lire le contexte pour trancher ce qui se combine.
//
//   N3 · Chaîne longue (quatre maillons ou plus) où le **correctif le plus
//        rentable n'est pas sur le maillon le plus grave** : la mesure qui achète
//        le plus est une frontière discrète (une portée de cookie, une condition
//        de confiance, un rôle minimal), pas le colmatage du finding le plus
//        effrayant. Le « plus sécurisé en apparence » est le piège.
//
// Certains scénarios s'appuient sur un incident public documenté (`real`) ;
// les autres se déroulent chez Novafact, l'entreprise fil rouge.

import { defineSeries, type SeriesProfile } from '../lib/series';

export type StoneLevel = 1 | 2 | 3;
export type StoneTheme = 'web' | 'identite' | 'cloud' | 'paiement' | 'multi-tenant' | 'cicd';

export interface Stone { id: string; label: string; sev: 'info' | 'faible' | 'moyen'; inChain: boolean }
export interface StoneFix { label: string; points: 0 | 10 | 20 | 40; why: string }
export interface StoneScenario {
  /** Identifiant stable : il sert à composer les séries. */
  id: string;
  level: StoneLevel;
  theme: StoneTheme;
  goal: string;
  story: string;
  stones: Stone[];
  chainOrder: string[];
  chainStory: string;
  fixes: StoneFix[];
  /** Cas réel dont la chaîne s'inspire (nom, année), le cas échéant. */
  real?: string;
  /** Scénarios de même structure à ne pas placer dans la même série. */
  avoid?: string[];
}

export const stoneScenarios: StoneScenario[] = [
  // ── N1 ────────────────────────────────────────────────────────────────────
  {
    id: 'account-takeover',
    level: 1,
    theme: 'identite',
    goal: 'Prendre le contrôle d’un compte client',
    story: 'Le rapport de pentest de Novafact liste une vingtaine de findings faibles. Lesquels, combinés, mènent au vol de compte ?',
    stones: [
      { id: 'a', label: 'Open redirect sur /logout?next=', sev: 'faible', inChain: true },
      { id: 'b', label: 'redirect_uri OAuth validé par préfixe (https://app.novafact.example…)', sev: 'faible', inChain: true },
      { id: 'c', label: 'En-tête X-Powered-By: Express', sev: 'info', inChain: false },
      { id: 'd', label: 'Politique de mots de passe à 8 caractères', sev: 'moyen', inChain: false },
      { id: 'e', label: 'Pas de CSP sur le site marketing', sev: 'faible', inChain: false },
      { id: 'f', label: 'Journal d’audit sans horodatage UTC', sev: 'info', inChain: false },
    ],
    chainOrder: ['b', 'a'],
    chainStory: 'Le fournisseur d’identité accepte un redirect_uri qui commence par l’URL de l’application : on vise /logout?next=…, dont l’open redirect renvoie le code d’autorisation vers un domaine externe. Deux findings faibles, un vol de compte.',
    fixes: [
      { label: 'Comparer le redirect_uri par égalité exacte, sans préfixe', points: 40, why: 'Casse cette chaîne et toutes celles qui passeront par une redirection ouverte pas encore découverte : la validation cesse de dépendre du reste du domaine.' },
      { label: 'Corriger l’open redirect de /logout et auditer les autres', points: 20, why: 'Casse cette chaîne, et il s’en créera d’autres : une redirection ouverte réapparaît à chaque nouvelle page de sortie, de partage ou de retour de paiement.' },
      { label: 'Imposer des mots de passe de douze caractères minimum', points: 0, why: 'Un durcissement réel de l’authentification, et le flux OAuth ne consulte jamais le mot de passe : la chaîne passe entièrement à côté.' },
      { label: 'Supprimer l’en-tête X-Powered-By de toutes les réponses', points: 0, why: 'De l’hygiène, à faire, sans effet ici : connaître le framework n’aide pas à construire cette chaîne, qui n’exploite aucune faille d’Express.' },
    ],
  },
  {
    id: 'cross-tenant-invoices',
    level: 1,
    theme: 'multi-tenant',
    goal: 'Lire les factures d’un autre tenant',
    story: 'Deux findings notés « info » et « moyen » dorment depuis trois mois.',
    avoid: ['idor-support-tickets'],
    stones: [
      { id: 'a', label: 'Identifiants de facture séquentiels', sev: 'info', inChain: true },
      { id: 'b', label: 'GET /invoices/:id/pdf ne vérifie que l’authentification', sev: 'moyen', inChain: true },
      { id: 'c', label: 'TLS 1.0 accepté sur l’ancien domaine', sev: 'faible', inChain: false },
      { id: 'd', label: 'robots.txt mentionne /admin', sev: 'info', inChain: false },
      { id: 'e', label: 'Messages d’erreur en anglais et en français', sev: 'info', inChain: false },
      { id: 'f', label: 'Pas d’alerte sur les accès inter-tenants', sev: 'faible', inChain: false },
    ],
    chainOrder: ['a', 'b'],
    chainStory: 'Des identifiants prévisibles et une route qui n’autorise pas par tenant : un script parcourt toutes les factures de tous les clients. L’absence d’alerte n’aide pas l’attaquant, mais retardera la découverte.',
    fixes: [
      { label: 'Filtrer par tenant dans la couche d’accès aux données', points: 40, why: 'La BOLA devient impossible à écrire : toute requête qui passe par la couche porte son tenant, y compris les routes que personne n’a encore écrites.' },
      { label: 'Remplacer les identifiants séquentiels par des UUID aléatoires', points: 10, why: 'Le parcours exhaustif devient impraticable, et un identifiant fuit toujours quelque part — un courriel transféré, une capture d’écran, un journal partagé.' },
      { label: 'Alerter sur les accès dont le tenant ne correspond pas', points: 10, why: 'Ne bloque rien et raccourcit beaucoup le temps de découverte, qui est ici le vrai problème : trois mois de lecture silencieuse.' },
      { label: 'Désactiver TLS 1.0 sur l’ancien domaine et rediriger', points: 0, why: 'Une dette de configuration à solder pour la conformité. La chaîne ne dépend d’aucune interception : elle utilise un compte parfaitement légitime.' },
    ],
  },
  {
    id: 'reset-host-header',
    level: 1,
    theme: 'identite',
    goal: 'Voler le lien de réinitialisation de mot de passe d’une victime',
    story: 'Deux findings « faible » sur le parcours « mot de passe oublié ».',
    stones: [
      { id: 'a', label: 'Le lien de réinitialisation reprend l’en-tête Host de la requête', sev: 'faible', inChain: true },
      { id: 'b', label: 'La réinitialisation peut être déclenchée pour n’importe quelle adresse connue', sev: 'faible', inChain: true },
      { id: 'c', label: 'Bannière de version du serveur web visible', sev: 'info', inChain: false },
      { id: 'd', label: 'Formulaire de contact sans anti-robot', sev: 'faible', inChain: false },
      { id: 'e', label: 'Favicon par défaut du framework', sev: 'info', inChain: false },
      { id: 'f', label: 'Politique de mots de passe à 8 caractères', sev: 'moyen', inChain: false },
    ],
    chainOrder: ['b', 'a'],
    chainStory: 'On déclenche une réinitialisation pour l’adresse de la victime en forgeant l’en-tête Host vers un domaine contrôlé. Le courriel légitime contient un lien qui pointe vers ce domaine : dès que la victime clique, le jeton part chez l’attaquant.',
    fixes: [
      { label: 'Construire le lien depuis une URL de base fixée en configuration', points: 40, why: 'La requête ne décide plus du domaine du lien : toutes les pages qui envoient une URL par courriel deviennent insensibles à l’en-tête Host, découvertes ou non.' },
      { label: 'Rejeter les requêtes dont l’en-tête Host n’est pas sur une liste blanche', points: 20, why: 'Ferme le vecteur, et il faut penser à X-Forwarded-Host, aux variantes de casse et à chaque nouveau domaine légitime : une liste à tenir.' },
      { label: 'Réduire la durée de validité du jeton de réinitialisation', points: 10, why: 'La fenêtre se rétrécit, mais le lien part toujours vers le domaine de l’attaquant : une victime qui clique dans la minute suffit.' },
      { label: 'Ajouter une protection anti-robot sur le formulaire de contact', points: 0, why: 'Une mesure anti-spam raisonnable, sur un formulaire que la chaîne n’emprunte jamais : elle passe par la réinitialisation, pas par le contact.' },
    ],
  },
  {
    id: 'jwt-alg-none',
    level: 1,
    theme: 'identite',
    goal: 'Se faire passer pour n’importe quel utilisateur de l’API',
    story: 'L’API accepte des jetons JWT. Deux remarques « faible » traînent dans le rapport.',
    stones: [
      { id: 'a', label: 'La vérification accepte l’algorithme « none » (jeton non signé)', sev: 'faible', inChain: true },
      { id: 'b', label: 'L’identité vient d’une revendication du jeton, sans autre contrôle', sev: 'faible', inChain: true },
      { id: 'c', label: 'CORS restreint au seul domaine applicatif', sev: 'info', inChain: false },
      { id: 'd', label: 'Les jetons n’ont pas de date d’expiration', sev: 'moyen', inChain: false },
      { id: 'e', label: 'La clé publique est exposée sur /.well-known/jwks.json', sev: 'info', inChain: false },
      { id: 'f', label: 'Pas d’en-têtes de sécurité sur le point de santé', sev: 'info', inChain: false },
    ],
    chainOrder: ['a', 'b'],
    chainStory: 'On forge un jeton sans signature, en-tête alg=none, avec la revendication d’identité voulue. La vérification l’accepte, et l’application lit l’identité directement dans le jeton : on devient l’utilisateur de son choix.',
    fixes: [
      { label: 'Imposer côté serveur l’algorithme de signature attendu', points: 40, why: 'Un jeton non signé est refusé quelle que soit la route : la classe entière « alg=none » disparaît, y compris sur les endpoints qu’on ajoutera demain.' },
      { label: 'Dériver l’identité d’une session serveur, pas du jeton seul', points: 20, why: 'Cette chaîne se coupe, car le jeton ne fait plus foi. La vérification laxiste reste, et servira une autre attaque tant qu’elle n’est pas corrigée.' },
      { label: 'Réduire la durée de vie des jetons à quinze minutes', points: 10, why: 'Une bonne pratique, mais un jeton forgé peut porter la durée qu’il veut : l’expiration ne défend rien contre une signature qu’on ne vérifie pas.' },
      { label: 'Ajouter les en-têtes de sécurité au point de santé', points: 0, why: 'De l’hygiène sur une route qui ne renvoie rien de sensible : sans rapport avec la vérification des jetons.' },
    ],
  },
  {
    id: 's3-public-list',
    level: 1,
    theme: 'multi-tenant',
    goal: 'Télécharger les factures de tous les clients',
    story: 'Deux findings sur le bucket qui héberge les exports PDF.',
    stones: [
      { id: 'a', label: 'Le bucket autorise GetObject en public (ACL public-read héritée)', sev: 'faible', inChain: true },
      { id: 'b', label: 'Le bucket autorise aussi ListBucket en public', sev: 'faible', inChain: true },
      { id: 'c', label: 'Chiffrement SSE-S3 au lieu d’une clé gérée par l’équipe', sev: 'faible', inChain: false },
      { id: 'd', label: 'Versioning désactivé sur le bucket', sev: 'info', inChain: false },
      { id: 'e', label: 'Journalisation des accès S3 désactivée', sev: 'faible', inChain: false },
      { id: 'f', label: 'Nom du bucket devinable (novafact-exports)', sev: 'info', inChain: false },
    ],
    chainOrder: ['b', 'a'],
    chainStory: 'La liste publique révèle toutes les clés d’objets, la lecture publique les télécharge. Aucune authentification, aucun identifiant à deviner : un seul appel liste, un second lit.',
    fixes: [
      { label: 'Activer Block Public Access au niveau du compte', points: 40, why: 'Aucun bucket du compte ne peut plus être exposé, même par une ACL réintroduite par erreur : la garde est en amont de chaque bucket.' },
      { label: 'Retirer les ACL publiques du bucket et de ses objets', points: 20, why: 'Ferme ce bucket-ci. La dérive de configuration le rouvrira à la prochaine copie d’objet qui hérite d’une ACL trop large.' },
      { label: 'Renommer le bucket avec un suffixe aléatoire', points: 10, why: 'Rend le nom difficile à deviner, mais la liste publique le donne de toute façon : l’obscurité ne remplace pas le contrôle d’accès.' },
      { label: 'Chiffrer le bucket avec une clé gérée par l’équipe', points: 0, why: 'Le chiffrement au repos protège d’un vol de disque, pas d’une lecture publiquement autorisée : la donnée est servie déchiffrée.' },
    ],
  },
  {
    id: 'exposed-admin',
    level: 1,
    theme: 'web',
    goal: 'Obtenir un accès d’administration au tableau de bord interne',
    story: 'Un outil d’exploitation interne, et deux remarques « faible ».',
    stones: [
      { id: 'a', label: 'Le tableau de bord d’administration est joignable depuis Internet', sev: 'faible', inChain: true },
      { id: 'b', label: 'Il conserve le compte par défaut livré avec l’outil', sev: 'faible', inChain: true },
      { id: 'c', label: 'Le tableau de bord charge une bibliothèque JS depuis un CDN', sev: 'info', inChain: false },
      { id: 'd', label: 'Session sans délai d’inactivité', sev: 'faible', inChain: false },
      { id: 'e', label: 'Logo de l’ancienne marque encore affiché', sev: 'info', inChain: false },
      { id: 'f', label: 'HTTP redirige vers HTTPS en 302 au lieu de 301', sev: 'info', inChain: false },
    ],
    chainOrder: ['a', 'b'],
    chainStory: 'Un outil interne exposé sur Internet, avec le couple identifiant/mot de passe par défaut de l’éditeur : il suffit de connaître le produit pour entrer. Deux réglages « faible » ouvrent une porte d’administration.',
    fixes: [
      { label: 'Rendre l’outil accessible uniquement depuis le réseau interne', points: 40, why: 'Toute la famille « outil d’administration exposé » disparaît : la surface d’attaque n’est plus sur Internet, quel que soit l’état des comptes.' },
      { label: 'Supprimer le compte par défaut et imposer un mot de passe fort', points: 20, why: 'Ferme cet accès précis. Le prochain outil déployé arrivera avec ses propres identifiants d’usine, et la question se reposera.' },
      { label: 'Ajouter un délai d’expiration de session sur le tableau de bord', points: 10, why: 'Limite une session laissée ouverte, sans rien changer à une porte d’entrée gardée par un mot de passe connu de tous.' },
      { label: 'Auto-héberger la bibliothèque JS au lieu du CDN', points: 0, why: 'Une amélioration de la maîtrise des dépendances front, sans rapport avec un accès obtenu par identifiants par défaut.' },
    ],
  },
  {
    id: 'idor-support-tickets',
    level: 1,
    theme: 'multi-tenant',
    goal: 'Lire les tickets d’assistance des autres clients',
    story: 'Deux findings « info » et « faible » sur l’espace d’assistance.',
    avoid: ['cross-tenant-invoices'],
    stones: [
      { id: 'a', label: 'GET /tickets/:id ne vérifie que l’authentification, pas le propriétaire', sev: 'faible', inChain: true },
      { id: 'b', label: 'Les identifiants de ticket sont des entiers croissants', sev: 'info', inChain: true },
      { id: 'c', label: 'Les pièces jointes sont servies en Content-Disposition: inline', sev: 'faible', inChain: false },
      { id: 'd', label: 'Absence d’en-tête X-Content-Type-Options', sev: 'info', inChain: false },
      { id: 'e', label: 'Le champ de recherche renvoie une erreur sur les accents', sev: 'info', inChain: false },
      { id: 'f', label: 'Les tickets clos sont conservés cinq ans', sev: 'faible', inChain: false },
    ],
    chainOrder: ['b', 'a'],
    chainStory: 'Les numéros de ticket se suivent, et la route ne vérifie pas qui possède le ticket demandé : un compte quelconque incrémente l’identifiant et lit l’assistance de toute la clientèle.',
    fixes: [
      { label: 'Contrôler le propriétaire dans la couche d’accès aux données', points: 40, why: 'Toute lecture porte désormais l’identité de son demandeur, y compris sur les routes futures : la BOLA n’est plus écrivable par oubli.' },
      { label: 'Vérifier le propriétaire du ticket dans le contrôleur', points: 20, why: 'Corrige cette route. Chaque nouvel endpoint qui touche aux tickets devra répéter le contrôle, et l’un finira par l’oublier.' },
      { label: 'Remplacer les identifiants croissants par des UUID', points: 10, why: 'L’énumération devient impraticable, mais un identifiant transmis ou capté reste lisible par n’importe quel compte : l’autorisation manque toujours.' },
      { label: 'Servir les pièces jointes en Content-Disposition: attachment', points: 0, why: 'Réduit le risque d’exécution d’un fichier dans le navigateur, sans toucher à la lecture non autorisée des tickets eux-mêmes.' },
    ],
  },
  {
    id: 'mass-assignment-role',
    level: 1,
    theme: 'web',
    goal: 'Se promouvoir administrateur de son organisation',
    story: 'Deux findings « faible » sur la mise à jour de profil.',
    stones: [
      { id: 'a', label: 'PATCH /me lie tout le corps JSON au modèle utilisateur', sev: 'faible', inChain: true },
      { id: 'b', label: 'Le champ role est un attribut du même modèle utilisateur', sev: 'faible', inChain: true },
      { id: 'c', label: 'Les mots de passe sont hachés avec bcrypt (coût 10)', sev: 'info', inChain: false },
      { id: 'd', label: 'Pas de journal sur les changements de rôle', sev: 'faible', inChain: false },
      { id: 'e', label: 'Avatar téléversé sans limite de taille', sev: 'faible', inChain: false },
      { id: 'f', label: 'Adresse non vérifiée à l’inscription', sev: 'faible', inChain: false },
    ],
    chainOrder: ['a', 'b'],
    chainStory: 'La mise à jour de profil recopie tout le JSON reçu dans le modèle, et ce modèle porte le champ role : on envoie {"role":"admin"} au milieu de la modification de son nom, et on se promeut.',
    fixes: [
      { label: 'Ne lier qu’une liste blanche de champs autorisés', points: 40, why: 'Le mass assignment disparaît de toutes les routes qui adoptent la règle : un champ non listé n’est jamais écrit, role compris comme les suivants.' },
      { label: 'Refuser toute modification du champ role hors flux dédié', points: 20, why: 'Protège role précisément. Le prochain champ sensible ajouté au modèle — plafond de crédit, statut — repartira exposé.' },
      { label: 'Exiger une revalidation du mot de passe pour changer de rôle', points: 10, why: 'Ajoute une friction si le changement passait par le flux prévu ; ici l’écriture est un effet de bord de PATCH /me, qui ne la déclenche pas.' },
      { label: 'Journaliser tous les changements de rôle', points: 0, why: 'Aide à repérer l’abus après coup, sans l’empêcher : la promotion a déjà eu lieu quand la ligne de journal s’écrit.' },
    ],
  },

  // ── N2 ────────────────────────────────────────────────────────────────────
  {
    id: 'stored-xss',
    level: 2,
    theme: 'web',
    goal: 'Déclencher une XSS stockée chez une victime',
    story: 'Aucune XSS classée plus que « faible » dans le backlog. Est-ce vraiment rassurant ?',
    stones: [
      { id: 'a', label: 'Self-XSS dans le champ « notes » du profil', sev: 'faible', inChain: true },
      { id: 'b', label: 'Pas de protection CSRF sur PATCH /me/notes', sev: 'faible', inChain: true },
      { id: 'c', label: 'Cookie de session en SameSite=None', sev: 'faible', inChain: true },
      { id: 'd', label: 'HSTS absent sur staging', sev: 'faible', inChain: false },
      { id: 'e', label: 'Énumération d’e-mails à l’inscription', sev: 'moyen', inChain: false },
      { id: 'f', label: 'Version de nginx visible dans les erreurs', sev: 'info', inChain: false },
    ],
    chainOrder: ['c', 'b', 'a'],
    chainStory: 'Le cookie part sur les requêtes inter-sites, la mise à jour des notes n’exige aucun jeton : un site tiers écrit une charge dans les notes de la victime, qui s’exécute à son prochain affichage. La self-XSS devient une XSS stockée.',
    fixes: [
      { label: 'Échapper la sortie du champ notes au rendu, côté serveur', points: 40, why: 'Sans charge utile exécutable, la chaîne n’a plus de dernier maillon — et les autres chemins d’écriture vers ce champ, présents ou futurs, deviennent inoffensifs.' },
      { label: 'Exiger un jeton anti-CSRF ou Fetch Metadata sur les écritures', points: 20, why: 'Casse cette chaîne et protège toutes les routes d’écriture, ce qui en fait presque un contrôle de classe. L’injection, elle, reste atteignable autrement.' },
      { label: 'Repasser le cookie de session en SameSite=Lax', points: 20, why: 'L’écriture inter-site devient impossible depuis un site tiers. Une intégration qui a besoin de SameSite=None réintroduira la question dans six mois.' },
      { label: 'Activer HSTS sur l’environnement de recette', points: 0, why: 'Une lacune de configuration qui mérite son ticket, et la chaîne n’emprunte aucun canal en clair : elle se déroule entièrement en HTTPS.' },
    ],
  },
  {
    id: 's3-exfil',
    level: 2,
    theme: 'cloud',
    goal: 'Exfiltrer les factures stockées dans S3',
    story: 'Le service de génération de PDF importe les logos des clients à partir d’une URL.',
    real: 'Capital One, 2019',
    stones: [
      { id: 'a', label: 'Filtre SSRF de l’import de logo qui ne revalide pas les redirections', sev: 'moyen', inChain: true },
      { id: 'b', label: 'IMDSv1 encore accepté sur les instances du service PDF', sev: 'faible', inChain: true },
      { id: 'c', label: 'Rôle IAM du service PDF avec s3:* sur tous les buckets', sev: 'moyen', inChain: true },
      { id: 'd', label: 'Pas de limite de débit sur /login', sev: 'moyen', inChain: false },
      { id: 'e', label: 'Cookie sans Secure en environnement de développement', sev: 'faible', inChain: false },
      { id: 'f', label: 'Dépendance de dev avec une CVE non atteignable', sev: 'faible', inChain: false },
    ],
    chainOrder: ['a', 'b', 'c'],
    chainStory: 'Une URL externe redirige vers l’endpoint de métadonnées, qui répond sans jeton (IMDSv1) avec les identifiants du rôle ; le rôle, trop large, lit tous les buckets. C’est, en résumé, l’incident Capital One de 2019.',
    fixes: [
      { label: 'Rendre IMDSv2 obligatoire sur l’ensemble des instances', points: 40, why: 'Toute la famille « SSRF vers identifiants cloud » tombe d’un coup, y compris pour les SSRF que personne n’a encore trouvées : la requête simple ne suffit plus.' },
      { label: 'Revalider la destination à chaque redirection dans le filtre', points: 20, why: 'Ferme le contournement utilisé ici, et le filtre reste une liste de règles à maintenir : DNS rebinding, encodages exotiques, adresses IPv6 mappées.' },
      { label: 'Restreindre le rôle du service au seul bucket des logos', points: 20, why: 'Les identifiants restent volables et ne valent presque plus rien : c’est la réduction de rayon d’action, la deuxième meilleure réponse de la liste.' },
      { label: 'Poser une limite de débit sur la route d’authentification', points: 0, why: 'Indispensable contre le bourrage d’identifiants, et sans rapport : la chaîne n’essaie aucun mot de passe, elle emprunte un rôle déjà authentifié.' },
    ],
  },
  {
    id: 'double-refund',
    level: 2,
    theme: 'paiement',
    goal: 'Se faire rembourser deux fois la même facture',
    story: 'Trois findings « faible » sur le parcours de paiement, aucun jugé bloquant.',
    stones: [
      { id: 'a', label: 'Aucune clé d’idempotence sur POST /refunds', sev: 'faible', inChain: true },
      { id: 'b', label: 'Le montant du remboursement vient du corps de la requête', sev: 'moyen', inChain: true },
      { id: 'c', label: 'Le statut « remboursée » est écrit après l’appel au prestataire', sev: 'faible', inChain: true },
      { id: 'd', label: 'Les montants s’affichent sans séparateur de milliers', sev: 'info', inChain: false },
      { id: 'e', label: 'Le justificatif PDF n’est pas signé', sev: 'faible', inChain: false },
      { id: 'f', label: 'Le webhook du prestataire n’est pas journalisé', sev: 'faible', inChain: false },
    ],
    chainOrder: ['b', 'a', 'c'],
    chainStory: 'Le montant est choisi par le client, aucune clé ne déduplique la demande, et le statut n’est écrit qu’après le virement : deux requêtes simultanées obtiennent deux remboursements, pour un montant que personne ne recalcule.',
    fixes: [
      { label: 'Recalculer le montant côté serveur à partir de la facture', points: 40, why: 'Le paramètre le plus dangereux disparaît du contrat de l’API. Même remboursé deux fois, le client ne reçoit jamais plus que ce qu’il a payé.' },
      { label: 'Exiger une clé d’idempotence enregistrée sous contrainte unique', points: 20, why: 'Le doublon devient impossible, ici et sur toutes les routes qui l’adoptent. Le montant reste choisi par le client, donc un seul remboursement peut suffire.' },
      { label: 'Écrire le statut avant l’appel, dans la même transaction', points: 20, why: 'La fenêtre entre la vérification et l’écriture se referme. Il faut alors gérer proprement l’échec du prestataire, ce qui déplace une partie du travail.' },
      { label: 'Journaliser et vérifier la signature des webhooks entrants', points: 0, why: 'Un manque réel, qui laisse aujourd’hui n’importe qui déclarer un paiement. Ce n’est simplement pas le chemin emprunté ici : la chaîne part de l’API cliente.' },
    ],
  },
  {
    id: 'prod-db',
    level: 2,
    theme: 'cloud',
    goal: 'Atteindre la base de production depuis Internet',
    story: 'Le rapport d’audit cloud ne contient que des findings « faible » et « moyen ».',
    stones: [
      { id: 'a', label: 'Console de débogage exposée sur le service de rapports', sev: 'moyen', inChain: true },
      { id: 'b', label: 'Groupe de sécurité de la base ouvert à tout le VPC', sev: 'moyen', inChain: true },
      { id: 'c', label: 'Mot de passe de la base dans une variable d’environnement', sev: 'faible', inChain: true },
      { id: 'd', label: 'Chiffrement des sauvegardes avec la clé gérée par AWS', sev: 'faible', inChain: false },
      { id: 'e', label: 'Journaux de la base conservés trente jours seulement', sev: 'faible', inChain: false },
      { id: 'f', label: 'Balises de coût absentes sur plusieurs ressources', sev: 'info', inChain: false },
    ],
    chainOrder: ['a', 'c', 'b'],
    chainStory: 'La console de débogage donne l’exécution de code dans le service de rapports ; les variables d’environnement livrent le mot de passe ; le groupe de sécurité laisse n’importe quelle ressource du VPC ouvrir une connexion. Trois « moyen » font un accès complet.',
    fixes: [
      { label: 'Segmenter : seul le groupe applicatif atteint le port de la base', points: 40, why: 'Toute chaîne qui passe par un rebond interne se brise, y compris celles qui partiront d’un service qui n’existe pas encore. Le VPC cesse d’être une zone de confiance.' },
      { label: 'Retirer la console de débogage des images de production', points: 20, why: 'Le premier maillon disparaît, et il en repoussera : une page de profilage, un point d’entrée de santé trop bavard, une bibliothèque qui expose ses métriques.' },
      { label: 'Passer à l’authentification IAM, sans mot de passe stocké', points: 20, why: 'Il n’y a plus de secret dans l’environnement du processus, donc plus rien à lire. L’exécution de code dans le service reste entière.' },
      { label: 'Chiffrer les sauvegardes avec une clé KMS gérée par l’équipe', points: 0, why: 'Une amélioration réelle de la maîtrise des clés, souvent exigée en audit. Elle ne croise pas cette chaîne, qui lit la base vivante et non ses sauvegardes.' },
    ],
  },
  {
    id: 'tenant-admin-takeover',
    level: 2,
    theme: 'identite',
    goal: 'Usurper un administrateur de tenant',
    story: 'Le parcours d’assistance a été audité l’an dernier : deux findings « faible » subsistent.',
    stones: [
      { id: 'a', label: 'Le support peut déclencher un renvoi de lien de connexion', sev: 'faible', inChain: true },
      { id: 'b', label: 'Le changement d’adresse ne notifie pas l’ancienne adresse', sev: 'faible', inChain: true },
      { id: 'c', label: 'Le rôle support n’est pas soumis au second facteur', sev: 'moyen', inChain: true },
      { id: 'd', label: 'Les tickets d’assistance sont conservés cinq ans', sev: 'faible', inChain: false },
      { id: 'e', label: 'La page d’aide charge une police depuis un CDN', sev: 'info', inChain: false },
      { id: 'f', label: 'Les exports de tickets ne sont pas chiffrés au repos', sev: 'faible', inChain: false },
    ],
    chainOrder: ['c', 'a', 'b'],
    chainStory: 'Un compte support sans second facteur se prend par bourrage d’identifiants ; il change l’adresse d’un administrateur sans que personne ne soit prévenu, puis déclenche le renvoi du lien de connexion vers la nouvelle adresse.',
    fixes: [
      { label: 'Imposer le second facteur à tous les rôles internes', points: 40, why: 'La première marche disparaît pour toutes les chaînes qui commencent par un compte interne — et elles commencent presque toutes là.' },
      { label: 'Notifier l’ancienne adresse, avec un lien d’annulation immédiat', points: 20, why: 'Le propriétaire reprend la main en quelques secondes, à condition qu’il lise ses courriels. La nuit ou le week-end, la fenêtre reste ouverte.' },
      { label: 'Exiger le consentement du client pour toute action du support', points: 20, why: 'L’action devient un acte tracé et accepté, ce qui règle cette chaîne et beaucoup d’autres. Le support perdra en autonomie sur les cas où le client ne répond pas.' },
      { label: 'Chiffrer les exports de tickets et en limiter la conservation', points: 0, why: 'Une exigence de protection des données parfaitement fondée, et la chaîne ne touche aux tickets à aucun moment : elle passe par le compte, pas par les données.' },
    ],
  },
  {
    id: 'payment-session-theft',
    level: 2,
    theme: 'paiement',
    goal: 'Voler les sessions des visiteurs de la page de paiement',
    story: 'La page de paiement a été jugée conforme : aucun finding au-dessus de « faible ».',
    stones: [
      { id: 'a', label: 'CSP en Report-Only depuis dix-huit mois', sev: 'faible', inChain: true },
      { id: 'b', label: 'Tag manager chargé sur la page de paiement', sev: 'faible', inChain: true },
      { id: 'c', label: 'Cookie de session accessible au JavaScript', sev: 'moyen', inChain: true },
      { id: 'd', label: 'Le favicon est servi sans en-tête de cache', sev: 'info', inChain: false },
      { id: 'e', label: 'Les images produits ne sont pas en WebP', sev: 'info', inChain: false },
      { id: 'f', label: 'Le formulaire n’a pas d’attribut autocomplete', sev: 'faible', inChain: false },
    ],
    chainOrder: ['b', 'a', 'c'],
    chainStory: 'Un conteneur de tags tiers exécute du script sur la page qui touche à la carte bancaire ; la CSP observe sans bloquer ; le cookie de session est lisible par ce script. Un compte marketing compromis suffit à équiper un skimmer.',
    fixes: [
      { label: 'Poser HttpOnly sur le cookie de session, partout', points: 40, why: 'Le vol de session par script devient impossible sur toute l’application, y compris pour les XSS qu’on n’a pas trouvées. Une ligne de configuration, une classe entière.' },
      { label: 'Sortir le conteneur de tags de la page de paiement', points: 20, why: 'La page qui manipule la carte redevient minimale, ce qui est le bon état pour elle. Le reste du site continue d’exécuter du script tiers, avec le même risque.' },
      { label: 'Passer la CSP en mode bloquant après mesure des rapports', points: 20, why: 'Dix-huit mois de rapports suffisent largement à basculer sans casse. L’exercice est réel, et une CSP mal calibrée sera désactivée à la première incompréhension.' },
      { label: 'Ajouter les attributs autocomplete attendus sur le formulaire', points: 0, why: 'Une amélioration d’ergonomie et d’accessibilité, à faire. Elle n’a aucune incidence sur du script déjà exécuté dans la page.' },
    ],
  },
  {
    id: 'webhook-ssrf',
    level: 2,
    theme: 'cloud',
    goal: 'Joindre un service interne d’administration depuis l’extérieur',
    story: 'Novafact envoie des webhooks vers une URL choisie par le client. Trois findings « faible » et « moyen ».',
    stones: [
      { id: 'a', label: 'Le filtre d’URL de webhook ne contrôle que l’adresse initiale', sev: 'moyen', inChain: true },
      { id: 'b', label: 'Le service émetteur suit les redirections HTTP', sev: 'faible', inChain: true },
      { id: 'c', label: 'Un service interne d’administration répond sans authentification', sev: 'moyen', inChain: true },
      { id: 'd', label: 'Le corps du webhook n’est pas signé (HMAC absent)', sev: 'faible', inChain: false },
      { id: 'e', label: 'Le secret du webhook est visible dans l’interface', sev: 'faible', inChain: false },
      { id: 'f', label: 'Pas de limite au nombre de webhooks créés', sev: 'faible', inChain: false },
    ],
    chainOrder: ['a', 'b', 'c'],
    chainStory: 'On déclare une URL publique acceptée par le filtre, qui répond par une redirection vers l’adresse de métadonnées ou un service interne ; l’émetteur suit la redirection sans revalider, et le service interne répond sans authentification.',
    fixes: [
      { label: 'Router les webhooks sortants par un proxy à liste blanche', points: 40, why: 'Le trafic sortant ne peut plus viser une adresse interne, quel que soit le jeu de redirections : la classe SSRF disparaît pour tous les appels sortants du service.' },
      { label: 'Revalider la destination après chaque redirection', points: 20, why: 'Ferme le contournement par redirection. Le filtre reste une liste de cas à couvrir : rebinding DNS, encodages, IPv6 mappées.' },
      { label: 'Exiger l’authentification sur le service interne d’administration', points: 10, why: 'Une défense en profondeur utile, mais la SSRF atteindra d’autres services internes moins gardés : elle ne dépend pas de cette cible précise.' },
      { label: 'Signer le corps des webhooks avec un HMAC partagé', points: 0, why: 'Garantit l’intégrité des messages livrés au client, un vrai manque — sans aucun effet sur la destination que l’émetteur va joindre.' },
    ],
  },
  {
    id: 'upload-svg-xss',
    level: 2,
    theme: 'web',
    goal: 'Exécuter du script chez un autre utilisateur via un fichier téléversé',
    story: 'Les clients téléversent le logo de leur entreprise. Trois findings « faible ».',
    stones: [
      { id: 'a', label: 'Le type du fichier est déduit de l’extension fournie', sev: 'faible', inChain: true },
      { id: 'b', label: 'Les fichiers sont servis depuis le domaine de l’application', sev: 'faible', inChain: true },
      { id: 'c', label: 'Un SVG peut porter du script exécuté à l’affichage', sev: 'faible', inChain: true },
      { id: 'd', label: 'Pas de limite de taille sur le téléversement', sev: 'faible', inChain: false },
      { id: 'e', label: 'Le nom de fichier d’origine n’est pas assaini', sev: 'faible', inChain: false },
      { id: 'f', label: 'Aucun antivirus branché sur les téléversements', sev: 'faible', inChain: false },
    ],
    chainOrder: ['a', 'c', 'b'],
    chainStory: 'On téléverse un SVG contenant un script, accepté parce que son extension le fait passer pour une image ; servi depuis le domaine de l’application, il s’exécute dans son origine dès qu’un autre utilisateur l’affiche.',
    fixes: [
      { label: 'Servir les fichiers téléversés depuis un domaine isolé sans cookies', points: 40, why: 'Un fichier hostile s’exécute alors dans une origine vide, sans session ni accès à l’application : toute la classe « XSS par téléversement » tombe.' },
      { label: 'Vérifier le type réel du fichier et refuser le SVG', points: 20, why: 'Ferme ce vecteur en contrôlant le contenu et non l’extension. D’autres formats — HTML, certains PDF — restent à surveiller un par un.' },
      { label: 'Renvoyer les fichiers en Content-Disposition: attachment', points: 10, why: 'Force le téléchargement plutôt que le rendu, ce qui neutralise le SVG affiché en ligne. Un lien direct partagé peut encore être ouvert et interprété.' },
      { label: 'Brancher un antivirus sur les fichiers téléversés', points: 0, why: 'Attrape des logiciels malveillants connus, pas un SVG scriptant l’origine : la signature d’un tel fichier n’a rien de suspect pour un antivirus.' },
    ],
  },
  {
    id: 'session-fixation',
    level: 2,
    theme: 'identite',
    goal: 'Détourner la session d’un utilisateur au moment où il se connecte',
    story: 'Trois findings « faible » sur la gestion des sessions.',
    stones: [
      { id: 'a', label: 'La session est acceptée depuis un paramètre d’URL', sev: 'faible', inChain: true },
      { id: 'b', label: 'Un identifiant de session est émis avant l’authentification', sev: 'faible', inChain: true },
      { id: 'c', label: 'Cet identifiant n’est pas régénéré une fois connecté', sev: 'faible', inChain: true },
      { id: 'd', label: 'Le cookie de session n’a pas l’attribut Secure', sev: 'faible', inChain: false },
      { id: 'e', label: 'Pas de déconnexion automatique après inactivité', sev: 'faible', inChain: false },
      { id: 'f', label: 'Le message d’erreur distingue e-mail inconnu et mot de passe faux', sev: 'faible', inChain: false },
    ],
    chainOrder: ['b', 'a', 'c'],
    chainStory: 'On récupère un identifiant émis avant connexion, on le fixe chez la victime par un lien qui le porte dans l’URL ; elle se connecte, l’identifiant n’est pas renouvelé, et il vaut désormais pour un compte authentifié.',
    fixes: [
      { label: 'Régénérer l’identifiant de session à chaque authentification', points: 40, why: 'Un identifiant fixé avant connexion ne vaut plus rien après : la fixation cesse d’être exploitable, quel que soit le canal qui a servi à le poser.' },
      { label: 'N’accepter l’identifiant de session que depuis un cookie', points: 20, why: 'Supprime le vecteur d’URL, le plus commode pour poser l’identifiant. Il reste des moyens de le fixer si l’identifiant survit à la connexion.' },
      { label: 'Poser Secure et HttpOnly sur le cookie de session', points: 10, why: 'Bon durcissement contre l’interception et le vol par script, sans effet sur un identifiant que l’attaquant a lui-même choisi et transmis.' },
      { label: 'Uniformiser le message d’erreur de connexion', points: 0, why: 'Réduit l’énumération de comptes, un autre problème : la fixation n’a besoin de deviner ni l’e-mail ni le mot de passe de la victime.' },
    ],
  },
  {
    id: 'coupon-race',
    level: 2,
    theme: 'paiement',
    goal: 'Utiliser plusieurs fois un code promotionnel à usage unique',
    story: 'Trois findings « faible » sur l’application des remises.',
    stones: [
      { id: 'a', label: 'Le contrôle « code déjà utilisé ? » et le débit sont deux requêtes séparées', sev: 'faible', inChain: true },
      { id: 'b', label: 'Ces deux requêtes ne sont pas dans une transaction', sev: 'faible', inChain: true },
      { id: 'c', label: 'L’endpoint accepte des appels concurrents sans limite', sev: 'faible', inChain: true },
      { id: 'd', label: 'Le montant de la remise n’est pas plafonné dans l’interface', sev: 'info', inChain: false },
      { id: 'e', label: 'Les codes promo sont des mots lisibles (SOLDES2026)', sev: 'faible', inChain: false },
      { id: 'f', label: 'Pas d’e-mail de confirmation d’usage du code', sev: 'faible', inChain: false },
    ],
    chainOrder: ['a', 'b', 'c'],
    chainStory: 'Le code est lu comme « disponible », puis débité en deux temps, sans transaction ni verrou : on envoie une rafale d’appels simultanés, chacun voit le code encore libre, et tous obtiennent la remise avant le premier marquage.',
    fixes: [
      { label: 'Consommer le code par une écriture atomique unique', points: 40, why: 'Une seule opération vérifie et marque : la fenêtre de concurrence n’existe plus, ici comme sur toute route qui adopte ce marquage atomique.' },
      { label: 'Enfermer vérification et débit dans une seule transaction', points: 20, why: 'Referme cette course précise. Selon le niveau d’isolation, deux transactions concurrentes peuvent encore lire le même état de départ.' },
      { label: 'Limiter le débit de l’endpoint d’application du code', points: 10, why: 'Réduit la taille de la rafale, sans supprimer la course : quelques requêtes parallèles suffisent souvent à la gagner.' },
      { label: 'Remplacer les codes lisibles par des chaînes aléatoires', points: 0, why: 'Empêche de deviner un code, un autre sujet : la chaîne réutilise un code que le client possède déjà légitimement.' },
    ],
  },
  {
    id: 'cache-poisoning',
    level: 2,
    theme: 'web',
    goal: 'Servir un script piégé à tous les visiteurs d’une page',
    story: 'Trois findings « faible » sur la mise en cache par le CDN.',
    stones: [
      { id: 'a', label: 'Une réponse reflète l’en-tête X-Forwarded-Host dans un lien absolu', sev: 'faible', inChain: true },
      { id: 'b', label: 'Le CDN met la réponse en cache sans inclure cet en-tête dans la clé', sev: 'faible', inChain: true },
      { id: 'c', label: 'Le lien reflété sert à charger un script de la page', sev: 'faible', inChain: true },
      { id: 'd', label: 'Le cache conserve les réponses trente jours', sev: 'faible', inChain: false },
      { id: 'e', label: 'Pas d’en-tête Vary sur Accept-Encoding', sev: 'info', inChain: false },
      { id: 'f', label: 'Les réponses d’erreur 500 sont mises en cache', sev: 'faible', inChain: false },
    ],
    chainOrder: ['a', 'b', 'c'],
    chainStory: 'Une requête au bon en-tête X-Forwarded-Host obtient une réponse qui reflète ce domaine dans la source d’un script ; le CDN la met en cache sans distinguer l’en-tête, puis la sert à tous : chacun charge le script depuis le domaine de l’attaquant.',
    fixes: [
      { label: 'Ne jamais refléter un en-tête de requête dans une réponse en cache', points: 40, why: 'Sans donnée d’attaquant dans le corps mis en cache, l’empoisonnement n’a plus de matière : la classe entière disparaît, quels que soient les en-têtes.' },
      { label: 'Inclure chaque en-tête reflété dans la clé de cache du CDN', points: 20, why: 'Isole la réponse empoisonnée du cache commun. Toute nouvelle entrée reflétée, oubliée dans la clé, rouvre le même trou.' },
      { label: 'Réduire fortement la durée de vie du cache', points: 10, why: 'Raccourcit la fenêtre où la page est empoisonnée, sans empêcher l’empoisonnement lui-même : on le rejoue à chaque expiration.' },
      { label: 'Empêcher la mise en cache des réponses 500', points: 0, why: 'Évite qu’une erreur transitoire soit servie à tous, un autre défaut de cache : la chaîne passe par une réponse 200 parfaitement valide.' },
    ],
  },

  // ── N3 ────────────────────────────────────────────────────────────────────
  {
    id: 'npm-publish',
    level: 3,
    theme: 'cicd',
    goal: 'Publier un paquet npm au nom de Novafact',
    story: 'La chaîne de livraison a passé son audit : rien au-dessus de « moyen ».',
    stones: [
      { id: 'a', label: 'Workflow e2e déclenché par pull_request_target', sev: 'moyen', inChain: true },
      { id: 'b', label: 'Titre de la PR interpolé dans une commande run', sev: 'faible', inChain: true },
      { id: 'c', label: 'Jeton npm d’automatisation stocké en secret de dépôt', sev: 'faible', inChain: true },
      { id: 'd', label: 'Badge de couverture de tests obsolète', sev: 'info', inChain: false },
      { id: 'e', label: 'Dépendance de développement dépréciée', sev: 'faible', inChain: false },
      { id: 'f', label: 'Fichier CODEOWNERS incomplet sur /docs', sev: 'info', inChain: false },
    ],
    chainOrder: ['a', 'b', 'c'],
    chainStory: 'Le déclencheur donne au workflow le contexte de la branche cible, donc l’accès aux secrets ; le titre de la pull request devient une commande ; le jeton de publication est dans l’environnement. Un contributeur extérieur publie sous votre nom.',
    fixes: [
      { label: 'Ne jamais interpoler une donnée de la PR dans un bloc run', points: 40, why: 'L’injection disparaît de tous les workflows qui suivent la règle, quel que soit le déclencheur : c’est le contrôle qui ne dépend d’aucune configuration.' },
      { label: 'Remplacer pull_request_target par pull_request pour les tests', points: 20, why: 'Le workflow perd l’accès aux secrets, donc la chaîne se coupe net. Il perdra aussi la capacité de commenter la PR, et quelqu’un voudra le rétablir.' },
      { label: 'Passer au trusted publishing et retirer le jeton du dépôt', points: 20, why: 'Il n’y a plus de secret de longue durée à voler, et l’identité de publication devient liée au workflow. Reste l’injection, qui vise autre chose demain.' },
      { label: 'Compléter le fichier CODEOWNERS sur toute l’arborescence', points: 0, why: 'Une bonne mesure de revue, y compris pour les workflows eux-mêmes — et elle n’intervient pas ici, puisque rien n’est fusionné : tout se passe à l’ouverture de la PR.' },
    ],
  },
  {
    id: 'staging-to-prod',
    level: 3,
    theme: 'cloud',
    goal: 'Passer de la recette à la production',
    story: 'Les environnements sont séparés. Trois findings « faible » sur la recette, classés sans suite.',
    stones: [
      { id: 'a', label: 'La recette est peuplée par une copie de la base de production', sev: 'moyen', inChain: true },
      { id: 'b', label: 'Le rôle des tâches de recette peut lire le magasin de secrets', sev: 'moyen', inChain: true },
      { id: 'c', label: 'Les secrets du magasin ne sont pas cloisonnés par environnement', sev: 'faible', inChain: true },
      { id: 'd', label: 'La recette est accessible sans liste blanche d’adresses', sev: 'faible', inChain: false },
      { id: 'e', label: 'Les journaux de recette ne sont pas centralisés', sev: 'faible', inChain: false },
      { id: 'f', label: 'Le nom de domaine de recette est devinable', sev: 'info', inChain: false },
    ],
    chainOrder: ['a', 'b', 'c'],
    chainStory: 'Un compte réel copié en recette permet de se connecter à un environnement peu surveillé ; le rôle des tâches y lit le magasin de secrets ; et ce magasin ne sépare pas les environnements. La clé d’API de production est dans la recette.',
    fixes: [
      { label: 'Cloisonner les secrets par environnement, sans exception', points: 40, why: 'Aucun chemin partant de la recette ne mène plus à la production, quelle que soit la faille du jour. C’est la frontière que les autres correctifs supposent déjà là.' },
      { label: 'Anonymiser les données lors de la copie vers la recette', points: 20, why: 'Le point d’entrée disparaît, et la copie est aussi une obligation de protection des données. La recette perd en réalisme pour reproduire certains bugs.' },
      { label: 'Retirer au rôle de recette l’accès au magasin de secrets', points: 20, why: 'Le maillon du milieu tombe. Les tâches de recette ont de vrais secrets à lire, donc quelqu’un rouvrira cet accès — et au magasin commun, faute de cloisonnement.' },
      { label: 'Restreindre l’accès à la recette à une liste d’adresses', points: 0, why: 'Une mesure raisonnable, qui réduit l’exposition d’un environnement mal surveillé. Elle ne change rien à une chaîne qui démarre avec des identifiants valides.' },
    ],
  },
  {
    id: 'dependency-confusion',
    level: 3,
    theme: 'cicd',
    goal: 'Exécuter du code dans la CI de Novafact via un faux paquet interne',
    story: 'La chaîne de build a été auditée. Plusieurs findings « faible » et un « moyen ».',
    real: 'Confusion de dépendances, Alex Birsan, 2021',
    stones: [
      { id: 'a', label: 'Le paquet interne @novafact/config n’est pas réservé sur le registre public', sev: 'faible', inChain: true },
      { id: 'b', label: 'Le .npmrc de la CI interroge le registre public en plus du privé', sev: 'faible', inChain: true },
      { id: 'c', label: 'À nom égal, npm retient la version la plus élevée, tous registres confondus', sev: 'faible', inChain: true },
      { id: 'd', label: 'Les scripts d’installation (postinstall) s’exécutent par défaut', sev: 'faible', inChain: true },
      { id: 'e', label: 'Le runner de CI porte des secrets cloud en variables d’environnement', sev: 'moyen', inChain: true },
      { id: 'f', label: 'Journaux de CI conservés trente jours', sev: 'info', inChain: false },
    ],
    chainOrder: ['a', 'b', 'c', 'd', 'e'],
    chainStory: 'On publie sur le registre public un @novafact/config au numéro de version très élevé, avec un postinstall. La CI, qui consulte aussi le registre public, retient cette version parce qu’elle est la plus haute ; le script s’exécute et emporte les secrets cloud du runner.',
    fixes: [
      { label: 'Épingler la portée @novafact au seul registre privé', points: 40, why: 'Un paquet public de même nom n’est plus jamais consulté, quelle que soit sa version : la confusion de dépendances devient impossible pour toute la portée.' },
      { label: 'Réserver les noms de paquets internes sur le registre public', points: 20, why: 'Occupe la place pour les noms d’aujourd’hui. Chaque nouveau paquet interne devra être réservé à son tour, faute de quoi la brèche revient.' },
      { label: 'Désactiver les scripts d’installation en CI (--ignore-scripts)', points: 10, why: 'Retire l’exécution automatique du code téléchargé, mais le mauvais paquet est toujours installé et pourra s’exécuter à l’import ou au build.' },
      { label: 'Réduire la durée de conservation des journaux de CI', points: 0, why: 'Une décision de rétention sans lien : elle ne change ni la résolution des paquets ni ce que le runner détient en secrets.' },
    ],
  },
  {
    id: 'oidc-ci-role',
    level: 3,
    theme: 'cicd',
    goal: 'Assumer un rôle AWS de production depuis un dépôt quelconque',
    story: 'Le passage à OIDC a supprimé les clés d’accès longues. Restent des findings « faible » et « moyen ».',
    stones: [
      { id: 'a', label: 'La condition de confiance vérifie le fournisseur mais pas le sujet (sub)', sev: 'moyen', inChain: true },
      { id: 'b', label: 'La condition sur le dépôt utilise un motif large (repo:novafact/*)', sev: 'faible', inChain: true },
      { id: 'c', label: 'Le rôle porte des permissions étendues sur la production', sev: 'moyen', inChain: true },
      { id: 'd', label: 'N’importe quel membre peut créer un dépôt dans l’organisation', sev: 'faible', inChain: true },
      { id: 'e', label: 'CloudTrail n’est pas centralisé dans un compte de sécurité', sev: 'faible', inChain: false },
      { id: 'f', label: 'Le rôle n’applique pas de balise de session', sev: 'info', inChain: false },
    ],
    chainOrder: ['d', 'b', 'a', 'c'],
    chainStory: 'On crée un dépôt dans l’organisation dont le workflow demande un jeton OIDC. La condition de confiance accepte tout dépôt de l’organisation et ne fixe ni branche ni sujet : le rôle est assumé, et ses permissions de production sont larges.',
    fixes: [
      { label: 'Épingler la confiance du rôle à un dépôt et une branche', points: 40, why: 'Le rôle n’est plus assumable que par le workflow prévu : tous les dépôts de l’organisation, présents ou à venir, perdent l’accès d’un coup.' },
      { label: 'Réduire les permissions du rôle au strict nécessaire de production', points: 20, why: 'Corrige le maillon le plus grave et limite les dégâts, mais n’importe quel dépôt continue d’assumer le rôle : la porte reste ouverte, plus étroite.' },
      { label: 'Exiger un environnement GitHub protégé pour ce workflow', points: 10, why: 'Ajoute une approbation sur le déploiement légitime, sans empêcher un dépôt tiers de réclamer directement le jeton via une condition trop large.' },
      { label: 'Centraliser CloudTrail dans un compte de sécurité', points: 0, why: 'Améliore la détection et l’enquête après coup, sans rien bloquer : l’assomption du rôle reste possible et paraît légitime dans les journaux.' },
    ],
  },
  {
    id: 'prototype-pollution-rce',
    level: 3,
    theme: 'web',
    goal: 'Exécuter du code sur le service de rendu de documents',
    story: 'Findings « faible » et « moyen » sur le service qui fabrique les PDF.',
    real: 'Famille prototype pollution → RCE (ex. lodash, CVE-2019-10744)',
    stones: [
      { id: 'a', label: 'Le service fusionne le JSON reçu dans un objet de configuration', sev: 'faible', inChain: true },
      { id: 'b', label: 'La fusion récursive ne filtre pas les clés __proto__ / constructor', sev: 'faible', inChain: true },
      { id: 'c', label: 'Le moteur de templates lit une option héritée du prototype d’Object', sev: 'faible', inChain: true },
      { id: 'd', label: 'Cette option contrôle un chemin de code exécuté au rendu', sev: 'moyen', inChain: true },
      { id: 'e', label: 'Le service tourne en tant que root dans le conteneur', sev: 'faible', inChain: false },
      { id: 'f', label: 'Pas de limite mémoire sur le conteneur', sev: 'info', inChain: false },
    ],
    chainOrder: ['a', 'b', 'c', 'd'],
    chainStory: 'Le JSON de rendu porte une clé __proto__ ; la fusion récursive la recopie et pollue le prototype d’Object ; le moteur de templates lit alors une option qu’il croit par défaut, et cette option ouvre un chemin d’exécution de code.',
    fixes: [
      { label: 'Rejeter les clés __proto__ et constructor à la fusion', points: 40, why: 'La primitive de pollution disparaît : plus aucune entrée ne peut modifier le prototype, et toutes les fonctionnalités bâties sur cette fusion sont protégées d’un coup.' },
      { label: 'Créer les objets de configuration sans prototype', points: 20, why: 'Prive ce gadget de son point de lecture, mais d’autres objets du service gardent le prototype d’Object standard et restent polluables.' },
      { label: 'Faire tourner le service avec un utilisateur non privilégié', points: 10, why: 'Réduit ce que l’exécution de code peut faire de la machine, sans empêcher la chaîne d’aboutir à l’exécution elle-même.' },
      { label: 'Poser une limite mémoire sur le conteneur', points: 0, why: 'Une protection contre l’épuisement de ressources, sans rapport avec une pollution de prototype qui détourne le rendu.' },
    ],
  },
  {
    id: 'subdomain-takeover-cookie',
    level: 3,
    theme: 'web',
    goal: 'Voler les sessions des utilisateurs de l’application',
    story: 'Findings « info » et « faible » répartis entre le DNS et les cookies.',
    stones: [
      { id: 'a', label: 'Un CNAME pointe vers un bucket S3 supprimé (docs.novafact.example)', sev: 'faible', inChain: true },
      { id: 'b', label: 'Le compte permet de recréer un bucket portant ce nom', sev: 'faible', inChain: true },
      { id: 'c', label: 'Le cookie de session porte Domain=.novafact.example', sev: 'faible', inChain: true },
      { id: 'd', label: 'Le cookie n’a ni préfixe __Host- ni portée limitée à l’hôte', sev: 'info', inChain: true },
      { id: 'e', label: 'Pas de politique DMARC sur le domaine de messagerie', sev: 'faible', inChain: false },
      { id: 'f', label: 'Le certificat wildcard expire dans vingt jours', sev: 'info', inChain: false },
    ],
    chainOrder: ['a', 'b', 'c', 'd'],
    chainStory: 'Le CNAME pend vers un bucket qui n’existe plus ; on recrée un bucket du même nom et on sert du contenu sur docs.novafact.example. Comme le cookie de session est valable pour tout le domaine parent, il est envoyé à ce sous-domaine, où on le récolte.',
    fixes: [
      { label: 'Rendre le cookie de session propre à l’hôte (préfixe __Host-)', points: 40, why: 'Le cookie n’est plus jamais envoyé à un sous-domaine : tout sous-domaine détourné, aujourd’hui ou demain, devient incapable de récolter la session.' },
      { label: 'Supprimer les enregistrements DNS pendants et les surveiller', points: 20, why: 'Retire cette prise précise. Chaque ressource déprovisionnée peut en recréer une : c’est une chasse permanente, jamais close.' },
      { label: 'Bloquer la recréation de buckets aux noms déjà utilisés', points: 10, why: 'Complique la prise d’un nom libéré, sans traiter les autres services où un sous-domaine pendant peut être revendiqué.' },
      { label: 'Publier une politique DMARC en rejet', points: 0, why: 'Protège contre l’usurpation de courriels, un autre canal : la chaîne vole des cookies, elle n’envoie aucun message.' },
    ],
  },
  {
    id: 'terraform-state-secrets',
    level: 3,
    theme: 'cloud',
    goal: 'Récupérer les secrets de production depuis l’état Terraform',
    story: 'Findings « faible » et « moyen » sur l’infrastructure décrite en code.',
    stones: [
      { id: 'a', label: 'Le backend d’état est un bucket lisible par tous les rôles du compte', sev: 'moyen', inChain: true },
      { id: 'b', label: 'L’état contient en clair des secrets injectés en variables', sev: 'faible', inChain: true },
      { id: 'c', label: 'Un rôle de CI faiblement protégé peut lire ce bucket', sev: 'faible', inChain: true },
      { id: 'd', label: 'Ces secrets incluent la chaîne de connexion à la base de production', sev: 'moyen', inChain: true },
      { id: 'e', label: 'Le verrou d’état DynamoDB n’est pas configuré', sev: 'faible', inChain: false },
      { id: 'f', label: 'Les modules ne sont pas épinglés par version', sev: 'faible', inChain: false },
    ],
    chainOrder: ['c', 'a', 'b', 'd'],
    chainStory: 'Un rôle de CI mal gardé lit le bucket d’état, ouvert à tout le compte ; l’état stocke en clair les variables sensibles, dont la chaîne de connexion à la base de production. Le fichier d’état devient un trousseau.',
    fixes: [
      { label: 'Sortir les secrets de l’état et les lire d’un gestionnaire dédié', points: 40, why: 'Un état qui fuit ne révèle plus rien de sensible : le fichier cesse d’être un trousseau, quels que soient ceux qui parviennent à le lire.' },
      { label: 'Restreindre l’accès au bucket d’état au seul rôle d’exécution', points: 20, why: 'Ferme la lecture par les rôles tiers. Les secrets restent en clair dans l’état, exposés au moindre élargissement ultérieur des droits.' },
      { label: 'Chiffrer l’état avec une clé KMS gérée par l’équipe', points: 10, why: 'Protège d’un accès au stockage brut, mais un rôle autorisé à lire l’objet — et la clé — obtient l’état déchiffré, secrets compris.' },
      { label: 'Configurer le verrou d’état sur DynamoDB', points: 0, why: 'Évite la corruption de l’état par des exécutions concurrentes, un problème de fiabilité : sans effet sur qui peut le lire.' },
    ],
  },
  {
    id: 'cognito-attribute-escalation',
    level: 3,
    theme: 'identite',
    goal: 'Obtenir le rôle administrateur via l’inscription libre',
    story: 'L’authentification s’appuie sur Cognito. Findings « faible » et « moyen ».',
    stones: [
      { id: 'a', label: 'L’inscription libre (self sign-up) est ouverte sur le pool', sev: 'faible', inChain: true },
      { id: 'b', label: 'L’adresse n’est pas restreinte à un domaine à l’inscription', sev: 'faible', inChain: true },
      { id: 'c', label: 'L’attribut custom:role est modifiable par l’utilisateur', sev: 'faible', inChain: true },
      { id: 'd', label: 'L’API décide des droits d’après custom:role lu dans le jeton', sev: 'moyen', inChain: true },
      { id: 'e', label: 'Le pool n’impose pas de second facteur', sev: 'faible', inChain: false },
      { id: 'f', label: 'Les jetons durent une heure', sev: 'info', inChain: false },
    ],
    chainOrder: ['a', 'b', 'c', 'd'],
    chainStory: 'On s’inscrit librement avec une adresse quelconque, on renseigne custom:role=admin — attribut que l’utilisateur peut écrire — et l’API accorde les droits d’administration parce qu’elle lit ce champ directement dans le jeton.',
    fixes: [
      { label: 'Verrouiller l’attribut de rôle en écriture côté pool', points: 40, why: 'Un simple attribut non modifiable coupe l’escalade à la racine : l’utilisateur ne peut plus se déclarer administrateur, quel que soit le point d’entrée.' },
      { label: 'Décider les droits d’après un rôle stocké côté serveur', points: 20, why: 'Ne fait plus confiance au jeton pour l’autorisation, ce qui règle cette chaîne. C’est un remaniement plus lourd que de verrouiller l’attribut.' },
      { label: 'Restreindre l’inscription aux domaines de messagerie autorisés', points: 10, why: 'Réduit qui peut tenter l’escalade, sans l’empêcher : un employé, ou une adresse au bon domaine, garde la main sur l’attribut.' },
      { label: 'Imposer le second facteur à l’inscription', points: 0, why: 'Renforce la preuve d’identité du compte créé, sans rien changer au fait qu’il peut se donner le rôle administrateur.' },
    ],
  },
  {
    id: 'blast-radius-lambda',
    level: 3,
    theme: 'cloud',
    goal: 'Atteindre la base de production depuis une Lambda de traitement d’images',
    story: 'Findings « faible » et « moyen » sur une Lambda déclenchée par dépôt de fichier.',
    stones: [
      { id: 'a', label: 'La Lambda passe l’image à une bibliothèque native vulnérable', sev: 'moyen', inChain: true },
      { id: 'b', label: 'La Lambda s’exécute avec un rôle réutilisé par plusieurs services', sev: 'faible', inChain: true },
      { id: 'c', label: 'Ce rôle autorise la lecture du gestionnaire de secrets', sev: 'moyen', inChain: true },
      { id: 'd', label: 'Les groupes de sécurité laissent la Lambda joindre la base de production', sev: 'faible', inChain: true },
      { id: 'e', label: 'Les journaux de la Lambda ne sont pas chiffrés', sev: 'faible', inChain: false },
      { id: 'f', label: 'Le traçage distribué n’est pas activé', sev: 'info', inChain: false },
    ],
    chainOrder: ['a', 'b', 'c', 'd'],
    chainStory: 'Une image piégée déclenche l’exécution de code dans la bibliothèque native ; la Lambda porte un rôle partagé qui lit le gestionnaire de secrets ; le réseau la laisse joindre la base de production, dont elle vient de récupérer les identifiants.',
    fixes: [
      { label: 'Donner à la Lambda un rôle dédié au strict minimum', points: 40, why: 'Même après exécution de code, la fonction ne détient plus rien d’utile : elle ne lit aucun secret et n’ouvre aucun accès, quelle que soit la faille exploitée.' },
      { label: 'Mettre à jour la bibliothèque de traitement d’images', points: 20, why: 'Ferme la porte d’entrée du jour. La prochaine vulnérabilité de la même bibliothèque rouvrira exactement le même chemin.' },
      { label: 'Isoler la Lambda de la base par les groupes de sécurité', points: 10, why: 'Coupe le dernier maillon réseau, mais les secrets restent lisibles et serviront ailleurs : d’autres cibles deviennent atteignables.' },
      { label: 'Chiffrer les journaux de la Lambda', points: 0, why: 'Protège les traces au repos, sans toucher au rôle ni au réseau que la chaîne emprunte pour atteindre la base.' },
    ],
  },
];

// ── Les séries ────────────────────────────────────────────────────────────────
//
// Cinq séries de progression (N1 → N3), deux séries thématiques qui traversent
// les niveaux (l'argent et les factures d'un côté, le cloud et le pipeline de
// l'autre), et une « Mêlée » rebattue à chaque partie. Chaque série joue cinq
// chaînes.

const mix = (n1: number, n2: number, n3: number): [number, number, number] => [n1, n2, n3];

const PROFILES: SeriesProfile<StoneScenario>[] = [
  { id: 'decouverte', title: 'Découverte', mix: mix(5, 0, 0), level: 1,
    text: 'Des chaînes courtes, deux ou trois maillons. Les findings hors chaîne sont visiblement à côté : on apprend à relier.' },
  { id: 'montee', title: 'Montée en charge', mix: mix(2, 3, 0), level: 2,
    text: 'Les chaînes s’allongent, et un finding leurre s’invite : une bonne pratique voisine qui a tout l’air d’en faire partie.' },
  { id: 'rapport', title: 'Le rapport entier', mix: mix(0, 5, 0), level: 2,
    text: 'Cinq rapports de pentest tout en « faible » et « moyen ». À toi de repérer ce qui se combine, et ce qui distrait.' },
  { id: 'arbitrage', title: 'Arbitrage', mix: mix(0, 1, 4), level: 3,
    text: 'Chaînes longues où le correctif le plus rentable n’est presque jamais sur le maillon le plus grave. C’est là que ça se joue.' },
  { id: 'expert', title: 'Expert', mix: mix(0, 0, 5), level: 3,
    text: 'Rien qui se règle en colmatant le finding le plus effrayant. Il faut peser ce que chaque correctif achète vraiment.' },
  { id: 'paiement', title: 'Argent & factures', level: 2,
    ids: ['cross-tenant-invoices', 'double-refund', 'coupon-race', 'payment-session-theft', 's3-public-list'],
    text: 'Facturation, remboursements, remises, exports : cinq chaînes autour de l’argent et des factures, tous niveaux mêlés.' },
  { id: 'cloud-livraison', title: 'Cloud & pipeline', level: 3,
    ids: ['s3-exfil', 'prod-db', 'staging-to-prod', 'dependency-confusion', 'oidc-ci-role'],
    text: 'SSRF, secrets, IAM, CI : cinq chaînes où l’infrastructure fait le gros du travail, dont Capital One et la confusion de dépendances.' },
  { id: 'melee', title: 'Mêlée', mix: mix(2, 2, 1), level: 2, shuffleEachTime: true,
    text: 'Tous niveaux confondus, recomposée à chaque partie. La seule série qu’on ne peut pas réviser.' },
];

/** Les séries de « Stepping Stones », au format commun à tous les jeux. */
export const stoneSeries = defineSeries(stoneScenarios, PROFILES);

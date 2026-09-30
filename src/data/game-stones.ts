// Scénarios du jeu « Stepping Stones » : relier des findings faibles en une chaîne, puis la casser.
//
// Règle d'écriture : **les quatre correctifs sont des mesures qu'on prendrait
// vraiment**, de longueur comparable. Celui qui vaut 40 points casse la classe
// entière ; ceux qui valent 20 ou 10 cassent cette chaîne-ci, ou la ralentissent ;
// celui qui vaut 0 est un correctif légitime sur un finding hors chaîne. La
// question n'est jamais « lequel est sérieux », mais « lequel achète le plus ».
//
// `npm run games` vérifie que le correctif à 40 points n'est pas le plus long.

export interface Stone { id: string; label: string; sev: 'info' | 'faible' | 'moyen'; inChain: boolean }
export interface StoneFix { label: string; points: 0 | 10 | 20 | 40; why: string }
export interface StoneScenario { goal: string; story: string; stones: Stone[]; chainOrder: string[]; chainStory: string; fixes: StoneFix[] }

export const stoneScenarios: StoneScenario[] = [
  {
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
    goal: 'Exfiltrer les factures stockées dans S3',
    story: 'Le service de génération de PDF importe les logos des clients à partir d’une URL.',
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
    goal: 'Lire les factures d’un autre tenant',
    story: 'Deux findings notés « info » et « moyen » dorment depuis trois mois.',
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
];

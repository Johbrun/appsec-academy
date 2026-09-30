// Incidents du jeu « Supply Chain Kill Chain » (M14). `steps` est dans l'ordre chronologique ;
// `controls[0]` est le contrôle qui casse la chaîne le plus tôt du point de vue de la victime indiquée.

export type Incident = {
  id: string;
  name: string;
  date: string;
  viewpoint: string;
  steps: string[];
  controls: string[];
  why: string;
};

export const incidents: Incident[] = [
  {
    id: 'codecov',
    name: 'Codecov Bash Uploader',
    date: 'janvier à avril 2021',
    viewpoint: 'Tu es une équipe cliente qui envoie sa couverture de tests à Codecov depuis sa CI.',
    steps: [
      'Une erreur dans la fabrication de l’image Docker de Codecov expose un identifiant permettant de modifier le script d’upload.',
      'L’attaquant modifie le Bash Uploader hébergé par Codecov pour envoyer les variables d’environnement de la CI vers son serveur.',
      'Des milliers de pipelines téléchargent et exécutent le script, sans vérifier son intégrité.',
      'Les secrets des CI (jetons, clés cloud) partent chez l’attaquant pendant plus de deux mois.',
      'Un client remarque que l’empreinte du script ne correspond pas à celle publiée, et alerte Codecov.',
    ],
    controls: [
      'Vérifier l’empreinte du script avant de l’exécuter',
      'Activer la MFA et des clés matérielles sur les comptes de l’éditeur',
      'Faire tourner les variables d’environnement de la CI chaque semaine',
      'Restreindre le réseau sortant des runners à une liste d’hôtes connus',
    ],
    why: 'Pour le client, le premier point de contrôle est l’exécution du script : une vérification d’intégrité (CICD-SEC-9) l’aurait refusé. C’est d’ailleurs ainsi qu’il a été découvert.',
  },
  {
    id: 'event-stream',
    name: 'event-stream',
    date: 'septembre à novembre 2018',
    viewpoint: 'Tu maintiens une application qui dépend indirectement d’event-stream.',
    steps: [
      'Le mainteneur, qui ne s’occupe plus du paquet, en cède la publication à un contributeur inconnu qui s’est proposé.',
      'Le nouveau mainteneur ajoute une dépendance, flatmap-stream, d’apparence anodine.',
      'Une version de flatmap-stream embarque une charge chiffrée, qui ne se déchiffre que dans le build d’un portefeuille de cryptomonnaie ciblé.',
      'Des millions de téléchargements installent la dépendance sans que personne ne la relise.',
      'Un utilisateur enquête sur un avertissement de dépréciation et découvre le code malveillant.',
    ],
    controls: [
      'Examiner chaque nouvelle dépendance transitive du lockfile',
      'Mettre à jour les dépendances chaque jour pour rester sur les versions corrigées',
      'Figer les versions exactes plutôt que d’accepter les plages sémantiques',
      'N’accepter que des paquets dont le dépôt source est public et actif',
    ],
    why: 'L’apparition d’une nouvelle dépendance transitive dans le lockfile est le premier signal visible par un consommateur. La santé du projet (un mainteneur qui passe la main) est aussi un critère de choix (M14, leçon 6).',
  },
  {
    id: 'polyfill',
    name: 'polyfill.io',
    date: 'février à juin 2024',
    viewpoint: 'Tu es l’équipe front d’un site qui charge polyfill.io depuis son CDN.',
    steps: [
      'Le domaine et le dépôt GitHub du service sont rachetés par une nouvelle société.',
      'Des mainteneurs historiques alertent : n’utilisez plus ce domaine.',
      'Plus de cent mille sites continuent de charger le script depuis le CDN, sans intégrité possible (le contenu varie selon le navigateur).',
      'Le CDN commence à servir, sous certaines conditions, un script qui redirige les visiteurs mobiles vers des sites malveillants.',
      'Les registrars et CDN réagissent ; le domaine est suspendu.',
    ],
    controls: [
      'Inventorier les scripts tiers et héberger soi-même ce qui peut l’être',
      'Ajouter un attribut d’intégrité (SRI) sur le script chargé depuis le CDN',
      'Activer HSTS avec préchargement, contre la rétrogradation du transport',
      'Poser une CSP qui n’autorise que les domaines de scripts déjà connus',
    ],
    why: 'Le changement de propriétaire et les alertes publiques précèdent l’attaque de plusieurs mois : un inventaire suivi (M4) l’aurait signalé. La SRI ne fonctionnait pas ici, car le contenu servi variait par navigateur ; l’auto-hébergement, si.',
  },
  {
    id: 'ultralytics',
    name: 'Ultralytics',
    date: 'décembre 2024',
    viewpoint: 'Tu maintiens le projet et ses workflows GitHub Actions.',
    steps: [
      'Un attaquant ouvre une PR depuis une branche dont le nom contient une commande shell.',
      'Un workflow déclenché par pull_request_target interpole le nom de la branche dans une étape run : la commande s’exécute dans un contexte privilégié.',
      'L’attaquant empoisonne le cache GitHub Actions utilisé par le workflow de publication.',
      'Le workflow de release légitime restaure le cache empoisonné et publie des versions contenant un mineur de cryptomonnaie.',
      'Les utilisateurs installent les versions piégées, pourtant publiées par le vrai pipeline du projet.',
    ],
    controls: [
      'Ne jamais interpoler une donnée de la PR dans un bloc run',
      'Activer le trusted publishing sur le registre de paquets',
      'Exiger la signature des commits et le vote de deux relecteurs',
      'Séparer les caches de build entre les branches et les pull requests',
    ],
    why: 'L’injection dans le workflow est le premier maillon. Le trusted publishing était utilisé, et n’a rien empêché : il prouve d’où vient le paquet, pas que le build est sain. D’où l’intérêt d’isoler les builds et les caches (SLSA Build L3).',
  },
  {
    id: 'tj-actions',
    name: 'tj-actions/changed-files',
    date: 'mars 2025',
    viewpoint: 'Tu es une équipe dont les workflows utilisent tj-actions/changed-files@v45.',
    steps: [
      'Une autre action utilisée dans les workflows du projet tj-actions est compromise.',
      'Cette compromission expose un jeton d’accès du bot qui maintient tj-actions/changed-files.',
      'L’attaquant fait pointer les tags de version existants vers un commit malveillant.',
      'Les workflows qui référencent l’action par tag (plus de 23 000 dépôts l’utilisent) exécutent ce commit.',
      'Le code malveillant affiche les secrets de la mémoire du runner dans les journaux, publics pour les dépôts publics.',
    ],
    controls: [
      'Épingler les actions tierces par SHA de commit complet',
      'Surveiller le réseau sortant des runners et alerter sur l’inconnu',
      'Limiter le GITHUB_TOKEN à la lecture par défaut dans le dépôt',
      'N’autoriser que les actions publiées par des organisations vérifiées',
    ],
    why: 'Pour un consommateur, un tag est mutable, un SHA ne l’est pas : l’épinglage aurait empêché l’exécution du commit malveillant. Surveiller le réseau sortant des runners (harden-runner) a permis de le détecter.',
  },
  {
    id: 'shai-hulud',
    name: 'Shai-Hulud',
    date: 'septembre 2025',
    viewpoint: 'Tu es l’équipe Novafact, qui installe des paquets npm en local et en CI.',
    steps: [
      'Des jetons de mainteneurs npm sont compromis.',
      'Des versions piégées de leurs paquets sont publiées, avec un script exécuté à l’installation.',
      'Des développeurs et des pipelines CI installent ces versions dans les heures qui suivent.',
      'Le script récolte les secrets de la machine (jetons npm et GitHub, clés cloud) et les exfiltre via GitHub.',
      'Avec les jetons npm volés, il publie des versions piégées des autres paquets des victimes : le ver se propage.',
    ],
    controls: [
      'Désactiver les scripts d’installation et différer l’adoption',
      'N’installer que depuis un miroir interne alimenté après revue',
      'Exiger le trusted publishing chez tous les éditeurs dont on dépend',
      'Faire tourner npm audit à chaque construction et bloquer sur critique',
    ],
    why: 'Pour un consommateur, l’installation est le premier point de contact. Sans exécution de scripts et avec un délai d’adoption, la plupart des versions piégées sont retirées avant d’être installées. Côté éditeur, le trusted publishing supprime les jetons longs à voler.',
  },
  {
    id: 'xz',
    name: 'xz utils',
    date: '2021 à mars 2024',
    viewpoint: 'Tu es une distribution Linux qui empaquette xz utils.',
    steps: [
      'Un contributeur gagne progressivement la confiance du mainteneur, seul et épuisé, appuyé par des comptes qui réclament plus de réactivité.',
      'Il obtient les droits de publication des releases.',
      'Il cache une charge dans des fichiers de test binaires, et un script déclencheur uniquement dans les archives de release.',
      'Les versions 5.6.0 et 5.6.1 sont publiées ; des distributions de test les intègrent.',
      'Un ingénieur remarque une latence SSH anormale et découvre la porte dérobée.',
    ],
    controls: [
      'Construire depuis le dépôt source relu, pas depuis l’archive',
      'Interdire les binaires de test dans les dépôts de dépendances système',
      'Restreindre l’accès SSH à un réseau d’administration, jamais Internet',
      'Surveiller les régressions de performance inexpliquées au démarrage',
    ],
    why: 'Le point de rupture pour un empaqueteur : l’archive de release ne correspondait pas au dépôt. Construire depuis la source relue, ou comparer les deux, aurait révélé le script ajouté.',
  },
];

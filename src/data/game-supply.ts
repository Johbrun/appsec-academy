// Incidents du jeu « Supply Chain Kill Chain » (M18). `steps` est dans l'ordre chronologique ;
// `controls[0]` est le contrôle qui casse la chaîne le plus tôt du point de vue de la victime indiquée.
//
// Tous les incidents sont **réels et documentés**. Les étapes sont fidèles aux
// sources publiques (post-mortems d'éditeurs, avis GHSA/CISA, analyses Wiz,
// StepSecurity, Unit 42, Socket, Snyk, Mandiant, CrowdStrike, presse
// spécialisée). Aucun détail n'est inventé : quand une date ou un chiffre était
// incertain ou contesté entre sources, il a été laissé de côté.
//
// ── Ce qui fait la difficulté d'un incident ───────────────────────────────────
//
// Pas le sujet, mais la **structure** de la reconstitution. Trois niveaux :
//
//   N1 · Quatre à cinq étapes nettement distinctes, dans un ordre qui coule de
//        source (accès → altération → diffusion → impact → découverte). Le bon
//        contrôle est celui qu'on citerait spontanément. On apprend la forme
//        d'une attaque de chaîne d'approvisionnement.
//
//   N2 · Étapes plus rapprochées, ou un détail qui inverse l'ordre attendu (la
//        révocation avant la découverte, l'alerte publique avant l'attaque). Le
//        contrôle demande de se placer du bon côté (consommateur vs éditeur).
//
//   N3 · Étapes très proches dans le temps, faciles à intervertir, et un choix
//        de contrôle **défendable mais non décisif** parmi les options : le
//        contrôle « évident » (signature de code, MFA, trusted publishing) n'a
//        rien empêché parce que le build ou le mainteneur légitime était
//        compromis. Il faut trouver celui qui, lui, aurait cassé la chaîne.
//
// `controls` a toujours le bon en premier ; l'affichage mélange les options.

export type SupplyLevel = 1 | 2 | 3;
export type SupplyTheme = 'registre' | 'cicd' | 'build' | 'fournisseur';

export type Incident = {
  /** Identifiant stable : il sert à composer les séries. */
  id: string;
  level: SupplyLevel;
  theme: SupplyTheme;
  name: string;
  date: string;
  viewpoint: string;
  steps: string[];
  controls: string[];
  why: string;
  /** Incidents proches à ne pas placer dans la même série. */
  avoid?: string[];
};

export const incidents: Incident[] = [
  // ── Registres (npm / PyPI) ──────────────────────────────────────────────────
  {
    id: 'event-stream',
    level: 1,
    theme: 'registre',
    name: 'event-stream',
    date: 'septembre à novembre 2018',
    viewpoint: 'Tu maintiens une application qui dépend indirectement d’event-stream.',
    steps: [
      'Le mainteneur, qui ne s’occupe plus du paquet, en cède la publication à un contributeur qui s’est proposé par courriel.',
      'Le nouveau mainteneur ajoute une dépendance, flatmap-stream, d’apparence anodine.',
      'Une version ultérieure de flatmap-stream embarque une charge chiffrée, qui ne se déchiffre que dans le build du portefeuille Copay visé.',
      'Des millions de téléchargements installent la dépendance sans que personne ne la relise.',
      'Un développeur enquête sur le code obfusqué et publie son analyse : la porte dérobée est découverte.',
    ],
    controls: [
      'Examiner chaque nouvelle dépendance transitive du lockfile',
      'Mettre à jour les dépendances chaque jour pour rester à niveau',
      'Figer les versions exactes plutôt que d’accepter les plages sémantiques',
      'N’accepter que des paquets dont le dépôt source est public et actif',
    ],
    why: 'L’apparition d’une nouvelle dépendance transitive publiée par un compte inconnu est le premier signal visible par un consommateur. La charge ne se déchiffrant que dans le build de Copay, ni les tests ni un bac à sable n’auraient rien montré ailleurs.',
  },
  {
    id: 'eslint-scope',
    level: 1,
    theme: 'registre',
    name: 'eslint-scope',
    date: 'juillet 2018',
    viewpoint: 'Tu es un projet dont la CI installe eslint-scope.',
    steps: [
      'Le mot de passe npm d’un mainteneur, réutilisé sur un autre site déjà compromis, est deviné ; le compte n’a pas de second facteur.',
      'L’attaquant génère un jeton d’authentification et publie une version piégée d’eslint-scope.',
      'La version embarque un script postinstall qui récupère et exécute du code depuis Pastebin.',
      'Ce code lit le fichier .npmrc des machines et exfiltre les jetons npm qui s’y trouvent.',
      'Un utilisateur repère la version anormale, l’équipe publie une version saine et npm révoque en masse les jetons émis avant l’incident.',
    ],
    controls: [
      'Désactiver l’exécution des scripts d’installation (--ignore-scripts)',
      'Imposer un second facteur à tous les comptes de publication',
      'Faire tourner chaque semaine les jetons npm stockés sur les postes de travail',
      'N’installer que des versions publiées depuis plus de sept jours',
    ],
    why: 'Pour un consommateur, la charge était entièrement dans un script postinstall : le désactiver bloquait l’exécution. Côté mainteneur, l’absence de second facteur et un mot de passe réutilisé sont la cause racine reconnue dans le post-mortem d’ESLint.',
  },
  {
    id: 'ua-parser-js',
    level: 1,
    theme: 'registre',
    name: 'ua-parser-js',
    date: 'octobre 2021',
    viewpoint: 'Tu es une équipe qui dépend d’ua-parser-js, installé en CI et en local.',
    steps: [
      'Le compte npm du mainteneur est pris en main par un attaquant.',
      'Trois versions piégées sont publiées en une minute, avec un script preinstall.',
      'Le script installe, selon le système, un mineur de cryptomonnaie et, sous Windows, un voleur de mots de passe.',
      'Les pipelines et postes qui installent la version dans les heures qui suivent sont infectés.',
      'Le mainteneur, alerté par un flot de spam et un avertissement npm, déprécie les versions et en publie de saines environ quatre heures plus tard.',
    ],
    controls: [
      'Différer l’adoption des nouvelles versions de quelques jours',
      'Lancer npm audit à chaque build et bloquer sur alerte critique',
      'Chiffrer les secrets de CI au repos dans le coffre du fournisseur',
      'Restreindre les droits du compte npm de publication',
    ],
    why: 'Les versions piégées n’ont vécu que quatre heures : un délai d’adoption (cooldown) les aurait laissées passer, remplacées par des versions saines avant installation. npm audit n’aurait rien vu, aucun avis n’existant pendant la fenêtre.',
    avoid: ['solana-web3', 'chalk-debug'],
  },
  {
    id: 'chalk-debug',
    level: 2,
    theme: 'registre',
    name: 'chalk / debug (phishing « qix »)',
    date: 'septembre 2025',
    viewpoint: 'Tu es l’équipe Novafact, qui installe chalk, debug et leurs dépendances.',
    steps: [
      'Un mainteneur reçoit un faux courriel « mise à jour du 2FA » pointant vers un domaine de hameçonnage imitant npm.',
      'Il saisit ses identifiants et son code à usage unique sur le site frauduleux.',
      'L’attaquant publie des versions piégées de debug, chalk et d’une quinzaine d’autres paquets très populaires.',
      'La charge, un détourneur de transactions crypto côté navigateur, remplace les adresses de portefeuille dans les pages qui embarquent ces paquets.',
      'La compromission est détectée en quelques minutes ; les versions saines et les correctifs suivent dans l’heure.',
    ],
    controls: [
      'Installer avec un lockfile figé et un délai d’adoption des versions',
      'Imposer une authentification à l’épreuve du hameçonnage (clés FIDO) aux mainteneurs',
      'Bloquer les scripts d’installation sur les postes de développement',
      'Analyser chaque dépendance avec un antivirus avant de l’installer',
    ],
    why: 'Pour un consommateur, un lockfile figé plus un cooldown : les versions n’ont vécu que deux heures. Le second facteur par code à usage unique n’a rien empêché — il a été hameçonné ; seule une authentification à l’épreuve du hameçonnage l’aurait été côté éditeur. Aucun script d’installation ici : la charge s’exécutait dans les fronts.',
    avoid: ['solana-web3', 'ua-parser-js'],
  },
  {
    id: 'solana-web3',
    level: 2,
    theme: 'registre',
    name: '@solana/web3.js',
    date: 'décembre 2024',
    viewpoint: 'Tu exploites un bot qui manipule des clés privées Solana via @solana/web3.js.',
    steps: [
      'Un membre de l’organisation npm disposant du droit de publication est hameçonné (identifiants et second facteur).',
      'Deux versions piégées sont publiées à dix minutes d’intervalle.',
      'La charge, ajoutée dans le code de la bibliothèque, détourne les chemins qui accèdent aux clés privées.',
      'Les clés sont exfiltrées vers un domaine d’apparence légitime, mais seuls les logiciels qui manipulent des clés en clair sont touchés.',
      'Une version saine est publiée cinq heures plus tard, et les mainteneurs recommandent de faire tourner les clés d’autorité.',
    ],
    controls: [
      'Épingler une version exacte et l’installer depuis le lockfile',
      'Désactiver les scripts d’installation en CI (--ignore-scripts)',
      'Imposer un second facteur par code à usage unique aux mainteneurs',
      'Chiffrer les clés privées au repos dans un coffre',
    ],
    why: 'La charge était dans le code de la bibliothèque, exécuté à l’usage : désactiver les scripts d’installation n’aurait rien changé, mais une version épinglée installée depuis le lockfile aurait ignoré la version piégée. Le second facteur par code a été hameçonné, il n’a pas protégé l’éditeur.',
    avoid: ['chalk-debug', 'ua-parser-js'],
  },
  {
    id: 'ctx-pypi',
    level: 2,
    theme: 'registre',
    name: 'ctx (PyPI, domaine expiré)',
    date: 'mai 2022',
    viewpoint: 'Tu es un projet Python qui dépend du paquet ctx.',
    steps: [
      'Le paquet ctx n’a plus été publié depuis 2014, et le domaine de l’adresse de son propriétaire a expiré.',
      'Un attaquant rachète ce domaine, recrée l’adresse et déclenche une réinitialisation du mot de passe du compte, dépourvu de MFA.',
      'Maître du compte, il publie une série de versions piégées de ctx.',
      'À l’instanciation, le code envoie les variables d’environnement (dont des clés AWS) vers un serveur distant.',
      'Des signalements arrivent une dizaine de jours plus tard, et PyPI retire les versions et gèle le compte.',
    ],
    controls: [
      'Épingler les dépendances par empreinte (hash) dans le lockfile',
      'Imposer la MFA sur les comptes de publication PyPI',
      'Différer l’adoption des versions de sept jours',
      'Interdire les paquets qui n’ont pas de dépôt source public et actif',
    ],
    why: 'Pour un consommateur, un lockfile à empreintes : une nouvelle version ne correspond à aucun hash connu et l’installation échoue. Un cooldown de sept jours n’aurait pas suffi — les versions sont restées en ligne une dizaine de jours. Côté éditeur, la MFA est la cause racine reconnue par PyPI.',
    avoid: ['dependency-confusion-birsan'],
  },
  {
    id: 'colors-faker',
    level: 2,
    theme: 'registre',
    name: 'colors.js / faker.js',
    date: 'janvier 2022',
    viewpoint: 'Tu maintiens une application qui dépend de colors.js par une plage sémantique.',
    steps: [
      'Le mainteneur, en conflit avec les grandes entreprises qui utilisent son travail gratuitement, décide de saboter ses propres paquets.',
      'Il vide faker de son contenu, puis publie des versions de colors.js contenant une boucle infinie.',
      'Les projets qui acceptent une plage de versions récupèrent automatiquement colors.js piégé.',
      'Au chargement, la boucle imprime du texte parasite en continu : les applications dépendantes se bloquent.',
      'npm rétablit les versions antérieures et GitHub suspend l’accès du mainteneur à ses projets.',
    ],
    controls: [
      'Épingler des versions exactes et installer depuis le lockfile',
      'Désactiver les scripts d’installation (--ignore-scripts)',
      'Imposer un second facteur au compte du mainteneur',
      'Exiger le trusted publishing chez chacun des éditeurs dont on dépend',
    ],
    why: 'C’est le mainteneur légitime qui a publié : ni MFA ni trusted publishing n’auraient joué, la provenance aurait été valide. Le sabotage s’exécutait au chargement, pas à l’installation. Seule une version exacte figée dans le lockfile aurait retenu la version d’avant.',
  },
  {
    id: 'node-ipc',
    level: 3,
    theme: 'registre',
    name: 'node-ipc « peacenotwar »',
    date: 'mars 2022',
    viewpoint: 'Tu es une équipe dont un outil dépend de node-ipc par une plage sémantique.',
    steps: [
      'Le mainteneur publie une version de node-ipc contenant du code obfusqué qui géolocalise l’adresse IP.',
      'Sur les IP situées en Russie ou en Biélorussie, le code écrase des fichiers du disque par un émoji.',
      'Une version corrigée retire l’effaceur environ quinze heures plus tard.',
      'Le mainteneur publie ensuite des versions qui déposent un fichier de message pacifiste sur le bureau, via une nouvelle dépendance.',
      'Ces versions remontent dans des projets comme Vue CLI, dont les utilisateurs découvrent le fichier chez eux.',
    ],
    controls: [
      'Épingler des versions exactes et installer depuis le lockfile',
      'Différer l’adoption des nouvelles versions de plusieurs jours ouvrés',
      'Désactiver les scripts d’installation (--ignore-scripts)',
      'Imposer un second facteur au compte du mainteneur',
    ],
    why: 'Deux charges, l’effaceur puis le dépôt de fichier, exécutées au chargement et par le mainteneur légitime : ni --ignore-scripts ni la MFA n’auraient joué. Seul un lockfile à versions exactes, ou un délai d’adoption couvrant la fenêtre de quinze heures, aurait retenu la version d’avant.',
    avoid: ['colors-faker'],
  },
  {
    id: 'shai-hulud',
    level: 3,
    theme: 'registre',
    name: 'Shai-Hulud',
    date: 'septembre 2025',
    viewpoint: 'Tu es l’équipe Novafact, qui installe des paquets npm en local et en CI.',
    steps: [
      'Des jetons de mainteneurs npm sont compromis.',
      'Des versions piégées de leurs paquets sont publiées, avec un script exécuté à l’installation.',
      'Le script récupère et lance un scanner de secrets, qui récolte jetons npm et GitHub, clés cloud et autres.',
      'Les secrets sont exfiltrés vers un dépôt GitHub public créé dans le compte de la victime.',
      'Avec les jetons npm volés, le script republie les autres paquets de la victime : le ver se propage à plus de cinq cents paquets.',
    ],
    controls: [
      'Désactiver les scripts d’installation et différer l’adoption',
      'N’installer que depuis un miroir interne alimenté après revue',
      'Exiger le trusted publishing chez tous les éditeurs dont on dépend',
      'Faire tourner npm audit à chaque construction et bloquer sur critique',
    ],
    why: 'Pour un consommateur, l’installation est le premier point de contact : sans exécution de scripts et avec un délai d’adoption, la plupart des versions piégées sont retirées avant d’être installées. Côté éditeur, le trusted publishing supprime les jetons longs à voler.',
  },

  // ── Confusion de dépendances ────────────────────────────────────────────────
  {
    id: 'dependency-confusion-birsan',
    level: 2,
    theme: 'registre',
    name: 'Confusion de dépendances (A. Birsan)',
    date: 'recherche publiée en février 2021',
    viewpoint: 'Tu es une entreprise dont la CI mélange registre public et paquets internes.',
    steps: [
      'Un chercheur repère, dans un package.json fuité, des noms de paquets internes qui n’existent pas sur le registre public.',
      'Il publie sur le registre public des paquets aux mêmes noms, avec un numéro de version très élevé.',
      'Les outils de build, qui interrogent aussi le registre public, retiennent ces versions parce qu’elles sont les plus hautes.',
      'Un script preinstall s’exécute et remonte, par DNS, le nom de machine et le chemin d’exécution.',
      'Des rappels arrivent depuis les réseaux internes de plus de trente-cinq entreprises, dont Apple, Microsoft et PayPal.',
    ],
    controls: [
      'Rattacher les paquets internes à un registre privé, par portée',
      'Réserver les noms internes sur le registre public',
      'Désactiver les scripts d’installation (--ignore-scripts)',
      'Épingler des versions exactes par empreinte',
    ],
    why: 'Rattacher la portée interne au seul registre privé fait qu’un paquet public de même nom n’est jamais consulté, quelle que soit sa version : c’est le contrôle qui ferme la classe. Réserver les noms ne couvre que ceux d’aujourd’hui ; --ignore-scripts bloque ce PoC, mais l’attaquant peut mettre sa charge dans le corps du module.',
    avoid: ['torchtriton'],
  },
  {
    id: 'torchtriton',
    level: 2,
    theme: 'registre',
    name: 'torchtriton (PyTorch)',
    date: 'décembre 2022',
    viewpoint: 'Tu installes PyTorch-nightly sous Linux avec pip.',
    steps: [
      'PyTorch-nightly dépend de torchtriton, servi depuis l’index privé de PyTorch et non réservé sur PyPI.',
      'Un attaquant publie sur PyPI un paquet nommé torchtriton avec un numéro de version élevé.',
      'pip rassemble les candidats de tous les index et retient la version PyPI, sans priorité d’index.',
      'À l’import de triton, un binaire embarqué lit fichiers système, clés SSH et variables d’environnement.',
      'Les données sont exfiltrées par requêtes DNS chiffrées ; PyTorch réagit en renommant la dépendance et en réservant le nom.',
    ],
    controls: [
      'N’utiliser qu’un seul index pip (--index-url), pas --extra-index-url',
      'Épingler les dépendances par empreinte (--require-hashes)',
      'Désactiver les scripts d’installation à l’installation',
      'Lister l’index de PyTorch avant PyPI sur la ligne de commande',
    ],
    why: 'pip n’applique aucune priorité entre index : il compare tous les candidats et prend la meilleure version. N’utiliser qu’un index (ou un miroir unique) ferme la confusion. Lister l’index en premier ne change rien, et --ignore-scripts non plus : la charge s’exécutait à l’import, pas à l’installation.',
    avoid: ['dependency-confusion-birsan'],
  },

  // ── CI/CD ───────────────────────────────────────────────────────────────────
  {
    id: 'ultralytics',
    level: 2,
    theme: 'cicd',
    name: 'Ultralytics',
    date: 'décembre 2024',
    viewpoint: 'Tu maintiens le projet et ses workflows GitHub Actions.',
    steps: [
      'Un attaquant ouvre une PR depuis une branche dont le nom contient une commande shell.',
      'Un workflow déclenché par pull_request_target interpole ce nom de branche dans une étape run : la commande s’exécute dans un contexte privilégié.',
      'L’attaquant empoisonne le cache GitHub Actions partagé, réutilisé par le workflow de publication.',
      'Le workflow de release légitime restaure le cache empoisonné et publie via le trusted publishing des versions contenant un mineur.',
      'Deux jours plus tard, un jeton PyPI resté actif sert à publier directement d’autres versions piégées.',
    ],
    controls: [
      'Ne jamais interpoler une donnée de la PR dans un bloc run',
      'Isoler les caches de build entre les branches et les pull requests',
      'Activer le trusted publishing sur le registre de paquets',
      'Exiger la signature des commits et deux relecteurs',
    ],
    why: 'L’injection dans le workflow est le premier maillon. Le trusted publishing était utilisé et n’a rien empêché : il prouve d’où vient le paquet, pas que le build est sain. La revue de PR non plus, puisque la charge s’exécute à l’ouverture de la PR, sans fusion.',
    avoid: ['nx-s1ngularity', 'tj-actions'],
  },
  {
    id: 'tj-actions',
    level: 3,
    theme: 'cicd',
    name: 'tj-actions/changed-files',
    date: 'mars 2025',
    viewpoint: 'Tu es une équipe dont les workflows utilisent tj-actions/changed-files par un tag.',
    steps: [
      'Un jeton personnel volé chez un projet tiers, réutilisé de proche en proche, atteint une autre action de l’écosystème tj-actions.',
      'Cette compromission expose un jeton du bot qui maintient tj-actions/changed-files.',
      'L’attaquant fait pointer les tags de version existants vers un commit malveillant.',
      'Les workflows qui référencent l’action par tag (plus de 23 000 dépôts) exécutent ce commit.',
      'Le code affiche les secrets de la mémoire du runner dans les journaux, publics pour les dépôts publics.',
    ],
    controls: [
      'Épingler les actions tierces par empreinte de commit (SHA) complète',
      'Surveiller le réseau sortant des runners et alerter sur tout hôte inconnu',
      'Limiter le GITHUB_TOKEN à la lecture par défaut',
      'N’autoriser que les actions d’organisations vérifiées',
    ],
    why: 'Un tag est modifiable, un SHA ne l’est pas : l’épinglage par empreinte aurait empêché l’exécution du commit malveillant. Surveiller le réseau sortant a permis la détection (l’endpoint inattendu), mais n’aurait rien bloqué seul, et le masquage des secrets a été contourné par un double encodage.',
    avoid: ['ultralytics', 'nx-s1ngularity'],
  },
  {
    id: 'nx-s1ngularity',
    level: 3,
    theme: 'cicd',
    name: 's1ngularity / Nx',
    date: 'août 2025',
    viewpoint: 'Tu es l’équipe Nx, qui maintient le paquet et ses workflows.',
    steps: [
      'Un workflow de validation de titre de PR, déclenché par pull_request_target, interpole le titre dans une commande shell.',
      'Le workflow est corrigé sur la branche principale, mais reste exploitable sur d’anciennes branches.',
      'Depuis une de ces branches, l’attaquant déclenche le workflow, obtient un jeton en écriture et lance le workflow de publication.',
      'Des versions piégées de Nx sont publiées, avec un script postinstall qui inventorie les secrets — y compris via des CLI d’IA locales lancées en mode permissif.',
      'Les secrets sont poussés vers des dépôts publics créés dans les comptes des victimes ; une seconde vague rend publics leurs dépôts privés.',
    ],
    controls: [
      'Ne jamais interpoler une donnée de la PR dans un bloc run',
      'Retirer le workflow vulnérable de toutes les branches, pas seulement la principale',
      'Exiger un environnement protégé avec approbation pour publier',
      'Imposer un second facteur au compte npm de publication',
    ],
    why: 'L’injection est le premier maillon, et le correctif sur la seule branche principale n’a pas suffi — l’attaque est passée par une branche ancienne. Corriger partout est ici plus décisif que le second facteur, contourné par les jetons d’automatisation.',
    avoid: ['ultralytics', 'tj-actions'],
  },
  {
    id: 'codecov',
    level: 2,
    theme: 'cicd',
    name: 'Codecov Bash Uploader',
    date: 'janvier à avril 2021',
    viewpoint: 'Tu es une équipe cliente qui envoie sa couverture de tests à Codecov depuis sa CI.',
    steps: [
      'Une erreur dans la fabrication de l’image Docker de Codecov laisse un identifiant dans une couche de l’image publique.',
      'L’attaquant s’en sert pour modifier le Bash Uploader hébergé, qui envoie désormais les variables d’environnement de la CI vers son serveur.',
      'Des milliers de pipelines téléchargent et exécutent le script, sans vérifier son intégrité.',
      'Les secrets des CI (jetons, clés cloud) partent chez l’attaquant pendant environ deux mois.',
      'Un client compare l’empreinte SHA256 du script à celle publiée sur GitHub, note l’écart et alerte Codecov.',
    ],
    controls: [
      'Vérifier l’empreinte du script avant de l’exécuter',
      'Restreindre le réseau sortant des runners à des hôtes connus',
      'Faire tourner les variables d’environnement de la CI chaque semaine',
      'Activer la MFA et des clés matérielles sur les comptes de l’éditeur',
    ],
    why: 'Pour le client, le premier point de contrôle est l’exécution du script : une vérification d’intégrité l’aurait refusé — c’est d’ailleurs ainsi qu’il a été découvert. Elle a marché parce que l’empreinte de référence était hébergée ailleurs (GitHub) que le script (le stockage cloud modifié).',
  },
  {
    id: 'circleci',
    level: 2,
    theme: 'cicd',
    name: 'CircleCI',
    date: 'décembre 2022 à janvier 2023',
    viewpoint: 'Tu es un client qui stocke des secrets dans CircleCI.',
    steps: [
      'Un logiciel malveillant s’installe sur le portable d’un ingénieur, sans être détecté par l’antivirus.',
      'Il vole un cookie de session SSO valide, déjà validé par le second facteur.',
      'L’attaquant rejoue la session pour se faire passer pour l’ingénieur et accéder à la production.',
      'Il exfiltre les variables d’environnement et les secrets des clients ; les clés de chiffrement sont extraites d’un processus en mémoire.',
      'Un client signale une activité suspecte sur un jeton OAuth GitHub ; CircleCI enquête, puis demande à tous de faire tourner leurs secrets.',
    ],
    controls: [
      'Fédérer des identifiants courts (OIDC) plutôt que stocker des secrets longs',
      'Restreindre chaque jeton stocké au strict périmètre nécessaire',
      'Activer le second facteur à la connexion à CircleCI',
      'Se fier au chiffrement au repos du fournisseur',
    ],
    why: 'Côté client, des identifiants fédérés courts se périment d’eux-mêmes : les secrets exfiltrés ne valent plus rien. Le second facteur n’a pas protégé — c’est une session déjà authentifiée qui a été volée — et le chiffrement au repos non plus, les clés ayant été lues en mémoire.',
    avoid: ['codecov'],
  },

  // ── Build / éditeur / fournisseur ───────────────────────────────────────────
  {
    id: 'xz-utils',
    level: 3,
    theme: 'build',
    name: 'xz utils',
    date: '2021 à mars 2024',
    viewpoint: 'Tu es une distribution Linux qui empaquette xz utils.',
    steps: [
      'Un contributeur gagne progressivement la confiance du mainteneur, seul et épuisé, appuyé par des comptes qui réclament plus de réactivité.',
      'Il obtient les droits de publication des releases.',
      'Il ajoute au dépôt des fichiers de test binaires contenant la charge, inoffensifs sans déclencheur.',
      'Il place un script déclencheur uniquement dans les archives de release, absent du dépôt git, qui active la porte dérobée au build.',
      'Un ingénieur, intrigué par une latence SSH et des erreurs mémoire, remonte la piste et découvre la porte dérobée dans les versions 5.6.0 et 5.6.1.',
    ],
    controls: [
      'Construire depuis le dépôt git relu, pas depuis l’archive de release',
      'Traiter les binaires de test comme du code : revue et provenance',
      'Restreindre l’accès SSH à un réseau d’administration',
      'Vérifier la signature GPG de l’archive de release',
    ],
    why: 'Le point de rupture pour un empaqueteur : l’archive de release contenait un déclencheur absent du dépôt git. Construire depuis la source relue, ou comparer les deux, l’aurait révélé. La signature GPG n’aurait rien changé — le mainteneur malveillant était légitime et signait lui-même.',
  },
  {
    id: 'solarwinds',
    level: 3,
    theme: 'build',
    name: 'SolarWinds / SUNBURST',
    date: '2019 à décembre 2020',
    viewpoint: 'Tu es un client qui déploie les mises à jour Orion de SolarWinds.',
    steps: [
      'Des attaquants s’introduisent dans le réseau de SolarWinds et testent, sans charge, l’insertion de code dans une release.',
      'Un implant sur le serveur de build intercepte la compilation et substitue une version piégée d’un fichier source, puis restaure l’original.',
      'SolarWinds signe et distribue des mises à jour Orion piégées depuis son site officiel.',
      'Jusqu’à dix-huit mille clients installent une version affectée ; la porte dérobée attend une dizaine de jours avant de rappeler.',
      'Une société de sécurité, enquêtant sur sa propre compromission, remonte à SolarWinds : la campagne est révélée.',
    ],
    controls: [
      'Filtrer le réseau sortant du serveur Orion vers une liste d’hôtes connus',
      'Vérifier la signature numérique des mises à jour avant déploiement',
      'Comparer l’empreinte publiée par l’éditeur avant d’installer',
      'Ne télécharger que depuis le site officiel de l’éditeur',
    ],
    why: 'La porte dérobée devait joindre son serveur de commande : un filtrage sortant strict cassait la chaîne côté client. La signature de code n’a rien empêché — le build lui-même étant compromis, la DLL malveillante était valablement signée — pas plus que l’empreinte de l’éditeur ou le site officiel.',
    avoid: ['3cx'],
  },
  {
    id: '3cx',
    level: 3,
    theme: 'build',
    name: '3CX (cascade X_TRADER)',
    date: 'mars 2023',
    viewpoint: 'Tu es un client qui déploie l’application de bureau 3CX.',
    steps: [
      'Un employé de 3CX installe une application de trading (X_TRADER) elle-même piégée en amont, sur une machine personnelle.',
      'Ses identifiants d’entreprise sont volés et servent à entrer dans le réseau de 3CX.',
      'Les attaquants compromettent les environnements de build Windows et macOS de 3CX.',
      '3CX signe et distribue des versions piégées de son application de bureau, valablement signées et notariées.',
      'Des alertes comportementales d’EDN chez les clients, d’abord prises pour des faux positifs, mènent à la confirmation de la compromission.',
    ],
    controls: [
      'Se fier à la détection comportementale (EDR) plutôt qu’aux signatures',
      'Vérifier la signature et la notarisation de l’application',
      'N’installer que depuis le site officiel de l’éditeur',
      'Contrôler l’empreinte publiée par l’éditeur avant installation',
    ],
    why: 'C’est la détection comportementale qui a levé l’alerte, à condition de ne pas la classer en faux positif sur une mise à jour signée. La signature, la notarisation Apple et le site officiel n’ont rien empêché : le build de 3CX était compromis, comme celui de X_TRADER en amont.',
    avoid: ['solarwinds'],
  },
  {
    id: 'kaseya',
    level: 2,
    theme: 'fournisseur',
    name: 'Kaseya VSA / REvil',
    date: 'juillet 2021',
    viewpoint: 'Tu es un prestataire (MSP) qui exploite un serveur Kaseya VSA sur site.',
    steps: [
      'Des failles du serveur VSA sur site, exposé sur Internet, sont exploitées sans authentification.',
      'Les attaquants poussent, via la fonction de distribution de VSA, une fausse « mise à jour » aux postes gérés.',
      'La procédure désactive l’antivirus et charge la charge par une bibliothèque légitime détournée.',
      'Le rançongiciel REvil chiffre les postes de dizaines de prestataires et de leurs clients.',
      'Kaseya demande d’arrêter les serveurs VSA, publie un correctif dix jours plus tard, puis un déchiffreur.',
    ],
    controls: [
      'Ne pas exposer l’interface d’administration VSA sur Internet',
      'Appliquer sans délai les correctifs et les avis de l’éditeur',
      'Signer et vérifier l’empreinte des mises à jour VSA',
      'Se fier aux exclusions d’antivirus recommandées par l’éditeur',
    ],
    why: 'Le code de Kaseya n’a pas été altéré : c’est le serveur VSA sur site, exposé, qui a été exploité, puis sa fonction légitime de distribution détournée. Ne pas l’exposer cassait la chaîne à l’entrée. Vérifier une signature n’aurait rien changé — aucune mise à jour signée n’était en cause — et les exclusions d’antivirus ont même aidé l’attaque.',
  },
  {
    id: 'polyfill',
    level: 1,
    theme: 'fournisseur',
    name: 'polyfill.io',
    date: 'février à juin 2024',
    viewpoint: 'Tu es l’équipe front d’un site qui charge polyfill.io depuis son CDN.',
    steps: [
      'Le domaine et le dépôt GitHub du service sont rachetés par une nouvelle société.',
      'Le créateur historique alerte publiquement : n’utilisez plus ce domaine.',
      'Plus de cent mille sites continuent de charger le script, sans intégrité possible (le contenu varie selon le navigateur).',
      'Le CDN se met à servir, sous conditions, un script qui redirige les visiteurs mobiles vers des sites frauduleux.',
      'Le registrar met le domaine en suspension et les CDN proposent des miroirs sains.',
    ],
    controls: [
      'Inventorier les scripts tiers et héberger soi-même ce qui peut l’être',
      'Ajouter un attribut d’intégrité (SRI) sur le script chargé',
      'Poser une CSP qui n’autorise que des domaines de script connus',
      'Activer HSTS avec préchargement contre la rétrogradation du transport réseau',
    ],
    why: 'Le changement de propriétaire et l’alerte publique précèdent l’attaque de plusieurs mois : un inventaire suivi, et l’auto-hébergement, l’auraient évitée. La SRI ne fonctionnait pas ici, le contenu servi variant par navigateur ; une CSP qui autorisait déjà ce domaine non plus.',
  },
];

// ── Les séries ────────────────────────────────────────────────────────────────
//
// Séries de trois ou quatre incidents. Trois par niveau (initiation N1, panorama
// mêlé, crescendo N3), trois thématiques (registres npm/PyPI, CI/CD, build et
// éditeur), et une « Mêlée » rebattue à chaque partie.

import { defineSeries, type SeriesProfile } from '../lib/series';

const mix = (n1: number, n2: number, n3: number): [number, number, number] => [n1, n2, n3];

const PROFILES: SeriesProfile<Incident>[] = [
  { id: 'initiation', title: 'Initiation', mix: mix(4, 0, 0), level: 1,
    text: 'Quatre chaînes nettes, en quatre ou cinq étapes bien distinctes. Le bon contrôle est celui qu’on cite spontanément.' },
  { id: 'registres', title: 'Registres npm & PyPI', filter: (i) => i.theme === 'registre', mix: mix(0, 4, 0), level: 2,
    text: 'Comptes détournés, mainteneurs hameçonnés, domaines rachetés : quatre incidents autour des registres de paquets.' },
  { id: 'cicd', title: 'CI/CD', filter: (i) => i.theme === 'cicd', mix: mix(0, 2, 2), level: 3,
    text: 'Workflows détournés, caches empoisonnés, jetons volés : le pipeline lui-même comme surface d’attaque.' },
  { id: 'build-editeur', title: 'Build & éditeur', filter: (i) => i.theme === 'build', level: 3,
    text: 'Le build ou le mainteneur compromis : signer, notariser, vérifier l’empreinte n’y change rien. À toi de trouver ce qui aurait tenu.' },
  { id: 'crescendo', title: 'Crescendo', mix: mix(0, 0, 4), level: 3,
    text: 'Étapes très proches à ordonner finement, et un contrôle défendable mais non décisif à démêler des vrais points de rupture.' },
  { id: 'panorama', title: 'Panorama', mix: mix(1, 2, 1), level: 2,
    text: 'Un aperçu de tout l’éventail, de la chaîne la plus lisible à la plus retorse.' },
  { id: 'melee', title: 'Mêlée', mix: mix(1, 2, 1), level: 2, shuffleEachTime: true,
    text: 'Tous niveaux confondus, recomposée à chaque partie. La seule série qu’on ne peut pas réviser.' },
];

/** Les séries de « Supply Chain Kill Chain », au format commun à tous les jeux. */
export const supplySeries = defineSeries(incidents, PROFILES);

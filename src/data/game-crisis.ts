// Jeu « Crise J+0 » (M4, M5, M14, M17) : un incident critique frappe Novafact.
// Chaque décision compte, sous horloge. Score = qualité moyenne des décisions.

export type Choice = {
  label: string;
  quality: 0 | 1 | 2;   // 2 = bonne décision, 1 = acceptable, 0 = mauvaise
  minutes: number;       // temps consommé
  feedback: string;
};

export type Decision = { situation: string; choices: Choice[] };

export type Crisis = {
  id: string;
  title: string;
  intro: string;
  budgetMin: number;     // temps disponible avant impact majeur
  decisions: Decision[];
};

export const crises: Crisis[] = [
  {
    id: 'react2shell',
    title: 'React2Shell frappe Novafact',
    intro: 'Un avis critique annonce une exécution de code à distance dans les React Server Components (React2Shell). Le back-office Next.js de Novafact est potentiellement exposé. Il est 9 h 02. Chaque décision consomme du temps ; l’exploitation de masse a déjà commencé.',
    budgetMin: 120,
    decisions: [
      {
        situation: 'Première réaction : par quoi commencer ?',
        choices: [
          { label: 'Inventorier les applications exposées en version vulnérable', quality: 2, minutes: 10, feedback: 'On ne défend que ce qu’on connaît. L’inventaire (M4) oriente tout le reste, et il évite autant de patcher au hasard que de patcher ce qui n’était pas exposé.' },
          { label: 'Couper l’accès Internet au back-office le temps d’y voir clair', quality: 1, minutes: 5, feedback: 'Radical, efficace, et coûteux : l’arrêt se justifie quand l’exploitation est confirmée et l’impact majeur. Sans inventaire, on ignore si on vient de couper la bonne chose.' },
          { label: 'Attendre le correctif officiel, annoncé pour la fin de journée', quality: 0, minutes: 30, feedback: 'Pendant une exploitation de masse, une journée d’attente est une journée d’exposition. Il faut une atténuation maintenant, même imparfaite.' },
        ],
      },
      {
        situation: 'Le back-office est confirmé vulnérable et exposé. Mesure immédiate ?',
        choices: [
          { label: 'Déployer une règle de bordure qui bloque le vecteur connu', quality: 2, minutes: 15, feedback: 'L’atténuation virtuelle (M17) réduit l’exposition en quelques minutes, ce qui laisse le temps de tester le correctif proprement au lieu de le subir.' },
          { label: 'Pousser le correctif en production sans passer par les tests', quality: 1, minutes: 20, feedback: 'Corriger reste le but, et un déploiement non testé en pleine crise ajoute une panne à l’incident. Atténuer d’abord donne le droit de corriger calmement.' },
          { label: 'Convoquer une réunion de crise avec toutes les équipes concernées', quality: 0, minutes: 25, feedback: 'La coordination est nécessaire et elle se mène en parallèle de l’action. Vingt-cinq minutes de réunion pendant une exploitation active n’atténuent rien.' },
        ],
      },
      {
        situation: 'Comment savoir si vous avez déjà été exploités ?',
        choices: [
          { label: 'Chercher les traces du vecteur dans les journaux de la période', quality: 2, minutes: 15, feedback: 'La détection (M18) répond à la seule question qui compte : sommes-nous déjà compromis ? Sans journaux exploitables, tout le reste de la réponse est une supposition.' },
          { label: 'Conclure à l’absence de compromission, faute de signalement client', quality: 0, minutes: 5, feedback: 'Un temps de résidence se mesure, il ne se déduit pas du silence : la médiane du secteur se compte en semaines, et les clients ne sont pas les premiers à voir.' },
          { label: 'Redémarrer les instances du back-office pour repartir sur une base saine', quality: 0, minutes: 10, feedback: 'Le redémarrage détruit les preuves en mémoire et masque l’étendue sans rien confirmer : on perd la capacité de savoir ce qui s’est passé, définitivement.' },
        ],
      },
      {
        situation: 'Les logs montrent une exécution suspecte sur une instance. Que faire de cette instance ?',
        choices: [
          { label: 'La mettre en quarantaine réseau, puis en prendre un instantané', quality: 2, minutes: 15, feedback: 'Contenir sans détruire (M18) : l’accès est coupé et il reste de quoi enquêter. C’est la seule option qui protège à la fois la production et l’investigation.' },
          { label: 'La terminer et laisser le groupe d’autoscaling en recréer une saine', quality: 1, minutes: 5, feedback: 'L’accès est coupé vite et bien, au prix des preuves. Et si la nouvelle instance part de la même image vulnérable, elle sera compromise à son tour.' },
          { label: 'La laisser tourner sous surveillance pour observer la suite de l’attaque', quality: 0, minutes: 10, feedback: 'L’observation a sa place, dans un environnement confiné et avec une équipe dédiée. En production, sans confinement, c’est accepter que l’attaquant progresse.' },
        ],
      },
      {
        situation: 'L’instance portait un rôle IAM. Réaction ?',
        choices: [
          { label: 'Révoquer les sessions par politique horodatée, renouveler les secrets', quality: 2, minutes: 15, feedback: 'Les identifiants temporaires déjà émis restent valides jusqu’à leur expiration : la condition aws:TokenIssueTime (M15, M18) les invalide d’un coup, sans casser le rôle.' },
          { label: 'Supprimer le rôle et en recréer un neuf pour le service', quality: 1, minutes: 10, feedback: 'Efficace et brutal : les services légitimes tombent avec le rôle, en pleine crise. La révocation horodatée obtient le même effet sans l’interruption.' },
          { label: 'Laisser le rôle en l’état : il est interne et sans droit d’administration', quality: 0, minutes: 5, feedback: 'Un rôle atteint est un rôle compromis, quel que soit son périmètre — et c’est de là que part le mouvement latéral. Sans rotation, l’accès de l’attaquant demeure.' },
        ],
      },
      {
        situation: 'La crise est contenue. Obligations de communication ?',
        choices: [
          { label: 'Qualifier l’atteinte aux données et préparer les notifications', quality: 2, minutes: 20, feedback: 'Les délais réglementaires (24 h, 72 h) courent depuis la connaissance des faits. On qualifie et on prépare en parallèle de la technique, pas après elle.' },
          { label: 'Publier tout de suite un communiqué détaillant le vecteur d’attaque', quality: 1, minutes: 10, feedback: 'La transparence est la bonne direction, et le niveau de détail se dose : publier le vecteur avant la fin de la correction arme ceux qui n’avaient pas encore cherché.' },
          { label: 'Attendre la certitude complète avant toute communication', quality: 0, minutes: 10, feedback: 'La certitude complète arrive après les délais réglementaires. Le silence prolongé expose aux sanctions et coûte la confiance que l’on cherchait à protéger.' },
        ],
      },
    ],
  },
  {
    id: 'shai-hulud',
    title: 'Une dépendance compromise (type Shai-Hulud)',
    intro: 'Une alerte signale que plusieurs paquets npm populaires ont été publiés avec un ver qui vole les secrets à l’installation. Novafact les utilise peut-être. Il est 14 h 30 : chaque install de CI ou de poste peut exfiltrer des jetons.',
    budgetMin: 120,
    decisions: [
      {
        situation: 'Premier réflexe ?',
        choices: [
          { label: 'Geler les pipelines et vérifier le lockfile contre les versions piégées', quality: 2, minutes: 10, feedback: 'On arrête l’hémorragie — plus aucune installation — puis on établit l’exposition réelle avec le SBOM et le lockfile (M14). Dans cet ordre, pas l’inverse.' },
          { label: 'Ne rien changer : les versions sont épinglées dans le lockfile', quality: 1, minutes: 5, feedback: 'L’épinglage protège vraiment, et il ne couvre que ce que le lockfile fixe : une dépendance transitive a pu bouger au dernier rafraîchissement. On vérifie.' },
          { label: 'Lancer une mise à jour générale pour partir sur les dernières versions', quality: 0, minutes: 15, feedback: 'C’est le réflexe qui aggrave : mettre à jour en aveugle pendant une campagne active installe précisément les versions piégées, que l’on vient de tirer soi-même.' },
        ],
      },
      {
        situation: 'Le SBOM confirme une version piégée en dépendance transitive. Priorité ?',
        choices: [
          { label: 'Traiter tout secret accessible aux runners comme compromis', quality: 2, minutes: 25, feedback: 'Le ver exfiltre les variables d’environnement de la CI. Seule la rotation massive — jetons de registre, jetons de forge, clés cloud — referme réellement l’accès (M14).' },
          { label: 'Retirer le paquet incriminé et relancer les pipelines', quality: 1, minutes: 10, feedback: 'Nécessaire, et insuffisant si l’installation a déjà eu lieu : les secrets sont partis avant le retrait, et le retrait ne les invalide pas.' },
          { label: 'Surveiller l’usage des secrets et n’agir qu’en cas d’abus constaté', quality: 0, minutes: 10, feedback: 'Attendre l’abus, c’est le subir : un jeton volé sert souvent des semaines plus tard, depuis une adresse qui ressemble à n’importe quelle autre.' },
        ],
      },
      {
        situation: 'Comment empêcher que ça recommence à la prochaine install ?',
        choices: [
          { label: 'Désactiver les scripts d’installation, différer l’adoption', quality: 2, minutes: 15, feedback: 'Les deux contrôles de classe (M14) qui neutralisent l’essentiel de ces attaques à la source : plus d’exécution à l’installation, et le temps que la version piégée soit retirée.' },
          { label: 'Déployer un antivirus à jour sur les postes des développeurs', quality: 1, minutes: 10, feedback: 'Une couche de plus, utile contre les charges connues. Elle ne traite pas la cause — l’exécution de code arbitraire au moment de l’installation — et arrive après coup.' },
          { label: 'Diffuser une consigne de vigilance sur les nouvelles dépendances', quality: 0, minutes: 5, feedback: 'La vigilance ne passe pas à l’échelle d’un lockfile de mille entrées, et elle reporte sur les développeurs une décision qu’aucun humain ne peut prendre.' },
        ],
      },
      {
        situation: 'Un jeton npm de Novafact a peut-être fuité. Risque spécifique ?',
        choices: [
          { label: 'Révoquer le jeton de publication et vérifier vos publications', quality: 2, minutes: 20, feedback: 'C’est le mécanisme de propagation du ver : il republie vos paquets sous votre nom. La révocation, puis le passage au trusted publishing, coupent la chaîne (M14).' },
          { label: 'Changer le mot de passe du compte de publication et activer la MFA', quality: 1, minutes: 10, feedback: 'Bon réflexe pour le compte humain, et le jeton d’automatisation continue de fonctionner sans lui : c’est cet actif-là qu’il faut révoquer en premier.' },
          { label: 'Remplacer le jeton à la prochaine rotation planifiée, dans deux semaines', quality: 0, minutes: 5, feedback: 'Deux semaines pendant lesquelles vos clients installent un paquet piégé signé de votre nom : votre incident devient le leur, et votre signature le rend crédible.' },
        ],
      },
      {
        situation: 'Communication vers les clients du SDK Novafact ?',
        choices: [
          { label: 'Publier un avis : versions touchées, versions saines, action attendue', quality: 2, minutes: 15, feedback: 'Vos clients ont besoin de savoir quoi faire, pas de connaître toute l’histoire. Les trois informations qui permettent d’agir suffisent à ouvrir un avis (M14).' },
          { label: 'Attendre la fin de l’enquête pour publier un avis exact et définitif', quality: 1, minutes: 10, feedback: 'La précision est une vraie qualité, et le silence pendant l’enquête laisse vos clients installer. Un premier avis partiel, mis à jour, vaut mieux que le bon avis trop tard.' },
          { label: 'Corriger discrètement dans une version suivante, sans avis public', quality: 0, minutes: 10, feedback: 'Ceux qui ne mettent pas à jour restent sur une version compromise sans le savoir, et ils apprendront l’incident par quelqu’un d’autre que vous.' },
        ],
      },
      {
        situation: 'Après la crise, quelle amélioration durable ?',
        choices: [
          { label: 'Provenance des artefacts, runners éphémères, playbook mis à jour', quality: 2, minutes: 20, feedback: 'On transforme l’incident en contrôles durables (M14) : c’est la différence entre une équipe qui a survécu et une équipe qui a appris.' },
          { label: 'Rédiger un retour d’expérience détaillé et le diffuser aux équipes', quality: 1, minutes: 10, feedback: 'Le récit est utile et il ne change rien tout seul : sans contrôle nouveau, la même classe d’attaque reviendra, et le document sera relu après coup.' },
          { label: 'Geler l’ajout de nouvelles dépendances jusqu’à nouvel ordre', quality: 0, minutes: 5, feedback: 'Impraticable au-delà de quelques semaines, et contourné bien avant : on gère le risque de l’écosystème, on ne le met pas en pause.' },
        ],
      },
    ],
  },
];

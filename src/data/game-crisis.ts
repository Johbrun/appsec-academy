// Jeu « Crise J+0 » (M8, M26, M18, M21) : un incident critique frappe Novafact.
// Chaque décision compte, sous horloge. Score = qualité moyenne des décisions.
//
// Une série = une crise. La difficulté ne tient pas au sujet (une clé AWS n'est
// pas « plus facile » qu'un ver npm) mais à la **structure des décisions** :
//
//   N1 · Le déroulé suit l'ordre canonique d'une réponse à incident — couper,
//        mesurer, contenir, remplacer, prévenir. À chaque décision, l'indice
//        qui tranche est dans la situation, et la mauvaise option est une faute
//        visible (attendre, détruire, ignorer). L'option « acceptable » fait la
//        bonne chose trop tôt, trop fort ou à moitié. Horloge large.
//
//   N2 · Chaque décision a son **leurre** : une option juste dans l'absolu et
//        fausse ici, pour une raison de contexte donnée dans la situation (le
//        mode d'hébergement, une dépendance transitive, le jeton plutôt que le
//        mot de passe, le journal qui garde ou non les en-têtes). Les décisions
//        s'enchaînent : un résultat obtenu à la décision 3 change la réponse à
//        la décision 4. Horloge serrée par endroits.
//
//   N3 · L'option **radicale** (tout couper, tout purger, tout révoquer) est un
//        piège : elle détruit les preuves, la voie de récupération ou
//        l'activité. Au moins une décision porte sur une **absence** (un journal
//        non activé, une rétention trop courte), et au moins une sur le droit,
//        avec un vrai délai : Novafact est sous-traitante pour les factures de
//        ses clients (RGPD art. 33.2), responsable de traitement pour ses
//        propres comptes, et le délai de 72 h de l'article 33.1 appartient au
//        responsable. Horloge juste : le chemin optimal tient dans la fenêtre,
//        les détours non.
//
// Quand une crise s'appuie sur un cas réel, `source` le dit, et dit ce qui a
// été transposé à Novafact.

import { defineSeries, type Level } from '../lib/series';

export type Choice = {
  label: string;
  quality: 0 | 1 | 2;   // 2 = bonne décision, 1 = acceptable, 0 = mauvaise
  minutes: number;       // temps consommé
  feedback: string;
};

export type Decision = { situation: string; choices: Choice[] };

export type Crisis = {
  id: string;
  level: Level;
  avoid?: string[];
  title: string;
  intro: string;
  /** Le cas réel dont la crise s'inspire, et ce qui a été transposé. */
  source?: string;
  budgetMin: number;     // temps disponible avant impact majeur
  decisions: Decision[];
};

export const crises: Crisis[] = [
  {
    id: 'cle-aws-publique',
    level: 1,
    title: 'Une clé AWS dans un dépôt public',
    intro: 'Mardi, 11 h 20. GitHub et AWS alertent en même temps : une clé d’accès de l’utilisateur IAM ci-deploy-legacy a été poussée il y a douze minutes dans un dépôt public, au milieu d’un script de déploiement. AWS a déjà attaché à l’utilisateur sa politique de quarantaine, AWSCompromisedKeyQuarantineV3. Des robots parcourent GitHub en continu : on compte en minutes.',
    source: 'Appui réel : dans la campagne EleKtra-Leak (Unit 42, 2023), des clés AWS publiées sur GitHub étaient utilisées moins de cinq minutes après leur exposition, malgré la quarantaine appliquée par AWS. La fuite de Novafact est fictive.',
    budgetMin: 90,
    decisions: [
      {
        situation: 'La clé est publique depuis douze minutes, et AWS l’a mise en quarantaine. Premier geste ?',
        choices: [
          { label: 'Passer la clé au statut inactif, sans la supprimer encore', quality: 2, minutes: 5, feedback: 'Une clé inactive ne signe plus aucune requête, et le geste est réversible si un service légitime en dépendait encore. La suppression viendra une fois l’usage établi : l’inactivation suffit à couper l’accès (M19).' },
          { label: 'Réécrire l’historique du dépôt pour effacer le commit fautif', quality: 1, minutes: 15, feedback: 'Il faudra le faire, et ça ne révoque rien : la clé a pu être copiée par les robots qui scrutent GitHub, et elle reste dans chaque clone et chaque fork. On coupe l’accès d’abord, on nettoie ensuite.' },
          { label: 'Rien de plus : la quarantaine d’AWS neutralise déjà la clé', quality: 0, minutes: 2, feedback: 'La politique de quarantaine refuse une longue liste d’actions coûteuses ou destructrices (EC2, IAM, lecture S3…), pas tout : secretsmanager:GetSecretValue, par exemple, n’y figure pas. Ce qu’elle ne refuse pas, la clé le peut toujours.' },
        ],
      },
      {
        situation: 'La clé est inactive. Comment savoir ce qu’elle a fait entre-temps ?',
        choices: [
          { label: 'Chercher dans CloudTrail les appels signés par cette clé', quality: 2, minutes: 10, feedback: 'CloudTrail enregistre l’identifiant de clé de chaque appel : on obtient la liste exacte, région par région, de ce qui a été tenté et de ce qui a réussi (M23).' },
          { label: 'Surveiller de près la facture AWS pendant les prochains jours', quality: 1, minutes: 5, feedback: 'Le minage de cryptomonnaie finit par se voir sur la facture, des jours plus tard ; une lecture de données n’y apparaît jamais. C’est un signal d’appoint, pas une enquête.' },
          { label: 'Lire les journaux de l’application que ce script déploie', quality: 0, minutes: 10, feedback: 'La clé parle à l’API d’AWS, pas à l’application : ses traces sont dans CloudTrail. Les journaux applicatifs ne verront rien de ce qu’elle a fait.' },
        ],
      },
      {
        situation: 'CloudTrail montre, six minutes après le push et depuis une adresse inconnue : GetCallerIdentity réussi, ListBuckets et RunInstances refusés, puis GetSecretValue réussi sur le secret de la base de facturation. Réaction ?',
        choices: [
          { label: 'Changer le mot de passe de la base, puis tracer son usage', quality: 2, minutes: 20, feedback: 'Le seul appel qui a abouti est celui qui compte : le mot de passe de la base est désormais connu de l’attaquant. Tout ce que la clé pouvait lire est à considérer comme lu, et ce secret-là se remplace en priorité (M19).' },
          { label: 'Restreindre l’accès réseau de la base aux services internes', quality: 1, minutes: 15, feedback: 'Bonne mesure : un mot de passe seul ne suffit plus si la base est injoignable de l’extérieur. Mais le secret reste compromis, et le premier accès interne venu s’en servira.' },
          { label: 'Conclure à un échec de l’attaquant : il a surtout essuyé des refus', quality: 0, minutes: 5, feedback: 'Deux refus ne font pas un échec : on juge une tentative à ce qui a réussi. GetSecretValue a abouti, et c’est le secret de la base de facturation.' },
        ],
      },
      {
        situation: 'La clé servait encore au déploiement d’un vieux service. Comment le remettre en marche ?',
        choices: [
          { label: 'Remplacer la clé par un rôle assumé via OIDC depuis la CI', quality: 2, minutes: 20, feedback: 'Plus de secret de longue durée à fuiter : la CI obtient des identifiants temporaires, liés au dépôt et à la branche (M18, M19). On traite la cause, pas le symptôme.' },
          { label: 'Créer une nouvelle clé et la ranger dans les secrets GitHub', quality: 1, minutes: 10, feedback: 'Mieux rangée, la nouvelle clé reste un secret de longue durée : la prochaine fuite, par un journal de build ou un poste de développeur, rejouera cette crise.' },
          { label: 'Réactiver l’ancienne clé, puisque le mot de passe a changé', quality: 0, minutes: 5, feedback: 'Une clé publiée est brûlée, quoi qu’elle ait servi à faire : des copies circulent, et l’attaquant n’attend que son retour. Changer le secret qu’elle a lu ne la rend pas saine.' },
        ],
      },
      {
        situation: 'Le dépôt public contient toujours le commit. Que faire du dépôt ?',
        choices: [
          { label: 'Purger l’historique, en sachant que les forks gardent la clé', quality: 2, minutes: 15, feedback: 'Le nettoyage limite les copies futures, sans illusion : c’est la révocation qui rend la clé inoffensive. La purge sert l’hygiène, la révocation sert la sécurité.' },
          { label: 'Passer le dépôt en privé et s’en tenir là', quality: 1, minutes: 5, feedback: 'Plus personne ne le lit de l’extérieur, et les copies déjà faites restent dehors. Le secret, lui, demeure dans l’historique pour chaque futur collaborateur.' },
          { label: 'Supprimer le dépôt pour faire disparaître toute trace de la clé', quality: 0, minutes: 5, feedback: 'On détruit l’historique qui dit qui a poussé quoi et quand — la chronologie dont l’enquête a besoin — sans retirer une seule copie déjà faite.' },
        ],
      },
      {
        situation: 'Comment éviter que ça recommence ?',
        choices: [
          { label: 'Protection au push, et plus aucune clé IAM de longue durée', quality: 2, minutes: 15, feedback: 'Deux contrôles de classe : le push est refusé quand il contient un secret reconnu, et il n’existe plus de clé de longue durée à pousser (M18). La vigilance devient un filet, plus le mur porteur.' },
          { label: 'Une formation de toute l’équipe à la bonne gestion des secrets', quality: 1, minutes: 10, feedback: 'Utile, et insuffisant seul : l’erreur de ce matin tient d’un geste distrait, pas d’une ignorance. Un contrôle automatique l’aurait arrêtée, une formation l’aurait seulement rendue moins probable.' },
          { label: 'Interdire tout dépôt public dans l’organisation GitHub', quality: 0, minutes: 5, feedback: 'La mesure ferme une porte, pas la classe : la même clé fuit par un journal de build, un ticket ou un gist. Et le SDK open source de Novafact a besoin d’un dépôt public.' },
        ],
      },
    ],
  },
  {
    id: 'react2shell',
    level: 1,
    title: 'React2Shell frappe Novafact',
    intro: 'Un avis critique annonce une exécution de code à distance sans authentification dans les React Server Components (React2Shell). Le back-office Next.js de Novafact est potentiellement exposé. Il est 9 h 02. Chaque décision consomme du temps ; l’exploitation de masse a déjà commencé.',
    source: 'Cas réel : CVE-2025-55182, dite React2Shell (décembre 2025), une désérialisation non sûre dans le protocole Flight des Server Components, exploitée dans les heures qui ont suivi sa publication. Le back-office Novafact est fictif.',
    budgetMin: 120,
    decisions: [
      {
        situation: 'Première réaction : par quoi commencer ?',
        choices: [
          { label: 'Inventorier les applications exposées en version vulnérable', quality: 2, minutes: 10, feedback: 'On ne défend que ce qu’on connaît. L’inventaire (M8) oriente tout le reste, et il évite autant de patcher au hasard que de patcher ce qui n’était pas exposé.' },
          { label: 'Couper l’accès Internet au back-office le temps d’y voir clair', quality: 1, minutes: 5, feedback: 'Radical, efficace, et coûteux : l’arrêt se justifie quand l’exploitation est confirmée et l’impact majeur. Sans inventaire, on ignore si on vient de couper la bonne chose.' },
          { label: 'Attendre la fenêtre de maintenance de jeudi pour corriger', quality: 0, minutes: 30, feedback: 'Le correctif existe dès la publication de l’avis, et l’exploitation a commencé dans les heures qui ont suivi : trois jours d’attente sont trois jours d’exposition. Il faut une atténuation maintenant, même imparfaite.' },
        ],
      },
      {
        situation: 'Le back-office est confirmé vulnérable et exposé. Mesure immédiate ?',
        choices: [
          { label: 'Déployer une règle de bordure qui bloque le vecteur connu', quality: 2, minutes: 15, feedback: 'L’atténuation virtuelle (M21) réduit l’exposition en quelques minutes, ce qui laisse le temps de tester le correctif proprement au lieu de le subir.' },
          { label: 'Pousser le correctif en production sans passer par les tests', quality: 1, minutes: 20, feedback: 'Corriger reste le but, et un déploiement non testé en pleine crise ajoute une panne à l’incident. Atténuer d’abord donne le droit de corriger calmement.' },
          { label: 'Convoquer une réunion de crise avec toutes les équipes concernées', quality: 0, minutes: 25, feedback: 'La coordination est nécessaire et elle se mène en parallèle de l’action. Vingt-cinq minutes de réunion pendant une exploitation active n’atténuent rien.' },
        ],
      },
      {
        situation: 'Comment savoir si vous avez déjà été exploités ?',
        choices: [
          { label: 'Chercher les traces du vecteur dans les journaux de la période', quality: 2, minutes: 15, feedback: 'La détection (M24) répond à la seule question qui compte : sommes-nous déjà compromis ? Sans journaux exploitables, tout le reste de la réponse est une supposition.' },
          { label: 'Conclure à l’absence de compromission, faute de signalement client', quality: 0, minutes: 5, feedback: 'Un temps de résidence se mesure, il ne se déduit pas du silence : la médiane du secteur se compte en semaines, et les clients ne sont pas les premiers à voir.' },
          { label: 'Redémarrer les instances du back-office pour repartir sur une base saine', quality: 0, minutes: 10, feedback: 'Le redémarrage détruit les preuves en mémoire et masque l’étendue sans rien confirmer : on perd la capacité de savoir ce qui s’est passé, définitivement.' },
        ],
      },
      {
        situation: 'Les logs montrent une exécution suspecte sur une instance. Que faire de cette instance ?',
        choices: [
          { label: 'La mettre en quarantaine réseau, puis en prendre un instantané', quality: 2, minutes: 15, feedback: 'Contenir sans détruire (M24) : l’accès est coupé et il reste de quoi enquêter. C’est la seule option qui protège à la fois la production et l’investigation.' },
          { label: 'La terminer et laisser le groupe d’autoscaling en recréer une saine', quality: 1, minutes: 5, feedback: 'L’accès est coupé vite et bien, au prix des preuves. Et si la nouvelle instance part de la même image vulnérable, elle sera compromise à son tour.' },
          { label: 'La laisser tourner sous surveillance pour observer la suite de l’attaque', quality: 0, minutes: 10, feedback: 'L’observation a sa place, dans un environnement confiné et avec une équipe dédiée. En production, sans confinement, c’est accepter que l’attaquant progresse.' },
        ],
      },
      {
        situation: 'L’instance portait un rôle IAM. Réaction ?',
        choices: [
          { label: 'Révoquer les sessions par politique horodatée, renouveler les secrets', quality: 2, minutes: 15, feedback: 'Les identifiants temporaires déjà émis restent valides jusqu’à leur expiration : la condition aws:TokenIssueTime (M19, M24) les invalide d’un coup, sans casser le rôle.' },
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
    level: 2,
    title: 'Une dépendance compromise (type Shai-Hulud)',
    intro: 'Une alerte signale que plusieurs paquets npm populaires ont été publiés avec un ver qui vole les secrets à l’installation. Novafact les utilise peut-être. Il est 14 h 30 : chaque install de CI ou de poste peut exfiltrer des jetons.',
    budgetMin: 120,
    decisions: [
      {
        situation: 'Premier réflexe ?',
        choices: [
          { label: 'Geler les pipelines et vérifier le lockfile contre les versions piégées', quality: 2, minutes: 10, feedback: 'On arrête l’hémorragie — plus aucune installation — puis on établit l’exposition réelle avec le SBOM et le lockfile (M18). Dans cet ordre, pas l’inverse.' },
          { label: 'Ne rien changer : les versions sont épinglées dans le lockfile', quality: 1, minutes: 5, feedback: 'L’épinglage protège vraiment, et il ne couvre que ce que le lockfile fixe : une dépendance transitive a pu bouger au dernier rafraîchissement. On vérifie.' },
          { label: 'Lancer une mise à jour générale pour partir sur les dernières versions', quality: 0, minutes: 15, feedback: 'C’est le réflexe qui aggrave : mettre à jour en aveugle pendant une campagne active installe précisément les versions piégées, que l’on vient de tirer soi-même.' },
        ],
      },
      {
        situation: 'Le SBOM confirme une version piégée en dépendance transitive. Priorité ?',
        choices: [
          { label: 'Traiter tout secret accessible aux runners comme compromis', quality: 2, minutes: 25, feedback: 'Le ver exfiltre les variables d’environnement de la CI. Seule la rotation massive — jetons de registre, jetons de forge, clés cloud — referme réellement l’accès (M18).' },
          { label: 'Retirer le paquet incriminé et relancer les pipelines', quality: 1, minutes: 10, feedback: 'Nécessaire, et insuffisant si l’installation a déjà eu lieu : les secrets sont partis avant le retrait, et le retrait ne les invalide pas.' },
          { label: 'Surveiller l’usage des secrets et n’agir qu’en cas d’abus constaté', quality: 0, minutes: 10, feedback: 'Attendre l’abus, c’est le subir : un jeton volé sert souvent des semaines plus tard, depuis une adresse qui ressemble à n’importe quelle autre.' },
        ],
      },
      {
        situation: 'Comment empêcher que ça recommence à la prochaine install ?',
        choices: [
          { label: 'Désactiver les scripts d’installation, différer l’adoption', quality: 2, minutes: 15, feedback: 'Les deux contrôles de classe (M18) qui neutralisent l’essentiel de ces attaques à la source : plus d’exécution à l’installation, et le temps que la version piégée soit retirée.' },
          { label: 'Déployer un antivirus à jour sur les postes des développeurs', quality: 1, minutes: 10, feedback: 'Une couche de plus, utile contre les charges connues. Elle ne traite pas la cause — l’exécution de code arbitraire au moment de l’installation — et arrive après coup.' },
          { label: 'Diffuser une consigne de vigilance sur les nouvelles dépendances', quality: 0, minutes: 5, feedback: 'La vigilance ne passe pas à l’échelle d’un lockfile de mille entrées, et elle reporte sur les développeurs une décision qu’aucun humain ne peut prendre.' },
        ],
      },
      {
        situation: 'Un jeton npm de Novafact a peut-être fuité. Risque spécifique ?',
        choices: [
          { label: 'Révoquer le jeton de publication et vérifier vos publications', quality: 2, minutes: 20, feedback: 'C’est le mécanisme de propagation du ver : il republie vos paquets sous votre nom. La révocation, puis le passage au trusted publishing, coupent la chaîne (M18).' },
          { label: 'Changer le mot de passe du compte de publication et activer la MFA', quality: 1, minutes: 10, feedback: 'Bon réflexe pour le compte humain, et le jeton d’automatisation continue de fonctionner sans lui : c’est cet actif-là qu’il faut révoquer en premier.' },
          { label: 'Remplacer le jeton à la prochaine rotation planifiée, dans deux semaines', quality: 0, minutes: 5, feedback: 'Deux semaines pendant lesquelles vos clients installent un paquet piégé signé de votre nom : votre incident devient le leur, et votre signature le rend crédible.' },
        ],
      },
      {
        situation: 'Communication vers les clients du SDK Novafact ?',
        choices: [
          { label: 'Publier un avis : versions touchées, versions saines, action attendue', quality: 2, minutes: 15, feedback: 'Vos clients ont besoin de savoir quoi faire, pas de connaître toute l’histoire. Les trois informations qui permettent d’agir suffisent à ouvrir un avis (M18).' },
          { label: 'Attendre la fin de l’enquête pour publier un avis exact et définitif', quality: 1, minutes: 10, feedback: 'La précision est une vraie qualité, et le silence pendant l’enquête laisse vos clients installer. Un premier avis partiel, mis à jour, vaut mieux que le bon avis trop tard.' },
          { label: 'Corriger discrètement dans une version suivante, sans avis public', quality: 0, minutes: 10, feedback: 'Ceux qui ne mettent pas à jour restent sur une version compromise sans le savoir, et ils apprendront l’incident par quelqu’un d’autre que vous.' },
        ],
      },
      {
        situation: 'Après la crise, quelle amélioration durable ?',
        choices: [
          { label: 'Provenance des artefacts, runners éphémères, playbook mis à jour', quality: 2, minutes: 20, feedback: 'On transforme l’incident en contrôles durables (M18) : c’est la différence entre une équipe qui a survécu et une équipe qui a appris.' },
          { label: 'Rédiger un retour d’expérience détaillé et le diffuser aux équipes', quality: 1, minutes: 10, feedback: 'Le récit est utile et il ne change rien tout seul : sans contrôle nouveau, la même classe d’attaque reviendra, et le document sera relu après coup.' },
          { label: 'Geler l’ajout de nouvelles dépendances jusqu’à nouvel ordre', quality: 0, minutes: 5, feedback: 'Impraticable au-delà de quelques semaines, et contourné bien avant : on gère le risque de l’écosystème, on ne le met pas en pause.' },
        ],
      },
    ],
  },
  {
    id: 'next-middleware',
    level: 2,
    title: 'Le middleware contourné (CVE-2025-29927)',
    intro: 'Un avis publié ce matin décrit CVE-2025-29927 : envoyé par le client, un en-tête interne de Next.js, x-middleware-subrequest, fait sauter l’exécution du middleware. Le back-office de Novafact tourne en Next.js 15.1, auto-hébergé sur ECS Fargate derrière CloudFront et AWS WAF, et c’est son middleware qui vérifie la session sur /admin. Il est 8 h 45 ; la technique tient en un en-tête.',
    source: 'Cas réel : CVE-2025-29927, rendue publique le 21 mars 2025, corrigée en 15.2.3, 14.2.25, 13.5.9 et 12.3.5. Les serveurs Next.js auto-hébergés étaient exposés, pas les applications servies par Vercel ou Netlify. Le contexte Novafact est fictif.',
    budgetMin: 95,
    decisions: [
      {
        situation: 'Êtes-vous concernés ?',
        choices: [
          { label: 'Vérifier la version déployée et le mode d’hébergement', quality: 2, minutes: 10, feedback: 'Les deux conditions comptent : une version non corrigée, et un serveur Next.js auto-hébergé (next start ou sortie standalone). Les applications servies par Vercel ou Netlify n’étaient pas exposées ; celle de Novafact, sur Fargate, l’est.' },
          { label: 'Rien à faire : l’avis précise que Vercel protège ses clients', quality: 0, minutes: 5, feedback: 'Vercel protégeait les applications hébergées chez lui, où le routage est découplé du serveur. Novafact s’héberge sur ECS : c’est précisément le cas exposé. Lire l’avis jusqu’au bout fait partie de l’inventaire.' },
          { label: 'Lancer la preuve de concept publique contre la production', quality: 1, minutes: 10, feedback: 'Ça confirme, et vite — au prix d’un test offensif improvisé en production, qui brouille les journaux qu’il faudra lire ensuite. La version et le mode d’hébergement donnent la même réponse sans risque.' },
        ],
      },
      {
        situation: 'Vous êtes exposés. Le correctif doit passer par la chaîne complète : 40 minutes de tests. En attendant ?',
        choices: [
          { label: 'Une règle AWS WAF qui bloque toute requête portant l’en-tête', quality: 2, minutes: 10, feedback: 'C’est le contournement que recommande l’avis : l’en-tête n’a aucune raison légitime de venir de l’extérieur. Dix minutes d’atténuation achètent le droit de tester le correctif au lieu de le subir (M21).' },
          { label: 'Déployer la 15.2.3 en sautant les tests, pour gagner du temps', quality: 1, minutes: 15, feedback: 'La bonne version, au mauvais rythme : une montée de version non testée en pleine crise risque la panne. La règle WAF couvre l’intervalle, et le correctif suit son chemin normal.' },
          { label: 'Limiter au WAF le débit des requêtes vers /admin', quality: 0, minutes: 10, feedback: 'Le contournement tient en une requête : il n’y a rien à ralentir. La limitation de débit répond à la force brute, pas à un en-tête qui désactive un contrôle.' },
        ],
      },
      {
        situation: 'La règle est en place. Que risquait-on réellement pendant l’exposition ?',
        choices: [
          { label: 'Lire ce que les routes /admin revérifient sans le middleware', quality: 2, minutes: 15, feedback: 'Le contournement ne supprime que le middleware. Si chaque route handler et chaque server action revérifie la session, il ne reste qu’une coquille vide ; si l’un d’eux s’en remettait au middleware, c’est lui la fuite (M14).' },
          { label: 'Considérer tout le back-office comme exposé et prévenir', quality: 1, minutes: 10, feedback: 'Prudent, et prématuré : sans savoir ce qui répondait réellement sans session, on alarme tous les clients pour un périmètre peut-être vide. Un quart d’heure de lecture de code change la réponse.' },
          { label: 'Classer le risque en faible : le middleware ne fait que rediriger', quality: 0, minutes: 5, feedback: 'Rediriger vers /login, c’est justement le contrôle d’accès : sans lui, la requête atteint la page. Le risque se mesure à ce que la page sert, pas à ce que fait le middleware.' },
        ],
      },
      {
        situation: 'Une route, /admin/exports, sert des données sans revérifier la session. Où chercher une exploitation ?',
        choices: [
          { label: 'Dans les journaux AWS WAF, qui gardent les en-têtes reçus', quality: 2, minutes: 10, feedback: 'L’en-tête malveillant n’apparaît que là : les journaux WAF conservent les en-têtes de chaque requête inspectée. Les journaux d’accès de l’ALB n’en gardent aucun, et l’application n’a rien vu d’un middleware qui ne s’est pas exécuté (M23).' },
          { label: 'Dans les journaux d’accès de l’ALB, filtrés sur /admin/exports', quality: 1, minutes: 10, feedback: 'On y voit les requêtes vers la route et leurs codes de réponse, sans l’en-tête qui les distingue d’un accès légitime. Utile pour recouper, insuffisant pour qualifier.' },
          { label: 'Dans les journaux applicatifs écrits par le middleware', quality: 0, minutes: 5, feedback: 'Une requête qui contourne le middleware ne passe pas par lui : il n’a rien pu écrire. Chercher la trace d’un contrôle là où il ne s’est pas exécuté, c’est chercher sous le lampadaire.' },
        ],
      },
      {
        situation: 'Les journaux WAF montrent 14 requêtes portant l’en-tête vers /admin/exports ce matin, toutes en 200. Et maintenant ?',
        choices: [
          { label: 'Qualifier les exports servis, ouvrir un dossier de violation', quality: 2, minutes: 20, feedback: 'Des exports de factures servis sans authentification sont une violation de données jusqu’à preuve du contraire. Pour ces données, Novafact est sous-traitante : elle informe ses clients sans délai excessif (RGPD art. 33.2), et c’est leur délai de 72 h qui démarre.' },
          { label: 'Bloquer l’adresse source au WAF et surveiller la suite', quality: 1, minutes: 5, feedback: 'Le blocage ne coûte rien et ne répond pas à la question : ce qui est parti est parti. Et la règle sur l’en-tête arrête déjà cette adresse comme toutes les autres.' },
          { label: 'Invalider toutes les sessions d’administration par précaution', quality: 0, minutes: 10, feedback: 'Le contournement n’utilise aucune session : il s’en passe. Invalider celles des administrateurs dérange l’équipe sans toucher à l’attaquant.' },
        ],
      },
      {
        situation: 'Le correctif 15.2.3 est déployé. Quelle leçon durable ?',
        choices: [
          { label: 'Revérifier la session dans chaque route, près des données', quality: 2, minutes: 15, feedback: 'Le middleware redevient ce qu’il aurait dû être : un premier filtre. La vérification dans la couche d’accès aux données survit à la prochaine faille du framework (M13, M16).' },
          { label: 'Garder la règle WAF sur l’en-tête de façon permanente', quality: 1, minutes: 5, feedback: 'Bonne hygiène, et propre à cette faille : la prochaine façon de contourner le middleware ne passera pas par cet en-tête.' },
          { label: 'Figer la version de Next.js pour éviter toute régression future', quality: 0, minutes: 5, feedback: 'Figer la version, c’est garantir de rester exposé à la prochaine faille : c’est la capacité à monter de version en quelques heures qui protège (M26).' },
        ],
      },
    ],
  },
  {
    id: 'bola-chercheur',
    level: 2,
    title: 'Un chercheur, et des factures qui ne sont pas les siennes',
    intro: 'Lundi, 10 h. Un chercheur écrit à l’adresse publiée dans security.txt : GET /api/v2/invoices/{id}/pdf renvoie le PDF de n’importe quel tenant, et les identifiants se suivent. Il joint trois factures d’autres clients en preuve, dit en avoir consulté une vingtaine, et annonce une publication dans 90 jours.',
    budgetMin: 110,
    decisions: [
      {
        situation: 'Comment répondre au chercheur ?',
        choices: [
          { label: 'Accuser réception dans la journée, demander d’effacer les PDF', quality: 2, minutes: 10, feedback: 'Répondre vite garde le chercheur dans un processus coordonné ; lui demander d’effacer ce qu’il a téléchargé limite l’exposition. Un interlocuteur nommé vaut mieux que le silence (M26).' },
          { label: 'Corriger d’abord, puis répondre avec la preuve du correctif', quality: 1, minutes: 5, feedback: 'L’ordre paraît efficace, et plusieurs jours de silence poussent souvent un chercheur à relancer publiquement. Un accusé de réception ne coûte rien et n’engage à rien.' },
          { label: 'Rappeler par écrit que l’accès aux données de tiers est un délit', quality: 0, minutes: 10, feedback: 'La menace juridique transforme un signalement coordonné en publication immédiate, et elle décourage les suivants. Le chercheur a fait exactement ce que votre security.txt lui demandait.' },
        ],
      },
      {
        situation: 'Le défaut est reproduit avec deux tenants de test. Quel correctif ?',
        choices: [
          { label: 'Ajouter le tenant de l’appelant au filtre de la requête', quality: 2, minutes: 15, feedback: 'La requête ne cherche plus « la facture 1234 » mais « la facture 1234 de ce tenant » : une facture étrangère devient introuvable, quel que soit l’identifiant envoyé (M13).' },
          { label: 'Remplacer les identifiants séquentiels par des UUID aléatoires', quality: 1, minutes: 25, feedback: 'L’énumération devient impraticable, et l’autorisation manque toujours : tout identifiant qui circule — dans un e-mail, un lien partagé, les trois PDF du chercheur — reste lisible par n’importe quel compte.' },
          { label: 'Limiter la route à 100 requêtes par minute et par compte', quality: 0, minutes: 10, feedback: 'Une facture volée n’a pas besoin de mille requêtes. La limitation ralentit l’aspiration en masse et laisse passer chaque accès illégitime.' },
        ],
      },
      {
        situation: 'Le correctif est en production. Le chercheur est-il le seul à avoir trouvé ?',
        choices: [
          { label: 'Croiser chaque lecture journalisée avec le tenant de la facture', quality: 2, minutes: 20, feedback: 'Un accès illégitime se reconnaît à une chose : le tenant de l’appelant diffère de celui de la facture. Les journaux donnent l’un, la base donne l’autre ; la jointure donne la réponse (M23).' },
          { label: 'Chercher les comptes au débit anormalement élevé sur cette route', quality: 1, minutes: 10, feedback: 'On attrape l’aspiration massive et on manque l’accès lent et ciblé, souvent le plus rentable. Le volume est un symptôme possible, pas la définition de l’abus.' },
          { label: 'Chercher les requêtes venues de l’adresse du chercheur', quality: 0, minutes: 5, feedback: 'On vérifie ce qu’on sait déjà. Toute la question est de savoir si quelqu’un d’autre, qui n’a rien signalé, a trouvé la même chose.' },
        ],
      },
      {
        situation: 'La jointure sort les 22 lectures du chercheur, et 1 800 lectures inter-tenants depuis un autre compte, étalées sur trois semaines. Qualification ?',
        choices: [
          { label: 'Violation avérée : prévenir sans délai les clients touchés', quality: 2, minutes: 15, feedback: 'Pour les factures, Novafact est sous-traitante : elle informe chaque client concerné sans délai excessif (RGPD art. 33.2), avec la liste des documents lus. Aux clients, responsables de traitement, de notifier la CNIL sous 72 h et de juger du risque pour les personnes.' },
          { label: 'Notifier la CNIL au nom de Novafact, et les clients ensuite', quality: 1, minutes: 15, feedback: 'Le réflexe de transparence est bon, l’ordre ne l’est pas : les responsables de traitement sont vos clients. Notifier à leur place sans les prévenir les prive de ce dont ils ont besoin pour leurs propres obligations.' },
          { label: 'Traiter le dossier comme une recherche de bonne foi', quality: 0, minutes: 5, feedback: 'Pour les 22 lectures du chercheur, la discussion était ouverte ; les 1 800 lectures de l’autre compte changent tout. Le détail qui qualifie l’incident est dans la jointure, pas dans le courriel du chercheur.' },
        ],
      },
      {
        situation: 'Le chercheur demande quand il pourra publier.',
        choices: [
          { label: 'Fixer une date après l’information des clients, avec crédit', quality: 2, minutes: 10, feedback: 'La divulgation coordonnée sert tout le monde : vos clients sont prévenus avant le public, et le chercheur publie un cas corrigé et crédité. C’est ce qui fait revenir les bons chercheurs (M26).' },
          { label: 'Publier votre propre avis tout de suite, avant celui du chercheur', quality: 1, minutes: 10, feedback: 'La transparence est la bonne direction, et prendre le chercheur de vitesse abîme la relation. Surtout, un avis public avant l’information des clients leur fait apprendre l’incident par la presse.' },
          { label: 'Proposer une prime contre l’engagement de ne jamais publier', quality: 0, minutes: 5, feedback: 'Acheter le silence ne corrige rien : c’est une dette que la prochaine fuite fera payer, et les chercheurs savent reconnaître ces programmes.' },
        ],
      },
      {
        situation: 'Comment éviter la même classe ailleurs dans l’API ?',
        choices: [
          { label: 'Tenant imposé dans l’accès aux données, tests inter-tenants', quality: 2, minutes: 20, feedback: 'Le filtre de tenant ne dépend plus de chaque route, il devient impossible à oublier ; et un test tente systématiquement de lire la donnée d’un autre tenant (M14, M17).' },
          { label: 'Ajouter le même contrôle, route par route, là où il manque', quality: 1, minutes: 15, feedback: 'Chaque route corrigée est une route sûre, et la prochaine route écrite repartira de zéro. On corrige les instances, pas la classe.' },
          { label: 'Chiffrer les identifiants dans les URL pour les rendre opaques', quality: 0, minutes: 10, feedback: 'L’opacité retarde la découverte sans rien interdire : c’est l’autorisation qui manque, pas le secret de l’identifiant.' },
        ],
      },
    ],
  },
  {
    id: 'comptes-pilles',
    level: 3,
    title: 'Des comptes clients pillés (type Snowflake 2024)',
    intro: 'Jeudi, 15 h. Un client grand compte signale que ses factures sont proposées sur un forum. Les journaux montrent des connexions réussies, depuis des VPN commerciaux, sur douze comptes clients sans second facteur — le bon mot de passe du premier coup — suivies d’exports massifs. Aucune faille applicative n’est connue. Le client a déjà prévenu son DPO.',
    source: 'D’après la campagne UNC5537 contre des clients de Snowflake (Mandiant, 2024) : identifiants volés par des infostealers, certains dès 2020, comptes sans MFA, aucune liste d’adresses autorisées, environ 165 organisations prévenues. Snowflake n’avait pas été piratée ; ses clients, si. Transposé à Novafact.',
    budgetMin: 95,
    decisions: [
      {
        situation: 'Premier geste, avant toute annonce ?',
        choices: [
          { label: 'Chercher les indicateurs de l’attaquant sur tous les tenants', quality: 2, minutes: 15, feedback: 'Douze comptes signalés ne font pas douze comptes touchés. Adresses de sortie et signature de l’outil se cherchent sur toute la plateforme : c’est ainsi que Mandiant est passé d’une victime à environ 165 organisations (M23).' },
          { label: 'Suspendre les douze comptes signalés et révoquer leurs jetons', quality: 1, minutes: 10, feedback: 'Nécessaire, et trop étroit à ce stade : on contient ce qu’on sait déjà, pas ce que l’attaquant fait ailleurs pendant ce temps.' },
          { label: 'Réinitialiser tous les mots de passe, purger toutes les sessions', quality: 0, minutes: 10, feedback: 'Des milliers d’utilisateurs bloqués pour une douzaine de comptes, et la table des sessions actives effacée : c’est elle qui disait où l’attaquant est encore connecté. L’option radicale détruit l’indice dont l’enquête a besoin.' },
        ],
      },
      {
        situation: 'Les indicateurs sortent 31 comptes touchés, dont 9 encore connectés. Confinement ?',
        choices: [
          { label: 'Copier l’état des sessions, puis couper ces comptes et jetons', quality: 2, minutes: 15, feedback: 'On fige la preuve (sessions, adresses, jetons) avant de la faire disparaître, puis on coupe exactement ce qui est compromis. Les autres clients continuent de facturer (M23).' },
          { label: 'Bloquer au WAF les plages des VPN commerciaux utilisés', quality: 1, minutes: 10, feedback: 'Ça gêne l’attaquant une heure : il changera de fournisseur ou passera par un serveur loué. Et les mots de passe volés restent valides.' },
          { label: 'Supprimer du stockage les exports générés par l’attaquant', quality: 0, minutes: 5, feedback: 'Les fichiers d’export disent exactement quelles données sont parties, et quand. Les effacer ne rappelle aucune copie et détruit la mesure de la fuite.' },
        ],
      },
      {
        situation: 'Les journaux applicatifs ne gardent que 30 jours, et les premières connexions suspectes datent de 41 jours. Les journaux d’accès CloudFront, eux, sont conservés un an dans S3. Comment dater le début ?',
        choices: [
          { label: 'Reconstituer les exports anciens depuis les journaux CloudFront', quality: 2, minutes: 20, feedback: 'Les journaux applicatifs ne remontent pas assez loin, ceux du CDN si : chaque téléchargement d’export y figure, avec l’adresse. Un trou de rétention se comble ailleurs ; il ne se présume pas vide.' },
          { label: 'Considérer ces comptes touchés depuis leur création', quality: 1, minutes: 10, feedback: 'Honnête sur l’incertitude, et démesuré : on notifie des années d’historique quand d’autres journaux permettent de dater. Le pire cas se réserve à ce qu’on ne peut vraiment pas mesurer.' },
          { label: 'Borner l’analyse aux 30 jours de journaux disponibles', quality: 0, minutes: 5, feedback: 'L’absence de journal n’est pas l’absence d’accès : des connexions vieilles de 41 jours prouvent que l’activité déborde la fenêtre. Borner l’analyse à ce qu’on voit, c’est sous-déclarer.' },
        ],
      },
      {
        situation: 'Qui doit notifier quoi, et quand ?',
        choices: [
          { label: 'Informer sans délai chaque client touché, preuves à l’appui', quality: 2, minutes: 15, feedback: 'Pour les factures, les clients sont responsables de traitement et Novafact sous-traitante : elle les informe sans délai excessif (art. 33.2), et leur délai de 72 h vers la CNIL court à partir de là. Plus l’information est précise, plus vite ils décident d’informer les personnes (art. 34).' },
          { label: 'Attendre la fin de l’enquête pour une information complète', quality: 1, minutes: 5, feedback: 'Le RGPD prévoit justement une information par étapes (art. 33.4). Attendre la version complète retarde d’autant les clients, qui ne peuvent ni notifier, ni prévenir les personnes, ni changer leurs mots de passe.' },
          { label: 'Aucune notification : la plateforme n’a pas été piratée', quality: 0, minutes: 5, feedback: 'Vrai pour la plateforme, faux pour les données : des factures traitées par Novafact ont été lues par un tiers, c’est une violation au sens de l’article 4.12, d’où que viennent les mots de passe. Snowflake n’avait pas été piratée non plus, et ses clients ont dû notifier.' },
        ],
      },
      {
        situation: 'Comment fermer la porte aux prochains identifiants volés ?',
        choices: [
          { label: 'Second facteur imposé aux comptes qui exportent, sous 7 jours', quality: 2, minutes: 15, feedback: 'Le mot de passe volé ne suffit plus là où il fait le plus de dégâts, et quelques jours de délai évitent de bloquer les clients en pleine clôture comptable. Snowflake a ensuite généralisé la MFA par défaut (M15).' },
          { label: 'Second facteur imposé à tous, ce soir, sans période de grâce', quality: 1, minutes: 10, feedback: 'La bonne mesure, le mauvais tempo : des milliers d’utilisateurs bloqués le même soir saturent le support, et la pression pour revenir en arrière viendra vite.' },
          { label: 'Changement de mot de passe obligatoire tous les 90 jours', quality: 0, minutes: 5, feedback: 'Chez UNC5537, des identifiants volés des années plus tôt restaient valides, et pourtant la rotation périodique n’est pas la réponse : le mot de passe volé la semaine dernière passera. C’est le second facteur, ou la liste d’adresses autorisées, qui rend le vol inutile.' },
        ],
      },
      {
        situation: 'Quelle communication publique ?',
        choices: [
          { label: 'Un avis factuel : comptes sans MFA, indicateurs, actions', quality: 2, minutes: 10, feedback: 'Dire ce qui est établi, ce qui ne l’est pas et ce que chaque client doit faire, et publier les indicateurs pour que tous cherchent chez eux. C’est ce que Snowflake et Mandiant ont fait.' },
          { label: 'Prévenir les clients touchés au cas par cas, sans avis public', quality: 1, minutes: 5, feedback: 'Les clients touchés sont prévenus, et les autres ne savent pas qu’ils doivent chercher. Un avis public avec indicateurs sert précisément ceux que vous n’avez pas encore identifiés.' },
          { label: 'Affirmer que la faute revient aux clients restés sans MFA', quality: 0, minutes: 5, feedback: 'Défendable sur le papier, ruineux en pratique, et incomplet : un fournisseur qui laissait la MFA optionnelle sur des exports de factures partage la responsabilité de ce choix par défaut.' },
        ],
      },
    ],
  },
  {
    id: 'rancon-s3',
    level: 3,
    title: 'Les archives chiffrées par l’attaquant (type Codefinger)',
    intro: 'Dimanche, 6 h 40. Alerte : des milliers de CopyObject en une heure sur novafact-archives, le bucket des PDF de factures. Chaque objet a été réécrit avec un chiffrement SSE-C, dont AWS ne conserve pas la clé, et un fichier de rançon est apparu dans chaque préfixe. Les appels sont signés par la clé d’un vieil utilisateur IAM de sauvegarde. Le bucket est versionné.',
    source: 'D’après le mode opératoire Codefinger décrit par Halcyon (janvier 2025) : clés AWS volées, objets réécrits en SSE-C avec une clé que seul l’attaquant détient, règle de cycle de vie qui supprime les données sous sept jours. AWS désactive SSE-C par défaut sur les nouveaux buckets depuis avril 2026. Transposé à Novafact.',
    budgetMin: 85,
    decisions: [
      {
        situation: 'Premier geste ?',
        choices: [
          { label: 'Désactiver la clé et refuser SSE-C par politique de bucket', quality: 2, minutes: 10, feedback: 'On coupe l’acteur, et on retire l’arme à quiconque aurait d’autres clés : une politique de bucket peut refuser toute écriture qui porte l’en-tête SSE-C. Rien n’est détruit, tout reste à analyser (M19).' },
          { label: 'Supprimer le bucket et tout restaurer depuis AWS Backup', quality: 0, minutes: 30, feedback: 'Supprimer un bucket versionné impose d’effacer toutes ses versions — y compris celles d’avant la réécriture, intactes et lisibles. L’option radicale détruit la voie de récupération la plus directe, et les preuves avec.' },
          { label: 'Désactiver les clés d’accès de tous les utilisateurs IAM', quality: 1, minutes: 10, feedback: 'L’attaquant est coupé, et avec lui les vieilles intégrations qui dépendent encore de clés : la crise gagne la production un dimanche matin. Couper la clé en cause suffit ; les autres se revoient ensuite.' },
        ],
      },
      {
        situation: 'CloudTrail montre aussi, à 6 h 02, un PutBucketLifecycleConfiguration signé par la même clé : les versions antérieures expireront dans sept jours. Que faire ?',
        choices: [
          { label: 'Sauvegarder la règle comme preuve, puis la supprimer', quality: 2, minutes: 5, feedback: 'La règle est la minuterie de la rançon. On la conserve (GetBucketLifecycleConfiguration) pour l’enquête, puis on la retire, avant qu’une seule version saine ne disparaisse.' },
          { label: 'Activer Object Lock avec une rétention par défaut de 30 jours', quality: 1, minutes: 10, feedback: 'La rétention par défaut s’applique aux objets écrits après son activation, pas aux versions déjà présentes — celles qu’il faut sauver. Et la règle de l’attaquant reste en place.' },
          { label: 'Ne toucher à aucune configuration jusqu’à la fin de l’enquête', quality: 0, minutes: 5, feedback: 'Figer la scène est un bon réflexe tant qu’elle ne s’autodétruit pas. Ici, la preuve se sauvegarde en une commande, et la minuterie tourne.' },
        ],
      },
      {
        situation: 'Comment récupérer les PDF ?',
        choices: [
          { label: 'Restaurer les versions antérieures avec S3 Batch Operations', quality: 2, minutes: 25, feedback: 'Sur un bucket versionné, une réécriture crée une nouvelle version sans effacer l’ancienne : les PDF d’avant 5 h sont là, lisibles. Les recopier comme version courante restaure tout, jusqu’à la dernière facture émise.' },
          { label: 'Restaurer la sauvegarde AWS Backup de la nuit précédente', quality: 1, minutes: 20, feedback: 'Ça marche, et on perd ce qui a été écrit depuis la sauvegarde. Les versions antérieures du bucket sont plus récentes, et déjà sur place.' },
          { label: 'Négocier la clé : seul moyen sûr de tout récupérer', quality: 0, minutes: 15, feedback: 'Payer finance la prochaine attaque, sans garantie de recevoir la bonne clé, et ignore que les données se récupèrent sans l’attaquant. Vérifier les versions prend dix minutes.' },
        ],
      },
      {
        situation: 'Les data events S3 n’étaient pas activés dans CloudTrail pour ce bucket. L’attaquant a-t-il lu les PDF ?',
        choices: [
          { label: 'Impossible à exclure : tout le bucket est potentiellement lu', quality: 2, minutes: 10, feedback: 'La clé avait s3:GetObject, et les lectures ne sont journalisées que par les data events, absents ici. L’absence de trace n’est pas une trace d’absence : on qualifie sur ce que la clé pouvait faire, pas sur ce qu’on voit.' },
          { label: 'Activer les data events maintenant pour trancher la question', quality: 1, minutes: 5, feedback: 'Indispensable pour la suite, et muet sur le passé : un journal activé à 7 h ne dira rien de ce qui s’est passé à 5 h.' },
          { label: 'Conclure à un chiffrement sur place, sans vol de données', quality: 0, minutes: 5, feedback: 'C’est le mode opératoire décrit, pas une preuve : rien ne montre que la clé n’a pas lu avant de réécrire. Se fier au profil de l’attaquant plutôt qu’aux journaux, c’est croire le fichier de rançon sur parole.' },
        ],
      },
      {
        situation: 'Les PDF sont restaurés. Quelles obligations ?',
        choices: [
          { label: 'Informer vite les clients : indisponibilité, lecture possible', quality: 2, minutes: 15, feedback: 'Une indisponibilité est aussi une violation (art. 4.12), et la confidentialité ne peut être exclue. Sous-traitante pour ces factures, Novafact informe ses clients sans délai excessif ; à eux de notifier la CNIL sous 72 h, sauf risque improbable.' },
          { label: 'Informer seulement les clients aux PDF les plus sensibles', quality: 1, minutes: 10, feedback: 'Trier par sensibilité, c’est décider du risque à la place des responsables de traitement, alors que tous les PDF étaient à portée de la clé. Chaque client concerné doit pouvoir faire sa propre analyse.' },
          { label: 'Rien à notifier : tout est restauré et aucun vol n’est prouvé', quality: 0, minutes: 5, feedback: 'La restauration règle la disponibilité, pas la confidentialité, et « non prouvé » n’est pas « exclu ». Le sous-traitant informe de toute violation (art. 33.2) ; la décision de notifier revient au responsable.' },
        ],
      },
      {
        situation: 'Quelle mesure durable ?',
        choices: [
          { label: 'Plus de clés de longue durée, SSE-C désactivé, Object Lock', quality: 2, minutes: 15, feedback: 'Trois verrous de classe : plus de clé à voler, plus de chiffrement imposé par le client, et des versions qu’aucune identité ne peut effacer avant échéance (M19, M21).' },
          { label: 'Activer GuardDuty pour être prévenu plus tôt la prochaine fois', quality: 1, minutes: 10, feedback: 'La détection raccourcit la crise sans l’empêcher : la même clé volée produirait la même réécriture, simplement repérée plus vite.' },
          { label: 'Remplacer la clé de sauvegarde et clore l’incident', quality: 0, minutes: 5, feedback: 'On remplace le secret volé par un secret de même nature, qui fuira de la même façon. La classe — une clé de longue durée capable de réécrire les archives — reste entière.' },
        ],
      },
    ],
  },
  {
    id: 'assistant-ia',
    level: 3,
    title: 'L’assistant qui envoyait les factures',
    intro: 'Mercredi, 16 h 10. Une cliente signale qu’« Ask Novafact » a envoyé un e-mail à une adresse inconnue, avec la liste de ses 50 dernières factures clients, juste après qu’elle lui a demandé un résumé de ses factures fournisseurs. Une facture fournisseur reçue le matin contenait, en texte blanc sur fond blanc, des consignes adressées à l’assistant.',
    source: 'Scénario fictif. Le mécanisme est réel : avec EchoLeak (CVE-2025-32711, Microsoft 365 Copilot, 2025), un simple e-mail piégé suffisait à faire sortir des données par l’assistant, au moyen de liens ou d’images, sans clic de la victime.',
    budgetMin: 75,
    decisions: [
      {
        situation: 'Premier geste ?',
        choices: [
          { label: 'Couper l’outil d’envoi d’e-mails pour tous les tenants', quality: 2, minutes: 5, feedback: 'L’outil d’envoi est le canal de sortie : sans lui, une injection ne produit plus que du texte à l’écran. L’assistant reste utile en lecture, et toutes les traces restent en place (M27).' },
          { label: 'Arrêter l’assistant, purger conversations et index vectoriel', quality: 0, minutes: 15, feedback: 'L’option radicale efface exactement ce qui dit qui d’autre a été touché : conversations, appels d’outils, passages récupérés. On coupe la capacité de nuire, pas la mémoire de l’incident.' },
          { label: 'Retirer la facture piégée de l’index de ce tenant', quality: 1, minutes: 5, feedback: 'Ça retire une instance ; la même consigne peut dormir dans d’autres PDF, chez d’autres clients, et l’outil d’envoi fonctionne toujours.' },
        ],
      },
      {
        situation: 'Qui d’autre est touché ?',
        choices: [
          { label: 'Chercher les envois de l’assistant hors des contacts du tenant', quality: 2, minutes: 15, feedback: 'Le dommage passe par un appel d’outil journalisé : destinataire, tenant, conversation. Un destinataire que le tenant n’a jamais utilisé est le signal le plus net (M23).' },
          { label: 'Passer les PDF indexés au crible d’un classifieur d’injection', quality: 1, minutes: 25, feedback: 'On trouvera des documents piégés, pas tous, et surtout pas ceux qui ont déjà agi. La question est ce qui est parti, pas ce qui pourrait partir.' },
          { label: 'Demander aux clients de signaler tout envoi inhabituel', quality: 0, minutes: 5, feedback: 'Vos journaux savent déjà ce que les clients mettraient des jours à remarquer, s’ils le remarquent : l’e-mail est parti de votre infrastructure.' },
        ],
      },
      {
        situation: 'Six tenants ont eu des envois vers le même domaine, IBAN et échéances compris. Quel est le risque principal pour les clients finaux ?',
        choices: [
          { label: 'Une fraude au changement de RIB, crédible car nourrie de vraies factures', quality: 2, minutes: 10, feedback: 'Montants, échéances et noms réels : le faux courriel « nouvelles coordonnées bancaires » devient indiscernable. C’est ce qui fait pencher vers un risque élevé pour les personnes, donc vers leur information (art. 34).' },
          { label: 'Des prélèvements frauduleux effectués sur les IBAN divulgués', quality: 1, minutes: 10, feedback: 'Possible, et encadré : un prélèvement SEPA non autorisé se conteste pendant 13 mois. Le vrai danger est l’inverse — des clients finaux qui paient eux-mêmes le fraudeur.' },
          { label: 'Aucun : les factures ne contiennent que des données professionnelles', quality: 0, minutes: 5, feedback: 'Les clients finaux sont souvent des indépendants ou des particuliers : nom, adresse et IBAN sont des données personnelles. Et même les données d’une entreprise nourrissent la fraude.' },
        ],
      },
      {
        situation: 'Quelles obligations, dès ce soir ?',
        choices: [
          { label: 'Informer sans délai les six clients, envois et factures à l’appui', quality: 2, minutes: 15, feedback: 'Sous-traitante pour ces factures, Novafact informe chaque client sans délai excessif (art. 33.2). Eux notifient la CNIL sous 72 h et décident de prévenir leurs clients finaux : plus tôt ils savent, plus tôt la mise en garde contre la fraude part.' },
          { label: 'Informer la cliente qui a alerté, puis les autres après analyse', quality: 1, minutes: 5, feedback: 'Les cinq autres tenants sont déjà identifiés : attendre la fin de l’analyse, c’est laisser leurs clients finaux recevoir de faux RIB sans avertissement.' },
          { label: 'Rien tant qu’aucune fraude effective n’est prouvée', quality: 0, minutes: 5, feedback: 'La violation, c’est l’envoi de données à un tiers non autorisé : elle est constituée. La fraude serait un dommage de plus, et l’attendre retire aux clients le temps de la prévenir.' },
        ],
      },
      {
        situation: 'Quelle correction avant de réactiver l’envoi ?',
        choices: [
          { label: 'Confirmation humaine et destinataires limités aux contacts', quality: 2, minutes: 15, feedback: 'On ne rend pas le modèle incorruptible, on borne ce qu’il peut faire une fois corrompu : l’envoi passe par un humain qui voit le destinataire, et seulement vers des adresses connues. C’est ce qui tient face à l’injection qu’on n’a pas encore vue (M27).' },
          { label: 'Un classifieur d’injection sur chaque document avant indexation', quality: 1, minutes: 20, feedback: 'Une couche de détection utile, et probabiliste : une consigne reformulée passe. Elle réduit le bruit, elle ne remplace pas une frontière sur les actions.' },
          { label: 'Une consigne système : « n’obéis jamais aux documents »', quality: 0, minutes: 5, feedback: 'La consigne et l’injection sont écrites dans la même langue et lues par le même modèle : aucune n’a de priorité garantie. C’est une instruction de plus, pas une frontière.' },
        ],
      },
      {
        situation: 'Un second canal apparaît : une réponse affichait une image dont l’URL portait des numéros de facture. Que faire ?',
        choices: [
          { label: 'Ne plus afficher d’image distante dans les réponses', quality: 2, minutes: 10, feedback: 'Une image distante est une requête sortante que le navigateur envoie tout seul, paramètres compris : un second canal d’exfiltration, sans outil ni clic. On le ferme au rendu, et par la CSP (img-src).' },
          { label: 'Filtrer les URL d’images qui contiennent des numéros de facture', quality: 1, minutes: 10, feedback: 'L’attaquant encodera autrement : base64, découpage, sous-domaines. Filtrer le contenu du canal plutôt que le canal lui-même, c’est jouer à la course.' },
          { label: 'Rien : dans ce cas, aucun e-mail n’est parti', quality: 0, minutes: 5, feedback: 'La requête de l’image a porté les numéros jusqu’au serveur de l’attaquant : c’est une sortie de données, simplement sans e-mail. Le canal compte moins que ce qu’il transporte.' },
        ],
      },
    ],
  },
];

// ── Les séries ──────────────────────────────────────────────────────────────
//
// Une série = une crise : six décisions enchaînées forment un tout, et les
// mélanger n'aurait pas de sens. L'ordre de la liste est celui de la
// progression.

export const crisisSeries = defineSeries(crises, [
  { id: 'cle-publiee', title: 'La clé publiée', ids: ['cle-aws-publique'], level: 1,
    text: 'L’indice qui tranche est dans chaque situation. On apprend l’ordre des gestes : couper, mesurer, remplacer, prévenir.' },
  { id: 'react2shell', title: 'React2Shell', ids: ['react2shell'], level: 1,
    text: 'Le déroulé type d’une faille critique exploitée en masse : inventaire, atténuation, détection, confinement, notification.' },
  { id: 'ver-npm', title: 'Le ver dans les dépendances', ids: ['shai-hulud'], level: 2,
    text: 'Chaque décision a son leurre : un lockfile qui rassure trop, un mot de passe changé quand c’est le jeton qui compte.' },
  { id: 'middleware', title: 'Le middleware contourné', ids: ['next-middleware'], level: 2,
    text: 'Tout dépend de l’hébergement et de ce que chaque route revérifie. Et il faut savoir quel journal garde les en-têtes.' },
  { id: 'chercheur', title: 'Le signalement du chercheur', ids: ['bola-chercheur'], level: 2,
    text: 'Un signalement de bonne foi, puis un détail dans les journaux qui change la qualification de l’incident.' },
  { id: 'comptes-pilles', title: 'Des comptes pillés', ids: ['comptes-pilles'], level: 3,
    text: 'La plateforme n’a pas été piratée, et cela ne dispense de rien. Les journaux s’arrêtent avant l’attaque : il faut chercher ailleurs.' },
  { id: 'rancon-s3', title: 'Rançon sur les archives', ids: ['rancon-s3'], level: 3,
    text: 'L’option radicale efface la seule copie saine, une minuterie tourne, et un journal jamais activé change la qualification.' },
  { id: 'assistant', title: 'L’assistant détourné', ids: ['assistant-ia'], level: 3,
    text: 'On borne ce que le modèle peut faire, on ne le rend pas incorruptible. Et purger, c’est effacer la liste des victimes.' },
]);

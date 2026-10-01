// Scènes du jeu « Pushback » : des objections réelles, trois réponses possibles.
// points : 2 = fait avancer sans braquer, 1 = acceptable, 0 = contre-productif.
// trust : effet sur la relation ; risk : effet sur le risque (positif = risque réduit).
//
// Règle d'écriture, et c'est elle qui fait la difficulté : **les trois réponses
// doivent sonner également professionnelles**. Un distracteur qui dit « non,
// point » ou « d'accord, tant pis » se rejette sans lire l'objection — le jeu
// devient un test de ton, pas de jugement. Ici les mauvaises réponses sont
// elles aussi chiffrées, datées, assorties d'un ticket ou d'une échéance : ce
// qui les disqualifie tient au fond (le mauvais décideur, le mauvais contrôle,
// une échéance qui n'arrivera pas), jamais à la forme.
//
// Corollaire : la bonne réponse n'est pas la plus longue. `npm run games` le
// vérifie.
//
// Les niveaux. Le sujet ne fait pas la difficulté : une objection sur le SSO
// peut être un N1 et une objection sur un captcha un N3. Ce qui la fait, c'est
// la **part de vrai** dans l'objection, et ce qu'il faut lire pour s'en rendre
// compte.
//
//   N1 · L'objection repose sur une idée fausse qu'on peut nommer (« c'est
//        derrière l'authentification », « le dépôt est privé »). La bonne
//        réponse la démonte avec un fait et propose le chemin sûr ; les
//        distracteurs acceptent la prémisse ou répondent à côté, pour une
//        raison visible dans la scène. On apprend la forme d'une réponse.
//
//   N2 · L'objection est discutable, et un distracteur est **à moitié juste** :
//        le bon contenu porté par le mauvais décideur, une mesure réelle qui
//        couvre une autre menace, une bonne pratique hors sujet. Il faut lire
//        le contexte (qui signe, quelle échéance, quel chemin a pris la donnée)
//        pour départager.
//
//   N3 · L'objection est **en partie légitime**. La meilleure réponse concède
//        ce qui est vrai et déplace la discussion vers ce qui reste à régler ;
//        la réponse ferme, « sécuritaire », est souvent le piège, parce
//        qu'elle défend un contrôle mal réglé contre quelqu'un qui a raison.
//        Le détail qui départage est dans le contexte (un calendrier, une
//        population d'utilisateurs, un compte hors SSO).
//
// Certaines scènes s'appuient sur des cas publics (Uber 2016, First American
// 2019, Okta 2023, Code Spaces 2014…), cités dans l'explication : seul le cas
// est réel, la scène chez Novafact reste fictive.

import { defineSeries, type Leveled } from '../lib/series';

/** L'interlocuteur : les séries thématiques se composent par public. */
export type Audience = 'dev' | 'produit' | 'direction' | 'ops' | 'metier';

export interface Reply { text: string; points: 0 | 1 | 2; trust: -1 | 0 | 1; risk: -1 | 0 | 1 | 2; why: string }
export interface Scene extends Leveled {
  audience: Audience;
  who: string; role: string; context: string; objection: string; replies: Reply[];
}

export const scenes: Scene[] = [
  {
    id: 'sast-faux-positif', level: 2, audience: 'dev',
    who: 'Sacha', role: 'Lead dev API', context: 'Vendredi, 16 h. Une démo client est prévue à 17 h.',
    objection: 'Le SAST bloque ma PR pour un faux positif. Tu peux désactiver la règle ?',
    replies: [
      { text: 'Pose l’annotation d’exception, elle expire dans 90 jours et je repasse dessus.', points: 0, trust: 1, risk: -1, why: 'L’annotation est le bon outil, mais tu la poses sans avoir regardé : tu signes que c’est un faux positif sur la parole de quelqu’un qui est pressé. Si c’en est un vrai, il part en production avec ta signature dessus.' },
      { text: 'Montre-moi le code. Si c’en est un, on l’annote et je corrige la règle.', points: 2, trust: 1, risk: 1, why: 'Trente secondes de lecture décident de tout, et tu débloques aussi vite dans les deux cas. En prime, corriger la règle supprime le prochain faux positif : c’est le seul chemin qui réduit le nombre de fois où on te demandera ça.' },
      { text: 'Je désactive la règle sur ton dépôt et je la réactive juste après la démo.', points: 0, trust: 1, risk: -1, why: 'L’échéance a l’air courte et n’en est pas une : personne ne revient réactiver une règle le lundi. Et tu retires le contrôle pour tout le dépôt, donc pour des lignes que tu n’as pas regardées.' },
    ],
  },
  {
    id: 'bola-livraison', level: 2, audience: 'produit',
    who: 'Alix', role: 'PO facturation', context: 'Une BOLA a été trouvée sur l’export comptable. Livraison prévue vendredi chez un grand compte.',
    objection: 'Deux semaines de correction ? Impossible. On livre vendredi.',
    replies: [
      { text: 'Correctif minimal filtré par tenant d’ici jeudi, le reste part en dette tracée.', points: 1, trust: 1, risk: 1, why: 'Le contenu est bon et la vulnérabilité disparaît à temps. Mais tu as arbitré seul un risque qui n’est pas le tien : la prochaine fois qu’Alix voudra livrer, elle ne t’appellera pas.' },
      { text: 'Trois options chiffrées, et c’est le CTO qui signe celle qu’on retient.', points: 2, trust: 1, risk: 2, why: 'Tu rends la décision possible au lieu de la prendre. En pratique, une fois les coûts posés côte à côte, le correctif d’une journée s’impose de lui-même — et s’il ne s’impose pas, l’acceptation est signée par celui qui en porte les conséquences.' },
      { text: 'On livre, et j’ouvre un ticket P1 avec une revue de risque sous quinzaine.', points: 0, trust: 1, risk: -1, why: 'Un P1 et une revue donnent l’impression que le risque est tenu. Il ne l’est pas : la donnée d’un grand compte est lisible par ses concurrents pendant ces quinze jours, et c’est précisément la fenêtre qu’on cherchait à éviter.' },
    ],
  },
  {
    id: 'csp-tag-manager', level: 2, audience: 'dev',
    who: 'Charlie', role: 'Lead front', context: 'La CSP vient d’être activée en mode bloquant sur la page de paiement.',
    objection: 'La CSP casse le tag manager du marketing. On la retire.',
    replies: [
      { text: 'Report-Only une semaine, puis on ajoute le nonce au chargeur du tag manager.', points: 1, trust: 1, risk: 0, why: 'La méthode est la bonne, mais elle rend au tag manager le droit d’exécuter du script sur la page de paiement — c’est-à-dire exactement ce dont un skimmer a besoin. Tu as rétabli le marketing et le risque avec.' },
      { text: 'Le tag manager sort de la page de paiement ; la CSP reste, il vit ailleurs.', points: 2, trust: 1, risk: 2, why: 'La page qui touche à la carte bancaire n’a pas besoin de mesure d’audience, et c’est la seule où la CSP compte vraiment. Le marketing garde ses tags sur tout le reste du site : personne ne perd rien.' },
      { text: 'On la retire, je la remets au sprint suivant avec un budget de test dédié.', points: 0, trust: 1, risk: -1, why: 'Le sprint suivant a déjà ses engagements, et une CSP qu’on remet coûte le double : il faut refaire toute la mesure d’impact. La page de paiement reste pendant ce temps la cible la plus rentable du site.' },
    ],
  },
  {
    id: 'pentest-ou-sast', level: 1, audience: 'direction',
    who: 'Dominique', role: 'CTO', context: 'Réunion budgétaire du trimestre.',
    objection: 'Pourquoi payer un pentest si on a déjà un SAST ?',
    replies: [
      { text: 'Le SAST lit des motifs, le pentest lit la logique métier et l’autorisation.', points: 1, trust: 0, risk: 0, why: 'L’argument est juste et n’engage à rien : il explique une différence sans dire ce qu’on achète. Un CTO qui arbitre un budget a besoin d’un périmètre et d’une date, pas d’une distinction de catégorie.' },
      { text: 'Boîte grise sur l’isolation entre tenants, avant l’arrivée du grand compte.', points: 2, trust: 1, risk: 1, why: 'Un périmètre, une classe de défaut qu’aucun SAST ne trouve, et une échéance qui vient du métier et non de la sécurité. C’est une dépense qu’on peut décider dans la réunion où elle est proposée.' },
      { text: 'La certification du grand compte l’exige, on n’a pas vraiment le choix.', points: 0, trust: 0, risk: 0, why: 'C’est peut-être vrai, et c’est le plus court chemin vers un pentest de complaisance : le moins cher, le plus étroit, celui qui coche la case. Le jour où l’exigence tombe, la ligne budgétaire tombe avec elle.' },
    ],
  },
  {
    id: 'api-interne', level: 1, audience: 'dev',
    who: 'Sacha', role: 'Lead dev API', context: 'Revue de conception d’un nouveau service de calcul de TVA.',
    objection: 'C’est une API interne, pas besoin d’authentification.',
    replies: [
      { text: 'Mets une clé d’API en variable d’environnement, avec rotation trimestrielle.', points: 1, trust: 0, risk: 1, why: 'Une authentification existe, donc c’est mieux que rien. Mais ce secret partagé finira dans un fichier de configuration, un journal et trois dépôts, et la rotation trimestrielle sera le premier rituel abandonné.' },
      { text: 'Le template fait l’authentification IAM en deux lignes, sans secret.', points: 2, trust: 1, risk: 2, why: 'Tu déplaces la question du « faut-il » vers le « combien ça coûte », et la réponse est : rien. Une SSRF ou un runner compromis atteint le réseau interne ; là, il lui faudrait en plus un rôle.' },
      { text: 'D’accord si on met une règle réseau qui limite l’accès au subnet applicatif.', points: 0, trust: 1, risk: 0, why: 'La règle réseau a l’air d’un contrôle et n’en est pas un ici : tout ce qui appelle ce service est déjà dans ce subnet, y compris le service qu’on compromettra. C’est le reflux de confiance, avec une couche de vocabulaire.' },
    ],
  },
  {
    id: 'zero-vulnerabilite', level: 2, audience: 'direction',
    who: 'Direction générale', role: 'Comité de direction', context: 'Première restitution trimestrielle.',
    objection: 'Combien de vulnérabilités avons-nous ? Je veux zéro.',
    replies: [
      { text: '412 ouvertes, dont 43 critiques, et la tendance est à la baisse ce trimestre.', points: 0, trust: 0, risk: 0, why: 'Le chiffre est exact et ne veut rien dire : il mélange une dépendance de test et une BOLA exposée. Tu viens d’installer un indicateur que la direction suivra, et qu’on fera baisser en reclassant des tickets.' },
      { text: 'Les critiques exposées sont corrigées en 72 h, contre 6 jours il y a un an.', points: 2, trust: 1, risk: 1, why: 'Un délai sur ce qui est réellement atteignable, et une tendance : c’est une mesure de capacité, pas un stock. Elle se dégrade honnêtement quand ça va mal, ce qu’un décompte de tickets ne fait jamais.' },
      { text: 'Zéro est hors d’atteinte, mais on peut viser zéro critique sous six mois.', points: 0, trust: 1, risk: -1, why: 'Tu viens de t’engager sur un objectif que tu ne contrôles pas : une CVE critique dans une dépendance peut tomber demain. Dans six mois, tu auras le choix entre l’échec et la requalification.' },
    ],
  },
  {
    id: 'self-xss', level: 3, audience: 'dev',
    who: 'Camille', role: 'Développeuse front', context: 'Le pentest a relevé une XSS dans le champ « notes » du profil.',
    objection: 'C’est du self-XSS, seul l’utilisateur peut se l’infliger. On ne corrige pas.',
    replies: [
      { text: 'Toute XSS se corrige : je monte le ticket en bloquant pour la prochaine PR.', points: 0, trust: -1, risk: 1, why: 'Le correctif sera peut-être fait, mais tu viens d’annoncer que ta sévérité ne dépend pas du contexte. La prochaine fois que tu diras « celle-ci est vraiment grave », plus personne ne fera la différence.' },
      { text: 'La mise à jour du profil n’a pas de CSRF : à deux, ça devient une XSS stockée.', points: 2, trust: 1, risk: 2, why: 'Camille a raison sur son finding et tort sur le périmètre : tu ne contestes pas son analyse, tu ajoutes le maillon qui manquait. Et c’est vérifiable en une minute, donc ça ne se discute pas.' },
      { text: 'On la garde ouverte en faible, et on la reverra au prochain audit annuel.', points: 0, trust: 1, risk: -1, why: 'Le ticket reste ouvert, ce qui donne le sentiment que rien n’est perdu. En pratique, l’audit annuel relit le même champ et reproduit la même conclusion : le maillon reste disponible pour la prochaine chaîne.' },
    ],
  },
  {
    id: 'champions-budget', level: 2, audience: 'produit',
    who: 'Alix', role: 'PO facturation', context: 'Proposition de lancer des Security Champions.',
    objection: '15 % du temps d’un développeur ? On n’a pas le budget.',
    replies: [
      { text: 'Un trimestre, une équipe, un objectif : zéro BOLA dans ses PR. On voit après.', points: 2, trust: 1, risk: 1, why: 'Petit, mesurable, réversible — trois raisons de dire oui, et aucune de s’engager au-delà. Si le chiffre tombe, le programme se vend tout seul au trimestre suivant ; sinon, tu as appris quelque chose à bas coût.' },
      { text: 'Je relis moi-même les PR sensibles, on verra le budget au prochain exercice.', points: 1, trust: 1, risk: 0, why: 'Le risque est couvert à court terme, et tu viens de créer une dépendance à ta personne. Au prochain exercice, la question ne sera plus « faut-il des champions » mais « pourquoi, puisque tu le fais ».' },
      { text: 'Commençons par 5 % du temps, sur les quatre équipes, dès le mois prochain.', points: 0, trust: 0, risk: 0, why: 'Étalé sur quatre équipes, 5 % ne produit aucun effet mesurable nulle part — et l’échec servira d’argument contre le programme. Mieux vaut un pilote profond qu’une couche mince partout.' },
    ],
  },
  {
    id: 'waf-astreinte', level: 3, audience: 'ops',
    who: 'Morgane', role: 'SRE d’astreinte', context: 'Mardi 2 h du matin. L’API renvoie des 500 en rafale.',
    objection: 'Je coupe le WAF, je suis sûr que c’est lui qui casse les requêtes.',
    replies: [
      { text: 'Passe-le en détection seule sur la route concernée, garde-le ailleurs.', points: 2, trust: 1, risk: 1, why: 'Tu obtiens l’information de Morgane — est-ce le WAF ? — en changeant une seule variable, et le reste de la surface garde sa protection. C’est aussi rapide que la coupure totale, avec un périmètre.' },
      { text: 'Coupe-le, on le remet dans la journée avec une analyse des règles en cause.', points: 0, trust: 1, risk: -1, why: 'À 2 h du matin, l’incident prime — mais tu enlèves la protection de toutes les routes pour tester une hypothèse sur une seule. Et l’analyse promise arrive après la nuit blanche, c’est-à-dire rarement.' },
      { text: 'Vérifions d’abord les journaux du WAF avant de toucher à la configuration.', points: 1, trust: -1, risk: 1, why: 'Méthodologiquement irréprochable, et c’est une réponse de journée en pleine nuit d’astreinte. Si les journaux prennent vingt minutes à lire, Morgane coupera le WAF sans te le dire.' },
    ],
  },
  {
    id: 'iso-27001', level: 2, audience: 'metier',
    who: 'Rémi', role: 'Acheteur IT', context: 'Renouvellement d’un prestataire qui héberge les exports comptables.',
    objection: 'Ils ont ISO 27001, on n’a pas besoin de les auditer nous-mêmes.',
    replies: [
      { text: 'Demande-leur le périmètre de la déclaration d’applicabilité, c’est suffisant.', points: 1, trust: 0, risk: 1, why: 'Bonne question — le périmètre est souvent l’endroit où le certificat cesse de nous concerner. Mais tu t’arrêtes au document : il te dira ce qui est couvert, jamais comment nos données y circulent.' },
      { text: 'Le certificat couvre leur SMSI, pas notre flux. Que devient l’export chez eux ?', points: 2, trust: 1, risk: 2, why: 'Tu ne contestes pas la valeur du certificat, tu la situes : il atteste d’un système de management, pas d’une architecture. La question qui suit — chiffrement, durée de conservation, sous-traitants — se pose à tout le monde.' },
      { text: 'Ajoutons une clause d’audit au contrat et un questionnaire annuel de 80 items.', points: 0, trust: -1, risk: 0, why: 'Une clause d’audit qu’on n’exercera jamais et un questionnaire déclaratif : beaucoup de friction pour l’achat, aucune information nouvelle. C’est le rituel qui donne le plus mauvais rapport effort/risque.' },
    ],
  },
  {
    id: 'xml-non-exploitable', level: 2, audience: 'dev',
    who: 'Sacha', role: 'Lead dev API', context: 'Le SCA remonte une CVE critique dans une bibliothèque de parsing XML.',
    objection: 'On ne parse jamais de XML venant de l’extérieur. Je passe en « non exploitable ».',
    replies: [
      { text: 'Vérifions ensemble : le connecteur Chorus Pro reçoit des factures en XML.', points: 2, trust: 1, risk: 2, why: 'Tu traites sa conclusion comme une hypothèse testable plutôt que comme une erreur, et le contre-exemple est concret. Si le connecteur ne l’utilisait pas, sa qualification tiendrait — et tu l’aurais appris aussi.' },
      { text: 'Marque-la non exploitable avec un VEX, et on revalidera à chaque mise à jour.', points: 1, trust: 1, risk: 0, why: 'Le VEX est le bon format pour porter cette affirmation, et le revalider est la bonne discipline. Mais tu enregistres l’affirmation avant de l’avoir vérifiée une première fois : le VEX propagera une erreur avec autorité.' },
      { text: 'Mets-la à jour quand même, c’est trente minutes et ça ferme la discussion.', points: 0, trust: 0, risk: 1, why: 'Ça marche cette fois, et ça installe la règle « on patche tout » : à la centième CVE, l’équipe fera du bruit et arrêtera de qualifier quoi que ce soit. La qualification est précisément ce qu’on veut leur apprendre à faire.' },
    ],
  },
  {
    id: 'dpo-journaux', level: 3, audience: 'metier',
    who: 'Inès', role: 'DPO', context: 'Revue d’une nouvelle fonctionnalité de relances automatiques.',
    objection: 'Vous journalisez les adresses e-mail des destinataires ? C’est une donnée personnelle.',
    replies: [
      { text: 'Tu as raison, on retire les e-mails des journaux applicatifs dès cette semaine.', points: 0, trust: 1, risk: -1, why: 'Inès est satisfaite et l’équipe sécurité vient de perdre le seul champ qui relie une relance à son destinataire. Le jour d’un incident sur les relances, plus personne ne saura qui a reçu quoi.' },
      { text: 'Pseudonymisons : un identifiant stable, la table de correspondance ailleurs.', points: 2, trust: 1, risk: 2, why: 'Les deux besoins tiennent ensemble : l’investigation garde un fil à suivre, et le journal cesse d’être un fichier de données personnelles. C’est la réponse qui évite d’avoir à choisir entre conformité et traçabilité.' },
      { text: 'Ils sont chiffrés au repos et purgés à 30 jours, donc le traitement est couvert.', points: 0, trust: 0, risk: 0, why: 'Chiffrement et rétention sont réels et répondent à côté : la question d’Inès porte sur la présence de la donnée, pas sur sa protection. Tu opposes un argument technique à une objection juridique, et tu perdras.' },
    ],
  },
  {
    id: 'sms-suffit', level: 3, audience: 'dev',
    who: 'Charlie', role: 'Lead front', context: 'Mise en place de l’authentification à deux facteurs sur l’espace client.',
    objection: 'Le SMS suffit largement, nos clients n’installeront jamais une application.',
    replies: [
      { text: 'Le SMS se détourne par portabilité, il faut du TOTP ou rien du tout.', points: 0, trust: -1, risk: 0, why: 'La menace est réelle et le raisonnement s’arrête trop tôt : le SIM swap vise des comptes à forte valeur, pas la PME qui émet douze factures par mois. En exigeant tout, tu obtiendras zéro facteur au lieu d’un.' },
      { text: 'SMS par défaut, TOTP proposé, obligatoire pour les administrateurs.', points: 2, trust: 1, risk: 2, why: 'Charlie a raison sur l’adoption, et tu gardes le facteur fort là où le SIM swap est rentable. Les deux positions étaient vraies pour des populations différentes : la réponse n’est pas un compromis, c’est une segmentation.' },
      { text: 'Partons sur le SMS, on migrera vers TOTP quand l’usage sera bien installé.', points: 1, trust: 1, risk: 0, why: 'Le facteur existe, c’est déjà beaucoup. Mais une migration d’authentification une fois les habitudes prises coûte bien plus cher que de proposer les deux dès le départ — et elle ne sera jamais prioritaire.' },
    ],
  },
  {
    id: 'interdire-github', level: 2, audience: 'direction',
    who: 'Dominique', role: 'CTO', context: 'Après un incident : un jeton d’API d’un client a fuité dans un dépôt public.',
    objection: 'Il faut interdire GitHub public à tous les développeurs.',
    replies: [
      { text: 'Le secret scanning côté éditeur révoque ces jetons en quelques minutes.', points: 2, trust: 1, risk: 2, why: 'Le jeton a fuité par un client, pas par l’équipe : l’interdiction interne n’aurait rien empêché. Le partenariat de révocation traite tous les cas, y compris ceux qu’on ne contrôle pas, et ne coûte rien à personne.' },
      { text: 'Ajoutons plutôt un hook de pré-commit et une analyse de l’historique des dépôts.', points: 1, trust: 1, risk: 1, why: 'Utile, et à côté de cet incident : les deux mesures couvrent nos dépôts alors que la fuite vient de ceux d’un client. Tu réponds bien à la peur du CTO, pas au chemin qu’a réellement pris le secret.' },
      { text: 'Interdisons-le pour six mois, le temps de mettre en place la détection.', points: 0, trust: 0, risk: -1, why: 'Six mois d’interdiction pour un incident dont l’origine est externe, et les développeurs contourneront dès la première contribution open source nécessaire. Tu paies un coût politique élevé pour un risque que tu n’as pas réduit.' },
    ],
  },
  {
    id: 'support-impersonation', level: 3, audience: 'metier',
    who: 'Nadia', role: 'Responsable support', context: 'Le support demande un accès pour aider les clients bloqués.',
    objection: 'On a besoin de se connecter en tant que client, sinon on ne peut rien diagnostiquer.',
    replies: [
      { text: 'Impersonation avec consentement, durée limitée, et tout est journalisé.', points: 2, trust: 1, risk: 2, why: 'Le besoin est réel et ne disparaîtra pas : le refuser produirait un partage de mots de passe par téléphone. Le consentement et la trace transforment un accès invisible en acte nominatif, ce qui protège aussi le support.' },
      { text: 'Créons un rôle support en lecture seule sur l’ensemble des comptes clients.', points: 1, trust: 1, risk: 0, why: 'La lecture seule limite les dégâts, et un accès permanent à tous les comptes est une surface bien plus large qu’une impersonation ponctuelle. Un compte support compromis lit alors la base entière.' },
      { text: 'Que le client partage son écran, c’est suffisant dans la plupart des cas.', points: 0, trust: -1, risk: 0, why: 'Ça marche pour l’affichage, jamais pour un état côté serveur, et le support le sait. Tu viens de proposer une solution que le terrain jugera irréaliste : la prochaine demande passera directement par la DSI.' },
    ],
  },
  {
    id: 'trente-findings', level: 3, audience: 'produit',
    who: 'Alix', role: 'PO facturation', context: 'Le rapport de pentest annuel vient d’arriver : 30 findings.',
    objection: 'Trente tickets dans mon backlog, ce n’est pas tenable. Donne-moi les trois vrais.',
    replies: [
      { text: 'Les trois critiques d’abord ; je te repasse le reste au prochain trimestre.', points: 1, trust: 1, risk: 1, why: 'La priorisation par sévérité est défendable et laisse passer ce qui coûte le moins cher à corriger : les défauts faibles mais systémiques, ceux qu’un template corrige en une fois pour toutes les équipes.' },
      { text: 'Trois classes plutôt que trois findings : autorisation, secrets, parsing.', points: 2, trust: 1, risk: 2, why: 'Vingt-deux des trente findings tombent dans trois classes, donc trois corrections de fond valent mieux que trente correctifs ponctuels. Et Alix obtient ce qu’elle demandait : trois lignes dans son backlog.' },
      { text: 'Je qualifie les trente avec toi en atelier, puis on décide ensemble du périmètre.', points: 0, trust: 0, risk: 0, why: 'La méthode est juste et le coût est le problème : un atelier de trente findings mobilise une demi-journée du produit pour aboutir à la même conclusion. Tu peux faire ce tri seul et n’apporter que le résultat.' },
    ],
  },
  // ── Développeurs ──────────────────────────────────────────────────────────
  {
    id: 'requete-brute', level: 1, audience: 'dev',
    who: 'Yanis', role: 'Développeur backend', context: 'Revue de PR : la recherche de factures construit sa requête avec $queryRawUnsafe et la saisie de l’utilisateur.',
    objection: 'C’est derrière l’authentification : seuls nos clients peuvent appeler cette route.',
    replies: [
      { text: 'Un compte d’essai suffit pour l’appeler. $queryRaw en gabarit balisé paramètre tout seul.', points: 2, trust: 1, risk: 2, why: 'Chez un SaaS multi-tenant, l’attaquant le plus probable est un client authentifié, et l’inscription est gratuite. Le correctif tient en un mot : avec $queryRaw utilisé comme gabarit balisé, Prisma transmet chaque valeur interpolée comme paramètre, jamais comme texte SQL.' },
      { text: 'D’accord, mais ajoute un filtre qui retire les apostrophes de la recherche avant la requête.', points: 0, trust: 1, risk: 0, why: 'Le filtre casse des recherches légitimes (un client nommé O’Neil, saisi avec une apostrophe droite) et ne protège que ce contexte précis : le jour où la même variable part dans un ORDER BY ou une comparaison numérique, il n’y a plus d’apostrophe à retirer.' },
      { text: 'On le note en dette : le WAF bloque déjà les motifs d’injection SQL connus en attendant.', points: 0, trust: 1, risk: -1, why: 'Un WAF reconnaît des motifs, et les contournements des filtres génériques sont documentés depuis des années. Surtout, on met en dette un correctif d’une ligne : la dette coûte ici plus cher à suivre qu’à rembourser.' },
    ],
  },
  {
    id: 'cle-dans-le-depot', level: 1, audience: 'dev', avoid: ['interdire-github'],
    who: 'Yanis', role: 'Développeur backend', context: 'Une clé d’API du prestataire d’e-mails est commitée depuis trois mois dans un dépôt privé.',
    objection: 'Le dépôt est privé, et je réécris l’historique avec un force-push. C’est réglé.',
    replies: [
      { text: 'Révoque la clé d’abord : trois mois de clones, de forks et de caches CI l’ont déjà copiée.', points: 2, trust: 1, risk: 2, why: 'Un secret commité est publié auprès de tous ceux qui ont lu le dépôt, et « privé » ne protège pas d’un compte de développeur volé : en 2016, Uber a perdu les données de 57 millions d’utilisateurs via une clé AWS trouvée dans un dépôt GitHub privé. La réécriture d’historique vient après, pour l’hygiène.' },
      { text: 'Garde-la, mais restreins-la aux IP de production dans la console du prestataire.', points: 1, trust: 1, risk: 1, why: 'Une vraie mesure si le prestataire la propose, et elle limite l’usage d’une clé volée. Mais la clé reste valide et connue, alors que la rotation prend dix minutes : la restriction ne dispense pas de la faire.' },
      { text: 'Force-push, puis on active le secret scanning sur l’organisation pour les prochaines fois.', points: 0, trust: 1, risk: 0, why: 'Le secret scanning est une bonne décision pour la suite, et il ne fait rien pour cette clé-ci : réécrire l’historique ne retire rien des clones existants ni des caches, et la clé fonctionne toujours.' },
    ],
  },
  {
    id: 'renovate-bruit', level: 2, audience: 'dev',
    who: 'Yanis', role: 'Développeur backend', context: 'Renovate ouvre une quarantaine de PR de mises à jour par semaine sur le monorepo.',
    objection: 'Je désactive Renovate. On fera les mises à jour à la main, une fois par trimestre.',
    replies: [
      { text: 'Une PR groupée par semaine, fusionnée si la CI passe ; les versions majeures à part.', points: 2, trust: 1, risk: 2, why: 'Le bruit vient du découpage, pas de l’outil : Renovate sait grouper des paquets et fusionner automatiquement ce que la CI valide. Les versions majeures, celles qui cassent vraiment, restent des PR relues. L’équipe passe de quarante notifications à une poignée.' },
      { text: 'Garde Renovate pour les seules alertes de sécurité, et coupe les mises à jour de routine.', points: 1, trust: 1, risk: 0, why: 'Le bruit baisse tout de suite. Mais les dépendances vieillissent, et le jour où une alerte arrive, le correctif se trouve trois versions majeures plus loin : une mise à jour de sécurité devient une migration, en urgence.' },
      { text: 'Ajoutons un développeur de garde chaque semaine pour relire et fusionner les quarante PR.', points: 0, trust: -1, risk: 0, why: 'Personne ne relit sérieusement quarante PR de dépendances par semaine : au bout de quinze jours, la garde approuve sans lire. Tu as payé un développeur pour produire une validation qui n’en est pas une.' },
    ],
  },
  {
    id: 'webhooks-refus-defaut', level: 3, audience: 'dev',
    who: 'Sacha', role: 'Lead dev API', context: 'Mise en place d’un middleware d’autorisation « refus par défaut » sur toute l’API.',
    objection: 'Nos webhooks de paiement n’ont pas d’utilisateur connecté. Ton middleware va tous les rejeter.',
    replies: [
      { text: 'Chaque webhook devient une exception nommée, signature vérifiée, et un test liste les exceptions.', points: 2, trust: 1, risk: 2, why: 'Sacha a raison : un prestataire signe ses envois, il ne se connecte pas. Le refus par défaut survit s’il a des exceptions nommées et visibles : le test qui énumère les routes publiques échoue le jour où quelqu’un en ajoute une sans le dire.' },
      { text: 'Vrai : exempte le préfixe /webhooks du middleware, chaque handler vérifiera sa signature.', points: 1, trust: 1, risk: 0, why: 'Ça fonctionne aujourd’hui, et ça redevient un « autorisé par défaut » sous ce préfixe : la prochaine route posée sous /webhooks par commodité sera publique sans que personne l’ait décidé.' },
      { text: 'Pas d’exception au refus par défaut : les webhooks passeront par un compte de service dédié.', points: 0, trust: -1, risk: -1, why: 'Le prestataire de paiement ne se connectera pas à un compte Novafact : le « compte de service » finira en jeton statique dans l’URL du webhook, moins sûr que la signature qu’il fournit déjà. Ici, la fermeté dégrade le contrôle.' },
    ],
  },

  // ── Produit ───────────────────────────────────────────────────────────────
  {
    id: 'lien-partage-sequentiel', level: 1, audience: 'produit',
    who: 'Alix', role: 'PO facturation', context: 'Revue de la fonctionnalité de partage : le lien public d’une facture contient son numéro séquentiel.',
    objection: 'Personne ne devinera l’URL d’une facture, il faut en connaître le numéro.',
    replies: [
      { text: 'Les numéros se suivent : avec la sienne, on lit celle d’avant. Un jeton aléatoire par lien.', points: 2, trust: 1, risk: 2, why: 'Il n’y a rien à deviner quand les numéros se suivent : c’est ainsi que First American Financial a exposé en 2019 quelque 885 millions de documents, lisibles en changeant un chiffre dans l’URL. Un jeton aléatoire long par lien, révocable, rend l’énumération impossible sans rien changer à l’usage.' },
      { text: 'Ajoutons un captcha sur la page de partage, pour empêcher qu’un script énumère les numéros.', points: 0, trust: 0, risk: 0, why: 'Le captcha freine l’énumération automatisée, pas la curiosité : la facture d’à côté est à un essai près, et un captcha se fait résoudre pour quelques centimes. Le défaut est dans l’identifiant, pas dans le nombre de tentatives.' },
      { text: 'On l’inscrit comme risque accepté : la fonctionnalité est déjà annoncée aux clients.', points: 0, trust: 1, risk: -1, why: 'Accepté par qui ? Une lecture croisée des factures entre clients ne se signe pas au niveau d’un PO, et le correctif coûte moins cher que la procédure d’acceptation. L’annonce commerciale n’est pas un argument de risque.' },
    ],
  },
  {
    id: 'v2-sans-date', level: 1, audience: 'produit',
    who: 'Hugo', role: 'Product manager', context: 'L’import de fichiers CSV ne vérifie ni la taille ni le type des fichiers envoyés.',
    objection: 'On le fera dans la V2.',
    replies: [
      { text: 'D’accord pour la V2 : quelle date, quel propriétaire ? J’enregistre l’exception d’ici là.', points: 2, trust: 1, risk: 1, why: 'Tu ne contestes pas l’arbitrage, tu lui donnes une forme : une date et un nom. Une V2 sans date est un « jamais » poli ; avec une exception enregistrée qui expire, le sujet revient tout seul sur la table au bon moment.' },
      { text: 'Mettons au moins une limite de taille au proxy d’ici là ; le reste attendra la V2.', points: 1, trust: 1, risk: 1, why: 'La limite couvre le déni de service, pas le contenu des fichiers. Et la V2 n’a toujours pas de date : tu as obtenu une mesure partielle contre un report indéfini de tout le reste.' },
      { text: 'La V2 n’a pas de date : je bloque la mise en production tant que la validation n’est pas faite.', points: 0, trust: -1, risk: 1, why: 'Le go/no-go n’appartient pas à l’AppSec, et un blocage unilatéral sur un défaut modéré se paie à la revue suivante, quand on ne t’invitera plus. Le problème réel est l’absence de date, pas le report lui-même.' },
    ],
  },
  {
    id: 'demo-donnees-prod', level: 1, audience: 'produit',
    who: 'Hugo', role: 'Product manager', context: 'Démonstration la semaine prochaine chez un prospect du même secteur que plusieurs de nos clients.',
    objection: 'Copie la base de production sur l’environnement de démo, les données seront plus parlantes.',
    replies: [
      { text: 'Je crée un tenant fictif crédible (noms, montants, relances) à partir des scripts de la QA.', points: 2, trust: 1, risk: 2, why: 'Le besoin de Hugo est la crédibilité, pas les vraies données. Un tenant fictif bien peuplé la donne, et la démo peut être rejouée devant n’importe qui, sans se demander ce que le prospect a vu à l’écran.' },
      { text: 'D’accord, si on masque les noms et les e-mails des clients avant la copie.', points: 0, trust: 1, risk: -1, why: 'Il reste les SIRET, les adresses, les montants et les notes libres : le prospect reconnaîtra ses concurrents à leurs chiffres. Et l’environnement de démo n’a pas les contrôles de la production, alors qu’il en contient désormais les données.' },
      { text: 'Impossible : le RGPD interdit toute copie des données de production en dehors de la production.', points: 0, trust: -1, risk: 1, why: 'La conclusion est bonne et l’argument faux : le RGPD ne pose pas cette interdiction, il exige une finalité, une base légale et la minimisation. Le jour où quelqu’un vérifie, tu perds le crédit juridique dont tu auras besoin ailleurs.' },
    ],
  },
  {
    id: 'exception-renouvelee', level: 2, audience: 'produit',
    who: 'Alix', role: 'PO facturation', context: 'L’exception sur le chiffrement des pièces jointes expire demain. Ce serait son quatrième renouvellement.',
    objection: 'Renouvelle-la encore trois mois, comme d’habitude.',
    replies: [
      { text: 'Quatrième renouvellement : c’est au CTO de signer. Je lui prépare le coût et le risque.', points: 2, trust: 1, risk: 2, why: 'Une exception renouvelée quatre fois est devenue une décision permanente prise sans personne. Faire monter le niveau d’approbation n’est pas une sanction : c’est le moment où quelqu’un qui arbitre les budgets voit enfin ce que coûte ce report.' },
      { text: 'Je la renouvelle pour un mois seulement, avec un point hebdomadaire sur le correctif.', points: 1, trust: 1, risk: 0, why: 'Plus court, plus suivi, et toujours le même décideur : le point hebdomadaire deviendra un rituel de plus. Tu raccourcis la boucle sans changer ce qui la fait tourner.' },
      { text: 'Je la laisse expirer : le scanner rouvrira le finding et la CI bloquera les déploiements.', points: 0, trust: -1, risk: 1, why: 'Un blocage de déploiement qui surgit sans discussion, sur un risque accepté depuis un an : l’équipe apprendra surtout à contourner la CI. L’expiration doit provoquer une décision, pas une panne.' },
    ],
  },
  {
    id: 'session-replay', level: 2, audience: 'produit',
    who: 'Hugo', role: 'Product manager', context: 'Le marketing veut un outil tiers d’enregistrement de sessions (session replay) sur toute l’application.',
    objection: 'Tous nos concurrents enregistrent les sessions. On ne peut pas s’en passer.',
    replies: [
      { text: 'D’accord, avec tout masqué par défaut ; on démasque écran par écran, jamais la facturation.', points: 2, trust: 1, risk: 2, why: 'Ces scripts enregistrent la page entière. En 2017, l’étude « No boundaries » de chercheurs de Princeton a montré des mots de passe et des données personnelles partant chez les éditeurs quand le masquage reposait sur le site. Masquer par défaut inverse la charge : un oubli ne fuit plus rien.' },
      { text: 'Faisons d’abord une analyse d’impact avec la DPO avant de signer avec l’éditeur.', points: 1, trust: 0, risk: 1, why: 'Démarche juste, qui arrivera à la même question sans y répondre : quels écrans, quels champs. Mieux vaut arriver chez la DPO avec une configuration de masquage : elle validera du concret.' },
      { text: 'Leur script servi par un CDN, c’est trop risqué : on l’héberge nous-mêmes, en version figée.', points: 0, trust: 1, risk: 0, why: 'Tu traites la chaîne d’approvisionnement du script, et c’est un vrai sujet. Mais le risque principal est ce que le script envoie, pas d’où il vient : hébergé chez nous, il enregistre les mêmes factures.' },
    ],
  },
  {
    id: 'regles-mots-de-passe', level: 3, audience: 'produit',
    who: 'Maëlle', role: 'Designer UX', context: 'Tests utilisateurs de la nouvelle page d’inscription.',
    objection: 'Majuscule, chiffre, symbole et changement tous les 90 jours : tes règles font fuir les inscrits.',
    replies: [
      { text: 'Tu as raison. Longueur minimale, refus des mots de passe déjà fuités, et plus de rotation forcée.', points: 2, trust: 1, risk: 2, why: 'Maëlle a raison, et le NIST aussi : ses lignes directrices (SP 800-63B) écartent les règles de composition et le changement périodique, qui produisent « Motdepasse1! » puis « Motdepasse2! ». La longueur et la vérification contre les listes de mots de passe compromis protègent mieux et gênent moins.' },
      { text: 'D’accord sur le constat : gardons les règles, avec un indicateur de robustesse qui guide la saisie.', points: 1, trust: 1, risk: 0, why: 'L’indicateur aide, et il habille des règles qui restent contre-productives : la rotation forcée continue de produire des variantes prévisibles. Tu améliores l’interface d’une politique qu’il fallait changer.' },
      { text: 'Ces règles sont la norme en sécurité : on les garde, quitte à perdre quelques inscrits.', points: 0, trust: -1, risk: 0, why: 'Elles l’étaient il y a quinze ans. Défendre une règle que le référentiel lui-même a abandonnée, face à des tests utilisateurs, coûte de la crédibilité pour un gain de sécurité nul.' },
    ],
  },
  {
    id: 'limite-connexion-proxy', level: 3, audience: 'produit',
    who: 'Hugo', role: 'Product manager', context: 'Un grand compte connecte 300 comptables derrière une seule adresse IP de sortie.',
    objection: 'Ta limite de tentatives de connexion bloque nos plus gros clients le lundi matin. Retire-la.',
    replies: [
      { text: 'Compter par IP pénalise les proxys : on compte par compte visé, avec un plafond IP large.', points: 2, trust: 1, risk: 2, why: 'La plainte est fondée : une limite par adresse IP punit toute une entreprise pour trois fautes de frappe. Compter les échecs par compte visé arrête le forçage d’un compte, et un plafond IP élevé freine le credential stuffing sans gêner un bureau entier.' },
      { text: 'Tu as raison : mettons l’IP de ce client en liste blanche, la limite reste pour les autres.', points: 1, trust: 1, risk: 0, why: 'Le client est débloqué dès aujourd’hui. Mais la liste blanche retire toute protection aux comptes de ce client, précisément les plus précieux, et chaque grand compte suivant demandera la sienne.' },
      { text: 'La limite protège contre le credential stuffing : elle reste telle quelle, c’est le prix à payer.', points: 0, trust: -1, risk: 0, why: 'La menace est réelle et le contrôle mal réglé. Défendre le réglage plutôt que l’objectif, c’est garantir que la limite sera retirée par quelqu’un d’autre, sans toi, au premier incident commercial.' },
    ],
  },

  // ── Direction ─────────────────────────────────────────────────────────────
  {
    id: 'cyber-assurance', level: 1, audience: 'direction',
    who: 'Bastien', role: 'Directeur financier', context: 'Arbitrage du budget sécurité de l’année prochaine.',
    objection: 'On a une cyber-assurance. Pourquoi payer aussi pour la sécurité ?',
    replies: [
      { text: 'La prime dépend déjà de nos contrôles, et l’assureur n’indemnise pas les clients perdus.', points: 2, trust: 1, risk: 1, why: 'Les deux arguments se vérifient dans le dossier de souscription : le questionnaire de l’assureur porte sur la MFA, les sauvegardes, les correctifs. Et aucune police ne rend la confiance d’un client dont les factures ont fuité.' },
      { text: 'Le programme réduit la probabilité d’un incident, l’assurance n’en réduit que le coût.', points: 1, trust: 0, risk: 0, why: 'Juste, et abstrait : un directeur financier l’entend comme un argument de principe. Il lui faut ce qui le touche, la prime et les pertes que la police ne couvre pas.' },
      { text: 'Comparons le coût de la prime et celui du programme sur trois ans, et gardons le moins cher.', points: 0, trust: 0, risk: -1, why: 'Tu acceptes de comparer deux choses qui ne se substituent pas : l’assurance suppose les contrôles, elle ne les remplace pas. Si le programme perd la comparaison, la prime monte l’année suivante.' },
    ],
  },
  {
    id: 'peut-nous-arriver', level: 1, audience: 'direction',
    who: 'Sophie', role: 'Directrice générale', context: 'Un concurrent vient de subir une fuite très médiatisée : un bucket S3 laissé public.',
    objection: 'Est-ce que ça peut nous arriver ? Je veux un oui ou un non.',
    replies: [
      { text: 'Pour cette cause-là, non : le blocage d’accès public S3 est actif sur tout le compte, vérifié ce matin.', points: 2, trust: 1, risk: 1, why: 'Tu réponds à la question posée, sur la cause connue, avec un contrôle vérifié le jour même : Block Public Access au niveau du compte empêche de rendre un bucket public, même par erreur. La direction a une réponse, et une preuve.' },
      { text: 'Oui, comme toute entreprise : le risque zéro n’existe pas, on ne peut que le réduire.', points: 0, trust: -1, risk: 0, why: 'Vrai et inutile : la directrice a posé une question précise, sur une cause précise. La généralité sonne comme une esquive et installe l’idée que la sécurité ne sait jamais rien affirmer.' },
      { text: 'Non : notre audit annuel n’a relevé aucun finding critique le trimestre dernier.', points: 0, trust: 1, risk: -1, why: 'Un audit sans finding critique ne dit rien de la configuration S3 d’aujourd’hui, et son périmètre ne la couvrait peut-être pas. Tu réponds « non » sur la foi d’un document, pas d’un contrôle, et c’est toi qui en répondras.' },
    ],
  },
  {
    id: 'plateforme-miracle', level: 2, audience: 'direction',
    who: 'Dominique', role: 'CTO', context: 'Un éditeur présente une plateforme qui promet de prioriser automatiquement tous les findings.',
    objection: 'On l’achète, et on arrête de trier les findings à la main.',
    replies: [
      { text: 'Un mois d’essai sur notre backlog réel : on compare ses priorités à notre grille.', points: 2, trust: 1, risk: 1, why: 'La promesse devient une hypothèse mesurable, sur tes données et contre ta propre grille. Si l’outil tombe juste, l’achat se justifie par un chiffre ; sinon, tu sais où il se trompe avant d’avoir signé.' },
      { text: 'L’outil aidera, mais la grille de décision doit rester la nôtre : il faudra l’y paramétrer.', points: 1, trust: 1, risk: 0, why: 'Le principe est juste et ne dit pas comment le vérifier. Sans essai sur le backlog réel, tu découvriras après la signature que l’outil ne sait pas exprimer ta règle d’atteignabilité.' },
      { text: 'Un outil de plus ne résoudra rien : notre problème est l’adoption, pas la priorisation.', points: 0, trust: -1, risk: 0, why: 'Peut-être, mais tu l’affirmes sans le montrer, face à un CTO qui voit une solution à portée de main. Il achètera sans toi, et l’outil sera paramétré par l’éditeur.' },
    ],
  },
  {
    id: 'pentest-a-refaire', level: 3, audience: 'direction', avoid: ['pentest-ou-sast'],
    who: 'Bastien', role: 'Directeur financier', context: 'Renouvellement du contrat de pentest annuel.',
    objection: 'L’an dernier, ils ont trouvé trois choses, corrigées en une semaine. Pourquoi repayer la même chose ?',
    replies: [
      { text: 'Juste : même périmètre, même résultat. On le recentre sur ce qui a changé, l’API publique et le SSO.', points: 2, trust: 1, risk: 2, why: 'Bastien a vu juste : un pentest qui repasse sur le même périmètre rend de moins en moins. Le budget garde son sens s’il suit les changements d’architecture, et c’est un argument qu’un directeur financier peut défendre à son tour.' },
      { text: 'Juste, alors remplaçons-le par un bug bounty : on ne paiera que ce qui est trouvé.', points: 1, trust: 1, risk: 0, why: 'L’idée a du sens pour une surface publique, et elle sous-estime le coût : le tri des signalements, nombreux et de qualité inégale, mobilise l’équipe. Et un programme de bug bounty ne garantit pas que quelqu’un regarde le SSO.' },
      { text: 'Un pentest annuel est une exigence de base : on ne peut pas le retirer du budget.', points: 0, trust: -1, risk: 0, why: 'Défendre le rituel plutôt que son rendement, face à quelqu’un qui a lu le rapport, c’est lui donner raison sur le fond. La ligne sera coupée l’année suivante, et tu n’auras rien proposé à la place.' },
    ],
  },
  {
    id: 'ci-bloquante', level: 3, audience: 'direction',
    who: 'Dominique', role: 'CTO', context: 'Revue trimestrielle : le délai de livraison a augmenté depuis l’ajout de contrôles bloquants en CI.',
    objection: 'Tes contrôles ralentissent tout le monde. On les passe tous en non bloquant.',
    replies: [
      { text: 'Ne bloquent plus que les règles presque sans faux positif ; les autres avertissent.', points: 2, trust: 1, risk: 1, why: 'Dominique a raison sur un point : un contrôle bloquant qui se trompe souvent coûte plus qu’il ne protège. Trier les règles par précision garde le blocage là où il est incontestable (un secret commité, une dépendance malveillante connue) et rend le reste supportable.' },
      { text: 'Tu as raison : passons-les en non bloquant, avec un tableau de bord suivi chaque semaine.', points: 1, trust: 1, risk: 0, why: 'Tu gagnes la paix et tu perds le contrôle : une alerte qui ne bloque rien et qu’on consulte en réunion hebdomadaire n’arrête pas un secret avant qu’il parte. Le tableau de bord sera lu trois semaines.' },
      { text: 'La sécurité a un coût : les contrôles bloquants restent, c’est le prix d’une livraison sûre.', points: 0, trust: -1, risk: 0, why: 'Tu défends tous les contrôles en bloc, y compris ceux qui crient au loup. Le CTO a l’autorité pour trancher sans toi, et il coupera tout, y compris ce qui méritait de bloquer.' },
    ],
  },
  {
    id: 'risque-en-euros', level: 3, audience: 'direction',
    who: 'Bastien', role: 'Directeur financier', context: 'Demande de budget pour refondre l’isolation entre tenants.',
    objection: 'Tu dis « risque élevé ». Donne-moi un chiffre en euros, sinon je ne peux pas arbitrer.',
    replies: [
      { text: 'Une fourchette, pas un chiffre : pertes annuelles probables, hypothèses, effet de la refonte.', points: 2, trust: 1, risk: 1, why: 'La demande est légitime : on ne compare pas « élevé » à un budget. Une estimation à la manière de FAIR donne une fourchette, fréquence fois ampleur, avec ses hypothèses : le directeur financier peut les contester une à une, et c’est justement ce qui la rend crédible.' },
      { text: 'Je reprends le coût moyen d’une fuite publié par une étude sectorielle, pour l’ordre de grandeur.', points: 1, trust: 1, risk: 0, why: 'Un chiffre arrive vite, et ce n’est pas le nôtre : une moyenne mondiale tous secteurs ne dit rien d’un SaaS de facturation de notre taille. Au premier « d’où vient ce chiffre ? », l’argument tombe.' },
      { text: 'Le risque cyber ne se chiffre pas de façon fiable ; le score CVSS reste notre mesure.', points: 0, trust: -1, risk: 0, why: 'CVSS mesure une gravité technique, pas une perte, et le directeur financier le sait ou l’apprendra. Refuser de chiffrer, c’est laisser la décision se prendre sur le seul coût, qui lui est chiffré.' },
    ],
  },

  // ── Ops, SRE et données ───────────────────────────────────────────────────
  {
    id: 'port-22-ouvert', level: 1, audience: 'ops',
    who: 'Karim', role: 'Ingénieur plateforme', context: 'Un collègue doit dépanner ce soir une instance EC2 de production, depuis chez lui.',
    objection: 'J’ouvre le port 22 à tout Internet le temps du dépannage, et je referme après.',
    replies: [
      { text: 'Inutile d’ouvrir un port : Session Manager donne un shell via IAM, journalisé.', points: 2, trust: 1, risk: 2, why: 'AWS Systems Manager Session Manager ne demande aucun port entrant : l’agent de l’instance sort vers AWS, et l’accès passe par une permission IAM, nominative et révocable. Plus rapide que de modifier un security group, et rien à refermer.' },
      { text: 'Ouvre-le seulement pour son adresse IP personnelle, et supprime la règle dès qu’il a fini.', points: 1, trust: 1, risk: 0, why: 'Nettement mieux que tout Internet. Reste une adresse domestique qui change, une règle qu’on oublie de supprimer à minuit, et un accès par clé partagée sans trace nominative.' },
      { text: 'Ouvre-le, mais déplace SSH sur le port 2222 pour échapper aux scanners automatiques.', points: 0, trust: 1, risk: -1, why: 'Les scanners d’Internet balaient tous les ports en quelques minutes : changer de port réduit un peu le bruit des journaux, pas l’exposition. C’est de l’obscurité présentée comme un contrôle.' },
    ],
  },
  {
    id: 'root-partage', level: 1, audience: 'ops',
    who: 'Morgane', role: 'SRE d’astreinte', context: 'Les identifiants du compte root AWS sont partagés dans le coffre de l’équipe d’astreinte.',
    objection: 'On en a besoin la nuit en cas d’urgence. C’est plus simple qu’un rôle.',
    replies: [
      { text: 'Un rôle d’urgence nominatif, MFA et alerte à chaque usage : aussi rapide, et on sait qui a fait quoi.', points: 2, trust: 1, risk: 2, why: 'Le besoin d’un accès d’urgence est réel ; il ne demande pas root. Un rôle « bris de glace », assumé par chacun avec sa propre identité, donne les droits utiles, une trace nominative, et une alerte qui rend tout usage visible le lendemain.' },
      { text: 'Garde-le, mais avec une MFA sur root dont le seul appareil est détenu par le lead.', points: 1, trust: -1, risk: 1, why: 'La MFA sur root est indispensable, et un appareil unique chez une seule personne transforme l’accès d’urgence en appel téléphonique à 3 h du matin. Le jour où le lead ne répond pas, quelqu’un trouvera un contournement.' },
      { text: 'Change le mot de passe root chaque mois, et garde l’historique des accès au coffre.', points: 0, trust: 1, risk: 0, why: 'La rotation ne change rien au partage : on sait qui a ouvert le coffre, jamais qui a agi avec root dans AWS. En cas d’incident, CloudTrail montrera « root », pas un nom.' },
    ],
  },
  {
    id: 'jetons-dans-les-journaux', level: 1, audience: 'ops', avoid: ['dpo-journaux'],
    who: 'Morgane', role: 'SRE d’astreinte', context: 'Des erreurs 401 intermittentes sur l’API depuis la dernière mise en production.',
    objection: 'Pour déboguer, il me faut les en-têtes complets dans les journaux, Authorization compris.',
    replies: [
      { text: 'Journalise l’empreinte du jeton et ses claims, émetteur et expiration : c’est ce qui explique un 401.', points: 2, trust: 1, risk: 2, why: 'Un 401 intermittent s’explique presque toujours par l’expiration, l’émetteur ou l’audience, lisibles sans le jeton. Un jeton en clair dans un journal est une session à voler : en 2023, des fichiers HAR confiés au support d’Okta ont servi à détourner les sessions de plusieurs de ses clients.' },
      { text: 'D’accord pour une semaine, avec une purge automatique des journaux à la fin.', points: 0, trust: 1, risk: -1, why: 'Pendant sept jours, chaque jeton valide est lisible par tous ceux qui ont accès aux journaux et à leurs exports. La purge arrive après la fenêtre de risque, pas avant.' },
      { text: 'Active-le sur un seul pod, en échantillonnant 1 % des requêtes, pendant une heure.', points: 0, trust: 1, risk: -1, why: 'Le volume baisse, pas la nature : chaque jeton capturé reste utilisable jusqu’à son expiration. Et l’échantillon a peu de chances de contenir la requête en erreur, que les claims auraient expliquée à coup sûr.' },
    ],
  },
  {
    id: 'sauvegardes-meme-compte', level: 2, audience: 'ops',
    who: 'Karim', role: 'Ingénieur plateforme', context: 'Revue du plan de reprise après un exercice de rançongiciel.',
    objection: 'Les sauvegardes restent dans le compte AWS de production, c’est plus simple pour restaurer.',
    replies: [
      { text: 'Copie vers un coffre verrouillé d’un autre compte : un admin de prod compromis n’y touche pas.', points: 2, trust: 1, risk: 2, why: 'Le scénario à couvrir est l’effacement par quelqu’un qui tient le compte de production. En 2014, Code Spaces a cessé son activité après qu’un attaquant entré dans sa console AWS a supprimé données et sauvegardes. Un coffre dans un autre compte, sous Vault Lock, résiste à cet attaquant-là.' },
      { text: 'Active la suppression protégée par MFA sur le bucket S3 des sauvegardes.', points: 1, trust: 1, risk: 1, why: 'Un vrai contrôle, mais étroit : il ne protège que les versions d’un bucket, ne s’active qu’avec le compte root, et laisse les sauvegardes dans le compte qu’on craint de voir compromis.' },
      { text: 'Chiffre-les avec une clé KMS dédiée, dont seul le rôle de sauvegarde a l’usage, et journalise tout.', points: 0, trust: 1, risk: 0, why: 'Tu protèges contre la lecture, alors que la menace est l’effacement. Un administrateur du compte supprime une sauvegarde chiffrée aussi facilement qu’une autre, et peut même programmer la suppression de la clé.' },
    ],
  },
  {
    id: 'correctif-console', level: 2, audience: 'ops',
    who: 'Karim', role: 'Ingénieur plateforme', context: 'Un security group ouvre la base Postgres à tout le VPC. La correction est urgente.',
    objection: 'Je corrige la règle directement dans la console, Terraform suivra plus tard.',
    replies: [
      { text: 'Console s’il le faut, et PR Terraform dans l’heure : sinon le prochain apply rouvre la base.', points: 2, trust: 1, risk: 2, why: 'L’urgence justifie la console, et le code reste la source de vérité : au prochain terraform apply, la règle d’origine revient. Le vrai risque n’est pas le chemin emprunté, c’est l’écart entre la console et le code.' },
      { text: 'Fais-le directement en Terraform : une PR avec revue prend vingt minutes.', points: 1, trust: 0, risk: 1, why: 'Juste sur le fond, et vingt minutes de revue en urgence font souvent une heure, pendant laquelle la base reste ouverte. Tu défends le processus au moment où le délai compte le plus.' },
      { text: 'Corrige dans la console, et ajoute la ressource aux exceptions de la détection de dérive Terraform.', points: 0, trust: 1, risk: -1, why: 'L’alerte de dérive se tait, et le prochain apply réécrit quand même la règle d’origine : tu as fait taire le signal qui t’aurait prévenu que la base se rouvrait.' },
    ],
  },
  {
    id: 'acces-base-data', level: 2, audience: 'ops',
    who: 'Léa', role: 'Data engineer', context: 'L’équipe data construit les tableaux de bord de chiffre d’affaires.',
    objection: 'Donne-moi un accès en lecture à la base de production, j’ai des analyses à faire.',
    replies: [
      { text: 'Un export quotidien vers l’entrepôt, colonnes personnelles exclues : il te suffit.', points: 2, trust: 1, risk: 2, why: 'Le besoin est réel et porte sur des agrégats. L’export filtré le couvre entièrement, sans faire de l’entrepôt une seconde base de production, et sans charger la base principale de requêtes analytiques.' },
      { text: 'Un compte en lecture seule sur le réplica, limité aux tables de facturation, journalisé.', points: 1, trust: 1, risk: 0, why: 'Lecture seule et journalisé, c’est déjà sérieux. Mais les tables de facturation contiennent les données de tous les tenants, noms et adresses compris : l’accès donne tout, tous les jours, pour un besoin d’agrégats.' },
      { text: 'Passe par l’API publique avec un jeton administrateur : c’est déjà authentifié et journalisé.', points: 0, trust: 1, risk: -1, why: 'Un jeton qui voit tous les tenants, stocké dans un notebook ou un outil de BI : c’est le secret le plus puissant de l’entreprise, confié à l’usage le moins contrôlé.' },
    ],
  },
  {
    id: 'alertes-de-nuit', level: 3, audience: 'ops', avoid: ['waf-astreinte'],
    who: 'Morgane', role: 'SRE d’astreinte', context: 'Troisième nuit de la semaine réveillée par une alerte de sécurité sans suite.',
    objection: 'Tes alertes me réveillent pour rien. Je les coupe la nuit.',
    replies: [
      { text: 'D’accord : ne te réveillent plus que celles qui exigent une action de nuit.', points: 2, trust: 1, risk: 2, why: 'Morgane décrit la fatigue d’alerte, et elle a un coût réel : en 2013, pendant l’intrusion qui a coûté à Target quelque 40 millions de cartes bancaires, des alertes de son outil de détection sont restées sans suite. Une alerte qui réveille doit avoir une action écrite ; les autres attendent le jour.' },
      { text: 'Compris : toutes en file du matin pendant un mois, et on mesure ce qu’on a manqué.', points: 1, trust: 1, risk: -1, why: 'L’expérience est honnête, et elle met en attente les rares alertes qui ne le peuvent pas, un export massif ou une connexion root. On mesurera ce qu’on a manqué après l’avoir manqué.' },
      { text: 'Une alerte de sécurité ne se trie pas au confort : elles restent toutes actives la nuit.', points: 0, trust: -1, risk: -1, why: 'La fermeté produit ce qu’elle voulait éviter : une astreinte qui ne lit plus les alertes, ou qui les coupe sans te le dire. Le bruit est un défaut de la détection, pas une faiblesse de Morgane.' },
    ],
  },
  {
    id: 'gel-de-cloture', level: 3, audience: 'ops',
    who: 'Karim', role: 'Ingénieur plateforme', context: 'Mardi. Une vulnérabilité classée Attend (7 jours) a son correctif prêt. La clôture comptable gèle les déploiements jusqu’à vendredi.',
    objection: 'Pas de déploiement cette semaine, même ton correctif. C’est la clôture.',
    replies: [
      { text: 'Le gel tient : les sept jours courent jusqu’à mardi prochain. Correctif lundi matin.', points: 2, trust: 1, risk: 1, why: 'Karim défend une contrainte réelle, et le calendrier lui donne raison : Attend, c’est sept jours, pas « tout de suite ». Relire le SLA avant de négocier évite une bataille qui n’avait pas lieu d’être.' },
      { text: 'Passons par la procédure d’urgence du gel, validée par le DAF, pour déployer dès demain.', points: 1, trust: 0, risk: 1, why: 'Le risque baisse quelques jours plus tôt, au prix d’une procédure d’exception dont le délai ne dépend pas. Consommer l’urgence quand le calendrier suffit, c’est l’user pour le jour où un Act en aura besoin.' },
      { text: 'Un correctif de sécurité n’est pas une fonctionnalité : il sort du périmètre du gel.', points: 0, trust: -1, risk: 0, why: 'Un correctif est un changement comme un autre, avec ses risques de régression : en juillet 2024, une mise à jour de contenu de CrowdStrike, un éditeur de sécurité, a mis hors service des millions de postes Windows. Le gel protège la clôture ; s’en exempter par principe, c’est oublier pourquoi il existe.' },
    ],
  },

  // ── Juridique, commercial, support ────────────────────────────────────────
  {
    id: 'questionnaire-oui', level: 1, audience: 'metier', avoid: ['rapport-pentest-client'],
    who: 'Thomas', role: 'Commercial grands comptes', context: 'Un prospect envoie un questionnaire de sécurité de 200 questions. Signature prévue en fin de mois.',
    objection: 'Réponds « oui » partout, on verra les détails après la signature.',
    replies: [
      { text: 'Je réponds vrai, avec la mesure compensatoire là où c’est non : tout finira annexé au contrat.', points: 2, trust: 1, risk: 1, why: 'Un questionnaire signé devient un engagement contractuel. Un « non » accompagné d’une mesure et d’une date se négocie ; un « oui » faux se découvre à l’audit ou après l’incident, et c’est alors une faute.' },
      { text: 'Je réponds « en cours » aux questions gênantes : c’est honnête, et ça ne bloque rien.', points: 0, trust: 1, risk: -1, why: '« En cours » sans date est lu comme un oui par l’acheteur et comme un non par son RSSI : tu perds sur les deux tableaux, et la question revient au premier audit.' },
      { text: 'Envoie-leur plutôt notre dernier rapport de pentest complet, il répond à la plupart des questions.', points: 0, trust: 1, risk: -1, why: 'Le rapport détaille des vulnérabilités, peut-être encore ouvertes, à un tiers qui le fera circuler en interne. Et il ne répond pas aux questions d’organisation qui composent l’essentiel du questionnaire.' },
    ],
  },
  {
    id: 'mot-de-passe-par-mail', level: 1, audience: 'metier',
    who: 'Élodie', role: 'Customer success', context: 'Un client a perdu l’accès à son compte administrateur et appelle le support.',
    objection: 'Je lui renvoie son mot de passe par e-mail, c’est le plus rapide.',
    replies: [
      { text: 'On ne l’a pas, il est haché. Lien de réinitialisation vers l’adresse du compte, après vérification.', points: 2, trust: 1, risk: 2, why: 'Un mot de passe qu’on peut renvoyer serait un mot de passe mal stocké. Le lien part vers l’adresse déjà connue, pas vers celle donnée au téléphone : en 2023, MGM Resorts a été compromis après un simple appel à son support informatique, passé par un attaquant qui se faisait passer pour un employé.' },
      { text: 'Vérifie son identité en le rappelant au numéro du contrat, puis réinitialise-le toi-même.', points: 1, trust: 1, risk: 0, why: 'Le rappel au numéro connu est un vrai contrôle. Mais un mot de passe choisi par le support est connu du support, transmis par un canal quelconque, et le client le garde souvent tel quel.' },
      { text: 'D’accord, mais par SMS plutôt que par e-mail : c’est un canal plus sûr.', points: 0, trust: 1, risk: -1, why: 'Le canal n’est pas le problème : nous ne devrions pas connaître ce mot de passe. S’il peut être renvoyé, il est stocké de façon réversible, et c’est ce défaut-là qu’il faut signaler.' },
    ],
  },
  {
    id: 'chercheur-et-plainte', level: 1, audience: 'metier',
    who: 'Julie', role: 'Juriste', context: 'Un chercheur signale une faille qui permet de lire les factures d’un autre tenant, démontrée entre deux comptes d’essai qu’il a créés.',
    objection: 'Il a attaqué notre application. On porte plainte.',
    replies: [
      { text: 'Il pouvait la revendre, il nous l’a dite. On corrige, on le remercie, on publie une politique.', points: 2, trust: 1, risk: 2, why: 'La faille existe avec ou sans lui ; poursuivre celui qui signale apprend surtout aux suivants à se taire. En 2021, le gouverneur du Missouri a voulu faire poursuivre un journaliste qui avait signalé des numéros de sécurité sociale visibles dans le code source d’un site de l’État : le procureur a refusé en 2022, et l’affaire a fait bien plus de bruit que la faille.' },
      { text: 'Corrigeons d’abord ; la question de la plainte, on la tranchera ensuite avec la direction.', points: 1, trust: 1, risk: 1, why: 'Corriger d’abord est juste. Mais laisser la plainte en suspens, c’est garder une menace ouverte sur quelqu’un qui a agi de bonne foi, et il le sentira dans la réponse qu’on lui fera.' },
      { text: 'Répondons qu’on ne tolère pas les tests non autorisés, et conservons sa preuve dans le dossier.', points: 0, trust: -1, risk: 0, why: 'Le ton juridique ferme le canal au moment où il sert : le chercheur publiera sans prévenir la prochaine fois, ou n’écrira plus. Une politique de divulgation dit ce qui est autorisé avant, pas après.' },
    ],
  },
  {
    id: 'rapport-pentest-client', level: 2, audience: 'metier',
    who: 'Thomas', role: 'Commercial grands comptes', context: 'Le grand compte exige le rapport de pentest complet avant de signer.',
    objection: 'Ils veulent le rapport. Je leur envoie ?',
    replies: [
      { text: 'Attestation du prestataire et état des corrections ; le détail, en lecture seule sous NDA.', points: 2, trust: 1, risk: 2, why: 'Le client veut savoir si on teste et si on corrige : l’attestation et le suivi des corrections y répondent. Le détail d’exploitation reste consultable, sans circuler par e-mail dans une organisation de dix mille personnes.' },
      { text: 'Envoie-le, mais seulement quand tous les findings auront été corrigés et retestés.', points: 1, trust: 0, risk: 1, why: 'Tu protèges les failles encore ouvertes, et tu retardes la signature de plusieurs semaines. Le rapport finira quand même dans des boîtes aux lettres que personne ne maîtrise.' },
      { text: 'Envoie-le tel quel : la transparence rassure, et ils ont signé un accord de confidentialité.', points: 0, trust: 1, risk: -1, why: 'Un accord de confidentialité engage le client, pas les dizaines de personnes qui recevront la pièce jointe. Tu envoies le mode d’emploi de tes vulnérabilités ouvertes pour répondre à une question de confiance.' },
    ],
  },
  {
    id: 'clause-24-heures', level: 2, audience: 'metier',
    who: 'Julie', role: 'Juriste', context: 'Le contrat d’un grand compte impose de notifier « tout incident de sécurité » sous 24 heures.',
    objection: 'C’est une clause standard. Je la signe telle quelle ?',
    replies: [
      { text: 'Oui si « incident » vise une atteinte avérée à leurs données. Sinon, chaque scan bloqué devient notifiable.', points: 2, trust: 1, risk: 1, why: 'Le délai est tenable, la définition ne l’est pas : « tout incident de sécurité » couvre la moindre tentative bloquée. Le contrat engage sur ce qui est écrit, et une clause qu’on ne peut pas respecter est une rupture qui attend son heure.' },
      { text: 'Demande 72 heures, comme le RGPD : ce sera plus facile à tenir pour l’équipe.', points: 0, trust: 0, risk: -1, why: 'Les 72 heures du RGPD sont le délai du responsable de traitement envers l’autorité de contrôle. Novafact, sous-traitant de son client, doit le prévenir dans les meilleurs délais (article 33) : réclamer 72 heures, c’est lui faire manquer les siennes.' },
      { text: 'Signe : de toute façon, on préviendrait le client au moindre doute, c’est notre politique.', points: 1, trust: 1, risk: 0, why: 'L’intention est la bonne, le texte reste ambigu. En cas de litige, c’est le contrat qu’on lira, pas la politique interne, et l’ambiguïté jouera contre nous.' },
    ],
  },
  {
    id: 'facture-au-mauvais-client', level: 2, audience: 'metier',
    who: 'Élodie', role: 'Customer success', context: 'Un client dit avoir reçu la facture d’un autre client, capture d’écran à l’appui.',
    objection: 'C’est sûrement un problème de messagerie chez eux. Je leur réponds de supprimer le message.',
    replies: [
      { text: 'D’abord nos journaux d’envoi : si l’erreur vient de nous, c’est une violation à qualifier.', points: 2, trust: 1, risk: 2, why: 'Une facture envoyée au mauvais destinataire est une violation de données possible, et les délais de notification courent dès qu’on en a connaissance. Vérifier l’envoi prend dix minutes et dit s’il s’agit d’un cas isolé ou d’un défaut qui touche d’autres clients.' },
      { text: 'Réponds-leur de supprimer le message et de nous confirmer par écrit que c’est fait.', points: 1, trust: 1, risk: 0, why: 'La confirmation de suppression fait bien partie de la réponse à une violation. Mais sans vérification, tu traites un symptôme : si le défaut est chez nous, d’autres clients reçoivent peut-être la même chose ce matin.' },
      { text: 'Ouvre un incident majeur et préviens tous les clients par précaution dès ce soir.', points: 0, trust: -1, risk: 0, why: 'Une notification générale avant d’avoir qualifié inquiète tout le monde pour un cas peut-être isolé, et engage l’entreprise sur un récit qu’on ne connaît pas encore. On qualifie d’abord, vite.' },
    ],
  },
  {
    id: 'sso-sans-mfa', level: 3, audience: 'metier',
    who: 'Thomas', role: 'Commercial grands comptes', context: 'Le grand compte veut que ses utilisateurs se connectent par son propre fournisseur d’identité (SSO).',
    objection: 'Ils ont déjà la MFA chez eux. Ils demandent qu’on désactive la nôtre pour leurs utilisateurs.',
    replies: [
      { text: 'Logique pour le SSO, leur fournisseur la fait. Les comptes hors SSO, eux, gardent la nôtre.', points: 2, trust: 1, risk: 2, why: 'La demande est fondée : deux MFA à la suite n’ajoutent que de la friction. Le détail qui compte, ce sont les comptes qui ne passent pas par le SSO, créés avant ou gardés en secours : ce sont eux qu’un attaquant visera.' },
      { text: 'Accepté : on désactive la MFA sur tous les comptes du tenant dès l’activation du SSO.', points: 0, trust: 1, risk: -1, why: 'Tant que la connexion par mot de passe reste possible, chaque compte local du tenant s’ouvre avec un seul facteur. En 2021, Colonial Pipeline a été rançonné via un ancien compte VPN resté sans MFA.' },
      { text: 'La MFA Novafact est obligatoire pour tous les utilisateurs, sans exception possible.', points: 0, trust: -1, risk: 0, why: 'Tu imposes un second facteur à des utilisateurs qui en ont déjà un, pour un client qui pèse dans le chiffre d’affaires. La négociation se fera au-dessus de toi, et sans la nuance sur les comptes locaux.' },
    ],
  },
];

// ── Les séries ──────────────────────────────────────────────────────────────

const mix = (n1: number, n2: number, n3: number): [number, number, number] => [n1, n2, n3];
const by = (a: Audience) => (s: Scene) => s.audience === a;

export const pushbackSeries = defineSeries(scenes, [
  { id: 'premiers-echanges', title: 'Premiers échanges', mix: mix(8, 0, 0), level: 1,
    text: 'Chaque objection repose sur une idée fausse qu’on peut nommer. On apprend la forme d’une réponse qui démonte sans braquer.' },
  { id: 'developpeurs', title: 'Les développeurs', filter: by('dev'), mix: mix(3, 3, 2), level: 2,
    text: 'Revues de PR, faux positifs, dépendances. Les objections viennent de gens qui connaissent le code mieux que toi.' },
  { id: 'produit', title: 'Le produit', filter: by('produit'), mix: mix(2, 4, 2), level: 2,
    text: 'Dates de livraison, parcours d’inscription, démos. Le bon contenu ne suffit plus : il faut aussi le bon décideur.' },
  { id: 'direction', title: 'La direction', filter: by('direction'), mix: mix(3, 3, 2), level: 2,
    text: 'Budget, assurance, métriques. On te demande des chiffres et des décisions, pas des catégories.' },
  { id: 'ops', title: 'Ops et astreinte', filter: by('ops'), mix: mix(3, 3, 2), level: 2,
    text: 'La nuit, l’urgence, le gel des déploiements. Trois scènes où la contrainte opérationnelle a raison contre toi.' },
  { id: 'metier', title: 'Juridique, commercial, support', filter: by('metier'), mix: mix(2, 3, 3), level: 2,
    text: 'Contrats, questionnaires, clients au téléphone. Le risque se joue dans une clause ou un appel au support.' },
  { id: 'le-bon-decideur', title: 'Le bon décideur', mix: mix(0, 8, 0), level: 2,
    text: 'Tous publics confondus, un distracteur à moitié juste par scène : la bonne mesure portée par la mauvaise personne, ou contre la mauvaise menace.' },
  { id: 'ils-ont-raison', title: 'Ils ont (un peu) raison', mix: mix(0, 0, 8), level: 3,
    text: 'Chaque objection est en partie légitime. La réponse ferme et sécuritaire est souvent le piège : il faut concéder, puis déplacer.' },
  { id: 'semaine', title: 'Une semaine chez Novafact', mix: mix(3, 3, 2), level: 2, shuffleEachTime: true,
    text: 'Tous publics et tous niveaux, recomposée à chaque partie. C’est la seule série qu’on ne peut pas réviser.' },
]);

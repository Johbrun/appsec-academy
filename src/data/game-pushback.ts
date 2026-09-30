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

export interface Reply { text: string; points: 0 | 1 | 2; trust: -1 | 0 | 1; risk: -1 | 0 | 1 | 2; why: string }
export interface Scene { who: string; role: string; context: string; objection: string; replies: Reply[] }

export const scenes: Scene[] = [
  {
    who: 'Sacha', role: 'Lead dev API', context: 'Vendredi, 16 h. Une démo client est prévue à 17 h.',
    objection: 'Le SAST bloque ma PR pour un faux positif. Tu peux désactiver la règle ?',
    replies: [
      { text: 'Pose l’annotation d’exception, elle expire dans 90 jours et je repasse dessus.', points: 0, trust: 1, risk: -1, why: 'L’annotation est le bon outil, mais tu la poses sans avoir regardé : tu signes que c’est un faux positif sur la parole de quelqu’un qui est pressé. Si c’en est un vrai, il part en production avec ta signature dessus.' },
      { text: 'Montre-moi le code. Si c’en est un, on l’annote et je corrige la règle.', points: 2, trust: 1, risk: 1, why: 'Trente secondes de lecture décident de tout, et tu débloques aussi vite dans les deux cas. En prime, corriger la règle supprime le prochain faux positif : c’est le seul chemin qui réduit le nombre de fois où on te demandera ça.' },
      { text: 'Je désactive la règle sur ton dépôt et je la réactive juste après la démo.', points: 0, trust: 1, risk: -1, why: 'L’échéance a l’air courte et n’en est pas une : personne ne revient réactiver une règle le lundi. Et tu retires le contrôle pour tout le dépôt, donc pour des lignes que tu n’as pas regardées.' },
    ],
  },
  {
    who: 'Alix', role: 'PO facturation', context: 'Une BOLA a été trouvée sur l’export comptable. Livraison prévue vendredi chez un grand compte.',
    objection: 'Deux semaines de correction ? Impossible. On livre vendredi.',
    replies: [
      { text: 'Correctif minimal filtré par tenant d’ici jeudi, le reste part en dette tracée.', points: 1, trust: 1, risk: 1, why: 'Le contenu est bon et la vulnérabilité disparaît à temps. Mais tu as arbitré seul un risque qui n’est pas le tien : la prochaine fois qu’Alix voudra livrer, elle ne t’appellera pas.' },
      { text: 'Trois options chiffrées, et c’est le CTO qui signe celle qu’on retient.', points: 2, trust: 1, risk: 2, why: 'Tu rends la décision possible au lieu de la prendre. En pratique, une fois les coûts posés côte à côte, le correctif d’une journée s’impose de lui-même — et s’il ne s’impose pas, l’acceptation est signée par celui qui en porte les conséquences.' },
      { text: 'On livre, et j’ouvre un ticket P1 avec une revue de risque sous quinzaine.', points: 0, trust: 1, risk: -1, why: 'Un P1 et une revue donnent l’impression que le risque est tenu. Il ne l’est pas : la donnée d’un grand compte est lisible par ses concurrents pendant ces quinze jours, et c’est précisément la fenêtre qu’on cherchait à éviter.' },
    ],
  },
  {
    who: 'Charlie', role: 'Lead front', context: 'La CSP vient d’être activée en mode bloquant sur la page de paiement.',
    objection: 'La CSP casse le tag manager du marketing. On la retire.',
    replies: [
      { text: 'Report-Only une semaine, puis on ajoute le nonce au chargeur du tag manager.', points: 1, trust: 1, risk: 0, why: 'La méthode est la bonne, mais elle rend au tag manager le droit d’exécuter du script sur la page de paiement — c’est-à-dire exactement ce dont un skimmer a besoin. Tu as rétabli le marketing et le risque avec.' },
      { text: 'Le tag manager sort de la page de paiement ; la CSP reste, il vit ailleurs.', points: 2, trust: 1, risk: 2, why: 'La page qui touche à la carte bancaire n’a pas besoin de mesure d’audience, et c’est la seule où la CSP compte vraiment. Le marketing garde ses tags sur tout le reste du site : personne ne perd rien.' },
      { text: 'On la retire, je la remets au sprint suivant avec un budget de test dédié.', points: 0, trust: 1, risk: -1, why: 'Le sprint suivant a déjà ses engagements, et une CSP qu’on remet coûte le double : il faut refaire toute la mesure d’impact. La page de paiement reste pendant ce temps la cible la plus rentable du site.' },
    ],
  },
  {
    who: 'Dominique', role: 'CTO', context: 'Réunion budgétaire du trimestre.',
    objection: 'Pourquoi payer un pentest si on a déjà un SAST ?',
    replies: [
      { text: 'Le SAST lit des motifs, le pentest lit la logique métier et l’autorisation.', points: 1, trust: 0, risk: 0, why: 'L’argument est juste et n’engage à rien : il explique une différence sans dire ce qu’on achète. Un CTO qui arbitre un budget a besoin d’un périmètre et d’une date, pas d’une distinction de catégorie.' },
      { text: 'Boîte grise sur l’isolation entre tenants, avant l’arrivée du grand compte.', points: 2, trust: 1, risk: 1, why: 'Un périmètre, une classe de défaut qu’aucun SAST ne trouve, et une échéance qui vient du métier et non de la sécurité. C’est une dépense qu’on peut décider dans la réunion où elle est proposée.' },
      { text: 'La certification du grand compte l’exige, on n’a pas vraiment le choix.', points: 0, trust: 0, risk: 0, why: 'C’est peut-être vrai, et c’est le plus court chemin vers un pentest de complaisance : le moins cher, le plus étroit, celui qui coche la case. Le jour où l’exigence tombe, la ligne budgétaire tombe avec elle.' },
    ],
  },
  {
    who: 'Sacha', role: 'Lead dev API', context: 'Revue de conception d’un nouveau service de calcul de TVA.',
    objection: 'C’est une API interne, pas besoin d’authentification.',
    replies: [
      { text: 'Mets une clé d’API en variable d’environnement, avec rotation trimestrielle.', points: 1, trust: 0, risk: 1, why: 'Une authentification existe, donc c’est mieux que rien. Mais ce secret partagé finira dans un fichier de configuration, un journal et trois dépôts, et la rotation trimestrielle sera le premier rituel abandonné.' },
      { text: 'Le template fait l’authentification IAM en deux lignes, sans secret.', points: 2, trust: 1, risk: 2, why: 'Tu déplaces la question du « faut-il » vers le « combien ça coûte », et la réponse est : rien. Une SSRF ou un runner compromis atteint le réseau interne ; là, il lui faudrait en plus un rôle.' },
      { text: 'D’accord si on met une règle réseau qui limite l’accès au subnet applicatif.', points: 0, trust: 1, risk: 0, why: 'La règle réseau a l’air d’un contrôle et n’en est pas un ici : tout ce qui appelle ce service est déjà dans ce subnet, y compris le service qu’on compromettra. C’est le reflux de confiance, avec une couche de vocabulaire.' },
    ],
  },
  {
    who: 'Direction générale', role: 'Comité de direction', context: 'Première restitution trimestrielle.',
    objection: 'Combien de vulnérabilités avons-nous ? Je veux zéro.',
    replies: [
      { text: '412 ouvertes, dont 43 critiques, et la tendance est à la baisse ce trimestre.', points: 0, trust: 0, risk: 0, why: 'Le chiffre est exact et ne veut rien dire : il mélange une dépendance de test et une BOLA exposée. Tu viens d’installer un indicateur que la direction suivra, et qu’on fera baisser en reclassant des tickets.' },
      { text: 'Les critiques exposées sont corrigées en 72 h, contre 6 jours il y a un an.', points: 2, trust: 1, risk: 1, why: 'Un délai sur ce qui est réellement atteignable, et une tendance : c’est une mesure de capacité, pas un stock. Elle se dégrade honnêtement quand ça va mal, ce qu’un décompte de tickets ne fait jamais.' },
      { text: 'Zéro est hors d’atteinte, mais on peut viser zéro critique sous six mois.', points: 0, trust: 1, risk: -1, why: 'Tu viens de t’engager sur un objectif que tu ne contrôles pas : une CVE critique dans une dépendance peut tomber demain. Dans six mois, tu auras le choix entre l’échec et la requalification.' },
    ],
  },
  {
    who: 'Camille', role: 'Développeuse front', context: 'Le pentest a relevé une XSS dans le champ « notes » du profil.',
    objection: 'C’est du self-XSS, seul l’utilisateur peut se l’infliger. On ne corrige pas.',
    replies: [
      { text: 'Toute XSS se corrige : je monte le ticket en bloquant pour la prochaine PR.', points: 0, trust: -1, risk: 1, why: 'Le correctif sera peut-être fait, mais tu viens d’annoncer que ta sévérité ne dépend pas du contexte. La prochaine fois que tu diras « celle-ci est vraiment grave », plus personne ne fera la différence.' },
      { text: 'La mise à jour du profil n’a pas de CSRF : à deux, ça devient une XSS stockée.', points: 2, trust: 1, risk: 2, why: 'Camille a raison sur son finding et tort sur le périmètre : tu ne contestes pas son analyse, tu ajoutes le maillon qui manquait. Et c’est vérifiable en une minute, donc ça ne se discute pas.' },
      { text: 'On la garde ouverte en faible, et on la reverra au prochain audit annuel.', points: 0, trust: 1, risk: -1, why: 'Le ticket reste ouvert, ce qui donne le sentiment que rien n’est perdu. En pratique, l’audit annuel relit le même champ et reproduit la même conclusion : le maillon reste disponible pour la prochaine chaîne.' },
    ],
  },
  {
    who: 'Alix', role: 'PO facturation', context: 'Proposition de lancer des Security Champions.',
    objection: '15 % du temps d’un développeur ? On n’a pas le budget.',
    replies: [
      { text: 'Un trimestre, une équipe, un objectif : zéro BOLA dans ses PR. On voit après.', points: 2, trust: 1, risk: 1, why: 'Petit, mesurable, réversible — trois raisons de dire oui, et aucune de s’engager au-delà. Si le chiffre tombe, le programme se vend tout seul au trimestre suivant ; sinon, tu as appris quelque chose à bas coût.' },
      { text: 'Je relis moi-même les PR sensibles, on verra le budget au prochain exercice.', points: 1, trust: 1, risk: 0, why: 'Le risque est couvert à court terme, et tu viens de créer une dépendance à ta personne. Au prochain exercice, la question ne sera plus « faut-il des champions » mais « pourquoi, puisque tu le fais ».' },
      { text: 'Commençons par 5 % du temps, sur les quatre équipes, dès le mois prochain.', points: 0, trust: 0, risk: 0, why: 'Étalé sur quatre équipes, 5 % ne produit aucun effet mesurable nulle part — et l’échec servira d’argument contre le programme. Mieux vaut un pilote profond qu’une couche mince partout.' },
    ],
  },
  {
    who: 'Morgane', role: 'SRE d’astreinte', context: 'Mardi 2 h du matin. L’API renvoie des 500 en rafale.',
    objection: 'Je coupe le WAF, je suis sûr que c’est lui qui casse les requêtes.',
    replies: [
      { text: 'Passe-le en détection seule sur la route concernée, garde-le ailleurs.', points: 2, trust: 1, risk: 1, why: 'Tu obtiens l’information de Morgane — est-ce le WAF ? — en changeant une seule variable, et le reste de la surface garde sa protection. C’est aussi rapide que la coupure totale, avec un périmètre.' },
      { text: 'Coupe-le, on le remet dans la journée avec une analyse des règles en cause.', points: 0, trust: 1, risk: -1, why: 'À 2 h du matin, l’incident prime — mais tu enlèves la protection de toutes les routes pour tester une hypothèse sur une seule. Et l’analyse promise arrive après la nuit blanche, c’est-à-dire rarement.' },
      { text: 'Vérifions d’abord les journaux du WAF avant de toucher à la configuration.', points: 1, trust: -1, risk: 1, why: 'Méthodologiquement irréprochable, et c’est une réponse de journée en pleine nuit d’astreinte. Si les journaux prennent vingt minutes à lire, Morgane coupera le WAF sans te le dire.' },
    ],
  },
  {
    who: 'Rémi', role: 'Acheteur IT', context: 'Renouvellement d’un prestataire qui héberge les exports comptables.',
    objection: 'Ils ont ISO 27001, on n’a pas besoin de les auditer nous-mêmes.',
    replies: [
      { text: 'Demande-leur le périmètre de la déclaration d’applicabilité, c’est suffisant.', points: 1, trust: 0, risk: 1, why: 'Bonne question — le périmètre est souvent l’endroit où le certificat cesse de nous concerner. Mais tu t’arrêtes au document : il te dira ce qui est couvert, jamais comment nos données y circulent.' },
      { text: 'Le certificat couvre leur SMSI, pas notre flux. Que devient l’export chez eux ?', points: 2, trust: 1, risk: 2, why: 'Tu ne contestes pas la valeur du certificat, tu la situes : il atteste d’un système de management, pas d’une architecture. La question qui suit — chiffrement, durée de conservation, sous-traitants — se pose à tout le monde.' },
      { text: 'Ajoutons une clause d’audit au contrat et un questionnaire annuel de 80 items.', points: 0, trust: -1, risk: 0, why: 'Une clause d’audit qu’on n’exercera jamais et un questionnaire déclaratif : beaucoup de friction pour l’achat, aucune information nouvelle. C’est le rituel qui donne le plus mauvais rapport effort/risque.' },
    ],
  },
  {
    who: 'Sacha', role: 'Lead dev API', context: 'Le SCA remonte une CVE critique dans une bibliothèque de parsing XML.',
    objection: 'On ne parse jamais de XML venant de l’extérieur. Je passe en « non exploitable ».',
    replies: [
      { text: 'Vérifions ensemble : le connecteur Chorus Pro reçoit des factures en XML.', points: 2, trust: 1, risk: 2, why: 'Tu traites sa conclusion comme une hypothèse testable plutôt que comme une erreur, et le contre-exemple est concret. Si le connecteur ne l’utilisait pas, sa qualification tiendrait — et tu l’aurais appris aussi.' },
      { text: 'Marque-la non exploitable avec un VEX, et on revalidera à chaque mise à jour.', points: 1, trust: 1, risk: 0, why: 'Le VEX est le bon format pour porter cette affirmation, et le revalider est la bonne discipline. Mais tu enregistres l’affirmation avant de l’avoir vérifiée une première fois : le VEX propagera une erreur avec autorité.' },
      { text: 'Mets-la à jour quand même, c’est trente minutes et ça ferme la discussion.', points: 0, trust: 0, risk: 1, why: 'Ça marche cette fois, et ça installe la règle « on patche tout » : à la centième CVE, l’équipe fera du bruit et arrêtera de qualifier quoi que ce soit. La qualification est précisément ce qu’on veut leur apprendre à faire.' },
    ],
  },
  {
    who: 'Inès', role: 'DPO', context: 'Revue d’une nouvelle fonctionnalité de relances automatiques.',
    objection: 'Vous journalisez les adresses e-mail des destinataires ? C’est une donnée personnelle.',
    replies: [
      { text: 'Tu as raison, on retire les e-mails des journaux applicatifs dès cette semaine.', points: 0, trust: 1, risk: -1, why: 'Inès est satisfaite et l’équipe sécurité vient de perdre le seul champ qui relie une relance à son destinataire. Le jour d’un incident sur les relances, plus personne ne saura qui a reçu quoi.' },
      { text: 'Pseudonymisons : un identifiant stable, la table de correspondance ailleurs.', points: 2, trust: 1, risk: 2, why: 'Les deux besoins tiennent ensemble : l’investigation garde un fil à suivre, et le journal cesse d’être un fichier de données personnelles. C’est la réponse qui évite d’avoir à choisir entre conformité et traçabilité.' },
      { text: 'Ils sont chiffrés au repos et purgés à 30 jours, donc le traitement est couvert.', points: 0, trust: 0, risk: 0, why: 'Chiffrement et rétention sont réels et répondent à côté : la question d’Inès porte sur la présence de la donnée, pas sur sa protection. Tu opposes un argument technique à une objection juridique, et tu perdras.' },
    ],
  },
  {
    who: 'Charlie', role: 'Lead front', context: 'Mise en place de l’authentification à deux facteurs sur l’espace client.',
    objection: 'Le SMS suffit largement, nos clients n’installeront jamais une application.',
    replies: [
      { text: 'Le SMS se détourne par portabilité, il faut du TOTP ou rien du tout.', points: 0, trust: -1, risk: 0, why: 'La menace est réelle et le raisonnement s’arrête trop tôt : le SIM swap vise des comptes à forte valeur, pas la PME qui émet douze factures par mois. En exigeant tout, tu obtiendras zéro facteur au lieu d’un.' },
      { text: 'SMS par défaut, TOTP proposé, obligatoire pour les administrateurs.', points: 2, trust: 1, risk: 2, why: 'Charlie a raison sur l’adoption, et tu gardes le facteur fort là où le SIM swap est rentable. Les deux positions étaient vraies pour des populations différentes : la réponse n’est pas un compromis, c’est une segmentation.' },
      { text: 'Partons sur le SMS, on migrera vers TOTP quand l’usage sera bien installé.', points: 1, trust: 1, risk: 0, why: 'Le facteur existe, c’est déjà beaucoup. Mais une migration d’authentification une fois les habitudes prises coûte bien plus cher que de proposer les deux dès le départ — et elle ne sera jamais prioritaire.' },
    ],
  },
  {
    who: 'Dominique', role: 'CTO', context: 'Après un incident : un jeton d’API d’un client a fuité dans un dépôt public.',
    objection: 'Il faut interdire GitHub public à tous les développeurs.',
    replies: [
      { text: 'Le secret scanning côté éditeur révoque ces jetons en quelques minutes.', points: 2, trust: 1, risk: 2, why: 'Le jeton a fuité par un client, pas par l’équipe : l’interdiction interne n’aurait rien empêché. Le partenariat de révocation traite tous les cas, y compris ceux qu’on ne contrôle pas, et ne coûte rien à personne.' },
      { text: 'Ajoutons plutôt un hook de pré-commit et une analyse de l’historique des dépôts.', points: 1, trust: 1, risk: 1, why: 'Utile, et à côté de cet incident : les deux mesures couvrent nos dépôts alors que la fuite vient de ceux d’un client. Tu réponds bien à la peur du CTO, pas au chemin qu’a réellement pris le secret.' },
      { text: 'Interdisons-le pour six mois, le temps de mettre en place la détection.', points: 0, trust: 0, risk: -1, why: 'Six mois d’interdiction pour un incident dont l’origine est externe, et les développeurs contourneront dès la première contribution open source nécessaire. Tu paies un coût politique élevé pour un risque que tu n’as pas réduit.' },
    ],
  },
  {
    who: 'Nadia', role: 'Responsable support', context: 'Le support demande un accès pour aider les clients bloqués.',
    objection: 'On a besoin de se connecter en tant que client, sinon on ne peut rien diagnostiquer.',
    replies: [
      { text: 'Impersonation avec consentement, durée limitée, et tout est journalisé.', points: 2, trust: 1, risk: 2, why: 'Le besoin est réel et ne disparaîtra pas : le refuser produirait un partage de mots de passe par téléphone. Le consentement et la trace transforment un accès invisible en acte nominatif, ce qui protège aussi le support.' },
      { text: 'Créons un rôle support en lecture seule sur l’ensemble des comptes clients.', points: 1, trust: 1, risk: 0, why: 'La lecture seule limite les dégâts, et un accès permanent à tous les comptes est une surface bien plus large qu’une impersonation ponctuelle. Un compte support compromis lit alors la base entière.' },
      { text: 'Que le client partage son écran, c’est suffisant dans la plupart des cas.', points: 0, trust: -1, risk: 0, why: 'Ça marche pour l’affichage, jamais pour un état côté serveur, et le support le sait. Tu viens de proposer une solution que le terrain jugera irréaliste : la prochaine demande passera directement par la DSI.' },
    ],
  },
  {
    who: 'Alix', role: 'PO facturation', context: 'Le rapport de pentest annuel vient d’arriver : 30 findings.',
    objection: 'Trente tickets dans mon backlog, ce n’est pas tenable. Donne-moi les trois vrais.',
    replies: [
      { text: 'Les trois critiques d’abord ; je te repasse le reste au prochain trimestre.', points: 1, trust: 1, risk: 1, why: 'La priorisation par sévérité est défendable et laisse passer ce qui coûte le moins cher à corriger : les défauts faibles mais systémiques, ceux qu’un template corrige en une fois pour toutes les équipes.' },
      { text: 'Trois classes plutôt que trois findings : autorisation, secrets, parsing.', points: 2, trust: 1, risk: 2, why: 'Vingt-deux des trente findings tombent dans trois classes, donc trois corrections de fond valent mieux que trente correctifs ponctuels. Et Alix obtient ce qu’elle demandait : trois lignes dans son backlog.' },
      { text: 'Je qualifie les trente avec toi en atelier, puis on décide ensemble du périmètre.', points: 0, trust: 0, risk: 0, why: 'La méthode est juste et le coût est le problème : un atelier de trente findings mobilise une demi-journée du produit pour aboutir à la même conclusion. Tu peux faire ce tri seul et n’apporter que le résultat.' },
    ],
  },
];

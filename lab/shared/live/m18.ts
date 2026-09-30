// M18 · Surveillance, logging & SIEM — challenges jouables.
//
// Challenges « artifact » ✎ : l'apprenant ne corrige pas un fichier du dépôt,
// il en **produit** un dans `workspace/`, et c'est ce fichier qui est jugé. Le
// chemin annoncé par `file` est relatif à `workspace/`.
//
// Aucun cluster Elastic n'est nécessaire. Le lab embarque des corpus
// d'événements étiquetés au format ECS (`fixtures/m18/`) et un moteur de
// requête (`server/audit/detect.ts`) : les règles écrites sont **exécutées**,
// et notées en précision et en rappel. La syntaxe est celle du lab, pas celle
// d'Elastic — et c'est assumé : le geste travaillé est le réglage
// précision/rappel, pas la syntaxe d'un produit. Le langage tient en une page,
// dans `fixtures/m18/README.md`.
//
// Les vérifications correspondantes sont dans server/audit/m18.ts.

import type { ExerciseDef } from '../exercises.ts';

export const m18: ExerciseDef[] = [
  // ── Journaliser ───────────────────────────────────────────────────────────
  {
    id: 'logging-vocabulary', module: 'm18', title: 'Le vocabulaire imposé',
    status: 'live', kind: 'artifact', level: 1, csslp: ['D5', 'D7'], cwe: 'CWE-778',
    brief: 'Les journaux racontent en texte libre : « échec de connexion pour untel », « accès refusé ». Aucune règle ne peut s’appuyer dessus. Huit scénarios sont dans `fixtures/m18/vocabulary/scenarios.json`, avec le contexte dont le code dispose au moment d’écrire la ligne.',
    goal: 'Écrire le catalogue qui donne à chaque scénario son identifiant d’événement normalisé et les champs obligatoires de sa ligne.',
    file: 'logging/vocabulary.yaml',
    lessons: ['m18/l01', 'm07/l02'],
    hints: [
      'Les identifiants ne s’inventent pas : ils se choisissent dans le vocabulaire de journalisation d’OWASP, publié dans `fixtures/m18/vocabulary/owasp-events.txt`.',
      'Le format attendu est une liste sous `events`, chaque entrée portant `scenario`, `event` et `required_fields`. Le socle obligatoire est le même pour tous : `@timestamp`, `event.action`, `event.outcome`, `user.name`, `source.ip`.',
      'Deux pièges de nommage : une lecture d’export n’est pas un `authz_admin` mais un `sensitive_read`, et une facture d’un autre tenant demandée n’est pas un `authz_fail` mais un `malicious_direct_reference` — le second dit que c’était délibéré.',
    ],
    fix: 'Un journal est une interface : il a un schéma, des consommateurs, et il se casse comme une API. Le vocabulaire d’OWASP existe précisément pour que la règle écrite sur une application marche sur la suivante. Ce qui n’est pas noté : le niveau de gravité que vous attribuez, et les champs de contexte au-delà du socle.',
  },
  {
    id: 'never-log', module: 'm18', title: 'Ce qu’il ne faut jamais journaliser',
    status: 'live', kind: 'artifact', level: 1, csslp: ['D3', 'D7'], cwe: 'CWE-532',
    brief: 'Mots de passe, jetons, IBAN et numéros de carte se retrouvent dans les lignes de journal, parce qu’on journalise le corps des requêtes. Le corpus `fixtures/m18/redaction/` en est plein.',
    goal: 'Écrire les règles de caviardage : plus aucun secret dans le corpus, et la détection de référence lève toujours ses douze vrais positifs.',
    file: 'logging/redaction.yaml',
    lessons: ['m18/l01', 'm07/l06'],
    hints: [
      'Deux verbes suffisent : `drop` supprime un champ entier, `mask` remplace sa valeur en n’en gardant que les derniers caractères (`keep`, entre 0 et 4).',
      'Cherchez d’où viennent les secrets : un seul champ en concentre la plus grande partie, et `fixtures/m18/redaction/secrets.json` liste les motifs que la vérification traque.',
      'Le harnais vérifie les deux moitiés. Tout supprimer est facile — et la détection de bourrage d’identifiants tombe alors de douze à zéro. `source.ip`, `user.name`, `event.action` et `@timestamp` doivent survivre.',
    ],
    fix: 'La formulation canonique du vocabulaire OWASP est la bonne : journaliser l’identifiant de règle et le **nom** du paramètre, jamais sa valeur. Un journal est une copie de la donnée : il hérite de sa classification, de sa durée de conservation et de son périmètre d’accès.',
  },
  {
    id: 'ecs-fields', module: 'm18', title: 'Les champs qui manquent à la corrélation',
    status: 'live', kind: 'artifact', level: 2, csslp: ['D7'], cwe: 'CWE-778',
    brief: 'Une règle de détection fournie (`fixtures/m18/ecs-fields/rule.yaml`) a besoin de l’adresse source, de l’utilisateur, du résultat et de la méthode. L’application émet bien ces informations, mais sous ses propres noms : `ip`, `who`, `ok`, `verb`.',
    goal: 'Écrire la correspondance qui normalise le journal brut, pour que la règle, inchangée, se mette à lever ses douze alertes.',
    file: 'logging/field-mapping.yaml',
    lessons: ['m18/l02', 'm18/l01'],
    hints: [
      'Le format est une liste sous `map`, chaque entrée portant `to` (le champ normalisé) et `from` (le champ brut). `transform: uppercase` et une table `values:` traitent les valeurs qui ne se recopient pas telles quelles.',
      'Le champ le plus facile à oublier est celui sans lequel la fenêtre glissante ne peut même pas s’ouvrir.',
      'La table `values` sert deux fois : pour traduire `login_failed` vers le vocabulaire OWASP, et pour traduire le booléen `ok` vers l’énumération `success`/`failure`. Poser ces valeurs en dur avec `const` ferait passer tout le trafic pour des échecs — et la règle lèverait sur la vague de connexions du matin.',
    ],
    fix: 'La règle passe de zéro à douze alertes sans qu’une ligne de règle ne bouge : une détection est un contrat sur le schéma des journaux. C’est pour ça que le schéma vient avant les règles, et pas l’inverse — et pour ça qu’un renommage de champ est un changement cassant.',
  },
  {
    id: 'ecs-lint', module: 'm18', title: 'Le lint sémantique du schéma',
    status: 'live', kind: 'artifact', level: 2, csslp: ['D7'], cwe: 'CWE-1059',
    brief: 'Les vingt-quatre lignes de `fixtures/m18/ecs-lint/events.ndjson` portent les bons noms de champs, mais neuf d’entre elles ont des valeurs hors énumération ou des combinaisons incohérentes.',
    goal: 'Produire le corpus réparé : énumérations respectées, contraintes croisées tenues, et les vingt-quatre lignes toujours là.',
    file: 'logging/events.ndjson',
    lessons: ['m18/l02', 'm13/l01'],
    hints: [
      'Copiez le fichier de fixtures dans `workspace/logging/events.ndjson` et réparez-le sur place. Les valeurs valides de `event.kind`, `event.category`, `event.type` et `event.outcome` sont celles d’ECS.',
      'Quatre contraintes croisées : une catégorie `authentication` impose un `event.type` parmi start, end et info, et un `event.outcome` renseigné ; une catégorie `web` impose le chemin, la méthode et le code de statut ; un `event.kind: alert` impose `rule.name` ; et un statut supérieur ou égal à 400 interdit `outcome: success`.',
      'Supprimer les lignes fautives ne les corrige pas : le harnais exige les mêmes identifiants d’événements, et le même `@timestamp` et le même `message` pour chacun. On répare la valeur, pas le fait.',
    ],
    fix: 'Une catégorie d’authentification impose un type dans une liste fermée et un résultat renseigné. Ces contraintes croisées sont ce qui permet aux requêtes d’être écrites une fois et de marcher partout — un champ juste dans un schéma faux ne sert à rien. C’est aussi ce que valide le lint du dépôt de règles d’Elastic, à l’ingestion.',
  },
  {
    id: 'logging-inventory', module: 'm18', title: 'L’inventaire de journalisation',
    status: 'live', kind: 'artifact', level: 2, csslp: ['D3', 'D7'], cwe: 'CWE-778',
    brief: 'Personne ne sait ce que l’application journalise. Les exigences demandent un inventaire documenté. Ce que la suite de bout en bout fait réellement émettre est dans `fixtures/m18/inventory/emitted.ndjson`.',
    goal: 'Documenter l’inventaire, et le faire coïncider exactement avec ce que l’application émet.',
    file: 'program/logging-inventory.yaml',
    lessons: ['m18/l01', 'm07/l04'],
    hints: [
      'Le format est une liste sous `events`, chaque entrée portant au moins `event` (l’identifiant émis) et `fields` (les champs de la ligne).',
      'Le harnais échoue dans les deux sens : un événement émis mais non documenté, comme un événement documenté mais jamais émis.',
      'Tous les événements ne portent pas les mêmes champs, et recopier un gabarit ne passera pas : `fields` doit lister ce qui est présent dans **toutes** les instances de l’événement. Quatre événements font exception — regardez le verrouillage de compte, la session expirée, le dépassement de débit et la validation d’entrée.',
    ],
    fix: 'C’est l’exigence de journalisation d’ASVS, rendue vérifiable. Un inventaire qu’on ne confronte pas à la réalité vieillit en trois sprints. Ce qui n’est pas noté : la durée de conservation et la destination que vous déclarez — elles relèvent de la politique de l’entreprise, pas du code.',
  },

  // ── Écrire des règles ─────────────────────────────────────────────────────
  {
    id: 'rule-credential-stuffing', module: 'm18', title: 'Écrire la règle : bourrage d’identifiants',
    status: 'live', kind: 'artifact', level: 2, csslp: ['D7'], cwe: 'CWE-1059',
    brief: 'Le corpus `fixtures/m18/cs/` contient douze vrais positifs et quarante leurres : deux tests de charge, trois passerelles SSO, dix applications mobiles qui réessaient, quinze utilisateurs maladroits, cinq mots de passe oubliés, trois sondes de supervision et deux suites d’intégration.',
    goal: 'Écrire la requête qui attrape exactement les douze, et aucun des quarante.',
    file: 'detections/credential-stuffing.yaml',
    lessons: ['m18/l03', 'm18/l04'],
    hints: [
      'La syntaxe est celle du lab, décrite dans `fixtures/m18/README.md` : `where`, `window`, `group_by`, `having`. Commencez par filtrer les échecs et regrouper par source.',
      'Chaque famille de leurres casse une règle naïve précise. Le test de charge et l’application mobile produisent beaucoup d’échecs sur **un seul** compte. La passerelle SSO en produit beaucoup sur des comptes distincts, mais étalés sur trois heures. La suite d’intégration en produit quinze sur quinze comptes en huit minutes.',
      'Il faut donc trois décisions : une fenêtre (la passerelle sort), un nombre d’échecs (la suite d’intégration et l’utilisateur maladroit sortent), et un nombre de **comptes distincts** (le test de charge et le mobile sortent).',
    ],
    fix: 'Les leurres sont l’exercice : une règle qui attrape tout est facile, une règle qui ne lève jamais l’est aussi. C’est entre les deux que vit le detection engineering. La règle est rejouée sur un second corpus tiré des mêmes générateurs avec une autre graine — énumérer les douze adresses du premier n’y trouve rien.',
  },
  {
    id: 'rule-threshold', module: 'm18', title: 'Régler le seuil',
    status: 'live', kind: 'artifact', level: 2, csslp: ['D7'], cwe: 'CWE-1059',
    brief: 'Le corpus `fixtures/m18/cs-hard/` ajoute trois attaques discrètes, juste sous le seuil évident, et un test d’intrusion autorisé qui se comporte exactement comme une attaque. La séparation parfaite n’existe pas. La règle est écrite (`cs-hard/skeleton.yaml`) : seuls la fenêtre et les deux seuils sont à toi.',
    goal: 'Trouver le réglage qui tient les cibles annoncées : 90 % de précision et 85 % de rappel.',
    file: 'detections/thresholds.yaml',
    lessons: ['m18/l04', 'm18/l06'],
    hints: [
      'Le livrable ne contient que trois valeurs : `window`, `thresholds.failures` et `thresholds.distinct_users`. Le harnais compose la règle autour.',
      'Le harnais affiche la précision et le rappel obtenus, et nomme les cas ratés et les cas attrapés à tort : chaque essai vous dit dans quel sens bouger.',
      'Le test d’intrusion autorisé restera un faux positif quoi que vous fassiez — c’est voulu. Trop bas, la suite d’intégration entre dans le filet ; trop haut, les attaques discrètes en sortent. La zone qui tient les deux cibles est large d’une demi-douzaine d’unités.',
    ],
    fix: 'Le harnais calcule et affiche les deux métriques, et n’accepte la règle qu’au-dessus des deux cibles. Régler un seuil est la partie du métier qu’on n’enseigne jamais, parce qu’elle demande un corpus — le voici. Et accepter un faux positif connu et documenté vaut mieux que fermer les yeux sur trois attaques.',
  },
  {
    id: 'rule-temporal-spray', module: 'm18', title: 'La corrélation temporelle',
    status: 'live', kind: 'artifact', level: 3, csslp: ['D7'], cwe: 'CWE-1059',
    brief: 'Un seul échec par compte, sur près de deux cents comptes, depuis une même adresse : aucune règle par compte ne le verra jamais. Le corpus `fixtures/m18/spray/` contient six campagnes et trente-trois leurres, dont un test de charge qui produit trois cents échecs sur un seul compte.',
    goal: 'Écrire la corrélation qui compte les comptes distincts par source et par fenêtre, et ignore les échecs isolés.',
    file: 'detections/password-spray.yaml',
    lessons: ['m18/l03', 'm10/l02'],
    hints: [
      'Compter les échecs ne peut pas marcher : le test de charge en produit plus qu’une campagne entière. C’est la grandeur mesurée qu’il faut changer, pas le seuil.',
      'La métrique `distinct` prend un `field` : le nombre de valeurs distinctes du champ dans la fenêtre.',
      'Regroupez par `source.ip`, filtrez les échecs, et exigez plusieurs dizaines de `user.name` distincts sur une fenêtre d’une demi-heure. Les intégrations cassées ne touchent que huit comptes de service.',
    ],
    fix: 'Le pulvérisage est conçu pour passer sous les seuils par compte : il faut changer d’axe d’agrégation. C’est le cas d’école qui justifie les langages de corrélation plutôt que la simple recherche — et la raison pour laquelle une limitation de débit par compte, seule, ne protège de rien.',
  },
  {
    id: 'honeytoken', module: 'm18', title: 'Le piège à miel',
    status: 'live', kind: 'artifact', level: 2, csslp: ['D7'], cwe: 'CWE-1059',
    brief: 'Trois leurres n’existent que dans le HTML et le bundle : une route d’export total, une facture qui n’a jamais été émise, et une clé d’API jamais distribuée. Aucun usage légitime ne les atteint. Le corpus `fixtures/m18/honeytoken/` contient quarante parcours légitimes qui passent tout autour.',
    goal: 'Faire lever une alerte à tout accès à l’un des trois leurres, avec exactement zéro faux positif sur le corpus légitime complet.',
    file: 'detections/honeytoken.yaml',
    lessons: ['m18/l05', 'm10/l07'],
    hints: [
      'Un honeytoken se détecte à l’événement : pas de fenêtre, pas d’agrégat, pas de seuil. Un seul accès suffit, et une règle sans `having` lève sur chaque événement retenu.',
      'Trois leurres, trois champs différents. Le groupe `any_of` permet de les réunir dans une seule règle.',
      'Le corpus légitime contient exprès les quasi-jumeaux : `/api/admin/export` et `/api/admin/export-status` sont de vraies routes, `INV-9998` est une vraie facture, et une clé légitime partage le préfixe de la clé leurre. Un `starts_with` fait trente-neuf faux positifs ; il faut l’égalité stricte.',
    ],
    fix: 'Un honeytoken a le meilleur rapport signal sur bruit du métier : il n’a aucune raison d’être touché. C’est aussi ce qui détecte un attaquant **déjà à l’intérieur**, que les règles de périmètre laissent passer — et ce qui rend la détection indépendante de la sophistication de l’attaque.',
  },
  {
    id: 'detect-prompt-injection', module: 'm18', title: 'Détecter l’injection indirecte',
    status: 'live', kind: 'artifact', level: 3, csslp: ['D4', 'D7'], cwe: 'CWE-1059',
    brief: 'L’assistant appelle des outils. Le journal porte désormais `novafact.assistant.origin` — l’origine de l’instruction qui a déclenché l’appel. Le corpus `fixtures/m18/assistant/` contient six appels d’origine document visant l’extérieur, et trente usages légitimes.',
    goal: 'Écrire la règle qui attrape les six, sans lever sur les trente.',
    file: 'detections/prompt-injection.yaml',
    lessons: ['m18/l05', 'm19/l05'],
    hints: [
      'Regardez les champs sous `novafact.assistant` : l’outil appelé, l’origine de l’instruction, et la nature de la cible.',
      'Ni l’origine ni la destination ne suffisent seules. Douze envois de facture vers un domaine client sont demandés par l’utilisateur ; huit résumés sont dictés par un document mais restent internes.',
      'C’est la conjonction qui décrit l’abus : une instruction venue d’une **donnée**, qui déclenche un effet vers l’**extérieur**.',
    ],
    fix: 'Le vocabulaire OWASP porte désormais des événements dédiés — injection de prompt, empoisonnement d’outil, épuisement de ressource — qui font le pont entre les deux domaines. L’origine de l’instruction est le champ qui rend l’injection indirecte détectable, et l’instrumenter coûte trois lignes dans la couche d’outils.',
  },
  {
    id: 'rule-silent-after-fix', module: 'm18', title: 'La règle qui se tait après le correctif',
    status: 'live', kind: 'artifact', level: 2, csslp: ['D6', 'D7'], cwe: 'CWE-1059',
    brief: 'Le défaut d’autorisation a été corrigé : le sondage d’identifiants d’un autre tenant reçoit maintenant un 403 au lieu d’un 200. La règle qui l’attrapait (`fixtures/m18/silent-before/rule-origine.yaml`) lève encore sur le corpus d’après correctif, et personne ne sait pourquoi.',
    goal: 'Réécrire la règle : muette sur le corpus d’après correctif, et toujours levée sur celui d’avant.',
    file: 'detections/idor-probing.yaml',
    lessons: ['m18/l06', 'm13/l02'],
    hints: [
      'Comparez un événement de sondage dans `silent-before/` et le même dans `silent-after/`. Le trafic n’a pas changé ; le résultat, si.',
      'La règle d’origine compte les factures d’un autre tenant demandées par un même compte. Il lui manque une condition sur ce qui s’est **passé** ensuite.',
      'Une ligne suffit. Mais la supprimer ou la vider échoue aussi : le harnais exige qu’elle lève toujours ses trois vrais positifs sur le corpus d’avant correctif — c’est sa valeur de non-régression.',
    ],
    fix: 'C’est le pendant détection du contrat de `npm run verify` : le contrôle refuse **et** la fonctionnalité marche encore. Une règle qu’on n’a pas retirée après correction est une alerte que l’équipe apprendra à ignorer — et avec elle, les suivantes. Une détection a un cycle de vie, avec une date de revue.',
  },

  // ── Outiller les règles ───────────────────────────────────────────────────
  {
    id: 'rule-fixtures', module: 'm18', title: 'Deux fixtures par règle',
    status: 'live', kind: 'artifact', level: 1, csslp: ['D6', 'D7'], cwe: 'CWE-1059',
    brief: 'Cinq règles de la bibliothèque (`fixtures/m18/rules/`) sont livrées sans test. Personne ne sait si elles lèvent encore après un changement de schéma.',
    goal: 'Accompagner chacune d’un événement qu’elle doit attraper et d’un quasi-jumeau qu’elle ne doit pas attraper.',
    file: 'detections/fixtures/',
    lessons: ['m18/l04', 'm13/l02'],
    hints: [
      'Un fichier par règle, nommé comme elle : `detections/fixtures/honeytoken-access.yaml`, `admin-role-change.yaml`, `prompt-injection-external.yaml`, `unsupported-http-method.yaml`, `mass-export.yaml`. Chacun porte une liste `positive` et une liste `negative` d’événements ECS.',
      'Les corpus de `fixtures/m18/` fournissent des événements réalistes à recopier. Chaque événement doit avoir un `@timestamp` lisible et un `event.action`.',
      'Le quasi-jumeau doit être **quasi** : le harnais refuse une fixture négative qui diffère de la positive par plus de deux champs. Un événement complètement différent ne prouve rien — il faut celui qui passe à un cheveu du seuil ou de l’énumération.',
    ],
    fix: 'La CI refuse une règle sans ses deux fixtures, et refuse une règle qui attrape sa propre fixture négative. C’est exactement le contrat du reste du lab — le contrôle refuse, et le légitime passe — appliqué à la détection. C’est aussi ce qui permet de changer une règle sans peur six mois plus tard.',
  },
  {
    id: 'rule-lint', module: 'm18', title: 'Le lint de règle',
    status: 'live', kind: 'artifact', level: 2, csslp: ['D6', 'D7'], cwe: 'CWE-1059',
    brief: 'Douze fichiers de règles dans `fixtures/m18/rules/`, cinq cassés : score de risque hors de la plage de sa sévérité, étiquette dupliquée, note sans section de triage, fenêtre d’historique absente.',
    goal: 'Produire la bibliothèque corrigée, et faire passer le lint à zéro échec.',
    file: 'detections/rules/',
    lessons: ['m18/l04', 'm13/l01'],
    hints: [
      'Copiez les douze fichiers dans `workspace/detections/rules/` en gardant leurs noms, puis corrigez-les. Le message du harnais nomme la règle et le défaut.',
      'Les plages de score sont celles d’Elastic : low 0–21, medium 22–47, high 48–73, critical 74–99. Une règle high ou critical doit porter un guide d’investigation avec une section « ## Triage ». Et `from` (la fenêtre d’historique) doit dépasser `interval`, sinon un événement passe entre deux exécutions.',
      'Les cinq défauts sont **dans les métadonnées**. Le harnais vérifie que la requête n’a pas bougé : une règle « corrigée » qui ne cherche plus rien ne corrige rien.',
    ],
    fix: 'Les assertions sont celles du dépôt de règles d’Elastic, réimplémentées. Une règle est du code : elle se lint, elle se teste, elle se revoit. C’est ce qui fait la différence entre une bibliothèque de règles et un dossier de requêtes.',
  },
  {
    id: 'atomic-test', module: 'm18', title: 'L’atomique qui valide la règle',
    status: 'live', kind: 'artifact', level: 2, csslp: ['D6', 'D7'], cwe: 'CWE-1059',
    brief: 'La règle `fixtures/m18/atomic/rule.yaml` a été écrite d’après une hypothèse. Personne n’a vérifié qu’une vraie attaque la déclenche. Le lab fournit un environnement simulé — un annuaire de comptes et une horloge — sur lequel un test d’attaque s’exécute.',
    goal: 'Écrire le test en trois temps — mise en place, détonation, retour arrière — et prouver le cycle complet.',
    file: 'detections/atomics/credential-stuffing.yaml',
    lessons: ['m18/l04', 'm13/l01'],
    hints: [
      'Trois listes d’étapes : `setup`, `detonation`, `rollback`. Quatre actions existent : `create_account`, `delete_account`, `login` et `advance`. Une étape porte `repeat: N` pour se répéter, et `{{i}}` est remplacé par le rang dans les chaînes.',
      'Regardez les seuils de `fixtures/m18/atomic/rule.yaml` : la détonation doit les franchir, donc assez d’échecs sur assez de comptes distincts, depuis une seule adresse, dans la fenêtre. `advance` règle le temps virtuel entre deux étapes.',
      'Le retour arrière est la partie qu’on oublie : l’annuaire doit revenir **exactement** à son état initial, sinon la deuxième exécution part d’un état sale. Le harnais vérifie aussi que la mise en place seule ne fait pas lever la règle, et que deux exécutions donnent le même résultat.',
    ],
    fix: 'Avant détonation la règle est muette, après elle lève, après retour arrière l’état est identique à l’initial. Le retour arrière est ce qui rend le test rejouable en continu — et une validation de détection qu’on ne rejoue pas en continu est une validation qui vieillit. C’est le modèle d’Atomic Red Team.',
  },

  // ── Détections applicatives ───────────────────────────────────────────────
  {
    id: 'appsensor-points', module: 'm18', title: 'Les points de détection applicatifs',
    status: 'live', kind: 'artifact', level: 2, csslp: ['D5', 'D7'], cwe: 'CWE-778',
    brief: 'L’application ne distingue pas une erreur d’un comportement hostile : un utilisateur qui essaie dix identifiants d’objet à la suite ne déclenche rien. Le corpus `fixtures/m18/appsensor/` contient six trafics hostiles — un par point du catalogue — et un parcours légitime complet.',
    goal: 'Déclarer les six points de détection du catalogue, et vérifier qu’aucun ne se déclenche sur le parcours légitime.',
    file: 'detections/appsensor.yaml',
    lessons: ['m18/l05', 'm10/l07'],
    hints: [
      'Le catalogue des six points est dans `fixtures/m18/appsensor/catalogue.yaml` : AE1, ACE3, RE2, SE5, HT2 et IE5. Le livrable est une liste sous `points`, chaque entrée portant l’`id` du point et une requête dans la syntaxe du lab.',
      'Trois points se détectent à l’événement (une méthode HTTP non supportée, une ressource leurre, une intégrité rompue). Trois demandent un agrégat : plusieurs identifiants depuis une source, plusieurs objets refusés à un compte, plusieurs adresses dans une session.',
      'Le parcours légitime contient les quasi-jumeaux de chacun : un poste partagé où trois personnes se connectent, un comptable qui reçoit quatre 403 espacés, des préchecks CORS en OPTIONS, un mobile qui change de réseau entre **deux sessions distinctes**, et l’export officiel `/api/admin/export`.',
    ],
    fix: 'Les points de détection d’AppSensor sont la contribution la plus sous-estimée d’OWASP : l’application sait des choses que le réseau ignore. Elle sait qu’une session a changé d’adresse, et que la chaîne d’intégrité de son propre journal est rompue. Ce qui n’est pas noté : la réponse associée à chaque point — elle fait l’objet du challenge suivant.',
  },
  {
    id: 'graduated-response', module: 'm18', title: 'La réponse graduée',
    status: 'live', kind: 'artifact', level: 2, csslp: ['D5', 'D7'], cwe: 'CWE-1059',
    brief: 'Une détection ne sait faire qu’une chose : écrire une ligne. Personne ne la lit avant le lendemain. Le corpus `fixtures/m18/graduated/` contient dix-neuf sessions et, à côté, le palier que chacune doit atteindre.',
    goal: 'Écrire la politique qui fait passer le même signal de la trace à l’alerte, puis au ralentissement, puis au verrouillage — sans gêner un compte légitime.',
    file: 'detections/response-policy.yaml',
    lessons: ['m18/l05', 'm10/l03'],
    hints: [
      'Le livrable est une liste sous `stages`, une entrée par palier (`trace`, `alerte`, `ralentissement`, `verrouillage`), chacune portant une requête dans la syntaxe du lab. Les paliers attendus sont publiés dans `fixtures/m18/graduated/expected.json` : c’est une spécification, pas une devinette.',
      'Les quatre paliers doivent partager le même axe et la même fenêtre : le harnais vérifie qu’un cas qui verrouille est passé par les trois paliers d’avant. Une réponse qui saute des étapes n’en est pas une.',
      'Le bureau partagé ne doit rien déclencher, et l’utilisateur maladroit doit s’arrêter à la trace : il y a donc peu de place entre les deux. Et le dernier palier change de **critère**, pas seulement de seuil — verrouiller suppose plusieurs comptes distincts, sinon une intégration cassée sur son propre compte de service ferait tomber la production.',
    ],
    fix: 'Détecter sans répondre, c’est documenter l’incident pendant qu’il se déroule. La graduation est ce qui rend la réponse automatique acceptable : elle laisse une marge avant la mesure qui gêne un vrai client, et elle évite de transformer le verrouillage en arme de déni de service (NIST SP 800-63B).',
  },

  // ── Documenter, couvrir, investiguer ──────────────────────────────────────
  {
    id: 'ads-documentation', module: 'm18', title: 'La fiche de stratégie de détection',
    status: 'live', kind: 'artifact', level: 2, csslp: ['D7'], cwe: 'CWE-1059',
    brief: 'Les règles existent sans contexte : personne ne sait ce qu’elles couvrent, ce qu’elles ratent, ni quoi faire quand elles lèvent.',
    goal: 'Documenter la règle de bourrage d’identifiants selon les rubriques du cadre ADS, dont une recette de validation que le harnais exécute.',
    file: 'detections/ads/credential-stuffing.md',
    lessons: ['m18/l04', 'm18/l06'],
    hints: [
      'Neuf rubriques en titres de niveau deux : objectif, catégorisation, résumé de la stratégie, contexte technique, angles morts et hypothèses, faux positifs, validation, priorité, réponse.',
      'La catégorisation doit citer une technique ATT&CK existante et non dépréciée — le catalogue du lab est dans `fixtures/m18/coverage/attack.json`.',
      'La rubrique de validation doit contenir un bloc ```yaml avec une règle dans la syntaxe du lab. Le harnais l’exécute sur le corpus `cs/` et exige qu’elle lève réellement, sans faux positif.',
    ],
    fix: 'La rubrique de validation est celle qui compte : le harnais l’exécute et exige que la règle lève réellement. Les angles morts et les faux positifs attendus sont ce qui permet à l’analyste de trier à trois heures du matin. Ce qui n’est pas noté : la qualité de la prose — le harnais vérifie la présence et la longueur minimale des rubriques, pas leur pertinence.',
  },
  {
    id: 'detection-coverage', module: 'm18', title: 'La couverture qui se prouve',
    status: 'live', kind: 'artifact', level: 3, csslp: ['D7'], cwe: 'CWE-1059',
    brief: 'Douze règles, huit scénarios d’attaque, et aucune idée de ce qui est couvert ni de ce qui ne l’est pas.',
    goal: 'Faire déclarer à chaque scénario les règles qu’il déclenche, et à chaque règle sa technique, puis nommer le trou.',
    file: 'detections/coverage.yaml',
    lessons: ['m18/l04', 'm11/l04'],
    hints: [
      'Trois sections : `rules` (une technique par règle), `scenarios` (les règles que chacun déclenche) et `uncovered` (les règles qu’aucun scénario ne déclenche).',
      'Le harnais ne croit pas la déclaration : il rejoue chaque scénario contre la bibliothèque et compare. Une règle citée qui ne lève pas au rejeu est signalée, et une règle qui lève sans être citée aussi.',
      'Deux scénarios en déclenchent plusieurs à la fois. Et une règle sur douze n’est exercée par aucun scénario : `uncovered` doit la nommer — nommer le trou vaut mieux que le peindre.',
    ],
    fix: 'Le test échoue si un scénario cite une règle inexistante, si une technique citée est inconnue ou dépréciée, ou si la déclaration ne correspond pas au rejeu. La couverture ATT&CK se mesure alors pour de vrai, au lieu d’être une carte de chaleur décorative que personne n’ose contredire.',
  },
  {
    id: 'incident-timeline', module: 'm18', title: 'La chronologie de l’incident',
    status: 'live', kind: 'artifact', level: 3, csslp: ['D7'], cwe: 'CWE-1059',
    brief: 'Neuf cent quatorze lignes de journal dans `fixtures/m18/incident/log.ndjson`, un incident de quatorze événements dedans. Il faut dire par où c’est entré, ce qui a été touché, et ce qui est sorti.',
    goal: 'Reconstituer la liste ordonnée des événements de l’incident — aucun manquant, aucun en trop.',
    file: 'incident/timeline.yaml',
    lessons: ['m18/l06', 'm05/l07'],
    hints: [
      'Le livrable porte `entree`, `exfiltration` et une liste `evenements` d’identifiants, dans l’ordre chronologique.',
      'Commencez par ce qui ne ressemble à rien d’autre : un changement de permissions, une journalisation désactivée, un webhook vers un domaine inconnu. Puis remontez par l’identifiant de corrélation (`trace.id`).',
      'Une seule trace ne suffit pas : l’attaquant se crée une clé d’API en cours de route et bascule sur une autre session. Le pivot entre les deux, ce sont l’utilisateur et l’adresse source, qui ne changent pas.',
    ],
    fix: 'Le harnais connaît la vérité terrain et compare, dans les deux sens. Les identifiants de corrélation sont ce qui rend l’exercice faisable en minutes plutôt qu’en jours — et leur absence est ce qui transforme une investigation en archéologie. C’est pour ça qu’ils sont une exigence de conception, pas un détail d’implémentation.',
  },
];

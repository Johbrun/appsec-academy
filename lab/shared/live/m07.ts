// M7 · Fondations, exigences & vie privée — challenges jouables.
//
// Tous de type « artifact » : l'apprenant produit un livrable dans
// `workspace/`, et le harnais le confronte au dépôt plutôt qu'à lui-même.
// C'est la seule façon de mettre un module d'exigences en lab sans noter une
// dissertation — l'inventaire de confiance est confronté aux dépendances
// réellement déclarées, la carte des données aux champs réellement présents
// ET à ce que les routes renvoient, la matrice de traçabilité aux tests
// réellement exécutés, la revue d'accès au journal.
//
// `abuse-cases` reste spécifié dans shared/planned/m07.ts : il demande le
// double passage contre deux arbres, que le moteur d'audit ne sait pas encore
// faire.
//
// Les vérifications correspondantes sont dans server/audit/m07.ts.

import type { ExerciseDef } from '../exercises.ts';

export const m07: ExerciseDef[] = [
  {
    id: 'trust-inventory', module: 'm07', title: 'À qui fait-on confiance, au juste',
    status: 'live', kind: 'artifact', level: 1, csslp: ['D1', 'D3'], cwe: 'CWE-1059',
    brief: 'Novafact fait implicitement confiance à des dizaines de parties : registre npm, CDN, prestataire de paiement, fournisseur d’IA, runner de CI, poste des développeurs. Aucune liste n’existe.',
    goal: 'Établir l’inventaire des composants implicitement fiables, avec ce que chacun pourrait faire s’il se retournait.',
    file: 'requirements/trust.yaml',
    lessons: ['m07/l01', 'm08/l03'],
    hints: [
      'La liste ne s’invente pas : elle se relève dans le dépôt. Trois sources — les dépendances déclarées, les actions employées par les workflows, les origines externes que ces workflows contactent.',
      'Le format attendu : une clé `parties`, et pour chacune `partie`, `type` (`dependance`, `action-ci` ou `origine-externe`), `ce-qu-il-pourrait-faire` et `mitigation`.',
      'Le pouvoir décrit doit être propre à chaque partie — le harnais refuse deux descriptions identiques. Un compilateur, une action de checkout et un script téléchargé pendant le build ne peuvent pas nuire de la même façon.',
    ],
    fix: 'Le harnais confronte l’inventaire au code : chaque origine externe chargée, chaque dépendance directe, chaque action de CI doit y figurer, et rien d’imaginaire. La confiance est un spectre, et le premier geste de conception est de réduire le nombre de parties à qui l’on est obligé de faire confiance.',
  },
  {
    id: 'gold-standard-audit', module: 'm07', title: 'Authentifier, autoriser, journaliser',
    status: 'live', kind: 'artifact', level: 1, csslp: ['D1', 'D5'], cwe: 'CWE-778',
    brief: 'Le Gold Standard demande trois choses de chaque opération sensible. Les routes de Novafact en offrent une, deux, ou zéro, sans logique apparente.',
    goal: 'Établir pour chaque route mutante ce qui est présent et ce qui manque — et faire tomber l’écart à zéro.',
    file: 'requirements/gold-standard.csv',
    lessons: ['m07/l02', 'm18/l01'],
    hints: [
      'Le périmètre est déclaré — les routes mutantes de `server/routes/invoices.ts`, `credits.ts` et `profile.ts` — mais la liste se lit dans le code. Une route ajoutée demain y entre d’elle-même.',
      'Colonnes attendues : `route,methode,authentification,autorisation,audit,manque`. Les trois contrôles valent `oui` ou `non`, et `manque` répète exactement ceux qui valent `non` (ou `-`).',
      'Attention aux définitions : l’authentification peut venir d’un `router.use(requireUser)` monté plus haut ; une autorisation est un refus explicite fondé sur le principal, pas la simple lecture de `req.user` ; un audit est une entrée écrite sur le chemin normal, pas dans une branche d’erreur.',
    ],
    fix: 'Le harnais extrait les routes réellement montées et vérifie ligne à ligne. Le « A » d’audit est celui qu’on oublie — et c’est celui qui permet de répondre après coup à « qui a fait ça ».',
  },
  {
    id: 'asvs-subset', module: 'm07', title: 'Le sous-ensemble ASVS de Novafact',
    status: 'live', kind: 'artifact', level: 2, csslp: ['D3'], cwe: 'CWE-1059',
    brief: 'ASVS compte plusieurs centaines d’exigences. Les appliquer toutes est impossible, les ignorer toutes est confortable.',
    goal: 'Choisir les exigences de niveau L2 qui s’appliquent réellement à Novafact, et les inscrire dans le dépôt.',
    file: 'requirements/asvs.yaml',
    lessons: ['m07/l03', 'm07/l04'],
    hints: [
      'Le standard est embarqué dans `fixtures/m07/asvs-5.0.json` : les identifiants, leur chapitre et leur niveau s’y lisent. Aucune exigence inventée ne passe.',
      'Format : une clé `exigences`, et pour chacune `id` et `justification` (au moins quarante caractères). Entre huit et vingt-cinq exigences — en deçà c’est un échantillon, au-delà plus personne ne les tient.',
      'Les chapitres `obligatoires` du fichier de standard ne sont pas facultatifs pour une application de facturation : validation, authentification, session, autorisation, protection des données, journalisation. Chacun doit être représenté.',
    ],
    fix: 'Le harnais vérifie que chaque identifiant existe, qu’il est bien de niveau L2, et que les chapitres structurellement obligatoires sont couverts. On mesure la lecture du standard, pas la justesse du découpage — qui dépend du métier.',
  },
  {
    id: 'traceability-matrix', module: 'm07', title: 'La matrice qui ne ment pas',
    status: 'live', kind: 'artifact', level: 2, csslp: ['D3', 'D6'], cwe: 'CWE-1059',
    brief: 'Les exigences sont écrites. Rien ne dit lesquelles sont réellement tenues, ni par quoi.',
    goal: 'Relier chaque exigence retenue au test qui l’établit — et dire honnêtement lequel passe.',
    file: 'requirements/traceability.csv',
    lessons: ['m07/l04', 'm13/l01'],
    hints: [
      'La matrice se trace sur `requirements/asvs.yaml` : chaque exigence retenue a sa ligne, et rien d’autre n’en a.',
      'Colonnes attendues : `exigence,fichier,test,statut`. Le fichier est un chemin du dépôt, le test est le nom exact tel que `node --test` l’affiche, le statut vaut `tenue` ou `non-tenue`.',
      'Le harnais exécute réellement les tests cités : un statut qui ne correspond pas au verdict est signalé ligne par ligne. Sur le code livré, une matrice qui ne déclarerait que des exigences tenues est invraisemblable — et une qui n’en déclarerait aucune ne prouve pas qu’on sait tester.',
    ],
    fix: 'Pour chaque ligne, le harnais vérifie que l’exigence existe, que le fichier existe, que le test du nom donné existe, et qu’il passe ou échoue comme annoncé ; puis il exige la couverture inverse, aucune exigence sans ligne. Une matrice bien remplie mais fausse est détectée — c’est tout l’intérêt de la tenir dans le dépôt plutôt que dans un tableur.',
  },
  {
    id: 'data-classification', module: 'm07', title: 'La carte des données, confrontée au code',
    status: 'live', kind: 'artifact', level: 2, csslp: ['D3'], cwe: 'CWE-1059',
    brief: 'Novafact manipule des IBAN, des adresses, des notes internes et des secrets. Aucun dictionnaire de données, donc aucune règle de traitement.',
    goal: 'Classer chaque champ réellement manipulé — sensibilité, propriétaire, base légale, durée — et vérifier que rien d’interne ne sort par l’API.',
    file: 'privacy/data-classification.yaml',
    lessons: ['m07/l05', 'm07/l06'],
    hints: [
      'Les champs se lisent dans `interface User`, `Invoice`, `Client` et `Mail` de `server/store.ts`. Tous, sans exception, et aucun inventé.',
      'Énumérations fermées : la sensibilité vaut `public`, `client`, `interne` ou `secret` ; la base légale est l’une des six du règlement ; le propriétaire est un handle d’équipe existant ; la conservation est une durée (`36 mois`, `3 ans`, `duree-du-compte`, `illimitee`).',
      'Le harnais appelle ensuite les routes et refuse qu’un champ classé `interne` ou `secret` apparaisse dans une réponse. Il compare des NOMS de champs, pas des couples entité.champ : un nom exposé quelque part l’est partout.',
    ],
    fix: 'Le harnais extrait les champs réellement présents dans le modèle, exige que chacun soit classé, puis confronte la carte à ce que l’API renvoie. Classer tout en « client » pour n’avoir rien à protéger est le raccourci que la vérification refuse : une application de facturation a des données internes.',
  },
  {
    id: 'erasure-test', module: 'm07', title: 'L’effacement qui efface pour de bon',
    status: 'live', kind: 'artifact', level: 2, csslp: ['D3', 'D6'], cwe: 'CWE-359',
    brief: 'La suppression d’un compte pose un drapeau. Les exports, la boîte d’envoi et les journaux gardent tout.',
    goal: 'Écrire la politique de rétention, puis le test qui cherche les données du compte supprimé dans tous les magasins et n’en trouve aucune.',
    file: 'verify/erasure.test.ts',
    lessons: ['m07/l06', 'm13/l02'],
    hints: [
      'Deux livrables : `privacy/retention.yaml` d’abord — une durée par classe de données sous la clé `conservation` — puis le test.',
      'Les magasins où la donnée se propage sont listés dans `fixtures/m07/magasins.yaml`, et chacun correspond à un champ de `interface State`. Ils sont cinq, pas trois.',
      'Chaque magasin doit porter SA PROPRE assertion, sur la même ligne que son nom : citer les cinq noms dans un commentaire ne prouve pas qu’on est allé regarder. Et le test doit chercher une valeur identifiante — une adresse — plutôt qu’un drapeau « supprimé ».',
    ],
    fix: 'Le harnais exige que le test couvre les cinq magasins et que la politique déclare une durée pour chaque classe. Le droit à l’effacement porte sur toutes les copies : cartographier où la donnée se propage vient avant de promettre de l’effacer.',
  },
  {
    id: 'compliance-matrix', module: 'm07', title: 'Ce que la conformité impose vraiment',
    status: 'live', kind: 'artifact', level: 2, csslp: ['D3', 'D8'], cwe: 'CWE-1059',
    brief: 'PCI DSS, RGPD, NIS2, CRA : quatre textes cités en réunion, aucune trace de ce qu’ils imposent concrètement à Novafact.',
    goal: 'Établir la matrice exigence réglementaire → contrôle technique → preuve dans le dépôt.',
    file: 'requirements/compliance.yaml',
    lessons: ['m07/l07', 'm04/l07'],
    hints: [
      'Les obligations sont embarquées dans `fixtures/m07/obligations.yaml`, avec le texte réglementaire dont chacune vient. Toutes doivent être traitées.',
      'Format : une clé `obligations`, et pour chacune `id`, `controle-technique` (au moins quarante caractères, et propre à cette obligation), `couverte` (`oui` ou `non`), puis `preuves` — des chemins qui existent — ou `plan` si elle n’est pas couverte.',
      'Trois obligations sont vérifiées en profondeur, et le fichier de fixtures dit lesquelles : la preuve doit établir ce qu’elle prétend. Pour le CRA, cela veut dire un exécutable qui décide, pas un document qui décrit.',
    ],
    fix: 'Le harnais vérifie que chaque preuve citée existe, et pousse sur un sous-ensemble décidable. Une exigence sans contrôle est une case cochée ; un contrôle sans preuve est une intention. Déclarer une obligation non couverte avec un plan écrit vaut mieux que de la déclarer couverte sans preuve.',
  },
  {
    id: 'access-recertification', module: 'm07', title: 'Recertifier les accès',
    status: 'live', kind: 'artifact', level: 3, csslp: ['D3', 'D7'], cwe: 'CWE-1059',
    brief: 'Des comptes de service et des comptes humains ont des droits que personne n’a revus depuis leur création. Certains n’ont jamais servi.',
    goal: 'Produire la revue : qui a quoi, qui s’en est servi, ce qui doit être retiré.',
    file: 'requirements/access-review.csv',
    lessons: ['m07/l08', 'm15/l05'],
    hints: [
      'Deux fixtures : `fixtures/m07/comptes.json` donne les comptes, leurs droits et la période de revue ; `fixtures/m07/journal-acces.json` donne les exercices de droits.',
      'Colonnes attendues : `compte,droit,derniere-utilisation,decision`. Une ligne par couple compte/droit accordé — et seulement pour des droits réellement accordés.',
      'La règle est mécanique : un droit exercé au moins une fois DANS la période se conserve, avec la date du dernier exercice ; un droit jamais exercé se retire, et la colonne de date reste vide ou vaut `-`. Les événements hors période ne comptent pas.',
    ],
    fix: 'Le harnais croise la liste des comptes avec le journal et connaît la réponse : les droits jamais exercés sur la période sont à retirer. C’est le même geste que le moindre privilège côté IAM — partir de l’usage réel plutôt que de la demande initiale.',
  },
];

// M6 · Faire adopter la sécurité — challenges jouables.
//
// Challenges « artifact » : l'apprenant produit un fichier dans `workspace/`,
// et c'est ce fichier qui est jugé.
//
// Ce qui N'EST PAS ici, et qui n'y sera pas : négocier avec le produit
// (m06/l03) et traduire un risque pour une direction (m06/l04). Une charte de
// champions ou un modèle FAIR se juge sur des estimations d'expert —
// c'est-à-dire sur le jugement même qu'on voudrait évaluer. Ces deux leçons
// restent au site, où le jeu Pushback fait déjà le travail. Et il n'existe
// aucun format machine pour une charte de champions : que des présentations.
//
// `finding-with-test` reste spécifié dans shared/planned/m06.ts : il demande le
// double passage contre deux arbres (le code livré et le corrigé), que le
// moteur d'audit synchrone ne sait pas encore faire.
//
// Les vérifications correspondantes sont dans server/audit/m06.ts.

import type { ExerciseDef } from '../exercises.ts';

export const m06: ExerciseDef[] = [
  {
    id: 'finding-sarif', module: 'm06', title: 'Le finding à la bonne ligne',
    status: 'live', kind: 'artifact', level: 2, csslp: ['D2', 'D6'], cwe: 'CWE-1059',
    brief: 'Le rapport annonce « contrôle d’accès insuffisant sur l’API ». L’équipe ne sait pas quel fichier ouvrir.',
    goal: 'Transformer le défaut `bola-invoice` du lab en constat structuré au format SARIF 2.1.0 : emplacement exact, classe de bug, et correctif qui s’applique vraiment.',
    file: 'findings/bola-invoice.sarif',
    lessons: ['m06/l02', 'm12/l03'],
    hints: [
      'Ouvre le fichier que le registre associe à `bola-invoice` et trouve la ligne exacte où la facture est chargée sans qu’on regarde à qui elle appartient. C’est ce point d’entrée-là que le constat doit désigner, pas le fichier, pas la fonction.',
      'Un résultat SARIF porte `ruleId`, `level`, `message.text`, et `locations[].physicalLocation` avec `artifactLocation.uri` (chemin relatif à la racine du lab) et `region.startLine`. La classe de bug se nomme dans `ruleId` ou dans `properties` — le CWE est celui que le registre donne à l’exercice.',
      'Ajoute un tableau `fixes` : `artifactChanges[].replacements[]`, avec `deletedRegion` (les lignes à remplacer) et `insertedContent.text` (ce qui prend leur place). Le harnais applique réellement ce correctif au fichier : le texte inséré doit introduire la comparaison entre le tenant de la facture et celui de l’appelant, et le gestionnaire doit continuer à répondre après application.',
    ],
    fix: 'Le harnais valide le format, vérifie que l’emplacement désigne le fichier réellement fautif et que la ligne tombe sur le point d’entrée du défaut à deux lignes près, puis **applique le correctif proposé** et relit le résultat. La prose n’est pas notée, et il faut le dire : la persuasion ne s’automatise pas, la précision si. Un finding précis se corrige ; un finding vague se discute.',
  },
  {
    id: 'codeowners-sensitive', module: 'm06', title: 'Router la revue vers les bonnes personnes',
    status: 'live', kind: 'artifact', level: 1, csslp: ['D2', 'D7'], cwe: 'CWE-1391',
    brief: 'Les fichiers d’authentification, de jeton et les workflows se font relire par qui passe. L’AppSec découvre les changements en production.',
    goal: 'Écrire le CODEOWNERS du dépôt pour que les chemins sensibles — et seulement eux — exigent la revue de l’équipe sécurité.',
    file: '.github/CODEOWNERS',
    lessons: ['m06/l05', 'm06/l01', 'm12/l03'],
    hints: [
      'Le harnais ne tient pas une liste de chemins sensibles : il la déduit du code. Est sensible tout ce qui est sous `server/lib/`, toute route qui se sert du module de jeton, toute route qui décide d’un privilège d’après `req.user.role`, et tous les workflows. Explore avant d’écrire.',
      'La règle de résolution de GitHub est contre-intuitive : c’est la **dernière** règle qui correspond qui l’emporte. Une règle générale placée en bas annule toutes les règles précises placées au-dessus. Les motifs qui se terminent par `/` couvrent un dossier entier.',
      'Trois contraintes à tenir ensemble : chaque chemin sensible résout vers l’équipe sécurité (voir `fixtures/m01/organisation.yaml`) ; un fichier ordinaire n’y va pas ; et un fichier ordinaire a quand même un propriétaire — donc une règle `*` en tête. Les équipes citées doivent exister.',
    ],
    fix: 'Le harnais applique la vraie règle de résolution et vérifie trois choses : les chemins sensibles résolvent vers l’équipe sécurité, un fichier ordinaire ne l’encombre pas, et il a quand même un relecteur. Le double critère empêche la règle paresseuse qui met tout le dépôt sur le dos de l’AppSec — et qui garantit qu’elle ne relira rien. Le découpage entre les autres équipes n’est pas noté : il dépend de l’organisation.',
  },
  {
    id: 'training-from-bug', module: 'm06', title: 'Former à partir d’un vrai bug',
    status: 'live', kind: 'artifact', level: 2, csslp: ['D2', 'D6'], cwe: 'CWE-1059',
    brief: 'La formation annuelle parle d’injection SQL. L’équipe écrit du TypeScript et vient de livrer trois mass assignments.',
    goal: 'Construire l’exercice court qui enseigne la classe de bug que l’équipe vient réellement d’introduire : l’extrait vulnérable, son correctif, et le test qui les sépare.',
    file: 'training/mass-assignment/',
    lessons: ['m06/l06', 'm13/l02'],
    hints: [
      'Trois fichiers dans `workspace/training/mass-assignment/` : `vulnerable.ts`, `corrige.ts` et `exercice.test.ts`. Les deux premiers exportent la même fonction, écrite de deux façons ; le troisième doit échouer sur l’un et passer sur l’autre.',
      'Pour que le même test s’exécute contre les deux, il reçoit sa cible par l’environnement : `const { maFonction } = await import(process.env.CIBLE)`. Le harnais recopie les deux modules sous des noms tirés au hasard — inutile de regarder le nom du fichier, seul le comportement compte.',
      'Il faut au moins deux tests : celui qui attrape le défaut (un champ que le client n’a pas à écrire ne doit pas être écrit) et celui qui vérifie que la fonction rend toujours le service attendu (le champ prévu, lui, se modifie). Sans le second, « tout refuser » suffirait.',
    ],
    fix: 'Double passage local : le test produit doit échouer contre l’extrait vulnérable et passer contre son correctif — les deux étant fournis par l’apprenant. Un test qui passe partout ne prouve rien, un test qui échoue partout casse la fonctionnalité. Le harnais vérifie en plus que l’extrait vulnérable porte bien un mass assignment et que le correctif n’en porte plus. Partir des bugs réels de l’entreprise est ce qui distingue une formation suivie d’une formation subie, et la mesure est dans les findings suivants.',
  },
  {
    id: 'pentest-scope', module: 'm06', title: 'Cadrer un test d’intrusion',
    status: 'live', kind: 'artifact', level: 3, csslp: ['D6', 'D8'], cwe: 'CWE-1059',
    brief: 'Le prestataire arrive lundi. Il n’a ni comptes, ni périmètre écrit, ni environnement, et la production est hors limites — ce que personne ne lui a dit.',
    goal: 'Écrire le cadrage : périmètre, exclusions, comptes fournis par rôle, fenêtre, conditions d’arrêt, et modalité de retest.',
    file: 'pentest/scope.yaml',
    lessons: ['m06/l08', 'm07/l03'],
    hints: [
      'Les environnements de Novafact sont dans `fixtures/m06/environnements.yaml`. Un hôte qui n’y figure pas n’existe pas ; un hôte marqué `production: true` ne se teste pas — et surtout, il se dit, dans les exclusions.',
      'Les rôles à couvrir ne s’inventent pas non plus : ils sont dans le modèle de données, sur l’entité utilisateur de `server/store.ts`. Un rôle sans compte fourni est une partie de l’application que personne ne testera.',
      'Clés attendues : `prestataire`, `periode: { du, au }`, `perimetre` et `exclusions` (listes d’entrées `hote` + `motif`), `comptes` (`role` + `identifiant`), `conditions-arret` (au moins trois, écrites), et `retest: { date, modalite }` — la date après la fin du test.',
    ],
    fix: 'Le harnais vérifie la complétude structurelle et la cohérence avec le code : chaque hôte du périmètre existe dans la configuration, la production est exclue et pas seulement absente, chaque rôle du modèle de données a un compte, et le retest est daté après la fenêtre. Le choix du périmètre, la durée et le montant ne sont pas jugés — ce sont des arbitrages. Tu connais l’autre côté : c’est l’occasion d’écrire ce qu’un bon client fournit, et que tu n’as presque jamais reçu.',
  },
];

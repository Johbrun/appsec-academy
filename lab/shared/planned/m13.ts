// M13 · Tests & analyse de code — challenges spécifiés.
//
// Notes d'implémentation, vérifiées en exécution :
//   · **Semgrep** n'est pas sur npm (le paquet publié est un fantôme) mais
//     s'installe par pipx ou Docker et tourne hors ligne. Son mode `--test`
//     est le meilleur correcteur du lot : il compare les annotations du fichier
//     d'essai aux findings et sort en erreur au moindre écart. `npm run verify`
//     doit détecter son absence et sauter l'exercice proprement.
//   · **CodeQL** fonctionne techniquement et `codeql test run` est
//     déterministe, mais sa **licence interdit cet usage** : écarté.
//   · **ESLint** et son `RuleTester` sont le second socle, 100 % npm, sans
//     friction — c'est par là qu'il faut commencer.
//   · **fast-check** et **Jazzer.js** marchent, mais un cas pathologique peut
//     bloquer le correcteur lui-même : graine fixée, nombre d'exécutions borné,
//     délai maximal sur chaque propriété, et corpus rejoué en régression plutôt
//     qu'en recherche.
//   · Données de test → `@snaplet/copycat` donne des valeurs réalistes et
//     déterministes à partir d'une graine.
//
// Piège à éviter en implémentant : une règle notée uniquement contre le dépôt
// est trivialement gagnée par une règle qui code en dur un nom de fichier. Les
// règles se notent contre les jeux valides/invalides du harnais.

import { P } from './helper.ts';
import type { ExerciseDef } from '../exercises.ts';

export const m13: ExerciseDef[] = [
  P('regression-pair', 'm13', 'Le test qui prouve qu’un contrôle refuse', 1, 'artifact', 'CWE-1059', ['D6'],
    'Les tests existants vérifient tous que la fonctionnalité marche. Aucun ne vérifie qu’un contrôle refuse.',
    'Écrire, pour trois challenges déjà corrigés, le couple de tests qui manque.',
    'verify/', ['m13/l02', 'm06/l02'],
    'Double passage, plus une contrainte structurelle : chaque suite doit contenir au moins un cas qui refuse et un cas qui autorise. Un test qui ne vérifie que le chemin heureux est rejeté — ce qui est exactement la leçon de l’exercice K12 de Kohnfelder.'),

  P('semgrep-taint', 'm13', 'La même règle, en mode taint', 2, 'artifact', 'CWE-1059', ['D5', 'D6'],
    'La règle de lint attrape un motif syntaxique. Elle ne sait pas suivre une donnée du corps de la requête jusqu’au sink, à travers trois fonctions.',
    'Porter la règle en mode taint : source, sink, et le schéma de validation comme assainisseur.',
    'rules/tainted-body.yaml', ['m13/l04', 'm12/l02'],
    'Le fichier de test annoté est le correcteur : l’outil compare ses findings aux annotations et sort en erreur au moindre écart. Le suivi de teinte est ce qui transforme une règle « qui trouve des mots » en une règle qui trouve des chemins — et donc la variant analysis en geste systématique.'),

  P('property-test', 'm13', 'La propriété qui trouve le bug d’argent', 2, 'artifact', 'CWE-1059', ['D6'],
    'Les tests de calcul de total passent : ils portent tous sur des cas que le développeur avait en tête.',
    'Écrire la propriété qui doit tenir sur tout total de facture, et la laisser chercher le contre-exemple.',
    'verify/money.property.test.ts', ['m13/l05', 'm02/l03'],
    'Graine fixée, donc reproductible : la propriété doit échouer contre le code livré et passer contre le corrigé. Le harnais exige de surcroît que l’espace exploré couvre les quantités négatives et les flottants — sinon la propriété est trop faible pour trouver quoi que ce soit.'),

  P('fuzz-target', 'm13', 'Le fuzz qui casse le parseur', 2, 'artifact', 'CWE-1333', ['D6'],
    'La validation de référence de facture n’a jamais vu autre chose que des références de facture.',
    'Écrire la cible de fuzz, trouver l’entrée qui fait exploser le temps de calcul, et la figer en régression.',
    'fuzz/invoice-ref.fuzz.ts', ['m13/l05', 'm02/l04'],
    'Le harnais rejoue le corpus trouvé en mode régression — pas en mode recherche, c’est ce qui rend le résultat déterministe — et exige qu’au moins une entrée dépasse le seuil contre le code livré et aucune contre le corrigé. Le budget de temps est le verdict.'),

  P('dast-in-ci', 'm13', 'Le DAST sur environnement éphémère', 2, 'artifact', 'CWE-1059', ['D6'],
    'Le scanner dynamique tourne une fois par trimestre, sur un environnement qui ne ressemble plus à la production.',
    'Le brancher en CI sur une instance éphémère, authentifié, avec le périmètre et le seuil de blocage.',
    '.github/workflows/dast.yml', ['m13/l07', 'm01/l05'],
    'Le harnais lance le lab, exécute le scan et vérifie qu’il trouve les défauts connus sans dépasser le budget de temps. Un DAST non authentifié ne voit qu’une page de connexion : l’authentification est ce qui fait la différence entre un scan et une figure de style.'),

  P('secrets-scan', 'm13', 'Secrets dans le dépôt', 1, 'fix', 'CWE-798', ['D6', 'D7'],
    'Des identifiants traînent dans la configuration, dans un fichier d’exemple et dans un test.',
    'Les trouver tous, les sortir du code, et mettre en place ce qui empêche le prochain d’entrer.',
    '.env.example', ['m13/l07', 'm17/l01'],
    'Détection en pre-commit et en CI, protection côté forge. Et surtout : corriger un secret exposé, c’est le **révoquer** — le retirer du fichier ne le retire ni de l’historique ni des clones déjà faits.'),
];

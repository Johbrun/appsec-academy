// m13 · Tests & analyse de code — challenges jouables.
//
// Challenges « artifact » : l'apprenant PRODUIT un fichier dans `workspace/`,
// au chemin donné par `file`, et c'est ce fichier qui est jugé. On relance
// l'audit depuis la page du challenge, ou par POST /api/lab/audit/<id>.
//
// Le motif dominant du module est le différentiel valide/invalide : la règle de
// lint tourne contre douze cas à signaler et quatorze cas très proches à
// laisser passer ; le détecteur de données réelles contre dix enregistrements
// extraits d'une vraie base et vingt enregistrements synthétiques. Trop large,
// ça échoue sur les seconds ; trop étroit, sur les premiers — et le résultat ne
// se code pas en dur.
//
// Les jeux et les données sont dans `fixtures/m13/`.
// Les vérifications correspondantes sont dans server/audit/m13.ts.

import type { ExerciseDef } from '../exercises.ts';

export const m13: ExerciseDef[] = [
  {
    id: 'test-strategy', module: 'm13', title: 'Où placer chaque technique',
    status: 'live', kind: 'artifact', level: 1, csslp: ['D6'], cwe: 'CWE-1059',
    brief:
      'Tout tourne à chaque commit : la CI met dix-huit minutes et l’équipe la contourne. Six techniques à replacer — analyse statique, composition, secrets, DAST, fuzzing, régression.',
    goal:
      'Produire `workspace/program/test-strategy.yaml` : pour chaque technique, l’étape, le caractère bloquant, le budget de temps et le déclencheur, en cohérence avec les workflows réels de `novafact/.github/workflows/`.',
    file: 'program/test-strategy.yaml',
    lessons: ['m13/l01', 'm32/l03'],
    hints: [
      'Une technique coûte du temps là où on la met. Sur le chemin critique, ce temps se paie à chaque commit — et finit par se contourner.',
      'Quatre questions par technique : de quoi a-t-elle besoin pour tourner (un diff ? un build ? un environnement déployé ?), quand son retour est-il encore utile, est-ce qu’elle bloque, et combien de temps elle prend. Puis regarde quels déclencheurs le dépôt a DÉJÀ : ce qui manque est à créer, et il faut le dire.',
      'Forme : `{version, techniques: [{technique, etape, bloquant, budget_minutes, declencheur, workflow_existe, pourquoi}]}`. Étapes : `pre-commit`, `pull-request`, `main-merge`, `nightly`, `release`, `production`. Déclencheurs : `local` (pre-commit), `pull_request`, `push`, `schedule`, `workflow_dispatch`. Contraintes notées : le DAST hors de `pre-commit` et `pull-request` ; le fuzzing jamais bloquant et jamais avant `nightly` ; la régression bloquante sur `pull-request` ; les secrets bloquants, au plus tard sur `pull-request` ; l’analyse statique au plus tard à `main-merge` ; la composition bloquante sur `pull-request` ou `main-merge` ; au plus 2 minutes cumulées en pré-commit et 10 minutes bloquantes sur la pull request ; et `workflow_existe` conforme aux déclencheurs réellement présents dans la fixture.',
    ],
    fix: 'Une technique au mauvais endroit est soit un frein qu’on contourne, soit un filet qui arrive trop tard. Le budget de temps sur le chemin critique est une contrainte de conception, pas un détail d’exploitation : c’est lui qui décide de ce qui peut y entrer.',
  },

  {
    id: 'eslint-rule', module: 'm13', title: 'La règle qui attrape la classe',
    status: 'live', kind: 'artifact', level: 2, csslp: ['D5', 'D6'], cwe: 'CWE-1059',
    brief:
      'Le mass assignment a été corrigé à un endroit. Rien n’empêche le prochain développeur de le réintroduire ailleurs.',
    goal:
      'Écrire `workspace/rules/no-body-spread.js`, la règle d’analyse statique qui interdit la classe, et la faire passer sur les pièges de `fixtures/m13/eslint-cases.json`.',
    file: 'rules/no-body-spread.js',
    lessons: ['m13/l03', 'm13/l04'],
    hints: [
      'Les jeux sont publiés : douze cas à signaler, quatorze à laisser passer. Lis-les avant d’écrire une ligne — ce sont eux qui définissent la règle.',
      'Ce qu’il faut signaler : le corps ENTIER de la requête qui entre dans un objet, par un élément d’étalement `{ ...E }` ou par un argument source de `Object.assign(cible, …)` à partir du deuxième. « Le corps de la requête » = la propriété `body` (notation pointée ou `["body"]`) lue sur `req`, `request` ou `ctx.request`. Rien d’autre : ni l’accès à une sous-propriété, ni la déstructuration et son reste, ni l’étalement d’autre chose, ni une propriété `body` portée par un objet qui n’est pas une requête.',
      'Format ESLint : le module exporte `{ meta, create(context) }`, et `create` rend un objet dont les clés sont des types de nœuds ESTree (`SpreadElement`, `CallExpression`…). Les nœuds portent `parent`, et `context.report({ node, messageId })` signale. Pas besoin d’analyse de portée : la règle est purement syntaxique. L’export par défaut (`export default { … }`) comme `module.exports` sont acceptés.',
    ],
    fix: 'Corriger une instance protège une route ; écrire la règle protège la classe, y compris le code qui n’est pas encore écrit. Et le différentiel valide/invalide est ce qui rend la règle honnête : une règle qui signale tout est aussi inutile qu’une règle qui ne signale rien, et seuls les faux positifs décident de sa survie en CI.',
  },

  {
    id: 'sbom-generate', module: 'm13', title: 'Générer le SBOM, et le garder juste',
    status: 'live', kind: 'artifact', level: 2, csslp: ['D6', 'D8'], cwe: 'CWE-1059',
    brief:
      'Le SBOM a été produit une fois, à la main, il y a quatre mois. Personne ne sait s’il décrit encore l’application. Son arbre de dépendances est dans `fixtures/m13/app/` (package.json et package-lock.json).',
    goal:
      'Produire `workspace/sbom.cdx.json` : le SBOM CycloneDX de cette application, fidèle à son lockfile.',
    file: 'sbom.cdx.json',
    lessons: ['m13/l06', 'm05/l05'],
    hints: [
      'Le lockfile est la vérité : c’est lui qui dit ce qui sera installé, pas les plages de versions du `package.json`.',
      'Le schéma est dans `fixtures/m13/cyclonedx-sbom.schema.json`. Deux pièges classiques : les dépendances de développement n’ont pas à figurer dans le SBOM de l’application livrée, et le composant racine doit être l’application — pas l’exemple laissé par le gabarit de l’outil.',
      'Le harnais compare l’ensemble des `purl` à celui qu’il recalcule depuis le lockfile. Un purl npm s’écrit `pkg:npm/nom@version`, et un paquet à portée encode l’arobase : `pkg:npm/%40novafact/ui-kit@1.2.0`. `metadata.component` porte `type: application`, le nom et la version de l’application.',
    ],
    fix: 'Un SBOM faux est pire qu’absent : il répond faux le jour de l’incident, quand la question « est-ce qu’on a ce paquet ? » doit trouver sa réponse en trente secondes. Ce qui le garde juste, c’est de le régénérer à chaque build depuis le lockfile, et de faire échouer la CI quand il diverge.',
  },

  {
    id: 'test-data-generator', module: 'm13', title: 'Des données de test qui ne viennent pas de la prod',
    status: 'live', kind: 'artifact', level: 2, csslp: ['D6', 'D3'], cwe: 'CWE-359',
    brief:
      'Le jeu de test a été extrait de la production « pour être réaliste ». Il contient de vrais IBAN et de vraies adresses. Dix de ces enregistrements sont dans `fixtures/m13/seed-suspects.json`, à côté de dix enregistrements synthétiques conformes.',
    goal:
      'Écrire `workspace/scripts/seed.mjs`, qui exporte `generate({ graine, nombre })` — des données représentatives et déterministes — et `suspect(enregistrement)` — la règle qui interdit d’y remettre du réel.',
    file: 'scripts/seed.mjs',
    lessons: ['m13/l08', 'm07/l03'],
    hints: [
      'Ne produis pas des valeurs « qui ont l’air fausses » : produis des valeurs dont on peut DÉMONTRER qu’elles ne peuvent pas être vraies.',
      'Les formats réservés sont listés en tête du fichier de fixtures. Trois d’entre eux se prouvent par une clé de contrôle : un IBAN qui échoue la clé ISO 7064 mod 97 n’est l’IBAN de personne, un numéro qui échoue Luhn n’est la carte de personne. Et c’est exactement ce que `suspect()` doit détecter dans l’autre sens.',
      'Le module exporte `generate({ graine, nombre })` → un tableau de `{ id, nom, email, telephone, iban, carte, siret }`, déterministe à graine égale et différent d’une graine à l’autre, et `suspect(enregistrement)` → un tableau de raisons, vide quand il n’y a rien à dire. Le harnais vérifie les deux sens : `suspect()` doit signaler les dix enregistrements réels, et n’en signaler aucun parmi les synthétiques ni parmi ceux que ton propre générateur produit.',
    ],
    fix: 'Copier la production, c’est étendre le périmètre de conformité — RGPD, PCI DSS — à l’environnement de test, à ses sauvegardes et aux postes des développeurs. Le générateur déterministe règle en plus le problème d’à côté : une régression ne se rejoue que si la donnée qui l’a déclenchée se reproduit.',
  },

  {
    id: 'malicious-postinstall', module: 'm13', title: 'Script d’installation malveillant',
    status: 'live', kind: 'artifact', level: 3, csslp: ['D5', 'D8'], cwe: 'CWE-506',
    brief:
      'Une dépendance embarquée (`fixtures/m13/suspect-package/`) déclare un script d’installation obfusqué — inerte, mais représentatif de ce qu’on trouve dans une vague Shai-Hulud.',
    goal:
      'Produire `workspace/review/postinstall.yaml` : le paquet et le script en cause, ce que le script ferait, et le garde-fou qui l’empêche de s’exécuter.',
    file: 'review/postinstall.yaml',
    lessons: ['m13/l09', 'm14/l03'],
    hints: [
      'Le `package.json` du paquet dit quel script tourne à l’installation et quel fichier il appelle. Ouvre ce fichier.',
      'Le tableau de chaînes en tête n’est pas du bruit : décode-le, et le script raconte ce qu’il fait. Les comportements se choisissent dans une liste fermée — pas de prose, et la liste contient des distracteurs que le script NE fait PAS.',
      'Forme : `{paquet, version, script, fichier, comportements: [...], indices: [...], garde_fou: {npmrc: "…"}}`. Comportements permis : `lecture_variables_environnement`, `lecture_fichiers_identifiants`, `exfiltration_http`, `execution_commande_systeme`, `persistance_tache_planifiee`, `modification_fichier_source`, `minage_cryptomonnaie`, `desactivation_journalisation`, `chiffrement_donnees`. Le garde-fou est vérifié EN EXÉCUTION : le harnais installe un paquet dont la post-installation écrit un marqueur, avec ta configuration npm, et constate que le marqueur n’apparaît pas — sans que l’installation échoue pour autant.',
    ],
    fix: 'Le verdict est un effet observable, pas une déclaration : c’est la seule façon de savoir si un garde-fou tient. Et celui-ci se pose une fois pour toutes, sur le poste comme sur le runner — c’est le vecteur d’exécution des vers qui frappent npm depuis 2025, d’event-stream à Shai-Hulud.',
  },

  {
    id: 'ai-review-eval', module: 'm13', title: 'Évaluer un relecteur IA',
    status: 'live', kind: 'artifact', level: 3, csslp: ['D5', 'D6'], cwe: 'CWE-1059',
    brief:
      'Un relecteur IA a rendu trente constats sur Novafact (`fixtures/m13/ai-review.json`). Certains sont justes, d’autres sont des hallucinations plausibles. Les défauts réellement présents sont listés dans `fixtures/m13/known-defects.json`.',
    goal:
      'Trancher chaque constat dans `workspace/review/ai-eval.csv`, puis mesurer précision et rappel dans `workspace/review/ai-eval-metrics.json`.',
    file: 'review/ai-eval.csv',
    lessons: ['m13/l10', 'm12/l06'],
    hints: [
      'Trois verdicts, et le premier tri est mécanique : un constat qui cite un fichier ou un symbole inexistant n’a pas besoin d’être discuté.',
      '`hallucination` = le fichier cité n’existe pas, ou le symbole n’apparaît nulle part dedans. `vrai_positif` = le constat désigne un défaut de la liste connue, au même fichier, au même symbole et avec la même CWE. `faux_positif` = tout le reste : le code existe, mais il ne fait pas ce que le constat décrit.',
      'CSV `id,verdict,defaut,justification` — trente lignes ; `defaut` porte l’identifiant `KD-xx` couvert, et reste vide hors vrai positif ; la justification doit faire au moins dix caractères, son contenu n’est pas noté. Métriques : `{"precision","rappel"}`, à trois décimales. Précision = vrais positifs / nombre de constats rendus. Rappel = défauts connus couverts par au moins un vrai positif / nombre de défauts connus.',
    ],
    fix: 'Ce qu’on mesure au passage, c’est le coût réel de l’outil. Un relecteur qui rend trois constats à écarter pour un constat juste consomme plus de temps d’ingénieur qu’il n’en fait gagner — et c’est la seule façon de le savoir avant de l’imposer à toute l’organisation. La mesure se refait à chaque changement de modèle.',
  },
];

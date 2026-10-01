// m17 · Déploiement, exploitation & résilience — challenges jouables.
//
// Challenges « fix » : le défaut vit dans le dépôt fixture `novafact/`, pas
// dans une requête. On l'audite, on corrige le fichier, et on relance l'audit
// — depuis la page du challenge ou par POST /api/lab/audit.
//
// Ceux implémentés ici sont ceux qui portent sur un artefact de déploiement :
// image de conteneur, pile de développement, manifestes Kubernetes,
// sauvegardes. Les challenges du module qui portent sur le code de
// l'application elle-même (en-têtes, CSP, secret de repli, garde-fous de
// disponibilité) restent spécifiés dans shared/planned/m17.ts.
//
// Les vérifications correspondantes sont dans server/audit/m17.ts.

import type { ExerciseDef } from '../exercises.ts';

export const m17: ExerciseDef[] = [
  {
    id: 'dockerfile', module: 'm17', title: 'Image de conteneur trop permissive',
    status: 'live', kind: 'fix', level: 2, csslp: ['D7'], cwe: 'CWE-250',
    brief: 'L’image tourne en root, embarque les dépendances de développement et reçoit un secret par argument de build.',
    goal: 'Réécrire l’image : minimale, utilisateur non privilégié, aucun secret dans les couches.',
    file: 'novafact/Dockerfile',
    lessons: ['m17/l02', 'm14/l05'],
    hints: [
      'Trois défauts indépendants : qui exécute le processus, ce que l’image embarque, et ce qu’elle garde de la construction.',
      'Un `ARG` reste lisible dans `docker history` même si le fichier qu’il a servi à écrire est supprimé par l’instruction suivante. Et `npm ci` installe les devDependencies quelle que soit la valeur de NODE_ENV.',
      'Construction en deux étapes : l’étape de build compile, l’image finale repart d’une base neuve, fait `npm ci --omit=dev`, copie le résultat avec `COPY --from=`, et finit par `USER node`. Le jeton du registre se monte avec `RUN --mount=type=secret`.',
    ],
    fix: 'Construction multi-étapes, dépendances de production seulement, utilisateur non privilégié, système de fichiers en lecture seule, secrets montés au build. Un secret passé par argument reste dans l’historique des couches même si le fichier est supprimé ensuite.',
  },
  {
    id: 'docker-base-pinning', module: 'm17', title: 'Image de base non épinglée',
    status: 'live', kind: 'fix', level: 1, csslp: ['D7', 'D8'], cwe: 'CWE-1357',
    brief: 'L’image de base est référencée par étiquette mobile : deux constructions à une semaine d’écart ne produisent pas le même système.',
    goal: 'Épingler par empreinte, et brancher le renouvellement automatique.',
    file: 'novafact/Dockerfile',
    lessons: ['m17/l02', 'm14/l10'],
    hints: [
      'C’est la même question qu’en M18 pour les actions GitHub, posée à l’image de base.',
      'Une étiquette est un alias que son propriétaire peut repointer ; l’empreinte, elle, EST l’image.',
      'Remplace `node:20` par `node:20.18.1-bookworm-slim@sha256:…` (64 caractères hexadécimaux), sur chaque `FROM` qui vient d’un registre. Renovate renouvelle ensuite la ligne.',
    ],
    fix: 'Une étiquette est un alias qui bouge ; l’empreinte est l’image. Sans épinglage, ni la reproductibilité ni l’attestation de provenance ne veulent dire grand-chose.',
  },
  {
    id: 'dockerignore', module: 'm17', title: 'Tout le dépôt dans l’image',
    status: 'live', kind: 'fix', level: 1, csslp: ['D7'], cwe: 'CWE-538',
    brief: 'L’image copie la racine du dépôt sans exclusion : l’historique git, les fichiers d’environnement et le state IaC partent dedans.',
    goal: 'Restreindre ce qui entre dans l’image, et le vérifier sur l’image construite.',
    file: 'novafact/.dockerignore',
    lessons: ['m17/l02', 'm13/l07'],
    hints: [
      'Regarde ce que le `COPY` du Dockerfile englobe exactement, puis ce que `.dockerignore` retire vraiment.',
      'Trois choses n’ont rien à faire dans une image : l’historique git, les fichiers d’environnement, le state Terraform. Le dossier `.git` contient très souvent des identifiants — c’est le mécanisme d’ArtiPACKED.',
      'Deux corrections valent : compléter `.dockerignore`, ou mieux, remplacer `COPY . .` par des copies explicites de ce dont l’image a besoin. Ce qui n’est pas nommé n’entre pas.',
    ],
    fix: 'Le dossier git embarqué contient souvent des identifiants — c’est le mécanisme d’ArtiPACKED. Une liste d’exclusion, ou mieux, des copies explicites de ce dont l’image a besoin.',
  },
  {
    id: 'k8s-securitycontext', module: 'm17', title: 'Pod sans contexte de sécurité',
    status: 'live', kind: 'fix', level: 2, csslp: ['D7'], cwe: 'CWE-250',
    brief: 'Le déploiement ne déclare ni utilisateur non privilégié, ni interdiction d’élévation, ni système de fichiers en lecture seule, et partage le réseau de l’hôte.',
    goal: 'Poser le contexte complet et retirer le partage réseau, sans casser le démarrage.',
    file: 'novafact/infra/k8s/deployment.yaml',
    lessons: ['m17/l04', 'm16/l03'],
    hints: [
      'Les valeurs par défaut de Kubernetes sont permissives : ce qui n’est pas déclaré est accordé.',
      '`runAsNonRoot` se pose au niveau du pod ou du conteneur ; `allowPrivilegeEscalation` et `readOnlyRootFilesystem` n’existent qu’au niveau du conteneur — les poser sur le pod ne fait rien.',
      'Ajoute un `securityContext` de pod (`runAsNonRoot: true`, `runAsUser` non nul) et un `securityContext` de conteneur (`allowPrivilegeEscalation: false`, `readOnlyRootFilesystem: true`), retire `hostNetwork: true`, et monte un `emptyDir` sur `/tmp` pour que le démarrage survive à la racine en lecture seule.',
    ],
    fix: 'Les valeurs par défaut de Kubernetes sont permissives ; les standards de sécurité des pods existent pour les remplacer d’un bloc. Et une politique d’admission rend le durcissement obligatoire plutôt que recommandé.',
  },
  {
    id: 'k8s-rbac', module: 'm17', title: 'RBAC avec des jokers',
    status: 'live', kind: 'fix', level: 2, csslp: ['D7'], cwe: 'CWE-732',
    brief: 'Le compte de service de l’API a tous les verbes sur toutes les ressources, et le jeton est monté dans des pods qui n’en ont pas besoin.',
    goal: 'Énumérer les droits réellement nécessaires et couper le montage automatique du jeton.',
    file: 'novafact/infra/k8s/rbac.yaml',
    lessons: ['m17/l04', 'm15/l05'],
    hints: [
      'Deux gestes : refermer les droits, et cesser de distribuer le jeton.',
      'Remplacer `verbs: ["*"]` par la liste complète des verbes ne corrige rien : c’est la portée qui compte, pas l’écriture. Les trois champs `apiGroups`, `resources` et `verbs` doivent être énumérés.',
      'Nomme les ressources que l’API lit vraiment (sa ConfigMap, son bail d’élection) et mets `automountServiceAccountToken: false` — sur le compte de service, ou sur chaque pod qui l’utilise.',
    ],
    fix: 'Un jeton de compte de service monté dans un pod est un identifiant accessible à toute exécution de code dans ce pod. Le couper quand il ne sert pas est le geste le plus rentable du durcissement Kubernetes.',
  },
  {
    id: 'docker-socket', module: 'm17', title: 'Socket Docker monté dans le conteneur',
    status: 'live', kind: 'fix', level: 2, csslp: ['D7'], cwe: 'CWE-250',
    brief: 'Le service de construction monte le socket du démon et tourne en mode privilégié, et la base est exposée sur toutes les interfaces.',
    goal: 'Retirer le montage et le privilège, et lier la base à la boucle locale.',
    file: 'novafact/docker-compose.yml',
    lessons: ['m17/l04', 'm14/l03'],
    hints: [
      'Trois lignes, dans deux services : un volume, un drapeau, une publication de port.',
      'Le socket du démon équivaut à un accès root sur l’hôte : le monter, même en lecture seule, annule l’isolation qu’on croyait avoir.',
      'Retire le volume `/var/run/docker.sock` et `privileged: true` du service de construction — les tests d’intégration parlent à un démon rootless distant — et publie la base en `127.0.0.1:5432:5432`, ou pas du tout.',
    ],
    fix: 'Le socket du démon équivaut à un accès root sur l’hôte : le monter dans un conteneur annule l’isolation qu’on croyait avoir. C’est le scénario d’évasion le plus fréquent, et il est presque toujours mis là « pour faire tourner les tests ».',
  },
  {
    id: 'backup-immutable', module: 'm17', title: 'Sauvegardes qu’un attaquant peut effacer',
    status: 'live', kind: 'fix', level: 2, csslp: ['D7'], cwe: 'CWE-1188',
    brief: 'Les sauvegardes vivent dans le même compte, avec un rôle qui peut les supprimer, et aucune restauration n’a jamais été testée.',
    goal: 'Rendre les sauvegardes immuables et inter-comptes, et écrire le test de restauration.',
    file: 'novafact/infra/terraform/backup.tf',
    lessons: ['m17/l06', 'm15/l06'],
    hints: [
      'Le modèle de menace n’est pas la panne de disque, c’est l’attaquant qui a déjà le rôle de production. Relis le fichier en te demandant ce qu’il peut faire avec.',
      'Quatre propriétés manquent : l’immuabilité (verrou d’objet, qui exige le versioning), l’impossibilité d’effacer pour le rôle qui écrit, la copie dans un compte séparé, et la preuve que la restauration marche.',
      'Active `object_lock_enabled` et le versioning, ajoute un `aws_s3_bucket_object_lock_configuration` (et un `aws_backup_vault_lock_configuration` pour le coffre), remplace `s3:*` par les seules actions d’écriture, réplique vers un bucket d’un autre compte (`account = …` dans la destination) ou copie le coffre avec un `copy_action`, et planifie un `aws_backup_restore_testing_plan`.',
    ],
    fix: 'Un rançongiciel cloud commence par les sauvegardes : verrou d’immuabilité, copie dans un compte séparé dont le premier ne peut rien supprimer, et restauration testée — une sauvegarde jamais restaurée est une hypothèse, pas un plan.',
  },
  {
    id: 'signed-artifacts', module: 'm17', title: 'Publier en sécurité',
    status: 'live', kind: 'fix', level: 2, csslp: ['D7', 'D8'], cwe: 'CWE-345',
    brief: 'N’importe quelle image portant le bon nom part en production : rien ne vérifie qui l’a construite ni depuis quel commit.',
    goal: 'Signer les artefacts à la construction, et n’admettre au déploiement que ceux dont la signature est vérifiée.',
    file: 'novafact/.github/workflows/deploy.yml',
    lessons: ['m17/l03', 'm14/l10'],
    hints: [
      'Deux workflows sont concernés : celui qui construit, et celui qui déploie.',
      'La moitié qu’on oublie n’est pas la signature — c’est la vérification à l’admission.',
      'Signe l’image dans `release.yml`, et vérifie-la dans `deploy.yml` **avant** l’étape de déploiement.',
    ],
    fix: 'Signature à la construction, vérification à l’admission — sans la seconde, la première ne protège de rien. Et la chaîne de provenance doit dire quel commit, quel workflow, quel runner.',
  },
];

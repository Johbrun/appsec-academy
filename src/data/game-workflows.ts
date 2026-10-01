// Workflows du jeu « Workflow Audit » (M14), rattachés à l'OWASP Top 10 CI/CD Security Risks.
//
// Le jeu demande de cliquer les lignes dangereuses d'un workflow, puis de
// rattacher chacune à un risque. La difficulté ne vient pas de la rareté du
// risque — elle vient de ce qu'il faut **ne pas** signaler, et de la distance
// entre la ligne fautive et ce qui la rend dangereuse.
//
//   N1 · Un workflow court. Chaque ligne fautive se lit seule (write-all, une
//        action sur une branche, un secret en clair, un titre de ticket dans un
//        `run`), et rien d'autre dans le fichier ne ressemble à un défaut. On
//        apprend la forme des risques.
//
//   N2 · Un workflow de taille réelle, qui applique déjà de **bonnes
//        pratiques** qu'il ne faut pas signaler : actions épinglées par SHA,
//        OIDC, `pull_request_target` utilisé sans récupérer le code de la PR,
//        numéro de PR (un entier) interpolé, `add-mask`, environnement
//        protégé. Le défaut est à côté, et chaque faux positif coûte.
//
//   N3 · Le défaut n'est dangereux que par une **combinaison** de lignes ou
//        par un détail de contexte : un artefact produit par un fork et relu
//        dans un contexte privilégié, une condition sur `github.actor` qui a
//        l'air d'un contrôle, une politique de confiance OIDC qui a l'air
//        restreinte, un déclencheur sans environnement. Les lignes qui ont
//        l'air les plus inquiétantes sont souvent saines.

import type { AuditDecoy } from '../components/LineAudit';
import { defineSeries, type SeriesProfile } from '../lib/series';

export const cicdRisks: { id: number; name: string }[] = [
  { id: 1, name: 'Insufficient Flow Control Mechanisms' },
  { id: 2, name: 'Inadequate Identity and Access Management' },
  { id: 3, name: 'Dependency Chain Abuse' },
  { id: 4, name: 'Poisoned Pipeline Execution' },
  { id: 5, name: 'Insufficient PBAC' },
  { id: 6, name: 'Insufficient Credential Hygiene' },
  { id: 7, name: 'Insecure System Configuration' },
  { id: 8, name: 'Ungoverned Usage of 3rd Party Services' },
  { id: 9, name: 'Improper Artifact Integrity Validation' },
  { id: 10, name: 'Insufficient Logging and Visibility' },
];

export type WfIssue = { match: string; risks: number[]; text: string }; // risks[0] = réponse attendue, les autres sont acceptées
export type Workflow = {
  id: string;
  file: string;
  intro: string;
  code: string;
  issues: WfIssue[];
  level: 1 | 2 | 3;
  /** Lignes saines qui attirent l'œil, expliquées à la correction. */
  decoys?: AuditDecoy[];
  /** Coloration, si le fichier n'est pas un workflow YAML (politique de confiance OIDC en Terraform). */
  lang?: string;
  /** `externe` : le workflow traite une donnée ou du code venu de l'extérieur (fork, ticket, commentaire). */
  tags?: string[];
  avoid?: string[];
};

export const workflows: Workflow[] = [
  {
    id: 'pr-check',
    level: 2,
    tags: ['externe'],
    file: '.github/workflows/pr-check.yml',
    intro: 'Vérifie les PR du SDK public de Novafact, y compris celles des contributeurs externes, et répond aux commentaires « /bench ».',
    code: `name: pr-check
on:
  pull_request_target:
  issue_comment:
    types: [created]
permissions:
  contents: read
jobs:
  test:
    if: github.event_name == 'pull_request_target'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683
        with:
          ref: \${{ github.event.pull_request.head.sha }}
      - run: npm ci && npm test
        env:
          NPM_TOKEN: \${{ secrets.NPM_TOKEN }}
  bench:
    if: startsWith(github.event.comment.body, '/bench')
    runs-on: [self-hosted, linux]
    steps:
      - run: ./scripts/bench.sh "\${{ github.event.comment.body }}"`,
    issues: [
      { match: 'head.sha', risks: [4], text: 'pull_request_target s’exécute dans le contexte du dépôt de base ; récupérer le code de la PR puis lancer npm ci et npm test exécute du code externe avec les secrets. Utiliser pull_request pour tester le code non fiable.' },
      { match: 'NPM_TOKEN', risks: [6, 5], text: 'Un jeton de publication npm exposé à des tests de code externe. Les tests n’en ont pas besoin, et la publication devrait passer par le trusted publishing (OIDC), sans jeton long terme.' },
      { match: 'self-hosted', risks: [7], text: 'Un runner self-hosted persistant sur un dépôt public : n’importe quel commentateur peut y faire exécuter du code, qui survit entre les jobs. Réserver les runners self-hosted aux dépôts privés, et les rendre éphémères.' },
      { match: 'comment.body }}', risks: [4], text: 'Le corps du commentaire est interpolé dans une commande shell : injection de commande par n’importe quel utilisateur GitHub. Passer par une variable d’environnement et valider la valeur.' },
    ],
    decoys: [
      { match: 'contents: read', text: 'Des permissions réduites au minimum : c’est la bonne pratique. Elles n’empêchent pas l’exécution de code, mais elles limitent ce que le GITHUB_TOKEN permet ensuite.' },
      { match: "startsWith(github.event.comment.body, '/bench')", text: 'Dans une condition `if:`, l’expression est évaluée par GitHub, pas par un shell : lire le commentaire ici ne permet aucune injection. Le problème est deux lignes plus bas, dans le `run`.' },
    ],
  },
  {
    id: 'release',
    level: 1,
    file: '.github/workflows/release.yml',
    intro: 'Publie le paquet @novafact/sdk sur npm et l’image de l’API sur ECR à chaque tag.',
    code: `name: release
on:
  push:
    tags: ['v*']
permissions: write-all
jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: some-org/setup-toolchain@main
      - run: curl -sSL https://get.toolchain.example/install.sh | bash
      - run: npm ci && npm run build
      - run: npm publish --access public
        env:
          NODE_AUTH_TOKEN: \${{ secrets.NPM_TOKEN }}
      - run: |
          aws ecr get-login-password | docker login --username AWS --password-stdin $REGISTRY
          docker build -t $REGISTRY/api:\${GITHUB_REF_NAME} . && docker push $REGISTRY/api:\${GITHUB_REF_NAME}
        env:
          AWS_ACCESS_KEY_ID: \${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: \${{ secrets.AWS_SECRET_ACCESS_KEY }}`,
    issues: [
      { match: 'write-all', risks: [5], text: 'Toutes les permissions pour le GITHUB_TOKEN. Déclarer le minimum : contents: read, id-token: write pour l’OIDC.' },
      { match: 'setup-toolchain@main', risks: [3, 8], text: 'Une action tierce référencée par une branche : son auteur (ou quiconque le compromet) change le code exécuté dans ta release. Épingler par SHA de commit complet.' },
      { match: 'install.sh | bash', risks: [3, 9], text: 'Un script téléchargé et exécuté sans vérification d’intégrité, c’est le scénario Codecov. Épingler une version et vérifier une empreinte ou une signature.' },
      { match: 'npm publish', risks: [9, 6], text: 'Publication avec un jeton long terme, sans provenance. Le trusted publishing (OIDC) supprime le jeton et ajoute automatiquement l’attestation de provenance.' },
      { match: 'AWS_ACCESS_KEY_ID:', risks: [6], text: 'Des clés AWS longue durée stockées dans les secrets GitHub. L’OIDC vers un rôle IAM limité au dépôt et au tag donne des identifiants temporaires.' },
    ],
  },
  {
    id: 'deploy',
    level: 3,
    file: '.github/workflows/deploy.yml',
    intro: 'Déploie l’API en production, manuellement ou après la CI.',
    code: `name: deploy
on:
  workflow_dispatch:
    inputs:
      ref: { description: 'Référence à déployer', default: 'main' }
permissions:
  contents: read
  id-token: write
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683
        with: { ref: \${{ inputs.ref }} }
      - uses: aws-actions/configure-aws-credentials@e3dd6a429d7300a6a4c196c26e071d42e0343502
        with:
          role-to-assume: arn:aws:iam::111122223333:role/github-deploy-admin
          aws-region: eu-west-3
      - run: npm ci && npm audit --audit-level=critical
        continue-on-error: true
      - run: set -x && ./scripts/deploy.sh --db "$DATABASE_URL"
        env:
          DATABASE_URL: \${{ secrets.PROD_DATABASE_URL }}`,
    issues: [
      { match: 'workflow_dispatch:', risks: [1], text: 'Un déploiement en production déclenchable par tout collaborateur ayant l’accès en écriture, sans environnement protégé ni approbation : aucun contrôle de flux. Utiliser environment: production avec des relecteurs obligatoires.' },
      { match: 'ref: ${{ inputs.ref }}', risks: [1], text: 'N’importe quelle branche ou commit, même jamais relu, peut partir en production. Restreindre aux tags signés ou à la branche protégée.' },
      { match: 'github-deploy-admin', risks: [2, 5], text: 'Un rôle administrateur pour déployer une API. Le rôle assumé doit être limité aux actions de déploiement, et sa politique de confiance restreinte au dépôt, à l’environnement et à la branche.' },
      { match: 'continue-on-error', risks: [1], text: 'Le contrôle de sécurité ne peut jamais bloquer : il est contourné par construction.' },
      { match: 'set -x', risks: [6, 10], text: 'Le traçage shell affiche les commandes avec leurs arguments : l’URL de la base, mot de passe compris, peut finir dans les journaux sous une forme que le masquage de GitHub ne reconnaît pas.' },
    ],
    decoys: [
      { match: 'id-token: write', text: 'La permission qui permet d’obtenir un jeton OIDC et d’échanger contre des identifiants AWS temporaires : c’est ce qui remplace les clés longue durée. Le défaut est dans le rôle visé, pas dans le mécanisme.' },
    ],
  },
  {
    id: 'cache',
    level: 3,
    tags: ['externe'],
    avoid: ['pr-check'],
    file: '.github/workflows/preview.yml',
    intro: 'Construit une preview pour chaque PR et partage le cache npm avec le workflow de release.',
    code: `name: preview
on:
  pull_request_target:
    types: [opened, synchronize]
permissions:
  contents: read
  pull-requests: write
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683
        with: { ref: \${{ github.event.pull_request.head.ref }} }
      - uses: actions/cache@5a3ec84eff668545956fd18022155c47e93e2684
        with:
          path: ~/.npm
          key: npm-\${{ hashFiles('package-lock.json') }}
      - run: npm ci && npm run build
      - run: echo "Preview de la branche \${{ github.event.pull_request.head.ref }}"
      - uses: third-party/preview-deployer@v2
        with:
          token: \${{ secrets.PREVIEW_ADMIN_TOKEN }}`,
    issues: [
      { match: 'with: { ref: ${{ github.event.pull_request.head.ref }} }', risks: [4], text: 'pull_request_target + récupération de la branche de la PR + build : exécution de code externe dans un contexte privilégié.' },
      { match: 'actions/cache@', risks: [4, 9], text: 'Un cache écrit par un workflow qui exécute du code non fiable, puis relu par la release : c’est l’empoisonnement de cache utilisé contre Ultralytics fin 2024.' },
      { match: 'echo "Preview', risks: [4], text: 'Le nom de branche est choisi par l’auteur de la PR et interpolé dans le shell : injection de commande.' },
      { match: 'PREVIEW_ADMIN_TOKEN', risks: [8, 6], text: 'Un service tiers reçoit un jeton administrateur pour déployer des previews, dans un workflow qui exécute du code externe. Un jeton limité à l’environnement de preview, et un service tiers évalué et inventorié.' },
    ],
    decoys: [
      { match: "key: npm-${{ hashFiles('package-lock.json') }}", text: 'Une clé de cache calculée sur le lockfile est la pratique standard. Ce n’est pas la clé qui pose problème, c’est qui a le droit d’écrire le cache : ici, un workflow qui exécute le code d’un fork.' },
    ],
  },

  // ── N1 ────────────────────────────────────────────────────────────────────
  {
    id: 'triage',
    level: 1,
    tags: ['externe'],
    file: '.github/workflows/triage.yml',
    intro: 'Étiquette et annonce sur Slack chaque ticket ouvert sur le dépôt public du SDK. N’importe quel compte GitHub peut ouvrir un ticket.',
    code: `name: triage
on:
  issues:
    types: [opened]
permissions: write-all
jobs:
  label:
    runs-on: ubuntu-latest
    steps:
      - uses: acme-bots/issue-labeler@master
      - run: |
          echo "Nouveau ticket : \${{ github.event.issue.title }}"
          ./scripts/notify-slack.sh support`,
    issues: [
      { match: 'write-all', risks: [5], text: 'Étiqueter un ticket demande issues: write, rien d’autre. Avec write-all, la moindre exécution de code dans ce job peut pousser sur les branches, modifier les releases ou les workflows eux-mêmes.' },
      { match: 'issue-labeler@master', risks: [3, 8], text: 'Une action tierce suivie sur sa branche : le code exécuté change chaque fois que son auteur pousse, et il reçoit un jeton en écriture. Épingler par SHA de commit complet, après avoir lu le code.' },
      { match: 'issue.title', risks: [4], text: 'Le titre d’un ticket est écrit par n’importe qui. GitHub remplace l’expression avant que le shell ne lise la ligne : un titre contenant "; curl … | sh #" devient une commande. Passer la valeur par env: et l’utiliser entre guillemets ("$TITLE").' },
    ],
  },
  {
    id: 'nightly-kpis',
    level: 1,
    file: '.github/workflows/nightly-kpis.yml',
    intro: 'Chaque nuit, calcule les indicateurs de facturation sur la base de reporting et les poste sur Slack. Le dépôt est privé, mais toute l’équipe produit y a accès en lecture.',
    code: `name: nightly-kpis
on:
  schedule:
    - cron: '0 2 * * *'
permissions:
  contents: read
jobs:
  kpis:
    runs-on: ubuntu-latest
    env:
      DATABASE_URL: \${{ secrets.REPORTING_DATABASE_URL }}
      SLACK_WEBHOOK: https://hooks.slack.com/services/T04NOVA/B07KPIS/q8Xf2LmR9vTzW3
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683
      - run: echo "$DATABASE_URL" | base64
      - run: npm ci && node scripts/kpis.js > kpis.json
      - run: curl -fsS -X POST -d @kpis.json "$SLACK_WEBHOOK"`,
    issues: [
      { match: 'SLACK_WEBHOOK: https', risks: [6], text: 'L’URL d’un webhook Slack entrant est un secret : qui la connaît poste dans le canal au nom de l’intégration. Écrite dans le fichier, elle est dans l’historique Git pour toujours. La mettre dans les secrets, et la révoquer puisqu’elle a fuité.' },
      { match: '| base64', risks: [6, 10], text: 'GitHub masque dans les journaux la valeur exacte d’un secret, pas ses transformations : encodée en base64, l’URL de la base (mot de passe compris) s’affiche en clair pour tous les lecteurs du dépôt. Une ligne de débogage oubliée suffit.' },
    ],
  },
  {
    id: 'docker-latest',
    level: 1,
    file: '.github/workflows/docker.yml',
    intro: 'Construit l’image de l’API et la pousse sur le registre de conteneurs. La production redémarre sur ghcr.io/novafact/api:latest toutes les heures.',
    code: `name: docker
on:
  push:
    branches: ['**']
permissions:
  contents: read
  packages: write
jobs:
  image:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683
      - run: |
          docker build --build-arg NPM_TOKEN=\${{ secrets.NPM_TOKEN }} -t ghcr.io/novafact/api:latest .
          echo "$GHCR_TOKEN" | docker login ghcr.io -u novafact-ci --password-stdin
          docker push ghcr.io/novafact/api:latest
        env:
          GHCR_TOKEN: \${{ secrets.GITHUB_TOKEN }}`,
    issues: [
      { match: "branches: ['**']", risks: [1], text: 'Un push sur n’importe quelle branche, même jamais relue, produit l’image que la production charge dans l’heure. La branche protégée et la relecture ne servent plus à rien. Limiter à main (ou aux tags), et déployer par un environnement protégé.' },
      { match: '--build-arg NPM_TOKEN', risks: [6], text: 'Un argument de build est enregistré dans les métadonnées de l’image : docker history le montre à quiconque peut tirer l’image. Pour un secret de build, utiliser --secret (BuildKit), qui monte la valeur le temps d’une instruction RUN sans l’écrire dans une couche.' },
      { match: 'docker push ghcr.io/novafact/api:latest', risks: [9, 1], text: 'Une étiquette mutable, sans signature ni provenance : la production ne peut pas vérifier que l’image vient de main et de cette CI. Étiqueter par SHA de commit, signer (cosign, attestations) et déployer un digest.' },
    ],
  },
  {
    id: 'sdk-tests',
    level: 1,
    tags: ['externe'],
    avoid: ['pr-check'],
    file: '.github/workflows/sdk-tests.yml',
    intro: 'Lance les tests du SDK public sur chaque PR, forks compris, sur une machine de l’équipe plus rapide que les runners hébergés.',
    code: `name: sdk-tests
on:
  pull_request:
permissions:
  contents: read
jobs:
  test:
    runs-on: [self-hosted, linux, x64]
    env:
      ACTIONS_ALLOW_UNSECURE_COMMANDS: true
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683
      - run: npm ci && npm test`,
    issues: [
      { match: 'self-hosted', risks: [7], text: 'Un runner self-hosted persistant sur un dépôt public exécute le code de n’importe quel fork. C’est le chemin démontré par John Stawinski et Adnan Khan sur PyTorch (2024) : une petite contribution acceptée, puis les PR suivantes tournent sans approbation sur la machine, qui garde l’état entre les jobs. Runners hébergés pour les forks, ou runners éphémères isolés.' },
      { match: 'ACTIONS_ALLOW_UNSECURE_COMMANDS', risks: [7], text: 'Réactive les commandes set-env et add-path, désactivées par GitHub en 2020 (CVE-2020-15228) parce que tout texte affiché dans le journal pouvait redéfinir l’environnement des étapes suivantes. Écrire dans $GITHUB_ENV à la place.' },
    ],
  },

  // ── N2 ────────────────────────────────────────────────────────────────────
  {
    id: 'label-pr',
    level: 2,
    tags: ['externe'],
    file: '.github/workflows/label-pr.yml',
    intro: 'Étiquette les PR du SDK public selon les dossiers modifiés et vérifie que la description contient un changelog. Nous sommes le 14 mars 2025.',
    code: `name: label-pr
on:
  pull_request_target:
    types: [opened, synchronize]
permissions:
  contents: read
  pull-requests: write
jobs:
  label:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/labeler@8558fd74291d67161a8a78ce36a881fa63b766a9
      - uses: tj-actions/changed-files@v45
        id: changed
      - run: echo "PR n°\${{ github.event.pull_request.number }} : \${{ steps.changed.outputs.all_changed_files_count }} fichiers"
      - run: |
          echo "\${{ github.event.pull_request.body }}" | grep -q "Changelog:" \\
            || echo "::warning::Changelog manquant"`,
    issues: [
      { match: 'tj-actions/changed-files@v45', risks: [3, 8], text: 'Le cas tj-actions/changed-files (mars 2025, CVE-2025-30066) : l’attaquant a redirigé les tags existants, de v1 à v45.0.7, vers un commit qui affichait les secrets du runner dans le journal. Ce workflow l’aurait exécuté sans qu’une ligne change. Un tag est mutable, un SHA de commit ne l’est pas.' },
      { match: 'pull_request.body', risks: [4], text: 'La description de la PR est écrite par un inconnu, et l’expression est remplacée avant que le shell ne lise le script : injection de commande, dans un contexte pull_request_target qui a accès aux secrets. Passer la valeur par env:.' },
    ],
    decoys: [
      { match: 'pull_request_target:', text: 'Étiqueter une PR de fork demande un jeton en écriture : c’est l’usage prévu de pull_request_target. Il n’est dangereux que si le workflow récupère et exécute le code de la PR, ce que celui-ci ne fait pas.' },
      { match: 'actions/labeler@8558', text: 'Action épinglée par SHA de commit complet : c’est la bonne pratique, et celle qui manque à la ligne suivante.' },
      { match: 'pull_request.number', text: 'Le numéro de PR est un entier, et le nombre de fichiers aussi : ni l’un ni l’autre ne peut porter une commande. Toutes les expressions interpolées ne sont pas des injections, seulement celles dont un tiers choisit le texte.' },
    ],
  },
  {
    id: 'terraform',
    level: 2,
    file: '.github/workflows/terraform.yml',
    intro: 'Dépôt d’infrastructure privé, où tous les développeurs peuvent ouvrir une branche. Le plan est calculé sur chaque PR, l’application se fait après fusion sur main.',
    code: `name: terraform
on:
  pull_request:
    paths: ['infra/**']
  push:
    branches: [main]
    paths: ['infra/**']
permissions:
  contents: read
  id-token: write
jobs:
  plan:
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683
      - uses: aws-actions/configure-aws-credentials@e3dd6a429d7300a6a4c196c26e071d42e0343502
        with:
          role-to-assume: arn:aws:iam::111122223333:role/novafact-infra-admin
          aws-region: eu-west-3
      - run: terraform init && terraform plan -no-color -out plan.bin
      - run: terraform show -json plan.bin > plan.json
      - uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02
        with:
          name: plan
          path: plan.json
  apply:
    if: github.event_name == 'push'
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683
      - uses: aws-actions/configure-aws-credentials@e3dd6a429d7300a6a4c196c26e071d42e0343502
        with:
          role-to-assume: arn:aws:iam::111122223333:role/terraform-apply
          aws-region: eu-west-3
      - run: terraform init && terraform apply -auto-approve`,
    issues: [
      { match: 'role/novafact-infra-admin', risks: [5, 2], text: 'Le plan d’une branche non relue tourne avec un rôle administrateur, plus large encore que celui qui applique en production. Or terraform plan exécute du code : une source de données external, un provider ou un module modifié dans la PR. Un rôle de lecture seule pour le plan, et une politique de confiance qui réserve terraform-apply à l’environnement production.' },
      { match: 'path: plan.json', risks: [6], text: 'Le plan au format JSON contient les valeurs sensibles en clair (mots de passe, variables marquées sensitive), et un artefact se télécharge par tout lecteur du dépôt. Publier un résumé en commentaire de PR, jamais le plan brut.' },
    ],
    decoys: [
      { match: 'id-token: write', text: 'Permission OIDC : le workflow obtient des identifiants AWS temporaires sans clé stockée. C’est la bonne pratique ; ce qui compte est le rôle demandé par chaque job.' },
      { match: 'environment: production', text: 'Un environnement protégé devant l’application : les relecteurs obligatoires valident avant que le job ne reçoive ses secrets. C’est le contrôle de flux qui manque au job de plan.' },
      { match: 'role/terraform-apply', text: 'Le job d’application, derrière l’environnement protégé, assume le rôle prévu pour appliquer : c’est la bonne séparation. Le plan devrait avoir le sien, en lecture seule.' },
      { match: 'terraform apply -auto-approve', text: '-auto-approve saute la confirmation interactive, qui n’a pas de sens en CI. L’approbation humaine est portée par l’environnement protégé et par la relecture de la PR, pas par le prompt de Terraform.' },
    ],
  },
  {
    id: 'publish-sdk',
    level: 2,
    avoid: ['release'],
    file: '.github/workflows/publish-sdk.yml',
    intro: 'Publie @novafact/sdk sur npm à chaque release. Les outils de build internes, dont novafact-build-tools, sont hébergés sur le registre privé de Novafact.',
    code: `name: publish-sdk
on:
  release:
    types: [published]
permissions:
  contents: read
  id-token: write
jobs:
  publish:
    runs-on: ubuntu-latest
    environment: npm
    env:
      NODE_AUTH_TOKEN: \${{ secrets.NPM_TOKEN }}
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683
        with:
          persist-credentials: false
      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020
        with:
          node-version: 22
          registry-url: https://registry.npmjs.org
      - run: npm ci
      - run: npm install --no-save novafact-build-tools
      - run: npm run build && npm test
      - run: npm publish --provenance --access public`,
    issues: [
      { match: 'NODE_AUTH_TOKEN', risks: [6, 5], text: 'Déclaré au niveau du job, le jeton npm est visible de chaque étape, y compris des scripts d’installation de toutes les dépendances lancés par npm ci. Avec la publication de confiance (trusted publishing) de npm, l’OIDC suffit et le jeton disparaît ; à défaut, le limiter à l’étape de publication.' },
      { match: 'npm install --no-save novafact-build-tools', risks: [3], text: 'Un nom de paquet interne, sans portée (@novafact/…), résolu sur le registre public : quiconque y publie novafact-build-tools en version plus haute fait exécuter son code ici. C’est la confusion de dépendances décrite par Alex Birsan en 2021. Un paquet sous portée réservée, ou un .npmrc qui route ce nom vers le registre privé.' },
    ],
    decoys: [
      { match: 'persist-credentials: false', text: 'Empêche checkout d’écrire le GITHUB_TOKEN dans .git/config, où les étapes suivantes (et un artefact maladroit) pourraient le lire. Bonne pratique.' },
      { match: 'npm publish --provenance', text: 'La provenance attache au paquet une attestation signée qui relie la version publiée à ce dépôt et à ce workflow. C’est ce que la permission id-token: write sert à produire.' },
      { match: 'environment: npm', text: 'Un environnement dédié à la publication : on peut y exiger une approbation et y ranger le jeton, hors de portée des autres workflows.' },
    ],
  },
  {
    id: 'staging',
    level: 2,
    file: '.github/workflows/staging.yml',
    intro: 'Déploie l’API en préproduction après chaque fusion. Le job de déploiement réutilise un workflow maintenu par Acme Platform, le prestataire qui a monté le cluster ECS.',
    code: `name: staging
on:
  push:
    branches: [main]
permissions:
  contents: read
  id-token: write
jobs:
  build:
    uses: ./.github/workflows/build.yml
  deploy:
    needs: build
    uses: acme-platform/shared-workflows/.github/workflows/ecs-deploy.yml@main
    secrets: inherit
    with:
      cluster: novafact-staging
  smoke:
    needs: deploy
    runs-on: ubuntu-latest
    steps:
      - run: |
          TOKEN=$(curl -fsS -d "client_secret=$SMOKE_SECRET" https://auth.staging.novafact.example/token | jq -r .access_token)
          echo "::add-mask::$TOKEN"
          curl -fsS -H "Authorization: Bearer $TOKEN" https://api.staging.novafact.example/health
        env:
          SMOKE_SECRET: \${{ secrets.SMOKE_CLIENT_SECRET }}`,
    issues: [
      { match: 'ecs-deploy.yml@main', risks: [8, 3], text: 'Un workflow réutilisable d’une autre organisation, suivi sur sa branche : ce que fait le job de déploiement change quand le prestataire pousse, sans relecture chez Novafact. L’épingler par SHA, ou le reprendre dans le dépôt.' },
      { match: 'secrets: inherit', risks: [6, 5], text: 'inherit transmet au workflow appelé tous les secrets du dépôt : base de production, jeton npm, tout ce qui n’a rien à voir avec un déploiement en préproduction. Passer explicitement les seuls secrets nécessaires.' },
    ],
    decoys: [
      { match: 'uses: ./.github/workflows/build.yml', text: 'Un workflow réutilisable local s’exécute à la version du commit en cours : il a été relu avec le reste du dépôt. Rien à épingler.' },
      { match: 'add-mask', text: 'Le jeton est obtenu pendant le job : GitHub ne peut pas le connaître comme secret. add-mask l’ajoute au masquage des journaux avant sa première utilisation. Exactement ce qu’il faut faire.' },
    ],
  },

  // ── N3 ────────────────────────────────────────────────────────────────────
  {
    id: 'coverage-comment',
    level: 3,
    tags: ['externe'],
    file: '.github/workflows/coverage-comment.yml',
    intro: 'pr-tests.yml tourne sur pull_request (forks compris, sans secrets) et publie un artefact « coverage » : le rapport de couverture et le numéro de la PR. Ce second workflow le récupère pour commenter la PR.',
    code: `name: coverage-comment
on:
  workflow_run:
    workflows: [pr-tests]
    types: [completed]
permissions:
  contents: read
  pull-requests: write
  actions: read
jobs:
  comment:
    if: github.event.workflow_run.conclusion == 'success'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683
      - uses: actions/download-artifact@d3f86a106a0bac45b974a628896c90dbdf5c8093
        with:
          name: coverage
          run-id: \${{ github.event.workflow_run.id }}
          github-token: \${{ github.token }}
      - run: echo "PR_NUMBER=$(cat pr-number.txt)" >> "$GITHUB_ENV"
      - run: npm ci && node scripts/coverage-comment.js
        env:
          GH_TOKEN: \${{ github.token }}`,
    issues: [
      { match: 'uses: actions/download-artifact', risks: [9, 4], text: 'L’artefact a été produit par le code d’un fork, et il est décompressé sans path: à la racine de l’espace de travail, par-dessus le dépôt fraîchement récupéré. Il peut remplacer package.json ou scripts/coverage-comment.js, que l’étape suivante exécute avec les secrets. Le motif « pwn request » décrit par GitHub Security Lab en 2021 : décompresser dans un dossier à part et traiter le contenu comme une donnée.' },
      { match: '>> "$GITHUB_ENV"', risks: [4], text: 'Le contenu de pr-number.txt vient du fork. Écrit dans $GITHUB_ENV, un retour à la ligne suffit pour définir d’autres variables. GitHub refuse NODE_OPTIONS depuis 2023, pas BASH_ENV : il fait exécuter à chaque étape bash suivante un script, que le même artefact peut fournir. Valider que la valeur est un entier avant de l’écrire.' },
    ],
    decoys: [
      { match: 'workflow_run:', text: 'Séparer le test du code non fiable (pull_request, sans secrets) du commentaire (workflow_run, privilégié) est le schéma recommandé. Il ne tient que si le second workflow traite l’artefact comme une donnée hostile.' },
      { match: "conclusion == 'success'", text: 'Cette condition évite de commenter un échec ; ce n’est pas un contrôle de sécurité, mais elle ne crée pas de risque. Un fork contrôle son propre succès.' },
      { match: 'actions: read', text: 'Nécessaire pour lire les artefacts d’une autre exécution : c’est la permission minimale pour cette étape.' },
    ],
  },
  {
    id: 'oidc-trust',
    level: 3,
    lang: 'hcl',
    avoid: ['deploy'],
    file: 'infra/ci/github-oidc.tf',
    intro: 'Le rôle AWS que le workflow de déploiement en production assume par OIDC. L’organisation GitHub novafact compte 60 dépôts, dont des bacs à sable que tout membre peut créer.',
    code: `resource "aws_iam_openid_connect_provider" "github" {
  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]
}

data "aws_iam_policy_document" "deploy_trust" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }
    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:novafact/*"]
    }
  }
}

resource "aws_iam_role" "deploy_prod" {
  name               = "github-deploy-prod"
  assume_role_policy = data.aws_iam_policy_document.deploy_trust.json
}

data "aws_iam_policy_document" "deploy" {
  statement {
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }
  statement {
    actions   = ["ecs:UpdateService", "ecs:DescribeServices"]
    resources = [aws_ecs_service.api.id]
  }
}`,
    issues: [
      { match: 'values   = ["repo:novafact/*"]', risks: [2, 5], text: 'Le motif accepte n’importe quel dépôt de l’organisation, n’importe quelle branche, n’importe quel événement : un bac à sable créé la veille déploie en production. Depuis que des chercheurs ont trouvé en 2023 des rôles sans condition sub du tout, AWS refuse de créer une confiance GitHub sans sub, mais un joker passe ce garde-fou. Viser le dépôt et l’environnement : repo:novafact/api:environment:production, en StringEquals.' },
    ],
    decoys: [
      { match: 'variable = "token.actions.githubusercontent.com:aud"', text: 'La condition sur aud est nécessaire et correcte : elle vérifie que le jeton a été émis pour STS. Elle ne dit rien de qui le demande, c’est le rôle de sub.' },
      { match: 'resources = ["*"]', text: 'ecr:GetAuthorizationToken ne s’applique à aucune ressource particulière : AWS n’accepte que « * » pour cette action. Ce joker-là est imposé, et sans danger seul.' },
      { match: 'resources = [aws_ecs_service.api.id]', text: 'Des actions de déploiement restreintes au service de l’API : la politique d’autorisation est bien découpée. Le défaut est dans qui peut l’obtenir, pas dans ce qu’elle permet.' },
    ],
  },
  {
    id: 'dependabot-automerge',
    level: 3,
    tags: ['externe'],
    file: '.github/workflows/dependabot-automerge.yml',
    intro: 'Fusionne automatiquement les PR de Dependabot sur le SDK public. La branche main exige que la CI passe, mais pas de relecture pour ces PR.',
    code: `name: dependabot-automerge
on: pull_request_target
permissions:
  contents: write
  pull-requests: write
jobs:
  automerge:
    if: github.actor == 'dependabot[bot]'
    runs-on: ubuntu-latest
    steps:
      - run: gh pr merge --auto --squash "$PR_URL"
        env:
          PR_URL: \${{ github.event.pull_request.html_url }}
          GH_TOKEN: \${{ secrets.GITHUB_TOKEN }}`,
    issues: [
      { match: "github.actor == 'dependabot[bot]'", risks: [1, 4], text: 'github.actor désigne qui a déclenché le dernier événement, pas l’auteur de la PR. Synacktiv (2024) puis Boost Security (2025) ont montré comment faire pousser Dependabot sur la branche d’une PR d’attaquant : la condition devient vraie et le code de l’attaquant est fusionné. Tester github.event.pull_request.user.login, ou passer par dependabot/fetch-metadata, qui vérifie l’auteur.' },
      { match: 'gh pr merge --auto', risks: [1, 3], text: 'Toutes les mises à jour fusionnent sans regard humain, versions majeures comprises : un mainteneur compromis en amont arrive en production dès que la CI passe. Lire update-type avec dependabot/fetch-metadata et ne fusionner seul que les correctifs.' },
    ],
    decoys: [
      { match: 'PR_URL: ${{ github.event.pull_request.html_url }}', text: 'La valeur passe par une variable d’environnement et s’utilise entre guillemets : même contrôlée par un tiers, elle ne peut pas devenir une commande. C’est la forme correcte.' },
      { match: 'contents: write', text: 'Fusionner une PR demande contents: write et pull-requests: write : ces permissions sont le strict nécessaire pour ce job.' },
    ],
  },
];

// ── Les séries ──────────────────────────────────────────────────────────────

const mix = (n1: number, n2: number, n3: number): [number, number, number] => [n1, n2, n3];

const PROFILES: SeriesProfile<Workflow>[] = [
  { id: 'decouverte', title: 'Découverte', ids: ['triage', 'nightly-kpis', 'docker-latest'], level: 1,
    text: 'Des lignes fautives qui se lisent seules : write-all, une action sur une branche, un secret en clair.' },
  { id: 'mise-en-jambe', title: 'Mise en jambe', ids: ['sdk-tests', 'release', 'terraform'], level: 1,
    text: 'Le troisième workflow applique déjà de bonnes pratiques. Elles ne se signalent pas.' },
  { id: 'faux-amis', title: 'Faux amis', ids: ['label-pr', 'publish-sdk', 'staging'], level: 2,
    text: 'SHA épinglés, OIDC, pull_request_target sans checkout : le bon code côtoie le mauvais, et chaque faux positif coûte.' },
  { id: 'code-externe', title: 'Code venu d’ailleurs', ids: ['triage', 'pr-check', 'coverage-comment'], level: 2,
    text: 'Forks, tickets, commentaires : tout ce qu’un inconnu écrit et qu’un workflow lit. Du motif évident au contournement.' },
  { id: 'enchainements', title: 'Enchaînements', ids: ['terraform', 'coverage-comment', 'deploy'], level: 3,
    text: 'Un plan qui exécute du code, un artefact venu d’un fork, un déploiement sans environnement : le défaut tient à une combinaison de lignes.' },
  { id: 'expert', title: 'Expert', ids: ['cache', 'oidc-trust', 'dependabot-automerge'], level: 3,
    text: 'Les lignes les plus inquiétantes sont saines, et le défaut ressemble à un contrôle.' },
  { id: 'melee', title: 'Mêlée', mix: mix(1, 1, 1), level: 2, shuffleEachTime: true,
    text: 'Un workflow de chaque niveau, recomposée à chaque partie.' },
];

export const workflowSeries = defineSeries(workflows, PROFILES);

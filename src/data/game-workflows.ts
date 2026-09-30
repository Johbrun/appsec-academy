// Workflows du jeu « Workflow Audit » (M14), rattachés à l'OWASP Top 10 CI/CD Security Risks.

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
export type Workflow = { id: string; file: string; intro: string; code: string; issues: WfIssue[] };

export const workflows: Workflow[] = [
  {
    id: 'pr-check',
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
  },
  {
    id: 'release',
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
  },
  {
    id: 'cache',
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
  },
];

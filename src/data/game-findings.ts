// Findings du jeu « True or False Positive » (M13). La première raison est la bonne.
//
// Le joueur reçoit un finding d'un outil (SAST, secrets, relecteur ou agent IA)
// avec sa trace, tranche vrai/faux positif, puis choisit la justification.
//
// ── Les trois niveaux ────────────────────────────────────────────────────────
//
// La difficulté ne tient pas au sujet mais au nombre de sauts entre la trace et
// le verdict, et à la présence d'un sanitizer ou d'un garde qu'il faut évaluer.
//
//   N1 · Un indice décide, et il est visible dans l'extrait : concaténation nue,
//        eval sur une entrée, clé d'exemple connue. Le verdict tombe presque
//        sans lire la trace. On apprend à reconnaître la forme.
//
//   N2 · Au moins un leurre : un sanitizer maison qui couvre bien son contexte,
//        un commentaire rassurant faux, une raison partiellement juste. Il faut
//        lire le contexte pour trancher, et surtout pour justifier.
//
//   N3 · Le sanitizer présent **ne couvre pas le bon contexte** (échappement
//        HTML dans un attribut sans guillemets, décodage simple avant un sink
//        qui redécode), ou le chemin n'est atteignable que par une **route
//        oubliée** (un second handler qui rejoint le même sink sans le garde).
//        La bonne réponse dépend d'un détail qu'on ne voit qu'en suivant tout.
//
// Beaucoup de findings sont **ancrés dans un cas public** (`real`), nommé dans
// l'explication. La convention `reasons[0]` = bonne justification est vérifiée
// par `npm run games` ; ne pas la changer.

import { defineSeries, type SeriesProfile } from '../lib/series';

export type FindingLevel = 1 | 2 | 3;

export type Finding = {
  id: string;
  level: FindingLevel;
  tool: string;
  rule: string;
  message: string;
  file: string;
  lang: string;
  code: string;
  hl: string;
  trace?: string[];
  verdict: 'tp' | 'fp';
  reasons: string[];
  why: string;
  /** Cas public dont s'inspire le finding (nom, année) ; cité dans l'explication. */
  real?: string;
  /** Findings de même structure à ne pas réunir dans une série. */
  avoid?: string[];
};

export const findings: Finding[] = [
  // ── N1 ─────────────────────────────────────────────────────────────────────
  {
    id: 'raw-search', level: 1,
    tool: 'CodeQL',
    rule: 'js/sql-injection',
    message: 'Cette requête dépend d’une valeur fournie par l’utilisateur.',
    file: 'apps/api/src/routes/customers.ts',
    lang: 'ts',
    code: `router.get('/customers/search', async (req, res) => {
  const q = String(req.query.q ?? '').trim();
  if (q.length < 2) return res.json([]);
  const rows = await prisma.$queryRawUnsafe(
    "SELECT id, name FROM customers WHERE tenant_id = '" + tenantOf(req) + "' AND name ILIKE '%" + q + "%'",
  );
  res.json(rows);
});`,
    hl: '4-6',
    trace: ['source : req.query.q (ligne 2)', 'String(…).trim() → q (ligne 2)', 'concaténation (ligne 5)', 'sink : prisma.$queryRawUnsafe (ligne 4)'],
    verdict: 'tp',
    reasons: [
      'q est concaténé dans la requête de $queryRawUnsafe : trim et longueur ne filtrent rien',
      'Le motif ILIKE place q entre deux caractères pourcent, ce qui le confine à un littéral',
      'Refuser les chaînes de moins de deux caractères écarte les charges utiles minimales',
    ],
    why: 'Vrai positif. Correction : prisma.customer.findMany avec contains et mode insensitive, ou $queryRaw en template balisé, qui paramètre les valeurs.',
  },
  {
    id: 'aws-example-key', level: 1,
    tool: 'Gitleaks',
    rule: 'aws-access-token',
    message: 'Identifiant d’accès AWS détecté.',
    file: 'docs/runbooks/local-dev.md',
    lang: 'text',
    real: 'Clé d’exemple AWS',
    code: `Configure un profil local pour LocalStack :
  aws configure --profile localstack
  AWS Access Key ID: AKIAIOSFODNN7EXAMPLE
  AWS Secret Access Key: wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
Ces valeurs sont celles de la documentation AWS ; LocalStack accepte n'importe quelle clé.`,
    hl: '3-4',
    verdict: 'fp',
    reasons: [
      'Ce sont les identifiants d’exemple de la documentation AWS, liés à aucun compte',
      'Le secret figure dans un fichier de documentation, hors du périmètre de construction',
      'La clé pointe vers un point d’entrée LocalStack, donc vers un service local éphémère',
    ],
    why: 'Faux positif connu : AKIAIOSFODNN7EXAMPLE est la clé d’exemple officielle d’AWS, présente dans une foule de dépôts. Ajoute-la à la liste d’exceptions de Gitleaks plutôt que de désactiver la règle.',
  },
  {
    id: 'eval-config', level: 1,
    tool: 'Semgrep',
    rule: 'javascript.lang.security.detect-eval-with-expression',
    message: 'eval appelé sur une expression non littérale.',
    file: 'apps/api/src/routes/reports.ts',
    lang: 'ts',
    code: `router.post('/reports/preview', (req, res) => {
  const formula = req.body.formula;
  const value = eval(formula);
  res.json({ value });
});`,
    hl: '3',
    trace: ['source : req.body.formula (ligne 2)', 'sink : eval (ligne 3)'],
    verdict: 'tp',
    reasons: [
      'La formule du corps arrive telle quelle dans eval : exécution de code',
      'La valeur est convertie en nombre par eval, ce qui écarte les charges non arithmétiques',
      'eval s’exécute dans une portée locale, donc sans accès aux modules du serveur',
    ],
    why: 'Vrai positif direct : eval sur une entrée, c’est de l’exécution de code arbitraire. Pour évaluer une formule, un interpréteur restreint (expr-eval, mathjs en mode limité) sur une grammaire connue.',
  },
  {
    id: 'child-exec', level: 1,
    tool: 'CodeQL',
    rule: 'js/command-line-injection',
    message: 'Une commande shell dépend d’une valeur fournie par l’utilisateur.',
    file: 'apps/api/src/routes/backup.ts',
    lang: 'ts',
    code: `router.post('/backup', (req, res) => {
  const name = req.body.name;
  exec('pg_dump novafact > backups/' + name + '.sql', (err) => {
    res.sendStatus(err ? 500 : 200);
  });
});`,
    hl: '3',
    trace: ['source : req.body.name (ligne 2)', 'sink : exec (ligne 3)'],
    verdict: 'tp',
    reasons: [
      'name est interpolé dans une commande shell : un « ; » ouvre une seconde commande',
      'La redirection > écrit un fichier, ce qui limite l’effet à une écriture disque',
      'Le nom sert de nom de fichier, donc il est contraint par le système de fichiers',
    ],
    why: 'Vrai positif : exec passe par /bin/sh, donc les métacaractères sont interprétés. Utiliser execFile avec « pg_dump » et un tableau d’arguments (sans shell), et écrire le fichier via un flux Node avec un nom généré.',
  },
  {
    id: 'test-fixture-secret', level: 1,
    tool: 'Gitleaks',
    rule: 'generic-api-key',
    message: 'Clé d’API générique détectée.',
    file: 'apps/api/src/auth/__tests__/verify.test.ts',
    lang: 'ts',
    code: `describe('verifyToken', () => {
  const TEST_SECRET = 'test-secret-0000000000000000000000000000';
  it('rejette un jeton signé avec une autre clé', () => {
    const token = sign({ sub: 'u1' }, 'wrong-key');
    expect(() => verifyToken(token, TEST_SECRET)).toThrow();
  });
});`,
    hl: '2',
    verdict: 'fp',
    reasons: [
      'C’est une constante de test, jamais utilisée hors de la suite, faite de zéros',
      'Le secret est déclaré const, donc figé à la compilation et non modifiable',
      'Le fichier de test n’est pas embarqué dans l’image de production livrée',
    ],
    why: 'Faux positif : une valeur factice qui n’ouvre rien. Le second et le troisième arguments sont vrais mais hors sujet — ce qui compte, c’est que la clé ne protège aucune ressource. Marque le chemin __tests__ dans la config.',
  },
  {
    id: 'log-password', level: 1,
    tool: 'CodeQL',
    rule: 'js/clear-text-logging-of-sensitive-data',
    message: 'Une donnée sensible est écrite dans les journaux en clair.',
    file: 'apps/api/src/routes/login.ts',
    lang: 'ts',
    code: `router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  logger.info('tentative de connexion', { email, password });
  const user = await authenticate(email, password);
  res.json({ ok: Boolean(user) });
});`,
    hl: '3',
    trace: ['source : req.body.password (ligne 2)', 'sink : logger.info (ligne 3)'],
    verdict: 'tp',
    reasons: [
      'Le mot de passe part en clair dans les journaux, conservés et souvent centralisés',
      'logger.info reste sous le niveau warn, donc ce message est filtré en production',
      'L’objet passé est structuré, ce qui chiffre les champs sensibles à l’écriture',
    ],
    why: 'Vrai positif : un mot de passe en clair dans les journaux se retrouve dans le SIEM, les sauvegardes, l’écran d’un opérateur. Ne jamais journaliser le champ ; masquer ou l’omettre de l’objet.',
  },
  {
    id: 'dangerous-html', level: 1,
    tool: 'Semgrep',
    rule: 'javascript.react.security.audit.dangerouslysetinnerhtml',
    message: 'dangerouslySetInnerHTML reçoit une valeur non fiable.',
    file: 'apps/web/src/components/Bio.tsx',
    lang: 'tsx',
    code: `export function Bio() {
  const [params] = useSearchParams();
  const bio = params.get('bio') ?? '';
  return <div dangerouslySetInnerHTML={{ __html: bio }} />;
}`,
    hl: '4',
    trace: ['source : useSearchParams().get(\'bio\') (ligne 3)', 'sink : dangerouslySetInnerHTML (ligne 4)'],
    verdict: 'tp',
    reasons: [
      'La bio de l’URL est injectée en HTML brut : une balise à événement s’exécute',
      'React échappe le JSX, donc la valeur est neutralisée avant d’atteindre le DOM',
      'Le composant est rendu côté client, ce qui isole le HTML du serveur',
    ],
    why: 'Vrai positif : dangerouslySetInnerHTML contourne précisément l’échappement de React. Rendre le texte tel quel ({bio}), ou passer par DOMPurify si le HTML riche est nécessaire.',
  },
  {
    id: 'const-command', level: 1,
    tool: 'Semgrep',
    rule: 'javascript.lang.security.detect-child-process',
    message: 'Appel à child_process détecté.',
    file: 'apps/api/src/lib/version.ts',
    lang: 'ts',
    code: `import { execFileSync } from 'node:child_process';

export function gitRevision() {
  const out = execFileSync('git', ['rev-parse', '--short', 'HEAD']);
  return out.toString().trim();
}`,
    hl: '4',
    verdict: 'fp',
    reasons: [
      'Commande et arguments sont des littéraux constants : aucune entrée utilisateur',
      'execFileSync est synchrone, ce qui empêche l’injection concurrente d’arguments',
      'La sortie est convertie en chaîne puis coupée, donc assainie avant l’usage',
    ],
    why: 'Faux positif : la règle signale tout child_process, mais ici rien n’est contrôlé par l’utilisateur. C’est une règle « audit » à relire, pas une injection. Marque l’appel ou affine la règle pour ignorer les arguments constants.',
  },
  {
    id: 'ai-hardcoded', level: 1,
    tool: 'Relecteur IA',
    rule: 'Commentaire de revue automatique',
    message: '« Secret codé en dur : la clé Stripe est exposée dans le code source. »',
    file: 'apps/api/src/config/stripe.ts',
    lang: 'ts',
    code: `import Stripe from 'stripe';

const key = process.env.STRIPE_SECRET_KEY;
if (!key) throw new Error('STRIPE_SECRET_KEY manquante');

export const stripe = new Stripe(key);`,
    hl: '3',
    verdict: 'fp',
    reasons: [
      'La clé est lue depuis une variable d’environnement, jamais écrite dans le code',
      'Le nom de la variable contient « SECRET », ce qui la chiffre automatiquement',
      'Le throw empêche le démarrage, donc protège la clé d’une lecture',
    ],
    why: 'Faux positif : le relecteur a réagi au mot « key » près de « Stripe » sans voir process.env. La bonne réponse est simple ; les deux autres inventent des mécanismes qui n’existent pas. Cite la ligne 3 en réponse.',
  },

  // ── N2 ─────────────────────────────────────────────────────────────────────
  {
    id: 'sort-allowlist', level: 2,
    tool: 'Semgrep',
    rule: 'javascript.express.security.injection.tainted-sql-string',
    message: 'Une donnée de la requête est interpolée dans une chaîne SQL.',
    file: 'apps/api/src/routes/invoices-list.ts',
    lang: 'ts',
    avoid: ['sort-dir-concat'],
    code: `const Query = z.object({
  sort: z.enum(['issued_at', 'total_cents', 'number']).default('issued_at'),
  dir: z.enum(['asc', 'desc']).default('desc'),
});

router.get('/invoices', async (req, res) => {
  const { sort, dir } = Query.parse(req.query);
  const rows = await db.raw(
    \`SELECT id, number, total_cents FROM invoices WHERE tenant_id = $1 ORDER BY \${sort} \${dir}\`,
    [tenantOf(req)],
  );
  res.json(rows);
});`,
    hl: '9',
    trace: ['source : req.query (ligne 7)', 'Query.parse(req.query) → { sort, dir } (ligne 7)', 'sink : chaîne passée à db.raw (ligne 9)'],
    verdict: 'fp',
    reasons: [
      'sort et dir sortent d’un z.enum : la valeur interpolée est d’une liste fermée',
      'db.raw applique l’échappement des identifiants aux interpolations de type chaîne',
      'Le tenant étant un paramètre lié, la requête entière est préparée côté serveur',
    ],
    why: 'Les noms de colonnes ne peuvent pas être des paramètres liés ; une liste blanche est la bonne défense, et elle est là. La règle ne connaît pas z.enum : c’est l’occasion de déclarer ce sanitizer dans la règle maison.',
  },
  {
    id: 'escape-custom', level: 2,
    tool: 'CodeQL',
    rule: 'js/reflected-xss',
    message: 'Une valeur fournie par l’utilisateur est écrite dans la réponse HTML.',
    file: 'apps/api/src/routes/unsubscribe.ts',
    lang: 'ts',
    avoid: ['attr-unquoted'],
    code: `const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
   .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

router.get('/unsubscribe', (req, res) => {
  const email = String(req.query.email ?? '');
  res.type('html').send(\`<p>L’adresse <b>\${escapeHtml(email)}</b> ne recevra plus de relances.</p>\`);
});`,
    hl: '7',
    trace: ['source : req.query.email (ligne 6)', 'escapeHtml(email) (ligne 7)', 'sink : res.send (ligne 7)'],
    verdict: 'fp',
    reasons: [
      'La valeur est encodée pour le texte HTML, et le contexte est bien du texte entre balises',
      'res.type(\'html\') fixe le jeu de caractères, ce qui écarte les contournements par encodage',
      'Le format d’une adresse validée n’admet ni chevron ni guillemet dans la partie locale',
    ],
    why: 'Faux positif dans ce contexte (texte entre balises, où l’échappement des chevrons suffit). Deux actions : déclarer escapeHtml comme sanitizer (models as data), ou mieux, utiliser la fonction d’échappement de la bibliothèque de templates plutôt qu’une copie maison.',
  },
  {
    id: 'regexp', level: 2,
    tool: 'Semgrep',
    rule: 'javascript.lang.security.audit.detect-non-literal-regexp',
    message: 'RegExp construite à partir d’une valeur non littérale : risque de ReDoS.',
    file: 'apps/api/src/routes/products.ts',
    lang: 'ts',
    code: `router.get('/products', async (req, res) => {
  const pattern = new RegExp(String(req.query.q ?? ''), 'i');
  const products = await Product.find({ tenantId: tenantOf(req) }).lean();
  res.json(products.filter((p) => pattern.test(p.label)));
});`,
    hl: '2',
    trace: ['source : req.query.q (ligne 2)', 'sink : new RegExp (ligne 2)'],
    verdict: 'tp',
    reasons: [
      'Le motif vient de l’utilisateur : un retour arrière catastrophique gèle la boucle',
      'Le drapeau i ne porte que sur la casse, mais il force un parcours linéaire du sujet',
      'Le filtre s’applique en mémoire après la requête, donc en dehors du chemin de la base',
    ],
    why: 'Vrai positif : un seul motif pathologique sur des libellés longs gèle tout le processus Node. Correction : échapper la saisie (recherche littérale), ou utiliser une recherche textuelle côté base avec une limite de longueur.',
  },
  {
    id: 'redirect-startswith', level: 2,
    tool: 'Semgrep',
    rule: 'javascript.express.security.audit.express-open-redirect',
    message: 'Redirection vers une URL fournie par l’utilisateur.',
    file: 'apps/bff/src/routes/login.ts',
    lang: 'ts',
    code: `router.get('/login/callback', async (req, res) => {
  await completeLogin(req, res);
  const next = String(req.query.next ?? '/');
  // On n'autorise que les chemins relatifs du site
  if (!next.startsWith('/')) return res.redirect('/');
  res.redirect(next);
});`,
    hl: '5-6',
    trace: ['source : req.query.next (ligne 3)', 'garde : next.startsWith(\'/\') (ligne 5)', 'sink : res.redirect (ligne 6)'],
    verdict: 'tp',
    reasons: [
      'Une URL relative au schéma comme //externe.example commence elle aussi par une barre',
      'startsWith garantit que la chaîne est un chemin, donc interprétée dans l’origine courante',
      'Les navigateurs refusent une redirection inter-origine émise depuis une page authentifiée',
    ],
    why: 'Vrai positif malgré le commentaire rassurant. Correction : résoudre avec new URL(next, APP_URL), vérifier que l’origine est celle de l’application, ou n’accepter qu’une liste de destinations connues.',
  },
  {
    id: 'ai-jwt', level: 2,
    tool: 'Relecteur IA',
    rule: 'Commentaire de revue automatique',
    message: '« Critique : cette route ne vérifie pas le JWT. N’importe qui peut lister les exports. »',
    file: 'apps/api/src/routes/exports.ts',
    lang: 'ts',
    avoid: ['ai-middleware-order'],
    code: `import { Router } from 'express';
import { requireAccessToken } from '../auth/verifyAccessToken';

export const exportsRouter = Router();
exportsRouter.use(requireAccessToken({ scope: 'exports:read' }));

exportsRouter.get('/exports', async (req, res) => {
  res.json(await exportsRepo.list(tenantOf(req)));
});`,
    hl: '7-9',
    verdict: 'fp',
    reasons: [
      'Le routeur entier passe par requireAccessToken ligne 5 : la route en hérite',
      'Les exports comptables sont servis en lecture seule, donc hors du périmètre de la règle',
      'tenantOf lit le jeton et échouerait s’il n’était pas vérifié en amont',
    ],
    why: 'Faux positif, typique des relecteurs IA qui regardent la route sans le middleware monté au niveau du routeur. Réponds en citant la ligne 5 : un bon outil apprend de ces retours.',
  },
  {
    id: 'agent-idor', level: 2,
    tool: 'Agent de pentest IA',
    rule: 'Rapport : IDOR sur /api/invoices/:id',
    message: '« Vulnérabilité confirmée : en modifiant l’identifiant, l’agent a lu une autre facture (HTTP 200). »',
    file: 'rapport-agent.txt',
    lang: 'text',
    avoid: ['agent-scope'],
    code: `Session : agent-acme (tenant Acme)
GET /api/invoices/inv_acme_0042   → 200  {"id":"inv_acme_0042","tenant":"acme",...}
GET /api/invoices/inv_acme_0043   → 200  {"id":"inv_acme_0043","tenant":"acme",...}
GET /api/invoices/inv_globex_0001 → 404
Conclusion de l'agent : accès à une facture non sollicitée (0043), IDOR confirmée.`,
    hl: '3-5',
    verdict: 'fp',
    reasons: [
      'Les deux factures appartiennent au tenant de la session ; un autre tenant renvoie 404',
      'Deux identifiants consécutifs acceptés indiquent une énumération réussie',
      'L’absence de vérification de portée sur le jeton rend la lecture indifférente au rôle',
    ],
    why: 'Faux positif : lire une autre facture de son propre tenant est permis. Une preuve de BOLA exige deux tenants (ou deux utilisateurs aux droits différents) ; valide toujours la preuve d’un agent avant de créer un ticket.',
  },
  {
    id: 'jwt-alg-fixed', level: 2,
    tool: 'Semgrep',
    rule: 'javascript.jsonwebtoken.security.jwt-none-alg',
    message: 'jwt.verify sans contrainte d’algorithme : risque d’acceptation de alg: none.',
    file: 'apps/api/src/auth/verify.ts',
    lang: 'ts',
    code: `export function verifyAccessToken(token: string) {
  return jwt.verify(token, publicKey, {
    algorithms: ['RS256'],
    issuer: 'https://id.novafact.example',
    audience: 'novafact-api',
  });
}`,
    hl: '2-6',
    verdict: 'fp',
    reasons: [
      'algorithms est fixé à RS256 : un jeton alg: none ou HS256 est rejeté d’office',
      'La clé publique passée en second argument empêche toute vérification symétrique',
      'issuer et audience valident la provenance, ce qui couvre le risque signalé',
    ],
    why: 'Faux positif : la règle se déclenche sur jwt.verify mais l’option algorithms est justement présente et restrictive. La deuxième raison est fausse (une clé publique sert de secret HMAC en confusion d’algo) — c’est le fait de fixer algorithms qui tient. Affine la règle.',
  },
  {
    id: 'ssrf-allowlist', level: 2,
    tool: 'CodeQL',
    rule: 'js/request-forgery',
    message: 'Une requête sortante dépend d’une valeur fournie par l’utilisateur.',
    file: 'apps/api/src/routes/webhooks.ts',
    lang: 'ts',
    code: `const ALLOWED = new Set(['hooks.novafact.example', 'events.partner.example']);

router.post('/webhooks/test', async (req, res) => {
  const url = new URL(req.body.callbackUrl);
  if (url.protocol !== 'https:' || !ALLOWED.has(url.hostname)) return res.sendStatus(400);
  const r = await fetch(url, { redirect: 'manual' });
  res.json({ status: r.status });
});`,
    hl: '4-6',
    trace: ['source : req.body.callbackUrl (ligne 4)', 'garde : ALLOWED.has(url.hostname) (ligne 5)', 'sink : fetch (ligne 6)'],
    verdict: 'fp',
    reasons: [
      'L’hôte est validé contre une liste fermée et les redirections sont désactivées',
      'Le protocole https empêche à lui seul d’atteindre le service de métadonnées interne',
      'new URL rejette les adresses IP privées, ce qui bloque le réseau interne',
    ],
    why: 'Faux positif : liste blanche d’hôtes exacte plus redirect: manual, c’est le bon motif anti-SSRF. La deuxième raison est fausse (https n’empêche rien) et la troisième aussi (URL accepte les IP privées) — c’est l’allowlist qui protège. Déclare-la comme garde.',
  },
  {
    id: 'cors-credentials', level: 2,
    tool: 'Semgrep',
    rule: 'javascript.express.security.cors-misconfiguration',
    message: 'Origine CORS reflétée avec identifiants autorisés.',
    file: 'apps/api/src/middleware/cors.ts',
    lang: 'ts',
    code: `app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin ?? '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Vary', 'Origin');
  next();
});`,
    hl: '2-3',
    trace: ['source : req.headers.origin (ligne 2)', 'sink : Access-Control-Allow-Origin (ligne 2)', 'avec Allow-Credentials: true (ligne 3)'],
    verdict: 'tp',
    reasons: [
      'L’origine reçue est renvoyée avec les identifiants : tout site lit les réponses',
      'L’en-tête Vary: Origin corrige le comportement du cache et donc le risque CORS',
      'Le repli sur l’étoile s’applique seulement quand l’origine est absente, donc sans danger',
    ],
    why: 'Vrai positif : refléter l’origine avec Allow-Credentials revient à autoriser n’importe quel site à lire les réponses authentifiées. Vary ne fait que gérer le cache. Remplace par une liste blanche d’origines.',
  },
  {
    id: 'lodash-merge', level: 2,
    tool: 'Semgrep',
    rule: 'javascript.lodash.security.audit.prototype-pollution',
    message: 'lodash.merge appelé avec une valeur non fiable.',
    file: 'apps/api/src/routes/settings.ts',
    lang: 'ts',
    real: 'CVE-2019-10744 (lodash)',
    code: `import _ from 'lodash';

router.patch('/settings', (req, res) => {
  const current = loadSettings(tenantOf(req));
  const updated = _.merge(current, req.body);
  res.json(saveSettings(updated));
});`,
    hl: '5',
    trace: ['source : req.body (ligne 5)', 'sink : _.merge(current, req.body) (ligne 5)'],
    verdict: 'tp',
    reasons: [
      'merge fusionne récursivement une clé __proto__ ou constructor issue du corps JSON',
      'lodash filtre __proto__ depuis toujours, donc merge est sûr par défaut',
      'La cible current est un objet existant, ce qui empêche d’atteindre le prototype',
    ],
    why: 'Vrai positif : la famille merge/defaultsDeep de lodash a été vulnérable à la pollution de prototype (CVE-2019-10744, corrigée en 4.17.12, via le chemin constructor.prototype). Vérifie la version, et surtout valide req.body par un schéma strict avant la fusion.',
  },
  {
    id: 'deep-merge', level: 2,
    tool: 'CodeQL',
    rule: 'js/prototype-pollution-utility',
    message: 'Fonction de fusion récursive susceptible de polluer Object.prototype.',
    file: 'apps/api/src/lib/merge.ts',
    lang: 'ts',
    code: `export function deepMerge(target: any, source: any) {
  for (const key of Object.keys(source)) {
    if (typeof source[key] === 'object' && source[key] !== null) {
      target[key] ??= {};
      deepMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

// apps/api/src/routes/settings.ts
router.patch('/settings', (req, res) => res.json(deepMerge(loadSettings(tenantOf(req)), req.body)));`,
    hl: '2-5',
    trace: ['source : req.body (ligne 14)', 'deepMerge(…, req.body) (ligne 14)', 'target[key] avec key = "__proto__" (ligne 4-5)'],
    verdict: 'tp',
    reasons: [
      'JSON.parse crée une clé __proto__ que la fusion suit jusqu’au prototype',
      'La fusion n’écrit que sur des clés propres énumérables, ce qu’__proto__ n’est pas',
      'Le typage any désactive les vérifications, mais la cible reste un littéral neuf',
    ],
    why: 'Vrai positif : le corps JSON est une source directe. Correction : refuser __proto__, constructor et prototype, fusionner vers Object.create(null), et surtout valider le corps avec un schéma strict (M3).',
  },
  {
    id: 'path-resolve', level: 2,
    tool: 'CodeQL',
    rule: 'js/path-injection',
    message: 'Ce chemin dépend d’une valeur fournie par l’utilisateur.',
    file: 'apps/api/src/routes/attachments.ts',
    lang: 'ts',
    avoid: ['double-decode'],
    code: `const ROOT = path.resolve('/srv/attachments');

router.get('/attachments/:name', async (req, res) => {
  const dir = path.join(ROOT, tenantOf(req));
  const target = path.resolve(dir, req.params.name);
  if (!target.startsWith(dir + path.sep)) return res.sendStatus(400);
  res.sendFile(target);
});`,
    hl: '5-7',
    trace: ['source : req.params.name (ligne 5)', 'path.resolve (ligne 5)', 'garde : startsWith(dir + sep) (ligne 6)', 'sink : res.sendFile (ligne 7)'],
    verdict: 'fp',
    reasons: [
      'Le chemin est résolu puis confiné au dossier du tenant, séparateur compris',
      'Express décode et normalise req.params, ce qui retire les segments de remontée',
      'sendFile refuse par défaut les chemins qui sortent de la racine déclarée',
    ],
    why: 'Faux positif : c’est le motif correct — résoudre d’abord, puis vérifier le préfixe avec le séparateur, sur le résultat final. Le garde couvre bien le sink (à comparer avec le cas où l’on filtre avant de décoder). Certaines versions de la requête reconnaissent ce garde ; sinon, une annotation justifiée.',
  },

  {
    id: 'ai-json-xss', level: 2,
    tool: 'Relecteur IA',
    rule: 'Commentaire de revue automatique',
    message: '« XSS réfléchi : le paramètre de recherche est renvoyé sans échappement dans la réponse. »',
    file: 'apps/api/src/routes/search.ts',
    lang: 'ts',
    code: `router.get('/search', async (req, res) => {
  const q = String(req.query.q ?? '');
  const results = await search(tenantOf(req), q);
  res.json({ query: q, results });
});`,
    hl: '4',
    verdict: 'fp',
    reasons: [
      'res.json fixe le type application/json, non interprété comme du HTML',
      'La valeur est renvoyée telle quelle, donc une balise s’exécute chez le client',
      'search échappe le terme avant de le renvoyer dans l’objet results',
    ],
    why: 'Faux positif : un XSS réfléchi suppose que la valeur soit rendue en HTML. Ici res.json fixe le type application/json et le navigateur ne l’exécute pas. Attention toutefois : si un front réinjecte q dans le DOM sans échappement, le risque revient côté client.',
  },

  // ── N3 ─────────────────────────────────────────────────────────────────────
  {
    id: 'attr-unquoted', level: 3,
    tool: 'CodeQL',
    rule: 'js/reflected-xss',
    message: 'Une valeur fournie par l’utilisateur est écrite dans la réponse HTML.',
    file: 'apps/api/src/routes/badge.ts',
    lang: 'ts',
    avoid: ['escape-custom'],
    code: `const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
   .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

router.get('/badge.svg', (req, res) => {
  const color = escapeHtml(String(req.query.color ?? 'grey'));
  res.type('html').send(\`<svg><rect class=badge fill=\${color} /></svg>\`);
});`,
    hl: '7',
    trace: ['source : req.query.color (ligne 6)', 'escapeHtml(color) (ligne 6)', 'sink : attribut sans guillemets (ligne 7)'],
    verdict: 'tp',
    reasons: [
      'fill n’a pas de guillemets : escapeHtml n’encode ni l’espace ni le signe égal',
      'La valeur passe par escapeHtml, donc tous les caractères dangereux sont neutralisés',
      'Le type SVG servi en HTML n’exécute aucun gestionnaire d’événement',
    ],
    why: 'Vrai positif malgré le sanitizer : escapeHtml couvre le texte et les attributs entre guillemets, pas un attribut nu. « grey onload=alert(1) » ajoute un attribut, car l’espace n’est pas encodé. Toujours mettre les attributs entre guillemets, et encoder pour le bon contexte.',
  },
  {
    id: 'marked-nosanitize', level: 3,
    tool: 'Semgrep',
    rule: 'javascript.marked.security.audit.marked-unsanitized',
    message: 'La sortie de marked() est injectée dans le DOM sans assainissement.',
    file: 'apps/web/src/components/Comment.tsx',
    lang: 'tsx',
    real: 'Option sanitize de marked (dépréciée)',
    code: `import { marked } from 'marked';

export function Comment({ body }: { body: string }) {
  // sanitize retiré de marked, on garde la conversion Markdown
  const html = marked.parse(body, { async: false });
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}`,
    hl: '5-6',
    trace: ['source : body (commentaire utilisateur, ligne 4)', 'marked.parse(body) → html (ligne 5)', 'sink : dangerouslySetInnerHTML (ligne 6)'],
    verdict: 'tp',
    reasons: [
      'marked convertit le Markdown sans assainir le HTML : une balise à événement survit',
      'marked échappe le HTML brut par défaut, ce qui suffit à neutraliser le corps',
      'La conversion Markdown ne produit que des balises de mise en forme, jamais de script',
    ],
    why: 'Vrai positif : marked ne nettoie pas la sortie (l’option sanitize a été dépréciée puis retirée). Un [lien](javascript:…) ou du HTML brut passe. Il faut assainir la sortie avec DOMPurify avant de l’injecter.',
  },
  {
    id: 'forgotten-route', level: 3,
    tool: 'CodeQL',
    rule: 'js/sql-injection',
    message: 'Une requête dépend d’une valeur fournie par l’utilisateur.',
    file: 'apps/api/src/routes/invoices.ts',
    lang: 'ts',
    code: `function invoicesBySort(sort: string) {
  // appelé par la route publique avec un sort validé…
  return db.raw(\`SELECT * FROM invoices ORDER BY \${sort}\`);
}

router.get('/invoices', (req, res) => {
  const sort = z.enum(['issued_at', 'number']).parse(req.query.sort);
  res.json(invoicesBySort(sort));
});

// apps/api/src/routes/admin/invoices.ts
adminRouter.get('/export', (req, res) => res.json(invoicesBySort(String(req.query.orderBy))));`,
    hl: '3-13',
    trace: ['route publique : sort validé par z.enum (ligne 7)', 'route admin : req.query.orderBy brut (ligne 13)', 'sink partagé : invoicesBySort → db.raw (ligne 3)'],
    verdict: 'tp',
    reasons: [
      'La route admin passe un orderBy brut au même helper, sans le z.enum',
      'Le helper n’est atteint que par la route publique, où sort est déjà validé',
      'La route admin exige une session, ce qui suffit à écarter une injection',
    ],
    why: 'Vrai positif : l’assainissement vit dans une route, pas dans le sink. Une seconde route (l’export admin) rejoint le même db.raw sans valider. Valide au plus près du sink, ou fais accepter au helper une colonne d’une liste fermée.',
  },
  {
    id: 'double-decode', level: 3,
    tool: 'Semgrep',
    rule: 'javascript.express.security.audit.path-traversal',
    message: 'Un chemin de fichier dépend d’une valeur fournie par l’utilisateur.',
    file: 'apps/api/src/routes/files.ts',
    lang: 'ts',
    avoid: ['path-resolve'],
    code: `router.get('/files', (req, res) => {
  let name = String(req.query.name ?? '');
  name = name.replace(/\\.\\.\\//g, '');       // retire les ../
  name = decodeURIComponent(name);          // puis décode
  res.sendFile(path.join(ROOT, name));
});`,
    hl: '3-5',
    trace: ['source : req.query.name (ligne 2)', 'garde : replace(/\\.\\.\\//g) (ligne 3)', 'decodeURIComponent APRÈS le garde (ligne 4)', 'sink : path.join + sendFile (ligne 5)'],
    verdict: 'tp',
    reasons: [
      'Le filtre retire les ../ avant le décodage : %2e%2e%2f redevient ../ juste après',
      'La suppression des ../ est globale, donc aucune séquence de remontée ne subsiste',
      'path.join normalise le chemin, ce qui neutralise ce qui reste après le filtre',
    ],
    why: 'Vrai positif : l’ordre des opérations trahit le garde. On filtre puis on décode, si bien que « %2e%2e%2f » échappe au filtre et redevient « ../ » ensuite. Résoudre le chemin final et vérifier qu’il reste sous ROOT, après tout décodage.',
  },
  {
    id: 'sort-dir-concat', level: 3,
    tool: 'Semgrep',
    rule: 'javascript.express.security.injection.tainted-sql-string',
    message: 'Une donnée de la requête est interpolée dans une chaîne SQL.',
    file: 'apps/api/src/routes/ledger.ts',
    lang: 'ts',
    avoid: ['sort-allowlist'],
    code: `const SORTS = ['date', 'amount', 'ref'];

router.get('/ledger', (req, res) => {
  const sort = SORTS.includes(String(req.query.sort)) ? req.query.sort : 'date';
  const dir = req.query.dir === 'asc' ? 'ASC' : String(req.query.dir);
  res.json(db.raw(\`SELECT * FROM ledger ORDER BY \${sort} \${dir}\`));
});`,
    hl: '5-6',
    trace: ['sort : validé contre SORTS (ligne 4)', 'dir : sinon String(req.query.dir) brut (ligne 5)', 'sink : db.raw (ligne 6)'],
    verdict: 'tp',
    reasons: [
      'Seul « asc » donne ASC : toute autre valeur de dir part brute dans le SQL',
      'sort et dir sont tous deux validés contre une liste, donc la requête est sûre',
      'ORDER BY n’accepte que des identifiants, ce qui empêche toute injection utile',
    ],
    why: 'Vrai positif : le sanitizer couvre sort mais pas dir. La branche « sinon » recopie req.query.dir tel quel, donc « asc; DROP … » y passe. Valider dir contre une liste fermée aussi, comme sort.',
  },
  {
    id: 'path-to-regexp', level: 3,
    tool: 'CodeQL',
    rule: 'js/redos',
    message: 'Le motif de route peut générer une expression à retour arrière (ReDoS).',
    file: 'apps/bff/src/routes/index.ts',
    lang: 'ts',
    real: 'CVE-2024-45296 (path-to-regexp)',
    code: `// package.json : "path-to-regexp": "0.1.13"
import express from 'express';
const router = express.Router();

// deux paramètres dans un même segment, séparés par un tiret
router.get('/range/:from-:to', handler);`,
    hl: '6',
    trace: ['motif : /range/:from-:to (deux params, un segment)', 'compilé par path-to-regexp 0.1.13'],
    verdict: 'fp',
    reasons: [
      'path-to-regexp ≥ 0.1.10 ajoute une protection anti-backtracking sur ce motif',
      'Un tiret sépare deux paramètres, ce qui empêche par nature tout chevauchement',
      'Express met les motifs de route en cache, donc la regex n’est compilée qu’une fois',
    ],
    why: 'Faux positif sur cette version : le motif /:from-:to était vulnérable (CVE-2024-45296), corrigé en 0.1.10 pour la branche 0.1.x et en 8.0.0. La version 0.1.13 ajoute la protection quand aucun motif custom n’est fourni. Le finding serait un vrai positif sur ≤ 0.1.7.',
  },
  {
    id: 'agent-scope', level: 3,
    tool: 'Agent de pentest IA',
    rule: 'Rapport : accès inter-tenant sur /api/invoices/:id',
    message: '« L’agent a lu une facture d’un autre tenant après avoir changé l’identifiant. »',
    file: 'rapport-agent.txt',
    lang: 'text',
    avoid: ['agent-idor'],
    code: `Session : agent-acme (tenant Acme, rôle viewer)
GET /api/invoices/inv_acme_0042   → 200  {"tenant":"acme",...}
GET /api/invoices/inv_globex_0007 → 200  {"tenant":"globex","total":94200,...}
Le corps renvoyé porte tenant:"globex", différent de la session (acme).`,
    hl: '3-4',
    verdict: 'tp',
    reasons: [
      'La réponse 200 porte un autre tenant que la session : cloisonnement franchi',
      'Deux identifiants acceptés prouvent seulement que l’énumération fonctionne',
      'Le rôle viewer autorise la lecture, donc l’accès est conforme aux droits',
    ],
    why: 'Vrai positif, à la différence du rapport « même tenant » : ici le corps renvoyé appartient à Globex alors que la session est Acme. La preuve inter-tenant est solide. Correction : contraindre la requête au tenant du jeton (WHERE tenant_id = …).',
  },
  {
    id: 'ai-middleware-order', level: 3,
    tool: 'Relecteur IA',
    rule: 'Commentaire de revue automatique',
    message: '« La route /admin/users est bien protégée : requireAdmin est monté sur l’app. »',
    file: 'apps/api/src/app.ts',
    lang: 'ts',
    avoid: ['ai-jwt'],
    code: `const app = express();

app.get('/admin/users', (req, res) => res.json(listAllUsers()));

app.use(requireAdmin);           // monté APRÈS la route ci-dessus
app.get('/admin/settings', (req, res) => res.json(getSettings()));`,
    hl: '3-5',
    trace: ['route /admin/users définie ligne 3', 'app.use(requireAdmin) monté ligne 5', 'Express applique les middlewares dans l’ordre de déclaration'],
    verdict: 'tp',
    reasons: [
      'requireAdmin est monté après /admin/users : il ne s’applique donc pas à cette route',
      'app.use protège toutes les routes du fichier, quel que soit leur ordre de déclaration',
      'La route liste des utilisateurs en lecture seule, donc hors du périmètre admin',
    ],
    why: 'Vrai positif : le relecteur a vu le middleware sans voir l’ordre. Express applique les handlers dans l’ordre d’enregistrement, donc /admin/users, défini avant app.use(requireAdmin), n’est pas protégé. Monter le garde avant les routes, ou l’attacher à un routeur.',
  },
  {
    id: 'js-in-attr', level: 3,
    tool: 'CodeQL',
    rule: 'js/reflected-xss',
    message: 'Une valeur fournie par l’utilisateur est écrite dans la réponse HTML.',
    file: 'apps/api/src/routes/list.ts',
    lang: 'ts',
    avoid: ['attr-unquoted', 'escape-custom'],
    code: `const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
   .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

router.get('/row', (req, res) => {
  const id = escapeHtml(String(req.query.id ?? ''));
  res.type('html').send(\`<button onclick="removeItem('\${id}')">Supprimer</button>\`);
});`,
    hl: '7',
    trace: ['source : req.query.id (ligne 6)', 'escapeHtml(id) (ligne 6)', 'sink : contexte JavaScript dans onclick (ligne 7)'],
    verdict: 'tp',
    reasons: [
      'onclick est du JavaScript : &#39; y est décodé en apostrophe, rouvrant la chaîne',
      'escapeHtml encode l’apostrophe en &#39;, donc la chaîne JavaScript ne peut plus être fermée',
      'L’identifiant provient d’une liste, il ne contient que des chiffres et un tiret',
    ],
    why: 'Vrai positif : double contexte HTML puis JavaScript. Le parseur HTML décode &#39; en apostrophe au moment de lire l’attribut, avant que le moteur JS ne lise la chaîne : une apostrophe suivie de « );alert(1)// » ferme l’argument et s’exécute. Il faut un échappement JavaScript (JSON.stringify) à l’intérieur du gestionnaire, pas un échappement HTML.',
  },
];

// ── Les séries ──────────────────────────────────────────────────────────────

const mix = (n1: number, n2: number, n3: number): [number, number, number] => [n1, n2, n3];

const PROFILES: SeriesProfile<Finding>[] = [
  { id: 'premier-tri', title: 'Premier tri', mix: mix(6, 0, 0), level: 1,
    text: 'Un indice décide, visible dans l’extrait : concaténation nue, eval, clé d’exemple. On apprend à reconnaître la forme.' },
  { id: 'sast-du-jour', title: 'La file du matin', mix: mix(4, 2, 0), level: 1,
    text: 'Des findings faciles, avec deux cas où il faut lire un peu : un sanitizer présent, un secret factice.' },
  { id: 'lecture-attentive', title: 'Lecture attentive', mix: mix(0, 6, 0), level: 2,
    text: 'Chaque finding porte un leurre : un garde qui couvre bien son contexte, un commentaire faux, une raison à moitié vraie.' },
  { id: 'faux-amis', title: 'Faux amis', mix: mix(1, 4, 1), level: 2,
    text: 'Le verdict semble évident et la justification ne l’est pas : deux des trois raisons sont défendables.' },
  { id: 'mauvais-contexte', title: 'Le sanitizer ne suffit pas', mix: mix(0, 2, 4), level: 3,
    text: 'Le garde est là mais couvre le mauvais contexte, ou ne s’applique qu’à un décodage sur deux. Il faut suivre la donnée.' },
  { id: 'route-oubliee', title: 'La route oubliée', mix: mix(0, 0, 6), level: 3,
    text: 'Que du niveau 3 : le chemin dangereux passe par un handler secondaire, ou le sink est atteint après le garde.' },
  { id: 'revue-ia', title: 'Revue par l’IA', filter: (f) => f.tool.includes('IA'), level: 2,
    text: 'Relecteurs et agents de pentest IA : leurs findings sont plausibles mais lisent souvent la route sans son middleware, ou une preuve sans son périmètre.' },
  { id: 'melee', title: 'Mêlée', mix: mix(2, 2, 2), level: 2, shuffleEachTime: true,
    text: 'Tous niveaux et tous outils confondus, recomposée à chaque partie. La seule série qu’on ne peut pas réviser.' },
];

export const findingSeries = defineSeries(findings, PROFILES);

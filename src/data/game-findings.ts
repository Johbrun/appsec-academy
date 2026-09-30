// Findings du jeu « True or False Positive » (M13). La première raison est la bonne.

export type Finding = {
  id: string;
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
};

export const findings: Finding[] = [
  {
    id: 'sort-allowlist',
    tool: 'Semgrep',
    rule: 'javascript.express.security.injection.tainted-sql-string',
    message: 'Une donnée de la requête est interpolée dans une chaîne SQL.',
    file: 'apps/api/src/routes/invoices-list.ts',
    lang: 'ts',
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
    id: 'raw-search',
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
      'q est concaténé dans la chaîne exécutée par $queryRawUnsafe : trim et longueur ne filtrent rien',
      'Le motif ILIKE place q entre deux caractères pourcent, ce qui le confine à un littéral',
      'Refuser les chaînes de moins de deux caractères écarte les charges utiles minimales',
    ],
    why: 'Vrai positif. Correction : prisma.customer.findMany avec contains et mode insensitive, ou $queryRaw en template balisé, qui paramètre les valeurs.',
  },
  {
    id: 'escape-custom',
    tool: 'CodeQL',
    rule: 'js/reflected-xss',
    message: 'Une valeur fournie par l’utilisateur est écrite dans la réponse HTML.',
    file: 'apps/api/src/routes/unsubscribe.ts',
    lang: 'ts',
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
      'La valeur est encodée pour le texte HTML ; l’outil ignore ce sanitizer maison',
      'res.type(\'html\') fixe le jeu de caractères, ce qui écarte les contournements par encodage',
      'Le format d’une adresse validée n’admet ni chevron ni guillemet dans la partie locale',
    ],
    why: 'Faux positif dans ce contexte (texte entre balises). Deux actions : déclarer escapeHtml comme sanitizer (models as data), ou mieux, utiliser la fonction d’échappement de la bibliothèque de templates plutôt qu’une copie maison.',
  },
  {
    id: 'regexp',
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
      'Le motif vient de l’utilisateur : un retour arrière catastrophique gèle la boucle d’événements',
      'Le drapeau i ne porte que sur la casse, mais il force un parcours linéaire du sujet',
      'Le filtre s’applique en mémoire après la requête, donc en dehors du chemin de la base',
    ],
    why: 'Vrai positif : un seul motif pathologique sur des libellés longs gèle tout le processus Node. Correction : échapper la saisie (recherche littérale), ou utiliser une recherche textuelle côté base avec une limite de longueur.',
  },
  {
    id: 'redirect-startswith',
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
    id: 'ai-jwt',
    tool: 'Relecteur IA',
    rule: 'Commentaire de revue automatique',
    message: '« Critique : cette route ne vérifie pas le JWT. N’importe qui peut lister les exports. »',
    file: 'apps/api/src/routes/exports.ts',
    lang: 'ts',
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
    id: 'path-resolve',
    tool: 'CodeQL',
    rule: 'js/path-injection',
    message: 'Ce chemin dépend d’une valeur fournie par l’utilisateur.',
    file: 'apps/api/src/routes/attachments.ts',
    lang: 'ts',
    code: `const ROOT = path.resolve('/srv/attachments');

router.get('/attachments/:name', async (req, res) => {
  const dir = path.join(ROOT, tenantOf(req));
  const target = path.resolve(dir, req.params.name);
  if (!target.startsWith(dir + path.sep)) return res.sendStatus(400);
  res.sendFile(target);
});`,
    hl: '5-7',
    trace: ['source : req.params.name (ligne 5)', 'path.resolve (ligne 5)', 'sink : res.sendFile (ligne 7)'],
    verdict: 'fp',
    reasons: [
      'Le chemin est résolu puis confiné au dossier du tenant, séparateur compris',
      'Express décode et normalise req.params, ce qui retire les segments de remontée',
      'sendFile refuse par défaut les chemins qui sortent de la racine déclarée',
    ],
    why: 'Faux positif : c’est le motif correct (résoudre, puis vérifier le préfixe avec le séparateur). Certaines versions de la requête reconnaissent ce garde ; sinon, un modèle ou une annotation justifiée suffit.',
  },
  {
    id: 'agent-idor',
    tool: 'Agent de pentest IA',
    rule: 'Rapport : IDOR sur /api/invoices/:id',
    message: '« Vulnérabilité confirmée : en modifiant l’identifiant, l’agent a lu une autre facture (HTTP 200). »',
    file: 'rapport-agent.txt',
    lang: 'text',
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
    id: 'aws-example-key',
    tool: 'Gitleaks',
    rule: 'aws-access-token',
    message: 'Identifiant d’accès AWS détecté.',
    file: 'docs/runbooks/local-dev.md',
    lang: 'text',
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
    why: 'Faux positif connu : AKIAIOSFODNN7EXAMPLE est la clé d’exemple officielle d’AWS. Ajoute-la à la liste d’exceptions de Gitleaks plutôt que de désactiver la règle.',
  },
  {
    id: 'deep-merge',
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
      'JSON.parse crée une vraie clé __proto__, que la fusion récursive suit jusqu’au prototype',
      'La fusion n’écrit que sur des clés propres énumérables, ce qu’__proto__ n’est pas',
      'Le typage any désactive les vérifications, mais la cible reste un littéral neuf',
    ],
    why: 'Vrai positif : le corps JSON est une source directe. Correction : refuser __proto__, constructor et prototype, fusionner vers Object.create(null), et surtout valider le corps avec un schéma strict (M3).',
  },
];

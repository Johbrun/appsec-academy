// Extraits du jeu « Spot the Sink » : une ligne vulnérable, une CWE à identifier.

export const cweNames: Record<string, string> = {
  'CWE-79': 'Cross-site scripting',
  'CWE-89': 'Injection SQL',
  'CWE-78': 'Injection de commande système',
  'CWE-22': 'Path traversal',
  'CWE-918': 'Server-side request forgery',
  'CWE-943': 'Injection dans la logique de requête (NoSQL)',
  'CWE-1321': 'Prototype pollution',
  'CWE-1333': 'Regex à complexité excessive (ReDoS)',
  'CWE-639': 'Autorisation via une clé contrôlée par l’utilisateur (BOLA)',
  'CWE-915': 'Modification d’attributs non contrôlée (mass assignment)',
  'CWE-347': 'Vérification incorrecte d’une signature',
  'CWE-942': 'Politique cross-domain trop permissive',
  'CWE-640': 'Récupération de mot de passe faible',
  'CWE-1336': 'Injection dans un moteur de templates',
  'CWE-352': 'Cross-site request forgery',
  'CWE-209': 'Message d’erreur qui révèle des informations',
  'CWE-20': 'Validation d’entrée incorrecte',
};

export interface Snippet {
  file: string;
  lang: string;
  code: string;
  line: number;      // ligne vulnérable, à partir de 1
  cwe: string;
  options: string[]; // 4 CWE, dont la bonne
  explain: string;
}

export const snippets: Snippet[] = [
  {
    file: 'routes/auth.ts', lang: 'ts', line: 3, cwe: 'CWE-943', options: ['CWE-943', 'CWE-89', 'CWE-639', 'CWE-352'],
    code: `router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await users.findOne({ email, password: hash(password) });
  if (!user) return res.status(401).end();
  res.json(issueToken(user));
});`,
    explain: 'email arrive tel quel dans le filtre Mongo : un objet comme { "$ne": null } remplace la chaîne attendue. Un schéma strict à l’entrée élimine la classe.',
  },
  {
    file: 'routes/invoices.ts', lang: 'ts', line: 3, cwe: 'CWE-89', options: ['CWE-89', 'CWE-943', 'CWE-915', 'CWE-209'],
    code: `router.get('/invoices', async (req, res) => {
  const sort = req.query.sort ?? 'created_at';
  const rows = await prisma.$queryRawUnsafe(\`SELECT * FROM invoice WHERE tenant_id = $1 ORDER BY \${sort}\`, req.user.tenantId);
  res.json(rows);
});`,
    explain: 'Le nom de colonne est interpolé dans du SQL brut. Un tri se choisit dans une liste blanche, jamais par concaténation.',
  },
  {
    file: 'services/pdf.ts', lang: 'ts', line: 4, cwe: 'CWE-78', options: ['CWE-78', 'CWE-22', 'CWE-1336', 'CWE-918'],
    code: `import { exec } from 'node:child_process';

export function toPdf(name: string) {
  exec(\`wkhtmltopdf /tmp/\${name}.html /tmp/\${name}.pdf\`);
}`,
    explain: 'exec passe la chaîne à un shell : un nom de fichier contrôlé devient une commande. execFile avec un tableau d’arguments.',
  },
  {
    file: 'routes/files.ts', lang: 'ts', line: 2, cwe: 'CWE-22', options: ['CWE-22', 'CWE-78', 'CWE-639', 'CWE-918'],
    code: `router.get('/files/:name', (req, res) => {
  const p = path.join(UPLOADS, req.params.name);
  res.sendFile(p);
});`,
    explain: 'join ne retient pas ../ : le chemin sort du dossier. resolve puis vérification de la racine, ou mieux des identifiants générés.',
  },
  {
    file: 'components/ClientCard.tsx', lang: 'tsx', line: 5, cwe: 'CWE-79', options: ['CWE-79', 'CWE-352', 'CWE-942', 'CWE-1321'],
    code: `export function ClientCard({ client }: { client: Client }) {
  return (
    <div className="card">
      <h3>{client.name}</h3>
      <a href={client.website}>Site web</a>
    </div>
  );
}`,
    explain: 'React échappe le texte, mais pas les URL javascript: dans href. Valider le schéma (http, https) avant de rendre le lien.',
  },
  {
    file: 'server/render.tsx', lang: 'tsx', line: 4, cwe: 'CWE-79', options: ['CWE-79', 'CWE-209', 'CWE-1336', 'CWE-915'],
    code: `export function page(html: string, state: AppState) {
  return \`<!doctype html><div id="root">\${html}</div>
  <script>
    window.__STATE__ = \${JSON.stringify(state)};
  </script>\`;
}`,
    explain: 'JSON.stringify ne neutralise pas </script> : une donnée qui contient cette séquence ferme le script. Utiliser un sérialiseur qui échappe <.',
  },
  {
    file: 'routes/webhooks.ts', lang: 'ts', line: 3, cwe: 'CWE-918', options: ['CWE-918', 'CWE-22', 'CWE-942', 'CWE-640'],
    code: `router.post('/webhooks/test', async (req, res) => {
  const { url } = WebhookTest.parse(req.body);
  const r = await fetch(url, { method: 'POST', body: JSON.stringify(sample) });
  res.json({ status: r.status });
});`,
    explain: 'Le serveur émet une requête vers une URL choisie par le client, et renvoie le statut : services internes et métadonnées du cloud deviennent atteignables.',
  },
  {
    file: 'lib/prefs.ts', lang: 'ts', line: 4, cwe: 'CWE-1321', options: ['CWE-1321', 'CWE-915', 'CWE-943', 'CWE-1333'],
    code: `export function applyPrefs(target: any, prefs: any) {
  for (const key in prefs) {
    if (typeof prefs[key] === 'object') applyPrefs(target[key] ??= {}, prefs[key]);
    else target[key] = prefs[key];
  }
}`,
    explain: 'La fusion récursive suit les clés du client, y compris __proto__ : on écrit dans Object.prototype. Refuser les clés dangereuses et utiliser des schémas stricts.',
  },
  {
    file: 'lib/validate.ts', lang: 'ts', line: 1, cwe: 'CWE-1333', options: ['CWE-1333', 'CWE-1321', 'CWE-20', 'CWE-943'],
    code: `const DOMAIN = /^([a-z0-9]+([-a-z0-9]*[a-z0-9]+)*\\.)+[a-z]{2,}$/i;

export const isValidDomain = (s: string) => DOMAIN.test(s);`,
    explain: 'Des quantificateurs imbriqués permettent un retour arrière exponentiel : une seule entrée gèle la boucle d’événements. Limiter la taille, simplifier, ou re2.',
  },
  {
    file: 'routes/invoices.ts', lang: 'ts', line: 2, cwe: 'CWE-639', options: ['CWE-639', 'CWE-89', 'CWE-915', 'CWE-352'],
    code: `router.get('/invoices/:id', requireAuth, async (req, res) => {
  const invoice = await Invoice.findById(req.params.id);
  if (!invoice) return res.status(404).end();
  res.json(toPublicInvoice(invoice));
});`,
    explain: 'Authentifié ne veut pas dire autorisé : aucune vérification que la facture appartient au tenant de l’utilisateur. La requête doit inclure le tenant.',
  },
  {
    file: 'routes/profile.ts', lang: 'ts', line: 2, cwe: 'CWE-915', options: ['CWE-915', 'CWE-639', 'CWE-1321', 'CWE-209'],
    code: `router.patch('/me', requireAuth, async (req, res) => {
  const user = await User.findByIdAndUpdate(req.user.id, req.body, { new: true });
  res.json(toPublicUser(user));
});`,
    explain: 'Tout le corps de la requête est appliqué : role, tenantId ou plan deviennent modifiables. Liste blanche explicite des champs.',
  },
  {
    file: 'middleware/auth.ts', lang: 'ts', line: 3, cwe: 'CWE-347', options: ['CWE-347', 'CWE-640', 'CWE-942', 'CWE-639'],
    code: `export const requireAuth = (req, res, next) => {
  const token = req.get('authorization')?.replace('Bearer ', '') ?? '';
  const claims = jwt.decode(token);
  if (!claims) return res.status(401).end();
  req.user = claims;
  next();
};`,
    explain: 'decode lit le jeton sans vérifier la signature : n’importe qui forge ses propres claims. Il faut vérifier, avec algorithme, émetteur et audience fixés.',
  },
  {
    file: 'routes/password.ts', lang: 'ts', line: 3, cwe: 'CWE-640', options: ['CWE-640', 'CWE-918', 'CWE-79', 'CWE-209'],
    code: `router.post('/password/forgot', async (req, res) => {
  const token = await createResetToken(req.body.email);
  const link = \`https://\${req.get('host')}/reset?token=\${token}\`;
  await mailer.send(req.body.email, resetTemplate(link));
  res.status(204).end();
});`,
    explain: 'Le domaine du lien vient de l’en-tête Host : un attaquant fait envoyer à la victime un lien vers son domaine, qui récupère le jeton.',
  },
  {
    file: 'routes/preview.ts', lang: 'ts', line: 2, cwe: 'CWE-1336', options: ['CWE-1336', 'CWE-79', 'CWE-22', 'CWE-915'],
    code: `app.get('/invoice/preview', (req, res) => {
  res.render('invoice', req.query);
});`,
    explain: 'L’objet passé au rendu sert aussi d’options au moteur : le client peut influencer la compilation (cf. CVE-2022-29078 sur EJS).',
  },
  {
    file: 'app.ts', lang: 'ts', line: 2, cwe: 'CWE-942', options: ['CWE-942', 'CWE-352', 'CWE-79', 'CWE-640'],
    code: `const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());`,
    explain: 'origin: true reflète n’importe quelle origine ; avec credentials, tout site lit les réponses authentifiées. Liste blanche d’origines exactes.',
  },
  {
    file: 'middleware/errors.ts', lang: 'ts', line: 2, cwe: 'CWE-209', options: ['CWE-209', 'CWE-347', 'CWE-1336', 'CWE-22'],
    code: `app.use((err, req, res, next) => {
  res.status(500).json({ error: err.message, stack: err.stack, query: err.sql });
});`,
    explain: 'La pile et la requête SQL partent au client. Le détail va dans les logs, le client reçoit un message générique et un identifiant de requête.',
  },
];

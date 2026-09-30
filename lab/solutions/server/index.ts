// Point d'entrée de l'API — version CORRIGÉE.
//
// Les treize défauts de surface de server/index.ts sont traités ici, chacun
// indépendamment des autres : CSP (nonce par réponse, strict-dynamic,
// frame-ancestors), en-têtes d'isolation (Referrer-Policy, COOP, CORP), CORS
// (liste blanche par égalité, pas de `null`, pas de reflet), plus de surcharge
// de méthode, anti-CSRF inconditionnel adossé à Fetch Metadata, autorisation
// décidée après résolution de la route, et plus d'endpoint de diagnostic.

import express from 'express';
import crypto from 'node:crypto';
import { assertSafeToRun, banner, HOST, PORT } from './safety.ts';
import { startImds } from './imds.ts';

import { audit, db } from './store.ts';
import { readToken } from './lib/jwt.ts';
import { authenticate } from './lib/auth.ts';
import { authRoutes } from './routes/auth.ts';
import { profileRoutes } from './routes/profile.ts';
import { invoiceRoutes } from './routes/invoices.ts';
import { attachmentRoutes } from './routes/attachments.ts';
import { webhookRoutes } from './routes/webhooks.ts';
import { creditRoutes } from './routes/credits.ts';
import { settingsRoutes } from './routes/settings.ts';
import { brandingRoutes } from './routes/branding.ts';
import { assistantRoutes } from './routes/assistant.ts';
import { adminRoutes, adminExportRoutes, internalRoutes } from './routes/admin.ts';
import { graphqlRoutes } from './routes/graphql.ts';
import { labRoutes } from './routes/lab.ts';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      overriddenFrom?: string;
      csrfChecked?: boolean;
    }
  }
}

assertSafeToRun();

const app = express();

// CORRIGÉ (host-header) : le nombre exact de proxys de confiance, pas `true`.
app.set('trust proxy', 1);
app.disable('x-powered-by');

// ════════════════════════════════════════════════════════════════════════════
//  1. En-têtes de sécurité
// ════════════════════════════════════════════════════════════════════════════

/**
 * CORRIGÉ (csp-nonce-reuse) : un nonce est un nombre utilisé UNE fois. Il est
 * tiré ici, par réponse, depuis un générateur cryptographique, et il n'est
 * jamais devinable depuis une réponse précédente.
 *
 * CORRIGÉ (csp-gadget) : plus aucune origine ni aucun chemin autorisé en bloc.
 * `'strict-dynamic'` fait porter la confiance par le nonce — les scripts que le
 * code de confiance insère lui-même héritent de cette confiance, et rien
 * d'autre. `'unsafe-eval'` disparaît, ce qui referme aussi le gadget de
 * /api/vendor/.
 *
 * CORRIGÉ (clickjacking, clickjacking-prefilled) : `frame-ancestors 'none'`.
 * `X-Frame-Options` n'est pas repris : c'est un héritage, pas une défense à
 * concevoir aujourd'hui.
 */
function cspFor(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self'",
    "img-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "require-trusted-types-for 'script'",
    'trusted-types novafact',
  ].join('; ');
}

app.use((_req, res, next) => {
  const nonce = crypto.randomBytes(16).toString('base64');
  res.locals.cspNonce = nonce;
  res.set('Content-Security-Policy', cspFor(nonce));

  // CORRIGÉ (referrer-leak) : aucune URL de l'application ne part en entier vers
  // un tiers. Le vrai correctif reste de ne mettre aucun secret dans une URL —
  // cet en-tête n'est que la deuxième barrière.
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // CORRIGÉ (xsleak-frame-count) : COOP coupe la référence `window.opener`, donc
  // l'observation de `frames.length` depuis la page qui a ouvert celle-ci.
  res.set('Cross-Origin-Opener-Policy', 'same-origin');

  // CORRIGÉ (xsleak-error-events) : CORP interdit à une page d'une autre origine
  // de charger la ressource, donc d'en observer l'issue.
  res.set('Cross-Origin-Resource-Policy', 'same-origin');

  res.set('X-Content-Type-Options', 'nosniff');
  next();
});

// ════════════════════════════════════════════════════════════════════════════
//  2. CORS
// ════════════════════════════════════════════════════════════════════════════

/**
 * CORRIGÉ (cors-origin-reflection, cors-null-origin) : liste blanche explicite,
 * comparée par ÉGALITÉ, sans reflet et sans `null`. `null` n'est l'origine de
 * personne : une iframe `sandbox`, un document `data:` ou une redirection la
 * produisent à volonté. Aucune exception de confort dans une liste d'origines.
 */
const CORS_ALLOWED = new Set(['http://127.0.0.1:5199', 'http://localhost:5199']);

function allowedOrigin(origin: string): string | null {
  return CORS_ALLOWED.has(origin) ? origin : null;
}

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (typeof origin === 'string') {
    const allow = allowedOrigin(origin);
    if (allow !== null) {
      res.set('Access-Control-Allow-Origin', allow);
      res.set('Access-Control-Allow-Credentials', 'true');
      res.set('Vary', 'Origin');
    }
  }

  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-CSRF-Token');
    res.status(204).end();
    return;
  }
  next();
});

// ════════════════════════════════════════════════════════════════════════════
//  3. Corps de requête
// ════════════════════════════════════════════════════════════════════════════

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

// CORRIGÉ (samesite-method-override) : l'intergiciel de surcharge de méthode est
// retiré. `SameSite=Lax` ne protège les mutations que parce qu'elles ne sont pas
// des navigations : l'hypothèse doit rester vraie. Une navigation ne mute rien.

app.use(authenticate);

// ════════════════════════════════════════════════════════════════════════════
//  4. Autorisation
// ════════════════════════════════════════════════════════════════════════════
//
// CORRIGÉ (url-prefix-authz) : plus aucun contrôle d'accès fondé sur une chaîne
// d'URL. L'autorisation se décide sur la ressource et l'action, APRÈS résolution
// de la route — dans `adminRoutes` et `adminExportRoutes` (voir
// solutions/server/routes/admin.ts). Casse, doubles séparateurs, `.` et
// encodages divergeront toujours entre la comparaison et le routage.

// ════════════════════════════════════════════════════════════════════════════
//  5. Session de la surface HTTP et anti-CSRF
// ════════════════════════════════════════════════════════════════════════════

interface SurfaceSession { email: string; tenantId: string; name: string; }
const surfaceSessions = new Map<string, SurfaceSession>();

function cookiesOf(req: express.Request): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of String(req.headers.cookie ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function surfaceUser(req: express.Request): SurfaceSession | null {
  const sid = cookiesOf(req).nf_session;
  if (sid && surfaceSessions.has(sid)) return surfaceSessions.get(sid)!;
  if (req.user) return { email: req.user.email, tenantId: req.user.tenantId, name: req.user.email };
  return null;
}

const CSRF_TOKEN = `nf-csrf-${crypto.randomBytes(8).toString('hex')}`;
const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * CORRIGÉ (content-type-confusion) : la route n'accepte plus qu'UN format —
 * `application/json`, que le navigateur ne peut pas envoyer en formulaire simple
 * sans preflight. Le jeton est vérifié INCONDITIONNELLEMENT, et Fetch Metadata
 * ferme la porte en amont : une mutation ne vient jamais d'un contexte
 * cross-site.
 *
 * Un contrôle qui dépend du format d'entrée a autant de trous que de formats
 * acceptés. Celui-ci n'a plus de branche.
 */
function csrfGuard(req: express.Request, res: express.Response, next: express.NextFunction): void {
  if (!MUTATING.has(req.method)) { next(); return; }

  const site = req.headers['sec-fetch-site'];
  if (site !== undefined && site !== 'same-origin' && site !== 'none') {
    res.status(403).json({ error: 'mutation refusée : contexte cross-site' });
    return;
  }

  const contentType = String(req.headers['content-type'] ?? '');
  if (!contentType.includes('application/json')) {
    res.status(415).json({ error: 'seul application/json est accepté' });
    return;
  }

  const sent = req.headers['x-csrf-token'] ?? (req.body as { _csrf?: unknown } | undefined)?._csrf;
  if (sent !== CSRF_TOKEN) {
    res.status(403).json({ error: 'jeton anti-CSRF absent ou invalide' });
    return;
  }
  req.csrfChecked = true;
  next();
}

app.use(['/api/billing', '/api/pay'], csrfGuard);

// ════════════════════════════════════════════════════════════════════════════
//  6. Montage des routeurs
// ════════════════════════════════════════════════════════════════════════════

app.use('/api/auth', authRoutes);
app.use('/api/me', profileRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/attachments', attachmentRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/credits', creditRoutes);
app.use('/api/assistant', assistantRoutes);
app.use('/api/admin/exports', adminExportRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/internal', internalRoutes);
app.use('/api/graphql', graphqlRoutes);
app.use('/api/lab', labRoutes);
app.use('/api', settingsRoutes);
app.use('/api', brandingRoutes);

// ════════════════════════════════════════════════════════════════════════════
//  7. La surface HTTP de Novafact
// ════════════════════════════════════════════════════════════════════════════

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const page = (title: string, body: string) => `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title></head>
<body><main>${body}</main></body></html>`;

const surface = express.Router();

// CORRIGÉ (content-type-confusion, clickjacking-prefilled) : `SameSite=Lax`.
// Le cookie ne traverse plus une requête cross-site, et la page de facturation
// n'est plus embarquée chez un partenaire — c'est le partenaire qui redirige.
surface.get('/surface/login', (req, res) => {
  const raw = typeof req.query.token === 'string' ? req.query.token : '';
  const claims = raw ? readToken(raw)?.claims : undefined;
  const email = claims?.sub ?? req.user?.email;
  const user = db.users.find((u) => u.email === email);
  if (!user) {
    res.status(401).type('html').send(page('Session', '<h1>Session</h1><p>Jeton absent ou inconnu.</p>'));
    return;
  }
  const sid = crypto.randomBytes(16).toString('hex');
  surfaceSessions.set(sid, { email: user.email, tenantId: user.tenantId, name: user.name });
  res.set('Set-Cookie', `nf_session=${sid}; Path=/; HttpOnly; SameSite=Lax`);
  const next = typeof req.query.next === 'string' && req.query.next.startsWith('/api/') ? req.query.next : '/api/billing';
  res.redirect(302, next);
});

surface.get('/surface/csrf', (_req, res) => res.json({ csrf: CSRF_TOKEN }));

// ── Coordonnées bancaires ───────────────────────────────────────────────────

interface Billing { holder: string; iban: string; }
const billing = new Map<string, Billing>();
const billingFor = (tenantId: string): Billing => {
  if (!billing.has(tenantId)) billing.set(tenantId, { holder: 'Novafact SAS', iban: 'FR7630001007941234567890185' });
  return billing.get(tenantId)!;
};

surface.get('/billing', (req, res) => {
  const user = surfaceUser(req);
  if (!user) {
    res.status(401).type('html').send(page('Coordonnées bancaires', '<h1>Session requise</h1>'));
    return;
  }

  // CORRIGÉ (clickjacking-prefilled) : plus aucun pré-remplissage d'un champ
  // sensible depuis l'URL. Combiné à `frame-ancestors 'none'`, il ne reste plus
  // rien à faire cliquer en aveugle — et l'enregistrement demande de toute façon
  // la ressaisie de l'IBAN.
  const current = billingFor(user.tenantId);
  res.type('html').send(page('Coordonnées bancaires', `
<h1>Coordonnées bancaires</h1>
<p>${esc(user.name)} · tenant ${esc(user.tenantId)}</p>
<p>IBAN de règlement enregistré : <span class="mono">${esc(current.iban)}</span></p>
<p>La modification passe par l’application, en JSON, avec le jeton anti-CSRF et
la ressaisie complète de l’IBAN.</p>`));
});

function applyIban(req: express.Request, res: express.Response): void {
  const user = surfaceUser(req);
  if (!user) { res.status(401).json({ error: 'session requise' }); return; }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const iban = String(body.iban ?? '').replace(/\s+/g, '').toUpperCase();
  const confirm = String(body.ibanConfirm ?? '').replace(/\s+/g, '').toUpperCase();
  if (!/^[A-Z]{2}[0-9A-Z]{12,32}$/.test(iban)) {
    res.status(400).json({ error: 'IBAN invalide' });
    return;
  }
  // Une action irréversible ne s'obtient pas par un clic : elle se ressaisit.
  if (confirm !== iban) {
    res.status(400).json({ error: 'la confirmation de l’IBAN ne correspond pas' });
    return;
  }

  const before = billingFor(user.tenantId).iban;
  billingFor(user.tenantId).iban = iban;
  audit(user.email, 'iban.modifié', `${before} → ${iban}`);
  res.json({ ok: true, iban });
}

surface.post('/billing/iban', applyIban);

// CORRIGÉ (samesite-method-override) : un GET consulte, il ne mute jamais.
surface.get('/billing/iban', (req, res) => {
  const user = surfaceUser(req);
  if (!user) { res.status(401).json({ error: 'session requise' }); return; }
  res.json(billingFor(user.tenantId));
});

// ── Validation de paiement ──────────────────────────────────────────────────

surface.get('/pay/confirm', (_req, res) => {
  // CORRIGÉ (clickjacking) : la page n'est plus encadrable — `frame-ancestors
  // 'none'` est posé par l'intergiciel d'en-têtes, pour toutes les réponses.
  res.type('html').send(page('Valider le paiement', `
<h1>Valider le paiement</h1>
<p>Facture <span class="mono">INV-1001</span> — 490,00 € — Dupont &amp; Fils</p>`));
});

surface.post('/pay/confirm', (req, res) => {
  const who = surfaceUser(req)?.email ?? 'anonyme';
  const id = String(((req.body ?? {}) as Record<string, unknown>).invoice ?? 'INV-1001');
  audit(who, 'paiement.validé', id);
  res.json({ ok: true, invoice: id });
});

// ── Lien public de facture ──────────────────────────────────────────────────

const shares = new Map<string, string>();      // jeton d'échange → facture
const publicSessions = new Map<string, string>(); // cookie → facture

surface.get('/surface/share', (req, res) => {
  const user = surfaceUser(req);
  if (!user) { res.status(401).json({ error: 'session requise' }); return; }
  const id = typeof req.query.invoice === 'string' ? req.query.invoice : 'INV-1001';
  const invoice = db.invoices.find((i) => i.id === id && i.tenantId === user.tenantId);
  if (!invoice) { res.status(404).json({ error: 'facture introuvable' }); return; }

  const token = crypto.randomBytes(12).toString('hex');
  shares.set(token, invoice.id);
  res.json({ link: `/api/public/invoice/${token}`, token, invoice: invoice.id });
});

/**
 * CORRIGÉ (referrer-leak) : le jeton du lien est à USAGE UNIQUE et ne sert qu'à
 * ouvrir une session de consultation. Il est immédiatement échangé contre un
 * cookie, puis la navigation repart sur une URL qui ne contient plus rien de
 * secret. Aucune sous-ressource de la page ne peut donc l'emporter dans son
 * `Referer` — et `Referrer-Policy` limite de toute façon ce qui sort.
 */
surface.get('/public/invoice/:token', (req, res) => {
  const id = shares.get(req.params.token);
  if (!id) {
    res.status(404).type('html').send(page('Facture', '<h1>Lien expiré</h1>'));
    return;
  }
  shares.delete(req.params.token);
  const sid = crypto.randomBytes(16).toString('hex');
  publicSessions.set(sid, id);
  res.set('Set-Cookie', `nf_public=${sid}; Path=/api/public; HttpOnly; SameSite=Lax`);
  res.redirect(302, '/api/public/invoice');
});

surface.get('/public/invoice', (req, res) => {
  const sid = cookiesOf(req).nf_public;
  const id = sid ? publicSessions.get(sid) : undefined;
  const invoice = id ? db.invoices.find((i) => i.id === id) : undefined;
  if (!invoice) {
    res.status(404).type('html').send(page('Facture', '<h1>Lien expiré</h1>'));
    return;
  }
  // La note est échappée : le rendu HTML brut n'a jamais été un besoin.
  res.type('html').send(page(`Facture ${invoice.ref}`, `
<h1>Facture ${esc(invoice.ref)}</h1>
<p>${esc(invoice.client)} · ${invoice.total.toFixed(2)} €</p>
<div>${esc(invoice.note)}</div>
<img src="/api/telemetry/pixel.gif" width="1" height="1" alt="">`));
});

const PIXEL = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
surface.get('/telemetry/pixel.gif', (_req, res) => {
  // Plus rien à récolter : l'URL de la page ne contient aucun secret.
  res.type('image/gif').send(PIXEL);
});

// ── /api/vendor ─────────────────────────────────────────────────────────────

surface.get('/vendor/legacy-widget.js', (_req, res) => {
  // CORRIGÉ (csp-gadget) : la CSP n'autorise plus ce répertoire — c'était le
  // vrai défaut. En défense en profondeur, la bibliothèque n'évalue plus ce
  // qu'elle lit : elle se contente d'un comportement déclaratif fini.
  res.type('application/javascript').send(
    `// novafact-legacy-widget 0.5 — configuration par attributs de données.
(function () {
  var nodes = document.querySelectorAll('[data-lab-action]');
  for (var i = 0; i < nodes.length; i++) {
    nodes[i].setAttribute('data-lab-ignored', 'action non évaluée');
  }
})();
`,
  );
});

// ── Recherche de clients ────────────────────────────────────────────────────

const FIXED_FRAME_COUNT = 3;

surface.get('/surface/clients', (req, res) => {
  const user = surfaceUser(req);
  if (!user) { res.status(401).type('html').send(page('Clients', '<h1>Session requise</h1>')); return; }

  const q = typeof req.query.q === 'string' ? req.query.q : '';
  const hits = db.invoices.filter(
    (i) => i.tenantId === user.tenantId && q.length > 0 && i.client.toLowerCase().includes(q.toLowerCase()),
  );

  // CORRIGÉ (xsleak-frame-count) : COOP coupe la référence à la fenêtre et
  // `frame-ancestors 'none'` interdit l'encadrement. Et, parce qu'une défense
  // d'en-tête ne remplace pas un rendu indiscernable, le nombre de cadres est
  // désormais CONSTANT : les résultats sont paginés dans un nombre fixe de
  // cadres, remplis côté client.
  const frames = Array.from({ length: FIXED_FRAME_COUNT }, (_, n) =>
    `<iframe title="résultat ${n + 1}" src="/api/surface/invoice-card/${esc(hits[n]?.id ?? 'vide')}"></iframe>`,
  ).join('');

  res.type('html').send(page('Recherche de clients', `
<h1>Clients — « ${esc(q)} »</h1>
<div>${frames}</div>`));
});

surface.get('/surface/invoice-card/:id', (req, res) => {
  const invoice = db.invoices.find((i) => i.id === req.params.id);
  res.type('html').send(page('Facture', invoice ? `<p>${esc(invoice.ref)} · ${esc(invoice.client)}</p>` : '<p>—</p>'));
});

// ── Ressource de facture ────────────────────────────────────────────────────

surface.get('/surface/invoice-asset/:id', (req, res) => {
  // CORRIGÉ (xsleak-error-events) : `Cross-Origin-Resource-Policy: same-origin`
  // (posé pour toutes les réponses) interdit le chargement depuis une autre
  // origine. Et la réponse est UNIFORME : même code, même corps, que la facture
  // existe ou non. L'existence d'une ressource est elle-même une information.
  void req.params.id;
  res.type('image/gif').send(PIXEL);
});

// ── Points d'appui du lab ───────────────────────────────────────────────────
//
// Ils subsistent pour que les tests de régression puissent constater que
// l'attaque échoue : aucun ne décerne plus rien.

surface.get('/surface/beacon', (_req, res) => res.status(400).json({ ok: false }));

surface.all('/surface/collect/*', (_req, res) => res.status(404).json({ error: 'route inconnue' }));

surface.post('/surface/payment-callback', (req, res) => {
  // CORRIGÉ (postmessage-origin) : la page ne transmet plus d'origine parce
  // qu'elle ne lit plus de message venu d'ailleurs. Et un paiement ne se
  // confirme pas depuis le navigateur : la confirmation arrive par webhook
  // signé du prestataire.
  void req.body;
  res.status(410).json({ error: 'la confirmation de paiement ne vient pas du navigateur' });
});

surface.get('/surface/analytics', (_req, res) => {
  // CORRIGÉ (secret-in-bundle) : plus aucune clé n'est livrée au navigateur ;
  // l'appel d'audience part du serveur. La clé publiée a de toute façon été
  // révoquée — la retirer du code n'aurait pas suffi.
  res.json({ ok: false, service: 'novafact-analytics' });
});

// CORRIGÉ (debug-endpoint) : la route de diagnostic est retirée. Les
// fonctionnalités non documentées sont une surface : ce qui est monté en
// production figure dans l'inventaire des routes, et rien de diagnostique n'est
// servi sans authentification, sans trace et sans date d'expiration.

app.use('/api', surface);

app.get('/api/health', (_req, res) => res.json({ ok: true, lab: 'novafact', vulnerable: false }));

// CORRIGÉ : le gestionnaire d'erreurs ne divulgue plus ni message ni pile.
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'erreur interne' });
});

const imds = startImds();
const server = app.listen(PORT, HOST, banner);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close();
    imds.close();
    process.exit(0);
  });
}

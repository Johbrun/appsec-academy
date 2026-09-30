// Point d'entrée de l'API vulnérable.
//
// ⚠ Application volontairement vulnérable — support d'exercices d'AppSec
// Academy. Boucle locale uniquement, données fictives en mémoire.
//
// Ce fichier porte deux choses :
//   1. le câblage de l'application (intergiciels, montages, gestionnaire
//      d'erreurs) — et c'est là que vivent les défauts « de surface » : CSP,
//      CORS, en-têtes d'isolation, surcharge de méthode, contrôle d'accès par
//      préfixe d'URL, endpoint de diagnostic ;
//   2. la « surface HTTP » de Novafact : les quelques pages rendues par le
//      serveur (facturation, paiement, lien public de facture) qui servent de
//      cible aux exercices du navigateur, et les points d'appui qui permettent
//      au serveur de CONSTATER la violation d'invariant.
//
// Un exercice n'est jamais résolu sur déclaration : solve() est appelé au point
// exact où l'invariant casse.

import express from 'express';
import crypto from 'node:crypto';
import { assertSafeToRun, banner, HOST, PORT } from './safety.ts';
import { startImds } from './imds.ts';

import { audit, db, solve } from './store.ts';
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
      /** Méthode réellement reçue, quand la surcharge de méthode l'a changée. */
      overriddenFrom?: string;
      /** true quand le jeton anti-CSRF a vraiment été vérifié sur cette requête. */
      csrfChecked?: boolean;
    }
  }
}

assertSafeToRun();

const app = express();

// Comme derrière l'ALB de Novafact : X-Forwarded-* est cru sur parole.
// C'est ce qui rend l'exercice host-header possible. Le bon réglage est le
// nombre exact de proxys de confiance, pas `true`.
app.set('trust proxy', true);
app.disable('x-powered-by');

// ════════════════════════════════════════════════════════════════════════════
//  1. En-têtes de sécurité : la CSP du lab, d'un seul bloc
// ════════════════════════════════════════════════════════════════════════════
//
// Six exercices portent sur cet en-tête et sur ceux qui l'entourent. Les
// défauts sont indépendants : on peut en corriger un sans toucher aux autres.
//
//   · csp-nonce-reuse ...... le nonce est une constante de build
//   · csp-gadget ........... un répertoire de bibliothèques autorisé en bloc,
//                            plus 'unsafe-eval'
//   · trusted-types-default  le mécanisme est exigé ici, mais la politique par
//                            défaut (src/main.tsx) rend l'identité
//   · clickjacking ......... aucun frame-ancestors
//   · clickjacking-prefilled idem, sur la page des coordonnées bancaires
//   · referrer-leak ........ aucun Referrer-Policy
//
// Et deux exercices de plus sur les en-têtes d'isolation manquants :
// xsleak-frame-count (pas de COOP) et xsleak-error-events (pas de CORP).

// VULNÉRABLE (csp-nonce-reuse) : ce nonce est calculé une fois, au chargement
// du module, et recopié dans toutes les réponses. Un nonce est un nombre
// utilisé UNE fois : il doit être tiré par réponse, avec un générateur
// cryptographique, et ne jamais être devinable depuis une réponse précédente.
//
// Correctif attendu : `crypto.randomBytes(16).toString('base64')` dans un
// intergiciel, posé sur res.locals, et injecté dans la CSP de CETTE réponse.
const CSP_NONCE = 'nf-2024-06-build-7f3a91c2';

// VULNÉRABLE (csp-gadget) : le répertoire de bibliothèques héritées est
// autorisé en bloc. Une liste blanche d'origines ne vaut que ce que valent les
// fichiers qu'elle couvre — et /api/vendor/legacy-widget.js exécute ce qu'il
// lit dans un attribut de données.
//
// Correctif attendu : 'strict-dynamic' avec un nonce par réponse, et aucune
// origine ni aucun chemin autorisé en bloc. Accessoirement : retirer
// 'unsafe-eval', sans quoi le gadget garde de quoi exécuter.
const VENDOR_SOURCES = [
  'http://127.0.0.1:4317/api/vendor/',
  'http://localhost:4317/api/vendor/',
  'http://127.0.0.1:5199/api/vendor/',
  'http://localhost:5199/api/vendor/',
].join(' ');

const CSP = [
  "default-src 'self'",
  `script-src 'nonce-${CSP_NONCE}' 'unsafe-eval' ${VENDOR_SOURCES}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "connect-src 'self'",
  // Trusted Types est exigé ici. La politique par défaut, elle, est dans
  // src/main.tsx — et elle rend l'identité (trusted-types-default).
  "require-trusted-types-for 'script'",
  'trusted-types default novafact',
  // Manquent volontairement :
  //   frame-ancestors 'none'  → clickjacking, clickjacking-prefilled
  //   object-src 'none', base-uri 'none'
].join('; ');

app.use((_req, res, next) => {
  res.set('Content-Security-Policy', CSP);

  // VULNÉRABLE (referrer-leak) : aucune politique de référent. Le lien public
  // de facture porte son jeton dans le chemin, et ce chemin part en `Referer`
  // vers tout ce que la page charge.
  //
  // Correctif attendu : `Referrer-Policy: strict-origin-when-cross-origin` au
  // minimum — et surtout aucun secret dans une URL.

  // VULNÉRABLE (xsleak-frame-count) : aucun Cross-Origin-Opener-Policy. Une
  // page tierce garde une référence sur la fenêtre ouverte et compte ses
  // cadres.
  //
  // Correctif attendu : `Cross-Origin-Opener-Policy: same-origin`.

  // VULNÉRABLE (xsleak-error-events) : aucun Cross-Origin-Resource-Policy. Une
  // page tierce charge la ressource en <img> et lit onload/onerror.
  //
  // Correctif attendu : `Cross-Origin-Resource-Policy: same-origin`, et des
  // réponses indiscernables selon que la ressource existe ou non.
  next();
});

// ════════════════════════════════════════════════════════════════════════════
//  2. CORS
// ════════════════════════════════════════════════════════════════════════════

const CORS_ALLOWED = new Set([
  'http://127.0.0.1:5199',
  'http://localhost:5199',
  // VULNÉRABLE (cors-null-origin) : ajouté « pour laisser passer les outils
  // locaux ». `null` n'est l'origine de personne en particulier : une iframe
  // `sandbox`, un document `data:` ou une redirection la produisent à volonté.
  //
  // Correctif attendu : retirer cette entrée. Aucune exception de confort dans
  // une liste d'origines.
  'null',
]);

/**
 * VULNÉRABLE (cors-origin-reflection) : hors liste, l'origine est recopiée
 * telle quelle. Combiné à `Access-Control-Allow-Credentials: true`, cela revient
 * à désactiver la politique de même origine pour tout le monde.
 *
 * Correctif attendu : `return null` — liste blanche explicite, comparée par
 * égalité, et pas de credentials sans nécessité.
 */
function allowedOrigin(origin: string): string | null {
  if (CORS_ALLOWED.has(origin)) return origin;
  return origin;
}

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (typeof origin === 'string') {
    const allow = allowedOrigin(origin);
    if (allow !== null) {
      res.set('Access-Control-Allow-Origin', allow);
      res.set('Access-Control-Allow-Credentials', 'true');
      res.set('Vary', 'Origin');

      // Le constat se fait à la fin de la réponse : une origine étrangère a
      // reçu le droit de LIRE une réponse authentifiée.
      const credentialed = Boolean(req.headers.cookie || req.headers.authorization);
      res.on('finish', () => {
        if (res.statusCode >= 400 || !credentialed) return;
        if (origin === 'null') {
          audit('anonyme', 'cors.null', 'réponse authentifiée lisible depuis l’origine null');
          solve('cors-null-origin');
        } else if (!CORS_ALLOWED.has(origin)) {
          audit('anonyme', 'cors.reflété', `${origin} autorisé à lire une réponse authentifiée`);
          solve('cors-origin-reflection');
        }
      });
    }
  }

  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-CSRF-Token,X-Novafact-Key');
    res.status(204).end();
    return;
  }
  next();
});

// ════════════════════════════════════════════════════════════════════════════
//  3. Corps de requête et surcharge de méthode
// ════════════════════════════════════════════════════════════════════════════

app.use(express.json({ limit: '1mb' }));

// Accepté « pour les vieux formulaires du portail partenaire ». C'est le second
// format d'entrée de content-type-confusion.
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

const OVERRIDABLE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * VULNÉRABLE (samesite-method-override) : un intergiciel de surcharge de
 * méthode monté globalement. Une navigation de premier niveau — un simple lien
 * sur un site tiers — devient une mutation.
 *
 * `SameSite=Lax` ne protège les mutations que parce qu'elles ne sont pas censées
 * être des navigations. Cet intergiciel casse l'hypothèse.
 *
 * Correctif attendu : le retirer. À défaut, ne jamais l'appliquer à une requête
 * arrivée en GET ou HEAD.
 */
app.use((req, _res, next) => {
  const wanted = typeof req.query._method === 'string' ? req.query._method.toUpperCase() : '';
  if (wanted && OVERRIDABLE.has(wanted) && req.method !== wanted) {
    req.overriddenFrom = req.method;
    req.method = wanted;
  }
  next();
});

app.use(authenticate);

// ════════════════════════════════════════════════════════════════════════════
//  4. Contrôle d'accès par préfixe d'URL
// ════════════════════════════════════════════════════════════════════════════

const ADMIN_PREFIX = '/api/admin';

/**
 * VULNÉRABLE (url-prefix-authz) : la protection des routes d'administration est
 * montée sur un préfixe de chemin, comparé sur la chaîne brute — alors que le
 * routeur, lui, résout la route sans tenir compte de la casse.
 * `/api/Admin/exports/ledger` échappe donc au contrôle et atteint le routeur.
 *
 * Correctif attendu : l'autorisation ne se décide pas sur une chaîne d'URL.
 * Elle se décide sur la ressource et l'action, APRÈS résolution de la route —
 * dans le routeur concerné ou dans la couche d'accès aux données. Casse, doubles
 * séparateurs, `.` et encodages divergeront toujours entre la comparaison et le
 * routage.
 */
app.use((req, res, next) => {
  if (req.path.startsWith(ADMIN_PREFIX)) {
    if (!req.user) {
      res.status(401).json({ error: 'authentification requise' });
      return;
    }
    if (req.user.role !== 'admin') {
      res.status(403).json({ error: 'réservé aux administrateurs' });
      return;
    }
  }
  next();
});

// ════════════════════════════════════════════════════════════════════════════
//  5. Session de la surface HTTP (cookie) et anti-CSRF
// ════════════════════════════════════════════════════════════════════════════
//
// Les pages rendues par le serveur (facturation, paiement) s'authentifient par
// cookie : c'est ce qui donne une autorité ambiante, donc ce qui rend le CSRF
// et le clickjacking observables. Le SPA, lui, continue d'utiliser le jeton
// Bearer.

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
  // Le SPA et les tests passent par le jeton Bearer.
  if (req.user) return { email: req.user.email, tenantId: req.user.tenantId, name: req.user.email };
  return null;
}

/** Jeton anti-CSRF du lab : un seul, remis par /api/surface/csrf. */
const CSRF_TOKEN = `nf-csrf-${crypto.randomBytes(8).toString('hex')}`;

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * VULNÉRABLE (content-type-confusion) : la vérification anti-CSRF ne s'applique
 * qu'à la branche JSON. La route accepte aussi le formulaire encodé — et cette
 * branche-là ne vérifie rien du tout.
 *
 * Un contrôle qui dépend du format d'entrée a autant de trous que de formats
 * acceptés.
 *
 * Correctif attendu : n'accepter qu'un format par route, vérifier le jeton
 * inconditionnellement, et surtout faire porter la défense par le cookie
 * (`SameSite`) et par Fetch Metadata (`Sec-Fetch-Site`) plutôt que par un jeton
 * conditionnel.
 */
function csrfGuard(req: express.Request, res: express.Response, next: express.NextFunction): void {
  if (!MUTATING.has(req.method)) { next(); return; }

  const contentType = String(req.headers['content-type'] ?? '');
  if (contentType.includes('application/json')) {
    const sent = req.headers['x-csrf-token'] ?? (req.body as { _csrf?: unknown } | undefined)?._csrf;
    if (sent !== CSRF_TOKEN) {
      res.status(403).json({ error: 'jeton anti-CSRF absent ou invalide' });
      return;
    }
    req.csrfChecked = true;
  }
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
// Monté avant /api/admin : l'export comptable n'a pas de contrôle de rôle à lui,
// il s'en remet entièrement au préfixe d'URL ci-dessus (url-prefix-authz).
app.use('/api/admin/exports', adminExportRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/internal', internalRoutes);
app.use('/api/graphql', graphqlRoutes);
app.use('/api/lab', labRoutes);
app.use('/api', settingsRoutes);   // /settings, /export
app.use('/api', brandingRoutes);   // /branding

// ════════════════════════════════════════════════════════════════════════════
//  7. La surface HTTP de Novafact
// ════════════════════════════════════════════════════════════════════════════

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const STYLE = `body{font:15px/1.5 system-ui,sans-serif;background:#0f1115;color:#e7e9ee;margin:0;padding:32px}
main{max-width:640px;margin:0 auto}h1{font-size:20px}code,.mono{font-family:ui-monospace,monospace;font-size:13px}
.card{background:#171a21;border:1px solid #262b36;border-radius:10px;padding:18px;margin:16px 0}
input,button{font:inherit;padding:8px 10px;border-radius:7px;border:1px solid #333a49;background:#0f1115;color:inherit}
button{background:#B4182D;border-color:#B4182D;color:#fff;cursor:pointer}
.muted{color:#8b93a4;font-size:13px}iframe{border:1px solid #262b36;width:100%;height:54px}`;

const page = (title: string, body: string) => `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><style>${STYLE}</style></head>
<body><main>${body}</main></body></html>`;

const surface = express.Router();

// ── Ouverture de session sur la surface (pose le cookie) ────────────────────
//
// Le cookie est en `SameSite=None` « parce que la page de facturation est
// embarquée dans le portail partenaire ». C'est ce réglage qui laisse l'autorité
// ambiante traverser les frontières d'origine — et c'est la première ligne du
// correctif de content-type-confusion et de clickjacking-prefilled.
surface.get('/surface/login', (req, res) => {
  const raw = typeof req.query.token === 'string' ? req.query.token : '';
  const claims = raw ? readToken(raw)?.claims : undefined;
  const email = claims?.sub ?? req.user?.email;
  const user = db.users.find((u) => u.email === email);
  if (!user) {
    res.status(401).type('html').send(page('Session', '<h1>Session</h1><p>Jeton absent ou inconnu. Passe <code>?token=&lt;jwt&gt;</code>.</p>'));
    return;
  }
  const sid = crypto.randomBytes(16).toString('hex');
  surfaceSessions.set(sid, { email: user.email, tenantId: user.tenantId, name: user.name });
  res.set('Set-Cookie', `nf_session=${sid}; Path=/; HttpOnly; SameSite=None; Secure`);
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

/** Dernier pré-remplissage servi dans un cadre tiers, par compte. */
const framedPrefill = new Map<string, string>();

surface.get('/billing', (req, res) => {
  const user = surfaceUser(req);
  if (!user) {
    res.status(401).type('html').send(page('Coordonnées bancaires', '<h1>Coordonnées bancaires</h1><p>Session requise : <code>/api/surface/login?token=&lt;jwt&gt;</code>.</p>'));
    return;
  }

  // VULNÉRABLE (clickjacking-prefilled) : le champ sensible accepte une valeur
  // pré-remplie par l'URL, et la page est encadrable (pas de frame-ancestors).
  // Deux clics aveugles suffisent alors à faire enregistrer un IBAN choisi par
  // un tiers.
  //
  // Correctif attendu : `frame-ancestors 'none'`, aucun pré-remplissage d'un
  // champ sensible depuis l'URL, et une confirmation qu'un clic aveugle ne peut
  // pas produire (ressaisie ou second facteur).
  const prefill = typeof req.query.iban === 'string' ? req.query.iban : '';
  const current = billingFor(user.tenantId);

  const dest = req.headers['sec-fetch-dest'];
  const site = req.headers['sec-fetch-site'];
  if (dest === 'iframe' && (site === 'cross-site' || site === 'same-site') && prefill) {
    framedPrefill.set(user.email, prefill.replace(/\s+/g, '').toUpperCase());
    audit(user.email, 'cadre.tiers', `page des coordonnées bancaires encadrée par ${site}, IBAN pré-rempli`);
  }

  res.type('html').send(page('Coordonnées bancaires', `
<h1>Coordonnées bancaires</h1>
<p class="muted">${esc(user.name)} · tenant ${esc(user.tenantId)}</p>
<div class="card">
  <p>IBAN de règlement enregistré : <span class="mono">${esc(current.iban)}</span></p>
  <form method="post" action="/api/billing/iban">
    <input name="iban" class="mono" size="34" value="${esc(prefill || current.iban)}">
    <button type="submit">Enregistrer</button>
  </form>
  <p class="muted">Le formulaire du portail partenaire poste en <code>application/x-www-form-urlencoded</code>.</p>
</div>`));
});

function applyIban(req: express.Request, res: express.Response): void {
  const user = surfaceUser(req);
  if (!user) { res.status(401).json({ error: 'session requise' }); return; }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const raw = String(body.iban ?? (typeof req.query.iban === 'string' ? req.query.iban : ''));
  const iban = raw.replace(/\s+/g, '').toUpperCase();
  if (!/^[A-Z]{2}[0-9A-Z]{12,32}$/.test(iban)) {
    res.status(400).json({ error: 'IBAN invalide' });
    return;
  }

  const before = billingFor(user.tenantId).iban;
  billingFor(user.tenantId).iban = iban;

  // ── Le point exact où l'invariant casse : une mutation a abouti sans preuve
  //    d'intention de l'utilisateur.
  if (req.overriddenFrom === 'GET') {
    audit(user.email, 'csrf.surcharge', `IBAN ${before} → ${iban} par une navigation GET`);
    solve('samesite-method-override');
  } else if (!req.csrfChecked) {
    audit(user.email, 'csrf.content-type', `IBAN ${before} → ${iban} sans vérification anti-CSRF`);
    solve('content-type-confusion');
  }
  if (framedPrefill.get(user.email) === iban) {
    framedPrefill.delete(user.email);
    audit(user.email, 'clickjacking', `IBAN ${iban} enregistré depuis un cadre tiers pré-rempli`);
    solve('clickjacking-prefilled');
  }

  if (String(req.headers.accept ?? '').includes('text/html')) {
    res.type('html').send(page('Coordonnées bancaires', `<h1>Enregistré</h1><p class="mono">${esc(iban)}</p>`));
    return;
  }
  res.json({ ok: true, iban });
}

surface.post('/billing/iban', applyIban);
surface.get('/billing/iban', (req, res) => {
  // Sans surcharge de méthode, un GET ne mute rien : il consulte.
  if (req.overriddenFrom) { applyIban(req, res); return; }
  const user = surfaceUser(req);
  if (!user) { res.status(401).json({ error: 'session requise' }); return; }
  res.json(billingFor(user.tenantId));
});

// ── Validation de paiement (clickjacking) ───────────────────────────────────

const framedPay = new Set<string>();

surface.get('/pay/confirm', (req, res) => {
  const user = surfaceUser(req);
  const dest = req.headers['sec-fetch-dest'];
  const site = req.headers['sec-fetch-site'];

  // VULNÉRABLE (clickjacking) : rien n'empêche cette page d'être chargée dans
  // une iframe sur un site tiers. Le serveur le constate ici — c'est exactement
  // ce que `frame-ancestors 'none'` aurait refusé.
  if (dest === 'iframe' && (site === 'cross-site' || site === 'same-site')) {
    framedPay.add(user?.email ?? 'anonyme');
    audit(user?.email ?? 'anonyme', 'cadre.tiers', `page de validation de paiement encadrée par ${site}`);
  }

  res.type('html').send(page('Valider le paiement', `
<h1>Valider le paiement</h1>
<div class="card">
  <p>Facture <span class="mono">INV-1001</span> — 490,00 € — Dupont &amp; Fils</p>
  <form method="post" action="/api/pay/confirm">
    <input type="hidden" name="invoice" value="INV-1001">
    <button type="submit">Valider le paiement</button>
  </form>
</div>`));
});

surface.post('/pay/confirm', (req, res) => {
  const user = surfaceUser(req);
  const who = user?.email ?? 'anonyme';
  const id = String(((req.body ?? {}) as Record<string, unknown>).invoice ?? 'INV-1001');

  if (framedPay.has(who)) {
    framedPay.delete(who);
    audit(who, 'clickjacking', `paiement de ${id} validé depuis un cadre tiers`);
    solve('clickjacking');
  }
  res.type('html').send(page('Paiement validé', `<h1>Paiement validé</h1><p class="mono">${esc(id)}</p>`));
});

// ── Lien public de facture (referrer-leak, csp-nonce-reuse, csp-gadget) ─────

const shares = new Map<string, string>(); // jeton → identifiant de facture

surface.get('/surface/share', (req, res) => {
  const user = surfaceUser(req);
  if (!user) { res.status(401).json({ error: 'session requise' }); return; }
  const id = typeof req.query.invoice === 'string' ? req.query.invoice : 'INV-1001';
  const invoice = db.invoices.find((i) => i.id === id && i.tenantId === user.tenantId);
  if (!invoice) { res.status(404).json({ error: 'facture introuvable' }); return; }

  // VULNÉRABLE (referrer-leak) : le jeton d'accès vit dans le chemin de l'URL.
  // Une URL part en `Referer`, dans les journaux du tiers, dans l'historique et
  // dans le presse-papier.
  //
  // Correctif attendu : le secret ne voyage pas dans une URL (jeton en corps de
  // requête, ou cookie d'accès posé par un échange unique), et
  // `Referrer-Policy: strict-origin-when-cross-origin` au minimum.
  const token = crypto.randomBytes(12).toString('hex');
  shares.set(token, invoice.id);
  res.json({ link: `/api/public/invoice/${token}`, token, invoice: invoice.id });
});

surface.get('/public/invoice/:token', (req, res) => {
  const id = shares.get(req.params.token);
  const invoice = id ? db.invoices.find((i) => i.id === id) : undefined;
  if (!invoice) {
    res.status(404).type('html').send(page('Facture', '<h1>Lien expiré</h1>'));
    return;
  }

  // La note est rendue telle quelle : c'est la CSP qui est censée tenir. Elle
  // tient, d'ailleurs — sauf contre son propre nonce constant (csp-nonce-reuse)
  // et contre le gadget de /api/vendor/ (csp-gadget).
  res.type('html').send(page(`Facture ${invoice.ref}`, `
<h1>Facture ${esc(invoice.ref)}</h1>
<p class="muted">${esc(invoice.client)} · ${invoice.total.toFixed(2)} €</p>
<div class="card">${invoice.note}</div>
<img src="/api/telemetry/pixel.gif" width="1" height="1" alt="">
<p class="muted">Mesure d’audience : <code>/api/telemetry/pixel.gif</code></p>`));
});

// Le « service tiers » chargé par la page : il journalise ce qu'on lui donne,
// c'est-à-dire l'URL complète de la page qui l'a chargé.
const PIXEL = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
surface.get('/telemetry/pixel.gif', (req, res) => {
  const referer = String(req.headers.referer ?? '');
  for (const token of shares.keys()) {
    if (referer.includes(token)) {
      audit('tiers', 'referer.fuite', `jeton de partage retrouvé dans les journaux du pixel : ${referer}`);
      solve('referrer-leak');
      break;
    }
  }
  res.type('image/gif').send(PIXEL);
});

// ── Le gadget de la liste blanche (csp-gadget) ──────────────────────────────

surface.get('/vendor/legacy-widget.js', (_req, res) => {
  // Bibliothèque « héritée » : elle exécute ce qu'elle lit dans un attribut de
  // données. Elle est parfaitement inoffensive seule — elle ne le devient que
  // parce que la CSP autorise son répertoire en bloc, et 'unsafe-eval' avec.
  res.type('application/javascript').send(
    `// novafact-legacy-widget 0.4 — configuration par attributs de données.
(function () {
  var nodes = document.querySelectorAll('[data-lab-action]');
  for (var i = 0; i < nodes.length; i++) {
    try { new Function('el', nodes[i].getAttribute('data-lab-action'))(nodes[i]); }
    catch (e) { console.warn('[legacy-widget]', e); }
  }
})();
`,
  );
});

// ── XS-Leak : comptage de cadres ────────────────────────────────────────────

surface.get('/surface/clients', (req, res) => {
  const user = surfaceUser(req);
  if (!user) { res.status(401).type('html').send(page('Clients', '<h1>Session requise</h1>')); return; }

  const q = typeof req.query.q === 'string' ? req.query.q : '';
  const hits = db.invoices.filter(
    (i) => i.tenantId === user.tenantId && q.length > 0 && i.client.toLowerCase().includes(q.toLowerCase()),
  );

  // VULNÉRABLE (xsleak-frame-count) : la page rend un cadre par résultat. Une
  // page tierce qui l'ouvre garde une référence sur la fenêtre et lit
  // `win.frames.length` — sans jamais lire le contenu.
  //
  // Correctif attendu : COOP (`same-origin`) coupe la référence, `frame-ancestors`
  // interdit l'encadrement, et le rendu doit être indiscernable : même nombre de
  // cadres, quel que soit le nombre de résultats.
  // `Sec-Fetch-Dest: document` sur une requête cross-site : la page a été
  // ouverte comme document de premier niveau par une origine tierce — un
  // window.open. Le navigateur pose ces deux en-têtes, le script ne peut pas.
  const site = req.headers['sec-fetch-site'];
  const dest = req.headers['sec-fetch-dest'];
  if (site === 'cross-site' && dest === 'document' && hits.length > 0) {
    audit(user.email, 'xsleak.frames', `${hits.length} cadre(s) observables depuis une page tierce pour « ${q} »`);
    solve('xsleak-frame-count');
  }

  const frames = hits.map((i) => `<iframe title="${esc(i.ref)}" src="/api/surface/invoice-card/${esc(i.id)}"></iframe>`).join('');
  res.type('html').send(page('Recherche de clients', `
<h1>Clients — « ${esc(q)} »</h1>
<div class="card">${frames || '<p class="muted">Aucun résultat.</p>'}</div>`));
});

surface.get('/surface/invoice-card/:id', (req, res) => {
  const invoice = db.invoices.find((i) => i.id === req.params.id);
  res.type('html').send(page('Facture', invoice ? `<p class="mono">${esc(invoice.ref)} · ${esc(invoice.client)}</p>` : '<p>—</p>'));
});

// ── XS-Leak : événements d'erreur ───────────────────────────────────────────

surface.get('/surface/invoice-asset/:id', (req, res) => {
  const id = req.params.id.replace(/\.(gif|png)$/, '');
  const invoice = db.invoices.find((i) => i.id === id);

  // VULNÉRABLE (xsleak-error-events) : la réponse diffère selon que la ressource
  // existe ou non — 200 contre 404 — et aucune politique de ressource
  // inter-origines n'empêche une page tierce de la charger en <img> pour lire
  // onload/onerror. L'existence d'une facture est elle-même une information.
  const site = req.headers['sec-fetch-site'];
  const dest = req.headers['sec-fetch-dest'];
  if (invoice && site === 'cross-site' && dest === 'image') {
    audit('anonyme', 'xsleak.erreur', `existence de ${invoice.id} (tenant ${invoice.tenantId}) révélée à une page tierce`);
    solve('xsleak-error-events');
  }

  if (!invoice) { res.status(404).json({ error: 'facture introuvable' }); return; }
  res.type('image/gif').send(PIXEL);
});

// ── Points d'appui des exercices du navigateur ──────────────────────────────

/**
 * Balise appelée par une charge utile qui s'est exécutée DANS l'origine de
 * l'application. `Sec-Fetch-Site` est posé par le navigateur : JavaScript ne
 * peut pas le forger, c'est ce qui rend le constat honnête. Chaque exercice
 * ajoute sa propre preuve de mécanisme.
 */
surface.get('/surface/beacon', (req, res) => {
  const sameOrigin = req.headers['sec-fetch-site'] === 'same-origin';
  const ex = typeof req.query.ex === 'string' ? req.query.ex : '';
  const noteHas = (re: RegExp) => db.invoices.some((i) => re.test(i.note));

  const refusal = (why: string) => res.status(400).json({ ok: false, sameOrigin, hint: why });

  if (!sameOrigin) {
    refusal('Cette balise doit être appelée par le navigateur, depuis une page de l’application.');
    return;
  }

  switch (ex) {
    case 'csp-nonce-reuse':
      // Preuve de mécanisme : la charge utile porte le nonce de la CSP. On ne
      // le connaît qu'en lisant l'en-tête d'une réponse précédente — c'est
      // précisément ce qu'un nonce tiré par réponse rendrait impossible.
      if (req.query.nonce !== CSP_NONCE) { refusal('Le nonce transmis n’est pas celui de la CSP.'); return; }
      if (!noteHas(/<script[^>]*\bnonce=/i)) { refusal('Aucune note de facture ne contient de script à nonce.'); return; }
      audit('navigateur', 'csp.nonce', 'script inline exécuté avec le nonce constant de la CSP');
      solve('csp-nonce-reuse');
      break;

    case 'csp-gadget':
      if (!noteHas(/data-lab-action\s*=/i)) { refusal('Aucune note ne câble le gadget de /api/vendor/.'); return; }
      audit('navigateur', 'csp.gadget', 'script exécuté via une origine autorisée en bloc');
      solve('csp-gadget');
      break;

    case 'trusted-types-default':
      if (req.query.policy !== 'default') { refusal('Indique la politique traversée : &policy=default.'); return; }
      audit('navigateur', 'trusted-types', 'puits DOM atteint malgré Trusted Types : la politique par défaut rend l’identité');
      solve('trusted-types-default');
      break;

    case 'react-javascript-url':
      if (req.query.scheme !== 'javascript') { refusal('Indique le schéma utilisé : &scheme=javascript.'); return; }
      audit('navigateur', 'xss.url', 'URL javascript: exécutée depuis un href rendu par React');
      solve('react-javascript-url');
      break;

    case 'client-proto-pollution':
      if (req.query.gadget !== 'proto') { refusal('Indique le gadget utilisé : &gadget=proto.'); return; }
      audit('navigateur', 'prototype.client', 'attribut rendu par React via une propriété héritée d’Object.prototype');
      solve('client-proto-pollution');
      break;

    default:
      refusal('Paramètre ex inconnu.');
      return;
  }
  res.json({ ok: true, ex });
});

/**
 * L'origine « de collecte » vers laquelle le DOM clobbering détourne les appels
 * d'API. Le constat : une requête de l'application (jeton Bearer, même origine)
 * est arrivée sur un chemin de base qui n'est pas le sien.
 */
const APP_PATHS = new Set(['/invoices', '/me', '/settings', '/credits', '/branding']);
surface.all('/surface/collect/*', (req, res) => {
  const rest = `/${(req.params as unknown as Record<string, string>)[0] ?? ''}`.replace(/\/+$/, '');
  const base = rest.split('/').slice(0, 2).join('/');
  if (req.headers['sec-fetch-site'] === 'same-origin' && req.headers.authorization && APP_PATHS.has(base)) {
    audit('navigateur', 'dom.clobbering', `appel d’API de l’application détourné vers ${req.originalUrl}`);
    solve('dom-clobbering');
  }
  res.json({ ok: true, collected: rest });
});

/**
 * Callback de paiement, appelé par la page de paiement quand elle accepte un
 * message. Elle transmet l'origine du message : si ce n'est pas la sienne, elle
 * vient d'accepter une confirmation de paiement d'un inconnu.
 */
surface.post('/surface/payment-callback', (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const origin = String(body.origin ?? '');
  const invoice = String(body.invoice ?? '');
  const sameOrigin = req.headers['sec-fetch-site'] === 'same-origin';
  const own = /^https?:\/\/(127\.0\.0\.1|localhost):5199$/.test(origin);

  if (sameOrigin && origin && !own) {
    audit('navigateur', 'postmessage', `confirmation de paiement de ${invoice} acceptée depuis ${origin}`);
    solve('postmessage-origin');
  }
  res.json({ ok: true, invoice, origin });
});

/**
 * Le service d'audience qui accepte la clé publiée dans le bundle.
 * Le constat : la clé a été rejouée HORS de l'application — aucune en-tête
 * Fetch Metadata, donc pas depuis une page du navigateur.
 */
// La même valeur (fictive et inerte) est livrée dans src/api.ts, donc dans le
// bundle que le navigateur télécharge.
const PUBLISHED_ANALYTICS_KEY = 'nvf_live_pk_8Qd2LzR4mKx7Tb1eH0aS';
surface.get('/surface/analytics', (req, res) => {
  const key = req.headers['x-novafact-key'] ?? req.query.key;
  if (key === PUBLISHED_ANALYTICS_KEY && !req.headers['sec-fetch-site']) {
    audit('anonyme', 'secret.bundle', 'clé d’API du bundle rejouée hors de l’application');
    solve('secret-in-bundle');
  }
  res.json({ ok: key === PUBLISHED_ANALYTICS_KEY, service: 'novafact-analytics' });
});

// ── Endpoint de diagnostic ──────────────────────────────────────────────────

/**
 * VULNÉRABLE (debug-endpoint) : route ajoutée « le temps d'une investigation »,
 * jamais retirée, jamais authentifiée, absente de la documentation d'API.
 *
 * Toutes les valeurs ci-dessous sont fictives et inertes — c'est un lab.
 *
 * Correctif attendu : inventaire des routes réellement montées en production,
 * rien de diagnostique qui ne soit authentifié, tracé et limité dans le temps.
 * Vérifier la documentation fait partie des tests de sécurité.
 */
app.get('/api/debug/config', (req, res) => {
  audit(req.user?.email ?? 'anonyme', 'debug.exposé', 'configuration complète servie sans authentification');
  solve('debug-endpoint');
  res.json({
    service: 'novafact-api',
    commit: 'c0ffee1234567890fedcba9876543210deadbeef',
    node: process.version,
    env: {
      NODE_ENV: 'staging',
      DATABASE_URL: 'postgres://novafact:EXEMPLE-INERTE@db.invalid:5432/novafact',
      SESSION_SECRET: 'EXEMPLE-INERTE-session-secret-0000',
      STRIPE_SECRET_KEY: 'sk_test_EXEMPLE_INERTE_0000000000',
      AWS_ACCESS_KEY_ID: 'AKIAEXEMPLEINERTE000',
      AWS_SECRET_ACCESS_KEY: 'EXEMPLE/INERTE/000000000000000000000000',
      SMTP_URL: 'smtp://novafact:EXEMPLE-INERTE@smtp.invalid:587',
    },
    csp: CSP,
    csrfToken: CSRF_TOKEN,
  });
});

app.use('/api', surface);

app.get('/api/health', (_req, res) => res.json({ ok: true, lab: 'novafact', vulnerable: true }));

// Gestionnaire d'erreurs : volontairement bavard (A10:2025), comme une prod mal
// configurée. Le correctif tient en deux lignes — voir SOLUTIONS.md.
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: err.message, stack: err.stack });
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

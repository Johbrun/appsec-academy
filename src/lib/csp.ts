// Évaluateur CSP pour le jeu CSP Builder.
//
// Il décide si une ressource ou une action est autorisée par une politique, en
// suivant les algorithmes de CSP niveau 3 (W3C, brouillon de l'éditeur) tels que
// les implémentent les navigateurs actuels :
//
//   · replis : script-src-elem → script-src → default-src, style-src-attr →
//     style-src → default-src, frame-src → child-src → default-src… ;
//     base-uri, form-action, frame-ancestors et les directives Trusted Types
//     n'ont AUCUN repli (§ 6.8.3) ;
//   · 'none' ne vaut que seul : « 'none' https://a.example » autorise a.example
//     (§ 6.7.2.7) ;
//   · '*' ne couvre que les schémas réseau (http, https, ws, wss), jamais
//     data: ni blob: ; 'self' ne couvre jamais blob: (§ 6.7.2.8) ;
//   · un joker d'hôte « *.a.example » couvre les sous-domaines, pas a.example ;
//     une expression avec chemin se termine par « / » (préfixe) ou désigne un
//     fichier exact — et le chemin est ignoré après une redirection (§ 7.6) ;
//   · 'unsafe-inline' est ignoré dès que la liste contient un nonce ou une
//     empreinte, et aussi 'strict-dynamic' pour les scripts (§ 6.7.3.2) ;
//   · 'strict-dynamic' : un script porteur du nonce passe ; un script inséré
//     par programme (non « parser-inserted ») passe quelle que soit son URL ;
//     tout le reste — listes d'hôtes, schémas, 'self' — est ignoré (§ 6.7.1.1) ;
//   · eval() et consorts ne regardent que script-src puis default-src et
//     exigent 'unsafe-eval' (§ 4.4.1) ; sous Trusted Types, une chaîne passée à
//     eval est de plus refusée faute de politique « default » ;
//   · require-trusted-types-for 'script' refuse les chaînes brutes dans les
//     sinks DOM (innerHTML, script.src…) ; trusted-types restreint les noms de
//     politiques qu'on peut créer.
//
// Ce qu'il ne modélise pas : les ports explicites (hors défaut), 'unsafe-hashes',
// les empreintes de scripts externes (intégrité SRI), les workers, les
// politiques multiples et le mode Report-Only.

export type Directive =
  | 'default-src'
  | 'script-src' | 'script-src-elem' | 'script-src-attr'
  | 'style-src' | 'style-src-elem' | 'style-src-attr'
  | 'img-src' | 'font-src' | 'connect-src' | 'media-src' | 'object-src'
  | 'child-src' | 'frame-src' | 'worker-src' | 'manifest-src'
  | 'base-uri' | 'form-action' | 'frame-ancestors'
  | 'require-trusted-types-for' | 'trusted-types';

export type Policy = Partial<Record<Directive, string[]>>;

/** Origine par défaut de la page protégée (l'application Novafact). */
export const SELF = 'https://app.novafact.example';
/** Le nonce que le serveur pose sur ses propres balises. */
export const NONCE = "'nonce-r4nd0m'";

type FetchDirective = 'img-src' | 'font-src' | 'connect-src' | 'media-src' | 'object-src' | 'frame-src' | 'manifest-src';

export type Action =
  /**
   * Un élément <script>. Sans `url`, c'est un script inline. `dynamic` : inséré
   * par un script déjà en place (createElement), donc non « parser-inserted ».
   * `redirectTo` : l'URL demandée répond par une redirection vers cette URL.
   * `viaStringSink` : l'URL est affectée à script.src sous forme de chaîne.
   */
  | { kind: 'script'; url?: string; nonce?: boolean; hash?: string; dynamic?: boolean; redirectTo?: string; viaStringSink?: boolean }
  /** Gestionnaire inline (onclick=, onerror=) ou URL javascript:. */
  | { kind: 'handler' }
  /** eval(), new Function(), setTimeout('chaîne'). */
  | { kind: 'eval' }
  /** Feuille de style externe (avec `url`) ou élément <style> inline. */
  | { kind: 'style'; url?: string; nonce?: boolean; hash?: string }
  /** Attribut style="…" dans le balisage. */
  | { kind: 'style-attr' }
  | { kind: 'fetch'; directive: FetchDirective; url: string; redirectTo?: string }
  | { kind: 'base'; url: string }
  | { kind: 'form'; url: string }
  | { kind: 'framed-by'; origin: string }
  /** Une chaîne brute affectée à un sink DOM (innerHTML, outerHTML…). */
  | { kind: 'sink' }
  /** trustedTypes.createPolicy(name, …). */
  | { kind: 'tt-policy'; name: string };

export interface Verdict { allowed: boolean; why: string }

// ── Replis (§ 6.8.3) ────────────────────────────────────────────────────────

const FALLBACK: Partial<Record<Directive, Directive[]>> = {
  'script-src': ['script-src', 'default-src'],
  'script-src-elem': ['script-src-elem', 'script-src', 'default-src'],
  'script-src-attr': ['script-src-attr', 'script-src', 'default-src'],
  'style-src': ['style-src', 'default-src'],
  'style-src-elem': ['style-src-elem', 'style-src', 'default-src'],
  'style-src-attr': ['style-src-attr', 'style-src', 'default-src'],
  'worker-src': ['worker-src', 'child-src', 'script-src', 'default-src'],
  'frame-src': ['frame-src', 'child-src', 'default-src'],
  'child-src': ['child-src', 'default-src'],
  'img-src': ['img-src', 'default-src'],
  'font-src': ['font-src', 'default-src'],
  'connect-src': ['connect-src', 'default-src'],
  'media-src': ['media-src', 'default-src'],
  'object-src': ['object-src', 'default-src'],
  'manifest-src': ['manifest-src', 'default-src'],
};

/** La directive qui s'applique réellement, après les replis. */
export function effective(p: Policy, d: Directive): { dir: Directive; list: string[] } | null {
  for (const name of FALLBACK[d] ?? [d]) {
    const list = p[name];
    if (list) return { dir: name, list };
  }
  return null;
}

// ── Correspondance d'URL (§ 6.7.2.7 à 6.7.2.12) ─────────────────────────────

interface Parsed { scheme: string; host: string; port: string; path: string }

function parse(url: string): Parsed | null {
  try {
    const u = new URL(url);
    return { scheme: u.protocol.slice(0, -1), host: u.hostname, port: u.port, path: u.pathname };
  } catch { return null; }
}

const NETWORK = ['http', 'https', 'ws', 'wss'];

function schemeMatch(a: string, b: string): boolean {
  if (a === b) return true;
  if (a === 'http') return b === 'https';
  if (a === 'ws') return ['wss', 'http', 'https'].includes(b);
  if (a === 'wss') return b === 'https';
  return false;
}

function hostMatch(pattern: string, host: string): boolean {
  if (!host) return false;
  if (pattern === '*') return true;
  if (pattern.startsWith('*.')) return host.endsWith(pattern.slice(1));
  return pattern === host;
}

function pathMatch(a: string, b: string): boolean {
  if (!a) return true;
  if (a === '/' && !b) return true;
  const exact = !a.endsWith('/');
  const la = a.split('/');
  const lb = b.split('/');
  if (la.length > lb.length) return false;
  if (exact && la.length !== lb.length) return false;
  if (!exact) la.pop();
  return la.every((piece, i) => decodeURIComponent(piece) === decodeURIComponent(lb[i]));
}

const HOST_SOURCE = /^(?:([a-z][a-z0-9+.-]*):\/\/)?(\*|\*\.[^/:]+|[^/:*]+)(?::(\d+|\*))?(\/.*)?$/i;
const SCHEME_SOURCE = /^[a-z][a-z0-9+.-]*:$/i;

function matchesExpression(tok: string, url: string, self: string, redirects: number): boolean {
  const u = parse(url);
  const s = parse(self)!;
  if (!u) return false;
  if (tok === '*') return NETWORK.includes(u.scheme) || u.scheme === s.scheme;
  if (tok === "'self'") {
    if (u.scheme === 'blob') return false;
    if (u.scheme === s.scheme && u.host === s.host && u.port === s.port) return true;
    return u.host === s.host && u.port === '' && s.port === '' && (u.scheme === 'https' || u.scheme === 'wss');
  }
  if (tok.startsWith("'")) return false; // 'none', nonces, empreintes et autres mots-clés
  if (SCHEME_SOURCE.test(tok)) return schemeMatch(tok.slice(0, -1).toLowerCase(), u.scheme);
  const m = HOST_SOURCE.exec(tok);
  if (!m) return false;
  const [, scheme, host, port, path] = m;
  if (!u.host) return false;
  if (!schemeMatch((scheme ?? s.scheme).toLowerCase(), u.scheme)) return false;
  if (!hostMatch(host.toLowerCase(), u.host)) return false;
  if (port && port !== '*' && port !== u.port) return false;
  if (!port && u.port !== '') return false;
  // Après une redirection, le chemin n'est plus comparé (§ 7.6).
  if (path && redirects === 0 && !pathMatch(path, u.path)) return false;
  return true;
}

/** Le premier jeton de la liste qui couvre l'URL, ou null. */
export function matchingToken(list: string[], url: string, self = SELF, redirects = 0): string | null {
  // « 'none' » seul ne couvre rien ; accompagné, il est sans effet.
  return list.find((tok) => matchesExpression(tok, url, self, redirects)) ?? null;
}

// ── Inline (§ 6.7.3.2) ──────────────────────────────────────────────────────

const isNonceOrHash = (tok: string) => /^'(nonce|sha256|sha384|sha512)-/.test(tok);

/** 'unsafe-inline' est-il effectif ? Et sinon, pourquoi ? */
function allInline(list: string[], script: boolean): { ok: boolean; why?: string } {
  if (!list.includes("'unsafe-inline'")) return { ok: false };
  if (list.some(isNonceOrHash)) return { ok: false, why: "'unsafe-inline' est ignoré : la liste contient un nonce ou une empreinte" };
  if (script && list.includes("'strict-dynamic'")) return { ok: false, why: "'unsafe-inline' est ignoré en présence de 'strict-dynamic'" };
  return { ok: true };
}

const via = (dir: Directive, asked: Directive) => (dir === asked ? dir : `${dir} (repli de ${asked})`);
const none = (asked: Directive) => `aucune directive ne s’applique (ni ${(FALLBACK[asked] ?? [asked]).join(', ni ')})`;

function inlineVerdict(list: string[], dir: string, script: boolean, what: string): Verdict {
  const u = allInline(list, script);
  if (u.ok) return { allowed: true, why: `${dir} contient 'unsafe-inline' : tout ${what} inline passe` };
  return { allowed: false, why: u.why ? `${u.why} (${dir})` : `${dir} n’autorise pas ${what} inline` };
}

function urlVerdict(e: { dir: Directive; list: string[] }, asked: Directive, url: string, self: string, redirectTo?: string): Verdict {
  const where = via(e.dir, asked);
  const first = matchingToken(e.list, url, self, 0);
  if (!first) return { allowed: false, why: `${where} ne couvre pas ${url}` };
  if (!redirectTo) return { allowed: true, why: `couvert par ${first} dans ${where}` };
  const second = matchingToken(e.list, redirectTo, self, 1);
  if (!second) return { allowed: false, why: `${url} passe (${first}), mais la redirection vers ${redirectTo} n’est pas couverte` };
  return {
    allowed: true,
    why: `${url} passe (${first}), puis la redirection vers ${redirectTo} passe aussi (${second}) : après une redirection, le chemin n’est plus comparé`,
  };
}

// ── Verdict ─────────────────────────────────────────────────────────────────

const trustedTypesEnforced = (p: Policy) => (p['require-trusted-types-for'] ?? []).includes("'script'");

export function verdict(p: Policy, a: Action, self = SELF): Verdict {
  switch (a.kind) {
    case 'base': {
      const list = p['base-uri'];
      if (!list) return { allowed: true, why: 'base-uri absente, et elle n’a pas de repli sur default-src' };
      const tok = matchingToken(list, a.url, self);
      return tok ? { allowed: true, why: `couvert par ${tok} dans base-uri` } : { allowed: false, why: 'base-uri ne couvre pas cette URL' };
    }
    case 'form': {
      const list = p['form-action'];
      if (!list) return { allowed: true, why: 'form-action absente, et elle n’a pas de repli sur default-src' };
      const tok = matchingToken(list, a.url, self);
      return tok ? { allowed: true, why: `couvert par ${tok} dans form-action` } : { allowed: false, why: `form-action ne couvre pas ${a.url}` };
    }
    case 'framed-by': {
      const list = p['frame-ancestors'];
      if (!list) return { allowed: true, why: 'frame-ancestors absente, et elle n’a pas de repli sur default-src' };
      const tok = matchingToken(list, a.origin, self);
      return tok ? { allowed: true, why: `couvert par ${tok} dans frame-ancestors` } : { allowed: false, why: `frame-ancestors ne couvre pas ${a.origin}` };
    }
    case 'sink':
      return trustedTypesEnforced(p)
        ? { allowed: false, why: 'require-trusted-types-for \'script\' : le sink refuse une chaîne brute' }
        : { allowed: true, why: 'sans require-trusted-types-for, un sink DOM accepte n’importe quelle chaîne' };
    case 'tt-policy': {
      const list = p['trusted-types'];
      if (!list) return { allowed: true, why: 'trusted-types absente : tout nom de politique est accepté' };
      if (list.includes('*')) return { allowed: true, why: 'trusted-types contient * : tout nom est accepté' };
      if (list.includes(a.name)) return { allowed: true, why: `trusted-types autorise le nom « ${a.name} »` };
      return { allowed: false, why: `trusted-types n’autorise pas le nom « ${a.name} »` };
    }
    case 'eval': {
      if (trustedTypesEnforced(p)) return { allowed: false, why: 'Trusted Types : eval refuse une chaîne brute sans politique « default »' };
      const e = effective(p, 'script-src');
      if (!e) return { allowed: true, why: 'ni script-src ni default-src : eval est libre' };
      return e.list.includes("'unsafe-eval'")
        ? { allowed: true, why: `${via(e.dir, 'script-src')} contient 'unsafe-eval'` }
        : { allowed: false, why: `${via(e.dir, 'script-src')} ne contient pas 'unsafe-eval'` };
    }
    case 'handler': {
      const e = effective(p, 'script-src-attr');
      if (!e) return { allowed: true, why: none('script-src-attr') };
      return inlineVerdict(e.list, via(e.dir, 'script-src-attr'), true, 'gestionnaire');
    }
    case 'style-attr': {
      const e = effective(p, 'style-src-attr');
      if (!e) return { allowed: true, why: none('style-src-attr') };
      return inlineVerdict(e.list, via(e.dir, 'style-src-attr'), false, 'attribut style');
    }
    case 'style': {
      const e = effective(p, 'style-src-elem');
      if (!e) return { allowed: true, why: none('style-src-elem') };
      const where = via(e.dir, 'style-src-elem');
      if (a.nonce && e.list.includes(NONCE)) return { allowed: true, why: `nonce valide (${where})` };
      if (!a.url) {
        if (a.hash && e.list.includes(a.hash)) return { allowed: true, why: `empreinte reconnue (${where})` };
        return inlineVerdict(e.list, where, false, 'style');
      }
      return urlVerdict(e, 'style-src-elem', a.url, self);
    }
    case 'script': {
      if (a.viaStringSink && trustedTypesEnforced(p)) {
        return { allowed: false, why: 'Trusted Types : script.src refuse une chaîne, il faut une TrustedScriptURL' };
      }
      const e = effective(p, 'script-src-elem');
      if (!e) return { allowed: true, why: none('script-src-elem') };
      const where = via(e.dir, 'script-src-elem');
      if (a.nonce && e.list.includes(NONCE)) return { allowed: true, why: `nonce valide (${where})` };
      if (!a.url) {
        if (a.hash && e.list.includes(a.hash)) return { allowed: true, why: `empreinte reconnue (${where})` };
        return inlineVerdict(e.list, where, true, 'script');
      }
      if (e.list.includes("'strict-dynamic'")) {
        return a.dynamic
          ? { allowed: true, why: `'strict-dynamic' : inséré par un script de confiance, son URL n’est pas examinée (${where})` }
          : { allowed: false, why: `'strict-dynamic' ignore listes d’hôtes, schémas et 'self' : sans nonce, une balise du document est refusée (${where})` };
      }
      return urlVerdict(e, 'script-src-elem', a.url, self, a.redirectTo);
    }
    case 'fetch': {
      const e = effective(p, a.directive);
      if (!e) return { allowed: true, why: none(a.directive) };
      return urlVerdict(e, a.directive, a.url, self, a.redirectTo);
    }
  }
}

export const allows = (p: Policy, a: Action, self = SELF) => verdict(p, a, self).allowed;

export function serialize(p: Policy): string {
  return (Object.entries(p) as [Directive, string[]][])
    .filter(([, v]) => v.length)
    .map(([k, v]) => `${k} ${v.join(' ')}`)
    .join('; ');
}

// Évaluateur CSP simplifié (sous-ensemble de CSP niveau 3) pour le jeu CSP Builder.
// Il décide si une ressource ou une action est autorisée par une politique.

export type Directive =
  | 'default-src' | 'script-src' | 'style-src' | 'img-src' | 'connect-src' | 'frame-src'
  | 'object-src' | 'base-uri' | 'form-action' | 'frame-ancestors' | 'require-trusted-types-for';

export type Policy = Partial<Record<Directive, string[]>>;

export const SELF = 'https://app.novafact.example';
export const NONCE = "'nonce-r4nd0m'";

const FALLBACK: Partial<Record<Directive, Directive>> = {
  'script-src': 'default-src', 'style-src': 'default-src', 'img-src': 'default-src',
  'connect-src': 'default-src', 'frame-src': 'default-src', 'object-src': 'default-src',
};

export type Action =
  | { kind: 'fetch'; directive: Directive; url?: string; inline?: boolean; nonce?: boolean; eval?: boolean; dynamic?: boolean }
  | { kind: 'base'; url: string }
  | { kind: 'form'; url: string }
  | { kind: 'framed-by'; origin: string }
  | { kind: 'sink' };

const origin = (url: string) => {
  try { const u = new URL(url); return u.protocol === 'data:' ? 'data:' : u.origin; } catch { return url; }
};

function matches(list: string[], url: string): boolean {
  if (list.includes("'none'")) return false;
  const o = origin(url);
  return list.some((tok) => {
    if (tok === '*') return o !== 'data:';
    if (tok === "'self'") return o === SELF;
    if (tok === 'https:') return o.startsWith('https://');
    if (tok === 'data:') return o === 'data:';
    return tok === o;
  });
}

const effective = (p: Policy, d: Directive) => p[d] ?? (FALLBACK[d] ? p[FALLBACK[d]!] : undefined);

export function allows(p: Policy, a: Action): boolean {
  switch (a.kind) {
    case 'base': return p['base-uri'] ? matches(p['base-uri'], a.url) : true;
    case 'form': return p['form-action'] ? matches(p['form-action'], a.url) : true;
    case 'framed-by': return p['frame-ancestors'] ? matches(p['frame-ancestors'], a.origin) : true;
    case 'sink': return !(p['require-trusted-types-for'] ?? []).includes("'script'");
    case 'fetch': {
      const list = effective(p, a.directive);
      if (!list) return true;
      if (a.directive === 'script-src') {
        const hasNonce = list.includes(NONCE);
        const strict = list.includes("'strict-dynamic'");
        if (a.eval) return list.includes("'unsafe-eval'");
        if (a.inline) {
          if (a.nonce && hasNonce) return true;
          if (hasNonce || strict) return false;           // 'unsafe-inline' est ignoré en présence d'un nonce
          return list.includes("'unsafe-inline'");
        }
        if (a.nonce && hasNonce) return true;
        if (strict) return !!a.dynamic;                    // listes de domaines et 'self' ignorés
        return matches(list, a.url ?? '');
      }
      if (a.directive === 'style-src' && a.inline) return list.includes("'unsafe-inline'");
      return matches(list, a.url ?? '');
    }
  }
}

export function serialize(p: Policy): string {
  return (Object.entries(p) as [Directive, string[]][])
    .filter(([, v]) => v.length)
    .map(([k, v]) => `${k} ${v.join(' ')}`)
    .join('; ');
}

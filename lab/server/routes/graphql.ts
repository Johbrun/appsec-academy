// L'API GraphQL interne de Novafact, exposée au front « le temps de la
// migration ».
//
// Exercices portés par ce fichier :
//   · graphql-introspection  introspection ouverte + aucune limite de coût
//   · graphql-clairvoyance   les suggestions d'erreur reconstruisent le schéma
//   · graphql-csrf           le point d'accès accepte le formulaire encodé
//   · graphql-batching       la limitation de débit compte les requêtes HTTP,
//                            pas les opérations
//
// Le moteur est écrit à la main : pas de dépendance, et le défaut reste lisible.
// Ce n'est pas un GraphQL conforme — c'est le sous-ensemble qui suffit à montrer
// que le problème n'est pas dans le langage, mais dans l'absence de limites.

import { Router } from 'express';
import { audit, db, solve } from '../store.ts';

export const graphqlRoutes = Router();

// ── Schéma ──────────────────────────────────────────────────────────────────
//
// `hidden: true` : le champ existe, il se résout, mais il ne figure pas dans la
// réponse d'introspection. C'est le réflexe classique — « on le retire du
// schéma public » — et c'est exactement ce que graphql-clairvoyance démonte.

interface FieldDef { type: string; hidden?: boolean; args?: string[]; }
interface TypeDef { name: string; fields: Record<string, FieldDef>; }

const SCHEMA: Record<string, TypeDef> = {
  Query: {
    name: 'Query',
    fields: {
      me: { type: 'User' },
      invoice: { type: 'Invoice', args: ['id'] },
      invoices: { type: 'Invoice' },
    },
  },
  Mutation: {
    name: 'Mutation',
    fields: {
      setBillingAddress: { type: 'User', args: ['address'] },
      verifyCode: { type: 'Verification', args: ['code'] },
    },
  },
  User: {
    name: 'User',
    fields: {
      email: { type: 'String' },
      name: { type: 'String' },
      role: { type: 'String' },
      tenantId: { type: 'String' },
      billingAddress: { type: 'String' },
      invoices: { type: 'Invoice' },
      // Champ non documenté : absent de l'introspection, parfaitement résolvable.
      internalCreditScore: { type: 'String', hidden: true },
    },
  },
  Invoice: {
    name: 'Invoice',
    fields: {
      id: { type: 'String' },
      ref: { type: 'String' },
      client: { type: 'String' },
      status: { type: 'String' },
      total: { type: 'String' },
      note: { type: 'String' },
      owner: { type: 'User' },
      // Idem : la marge interne n'est pas dans le schéma public.
      internalMargin: { type: 'String', hidden: true },
    },
  },
  Verification: {
    name: 'Verification',
    fields: { ok: { type: 'String' }, attempts: { type: 'String' } },
  },
};

// ── Analyseur : un sous-ensemble suffisant ──────────────────────────────────

interface Node { alias: string; field: string; args: Record<string, string>; selection: Node[]; }

// Expression collante : on avance l'index sans jamais recopier la chaîne. Un
// document de dix mille alias doit rester analysable en une passe — c'est la
// condition pour que graphql-batching soit jouable.
const NAME = /[A-Za-z_][A-Za-z0-9_]*/y;

function parseSelection(src: string, at: { i: number }): Node[] {
  const out: Node[] = [];
  const skip = (re: RegExp) => { while (at.i < src.length && re.test(src[at.i])) at.i++; };

  for (;;) {
    skip(/[\s,]/);
    if (at.i >= src.length || src[at.i] === '}') { at.i++; return out; }

    NAME.lastIndex = at.i;
    const nameMatch = NAME.exec(src);
    if (!nameMatch) { at.i++; continue; }
    const alias = nameMatch[0];
    let field = alias;
    at.i = NAME.lastIndex;

    skip(/\s/);
    if (src[at.i] === ':') {
      at.i++;
      skip(/\s/);
      NAME.lastIndex = at.i;
      const realName = NAME.exec(src);
      if (realName) { field = realName[0]; at.i = NAME.lastIndex; }
    }

    const args: Record<string, string> = {};
    skip(/\s/);
    if (src[at.i] === '(') {
      const close = src.indexOf(')', at.i);
      const raw = src.slice(at.i + 1, close === -1 ? src.length : close);
      for (const pair of raw.split(',')) {
        const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:\s*"?([^",]*)"?\s*$/.exec(pair);
        if (m) args[m[1]] = m[2];
      }
      at.i = close === -1 ? src.length : close + 1;
    }

    let selection: Node[] = [];
    skip(/\s/);
    if (src[at.i] === '{') { at.i++; selection = parseSelection(src, at); }

    out.push({ alias, field, args, selection });
  }
}

function parseDocument(query: string): { operation: 'query' | 'mutation'; selection: Node[] } {
  const trimmed = query.trim();
  const head = /^(query|mutation)\b[^{]*/.exec(trimmed);
  const operation = (head?.[1] ?? 'query') as 'query' | 'mutation';
  const start = trimmed.indexOf('{', head ? head[0].length - 1 : 0);
  if (start === -1) throw new Error('document vide');
  const at = { i: start + 1 };
  return { operation, selection: parseSelection(trimmed, at) };
}

const depthOf = (nodes: Node[]): number =>
  nodes.length === 0 ? 0 : 1 + Math.max(...nodes.map((n) => depthOf(n.selection)));

const countNodes = (nodes: Node[]): number =>
  nodes.reduce((n, node) => n + 1 + countNodes(node.selection), 0);

// ── Introspection ───────────────────────────────────────────────────────────

/**
 * VULNÉRABLE (graphql-introspection) : l'introspection est servie à tout le
 * monde, sans authentification.
 *
 * Correctif attendu : introspection désactivée hors développement — et, comme
 * elle n'est pas un contrôle d'accès, l'autorisation vérifiée dans CHAQUE
 * résolveur.
 */
function introspect(): unknown {
  return {
    types: Object.values(SCHEMA).map((t) => ({
      name: t.name,
      fields: Object.entries(t.fields)
        .filter(([, f]) => !f.hidden)
        .map(([name, f]) => ({ name, type: { name: f.type }, args: (f.args ?? []).map((a) => ({ name: a })) })),
    })),
    queryType: { name: 'Query' },
    mutationType: { name: 'Mutation' },
  };
}

// ── Suggestions ─────────────────────────────────────────────────────────────

const distance = (a: string, b: string): number => {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
};

/**
 * VULNÉRABLE (graphql-clairvoyance) : le message d'erreur propose les champs
 * voisins — y compris ceux qui ont été retirés de l'introspection. Couper
 * l'introspection sans couper les suggestions ne fait que ralentir la
 * cartographie : elle se reconstruit champ par champ, à coups de fautes de
 * frappe.
 *
 * Correctif attendu : suggestions désactivées en production et erreurs
 * génériques. L'obscurité n'est de toute façon pas le contrôle — l'autorisation
 * par résolveur l'est.
 */
function suggest(type: TypeDef, unknownField: string): string[] {
  return Object.keys(type.fields)
    .map((name) => ({ name, d: distance(name.toLowerCase(), unknownField.toLowerCase()) }))
    .filter((c) => c.d <= Math.max(2, Math.floor(unknownField.length / 3)))
    .sort((a, b) => a.d - b.d)
    .slice(0, 3)
    .map((c) => c.name);
}

// ── Résolveurs ──────────────────────────────────────────────────────────────

const billingAddresses = new Map<string, string>();
const addressFor = (email: string) => billingAddresses.get(email) ?? '12 rue de la Comptabilité, 44000 Nantes';

/** Code de validation à quatre chiffres, tiré au démarrage. */
let verificationCode = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
let verifyAttempts = 0;

export const resetGraphqlState = (): void => {
  billingAddresses.clear();
  verificationCode = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  verifyAttempts = 0;
  httpHits.clear();
  introspected.clear();
};

interface Ctx {
  email: string;
  tenantId: string;
  /** Nombre d'appels de résolveurs sensibles dans CETTE requête HTTP. */
  sensitiveCalls: number;
  foundCode: boolean;
  mutated: boolean;
  usedHidden: boolean;
  /** Nombre de champs réellement résolus — le vrai coût de la requête. */
  resolved: number;
}

function invoiceSource(id: string) {
  return db.invoices.find((i) => i.id === id);
}

function resolveField(typeName: string, node: Node, source: Record<string, unknown>, ctx: Ctx): unknown {
  const type = SCHEMA[typeName];
  const def = type?.fields[node.field];
  if (def && typeName === 'Query' && node.field === 'invoice') {
    // Aucun contrôle de tenant : l'autorisation n'est vérifiée qu'à l'entrée du
    // point d'accès, jamais dans les résolveurs.
    const found = invoiceSource(node.args.id ?? '');
    return found ? resolveSelection('Invoice', node.selection, invoiceView(found), ctx) : null;
  }
  if (!def) {
    const near = type ? suggest(type, node.field) : [];
    throw new Error(
      `Cannot query field "${node.field}" on type "${typeName}".` +
        (near.length ? ` Did you mean ${near.map((n) => `"${n}"`).join(' or ')}?` : ''),
    );
  }
  if (def.hidden) ctx.usedHidden = true;
  ctx.resolved += 1;

  const value = source[node.field];
  if (def.type === 'String' || value === undefined || value === null) {
    return value === undefined ? null : String(value);
  }
  if (Array.isArray(value)) {
    return value.map((v) => resolveSelection(def.type, node.selection, v as Record<string, unknown>, ctx));
  }
  return resolveSelection(def.type, node.selection, value as Record<string, unknown>, ctx);
}

function resolveSelection(typeName: string, selection: Node[], source: Record<string, unknown>, ctx: Ctx): unknown {
  if (selection.length === 0) return String(source);
  const out: Record<string, unknown> = {};
  for (const node of selection) out[node.alias] = resolveField(typeName, node, source, ctx);
  return out;
}

function userSource(email: string): Record<string, unknown> {
  const user = db.users.find((u) => u.email === email);
  const tenantId = user?.tenantId ?? 'acme';
  return {
    email,
    name: user?.name ?? 'Inconnu',
    role: user?.role ?? 'user',
    tenantId,
    billingAddress: addressFor(email),
    internalCreditScore: 'B+ (modèle interne, ne pas exposer)',
    get invoices() { return db.invoices.filter((i) => i.tenantId === tenantId).map(invoiceView); },
  };
}

function invoiceView(invoice: { id: string; ref: string; client: string; status: string; total: number; note: string; tenantId: string }): Record<string, unknown> {
  return {
    id: invoice.id,
    ref: invoice.ref,
    client: invoice.client,
    status: invoice.status,
    total: invoice.total.toFixed(2),
    note: invoice.note,
    internalMargin: `${(invoice.total * 0.37).toFixed(2)} € (marge interne)`,
    get owner() { return userSource(db.users.find((u) => u.tenantId === invoice.tenantId)?.email ?? 'dev@acme.example'); },
  };
}

function rootQuery(ctx: Ctx): Record<string, unknown> {
  return {
    get me() { return userSource(ctx.email); },
    get invoices() { return db.invoices.filter((i) => i.tenantId === ctx.tenantId).map(invoiceView); },
  };
}

function runMutation(node: Node, ctx: Ctx): unknown {
  if (node.field === 'setBillingAddress') {
    billingAddresses.set(ctx.email, node.args.address ?? '');
    ctx.mutated = true;
    return resolveSelection('User', node.selection, userSource(ctx.email), ctx);
  }
  if (node.field === 'verifyCode') {
    // VULNÉRABLE (graphql-batching) : chaque alias appelle le résolveur. La
    // limitation de débit, elle, compte les requêtes HTTP — donc une seule.
    //
    // Correctif attendu : compter les OPÉRATIONS, pas les requêtes ; refuser le
    // batching par alias sur les mutations sensibles ; limiter par compte et
    // verrouiller après N essais. Une limite qui compte la mauvaise unité ne
    // limite rien.
    ctx.sensitiveCalls += 1;
    verifyAttempts += 1;
    const ok = node.args.code === verificationCode;
    if (ok) ctx.foundCode = true;
    return resolveSelection('Verification', node.selection, { ok: String(ok), attempts: String(verifyAttempts) }, ctx);
  }
  const near = suggest(SCHEMA.Mutation, node.field);
  throw new Error(
    `Cannot query field "${node.field}" on type "Mutation".` +
      (near.length ? ` Did you mean ${near.map((n) => `"${n}"`).join(' or ')}?` : ''),
  );
}

// ── Limitation de débit, qui compte la mauvaise unité ───────────────────────

const httpHits = new Map<string, { n: number; at: number }>();
const RATE_WINDOW_MS = 60_000;
const RATE_MAX_HTTP = 120;

function rateLimited(key: string): boolean {
  const now = Date.now();
  const hit = httpHits.get(key);
  if (!hit || now - hit.at > RATE_WINDOW_MS) {
    httpHits.set(key, { n: 1, at: now });
    return false;
  }
  hit.n += 1;
  return hit.n > RATE_MAX_HTTP;
}

// ── Le point d'accès ────────────────────────────────────────────────────────

/** Suivi, par compte, de la cartographie déjà obtenue. */
const introspected = new Set<string>();

graphqlRoutes.all('/', (req, res) => {
  const who = req.user?.email ?? 'anonyme';
  const ctx: Ctx = {
    email: req.user?.email ?? 'dev@acme.example',
    tenantId: req.user?.tenantId ?? 'acme',
    sensitiveCalls: 0,
    foundCode: false,
    mutated: false,
    usedHidden: false,
    resolved: 0,
  };

  // VULNÉRABLE (graphql-csrf) : le point d'accès accepte le formulaire encodé
  // et la méthode GET. `application/x-www-form-urlencoded` est un type que le
  // navigateur envoie en formulaire simple, sans contrôle préalable : une page
  // tierce peut donc déclencher une mutation.
  //
  // Correctif attendu : n'accepter que `application/json` — type qui force un
  // preflight CORS — et refuser les mutations en GET.
  const contentType = String(req.headers['content-type'] ?? '');
  const simpleRequest = req.method === 'GET' || !contentType.includes('application/json');

  const body = (req.body ?? {}) as Record<string, unknown>;
  const query = String(body.query ?? (typeof req.query.query === 'string' ? req.query.query : ''));
  if (!query.trim()) {
    res.status(400).json({ errors: [{ message: 'query requise' }] });
    return;
  }

  if (rateLimited(who)) {
    res.status(429).json({ errors: [{ message: 'trop de requêtes' }] });
    return;
  }

  // Introspection : servie à tout le monde, et sans coût.
  if (/__schema\b/.test(query)) {
    introspected.add(who);
    audit(who, 'graphql.introspection', 'schéma complet servi sans authentification');
    res.json({ data: { __schema: introspect() } });
    return;
  }

  let doc: { operation: 'query' | 'mutation'; selection: Node[] };
  try {
    doc = parseDocument(query);
  } catch (err) {
    res.status(400).json({ errors: [{ message: (err as Error).message }] });
    return;
  }

  // VULNÉRABLE (graphql-introspection, seconde moitié) : la profondeur et le
  // nombre de nœuds ne sont ni bornés ni budgétés. Le schéma est cyclique
  // (Invoice.owner → User.invoices → Invoice…) : une requête de quelques lignes
  // fabrique un arbre de résultats arbitrairement grand.
  //
  // Correctif attendu : budget de complexité calculé AVANT exécution,
  // profondeur maximale, et pagination obligatoire sur les listes.
  const depth = depthOf(doc.selection);
  const nodes = countNodes(doc.selection);

  const started = Date.now();
  let data: unknown;
  try {
    if (doc.operation === 'mutation') {
      const out: Record<string, unknown> = {};
      for (const node of doc.selection) out[node.alias] = runMutation(node, ctx);
      data = out;
    } else {
      data = resolveSelection('Query', doc.selection, rootQuery(ctx), ctx);
    }
  } catch (err) {
    res.status(200).json({ errors: [{ message: (err as Error).message }] });
    return;
  }
  const elapsed = Date.now() - started;

  // ── Constats ──────────────────────────────────────────────────────────────

  if (depth >= 12 && introspected.has(who)) {
    audit(who, 'graphql.coût', `profondeur ${depth} (${nodes} nœuds demandés, ${ctx.resolved} champs résolus) en ${elapsed} ms`);
    solve('graphql-introspection');
  }

  if (ctx.usedHidden) {
    audit(who, 'graphql.clairvoyance', 'champ absent de l’introspection sélectionné et résolu');
    solve('graphql-clairvoyance');
  }

  if (ctx.mutated && simpleRequest) {
    audit(who, 'graphql.csrf', `mutation acceptée en ${req.method} / ${contentType || 'sans type'}`);
    solve('graphql-csrf');
  }

  if (ctx.foundCode && ctx.sensitiveCalls >= 50) {
    audit(who, 'graphql.batching', `${ctx.sensitiveCalls} vérifications de code dans une seule requête HTTP`);
    solve('graphql-batching');
  }

  res.json({ data, extensions: { depth, nodes, resolved: ctx.resolved, elapsedMs: elapsed } });
});

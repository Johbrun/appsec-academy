// L'API GraphQL interne de Novafact — version CORRIGÉE.
//
// Quatre correctifs indépendants :
//   · graphql-introspection  introspection coupée hors développement, budget de
//                            complexité calculé AVANT exécution, profondeur
//                            bornée — et autorisation dans chaque résolveur
//   · graphql-clairvoyance   suggestions supprimées, erreurs génériques
//   · graphql-csrf           seul application/json est accepté, et les mutations
//                            ne passent pas en GET
//   · graphql-batching       la limite compte les OPÉRATIONS, pas les requêtes

import { Router } from 'express';
import { audit, db } from '../store.ts';

export const graphqlRoutes = Router();

interface FieldDef { type: string; internal?: boolean; args?: string[]; }
interface TypeDef { name: string; fields: Record<string, FieldDef>; }

const SCHEMA: Record<string, TypeDef> = {
  Query: {
    name: 'Query',
    fields: { me: { type: 'User' }, invoice: { type: 'Invoice', args: ['id'] }, invoices: { type: 'Invoice' } },
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
      email: { type: 'String' }, name: { type: 'String' }, role: { type: 'String' },
      tenantId: { type: 'String' }, billingAddress: { type: 'String' }, invoices: { type: 'Invoice' },
      // CORRIGÉ (graphql-clairvoyance) : le champ interne n'est plus « caché »,
      // il est INTERDIT au client. L'obscurité n'a jamais été le contrôle.
      internalCreditScore: { type: 'String', internal: true },
    },
  },
  Invoice: {
    name: 'Invoice',
    fields: {
      id: { type: 'String' }, ref: { type: 'String' }, client: { type: 'String' },
      status: { type: 'String' }, total: { type: 'String' }, note: { type: 'String' },
      owner: { type: 'User' },
      internalMargin: { type: 'String', internal: true },
    },
  },
  Verification: { name: 'Verification', fields: { ok: { type: 'String' }, attempts: { type: 'String' } } },
};

interface Node { alias: string; field: string; args: Record<string, string>; selection: Node[]; }

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
  return { operation, selection: parseSelection(trimmed, { i: start + 1 }) };
}

const depthOf = (nodes: Node[]): number =>
  nodes.length === 0 ? 0 : 1 + Math.max(...nodes.map((n) => depthOf(n.selection)));

const countNodes = (nodes: Node[]): number =>
  nodes.reduce((n, node) => n + 1 + countNodes(node.selection), 0);

/**
 * Budget de complexité : le coût d'une sélection est estimé AVANT exécution, en
 * multipliant par la cardinalité attendue de chaque liste. C'est ce calcul —
 * et non la profondeur seule — qui empêche une requête de quelques lignes de
 * fabriquer un arbre de résultats arbitrairement grand.
 */
const LIST_FANOUT = 20;
function complexity(nodes: Node[], typeName: string): number {
  let total = 0;
  for (const node of nodes) {
    const def = SCHEMA[typeName]?.fields[node.field];
    if (!def) { total += 1; continue; }
    const isList = def.type !== 'String' && (node.field === 'invoices');
    total += 1 + (isList ? LIST_FANOUT : 1) * complexity(node.selection, def.type);
  }
  return total;
}

const MAX_DEPTH = 8;
const MAX_COMPLEXITY = 2000;
const MAX_OPERATIONS = 10;

// ── Résolveurs ──────────────────────────────────────────────────────────────

const billingAddresses = new Map<string, string>();
const addressFor = (email: string) => billingAddresses.get(email) ?? '12 rue de la Comptabilité, 44000 Nantes';

let verificationCode = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
let verifyAttempts = 0;
const attemptsByAccount = new Map<string, { n: number; at: number }>();
const MAX_ATTEMPTS_PER_ACCOUNT = 20;
const ATTEMPTS_WINDOW_MS = 10 * 60_000;

export const resetGraphqlState = (): void => {
  billingAddresses.clear();
  verificationCode = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  verifyAttempts = 0;
  attemptsByAccount.clear();
};

interface Ctx { email: string; tenantId: string; resolved: number; }

function invoiceView(invoice: { id: string; ref: string; client: string; status: string; total: number; note: string; tenantId: string }): Record<string, unknown> {
  return {
    id: invoice.id, ref: invoice.ref, client: invoice.client, status: invoice.status,
    total: invoice.total.toFixed(2), note: invoice.note, tenantId: invoice.tenantId,
    get owner() { return userSource(db.users.find((u) => u.tenantId === invoice.tenantId)?.email ?? 'dev@acme.example'); },
  };
}

function userSource(email: string): Record<string, unknown> {
  const user = db.users.find((u) => u.email === email);
  const tenantId = user?.tenantId ?? 'acme';
  return {
    email, name: user?.name ?? 'Inconnu', role: user?.role ?? 'user', tenantId,
    billingAddress: addressFor(email),
    get invoices() { return db.invoices.filter((i) => i.tenantId === tenantId).map(invoiceView); },
  };
}

/**
 * CORRIGÉ (graphql-introspection, seconde moitié) : l'autorisation est vérifiée
 * DANS le résolveur, pas à l'entrée du point d'accès. Un champ interne n'est
 * jamais résolu pour un client, et une ressource d'un autre tenant non plus.
 */
function resolveField(typeName: string, node: Node, source: Record<string, unknown>, ctx: Ctx): unknown {
  const def = SCHEMA[typeName]?.fields[node.field];
  if (!def || def.internal) throw new Error('requête invalide');

  if (typeName === 'Query' && node.field === 'invoice') {
    const found = db.invoices.find((i) => i.id === (node.args.id ?? '') && i.tenantId === ctx.tenantId);
    return found ? resolveSelection('Invoice', node.selection, invoiceView(found), ctx) : null;
  }

  ctx.resolved += 1;
  const value = source[node.field];
  if (def.type === 'String' || value === undefined || value === null) {
    return value === undefined ? null : String(value);
  }
  if (Array.isArray(value)) {
    return value
      .filter((v) => (v as { tenantId?: string }).tenantId === undefined || (v as { tenantId?: string }).tenantId === ctx.tenantId)
      .map((v) => resolveSelection(def.type, node.selection, v as Record<string, unknown>, ctx));
  }
  return resolveSelection(def.type, node.selection, value as Record<string, unknown>, ctx);
}

function resolveSelection(typeName: string, selection: Node[], source: Record<string, unknown>, ctx: Ctx): unknown {
  if (selection.length === 0) return String(source);
  const out: Record<string, unknown> = {};
  for (const node of selection) out[node.alias] = resolveField(typeName, node, source, ctx);
  return out;
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
    return resolveSelection('User', node.selection, userSource(ctx.email), ctx);
  }
  if (node.field === 'verifyCode') {
    // CORRIGÉ (graphql-batching) : la limite est POSÉE SUR LE COMPTE et compte
    // les tentatives, pas les requêtes HTTP. Une limite qui compte la mauvaise
    // unité ne limite rien.
    const now = Date.now();
    const used = attemptsByAccount.get(ctx.email);
    const window = !used || now - used.at > ATTEMPTS_WINDOW_MS ? { n: 0, at: now } : used;
    if (window.n >= MAX_ATTEMPTS_PER_ACCOUNT) throw new Error('trop de tentatives de validation');
    attemptsByAccount.set(ctx.email, { n: window.n + 1, at: window.at });
    verifyAttempts += 1;
    const ok = node.args.code === verificationCode;
    return resolveSelection('Verification', node.selection, { ok: String(ok), attempts: String(verifyAttempts) }, ctx);
  }
  throw new Error('requête invalide');
}

// ── Le point d'accès ────────────────────────────────────────────────────────

graphqlRoutes.all('/', (req, res) => {
  const who = req.user?.email ?? 'anonyme';

  // CORRIGÉ (graphql-csrf) : seul `application/json` est accepté — un type que
  // le navigateur ne peut pas envoyer en formulaire simple sans preflight — et
  // les mutations ne passent jamais en GET.
  const contentType = String(req.headers['content-type'] ?? '');
  if (req.method !== 'POST' || !contentType.includes('application/json')) {
    res.status(415).json({ errors: [{ message: 'seul POST application/json est accepté' }] });
    return;
  }

  if (!req.user) {
    res.status(401).json({ errors: [{ message: 'authentification requise' }] });
    return;
  }

  const ctx: Ctx = { email: req.user.email, tenantId: req.user.tenantId, resolved: 0 };
  const query = String(((req.body ?? {}) as Record<string, unknown>).query ?? '');
  if (!query.trim()) {
    res.status(400).json({ errors: [{ message: 'query requise' }] });
    return;
  }

  // CORRIGÉ (graphql-introspection) : l'introspection n'est servie qu'en
  // développement. Ce n'est pas un contrôle d'accès — c'est de la surface en
  // moins, rien de plus.
  if (/__schema\b/.test(query)) {
    res.status(400).json({ errors: [{ message: 'requête invalide' }] });
    return;
  }

  let doc: { operation: 'query' | 'mutation'; selection: Node[] };
  try {
    doc = parseDocument(query);
  } catch {
    res.status(400).json({ errors: [{ message: 'requête invalide' }] });
    return;
  }

  // Budget calculé AVANT exécution : profondeur, nombre d'opérations, coût.
  const depth = depthOf(doc.selection);
  const nodes = countNodes(doc.selection);
  const cost = complexity(doc.selection, doc.operation === 'mutation' ? 'Mutation' : 'Query');

  if (depth > MAX_DEPTH) {
    res.status(400).json({ errors: [{ message: `profondeur maximale dépassée (${MAX_DEPTH})` }] });
    return;
  }
  if (doc.selection.length > MAX_OPERATIONS) {
    res.status(400).json({ errors: [{ message: `nombre d’opérations maximal dépassé (${MAX_OPERATIONS})` }] });
    return;
  }
  if (cost > MAX_COMPLEXITY) {
    res.status(400).json({ errors: [{ message: `budget de complexité dépassé (${MAX_COMPLEXITY})` }] });
    return;
  }

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
    // CORRIGÉ (graphql-clairvoyance) : erreur générique, aucune suggestion. Le
    // détail va dans les journaux du serveur, pas dans la réponse.
    audit(who, 'graphql.erreur', (err as Error).message);
    res.status(400).json({ errors: [{ message: 'requête invalide' }] });
    return;
  }

  res.json({ data, extensions: { depth, nodes, cost } });
});

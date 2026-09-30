// Corrigé de server/routes/settings.ts.
// Défauts éliminés : proto-pollution, dual-use-endpoint, eval-formula,
// vm-escape.

import { Router } from 'express';
import { db } from '../store.ts';
import { requireUser } from '../lib/auth.ts';

export const settingsRoutes = Router();

const FORBIDDEN = new Set(['__proto__', 'constructor', 'prototype']);
const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

// CORRIGÉ (proto-pollution) : clés dangereuses refusées, et descente sur des
// objets dont on contrôle le prototype.
function safeMerge(target: Record<string, unknown>, source: Record<string, unknown>): void {
  for (const key of Object.keys(source)) {
    if (FORBIDDEN.has(key)) continue;
    const value = source[key];
    if (isObject(value)) {
      const current = target[key];
      if (!isObject(current)) target[key] = Object.create(null) as Record<string, unknown>;
      safeMerge(target[key] as Record<string, unknown>, value);
    } else {
      target[key] = value;
    }
  }
}

settingsRoutes.get('/settings', requireUser, (req, res) => {
  const tenant = db.tenants.find((t) => t.id === req.user!.tenantId);
  res.json(tenant?.settings ?? {});
});

settingsRoutes.get('/platform', requireUser, (_req, res) => {
  res.json(db.platform);
});

// CORRIGÉ (dual-use-endpoint) : cette route n'écrit QUE les réglages du
// tenant. Aucun champ du corps ne choisit un périmètre — `scope` est une donnée
// comme une autre, et elle est ignorée.
settingsRoutes.put('/settings', requireUser, (req, res) => {
  const tenant = db.tenants.find((t) => t.id === req.user!.tenantId);
  if (!tenant) {
    res.status(404).json({ error: 'tenant introuvable' });
    return;
  }
  const body = { ...((req.body ?? {}) as Record<string, unknown>) };
  delete body.scope;
  safeMerge(tenant.settings, body);
  res.json(tenant.settings);
});

// Deux niveaux de privilège, deux routes, deux contrôles.
settingsRoutes.put('/platform', requireUser, (req, res) => {
  if (req.user!.role !== 'admin') {
    res.status(403).json({ error: 'réglages plateforme réservés aux administrateurs' });
    return;
  }
  safeMerge(db.platform, (req.body ?? {}) as Record<string, unknown>);
  res.json(db.platform);
});

settingsRoutes.get('/export', requireUser, (req, res) => {
  // CORRIGÉ : la décision d'autorisation ne lit plus une propriété éventuellement
  // héritée ; elle s'appuie sur le rôle porté par la session vérifiée.
  const allowed = req.user!.role === 'admin' || req.user!.role === 'accountant';
  if (!allowed) {
    res.status(403).json({ error: 'export réservé aux comptes autorisés' });
    return;
  }

  res.json({
    generatedAt: new Date().toISOString(),
    invoices: db.invoices
      .filter((i) => i.tenantId === req.user!.tenantId)
      .map((i) => ({ ref: i.ref, tenant: i.tenantId, client: i.client, total: i.total, status: i.status })),
  });
});

// ── Pénalités de retard ─────────────────────────────────────────────────────
//
// CORRIGÉ (eval-formula, vm-escape) : une expression métier n'a pas besoin
// d'un interpréteur complet. Le mini-évaluateur ci-dessous a une grammaire
// FERMÉE — nombres, variables déclarées, `+ - * / %`, parenthèses — et il ne
// peut rien faire d'autre : pas d'appel de fonction, pas d'accès à une
// propriété, pas de globales. Il n'y a donc plus ni `eval` ni `node:vm`, et
// donc plus de bac à sable à percer : `node:vm` isole les variables globales,
// pas les capacités.

const FORMULA_VARS = ['amount', 'days', 'rate'] as const;

type Token = { t: 'num'; v: number } | { t: 'var'; v: string } | { t: 'op'; v: string };

function tokenize(src: string): Token[] | null {
  const out: Token[] = [];
  const re = /\s*(\d+(?:\.\d+)?|[A-Za-z_][A-Za-z0-9_]*|[+\-*/%()])/y;
  let i = 0;
  while (i < src.length) {
    re.lastIndex = i;
    const m = re.exec(src);
    if (!m) return null;
    i = re.lastIndex;
    const raw = m[1];
    if (/^\d/.test(raw)) out.push({ t: 'num', v: Number(raw) });
    else if (/^[A-Za-z_]/.test(raw)) {
      if (!(FORMULA_VARS as readonly string[]).includes(raw)) return null;
      out.push({ t: 'var', v: raw });
    } else out.push({ t: 'op', v: raw });
  }
  return out;
}

/** Descente récursive : expr → terme (('+'|'-') terme)* ; etc. */
function evaluate(tokens: Token[], scope: Record<string, number>): number | null {
  let pos = 0;
  const peek = () => tokens[pos];

  const primary = (): number | null => {
    const tk = peek();
    if (!tk) return null;
    if (tk.t === 'num') { pos++; return tk.v; }
    if (tk.t === 'var') { pos++; return scope[tk.v]; }
    if (tk.v === '-') { pos++; const v = primary(); return v === null ? null : -v; }
    if (tk.v === '(') {
      pos++;
      const v = expr();
      const close = peek();
      if (v === null || !close || close.t !== 'op' || close.v !== ')') return null;
      pos++;
      return v;
    }
    return null;
  };

  const term = (): number | null => {
    let left = primary();
    if (left === null) return null;
    while (peek()?.t === 'op' && ['*', '/', '%'].includes((peek() as { v: string }).v)) {
      const op = (tokens[pos++] as { v: string }).v;
      const right = primary();
      if (right === null) return null;
      left = op === '*' ? left * right : op === '/' ? left / right : left % right;
    }
    return left;
  };

  const expr = (): number | null => {
    let left = term();
    if (left === null) return null;
    while (peek()?.t === 'op' && ['+', '-'].includes((peek() as { v: string }).v)) {
      const op = (tokens[pos++] as { v: string }).v;
      const right = term();
      if (right === null) return null;
      left = op === '+' ? left + right : left - right;
    }
    return left;
  };

  const value = expr();
  return pos === tokens.length ? value : null;
}

settingsRoutes.post('/settings/penalty', requireUser, (req, res) => {
  const tenant = db.tenants.find((t) => t.id === req.user!.tenantId);
  if (!tenant) {
    res.status(404).json({ error: 'tenant introuvable' });
    return;
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const formula = String(body.formula ?? tenant.settings.penaltyFormula ?? 'amount * days * rate');
  if (formula.length > 400) {
    res.status(400).json({ error: 'formule trop longue' });
    return;
  }

  const scope: Record<string, number> = {
    amount: Number(body.amount ?? 1000),
    days: Number(body.days ?? 30),
    rate: Number(tenant.settings.penaltyRate ?? 0.001),
  };

  const tokens = tokenize(formula);
  const penalty = tokens ? evaluate(tokens, scope) : null;
  if (penalty === null || !Number.isFinite(penalty)) {
    res.status(400).json({
      error: 'formule invalide : seuls les nombres, les variables amount / days / rate et les opérateurs + - * / % ( ) sont acceptés',
    });
    return;
  }

  tenant.settings.penaltyFormula = formula;
  res.json({ engine: String(body.engine ?? 'eval') === 'sandbox' ? 'sandbox' : 'eval', formula, penalty, rendered: String(penalty), error: null });
});

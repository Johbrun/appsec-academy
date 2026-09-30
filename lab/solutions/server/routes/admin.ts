// Surface réservée aux administrateurs — version CORRIGÉE.

import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { audit, db } from '../store.ts';
import { requireUser } from '../lib/auth.ts';
import { MESH_HEADER, MESH_TOKEN } from './webhooks.ts';

/**
 * CORRIGÉ (url-prefix-authz) : l'autorisation se décide ICI, sur la ressource et
 * l'action, une fois la route résolue par le routeur. Plus aucune comparaison de
 * chaîne d'URL : casse, doubles séparateurs, `.` et encodages divergeront
 * toujours entre ce que compare un intergiciel de préfixe et ce que route le
 * framework.
 */
function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'authentification requise' });
    return;
  }
  if (req.user.role !== 'admin' || !req.user.trusted) {
    audit(req.user.email, 'authz.refus', `${req.method} ${req.originalUrl}`);
    res.status(403).json({ error: 'réservé aux administrateurs' });
    return;
  }
  next();
}

export const adminRoutes = Router();
adminRoutes.use(requireUser, requireAdmin);

adminRoutes.get('/audit', (_req, res) => {
  res.json(db.audit);
});

adminRoutes.get('/users', (_req, res) => {
  res.json(db.users.map(({ password, ...u }) => { void password; return u; }));
});

// ── Export comptable ────────────────────────────────────────────────────────

export const adminExportRoutes = Router();
adminExportRoutes.use(requireUser, requireAdmin);

adminExportRoutes.get('/ledger', (_req, res) => {
  res.json({
    periode: '2024-T2',
    lignes: db.invoices.map((i) => ({ ref: i.ref, tenant: i.tenantId, client: i.client, total: i.total })),
    total: db.invoices.reduce((s, i) => s + i.total, 0),
  });
});

// ── Route d'administration interne ──────────────────────────────────────────
//
// Elle continue de se fier à l'identité du maillage : c'est son contrat. Le
// correctif de ssrf-redirect-bypass est dans le client HTTP (webhooks.ts), qui
// n'accepte plus d'être conduit ici par un tiers.

export const rotations: string[] = [];

export const internalRoutes = Router();

internalRoutes.post('/rotate-keys', (req, res) => {
  if (req.headers[MESH_HEADER] !== MESH_TOKEN) {
    res.status(403).json({ error: 'identité de maillage absente' });
    return;
  }
  const key = `nvf_rotated_${rotations.length + 1}`;
  rotations.push(key);
  audit('maillage', 'clés.rotation', key);
  res.json({ ok: true, rotated: key, count: rotations.length });
});

export const resetAdminState = () => { rotations.length = 0; };

// Surface réservée aux administrateurs.
//
// Deux exercices s'appuient sur ce fichier sans que le défaut y soit :
//   · jwt-decode ............ le défaut est dans server/lib/jwt.ts ;
//   · url-prefix-authz ...... le défaut est dans server/index.ts, qui protège
//     `adminExportRoutes` par un préfixe d'URL au lieu d'une décision prise
//     après résolution de la route ;
//   · ssrf-redirect-bypass .. le défaut est dans server/routes/webhooks.ts, qui
//     laisse le client HTTP suivre une redirection jusqu'ici.

import { Router } from 'express';
import { audit, db, solve } from '../store.ts';
import { requireUser } from '../lib/auth.ts';
import { MESH_HEADER, MESH_TOKEN } from './webhooks.ts';

export const adminRoutes = Router();
adminRoutes.use(requireUser);

adminRoutes.use((req, res, next) => {
  if (req.user!.role !== 'admin') {
    res.status(403).json({ error: 'réservé aux administrateurs' });
    return;
  }
  // Le jeton porte bien « admin », mais sa signature n'a pas été validée :
  // il a été forgé. Un vrai serveur ne verrait pas la différence — c'est tout
  // le problème.
  if (!req.user!.trusted) {
    audit(req.user!.email, 'jeton.forgé', 'signature non vérifiée, accès admin accordé');
    solve('jwt-decode');
  }
  next();
});

adminRoutes.get('/audit', (_req, res) => {
  res.json(db.audit);
});

adminRoutes.get('/users', (_req, res) => {
  res.json(db.users.map(({ password, ...u }) => { void password; return u; }));
});

// ── Export comptable : protégé UNIQUEMENT par le préfixe d'URL ──────────────
//
// Ce routeur ne vérifie aucun rôle : il s'en remet à l'intergiciel de
// server/index.ts, qui compare `req.path` à « /api/admin ». Le routeur d'Express,
// lui, résout la route sans tenir compte de la casse : la comparaison et le
// routage ne voient pas la même chose.
//
// Correctif attendu : décider l'autorisation ici, sur la ressource et l'action,
// une fois la route résolue.

export const adminExportRoutes = Router();

adminExportRoutes.get('/ledger', (req, res) => {
  const role = req.user?.role ?? 'anonyme';
  if (role !== 'admin') {
    audit(req.user?.email ?? 'anonyme', 'authz.préfixe', `grand livre servi à un compte « ${role} » via ${req.originalUrl}`);
    solve('url-prefix-authz');
  }
  res.json({
    periode: '2024-T2',
    lignes: db.invoices.map((i) => ({ ref: i.ref, tenant: i.tenantId, client: i.client, total: i.total })),
    total: db.invoices.reduce((s, i) => s + i.total, 0),
  });
});

// ── Route d'administration « interne », montée sur /api/internal ────────────
//
// Elle n'exige pas de session utilisateur : elle fait confiance à l'en-tête
// d'identité que le maillage de services pose sur les appels internes. C'est la
// cible de ssrf-redirect-bypass : le serveur, en suivant une redirection, va
// l'appeler lui-même — avec cet en-tête, puisque c'est son propre client HTTP.
//
// Le défaut n'est pas ici : une route interne a le droit de se fier au maillage.
// Il est dans le client HTTP qui accepte d'y être conduit par un tiers.

export const rotations: string[] = [];

export const internalRoutes = Router();

internalRoutes.post('/rotate-keys', (req, res) => {
  if (req.headers[MESH_HEADER] !== MESH_TOKEN) {
    res.status(403).json({ error: 'identité de maillage absente' });
    return;
  }
  const key = `nvf_rotated_${rotations.length + 1}`;
  rotations.push(key);
  audit('maillage', 'ssrf.redirection', 'rotation de clés déclenchée par une requête sortante du serveur');
  solve('ssrf-redirect-bypass');
  res.json({ ok: true, rotated: key, count: rotations.length });
});

export const resetAdminState = () => { rotations.length = 0; };

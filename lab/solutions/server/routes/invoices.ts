// Corrigé de server/routes/invoices.ts.
//
// Défauts éliminés : bola-invoice, money-float, redos, invoice-state,
// number-coercion, max-safe-integer, bfla-method, bola-nested, error-leak,
// race-multi-endpoint, vary-missing, qs-type-confusion, orm-leak,
// token-in-url, send-quota.

import { Router } from 'express';
import crypto from 'node:crypto';
import { db, sendMail } from '../store.ts';
import { requireUser } from '../lib/auth.ts';
import type { Client, Invoice, InvoiceLine } from '../store.ts';

export const invoiceRoutes = Router();

/** Liens de consultation : jetons opaques, à usage unique, côté serveur. */
const shareLinks = new Map<string, { invoiceId: string; tenantId: string; expiresAt: number }>();

/** Envois sortants par tenant, pour le quota. */
const sendLog = new Map<string, number[]>();

/** Attendu par /api/lab/reset. */
export function resetInvoiceState(): void {
  shareLinks.clear();
  sendLog.clear();
}

invoiceRoutes.use(requireUser);

// CORRIGÉ (bola-invoice, bfla-method) : la couche d'accès exige le tenant.
// Aucune route ne peut l'oublier, quelle que soit la méthode ajoutée ensuite.
const forTenant = (tenantId: string) => db.invoices.filter((i) => i.tenantId === tenantId);
const oneForTenant = (id: string, tenantId: string) =>
  db.invoices.find((i) => i.id === id && i.tenantId === tenantId);
const clientForTenant = (id: string, tenantId: string) =>
  db.clients.find((c) => c.id === id && c.tenantId === tenantId);

// CORRIGÉ (redos) : expression linéaire, sans quantificateur imbriqué.
const REF_PATTERN = /^[A-Z]{2,5}-\d{1,8}$/;

// CORRIGÉ (vary-missing) : une réponse qui dépend de l'appelant ne va pas dans
// un cache partagé. Plus de cache du tout ici, et l'en-tête le dit.
invoiceRoutes.get('/', (req, res) => {
  res.set('Cache-Control', 'private, no-store').json(forTenant(req.user!.tenantId));
});

invoiceRoutes.get('/search', (req, res) => {
  const ref = String(req.query.ref ?? '').slice(0, 30);
  const started = performance.now();
  const valid = REF_PATTERN.test(ref);
  res.json({
    valid,
    elapsedMs: Math.round(performance.now() - started),
    results: valid ? forTenant(req.user!.tenantId).filter((i) => i.ref.includes(ref)) : [],
  });
});

// CORRIGÉ (qs-type-confusion) : le TYPE est validé avant tout le reste.
// `typeof` d'abord, longueur ensuite, contenu enfin. Un tableau est refusé, et
// il l'est explicitement — pas par accident.
invoiceRoutes.get('/lookup', (req, res) => {
  const raw = req.query.tenant ?? req.user!.tenantId;
  if (typeof raw !== 'string') {
    res.status(400).json({ error: 'paramètre tenant invalide : une chaîne est attendue' });
    return;
  }
  if (raw.length === 0 || raw.length > 32) {
    res.status(400).json({ error: 'paramètre tenant invalide' });
    return;
  }
  if (raw !== req.user!.tenantId) {
    res.status(403).json({ error: 'hors de votre périmètre' });
    return;
  }
  res.json({ scope: raw, results: forTenant(req.user!.tenantId) });
});

// CORRIGÉ (orm-leak) : liste blanche de colonnes et d'opérateurs pour le
// filtre, projection explicite pour la sortie, et la clause de tenant posée
// APRÈS le filtre du client — rien ne peut l'écraser.
const FILTERABLE = new Set(['status', 'client', 'ref', 'clientId']);
const PUBLIC_INVOICE = ['id', 'ref', 'client', 'status', 'total', 'note'] as const;
const PUBLIC_CUSTOMER = ['id', 'name', 'email'] as const;

const pick = <T extends object>(row: T, fields: readonly string[]) =>
  Object.fromEntries(fields.map((f) => [f, (row as Record<string, unknown>)[f]]));

invoiceRoutes.post('/query', (req, res) => {
  const { where, include } = (req.body ?? {}) as { where?: Record<string, unknown>; include?: unknown };

  const filter: [string, string][] = [];
  for (const [k, v] of Object.entries(where ?? {})) {
    if (!FILTERABLE.has(k)) {
      res.status(400).json({ error: `filtre non autorisé : ${k}` });
      return;
    }
    if (typeof v !== 'string') {
      res.status(400).json({ error: `valeur de filtre invalide pour ${k}` });
      return;
    }
    filter.push([k, v]);
  }

  const relations = Array.isArray(include) ? include.map(String) : include ? [String(include)] : [];
  if (relations.some((r) => r !== 'customer')) {
    res.status(400).json({ error: 'relation non autorisée' });
    return;
  }

  const results = forTenant(req.user!.tenantId)
    .filter((inv) => filter.every(([k, v]) => String((inv as unknown as Record<string, unknown>)[k] ?? '') === v))
    .map((inv) => {
      const row: Record<string, unknown> = pick(inv, PUBLIC_INVOICE);
      if (relations.includes('customer')) {
        const customer = inv.clientId ? clientForTenant(inv.clientId, req.user!.tenantId) : undefined;
        row.customer = customer ? pick(customer, PUBLIC_CUSTOMER) : null;
      }
      return row;
    });

  res.json({ filter: Object.fromEntries(filter), results });
});

invoiceRoutes.get('/:id', (req, res) => {
  const invoice = oneForTenant(req.params.id, req.user!.tenantId);
  if (!invoice) {
    res.status(404).json({ error: 'facture introuvable' });
    return;
  }
  res.set('Cache-Control', 'private, no-store').json(invoice);
});

// CORRIGÉ (token-in-url) : le lien de partage ne porte plus le jeton de
// session. Il porte un identifiant opaque, aléatoire, à courte durée de vie et
// à usage unique, qui ne donne accès qu'à cette facture. Et la page de
// consultation pose `Referrer-Policy: no-referrer`.
invoiceRoutes.get('/:id/share', (req, res) => {
  const invoice = oneForTenant(req.params.id, req.user!.tenantId);
  if (!invoice) {
    res.status(404).json({ error: 'facture introuvable' });
    return;
  }
  const secret = crypto.randomBytes(24).toString('base64url');
  shareLinks.set(secret, {
    invoiceId: invoice.id,
    tenantId: invoice.tenantId,
    expiresAt: Date.now() + 15 * 60_000,
  });
  res.json({ url: `/api/invoices/${invoice.id}/view?s=${secret}` });
});

invoiceRoutes.get('/:id/view', (req, res) => {
  const secret = String(req.query.s ?? '');
  const link = shareLinks.get(secret);
  shareLinks.delete(secret); // usage unique
  if (!link || link.expiresAt < Date.now() || link.invoiceId !== req.params.id) {
    res.status(401).json({ error: 'lien de consultation invalide ou expiré' });
    return;
  }
  const invoice = oneForTenant(link.invoiceId, link.tenantId);
  if (!invoice) {
    res.status(404).json({ error: 'facture introuvable' });
    return;
  }
  res
    .set('Referrer-Policy', 'no-referrer')
    .set('Cache-Control', 'private, no-store')
    .type('html')
    .send(`<!doctype html><meta charset="utf-8"><title>${invoice.ref}</title><h1>${invoice.ref}</h1>`);
});

// CORRIGÉ (money-float, number-coercion, max-safe-integer) : le schéma dit ce
// qu'est un montant — entier de centimes, fini, borné — et le rejet est la
// seule autre issue. Les quantités sont bornées par le métier bien avant la
// limite du langage, et le total reste un entier sûr.
const MAX_UNIT_CENTS = 100_000_00;
const MAX_QTY = 100_000;

function parseLines(raw: unknown): { lines: InvoiceLine[]; totalCents: number } | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 500) return null;
  const lines: InvoiceLine[] = [];
  let totalCents = 0;
  for (const l of raw as Partial<InvoiceLine>[]) {
    const qty = typeof l.qty === 'number' ? l.qty : Number.NaN;
    const unitPrice = typeof l.unitPrice === 'number' ? l.unitPrice : Number.NaN;
    if (!Number.isInteger(qty) || qty <= 0 || qty > MAX_QTY) return null;
    if (!Number.isFinite(unitPrice) || unitPrice < 0) return null;
    const unitCents = Math.round(unitPrice * 100);
    if (!Number.isInteger(unitCents) || unitCents > MAX_UNIT_CENTS) return null;
    totalCents += qty * unitCents;
    if (!Number.isSafeInteger(totalCents) || totalCents < 0) return null;
    lines.push({ label: String(l.label ?? 'Ligne').slice(0, 200), qty, unitPrice: unitCents / 100 });
  }
  return { lines, totalCents };
}

invoiceRoutes.post('/', (req, res) => {
  const parsed = parseLines(req.body?.lines);
  if (!parsed) {
    res.status(400).json({ error: 'lignes invalides : quantité entière > 0, prix unitaire fini et borné' });
    return;
  }

  // CORRIGÉ (bola-nested) : l'identifiant imbriqué est autorisé lui aussi. La
  // recherche ne peut pas être appelée sans le tenant.
  let customer: Client | undefined;
  const clientId = req.body?.clientId;
  if (clientId !== undefined) {
    if (typeof clientId !== 'string') {
      res.status(400).json({ error: 'clientId invalide' });
      return;
    }
    customer = clientForTenant(clientId, req.user!.tenantId);
    if (!customer) {
      res.status(404).json({ error: 'client introuvable' });
      return;
    }
  }

  const n = db.invoices.length + 1001;
  const invoice: Invoice = {
    id: `INV-${n}`,
    tenantId: req.user!.tenantId,
    ref: `INV-${n}`,
    client: customer?.name ?? String(req.body?.client ?? 'Client'),
    clientId: customer?.id,
    status: 'draft',
    lines: parsed.lines,
    total: parsed.totalCents / 100,
    note: String(req.body?.note ?? ''),
  };
  db.invoices.push(invoice);
  res.status(201).json(invoice);
});

// CORRIGÉ (invoice-state) : machine à états déclarée côté serveur, champs
// immuables une fois payée.
const TRANSITIONS: Record<Invoice['status'], Invoice['status'][]> = {
  draft: ['sent', 'void'],
  sent: ['paid', 'void'],
  paid: ['void'],
  void: [],
};

invoiceRoutes.patch('/:id', (req, res) => {
  const invoice = oneForTenant(req.params.id, req.user!.tenantId);
  if (!invoice) {
    res.status(404).json({ error: 'facture introuvable' });
    return;
  }

  const { status, lines, note, client } = req.body ?? {};

  if (typeof status === 'string' && status !== invoice.status) {
    if (!TRANSITIONS[invoice.status].includes(status as Invoice['status'])) {
      res.status(409).json({ error: `transition ${invoice.status} → ${status} interdite` });
      return;
    }
  }

  const locked = invoice.status === 'paid' || invoice.status === 'void';
  if (locked && (lines !== undefined || client !== undefined)) {
    res.status(409).json({ error: 'une facture payée ou annulée n’est plus modifiable : passez par un avoir' });
    return;
  }

  if (lines !== undefined) {
    const parsed = parseLines(lines);
    if (!parsed) {
      res.status(400).json({ error: 'lignes invalides' });
      return;
    }
    invoice.lines = parsed.lines;
    invoice.total = parsed.totalCents / 100;
  }
  if (typeof note === 'string') invoice.note = note;
  if (typeof client === 'string') invoice.client = client;
  if (typeof status === 'string') invoice.status = status as Invoice['status'];

  res.json(invoice);
});

// CORRIGÉ (bfla-method) : le contrôle n'est pas reporté de méthode en méthode,
// il est dans la couche d'accès — `oneForTenant` ne rend rien d'un autre tenant.
invoiceRoutes.delete('/:id', (req, res) => {
  const invoice = oneForTenant(req.params.id, req.user!.tenantId);
  if (!invoice) {
    res.status(404).json({ error: 'facture introuvable' });
    return;
  }
  db.invoices.splice(db.invoices.indexOf(invoice), 1);
  res.json({ ok: true, deleted: invoice.id });
});

// CORRIGÉ (error-leak) : échec sûr. On valide entièrement AVANT d'écrire quoi
// que ce soit, on écrit en tout-ou-rien, et la réponse d'erreur ne révèle ni
// message interne ni pile.
invoiceRoutes.post('/:id/reissue', (req, res) => {
  const invoice = oneForTenant(req.params.id, req.user!.tenantId);
  if (!invoice) {
    res.status(404).json({ error: 'facture introuvable' });
    return;
  }

  let spec: { lines?: unknown };
  try {
    spec = JSON.parse(String(req.body?.spec ?? '')) as { lines?: unknown };
  } catch {
    res.status(400).json({ error: 'spécification de réémission invalide' });
    return;
  }

  const parsed = parseLines(spec.lines);
  if (!parsed) {
    res.status(400).json({ error: 'lignes invalides' });
    return;
  }

  // Une seule écriture, après validation complète.
  invoice.lines = parsed.lines;
  invoice.total = parsed.totalCents / 100;
  invoice.status = 'draft';
  res.json(invoice);
});

// CORRIGÉ (race-multi-endpoint) : une transition d'état est une écriture
// CONDITIONNELLE unique. Rien ne s'intercale entre la lecture de la condition
// et l'écriture — c'est l'équivalent applicatif de
// `UPDATE … SET paid = true WHERE id = ? AND refunded = false`. En production,
// c'est la base qui porte la garantie, pas le code.
function settle(invoice: Invoice, to: 'paid' | 'refunded'): boolean {
  if (to === 'paid') {
    if (invoice.refunded) return false;
    invoice.paid = true;
    invoice.status = 'paid';
    return true;
  }
  if (invoice.paid) return false;
  invoice.refunded = true;
  invoice.status = 'void';
  return true;
}

for (const [route, target] of [['/:id/pay', 'paid'], ['/:id/refund', 'refunded']] as const) {
  invoiceRoutes.post(route, (req, res) => {
    const invoice = oneForTenant(req.params.id, req.user!.tenantId);
    if (!invoice) {
      res.status(404).json({ error: 'facture introuvable' });
      return;
    }
    if (!settle(invoice, target)) {
      res.status(409).json({ error: 'transition de règlement impossible dans cet état' });
      return;
    }
    res.json({ ok: true, id: invoice.id, paid: Boolean(invoice.paid), refunded: Boolean(invoice.refunded) });
  });
}

// CORRIGÉ (send-quota) : quota par tenant sur une fenêtre glissante, et le
// corps du message est GÉNÉRÉ à partir de la facture — il n'est plus repris du
// client. En production, le quota est progressif (ancienneté, vérification du
// compte), le contenu sortant est analysé, et les envois transactionnels
// partent d'un sous-domaine distinct.
const QUOTA = 20;
const WINDOW_MS = 60 * 60_000;

invoiceRoutes.post('/:id/send', (req, res) => {
  const invoice = oneForTenant(req.params.id, req.user!.tenantId);
  if (!invoice) {
    res.status(404).json({ error: 'facture introuvable' });
    return;
  }

  const now = Date.now();
  const recent = (sendLog.get(req.user!.tenantId) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= QUOTA) {
    res.status(429).json({ error: `quota d’envoi atteint (${QUOTA} par heure)`, retryAfterMs: WINDOW_MS });
    return;
  }
  recent.push(now);
  sendLog.set(req.user!.tenantId, recent);

  const customer = invoice.clientId ? clientForTenant(invoice.clientId, req.user!.tenantId) : undefined;
  const recipient = customer?.email ?? `${invoice.client.replace(/\W+/g, '.').toLowerCase()}@exemple.test`;

  sendMail(
    recipient,
    `Facture ${invoice.ref}`,
    `Votre facture ${invoice.ref} d’un montant de ${invoice.total} €.`,
    'factures.novafact.example',
  );

  res.json({ sent: true, to: recipient, count: recent.length, from: 'factures.novafact.example' });
});

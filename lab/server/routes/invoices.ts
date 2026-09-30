// Factures : lecture, recherche, création, mise à jour, règlement, envoi.
//
// Exercices portés par ce fichier : bola-invoice, money-float, redos,
// invoice-state, number-coercion, max-safe-integer, bfla-method, bola-nested,
// error-leak, race-multi-endpoint, vary-missing, qs-type-confusion, orm-leak,
// token-in-url, send-quota.

import { Router } from 'express';
import crypto from 'node:crypto';
import { audit, db, find, sendMail, solve } from '../store.ts';
import { requireUser } from '../lib/auth.ts';
import { verifyStrict } from '../lib/jwt.ts';
import { sign } from '../lib/jwt.ts';
import type { Client, Invoice, InvoiceLine, User } from '../store.ts';

export const invoiceRoutes = Router();

/** Le mini-moteur de requêtes du lab ne connaît que des documents génériques. */
const rows = <T>(collection: T[]) => collection as unknown as Record<string, unknown>[];

// ────────────────────────────────────────────────────────────────────────────
// Ce qui est monté AVANT requireUser est servi sans jeton. C'est délibéré pour
// les deux challenges qui suivent : un cache partagé répond à la place de
// l'origine, et un lien « de consultation » porte son propre jeton.
// ────────────────────────────────────────────────────────────────────────────

const LIST_TTL_MS = 30_000;

// VULNÉRABLE (vary-missing) : la liste des factures est mise en cache sous une
// clé qui ne contient que le chemin. L'identité de l'appelant n'entre ni dans
// la clé, ni dans `Vary`, et la réponse part en `Cache-Control: public`. Le
// cache répond donc avant l'authentification, avec le contenu du premier
// arrivé.
//
// Correctif attendu : ce qui dépend de l'appelant ne va pas dans un cache
// partagé — `Cache-Control: private, no-store`. Si un cache est nécessaire, sa
// clé est conçue explicitement et contient le tenant. `Vary` seul est un
// correctif fragile : il fragmente le cache sans supprimer la cause.
invoiceRoutes.get('/', (req, res, next) => {
  const hit = db.caches.invoiceList;
  if (!hit || Date.now() - hit.at > LIST_TTL_MS) {
    next();
    return;
  }

  const anonymous = !req.user;
  const foreign = !anonymous && req.user!.tenantId !== hit.forTenant;
  if ((anonymous || foreign) && Array.isArray(hit.body) && hit.body.length > 0) {
    audit(req.user?.email ?? 'anonyme', 'cache.partagé', `liste de ${hit.forTenant} servie depuis le cache`);
    solve('vary-missing');
  }

  res.set('X-Lab-Cache', 'HIT').set('Cache-Control', 'public, max-age=30').json(hit.body);
});

/** Le jeton, quand il voyage là où il ne devrait pas : dans une URL. */
function tokenInUrl(url: string): string | null {
  const m = url.match(/[?&](?:token|access_token)=([A-Za-z0-9._~+/=-]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

/**
 * Le lab constate la fuite : un jeton VALIDE (signature vérifiée par
 * verifyStrict) est apparu ailleurs que dans l'en-tête Authorization.
 */
function noticeLeakedToken(where: string, url: string): boolean {
  const token = tokenInUrl(url);
  if (!token) return false;
  const claims = verifyStrict(token);
  if (!claims) return false;
  audit(claims.sub, 'jeton.exposé', `${where} : ${url.slice(0, 120)}`);
  solve('token-in-url');
  return true;
}

// VULNÉRABLE (token-in-url) : le lien de consultation porte le jeton d'accès en
// paramètre de requête. Le serveur l'accepte, puis écrit l'URL complète — jeton
// compris — dans son journal d'accès. Le navigateur, lui, la recopiera dans
// l'en-tête Referer de toute ressource tierce chargée par la page.
//
// Correctif attendu : les secrets voyagent dans les en-têtes ou les cookies,
// jamais dans l'URL — une URL est journalisée, mise en cache, partagée et
// transmise en Referer. Pour un lien partageable, un jeton à usage unique, de
// courte durée, distinct de la session, et `Referrer-Policy: no-referrer`.
invoiceRoutes.get('/:id/view', (req, res) => {
  const token = String(req.query.token ?? '');
  const claims = verifyStrict(token);

  // Le journal d'accès du lab : l'URL brute, comme n'importe quel access log.
  audit(claims?.sub ?? 'anonyme', 'accès', `GET /api/invoices${req.originalUrl.replace(/^\/api\/invoices/, '')}`);
  noticeLeakedToken('journal d’accès', req.originalUrl);

  if (!claims) {
    res.status(401).json({ error: 'lien de consultation invalide ou expiré' });
    return;
  }

  const invoice = db.invoices.find((i) => i.id === req.params.id && i.tenantId === claims.tenantId);
  if (!invoice) {
    res.status(404).json({ error: 'facture introuvable' });
    return;
  }

  // La page de consultation charge une ressource « de mesure d'audience ».
  res.type('html').send(
    `<!doctype html><meta charset="utf-8"><title>${invoice.ref}</title>` +
      `<h1>${invoice.ref}</h1><p>${invoice.client} — ${invoice.total} €</p>` +
      `<img src="/api/invoices/track.gif" alt="" width="1" height="1">`,
  );
});

/** Le « pixel de mesure » tiers. Le navigateur y joindra l'URL de la page. */
invoiceRoutes.get('/track.gif', (req, res) => {
  noticeLeakedToken('en-tête Referer', String(req.headers.referer ?? ''));
  res.type('image/gif').send(Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64'));
});

// ────────────────────────────────────────────────────────────────────────────

invoiceRoutes.use(requireUser);

// VULNÉRABLE (redos) : quantificateur imbriqué, évalué sur la boucle
// d'événements, avant toute borne de longueur utile.
//
// Correctif attendu : expression linéaire (/^[A-Z]{3}-[0-9]{4}$/ suffit ici),
// longueur bornée avant le test, ou moteur RE2.
const REF_PATTERN = /^([A-Za-z0-9]+-?)*$/;

/** Montant de la facture au moment où elle est passée à « payé ». */
const paidTotals = new Map<string, number>();

/** Remis à l'état initial par /api/lab/reset. */
export function resetInvoiceState(): void {
  paidTotals.clear();
  for (const inv of db.invoices) if (inv.status === 'paid') paidTotals.set(inv.id, inv.total);
}
resetInvoiceState();

// La liste, elle, filtre bien par tenant. C'est ce qui rend l'oubli de la route
// unitaire crédible : le contrôle existe, il est juste appliqué au cas par cas.
invoiceRoutes.get('/', (req, res) => {
  const body = db.invoices.filter((i) => i.tenantId === req.user!.tenantId);
  // …et c'est cette réponse, propre côté autorisation, qui part dans le cache
  // partagé sans aucune mention de l'identité pour laquelle elle a été calculée.
  db.caches.invoiceList = { body, at: Date.now(), forTenant: req.user!.tenantId };
  res.set('X-Lab-Cache', 'MISS').set('Cache-Control', 'public, max-age=30').json(body);
});

invoiceRoutes.get('/search', (req, res) => {
  const ref = String(req.query.ref ?? '').slice(0, 30); // borne de sécurité du lab
  const started = performance.now();
  const valid = REF_PATTERN.test(ref);
  const elapsed = performance.now() - started;

  if (elapsed > 1000) {
    audit(req.user!.email, 'perf.regex', `${Math.round(elapsed)} ms sur /invoices/search`);
    solve('redos');
  }

  res.json({
    valid,
    elapsedMs: Math.round(elapsed),
    results: valid
      ? db.invoices.filter((i) => i.tenantId === req.user!.tenantId && i.ref.includes(ref))
      : [],
  });
});

// VULNÉRABLE (qs-type-confusion) : `tenant` est attendu comme une chaîne. La
// syntaxe de tableau de la query string (`?tenant[]=…&tenant[]=…`) en fait un
// tableau, et les deux contrôles posés dessus — `.length` et `.includes()` —
// existent sur les deux types. Le tableau traverse la validation intact et
// atterrit tel quel dans le filtre.
//
// Correctif attendu : valider le TYPE avant tout le reste, par schéma —
// `typeof v === 'string'` d'abord, et seulement ensuite la longueur et le
// contenu. Et configurer l'analyseur de query string pour qu'il ne fabrique ni
// tableaux ni objets imbriqués quand on n'en attend pas
// (`app.set('query parser', 'simple')`).
invoiceRoutes.get('/lookup', (req, res) => {
  const scope = (req.query.tenant ?? req.user!.tenantId) as string | string[];

  if (!scope.length || scope.length > 32) {
    res.status(400).json({ error: 'paramètre tenant invalide' });
    return;
  }
  if (!scope.includes(req.user!.tenantId)) {
    res.status(403).json({ error: 'hors de votre périmètre' });
    return;
  }

  const results = find(rows(db.invoices), { tenantId: { $in: ([] as unknown[]).concat(scope) } }) as unknown as Invoice[];

  const foreign = results.filter((i) => i.tenantId !== req.user!.tenantId);
  if (foreign.length > 0) {
    audit(req.user!.email, 'cloisonnement.rompu', `${foreign.length} facture(s) hors tenant via ?tenant[]`);
    solve('qs-type-confusion');
  }

  res.json({ scope, results });
});

/** Ce que l'« ORM » du lab renvoie quand on lui demande la relation `owner`. */
const ownerRow = (u: User) => ({
  ...u,
  // La colonne d'authentification. Aucune route ne l'expose — sauf par une
  // relation jointe en entier.
  passwordHash: crypto.createHash('sha256').update(u.password).digest('hex'),
});

// VULNÉRABLE (orm-leak) : le filtre du client est étalé dans la requête, donc
// il peut réécrire la clause de tenant que la route venait de poser ; et les
// relations demandées reviennent avec toutes leurs colonnes.
//
// Correctif attendu : sélection explicite des champs, jamais d'inclusion d'une
// relation entière ; et un filtre accepté sous forme de liste blanche
// d'opérateurs et de colonnes, pas l'objet du client. La clause de tenant se
// pose en dernier, ou mieux : dans le repository, où rien ne peut l'écraser.
invoiceRoutes.post('/query', (req, res) => {
  const { where, include } = (req.body ?? {}) as { where?: Record<string, unknown>; include?: unknown };

  const filter: Record<string, unknown> = { tenantId: req.user!.tenantId, ...(where ?? {}) };
  const found = find(rows(db.invoices), filter) as unknown as Invoice[];

  const relations = Array.isArray(include) ? include.map(String) : include ? [String(include)] : [];
  const results = found.map((inv) => {
    const row: Record<string, unknown> = { ...inv };
    if (relations.includes('customer')) {
      row.customer = db.clients.find((c) => c.id === inv.clientId) ?? null;
    }
    if (relations.includes('owner')) {
      const owner = db.users.find((u) => u.tenantId === inv.tenantId);
      row.owner = owner ? ownerRow(owner) : null;
    }
    return row;
  });

  const leakedSecret = results.some(
    (r) => (r.owner as { passwordHash?: string } | null)?.passwordHash || (r.customer as Client | null)?.iban,
  );
  if (leakedSecret) {
    audit(req.user!.email, 'fuite.relation', 'colonne secrète renvoyée par une relation jointe');
    solve('orm-leak');
  }

  res.json({ filter, results });
});

// VULNÉRABLE (bola-invoice) : authentifié, donc servi. Le tenant du demandeur
// n'entre jamais dans la requête.
//
// Correctif attendu : que la couche d'accès aux données exige le tenant
// (repository tenant-aware, ou RLS PostgreSQL), pour qu'aucune route ne puisse
// l'oublier. Un middleware qui compare après coup reste oubliable.
invoiceRoutes.get('/:id', (req, res) => {
  const invoice = db.invoices.find((i) => i.id === req.params.id);
  if (!invoice) {
    res.status(404).json({ error: 'facture introuvable' });
    return;
  }

  if (invoice.tenantId !== req.user!.tenantId) {
    audit(req.user!.email, 'bola', `${invoice.id} appartient à ${invoice.tenantId}`);
    solve('bola-invoice');
  }

  res.json(invoice);
});

/** Le lien de partage : c'est lui qui met le jeton de session dans une URL. */
invoiceRoutes.get('/:id/share', (req, res) => {
  const invoice = db.invoices.find((i) => i.id === req.params.id && i.tenantId === req.user!.tenantId);
  if (!invoice) {
    res.status(404).json({ error: 'facture introuvable' });
    return;
  }
  const token = sign({ sub: req.user!.email, role: req.user!.role, tenantId: req.user!.tenantId });
  res.json({ url: `/api/invoices/${invoice.id}/view?token=${token}` });
});

// VULNÉRABLE (number-coercion) : `Number()` n'est pas une validation, c'est une
// conversion qui réussit presque toujours. Elle accepte la notation
// exponentielle, l'hexadécimal, les espaces autour, la chaîne vide (→ 0), et
// produit `Infinity` ou `NaN` sans jamais lever.
//
// Correctif attendu : un schéma qui dit ce qu'est un montant — entier, fini,
// borné — et le rejet comme seule autre issue.
const toNumber = (v: unknown) => Number(v ?? 0);

function computeTotal(lines: InvoiceLine[]): number {
  // VULNÉRABLE (money-float) : flottants, et aucune borne sur qty ni unitPrice.
  //
  // Correctif attendu : centimes entiers (ou décimal), qty entier > 0 imposé
  // par le schéma, unitPrice >= 0, et invariant « total >= 0 » vérifié avant
  // persistance.
  return lines.reduce((sum, l) => sum + l.qty * l.unitPrice, 0);
}

/**
 * VULNÉRABLE (max-safe-integer) : le produit quantité × prix est accumulé en
 * flottant. Passé 2^53, l'addition cesse d'incrémenter : une ligne
 * supplémentaire devient gratuite.
 *
 * Le lab teste l'invariant que le fix nomme : augmenter une quantité doit
 * augmenter le total. Sonde bornée aux 50 premières lignes, pour que le contrôle
 * reste linéaire.
 *
 * Correctif attendu : montants en centimes entiers (ou décimal exact) et
 * quantités bornées par le métier bien avant la limite du langage.
 */
function totalIsMonotonic(lines: InvoiceLine[], total: number): boolean {
  for (let i = 0; i < Math.min(lines.length, 50); i++) {
    if (!(lines[i].unitPrice > 0)) continue;
    const bumped = lines.map((l, j) => (j === i ? { ...l, qty: l.qty + 1 } : l));
    if (!(computeTotal(bumped) > total)) return false;
  }
  return true;
}

/** Vérifie les invariants arithmétiques au moment où la facture est écrite. */
function checkTotals(actor: string, invoice: Invoice): void {
  if (invoice.total < 0) {
    audit(actor, 'invariant.rompu', `${invoice.id} total=${invoice.total}`);
    solve('money-float');
  }

  if (!Number.isFinite(invoice.total)) {
    audit(actor, 'invariant.rompu', `${invoice.id} total non fini : ${invoice.total}`);
    solve('number-coercion');
  } else if (!totalIsMonotonic(invoice.lines, invoice.total)) {
    audit(actor, 'invariant.rompu', `${invoice.id} total=${invoice.total} : une ligne de plus ne coûte rien`);
    solve('max-safe-integer');
  }
}

invoiceRoutes.post('/', (req, res) => {
  const { client, clientId, lines, note } = req.body ?? {};
  if (!Array.isArray(lines) || lines.length === 0) {
    res.status(400).json({ error: 'au moins une ligne est requise' });
    return;
  }

  // VULNÉRABLE (bola-nested) : le tenant de l'appelant est vérifié par
  // requireUser, mais l'identifiant IMBRIQUÉ — le client auquel la facture est
  // rattachée — ne l'est pas. Il est simplement recherché par sa clé.
  //
  // Correctif attendu : chaque identifiant qui entre dans une requête est à
  // autoriser, pas seulement celui de la route. Le contrôle appartient au
  // repository : `findClient(id, tenantId)` ne peut pas être appelé sans le
  // tenant.
  let customer: Client | undefined;
  if (typeof clientId === 'string' && clientId) {
    customer = db.clients.find((c) => c.id === clientId);
    if (!customer) {
      res.status(404).json({ error: 'client introuvable' });
      return;
    }
    if (customer.tenantId !== req.user!.tenantId) {
      audit(req.user!.email, 'bola.imbriqué', `${customer.id} appartient à ${customer.tenantId}`);
      solve('bola-nested');
    }
  }

  const clean: InvoiceLine[] = lines.map((l: Partial<InvoiceLine>) => ({
    label: String(l.label ?? 'Ligne'),
    qty: toNumber(l.qty ?? 1),
    unitPrice: toNumber(l.unitPrice ?? 0),
  }));
  const total = computeTotal(clean);

  const n = db.invoices.length + 1001;
  const invoice: Invoice = {
    id: `INV-${n}`,
    tenantId: req.user!.tenantId,
    ref: `INV-${n}`,
    client: customer?.name ?? String(client ?? 'Client'),
    clientId: customer?.id,
    status: 'draft',
    lines: clean,
    total,
    note: String(note ?? ''),
  };
  db.invoices.push(invoice);

  checkTotals(req.user!.email, invoice);

  res.status(201).json(invoice);
});

// VULNÉRABLE (invoice-state) : le statut d'arrivée est choisi par le client et
// aucune transition n'est interdite. Le montant reste modifiable après paiement.
//
// Correctif attendu : machine à états déclarée côté serveur (draft → sent →
// paid → void, sans retour), champs immuables une fois « paid », annulation par
// avoir plutôt que par édition, et journal d'audit.
invoiceRoutes.patch('/:id', (req, res) => {
  const invoice = db.invoices.find((i) => i.id === req.params.id);
  if (!invoice) {
    res.status(404).json({ error: 'facture introuvable' });
    return;
  }
  if (invoice.tenantId !== req.user!.tenantId) {
    res.status(403).json({ error: 'interdit' });
    return;
  }

  const { status, lines, note, client } = req.body ?? {};
  if (Array.isArray(lines)) {
    invoice.lines = lines.map((l: Partial<InvoiceLine>) => ({
      label: String(l.label ?? 'Ligne'),
      qty: toNumber(l.qty ?? 1),
      unitPrice: toNumber(l.unitPrice ?? 0),
    }));
    invoice.total = computeTotal(invoice.lines);
  }
  if (typeof note === 'string') invoice.note = note;
  if (typeof client === 'string') invoice.client = client;
  if (typeof status === 'string') invoice.status = status as Invoice['status'];

  if (invoice.status === 'paid') {
    const previous = paidTotals.get(invoice.id);
    if (previous !== undefined && invoice.total < previous) {
      audit(req.user!.email, 'invariant.rompu', `${invoice.id} payée : ${previous} → ${invoice.total}`);
      solve('invoice-state');
    }
    paidTotals.set(invoice.id, Math.max(previous ?? 0, invoice.total));
  }

  res.json(invoice);
});

// VULNÉRABLE (bfla-method) : le contrôle d'appartenance au tenant a été posé
// sur la lecture (GET) et sur la mise à jour (PATCH). Personne ne l'a reporté
// sur la suppression — la méthode a été ajoutée après.
//
// Correctif attendu : un contrôle posé méthode par méthode sera oublié à la
// prochaine méthode. Il se pose sur la ressource, dans la couche d'accès aux
// données. API5:2023 (Broken Function Level Authorization).
invoiceRoutes.delete('/:id', (req, res) => {
  const index = db.invoices.findIndex((i) => i.id === req.params.id);
  if (index < 0) {
    res.status(404).json({ error: 'facture introuvable' });
    return;
  }

  const invoice = db.invoices[index];
  if (invoice.tenantId !== req.user!.tenantId) {
    audit(req.user!.email, 'bfla', `DELETE ${invoice.id}, propriété de ${invoice.tenantId}`);
    solve('bfla-method');
  }

  db.invoices.splice(index, 1);
  res.json({ ok: true, deleted: invoice.id });
});

/** Les factures du tenant courant, et elles seules. */
const ownInvoice = (id: string, tenantId: string) =>
  db.invoices.find((i) => i.id === id && i.tenantId === tenantId);

// VULNÉRABLE (error-leak) : la réémission écrit AVANT de valider. Quand l'étape
// de validation jette, la facture reste à mi-chemin — statut retombé en
// brouillon, total effacé — et l'exception remonte telle quelle au gestionnaire
// global, qui renvoie le message et la pile au client.
//
// Correctif attendu : échec sûr. Valider entièrement avant d'écrire quoi que ce
// soit, écrire en tout-ou-rien (transaction), et un gestionnaire d'erreurs qui
// ne révèle ni message interne ni pile. A10:2025 est entrée au Top 10 pour ça.
invoiceRoutes.post('/:id/reissue', (req, res) => {
  const invoice = ownInvoice(req.params.id, req.user!.tenantId);
  if (!invoice) {
    res.status(404).json({ error: 'facture introuvable' });
    return;
  }

  let complete = false;
  try {
    invoice.status = 'draft';        // écriture 1/4
    invoice.total = Number.NaN;      // écriture 2/4 : l'ancien total est effacé
    const spec = JSON.parse(String(req.body?.spec ?? '')) as { lines?: Partial<InvoiceLine>[] };
    invoice.lines = (spec.lines ?? []).map((l) => ({
      label: String(l.label ?? 'Ligne'),
      qty: toNumber(l.qty ?? 1),
      unitPrice: toNumber(l.unitPrice ?? 0),
    }));                             // écriture 3/4
    invoice.total = computeTotal(invoice.lines); // écriture 4/4
    complete = true;
    res.json(invoice);
  } finally {
    if (!complete) {
      audit(req.user!.email, 'état.incohérent', `${invoice.id} laissée à mi-écriture, total=${invoice.total}`);
      solve('error-leak');
    }
  }
});

/** Simule l'aller-retour vers la base : c'est la fenêtre de la course. */
const roundtrip = () => new Promise((r) => setTimeout(r, 15));

/** Payée ET remboursée : deux états qui s'excluent. */
function checkSettlement(actor: string, invoice: Invoice): void {
  if (invoice.paid && invoice.refunded) {
    audit(actor, 'invariant.rompu', `${invoice.id} simultanément payée et remboursée`);
    solve('race-multi-endpoint');
  }
}

// VULNÉRABLE (race-multi-endpoint) : deux routes, deux transitions d'état, et
// chacune fait lecture → attente → décision → attente → écriture dans son coin.
// Rien ne les sérialise : lancées ensemble, elles lisent toutes les deux un état
// encore vierge et écrivent toutes les deux.
//
// Correctif attendu : une transition d'état est une écriture conditionnelle
// unique (`UPDATE … SET status = 'paid' WHERE id = ? AND status <> 'refunded'`),
// pas une lecture suivie d'une écriture. Les courses multi-endpoints se ferment
// dans la base, jamais dans le code applicatif.
invoiceRoutes.post('/:id/pay', async (req, res) => {
  const invoice = ownInvoice(req.params.id, req.user!.tenantId);
  if (!invoice) {
    res.status(404).json({ error: 'facture introuvable' });
    return;
  }

  const alreadyRefunded = invoice.refunded === true; // lecture
  await roundtrip();
  if (alreadyRefunded) {
    res.status(409).json({ error: 'facture déjà remboursée' });
    return;
  }

  await roundtrip();
  invoice.paid = true;               // écriture
  invoice.status = 'paid';
  paidTotals.set(invoice.id, invoice.total);

  checkSettlement(req.user!.email, invoice);
  res.json({ ok: true, id: invoice.id, paid: true, refunded: Boolean(invoice.refunded) });
});

invoiceRoutes.post('/:id/refund', async (req, res) => {
  const invoice = ownInvoice(req.params.id, req.user!.tenantId);
  if (!invoice) {
    res.status(404).json({ error: 'facture introuvable' });
    return;
  }

  const alreadyPaid = invoice.paid === true; // lecture
  await roundtrip();
  if (alreadyPaid) {
    res.status(409).json({ error: 'facture déjà réglée : passer par un avoir' });
    return;
  }

  await roundtrip();
  invoice.refunded = true;           // écriture
  invoice.status = 'void';

  checkSettlement(req.user!.email, invoice);
  res.json({ ok: true, id: invoice.id, paid: Boolean(invoice.paid), refunded: true });
});

/** Au-delà, le lab considère que la sortie n'est plus de la facturation. */
const ABUSE_THRESHOLD = 100;

// VULNÉRABLE (send-quota) : n'importe quel compte peut envoyer autant de
// messages qu'il veut, vers n'importe quelle adresse, avec un sujet et un corps
// entièrement libres — depuis le domaine de Novafact, qui est authentifié
// SPF/DKIM. Le contenu n'est pas relié à la facture, et rien ne compte.
//
// Correctif attendu : quotas progressifs liés à l'ancienneté et à la
// vérification du compte, corps généré à partir de la facture (pas repris du
// client), analyse du contenu sortant, réputation par tenant, canal de
// signalement, et sous-domaine distinct pour les envois transactionnels.
invoiceRoutes.post('/:id/send', (req, res) => {
  const invoice = ownInvoice(req.params.id, req.user!.tenantId);
  if (!invoice) {
    res.status(404).json({ error: 'facture introuvable' });
    return;
  }

  const { to, subject, body } = req.body ?? {};
  const recipient = String(to ?? `${invoice.client}@exemple.test`);

  sendMail(
    recipient,
    String(subject ?? `Facture ${invoice.ref}`),
    String(body ?? `Votre facture ${invoice.ref} d’un montant de ${invoice.total} €.`),
    'novafact.example',
  );
  db.sends.push({ at: Date.now(), tenantId: req.user!.tenantId, actor: req.user!.email, to: recipient });

  const sent = db.sends.filter((s) => s.tenantId === req.user!.tenantId).length;
  if (sent >= ABUSE_THRESHOLD) {
    audit(req.user!.email, 'abus.sortant', `${sent} envois depuis novafact.example, sans quota`);
    solve('send-quota');
  }

  res.json({ sent: true, to: recipient, count: sent, from: 'novafact.example' });
});

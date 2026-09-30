// Import de lots de factures : archive, facture électronique (Factur-X), et
// document JSON brut.
//
// Exercices portés par ce fichier : zip-slip, xxe-import, xml-entity-expansion,
// et la route qui donne accès au défaut de server/lib/validate.ts
// (json-duplicate-keys).
//
// Le parseur XML ci-dessous est écrit à la main, et volontairement permissif :
// DOCTYPE accepté, entités internes et externes résolues, aucune limite
// d'expansion. C'est le RÉGLAGE fautif d'un vrai parseur, reproduit en trente
// lignes plutôt qu'importé avec une bibliothèque.

import express, { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { audit, db, solve } from '../store.ts';
import { requireUser } from '../lib/auth.ts';
import { validateRawInvoice } from '../lib/validate.ts';
import type { Invoice, InvoiceLine } from '../store.ts';

export const importRoutes = Router();

// Les corps qui ne sont pas de l'`application/json` arrivent ici en texte :
// express.json() (monté dans server/index.ts) ne les reconnaît pas et laisse
// le flux intact.
importRoutes.use(
  express.text({
    type: ['application/xml', 'text/xml', 'application/*+xml', 'text/plain'],
    limit: '2mb',
  }),
);
importRoutes.use(requireUser);

const here = path.dirname(fileURLToPath(import.meta.url));
const DATA_ROOT = path.resolve(here, '../data');
const IMPORT_ROOT = path.resolve(DATA_ROOT, 'import');

/** La configuration d'un tenant voisin, sur le disque. Cible de zip-slip. */
const NEIGHBOUR_CONFIG = path.resolve(DATA_ROOT, 'tenants/globex/settings.json');
fs.mkdirSync(path.dirname(NEIGHBOUR_CONFIG), { recursive: true });
if (!fs.existsSync(NEIGHBOUR_CONFIG)) {
  fs.writeFileSync(
    NEIGHBOUR_CONFIG,
    JSON.stringify({ tenant: 'globex', theme: 'dark', analyticsUrl: '', signataire: 'Direction Globex' }, null, 2),
  );
}

// ── Import d'une archive ────────────────────────────────────────────────────

interface ArchiveEntry {
  name: string;
  content: string;
}

/**
 * VULNÉRABLE (zip-slip) : le chemin de destination est obtenu en concaténant le
 * nom de l'entrée au dossier cible. `path.join` résout les `..` et sort du
 * dossier — le nom d'entrée d'une archive est une donnée d'attaquant comme une
 * autre, et rien ne le normalise ni ne le vérifie.
 *
 * Correctif attendu : `path.resolve` puis vérification du préfixe AVEC le
 * séparateur (sinon `/data/import-evil` passe), refus des entrées absolues
 * comme des liens symboliques, et un nom de fichier régénéré côté serveur
 * plutôt que repris de l'archive. Recherche Zip Slip (Snyk).
 *
 * Le garde-fou du lab, lui, refuse toute écriture hors de `server/data` : le
 * défaut est entier, sa portée est bornée au dossier de données du lab.
 */
importRoutes.post('/archive', (req, res) => {
  const entries = (req.body?.entries ?? []) as Partial<ArchiveEntry>[];
  if (!Array.isArray(entries) || entries.length === 0) {
    res.status(400).json({ error: 'archive vide : « entries » est requis' });
    return;
  }

  const base = path.resolve(IMPORT_ROOT, req.user!.tenantId);
  fs.mkdirSync(base, { recursive: true });

  const extracted = entries.slice(0, 50).map((entry) => {
    const name = String(entry?.name ?? '');
    const target = path.join(base, name);
    const resolved = path.resolve(target);

    if (!resolved.startsWith(base + path.sep)) {
      audit(req.user!.email, 'zip-slip', `${name} → ${resolved}`);
      solve('zip-slip');
    }

    if (!resolved.startsWith(DATA_ROOT + path.sep)) {
      return { name, path: resolved, written: false, note: 'refusé par le garde-fou du lab' };
    }

    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    fs.writeFileSync(resolved, String(entry?.content ?? ''), 'utf8');
    return { name, path: resolved, written: true };
  });

  res.status(201).json({ base, extracted });
});

// ── Parseur XML du lab ──────────────────────────────────────────────────────

/** Plafonds du lab : ils empêchent l'OOM, pas le défaut. */
const MAX_EXPANDED = 4 * 1024 * 1024;
const MAX_DEPTH = 60;
const MAX_ENTITY_FILE = 4000;

interface XmlParse {
  text: string;
  /** Entités externes effectivement résolues, avec leur contenu. */
  resolved: { name: string; system: string; sample: string }[];
  expandedBytes: number;
  overflowed: boolean;
  elapsedMs: number;
}

/**
 * VULNÉRABLE (xxe-import) : le DOCTYPE est accepté et les entités externes sont
 * résolues. Une entité `SYSTEM "file:///…"` fait lire un fichier du serveur au
 * parseur, et son contenu se retrouve là où l'entité était référencée — donc
 * dans un champ de la facture créée.
 *
 * VULNÉRABLE (xml-entity-expansion) : aucune limite d'expansion ni de
 * profondeur. Neuf entités qui se référencent l'une l'autre suffisent à faire
 * produire des gigaoctets à partir de quelques centaines d'octets. La
 * disponibilité est une exigence de sécurité : un parseur sans budget est un
 * déni de service en attente.
 *
 * Correctif attendu : entités externes et DOCTYPE désactivés — c'est un
 * réglage, pas un filtrage ; limites d'expansion, de profondeur et de taille
 * fixées AVANT le parsing ; traitement hors de la boucle d'événements. Et si le
 * besoin le permet, un format sans entités ni références.
 */
function parseXml(source: string): XmlParse {
  const started = performance.now();

  const internal: Record<string, string> = Object.create(null);
  const external: Record<string, string> = Object.create(null);

  const doctype = source.match(/<!DOCTYPE[^>[]*\[([\s\S]*?)\]\s*>/);
  if (doctype) {
    for (const m of doctype[1].matchAll(/<!ENTITY\s+([A-Za-z_][\w.:-]*)\s+SYSTEM\s+"([^"]*)"\s*>/g)) {
      external[m[1]] = m[2];
    }
    for (const m of doctype[1].matchAll(/<!ENTITY\s+([A-Za-z_][\w.:-]*)\s+"([^"]*)"\s*>/g)) {
      if (!(m[1] in external)) internal[m[1]] = m[2];
    }
  }

  // Les cinq entités prédéfinies de XML. Elles ne se réfèrent à rien et ne
  // posent aucun problème : ce sont les DÉCLARATIONS du DOCTYPE qui en posent.
  const PREDEFINED: Record<string, string> = { lt: '<', gt: '>', amp: '&', apos: "'", quot: '"' };

  const resolved: XmlParse['resolved'] = [];
  const fetchExternal = (name: string): string => {
    const system = external[name];
    try {
      const url = new URL(system);
      if (url.protocol !== 'file:') return `[[ schéma ${url.protocol} refusé par le lab ]]`;
      const body = fs.readFileSync(url.pathname, 'utf8').slice(0, MAX_ENTITY_FILE);
      resolved.push({ name, system, sample: body.trim().slice(0, 40) });
      return body;
    } catch (err) {
      return `[[ ${String((err as Error).message ?? err)} ]]`;
    }
  };

  // Expansion récursive, avec un budget d'octets vérifié à chaque ajout : c'est
  // ce budget qui remplace la mémoire de la machine, et c'est son dépassement
  // que le lab constate.
  const sink: string[] = [];
  let produced = 0;
  let overflowed = false;

  const push = (s: string): void => {
    if (overflowed) return;
    produced += s.length;
    if (produced > MAX_EXPANDED) {
      overflowed = true;
      return;
    }
    sink.push(s);
  };

  const expand = (text: string, depth: number): void => {
    if (overflowed) return;
    const re = /&([A-Za-z_][\w.:-]*);/g;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      push(text.slice(last, m.index));
      last = m.index + m[0].length;
      if (overflowed) return;
      const name = m[1];
      if (depth < MAX_DEPTH && internal[name] !== undefined) expand(internal[name], depth + 1);
      else if (depth < MAX_DEPTH && external[name] !== undefined) push(fetchExternal(name));
      else if (PREDEFINED[name] !== undefined) push(PREDEFINED[name]);
      else push(m[0]);
    }
    push(text.slice(last));
  };

  const body = doctype ? source.replace(doctype[0], '') : source;
  expand(body, 0);

  return {
    text: sink.join(''),
    resolved,
    expandedBytes: produced,
    overflowed,
    elapsedMs: Math.round(performance.now() - started),
  };
}

const tagValue = (xml: string, tag: string): string => {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
  return m ? m[1].trim() : '';
};

/** Le budget que le serveur s'accorde pour traiter un import. */
const IMPORT_BUDGET_MS = 2000;

importRoutes.post('/facturx', (req, res) => {
  const source = typeof req.body === 'string' ? req.body : String(req.body?.xml ?? '');
  if (!source.trim()) {
    res.status(400).json({ error: 'document XML attendu (Content-Type: application/xml)' });
    return;
  }

  const parsed = parseXml(source);

  if (parsed.overflowed || parsed.elapsedMs > IMPORT_BUDGET_MS) {
    audit(
      req.user!.email,
      'budget.dépassé',
      `expansion d’entités : ${parsed.expandedBytes} octets en ${parsed.elapsedMs} ms pour ${source.length} octets reçus`,
    );
    solve('xml-entity-expansion');
    res.status(413).json({
      error: 'budget d’import dépassé',
      receivedBytes: source.length,
      expandedBytes: parsed.expandedBytes,
      elapsedMs: parsed.elapsedMs,
    });
    return;
  }

  const lines: InvoiceLine[] = [
    ...parsed.text.matchAll(/<line\b[^>]*label="([^"]*)"[^>]*qty="([^"]*)"[^>]*unitPrice="([^"]*)"[^>]*\/?>/gi),
  ].map((m) => ({ label: m[1], qty: Number(m[2]), unitPrice: Number(m[3]) }));

  const n = db.invoices.length + 1001;
  const invoice: Invoice = {
    id: `INV-${n}`,
    tenantId: req.user!.tenantId,
    ref: tagValue(parsed.text, 'ref') || `INV-${n}`,
    client: tagValue(parsed.text, 'client') || 'Client',
    status: 'draft',
    lines: lines.length ? lines : [{ label: 'Import Factur-X', qty: 1, unitPrice: 0 }],
    total: lines.reduce((s, l) => s + l.qty * l.unitPrice, 0),
    note: tagValue(parsed.text, 'note'),
  };
  db.invoices.push(invoice);

  // Le point de rupture : le contenu d'un fichier du serveur, lu par le
  // parseur, est maintenant persisté dans une facture.
  const leaked = parsed.resolved.find(
    (e) => e.sample.length > 0 && (invoice.note.includes(e.sample) || invoice.client.includes(e.sample)),
  );
  if (leaked) {
    audit(req.user!.email, 'xxe', `${leaked.system} recopié dans ${invoice.id}`);
    solve('xxe-import');
  }

  res.status(201).json({ invoice, entities: parsed.resolved.map((e) => e.system), expandedBytes: parsed.expandedBytes });
});

// ── Import d'un document JSON brut ──────────────────────────────────────────
//
// Le défaut est dans server/lib/validate.ts : le schéma passe sur le TEXTE, et
// l'application travaille sur l'objet issu de JSON.parse.
//
// Le document arrive en `text/plain` : c'est ce qui laisse le corps brut
// atteindre cette route, là où `express.json()` l'aurait déjà consommé.

importRoutes.post('/invoice-json', (req, res) => {
  const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {});
  const checked = validateRawInvoice(raw, req.user!.email);
  if (!checked.ok) {
    res.status(400).json({ error: checked.error });
    return;
  }

  const n = db.invoices.length + 1001;
  const invoice: Invoice = {
    id: `INV-${n}`,
    tenantId: req.user!.tenantId,
    ref: `INV-${n}`,
    client: checked.value.client,
    status: 'draft',
    lines: checked.value.lines,
    total: checked.value.lines.reduce((s, l) => s + l.qty * l.unitPrice, 0),
    note: 'Importé depuis un document JSON.',
  };
  db.invoices.push(invoice);

  res.status(201).json(invoice);
});

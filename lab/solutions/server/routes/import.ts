// Corrigé de server/routes/import.ts.
// Défauts éliminés : zip-slip, xxe-import, xml-entity-expansion — et la route
// qui expose json-duplicate-keys, corrigé dans solutions/server/lib/validate.ts.

import express, { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from '../store.ts';
import { requireUser } from '../lib/auth.ts';
import { validateRawInvoice } from '../lib/validate.ts';
import type { Invoice, InvoiceLine } from '../store.ts';

export const importRoutes = Router();

importRoutes.use(
  express.text({
    type: ['application/xml', 'text/xml', 'application/*+xml', 'text/plain'],
    limit: '256kb',
  }),
);
importRoutes.use(requireUser);

const here = path.dirname(fileURLToPath(import.meta.url));
const DATA_ROOT = path.resolve(here, '../data');
const IMPORT_ROOT = path.resolve(DATA_ROOT, 'import');

// ── Import d'une archive ────────────────────────────────────────────────────

interface ArchiveEntry {
  name: string;
  content: string;
}

/**
 * CORRIGÉ (zip-slip) : le nom d'entrée d'une archive est une donnée
 * d'attaquant. Trois choses le rendent inoffensif :
 *
 *   1. le chemin est RÉSOLU puis comparé au dossier cible, séparateur compris
 *      (sans le séparateur, `/data/import-evil` passerait) ;
 *   2. les entrées absolues, les segments `..` et les noms vides sont refusés
 *      avant même la résolution ;
 *   3. rien n'est écrit tant qu'une seule entrée est suspecte — l'extraction
 *      est tout-ou-rien.
 *
 * En production, on ajoute le refus des liens symboliques (`lstat` sur chaque
 * segment) et un nom de fichier régénéré côté serveur.
 */
const SAFE_ENTRY = /^[A-Za-z0-9](?:[A-Za-z0-9._-]*\/?)*[A-Za-z0-9._-]$/;

importRoutes.post('/archive', (req, res) => {
  const entries = (req.body?.entries ?? []) as Partial<ArchiveEntry>[];
  if (!Array.isArray(entries) || entries.length === 0 || entries.length > 50) {
    res.status(400).json({ error: 'archive vide ou trop volumineuse' });
    return;
  }

  const base = path.resolve(IMPORT_ROOT, req.user!.tenantId);

  const planned: { name: string; target: string; content: string }[] = [];
  for (const entry of entries) {
    const name = String(entry?.name ?? '');
    if (!name || path.isAbsolute(name) || name.split(/[\\/]/).includes('..') || !SAFE_ENTRY.test(name)) {
      res.status(400).json({ error: `entrée d’archive refusée : ${name.slice(0, 120)}` });
      return;
    }
    const target = path.resolve(base, name);
    if (target !== base && !target.startsWith(base + path.sep)) {
      res.status(400).json({ error: `entrée d’archive hors du dossier d’import : ${name.slice(0, 120)}` });
      return;
    }
    planned.push({ name, target, content: String(entry?.content ?? '') });
  }

  fs.mkdirSync(base, { recursive: true });
  const extracted = planned.map((p) => {
    fs.mkdirSync(path.dirname(p.target), { recursive: true });
    fs.writeFileSync(p.target, p.content, 'utf8');
    return { name: p.name, path: p.target, written: true };
  });

  res.status(201).json({ base, extracted });
});

// ── Parseur XML ─────────────────────────────────────────────────────────────

/**
 * CORRIGÉ (xxe-import, xml-entity-expansion) : le DOCTYPE est REFUSÉ, point.
 * C'est un réglage, pas un filtrage : sans déclaration d'entités, il n'y a ni
 * entité externe à résoudre, ni expansion à faire exploser. Les seules entités
 * reconnues sont les cinq entités prédéfinies de XML, qui ne se réfèrent à
 * rien.
 *
 * S'y ajoutent les limites fixées AVANT le parsing — taille du document,
 * profondeur, nombre d'éléments —, parce qu'un parseur sans budget est un déni
 * de service en attente : la disponibilité est une exigence de sécurité.
 *
 * Et si le besoin le permet : un format sans entités ni références du tout.
 */
const MAX_DOCUMENT = 256 * 1024;

const PREDEFINED: Record<string, string> = {
  lt: '<',
  gt: '>',
  amp: '&',
  apos: "'",
  quot: '"',
};

function parseXml(source: string): { ok: true; text: string } | { ok: false; error: string } {
  if (source.length > MAX_DOCUMENT) return { ok: false, error: 'document XML trop volumineux' };
  if (/<!DOCTYPE/i.test(source)) {
    return { ok: false, error: 'DOCTYPE refusé : les déclarations d’entités ne sont pas acceptées' };
  }
  if (/<!ENTITY/i.test(source)) {
    return { ok: false, error: 'déclaration d’entité refusée' };
  }

  const text = source.replace(/&([A-Za-z]+|#\d+|#x[0-9A-Fa-f]+);/g, (whole, name: string) => {
    if (name.startsWith('#')) {
      const code = name.startsWith('#x') ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : whole;
    }
    return PREDEFINED[name] ?? whole;
  });

  return { ok: true, text };
}

const tagValue = (xml: string, tag: string): string => {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
  return m ? m[1].trim() : '';
};

importRoutes.post('/facturx', (req, res) => {
  const source = typeof req.body === 'string' ? req.body : String(req.body?.xml ?? '');
  if (!source.trim()) {
    res.status(400).json({ error: 'document XML attendu (Content-Type: application/xml)' });
    return;
  }

  const parsed = parseXml(source);
  if (!parsed.ok) {
    res.status(400).json({ error: parsed.error });
    return;
  }

  const lines: InvoiceLine[] = [
    ...parsed.text.matchAll(/<line\b[^>]*label="([^"]*)"[^>]*qty="([^"]*)"[^>]*unitPrice="([^"]*)"[^>]*\/?>/gi),
  ]
    .slice(0, 500)
    .map((m) => ({ label: m[1].slice(0, 200), qty: Number(m[2]), unitPrice: Number(m[3]) }))
    .filter((l) => Number.isInteger(l.qty) && l.qty > 0 && Number.isFinite(l.unitPrice) && l.unitPrice >= 0);

  const n = db.invoices.length + 1001;
  const invoice: Invoice = {
    id: `INV-${n}`,
    tenantId: req.user!.tenantId,
    ref: (tagValue(parsed.text, 'ref') || `INV-${n}`).slice(0, 40),
    client: (tagValue(parsed.text, 'client') || 'Client').slice(0, 200),
    status: 'draft',
    lines: lines.length ? lines : [{ label: 'Import Factur-X', qty: 1, unitPrice: 0 }],
    total: lines.reduce((s, l) => s + l.qty * l.unitPrice, 0),
    note: tagValue(parsed.text, 'note').slice(0, 2000),
  };
  db.invoices.push(invoice);

  res.status(201).json({ invoice, entities: [], expandedBytes: parsed.text.length });
});

// ── Import d'un document JSON brut ──────────────────────────────────────────

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

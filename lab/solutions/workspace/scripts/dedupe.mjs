// Livrable de référence du challenge « finding-dedupe ».
//
//   node scripts/dedupe.mjs <dossier-des-rapports>
//
// Lit les trois rapports bruts, les ramène à une forme commune, les regroupe
// par clé de dédoublonnage, et écrit la liste fusionnée en JSON sur la sortie
// standard, triée par clé.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const dossier = process.argv[2];
if (!dossier) {
  console.error('usage : node scripts/dedupe.mjs <dossier-des-rapports>');
  process.exit(1);
}

const ECHELLE = ['low', 'medium', 'high', 'critical'];
const CORRESPONDANCES = {
  semgrep: { INFO: 'low', WARNING: 'medium', ERROR: 'high' },
  njsscan: { INFO: 'low', WARNING: 'medium', ERROR: 'high' },
  snyk: { low: 'low', medium: 'medium', high: 'high', critical: 'critical' },
};

const cheminNormalise = (p) => String(p).replace(/\\/g, '/').replace(/^\.\//, '');
const cweNormalise = (v) => (String(v ?? '').match(/CWE-\d+/) ?? ['CWE-0'])[0];

const lire = (nom) => {
  const f = path.join(dossier, nom);
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null;
};

/** Les constats bruts des trois outils, ramenés au même vocabulaire. */
function constatsBruts() {
  const out = [];

  const semgrep = lire('semgrep.json');
  for (const r of semgrep?.results ?? []) {
    out.push({
      outil: 'semgrep',
      severite: CORRESPONDANCES.semgrep[r.extra.severity] ?? 'low',
      cwe: cweNormalise(r.extra.metadata?.cwe?.[0]),
      fichier: cheminNormalise(r.path),
      ligne: r.start.line,
      titre: r.extra.message,
    });
  }

  const njsscan = lire('njsscan.json');
  for (const r of njsscan?.nodejs ?? []) {
    for (const f of r.files ?? []) {
      out.push({
        outil: 'njsscan',
        severite: CORRESPONDANCES.njsscan[r.severity] ?? 'low',
        cwe: cweNormalise(r.cwe),
        fichier: cheminNormalise(f.file_path),
        ligne: f.match_lines[0],
        titre: r.description,
      });
    }
  }

  const snyk = lire('snyk.json');
  for (const r of snyk?.runs?.[0]?.results ?? []) {
    const loc = r.locations[0].physicalLocation;
    out.push({
      outil: 'snyk',
      severite: CORRESPONDANCES.snyk[r.level] ?? 'low',
      cwe: cweNormalise(r.properties?.cwe?.[0]),
      fichier: cheminNormalise(loc.artifactLocation.uri),
      ligne: loc.region.startLine,
      titre: r.message.text,
    });
  }

  return out;
}

// La clé : ce qui identifie le défaut, pas ce qui identifie l'outil. Deux
// rapports qui désignent le même endroit et la même classe sont le même travail.
const cleDe = (c) => crypto.createHash('sha256').update(`${c.cwe}|${c.fichier}|${c.ligne}`).digest('hex');

const groupes = new Map();
for (const c of constatsBruts()) {
  const cle = cleDe(c);
  if (!groupes.has(cle)) groupes.set(cle, []);
  groupes.get(cle).push(c);
}

const constats = [...groupes]
  .map(([cle, bruts]) => {
    const outils = [...new Set(bruts.map((b) => b.outil))].sort();
    const premier = bruts.find((b) => b.outil === outils[0]);
    const severite = [...bruts].sort((a, b) => ECHELLE.indexOf(b.severite) - ECHELLE.indexOf(a.severite))[0].severite;
    return {
      cle,
      severite,
      cwe: bruts[0].cwe,
      fichier: bruts[0].fichier,
      ligne: bruts[0].ligne,
      outils,
      titre: premier.titre,
      occurrences: bruts.length,
    };
  })
  .sort((a, b) => a.cle.localeCompare(b.cle));

process.stdout.write(JSON.stringify({ constats }, null, 2));

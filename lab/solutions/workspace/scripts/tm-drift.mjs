#!/usr/bin/env node
// Détecteur de dérive du modèle de menaces — livrable de référence.
//
//   node tm-drift.mjs <dossier-server> <modele.json>
//
// Sortie 0  : toute route montée sous <dossier-server> figure dans le modèle.
// Sortie 1  : au moins une route n'y figure pas — la PR doit être bloquée, et
//             le script nomme ce qui manque.
//
// C'est ce qui transforme le threat modeling d'un atelier annuel en une porte
// de CI : on ne demande pas au développeur d'avoir raison, on lui demande de
// dire à quoi correspond la route qu'il vient d'ajouter.

import fs from 'node:fs';
import path from 'node:path';

const [dir, modelFile] = process.argv.slice(2);
if (!dir || !modelFile) {
  console.error('usage : tm-drift.mjs <dossier-server> <modele.json>');
  process.exit(2);
}

/** Le code sans ses commentaires — sinon un exemple commenté compte comme une route. */
function stripComments(raw) {
  let out = '';
  let i = 0;
  while (i < raw.length) {
    const c = raw[i];
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1;
      while (j < raw.length) {
        if (raw[j] === '\\') { j += 2; continue; }
        if (raw[j] === c) { j++; break; }
        j++;
      }
      out += raw.slice(i, j);
      i = j;
      continue;
    }
    if (c === '/' && raw[i + 1] === '/') { while (i < raw.length && raw[i] !== '\n') i++; continue; }
    if (c === '/' && raw[i + 1] === '*') {
      const end = raw.indexOf('*/', i + 2);
      i = end < 0 ? raw.length : end + 2;
      out += ' ';
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

const METHODS = 'get|post|put|patch|delete';

const indexPath = path.join(dir, 'index.ts');
if (!fs.existsSync(indexPath)) {
  console.error(`aucun index.ts sous ${dir}`);
  process.exit(2);
}
const index = stripComments(fs.readFileSync(indexPath, 'utf8'));

// Quel routeur vient de quel fichier ?
const files = new Map();
for (const m of index.matchAll(/import\s*\{([^}]+)\}\s*from\s*'\.\/(routes\/[\w-]+)\.ts'/g)) {
  for (const name of m[1].split(',').map((s) => s.trim()).filter(Boolean)) {
    files.set(name, path.join(dir, `${m[2]}.ts`));
  }
}

const found = new Set();

// Les routes déclarées directement sur l'application.
for (const m of index.matchAll(new RegExp(`app\\.(${METHODS})\\(\\s*'([^']+)'`, 'g'))) {
  found.add(`${m[1].toUpperCase()} ${m[2]}`);
}

// Puis, pour chaque montage, les routes du routeur monté.
for (const mount of index.matchAll(/app\.use\(\s*'([^']+)'\s*,\s*(\w+)\s*\)/g)) {
  const [, prefix, router] = mount;
  const file = files.get(router);
  if (!file || !fs.existsSync(file)) continue;
  const code = stripComments(fs.readFileSync(file, 'utf8'));
  const rx = new RegExp(`${router}\\.(${METHODS})\\(\\s*'([^']*)'`, 'g');
  for (const m of code.matchAll(rx)) {
    const sub = m[2];
    const full = sub === '' || sub === '/' ? prefix : `${prefix}${sub.startsWith('/') ? '' : '/'}${sub}`;
    found.add(`${m[1].toUpperCase()} ${full}`);
  }
}

let model;
try {
  model = JSON.parse(fs.readFileSync(modelFile, 'utf8'));
} catch (err) {
  console.error(`modèle illisible : ${err.message}`);
  process.exit(2);
}
const modelled = new Set(Array.isArray(model.routes) ? model.routes : []);

const drift = [...found].filter((r) => !modelled.has(r)).sort();
// L'inverse compte aussi : une route modélisée qui n'existe plus est un modèle
// qui parle d'un code disparu.
const stale = [...modelled].filter((r) => !found.has(r)).sort();

if (drift.length === 0 && stale.length === 0) {
  console.log(`modèle à jour : ${found.size} routes, toutes modélisées`);
  process.exit(0);
}
for (const r of drift) console.error(`route non modélisée : ${r}`);
for (const r of stale) console.error(`route modélisée mais absente du code : ${r}`);
console.error(`\n${drift.length + stale.length} écart(s) entre le code et le modèle de menaces.`);
process.exit(1);

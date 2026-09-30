// Exécute une règle de lint sur les jeux valides/invalides du harnais.
//
//   node lint-runner.mjs <fichier-de-regle> <cas.json>
//
// Sortie : une ligne JSON sur stdout.
//   { "ok": true, "resultats": [ { "id": "i01", "signalements": 1 } ] }
//   { "ok": false, "erreur": "…" }
//
// Pourquoi un exécuteur maison plutôt que `RuleTester` : ESLint n'est pas
// installé dans ce lab (voir le rapport d'implémentation). Le contrat respecté
// est celui d'ESLint — un module qui exporte `{ meta, create(context) }`, où
// `create` renvoie un objet dont les clés sont des types de nœuds ESTree — et
// l'arbre passé aux visiteurs est normalisé vers les noms ESTree. Une règle
// écrite ici se recopie telle quelle dans une configuration ESLint.
//
// Ce qui n'est PAS fourni : l'analyse de portée (`context.sourceCode.getScope`),
// les sélecteurs CSS d'ESLint, les suggestions et les correctifs. Une règle
// purement syntaxique n'en a pas besoin.

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const fail = (message) => {
  process.stdout.write(JSON.stringify({ ok: false, erreur: message }));
  process.exit(0);
};

const [, , ruleArg, casesArg] = process.argv;
if (!ruleArg || !casesArg) fail('usage : lint-runner.mjs <regle> <cas.json>');

let parse;
try {
  ({ parse } = await import('@babel/parser'));
} catch {
  fail('l’analyseur syntaxique @babel/parser est introuvable dans node_modules');
}

// ── Normalisation Babel → ESTree ────────────────────────────────────────────
//
// Babel et ESTree divergent sur une poignée de noms. Les convertir permet
// d'écrire la règle exactement comme pour ESLint.
const RENAME = {
  ObjectProperty: 'Property',
  ObjectMethod: 'Property',
  ClassMethod: 'MethodDefinition',
  StringLiteral: 'Literal',
  NumericLiteral: 'Literal',
  BooleanLiteral: 'Literal',
  NullLiteral: 'Literal',
  RegExpLiteral: 'Literal',
  BigIntLiteral: 'Literal',
};

function normalise(node, parent = null) {
  if (Array.isArray(node)) return node.forEach((n) => normalise(n, parent));
  if (!node || typeof node !== 'object' || typeof node.type !== 'string') return;
  if (node.type === 'NullLiteral') node.value = null;
  if (node.type === 'RegExpLiteral') node.value = null;
  const renamed = RENAME[node.type];
  if (renamed) {
    if (node.type === 'ObjectMethod') node.method = true;
    node.type = renamed;
  }
  Object.defineProperty(node, 'parent', { value: parent, enumerable: false, writable: true, configurable: true });
  for (const [key, value] of Object.entries(node)) {
    if (key === 'parent' || key === 'loc' || key === 'leadingComments' || key === 'trailingComments') continue;
    if (value && typeof value === 'object') normalise(value, node);
  }
}

function walk(node, visitors) {
  if (Array.isArray(node)) return node.forEach((n) => walk(n, visitors));
  if (!node || typeof node !== 'object' || typeof node.type !== 'string') return;
  const fn = visitors[node.type];
  if (typeof fn === 'function') fn(node);
  for (const [key, value] of Object.entries(node)) {
    if (key === 'parent' || key === 'loc') continue;
    if (value && typeof value === 'object') walk(value, visitors);
  }
  const exit = visitors[`${node.type}:exit`];
  if (typeof exit === 'function') exit(node);
}

// ── Chargement de la règle ──────────────────────────────────────────────────
const ruleFile = path.resolve(ruleArg);
if (!fs.existsSync(ruleFile)) fail(`le fichier de règle ${ruleArg} n’existe pas`);

let rule;
try {
  const mod = await import(pathToFileURL(ruleFile).href);
  rule = mod.default ?? mod.rule ?? mod;
  if (rule && typeof rule === 'object' && typeof rule.create !== 'function' && typeof rule.default === 'object') {
    rule = rule.default;
  }
} catch (err) {
  fail(`la règle n’a pas pu être chargée : ${String(err.message ?? err).split('\n')[0]}`);
}
if (!rule || typeof rule.create !== 'function') {
  fail('la règle doit exporter un objet { meta, create(context) } — `create` manque ou n’est pas une fonction');
}

const cases = JSON.parse(fs.readFileSync(path.resolve(casesArg), 'utf8'));
const tous = [
  ...cases.invalides.map((c) => ({ ...c, attendu: 'signale' })),
  ...cases.valides.map((c) => ({ ...c, attendu: 'silence' })),
];

const resultats = [];
for (const cas of tous) {
  let ast;
  try {
    ast = parse(cas.code, { sourceType: 'module', errorRecovery: false, plugins: ['typescript'] });
  } catch (err) {
    fail(`cas ${cas.id} illisible par l’analyseur : ${String(err.message ?? err)}`);
  }
  normalise(ast.program, null);

  const signalements = [];
  const sourceCode = {
    ast: ast.program,
    text: cas.code,
    getText: (node) => (node && typeof node.start === 'number' ? cas.code.slice(node.start, node.end) : cas.code),
    getAllComments: () => [],
    getSourceCode() { return this; },
  };
  const context = {
    id: rule?.meta?.docs?.url ?? 'regle',
    options: [],
    settings: {},
    parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    filename: `${cas.id}.js`,
    getFilename: () => `${cas.id}.js`,
    physicalFilename: `${cas.id}.js`,
    cwd: process.cwd(),
    getCwd: () => process.cwd(),
    sourceCode,
    getSourceCode: () => sourceCode,
    report(descriptor) {
      const node = descriptor?.node ?? null;
      signalements.push({
        debut: node && typeof node.start === 'number' ? node.start : null,
        message: descriptor?.message ?? descriptor?.messageId ?? '',
      });
    },
  };

  let visitors;
  try {
    visitors = rule.create(context) ?? {};
  } catch (err) {
    fail(`cas ${cas.id} : create(context) a levé « ${String(err.message ?? err).split('\n')[0]} »`);
  }
  try {
    walk(ast.program, visitors);
  } catch (err) {
    fail(`cas ${cas.id} : la règle a levé « ${String(err.message ?? err).split('\n')[0]} »`);
  }
  resultats.push({ id: cas.id, attendu: cas.attendu, signalements: signalements.length });
}

process.stdout.write(JSON.stringify({ ok: true, resultats }));

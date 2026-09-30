// Accès en lecture au dépôt fixture `novafact/`.
//
// Les challenges « fix » portent sur des fichiers, pas sur des requêtes : ce
// module donne aux vérifications une vue stable du dépôt, relue à chaque audit
// pour que l'apprenant voie l'effet de sa correction sans redémarrer le lab.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// js-yaml est publié en CommonJS : l'export nommé traverse l'interop, pas le défaut.
import { load as loadYaml, loadAll as loadAllYaml } from 'js-yaml';

const here = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(here, '../../novafact');

export interface Step {
  name?: string;
  uses?: string;
  run?: string;
  with?: Record<string, unknown>;
  env?: Record<string, unknown>;
  if?: string;
}

export interface Job {
  'runs-on'?: string | string[];
  steps?: Step[];
  permissions?: unknown;
  uses?: string;
  secrets?: unknown;
  if?: string;
  environment?: unknown;
}

export interface Workflow {
  /** Nom de fichier, p. ex. « ci.yml ». */
  file: string;
  text: string;
  name?: string;
  /** Les déclencheurs, normalisés en liste de noms. */
  triggers: string[];
  permissions?: unknown;
  jobs: Record<string, Job>;
}

const read = (rel: string): string | null => {
  const full = path.resolve(REPO_ROOT, rel);
  // Garde-fou : une vérification ne doit jamais sortir de la fixture.
  if (!full.startsWith(REPO_ROOT + path.sep)) return null;
  return fs.existsSync(full) && fs.statSync(full).isFile() ? fs.readFileSync(full, 'utf8') : null;
};

export const text = read;
export const exists = (rel: string) => read(rel) !== null;

export function json<T = unknown>(rel: string): T | null {
  const raw = read(rel);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Les documents YAML d'un fichier de la fixture — Kubernetes en met plusieurs
 * par fichier, séparés par `---`.
 *
 * Renvoie `null` si le fichier est absent ou illisible. Une vérification ne
 * doit jamais conclure « rien à redire » sur un document qu'elle n'a pas pu
 * lire : c'est à elle de distinguer les deux cas avec `text()`.
 */
export function yamlDocs(rel: string): unknown[] | null {
  const raw = read(rel);
  if (raw === null) return null;
  try {
    const docs = loadAllYaml(raw) as unknown[];
    // Un document vide (fichier terminé par `---`) n'est pas une erreur.
    return docs.filter((d) => d !== null && d !== undefined);
  } catch {
    return null;
  }
}

/** Les fichiers d'un dossier de la fixture, triés. Vide si le dossier n'existe pas. */
export function listDir(rel: string): string[] {
  const full = path.resolve(REPO_ROOT, rel);
  if (!full.startsWith(REPO_ROOT + path.sep)) return [];
  if (!fs.existsSync(full) || !fs.statSync(full).isDirectory()) return [];
  return fs
    .readdirSync(full)
    .filter((f) => fs.statSync(path.join(full, f)).isFile())
    .sort();
}

/**
 * js-yaml 4 suit le schéma YAML 1.2, où la clé `on` reste une chaîne — ce qui
 * n'était pas le cas en 1.1, où elle devenait le booléen `true`. On accepte les
 * deux formes par prudence : une fixture peut être relue par un autre outil.
 */
function triggersOf(doc: Record<string, unknown>): string[] {
  const on = doc.on ?? (doc as Record<string, unknown>).true;
  if (typeof on === 'string') return [on];
  if (Array.isArray(on)) return on.map(String);
  if (on && typeof on === 'object') return Object.keys(on);
  return [];
}

export function workflows(): Workflow[] {
  const dir = path.join(REPO_ROOT, '.github/workflows');
  if (!fs.existsSync(dir)) return [];
  const out: Workflow[] = [];
  for (const file of fs.readdirSync(dir).filter((f) => /\.ya?ml$/.test(f)).sort()) {
    const raw = fs.readFileSync(path.join(dir, file), 'utf8');
    let doc: Record<string, unknown>;
    try {
      doc = (loadYaml(raw) ?? {}) as Record<string, unknown>;
    } catch {
      continue; // un YAML cassé est signalé par la vérification de syntaxe
    }
    out.push({
      file,
      text: raw,
      name: typeof doc.name === 'string' ? doc.name : undefined,
      triggers: triggersOf(doc),
      permissions: doc.permissions,
      jobs: (doc.jobs ?? {}) as Record<string, Job>,
    });
  }
  return out;
}

/** Tous les couples (job, étape) d'un workflow, à plat. */
export function steps(wf: Workflow): { jobId: string; job: Job; step: Step }[] {
  return Object.entries(wf.jobs).flatMap(([jobId, job]) =>
    (job.steps ?? []).map((step) => ({ jobId, job, step })),
  );
}

// ── Infrastructure as Code ──────────────────────────────────────────────────
//
// Il n'y a ni parseur HCL ni binaire `terraform` dans le lab : les
// vérifications de M16 travaillent sur le **texte**. C'est ce que font
// beaucoup de linters — mais ça oblige à retirer les commentaires avant
// d'analyser, sans quoi un commentaire qui décrit le correctif suffirait à
// faire passer la vérification.

/** Fin d'une chaîne entre guillemets doubles, échappements compris. */
function endOfQuoted(s: string, i: number): number {
  let j = i + 1;
  while (j < s.length) {
    if (s[j] === '\\') { j += 2; continue; }
    if (s[j] === '"') return j + 1;
    j++;
  }
  return j;
}

/**
 * Le HCL sans ses commentaires (`#`, `//`, `/* … *\/`), chaînes préservées.
 * Les heredocs sont recopiés tels quels : leur contenu n'est pas du code.
 */
export function hclCode(raw: string): string {
  let out = '';
  let i = 0;
  while (i < raw.length) {
    const c = raw[i];
    if (c === '"') { const j = endOfQuoted(raw, i); out += raw.slice(i, j); i = j; continue; }
    if (c === '#' || (c === '/' && raw[i + 1] === '/')) {
      while (i < raw.length && raw[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && raw[i + 1] === '*') {
      const end = raw.indexOf('*/', i + 2);
      out += ' ';
      i = end < 0 ? raw.length : end + 2;
      continue;
    }
    if (c === '<' && raw[i + 1] === '<') {
      const m = /^<<[-~]?([A-Za-z_][A-Za-z0-9_]*)/.exec(raw.slice(i));
      if (m) {
        const stop = new RegExp(`\\n[ \\t]*${m[1]}[ \\t]*(?:\\n|$)`).exec(raw.slice(i));
        const end = stop ? i + stop.index + stop[0].length : raw.length;
        out += raw.slice(i, end);
        i = end;
        continue;
      }
    }
    out += c;
    i++;
  }
  return out;
}

/** Le JavaScript/TypeScript sans ses commentaires, chaînes et gabarits préservés. */
export function jsCode(raw: string): string {
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
      out += ' ';
      i = end < 0 ? raw.length : end + 2;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

/** Le YAML sans ses commentaires, ligne à ligne, chaînes préservées. */
export function yamlCode(raw: string): string {
  return raw
    .split('\n')
    .map((line) => {
      let out = '';
      let quote: string | null = null;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (quote) {
          out += c;
          if (c === quote) quote = null;
          continue;
        }
        if (c === '"' || c === "'") { quote = c; out += c; continue; }
        if (c === '#' && (i === 0 || /\s/.test(line[i - 1]))) break;
        out += c;
      }
      return out;
    })
    .join('\n');
}

/** Les fichiers d'une arborescence de la fixture, récursivement et triés. */
export function listFilesDeep(rel: string, match: RegExp): string[] {
  const root = path.resolve(REPO_ROOT, rel);
  if (!root.startsWith(REPO_ROOT + path.sep) && root !== REPO_ROOT) return [];
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) return [];
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (match.test(entry.name)) out.push(path.relative(REPO_ROOT, full).split(path.sep).join('/'));
    }
  };
  walk(root);
  return out;
}

/** Un fichier d'infrastructure : son texte brut et son texte sans commentaires. */
export interface CodeFile {
  /** Chemin relatif à la fixture, p. ex. « infra/terraform/storage.tf ». */
  file: string;
  raw: string;
  code: string;
}

export const tfFiles = (): CodeFile[] =>
  listFilesDeep('infra/terraform', /\.tf$/).map((file) => {
    const raw = read(file) ?? '';
    return { file, raw, code: hclCode(raw) };
  });

export const tfvarsFiles = (): CodeFile[] =>
  listFilesDeep('infra/terraform', /\.tfvars$/).map((file) => {
    const raw = read(file) ?? '';
    return { file, raw, code: hclCode(raw) };
  });

/** Un bloc HCL : `resource "aws_s3_bucket" "attachments" { … }`. */
export interface HclBlock {
  /** `resource`, `module`, `terraform`, `variable`, `ingress`… */
  type: string;
  /** Les étiquettes du bloc, sans guillemets. */
  labels: string[];
  /** Le contenu entre accolades, commentaires déjà retirés. */
  body: string;
  file: string;
}

/** Index de l'accolade fermante correspondant à celle ouverte en `open`. */
function closingBrace(code: string, open: number): number {
  let depth = 1;
  let i = open + 1;
  while (i < code.length) {
    const c = code[i];
    if (c === '"') { i = endOfQuoted(code, i); continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return i; }
    i++;
  }
  return -1;
}

/**
 * Les blocs de premier niveau d'un texte HCL. Les blocs imbriqués s'obtiennent
 * en rappelant la fonction sur le `body` d'un bloc.
 *
 * `tags = { … }` n'est pas un bloc : l'en-tête exige l'étiquette puis
 * l'accolade, sans signe égal entre les deux.
 */
export function hclBlocks(code: string, file = ''): HclBlock[] {
  const out: HclBlock[] = [];
  const header = /(?:^|\n)[ \t]*([A-Za-z_][A-Za-z0-9_-]*)((?:[ \t]+(?:"(?:[^"\\]|\\.)*"|[A-Za-z_][A-Za-z0-9_-]*))*)[ \t]*\{/g;
  let m: RegExpExecArray | null;
  while ((m = header.exec(code)) !== null) {
    const open = m.index + m[0].length - 1;
    const close = closingBrace(code, open);
    if (close < 0) break;
    out.push({
      type: m[1],
      labels: (m[2].match(/"(?:[^"\\]|\\.)*"|[A-Za-z_][A-Za-z0-9_-]*/g) ?? []).map((s) =>
        s.startsWith('"') ? s.slice(1, -1) : s,
      ),
      body: code.slice(open + 1, close),
      file,
    });
    header.lastIndex = close + 1;
  }
  return out;
}

/**
 * Les attributs dont la valeur est un objet — `aws = { source = … }` dans un
 * bloc `required_providers`. `type` porte le nom de l'attribut.
 */
export function hclObjectAttrs(body: string, file = ''): HclBlock[] {
  const out: HclBlock[] = [];
  const rx = /(?:^|\n)[ \t]*([A-Za-z_][A-Za-z0-9_.-]*)[ \t]*=[ \t]*\{/g;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(body)) !== null) {
    const open = m.index + m[0].length - 1;
    const close = closingBrace(body, open);
    if (close < 0) break;
    out.push({ type: m[1], labels: [], body: body.slice(open + 1, close), file });
    rx.lastIndex = close + 1;
  }
  return out;
}

/** Fin de la valeur d'un attribut : la parenthèse/accolade/crochet de trop, ou la fin de ligne. */
function endOfValue(s: string, start: number): number {
  let depth = 0;
  let i = start;
  while (i < s.length) {
    const c = s[i];
    if (c === '"') { i = endOfQuoted(s, i); continue; }
    if (c === '{' || c === '[' || c === '(') { depth++; i++; continue; }
    if (c === '}' || c === ']' || c === ')') {
      if (depth === 0) return i;
      depth--;
      i++;
      continue;
    }
    if (c === '\n' && depth === 0) return i;
    i++;
  }
  return i;
}

/** Toutes les valeurs d'un attribut, au premier niveau du corps donné. */
export function hclAttrAll(body: string, name: string): string[] {
  const out: string[] = [];
  const rx = new RegExp(`^${name}[ \\t]*=[ \\t]*`);
  let depth = 0;
  let i = 0;
  let lineStart = true;
  while (i < body.length) {
    const c = body[i];
    if (c === '"') { i = endOfQuoted(body, i); lineStart = false; continue; }
    if (c === '\n') { lineStart = true; i++; continue; }
    if (lineStart && (c === ' ' || c === '\t')) { i++; continue; }
    if (c === '{' || c === '[' || c === '(') { depth++; i++; lineStart = false; continue; }
    if (c === '}' || c === ']' || c === ')') { depth--; i++; lineStart = false; continue; }
    if (lineStart && depth === 0 && c === name[0]) {
      const m = rx.exec(body.slice(i));
      if (m) {
        const start = i + m[0].length;
        const end = endOfValue(body, start);
        out.push(body.slice(start, end).trim());
        i = end;
        lineStart = false;
        continue;
      }
    }
    lineStart = false;
    i++;
  }
  return out;
}

/** La première valeur d'un attribut, au premier niveau du corps donné. */
export const hclAttr = (body: string, name: string): string | null => hclAttrAll(body, name)[0] ?? null;

/** Toutes les valeurs d'un attribut, à n'importe quelle profondeur. */
export function hclAttrDeep(body: string, name: string): string[] {
  const out = hclAttrAll(body, name);
  for (const block of hclBlocks(body)) out.push(...hclAttrDeep(block.body, name));
  return out;
}

/** Les éléments d'une liste HCL. Une valeur qui n'est pas une liste en fait une de un. */
export function hclList(value: string | null): string[] {
  if (value === null) return [];
  const v = value.trim();
  if (!v.startsWith('[')) return v === '' ? [] : [v];
  const inner = v.slice(1, v.lastIndexOf(']'));
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  let i = 0;
  while (i < inner.length) {
    const c = inner[i];
    if (c === '"') { i = endOfQuoted(inner, i); continue; }
    if (c === '[' || c === '{' || c === '(') { depth++; i++; continue; }
    if (c === ']' || c === '}' || c === ')') { depth--; i++; continue; }
    if (c === ',' && depth === 0) { out.push(inner.slice(start, i)); start = i + 1; }
    i++;
  }
  out.push(inner.slice(start));
  return out.map((s) => s.trim()).filter((s) => s !== '');
}

/** La valeur d'une chaîne HCL, guillemets retirés. */
export const hclString = (value: string | null): string | null => {
  if (value === null) return null;
  const v = value.trim();
  return /^".*"$/s.test(v) ? v.slice(1, -1) : v;
};

/** `true` / `false` / `null` quand la valeur n'est pas un booléen littéral. */
export const hclBool = (value: string | null): boolean | null => {
  if (value === null) return null;
  const v = value.trim();
  return v === 'true' ? true : v === 'false' ? false : null;
};

/** Le nombre porté par une valeur HCL, ou `null`. */
export const hclNumber = (value: string | null): number | null => {
  if (value === null) return null;
  const v = value.trim();
  return /^-?\d+(?:\.\d+)?$/.test(v) ? Number(v) : null;
};

/** Le YAML mal formé se signale avant toute autre vérification. */
export function yamlErrors(): string[] {
  const dir = path.join(REPO_ROOT, '.github/workflows');
  if (!fs.existsSync(dir)) return [];
  const errors: string[] = [];
  for (const file of fs.readdirSync(dir).filter((f) => /\.ya?ml$/.test(f))) {
    try {
      loadYaml(fs.readFileSync(path.join(dir, file), 'utf8'));
    } catch (err) {
      errors.push(`${file} : ${(err as Error).message.split('\n')[0]}`);
    }
  }
  return errors;
}

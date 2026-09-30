// Vérifications des challenges M12 · Revue de code sécurité.
//
// Challenges « artifact » : l'apprenant produit un fichier dans `workspace/`.
//
// Ce qui est mesuré :
//   · deux erreurs, pas une — ce qui a été **manqué** et ce qui a été
//     **inventé**. Un seuil est imposé sur les deux, sans quoi « tout marquer »
//     serait une stratégie gagnante ;
//   · l'emplacement exact d'un sink, recalculé dans le code à chaque audit ;
//   · un verdict **par ligne** sur une PR fabriquée pour ça : le harnais sait
//     quelles lignes portent un défaut bloquant et lesquelles sont des leurres.
//     Un bloquant manqué échoue, un leurre marqué bloquant échoue aussi.
//
// Ce qui ne l'est pas, et que les énoncés disent : la qualité d'un commentaire
// de revue, et la stratégie d'un audit limité dans le temps. On note son
// résultat, jamais la manière d'y arriver.
//
// Une remarque valable pour tous : le corrigé vit dans le harnais, comme pour
// n'importe quel challenge du lab. L'intérêt est de rendre son verdict avant
// d'aller le lire.

import fs from 'node:fs';
import path from 'node:path';
import { exercises } from '../../shared/exercises.ts';
import { LAB_ROOT, run } from './workspace.ts';
import {
  appRoutes, arr, few, fixture, labText, sinks, str, strs, stripComments, uniq, ws,
  type Check,
} from './m11.ts';

// ── Lecture d'un diff unifié ────────────────────────────────────────────────

interface AddedLine { file: string; line: number; text: string }

/** Les lignes ajoutées par un diff, avec leur numéro dans le fichier d'arrivée. */
function addedLines(diff: string): AddedLine[] {
  const out: AddedLine[] = [];
  let file = '';
  let line = 0;
  for (const raw of diff.split('\n')) {
    const head = raw.match(/^\+\+\+ b\/(.+)$/);
    if (head) { file = head[1].trim(); continue; }
    const hunk = raw.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunk) { line = Number(hunk[1]); continue; }
    if (!file || raw.startsWith('+++') || raw.startsWith('---')) continue;
    if (raw.startsWith('+')) { out.push({ file, line, text: raw.slice(1) }); line++; continue; }
    if (raw.startsWith('-')) continue;
    if (raw.startsWith(' ')) { line++; continue; }
  }
  return out;
}

const fixtureText = (rel: string) => labText(`fixtures/${rel}`);

// ═══ M12-1 · La carte des sources et des sinks ══════════════════════════════

const SURFACE = 'review/attack-surface.yaml';
const CVE_SINK = 'review/cve-sink.yaml';
const PR42 = 'review/pr-42.yaml';
const AI_PR = 'review/ai-pr.yaml';
const AUDIT = 'review/audit-report.yaml';

/** Les seuils, annoncés dans l'énoncé : un audit n'est pas une liste exhaustive. */
const ROUTE_RECALL = 0.9;
const SINK_RECALL = 0.8;
const MAX_INVENTED = 1;

// ═══ M12-2 · Le sink d'une vraie CVE ════════════════════════════════════════

/**
 * Les classes que ce lab enseigne, avec le motif qui repère leur sink.
 *
 * Aucune réponse n'est stockée : l'emplacement est recalculé dans les sources
 * du paquet à chaque audit. Déplacer une ligne déplace la bonne réponse.
 */
const VULN_CLASSES: { id: string; rx: RegExp }[] = [
  { id: 'prototype-pollution', rx: /\w+\[\w+\]\s*=\s*\w+\s*;/ },
  { id: 'path-traversal', rx: /path\.join\s*\(/ },
  { id: 'command-injection', rx: /\b(?:exec|execSync|spawn)\s*\(/ },
  { id: 'code-injection', rx: /\b(?:eval|new Function)\s*\(/ },
  { id: 'redos', rx: /\/\^?[^/\n]*\([^()\n]*[+*][^()\n]*\)[*+]/ },
];

interface PkgSink { pkg: string; file: string; line: number; column: number; cls: string }

/** Le sink d'un paquet embarqué : une classe, un emplacement, recalculés. */
function packageSink(pkg: string): PkgSink | string {
  const dir = path.join(LAB_ROOT, 'fixtures/m12/packages', pkg, 'lib');
  if (!fs.existsSync(dir)) return `le paquet ${pkg} est absent des fixtures`;
  const hits: PkgSink[] = [];
  for (const name of fs.readdirSync(dir).filter((f) => f.endsWith('.js')).sort()) {
    const raw = fs.readFileSync(path.join(dir, name), 'utf8');
    stripComments(raw).split('\n').forEach((text, i) => {
      for (const c of VULN_CLASSES) {
        const m = c.rx.exec(text);
        if (m) hits.push({ pkg, file: `lib/${name}`, line: i + 1, column: (m.index ?? 0) + 1, cls: c.id });
      }
    });
  }
  if (hits.length !== 1) return `le sink de ${pkg} n’est pas identifiable (${hits.length} candidats) : vérification impossible`;
  return hits[0];
}

// ═══ M12-3 · La revue de PR notée sur ses verdicts ══════════════════════════

const VERDICTS = new Set(['bloquant', 'a-corriger', 'suggestion', 'acceptable']);

/**
 * Ce que porte la PR 42, fabriquée pour cet exercice.
 *
 * `lines` donne les positions acceptables d'un même constat — un défaut tient
 * parfois sur deux lignes, et on ne piège pas sur un décalage d'une ligne.
 */
const PR42_BLOCKERS: { lines: number[]; cwe: string; what: string }[] = [
  { lines: [20], cwe: 'CWE-347', what: 'les revendications du jeton sont lues sans que la signature soit vérifiée' },
  { lines: [28], cwe: 'CWE-639', what: 'le tenant ciblé est pris dans la query string, donc choisi par l’appelant' },
  { lines: [31, 32], cwe: 'CWE-863', what: 'le contrôle de rôle journalise puis laisse passer' },
];

/** Les leurres : plausibles en revue, pas bloquants ici. Les marquer échoue. */
const PR42_DECOYS: { line: number; why: string }[] = [
  { line: 35, why: 'une trace applicative qui ne contient rien de secret' },
  { line: 38, why: 'un générateur non cryptographique dans un identifiant d’affichage' },
  { line: 44, why: 'un commentaire de suivi' },
  { line: 45, why: 'une comparaison lâche entre deux chaînes' },
];

// ═══ Les vérifications ══════════════════════════════════════════════════════

export const m12Checks: Record<string, Check> = {
  'attack-surface-map': () => {
    const r = ws(SURFACE);
    if ('err' in r) return r.err;

    const routes = appRoutes();
    const groundSinks = sinks();
    if (!routes.length || !groundSinks.length) return 'le code de Novafact n’a pas pu être relu : vérification impossible';

    // ── Points d'entrée ──
    const entries = arr(r.doc.entrypoints);
    if (!entries.length) return `\`${SURFACE}\` ne contient aucun point d’entrée sous la clé « entrypoints »`;
    const known = new Map(routes.map((x) => [x.key, x]));
    const seen = new Set<string>();
    const invented: string[] = [];
    const wrongAuth: string[] = [];
    for (const e of entries) {
      const key = str(e.route);
      const real = known.get(key);
      if (!real) { invented.push(key || '(vide)'); continue; }
      if (seen.has(key)) return `la route ${key} est listée deux fois`;
      seen.add(key);
      const expected = real.admin ? 'admin' : real.auth ? 'required' : 'none';
      if (str(e.auth) !== expected) wrongAuth.push(`${key} (annoncé « ${str(e.auth) || 'rien' } », en réalité « ${expected} »)`);
    }
    if (invented.length > MAX_INVENTED) return `${invented.length} points d’entrée n’existent pas dans le code : ${few(invented)}`;
    if (wrongAuth.length) return `l’authentification annoncée ne correspond pas au code pour : ${few(wrongAuth)}`;
    const recall = seen.size / routes.length;
    if (recall < ROUTE_RECALL) {
      const missed = routes.filter((x) => !seen.has(x.key)).map((x) => x.key);
      return `${seen.size} routes sur ${routes.length} sont cartographiées (${Math.round(recall * 100)} %, seuil ${ROUTE_RECALL * 100} %) — manquent notamment : ${few(missed)}`;
    }

    // ── Sinks ──
    const given = arr(r.doc.sinks);
    if (!given.length) return `\`${SURFACE}\` ne contient aucun sink sous la clé « sinks »`;
    const groundKey = (s: { file: string; line: number }) => `${s.file}:${s.line}`;
    const ground = new Map(groundSinks.map((s) => [groundKey(s), s]));
    const foundSinks = new Set<string>();
    const badSinks: string[] = [];
    const wrongKind: string[] = [];
    for (const s of given) {
      const file = str(s.file);
      const line = Number(s.line);
      const key = `${file}:${line}`;
      const real = ground.get(key);
      if (!real) { badSinks.push(key); continue; }
      foundSinks.add(key);
      if (str(s.kind) !== real.kind) wrongKind.push(`${key} (annoncé « ${str(s.kind) || 'rien'} », en réalité « ${real.kind} »)`);
    }
    if (badSinks.length > MAX_INVENTED) return `${badSinks.length} emplacements ne portent aucun sink : ${few(badSinks)}`;
    if (wrongKind.length) return `la famille annoncée ne correspond pas au code pour : ${few(wrongKind)}`;
    const sinkRecall = foundSinks.size / groundSinks.length;
    if (sinkRecall < SINK_RECALL) {
      const missed = groundSinks.filter((s) => !foundSinks.has(groundKey(s))).map((s) => `${groundKey(s)} (${s.kind})`);
      return `${foundSinks.size} sinks sur ${groundSinks.length} sont localisés (${Math.round(sinkRecall * 100)} %, seuil ${SINK_RECALL * 100} %) — manquent notamment : ${few(missed)}`;
    }
    return null;
  },

  'secbench-sink': () => {
    const data = fixture<{ advisories: { id: string; package: string }[] }>('m12/advisories.json');
    if (!data?.advisories?.length) return 'la fixture fixtures/m12/advisories.json est absente : vérification impossible';

    const r = ws(CVE_SINK);
    if ('err' in r) return r.err;
    const given = arr(r.doc.findings);
    if (!given.length) return `\`${CVE_SINK}\` ne contient aucun constat sous la clé « findings »`;

    for (const adv of data.advisories) {
      const truth = packageSink(adv.package);
      if (typeof truth === 'string') return truth;

      // L'exploit embarqué sert d'oracle : si la vulnérabilité ne se reproduit
      // plus, ce n'est pas la réponse de l'apprenant qui est en cause.
      const dir = path.join(LAB_ROOT, 'fixtures/m12/packages', adv.package);
      if (fs.existsSync(path.join(dir, 'exploit.mjs'))) {
        const proof = run(process.execPath, ['exploit.mjs'], { cwd: dir, timeoutMs: 20_000 });
        if (!proof.ok) return `l’exploit de ${adv.package} ne se reproduit plus : la fixture est cassée, pas ta réponse`;
      }

      const found = given.find((f) => str(f.advisory) === adv.id);
      if (!found) return `l’avis ${adv.id} (${adv.package}) n’a pas de constat`;
      if (str(found.file) !== truth.file) {
        return `${adv.id} : le sink est annoncé dans « ${str(found.file) || '(vide)'} », ce n’est pas le bon fichier`;
      }
      if (Number(found.line) !== truth.line) {
        return `${adv.id} : ligne ${String(found.line ?? '(vide)')} annoncée, ce n’est pas la ligne du sink`;
      }
      const col = Number(found.column);
      if (!Number.isFinite(col) || Math.abs(col - truth.column) > 4) {
        return `${adv.id} : colonne ${String(found.column ?? '(vide)')} annoncée, le sink commence ailleurs sur la ligne`;
      }
      const cls = str(found.class);
      if (!VULN_CLASSES.some((c) => c.id === cls)) {
        return `${adv.id} : « ${cls || '(vide)'} » n’est pas une des classes attendues (${VULN_CLASSES.map((c) => c.id).join(', ')})`;
      }
      if (cls !== truth.cls) return `${adv.id} : la classe annoncée n’est pas celle du défaut`;
    }
    return null;
  },

  'review-pr-verdicts': () => {
    const diff = fixtureText('m12/pr-42.diff');
    if (diff === null) return 'la fixture fixtures/m12/pr-42.diff est absente : vérification impossible';
    const added = addedLines(diff);
    const byLine = new Map(added.map((a) => [a.line, a]));

    const r = ws(PR42);
    if ('err' in r) return r.err;
    const findings = arr(r.doc.findings);
    if (!findings.length) return `\`${PR42}\` ne contient aucun constat sous la clé « findings »`;

    const verdicts = new Map<number, { verdict: string; cwe: string; raison: string }>();
    for (const f of findings) {
      const line = Number(f.line);
      if (!byLine.has(line)) return `la ligne ${String(f.line ?? '(vide)')} n’est pas une ligne ajoutée par la PR`;
      const verdict = str(f.verdict);
      if (!VERDICTS.has(verdict)) {
        return `« ${verdict || '(vide)'} » n’est pas un verdict (bloquant, a-corriger, suggestion, acceptable)`;
      }
      if (verdicts.has(line)) return `la ligne ${line} porte deux verdicts`;
      verdicts.set(line, { verdict, cwe: str(f.cwe).toUpperCase(), raison: str(f.raison) });
    }

    // Un bloquant manqué échoue.
    for (const b of PR42_BLOCKERS) {
      const hit = b.lines.map((l) => verdicts.get(l)).find((v) => v?.verdict === 'bloquant');
      if (!hit) return `un défaut bloquant n’a pas été vu, ligne ${b.lines.join(' ou ')} : ${b.what}`;
      if (hit.cwe !== b.cwe) return `ligne ${b.lines[0]} : le constat est bon, mais ${hit.cwe || '(aucun CWE)'} n’est pas la classe de ce défaut`;
      if (hit.raison.length < 20) return `ligne ${b.lines[0]} : un bloquant sans motif écrit ne sera pas corrigé`;
    }

    // Un leurre marqué bloquant échoue aussi.
    for (const d of PR42_DECOYS) {
      if (verdicts.get(d.line)?.verdict === 'bloquant') {
        return `ligne ${d.line} marquée bloquante alors que c’est ${d.why} : bloquer là-dessus coûte la confiance de l’équipe`;
      }
    }
    return null;
  },

  'review-ai-pr': () => {
    const diff = fixtureText('m12/ai-pr.diff');
    const snapshot = fixture<{ packages: string[] }>('m12/npm-snapshot.json');
    if (diff === null || !snapshot?.packages) return 'les fixtures de la PR générée sont absentes : vérification impossible';
    const added = addedLines(diff);

    // Vérité terrain nº 1 : les dépendances ajoutées qui n'existent pas.
    const registry = new Set(snapshot.packages);
    const addedDeps = added
      .filter((a) => a.file.endsWith('package.json'))
      .map((a) => a.text.match(/"((?:@[\w.-]+\/)?[\w.-]+)"\s*:\s*"[^"]+"/)?.[1])
      .filter((x): x is string => Boolean(x));
    const ghosts = addedDeps.filter((d) => !registry.has(d));
    const real = addedDeps.filter((d) => registry.has(d));
    if (!ghosts.length) return 'la fixture ne contient plus de dépendance inventée : vérification impossible';

    // Vérité terrain nº 2 : le secret en dur, repéré par motif dans le diff.
    const secretRx = /(?:sk_(?:live|test)_[A-Za-z0-9]{16,}|AKIA[0-9A-Z]{16}|['"][A-Za-z0-9_-]{32,}['"])/;
    const secretLines = added.filter((a) => !a.file.endsWith('package.json') && secretRx.test(a.text));
    if (secretLines.length !== 1) return 'le secret en dur n’est plus identifiable dans la fixture : vérification impossible';
    const secret = secretLines[0];

    const r = ws(AI_PR);
    if ('err' in r) return r.err;
    if (str(r.doc.verdict) !== 'rejetee') {
      return `le verdict global doit être « rejetee » : cette PR ne peut pas être fusionnée en l’état`;
    }
    const findings = arr(r.doc.findings);
    if (!findings.length) return `\`${AI_PR}\` ne contient aucun constat sous la clé « findings »`;

    const deps = findings.filter((f) => str(f.type) === 'dependance-inexistante').map((f) => str(f.package));
    const missed = ghosts.filter((g) => !deps.includes(g));
    if (missed.length) return `la PR ajoute une dépendance qui n’existe dans aucun registre et elle n’est pas signalée : ${few(missed)}`;
    const wrongly = deps.filter((d) => real.includes(d));
    if (wrongly.length) return `${few(wrongly)} existe bien dans l’instantané du registre : le signaler comme inventé est un faux positif`;
    const unknown = deps.filter((d) => !addedDeps.includes(d));
    if (unknown.length) return `${few(unknown)} n’est pas une dépendance ajoutée par cette PR`;

    const secretFindings = findings.filter((f) => str(f.type) === 'secret-en-dur');
    if (!secretFindings.length) return 'le secret en dur ajouté par la PR n’est pas signalé';
    if (!secretFindings.some((f) => str(f.file) === secret.file && Number(f.line) === secret.line)) {
      return `le secret est signalé au mauvais endroit : il est ajouté par ${secret.file}, ligne ${secret.line}`;
    }
    return null;
  },

  'timeboxed-audit': () => {
    const ref = fixture<{ top: string[]; direct_loss: string[] }>('m12/impact.json');
    if (!ref?.top?.length) return 'la fixture fixtures/m12/impact.json est absente : vérification impossible';

    const r = ws(AUDIT);
    if ('err' in r) return r.err;
    const findings = arr(r.doc.findings);
    if (findings.length !== 3) {
      return `le rapport contient ${findings.length} constats au lieu des 3 demandés : un audit limité dans le temps rend ce qui compte, pas tout`;
    }

    const routes = appRoutes();
    const live = new Map(exercises.map((e) => [e.id, e]));
    const picked: string[] = [];
    const impacts: string[] = [];

    for (const f of findings) {
      const id = str(f.challenge);
      const ex = live.get(id);
      if (!ex) return `« ${id || '(vide)'} » ne désigne pas un challenge jouable du lab`;
      if (picked.includes(id)) return `le constat ${id} est rendu deux fois`;
      picked.push(id);
      if (str(f.file) !== ex.file) return `le constat ${id} désigne ${str(f.file) || '(aucun fichier)'} alors que le défaut est dans ${ex.file}`;

      const impact = str(f.impact);
      if (impact.length < 30) return `le constat ${id} ne dit pas ce qu’il fait perdre au client`;
      impacts.push(impact.toLowerCase());

      const chain = strs(f.chain);
      if (chain.length < 2) return `le constat ${id} n’a pas de chemin d’exploitation (au moins deux étapes)`;
      const bogus = chain.filter((k) => !routes.some((x) => x.key === k));
      if (bogus.length) return `le chemin de ${id} passe par ${few(bogus)}, qui n’existe pas`;
      // La dernière étape doit être la route où l'invariant se rompt vraiment —
      // celle dont le code constate la résolution du challenge.
      let breaking = routes.filter((x) => x.body.includes(`solve('${id}')`)).map((x) => x.key);
      // Repli si le constat n'est plus localisé par un `solve()` dans une
      // route : toute route servie par le fichier du défaut fait l'affaire.
      if (!breaking.length) breaking = routes.filter((x) => x.file === ex.file).map((x) => x.key);
      if (!breaking.length) return `le fichier de ${id} ne sert aucune route : vérification impossible`;
      if (!breaking.includes(chain[chain.length - 1])) {
        return `le chemin de ${id} se termine sur ${chain[chain.length - 1]}, alors que l’invariant se rompt ailleurs`;
      }
    }

    if (uniq(impacts).length < 3) return 'deux constats partagent le même impact : le classement n’est pas argumenté';
    const outside = picked.filter((id) => !ref.top.includes(id));
    if (outside.length) {
      return `${few(outside)} n’est pas dans les constats de plus fort impact de ce dépôt : il en existe de plus coûteux`;
    }
    const money = picked.filter((id) => ref.direct_loss.includes(id));
    if (money.length < 2) {
      return `${money.length} constat sur 3 fait perdre de l’argent directement : la question posée était « qu’est-ce qui peut faire perdre de l’argent à ce client »`;
    }
    return null;
  },
};

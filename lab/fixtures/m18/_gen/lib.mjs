// Outils communs aux générateurs de corpus de M18.
//
// Les corpus sont **générés**, pas écrits à la main : c'est la seule façon
// d'avoir à la fois du volume, du réalisme et une vérité terrain exacte. Le
// tirage est déterministe (graine fixe) — relancer le générateur reproduit
// l'octet près, sinon les corrigés de référence cesseraient de passer.
//
//   node fixtures/m18/_gen/generate.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** PRNG déterministe (mulberry32). */
export function rng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    pick: (xs) => xs[Math.floor(next() * xs.length)],
    shuffle: (xs) => {
      const out = [...xs];
      for (let i = out.length - 1; i > 0; i -= 1) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
  };
}

export const BASE = Date.parse('2026-03-04T08:00:00.000Z');
export const iso = (ms) => new Date(Math.round(ms)).toISOString();

export const UA_BROWSER = [
  'Mozilla/5.0 (Windows NT 10.0; Win64) Chrome/133.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Version/18.3 Safari/605.1',
  'Mozilla/5.0 (X11; Linux x86_64) Firefox/135.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64) Firefox/135.0',
];

const FIRST = ['marie', 'lucas', 'camille', 'yanis', 'sofia', 'hugo', 'lea', 'nathan', 'ines', 'thomas',
  'julie', 'karim', 'elsa', 'antoine', 'nadia', 'paul', 'chloe', 'mehdi', 'clara', 'victor'];
const LAST = ['dupont', 'martin', 'bernard', 'petit', 'durand', 'leroy', 'moreau', 'simon', 'laurent',
  'lefevre', 'roux', 'fournier', 'girard', 'bonnet', 'dupuis', 'lambert', 'fontaine', 'rousseau'];
const DOMAINS = ['acme.example', 'globex.example', 'initech.example', 'novafact.example'];

/** Un vivier d'adresses e-mail stable pour un corpus donné. */
export function accountPool(r, n) {
  const seen = new Set();
  const out = [];
  while (out.length < n) {
    const mail = `${r.pick(FIRST)}.${r.pick(LAST)}${seen.size > 250 ? out.length : ''}@${r.pick(DOMAINS)}`;
    if (seen.has(mail)) continue;
    seen.add(mail);
    out.push(mail);
  }
  return out;
}

/** Une adresse publique tirée dans les plages de documentation (RFC 5737). */
export function publicIp(r) {
  const block = r.pick(['203.0.113', '198.51.100', '192.0.2']);
  return `${block}.${r.int(2, 250)}`;
}

export const privateIp = (r) => `10.${r.int(0, 40)}.${r.int(0, 255)}.${r.int(2, 250)}`;

/**
 * Distributeur d'adresses sans collision.
 *
 * Deux cas qui partageraient une adresse partageraient un groupe : l'alerte
 * toucherait les deux, et la vérité terrain deviendrait fausse. Dans un corpus
 * de quarante acteurs tirés dans quelques centaines d'adresses, la collision
 * n'est pas une hypothèse d'école — elle arrive.
 */
export function ipFactory(r) {
  const used = new Set();
  return (priv = false) => {
    let v;
    do { v = priv ? privateIp(r) : publicIp(r); } while (used.has(v));
    used.add(v);
    return v;
  };
}

// ── Construction d'événements ───────────────────────────────────────────────

let counter = 0;
let prefix = 'e';
/** Les identifiants sont préfixés par corpus : deux corpus ne se recouvrent jamais. */
export const resetIds = (p = 'e') => { counter = 0; prefix = p; };
export const nextId = () => `${prefix}${String((counter += 1)).padStart(5, '0')}`;

/** Un événement d'authentification au format ECS. */
export function authEvent({ ts, action, outcome, user, ip, ua, status, caseId, extra = {} }) {
  return {
    '@timestamp': iso(ts),
    event: {
      id: nextId(),
      kind: 'event',
      category: ['authentication'],
      type: [outcome === 'success' ? 'start' : 'info'],
      action,
      outcome,
      dataset: 'novafact.auth',
    },
    user: { name: user },
    source: { ip },
    http: { request: { method: 'POST' }, response: { status_code: status } },
    url: { path: '/api/auth/login' },
    user_agent: { original: ua },
    ...extra,
    _case: caseId,
  };
}

/** Un événement web générique. */
export function webEvent({ ts, action, outcome, user, ip, ua, method, path: p, status, caseId, extra = {} }) {
  return {
    '@timestamp': iso(ts),
    event: {
      id: nextId(),
      kind: 'event',
      category: ['web'],
      type: [outcome === 'success' ? 'access' : 'denied'],
      action,
      outcome,
      dataset: 'novafact.http',
    },
    user: { name: user },
    source: { ip },
    http: { request: { method }, response: { status_code: status } },
    url: { path: p },
    user_agent: { original: ua },
    ...extra,
    _case: caseId,
  };
}

// ── Écriture ────────────────────────────────────────────────────────────────

const ensure = (dir) => fs.mkdirSync(dir, { recursive: true });

/** Trie par horodatage et écrit le corpus et sa vérité terrain. */
export function writeCorpus(dir, events, cases) {
  const full = path.join(OUT, dir);
  ensure(full);
  const sorted = [...events].sort((a, b) =>
    a['@timestamp'] < b['@timestamp'] ? -1 : a['@timestamp'] > b['@timestamp'] ? 1 : 0,
  );
  fs.writeFileSync(path.join(full, 'events.ndjson'), `${sorted.map((e) => JSON.stringify(e)).join('\n')}\n`);
  fs.writeFileSync(path.join(full, 'cases.json'), `${JSON.stringify(cases, null, 2)}\n`);
  const bad = cases.filter((c) => c.malicious).length;
  console.log(`  ${dir.padEnd(22)} ${String(sorted.length).padStart(5)} événements · ${bad} cas malveillants / ${cases.length}`);
}

export function writeFile(rel, content) {
  const full = path.join(OUT, rel);
  ensure(path.dirname(full));
  fs.writeFileSync(full, content.endsWith('\n') ? content : `${content}\n`);
  console.log(`  ${rel}`);
}

export const writeJson = (rel, value) => writeFile(rel, JSON.stringify(value, null, 2));
export const writeNdjson = (rel, rows) => writeFile(rel, rows.map((r) => JSON.stringify(r)).join('\n'));

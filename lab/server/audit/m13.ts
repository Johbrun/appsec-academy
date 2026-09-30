// Vérifications des challenges M13 · Tests & analyse de code.
//
// Même contrat qu'ailleurs : `null` quand c'est bon, sinon une phrase qui nomme
// ce qui manque. Tous les challenges implémentés ici sont de type « artifact »
// sauf indication contraire : l'apprenant produit un fichier dans `workspace/`.
//
// Le motif dominant du module est le **différentiel valide/invalide** : la
// règle de lint est exécutée contre douze cas à signaler et quatorze cas très
// proches à laisser passer ; le détecteur de données réelles contre dix
// enregistrements extraits d'une vraie base et vingt enregistrements
// synthétiques. Une règle trop large échoue sur les seconds, trop étroite sur
// les premiers — et le résultat ne peut pas se coder en dur.
//
// Le garde-fou de `malicious-postinstall` est vérifié par **effet observable** :
// le harnais installe un paquet dont le script de post-installation écrit un
// marqueur, une fois sans la configuration proposée (contrôle négatif : le
// marqueur DOIT apparaître, sinon le harnais ne prouve rien), une fois avec.
//
// Restent `planned`, et c'est délibéré :
//   · `regression-pair`, `property-test`, `fuzz-target` — ils exigent le double
//     passage (échouer contre le code livré, passer contre le corrigé), que
//     `workspace.ts` explique ne pas être outillé ;
//   · `semgrep-taint` — Semgrep n'est pas sur npm, et un challenge qui se
//     saute toujours n'est pas un challenge ;
//   · `dast-in-ci` — aucun scanner dynamique n'est installé ;
//   · `secrets-scan` — c'est un challenge « fix » : son défaut doit vivre dans
//     le dépôt fixture `novafact/` et son corrigé dans `solutions/novafact/`,
//     hors du périmètre de ce lot.

import fs from 'node:fs';
import path from 'node:path';
import {
  FIXTURES,
  analyseServeur,
  captureJson,
  dansUnDossierTemporaire,
  fixJson,
  lisCsv,
  livrable,
  memeValeur,
  valideSchema,
} from './m05.ts';
import { run, wsJson, wsPath, wsYaml } from './workspace.ts';
import { workflows } from './repo.ts';
import type { Check } from './m14.ts';

const premiereLigne = (s: string) => (s.split('\n').find((l) => l.trim() !== '') ?? '').trim().slice(0, 200);

// ════════════════════════════════════════════════════════════════════════════
//  Stratégie de test
// ════════════════════════════════════════════════════════════════════════════

const ETAPES = ['pre-commit', 'pull-request', 'main-merge', 'nightly', 'release', 'production'] as const;
const DECLENCHEURS = ['local', 'pull_request', 'push', 'schedule', 'workflow_dispatch'] as const;
const TECHNIQUES = ['sast', 'sca', 'secrets', 'dast', 'fuzzing', 'regression'] as const;

/** Ce qu'une étape peut réellement déclencher, côté forge. */
const DECLENCHEURS_PAR_ETAPE: Record<string, readonly string[]> = {
  'pre-commit': ['local'],
  'pull-request': ['pull_request'],
  'main-merge': ['push'],
  nightly: ['schedule'],
  release: ['push', 'workflow_dispatch'],
  production: ['workflow_dispatch', 'schedule'],
};

interface Placement {
  technique: string;
  etape: string;
  bloquant: boolean;
  budget_minutes: number;
  declencheur: string;
  workflow_existe: boolean;
}

/** Les déclencheurs réellement présents dans le dépôt fixture. */
function declencheursDuDepot(): Set<string> {
  const out = new Set<string>();
  for (const w of workflows()) for (const t of w.triggers) out.add(t);
  return out;
}

// ════════════════════════════════════════════════════════════════════════════
//  SBOM
// ════════════════════════════════════════════════════════════════════════════

interface Lock {
  packages: Record<string, { version?: string; dev?: boolean; resolved?: string }>;
}

/** Les purl attendus, recalculés depuis le lockfile de l'application. */
function purlsAttendus(): string[] {
  const lock = fixJson<Lock>('m13/app/package-lock.json');
  const out: string[] = [];
  for (const [chemin, entree] of Object.entries(lock.packages)) {
    if (chemin === '' || entree.dev) continue;
    const nom = chemin.split('node_modules/').pop()!;
    out.push(`pkg:npm/${nom.startsWith('@') ? nom.replace('@', '%40') : nom}@${entree.version}`);
  }
  return out.sort();
}

const normalisePurl = (p: string) => p.replace(/%40/g, '@').split('?')[0].split('#')[0];

// ════════════════════════════════════════════════════════════════════════════
//  Données de test : ce qui prouve qu'une valeur ne peut pas être réelle
// ════════════════════════════════════════════════════════════════════════════

const mod97 = (iban: string): number => {
  const s = String(iban).replace(/\s+/g, '').toUpperCase();
  if (!/^[A-Z]{2}[0-9A-Z]{6,32}$/.test(s)) return -1;
  const r = (s.slice(4) + s.slice(0, 4)).replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  let reste = 0;
  for (const ch of r) reste = (reste * 10 + Number(ch)) % 97;
  return reste;
};

const luhn = (valeur: string): boolean => {
  const d = String(valeur).replace(/\D/g, '');
  if (d.length < 8) return false;
  let somme = 0;
  for (let i = 0; i < d.length; i++) {
    let x = Number(d[d.length - 1 - i]);
    if (i % 2 === 1) { x *= 2; if (x > 9) x -= 9; }
    somme += x;
  }
  return somme % 10 === 0;
};

const DOMAINES_RESERVES = /@(example\.(com|org|net)|[^@]*\.(test|invalid|localhost))$/i;
const TELEPHONE_FICTION = /^\+33\s?6\s?39\s?98(\s?\d{2}){2}$/;

interface Enregistrement { id?: string; nom?: string; email?: string; telephone?: string; iban?: string; carte?: string; siret?: string }

/** Pourquoi cet enregistrement ne peut PAS venir de la production. */
function ecartsDeFormat(r: Enregistrement): string[] {
  const out: string[] = [];
  if (typeof r.email !== 'string' || !DOMAINES_RESERVES.test(r.email)) out.push(`email « ${r.email} » hors des domaines réservés aux tests`);
  if (typeof r.telephone !== 'string' || !TELEPHONE_FICTION.test(r.telephone.trim())) out.push(`téléphone « ${r.telephone} » hors de la plage de fiction +33 6 39 98 XX XX`);
  if (typeof r.iban !== 'string' || mod97(r.iban) === 1) out.push(`IBAN « ${r.iban} » passe la clé ISO 7064 : ce pourrait être celui de quelqu’un`);
  if (typeof r.carte !== 'string' || luhn(r.carte)) out.push(`carte « ${r.carte} » passe la clé de Luhn`);
  if (typeof r.siret !== 'string' || luhn(r.siret)) out.push(`SIRET « ${r.siret} » passe la clé de Luhn`);
  return out;
}

// ════════════════════════════════════════════════════════════════════════════
//  Script d'installation malveillant
// ════════════════════════════════════════════════════════════════════════════

const COMPORTEMENTS = [
  'lecture_variables_environnement',
  'lecture_fichiers_identifiants',
  'exfiltration_http',
  'execution_commande_systeme',
  'persistance_tache_planifiee',
  'modification_fichier_source',
  'minage_cryptomonnaie',
  'desactivation_journalisation',
  'chiffrement_donnees',
] as const;

const COMPORTEMENTS_REELS = [
  'execution_commande_systeme',
  'exfiltration_http',
  'lecture_fichiers_identifiants',
  'lecture_variables_environnement',
];

const MARQUEUR = 'LE-SCRIPT-A-TOURNE';

/**
 * Le garde-fou, jugé sur un effet observable et non sur une déclaration.
 *
 * Trois exécutions dans un dossier jetable, avec un paquet dont la
 * post-installation écrit un marqueur :
 *   1. sans la configuration proposée — le marqueur DOIT apparaître, sinon le
 *      harnais ne mesure rien et il vaut mieux le dire ;
 *   2. avec elle — le marqueur ne doit pas apparaître ;
 *   3. avec elle, mais `--ignore-scripts=false` en ligne de commande, qui
 *      l'emporte sur la configuration — le marqueur doit revenir. Sans ce
 *      troisième essai, une configuration qui casse npm tout court passerait
 *      pour un garde-fou.
 */
function eprouveGardeFou(npmrc: string): string | null {
  return dansUnDossierTemporaire('postinstall', (dir) => {
    const pkg = {
      name: 'essai-garde-fou',
      version: '1.0.0',
      private: true,
      scripts: { postinstall: `node -e "require('fs').writeFileSync('${MARQUEUR}','1')"` },
    };
    const marqueur = path.join(dir, MARQUEUR);
    const installe = (avecNpmrc: boolean, args: string[] = []) => {
      fs.rmSync(marqueur, { force: true });
      fs.rmSync(path.join(dir, 'node_modules'), { recursive: true, force: true });
      fs.rmSync(path.join(dir, 'package-lock.json'), { force: true });
      fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(pkg, null, 2));
      if (avecNpmrc) fs.writeFileSync(path.join(dir, '.npmrc'), npmrc);
      else fs.rmSync(path.join(dir, '.npmrc'), { force: true });
      const r = run('npm', ['install', '--no-audit', '--no-fund', '--offline', ...args], { cwd: dir, timeoutMs: 60_000 });
      return { ok: r.ok, sortie: r.output, marque: fs.existsSync(marqueur) };
    };

    const controle = installe(false);
    if (!controle.marque) {
      return 'le harnais n’arrive pas à faire tourner le script de post-installation sans garde-fou : il ne peut rien conclure (npm indisponible ?)';
    }
    const garde = installe(true);
    if (!garde.ok) {
      return `avec ta configuration, l’installation échoue : ${premiereLigne(garde.sortie)} — un garde-fou qui casse l’installation n’en est pas un`;
    }
    if (garde.marque) {
      return 'avec ta configuration, le script de post-installation s’exécute quand même : le marqueur a été écrit';
    }
    const force = installe(true, ['--ignore-scripts=false']);
    if (!force.marque) {
      return 'ta configuration empêche le script de tourner même quand la ligne de commande réautorise explicitement les scripts : elle bloque l’installation plutôt que les scripts';
    }
    return null;
  });
}

// ════════════════════════════════════════════════════════════════════════════
//  Revue IA : la vérité terrain, recalculée contre le code
// ════════════════════════════════════════════════════════════════════════════

interface ConstatIa { id: string; fichier: string; symbole: string; cwe: string; constat: string }
interface DefautConnu { id: string; fichier: string; symbole: string; cwe: string }

type Verdict = 'vrai_positif' | 'faux_positif' | 'hallucination';

function verdictsDeReference(): { verdicts: Map<string, Verdict>; couverts: Map<string, string[]>; defauts: DefautConnu[] } {
  const analyse = analyseServeur();
  const constats = fixJson<{ constats: ConstatIa[] }>('m13/ai-review.json').constats;
  const defauts = fixJson<{ defauts: DefautConnu[] }>('m13/known-defects.json').defauts;

  const verdicts = new Map<string, Verdict>();
  const couverts = new Map<string, string[]>();
  for (const c of constats) {
    if (!analyse.fichiers.has(c.fichier) || !analyse.cite(c.fichier, c.symbole)) {
      verdicts.set(c.id, 'hallucination');
      continue;
    }
    const d = defauts.find((x) => x.fichier === c.fichier && x.symbole === c.symbole && x.cwe === c.cwe);
    if (d) {
      verdicts.set(c.id, 'vrai_positif');
      couverts.set(d.id, [...(couverts.get(d.id) ?? []), c.id]);
    } else {
      verdicts.set(c.id, 'faux_positif');
    }
  }
  return { verdicts, couverts, defauts };
}

// ════════════════════════════════════════════════════════════════════════════
//  Les vérifications
// ════════════════════════════════════════════════════════════════════════════

export const m13Checks: Record<string, Check> = {
  // ── Où placer chaque technique ────────────────────────────────────────────

  'test-strategy': () => {
    const rel = 'program/test-strategy.yaml';
    const l = livrable(rel);
    if ('raison' in l) return l.raison;
    const doc = wsYaml<{ techniques: Placement[] }>(rel);
    if (doc === null || 'error' in doc) return `le livrable \`workspace/${rel}\` ${doc ? doc.error : 'est illisible'}`;

    const schema = {
      type: 'object',
      additionalProperties: false,
      required: ['version', 'techniques'],
      properties: {
        version: { type: 'integer', minimum: 1 },
        note: { type: 'string' },
        techniques: {
          type: 'array',
          minItems: TECHNIQUES.length,
          maxItems: TECHNIQUES.length,
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['technique', 'etape', 'bloquant', 'budget_minutes', 'declencheur', 'workflow_existe'],
            properties: {
              technique: { enum: [...TECHNIQUES] },
              etape: { enum: [...ETAPES] },
              bloquant: { type: 'boolean' },
              budget_minutes: { type: 'number', minimum: 0, maximum: 600 },
              declencheur: { enum: [...DECLENCHEURS] },
              workflow_existe: { type: 'boolean' },
              pourquoi: { type: 'string' },
            },
          },
        },
      },
    };
    const erreur = valideSchema(schema, doc.value, `le livrable \`workspace/${rel}\``);
    if (erreur) return erreur;

    const par = new Map(doc.value.techniques.map((t) => [t.technique, t]));
    if (par.size !== TECHNIQUES.length) return 'une technique est placée deux fois : une place, une seule, par technique';

    const presents = declencheursDuDepot();
    for (const t of doc.value.techniques) {
      const permis = DECLENCHEURS_PAR_ETAPE[t.etape];
      if (!permis.includes(t.declencheur)) {
        return `${t.technique} : l’étape « ${t.etape} » se déclenche par ${permis.join(' ou ')}, pas par « ${t.declencheur} »`;
      }
      const existe = t.declencheur === 'local' ? false : presents.has(t.declencheur);
      if (t.workflow_existe !== existe) {
        return existe
          ? `${t.technique} : le dépôt a déjà un workflow déclenché par « ${t.declencheur} » — « workflow_existe » doit valoir true`
          : `${t.technique} : aucun workflow du dépôt n’est déclenché par « ${t.declencheur} » — « workflow_existe » doit valoir false (il reste à créer)`;
      }
    }

    const dast = par.get('dast')!;
    if (dast.etape === 'pre-commit' || dast.etape === 'pull-request') {
      return `le DAST est placé à « ${dast.etape} » : à ce moment-là aucun environnement n’est déployé, il n’y a rien à scanner`;
    }
    const fuzzing = par.get('fuzzing')!;
    if (fuzzing.bloquant) return 'le fuzzing est déclaré bloquant : une recherche dont on ne connaît pas la durée ne barre pas la route à une livraison';
    if (['pre-commit', 'pull-request', 'main-merge'].includes(fuzzing.etape)) {
      return `le fuzzing est placé à « ${fuzzing.etape} » : son budget de temps n’a pas sa place sur le chemin critique`;
    }
    const regression = par.get('regression')!;
    if (regression.etape !== 'pull-request' || !regression.bloquant) {
      return 'les tests de régression de sécurité se jouent sur la pull request, et ils bloquent : c’est le seul filet qui empêche un défaut corrigé de revenir';
    }
    const secrets = par.get('secrets')!;
    if (!secrets.bloquant) return 'la détection de secrets n’est pas bloquante : un secret poussé est un secret à révoquer, pas à commenter';
    if (!['pre-commit', 'pull-request'].includes(secrets.etape)) {
      return `la détection de secrets est placée à « ${secrets.etape} » : trop tard, le secret est déjà dans l’historique`;
    }
    const sast = par.get('sast')!;
    if (!['pre-commit', 'pull-request', 'main-merge'].includes(sast.etape)) {
      return `l’analyse statique est placée à « ${sast.etape} » : elle ne demande ni build ni environnement, elle doit arriver plus tôt`;
    }
    const sca = par.get('sca')!;
    if (!sca.bloquant || !['pull-request', 'main-merge'].includes(sca.etape)) {
      return 'l’analyse de composition se joue sur la pull request ou à la fusion, et elle bloque : c’est le lockfile qui change qui déclenche la question';
    }

    const budget = (etape: string, seulementBloquants: boolean) =>
      doc.value.techniques
        .filter((t) => t.etape === etape && (!seulementBloquants || t.bloquant))
        .reduce((n, t) => n + t.budget_minutes, 0);

    if (budget('pre-commit', false) > 2) {
      return `le pré-commit totalise ${budget('pre-commit', false)} minutes : au-delà de deux, il se contourne (git commit --no-verify)`;
    }
    if (budget('pull-request', true) > 10) {
      return `les étapes bloquantes de la pull request totalisent ${budget('pull-request', true)} minutes : c’est exactement la CI de dix-huit minutes qu’on contourne`;
    }
    return null;
  },

  // ── La règle qui attrape la classe ────────────────────────────────────────

  'eslint-rule': () => {
    const rel = 'rules/no-body-spread.js';
    const l = livrable(rel);
    if ('raison' in l) return l.raison;

    const runner = path.join(FIXTURES, 'm13/runners/lint-runner.mjs');
    const cas = path.join(FIXTURES, 'm13/eslint-cases.json');
    const r = captureJson(runner, [wsPath(rel)!, cas], 'l’exécuteur de règles', 30_000);
    if (r.erreur) return r.erreur;

    const sortie = r.valeur as { ok: boolean; erreur?: string; resultats?: { id: string; attendu: string; signalements: number }[] };
    if (!sortie?.ok) return sortie?.erreur ?? 'la règle n’a pas pu être exécutée';

    const rates = (sortie.resultats ?? []).filter((x) =>
      x.attendu === 'signale' ? x.signalements === 0 : x.signalements > 0,
    );
    if (!rates.length) return null;

    const muets = rates.filter((x) => x.attendu === 'signale').map((x) => x.id);
    const bavards = rates.filter((x) => x.attendu === 'silence').map((x) => x.id);
    return [
      muets.length ? `la règle laisse passer ${muets.length} cas à signaler (${muets.join(', ')}) : elle est trop étroite` : '',
      bavards.length ? `la règle signale ${bavards.length} cas qui ne doivent rien produire (${bavards.join(', ')}) : elle est trop large` : '',
    ].filter(Boolean).join(' — ');
  },

  // ── SBOM ──────────────────────────────────────────────────────────────────

  'sbom-generate': () => {
    const rel = 'sbom.cdx.json';
    const l = livrable(rel);
    if ('raison' in l) return l.raison;
    const doc = wsJson<{ metadata: { component: { name: string; version: string; type: string } }; components: { purl: string }[] }>(rel);
    if (doc === null || 'error' in doc) return `le livrable \`workspace/${rel}\` ${doc ? doc.error : 'est illisible'}`;

    const erreur = valideSchema(fixJson<object>('m13/cyclonedx-sbom.schema.json'), doc.value, `le livrable \`workspace/${rel}\``);
    if (erreur) return erreur;

    const app = fixJson<{ name: string; version: string }>('m13/app/package.json');
    const c = doc.value.metadata.component;
    if (c.name !== app.name || c.version !== app.version) {
      return `le composant décrit est « ${c.name}@${c.version} » : ce n’est pas l’application (« ${app.name}@${app.version} »), c’est un exemple laissé par l’outil`;
    }
    if (c.type !== 'application') return `le composant racine est de type « ${c.type} » : le SBOM décrit une application`;

    const attendus = purlsAttendus().map(normalisePurl).sort();
    const rendus = [...new Set(doc.value.components.map((x) => normalisePurl(x.purl)))].sort();
    if (!memeValeur(rendus, attendus)) {
      const manquants = attendus.filter((p) => !rendus.includes(p));
      const enTrop = rendus.filter((p) => !attendus.includes(p));
      return [
        'le SBOM ne décrit plus l’arbre de dépendances de l’application',
        manquants.length ? `manquent : ${manquants.slice(0, 4).join(', ')}${manquants.length > 4 ? '…' : ''}` : '',
        enTrop.length ? `en trop : ${enTrop.slice(0, 4).join(', ')}${enTrop.length > 4 ? '…' : ''}` : '',
      ].filter(Boolean).join(' — ');
    }
    return null;
  },

  // ── Données de test ───────────────────────────────────────────────────────

  'test-data-generator': () => {
    const rel = 'scripts/seed.mjs';
    const l = livrable(rel);
    if ('raison' in l) return l.raison;

    const runner = path.join(FIXTURES, 'm13/runners/seed-runner.mjs');
    const suspects = path.join(FIXTURES, 'm13/seed-suspects.json');
    const r = captureJson(runner, [wsPath(rel)!, suspects], 'le générateur', 30_000);
    if (r.erreur) return r.erreur;

    const sortie = r.valeur as {
      ok: boolean; erreur?: string; nombre?: number;
      alpha1?: Enregistrement[]; alpha2?: Enregistrement[]; beta?: Enregistrement[];
      verdicts?: { reels: string[][]; synthetiques: string[][]; generes: string[][] };
    };
    if (!sortie?.ok) return sortie?.erreur ?? 'le module n’a pas pu être exécuté';

    const { alpha1 = [], alpha2 = [], beta = [], nombre = 0, verdicts } = sortie;
    if (!Array.isArray(alpha1) || alpha1.length !== nombre) {
      return `generate({ nombre: ${nombre} }) rend ${Array.isArray(alpha1) ? alpha1.length : 'autre chose qu’un tableau'} enregistrements`;
    }
    const ids = new Set(alpha1.map((x) => x.id));
    if (ids.size !== alpha1.length) return 'deux enregistrements produits portent le même identifiant';

    if (!memeValeur(alpha1, alpha2)) {
      return 'deux appels avec la même graine ne rendent pas les mêmes données : le générateur n’est pas déterministe, la régression ne sera pas reproductible';
    }
    const emailsA = new Set(alpha1.map((x) => x.email));
    const communs = beta.filter((x) => emailsA.has(x.email)).length;
    if (communs > beta.length * 0.2) {
      return `deux graines différentes produisent ${communs} enregistrements sur ${beta.length} en commun : la graine ne sert à rien`;
    }

    for (const enr of alpha1) {
      const ecarts = ecartsDeFormat(enr);
      if (ecarts.length) return `l’enregistrement ${enr.id ?? '?'} produit n’est pas dans les formats réservés aux tests — ${ecarts[0]}`;
    }

    if (!verdicts) return 'l’exécuteur n’a pas pu recueillir les verdicts de suspect()';
    const jeu = fixJson<{ reels: Enregistrement[]; synthetiques: Enregistrement[] }>('m13/seed-suspects.json');
    const muets = verdicts.reels.map((v, i) => (v.length ? null : jeu.reels[i].id)).filter(Boolean);
    if (muets.length) {
      return `suspect() ne signale pas ${muets.length} enregistrements pourtant extraits d’une vraie base (${muets.slice(0, 3).join(', ')}) : le détecteur est trop étroit`;
    }
    const bavardsSynthetiques = verdicts.synthetiques.map((v, i) => (v.length ? jeu.synthetiques[i].id : null)).filter(Boolean);
    if (bavardsSynthetiques.length) {
      return `suspect() signale ${bavardsSynthetiques.length} enregistrements synthétiques conformes (${bavardsSynthetiques.slice(0, 3).join(', ')}) : le détecteur est trop large`;
    }
    const bavardsGeneres = verdicts.generes.map((v, i) => (v.length ? alpha1[i]?.id ?? String(i) : null)).filter(Boolean);
    if (bavardsGeneres.length) {
      return `suspect() signale ${bavardsGeneres.length} enregistrements produits par ton propre générateur (${bavardsGeneres.slice(0, 3).join(', ')})`;
    }
    return null;
  },

  // ── Script d'installation malveillant ─────────────────────────────────────

  'malicious-postinstall': () => {
    const rel = 'review/postinstall.yaml';
    const l = livrable(rel);
    if ('raison' in l) return l.raison;
    const doc = wsYaml<{ paquet: string; version: string; script: string; fichier: string; comportements: string[]; garde_fou: { npmrc: string } }>(rel);
    if (doc === null || 'error' in doc) return `le livrable \`workspace/${rel}\` ${doc ? doc.error : 'est illisible'}`;

    const schema = {
      type: 'object',
      additionalProperties: false,
      required: ['paquet', 'version', 'script', 'fichier', 'comportements', 'garde_fou'],
      properties: {
        paquet: { type: 'string', minLength: 1 },
        version: { type: 'string', minLength: 1 },
        script: { enum: ['preinstall', 'install', 'postinstall', 'prepare', 'prepublish'] },
        fichier: { type: 'string', minLength: 1 },
        comportements: { type: 'array', minItems: 1, uniqueItems: true, items: { enum: [...COMPORTEMENTS] } },
        indices: { type: 'array', items: { type: 'string' } },
        garde_fou: {
          type: 'object',
          additionalProperties: false,
          required: ['npmrc'],
          properties: { npmrc: { type: 'string', minLength: 1, maxLength: 500 }, note: { type: 'string' } },
        },
      },
    };
    const erreur = valideSchema(schema, doc.value, `le livrable \`workspace/${rel}\``);
    if (erreur) return erreur;

    const paquet = fixJson<{ name: string; version: string; scripts: Record<string, string> }>('m13/suspect-package/package.json');
    if (doc.value.paquet !== paquet.name) return `le paquet en cause est « ${paquet.name} », pas « ${doc.value.paquet} »`;
    if (doc.value.version !== paquet.version) return `la version en cause est ${paquet.version}, pas ${doc.value.version}`;
    if (doc.value.script !== 'postinstall') return `c’est le script « postinstall » qui est déclaré dans le paquet, pas « ${doc.value.script} »`;
    if (!/scripts\/setup\.js$/.test(doc.value.fichier)) {
      return `le fichier exécuté est celui que « postinstall » appelle : ${paquet.scripts.postinstall}`;
    }

    const rendu = [...doc.value.comportements].sort();
    if (!memeValeur(rendu, COMPORTEMENTS_REELS)) {
      const manquants = COMPORTEMENTS_REELS.filter((c) => !rendu.includes(c));
      const enTrop = rendu.filter((c) => !COMPORTEMENTS_REELS.includes(c));
      return [
        'la liste des comportements ne correspond pas à ce que le script fait',
        manquants.length ? `il en fait ${manquants.length} que tu n’as pas relevés` : '',
        enTrop.length ? `tu en attribues ${enTrop.length} qu’il ne fait pas (${enTrop.join(', ')})` : '',
      ].filter(Boolean).join(' — ');
    }

    return eprouveGardeFou(doc.value.garde_fou.npmrc);
  },

  // ── Évaluer un relecteur IA ───────────────────────────────────────────────

  'ai-review-eval': () => {
    const relCsv = 'review/ai-eval.csv';
    const relMetriques = 'review/ai-eval-metrics.json';
    const lc = livrable(relCsv);
    if ('raison' in lc) return lc.raison;
    const lm = livrable(relMetriques);
    if ('raison' in lm) return lm.raison;

    const { verdicts, couverts, defauts } = verdictsDeReference();
    const constats = fixJson<{ constats: ConstatIa[] }>('m13/ai-review.json').constats;

    const lignes = lisCsv(lc.texte);
    const ENTETE = ['id', 'verdict', 'defaut', 'justification'];
    const entete = (lignes[0] ?? []).map((c) => c.trim().toLowerCase());
    if (!memeValeur(entete, ENTETE)) {
      return `l’en-tête attendu est « ${ENTETE.join(',')} », trouvé « ${entete.join(',')} »`;
    }
    const corps = lignes.slice(1);
    if (corps.length !== constats.length) return `${corps.length} lignes au lieu de ${constats.length} : chaque constat doit être tranché`;

    const vus = new Set<string>();
    const rendus = new Map<string, { verdict: string; defaut: string }>();
    for (let i = 0; i < corps.length; i++) {
      const [id, verdict, defaut, justification] = corps[i].map((c) => c.trim());
      if (!constats.some((c) => c.id === id)) return `ligne ${i + 2} : « ${id} » n’est pas un constat du rapport`;
      if (vus.has(id)) return `ligne ${i + 2} : ${id} apparaît deux fois`;
      vus.add(id);
      if (!['vrai_positif', 'faux_positif', 'hallucination'].includes(verdict)) {
        return `ligne ${i + 2} : verdict « ${verdict} » — attendu vrai_positif, faux_positif ou hallucination`;
      }
      if (verdict === 'vrai_positif') {
        if (!defauts.some((d) => d.id === defaut)) {
          return `ligne ${i + 2} : un vrai positif doit désigner le défaut connu qu’il couvre (colonne « defaut », par exemple ${defauts[0].id})`;
        }
      } else if (defaut !== '') {
        return `ligne ${i + 2} : la colonne « defaut » ne se remplit que pour un vrai positif`;
      }
      if (justification.length < 10) return `ligne ${i + 2} : la justification est vide ou trop courte (son contenu n’est pas noté, sa présence l’est)`;
      rendus.set(id, { verdict, defaut });
    }

    for (const c of constats) {
      const attendu = verdicts.get(c.id)!;
      const rendu = rendus.get(c.id)!;
      if (rendu.verdict !== attendu) {
        const pourquoi =
          attendu === 'hallucination'
            ? `${c.fichier} n’existe pas, ou ne contient nulle part le symbole « ${c.symbole} »`
            : attendu === 'vrai_positif'
              ? `${c.fichier}#${c.symbole} porte bien un défaut de classe ${c.cwe}`
              : `${c.fichier}#${c.symbole} existe, mais ce n’est pas un défaut connu de classe ${c.cwe}`;
        return `${c.id} : classé « ${rendu.verdict} » — ${pourquoi}, donc « ${attendu} »`;
      }
      if (attendu === 'vrai_positif') {
        const d = defauts.find((x) => x.fichier === c.fichier && x.symbole === c.symbole && x.cwe === c.cwe)!;
        if (rendu.defaut !== d.id) return `${c.id} : ce vrai positif couvre ${d.id}, pas ${rendu.defaut}`;
      }
    }

    const doc = wsJson<{ precision: number; rappel: number }>(relMetriques);
    if (doc === null || 'error' in doc) return `le livrable \`workspace/${relMetriques}\` ${doc ? doc.error : 'est illisible'}`;
    const schemaMetriques = {
      type: 'object',
      additionalProperties: false,
      required: ['precision', 'rappel'],
      properties: {
        precision: { type: 'number', minimum: 0, maximum: 1 },
        rappel: { type: 'number', minimum: 0, maximum: 1 },
        note: { type: 'string' },
      },
    };
    const erreurMetriques = valideSchema(schemaMetriques, doc.value, `le livrable \`workspace/${relMetriques}\``);
    if (erreurMetriques) return erreurMetriques;

    const vrais = [...verdicts.values()].filter((v) => v === 'vrai_positif').length;
    const precision = vrais / constats.length;
    const rappel = couverts.size / defauts.length;
    if (Math.abs(doc.value.precision - precision) > 0.0005) {
      return `précision ${doc.value.precision} : sur ${constats.length} constats rendus, ${vrais} tiennent devant le code — ${precision.toFixed(3)}`;
    }
    if (Math.abs(doc.value.rappel - rappel) > 0.0005) {
      return `rappel ${doc.value.rappel} : ${couverts.size} des ${defauts.length} défauts connus sont couverts par au moins un vrai positif — ${rappel.toFixed(3)}`;
    }
    return null;
  },
};

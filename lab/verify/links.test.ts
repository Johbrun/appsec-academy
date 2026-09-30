// Cohérence entre le lab et le site.
//
// `shared/exercises.ts` recopie les titres de leçons du site pour rester un
// paquet indépendant. Une copie non vérifiée diverge : ce test la vérifie.
//
// Contrairement aux tests de security.test.ts, ceux-ci doivent passer dès le
// départ, et le rester.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { exercises, lessonTitles, lessonUrl } from '../shared/exercises.ts';
import { plannedExercises } from '../shared/planned/index.ts';

const allExercises = [...exercises, ...plannedExercises];

const labRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG = path.resolve(labRoot, '../src/data/catalog.ts');

/** Les leçons du site, lues dans son catalogue : « m02/l02 » → titre. */
function siteLessons(): Map<string, string> | null {
  if (!fs.existsSync(CATALOG)) return null;
  const source = fs.readFileSync(CATALOG, 'utf8');
  const found = new Map<string, string>();
  // Chaque module ouvre par « id: 'mNN' », puis ses leçons par L('lNN', 'titre', …).
  const modules = [...source.matchAll(/id: '(m\d\d)'/g)];
  modules.forEach((m, i) => {
    const start = m.index ?? 0;
    const end = i + 1 < modules.length ? modules[i + 1].index ?? source.length : source.length;
    for (const l of source.slice(start, end).matchAll(/L\('(l\d+)', '((?:[^'\\]|\\.)*)'/g)) {
      found.set(`${m[1]}/${l[1]}`, l[2].replace(/\\'/g, "'"));
    }
  });
  return found;
}

describe('liens vers le site', () => {
  it('chaque exercice cite au moins une leçon', () => {
    for (const e of allExercises) {
      assert.ok(e.lessons.length > 0, `${e.id} ne renvoie à aucune leçon`);
    }
  });

  it('chaque leçon citée a un titre connu', () => {
    for (const e of allExercises) {
      for (const ref of e.lessons) {
        assert.ok(lessonTitles[ref], `${e.id} cite ${ref}, absent de lessonTitles`);
      }
    }
  });

  it('les URL produites pointent vers le routeur du site', () => {
    assert.match(lessonUrl('m02/l02'), /\/#\/modules\/m02\/l02$/);
    assert.match(lessonUrl('m02/l02', 'https://exemple.test'), /^https:\/\/exemple\.test\/#\/modules\//);
  });

  it('aucun titre recopié n’a divergé du catalogue du site', (t) => {
    const site = siteLessons();
    if (!site) return t.skip('catalogue du site introuvable : lab utilisé hors du dépôt');

    const wrong: string[] = [];
    for (const [ref, title] of Object.entries(lessonTitles)) {
      const actual = site.get(ref);
      if (actual === undefined) wrong.push(`${ref} n’existe plus dans le site`);
      else if (actual !== title) wrong.push(`${ref} : « ${title} » ≠ « ${actual} »`);
    }
    assert.deepEqual(wrong, [], `titres à resynchroniser dans shared/exercises.ts :\n  ${wrong.join('\n  ')}`);
  });

  it('les modules des exercices existent dans le site', (t) => {
    const site = siteLessons();
    if (!site) return t.skip('catalogue du site introuvable');
    const modules = new Set([...site.keys()].map((k) => k.split('/')[0]));
    for (const e of allExercises) {
      assert.ok(modules.has(e.module), `${e.id} est rattaché à ${e.module}, inconnu du site`);
    }
  });
});

describe('cohérence du catalogue', () => {
  it('aucun identifiant de challenge n’est en double', () => {
    const seen = new Set<string>();
    for (const e of allExercises) {
      assert.ok(!seen.has(e.id), `identifiant en double : ${e.id}`);
      seen.add(e.id);
    }
  });

  it('les challenges à venir ne sont pas servis par l’API', () => {
    // Le lab ne doit proposer que ce qui existe : un challenge « planned »
    // listé dans l'interface serait une promesse non tenue.
    for (const e of exercises) assert.equal(e.status, 'live', `${e.id} n'est pas jouable`);
    for (const e of plannedExercises) assert.equal(e.status, 'planned', `${e.id} mal marqué`);
  });

  // Un challenge « artifact » désigne un livrable que l'apprenant doit ÉCRIRE :
  // son fichier n'existe pas au départ, et c'est normal. Ce qui doit exister,
  // c'est le livrable de référence dans solutions/workspace/.
  it('le fichier fautif de chaque exercice exploit ou fix existe', () => {
    const missing = exercises
      .filter((e) => e.kind !== 'artifact')
      .filter((e) => !fs.existsSync(path.join(labRoot, e.file)))
      .map((e) => `${e.id} : ${e.file}`);
    assert.deepEqual(missing, [], `fichiers introuvables :\n  ${missing.join('\n  ')}`);
  });

  it('chaque exercice exploit ou fix a son fichier corrigé dans solutions/', () => {
    const missing = exercises
      .filter((e) => e.kind !== 'artifact')
      .filter((e) => !fs.existsSync(path.join(labRoot, 'solutions', e.file)))
      .map((e) => `${e.id} : solutions/${e.file}`);
    assert.deepEqual(missing, [], `corrigés manquants :\n  ${missing.join('\n  ')}`);
  });

  it('chaque challenge artifact a son livrable de référence', () => {
    const missing = exercises
      .filter((e) => e.kind === 'artifact')
      .filter((e) => !fs.existsSync(path.join(labRoot, 'solutions/workspace', e.file)))
      .map((e) => `${e.id} : solutions/workspace/${e.file}`);
    assert.deepEqual(missing, [], `livrables de référence manquants :\n  ${missing.join('\n  ')}`);
  });

  it('CHALLENGES.md correspond au registre', () => {
    // Le catalogue est écrit une fois, dans shared/exercises.ts ; la doc en est
    // dérivée. Si ce test échoue : npm run challenges
    try {
      execFileSync('node', ['--import', 'tsx', 'scripts/gen-challenges.mjs', '--check'], {
        cwd: labRoot, stdio: 'pipe',
      });
    } catch (err) {
      const out = (err as { stderr?: Buffer }).stderr?.toString() ?? String(err);
      assert.fail(out.trim());
    }
  });
});

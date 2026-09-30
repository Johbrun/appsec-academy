// Tests de régression des challenges « fix » : ceux dont le défaut vit dans le
// dépôt fixture `novafact/` plutôt que dans une requête.
//
// Ce fichier est volontairement agnostique du module : il parcourt le registre
// des vérifications et celui des exercices jouables. Brancher un nouveau module
// dans `server/audit/index.ts` suffit à le couvrir, sans toucher ici.
//
// Comme les autres, ces tests ÉCHOUENT sur les fixtures livrées : c'est leur
// rôle. Et ils ne demandent aucun serveur — tout se joue sur des fichiers.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checks } from '../server/audit/index.ts';
import { yamlErrors } from '../server/audit/repo.ts';
import { exercises } from '../shared/exercises.ts';

const labRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixChallenges = exercises.filter((e) => e.kind === 'fix');
const uniq = <T>(xs: T[]) => [...new Set(xs)];

describe('novafact · dépôt fixture', () => {
  it('tous les fichiers YAML de la fixture restent lisibles', () => {
    const errors = yamlErrors();
    assert.deepEqual(errors, [], `YAML invalide :\n  ${errors.join('\n  ')}`);
  });

  it('chaque challenge « fix » a sa vérification', () => {
    const missing = fixChallenges.filter((e) => !(e.id in checks)).map((e) => e.id);
    assert.deepEqual(missing, [], `sans vérification : ${missing.join(', ')}`);
  });

  it('chaque vérification correspond à un challenge jouable', () => {
    const known = new Set(exercises.map((e) => e.id));
    const orphans = Object.keys(checks).filter((id) => !known.has(id));
    assert.deepEqual(orphans, [], `vérifications orphelines : ${orphans.join(', ')}`);
  });

  it('chaque fichier cité existe dans la fixture', () => {
    const missing = uniq(fixChallenges.map((e) => e.file)).filter(
      (f) => !fs.existsSync(path.join(labRoot, f)),
    );
    assert.deepEqual(missing, [], `fichiers absents : ${missing.join(', ')}`);
  });

  it('le corrigé de référence couvre les mêmes fichiers', () => {
    const missing = uniq(fixChallenges.map((e) => e.file)).filter(
      (f) => !fs.existsSync(path.join(labRoot, 'solutions', f)),
    );
    assert.deepEqual(missing, [], `absents de solutions/ : ${missing.join(', ')}`);
  });
});

// Un test par challenge : l'échec nomme ce qui reste à corriger, plutôt qu'un
// « 40 problèmes » indigeste.
for (const m of uniq(fixChallenges.map((e) => e.module)).sort()) {
  describe(`${m.toUpperCase()} · les défauts sont corrigés`, () => {
    for (const e of fixChallenges.filter((x) => x.module === m && x.id in checks)) {
      it(`${e.id} · ${e.title}`, () => {
        const reason = checks[e.id]();
        assert.equal(reason, null, reason ?? '');
      });
    }
  });
}

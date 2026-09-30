// Exécute le générateur de données de test de l'apprenant.
//
//   node seed-runner.mjs <scripts/seed.mjs> <seed-suspects.json>
//
// Sortie : une ligne JSON sur stdout.
//   { "ok": true, "alpha1": [...], "alpha2": [...], "beta": [...],
//     "verdicts": { "reels": [[…]], "synthetiques": [[…]], "generes": [[…]] } }
//
// Le module est chargé dans un processus neuf : deux appels au même germe
// doivent donner le même résultat sans que l'état d'une exécution précédente
// puisse y aider.

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const fail = (message) => {
  process.stdout.write(JSON.stringify({ ok: false, erreur: message }));
  process.exit(0);
};

const [, , moduleArg, suspectsArg] = process.argv;
if (!moduleArg || !suspectsArg) fail('usage : seed-runner.mjs <module> <suspects.json>');

const fichier = path.resolve(moduleArg);
if (!fs.existsSync(fichier)) fail(`le fichier ${moduleArg} n’existe pas`);

let mod;
try {
  mod = await import(pathToFileURL(fichier).href);
} catch (err) {
  fail(`le module n’a pas pu être chargé : ${String(err.message ?? err).split('\n')[0]}`);
}

const generate = mod.generate ?? mod.default?.generate;
const suspect = mod.suspect ?? mod.default?.suspect;
if (typeof generate !== 'function') fail('le module doit exporter une fonction `generate({ graine, nombre })`');
if (typeof suspect !== 'function') fail('le module doit exporter une fonction `suspect(enregistrement)`');

const NOMBRE = 40;
const appelle = (graine) => {
  try {
    return generate({ graine, nombre: NOMBRE });
  } catch (err) {
    fail(`generate({ graine: "${graine}" }) a levé « ${String(err.message ?? err).split('\n')[0]} »`);
  }
};

const alpha1 = appelle('alpha');
const alpha2 = appelle('alpha');
const beta = appelle('beta');

const suspects = JSON.parse(fs.readFileSync(path.resolve(suspectsArg), 'utf8'));
const verdict = (liste) =>
  liste.map((r) => {
    try {
      const v = suspect(r);
      return Array.isArray(v) ? v.map(String) : v ? [String(v)] : [];
    } catch (err) {
      fail(`suspect() a levé « ${String(err.message ?? err).split('\n')[0]} » sur ${r.id ?? '?'}`);
      return [];
    }
  });

process.stdout.write(
  JSON.stringify({
    ok: true,
    nombre: NOMBRE,
    alpha1,
    alpha2,
    beta,
    verdicts: {
      reels: verdict(suspects.reels),
      synthetiques: verdict(suspects.synthetiques),
      generes: verdict(Array.isArray(alpha1) ? alpha1 : []),
    },
  }),
);

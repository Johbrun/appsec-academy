// Génère tous les corpus de M18.
//
//   node fixtures/m18/_gen/generate.mjs
//
// Le tirage est déterministe : relancer ce script doit reproduire les fixtures
// à l'octet près. Sans quoi les corrigés de référence de `solutions/workspace/`
// cesseraient de passer, et la vérité terrain de l'incident, qui vit dans
// `server/audit/m18.ts`, deviendrait fausse.
//
// Le script écrit aussi la partie « recopiée » des corrigés de référence — la
// bibliothèque de règles corrigée et le corpus ECS réparé — pour que la
// correction et la fixture ne puissent pas diverger.

import fs from 'node:fs';
import path from 'node:path';
import {
  OUT, writeCorpus, writeFile, writeJson, writeNdjson,
} from './lib.mjs';
import { addSecrets, denormalise, makeCs, makeGraduated, makeSmallCs, makeSpray } from './auth.mjs';
import { makeAppsensor, makeAssistant, makeHoneytoken, makeIncident, makeInventory, makeSilent } from './apps.mjs';
import {
  lintCorpus, lintCorpusFixed, writeAppsensorCatalogue, writeAttack, writeCoverageScenarios,
  writeRules, writeVocabulary, yaml,
} from './static.mjs';

const SOLUTIONS = path.resolve(OUT, '../../solutions/workspace');
const solution = (rel, content) => {
  const full = path.join(SOLUTIONS, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content.endsWith('\n') ? content : `${content}\n`);
};

console.log('corpus d’authentification');
const cs = makeCs(20_260_318, 'easy', 'cs');
writeCorpus('cs', cs.events, cs.cases);
const csHold = makeCs(77_010_425, 'easy', 'ch');
writeCorpus('cs-holdout', csHold.events, csHold.cases);
const hard = makeCs(31_415_926, 'hard', 'hd');
writeCorpus('cs-hard', hard.events, hard.cases);

const spray = makeSpray(19_820_411, 'sp');
writeCorpus('spray', spray.events, spray.cases);
const sprayHold = makeSpray(50_607_080, 'sh');
writeCorpus('spray-holdout', sprayHold.events, sprayHold.cases);

const grad = makeGraduated(12_345_678);
writeCorpus('graduated', grad.events, grad.cases);
writeJson('graduated/expected.json', {
  _note: 'Le palier maximal que la politique doit atteindre pour chaque cas. C’est une spécification, pas une devinette : le travail est de trouver l’axe, la fenêtre et les seuils qui la réalisent.',
  stages: ['aucun', 'trace', 'alerte', 'ralentissement', 'verrouillage'],
  expected: grad.expected,
});

console.log('corpus dérivés');
const small = makeSmallCs(90_909_090, 'sm');
const red = addSecrets(24_680_246, small);
writeCorpus('redaction', red.events, red.cases);
writeJson('redaction/secrets.json', {
  _note: 'Les valeurs littérales qui ne doivent plus apparaître nulle part dans le corpus caviardé, et les motifs génériques que la vérification cherche en plus.',
  literals: red.secrets,
  patterns: [
    { name: 'numéro de carte', regex: '\\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14})\\b' },
    { name: 'IBAN français', regex: '\\bFR[0-9]{2}[0-9A-Z]{11,23}\\b' },
    { name: 'jeton Novafact', regex: '\\bnvf_(live|rst)_[0-9a-zA-Z]{6,}\\b' },
    { name: 'champ mot de passe', regex: '"password"\\s*:\\s*"[^"]+"' },
  ],
});
writeFile('redaction/rule.yaml', yaml({
  id: 'credential-stuffing',
  _note: 'La règle de référence du corpus réduit. Le caviardage ne doit pas l’empêcher de lever.',
  window: '10m',
  where: [{ field: 'event.action', op: 'eq', value: 'authn_login_fail' }],
  group_by: ['source.ip'],
  having: [
    { metric: 'count', op: 'gte', value: 12 },
    { metric: 'distinct', field: 'user.name', op: 'gte', value: 8 },
  ],
}));

writeNdjson('ecs-fields/raw.ndjson', denormalise(small));
writeJson('ecs-fields/cases.json', small.cases);
writeFile('ecs-fields/rule.yaml', yaml({
  id: 'credential-stuffing',
  _note: 'La règle fournie. Elle ne bougera pas : c’est au journal de parler sa langue.',
  window: '10m',
  where: [
    { field: 'event.action', op: 'eq', value: 'authn_login_fail' },
    { field: 'event.outcome', op: 'eq', value: 'failure' },
    { field: 'http.request.method', op: 'eq', value: 'POST' },
  ],
  group_by: ['source.ip'],
  having: [
    { metric: 'count', op: 'gte', value: 12 },
    { metric: 'distinct', field: 'user.name', op: 'gte', value: 8 },
  ],
}));

writeFile('cs-hard/skeleton.yaml', yaml({
  _note: 'La règle est écrite ; seuls la fenêtre et les deux seuils sont à toi. Écris-les dans workspace/detections/thresholds.yaml.',
  rule: 'credential-stuffing',
  window: '<fenêtre>',
  thresholds: { failures: '<entier>', distinct_users: '<entier>' },
  where: [{ field: 'event.action', op: 'eq', value: 'authn_login_fail' }],
  group_by: ['source.ip'],
  having: [
    { metric: 'count', op: 'gte', value: '<failures>' },
    { metric: 'distinct', field: 'user.name', op: 'gte', value: '<distinct_users>' },
  ],
}));

console.log('corpus applicatifs');
const assistant = makeAssistant(13_131_313);
writeCorpus('assistant', assistant.events, assistant.cases);
const honey = makeHoneytoken(42_424_242);
writeCorpus('honeytoken', honey.events, honey.cases);
const appsensor = makeAppsensor(55_555_555);
writeCorpus('appsensor', appsensor.events, appsensor.cases);

const before = makeSilent(64_646_464, false);
writeCorpus('silent-before', before.events, before.cases);
const after = makeSilent(64_646_464, true);
writeCorpus('silent-after', after.events, after.cases);
writeFile('silent-before/rule-origine.yaml', yaml({
  id: 'idor-probing',
  _note: 'La règle telle qu’elle a été écrite avant le correctif. Elle lève encore après.',
  window: '5m',
  where: [
    { field: 'url.path', op: 'starts_with', value: '/api/invoices/' },
    { field: 'novafact.tenant.match', op: 'eq', value: false },
  ],
  group_by: ['user.name'],
  having: [{ metric: 'distinct', field: 'url.path', op: 'gte', value: 8 }],
}));

const incident = makeIncident(70_707_070);
writeNdjson('incident/log.ndjson', incident.events);
writeNdjson('inventory/emitted.ndjson', makeInventory(88_888_888));

console.log('fixtures statiques');
const rules = writeRules();
writeCoverageScenarios(99_999_999);
writeAttack();
writeAppsensorCatalogue();
writeVocabulary();
writeNdjson('ecs-lint/events.ndjson', lintCorpus());
writeFile('atomic/accounts.json', JSON.stringify({
  _note: 'L’état initial de l’environnement simulé sur lequel l’atomique s’exécute.',
  accounts: {
    'marie.dupont@acme.example': 'Vp8!rt2Qz',
    'lucas.martin@globex.example': 'Kd4#nw9Lm',
    'admin@novafact.example': 'Zt7!q4vR-x2Lm9_pB0wK',
  },
}, null, 2));
writeFile('atomic/rule.yaml', yaml({
  id: 'credential-stuffing',
  _note: 'La règle que l’atomique doit faire lever — et seulement pendant la détonation.',
  window: '5m',
  where: [{ field: 'event.action', op: 'eq', value: 'authn_login_fail' }],
  group_by: ['source.ip'],
  having: [
    { metric: 'count', op: 'gte', value: 10 },
    { metric: 'distinct', field: 'user.name', op: 'gte', value: 8 },
  ],
}));

console.log('corrigés recopiés');
for (const rule of rules) solution(`detections/rules/${rule.id}.yaml`, rule.repaired);
solution('logging/events.ndjson', `${lintCorpusFixed().map((r) => JSON.stringify(r)).join('\n')}\n`);

console.log('\nvérité terrain de l’incident (à reporter dans server/audit/m18.ts) :');
console.log(JSON.stringify(incident.truth));

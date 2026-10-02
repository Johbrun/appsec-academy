// Où trouver les séries de chaque jeu, sans charger tous les jeux.
//
// La page d'une leçon affiche les séries qu'elle exige : il lui faut leurs
// titres, pas les scénarios des vingt-neuf jeux. Chaque entrée ne charge, à la
// demande, que le fichier de données du jeu concerné.
//
// `check-games` vérifie que chaque jeu du catalogue a son entrée ici, et que
// l'export désigné est bien celui que le composant du jeu passe à `SeriesGame` :
// une entrée qui pointe vers les séries d'un autre jeu validerait une leçon sur
// des records qui ne correspondent à rien.

import type { SeriesSet } from '../lib/series';

type Loader = () => Promise<SeriesSet<unknown>>;

export const seriesLoaders: Record<string, Loader> = {
  flashcards: () => import('./game-cards').then((m) => m.cardSeries),
  referentiel: () => import('./game-referentiel').then((m) => m.refSeries),
  'spot-the-sink': () => import('./sinks').then((m) => m.sinkSeries),
  'patch-or-pwn': () => import('./game-patches').then((m) => m.patchSeries),
  'stepping-stones': () => import('./game-stones').then((m) => m.stoneSeries),
  'race-window': () => import('./game-races').then((m) => m.raceSeries),
  'triage-room': () => import('./game-triage').then((m) => m.triageSeries),
  'csp-builder': () => import('./game-csp').then((m) => m.cspSeries),
  pushback: () => import('./game-pushback').then((m) => m.pushbackSeries),
  'data-map': () => import('./game-datamap').then((m) => m.dataMapSeries),
  'pattern-match': () => import('./game-patterns').then((m) => m.patternSeries),
  'design-review': () => import('./game-review').then((m) => m.reviewSeries),
  'parser-wars': () => import('./game-parsers').then((m) => m.parserSeries),
  'oauth-debugger': () => import('./game-oauth').then((m) => m.oauthSeries),
  'abuse-desk': () => import('./game-abuse').then((m) => m.abuseSeries),
  'stride-cards': () => import('./game-stride').then((m) => m.strideSeries),
  'diff-review': () => import('./game-diff').then((m) => m.diffSeries),
  'right-tool': () => import('./game-tools').then((m) => m.toolSeries),
  'true-false-positive': () => import('./game-findings').then((m) => m.findingSeries),
  'workflow-audit': () => import('./game-workflows').then((m) => m.workflowSeries),
  'supply-chain': () => import('./game-supply').then((m) => m.supplySeries),
  'allow-deny': () => import('./game-iam').then((m) => m.iamSeries),
  'iam-pathfinder': () => import('./game-pathfinder').then((m) => m.pathSeries),
  'iac-hunt': () => import('./game-iac').then((m) => m.iacSeries),
  'log-detective': () => import('./game-logs').then((m) => m.logSeries),
  'detection-builder': () => import('./game-detection').then((m) => m.detSeries),
  'agent-blast-radius': () => import('./game-agent').then((m) => m.agentSeries),
  'crise-j0': () => import('./game-crisis').then((m) => m.crisisSeries),
  'red-blue': () => import('./game-redblue').then((m) => m.redBlueSeries),
  'tarball-inspector': () => import('./game-tarball').then((m) => m.tarballSeries),
  'attack-tactics': () => import('./game-attack-tactics').then((m) => m.tacticSeries),
  'attack-mitigations': () => import('./game-attack-mitigations').then((m) => m.rampartSeries),
  'attack-killchain': () => import('./game-attack-killchain').then((m) => m.chainSeries),
  'cti-mapper': () => import('./game-cti').then((m) => m.ctiSeries),
};

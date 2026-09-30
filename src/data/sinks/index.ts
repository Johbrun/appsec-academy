// Assemblage du pool de « Spot the Sink » et composition des séries.
//
// Les extraits vivent dans des fichiers séparés par famille de vulnérabilité,
// mais les **séries ne sont pas thématiques** : chacune pioche dans tout le
// pool, à un niveau de difficulté donné. On ne joue pas « la série injection » —
// on joue « la série niveau 2 », et c'est justement parce qu'on ignore ce qu'on
// va trouver que l'exercice ressemble à une revue de code.
//
// La composition est **déterministe** : une série donne toujours les mêmes
// extraits, dans le même ordre. C'est ce qui permet d'y revenir pour comparer,
// et c'est ce qui donne un sens à son étiquette de difficulté. Seule la
// dernière série rebat les cartes à chaque partie.

import type { SinkLevel, SinkSeries, Snippet } from './types';
import { defineSeries, type SeriesProfile } from '../../lib/series';
import { examples } from './examples';
import * as injection from './pool-injection';
import * as crypto from './pool-crypto';
import * as client from './pool-client';
import * as access from './pool-access';
import * as extra from './pool-extra';

export type { SinkLevel, SinkSeries, Snippet } from './types';

// ── Le pool ─────────────────────────────────────────────────────────────────

/**
 * Les fichiers de pool sont ajoutés ici au fur et à mesure. Chacun exporte
 * `snippets` et, éventuellement, `cwe` — les libellés qu'il introduit.
 */
const pools: { snippets: Snippet[]; cwe?: Record<string, string> }[] = [
  { snippets: examples },
  injection,
  crypto,
  client,
  access,
  extra,
];

export const snippets: Snippet[] = pools.flatMap((p) => p.snippets);

/** Les libellés de CWE, catalogue de base plus ce qu'apportent les pools. */
export const cweNames: Record<string, string> = Object.assign(
  {
    'CWE-20': 'Validation d’entrée incorrecte',
    'CWE-22': 'Traversée de chemin',
    'CWE-78': 'Injection de commande système',
    'CWE-79': 'Cross-site scripting',
    'CWE-89': 'Injection SQL',
    'CWE-200': 'Exposition d’informations sensibles',
    'CWE-208': 'Fuite par le temps d’exécution',
    'CWE-209': 'Message d’erreur qui révèle des informations',
    'CWE-307': 'Tentatives d’authentification non limitées',
    'CWE-330': 'Valeur insuffisamment aléatoire',
    'CWE-347': 'Vérification incorrecte d’une signature',
    'CWE-352': 'Cross-site request forgery',
    'CWE-434': 'Téléversement de fichier non restreint',
    'CWE-611': 'Traitement d’entités externes XML',
    'CWE-639': 'Autorisation via une clé contrôlée par l’utilisateur (BOLA)',
    'CWE-640': 'Récupération de mot de passe faible',
    'CWE-915': 'Modification d’attributs non contrôlée (mass assignment)',
    'CWE-918': 'Server-side request forgery',
    'CWE-942': 'Politique cross-domain trop permissive',
    'CWE-943': 'Injection dans la logique de requête (NoSQL)',
    'CWE-1321': 'Prototype pollution',
    'CWE-1333': 'Regex à complexité excessive (ReDoS)',
    'CWE-1336': 'Injection dans un moteur de templates',
  },
  ...pools.map((p) => p.cwe ?? {}),
);

export const snippetById = (id: string) => snippets.find((s) => s.id === id);
export const atLevel = (level: SinkLevel) => snippets.filter((s) => s.level === level);

// ── Les séries ──────────────────────────────────────────────────────────────

export const ROUNDS = 8;

const mix = (n1: number, n2: number, n3: number): [number, number, number] => [n1, n2, n3];

// Les niveaux affichés sont fixés : à égalité, la série garde l'étiquette la
// plus basse de son mélange, comme avant la généralisation aux autres jeux.
const PROFILES: SeriesProfile<Snippet>[] = [
  { id: 'decouverte', title: 'Découverte', mix: mix(8, 0, 0), level: 1,
    text: 'Le sink est dans la même fonction que l’entrée, et rien d’autre ne ressemble à un défaut. On apprend à reconnaître la forme.' },
  { id: 'mise-en-jambe', title: 'Mise en jambe', mix: mix(6, 2, 0), level: 1,
    text: 'Deux extraits plus longs se glissent dans le lot, avec de quoi se tromper.' },
  { id: 'terrain-connu', title: 'Terrain connu', mix: mix(4, 4, 0), level: 1,
    text: 'La moitié des extraits contient un leurre : une ligne qui a l’air pire qu’elle ne l’est.' },
  { id: 'montee', title: 'Montée en charge', mix: mix(2, 5, 1), level: 2,
    text: 'Le code sain domine, et la distance grandit entre l’endroit où la donnée entre et celui où elle fait mal.' },
  { id: 'revue-de-pr', title: 'Revue de PR', mix: mix(0, 8, 0), level: 2,
    text: 'Huit extraits de la taille d’un vrai fichier. C’est le rythme d’une relecture de pull request.' },
  { id: 'cas-tordus', title: 'Cas tordus', mix: mix(0, 5, 3), level: 2,
    text: 'Trois extraits où la donnée traverse une fonction auxiliaire, ou bien où le défaut est une absence.' },
  { id: 'le-doute', title: 'Le doute', mix: mix(0, 4, 4), level: 2,
    text: 'La moitié des extraits sont conçus pour qu’on hésite entre deux lignes défendables.' },
  { id: 'audit', title: 'Audit', mix: mix(0, 2, 6), level: 3,
    text: 'Presque que du niveau 3 : deux routes presque identiques dont une seule est vulnérable, un contrôle qui manque.' },
  { id: 'expert', title: 'Expert', mix: mix(0, 0, 8), level: 3,
    text: 'Rien ne se devine à la forme. Il faut suivre la donnée, ligne à ligne.' },
  { id: 'melee', title: 'Mêlée', mix: mix(3, 3, 2), level: 2, shuffleEachTime: true,
    text: 'Tous niveaux confondus, recomposée à chaque partie. C’est la seule série qu’on ne peut pas réviser.' },
];

/** Les séries, au format commun à tous les jeux (écran de choix partagé). */
export const sinkSeries = defineSeries(snippets, PROFILES);

export const series: SinkSeries[] = sinkSeries.list.map((s) => ({
  id: s.id,
  title: s.title,
  level: s.level,
  text: s.text,
  snippets: sinkSeries.items(s.id).map((it) => it.id),
}));

export const seriesById = (id: string) => series.find((s) => s.id === id);

/** Les extraits d'une série, recomposés si le profil le demande. */
export const seriesSnippets = (id: string, salt = 0): Snippet[] => sinkSeries.items(id, salt);

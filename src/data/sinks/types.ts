// Modèle du jeu « Spot the Sink ».
//
// Le jeu demande deux choses : trouver la ligne vulnérable dans un extrait, puis
// nommer la faiblesse. La difficulté ne vient pas du nom de la CWE — elle vient
// de la **distance** entre l'endroit où la donnée entre et l'endroit où elle
// fait mal, et de la présence de lignes qui ont l'air pires qu'elles ne sont.
//
// D'où les trois niveaux. Les longueurs indiquées sont un ordre de grandeur,
// pas une contrainte : c'est la **structure** qui décide du niveau. Un extrait
// de 38 lignes reste un N2 si le sink est visible et qu'il n'y a qu'un saut à
// faire ; mieux vaut dépasser de trois lignes que sacrifier un leurre.
//
//   N1 · 12 à 20 lignes. Le sink est dans la même fonction que l'entrée, et
//        rien d'autre dans l'extrait ne ressemble à un défaut. On apprend à
//        reconnaître la forme.
//
//   N2 · 20 à 35 lignes. Plusieurs lignes séparent l'entrée du sink, et
//        l'extrait contient au moins un **leurre** : une ligne qui a l'air
//        dangereuse et qui est saine — une requête paramétrée à côté d'une
//        requête brute, un échappement appliqué au mauvais contexte.
//
//   N3 · 30 à 50 lignes. La donnée traverse une fonction auxiliaire définie
//        dans l'extrait, ou le défaut est une **absence** (un contrôle qui
//        manque), ou deux routes presque identiques dont une seule est
//        vulnérable. C'est de la revue de code, pas de la reconnaissance de
//        motif.

export type SinkLevel = 1 | 2 | 3;

export interface Snippet {
  /** Identifiant stable : il sert à composer les séries. */
  id: string;
  file: string;
  lang: string;
  code: string;
  /** La ligne vulnérable, à partir de 1. */
  line: number;
  cwe: string;
  /** Quatre CWE, dont la bonne. L'ordre est mélangé à l'affichage. */
  options: string[];
  explain: string;
  level: SinkLevel;
  /**
   * Les lignes qui attirent l'œil sans être le défaut. L'explication doit dire
   * pourquoi elles sont saines : c'est là que le joueur apprend le plus.
   */
  decoys?: number[];

  /**
   * Les extraits qui ne doivent pas tomber dans la même série que celui-ci :
   * deux extraits de même structure — « comparez ces deux appels » — se
   * résolvent par diff visuel dès qu'on les voit côte à côte, et le second
   * n'apprend plus rien.
   */
  avoid?: string[];
}

export interface SinkSeries {
  id: string;
  title: string;
  /** Le niveau dominant, pour l'affichage. */
  level: SinkLevel;
  text: string;
  /** Les identifiants d'extraits, dans l'ordre de jeu. */
  snippets: string[];
}

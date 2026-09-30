// Séries de jeu : découper un pool de scénarios en sous-modules de difficulté.
//
// Né dans « Spot the Sink », généralisé ici pour tous les jeux. Un jeu déclare
// un **pool** d'items notés N1, N2 ou N3, puis des **profils** de série. Chaque
// profil dit comment piocher :
//
//   · `mix`    — combien d'items de chaque niveau. La série n'est pas
//                thématique : on ignore ce qu'on va trouver, et c'est le but.
//   · `filter` — une série thématique (un public, une famille, un service),
//                éventuellement combinée à un `mix`.
//   · `ids`    — une liste explicite, dans l'ordre de jeu. Pour les jeux à
//                scénario unique (une crise, un design doc), une série = un id.
//
// La composition est **déterministe** : une série donne toujours les mêmes
// items, dans le même ordre. C'est ce qui permet d'y revenir pour comparer, et
// ce qui donne un sens à son étiquette de difficulté. Seul un profil marqué
// `shuffleEachTime` rebat les cartes à chaque partie.
//
// Ce que ce module ne décide pas : ce qu'est un N1, un N2 ou un N3. Ça dépend
// du geste que le jeu entraîne, et chaque fichier de données l'écrit en tête.

import type { Level } from '../data/catalog';

export type { Level };

/** Un item de pool : un identifiant stable et un niveau. */
export interface Leveled {
  id: string;
  level: Level;
  /**
   * Les items qui ne doivent pas tomber dans la même série que celui-ci : deux
   * scénarios de même structure se résolvent par comparaison dès qu'on les voit
   * l'un après l'autre, et le second n'apprend plus rien.
   */
  avoid?: string[];
}

export interface SeriesProfile<T> {
  id: string;
  title: string;
  text: string;
  /** Tirage par niveau : [N1, N2, N3]. */
  mix?: [n1: number, n2: number, n3: number];
  /** Restreint le pool (série thématique). Sans `mix`, prend tout ce qui passe. */
  filter?: (item: T) => boolean;
  /** Liste explicite, dans l'ordre de jeu. Prioritaire sur `mix` et `filter`. */
  ids?: string[];
  /** Niveau affiché. Déduit du contenu s'il est omis. */
  level?: Level;
  /** Recomposée à chaque partie plutôt que figée. */
  shuffleEachTime?: boolean;
}

/** Ce que l'écran de choix affiche d'une série. */
export interface SeriesInfo {
  id: string;
  title: string;
  text: string;
  level: Level;
  count: number;
  shuffleEachTime: boolean;
}

export interface SeriesSet<T> {
  list: SeriesInfo[];
  /** Les items d'une série. `salt` ne joue que pour les séries rebattues. */
  items: (id: string, salt?: number) => T[];
}

// ── Hasard reproductible ────────────────────────────────────────────────────

/** Générateur déterministe : une graine, toujours la même suite. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededShuffle<T>(items: T[], seed: number): T[] {
  const next = rng(seed);
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export const hash = (s: string) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7);

// ── Composition ─────────────────────────────────────────────────────────────

/** Le niveau qui domine une série : le plus représenté, le plus haut à égalité. */
export function dominantLevel(items: { level: Level }[]): Level {
  const n = [0, 0, 0];
  items.forEach((it) => { n[it.level - 1] += 1; });
  const max = Math.max(...n);
  return ((n.lastIndexOf(max)) + 1) as Level;
}

/**
 * Tire `mix` items par niveau dans `pool`. Deux séries voisines ne tirent pas
 * les mêmes items : la graine décale la fenêtre de tirage dans chaque niveau.
 */
export function composeMix<T extends Leveled>(
  pool: T[], mix: [number, number, number], key: string, index: number, salt = 0,
): T[] {
  const picked: T[] = [];
  mix.forEach((count, k) => {
    if (!count) return;
    const level = (k + 1) as Level;
    const bag = seededShuffle(pool.filter((it) => it.level === level), hash(key) + salt);
    if (!bag.length) return;
    // Le décalage évite que deux séries de même niveau ouvrent sur le même
    // item quand le pool est encore petit.
    let cursor = index * 2;
    for (let n = 0; n < count; n += 1) {
      let taken: T | undefined;
      // On saute les items déjà pris et ceux que les précédents excluent.
      for (let tries = 0; tries < bag.length && !taken; tries += 1) {
        const candidate = bag[(cursor + tries) % bag.length];
        const clash = picked.some(
          (p) => p.id === candidate.id
            || (p.avoid ?? []).includes(candidate.id)
            || (candidate.avoid ?? []).includes(p.id),
        );
        if (!clash) { taken = candidate; cursor = (cursor + tries + 1) % bag.length; }
      }
      // Pool trop étroit pour honorer toutes les exclusions : on complète.
      picked.push(taken ?? bag[(cursor + n) % bag.length]);
    }
  });
  // Dédoublonne : un pool étroit peut rendre deux fois le même item.
  const seen = new Set<string>();
  const unique = picked.filter((s) => !seen.has(s.id) && seen.add(s.id));
  return seededShuffle(unique, hash(key) + 1 + salt);
}

/**
 * Construit les séries d'un jeu. Lève une erreur au chargement si un profil
 * cite un id inconnu : une série silencieusement amputée est pire qu'un crash
 * visible en développement.
 */
export function defineSeries<T extends Leveled>(pool: T[], profiles: SeriesProfile<T>[]): SeriesSet<T> {
  const byId = new Map(pool.map((it) => [it.id, it]));
  if (byId.size !== pool.length) {
    const dup = pool.map((it) => it.id).filter((id, i, a) => a.indexOf(id) !== i);
    throw new Error(`Identifiants en double dans le pool : ${[...new Set(dup)].join(', ')}`);
  }

  const build = (p: SeriesProfile<T>, index: number, salt = 0): T[] => {
    if (p.ids) {
      return p.ids.map((id) => {
        const it = byId.get(id);
        if (!it) throw new Error(`Série « ${p.id} » : item inconnu « ${id} »`);
        return it;
      });
    }
    const base = p.filter ? pool.filter(p.filter) : pool;
    if (!p.mix) return seededShuffle(base, hash(p.id) + salt);
    return composeMix(base, p.mix, p.id, index, salt);
  };

  const fixed = profiles.map((p, i) => build(p, i));

  return {
    list: profiles.map((p, i) => ({
      id: p.id,
      title: p.title,
      text: p.text,
      level: p.level ?? dominantLevel(fixed[i]),
      count: fixed[i].length,
      shuffleEachTime: Boolean(p.shuffleEachTime),
    })),
    items: (id, salt = 0) => {
      const k = profiles.findIndex((p) => p.id === id);
      if (k < 0) return [];
      const p = profiles[k];
      return p.shuffleEachTime ? build(p, k, salt || Date.now()) : fixed[k];
    },
  };
}

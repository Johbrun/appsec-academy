// Lecture du catalogue du site : modules et leçons.
//
// Le lab est un paquet séparé et n'importe rien du site. Il lit son catalogue
// comme une donnée, par analyse du source, pour produire la table de couverture
// de CHALLENGES.md. verify/links.test.ts fait la même lecture de son côté pour
// vérifier les titres recopiés — une petite duplication assumée, parce que les
// deux tournent dans des contextes différents.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const CATALOG_PATH = path.resolve(here, '../../src/data/catalog.ts');

/**
 * @returns {{ id: string, num: number, title: string, lessons: { id: string, ref: string, title: string, level: number }[] }[] | null}
 *   null si le catalogue est introuvable (lab utilisé hors du dépôt).
 */
export function readSiteCatalog() {
  if (!fs.existsSync(CATALOG_PATH)) return null;
  const source = fs.readFileSync(CATALOG_PATH, 'utf8');

  const heads = [...source.matchAll(/id: '(m\d\d)', num: (\d+)[^\n]*title: '((?:[^'\\]|\\.)*)'/g)];
  return heads.map((head, i) => {
    const start = head.index ?? 0;
    const end = i + 1 < heads.length ? heads[i + 1].index ?? source.length : source.length;
    const lessons = [...source.slice(start, end).matchAll(/L\('(l\d+)', '((?:[^'\\]|\\.)*)', (\d)/g)].map(
      (l) => ({
        id: l[1],
        ref: `${head[1]}/${l[1]}`,
        title: l[2].replace(/\\'/g, "'"),
        level: Number(l[3]),
      }),
    );
    return { id: head[1], num: Number(head[2]), title: head[3].replace(/\\'/g, "'"), lessons };
  });
}

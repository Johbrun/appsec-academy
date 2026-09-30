import type { LessonModule, Question } from './content';
import { modules, type BlockId, type Csslp } from '../data/catalog';

// Un item d'examen : une question, enrichie de sa provenance (module, bloc, domaines CSSLP).
export interface ExamItem extends Question {
  moduleId: string;
  lessonId: string;
  block: BlockId;
  csslp: Csslp[];
}

const loaders = import.meta.glob<LessonModule>('../content/*/*.mdx');

// Métadonnées par chemin de fichier, pour éviter de recharger le catalogue à chaque question.
const metaByPath = new Map<string, { moduleId: string; lessonId: string; block: BlockId; csslp: Csslp[] }>();
for (const m of modules) {
  for (const l of m.lessons) {
    metaByPath.set(`../content/${m.id}/${l.id}.mdx`, { moduleId: m.id, lessonId: l.id, block: m.block, csslp: l.csslp });
  }
}

let cache: ExamItem[] | null = null;

// Charge toutes les questions de toutes les leçons rédigées (une fois, puis mis en cache).
export async function loadPool(): Promise<ExamItem[]> {
  if (cache) return cache;
  const entries = await Promise.all(
    Object.entries(loaders).map(async ([path, load]) => {
      const meta = metaByPath.get(path);
      if (!meta) return [];
      try {
        const mod = await load();
        return (mod.questions ?? []).map((q) => ({ ...q, ...meta }));
      } catch {
        return [];
      }
    }),
  );
  cache = entries.flat();
  return cache;
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Tire `n` questions d'un ensemble filtré, sans doublon.
export function pick(pool: ExamItem[], filter: (i: ExamItem) => boolean, n: number): ExamItem[] {
  return shuffle(pool.filter(filter)).slice(0, n);
}

// Construit l'examen blanc CSSLP : 100 questions réparties selon le poids officiel des domaines.
export function buildCsslp(pool: ExamItem[], total: number, domains: { id: Csslp; weight: number }[]): ExamItem[] {
  const sumW = domains.reduce((s, d) => s + d.weight, 0);
  const out: ExamItem[] = [];
  const used = new Set<ExamItem>();
  for (const d of domains) {
    const n = Math.round((d.weight / sumW) * total);
    const items = shuffle(pool.filter((i) => i.csslp.includes(d.id) && !used.has(i))).slice(0, n);
    items.forEach((i) => used.add(i));
    out.push(...items);
  }
  // Complète ou tronque pour atteindre exactement `total`.
  if (out.length < total) {
    const extra = shuffle(pool.filter((i) => !used.has(i))).slice(0, total - out.length);
    out.push(...extra);
  }
  return shuffle(out).slice(0, total);
}

import type { ComponentType } from 'react';
import type { MDXProps } from 'mdx/types';
import { modules } from '../data/catalog';

export interface Question {
  q: string;
  options: string[];
  answer: number;
  explain: string;
}

export interface LessonModule {
  default: ComponentType<MDXProps>;
  questions?: Question[];
}

// Chaque leçon rédigée est un fichier src/content/<module>/<leçon>.mdx, chargé à la demande.
const loaders = import.meta.glob<LessonModule>('../content/*/*.mdx');

const path = (moduleId: string, lessonId: string) => `../content/${moduleId}/${lessonId}.mdx`;

export const lessonLoader = (moduleId: string, lessonId: string) => loaders[path(moduleId, lessonId)];
export const isWritten = (moduleId: string, lessonId: string) => path(moduleId, lessonId) in loaders;

export const writtenLessons = (moduleId: string) =>
  (modules.find((m) => m.id === moduleId)?.lessons ?? []).filter((l) => isWritten(moduleId, l.id)).map((l) => l.id);

export const writtenCount = () => Object.keys(loaders).length;

/**
 * Modules qui ont au moins une leçon rédigée. Comme une leçon « en rédaction »
 * ne bloque pas la validation de son module, un module encore vide ne bloque
 * ni le certificat ni le badge de son bloc : il serait impossible à valider.
 */
export const openModules = () => modules.filter((m) => m.lessons.some((l) => isWritten(m.id, l.id)));

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

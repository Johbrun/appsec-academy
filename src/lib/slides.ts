import type { ReactNode } from 'react';

/**
 * Supports de formation : un deck par module, dans src/slides/<module>.tsx,
 * chargé à la demande comme les leçons. Un module sans fichier s'affiche
 * « en préparation » sur la page des slides.
 *
 * Le deck reformule les leçons pour une séance animée : il ne remplace pas
 * le texte de la leçon, qui reste la référence (faits, sources, quiz). Tout
 * fait cité sur une slide doit donc déjà figurer, sourcé, dans la leçon.
 */

export type SlideLayout = 'cover' | 'section' | 'content' | 'end';

export interface SlideDef {
  /** Leçon couverte (« l03 ») : sert aux chapitres et à la navigation. */
  lesson?: string;
  layout?: SlideLayout;
  eyebrow?: ReactNode;
  title: string;
  body?: ReactNode;
  /** Notes du formateur, affichées sous la slide (touche N). */
  notes?: ReactNode;
  /** Source du fait principal, en pied de slide. */
  source?: string;
}

export interface DeckModule {
  default: SlideDef[];
}

const loaders = import.meta.glob<DeckModule>('../slides/*.tsx');
const path = (moduleId: string) => `../slides/${moduleId}.tsx`;

export const deckLoader = (moduleId: string) => loaders[path(moduleId)];
export const hasDeck = (moduleId: string) => path(moduleId) in loaders;

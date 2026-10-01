/** Formes des réponses de /api/teacher, et petits utilitaires d'affichage de l'espace enseignant. */

export interface Summary {
  xp: number;
  lessons: number;
  modules: number;
  labs: number;
  badges: number;
  games: number;
  exams: Record<string, number>;
}

export interface CohortItem { id: number; name: string; code: string; createdAt: number; members: number }

export interface Member {
  id: number;
  name: string;
  email: string;
  joinedAt: number;
  lastActive: number | null;
  summary: Summary;
}

export const fmtDate = (ms: number) => new Date(ms).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

export function since(ms: number | null): string {
  if (ms === null) return 'jamais';
  const days = Math.floor((Date.now() - ms) / 86_400_000);
  if (days <= 0) return 'aujourd’hui';
  if (days === 1) return 'hier';
  if (days < 60) return `il y a ${days} j`;
  return fmtDate(ms);
}

/**
 * Cellule CSV. Un nom d'étudiant est une saisie libre : commencé par « = », « + », « - » ou « @ », il serait
 * interprété comme une formule à l'ouverture dans un tableur. On le neutralise avec une apostrophe.
 */
export function csvCell(value: string | number): string {
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

/** Séparateur « ; » et BOM : c'est ce que le Excel français ouvre correctement. */
export function toCsv(rows: (string | number)[][]): string {
  return `﻿${rows.map((r) => r.map(csvCell).join(';')).join('\r\n')}\r\n`;
}

export function download(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function copy(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

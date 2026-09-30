import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { blocks, lessonKey, modules } from '../data/catalog';
import { availableGames, games } from '../data/games';

export interface LeitnerCard { box: number; due: string }

export interface Progress {
  version: 1;
  name: string;
  xp: number;
  lessons: Record<string, string>;      // clé "m02-l03" → date de validation
  modules: string[];                    // modules validés
  scores: Record<string, number>;       // meilleur score par jeu
  labs: string[];                       // labs externes cochés
  leitner: Record<string, LeitnerCard>; // état de la répétition espacée
  badges: string[];
  /**
   * Le diagnostic d'entrée et de sortie de chaque module, en pourcentage.
   *
   * `avant` est **gelé au premier passage** : c'est une mesure, et une mesure
   * qu'on peut refaire jusqu'à ce qu'elle arrange ne mesure rien. `apres`
   * garde le meilleur score, parce qu'on y revient pour progresser.
   */
  checkpoints: Record<string, { avant?: number; apres?: number }>;
}

const empty: Progress = {
  version: 1, name: '', xp: 0, lessons: {}, modules: [], scores: {},
  labs: [], leitner: {}, badges: [], checkpoints: {},
};
const KEY = 'appsec-academy-v1';

export const levels = [
  { min: 0, title: 'Recrue AppSec' },
  { min: 600, title: 'Security Champion' },
  { min: 1800, title: 'AppSec Engineer' },
  { min: 4000, title: 'Senior AppSec' },
  { min: 7000, title: 'Product Security Lead' },
  { min: 11000, title: 'Architecte DevSecOps' },
];

export function levelFor(xp: number) {
  let i = 0;
  levels.forEach((l, idx) => { if (xp >= l.min) i = idx; });
  const next = levels[i + 1];
  const pct = next ? ((xp - levels[i].min) / (next.min - levels[i].min)) * 100 : 100;
  return { index: i + 1, title: levels[i].title, next, pct };
}

export const lessonXp = (level: 1 | 2 | 3) => (level === 1 ? 20 : level === 2 ? 30 : 40);
export const MODULE_XP = 100;
export const LAB_XP = 10;

export interface BadgeDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  check: (p: Progress) => boolean;
}

const blockDone = (p: Progress, block: string) =>
  modules.filter((m) => m.block === block).every((m) => p.modules.includes(m.id));
const lessonsDone = (p: Progress) => Object.keys(p.lessons).length;

export const badgeDefs: BadgeDef[] = [
  { id: 'first-lesson', name: 'Premiers pas', description: 'Valider une première leçon', icon: 'Footprints', check: (p) => lessonsDone(p) >= 1 },
  { id: 'ten-lessons', name: 'Sur la lancée', description: 'Valider 10 leçons', icon: 'BookOpen', check: (p) => lessonsDone(p) >= 10 },
  { id: 'fifty-lessons', name: 'Assidu', description: 'Valider 50 leçons', icon: 'GraduationCap', check: (p) => lessonsDone(p) >= 50 },
  { id: 'first-module', name: 'Module bouclé', description: 'Valider un module entier', icon: 'CircleCheck', check: (p) => p.modules.length >= 1 },
  ...blocks.filter((b) => b.id !== 'Z').map((b) => ({
    id: `block-${b.id}`, name: `Bloc ${b.id} : ${b.title}`, description: `Valider tous les modules du bloc ${b.id}`, icon: 'Award',
    check: (p: Progress) => blockDone(p, b.id),
  })),
  { id: 'advanced', name: 'Chercheur', description: 'Valider le module Web avancé', icon: 'Microscope', check: (p) => p.modules.includes('m03') },
  { id: 'lab-rat', name: 'Rat de laboratoire', description: 'Cocher 10 labs pratiques', icon: 'FlaskConical', check: (p) => p.labs.length >= 10 },
  { id: 'lab-master', name: 'Praticien', description: 'Cocher 40 labs pratiques', icon: 'Target', check: (p) => p.labs.length >= 40 },
  { id: 'leitner', name: 'Mémoire longue', description: 'Faire monter 25 cartes en boîte 4 ou plus', icon: 'Brain', check: (p) => Object.values(p.leitner).filter((c) => c.box >= 4).length >= 25 },
  { id: 'triage', name: 'Trieur', description: 'Obtenir 80 % ou plus au Triage Room', icon: 'ListChecks', check: (p) => (p.scores['triage-room'] ?? 0) >= 80 },
  { id: 'csp', name: 'CSP stricte', description: 'Obtenir 100 % au CSP Builder', icon: 'ShieldCheck', check: (p) => (p.scores['csp-builder'] ?? 0) >= 100 },
  { id: 'diplomat', name: 'Diplomate', description: 'Obtenir 80 % ou plus au jeu Pushback', icon: 'Handshake', check: (p) => (p.scores['pushback'] ?? 0) >= 80 },
  { id: 'reviewer', name: 'Relecteur', description: 'Obtenir 80 % ou plus au Design Review Simulator', icon: 'PenTool', check: (p) => (p.scores['design-review'] ?? 0) >= 80 },
  { id: 'identity', name: 'Gardien des jetons', description: 'Obtenir 80 % ou plus à l’OAuth Flow Debugger', icon: 'KeyRound', check: (p) => (p.scores['oauth-debugger'] ?? 0) >= 80 },
  { id: 'code-review', name: 'Œil de lynx', description: 'Obtenir 80 % ou plus au Diff Review', icon: 'FileCode', check: (p) => (p.scores['diff-review'] ?? 0) >= 80 },
  { id: 'perfect', name: 'Sans faute', description: 'Obtenir 100 % à un jeu', icon: 'Star', check: (p) => Object.values(p.scores).some((s) => s >= 100) },
  { id: 'gamer', name: 'Touche-à-tout', description: 'Jouer à tous les jeux disponibles', icon: 'Gamepad2', check: (p) => availableGames.every((g) => g.id in p.scores) },
  { id: 'capstone', name: 'Architecte', description: 'Terminer le capstone', icon: 'Trophy', check: (p) => p.modules.includes('m20') },
  { id: 'exams', name: 'Certifié maison', description: 'Réussir les quatre examens de bloc', icon: 'BadgeCheck', check: (p) => ['a', 'b', 'c', 'd'].every((b) => (p.scores[`exam-${b}`] ?? 0) >= 75) },
  { id: 'final-exam', name: 'Diplômé AppSec', description: 'Réussir l’examen final', icon: 'ScrollText', check: (p) => (p.scores['exam-final'] ?? 0) >= 75 },
  { id: 'csslp-mock', name: 'Prêt pour le CSSLP', description: 'Réussir l’examen blanc CSSLP', icon: 'GraduationCap', check: (p) => (p.scores['exam-csslp'] ?? 0) >= 70 },
];

interface Toast { id: number; title: string; text: string; kind: 'xp' | 'badge' }

interface Ctx {
  progress: Progress;
  completeLesson: (moduleId: string, lessonId: string, xp: number, writtenLessons: string[]) => void;
  recordScore: (gameId: string, pct: number) => void;
  recordExam: (examId: string, pct: number, xp: number) => void;
  recordCheckpoint: (moduleId: string, phase: 'avant' | 'apres', pct: number) => void;
  toggleLab: (labId: string) => void;
  reviewCard: (cardId: string, correct: boolean) => void;
  setName: (name: string) => void;
  importProgress: (raw: string) => string | null;
  reset: () => void;
  toasts: Toast[];
}

const ProgressContext = createContext<Ctx | null>(null);

function sanitize(raw: unknown): Progress | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<Progress>;
  if (r.version !== 1) return null;
  return {
    ...empty,
    ...r,
    lessons: { ...(r.lessons ?? {}) },
    modules: Array.isArray(r.modules) ? r.modules : [],
    scores: { ...(r.scores ?? {}) },
    labs: Array.isArray(r.labs) ? r.labs : [],
    leitner: { ...(r.leitner ?? {}) },
    badges: Array.isArray(r.badges) ? r.badges : [],
    // Absente des profils enregistrés avant l'arrivée des diagnostics.
    checkpoints: { ...(r.checkpoints ?? {}) },
  } as Progress;
}

function load(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    return (raw && sanitize(JSON.parse(raw))) || empty;
  } catch {
    return empty;
  }
}

const today = () => new Date().toISOString().slice(0, 10);
const addDays = (days: number) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
export const LEITNER_INTERVALS = [0, 1, 2, 4, 8, 16]; // en jours, par boîte (1 à 5)

export function ProgressProvider({ children }: { children: ReactNode }) {
  const [progress, setProgress] = useState<Progress>(load);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  const pushToast = useCallback((t: Omit<Toast, 'id'>) => {
    const id = ++toastId.current;
    setToasts((ts) => [...ts, { ...t, id }]);
    setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), 3800);
  }, []);

  // Applique une mise à jour, attribue les nouveaux badges et affiche les notifications.
  const update = useCallback((fn: (p: Progress) => Progress, xpToast?: { amount: number; reason: string }) => {
    setProgress((prev) => {
      const next = fn(prev);
      if (next === prev) return prev;
      const earned = badgeDefs.filter((b) => !next.badges.includes(b.id) && b.check(next));
      const final = earned.length ? { ...next, badges: [...next.badges, ...earned.map((b) => b.id)], xp: next.xp + earned.length * 50 } : next;
      setTimeout(() => {
        if (xpToast && xpToast.amount > 0) pushToast({ kind: 'xp', title: `+${xpToast.amount} XP`, text: xpToast.reason });
        earned.forEach((b) => pushToast({ kind: 'badge', title: `Badge débloqué : ${b.name}`, text: `${b.description} (+50 XP)` }));
      }, 0);
      return final;
    });
  }, [pushToast]);

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(progress)); } catch { /* stockage indisponible */ }
  }, [progress]);

  // Valide une leçon ; le module est validé quand toutes ses leçons rédigées le sont.
  const completeLesson = useCallback((moduleId: string, lessonId: string, xp: number, writtenLessons: string[]) => {
    const key = lessonKey(moduleId, lessonId);
    if (progress.lessons[key]) return;
    const lessons = { ...progress.lessons, [key]: today() };
    const mod = modules.find((m) => m.id === moduleId);
    const moduleDone = !!mod && !progress.modules.includes(moduleId)
      && mod.lessons.length === writtenLessons.length
      && writtenLessons.every((l) => lessons[lessonKey(moduleId, l)]);
    const gain = xp + (moduleDone ? MODULE_XP : 0);
    update((p) => (p.lessons[key] ? p : {
      ...p,
      xp: p.xp + gain,
      lessons: { ...p.lessons, [key]: today() },
      modules: moduleDone ? [...p.modules, moduleId] : p.modules,
    }), { amount: gain, reason: moduleDone ? 'Leçon et module validés' : 'Leçon validée' });
  }, [update, progress.lessons, progress.modules]);

  // L'XP n'est accordée que sur l'amélioration du meilleur score.
  const recordScore = useCallback((gameId: string, pct: number) => {
    const game = games.find((g) => g.id === gameId);
    const prevBest = progress.scores[gameId] ?? 0;
    const gain = game && pct > prevBest ? Math.round(((pct - prevBest) / 100) * game.xp) : 0;
    update((p) => ({ ...p, xp: p.xp + gain, scores: { ...p.scores, [gameId]: Math.max(p.scores[gameId] ?? 0, pct) } }),
      { amount: gain, reason: gain ? 'Nouveau record !' : '' });
  }, [update, progress.scores]);

  // Les examens stockent leur meilleur score dans `scores` (clés « exam-* ») ; l'XP est accordée sur l'amélioration.
  const recordExam = useCallback((examId: string, pct: number, xp: number) => {
    const prevBest = progress.scores[examId] ?? 0;
    const gain = pct > prevBest ? Math.round(((pct - prevBest) / 100) * xp) : 0;
    update((p) => ({ ...p, xp: p.xp + gain, scores: { ...p.scores, [examId]: Math.max(p.scores[examId] ?? 0, pct) } }),
      { amount: gain, reason: gain ? 'Examen réussi !' : '' });
  }, [update, progress.scores]);

  /**
   * Le diagnostic d'entrée et de sortie d'un module.
   *
   * Aucune XP n'est attribuée, et c'est le cœur du dispositif : récompenser le
   * diagnostic d'entrée pousserait à bien y répondre avant d'avoir lu quoi que
   * ce soit, ce qui détruirait la seule chose qu'on cherche à mesurer — l'écart
   * entre les deux passages. On mesure, on ne note pas.
   */
  const recordCheckpoint = useCallback((moduleId: string, phase: 'avant' | 'apres', pct: number) => {
    update((p) => {
      const actuel = p.checkpoints[moduleId] ?? {};
      // « Avant » ne se réécrit jamais : une ligne de départ qui bouge ne sert à rien.
      if (phase === 'avant' && actuel.avant !== undefined) return p;
      const maj = phase === 'avant'
        ? { ...actuel, avant: pct }
        : { ...actuel, apres: Math.max(actuel.apres ?? 0, pct) };
      return { ...p, checkpoints: { ...p.checkpoints, [moduleId]: maj } };
    });
  }, [update]);

  const toggleLab = useCallback((labId: string) => {
    const had = progress.labs.includes(labId);
    update((p) => ({
      ...p,
      xp: had ? p.xp : p.xp + LAB_XP,
      labs: had ? p.labs.filter((l) => l !== labId) : [...p.labs, labId],
    }), had ? undefined : { amount: LAB_XP, reason: 'Lab terminé' });
  }, [update, progress.labs]);

  const reviewCard = useCallback((cardId: string, correct: boolean) => {
    update((p) => {
      const box = correct ? Math.min((p.leitner[cardId]?.box ?? 0) + 1, 5) : 1;
      return { ...p, xp: p.xp + (correct ? 1 : 0), leitner: { ...p.leitner, [cardId]: { box, due: addDays(LEITNER_INTERVALS[box]) } } };
    });
  }, [update]);

  const setName = useCallback((name: string) => setProgress((p) => ({ ...p, name })), []);
  const reset = useCallback(() => setProgress(empty), []);

  const importProgress = useCallback((raw: string) => {
    try {
      const parsed = sanitize(JSON.parse(raw));
      if (!parsed) return 'Fichier non reconnu : ce n’est pas une sauvegarde AppSec Academy.';
      setProgress(parsed);
      return null;
    } catch {
      return 'Fichier illisible : JSON invalide.';
    }
  }, []);

  return (
    <ProgressContext.Provider value={{ progress, completeLesson, recordScore, recordExam, recordCheckpoint, toggleLab, reviewCard, setName, importProgress, reset, toasts }}>
      {children}
    </ProgressContext.Provider>
  );
}

export function useProgress() {
  const ctx = useContext(ProgressContext);
  if (!ctx) throw new Error('useProgress hors du ProgressProvider');
  return ctx;
}

export const isDue = (c: LeitnerCard | undefined) => !c || c.due <= today();

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ApiError, api, messageOf } from '../lib/api';
import { setFlusher } from '../lib/flush';
import { Screen } from '../components/ui';
import { mergeProgress } from './merge';
import { migrateV1, type V1 } from './migrate';
import { useSession } from './session';
import { seriesKey } from '../lib/series';
import { blocks, lessonKey, lessonSeries, modules } from '../data/catalog';
import { availableGames, games } from '../data/games';
import { exams } from '../data/exams';
import { openModules } from '../lib/content';

export interface LeitnerCard { box: number; due: string }

export interface Progress {
  version: 2;
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
  version: 2, name: '', xp: 0, lessons: {}, modules: [], scores: {},
  labs: [], leitner: {}, badges: [], checkpoints: {},
};
/** Taille au-delà de laquelle le serveur refuse le document (256 Ko) : on prévient avant d'envoyer. */
const MAX_DOC_CHARS = 250_000;
const SAVE_DELAY_MS = 800;
const RETRY_DELAY_MS = 10_000;

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

/**
 * Score minimal d'une série exigée par une leçon. Finir la série ne suffit
 * pas : on la finit aussi en cliquant au hasard.
 */
export const SERIES_PASS = 70;

/** Les séries exigées par une leçon qui ne sont pas encore réussies. */
export const pendingSeries = (p: Progress, moduleId: string, lessonId: string) =>
  lessonSeries(moduleId, lessonId).filter((r) => (p.scores[seriesKey(r.game, r.series)] ?? 0) < SERIES_PASS);

export interface BadgeDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  check: (p: Progress) => boolean;
}

const blockDone = (p: Progress, block: string) => {
  const open = openModules().filter((m) => m.block === block);
  return open.length > 0 && open.every((m) => p.modules.includes(m.id));
};
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
  { id: 'exams', name: 'Certifié maison', description: 'Réussir tous les examens de bloc', icon: 'BadgeCheck', check: (p) => exams.filter((e) => e.kind === 'block').every((e) => (p.scores[e.id] ?? 0) >= e.pass) },
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
  /** Les trois actions qui touchent le serveur renvoient un message d'erreur, ou `null` si tout s'est bien passé. */
  setName: (name: string) => Promise<string | null>;
  importProgress: (raw: string) => Promise<string | null>;
  reset: () => Promise<string | null>;
  /** État de l'enregistrement sur le serveur. */
  sync: SyncState;
  toasts: Toast[];
}

export type SyncState = 'saved' | 'saving' | 'offline' | 'rejected';

const ProgressContext = createContext<Ctx | null>(null);

export function sanitize(raw: unknown): Progress | null {
  if (!raw || typeof raw !== 'object') return null;
  const doc = raw as { version?: unknown };
  // Format 1 : avant la restructuration en blocs A à H, des clés de leçons ont bougé.
  const r = (doc.version === 1 ? migrateV1(raw as V1) : raw) as Partial<Progress>;
  if (r.version !== 2) return null;
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

const today = () => new Date().toISOString().slice(0, 10);
const addDays = (days: number) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
export const LEITNER_INTERVALS = [0, 1, 2, 4, 8, 16]; // en jours, par boîte (1 à 5)

type Loaded = { doc: Progress; rev: number };

/** Charge la progression depuis le serveur, puis monte le moteur. Rien ne s'affiche avant : pas de flash d'un état vide. */
export function ProgressProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Loaded | { error: string } | null>(null);

  const load = useCallback(async () => {
    setState(null);
    try {
      const r = await api<{ data: unknown; rev: number }>('/progress');
      if (r.data === null) return setState({ doc: empty, rev: r.rev });
      const doc = sanitize(r.data);
      // On ne recouvre jamais une progression qu'on ne sait pas lire : elle serait perdue.
      setState(doc ? { doc, rev: r.rev } : { error: 'Ta progression enregistrée a un format que cette version ne comprend pas. Elle n’a pas été modifiée.' });
    } catch (e) {
      setState({ error: messageOf(e) });
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (!state) return <Screen><p className="muted" role="status">Chargement de ta progression…</p></Screen>;
  if ('error' in state) {
    return (
      <Screen>
        <p role="alert">{state.error}</p>
        <button className="btn primary sm" onClick={() => void load()}>Réessayer</button>
      </Screen>
    );
  }
  return <ProgressEngine initial={state.doc} initialRev={state.rev}>{children}</ProgressEngine>;
}

function ProgressEngine({ initial, initialRev, children }: { initial: Progress; initialRev: number; children: ReactNode }) {
  const { user, setName: setAccountName } = useSession();
  const [doc, setProgress] = useState<Progress>(initial);
  // Le nom vit dans le compte, pas dans le document de progression : tout le reste de l'app lit `progress.name`.
  const progress = useMemo(() => ({ ...doc, name: user?.name ?? '' }), [doc, user?.name]);
  const [sync, setSync] = useState<SyncState>('saved');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  const latest = useRef(doc);
  latest.current = doc;
  const revRef = useRef(initialRev);
  /** La dernière version que le serveur a confirmée. Égale à `doc` : rien à envoyer. */
  const savedRef = useRef<Progress>(initial);
  const running = useRef<Promise<void> | null>(null);
  const saveTimer = useRef<number>();
  const retryTimer = useRef<number>();

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

  const wire = (p: Progress): Progress => ({ ...p, name: '' });

  /**
   * Envoie l'état courant tant qu'il diffère de ce que le serveur a confirmé. Sur un conflit (409, un autre
   * onglet ou appareil a écrit entre-temps) on fusionne avec la version du serveur puis on réessaie.
   * Ne rejette jamais : une panne réseau passe en « hors ligne » et réessaie toute seule.
   */
  const run = useCallback(async () => {
    setSync('saving');
    let conflicts = 0;
    try {
      while (latest.current !== savedRef.current) {
        const sent = latest.current;
        try {
          const r = await api<{ rev: number }>('/progress', { method: 'PUT', body: { data: wire(sent), rev: revRef.current } });
          revRef.current = r.rev;
          savedRef.current = sent;
        } catch (e) {
          if (!(e instanceof ApiError && e.status === 409 && conflicts++ < 5)) throw e;
          const theirs = sanitize((e.body as { data: unknown }).data);
          revRef.current = (e.body as { rev: number }).rev;
          if (theirs) {
            const merged = mergeProgress(latest.current, theirs);
            latest.current = merged;
            setProgress(merged);
          }
        }
      }
      setSync('saved');
    } catch (e) {
      // Un refus définitif (document trop gros ou invalide) ne se répare pas en réessayant.
      const definitive = e instanceof ApiError && e.status >= 400 && e.status < 500 && ![401, 409, 429].includes(e.status);
      setSync(definitive ? 'rejected' : 'offline');
      if (!definitive) {
        window.clearTimeout(retryTimer.current);
        retryTimer.current = window.setTimeout(() => void flush(), RETRY_DELAY_MS);
      }
    }
  }, []);

  const flush = useCallback((): Promise<void> => {
    window.clearTimeout(saveTimer.current);
    if (!running.current) running.current = run().finally(() => { running.current = null; });
    return running.current;
  }, [run]);

  // Enregistrement différé : on regroupe les actions rapprochées (un jeu qui enchaîne les réponses).
  useEffect(() => {
    if (doc === savedRef.current) return;
    // Dès qu'il y a du nouveau, l'indicateur ne doit plus annoncer « enregistré » : hors ligne, on garde l'alerte.
    setSync((state) => (state === 'offline' ? state : 'saving'));
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => void flush(), SAVE_DELAY_MS);
    return () => window.clearTimeout(saveTimer.current);
  }, [doc, flush]);

  useEffect(() => () => window.clearTimeout(retryTimer.current), []);

  // Avant de fermer la session, on laisse partir ce qui est en attente.
  useEffect(() => {
    setFlusher(flush);
    return () => setFlusher(null);
  }, [flush]);

  // À la fermeture de l'onglet, meilleur effort : la requête survit à la page (keepalive, limité à ~64 Ko).
  useEffect(() => {
    const leave = () => {
      if (latest.current === savedRef.current) return;
      const body = { data: wire(latest.current), rev: revRef.current };
      api('/progress', { method: 'PUT', body, keepalive: JSON.stringify(body).length < 60_000 }).catch(() => undefined);
    };
    const onHidden = () => { if (document.visibilityState === 'hidden') leave(); };
    const onOnline = () => void flush();
    window.addEventListener('pagehide', leave);
    document.addEventListener('visibilitychange', onHidden);
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('pagehide', leave);
      document.removeEventListener('visibilitychange', onHidden);
      window.removeEventListener('online', onOnline);
    };
  }, [flush]);

  // Valide une leçon ; le module est validé quand toutes ses leçons rédigées le sont.
  // L'interface désactive déjà le bouton tant que des séries exigées manquent ;
  // la garde est ici pour qu'aucun autre appelant ne la contourne.
  const completeLesson = useCallback((moduleId: string, lessonId: string, xp: number, writtenLessons: string[]) => {
    const key = lessonKey(moduleId, lessonId);
    if (progress.lessons[key] || pendingSeries(progress, moduleId, lessonId).length) return;
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
  }, [update, progress]);

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

  const setName = useCallback(async (name: string) => {
    try { await setAccountName(name); return null; } catch (e) { return messageOf(e); }
  }, [setAccountName]);

  /** Efface la progression côté serveur, puis repart de `next`. Le serveur décide : on ne change l'état local qu'ensuite. */
  const replaceAll = useCallback(async (next: Progress): Promise<string | null> => {
    window.clearTimeout(saveTimer.current);
    try {
      await running.current;
      await api('/progress', { method: 'DELETE' });
    } catch (e) {
      return messageOf(e);
    }
    revRef.current = 0;
    savedRef.current = empty;
    latest.current = next;
    setProgress(next);      // `next` ≠ `empty` : l'effet d'enregistrement prend le relais
    setSync('saved');
    return null;
  }, []);

  const reset = useCallback(() => replaceAll(empty), [replaceAll]);

  const importProgress = useCallback(async (raw: string) => {
    let parsed: Progress | null;
    try { parsed = sanitize(JSON.parse(raw)); } catch { return 'Fichier illisible : JSON invalide.'; }
    if (!parsed) return 'Fichier non reconnu : ce n’est pas une sauvegarde AppSec Academy.';
    if (JSON.stringify(parsed).length > MAX_DOC_CHARS) return 'Sauvegarde trop volumineuse pour être importée.';
    return replaceAll(parsed);
  }, [replaceAll]);

  return (
    <ProgressContext.Provider value={{ progress, completeLesson, recordScore, recordExam, recordCheckpoint, toggleLab, reviewCard, setName, importProgress, reset, sync, toasts }}>
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

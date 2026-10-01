import { Fragment, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Difficulty, Feedback, GameHeader, ScoreScreen } from './ui';
import { seriesKey, type SeriesInfo, type SeriesSet } from '../lib/series';
import { useProgress } from '../store/progress';

// Écran de choix de série, commun à tous les jeux.
//
// Le jeu lui-même ne change presque pas : il reçoit ses items au lieu de les
// tirer, et appelle `finish` au lieu de `recordScore`. Le composant de partie
// est remonté à chaque série et à chaque « Rejouer » (clé), donc son état
// repart de zéro sans qu'il ait à le gérer.
//
// `?serie=<id>` ouvre directement une série : c'est le lien que suit une leçon
// qui l'exige.

export interface SeriesPlay<T> {
  items: T[];
  info: SeriesInfo;
  /** Enregistre le score du jeu (XP) et le record de la série. */
  finish: (pct: number) => void;
  /** Rejoue la série : mêmes items, rebattus seulement pour une série « Mêlée ». */
  retry: () => void;
  /** Retour au choix des séries. */
  back: () => void;
}

export function SeriesGame<T>({ gameId, title, intro, set, unit = 'scénarios', children }: {
  gameId: string;
  title: string;
  intro: ReactNode;
  set: SeriesSet<T>;
  /** Ce que compte une série : « extraits », « cartes », « crise »… */
  unit?: string | ((n: number) => string);
  children: (play: SeriesPlay<T>) => ReactNode;
}) {
  const { progress, recordScore } = useProgress();
  const [params, setParams] = useSearchParams();
  const [chosen, setChosen] = useState<string | null>(() => {
    const wanted = params.get('serie');
    return set.list.some((s) => s.id === wanted) ? wanted : null;
  });
  const [salt, setSalt] = useState(0);

  const items = useMemo(() => (chosen ? set.items(chosen, salt) : []), [chosen, salt, set]);
  const info = set.list.find((s) => s.id === chosen);
  const label = (n: number) => `${n} ${typeof unit === 'function' ? unit(n) : unit}`;

  if (!chosen || !info) {
    return (
      <section className="block">
        <div className="game-wrap wide">
          <GameHeader id={gameId} title={title} current={0} total={0} counter={false} />
          <p className="q-hint" style={{ marginTop: 0 }}>{intro}</p>
          <div className="grid g2" style={{ gap: 10, marginTop: 16 }}>
            {set.list.map((s) => {
              const best = progress.scores[seriesKey(gameId, s.id)];
              return (
                <button key={s.id} className="option sink-series" onClick={() => { setSalt(0); setChosen(s.id); }}>
                  <span>
                    <b style={{ fontWeight: 500 }}>
                      {s.title} <Difficulty level={s.level} label={false} />
                    </b>
                    <span className="desc">{s.text}</span>
                    <span className="label" style={{ marginTop: 6, display: 'block' }}>
                      {s.shuffleEachTime ? `${label(s.count)}, tirés à chaque partie` : label(s.count)}
                      {best !== undefined && <> · record {best} %</>}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>
    );
  }

  const back = () => {
    setChosen(null);
    setSalt(0);
    // Sans ça, recharger la page rouvrirait la série qu'on vient de quitter.
    if (params.has('serie')) setParams({}, { replace: true });
  };

  // Une série vide signale un pool trop étroit : mieux vaut le dire que de
  // planter à l'affichage du premier item.
  if (!items.length) {
    return (
      <section className="block">
        <div className="game-wrap wide">
          <GameHeader id={gameId} title={title} current={0} total={0} counter={false} />
          <Feedback good={false}>
            <b>Cette série n’a pas encore de contenu.</b>
            <div className="small muted">Le pool ne contient pas assez d’items de ce niveau.</div>
          </Feedback>
          <div className="actions"><button className="btn" onClick={back}>
            <ArrowLeft size={16} /> Choisir une autre série
          </button></div>
        </div>
      </section>
    );
  }

  const play: SeriesPlay<T> = {
    items,
    info,
    finish: (pct) => { recordScore(gameId, pct); recordScore(seriesKey(gameId, info.id), pct); },
    retry: () => setSalt((s) => s + 1),
    back,
  };

  return <Fragment key={`${chosen}:${salt}`}>{children(play)}</Fragment>;
}

/** L'écran de fin d'une série : score, « Rejouer », et retour au choix. */
export function SeriesScore<T>({ play, pct, title, children }: {
  play: SeriesPlay<T>; pct: number; title: string; children?: ReactNode;
}) {
  return (
    <section className="block">
      <ScoreScreen pct={pct} title={`${title} · ${play.info.title}`} onRetry={play.retry}>{children}</ScoreScreen>
      <div className="actions" style={{ marginTop: 12 }}>
        <button className="btn" onClick={play.back}>
          <ArrowLeft size={16} /> Changer de série
        </button>
      </div>
    </section>
  );
}

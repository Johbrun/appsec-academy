import { useMemo, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Feedback, GameHeader, ScoreScreen, shuffle } from '../components/ui';
import { classes, dataItems, type DataClass } from '../data/game-datamap';
import { useProgress } from '../store/progress';

/** Dix données par partie : le pool en garde autant pour la suivante. */
const ROUNDS = 10;

export default function DataMap() {
  const { recordScore } = useProgress();
  const [seed, setSeed] = useState(0);
  const rounds = useMemo(() => shuffle(dataItems).slice(0, ROUNDS).map((d) => {
    const order = shuffle(d.controls.map((_, k) => k));
    return { ...d, order };
  }), [seed]);
  const [i, setI] = useState(0);
  const [cls, setCls] = useState<DataClass | null>(null);
  const [ctrl, setCtrl] = useState<number | null>(null);
  const [points, setPoints] = useState(0);
  const [done, setDone] = useState(false);

  const d = rounds[i];
  const label = (id: DataClass) => classes.find((c) => c.id === id)!.label;

  const pickClass = (c: DataClass) => {
    if (cls) return;
    setCls(c);
    if (c === d.cls) setPoints(points + 0.5);
  };
  const pickCtrl = (k: number) => {
    if (ctrl !== null) return;
    setCtrl(k);
    if (k === d.best) setPoints(points + 0.5);
  };
  const next = () => {
    if (i + 1 >= rounds.length) {
      setDone(true);
      recordScore('data-map', Math.round((points / rounds.length) * 100));
    } else { setI(i + 1); setCls(null); setCtrl(null); }
  };
  const restart = () => { setSeed(seed + 1); setI(0); setCls(null); setCtrl(null); setPoints(0); setDone(false); };

  if (done) {
    const pct = Math.round((points / rounds.length) * 100);
    return <section className="block"><ScoreScreen pct={pct} title="Cartographie des données terminée" onRetry={restart} /></section>;
  }

  return (
    <section className="block">
      <div className="game-wrap wide">
        <GameHeader id="data-map" title="Data Map" current={i} total={rounds.length} extra={<span className="tag mono">{points.toString().replace('.', ',')} pts</span>} />
        <div className="card q-card">
          <span className="label">Donnée de Novafact</span>
          <h3 style={{ marginTop: 10 }}>{d.name}</h3>
          <p className="muted small" style={{ margin: '8px 0 0' }}>{d.detail}</p>
        </div>
        <p className="q-hint">1. Quelle classe ?</p>
        <div className="grid g2" style={{ gap: 10 }}>
          {classes.map((c) => {
            const state = cls ? (c.id === d.cls ? 'correct' : c.id === cls ? 'wrong' : '') : '';
            return (
              <button key={c.id} className={`option ${state}`} disabled={!!cls} onClick={() => pickClass(c.id)}>
                <span><b style={{ fontWeight: 500 }}>{c.label}</b><span className="desc">{c.hint}</span></span>
              </button>
            );
          })}
        </div>
        {cls && (
          <>
            <Feedback good={cls === d.cls}><b>{cls === d.cls ? 'Bonne classe.' : `Plutôt : ${label(d.cls)}.`}</b></Feedback>
            <p className="q-hint">2. Quel contrôle est le plus important pour cette donnée ?</p>
            <div className="grid" style={{ gap: 10 }}>
              {d.order.map((k, pos) => {
                const state = ctrl !== null ? (k === d.best ? 'correct' : k === ctrl ? 'wrong' : '') : '';
                return (
                  <button key={k} className={`option ${state}`} disabled={ctrl !== null} onClick={() => pickCtrl(k)}>
                    <span className="key">{String.fromCharCode(65 + pos)}</span>
                    <span>{d.controls[k]}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}
        {ctrl !== null && (
          <>
            <Feedback good={ctrl === d.best}><b>{ctrl === d.best ? 'Exact.' : 'Pas le plus important.'}</b><div className="small muted">{d.why}</div></Feedback>
            <div className="actions"><button className="btn primary" onClick={next}>Continuer <ArrowRight size={16} className="arrow" /></button></div>
          </>
        )}
      </div>
    </section>
  );
}

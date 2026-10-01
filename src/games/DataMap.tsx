import { useMemo, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Feedback, GameHeader, shuffle } from '../components/ui';
import { SeriesGame, SeriesScore, type SeriesPlay } from '../components/Series';
import { classes, dataMapSeries, type DataClass, type DataItem } from '../data/game-datamap';

export default function DataMap() {
  return (
    <SeriesGame
      gameId="data-map"
      title="Data Map"
      set={dataMapSeries}
      unit="données"
      intro="Huit séries, de la donnée qui se classe à son nom à celle dont la classe tient à un détail : trois colonnes qui ré-identifient, un dérivé qui hérite de sa source, un secret déguisé en configuration."
    >
      {(play) => <Round play={play} />}
    </SeriesGame>
  );
}

function Round({ play }: { play: SeriesPlay<DataItem> }) {
  const rounds = useMemo(() => play.items.map((d) => ({ ...d, order: shuffle(d.controls.map((_, k) => k)) })), [play.items]);
  const [i, setI] = useState(0);
  const [cls, setCls] = useState<DataClass | null>(null);
  const [ctrl, setCtrl] = useState<number | null>(null);
  const [points, setPoints] = useState(0);
  const [done, setDone] = useState(false);

  const d = rounds[i];
  const label = (id: DataClass) => classes.find((c) => c.id === id)!.label;
  const fmt = (n: number) => n.toString().replace('.', ',');

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
      play.finish(Math.round((points / rounds.length) * 100));
      setDone(true);
    } else { setI(i + 1); setCls(null); setCtrl(null); }
  };

  if (done) {
    const pct = Math.round((points / rounds.length) * 100);
    return <SeriesScore play={play} pct={pct} title={`${fmt(points)} / ${rounds.length} points`} />;
  }

  return (
    <section className="block">
      <div className="game-wrap wide">
        <GameHeader
          id="data-map"
          title={`Data Map · ${play.info.title}`}
          level={play.info.level}
          current={i}
          total={rounds.length}
          extra={<span className="tag mono">{fmt(points)} pts</span>}
        />
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

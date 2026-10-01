import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Feedback, GameHeader } from '../components/ui';
import { SeriesGame, SeriesScore, type SeriesPlay } from '../components/Series';
import { stages, toolSeries, type Stage, type ToolCard } from '../data/game-tools';

export default function RightTool() {
  return (
    <SeriesGame
      gameId="right-tool"
      title="Right Tool, Right Stage"
      set={toolSeries}
      unit="outils"
      intro="Neuf séries, des outils dont la description dit le moment jusqu’aux contre-emplois, où le nom de l’outil appelle la mauvaise étape. Une étape défendable mais moins bonne rapporte un demi-point."
    >
      {(play) => <Round play={play} />}
    </SeriesGame>
  );
}

function Round({ play }: { play: SeriesPlay<ToolCard> }) {
  const rounds = play.items;
  const [i, setI] = useState(0);
  const [pick, setPick] = useState<Stage | null>(null);
  const [placed, setPlaced] = useState<{ tool: string; stage: Stage }[]>([]);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  const r = rounds[i];
  const points = (s: Stage) => (s === r.best ? 1 : r.ok?.includes(s) ? 0.5 : 0);

  const choose = (s: Stage) => {
    if (pick) return;
    setPick(s);
    setScore(score + points(s));
    setPlaced([...placed, { tool: r.tool, stage: r.best }]);
  };
  const next = () => {
    if (i + 1 >= rounds.length) {
      play.finish(Math.round((score / rounds.length) * 100));
      setDone(true);
    } else { setI(i + 1); setPick(null); }
  };

  if (done) return <SeriesScore play={play} pct={Math.round((score / rounds.length) * 100)} title={`${score.toString().replace('.', ',')} / ${rounds.length} outils bien placés`} />;

  return (
    <section className="block">
      <div className="game-wrap wide">
        <GameHeader id="right-tool" title={`Right Tool, Right Stage · ${play.info.title}`} level={play.info.level} current={i} total={rounds.length} extra={<span className="tag mono">{score.toString().replace('.', ',')} pts</span>} />
        <div className="pipeline">
          {stages.map((s) => (
            <div key={s.id} className={`pipe-stage ${pick ? (s.id === r.best ? 'best' : r.ok?.includes(s.id) ? 'ok' : s.id === pick ? 'ko' : '') : ''}`}>
              <div className="pipe-head"><b>{s.name}</b><span className="small dim">{s.hint}</span></div>
              <div className="pipe-tools">
                {placed.filter((p) => p.stage === s.id).map((p) => <span key={p.tool} className="pipe-chip">{p.tool}</span>)}
              </div>
            </div>
          ))}
        </div>
        <div className="card q-card">
          <span className="label">Outil {i + 1}</span>
          <h3 style={{ marginTop: 12 }}>{r.tool}</h3>
          <p className="muted small" style={{ margin: '6px 0 0' }}>{r.what}</p>
        </div>
        <p className="q-hint">À quelle étape du pipeline cet outil apporte-t-il le plus ?</p>
        <div className="stage-row">
          {stages.map((s) => {
            const cls = pick ? (s.id === r.best ? 'correct' : s.id === pick ? (points(s.id) > 0 ? 'selected' : 'wrong') : '') : '';
            return (
              <button key={s.id} className={`option ${cls}`} disabled={!!pick} onClick={() => choose(s.id)}>
                <span><b style={{ fontWeight: 500 }}>{s.name}</b><span className="desc">{s.hint}</span></span>
              </button>
            );
          })}
        </div>
        {pick && (
          <>
            <Feedback good={points(pick) > 0}>
              <b>{pick === r.best ? 'Exactement.' : points(pick) > 0 ? `Acceptable (0,5 pt) : l’étape idéale est « ${stages.find((s) => s.id === r.best)!.name} ».` : `Plutôt : ${stages.find((s) => s.id === r.best)!.name}.`}</b>
              <div className="small muted">{r.why}</div>
            </Feedback>
            <div className="actions"><button className="btn primary" onClick={next}>Continuer <ArrowRight size={16} className="arrow" /></button></div>
          </>
        )}
      </div>
    </section>
  );
}

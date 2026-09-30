import { useMemo, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Feedback, GameHeader, ScoreScreen, shuffle } from '../components/ui';
import { stages, toolCards, type Stage } from '../data/game-tools';
import { useProgress } from '../store/progress';

const ROUNDS = 10;

export default function RightTool() {
  const { recordScore } = useProgress();
  const [seed, setSeed] = useState(0);
  const rounds = useMemo(() => shuffle(toolCards).slice(0, ROUNDS), [seed]);
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
      setDone(true);
      recordScore('right-tool', Math.round((score / rounds.length) * 100));
    } else { setI(i + 1); setPick(null); }
  };
  const restart = () => { setSeed(seed + 1); setI(0); setPick(null); setPlaced([]); setScore(0); setDone(false); };

  if (done) return <section className="block"><ScoreScreen pct={Math.round((score / rounds.length) * 100)} title={`${score.toString().replace('.', ',')} / ${rounds.length} outils bien placés`} onRetry={restart} /></section>;

  return (
    <section className="block">
      <div className="game-wrap wide">
        <GameHeader id="right-tool" title="Right Tool, Right Stage" current={i} total={rounds.length} extra={<span className="tag mono">{score.toString().replace('.', ',')} pts</span>} />
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

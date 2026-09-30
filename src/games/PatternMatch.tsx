import { useMemo, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Feedback, GameHeader, ScoreScreen, shuffle } from '../components/ui';
import { antiPatterns, patternNames, situations } from '../data/game-patterns';
import { useProgress } from '../store/progress';

const ROUNDS = 10;

export default function PatternMatch() {
  const { recordScore } = useProgress();
  const [seed, setSeed] = useState(0);
  const rounds = useMemo(() => shuffle(situations).slice(0, ROUNDS).map((s) => {
    const isAnti = antiPatterns.includes(s.answer);
    const sameFamily = patternNames.filter((p) => p !== s.answer && antiPatterns.includes(p) === isAnti);
    const other = patternNames.filter((p) => p !== s.answer && antiPatterns.includes(p) !== isAnti);
    const distractors = [...shuffle(sameFamily).slice(0, 2), ...shuffle(other).slice(0, 1)];
    return { ...s, options: shuffle([s.answer, ...distractors]) };
  }), [seed]);
  const [i, setI] = useState(0);
  const [pick, setPick] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  const r = rounds[i];
  const choose = (p: string) => {
    if (pick) return;
    setPick(p);
    if (p === r.answer) setScore(score + 1);
  };
  const next = () => {
    if (i + 1 >= rounds.length) {
      setDone(true);
      recordScore('pattern-match', Math.round((score / rounds.length) * 100));
    } else { setI(i + 1); setPick(null); }
  };
  const restart = () => { setSeed(seed + 1); setI(0); setPick(null); setScore(0); setDone(false); };

  if (done) return <section className="block"><ScoreScreen pct={Math.round((score / rounds.length) * 100)} title={`${score} / ${rounds.length} patterns reconnus`} onRetry={restart} /></section>;

  return (
    <section className="block">
      <div className="game-wrap">
        <GameHeader id="pattern-match" title="Pattern Match" current={i} total={rounds.length} extra={<span className="tag mono">Score {score}</span>} />
        <div className="card q-card">
          <span className="label">Situation de conception</span>
          <h3 style={{ marginTop: 12 }}>{r.text}</h3>
        </div>
        <p className="q-hint">Quel pattern (ou anti-pattern) de Kohnfelder décrit le mieux cette situation ?</p>
        <div className="grid g2" style={{ gap: 10 }}>
          {r.options.map((p, k) => {
            const cls = pick ? (p === r.answer ? 'correct' : p === pick ? 'wrong' : '') : '';
            return (
              <button key={p} className={`option ${cls}`} disabled={!!pick} onClick={() => choose(p)}>
                <span className="key">{String.fromCharCode(65 + k)}</span>
                <span><b style={{ fontWeight: 500 }}>{p}</b><span className="desc">{antiPatterns.includes(p) ? 'Anti-pattern' : 'Pattern'}</span></span>
              </button>
            );
          })}
        </div>
        {pick && (
          <>
            <Feedback good={pick === r.answer}>
              <b>{pick === r.answer ? 'Exact.' : `C’était : ${r.answer}.`}</b>
              <div className="small muted">{r.why}</div>
            </Feedback>
            <div className="actions"><button className="btn primary" onClick={next}>Continuer <ArrowRight size={16} className="arrow" /></button></div>
          </>
        )}
      </div>
    </section>
  );
}

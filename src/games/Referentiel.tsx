import { useEffect, useMemo, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Feedback, GameHeader, ScoreScreen, shuffle } from '../components/ui';
import { refItems, referentiels } from '../data/game-referentiel';
import { useProgress } from '../store/progress';

const ROUNDS = 15;
const SECONDS = 120;

export default function Referentiel() {
  const { recordScore } = useProgress();
  const [seed, setSeed] = useState(0);
  const rounds = useMemo(() => shuffle(refItems).slice(0, ROUNDS), [seed]);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [left, setLeft] = useState(SECONDS);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (done) return;
    if (left <= 0) { finish(score); return; }
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [left, done]);

  function finish(final: number) {
    setDone(true);
    recordScore('referentiel', Math.round((final / ROUNDS) * 100));
  }

  const r = rounds[i];
  const pick = (id: string) => {
    if (picked) return;
    setPicked(id);
    if (id === r.ref) setScore(score + 1);
  };
  const next = () => {
    if (i + 1 >= rounds.length) finish(score);
    else { setI(i + 1); setPicked(null); }
  };
  const restart = () => { setSeed(seed + 1); setI(0); setScore(0); setPicked(null); setLeft(SECONDS); setDone(false); };

  if (done) return <section className="block"><ScoreScreen pct={Math.round((score / ROUNDS) * 100)} title={`${score} / ${ROUNDS} bien rangés`} onRetry={restart} /></section>;

  const right = referentiels.find((x) => x.id === r.ref)!;
  return (
    <section className="block">
      <div className="game-wrap">
        <GameHeader id="referentiel" title="Quel référentiel ?" current={i} total={rounds.length}
          extra={<span className={`timer ${left <= 15 ? 'urgent' : ''}`}><span className="led pulse" />{Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}</span>} />
        <div className="card q-card center">
          <span className="label">Risque ou chapitre</span>
          <h2 style={{ margin: '14px 0 0' }}>{r.label}</h2>
        </div>
        <p className="q-hint">Dans quel référentiel OWASP le trouve-t-on ?</p>
        <div className="grid g2" style={{ gap: 10 }}>
          {referentiels.map((ref, k) => {
            const cls = picked ? (ref.id === r.ref ? 'correct' : ref.id === picked ? 'wrong' : '') : '';
            return (
              <button key={ref.id} className={`option ${cls}`} disabled={!!picked} onClick={() => pick(ref.id)}>
                <span className="key">{k + 1}</span>
                <span><b style={{ fontWeight: 500 }}>{ref.short}</b><span className="desc">{ref.name}</span></span>
              </button>
            );
          })}
        </div>
        {picked && (
          <>
            <Feedback good={picked === r.ref}>
              <b>{picked === r.ref ? 'Exact.' : `Non : ${right.name}.`}</b>
              <div className="small muted">{r.note}</div>
            </Feedback>
            <div className="actions"><button className="btn primary" onClick={next}>Continuer <ArrowRight size={16} className="arrow" /></button></div>
          </>
        )}
      </div>
    </section>
  );
}

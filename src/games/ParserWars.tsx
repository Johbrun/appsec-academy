import { useMemo, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Feedback, GameHeader, ScoreScreen, shuffle } from '../components/ui';
import { parserScenarios, type ParserOption } from '../data/game-parsers';
import { useProgress } from '../store/progress';

type Stage = 'divergence' | 'impact' | 'fix';
const stages: Stage[] = ['divergence', 'impact', 'fix'];
const questions: Record<Stage, string> = {
  divergence: 'Où les deux composants divergent-ils ?',
  impact: 'Quelle est la conséquence ?',
  fix: 'Quel réglage supprime le problème ?',
};

/** Six chaînes par partie, trois questions chacune : le pool en garde pour la suivante. */
const ROUNDS = 6;

export default function ParserWars() {
  const { recordScore } = useProgress();
  const [seed, setSeed] = useState(0);
  const rounds = useMemo(() => shuffle(parserScenarios).slice(0, ROUNDS).map((s) => ({
    ...s, divergence: shuffle(s.divergence), impact: shuffle(s.impact), fix: shuffle(s.fix),
  })), [seed]);
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<Partial<Record<Stage, number>>>({});
  const [points, setPoints] = useState(0);
  const [done, setDone] = useState(false);

  const s = rounds[i];
  const stage = stages.find((st) => answers[st] === undefined);
  const revealed = answers.divergence !== undefined;

  const pick = (st: Stage, k: number) => {
    if (answers[st] !== undefined) return;
    setAnswers({ ...answers, [st]: k });
    if (s[st][k].right) setPoints(points + 1 / 3);
  };
  const next = () => {
    if (i + 1 >= rounds.length) {
      setDone(true);
      recordScore('parser-wars', Math.round((points / rounds.length) * 100));
    } else { setI(i + 1); setAnswers({}); }
  };
  const restart = () => { setSeed(seed + 1); setI(0); setAnswers({}); setPoints(0); setDone(false); };

  if (done) {
    const pct = Math.round((points / rounds.length) * 100);
    return <section className="block"><ScoreScreen pct={pct} title="Divergences de parsers résolues" onRetry={restart} /></section>;
  }

  const block = (st: Stage, opts: ParserOption[]) => {
    const chosen = answers[st];
    return (
      <div key={st}>
        <p className="q-hint">{questions[st]}</p>
        <div className="grid" style={{ gap: 10 }}>
          {opts.map((o, k) => {
            const cls = chosen !== undefined ? (o.right ? 'correct' : k === chosen ? 'wrong' : '') : '';
            return (
              <button key={k} className={`option ${cls}`} disabled={chosen !== undefined} onClick={() => pick(st, k)}>
                <span className="key">{String.fromCharCode(65 + k)}</span>
                <span>{o.text}{chosen !== undefined && (o.right || k === chosen) && <span className="desc">{o.why}</span>}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <section className="block">
      <div className="game-wrap wide">
        <GameHeader id="parser-wars" title="Parser Wars" current={i} total={rounds.length} extra={<span className="tag mono">{Math.round(points * 3)} / {rounds.length * 3}</span>} />
        <div className="card q-card">
          <span className="label">Scénario</span>
          <h3 style={{ marginTop: 10 }}>{s.title}</h3>
          <p className="muted small" style={{ margin: '8px 0 0' }}>{s.input}</p>
        </div>
        <div className="parser-chain">
          {s.chain.map((c, k) => (
            <div key={c.name} className="parser-node-wrap">
              {k > 0 && <span className="parser-arrow">→</span>}
              <div className={`parser-node ${revealed ? 'revealed' : ''}`}>
                <b>{c.name}</b>
                <span className="small">{revealed ? c.reads : 'Interprétation masquée'}</span>
              </div>
            </div>
          ))}
        </div>
        {stages.filter((st) => st === stage || answers[st] !== undefined).map((st) => block(st, s[st]))}
        {!stage && (
          <>
            <Feedback good={stages.every((st) => s[st][answers[st]!].right)}>
              <b>{stages.every((st) => s[st][answers[st]!].right) ? 'Divergence comprise et supprimée.' : 'Revois la divergence : c’est elle qui dicte le bon correctif.'}</b>
            </Feedback>
            <div className="actions"><button className="btn primary" onClick={next}>Continuer <ArrowRight size={16} className="arrow" /></button></div>
          </>
        )}
      </div>
    </section>
  );
}

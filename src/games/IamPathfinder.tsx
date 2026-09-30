import { useMemo, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Feedback, GameHeader, ScoreScreen, shuffle } from '../components/ui';
import { CodeBlock } from '../components/Code';
import { pathAudits } from '../data/game-pathfinder';
import { useProgress } from '../store/progress';

/** On ne joue pas tout le pool : un second passage doit encore apprendre quelque chose. */
const ROUNDS = 7;

export default function IamPathfinder() {
  const { recordScore } = useProgress();
  const [seed, setSeed] = useState(0);
  const rounds = useMemo(() => shuffle(pathAudits).slice(0, ROUNDS).map((a) => ({ ...a, options: shuffle(a.fixes) })), [seed]);
  const [i, setI] = useState(0);
  const [sid, setSid] = useState<string | null>(null);
  const [fix, setFix] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  const r = rounds[i];
  const total = rounds.length * 2;

  const pickSid = (s: string) => { if (sid) return; setSid(s); if (s === r.risky) setScore((x) => x + 1); };
  const pickFix = (f: string) => { if (fix) return; setFix(f); if (f === r.fixes[0]) setScore((x) => x + 1); };
  const next = () => {
    if (i + 1 >= rounds.length) {
      setDone(true);
      recordScore('iam-pathfinder', Math.round((score / total) * 100));
    } else { setI(i + 1); setSid(null); setFix(null); }
  };
  const restart = () => { setSeed(seed + 1); setI(0); setSid(null); setFix(null); setScore(0); setDone(false); };

  if (done) return <section className="block"><ScoreScreen pct={Math.round((score / total) * 100)} title={`${score} / ${total} : chemins trouvés et coupés`} onRetry={restart} /></section>;

  return (
    <section className="block">
      <div className="game-wrap wide">
        <GameHeader id="iam-pathfinder" title="IAM Privesc Pathfinder" current={i} total={rounds.length} extra={<span className="tag mono">{score} / {total}</span>} />
        <div className="card q-card">
          <span className="label mono">{r.role}</span>
          <p className="muted small" style={{ margin: '8px 0 0' }}>{r.purpose}</p>
        </div>
        <p className="q-hint">{sid ? 'Quelle correction coupe ce chemin sans casser l’usage ?' : 'Audit : quelle instruction permet à ce rôle d’obtenir plus de droits que prévu ?'}</p>
        <div className="grid" style={{ gap: 10 }}>
          {r.statements.map((st) => {
            const cls = sid ? (st.sid === r.risky ? 'correct' : st.sid === sid ? 'wrong' : '') : '';
            return (
              <button key={st.sid} className={`stmt ${cls}`} disabled={!!sid} onClick={() => pickSid(st.sid)}>
                <CodeBlock code={st.json} lang="json" file={st.sid} />
              </button>
            );
          })}
        </div>
        {sid && (
          <>
            <Feedback good={sid === r.risky}><b>{sid === r.risky ? 'C’est bien elle.' : `L’instruction à risque : ${r.risky}.`}</b></Feedback>
            <div className="path-chain" aria-label="Chemin d’escalade">
              {r.path.map((p, k) => (
                <span key={k} className="path-node-wrap">
                  <span className={`path-node ${k === r.path.length - 1 ? 'end' : ''}`}>{p}</span>
                  {k < r.path.length - 1 && <span className="parser-arrow">→</span>}
                </span>
              ))}
            </div>
            <div className="grid" style={{ gap: 10 }}>
              {r.options.map((f, k) => {
                const cls = fix ? (f === r.fixes[0] ? 'correct' : f === fix ? 'wrong' : '') : '';
                return (
                  <button key={f} className={`option ${cls}`} disabled={!!fix} onClick={() => pickFix(f)}>
                    <span className="key">{String.fromCharCode(65 + k)}</span>
                    <span><b style={{ fontWeight: 500 }}>{f}</b></span>
                  </button>
                );
              })}
            </div>
          </>
        )}
        {fix && (
          <>
            <Feedback good={fix === r.fixes[0]}>
              <b>{fix === r.fixes[0] ? 'Chemin coupé.' : `La correction : ${r.fixes[0]}.`}</b>
              <div className="small muted">{r.why}</div>
            </Feedback>
            <div className="actions"><button className="btn primary" onClick={next}>{i + 1 >= rounds.length ? 'Voir le score' : 'Rôle suivant'} <ArrowRight size={16} className="arrow" /></button></div>
          </>
        )}
      </div>
    </section>
  );
}

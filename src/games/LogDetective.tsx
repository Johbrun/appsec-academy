import { useMemo, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Feedback, GameHeader, ScoreScreen, shuffle } from '../components/ui';
import { logCases } from '../data/game-logs';
import { useProgress } from '../store/progress';

const ROUNDS = 6;

export default function LogDetective() {
  const { recordScore } = useProgress();
  const [seed, setSeed] = useState(0);
  const rounds = useMemo(() => shuffle(logCases).slice(0, ROUNDS).map((c) => ({
    ...c,
    attacks: shuffle([c.attack, ...c.attackOptions]),
    techniques: shuffle([{ id: c.technique, name: c.techniqueName }, ...c.techniqueOptions]),
  })), [seed]);
  const [i, setI] = useState(0);
  const [attack, setAttack] = useState<string | null>(null);
  const [tech, setTech] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  const r = rounds[i];
  const total = rounds.length * 2;

  const pickAttack = (a: string) => { if (attack) return; setAttack(a); if (a === r.attack) setScore((s) => s + 1); };
  const pickTech = (t: string) => { if (tech) return; setTech(t); if (t === r.technique) setScore((s) => s + 1); };
  const next = () => {
    if (i + 1 >= rounds.length) {
      setDone(true);
      recordScore('log-detective', Math.round((score / total) * 100));
    } else { setI(i + 1); setAttack(null); setTech(null); }
  };
  const restart = () => { setSeed(seed + 1); setI(0); setAttack(null); setTech(null); setScore(0); setDone(false); };

  if (done) return <section className="block"><ScoreScreen pct={Math.round((score / total) * 100)} title={`${score} / ${total} : attaques identifiées`} onRetry={restart} /></section>;

  return (
    <section className="block">
      <div className="game-wrap wide">
        <GameHeader id="log-detective" title="Log Detective AppSec" current={i} total={rounds.length} extra={<span className="tag mono">{score} / {total}</span>} />
        <div className="card q-card">
          <span className="label">Contexte</span>
          <p className="muted small" style={{ margin: '8px 0 0' }}>{r.context}</p>
        </div>
        <div className="log-view">
          {r.events.map((e, k) => (
            <div key={k} className={`log-line ${attack && e.suspect ? 'flagged' : ''}`}>
              <span className="log-src mono">{e.source}</span>
              <span className="log-msg mono">{e.line}</span>
            </div>
          ))}
        </div>
        <p className="q-hint">{attack ? 'Quelle technique ATT&CK correspond ?' : 'Quelle attaque ces événements décrivent-ils ?'}</p>
        <div className="grid g2" style={{ gap: 10 }}>
          {r.attacks.map((a, k) => {
            const cls = attack ? (a === r.attack ? 'correct' : a === attack ? 'wrong' : '') : '';
            return (
              <button key={a} className={`option ${cls}`} disabled={!!attack} onClick={() => pickAttack(a)}>
                <span className="key">{String.fromCharCode(65 + k)}</span>
                <span><b style={{ fontWeight: 500 }}>{a}</b></span>
              </button>
            );
          })}
        </div>
        {attack && (
          <>
            <Feedback good={attack === r.attack}><b>{attack === r.attack ? 'Bien vu.' : `C’était : ${r.attack}.`}</b>{attack && <span className="small muted" style={{ display: 'block', marginTop: 4 }}>Les lignes suspectes sont surlignées ci-dessus.</span>}</Feedback>
            <div className="grid g2" style={{ gap: 10, marginTop: 16 }}>
              {r.techniques.map((t) => {
                const cls = tech ? (t.id === r.technique ? 'correct' : t.id === tech ? 'wrong' : '') : '';
                return (
                  <button key={t.id} className={`option ${cls}`} disabled={!!tech} onClick={() => pickTech(t.id)}>
                    <span className="key mono">{t.id}</span>
                    <span><b style={{ fontWeight: 500 }}>{t.name}</b></span>
                  </button>
                );
              })}
            </div>
          </>
        )}
        {tech && (
          <>
            <Feedback good={tech === r.technique}>
              <b>{tech === r.technique ? 'Exact.' : `La technique : ${r.technique} ${r.techniqueName}.`}</b>
              <div className="small muted">{r.why}</div>
            </Feedback>
            <div className="actions"><button className="btn primary" onClick={next}>{i + 1 >= rounds.length ? 'Voir le score' : 'Cas suivant'} <ArrowRight size={16} className="arrow" /></button></div>
          </>
        )}
      </div>
    </section>
  );
}

import { useMemo, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Feedback, GameHeader, ScoreScreen, shuffle } from '../components/ui';
import { CodeBlock } from '../components/Code';
import { patchScenarios } from '../data/game-patches';
import { moduleById, pad2 } from '../data/catalog';
import { useProgress } from '../store/progress';

const ROUNDS = 6;

export default function PatchOrPwn() {
  const { recordScore } = useProgress();
  const [seed, setSeed] = useState(0);
  const rounds = useMemo(() => shuffle(patchScenarios).slice(0, ROUNDS).map((s) => ({ ...s, options: shuffle(s.options) })), [seed]);
  const [i, setI] = useState(0);
  const [tries, setTries] = useState<number[]>([]);
  const [points, setPoints] = useState(0);
  const [done, setDone] = useState(false);

  const r = rounds[i];
  const solved = tries.some((k) => r.options[k].holds);
  const revealed = solved || tries.length >= 2;

  const pick = (k: number) => {
    if (revealed || tries.includes(k)) return;
    const nt = [...tries, k];
    setTries(nt);
    if (r.options[k].holds) setPoints(points + (nt.length === 1 ? 1 : 0.5));
  };
  const next = () => {
    if (i + 1 >= rounds.length) {
      setDone(true);
      recordScore('patch-or-pwn', Math.round((points / rounds.length) * 100));
    } else { setI(i + 1); setTries([]); }
  };
  const restart = () => { setSeed(seed + 1); setI(0); setTries([]); setPoints(0); setDone(false); };

  if (done) {
    const pct = Math.round((points / rounds.length) * 100);
    return <section className="block"><ScoreScreen pct={pct} title={`${points.toFixed(1).replace('.0', '')} / ${rounds.length} correctifs tenus`} onRetry={restart} /></section>;
  }

  const mod = moduleById(r.module);
  const last = tries.length ? r.options[tries[tries.length - 1]] : null;

  return (
    <section className="block">
      <div className="game-wrap wide">
        <GameHeader id="patch-or-pwn" title="Patch or Pwn" current={i} total={rounds.length} extra={<span className="tag mono">{points.toFixed(1).replace('.0', '')} pts</span>} />
        <div className="card q-card">
          <div className="row between" style={{ marginBottom: 12 }}>
            <span className="label">M{pad2(mod?.num ?? 0)} · {mod?.short}</span>
            <span className="label">{tries.length === 0 ? '100 % au premier essai' : revealed ? 'Corrigé' : '50 % au second essai'}</span>
          </div>
          <h3>{r.title}</h3>
          <p className="muted small" style={{ margin: '8px 0 0' }}>{r.context}</p>
        </div>
        <CodeBlock code={r.vulnerable} lang={r.lang} tone="bad" hl="1" />
        <p className="q-hint">Quel correctif tient face à un attaquant ?</p>
        <div className="grid" style={{ gap: 10 }}>
          {r.options.map((o, k) => {
            const tried = tries.includes(k);
            const cls = tried ? (o.holds ? 'correct' : 'wrong') : revealed && o.holds ? 'correct' : '';
            return (
              <button key={k} className={`option ${cls}`} disabled={revealed || tried} onClick={() => pick(k)}>
                <span className="key">{String.fromCharCode(65 + k)}</span>
                <span>
                  <b style={{ fontWeight: 500 }}>{o.label}</b>
                  {o.code && <span className="desc mono" style={{ whiteSpace: 'pre-wrap' }}>{o.code}</span>}
                  {(tried || revealed) && <span className="desc" style={{ marginTop: 6 }}>{o.why}</span>}
                </span>
              </button>
            );
          })}
        </div>
        {last && !revealed && !last.holds && (
          <Feedback good={false}><b>Contourné.</b><div className="small muted">{last.why} Retente ta chance.</div></Feedback>
        )}
        {revealed && (
          <>
            <Feedback good={solved}>
              <b>{solved ? (tries.length === 1 ? 'Correctif solide, du premier coup.' : 'Correctif solide.') : 'Les deux choix se contournaient.'}</b>
              <div className="small muted">{r.options.find((o) => o.holds)!.why}</div>
            </Feedback>
            <div className="actions"><button className="btn primary" onClick={next}>Continuer <ArrowRight size={16} className="arrow" /></button></div>
          </>
        )}
      </div>
    </section>
  );
}

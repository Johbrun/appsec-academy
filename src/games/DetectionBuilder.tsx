import { useMemo, useState } from 'react';
import { ArrowRight, Check, Plus } from 'lucide-react';
import { GameHeader, ScoreScreen, Feedback } from '../components/ui';
import { detScenarios } from '../data/game-detection';
import { useProgress } from '../store/progress';

export default function DetectionBuilder() {
  const { recordScore } = useProgress();
  const [seed, setSeed] = useState(0);
  const scenarios = detScenarios;
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<string[]>([]);
  const [tested, setTested] = useState(false);
  const [scores, setScores] = useState<number[]>([]);
  const [done, setDone] = useState(false);

  const sc = scenarios[i];
  const conds = sc.conditions.filter((c) => picked.includes(c.id));

  const matched = useMemo(() => sc.events.filter((e) => conds.length > 0 && conds.every((c) => c.test(e.fields))), [sc, picked, tested]);
  const totalMal = sc.events.filter((e) => e.malicious).length;
  const tp = matched.filter((e) => e.malicious).length;
  const fp = matched.length - tp;
  const precision = matched.length ? tp / matched.length : 0;
  const recall = totalMal ? tp / totalMal : 0;
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;

  const toggle = (id: string) => { if (tested) return; setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id])); };
  const test = () => { setTested(true); setScores([...scores, Math.round(f1 * 100)]); };
  const next = () => {
    if (i + 1 >= scenarios.length) {
      setDone(true);
      recordScore('detection-builder', Math.round(scores.reduce((a, b) => a + b, 0) / scores.length));
    } else { setI(i + 1); setPicked([]); setTested(false); }
  };
  const restart = () => { setSeed(seed + 1); setI(0); setPicked([]); setTested(false); setScores([]); setDone(false); };

  if (done) {
    const pct = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    return <section className="block"><ScoreScreen pct={pct} title={`${scenarios.length} règles construites`} onRetry={restart} /></section>;
  }

  const matches = (e: typeof sc.events[number]) => conds.length > 0 && conds.every((c) => c.test(e.fields));

  return (
    <section className="block">
      <div className="game-wrap wide">
        <GameHeader id="detection-builder" title="Detection Builder" current={i} total={scenarios.length} counter={false} />
        <div className="card q-card">
          <span className="label">{sc.title}</span>
          <p className="muted small" style={{ margin: '8px 0 0' }}>{sc.goal}</p>
        </div>

        <div className="det-layout">
          <div>
            <span className="label">Blocs de condition (combinés par ET)</span>
            <div className="grid" style={{ gap: 8, marginTop: 10 }}>
              {sc.conditions.map((c) => (
                <button key={c.id} className={`det-cond ${picked.includes(c.id) ? 'on' : ''}`} disabled={tested} onClick={() => toggle(c.id)}>
                  <span className="det-check">{picked.includes(c.id) ? <Check size={13} /> : <Plus size={13} />}</span>
                  <code className="mono small">{c.text}</code>
                </button>
              ))}
            </div>
            {!tested && (
              <div className="gauges" style={{ marginTop: 18 }}>
                <div className="gauge"><div className="csp-dir"><span className="small">Précision (aperçu)</span><span className="mono small">{Math.round(precision * 100)} %</span></div><div className="gauge-track"><div className="gauge-fill" style={{ width: `${precision * 100}%` }} /></div></div>
                <div className="gauge"><div className="csp-dir"><span className="small">Rappel (aperçu)</span><span className="mono small">{Math.round(recall * 100)} %</span></div><div className="gauge-track"><div className="gauge-fill" style={{ width: `${recall * 100}%` }} /></div></div>
              </div>
            )}
          </div>
          <div>
            <span className="label">Événements de test</span>
            <div className="det-events">
              {sc.events.map((e) => {
                const m = matches(e);
                const state = tested ? (m && e.malicious ? 'tp' : m && !e.malicious ? 'fp' : !m && e.malicious ? 'fn' : 'tn') : m ? 'match' : '';
                return (
                  <div key={e.id} className={`det-event ${state}`}>
                    <span className={`det-dot ${e.malicious ? 'mal' : 'ben'}`} title={e.malicious ? 'malveillant' : 'légitime'} />
                    <span className="small">{e.label}</span>
                    {tested && <span className="mono det-tag">{state.toUpperCase()}</span>}
                    {!tested && m && <span className="mono det-tag match">match</span>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {!tested ? (
          <div className="actions between">
            <span className="small dim">{matched.length} événement{matched.length > 1 ? 's' : ''} filtré{matched.length > 1 ? 's' : ''}{fp > 0 ? ` · dont ${fp} légitime${fp > 1 ? 's' : ''}` : ''}</span>
            <button className="btn primary" disabled={conds.length === 0} onClick={test}>Tester la règle <ArrowRight size={16} className="arrow" /></button>
          </div>
        ) : (
          <>
            <div className="kv" style={{ maxWidth: 520, margin: '18px auto 8px' }}>
              <div><span className="label">Précision</span><b>{Math.round(precision * 100)} %</b></div>
              <div><span className="label">Rappel</span><b>{Math.round(recall * 100)} %</b></div>
            </div>
            <Feedback good={f1 >= 0.85}>
              <b>Score F1 : {Math.round(f1 * 100)} %{picked.length === sc.idealConditions.length && sc.idealConditions.every((c) => picked.includes(c)) ? ' — règle optimale.' : ''}</b>
              <div className="small muted">{sc.why}</div>
            </Feedback>
            <div className="actions"><button className="btn primary" onClick={next}>{i + 1 >= scenarios.length ? 'Voir le bilan' : 'Règle suivante'} <ArrowRight size={16} className="arrow" /></button></div>
          </>
        )}
      </div>
    </section>
  );
}

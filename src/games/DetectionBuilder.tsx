import { useState } from 'react';
import { ArrowRight, Check, Plus } from 'lucide-react';
import { GameHeader, Feedback } from '../components/ui';
import { SeriesGame, SeriesScore, type SeriesPlay } from '../components/Series';
import { detSeries, evaluateRule, type DetScenario } from '../data/game-detection';

export default function DetectionBuilder() {
  return (
    <SeriesGame
      gameId="detection-builder"
      title="Detection Builder"
      set={detSeries}
      unit={(n) => (n > 1 ? 'règles' : 'règle')}
      intro="Sept séries, du champ unique qui suffit à la règle à seuil qui corrèle plusieurs actions. Chaque règle se teste sur un échantillon d’événements au format ECS, légitimes compris : le score F1 combine précision et rappel."
    >
      {(play) => <Round play={play} />}
    </SeriesGame>
  );
}

function Round({ play }: { play: SeriesPlay<DetScenario> }) {
  const scenarios = play.items;
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<string[]>([]);
  const [threshold, setThreshold] = useState<number | null>(null);
  const [tested, setTested] = useState(false);
  const [scores, setScores] = useState<number[]>([]);
  const [done, setDone] = useState(false);

  const sc = scenarios[i];
  const { ids, matched, fp, precision, recall, f1 } = evaluateRule(sc, picked, threshold);
  const optimal = picked.length === sc.idealConditions.length
    && sc.idealConditions.every((c) => picked.includes(c))
    && (sc.threshold ? threshold === sc.threshold.ideal : true);

  const toggle = (id: string) => { if (tested) return; setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id])); };
  const test = () => { setTested(true); setScores([...scores, Math.round(f1 * 100)]); };
  const next = () => {
    if (i + 1 >= scenarios.length) {
      setDone(true);
      play.finish(Math.round(scores.reduce((a, b) => a + b, 0) / scores.length));
    } else { setI(i + 1); setPicked([]); setThreshold(null); setTested(false); }
  };

  if (done) {
    const pct = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    return <SeriesScore play={play} pct={pct} title={`${scenarios.length} règle${scenarios.length > 1 ? 's' : ''} construite${scenarios.length > 1 ? 's' : ''}`} />;
  }

  const shown = (v: string | number | undefined) => (v === undefined || v === '' ? '—' : String(v));

  return (
    <section className="block">
      <div className="game-wrap wide">
        <GameHeader
          id="detection-builder"
          title={`Detection Builder · ${play.info.title}`}
          level={play.info.level}
          current={i}
          total={scenarios.length}
          counter={false}
        />
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
            {sc.threshold && (
              <div style={{ marginTop: 16 }}>
                <span className="label">Seuil : au moins N {sc.threshold.label}</span>
                <div className="chips" style={{ marginTop: 8 }}>
                  {[null, ...sc.threshold.available].map((t) => (
                    <button key={t ?? 0} className={`chip ${threshold === t ? 'on' : ''}`} disabled={tested} onClick={() => setThreshold(t)}>
                      {t === null ? 'Aucun' : `≥ ${t}`}
                    </button>
                  ))}
                </div>
              </div>
            )}
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
                const m = ids.has(e.id);
                const state = tested ? (m && e.malicious ? 'tp' : m && !e.malicious ? 'fp' : !m && e.malicious ? 'fn' : 'tn') : m ? 'match' : '';
                return (
                  <div key={e.id} className={`det-event ${state}`}>
                    <span className={`det-dot ${e.malicious ? 'mal' : 'ben'}`} title={e.malicious ? 'malveillant' : 'légitime'} />
                    <span className="small">
                      {e.label}
                      <span className="mono dim" style={{ display: 'block', fontSize: '0.68rem', marginTop: 2, wordBreak: 'break-all' }}>
                        {sc.fieldsShown.map((k) => `${k}: ${shown(e.fields[k])}`).join(' · ')}
                      </span>
                    </span>
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
            <span className="small dim">{matched} événement{matched > 1 ? 's' : ''} filtré{matched > 1 ? 's' : ''}{fp > 0 ? ` · dont ${fp} légitime${fp > 1 ? 's' : ''}` : ''}</span>
            <button className="btn primary" disabled={picked.length === 0} onClick={test}>Tester la règle <ArrowRight size={16} className="arrow" /></button>
          </div>
        ) : (
          <>
            <div className="kv" style={{ maxWidth: 520, margin: '18px auto 8px' }}>
              <div><span className="label">Précision</span><b>{Math.round(precision * 100)} %</b></div>
              <div><span className="label">Rappel</span><b>{Math.round(recall * 100)} %</b></div>
            </div>
            <Feedback good={f1 >= 0.85}>
              <b>Score F1 : {Math.round(f1 * 100)} %{optimal ? ' — règle optimale.' : ''}</b>
              {!optimal && (
                <div className="small mono" style={{ margin: '4px 0' }}>
                  Règle de référence : {sc.conditions.filter((c) => sc.idealConditions.includes(c.id)).map((c) => c.text).join(' and ')}
                  {sc.threshold ? `, seuil ≥ ${sc.threshold.ideal} ${sc.threshold.label}` : ''}
                </div>
              )}
              <div className="small muted">{sc.why}</div>
              {sc.attack && <div style={{ marginTop: 6 }}><span className="tag mono">ATT&CK {sc.attack.id} · {sc.attack.name}</span></div>}
            </Feedback>
            {sc.realCase && (
              <div className="card q-card" style={{ marginTop: 14 }}>
                <span className="label">Cas réel · {sc.realCase.title}</span>
                <p className="muted small" style={{ margin: '8px 0 0' }}>{sc.realCase.text}</p>
              </div>
            )}
            <div className="actions"><button className="btn primary" onClick={next}>{i + 1 >= scenarios.length ? 'Voir le bilan' : 'Règle suivante'} <ArrowRight size={16} className="arrow" /></button></div>
          </>
        )}
      </div>
    </section>
  );
}

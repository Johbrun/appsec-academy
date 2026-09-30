import { useState } from 'react';
import { ArrowRight, Play } from 'lucide-react';
import { Feedback, GameHeader, ScoreScreen } from '../components/ui';
import { baselineScore, bestScore, controls, dayLog, initialConfig, segments, simulate, type Config, type DayResult } from '../data/game-abuse';
import { useProgress } from '../store/progress';

const DAYS = 3;

export default function AbuseDesk() {
  const { recordScore } = useProgress();
  const [cfg, setCfg] = useState<Config>(initialConfig);
  const [day, setDay] = useState(0);
  const [result, setResult] = useState<DayResult | null>(null);
  const [ranCfg, setRanCfg] = useState<Config>(initialConfig);
  const [history, setHistory] = useState<number[]>([]);
  const [done, setDone] = useState(false);

  // 0 % = ne rien faire, 100 % = meilleur réglage possible.
  const pctOf = (r: DayResult) => Math.max(0, Math.round(((r.score - baselineScore) / (bestScore - baselineScore)) * 100));

  const run = () => {
    const r = simulate(cfg);
    setResult(r);
    setRanCfg(cfg);
    setHistory([...history, pctOf(r)]);
    setDay(day + 1);
  };
  const finish = () => {
    setDone(true);
    recordScore('abuse-desk', history[history.length - 1] ?? 0);
  };
  const restart = () => { setCfg(initialConfig); setRanCfg(initialConfig); setDay(0); setResult(null); setHistory([]); setDone(false); };

  if (done) {
    const pct = history[history.length - 1] ?? 0;
    return (
      <section className="block">
        <ScoreScreen pct={pct} title={`Journée ${DAYS} : ${pct} % du meilleur réglage possible`} onRetry={restart}>
          <p className="small muted" style={{ maxWidth: 520, margin: '0 auto 12px' }}>
            Le score pondère l’abus bloqué (60 %) et les clients épargnés (40 %). Le meilleur réglage combine des signaux qualitatifs (identifiants fuités, ATP), un ralentissement par compte, une friction à l’inscription et un quota modéré pour les nouveaux comptes.
          </p>
        </ScoreScreen>
      </section>
    );
  }

  return (
    <section className="block">
      <div className="game-wrap wide">
        <GameHeader id="abuse-desk" title="Abuse Desk" current={Math.min(day, DAYS - 1)} total={DAYS} />
        <p className="q-hint" style={{ marginTop: 0 }}>
          Tu règles les défenses anti-abus de Novafact. Chaque journée, le même trafic arrive : clients, réseaux partagés, bots et fraudeurs. Ajuste, lance la journée, lis le journal, puis corrige. C’est la troisième journée qui compte.
        </p>
        <div className="csp-layout">
          <div className="csp-editor">
            {controls.map((c) => (
              <div key={c.id} className="csp-row">
                <div className="csp-dir"><span><b style={{ fontWeight: 500 }}>{c.name}</b> <span className="small dim">· {c.where}</span></span></div>
                <div className="chips">
                  {c.options.map((o, k) => (
                    <button key={o} className={`chip ${cfg[c.id] === k ? 'on' : ''}`} disabled={day >= DAYS} onClick={() => setCfg({ ...cfg, [c.id]: k })}>{o}</button>
                  ))}
                </div>
                <span className="small dim">{c.hint}</span>
              </div>
            ))}
          </div>
          <div className="csp-tests">
            <span className="label">Trafic de la journée</span>
            {segments.map((s) => {
              const v = result ? result.effect[s.id] : 0;
              const bad = s.kind === 'abuse' ? v < 0.6 : v >= 0.3;
              return (
                <div key={s.id} className="gauge abuse-seg">
                  <div className="csp-dir">
                    <span className="small"><b style={{ fontWeight: 500 }}>{s.name}</b> <span className="dim">· {s.kind === 'abuse' ? 'abus' : 'légitime'}</span></span>
                    <span className="mono small" style={{ color: result ? (bad ? 'var(--ko)' : 'var(--ok)') : 'var(--ink-4)' }}>
                      {result ? `${Math.round(v * 100)} % ${s.kind === 'abuse' ? 'bloqué' : 'gêné'}` : '…'}
                    </span>
                  </div>
                  <div className="gauge-track"><div className="gauge-fill" style={{ width: `${Math.round(v * 100)}%`, background: result ? (bad ? 'var(--ko)' : 'var(--ok)') : undefined }} /></div>
                  <span className="small dim">{s.text}</span>
                </div>
              );
            })}
            {result && <div className="kv" style={{ marginTop: 8 }}>
              <div><span className="label">Abus bloqué</span><b>{Math.round(result.blocked * 100)} %</b></div>
              <div><span className="label">Clients gênés</span><b>{Math.round(result.harmed * 100)} %</b></div>
              <div><span className="label">Score du jour</span><b>{pctOf(result)} %</b></div>
            </div>}
          </div>
        </div>

        {result && (
          <>
            <div className="section-title">Journal de la journée {day}</div>
            {dayLog(ranCfg, result).map((l, k) => <Feedback key={k} good={l.good}><span className="small">{l.text}</span></Feedback>)}
          </>
        )}

        <div className="actions between">
          <span className="small dim">{history.length ? `Scores : ${history.map((h) => `${h} %`).join(' → ')}` : 'Aucune journée jouée'}</span>
          {day < DAYS
            ? <button className="btn primary" onClick={run}><Play size={15} /> Lancer la journée {day + 1}</button>
            : <button className="btn primary" onClick={finish}>Voir le bilan <ArrowRight size={16} className="arrow" /></button>}
        </div>
      </div>
    </section>
  );
}

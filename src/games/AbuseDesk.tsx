import { useState } from 'react';
import { ArrowRight, Play } from 'lucide-react';
import { Feedback, GameHeader } from '../components/ui';
import { SeriesGame, SeriesScore, type SeriesPlay } from '../components/Series';
import {
  abuseSeries, bestOf, dayLog, failing, initialConfigOf, pctOf, simulate,
  type AbuseScenario, type Config, type DayResult,
} from '../data/game-abuse';

const DAYS = 3;

export default function AbuseDesk() {
  return (
    <SeriesGame
      gameId="abuse-desk"
      title="Abuse Desk"
      set={abuseSeries}
      unit="scénario"
      intro="Sept scénarios de trafic sur Novafact, de la page de connexion au SMS pumping. Chaque fois, trois journées pour régler les défenses : bloquer l’abus sans faire payer les clients."
    >
      {(play) => <Round play={play} />}
    </SeriesGame>
  );
}

function Round({ play }: { play: SeriesPlay<AbuseScenario> }) {
  const s = play.items[0];
  const initial = initialConfigOf(s);
  const [cfg, setCfg] = useState<Config>(initial);
  const [day, setDay] = useState(0);
  const [result, setResult] = useState<DayResult | null>(null);
  const [ranCfg, setRanCfg] = useState<Config>(initial);
  const [history, setHistory] = useState<number[]>([]);
  const [done, setDone] = useState(false);

  const run = () => {
    const r = simulate(cfg, s);
    setResult(r);
    setRanCfg(cfg);
    setHistory([...history, pctOf(s, r)]);
    setDay(day + 1);
  };
  const finish = () => {
    setDone(true);
    play.finish(history[history.length - 1] ?? 0);
  };

  if (done) {
    const pct = history[history.length - 1] ?? 0;
    const best = bestOf(s).cfg;
    return (
      <SeriesScore play={play} pct={pct} title={`Journée ${DAYS} : ${pct} % du meilleur réglage possible`}>
        <div style={{ textAlign: 'left', maxWidth: 600, margin: '0 auto 12px' }}>
          <p className="small muted">
            Le score pondère l’abus bloqué (60 %) et les clients épargnés (40 %). Meilleur réglage :{' '}
            {s.controls.filter((c) => best[c.id] > 0).map((c) => `${c.name.toLowerCase()} (${c.options[best[c.id]]})`).join(', ')}.
          </p>
          <Feedback good={pct >= 90}>
            <b>Ce qu’il fallait voir</b>
            <div className="small muted">{s.debrief}</div>
          </Feedback>
          {s.realCase && (
            <Feedback good>
              <b>Cas réel</b>
              <div className="small muted">{s.realCase}</div>
            </Feedback>
          )}
        </div>
      </SeriesScore>
    );
  }

  return (
    <section className="block">
      <div className="game-wrap wide">
        <GameHeader id="abuse-desk" title={`Abuse Desk · ${play.info.title}`} level={play.info.level}
          current={Math.min(day, DAYS - 1)} total={DAYS} />
        <p className="q-hint" style={{ marginTop: 0 }}>
          {s.context} Chaque journée, le même trafic arrive. Ajuste, lance la journée, lis le journal, puis corrige. C’est la troisième journée qui compte.
        </p>
        <div className="csp-layout">
          <div className="csp-editor">
            {s.controls.map((c) => (
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
            {s.segments.map((g) => {
              const v = result ? result.effect[g.id] : 0;
              const bad = failing(g, v);
              return (
                <div key={g.id} className="gauge abuse-seg">
                  <div className="csp-dir">
                    <span className="small"><b style={{ fontWeight: 500 }}>{g.name}</b> <span className="dim">· {g.kind === 'abuse' ? 'abus' : 'légitime'}</span></span>
                    <span className="mono small" style={{ color: result ? (bad ? 'var(--ko)' : 'var(--ok)') : 'var(--ink-4)' }}>
                      {result ? `${Math.round(v * 100)} % ${g.kind === 'abuse' ? 'bloqué' : 'gêné'}` : '…'}
                    </span>
                  </div>
                  <div className="gauge-track"><div className="gauge-fill" style={{ width: `${Math.round(v * 100)}%`, background: result ? (bad ? 'var(--ko)' : 'var(--ok)') : undefined }} /></div>
                  <span className="small dim">{g.text}</span>
                </div>
              );
            })}
            {result && <div className="kv" style={{ marginTop: 8 }}>
              <div><span className="label">Abus bloqué</span><b>{Math.round(result.blocked * 100)} %</b></div>
              <div><span className="label">Clients gênés</span><b>{Math.round(result.harmed * 100)} %</b></div>
              <div><span className="label">Score du jour</span><b>{pctOf(s, result)} %</b></div>
            </div>}
          </div>
        </div>

        {result && (
          <>
            <div className="section-title">Journal de la journée {day}</div>
            {dayLog(ranCfg, result, s).map((l, k) => <Feedback key={k} good={l.good}><span className="small">{l.text}</span></Feedback>)}
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

import { useState } from 'react';
import { ArrowRight, Play, ShieldCheck, ShieldAlert } from 'lucide-react';
import { Feedback, GameHeader } from '../components/ui';
import { SeriesGame, SeriesScore, type SeriesPlay } from '../components/Series';
import { agentSeries, owaspLlm2026, runsToCompletion, score, type Agent, type Config, type ToolId } from '../data/game-agent';

export default function AgentBlastRadius() {
  return (
    <SeriesGame
      gameId="agent-blast-radius"
      title="Agent Blast Radius"
      set={agentSeries}
      unit={(n) => (n > 1 ? 'agents' : 'agent')}
      intro="Six agents IA de Novafact, de l’assistant du support qui lit des tickets à l’assistant de l’IDE branché sur des serveurs MCP. Pour chacun, règle les outils puis rejoue ses scénarios : bloquer les injections sans casser les usages légitimes. Le fil conducteur est la lethal trifecta : données privées, contenu non fiable, canal de sortie."
    >
      {(play) => <Round play={play} />}
    </SeriesGame>
  );
}

function Round({ play }: { play: SeriesPlay<Agent> }) {
  const agents = play.items;
  const [i, setI] = useState(0);
  const agent = agents[i];
  const [cfg, setCfg] = useState<Config>(agent.defaultConfig);
  const [tested, setTested] = useState(false);
  const [best, setBest] = useState(0);
  const [results, setResults] = useState<number[]>([]);
  const [done, setDone] = useState(false);

  const s = score(cfg, agent);
  const toggle = (id: ToolId, key: 'enabled' | 'confirm' | 'tenantScoped') =>
    setCfg((c) => ({ ...c, [id]: { ...c[id], [key]: !c[id][key] } }));

  const run = () => { setTested(true); setBest((b) => Math.max(b, s.pct)); };
  const retry = () => { setTested(false); };
  const finish = () => {
    const all = [...results, Math.max(best, s.pct)];
    if (i + 1 >= agents.length) {
      play.finish(Math.round(all.reduce((a, b) => a + b, 0) / all.length));
      setResults(all);
      setDone(true);
    } else {
      setResults(all);
      setI(i + 1); setCfg(agents[i + 1].defaultConfig); setTested(false); setBest(0);
    }
  };

  if (done) {
    const pct = Math.round(results.reduce((a, b) => a + b, 0) / results.length);
    return (
      <SeriesScore play={play} pct={pct} title={agents.length > 1 ? `${agents.length} agents configurés` : `${agent.name} configuré`}>
        {agents.map((a) => (
          <p key={a.id} className="small muted" style={{ maxWidth: 560, margin: '0 auto 12px' }}>{a.solution}</p>
        ))}
      </SeriesScore>
    );
  }

  return (
    <section className="block">
      <div className="game-wrap wide">
        <GameHeader
          id="agent-blast-radius"
          title={`Agent Blast Radius · ${play.info.title}`}
          level={play.info.level}
          current={agents.length > 1 ? i : (tested ? 0.5 : 0)}
          total={agents.length}
          counter={agents.length > 1}
          extra={<span className="tag mono">{s.pct}%</span>}
        />
        <div className="card q-card">
          <span className="label">{agent.name}</span>
          <p className="muted small" style={{ margin: '8px 0 0' }}>{agent.context}</p>
        </div>
        <p className="q-hint">
          Configure les outils, puis rejoue les scénarios. Objectif : bloquer les injections sans casser les usages légitimes. Pense à la lethal trifecta : données privées, contenu non fiable, canal de sortie. Couper un pied casse la chaîne, à condition que ce ne soit pas celui dont un usage légitime a besoin.
        </p>

        <div className="agent-tools">
          {agent.tools.map((t) => {
            const c = cfg[t.id];
            return (
              <div key={t.id} className={`agent-tool ${c.enabled ? '' : 'off'}`}>
                <div className="agent-tool-head">
                  <label className="agent-switch">
                    <input type="checkbox" checked={c.enabled} onChange={() => toggle(t.id, 'enabled')} />
                    <span className="mono">{t.name}</span>
                  </label>
                  <div className="agent-caps">
                    {t.capabilities.includes('untrusted') && <span className="cap untrusted" title="Entrée non fiable">non fiable</span>}
                    {t.capabilities.includes('sensitive') && <span className="cap sensitive" title="Donnée sensible">sensible</span>}
                    {t.capabilities.includes('change') && <span className="cap change" title="Change l’état / sort">écrit</span>}
                  </div>
                </div>
                <p className="small dim m0">{t.desc}</p>
                {c.enabled && (t.writes || t.scopable) && (
                  <div className="agent-guards">
                    {t.writes && <label className={`chip ${c.confirm ? 'on' : ''}`}><input type="checkbox" hidden checked={c.confirm} onChange={() => toggle(t.id, 'confirm')} />Confirmation humaine</label>}
                    {t.scopable && <label className={`chip ${c.tenantScoped ? 'on' : ''}`}><input type="checkbox" hidden checked={c.tenantScoped} onChange={() => toggle(t.id, 'tenantScoped')} />{t.scopeLabel ?? 'Limité au tenant'}</label>}
                  </div>
                )}
                <p className="small agent-hint">{t.hint}</p>
              </div>
            );
          })}
        </div>

        {tested && (
          <>
            <div className="kv" style={{ maxWidth: 460, margin: '18px auto 6px' }}>
              <div><span className="label">Attaques bloquées</span><b>{s.blockedAttacks}/{s.totalAttacks}</b></div>
              <div><span className="label">Usages préservés</span><b>{s.keptLegit}/{s.totalLegit}</b></div>
            </div>
            <div className="section-title">Rejeu des scénarios</div>
            {agent.scenarios.map((sc) => {
              const executed = runsToCompletion(sc, cfg, agent.tools);
              const good = sc.kind === 'attack' ? !executed : executed;
              return (
                <Feedback key={sc.id} good={good}>
                  <b>{sc.kind === 'attack' ? <ShieldAlert size={13} /> : <ShieldCheck size={13} />} {sc.kind === 'attack' ? (executed ? 'Attaque réussie' : 'Attaque bloquée') : (executed ? 'Tâche exécutée' : 'Tâche bloquée')}</b>
                  {sc.unattended && <span className="tag mono" style={{ marginLeft: 8 }}>sans humain</span>}
                  <div className="small" style={{ margin: '4px 0' }}>{sc.text}</div>
                  <div className="small muted">{good ? (sc.kind === 'attack' ? sc.explainBlocked : sc.explainAllowed) : (sc.kind === 'attack' ? sc.explainAllowed : sc.explainBlocked)}</div>
                  {(sc.owasp ?? []).length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                      {sc.owasp!.map((id) => <span key={id} className="tag mono" title={owaspLlm2026[id]}>{id}:2026 {owaspLlm2026[id]}</span>)}
                    </div>
                  )}
                </Feedback>
              );
            })}
            {agent.realCase && (
              <div className="card q-card" style={{ marginTop: 14 }}>
                <span className="label">Cas réel · {agent.realCase.title}</span>
                <p className="muted small" style={{ margin: '8px 0 0' }}>{agent.realCase.text}</p>
              </div>
            )}
          </>
        )}

        <div className="actions between">
          <span className="small dim">{tested ? `Score : ${s.pct}% · meilleur ${Math.max(best, s.pct)}%` : 'Ajuste puis rejoue'}</span>
          {!tested
            ? <button className="btn primary" onClick={run}><Play size={15} /> Rejouer les scénarios</button>
            : <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn" onClick={retry}>Ajuster</button>
                <button className="btn primary" onClick={finish}>{i + 1 >= agents.length ? 'Terminer' : 'Agent suivant'} <ArrowRight size={16} className="arrow" /></button>
              </div>}
        </div>
      </div>
    </section>
  );
}

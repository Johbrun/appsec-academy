import { useState } from 'react';
import { ArrowRight, Play, ShieldCheck, ShieldAlert } from 'lucide-react';
import { Feedback, GameHeader, ScoreScreen } from '../components/ui';
import { defaultConfig, runsToCompletion, scenarios, score, tools, type Config, type ToolId } from '../data/game-agent';
import { useProgress } from '../store/progress';

export default function AgentBlastRadius() {
  const { recordScore } = useProgress();
  const [cfg, setCfg] = useState<Config>(defaultConfig);
  const [tested, setTested] = useState(false);
  const [best, setBest] = useState(0);
  const [done, setDone] = useState(false);

  const s = score(cfg);
  const toggle = (id: ToolId, key: 'enabled' | 'confirm' | 'tenantScoped') =>
    setCfg((c) => ({ ...c, [id]: { ...c[id], [key]: !c[id][key] } }));

  const run = () => { setTested(true); setBest((b) => Math.max(b, s.pct)); };
  const retry = () => { setTested(false); };
  const finish = () => { setDone(true); recordScore('agent-blast-radius', Math.max(best, s.pct)); };
  const restart = () => { setCfg(defaultConfig); setTested(false); setBest(0); setDone(false); };

  if (done) return <section className="block"><ScoreScreen pct={Math.max(best, s.pct)} title="Assistant Novafact configuré" onRetry={restart}>
    <p className="small muted" style={{ maxWidth: 520, margin: '0 auto 12px' }}>La meilleure configuration neutralise les injections en coupant un côté de la règle de deux : retirer fetch_url et l’export massif, confirmer les actions qui écrivent, limiter les lectures au tenant.</p>
  </ScoreScreen></section>;

  return (
    <section className="block">
      <div className="game-wrap wide">
        <GameHeader id="agent-blast-radius" title="Agent Blast Radius" current={tested ? 1 : 0} total={2} counter={false} extra={<span className="tag mono">{s.pct}%</span>} />
        <p className="q-hint" style={{ marginTop: 0 }}>
          Configure les outils de l’assistant Novafact, puis rejoue les scénarios. Objectif : bloquer les injections sans casser les usages légitimes. Pense à la règle de deux : évite qu’un même appel combine entrée non fiable, donnée sensible et action qui écrit ou communique.
        </p>

        <div className="agent-tools">
          {tools.map((t) => {
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
                    {t.scopable && <label className={`chip ${c.tenantScoped ? 'on' : ''}`}><input type="checkbox" hidden checked={c.tenantScoped} onChange={() => toggle(t.id, 'tenantScoped')} />Limité au tenant</label>}
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
            {scenarios.map((sc) => {
              const executed = runsToCompletion(sc, cfg);
              const good = sc.kind === 'attack' ? !executed : executed;
              return (
                <Feedback key={sc.id} good={good}>
                  <b>{sc.kind === 'attack' ? <ShieldAlert size={13} /> : <ShieldCheck size={13} />} {sc.kind === 'attack' ? (executed ? 'Attaque réussie' : 'Attaque bloquée') : (executed ? 'Tâche exécutée' : 'Tâche bloquée')}</b>
                  <div className="small" style={{ margin: '4px 0' }}>{sc.text}</div>
                  <div className="small muted">{good ? (sc.kind === 'attack' ? sc.explainBlocked : sc.explainAllowed) : (sc.kind === 'attack' ? sc.explainAllowed : sc.explainBlocked)}</div>
                </Feedback>
              );
            })}
          </>
        )}

        <div className="actions between">
          <span className="small dim">{tested ? `Score : ${s.pct}% · meilleur ${Math.max(best, s.pct)}%` : 'Ajuste puis rejoue'}</span>
          {!tested
            ? <button className="btn primary" onClick={run}><Play size={15} /> Rejouer les scénarios</button>
            : <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn" onClick={retry}>Ajuster</button>
                <button className="btn primary" onClick={finish}>Terminer <ArrowRight size={16} className="arrow" /></button>
              </div>}
        </div>
      </div>
    </section>
  );
}

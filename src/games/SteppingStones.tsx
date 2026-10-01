import { useMemo, useState } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { Feedback, GameHeader, shuffle } from '../components/ui';
import { SeriesGame, SeriesScore, type SeriesPlay } from '../components/Series';
import { stoneSeries, type StoneScenario } from '../data/game-stones';

export default function SteppingStones() {
  return (
    <SeriesGame
      gameId="stepping-stones"
      title="Stepping Stones"
      set={stoneSeries}
      unit="chaînes"
      intro="Huit séries : cinq de difficulté croissante, deux thématiques (l’argent et les factures, le cloud et le pipeline), et une « Mêlée » recomposée à chaque partie. Relie des findings « faibles » en une chaîne, puis casse-la avec un seul correctif."
    >
      {(play) => <Round play={play} />}
    </SeriesGame>
  );
}

function Round({ play }: { play: SeriesPlay<StoneScenario> }) {
  const rounds = useMemo(
    () => play.items.map((s) => ({ ...s, stones: shuffle(s.stones), fixes: shuffle(s.fixes) })),
    [play.items],
  );
  const [i, setI] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [chainChecked, setChainChecked] = useState(false);
  const [fix, setFix] = useState<number | null>(null);
  const [points, setPoints] = useState(0);
  const [done, setDone] = useState(false);

  const r = rounds[i];
  const truth = new Set(r.stones.filter((s) => s.inChain).map((s) => s.id));
  const inter = selected.filter((id) => truth.has(id)).length;
  const union = new Set([...selected, ...truth]).size;
  const chainScore = union ? inter / union : 0; // indice de Jaccard

  const toggle = (id: string) => {
    if (chainChecked) return;
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  };
  const checkChain = () => { setChainChecked(true); };
  const pickFix = (k: number) => {
    if (fix !== null) return;
    setFix(k);
    setPoints(points + chainScore * 60 + r.fixes[k].points);
  };
  const next = () => {
    if (i + 1 >= rounds.length) {
      play.finish(Math.round(points / rounds.length));
      setDone(true);
    } else { setI(i + 1); setSelected([]); setChainChecked(false); setFix(null); }
  };

  if (done) {
    const pct = Math.round(points / rounds.length);
    return <SeriesScore play={play} pct={pct} title="Chaînes reconstituées et cassées" />;
  }

  const best = Math.max(...r.fixes.map((f) => f.points));
  const byId = (id: string) => r.stones.find((s) => s.id === id)!;

  return (
    <section className="block">
      <div className="game-wrap wide">
        <GameHeader id="stepping-stones" title={`Stepping Stones · ${play.info.title}`} level={play.info.level} current={i} total={rounds.length} extra={<span className="tag mono">{Math.round(points)} pts</span>} />
        <div className="card q-card">
          <span className="label">Objectif de l’attaquant</span>
          <h3 style={{ marginTop: 10 }}>{r.goal}</h3>
          <p className="muted small" style={{ margin: '8px 0 0' }}>{r.story}</p>
          {r.real && <p className="muted small" style={{ margin: '6px 0 0', fontStyle: 'italic' }}>Inspiré d’un cas réel : {r.real}.</p>}
        </div>
        <p className="q-hint">{chainChecked ? 'Voici la chaîne.' : 'Sélectionne les findings qui, ensemble, permettent d’atteindre l’objectif.'}</p>
        <div className="stone-grid">
          {r.stones.map((s) => {
            const on = selected.includes(s.id);
            const cls = chainChecked ? (s.inChain ? (on ? 'correct' : 'selected') : on ? 'wrong' : '') : on ? 'selected' : '';
            return (
              <button key={s.id} className={`option stone ${cls}`} disabled={chainChecked} onClick={() => toggle(s.id)} aria-pressed={on}>
                <span className="cb">{on && <Check size={13} />}</span>
                <span style={{ flex: 1 }}>{s.label}</span>
                <span className={`tag sev ${s.sev === 'moyen' ? 'warn' : ''}`}>{s.sev}</span>
              </button>
            );
          })}
        </div>
        {!chainChecked && (
          <div className="actions"><button className="btn primary" disabled={selected.length === 0} onClick={checkChain}>Valider la chaîne</button></div>
        )}
        {chainChecked && (
          <>
            <Feedback good={chainScore === 1}>
              <b>{chainScore === 1 ? 'Chaîne exacte.' : `Chaîne à ${Math.round(chainScore * 100)} %.`}</b>
              <div className="chain-preview">
                {r.chainOrder.map((id, k) => (
                  <span key={id} className="row" style={{ gap: 8, display: 'inline-flex' }}>
                    {k > 0 && <span className="arrow">→</span>}
                    <span className="tag">{byId(id).label}</span>
                  </span>
                ))}
              </div>
              <div className="small muted">{r.chainStory}</div>
            </Feedback>
            <p className="q-hint">Un seul correctif ce sprint : lequel casse le mieux la chaîne ?</p>
            <div className="grid" style={{ gap: 10 }}>
              {r.fixes.map((f, k) => {
                const cls = fix !== null ? (f.points === best ? 'correct' : k === fix ? (f.points > 0 ? 'selected' : 'wrong') : '') : '';
                return (
                  <button key={k} className={`option ${cls}`} disabled={fix !== null} onClick={() => pickFix(k)}>
                    <span className="key">{String.fromCharCode(65 + k)}</span>
                    <span>
                      <b style={{ fontWeight: 500 }}>{f.label}</b>
                      {fix !== null && <span className="desc">{f.why} ({f.points} pts)</span>}
                    </span>
                  </button>
                );
              })}
            </div>
            {fix !== null && (
              <div className="actions"><button className="btn primary" onClick={next}>Continuer <ArrowRight size={16} className="arrow" /></button></div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

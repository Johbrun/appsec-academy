import { useMemo, useState } from 'react';
import { ArrowRight, RotateCcw } from 'lucide-react';
import { Feedback, GameHeader, shuffle } from '../components/ui';
import { SeriesGame, SeriesScore, type SeriesPlay } from '../components/Series';
import { chainSeries, type ChainIncident, type ChainStep } from '../data/game-attack-killchain';
import { tactic, technique } from '../data/attack';

export default function AttackKillChain() {
  return (
    <SeriesGame
      gameId="attack-killchain"
      title="Kill Chain"
      set={chainSeries}
      unit="incidents"
      intro="Six séries d’incidents réels, documentés par la victime, un enquêteur ou une autorité : Uber, CircleCI, Snowflake, Midnight Blizzard, Storm-0558, les campagnes Salesforce de 2025… Les étapes sont mélangées, chacune avec sa technique ATT&CK v19 : il faut les remettre dans l’ordre chronologique, détection comprise."
    >
      {(play) => <Round play={play} />}
    </SeriesGame>
  );
}

const tagOf = (st: ChainStep) => (st.technique ? technique(st.technique).id : 'Détection');

function Round({ play }: { play: SeriesPlay<ChainIncident> }) {
  const rounds = useMemo(() => play.items.map((inc) => ({
    ...inc,
    deck: shuffle(inc.steps.map((st, idx) => ({ st, idx }))),
  })), [play.items]);
  const [i, setI] = useState(0);
  const [order, setOrder] = useState<number[]>([]);
  const [checked, setChecked] = useState(false);
  const [scores, setScores] = useState<number[]>([]);
  const [done, setDone] = useState(false);

  const r = rounds[i];
  const complete = order.length === r.steps.length;
  const placed = order.filter((idx, pos) => idx === pos).length;

  const add = (idx: number) => { if (!checked && !order.includes(idx)) setOrder([...order, idx]); };
  const validate = () => {
    setChecked(true);
    setScores([...scores, Math.round((placed / r.steps.length) * 100)]);
  };
  const avg = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);
  const next = () => {
    if (i + 1 >= rounds.length) {
      play.finish(avg(scores));
      setDone(true);
    } else { setI(i + 1); setOrder([]); setChecked(false); }
  };

  if (done) {
    return <SeriesScore play={play} pct={avg(scores)} title={`${rounds.length} incidents reconstitués`} />;
  }

  return (
    <section className="block">
      <div className="game-wrap wide">
        <GameHeader id="attack-killchain" title={`Kill Chain · ${play.info.title}`} level={play.info.level} current={i} total={rounds.length} />
        <div className="card q-card">
          <span className="label">{r.name} · {r.date}</span>
          <p className="muted small" style={{ margin: '8px 0 0' }}>Source : {r.source}</p>
        </div>

        <p className="q-hint">{checked ? 'Chronologie de l’incident.' : 'Cliquez sur les étapes dans l’ordre chronologique.'}</p>

        <ol className="kill-chain">
          {(checked ? r.steps.map((_, k) => k) : order).map((idx, pos) => {
            const st = r.steps[idx];
            const state = checked ? (order[pos] === pos ? 'ok' : 'ko') : '';
            return (
              <li key={idx} className={`kc-step ${state}`}>
                <span className="kc-n mono">{pos + 1}</span>
                <span>
                  <span className="tag id">{tagOf(st)}</span> {st.text}
                  {checked && st.technique && (
                    <span className="small dim" style={{ display: 'block', marginTop: 4 }}>
                      {technique(st.technique).name} · {technique(st.technique).tactics.map((x) => tactic(x).nameFr).join(', ')}
                    </span>
                  )}
                </span>
              </li>
            );
          })}
          {!checked && Array.from({ length: r.steps.length - order.length }).map((_, k) => (
            <li key={`empty-${k}`} className="kc-step empty"><span className="kc-n mono">{order.length + k + 1}</span><span className="dim">…</span></li>
          ))}
        </ol>

        {!checked && (
          <>
            <div className="grid" style={{ gap: 8 }}>
              {r.deck.filter((c) => !order.includes(c.idx)).map((c) => (
                <button key={c.idx} className="option" onClick={() => add(c.idx)}>
                  <span><span className="tag id">{tagOf(c.st)}</span> {c.st.text}</span>
                </button>
              ))}
            </div>
            <div className="actions between">
              <button className="btn" disabled={order.length === 0} onClick={() => setOrder([])}><RotateCcw size={14} /> Recommencer</button>
              <button className="btn primary" disabled={!complete} onClick={validate}>Valider l’ordre <ArrowRight size={16} className="arrow" /></button>
            </div>
          </>
        )}

        {checked && (
          <>
            <Feedback good={placed === r.steps.length}>
              <b>{placed === r.steps.length ? 'Chronologie exacte.' : `${placed} étape${placed > 1 ? 's' : ''} sur ${r.steps.length} à la bonne place.`}</b>
              <div className="small muted">{r.lesson}</div>
            </Feedback>
            <div className="actions"><button className="btn primary" onClick={next}>{i + 1 >= rounds.length ? 'Voir le bilan' : 'Incident suivant'} <ArrowRight size={16} className="arrow" /></button></div>
          </>
        )}
      </div>
    </section>
  );
}

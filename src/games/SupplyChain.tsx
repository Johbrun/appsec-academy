import { useMemo, useState } from 'react';
import { ArrowRight, RotateCcw } from 'lucide-react';
import { Feedback, GameHeader, ScoreScreen, shuffle } from '../components/ui';
import { incidents } from '../data/game-supply';
import { useProgress } from '../store/progress';

const ROUNDS = 4;

export default function SupplyChain() {
  const { recordScore } = useProgress();
  const [seed, setSeed] = useState(0);
  const rounds = useMemo(() => shuffle(incidents).slice(0, ROUNDS).map((inc) => ({
    ...inc,
    deck: shuffle(inc.steps.map((text, idx) => ({ text, idx }))),
    options: shuffle(inc.controls),
  })), [seed]);
  const [i, setI] = useState(0);
  const [order, setOrder] = useState<number[]>([]);
  const [orderChecked, setOrderChecked] = useState(false);
  const [control, setControl] = useState<string | null>(null);
  const [scores, setScores] = useState<number[]>([]);
  const [done, setDone] = useState(false);

  const r = rounds[i];
  const complete = order.length === r.steps.length;
  const orderScore = order.filter((idx, pos) => idx === pos).length / r.steps.length;

  const add = (idx: number) => { if (!orderChecked && !order.includes(idx)) setOrder([...order, idx]); };
  const pickControl = (c: string) => {
    if (control) return;
    setControl(c);
    setScores([...scores, Math.round(orderScore * 60 + (c === r.controls[0] ? 40 : 0))]);
  };
  const next = () => {
    if (i + 1 >= rounds.length) {
      setDone(true);
      recordScore('supply-chain', Math.round(scores.reduce((a, b) => a + b, 0) / scores.length));
    } else { setI(i + 1); setOrder([]); setOrderChecked(false); setControl(null); }
  };
  const restart = () => { setSeed(seed + 1); setI(0); setOrder([]); setOrderChecked(false); setControl(null); setScores([]); setDone(false); };

  if (done) {
    const pct = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    return <section className="block"><ScoreScreen pct={pct} title={`${rounds.length} incidents reconstitués`} onRetry={restart} /></section>;
  }

  return (
    <section className="block">
      <div className="game-wrap wide">
        <GameHeader id="supply-chain" title="Supply Chain Kill Chain" current={i} total={rounds.length} />
        <div className="card q-card">
          <span className="label">{r.name} · {r.date}</span>
          <p className="muted small" style={{ margin: '8px 0 0' }}>{r.viewpoint}</p>
        </div>

        <p className="q-hint">{!orderChecked ? '1. Clique sur les étapes dans l’ordre chronologique.' : !control ? '2. Quel contrôle, de ton point de vue, aurait cassé la chaîne le plus tôt ?' : 'Bilan de l’incident.'}</p>

        <ol className="kill-chain">
          {(orderChecked ? r.steps.map((_, k) => k) : order).map((idx, pos) => {
            const state = orderChecked ? (order[pos] === pos ? 'ok' : 'ko') : '';
            return (
              <li key={idx} className={`kc-step ${state}`}>
                <span className="kc-n mono">{pos + 1}</span>
                <span>{r.steps[idx]}</span>
              </li>
            );
          })}
          {!orderChecked && Array.from({ length: r.steps.length - order.length }).map((_, k) => (
            <li key={`empty-${k}`} className="kc-step empty"><span className="kc-n mono">{order.length + k + 1}</span><span className="dim">…</span></li>
          ))}
        </ol>

        {!orderChecked && (
          <>
            <div className="grid" style={{ gap: 8 }}>
              {r.deck.filter((c) => !order.includes(c.idx)).map((c) => (
                <button key={c.idx} className="option" onClick={() => add(c.idx)}>
                  <span><b style={{ fontWeight: 400 }}>{c.text}</b></span>
                </button>
              ))}
            </div>
            <div className="actions between">
              <button className="btn" disabled={order.length === 0} onClick={() => setOrder([])}><RotateCcw size={14} /> Recommencer</button>
              <button className="btn primary" disabled={!complete} onClick={() => setOrderChecked(true)}>Valider l’ordre <ArrowRight size={16} className="arrow" /></button>
            </div>
          </>
        )}

        {orderChecked && (
          <>
            <Feedback good={orderScore >= 0.6}>
              <b>{orderScore === 1 ? 'Chronologie exacte.' : `${Math.round(orderScore * r.steps.length)} étape${orderScore * r.steps.length > 1 ? 's' : ''} sur ${r.steps.length} à la bonne place.`}</b>
              {orderScore < 1 && <div className="small muted">La chronologie correcte est affichée ci-dessus ; les étapes que tu avais mal placées sont en rouge.</div>}
            </Feedback>
            <div className="grid" style={{ gap: 10, marginTop: 16 }}>
              {r.options.map((c, k) => {
                const cls = control ? (c === r.controls[0] ? 'correct' : c === control ? 'wrong' : '') : '';
                return (
                  <button key={c} className={`option ${cls}`} disabled={!!control} onClick={() => pickControl(c)}>
                    <span className="key">{String.fromCharCode(65 + k)}</span>
                    <span><b style={{ fontWeight: 500 }}>{c}</b></span>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {control && (
          <>
            <Feedback good={control === r.controls[0]}>
              <b>{control === r.controls[0] ? 'Le bon point de rupture.' : `Le contrôle le plus précoce : ${r.controls[0]}.`}</b>
              <div className="small muted">{r.why}</div>
            </Feedback>
            <div className="actions between">
              <span className="small dim">Score de l’incident : {scores[scores.length - 1]} %</span>
              <button className="btn primary" onClick={next}>{i + 1 >= rounds.length ? 'Voir le bilan' : 'Incident suivant'} <ArrowRight size={16} className="arrow" /></button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

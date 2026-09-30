import { useMemo, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Feedback, GameHeader, ScoreScreen, shuffle } from '../components/ui';
import { dfdFlows, dfdNodes, strideNames, threatCards, type DfdNode, type Stride } from '../data/game-stride';
import { useProgress } from '../store/progress';

const ROUNDS = 8;
const HALF: Record<DfdNode['kind'], [number, number]> = { entity: [62, 24], process: [48, 48], store: [66, 22] };

// Point où un flux sort de la forme d'un nœud, dans la direction (dx, dy).
function edge(n: DfdNode, dx: number, dy: number, pad = 6) {
  const len = Math.hypot(dx, dy) || 1;
  let t: number;
  if (n.kind === 'process') t = HALF.process[0] + pad;
  else {
    const [hw, hh] = HALF[n.kind];
    t = Math.min(dx ? hw / Math.abs(dx / len) : Infinity, dy ? hh / Math.abs(dy / len) : Infinity) + pad;
  }
  return { x: n.x + (dx / len) * t, y: n.y + (dy / len) * t };
}

function Dfd({ picked, onPick, result }: { picked: string | null; onPick: (id: string) => void; result: { ok: string[]; wrong: string | null } | null }) {
  const byId = Object.fromEntries(dfdNodes.map((n) => [n.id, n]));
  const state = (id: string) => (result ? (result.ok.includes(id) ? 'ok' : result.wrong === id ? 'ko' : '') : picked === id ? 'on' : '');
  return (
    <svg className="dfd" viewBox="0 0 880 440" role="group" aria-label="Diagramme de flux de données de Novafact">
      <defs>
        <marker id="dfd-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" className="dfd-arrowhead" />
        </marker>
      </defs>
      <rect x="190" y="110" width="672" height="318" rx="14" className="dfd-boundary" />
      <text x="206" y="132" className="dfd-boundary-label">Frontière de confiance · AWS Novafact</text>
      {dfdFlows.map(([a, b, both]) => {
        const A = byId[a]; const B = byId[b];
        const p = edge(A, B.x - A.x, B.y - A.y); const q = edge(B, A.x - B.x, A.y - B.y);
        return <line key={a + b} x1={p.x} y1={p.y} x2={q.x} y2={q.y} className="dfd-flow" markerEnd="url(#dfd-arrow)" markerStart={both ? 'url(#dfd-arrow)' : undefined} />;
      })}
      {dfdNodes.map((n) => {
        const [hw, hh] = HALF[n.kind];
        return (
          <g key={n.id} className={`dfd-node ${state(n.id)}`} role="button" tabIndex={result ? -1 : 0} aria-label={n.label} aria-pressed={picked === n.id}
            onClick={() => !result && onPick(n.id)}
            onKeyDown={(e) => { if (!result && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onPick(n.id); } }}>
            {n.kind === 'process' && <circle cx={n.x} cy={n.y} r={hw} className="dfd-shape" />}
            {n.kind === 'entity' && <rect x={n.x - hw} y={n.y - hh} width={hw * 2} height={hh * 2} rx="4" className="dfd-shape" />}
            {n.kind === 'store' && (
              <>
                <rect x={n.x - hw} y={n.y - hh} width={hw * 2} height={hh * 2} className="dfd-shape store" />
                <line x1={n.x - hw} y1={n.y - hh} x2={n.x + hw} y2={n.y - hh} className="dfd-store-line" />
                <line x1={n.x - hw} y1={n.y + hh} x2={n.x + hw} y2={n.y + hh} className="dfd-store-line" />
              </>
            )}
            <text x={n.x} y={n.y + 4} textAnchor="middle" className="dfd-label">{n.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

export default function StrideCards() {
  const { recordScore } = useProgress();
  const [seed, setSeed] = useState(0);
  const rounds = useMemo(() => shuffle(threatCards).slice(0, ROUNDS), [seed]);
  const [i, setI] = useState(0);
  const [el, setEl] = useState<string | null>(null);
  const [cat, setCat] = useState<Stride | null>(null);
  const [checked, setChecked] = useState(false);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  const r = rounds[i];
  const elOk = !!el && r.el.includes(el);
  const catOk = cat === r.stride;
  const total = rounds.length * 2;
  const names = Object.fromEntries(dfdNodes.map((n) => [n.id, n.label]));

  const check = () => { setChecked(true); setScore(score + (elOk ? 1 : 0) + (catOk ? 1 : 0)); };
  const next = () => {
    if (i + 1 >= rounds.length) {
      setDone(true);
      recordScore('stride-cards', Math.round((score / total) * 100));
    } else { setI(i + 1); setEl(null); setCat(null); setChecked(false); }
  };
  const restart = () => { setSeed(seed + 1); setI(0); setEl(null); setCat(null); setChecked(false); setScore(0); setDone(false); };

  if (done) return <section className="block"><ScoreScreen pct={Math.round((score / total) * 100)} title={`${score} / ${total} : cartes posées sur le DFD`} onRetry={restart} /></section>;

  return (
    <section className="block">
      <div className="game-wrap wide">
        <GameHeader id="stride-cards" title="STRIDE Cards" current={i} total={rounds.length} extra={<span className="tag mono">{score} / {total}</span>} />
        <div className="card q-card">
          <span className="label">Carte de menace {i + 1}</span>
          <h3 style={{ marginTop: 12 }}>{r.text}</h3>
        </div>
        <p className="q-hint">Clique sur l’élément du DFD concerné, puis choisis la catégorie STRIDE.</p>
        <Dfd picked={el} onPick={setEl} result={checked ? { ok: r.el, wrong: elOk ? null : el } : null} />
        <div className="stride-row">
          {(Object.keys(strideNames) as Stride[]).map((s) => {
            const cls = checked ? (s === r.stride ? 'correct' : s === cat ? 'wrong' : '') : cat === s ? 'selected' : '';
            return (
              <button key={s} className={`option stride-opt ${cls}`} disabled={checked} onClick={() => setCat(s)} aria-pressed={cat === s}>
                <span className="key">{s}</span>
                <span><b style={{ fontWeight: 500 }}>{strideNames[s]}</b></span>
              </button>
            );
          })}
        </div>
        {!checked && (
          <div className="actions between">
            <span className="small dim">{el ? `Élément : ${names[el]}` : 'Aucun élément choisi'}{cat ? ` · ${strideNames[cat]}` : ''}</span>
            <button className="btn primary" disabled={!el || !cat} onClick={check}>Poser la carte <ArrowRight size={16} className="arrow" /></button>
          </div>
        )}
        {checked && (
          <>
            <Feedback good={elOk && catOk}>
              <b>
                {elOk && catOk ? 'Carte bien posée.' : `Attendu : ${r.el.map((e) => names[e]).join(' ou ')}, ${strideNames[r.stride]}.`}
              </b>
              <div className="small muted"><b style={{ fontWeight: 500 }}>Contre-mesure :</b> {r.mitigation}</div>
            </Feedback>
            <div className="actions"><button className="btn primary" onClick={next}>{i + 1 >= rounds.length ? 'Voir le score' : 'Carte suivante'} <ArrowRight size={16} className="arrow" /></button></div>
          </>
        )}
      </div>
    </section>
  );
}

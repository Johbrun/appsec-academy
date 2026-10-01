import { useState, type KeyboardEvent } from 'react';
import { ArrowRight } from 'lucide-react';
import { Feedback, GameHeader } from '../components/ui';
import { SeriesGame, SeriesScore, type SeriesPlay } from '../components/Series';
import {
  dfdById, flowId, strideNames, strideProperty, strideSeries,
  type Dfd, type DfdFlow, type DfdNode, type Stride, type ThreatCard,
} from '../data/game-stride';

const HALF: Record<DfdNode['kind'], [number, number]> = { entity: [62, 24], process: [48, 48], store: [66, 22] };
const WIDTH = 880;

type Pt = { x: number; y: number };

// Point où un flux sort de la forme d'un nœud, dans la direction (dx, dy).
function edge(n: DfdNode, dx: number, dy: number, pad = 6): Pt {
  const len = Math.hypot(dx, dy) || 1;
  let t: number;
  if (n.kind === 'process') t = HALF.process[0] + pad;
  else {
    const [hw, hh] = HALF[n.kind];
    t = Math.min(dx ? hw / Math.abs(dx / len) : Infinity, dy ? hh / Math.abs(dy / len) : Infinity) + pad;
  }
  return { x: n.x + (dx / len) * t, y: n.y + (dy / len) * t };
}

/**
 * Tracé d'un flux : droit, ou courbé de `bend` pixels quand une ligne droite
 * traverserait un autre nœud. Renvoie aussi le milieu, pour l'étiquette.
 */
function flowPath(A: DfdNode, B: DfdNode, bend = 0): { d: string; mid: Pt } {
  const mx = (A.x + B.x) / 2;
  const my = (A.y + B.y) / 2;
  const len = Math.hypot(B.x - A.x, B.y - A.y) || 1;
  const c = { x: mx - ((B.y - A.y) / len) * bend, y: my + ((B.x - A.x) / len) * bend };
  const p = edge(A, c.x - A.x, c.y - A.y);
  const q = edge(B, c.x - B.x, c.y - B.y);
  if (!bend) return { d: `M${p.x},${p.y} L${q.x},${q.y}`, mid: { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 } };
  return {
    d: `M${p.x},${p.y} Q${c.x},${c.y} ${q.x},${q.y}`,
    mid: { x: 0.25 * p.x + 0.5 * c.x + 0.25 * q.x, y: 0.25 * p.y + 0.5 * c.y + 0.25 * q.y },
  };
}

const lines = (label: string) => label.split('\n');

/** Libellé lisible d'un élément du DFD : nœud ou flux. */
function elementName(dfd: Dfd, id: string): string {
  const node = dfd.nodes.find((n) => n.id === id);
  if (node) return node.label.replace('\n', ' ');
  const f = dfd.flows.find((fl) => flowId(fl) === id);
  if (!f) return id;
  const name = (n: string) => dfd.nodes.find((x) => x.id === n)!.label.replace('\n', ' ');
  return `flux ${name(f.from)} ${f.both ? '↔' : '→'} ${name(f.to)}`;
}

// Les flux sont cliquables depuis l'arrivée des séries : leurs états (survol,
// choisi, juste, faux) n'ont pas de règle dans appsec.css, qu'on ne touche pas
// ici. Ils vivent donc dans le SVG, sous des classes qui ne servent qu'à lui.
type Result = { ok: string[]; wrong: string | null } | null;

export function DfdView({ dfd, picked, onPick, result }: { dfd: Dfd; picked: string | null; onPick: (id: string) => void; result: Result }) {
  const byId = Object.fromEntries(dfd.nodes.map((n) => [n.id, n]));
  const height = dfd.height ?? 440;
  const state = (id: string) => (result ? (result.ok.includes(id) ? 'ok' : result.wrong === id ? 'ko' : '') : picked === id ? 'on' : '');
  const pick = (id: string) => { if (!result) onPick(id); };
  const keys = (id: string) => (e: KeyboardEvent) => {
    if (!result && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onPick(id); }
  };
  const marker = `dfd-arrow-${dfd.id}`;

  const flows = dfd.flows.map((f: DfdFlow) => ({ f, id: flowId(f), ...flowPath(byId[f.from], byId[f.to], f.bend) }));

  return (
    <svg className="dfd" viewBox={`0 0 ${WIDTH} ${height}`} role="group" aria-label={`Diagramme de flux de données : ${dfd.title}`}>
      <defs>
        <marker id={marker} viewBox="0 0 10 10" refX="9" refY="5" markerUnits="userSpaceOnUse" markerWidth="9" markerHeight="9" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" className="dfd-arrowhead" />
        </marker>
      </defs>
      {dfd.boundaries.map((b) => (
        <g key={b.label}>
          <rect x={b.x} y={b.y} width={b.w} height={b.h} rx="14" className="dfd-boundary" />
          <text x={b.x + 12} y={b.y + 20} className="dfd-boundary-label">{b.label}</text>
        </g>
      ))}
      {flows.map(({ f, id, d }) => (
        <g key={id} className={`dfd-flowg ${state(id)} ${result ? 'locked' : ''}`} role="button" tabIndex={result ? -1 : 0}
          aria-label={elementName(dfd, id)} aria-pressed={picked === id} onClick={() => pick(id)} onKeyDown={keys(id)}>
          <path d={d} className="dfd-flowhit" />
          <path d={d} className="dfd-flow" markerEnd={`url(#${marker})`} markerStart={f.both ? `url(#${marker})` : undefined} />
        </g>
      ))}
      {dfd.nodes.map((n) => {
        const [hw, hh] = HALF[n.kind];
        const ls = lines(n.label);
        return (
          <g key={n.id} className={`dfd-node ${state(n.id)}`} role="button" tabIndex={result ? -1 : 0} aria-label={n.label.replace('\n', ' ')}
            aria-pressed={picked === n.id} onClick={() => pick(n.id)} onKeyDown={keys(n.id)}>
            {n.kind === 'process' && <circle cx={n.x} cy={n.y} r={hw} className="dfd-shape" />}
            {n.kind === 'entity' && <rect x={n.x - hw} y={n.y - hh} width={hw * 2} height={hh * 2} rx="4" className="dfd-shape" />}
            {n.kind === 'store' && (
              <>
                <rect x={n.x - hw} y={n.y - hh} width={hw * 2} height={hh * 2} className="dfd-shape store" />
                <line x1={n.x - hw} y1={n.y - hh} x2={n.x + hw} y2={n.y - hh} className="dfd-store-line" />
                <line x1={n.x - hw} y1={n.y + hh} x2={n.x + hw} y2={n.y + hh} className="dfd-store-line" />
              </>
            )}
            <text x={n.x} y={n.y + 4 - (ls.length - 1) * 7.5} textAnchor="middle" className="dfd-label">
              {ls.map((l, k) => <tspan key={k} x={n.x} dy={k ? 15 : 0}>{l}</tspan>)}
            </text>
          </g>
        );
      })}
      {/* Les étiquettes passent au-dessus des nœuds et ne captent pas le clic. */}
      {flows.filter(({ f }) => f.label).map(({ f, id, mid }) => (
        <text key={`l-${id}`} x={mid.x} y={mid.y - 6} textAnchor="middle" className="dfd-flowlabel">{f.label}</text>
      ))}
    </svg>
  );
}

export default function StrideCards() {
  return (
    <SeriesGame
      gameId="stride-cards"
      title="STRIDE Cards"
      set={strideSeries}
      unit="cartes"
      intro="Sept DFD de Novafact, de l’application web au SSO des grands comptes, plus une Mêlée. Chaque carte se pose sur un nœud ou sur un flux, puis reçoit sa catégorie : plus on avance, plus les cartes visent les flux qui franchissent une frontière, et plus le premier mot qui vient est le mauvais."
    >
      {(play) => <Round play={play} />}
    </SeriesGame>
  );
}

function Round({ play }: { play: SeriesPlay<ThreatCard> }) {
  const rounds = play.items;
  const [i, setI] = useState(0);
  const [el, setEl] = useState<string | null>(null);
  const [cat, setCat] = useState<Stride | null>(null);
  const [checked, setChecked] = useState(false);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  const total = rounds.length * 2;
  const pct = Math.round((score / total) * 100);

  if (done) return <SeriesScore play={play} pct={pct} title={`${score} / ${total} : cartes posées sur le DFD`} />;

  const r = rounds[i];
  const dfd = dfdById(r.dfd)!;
  const elOk = !!el && r.el.includes(el);
  const catOk = cat === r.stride;
  const name = (id: string) => elementName(dfd, id);
  // Une Mêlée change de DFD d'une carte à l'autre : on le signale.
  const newDfd = i === 0 || rounds[i - 1].dfd !== r.dfd;

  const check = () => { setChecked(true); setScore(score + (elOk ? 1 : 0) + (catOk ? 1 : 0)); };
  const next = () => {
    if (i + 1 >= rounds.length) {
      play.finish(pct);
      setDone(true);
    } else { setI(i + 1); setEl(null); setCat(null); setChecked(false); }
  };

  return (
    <section className="block">
      <div className="game-wrap wide">
        <GameHeader id="stride-cards" title={`STRIDE Cards · ${play.info.title}`} level={play.info.level}
          current={i} total={rounds.length} extra={<span className="tag mono">{score} / {total}</span>} />
        <div className="card q-card">
          <span className="label">Carte de menace {i + 1} · {dfd.title}</span>
          <h3 style={{ marginTop: 12 }}>{r.text}</h3>
        </div>
        <p className="q-hint">
          {newDfd && <>{dfd.intro} </>}
          Clique sur l’élément du DFD concerné, nœud ou flux, puis choisis la catégorie STRIDE.
        </p>
        <DfdView key={dfd.id} dfd={dfd} picked={el} onPick={setEl} result={checked ? { ok: r.el, wrong: elOk ? null : el } : null} />
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
            <span className="small dim">{el ? `Élément : ${name(el)}` : 'Aucun élément choisi'}{cat ? ` · ${strideNames[cat]}` : ''}</span>
            <button className="btn primary" disabled={!el || !cat} onClick={check}>Poser la carte <ArrowRight size={16} className="arrow" /></button>
          </div>
        )}
        {checked && (
          <>
            <Feedback good={elOk && catOk}>
              <b>
                {elOk && catOk
                  ? `Carte bien posée. Propriété violée : ${strideProperty[r.stride]}.`
                  : `Attendu : ${r.el.map(name).join(' ou ')}, ${strideNames[r.stride]} (${strideProperty[r.stride]}).`}
              </b>
              <div className="small muted">{r.why}</div>
              <div className="small muted" style={{ marginTop: 6 }}><b style={{ fontWeight: 500 }}>Contre-mesure :</b> {r.mitigation}</div>
            </Feedback>
            <div className="actions"><button className="btn primary" onClick={next}>{i + 1 >= rounds.length ? 'Voir le score' : 'Carte suivante'} <ArrowRight size={16} className="arrow" /></button></div>
          </>
        )}
      </div>
    </section>
  );
}

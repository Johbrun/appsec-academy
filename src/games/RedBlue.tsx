import { useMemo, useState } from 'react';
import { ArrowRight, RotateCcw, Shield, Swords } from 'lucide-react';
import { Feedback, GameHeader, ScoreScreen, shuffle } from '../components/ui';
import { scenarios, type Control } from '../data/game-redblue';
import { useProgress } from '../store/progress';

type Phase = 'intro' | 'red' | 'blue' | 'done';
const stageNames: Record<Control['stage'], string> = { code: 'Code', build: 'Build / CI', infra: 'Infra', runtime: 'Runtime' };

export default function RedBlue() {
  const { recordScore } = useProgress();
  const [seed, setSeed] = useState(0);
  // Une chaîne tirée au sort par partie : trois scénarios, trois arbitrages.
  const sc = useMemo(() => shuffle(scenarios)[0], [seed]);
  const { chain, controls, budget } = sc;
  const deck = useMemo(() => shuffle(chain.map((l, idx) => ({ ...l, idx }))), [sc]);
  const [phase, setPhase] = useState<Phase>('intro');
  const [order, setOrder] = useState<number[]>([]);
  const [redScore, setRedScore] = useState(0);
  const [chosen, setChosen] = useState<string[]>([]);
  const [final, setFinal] = useState(0);

  const picked = controls.filter((c) => chosen.includes(c.id));
  const spent = picked.reduce((s, c) => s + c.cost, 0);
  const cutLinks = new Set(picked.flatMap((c) => c.cuts));
  const hasDetection = picked.some((c) => c.detects);

  const add = (idx: number) => { if (!order.includes(idx)) setOrder([...order, idx]); };
  const validateRed = () => {
    setRedScore(order.filter((idx, pos) => idx === pos).length);
    setPhase('blue');
  };
  const toggle = (id: string, cost: number) => setChosen((cs) => {
    if (cs.includes(id)) return cs.filter((x) => x !== id);
    if (spent + cost > budget) return cs;
    return [...cs, id];
  });
  const finish = () => {
    // Rompre la chaîne tôt vaut plus. On prend le premier lien coupé : plus il est tôt, meilleur.
    const firstCutPos = chain.findIndex((l) => cutLinks.has(l.id));
    const earliness = firstCutPos === -1 ? 0 : (chain.length - firstCutPos) / chain.length;
    const depth = cutLinks.size / chain.length;
    const redPct = (redScore / chain.length) * 30;
    const bluePct = earliness * 35 + depth * 25 + (hasDetection ? 10 : 0);
    const pct = Math.round(redPct + Math.min(70, bluePct));
    setFinal(pct);
    setPhase('done');
    recordScore('red-blue', pct);
  };
  const restart = () => { setSeed(seed + 1); setPhase('intro'); setOrder([]); setRedScore(0); setChosen([]); setFinal(0); };

  if (phase === 'done') {
    const firstCutPos = chain.findIndex((l) => cutLinks.has(l.id));
    return <section className="block"><ScoreScreen pct={final} title={`Red vs Blue · ${sc.title}`} onRetry={restart}>
      <div className="kv" style={{ maxWidth: 460, margin: '0 auto 12px' }}>
        <div><span className="label">Chaîne analysée</span><b>{redScore}/{chain.length}</b></div>
        <div><span className="label">Liens brisés</span><b>{cutLinks.size}/{chain.length}</b></div>
        <div><span className="label">Budget</span><b>{spent}/{budget}</b></div>
      </div>
      {/* Le verdict maillon par maillon : c'est ici, et pas avant, qu'on apprend
          ce que chaque contrôle coupait réellement. */}
      <div className="chain-preview" style={{ margin: '0 auto 14px', justifyContent: 'center' }}>
        {chain.map((l, k) => (
          <span key={l.id} className="path-node-wrap">
            <span
              className={`path-node ${cutLinks.has(l.id) ? '' : 'end'}`}
              style={cutLinks.has(l.id) ? { background: 'var(--ok-soft)', color: 'var(--ok)', boxShadow: 'inset 0 0 0 1px var(--ok)' } : {}}
            >{l.technique}</span>
            {k < chain.length - 1 && <span className="parser-arrow">→</span>}
          </span>
        ))}
      </div>
      <p className="small muted" style={{ maxWidth: 520, margin: '0 auto 12px' }}>
        {firstCutPos === 0
          ? 'Tu as coupé la chaîne à la racine : la meilleure défense est la plus précoce. La défense en profondeur ajoute des filets pour le jour où la racine cède.'
          : firstCutPos === -1
            ? 'Aucun maillon rompu : l’attaquant va au bout. Il fallait financer au moins un contrôle qui casse la chaîne, idéalement tôt.'
            : 'Tu as cassé la chaîne, mais tard. Couper plus près de la source limite davantage le rayon d’explosion. La détection reste indispensable en complément.'}
      </p>
      <div style={{ maxWidth: 560, margin: '0 auto', textAlign: 'left' }}>
        {picked.map((c) => (
          <Feedback key={c.id} good={c.cuts.length > 0 || Boolean(c.detects)}>
            <b>{c.name}</b>
            <div className="small muted">
              {c.cuts.length
                ? `Casse ${c.cuts.length > 1 ? 'les maillons' : 'le maillon'} ${c.cuts.map((id) => chain.find((l) => l.id === id)?.technique).join(', ')}. `
                : c.detects ? 'Ne casse aucun maillon, raccourcit le temps de résidence. ' : 'Ne casse aucun maillon de cette chaîne. '}
              {c.desc}
            </div>
          </Feedback>
        ))}
        {picked.length === 0 && <p className="small muted">Aucun contrôle financé.</p>}
      </div>
    </ScoreScreen></section>;
  }

  if (phase === 'intro') {
    return (
      <section className="block"><div className="game-wrap">
        <GameHeader id="red-blue" title="Red vs Blue : Novafact" current={0} total={2} counter={false} />
        <div className="card crisis-intro">
          <span className="tag mono" style={{ background: 'var(--surface-3)' }}>Boss final</span>
          <h2 style={{ margin: '12px 0' }}>{sc.title}</h2>
          <p className="dim">{sc.intro}</p>
          <p className="dim">D’abord côté <b>Red</b> : reconstitue l’ordre de la chaîne. Ensuite côté <b>Blue</b> : choisis les contrôles à financer, sans savoir lesquels coupent quoi — tu ne le sauras qu’après avoir lancé l’attaque contre ta propre défense.</p>
          <button className="btn primary" onClick={() => setPhase('red')}><Swords size={15} /> Commencer côté Red</button>
        </div>
      </div></section>
    );
  }

  if (phase === 'red') {
    const complete = order.length === chain.length;
    return (
      <section className="block"><div className="game-wrap wide">
        <GameHeader id="red-blue" title="Red · reconstituer la chaîne" current={0} total={2} counter={false} />
        <p className="q-hint" style={{ marginTop: 0 }}>Clique les étapes dans l’ordre où l’attaquant les enchaîne, de l’entrée initiale à l’objectif final.</p>
        <ol className="kill-chain">
          {order.map((idx, pos) => (
            <li key={idx} className="kc-step"><span className="kc-n mono">{pos + 1}</span><span><b style={{ fontWeight: 500 }}>{deck.find((d) => d.idx === idx)!.technique}</b> — {chain[idx].step} <span className="dim mono">{chain[idx].module}</span></span></li>
          ))}
          {Array.from({ length: chain.length - order.length }).map((_, k) => (
            <li key={`e${k}`} className="kc-step empty"><span className="kc-n mono">{order.length + k + 1}</span><span className="dim">…</span></li>
          ))}
        </ol>
        <div className="grid" style={{ gap: 8 }}>
          {deck.filter((d) => !order.includes(d.idx)).map((d) => (
            <button key={d.id} className="option" onClick={() => add(d.idx)}>
              <span><b style={{ fontWeight: 500 }}>{d.technique}</b><span className="desc">{d.step}</span></span>
            </button>
          ))}
        </div>
        <div className="actions between">
          <button className="btn" disabled={!order.length} onClick={() => setOrder([])}><RotateCcw size={14} /> Recommencer</button>
          <button className="btn primary" disabled={!complete} onClick={validateRed}>Passer côté Blue <Shield size={15} /></button>
        </div>
      </div></section>
    );
  }

  // phase blue — ni `cuts` ni `desc` ne s'affichent : c'est ce qui rend le choix difficile.
  return (
    <section className="block"><div className="game-wrap wide">
      <GameHeader id="red-blue" title="Blue · défendre en profondeur" current={1} total={2} counter={false} extra={<span className="tag mono" style={{ color: spent > budget ? 'var(--ko)' : undefined }}>{spent}/{budget}</span>} />
      <div className="card q-card">
        <span className="label">Chaîne à briser</span>
        <div className="chain-preview" style={{ margin: '8px 0 0' }}>
          {chain.map((l, k) => (
            <span key={l.id} className="path-node-wrap">
              <span className="path-node end">{l.technique}</span>
              {k < chain.length - 1 && <span className="parser-arrow">→</span>}
            </span>
          ))}
        </div>
      </div>
      <p className="q-hint">
        Choisis les contrôles à financer (budget {budget}). Certains ne coupent rien de cette chaîne —
        à toi de voir lesquels. Casser tôt et à plusieurs endroits vaut mieux que tout miser au bout.
      </p>
      <div className="grid g2" style={{ gap: 10 }}>
        {controls.map((c) => {
          const on = chosen.includes(c.id);
          const affordable = on || spent + c.cost <= budget;
          return (
            <button key={c.id} className={`option ${on ? 'selected' : ''}`} disabled={!affordable} onClick={() => toggle(c.id, c.cost)}>
              <span className="key">{c.cost}</span>
              <span><b style={{ fontWeight: 500 }}>{c.name}</b><span className="desc">{stageNames[c.stage]}</span></span>
            </button>
          );
        })}
      </div>
      <div className="actions between">
        <span className="small dim">{picked.length} contrôle{picked.length > 1 ? 's' : ''} financé{picked.length > 1 ? 's' : ''} · {budget - spent} restant</span>
        <button className="btn primary" onClick={finish}>Lancer l’attaque contre ta défense <ArrowRight size={16} className="arrow" /></button>
      </div>
    </div></section>
  );
}

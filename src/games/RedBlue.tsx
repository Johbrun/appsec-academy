import { useMemo, useState } from 'react';
import { ArrowRight, RotateCcw, Shield, Swords } from 'lucide-react';
import { Feedback, GameHeader, shuffle } from '../components/ui';
import { SeriesGame, SeriesScore, type SeriesPlay } from '../components/Series';
import { redBlueSeries, stagesOf, type Control, type Link, type RedBlueScenario } from '../data/game-redblue';

type Phase = 'intro' | 'red' | 'blue' | 'done';
const stageNames: Record<Control['stage'], string> = { code: 'Code', build: 'Build / CI', infra: 'Infra', runtime: 'Runtime' };

/**
 * Valeur brute d'une défense (sur 70). Rompre la chaîne tôt vaut plus ; une
 * étape à deux voies n'est coupée que si les deux le sont.
 */
function defenseValue(stages: Link[][], picked: Control[]) {
  const cut = new Set(picked.flatMap((c) => c.cuts));
  const closed = stages.map((st) => st.every((l) => cut.has(l.id)));
  const first = closed.indexOf(true);
  const earliness = first === -1 ? 0 : (stages.length - first) / stages.length;
  const depth = closed.filter(Boolean).length / stages.length;
  const detection = picked.some((c) => c.detects) ? 10 : 0;
  return Math.min(70, earliness * 35 + depth * 25 + detection);
}

/**
 * La meilleure défense que le budget permet. Le score Blue s'y rapporte : sans
 * cela, un scénario N3 où aucun budget ne ferme tout plafonnerait le joueur
 * parfait bien en dessous de 100.
 */
function bestValue(sc: RedBlueScenario, stages: Link[][]) {
  const cs = sc.controls;
  let best = 0;
  for (let mask = 0; mask < 1 << cs.length; mask += 1) {
    const set = cs.filter((_, k) => mask & (1 << k));
    if (set.reduce((s, c) => s + c.cost, 0) > sc.budget) continue;
    best = Math.max(best, defenseValue(stages, set));
  }
  return best || 1;
}

export default function RedBlue() {
  return (
    <SeriesGame
      gameId="red-blue"
      title="Red vs Blue : Novafact"
      set={redBlueSeries}
      unit={(n) => (n > 1 ? 'chaînes' : 'chaîne')}
      intro="Huit chaînes d’attaque, de la plus courte à celles qui ont plusieurs chemins. Plusieurs sont calquées sur des incidents réels, transposés à Novafact. Côté Red, tu reconstitues la chaîne ; côté Blue, tu finances une défense sans savoir ce que chaque contrôle coupe."
    >
      {(play) => <Round play={play} />}
    </SeriesGame>
  );
}

function StageNodes({ stages, state }: { stages: Link[][]; state?: (l: Link) => 'cut' | 'open' }) {
  const style = (l: Link) => (state?.(l) === 'cut'
    ? { background: 'var(--ok-soft)', color: 'var(--ok)', boxShadow: 'inset 0 0 0 1px var(--ok)' }
    : {});
  return (
    <>
      {stages.map((st, k) => (
        <span key={st[0].id} className="path-node-wrap">
          {st.length === 1
            ? <span className={`path-node ${state?.(st[0]) === 'cut' ? '' : 'end'}`} style={style(st[0])}>{st[0].technique}</span>
            : (
              <span style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'stretch' }}>
                {st.map((l, j) => (
                  <span key={l.id} style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
                    <span className={`path-node ${state?.(l) === 'cut' ? '' : 'end'}`} style={style(l)}>{l.technique}</span>
                    {j < st.length - 1 && <span className="small dim">ou</span>}
                  </span>
                ))}
              </span>
            )}
          {k < stages.length - 1 && <span className="parser-arrow">→</span>}
        </span>
      ))}
    </>
  );
}

function Round({ play }: { play: SeriesPlay<RedBlueScenario> }) {
  const sc = play.items[0];
  const { chain, controls, budget } = sc;
  const stages = useMemo(() => stagesOf(chain), [chain]);
  const branched = stages.some((st) => st.length > 1);
  const deck = useMemo(() => shuffle(chain.map((l, idx) => ({ ...l, idx }))), [chain]);
  // L'ordre des contrôles est retiré à chaque partie : sinon on rejoue une position, pas un arbitrage.
  const shownControls = useMemo(() => shuffle(controls), [controls]);
  const [phase, setPhase] = useState<Phase>('intro');
  const [order, setOrder] = useState<number[]>([]);
  const [redScore, setRedScore] = useState(0);
  const [chosen, setChosen] = useState<string[]>([]);
  const [final, setFinal] = useState(0);

  const picked = controls.filter((c) => chosen.includes(c.id));
  const spent = picked.reduce((s, c) => s + c.cost, 0);
  const cutLinks = new Set(picked.flatMap((c) => c.cuts));
  const closed = stages.map((st) => st.every((l) => cutLinks.has(l.id)));
  const half = stages.map((st, k) => !closed[k] && st.some((l) => cutLinks.has(l.id)));

  const add = (idx: number) => { if (!order.includes(idx)) setOrder([...order, idx]); };
  const validateRed = () => {
    // Deux voies d'une même étape sont interchangeables : l'une ou l'autre peut venir en premier.
    setRedScore(order.filter((idx, pos) => idx === pos || chain[idx].or === chain[pos].id).length);
    setPhase('blue');
  };
  const toggle = (id: string, cost: number) => setChosen((cs) => {
    if (cs.includes(id)) return cs.filter((x) => x !== id);
    if (spent + cost > budget) return cs;
    return [...cs, id];
  });
  const finish = () => {
    const redPct = (redScore / chain.length) * 30;
    const bluePct = (defenseValue(stages, picked) / bestValue(sc, stages)) * 70;
    const pct = Math.round(redPct + Math.min(70, bluePct));
    setFinal(pct);
    setPhase('done');
    play.finish(pct);
  };

  if (phase === 'done') {
    const firstCut = closed.indexOf(true);
    return <SeriesScore play={play} pct={final} title="Red vs Blue">
      <div className="kv" style={{ maxWidth: 460, margin: '0 auto 12px' }}>
        <div><span className="label">Chaîne analysée</span><b>{redScore}/{chain.length}</b></div>
        <div><span className="label">Étapes coupées</span><b>{closed.filter(Boolean).length}/{stages.length}</b></div>
        <div><span className="label">Budget</span><b>{spent}/{budget}</b></div>
      </div>
      {/* Le verdict maillon par maillon : c'est ici, et pas avant, qu'on apprend
          ce que chaque contrôle coupait réellement. */}
      <div className="chain-preview" style={{ margin: '0 auto 14px', justifyContent: 'center' }}>
        <StageNodes stages={stages} state={(l) => (cutLinks.has(l.id) ? 'cut' : 'open')} />
      </div>
      <p className="small muted" style={{ maxWidth: 520, margin: '0 auto 12px' }}>
        {firstCut === 0
          ? 'Tu as coupé la chaîne à la racine : la meilleure défense est la plus précoce. La défense en profondeur ajoute des filets pour le jour où la racine cède.'
          : firstCut === -1
            ? 'Aucune étape coupée : l’attaquant va au bout. Il fallait financer au moins un contrôle qui ferme une étape entière, idéalement tôt.'
            : 'Tu as cassé la chaîne, mais pas à la racine. Couper plus près de la source limite davantage le rayon d’explosion. La détection reste indispensable en complément.'}
        {half.some(Boolean) && ' Au moins une étape n’est fermée que sur une voie : l’attaquant prend l’autre, et ce contrôle ne compte pas dans la coupure.'}
      </p>
      {sc.source && (
        <div className="card" style={{ maxWidth: 560, margin: '0 auto 12px', textAlign: 'left' }}>
          <span className="label">Cas réel · {sc.source.name} ({sc.source.year})</span>
          <p className="small muted" style={{ margin: '6px 0' }}>{sc.source.note}</p>
          <a className="small" href={sc.source.url} target="_blank" rel="noreferrer noopener">Source</a>
        </div>
      )}
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
    </SeriesScore>;
  }

  if (phase === 'intro') {
    return (
      <section className="block"><div className="game-wrap">
        <GameHeader id="red-blue" title={`Red vs Blue · ${play.info.title}`} level={play.info.level} current={0} total={2} counter={false} />
        <div className="card crisis-intro">
          <span className="tag mono" style={{ background: 'var(--surface-3)' }}>
            {sc.source ? `Cas réel · ${sc.source.name}, ${sc.source.year}` : 'Scénario Novafact'}
          </span>
          <h2 style={{ margin: '12px 0' }}>{sc.title}</h2>
          <p className="dim">{sc.intro}</p>
          <p className="dim">D’abord côté <b>Red</b> : reconstitue l’ordre de la chaîne. Ensuite côté <b>Blue</b> : choisis les contrôles à financer, sans savoir lesquels coupent quoi — tu ne le sauras qu’après avoir lancé l’attaque contre ta propre défense.</p>
          {branched && <p className="dim">À certaines étapes, deux voies mènent au même point : place-les l’une après l’autre, dans l’ordre que tu veux. Une étape n’est coupée que si ses deux voies le sont.</p>}
          <button className="btn primary" onClick={() => setPhase('red')}><Swords size={15} /> Commencer côté Red</button>
        </div>
      </div></section>
    );
  }

  if (phase === 'red') {
    const complete = order.length === chain.length;
    return (
      <section className="block"><div className="game-wrap wide">
        <GameHeader id="red-blue" title="Red · reconstituer la chaîne" level={play.info.level} current={0} total={2} counter={false} />
        <p className="q-hint" style={{ marginTop: 0 }}>Clique les étapes dans l’ordre où l’attaquant les enchaîne, de l’entrée initiale à l’objectif final.</p>
        <ol className="kill-chain">
          {order.map((idx, pos) => (
            <li key={idx} className="kc-step"><span className="kc-n mono">{pos + 1}</span><span><b style={{ fontWeight: 500 }}>{chain[idx].technique}</b> — {chain[idx].step} <span className="dim mono">{chain[idx].module}</span></span></li>
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
      <GameHeader id="red-blue" title="Blue · défendre en profondeur" level={play.info.level} current={1} total={2} counter={false} extra={<span className="tag mono" style={{ color: spent > budget ? 'var(--ko)' : undefined }}>{spent}/{budget}</span>} />
      <div className="card q-card">
        <span className="label">Chaîne à briser</span>
        <div className="chain-preview" style={{ margin: '8px 0 0' }}>
          <StageNodes stages={stages} />
        </div>
      </div>
      <p className="q-hint">
        Choisis les contrôles à financer (budget {budget}). Certains ne coupent rien de cette chaîne —
        à toi de voir lesquels. Casser tôt et à plusieurs endroits vaut mieux que tout miser au bout.
        {branched && ' Une étape à deux voies ne tombe que si les deux sont fermées.'}
      </p>
      <div className="grid g2" style={{ gap: 10 }}>
        {shownControls.map((c) => {
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

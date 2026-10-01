import { useMemo, useState } from 'react';
import { ArrowRight, Clock } from 'lucide-react';
import { Feedback, GameHeader, shuffle } from '../components/ui';
import { SeriesGame, SeriesScore, type SeriesPlay } from '../components/Series';
import { crisisSeries, type Choice, type Crisis } from '../data/game-crisis';

export default function CriseJ0() {
  return (
    <SeriesGame
      gameId="crise-j0"
      title="Crise J+0"
      set={crisisSeries}
      unit={(n) => (n > 1 ? 'crises' : 'crise')}
      intro="Huit crises, de la clé publiée par erreur à l’assistant IA détourné. Plus on monte, plus l’option radicale devient un piège, et plus le droit pèse sur l’horloge."
    >
      {(play) => <Round play={play} />}
    </SeriesGame>
  );
}

function Round({ play }: { play: SeriesPlay<Crisis> }) {
  // Une série = une crise. On mélange les choix de chaque décision pour ne pas
  // fixer la bonne réponse en tête.
  const crisis: Crisis = useMemo(() => {
    const c = play.items[0];
    return { ...c, decisions: c.decisions.map((d) => ({ ...d, choices: shuffle(d.choices) })) };
  }, [play.items]);
  const [started, setStarted] = useState(false);
  const [i, setI] = useState(0);
  const [pick, setPick] = useState<number | null>(null);
  const [quality, setQuality] = useState(0);
  const [spent, setSpent] = useState(0);
  const [done, setDone] = useState(false);

  const d = crisis.decisions[i];
  const maxQuality = crisis.decisions.length * 2;
  const timePenalty = Math.max(0, spent - crisis.budgetMin);
  const pct = Math.max(0, Math.round((quality / maxQuality) * 100 - (timePenalty / crisis.budgetMin) * 20));
  const title = `Crise J+0 · ${play.info.title}`;

  const choose = (k: number, c: Choice) => {
    if (pick !== null) return;
    setPick(k);
    setQuality((q) => q + c.quality);
    setSpent((s) => s + c.minutes);
  };
  const next = () => {
    if (i + 1 >= crisis.decisions.length) {
      setDone(true);
      play.finish(pct);
    } else { setI(i + 1); setPick(null); }
  };

  if (done) {
    return (
      <SeriesScore play={play} pct={pct} title="Crise gérée">
        <div className="kv" style={{ maxWidth: 420, margin: '0 auto 12px' }}>
          <div><span className="label">Décisions</span><b>{quality}/{maxQuality}</b></div>
          <div><span className="label">Temps</span><b>{spent} / {crisis.budgetMin} min</b></div>
        </div>
        {timePenalty > 0 && <p className="small muted">Tu as dépassé la fenêtre avant impact majeur de {timePenalty} min : la lenteur coûte, en crise comme en vrai.</p>}
      </SeriesScore>
    );
  }

  if (!started) {
    return (
      <section className="block">
        <div className="game-wrap">
          <GameHeader id="crise-j0" title={title} level={play.info.level} current={0} total={crisis.decisions.length} counter={false} />
          <div className="card crisis-intro">
            <span className="tag mono" style={{ background: 'var(--ko-soft)', color: 'var(--ko)' }}>Incident critique</span>
            <h2 style={{ margin: '12px 0' }}>{crisis.title}</h2>
            <p className="dim">{crisis.intro}</p>
            {crisis.source && <p className="small muted">{crisis.source}</p>}
            <p className="small muted">Fenêtre avant impact majeur : {crisis.budgetMin} min. Chaque décision consomme du temps et compte dans la note.</p>
            <button className="btn primary" onClick={() => setStarted(true)}>Prendre la main <ArrowRight size={16} className="arrow" /></button>
          </div>
        </div>
      </section>
    );
  }

  const over = spent > crisis.budgetMin;
  return (
    <section className="block">
      <div className="game-wrap">
        <GameHeader id="crise-j0" title={title} level={play.info.level} current={i} total={crisis.decisions.length} extra={<span className="tag mono" style={{ color: over ? 'var(--ko)' : undefined }}><Clock size={12} /> {spent}/{crisis.budgetMin} min</span>} />
        <div className="crisis-clock"><div style={{ width: `${Math.min(100, (spent / crisis.budgetMin) * 100)}%`, background: over ? 'var(--ko)' : undefined }} /></div>
        <div className="card q-card" style={{ marginTop: 16 }}>
          <span className="label">Décision {i + 1} / {crisis.decisions.length}</span>
          <h3 style={{ marginTop: 10 }}>{d.situation}</h3>
        </div>
        <div className="grid" style={{ gap: 10 }}>
          {d.choices.map((c, k) => {
            const cls = pick !== null ? (c.quality === 2 ? 'correct' : k === pick ? (c.quality === 1 ? 'selected' : 'wrong') : '') : '';
            return (
              <button key={k} className={`option ${cls}`} disabled={pick !== null} onClick={() => choose(k, c)}>
                <span className="key">{String.fromCharCode(65 + k)}</span>
                <span><b style={{ fontWeight: 400 }}>{c.label}</b><span className="desc">+{c.minutes} min</span></span>
              </button>
            );
          })}
        </div>
        {pick !== null && (
          <>
            <Feedback good={d.choices[pick].quality === 2}>
              <b>{d.choices[pick].quality === 2 ? 'Bonne décision.' : d.choices[pick].quality === 1 ? 'Acceptable, mais pas optimal.' : 'Mauvaise décision.'}</b>
              <div className="small muted">{d.choices[pick].feedback}</div>
            </Feedback>
            <div className="actions"><button className="btn primary" onClick={next}>{i + 1 >= crisis.decisions.length ? 'Voir le bilan' : 'Décision suivante'} <ArrowRight size={16} className="arrow" /></button></div>
          </>
        )}
      </div>
    </section>
  );
}

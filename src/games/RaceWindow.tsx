import { useMemo, useState, type CSSProperties } from 'react';
import { ArrowRight } from 'lucide-react';
import { Feedback, GameHeader, shuffle } from '../components/ui';
import { CodeBlock } from '../components/Code';
import { SeriesGame, SeriesScore, type SeriesPlay } from '../components/Series';
import { raceScenarios, raceSeries, type RaceOption, type RaceScenario } from '../data/game-races';

// Frise d'entrelacement : toutes les lectures passent avant les écritures,
// sauf une fois le correctif appliqué, où seule la première réussit.
function Timeline({ n, fixed }: { n: number; fixed: boolean }) {
  return (
    <div className="race-lanes" aria-label="Chronologie des requêtes concurrentes">
      {Array.from({ length: n }, (_, k) => {
        const stagger = k * 2.2;
        const blocked = fixed && k > 0;
        return (
          <div key={k} className="race-lane">
            <span className="lane-name">req {k + 1}</span>
            <div className="race-track">
              <span className="race-step read" style={{ left: `${2 + stagger}%`, animationDelay: `${k * 60}ms` } as CSSProperties}>{fixed ? 'UPDATE … WHERE' : 'lecture'}</span>
              {!fixed && <span className="race-step" style={{ left: `${30 + stagger}%`, animationDelay: `${200 + k * 60}ms` } as CSSProperties}>vérif. OK</span>}
              <span className={`race-step ${blocked ? 'blocked' : 'write'}`} style={{ left: `${(fixed ? 34 : 58) + stagger}%`, animationDelay: `${400 + k * 60}ms` } as CSSProperties}>
                {blocked ? '0 ligne · 409' : fixed ? '1 ligne · OK' : 'écriture'}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function RaceWindow() {
  return (
    <SeriesGame
      gameId="race-window"
      title="Race Window"
      set={raceSeries}
      unit="scénarios"
      intro={`Neuf séries, de la course check-then-act évidente aux limites distribuées où le verrou en mémoire ne voit qu’un processus. ${raceScenarios.length} scénarios, dont plusieurs tirés d’incidents réels et de recherches publiées.`}
    >
      {(play) => <Round play={play} />}
    </SeriesGame>
  );
}

function Round({ play }: { play: SeriesPlay<RaceScenario> }) {
  const rounds = useMemo(() => play.items.map((s) => ({ ...s, fixes: shuffle(s.fixes) })), [play.items]);
  const [i, setI] = useState(0);
  const [outcome, setOutcome] = useState<number | null>(null);
  const [fix, setFix] = useState<number | null>(null);
  const [points, setPoints] = useState(0);
  const [done, setDone] = useState(false);

  const r = rounds[i];

  const pickOutcome = (k: number) => {
    if (outcome !== null) return;
    setOutcome(k);
    if (r.outcomes[k].right) setPoints(points + 0.4);
  };
  const pickFix = (k: number) => {
    if (fix !== null) return;
    setFix(k);
    if (r.fixes[k].right) setPoints(points + 0.6);
  };
  const next = () => {
    if (i + 1 >= rounds.length) {
      play.finish(Math.round((points / rounds.length) * 100));
      setDone(true);
    } else { setI(i + 1); setOutcome(null); setFix(null); }
  };

  if (done) {
    const pct = Math.round((points / rounds.length) * 100);
    return <SeriesScore play={play} pct={pct} title={`${pct} % de fenêtres refermées`} />;
  }

  const options = (list: RaceOption[], chosen: number | null, onPick: (k: number) => void) => (
    <div className="grid" style={{ gap: 10 }}>
      {list.map((o, k) => {
        const cls = chosen !== null ? (o.right ? 'correct' : k === chosen ? 'wrong' : '') : '';
        return (
          <button key={k} className={`option ${cls}`} disabled={chosen !== null} onClick={() => onPick(k)}>
            <span className="key">{String.fromCharCode(65 + k)}</span>
            <span><b style={{ fontWeight: 500 }}>{o.label}</b>{chosen !== null && (o.right || k === chosen) && <span className="desc">{o.why}</span>}</span>
          </button>
        );
      })}
    </div>
  );

  const fixRight = fix !== null && r.fixes[fix].right;

  return (
    <section className="block">
      <div className="game-wrap wide">
        <GameHeader
          id="race-window"
          title={`Race Window · ${play.info.title}`}
          level={play.info.level}
          current={i}
          total={rounds.length}
          extra={<span className="tag mono">{Math.round(points * 100)} pts</span>}
        />
        <div className="card q-card">
          <span className="label">{r.requests} requêtes simultanées</span>
          <h3 style={{ marginTop: 10 }}>{r.title}</h3>
          <p className="muted small" style={{ margin: '8px 0 0' }}>{r.context}</p>
        </div>
        <CodeBlock code={r.code} lang="ts" />
        <p className="q-hint">{r.question}</p>
        {options(r.outcomes, outcome, pickOutcome)}
        {outcome !== null && (
          <>
            <Timeline n={r.requests} fixed={fixRight} />
            <p className="small dim" style={{ marginTop: -6 }}>{fixRight ? 'Avec le correctif : une seule opération atomique réussit, les autres modifient zéro ligne.' : r.timeline}</p>
            <p className="q-hint">Quel correctif ferme la fenêtre, avec plusieurs instances de l’API ?</p>
            {options(r.fixes, fix, pickFix)}
          </>
        )}
        {fix !== null && (
          <>
            <Feedback good={fixRight}><b>{fixRight ? 'La fenêtre est fermée.' : 'La fenêtre reste ouverte.'}</b></Feedback>
            <div className="actions"><button className="btn primary" onClick={next}>Continuer <ArrowRight size={16} className="arrow" /></button></div>
          </>
        )}
      </div>
    </section>
  );
}

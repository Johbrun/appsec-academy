import { useMemo, useState } from 'react';
import { ArrowRight, Check, FileText } from 'lucide-react';
import { Feedback, GameHeader, shuffle } from '../components/ui';
import { SeriesGame, SeriesScore, type SeriesPlay } from '../components/Series';
import { ctiSeries, type CtiReport } from '../data/game-cti';
import { technique } from '../data/attack';

export default function CtiMapper() {
  return (
    <SeriesGame
      gameId="cti-mapper"
      title="CTI Mapper"
      set={ctiSeries}
      unit="rapports"
      intro="Six séries de rapports fictifs inspirés de cas réels. Cochez toutes les techniques ATT&CK v19 décrites dans l’extrait : chaque bonne case rapporte un point, chaque case cochée à tort en retire un. Le score ne descend pas sous zéro par rapport."
    >
      {(play) => <Round play={play} />}
    </SeriesGame>
  );
}

function Round({ play }: { play: SeriesPlay<CtiReport> }) {
  const rounds = useMemo(() => play.items.map((rep) => ({
    ...rep,
    chips: shuffle([...rep.correct, ...rep.decoys]),
  })), [play.items]);
  const [i, setI] = useState(0);
  const [sel, setSel] = useState<string[]>([]);
  const [checked, setChecked] = useState(false);
  const [points, setPoints] = useState(0);
  const [done, setDone] = useState(false);

  const r = rounds[i];
  const maxPoints = rounds.reduce((acc, x) => acc + x.correct.length, 0);
  const roundScore = Math.max(0,
    sel.filter((s) => r.correct.includes(s)).length - sel.filter((s) => !r.correct.includes(s)).length);

  const toggle = (id: string) => { if (!checked) setSel(sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]); };
  const check = () => { setChecked(true); setPoints(points + roundScore); };
  const next = () => {
    if (i + 1 >= rounds.length) {
      play.finish(Math.round((points / maxPoints) * 100));
      setDone(true);
    } else { setI(i + 1); setSel([]); setChecked(false); }
  };

  if (done) {
    return <SeriesScore play={play} pct={Math.round((points / maxPoints) * 100)} title={`${points} / ${maxPoints} techniques cartographiées`} />;
  }

  return (
    <section className="block">
      <div className="game-wrap wide">
        <GameHeader id="cti-mapper" title={`CTI Mapper · ${play.info.title}`} level={play.info.level} current={i} total={rounds.length}
          extra={<span className="tag mono">{points} / {maxPoints}</span>} />
        <article className="card q-card report">
          <div className="row between" style={{ marginBottom: 14 }}>
            <span className="row nowrap" style={{ gap: 10 }}><span className="tile"><FileText size={17} /></span><b style={{ fontWeight: 500 }}>{r.title}</b></span>
            <span className="tag mono">TLP:CLEAR · fictif</span>
          </div>
          <p className="m0" style={{ lineHeight: 1.8 }}>{r.report}</p>
        </article>
        <p className="q-hint">Cochez toutes les techniques décrites. Une case cochée à tort retire un point.</p>
        <div className="grid g2" style={{ gap: 8 }}>
          {r.chips.map((id) => {
            const t = technique(id);
            const on = sel.includes(id);
            const cls = checked ? (r.correct.includes(id) ? 'correct' : on ? 'wrong' : '') : on ? 'selected' : '';
            return (
              <button key={id} className={`option ${cls}`} onClick={() => toggle(id)} disabled={checked} aria-pressed={on}>
                <span className={`cb ${on ? 'on' : ''}`}><Check size={12} strokeWidth={3} /></span>
                <span className="tag id">{id}</span>
                <span className="small" style={{ fontWeight: 500 }}>{t.nameFr}</span>
              </button>
            );
          })}
        </div>
        {!checked && <div className="actions"><button className="btn primary" disabled={!sel.length} onClick={check}>Valider le mapping</button></div>}
        {checked && (
          <>
            <Feedback good={roundScore === r.correct.length}>
              <b>{roundScore} / {r.correct.length} points</b>
              <div className="small muted">Techniques attendues : {r.correct.map((id) => `${id} (${technique(id).nameFr})`).join(', ')}.</div>
            </Feedback>
            <div className="actions"><button className="btn primary" onClick={next}>{i + 1 >= rounds.length ? 'Voir le résultat' : 'Rapport suivant'} <ArrowRight size={16} className="arrow" /></button></div>
          </>
        )}
      </div>
    </section>
  );
}

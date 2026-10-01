import { useMemo, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Feedback, GameHeader, shuffle } from '../components/ui';
import { SeriesGame, SeriesScore, type SeriesPlay } from '../components/Series';
import { pushbackSeries, type Scene } from '../data/game-pushback';

function Gauge({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.max(0, Math.min(100, 50 + (value / max) * 50));
  return (
    <div className="gauge">
      <span className="label">{label}</span>
      <div className="gauge-track"><div className="gauge-mid" /><div className="gauge-fill" style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

export default function Pushback() {
  return (
    <SeriesGame
      gameId="pushback"
      title="Pushback"
      set={pushbackSeries}
      unit="scènes"
      intro="Neuf séries : une par interlocuteur, puis par difficulté. Au premier niveau, l’objection repose sur une idée fausse ; au dernier, elle a en partie raison, et la réponse la plus ferme est souvent le piège."
    >
      {(play) => <Round play={play} />}
    </SeriesGame>
  );
}

function Round({ play }: { play: SeriesPlay<Scene> }) {
  // Les réponses sont rebattues à chaque partie : la bonne ne doit pas se
  // retrouver toujours à la même place.
  const rounds = useMemo(() => play.items.map((s) => ({ ...s, replies: shuffle(s.replies) })), [play.items]);
  const [i, setI] = useState(0);
  const [pick, setPick] = useState<number | null>(null);
  const [points, setPoints] = useState(0);
  const [trust, setTrust] = useState(0);
  const [risk, setRisk] = useState(0);
  const [done, setDone] = useState(false);

  const s = rounds[i];
  const choose = (k: number) => {
    if (pick !== null) return;
    const r = s.replies[k];
    setPick(k);
    setPoints(points + r.points);
    setTrust(trust + r.trust);
    setRisk(risk + r.risk);
  };
  const next = () => {
    if (i + 1 >= rounds.length) {
      setDone(true);
      play.finish(Math.round((points / (2 * rounds.length)) * 100));
    } else { setI(i + 1); setPick(null); }
  };

  if (done) {
    const pct = Math.round((points / (2 * rounds.length)) * 100);
    return (
      <SeriesScore play={play} pct={pct} title="Fin de la semaine chez Novafact">
        <div style={{ maxWidth: 360, margin: '0 auto 8px' }}>
          <Gauge label="Confiance des équipes" value={trust} max={rounds.length} />
          <Gauge label="Risque réduit" value={risk} max={2 * rounds.length} />
        </div>
      </SeriesScore>
    );
  }

  const r = pick !== null ? s.replies[pick] : null;
  return (
    <section className="block">
      <div className="game-wrap wide">
        <GameHeader id="pushback" title={`Pushback · ${play.info.title}`} level={play.info.level} current={i} total={rounds.length} />
        <div className="gauges">
          <Gauge label="Confiance des équipes" value={trust} max={rounds.length} />
          <Gauge label="Risque réduit" value={risk} max={2 * rounds.length} />
        </div>
        <div className="card q-card speaker">
          <div className="row between">
            <span className="label">{s.role}</span>
            <span className="label">{s.context}</span>
          </div>
          <div className="bubble">
            <b>{s.who}</b>
            <p>« {s.objection} »</p>
          </div>
        </div>
        <p className="q-hint">Que réponds-tu ?</p>
        <div className="grid" style={{ gap: 10 }}>
          {s.replies.map((rep, k) => {
            const cls = pick !== null ? (rep.points === 2 ? 'correct' : k === pick ? (rep.points === 1 ? 'selected' : 'wrong') : '') : '';
            return (
              <button key={k} className={`option ${cls}`} disabled={pick !== null} onClick={() => choose(k)}>
                <span className="key">{String.fromCharCode(65 + k)}</span>
                <span>{rep.text}{pick !== null && (k === pick || rep.points === 2) && <span className="desc">{rep.why}</span>}</span>
              </button>
            );
          })}
        </div>
        {r && (
          <>
            <Feedback good={r.points === 2}>
              <b>{r.points === 2 ? 'Ça avance, et l’équipe reste avec toi.' : r.points === 1 ? 'Acceptable, mais il y avait mieux.' : 'Contre-productif.'}</b>
              <div className="small muted">Confiance {r.trust > 0 ? '+1' : r.trust < 0 ? '−1' : '='} · Risque {r.risk > 0 ? `réduit (+${r.risk})` : r.risk < 0 ? 'accru' : 'inchangé'}</div>
            </Feedback>
            <div className="actions"><button className="btn primary" onClick={next}>Continuer <ArrowRight size={16} className="arrow" /></button></div>
          </>
        )}
      </div>
    </section>
  );
}

import { useMemo, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Feedback, GameHeader, shuffle } from '../components/ui';
import { SeriesGame, SeriesScore, type SeriesPlay } from '../components/Series';
import { shownTactic, tacticSeries, type TacticItem } from '../data/game-attack-tactics';
import { tactic, technique, type TacticId } from '../data/attack';

export default function AttackTactics() {
  return (
    <SeriesGame
      gameId="attack-tactics"
      title="Tri des tactiques"
      set={tacticSeries}
      unit="techniques"
      intro="Sept séries sur ATT&CK v19, des noms qui disent leur tactique jusqu’aux pièges de la scission entre Stealth et Defense Impairment. Une technique, une procédure observée : quel but sert-elle ? Pour une technique à plusieurs tactiques, une seule des tactiques valides est proposée."
    >
      {(play) => <Round play={play} />}
    </SeriesGame>
  );
}

function Round({ play }: { play: SeriesPlay<TacticItem> }) {
  const rounds = useMemo(() => play.items.map((it) => ({
    ...it,
    options: shuffle<TacticId>([shownTactic(it), ...it.decoys]),
  })), [play.items]);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<TacticId | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  const r = rounds[i];
  const t = technique(r.technique);
  const good = (id: TacticId) => t.tactics.includes(id);

  const pick = (id: TacticId) => {
    if (picked) return;
    setPicked(id);
    if (good(id)) setScore((s) => s + 1);
  };
  const next = () => {
    if (i + 1 >= rounds.length) {
      play.finish(Math.round((score / rounds.length) * 100));
      setDone(true);
    } else { setI(i + 1); setPicked(null); }
  };

  if (done) {
    return <SeriesScore play={play} pct={Math.round((score / rounds.length) * 100)} title={`${score} / ${rounds.length} techniques bien rangées`} />;
  }

  const all = t.tactics.map((id) => tactic(id));
  return (
    <section className="block">
      <div className="game-wrap">
        <GameHeader id="attack-tactics" title={`Tri des tactiques · ${play.info.title}`} level={play.info.level} current={i} total={rounds.length}
          extra={<span className="tag mono">{score} / {rounds.length}</span>} />
        <div className="card q-card">
          <div className="row between">
            <span className="tag id">{t.id}</span>
            <span className="label">ATT&CK v19</span>
          </div>
          <h3 style={{ margin: '14px 0 4px' }}>{t.name}</h3>
          <p className="small dim" style={{ margin: 0 }}>{t.nameFr}</p>
          <p className="muted small" style={{ margin: '14px 0 0' }}>{r.procedure}</p>
        </div>
        <p className="q-hint">Quelle tactique cette technique sert-elle ?</p>
        <div className="grid g2" style={{ gap: 10 }}>
          {r.options.map((id, k) => {
            const tac = tactic(id);
            const cls = picked ? (good(id) ? 'correct' : id === picked ? 'wrong' : '') : '';
            return (
              <button key={id} className={`option ${cls}`} disabled={!!picked} onClick={() => pick(id)}>
                <span className="key">{k + 1}</span>
                <span><b style={{ fontWeight: 500 }}>{tac.nameFr}</b><span className="desc">{tac.name} · {tac.id}</span></span>
              </button>
            );
          })}
        </div>
        {picked && (
          <>
            <Feedback good={good(picked)}>
              <b>{good(picked) ? 'Exact.' : `Non : ${tactic(shownTactic(r)).nameFr}.`}</b>
              <div className="small muted">{r.note}</div>
              {all.length > 1 && (
                <div className="small dim" style={{ marginTop: 6 }}>
                  Tactiques d’ATT&CK pour {t.id} : {all.map((x) => `${x.nameFr} (${x.id})`).join(', ')}.
                </div>
              )}
            </Feedback>
            <div className="actions"><button className="btn primary" onClick={next}>{i + 1 >= rounds.length ? 'Voir le score' : 'Continuer'} <ArrowRight size={16} className="arrow" /></button></div>
          </>
        )}
      </div>
    </section>
  );
}

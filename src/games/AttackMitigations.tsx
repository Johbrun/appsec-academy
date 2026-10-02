import { useMemo, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Feedback, GameHeader, shuffle } from '../components/ui';
import { SeriesGame, SeriesScore, type SeriesPlay } from '../components/Series';
import { rampartSeries, type Rampart, type RampartItem } from '../data/game-attack-mitigations';
import { mitigation, tactic, technique } from '../data/attack';

export default function AttackMitigations() {
  return (
    <SeriesGame
      gameId="attack-mitigations"
      title="Le bon rempart"
      set={rampartSeries}
      unit="scénarios"
      intro="Six séries sur ATT&CK v19, des leurres qui visent une autre étape jusqu’aux cas où la MFA est proposée et ne sert à rien. Une technique observée, quatre mesures : une seule casse vraiment la technique, et elle relève d’une mitigation qu’ATT&CK lui relie."
    >
      {(play) => <Round play={play} />}
    </SeriesGame>
  );
}

function Round({ play }: { play: SeriesPlay<RampartItem> }) {
  const rounds = useMemo(() => play.items.map((it) => ({
    ...it,
    right: it.options[0],
    shown: shuffle(it.options),
  })), [play.items]);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<Rampart | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  const r = rounds[i];
  const t = technique(r.technique);

  const pick = (o: Rampart) => {
    if (picked) return;
    setPicked(o);
    if (o === r.right) setScore((s) => s + 1);
  };
  const next = () => {
    if (i + 1 >= rounds.length) {
      play.finish(Math.round((score / rounds.length) * 100));
      setDone(true);
    } else { setI(i + 1); setPicked(null); }
  };

  if (done) {
    return <SeriesScore play={play} pct={Math.round((score / rounds.length) * 100)} title={`${score} / ${rounds.length} remparts bien choisis`} />;
  }

  const good = picked === r.right;
  return (
    <section className="block">
      <div className="game-wrap">
        <GameHeader id="attack-mitigations" title={`Le bon rempart · ${play.info.title}`} level={play.info.level} current={i} total={rounds.length}
          extra={<span className="tag mono">{score} / {rounds.length}</span>} />
        <div className="card q-card">
          <div className="row between">
            <span className="tag id">{t.id}</span>
            <span className="label">{t.tactics.map((x) => tactic(x).nameFr).join(' · ')}</span>
          </div>
          <h3 style={{ margin: '14px 0 4px' }}>{t.name}</h3>
          <p className="small dim" style={{ margin: 0 }}>{t.nameFr}</p>
          <p className="muted small" style={{ margin: '14px 0 0' }}>{r.situation}</p>
        </div>
        <p className="q-hint">Quelle mesure casse cette technique ici ?</p>
        <div className="grid" style={{ gap: 10 }}>
          {r.shown.map((o, k) => {
            const cls = picked ? (o === r.right ? 'correct' : o === picked ? 'wrong' : '') : '';
            return (
              <button key={o.text} className={`option ${cls}`} disabled={!!picked} onClick={() => pick(o)}>
                <span className="key">{String.fromCharCode(65 + k)}</span>
                <span>
                  <b style={{ fontWeight: 500 }}>{o.text}</b>
                  {picked && <span className="desc">{o.m} · {mitigation(o.m).nameFr}{o.flaw ? ` : ${o.flaw}` : ''}</span>}
                </span>
              </button>
            );
          })}
        </div>
        {picked && (
          <>
            <Feedback good={good}>
              <b>{good ? 'Exact.' : `Non : ${r.right.text.charAt(0).toLowerCase()}${r.right.text.slice(1)}.`}</b>
              <div className="small muted">{r.why}</div>
            </Feedback>
            <div className="actions"><button className="btn primary" onClick={next}>{i + 1 >= rounds.length ? 'Voir le score' : 'Continuer'} <ArrowRight size={16} className="arrow" /></button></div>
          </>
        )}
      </div>
    </section>
  );
}

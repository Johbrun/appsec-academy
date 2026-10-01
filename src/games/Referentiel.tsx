import { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Feedback, GameHeader } from '../components/ui';
import { SeriesGame, SeriesScore, type SeriesPlay } from '../components/Series';
import { refSeries, referentiels, type RefItem } from '../data/game-referentiel';

const SECONDS = 120;

export default function Referentiel() {
  return (
    <SeriesGame
      gameId="referentiel"
      title="Quel référentiel ?"
      set={refSeries}
      unit="intitulés"
      intro="Huit séries, des intitulés qui portent le nom de leur liste jusqu’aux faux amis qui en évoquent une autre. Sept référentiels OWASP, un seul bon à chaque fois, deux minutes par série."
    >
      {(play) => <Round play={play} />}
    </SeriesGame>
  );
}

function Round({ play }: { play: SeriesPlay<RefItem> }) {
  const rounds = play.items;
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [left, setLeft] = useState(SECONDS);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (done) return;
    if (left <= 0) { finish(score); return; }
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [left, done]);

  function finish(final: number) {
    setDone(true);
    play.finish(Math.round((final / rounds.length) * 100));
  }

  const r = rounds[i];
  const pick = (id: string) => {
    if (picked) return;
    setPicked(id);
    if (id === r.ref) setScore(score + 1);
  };
  const next = () => {
    if (i + 1 >= rounds.length) finish(score);
    else { setI(i + 1); setPicked(null); }
  };

  if (done) return <SeriesScore play={play} pct={Math.round((score / rounds.length) * 100)} title={`${score} / ${rounds.length} bien rangés`} />;

  const right = referentiels.find((x) => x.id === r.ref)!;
  return (
    <section className="block">
      <div className="game-wrap">
        <GameHeader id="referentiel" title={`Quel référentiel ? · ${play.info.title}`} level={play.info.level} current={i} total={rounds.length}
          extra={<span className={`timer ${left <= 15 ? 'urgent' : ''}`}><span className="led pulse" />{Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}</span>} />
        <div className="card q-card center">
          <span className="label">Risque, menace ou chapitre</span>
          <h2 style={{ margin: '14px 0 0' }}>{r.label}</h2>
        </div>
        <p className="q-hint">Dans quel référentiel OWASP le trouve-t-on sous cet intitulé exact ?</p>
        <div className="grid g2" style={{ gap: 10 }}>
          {referentiels.map((ref, k) => {
            const cls = picked ? (ref.id === r.ref ? 'correct' : ref.id === picked ? 'wrong' : '') : '';
            return (
              <button key={ref.id} className={`option ${cls}`} disabled={!!picked} onClick={() => pick(ref.id)}>
                <span className="key">{k + 1}</span>
                <span><b style={{ fontWeight: 500 }}>{ref.short}</b><span className="desc">{ref.name}</span></span>
              </button>
            );
          })}
        </div>
        {picked && (
          <>
            <Feedback good={picked === r.ref}>
              <b>{picked === r.ref ? 'Exact.' : `Non : ${right.name}.`}</b>
              <div className="small muted">{r.note}</div>
            </Feedback>
            <div className="actions"><button className="btn primary" onClick={next}>Continuer <ArrowRight size={16} className="arrow" /></button></div>
          </>
        )}
      </div>
    </section>
  );
}

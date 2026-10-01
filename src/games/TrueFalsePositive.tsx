import { useMemo, useState } from 'react';
import { ArrowRight, Bug, ShieldCheck } from 'lucide-react';
import { Feedback, GameHeader, shuffle } from '../components/ui';
import { CodeBlock } from '../components/Code';
import { SeriesGame, SeriesScore, type SeriesPlay } from '../components/Series';
import { findingSeries, type Finding } from '../data/game-findings';

export default function TrueFalsePositive() {
  return (
    <SeriesGame
      gameId="true-false-positive"
      title="True or False Positive"
      set={findingSeries}
      unit="findings"
      intro="Huit séries, du premier tri au sanitizer trompeur. Des findings SAST, secrets et IA avec leur trace : vrai ou faux positif, et pourquoi ? Plusieurs cas s’inspirent d’incidents publics."
    >
      {(play) => <Round play={play} />}
    </SeriesGame>
  );
}

function Round({ play }: { play: SeriesPlay<Finding> }) {
  const rounds = play.items;
  // L'ordre des justifications est retiré à chaque partie : la bonne ne doit pas
  // rester à la même place.
  const optionSets = useMemo(() => rounds.map((f) => shuffle(f.reasons)), [rounds]);

  const [i, setI] = useState(0);
  const [verdict, setVerdict] = useState<'tp' | 'fp' | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  const r = rounds[i];
  const options = optionSets[i];
  const total = rounds.length * 2;
  const verdictOk = verdict === r.verdict;
  const reasonOk = reason === r.reasons[0];

  const pickVerdict = (v: 'tp' | 'fp') => { if (verdict) return; setVerdict(v); if (v === r.verdict) setScore((s) => s + 1); };
  const pickReason = (x: string) => { if (reason) return; setReason(x); if (x === r.reasons[0]) setScore((s) => s + 1); };
  const next = () => {
    if (i + 1 >= rounds.length) {
      play.finish(Math.round((score / total) * 100));
      setDone(true);
    } else { setI(i + 1); setVerdict(null); setReason(null); }
  };

  if (done) {
    const pct = Math.round((score / total) * 100);
    return <SeriesScore play={play} pct={pct} title={`${score} / ${total} : findings triés et justifiés`} />;
  }

  const label = (v: 'tp' | 'fp') => (v === 'tp' ? 'vrai positif' : 'faux positif');

  return (
    <section className="block">
      <div className="game-wrap wide">
        <GameHeader
          id="true-false-positive"
          title={`True or False Positive · ${play.info.title}`}
          level={play.info.level}
          current={i}
          total={rounds.length}
          extra={<span className="tag mono">{score} / {total}</span>}
        />
        <div className="card finding-card">
          <div className="finding-meta">
            <span className="tag mono">{r.tool}</span>
            <span className="mono small dim">{r.rule}</span>
          </div>
          <p className="m0">{r.message}</p>
        </div>
        <CodeBlock code={r.code} lang={r.lang} file={r.file} hl={r.hl} />
        {r.trace && (
          <ol className="taint-trace">
            {r.trace.map((t, k) => <li key={k} className="mono small">{t}</li>)}
          </ol>
        )}
        <p className="q-hint">{verdict ? 'Pourquoi ?' : 'Ton verdict ?'}</p>
        <div className="grid g2" style={{ gap: 10 }}>
          {(['tp', 'fp'] as const).map((v) => {
            const cls = verdict ? (v === r.verdict ? 'correct' : v === verdict ? 'wrong' : '') : '';
            return (
              <button key={v} className={`option ${cls}`} disabled={!!verdict} onClick={() => pickVerdict(v)}>
                <span className="key">{v === 'tp' ? <Bug size={14} /> : <ShieldCheck size={14} />}</span>
                <span><b style={{ fontWeight: 500 }}>{v === 'tp' ? 'Vrai positif' : 'Faux positif'}</b><span className="desc">{v === 'tp' ? 'Exploitable : ticket et correction' : 'Pas exploitable ici : on documente et on règle l’outil'}</span></span>
              </button>
            );
          })}
        </div>
        {verdict && (
          <>
            <Feedback good={verdictOk}><b>{verdictOk ? 'Bon verdict.' : `C’est un ${label(r.verdict)}.`}</b></Feedback>
            <div className="grid" style={{ gap: 10, marginTop: 16 }}>
              {options.map((x, k) => {
                const cls = reason ? (x === r.reasons[0] ? 'correct' : x === reason ? 'wrong' : '') : '';
                return (
                  <button key={x} className={`option ${cls}`} disabled={!!reason} onClick={() => pickReason(x)}>
                    <span className="key">{String.fromCharCode(65 + k)}</span>
                    <span><b style={{ fontWeight: 500 }}>{x}</b></span>
                  </button>
                );
              })}
            </div>
          </>
        )}
        {reason && (
          <>
            <Feedback good={reasonOk}>
              <b>{reasonOk ? 'Bonne justification.' : 'La bonne justification est celle en vert.'}</b>
              <div className="small muted">{r.why}</div>
              {r.real && <div className="small muted" style={{ marginTop: 6 }}>Inspiré d’un cas réel : {r.real}.</div>}
            </Feedback>
            <div className="actions"><button className="btn primary" onClick={next}>{i + 1 >= rounds.length ? 'Voir le score' : 'Finding suivant'} <ArrowRight size={16} className="arrow" /></button></div>
          </>
        )}
      </div>
    </section>
  );
}

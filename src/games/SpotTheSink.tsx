import { useMemo, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Feedback, GameHeader, shuffle } from '../components/ui';
import { ClickableCode } from '../components/Code';
import { SeriesGame, SeriesScore, type SeriesPlay } from '../components/Series';
import { cweNames, sinkSeries, type Snippet } from '../data/sinks';

export default function SpotTheSink() {
  return (
    <SeriesGame
      gameId="spot-the-sink"
      title="Spot the Sink"
      set={sinkSeries}
      unit="extraits"
      intro="Dix séries, de la reconnaissance de motif à la revue de code. Elles mélangent toutes les familles de vulnérabilités : on ne sait pas ce qu’on va trouver, et c’est le but."
    >
      {(play) => <Round play={play} />}
    </SeriesGame>
  );
}

function Round({ play }: { play: SeriesPlay<Snippet> }) {
  const rounds = play.items;
  // L'ordre des CWE est retiré à chaque partie : la bonne ne doit pas se
  // retrouver toujours à la même place.
  const options = useMemo(() => rounds.map((r) => shuffle(r.options)), [rounds]);

  const [i, setI] = useState(0);
  const [line, setLine] = useState<number | null>(null);
  const [cwe, setCwe] = useState<string | null>(null);
  const [points, setPoints] = useState(0);
  const [done, setDone] = useState(false);

  const r = rounds[i];

  const lineOk = line === r.line;
  const cweOk = cwe === r.cwe;

  const pickCwe = (id: string) => {
    if (cwe) return;
    setCwe(id);
    setPoints(points + (lineOk ? 0.5 : 0) + (id === r.cwe ? 0.5 : 0));
  };

  const next = () => {
    if (i + 1 >= rounds.length) {
      play.finish(Math.round((points / rounds.length) * 100));
      setDone(true);
    } else {
      setI(i + 1); setLine(null); setCwe(null);
    }
  };

  if (done) {
    const pct = Math.round((points / rounds.length) * 100);
    return <SeriesScore play={play} pct={pct} title={`${points.toFixed(1).replace('.0', '')} / ${rounds.length} points`} />;
  }

  const lineClass = (n: number) => {
    if (line === null) return '';
    if (n === r.line) return 'right';
    if (n === line) return 'wrong';
    // Les leurres ne se révèlent qu'une fois la réponse donnée : les montrer
    // avant reviendrait à désigner les lignes à regarder.
    if (cwe && (r.decoys ?? []).includes(n)) return 'decoy';
    return '';
  };

  return (
    <section className="block">
      <div className="game-wrap wide">
        <GameHeader
          id="spot-the-sink"
          title={`Spot the Sink · ${play.info.title}`}
          level={play.info.level}
          current={i}
          total={rounds.length}
          extra={<span className="tag mono">{points.toFixed(1).replace('.0', '')} pts</span>}
        />
        <p className="q-hint" style={{ marginTop: 0 }}>
          {line === null ? 'Clique sur la ligne vulnérable.' : 'Quelle faiblesse (CWE) décrit cette ligne ?'}
        </p>
        <ClickableCode
          code={r.code} lang={r.lang} file={r.file}
          lineClass={lineClass} onLine={(n) => setLine(n)} locked={line !== null}
        />
        {line !== null && (
          <>
            <Feedback good={lineOk}>
              <b>{lineOk ? 'Bonne ligne.' : `C’était la ligne ${r.line}.`}</b>
            </Feedback>
            <div className="grid g2" style={{ gap: 10, marginTop: 16 }}>
              {options[i].map((id, k) => {
                const cls = cwe ? (id === r.cwe ? 'correct' : id === cwe ? 'wrong' : '') : '';
                return (
                  <button key={id} className={`option ${cls}`} disabled={!!cwe} onClick={() => pickCwe(id)}>
                    <span className="key">{String.fromCharCode(65 + k)}</span>
                    <span>
                      <b style={{ fontWeight: 500 }} className="mono">{id}</b>
                      <span className="desc">{cweNames[id] ?? ''}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}
        {cwe && (
          <>
            <Feedback good={cweOk}>
              <b>{cweOk ? 'Exact.' : `Non : ${r.cwe}, ${cweNames[r.cwe]}.`}</b>
              <div className="small muted">{r.explain}</div>
              {(r.decoys ?? []).length > 0 && (
                <div className="small muted" style={{ marginTop: 6 }}>
                  Lignes {r.decoys!.join(' et ')} : elles attirent l’œil, elles sont saines.
                </div>
              )}
            </Feedback>
            <div className="actions">
              <button className="btn primary" onClick={next}>
                Continuer <ArrowRight size={16} className="arrow" />
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

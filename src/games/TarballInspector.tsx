import { useMemo, useState } from 'react';
import { ArrowRight, PackageCheck } from 'lucide-react';
import { Feedback, GameHeader, shuffle } from '../components/ui';
import { ClickableCode } from '../components/Code';
import { SeriesGame, SeriesScore, type SeriesPlay } from '../components/Series';
import { sourceLabels, tarballSeries, type TarballCase, type TarballView } from '../data/game-tarball';

// Une désignation : une ligne « vue:ligne », ou « l'archive est saine ».
type Pick = string | 'sain';

export default function TarballInspector() {
  return (
    <SeriesGame
      gameId="tarball-inspector"
      title="Tarball Inspector"
      set={tarballSeries}
      unit="archives"
      intro="Ce qui s’installe, c’est l’archive du registre, pas le dépôt GitHub. Comparez-les, désignez la ligne qui trahit la compromission ou déclarez l’archive saine, puis nommez le mécanisme. Certaines archives diffèrent du dépôt pour de bonnes raisons."
    >
      {(play) => <Round play={play} />}
    </SeriesGame>
  );
}

const viewTitle = (v: TarballView) => `${sourceLabels[v.src]}${v.tag ? ` ${v.tag}` : ''} · ${v.path}`;

function where(c: TarballCase, key: string) {
  const [view, line] = key.split(':').map(Number);
  return `${c.views[view].path}, ligne ${line}`;
}

function Round({ play }: { play: SeriesPlay<TarballCase> }) {
  const rounds = play.items;
  // Options retirées à chaque partie : la bonne est toujours la première du fichier.
  const options = useMemo(() => rounds.map((r) => shuffle(r.options)), [rounds]);

  const [i, setI] = useState(0);
  const [pick, setPick] = useState<Pick | null>(null);
  const [choice, setChoice] = useState<string | null>(null);
  const [points, setPoints] = useState(0);
  const [done, setDone] = useState(false);

  const r = rounds[i];
  const pickOk = pick !== null && (r.sain ? pick === 'sain' : pick !== 'sain' && r.hitKeys.includes(pick));
  const right = r.options[0];

  const choose = (o: string) => {
    if (choice) return;
    setChoice(o);
    setPoints(points + (pickOk ? 0.5 : 0) + (o === right ? 0.5 : 0));
  };

  const next = () => {
    if (i + 1 >= rounds.length) {
      play.finish(Math.round((points / rounds.length) * 100));
      setDone(true);
    } else {
      setI(i + 1); setPick(null); setChoice(null);
    }
  };

  const fmt = (p: number) => p.toFixed(1).replace('.0', '');

  if (done) {
    const pct = Math.round((points / rounds.length) * 100);
    return <SeriesScore play={play} pct={pct} title={`${fmt(points)} / ${rounds.length} points`} />;
  }

  const lineClass = (view: number) => (n: number) => {
    if (pick === null) return '';
    const key = `${view}:${n}`;
    if (r.hitKeys.includes(key)) return 'right';
    if (key === pick) return 'wrong';
    // Comme dans Spot the Sink : les leurres ne se montrent qu'après la
    // réponse complète, sinon ils désigneraient les lignes à regarder.
    if (choice && r.decoyKeys.includes(key)) return 'decoy';
    return '';
  };

  const pickVerdict = () => {
    if (pickOk) return r.sain ? 'Exact : cette archive est saine.' : 'Exact : c’est la ligne qui la trahit.';
    if (r.sain) return 'Non : cette archive est saine, l’écart désigné est légitime.';
    return `Elle est vérolée. À désigner : ${r.hitKeys.map((k) => where(r, k)).join(' ou ')}.`;
  };

  return (
    <section className="block">
      <div className="game-wrap wide">
        <GameHeader
          id="tarball-inspector"
          title={`Tarball Inspector · ${play.info.title}`}
          level={play.info.level}
          current={i}
          total={rounds.length}
          extra={<span className="tag mono">{fmt(points)} pts</span>}
        />
        <div className="card q-card">
          <span className="label mono">{r.pkg}</span>
          <p className="muted small" style={{ margin: '8px 0 0' }}>{r.context}</p>
        </div>
        <p className="q-hint">
          {pick === null
            ? 'Cliquez sur la ligne qui trahit la compromission, ou déclarez l’archive saine.'
            : r.sain ? 'Pourquoi cette archive est-elle saine ?' : 'Quel mécanisme cette ligne révèle-t-elle ?'}
        </p>
        <div className="grid" style={{ gap: 12 }}>
          {r.views.map((v, k) => (
            <ClickableCode
              key={`${r.id}-${k}`}
              code={v.code} lang={v.lang} file={viewTitle(v)}
              lineClass={lineClass(k)} onLine={(n) => setPick(`${k}:${n}`)} locked={pick !== null}
            />
          ))}
        </div>
        {pick === null && (
          <div className="actions">
            <button className="btn" onClick={() => setPick('sain')}>
              <PackageCheck size={16} /> Rien ne la trahit : archive saine
            </button>
          </div>
        )}
        {pick !== null && (
          <>
            <Feedback good={pickOk}>
              <b>{pickVerdict()}</b>
            </Feedback>
            <div className="grid g2" style={{ gap: 10, marginTop: 16 }}>
              {options[i].map((o, k) => {
                const cls = choice ? (o === right ? 'correct' : o === choice ? 'wrong' : '') : '';
                return (
                  <button key={o} className={`option ${cls}`} disabled={!!choice} onClick={() => choose(o)}>
                    <span className="key">{String.fromCharCode(65 + k)}</span>
                    <span><b style={{ fontWeight: 500 }}>{o}</b></span>
                  </button>
                );
              })}
            </div>
          </>
        )}
        {choice && (
          <>
            <Feedback good={choice === right}>
              <b>{choice === right ? 'Exact.' : `Non : ${right}.`}</b>
              <div className="small muted">{r.explain}</div>
              {r.real && (
                <div className="small muted" style={{ marginTop: 6 }}>
                  <b>Cas réel.</b> {r.real.text} <span className="dim">Source : {r.real.source}.</span>
                </div>
              )}
            </Feedback>
            <div className="actions">
              <button className="btn primary" onClick={next}>
                {i + 1 >= rounds.length ? 'Voir le bilan' : 'Archive suivante'} <ArrowRight size={16} className="arrow" />
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

import { useMemo, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Feedback, GameHeader, shuffle } from '../components/ui';
import { SeriesGame, SeriesScore, type SeriesPlay } from '../components/Series';
import { antiPatterns, kin, patternNames, patternSeries, type PatternName, type Situation } from '../data/game-patterns';

export default function PatternMatch() {
  return (
    <SeriesGame
      gameId="pattern-match"
      title="Pattern Match"
      set={patternSeries}
      unit="situations"
      intro="Huit séries, de la situation qui dit presque la définition à celle où deux patterns voisins se défendent et un seul la décrit vraiment. Dès le niveau 2, le voisin trompeur est parmi les réponses."
    >
      {(play) => <Round play={play} />}
    </SeriesGame>
  );
}

const anti = (p: PatternName) => antiPatterns.includes(p);

/**
 * Trois distracteurs : les voisins déclarés d'abord, puis, comme avant, deux
 * de la même famille (pattern ou anti-pattern) et un de l'autre. Les autres
 * voisins de la bonne réponse ne sont jamais tirés au hasard : une réponse
 * défendable que l'explication ne traite pas ruinerait la manche.
 */
function optionsFor(s: Situation): PatternName[] {
  const near = s.near ?? [];
  const blocked = new Set<PatternName>([s.answer, ...near, ...(kin[s.answer] ?? [])]);
  const free = patternNames.filter((p) => !blocked.has(p));
  const same = shuffle(free.filter((p) => anti(p) === anti(s.answer)));
  const other = shuffle(free.filter((p) => anti(p) !== anti(s.answer)));
  const wantSame = Math.max(0, 2 - near.filter((p) => anti(p) === anti(s.answer)).length);
  const wantOther = Math.max(0, 1 - near.filter((p) => anti(p) !== anti(s.answer)).length);
  const picks: PatternName[] = [...near, ...same.slice(0, wantSame), ...other.slice(0, wantOther)];
  // Famille trop étroite une fois les voisins écartés : on complète ailleurs.
  const rest = shuffle(free.filter((p) => !picks.includes(p)));
  while (picks.length < 3 && rest.length) picks.push(rest.shift()!);
  return shuffle([s.answer, ...picks.slice(0, 3)]);
}

function Round({ play }: { play: SeriesPlay<Situation> }) {
  const rounds = useMemo(() => play.items.map((s) => ({ ...s, options: optionsFor(s) })), [play.items]);
  const [i, setI] = useState(0);
  const [pick, setPick] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  const r = rounds[i];
  const choose = (p: string) => {
    if (pick) return;
    setPick(p);
    if (p === r.answer) setScore(score + 1);
  };
  const next = () => {
    if (i + 1 >= rounds.length) {
      play.finish(Math.round((score / rounds.length) * 100));
      setDone(true);
    } else { setI(i + 1); setPick(null); }
  };

  if (done) {
    return <SeriesScore play={play} pct={Math.round((score / rounds.length) * 100)} title={`${score} / ${rounds.length} patterns reconnus`} />;
  }

  return (
    <section className="block">
      <div className="game-wrap">
        <GameHeader
          id="pattern-match"
          title={`Pattern Match · ${play.info.title}`}
          level={play.info.level}
          current={i}
          total={rounds.length}
          extra={<span className="tag mono">Score {score}</span>}
        />
        <div className="card q-card">
          <span className="label">Situation de conception</span>
          <h3 style={{ marginTop: 12 }}>{r.text}</h3>
        </div>
        <p className="q-hint">Quel pattern (ou anti-pattern) de Kohnfelder décrit le mieux cette situation ?</p>
        <div className="grid g2" style={{ gap: 10 }}>
          {r.options.map((p, k) => {
            const cls = pick ? (p === r.answer ? 'correct' : p === pick ? 'wrong' : '') : '';
            return (
              <button key={p} className={`option ${cls}`} disabled={!!pick} onClick={() => choose(p)}>
                <span className="key">{String.fromCharCode(65 + k)}</span>
                <span><b style={{ fontWeight: 500 }}>{p}</b><span className="desc">{anti(p) ? 'Anti-pattern' : 'Pattern'}</span></span>
              </button>
            );
          })}
        </div>
        {pick && (
          <>
            <Feedback good={pick === r.answer}>
              <b>{pick === r.answer ? 'Exact.' : `C’était : ${r.answer}${r.violated ? ' (pattern violé)' : ''}.`}</b>
              <div className="small muted">{r.why}</div>
            </Feedback>
            <div className="actions"><button className="btn primary" onClick={next}>Continuer <ArrowRight size={16} className="arrow" /></button></div>
          </>
        )}
      </div>
    </section>
  );
}

import { useMemo, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Feedback, GameHeader, shuffle } from '../components/ui';
import { CodeBlock } from '../components/Code';
import { SeriesGame, SeriesScore, type SeriesPlay } from '../components/Series';
import { patchSeries, type PatchScenario } from '../data/game-patches';
import { moduleById, pad2 } from '../data/catalog';

export default function PatchOrPwn() {
  return (
    <SeriesGame
      gameId="patch-or-pwn"
      title="Patch or Pwn"
      set={patchSeries}
      unit="correctifs"
      intro="Huit séries, de la prise en main à l’audit. Quatre correctifs par scénario, un seul tient ; chaque mauvais choix montre comment il se contourne. Plusieurs cas s’inspirent d’incidents publics."
    >
      {(play) => <Round play={play} />}
    </SeriesGame>
  );
}

function Round({ play }: { play: SeriesPlay<PatchScenario> }) {
  const rounds = play.items;
  // L'ordre des options est retiré à chaque partie : le bon correctif ne doit
  // pas se retrouver toujours à la même place.
  const optionSets = useMemo(() => rounds.map((r) => shuffle(r.options)), [rounds]);

  const [i, setI] = useState(0);
  const [tries, setTries] = useState<number[]>([]);
  const [points, setPoints] = useState(0);
  const [done, setDone] = useState(false);

  const r = rounds[i];
  const options = optionSets[i];
  const solved = tries.some((k) => options[k].holds);
  const revealed = solved || tries.length >= 2;

  const pick = (k: number) => {
    if (revealed || tries.includes(k)) return;
    const nt = [...tries, k];
    setTries(nt);
    if (options[k].holds) setPoints(points + (nt.length === 1 ? 1 : 0.5));
  };
  const next = () => {
    if (i + 1 >= rounds.length) {
      play.finish(Math.round((points / rounds.length) * 100));
      setDone(true);
    } else { setI(i + 1); setTries([]); }
  };

  if (done) {
    const pct = Math.round((points / rounds.length) * 100);
    return <SeriesScore play={play} pct={pct} title={`${points.toFixed(1).replace('.0', '')} / ${rounds.length} correctifs tenus`} />;
  }

  const mod = moduleById(r.module);
  const last = tries.length ? options[tries[tries.length - 1]] : null;

  return (
    <section className="block">
      <div className="game-wrap wide">
        <GameHeader
          id="patch-or-pwn"
          title={`Patch or Pwn · ${play.info.title}`}
          level={play.info.level}
          current={i}
          total={rounds.length}
          extra={<span className="tag mono">{points.toFixed(1).replace('.0', '')} pts</span>}
        />
        <div className="card q-card">
          <div className="row between" style={{ marginBottom: 12 }}>
            <span className="label">M{pad2(mod?.num ?? 0)} · {mod?.short}</span>
            <span className="label">{tries.length === 0 ? '100 % au premier essai' : revealed ? 'Corrigé' : '50 % au second essai'}</span>
          </div>
          <h3>{r.title}</h3>
          <p className="muted small" style={{ margin: '8px 0 0' }}>{r.context}</p>
        </div>
        <CodeBlock code={r.vulnerable} lang={r.lang} tone="bad" hl="1" />
        <p className="q-hint">Quel correctif tient face à un attaquant ?</p>
        <div className="grid" style={{ gap: 10 }}>
          {options.map((o, k) => {
            const tried = tries.includes(k);
            const cls = tried ? (o.holds ? 'correct' : 'wrong') : revealed && o.holds ? 'correct' : '';
            return (
              <button key={k} className={`option ${cls}`} disabled={revealed || tried} onClick={() => pick(k)}>
                <span className="key">{String.fromCharCode(65 + k)}</span>
                <span>
                  <b style={{ fontWeight: 500 }}>{o.label}</b>
                  {o.code && <span className="desc mono" style={{ whiteSpace: 'pre-wrap' }}>{o.code}</span>}
                  {(tried || revealed) && <span className="desc" style={{ marginTop: 6 }}>{o.why}</span>}
                </span>
              </button>
            );
          })}
        </div>
        {last && !revealed && !last.holds && (
          <Feedback good={false}><b>Contourné.</b><div className="small muted">{last.why} Retente ta chance.</div></Feedback>
        )}
        {revealed && (
          <>
            <Feedback good={solved}>
              <b>{solved ? (tries.length === 1 ? 'Correctif solide, du premier coup.' : 'Correctif solide.') : 'Les deux choix se contournaient.'}</b>
              <div className="small muted">{options.find((o) => o.holds)!.why}</div>
              {r.real && <div className="small muted" style={{ marginTop: 6 }}>Inspiré d’un cas réel : {r.real}.</div>}
            </Feedback>
            <div className="actions"><button className="btn primary" onClick={next}>Continuer <ArrowRight size={16} className="arrow" /></button></div>
          </>
        )}
      </div>
    </section>
  );
}

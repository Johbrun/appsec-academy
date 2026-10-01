import { useMemo, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Feedback, GameHeader, shuffle } from '../components/ui';
import { SeriesGame, SeriesScore, type SeriesPlay } from '../components/Series';
import { attackNames, oauthSeries, type FlowScenario } from '../data/game-oauth';

export default function OAuthDebugger() {
  return (
    <SeriesGame
      gameId="oauth-debugger"
      title="OAuth Flow Debugger"
      set={oauthSeries}
      unit="flux"
      intro="Huit séries, du paramètre manquant à la revue d’architecture. OAuth 2.x, OIDC et SAML mêlés : trouve l’étape faible, nomme l’attaque, retiens la bonne correction."
    >
      {(play) => <Round play={play} />}
    </SeriesGame>
  );
}

function Round({ play }: { play: SeriesPlay<FlowScenario> }) {
  const rounds = useMemo(() => play.items.map((s) => ({
    ...s,
    attacks: shuffle([s.attack, ...shuffle(attackNames.filter((a) => a !== s.attack)).slice(0, 3)]),
    fixOptions: shuffle(s.fixes),
  })), [play.items]);

  const [i, setI] = useState(0);
  const [step, setStep] = useState<number | null>(null);
  const [attack, setAttack] = useState<string | null>(null);
  const [fix, setFix] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  const r = rounds[i];
  const stepOk = step !== null && r.faulty.includes(step);
  const attackOk = attack === r.attack;
  const fixOk = fix === r.fixes[0];
  const total = rounds.length * 3;

  const pickStep = (n: number) => { if (step !== null) return; setStep(n); if (r.faulty.includes(n)) setScore((s) => s + 1); };
  const pickAttack = (a: string) => { if (attack) return; setAttack(a); if (a === r.attack) setScore((s) => s + 1); };
  const pickFix = (f: string) => { if (fix) return; setFix(f); if (f === r.fixes[0]) setScore((s) => s + 1); };

  const next = () => {
    if (i + 1 >= rounds.length) {
      play.finish(Math.round((score / total) * 100));
      setDone(true);
    } else { setI(i + 1); setStep(null); setAttack(null); setFix(null); }
  };

  if (done) {
    const pct = Math.round((score / total) * 100);
    return <SeriesScore play={play} pct={pct} title={`${score} / ${total} points sur ${rounds.length} flux`} />;
  }

  const stepClass = (n: number) => {
    if (step === null) return '';
    if (r.faulty.includes(n)) return 'right';
    return n === step ? 'wrong' : '';
  };

  return (
    <section className="block">
      <div className="game-wrap wide">
        <GameHeader
          id="oauth-debugger"
          title={`OAuth Flow Debugger · ${play.info.title}`}
          level={play.info.level}
          current={i}
          total={rounds.length}
          extra={<span className="tag mono">{score} / {total}</span>}
        />
        <div className="card q-card">
          <span className="label">{r.title}</span>
          <p className="muted small" style={{ margin: '8px 0 0' }}>{r.context}</p>
        </div>
        <p className="q-hint">{step === null ? '1. Clique sur l’étape où le flux est faible.' : attack === null ? '2. Quelle attaque cette faiblesse permet-elle ?' : fix === null ? '3. Quelle correction retenir ?' : 'Bilan du flux.'}</p>
        <ol className="flow-steps">
          {r.steps.map((s, n) => (
            <li key={n}>
              <button className={`flow-step ${stepClass(n)}`} disabled={step !== null} onClick={() => pickStep(n)}>
                <span className="flow-n mono">{n + 1}</span>
                <span className="flow-actors mono">{s.from}{s.to ? <> <span className="dim">→</span> {s.to}</> : ''}</span>
                <span className="flow-msg mono">{s.msg}</span>
              </button>
            </li>
          ))}
        </ol>

        {step !== null && (
          <>
            <Feedback good={stepOk}><b>{stepOk ? 'Bonne étape.' : `L’étape faible : ${r.faulty.map((f) => f + 1).join(' ou ')}.`}</b></Feedback>
            <div className="grid g2" style={{ gap: 10, marginTop: 16 }}>
              {r.attacks.map((a, k) => {
                const cls = attack ? (a === r.attack ? 'correct' : a === attack ? 'wrong' : '') : '';
                return (
                  <button key={a} className={`option ${cls}`} disabled={!!attack} onClick={() => pickAttack(a)}>
                    <span className="key">{String.fromCharCode(65 + k)}</span>
                    <span><b style={{ fontWeight: 500 }}>{a}</b></span>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {attack && (
          <>
            <Feedback good={attackOk}><b>{attackOk ? 'Exact.' : `C’était : ${r.attack}.`}</b></Feedback>
            <div className="grid" style={{ gap: 10, marginTop: 16 }}>
              {r.fixOptions.map((f, k) => {
                const cls = fix ? (f === r.fixes[0] ? 'correct' : f === fix ? 'wrong' : '') : '';
                return (
                  <button key={f} className={`option ${cls}`} disabled={!!fix} onClick={() => pickFix(f)}>
                    <span className="key">{String.fromCharCode(65 + k)}</span>
                    <span><b style={{ fontWeight: 500 }}>{f}</b></span>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {fix && (
          <>
            <Feedback good={fixOk}>
              <b>{fixOk ? 'Bonne correction.' : `La correction : ${r.fixes[0]}.`}</b>
              <div className="small muted">{r.why}</div>
            </Feedback>
            <div className="actions"><button className="btn primary" onClick={next}>{i + 1 >= rounds.length ? 'Voir le score' : 'Flux suivant'} <ArrowRight size={16} className="arrow" /></button></div>
          </>
        )}
      </div>
    </section>
  );
}

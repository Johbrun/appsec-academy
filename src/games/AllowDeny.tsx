import { useState } from 'react';
import { ArrowRight, Check, X } from 'lucide-react';
import { Feedback, GameHeader } from '../components/ui';
import { CodeBlock } from '../components/Code';
import { SeriesGame, SeriesScore, type SeriesPlay } from '../components/Series';
import { iamSeries, stepNames, type IamCase, type Step } from '../data/game-iam';

export default function AllowDeny() {
  return (
    <SeriesGame
      gameId="allow-deny"
      title="Allow or Deny ?"
      set={iamSeries}
      unit="requêtes"
      intro="Neuf séries, d’une politique d’identité isolée à l’évaluation cross-account complète. Prédis la décision d’AWS, puis nomme l’étape qui tranche."
    >
      {(play) => <Round play={play} />}
    </SeriesGame>
  );
}

function Round({ play }: { play: SeriesPlay<IamCase> }) {
  const rounds = play.items;
  const [i, setI] = useState(0);
  const [decision, setDecision] = useState<'allow' | 'deny' | null>(null);
  const [step, setStep] = useState<Step | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  const r = rounds[i];
  const total = rounds.length * 2;

  const pickDecision = (d: 'allow' | 'deny') => { if (decision) return; setDecision(d); if (d === r.decision) setScore((s) => s + 1); };
  const pickStep = (s: Step) => { if (step) return; setStep(s); if (s === r.step) setScore((x) => x + 1); };
  const next = () => {
    if (i + 1 >= rounds.length) {
      play.finish(Math.round((score / total) * 100));
      setDone(true);
    } else { setI(i + 1); setDecision(null); setStep(null); }
  };

  if (done) {
    const pct = Math.round((score / total) * 100);
    return <SeriesScore play={play} pct={pct} title={`${score} / ${total} : décisions IAM prédites`} />;
  }

  return (
    <section className="block">
      <div className="game-wrap wide">
        <GameHeader
          id="allow-deny"
          title={`Allow or Deny ? · ${play.info.title}`}
          level={play.info.level}
          current={i}
          total={rounds.length}
          extra={<span className="tag mono">{score} / {total}</span>}
        />
        <div className="card q-card">
          <span className="label">Requête</span>
          <h3 style={{ marginTop: 12 }} className="iam-request">{r.request}</h3>
          <p className="muted small" style={{ margin: '8px 0 0' }}>{r.context}</p>
        </div>
        <div className={`iam-policies ${r.policies.length > 1 ? 'two' : ''}`}>
          {r.policies.map((p) => <CodeBlock key={p.label} code={p.json} lang="json" file={p.label} />)}
        </div>
        <p className="q-hint">{decision ? 'Quelle étape de l’évaluation tranche ?' : 'AWS autorise-t-il la requête ?'}</p>
        <div className="grid g2" style={{ gap: 10 }}>
          {(['allow', 'deny'] as const).map((d) => {
            const cls = decision ? (d === r.decision ? 'correct' : d === decision ? 'wrong' : '') : '';
            return (
              <button key={d} className={`option ${cls}`} disabled={!!decision} onClick={() => pickDecision(d)}>
                <span className="key">{d === 'allow' ? <Check size={14} /> : <X size={14} />}</span>
                <span><b style={{ fontWeight: 500 }}>{d === 'allow' ? 'Allow' : 'Deny'}</b></span>
              </button>
            );
          })}
        </div>
        {decision && (
          <>
            <Feedback good={decision === r.decision}><b>{decision === r.decision ? 'Bonne décision.' : `AWS répond ${r.decision === 'allow' ? 'Allow' : 'Deny'}.`}</b></Feedback>
            <div className="grid g2" style={{ gap: 8, marginTop: 16 }}>
              {(Object.keys(stepNames) as Step[]).map((s, k) => {
                const cls = step ? (s === r.step ? 'correct' : s === step ? 'wrong' : '') : '';
                return (
                  <button key={s} className={`option ${cls}`} disabled={!!step} onClick={() => pickStep(s)}>
                    <span className="key">{k + 1}</span>
                    <span><b style={{ fontWeight: 500 }}>{stepNames[s]}</b></span>
                  </button>
                );
              })}
            </div>
          </>
        )}
        {step && (
          <>
            <Feedback good={step === r.step}>
              <b>{step === r.step ? 'Exact.' : `C’est ${stepNames[r.step].toLowerCase()} qui tranche.`}</b>
              <div className="small muted">{r.why}</div>
            </Feedback>
            <div className="actions"><button className="btn primary" onClick={next}>{i + 1 >= rounds.length ? 'Voir le score' : 'Requête suivante'} <ArrowRight size={16} className="arrow" /></button></div>
          </>
        )}
      </div>
    </section>
  );
}

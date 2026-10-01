import { useMemo, useState } from 'react';
import { ArrowRight, Check, Flag } from 'lucide-react';
import { Feedback, GameHeader, shuffle } from '../components/ui';
import { SeriesGame, SeriesScore, type SeriesPlay } from '../components/Series';
import { reviewSeries, type Priority, type ReviewDoc } from '../data/game-review';

type Step = 'study' | 'write' | 'collaborate' | 'done';

const prioLabels: Record<Priority, string> = { must: 'Must', ought: 'Ought', should: 'Should' };
const stepIndex: Record<Step, number> = { study: 1, write: 2, collaborate: 3, done: 4 };

export default function DesignReview() {
  return (
    <SeriesGame
      gameId="design-review"
      title="Design Review Simulator"
      set={reviewSeries}
      unit="design doc"
      intro="Huit documents de conception de Novafact, du lien de partage au SSO SAML. Tu suis les étapes de Kohnfelder : lire et identifier, rédiger et prioriser, puis défendre tes constats face au designer. Plus on avance, plus le défaut se cache entre deux phrases, et plus certaines phrases ont l’air fautives sans l’être."
    >
      {(play) => <Round play={play} />}
    </SeriesGame>
  );
}

function Round({ play }: { play: SeriesPlay<ReviewDoc> }) {
  const doc = play.items[0];
  const [step, setStep] = useState<Step>('study');
  const [flags, setFlags] = useState<string[]>([]);
  const [prios, setPrios] = useState<Record<string, Priority>>({});
  const [pbIndex, setPbIndex] = useState(0);
  const [pbPick, setPbPick] = useState<number | null>(null);
  const [dialogue, setDialogue] = useState(0);
  const [final, setFinal] = useState<{ pct: number; detection: number; priority: number; dialog: number } | null>(null);
  // Les réponses au designer sont rebattues à chaque partie : la bonne ne doit
  // pas se retrouver toujours à la même place.
  const replies = useMemo(() => doc.pushbacks.map((p) => shuffle(p.replies)), [doc]);

  const statements = doc.sections.flatMap((s) => s.statements);
  const issues = statements.filter((s) => s.issue);
  const found = issues.filter((s) => flags.includes(s.id));
  const falseFlags = flags.filter((id) => !statements.find((s) => s.id === id)?.issue);

  const toggle = (id: string) => setFlags((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]));

  const finish = (dialogPoints: number) => {
    const precision = flags.length ? found.length / flags.length : 0;
    const recall = issues.length ? found.length / issues.length : 0;
    const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
    const prioOk = found.length ? found.filter((s) => prios[s.id] === s.issue!.priority).length / found.length : 0;
    const dialog = dialogPoints / (2 * doc.pushbacks.length);
    const pct = Math.round(f1 * 40 + prioOk * 40 + dialog * 20);
    setFinal({ pct, detection: Math.round(f1 * 100), priority: Math.round(prioOk * 100), dialog: Math.round(dialog * 100) });
    setStep('done');
    play.finish(pct);
  };

  if (step === 'done' && final) {
    return (
      <SeriesScore play={play} pct={final.pct} title="Revue de conception">
        <div className="kv" style={{ maxWidth: 420, margin: '0 auto 12px' }}>
          <div><span className="label">Détection</span><b>{final.detection}%</b></div>
          <div><span className="label">Priorités</span><b>{final.priority}%</b></div>
          <div><span className="label">Dialogue</span><b>{final.dialog}%</b></div>
        </div>
      </SeriesScore>
    );
  }

  const pb = doc.pushbacks[pbIndex];

  return (
    <section className="block">
      <div className="game-wrap wide">
        <GameHeader id="design-review" title={`Design Review Simulator · ${play.info.title}`} level={play.info.level} current={stepIndex[step]} total={4} />

        {step === 'study' && (
          <>
            <div className="card q-card">
              <span className="label">Study, Inquire, Identify</span>
              <p className="muted small" style={{ margin: '8px 0 0' }}>{doc.intro} Clique sur chaque phrase qui pose un problème de sécurité ou de vie privée. Certaines phrases sont de bonnes décisions : ne les signale pas.</p>
            </div>
            <div className="design-doc">
              {doc.sections.map((sec) => (
                <div key={sec.title} className="doc-section">
                  <h4>{sec.title}</h4>
                  {sec.statements.map((st) => (
                    <button key={st.id} className={`doc-line ${flags.includes(st.id) ? 'flagged' : ''}`} onClick={() => toggle(st.id)} aria-pressed={flags.includes(st.id)}>
                      <Flag size={13} className="flag-ico" />
                      <span>{st.text}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
            <div className="actions between">
              <span className="small dim">{flags.length} constat{flags.length > 1 ? 's' : ''} signalé{flags.length > 1 ? 's' : ''}</span>
              <button className="btn primary" disabled={flags.length === 0} onClick={() => setStep('write')}>Terminer la lecture <ArrowRight size={16} className="arrow" /></button>
            </div>
          </>
        )}

        {step === 'write' && (
          <>
            <div className="card q-card">
              <span className="label">Write</span>
              <p className="muted small" style={{ margin: '8px 0 0' }}>
                Tu as trouvé {found.length} problème{found.length > 1 ? 's' : ''} sur {issues.length}
                {falseFlags.length ? `, et signalé ${falseFlags.length} phrase${falseFlags.length > 1 ? 's' : ''} qui n’en posai${falseFlags.length > 1 ? 'en' : ''}t pas` : ''}.
                Priorise chaque constat trouvé : Must (indispensable avant la mise en production), Ought (fortement recommandé), Should (souhaitable).
              </p>
            </div>
            <div className="grid" style={{ gap: 10 }}>
              {found.map((st) => (
                <div key={st.id} className="card finding-row">
                  <p className="small m0">{st.text}</p>
                  <div className="seg" role="radiogroup" aria-label="Priorité">
                    {(['must', 'ought', 'should'] as Priority[]).map((p) => (
                      <button key={p} className={prios[st.id] === p ? 'on' : ''} onClick={() => setPrios({ ...prios, [st.id]: p })}>{prioLabels[p]}</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {issues.filter((s) => !flags.includes(s.id)).length > 0 && (
              <>
                <div className="section-title">Constats manqués</div>
                {issues.filter((s) => !flags.includes(s.id)).map((s) => (
                  <Feedback key={s.id} good={false}><b>{prioLabels[s.issue!.priority]} : {s.text}</b><div className="small muted">{s.issue!.finding}</div></Feedback>
                ))}
              </>
            )}
            {falseFlags.length > 0 && (
              <>
                <div className="section-title">Signalements superflus</div>
                {falseFlags.map((id) => (
                  <Feedback key={id} good={false}><b>{statements.find((s) => s.id === id)!.text}</b><div className="small muted">{statements.find((s) => s.id === id)!.note ?? 'Cette phrase décrit une bonne décision : la mentionner comme telle dans le rapport aide à la protéger lors des évolutions.'}</div></Feedback>
                ))}
              </>
            )}
            <div className="actions">
              <button className="btn primary" disabled={found.some((s) => !prios[s.id])} onClick={() => setStep('collaborate')}>Envoyer le rapport au designer <ArrowRight size={16} className="arrow" /></button>
            </div>
          </>
        )}

        {step === 'collaborate' && pb && (
          <>
            {found.length > 0 && pbIndex === 0 && pbPick === null && (
              <div className="card finding-summary">
                <span className="label">Ton rapport</span>
                {found.map((s) => (
                  <div key={s.id} className="small">
                    <span className={`tag mono ${prios[s.id] === s.issue!.priority ? 'ok' : 'ko'}`}>{prioLabels[prios[s.id]]}</span> {s.issue!.finding}
                    {prios[s.id] !== s.issue!.priority && <span className="dim"> (attendu : {prioLabels[s.issue!.priority]})</span>}
                  </div>
                ))}
              </div>
            )}
            <div className="card q-card speaker">
              <span className="label">Collaborate · le designer conteste</span>
              <div className="bubble">
                <b>{doc.designer}</b>
                <p>« {pb.objection} »</p>
              </div>
            </div>
            <div className="grid" style={{ gap: 10 }}>
              {replies[pbIndex].map((rep, k) => {
                const cls = pbPick !== null ? (rep.points === 2 ? 'correct' : k === pbPick ? (rep.points === 1 ? 'selected' : 'wrong') : '') : '';
                return (
                  <button key={k} className={`option ${cls}`} disabled={pbPick !== null} onClick={() => { setPbPick(k); setDialogue(dialogue + rep.points); }}>
                    <span className="key">{String.fromCharCode(65 + k)}</span>
                    <span>{rep.text}{pbPick !== null && (k === pbPick || rep.points === 2) && <span className="desc">{rep.why}</span>}</span>
                  </button>
                );
              })}
            </div>
            {pbPick !== null && (
              <div className="actions">
                <button className="btn primary" onClick={() => {
                  if (pbIndex + 1 >= doc.pushbacks.length) finish(dialogue);
                  else { setPbIndex(pbIndex + 1); setPbPick(null); }
                }}>
                  {pbIndex + 1 >= doc.pushbacks.length ? <><Check size={16} /> Clore la revue</> : <>Objection suivante <ArrowRight size={16} className="arrow" /></>}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

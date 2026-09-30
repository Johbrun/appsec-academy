import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Clock, X } from 'lucide-react';
import { Block, Icon, PageHead, ScoreScreen } from '../components/ui';
import { exams, examById, type ExamDef } from '../data/exams';
import { buildCsslp, loadPool, pick, shuffle, type ExamItem } from '../lib/exams';
import { csslpDomains, moduleById, pad2, type Csslp } from '../data/catalog';
import { useProgress } from '../store/progress';

// ---------------------------------------------------------------- Liste
export default function Exams() {
  const { progress } = useProgress();
  const passedBlocks = ['a', 'b', 'c', 'd'].filter((b) => (progress.scores[`exam-${b}`] ?? 0) >= 75).length;

  return (
    <>
      <PageHead eyebrow="Évaluation" title="Examens"
        aside={(
          <div className="row" style={{ gap: 28, marginTop: 24 }}>
            <div><span className="label">Blocs validés</span><div className="big-num" style={{ fontSize: '2.25rem' }}>{passedBlocks}<span className="dim" style={{ fontSize: '1.25rem' }}>/4</span></div></div>
            <div><span className="label">Final</span><div className="big-num" style={{ fontSize: '2.25rem' }}>{progress.scores['exam-final'] ?? 0}<span className="dim" style={{ fontSize: '1.25rem' }}>%</span></div></div>
          </div>
        )}>
        Les examens tirent leurs questions de toutes les leçons du parcours, à chaque tentative. Ton meilleur score est conservé ; la réussite débloque des badges et le certificat.
      </PageHead>

      <Block eyebrow="Par bloc" title="Quatre examens de bloc" lead="Vingt questions, quinze minutes, 75 % pour valider.">
        <div className="grid g2">
          {exams.filter((e) => e.kind === 'block').map((e) => <ExamCard key={e.id} e={e} best={progress.scores[e.id]} />)}
        </div>
      </Block>

      <Block eyebrow="Synthèse" title="Examen final et examen blanc CSSLP">
        <div className="grid g2">
          {exams.filter((e) => e.kind !== 'block').map((e) => <ExamCard key={e.id} e={e} best={progress.scores[e.id]} />)}
        </div>
      </Block>
    </>
  );
}

function ExamCard({ e, best }: { e: ExamDef; best?: number }) {
  const passed = best !== undefined && best >= e.pass;
  return (
    <Link to={`/examens/${e.id}`} className="card exam-card">
      <div className="row between">
        <span className="tile"><Icon name={e.icon} size={18} /></span>
        {best !== undefined
          ? <span className={`tag ${passed ? 'ok' : ''}`}>{passed ? 'Réussi' : 'À retenter'} · {best}%</span>
          : <span className="label">Jamais tenté</span>}
      </div>
      <div>
        <h3 style={{ margin: '10px 0 6px' }}>{e.title}</h3>
        <p className="small dim m0">{e.text}</p>
      </div>
      <div className="exam-foot label">{e.count} questions · {e.minutes} min · seuil {e.pass}%</div>
    </Link>
  );
}

// ---------------------------------------------------------------- Runner
export function ExamRoute() {
  const { examId = '' } = useParams();
  const exam = examById(examId);
  if (!exam) return <ExamNotFound />;
  return <ExamRunner exam={exam} />;
}

function ExamNotFound() {
  return (
    <section className="block"><div className="card" style={{ padding: 40, textAlign: 'center' }}>
      <p className="muted">Examen introuvable.</p>
      <Link className="btn" to="/examens"><ArrowLeft size={16} /> Tous les examens</Link>
    </div></section>
  );
}

type Phase = 'intro' | 'loading' | 'run' | 'done';

function ExamRunner({ exam }: { exam: ExamDef }) {
  const { progress, recordExam } = useProgress();
  const [phase, setPhase] = useState<Phase>('intro');
  const [items, setItems] = useState<ExamItem[]>([]);

  // L'ordre des options est tiré une fois par examen : la position de la
  // bonne réponse ne doit pas être un indice. `answers` continue de stocker
  // l'indice d'origine, donc la correction ne change pas.
  const order = useMemo(
    () => items.map((q) => shuffle(q.options.map((_, k) => k))),
    [items],
  );
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [i, setI] = useState(0);
  const [remaining, setRemaining] = useState(exam.minutes * 60);
  const [result, setResult] = useState<{ pct: number; correct: number } | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = async () => {
    setPhase('loading');
    const pool = await loadPool();
    let picked: ExamItem[];
    if (exam.kind === 'block') picked = pick(pool, (q) => q.block === exam.block, exam.count);
    else if (exam.kind === 'csslp') picked = buildCsslp(pool, exam.count, csslpDomains);
    else picked = shuffle(pool).slice(0, exam.count);
    setItems(picked);
    setAnswers(picked.map(() => null));
    setI(0);
    setRemaining(exam.minutes * 60);
    setPhase('run');
  };

  const finish = () => {
    if (timer.current) clearInterval(timer.current);
    const correct = items.reduce((s, q, k) => s + (answers[k] === q.answer ? 1 : 0), 0);
    const pct = items.length ? Math.round((correct / items.length) * 100) : 0;
    setResult({ pct, correct });
    setPhase('done');
    recordExam(exam.id, pct, exam.xp);
  };

  // Chronomètre : démarre avec la phase run, s'arrête à la fin.
  useEffect(() => {
    if (phase !== 'run') return;
    timer.current = setInterval(() => setRemaining((r) => r - 1), 1000);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [phase]);

  useEffect(() => {
    if (phase === 'run' && remaining <= 0) finish();
  }, [remaining, phase]);

  const answered = answers.filter((a) => a !== null).length;
  const mmss = `${Math.floor(Math.max(0, remaining) / 60)}:${String(Math.max(0, remaining) % 60).padStart(2, '0')}`;

  if (phase === 'intro') {
    const best = progress.scores[exam.id];
    return (
      <section className="block">
        <div className="game-wrap">
          <Link className="subnav-link" to="/examens" style={{ display: 'inline-flex', gap: 6, marginBottom: 20 }}><ArrowLeft size={15} /> Examens</Link>
          <div className="card exam-intro">
            <span className="tile"><Icon name={exam.icon} size={22} /></span>
            <h1 style={{ margin: '14px 0 8px' }}>{exam.title}</h1>
            <p className="dim">{exam.text}</p>
            <div className="kv" style={{ maxWidth: 460, margin: '18px 0' }}>
              <div><span className="label">Questions</span><b>{exam.count}</b></div>
              <div><span className="label">Durée</span><b>{exam.minutes} min</b></div>
              <div><span className="label">Seuil</span><b>{exam.pass}%</b></div>
              <div><span className="label">Meilleur</span><b>{best !== undefined ? `${best}%` : '—'}</b></div>
            </div>
            <ul className="exam-rules small dim">
              <li>Les questions sont tirées au sort à chaque tentative.</li>
              <li>Le chronomètre démarre dès le début et l’examen se rend seul à zéro.</li>
              <li>Tu peux revenir en arrière tant que le temps n’est pas écoulé.</li>
            </ul>
            <button className="btn primary" onClick={start}>Commencer l’examen <ArrowRight size={16} className="arrow" /></button>
          </div>
        </div>
      </section>
    );
  }

  if (phase === 'loading') {
    return <section className="block"><p className="muted" style={{ textAlign: 'center', padding: 40 }}>Préparation des questions…</p></section>;
  }

  if (phase === 'done' && result) {
    const pass = result.pct >= exam.pass;
    const wrong = items.map((q, k) => ({ q, k })).filter(({ q, k }) => answers[k] !== q.answer);
    const byDomain = exam.kind === 'csslp' ? csslpDomainStats(items, answers) : null;
    return (
      <section className="block">
        <div className="game-wrap wide">
          <ScoreScreen pct={result.pct} title={`${pass ? 'Réussi' : 'Échoué'} · ${result.correct} / ${items.length} (seuil ${exam.pass}%)`} onRetry={start}>
            {pass && exam.kind === 'final' && <p className="small" style={{ maxWidth: 460, margin: '0 auto 12px' }}>Félicitations : tu peux générer ton <Link to="/certificat" className="ink">certificat</Link>.</p>}
            {byDomain && (
              <div className="domain-stats">
                {byDomain.map((d) => (
                  <div key={d.id} className="domain-row">
                    <span className="small">{d.id} · {d.name}</span>
                    <span className="mono small" style={{ color: d.total ? (d.correct / d.total >= 0.7 ? 'var(--ok)' : 'var(--ko)') : 'var(--ink-4)' }}>{d.correct}/{d.total}</span>
                  </div>
                ))}
              </div>
            )}
          </ScoreScreen>

          {wrong.length > 0 && (
            <>
              <div className="section-title">Corrigé des {wrong.length} erreur{wrong.length > 1 ? 's' : ''}</div>
              {wrong.map(({ q, k }) => (
                <div key={k} className="card exam-review">
                  <p className="m0" style={{ fontWeight: 500 }}>{q.q}</p>
                  <p className="small" style={{ color: 'var(--ko)', margin: '8px 0 2px' }}><X size={13} /> Ta réponse : {answers[k] !== null ? q.options[answers[k]!] : 'aucune'}</p>
                  <p className="small" style={{ color: 'var(--ok)', margin: '0 0 8px' }}><Check size={13} /> Bonne réponse : {q.options[q.answer]}</p>
                  <p className="small dim m0">{q.explain}</p>
                  <Link className="label" to={`/modules/${q.moduleId}/${q.lessonId}`}>Revoir la leçon · M{pad2(moduleById(q.moduleId)?.num ?? 0)} {q.lessonId.toUpperCase()}</Link>
                </div>
              ))}
            </>
          )}
        </div>
      </section>
    );
  }

  // phase run
  const q = items[i];
  return (
    <section className="block">
      <div className="game-wrap">
        <div className="exam-bar">
          <span className="mono small dim">Question {i + 1} / {items.length}</span>
          <span className={`exam-timer mono ${remaining < 60 ? 'urgent' : ''}`}><Clock size={14} /> {mmss}</span>
        </div>
        <div className="exam-progress"><div style={{ width: `${(answered / items.length) * 100}%` }} /></div>

        <div className="card q-card" style={{ marginTop: 18 }}>
          <span className="label">M{pad2(moduleById(q.moduleId)?.num ?? 0)} · {q.csslp.join(' ')}</span>
          <h3 style={{ marginTop: 10 }}>{q.q}</h3>
        </div>
        <div className="grid" style={{ gap: 10 }}>
          {(order[i] ?? q.options.map((_, k) => k)).map((k, pos) => (
            <button key={k} className={`option ${answers[i] === k ? 'selected' : ''}`} onClick={() => setAnswers((a) => a.map((v, idx) => (idx === i ? k : v)))}>
              <span className="key">{String.fromCharCode(65 + pos)}</span>
              <span><b style={{ fontWeight: 400 }}>{q.options[k]}</b></span>
            </button>
          ))}
        </div>

        <div className="actions between" style={{ marginTop: 20 }}>
          <button className="btn" disabled={i === 0} onClick={() => setI(i - 1)}><ArrowLeft size={15} /> Précédent</button>
          {i + 1 < items.length
            ? <button className="btn primary" onClick={() => setI(i + 1)}>Suivant <ArrowRight size={16} className="arrow" /></button>
            : <button className="btn primary" onClick={finish}>Terminer l’examen ({answered}/{items.length})</button>}
        </div>
        {i + 1 < items.length && answered === items.length && (
          <div className="actions" style={{ marginTop: 10 }}><button className="btn ghost" onClick={finish}>Terminer maintenant</button></div>
        )}
      </div>
    </section>
  );
}

function csslpDomainStats(items: ExamItem[], answers: (number | null)[]) {
  return csslpDomains.map((d) => {
    let total = 0, correct = 0;
    items.forEach((q, k) => {
      if (q.csslp.includes(d.id as Csslp)) { total++; if (answers[k] === q.answer) correct++; }
    });
    return { id: d.id, name: d.name, total, correct };
  });
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle2, Clock, Flag, Gamepad2, Lock, RotateCcw } from 'lucide-react';
import { Block, CsslpTags, Difficulty, Feedback } from '../components/ui';
import LessonRail from '../components/LessonRail';
import { mdxComponents, SourcesList, SourcesProvider, type SourceItem } from '../components/mdx';
import { lessonXp, pendingSeries, SERIES_PASS, useProgress } from '../store/progress';
import { lessonKey, lessonMinutes, lessonSeries, moduleById, pad2, type LessonMeta, type ModuleMeta } from '../data/catalog';
import { games } from '../data/games';
import { seriesLoaders } from '../data/series-index';
import { isWritten, lessonLoader, writtenLessons, type LessonModule, type Question } from '../lib/content';
import { lessonsUnlocked } from '../lib/diagnostic';
import { shuffle } from '../lib/exams';
import { seriesKey, type SeriesInfo } from '../lib/series';
import NotFound from './NotFound';

/** Les séries de jeu que la leçon exige, avec le record de chacune. */
function LessonGames({ m, lesson }: { m: ModuleMeta; lesson: LessonMeta }) {
  const { progress } = useProgress();
  const required = lessonSeries(m.id, lesson.id);
  // Les titres viennent des fichiers de données des jeux, chargés à la demande :
  // en attendant, la série s'affiche sous son identifiant.
  const [infos, setInfos] = useState<Record<string, SeriesInfo>>({});

  useEffect(() => {
    let alive = true;
    const ids = [...new Set(lessonSeries(m.id, lesson.id).map((r) => r.game))];
    Promise.all(ids.map(async (g) => {
      const set = await seriesLoaders[g]?.();
      return (set?.list ?? []).map((s) => [seriesKey(g, s.id), s] as const);
    }))
      .then((all) => { if (alive) setInfos(Object.fromEntries(all.flat())); })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [m.id, lesson.id]);

  if (!required.length) return null;
  const done = !!progress.lessons[lessonKey(m.id, lesson.id)];

  return (
    <section className="block tight">
      <div className="quiz">
        <div className="label">{done ? 'Pratique faite' : 'Pratique exigée'}</div>
        <h2 style={{ margin: '6px 0 0' }}>Les séries à réussir</h2>
        <p className="q-hint">
          La leçon se valide quand chaque série atteint {SERIES_PASS} %, puis le quiz. Ton record compte : une série déjà réussie l’est pour de bon.
        </p>
        <div className="grid g2" style={{ gap: 10 }}>
          {required.map(({ game, series }) => {
            const key = seriesKey(game, series);
            const info = infos[key];
            const best = progress.scores[key];
            const ok = (best ?? 0) >= SERIES_PASS;
            return (
              <Link key={key} to={`/jeux/${game}?serie=${encodeURIComponent(series)}`} className={`option sink-series ${ok ? 'correct' : ''}`}>
                <span>
                  <span className="label">{games.find((g) => g.id === game)?.title ?? game}</span>
                  <b style={{ fontWeight: 500, display: 'block', marginTop: 4 }}>
                    {info?.title ?? series} {info && <Difficulty level={info.level} label={false} />}
                  </b>
                  {info && <span className="desc">{info.text}</span>}
                  <span className="label" style={{ marginTop: 6, display: 'block' }}>
                    {ok
                      ? <><CheckCircle2 size={12} style={{ display: 'inline', verticalAlign: '-1px' }} /> Réussie · record {best} %</>
                      : best !== undefined ? `Record ${best} % · il faut ${SERIES_PASS} %` : 'Pas encore jouée'}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/** Ce qui manque avant de pouvoir valider : `null` si rien. */
function GameBlocker({ m, lesson }: { m: ModuleMeta; lesson: LessonMeta }) {
  const { progress } = useProgress();
  const pending = pendingSeries(progress, m.id, lesson.id).length;
  if (!pending || progress.lessons[lessonKey(m.id, lesson.id)]) return null;
  return (
    <span className="label"><Gamepad2 size={12} style={{ display: 'inline', verticalAlign: '-1px' }} /> {pending > 1 ? `${pending} séries de jeu à réussir` : '1 série de jeu à réussir'} avant de valider</span>
  );
}

function Quiz({ m, lesson, questions }: { m: ModuleMeta; lesson: LessonMeta; questions: Question[] }) {
  const { progress, completeLesson } = useProgress();
  const done = !!progress.lessons[lessonKey(m.id, lesson.id)];
  const blocked = pendingSeries(progress, m.id, lesson.id).length > 0;
  const [picked, setPicked] = useState<(number | null)[]>(() => questions.map(() => null));

  // L'ordre d'affichage des options est tiré à chaque arrivée sur la leçon.
  // Sans ça, la position de la bonne réponse devient un indice : elle était en
  // deuxième position dans 48 % des questions du site. `picked` continue de
  // stocker l'indice d'origine, donc la correction ne change pas.
  const order = useMemo(
    () => questions.map((q) => shuffle(q.options.map((_, i) => i))),
    [questions],
  );
  const [checked, setChecked] = useState(false);

  useEffect(() => { setPicked(questions.map(() => null)); setChecked(false); }, [questions]);

  const allAnswered = picked.every((p) => p !== null);
  const allRight = picked.every((p, k) => p === questions[k].answer);
  const xp = lessonXp(lesson.level);

  const check = () => {
    setChecked(true);
    if (allRight) completeLesson(m.id, lesson.id, xp, writtenLessons(m.id));
  };
  const retry = () => { setPicked(picked.map((p, k) => (p === questions[k].answer ? p : null))); setChecked(false); };

  return (
    <section className="block tight">
      <div className="quiz">
        <div className="row between" style={{ marginBottom: 24 }}>
          <div>
            <div className="label">{done ? 'Leçon validée' : 'Valider la leçon'}</div>
            <h2 style={{ margin: '6px 0 0' }}>Vérifie tes acquis</h2>
          </div>
          <span className="tag mono">+{xp} XP</span>
        </div>
        {questions.map((q, k) => (
          <div key={k} className="quiz-q">
            <p className="quiz-title"><span className="mono dim">Q{k + 1}.</span> {q.q}</p>
            <div className="grid" style={{ gap: 8 }}>
              {order[k].map((j, pos) => {
                const isPicked = picked[k] === j;
                const cls = checked && isPicked ? (j === q.answer ? 'correct' : 'wrong') : isPicked ? 'selected' : '';
                return (
                  <button key={j} className={`option ${cls}`} disabled={checked || done}
                    onClick={() => setPicked(picked.map((p, i) => (i === k ? j : p)))}>
                    <span className="key">{String.fromCharCode(65 + pos)}</span>
                    <span>{q.options[j]}</span>
                  </button>
                );
              })}
            </div>
            {(checked || done) && picked[k] !== null && (
              <Feedback good={picked[k] === q.answer}>
                <b>{picked[k] === q.answer ? 'Exact.' : 'Pas tout à fait.'}</b>
                {(picked[k] === q.answer || done) && <div className="small muted">{q.explain}</div>}
                {picked[k] !== q.answer && <div className="small muted">Relis la section concernée, puis retente.</div>}
              </Feedback>
            )}
          </div>
        ))}
        <div className="actions" style={{ alignItems: 'center' }}>
          <GameBlocker m={m} lesson={lesson} />
          {done
            ? <span className="tag ok"><CheckCircle2 size={14} /> Validée le {new Date(progress.lessons[lessonKey(m.id, lesson.id)]).toLocaleDateString('fr-FR')}</span>
            : checked && !allRight
              ? <button className="btn" onClick={retry}><RotateCcw size={16} /> Corriger mes réponses</button>
              : <button className="btn primary" disabled={!allAnswered || checked || blocked} onClick={check}><Flag size={16} /> Valider</button>}
        </div>
      </div>
    </section>
  );
}

function ManualComplete({ m, lesson }: { m: ModuleMeta; lesson: LessonMeta }) {
  const { progress, completeLesson } = useProgress();
  const done = !!progress.lessons[lessonKey(m.id, lesson.id)];
  const blocked = pendingSeries(progress, m.id, lesson.id).length > 0;
  return (
    <section className="block tight">
      <div className="complete">
        <div>
          <div className="label">{done ? 'Leçon validée' : 'Fin de la leçon'}</div>
          <div style={{ fontWeight: 500, marginTop: 4 }}>{done ? 'Ta progression est enregistrée.' : `Marque la leçon comme terminée pour gagner ${lessonXp(lesson.level)} XP.`}</div>
          <GameBlocker m={m} lesson={lesson} />
        </div>
        <button className="btn primary" disabled={done || blocked} onClick={() => completeLesson(m.id, lesson.id, lessonXp(lesson.level), writtenLessons(m.id))}>
          {done ? <><CheckCircle2 size={16} /> Terminée</> : 'Marquer comme terminée'}
        </button>
      </div>
    </section>
  );
}

export default function LessonPage() {
  const { moduleId = '', lessonId = '' } = useParams();
  const { progress } = useProgress();
  const m = moduleById(moduleId);
  const idx = m?.lessons.findIndex((l) => l.id === lessonId) ?? -1;
  const lesson = m && idx >= 0 ? m.lessons[idx] : undefined;
  const [mod, setMod] = useState<LessonModule | null>(null);
  const [error, setError] = useState(false);
  // Les sources remontent du corps de la leçon pour être rendues sous le quiz.
  const [sources, setSources] = useState<SourceItem[]>([]);
  const article = useRef<HTMLElement>(null);

  useEffect(() => {
    setMod(null);
    setError(false);
    setSources([]);
    const load = lessonLoader(moduleId, lessonId);
    if (!load) return;
    let alive = true;
    load().then((x) => { if (alive) setMod(x); }).catch(() => { if (alive) setError(true); });
    return () => { alive = false; };
  }, [moduleId, lessonId]);

  if (!m || !lesson) return <NotFound />;
  if (!isWritten(m.id, lesson.id)) {
    return (
      <Block eyebrow={`Module ${pad2(m.num)}`} title={lesson.title} lead="Cette leçon est encore en rédaction.">
        <Link to={`/modules/${m.id}`} className="btn"><ArrowLeft size={16} /> Retour au module</Link>
      </Block>
    );
  }
  // Le lien direct (marque-page, examen) ne doit pas contourner le diagnostic d'entrée.
  if (!lessonsUnlocked(progress, m)) {
    return (
      <Block eyebrow={`Module ${pad2(m.num)} · ${m.short}`} title={lesson.title}
        lead="Cette leçon s’ouvre une fois le diagnostic d’entrée du module passé : cinq questions, sans XP, pour mesurer ton point de départ.">
        <Link to={`/modules/${m.id}`} className="btn primary"><Lock size={16} /> Passer le diagnostic</Link>
      </Block>
    );
  }

  const prev = m.lessons.slice(0, idx).reverse().find((l) => isWritten(m.id, l.id));
  const next = m.lessons.slice(idx + 1).find((l) => isWritten(m.id, l.id));
  const Content = mod?.default;

  return (
    <>
      <section className="block page-head lesson-head">
        <div className="eyebrow">Module {pad2(m.num)} <span className="sep">/</span> Leçon {pad2(idx + 1)} <span className="sep">/</span> {m.short}</div>
        <h1>{lesson.title}</h1>
        <div className="lesson-tags" style={{ marginTop: 22 }}>
          <Difficulty level={lesson.level} prefix />
          <span className="duration"><Clock size={14} /> {lessonMinutes(lesson)} min</span>
          <CsslpTags domains={lesson.csslp} />
          {lesson.k && <span className="ref" title="Chapitres de Designing Secure Software">Kohnfelder {lesson.k.map((c) => `K${c}`).join(', ')}</span>}
        </div>
      </section>

      <section className="block tight lesson-layout">
        <article className="prose" ref={article}>
          {error && <p className="muted">Impossible de charger la leçon.</p>}
          {!Content && !error && <p className="muted">Chargement…</p>}
          {Content && (
            <SourcesProvider value={setSources}>
              <Content components={mdxComponents} />
            </SourcesProvider>
          )}
        </article>
        <LessonRail m={m} lessonId={lesson.id} article={article} ready={!!Content} />
      </section>

      {mod && <LessonGames m={m} lesson={lesson} />}

      {mod && (mod.questions?.length ? <Quiz m={m} lesson={lesson} questions={mod.questions} /> : <ManualComplete m={m} lesson={lesson} />)}

      {sources.length > 0 && (
        <section className="block tight">
          <div className="sources-block"><SourcesList items={sources} /></div>
        </section>
      )}

      <section className="block tight">
        <div className="lesson-nav">
          {prev
            ? <Link to={`/modules/${m.id}/${prev.id}`} className="card lesson-nav-card"><span className="label"><ArrowLeft size={12} style={{ display: 'inline', verticalAlign: '-1px' }} /> Précédente</span><b>{prev.title}</b></Link>
            : <Link to={`/modules/${m.id}`} className="card lesson-nav-card"><span className="label"><ArrowLeft size={12} style={{ display: 'inline', verticalAlign: '-1px' }} /> Module</span><b>{m.title}</b></Link>}
          {next
            ? <Link to={`/modules/${m.id}/${next.id}`} className="card lesson-nav-card right"><span className="label">Suivante <ArrowRight size={12} style={{ display: 'inline', verticalAlign: '-1px' }} /></span><b>{next.title}</b></Link>
            : <Link to={`/modules/${m.id}`} className="card lesson-nav-card right"><span className="label">Retour <ArrowRight size={12} style={{ display: 'inline', verticalAlign: '-1px' }} /></span><b>Sommaire du module</b></Link>}
        </div>
      </section>
    </>
  );
}

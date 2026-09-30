import { Suspense, lazy } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, Check, Clock } from 'lucide-react';
import { Block, CsslpTags, Difficulty, Icon, Orb, PageHead } from '../components/ui';
import { useProgress } from '../store/progress';
import { formatDuration, lessonKey, lessonMinutes, moduleById, moduleMinutes, modules, pad2 } from '../data/catalog';
import { games } from '../data/games';
import { labsForModule } from '../data/labs';
import { isWritten, writtenLessons } from '../lib/content';
import NotFound from './NotFound';

// Les cent questions de diagnostic pèsent une soixantaine de kilo-octets : sans
// ce découpage, elles partent dans le paquet principal et se téléchargent pour
// la page d'accueil comme pour un jeu. Même convention que les jeux (main.tsx).
const Checkpoint = lazy(() => import('../components/Checkpoint'));

export default function ModulePage() {
  const { moduleId = '' } = useParams();
  const { progress } = useProgress();
  const m = moduleById(moduleId);
  if (!m) return <NotFound />;

  const ok = m.lessons.filter((l) => progress.lessons[lessonKey(m.id, l.id)]).length;
  const written = writtenLessons(m.id);
  const validated = progress.modules.includes(m.id);
  const firstTodo = m.lessons.find((l) => isWritten(m.id, l.id) && !progress.lessons[lessonKey(m.id, l.id)]);
  const modGames = games.filter((g) => g.modules.includes(m.id));
  const modLabs = labsForModule(m.id);
  const idx = modules.findIndex((x) => x.id === m.id);
  const nextModule = modules[idx + 1];
  // Le diagnostic de sortie s'ouvre quand tout ce qui est EN LIGNE a été validé :
  // attendre la validation du module entier le rendrait inatteignable tant que
  // des leçons restent à écrire.
  const toutLuEnLigne = written.length > 0
    && written.every((l) => progress.lessons[lessonKey(m.id, l)]);

  return (
    <>
      <PageHead eyebrow={<>Module {pad2(m.num)} <span className="sep">/</span> {m.short}</>} title={m.title}
        aside={(
          <dl className="spec">
            <div><dt>Durée</dt><dd>{formatDuration(moduleMinutes(m))}</dd></div>
            <div><dt>Leçons</dt><dd>{ok}/{m.lessons.length} validées</dd></div>
            <div><dt>Statut</dt><dd className={validated ? 'ok' : ''}><span className={`led ${validated ? '' : 'off'}`} /> {validated ? 'Module validé' : written.length ? 'En cours' : 'En rédaction'}</dd></div>
          </dl>
        )}>
        {m.summary}
      </PageHead>

      <Block className="tight">
        <div className="module-banner">
          <Orb palette={m.palette} className="module-orb" />
          <div className="module-banner-text">
            <span className="label">Progression</span>
            <div className="meter lg" style={{ margin: '12px 0 10px' }}><div style={{ width: `${(ok / m.lessons.length) * 100}%` }} /></div>
            <div className="small dim">{written.length < m.lessons.length ? `${written.length} leçon${written.length > 1 ? 's' : ''} en ligne sur ${m.lessons.length}. Le module se valide quand toutes ses leçons sont validées.` : 'Toutes les leçons sont en ligne. Valide-les pour valider le module (+100 XP).'}</div>
          </div>
          {firstTodo
            ? <Link to={`/modules/${m.id}/${firstTodo.id}`} className="btn primary">{ok ? 'Continuer' : 'Commencer'} <ArrowRight size={16} className="arrow" /></Link>
            : nextModule && <Link to={`/modules/${nextModule.id}`} className="btn">Module suivant <ArrowRight size={16} className="arrow" /></Link>}
        </div>
      </Block>

      <Block className="tight">
        <Suspense fallback={null}><Checkpoint moduleId={m.id} phase="avant" /></Suspense>
      </Block>

      <Block eyebrow="Leçons" title="Au programme">
        <div className="lesson-list">
          {m.lessons.map((l, i) => {
            const done = !!progress.lessons[lessonKey(m.id, l.id)];
            const live = isWritten(m.id, l.id);
            const inner = (
              <>
                <span className={`lesson-num mono ${done ? 'ok' : ''}`}>{done ? <Check size={15} /> : pad2(i + 1)}</span>
                <span className="lesson-body">
                  <b>{l.title}</b>
                  <span className="small dim">{l.summary}</span>
                  <span className="lesson-tags">
                    <Difficulty level={l.level} prefix />
                    <CsslpTags domains={l.csslp} />
                    {l.k && <span className="tag mono" title="Chapitres de Designing Secure Software">Kohnfelder {l.k.map((c) => `K${c}`).join(', ')}</span>}
                  </span>
                </span>
                <span className="lesson-meta">
                  {live
                    ? <span className="label"><Clock size={12} style={{ display: 'inline', verticalAlign: '-2px' }} /> {lessonMinutes(l)} min</span>
                    : <span className="tag flat">En rédaction</span>}
                </span>
              </>
            );
            return live
              ? <Link key={l.id} to={`/modules/${m.id}/${l.id}`} className={`lesson-row ${done ? 'done' : ''}`}>{inner}</Link>
              : <div key={l.id} className="lesson-row off">{inner}</div>;
          })}
        </div>
      </Block>

      {(modGames.length > 0 || modLabs.length > 0) && (
        <Block eyebrow="Pratique" title="Jeux et labs associés">
          <div className="grid g2">
            <div>
              <div className="section-title" style={{ marginTop: 0 }}>Jeux</div>
              {modGames.length === 0 && <p className="small dim">Pas de jeu dédié à ce module.</p>}
              <div className="grid" style={{ gap: 10 }}>
                {modGames.map((g) => (g.available ? (
                  <Link key={g.id} to={`/jeux/${g.id}`} className="option">
                    <span className="key"><Icon name={g.icon} size={15} /></span>
                    <span><b style={{ fontWeight: 500 }}>{g.title}</b> <Difficulty level={g.level} label={false} /><span className="desc">{g.text}</span></span>
                  </Link>
                ) : (
                  <div key={g.id} className="option" aria-disabled="true" style={{ opacity: 0.55 }}>
                    <span className="key"><Icon name={g.icon} size={15} /></span>
                    <span><b style={{ fontWeight: 500 }}>{g.title}</b> <span className="tag flat">À venir</span><span className="desc">{g.text}</span></span>
                  </div>
                )))}
              </div>
            </div>
            <div>
              <div className="section-title" style={{ marginTop: 0 }}>Labs reconnus</div>
              <div className="grid" style={{ gap: 10 }}>
                {modLabs.slice(0, 8).map((lab) => (
                  <a key={lab.id} href={lab.url} target="_blank" rel="noreferrer" className="option">
                    <span className="key">{progress.labs.includes(lab.id) ? <Check size={15} /> : <Icon name="FlaskConical" size={15} />}</span>
                    <span><b style={{ fontWeight: 500 }}>{lab.title}</b> <span className="small dim">· {lab.provider}</span><span className="desc">{lab.text}</span></span>
                  </a>
                ))}
              </div>
              <Link to="/labs" className="btn sm" style={{ marginTop: 14 }}>Tous les labs <ArrowRight size={14} /></Link>
            </div>
          </div>
        </Block>
      )}

      <Block className="tight">
        <Suspense fallback={null}><Checkpoint moduleId={m.id} phase="apres" deverrouille={toutLuEnLigne} /></Suspense>
      </Block>
    </>
  );
}

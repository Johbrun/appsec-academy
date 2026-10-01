import { useEffect, useRef, useState, type RefObject } from 'react';
import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import { blocks, lessonKey, pad2, type ModuleMeta } from '../data/catalog';
import { isWritten } from '../lib/content';
import { useProgress } from '../store/progress';

interface Section { el: HTMLElement; title: string }

// Un titre est « en cours » quand il a passé cette distance depuis le haut de
// la fenêtre : la barre de navigation (64 px) plus un peu d'air, pour que le
// titre atteint par un clic dans le rail soit bien celui qui s'allume.
const SPY_OFFSET = 140;

/**
 * Les h2 du corps de la leçon, et lequel est en cours de lecture.
 *
 * Ils sont lus dans le DOM rendu plutôt que déclarés dans le MDX : les
 * leçons sont écrites à la main et une table des matières recopiée à côté du
 * texte finirait par mentir. `:scope > h2` ne retient que les titres de
 * premier niveau — ceux des composants (encadrés, quiz) n'en font pas partie.
 */
function useSections(article: RefObject<HTMLElement>, ready: boolean, lessonId: string) {
  const [sections, setSections] = useState<Section[]>([]);
  const [active, setActive] = useState(-1);

  useEffect(() => {
    const root = article.current;
    if (!ready || !root) { setSections([]); setActive(-1); return; }
    setSections(Array.from(root.querySelectorAll<HTMLElement>(':scope > h2')).map((el) => ({ el, title: el.textContent ?? '' })));
  }, [article, ready, lessonId]);

  useEffect(() => {
    if (!sections.length) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const bottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
      let cur = -1;
      sections.forEach((s, i) => { if (s.el.getBoundingClientRect().top <= SPY_OFFSET) cur = i; });
      setActive(bottom && cur >= 0 ? sections.length - 1 : cur);
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(measure); };
    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [sections]);

  return { sections, active };
}

/**
 * Plan du module collé dans la marge droite d'une leçon : où l'on est dans le
 * parcours (bloc, module, leçon) et, sous la leçon ouverte, où l'on en est dans
 * la lecture. Le sous-menu horizontal du Layout reste le repli quand la marge
 * disparaît (≤ 1100 px).
 */
export default function LessonRail({ m, lessonId, article, ready }: {
  m: ModuleMeta; lessonId: string; article: RefObject<HTMLElement>; ready: boolean;
}) {
  const { progress } = useProgress();
  const { sections, active } = useSections(article, ready, lessonId);
  const scroller = useRef<HTMLDivElement>(null);
  const bloc = blocks.find((b) => b.id === m.block);
  const done = m.lessons.filter((l) => progress.lessons[lessonKey(m.id, l.id)]).length;

  // La liste peut dépasser la hauteur de la fenêtre (13 leçons au module 9) :
  // on garde visible la section en cours — ou la leçon, tant qu'aucune section
  // n'est atteinte — sans jamais faire défiler la page elle-même.
  useEffect(() => {
    const box = scroller.current;
    const el = box?.querySelector<HTMLElement>('[aria-current="location"]') ?? box?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!box || !el) return;
    if (el.offsetTop < box.scrollTop) box.scrollTop = el.offsetTop - 8;
    else if (el.offsetTop + el.offsetHeight > box.scrollTop + box.clientHeight) box.scrollTop = el.offsetTop + el.offsetHeight - box.clientHeight + 8;
  }, [active, lessonId]);

  const go = (el: HTMLElement) => {
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' });
  };

  return (
    <nav className="lesson-rail" aria-label={`Plan du module ${m.title}`}>
      <div className="rail-head">
        {bloc && <span className="label">Bloc {bloc.id} · {bloc.title}</span>}
        <Link to={`/modules/${m.id}`} className="rail-mod">
          <span className="mono">M{pad2(m.num)}</span> {m.title}
        </Link>
        <div className="rail-count">
          <span className="label">{done}/{m.lessons.length} validées</span>
          <div className="meter"><div style={{ width: `${(done / m.lessons.length) * 100}%` }} /></div>
        </div>
      </div>

      <div className="rail-scroll" ref={scroller}>
        <ol className="rail-lessons">
          {m.lessons.map((l, i) => {
            const cur = l.id === lessonId;
            const ok = !!progress.lessons[lessonKey(m.id, l.id)];
            const mark = ok ? <Check size={13} aria-label="validée" /> : pad2(i + 1);
            return (
              <li key={l.id} className={`rail-lesson ${cur ? 'current' : ''} ${ok ? 'done' : ''}`}>
                {isWritten(m.id, l.id)
                  ? <Link to={`/modules/${m.id}/${l.id}`} className="rail-item" aria-current={cur ? 'page' : undefined}><span className="num mono">{mark}</span><span>{l.title}</span></Link>
                  : <span className="rail-item off" title="En rédaction"><span className="num mono">{mark}</span><span>{l.title}</span></span>}
                {cur && sections.length > 0 && (
                  <ol className="rail-sections">
                    {sections.map((s, k) => (
                      <li key={k}>
                        <button type="button" onClick={() => go(s.el)} aria-current={k === active ? 'location' : undefined}>{s.title}</button>
                      </li>
                    ))}
                  </ol>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, Expand, LayoutGrid, NotebookText, Printer, Shrink } from 'lucide-react';
import { Orb, Screen } from '../components/ui';
import { SLIDE_H, SLIDE_W, SlideFrame } from '../components/slides';
import { moduleById, pad2, type ModuleMeta } from '../data/catalog';
import { deckLoader, type SlideDef } from '../lib/slides';

const THUMB_W = 224;

export default function SlideViewer() {
  const { moduleId = '' } = useParams();
  const m = moduleById(moduleId);
  const load = deckLoader(moduleId);
  const [slides, setSlides] = useState<SlideDef[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!load) return;
    let live = true;
    load().then((d) => { if (live) setSlides(d.default); }).catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [load]);

  if (!m || !load) {
    return <Screen><p>Ce support n’existe pas encore.</p><Link to="/slides" className="btn sm">Retour aux slides</Link></Screen>;
  }
  if (failed) return <Screen><p role="alert">Le support n’a pas pu être chargé.</p><Link to="/slides" className="btn sm">Retour aux slides</Link></Screen>;
  if (!slides) return <Screen><p className="muted" role="status">Chargement du support…</p></Screen>;
  return <Deck module={m} slides={slides} />;
}

interface Chapter { key: string; title: string; start: number; count: number }

function Deck({ module: m, slides }: { module: ModuleMeta; slides: SlideDef[] }) {
  const [params, setParams] = useSearchParams();
  const total = slides.length;

  // Une séquence = une suite contiguë de slides de la même leçon ; ouverture
  // et clôture (sans leçon) forment leurs propres séquences.
  const chapters = useMemo(() => {
    const out: Chapter[] = [];
    slides.forEach((s, i) => {
      const key = s.lesson ?? (i === 0 ? 'intro' : 'fin');
      const last = out[out.length - 1];
      if (last && last.key === key) { last.count++; return; }
      const lesson = m.lessons.find((l) => l.id === s.lesson);
      const n = lesson ? m.lessons.indexOf(lesson) + 1 : 0;
      out.push({ key, start: i, count: 1, title: lesson ? `${pad2(n)} · ${lesson.title}` : key === 'intro' ? 'Ouverture' : 'Clôture' });
    });
    return out;
  }, [slides, m]);

  const [index, setIndex] = useState(() => {
    const byLesson = slides.findIndex((s) => s.lesson === params.get('l'));
    if (byLesson >= 0) return byLesson;
    const s = Number(params.get('s'));
    return Number.isInteger(s) && s >= 1 && s <= total ? s - 1 : 0;
  });
  const [overview, setOverview] = useState(false);
  const [notes, setNotes] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [full, setFull] = useState(false);
  const [scale, setScale] = useState(1);
  const deckRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const swipe = useRef<number | null>(null);

  const go = useCallback((i: number) => setIndex(Math.max(0, Math.min(total - 1, i))), [total]);

  // Position dans l'URL : un lien partagé ou un rechargement rouvre la même slide.
  useEffect(() => {
    setParams({ s: String(index + 1) }, { replace: true });
  }, [index, setParams]);

  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const fit = () => {
      const pad = full ? 0 : 32;
      setScale(Math.min((el.clientWidth - pad) / SLIDE_W, (el.clientHeight - pad) / SLIDE_H));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [full, notes]);

  useEffect(() => {
    const onChange = () => setFull(document.fullscreenElement === deckRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFull = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void deckRef.current?.requestFullscreen?.().catch(() => undefined);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'SELECT' || tag === 'INPUT' || tag === 'TEXTAREA') return;
      const k = e.key;
      if (k === 'ArrowRight' || k === 'PageDown' || k === ' ' || k === 'ArrowDown') { e.preventDefault(); go(index + 1); }
      else if (k === 'ArrowLeft' || k === 'PageUp' || k === 'ArrowUp') { e.preventDefault(); go(index - 1); }
      else if (k === 'Home') go(0);
      else if (k === 'End') go(total - 1);
      else if (k === 'f' || k === 'F') toggleFull();
      else if (k === 'n' || k === 'N') setNotes((v) => !v);
      else if (k === 'g' || k === 'G' || k === 'o' || k === 'O') setOverview((v) => !v);
      else if (k === 'Escape') setOverview(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, index, total, toggleFull]);

  // window.print() bloque jusqu'à la fermeture de la boîte de dialogue : on
  // laisse d'abord React monter toutes les slides, puis on les retire.
  useEffect(() => {
    if (!printing) return;
    const t = window.setTimeout(() => { window.print(); setPrinting(false); }, 150);
    return () => window.clearTimeout(t);
  }, [printing]);

  const slide = slides[index];
  const lessonOf = (s: SlideDef) => m.lessons.find((l) => l.id === s.lesson);
  const chapter = chapters.find((c) => index >= c.start && index < c.start + c.count) ?? chapters[0];

  return (
    <div className="deck" ref={deckRef}>
      <header className="deck-bar">
        <Link to="/slides" className="back-link" aria-label="Retour aux slides"><ArrowLeft size={15} /> <span className="deck-hide-sm">Slides</span></Link>
        <span className="deck-title"><Orb palette={m.palette} xs /><span className="t">M{pad2(m.num)} · {m.title}</span></span>
        <select className="deck-chapter" aria-label="Aller à la séquence" value={chapter.start} onChange={(e) => go(Number(e.target.value))}>
          {chapters.map((c) => <option key={c.start} value={c.start}>{c.title}</option>)}
        </select>
        <div className="deck-tools">
          <span className="deck-count"><b>{pad2(index + 1)}</b> / {pad2(total)}</span>
          <button className="icon-btn" aria-pressed={overview} onClick={() => setOverview((v) => !v)} title="Vue d’ensemble (G)" aria-label="Vue d’ensemble"><LayoutGrid size={17} /></button>
          <button className="icon-btn" aria-pressed={notes} onClick={() => setNotes((v) => !v)} title="Notes du formateur (N)" aria-label="Notes du formateur"><NotebookText size={17} /></button>
          <button className="icon-btn deck-hide-sm" onClick={() => setPrinting(true)} title="Imprimer ou exporter en PDF" aria-label="Imprimer ou exporter en PDF"><Printer size={17} /></button>
          <button className="icon-btn" onClick={toggleFull} title="Plein écran (F)" aria-label={full ? 'Quitter le plein écran' : 'Plein écran'}>{full ? <Shrink size={17} /> : <Expand size={17} />}</button>
        </div>
      </header>

      <div className="deck-stage" ref={stageRef}
        onPointerDown={(e) => { if (e.pointerType !== 'mouse') swipe.current = e.clientX; }}
        onPointerUp={(e) => {
          if (swipe.current === null) return;
          const dx = e.clientX - swipe.current;
          swipe.current = null;
          if (Math.abs(dx) > 60) go(index + (dx < 0 ? 1 : -1));
        }}>
        <div className="deck-canvas" style={{ transform: `translate(-50%, -50%) scale(${scale})` }} aria-live="polite" aria-roledescription="slide" aria-label={`${index + 1} sur ${total} : ${slide.title}`}>
          <SlideFrame slide={slide} module={m} lesson={lessonOf(slide)} index={index} total={total} />
        </div>

        {overview && (
          <div className="deck-overview" role="dialog" aria-label="Vue d’ensemble des slides">
            {chapters.map((c) => (
              <section key={c.start}>
                <span className="label">{c.title}</span>
                <div className="deck-thumbs" style={{ gridTemplateColumns: `repeat(auto-fill, ${THUMB_W}px)` }}>
                  {slides.slice(c.start, c.start + c.count).map((s, k) => {
                    const i = c.start + k;
                    return (
                      <button key={i} className={`deck-thumb ${i === index ? 'cur' : ''}`} onClick={() => { go(i); setOverview(false); }}>
                        <div className="thumb-box">
                          <div style={{ transform: `scale(${THUMB_W / SLIDE_W})` }}>
                            <SlideFrame slide={s} module={m} lesson={lessonOf(s)} index={i} total={total} />
                          </div>
                        </div>
                        <span className="thumb-cap"><span className="mono">{pad2(i + 1)}</span>{s.title}</span>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      {notes && (
        <aside className="deck-notes" aria-label="Notes du formateur">
          <span className="label">Notes du formateur</span>
          {slide.notes ?? <p className="dim">Pas de note pour cette slide.</p>}
        </aside>
      )}

      <footer className="deck-controls">
        <button className="btn sm icon" onClick={() => go(index - 1)} disabled={index === 0} aria-label="Slide précédente"><ChevronLeft size={18} /></button>
        <div className="deck-progress">
          {chapters.map((c) => {
            const done = Math.max(0, Math.min(c.count, index - c.start + 1));
            return (
              <button key={c.start} style={{ ['--n' as string]: c.count }} className={index >= c.start && index < c.start + c.count ? 'cur' : ''}
                onClick={() => go(c.start)} title={c.title} aria-label={`Aller à : ${c.title}`}>
                <i style={{ width: `${(done / c.count) * 100}%` }} />
              </button>
            );
          })}
        </div>
        <button className="btn sm primary icon" onClick={() => go(index + 1)} disabled={index === total - 1} aria-label="Slide suivante"><ChevronRight size={18} /></button>
      </footer>

      {printing && (
        <div className="deck-print">
          {slides.map((s, i) => <SlideFrame key={i} slide={s} module={m} lesson={lessonOf(s)} index={i} total={total} />)}
        </div>
      )}
    </div>
  );
}

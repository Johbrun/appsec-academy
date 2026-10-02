import type { ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import { CodeBlock } from './Code';
import { Difficulty, Orb } from './ui';
import { blocks, pad2, type LessonMeta, type ModuleMeta } from '../data/catalog';
import type { SlideDef } from '../lib/slides';

// Briques des decks (src/slides/*.tsx). Une slide est un canevas fixe de
// 1280 × 720 que la visionneuse met à l'échelle : on raisonne en pixels de
// canevas, et ce qui tient à l'écran tient aussi à l'impression.

export const SLIDE_W = 1280;
export const SLIDE_H = 720;

export type Accent = 'signal' | 'blue' | 'violet' | 'orange' | 'red' | 'green' | 'teal' | 'ink';

export function SlideFrame({ slide, module: m, lesson, index, total }: {
  slide: SlideDef; module: ModuleMeta; lesson?: LessonMeta; index: number; total: number;
}) {
  const layout = slide.layout ?? 'content';
  const lessonNum = lesson ? m.lessons.indexOf(lesson) + 1 : 0;

  if (layout === 'cover' || layout === 'end') {
    const block = blocks.find((b) => b.id === m.block);
    return (
      <div className={`slide slide--${layout}`}>
        <Orb palette={m.palette} className="slide-orb" />
        <div className="slide-cover-text">
          <div className="slide-eyebrow">{slide.eyebrow ?? <>Module {pad2(m.num)} <span className="sep">/</span> Bloc {m.block} · {block?.title}</>}</div>
          <h1>{slide.title}</h1>
          {slide.body}
        </div>
        <div className="slide-foot"><span>AppSec Academy</span><span>{pad2(index + 1)} / {pad2(total)}</span></div>
      </div>
    );
  }

  if (layout === 'section' && lesson) {
    return (
      <div className="slide slide--section">
        <div className="slide-section-num mono">{pad2(lessonNum)}</div>
        <div className="slide-section-text">
          <div className="slide-eyebrow">Séquence {lessonNum} sur {m.lessons.length} <span className="sep">/</span> M{pad2(m.num)} · {m.short}</div>
          <h1>{slide.title}</h1>
          <p className="slide-lead">{lesson.summary}</p>
          <div className="row" style={{ gap: 20 }}>
            <Difficulty level={lesson.level} prefix />
            {lesson.csslp.map((d) => <span key={d} className="ref">CSSLP {d}</span>)}
          </div>
          {slide.body}
        </div>
        <Orb palette={m.palette} className="slide-section-orb" />
        <div className="slide-foot"><span>M{pad2(m.num)} · {m.title}</span><span>{pad2(index + 1)} / {pad2(total)}</span></div>
      </div>
    );
  }

  return (
    <div className="slide slide--content">
      <header className="slide-head">
        <div className="slide-eyebrow">{slide.eyebrow ?? (lesson ? <>{pad2(lessonNum)} · {lesson.title}</> : `M${pad2(m.num)} · ${m.short}`)}</div>
        <h2>{slide.title}</h2>
      </header>
      <div className="slide-body">{slide.body}</div>
      <div className="slide-foot">
        <span>M{pad2(m.num)} · {m.short}</span>
        {slide.source && <span className="slide-source">Source : {slide.source}</span>}
        <span>{pad2(index + 1)} / {pad2(total)}</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- Primitives */

export function Cols({ children, cols = 2, gap = 28, align }: { children: ReactNode; cols?: number | string; gap?: number; align?: 'start' | 'center' | 'end' | 'stretch' }) {
  const template = typeof cols === 'number' ? `repeat(${cols}, minmax(0, 1fr))` : cols;
  return <div className="s-cols" style={{ gridTemplateColumns: template, gap, alignItems: align }}>{children}</div>;
}

export function Panel({ accent = 'ink', label, title, children, tone }: {
  accent?: Accent; label?: ReactNode; title?: ReactNode; children?: ReactNode; tone?: 'soft' | 'dark';
}) {
  return (
    <div className={`s-panel acc-${accent} ${tone ?? ''}`}>
      {label && <span className="s-label">{label}</span>}
      {title && <b className="s-panel-title">{title}</b>}
      {children && <div className="s-panel-body">{children}</div>}
    </div>
  );
}

export function Points({ items, accent = 'signal', size }: { items: ReactNode[]; accent?: Accent; size?: 'lg' }) {
  return (
    <ul className={`s-points acc-${accent} ${size ?? ''}`}>
      {items.map((it, k) => <li key={k}>{it}</li>)}
    </ul>
  );
}

export function Stat({ value, label, accent = 'ink' }: { value: ReactNode; label: ReactNode; accent?: Accent }) {
  return (
    <div className={`s-stat acc-${accent}`}>
      <b>{value}</b>
      <span>{label}</span>
    </div>
  );
}

/** Identifiant ATT&CK, CWE ou CAPEC, en pastille. `off` : révoqué ou périmé. */
export function Tid({ children, accent, off }: { children: ReactNode; accent?: Accent; off?: boolean }) {
  return <span className={`s-tid ${accent ? `acc-${accent} on` : ''} ${off ? 'off' : ''}`}>{children}</span>;
}

/** Une chaîne d'attaque ou un flux, de gauche à droite. */
export function Chain({ steps, accent = 'signal' }: { steps: { id?: ReactNode; text: ReactNode; note?: ReactNode; tone?: 'claim' | 'stop' }[]; accent?: Accent }) {
  return (
    <ol className={`s-chain acc-${accent}`} style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
      {steps.map((s, k) => (
        <li key={k} className={s.tone ?? ''}>
          <span className="s-chain-n mono">{pad2(k + 1)}</span>
          {s.id && <span className="s-chain-id">{s.id}</span>}
          <b>{s.text}</b>
          {s.note && <span className="s-chain-note">{s.note}</span>}
          {k < steps.length - 1 && <ArrowRight className="s-chain-arrow" size={18} aria-hidden="true" />}
        </li>
      ))}
    </ol>
  );
}

export function STable({ head, rows, widths, compact }: { head: ReactNode[]; rows: ReactNode[][]; widths?: string[]; compact?: boolean }) {
  return (
    <table className={`s-table ${compact ? 'compact' : ''}`}>
      {widths && <colgroup>{widths.map((w, k) => <col key={k} style={{ width: w }} />)}</colgroup>}
      <thead><tr>{head.map((h, k) => <th key={k}>{h}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, k) => <td key={k}>{c}</td>)}</tr>)}</tbody>
    </table>
  );
}

export function SSteps({ items, accent = 'signal', cols }: { items: { title: ReactNode; text?: ReactNode }[]; accent?: Accent; cols?: number }) {
  return (
    <ol className={`s-steps acc-${accent}`} style={{ gridTemplateColumns: `repeat(${cols ?? items.length}, minmax(0, 1fr))` }}>
      {items.map((s, k) => (
        <li key={k}>
          <span className="mono">{pad2(k + 1)}</span>
          <b>{s.title}</b>
          {s.text && <p>{s.text}</p>}
        </li>
      ))}
    </ol>
  );
}

/** Encadré de cas réel, de piège ou de débat, sur le modèle des Callout de leçon. */
export function Note({ kind, title, children }: { kind: 'case' | 'warn' | 'debate' | 'tip'; title?: string; children: ReactNode }) {
  const labels = { case: 'Cas réel', warn: 'Piège', debate: 'Débat', tip: 'À retenir' };
  return (
    <aside className={`s-note s-note--${kind}`}>
      <span className="s-label">{title ?? labels[kind]}</span>
      <div>{children}</div>
    </aside>
  );
}

export function SCode({ code, lang = 'ts', file, hl, tone }: { code: string; lang?: string; file?: string; hl?: string; tone?: 'bad' | 'good' }) {
  return <div className="s-code"><CodeBlock code={code} lang={lang} file={file} hl={hl} tone={tone} /></div>;
}

/** Récapitulatif de fin de séquence. */
export function Takeaways({ items }: { items: ReactNode[] }) {
  return (
    <ol className="s-takeaways">
      {items.map((it, k) => <li key={k}><span className="mono">{pad2(k + 1)}</span><span>{it}</span></li>)}
    </ol>
  );
}

import {
  type LucideProps, ArrowLeft, Award, BadgeCheck, Blocks, BookOpen, Brain, BrainCircuit, Bug, CheckCircle2, Circle, CircleCheck, ClipboardList,
  Compass, Crosshair, FileCode, Fingerprint, Flag, FlaskConical, Footprints, Gamepad2, GitBranch, Globe, GraduationCap, Handshake, KeyRound,
  Layers, Library, Link as LinkIcon, ListChecks, Map, Microscope, PenTool, Puzzle, Radar, Rocket, RotateCcw, ScanSearch, ScrollText, Search,
  Shapes, ShieldAlert, ShieldCheck, Siren, Sparkles, Star, Swords, Target, Timer, Trophy, Waypoints, Workflow, XCircle,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { levelNames, type Csslp, type Level, type Palette } from '../data/catalog';
import { gameById } from '../data/games';

// Table explicite plutôt que l'export `icons` de lucide, qui embarque toute la bibliothèque.
const icons: Record<string, React.ComponentType<LucideProps>> = {
  Award, BadgeCheck, Blocks, BookOpen, Brain, BrainCircuit, Bug, CheckCircle2, CircleCheck, ClipboardList, Compass, Crosshair, FileCode,
  Fingerprint, Flag, FlaskConical, Footprints, Gamepad2, GitBranch, Globe, GraduationCap, Handshake, KeyRound, Layers, Library, Link: LinkIcon,
  ListChecks, Map, Microscope, PenTool, Puzzle, Radar, Rocket, ScanSearch, ScrollText, Search, Shapes, ShieldAlert, ShieldCheck, Siren,
  Sparkles, Star, Swords, Target, Timer, Trophy, Waypoints, Workflow,
};

export function Icon({ name, ...props }: { name: string } & LucideProps) {
  const Cmp = icons[name] ?? Circle;
  return <Cmp {...props} />;
}

// Monogramme : trois lignes de code, et un curseur « signal ».
export function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="logo-mark">
      <rect x="2.5" y="3" width="19" height="5" rx="1.5" fill="currentColor" />
      <rect x="2.5" y="9.5" width="10" height="5" rx="1.5" fill="currentColor" />
      <rect x="14.5" y="9.5" width="5" height="5" rx="1.5" className="logo-signal" />
      <rect x="2.5" y="16" width="15" height="5" rx="1.5" fill="currentColor" />
    </svg>
  );
}

export function Brand() {
  return (
    <>
      <Logo />
      <span className="brand-name">AppSec<span className="brand-path">/academy</span></span>
    </>
  );
}

export function Orb({ palette, className = '', style, children, xs, still }: {
  palette: Palette; className?: string; style?: CSSProperties; children?: ReactNode; xs?: boolean; still?: boolean;
}) {
  const cls = ['orb', `orb--${palette}`, xs ? 'xs' : '', still ? 'still' : '', className].filter(Boolean).join(' ');
  return <span className={cls} style={style} aria-hidden={children ? undefined : true}>{children}</span>;
}

export function PageHead({ eyebrow, title, children, aside }: { eyebrow: ReactNode; title: ReactNode; children?: ReactNode; aside?: ReactNode }) {
  return (
    <section className="block page-head">
      <div className="eyebrow">{eyebrow}</div>
      <div className="split">
        <h1 className="split-main">{title}</h1>
        {(children || aside) && (
          <div className="split-side">
            {children && <p className="lead muted">{children}</p>}
            {aside}
          </div>
        )}
      </div>
    </section>
  );
}

export function Block({ eyebrow, title, lead, action, children, className = '' }: {
  eyebrow?: ReactNode; title?: ReactNode; lead?: ReactNode; action?: ReactNode; children?: ReactNode; className?: string;
}) {
  const hasHead = eyebrow || title || lead || action;
  return (
    <section className={`block ${className}`}>
      {hasHead && (
        <div className="block-head split">
          <div className="split-main">
            {eyebrow && <div className="eyebrow">{eyebrow}</div>}
            {title && <h2>{title}</h2>}
          </div>
          {(lead || action) && (
            <div className={`split-side ${lead ? '' : 'action-only'}`}>
              {lead && <p className="lead muted">{lead}</p>}
              {action && <div className={lead ? 'mt' : ''}>{action}</div>}
            </div>
          )}
        </div>
      )}
      {children}
    </section>
  );
}

// Niveau N1 à N3 sous forme de barres, comme la difficulté des jeux.
export function Difficulty({ level, label = true, prefix = false }: { level: Level; label?: boolean; prefix?: boolean }) {
  const name = `${prefix ? `N${level} · ` : ''}${levelNames[level]}`;
  return (
    <span className="diff" title={`Niveau : ${levelNames[level]}`}>
      <span className="bars" aria-hidden="true">
        {[1, 2, 3].map((k) => <i key={k} className={k <= level ? 'on' : ''} />)}
      </span>
      {label ? name : <span className="sr-only">{name}</span>}
    </span>
  );
}

export function CsslpTags({ domains }: { domains: Csslp[] }) {
  return (
    <span className="row" style={{ gap: 6, display: 'inline-flex' }}>
      {domains.map((d) => <span key={d} className="tag mono" title={`Domaine CSSLP ${d}`}>CSSLP {d}</span>)}
    </span>
  );
}

export function GameHeader({ id, title, current, total, extra, counter = true, level }: { id: string; title: string; current: number; total: number; extra?: ReactNode; counter?: boolean; level?: Level }) {
  const game = gameById(id);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    <div className="game-head">
      <div className="top">
        <Link to="/jeux" className="back-link"><ArrowLeft size={15} /> Jeux</Link>
        <div className="row" style={{ gap: 16 }}>
          {extra}
          {counter && <span className="counter"><b>{pad(Math.min(current + 1, total))}</b> / {pad(total)}</span>}
        </div>
      </div>
      <div className="row between" style={{ alignItems: 'flex-end', marginBottom: 20 }}>
        <h2 style={{ margin: 0 }}>{title}</h2>
        {(level ?? game?.level) && <Difficulty level={(level ?? game?.level)!} />}
      </div>
      <div className="meter lg"><div style={{ width: `${(current / total) * 100}%` }} /></div>
    </div>
  );
}

export function ScoreRing({ pct, size = 168 }: { pct: number; size?: number }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const f = requestAnimationFrame(() => setShown(pct));
    return () => cancelAnimationFrame(f);
  }, [pct]);
  const mid = size / 2;
  const r = mid - 20;
  const c = 2 * Math.PI * r;
  const color = pct >= 80 ? 'var(--ok)' : pct >= 50 ? 'var(--ink)' : 'var(--ko)';
  return (
    <div className="score-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        {Array.from({ length: 60 }, (_, k) => {
          const a = (k / 60) * 2 * Math.PI;
          const r1 = mid - 4;
          const r2 = mid - (k % 5 === 0 ? 11 : 7);
          return <line key={k} x1={mid + r1 * Math.cos(a)} y1={mid + r1 * Math.sin(a)} x2={mid + r2 * Math.cos(a)} y2={mid + r2 * Math.sin(a)} stroke="var(--line-2)" strokeWidth="1" />;
        })}
        <circle cx={mid} cy={mid} r={r} stroke="var(--surface-3)" strokeWidth="3" fill="none" />
        <circle cx={mid} cy={mid} r={r} stroke={color} strokeWidth="3" fill="none" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c - (shown / 100) * c} style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(.2,.8,.2,1)' }} />
      </svg>
      <span style={{ fontSize: Math.round(size * 0.26) }}>{pct}%</span>
    </div>
  );
}

export function ScoreScreen({ pct, title, onRetry, children }: { pct: number; title: string; onRetry: () => void; children?: ReactNode }) {
  return (
    <div className="card score">
      <ScoreRing pct={pct} />
      <div className="label" style={{ marginBottom: 10 }}>Résultat de la session</div>
      <h2>{title}</h2>
      <p className="muted">{pct >= 80 ? 'Excellent travail, tu maîtrises le sujet.' : pct >= 50 ? 'Pas mal ! Encore un effort pour dépasser 80 %.' : 'Reprends les leçons associées et retente ta chance.'}</p>
      {children}
      <div className="actions center">
        <button className="btn" onClick={onRetry}><RotateCcw size={16} /> Rejouer</button>
        <Link to="/jeux" className="btn primary">Autres jeux</Link>
      </div>
    </div>
  );
}

export function Feedback({ good, children }: { good: boolean; children: ReactNode }) {
  return (
    <div className={`feedback ${good ? 'good' : 'bad'}`} role="status">
      {good ? <CheckCircle2 color="var(--ok)" size={22} /> : <XCircle color="var(--ko)" size={22} />}
      <div>{children}</div>
    </div>
  );
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Carte centrée plein écran : chargement, erreur, états avant que l'application soit prête. */
export function Screen({ children }: { children: ReactNode }) {
  return (
    <div className="app">
      <main className="frame">
        <section className="block">
          <div className="card pad-lg" style={{ maxWidth: 480, marginInline: 'auto', textAlign: 'center' }}>{children}</div>
        </section>
      </main>
    </div>
  );
}

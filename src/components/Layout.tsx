import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation, useSearchParams } from 'react-router-dom';
import { ArrowRight, Award, Check, ChevronDown, Menu, Moon, Sparkles, Sun, X } from 'lucide-react';
import { Brand, Icon, Orb } from './ui';
import { Identicon } from './Marks';
import { levelFor, useProgress, type SyncState } from '../store/progress';
import { useSession } from '../store/session';
import { blocks, lessonKey, modules, pad2 } from '../data/catalog';
import { availableGames, gameById, gameCategories } from '../data/games';
import { isWritten } from '../lib/content';

const syncLabel: Record<SyncState, string> = {
  saved: 'Progression enregistrée',
  saving: 'Enregistrement…',
  offline: 'Hors ligne : nouvel essai automatique',
  rejected: 'Enregistrement refusé par le serveur',
};

type Theme = 'light' | 'dark';
const THEME_KEY = 'appsec-academy-theme';

function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'));
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0A0B0A' : '#F9F9F7');
    try { localStorage.setItem(THEME_KEY, theme); } catch { /* stockage indisponible */ }
  }, [theme]);
  return [theme, () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))] as const;
}

// Prochaine leçon rédigée et non validée, dans l'ordre du parcours.
export function useNextLesson() {
  const { progress } = useProgress();
  for (const m of modules) {
    for (const l of m.lessons) {
      if (isWritten(m.id, l.id) && !progress.lessons[lessonKey(m.id, l.id)]) return { module: m, lesson: l, to: `/modules/${m.id}/${l.id}` };
    }
  }
  return null;
}

// Menu déroulant : survol sur les appareils qui le permettent, clic partout.
function NavMenu({ label, active, children, wide }: { label: string; active: boolean; children: ReactNode; wide?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<number>();
  const canHover = useRef(window.matchMedia('(hover: hover)').matches);
  const { pathname } = useLocation();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const enter = () => { if (!canHover.current) return; window.clearTimeout(timer.current); setOpen(true); };
  const leave = () => { if (!canHover.current) return; timer.current = window.setTimeout(() => setOpen(false), 140); };

  return (
    <div className="nav-menu" ref={ref} onMouseEnter={enter} onMouseLeave={leave}>
      <button className={`nav-link ${active ? 'active' : ''}`} aria-expanded={open} aria-haspopup="true"
        onClick={() => setOpen((o) => (canHover.current ? true : !o))}>
        {label} <ChevronDown size={14} />
      </button>
      {open && <div className={`menu-panel ${wide ? 'wide' : ''}`}>{children}</div>}
    </div>
  );
}

function ModuleSubNav({ moduleId }: { moduleId: string }) {
  const { progress } = useProgress();
  const m = modules.find((x) => x.id === moduleId);
  if (!m) return null;
  const done = m.lessons.filter((l) => progress.lessons[lessonKey(m.id, l.id)]).length;
  return (
    <div className="subnav">
      <div className="container subnav-inner">
        <Link to={`/modules/${m.id}`} className="subnav-title">
          <span className="tile"><Orb palette={m.palette} xs /></span>
          M{pad2(m.num)} · {m.short} <span className="count">{done}/{m.lessons.length}</span>
        </Link>
        <nav className="subnav-links" aria-label={`Leçons du module ${m.title}`}>
          {m.lessons.map((l, i) => {
            const ok = !!progress.lessons[lessonKey(m.id, l.id)];
            const written = isWritten(m.id, l.id);
            return written ? (
              <NavLink key={l.id} to={`/modules/${m.id}/${l.id}`} className={({ isActive }) => `subnav-link ${isActive ? 'active' : ''}`} title={l.title}>
                <span className="num">{pad2(i + 1)}</span>
                {l.title.length > 26 ? `${l.title.slice(0, 24)}…` : l.title}
                {ok && <Check size={14} className="done" aria-label="validée" />}
              </NavLink>
            ) : (
              <span key={l.id} className="subnav-link off" title={`${l.title} (en rédaction)`}><span className="num">{pad2(i + 1)}</span>{l.title.length > 26 ? `${l.title.slice(0, 24)}…` : l.title}</span>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

function GamesSubNav({ gameId }: { gameId?: string }) {
  const { progress } = useProgress();
  // Sur la page d'un jeu, on montre ses voisins de catégorie : c'est ce dont on
  // a besoin là. Ailleurs, on montre les catégories.
  const current = gameId ? gameById(gameId) : undefined;
  const cat = current ? gameCategories.find((c) => c.id === current.category) : undefined;
  const siblings = cat ? availableGames.filter((g) => g.category === cat.id) : [];

  return (
    <div className="subnav">
      <div className="container subnav-inner">
        <Link to={cat ? `/jeux?c=${cat.id}` : '/jeux'} className="subnav-title">
          <span className="tile"><Orb palette={cat?.palette ?? 'purple'} xs /></span>
          {cat ? cat.title : 'Jeux'}{' '}
          <span className="count">
            {cat
              ? `${siblings.filter((g) => g.id in progress.scores).length}/${siblings.length} joués`
              : `${availableGames.filter((g) => g.id in progress.scores).length}/${availableGames.length} joués`}
          </span>
        </Link>
        <nav className="subnav-links" aria-label={cat ? `Jeux de la catégorie ${cat.title}` : 'Catégories de jeux'}>
          <NavLink to="/jeux" end className={({ isActive }) => `subnav-link ${isActive ? 'active' : ''}`}>Tous les jeux</NavLink>
          {cat
            ? siblings.map((g) => (
                <NavLink key={g.id} to={`/jeux/${g.id}`} className={({ isActive }) => `subnav-link ${isActive ? 'active' : ''}`}>
                  {g.title}
                  {progress.scores[g.id] !== undefined && <span className="meta">{progress.scores[g.id]}%</span>}
                </NavLink>
              ))
            : gameCategories.map((c) => {
                const list = availableGames.filter((g) => g.category === c.id);
                return (
                  <Link key={c.id} to={`/jeux?c=${c.id}`} className="subnav-link">
                    {c.short}
                    <span className="meta">{list.filter((g) => g.id in progress.scores).length}/{list.length}</span>
                  </Link>
                );
              })}
        </nav>
      </div>
    </div>
  );
}

export function Layout() {
  const { progress, toasts, sync } = useProgress();
  const { user } = useSession();
  const [theme, toggleTheme] = useTheme();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const lvl = levelFor(progress.xp);
  const next = useNextLesson();
  const started = Object.keys(progress.lessons).length > 0;

  const moduleMatch = pathname.match(/^\/modules\/(m\d{2})/);
  const inCourse = pathname.startsWith('/parcours') || !!moduleMatch;
  const inGames = pathname.startsWith('/jeux');
  const gameMatch = pathname.match(/^\/jeux\/([a-z0-9-]+)/);

  useEffect(() => { setOpen(false); window.scrollTo(0, 0); }, [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    <div className="app">
      <header className="nav">
        <div className="container nav-inner">
          <Link to="/" className="brand" aria-label="Accueil AppSec Academy"><Brand /></Link>

          <nav className="nav-links" aria-label="Navigation principale">
            <NavMenu label="Parcours" active={inCourse} wide>
              <div className="menu-head">
                <span className="label">Parcours · {modules.length} modules</span>
                <Link to="/parcours" className="label" style={{ color: 'var(--ink)' }}>Vue d’ensemble →</Link>
              </div>
              <div className="menu-blocks">
                {blocks.map((b) => (
                  <div key={b.id} className="menu-block">
                    <span className="label">{b.id === 'Z' ? 'Capstone' : `Bloc ${b.id} · ${b.title}`}</span>
                    {modules.filter((m) => m.block === b.id).map((m) => (
                      <Link key={m.id} to={`/modules/${m.id}`} className={`menu-mod ${pathname.startsWith(`/modules/${m.id}`) ? 'active' : ''}`}>
                        <Orb palette={m.palette} xs />
                        <span className="mono dim">M{pad2(m.num)}</span>
                        <span className="t">{m.short}</span>
                        {progress.modules.includes(m.id) && <Check size={13} color="var(--ok)" />}
                      </Link>
                    ))}
                  </div>
                ))}
              </div>
            </NavMenu>
            <NavMenu label="Jeux" active={inGames} wide>
              <div className="menu-head">
                <span className="label">{gameCategories.length} catégories · {availableGames.length} jeux</span>
                <Link to="/jeux" className="label" style={{ color: 'var(--ink)' }}>Tout voir →</Link>
              </div>
              <div className="menu-cats">
                {gameCategories.map((c) => {
                  const list = availableGames.filter((g) => g.category === c.id);
                  const done = list.filter((g) => g.id in progress.scores).length;
                  return (
                    <Link key={c.id} to={`/jeux?c=${c.id}`}
                      className={`menu-cat ${params.get('c') === c.id ? 'active' : ''}`}>
                      <span className="tile menu-tile"><Icon name={c.icon} size={17} /><Orb palette={c.palette} xs className="menu-px" /></span>
                      <span>
                        <b>{c.title} <span className="meta">{done}/{list.length}</span></b>
                        <span className="desc">{c.text}</span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            </NavMenu>
            <NavLink to="/labs" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>Labs</NavLink>
            <NavLink to="/examens" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>Examens</NavLink>
            <NavLink to="/bibliotheque" className={({ isActive }) => `nav-link opt ${isActive ? 'active' : ''}`}>Bibliothèque</NavLink>
            {user?.role === 'teacher' && <NavLink to="/enseignant" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>Enseignant</NavLink>}
          </nav>

          <div className="nav-right">
            <Link to="/profil" className="xp-pill" title={`Ma progression · ${syncLabel[sync]}`}>
              <Identicon name={progress.name} size={28} />
              <span className="xp-meta">
                <span className="label">Niv.{lvl.index} · {lvl.title}</span>
                <span className="meter"><div style={{ width: `${lvl.pct}%` }} /></span>
              </span>
              <span className="xp-val">{progress.xp} XP</span>
              <i className={`sync-dot ${sync}`} role="img" aria-label={syncLabel[sync]} />
            </Link>
            <button className="icon-btn" onClick={toggleTheme} aria-label={theme === 'dark' ? 'Passer au thème clair' : 'Passer au thème sombre'} title={theme === 'dark' ? 'Thème clair' : 'Thème sombre'}>
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <Link to={next?.to ?? '/parcours'} className="btn sm primary nav-cta">{started ? 'Reprendre' : 'Commencer'}</Link>
            <button className="icon-btn menu-btn" aria-expanded={open} aria-label={open ? 'Fermer le menu' : 'Ouvrir le menu'} onClick={() => setOpen((o) => !o)}>
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </header>

      {moduleMatch && <ModuleSubNav moduleId={moduleMatch[1]} />}
      {inGames && <GamesSubNav gameId={gameMatch?.[1]} />}

      {(sync === 'offline' || sync === 'rejected') && (
        <div className="sync-banner" role="status">
          <div className="container">{sync === 'offline'
            ? 'Hors ligne : ta progression sera enregistrée dès que la connexion revient. Garde cet onglet ouvert.'
            : 'Ta progression n’a pas pu être enregistrée : le serveur a refusé le document. Exporte-la depuis ton profil pour ne rien perdre.'}</div>
        </div>
      )}

      <main className="frame">
        <Outlet />
      </main>

      <footer className="footer">
        <div className="container" style={{ position: 'relative' }}>
          <span className="frame-marks" aria-hidden="true" />
          <div className="footer-inner">
            <div className="footer-brand">
              <Link to="/" className="brand"><Brand /></Link>
              <p>Parcours complet de sécurité applicative pour l’écosystème JavaScript et AWS, du finding au programme.</p>
            </div>
            {blocks.filter((b) => b.id !== 'Z').slice(0, 2).map((b) => (
              <div key={b.id} className="footer-col">
                <span className="label">Bloc {b.id} · {b.title}</span>
                {modules.filter((m) => m.block === b.id).map((m) => <Link key={m.id} to={`/modules/${m.id}`}>{m.title}</Link>)}
              </div>
            ))}
            <div className="footer-col">
              <span className="label">Pratique</span>
              <Link to="/parcours">Vue d’ensemble du parcours</Link>
              <Link to="/jeux">Jeux</Link>
              <Link to="/labs">Labs</Link>
              <Link to="/examens">Examens & certificat</Link>
              <Link to="/bibliotheque">Bibliothèque</Link>
              <Link to="/profil">Progression & badges</Link>
            </div>
          </div>
          <div className="footer-legal">
            <span>Contenu pédagogique non officiel. OWASP, MITRE ATT&CK®, CSSLP® (ISC2) et Burp Suite (PortSwigger) sont des marques de leurs détenteurs respectifs.</span>
            <span className="mono">Progression enregistrée sur ton compte</span>
          </div>
        </div>
      </footer>

      {open && (
        <div className="sheet" role="dialog" aria-label="Menu">
          <div className="sheet-group">
            <span className="label">Parcours</span>
            <Link to="/" className={`sheet-link ${pathname === '/' ? 'active' : ''}`}><Orb palette="signal" xs />Accueil</Link>
            <Link to="/parcours" className={`sheet-link ${pathname === '/parcours' ? 'active' : ''}`}><Orb palette="sand" xs />Vue d’ensemble</Link>
            {modules.map((m) => (
              <Link key={m.id} to={`/modules/${m.id}`} className={`sheet-link ${pathname.startsWith(`/modules/${m.id}`) ? 'active' : ''}`}>
                <Orb palette={m.palette} xs />{m.short}
                <span className="meta">{progress.modules.includes(m.id) ? '✓' : `M${pad2(m.num)}`}</span>
              </Link>
            ))}
          </div>
          <div className="sheet-group">
            <span className="label">Pratique</span>
            <Link to="/jeux" className={`sheet-link ${pathname === '/jeux' && !params.get('c') ? 'active' : ''}`}><Orb palette="purple" xs />Tous les jeux</Link>
            {gameCategories.map((c) => {
              const list = availableGames.filter((g) => g.category === c.id);
              const done = list.filter((g) => g.id in progress.scores).length;
              return (
                <Link key={c.id} to={`/jeux?c=${c.id}`} className={`sheet-link ${params.get('c') === c.id ? 'active' : ''}`}>
                  <Orb palette={c.palette} xs />{c.title}
                  <span className="meta">{done}/{list.length}</span>
                </Link>
              );
            })}
            <Link to="/labs" className={`sheet-link ${pathname === '/labs' ? 'active' : ''}`}><Orb palette="moss" xs />Labs</Link>
            <Link to="/examens" className={`sheet-link ${pathname.startsWith('/examens') ? 'active' : ''}`}><Orb palette="crimson" xs />Examens</Link>
            <Link to="/certificat" className={`sheet-link ${pathname === '/certificat' ? 'active' : ''}`}><Orb palette="gold" xs />Certificat</Link>
            <Link to="/bibliotheque" className={`sheet-link ${pathname === '/bibliotheque' ? 'active' : ''}`}><Orb palette="pearl" xs />Bibliothèque</Link>
          </div>
          <div className="sheet-group">
            <span className="label">Mon espace · Niv.{lvl.index} · {progress.xp} XP</span>
            <Link to="/profil" className={`sheet-link ${pathname === '/profil' ? 'active' : ''}`}><Orb palette="gold" xs />Progression & compte</Link>
            {user?.role === 'teacher' && <Link to="/enseignant" className={`sheet-link ${pathname.startsWith('/enseignant') ? 'active' : ''}`}><Orb palette="purple" xs />Espace enseignant</Link>}
            <Link to={next?.to ?? '/parcours'} className="sheet-link"><Orb palette="signal" xs />{started ? 'Reprendre' : 'Commencer'} <ArrowRight size={14} /></Link>
          </div>
        </div>
      )}

      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>
            <span className="t-ico">{t.kind === 'badge' ? <Award size={17} /> : <Sparkles size={17} />}</span>
            <div>
              <b>{t.title}</b>
              {t.text && <div className="small">{t.text}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

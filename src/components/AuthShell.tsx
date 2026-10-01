import type { ReactNode } from 'react';
import { Link, Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { Brand } from './ui';

/** `next` vient de l'URL : on n'accepte qu'un chemin interne, jamais une adresse externe ni une page d'authentification. */
export function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || /^\/(connexion|inscription|reinitialiser)/.test(raw)) return '/';
  return raw;
}

/** Page d'authentification : le même cadre que le site, sans le menu (il n'y a encore rien à y faire). */
export function AuthShell({ eyebrow, title, lead, children, footer }: { eyebrow: string; title: string; lead?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="app">
      <header className="nav">
        <div className="container nav-inner">
          <Link to="/connexion" className="brand" aria-label="AppSec Academy"><Brand /></Link>
        </div>
      </header>
      <main className="frame">
        <section className="block">
          <div className="auth-box">
            <div className="eyebrow">{eyebrow}</div>
            <h1 className="auth-title">{title}</h1>
            {lead && <p className="lead muted">{lead}</p>}
            <div className="card pad-lg auth-card">{children}</div>
            {footer && <p className="small dim auth-footer">{footer}</p>}
          </div>
        </section>
      </main>
    </div>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return <p className="small" role="alert" style={{ color: 'var(--ko)', margin: 0 }}>{message}</p>;
}

/** Une fois connecté, les pages d'authentification renvoient là d'où l'on venait. */
export function AfterAuth() {
  const [params] = useSearchParams();
  return <Navigate to={safeNext(params.get('next'))} replace />;
}

/** Sans session, toute page renvoie vers la connexion en retenant où l'on voulait aller. */
export function RedirectToLogin() {
  const { pathname, search } = useLocation();
  const target = pathname === '/' && !search ? '/connexion' : `/connexion?next=${encodeURIComponent(pathname + search)}`;
  return <Navigate to={target} replace />;
}

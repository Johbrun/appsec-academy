import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { clearSession, getUser } from './api.ts';
import { Login } from './pages/Login.tsx';
import { Invoices } from './pages/Invoices.tsx';
import { InvoiceDetail } from './pages/InvoiceDetail.tsx';
import { Checkout } from './pages/Checkout.tsx';
import { Assistant } from './pages/Assistant.tsx';
import { SettingsPage } from './pages/Settings.tsx';
import { Webhooks } from './pages/Webhooks.tsx';
import { Mails } from './pages/Mails.tsx';
import { Exercises } from './pages/Exercises.tsx';

export function App() {
  const user = getUser();

  return (
    <>
      <div className="warn-bar">
        <span>⚠</span>
        <span>
          <strong>Application volontairement vulnérable.</strong> Support d’exercices d’AppSec Academy —
          données fictives, boucle locale. Ne jamais exposer sur un réseau, ne jamais réutiliser ce code.
        </span>
      </div>

      <div className="shell">
        <nav className="rail">
          <div className="brand"><span className="brand-dot" /> Novafact</div>
          <div className="brand-sub">SaaS de facturation · lab</div>

          <div className="rail-group">Application</div>
          <NavLink to="/invoices" className={({ isActive }) => (isActive ? 'on' : '')}>Factures</NavLink>
          <NavLink to="/checkout" className={({ isActive }) => (isActive ? 'on' : '')}>Paiement</NavLink>
          <NavLink to="/assistant" className={({ isActive }) => (isActive ? 'on' : '')}>Ask Novafact</NavLink>
          <NavLink to="/settings" className={({ isActive }) => (isActive ? 'on' : '')}>Réglages</NavLink>
          <NavLink to="/webhooks" className={({ isActive }) => (isActive ? 'on' : '')}>Webhooks</NavLink>
          <NavLink to="/mails" className={({ isActive }) => (isActive ? 'on' : '')}>Boîte d’envoi</NavLink>

          <div className="rail-group">Lab</div>
          <NavLink to="/exercises" className={({ isActive }) => (isActive ? 'on' : '')}>Exercices</NavLink>

          <div className="rail-group">Session</div>
          {user ? (
            <div style={{ padding: '0 10px', fontSize: 13 }}>
              <div>{user.name}</div>
              <div className="muted mono" style={{ fontSize: 11.5 }}>{user.email}</div>
              <div className="muted" style={{ fontSize: 11.5, marginBottom: 8 }}>
                {user.tenantId} · {user.role}
              </div>
              <button onClick={() => { clearSession(); location.hash = '/login'; location.reload(); }}>
                Se déconnecter
              </button>
            </div>
          ) : (
            <NavLink to="/login" className={({ isActive }) => (isActive ? 'on' : '')}>Se connecter</NavLink>
          )}
        </nav>

        <main className="main">
          <Routes>
            <Route path="/" element={<Navigate to={user ? '/exercises' : '/login'} replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/invoices" element={<Invoices />} />
            <Route path="/invoices/:id" element={<InvoiceDetail />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/assistant" element={<Assistant />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/webhooks" element={<Webhooks />} />
            <Route path="/mails" element={<Mails />} />
            <Route path="/exercises" element={<Exercises />} />
          </Routes>
        </main>
      </div>
    </>
  );
}

import { useState } from 'react';
import { api, setSession } from '../api.ts';
import type { SessionUser } from '../api.ts';

export function Login() {
  const [email, setEmail] = useState('dev@acme.example');
  const [password, setPassword] = useState('dev');
  const [raw, setRaw] = useState(false);
  const [body, setBody] = useState('{\n  "email": "admin@novafact.example",\n  "password": "…"\n}');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(payload: string) {
    setError('');
    setBusy(true);
    try {
      const res = await api<{ token: string; user: SessionUser; attemptsBefore: number }>('/auth/login', {
        method: 'POST',
        body: payload,
      });
      setSession(res.token, res.user);
      location.hash = '/invoices';
      location.reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1>Connexion</h1>
      <p className="lead">Espace client Novafact.</p>

      <div className="card" style={{ maxWidth: 460 }}>
        {raw ? (
          <>
            <label>Corps de la requête envoyé à POST /api/auth/login</label>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} spellCheck={false} style={{ minHeight: 130 }} />
            <p className="muted" style={{ fontSize: 12.5, margin: '8px 0 0' }}>
              Le mode brut existe pour que le corps de la requête ne soit pas contraint par le formulaire.
              C’est le même endpoint : seule la forme du corps change.
            </p>
          </>
        ) : (
          <>
            <label>Adresse e-mail</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
            <label>Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              onKeyDown={(e) => e.key === 'Enter' && submit(JSON.stringify({ email, password }))}
            />
          </>
        )}

        {error && <p className="danger" style={{ fontSize: 13.5, marginBottom: 0 }}>{error}</p>}

        <div className="row" style={{ marginTop: 14 }}>
          <button
            className="primary"
            disabled={busy}
            onClick={() => submit(raw ? body : JSON.stringify({ email, password }))}
          >
            {busy ? 'Connexion…' : 'Se connecter'}
          </button>
          <button onClick={() => setRaw(!raw)}>{raw ? 'Formulaire' : 'Mode brut (JSON)'}</button>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 460 }}>
        <h3>Comptes du lab</h3>
        <table>
          <tbody>
            <tr><td className="mono">dev@acme.example</td><td className="mono muted">dev</td><td className="muted">le tien</td></tr>
            <tr><td className="mono">compta@globex.example</td><td className="muted">?</td><td className="muted">autre tenant</td></tr>
            <tr><td className="mono">admin@novafact.example</td><td className="muted">?</td><td className="muted">administrateur</td></tr>
          </tbody>
        </table>
      </div>
    </>
  );
}

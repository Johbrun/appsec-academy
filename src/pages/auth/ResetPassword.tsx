import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthShell, FormError } from '../../components/AuthShell';
import { api, messageOf } from '../../lib/api';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  // Le jeton est lu une fois puis retiré de l'adresse : il ne reste ni dans l'historique, ni dans un lien copié.
  const [token] = useState(() => params.get('token'));
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => { if (params.has('token')) navigate('/reinitialiser', { replace: true }); }, [params, navigate]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api('/auth/reset', { method: 'POST', body: { token, password } });
      setDone(true);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <AuthShell eyebrow="Mot de passe" title="C’est fait">
        <p style={{ marginTop: 0 }}>Ton mot de passe a changé. Tes anciennes sessions sont fermées.</p>
        <Link className="btn primary" to="/connexion">Se connecter</Link>
      </AuthShell>
    );
  }

  if (!token) {
    return (
      <AuthShell eyebrow="Mot de passe" title="Lien invalide" lead="Ouvre le lien complet que ton enseignant t’a transmis. Il est valable 24 heures et ne sert qu’une fois.">
        <Link className="btn" to="/connexion">Retour à la connexion</Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell eyebrow="Mot de passe" title="Choisis un nouveau mot de passe" lead="Ce lien ne sert qu’une fois.">
      <form onSubmit={submit} style={{ display: 'grid', gap: 18 }}>
        <label>
          <span className="label auth-label">Nouveau mot de passe</span>
          <input className="field" type="password" value={password} required minLength={10} maxLength={128} autoComplete="new-password" autoFocus onChange={(e) => setPassword(e.target.value)} />
          <span className="small dim" style={{ display: 'block', marginTop: 6 }}>10 caractères minimum.</span>
        </label>
        <FormError message={error} />
        <button className="btn primary" type="submit" disabled={busy || password.length < 10}>{busy ? 'Enregistrement…' : 'Changer le mot de passe'}</button>
      </form>
    </AuthShell>
  );
}

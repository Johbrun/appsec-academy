import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AuthShell, FormError } from '../../components/AuthShell';
import { messageOf } from '../../lib/api';
import { useSession } from '../../store/session';

export default function Login() {
  const { login } = useSession();
  const [params] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const next = params.get('next');
  const signupTo = next ? `/inscription?next=${encodeURIComponent(next)}` : '/inscription';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);   // la session change : le routeur redirige tout seul
    } catch (err) {
      setError(messageOf(err));
      setBusy(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Connexion"
      title="Retrouve ta progression"
      lead="Connecte-toi pour reprendre le parcours là où tu l’as laissé."
      footer={<>Pas encore de compte ? <Link to={signupTo} style={{ textDecoration: 'underline' }}>Créer un compte</Link>. Mot de passe oublié : demande un lien de réinitialisation à ton enseignant.</>}
    >
      <form onSubmit={submit} style={{ display: 'grid', gap: 18 }}>
        <label>
          <span className="label auth-label">Email</span>
          <input className="field" type="email" value={email} required autoComplete="email" autoFocus maxLength={254} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          <span className="label auth-label">Mot de passe</span>
          <input className="field" type="password" value={password} required autoComplete="current-password" maxLength={128} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <FormError message={error} />
        <button className="btn primary" type="submit" disabled={busy || !email || !password}>{busy ? 'Connexion…' : 'Se connecter'}</button>
      </form>
    </AuthShell>
  );
}

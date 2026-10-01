import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AuthShell, FormError } from '../../components/AuthShell';
import { api, messageOf } from '../../lib/api';
import { useSession } from '../../store/session';

export default function Signup() {
  const { signup, refresh } = useSession();
  const [params] = useSearchParams();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const next = params.get('next');
  const loginTo = next ? `/connexion?next=${encodeURIComponent(next)}` : '/connexion';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signup(email, name, password);   // la session s'ouvre : le routeur quitte cette page
      if (code.trim()) {
        // Le code est facultatif : un code erroné ne doit pas empêcher d'avoir un compte. Le profil permet de réessayer.
        await api('/cohorts/join', { method: 'POST', body: { code } }).then(() => refresh()).catch(() => undefined);
      }
    } catch (err) {
      setError(messageOf(err));
      setBusy(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Inscription"
      title="Crée ton compte"
      lead="Ta progression, tes badges et tes scores sont enregistrés et te suivent sur tous tes appareils."
      footer={<>Déjà inscrit·e ? <Link to={loginTo} style={{ textDecoration: 'underline' }}>Se connecter</Link></>}
    >
      <form onSubmit={submit} style={{ display: 'grid', gap: 18 }}>
        <label>
          <span className="label auth-label">Nom affiché</span>
          <input className="field" value={name} required autoComplete="name" autoFocus maxLength={80} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          <span className="label auth-label">Email</span>
          <input className="field" type="email" value={email} required autoComplete="email" maxLength={254} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          <span className="label auth-label">Mot de passe</span>
          <input className="field" type="password" value={password} required minLength={10} maxLength={128} autoComplete="new-password" onChange={(e) => setPassword(e.target.value)} />
          <span className="small dim" style={{ display: 'block', marginTop: 6 }}>10 caractères minimum. Une phrase fonctionne mieux qu’un mot compliqué.</span>
        </label>
        <label>
          <span className="label auth-label">Code de promo (facultatif)</span>
          <input className="field" value={code} maxLength={12} autoComplete="off" spellCheck={false} style={{ textTransform: 'uppercase', letterSpacing: '0.12em' }} onChange={(e) => setCode(e.target.value)} />
          <span className="small dim" style={{ display: 'block', marginTop: 6 }}>Fourni par ton enseignant. Il verra alors ton nom, ton email et ta progression.</span>
        </label>
        <FormError message={error} />
        <button className="btn primary" type="submit" disabled={busy || !name.trim() || !email || password.length < 10}>{busy ? 'Création…' : 'Créer mon compte'}</button>
      </form>
    </AuthShell>
  );
}

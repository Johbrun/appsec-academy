import { useEffect, useState } from 'react';
import { api } from '../api.ts';

interface Mail { id: string; to: string; subject: string; body: string; at: string; via: string; }

export function Mails() {
  const [mails, setMails] = useState<Mail[]>([]);
  const [email, setEmail] = useState('admin@novafact.example');
  const [sent, setSent] = useState('');

  const load = () => api<Mail[]>('/lab/mails').then(setMails);
  useEffect(() => { load(); }, []);

  async function forgot() {
    await api('/auth/forgot', { method: 'POST', body: JSON.stringify({ email }) });
    setSent('Demande envoyée. Le mail apparaît ci-dessous s’il est parti.');
    load();
  }

  return (
    <>
      <h1>Boîte d’envoi</h1>
      <p className="lead">
        Tout ce que l’application envoie via Amazon SES atterrit ici plutôt que dans une vraie boîte mail.
      </p>

      <div className="card">
        <h3>Mot de passe oublié</h3>
        <div className="row">
          <input value={email} onChange={(e) => setEmail(e.target.value)} className="mono" style={{ flex: 1, minWidth: 240 }} />
          <button onClick={forgot}>Envoyer le lien</button>
          <button onClick={load}>Rafraîchir</button>
        </div>
        {sent && <p className="muted" style={{ fontSize: 13.5, marginBottom: 0 }}>{sent}</p>}
      </div>

      {mails.length === 0 && <p className="empty">Aucun mail envoyé.</p>}
      {mails.map((m) => (
        <div className="card" key={m.id}>
          <div className="spread">
            <h3 style={{ margin: 0 }}>{m.subject}</h3>
            <span className="muted" style={{ fontSize: 12 }}>{new Date(m.at).toLocaleTimeString('fr-FR')}</span>
          </div>
          <p className="muted" style={{ fontSize: 13, margin: '4px 0 8px' }}>
            à <span className="mono">{m.to}</span> · via {m.via}
          </p>
          <pre style={{ margin: 0 }}>{m.body}</pre>
        </div>
      ))}
    </>
  );
}

import { useEffect, useState } from 'react';
import { api } from '../api.ts';

export function SettingsPage() {
  const [current, setCurrent] = useState<Record<string, unknown>>({});
  const [body, setBody] = useState('{\n  "theme": "dark"\n}');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = () => api<Record<string, unknown>>('/settings').then(setCurrent).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  async function save() {
    setError(''); setMessage('');
    try {
      const res = await api<Record<string, unknown>>('/settings', { method: 'PUT', body });
      setCurrent(res);
      setMessage('Réglages enregistrés.');
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function exportAccounting() {
    setError(''); setMessage('');
    try {
      const res = await api<{ invoices: unknown[] }>('/export');
      setMessage(`Export généré : ${res.invoices.length} facture(s), tous tenants confondus.`);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <>
      <h1>Réglages du tenant</h1>
      <p className="lead">Les préférences sont fusionnées récursivement dans les réglages stockés.</p>

      <div className="card">
        <h3>Réglages actuels</h3>
        <pre>{JSON.stringify(current, null, 2)}</pre>
      </div>

      <div className="card">
        <label>Corps envoyé à PUT /api/settings</label>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} spellCheck={false} style={{ minHeight: 120 }} />
        <div className="row" style={{ marginTop: 12 }}>
          <button className="primary" onClick={save}>Enregistrer</button>
          <button onClick={() => setBody('{\n  "analyticsUrl": "/api/lab/evil-script.js"\n}')}>
            Exemple : script tiers
          </button>
        </div>
        {message && <p className="ok" style={{ fontSize: 13.5, marginBottom: 0 }}>{message}</p>}
        {error && <p className="danger" style={{ fontSize: 13.5, marginBottom: 0 }}>{error}</p>}
      </div>

      <h2>Export comptable</h2>
      <div className="card">
        <p className="muted" style={{ fontSize: 13.5, marginTop: 0 }}>
          Réservé aux comptes autorisés. L’autorisation est lue sur un objet d’options construit à la volée.
        </p>
        <button onClick={exportAccounting}>Générer l’export</button>
      </div>
    </>
  );
}

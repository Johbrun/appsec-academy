import { useState } from 'react';
import { api } from '../api.ts';

interface TestResult { status: number; elapsedMs: number; headers: Record<string, string>; body: string; }

export function Webhooks() {
  const [url, setUrl] = useState('https://example.com/hook');
  const [result, setResult] = useState<TestResult | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function test() {
    setError(''); setResult(null); setBusy(true);
    try {
      setResult(await api<TestResult>('/webhooks/test', { method: 'POST', body: JSON.stringify({ url }) }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1>Webhooks</h1>
      <p className="lead">
        Teste l’URL vers laquelle Novafact enverra les événements de facturation. Le serveur va la chercher
        et te montre sa réponse.
      </p>

      <div className="card">
        <label>URL du webhook</label>
        <div className="row">
          <input value={url} onChange={(e) => setUrl(e.target.value)} className="mono" style={{ flex: 1, minWidth: 260 }} />
          <button className="primary" onClick={test} disabled={busy}>{busy ? 'Test…' : 'Tester'}</button>
        </div>
        <p className="muted" style={{ fontSize: 12.5, marginBottom: 0, marginTop: 10 }}>
          Le lab héberge un faux service de métadonnées d’instance sur <code>127.0.0.1:4318</code> — il imite IMDSv1.
          Rien ne sort de ta machine.
        </p>
      </div>

      {error && <p className="danger">{error}</p>}
      {result && (
        <div className="card">
          <h3>Réponse — HTTP {result.status} en {result.elapsedMs} ms</h3>
          <pre>{result.body}</pre>
        </div>
      )}
    </>
  );
}

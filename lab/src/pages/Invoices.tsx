import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.ts';

interface Line { label: string; qty: number; unitPrice: number; }
interface Invoice { id: string; ref: string; client: string; status: string; total: number; lines: Line[]; }

export function Invoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [error, setError] = useState('');

  const [client, setClient] = useState('Nouveau client');
  const [label, setLabel] = useState('Prestation');
  const [qty, setQty] = useState('1');
  const [unitPrice, setUnitPrice] = useState('100');

  const [ref, setRef] = useState('');
  const [search, setSearch] = useState<{ valid: boolean; elapsedMs: number; results: Invoice[] } | null>(null);
  const [searching, setSearching] = useState(false);

  const load = () => api<Invoice[]>('/invoices').then(setInvoices).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  async function create() {
    setError('');
    try {
      await api('/invoices', {
        method: 'POST',
        body: JSON.stringify({ client, lines: [{ label, qty: Number(qty), unitPrice: Number(unitPrice) }] }),
      });
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function doSearch() {
    setSearching(true);
    setSearch(null);
    try {
      setSearch(await api(`/invoices/search?ref=${encodeURIComponent(ref)}`));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSearching(false);
    }
  }

  return (
    <>
      <h1>Factures</h1>
      <p className="lead">Les factures de ton espace.</p>
      {error && <p className="danger">{error}</p>}

      <div className="card">
        <table>
          <thead>
            <tr><th>Référence</th><th>Client</th><th>Statut</th><th style={{ textAlign: 'right' }}>Total</th></tr>
          </thead>
          <tbody>
            {invoices.map((i) => (
              <tr key={i.id}>
                <td><Link to={`/invoices/${i.id}`} className="mono">{i.ref}</Link></td>
                <td>{i.client}</td>
                <td className={`status-${i.status}`}>{i.status}</td>
                <td style={{ textAlign: 'right' }} className={i.total < 0 ? 'danger mono' : 'mono'}>
                  {i.total.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {invoices.length === 0 && <p className="empty">Aucune facture.</p>}
        <p className="muted" style={{ fontSize: 12.5, marginBottom: 0, marginTop: 12 }}>
          Les identifiants sont séquentiels. La liste ne montre que ton tenant ; la fiche, elle, se charge par identifiant.
        </p>
      </div>

      <h2>Rechercher par référence</h2>
      <div className="card">
        <div className="row">
          <input
            value={ref}
            onChange={(e) => setRef(e.target.value)}
            placeholder="INV-1001"
            style={{ flex: 1, minWidth: 220 }}
            onKeyDown={(e) => e.key === 'Enter' && doSearch()}
          />
          <button onClick={doSearch} disabled={searching}>{searching ? 'Recherche…' : 'Chercher'}</button>
        </div>
        {search && (
          <p className="muted" style={{ fontSize: 13, marginBottom: 0 }}>
            Référence {search.valid ? 'valide' : 'rejetée'} · validation en{' '}
            <span className={search.elapsedMs > 1000 ? 'danger mono' : 'mono'}>{search.elapsedMs} ms</span> ·{' '}
            {search.results.length} résultat(s)
          </p>
        )}
      </div>

      <h2>Nouvelle facture</h2>
      <div className="card">
        <label>Client</label>
        <input value={client} onChange={(e) => setClient(e.target.value)} />
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <div style={{ flex: 2, minWidth: 180 }}>
            <label>Libellé de la ligne</label>
            <input value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>
          <div style={{ flex: 1, minWidth: 90 }}>
            <label>Quantité</label>
            <input value={qty} onChange={(e) => setQty(e.target.value)} className="mono" />
          </div>
          <div style={{ flex: 1, minWidth: 110 }}>
            <label>Prix unitaire</label>
            <input value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} className="mono" />
          </div>
        </div>
        <div className="row" style={{ marginTop: 14 }}>
          <button className="primary" onClick={create}>Créer</button>
          <span className="muted" style={{ fontSize: 13 }}>
            Total calculé côté serveur : {(Number(qty) * Number(unitPrice)).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
          </span>
        </div>
      </div>
    </>
  );
}

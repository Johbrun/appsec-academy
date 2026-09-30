import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { api, presentationFor } from '../api.ts';

interface Line { label: string; qty: number; unitPrice: number; }
interface Invoice {
  id: string; ref: string; client: string; status: string;
  total: number; lines: Line[]; note: string; attachment?: string;
  paymentUrl?: string;
}

/**
 * CORRIGÉ (react-javascript-url) : le schéma de l'URL est validé À LA
 * CONSTRUCTION du lien, pas à l'affichage. `http:` et `https:` seulement — tout
 * le reste est refusé, `javascript:` comme `data:` ou `vbscript:`.
 *
 * React protège du HTML injecté, et il l'a toujours dit. Il n'a jamais prétendu
 * protéger des URL.
 */
function safeHref(raw: string, fallback: string): string {
  try {
    const url = new URL(raw, location.origin);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : fallback;
  } catch {
    return fallback;
  }
}


export function InvoiceDetail() {
  const { id } = useParams();
  const [search] = useSearchParams();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [status, setStatus] = useState('');
  const [attachment, setAttachment] = useState('contrat-globex.txt');
  const [fileContent, setFileContent] = useState('');
  const preview = useRef<HTMLDivElement>(null);

  async function load() {
    setError('');
    try {
      const inv = await api<Invoice>(`/invoices/${id}`);
      setInvoice(inv);
      setNote(inv.note);
      setStatus(inv.status);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => { load(); }, [id]);

  // CORRIGÉ (trusted-types-default) : l'aperçu passe par la politique NOMMÉE
  // `novafact`, qui assainit. La politique par défaut, elle, jette — un puits
  // DOM non revu échoue bruyamment au lieu de passer en silence.
  const previewSource = search.get('preview') ?? '';
  useEffect(() => {
    const host = preview.current;
    if (!host) return;
    const policy = window.novafactHtml;
    if (!policy) { host.textContent = previewSource; return; }
    host.innerHTML = policy.createHTML(previewSource || 'Aucun aperçu demandé.');
  }, [previewSource, invoice]);

  async function save(patch: Record<string, unknown>) {
    try {
      const inv = await api<Invoice>(`/invoices/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
      setInvoice(inv);
      setStatus(inv.status);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function download() {
    setFileContent('');
    const res = await fetch(`/api/attachments/${attachment}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('novafact-lab-token')}` },
    });
    setFileContent(await res.text());
  }

  if (error) return (<><h1>Facture</h1><p className="danger">{error}</p></>);
  if (!invoice) return (<><h1>Facture</h1><p className="empty">Chargement…</p></>);

  return (
    <>
      <h1>{invoice.ref}</h1>
      <p className="lead">{invoice.client} · <span className={`status-${invoice.status}`}>{invoice.status}</span></p>

      {/* CORRIGÉ (client-proto-pollution) : les préférences ne produisent plus
          d'attributs arbitraires, seulement une classe CSS choisie dans un
          ensemble fini. Aucune donnée d'URL ne devient un nom d'attribut. */}
      <div {...presentationFor('banner')} />

      <div className="card">
        <table>
          <thead><tr><th>Ligne</th><th style={{ textAlign: 'right' }}>Qté</th><th style={{ textAlign: 'right' }}>PU</th><th style={{ textAlign: 'right' }}>Montant</th></tr></thead>
          <tbody>
            {invoice.lines.map((l, n) => (
              <tr key={n}>
                <td>{l.label}</td>
                <td style={{ textAlign: 'right' }} className="mono">{l.qty}</td>
                <td style={{ textAlign: 'right' }} className="mono">{l.unitPrice}</td>
                <td style={{ textAlign: 'right' }} className="mono">{(l.qty * l.unitPrice).toFixed(2)}</td>
              </tr>
            ))}
            <tr>
              <td colSpan={3} style={{ textAlign: 'right', fontWeight: 600 }}>Total</td>
              <td style={{ textAlign: 'right', fontWeight: 600 }} className={invoice.total < 0 ? 'danger mono' : 'mono'}>
                {invoice.total.toFixed(2)} €
              </td>
            </tr>
          </tbody>
        </table>
        <p style={{ marginBottom: 0 }}>
          <a href={safeHref(search.get('pay') ?? invoice.paymentUrl ?? '/api/pay/confirm', '/api/pay/confirm')} className="pay-link">
            Payer cette facture en ligne
          </a>
        </p>
      </div>

      <h2>Aperçu imprimable</h2>
      <div className="card">
        <div className="note-render" ref={preview} />
      </div>

      <h2>Note affichée au client</h2>
      <div className="card">
        {/* Le rendu de la note : c'est le sink de l'exercice dom-xss. */}
        {/* CORRIGÉ : React échappe le contenu. Plus aucun HTML n'est interprété. */}
        <div className="note-render" style={{ whiteSpace: 'pre-wrap' }}>{invoice.note}</div>
        <label>Modifier la note (Markdown)</label>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} spellCheck={false} />
        <div className="row" style={{ marginTop: 10 }}>
          <button className="primary" onClick={() => save({ note })}>Enregistrer la note</button>
        </div>
      </div>

      <h2>Statut</h2>
      <div className="card">
        <div className="row">
          <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ maxWidth: 180 }}>
            <option value="draft">draft</option>
            <option value="sent">sent</option>
            <option value="paid">paid</option>
            <option value="void">void</option>
          </select>
          <button onClick={() => save({ status })}>Changer le statut</button>
          <span className="muted" style={{ fontSize: 13 }}>Le statut d’arrivée est choisi par le client.</span>
        </div>
      </div>

      <h2>Pièce jointe</h2>
      <div className="card">
        <div className="row">
          <input value={attachment} onChange={(e) => setAttachment(e.target.value)} className="mono" style={{ flex: 1, minWidth: 240 }} />
          <button onClick={download}>Télécharger</button>
        </div>
        {fileContent && <pre>{fileContent}</pre>}
      </div>
    </>
  );
}

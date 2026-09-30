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
 * VULNÉRABLE (dom-xss) : convertisseur Markdown maison qui laisse passer le
 * HTML brut, dont les attributs d'événement. Le résultat part ensuite dans
 * dangerouslySetInnerHTML.
 *
 * Correctif attendu : laisser React échapper (rendre la note en texte), ou
 * assainir avec DOMPurify / la Sanitizer API avant le rendu. Puis une CSP
 * stricte à nonce et Trusted Types comme deuxième barrière.
 */
function renderMarkdown(md: string): string {
  return md
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br />');
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

  // VULNÉRABLE (trusted-types-default) : l'aperçu imprimable écrit dans
  // innerHTML — un puits DOM. Trusted Types est exigé par la CSP, donc la
  // chaîne traverse la politique par défaut de src/main.tsx… qui rend
  // l'identité. Le mécanisme est déclaré, il ne protège rien.
  //
  // Correctif attendu : une politique par défaut qui assainit ou qui jette, et
  // un rendu qui n'a pas besoin d'innerHTML.
  const previewSource = search.get('preview') ?? '';
  useEffect(() => {
    const host = preview.current;
    if (!host) return;
    const policy = window.novafactHtml ?? { createHTML: (s: string) => s };
    host.innerHTML = policy.createHTML(previewSource || '<em>Aucun aperçu demandé.</em>');
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

  // VULNÉRABLE (react-javascript-url) : l'URL de paiement est rendue dans un
  // attribut href sans que son schéma ait jamais été validé. React échappe le
  // HTML — il l'a toujours dit — mais il n'a jamais prétendu protéger des URL :
  // `javascript:` s'exécute dans la session de qui clique.
  //
  // Correctif attendu : valider le schéma À LA CONSTRUCTION du lien
  // (`new URL(u)` puis `protocol === 'http:' || 'https:'`), pas à l'affichage,
  // et refuser tout le reste.
  const paymentUrl = search.get('pay') ?? invoice.paymentUrl ?? '/api/pay/confirm';

  return (
    <>
      <h1>{invoice.ref}</h1>
      <p className="lead">{invoice.client} · <span className={`status-${invoice.status}`}>{invoice.status}</span></p>

      {/* Bandeau de la facture : son habillage vient des préférences
          d'affichage. Un objet ordinaire, lu par une clé qu'il ne possède
          pas — c'est tout ce dont client-proto-pollution a besoin. */}
      <div className="invoice-banner" {...presentationFor('banner')} />

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
          <a href={paymentUrl} className="pay-link">Payer cette facture en ligne</a>
          <span className="muted" style={{ fontSize: 12.5, marginLeft: 10 }}>
            lien de paiement : <code>{paymentUrl}</code>
          </span>
        </p>
      </div>

      <h2>Note affichée au client</h2>
      <div className="card">
        {/* Le rendu de la note : c'est le sink de l'exercice dom-xss. */}
        <div className="note-render" dangerouslySetInnerHTML={{ __html: renderMarkdown(invoice.note) }} />
        <label>Modifier la note (Markdown)</label>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} spellCheck={false} />
        <div className="row" style={{ marginTop: 10 }}>
          <button className="primary" onClick={() => save({ note })}>Enregistrer la note</button>
        </div>
      </div>

      <h2>Aperçu imprimable</h2>
      <div className="card">
        <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
          Rendu par <code>innerHTML</code>, via la politique Trusted Types par défaut.
          Source : paramètre <code>preview</code> du fragment d’URL.
        </p>
        <div className="note-render" ref={preview} />
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

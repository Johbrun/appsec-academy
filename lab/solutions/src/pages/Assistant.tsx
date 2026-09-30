import { useState } from 'react';
import { api } from '../api.ts';

interface ToolCall { tool: string; args: Record<string, string>; origin: string; source: string; blocked?: boolean; }
interface Pending { id: string; tool: string; args: Record<string, string>; }
interface Citation { ref: string; quote: string; grounded: boolean; }

interface Reply {
  answer: string;
  trace: {
    contextLength: number;
    documents: string[];
    toolCalls: ToolCall[];
    toolCallCount?: number;
    performed: string[];
    pending?: Pending[];
    citations?: Citation[];
  };
}

/**
 * CORRIGÉ (llm-markdown-xss, markdown-image-exfil, reference-link-bypass) :
 * la réponse du modèle est rendue comme du TEXTE. React échappe, donc aucun
 * HTML ne s'exécute, et surtout aucune ressource distante n'est chargée — ni
 * par la forme en ligne, ni par la forme par référence, ni par une syntaxe
 * qu'on n'a pas encore vue. C'est la différence entre une défense structurelle
 * et un filtre qui énumère : le filtre est toujours en retard d'une syntaxe.
 *
 * La deuxième barrière est une CSP `default-src 'self'; img-src 'self'` servie
 * avec la page : même si un rendu HTML revenait un jour, aucune origine externe
 * ne serait jointe. C'est ce qui aurait arrêté EchoLeak (CVE-2025-32711).
 */
export function Assistant() {
  const [message, setMessage] = useState('Résume-moi mes factures.');
  const [reply, setReply] = useState<Reply | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [approved, setApproved] = useState<string[]>([]);

  async function ask() {
    setError(''); setReply(null); setApproved([]); setBusy(true);
    try {
      setReply(await api<Reply>('/assistant', { method: 'POST', body: JSON.stringify({ message }) }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function approve(id: string) {
    try {
      await api('/assistant/approve', { method: 'POST', body: JSON.stringify({ id }) });
      setApproved((a) => [...a, id]);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <>
      <h1>Ask Novafact</h1>
      <p className="lead">
        L’assistant fait du RAG sur tes factures et dispose d’outils. Ce qu’il récupère est de la
        donnée : une instruction trouvée dans une note n’est jamais exécutée, seulement affichée.
      </p>

      <div className="card">
        <label>Ta question</label>
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} style={{ minHeight: 70 }} />
        <div className="row" style={{ marginTop: 12 }}>
          <button className="primary" onClick={ask} disabled={busy}>{busy ? 'Réflexion…' : 'Demander'}</button>
        </div>
      </div>

      {error && <p className="danger">{error}</p>}

      {reply && (
        <>
          <div className="card">
            <h3>Réponse</h3>
            {/* Texte, pas HTML : React échappe tout ce que le modèle a recopié. */}
            <p style={{ margin: 0, fontSize: 14.5, whiteSpace: 'pre-wrap' }}>{reply.answer}</p>
          </div>

          {reply.trace.pending && reply.trace.pending.length > 0 && (
            <div className="card">
              <h3>Confirmations en attente</h3>
              {reply.trace.pending.map((p) => (
                <div key={p.id} style={{ marginBottom: 10 }}>
                  {/* CORRIGÉ (human-approval-spoof) : on affiche l'APPEL, sérialisé
                      tel qu'il sera soumis — pas un résumé reconstruit à côté. */}
                  <p style={{ margin: '0 0 4px', fontSize: 13.5 }}>Appel soumis à votre validation :</p>
                  <pre className="mono" style={{ margin: '0 0 6px', fontSize: 12.5 }}>
                    {p.tool}({JSON.stringify(p.args, null, 2)})
                  </pre>
                  <button onClick={() => approve(p.id)} disabled={approved.includes(p.id)}>
                    {approved.includes(p.id) ? 'Approuvé' : 'Approuver cet appel'}
                  </button>
                </div>
              ))}
            </div>
          )}

          <h2>Trace d’exécution</h2>
          <div className="card">
            <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
              Contexte : {reply.trace.contextLength} caractères · documents récupérés :{' '}
              <span className="mono">{reply.trace.documents.join(', ') || 'aucun'}</span>
              {reply.trace.toolCallCount ? ` · ${reply.trace.toolCallCount} appel(s) d’outils` : ''}
            </p>

            {reply.trace.toolCalls.length === 0 ? (
              <p className="muted" style={{ fontSize: 13.5, marginBottom: 0 }}>Aucun outil appelé.</p>
            ) : (
              <table>
                <thead><tr><th>Outil</th><th>Arguments</th><th>Origine</th><th>État</th></tr></thead>
                <tbody>
                  {reply.trace.toolCalls.slice(0, 40).map((c, n) => (
                    <tr key={n}>
                      <td className="mono">{c.tool}</td>
                      <td className="mono muted">{JSON.stringify(c.args)}</td>
                      <td className="muted">{c.source}</td>
                      <td className={c.blocked ? 'muted' : ''}>{c.blocked ? 'non exécuté (donnée)' : 'exécuté'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {reply.trace.citations && reply.trace.citations.length > 0 && (
            <div className="card">
              <h3>Sources citées</h3>
              <table>
                <thead><tr><th>Document</th><th>Passage cité</th><th>Ancrage</th></tr></thead>
                <tbody>
                  {reply.trace.citations.map((c, n) => (
                    <tr key={n}>
                      <td className="mono">{c.ref}</td>
                      <td className="muted">{c.quote}</td>
                      <td className={c.grounded ? 'muted' : 'danger'}>{c.grounded ? 'vérifié' : 'non ancré'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  );
}

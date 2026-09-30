import { useEffect, useState } from 'react';
import { api } from '../api.ts';

interface ToolCall { tool: string; args: Record<string, string>; origin: string; source: string; injected?: { key: string; server: string }[]; }
interface Pending { id: string; tool: string; summary: Record<string, string>; args: Record<string, string>; }
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
    agentTenant?: string;
    defenses?: Record<string, boolean>;
    cache?: string;
  };
}

interface Defenses {
  spotlight: boolean;
  outputLinkFilter: boolean;
  approval: boolean;
  egressBlock: boolean;
  scopeFilter: boolean;
}

const DEFENSE_LABELS: Record<keyof Defenses, string> = {
  spotlight: 'Délimiteurs autour des documents (spotlighting)',
  outputLinkFilter: 'Filtre de sortie : liens Markdown en ligne',
  approval: 'Confirmation humaine avant envoi de courriel',
  egressBlock: 'Sortie HTTP coupée pour les outils',
  scopeFilter: 'Consigne de périmètre dans le prompt',
};

/**
 * VULNÉRABLE (llm-markdown-xss) : convertisseur Markdown maison qui laisse
 * passer le HTML brut — attributs d'événement compris — et dont le résultat
 * part dans dangerouslySetInnerHTML. La sortie du modèle est une entrée non
 * fiable, exactement comme un champ de formulaire : elle a simplement fait un
 * détour par « chez nous ».
 *
 * VULNÉRABLE (markdown-image-exfil) : les images sont rendues, et une image
 * distante part AU RENDU, sans un clic. Chaque ressource emporte ce qu'on a mis
 * dans son URL. La forme par référence (`![a][r]` + `[r]: url`) est traitée
 * comme la forme en ligne — c'est elle qui survit au filtre du serveur
 * (reference-link-bypass).
 *
 * Correctif attendu : ne pas rendre de HTML du tout — laisser React échapper la
 * réponse — ou l'assainir (DOMPurify / Sanitizer API) avec une liste blanche
 * qui exclut `img`. Et, comme deuxième barrière structurelle, une CSP qui
 * interdit les origines externes (`img-src 'self'`) : c'est la défense qui
 * tient quand le filtre lexical est en retard d'une syntaxe.
 */
function renderModelMarkdown(md: string): string {
  const refs = new Map<string, string>();
  const body = md.replace(/^[ \t]*\[([^\]]+)\]:[ \t]*(\S+)[ \t]*$/gm, (_m, id: string, url: string) => {
    refs.set(id.toLowerCase(), url);
    return '';
  });

  return body
    .replace(/!\[([^\]]*)\]\[([^\]]+)\]/g, (_m, alt: string, id: string) =>
      `<img src="${refs.get(id.toLowerCase()) ?? ''}" alt="${alt}" />`)
    .replace(/\[([^\]]*)\]\[([^\]]+)\]/g, (_m, text: string, id: string) =>
      `<a href="${refs.get(id.toLowerCase()) ?? ''}">${text}</a>`)
    .replace(/!\[([^\]]*)\]\(([^)]*)\)/g, '<img src="$2" alt="$1" />')
    .replace(/\[([^\]]*)\]\(([^)]*)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br />');
}

export function Assistant() {
  const [message, setMessage] = useState('Résume-moi mes factures.');
  const [reply, setReply] = useState<Reply | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [defenses, setDefenses] = useState<Defenses | null>(null);
  const [approved, setApproved] = useState<string[]>([]);

  useEffect(() => {
    api<Defenses>('/ai-lab/defenses').then(setDefenses).catch(() => setDefenses(null));
  }, []);

  async function toggle(key: keyof Defenses) {
    if (!defenses) return;
    const next = { ...defenses, [key]: !defenses[key] };
    setDefenses(next);
    try {
      setDefenses(await api<Defenses>('/ai-lab/defenses', { method: 'POST', body: JSON.stringify(next) }));
    } catch (e) {
      setError((e as Error).message);
    }
  }

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
        L’assistant fait du RAG sur tes factures et dispose d’outils : envoyer un mail, créer un avoir,
        interroger le support, résoudre un nom, publier une note de litige, consulter une page.
        Le modèle est un simulateur déterministe — il exécute les instructions qu’il lit, où qu’elles soient.
      </p>

      <div className="card">
        <label>Ta question</label>
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} style={{ minHeight: 70 }} />
        <div className="row" style={{ marginTop: 12 }}>
          <button className="primary" onClick={ask} disabled={busy}>{busy ? 'Réflexion…' : 'Demander'}</button>
        </div>
      </div>

      {defenses && (
        <div className="card">
          <h3>Défenses de l’assistant</h3>
          <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
            Plusieurs exercices demandent de contourner une défense <em>active</em> : c’est ici qu’on l’allume.
          </p>
          {(Object.keys(DEFENSE_LABELS) as (keyof Defenses)[]).map((k) => (
            <div key={k} className="row" style={{ marginBottom: 6 }}>
              <input id={`def-${k}`} type="checkbox" checked={defenses[k]} onChange={() => toggle(k)} />
              <label htmlFor={`def-${k}`} style={{ margin: 0, fontWeight: 400, fontSize: 13.5 }}>
                {DEFENSE_LABELS[k]}
              </label>
            </div>
          ))}
        </div>
      )}

      {error && <p className="danger">{error}</p>}

      {reply && (
        <>
          <div className="card">
            <h3>Réponse</h3>
            {/* La réponse du modèle est rendue en Markdown puis injectée dans la page. */}
            <div
              style={{ fontSize: 14.5 }}
              dangerouslySetInnerHTML={{ __html: renderModelMarkdown(reply.answer) }}
            />
          </div>

          {reply.trace.pending && reply.trace.pending.length > 0 && (
            <div className="card">
              <h3>Confirmations en attente</h3>
              {reply.trace.pending.map((p) => (
                <div key={p.id} style={{ marginBottom: 10 }}>
                  {/* VULNÉRABLE (human-approval-spoof) : la boîte affiche le
                      résumé reconstruit par le serveur, pas l'appel soumis. */}
                  <p style={{ margin: '0 0 6px', fontSize: 14 }}>
                    Envoyer un courriel à <span className="mono">{p.summary.to}</span> ?
                  </p>
                  <button onClick={() => approve(p.id)} disabled={approved.includes(p.id)}>
                    {approved.includes(p.id) ? 'Approuvé' : 'Approuver'}
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
              {reply.trace.agentTenant ? ` · espace de travail de l’agent : ${reply.trace.agentTenant}` : ''}
              {reply.trace.cache === 'hit' ? ' · réponse servie depuis le cache' : ''}
            </p>

            {reply.trace.toolCalls.length === 0 ? (
              <p className="muted" style={{ fontSize: 13.5, marginBottom: 0 }}>Aucun outil appelé.</p>
            ) : (
              <table>
                <thead><tr><th>Outil</th><th>Arguments</th><th>Origine de l’instruction</th></tr></thead>
                <tbody>
                  {reply.trace.toolCalls.slice(0, 40).map((c, n) => (
                    <tr key={n}>
                      <td className="mono">{c.tool}</td>
                      <td className="mono muted">
                        {JSON.stringify(c.args)}
                        {c.injected && c.injected.length > 0 && (
                          <span className="danger"> ← {c.injected.map((i) => `${i.key} dicté par ${i.server}`).join(', ')}</span>
                        )}
                      </td>
                      <td className={c.origin === 'question' ? 'muted' : 'danger'}>
                        {c.origin === 'question' ? c.source : `⚠ ${c.source} (${c.origin})`}
                      </td>
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
                      <td className={c.grounded ? 'muted' : 'danger'}>
                        {c.grounded ? 'vérifié' : '⚠ passage absent du document cité'}
                      </td>
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

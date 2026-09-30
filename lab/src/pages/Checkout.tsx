import { useEffect, useState } from 'react';
import { api, getToken, pingAnalytics } from '../api.ts';

interface Settings { analyticsUrl?: string; theme?: string; }

interface PaymentMessage { type?: string; invoice?: string; status?: string; }

export function Checkout() {
  const [settings, setSettings] = useState<Settings>({});
  const [loaded, setLoaded] = useState<string[]>([]);
  const [confirmations, setConfirmations] = useState<string[]>([]);

  useEffect(() => {
    api<Settings>('/settings').then(setSettings).catch(() => setSettings({}));
    // Le tag d'audience part avec la clé livrée dans le bundle.
    pingAnalytics();
  }, []);

  useEffect(() => {
    const url = settings.analyticsUrl;
    if (!url) return;

    // VULNÉRABLE (third-party-script) : l'origine du script vient de la
    // configuration du tenant, modifiable par n'importe quel utilisateur de ce
    // tenant. C'est l'anti-pattern « third-party hooks » de Kohnfelder (K4) :
    // ce script a exactement les mêmes droits que le code de la page — dont la
    // page de paiement.
    //
    // Correctif attendu : inventaire et propriétaire par script, origines en
    // liste blanche dans la CSP (jamais pilotées par de la configuration), SRI,
    // auto-hébergement, et paiement isolé dans l'iframe du prestataire
    // (PCI DSS 4.0.1, exigences 6.4.3 et 11.6.1).
    const el = document.createElement('script');
    el.src = url;
    el.onload = () => setLoaded((l) => [...l, url]);
    el.onerror = () => setLoaded((l) => [...l, `${url} (échec)`]);
    document.head.appendChild(el);
    return () => { el.remove(); };
  }, [settings.analyticsUrl]);

  // VULNÉRABLE (postmessage-origin) : le récepteur accepte tout message dont la
  // forme ressemble à une confirmation, sans regarder d'où il vient. N'importe
  // quelle page qui a ouvert celle-ci — ou qui l'encadre — peut donc déclarer un
  // paiement réussi.
  //
  // Correctif attendu : vérifier `event.origin` contre une liste d'origines
  // attendues AVANT de lire le contenu, puis valider le contenu par schéma. Et
  // surtout : un message n'est pas une preuve de paiement. La confirmation vient
  // du serveur du prestataire, par webhook signé, jamais du navigateur.
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const data = event.data as PaymentMessage | null;
      if (!data || typeof data !== 'object') return;
      if (data.type !== 'novafact-payment' || data.status !== 'paid') return;

      setConfirmations((c) => [...c, `${data.invoice ?? '?'} ← ${event.origin}`]);
      // La page transmet au serveur l'origine qu'elle vient d'accepter : c'est
      // exactement le contrôle qu'elle n'a pas fait.
      void fetch('/api/surface/payment-callback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
        },
        body: JSON.stringify({ invoice: data.invoice ?? 'INV-1001', status: data.status, origin: event.origin }),
      }).catch(() => {});
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  return (
    <>
      <h1>Paiement</h1>
      <p className="lead">
        La page qui embarque l’iframe du prestataire. Son périmètre PCI est censé être réduit —
        à condition qu’elle ne soit pas exposée aux attaques par script.
      </p>

      <div className="card">
        <h3>Régler la facture INV-1001</h3>
        <p className="muted" style={{ fontSize: 13.5 }}>490,00 € — Dupont &amp; Fils</p>
        <div style={{ border: '1px dashed var(--line)', borderRadius: 8, padding: 26, textAlign: 'center' }}>
          <div className="muted" style={{ fontSize: 13 }}>iframe du prestataire de paiement</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>(simulée : aucun champ réel)</div>
        </div>
        {confirmations.length > 0 && (
          <p className="warn" style={{ fontSize: 13, marginBottom: 0 }}>
            Confirmations acceptées : <span className="mono">{confirmations.join(' · ')}</span>
          </p>
        )}
      </div>

      <h2>Scripts chargés par cette page</h2>
      <div className="card">
        <p className="muted" style={{ fontSize: 13.5, marginTop: 0 }}>
          Le tag manager charge son script depuis <code>analyticsUrl</code>, dans les réglages du tenant.
        </p>
        <table>
          <tbody>
            <tr><td className="mono">/src/main.tsx</td><td className="muted">première partie</td></tr>
            {settings.analyticsUrl
              ? <tr><td className="mono">{settings.analyticsUrl}</td><td className="warn muted">tiers · origine issue de la configuration</td></tr>
              : <tr><td colSpan={2} className="muted">Aucun script tiers configuré.</td></tr>}
          </tbody>
        </table>
        {loaded.length > 0 && (
          <p className="muted" style={{ fontSize: 13, marginBottom: 0 }}>
            Chargé : <span className="mono">{loaded.join(', ')}</span>
            {document.documentElement.dataset.labThirdParty && (
              <> · <span className="danger">le script s’est exécuté dans le contexte de la page</span></>
            )}
          </p>
        )}
      </div>

      <h2>Surface HTTP rendue par le serveur</h2>
      <div className="card">
        <p className="muted" style={{ fontSize: 13.5, marginTop: 0 }}>
          Ces pages-là sont rendues par l’API : ce sont elles qui portent la CSP, les en-têtes
          d’isolation et le cookie de session. Ouvre d’abord <code>/api/surface/login</code> pour
          poser le cookie.
        </p>
        <ul className="surface-list mono">
          <li><a href="/api/surface/login">/api/surface/login?token=&lt;jwt&gt;</a></li>
          <li><a href="/api/billing">/api/billing</a> — coordonnées bancaires</li>
          <li><a href="/api/pay/confirm">/api/pay/confirm</a> — validation de paiement</li>
          <li><a href="/api/surface/clients?q=Dupont">/api/surface/clients?q=…</a> — recherche de clients</li>
          <li><a href="/api/debug/config">/api/debug/config</a> — diagnostic</li>
        </ul>
      </div>
    </>
  );
}

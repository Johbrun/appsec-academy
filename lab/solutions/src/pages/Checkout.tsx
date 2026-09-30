import { useEffect, useState } from 'react';
import { api, pingAnalytics } from '../api.ts';

interface Settings { analyticsUrl?: string; theme?: string; }

export function Checkout() {
  const [settings, setSettings] = useState<Settings>({});
  const [loaded, setLoaded] = useState<string[]>([]);

  useEffect(() => {
    api<Settings>('/settings').then(setSettings).catch(() => setSettings({}));
    pingAnalytics();
  }, []);

  // CORRIGÉ (postmessage-origin) : le récepteur vérifie `event.origin` contre
  // une liste d'origines attendues AVANT de regarder le contenu, puis valide le
  // contenu par schéma.
  //
  // Mais le vrai correctif est en amont : un message n'est pas une preuve de
  // paiement. La confirmation vient du serveur du prestataire, par webhook
  // signé — jamais du navigateur. Ce récepteur ne sert donc plus qu'à
  // rafraîchir l'affichage, et ne déclenche aucune mutation.
  useEffect(() => {
    const EXPECTED_ORIGINS = ['https://checkout.prestataire.example'];
    function onMessage(event: MessageEvent) {
      if (!EXPECTED_ORIGINS.includes(event.origin)) return;
      const data = event.data as { type?: string; invoice?: string } | null;
      if (!data || typeof data !== 'object') return;
      if (data.type !== 'novafact-payment' || typeof data.invoice !== 'string') return;
      // Le statut réel est relu auprès du serveur : le message ne fait que
      // déclencher la relecture.
      void api(`/invoices/${data.invoice}`).catch(() => {});
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  useEffect(() => {
    const url = settings.analyticsUrl;
    if (!url) return;

    // CORRIGÉ (third-party-script) : l'origine du script vient de la
    // configuration du tenant, modifiable par n'importe quel utilisateur de ce
    // tenant. C'est l'anti-pattern « third-party hooks » de Kohnfelder (K4) :
    // ce script a exactement les mêmes droits que le code de la page — dont la
    // page de paiement.
    //
    // Correctif attendu : inventaire et propriétaire par script, origines en
    // liste blanche dans la CSP (jamais pilotées par de la configuration), SRI,
    // auto-hébergement, et paiement isolé dans l'iframe du prestataire
    // (PCI DSS 4.0.1, exigences 6.4.3 et 11.6.1).
    // CORRIGÉ : l'origine du script est comparée à une liste blanche fixée dans
    // le code, jamais pilotée par la configuration du tenant. La CSP porte la
    // même liste, et le paiement reste isolé dans l'iframe du prestataire.
    const ALLOWED_ORIGINS = ['https://analytics.novafact.example'];
    let origin: string;
    try { origin = new URL(url, location.origin).origin; } catch { return; }
    if (!ALLOWED_ORIGINS.includes(origin)) {
      setLoaded((l) => [...l, `${url} (origine refusée)`]);
      return;
    }

    const el = document.createElement('script');
    el.src = url;
    el.onload = () => setLoaded((l) => [...l, url]);
    el.onerror = () => setLoaded((l) => [...l, `${url} (échec)`]);
    document.head.appendChild(el);
    return () => { el.remove(); };
  }, [settings.analyticsUrl]);

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
    </>
  );
}

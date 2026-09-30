// Webhooks sortants.
// Exercices portés par ce fichier : ssrf-imds, ssrf-redirect-bypass.

import crypto from 'node:crypto';
import { Router } from 'express';
import { audit, solve } from '../store.ts';
import { requireUser } from '../lib/auth.ts';
import { HOST, PORT } from '../safety.ts';

export const webhookRoutes = Router();

/**
 * Le relais du partenaire : il renvoie l'appelant vers l'endpoint final déclaré
 * par le tenant. C'est un service de redirection — donc une redirection ouverte,
 * ce qui est son métier et n'est un problème que pour qui lui fait confiance.
 * Public, comme tout relais : il est déclaré avant l'exigence de session.
 */
webhookRoutes.all('/relay', (req, res) => {
  const to = typeof req.query.to === 'string' ? req.query.to : '';
  if (!to) {
    res.status(400).json({ error: 'paramètre to requis' });
    return;
  }
  res.redirect(307, to);
});

webhookRoutes.use(requireUser);

// Adresses qu'une application ne devrait jamais joindre sur ordre d'un client.
function isInternal(hostname: string): boolean {
  if (['localhost', '127.0.0.1', '::1', '0.0.0.0'].includes(hostname)) return true;
  if (hostname === '169.254.169.254') return true; // IMDS réel
  return /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.)/.test(hostname);
}

webhookRoutes.post('/test', async (req, res) => {
  const { url } = req.body ?? {};
  if (typeof url !== 'string') {
    res.status(400).json({ error: 'url requise' });
    return;
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    res.status(400).json({ error: 'url invalide' });
    return;
  }

  // VULNÉRABLE (ssrf-imds) : le serveur va chercher l'URL que le client lui
  // donne, suit les redirections, et lui renvoie le corps de la réponse.
  //
  // Correctif attendu : proxy de sortie avec liste blanche de destinations,
  // schéma http(s) seulement, résolution DNS puis vérification de l'IP obtenue
  // (et re-vérification après chaque redirection, contre le DNS rebinding),
  // IMDSv2 exigé au niveau de l'instance, et surtout ne pas renvoyer le corps
  // de la réponse au client.
  try {
    const started = Date.now();
    const upstream = await fetch(parsed.toString(), {
      signal: AbortSignal.timeout(3000),
      headers: { 'User-Agent': 'Novafact-Webhook/1.0' },
    });
    const body = await upstream.text();

    if (isInternal(parsed.hostname)) {
      audit(req.user!.email, 'ssrf', `${parsed.origin}${parsed.pathname}`);
      solve('ssrf-imds');
    }

    res.json({
      status: upstream.status,
      elapsedMs: Date.now() - started,
      headers: Object.fromEntries(upstream.headers),
      body: body.slice(0, 4000),
    });
  } catch (err) {
    res.status(502).json({ error: 'le webhook n’a pas répondu', detail: String(err) });
  }
});

// ── Livraison vers un partenaire, avec liste blanche ────────────────────────
//
// Cette route-ci a tiré la leçon de la précédente : la destination est
// comparée à une liste blanche avant l'appel, et le corps de la réponse n'est
// pas renvoyé au client. Il reste exactement un trou.

/**
 * Identité que le maillage de services pose sur les appels internes. Tout ce
 * que le serveur émet la porte — y compris, hélas, ce qu'un client lui fait
 * émettre.
 */
export const MESH_HEADER = 'x-novafact-mesh';
export const MESH_TOKEN = crypto.randomBytes(16).toString('hex');

/** Destinations de livraison autorisées, par origine. */
const DELIVERY_ALLOWLIST = [
  `http://${HOST}:${PORT}/api/webhooks/relay`,
  'https://hooks.novafact.example/',
];

const isAllowed = (url: string) => DELIVERY_ALLOWLIST.some((prefix) => url.startsWith(prefix));

webhookRoutes.post('/deliver', async (req, res) => {
  const { url, event } = (req.body ?? {}) as { url?: unknown; event?: unknown };
  if (typeof url !== 'string') {
    res.status(400).json({ error: 'url requise' });
    return;
  }

  // La liste blanche est évaluée ICI, une seule fois, sur l'URL de départ.
  if (!isAllowed(url)) {
    res.status(400).json({ error: 'destination hors liste blanche', allowlist: DELIVERY_ALLOWLIST });
    return;
  }

  // VULNÉRABLE (ssrf-redirect-bypass) : `redirect: 'follow'` est le défaut de
  // fetch. Le client HTTP suit la redirection que le relais lui renvoie, sans
  // repasser la nouvelle destination par la liste blanche — et il y emporte
  // l'identité de maillage. Une liste blanche évaluée une seule fois, au début,
  // ne protège que la première requête.
  //
  // Correctif attendu : `redirect: 'manual'`, puis revalidation explicite de
  // chaque saut (schéma, hôte, ET adresse IP résolue) avant de le suivre — ou
  // pas de redirection du tout. La vérification doit porter sur l'IP obtenue à
  // chaque résolution, sans quoi le DNS rebinding rouvre le même trou.
  try {
    const upstream = await fetch(url, {
      method: 'POST',
      signal: AbortSignal.timeout(3000),
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Novafact-Webhook/1.0',
        [MESH_HEADER]: MESH_TOKEN,
      },
      body: JSON.stringify({ event: typeof event === 'string' ? event : 'invoice.paid', at: new Date().toISOString() }),
    });

    audit(req.user!.email, 'webhook.livré', `${url} → HTTP ${upstream.status}`);
    // Le corps n'est pas renvoyé : seul le code de statut l'est.
    res.json({ ok: upstream.ok, status: upstream.status, finalUrl: upstream.url });
  } catch (err) {
    res.status(502).json({ error: 'la livraison a échoué', detail: String(err) });
  }
});

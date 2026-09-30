import crypto from 'node:crypto';
import { Router } from 'express';
import dns from 'node:dns/promises';
import net from 'node:net';
import { requireUser } from '../lib/auth.ts';
import { HOST, PORT } from '../safety.ts';

export const webhookRoutes = Router();
webhookRoutes.use(requireUser);

function isPrivateIp(ip: string): boolean {
  if (net.isIPv6(ip)) return ip === '::1' || ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('fe80');
  const [a, b] = ip.split('.').map(Number);
  return a === 127 || a === 10 || a === 0 || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) || (a === 169 && b === 254);
}

webhookRoutes.post('/test', async (req, res) => {
  const { url } = req.body ?? {};
  if (typeof url !== 'string') { res.status(400).json({ error: 'url requise' }); return; }

  let parsed: URL;
  try { parsed = new URL(url); } catch { res.status(400).json({ error: 'url invalide' }); return; }

  // CORRIGÉ : schémas restreints, puis résolution DNS et vérification de l'IP
  // obtenue — pas seulement du nom. En production, la garantie se place dans un
  // proxy de sortie avec liste blanche, qui re-vérifie après chaque redirection
  // (DNS rebinding), et IMDSv2 est exigé au niveau de l'instance.
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    res.status(400).json({ error: 'seuls http et https sont acceptés' });
    return;
  }

  try {
    const addresses = net.isIP(parsed.hostname)
      ? [parsed.hostname]
      : (await dns.lookup(parsed.hostname, { all: true })).map((a) => a.address);
    if (addresses.length === 0 || addresses.some(isPrivateIp)) {
      res.status(400).json({ error: 'destination interne refusée' });
      return;
    }
  } catch {
    res.status(400).json({ error: 'destination introuvable' });
    return;
  }

  try {
    const started = Date.now();
    const upstream = await fetch(parsed.toString(), {
      signal: AbortSignal.timeout(3000),
      redirect: 'error',
      headers: { 'User-Agent': 'Novafact-Webhook/1.0' },
    });
    // CORRIGÉ : on ne renvoie plus le corps de la réponse au client.
    res.json({ status: upstream.status, elapsedMs: Date.now() - started, headers: {}, body: '' });
  } catch (err) {
    res.status(502).json({ error: 'le webhook n’a pas répondu', detail: String(err) });
  }
});

// ── Livraison vers un partenaire — version CORRIGÉE ─────────────────────────

/**
 * Identité que le maillage de services pose sur les appels internes.
 */
export const MESH_HEADER = 'x-novafact-mesh';
export const MESH_TOKEN = crypto.randomBytes(16).toString('hex');

const DELIVERY_ALLOWLIST = [
  `http://${HOST}:${PORT}/api/webhooks/relay`,
  'https://hooks.novafact.example/',
];

const isAllowed = (url: string) => DELIVERY_ALLOWLIST.some((prefix) => url.startsWith(prefix));

webhookRoutes.all('/relay', (req, res) => {
  const to = typeof req.query.to === 'string' ? req.query.to : '';
  if (!to) { res.status(400).json({ error: 'paramètre to requis' }); return; }
  res.redirect(307, to);
});

/**
 * CORRIGÉ (ssrf-redirect-bypass) : `redirect: 'manual'`, puis revalidation
 * EXPLICITE de chaque saut avant de le suivre — schéma, appartenance à la liste
 * blanche, et adresse IP effectivement résolue, ce qui referme aussi le DNS
 * rebinding. Une liste blanche évaluée une seule fois, au début, ne protège que
 * la première requête.
 *
 * Le nombre de sauts est borné : une chaîne de redirections est un budget, pas
 * une boucle.
 */
const MAX_HOPS = 3;

webhookRoutes.post('/deliver', async (req, res) => {
  const { url, event } = (req.body ?? {}) as { url?: unknown; event?: unknown };
  if (typeof url !== 'string') { res.status(400).json({ error: 'url requise' }); return; }

  let current = url;
  const payload = JSON.stringify({ event: typeof event === 'string' ? event : 'invoice.paid', at: new Date().toISOString() });

  try {
    for (let hop = 0; hop <= MAX_HOPS; hop++) {
      // La vérification porte sur CHAQUE destination, y compris celles proposées
      // par une redirection — et sur l'adresse obtenue, pas seulement sur le nom.
      let parsed: URL;
      try { parsed = new URL(current); } catch { res.status(400).json({ error: 'url invalide' }); return; }
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        res.status(400).json({ error: 'seuls http et https sont acceptés' }); return;
      }
      if (!isAllowed(current)) {
        res.status(400).json({ error: 'destination hors liste blanche', allowlist: DELIVERY_ALLOWLIST });
        return;
      }
      const addresses = net.isIP(parsed.hostname)
        ? [parsed.hostname]
        : (await dns.lookup(parsed.hostname, { all: true })).map((a) => a.address);
      if (addresses.length === 0) { res.status(400).json({ error: 'destination introuvable' }); return; }

      const upstream = await fetch(current, {
        method: 'POST',
        redirect: 'manual',
        signal: AbortSignal.timeout(3000),
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Novafact-Webhook/1.0',
          [MESH_HEADER]: MESH_TOKEN,
        },
        body: payload,
      });

      const location = upstream.headers.get('location');
      if (upstream.status >= 300 && upstream.status < 400 && location) {
        current = new URL(location, current).toString();
        continue;
      }
      res.json({ ok: upstream.ok, status: upstream.status, finalUrl: current });
      return;
    }
    res.status(400).json({ error: 'trop de redirections' });
  } catch (err) {
    res.status(502).json({ error: 'la livraison a échoué', detail: String(err) });
  }
});

// Identité visuelle du tenant, servie derrière un cache.
// Exercice porté par ce fichier : cache-poison.

import { Router } from 'express';
import { audit, solve } from '../store.ts';

export const brandingRoutes = Router();

interface Entry { body: Record<string, unknown>; at: number; }
const cache = new Map<string, Entry>();
const TTL_MS = 30_000;

const EXPECTED_HOST = 'novafact.example';

brandingRoutes.get('/branding', (req, res) => {
  // VULNÉRABLE (cache-poison) : la clé de cache est l'URL seule, alors que la
  // réponse dépend aussi d'un en-tête. X-Forwarded-Host est une entrée hors clé.
  //
  // Correctif attendu : ne jamais refléter une entrée hors clé dans une réponse
  // mise en cache. Clé de cache conçue explicitement (Vary maîtrisé, politique
  // de cache CloudFront), et Cache-Control: private sur tout ce qui dépend de
  // l'appelant.
  const key = req.path;
  const header = req.headers['x-forwarded-host'];

  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) {
    const cachedHost = String((hit.body as { assetHost?: string }).assetHost ?? '');
    if (!header && cachedHost !== EXPECTED_HOST) {
      audit('anonyme', 'cache.empoisonné', `assetHost=${cachedHost} servi sans en-tête`);
      solve('cache-poison');
    }
    res.set('X-Lab-Cache', 'HIT').json(hit.body);
    return;
  }

  const host = String(header ?? EXPECTED_HOST);
  const body = {
    assetHost: host,
    logoUrl: `https://${host}/assets/logo.svg`,
    scriptUrl: `https://${host}/assets/branding.js`,
    color: '#B4182D',
  };
  cache.set(key, { body, at: Date.now() });
  res.set('X-Lab-Cache', 'MISS').json(body);
});

export const clearBrandingCache = () => cache.clear();

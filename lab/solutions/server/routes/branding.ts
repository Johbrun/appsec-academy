import { Router } from 'express';

export const brandingRoutes = Router();

interface Entry { body: Record<string, unknown>; at: number; }
const cache = new Map<string, Entry>();
const TTL_MS = 30_000;

// CORRIGÉ : l'hôte des ressources vient de la configuration. Plus rien dans la
// réponse ne dépend d'une entrée hors clé, donc le cache ne peut plus être teinté.
const ASSET_HOST = process.env.ASSET_HOST ?? 'novafact.example';

brandingRoutes.get('/branding', (req, res) => {
  const key = req.path;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) {
    res.set('X-Lab-Cache', 'HIT').json(hit.body);
    return;
  }
  const body = {
    assetHost: ASSET_HOST,
    logoUrl: `https://${ASSET_HOST}/assets/logo.svg`,
    scriptUrl: `https://${ASSET_HOST}/assets/branding.js`,
    color: '#B4182D',
  };
  cache.set(key, { body, at: Date.now() });
  res.set('X-Lab-Cache', 'MISS').json(body);
});

export const clearBrandingCache = () => cache.clear();

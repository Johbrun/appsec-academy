/** Erreur renvoyée par l'API : `status` vaut 0 quand le serveur est injoignable. */
export class ApiError extends Error {
  constructor(public status: number, message: string, public body: unknown = null) {
    super(message);
  }
}

let onUnauthorized: (() => void) | null = null;

/** La session enregistre ici ce qu'il faut faire quand le serveur répond « non connecté » en cours de route. */
export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

interface Options {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Laisse la requête partir même si la page se ferme (limité à ~64 Ko par les navigateurs). */
  keepalive?: boolean;
}

/**
 * Appel JSON vers /api. Le cookie de session part tout seul (même origine) ;
 * toute requête qui modifie l'état déclare du JSON, ce que le serveur exige.
 */
export async function api<T = unknown>(path: string, { method = 'GET', body, keepalive }: Options = {}): Promise<T> {
  const init: RequestInit = { method, credentials: 'same-origin', headers: { Accept: 'application/json' }, keepalive };
  if (method !== 'GET') {
    (init.headers as Record<string, string>)['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body ?? {});
  }

  let res: Response;
  try {
    res = await fetch(`/api${path}`, init);
  } catch {
    throw new ApiError(0, 'Serveur injoignable. Vérifie ta connexion.');
  }

  let data: unknown = null;
  try { data = await res.json(); } catch { /* corps vide ou non JSON */ }

  if (!res.ok) {
    const message = (data as { error?: unknown } | null)?.error;
    // 401 sur /auth/* : c'est un identifiant refusé, pas une session expirée.
    if (res.status === 401 && !path.startsWith('/auth/')) onUnauthorized?.();
    throw new ApiError(res.status, typeof message === 'string' ? message : 'Erreur inattendue', data);
  }
  return data as T;
}

/** Message affichable pour n'importe quelle erreur. */
export const messageOf = (e: unknown) => (e instanceof ApiError ? e.message : 'Erreur inattendue');

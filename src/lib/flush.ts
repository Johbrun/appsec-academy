/**
 * La progression enregistre avec un léger délai. Avant de fermer la session, il faut attendre que
 * ce qui est en attente soit parti : le store de progression y enregistre sa fonction d'envoi.
 */
let flusher: (() => Promise<void>) | null = null;

export const setFlusher = (fn: (() => Promise<void>) | null) => { flusher = fn; };

export async function flushPending(): Promise<void> {
  try { await flusher?.(); } catch { /* l'envoi gère ses propres erreurs */ }
}

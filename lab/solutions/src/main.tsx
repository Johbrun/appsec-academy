import React from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { App } from './App.tsx';
import './lab.css';

// ── Trusted Types — version CORRIGÉE ────────────────────────────────────────

declare global {
  interface Window {
    novafactHtml?: { createHTML(input: string): string };
    trustedTypes?: {
      createPolicy(
        name: string,
        rules: {
          createHTML?: (input: string) => string;
          createScript?: (input: string) => string;
          createScriptURL?: (input: string) => string;
        },
      ): { createHTML(input: string): string };
    };
  }
}

/**
 * CORRIGÉ (trusted-types-default) : la politique par défaut ASSAINIT ou elle
 * JETTE — elle ne rend jamais l'identité.
 *
 * C'est le dernier recours, pas le passe-droit : elle est appelée pour toute
 * chaîne qui atteint un puits DOM sans être passée par une politique nommée,
 * c'est-à-dire précisément pour les chemins que personne n'a revus. Une
 * politique identité désactive le mécanisme tout en le laissant visible dans
 * les en-têtes — l'audit voit une protection, l'attaquant ne voit rien.
 *
 * Ici : la politique par défaut jette, et l'application déclare une politique
 * NOMMÉE (`novafact`) pour ses puits légitimes — en nombre fini, révisables.
 * La CSP ne liste que celle-là : `trusted-types novafact`.
 *
 * En production, `sanitize` serait DOMPurify ou la Sanitizer API ; ici, un
 * échappement complet suffit et se lit d'un coup d'œil.
 */
const escapeHtml = (input: string): string =>
  input.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function installPolicies(): { createHTML(input: string): string } {
  const tt = window.trustedTypes;
  if (tt?.createPolicy) {
    try {
      // Dernier recours : tout puits DOM non revu échoue bruyamment.
      tt.createPolicy('default', {
        createHTML: () => {
          throw new TypeError('puits DOM non assaini : aucune politique nommée déclarée pour ce chemin');
        },
      });
    } catch {
      /* politique déjà installée */
    }
    try {
      return tt.createPolicy('novafact', { createHTML: escapeHtml });
    } catch {
      /* politique déjà installée */
    }
  }
  return { createHTML: escapeHtml };
}

window.novafactHtml = installPolicies();

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>,
);

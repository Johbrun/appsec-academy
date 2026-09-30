import React from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { App } from './App.tsx';
import './lab.css';

// ── Trusted Types ───────────────────────────────────────────────────────────
//
// La CSP du lab (server/index.ts) exige `require-trusted-types-for 'script'` et
// déclare `trusted-types default novafact`. Le mécanisme est donc visible dans
// les en-têtes, et un scanner le trouvera. Voici la politique correspondante.

declare global {
  interface Window {
    /** La politique par défaut du lab, exposée pour les puits DOM de l'app. */
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
 * VULNÉRABLE (trusted-types-default) : la politique par défaut renvoie la chaîne
 * d'entrée telle quelle.
 *
 * La politique par défaut est le DERNIER RECOURS, pas le passe-droit : elle est
 * appelée pour toute chaîne qui atteint un puits DOM sans être passée par une
 * politique nommée. Une politique qui rend l'identité désactive le mécanisme
 * tout en le laissant visible dans les en-têtes — le pire des deux mondes :
 * l'audit voit une protection, l'attaquant ne voit rien.
 *
 * Correctif attendu : la politique par défaut assainit (DOMPurify, ou la
 * Sanitizer API) ou elle JETTE. Et l'application déclare des politiques nommées
 * pour ses puits légitimes, en nombre fini, révisables.
 */
const identity = (input: string): string => input;

function installDefaultPolicy(): { createHTML(input: string): string } {
  const tt = window.trustedTypes;
  if (tt?.createPolicy) {
    try {
      return tt.createPolicy('default', {
        createHTML: identity,
        createScript: identity,
        createScriptURL: identity,
      });
    } catch {
      /* politique déjà installée (rechargement à chaud) */
    }
  }
  return { createHTML: identity };
}

window.novafactHtml = installDefaultPolicy();

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>,
);

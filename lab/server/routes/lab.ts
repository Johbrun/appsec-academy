// Console du lab : état des exercices, remise à zéro, et les quelques points
// d'appui dont les exercices côté navigateur ont besoin.
//
// Ce fichier n'est pas vulnérable : il n'appartient pas à Novafact, c'est
// l'échafaudage pédagogique. Ne pas y chercher de défaut.

import { Router } from 'express';
import { exercises } from '../../shared/exercises.ts';
import { audit, db, flagFor, resetData, solve } from '../store.ts';
import { clearBrandingCache } from './branding.ts';
import { resetAuthState } from './auth.ts';
import { resetCreditState } from './credits.ts';
import { resetInvoiceState } from './invoices.ts';
import { isAuditable, runAudit } from '../audit/index.ts';
import { text as repoText } from '../audit/repo.ts';

export const labRoutes = Router();

labRoutes.get('/exercises', (_req, res) => {
  res.json(
    exercises.map((e) => {
      const solved = db.solved.get(e.id);
      return {
        ...e,
        solved: Boolean(solved),
        solvedAt: solved?.at ?? null,
        flag: solved?.flag ?? null,
        // Les challenges « fix » se valident par l'audit du fichier, pas par
        // une requête : l'interface doit pouvoir le déclencher.
        auditable: isAuditable(e.id),
      };
    }),
  );
});

/**
 * Rejoue les vérifications des challenges « fix » et décerne les drapeaux.
 * Sans identifiant : toutes. Relançable autant de fois qu'on veut.
 */
labRoutes.post('/audit/:id?', (req, res) => {
  const { entries, broken } = runAudit(req.params.id);
  if (req.params.id && !entries.length) {
    res.status(404).json({ error: `aucune vérification pour « ${req.params.id} »` });
    return;
  }
  res.json({ entries, broken });
});

/** Lecture seule d'un fichier du dépôt fixture, pour l'afficher dans le lab. */
labRoutes.get('/repo/*', (req, res) => {
  const rel = (req.params as unknown as Record<string, string>)[0] ?? '';
  const content = repoText(rel);
  if (content === null) {
    res.status(404).json({ error: 'fichier introuvable dans la fixture' });
    return;
  }
  res.type('text/plain').send(content);
});

labRoutes.get('/state', (_req, res) => {
  res.json({
    solved: [...db.solved.keys()],
    total: exercises.length,
    mails: db.mails.length,
    loginAttempts: db.loginAttempts,
    prototypePolluted: ({} as Record<string, unknown>).canExport !== undefined,
  });
});

labRoutes.get('/mails', (_req, res) => res.json(db.mails));
labRoutes.get('/audit', (_req, res) => res.json(db.audit));

labRoutes.post('/reset', (_req, res) => {
  resetData();
  clearBrandingCache();
  resetAuthState();
  resetCreditState();
  resetInvoiceState();
  // La pollution de prototype survit à la réinitialisation des données :
  // elle vit dans le processus, pas dans les données. Il faut la défaire.
  delete (Object.prototype as Record<string, unknown>).canExport;
  res.json({ ok: true });
});

labRoutes.post('/unsolve/:id', (req, res) => {
  db.solved.delete(req.params.id);
  res.json({ ok: true });
});

// Liste de mots de passe courants, pour l'exercice no-rate-limit.
const WORDLIST = [
  '123456', 'password', 'azerty', 'motdepasse', 'qwerty', 'soleil', 'bonjour',
  'novafact', 'globex', 'compta', 'facture', 'admin', 'welcome', 'abc123',
  'iloveyou', 'monkey', 'dragon', 'football', 'baseball', 'superman',
  'printemps', 'ete2024', 'hiver2024', 'automne2024', 'paris2024',
  'Azerty01', 'Compta2024', 'Globex2024', 'Facture2024', 'Novafact2024',
  'printemps2023', 'printemps2025', 'printemps2024', // la bonne est ici, en 33e position
  'motdepasse1', 'password1', 'azerty123', 'qwerty123', 'admin123',
  'lucas', 'emma', 'chocolat', 'vacances', 'liberte', 'bretagne', 'marseille',
  'chatons', 'jetaime', 'nantes', 'toulouse', 'bordeaux', 'lyon2024', 'lille',
];
labRoutes.get('/wordlist', (_req, res) => res.type('text/plain').send(WORDLIST.join('\n')));

// ── Points d'appui des exercices côté navigateur ────────────────────────────

/**
 * Appelé par la charge utile de dom-xss depuis le navigateur.
 *
 * Deux conditions, pour que le drapeau reflète la réalité : la requête vient
 * bien d'un contexte de même origine (Sec-Fetch-Site est posé par le
 * navigateur, JavaScript ne peut pas le forger), et une note de facture
 * contient effectivement une charge utile stockée.
 */
labRoutes.get('/xss', (req, res) => {
  const sameOrigin = req.headers['sec-fetch-site'] === 'same-origin';
  const stored = db.invoices.some((i) => /<[^>]+\bon\w+\s*=|<script/i.test(i.note));

  if (sameOrigin && stored) {
    audit('navigateur', 'xss', 'charge utile stockée exécutée dans le contexte de l’application');
    solve('dom-xss');
    res.json({ ok: true, flag: flagFor('dom-xss') });
    return;
  }
  res.status(400).json({
    ok: false,
    sameOrigin,
    stored,
    hint: sameOrigin
      ? 'Aucune note de facture ne contient de charge utile stockée.'
      : 'Cette route doit être appelée depuis la page de l’application, par le navigateur.',
  });
});

/**
 * Le « script tiers » que la page de paiement charge depuis analyticsUrl.
 * Sec-Fetch-Dest: script prouve qu'il a été chargé comme script par la page,
 * et pas simplement récupéré à la main.
 */
labRoutes.get('/evil-script.js', (req, res) => {
  if (req.headers['sec-fetch-dest'] === 'script') {
    audit('navigateur', 'script.tiers', 'origine pilotée par la configuration du tenant');
    solve('third-party-script');
  }
  res.type('application/javascript').send(
    `// Script tiers du lab : inerte, il se contente de se signaler.
console.warn('[lab] script tiers chargé depuis la configuration du tenant');
document.documentElement.dataset.labThirdParty = 'chargé';
`,
  );
});

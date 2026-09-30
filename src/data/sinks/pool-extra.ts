// Compléments au pool de « Spot the Sink » : les familles qu'aucun des quatre
// fichiers thématiques n'a pu prendre en réponse, faute de place.

import type { Snippet } from './types';

export const cwe: Record<string, string> = {
  'CWE-693': 'Mécanisme de protection contourné ou inopérant',
};

export const snippets: Snippet[] = [
  {
    id: 'ex-n2-helmet-mount-order',
    level: 2,
    file: 'server/index.ts',
    lang: 'ts',
    line: 25,
    cwe: 'CWE-693',
    options: ['CWE-693', 'CWE-942', 'CWE-1021', 'CWE-307'],
    decoys: [17, 20],
    code: `import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { authRoutes } from './routes/auth';
import { invoiceRoutes } from './routes/invoices';
import { logger } from './lib/logger';

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(express.json({ limit: '256kb' }));

// Les origines autorisées viennent de la configuration, jamais de la requête.
app.use(cors({ origin: ['https://app.novafact.example'], credentials: true }));

// Freine les rafales sur l'authentification.
app.use('/api/auth', rateLimit({ windowMs: 900_000, limit: 20 }));

app.use('/api/auth', authRoutes);
app.use('/api/invoices', invoiceRoutes);

app.use(helmet({
  contentSecurityPolicy: {
    directives: { defaultSrc: ["'self'"], frameAncestors: ["'none'"] },
  },
  hsts: { maxAge: 31_536_000, includeSubDomains: true },
}));

app.use((err: Error, _req: express.Request, res: express.Response) => {
  logger.error({ err }, 'erreur non gérée');
  res.status(500).json({ error: 'erreur interne' });
});

app.listen(4000, () => logger.info('API démarrée'));`,
    explain:
      'Les intergiciels d’Express s’appliquent dans l’ordre où on les monte : celui-ci arrive après les routes, donc aucune réponse de l’API ne portera jamais ses en-têtes. La configuration est pourtant irréprochable — CSP avec frame-ancestors, HSTS d’un an — et c’est ce qui rend le défaut coûteux : il traverse une revue de configuration, il traverse un audit qui lit le code sans lancer la requête, et seul un contrôle des en-têtes réellement servis le voit. D’où la règle : vérifier les en-têtes après chaque déploiement, pas dans le fichier qui les déclare. Les deux leurres sont sains — le partage d’origines de la ligne 17 accompagne bien les identifiants, mais sur une liste blanche explicite et non sur l’origine reflétée ; et la limitation de la ligne 20 est montée avant la route qu’elle protège, ce qui est précisément ce qui manque à helmet.',
  },
];

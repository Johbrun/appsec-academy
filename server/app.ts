import path from 'node:path';
import express, { type ErrorRequestHandler, type Express, type Router } from 'express';
import helmet from 'helmet';
import type { Config } from './config.ts';
import type { Db } from './db.ts';
import { HttpError, csrfGuard } from './lib/http.ts';
import { createLimiters } from './lib/limiters.ts';
import { createPasswords } from './lib/password.ts';
import { createSessions, mustBeTeacher, mustBeUser } from './lib/session.ts';
import type { Clock, Deps } from './lib/deps.ts';
import { registerAuthRoutes } from './routes/auth.ts';
import { registerCohortRoutes } from './routes/cohorts.ts';
import { registerMeRoutes } from './routes/me.ts';
import { registerProgressRoutes } from './routes/progress.ts';
import { registerTeacherRoutes } from './routes/teacher.ts';

export interface AppOptions {
  db: Db;
  config: Config;
  /** Injectable pour que les tests fassent vieillir les sessions sans attendre. */
  clock?: Clock;
}

export interface AppHandle extends Express {
  locals: Express['locals'] & { apiRouter: Router; sessions: Deps['sessions'] };
}

const ONE_YEAR = 31_536_000;

export function createApp({ db, config, clock = { now: () => Date.now() } }: AppOptions): AppHandle {
  const app = express() as AppHandle;
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy > 0 ? config.trustProxy : false);

  const sessions = createSessions(db, config, clock);
  const deps: Deps = { db, config, clock, sessions, passwords: createPasswords(config.argon), limiters: createLimiters(config) };

  // Le front n'a ni script ni style en ligne (le script de thème vit dans public/theme.js) :
  // la CSP n'a donc pas besoin de 'unsafe-inline'. Les styles posés par React passent par le CSSOM, que la CSP n'interdit pas.
  app.use(helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", 'https://fonts.googleapis.com'],
        fontSrc: ['https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        frameAncestors: ["'none'"],
        baseUri: ["'none'"],
        formAction: ["'self'"],
        objectSrc: ["'none'"],
      },
    },
    frameguard: { action: 'deny' },
    referrerPolicy: { policy: 'no-referrer' },
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    crossOriginResourcePolicy: { policy: 'same-origin' },
  }));
  app.use((_req, res, next) => {
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
    next();
  });

  // L'API : tout est enregistré à plat sur ce routeur, ce qui permet aux tests d'en lister les routes.
  const api = express.Router();
  api.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  api.use(csrfGuard(config.allowedOrigins));
  api.use(express.json({ limit: '256kb' }));
  api.use(sessions.middleware);

  registerAuthRoutes(api, deps);   // publiques
  api.use(mustBeUser);             // tout ce qui suit exige une session : une nouvelle route est protégée par défaut
  registerMeRoutes(api, deps);
  registerProgressRoutes(api, deps);
  registerCohortRoutes(api, deps);
  api.use('/teacher', mustBeTeacher);   // un handler enseignant qui oublierait requireTeacher reste fermé aux étudiants
  registerTeacherRoutes(api, deps);
  api.use((_req, _res, next) => next(new HttpError(404, 'Introuvable')));

  app.locals.apiRouter = api;
  app.locals.sessions = sessions;
  app.use('/api', api);

  // Le front : des fichiers publics (le contenu n'est pas secret), c'est la SPA qui exige la session.
  app.use(express.static(config.distDir, {
    dotfiles: 'ignore',
    setHeaders(res, file) {
      const hashed = file.split(path.sep).includes('assets');   // noms suffixés d'un hash par Vite
      res.setHeader('Cache-Control', hashed ? `public, max-age=${ONE_YEAR}, immutable` : 'no-cache');
    },
  }));
  app.use((_req, res) => { res.status(404).type('text/plain').send('Introuvable'); });

  const onError: ErrorRequestHandler = (err: unknown, _req, res, _next) => {
    // Les messages sont les nôtres : on ne renvoie jamais celui d'une bibliothèque, ni pile, ni chemin, ni SQL.
    const status = err instanceof HttpError ? err.status : httpStatusOf(err);
    if (status >= 500 && config.logErrors) console.error(err);
    if (res.headersSent) return;
    res.status(status).json({ error: err instanceof HttpError ? err.message : MESSAGES[status] ?? 'Requête refusée' });
  };
  app.use(onError);

  return app;
}

const MESSAGES: Record<number, string> = {
  400: 'Requête invalide',
  413: 'Corps trop volumineux',
  415: 'Type de contenu non pris en charge',
  500: 'Erreur interne',
};

/** Les erreurs de body-parser portent leur statut (400 JSON invalide, 413 trop gros, 415 encodage). */
function httpStatusOf(err: unknown): number {
  const status = (err as { status?: unknown })?.status;
  return typeof status === 'number' && status >= 400 && status < 500 ? status : 500;
}

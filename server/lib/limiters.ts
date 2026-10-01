import type { Request, RequestHandler } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import type { Config } from '../config.ts';

export interface Limiters {
  loginIp: RequestHandler;
  signup: RequestHandler;
  reset: RequestHandler;
  join: RequestHandler;
}

const ipKey = (req: Request) => ipKeyGenerator(req.ip ?? '0.0.0.0');

export function createLimiters(config: Config): Limiters {
  const { windowMs } = config.limits;
  const make = (limit: number, keyGenerator: (req: Request) => string, failuresOnly = false) => rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator,
    skipSuccessfulRequests: failuresOnly,
    message: { error: 'Trop de tentatives, réessaie plus tard' },
    // En test, les requêtes portent des X-Forwarded-For forgés exprès : inutile de le répéter dans les logs.
    validate: config.env === 'test' ? false : undefined,
  });

  return {
    // Seuls les échecs comptent : un compte légitime ne se bloque pas en se connectant.
    // Pas de limite par email : elle permettrait à n'importe qui de verrouiller le compte d'un autre.
    // Le coût d'argon2id et la limite par IP freinent le bourrage de mots de passe.
    loginIp: make(config.limits.loginPerIp, ipKey, true),
    signup: make(config.limits.signupPerIp, ipKey),
    reset: make(config.limits.resetPerIp, ipKey, true),
    join: make(config.limits.joinPerUser, (req) => `user:${req.user?.id ?? ipKey(req)}`, true),
  };
}

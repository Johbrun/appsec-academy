import { hash, parseOptions, verify } from '@node-rs/argon2';
import type { ArgonParams } from '../config.ts';

// L'enum Algorithm du paquet est une « const enum » ambiante : vide à l'exécution. Argon2id vaut 2.
const ARGON2ID = 2;

export interface Passwords {
  hash(password: string): Promise<string>;
  verify(stored: string, password: string): Promise<boolean>;
  /** Vrai si le hash est plus faible que les paramètres courants : on le recalcule à la prochaine connexion. */
  needsRehash(stored: string): boolean;
  /** Dépense le même travail qu'une vraie vérification, pour qu'un email inconnu ne se repère pas au temps de réponse. */
  verifyDummy(password: string): Promise<void>;
}

export function createPasswords(params: ArgonParams): Passwords {
  const options = { algorithm: ARGON2ID as never, ...params };
  let dummy: Promise<string> | undefined;

  return {
    hash: (password) => hash(password, options),

    async verify(stored, password) {
      try { return await verify(stored, password); } catch { return false; }
    },

    needsRehash(stored) {
      try {
        const o = parseOptions(stored);
        return (o.algorithm as number) !== ARGON2ID
          || o.memoryCost < params.memoryCost
          || o.timeCost < params.timeCost
          || o.parallelism < params.parallelism;
      } catch {
        return true;
      }
    },

    async verifyDummy(password) {
      dummy ??= hash('mot de passe factice, jamais valide', options);
      await verify(await dummy, password).catch(() => false);
    },
  };
}

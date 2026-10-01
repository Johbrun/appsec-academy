import type { Config } from '../config.ts';
import type { Db } from '../db.ts';
import type { Passwords } from './password.ts';
import type { Sessions } from './session.ts';
import type { Limiters } from './limiters.ts';

export interface Clock { now(): number }

export interface Deps {
  db: Db;
  config: Config;
  clock: Clock;
  passwords: Passwords;
  sessions: Sessions;
  limiters: Limiters;
}

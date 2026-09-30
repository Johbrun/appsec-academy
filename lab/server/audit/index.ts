// Moteur d'audit des challenges « fix ».
//
// Un challenge « exploit » se valide quand le serveur constate une violation.
// Un challenge « fix » se valide à l'inverse : quand la vérification ne trouve
// plus rien à redire sur le fichier. Le drapeau récompense donc la correction,
// et l'audit se relance autant de fois qu'on veut, sans redémarrer le lab.

import { solve } from '../store.ts';
import { yamlErrors } from './repo.ts';
import { m14Checks, type Check } from './m14.ts';
import { m01Checks } from './m01.ts';
import { m05Checks } from './m05.ts';
import { m06Checks } from './m06.ts';
import { m07Checks } from './m07.ts';
import { m11Checks } from './m11.ts';
import { m12Checks } from './m12.ts';
import { m13Checks } from './m13.ts';
import { m15Checks } from './m15.ts';
import { m16Checks } from './m16.ts';
import { m17Checks } from './m17.ts';
import { m18Checks } from './m18.ts';

// M20 n'est pas branché : ses vérifications existent (server/audit/m20.ts)
// mais il leur manque le registre jouable et les livrables de référence. Les
// brancher ferait apparaître des vérifications sans challenge — une promesse
// non tenue. À finir avant de le rouvrir.
export const checks: Record<string, Check> = {
  ...m14Checks,
  ...m01Checks,
  ...m05Checks,
  ...m06Checks,
  ...m07Checks,
  ...m11Checks,
  ...m12Checks,
  ...m13Checks,
  ...m15Checks,
  ...m16Checks,
  ...m17Checks,
  ...m18Checks,
};

export interface AuditEntry {
  id: string;
  fixed: boolean;
  /** Ce qui reste à corriger, ou null quand c'est bon. */
  reason: string | null;
}

/**
 * Rejoue toutes les vérifications (ou une seule) et décerne les drapeaux.
 *
 * Une fixture au YAML cassé est signalée à part : sans elle, toutes les
 * vérifications de workflow passeraient « au vert » par accident, puisqu'un
 * document illisible ne contient aucun motif fautif.
 */
export function runAudit(only?: string): { entries: AuditEntry[]; broken: string[] } {
  const broken = yamlErrors();
  const ids = only ? [only].filter((id) => id in checks) : Object.keys(checks);

  const entries = ids.map((id) => {
    let reason: string | null;
    try {
      reason = checks[id]();
    } catch (err) {
      reason = `la vérification n’a pas pu s’exécuter : ${(err as Error).message}`;
    }
    // Tant qu'un workflow ne se lit pas, on ne décerne rien.
    const fixed = reason === null && broken.length === 0;
    if (fixed) solve(id);
    return { id, fixed, reason: broken.length ? `fichier illisible : ${broken.join(' · ')}` : reason };
  });

  return { entries, broken };
}

export const isAuditable = (id: string) => id in checks;

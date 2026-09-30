// Garde-fous de démarrage.
//
// Cette application est volontairement vulnérable. Elle n'a de sens que sur une
// machine de travail, sur la boucle locale, avec des données fictives. Les
// contrôles ci-dessous sont là pour qu'une mise en ligne accidentelle échoue
// bruyamment plutôt que silencieusement.

import os from 'node:os';

export const HOST = process.env.LAB_HOST ?? '127.0.0.1';
export const PORT = Number(process.env.LAB_PORT ?? 4317);
export const IMDS_PORT = Number(process.env.LAB_IMDS_PORT ?? 4318);

const LOOPBACK = new Set(['127.0.0.1', '::1', 'localhost']);

export function assertSafeToRun(): void {
  const problems: string[] = [];

  if (process.env.NODE_ENV === 'production') {
    problems.push('NODE_ENV=production : ce lab ne doit jamais tourner en production.');
  }

  if (!LOOPBACK.has(HOST) && process.env.LAB_ALLOW_NETWORK !== '1') {
    problems.push(
      `LAB_HOST=${HOST} expose le lab hors de la boucle locale. ` +
        'Si c’est délibéré (machine de formation isolée), relance avec LAB_ALLOW_NETWORK=1.',
    );
  }

  // Un conteneur ou une VM exposée directement sur une interface publique est
  // le cas où l'on se fait le plus facilement piéger.
  if (process.env.LAB_ALLOW_NETWORK === '1') {
    const publicIfaces = Object.entries(os.networkInterfaces())
      .flatMap(([name, addrs]) => (addrs ?? []).map((a) => ({ name, ...a })))
      .filter((a) => a.family === 'IPv4' && !a.internal);
    if (publicIfaces.length > 0) {
      warn(
        'Le lab écoute hors boucle locale, sur une machine qui a des interfaces réseau : ' +
          publicIfaces.map((i) => `${i.name}=${i.address}`).join(', ') +
          '. Toute personne qui atteint ce port obtient un shell applicatif.',
      );
    }
  }

  if (problems.length > 0) {
    console.error('\n\x1b[41m\x1b[97m  DÉMARRAGE REFUSÉ  \x1b[0m\n');
    for (const p of problems) console.error(`  · ${p}`);
    console.error('');
    process.exit(1);
  }
}

export function banner(): void {
  const red = '\x1b[31m';
  const bold = '\x1b[1m';
  const off = '\x1b[0m';
  console.log(`
${red}${bold}  ╔══════════════════════════════════════════════════════════════════╗
  ║   NOVAFACT LAB — APPLICATION VOLONTAIREMENT VULNÉRABLE           ║
  ║                                                                  ║
  ║   Support d'exercices d'AppSec Academy. Données fictives, en     ║
  ║   mémoire, remises à zéro à chaque redémarrage.                  ║
  ║                                                                  ║
  ║   · Ne jamais exposer sur un réseau ni sur Internet.             ║
  ║   · Ne jamais y mettre de données réelles.                       ║
  ║   · Ne pas réutiliser ce code : il est faux exprès.              ║
  ╚══════════════════════════════════════════════════════════════════╝${off}

  API      http://${HOST}:${PORT}
  IMDS     http://${HOST}:${IMDS_PORT}   (faux service de métadonnées, local)
  Interface  npm run dev:web  →  http://127.0.0.1:5199
`);
}

function warn(msg: string): void {
  console.warn(`\x1b[33m  ⚠  ${msg}\x1b[0m`);
}

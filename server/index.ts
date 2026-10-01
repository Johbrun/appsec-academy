import path from 'node:path';
import { createApp } from './app.ts';
import { loadConfigOrExit } from './config.ts';
import { openDb } from './db.ts';
import { BOOTSTRAP_LOGIN, bootstrapTeacher } from './lib/bootstrap.ts';
import { createPasswords } from './lib/password.ts';

const config = loadConfigOrExit();
const db = openDb(config.databasePath);
const app = createApp({ db, config });

const passwordFile = path.join(path.dirname(config.databasePath), 'teacher-initial-password.txt');
if (await bootstrapTeacher(db, createPasswords(config.argon), Date.now(), passwordFile)) {
  console.log(`Compte enseignant créé : identifiant « ${BOOTSTRAP_LOGIN} ». Mot de passe dans ${passwordFile} : lis-le, change-le dans ton profil, puis supprime le fichier.`);
}

const purge = () => app.locals.sessions.purgeExpired();
purge();
setInterval(purge, 3_600_000).unref();

const server = app.listen(config.port, config.host, () => {
  console.log(`AppSec Academy · http://${config.host}:${config.port} · ${config.env}`);
  console.log(`  base de données : ${config.databasePath}`);
  console.log(`  origines autorisées : ${config.allowedOrigins.join(', ')}`);
  if (config.env === 'production' && config.trustProxy === 0) {
    console.warn('  ⚠ TRUST_PROXY=0 : derrière un reverse proxy, toutes les requêtes semblent venir de la même IP et les limites de tentatives deviennent communes à tous. Règle TRUST_PROXY=1.');
  }
});

let stopping = false;
function shutdown() {
  if (stopping) return;
  stopping = true;
  server.close(() => { db.close(); process.exit(0); });
  server.closeIdleConnections();
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

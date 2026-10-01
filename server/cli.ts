import { loadConfigOrExit } from './config.ts';
import { openDb } from './db.ts';
import { createResetToken } from './lib/reset.ts';

const USAGE = `Usage : npm run user -- <commande>

  list-users                          liste les comptes
  set-role <email> <student|teacher>  change le rôle d'un compte
  reset-link <email>                  génère un lien de réinitialisation du mot de passe
  backup <fichier>                    sauvegarde à chaud de la base`;

const fail = (msg: string): never => { console.error(msg); process.exit(1); };

const [command, ...args] = process.argv.slice(2);
const config = loadConfigOrExit();
const db = openDb(config.databasePath);

function userByEmail(email: string | undefined) {
  if (!email) fail(USAGE);
  const user = db.prepare('SELECT id, email, name, role FROM users WHERE email = ?').get(email!.trim().toLowerCase()) as
    { id: number; email: string; name: string; role: string } | undefined;
  return user ?? fail(`Aucun compte pour ${email}`);
}

switch (command) {
  case 'list-users': {
    const rows = db.prepare('SELECT id, email, name, role, created_at FROM users ORDER BY id').all() as
      { id: number; email: string; name: string; role: string; created_at: number }[];
    for (const u of rows) console.log(`${String(u.id).padStart(4)}  ${u.role.padEnd(8)} ${u.email}  (${u.name})  ${new Date(u.created_at).toISOString().slice(0, 10)}`);
    console.log(`${rows.length} compte(s)`);
    break;
  }
  case 'set-role': {
    const role = args[1];
    if (role !== 'student' && role !== 'teacher') fail(USAGE);
    const user = userByEmail(args[0]);
    db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, user.id);
    console.log(`${user.email} : ${user.role} → ${role}`);
    break;
  }
  case 'reset-link': {
    const user = userByEmail(args[0]);
    const token = createResetToken(db, user.id, Date.now(), config.resetTtlMs);
    console.log(`${config.allowedOrigins[0]}/#/reinitialiser?token=${token}`);
    console.log('Valable 24 h, à usage unique. À transmettre à la personne, pas à conserver.');
    break;
  }
  case 'backup': {
    if (!args[0]) fail(USAGE);
    await db.backup(args[0]!);
    console.log(`Sauvegarde écrite dans ${args[0]}`);
    break;
  }
  default:
    fail(USAGE);
}
db.close();

import fs from 'node:fs';
import type { Db } from '../db.ts';
import type { Passwords } from './password.ts';
import { newToken } from './tokens.ts';

export const BOOTSTRAP_LOGIN = 'teacher';

/**
 * Premier démarrage : sans aucun enseignant, la plateforme serait inutilisable (on ne le devient que par la CLI).
 * On crée donc le compte `teacher` avec un mot de passe aléatoire, écrit dans un fichier lisible par le seul
 * propriétaire plutôt que dans les journaux (un secret n'a rien à y faire). Rien n'est créé dès qu'un enseignant
 * existe : un redémarrage ne ressuscite pas un compte supprimé ou renommé, et un déploiement existant
 * ne reçoit pas de compte au mot de passe connu de l'opérateur.
 * Renvoie vrai si le compte a été créé.
 */
export async function bootstrapTeacher(db: Db, passwords: Passwords, now: number, passwordFile: string): Promise<boolean> {
  if (db.prepare("SELECT 1 FROM users WHERE role = 'teacher'").get()) return false;
  // L'identifiant n'a pas la forme d'un email : l'inscription (format strict) ne permet donc pas de le réserver.
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(BOOTSTRAP_LOGIN)) return false;

  const password = newToken();
  const hashed = await passwords.hash(password);
  // Le fichier d'abord : si l'écriture échoue, aucun compte ne naît avec un mot de passe que personne ne connaît.
  fs.writeFileSync(passwordFile, `identifiant : ${BOOTSTRAP_LOGIN}\nmot de passe : ${password}\n`, { mode: 0o600 });
  fs.chmodSync(passwordFile, 0o600);   // `mode` ne s'applique pas à un fichier déjà présent
  db.prepare('INSERT INTO users (email, name, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(BOOTSTRAP_LOGIN, 'Enseignant', hashed, 'teacher', now);
  return true;
}

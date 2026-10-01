import type { Router } from 'express';
import { HttpError, bodyOf, email, password, text } from '../lib/http.ts';
import type { Deps } from '../lib/deps.ts';
import { TOKEN_RE, sha256 } from '../lib/tokens.ts';

interface UserRow { id: number; email: string; name: string; role: 'student' | 'teacher'; password_hash: string }

const publicUser = (u: Pick<UserRow, 'id' | 'email' | 'name' | 'role'>) => ({ id: u.id, email: u.email, name: u.name, role: u.role });

const isUniqueViolation = (e: unknown) => (e as { code?: string })?.code === 'SQLITE_CONSTRAINT_UNIQUE';

/** Routes publiques : ce sont les seules qu'on peut appeler sans session. */
export function registerAuthRoutes(api: Router, { db, clock, passwords, sessions, limiters }: Deps) {
  api.post('/auth/signup', limiters.signup, async (req, res) => {
    const body = bodyOf(req);
    const mail = email(body, true);
    const name = text(body, 'name', 'Nom', 1, 80);
    const pwd = password(body, 'password', 'Mot de passe', 10);

    if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(mail)) throw new HttpError(409, 'Un compte existe déjà avec cet email');
    const hashed = await passwords.hash(pwd);
    let id: number;
    try {
      // Le rôle n'est jamais lu dans le corps : on naît étudiant, on devient enseignant par la CLI.
      id = Number(db.prepare('INSERT INTO users (email, name, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)')
        .run(mail, name, hashed, 'student', clock.now()).lastInsertRowid);
    } catch (e) {
      if (isUniqueViolation(e)) throw new HttpError(409, 'Un compte existe déjà avec cet email');
      throw e;
    }
    sessions.start(res, id);
    res.status(201).json({ user: { id, email: mail, name, role: 'student' } });
  });

  api.post('/auth/login', limiters.loginIp, async (req, res) => {
    const body = bodyOf(req);
    const mail = email(body, false);
    const pwd = password(body, 'password', 'Mot de passe', 1);

    const user = db.prepare('SELECT id, email, name, role, password_hash FROM users WHERE email = ?').get(mail) as UserRow | undefined;
    let ok = false;
    if (user) ok = await passwords.verify(user.password_hash, pwd);
    else await passwords.verifyDummy(pwd);
    // Même message, même statut, même travail : ni l'email ni le mot de passe ne se devinent séparément.
    if (!ok || !user) throw new HttpError(401, 'Email ou mot de passe incorrect');

    if (passwords.needsRehash(user.password_hash)) {
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(await passwords.hash(pwd), user.id);
    }
    sessions.revoke(req);        // on ne réutilise jamais un jeton : pas de fixation de session
    sessions.start(res, user.id);
    res.json({ user: publicUser(user) });
  });

  api.post('/auth/logout', (req, res) => {
    sessions.end(req, res);
    res.json({ ok: true });
  });

  api.post('/auth/reset', limiters.reset, async (req, res) => {
    const body = bodyOf(req);
    const token = body.token;
    const pwd = password(body, 'password', 'Mot de passe', 10);
    const invalid = new HttpError(400, 'Lien invalide ou expiré');
    if (typeof token !== 'string' || !TOKEN_RE.test(token)) throw invalid;

    const hashed = await passwords.hash(pwd);
    const now = clock.now();
    const done = db.transaction(() => {
      const row = db.prepare('SELECT user_id FROM reset_tokens WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?')
        .get(sha256(token), now) as { user_id: number } | undefined;
      if (!row) return false;
      db.prepare('UPDATE reset_tokens SET used_at = ? WHERE token_hash = ?').run(now, sha256(token));
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashed, row.user_id);
      sessions.revokeAllFor(row.user_id);
      return true;
    })();
    if (!done) throw invalid;
    res.json({ ok: true });
  });

}

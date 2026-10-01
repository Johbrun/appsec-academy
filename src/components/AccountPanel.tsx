import { useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Download, LogOut, Trash2, Users } from 'lucide-react';
import { Block } from './ui';
import { api, messageOf } from '../lib/api';
import { useSession, useUser } from '../store/session';

type Note = { ok: boolean; text: string } | null;

function Notice({ note }: { note: Note }) {
  if (!note) return null;
  return <p className="small" role={note.ok ? 'status' : 'alert'} style={{ marginTop: 12, color: note.ok ? 'var(--ok)' : 'var(--ko)' }}>{note.text}</p>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: 'block' }}>
      <span className="label" style={{ display: 'block', marginBottom: 8 }}>{label}</span>
      {children}
    </label>
  );
}

/** Tout ce qui concerne le compte lui-même : identité, promos, mot de passe, données, suppression. */
export function AccountPanel() {
  const user = useUser();
  const { cohorts, setName, refresh, logout } = useSession();
  const [name, setNameDraft] = useState(user.name);
  const [nameNote, setNameNote] = useState<Note>(null);
  const [code, setCode] = useState('');
  const [cohortNote, setCohortNote] = useState<Note>(null);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [pwdNote, setPwdNote] = useState<Note>(null);
  const [deleting, setDeleting] = useState(false);
  const [deletePwd, setDeletePwd] = useState('');
  const [deleteNote, setDeleteNote] = useState<Note>(null);

  const saveName = async (e: FormEvent) => {
    e.preventDefault();
    try { await setName(name); setNameNote({ ok: true, text: 'Nom enregistré.' }); } catch (err) { setNameNote({ ok: false, text: messageOf(err) }); }
  };

  const join = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const r = await api<{ cohort: { name: string }; joined: boolean }>('/cohorts/join', { method: 'POST', body: { code } });
      await refresh();
      setCode('');
      setCohortNote({ ok: true, text: r.joined ? `Tu as rejoint « ${r.cohort.name} ».` : `Tu fais déjà partie de « ${r.cohort.name} ».` });
    } catch (err) { setCohortNote({ ok: false, text: messageOf(err) }); }
  };

  const leave = async (id: number, label: string) => {
    if (!window.confirm(`Quitter la promo « ${label} » ? Son enseignant ne verra plus ta progression.`)) return;
    try { await api(`/cohorts/${id}/membership`, { method: 'DELETE' }); await refresh(); setCohortNote(null); } catch (err) { setCohortNote({ ok: false, text: messageOf(err) }); }
  };

  const changePassword = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api('/me/password', { method: 'POST', body: { current, next } });
      setCurrent(''); setNext('');
      setPwdNote({ ok: true, text: 'Mot de passe modifié. Tes autres appareils sont déconnectés.' });
    } catch (err) { setPwdNote({ ok: false, text: messageOf(err) }); }
  };

  const exportData = async () => {
    try {
      const data = await api('/me/export');
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `appsec-academy-donnees-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) { setDeleteNote({ ok: false, text: messageOf(err) }); }
  };

  const deleteAccount = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api('/me', { method: 'DELETE', body: { password: deletePwd } });
      await refresh();      // la session n'existe plus : retour à la page de connexion
    } catch (err) { setDeleteNote({ ok: false, text: messageOf(err) }); }
  };

  return (
    <Block eyebrow="Compte" title="Mon compte" lead="Ta progression est liée à ce compte : tu la retrouves sur n’importe quel appareil.">
      <div className="grid g2">
        <div className="card pad-lg">
          <div className="label">Identité</div>
          <form onSubmit={saveName} style={{ marginTop: 16, display: 'grid', gap: 16 }}>
            <Field label="Email"><input className="field" value={user.email} readOnly disabled /></Field>
            <Field label="Nom affiché">
              <input className="field" value={name} maxLength={80} required onChange={(e) => { setNameDraft(e.target.value); setNameNote(null); }} autoComplete="name" />
            </Field>
            <div><button className="btn sm primary" type="submit" disabled={!name.trim() || name.trim() === user.name}>Enregistrer</button></div>
          </form>
          <Notice note={nameNote} />
          {user.role === 'teacher' && (
            <p className="small" style={{ marginTop: 20 }}><Users size={14} style={{ verticalAlign: '-2px' }} /> Compte enseignant : <Link to="/enseignant" style={{ textDecoration: 'underline' }}>ouvrir l’espace enseignant</Link></p>
          )}
        </div>

        <div className="card pad-lg">
          <div className="label">Mot de passe</div>
          <form onSubmit={changePassword} style={{ marginTop: 16, display: 'grid', gap: 16 }}>
            <Field label="Mot de passe actuel">
              <input className="field" type="password" value={current} required autoComplete="current-password" onChange={(e) => setCurrent(e.target.value)} />
            </Field>
            <Field label="Nouveau mot de passe (10 caractères minimum)">
              <input className="field" type="password" value={next} required minLength={10} maxLength={128} autoComplete="new-password" onChange={(e) => setNext(e.target.value)} />
            </Field>
            <div><button className="btn sm" type="submit" disabled={!current || next.length < 10}>Changer le mot de passe</button></div>
          </form>
          <Notice note={pwdNote} />
        </div>

        {user.role === 'student' && (
          <div className="card pad-lg">
            <div className="label">Promos</div>
            {cohorts.length === 0
              ? <p className="small dim" style={{ marginTop: 12 }}>Tu n’as rejoint aucune promo. Ton enseignant te donne un code à 8 caractères.</p>
              : (
                <ul style={{ listStyle: 'none', padding: 0, margin: '12px 0 0', display: 'grid', gap: 10 }}>
                  {cohorts.map((c) => (
                    <li key={c.id} className="row between" style={{ justifyContent: 'space-between' }}>
                      <span><b>{c.name}</b> <span className="small dim">· {c.teacher}</span></span>
                      <button className="btn xs" onClick={() => leave(c.id, c.name)}>Quitter</button>
                    </li>
                  ))}
                </ul>
              )}
            <form onSubmit={join} className="row" style={{ marginTop: 18, gap: 10 }}>
              <input className="field" style={{ flex: 1, minWidth: 140, textTransform: 'uppercase', letterSpacing: '0.12em' }} placeholder="CODE DE PROMO" value={code} maxLength={12}
                aria-label="Code de promo" autoComplete="off" spellCheck={false} onChange={(e) => { setCode(e.target.value); setCohortNote(null); }} />
              <button className="btn sm" type="submit" disabled={code.trim().length < 8}>Rejoindre</button>
            </form>
            <p className="small dim" style={{ marginTop: 12 }}>L’enseignant d’une promo voit ton nom, ton email et ta progression. Tu peux la quitter à tout moment.</p>
            <Notice note={cohortNote} />
          </div>
        )}

        <div className="card pad-lg">
          <div className="label">Mes données</div>
          <p className="small dim" style={{ marginTop: 12 }}>Télécharge tout ce que le site conserve sur toi : compte, progression, promos.</p>
          <div className="row" style={{ marginTop: 14, gap: 10 }}>
            <button className="btn sm" onClick={exportData}><Download size={15} /> Télécharger mes données</button>
            <button className="btn sm" onClick={() => void logout()}><LogOut size={15} /> Se déconnecter</button>
          </div>
        </div>
      </div>

      <div className="card pad-lg" style={{ marginTop: 16 }}>
        <div className="label">Zone sensible</div>
        {!deleting ? (
          <div className="row" style={{ marginTop: 12, justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 500 }}>Supprimer mon compte</div>
              <div className="small dim">Efface définitivement ton compte, ta progression et tes appartenances aux promos.</div>
            </div>
            <button className="btn sm danger" onClick={() => setDeleting(true)}><Trash2 size={15} /> Supprimer</button>
          </div>
        ) : (
          <form onSubmit={deleteAccount} className="row" style={{ marginTop: 14, gap: 10 }}>
            <input className="field" style={{ flex: 1, minWidth: 200 }} type="password" placeholder="Ton mot de passe pour confirmer" aria-label="Mot de passe pour confirmer la suppression"
              value={deletePwd} required autoComplete="current-password" onChange={(e) => { setDeletePwd(e.target.value); setDeleteNote(null); }} />
            <button className="btn sm" type="button" onClick={() => { setDeleting(false); setDeletePwd(''); setDeleteNote(null); }}>Annuler</button>
            <button className="btn sm danger" type="submit" disabled={!deletePwd}>Supprimer définitivement</button>
          </form>
        )}
        <Notice note={deleteNote} />
      </div>
    </Block>
  );
}

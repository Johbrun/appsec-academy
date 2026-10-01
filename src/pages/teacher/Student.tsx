import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Check, Copy, KeyRound, UserMinus } from 'lucide-react';
import { Block, PageHead } from '../../components/ui';
import NotFound from '../NotFound';
import { api, ApiError, messageOf } from '../../lib/api';
import { copy, fmtDate, since } from '../../lib/teacher';
import { lessonKey, modules, pad2, totalLessons } from '../../data/catalog';
import { exams } from '../../data/exams';
import { availableGames } from '../../data/games';
import { levelFor, sanitize, type Progress } from '../../store/progress';

interface Detail {
  cohort: { id: number; name: string };
  student: { id: number; name: string; email: string; joinedAt: number };
  progress: { data: unknown; rev: number; updatedAt: number } | null;
}

const isPct = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export default function Student() {
  const { cohortId = '', uid = '' } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<{ url: string; expiresAt: number } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api<Detail>(`/teacher/cohorts/${encodeURIComponent(cohortId)}/students/${encodeURIComponent(uid)}`)
      .then(setDetail)
      .catch((e) => (e instanceof ApiError && e.status === 404 ? setMissing(true) : setError(messageOf(e))));
  }, [cohortId, uid]);

  if (missing) return <NotFound />;

  // Ce document vient du navigateur de l'étudiant : on ne lit que ce que le catalogue connaît, avec des types vérifiés.
  const p: Progress | null = detail?.progress ? sanitize(detail.progress.data) : null;
  const base = `/teacher/cohorts/${cohortId}/students/${uid}`;

  const makeLink = async () => {
    try {
      const r = await api<{ link: string; expiresAt: number }>(`${base}/reset-link`, { method: 'POST' });
      setLink({ url: r.link, expiresAt: r.expiresAt });
      setCopied(false);
    } catch (e) { setError(messageOf(e)); }
  };

  const remove = async () => {
    if (!detail || !window.confirm(`Retirer ${detail.student.name} de la promo ? Son compte et sa progression sont conservés.`)) return;
    try { await api(base, { method: 'DELETE' }); navigate(`/enseignant/${cohortId}`); } catch (e) { setError(messageOf(e)); }
  };

  return (
    <>
      <PageHead eyebrow={<Link to={`/enseignant/${cohortId}`}>← {detail?.cohort.name ?? 'Promo'}</Link>} title={detail?.student.name ?? 'Étudiant'}>
        {detail ? <>{detail.student.email} · inscrit·e le {fmtDate(detail.student.joinedAt)} · actif·ve {since(detail.progress?.updatedAt ?? null)}</> : 'Chargement…'}
      </PageHead>

      {error && <Block className="tight"><p className="small" role="alert" style={{ color: 'var(--ko)' }}>{error}</p></Block>}

      {detail && (
        <>
          <Block eyebrow="Vue d’ensemble" title="Progression">
            {!detail.progress && <p className="muted">Cet·te étudiant·e n’a encore rien enregistré.</p>}
            {detail.progress && !p && <p className="muted">Le format de cette progression n’est pas reconnu par cette version du site.</p>}
            {p && (
              <div className="kv">
                <div><span className="label">Niveau</span><b>{levelFor(p.xp).title}</b><div className="small dim mono">{p.xp} XP</div></div>
                <div><span className="label">Leçons</span><b>{Object.keys(p.lessons).length}<span className="dim">/{totalLessons}</span></b></div>
                <div><span className="label">Modules validés</span><b>{p.modules.length}<span className="dim">/{modules.length}</span></b></div>
                <div><span className="label">Badges · labs</span><b>{p.badges.length} · {p.labs.length}</b></div>
              </div>
            )}
          </Block>

          {p && (
            <>
              <Block eyebrow="Par module" title="Leçons et diagnostics" lead="Le diagnostic d’entrée est figé au premier passage : l’écart avec celui de sortie mesure ce qui a été appris.">
                <div className="tbl-wrap">
                  <table className="tbl">
                    <thead><tr><th>Module</th><th>Leçons</th><th>Diagnostic avant</th><th>Après</th><th>Écart</th></tr></thead>
                    <tbody>
                      {modules.map((m) => {
                        const done = m.lessons.filter((l) => p.lessons[lessonKey(m.id, l.id)]).length;
                        const cp = p.checkpoints[m.id];
                        const avant = isPct(cp?.avant) ? cp.avant : null;
                        const apres = isPct(cp?.apres) ? cp.apres : null;
                        const delta = avant !== null && apres !== null ? apres - avant : null;
                        return (
                          <tr key={m.id}>
                            <td><span className="mono dim">M{pad2(m.num)}</span> {m.short} {p.modules.includes(m.id) && <Check size={14} color="var(--ok)" aria-label="module validé" />}</td>
                            <td className="mono">{done}<span className="dim">/{m.lessons.length}</span></td>
                            <td className="mono">{avant !== null ? `${avant} %` : <span className="dim">—</span>}</td>
                            <td className="mono">{apres !== null ? `${apres} %` : <span className="dim">—</span>}</td>
                            <td className="mono" style={{ color: delta === null ? undefined : delta >= 0 ? 'var(--ok)' : 'var(--ko)' }}>{delta === null ? <span className="dim">—</span> : `${delta >= 0 ? '+' : ''}${delta} pts`}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Block>

              <Block eyebrow="Évaluations" title="Examens et jeux">
                <div className="grid g2">
                  <div className="card pad-lg">
                    <div className="label">Examens</div>
                    <table className="tbl" style={{ marginTop: 12 }}>
                      <tbody>
                        {exams.map((e) => {
                          const score = p.scores[e.id];
                          return (
                            <tr key={e.id}>
                              <td>{e.title}</td>
                              <td className="mono">{isPct(score) ? `${score} %` : <span className="dim">—</span>}</td>
                              <td>{isPct(score) && <span className={`tag ${score >= e.pass ? 'ok' : 'ko'}`}>{score >= e.pass ? 'Réussi' : `< ${e.pass} %`}</span>}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="card pad-lg">
                    <div className="label">Jeux · {availableGames.filter((g) => isPct(p.scores[g.id])).length}/{availableGames.length} joués</div>
                    <table className="tbl" style={{ marginTop: 12 }}>
                      <tbody>
                        {availableGames.filter((g) => isPct(p.scores[g.id])).sort((a, b) => p.scores[b.id]! - p.scores[a.id]!).map((g) => (
                          <tr key={g.id}><td>{g.title}</td><td className="mono">{p.scores[g.id]} %</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </Block>
            </>
          )}

          <Block eyebrow="Gestion" title="Actions sur le compte">
            <div className="grid g2">
              <div className="card pad-lg">
                <div style={{ fontWeight: 500 }}>Réinitialiser le mot de passe</div>
                <p className="small dim">Génère un lien à usage unique, valable 24 heures, à transmettre à l’étudiant en privé. Il ne sera affiché qu’ici, une seule fois.</p>
                <button className="btn sm" onClick={makeLink}><KeyRound size={15} /> Générer un lien</button>
                {link && (
                  <div style={{ marginTop: 16 }}>
                    <input className="field mono" readOnly value={link.url} aria-label="Lien de réinitialisation" onFocus={(e) => e.currentTarget.select()} />
                    <div className="row" style={{ marginTop: 10, gap: 10 }}>
                      <button className="btn xs" onClick={async () => setCopied(await copy(link.url))}><Copy size={13} /> {copied ? 'Copié' : 'Copier le lien'}</button>
                      <span className="small dim">Expire le {new Date(link.expiresAt).toLocaleString('fr-FR')}</span>
                    </div>
                  </div>
                )}
              </div>
              <div className="card pad-lg">
                <div style={{ fontWeight: 500 }}>Retirer de la promo</div>
                <p className="small dim">L’étudiant n’apparaît plus dans ta liste et tu ne vois plus sa progression. Son compte reste intact, il peut rejoindre de nouveau avec le code.</p>
                <button className="btn sm danger" onClick={remove}><UserMinus size={15} /> Retirer</button>
              </div>
            </div>
          </Block>
        </>
      )}
    </>
  );
}

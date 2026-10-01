import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Copy, Download, RefreshCw } from 'lucide-react';
import { Block, PageHead } from '../../components/ui';
import NotFound from '../NotFound';
import { api, ApiError, messageOf } from '../../lib/api';
import { copy, download, fmtDate, since, toCsv, type CohortItem, type Member } from '../../lib/teacher';
import { modules, totalLessons } from '../../data/catalog';
import { levelFor } from '../../store/progress';

type Sort = 'activity' | 'name' | 'xp' | 'lessons';

const sorters: Record<Sort, (a: Member, b: Member) => number> = {
  activity: (a, b) => (b.lastActive ?? 0) - (a.lastActive ?? 0),
  name: (a, b) => a.name.localeCompare(b.name, 'fr'),
  xp: (a, b) => b.summary.xp - a.summary.xp,
  lessons: (a, b) => b.summary.lessons - a.summary.lessons,
};

const INACTIVE_DAYS = 14;

export default function Cohort() {
  const { cohortId = '' } = useParams();
  const [data, setData] = useState<{ cohort: CohortItem; members: Member[] } | null>(null);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>('activity');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setData(null);
    api<{ cohort: CohortItem; members: Member[] }>(`/teacher/cohorts/${encodeURIComponent(cohortId)}`)
      .then(setData)
      .catch((e) => (e instanceof ApiError && e.status === 404 ? setMissing(true) : setError(messageOf(e))));
  }, [cohortId]);

  const members = useMemo(() => [...(data?.members ?? [])].sort(sorters[sort]), [data, sort]);
  const stats = useMemo(() => {
    const list = data?.members ?? [];
    const n = list.length || 1;
    return {
      avgXp: Math.round(list.reduce((s, m) => s + m.summary.xp, 0) / n),
      avgLessons: Math.round((list.reduce((s, m) => s + m.summary.lessons, 0) / n / totalLessons) * 100),
      inactive: list.filter((m) => !m.lastActive || Date.now() - m.lastActive > INACTIVE_DAYS * 86_400_000).length,
    };
  }, [data]);

  if (missing) return <NotFound />;

  const regenerate = async () => {
    if (!data || !window.confirm('Générer un nouveau code ? L’ancien ne fonctionnera plus. Les étudiants déjà inscrits restent inscrits.')) return;
    try {
      const r = await api<{ cohort: CohortItem }>(`/teacher/cohorts/${data.cohort.id}/code`, { method: 'POST' });
      setData({ ...data, cohort: { ...data.cohort, code: r.cohort.code } });
    } catch (e) { setError(messageOf(e)); }
  };

  const exportCsv = () => {
    if (!data) return;
    const rows: (string | number)[][] = [['Nom', 'Email', 'XP', 'Leçons', 'Modules', 'Labs', 'Badges', 'Jeux joués', 'Examens', 'Dernière activité']];
    for (const m of members) {
      rows.push([
        m.name, m.email, m.summary.xp, m.summary.lessons, m.summary.modules, m.summary.labs, m.summary.badges, m.summary.games,
        Object.entries(m.summary.exams).map(([id, pct]) => `${id.replace('exam-', '')} ${pct} %`).join(', '),
        m.lastActive ? new Date(m.lastActive).toISOString().slice(0, 10) : '',
      ]);
    }
    download(`promo-${data.cohort.id}-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows), 'text/csv;charset=utf-8');
  };

  return (
    <>
      <PageHead eyebrow={<Link to="/enseignant">← Mes promos</Link>} title={data?.cohort.name ?? 'Promo'}>
        {data ? `Créée le ${fmtDate(data.cohort.createdAt)}.` : 'Chargement…'}
      </PageHead>

      {error && <Block className="tight"><p className="small" role="alert" style={{ color: 'var(--ko)' }}>{error}</p></Block>}

      {data && (
        <>
          <Block className="tight">
            <div className="row" style={{ justifyContent: 'space-between', gap: 24 }}>
              <div>
                <div className="label">Code d’inscription</div>
                <div className="row" style={{ marginTop: 8, gap: 10 }}>
                  <span className="mono" style={{ fontSize: '1.5rem', letterSpacing: '0.18em' }}>{data.cohort.code}</span>
                  <button className="btn xs" onClick={async () => { if (await copy(data.cohort.code)) { setCopied(true); window.setTimeout(() => setCopied(false), 1500); } }}><Copy size={13} /> {copied ? 'Copié' : 'Copier'}</button>
                  <button className="btn xs" onClick={regenerate}><RefreshCw size={13} /> Régénérer</button>
                </div>
              </div>
              <div className="kv" style={{ minWidth: 320, flex: '0 1 420px' }}>
                <div><span className="label">Étudiants</span><b>{data.members.length}</b></div>
                <div><span className="label">XP moyenne</span><b>{stats.avgXp}</b></div>
                <div><span className="label">Leçons (moy.)</span><b>{stats.avgLessons}<span className="dim"> %</span></b></div>
                <div><span className="label">Inactifs {INACTIVE_DAYS} j+</span><b>{stats.inactive}</b></div>
              </div>
            </div>
          </Block>

          <Block eyebrow="Suivi" title="Étudiants"
            action={
              <div className="row" style={{ gap: 10 }}>
                <select className="field" style={{ width: 'auto' }} value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Trier par">
                  <option value="activity">Activité récente</option>
                  <option value="name">Nom</option>
                  <option value="xp">XP</option>
                  <option value="lessons">Leçons validées</option>
                </select>
                <button className="btn sm" onClick={exportCsv} disabled={!data.members.length}><Download size={15} /> Export CSV</button>
              </div>
            }>
            {data.members.length === 0
              ? <p className="muted">Personne n’a encore rejoint cette promo. Donne le code ci-dessus à tes étudiants : ils le saisissent à l’inscription ou depuis leur profil.</p>
              : (
                <div className="tbl-wrap">
                  <table className="tbl">
                    <thead><tr><th>Étudiant</th><th>Niveau</th><th>Leçons</th><th>Modules</th><th>Jeux</th><th>Examens</th><th>Activité</th></tr></thead>
                    <tbody>
                      {members.map((m) => (
                        <tr key={m.id}>
                          <td>
                            <Link to={`/enseignant/${data.cohort.id}/${m.id}`} style={{ textDecoration: 'underline' }}><b>{m.name}</b></Link>
                            <div className="small dim" style={{ overflowWrap: 'anywhere' }}>{m.email}</div>
                          </td>
                          <td><span className="mono">{m.summary.xp} XP</span><div className="small dim">{levelFor(m.summary.xp).title}</div></td>
                          <td className="mono">{m.summary.lessons}<span className="dim">/{totalLessons}</span></td>
                          <td className="mono">{m.summary.modules}<span className="dim">/{modules.length}</span></td>
                          <td className="mono">{m.summary.games}</td>
                          <td>
                            {Object.keys(m.summary.exams).length === 0 ? <span className="dim">—</span> : (
                              <span className="chips">{Object.entries(m.summary.exams).map(([id, pct]) => <span key={id} className="chip">{id.replace('exam-', '')} · {pct} %</span>)}</span>
                            )}
                          </td>
                          <td className="small">{since(m.lastActive)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
          </Block>
        </>
      )}
    </>
  );
}

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Copy } from 'lucide-react';
import { Block, PageHead } from '../../components/ui';
import { api, messageOf } from '../../lib/api';
import { copy, fmtDate, type CohortItem } from '../../lib/teacher';

export default function Cohorts() {
  const [cohorts, setCohorts] = useState<CohortItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);

  const load = useCallback(async () => {
    try { setCohorts((await api<{ cohorts: CohortItem[] }>('/teacher/cohorts')).cohorts); } catch (e) { setError(messageOf(e)); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api('/teacher/cohorts', { method: 'POST', body: { name } });
      setName('');
      await load();
    } catch (err) { setError(messageOf(err)); } finally { setBusy(false); }
  };

  const copyCode = async (c: CohortItem) => {
    if (await copy(c.code)) { setCopied(c.id); window.setTimeout(() => setCopied(null), 1500); }
  };

  return (
    <>
      <PageHead eyebrow="Enseignant" title="Mes promos">
        Crée une promo, donne son code à tes étudiants, puis suis leur progression.
      </PageHead>

      <Block eyebrow="Promos" title={cohorts ? `${cohorts.length} promo${cohorts.length > 1 ? 's' : ''}` : 'Chargement…'}>
        {error && <p className="small" role="alert" style={{ color: 'var(--ko)' }}>{error}</p>}
        {cohorts && cohorts.length === 0 && <p className="muted">Aucune promo pour l’instant. Crée la première ci-dessous.</p>}
        {cohorts && cohorts.length > 0 && (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Promo</th><th>Code d’inscription</th><th>Étudiants</th><th>Créée le</th><th /></tr></thead>
              <tbody>
                {cohorts.map((c) => (
                  <tr key={c.id}>
                    <td><b>{c.name}</b></td>
                    <td>
                      <span className="mono" style={{ letterSpacing: '0.14em' }}>{c.code}</span>{' '}
                      <button className="btn xs ghost" onClick={() => copyCode(c)} aria-label={`Copier le code de ${c.name}`}><Copy size={13} /> {copied === c.id ? 'Copié' : 'Copier'}</button>
                    </td>
                    <td className="mono">{c.members}</td>
                    <td className="mono">{fmtDate(c.createdAt)}</td>
                    <td><Link className="btn xs" to={`/enseignant/${c.id}`}>Ouvrir</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Block>

      <Block eyebrow="Nouvelle promo" title="Créer une promo">
        <form onSubmit={create} className="row" style={{ gap: 10, maxWidth: 560 }}>
          <input className="field" style={{ flex: 1, minWidth: 220 }} placeholder="Ex. M2 Cybersécurité 2026" value={name} maxLength={80} required
            aria-label="Nom de la promo" onChange={(e) => setName(e.target.value)} />
          <button className="btn primary" type="submit" disabled={busy || !name.trim()}>Créer</button>
        </form>
        <p className="small dim" style={{ marginTop: 12 }}>Un code de 8 caractères est généré. Tu peux le régénérer si besoin : les étudiants déjà inscrits restent inscrits.</p>
      </Block>
    </>
  );
}

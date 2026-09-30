import { useRef, useState } from 'react';
import { Download, Lock, Upload } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Block, Difficulty, Orb, PageHead } from '../components/ui';
import { Identicon, Insignia } from '../components/Marks';
import { badgeDefs, levelFor, levels, useProgress } from '../store/progress';
import { csslpDomains, lessonKey, modules, pad2, totalLessons } from '../data/catalog';
import { availableGames, gameCategories } from '../data/games';
import { labs } from '../data/labs';

export default function Profile() {
  const { progress, setName, reset, importProgress } = useProgress();
  const [confirming, setConfirming] = useState(false);
  const [onlyPlayed, setOnlyPlayed] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const lvl = levelFor(progress.xp);
  const lessonsDone = Object.keys(progress.lessons).length;
  const nextBadge = badgeDefs.find((b) => !progress.badges.includes(b.id));

  // Couverture CSSLP : part des leçons validées, par domaine.
  const coverage = csslpDomains.map((d) => {
    const all = modules.flatMap((m) => m.lessons.filter((l) => l.csslp.includes(d.id)).map((l) => lessonKey(m.id, l.id)));
    const ok = all.filter((k) => progress.lessons[k]).length;
    return { ...d, total: all.length, ok, pct: all.length ? Math.round((ok / all.length) * 100) : 0 };
  });

  // Les scores : 29 ateliers en liste plate ne se lisent pas. On les range par
  // geste du métier — la même grille que la page Jeux — et on remonte d'abord
  // ce qui se joue : joués en tête, puis le reste, replié derrière un bouton.
  const joues = availableGames.filter((g) => progress.scores[g.id] !== undefined);
  const moyenne = joues.length
    ? Math.round(joues.reduce((s2, g) => s2 + progress.scores[g.id]!, 0) / joues.length)
    : null;
  const parCategorie = gameCategories
    .map((c) => {
      const list = availableGames
        .filter((g) => g.category === c.id)
        .sort((a, b) => (progress.scores[b.id] ?? -1) - (progress.scores[a.id] ?? -1));
      const ok = list.filter((g) => progress.scores[g.id] !== undefined);
      return {
        c,
        list,
        ok: ok.length,
        moy: ok.length ? Math.round(ok.reduce((s2, g) => s2 + progress.scores[g.id]!, 0) / ok.length) : null,
      };
    })
    .filter((x) => x.list.length > 0);

  const exportProgress = () => {
    const blob = new Blob([JSON.stringify(progress, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `appsec-academy-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onImport = async (file?: File) => {
    if (!file) return;
    const err = importProgress(await file.text());
    setMessage(err ? { ok: false, text: err } : { ok: true, text: 'Progression restaurée.' });
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <>
      <PageHead eyebrow="Mon espace" title="Progression & badges">
        Ta progression est enregistrée dans ce navigateur. Sur un parcours de cette taille, pense à l’exporter de temps en temps.
      </PageHead>

      <Block>
        <div className="grid g2">
          <div className="card raised pad-lg identity">
            <div className="row nowrap" style={{ gap: 20 }}>
              <Identicon name={progress.name} size={88} className="avatar-id" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <label className="label" htmlFor="profile-name" style={{ display: 'block' }}>Nom affiché</label>
                <input id="profile-name" className="field" style={{ marginTop: 8 }} placeholder="Ton nom" value={progress.name} onChange={(e) => setName(e.target.value)} />
              </div>
            </div>
            <div style={{ marginTop: 32 }}>
              <div className="row between" style={{ alignItems: 'flex-end' }}>
                <div>
                  <span className="label">Niveau {lvl.index}</span>
                  <div className="level-title">{lvl.title}</div>
                </div>
                <span className="mono small"><b>{progress.xp}</b> XP</span>
              </div>
              <div className="meter lg" style={{ marginTop: 14 }}><div style={{ width: `${lvl.pct}%` }} /></div>
              <div className="small dim" style={{ marginTop: 10 }}>{lvl.next ? `${lvl.next.min - progress.xp} XP avant « ${lvl.next.title} »` : 'Niveau maximum atteint !'}</div>
            </div>
            {nextBadge && (
              <div className="next-goal">
                <Insignia icon={nextBadge.icon} earned={false} />
                <div>
                  <span className="label">Prochain badge</span>
                  <div style={{ fontWeight: 500, marginTop: 4 }}>{nextBadge.name}</div>
                  <div className="small dim">{nextBadge.description}</div>
                </div>
              </div>
            )}
            <div className="levels">
              {levels.map((l, k) => (
                <div key={l.title} className={k < lvl.index ? 'on' : ''}>
                  <i />
                  <span>{l.title}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card pad-lg">
            <div className="label">Statistiques</div>
            <div className="kv" style={{ marginTop: 16 }}>
              <div><span className="label">Leçons</span><b>{lessonsDone}<span className="dim">/{totalLessons}</span></b></div>
              <div><span className="label">Modules</span><b>{progress.modules.length}<span className="dim">/{modules.length}</span></b></div>
              <div><span className="label">Labs</span><b>{progress.labs.length}<span className="dim">/{labs.length}</span></b></div>
              <div><span className="label">Badges</span><b>{progress.badges.length}<span className="dim">/{badgeDefs.length}</span></b></div>
              <div><span className="label">Ateliers joués</span><b>{joues.length}<span className="dim">/{availableGames.length}</span></b></div>
              <div><span className="label">Score moyen</span><b>{moyenne !== null ? <>{moyenne}<span className="dim"> %</span></> : <span className="dim">—</span>}</b></div>
            </div>
            <div className="section-title">Couverture CSSLP</div>
            <div className="scores">
              {coverage.map((d) => (
                <div key={d.id} title={`${d.name} · poids ${d.weight} %`}>
                  <span className="small"><span className="mono">{d.id}</span> {d.name.replace('Secure Software ', '')}</span>
                  <span className="progress"><div style={{ width: `${d.pct}%` }} /></span>
                  <span className="mono small dim">{d.ok}/{d.total}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Block>

      <Block
        eyebrow="Entraînement"
        title="Meilleurs scores"
        lead={joues.length
          ? `${joues.length} atelier${joues.length > 1 ? 's' : ''} sur ${availableGames.length} joué${joues.length > 1 ? 's' : ''}, ${moyenne} % de moyenne. Seul le record compte : rejouer ne fait jamais baisser un score.`
          : `${availableGames.length} ateliers t’attendent, rangés par geste du métier. Seul le record compte : rejouer ne fait jamais baisser un score.`}
        action={joues.length > 0 && (
          <button className="btn sm" onClick={() => setOnlyPlayed((v) => !v)}>
            {onlyPlayed ? 'Afficher tous les ateliers' : 'Afficher seulement les ateliers joués'}
          </button>
        )}
      >
        <div className="grid g3">
          {parCategorie.map(({ c, list, ok, moy }) => {
            const shown = onlyPlayed ? list.filter((g) => progress.scores[g.id] !== undefined) : list;
            if (!shown.length) return null;
            return (
              <div key={c.id} className="card pad-sm score-group">
                <div className="sg-head">
                  <Orb palette={c.palette} xs still />
                  <span className="sg-title">{c.title}</span>
                  <span className="mono small dim">{ok}/{list.length}</span>
                </div>
                <div className="sg-meter"><span style={{ width: `${Math.round((ok / list.length) * 100)}%` }} /></div>
                <div className="sg-rows">
                  {shown.map((g) => {
                    const v = progress.scores[g.id];
                    return (
                      <Link key={g.id} to={`/jeux/${g.id}`} className={`sg-row ${v === undefined ? 'off' : ''}`} title={`${g.title} · ${g.time} · ${g.xp} XP`}>
                        <span className="sg-row-title">{g.title}</span>
                        <Difficulty level={g.level} label={false} />
                        <span className="progress"><div style={{ width: `${v ?? 0}%` }} /></span>
                        <span className={`mono small sg-val ${v === undefined ? 'dim' : ''}`}>{v !== undefined ? `${v}%` : '—'}</span>
                      </Link>
                    );
                  })}
                </div>
                <div className="sg-foot small dim">{moy !== null ? `Moyenne ${moy} %` : 'Aucun atelier joué'}</div>
              </div>
            );
          })}
        </div>
      </Block>

      {(() => {
        // La progression mesurée : l'écart entre le diagnostic d'entrée et celui
        // de sortie. On n'affiche que les modules réellement commencés — une
        // ligne vide ne dit rien et allongerait un tableau de vingt lignes.
        const mesures = modules
          .map((m) => ({ m, cp: progress.checkpoints[m.id] }))
          .filter((x) => x.cp && x.cp.avant !== undefined);
        const complets = mesures.filter((x) => x.cp!.apres !== undefined);
        const ecartMoyen = complets.length
          ? Math.round(complets.reduce((s2, x) => s2 + (x.cp!.apres! - x.cp!.avant!), 0) / complets.length)
          : null;

        return (
          <Block
            eyebrow="Mesure"
            title="Progression par module"
            lead={mesures.length
              ? `${mesures.length} module${mesures.length > 1 ? 's' : ''} diagnostiqué${mesures.length > 1 ? 's' : ''}${
                  ecartMoyen !== null ? `, ${ecartMoyen >= 0 ? '+' : ''}${ecartMoyen} points d’écart moyen entre l’entrée et la sortie` : ''
                }.`
              : 'Chaque module propose le même questionnaire avant et après. L’écart entre les deux est la seule mesure de ce que le parcours a changé — aucune XP n’est en jeu, pour que la mesure reste honnête.'}
          >
            {mesures.length > 0 && (
              <div className="cp-table">
                {mesures.map(({ m, cp }) => {
                  const ecart = cp!.apres !== undefined ? cp!.apres - cp!.avant! : null;
                  return (
                    <div key={m.id} className="cp-row">
                      <span className="mono small dim">{pad2(m.num)}</span>
                      <span className="cp-row-title">{m.title}</span>
                      <span className="cp-bar">
                        <span className="cp-bar-track"><span className="cp-bar-avant" style={{ width: `${cp!.avant}%` }} /></span>
                        <span className="cp-bar-track"><span className="cp-bar-apres" style={{ width: `${cp!.apres ?? 0}%` }} /></span>
                      </span>
                      <span className="mono small cp-row-nums">
                        {cp!.avant} %{cp!.apres !== undefined ? ` → ${cp!.apres} %` : ''}
                      </span>
                      <span className={`mono small cp-row-delta ${ecart === null ? 'dim' : ecart > 0 ? 'up' : ecart < 0 ? 'down' : ''}`}>
                        {ecart === null ? 'en cours' : `${ecart > 0 ? '+' : ''}${ecart}`}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </Block>
        );
      })()}

      <Block eyebrow="Collection" title="Badges" lead={`${progress.badges.length} débloqué${progress.badges.length > 1 ? 's' : ''} sur ${badgeDefs.length}. Chaque badge rapporte 50 XP.`}>
        <div className="grid g4">
          {badgeDefs.map((b, k) => {
            const got = progress.badges.includes(b.id);
            return (
              <div key={b.id} className={`card badge-tile ${got ? '' : 'locked'}`}>
                {!got && <Lock size={14} className="lock-dot" aria-label="verrouillé" />}
                <span className="label badge-code">B-{String(k + 1).padStart(2, '0')}</span>
                <Insignia icon={b.icon} earned={got} />
                <b>{b.name}</b>
                <div className="small dim">{b.description}</div>
              </div>
            );
          })}
        </div>
      </Block>

      <Block eyebrow="Sauvegarde" title="Exporter ou restaurer" lead="Un fichier JSON avec toute ta progression. Utile pour changer de navigateur ou de machine.">
        <div className="row" style={{ gap: 12 }}>
          <button className="btn" onClick={exportProgress}><Download size={16} /> Exporter ma progression</button>
          <button className="btn" onClick={() => fileRef.current?.click()}><Upload size={16} /> Restaurer une sauvegarde</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => onImport(e.target.files?.[0])} />
        </div>
        {message && <p className={`small ${message.ok ? '' : 'ko'}`} style={{ marginTop: 14, color: message.ok ? 'var(--ok)' : 'var(--ko)' }}>{message.text}</p>}
      </Block>

      <Block className="tight">
        <div className="complete">
          <div>
            <div className="label">Zone sensible</div>
            <div style={{ fontWeight: 500, marginTop: 6 }}>Réinitialiser ma progression</div>
            <div className="small dim">Efface XP, leçons, labs, badges et scores de ce navigateur.</div>
          </div>
          {confirming
            ? <div className="row"><button className="btn sm" onClick={() => setConfirming(false)}>Annuler</button><button className="btn sm danger" onClick={() => { reset(); setConfirming(false); }}>Confirmer l’effacement</button></div>
            : <button className="btn sm" onClick={() => setConfirming(true)}>Réinitialiser</button>}
        </div>
      </Block>
    </>
  );
}

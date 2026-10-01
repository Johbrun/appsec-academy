import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Check } from 'lucide-react';
import { Block, Icon, Orb, PageHead } from '../components/ui';
import { useProgress } from '../store/progress';
import { blocks, formatDuration, lessonKey, moduleMinutes, modules, pad2, totalLessons } from '../data/catalog';
import { writtenLessons } from '../lib/content';

export default function Parcours() {
  const { progress } = useProgress();
  const { hash } = useLocation();
  const total = modules.reduce((s, m) => s + moduleMinutes(m), 0);

  useEffect(() => {
    if (!hash) return;
    const el = document.getElementById(hash.slice(1));
    if (el) window.setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  }, [hash]);

  return (
    <>
      <PageHead eyebrow="Parcours" title="Du finding au programme, au rythme du cycle"
        aside={(
          <div className="row" style={{ gap: 28, marginTop: 24 }}>
            <div><span className="label">Leçons</span><div className="big-num" style={{ fontSize: '2.25rem' }}>{Object.keys(progress.lessons).length}<span className="dim" style={{ fontSize: '1.25rem' }}>/{totalLessons}</span></div></div>
            <div><span className="label">Lecture</span><div className="big-num" style={{ fontSize: '2.25rem' }}>{Math.round(total / 60)} h</div></div>
          </div>
        )}>
        Ordre conseillé : A et B pour le socle, puis C à F dans l’ordre du cycle de développement, H pour finir ; le bloc IA se lit en parallèle dès le bloc C. Tout reste accessible : commence où tu veux.
      </PageHead>

      {blocks.map((b) => {
        const mods = modules.filter((m) => m.block === b.id);
        return (
          <Block key={b.id} eyebrow={b.id === 'Z' ? 'Capstone' : `Bloc ${b.id}`} title={b.title} lead={b.text}>
            <span id={`bloc-${b.id}`} className="scroll-anchor" />
            <div className="grid g3">
              {mods.map((m) => {
                const ok = m.lessons.filter((l) => progress.lessons[lessonKey(m.id, l.id)]).length;
                const written = writtenLessons(m.id).length;
                const validated = progress.modules.includes(m.id);
                const levels = [1, 2, 3].map((lv) => m.lessons.filter((l) => l.level === lv).length);
                return (
                  <Link key={m.id} to={`/modules/${m.id}`} className="card module-card hud">
                    <div className="row between">
                      <span className="tile menu-tile"><Icon name={m.icon} size={18} /><Orb palette={m.palette} xs className="menu-px" /></span>
                      <span className="label">{validated ? <><Check size={12} style={{ display: 'inline', verticalAlign: '-1px' }} /> Validé</> : `M${pad2(m.num)} · ${formatDuration(moduleMinutes(m))}`}</span>
                    </div>
                    <div>
                      <h3>{m.title}</h3>
                      <p className="small dim">{m.summary}</p>
                    </div>
                    <div className="module-foot">
                      <div className="lv-split" title="Répartition des leçons par niveau">
                        {levels.map((n, k) => n > 0 && <span key={k} className={`lv lv${k + 1}`} style={{ flex: n }}>N{k + 1} · {n}</span>)}
                      </div>
                      <div className="row between small">
                        <span className="dim">{ok}/{m.lessons.length} leçons validées</span>
                        <span className="mono dim">{written === m.lessons.length ? 'En ligne' : written ? `${written} en ligne` : 'En rédaction'}</span>
                      </div>
                      <div className="progress"><div style={{ width: `${(ok / m.lessons.length) * 100}%` }} /></div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </Block>
        );
      })}
    </>
  );
}

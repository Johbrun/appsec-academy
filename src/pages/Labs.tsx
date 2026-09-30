import { useState } from 'react';
import { ArrowUpRight, Check } from 'lucide-react';
import { Block, PageHead } from '../components/ui';
import { useProgress } from '../store/progress';
import { labs, type LabDef } from '../data/labs';
import { moduleById, pad2 } from '../data/catalog';

const groups: { kind: LabDef['kind']; title: string; lead: string }[] = [
  { kind: 'portswigger', title: 'Web Security Academy', lead: 'Vise les labs Practitioner et Expert : les Apprentice sont des bases que tu maîtrises déjà. Coche un sujet quand ses labs sont faits, en répondant à la question AppSec associée.' },
  { kind: 'app', title: 'Applications volontairement vulnérables', lead: 'À lancer en local, pour s’entraîner à corriger autant qu’à exploiter.' },
  { kind: 'cloud', title: 'Cloud, IaC et détection', lead: 'Des scénarios AWS et Kubernetes, à mener dans un compte de test dédié.' },
  { kind: 'ai', title: 'Sécurité de l’IA', lead: 'Prompt injection, agents et outils.' },
  { kind: 'course', title: 'Cours et ressources pratiques', lead: 'Pour aller plus loin sur l’analyse de code et la supply chain.' },
];

export default function Labs() {
  const { progress, toggleLab } = useProgress();
  const [filter, setFilter] = useState<'all' | 'todo' | 'done'>('all');
  const visible = (l: LabDef) => filter === 'all' || (filter === 'done') === progress.labs.includes(l.id);

  return (
    <>
      <PageHead eyebrow="Pratique" title="Labs reconnus"
        aside={(
          <div className="row" style={{ gap: 28, marginTop: 24 }}>
            <div><span className="label">Faits</span><div className="big-num" style={{ fontSize: '2.25rem' }}>{progress.labs.length}<span className="dim" style={{ fontSize: '1.25rem' }}>/{labs.length}</span></div></div>
            <div><span className="label">Récompense</span><div className="big-num" style={{ fontSize: '2.25rem' }}>+10</div></div>
          </div>
        )}>
        La pratique s’appuie sur des labs reconnus plutôt que sur un environnement maison. Chaque lab coché rapporte 10 XP.
      </PageHead>

      <Block className="tight">
        <div className="seg" role="tablist" aria-label="Filtrer les labs">
          {(['all', 'todo', 'done'] as const).map((f) => (
            <button key={f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>{f === 'all' ? 'Tous' : f === 'todo' ? 'À faire' : 'Faits'}</button>
          ))}
        </div>
      </Block>

      {groups.map((g) => {
        const items = labs.filter((l) => l.kind === g.kind && visible(l));
        if (!items.length) return null;
        return (
          <Block key={g.kind} eyebrow={g.kind === 'portswigger' ? 'PortSwigger' : 'Labs'} title={g.title} lead={g.lead}>
            <div className="lab-table">
              {items.map((l) => {
                const done = progress.labs.includes(l.id);
                return (
                  <div key={l.id} className={`lab-line ${done ? 'done' : ''}`}>
                    <button className={`lab-tick ${done ? 'on' : ''}`} onClick={() => toggleLab(l.id)} aria-pressed={done} aria-label={done ? `Décocher ${l.title}` : `Cocher ${l.title}`}>
                      {done && <Check size={14} />}
                    </button>
                    <div className="lab-line-main">
                      <a href={l.url} target="_blank" rel="noreferrer" className="lab-title">{l.title} <ArrowUpRight size={14} /></a>
                      <span className="small dim">{l.text}</span>
                    </div>
                    <span className="mono small dim lab-mods">{l.modules.map((id) => `M${pad2(moduleById(id)?.num ?? 0)}`).join(' · ')}</span>
                  </div>
                );
              })}
            </div>
          </Block>
        );
      })}
    </>
  );
}

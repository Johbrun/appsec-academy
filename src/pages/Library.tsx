import { ArrowUpRight } from 'lucide-react';
import { Block, PageHead } from '../components/ui';
import { library } from '../data/library';
import { moduleById, pad2 } from '../data/catalog';

export default function Library() {
  const count = library.reduce((s, g) => s + g.items.length, 0);
  return (
    <>
      <PageHead eyebrow="Ressources" title="Bibliothèque">
        {count} sources primaires, livres et flux de veille qui fondent le parcours. Chaque leçon cite les siennes en fin de page.
      </PageHead>
      {library.map((g) => (
        <Block key={g.id} eyebrow={`${g.items.length} entrées`} title={g.title} lead={g.lead}>
          <div className="lab-table">
            {g.items.map((s) => (
              <div key={s.title} className="lab-line">
                <div className="lab-line-main">
                  {s.url
                    ? <a href={s.url} target="_blank" rel="noreferrer" className="lab-title">{s.title} <ArrowUpRight size={14} /></a>
                    : <span className="lab-title">{s.title}</span>}
                  {s.note && <span className="small dim">{s.note}</span>}
                </div>
                <span className="mono small dim lab-mods">{(s.modules ?? []).map((id) => `M${pad2(moduleById(id)?.num ?? 0)}`).join(' · ')}</span>
              </div>
            ))}
          </div>
        </Block>
      ))}
    </>
  );
}

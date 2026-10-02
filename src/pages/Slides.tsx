import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Block, Orb, PageHead } from '../components/ui';
import { blocks, modules, pad2, type ModuleMeta } from '../data/catalog';
import { hasDeck } from '../lib/slides';

function DeckCard({ m }: { m: ModuleMeta }) {
  if (!hasDeck(m.id)) {
    return (
      <div className="bento-card span-4 deck-card off">
        <div className="bento-top">
          <Orb palette={m.palette} className="deck-orb fine" still />
          <span className="label">En préparation</span>
        </div>
        <div className="bento-text">
          <span className="label">Module {pad2(m.num)}</span>
          <h3 style={{ marginTop: 8 }}>{m.title}</h3>
          <p className="dim">{m.lessons.length} séquences</p>
        </div>
      </div>
    );
  }
  return (
    <div className="bento-card span-4 hud deck-card">
      <div className="bento-top">
        <Orb palette={m.palette} className="deck-orb fine" />
        <Link to={`/slides/${m.id}`} className="btn sm primary">Ouvrir <ArrowRight size={14} className="arrow" /></Link>
      </div>
      <div className="bento-text">
        <span className="label">Module {pad2(m.num)} · {m.lessons.length} séquences</span>
        <h3 style={{ marginTop: 8 }}><Link to={`/slides/${m.id}`}>{m.title}</Link></h3>
        <ul className="deck-lessons">
          {m.lessons.map((l, k) => (
            <li key={l.id}>
              <Link to={`/slides/${m.id}?l=${l.id}`}><span className="mono">{pad2(k + 1)}</span>{l.title}</Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function Slides() {
  const ready = modules.filter((m) => hasDeck(m.id)).length;
  return (
    <>
      <PageHead eyebrow="Animer" title="Supports de formation"
        aside={(
          <div className="deck-keys small dim mt">
            <span><kbd>←</kbd><kbd>→</kbd>naviguer</span>
            <span><kbd>G</kbd>vue d’ensemble</span>
            <span><kbd>N</kbd>notes</span>
            <span><kbd>F</kbd>plein écran</span>
          </div>
        )}>
        Les leçons de chaque module reprises en slides pour une séance animée : schémas, tableaux, cas réels et notes du formateur.
        {' '}{ready > 1 ? `${ready} modules disponibles` : ready === 1 ? 'Un module disponible' : 'Aucun module disponible'} pour l’instant ; le texte des leçons reste la référence.
      </PageHead>

      {blocks.map((b) => {
        const mods = modules.filter((m) => m.block === b.id);
        if (!mods.length) return null;
        return (
          <Block key={b.id} eyebrow={b.id === 'Z' ? 'Capstone' : `Bloc ${b.id}`} title={b.title} lead={b.text}>
            <div className="bento">
              {mods.map((m) => <DeckCard key={m.id} m={m} />)}
            </div>
          </Block>
        );
      })}
    </>
  );
}

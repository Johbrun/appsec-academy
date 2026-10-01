import { useMemo, useState } from 'react';
import { Check, RotateCw, X } from 'lucide-react';
import { GameHeader, Orb } from '../components/ui';
import { SeriesGame, SeriesScore, type SeriesPlay } from '../components/Series';
import { cardSeries, cards, type Card } from '../data/game-cards';
import { moduleById, pad2 } from '../data/catalog';
import { dominantLevel, seededShuffle, type SeriesInfo, type SeriesSet } from '../lib/series';
import { isDue, useProgress, type Progress } from '../store/progress';

const MAX_DUE = 20;
const DAILY = 'revision';

/**
 * Les cartes dues aujourd'hui, tous paquets confondus. Seules comptent les
 * cartes des modules commencés ; à défaut, tout le pool.
 */
function dueCards(progress: Progress): Card[] {
  const started = new Set(Object.keys(progress.lessons).map((k) => k.split('-')[0]));
  const pool = cards.filter((c) => started.size === 0 || started.has(c.module));
  return seededShuffle(pool.filter((c) => isDue(progress.leitner[c.id])), Date.now()).slice(0, MAX_DUE);
}

/**
 * Ajoute la « Révision du jour » en tête des paquets. Elle dépend de la
 * progression, donc elle ne peut pas vivre dans le fichier de données : on la
 * compose ici, figée jusqu'au prochain retour à l'écran de choix.
 */
function withDaily(set: SeriesSet<Card>, due: Card[]): SeriesSet<Card> {
  if (!due.length) return set;
  const daily: SeriesInfo = {
    id: DAILY,
    title: 'Révision du jour',
    text: 'Les cartes dues aujourd’hui, tous paquets confondus. Les ratées reviennent demain ; les autres s’espacent.',
    level: dominantLevel(due),
    count: due.length,
    shuffleEachTime: false,
  };
  return {
    list: [daily, ...set.list],
    items: (id, salt) => (id === DAILY ? due : set.items(id, salt)),
  };
}

export default function Flashcards() {
  const { progress } = useProgress();
  // La file du jour est recalculée à chaque retour au choix des paquets, pas à
  // chaque carte répondue : sinon elle se viderait en cours de session.
  const [version, setVersion] = useState(0);
  const due = useMemo(() => dueCards(progress), [version]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = useMemo(() => withDaily(cardSeries, due), [due]);

  return (
    <SeriesGame
      gameId="flashcards"
      title="Flashcards espacées"
      set={set}
      unit={(n) => (n > 1 ? 'cartes' : 'carte')}
      intro={due.length
        ? 'Dix paquets thématiques, un par bloc du parcours, et deux paquets transverses. Chaque carte répondue alimente la répétition espacée ; la révision du jour rassemble celles qui sont dues.'
        : 'Rien à réviser aujourd’hui : toutes tes cartes sont planifiées pour plus tard. Choisis un paquet ; les cartes déjà planifiées ne changent pas de boîte.'}
    >
      {(play) => <Round play={{ ...play, back: () => { setVersion((v) => v + 1); play.back(); } }} />}
    </SeriesGame>
  );
}

function Round({ play }: { play: SeriesPlay<Card> }) {
  const { progress, reviewCard } = useProgress();
  const deck = play.items;
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState(0);
  const [done, setDone] = useState(false);

  if (done) {
    const pct = Math.round((known / deck.length) * 100);
    return (
      <SeriesScore play={play} pct={pct} title={`${known} carte${known > 1 ? 's' : ''} maîtrisée${known > 1 ? 's' : ''} sur ${deck.length}`}>
        <p className="small dim">Les cartes ratées reviennent demain ; les autres s’espacent de 1, 2, 4, 8 puis 16 jours.</p>
      </SeriesScore>
    );
  }

  const card = deck[i];
  const mod = moduleById(card.module);
  const box = progress.leitner[card.id]?.box ?? 0;

  const answer = (ok: boolean) => {
    // Seule une carte due change de boîte : réviser en avance ne doit pas
    // repousser une carte qui n'a pas encore été oubliée.
    if (isDue(progress.leitner[card.id])) reviewCard(card.id, ok);
    const nk = known + (ok ? 1 : 0);
    setKnown(nk);
    setFlipped(false);
    if (i + 1 >= deck.length) {
      play.finish(Math.round((nk / deck.length) * 100));
      setDone(true);
    } else setTimeout(() => setI(i + 1), 150);
  };

  return (
    <section className="block">
      <div className="game-wrap">
        <GameHeader id="flashcards" title={`Flashcards · ${play.info.title}`} level={play.info.level} current={i} total={deck.length}
          extra={<span className="tag mono">Boîte {box || 'nouvelle'}</span>} />
        <div className={`flip ${flipped ? 'flipped' : ''}`} onClick={() => setFlipped(!flipped)} role="button" tabIndex={0}
          aria-label={flipped ? 'Revenir au recto' : 'Retourner la carte'}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setFlipped(!flipped); } }}>
          <div className="flip-inner">
            <div className="flip-face flip-front" aria-hidden={flipped}>
              <Orb palette={mod?.palette ?? 'dawn'} className="coarse" />
              <span className="tag id">M{pad2(mod?.num ?? 0)} · {mod?.short}</span>
              {/* Les cartes de mise en situation ont un recto plus long : on élargit la
                  colonne et on réduit le corps pour qu'il tienne sur la face. */}
              <h2 style={card.front.length > 72 ? { maxWidth: '34ch', fontSize: '1.4rem' } : { maxWidth: '26ch' }}>{card.front}</h2>
              <div className="label" style={{ marginTop: 28, display: 'inline-flex', alignItems: 'center', gap: 8 }}><RotateCw size={12} /> Réponds de tête, puis retourne la carte</div>
            </div>
            <div className="flip-face flip-back" aria-hidden={!flipped}>
              <span className="label">Réponse</span>
              <p className="lead" style={{ marginTop: 14 }}>{card.back}</p>
            </div>
          </div>
        </div>
        <div className="actions center">
          <button className="btn" disabled={!flipped} onClick={() => answer(false)}><X size={16} /> À revoir</button>
          <button className="btn primary" disabled={!flipped} onClick={() => answer(true)}><Check size={16} /> Je savais</button>
        </div>
        <p className="center small dim" style={{ marginTop: 20 }}>Sois honnête : c’est ta mémoire que tu entraînes.</p>
      </div>
    </section>
  );
}

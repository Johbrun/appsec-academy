import { useMemo, useState } from 'react';
import { Check, RotateCw, X } from 'lucide-react';
import { GameHeader, Orb, ScoreScreen, shuffle } from '../components/ui';
import { cards, type Card } from '../data/game-cards';
import { moduleById, pad2 } from '../data/catalog';
import { isDue, useProgress } from '../store/progress';

const MAX_DUE = 20;
const FREE = 12;

export default function Flashcards() {
  const { progress, reviewCard, recordScore } = useProgress();
  const [seed, setSeed] = useState(0);
  const [free, setFree] = useState(false);

  // Cartes des modules commencés ; à défaut, tout le paquet disponible.
  const started = new Set(Object.keys(progress.lessons).map((k) => k.split('-')[0]));
  const pool = cards.filter((c) => started.size === 0 || started.has(c.module));

  const deck = useMemo<Card[]>(() => {
    if (free) return shuffle(pool).slice(0, FREE);
    return shuffle(pool.filter((c) => isDue(progress.leitner[c.id]))).slice(0, MAX_DUE);
    // La session est figée à son démarrage.
  }, [seed, free]);

  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState(0);
  const [done, setDone] = useState(false);

  const restart = (asFree = free) => { setFree(asFree); setSeed(seed + 1); setI(0); setKnown(0); setDone(false); setFlipped(false); };

  if (deck.length === 0) {
    return (
      <section className="block">
        <div className="game-wrap">
          <GameHeader id="flashcards" title="Flashcards espacées" current={0} total={1} />
          <div className="card q-card center">
            <h3>Rien à réviser aujourd’hui</h3>
            <p className="muted" style={{ marginTop: 10 }}>Toutes tes cartes sont planifiées pour plus tard. La répétition espacée fonctionne mieux si tu reviens demain.</p>
            <div className="actions center"><button className="btn primary" onClick={() => restart(true)}>Session libre de {FREE} cartes</button></div>
          </div>
        </div>
      </section>
    );
  }

  if (done) {
    const pct = Math.round((known / deck.length) * 100);
    return (
      <section className="block">
        <ScoreScreen pct={pct} title={`${known} carte${known > 1 ? 's' : ''} maîtrisée${known > 1 ? 's' : ''} sur ${deck.length}`} onRetry={() => restart()}>
          <p className="small dim">Les cartes ratées reviennent demain ; les autres s’espacent de 1, 2, 4, 8 puis 16 jours.</p>
        </ScoreScreen>
      </section>
    );
  }

  const card = deck[i];
  const mod = moduleById(card.module);
  const box = progress.leitner[card.id]?.box ?? 0;

  const answer = (ok: boolean) => {
    if (!free) reviewCard(card.id, ok);
    const nk = known + (ok ? 1 : 0);
    setKnown(nk);
    setFlipped(false);
    if (i + 1 >= deck.length) {
      setDone(true);
      recordScore('flashcards', Math.round((nk / deck.length) * 100));
    } else setTimeout(() => setI(i + 1), 150);
  };

  return (
    <section className="block">
      <div className="game-wrap">
        <GameHeader id="flashcards" title={free ? 'Flashcards · session libre' : 'Flashcards · révision du jour'} current={i} total={deck.length}
          extra={!free && <span className="tag mono">Boîte {box || 'nouvelle'}</span>} />
        <div className={`flip ${flipped ? 'flipped' : ''}`} onClick={() => setFlipped(!flipped)} role="button" tabIndex={0}
          aria-label={flipped ? 'Revenir au recto' : 'Retourner la carte'}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setFlipped(!flipped); } }}>
          <div className="flip-inner">
            <div className="flip-face flip-front" aria-hidden={flipped}>
              <Orb palette={mod?.palette ?? 'dawn'} className="coarse" />
              <span className="tag id">M{pad2(mod?.num ?? 0)} · {mod?.short}</span>
              <h2 style={{ maxWidth: '26ch' }}>{card.front}</h2>
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

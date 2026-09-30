import { useMemo, useState } from 'react';
import { ArrowRight, Check, Lock, RotateCcw } from 'lucide-react';
import { shuffle } from './ui';
import { checkpoints } from '../data/checkpoints';
import { useProgress } from '../store/progress';

type Phase = 'avant' | 'apres';

const titres: Record<Phase, string> = {
  avant: 'Diagnostic d’entrée',
  apres: 'Diagnostic de sortie',
};

/**
 * Le même questionnaire, avant d'ouvrir le module et après l'avoir validé.
 *
 * Ce qui compte n'est pas la note mais l'écart : c'est pour cela qu'aucune XP
 * n'est en jeu, et que le score d'entrée est gelé au premier passage. Un
 * apprenant qui refait le diagnostic d'entrée après avoir lu trois leçons
 * effacerait la seule mesure qui donne du sens à celle de sortie.
 */
export default function Checkpoint({ moduleId, phase, deverrouille }: {
  moduleId: string;
  phase: Phase;
  /** Le diagnostic de sortie n'a de sens qu'une fois le module travaillé. */
  deverrouille?: boolean;
}) {
  const { progress, recordCheckpoint } = useProgress();
  const questions = checkpoints[moduleId];
  const etat = progress.checkpoints[moduleId] ?? {};
  const score = etat[phase];

  const [ouvert, setOuvert] = useState(false);
  const [picked, setPicked] = useState<(number | null)[]>([]);
  const [rendu, setRendu] = useState(false);
  const [seed, setSeed] = useState(0);

  // L'ordre des options est retiré à chaque passage : la bonne ne doit pas se
  // retrouver à la même place au second, sinon on mesure la mémoire du rang.
  const ordres = useMemo(
    () => (questions ?? []).map((q) => shuffle(q.options.map((_, i) => i))),
    [questions, seed],
  );

  if (!questions?.length) return null;

  const verrouille = phase === 'apres' && !deverrouille && score === undefined;

  const demarrer = () => {
    setPicked(questions.map(() => null));
    setRendu(false);
    setSeed((s) => s + 1);
    setOuvert(true);
  };

  const valider = () => {
    const bons = picked.filter((p, k) => p === questions[k].answer).length;
    const pct = Math.round((bons / questions.length) * 100);
    recordCheckpoint(moduleId, phase, pct);
    setRendu(true);
  };

  const bons = picked.filter((p, k) => p === questions[k].answer).length;
  const pct = Math.round((bons / questions.length) * 100);
  const complet = picked.length === questions.length && picked.every((p) => p !== null);

  // ── L'écart, seule chose que le dispositif cherche à produire ─────────────
  const ecart = phase === 'apres' && etat.avant !== undefined && etat.apres !== undefined
    ? etat.apres - etat.avant
    : null;

  return (
    <div className={`checkpoint ${phase}`}>
      <div className="row between cp-head">
        <div>
          <span className="label">{titres[phase]}</span>
          <p className="m0 dim small">
            {phase === 'avant'
              ? 'Cinq questions, avant d’ouvrir la première leçon. Elles ne rapportent aucune XP : elles servent de point de départ, et le score reste figé.'
              : 'Les mêmes cinq questions, une fois le module validé. C’est l’écart entre les deux qui dit ce que le module a changé.'}
          </p>
        </div>
        {score !== undefined && (
          <div className="cp-score">
            <b className="mono">{score} %</b>
            {ecart !== null && (
              <span className={`cp-delta ${ecart > 0 ? 'up' : ecart < 0 ? 'down' : ''}`}>
                {ecart > 0 ? `+${ecart}` : ecart} pts
              </span>
            )}
          </div>
        )}
      </div>

      {verrouille && (
        <p className="small dim cp-lock"><Lock size={13} /> Se débloque quand toutes les leçons du module sont validées.</p>
      )}

      {!ouvert && !verrouille && (
        <button className={`btn ${score === undefined ? 'primary' : ''}`} onClick={demarrer}>
          {score === undefined ? 'Commencer' : <><RotateCcw size={14} /> Refaire</>}
          {score === undefined && <ArrowRight size={16} className="arrow" />}
        </button>
      )}

      {score !== undefined && !ouvert && phase === 'avant' && (
        <p className="small dim m0">Le score d’entrée reste celui du premier passage — refaire le questionnaire ne le modifie pas.</p>
      )}

      {ouvert && (
        <div className="cp-quiz">
          {questions.map((q, k) => (
            <div key={k} className="quiz-q">
              <p className="quiz-title">{k + 1}. {q.q}</p>
              <div className="grid" style={{ gap: 8 }}>
                {ordres[k].map((j, pos) => {
                  const choisi = picked[k] === j;
                  const cls = !rendu
                    ? (choisi ? 'selected' : '')
                    : j === q.answer ? 'correct' : choisi ? 'wrong' : '';
                  return (
                    <button
                      key={j} className={`option ${cls}`} disabled={rendu}
                      onClick={() => setPicked((p) => p.map((x, i) => (i === k ? j : x)))}
                    >
                      <span className="key">{String.fromCharCode(65 + pos)}</span>
                      <span>{q.options[j]}</span>
                    </button>
                  );
                })}
              </div>
              {rendu && <p className="small muted cp-explain">{q.explain}</p>}
            </div>
          ))}

          <div className="actions between">
            {rendu
              ? <span className="small dim"><Check size={14} /> {bons} / {questions.length} — {pct} %</span>
              : <span className="small dim">{picked.filter((p) => p !== null).length} / {questions.length} répondues</span>}
            {rendu
              ? <button className="btn" onClick={() => setOuvert(false)}>Fermer</button>
              : <button className="btn primary" disabled={!complet} onClick={valider}>Valider <ArrowRight size={16} className="arrow" /></button>}
          </div>
        </div>
      )}
    </div>
  );
}

import { Link } from 'react-router-dom';
import { Check, Lock, Printer } from 'lucide-react';
import { PageHead } from '../components/ui';
import { Seal } from '../components/Marks';
import { useProgress, levelFor, badgeDefs } from '../store/progress';
import { totalLessons } from '../data/catalog';
import { openModules } from '../lib/content';

// Conditions d'obtention du certificat.
const requirements = [
  { id: 'modules', label: 'Valider tous les modules ouverts du parcours', check: (p: ReturnType<typeof useProgress>['progress']) => openModules().every((m) => p.modules.includes(m.id)) },
  { id: 'final', label: 'Réussir l’examen final (≥ 75 %)', check: (p: ReturnType<typeof useProgress>['progress']) => (p.scores['exam-final'] ?? 0) >= 75 },
  { id: 'csslp', label: 'Réussir l’examen blanc CSSLP (≥ 70 %)', check: (p: ReturnType<typeof useProgress>['progress']) => (p.scores['exam-csslp'] ?? 0) >= 70 },
];

export default function Certificate() {
  const { progress } = useProgress();
  const met = requirements.map((r) => ({ ...r, ok: r.check(progress) }));
  const earned = met.every((r) => r.ok);
  const level = levelFor(progress.xp);
  const badges = badgeDefs.filter((b) => progress.badges.includes(b.id)).length;
  const doneLessons = Object.keys(progress.lessons).length;
  const year = new Date().getFullYear().toString();
  const name = progress.name.trim() || 'Apprenant·e AppSec';

  return (
    <>
      <PageHead eyebrow="Reconnaissance" title="Certificat">
        Le certificat atteste que tu as suivi le parcours complet et réussi les évaluations. Il n’a pas de valeur officielle : c’est une reconnaissance de ton travail, à afficher ou à imprimer.
      </PageHead>

      {!earned && (
        <section className="block">
          <div className="card cert-reqs">
            <h3 style={{ marginTop: 0 }}>Encore quelques étapes</h3>
            <ul className="req-list">
              {met.map((r) => (
                <li key={r.id} className={r.ok ? 'ok' : ''}>
                  <span className="req-ico">{r.ok ? <Check size={15} /> : <Lock size={14} />}</span>
                  {r.label}
                </li>
              ))}
            </ul>
            <p className="small dim">Va au bout des <Link to="/parcours" className="ink">modules</Link> puis passe les <Link to="/examens" className="ink">examens</Link> pour débloquer le certificat.</p>
          </div>
        </section>
      )}

      <section className="block">
        <div className={`certificate ${earned ? '' : 'locked'}`}>
          <div className="cert-head">
            <span className="label">AppSec Academy</span>
            <Seal size={92} year={year} />
          </div>
          <div className="cert-body">
            <span className="cert-kicker">Certificat de réussite</span>
            <h2 className="cert-name">{name}</h2>
            <p className="cert-text">a suivi l’intégralité du parcours de formation en sécurité applicative et validé ses évaluations, du métier de l’AppSec à la sécurité de l’IA, en passant par la conception, la revue de code, le cloud et la détection.</p>
            <div className="cert-stats">
              <div><span className="label">Niveau</span><b>{level.title}</b></div>
              <div><span className="label">XP</span><b>{progress.xp.toLocaleString('fr-FR')}</b></div>
              <div><span className="label">Leçons</span><b>{doneLessons} / {totalLessons}</b></div>
              <div><span className="label">Badges</span><b>{badges}</b></div>
              <div><span className="label">Examen final</span><b>{progress.scores['exam-final'] ?? 0}%</b></div>
              <div><span className="label">CSSLP blanc</span><b>{progress.scores['exam-csslp'] ?? 0}%</b></div>
            </div>
            <div className="cert-foot">
              <span className="label">Délivré le {new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
              <span className="label">Parcours non officiel · reconnaissance pédagogique</span>
            </div>
          </div>
        </div>
        {earned && (
          <div className="actions" style={{ marginTop: 18 }}>
            <button className="btn primary" onClick={() => window.print()}><Printer size={16} /> Imprimer ou enregistrer en PDF</button>
          </div>
        )}
      </section>
    </>
  );
}

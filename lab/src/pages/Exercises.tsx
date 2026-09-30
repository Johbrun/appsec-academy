import { useEffect, useState } from 'react';
import { api } from '../api.ts';
import { DEFAULT_SITE_URL, lessonLabel, lessonUrl, moduleTitles } from '../../shared/exercises.ts';
import type { ExerciseDef } from '../../shared/exercises.ts';

// Où tourne AppSec Academy. Surchargeable : VITE_SITE_URL=… npm run dev:web
const SITE = import.meta.env.VITE_SITE_URL ?? DEFAULT_SITE_URL;

type Exercise = ExerciseDef & {
  solved: boolean;
  solvedAt: string | null;
  flag: string | null;
  /** Challenge « fix » : sa correction se vérifie par un audit du fichier. */
  auditable: boolean;
};

interface AuditEntry { id: string; fixed: boolean; reason: string | null }

const KIND_LABEL: Record<string, string> = {
  exploit: 'exploit',
  fix: 'fix ⚙',
  artifact: 'artifact ✎',
};

export function Exercises() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [polluted, setPolluted] = useState(false);
  const [audits, setAudits] = useState<Record<string, AuditEntry>>({});
  const [auditing, setAuditing] = useState<string | null>(null);

  async function load() {
    setExercises(await api<Exercise[]>('/lab/exercises'));
    const state = await api<{ prototypePolluted: boolean }>('/lab/state');
    setPolluted(state.prototypePolluted);
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 3000); // l'état se met à jour pendant que tu attaques
    return () => clearInterval(t);
  }, []);

  const solved = exercises.filter((e) => e.solved).length;
  const pct = exercises.length ? Math.round((solved / exercises.length) * 100) : 0;
  const modules = [...new Set(exercises.map((e) => e.module))];

  async function reset() {
    await api('/lab/reset', { method: 'POST' });
    load();
  }

  async function unsolve(id: string) {
    await api(`/lab/unsolve/${id}`, { method: 'POST' });
    setAudits((a) => { const { [id]: _, ...rest } = a; void _; return rest; });
    load();
  }

  /** Relance la vérification d'un challenge « fix » après correction du fichier. */
  async function audit(id: string) {
    setAuditing(id);
    try {
      const res = await api<{ entries: AuditEntry[] }>(`/lab/audit/${id}`, { method: 'POST' });
      const entry = res.entries[0];
      if (entry) setAudits((a) => ({ ...a, [id]: entry }));
      load();
    } finally {
      setAuditing(null);
    }
  }

  return (
    <>
      <h1>Exercices</h1>
      <p className="lead">
        Chaque exercice se valide quand le serveur constate lui-même que l’invariant est rompu.
        Ensuite seulement vient le vrai travail : corriger la classe de bugs, puis <code>npm run verify</code>.
      </p>

      <div className="card">
        <div className="spread">
          <div>
            <strong>{solved} / {exercises.length}</strong> <span className="muted">exercices résolus</span>
          </div>
          <div className="row">
            <button onClick={load}>Rafraîchir</button>
            <button onClick={reset}>Réinitialiser les données</button>
          </div>
        </div>
        <div className="progress"><div style={{ width: `${pct}%` }} /></div>
        {polluted && (
          <p className="danger" style={{ fontSize: 13, marginBottom: 0, marginTop: 10 }}>
            ⚠ Object.prototype est actuellement pollué dans le processus du serveur. La réinitialisation le nettoie.
          </p>
        )}
      </div>

      {modules.map((m) => (
        <div key={m}>
          <h2>{moduleTitles[m] ?? m}</h2>
          {exercises.filter((e) => e.module === m).map((e) => (
            <div className="card" key={e.id}>
              <div className="spread">
                <h3 style={{ margin: 0 }}>
                  {e.solved && <span className="ok">✓ </span>}{e.title}
                </h3>
                <div className="row">
                  <span className={`tag n${e.level}`}>N{e.level}</span>
                  <span className="tag">{KIND_LABEL[e.kind] ?? e.kind}</span>
                  <span className="tag">{e.cwe}</span>
                  {e.csslp.map((d) => <span className="tag" key={d}>{d}</span>)}
                  {e.k?.map((k) => <span className="tag" key={k}>K{k}</span>)}
                </div>
              </div>

              <p style={{ fontSize: 14, margin: '8px 0' }}>{e.brief}</p>
              <p style={{ fontSize: 14, margin: '8px 0' }}>
                <strong>Objectif :</strong> {e.goal}
              </p>
              <p className="muted" style={{ fontSize: 12.5, margin: '8px 0' }}>
                Défaut porté par <code>{e.file}</code>
              </p>

              <p className="lesson-links">
                <span className="muted">Dans le cours :</span>{' '}
                {e.lessons.map((ref, n) => (
                  <span key={ref}>
                    {n > 0 && <span className="muted"> · </span>}
                    <a href={lessonUrl(ref, SITE)} target="_blank" rel="noreferrer">
                      {lessonLabel(ref)}
                    </a>
                  </span>
                ))}
              </p>

              {e.auditable && !e.solved && (
                <div className="card" style={{ background: 'var(--panel-2)', marginBottom: 10 }}>
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <span className="muted" style={{ fontSize: 13 }}>
                      Corrige le fichier dans <code>{e.file}</code>, puis relance l’audit.
                    </span>
                    <button onClick={() => audit(e.id)} disabled={auditing === e.id}>
                      {auditing === e.id ? 'Audit…' : 'Lancer l’audit'}
                    </button>
                  </div>
                  {audits[e.id] && !audits[e.id].fixed && (
                    <p className="danger" style={{ fontSize: 13.5, margin: '10px 0 0' }}>
                      Il reste : {audits[e.id].reason}
                    </p>
                  )}
                </div>
              )}

              {e.solved ? (
                <>
                  <p className="flag" style={{ margin: '10px 0 6px' }}>{e.flag}</p>
                  <div className="card" style={{ background: 'var(--panel-2)', marginBottom: 0 }}>
                    <strong style={{ fontSize: 13.5 }}>Éliminer la classe de bugs</strong>
                    <p style={{ fontSize: 13.5, margin: '6px 0 0' }}>{e.fix}</p>
                  </div>
                  <div className="row" style={{ marginTop: 10 }}>
                    <button onClick={() => unsolve(e.id)}>Remettre à zéro cet exercice</button>
                  </div>
                </>
              ) : (
                e.hints.map((h, n) => (
                  <details key={n}>
                    <summary>Indice {n + 1}{n === e.hints.length - 1 ? ' — la marche à suivre' : ''}</summary>
                    <p className="hint">{h}</p>
                  </details>
                ))
              )}
            </div>
          ))}
        </div>
      ))}
    </>
  );
}

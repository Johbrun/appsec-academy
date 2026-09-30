import { useMemo, useState } from 'react';
import { Check, RotateCcw, X } from 'lucide-react';
import { Feedback, GameHeader, ScoreRing } from '../components/ui';
import { allows, serialize, type Directive, type Policy } from '../lib/csp';
import { cspTests, directiveChoices, initialPolicy } from '../data/game-csp';
import { useProgress } from '../store/progress';

export default function CspBuilder() {
  const { recordScore } = useProgress();
  const [policy, setPolicy] = useState<Policy>(initialPolicy);
  const [submitted, setSubmitted] = useState<number | null>(null);

  const results = useMemo(() => cspTests.map((t) => {
    const allowed = allows(policy, t.action);
    return { t, ok: t.kind === 'feature' ? allowed : !allowed, allowed };
  }), [policy]);
  const passed = results.filter((r) => r.ok).length;
  const pct = Math.round((passed / results.length) * 100);

  const toggle = (d: Directive, tok: string) => {
    setSubmitted(null);
    setPolicy((p) => {
      const cur = p[d] ?? [];
      const next = cur.includes(tok) ? cur.filter((x) => x !== tok) : [...cur, tok];
      const copy = { ...p };
      if (next.length) copy[d] = next; else delete copy[d];
      return copy;
    });
  };
  const submit = () => { setSubmitted(pct); recordScore('csp-builder', pct); };
  const reset = () => { setPolicy(initialPolicy); setSubmitted(null); };

  const features = results.filter((r) => r.t.kind === 'feature');
  const attacks = results.filter((r) => r.t.kind === 'attack');

  return (
    <section className="block">
      <div className="game-wrap wide">
        <GameHeader id="csp-builder" title="CSP Builder" current={passed} total={results.length} counter={false}
          extra={<span className="tag mono">{passed}/{results.length} tests</span>} />
        <div className="card q-card">
          <span className="label">La page de paiement de Novafact</span>
          <p className="muted small" style={{ margin: '10px 0 0' }}>
            Elle charge le bundle de l’application (avec nonce), le chargeur d’un tag manager et les tags qu’il injecte, l’iframe du prestataire de paiement,
            une mesure d’audience et les appels à l’API. Compose une politique qui garde tout ça fonctionnel et bloque les attaques.
          </p>
        </div>

        <div className="csp-header">
          <span className="label">En-tête produit</span>
          <code>Content-Security-Policy: {serialize(policy) || '(aucune politique)'}</code>
        </div>

        <div className="csp-layout">
          <div className="csp-editor">
            {directiveChoices.map((dc) => (
              <div key={dc.d} className="csp-row">
                <div className="csp-dir">
                  <span className="mono">{dc.d}</span>
                  <span className="small dim">{dc.hint}</span>
                </div>
                <div className="chips">
                  {dc.tokens.map((tok) => {
                    const on = (policy[dc.d] ?? []).includes(tok);
                    return <button key={tok} className={`chip mono ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => toggle(dc.d, tok)}>{tok}</button>;
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="csp-tests">
            <div className="section-title" style={{ marginTop: 0 }}>Fonctionnalités ({features.filter((r) => r.ok).length}/{features.length})</div>
            {features.map((r) => (
              <div key={r.t.id} className={`csp-test ${r.ok ? 'ok' : 'ko'}`}>
                {r.ok ? <Check size={15} /> : <X size={15} />}
                <span><b>{r.t.label}</b><span className="small dim">{r.ok ? 'fonctionne' : 'cassée'} · {r.t.detail}</span></span>
              </div>
            ))}
            <div className="section-title">Attaques ({attacks.filter((r) => r.ok).length}/{attacks.length} bloquées)</div>
            {attacks.map((r) => (
              <div key={r.t.id} className={`csp-test ${r.ok ? 'ok' : 'ko'}`}>
                {r.ok ? <Check size={15} /> : <X size={15} />}
                <span><b>{r.t.label}</b><span className="small dim">{r.ok ? 'bloquée' : 'passe'} · {r.t.detail}</span></span>
              </div>
            ))}
          </div>
        </div>

        {submitted !== null && (
          <div className="card score" style={{ marginTop: 24 }}>
            <ScoreRing pct={submitted} size={140} />
            <h2 style={{ marginTop: 8 }}>{submitted === 100 ? 'Politique stricte et fonctionnelle' : 'Politique enregistrée'}</h2>
            <Feedback good={submitted === 100}>
              {submitted === 100
                ? <span>Nonce et strict-dynamic, sans liste de domaines, plus les directives qui ferment base, formulaires, plugins, intégration et sinks DOM.</span>
                : <span>Regarde les tests en rouge. Indice : une liste de domaines autorise tout ce que ces domaines servent, y compris ce qu’un attaquant peut y déposer.</span>}
            </Feedback>
          </div>
        )}

        <div className="actions between">
          <button className="btn" onClick={reset}><RotateCcw size={16} /> Réinitialiser</button>
          <button className="btn primary" onClick={submit}>Valider ma politique ({pct} %)</button>
        </div>
      </div>
    </section>
  );
}

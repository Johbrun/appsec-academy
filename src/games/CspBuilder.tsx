import { useMemo, useState } from 'react';
import { Check, Pencil, RotateCcw, X } from 'lucide-react';
import { Feedback, GameHeader } from '../components/ui';
import { SeriesGame, SeriesScore, type SeriesPlay } from '../components/Series';
import { serialize, verdict, type Directive, type Policy } from '../lib/csp';
import { cspSeries, type CspPage } from '../data/game-csp';

export default function CspBuilder() {
  return (
    <SeriesGame
      gameId="csp-builder"
      title="CSP Builder"
      set={cspSeries}
      unit="page"
      intro="Sept pages de Novafact, chacune avec ses fonctionnalités à préserver et ses attaques à bloquer. Du site vitrine sans politique à l’éditeur où la CSP stricte ne suffit plus : le simulateur applique la sémantique réelle de CSP niveau 3."
    >
      {(play) => <Round play={play} />}
    </SeriesGame>
  );
}

function Round({ play }: { play: SeriesPlay<CspPage> }) {
  const page = play.items[0];
  const [policy, setPolicy] = useState<Policy>(page.initialPolicy);
  const [submitted, setSubmitted] = useState<number | null>(null);

  const results = useMemo(() => page.cspTests.map((t) => {
    const v = verdict(policy, t.action, page.origin);
    return { t, ok: t.kind === 'feature' ? v.allowed : !v.allowed, why: v.why };
  }), [policy, page]);
  const passed = results.filter((r) => r.ok).length;
  const pct = Math.round((passed / results.length) * 100);

  const toggle = (d: Directive, tok: string) => {
    setPolicy((p) => {
      const cur = p[d] ?? [];
      const next = cur.includes(tok) ? cur.filter((x) => x !== tok) : [...cur, tok];
      const copy = { ...p };
      if (next.length) copy[d] = next; else delete copy[d];
      return copy;
    });
  };
  const submit = () => { play.finish(pct); setSubmitted(pct); };
  const reset = () => setPolicy(page.initialPolicy);

  const features = results.filter((r) => r.t.kind === 'feature');
  const attacks = results.filter((r) => r.t.kind === 'attack');

  if (submitted !== null) {
    const failed = results.filter((r) => !r.ok);
    return (
      <SeriesScore
        play={play}
        pct={submitted}
        title={submitted === 100 ? 'Politique stricte et fonctionnelle' : `${passed} / ${results.length} tests réussis`}
      >
        <div style={{ textAlign: 'left', maxWidth: 640, margin: '0 auto 12px' }}>
          <div className="csp-header">
            <span className="label">Ta politique</span>
            <code>Content-Security-Policy: {serialize(policy) || '(aucune politique)'}</code>
          </div>
          {failed.length > 0 && (
            <Feedback good={false}>
              <b>Ce qui ne tient pas</b>
              {failed.map((r) => (
                <div key={r.t.id} className="small muted" style={{ marginTop: 6 }}>
                  <b style={{ fontWeight: 500 }}>{r.t.label}</b> ({r.t.kind === 'feature' ? 'cassée' : 'passe'}) : {r.why}.
                </div>
              ))}
              <div className="small" style={{ marginTop: 10 }}>Indice : {page.hint}</div>
            </Feedback>
          )}
          <Feedback good={submitted === 100}>
            <b>Ce qu’il fallait voir</b>
            <div className="small muted">{page.debrief}</div>
          </Feedback>
          {page.realCase && (
            <Feedback good>
              <b>Cas réel</b>
              <div className="small muted">{page.realCase}</div>
            </Feedback>
          )}
          <div className="actions center">
            <button className="btn" onClick={() => setSubmitted(null)}><Pencil size={16} /> Reprendre ma politique</button>
          </div>
        </div>
      </SeriesScore>
    );
  }

  return (
    <section className="block">
      <div className="game-wrap wide">
        <GameHeader id="csp-builder" title={`CSP Builder · ${play.info.title}`} level={play.info.level}
          current={passed} total={results.length} counter={false}
          extra={<span className="tag mono">{passed}/{results.length} tests</span>} />
        <div className="card q-card">
          <span className="label">{page.title} · {page.origin.replace('https://', '')}</span>
          <p className="muted small" style={{ margin: '10px 0 0' }}>{page.context}</p>
        </div>

        <div className="csp-header">
          <span className="label">En-tête produit</span>
          <code>Content-Security-Policy: {serialize(policy) || '(aucune politique)'}</code>
        </div>

        <div className="csp-layout">
          <div className="csp-editor">
            {page.directiveChoices.map((dc) => (
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

        <div className="actions between">
          <button className="btn" onClick={reset}><RotateCcw size={16} /> Réinitialiser</button>
          <button className="btn primary" onClick={submit}>Valider ma politique ({pct} %)</button>
        </div>
      </div>
    </section>
  );
}

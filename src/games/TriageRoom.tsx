import { useMemo, useState } from 'react';
import { ArrowRight, ChevronDown } from 'lucide-react';
import { Feedback, GameHeader, shuffle } from '../components/ui';
import { SeriesGame, SeriesScore, type SeriesPlay } from '../components/Series';
import {
  decide, decisions, sprints, triageSeries, SLA_DAYS, SPRINT_DAYS,
  type Decision, type Finding, type Sprint,
} from '../data/game-triage';

const order: Decision[] = ['act', 'attend', 'trackstar', 'track'];
const closeness = (a: Decision, b: Decision) => {
  if (a === b) return 1;
  if (a === 'vex' || b === 'vex') return 0;
  return Math.abs(order.indexOf(a) - order.indexOf(b)) === 1 ? 0.5 : 0;
};
const label = (d: Decision) => decisions.find((x) => x.id === d)!.label;
const num = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 1 });

function Grid({ sprint }: { sprint?: Sprint }) {
  return (
    <details className="youknow" style={{ marginBottom: 20 }}>
      <summary><span className="label">La grille de Novafact</span><ChevronDown size={15} /></summary>
      <div className="note-body">
        <ol className="small" style={{ margin: 0, paddingLeft: 20 }}>
          <li>Code vulnérable non atteignable (justifié) : <b>Clore</b> avec un VEX not_affected.</li>
          <li>Exploitée activement (KEV) et exposée sur Internet : <b>Act</b> (24 à 72 h).</li>
          <li>KEV mais interne, ou PoC publique ou EPSS ≥ 10 % et exposée : <b>Attend</b> (7 jours).</li>
          <li>PoC ou EPSS ≥ 10 % mais interne, ou gravité haute sur un actif critique exposé : <b>Track*</b> (30 jours).</li>
          <li>Le reste : <b>Track</b>, cycle normal. Une atteignabilité inconnue compte comme atteignable.</li>
        </ol>
        {sprint && (
          <p className="small" style={{ marginTop: 10, marginBottom: 0 }}>
            <b>Budget de sprint.</b> Un sprint dure {SPRINT_DAYS} jours et dispose de {num(sprint.budget)} jours-développeur.
            Le délai d’un finding court depuis son ouverture. On y met d’abord tout ce qui échoit avant le sprint suivant,
            puis les clôtures VEX, puis les autres Track*. Un Track n’a pas de budget : il suit le cycle normal.
          </p>
        )}
      </div>
    </details>
  );
}

export default function TriageRoom() {
  return (
    <SeriesGame
      gameId="triage-room"
      title="Triage Room"
      set={triageSeries}
      unit="findings"
      intro="Six files de findings, du scanner du front aux runners de CI. Les premières se tranchent sur un critère ; les dernières demandent de juger les VEX que propose l’équipe, puis de répartir un budget de sprint. Composants réels ; les CVE citées sont réelles, leurs signaux KEV et EPSS sont un instantané de septembre 2026."
    >
      {(play) => <Round play={play} />}
    </SeriesGame>
  );
}

function Round({ play }: { play: SeriesPlay<Finding> }) {
  const findings = play.items;
  const sprint = sprints[play.info.id];
  // Les plans sont rebattus : le bon ne doit pas se retrouver à la même place.
  const plans = useMemo(() => (sprint ? shuffle(sprint.plans) : []), [sprint]);
  const total = findings.length + (sprint ? 1 : 0);

  const [i, setI] = useState(0);
  const [pick, setPick] = useState<Decision | null>(null);
  const [points, setPoints] = useState(0);
  const [phase, setPhase] = useState<'triage' | 'sprint' | 'done'>('triage');
  const [plan, setPlan] = useState<number | null>(null);

  const finish = (pts: number) => {
    play.finish(Math.round((pts / total) * 100));
    setPhase('done');
  };

  if (phase === 'done') {
    const pct = Math.round((points / total) * 100);
    return (
      <SeriesScore play={play} pct={pct} title="File de triage traitée">
        <p className="small dim">Réponse exacte : 1 point. Décision voisine : 0,5.{sprint && ' Plan de sprint : 1 point.'}</p>
      </SeriesScore>
    );
  }

  if (phase === 'sprint' && sprint) {
    const chosen = plan !== null ? plans[plan] : null;
    return (
      <section className="block">
        <div className="game-wrap wide">
          <GameHeader
            id="triage-room" title={`Triage Room · ${play.info.title}`} level={play.info.level}
            current={findings.length} total={total}
            extra={<span className="tag mono">{num(points)} pts</span>}
          />
          <Grid sprint={sprint} />
          <div className="card q-card">
            <span className="label">Budget du sprint : {num(sprint.budget)} jours-développeur</span>
            <h3 style={{ marginTop: 10 }}>La file est triée. Que mets-tu dans ce sprint ?</h3>
            <div className="triage-facts">
              {findings.map((f) => {
                const d = decide(f).d;
                const sla = SLA_DAYS[d];
                return (
                  <div key={f.id}>
                    <span className="label">{f.short ?? f.component}</span>
                    <b>{label(d)}{f.effort !== undefined && d !== 'track' ? ` · ${num(f.effort)} j` : ''}</b>
                    <span className="small dim" style={{ display: 'block', marginTop: 2 }}>
                      {sla !== undefined && f.age !== undefined ? `ouvert depuis ${f.age} j sur ${sla}` : d === 'vex' ? 'déclaration et contrôle' : 'cycle normal'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          <p className="q-hint">Quel plan ?</p>
          <div className="grid" style={{ gap: 10 }}>
            {plans.map((p, k) => {
              const cls = plan !== null ? (p.right ? 'correct' : k === plan ? 'wrong' : '') : '';
              return (
                <button key={k} className={`option ${cls}`} disabled={plan !== null}
                  onClick={() => { setPlan(k); if (p.right) setPoints(points + 1); }}>
                  <span className="key">{String.fromCharCode(65 + k)}</span>
                  <span>{p.text}{plan !== null && (k === plan || p.right) && <span className="desc">{p.why}</span>}</span>
                </button>
              );
            })}
          </div>
          {chosen && (
            <>
              <Feedback good={chosen.right}>
                <b>{chosen.right ? 'Le sprint tient toutes les échéances.' : 'Une échéance ou une décision de la grille n’est pas respectée.'}</b>
              </Feedback>
              <div className="actions"><button className="btn primary" onClick={() => finish(points)}>Terminer <ArrowRight size={16} className="arrow" /></button></div>
            </>
          )}
        </div>
      </section>
    );
  }

  const f = findings[i];
  const ref = decide(f);

  const choose = (d: Decision) => {
    if (pick) return;
    setPick(d);
    setPoints(points + closeness(d, ref.d));
  };
  const next = () => {
    if (i + 1 < findings.length) { setI(i + 1); setPick(null); return; }
    if (sprint) setPhase('sprint');
    else finish(points);
  };

  const epss = `${num(f.epss)} %${f.percentile !== undefined ? ` (${f.percentile}e percentile)` : ''}`;
  const facts = [
    { k: 'CVSS (éditeur)', v: f.cvss },
    { k: 'EPSS', v: epss },
    { k: 'KEV', v: f.kev ? 'Oui' : 'Non' },
    { k: 'PoC publique', v: f.poc ? 'Oui' : 'Non' },
    { k: 'Atteignable', v: f.reachShown ?? f.reach },
    { k: 'Exposition', v: f.exposure },
    { k: 'Actif', v: f.asset },
    ...(f.age !== undefined ? [{ k: 'Ouvert depuis', v: `${f.age} j` }] : []),
    ...(f.effort !== undefined ? [{ k: 'Effort estimé', v: `${num(f.effort)} j` }] : []),
  ];

  return (
    <section className="block">
      <div className="game-wrap wide">
        <GameHeader
          id="triage-room" title={`Triage Room · ${play.info.title}`} level={play.info.level}
          current={i} total={total}
          extra={<span className="tag mono">{num(points)} pts</span>}
        />
        <Grid sprint={sprint} />
        <div className="card q-card">
          <div className="row between">
            <span className="label">{f.component}</span>
            {f.cve && <span className="tag mono">{f.cve}</span>}
          </div>
          <h3 style={{ marginTop: 10 }}>{f.title}</h3>
          {f.note && <p className="small muted" style={{ marginTop: 8, marginBottom: 0 }}>{f.note}</p>}
          <div className="triage-facts">
            {facts.map((x) => <div key={x.k}><span className="label">{x.k}</span><b>{x.v}</b></div>)}
          </div>
        </div>
        <p className="q-hint">Quelle décision ?</p>
        <div className="grid g3" style={{ gap: 8 }}>
          {decisions.map((d) => {
            const cls = pick ? (d.id === ref.d ? 'correct' : d.id === pick ? 'wrong' : '') : '';
            return (
              <button key={d.id} className={`option ${cls}`} disabled={!!pick} onClick={() => choose(d.id)}>
                <span><b style={{ fontWeight: 500 }}>{d.label}</b><span className="desc">{d.sla}</span></span>
              </button>
            );
          })}
        </div>
        {pick && (
          <>
            <Feedback good={pick === ref.d}>
              <b>{pick === ref.d ? 'Bonne décision.' : closeness(pick, ref.d) ? 'Décision voisine (0,5 point).' : 'Pas la bonne décision.'}</b>
              <div className="small muted">{ref.rule}</div>
              <div className="small muted" style={{ marginTop: 6 }}>{f.explain}</div>
            </Feedback>
            <div className="actions"><button className="btn primary" onClick={next}>Continuer <ArrowRight size={16} className="arrow" /></button></div>
          </>
        )}
      </div>
    </section>
  );
}

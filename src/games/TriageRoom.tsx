import { useMemo, useState } from 'react';
import { ArrowRight, ChevronDown } from 'lucide-react';
import { Feedback, GameHeader, ScoreScreen } from '../components/ui';
import { useProgress } from '../store/progress';

type Decision = 'act' | 'attend' | 'trackstar' | 'track' | 'vex';
type Cvss = 'Critique' | 'Haute' | 'Moyenne' | 'Faible';

interface Finding {
  title: string;
  component: string;
  cvss: Cvss;
  epss: number;       // en %
  kev: boolean;
  poc: boolean;
  reach: 'oui' | 'non' | 'inconnue';
  exposure: 'Internet' | 'Interne';
  asset: 'Critique' | 'Standard';
}

const decisions: { id: Decision; label: string; sla: string }[] = [
  { id: 'act', label: 'Act', sla: '24 à 72 h' },
  { id: 'attend', label: 'Attend', sla: '7 jours' },
  { id: 'trackstar', label: 'Track*', sla: '30 jours' },
  { id: 'track', label: 'Track', sla: 'cycle normal' },
  { id: 'vex', label: 'Clore (VEX)', sla: 'not_affected' },
];

// La grille de Novafact, identique à celle de la leçon M05-3.
function decide(f: Finding): { d: Decision; rule: string } {
  const signal = f.poc || f.epss >= 10;
  if (f.reach === 'non') return { d: 'vex', rule: 'Code vulnérable non atteignable : on clôt avec un VEX not_affected justifié.' };
  if (f.kev && f.exposure === 'Internet') return { d: 'act', rule: 'Exploitée activement (KEV) et exposée sur Internet : Act.' };
  if (f.kev || (signal && f.exposure === 'Internet')) return { d: 'attend', rule: f.kev ? 'Exploitée activement mais interne : Attend.' : 'Preuve de concept ou EPSS élevé, et exposée : Attend.' };
  if (signal || (f.exposure === 'Internet' && f.asset === 'Critique' && (f.cvss === 'Critique' || f.cvss === 'Haute')))
    return { d: 'trackstar', rule: signal ? 'Signal d’exploitation, mais composant interne : Track*.' : 'Gravité haute sur un actif critique exposé, sans signal d’exploitation : Track*.' };
  return { d: 'track', rule: 'Aucun signal d’exploitation, pas d’actif critique exposé : Track, cycle normal.' };
}

const order: Decision[] = ['act', 'attend', 'trackstar', 'track'];
const closeness = (a: Decision, b: Decision) => {
  if (a === b) return 1;
  if (a === 'vex' || b === 'vex') return 0;
  return Math.abs(order.indexOf(a) - order.indexOf(b)) === 1 ? 0.5 : 0;
};

const titles = [
  'Prototype pollution dans une fonction de fusion', 'ReDoS dans un parser de dates', 'SSRF dans le client de webhooks',
  'Injection SQL dans le module de reporting', 'XSS stockée dans les notes client', 'Désérialisation dans les Server Components',
  'Path traversal dans l’export PDF', 'Contournement de signature SAML (xml-crypto)', 'BOLA sur /invoices/:id/pdf',
  'Open redirect sur /logout', 'Déni de service par promesse non gérée', 'Fuite de données via un filtre ORM',
];
const components = ['api-facturation', 'back-office Next.js', 'service PDF', 'SDK npm', 'outil de support interne', 'worker d’e-mails'];

function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function generate(seed: number, n = 8): Finding[] {
  for (let attempt = 0; attempt < 50; attempt++) {
    const r = rng(seed * 101 + attempt);
    const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
    const list: Finding[] = Array.from({ length: n }, () => {
      const kev = r() < 0.15;
      return {
        title: pick(titles),
        component: pick(components),
        cvss: pick<Cvss>(['Critique', 'Haute', 'Haute', 'Moyenne', 'Moyenne', 'Faible']),
        epss: kev ? Math.round(40 + r() * 55) : r() < 0.7 ? Math.round(r() * 40) / 10 : Math.round(10 + r() * 50),
        kev,
        poc: kev || r() < 0.25,
        reach: pick(['oui', 'oui', 'inconnue', 'non']),
        exposure: pick(['Internet', 'Internet', 'Interne']),
        asset: pick(['Critique', 'Standard']),
      } as Finding;
    });
    const kinds = new Set(list.map((f) => decide(f).d));
    if (kinds.size >= 4) return list;
  }
  return [];
}

function Grid() {
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
      </div>
    </details>
  );
}

export default function TriageRoom() {
  const { recordScore } = useProgress();
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e6));
  const findings = useMemo(() => generate(seed), [seed]);
  const [i, setI] = useState(0);
  const [pick, setPick] = useState<Decision | null>(null);
  const [points, setPoints] = useState(0);
  const [done, setDone] = useState(false);

  const f = findings[i];
  const ref = f ? decide(f) : null;

  const choose = (d: Decision) => {
    if (pick || !ref) return;
    setPick(d);
    setPoints(points + closeness(d, ref.d));
  };
  const next = () => {
    if (i + 1 >= findings.length) {
      setDone(true);
      recordScore('triage-room', Math.round((points / findings.length) * 100));
    } else { setI(i + 1); setPick(null); }
  };
  const restart = () => { setSeed(seed + 1); setI(0); setPick(null); setPoints(0); setDone(false); };

  if (done) {
    const pct = Math.round((points / findings.length) * 100);
    return <section className="block"><ScoreScreen pct={pct} title="File de triage traitée" onRetry={restart}><p className="small dim">Réponse exacte : 1 point. Décision voisine : 0,5.</p></ScoreScreen></section>;
  }
  if (!f || !ref) return null;

  const facts = [
    { k: 'CVSS (éditeur)', v: f.cvss },
    { k: 'EPSS', v: `${f.epss.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %` },
    { k: 'KEV', v: f.kev ? 'Oui' : 'Non' },
    { k: 'PoC publique', v: f.poc ? 'Oui' : 'Non' },
    { k: 'Atteignable', v: f.reach },
    { k: 'Exposition', v: f.exposure },
    { k: 'Actif', v: f.asset },
  ];

  return (
    <section className="block">
      <div className="game-wrap wide">
        <GameHeader id="triage-room" title="Triage Room" current={i} total={findings.length} extra={<span className="tag mono">{points.toString().replace('.', ',')} pts</span>} />
        <Grid />
        <div className="card q-card">
          <span className="label">{f.component}</span>
          <h3 style={{ marginTop: 10 }}>{f.title}</h3>
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
            </Feedback>
            <div className="actions"><button className="btn primary" onClick={next}>Continuer <ArrowRight size={16} className="arrow" /></button></div>
          </>
        )}
      </div>
    </section>
  );
}

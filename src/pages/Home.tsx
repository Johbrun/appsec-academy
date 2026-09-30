import { type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';
import { Block, Icon, Orb } from '../components/ui';
import { Identicon } from '../components/Marks';
import { useNextLesson } from '../components/Layout';
import { badgeDefs, levelFor, useProgress } from '../store/progress';
import { blocks, lessonKey, modules, pad2, totalLessons } from '../data/catalog';
import { availableGames, games } from '../data/games';
import { labs } from '../data/labs';
import { writtenCount } from '../lib/content';

// Extrait fictif d'une CI de pull request et sa lecture AppSec.
const ciLines = [
  { time: '14:02:11', st: 'ok', label: 'PASS', who: 'lint', msg: <>eslint · tsc --strict</> },
  { time: '14:02:19', st: 'fail', label: 'FAIL', who: 'semgrep', msg: <>routes/login.ts:14 · <em>nosql-operator</em></> },
  { time: '14:02:20', st: 'fail', label: 'WARN', who: 'zizmor', msg: <>deploy.yml · <em>unpinned-uses</em></> },
  { time: '14:02:31', st: 'ok', label: 'PASS', who: 'sca', msg: <>0 vuln atteignable · sbom.cdx.json</> },
  { time: '14:02:32', st: 'add', label: 'NOTE', who: 'review', msg: <>PR #482 · <em>changes requested</em></> },
];
const readings = [
  { id: 'CWE-943', what: 'Injection NoSQL', where: 'M02' },
  { id: 'CICD-SEC-3', what: 'Dependency chain abuse', where: 'M14' },
  { id: 'A03:2025', what: 'Supply chain failures', where: 'M13' },
];

function TerminalFeed() {
  return (
    <div className="terminal">
      <div className="terminal-head">
        <span className="path">~/novafact/ci · pull_request #482</span>
        <span className="hide-sm">· novafact.example</span>
        <span className="live"><span className="led pulse" /> Live</span>
      </div>
      <div className="term-body">
        {ciLines.map((l, k) => (
          <div key={k} className="t-line" style={{ '--i': k } as CSSProperties}>
            <span className="t-time">{l.time}</span>
            <span className={`t-st ${l.st}`}>{l.label}</span>
            <span className="t-who">{l.who}</span>
            <span className="t-msg">{l.msg}</span>
          </div>
        ))}
        <div className="t-sep" style={{ '--i': ciLines.length } as CSSProperties} />
        {readings.map((m, k) => (
          <div key={m.id} className="t-map" style={{ '--i': ciLines.length + 1 + k } as CSSProperties}>
            <span className="arrow">▲</span>
            <span className="tid">{m.id}</span>
            <span>{m.what}</span>
            <span className="tac">{m.where}</span>
          </div>
        ))}
        <span className="t-cursor" style={{ '--i': ciLines.length + 1 + readings.length } as CSSProperties} />
      </div>
    </div>
  );
}

export default function Home() {
  const { progress } = useProgress();
  const lvl = levelFor(progress.xp);
  const next = useNextLesson();
  const done = Object.keys(progress.lessons).length;
  const started = done > 0;

  const stats = [
    { n: modules.length, label: 'Modules' },
    { n: totalLessons, label: 'Leçons' },
    { n: games.length, label: 'Jeux' },
    { n: labs.length, label: 'Labs reconnus' },
    { n: 8, label: 'Domaines CSSLP' },
    { n: badgeDefs.length, label: 'Badges' },
  ];

  return (
    <>
      <section className="block hero">
        <div className="hero-top">
          <div className="eyebrow">Parcours AppSec <span className="sep">/</span> JavaScript & AWS <span className="sep">/</span> à ton rythme</div>
          <span className="hero-status"><span className="led pulse" /> {writtenCount()} leçon{writtenCount() > 1 ? 's' : ''} en ligne · {availableGames.length} jeux jouables</span>
        </div>
        <h1>Du finding au programme, la sécurité applicative pour <span className="nowrap">JavaScript & AWS<span className="caret" aria-hidden="true" /></span></h1>
        <div className="hero-foot">
          <p className="lead">
            Tu sais trouver les failles. Ce parcours t’apprend à les faire disparaître à l’échelle : conception, revue de code, supply chain,
            IAM, détection, sécurité de l’IA, et l’art de faire adopter tout ça par les équipes.
          </p>
          <div className="hero-cta">
            <Link to={next?.to ?? '/parcours'} className="btn primary">{started ? 'Reprendre le parcours' : 'Commencer le parcours'} <ArrowRight size={16} className="arrow" /></Link>
            <Link to="/parcours" className="btn">Voir le programme</Link>
          </div>
        </div>
      </section>

      <section className="block flush" style={{ paddingTop: 0 }}>
        <TerminalFeed />
      </section>

      <section className="block tight">
        <div className="row between" style={{ marginBottom: 40 }}>
          <p className="lead m0" style={{ maxWidth: '44ch' }}>Pensé pour un pentester web et développeur qui devient ingénieur AppSec.</p>
          <Link to="/parcours" className="btn">Le programme complet</Link>
        </div>
        <div className="wall" style={{ marginBottom: -56 }}>
          {stats.map((s) => (
            <div key={s.label} className="wall-cell">
              <b>{s.n}</b>
              <span className="label">{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      <Block eyebrow="Programme" title="Cinq blocs et un capstone"
        lead="Chaque leçon se valide par des questions et rapporte de l’XP. Les jeux, les labs reconnus et le capstone vérifient ce que tu sais faire.">
        <div className="bento">
          {blocks.map((b, i) => {
            const mods = modules.filter((m) => m.block === b.id);
            const lessons = mods.reduce((s, m) => s + m.lessons.length, 0);
            const ok = mods.reduce((s, m) => s + m.lessons.filter((l) => progress.lessons[lessonKey(m.id, l.id)]).length, 0);
            const big = i < 2;
            return (
              <Link key={b.id} to={`/parcours#bloc-${b.id}`} className={`bento-card ${big ? 'big span-6' : 'span-3'} hud`}>
                <div className="bento-top">
                  <span className="label">{b.id === 'Z' ? 'Capstone' : `Bloc ${b.id}`} · {mods.length} module{mods.length > 1 ? 's' : ''}</span>
                  <span className="label">{ok}/{lessons}</span>
                </div>
                {big && (
                  <div className="block-mods" aria-hidden="true">
                    {mods.map((m) => (
                      <div key={m.id}>
                        <Orb palette={m.palette} xs />
                        <span className="mono dim">M{pad2(m.num)}</span>
                        <span>{m.short}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="bento-text">
                  <h3>{b.title}</h3>
                  <p className="dim">{b.text}</p>
                </div>
              </Link>
            );
          })}
          <Link to="/jeux" className="bento-card span-3 hud">
            <div className="bento-top">
              <span className="tile"><Icon name="Gamepad2" size={18} /></span>
              <span className="label">{availableGames.length}/{games.length} jeux</span>
            </div>
            <div className="bento-text">
              <h3>Jeux</h3>
              <p className="dim">Des mécaniques qui reproduisent les gestes du métier : trier, relire, corriger, prioriser.</p>
            </div>
          </Link>
        </div>

        <div className="progress-strip">
          <div className="row nowrap" style={{ gap: 16 }}>
            <Identicon name={progress.name} size={44} />
            <div>
              <div className="label">Niveau {lvl.index} · {lvl.title}</div>
              <div style={{ fontWeight: 500, marginTop: 4 }}>{next ? <>Prochaine leçon : {next.lesson.title}</> : 'Toutes les leçons en ligne sont validées.'}</div>
            </div>
          </div>
          <div className="stats">
            <div><b>{done}</b><span className="label">Leçons</span></div>
            <div><b>{progress.modules.length}</b><span className="label">Modules</span></div>
            <div><b>{progress.labs.length}</b><span className="label">Labs</span></div>
            <div><b>{progress.xp}</b><span className="label">XP</span></div>
          </div>
          <Link to={next?.to ?? '/parcours'} className="btn primary">{started ? 'Reprendre' : 'Commencer'} <ArrowRight size={16} className="arrow" /></Link>
        </div>
      </Block>

      <Block eyebrow="Méthode" title="Ce qui change quand on passe du pentest à l’AppSec">
        <div className="grid g3">
          {[
            { icon: 'Crosshair', t: 'Penser en classes de bugs', d: 'Un finding corrigé ne vaut pas grand-chose. Un contrôle qui rend la classe impossible vaut des centaines de findings.' },
            { icon: 'FileCode', t: 'Lire le code avant la prod', d: 'La revue de code, les règles maison et les tests de régression remplacent la découverte tardive.' },
            { icon: 'Handshake', t: 'Faire adopter', d: 'Un correctif dans le style de l’équipe, un SLA négocié et un paved road valent mieux qu’un rapport de 80 pages.' },
          ].map((f) => (
            <div key={f.t} className="card feature" style={{ minHeight: 220 }}>
              <span className="tile"><Icon name={f.icon} size={18} /></span>
              <div>
                <h3>{f.t}</h3>
                <p>{f.d}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="row" style={{ marginTop: 28, gap: 10 }}>
          {progress.modules.length > 0 && <span className="tag ok"><Check size={13} /> {progress.modules.length} module{progress.modules.length > 1 ? 's' : ''} validé{progress.modules.length > 1 ? 's' : ''}</span>}
        </div>
      </Block>
    </>
  );
}

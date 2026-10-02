import type { ReactNode } from 'react';
import {
  Chain, Cols, Note, Panel, Points, SCode, SSteps, STable, Stat, Takeaways, Tid, type Accent,
} from '../components/slides';
import { tactics } from '../data/attack';
import { modules, pad2 } from '../data/catalog';
import type { SlideDef } from '../lib/slides';

// Deck du module M02 (m22) : MITRE ATT&CK et la menace SaaS.
// Chaque fait repris ici figure, sourcé, dans src/content/m22/*.mdx : le deck
// condense la leçon, il n'ajoute pas de fait. Une correction de contenu se
// fait d'abord dans la leçon, puis ici.

/* --------------------------------------------------------------- Schémas */

/** Embranchement d'une colonne vers `to` cibles réparties verticalement. */
function Fork({ to = 2 }: { to?: number }) {
  const ys = Array.from({ length: to }, (_, k) => ((k + 0.5) / to) * 100);
  return (
    <svg className="s-fork" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      {ys.map((y) => <path key={y} d={`M0 50 C 55 50, 45 ${y}, 100 ${y}`} vectorEffect="non-scaling-stroke" />)}
    </svg>
  );
}

function Timeline({ items }: { items: { tag: string; date: string; text: string; hot?: boolean }[] }) {
  return (
    <ol className="s-timeline" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
      {items.map((it) => (
        <li key={it.tag} className={it.hot ? 'hot' : ''}>
          <b className="mono">{it.tag}</b>
          <span className="s-tl-date">{it.date}</span>
          <i aria-hidden="true" />
          <p>{it.text}</p>
        </li>
      ))}
    </ol>
  );
}

/** Les quinze tactiques v19, et les colonnes où apparaît une même technique. */
function Matrix({ technique, hits }: { technique: string; hits: string[] }) {
  return (
    <div className="s-matrix" style={{ gridTemplateColumns: `repeat(${tactics.length}, minmax(0, 1fr))` }}>
      {tactics.map((t) => {
        const on = hits.includes(t.id);
        return (
          <div key={t.id} className={`s-mx-col ${on ? 'on' : ''}`}>
            <span className="s-mx-head"><span className="mono">{t.id}</span>{t.name}</span>
            {[0, 1, 2, 3, 4].map((r) => (
              <span key={r} className={`s-mx-cell ${on && r === 1 ? 'hit' : ''}`}>{on && r === 1 ? technique : ''}</span>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function Bars({ rows, max, unit }: { rows: { label: ReactNode; value: number; hot?: boolean; note?: ReactNode }[]; max: number; unit: string }) {
  return (
    <div className="s-bars" role="table" aria-label={unit}>
      {rows.map((r, k) => (
        <div key={k} className={`s-bar ${r.hot ? 'hot' : ''}`} role="row">
          <span className="s-bar-label" role="rowheader">{r.label}</span>
          <span className="s-bar-track" role="cell" title={`${r.value} ${unit}`}><i style={{ width: `${(r.value / max) * 100}%` }} /></span>
          <b className="s-bar-val" role="cell">{r.value}</b>
          <span className="s-bar-note" role="cell">{r.note}</span>
        </div>
      ))}
    </div>
  );
}

/** Frise des cas : mois de juillet 2022 (0) à juillet 2024 (24). */
function Gantt({ rows }: { rows: { label: string; from: number; to: number; text: string; accent: Accent }[] }) {
  const span = 24;
  const years = [{ y: '2023', at: 6 }, { y: '2024', at: 18 }];
  return (
    <div className="s-gantt">
      <div className="s-gantt-axis">
        {years.map((y) => <span key={y.y} style={{ left: `${(y.at / span) * 100}%` }}>{y.y}</span>)}
      </div>
      {rows.map((r) => (
        <div key={r.label} className={`s-gantt-row acc-${r.accent}`}>
          <b>{r.label}</b>
          <span className="s-gantt-track">
            {years.map((y) => <i key={y.y} className="s-gantt-tick" style={{ left: `${(y.at / span) * 100}%` }} />)}
            <span className="s-gantt-bar" style={{ left: `${(r.from / span) * 100}%`, width: `${(Math.max(r.to - r.from, 0.6) / span) * 100}%` }} />
            {/* Au-delà de la moitié de l'axe, le libellé passe à gauche de la barre pour rester dans le cadre. */}
            {r.from > span / 2
              ? <span className="s-gantt-text left" style={{ right: `calc(${100 - (r.from / span) * 100}% + 10px)` }}>{r.text}</span>
              : <span className="s-gantt-text" style={{ left: `calc(${(Math.max(r.to, r.from + 0.6) / span) * 100}% + 10px)` }}>{r.text}</span>}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Calque Navigator de Novafact, avec le dégradé du fichier (0 rouge, 1 ambre, 2 vert). */
function Layer({ cells }: { cells: { id: string; score: 0 | 1 | 2; text: string }[] }) {
  const word = ['rien', 'écrit', 'testé'];
  return (
    <div className="s-layer">
      {cells.map((c) => (
        <div key={c.id} className={`s-layer-cell sc-${c.score}`}>
          <span className="mono">{c.id}</span>
          <b>score {c.score} · {word[c.score]}</b>
          <p>{c.text}</p>
        </div>
      ))}
    </div>
  );
}

/** Diagramme de séquence du proxy AiTM. */
function Aitm() {
  const x = { v: 120, p: 568, s: 1016 };
  const msgs: { from: number; to: number; y: number; text: string; bad?: boolean }[] = [
    { from: x.v, to: x.p, y: 104, text: 'Identifiant, mot de passe, puis code MFA' },
    { from: x.p, to: x.s, y: 150, text: 'Relayés en temps réel au vrai site' },
    { from: x.s, to: x.p, y: 196, text: 'Cookie de session, MFA validée' },
    { from: x.p, to: x.v, y: 242, text: 'Réponse du vrai site, relayée' },
    { from: x.p, to: x.s, y: 310, text: 'Rejeu du cookie : la MFA ne se repose pas', bad: true },
  ];
  const actors = [
    { x: x.v, name: 'Victime', sub: 'navigateur' },
    { x: x.p, name: 'Proxy AiTM', sub: 'domaine de l’attaquant' },
    { x: x.s, name: 'Vrai site', sub: 'page de connexion réelle' },
  ];
  return (
    <svg className="s-svg" viewBox="0 0 1136 340" role="img" aria-label="Le proxy AiTM relaie la connexion complète, MFA comprise, et garde le cookie de session">
      <defs>
        <marker id="m22-ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" className="s-ah" /></marker>
        <marker id="m22-ah-bad" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" className="s-ah-bad" /></marker>
      </defs>
      {actors.map((a) => (
        <g key={a.name}>
          <rect x={a.x - 110} y={4} width={220} height={58} rx={12} className={a.name === 'Proxy AiTM' ? 's-actor-bad' : 'box'} />
          <text x={a.x} y={30} textAnchor="middle" className="t-ink" fontSize="18" fontWeight="500">{a.name}</text>
          <text x={a.x} y={50} textAnchor="middle" className="t-dim" fontSize="13">{a.sub}</text>
          <line x1={a.x} x2={a.x} y1={62} y2={336} className="line" strokeDasharray="3 5" />
        </g>
      ))}
      <rect x={x.p - 6} y={285} width={x.s - x.p + 12} height={40} rx={8} className="s-band-bad" />
      {msgs.map((mm, k) => {
        const dir = mm.to > mm.from ? 1 : -1;
        return (
          <g key={k}>
            <line x1={mm.from + dir * 6} x2={mm.to - dir * 8} y1={mm.y} y2={mm.y} className={mm.bad ? 's-msg-bad' : 's-msg'} markerEnd={`url(#${mm.bad ? 'm22-ah-bad' : 'm22-ah'})`} />
            <text x={(mm.from + mm.to) / 2} y={mm.y - 9} textAnchor="middle" fontSize="15" className={mm.bad ? 's-txt-bad' : ''}>
              <tspan className="mono t-faint">{pad2(k + 1)} </tspan>{mm.text}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ----------------------------------------------------------------- Deck */

const next = modules[modules.findIndex((m) => m.id === 'm22') + 1];

const slides: SlideDef[] = [
  /* ============================================================ Ouverture */
  {
    layout: 'cover',
    title: 'MITRE ATT&CK et la menace SaaS',
    body: (
      <>
        <p className="slide-lead">Le vocabulaire commun de l’attaque : tactiques et techniques, la matrice SaaS et identité, les mitigations et les cas réels.</p>
        <div className="row" style={{ gap: 10 }}>
          <Tid accent="signal">ATT&CK v19</Tid><Tid>6 séquences</Tid><Tid>CSSLP D4 · D5 · D7</Tid>
        </div>
      </>
    ),
    notes: <p>Le module s’appuie sur ATT&CK Enterprise v19 (avril 2026), contrôlé sur la publication 19.2. Les supports antérieurs à 2026 parlent encore de « Defense Evasion » : c’est un des fils rouges de la séance.</p>,
  },
  {
    title: 'Ce que la séance doit permettre',
    body: (
      <Cols cols={2} gap={28}>
        <Points size="lg" items={[
          <>Lire et écrire une correspondance ATT&CK <strong>datée et vérifiable</strong>, à jour de la v19.</>,
          <>Distinguer les quatre usages d’ATT&CK et ce que chaque équipe attend d’un identifiant T.</>,
          <>Reconnaître les techniques SaaS et identité, et leur équivalent dans un produit.</>,
        ]} />
        <Points size="lg" accent="blue" items={[
          <>Prioriser les mitigations et prouver qu’elles sont en place.</>,
          <>Décomposer un incident réel en chaîne de techniques, à partir des bonnes sources.</>,
          <>Remonter d’une technique observée à la classe de bug qui la rend possible.</>,
        ]} />
      </Cols>
    ),
  },
  {
    title: 'Le déroulé',
    body: (
      <ol className="s-agenda">
        {modules.find((m) => m.id === 'm22')!.lessons.map((l, k) => (
          <li key={l.id}>
            <span className="mono">{pad2(k + 1)}</span>
            <b>{l.title}</b>
            <span>{l.summary}</span>
            <span className={`s-lv lv-${l.level}`}>N{l.level}</span>
          </li>
        ))}
      </ol>
    ),
    notes: <p>Les séquences 1 et 2 posent le vocabulaire ; 3 et 4 passent à la menace SaaS et aux mesures ; 5 applique tout sur des cas ; 6 relie ATT&CK au code.</p>,
  },

  /* =================================================== 01 · Histoire et logique */
  { lesson: 'l01', layout: 'section', title: 'ATT&CK : histoire et logique' },
  {
    lesson: 'l01',
    title: 'D’où vient ATT&CK',
    body: (
      <Cols cols="1.1fr 1fr" gap={40} align="start">
        <div className="stack" style={{ gap: 22 }}>
          <p className="slide-lead">2013, chez MITRE : le <em>Fort Meade Experiment</em> (FMX). Une équipe émule des adversaires dans un réseau instrumenté pour améliorer la détection <strong>après</strong> la compromission.</p>
          <Points items={[
            'Base publiée en 2015, d’abord pour Windows.',
            'Deux versions par an, en avril et en octobre.',
            'Depuis août 2026, des versions intermédiaires (v19.2) limitées aux groupes, logiciels et campagnes.',
          ]} />
        </div>
        <Cols cols={1} gap={16}>
          <Panel accent="red" label="Le constat de départ" title="Les indicateurs changent à chaque campagne">Adresses IP, empreintes de fichiers : la défense de l’époque reposait sur ce que l’attaquant renouvelle sans effort.</Panel>
          <Panel accent="signal" label="La réponse" title="Décrire des comportements">Un vocabulaire commun pour ce que fait l’attaquant une fois entré, qui survit au changement d’infrastructure.</Panel>
        </Cols>
      </Cols>
    ),
    source: 'MITRE, ATT&CK Design and Philosophy',
  },
  {
    lesson: 'l01',
    title: 'Les jalons qui comptent pour un SaaS',
    body: (
      <Timeline items={[
        { tag: '2013', date: 'FMX', text: 'Émuler des adversaires, détecter après compromission' },
        { tag: '2015', date: 'publication', text: 'Base publiée, d’abord pour Windows' },
        { tag: 'v6', date: 'oct. 2019', text: 'Cloud : IaaS, SaaS, Office 365, Azure AD' },
        { tag: 'v7', date: 'juil. 2020', text: 'Sous-techniques (T1110.003)' },
        { tag: 'v8', date: 'oct. 2020', text: 'Reconnaissance et Resource Development entrent dans Enterprise' },
        { tag: 'v12', date: 'oct. 2022', text: 'Campagnes : des intrusions datées' },
        { tag: 'v16', date: 'oct. 2024', text: 'Plateformes Identity Provider et Office Suite' },
        { tag: 'v18', date: 'oct. 2025', text: 'Detection Strategies et Analytics', hot: true },
        { tag: 'v19', date: 'avr. 2026', text: 'Defense Evasion scindée', hot: true },
      ]} />
    ),
    notes: <p>Les deux dernières versions sont celles qui rendent les supports anciens trompeurs : v18 pour la détection, v19 pour les tactiques. Les jalons ne sont pas à l’échelle du temps.</p>,
    source: 'MITRE ATT&CK, historique des versions',
  },
  {
    lesson: 'l01',
    title: 'La grammaire : pourquoi, puis comment',
    body: (
      <div className="s-ladder">
        {[
          { k: 'Tactique', q: 'l’objectif du moment : pourquoi', id: 'TA0006', ex: 'Credential Access', acc: 'signal' },
          { k: 'Technique', q: 'la manière générale : comment', id: 'T1110', ex: 'Brute Force', acc: 'teal' },
          { k: 'Sous-technique', q: 'la variante', id: 'T1110.003', ex: 'Password Spraying', acc: 'blue' },
          { k: 'Procédure', q: 'ce qu’un acteur a réellement fait', id: 'fiche', ex: 'APT29 pulvérise des mots de passe depuis des proxys résidentiels', acc: 'violet' },
        ].map((r, k) => (
          <div key={r.k} className={`s-ladder-row acc-${r.acc}`} style={{ marginLeft: k * 56 }}>
            <span className="s-ladder-k"><b>{r.k}</b><span>{r.q}</span></span>
            <Tid accent={r.acc as Accent}>{r.id}</Tid>
            <span className="s-ladder-ex">{r.ex}</span>
          </div>
        ))}
        <Note kind="tip">« Brute Force » ne dit rien d’exploitable. « Peu de tentatives par compte, depuis des adresses résidentielles, sur un compte de test sans MFA » dit quoi journaliser et quoi corréler.</Note>
      </div>
    ),
    notes: <p>Insister sur la procédure : c’est le niveau le plus utile et le plus négligé. Demander au groupe de reformuler une procédure tirée d’un rapport de pentest récent.</p>,
  },
  {
    lesson: 'l01',
    title: 'Ce qui s’accroche aux techniques',
    body: (
      <STable widths={['26%', '22%', '52%']} head={['Objet', 'Identifiant', 'Exemple réel']} rows={[
        ['Groupe', <Tid>Gxxxx</Tid>, 'G0016 APT29 (Midnight Blizzard), G1015 Scattered Spider'],
        ['Campagne', <Tid>Cxxxx</Tid>, 'C0059 Salesforce Data Exfiltration (2024-2025)'],
        ['Mitigation', <Tid>Mxxxx</Tid>, 'M1032 Multi-factor Authentication'],
        ['Detection Strategy', <Tid accent="signal">DETxxxx</Tid>, 'DET0160, pour T1621 (fatigue MFA)'],
        ['Analytic', <Tid accent="signal">ANxxxx</Tid>, 'AN0453, l’analytic SaaS de DET0160'],
      ]} />
    ),
  },
  {
    lesson: 'l01',
    title: 'Une matrice, pas une chaîne',
    body: (
      <>
        <Matrix technique="T1078.004" hits={['TA0001', 'TA0003', 'TA0004', 'TA0005']} />
        <p className="slide-lead" style={{ maxWidth: 'none' }}><Tid accent="signal">T1078.004</Tid> <em>Cloud Accounts</em> sert quatre tactiques : un compte valide sert à entrer, à rester, à monter et à passer inaperçu. L’ordre des colonnes suggère un déroulé, il ne l’impose pas.</p>
      </>
    ),
    source: 'MITRE ATT&CK, tactiques Enterprise (v19)',
  },
  {
    lesson: 'l01',
    title: 'Midnight Blizzard : une procédure de T1110.003',
    body: (
      <Cols cols="1.25fr 1fr" gap={36} align="start">
        <Chain accent="blue" steps={[
          { id: <Tid accent="blue">nov. 2023</Tid>, text: 'Pulvérisation de mots de passe', note: 'Peu de tentatives, proxys résidentiels' },
          { id: <Tid>cible</Tid>, text: 'Un tenant de test hérité, sans MFA' },
          { id: <Tid accent="red">12 janv. 2024</Tid>, text: 'Détection', note: 'Une partie des boîtes mail, dont celles de dirigeants' },
        ]} />
        <Note kind="tip" title="L’exigence qui en découle">Un environnement de test relié à la production fait partie de la surface d’attaque. La fiche d’APT29 documente des pulvérisations depuis 2021.</Note>
      </Cols>
    ),
    source: 'Microsoft MSRC, janvier 2024',
  },
  {
    lesson: 'l01',
    title: 'v18 : la détection devient un objet',
    body: (
      <>
        <div className="s-tree" style={{ gridTemplateColumns: '220px 70px 250px 70px 1fr' }}>
          <Panel accent="ink" label="Technique" title="T1621">Multi-Factor Authentication Request Generation</Panel>
          <Fork to={1} />
          <Panel accent="signal" label="Detection Strategy" title="DET0160">Ce qu’il faut observer pour la technique</Panel>
          <Fork to={2} />
          <div className="stack" style={{ gap: 14 }}>
            <Panel accent="blue" label="Analytic SaaS · AN0453" title="Journaux Okta">Événement <code>MFAChallengeIssued</code></Panel>
            <Panel accent="teal" label="Analytic IaaS" title="CloudTrail">Une source nommée par plateforme</Panel>
          </div>
        </div>
        <Note kind="tip">La question n’est plus « a-t-on des journaux d’authentification ? » mais « <strong>a-t-on cette source-là, avec ce champ-là ?</strong> ». L’équipe applicative est souvent la seule à pouvoir répondre : c’est elle qui émet les événements.</Note>
      </>
    ),
    notes: <p>Avant la v18, chaque fiche avait un paragraphe Detection et une liste de Data Sources ; les deux sont retirés. Les Analytics décrivent une logique, pas une requête prête à coller dans un SIEM.</p>,
    source: 'MITRE ATT&CK, DET0160',
  },
  {
    lesson: 'l01',
    title: 'v19 : Defense Evasion se scinde',
    body: (
      <>
        <div className="s-tree" style={{ gridTemplateColumns: '270px 90px 1fr' }}>
          <Panel accent="ink" label="Jusqu’en v18" title={<><s>Defense Evasion</s> · TA0005</>}>Un fourre-tout : masquer un processus comme couper l’antivirus.</Panel>
          <Fork to={2} />
          <div className="stack" style={{ gap: 14 }}>
            <Panel accent="teal" label="TA0005 · même identifiant" title="Stealth : se cacher">Passer pour une activité normale. <Tid>T1564.008</Tid> <Tid>T1684.001</Tid> <Tid>T1078</Tid></Panel>
            <Panel accent="orange" label="TA0112 · nouvelle" title="Defense Impairment : éteindre la lumière">Casser ce qui permet aux défenseurs de voir. <Tid>T1685.002</Tid> <Tid>T1556</Tid></Panel>
          </div>
        </div>
        <Cols cols={3} gap={24}>
          <Stat value="15" label="tactiques Enterprise" accent="signal" />
          <Stat value="222" label="techniques" />
          <Stat value="475" label="sous-techniques" />
        </Cols>
      </>
    ),
    notes: <p>Révocations à connaître : T1562 Impair Defenses au profit de T1685 (T1562.008 devient T1685.002), T1656 Impersonation au profit de T1684.001. T1550 ne relève plus que de Lateral Movement.</p>,
    source: 'MITRE ATT&CK, mise à jour d’avril 2026 (v19)',
  },
  {
    lesson: 'l01',
    title: 'Le piège : un identifiant qui change de sens',
    body: (
      <Cols cols={2} gap={32} align="start">
        <Panel accent="red" label="Ce qui casse sans bruit" title="Une règle étiquetée « TA0005 »">
          Une règle Elastic qui associe la désactivation de CloudTrail à TA0005 continue de s’afficher sans erreur… dans la mauvaise colonne. L’identifiant existe toujours ; il désigne Stealth.
        </Panel>
        <Panel accent="green" label="La bonne lecture en 2026" title="TA0112 et T1685.002">
          Couper un journal cloud relève de Defense Impairment. Un texte qui présente « TA0005 Defense Evasion » comme une tactique actuelle est daté.
        </Panel>
        <Note kind="warn">Le problème n’est pas qu’un vieil identifiant disparaisse : c’est qu’il <strong>reste valide en changeant de sens</strong>.</Note>
      </Cols>
    ),
  },
  {
    lesson: 'l01',
    title: 'Chez Novafact : un threat model qui a vieilli',
    body: (
      <>
        <STable widths={['15%', '37%', '24%', '24%']} head={['Menace', 'Scénario', 'Rédigé en 2025', 'Corrigé en v19']} rows={[
          ['TM-ADM-07', 'Un attaquant coupe l’export des journaux d’audit vers Elastic', <><Tid>TA0005</Tid> <Tid off>T1562.008</Tid></>, <><Tid accent="orange">TA0112</Tid> <Tid accent="green">T1685.002</Tid></>],
          ['TM-ADM-09', 'Faux appel au support pour réinitialiser la MFA d’un admin client', <><Tid>TA0005</Tid> <Tid off>T1656</Tid></>, <><Tid accent="teal">TA0005</Tid> <Tid accent="green">T1684.001</Tid></>],
        ]} />
        <SCode lang="yaml" file="threat-model/admin.threats.yaml" hl="3,4,5" tone="good" code={`- id: TM-ADM-07
  scenario: un attaquant coupe l'export des journaux d'audit vers Elastic
  tactic: TA0112            # Defense Impairment depuis la v19
  attack: T1685.002         # remplace T1562.008 (revoked-by)
  attack_version: "19"`} />
      </>
    ),
    notes: <p>TM-ADM-09 garde TA0005, mais pour une autre raison : l’usurpation relève désormais de Stealth. Même identifiant, autre sens.</p>,
  },
  {
    lesson: 'l01',
    title: 'Le geste durable : un contrôle en CI',
    body: (
      <>
        <SSteps items={[
          { title: 'Charger le bundle STIX officiel', text: 'Dépôt mitre-attack/attack-stix-data, à la version notée.' },
          { title: 'Lire le statut', text: 'Échouer sur un objet révoqué ou déprécié.' },
          { title: 'Suivre revoked-by', text: 'Proposer le remplaçant et signaler la ligne pour relecture.' },
          { title: 'Noter la version', text: 'attack_version sur chaque correspondance.' },
        ]} />
        <Note kind="warn" title="Le mauvais correctif">Vérifier seulement que l’identifiant <strong>existe</strong>. T1562.008 existe toujours dans le bundle, marqué <code>revoked</code> ; TA0005 existe aussi. Le contrôle passe, la carte reste fausse.</Note>
      </>
    ),
    source: 'github.com/mitre-attack/attack-stix-data',
  },
  {
    lesson: 'l01',
    title: 'À retenir',
    body: (
      <Takeaways items={[
        'ATT&CK décrit des comportements : tactique (pourquoi), technique et sous-technique (comment), procédure (ce qui a été fait).',
        'Groupes, campagnes, mitigations, Detection Strategies et Analytics s’accrochent aux techniques.',
        'v18 : la détection devient un objet, décliné par plateforme et relié à des sources de journaux précises.',
        'v19 : TA0005 devient Stealth, Defense Impairment (TA0112) apparaît ; T1562 et T1656 sont révoquées.',
        'Les correspondances vieillissent : contrôle du statut en CI, version d’ATT&CK notée.',
      ]} />
    ),
  },

  /* ================================================== 02 · Les quatre usages */
  { lesson: 'l02', layout: 'section', title: 'Les quatre usages d’ATT&CK' },
  {
    lesson: 'l02',
    title: 'Un vocabulaire, quatre métiers',
    body: (
      <Cols cols={4} gap={18}>
        <Panel accent="blue" label="Renseignement · CTI" title="Que font les acteurs qui ciblent des gens comme nous ?">Rapport traduit en techniques, profil d’acteur.</Panel>
        <Panel accent="signal" label="Détection · SOC" title="Verrions-nous ces techniques chez nous ?">Calque Navigator, règles associées à des techniques.</Panel>
        <Panel accent="orange" label="Émulation · purple team" title="Si on rejoue cet acteur, que se passe-t-il ?">Plan d’émulation, résultats d’exercice.</Panel>
        <Panel accent="violet" label="Évaluation · RSSI" title="Que vaut ce produit face à cet acteur ?">Résultats d’Evaluations, analyse d’écart.</Panel>
        <div style={{ gridColumn: '1 / -1' }}>
          <Chain accent="ink" steps={[
            { id: <Tid accent="blue">rapport</Tid>, text: 'Une technique relevée dans le renseignement' },
            { id: <Tid accent="signal">calque</Tid>, text: 'devient une ligne du calque de détection' },
            { id: <Tid accent="orange">exercice</Tid>, text: 'un scénario d’émulation' },
            { id: <Tid accent="violet">achat</Tid>, text: 'et un critère d’évaluation' },
          ]} />
        </div>
      </Cols>
    ),
    notes: <p>Les mêmes identifiants permettent de passer de l’un à l’autre : une technique trouvée dans un rapport devient une ligne de calque, un scénario d’exercice et un critère d’achat.</p>,
  },
  {
    lesson: 'l02',
    title: 'Traduire un rapport en techniques',
    body: (
      <>
        <SSteps accent="blue" items={[
          { title: 'Isoler les comportements', text: 'Chaque verbe d’action : « appelle en se faisant passer pour le support », « exporte les objets du CRM ».' },
          { title: 'Trouver l’intention', text: 'Pourquoi à ce moment-là ? La tactique restreint le choix des techniques.' },
          { title: 'La technique la plus précise', text: 'Sous-technique si le rapport le permet ; sinon le parent, sans inventer de précision.' },
          { title: 'Garder la preuve', text: 'La phrase du rapport, la version d’ATT&CK, un niveau de confiance.' },
        ]} />
        <Note kind="tip">Sans la phrase source ni la version, personne ne peut relire ni corriger la traduction.</Note>
      </>
    ),
  },
  {
    lesson: 'l02',
    title: 'UNC6040 : le vishing devenu campagne C0059',
    body: (
      <>
        <Chain accent="blue" steps={[
          { id: <><Tid accent="orange">T1598.004</Tid><Tid>T1684.001</Tid></>, text: 'Appel en se faisant passer pour le support' },
          { id: <Tid accent="blue">T1671</Tid>, text: 'Autorisation d’une version modifiée de Data Loader' },
          { id: <Tid accent="blue">T1213.004</Tid>, text: 'Accès aux objets du CRM' },
          { id: <Tid accent="red">T1567</Tid>, text: 'Exfiltration par l’API' },
        ]} />
        <Cols cols={2} gap={24}>
          <Note kind="case">Juin 2025, Google Threat Intelligence : aucune vulnérabilité de Salesforce exploitée. La victime autorise elle-même l’application connectée.</Note>
          <Note kind="debate" title="Un choix à documenter">ATT&CK range l’appel sous <strong>T1598.004</strong> (Reconnaissance) plutôt que T1566.004 (Initial Access) : l’appel obtient une action et des identifiants, il ne livre pas de charge. Les deux lectures se défendent.</Note>
        </Cols>
      </>
    ),
    source: 'Google Threat Intelligence, juin 2025 · ATT&CK C0059',
  },
  {
    lesson: 'l02',
    title: 'Ce qui survit à la campagne',
    body: (
      <Cols cols={2} gap={32} align="start">
        <Panel accent="red" label="Périmé le mois prochain" title="Les adresses IP d’UNC6040">Indicateurs d’infrastructure : utiles quelques semaines au SOC, inutiles à la conception.</Panel>
        <Panel accent="green" label="Durable" title="Une application OAuth autorisée par téléphone, puis un export massif par API">Un comportement qui pose une question de conception à tout éditeur qui expose une API à des intégrations tierces, Novafact compris.</Panel>
      </Cols>
    ),
  },
  {
    lesson: 'l02',
    title: 'Détection : un calque honnête',
    body: (
      <>
        <Layer cells={[
          { id: 'T1621', score: 2, text: 'Règle mfa-push-burst, testée en recette (auth.mfa.challenge)' },
          { id: 'T1539', score: 1, text: 'Règle session-asn-change écrite, jamais testée sur un vrai rejeu' },
          { id: 'T1671', score: 0, text: 'Aucun événement à la création d’une intégration OAuth' },
          { id: 'T1564.008', score: 0, text: 'Équivalent Novafact : transfert automatique des factures' },
        ]} />
        <Cols cols={3} gap={22}>
          <Panel accent="signal" title="Testé ≠ écrit">Le score sépare ce qui a vu passer la procédure de ce qui existe sur le papier.</Panel>
          <Panel accent="signal" title="L’événement source nommé">Chaque commentaire cite le champ de journal.</Panel>
          <Panel accent="signal" title="La version fixée"><code>"attack": "19"</code> dans le fichier du calque.</Panel>
        </Cols>
      </>
    ),
    notes: <p>Fichier detection/layers/novafact-comptes-clients.json. Sans ces trois éléments, un calque produit une matrice très verte et très fausse. Une case colorée est une déclaration, pas une preuve.</p>,
    source: 'ATT&CK Navigator, format de calque v4.5',
  },
  {
    lesson: 'l02',
    title: 'Émulation : on rejoue des procédures',
    body: (
      <>
        <Cols cols={2} gap={32} align="start">
          <Panel accent="red" label="Ne se teste pas" title="« Tester T1621 »">Aucun critère de réussite ni d’échec.</Panel>
          <Panel accent="green" label="Se teste" title="Douze demandes MFA en quatre minutes à un compte de test, la treizième acceptée, depuis un ASN d’hébergeur">Un test qui peut réussir ou échouer, comme un bon cas de recette.</Panel>
        </Cols>
        <Cols cols={3} gap={22}>
          <Panel accent="orange" label="Bibliothèque" title="Center for Threat-Informed Defense">Plans d’émulation publiés.</Panel>
          <Panel accent="orange" label="Plateforme" title="MITRE Caldera">Automatise des chaînes de techniques.</Panel>
          <Panel accent="orange" label="Cloud et SaaS" title="Stratus Red Team">Rejoue des techniques sur des comptes de test.</Panel>
        </Cols>
      </>
    ),
    notes: <p>L’AppSec est bien placée pour écrire ces tests : elle sait quels événements l’application émet.</p>,
  },
  {
    lesson: 'l02',
    title: 'Évaluation : comparer sans classer',
    body: (
      <Cols cols="1fr 1fr" gap={36} align="start">
        <div className="stack" style={{ gap: 20 }}>
          <p className="slide-lead">Les ATT&CK Evaluations rejouent des scénarios inspirés d’acteurs réels contre des produits volontaires, et publient ce que chacun a détecté ou bloqué.</p>
          <Panel accent="violet" label="Édition Enterprise · décembre 2025" title="Scattered Spider et Mustang Panda">Pour la première fois, un scénario cloud.</Panel>
        </div>
        <div className="stack" style={{ gap: 18 }}>
          <Note kind="warn">MITRE ne classe pas les éditeurs. Un éditeur qui annonce « 100 % de détection » a choisi sa façon de compter.</Note>
          <Note kind="debate" title="La couverture comme indicateur ?">Visuelle et lisible par une direction, elle pousse aussi à multiplier les règles faibles et ignore la pertinence. Compromis : la couverture <strong>testée</strong> des techniques retenues dans les threat models et le renseignement sectoriel.</Note>
        </div>
      </Cols>
    ),
    source: 'MITRE ATT&CK Evaluations · SecurityWeek, résultats 2025',
  },
  {
    lesson: 'l02',
    title: 'Parler au SOC : la fiche de fonctionnalité',
    body: (
      <>
        <p className="slide-lead" style={{ maxWidth: 'none' }}>Exemple : les webhooks configurables par les clients de Novafact.</p>
        <Cols cols={4} gap={18}>
          <Panel accent="red" label="Technique visée" title="T1567">Exfiltration par service web</Panel>
          <Panel accent="blue" label="Événement" title={<code>webhook.created</code>}>Avec le domaine cible et l’âge de la session</Panel>
          <Panel accent="signal" label="Analytic proposée" title="Domaine jamais vu">pour ce tenant, et session de moins d’une heure</Panel>
          <Panel accent="violet" label="Réaction attendue" title="Runbook">Ce que fait l’analyste de nuit, sans deviner</Panel>
        </Cols>
        <Note kind="tip">L’événement doit exister avant la mise en production : c’est une exigence de conception, pas une demande du SOC après coup.</Note>
      </>
    ),
  },
  {
    lesson: 'l02',
    title: 'À retenir',
    body: (
      <Takeaways items={[
        'Renseignement, détection, émulation, évaluation : un vocabulaire qui permet de passer de l’un à l’autre.',
        'Traduire un rapport est un jugement : phrase source, version d’ATT&CK et niveau de confiance (C0059 range l’appel sous T1598.004).',
        'Un calque honnête distingue testé et écrit, nomme l’événement source et fixe la version.',
        'On émule des procédures précises ; les ATT&CK Evaluations ne classent pas les éditeurs.',
        'Chaque fonctionnalité sensible arrive au SOC avec sa technique, son événement et la réaction attendue.',
      ]} />
    ),
  },

  /* ================================================ 03 · Menace SaaS et identité */
  { lesson: 'l03', layout: 'section', title: 'La menace SaaS et identité' },
  {
    lesson: 'l03',
    title: 'Le SaaS, ou l’attaque par la fonctionnalité',
    body: (
      <STable widths={['18%', '26%', '22%', '34%']} head={['Famille', 'Techniques (v19)', 'Tactique', 'Ce qui est détourné']} rows={[
        ['Fatigue MFA', <Tid accent="orange">T1621</Tid>, 'Credential Access', 'La notification push qu’on approuve d’un geste'],
        ['Consentement OAuth', <><Tid accent="blue">T1528</Tid> <Tid accent="blue">T1671</Tid></>, 'Credential Access, Persistence', 'Un jeton qui survit au mot de passe'],
        ['Session rejouée', <><Tid accent="violet">T1539</Tid> <Tid accent="violet">T1550.004</Tid></>, 'Credential Access, Lateral Movement', 'Un cookie déjà validé par la MFA'],
        ['Règles de boîte mail', <><Tid accent="teal">T1564.008</Tid> <Tid accent="teal">T1114.003</Tid></>, 'Stealth, Collection', 'Les règles de tri et de transfert'],
        ['Partage externe', <><Tid accent="red">T1537</Tid> <Tid accent="red">T1567</Tid></>, 'Exfiltration', 'Liens publics, partage extérieur, export par API'],
      ]} />
    ),
    notes: <p>Ni réseau interne à traverser, ni poste à compromettre durablement : le périmètre, c’est l’identité. Rien de cela ne déclenche un antivirus.</p>,
  },
  {
    lesson: 'l03',
    title: 'Novafact est des deux côtés du tableau',
    body: (
      <Cols cols={2} gap={32} align="start">
        <Panel accent="ink" label="Client de SaaS" title="Les employés de Novafact">GitHub, AWS, la messagerie : les cinq familles s’appliquent à leurs comptes.</Panel>
        <Panel accent="signal" label="Éditeur de SaaS" title="Le produit de ses clients">Chaque famille a un équivalent dans Novafact : <strong>c’est celui-là que l’équipe conçoit</strong>.</Panel>
        <div style={{ gridColumn: '1 / -1' }}>
          <STable compact head={['Famille', 'Équivalent dans le produit Novafact']} rows={[
            ['Règles de boîte mail', 'Envoi automatique des factures à une adresse, webhooks de facturation'],
            ['Partage externe', 'Liens publics de facture, exports'],
            ['Consentement OAuth', 'Intégrations tierces qui détiennent des jetons sur l’API'],
          ]} />
        </div>
      </Cols>
    ),
  },
  {
    lesson: 'l03',
    title: 'Fatigue MFA : approuver d’un geste',
    body: (
      <Cols cols="1fr 1fr" gap={36} align="start">
        <div className="stack" style={{ gap: 18 }}>
          <p className="slide-lead">L’attaquant connaît le mot de passe et déclenche des demandes en série jusqu’à l’acceptation, souvent après un message qui se fait passer pour le support.</p>
          <STable compact head={['Méthode (CISA)', 'Push bombing']} rows={[
            ['Push sans correspondance de nombre', <span className="s-ko">vulnérable</span>],
            ['Push avec correspondance de nombre', <span className="s-ok">résiste</span>],
          ]} />
          <Note kind="case">Microsoft impose la correspondance de nombre à tous les utilisateurs d’Authenticator à partir du 8 mai 2023.</Note>
        </div>
        <Panel accent="signal" label="Côté produit" title="Trois décisions">
          <Points items={[
            'Pas de push sans correspondance de nombre.',
            'Limite de demandes par compte et par heure.',
            <>Un événement <code>auth.mfa.challenge</code> avec son résultat : une rafale de refus suivie d’une acceptation devient visible.</>,
          ]} />
        </Panel>
      </Cols>
    ),
    notes: <p>Le troisième point est exactement ce que décrit l’analytic SaaS de DET0160 (séquence 1). FIDO2 reste la cible.</p>,
    source: 'CISA, Implementing Phishing-Resistant MFA (2022)',
  },
  {
    lesson: 'l03',
    title: 'Consentement OAuth : le risque change de porteur',
    body: (
      <Cols cols="1fr 1.2fr" gap={36} align="start">
        <div className="stack" style={{ gap: 18 }}>
          <p className="slide-lead">Une fois le jeton délivré, plus aucune connexion interactive n’a lieu, donc <strong>plus aucune MFA ne s’applique</strong>.</p>
          <Note kind="tip">Chaque intégration tierce est un porteur de jetons qui peut tomber. Le client doit pouvoir voir, restreindre et révoquer ce qu’elle fait, sans ouvrir de ticket.</Note>
        </div>
        <div className="stack" style={{ gap: 14 }}>
          <span className="s-label">Salesloft Drift · UNC6395 · août 2025</span>
          <Chain accent="red" steps={[
            { id: <Tid accent="red">8 → 18 août</Tid>, text: 'Jetons volés de l’intégration, exports d’instances Salesforce' },
            { id: <Tid>pendant</Tid>, text: 'Recherche de clés AWS, mots de passe, jetons Snowflake' },
            { id: <Tid accent="green">20 août</Tid>, text: 'Révocation de tous les jetons de l’application', tone: 'stop' },
          ]} />
          <p className="small dim m0">L’attaquant supprime ses tâches de requête ; les journaux restent intacts.</p>
        </div>
      </Cols>
    ),
    source: 'Google Threat Intelligence, août 2025',
  },
  {
    lesson: 'l03',
    title: 'AiTM : la MFA a lieu, pour le compte de l’attaquant',
    body: <Aitm />,
    notes: <p>Seule une méthode liée à l’origine, comme WebAuthn, refuse de signer pour le domaine du proxy. Le secret TOTP ne quitte jamais l’application ; le code est simplement utilisé pendant sa fenêtre de validité.</p>,
  },
  {
    lesson: 'l03',
    title: 'Du cookie volé à la fraude au virement',
    body: (
      <>
        <Chain accent="violet" steps={[
          { id: <Tid accent="violet">T1539</Tid>, text: 'Cookie de session volé par le proxy' },
          { id: <Tid accent="violet">T1550.004</Tid>, text: 'Session rejouée, boîte mail ouverte' },
          { id: <Tid accent="teal">T1564.008</Tid>, text: 'Règle qui range les réponses dans Archive' },
          { id: <Tid accent="red">T1657</Tid>, text: 'Fraude au virement, traces supprimées' },
        ]} />
        <Cols cols="1.1fr 1fr" gap={28}>
          <Note kind="case">Juillet 2022, Microsoft : une campagne AiTM a visé plus de 10 000 organisations depuis septembre 2021. Parfois moins de cinq minutes entre le vol du cookie et la règle de boîte mail.</Note>
          <Panel accent="signal" label="Côté produit" title="Réduire la valeur du cookie">Sessions courtes pour les admins, révocation de toutes les sessions au changement de facteur, événement sur un changement brutal d’ASN ou d’empreinte client.</Panel>
        </Cols>
      </>
    ),
    source: 'Microsoft, From cookie theft to BEC (juillet 2022)',
  },
  {
    lesson: 'l03',
    title: 'La persistance qui ne se voit pas',
    body: (
      <>
        <p className="slide-lead" style={{ maxWidth: 'none' }}>La règle de boîte mail tourne sans session ouverte et la victime ne la regarde jamais. Novafact a trois fonctions qui jouent le même rôle :</p>
        <Cols cols={3} gap={22}>
          <Panel accent="teal" label="T1114.003 · équivalent" title="Envoi automatique">Toutes les factures vers une adresse choisie.</Panel>
          <Panel accent="teal" label="T1567 · équivalent" title="Webhooks de facturation">Chaque événement poussé vers une URL externe.</Panel>
          <Panel accent="teal" label="T1537 · équivalent" title="Liens publics de facture">Un accès qui ne demande aucune session.</Panel>
        </Cols>
        <Note kind="warn">Installée depuis une session d’administrateur client volée, cette sortie de données <strong>survit à la réinitialisation du mot de passe</strong>.</Note>
      </>
    ),
  },
  {
    lesson: 'l03',
    title: 'Créer un webhook : step-up, audit, notification',
    body: (
      <Cols cols="1.65fr 1fr" gap={24} align="start">
        <SCode file="apps/api/src/routes/webhooks.ts" tone="good" hl="2,3,4,5,6,12,13,14,15" code={`router.post('/webhooks', requireSession, requireRole('admin'), async (req, res) => {
  // AiTM et infostealer livrent le mot de passe avec la session :
  // seule une preuve WebAuthn récente, liée à l'origine, ne se rejoue pas.
  const stepUp = await verifyStepUp(req, { action: 'webhook.create', maxAgeSec: 300 });
  if (!stepUp.ok) throw new HttpError(401, 'step_up_required');
  const { url, events } = bodyOf(req, webhookSchema); // https, pas d'IP privée
  const hook = await webhooks.create({
    tenantId: req.user.tenantId, url, events, createdBy: req.user.id,
  });
  const host = new URL(url).host;
  // Ce que la règle cachée exploite, c'est le silence.
  audit('webhook.created', {
    hookId: hook.id, targetHost: host, sessionAgeSec: req.session.ageSec,
  });
  await notifyTenantAdmins(req.user.tenantId, 'webhook.created', { host });
  res.status(201).json(hook);
});`} />
        <div className="stack" style={{ gap: 14 }}>
          <Panel accent="red" label="Mauvais correctif 1" title="Redemander le mot de passe">L’attaquant qui sort d’un proxy AiTM vient de le lire en clair.</Panel>
          <Panel accent="red" label="Mauvais correctif 2" title="Notifier le créateur">C’est la boîte où l’attaquant a peut-être déjà posé sa règle de masquage. La notification part vers <strong>tous</strong> les admins.</Panel>
        </div>
      </Cols>
    ),
  },
  {
    lesson: 'l03',
    title: 'Ce qui relève de l’application',
    body: (
      <>
        <STable widths={['24%', '76%']} head={['Technique', 'Ce que le produit peut faire']} rows={[
          [<Tid accent="orange">T1621</Tid>, 'Pas de push sans correspondance de nombre, limite de demandes, événement par tentative'],
          [<><Tid accent="blue">T1528</Tid> <Tid accent="blue">T1671</Tid></>, 'Scopes étroits, éditeurs vérifiés, page de révocation par intégration, restrictions d’origine'],
          [<><Tid accent="violet">T1539</Tid> <Tid accent="violet">T1550</Tid></>, 'Sessions courtes pour les admins, révocation globale, confirmation WebAuthn sur les actions sensibles'],
          [<><Tid accent="teal">T1114.003</Tid> <Tid accent="teal">T1564.008</Tid></>, 'Règles et webhooks journalisés, notifiés à tous les admins, listés dans une page unique'],
          [<><Tid accent="red">T1537</Tid> <Tid accent="red">T1567</Tid></>, 'Liens publics expirants, exports massifs journalisés et limités'],
        ]} />
        <Note kind="tip">Aucune de ces mesures ne demande de produit de sécurité : ce sont des décisions de conception, prises à la spécification et vérifiées en revue.</Note>
      </>
    ),
  },
  {
    lesson: 'l03',
    title: 'À retenir',
    body: (
      <Takeaways items={[
        'Dans le SaaS, l’attaquant utilise les fonctionnalités prévues : identité, API, intégrations, règles, partage.',
        'Fatigue MFA : correspondance de nombre au minimum, limite de demandes, événement par tentative ; FIDO2 en cible.',
        'Un jeton délivré n’est plus soumis à la MFA : le risque se reporte sur ceux qui détiennent les jetons.',
        'AiTM et infostealers livrent la session et le mot de passe : redemander le mot de passe ne prouve rien.',
        'Webhooks, envois automatiques et liens publics sont les règles de boîte mail de Novafact.',
      ]} />
    ),
  },

  /* ================================================== 04 · Les mitigations */
  { lesson: 'l04', layout: 'section', title: 'Se protéger : les mitigations qui comptent' },
  {
    lesson: 'l04',
    title: 'Ce qu’est une mitigation ATT&CK',
    body: (
      <Cols cols="1fr 1.1fr" gap={40} align="start">
        <div className="stack" style={{ gap: 22 }}>
          <Stat value="44" label="mitigations Enterprise actives en v19.2" accent="signal" />
          <p className="slide-lead">Une <strong>catégorie</strong> de mesure, volontairement générique. Chaque technique liste ses mitigations avec une phrase d’application : c’est cette phrase qui a de la valeur, plus que l’identifiant.</p>
        </div>
        <div className="stack" style={{ gap: 16 }}>
          <Panel accent="orange" label="Limite 1" title="« Mitigates » veut dire aider, pas bloquer">Le lien ne dit pas dans quelle mesure la technique est empêchée.</Panel>
          <Panel accent="orange" label="Limite 2" title="Rien sur l’effort de déploiement">« Audit » peut être une revue trimestrielle ou un pipeline de détection complet.</Panel>
        </div>
      </Cols>
    ),
    source: 'MITRE ATT&CK, mitigations Enterprise',
  },
  {
    lesson: 'l04',
    title: 'Les mesures qui couvrent le plus de techniques SaaS et identité',
    body: (
      <>
        <Bars max={39} unit="techniques reliées" rows={[
          { label: 'M1018 User Account Management', value: 39, note: 'Moindre privilège, revue des accès' },
          { label: 'M1047 Audit', value: 35, note: 'Configurations, intégrations, journaux' },
          { label: 'M1032 Multi-factor Authentication', value: 28, hot: true, note: 'Idéalement résistante au phishing' },
          { label: 'M1017 User Training', value: 23, note: 'Faux support, consentement piégé' },
          { label: 'M1026 Privileged Account Management', value: 22, note: 'Élévation juste à temps' },
          { label: 'M1054 Software Configuration', value: 15, note: 'Sessions, partage, transfert' },
          { label: 'M1036 Account Use Policies', value: 11, note: 'Accès conditionnel, origine' },
        ]} />
        <p className="small dim m0">Techniques actives des plateformes SaaS, Identity Provider et Office Suite (une centaine) reliées à chaque mitigation, ATT&CK v19.2.</p>
      </>
    ),
    notes: <p>Ce décompte est un point de départ, pas une conclusion : la slide suivante explique pourquoi M1032 est surlignée alors qu’elle n’est que troisième.</p>,
  },
  {
    lesson: 'l04',
    title: 'Compter des liens ne mesure pas l’efficacité',
    body: (
      <Cols cols={2} gap={32} align="start">
        <Panel accent="ink" label="M1017 · M1047" title="Hautes parce que larges">La formation <em>réduit la probabilité</em> qu’un utilisateur se trompe. Un utilisateur fatigué finit par approuver.</Panel>
        <Panel accent="signal" tone="soft" label="M1032" title="Moins de liens, mais des liens forts">Une clé FIDO2 rend la fatigue MFA et le proxy AiTM <strong>sans objet</strong> : il n’y a plus rien à approuver ni à relayer.</Panel>
      </Cols>
    ),
  },
  {
    lesson: 'l04',
    title: 'Snowflake, 2024 : trois mitigations banales, absentes ensemble',
    body: (
      <>
        <Cols cols={3} gap={22}>
          <Panel accent="red" label="M1032 absente" title="Pas de MFA">Sur les comptes utilisés.</Panel>
          <Panel accent="red" label="M1027 absente" title="Identifiants jamais changés">Volés par des infostealers, parfois dès novembre 2020.</Panel>
          <Panel accent="red" label="M1036 absente" title="Pas de liste d’adresses">Connexion acceptée de partout.</Panel>
        </Cols>
        <Cols cols="220px 1fr" gap={32} align="center">
          <Stat value="≈ 165" label="organisations potentiellement exposées, prévenues" accent="red" />
          <Note kind="case">Mandiant (UNC5537, juin 2024) ne trouve aucune compromission de l’environnement de Snowflake. Chacune des trois mesures fermait à elle seule cette porte d’entrée-là.</Note>
        </Cols>
      </>
    ),
    source: 'Mandiant, UNC5537 et Snowflake (juin 2024)',
  },
  {
    lesson: 'l04',
    title: 'L’ordre de déploiement',
    body: (
      <>
        <SSteps cols={3} items={[
          { title: 'MFA résistante au phishing là où sont les clés', text: 'Admins, support, comptes à privilèges ; puis supprimer les replis SMS et e-mail.' },
          { title: 'Fermer ce qui est oublié', text: 'Tenants de test, comptes de prestataires partis, protocoles hérités sans MFA.' },
          { title: 'Gouverner consentements et intégrations', text: 'Approbation par un admin, inventaire, révocation des jetons inutilisés.' },
          { title: 'Journaliser, conserver, rendre lisible', text: 'Les accès aux données, pas seulement les connexions.' },
          { title: 'Réduire et encadrer les privilèges', text: 'Une poignée d’admins, juste à temps, alerte sur chaque attribution.' },
          { title: 'Former, en appui', text: 'Jamais à la place des mesures techniques.' },
        ]} />
        <p className="small dim m0">Critères : ce que la mesure retire à l’attaquant, ce qu’elle coûte, et si elle protège ceux qui détiennent les clés.</p>
      </>
    ),
    notes: (
      <>
        <p>Étape 1 : c’est l’ordre que recommande la CISA, en commençant par les services qui acceptent déjà FIDO2. Sans retrait des replis faibles, l’attaquant choisit le facteur.</p>
        <p>Étape 2 : Midnight Blizzard est entré par un tenant de test. Étape 3 : depuis septembre 2025, Salesforce bloque les applications connectées non installées par un administrateur, sauf permission dédiée.</p>
      </>
    ),
  },
  {
    lesson: 'l04',
    title: 'Prouver qu’une mitigation est en place',
    body: (
      <>
        <STable widths={['14%', '64%', '22%']} head={['Mitigation', 'Indicateur chez Novafact', 'Seuil']} rows={[
          ['M1032', 'Part des comptes à privilèges avec passkey et sans repli SMS', <b className="s-num">100 %</b>],
          ['M1018', 'Intégrations OAuth sans propriétaire interne identifié', <b className="s-num">0</b>],
          ['M1026', 'Administrateurs permanents par SaaS critique', <b className="s-num">3 au plus</b>],
          ['M1047', 'Rétention effective des journaux d’accès, mesurée sur l’événement le plus ancien', <b className="s-num">180 jours</b>],
          ['M1054', 'Durée maximale d’une session d’administration', <b className="s-num">8 heures</b>],
        ]} />
        <Note kind="tip">L’indicateur se mesure sur l’état réel (API du fournisseur d’identité, configuration exportée), jamais sur une déclaration.</Note>
      </>
    ),
  },
  {
    lesson: 'l04',
    title: 'De l’autre côté du guichet : des défauts sûrs',
    body: (
      <>
        <STable compact widths={['20%', '27%', '33%', '20%']} head={['Paramètre du tenant', 'Avant', 'Après', 'Pourquoi']} rows={[
          [<code>auditLog</code>, 'Offre Entreprise seule, 30 jours', 'Toutes les offres, 183 jours, accès du fournisseur inclus', 'CSRB, recommandation 10'],
          [<code>mfa</code>, 'Facultative ; TOTP, SMS, passkey', 'Exigée pour owner et admin ; passkey, TOTP ; pas de repli SMS', 'Rôles qui tiennent les clés'],
          [<code>integrations</code>, 'Consentement par l’utilisateur', 'Approbation par un administrateur', 'Consentement piégé'],
          [<code>publicInvoiceLinks</code>, 'Sans expiration', 'Expiration à 30 jours', 'Partage externe'],
        ]} />
        <Note kind="case">Après Storm-0558, le Cyber Safety Review Board recommande que tout accès aux données des clients, y compris par le fournisseur, produise des journaux <strong>sans surcoût</strong>, conservés au moins six mois.</Note>
      </>
    ),
    notes: <p>Fichier apps/api/src/tenants/defaults.ts. Une MFA que le produit ne propose pas, un journal qu’il ne produit pas, une intégration qu’il ne sait pas révoquer : autant de mitigations impossibles chez le client.</p>,
    source: 'Cyber Safety Review Board, 20 mars 2024',
  },
  {
    lesson: 'l04',
    title: 'Deux correctifs qui ne tiennent pas',
    body: (
      <Cols cols={2} gap={28} align="start">
        <Panel accent="red" label="Livré en premier" title="MFA exigée des admins… à la connexion">Un utilisateur connecté sans MFA puis promu admin pendant sa session garde ses nouveaux droits sans facteur. Correction : le niveau d’authentification de la session, réévalué à chaque élévation.</Panel>
        <Panel accent="red" label="« Pour ne bloquer personne »" title="Le SMS gardé en repli">La passkey devient facultative pour un attaquant qui fait transférer la ligne.</Panel>
        <div style={{ gridColumn: '1 / -1' }}>
          <Note kind="debate" title="Sécurisé par défaut, ou configurable ?">Laisser le choix déplace la décision vers ceux qui ont le moins d’informations pour la prendre. Compromis de Novafact : défauts sûrs, dérogation possible par un propriétaire du tenant, journalisée et rappelée chaque trimestre.</Note>
        </div>
      </Cols>
    ),
  },
  {
    lesson: 'l04',
    title: 'À retenir',
    body: (
      <Takeaways items={[
        'Une mitigation ATT&CK est une catégorie ; la phrase qui l’applique à chaque technique vaut plus que l’identifiant.',
        'M1018, M1047, M1032, M1017 et M1026 couvrent le plus ; compter des liens ne mesure pas l’efficacité.',
        'Ordre : MFA résistante au phishing pour les détenteurs des clés, l’oublié, les intégrations, les journaux, les privilèges, puis la formation.',
        'Snowflake 2024 : trois mitigations banales absentes, aucune faille de plateforme.',
        'Un éditeur SaaS rend possibles, ou impossibles, les mitigations de ses clients.',
      ]} />
    ),
  },

  /* ==================================================== 05 · Cas réels */
  { lesson: 'l05', layout: 'section', title: 'Cas réels décortiqués' },
  {
    lesson: 'l05',
    title: 'Lire un cas sans se tromper de source',
    body: (
      <>
        <Cols cols={3} gap={22}>
          <Panel accent="green" label="Fait établi" title="La victime, un enquêteur mandaté">Formulaire 8-K, rapport d’incident, rapport du CSRB.</Panel>
          <Panel accent="orange" label="À signaler" title="L’attaquant">Une revendication sert sa négociation : elle peut être vraie, elle ne vaut pas un rapport d’enquête.</Panel>
          <Panel accent="ink" label="À recouper" title="La presse">Reconstitue, parfois avec des détails absents de toute source officielle.</Panel>
        </Cols>
        <div className="row" style={{ gap: 16 }}>
          <span className="s-legend"><i className="solid" /> étape documentée</span>
          <span className="s-legend"><i className="dashed" /> étape revendiquée seulement</span>
        </div>
      </>
    ),
  },
  {
    lesson: 'l05',
    title: 'Six affaires, deux ans',
    body: (
      <Gantt rows={[
        { label: 'Uber', from: 2, to: 2, text: 'sept. 2022 · fatigue MFA', accent: 'orange' },
        { label: 'CircleCI', from: 5, to: 6.2, text: 'déc. 2022 – janv. 2023 · session rejouée', accent: 'violet' },
        { label: 'Storm-0558', from: 10, to: 12, text: 'mai – juil. 2023 · jetons forgés', accent: 'red' },
        { label: 'MGM Resorts', from: 14, to: 14, text: 'sept. 2023 · support informatique', accent: 'orange' },
        { label: 'Midnight Blizzard', from: 16, to: 18.4, text: 'nov. 2023 – janv. 2024 · tenant de test', accent: 'blue' },
        { label: 'Snowflake', from: 21, to: 23, text: 'avr. – juin 2024 · identifiants volés', accent: 'teal' },
      ]} />
    ),
    notes: <p>Fil conducteur à faire émerger par le groupe avant la fin de la séquence : aucun de ces cas ne commence par une injection SQL.</p>,
  },
  {
    lesson: 'l05',
    title: 'Uber, septembre 2022',
    body: (
      <>
        <Chain accent="orange" steps={[
          { id: <Tid>T1078</Tid>, text: 'Mot de passe d’un prestataire', note: 'Probablement acheté après infection de son appareil personnel' },
          { id: <Tid accent="orange">T1621</Tid>, text: 'Demandes d’approbation répétées', note: 'Le prestataire finit par accepter' },
          { id: <Tid>T1078</Tid>, text: 'Autres comptes d’employés, droits élevés' },
          { id: <Tid>SaaS</Tid>, text: 'G-Suite, Slack et d’autres outils internes' },
        ]} />
        <Cols cols={2} gap={24}>
          <Panel accent="green" label="Ce qui casse la chaîne" title="Une MFA qui ne s’approuve pas d’un geste">Correspondance de nombre, FIDO2 ; alerte sur une rafale de demandes refusées.</Panel>
          <Note kind="case">Uber rattache l’attaquant à Lapsus$ (G1004).</Note>
        </Cols>
      </>
    ),
    source: 'Uber, Security update (septembre 2022)',
  },
  {
    lesson: 'l05',
    title: 'MGM Resorts, septembre 2023 : ce qui est établi, ce qui est revendiqué',
    body: (
      <>
        <Cols cols="1fr 1.6fr" gap={28} align="start">
          <Panel accent="green" label="Formulaire 8-K du 5 octobre 2023" title="L’impact">≈ 100 M$ sur l’Adjusted Property EBITDAR, moins de 10 M$ de frais ponctuels, données personnelles de clients volées. Aucune attribution à un groupe.</Panel>
          <Chain accent="orange" steps={[
            { id: <><Tid>T1598.004</Tid><Tid>T1684.001</Tid></>, text: 'Appel au support', tone: 'claim' },
            { id: <Tid>T1556.006</Tid>, text: 'Réinitialisation, nouveau facteur', tone: 'claim' },
            { id: <Tid>T1486</Tid>, text: 'Chiffrement', tone: 'claim' },
          ]} />
        </Cols>
        <Note kind="warn">Le mode opératoire vient de la revendication d’ALPHV et de la presse ; MGM ne l’a pas confirmé. Il est en revanche documenté par la CISA pour Scattered Spider (G1015). Ce qui casse la chaîne : une réinitialisation qui ne repose jamais sur ce que l’appelant sait dire de lui-même.</Note>
      </>
    ),
    source: 'MGM Resorts, 8-K · CISA AA23-320A',
  },
  {
    lesson: 'l05',
    title: 'CircleCI : une session validée par la 2FA vaut la 2FA',
    body: (
      <>
        <Chain accent="violet" steps={[
          { id: <Tid accent="violet">16 déc.</Tid>, text: 'Malware sur le portable d’un ingénieur', note: 'Vol d’une session SSO déjà validée par la 2FA (T1539)' },
          { id: <Tid accent="violet">→ 19 déc.</Tid>, text: 'Session rejouée, élévation, reconnaissance', note: 'T1550.004' },
          { id: <Tid accent="red">22 déc.</Tid>, text: 'Exfiltration de variables, jetons et clés de clients', note: 'Clés extraites de la mémoire d’un processus' },
          { id: <Tid accent="blue">29 déc. · 4 janv.</Tid>, text: 'Signalement d’un client, puis rapport public' },
        ]} />
        <Panel accent="green" label="Ce qui casse la chaîne" title="Sessions courtes et liées à l’appareil, step-up pour la production, secrets clients à courte durée de vie" />
      </>
    ),
    notes: <p>Les données étaient chiffrées au repos : ce n’est pas le chiffrement qui manquait. CircleCI annonce ensuite des étapes d’authentification renforcée et un accès à la production réduit à très peu d’employés.</p>,
    source: 'CircleCI, rapport d’incident du 4 janvier 2023',
  },
  {
    lesson: 'l05',
    title: 'Snowflake : des requêtes qu’aucun humain ne produit',
    body: (
      <Cols cols="1.3fr 1fr" gap={28} align="start">
        <Chain accent="teal" steps={[
          { id: <Tid accent="teal">T1078.004</Tid>, text: 'Comptes cloud valides, sans MFA' },
          { id: <Tid>Discovery</Tid>, text: 'Énumération des bases' },
          { id: <><Tid accent="teal">T1213.006</Tid><Tid>T1074</Tid></>, text: 'Collecte et préparation' },
          { id: <Tid accent="red">T1657</Tid>, text: 'Extorsion' },
        ]} />
        <SCode lang="sql" file="commandes relevées par Mandiant (UNC5537)" code={`SHOW TABLES             -- énumérer
CREATE TEMPORARY STAGE  -- préparer
COPY INTO               -- copier vers le stage
GET                     -- rapatrier`} />
      </Cols>
    ),
    notes: <p>Côté détection : des volumes de requêtes qu’aucun utilisateur humain ne produit. Côté prévention : MFA, rotation des identifiants, restriction réseau.</p>,
    source: 'Mandiant, UNC5537 (juin 2024)',
  },
  {
    lesson: 'l05',
    title: 'Midnight Blizzard : des identités applicatives oubliées',
    body: (
      <>
        <Chain accent="blue" steps={[
          { id: <Tid accent="blue">T1110.003</Tid>, text: 'Pulvérisation sur un tenant de test sans MFA' },
          { id: <Tid accent="blue">T1078.004</Tid>, text: 'Compte du tenant de test compromis' },
          { id: <><Tid accent="blue">T1671</Tid><Tid>T1136.003</Tid></>, text: 'Application OAuth de test, puis nouvelles applications' },
          { id: <Tid accent="orange">T1098.003</Tid>, text: <>Rôle <code>full_access_as_app</code></> },
          { id: <Tid accent="red">T1114.002</Tid>, text: 'Lecture par EWS des boîtes de dirigeants' },
        ]} />
        <Cols cols={2} gap={24}>
          <Panel accent="green" label="Ce qui casse la chaîne" title="MFA sur tous les tenants, alerte sur toute attribution de rôle applicatif à privilèges" />
          <Note kind="case">L’acteur cherche d’abord ce que Microsoft sait de lui. Aucune vulnérabilité des produits Microsoft en cause.</Note>
        </Cols>
      </>
    ),
    source: 'Microsoft, Midnight Blizzard : guide pour les équipes de réponse (janv. 2024)',
  },
  {
    lesson: 'l05',
    title: 'Storm-0558 : une clé de 2016',
    body: (
      <>
        <Chain accent="red" steps={[
          { id: <Tid>?</Tid>, text: 'Clé de signature MSA obtenue', note: 'Moyen inconnu au moment du rapport' },
          { id: <Tid accent="red">T1606</Tid>, text: 'Jetons forgés' },
          { id: <Tid accent="red">T1550.001</Tid>, text: 'Acceptés par Exchange Online d’entreprise' },
          { id: <Tid accent="red">T1114.002</Tid>, text: 'Lecture de courrier' },
        ]} />
        <Cols cols={4} gap={20}>
          <Stat value="2016" label="création de la clé grand public, à retirer en 2021" accent="red" />
          <Stat value="2021" label="rotation manuelle arrêtée après une panne, sans alerte sur l’âge" />
          <Stat value="22" label="organisations, et 503 comptes personnels" />
          <Stat value="≈ 60 000" label="courriels du seul Département d’État" />
        </Cols>
      </>
    ),
    source: 'Cyber Safety Review Board, 20 mars 2024',
  },
  {
    lesson: 'l05',
    title: 'Une détection n’existe que si la source existe',
    body: (
      <Cols cols="1.2fr 1fr" gap={36} align="start">
        <Note kind="case" title="« Big Yellow Taxi »">Ce n’est pas Microsoft qui détecte Storm-0558, mais le Département d’État, mi-juin 2023, avec une règle maison appliquée au journal <code>MailItemsAccessed</code>. Ce journal n’était accessible qu’avec une licence haut de gamme, que peu de victimes avaient.</Note>
        <Panel accent="signal" tone="soft" label="La conséquence pour un éditeur" title="Journaux d’audit par défaut, sans surcoût, six mois au moins">C’est la recommandation du CSRB reprise dans les défauts de Novafact (séquence 4).</Panel>
      </Cols>
    ),
    source: 'Cyber Safety Review Board, 20 mars 2024',
  },
  {
    lesson: 'l05',
    title: 'Ce qui revient, et ce qu’en fait Novafact',
    body: (
      <STable compact widths={['32%', '24%', '44%']} head={['Motif', 'Cas', 'Contrôle de conception']} rows={[
        ['Mot de passe valide, facteur absent ou contourné', 'Uber, Snowflake, Midnight Blizzard', 'Passkey imposée aux rôles sensibles, pas de repli SMS'],
        ['Le support comme porte d’entrée', 'MGM (revendiqué)', 'Réinitialisation de facteur par un second canal vérifié'],
        ['Session valide rejouée', 'CircleCI', 'Sessions d’admin courtes, révocation globale, step-up'],
        ['Identités applicatives oubliées', 'Midnight Blizzard', 'Inventaire des applications OAuth, alertes sur les rôles'],
        ['Secrets cryptographiques sans cycle de vie', 'Storm-0558', 'Rotation automatique des clés, alerte sur l’âge'],
        ['Détection dépendante d’un journal payant', 'Storm-0558', 'Journaux d’accès aux données pour tous les clients'],
      ]} />
    ),
    notes: <p>Tous passent par l’identité, et la plupart par une décision prise des années plus tôt : un tenant de test jamais fermé, une rotation suspendue, une MFA rendue optionnelle.</p>,
  },
  {
    lesson: 'l05',
    title: 'À retenir',
    body: (
      <Takeaways items={[
        'Séparer ce que disent la victime et les enquêteurs de ce que revendique l’attaquant : MGM documente l’impact, pas le mode opératoire.',
        'Uber, Snowflake, Midnight Blizzard : un mot de passe valide, un facteur absent ou contourné, aucune faille de plateforme.',
        'CircleCI : une session validée par la 2FA vaut la 2FA ; les clés ont été lues en mémoire.',
        'Storm-0558 : clé de 2016, rotation arrêtée en 2021, validation trop large, détection par un client.',
        'Chaque motif devient un contrôle de conception.',
      ]} />
    ),
  },

  /* ============================================ 06 · Du TTP à la classe de bug */
  { lesson: 'l06', layout: 'section', title: 'Du TTP à la classe de bug' },
  {
    lesson: 'l06',
    title: 'Remonter la chaîne',
    body: (
      <>
        <Chain accent="signal" steps={[
          { id: <><Tid accent="blue">T1606</Tid><Tid accent="blue">T1550.004</Tid></>, text: 'Le renseignement arrive en techniques' },
          { id: <Tid accent="signal">AppSec</Tid>, text: 'La traduction : quelle ligne de notre code permettrait à cette technique de réussir chez nous ?' },
          { id: <><Tid>CWE</Tid><Tid>SAST</Tid><Tid>tests</Tid></>, text: 'Le backlog se remplit de faiblesses, de règles et de tests' },
        ]} />
        <Cols cols={2} gap={24}>
          <Panel accent="orange" label="Constat 1" title="Le lien ne se lit plus que d’un côté">En v19, les fiches ATT&CK ne citent plus CAPEC. Les correspondances vivent dans CAPEC 3.9, de janvier 2023 : CAPEC-578 pointe encore vers <Tid off>T1562.008</Tid>.</Panel>
          <Panel accent="orange" label="Constat 2" title="Beaucoup de techniques SaaS n’ont pas de motif">T1621 et T1671 : l’attaquant utilise une fonction qui marche comme prévu. La faiblesse est une décision de conception, à nommer soi-même.</Panel>
        </Cols>
      </>
    ),
    notes: <p>Le module 11 (leçon 4) parcourt la chaîne CWE → CAPEC → ATT&CK dans le sens du threat model. Ici, on la remonte depuis une technique observée.</p>,
    source: 'MITRE CAPEC, version 3.9',
  },
  {
    lesson: 'l06',
    title: 'Ce que donnent les correspondances existantes',
    body: (
      <>
        <STable compact widths={['23%', '17%', '24%', '36%']} head={['Technique', 'CAPEC 3.9', 'CWE listées par CAPEC', 'CWE qui comptent chez Novafact']} rows={[
          ['T1539 Steal Web Session Cookie', 'CAPEC-21, 31', 'CWE-384, 539, 315…', <><Tid accent="signal">CWE-1004</Tid> <Tid accent="signal">CWE-613</Tid></>],
          ['T1550.004 Web Session Cookie', 'CAPEC-60', 'CWE-294, 384, 613…', <><Tid accent="signal">CWE-613</Tid> session non liée à l’appareil</>],
          ['T1528 Steal App. Access Token', 'CAPEC-21', 'CWE-290, 346, 384…', <><Tid accent="signal">CWE-522</Tid> <Tid accent="signal">CWE-532</Tid></>],
          ['T1606 Forge Web Credentials', 'CAPEC-196', 'CWE-384, 664', <><Tid accent="signal">CWE-324</Tid> <Tid accent="signal">CWE-345</Tid></>],
          ['T1621 MFA Request Generation', <span className="dim">aucun</span>, '—', <><Tid accent="signal">CWE-307</Tid> <Tid accent="signal">CWE-1390</Tid></>],
          ['T1671 Cloud App. Integration', <span className="dim">aucun</span>, '—', <><Tid accent="signal">CWE-1220</Tid> <Tid accent="signal">CWE-451</Tid></>],
        ]} />
        <Note kind="tip">La colonne de droite est la seule qui produise un ticket. Les CWE de CAPEC sont des candidates : on garde celles qui correspondent à un endroit précis du code.</Note>
      </>
    ),
  },
  {
    lesson: 'l06',
    title: 'Storm-0558 : la chaîne générique se trompe de cause',
    body: (
      <div className="s-tree" style={{ gridTemplateColumns: '230px 70px 1fr' }}>
        <Panel accent="red" label="Technique" title="T1606">Forge Web Credentials</Panel>
        <Fork to={2} />
        <div className="stack" style={{ gap: 16 }}>
          <Panel accent="ink" label="Ce que propose CAPEC-196" title={<><Tid off>CWE-384</Tid> <Tid off>CWE-664</Tid></>}>La fixation de session : sans rapport avec l’incident.</Panel>
          <Panel accent="signal" tone="soft" label="Ce qu’établit le CSRB" title={<><Tid accent="signal">CWE-324</Tid> <Tid accent="signal">CWE-345</Tid></>}>
            Une clé de 2016 utilisée après sa date de retrait, rotation suspendue sans alerte sur l’âge ; une validation qui acceptait une clé grand public pour des comptes d’entreprise.
          </Panel>
        </div>
      </div>
    ),
    source: 'CAPEC-196 · Cyber Safety Review Board, 20 mars 2024',
  },
  {
    lesson: 'l06',
    title: 'Le motif Storm-0558 dans un SaaS multi-tenant',
    body: (
      <>
        <SCode file="apps/api/src/auth/sso/verify.ts · vulnérable" tone="bad" hl="1,4,5,8" code={`const keysByKid = new Map<string, CryptoKey>(); // tous les IdP clients

export async function verifySsoToken(idToken: string) {
  const { kid } = decodeProtectedHeader(idToken);
  const key = keysByKid.get(kid ?? '');
  if (!key) throw new HttpError(401, 'unknown_key');
  const { payload } = await jwtVerify(idToken, key, { algorithms: ['RS256', 'ES256'] });
  const tenant = await tenants.byIssuer(String(payload.iss)); // le jeton choisit
  return { tenant, subject: payload.sub };
}`} />
        <Chain accent="red" steps={[
          { text: 'Tenant d’essai ouvert', note: 'l’attaquant y branche son propre IdP, dont il maîtrise les clés' },
          { text: 'Jeton signé par cet IdP', note: <>avec l’<code>iss</code> du tenant victime</> },
          { text: 'Clé trouvée dans le cache global', note: 'signature valide' },
          { text: 'Tenant choisi d’après iss', note: 'écrit par l’attaquant' },
        ]} />
      </>
    ),
    notes: <p>Les clients entreprise de Novafact branchent leur propre fournisseur d’identité en OIDC ; Novafact récupère les JWKS de chacun. Rien n’empêche un attaquant d’ouvrir un compte d’essai et de configurer le sien.</p>,
  },
  {
    lesson: 'l06',
    title: 'Le correctif : la route choisit le tenant, pas le jeton',
    body: (
      <Cols cols="1.3fr 1fr" gap={26} align="start">
        <SCode file="apps/api/src/auth/sso/verify.ts · corrigé" tone="good" hl="2,3,4,5,7,8" code={`export async function verifySsoToken(idToken: string, tenantSlug: string) {
  // Le tenant vient de la route /sso/:tenant/callback, jamais du jeton :
  // il fixe l'émetteur, l'audience et le seul jeu de clés acceptable.
  const tenant = await tenants.bySlug(tenantSlug);
  const jwks = jwksFor(tenant); // un cache par émetteur
  const { payload } = await jwtVerify(idToken, jwks, {
    issuer: tenant.oidcIssuer, audience: tenant.oidcClientId,
    algorithms: ['RS256', 'ES256'],
  });
  return { tenant, subject: payload.sub };
}`} />
        <div className="stack" style={{ gap: 14 }}>
          <Panel accent="red" label="Correctif tentant" title="issuer: tousLesEmetteursConfigures">Échoue : l’émetteur revendiqué fait bien partie de la liste.</Panel>
          <Panel accent="green" label="Test de régression" title="Une phrase, deux cas">Un jeton signé par l’IdP du tenant A est refusé sur <code>/sso/b/callback</code> ; le jeton légitime du tenant B est accepté.</Panel>
        </div>
      </Cols>
    ),
    notes: <p>La seconde cause de Storm-0558 se traite de la même façon : les clés de signature internes ont une date de retrait, une rotation automatique et une alerte quand une clé active dépasse son âge prévu. CWE-324 devient une exigence vérifiable.</p>,
  },
  {
    lesson: 'l06',
    title: 'La méthode, en quatre questions',
    body: (
      <SSteps cols={2} items={[
        { title: 'Que fait la technique chez nous ?', text: 'Traduire la procédure : quel point d’entrée, quel secret, quelle fonction.' },
        { title: 'Quelle décision la rend possible ?', text: 'Une ligne de code, un défaut, un flux : c’est là que se trouve la CWE, listée par CAPEC ou non.' },
        { title: 'Comment l’éliminer comme classe ?', text: 'Une API qui empêche l’erreur (verifySsoToken exige le tenant), une règle Semgrep, un défaut sûr.' },
        { title: 'Comment prouver que c’est fait ?', text: 'Un test qui rejoue la procédure et échoue, un test légitime qui passe, l’événement qui la rendrait visible.' },
      ]} />
    ),
  },
  {
    lesson: 'l06',
    title: 'ATT&CK, bon point de départ pour l’AppSec ?',
    body: (
      <Cols cols={2} gap={28} align="start">
        <Panel accent="orange" label="Limite" title="Biaisé vers ce que voient les enquêteurs">Comptes, postes, cloud. Une BOLA ou une fraude à l’avoir y sont presque absentes ; OWASP et les CWE les décrivent mieux.</Panel>
        <Panel accent="blue" label="Force" title="Ce que les attaquants font réellement">Ce que ne dit aucune liste de faiblesses.</Panel>
        <div style={{ gridColumn: '1 / -1' }}>
          <Note kind="debate" title="Usage raisonnable">CWE et OWASP pour couvrir le code, ATT&CK pour hiérarchiser ce que montre le renseignement, et la remontée de cette séquence pour relier les deux.</Note>
        </div>
      </Cols>
    ),
  },
  {
    lesson: 'l06',
    title: 'À retenir',
    body: (
      <Takeaways items={[
        'Partir d’une technique observée et chercher la décision de code ou de conception qui la rend possible chez nous.',
        'En v19, ATT&CK ne cite plus CAPEC ; CAPEC 3.9 (2023) pointe parfois vers des techniques révoquées.',
        'Les CWE listées par CAPEC sont des candidates ; Storm-0558 relève de CWE-324 et CWE-345.',
        'Multi-tenant : la clé est liée à l’émetteur attendu, choisi par la route ; un iss « connu » ne suffit pas.',
        'Chaque traduction finit en exigence, en garde-fou de code et en test qui rejoue la procédure.',
      ]} />
    ),
  },

  /* ============================================================ Clôture */
  {
    layout: 'end',
    title: 'Aucun de ces cas ne commence par une injection SQL.',
    body: (
      <>
        <p className="slide-lead">Tous passent par l’identité, et la plupart par une décision de conception prise des années plus tôt.</p>
        <div className="stack" style={{ gap: 10 }}>
          <span className="s-label">Pour consolider</span>
          <p className="slide-lead" style={{ fontSize: 19 }}>Le quiz de chaque leçon, et ses sources.{next ? <> Suite du parcours : M{pad2(next.num)} · {next.title}.</> : null}</p>
        </div>
      </>
    ),
  },
];

export default slides;

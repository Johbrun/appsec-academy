import { useMemo, useState } from 'react';
import { ArrowRight, X } from 'lucide-react';
import { Feedback, GameHeader } from './ui';
import { ClickableCode } from './Code';
import { SeriesScore, type SeriesPlay } from './Series';

// Mécanique commune aux jeux d'audit ligne à ligne (Workflow Audit, IaC Hunt) :
// cliquer les lignes à risque, rattacher chacune à une catégorie, puis comparer au corrigé.
//
// Les fichiers arrivent d'une série (écran de choix commun à tous les jeux) :
// le composant ne tire plus rien au hasard, il joue `play.items` dans l'ordre
// et rend le score par `play.finish`.

export type AuditCategory = { id: number; name: string; short: string };
export type AuditIssue = { match: string; cats: number[]; text: string }; // cats[0] attendu, les autres acceptés
/**
 * Une ligne qui attire l'œil sans être un défaut : une bonne pratique, un
 * réglage qui a l'air dangereux et ne l'est pas ici. Elle n'est révélée qu'à la
 * correction, avec la raison pour laquelle il ne fallait pas la signaler.
 */
export type AuditDecoy = { match: string; text: string };
export type AuditItem = {
  id: string; file: string; intro: string; code: string; issues: AuditIssue[];
  /** Langage de coloration du fichier, s'il diffère de celui du jeu (un .tf dans Workflow Audit, un stack CDK dans IaC Hunt). */
  lang?: string;
  decoys?: AuditDecoy[];
};

const lineOf = (lines: string[], match: string) => lines.findIndex((l) => l.includes(match)) + 1;

function issueLines(item: AuditItem) {
  const lines = item.code.split('\n');
  return item.issues.map((iss) => lineOf(lines, iss.match));
}

function decoyLines(item: AuditItem) {
  const lines = item.code.split('\n');
  return (item.decoys ?? []).map((d) => lineOf(lines, d.match));
}

function scoreItem(item: AuditItem, flags: Record<number, number | null>) {
  const lines = issueLines(item);
  const flagged = Object.keys(flags).map(Number);
  const found = lines.map((ln) => flagged.includes(ln));
  const nFound = found.filter(Boolean).length;
  const falseFlags = flagged.filter((ln) => !lines.includes(ln));
  const precision = flagged.length ? (flagged.length - falseFlags.length) / flagged.length : 0;
  const recall = nFound / lines.length;
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
  const catPts = item.issues.reduce((a, iss, n) => {
    if (!found[n]) return a;
    const c = flags[lines[n]];
    return a + (c === iss.cats[0] ? 1 : c !== null && iss.cats.includes(c) ? 0.5 : 0);
  }, 0);
  const cat = nFound ? catPts / nFound : 0;
  return { lines, found, falseFlags, pct: Math.round(f1 * 60 + cat * 40) };
}

export function LineAudit({ gameId, title, play, categories, lang, legendTitle, hint, falseFlagHint, nextLabel, unit = 'fichiers audités' }: {
  gameId: string; title: string; play: SeriesPlay<AuditItem>; categories: AuditCategory[]; lang: string;
  legendTitle: string; hint: string; falseFlagHint: string; nextLabel: string;
  /** Ce que dit l'écran de fin : « 3 fichiers audités ». */
  unit?: string;
}) {
  const rounds = play.items;
  const [i, setI] = useState(0);
  const [flags, setFlags] = useState<Record<number, number | null>>({});
  const [checked, setChecked] = useState(false);
  const [scores, setScores] = useState<number[]>([]);
  const [done, setDone] = useState(false);

  const item = rounds[i];
  const codeLines = item.code.split('\n');
  const result = checked ? scoreItem(item, flags) : null;
  const decoys = useMemo(() => decoyLines(item), [item]);
  const unqualified = Object.values(flags).some((r) => r === null);
  const catById = (id: number) => categories.find((c) => c.id === id)!;
  const avg = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);

  const toggle = (n: number) => setFlags((f) => {
    if (n in f) { const { [n]: _drop, ...rest } = f; return rest; }
    return { ...f, [n]: null };
  });
  const check = () => { const r = scoreItem(item, flags); setChecked(true); setScores([...scores, r.pct]); };
  const next = () => {
    if (i + 1 >= rounds.length) {
      play.finish(avg(scores));
      setDone(true);
    } else { setI(i + 1); setFlags({}); setChecked(false); }
  };

  if (done) {
    return <SeriesScore play={play} pct={avg(scores)} title={`${rounds.length} ${unit}`} />;
  }

  const lineClass = (n: number) => {
    if (result) {
      if (result.lines.includes(n)) return n in flags ? 'right' : 'missed';
      if (n in flags) return 'wrong';
      // Les leurres ne se montrent qu'à la correction : les montrer avant
      // reviendrait à désigner les lignes à regarder.
      return decoys.includes(n) ? 'decoy' : '';
    }
    return n in flags ? 'picked' : '';
  };
  const flaggedLines = Object.keys(flags).map(Number).sort((a, b) => a - b);

  return (
    <section className="block">
      <div className="game-wrap wide">
        <GameHeader id={gameId} title={`${title} · ${play.info.title}`} level={play.info.level} current={i} total={rounds.length} />
        <div className="card q-card">
          <span className="label mono">{item.file}</span>
          <p className="muted small" style={{ margin: '8px 0 0' }}>{item.intro}</p>
        </div>
        <p className="q-hint">{checked ? 'Correction.' : hint}</p>
        <div className="audit-layout">
          <ClickableCode code={item.code} lang={item.lang ?? lang} file={item.file} lineClass={lineClass} onLine={toggle} locked={checked} />
          <aside className="audit-side">
            <span className="label">{legendTitle}</span>
            <ol className="risk-legend">
              {categories.map((c) => <li key={c.id}><span className="mono">{c.id}</span> {c.name}</li>)}
            </ol>
          </aside>
        </div>
        {!checked && flaggedLines.length > 0 && (
          <div className="grid" style={{ gap: 8, marginTop: 12 }}>
            {flaggedLines.map((n) => (
              <div key={n} className="card audit-row">
                <div className="audit-line"><span className="mono small dim">L{n}</span><code className="mono small">{codeLines[n - 1].trim()}</code>
                  <button className="icon-btn" aria-label="Retirer" onClick={() => toggle(n)}><X size={14} /></button></div>
                <div className="chips">
                  {categories.map((c) => (
                    <button key={c.id} title={c.name} className={`chip ${flags[n] === c.id ? 'on' : ''}`} onClick={() => setFlags({ ...flags, [n]: c.id })}>{c.short}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        {!checked && (
          <div className="actions between">
            <span className="small dim">{flaggedLines.length} ligne{flaggedLines.length > 1 ? 's' : ''} signalée{flaggedLines.length > 1 ? 's' : ''}{unqualified ? ' · choisis une catégorie pour chacune' : ''}</span>
            <button className="btn primary" disabled={flaggedLines.length === 0 || unqualified} onClick={check}>Valider l’audit <ArrowRight size={16} className="arrow" /></button>
          </div>
        )}
        {result && (
          <>
            {item.issues.map((iss, n) => {
              const ln = result.lines[n];
              const c = flags[ln];
              const catOk = c === iss.cats[0];
              const accepted = c !== null && c !== undefined && iss.cats.includes(c);
              return (
                <Feedback key={n} good={result.found[n] && accepted}>
                  <b>L{ln} · {catById(iss.cats[0]).short} {catById(iss.cats[0]).name !== catById(iss.cats[0]).short ? catById(iss.cats[0]).name : ''} · {result.found[n] ? (catOk ? 'trouvée et bien classée' : accepted ? `trouvée, ${catById(c!).short} accepté` : `trouvée, classée ${c ? catById(c).short : '?'}`) : 'manquée'}</b>
                  <div className="small muted">{iss.text}</div>
                </Feedback>
              );
            })}
            {result.falseFlags.length > 0 && <Feedback good={false}><b>{result.falseFlags.length} ligne{result.falseFlags.length > 1 ? 's' : ''} signalée{result.falseFlags.length > 1 ? 's' : ''} à tort</b><div className="small muted">{falseFlagHint}</div></Feedback>}
            {(item.decoys ?? []).map((d, n) => {
              const ln = decoys[n];
              const fell = ln in flags;
              return (
                <Feedback key={`d${n}`} good={!fell}>
                  <b>L{ln} · saine · {fell ? 'signalée à tort' : 'bien laissée de côté'}</b>
                  <div className="small muted">{d.text}</div>
                </Feedback>
              );
            })}
            <div className="actions between">
              <span className="small dim">Score du fichier : {result.pct} %</span>
              <button className="btn primary" onClick={next}>{i + 1 >= rounds.length ? 'Voir le bilan' : nextLabel} <ArrowRight size={16} className="arrow" /></button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

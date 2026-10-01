import { Fragment, useState } from 'react';
import { Highlight } from 'prism-react-renderer';
import { ArrowRight, Bot, Check, GitPullRequest, MessageSquarePlus, X } from 'lucide-react';
import { Feedback, GameHeader } from '../components/ui';
import { codeTheme, langAliases } from '../components/Code';
import { SeriesGame, SeriesScore, type SeriesPlay } from '../components/Series';
import { diffSeries, severityLabels, type PullRequest, type Severity } from '../data/game-diff';

type Decision = 'approve' | 'changes';
type Comments = Record<string, Severity | null>; // clé « fichier:ligne »

function issueKeys(pr: PullRequest) {
  return pr.issues.map((iss) => pr.files[iss.file].lines
    .map((l, n) => (iss.match.some((m) => l.includes(m)) ? `${iss.file}:${n}` : null))
    .filter((k): k is string => k !== null));
}

function scorePr(pr: PullRequest, comments: Comments, decision: Decision) {
  const keys = issueKeys(pr);
  const flagged = Object.keys(comments);
  const found = keys.map((ks) => ks.find((k) => flagged.includes(k)) ?? null);
  const nFound = found.filter(Boolean).length;
  const falseFlags = flagged.filter((k) => !keys.some((ks) => ks.includes(k)));
  let detection: number;
  if (pr.issues.length === 0) detection = Math.max(0, 1 - 0.25 * falseFlags.length);
  else {
    const precision = flagged.length ? (flagged.length - falseFlags.length) / flagged.length : 0;
    const recall = nFound / pr.issues.length;
    detection = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
  }
  const qualOk = found.filter((k, n) => k && comments[k] === pr.issues[n].sev).length;
  const qualification = nFound ? qualOk / nFound : pr.issues.length === 0 ? 1 : 0;
  const expected: Decision = pr.issues.some((i) => i.sev !== 'suggestion') ? 'changes' : 'approve';
  const decisionOk = decision === expected;
  const pct = Math.round(detection * 50 + qualification * 25 + (decisionOk ? 25 : 0));
  return { found, falseFlags, expected, decisionOk, pct, detection, qualification };
}

function DiffFile({ file, fi, comments, locked, reveal, onToggle, onSev }: {
  file: PullRequest['files'][number]; fi: number; comments: Comments; locked: boolean;
  reveal: Record<string, 'ok' | 'ko' | 'miss'>; onToggle: (k: string) => void; onSev: (k: string, s: Severity) => void;
}) {
  const code = file.lines.map((l) => l.slice(1)).join('\n');
  let oldN = 0; let newN = 0;
  const nums = file.lines.map((l) => {
    if (l[0] === '-') return [++oldN, null] as const;
    if (l[0] === '+') return [null, ++newN] as const;
    return [++oldN, ++newN] as const;
  });
  return (
    <div className="code diff-file">
      <div className="code-head"><span className="path">{file.path}</span><span className="lang">{file.lang}</span></div>
      <Highlight code={code} language={langAliases[file.lang] ?? file.lang} theme={codeTheme}>
        {({ tokens, getTokenProps }) => (
          <div className="diff-rows">
            {tokens.map((line, n) => {
              const key = `${fi}:${n}`;
              const sign = file.lines[n][0];
              const kind = sign === '+' ? 'add' : sign === '-' ? 'del' : 'ctx';
              const has = key in comments;
              return (
                <Fragment key={n}>
                  <div role="button" tabIndex={locked ? -1 : 0} aria-label={`Commenter la ligne ${n + 1} de ${file.path}`}
                    className={`diff-row ${kind} ${has ? 'commented' : ''} ${reveal[key] ?? ''} ${locked ? 'locked' : ''}`}
                    onClick={() => !locked && onToggle(key)}
                    onKeyDown={(e) => { if (!locked && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onToggle(key); } }}>
                    <span className="dn">{nums[n][0] ?? ''}</span>
                    <span className="dn">{nums[n][1] ?? ''}</span>
                    <span className="ds">{sign === ' ' ? '' : sign}</span>
                    <span className="dc">
                      {line.map((token, k) => {
                        const { key: _tk, ...tokenProps } = getTokenProps({ token, key: k }) as ReturnType<typeof getTokenProps> & { key?: unknown };
                        return <span key={k} {...tokenProps} />;
                      })}
                    </span>
                    {!locked && <MessageSquarePlus size={13} className="diff-add-ico" />}
                  </div>
                  {has && (
                    <div className="diff-comment">
                      <span className="small">Commentaire</span>
                      <div className="seg" role="radiogroup" aria-label="Qualification">
                        {(Object.keys(severityLabels) as Severity[]).map((s) => (
                          <button key={s} className={comments[key] === s ? 'on' : ''} disabled={locked} onClick={() => onSev(key, s)}>{severityLabels[s]}</button>
                        ))}
                      </div>
                      {!locked && <button className="icon-btn" aria-label="Retirer le commentaire" onClick={() => onToggle(key)}><X size={14} /></button>}
                    </div>
                  )}
                </Fragment>
              );
            })}
          </div>
        )}
      </Highlight>
    </div>
  );
}

export default function DiffReview() {
  return (
    <SeriesGame
      gameId="diff-review"
      title="Diff Review"
      set={diffSeries}
      unit="PR"
      intro="Huit séries de trois pull requests. On passe du défaut net dans les lignes ajoutées à celui qui n’existe que par ce que la PR retire ou déplace, et à la PR qu’il faut savoir approuver malgré les apparences."
    >
      {(play) => <Round play={play} />}
    </SeriesGame>
  );
}

function Round({ play }: { play: SeriesPlay<PullRequest> }) {
  const rounds = play.items;
  const [i, setI] = useState(0);
  const [comments, setComments] = useState<Comments>({});
  const [decision, setDecision] = useState<Decision | null>(null);
  const [scores, setScores] = useState<number[]>([]);
  const [done, setDone] = useState(false);

  const pr = rounds[i];
  const result = decision ? scorePr(pr, comments, decision) : null;
  const unqualified = Object.values(comments).some((s) => s === null);
  const avg = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);

  const toggle = (k: string) => setComments((c) => {
    if (k in c) { const { [k]: _drop, ...rest } = c; return rest; }
    return { ...c, [k]: null };
  });
  const setSev = (k: string, s: Severity) => setComments((c) => ({ ...c, [k]: s }));

  const decide = (d: Decision) => {
    setDecision(d);
    setScores([...scores, scorePr(pr, comments, d).pct]);
  };
  const next = () => {
    if (i + 1 >= rounds.length) {
      play.finish(avg(scores));
      setDone(true);
    } else { setI(i + 1); setComments({}); setDecision(null); }
  };

  if (done) {
    return (
      <SeriesScore play={play} pct={avg(scores)} title={`${rounds.length} PR relues`}>
        <div className="kv" style={{ maxWidth: 520, margin: '0 auto 12px' }}>
          {rounds.map((r, n) => <div key={r.id}><span className="label">#{r.number}</span><b>{scores[n]} %</b></div>)}
        </div>
      </SeriesScore>
    );
  }

  const reveal: Record<string, 'ok' | 'ko' | 'miss'> = {};
  if (result) {
    const keys = issueKeys(pr);
    keys.forEach((ks, n) => { const f = result.found[n]; if (f) reveal[f] = 'ok'; else if (ks[0]) reveal[ks[0]] = 'miss'; });
    result.falseFlags.forEach((k) => { reveal[k] = 'ko'; });
  }

  // Les leurres ne se montrent qu'à la correction, avec la raison pour laquelle
  // il ne fallait pas les commenter.
  const decoyKey = (d: NonNullable<PullRequest['decoys']>[number]) => {
    const n = pr.files[d.file].lines.findIndex((l) => l.includes(d.match));
    return `${d.file}:${n}`;
  };

  return (
    <section className="block">
      <div className="game-wrap wide">
        <GameHeader id="diff-review" title={`Diff Review · ${play.info.title}`} level={play.info.level} current={i} total={rounds.length} />
        <div className="card pr-head">
          <div className="pr-title"><GitPullRequest size={18} /><h3 className="m0">{pr.title} <span className="dim">#{pr.number}</span></h3></div>
          <div className="small muted pr-author">{pr.bot ? <Bot size={14} /> : null}<b style={{ fontWeight: 500 }}>{pr.author}</b> souhaite fusionner dans <span className="mono">main</span></div>
          <p className="small m0">{pr.body}</p>
        </div>
        <p className="q-hint">{result ? 'Correction de la revue.' : 'Clique sur une ligne (ajoutée, supprimée ou de contexte) pour la commenter, qualifie chaque commentaire, puis décide.'}</p>
        {pr.files.map((f, fi) => (
          <DiffFile key={f.path} file={f} fi={fi} comments={comments} locked={!!result} reveal={reveal} onToggle={toggle} onSev={setSev} />
        ))}

        {!result && (
          <div className="actions between">
            <span className="small dim">{Object.keys(comments).length} commentaire{Object.keys(comments).length > 1 ? 's' : ''}{unqualified ? ' · qualifie chaque commentaire' : ''}</span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn" disabled={unqualified} onClick={() => decide('approve')}><Check size={15} /> Approuver</button>
              <button className="btn primary" disabled={unqualified} onClick={() => decide('changes')}>Demander des changements</button>
            </div>
          </div>
        )}

        {result && (
          <>
            <Feedback good={result.decisionOk}>
              <b>{result.decisionOk ? 'Bonne décision.' : result.expected === 'approve' ? 'Cette PR pouvait être approuvée.' : 'Cette PR ne devait pas être fusionnée en l’état.'}</b>
              {pr.verdict && <div className="small muted">{pr.verdict}</div>}
            </Feedback>
            {pr.issues.map((iss, n) => {
              const f = result.found[n];
              const good = !!f && comments[f] === iss.sev;
              return (
                <Feedback key={n} good={good}>
                  <b>{severityLabels[iss.sev]} · {f ? (good ? 'trouvé et bien qualifié' : `trouvé, qualifié « ${severityLabels[comments[f]!]} »`) : 'manqué'}</b>
                  <div className="small muted">{iss.text}</div>
                </Feedback>
              );
            })}
            {result.falseFlags.length > 0 && (
              <Feedback good={false}><b>{result.falseFlags.length} commentaire{result.falseFlags.length > 1 ? 's' : ''} sans objet</b><div className="small muted">Chaque commentaire superflu coûte du temps à l’auteur et de la crédibilité à la revue.</div></Feedback>
            )}
            {(pr.decoys ?? []).map((d, n) => {
              const fell = decoyKey(d) in comments;
              return (
                <Feedback key={`d${n}`} good={!fell}>
                  <b>{pr.files[d.file].path.split('/').pop()} · ligne saine · {fell ? 'commentée à tort' : 'bien laissée de côté'}</b>
                  <div className="small muted">{d.text}</div>
                </Feedback>
              );
            })}
            <div className="actions between">
              <span className="small dim">Score de la PR : {result.pct} %</span>
              <button className="btn primary" onClick={next}>{i + 1 >= rounds.length ? 'Voir le bilan' : 'PR suivante'} <ArrowRight size={16} className="arrow" /></button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

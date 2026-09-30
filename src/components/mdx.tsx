import {
  Children, createContext, isValidElement, useContext, useEffect,
  type ReactElement, type ReactNode,
} from 'react';
import { ArrowUpRight, Check, ChevronDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CodeBlock } from './Code';
import { blocks, modules, pad2 } from '../data/catalog';
import { useProgress } from '../store/progress';
import { labById } from '../data/labs';

// Composants disponibles dans les leçons MDX.

const calloutLabels = { tip: 'À retenir', warn: 'Attention', debate: 'Débat', case: 'Cas réel', novafact: 'Chez Novafact', info: 'Repère' } as const;

export function Callout({ kind = 'info', title, children }: { kind?: keyof typeof calloutLabels; title?: string; children: ReactNode }) {
  return (
    <aside className={`note note--${kind}`}>
      <span className="label">{title ?? calloutLabels[kind]}</span>
      <div className="note-body">{children}</div>
    </aside>
  );
}

export function YouKnow({ children }: { children: ReactNode }) {
  return (
    <details className="youknow">
      <summary><span className="label">Ce que tu sais déjà</span><ChevronDown size={15} /></summary>
      <div className="note-body">{children}</div>
    </details>
  );
}

// Extrait le code et la langue d'un bloc Markdown (```js … ```) rendu par MDX.
function fenced(node: ReactNode): { code: string; lang: string } | null {
  if (!isValidElement(node)) return null;
  const inner = (node as ReactElement<{ children?: ReactNode }>).props.children;
  if (!isValidElement(inner)) return null;
  const el = inner as ReactElement<{ className?: string; children?: ReactNode }>;
  const lang = (el.props.className ?? '').replace('language-', '') || 'plain';
  return { code: String(el.props.children ?? ''), lang };
}
const fencedChildren = (children: ReactNode) => Children.toArray(children).map(fenced).filter(Boolean) as { code: string; lang: string }[];

// Deux blocs de code Markdown en enfants : le premier vulnérable, le second corrigé.
export function Diff({ children, file, beforeLabel = 'Vulnérable', afterLabel = 'Corrigé', hlBefore, hlAfter, stack }: {
  children?: ReactNode; file?: string; beforeLabel?: string; afterLabel?: string; hlBefore?: string; hlAfter?: string; stack?: boolean;
}) {
  const [before, after] = fencedChildren(children);
  if (!before || !after) return null;
  return (
    <figure className="diff-view">
      {file && <figcaption className="mono small dim">{file}</figcaption>}
      <div className={`diff-grid ${stack ? 'stack' : ''}`}>
        <div>
          <div className="diff-label bad"><span className="led" /> {beforeLabel}</div>
          <CodeBlock code={before.code} lang={before.lang} hl={hlBefore} tone="bad" bare />
        </div>
        <div>
          <div className="diff-label good"><span className="led" /> {afterLabel}</div>
          <CodeBlock code={after.code} lang={after.lang} hl={hlAfter} tone="good" bare />
        </div>
      </div>
    </figure>
  );
}

// Un bloc de code Markdown en enfant, avec un nom de fichier et des lignes surlignées.
export function Code({ children, file, hl }: { children?: ReactNode; file?: string; hl?: string }) {
  const [block] = fencedChildren(children);
  if (!block) return null;
  return <CodeBlock code={block.code} lang={block.lang} file={file} hl={hl} />;
}

// Blocs de code Markdown : ```js title="…" → CodeBlock.
function Pre({ children }: { children?: ReactNode }) {
  if (isValidElement(children)) {
    const el = children as ReactElement<{ className?: string; children?: ReactNode }>;
    const lang = (el.props.className ?? '').replace('language-', '') || 'plain';
    const code = typeof el.props.children === 'string' ? el.props.children : String(el.props.children ?? '');
    return <CodeBlock code={code} lang={lang} />;
  }
  return <pre>{children}</pre>;
}

export function Lab({ id, note }: { id: string; note?: string }) {
  const { progress, toggleLab } = useProgress();
  const lab = labById(id);
  if (!lab) return null;
  const done = progress.labs.includes(lab.id);
  return (
    <div className={`lab-card ${done ? 'done' : ''}`}>
      <div className="lab-main">
        <span className="label">{lab.provider} · Lab</span>
        <a href={lab.url} target="_blank" rel="noreferrer" className="lab-title">{lab.title} <ArrowUpRight size={15} /></a>
        <p className="small dim m0">{note ?? lab.text}</p>
      </div>
      <button className={`lab-check ${done ? 'on' : ''}`} onClick={() => toggleLab(lab.id)} aria-pressed={done}>
        {done ? <><Check size={14} /> Fait</> : 'Marquer comme fait'}
      </button>
    </div>
  );
}

export function Recap({ items }: { items: string[] }) {
  return (
    <div className="recap">
      <span className="label">Récap</span>
      <ol>{items.map((it, k) => <li key={k}>{it}</li>)}</ol>
    </div>
  );
}

export interface SourceItem { title: string; url: string; note?: string }

/**
 * Les sources se déclarent dans le corps de la leçon, là où l'auteur les a
 * sous la main — et elles s'affichent SOUS le quiz, parce qu'elles closent la
 * page : personne ne va voir une bibliographie avant d'avoir répondu aux
 * questions, et quinze lignes de liens entre le dernier paragraphe et le quiz
 * repoussent ce dernier hors de l'écran.
 *
 * Le composant ne rend donc rien sur place : il remonte ses items au lecteur
 * de leçon, qui les rend où il veut. Hors d'un lecteur — aperçu, test — il se
 * rabat sur un rendu sur place, pour qu'aucune source ne disparaisse.
 */
const SourcesSlot = createContext<((items: SourceItem[]) => void) | null>(null);
export const SourcesProvider = SourcesSlot.Provider;

export function Sources({ items }: { items: SourceItem[] }) {
  const collect = useContext(SourcesSlot);
  // Le tableau littéral du MDX change d'identité à chaque rendu : c'est la
  // liste des URL qui dit si le contenu a réellement changé.
  const cle = items.map((s) => s.url).join('|');
  useEffect(() => { collect?.(items); }, [collect, cle]); // eslint-disable-line react-hooks/exhaustive-deps
  return collect ? null : <SourcesList items={items} />;
}

export function SourcesList({ items }: { items: SourceItem[] }) {
  if (!items.length) return null;
  return (
    <div className="sources">
      <span className="label">Sources</span>
      <ul>
        {items.map((s) => (
          <li key={s.url}>
            <a href={s.url} target="_blank" rel="noreferrer">{s.title}</a>
            {s.note && <span className="dim"> · {s.note}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * La carte du parcours, lue dans `src/data/catalog.ts`.
 *
 * Elle n'est PAS recopiée en prose, et c'est délibéré : une liste de vingt
 * modules écrite à la main est fausse au premier module ajouté, déplacé ou
 * renommé — et personne ne s'en aperçoit, puisque rien ne la vérifie. Ici le
 * catalogue est la seule source, donc la leçon ne peut pas mentir sur ce que
 * le site contient.
 *
 * `ici` marque le module d'où l'on lit, pour que l'apprenant se situe.
 */
export function CarteDuParcours({ ici }: { ici?: string }) {
  return (
    <div className="carte-parcours">
      {blocks.map((b) => {
        const mods = modules.filter((m) => m.block === b.id);
        if (!mods.length) return null;
        return (
          <section key={b.id} className="cp-bloc">
            <header>
              <span className="label">Bloc {b.id}</span>
              <b>{b.title}</b>
              <p className="m0 dim">{b.text}</p>
            </header>
            <ul>
              {mods.map((m) => (
                <li key={m.id} className={m.id === ici ? 'cp-ici' : undefined}>
                  <Link to={`/modules/${m.id}`}>
                    <span className="mono cp-num">{pad2(m.num)}</span>
                    <span>
                      <b>{m.title}</b>
                      <span className="cp-sum">{m.summary}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

export function Steps({ items }: { items: { title: string; text: string }[] }) {
  return (
    <ol className="steps">
      {items.map((s, k) => (
        <li key={k}>
          <span className="n mono">{String(k + 1).padStart(2, '0')}</span>
          <div><b>{s.title}</b><p className="m0 muted">{s.text}</p></div>
        </li>
      ))}
    </ol>
  );
}

function A({ href = '', children }: { href?: string; children?: ReactNode }) {
  const external = /^https?:/.test(href);
  return <a href={href} {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}>{children}</a>;
}

function Table({ children }: { children?: ReactNode }) {
  return <div className="tbl-wrap"><table className="tbl">{children}</table></div>;
}

export const mdxComponents = {
  Callout, YouKnow, Diff, Code, Lab, Recap, Sources, Steps, CarteDuParcours,
  pre: Pre, a: A, table: Table,
};

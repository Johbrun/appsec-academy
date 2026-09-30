import { Highlight, type PrismTheme } from 'prism-react-renderer';
import '../lib/prism-extra';

// Les couleurs passent par des variables CSS : le même thème sert en clair et en sombre.
export const codeTheme: PrismTheme = {
  plain: { color: 'var(--code-text)', backgroundColor: 'transparent' },
  styles: [
    { types: ['comment', 'prolog', 'doctype', 'cdata'], style: { color: 'var(--code-comment)', fontStyle: 'italic' } },
    { types: ['keyword', 'builtin', 'important', 'atrule', 'rule'], style: { color: 'var(--code-keyword)' } },
    { types: ['string', 'char', 'attr-value', 'regex', 'template-string', 'url'], style: { color: 'var(--code-string)' } },
    { types: ['function', 'class-name', 'maybe-class-name'], style: { color: 'var(--code-fn)' } },
    { types: ['number', 'boolean', 'constant', 'symbol', 'unit'], style: { color: 'var(--code-number)' } },
    { types: ['tag', 'selector', 'property', 'attr-name', 'key'], style: { color: 'var(--code-tag)' } },
    { types: ['punctuation', 'operator'], style: { color: 'var(--code-punct)' } },
    { types: ['deleted'], style: { color: 'var(--code-del)' } },
    { types: ['inserted'], style: { color: 'var(--code-ins)' } },
  ],
};

export const langAliases: Record<string, string> = { js: 'javascript', ts: 'typescript', sh: 'bash', shell: 'bash', yml: 'yaml', html: 'markup', text: 'plain', terraform: 'hcl', tf: 'hcl', dockerfile: 'docker', console: 'bash' };

// "3,5-7" → {3, 5, 6, 7}
export function parseLines(spec?: string): Set<number> {
  const out = new Set<number>();
  (spec ?? '').split(',').map((s) => s.trim()).filter(Boolean).forEach((part) => {
    const [a, b] = part.split('-').map(Number);
    for (let n = a; n <= (b || a); n++) out.add(n);
  });
  return out;
}

export function CodeBlock({ code, lang = 'plain', file, hl, tone, bare }: {
  code: string; lang?: string; file?: string; hl?: string; tone?: 'bad' | 'good'; bare?: boolean;
}) {
  const language = langAliases[lang] ?? lang;
  const marked = parseLines(hl);
  const src = code.replace(/\n$/, '');
  return (
    <div className={`code ${tone ?? ''} ${bare ? 'bare' : ''}`}>
      {file && (
        <div className="code-head">
          <span className="path">{file}</span>
          <span className="lang">{lang}</span>
        </div>
      )}
      <Highlight code={src} language={language} theme={codeTheme}>
        {({ tokens, getLineProps, getTokenProps }) => (
          <pre>
            <div className="code-inner">
            {tokens.map((line, i) => {
              const { key: _k, ...lineProps } = getLineProps({ line, key: i }) as ReturnType<typeof getLineProps> & { key?: unknown };
              return (
                <div key={i} {...lineProps} className={`code-line ${marked.has(i + 1) ? 'hl' : ''}`}>
                  <span className="ln" aria-hidden="true">{i + 1}</span>
                  <span className="lc">
                    {line.map((token, k) => {
                      const { key: _tk, ...tokenProps } = getTokenProps({ token, key: k }) as ReturnType<typeof getTokenProps> & { key?: unknown };
                      return <span key={k} {...tokenProps} />;
                    })}
                  </span>
                </div>
              );
            })}
            </div>
          </pre>
        )}
      </Highlight>
    </div>
  );
}

// Code dont chaque ligne est cliquable (jeux de revue de code).
export function ClickableCode({ code, lang = 'ts', file, lineClass, onLine, locked }: {
  code: string; lang?: string; file?: string; lineClass: (n: number) => string; onLine: (n: number) => void; locked?: boolean;
}) {
  const language = langAliases[lang] ?? lang;
  return (
    <div className="code">
      {file && <div className="code-head"><span className="path">{file}</span><span className="lang">{lang}</span></div>}
      <Highlight code={code.replace(/\n$/, '')} language={language} theme={codeTheme}>
        {({ tokens, getTokenProps }) => (
          <pre className={`snippet-lines ${locked ? 'locked' : ''}`}>
            <div className="code-inner">
              {tokens.map((line, i) => (
                <div key={i} role="button" tabIndex={locked ? -1 : 0} aria-label={`Ligne ${i + 1}`}
                  className={`code-line ${lineClass(i + 1)}`}
                  onClick={() => !locked && onLine(i + 1)}
                  onKeyDown={(e) => { if (!locked && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onLine(i + 1); } }}>
                  <span className="ln" aria-hidden="true">{i + 1}</span>
                  <span className="lc">
                    {line.map((token, k) => {
                      const { key: _tk, ...tokenProps } = getTokenProps({ token, key: k }) as ReturnType<typeof getTokenProps> & { key?: unknown };
                      return <span key={k} {...tokenProps} />;
                    })}
                  </span>
                </div>
              ))}
            </div>
          </pre>
        )}
      </Highlight>
    </div>
  );
}

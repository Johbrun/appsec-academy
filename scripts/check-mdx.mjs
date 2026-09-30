// Vérifie des leçons MDX sans lancer de build : compilation, composants connus, labs existants, questions.
// Usage : node scripts/check-mdx.mjs [fichiers ou dossiers…] (par défaut : tout src/content)
import { compile } from '@mdx-js/mdx';
import remarkGfm from 'remark-gfm';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const labsSrc = fs.readFileSync(path.join(root, 'src/data/labs.ts'), 'utf8');
const labIds = new Set([...labsSrc.matchAll(/(?:id: '|ps\(')([a-z0-9-]+)'/g)].map((m) => (m[0].startsWith('ps(') ? `ps-${m[1]}` : m[1])));
const known = new Set(['YouKnow', 'Callout', 'Diff', 'Code', 'Lab', 'Recap', 'Sources', 'Steps']);
const kinds = new Set(['tip', 'warn', 'debate', 'case', 'novafact', 'info']);

const args = process.argv.slice(2);
const targets = args.length ? args : [path.join(root, 'src/content')];
const files = targets.flatMap((t) => (fs.statSync(t).isDirectory()
  ? fs.readdirSync(t, { recursive: true }).filter((f) => f.endsWith('.mdx')).map((f) => path.join(t, f))
  : [t]));

let bad = 0;
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const problems = [];
  try { await compile(src, { remarkPlugins: [remarkGfm] }); } catch (e) { problems.push(`MDX: ${e.message}`); }
  const prose = src.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
  for (const m of prose.matchAll(/<([A-Z][A-Za-z]*)/g)) if (!known.has(m[1])) problems.push(`composant inconnu <${m[1]}>`);
  for (const m of src.matchAll(/<Callout kind="([a-z]+)"/g)) if (!kinds.has(m[1])) problems.push(`Callout kind inconnu "${m[1]}"`);
  for (const m of src.matchAll(/<Lab id="([^"]+)"/g)) if (!labIds.has(m[1])) problems.push(`lab inconnu "${m[1]}"`);
  const q = src.match(/export const questions = (\[[\s\S]*?\n\]);/) || src.match(/export const questions = (\[\s*\]);/);
  if (!q) problems.push('export questions absent');
  else {
    try {
      const qs = new Function(`return ${q[1]}`)();
      qs.forEach((x, i) => { if (!(x.answer >= 0 && x.answer < x.options.length) || !x.q || !x.explain) problems.push(`question ${i + 1} invalide`); });
    } catch (e) { problems.push(`questions illisibles : ${e.message}`); }
  }
  const words = src.replace(/export const questions[\s\S]*?\n\];/, '').split(/\s+/).filter(Boolean).length;
  if (problems.length) { bad++; console.log(`✗ ${path.relative(root, f)} (${words} mots)\n  - ${problems.join('\n  - ')}`); }
  else console.log(`✓ ${path.relative(root, f)} (${words} mots)`);
}
console.log(`${files.length} fichiers, ${bad} en erreur`);
process.exit(bad ? 1 : 0);

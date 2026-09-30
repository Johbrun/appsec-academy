// Vérifications des challenges M14 · Pipeline & supply chain.
//
// Chaque vérification renvoie `null` quand le défaut a disparu, ou la raison
// qui reste — formulée pour l'apprenant, avec le fichier et la ligne fautive
// quand c'est possible.
//
// Règle de conception : on vérifie la **propriété**, jamais la forme exacte du
// correctif. Plusieurs manières de corriger doivent passer, et une
// reformulation qui ne corrige rien doit échouer.

import { exists, json, steps, text, workflows, type Workflow } from './repo.ts';

export type Check = () => string | null;

// Contextes que l'attaquant contrôle dans un workflow.
const UNTRUSTED = /\$\{\{\s*(github\.event\.|github\.head_ref|inputs\.|github\.actor\b)/;

// Propriétaires d'actions connus. Une action hors de cette liste est suspecte.
const KNOWN_OWNERS = new Set(['actions', 'github', 'docker', 'novafact']);

const isSha = (ref: string) => /^[0-9a-f]{40}$/.test(ref);
const usesRef = (uses: string) => uses.split('@')[1] ?? '';
const usesName = (uses: string) => uses.split('@')[0] ?? '';
const isLocal = (uses: string) => uses.startsWith('./') || uses.startsWith('.github/');

const wf = (file: string): Workflow | undefined => workflows().find((w) => w.file === file);

/** Les workflows déclenchés par au moins un des déclencheurs donnés. */
const triggeredBy = (names: string[]) =>
  workflows().filter((w) => w.triggers.some((t) => names.includes(t)));

export const m14Checks: Record<string, Check> = {
  // ── GitHub Actions ────────────────────────────────────────────────────────

  'gha-permissions': () => {
    const bad: string[] = [];
    for (const w of workflows()) {
      const hasTop = w.permissions !== undefined;
      const jobs = Object.entries(w.jobs);
      const allJobsDeclare = jobs.length > 0 && jobs.every(([, j]) => j.permissions !== undefined);
      if (!hasTop && !allJobsDeclare) bad.push(`${w.file} ne déclare aucun bloc permissions`);
      const raw = JSON.stringify([w.permissions, ...jobs.map(([, j]) => j.permissions)]);
      if (raw.includes('write-all')) bad.push(`${w.file} utilise write-all`);
    }
    return bad.length ? bad.join(' · ') : null;
  },

  'gha-injection': () => {
    const bad: string[] = [];
    for (const w of workflows()) {
      for (const { jobId, step } of steps(w)) {
        if (step.run && UNTRUSTED.test(step.run)) {
          bad.push(`${w.file} (job ${jobId}) interpole une entrée non fiable dans un run`);
        }
      }
    }
    return bad.length ? bad.join(' · ') : null;
  },

  'gha-pwn-request': () => {
    const bad: string[] = [];
    for (const w of triggeredBy(['pull_request_target'])) {
      for (const [jobId, job] of Object.entries(w.jobs)) {
        const list = job.steps ?? [];
        const checksOutHead = list.some(
          (s) => s.uses?.includes('actions/checkout') && UNTRUSTED.test(String(s.with?.ref ?? '')),
        );
        const executes = list.some((s) => typeof s.run === 'string' && s.run.trim() !== '');
        if (checksOutHead && executes) {
          bad.push(`${w.file} (job ${jobId}) exécute du code de la PR dans un contexte privilégié`);
        }
      }
    }
    return bad.length ? bad.join(' · ') : null;
  },

  'gha-unpinned': () => {
    const bad: string[] = [];
    for (const w of workflows()) {
      for (const { step } of steps(w)) {
        if (!step.uses || isLocal(step.uses)) continue;
        if (!isSha(usesRef(step.uses))) bad.push(`${w.file} : ${step.uses} n’est pas épinglé à un SHA`);
      }
    }
    return bad.length ? bad.join(' · ') : null;
  },

  'gha-secrets-inherit': () => {
    const bad = workflows()
      .filter((w) => Object.values(w.jobs).some((j) => j.secrets === 'inherit'))
      .map((w) => `${w.file} transmet tous les secrets par « secrets: inherit »`);
    return bad.length ? bad.join(' · ') : null;
  },

  'gha-artipacked': () => {
    const bad: string[] = [];
    for (const w of workflows()) {
      const list = steps(w);
      const broad = list.filter((s) => {
        if (!s.step.uses?.includes('upload-artifact')) return false;
        const p = String(s.step.with?.path ?? '').trim();
        return p === '' || p === '.' || p === './' || p.includes('${{ github.workspace }}');
      });
      if (!broad.length) continue;
      bad.push(`${w.file} téléverse la racine du dépôt en artefact`);
      const leaky = list.some(
        (s) => s.step.uses?.includes('actions/checkout') && s.step.with?.['persist-credentials'] !== false,
      );
      if (leaky) bad.push(`${w.file} laisse en plus le jeton dans .git (persist-credentials)`);
    }
    return bad.length ? bad.join(' · ') : null;
  },

  'gha-curl-bash': () => {
    const bad: string[] = [];
    const piped = /\b(curl|wget)\b[^\n|]*\|\s*(sudo\s+)?(ba)?sh\b/;
    for (const w of workflows()) {
      for (const { jobId, step } of steps(w)) {
        if (step.run && piped.test(step.run)) {
          bad.push(`${w.file} (job ${jobId}) exécute un script téléchargé sans vérifier son empreinte`);
        }
      }
    }
    return bad.length ? bad.join(' · ') : null;
  },

  'gha-cache-poisoning': () => {
    const bad: string[] = [];
    for (const w of workflows()) {
      const publishes = steps(w).some(
        (s) => typeof s.step.run === 'string' && /npm\s+publish|docker\s+push/.test(s.step.run),
      );
      if (!publishes) continue;
      for (const { jobId, step } of steps(w)) {
        if (!step.uses?.includes('actions/cache')) continue;
        const key = `${step.with?.key ?? ''} ${step.with?.['restore-keys'] ?? ''}`;
        if (UNTRUSTED.test(key)) {
          bad.push(`${w.file} (job ${jobId}) restaure un cache dont la clé dépend d’une entrée contrôlable`);
        }
      }
    }
    return bad.length ? bad.join(' · ') : null;
  },

  'gha-bot-condition': () => {
    const bot = /github\.actor\s*==\s*'[^']*\[bot\]'/;
    const bad: string[] = [];
    for (const w of workflows()) {
      for (const [jobId, job] of Object.entries(w.jobs)) {
        const conditions = [job.if, ...(job.steps ?? []).map((s) => s.if)].filter(Boolean) as string[];
        if (conditions.some((c) => bot.test(c))) {
          bad.push(`${w.file} (job ${jobId}) garde une étape privilégiée par github.actor`);
        }
      }
    }
    return bad.length ? bad.join(' · ') : null;
  },

  'gha-self-hosted': () => {
    const bad: string[] = [];
    for (const w of triggeredBy(['pull_request', 'pull_request_target'])) {
      for (const [jobId, job] of Object.entries(w.jobs)) {
        const runners = ([] as string[]).concat(job['runs-on'] ?? []);
        if (!runners.includes('self-hosted')) continue;
        if (job.environment === undefined) {
          bad.push(`${w.file} (job ${jobId}) fait tourner du code de fork sur un runner self-hosted`);
        }
      }
    }
    return bad.length ? bad.join(' · ') : null;
  },

  'gha-typosquat-action': () => {
    const bad: string[] = [];
    for (const w of workflows()) {
      for (const { step } of steps(w)) {
        if (!step.uses || isLocal(step.uses)) continue;
        const owner = usesName(step.uses).split('/')[0];
        if (!KNOWN_OWNERS.has(owner)) bad.push(`${w.file} : ${usesName(step.uses)} n’est pas une action connue`);
      }
    }
    return bad.length ? bad.join(' · ') : null;
  },

  'npm-ci-lockfile': () => {
    const bad: string[] = [];
    for (const w of workflows()) {
      for (const { jobId, step } of steps(w)) {
        if (step.run && /\bnpm\s+install\b/.test(step.run)) {
          bad.push(`${w.file} (job ${jobId}) utilise « npm install » au lieu de « npm ci »`);
        }
      }
    }
    if (!exists('package-lock.json')) bad.push('le lockfile est absent du dépôt');
    return bad.length ? bad.join(' · ') : null;
  },

  'npm-provenance': () => {
    const release = wf('release.yml');
    if (!release) return 'release.yml est introuvable';
    const bad: string[] = [];
    const publish = steps(release).filter((s) => /npm\s+publish/.test(String(s.step.run ?? '')));
    if (!publish.length) return 'aucune étape de publication npm dans release.yml';
    if (!publish.some((s) => /--provenance/.test(String(s.step.run)))) {
      bad.push('la publication ne produit pas d’attestation de provenance');
    }
    const perms = JSON.stringify([release.permissions, ...Object.values(release.jobs).map((j) => j.permissions)]);
    if (!/"id-token"\s*:\s*"write"/.test(perms)) bad.push('la permission id-token: write manque (OIDC)');
    if (/NPM_TOKEN/.test(release.text)) bad.push('un jeton npm de longue durée est encore utilisé');
    return bad.length ? bad.join(' · ') : null;
  },

  // ── CODEOWNERS ────────────────────────────────────────────────────────────

  'codeowners-ci': () => {
    const raw = text('.github/CODEOWNERS');
    if (raw === null) return 'le fichier CODEOWNERS est absent';

    // Résolution GitHub : la dernière règle qui correspond l'emporte.
    const rules = raw
      .split('\n')
      .map((l) => l.replace(/#.*$/, '').trim())
      .filter(Boolean)
      .map((l) => {
        const [pattern, ...owners] = l.split(/\s+/);
        return { pattern, owners };
      });

    const matches = (pattern: string, file: string) => {
      if (pattern === '*') return true;
      const p = pattern.replace(/^\//, '');
      if (p.endsWith('/')) return file.startsWith(p);
      const rx = new RegExp(
        `^${p.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '\u0000').replace(/\*/g, '[^/]*').replace(/\u0000/g, '.*')}$`,
      );
      return rx.test(file) || file.startsWith(`${p}/`);
    };
    const ownersOf = (file: string) =>
      rules.filter((r) => matches(r.pattern, file)).slice(-1)[0]?.owners ?? [];
    const isSecurity = (owners: string[]) => owners.some((o) => /security|appsec|s[ée]curit[ée]/i.test(o));

    const sensitive = ['.github/workflows/ci.yml', '.github/CODEOWNERS', '.npmrc', 'package-lock.json'];
    const bad = sensitive.filter((f) => !isSecurity(ownersOf(f))).map((f) => `${f} n’est pas routé vers la sécurité`);

    // Le critère inverse : une règle « tout appartient à la sécurité » ne compte
    // pas comme un routage — elle garantit surtout que plus rien n'est relu.
    if (!bad.length && isSecurity(ownersOf('src/pages/Invoices.tsx'))) {
      return 'un fichier ordinaire (src/pages/Invoices.tsx) est aussi routé vers la sécurité : la règle est trop large';
    }
    return bad.length ? bad.join(' · ') : null;
  },

  // ── npm ───────────────────────────────────────────────────────────────────

  'npmrc-ignore-scripts': () => {
    const raw = text('.npmrc');
    if (raw === null) return 'le fichier .npmrc est absent';
    return /^\s*ignore-scripts\s*=\s*true\s*$/m.test(raw)
      ? null
      : 'les scripts d’installation des dépendances peuvent toujours s’exécuter';
  },

  'npm-token-in-repo': () => {
    const raw = text('.npmrc');
    if (raw === null) return null;
    const bad: string[] = [];
    for (const line of raw.split('\n')) {
      const m = line.match(/_authToken\s*=\s*(.+)$/);
      if (!m) continue;
      const value = m[1].trim();
      // Une référence d'environnement est acceptable ; une valeur littérale non.
      if (!/^\$\{?[A-Z_][A-Z0-9_]*\}?$/.test(value)) bad.push('un jeton en clair subsiste dans .npmrc');
    }
    return bad.length ? bad.join(' · ') : null;
  },

  'dependency-confusion': () => {
    const pkg = json<{ dependencies?: Record<string, string>; devDependencies?: Record<string, string> }>('package.json');
    if (!pkg) return 'package.json est introuvable ou mal formé';
    const raw = text('.npmrc') ?? '';
    const scopes = new Set(
      [...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})]
        .filter((n) => n.startsWith('@'))
        .map((n) => n.split('/')[0]),
    );
    const bad = [...scopes]
      .filter((s) => !new RegExp(`^\\s*${s.replace('@', '@')}:registry\\s*=`, 'm').test(raw))
      .map((s) => `le scope ${s} n’est associé à aucun registre : un homonyme public serait préféré`);
    return bad.length ? bad.join(' · ') : null;
  },

  'lockfile-integrity': () => {
    const lock = json<{ packages?: Record<string, { resolved?: string; integrity?: string }> }>('package-lock.json');
    if (!lock) return 'package-lock.json est introuvable ou mal formé';
    const bad: string[] = [];
    for (const [name, entry] of Object.entries(lock.packages ?? {})) {
      if (name === '') continue; // la racine n'a ni resolved ni integrity
      if (!entry.resolved) { bad.push(`${name} n’a pas de champ resolved`); continue; }
      if (!/^https:\/\/registry\.npmjs\.org\//.test(entry.resolved)) {
        bad.push(`${name} est résolu depuis ${new URL(entry.resolved).host}`);
      }
      if (!entry.integrity) bad.push(`${name} n’a pas d’empreinte d’intégrité`);
    }
    return bad.length ? bad.join(' · ') : null;
  },

  // Rattaché à M17 (« Publier en sécurité ») mais implémenté ici : il s'appuie
  // sur les helpers de workflow définis dans ce fichier. Le moteur fusionne
  // toutes les vérifications, l'emplacement du code n'a pas d'importance.
  'signed-artifacts': () => {
    const release = wf('release.yml');
    const deploy = wf('deploy.yml');
    if (!release || !deploy) return 'release.yml ou deploy.yml est introuvable';

    const signs = /\b(cosign\s+(sign|attest)|gh\s+attestation|aws\s+signer)\b/;
    const verifies = /\b(cosign\s+verify|gh\s+attestation\s+verify|kyverno)\b/;
    const scriptOf = (w: Workflow) => steps(w).map((s2) => String(s2.step.run ?? '')).join('\n');

    const bad: string[] = [];
    if (!signs.test(scriptOf(release))) bad.push('release.yml ne signe pas l’artefact qu’il produit');

    // La vérification à l'admission est la moitié qu'on oublie : signer sans
    // vérifier ne protège de rien.
    const deploySteps = steps(deploy);
    const verifyAt = deploySteps.findIndex((s2) => verifies.test(String(s2.step.run ?? '')));
    const deployAt = deploySteps.findIndex((s2) => /\b(ecs\s+update-service|kubectl\s+apply|helm\s+upgrade)\b/.test(String(s2.step.run ?? '')));
    if (verifyAt === -1) bad.push('deploy.yml déploie sans vérifier la signature de l’image');
    else if (deployAt !== -1 && verifyAt > deployAt) bad.push('deploy.yml vérifie la signature après avoir déployé');

    return bad.length ? bad.join(' · ') : null;
  },

  'vendor-build-mismatch': () => {
    const src = text('vendor/novafact-parser/src/index.js');
    const build = text('vendor/novafact-parser/build/index.min.js');
    if (src === null || build === null) return 'le paquet vendorisé est incomplet (src ou build manquant)';

    // On ne peut pas rejouer le build — il n'y a pas de minifieur ici. Mais un
    // artefact fidèle à ses sources ne peut pas contenir une chaîne littérale
    // ni un appel réseau absents d'elles : c'est décidable, et c'est
    // exactement ce qui trahit un tarball trafiqué.
    //
    // Les commentaires sont retirés d'abord : sans ça, une apostrophe française
    // dans une phrase (« l'environnement ») est prise pour un délimiteur de
    // chaîne, et la vérification se met à signaler de la prose.
    const stripped = (code: string) =>
      code.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
    // Seulement les chaînes entre guillemets simples ou doubles : un littéral
    // de gabarit contient des identifiants, que la minification renomme. Le
    // comparer d'un côté à l'autre produirait des écarts qui ne veulent rien
    // dire — alors qu'une URL codée en dur, elle, traverse la minification
    // intacte.
    const literals = (code: string) =>
      new Set(
        [...stripped(code).matchAll(/(["'])((?:\\.|(?!\1).)*)\1/g)]
          .map((m) => m[2])
          .filter((v) => v.length > 3),
      );
    const inSrc = literals(src);
    const extra = [...literals(build)].filter((v) => !inSrc.has(v));

    const bad: string[] = [];
    if (extra.length) bad.push(`le build contient des chaînes absentes des sources : ${extra.slice(0, 2).join(', ')}`);
    const calls = /\b(fetch|XMLHttpRequest|require\s*\(\s*['"](?:https?|child_process|net)\b)/;
    if (calls.test(stripped(build)) && !calls.test(stripped(src))) bad.push('le build fait un appel réseau que les sources ne font pas');
    return bad.length ? bad.join(' · ') : null;
  },

  'npm-pack-leak': () => {
    const pkg = json<{ files?: string[] }>('package.json');
    if (!pkg) return 'package.json est introuvable ou mal formé';
    if (!Array.isArray(pkg.files) || pkg.files.length === 0) {
      return 'aucun champ « files » : tout le dépôt part dans le paquet publié';
    }
    const risky = pkg.files.filter((f) => f === '.' || f === './' || f === '*');
    return risky.length ? `le champ « files » publie tout (${risky.join(', ')})` : null;
  },
};

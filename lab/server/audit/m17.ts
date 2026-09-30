// Vérifications des challenges M17 · Déploiement, exploitation & résilience.
//
// Même contrat qu'en M14 : une vérification renvoie `null` quand le défaut a
// disparu, ou la raison qui reste — nommant le fichier et ce qui cloche.
//
// Deux règles tiennent tout ce fichier :
//
//  1. On vérifie la **propriété**, jamais la forme du correctif. Plusieurs
//     manières correctes de corriger doivent passer, et une reformulation qui
//     ne corrige rien doit échouer. D'où, par exemple, le fait de juger la
//     DERNIÈRE instruction `USER` de l'image finale, et non la présence d'une
//     instruction `USER` quelque part dans le fichier.
//
//  2. Un fichier absent, vidé ou illisible ne passe jamais au vert. Supprimer
//     le Dockerfile ne corrige pas « le conteneur tourne en root » : chaque
//     vérification constate d'abord que ce qu'elle juge est bien là.

import {
  hclAttr,
  hclAttrDeep,
  hclBlocks,
  hclBool,
  hclCode,
  hclString,
  listDir,
  text,
  yamlDocs,
} from './repo.ts';
import type { Check } from './m14.ts';

// ── Outils de lecture ────────────────────────────────────────────────────────

type Doc = Record<string, unknown>;

const obj = (v: unknown): Doc | null =>
  v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Doc) : null;
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string => (typeof v === 'string' ? v : '');

// ── Dockerfile ───────────────────────────────────────────────────────────────

const DOCKERFILE = 'Dockerfile';

interface Instr {
  name: string;
  args: string;
}

/**
 * Le Dockerfile ramené à ses instructions : commentaires retirés (y compris la
 * directive `# syntax=`), continuations de ligne recollées. Docker ignore un
 * commentaire même au milieu d'une continuation — on fait pareil, sinon un
 * `# CORRIGÉ :` posé au bon endroit casserait l'analyse.
 */
function instructions(raw: string): Instr[] {
  const out: Instr[] = [];
  let buf = '';
  const flush = (line: string) => {
    const full = (buf + line).trim();
    buf = '';
    const m = full.match(/^([A-Za-z]+)\s+([\s\S]+)$/);
    if (m) out.push({ name: m[1].toUpperCase(), args: m[2].trim() });
  };
  for (const rawLine of raw.split('\n')) {
    const line = rawLine.replace(/\r$/, '').trim();
    if (line.startsWith('#')) continue;
    if (buf === '' && line === '') continue;
    if (line.endsWith('\\')) {
      buf += `${line.slice(0, -1)} `;
      continue;
    }
    flush(line);
  }
  if (buf.trim() !== '') flush('');
  return out;
}

/** Une étape de construction : son alias, son image de base, son corps. */
interface Stage {
  alias: string;
  base: string;
  body: Instr[];
}

function stages(instrs: Instr[]): Stage[] {
  const out: Stage[] = [];
  for (const i of instrs) {
    if (i.name === 'FROM') {
      const m = i.args.match(/^(\S+)(?:\s+[Aa][Ss]\s+(\S+))?/);
      out.push({ base: m?.[1] ?? '', alias: (m?.[2] ?? '').toLowerCase(), body: [] });
    } else if (out.length) {
      out[out.length - 1].body.push(i);
    }
  }
  return out;
}

/**
 * L'étape finale et celles dont elle hérite — c'est ce qui compose réellement
 * l'image publiée. `FROM builder` repart de l'état de `builder`, utilisateur
 * courant et node_modules compris : ne juger que la dernière étape serait faux,
 * et juger tout le fichier interdirait la construction multi-étapes, qui est
 * justement le correctif attendu.
 */
function finalChain(all: Stage[]): Stage[] {
  const chain: Stage[] = [];
  const seen = new Set<number>();
  let idx = all.length - 1;
  while (idx >= 0 && !seen.has(idx)) {
    seen.add(idx);
    chain.unshift(all[idx]);
    const parent = all[idx].base.toLowerCase();
    idx = all.findIndex((s) => s.alias !== '' && s.alias === parent);
  }
  return chain;
}

/** Les noms déclarés par un ARG ou un ENV. */
function declaredNames(i: Instr): string[] {
  if (!i.args.includes('=')) return [i.args.split(/\s+/)[0] ?? ''];
  return [...i.args.matchAll(/(?:^|\s)([A-Za-z_][A-Za-z0-9_.]*)\s*=/g)].map((m) => m[1]);
}

const SECRET_NAME = /(TOKEN|SECRET|PASSW|CREDENTIAL|API_?KEY|ACCESS_?KEY|PRIVATE_?KEY)/i;
const INSTALL = /\b(npm|pnpm)\s+(ci|install|i|add)\b|\byarn\s+install\b/;
const PROD_ONLY = /--omit[= ]dev|--production\b|--only[= ]production|--prod\b/;
const PRUNE_PROD = /\b(npm|pnpm)\s+prune\b[^\n]*(--omit[= ]dev|--production\b|--prod\b)/;

/** Les sources d'un COPY/ADD qui embarquent tout le contexte de construction. */
const BROAD = /^(\.|\.\/|\*|\.\/\*|\.\/\.)$/;

// ── docker compose ───────────────────────────────────────────────────────────

const COMPOSE = 'docker-compose.yml';

/**
 * Publier une base de données sur toutes les interfaces la rend joignable
 * depuis le réseau où se trouve la machine — le wifi du café, celui de l'hôtel.
 */
const DATASTORE_PORTS = new Map<number, string>([
  [1433, 'SQL Server'],
  [3306, 'MySQL'],
  [5432, 'PostgreSQL'],
  [5672, 'RabbitMQ'],
  [6379, 'Redis'],
  [9092, 'Kafka'],
  [9200, 'Elasticsearch'],
  [11211, 'memcached'],
  [27017, 'MongoDB'],
]);

const LOOPBACK = /^(127\.\d{1,3}\.\d{1,3}\.\d{1,3}|::1|localhost)$/;

/** L'adresse d'écoute et le port du conteneur d'une entrée `ports:`. */
function binding(entry: unknown): { host: string; container: number } | null {
  const port = (v: unknown) => {
    const n = Number(String(v).trim().split('-')[0]);
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  if (typeof entry === 'number') return { host: '', container: entry };
  if (typeof entry === 'string') {
    let rest = entry.trim().replace(/\/(tcp|udp)$/i, '');
    let host = '';
    const v6 = rest.match(/^\[([^\]]+)\]:(.*)$/);
    if (v6) {
      host = v6[1];
      rest = v6[2];
    }
    const parts = rest.split(':');
    if (!v6 && parts.length === 3) host = parts.shift() ?? '';
    const container = port(parts[parts.length - 1]);
    return container === null ? null : { host, container };
  }
  const o = obj(entry);
  if (!o) return null;
  const container = port(o.target);
  return container === null ? null : { host: str(o.host_ip), container };
}

// ── Kubernetes ───────────────────────────────────────────────────────────────

const K8S_DIR = 'infra/k8s';
const DEPLOYMENT = `${K8S_DIR}/deployment.yaml`;
const RBAC = `${K8S_DIR}/rbac.yaml`;

const WORKLOADS = new Set([
  'Pod',
  'Deployment',
  'StatefulSet',
  'DaemonSet',
  'ReplicaSet',
  'ReplicationController',
  'Job',
  'CronJob',
]);

interface Workload {
  kind: string;
  name: string;
  /** Le `PodSpec`, quel que soit le nombre d'enveloppes au-dessus. */
  pod: Doc;
}

function workloads(docs: unknown[]): Workload[] {
  const out: Workload[] = [];
  for (const d of docs) {
    const doc = obj(d);
    if (!doc) continue;
    const kind = str(doc.kind);
    if (!WORKLOADS.has(kind)) continue;
    const spec = obj(doc.spec);
    const pod =
      kind === 'Pod'
        ? spec
        : kind === 'CronJob'
          ? obj(obj(obj(obj(spec?.jobTemplate)?.spec)?.template)?.spec)
          : obj(obj(spec?.template)?.spec);
    if (pod) out.push({ kind, name: str(obj(doc.metadata)?.name) || kind, pod });
  }
  return out;
}

/** Toutes les charges de travail décrites sous `infra/k8s/`, tous fichiers confondus. */
function allWorkloads(): Workload[] {
  return listDir(K8S_DIR)
    .filter((f) => /\.ya?ml$/.test(f))
    .flatMap((f) => workloads(yamlDocs(`${K8S_DIR}/${f}`) ?? []));
}

const HOST_NAMESPACES: [string, string][] = [
  ['hostNetwork', 'la pile réseau'],
  ['hostPID', 'l’espace de processus'],
  ['hostIPC', 'la mémoire partagée'],
];

// ── Terraform ────────────────────────────────────────────────────────────────

const BACKUP = 'infra/terraform/backup.tf';

/**
 * Les actions **autorisées** par les politiques du fichier.
 *
 * Un `Effect` ouvre une instruction, le suivant la referme. Une action refusée
 * n'est pas un droit : l'ignorer est ce qui permet au correctif « refuser
 * explicitement la suppression » de passer, alors qu'il cite les mêmes actions.
 */
function allowedActions(raw: string): string[] {
  const out: string[] = [];
  const marks = [...raw.matchAll(/"?Effect"?\s*[:=]\s*"(Allow|Deny)"/g)];
  for (let i = 0; i < marks.length; i++) {
    if (marks[i][1] !== 'Allow') continue;
    const start = marks[i].index ?? 0;
    const end = i + 1 < marks.length ? (marks[i + 1].index ?? raw.length) : raw.length;
    const segment = raw.slice(start, end);
    for (const m of segment.matchAll(/"?Action"?\s*[:=]\s*(\[[^\]]*\]|"[^"]*")/g)) {
      for (const a of m[1].matchAll(/"([^"]*)"/g)) out.push(a[1]);
    }
  }
  return out;
}

/** Ce qui permet d'effacer une sauvegarde, ou de lever ce qui l'en empêche. */
const DELETES_BACKUPS =
  /^(\*|s3:\*|s3:Delete.*|s3:PutBucketVersioning|s3:PutBucketObjectLockConfiguration|s3:BypassGovernanceRetention|backup:Delete.*|kms:ScheduleKeyDeletion)$/i;

// ── Vérifications ────────────────────────────────────────────────────────────

const ABSENT = (file: string) => `${file} est absent de la fixture`;

export const m17Checks: Record<string, Check> = {
  // ── Conteneur ──────────────────────────────────────────────────────────────

  dockerfile: () => {
    const raw = text(DOCKERFILE);
    if (raw === null) return `${ABSENT(DOCKERFILE)} : il n’y a plus d’image à durcir`;
    const instrs = instructions(raw);
    const all = stages(instrs);
    if (!all.length) return `${DOCKERFILE} ne contient plus aucune instruction FROM : il ne décrit plus d’image`;

    const bad: string[] = [];
    const body = finalChain(all).flatMap((s) => s.body);

    // 1. Utilisateur. C'est la DERNIÈRE instruction USER qui s'applique à
    //    l'image finale qui décide : en ajouter une au milieu du fichier ne
    //    change rien si une autre la suit, et une USER posée dans une étape
    //    dont l'image finale n'hérite pas ne s'applique jamais.
    const users = body.filter((i) => i.name === 'USER');
    const user = (users[users.length - 1]?.args ?? '').split(':')[0].trim();
    if (user === '') {
      bad.push(`${DOCKERFILE} : aucune instruction USER ne s’applique à l’image finale, le conteneur tourne donc en root`);
    } else if (/^(root|0)$/i.test(user)) {
      bad.push(`${DOCKERFILE} : la dernière instruction USER de l’image finale est « ${user} »`);
    }

    // 2. Dépendances. `npm ci` installe les devDependencies quelle que soit la
    //    valeur de NODE_ENV : seul un drapeau explicite les écarte.
    const runs = body.filter((i) => i.name === 'RUN').map((i) => i.args);
    const pruned = runs.some((r) => PRUNE_PROD.test(r));
    const devInstall = runs.some((r) => INSTALL.test(r) && !PROD_ONLY.test(r));
    const prodInstall = runs.some((r) => INSTALL.test(r) && PROD_ONLY.test(r));
    if (devInstall && !pruned) {
      bad.push(`${DOCKERFILE} : l’image finale installe aussi les dépendances de développement`);
    } else if (!prodInstall && !pruned) {
      bad.push(`${DOCKERFILE} : aucune installation de l’image finale ne se limite aux dépendances de production`);
    }

    // 3. Secrets. Un argument de build reste dans l'historique des couches et
    //    dans le cache du constructeur, même si le fichier qu'il a servi à
    //    écrire est supprimé par une instruction suivante.
    for (const i of instrs) {
      if (i.name !== 'ARG' && i.name !== 'ENV') continue;
      for (const name of declaredNames(i)) {
        if (SECRET_NAME.test(name)) {
          bad.push(`${DOCKERFILE} : ${i.name} ${name} fait entrer un secret dans l’historique des couches`);
        }
      }
    }

    return bad.length ? bad.join(' · ') : null;
  },

  'docker-base-pinning': () => {
    const raw = text(DOCKERFILE);
    if (raw === null) return `${ABSENT(DOCKERFILE)} : il n’y a plus d’image de base à épingler`;
    const all = stages(instructions(raw));
    if (!all.length) return `${DOCKERFILE} ne contient plus aucune instruction FROM : il ne décrit plus d’image`;

    const aliases = new Set(all.map((s) => s.alias).filter(Boolean));
    const bad: string[] = [];
    for (const s of all) {
      // Une étape qui repart d'une autre étape du même fichier n'a pas
      // d'empreinte à épingler : c'est la base de CETTE étape qui compte.
      if (s.base === 'scratch' || aliases.has(s.base.toLowerCase())) continue;
      if (/^\$/.test(s.base)) {
        bad.push(`${DOCKERFILE} : l’image de base « ${s.base} » vient d’une variable, donc d’une référence qu’on ne peut pas vérifier`);
      } else if (!/@sha256:[0-9a-f]{64}$/.test(s.base)) {
        bad.push(`${DOCKERFILE} : l’image de base « ${s.base} » n’est pas épinglée par empreinte`);
      }
    }
    return bad.length ? bad.join(' · ') : null;
  },

  dockerignore: () => {
    const raw = text(DOCKERFILE);
    if (raw === null) return `${ABSENT(DOCKERFILE)} : impossible de juger ce qui entre dans l’image`;
    const instrs = instructions(raw);
    if (!instrs.some((i) => i.name === 'FROM')) {
      return `${DOCKERFILE} ne décrit plus d’image : vider le fichier ne restreint pas ce qui entre dedans`;
    }

    // Un COPY --from vient d'une étape de construction, pas du contexte : il
    // n'embarque que ce que cette étape a produit.
    const broad = instrs.filter((i) => {
      if (i.name !== 'COPY' && i.name !== 'ADD') return false;
      if (/--from=/.test(i.args)) return false;
      const words = i.args.split(/\s+/).filter((w) => !w.startsWith('--'));
      return words.slice(0, -1).some((w) => BROAD.test(w.replace(/^["']|["']$/g, '')));
    });

    // Deux corrections valent : exclure, ou ne copier que ce dont l'image a
    // besoin. La seconde est la meilleure — ce qui n'est pas nommé n'entre pas.
    if (!broad.length) return null;

    const ignore = text('.dockerignore');
    if (ignore === null) {
      return `.dockerignore est absent alors que le Dockerfile copie tout le contexte de construction`;
    }

    const patterns = ignore
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l !== '' && !l.startsWith('#') && !l.startsWith('!'))
      .map((l) => l.replace(/^\.\//, '').replace(/^\*\*\//, '').replace(/\/+$/, ''));
    const covers = (rx: RegExp) => patterns.some((p) => rx.test(p));

    const missing: string[] = [];
    if (!covers(/^\.git([*/]|$)/)) missing.push('l’historique git (.git), qui contient presque toujours des identifiants');
    if (!covers(/^\*?\.env/)) missing.push('les fichiers d’environnement (.env)');
    if (!covers(/tfstate|^\.terraform|^infra([/]|$)/)) missing.push('le state Terraform, qui décrit toute l’infrastructure');
    return missing.length
      ? `.dockerignore n’exclut pas ${missing.join(' · ')}`
      : null;
  },

  'docker-socket': () => {
    if (text(COMPOSE) === null) return ABSENT(COMPOSE);
    const docs = yamlDocs(COMPOSE);
    if (docs === null || !docs.length) return `${COMPOSE} n’est pas du YAML lisible`;
    const services = obj(obj(docs[0])?.services);
    if (!services || !Object.keys(services).length) return `${COMPOSE} ne déclare plus aucun service`;

    const bad: string[] = [];
    for (const [name, value] of Object.entries(services)) {
      const svc = obj(value);
      if (!svc) continue;

      // 1. Le socket du démon équivaut à un accès root sur l'hôte.
      for (const v of arr(svc.volumes)) {
        const source = (typeof v === 'string' ? v.split(':')[0] : str(obj(v)?.source)).trim();
        if (/docker\.sock$/.test(source)) {
          bad.push(`${COMPOSE} : le service ${name} monte le socket du démon Docker`);
        }
      }

      // 2. Le mode privilégié retire ce qu'il restait d'isolation.
      if (svc.privileged === true) bad.push(`${COMPOSE} : le service ${name} tourne en mode privilégié`);

      // 3. Une base publiée sur 0.0.0.0 est offerte à tout le réseau local.
      for (const p of arr(svc.ports)) {
        const b = binding(p);
        const label = b && DATASTORE_PORTS.get(b.container);
        if (b && label && !LOOPBACK.test(b.host)) {
          bad.push(`${COMPOSE} : le service ${name} publie le port ${b.container} (${label}) sur toutes les interfaces`);
        }
      }
    }
    return bad.length ? bad.join(' · ') : null;
  },

  // ── Kubernetes ─────────────────────────────────────────────────────────────

  'k8s-securitycontext': () => {
    if (text(DEPLOYMENT) === null) return ABSENT(DEPLOYMENT);
    const docs = yamlDocs(DEPLOYMENT);
    if (docs === null) return `${DEPLOYMENT} n’est pas du YAML lisible`;
    const found = workloads(docs);
    if (!found.length) return `${DEPLOYMENT} ne décrit plus aucune charge de travail`;

    const bad: string[] = [];
    for (const { kind, name, pod } of found) {
      const where = `${kind}/${name}`;

      for (const [field, label] of HOST_NAMESPACES) {
        if (pod[field] === true) bad.push(`${DEPLOYMENT} : ${where} partage ${label} de l’hôte (${field})`);
      }

      const podSC = obj(pod.securityContext) ?? {};
      const containers = [...arr(pod.containers), ...arr(pod.initContainers)];
      if (!containers.length) {
        bad.push(`${DEPLOYMENT} : ${where} ne déclare aucun conteneur`);
        continue;
      }
      for (const c of containers) {
        const co = obj(c);
        if (!co) continue;
        const who = `${where}/${str(co.name) || 'conteneur sans nom'}`;
        const sc = obj(co.securityContext) ?? {};
        // Le contexte du conteneur l'emporte sur celui du pod ; mais
        // allowPrivilegeEscalation et readOnlyRootFilesystem n'existent qu'au
        // niveau du conteneur — les poser sur le pod ne fait rien.
        const runAsUser = sc.runAsUser !== undefined ? sc.runAsUser : podSC.runAsUser;
        const nonRoot =
          (sc.runAsNonRoot !== undefined ? sc.runAsNonRoot : podSC.runAsNonRoot) === true ||
          (typeof runAsUser === 'number' && runAsUser > 0);

        if (runAsUser === 0) bad.push(`${DEPLOYMENT} : ${who} tourne explicitement en root (runAsUser: 0)`);
        else if (!nonRoot) bad.push(`${DEPLOYMENT} : ${who} ne garantit pas un utilisateur non privilégié (runAsNonRoot ou runAsUser)`);
        if (sc.allowPrivilegeEscalation !== false) bad.push(`${DEPLOYMENT} : ${who} n’interdit pas l’élévation de privilèges (allowPrivilegeEscalation)`);
        if (sc.readOnlyRootFilesystem !== true) bad.push(`${DEPLOYMENT} : ${who} n’a pas de racine en lecture seule (readOnlyRootFilesystem)`);
        if (sc.privileged === true) bad.push(`${DEPLOYMENT} : ${who} tourne en mode privilégié`);
      }
    }
    return bad.length ? bad.join(' · ') : null;
  },

  'k8s-rbac': () => {
    if (text(RBAC) === null) return ABSENT(RBAC);
    const docs = yamlDocs(RBAC);
    if (docs === null) return `${RBAC} n’est pas du YAML lisible`;
    const of = (...want: string[]) =>
      docs.map(obj).filter((d): d is Doc => d !== null && want.includes(str(d.kind)));

    const roles = of('Role', 'ClusterRole');
    const accounts = of('ServiceAccount');
    if (!roles.length && !accounts.length) {
      return `${RBAC} ne déclare plus ni rôle ni compte de service : les droits de l’API ne sont plus décrits`;
    }

    const bad: string[] = [];

    // 1. Les jokers. Remplacer `verbs: ["*"]` par la liste complète des verbes
    //    ne corrige rien : c'est la portée qui compte, pas l'écriture.
    if (!roles.length) bad.push(`${RBAC} ne déclare plus aucun rôle`);
    const FIELDS: [string, string][] = [
      ['verbs', 'les verbes'],
      ['resources', 'les ressources'],
      ['apiGroups', 'les groupes d’API'],
      ['nonResourceURLs', 'les URL hors ressources'],
    ];
    for (const r of roles) {
      const name = `${str(r.kind)} ${str(obj(r.metadata)?.name) || '(sans nom)'}`;
      for (const rule of arr(r.rules)) {
        const ro = obj(rule);
        if (!ro) continue;
        for (const [field, label] of FIELDS) {
          if (arr(ro[field]).some((v) => str(v) === '*')) {
            bad.push(`${RBAC} : ${name} accorde « * » sur ${label}`);
          }
        }
      }
    }

    // 2. Le montage du jeton. Il se coupe côté compte de service, ou pod par
    //    pod : les deux corrigent, donc les deux passent.
    if (!accounts.length) bad.push(`${RBAC} ne déclare plus aucun compte de service`);
    const pods = allWorkloads();
    for (const sa of accounts) {
      if (sa.automountServiceAccountToken === false) continue;
      const name = str(obj(sa.metadata)?.name) || 'default';
      const users = pods.filter((w) =>
        name === 'default'
          ? str(w.pod.serviceAccountName) === '' || str(w.pod.serviceAccountName) === 'default'
          : str(w.pod.serviceAccountName) === name,
      );
      const allOff = users.length > 0 && users.every((w) => w.pod.automountServiceAccountToken === false);
      if (!allOff) {
        bad.push(`${RBAC} : le jeton du compte de service ${name} est monté automatiquement dans les pods (automountServiceAccountToken)`);
      }
    }

    return bad.length ? bad.join(' · ') : null;
  },

  // ── Résilience ─────────────────────────────────────────────────────────────

  'backup-immutable': () => {
    const raw = text(BACKUP);
    if (raw === null) return ABSENT(BACKUP);
    const code = hclCode(raw);
    const resources = hclBlocks(code, BACKUP).filter((b) => b.type === 'resource');
    const of = (type: string) => resources.filter((b) => b.labels[0] === type);
    const buckets = of('aws_s3_bucket');
    const vaults = of('aws_backup_vault');
    if (!buckets.length && !vaults.length) {
      return `${BACKUP} ne déclare plus aucun stockage de sauvegarde : il n’y a plus rien à protéger`;
    }

    const bad: string[] = [];

    // 1. Immuabilité. Le verrou d'objet est un attribut de création du bucket,
    //    et il n'a rien à verrouiller sans versioning : les deux vont ensemble.
    if (buckets.length) {
      const locked =
        of('aws_s3_bucket_object_lock_configuration').length > 0 ||
        buckets.some((b) => hclBool(hclAttr(b.body, 'object_lock_enabled')) === true);
      if (!locked) bad.push(`${BACKUP} : le bucket de sauvegarde n’a aucun verrou d’immuabilité (object lock)`);
      const versioned = of('aws_s3_bucket_versioning').some((b) =>
        hclAttrDeep(b.body, 'status').some((v) => hclString(v) === 'Enabled'),
      );
      if (!versioned) {
        bad.push(`${BACKUP} : le versioning du bucket de sauvegarde n’est pas activé — sans lui une écriture au même nom écrase la sauvegarde`);
      }
    }
    if (vaults.length && !of('aws_backup_vault_lock_configuration').length) {
      bad.push(`${BACKUP} : le coffre AWS Backup n’est pas verrouillé (aws_backup_vault_lock_configuration)`);
    }

    // 2. Personne ne doit pouvoir effacer une sauvegarde — surtout pas le rôle
    //    que l'attaquant vient d'obtenir.
    const deletable = [...new Set(allowedActions(code).filter((a) => DELETES_BACKUPS.test(a)))];
    if (deletable.length) {
      bad.push(`${BACKUP} : une politique autorise encore ${deletable.join(', ')} sur les sauvegardes`);
    }

    // 3. Un compte séparé, parce que le verrou protège les objets, pas le
    //    compte qui les héberge. Réplication S3 vers un autre compte, ou
    //    copy_action d'AWS Backup vers le coffre d'un autre compte : les deux
    //    répondent, donc les deux passent.
    const replicated = of('aws_s3_bucket_replication_configuration').some(
      (b) => hclAttrDeep(b.body, 'account').length > 0,
    );
    const copied = resources.some((b) => hclAttrDeep(b.body, 'destination_vault_arn').length > 0);
    if (!replicated && !copied) {
      bad.push(`${BACKUP} : aucune copie des sauvegardes ne part vers un compte séparé`);
    }

    // 4. Une sauvegarde jamais restaurée est une hypothèse, pas un plan.
    if (!resources.some((b) => /restore_testing/.test(b.labels[0] ?? ''))) {
      bad.push(`${BACKUP} : aucun test de restauration n’est planifié (aws_backup_restore_testing_plan)`);
    }

    return bad.length ? bad.join(' · ') : null;
  },
};

// Vérifications des challenges M16 · Infrastructure as Code.
//
// Même contrat qu'en M14 : `null` quand le défaut a disparu, sinon une phrase
// qui nomme le fichier et ce qui reste.
//
// Deux particularités de ce module :
//
// 1. Il n'y a ni parseur HCL ni binaire `terraform` dans le lab. L'analyse se
//    fait sur le **texte**, commentaires retirés (`hclCode`, `jsCode`,
//    `yamlCode` dans repo.ts) — sans quoi un commentaire qui décrit le
//    correctif suffirait à faire passer la vérification. C'est ce que font
//    beaucoup de linters ; ça oblige à des expressions tolérantes sur
//    l'espacement, l'ordre des attributs et la forme des guillemets.
//
// 2. Le piège du module est la suppression. « Le bucket est public » ne se
//    corrige pas en supprimant le bucket : chaque vérification commence donc
//    par constater que la ressource attendue est toujours là, et ne juge ses
//    attributs qu'ensuite.

import {
  hclAttr,
  hclAttrDeep,
  hclBlocks,
  hclBool,
  hclNumber,
  hclObjectAttrs,
  hclString,
  json,
  jsCode,
  listFilesDeep,
  text,
  tfFiles,
  tfvarsFiles,
  yamlCode,
  type HclBlock,
} from './repo.ts';
import type { Check } from './m14.ts';

const TF = 'infra/terraform';
const CDK_APP = 'infra/cdk/bin/app.ts';
const CDK_STACK = 'infra/cdk/lib/api-stack.ts';
const CDK_JSON = 'infra/cdk/cdk.json';
const CDK_BOOTSTRAP = 'infra/cdk/bootstrap/bootstrap-template.yaml';

// ── Vue Terraform ───────────────────────────────────────────────────────────

const tfBlocks = (): HclBlock[] => tfFiles().flatMap((f) => hclBlocks(f.code, f.file));

const resources = (type?: string): HclBlock[] =>
  tfBlocks().filter((b) => b.type === 'resource' && (type === undefined || b.labels[0] === type));

const named = (type: string, name: string) => resources(type).find((b) => b.labels[1] === name);

/** Les blocs imbriqués d'un bloc, par type. */
const inner = (b: HclBlock, type: string) => hclBlocks(b.body, b.file).filter((x) => x.type === type);

/** Le nom qualifié d'une ressource, pour les messages. */
const label = (b: HclBlock) => `${b.labels[0]}.${b.labels[1]}`;

/**
 * La valeur effective d'un attribut.
 *
 * `var.x` n'est pas une valeur : c'est une indirection. Un module peut être
 * juste en préproduction et faux en production parce que le défaut est dans la
 * variable, pas dans la ressource — on suit donc la chaîne comme le ferait
 * Terraform : un fichier `*.tfvars` d'abord, la valeur par défaut ensuite.
 *
 * `source` dit d'où vient la valeur quand ce n'est pas la ressource elle-même.
 */
interface Value {
  value: string | null;
  source: string | null;
}

const varBlock = (name: string) =>
  tfBlocks().find((b) => b.type === 'variable' && b.labels[0] === name);

const tfvarsValue = (name: string): { value: string; file: string } | null => {
  for (const f of tfvarsFiles()) {
    const v = hclAttr(f.code, name);
    if (v !== null) return { value: v, file: f.file };
  }
  return null;
};

function resolve(raw: string | null, depth = 0): Value {
  if (raw === null) return { value: null, source: null };
  const m = /^var\.([A-Za-z_][A-Za-z0-9_-]*)$/.exec(raw.trim());
  if (!m || depth > 3) return { value: raw.trim(), source: null };
  const override = tfvarsValue(m[1]);
  if (override) {
    const next = resolve(override.value, depth + 1);
    return { value: next.value, source: next.source ?? override.file };
  }
  const declared = varBlock(m[1]);
  const fallback = declared ? hclAttr(declared.body, 'default') : null;
  if (fallback !== null) {
    const next = resolve(fallback, depth + 1);
    return { value: next.value, source: next.source ?? `la valeur par défaut de var.${m[1]}` };
  }
  return { value: null, source: `var.${m[1]}, dont aucune valeur n’est déclarée` };
}

const value = (b: HclBlock, attr: string): Value => resolve(hclAttr(b.body, attr));
const str = (b: HclBlock, attr: string): string | null => hclString(value(b, attr).value);
const bool = (b: HclBlock, attr: string): boolean | null => hclBool(value(b, attr).value);
const num = (b: HclBlock, attr: string): number | null => hclNumber(value(b, attr).value);

/** « … (valeur venue de infra/terraform/prod.auto.tfvars) », quand c'est le cas. */
const from = (v: Value) => (v.source ? ` (valeur venue de ${v.source})` : '');

// ── Réseau ──────────────────────────────────────────────────────────────────

/** Ports dont l'ouverture au monde n'a jamais de justification légitime. */
const ADMIN_PORTS = [22, 23, 135, 139, 445, 1433, 1521, 3306, 3389, 5432, 5984, 6379, 9200, 11211, 27017];

const PRIVATE_NETS: [string, number][] = [
  ['10.0.0.0', 8],
  ['172.16.0.0', 12],
  ['192.168.0.0', 16],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
];

const ipToInt = (ip: string) => ip.split('.').reduce((acc, b) => acc * 256 + Number(b), 0);

/**
 * Un CIDR « public », au sens : joignable depuis l'extérieur du VPC.
 *
 * On ne se contente pas de chercher `0.0.0.0/0` — sinon `0.0.0.0/1` suffirait
 * à faire passer la vérification sans rien refermer.
 */
function isPublicCidr(raw: string): boolean {
  const c = (hclString(resolve(raw).value) ?? '').trim();
  if (/^(::|0:0:0:0:0:0:0:0)\/\d{1,3}$/.test(c)) return Number(c.split('/')[1]) < 64;
  const m = /^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\/(\d{1,2})$/.exec(c);
  if (!m) return false; // une référence non littérale ne se juge pas ici
  const ip = ipToInt(m[1]);
  const len = Number(m[2]);
  for (const [net, plen] of PRIVATE_NETS) {
    if (len >= plen && Math.floor(ip / 2 ** (32 - plen)) === Math.floor(ipToInt(net) / 2 ** (32 - plen))) {
      return false;
    }
  }
  return true;
}

interface Rule {
  where: string;
  group: string;
  from: number | null;
  to: number | null;
  protocol: string | null;
  cidrs: string[];
  groups: string[];
}

/** Les ports d'administration couverts par une règle. */
function adminPortsOf(r: Rule): number[] {
  const proto = (r.protocol ?? 'tcp').toLowerCase();
  if (proto === '-1' || proto === 'all') return ADMIN_PORTS;
  if (proto !== 'tcp' && proto !== '6') return [];
  const lo = r.from ?? 0;
  const hi = r.to ?? 65535;
  return ADMIN_PORTS.filter((p) => p >= lo && p <= hi);
}

function ingressRules(): Rule[] {
  const out: Rule[] = [];
  for (const sg of resources('aws_security_group')) {
    for (const ing of inner(sg, 'ingress')) {
      out.push({
        where: sg.file,
        group: label(sg),
        from: hclNumber(resolve(hclAttr(ing.body, 'from_port')).value),
        to: hclNumber(resolve(hclAttr(ing.body, 'to_port')).value),
        protocol: hclString(resolve(hclAttr(ing.body, 'protocol')).value),
        cidrs: [
          ...(hclAttr(ing.body, 'cidr_blocks') ? splitList(hclAttr(ing.body, 'cidr_blocks')!) : []),
          ...(hclAttr(ing.body, 'ipv6_cidr_blocks') ? splitList(hclAttr(ing.body, 'ipv6_cidr_blocks')!) : []),
        ],
        groups: hclAttr(ing.body, 'security_groups') ? splitList(hclAttr(ing.body, 'security_groups')!) : [],
      });
    }
  }
  for (const rule of resources('aws_vpc_security_group_ingress_rule')) {
    const target = hclAttr(rule.body, 'security_group_id') ?? '';
    out.push({
      where: rule.file,
      group: /aws_security_group\.([A-Za-z0-9_-]+)/.exec(target)?.[0] ?? label(rule),
      from: hclNumber(resolve(hclAttr(rule.body, 'from_port')).value),
      to: hclNumber(resolve(hclAttr(rule.body, 'to_port')).value),
      protocol: hclString(resolve(hclAttr(rule.body, 'ip_protocol')).value),
      cidrs: [hclAttr(rule.body, 'cidr_ipv4'), hclAttr(rule.body, 'cidr_ipv6')].filter(
        (v): v is string => v !== null,
      ),
      groups: [hclAttr(rule.body, 'referenced_security_group_id')].filter((v): v is string => v !== null),
    });
  }
  return out;
}

/** Les éléments d'une liste HCL, ou la valeur seule si ce n'en est pas une. */
function splitList(raw: string): string[] {
  const v = raw.trim();
  if (!v.startsWith('[')) return [v];
  const inner2 = v.slice(1, v.lastIndexOf(']'));
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  let i = 0;
  while (i < inner2.length) {
    const c = inner2[i];
    if (c === '"') {
      i++;
      while (i < inner2.length && inner2[i] !== '"') i += inner2[i] === '\\' ? 2 : 1;
      i++;
      continue;
    }
    if (c === '[' || c === '{' || c === '(') depth++;
    else if (c === ']' || c === '}' || c === ')') depth--;
    else if (c === ',' && depth === 0) {
      out.push(inner2.slice(start, i));
      start = i + 1;
    }
    i++;
  }
  out.push(inner2.slice(start));
  return out.map((s) => s.trim()).filter((s) => s !== '');
}

// ── S3 ──────────────────────────────────────────────────────────────────────

const PAB_FLAGS = ['block_public_acls', 'block_public_policy', 'ignore_public_acls', 'restrict_public_buckets'];

/** Un blocage d'accès public est complet quand les quatre drapeaux sont à true. */
const blocksEverything = (b: HclBlock) => PAB_FLAGS.every((f) => bool(b, f) === true);

/** Les ressources rattachées à un bucket donné par leur attribut `bucket`. */
const attachedTo = (type: string, bucket: HclBlock) =>
  resources(type).filter((b) => (hclAttr(b.body, 'bucket') ?? '').includes(`aws_s3_bucket.${bucket.labels[1]}`));

/**
 * Les déclarations d'une politique écrite en `jsonencode({ … })`.
 *
 * On découpe, parce que la propriété à vérifier est « aucune déclaration
 * **Allow** ne vise un principal joker » : un `Deny` sur `Principal: "*"` —
 * refuser le transport en clair, par exemple — est au contraire une bonne
 * pratique, et une vérification qui le sanctionnerait pousserait à l'enlever.
 */
function policyStatements(doc: string): string[] {
  const head = /["']?Statement["']?\s*[=:]\s*/.exec(doc);
  if (!head) return [doc];
  const start = head.index + head[0].length;
  if (doc[start] !== '[') return [doc.slice(start)];
  let depth = 0;
  let i = start;
  while (i < doc.length) {
    const c = doc[i];
    if (c === '"') {
      i++;
      while (i < doc.length && doc[i] !== '"') i += doc[i] === '\\' ? 2 : 1;
      i++;
      continue;
    }
    if (c === '[' || c === '{' || c === '(') depth++;
    else if (c === ']' || c === '}' || c === ')') {
      depth--;
      if (depth === 0) break;
    }
    i++;
  }
  return splitList(doc.slice(start, i + 1));
}

/** Une déclaration qui accorde quelque chose à n'importe qui. */
const allowsAnyone = (statement: string) => {
  const effect = /["']?Effect["']?\s*[=:]\s*["'](\w+)["']/.exec(statement)?.[1] ?? 'Allow';
  if (effect.toLowerCase() !== 'allow') return false;
  return (
    /["']?Principal["']?\s*[=:]\s*["']\*["']/.test(statement) ||
    /["']?AWS["']?\s*[=:]\s*\[?\s*["']\*["']/.test(statement)
  );
};

const isVersioned = (bucket: HclBlock) =>
  attachedTo('aws_s3_bucket_versioning', bucket).some((v) =>
    hclAttrDeep(v.body, 'status').some((s) => hclString(s) === 'Enabled'),
  ) || inner(bucket, 'versioning').some((v) => hclBool(hclAttr(v.body, 'enabled')) === true);

// ── Divers ──────────────────────────────────────────────────────────────────

/** Une contrainte de version est utilisable si elle est bornée vers le haut. */
function boundedAbove(constraint: string): boolean {
  const parts = constraint.split(',').map((s) => s.trim()).filter(Boolean);
  if (!parts.length) return false;
  return parts.some(
    (p) =>
      /^(=\s*)?v?\d+(\.\d+)*(-[\w.]+)?$/.test(p) || // 5.82.2 ou = 5.82.2
      /^<=?\s*v?\d+(\.\d+)*/.test(p) || //             < 6.0.0
      /^~>\s*v?\d+\.\d+/.test(p), //                   ~> 5.82 (borné à 5.x, resp. 5.82.x)
  );
}

/** Une section YAML, délimitée par l'indentation de sa clé. */
function yamlSection(doc: string, key: string): string | null {
  const lines = doc.split('\n');
  const start = lines.findIndex((l) => new RegExp(`^\\s*${key}\\s*:\\s*$`).test(l));
  if (start < 0) return null;
  const indent = (/^\s*/.exec(lines[start]) ?? [''])[0].length;
  const out = [lines[start]];
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].trim() === '') {
      out.push(lines[i]);
      continue;
    }
    if ((/^\s*/.exec(lines[i]) ?? [''])[0].length <= indent) break;
    out.push(lines[i]);
  }
  return out.join('\n');
}

/** Les éléments littéraux d'un tableau TypeScript — `arnForObjects('*')` n'en est pas un. */
function literalItems(arrayBody: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  let i = 0;
  const push = (chunk: string) => {
    const t = chunk.trim();
    if (/^(['"`])[^'"`]*\1$/.test(t)) out.push(t.slice(1, -1));
  };
  while (i < arrayBody.length) {
    const c = arrayBody[i];
    if (c === '"' || c === "'" || c === '`') {
      i++;
      while (i < arrayBody.length && arrayBody[i] !== c) i += arrayBody[i] === '\\' ? 2 : 1;
      i++;
      continue;
    }
    if (c === '[' || c === '{' || c === '(') depth++;
    else if (c === ']' || c === '}' || c === ')') depth--;
    else if (c === ',' && depth === 0) {
      push(arrayBody.slice(start, i));
      start = i + 1;
    }
    i++;
  }
  push(arrayBody.slice(start));
  return out;
}

const join = (bad: string[]) => (bad.length ? [...new Set(bad)].join(' · ') : null);

export const m16Checks: Record<string, Check> = {
  // ── Terraform · stockage ──────────────────────────────────────────────────

  'tf-public-bucket': () => {
    const bucket = named('aws_s3_bucket', 'attachments');
    if (!bucket) {
      return `aws_s3_bucket.attachments est introuvable dans ${TF}/ : le bucket des pièces jointes se durcit, il ne se supprime pas`;
    }
    const bad: string[] = [];

    const blockers = [...attachedTo('aws_s3_bucket_public_access_block', bucket), ...resources('aws_s3_account_public_access_block')];
    if (!blockers.some(blocksEverything)) {
      const missing = [...new Set(blockers.flatMap((b) => PAB_FLAGS.filter((f) => bool(b, f) !== true)))];
      bad.push(
        blockers.length
          ? `${bucket.file} : le blocage d’accès public est incomplet — ${missing.join(', ')} ${missing.length > 1 ? 'ne sont pas à true' : 'n’est pas à true'}`
          : `${bucket.file} : aucun blocage d’accès public ne couvre aws_s3_bucket.attachments`,
      );
    }

    const sse = attachedTo('aws_s3_bucket_server_side_encryption_configuration', bucket);
    const encrypted =
      sse.some((b) => hclAttrDeep(b.body, 'sse_algorithm').length > 0) ||
      inner(bucket, 'server_side_encryption_configuration').length > 0;
    if (!encrypted) bad.push(`${bucket.file} : le bucket des pièces jointes n’a pas de chiffrement par défaut`);

    if (!isVersioned(bucket)) bad.push(`${bucket.file} : le versioning du bucket des pièces jointes n’est pas activé`);

    const logged = attachedTo('aws_s3_bucket_logging', bucket).length > 0 || inner(bucket, 'logging').length > 0;
    if (!logged) bad.push(`${bucket.file} : aucune journalisation des accès au bucket des pièces jointes`);

    for (const policy of attachedTo('aws_s3_bucket_policy', bucket)) {
      const doc = hclAttr(policy.body, 'policy') ?? '';
      if (policyStatements(doc).some(allowsAnyone)) {
        bad.push(
          `${policy.file} : la politique du bucket accorde encore l’accès à Principal "*" — l’accès passe par le contrôle d’origine, pas par une politique publique`,
        );
      }
    }

    const raw = text(bucket.file) ?? '';
    // La syntaxe exacte des suppressions, délimiteur compris : sans lui, une
    // phrase qui *parle* des exceptions en serait une.
    const waivers = raw.match(/(?:checkov:skip=|tfsec:ignore:|trivy:ignore:|terrascan:skip:|#\s*nosec\b)[^\n]*/gi) ?? [];
    if (waivers.length) {
      bad.push(`${bucket.file} : ${waivers.length} exception(s) de scanner y subsistent (${(waivers[0] ?? '').trim()})`);
    }

    return join(bad);
  },

  // ── Terraform · réseau ────────────────────────────────────────────────────

  'tf-open-sg': () => {
    const groups = resources('aws_security_group');
    if (!groups.length) return `aucun aws_security_group dans ${TF}/ : les groupes se referment, ils ne se suppriment pas`;
    const db = groups.find((g) => g.labels[1] === 'db');
    if (!db) return `aws_security_group.db est introuvable dans ${TF}/ : la base doit rester décrite et joignable par l’application`;

    const bad: string[] = [];
    const rules = ingressRules();

    for (const r of rules) {
      const ports = adminPortsOf(r);
      if (!ports.length) continue;
      for (const cidr of r.cidrs) {
        if (!isPublicCidr(cidr)) continue;
        bad.push(
          `${r.where} : ${r.group} accepte ${hclString(resolve(cidr).value)} sur le port ${ports.length > 3 ? `${r.from ?? 0}-${r.to ?? 65535}` : ports.join('/')}`,
        );
      }
    }

    const dbRules = rules.filter((r) => r.group.endsWith('.db') || r.group === label(db));
    if (!dbRules.length) {
      bad.push(`${db.file} : aws_security_group.db n’accepte plus aucun trafic entrant — la base est injoignable, ce n’est pas une correction`);
    } else if (!dbRules.some((r) => r.groups.length > 0 || r.cidrs.some((c) => !isPublicCidr(c)))) {
      bad.push(`${db.file} : aucune règle ne rend la base joignable depuis le groupe de l’application`);
    }

    return join(bad);
  },

  // ── Terraform · base de données ───────────────────────────────────────────

  'tf-rds-hardening': () => {
    const db = named('aws_db_instance', 'invoices') ?? resources('aws_db_instance')[0];
    if (!db) return `aucun aws_db_instance dans ${TF}/ : la base des factures se durcit, elle ne se supprime pas`;
    const bad: string[] = [];

    const publicly = value(db, 'publicly_accessible');
    if (hclBool(publicly.value) === true) {
      bad.push(`${db.file} : ${label(db)} est publiquement accessible${from(publicly)}`);
    }

    const encrypted = value(db, 'storage_encrypted');
    if (hclBool(encrypted.value) !== true) {
      bad.push(`${db.file} : le stockage de ${label(db)} n’est pas chiffré (storage_encrypted = ${encrypted.value ?? 'absent'})${from(encrypted)}`);
    }

    const protection = value(db, 'deletion_protection');
    if (hclBool(protection.value) !== true) {
      bad.push(`${db.file} : ${label(db)} n’a pas de protection contre la suppression (deletion_protection = ${protection.value ?? 'absent'})${from(protection)}`);
    }

    const retention = value(db, 'backup_retention_period');
    const days = hclNumber(retention.value);
    if (days === null || days < 1) {
      bad.push(`${db.file} : ${label(db)} ne conserve aucune sauvegarde (backup_retention_period = ${retention.value ?? 'absent'})${from(retention)}`);
    }

    const skip = value(db, 'skip_final_snapshot');
    if (hclBool(skip.value) === true) {
      bad.push(`${db.file} : ${label(db)} ne prend pas d’instantané final (skip_final_snapshot = true)${from(skip)}`);
    }

    return join(bad);
  },

  'tf-state-secret': () => {
    const db = named('aws_db_instance', 'invoices') ?? resources('aws_db_instance')[0];
    if (!db) return `aucun aws_db_instance dans ${TF}/ : le secret se sort du code, la base reste`;
    const bad: string[] = [];

    const managed = bool(db, 'manage_master_user_password') === true;
    const password = hclAttr(db.body, 'password');

    if (managed && password !== null) {
      bad.push(`${db.file} : manage_master_user_password est actif mais l’attribut password est encore là`);
    } else if (!managed) {
      if (password === null) {
        bad.push(`${db.file} : ${label(db)} n’a ni mot de passe ni manage_master_user_password — la base ne démarrerait pas`);
      } else if (/^"/.test(password.trim()) && !/\$\{/.test(password)) {
        bad.push(`${db.file} : le mot de passe de la base est encore écrit en clair dans le code, donc aussi dans le state`);
      } else {
        const fromVault = /(data\.aws_secretsmanager_secret_version|data\.aws_ssm_parameter|data\.aws_kms_secrets|random_password\.|ephemeral\.)/.test(password);
        const v = /^var\.([A-Za-z_][A-Za-z0-9_-]*)$/.exec(password.trim());
        const sensitiveVar =
          v !== null &&
          (() => {
            const decl = varBlock(v[1]);
            return (
              decl !== undefined &&
              hclBool(hclAttr(decl.body, 'sensitive')) === true &&
              hclAttr(decl.body, 'default') === null &&
              tfvarsValue(v[1]) === null
            );
          })();
        if (!fromVault && !sensitiveVar) {
          bad.push(
            `${db.file} : password = ${password} ne vient ni du gestionnaire de secrets ni d’une variable marquée sensible et sans valeur par défaut`,
          );
        }
      }
    }

    for (const f of tfFiles()) {
      for (const attr of ['password', 'master_password', 'secret_string', 'private_key']) {
        for (const raw of hclAttrDeep(f.code, attr)) {
          const literal = raw.trim();
          if (/^"/.test(literal) && !/\$\{/.test(literal) && hclString(literal) !== '') {
            bad.push(`${f.file} : un secret littéral subsiste (${attr})`);
          }
        }
      }
    }

    return join(bad);
  },

  'tf-state-committed': () => {
    const bad: string[] = [];

    const states = listFilesDeep('infra', /\.tfstate(\.backup)?$/);
    if (states.length) {
      bad.push(`${states.join(', ')} : un fichier de state est encore dans le dépôt — et son contenu est à considérer comme brûlé`);
    }

    const raw = text(`${TF}/.gitignore`);
    if (raw === null) {
      bad.push(`${TF}/.gitignore est absent : rien n’empêche le prochain state d’être ajouté au dépôt`);
    } else {
      const patterns = raw
        .split('\n')
        .map((l) => l.replace(/#.*$/, '').trim())
        .filter((l) => l !== '' && !l.startsWith('!'));
      const matches = (pattern: string, file: string) => {
        const p = pattern.replace(/^\//, '').replace(/\/$/, '');
        if (p === '') return false;
        const rx = new RegExp(
          `^${p
            .replace(/[.+^${}()|[\]\\]/g, '\\$&')
            .replace(/\*\*/g, '\u0000')
            .replace(/\*/g, '[^/]*')
            .replace(/\u0000/g, '.*')
            .replace(/\?/g, '.')}$`,
        );
        return rx.test(file);
      };
      for (const name of ['terraform.tfstate', 'terraform.tfstate.backup']) {
        if (!patterns.some((p) => matches(p, name))) {
          bad.push(`${TF}/.gitignore n’exclut pas ${name}`);
        }
      }
    }

    const remote = tfBlocks()
      .filter((b) => b.type === 'terraform')
      .some((b) => hclBlocks(b.body).some((x) => x.type === 'backend' || x.type === 'cloud'));
    if (!remote) bad.push(`aucun backend distant n’est déclaré dans ${TF}/ : le state reste un fichier local qu’on finira par committer`);

    return join(bad);
  },

  'tf-backend': () => {
    const backends = tfBlocks()
      .filter((b) => b.type === 'terraform')
      .flatMap((b) => hclBlocks(b.body, b.file))
      .filter((b) => b.type === 'backend' || b.type === 'cloud');
    if (!backends.length) return `aucun bloc backend dans ${TF}/ : le state doit rester distant, chiffré et verrouillé`;

    const bad: string[] = [];
    const s3 = backends.filter((b) => b.type === 'backend' && b.labels[0] === 's3');

    for (const be of s3) {
      if (bool(be, 'encrypt') !== true) bad.push(`${be.file} : le backend S3 ne chiffre pas le state (encrypt)`);
      if ((str(be, 'kms_key_id') ?? '') === '') {
        bad.push(`${be.file} : le backend S3 n’utilise aucune clé gérée (kms_key_id)`);
      }
      const locked = (str(be, 'dynamodb_table') ?? '') !== '' || bool(be, 'use_lockfile') === true;
      if (!locked) bad.push(`${be.file} : rien ne verrouille le state (ni dynamodb_table, ni use_lockfile)`);
    }

    if (s3.length) {
      const bucket =
        named('aws_s3_bucket', 'tfstate') ??
        resources('aws_s3_bucket').find((b) => (str(b, 'bucket') ?? '').includes('tfstate'));
      if (!bucket) {
        bad.push(`${TF}/ : le bucket qui porte le state n’est plus décrit — restreindre son accès suppose de le décrire`);
      } else {
        const blockers = [...attachedTo('aws_s3_bucket_public_access_block', bucket), ...resources('aws_s3_account_public_access_block')];
        if (!blockers.some(blocksEverything)) {
          bad.push(`${bucket.file} : le bucket de state n’a pas les quatre drapeaux de blocage d’accès public à true`);
        }
        if (!isVersioned(bucket)) {
          bad.push(`${bucket.file} : le bucket de state n’est pas versionné — une écriture fautive y est définitive`);
        }
      }
    }

    return join(bad);
  },

  'tf-unpinned-provider': () => {
    const required = tfBlocks()
      .filter((b) => b.type === 'terraform')
      .flatMap((b) => hclBlocks(b.body, b.file))
      .filter((b) => b.type === 'required_providers');
    if (!required.length) return `aucun bloc required_providers dans ${TF}/ : les versions des providers doivent rester déclarées`;

    const bad: string[] = [];
    let declared = 0;
    for (const rp of required) {
      for (const provider of hclObjectAttrs(rp.body, rp.file)) {
        declared++;
        const constraint = hclString(hclAttr(provider.body, 'version'));
        if (constraint === null || constraint.trim() === '') {
          bad.push(`${rp.file} : le provider ${provider.type} n’a aucune contrainte de version`);
        } else if (!boundedAbove(constraint)) {
          bad.push(`${rp.file} : la contrainte « ${constraint} » du provider ${provider.type} est ouverte vers le haut`);
        }
      }
    }
    if (!declared) bad.push(`${TF}/ : required_providers ne déclare plus aucun provider`);

    const modules = tfBlocks().filter((b) => b.type === 'module');
    if (!modules.length) bad.push(`${TF}/ : le module externe a disparu — l’épingler est la correction, pas le supprimer`);
    for (const mod of modules) {
      const source = hclString(hclAttr(mod.body, 'source')) ?? '';
      if (/^\.{1,2}\//.test(source)) continue; // module local : rien à épingler
      if (/^git(::|@)|\.git($|\/|\?)|^github\.com\//.test(source)) {
        const ref = /[?&]ref=([^&]+)/.exec(source)?.[1] ?? '';
        if (!/^[0-9a-f]{40}$/.test(ref)) {
          bad.push(`${mod.file} : le module « ${mod.labels[0]} » est tiré de git sur la référence mobile « ${ref || 'aucune'} » au lieu d’une empreinte de commit`);
        }
        continue;
      }
      const constraint = hclString(hclAttr(mod.body, 'version'));
      if (constraint === null || constraint.trim() === '') {
        bad.push(`${mod.file} : le module « ${mod.labels[0]} » n’a aucune contrainte de version`);
      } else if (!boundedAbove(constraint)) {
        bad.push(`${mod.file} : la contrainte « ${constraint} » du module « ${mod.labels[0]} » est ouverte vers le haut`);
      }
    }

    return join(bad);
  },

  // ── Terraform · exposition ────────────────────────────────────────────────

  'tf-alb-tls': () => {
    const balancers = [...resources('aws_lb'), ...resources('aws_alb')];
    const alb = balancers.find((b) => (str(b, 'load_balancer_type') ?? 'application') === 'application');
    if (!alb) return `aucun répartiteur applicatif dans ${TF}/ : il se durcit, il ne se supprime pas`;
    const bad: string[] = [];

    const logs = inner(alb, 'access_logs');
    if (!logs.length) {
      bad.push(`${alb.file} : ${label(alb)} n’écrit aucun journal d’accès (bloc access_logs absent)`);
    } else if (!logs.some((l) => hclBool(resolve(hclAttr(l.body, 'enabled')).value) === true && (hclString(resolve(hclAttr(l.body, 'bucket')).value) ?? '') !== '')) {
      bad.push(`${alb.file} : le bloc access_logs est là mais n’est pas activé, ou ne désigne aucun bucket`);
    }

    const listeners = [...resources('aws_lb_listener'), ...resources('aws_alb_listener')];
    if (!listeners.length) return join([...bad, `${alb.file} : plus aucun listener — le répartiteur ne sert plus rien`]);

    let secure = 0;
    for (const l of listeners) {
      const protocol = (str(l, 'protocol') ?? 'HTTP').toUpperCase();
      const port = num(l, 'port');
      if (protocol === 'HTTP' || port === 80) {
        const actions = inner(l, 'default_action');
        const redirects =
          actions.length > 0 &&
          actions.every((a) => {
            if (hclString(hclAttr(a.body, 'type')) !== 'redirect') return false;
            const redirect = hclBlocks(a.body).find((x) => x.type === 'redirect');
            return redirect !== undefined && (hclString(hclAttr(redirect.body, 'protocol')) ?? '').toUpperCase() === 'HTTPS';
          });
        if (!redirects) bad.push(`${l.file} : le listener ${label(l)} sert le port 80 en clair au lieu de rediriger vers HTTPS`);
      }
      if (protocol === 'HTTPS' || protocol === 'TLS' || port === 443) {
        secure++;
        const policy = str(l, 'ssl_policy') ?? '';
        if (!/TLS13-1-2|TLS-1-2|FS-1-2/.test(policy) || /TLS-1-0|TLS-1-1|-201[0-6]-/.test(policy)) {
          bad.push(`${l.file} : la politique TLS « ${policy || 'absente'} » du listener ${label(l)} accepte encore TLS 1.0 ou 1.1`);
        }
      }
    }
    if (!secure) bad.push(`${alb.file} : aucun listener HTTPS — rediriger vers un port qui n’écoute pas ne corrige rien`);

    return join(bad);
  },

  'cloudfront-waf': () => {
    const dist = resources('aws_cloudfront_distribution')[0];
    if (!dist) return `aucune aws_cloudfront_distribution dans ${TF}/ : la distribution se durcit, elle ne se supprime pas`;
    const bad: string[] = [];

    const behaviors = [...inner(dist, 'default_cache_behavior'), ...inner(dist, 'ordered_cache_behavior')];
    if (!behaviors.length) bad.push(`${dist.file} : la distribution n’a plus de comportement de cache`);
    for (const b of behaviors) {
      const policy = hclString(resolve(hclAttr(b.body, 'viewer_protocol_policy')).value) ?? '';
      if (policy !== 'redirect-to-https' && policy !== 'https-only') {
        const path = hclString(hclAttr(b.body, 'path_pattern')) ?? 'default';
        bad.push(`${dist.file} : le comportement « ${path} » garde viewer_protocol_policy = « ${policy || 'absent'} » et sert donc du HTTP en clair`);
      }
    }

    const cert = inner(dist, 'viewer_certificate')[0];
    const minimum = cert ? hclString(resolve(hclAttr(cert.body, 'minimum_protocol_version')).value) ?? '' : '';
    if (!/^TLSv1\.[23]/.test(minimum)) {
      bad.push(`${dist.file} : minimum_protocol_version = « ${minimum || 'absent'} » : la distribution accepte encore TLS 1.0/1.1`);
    }

    if ((str(dist, 'web_acl_id') ?? '') === '') {
      bad.push(`${dist.file} : la distribution n’est associée à aucun pare-feu applicatif (web_acl_id)`);
    }

    const waf = resources('aws_wafv2_web_acl')[0];
    if (!waf) {
      bad.push(`${TF}/ : aucun aws_wafv2_web_acl — le pare-feu se passe en blocage, il ne se supprime pas`);
    } else {
      const rules = inner(waf, 'rule');
      if (!rules.some((r) => /managed_rule_group_statement/.test(r.body))) {
        bad.push(`${waf.file} : le pare-feu n’associe aucun groupe de règles managé`);
      }
      for (const r of rules) {
        if (/override_action\s*\{\s*count\s*\{/.test(r.body) || /(?:^|\n)\s*action\s*\{\s*count\s*\{/.test(r.body)) {
          bad.push(`${waf.file} : la règle « ${hclString(hclAttr(r.body, 'name')) ?? '?'} » est en mode comptage — elle observe, elle ne bloque pas`);
        }
      }
      const rate = rules.find((r) => /rate_based_statement/.test(r.body));
      if (!rate) {
        bad.push(`${waf.file} : aucune règle de limitation de débit au bord`);
      } else if (!/action\s*\{\s*block\s*\{/.test(rate.body)) {
        bad.push(`${waf.file} : la règle de limitation de débit ne bloque pas`);
      }
    }

    return join(bad);
  },

  'imdsv1-terraform': () => {
    const hosts = [...resources('aws_launch_template'), ...resources('aws_instance')];
    if (!hosts.length) return `aucun aws_launch_template ni aws_instance dans ${TF}/ : IMDSv2 s’exige sur les ressources, il ne se règle pas en les supprimant`;
    const bad: string[] = [];

    for (const host of hosts) {
      const options = inner(host, 'metadata_options')[0];
      if (!options) {
        bad.push(`${host.file} : ${label(host)} n’a aucun bloc metadata_options — IMDSv1 y reste accepté`);
        continue;
      }
      if (hclString(resolve(hclAttr(options.body, 'http_endpoint')).value) === 'disabled') continue;

      const tokens = resolve(hclAttr(options.body, 'http_tokens'));
      if (hclString(tokens.value) !== 'required') {
        bad.push(`${host.file} : ${label(host)} laisse http_tokens à « ${hclString(tokens.value) ?? 'absent'} » — une SSRF simple suffit${from(tokens)}`);
      }
      const hops = resolve(hclAttr(options.body, 'http_put_response_hop_limit'));
      const limit = hclNumber(hops.value);
      if (limit === null) {
        bad.push(`${host.file} : ${label(host)} ne limite pas le nombre de sauts (http_put_response_hop_limit)`);
      } else if (limit > 2) {
        bad.push(`${host.file} : ${label(host)} autorise ${limit} sauts vers les métadonnées${from(hops)}`);
      }
    }

    return join(bad);
  },

  // ── Terraform · journalisation ────────────────────────────────────────────

  'tf-logging': () => {
    const bad: string[] = [];

    const vpcs = resources('aws_vpc');
    const flows = resources('aws_flow_log');
    if (!vpcs.length) {
      bad.push(`${TF}/ : aucun aws_vpc — la journalisation se pose sur le réseau, elle ne se règle pas en le supprimant`);
    }
    if (!flows.length) {
      bad.push(`${TF}/ : aucun aws_flow_log — le trafic réseau n’est pas journalisé`);
    }
    for (const vpc of vpcs) {
      if (!flows.some((f) => (hclAttr(f.body, 'vpc_id') ?? '').includes(`aws_vpc.${vpc.labels[1]}`))) {
        bad.push(`${vpc.file} : aws_vpc.${vpc.labels[1]} n’est couvert par aucun journal de flux`);
      }
    }
    for (const flow of flows) {
      const traffic = str(flow, 'traffic_type');
      if (traffic !== 'ALL') {
        bad.push(`${flow.file} : ${label(flow)} ne journalise que « ${traffic ?? 'absent'} » au lieu de tout le trafic`);
      }
    }

    const trails = resources('aws_cloudtrail');
    if (!trails.length) {
      bad.push(`${TF}/ : aucune piste d’audit (aws_cloudtrail)`);
    }
    for (const trail of trails) {
      if (bool(trail, 'is_multi_region_trail') !== true) {
        bad.push(`${trail.file} : ${label(trail)} n’est pas multi-région — ce qui se passe ailleurs n’est pas enregistré`);
      }
      if (bool(trail, 'enable_log_file_validation') !== true) {
        bad.push(`${trail.file} : ${label(trail)} n’a pas la validation d’intégrité — rien ne prouvera qu’elle n’a pas été retouchée`);
      }
    }

    const tasks = resources('aws_ecs_task_definition');
    if (!tasks.length) {
      bad.push(`${TF}/ : aucune définition de tâche ECS — le pilote de journalisation se pose sur les conteneurs, pas en les retirant`);
    }
    for (const task of tasks) {
      const containers = hclAttr(task.body, 'container_definitions') ?? '';
      const images = (containers.match(/["']?image["']?\s*[=:]/g) ?? []).length;
      const configured = (containers.match(/logConfiguration/g) ?? []).length;
      if (configured < Math.max(images, 1)) {
        bad.push(`${task.file} : ${label(task)} a ${configured} conteneur(s) journalisé(s) sur ${images} — un conteneur sans logConfiguration n’écrit nulle part`);
      } else if (!/logDriver/.test(containers)) {
        bad.push(`${task.file} : ${label(task)} déclare logConfiguration sans logDriver`);
      }
    }

    return join(bad);
  },

  // ── CDK ───────────────────────────────────────────────────────────────────

  'cdk-wildcard': () => {
    const raw = text(CDK_STACK);
    if (raw === null) return `${CDK_STACK} est absent : la politique se restreint, la pile ne se supprime pas`;
    const code = jsCode(raw);
    const bad: string[] = [];

    if (!/new\s+s3\.Bucket\s*\(/.test(code)) bad.push(`${CDK_STACK} : le bucket des pièces jointes n’y est plus décrit`);
    if (!/new\s+dynamodb\.Table\s*\(/.test(code)) bad.push(`${CDK_STACK} : la table des factures n’y est plus décrite`);
    if (!/new\s+(?:lambda\.)?(?:Function|NodejsFunction)\s*\(/.test(code)) bad.push(`${CDK_STACK} : la fonction de l’API n’y est plus décrite`);
    if (!/\.grant[A-Z]\w*\s*\(|addToRolePolicy\s*\(|new\s+iam\.PolicyStatement\s*\(/.test(code)) {
      bad.push(`${CDK_STACK} : la fonction n’a plus aucun droit — tout retirer n’est pas restreindre`);
    }

    const arrays = (name: string) => [...code.matchAll(new RegExp(`\\b${name}\\s*:\\s*\\[([^\\]]*)\\]`, 'g'))].map((m) => m[1]);
    for (const list of arrays('actions')) {
      for (const action of literalItems(list)) {
        if (action === '*' || /:\*$/.test(action)) {
          bad.push(`${CDK_STACK} : l’action « ${action} » couvre tout un service`);
        }
      }
    }
    for (const list of arrays('resources')) {
      if (literalItems(list).includes('*')) {
        bad.push(`${CDK_STACK} : une politique porte sur resources: ['*']`);
      }
    }
    if (/\.grantFullAccess\s*\(/.test(code)) {
      bad.push(`${CDK_STACK} : grantFullAccess accorde toutes les actions de la table, administration comprise`);
    }

    return join(bad);
  },

  'cdk-nag-disabled': () => {
    const raw = text(CDK_APP);
    if (raw === null) return `${CDK_APP} est absent : l’analyse de conformité se rebranche, l’application ne se supprime pas`;
    const code = jsCode(raw);
    const bad: string[] = [];

    if (!/new\s+App\s*\(/.test(code) || !/\.synth\s*\(\s*\)/.test(code)) {
      bad.push(`${CDK_APP} : l’application CDK n’y est plus construite`);
    }
    if (!/new\s+\w*Stack\s*\(/.test(code)) bad.push(`${CDK_APP} : plus aucune pile n’y est instanciée`);

    const wired = /Aspects\s*\.\s*of\s*\([^)]*\)\s*\.\s*add\s*\(\s*new\s+(?:AwsSolutions|HIPAASecurity|NIST\w*|PCIDSS\w*)Checks/.test(code);
    if (!wired) {
      bad.push(`${CDK_APP} : l’analyse de conformité n’est branchée sur aucun aspect de l’application`);
    }

    for (const m of code.matchAll(/\breason\s*:\s*(['"`])((?:\\.|(?!\1)[\s\S])*?)\1/g)) {
      const reason = m[2].replace(/\s+/g, ' ').trim();
      if (reason.length < 40) {
        bad.push(`${CDK_APP} : une suppression a un motif vide ou trop court (« ${reason} »)`);
      } else if (!/\b[A-Z]{2,10}-\d+\b|#\d+/.test(reason)) {
        bad.push(`${CDK_APP} : un motif de suppression ne référence aucun ticket (« ${reason.slice(0, 48)}… »)`);
      }
    }

    return join(bad);
  },

  'cdk-bootstrap': () => {
    const config = json<{ app?: unknown; context?: Record<string, unknown> }>(CDK_JSON);
    if (!config) return `${CDK_JSON} est absent ou mal formé : le qualificatif se change, le fichier ne se supprime pas`;
    const bad: string[] = [];

    if (typeof config.app !== 'string' || config.app.trim() === '') {
      bad.push(`${CDK_JSON} ne déclare plus d’application (clé « app »)`);
    }

    const qualifier = config.context?.['@aws-cdk/core:bootstrapQualifier'];
    if (typeof qualifier !== 'string' || qualifier.trim() === '') {
      bad.push(`${CDK_JSON} ne définit aucun qualificatif de bootstrap`);
    } else if (qualifier === 'hnb659fds') {
      bad.push(`${CDK_JSON} garde le qualificatif par défaut « hnb659fds » : les noms des ressources de bootstrap sont devinables à l’échelle de tout le cloud`);
    } else if (!/^[A-Za-z0-9]{1,10}$/.test(qualifier)) {
      bad.push(`${CDK_JSON} : le qualificatif « ${qualifier} » n’est pas accepté par le CDK (10 caractères alphanumériques au plus)`);
    }

    const raw = text(CDK_BOOTSTRAP);
    if (raw === null) {
      bad.push(`${CDK_BOOTSTRAP} est absent : le rôle de publication d’artefacts doit rester décrit pour être conditionné`);
      return join(bad);
    }
    const role = yamlSection(yamlCode(raw), 'FilePublishingRole');
    if (!role) {
      bad.push(`${CDK_BOOTSTRAP} ne décrit plus FilePublishingRole`);
    } else if (!/aws:ResourceAccount|aws:PrincipalAccount|aws:PrincipalOrgID/.test(role)) {
      bad.push(`${CDK_BOOTSTRAP} : le rôle de publication d’artefacts n’a aucune condition sur le compte propriétaire (aws:ResourceAccount)`);
    }

    return join(bad);
  },
};

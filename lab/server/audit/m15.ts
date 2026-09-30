// Vérifications des challenges M15 · IAM AWS.
//
// Aucun compte AWS n'est requis : les politiques du dossier `novafact/infra/`
// sont du JSON, et c'est dans le JSON que le défaut est introduit comme
// corrigé. Ce que le lab ne peut pas faire — exécuter l'escalade — reste chez
// CloudGoat et IAM Vulnerable.
//
// Chaque vérification renvoie `null` quand le défaut a disparu, ou la raison
// qui reste — formulée pour l'apprenant, avec le fichier et l'instruction
// fautive.
//
// Deux règles de conception tiennent ce fichier :
//
//   1. On vérifie la **propriété**, jamais la forme exacte du correctif.
//      Plusieurs manières de corriger doivent passer (restreindre `iam:PassRole`
//      *ou* retirer l'action ; corriger l'opérateur d'ensemble *ou* ajouter le
//      refus qui traite la clé absente), et une reformulation qui ne corrige
//      rien doit échouer.
//
//   2. **Un JSON illisible ne vaut pas un JSON corrigé.** Un document qu'on ne
//      sait plus analyser ne contient aucun motif fautif : sans garde-fou, il
//      passerait au vert par accident. Toute vérification commence donc par
//      exiger que ses fichiers se lisent.

import { text } from './repo.ts';
import type { Check } from './m14.ts';

/** Le compte AWS de Novafact dans la fixture. */
const ACCOUNT = '123456789012';

/** Les documents de politique que le module met en jeu. */
const IAM_FILES = [
  'infra/iam/task-role.json',
  'infra/iam/users.json',
  'infra/iam/deploy-role.json',
  'infra/iam/app-policy.json',
  'infra/iam/github-oidc.json',
  'infra/iam/partner-role.json',
  'infra/iam/scp.json',
  'infra/iam/invoices-bucket-policy.json',
  'infra/iam/kms-key-policy.json',
];

const TASK_ROLE = 'infra/iam/task-role.json';
const USERS = 'infra/iam/users.json';
const DEPLOY_ROLE = 'infra/iam/deploy-role.json';
const APP_POLICY = 'infra/iam/app-policy.json';
const SCP = 'infra/iam/scp.json';
const BUCKET = 'infra/iam/invoices-bucket-policy.json';
const KMS = 'infra/iam/kms-key-policy.json';
const TASK_DEF = 'infra/ecs/task-definition.json';

// ── Lecture ─────────────────────────────────────────────────────────────────

type JsonObject = Record<string, unknown>;
type Parsed = { ok: true; value: unknown } | { ok: false; error: string };

/** Lit un document JSON de la fixture, en distinguant absent et illisible. */
function parse(file: string): Parsed {
  const raw = text(file);
  if (raw === null) return { ok: false, error: `${file} est absent de la fixture` };
  try {
    return { ok: true, value: JSON.parse(raw) as unknown };
  } catch (err) {
    const why = (err as Error).message.split('\n')[0];
    return {
      ok: false,
      error: `${file} n’est plus du JSON valide (${why}) — un document illisible n’est pas un document corrigé`,
    };
  }
}

interface Stmt {
  Sid?: unknown;
  Effect?: unknown;
  Action?: unknown;
  NotAction?: unknown;
  Resource?: unknown;
  NotResource?: unknown;
  Principal?: unknown;
  Condition?: unknown;
}

interface PolicyDoc {
  /** Le fichier d'où vient le document. */
  file: string;
  /** Le rôle, la politique, le bucket ou la clé qui le porte. */
  label: string;
  /** Vrai pour une politique d'approbation (`AssumeRolePolicyDocument`). */
  trust: boolean;
  statements: Stmt[];
}

/**
 * Ramasse tous les documents de politique d'un fichier, où qu'ils soient
 * imbriqués : un fichier décrit un rôle, une liste de rôles, un bucket ou une
 * clé, et la vérification ne doit pas dépendre de cette mise en page.
 */
function walk(file: string, value: unknown, label: string, trust: boolean, out: PolicyDoc[]): void {
  if (Array.isArray(value)) {
    for (const v of value) walk(file, v, label, trust, out);
    return;
  }
  if (!value || typeof value !== 'object') return;
  const obj = value as JsonObject;
  const title = ['RoleName', 'PolicyName', 'Bucket', 'KeyAlias', 'UserName']
    .map((k) => obj[k])
    .find((v) => typeof v === 'string') as string | undefined;
  const here = title ?? label;
  if (obj.Statement !== undefined) {
    const raw = obj.Statement;
    const list = (Array.isArray(raw) ? raw : [raw]).filter(
      (s): s is Stmt => !!s && typeof s === 'object' && !Array.isArray(s),
    );
    out.push({ file, label: here, trust, statements: list });
  }
  for (const [k, v] of Object.entries(obj)) {
    if (k === 'Statement') continue;
    walk(file, v, here, trust || k === 'AssumeRolePolicyDocument', out);
  }
}

function docsOf(files: string[]): { docs: PolicyDoc[]; errors: string[] } {
  const docs: PolicyDoc[] = [];
  const errors: string[] = [];
  for (const f of files) {
    const p = parse(f);
    if (!p.ok) {
      errors.push(p.error);
      continue;
    }
    walk(f, p.value, f, false, docs);
  }
  return { docs, errors };
}

// ── Lecture d'une instruction ───────────────────────────────────────────────

const strs = (v: unknown): string[] =>
  (Array.isArray(v) ? v : v === undefined || v === null ? [] : [v]).map(String);

const lower = (xs: string[]) => xs.map((x) => x.toLowerCase());

const isAllow = (s: Stmt) => String(s.Effect ?? '').toLowerCase() === 'allow';
const isDeny = (s: Stmt) => String(s.Effect ?? '').toLowerCase() === 'deny';

/** L'action est-elle couverte, joker compris (`*`, `iam:*`) ? */
const covers = (granted: string[], name: string): boolean => {
  const n = name.toLowerCase();
  const svc = n.split(':')[0];
  return lower(granted).some((a) => a === '*' || a === n || a === `${svc}:*`);
};

/** L'action est-elle nommée, elle ou le joker de son service — mais pas `*` ? */
const namesAction = (granted: string[], name: string): boolean => {
  const n = name.toLowerCase();
  const svc = n.split(':')[0];
  return lower(granted).some((a) => a === n || a === `${svc}:*`);
};

interface Cond {
  op: string;
  key: string;
  values: string[];
}

function conds(s: Stmt): Cond[] {
  const c = s.Condition;
  if (!c || typeof c !== 'object' || Array.isArray(c)) return [];
  const out: Cond[] = [];
  for (const [op, body] of Object.entries(c as JsonObject)) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) continue;
    for (const [key, raw] of Object.entries(body as JsonObject)) {
      out.push({ op, key, values: strs(raw) });
    }
  }
  return out;
}

/** Les clés de condition sont insensibles à la casse côté AWS. */
const condKey = (s: Stmt, ...keys: string[]) =>
  conds(s).filter((c) => keys.some((k) => c.key.toLowerCase() === k.toLowerCase()));
const hasCondKey = (s: Stmt, ...keys: string[]) => condKey(s, ...keys).length > 0;

const principalOf = (s: Stmt, type: 'AWS' | 'Federated' | 'Service'): string[] => {
  const p = s.Principal;
  if (!p || typeof p !== 'object' || Array.isArray(p)) return [];
  return strs((p as JsonObject)[type]);
};

const isWildcardPrincipal = (s: Stmt): boolean =>
  s.Principal === '*' || principalOf(s, 'AWS').includes('*');

const accountOf = (arn: string): string => arn.match(/^arn:aws[^:]*:iam::(\d+):/)?.[1] ?? arn;

/** L'étiquette qui situe une instruction dans le message d'erreur. */
const at = (doc: PolicyDoc, s: Stmt): string => {
  const sid = typeof s.Sid === 'string' ? s.Sid : '';
  const parts = [doc.label === doc.file ? '' : doc.label, sid].filter(Boolean);
  return parts.length ? `${doc.file} (${parts.join(' / ')})` : doc.file;
};

// ── Motifs partagés ─────────────────────────────────────────────────────────

/**
 * Les opérateurs qui comparent au pied de la lettre. Un joker sous l'un d'eux
 * est pris pour le caractère `*` : la condition ne correspond jamais.
 */
const EXACT_OPS = /^(ForAllValues:|ForAnyValue:)?(String(Not)?Equals(IgnoreCase)?|Arn(Not)?Equals)(IfExists)?$/i;

/**
 * Les actions IAM qui permettent à un principal de se réécrire ses propres
 * droits. Aucune n'a sa place dans un périmètre applicatif.
 */
const ESCALATION = [
  'iam:CreatePolicyVersion',
  'iam:SetDefaultPolicyVersion',
  'iam:AttachUserPolicy',
  'iam:AttachGroupPolicy',
  'iam:AttachRolePolicy',
  'iam:PutUserPolicy',
  'iam:PutGroupPolicy',
  'iam:PutRolePolicy',
  'iam:CreateAccessKey',
  'iam:CreateLoginProfile',
  'iam:UpdateLoginProfile',
  'iam:UpdateAssumeRolePolicy',
  'iam:AddUserToGroup',
  'iam:CreateRole',
  'iam:CreateUser',
  'iam:PassRole',
  'iam:DeleteRolePermissionsBoundary',
  'iam:DeleteUserPermissionsBoundary',
  'iam:CreateServiceSpecificCredential',
  'iam:ResetServiceSpecificCredential',
];

/** Les actions qui créent une identité, ou qui lui donnent des droits. */
const CREATE_IDENTITY = ['iam:CreateRole', 'iam:CreateUser'];
const EMPOWER = ['iam:AttachRolePolicy', 'iam:PutRolePolicy', 'iam:AttachUserPolicy', 'iam:PutUserPolicy'];

/** Les rares clés de condition réellement multi-valuées. */
const MULTI_VALUED = new Set(['aws:tagkeys', 'aws:calledvia', 'aws:calledviafirst', 'aws:calledvialast']);

/** Les clés de condition qui bornent réellement l'appelant d'une politique de ressource. */
const CALLER_CONDS = [
  'aws:SourceArn',
  'aws:SourceAccount',
  'aws:PrincipalOrgID',
  'aws:PrincipalArn',
  'aws:PrincipalAccount',
  'aws:SourceVpce',
  'aws:SourceVpc',
];

const KMS_ADMIN = /^kms:(Create|Put|Schedule|Cancel|Disable|Enable|Delete|Update|Replicate|Revoke|Import|Connect|Disconnect|Tag|Untag|Rotate)/i;
const KMS_USE = /^kms:(Encrypt|Decrypt|ReEncrypt|GenerateData|GenerateRandom|Sign|Verify|GenerateMac|VerifyMac)/i;

const OIDC_SUB = /:sub$/i;
const OIDC_AUD = /:aud$/i;

/** Une instruction d'approbation qui accepte un jeton OIDC. */
const isWebIdentity = (s: Stmt) =>
  covers(strs(s.Action), 'sts:AssumeRoleWithWebIdentity') ||
  principalOf(s, 'Federated').some((p) => /oidc-provider/.test(p));

// ── Vérifications ───────────────────────────────────────────────────────────

export const m15Checks: Record<string, Check> = {
  // ── Moindre privilège ─────────────────────────────────────────────────────

  'iam-wildcard': () => {
    const { docs, errors } = docsOf([TASK_ROLE]);
    if (errors.length) return errors.join(' · ');
    const policies = docs.filter((d) => !d.trust);
    if (!policies.length) return `${TASK_ROLE} ne contient plus aucune politique d’autorisation`;

    const bad: string[] = [];
    for (const doc of policies) {
      for (const s of doc.statements) {
        if (!isAllow(s)) continue;
        if (s.NotAction !== undefined) {
          bad.push(`${at(doc, s)} autorise par « NotAction » : tout ce qui n’est pas listé reste permis`);
        }
        for (const a of strs(s.Action)) {
          if (a === '*') bad.push(`${at(doc, s)} autorise l’action « * »`);
          else if (/^[A-Za-z0-9_-]+:\*$/.test(a)) {
            bad.push(`${at(doc, s)} autorise « ${a} », soit tout le service`);
          }
        }
        // Une ressource en joker reste acceptable si une condition la borne :
        // c'est une des deux manières correctes de corriger.
        if (strs(s.Resource).includes('*') && conds(s).length === 0) {
          bad.push(`${at(doc, s)} s’applique à « Resource: * » sans aucune condition qui la borne`);
        }
      }
    }
    return bad.length ? bad.join(' · ') : null;
  },

  'iam-no-users': () => {
    const p = parse(USERS);
    if (!p.ok) return p.error;
    const root = (p.value ?? {}) as { Users?: unknown };
    const users = Array.isArray(root.Users) ? (root.Users as JsonObject[]) : [];

    const bad: string[] = [];
    for (const u of users) {
      const name = typeof u.UserName === 'string' ? u.UserName : '(utilisateur sans nom)';
      const keys = Array.isArray(u.AccessKeys) ? u.AccessKeys : [];
      // Une clé inactive se réactive en un appel : elle compte comme permanente.
      if (keys.length) {
        bad.push(`${USERS} : l’utilisateur ${name} porte encore ${keys.length} clé(s) d’accès permanente(s)`);
      }
      if (u.ConsoleAccess === true) {
        bad.push(`${USERS} : l’utilisateur ${name} garde un mot de passe de console — les humains passent par Identity Center`);
      }
    }

    // Le critère inverse : vider la liste sans rien mettre à la place couperait
    // l'intégration continue. On exige donc qu'un chemin par assomption de rôle
    // ait remplacé les clés supprimées.
    const { docs, errors } = docsOf([USERS]);
    if (errors.length) return errors.join(' · ');
    const assumable = docs
      .filter((d) => d.trust)
      .some((d) =>
        d.statements.some(
          (s) => isAllow(s) && (principalOf(s, 'Federated').length > 0 || principalOf(s, 'Service').length > 0),
        ),
      );
    if (!assumable) {
      bad.push(
        `${USERS} : aucun rôle assumable par une identité fédérée ou par un service ne remplace ces clés — l’intégration continue n’aurait plus de chemin d’accès`,
      );
    }
    return bad.length ? bad.join(' · ') : null;
  },

  'iam-stringequals-wildcard': () => {
    const { docs, errors } = docsOf(IAM_FILES);
    if (errors.length) return errors.join(' · ');
    const bad: string[] = [];
    for (const doc of docs) {
      for (const s of doc.statements) {
        for (const c of conds(s)) {
          if (!EXACT_OPS.test(c.op)) continue;
          for (const v of c.values) {
            if (/[*?]/.test(v)) {
              bad.push(
                `${at(doc, s)} : « ${c.op} » compare ${c.key} à « ${v} » — le joker est pris au pied de la lettre, la condition ne correspond jamais`,
              );
            }
          }
        }
      }
    }
    return bad.length ? bad.join(' · ') : null;
  },

  // ── Escalade ──────────────────────────────────────────────────────────────

  'iam-passrole': () => {
    const { docs, errors } = docsOf(IAM_FILES);
    if (errors.length) return errors.join(' · ');
    const bad: string[] = [];
    for (const doc of docs.filter((d) => !d.trust)) {
      for (const s of doc.statements) {
        if (!isAllow(s) || !namesAction(strs(s.Action), 'iam:PassRole')) continue;
        const resources = strs(s.Resource);
        if (resources.includes('*') || resources.some((r) => /:role\/\*$/.test(r))) {
          bad.push(
            `${at(doc, s)} autorise iam:PassRole sur toutes les ressources : n’importe quel rôle du compte peut être passé au service qu’on crée`,
          );
        }
        if (!hasCondKey(s, 'iam:PassedToService')) {
          bad.push(
            `${at(doc, s)} autorise iam:PassRole sans condition iam:PassedToService : rien ne borne le service destinataire`,
          );
        }
      }
    }
    return bad.length ? bad.join(' · ') : null;
  },

  'iam-create-policy-version': () => {
    // Le périmètre applicatif : la politique du rôle applicatif, et le rôle de
    // la tâche lui-même.
    const { docs, errors } = docsOf([APP_POLICY, TASK_ROLE]);
    if (errors.length) return errors.join(' · ');
    const bad: string[] = [];
    for (const doc of docs.filter((d) => !d.trust)) {
      for (const s of doc.statements) {
        if (!isAllow(s)) continue;
        const granted = strs(s.Action);
        const hit = ESCALATION.filter((a) => covers(granted, a));
        if (!hit.length) continue;
        const joker = lower(granted).find((a) => a === '*' || a === 'iam:*');
        bad.push(
          joker
            ? `${at(doc, s)} autorise « ${joker} », qui couvre les actions d’escalade IAM (${hit.slice(0, 3).join(', ')}…)`
            : `${at(doc, s)} autorise ${hit.join(', ')} : le rôle applicatif peut se réécrire ses propres droits`,
        );
      }
    }
    return bad.length ? bad.join(' · ') : null;
  },

  'permission-boundary': () => {
    const { docs, errors } = docsOf([DEPLOY_ROLE]);
    if (errors.length) return errors.join(' · ');
    const bad: string[] = [];
    for (const doc of docs.filter((d) => !d.trust)) {
      for (const s of doc.statements) {
        if (!isAllow(s)) continue;
        const acts = strs(s.Action);
        const hit = [...CREATE_IDENTITY, ...EMPOWER].filter((a) => covers(acts, a));
        if (!hit.length) continue;
        const boundary = condKey(s, 'iam:PermissionsBoundary');
        if (!boundary.length) {
          bad.push(
            `${at(doc, s)} autorise ${hit.join(', ')} sans condition iam:PermissionsBoundary : la CI peut créer une identité plus puissante qu’elle`,
          );
          continue;
        }
        if (boundary.some((c) => c.values.some((v) => v.trim() === '' || v === '*'))) {
          bad.push(
            `${at(doc, s)} impose une limite de permission qui n’en est pas une (« ${boundary.flatMap((c) => c.values).join(', ')} »)`,
          );
        }
      }
    }
    return bad.length ? bad.join(' · ') : null;
  },

  // ── Politiques d'approbation ──────────────────────────────────────────────

  'iam-oidc-trust': () => {
    const { docs, errors } = docsOf(IAM_FILES);
    if (errors.length) return errors.join(' · ');
    const bad: string[] = [];
    for (const doc of docs.filter((d) => d.trust)) {
      for (const s of doc.statements) {
        if (!isAllow(s) || !isWebIdentity(s)) continue;
        const cs = conds(s);
        const sub = cs.filter((c) => OIDC_SUB.test(c.key));
        const aud = cs.filter((c) => OIDC_AUD.test(c.key));
        if (!sub.length) {
          bad.push(
            `${at(doc, s)} fait confiance au fournisseur OIDC sans condition sur le sujet : n’importe quel dépôt GitHub du monde peut prendre ce rôle`,
          );
        }
        if (!aud.length) {
          bad.push(`${at(doc, s)} ne vérifie pas l’audience du jeton (clé « …:aud »)`);
        }
        for (const c of aud) {
          if (c.values.some((v) => v.includes('*'))) {
            bad.push(`${at(doc, s)} accepte n’importe quelle audience (« ${c.values.join(', ')} »)`);
          }
        }
      }
    }
    return bad.length ? bad.join(' · ') : null;
  },

  'iam-oidc-org-wildcard': () => {
    const { docs, errors } = docsOf(IAM_FILES);
    if (errors.length) return errors.join(' · ');
    const bad: string[] = [];
    for (const doc of docs.filter((d) => d.trust)) {
      for (const s of doc.statements) {
        if (!isAllow(s) || !isWebIdentity(s)) continue;
        const subs = conds(s).filter((c) => OIDC_SUB.test(c.key));
        if (!subs.length) {
          bad.push(`${at(doc, s)} n’a aucune condition sur le sujet : le dépôt n’est pas filtré du tout`);
          continue;
        }
        for (const c of subs) {
          for (const v of c.values) {
            const parts = v.split(':');
            if (parts[0] !== 'repo' || parts.length < 3) {
              bad.push(
                `${at(doc, s)} : le sujet « ${v} » ne nomme pas « repo:<org>/<dépôt>:<référence ou environnement> »`,
              );
              continue;
            }
            if (/[*?]/.test(parts[1])) {
              bad.push(
                `${at(doc, s)} : le sujet « ${v} » accepte tous les dépôts de l’organisation — un prototype obtiendrait ce rôle`,
              );
            }
            const tail = parts.slice(2).join(':');
            if (tail === '' || /[*?]/.test(tail)) {
              bad.push(`${at(doc, s)} : le sujet « ${v} » ne fige ni la référence ni l’environnement`);
            }
          }
        }
      }
    }
    return bad.length ? bad.join(' · ') : null;
  },

  'iam-external-id': () => {
    const { docs, errors } = docsOf(IAM_FILES);
    if (errors.length) return errors.join(' · ');
    const bad: string[] = [];
    for (const doc of docs.filter((d) => d.trust)) {
      for (const s of doc.statements) {
        if (!isAllow(s)) continue;
        if (isWildcardPrincipal(s)) {
          bad.push(`${at(doc, s)} fait confiance à « * » : n’importe quel compte AWS peut assumer ce rôle`);
          continue;
        }
        const foreign = principalOf(s, 'AWS').filter((prn) => accountOf(prn) !== ACCOUNT);
        if (!foreign.length) continue;
        // Deux corrections acceptables : l'identifiant externe convenu avec le
        // tiers, ou la condition d'organisation quand il est dans la nôtre.
        if (!hasCondKey(s, 'sts:ExternalId', 'aws:PrincipalOrgID')) {
          bad.push(
            `${at(doc, s)} fait confiance au compte ${[...new Set(foreign.map(accountOf))].join(', ')} sans condition sts:ExternalId ni aws:PrincipalOrgID`,
          );
        }
        for (const c of condKey(s, 'sts:ExternalId')) {
          if (c.values.some((v) => v.trim() === '' || /[*?]/.test(v))) {
            bad.push(`${at(doc, s)} : l’identifiant externe « ${c.values.join(', ')} » n’en est pas un`);
          }
        }
      }
    }
    return bad.length ? bad.join(' · ') : null;
  },

  // ── Opérateurs mal employés ───────────────────────────────────────────────

  'iam-not-action': () => {
    const { docs, errors } = docsOf([SCP]);
    if (errors.length) return errors.join(' · ');
    const bad: string[] = [];
    let explicit = 0;
    for (const doc of docs) {
      for (const s of doc.statements) {
        const neg = [
          s.NotAction !== undefined ? 'NotAction' : '',
          s.NotResource !== undefined ? 'NotResource' : '',
        ].filter(Boolean);
        // Une négation reste défendable quand une condition la borne — le
        // verrou de région en est le cas canonique. Seule celle qui ne dépend
        // de rien est refusée.
        if (neg.length && conds(s).length === 0) {
          bad.push(
            `${at(doc, s)} refuse par « ${neg.join(' » et « ')} » sans aucune condition : la politique se lit à l’envers et ne refuse rien d’utile`,
          );
        }
        if (isDeny(s) && s.NotAction === undefined) {
          const named = strs(s.Action).filter((a) => !a.includes('*'));
          if (named.length >= 2) explicit += 1;
        }
      }
    }
    // Le critère inverse : supprimer l'instruction n'est pas la réécrire.
    if (!explicit) {
      bad.push(
        `${SCP} : aucun refus n’énumère explicitement au moins deux actions sensibles — le garde-fou a disparu au lieu d’être réécrit`,
      );
    }
    return bad.length ? bad.join(' · ') : null;
  },

  'iam-forallvalues': () => {
    const { docs, errors } = docsOf(IAM_FILES);
    if (errors.length) return errors.join(' · ');
    const bad: string[] = [];
    for (const doc of docs) {
      const denies = doc.statements.filter(isDeny);
      for (const s of doc.statements) {
        for (const c of conds(s)) {
          if (!/^ForAllValues:/i.test(c.op)) continue;
          if (MULTI_VALUED.has(c.key.toLowerCase())) continue;
          const key = c.key.toLowerCase();
          const nullOn = (t: Stmt, want: string) =>
            conds(t).some((n) => /^Null$/i.test(n.op) && n.key.toLowerCase() === key && n.values.includes(want));
          // Deux corrections acceptables : retirer l'opérateur d'ensemble, ou
          // le garder en traitant explicitement l'absence de la clé.
          if (nullOn(s, 'false') || denies.some((d) => nullOn(d, 'true'))) continue;
          bad.push(
            `${at(doc, s)} : « ${c.op} » sur ${c.key}, une clé mono-valuée — quand la clé est absente l’opérateur renvoie vrai et l’appelant anonyme passe`,
          );
        }
      }
    }
    return bad.length ? bad.join(' · ') : null;
  },

  // ── Politiques de ressource ───────────────────────────────────────────────

  's3-bucket-policy-public': () => {
    const { docs, errors } = docsOf([BUCKET]);
    if (errors.length) return errors.join(' · ');
    const bad: string[] = [];
    for (const doc of docs) {
      for (const s of doc.statements) {
        if (!isAllow(s) || !isWildcardPrincipal(s)) continue;
        if (!hasCondKey(s, ...CALLER_CONDS)) {
          bad.push(
            `${at(doc, s)} accorde ${strs(s.Action).join(', ')} au principal « * » sans aucune condition sur l’appelant : le bucket est publié`,
          );
        }
        if (covers(strs(s.Action), 's3:ListBucket')) {
          bad.push(
            `${at(doc, s)} laisse lister le bucket à un principal universel : c’est ce qui transforme une fuite en inventaire`,
          );
        }
      }
    }
    return bad.length ? bad.join(' · ') : null;
  },

  'kms-key-policy': () => {
    const { docs, errors } = docsOf([KMS]);
    if (errors.length) return errors.join(' · ');
    const bad: string[] = [];
    for (const doc of docs) {
      for (const s of doc.statements) {
        if (!isAllow(s)) continue;
        const acts = strs(s.Action);
        if (isWildcardPrincipal(s)) {
          // Un principal universel reste acceptable s'il est borné au service
          // appelant ET au compte — c'est le motif documenté par AWS.
          const guarded =
            hasCondKey(s, 'kms:ViaService') &&
            hasCondKey(s, 'kms:CallerAccount', 'aws:PrincipalOrgID', 'aws:PrincipalAccount');
          if (!guarded) {
            bad.push(
              `${at(doc, s)} accorde ${acts.join(', ')} au principal « * » : le chiffrement au repos ne protège plus personne`,
            );
          }
        }
        const aws = principalOf(s, 'AWS');
        // L'instruction du compte racine est le pivot IAM voulu par AWS : sans
        // elle, la clé n'est plus administrable.
        if (aws.length > 0 && aws.every((prn) => prn === `arn:aws:iam::${ACCOUNT}:root`)) continue;
        const joker = lower(acts).find((a) => a === '*' || a === 'kms:*');
        if (joker) {
          bad.push(`${at(doc, s)} accorde « ${joker} » : l’administration de la clé et son usage sont mélangés`);
          continue;
        }
        const admin = acts.filter((a) => KMS_ADMIN.test(a));
        const use = acts.filter((a) => KMS_USE.test(a));
        if (admin.length && use.length) {
          bad.push(
            `${at(doc, s)} donne au même principal l’administration de la clé (${admin[0]}) et son usage (${use[0]})`,
          );
        }
      }
    }
    return bad.length ? bad.join(' · ') : null;
  },

  // ── Plateforme ────────────────────────────────────────────────────────────

  'ecs-task-vs-execution': () => {
    const p = parse(TASK_DEF);
    if (!p.ok) return p.error;
    const td = (p.value ?? {}) as JsonObject;
    const bad: string[] = [];

    const task = typeof td.taskRoleArn === 'string' ? td.taskRoleArn : '';
    const exec = typeof td.executionRoleArn === 'string' ? td.executionRoleArn : '';
    if (!task || !exec) {
      bad.push(`${TASK_DEF} ne déclare pas les deux rôles (taskRoleArn et executionRoleArn)`);
    } else if (task === exec) {
      bad.push(
        `${TASK_DEF} : taskRoleArn et executionRoleArn désignent le même rôle (${task.split('/').pop()}) — le code applicatif hérite des droits de la plateforme`,
      );
    }

    const containers = Array.isArray(td.containerDefinitions) ? (td.containerDefinitions as JsonObject[]) : [];
    if (!containers.length) bad.push(`${TASK_DEF} ne déclare aucun conteneur`);
    for (const c of containers) {
      const name = typeof c.name === 'string' ? c.name : '(conteneur sans nom)';
      for (const sec of Array.isArray(c.secrets) ? (c.secrets as JsonObject[]) : []) {
        const from = typeof sec.valueFrom === 'string' ? sec.valueFrom : '';
        if (from === '' || from.includes('*')) {
          bad.push(
            `${TASK_DEF} : le conteneur ${name} lit ${String(sec.name ?? '?')} depuis « ${from} » — le joker ouvre tous les secrets du compte`,
          );
        }
      }
    }
    return bad.length ? bad.join(' · ') : null;
  },

  // ── Périmètre de données ──────────────────────────────────────────────────

  'data-perimeter': () => {
    const { docs, errors } = docsOf([SCP]);
    if (errors.length) return errors.join(' · ');
    const denies = docs.flatMap((doc) => doc.statements.filter(isDeny).map((s) => ({ doc, s })));
    const bad: string[] = [];

    const identity = denies.find(({ s }) => hasCondKey(s, 'aws:PrincipalOrgID', 'aws:PrincipalOrgPaths'));
    const resource = denies.find(({ s }) =>
      hasCondKey(s, 'aws:ResourceOrgID', 'aws:ResourceOrgPaths', 'aws:ResourceAccount'),
    );
    const network = denies.find(({ s }) => hasCondKey(s, 'aws:SourceVpce', 'aws:SourceVpc', 'aws:SourceIp'));

    if (!identity) bad.push(`${SCP} : le périmètre d’identité manque — aucun refus ne conditionne aws:PrincipalOrgID`);
    if (!resource) bad.push(`${SCP} : le périmètre de ressource manque — aucun refus ne conditionne aws:ResourceOrgID`);
    if (!network) {
      bad.push(
        `${SCP} : le périmètre réseau manque — aucun refus ne conditionne aws:SourceVpce, aws:SourceVpc ou aws:SourceIp`,
      );
    } else if (!hasCondKey(network.s, 'aws:ViaAWSService', 'aws:PrincipalIsAWSService')) {
      // Le critère inverse : un périmètre qui casse la production est un
      // périmètre qu'on retire au premier incident.
      bad.push(
        `${at(network.doc, network.s)} : le périmètre réseau n’exempte pas les appels faits par les services AWS eux-mêmes (aws:ViaAWSService / aws:PrincipalIsAWSService) — il casserait la production`,
      );
    }
    return bad.length ? bad.join(' · ') : null;
  },
};

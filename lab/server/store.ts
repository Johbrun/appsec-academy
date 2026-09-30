// Données du lab : tout en mémoire, fictif, remis à zéro au redémarrage.
// Aucune base externe à installer — le lab doit démarrer en une commande.

import { exercises } from '../shared/exercises.ts';

export interface User {
  id: string;
  email: string;
  password: string;
  name: string;
  tenantId: string;
  role: 'user' | 'accountant' | 'admin';
  mfa: boolean;
}

export interface InvoiceLine {
  label: string;
  qty: number;
  unitPrice: number; // en euros, en flottant : c'est le défaut de money-float
}

export interface Invoice {
  id: string;
  tenantId: string;
  ref: string;
  client: string;
  status: 'draft' | 'sent' | 'paid' | 'void';
  lines: InvoiceLine[];
  total: number;
  note: string;
  attachment?: string;
  /** Identifiant du client facturé — cible de bola-nested. */
  clientId?: string;
  /** Drapeaux du règlement, écrits par deux routes distinctes : race-multi-endpoint. */
  paid?: boolean;
  refunded?: boolean;
}

export interface CreditNote {
  id: string;
  tenantId: string;
  balance: number;
}

/** Fiche client. La relation jointe par l'ORM du lab (orm-leak, bola-nested). */
export interface Client {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  siret: string;
  /** Champ qu'aucune projection publique ne contient. */
  iban: string;
}

/** Gabarit d'e-mail éditable par le tenant : ssti-email-template. */
export interface EmailTemplate {
  id: string;
  tenantId: string;
  name: string;
  subject: string;
  body: string;
}

/** Avoir en cours d'émission — le flux en trois étapes de multistep-authz. */
export interface CreditDraft {
  id: string;
  tenantId: string;
  amount: number;
  /** Renseigné seulement par l'étape qui vérifie le rôle comptable. */
  approvedBy: string | null;
  issued: boolean;
}

/** Pièce jointe téléversée, stockée en mémoire (rien n'atterrit sur le disque). */
export interface Upload {
  id: string;
  tenantId: string;
  name: string;
  /** Type annoncé par le client, jamais déduit du contenu : upload-pipeline. */
  contentType: string;
  content: string;
  /** Rendue téléchargeable avant la fin de la validation : toctou-upload. */
  published: boolean;
  verdict: 'pending' | 'accepted' | 'rejected';
  /** Vrai dès qu'elle a été servie au moins une fois. */
  served: boolean;
}

/** Un envoi sortant, pour mesurer le quota que personne n'applique (send-quota). */
export interface SendRecord {
  at: number;
  tenantId: string;
  actor: string;
  to: string;
}

/** Entrée du cache « CDN » du lab, devant les réponses authentifiées. */
export interface CacheEntry {
  body: unknown;
  at: number;
  /** Le tenant pour lequel la réponse a été calculée. */
  forTenant: string;
}

export interface Mail {
  id: string;
  to: string;
  subject: string;
  body: string;
  at: string;
  via: string;
}

export interface Tenant {
  id: string;
  name: string;
  settings: Record<string, unknown>;
}

export interface AuditEntry {
  at: string;
  actor: string;
  action: string;
  detail: string;
}

interface State {
  users: User[];
  tenants: Tenant[];
  invoices: Invoice[];
  credits: CreditNote[];
  mails: Mail[];
  audit: AuditEntry[];
  solved: Map<string, { at: string; flag: string }>;
  loginAttempts: number;
  // ── Ajouts des challenges de facturation et de données ────────────────────
  clients: Client[];
  templates: EmailTemplate[];
  drafts: CreditDraft[];
  uploads: Upload[];
  sends: SendRecord[];
  /** Réglages de la plateforme, qui ne regardent aucun tenant : dual-use-endpoint. */
  platform: Record<string, unknown>;
  /** Caches partagés du lab. Vidés par /api/lab/reset, puisqu'ils vivent ici. */
  caches: {
    invoiceList: CacheEntry | null;
    pdf: Map<string, CacheEntry>;
  };
}

export const flagFor = (id: string) => `NOVAFACT{${id.replace(/-/g, '_')}}`;

function seed(): State {
  return {
    tenants: [
      { id: 'acme', name: 'ACME SARL', settings: { analyticsUrl: '', theme: 'light' } },
      { id: 'globex', name: 'Globex SA', settings: { analyticsUrl: '', theme: 'dark' } },
    ],
    users: [
      // Ton compte de départ.
      { id: 'u1', email: 'dev@acme.example', password: 'dev', name: 'Toi', tenantId: 'acme', role: 'user', mfa: false },
      // Mot de passe présent dans la wordlist du lab : cible de no-rate-limit.
      { id: 'u2', email: 'compta@globex.example', password: 'printemps2024', name: 'Comptabilité Globex', tenantId: 'globex', role: 'accountant', mfa: false },
      // Mot de passe hors de portée : la seule voie est l'injection NoSQL.
      { id: 'u3', email: 'admin@novafact.example', password: 'Zt7!q4vR-x2Lm9_pB0wK', name: 'Admin Novafact', tenantId: 'acme', role: 'admin', mfa: true },
    ],
    invoices: [
      {
        id: 'INV-1001', tenantId: 'acme', ref: 'INV-1001', client: 'Dupont & Fils', status: 'sent',
        lines: [{ label: 'Abonnement Novafact', qty: 1, unitPrice: 490 }], total: 490,
        note: 'Merci de régler sous 30 jours.',
      },
      {
        id: 'INV-1002', tenantId: 'acme', ref: 'INV-1002', client: 'Martin SAS', status: 'paid',
        lines: [{ label: 'Prestation de conseil', qty: 3, unitPrice: 800 }], total: 2400,
        note: 'Réglée par virement.',
      },
      // La facture du voisin : cible de bola-invoice.
      {
        id: 'INV-1003', tenantId: 'globex', ref: 'INV-1003', client: 'Ministère (marché public)', status: 'sent',
        lines: [{ label: 'Licence entreprise', qty: 40, unitPrice: 1250 }], total: 50000,
        note: 'Confidentiel Globex — conditions négociées, ne pas diffuser.',
        attachment: 'contrat-globex.txt',
      },
      // Une seconde facture Globex, pour que le cloisonnement reste observable
      // même après qu'un exercice a fait disparaître la première.
      {
        id: 'INV-2001', tenantId: 'globex', ref: 'INV-2001', client: 'Sogexpo', status: 'draft',
        lines: [{ label: 'Maintenance annuelle', qty: 12, unitPrice: 310 }], total: 3720,
        note: 'Confidentiel Globex.',
      },
    ],
    credits: [
      { id: 'CN-500', tenantId: 'acme', balance: 100 },
    ],
    clients: [
      { id: 'CLI-1', tenantId: 'acme', name: 'Dupont & Fils', email: 'compta@dupont.example', siret: '81234567800017', iban: 'FR7630001007941234567890185' },
      { id: 'CLI-2', tenantId: 'acme', name: 'Martin SAS', email: 'factures@martin.example', siret: '49876543200025', iban: 'FR7630004000031234567890143' },
      // Le client du voisin : cible de bola-nested.
      { id: 'CLI-9', tenantId: 'globex', name: 'Ministère (marché public)', email: 'marches@ministere.example', siret: '11000201100044', iban: 'FR7610071750000000100047T65' },
    ],
    templates: [
      {
        id: 'TPL-1', tenantId: 'acme', name: 'Relance à J+30',
        subject: 'Facture {{ref}} — relance',
        body: 'Bonjour {{client}},\n\nLa facture {{ref}} de {{total}} € reste impayée.\n\nCordialement,\nNovafact',
      },
    ],
    drafts: [],
    uploads: [],
    sends: [],
    platform: {
      maintenanceMode: false,
      signupOpen: true,
      globalRateLimitPerMinute: 120,
      supportEmail: 'support@novafact.example',
    },
    caches: { invoiceList: null, pdf: new Map() },
    mails: [],
    audit: [
      { at: new Date().toISOString(), actor: 'system', action: 'boot', detail: 'Lab démarré, données réinitialisées.' },
    ],
    solved: new Map(),
    loginAttempts: 0,
  };
}

export let db: State = seed();

export function resetAll(): void {
  db = seed();
}

export function resetData(): void {
  const solved = db.solved;
  db = seed();
  db.solved = solved;
}

// ── Drapeaux ────────────────────────────────────────────────────────────────

/**
 * Appelé par le serveur au point exact où l'invariant de sécurité est rompu.
 * Jamais sur déclaration de l'apprenant : c'est ce qui rend la résolution
 * vérifiable, et c'est aussi ce que les tests de `npm run verify` inversent.
 */
export function solve(id: string): string {
  const flag = flagFor(id);
  if (!db.solved.has(id)) {
    db.solved.set(id, { at: new Date().toISOString(), flag });
    const ex = exercises.find((e) => e.id === id);
    console.log(`\x1b[32m  ✓ exercice résolu : ${id} — ${ex?.title ?? ''}\x1b[0m`);
    audit('lab', 'exercice.résolu', id);
  }
  return flag;
}

export const isSolved = (id: string) => db.solved.has(id);

export function audit(actor: string, action: string, detail: string): void {
  db.audit.unshift({ at: new Date().toISOString(), actor, action, detail });
  db.audit = db.audit.slice(0, 200);
}

export function sendMail(to: string, subject: string, body: string, via: string): Mail {
  const mail: Mail = { id: `m${db.mails.length + 1}`, to, subject, body, at: new Date().toISOString(), via };
  db.mails.unshift(mail);
  return mail;
}

// ── Mini-moteur de requêtes façon Mongo ─────────────────────────────────────
//
// Reproduit fidèlement les opérateurs qui rendent l'injection NoSQL possible.
// C'est volontairement permissif : le défaut de l'exercice nosql-auth n'est pas
// ici, il est dans la route qui passe req.body directement à cette fonction.

type Query = Record<string, unknown>;

function matchValue(actual: unknown, expected: unknown): boolean {
  if (expected !== null && typeof expected === 'object' && !Array.isArray(expected)) {
    const ops = expected as Record<string, unknown>;
    return Object.entries(ops).every(([op, arg]) => {
      switch (op) {
        case '$ne': return actual !== arg;
        case '$eq': return actual === arg;
        case '$gt': return (actual as number) > (arg as number);
        case '$gte': return (actual as number) >= (arg as number);
        case '$lt': return (actual as number) < (arg as number);
        case '$lte': return (actual as number) <= (arg as number);
        case '$in': return Array.isArray(arg) && arg.includes(actual);
        case '$nin': return Array.isArray(arg) && !arg.includes(actual);
        case '$regex': return new RegExp(String(arg)).test(String(actual));
        case '$exists': return (actual !== undefined) === Boolean(arg);
        default: return false;
      }
    });
  }
  return actual === expected;
}

export function find<T extends Record<string, unknown>>(collection: T[], query: Query): T[] {
  return collection.filter((doc) => Object.entries(query).every(([k, v]) => matchValue(doc[k], v)));
}

export function findOne<T extends Record<string, unknown>>(collection: T[], query: Query): T | undefined {
  return find(collection, query)[0];
}

// SSO entreprise en SAML 2.0 : l'IdP du client et le point d'assertion (ACS)
// de Novafact. Tout est local et inerte — aucun IdP réel n'est contacté.
//
// L'IdP modélisé est celui d'ACME : il possède l'annuaire `acme.example` et ne
// signe d'assertion que pour SES adresses. Un attaquant qui a un compte chez
// ACME obtient donc une assertion parfaitement signée… pour lui-même.
//
// Exercice porté par ce fichier :
//   · saml-wrapping   la signature est valide, mais elle ne couvre pas le nœud
//                     que le traitement finit par lire
//
// Note d'implémentation : la signature est ici DÉTACHÉE (le bloc <ds:Signature>
// est frère de l'assertion, pas enveloppé dedans) et le MAC remplace RSA. La
// canonicalisation est réduite à la suppression des blancs entre balises. Rien
// de tout cela ne change le mécanisme de l'attaque ni son correctif : ce qui
// compte est qu'on vérifie un nœud désigné par `Reference URI`, et qu'on en
// lise un autre.

import crypto from 'node:crypto';
import { Router } from 'express';
import { audit, db, solve } from '../store.ts';
import { sign } from '../lib/jwt.ts';

export const samlRoutes = Router();

const IDP_ENTITY = 'https://sso.acme.example/idp';
const SP_ENTITY = 'https://novafact.example/sp';
/** Tient lieu de clé privée de l'IdP. */
const IDP_KEY = 'acme-idp-signing-key';
/** Le seul annuaire que cet IdP possède. */
const IDP_DOMAIN = 'acme.example';

/** Assertions signées par l'IdP depuis le dernier démarrage. */
const issued = new Map<string, string>();

export const resetSamlState = (): void => {
  issued.clear();
};

// ── Outils XML (volontairement rudimentaires) ───────────────────────────────

/** Canonicalisation de pauvre : on enlève les blancs entre balises. */
const c14n = (xml: string) => xml.replace(/>\s+</g, '><').trim();

const sha256 = (s: string) => crypto.createHash('sha256').update(s, 'utf8').digest('base64');
const mac = (s: string) => crypto.createHmac('sha256', IDP_KEY).update(s, 'utf8').digest('base64');

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const escapeXml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const ASSERTION_RE = /<saml:Assertion\b[^>]*>[\s\S]*?<\/saml:Assertion>/g;
const ID_RE = /\bID="([^"]+)"/;

/** L'assertion dont l'attribut ID vaut `id`, telle qu'elle apparaît dans le document. */
function assertionById(xml: string, id: string): string | null {
  const re = new RegExp(
    `<saml:Assertion\\b[^>]*\\bID="${escapeRe(id)}"[^>]*>[\\s\\S]*?<\\/saml:Assertion>`,
  );
  return re.exec(xml)?.[0] ?? null;
}

// ── L'IdP du client ─────────────────────────────────────────────────────────

samlRoutes.get('/metadata', (_req, res) => {
  res.json({
    sp: SP_ENTITY,
    acs: 'http://127.0.0.1:4317/api/saml/acs',
    idp: IDP_ENTITY,
    idpDomain: IDP_DOMAIN,
    signatureAlgorithm: 'hmac-sha256 (lab)',
    assertionsSigned: issued.size,
  });
});

/**
 * L'IdP signe une assertion pour une adresse de son annuaire.
 *
 * Ce n'est pas un défaut : un IdP ne signe que pour le domaine qu'il possède,
 * et celui-ci refuse tout le reste. C'est bien pour cela que l'attaque consiste
 * à PARTIR d'une assertion légitime.
 */
samlRoutes.post('/idp/assert', (req, res) => {
  const { email } = req.body ?? {};
  if (typeof email !== 'string' || !email.toLowerCase().endsWith(`@${IDP_DOMAIN}`)) {
    res.status(403).json({ error: `cet IdP ne signe que pour @${IDP_DOMAIN}` });
    return;
  }

  const id = `_${crypto.randomBytes(8).toString('hex')}`;
  const now = new Date();
  const assertion = [
    `<saml:Assertion ID="${id}" IssueInstant="${now.toISOString()}" Version="2.0">`,
    `<saml:Issuer>${IDP_ENTITY}</saml:Issuer>`,
    `<saml:Subject><saml:NameID Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress">${escapeXml(email.toLowerCase())}</saml:NameID></saml:Subject>`,
    `<saml:Conditions NotOnOrAfter="${new Date(now.getTime() + 600_000).toISOString()}"><saml:AudienceRestriction><saml:Audience>${SP_ENTITY}</saml:Audience></saml:AudienceRestriction></saml:Conditions>`,
    `</saml:Assertion>`,
  ].join('');

  const digest = sha256(c14n(assertion));
  const signedInfo =
    `<ds:SignedInfo>` +
    `<ds:CanonicalizationMethod Algorithm="lab:c14n"/>` +
    `<ds:SignatureMethod Algorithm="lab:hmac-sha256"/>` +
    `<ds:Reference URI="#${id}"><ds:DigestMethod Algorithm="lab:sha256"/><ds:DigestValue>${digest}</ds:DigestValue></ds:Reference>` +
    `</ds:SignedInfo>`;
  const signature = `<ds:Signature>${signedInfo}<ds:SignatureValue>${mac(c14n(signedInfo))}</ds:SignatureValue></ds:Signature>`;

  const xml =
    `<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ` +
    `xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ` +
    `xmlns:ds="http://www.w3.org/2000/09/xmldsig#" Destination="${SP_ENTITY}">` +
    `${assertion}${signature}` +
    `</samlp:Response>`;

  issued.set(id, email.toLowerCase());
  res.status(201).json({
    id,
    xml,
    SAMLResponse: Buffer.from(xml, 'utf8').toString('base64'),
  });
});

// ── Le point d'assertion de Novafact ────────────────────────────────────────

interface Verdict {
  valid: boolean;
  /** L'ID du nœud que la signature couvre réellement. */
  signedId: string | null;
  reason?: string;
}

/**
 * Vérifie la signature du document.
 *
 * Cette partie-là est correcte : la référence est suivie, le condensat du nœud
 * désigné est recalculé, et le MAC du bloc `SignedInfo` est comparé. Un
 * document dont on aurait touché l'assertion signée est refusé.
 *
 * Tout le problème est dans ce que l'APPELANT fait ensuite.
 */
function verifySignature(xml: string): Verdict {
  const sigBlock = /<ds:Signature\b[\s\S]*?<\/ds:Signature>/.exec(xml)?.[0];
  if (!sigBlock) return { valid: false, signedId: null, reason: 'document non signé' };

  const signedInfo = /<ds:SignedInfo\b[\s\S]*?<\/ds:SignedInfo>/.exec(sigBlock)?.[0];
  const signatureValue = /<ds:SignatureValue>([^<]*)<\/ds:SignatureValue>/.exec(sigBlock)?.[1];
  if (!signedInfo || !signatureValue) {
    return { valid: false, signedId: null, reason: 'bloc de signature incomplet' };
  }
  if (mac(c14n(signedInfo)) !== signatureValue) {
    return { valid: false, signedId: null, reason: 'signature invalide' };
  }

  const refId = /<ds:Reference\s+URI="#([^"]+)"/.exec(signedInfo)?.[1];
  const digestValue = /<ds:DigestValue>([^<]*)<\/ds:DigestValue>/.exec(signedInfo)?.[1];
  if (!refId || !digestValue) {
    return { valid: false, signedId: null, reason: 'référence absente' };
  }

  const referenced = assertionById(xml, refId);
  if (!referenced) return { valid: false, signedId: null, reason: 'nœud référencé introuvable' };
  if (sha256(c14n(referenced)) !== digestValue) {
    return { valid: false, signedId: null, reason: 'condensat du nœud signé incorrect' };
  }
  return { valid: true, signedId: refId };
}

samlRoutes.post('/acs', (req, res) => {
  const encoded = req.body?.SAMLResponse;
  if (typeof encoded !== 'string') {
    res.status(400).json({ error: 'SAMLResponse requis (base64)' });
    return;
  }
  let xml: string;
  try {
    xml = Buffer.from(encoded, 'base64').toString('utf8');
  } catch {
    res.status(400).json({ error: 'SAMLResponse illisible' });
    return;
  }

  const verdict = verifySignature(xml);
  if (!verdict.valid) {
    res.status(401).json({ error: `assertion refusée : ${verdict.reason}` });
    return;
  }

  /**
   * VULNÉRABLE (saml-wrapping) : la signature vient d'être vérifiée, et le
   * traitement repart du DOCUMENT pour y chercher le premier `NameID` venu —
   * pas du nœud que la signature couvre. Il suffit donc d'ajouter une seconde
   * assertion, non signée, avant celle qui l'est : la vérification passe, et
   * c'est l'autre qui est lue.
   *
   * Correctif attendu : ne plus jamais relire le document. Le nœud validé est
   * celui que `Reference URI` désigne, et c'est de CE nœud — et d'aucun autre —
   * qu'on extrait le sujet, l'émetteur et les conditions. Refuser tout document
   * qui porte plusieurs assertions ou plusieurs éléments de même ID, exiger un
   * schéma strict, et s'appuyer sur une bibliothèque à jour plutôt que sur du
   * XPath maison. C'est la famille SAMLStorm et *The Fragile Lock*.
   */
  const nameIdMatch = /<saml:NameID\b[^>]*>([^<]*)<\/saml:NameID>/.exec(xml);
  const nameIdNode = nameIdMatch?.[0];
  const nameId = nameIdMatch?.[1]?.trim().toLowerCase();
  if (!nameId || !nameIdNode) {
    res.status(400).json({ error: 'aucun NameID dans l’assertion' });
    return;
  }

  // Quelle assertion porte réellement ce NameID ?
  const consumed = [...xml.matchAll(ASSERTION_RE)].find((m) => m[0].includes(nameIdNode));
  const consumedId = consumed ? ID_RE.exec(consumed[0])?.[1] ?? null : null;

  // Le lab constate l'enveloppement : le nœud lu n'est pas le nœud signé.
  if (consumedId !== verdict.signedId) {
    audit(
      nameId,
      'invariant.rompu',
      `signature valide sur ${verdict.signedId}, sujet lu dans ${consumedId ?? 'un nœud sans ID'}`,
    );
    solve('saml-wrapping');
  }

  const account = db.users.find((u) => u.email === nameId);
  if (!account) {
    res.status(404).json({ error: 'aucun compte Novafact pour ce sujet' });
    return;
  }

  audit(account.email, 'auth.sso', `assertion ${verdict.signedId} de ${IDP_ENTITY}`);
  res.json({
    token: sign({ sub: account.email, role: account.role, tenantId: account.tenantId }),
    user: {
      email: account.email,
      name: account.name,
      role: account.role,
      tenantId: account.tenantId,
    },
    signedAssertion: verdict.signedId,
    consumedAssertion: consumedId,
  });
});

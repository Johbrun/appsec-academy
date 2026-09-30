// CORRIGÉ de server/routes/saml.ts.
//
// Couvre saml-wrapping. Le correctif tient en une phrase : ce qu'on LIT est ce
// qui a été SIGNÉ, et rien d'autre. La fonction de vérification ne renvoie plus
// un verdict, elle renvoie LE NŒUD — le reste du traitement n'a plus accès au
// document.

import crypto from 'node:crypto';
import { Router } from 'express';
import { audit, db } from '../store.ts';
import { sign } from '../lib/jwt.ts';

export const samlRoutes = Router();

const IDP_ENTITY = 'https://sso.acme.example/idp';
const SP_ENTITY = 'https://novafact.example/sp';
const IDP_KEY = 'acme-idp-signing-key';
const IDP_DOMAIN = 'acme.example';

const issued = new Map<string, string>();

export const resetSamlState = (): void => {
  issued.clear();
};

const c14n = (xml: string) => xml.replace(/>\s+</g, '><').trim();
const sha256 = (s: string) => crypto.createHash('sha256').update(s, 'utf8').digest('base64');
const mac = (s: string) => crypto.createHmac('sha256', IDP_KEY).update(s, 'utf8').digest('base64');

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const escapeXml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const ASSERTION_RE = /<saml:Assertion\b[^>]*>[\s\S]*?<\/saml:Assertion>/g;
const ID_RE = /\bID="([^"]+)"/;

function assertionById(xml: string, id: string): string | null {
  const re = new RegExp(
    `<saml:Assertion\\b[^>]*\\bID="${escapeRe(id)}"[^>]*>[\\s\\S]*?<\\/saml:Assertion>`,
  );
  return re.exec(xml)?.[0] ?? null;
}

// ── L'IdP du client (inchangé) ──────────────────────────────────────────────

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
  res.status(201).json({ id, xml, SAMLResponse: Buffer.from(xml, 'utf8').toString('base64') });
});

// ── Le point d'assertion de Novafact ────────────────────────────────────────

/**
 * CORRIGÉ (saml-wrapping) : la vérification renvoie le NŒUD validé, pas un
 * booléen. L'appelant n'a donc plus de raison — ni de moyen — de retourner
 * chercher quoi que ce soit dans le document.
 *
 * Elle refuse en plus tout document qui porte plus d'une assertion ou plus
 * d'une signature : c'est la contre-mesure structurelle des attaques par
 * enveloppement, et elle ne coûte rien à une intégration légitime.
 */
function verifiedAssertion(xml: string): { node: string; id: string } | null {
  const assertions = [...xml.matchAll(ASSERTION_RE)];
  if (assertions.length !== 1) return null;
  if ((xml.match(/<ds:Signature\b/g) ?? []).length !== 1) return null;

  const sigBlock = /<ds:Signature\b[\s\S]*?<\/ds:Signature>/.exec(xml)?.[0];
  if (!sigBlock) return null;
  const signedInfo = /<ds:SignedInfo\b[\s\S]*?<\/ds:SignedInfo>/.exec(sigBlock)?.[0];
  const signatureValue = /<ds:SignatureValue>([^<]*)<\/ds:SignatureValue>/.exec(sigBlock)?.[1];
  if (!signedInfo || !signatureValue) return null;

  const expected = Buffer.from(mac(c14n(signedInfo)), 'utf8');
  const given = Buffer.from(signatureValue, 'utf8');
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;

  const refId = /<ds:Reference\s+URI="#([^"]+)"/.exec(signedInfo)?.[1];
  const digestValue = /<ds:DigestValue>([^<]*)<\/ds:DigestValue>/.exec(signedInfo)?.[1];
  if (!refId || !digestValue) return null;

  const node = assertionById(xml, refId);
  if (!node) return null;
  if (sha256(c14n(node)) !== digestValue) return null;
  // Le nœud signé doit être l'unique assertion du document.
  if (node !== assertions[0][0]) return null;
  if (ID_RE.exec(node)?.[1] !== refId) return null;

  return { node, id: refId };
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

  const verified = verifiedAssertion(xml);
  if (!verified) {
    res.status(401).json({ error: 'assertion refusée : signature absente, invalide, ou document ambigu' });
    return;
  }

  // Le sujet est extrait DU NŒUD SIGNÉ. `xml` n'est plus consulté.
  const nameId = /<saml:NameID\b[^>]*>([^<]*)<\/saml:NameID>/.exec(verified.node)?.[1]?.trim().toLowerCase();
  const issuer = /<saml:Issuer>([^<]*)<\/saml:Issuer>/.exec(verified.node)?.[1];
  const notOnOrAfter = /NotOnOrAfter="([^"]+)"/.exec(verified.node)?.[1];
  const audience = /<saml:Audience>([^<]*)<\/saml:Audience>/.exec(verified.node)?.[1];

  if (!nameId || issuer !== IDP_ENTITY || audience !== SP_ENTITY) {
    res.status(401).json({ error: 'assertion refusée : émetteur ou audience inattendus' });
    return;
  }
  if (!notOnOrAfter || Date.parse(notOnOrAfter) < Date.now()) {
    res.status(401).json({ error: 'assertion expirée' });
    return;
  }

  const account = db.users.find((u) => u.email === nameId);
  if (!account) {
    res.status(404).json({ error: 'aucun compte Novafact pour ce sujet' });
    return;
  }

  audit(account.email, 'auth.sso', `assertion ${verified.id} de ${IDP_ENTITY}`);
  res.json({
    token: sign({ sub: account.email, role: account.role, tenantId: account.tenantId }),
    user: {
      email: account.email,
      name: account.name,
      role: account.role,
      tenantId: account.tenantId,
    },
    signedAssertion: verified.id,
    consumedAssertion: verified.id,
  });
});

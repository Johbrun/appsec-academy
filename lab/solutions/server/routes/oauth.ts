// CORRIGÉ de server/routes/oauth.ts.
//
// Couvre oauth-redirect, oauth-state et oauth-email-unverified.

import crypto from 'node:crypto';
import { Router } from 'express';
import { audit, db } from '../store.ts';
import { sign } from '../lib/jwt.ts';

export const oauthRoutes = Router();

const IDP_ISS = 'https://globex-id.example';
const IDP_KEY = 'idp-lab-signing-key';

const CLIENTS: Record<string, { redirectUri: string; secret: string }> = {
  'novafact-web': {
    redirectUri: 'http://127.0.0.1:5199/oauth/callback',
    secret: 'novafact-web-secret',
  },
};

interface IdpIdentity {
  sub: string;
  email: string;
  emailVerified: boolean;
}

interface AuthCode {
  clientId: string;
  redirectUri: string;
  identity: IdpIdentity;
  used: boolean;
}

const idpSessions = new Map<string, IdpIdentity>();
const codes = new Map<string, AuthCode>();
const links = new Map<string, string>();

/**
 * CORRIGÉ (oauth-state) : chaque flux est ouvert avec un `state` aléatoire lié
 * CÔTÉ SERVEUR à la session qui l'ouvre. C'est cette table qui fait la preuve
 * d'origine ; le paramètre n'est que son ticket.
 */
const pending = new Map<string, { session: string | null; at: number }>();
const STATE_TTL_MS = 10 * 60_000;

export const resetOauthState = (): void => {
  idpSessions.clear();
  codes.clear();
  links.clear();
  pending.clear();
};

// ── Le fournisseur ──────────────────────────────────────────────────────────

const b64url = (s: string | Buffer) => Buffer.from(s).toString('base64url');

function issueIdToken(identity: IdpIdentity, aud: string): string {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const payload = b64url(
    JSON.stringify({
      iss: IDP_ISS,
      sub: identity.sub,
      aud,
      email: identity.email,
      email_verified: identity.emailVerified,
      iat: now,
      exp: now + 600,
    }),
  );
  const mac = crypto.createHmac('sha256', IDP_KEY).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${mac}`;
}

oauthRoutes.post('/idp/register', (req, res) => {
  const { sub, email, email_verified } = req.body ?? {};
  if (typeof sub !== 'string' || typeof email !== 'string' || !sub || !email) {
    res.status(400).json({ error: 'sub et email requis' });
    return;
  }
  const session = crypto.randomBytes(12).toString('hex');
  idpSessions.set(session, { sub, email, emailVerified: email_verified === true });
  res.status(201).json({
    idp_session: session,
    iss: IDP_ISS,
    sub,
    email,
    email_verified: email_verified === true,
  });
});

oauthRoutes.get('/authorize', (req, res) => {
  const clientId = String(req.query.client_id ?? '');
  const redirectUri = String(req.query.redirect_uri ?? '');
  const idpSession = String(req.query.idp_session ?? '');
  const state = String(req.query.state ?? '');

  const client = CLIENTS[clientId];
  if (!client) {
    res.status(400).json({ error: 'client_id inconnu' });
    return;
  }
  if (String(req.query.response_type ?? 'code') !== 'code') {
    res.status(400).json({ error: 'seul response_type=code est supporté' });
    return;
  }

  // CORRIGÉ (oauth-redirect) : comparaison EXACTE, chaîne par chaîne. Pas de
  // préfixe, pas de joker, pas de normalisation charitable. Les paramètres du
  // retour sont ajoutés par le serveur, jamais fournis par l'appelant.
  if (redirectUri !== client.redirectUri) {
    res.status(400).json({ error: 'redirect_uri non enregistrée' });
    return;
  }

  // CORRIGÉ (oauth-state) : `state` n'est plus facultatif.
  if (!state) {
    res.status(400).json({ error: 'state requis' });
    return;
  }

  const identity = idpSessions.get(idpSession);
  if (!identity) {
    res.status(401).json({ error: 'aucune session chez le fournisseur : passe par /idp/register' });
    return;
  }

  const code = crypto.randomBytes(16).toString('hex');
  codes.set(code, { clientId, redirectUri, identity, used: false });

  const url = new URL(client.redirectUri);
  url.searchParams.set('code', code);
  url.searchParams.set('state', state);
  res.redirect(302, url.toString());
});

function exchange(code: string, clientId: string, secret: string) {
  const entry = codes.get(code);
  if (!entry || entry.used) return null;
  const client = CLIENTS[clientId];
  if (!client || client.secret !== secret || entry.clientId !== clientId) return null;
  entry.used = true;
  return entry;
}

oauthRoutes.post('/token', (req, res) => {
  const { code, client_id, client_secret } = req.body ?? {};
  const entry =
    typeof code === 'string' && typeof client_id === 'string' && typeof client_secret === 'string'
      ? exchange(code, client_id, client_secret)
      : null;
  if (!entry) {
    res.status(400).json({ error: 'invalid_grant' });
    return;
  }
  res.json({
    token_type: 'Bearer',
    access_token: crypto.randomBytes(16).toString('hex'),
    id_token: issueIdToken(entry.identity, entry.clientId),
    expires_in: 600,
  });
});

// ── Le client ───────────────────────────────────────────────────────────────

oauthRoutes.get('/start', (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  pending.set(state, { session: req.user?.email ?? null, at: Date.now() });

  const authorize = new URL('http://127.0.0.1:4317/api/oauth/authorize');
  authorize.searchParams.set('client_id', 'novafact-web');
  authorize.searchParams.set('redirect_uri', CLIENTS['novafact-web'].redirectUri);
  authorize.searchParams.set('response_type', 'code');
  authorize.searchParams.set('state', state);
  if (typeof req.query.idp_session === 'string') {
    authorize.searchParams.set('idp_session', req.query.idp_session);
  }
  res.json({ authorize: authorize.toString(), state });
});

oauthRoutes.get('/callback', (req, res) => {
  const state = String(req.query.state ?? '');
  const flow = pending.get(state);
  pending.delete(state);

  // CORRIGÉ (oauth-state) : le `state` reçu doit exister, ne pas avoir expiré,
  // et désigner LA session qui a ouvert le flux. Un code obtenu ailleurs ne
  // peut donc plus être consommé ici.
  const caller = req.user?.email ?? null;
  if (!flow || Date.now() - flow.at > STATE_TTL_MS || flow.session !== caller) {
    res.status(403).json({ error: 'state absent, expiré ou étranger à cette session' });
    return;
  }

  const entry = exchange(String(req.query.code ?? ''), 'novafact-web', CLIENTS['novafact-web'].secret);
  if (!entry) {
    res.status(400).json({ error: 'code d’autorisation invalide ou déjà consommé' });
    return;
  }
  const { identity } = entry;
  const subject = `${IDP_ISS}|${identity.sub}`;

  // ── Mode rattachement ───────────────────────────────────────────────────
  if (req.user) {
    // CORRIGÉ (oauth-email-unverified) : la liaison exige `email_verified`, et
    // elle est décidée par le TITULAIRE du compte local — c'est lui qui est
    // authentifié ici. On ne lie jamais sur un attribut que le porteur choisit.
    if (!identity.emailVerified) {
      res.status(403).json({ error: 'le fournisseur n’a pas vérifié cette adresse' });
      return;
    }
    links.set(req.user.email, subject);
    res.json({ linked: true, account: req.user.email, subject });
    return;
  }

  // ── Mode connexion ──────────────────────────────────────────────────────
  //
  // CORRIGÉ (oauth-email-unverified) : la clé de rapprochement est `iss` + `sub`,
  // immuable et attribuée par le fournisseur. Le claim `email` ne sert plus à
  // retrouver un compte : il est choisi par le porteur, donc il ne prouve rien.
  // Sans liaison préalable, on ne connecte personne.
  const byLink = [...links.entries()].find(([, s]) => s === subject)?.[0];
  const account = byLink ? db.users.find((u) => u.email === byLink) : undefined;
  if (!account) {
    res.status(404).json({ error: 'aucune identité fédérée rattachée à un compte Novafact' });
    return;
  }

  audit(account.email, 'auth.fédérée', `via ${IDP_ISS} sub=${identity.sub}`);
  res.json({
    token: sign({ sub: account.email, role: account.role, tenantId: account.tenantId }),
    user: {
      email: account.email,
      name: account.name,
      role: account.role,
      tenantId: account.tenantId,
    },
    subject,
  });
});

// Connexion fédérée : un serveur d'autorisation minimal, et le client qui
// s'en sert. Tout est local et inerte — aucun appel réseau ne sort d'ici.
//
// Deux moitiés cohabitent volontairement dans ce fichier, parce que les
// attaques OAuth vivent à la jointure :
//
//   · le FOURNISSEUR  (/idp/register, /authorize, /token) : « Globex ID », un
//     annuaire que l'attaquant peut provisionner lui-même — exactement la
//     prémisse de nOAuth (Descope, 2023) ;
//   · le CLIENT       (/start, /callback) : Novafact, qui démarre le flux et
//     rapproche l'identité fédérée d'un compte local.
//
// Exercices portés par ce fichier :
//   · oauth-redirect         redirect_uri validée par préfixe
//   · oauth-state            flux sans `state`, donc sans origine prouvée
//   · oauth-email-unverified rapprochement sur un e-mail non vérifié

import crypto from 'node:crypto';
import { Router } from 'express';
import { audit, db, solve } from '../store.ts';
import { sign } from '../lib/jwt.ts';

export const oauthRoutes = Router();

const IDP_ISS = 'https://globex-id.example';
const IDP_KEY = 'idp-lab-signing-key';

/** Clients enregistrés auprès du fournisseur. */
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
  /**
   * Session Novafact présente au moment où le code a été émis.
   *
   * Instrumentation du lab : c'est précisément ce que `state` aurait lié, et
   * que le flux ci-dessous ne lie pas.
   */
  issuedInSession: string | null;
  used: boolean;
}

const idpSessions = new Map<string, IdpIdentity>();
const codes = new Map<string, AuthCode>();
/** Identités fédérées rattachées à un compte local : email → « iss|sub ». */
const links = new Map<string, string>();

export const resetOauthState = (): void => {
  idpSessions.clear();
  codes.clear();
  links.clear();
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
  const mac = crypto
    .createHmac('sha256', IDP_KEY)
    .update(`${header}.${payload}`)
    .digest('base64url');
  return `${header}.${payload}.${mac}`;
}

/**
 * Provisionne une identité chez le fournisseur.
 *
 * Ce n'est pas un défaut : c'est la RÉALITÉ du modèle fédéré. N'importe qui
 * peut créer un tenant chez un fournisseur OIDC et y déclarer l'adresse qu'il
 * veut. Le défaut est plus bas, dans ce que le client fait de cette adresse.
 */
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

/**
 * Point d'autorisation du fournisseur.
 *
 * VULNÉRABLE (oauth-redirect) : `redirect_uri` est acceptée dès qu'elle
 * COMMENCE par l'URI enregistrée. Une URI enregistrée
 * `http://127.0.0.1:5199/oauth/callback` autorise alors
 * `http://127.0.0.1:5199/oauth/callback.attaquant.test/vol`, et le code
 * d'autorisation part chez l'attaquant.
 *
 * Correctif attendu : comparaison EXACTE, chaîne par chaîne — jamais par
 * préfixe, jamais avec des jokers, et les paramètres de requête ajoutés
 * séparément. PKCE limite les dégâts mais ne remplace pas ce contrôle.
 * RFC 9700 §4.1.
 *
 * VULNÉRABLE (oauth-state) : ni `state` ni `nonce` ne sont exigés ni renvoyés.
 * Rien ne lie ce flux à la session qui l'a ouvert.
 */
oauthRoutes.get('/authorize', (req, res) => {
  const clientId = String(req.query.client_id ?? '');
  const redirectUri = String(req.query.redirect_uri ?? '');
  const idpSession = String(req.query.idp_session ?? '');

  const client = CLIENTS[clientId];
  if (!client) {
    res.status(400).json({ error: 'client_id inconnu' });
    return;
  }
  if (String(req.query.response_type ?? 'code') !== 'code') {
    res.status(400).json({ error: 'seul response_type=code est supporté' });
    return;
  }
  if (!redirectUri.startsWith(client.redirectUri)) {
    res.status(400).json({ error: 'redirect_uri non enregistrée' });
    return;
  }

  const identity = idpSessions.get(idpSession);
  if (!identity) {
    res.status(401).json({ error: 'aucune session chez le fournisseur : passe par /idp/register' });
    return;
  }

  const code = crypto.randomBytes(16).toString('hex');
  codes.set(code, {
    clientId,
    redirectUri,
    identity,
    issuedInSession: req.user?.email ?? null,
    used: false,
  });

  // Le lab constate le détournement : le code part vers une destination qui
  // n'est pas l'URI enregistrée du client.
  if (redirectUri !== client.redirectUri) {
    audit(identity.email, 'invariant.rompu', `code d’autorisation redirigé vers ${redirectUri}`);
    solve('oauth-redirect');
  }

  const sep = redirectUri.includes('?') ? '&' : '?';
  // `state` n'est pas renvoyé : il n'a jamais été demandé.
  res.redirect(302, `${redirectUri}${sep}code=${code}`);
});

/** Échange du code contre les jetons. Canal arrière, client confidentiel. */
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

/**
 * Démarre la connexion fédérée.
 *
 * VULNÉRABLE (oauth-state) : aucun `state` n'est tiré, donc aucun ne sera
 * vérifié au retour. Le flux ne prouve rien sur l'origine de la requête qui le
 * termine : n'importe quel code, obtenu par n'importe qui, sera accepté dans
 * n'importe quelle session.
 *
 * Correctif attendu : `state` aléatoire, lié à la session côté serveur, envoyé
 * au fournisseur et comparé au retour — et `nonce` pour l'ID token. Ce ne sont
 * pas des options du flux : sans eux, le flux ne prouve rien.
 */
oauthRoutes.get('/start', (req, res) => {
  const authorize = new URL('http://127.0.0.1:4317/api/oauth/authorize');
  authorize.searchParams.set('client_id', 'novafact-web');
  authorize.searchParams.set('redirect_uri', CLIENTS['novafact-web'].redirectUri);
  authorize.searchParams.set('response_type', 'code');
  if (typeof req.query.idp_session === 'string') {
    authorize.searchParams.set('idp_session', req.query.idp_session);
  }
  res.json({ authorize: authorize.toString(), state: null });
});

/**
 * Retour du fournisseur : on échange le code et on rapproche l'identité.
 *
 * Deux modes, comme dans toutes les applications qui font du SSO :
 *   · session Novafact présente → on RATTACHE l'identité fédérée au compte ;
 *   · pas de session            → on CONNECTE, en retrouvant le compte local.
 */
oauthRoutes.get('/callback', (req, res) => {
  const code = String(req.query.code ?? '');
  const entry = exchange(code, 'novafact-web', CLIENTS['novafact-web'].secret);
  if (!entry) {
    res.status(400).json({ error: 'code d’autorisation invalide ou déjà consommé' });
    return;
  }
  const { identity } = entry;
  const subject = `${IDP_ISS}|${identity.sub}`;

  // ── Mode rattachement ───────────────────────────────────────────────────
  if (req.user) {
    // Le lab constate le login CSRF : ce code a été émis dans une AUTRE session
    // Novafact que celle qui le consomme. Un `state` lié à la session aurait
    // rendu ce rapprochement impossible — il n'y en a pas.
    if (entry.issuedInSession && entry.issuedInSession !== req.user.email) {
      audit(
        req.user.email,
        'invariant.rompu',
        `identité fédérée de ${entry.issuedInSession} rattachée à ${req.user.email}`,
      );
      solve('oauth-state');
    }
    links.set(req.user.email, subject);
    res.json({ linked: true, account: req.user.email, subject });
    return;
  }

  // ── Mode connexion ──────────────────────────────────────────────────────
  const byLink = [...links.entries()].find(([, s]) => s === subject)?.[0];
  let account = byLink ? db.users.find((u) => u.email === byLink) : undefined;

  if (!account) {
    /**
     * VULNÉRABLE (oauth-email-unverified) : le rapprochement se fait sur le
     * claim `email` du fournisseur, sans regarder `email_verified`. Or l'e-mail
     * est un attribut que le porteur choisit dans SON annuaire : il suffit de
     * déclarer l'adresse d'un administrateur Novafact pour devenir cet
     * administrateur. C'est nOAuth, mot pour mot.
     *
     * Correctif attendu : ne JAMAIS rapprocher deux comptes sur un identifiant
     * que l'utilisateur choisit. La clé de rapprochement est `iss` + `sub`,
     * immuable et attribuée par le fournisseur ; `email_verified` est exigé
     * avant toute liaison, et la liaison est confirmée explicitement par le
     * titulaire du compte local.
     */
    account = db.users.find((u) => u.email === identity.email);
    if (account && !identity.emailVerified) {
      audit(
        account.email,
        'invariant.rompu',
        `compte pris sur un e-mail non vérifié déclaré par ${IDP_ISS}`,
      );
      solve('oauth-email-unverified');
    }
  }

  if (!account) {
    res.status(404).json({ error: 'aucun compte Novafact ne correspond à cette identité' });
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

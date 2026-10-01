// Scénarios du jeu « OAuth Flow Debugger » (M9) : un flux, une étape faible, une attaque, une correction.
//
// La difficulté ne vient pas de la rareté du protocole (DPoP « plus pointu » que
// PKCE) — elle vient de la **distance entre l'indice et la conclusion**, et de la
// présence de correctifs qui ont l'air justes. Trois niveaux, structurels :
//
//   N1 · La faiblesse est une pièce **absente ou visiblement fausse dans une
//        seule étape** — state oublié, secret dans le front, alg=none accepté,
//        jeton dans l'URL. On la voit sans reconstituer le flux, et les mauvais
//        correctifs le sont pour une raison qu'on nomme d'un coup d'œil.
//
//   N2 · Il faut **lire le contexte**. Au moins un correctif marche à moitié
//        (raccourcir la durée de vie, chiffrer un stockage, une bonne pratique
//        posée au mauvais endroit), ou l'étape faible n'est pas la plus
//        alarmante. Le protocole a l'air correct : le défaut est dans un détail.
//
//   N3 · L'attaque n'apparaît qu'en **reliant deux étapes** (mix-up, code
//        injecté malgré le state, assertion vérifiée à un endroit et lue à un
//        autre), le correctif « le plus sûr en apparence » est le piège, ou le
//        défaut est une **absence** répartie sur tout le flux. C'est de la revue
//        d'architecture, pas de la reconnaissance de motif.
//
// Exactitude : chaque attaque correspond à une RFC/BCP (RFC 9700, RFC 9207,
// RFC 8693, RFC 9449, RFC 9126, OIDC Core) ou à un cas SAML documenté. Certains
// scénarios s'inspirent d'incidents publics, cités dans le contexte ou le « why ».

import type { Level } from '../lib/series';
import { defineSeries, type SeriesProfile } from '../lib/series';

export type FlowStep = { from: string; to?: string; msg: string };
export type FlowScenario = {
  id: string;
  level: Level;
  title: string;
  context: string;
  steps: FlowStep[];
  faulty: number[]; // étapes acceptées comme « étape faible » (index)
  attack: string;
  fixes: string[]; // la première est la bonne
  why: string;
  /** Scénarios de structure jumelle, à ne pas mettre dans la même série. */
  avoid?: string[];
};

export const attackNames = [
  'CSRF sur la connexion (injection de session)',
  'Vol du code via la redirection',
  'Interception du code d’autorisation',
  'Confusion de jetons (ID token pris pour un access token)',
  'Confusion d’algorithme JWT',
  'XML Signature Wrapping',
  'Rejeu d’ID token',
  'Attaque mix-up',
  'Vol et réutilisation durable du refresh token',
  'Fuite du jeton par l’URL',
  'Exposition des identifiants au client',
  'Extraction du secret d’un client public',
  'Contournement par algorithme none',
  'Falsification d’un jeton non vérifié',
  'Rejeu d’un jeton expiré',
  'Confusion d’audience',
  'Confusion de client applicatif',
  'Hameçonnage de consentement OAuth',
  'Injection d’assertion non signée',
  'Rejeu d’assertion SAML',
  'Force brute du code utilisateur',
  'Fuite du code par le Referer',
  'Injection de code d’autorisation',
  'SSO SAML forcé (login CSRF)',
  'Élévation par échange de jetons',
  'Rejeu d’un jeton porteur volé',
  'Prise de contrôle via un e-mail non vérifié',
  'Vol de jetons d’une intégration tierce',
  'Hameçonnage du flux d’appareil',
  'Injection de commentaire XML (SAML)',
] as const;

export const flowScenarios: FlowScenario[] = [
  {
    id: 'state',
    level: 1,
    title: 'Se connecter avec Google',
    context: 'Le back-office Next.js (client confidentiel) propose la connexion Google en code flow.',
    steps: [
      { from: 'Navigateur', to: 'Novafact', msg: 'GET /login/google' },
      { from: 'Novafact', to: 'Navigateur', msg: '302 → accounts.google.com/o/oauth2/v2/auth?client_id=nf-web&redirect_uri=https://app.novafact.example/cb&response_type=code&scope=openid email' },
      { from: 'Navigateur', to: 'Google', msg: 'L’utilisateur s’authentifie et consent' },
      { from: 'Google', to: 'Navigateur', msg: '302 → /cb?code=4/0Ab…' },
      { from: 'Novafact', to: 'Google', msg: 'POST /token (code, client_secret) → id_token, access_token' },
      { from: 'Novafact', msg: 'Ouvre une session pour le compte désigné par l’id_token' },
    ],
    faulty: [1, 3],
    attack: 'CSRF sur la connexion (injection de session)',
    fixes: [
      'Un state aléatoire lié à la session, vérifié au retour',
      'Restreindre le scope demandé à openid profile, sans l’adresse électronique',
      'Lier le code d’autorisation à l’adresse IP qui a initié la demande',
      'Exiger une ré-authentification par prompt=login à chaque connexion',
    ],
    why: 'Sans state (ni PKCE) lié à la session, rien ne prouve que la réponse correspond à une demande de ce navigateur : un tiers peut faire aboutir sa propre réponse dans la session de la victime.',
    avoid: ['state-constant'],
  },
  {
    id: 'redirect-prefix',
    level: 3,
    title: 'Novafact, serveur d’autorisation pour ses partenaires',
    context: 'Le partenaire « compta-plus » a enregistré l’URI https://compta-plus.example/oauth/cb. Son site contient aussi une page de redirection générique.',
    steps: [
      { from: 'Navigateur', to: 'AS Novafact', msg: 'GET /authorize?client_id=compta-plus&redirect_uri=https://compta-plus.example/oauth/cb/../redirect?to=…&state=…' },
      { from: 'AS Novafact', msg: 'Vérifie que redirect_uri commence par l’URI enregistrée : accepté' },
      { from: 'AS Novafact', to: 'Navigateur', msg: '302 → la redirect_uri fournie, avec ?code=…' },
      { from: 'compta-plus', to: 'Navigateur', msg: 'La page /redirect renvoie vers l’URL passée en paramètre ; le code voyage avec' },
    ],
    faulty: [1],
    attack: 'Vol du code via la redirection',
    fixes: [
      'Comparer la redirect_uri enregistrée par égalité exacte (RFC 9700)',
      'N’enregistrer que des redirect_uri en HTTPS, sur un domaine que l’on possède',
      'Ramener la durée de vie du code d’autorisation à soixante secondes',
      'Exiger PKCE, pour qu’un code intercepté ne puisse pas être échangé',
    ],
    why: 'Une comparaison par préfixe laisse passer des chemins détournés. Combinée à une redirection ouverte chez le client, elle fait sortir le code. RFC 9700 impose la correspondance exacte.',
  },
  {
    id: 'pkce',
    level: 2,
    title: 'L’application mobile',
    context: 'L’application mobile Novafact est un client public (pas de secret) et utilise un schéma d’URL personnalisé.',
    steps: [
      { from: 'App', to: 'AS', msg: '/authorize?client_id=nf-mobile&redirect_uri=novafact://cb&response_type=code&state=…' },
      { from: 'AS', to: 'App', msg: 'Redirection vers novafact://cb?code=…&state=…' },
      { from: 'App', to: 'AS', msg: 'POST /token (grant_type=authorization_code, code, client_id) → jetons' },
    ],
    faulty: [0, 2],
    attack: 'Interception du code d’autorisation',
    fixes: [
      'PKCE S256 : le serveur vérifie le code_verifier à l’échange',
      'Embarquer un client_secret dans l’application, chiffré au repos',
      'Enregistrer l’URI de redirection comme lien universel vérifié par la plateforme',
      'Réduire la durée de vie du code d’autorisation à trente secondes',
    ],
    why: 'Une autre application peut déclarer le même schéma d’URL et recevoir le code. Sans PKCE, un client public n’a aucun moyen de prouver qu’il est celui qui a démarré le flux.',
    avoid: ['pkce-plain'],
  },
  {
    id: 'id-token',
    level: 2,
    title: 'La SPA appelle l’API',
    context: 'La SPA obtient ses jetons auprès de Cognito et appelle l’API Express.',
    steps: [
      { from: 'SPA', to: 'Cognito', msg: 'Connexion (code + PKCE) → id_token, access_token' },
      { from: 'SPA', to: 'API', msg: 'GET /invoices, Authorization: Bearer <id_token>' },
      { from: 'API', msg: 'Vérifie la signature avec le JWKS du pool et l’expiration, puis lit sub et custom:tenant' },
    ],
    faulty: [1, 2],
    attack: 'Confusion de jetons (ID token pris pour un access token)',
    fixes: [
      'Vérifier token_use (ou typ at+jwt), l’audience et l’émetteur',
      'Exiger que le jeton soit présenté sur un canal lié au client (mTLS ou DPoP)',
      'Réduire la durée de vie de l’id_token à cinq minutes',
      'Transmettre le jeton dans un cookie SameSite=Strict plutôt qu’un en-tête',
    ],
    why: 'Un ID token est destiné au client, pas à l’API. Si l’API accepte tout JWT signé par le pool, un jeton émis pour une autre application ou un autre usage passe.',
    avoid: ['aud-missing', 'cognito-appclient'],
  },
  {
    id: 'alg',
    level: 2,
    title: 'Le service de rapports',
    context: 'Le service interne de rapports vérifie des JWT signés en RS256 par l’API, avec une bibliothèque ancienne.',
    steps: [
      { from: 'API', to: 'Rapports', msg: 'Appel avec un JWT (en-tête alg: RS256, kid: k1)' },
      { from: 'Rapports', msg: 'verify(token, publicKeyPem) sans option algorithms : l’algorithme est lu dans l’en-tête du jeton' },
      { from: 'Rapports', msg: 'Utilise tenant et role du payload' },
    ],
    faulty: [1],
    attack: 'Confusion d’algorithme JWT',
    fixes: [
      'Épingler RS256 et choisir la clé par kid dans un JWKS de confiance',
      'Vérifier que le jeton porte exp, iat et nbf, et refuser s’il en manque un',
      'Mettre le JWKS en cache et ne le rafraîchir que sur un kid inconnu',
      'Imposer une clé RSA d’au moins 3072 bits chez le fournisseur d’identité',
    ],
    why: 'Laisser le jeton choisir l’algorithme, c’est laisser l’attaquant choisir comment il sera vérifié (alg none, ou HMAC avec la clé publique comme secret).',
    avoid: ['alg-none', 'no-verify'],
  },
  {
    id: 'saml',
    level: 3,
    title: 'SSO SAML d’un grand compte',
    context: 'Un grand client se connecte au back-office via SAML depuis son IdP d’entreprise.',
    steps: [
      { from: 'Navigateur', to: 'IdP', msg: 'AuthnRequest' },
      { from: 'IdP', to: 'Novafact', msg: 'POST /saml/acs : Response contenant une Assertion signée' },
      { from: 'Novafact', msg: 'Vérifie la signature XML : valide' },
      { from: 'Novafact', msg: 'Lit l’identité via //Assertion/Subject/NameID (le premier trouvé dans le document)' },
    ],
    faulty: [3],
    attack: 'XML Signature Wrapping',
    fixes: [
      'N’extraire l’identité que de l’élément couvert par la signature',
      'Valider la réponse contre le schéma SAML officiel avant de la traiter',
      'Exiger que les AuthnRequest soient elles aussi signées par le service',
      'Refuser les signatures SHA-1 et n’accepter que SHA-256 ou au-delà',
    ],
    why: 'La vérification porte sur un élément, la lecture sur un autre : c’est un parser differential. La valeur utilisée doit être celle qui a été vérifiée.',
    avoid: ['saml-unsigned', 'saml-comment', 'saml-idp-initiated', 'saml-replay'],
  },
  {
    id: 'nonce',
    level: 2,
    title: 'Flux hybride du back-office',
    context: 'Le back-office utilise OIDC avec response_type=code id_token.',
    steps: [
      { from: 'Novafact', to: 'Navigateur', msg: '302 → /authorize?response_type=code id_token&client_id=nf-admin&state=… (sans nonce)' },
      { from: 'IdP', to: 'Navigateur', msg: 'Retour avec l’id_token dans le fragment' },
      { from: 'Novafact', msg: 'Vérifie signature, iss, aud et exp de l’id_token, puis ouvre la session' },
    ],
    faulty: [0, 2],
    attack: 'Rejeu d’ID token',
    fixes: [
      'Un nonce aléatoire lié à la session, vérifié dans l’id_token',
      'Vérifier que l’id_token porte bien un en-tête kid et une signature',
      'Contrôler l’écart entre iat et l’heure du serveur, à trente secondes près',
      'Augmenter la taille de la clé RSA du fournisseur d’identité à 4096 bits',
    ],
    why: 'Un id_token valide et encore frais, obtenu ailleurs, peut être présenté à nouveau. Le nonce lie le jeton à une demande précise de cette session.',
  },
  {
    id: 'mixup',
    level: 3,
    title: 'Deux fournisseurs d’identité',
    context: 'Le back-office accepte l’IdP Novafact et l’IdP d’un partenaire, avec la même redirect_uri pour les deux.',
    steps: [
      { from: 'Navigateur', to: 'Novafact', msg: 'L’utilisateur choisit un fournisseur' },
      { from: 'Novafact', to: 'Navigateur', msg: '302 → IdP choisi, redirect_uri=https://app.novafact.example/cb (identique pour les deux)' },
      { from: 'IdP', to: 'Novafact', msg: '/cb?code=…&state=…' },
      { from: 'Novafact', msg: 'Échange le code auprès du fournisseur mémorisé en session, sans vérifier quel émetteur a répondu' },
    ],
    faulty: [1, 3],
    attack: 'Attaque mix-up',
    fixes: [
      'Vérifier le paramètre iss (RFC 9207), et une redirect_uri par fournisseur',
      'Chiffrer le state pour qu’il ne révèle pas le fournisseur choisi',
      'N’autoriser qu’un seul fournisseur d’identité par organisation cliente',
      'Refuser les réponses dont la valeur de state a déjà servi une fois',
    ],
    why: 'Quand plusieurs émetteurs partagent la même redirect_uri, le client ne sait pas qui a répondu : un IdP malveillant peut récupérer un code destiné à l’autre.',
  },
  {
    id: 'refresh',
    level: 2,
    title: 'La SPA garde ses jetons',
    context: 'La SPA gère elle-même ses jetons Cognito, sans BFF.',
    steps: [
      { from: 'SPA', to: 'Cognito', msg: 'Connexion code + PKCE → access_token (1 h), refresh_token (30 jours)' },
      { from: 'SPA', msg: 'Stocke les deux jetons dans localStorage' },
      { from: 'SPA', to: 'Cognito', msg: 'Rafraîchit l’access_token avec le même refresh_token pendant 30 jours' },
    ],
    faulty: [1, 2],
    attack: 'Vol et réutilisation durable du refresh token',
    fixes: [
      'Un BFF garde les jetons côté serveur, en cookie HttpOnly',
      'Chiffrer les jetons stockés avec une clé dérivée du mot de passe de session',
      'Faire tourner les refresh tokens et détecter leur réutilisation',
      'Déplacer les jetons dans sessionStorage, effacé à la fermeture de l’onglet',
    ],
    why: 'Tout script qui s’exécute dans la page lit localStorage. Un refresh token sans rotation volé une fois donne un accès pendant 30 jours.',
  },
  {
    id: 'implicit',
    level: 1,
    title: 'Le vieux widget',
    context: 'Un ancien widget intégré chez des clients utilise encore le flux implicite.',
    steps: [
      { from: 'Widget', to: 'AS', msg: '/authorize?response_type=token&client_id=nf-widget&redirect_uri=…' },
      { from: 'AS', to: 'Navigateur', msg: '302 → …/widget#access_token=eyJ…' },
      { from: 'Widget', msg: 'Lit le jeton dans l’URL, puis charge des scripts d’analytics tiers sur la page' },
    ],
    faulty: [0, 1],
    attack: 'Fuite du jeton par l’URL',
    fixes: [
      'Migrer vers le code flow avec PKCE, le flux implicite étant abandonné',
      'Ramener la durée de vie du jeton d’accès à cinq minutes, avec rotation',
      'Poser une Referrer-Policy stricte pour éviter la fuite du fragment',
      'Retirer le jeton du fragment par history.replaceState après lecture',
    ],
    why: 'Un jeton dans l’URL finit dans l’historique, les journaux et les scripts de la page. Le code flow avec PKCE ne transporte qu’un code à usage unique.',
    avoid: ['token-in-query', 'referer-leak'],
  },

  // ── N1 : la pièce absente ou visiblement fausse ─────────────────────────────
  {
    id: 'ropc',
    level: 1,
    title: 'Le formulaire maison',
    context: 'Une intégration partenaire affiche son propre écran de connexion Novafact, sans passer par la page de l’AS.',
    steps: [
      { from: 'Navigateur', to: 'Partenaire', msg: 'Saisit son identifiant et son mot de passe Novafact dans le formulaire du partenaire' },
      { from: 'Partenaire', to: 'AS', msg: 'POST /token grant_type=password (username, password, client_id) → jetons' },
      { from: 'Partenaire', msg: 'Conserve les jetons et, « pour plus tard », le mot de passe' },
    ],
    faulty: [0, 1],
    attack: 'Exposition des identifiants au client',
    fixes: [
      'Rediriger vers l’AS en code flow + PKCE : le mot de passe ne quitte jamais Novafact',
      'Chiffrer le mot de passe conservé chez le partenaire avec une clé dédiée',
      'Limiter le nombre d’appels au point /token par partenaire et par minute',
      'Faire signer au partenaire un engagement sur la confidentialité des identifiants',
    ],
    why: 'Le grant password (ROPC) fait transiter le mot de passe par un tiers : c’est justement ce que la redirection vers l’AS évite. OAuth 2.1 le retire pour cette raison.',
  },
  {
    id: 'secret-in-spa',
    level: 1,
    title: 'Le secret dans le bundle',
    context: 'La nouvelle SPA a été déclarée comme client confidentiel ; son code JavaScript contient le client_secret.',
    steps: [
      { from: 'SPA', to: 'AS', msg: '/authorize?client_id=nf-spa&response_type=code&redirect_uri=…&state=…' },
      { from: 'AS', to: 'SPA', msg: 'Redirection …/cb?code=…&state=…' },
      { from: 'SPA', to: 'AS', msg: 'POST /token (code, client_id, client_secret) : le secret part depuis le navigateur' },
    ],
    faulty: [2],
    attack: 'Extraction du secret d’un client public',
    fixes: [
      'Traiter la SPA comme un client public : PKCE, sans aucun secret embarqué',
      'Obscurcir le bundle JavaScript pour dissimuler la valeur du secret',
      'Faire tourner le client_secret toutes les vingt-quatre heures',
      'Injecter le secret depuis une variable d’environnement au moment du build',
    ],
    why: 'Tout ce que le navigateur exécute est lisible : un secret dans le front n’est pas un secret. Un client public s’authentifie par PKCE, pas par un secret partagé.',
  },
  {
    id: 'alg-none',
    level: 1,
    title: 'Le vérificateur permissif',
    context: 'Un microservice de rapports valide les JWT reçus de l’API avec un utilitaire maison.',
    steps: [
      { from: 'API', to: 'Rapports', msg: 'JWT (en-tête alg, payload avec role et tenant)' },
      { from: 'Rapports', msg: 'Si alg vaut "none", accepte le jeton sans vérifier de signature ; sinon vérifie' },
      { from: 'Rapports', msg: 'Lit role et tenant, puis rend les données' },
    ],
    faulty: [1],
    attack: 'Contournement par algorithme none',
    fixes: [
      'Refuser alg=none et n’accepter que l’algorithme attendu (RS256)',
      'Rejeter tout jeton dont le payload ne contient pas de champ role',
      'Consigner chaque jeton refusé pour une analyse ultérieure',
      'Chiffrer les jetons en plus de les signer (passer en JWE)',
    ],
    why: '« none » veut dire « non signé ». L’accepter laisse n’importe qui forger un jeton. L’algorithme doit être imposé par le vérificateur, jamais lu dans le jeton.',
    avoid: ['alg', 'no-verify'],
  },
  {
    id: 'no-verify',
    level: 1,
    title: 'Le jeton décodé, pas vérifié',
    context: 'Une Lambda lit le tenant depuis le JWT présenté par l’appelant.',
    steps: [
      { from: 'Appelant', to: 'Lambda', msg: 'Authorization: Bearer <JWT>' },
      { from: 'Lambda', msg: 'const claims = jwt.decode(token) — décode le jeton sans vérifier sa signature' },
      { from: 'Lambda', msg: 'Utilise claims.tenant pour choisir la base de données' },
    ],
    faulty: [1],
    attack: 'Falsification d’un jeton non vérifié',
    fixes: [
      'Vérifier la signature via le JWKS avant de lire le moindre claim',
      'Comparer le tenant du jeton à celui passé dans l’URL de la requête',
      'N’accepter que des jetons émis depuis moins de cinq minutes',
      'Journaliser le sub de chaque appelant pour la piste d’audit',
    ],
    why: 'decode ne fait que désérialiser : il n’authentifie rien. Sans vérification de signature, l’appelant écrit lui-même ses claims, tenant compris.',
    avoid: ['alg', 'alg-none'],
  },
  {
    id: 'token-in-query',
    level: 1,
    title: 'Le jeton dans les paramètres',
    context: 'Un ancien client interne appelle l’API en passant le jeton dans l’URL.',
    steps: [
      { from: 'Client', to: 'API', msg: 'GET /api/invoices?access_token=eyJhbGci…' },
      { from: 'API', msg: 'Lit le jeton depuis req.query.access_token' },
      { from: 'CloudFront / ALB', msg: 'Journalisent l’URL complète, jeton compris' },
    ],
    faulty: [0, 2],
    attack: 'Fuite du jeton par l’URL',
    fixes: [
      'Transmettre le jeton dans l’en-tête Authorization, jamais dans l’URL',
      'Masquer le paramètre access_token dans la configuration des journaux',
      'Réduire la durée de vie du jeton d’accès à deux minutes',
      'Chiffrer les journaux d’accès au repos avec une clé KMS dédiée',
    ],
    why: 'Un jeton dans l’URL se retrouve dans les journaux, l’historique et l’en-tête Referer. L’en-tête Authorization, lui, n’est journalisé nulle part par défaut.',
    avoid: ['implicit', 'referer-leak'],
  },
  {
    id: 'exp-missing',
    level: 1,
    title: 'L’horloge oubliée',
    context: 'L’API vérifie soigneusement les jetons — presque.',
    steps: [
      { from: 'Client', to: 'API', msg: 'Authorization: Bearer <JWT>' },
      { from: 'API', msg: 'Vérifie la signature (JWKS), iss et aud' },
      { from: 'API', msg: 'Lit sub et tenant, sans regarder exp' },
    ],
    faulty: [2],
    attack: 'Rejeu d’un jeton expiré',
    fixes: [
      'Vérifier exp et nbf à chaque validation du jeton',
      'Réduire la durée de vie des jetons émis à quinze minutes',
      'Ajouter au passage un contrôle de l’audience du jeton',
      'Révoquer les jetons dès la déconnexion de l’utilisateur',
    ],
    why: 'Un jeton signé reste valide éternellement si personne ne regarde sa date. Un access token capturé un jour sert le lendemain : exp doit être contrôlé à chaque appel.',
  },
  {
    id: 'state-constant',
    level: 1,
    title: 'Le state en dur',
    context: 'Le back-office ajoute bien un paramètre state à sa demande d’autorisation.',
    steps: [
      { from: 'Novafact', to: 'Navigateur', msg: '302 → /authorize?…&state=novafact-login (valeur fixe, la même pour tous)' },
      { from: 'Google', to: 'Navigateur', msg: '302 → /cb?code=…&state=novafact-login' },
      { from: 'Novafact', msg: 'Vérifie que state vaut « novafact-login » : accepté' },
    ],
    faulty: [0, 2],
    attack: 'CSRF sur la connexion (injection de session)',
    fixes: [
      'Générer un state aléatoire par requête, lié à la session, puis le vérifier',
      'Signer la valeur de state avec une clé serveur pour empêcher qu’un tiers ne la modifie',
      'Chiffrer le state afin qu’il ne révèle rien du flux',
      'Ajouter un paramètre nonce à la demande d’autorisation',
    ],
    why: 'Un state constant se devine et se rejoue : il ne prouve plus que la réponse répond à une demande de ce navigateur. Il doit être imprévisible et à usage unique.',
    avoid: ['state'],
  },

  // ── N2 : lire le contexte, un correctif qui marche à moitié ──────────────────
  {
    id: 'pkce-plain',
    level: 2,
    title: 'PKCE, mais en clair',
    context: 'L’application mobile utilise PKCE avec code_challenge_method=plain.',
    steps: [
      { from: 'App', to: 'AS', msg: '/authorize?…&code_challenge=abc123&code_challenge_method=plain' },
      { from: 'AS', to: 'App', msg: 'Redirection novafact://cb?code=…' },
      { from: 'App', to: 'AS', msg: 'POST /token (code, code_verifier=abc123) → jetons' },
    ],
    faulty: [0],
    attack: 'Interception du code d’autorisation',
    fixes: [
      'Exiger la méthode S256 : le verifier ne transite jamais en clair',
      'Allonger le code_verifier jusqu’à cent vingt-huit caractères',
      'Protéger la requête d’autorisation avec PAR (RFC 9126)',
      'Réduire la durée de vie du code à quinze secondes',
    ],
    why: 'En « plain », le challenge est le verifier : qui voit la requête d’autorisation peut rejouer l’échange. Seul S256 fait que le verifier reste secret. PAR aide, mais ne corrige pas le choix de la méthode.',
    avoid: ['pkce'],
  },
  {
    id: 'aud-missing',
    level: 2,
    title: 'L’audience ignorée',
    context: 'Novafact a deux API derrière le même pool Cognito : la facturation et l’analytique.',
    steps: [
      { from: 'SPA', to: 'Cognito', msg: 'Obtient un access_token pour l’API analytique' },
      { from: 'SPA', to: 'API facturation', msg: 'GET /invoices, Authorization: Bearer <ce jeton>' },
      { from: 'API facturation', msg: 'Vérifie signature, iss et exp, puis sert la facture' },
    ],
    faulty: [2],
    attack: 'Confusion d’audience',
    fixes: [
      'Vérifier aud : le jeton doit nommer l’API facturation',
      'Utiliser un pool Cognito distinct pour chaque API',
      'Réduire la portée des scopes accordés à la SPA',
      'Contrôler que le jeton porte bien un claim scope',
    ],
    why: 'Deux API du même émetteur produisent des jetons signés par la même clé. Sans contrôle de aud, un jeton émis pour l’une ouvre l’autre.',
    avoid: ['id-token', 'cognito-appclient'],
  },
  {
    id: 'cognito-appclient',
    level: 2,
    title: 'Le pool à plusieurs clients',
    context: 'Le pool Cognito sert la SPA, l’app mobile et un outil interne. L’API accepte tout jeton du pool.',
    steps: [
      { from: 'Outil interne', to: 'Cognito', msg: 'Obtient un access_token (client_id=nf-tools)' },
      { from: 'Outil interne', to: 'API', msg: 'Appelle une route réservée à la SPA avec ce jeton' },
      { from: 'API', msg: 'Vérifie signature, iss et exp, sans distinguer quel client a émis le jeton' },
    ],
    faulty: [2],
    attack: 'Confusion de client applicatif',
    fixes: [
      'Contrôler le client_id du jeton contre la liste attendue pour la route',
      'Ajouter un scope propre à chaque route sensible',
      'Exiger une ré-authentification pour les routes réservées',
      'Placer l’outil interne dans un pool Cognito séparé',
    ],
    why: 'Un access token Cognito porte le claim client_id, pas une audience applicative. Si l’API ne le regarde pas (ni de scope dédié), un jeton d’un autre client du même pool passe.',
    avoid: ['aud-missing', 'id-token'],
  },
  {
    id: 'consent-phishing',
    level: 2,
    title: 'L’application tierce trop gourmande',
    context: 'Un utilisateur clique sur un lien et autorise « Novafact Analytics », qu’il croit officielle.',
    steps: [
      { from: 'Utilisateur', to: 'AS', msg: '/authorize?client_id=app-tierce&scope=openid invoices.read offline_access&redirect_uri=https://tierce.example/cb' },
      { from: 'AS', to: 'Utilisateur', msg: 'Écran de consentement ; l’utilisateur accepte' },
      { from: 'app-tierce', msg: 'Reçoit un refresh_token et lit les factures à volonté' },
    ],
    faulty: [0, 1],
    attack: 'Hameçonnage de consentement OAuth',
    fixes: [
      'N’autoriser que des applications approuvées (consentement administrateur)',
      'Retirer offline_access de la liste des scopes proposés au consentement',
      'Afficher le domaine du client en toutes lettres sur l’écran de consentement',
      'Vérifier que la redirect_uri du client est bien en HTTPS',
    ],
    why: 'Le flux est régulier : c’est l’utilisateur qui donne l’accès. La défense est de restreindre les applications autorisées et de réviser les consentements, pas de durcir le protocole (ATT&CK T1528).',
  },
  {
    id: 'saml-unsigned',
    level: 2,
    title: 'L’assertion non signée',
    context: 'Le point ACS de Novafact reçoit une Response SAML et vérifie « qu’une signature est présente ».',
    steps: [
      { from: 'IdP', to: 'Novafact', msg: 'POST /saml/acs : Response signée, contenant une Assertion non signée' },
      { from: 'Novafact', msg: 'Constate une signature valide sur la Response et l’accepte' },
      { from: 'Novafact', msg: 'Lit l’identité dans l’Assertion' },
    ],
    faulty: [1, 2],
    attack: 'Injection d’assertion non signée',
    fixes: [
      'Exiger que ce soit l’Assertion elle-même qui soit signée et vérifiée',
      'Valider la Response entière contre le schéma XML officiel avant tout traitement',
      'Refuser les signatures antérieures à SHA-256',
      'Contrôler le champ Destination de la Response',
    ],
    why: 'Une signature sur l’enveloppe ne protège pas ce qu’on lit dedans si l’Assertion n’est pas couverte. C’est l’élément qui porte l’identité qui doit être signé.',
    avoid: ['saml', 'saml-comment'],
  },
  {
    id: 'saml-replay',
    level: 2,
    title: 'L’assertion rejouée',
    context: 'Un attaquant capture une Response SAML valide sur un poste partagé et la renvoie plus tard.',
    steps: [
      { from: 'Attaquant', to: 'Novafact', msg: 'POST /saml/acs : rejoue une Response signée capturée une heure plus tôt' },
      { from: 'Novafact', msg: 'Vérifie la signature de l’Assertion : valide' },
      { from: 'Novafact', msg: 'Ouvre une session, sans regarder NotOnOrAfter ni l’ID déjà vu' },
    ],
    faulty: [2],
    attack: 'Rejeu d’assertion SAML',
    fixes: [
      'Rejeter les assertions hors fenêtre et mémoriser les ID déjà consommés',
      'Raccourcir la durée de validité des assertions à deux minutes',
      'Chiffrer les assertions en plus de les signer',
      'Exiger que l’AuthnRequest soit signée par le service',
    ],
    why: 'Une signature prouve l’origine, pas la fraîcheur. Sans contrôle de la fenêtre temporelle et de l’unicité, une assertion valide se rejoue autant qu’on veut.',
    avoid: ['saml'],
  },
  {
    id: 'device-poll',
    level: 2,
    title: 'Le code d’appareil trop court',
    context: 'La TV connectée de démonstration Novafact utilise le device flow ; le user_code fait quatre chiffres.',
    steps: [
      { from: 'Appareil', to: 'AS', msg: 'POST /device_authorization → user_code=4821, device_code=…' },
      { from: 'Attaquant', msg: 'Démarre son propre device flow et tente des user_code au hasard' },
      { from: 'AS', msg: 'Aucune limite sur les essais d’appairage ; un code finit par correspondre' },
    ],
    faulty: [0, 2],
    attack: 'Force brute du code utilisateur',
    fixes: [
      'Codes longs et alphabétiques, expiration courte, limitation des essais',
      'Réduire la durée de vie du device_code à trente secondes',
      'Afficher le code sur l’appareil plutôt que de le faire saisir',
      'Exiger une confirmation par courriel après l’appairage',
    ],
    why: 'Un espace de codes minuscule et un appairage sans plafond se brute-forcent. Le device flow (RFC 8628) suppose des codes assez longs et une limite d’essais.',
  },
  {
    id: 'referer-leak',
    level: 2,
    title: 'La fuite par le Referer',
    context: 'Après le retour d’autorisation, la page de callback charge un script d’analytics tiers.',
    steps: [
      { from: 'AS', to: 'Navigateur', msg: '302 → /cb?code=…&state=…' },
      { from: 'Navigateur', msg: 'La page /cb charge https://analytics.tierce.example/t.js' },
      { from: 'Navigateur', to: 'tierce', msg: 'La requête part avec un en-tête Referer contenant le code' },
    ],
    faulty: [1, 2],
    attack: 'Fuite du code par le Referer',
    fixes: [
      'Poser une Referrer-Policy stricte et retirer le code de l’URL après échange',
      'Ne charger les scripts tiers qu’une fois le code consommé',
      'Réduire la durée de vie du code d’autorisation à dix secondes',
      'Servir la page de callback sans aucune ressource externe',
    ],
    why: 'Le navigateur ajoute l’URL courante en Referer des requêtes sortantes. Si le code y figure encore, il fuite vers chaque tiers chargé par la page.',
    avoid: ['implicit', 'token-in-query'],
  },

  // ── N3 : relier deux étapes, le piège « le plus sûr », l’absence ─────────────
  {
    id: 'code-injection',
    level: 3,
    title: 'Le code injecté',
    context: 'Le back-office utilise le code flow avec state, mais sans PKCE (client confidentiel).',
    steps: [
      { from: 'Attaquant', to: 'AS', msg: 'Obtient un code d’autorisation valide pour son propre compte' },
      { from: 'Attaquant', to: 'Victime', msg: 'Fait ouvrir /cb?code=<code attaquant>&state=<state valide de la victime>' },
      { from: 'Novafact', msg: 'state correspond : échange le code et ouvre la session' },
      { from: 'Novafact', msg: 'La victime se retrouve connectée au compte de l’attaquant' },
    ],
    faulty: [2, 3],
    attack: 'Injection de code d’autorisation',
    fixes: [
      'PKCE : lier le code au verifier, un code injecté devient inéchangeable',
      'Ajouter un paramètre nonce vérifié dans l’id_token',
      'Vérifier que l’adresse IP à l’échange du code est bien celle qui a initié la demande',
      'Réduire la durée de vie du code à dix secondes',
    ],
    why: 'Le state arrête le CSRF, pas l’injection : il ne lie pas le code au navigateur. PKCE le fait, et RFC 9700 l’exige même pour les clients confidentiels.',
    avoid: ['pkce', 'state'],
  },
  {
    id: 'saml-idp-initiated',
    level: 3,
    title: 'SSO déclenché par l’IdP',
    context: 'Novafact accepte le SSO initié par l’IdP : une Response non sollicitée ouvre une session.',
    steps: [
      { from: 'Novafact', msg: 'N’a émis aucune AuthnRequest' },
      { from: 'Attaquant', to: 'Victime', msg: 'Fait poster sur /saml/acs une Response valide liée au compte de l’attaquant' },
      { from: 'Novafact', msg: 'La Response n’a pas d’InResponseTo à vérifier : acceptée' },
      { from: 'Novafact', msg: 'La victime navigue dans le compte de l’attaquant sans le savoir' },
    ],
    faulty: [2, 3],
    attack: 'SSO SAML forcé (login CSRF)',
    fixes: [
      'Exiger le flux SP-initié et vérifier InResponseTo contre une requête émise',
      'Restreindre les fournisseurs d’identité autorisés à poster une Response sur le point ACS',
      'Afficher le nom du compte connecté en évidence',
      'Refuser les Response de plus de deux minutes',
    ],
    why: 'Sans AuthnRequest, rien ne relie la réponse à une demande de ce navigateur : c’est un CSRF de connexion. Le flux SP-initié et InResponseTo rétablissent ce lien.',
    avoid: ['saml', 'saml-replay'],
  },
  {
    id: 'token-exchange',
    level: 3,
    title: 'L’échange entre microservices',
    context: 'Le service de facturation échange le jeton de l’utilisateur contre un jeton pour le service e-mail (RFC 8693).',
    steps: [
      { from: 'Facturation', to: 'AS', msg: 'POST /token grant_type=token-exchange subject_token=<user> audience=email' },
      { from: 'AS', msg: 'Émet un jeton pour n’importe quelle audience demandée, sans restreindre l’appelant' },
      { from: 'Service e-mail', msg: 'Compromis, il demande à son tour un jeton pour l’audience « paiements »' },
    ],
    faulty: [1, 2],
    attack: 'Élévation par échange de jetons',
    fixes: [
      'Restreindre par politique les audiences et scopes que chaque service peut demander',
      'Réduire la durée de vie des jetons échangés',
      'Exiger mTLS entre les services et l’AS',
      'Journaliser chaque échange de jeton et alerter sur toute demande d’audience inhabituelle',
    ],
    why: 'Le token exchange délègue de l’autorité : si l’AS ne borne pas ce que chaque appelant peut obtenir, un service compromis se fabrique un jeton pour un autre domaine.',
  },
  {
    id: 'dpop-replay',
    level: 3,
    title: 'Le jeton porteur rejoué',
    context: 'L’API accepte des bearer tokens simples ; un proxy d’entreprise journalise les en-têtes.',
    steps: [
      { from: 'Client', to: 'API', msg: 'Authorization: Bearer <access_token>' },
      { from: 'Proxy', msg: 'Le jeton est capturé dans les journaux du proxy' },
      { from: 'Attaquant', to: 'API', msg: 'Rejoue le même jeton depuis une autre machine : accepté' },
    ],
    faulty: [0, 2],
    attack: 'Rejeu d’un jeton porteur volé',
    fixes: [
      'Lier le jeton au client par DPoP (RFC 9449) ou mTLS',
      'Réduire la durée de vie du jeton d’accès à cinq minutes',
      'Chiffrer les journaux du proxy d’entreprise',
      'Restreindre l’API à une liste d’adresses IP de confiance',
    ],
    why: 'Un bearer token n’appartient à personne : qui le détient l’utilise. Le lier au client (DPoP, mTLS) rend un jeton capturé inutile ailleurs — raccourcir sa vie ne fait que réduire la fenêtre.',
  },
  {
    id: 'noauth-email',
    level: 3,
    title: 'Se connecter avec l’e-mail',
    context: 'Novafact relie les comptes « Se connecter avec Microsoft » par le claim email. Inspiré de nOAuth (Descope, 2023).',
    steps: [
      { from: 'Attaquant', msg: 'Dans son propre locataire, met l’adresse de la victime dans son profil' },
      { from: 'Attaquant', to: 'Novafact', msg: 'Se connecte via l’IdP ; l’id_token porte email=victime@acme.example' },
      { from: 'Novafact', msg: 'Trouve un compte avec cet e-mail et ouvre sa session, sans lire email_verified' },
    ],
    faulty: [2],
    attack: 'Prise de contrôle via un e-mail non vérifié',
    fixes: [
      'Identifier le compte par la paire iss+sub, jamais par un e-mail',
      'N’accepter l’e-mail que si le claim email_verified vaut vrai',
      'Refuser les fournisseurs multi-locataires inconnus',
      'Demander une confirmation par courriel au premier rattachement',
    ],
    why: 'Le claim email d’Entra est modifiable et non vérifié : s’en servir de clé d’identité laisse un attaquant se faire passer pour un autre. nOAuth (2023) a touché des milliers d’applications SaaS.',
  },
  {
    id: 'drift-oauth',
    level: 3,
    title: 'Le connecteur tiers compromis',
    context: 'Une intégration analytique tierce détient des refresh tokens Novafact. Inspiré du vol de jetons Salesloft Drift (UNC6395, 2025).',
    steps: [
      { from: 'Éditeur tiers', msg: 'Les jetons OAuth du connecteur sont dérobés chez l’éditeur' },
      { from: 'Attaquant', to: 'API', msg: 'Utilise les refresh tokens pour lire massivement les factures' },
      { from: 'Novafact', msg: 'Scopes larges, jetons de longue durée, aucune détection d’usage anormal' },
    ],
    faulty: [1, 2],
    attack: 'Vol de jetons d’une intégration tierce',
    fixes: [
      'Scopes minimaux, rotation des jetons et détection d’un usage anormal par intégration',
      'Chiffrer au repos les jetons conservés chez l’éditeur tiers avec une clé propre à chaque client',
      'Limiter chaque intégration à une plage d’adresses IP',
      'Exiger un nouveau consentement tous les trente jours',
    ],
    why: 'Un jeton d’intégration volé est un accès légitime aux yeux de l’API : seules la limitation des scopes, la rotation et la surveillance le contiennent. En 2025, des jetons Drift volés ont servi à siphonner des données Salesforce.',
  },
  {
    id: 'device-phishing',
    level: 3,
    title: 'Le code d’appareil hameçonné',
    context: 'Un attaquant abuse du device flow pour capter une session. Inspiré de Storm-2372 (Microsoft, 2025).',
    steps: [
      { from: 'Attaquant', to: 'AS', msg: 'Démarre un device flow et obtient un user_code' },
      { from: 'Attaquant', to: 'Victime', msg: 'Envoie une fausse invitation de réunion : « entrez ce code pour rejoindre »' },
      { from: 'Victime', to: 'AS', msg: 'S’authentifie et approuve le code' },
      { from: 'AS', msg: 'Émet les jetons à l’appareil de l’attaquant, qui a lancé le flux' },
    ],
    faulty: [1, 3],
    attack: 'Hameçonnage du flux d’appareil',
    fixes: [
      'Réserver le device flow aux seuls appareils sans navigateur',
      'Réduire la durée de vie du device_code à soixante secondes',
      'Afficher l’application demandeuse sur l’écran d’approbation',
      'Exiger un second facteur avant d’approuver un code',
    ],
    why: 'L’AS ne peut pas savoir que la personne qui approuve n’est pas celle qui a lancé le flux : c’est l’angle de Storm-2372 (2025). Restreindre l’usage du device flow et surveiller les approbations est la vraie parade.',
  },
  {
    id: 'saml-comment',
    level: 3,
    title: 'Le commentaire qui change l’identité',
    context: 'Le NameID d’une assertion SAML contient un commentaire XML. Inspiré des travaux de Duo Labs (2018).',
    steps: [
      { from: 'IdP', to: 'Novafact', msg: 'Assertion signée, NameID = admin@acme.example<!---->.evil.example' },
      { from: 'Novafact', msg: 'La signature couvre la valeur canonicalisée : valide' },
      { from: 'Novafact', msg: 'Extrait le NameID en concaténant les nœuds texte : lit « admin@acme.example »' },
    ],
    faulty: [2],
    attack: 'Injection de commentaire XML (SAML)',
    fixes: [
      'Extraire le NameID via une API qui applique la même canonicalisation que la signature',
      'Rejeter systématiquement les assertions dont le NameID contient un commentaire XML ou un nœud parasite',
      'Exiger le chiffrement des assertions',
      'Comparer le NameID à une liste d’identités attendues',
    ],
    why: 'La bibliothèque de signature et le code d’extraction ne lisent pas le XML de la même façon : le commentaire coupe la valeur pour l’un, pas pour l’autre. Duo Labs (2018) a montré l’attaque sur plusieurs SDK SAML.',
    avoid: ['saml'],
  },
];

// ── Les séries ──────────────────────────────────────────────────────────────

const mix = (n1: number, n2: number, n3: number): [number, number, number] => [n1, n2, n3];

// Séries thématiques : des listes d'identifiants, pour que le filtre rende
// exactement le sous-ensemble voulu (ni plus, ni moins).
const JWT_IDS = ['id-token', 'alg', 'no-verify', 'aud-missing', 'cognito-appclient', 'exp-missing'];
const SAML_IDS = ['saml', 'saml-unsigned', 'saml-replay', 'saml-idp-initiated', 'saml-comment'];
const REAL_IDS = ['noauth-email', 'drift-oauth', 'device-phishing', 'saml-comment', 'consent-phishing'];

const PROFILES: SeriesProfile<FlowScenario>[] = [
  { id: 'bases', title: 'Le paramètre manquant', mix: mix(5, 0, 0), level: 1,
    text: 'Un flux, une pièce absente ou fausse, visible dans une seule étape : state oublié, secret dans le front, jeton dans l’URL.' },
  { id: 'montee', title: 'Sous le capot', mix: mix(1, 4, 0), level: 2,
    text: 'Le défaut se lit dans le contexte : un correctif qui ne marche qu’à moitié, une bonne pratique posée au mauvais endroit.' },
  { id: 'oidc-jwt', title: 'JWT & ID token', filter: (s) => JWT_IDS.includes(s.id), level: 2,
    text: 'Tout tourne autour du jeton : qui choisit l’algorithme, quelle audience, quel usage, quelle date d’expiration.' },
  { id: 'saml', title: 'Le monde SAML', filter: (s) => SAML_IDS.includes(s.id), level: 3,
    text: 'Cinq façons de tromper un point ACS : enveloppe signée, assertion nue, rejeu, SSO forcé, commentaire XML.' },
  { id: 'combines', title: 'Deux étapes à relier', mix: mix(0, 1, 4), level: 3,
    text: 'L’attaque n’apparaît qu’en reliant deux étapes : mix-up, code injecté malgré le state, échange de jetons non borné.' },
  { id: 'reels', title: 'Incidents publics', filter: (s) => REAL_IDS.includes(s.id), level: 3,
    text: 'Cinq cas documentés : nOAuth, vol de jetons Drift, hameçonnage de device code, commentaire SAML, consentement abusif.' },
  { id: 'expert', title: 'Revue d’architecture', mix: mix(0, 0, 5), level: 3,
    text: 'Rien ne se devine à la forme : le correctif « le plus sûr » est parfois le piège, et le défaut, souvent une absence.' },
  { id: 'melee', title: 'Mêlée', mix: mix(2, 2, 2), level: 2, shuffleEachTime: true,
    text: 'Tous niveaux confondus, recomposée à chaque partie. La seule série qu’on ne peut pas réviser.' },
];

export const oauthSeries = defineSeries(flowScenarios, PROFILES);

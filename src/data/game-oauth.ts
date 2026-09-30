// Scénarios du jeu « OAuth Flow Debugger » (M9) : un flux, une étape faible, une attaque, une correction.

export type FlowStep = { from: string; to?: string; msg: string };
export type FlowScenario = {
  id: string;
  title: string;
  context: string;
  steps: FlowStep[];
  faulty: number[]; // étapes acceptées comme « étape faible » (index)
  attack: string;
  fixes: string[]; // la première est la bonne
  why: string;
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
] as const;

export const flowScenarios: FlowScenario[] = [
  {
    id: 'state',
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
  },
  {
    id: 'redirect-prefix',
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
  },
  {
    id: 'id-token',
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
  },
  {
    id: 'alg',
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
  },
  {
    id: 'saml',
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
  },
  {
    id: 'nonce',
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
  },
];

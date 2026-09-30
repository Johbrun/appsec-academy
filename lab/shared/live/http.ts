// Surface HTTP et client — challenges jouables.
//
// Tout ce qui se joue entre le navigateur et le serveur : en-têtes de sécurité,
// CORS, CSRF, clickjacking, XS-Leaks, GraphQL, et les défauts du code client.
//
// Où vivent les défauts :
//   · server/index.ts ............ CSP, CORS, surcharge de méthode, contrôle
//                                  d'accès par préfixe, endpoint de diagnostic,
//                                  et la surface HTTP rendue par le serveur
//   · server/routes/graphql.ts ... introspection, coût, suggestions, batching
//   · server/routes/webhooks.ts .. SSRF par redirection
//   · src/api.ts ................. DOM clobbering, pollution de prototype
//                                  côté client, secret dans le bundle
//   · src/main.tsx ............... politique Trusted Types par défaut
//   · src/pages/InvoiceDetail.tsx  URL javascript: rendue par React
//   · src/pages/Checkout.tsx ..... postMessage sans contrôle d'origine
//
// Les exercices du navigateur se constatent côté serveur : `Sec-Fetch-Site` et
// `Sec-Fetch-Dest` sont posés par le navigateur et JavaScript ne peut pas les
// forger. Une requête arrivée avec `Sec-Fetch-Site: same-origin` sur une balise
// du lab prouve qu'une charge utile s'est exécutée DANS l'origine de
// l'application ; `Sec-Fetch-Dest: iframe` prouve un encadrement.

import type { ExerciseDef } from '../exercises.ts';

export const http: ExerciseDef[] = [
  // ─── M2 · Vulnérabilités web ───────────────────────────────────────────────
  {
    id: 'url-prefix-authz', module: 'm02', title: 'Contrôle d’accès par préfixe d’URL',
    status: 'live', kind: 'exploit', level: 2, csslp: ['D5'], cwe: 'CWE-289',
    brief:
      'La protection des routes d’administration est montée sur un préfixe de chemin, que le routeur normalise après l’avoir comparé.',
    goal: 'Atteindre une route d’administration depuis un compte ordinaire, sans changer de rôle.',
    file: 'server/index.ts',
    lessons: ['m02/l02', 'm12/l05'],
    hints: [
      'Le grand livre est servi par GET /api/admin/exports/ledger. Un compte ordinaire s’y voit refuser l’accès — par quoi, exactement ?',
      'Le contrôle compare une chaîne (`req.path`). Le routeur d’Express, lui, résout les routes sans tenir compte de la casse : les deux ne voient pas la même URL.',
      'GET /api/Admin/exports/ledger avec le jeton de dev@acme.example. Un seul caractère change.',
    ],
    fix: 'L’autorisation ne se décide pas sur une chaîne d’URL : elle se décide sur la ressource et l’action, après résolution de la route. Casse, doubles séparateurs et encodages divergent toujours entre la comparaison et le routage.',
  },

  // ─── M3 · API, GraphQL, SSRF ──────────────────────────────────────────────
  {
    id: 'content-type-confusion', module: 'm03', title: 'Confusion de Content-Type sur une mutation',
    status: 'live', kind: 'exploit', level: 2, csslp: ['D5'], cwe: 'CWE-352',
    brief:
      'La route accepte JSON et formulaire encodé, mais la vérification anti-CSRF ne s’applique qu’à la branche JSON.',
    goal: 'Modifier l’IBAN de facturation d’un utilisateur connecté depuis une page d’une autre origine.',
    file: 'server/index.ts',
    lessons: ['m03/l07', 'm02/l06'],
    hints: [
      'Pose d’abord le cookie de la surface : GET /api/surface/login?token=<ton jwt>. Puis regarde POST /api/billing/iban.',
      'En JSON, le serveur exige un jeton anti-CSRF (GET /api/surface/csrf). Le formulaire encodé, lui, emprunte une autre branche du contrôle — celle qui ne vérifie rien.',
      'POST /api/billing/iban avec Content-Type: application/x-www-form-urlencoded et le corps iban=FR7612345678901234567890123, sans aucun jeton.',
    ],
    fix: 'Un contrôle qui dépend du format d’entrée a autant de trous que de formats acceptés. N’accepter qu’un format par route, et faire porter la défense CSRF par le cookie (`SameSite`) et Fetch Metadata plutôt que par un jeton conditionnel.',
  },
  {
    id: 'graphql-introspection', module: 'm03', title: 'GraphQL : introspection et coût',
    status: 'live', kind: 'exploit', level: 2, csslp: ['D5'], cwe: 'CWE-200',
    brief:
      'L’API GraphQL interne est exposée au front avec l’introspection active et sans limite de profondeur ni de coût.',
    goal: 'Cartographier le schéma, puis faire tomber le serveur avec une requête profondément imbriquée.',
    file: 'server/routes/graphql.ts',
    lessons: ['m03/l03', 'm13/l05'],
    hints: [
      'POST /api/graphql accepte {"query":"…"}. Commence par demander le schéma : `{ __schema { types { name fields { name } } } }`.',
      'Le schéma est cyclique : Invoice.owner renvoie un User, et User.invoices renvoie des Invoice. Rien ne borne la descente.',
      'Enchaîne owner/invoices jusqu’à douze niveaux au moins, dans la même session que l’introspection : `{ me { invoices { owner { invoices { owner { … } } } } } }`.',
    ],
    fix: 'Introspection désactivée hors développement, budget de complexité calculé avant exécution, profondeur bornée. Et l’autorisation vérifiée dans chaque résolveur, pas à l’entrée du point d’accès.',
  },
  {
    id: 'graphql-clairvoyance', module: 'm03', title: 'GraphQL : reconstruire le schéma sans introspection',
    status: 'live', kind: 'exploit', level: 3, csslp: ['D5'], cwe: 'CWE-209',
    brief:
      'L’introspection est coupée, mais les suggestions « vouliez-vous dire… » des messages d’erreur permettent de reconstituer le schéma champ par champ.',
    goal: 'Lire la valeur d’un champ non documenté en le devinant à partir des seuls messages d’erreur.',
    file: 'server/routes/graphql.ts',
    lessons: ['m03/l03', 'm02/l05'],
    hints: [
      'Compare la liste des champs que l’introspection donne pour Invoice à ce que le résolveur accepte réellement. Certains champs ne sont pas dans la liste.',
      'Demande un champ qui n’existe pas : l’erreur propose les noms voisins. `{ me { internalCredit } }`, `{ invoices { internal } }`…',
      'Suis les suggestions jusqu’au nom complet, puis sélectionne-le : `{ invoices { internalMargin } }` ou `{ me { internalCreditScore } }`.',
    ],
    fix: 'Désactiver les suggestions en production et renvoyer des erreurs génériques : couper l’introspection sans couper les suggestions ne fait que ralentir la cartographie. L’obscurité n’est de toute façon pas le contrôle — l’autorisation par résolveur l’est.',
  },
  {
    id: 'graphql-csrf', module: 'm03', title: 'CSRF sur le point d’accès GraphQL',
    status: 'live', kind: 'exploit', level: 2, csslp: ['D5'], cwe: 'CWE-352',
    brief:
      'Le point d’accès GraphQL accepte un formulaire encodé, ce qui rend les mutations atteignables depuis une page tierce.',
    goal: 'Changer l’adresse de facturation d’un utilisateur connecté depuis une autre origine.',
    file: 'server/routes/graphql.ts',
    lessons: ['m03/l03', 'm02/l06'],
    hints: [
      'La mutation est `setBillingAddress(address: "…")`. En JSON, elle exige un preflight CORS — donc une page tierce ne peut pas l’envoyer en aveugle.',
      'Quels types de contenu un formulaire HTML peut-il poster sans preflight ? Le point d’accès les accepte tous, et le GET aussi.',
      'POST /api/graphql en application/x-www-form-urlencoded avec query=mutation{setBillingAddress(address:"1 rue de l’Attaquant"){billingAddress}}.',
    ],
    fix: 'N’accepter que `application/json` sur le point d’accès — un type que le navigateur ne peut pas envoyer en formulaire simple sans contrôle préalable — et refuser les mutations en `GET`.',
  },
  {
    id: 'ssrf-redirect-bypass', module: 'm03', title: 'SSRF par redirection',
    status: 'live', kind: 'exploit', level: 3, csslp: ['D5', 'D7'], cwe: 'CWE-918',
    brief:
      'L’URL de webhook est validée contre une liste blanche, puis le client HTTP suit les redirections sans revalider la destination.',
    goal: 'Faire atteindre au serveur une route d’administration sur sa propre boucle locale, et en obtenir l’effet.',
    file: 'server/routes/webhooks.ts',
    lessons: ['m03/l11', 'm15/l03'],
    hints: [
      'POST /api/webhooks/deliver refuse tout ce qui n’est pas dans sa liste blanche — et te la montre quand il refuse.',
      'Une des destinations autorisées est un relais, dont le métier est justement de rediriger. La liste blanche n’est évaluée qu’une fois, avant le premier saut.',
      'POST /api/webhooks/deliver {"url":"http://127.0.0.1:4317/api/webhooks/relay?to=http%3A%2F%2F127.0.0.1%3A4317%2Fapi%2Finternal%2Frotate-keys"} — le serveur suit la redirection en y emportant son identité de maillage.',
    ],
    fix: 'Vérifier l’adresse **après chaque** résolution et chaque redirection, ou interdire les redirections. Une liste blanche évaluée une seule fois, au début, ne protège que la première requête.',
  },
  {
    id: 'graphql-batching', module: 'm03', title: 'GraphQL : force brute par alias',
    status: 'live', kind: 'exploit', level: 2, csslp: ['D5'], cwe: 'CWE-307',
    brief:
      'Le code de validation est vérifié par une mutation GraphQL, et la limitation de débit compte les requêtes HTTP.',
    goal: 'Tester des milliers de codes en une seule requête HTTP.',
    file: 'server/routes/graphql.ts',
    lessons: ['m03/l03', 'm10/l03'],
    hints: [
      'La mutation `verifyCode(code: "0000") { ok }` répond ok:"true" ou ok:"false". Le code fait quatre chiffres, et il est tiré au démarrage du lab.',
      'La limite de débit refuse au bout de quelques dizaines de requêtes HTTP. Combien d’opérations peut contenir UNE requête ?',
      'Un alias par candidat : `mutation{ a0:verifyCode(code:"0000"){ok} a1:verifyCode(code:"0001"){ok} … }` — dix mille alias dans un seul POST.',
    ],
    fix: 'Compter les opérations, pas les requêtes : désactiver le batching sur les mutations sensibles et limiter par compte. Une limite qui compte la mauvaise unité ne limite rien.',
  },

  // ─── M4 · Sécurité du navigateur ──────────────────────────────────────────
  {
    id: 'react-javascript-url', module: 'm04', title: 'URL javascript: rendue par React',
    status: 'live', kind: 'exploit', level: 1, csslp: ['D5'], cwe: 'CWE-79', k: [11],
    brief:
      'Le lien de paiement d’une facture est rendu dans un attribut `href`. React échappe le HTML, pas les URL.',
    goal: 'Exécuter du script dans la session d’un autre utilisateur qui ouvre la facture.',
    file: 'src/pages/InvoiceDetail.tsx',
    lessons: ['m04/l05', 'm02/l06'],
    hints: [
      'La page de facture affiche « Payer cette facture en ligne ». D’où vient l’URL de ce lien ?',
      'Le paramètre `pay` du fragment la remplace : #/invoices/INV-1001?pay=… — et aucun schéma n’est validé.',
      'Ouvre #/invoices/INV-1001?pay=javascript:fetch(\'/api/surface/beacon?ex=react-javascript-url%26scheme=javascript\') puis clique sur le lien.',
    ],
    fix: 'Valider le schéma de l’URL à la construction (`http:`/`https:` seulement, via `new URL`), pas à l’affichage. React protège du HTML injecté et le dit — il n’a jamais prétendu protéger des URL.',
  },
  {
    id: 'client-proto-pollution', module: 'm04', title: 'Pollution de prototype côté client',
    status: 'live', kind: 'exploit', level: 3, csslp: ['D5'], cwe: 'CWE-1321', k: [8],
    brief:
      'Les préférences d’affichage lues dans le fragment d’URL sont fusionnées par un `deepMerge` maison qui accepte les clés spéciales.',
    goal: 'Faire rendre par l’application un attribut d’événement qu’aucun champ de données ne permet, et exécuter du script.',
    file: 'src/api.ts',
    lessons: ['m04/l05', 'm03/l12'],
    hints: [
      'Le paramètre `prefs` du fragment est un objet JSON, fusionné récursivement dans un objet du module. Le bandeau de la facture lit ses attributs dans ces préférences — par une clé qu’il ne possède pas.',
      'React recopie dans le DOM les propriétés qu’on lui passe. Laquelle accepte du HTML brut, et donc un attribut d’événement ?',
      'Ouvre #/invoices/INV-1001?prefs={"__proto__":{"banner":{"dangerouslySetInnerHTML":{"__html":"<img src=x onerror=\\"fetch(\'/api/surface/beacon?ex=client-proto-pollution&gadget=proto\')\\">"}}}} (pense à encoder l’URL).',
    ],
    fix: 'Même correctif que côté serveur — objets sans prototype, clés refusées, schéma — plus une deuxième barrière : Trusted Types, qui transforme le passage par un puits DOM en erreur d’exécution. Recherche BlackFan sur les gadgets clients.',
  },
  {
    id: 'dom-clobbering', module: 'm04', title: 'DOM clobbering sur la configuration',
    status: 'live', kind: 'exploit', level: 3, csslp: ['D5'], cwe: 'CWE-1321',
    brief:
      'L’assainisseur des notes conserve les attributs `id` et `name`, et le code lit une configuration globale sans l’avoir déclarée.',
    goal: 'Détourner les appels d’API de l’application vers une origine que tu contrôles.',
    file: 'src/api.ts',
    lessons: ['m04/l05', 'm03/l12'],
    hints: [
      'Le client HTTP construit ses URL à partir d’une valeur qu’il lit sur `window` — et que personne n’a jamais écrite.',
      'Le DOM écrit dans l’espace global : tout élément porteur d’un `id` y crée une variable. Deux éléments de même `id` forment une collection, indexable par le `name` de ses membres — et une ancre se convertit en chaîne par son `href`.',
      'Enregistre comme note de facture : <a id="novafactConfig"></a><a id="novafactConfig" name="apiBase" href="/api/surface/collect"></a> puis recharge la liste des factures.',
    ],
    fix: 'Déclarer ses variables (`const config = …`) plutôt que de les lire sur `window`, et retirer `id`/`name` de l’assainissement. Le DOM écrit dans l’espace global : tout élément nommé devient une variable.',
  },
  {
    id: 'postmessage-origin', module: 'm04', title: 'postMessage sans contrôle d’origine',
    status: 'live', kind: 'exploit', level: 2, csslp: ['D4', 'D5'], cwe: 'CWE-346',
    brief:
      'Le récepteur de messages de la page de paiement accepte tout message dont la forme ressemble à une confirmation, sans vérifier son origine.',
    goal: 'Faire passer une facture à l’état payé depuis une page d’une autre origine.',
    file: 'src/pages/Checkout.tsx',
    lessons: ['m04/l06', 'm03/l12'],
    hints: [
      'La page /checkout écoute les messages. Quelle condition vérifie-t-elle avant d’agir ?',
      'Rien sur `event.origin` : seule la forme du message compte. Une page qui ouvre /checkout garde une référence sur la fenêtre.',
      'Depuis une page servie sur une autre origine : w = open(\'http://127.0.0.1:5199/#/checkout\'), puis w.postMessage({type:\'novafact-payment\',invoice:\'INV-1001\',status:\'paid\'}, \'*\').',
    ],
    fix: 'Vérifier `event.origin` contre une liste d’origines attendues, et le contenu contre un schéma. Un message n’est pas une preuve de paiement : la confirmation vient du serveur du prestataire, par webhook signé.',
  },
  {
    id: 'referrer-leak', module: 'm04', title: 'Fuite par l’en-tête Referer',
    status: 'live', kind: 'exploit', level: 1, csslp: ['D5'], cwe: 'CWE-200',
    brief:
      'Le lien public de facture porte son jeton dans le chemin, et la page ne déclare aucune politique de référent.',
    goal: 'Retrouver un jeton d’accès à une facture dans les journaux d’un service tiers chargé par la page.',
    file: 'server/index.ts',
    lessons: ['m04/l06', 'm09/l02'],
    hints: [
      'GET /api/surface/share?invoice=INV-1001 fabrique un lien public. Regarde où le jeton est placé dans l’URL.',
      'La page publique charge un pixel de mesure d’audience. Quel en-tête le navigateur envoie-t-il avec cette requête, et que contient-il ?',
      'Ouvre le lien public dans le navigateur : le pixel /api/telemetry/pixel.gif reçoit l’URL complète, jeton compris, dans son `Referer`.',
    ],
    fix: '`Referrer-Policy: strict-origin-when-cross-origin` au minimum, et surtout aucun secret dans une URL : une URL part en `Referer`, dans les journaux, dans l’historique et dans le presse-papier.',
  },
  {
    id: 'csp-nonce-reuse', module: 'm04', title: 'Nonce de CSP réutilisé',
    status: 'live', kind: 'exploit', level: 2, csslp: ['D5'], cwe: 'CWE-330', k: [5],
    brief: 'Le nonce est une constante du build au lieu d’être tiré à chaque réponse.',
    goal: 'Faire exécuter un script inline injecté malgré une CSP active et apparemment stricte.',
    file: 'server/index.ts',
    lessons: ['m04/l04', 'm03/l12'],
    hints: [
      'Lis l’en-tête Content-Security-Policy de deux réponses différentes, et compare.',
      'Le nonce ne change pas. Un nonce constant est un `unsafe-inline` qui se cache : il suffit de le recopier dans le script injecté.',
      'Mets dans la note d’une facture <script nonce="…le nonce de l’en-tête…">fetch(\'/api/surface/beacon?ex=csp-nonce-reuse&nonce=…le même…\')</script>, partage la facture (GET /api/surface/share) et ouvre le lien public.',
    ],
    fix: 'Un nonce est un nombre utilisé une fois : tiré par réponse, depuis un générateur cryptographique. Un nonce constant est un `unsafe-inline` qui se cache. C’est l’un des contournements les plus fréquents des CSP « strictes ».',
  },
  {
    id: 'csp-gadget', module: 'm04', title: 'Gadget dans une origine autorisée',
    status: 'live', kind: 'exploit', level: 3, csslp: ['D5'], cwe: 'CWE-693',
    brief:
      'La CSP autorise en bloc le répertoire de bibliothèques servi localement, dont l’une exécute ce qu’elle lit dans des attributs de données.',
    goal: 'Exécuter du script arbitraire sans charger un seul fichier hors de la liste autorisée.',
    file: 'server/index.ts',
    lessons: ['m04/l04', 'm03/l12'],
    hints: [
      'La directive script-src autorise un répertoire entier : /api/vendor/. Va voir ce qu’il contient.',
      '/api/vendor/legacy-widget.js exécute le contenu de l’attribut data-lab-action de tout élément de la page. La CSP conserve aussi `unsafe-eval`.',
      'Dans la note d’une facture : <script src="/api/vendor/legacy-widget.js"></script><div data-lab-action="fetch(\'/api/surface/beacon?ex=csp-gadget\')"></div>, puis ouvre le lien public de la facture.',
    ],
    fix: 'Une liste blanche d’origines ne vaut que ce que valent les fichiers qu’elle couvre : `strict-dynamic` avec nonce, plutôt que des chemins autorisés en bloc. Recherche Google/Securitum sur les gadgets d’allowlist.',
  },
  {
    id: 'trusted-types-default', module: 'm04', title: 'Trusted Types en trompe-l’œil',
    status: 'live', kind: 'exploit', level: 3, csslp: ['D5'], cwe: 'CWE-693',
    brief: 'Trusted Types est exigé par la CSP, mais la politique par défaut renvoie la chaîne d’entrée telle quelle.',
    goal: 'Réussir une XSS dans un puits DOM alors que Trusted Types est déclaré actif.',
    file: 'src/main.tsx',
    lessons: ['m04/l05', 'm03/l12'],
    hints: [
      'L’en-tête annonce `require-trusted-types-for \'script\'`. L’aperçu imprimable d’une facture écrit pourtant dans innerHTML — par quelle politique passe-t-il ?',
      'La politique `default` de src/main.tsx rend son entrée telle quelle. Elle ne refuse rien, elle ne nettoie rien : elle signe.',
      'Ouvre #/invoices/INV-1001?preview=<img src=x onerror="fetch(\'/api/surface/beacon?ex=trusted-types-default%26policy=default\')"> (encodé).',
    ],
    fix: 'La politique par défaut est le dernier recours, pas le passe-droit : elle assainit ou elle jette. Une politique qui rend l’identité désactive le mécanisme tout en le laissant visible dans les en-têtes — le pire des deux mondes.',
  },
  {
    id: 'clickjacking-prefilled', module: 'm04', title: 'Clickjacking sur les coordonnées bancaires',
    status: 'live', kind: 'exploit', level: 2, csslp: ['D4', 'D5'], cwe: 'CWE-1021',
    brief: 'La page des coordonnées bancaires est encadrable et accepte des valeurs pré-remplies par l’URL.',
    goal: 'Faire enregistrer à un utilisateur connecté un IBAN que tu as choisi, en deux clics sur ta page.',
    file: 'server/index.ts',
    lessons: ['m04/l06', 'm10/l05'],
    hints: [
      'Pose le cookie de la surface (GET /api/surface/login?token=<jwt>), puis ouvre /api/billing?iban=FR76… : le champ est déjà rempli.',
      'Aucune directive frame-ancestors, aucun X-Frame-Options : la page s’encadre. Il ne reste qu’à amener la victime à cliquer sur « Enregistrer » sans le savoir.',
      'Depuis une page d’une autre origine : <iframe src="http://127.0.0.1:4317/api/billing?iban=FR7699999999999999999999999"> en opacité nulle sous un bouton leurre, puis fais cliquer.',
    ],
    fix: '`frame-ancestors \'none\'`, et pas de pré-remplissage d’un champ sensible depuis l’URL. Les actions irréversibles demandent une confirmation qui ne peut pas être obtenue par un clic aveugle — ressaisie, ou second facteur.',
  },
  {
    id: 'samesite-method-override', module: 'm04', title: 'SameSite contourné par surcharge de méthode',
    status: 'live', kind: 'exploit', level: 2, csslp: ['D5'], cwe: 'CWE-352',
    brief: 'Un intergiciel de surcharge de méthode est monté globalement : une navigation de premier niveau exécute une mutation.',
    goal: 'Modifier les coordonnées bancaires d’un utilisateur connecté depuis un simple lien sur un site tiers.',
    file: 'server/index.ts',
    lessons: ['m04/l06', 'm02/l06'],
    hints: [
      'La mutation des coordonnées bancaires se fait en POST. Une navigation, elle, est un GET — et `SameSite=Lax` ne protège que grâce à cette différence.',
      'Un intergiciel monté globalement accepte de changer la méthode d’après un paramètre de l’URL. Cherche `_method`.',
      'Un simple lien suffit : GET /api/billing/iban?_method=POST&iban=FR7600000000000000000000000, cookie de session en place.',
    ],
    fix: 'Retirer la surcharge de méthode, ou ne jamais l’appliquer aux requêtes en `GET`. `SameSite=Lax` protège les mutations parce qu’elles sont censées ne pas être des navigations — l’hypothèse doit rester vraie.',
  },
  {
    id: 'cors-origin-reflection', module: 'm04', title: 'CORS : origine reflétée avec identifiants',
    status: 'live', kind: 'exploit', level: 1, csslp: ['D5'], cwe: 'CWE-942',
    brief: 'L’en-tête d’origine autorisée est recopié depuis la requête, accompagné de l’autorisation d’envoyer les identifiants.',
    goal: 'Lire les factures d’un utilisateur connecté depuis une page servie sur une autre origine.',
    file: 'server/index.ts',
    lessons: ['m04/l06', 'm17/l05'],
    hints: [
      'Envoie une requête authentifiée avec un en-tête `Origin` quelconque, et regarde les en-têtes de la réponse.',
      '`Access-Control-Allow-Origin` reprend mot pour mot ce que tu as envoyé, et `Access-Control-Allow-Credentials: true` l’accompagne. Le navigateur laissera donc la page lire la réponse.',
      'curl -s -D- http://127.0.0.1:4317/api/invoices -H "Origin: http://evil.example" -H "Authorization: Bearer <ton jeton>".',
    ],
    fix: 'Liste blanche d’origines explicite, comparée par égalité. Refléter l’origine avec `Allow-Credentials` revient à désactiver la politique de même origine pour tout le monde.',
  },
  {
    id: 'cors-null-origin', module: 'm04', title: 'CORS : origine null autorisée',
    status: 'live', kind: 'exploit', level: 2, csslp: ['D5'], cwe: 'CWE-942',
    brief: 'La liste des origines autorisées contient `null`, « pour laisser passer les outils locaux ».',
    goal: 'Lire la même API depuis une iframe en bac à sable, dont l’origine est justement `null`.',
    file: 'server/index.ts',
    lessons: ['m04/l06', 'm03/l12'],
    hints: [
      'Regarde la liste d’origines autorisées : une entrée n’est l’origine de personne en particulier.',
      'Une iframe `sandbox` sans `allow-same-origin`, un document `data:` ou une redirection produisent tous l’origine `null`.',
      'curl -s -D- http://127.0.0.1:4317/api/invoices -H "Origin: null" -H "Authorization: Bearer <ton jeton>" — ou, dans un navigateur, la même requête depuis une iframe sandbox.',
    ],
    fix: '`null` n’est pas une origine de confiance : n’importe qui peut la produire avec une iframe `sandbox` ou une redirection. Aucune exception de confort dans une liste d’origines.',
  },
  {
    id: 'xsleak-frame-count', module: 'm04', title: 'XS-Leak par comptage de cadres',
    status: 'live', kind: 'exploit', level: 3, csslp: ['D5'], cwe: 'CWE-200',
    brief:
      'La recherche de clients rend un nombre de cadres proportionnel au nombre de résultats, et la page n’a ni isolation d’origine ni restriction d’encadrement.',
    goal: 'Déterminer, depuis une page tierce, si le tenant de la victime possède une facture pour un client donné.',
    file: 'server/index.ts',
    lessons: ['m04/l06', 'm03/l12'],
    hints: [
      'GET /api/surface/clients?q=… rend une iframe par résultat. Combien en rend-elle quand il n’y a rien ?',
      'Aucun `Cross-Origin-Opener-Policy` : la fenêtre ouverte reste accessible à celle qui l’a ouverte. `win.frames.length` se lit à travers les origines.',
      'Depuis une page tierce : w = open(\'http://127.0.0.1:4317/api/surface/clients?q=Dupont\'), puis lis w.frames.length après le chargement.',
    ],
    fix: 'COOP, CORP et `frame-ancestors` ferment la plupart des canaux d’observation ; le reste se traite en rendant les réponses indiscernables. Les XS-Leaks fuient par des effets de bord, pas par le contenu — xsleaks.dev en tient le catalogue.',
  },
  {
    id: 'xsleak-error-events', module: 'm04', title: 'XS-Leak par événements d’erreur',
    status: 'live', kind: 'exploit', level: 3, csslp: ['D5'], cwe: 'CWE-200',
    brief: 'L’API répond différemment selon que la ressource existe ou non, sans politique de ressource inter-origines.',
    goal: 'Déterminer depuis une origine tierce l’existence d’une facture d’un autre tenant.',
    file: 'server/index.ts',
    lessons: ['m04/l06', 'm03/l12'],
    hints: [
      'GET /api/surface/invoice-asset/INV-1003 renvoie une image quand la facture existe, une erreur sinon.',
      'Aucun `Cross-Origin-Resource-Policy` : une page tierce peut charger la ressource en <img> et écouter onload / onerror. Le contenu ne l’intéresse pas — seule l’issue compte.',
      'Depuis une page d’une autre origine : i = new Image(); i.onload = () => dire(\'existe\'); i.src = \'http://127.0.0.1:4317/api/surface/invoice-asset/INV-1003\'.',
    ],
    fix: '`Cross-Origin-Resource-Policy: same-origin`, et des réponses uniformes : même code, même taille, même temps, que la ressource existe ou non. L’existence d’une ressource est elle-même une information.',
  },
  {
    id: 'clickjacking', module: 'm04', title: 'Validation de paiement encadrable',
    status: 'live', kind: 'exploit', level: 1, csslp: ['D4', 'D5'], cwe: 'CWE-1021',
    brief: 'Rien n’empêche la page de paiement d’être chargée dans une iframe sur un site tiers.',
    goal: 'Faire valider un paiement par un utilisateur qui croit cliquer ailleurs.',
    file: 'server/index.ts',
    lessons: ['m04/l06', 'm17/l05'],
    hints: [
      'Regarde les en-têtes de GET /api/pay/confirm : quelle directive manque à la CSP ?',
      'Ni `frame-ancestors`, ni `X-Frame-Options` : la page s’encadre depuis n’importe où, et son bouton se clique.',
      'Depuis une page d’une autre origine : <iframe src="http://127.0.0.1:4317/api/pay/confirm"> superposée à un leurre, puis fais cliquer sur « Valider le paiement ».',
    ],
    fix: '`frame-ancestors \'none\'` dans la CSP — et rien d’autre : `X-Frame-Options` est un héritage, pas une défense à concevoir aujourd’hui.',
  },
  {
    id: 'secret-in-bundle', module: 'm04', title: 'Secret livré dans le bundle',
    status: 'live', kind: 'exploit', level: 1, csslp: ['D5', 'D7'], cwe: 'CWE-615',
    brief: 'Une clé d’API est exposée côté client par une variable d’environnement publique, et les source maps sont publiées.',
    goal: 'Récupérer une clé d’API utilisable en lisant ce que le navigateur télécharge.',
    file: 'src/api.ts',
    lessons: ['m04/l01', 'm13/l07'],
    hints: [
      'Ouvre l’onglet réseau sur /checkout : une requête part vers /api/surface/analytics avec un en-tête qui n’est pas un jeton de session.',
      'La valeur de cet en-tête est écrite en clair dans le bundle JavaScript — cherche `nvf_live_pk_` dans les sources servies au navigateur.',
      'Rejoue-la hors du navigateur : curl -s http://127.0.0.1:4317/api/surface/analytics -H "X-Novafact-Key: <la clé>".',
    ],
    fix: 'Le préfixe `VITE_` ou `NEXT_PUBLIC_` est une déclaration de publication. Ce qui exige un secret passe par le serveur. Source maps non publiées, et la clé se révoque — la retirer du code ne suffit pas.',
  },

  // ─── M17 · Exploitation et exposition ─────────────────────────────────────
  {
    id: 'debug-endpoint', module: 'm17', title: 'Endpoint de diagnostic laissé ouvert',
    status: 'live', kind: 'exploit', level: 1, csslp: ['D7'], cwe: 'CWE-489',
    brief: 'Une route de diagnostic, ajoutée pour une investigation, renvoie la configuration et les variables d’environnement.',
    goal: 'Récupérer la configuration complète du service, secrets compris, sans être authentifié.',
    file: 'server/index.ts',
    lessons: ['m17/l01', 'm13/l07'],
    hints: [
      'La documentation d’API ne liste pas toutes les routes montées. Les noms habituels des routes de diagnostic : /debug, /status, /config, /actuator…',
      'Elle n’est protégée par rien : ni session, ni rôle, ni restriction d’adresse.',
      'curl -s http://127.0.0.1:4317/api/debug/config — sans aucun jeton.',
    ],
    fix: 'Les fonctionnalités non documentées sont une surface : inventaire des routes réellement montées en production, et rien de diagnostique qui ne soit authentifié et tracé. Vérifier la documentation fait partie des tests de sécurité.',
  },
];

// Scénarios du jeu « Patch or Pwn » : quatre correctifs, un seul tient.
//
// Règle d'écriture : **les quatre correctifs doivent avoir l'air d'avoir été
// écrits par la même personne**. Un distracteur réduit à trois mots à côté d'un
// correctif détaillé se repère sans lire le code vulnérable. Chaque option porte
// donc un `code` réaliste et une intention défendable ; ce qui la disqualifie
// tient à ce qu'elle ne couvre pas — un contournement, un périmètre, une couche.
//
// `npm run games` vérifie que le bon correctif n'est pas le plus long.

export interface PatchOption { label: string; code?: string; holds: boolean; why: string }
export interface PatchScenario { title: string; module: string; context: string; lang: string; vulnerable: string; options: PatchOption[] }

export const patchScenarios: PatchScenario[] = [
  {
    title: 'Lien « Site web » d’un client', module: 'm02', lang: 'tsx',
    context: 'Le champ website est saisi librement par le client puis rendu dans la fiche.',
    vulnerable: `<a href={client.website}>Site web</a>`,
    options: [
      { label: 'Refuser les schémas dangereux connus : javascript, data, vbscript', code: `DANGEROUS.some((s) => u.trim().toLowerCase().startsWith(s))`, holds: false, why: 'Liste noire, donc une course sans fin : un caractère de contrôle avant le schéma, une tabulation au milieu de « java\\tscript: », ou un schéma qu’on n’a pas listé. Le navigateur normalise avant d’interpréter, ta comparaison non.' },
      { label: 'Encoder la valeur avec encodeURI avant de la poser dans href', code: `href={encodeURI(client.website)}`, holds: false, why: 'encodeURI laisse les deux-points intacts parce qu’ils sont structurels dans une URL : javascript:alert(1) en ressort identique. L’encodage traite le contenu, pas le schéma qui décide de ce que le navigateur fera.' },
      { label: 'Liste blanche de schémas, sur l’URL analysée', code: `['http:', 'https:'].includes(new URL(u).protocol)`, holds: true, why: 'C’est le parser du navigateur qui donne le protocole, donc la même normalisation que celle qui s’appliquera au clic. La liste est fermée : ce qui n’y est pas est refusé, sans avoir à prévoir les schémas de demain.' },
      { label: 'Ajouter rel="noopener noreferrer" et target="_blank"', code: `<a href={client.website} rel="noopener noreferrer" target="_blank">`, holds: false, why: 'Ces attributs coupent l’accès à window.opener et la fuite de référent : de bons réflexes pour un lien externe, et sans effet ici. Une URL javascript: s’exécute dans la page qui la porte, pas dans l’onglet ouvert.' },
    ],
  },
  {
    title: 'Téléchargement de pièce jointe', module: 'm02', lang: 'ts',
    context: 'Le nom du fichier vient de l’URL.',
    vulnerable: `res.sendFile(path.join(UPLOADS, req.params.name));`,
    options: [
      { label: 'Normaliser le chemin puis retirer les séquences de remontée', code: `path.normalize(name).replaceAll('../', '').replaceAll('..\\\\', '')`, holds: false, why: 'Un remplacement en une passe se contourne par imbrication : « ....// » perd son « ../ » du milieu et redevient « ../ ». Et normalize ne connaît pas les encodages que la couche HTTP a déjà décodés.' },
      { label: 'Refuser tout nom qui ne correspond pas à /^[\\w.-]+\\.pdf$/', code: `if (!/^[\\w.-]+\\.pdf$/.test(name)) return res.sendStatus(400)`, holds: false, why: 'Bien meilleur que la liste noire, et le point reste autorisé : « ..pdf » passe, et surtout le motif ne dit rien du chemin final. On valide la forme du nom au lieu de contrôler l’endroit où il mène.' },
      { label: 'Résoudre le chemin et exiger qu’il reste sous la racine', code: `const t = path.resolve(base, name);\nif (!t.startsWith(base + path.sep)) throw new Error()`, holds: true, why: 'On contrôle le résultat de la résolution, c’est-à-dire le fichier qui sera réellement ouvert, quelles que soient les astuces employées pour y arriver. Encore mieux : un identifiant généré à la place d’un nom fourni.' },
      { label: 'Encoder le nom avec encodeURIComponent avant de le joindre', code: `res.sendFile(path.join(UPLOADS, encodeURIComponent(name)))`, holds: false, why: 'Express a déjà décodé le paramètre : ré-encoder ici produit « %2E%2E%2F » comme nom de fichier littéral, qui n’existe pas. Les téléchargements légitimes avec un accent cassent, et la cause n’est pas traitée.' },
    ],
  },
  {
    title: 'Connexion avec MongoDB', module: 'm02', lang: 'ts',
    context: 'Le corps JSON est passé au filtre Mongo.',
    vulnerable: `users.findOne({ email: req.body.email })`,
    options: [
      { label: 'Refuser récursivement toute clé commençant par « $ » ou contenant un point', code: `if (hasOperatorKey(req.body)) return res.sendStatus(400)`, holds: false, why: 'C’est la version sérieuse de la liste noire, et elle tient contre $ne comme contre $gt. Mais elle vit à côté du typage : un tableau reste un tableau, et il suffit d’une route qui oublie d’appeler le garde pour tout rouvrir.' },
      { label: 'Valider le corps par un schéma strict', code: `z.object({ email: z.string().email().max(254) }).strict().parse(req.body)`, holds: true, why: 'Après validation, email est une chaîne — un objet ne peut plus prendre sa place, quel que soit l’opérateur imaginé. Et .strict() refuse les champs inconnus : la classe entière disparaît, pour cette route et les suivantes.' },
      { label: 'Forcer la conversion en chaîne avec un gabarit littéral', code: 'users.findOne({ email: `${req.body.email}` })', holds: false, why: 'Le champ est effectivement neutralisé, et un objet devient « [object Object] », ce qui ne trouve rien. Mais c’est un correctif d’une ligne pour un champ : la route voisine, écrite le mois prochain, repartira de zéro.' },
      { label: 'Limiter les tentatives à 5 par minute et par adresse IP', code: `app.use('/api/auth/login', rateLimit({ windowMs: 60_000, limit: 5 }))`, holds: false, why: 'Utile contre le bourrage d’identifiants, et sans rapport avec celui-ci : l’injection d’opérateur réussit du premier coup. Cinq tentatives suffisent largement à extraire un compte avec un $regex bien choisi.' },
    ],
  },
  {
    title: 'Signature des webhooks entrants', module: 'm02', lang: 'ts',
    context: 'Novafact reçoit des webhooks signés par HMAC de son prestataire de paiement.',
    vulnerable: `if (req.get('x-signature') === hmac(secret, req.body)) accept();`,
    options: [
      { label: 'Comparer les deux empreintes en minuscules après normalisation', code: `sig.trim().toLowerCase() === expected.toLowerCase()`, holds: false, why: 'Ça règle un vrai problème d’interopérabilité — les prestataires n’ont pas tous la même casse hexadécimale. Les deux autres défauts restent : la comparaison s’arrête au premier octet qui diffère, et elle porte sur un corps re-sérialisé.' },
      { label: 'Comparer en temps constant, sur le corps brut', code: `timingSafeEqual(Buffer.from(sig, 'hex'), hmacRaw(secret, rawBody))`, holds: true, why: 'Le temps de comparaison ne dépend plus du nombre d’octets justes, donc la signature ne se devine plus caractère par caractère. Et le HMAC porte sur les octets reçus : express.json réordonne les clés, ce qui change l’empreinte.' },
      { label: 'Ajouter un horodatage et refuser les requêtes de plus de 5 minutes', code: `if (Math.abs(now - Number(req.get('x-timestamp'))) > 300_000) reject()`, holds: false, why: 'La fenêtre anti-rejeu est une vraie mesure, et elle vient après la signature dans l’ordre d’importance. Si la signature se contourne, l’horodatage se fabrique avec : on protège un webhook qu’on n’a pas authentifié.' },
      { label: 'Restreindre la route aux plages d’adresses IP du prestataire', code: `if (!PROVIDER_CIDRS.some((c) => inRange(req.ip, c))) reject()`, holds: false, why: 'Une défense en profondeur acceptable, avec le coût d’exploitation qu’on connaît : ces plages changent sans préavis et la liste finit périmée. Elle ne dit d’ailleurs rien du contenu, qu’un tiers hébergé chez le même fournisseur peut forger.' },
    ],
  },
  {
    title: 'Lien de réinitialisation de mot de passe', module: 'm09', lang: 'ts',
    context: 'Le lien envoyé par e-mail est construit à partir de l’en-tête Host.',
    vulnerable: `const link = \`https://\${req.get('host')}/reset?token=\${t}\`;`,
    options: [
      { label: 'Utiliser req.hostname, qui est la valeur normalisée par Express', code: `const link = \`https://\${req.hostname}/reset?token=\${t}\``, holds: false, why: 'req.hostname est bien la version propre de l’en-tête, et sa source est la même : la requête. Pire, avec trust proxy activé il lit X-Forwarded-Host, un en-tête que n’importe qui peut poser.' },
      { label: 'Construire le lien à partir d’APP_URL', code: `new URL(\`/reset?token=\${t}\`, APP_URL).toString()`, holds: true, why: 'L’origine de l’application est un fait de déploiement, pas une donnée de requête : elle ne change pas parce qu’un attaquant l’a demandé. C’est la seule option où le lien envoyé ne dépend plus de qui a cliqué.' },
      { label: 'Vérifier que l’en-tête Host figure dans la liste des domaines servis', code: `if (!ALLOWED_HOSTS.includes(req.get('host'))) return res.sendStatus(400)`, holds: false, why: 'La liste blanche referme vraiment le trou, et c’est le bon réflexe pour le routage multi-domaine. Elle reste une validation d’entrée là où il n’y a aucune raison d’en accepter une : la valeur est déjà connue du serveur.' },
      { label: 'Ramener la durée de vie du jeton de 24 heures à 10 minutes', code: `signResetToken(user, { expiresIn: '10m' })`, holds: false, why: 'Une bonne mesure en soi, à garder dans tous les cas. Mais dix minutes suffisent très largement à un script qui attend la requête qu’il a lui-même déclenchée : le jeton part toujours vers le domaine de l’attaquant.' },
    ],
  },
  {
    title: 'Coupon à usage limité', module: 'm03', lang: 'ts',
    context: 'Un coupon est limité à 100 utilisations. L’API tourne sur trois instances ECS.',
    vulnerable: `if (coupon.used < coupon.max) await incrementUsed(coupon.id);`,
    options: [
      { label: 'Sérialiser l’accès par un mutex en mémoire autour du bloc', code: `await mutex.runExclusive(async () => { … })`, holds: false, why: 'Correct sur une instance, et c’est précisément le piège : en développement, avec un seul processus, le défaut disparaît complètement. Les deux autres tâches ECS ne connaissent pas ce verrou et entrent en même temps.' },
      { label: 'Mise à jour conditionnelle atomique', code: `UPDATE coupon SET used = used + 1 WHERE id = $1 AND used < max`, holds: true, why: 'La vérification et l’écriture deviennent une seule opération, arbitrée par la base — le seul point que les trois instances partagent. Zéro ligne modifiée veut dire limite atteinte : la réponse est dans le résultat.' },
      { label: 'Relire le compteur juste avant l’incrément, dans la même fonction', code: `const fresh = await getCoupon(id);\nif (fresh.used >= fresh.max) return;`, holds: false, why: 'La fenêtre passe de quelques millisecondes à quelques microsecondes, donc le bug devient difficile à reproduire en test. C’est exactement ce que vise la single-packet attack, qui fait arriver les requêtes dans la même fenêtre.' },
      { label: 'Poser un verrou distribué dans Redis pendant la transaction', code: `await redlock.acquire([\`coupon:\${id}\`], 5_000)`, holds: false, why: 'Cette fois le verrou est bien partagé entre les instances, et ça marchera la plupart du temps. Mais l’invariant dépend maintenant de la disponibilité de Redis et d’une expiration bien choisie, alors que la base le garantit gratuitement.' },
    ],
  },
  {
    title: 'Vérification d’un JWT', module: 'm09', lang: 'ts',
    context: 'L’API reçoit des jetons signés en RS256 par le fournisseur d’identité.',
    vulnerable: `jwt.verify(token, keyFor(header.kid))`,
    options: [
      { label: 'Refuser les jetons dont l’en-tête annonce alg: none', code: `if (header.alg === 'none') return res.sendStatus(401)`, holds: false, why: 'Le cas le plus connu est fermé, et deux autres restent grands ouverts : rien n’empêche un jeton HS256 signé avec la clé publique, ni un kid qui pointe vers une clé que l’attaquant contrôle.' },
      { label: 'Fixer l’algorithme, la clé, l’émetteur et l’audience', code: `jwtVerify(token, JWKS, { algorithms: ['RS256'], issuer, audience })`, holds: true, why: 'Rien de ce que le jeton annonce ne décide plus de la façon dont il est vérifié : l’algorithme et la source des clés viennent du serveur. issuer et audience empêchent en prime de rejouer ici un jeton valide émis pour un autre service.' },
      { label: 'Accepter HS256 et RS256, le temps de migrer les anciens clients', code: `jwt.verify(token, key, { algorithms: ['HS256', 'RS256'] })`, holds: false, why: 'Une transition qu’on voit souvent, et c’est la définition même de la confusion d’algorithme : la clé publique RSA est connue de tous, et elle devient un secret HMAC valide. Le jeton se forge sans rien voler.' },
      { label: 'Ne charger les clés que depuis le JWKS du fournisseur, en cache', code: `const key = await jwks.getSigningKey(header.kid)`, holds: false, why: 'Le kid ne désigne plus une clé arbitraire, ce qui ferme le troisième chemin : bon point. La confusion RS256/HS256 reste possible tant que l’algorithme accepté vient de l’en-tête du jeton.' },
    ],
  },
  {
    title: 'Redirection après connexion', module: 'm09', lang: 'ts',
    context: 'Le paramètre next indique où renvoyer l’utilisateur après connexion.',
    vulnerable: `res.redirect(req.query.next ?? '/')`,
    options: [
      { label: 'Exiger que next commence par une barre oblique et pas deux', code: `if (!next.startsWith('/') || next.startsWith('//')) next = '/'`, holds: false, why: 'Les deux pièges connus sont couverts, et le navigateur en connaît d’autres : « /\\attacker.example » est traité comme un chemin réseau par plusieurs moteurs, et « /%09/attacker.example » selon la normalisation.' },
      { label: 'Résoudre next contre APP_URL et exiger la même origine', code: `new URL(next, APP_URL).origin === APP_URL.origin`, holds: true, why: 'On compare deux origines produites par le même analyseur que celui du navigateur, au lieu d’inspecter une chaîne. Toutes les variantes d’écriture se ramènent à la même origine, donc il n’y a plus de cas à prévoir.' },
      { label: 'Vérifier que next contient le domaine de Novafact', code: `if (!next.includes('novafact.example')) next = '/'`, holds: false, why: 'Le domaine apparaît bien dans la chaîne, mais pas forcément à la place qui compte : « https://attacker.example/?r=novafact.example » passe le test et redirige ailleurs. Chercher une sous-chaîne, c’est ignorer la grammaire des URL.' },
      { label: 'N’accepter qu’une clé de destination, traduite côté serveur', code: `res.redirect(DESTINATIONS[req.query.to] ?? '/')`, holds: false, why: 'Techniquement le plus sûr de tous — aucune URL ne vient du client. Ce n’est simplement plus le même correctif : les liens de reprise profonde cessent de fonctionner, et il faut réécrire tous les appelants.' },
    ],
  },
  {
    title: 'Aperçu de facture', module: 'm03', lang: 'ts',
    context: 'La page d’aperçu utilise EJS.',
    vulnerable: `res.render('invoice', req.query)`,
    options: [
      { label: 'Échapper toutes les valeurs de req.query avant le rendu', code: `res.render('invoice', mapValues(req.query, escapeHtml))`, holds: false, why: 'On traite les valeurs, et le danger est dans les clés : l’objet passé au rendu sert aussi à porter les options du moteur. Une clé bien choisie change le comportement d’EJS, quel que soit l’échappement de son contenu.' },
      { label: 'Construire un objet de vue explicite', code: `res.render('invoice', { invoice: toView(inv) })`, holds: true, why: 'Le moteur ne reçoit plus que les champs qu’on a nommés, à partir d’une facture déjà chargée et vérifiée. Ce n’est pas un filtre sur ce qui entre : la requête ne touche tout simplement plus le rendu.' },
      { label: 'Ne garder que les clés attendues de req.query', code: `res.render('invoice', pick(req.query, ['id', 'lang', 'format']))`, holds: false, why: 'Une liste blanche de clés, et c’est presque la bonne réponse : les options du moteur sont écartées. Mais ces trois valeurs restent contrôlées par le client et partent telles quelles dans la vue, sans être résolues contre la base.' },
      { label: 'Passer à Pug, dont la syntaxe n’interpole pas les options', code: `app.set('view engine', 'pug')`, holds: false, why: 'Changer de moteur déplace le problème : Pug a son propre jeu d’options locales, et surtout on continue de lui passer la requête. Une réécriture complète des gabarits pour ne rien corriger.' },
    ],
  },
  {
    title: 'Clé de cache CloudFront', module: 'm03', lang: 'ts',
    context: 'Des pages de compte ont été servies à d’autres utilisateurs depuis le cache.',
    vulnerable: `cachePolicy: CachePolicy.CACHING_OPTIMIZED // sur /*`,
    options: [
      { label: 'Réduire la durée de vie par défaut à dix secondes', code: `defaultTtl: Duration.seconds(10), maxTtl: Duration.seconds(30)`, holds: false, why: 'La fenêtre rétrécit sans se fermer, et dix secondes sont une éternité pour un script qui interroge l’URL en boucle. Le cache continue par ailleurs de servir à tout le monde une réponse calculée pour une seule session.' },
      { label: 'Ajouter le cookie de session à la clé de cache', code: `cookieBehavior: CacheCookieBehavior.allowList('sid')`, holds: false, why: 'Chaque session obtient bien son entrée, donc le symptôme disparaît. Le taux de succès du cache tombe à zéro sur ces pages, et la moindre variation de délimiteur d’URL recrée une entrée partagée entre deux sessions.' },
      { label: 'Ne cacher que les chemins statiques, l’origine déclarant le reste', code: `/assets/* → cache ; /* → CACHING_DISABLED + no-store`, holds: true, why: 'Le cache cesse de deviner ce qui est public à partir de l’extension, et l’origine énonce elle-même ce qui ne doit jamais être stocké. Les deux couches disent la même chose, donc un désaccord de délimiteur ne crée plus de trou.' },
      { label: 'Bloquer au WAF les URL de /account se terminant par .css', code: `waf: block /account/*.css`, holds: false, why: 'On ferme la forme exacte du rapport d’incident, pas la classe : le délimiteur suivant — un point-virgule, un %00, une autre extension — passe à côté de la règle. Et le WAF ne voit rien des réponses déjà en cache.' },
    ],
  },
];

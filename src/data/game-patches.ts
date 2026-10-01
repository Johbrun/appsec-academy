// Scénarios du jeu « Patch or Pwn » : quatre correctifs, un seul tient.
//
// Règle d'écriture : **les quatre correctifs doivent avoir l'air d'avoir été
// écrits par la même personne**. Un distracteur réduit à trois mots à côté d'un
// correctif détaillé se repère sans lire le code vulnérable. Chaque option porte
// donc un `code` réaliste et une intention défendable ; ce qui la disqualifie
// tient à ce qu'elle ne couvre pas — un contournement, un périmètre, une couche.
//
// `npm run games` vérifie que le bon correctif n'est pas le plus long.
//
// ── Les trois niveaux ────────────────────────────────────────────────────────
//
// La difficulté ne vient pas du sujet — une injection SQL n'est pas « plus dure »
// qu'une SSRF. Elle vient de la **distance entre le correctif qui semble bon et
// celui qui tient**, et du nombre de sauts à faire pour les départager.
//
//   N1 · Un seul correctif tient ; les trois autres échouent pour une raison
//        visible dès qu'on la nomme (liste noire, couche qui ne voit pas la
//        donnée, mesure hors sujet). On apprend la forme du bon geste.
//
//   N2 · Au moins **deux correctifs sérieux**, dont un se contourne par un
//        détail : il couvre le cas d'école mais laisse une variante, ou il
//        protège une instance et pas le déploiement. Il faut lire le contexte.
//
//   N3 · Le correctif qui **paraît le plus blindé** est justement contournable —
//        par normalisation, ordre des opérations, TOCTOU, double décodage,
//        confusion d'algorithme. Celui qui tient est plus sobre et déplace le
//        problème au lieu de le filtrer.
//
// Beaucoup de scénarios sont **ancrés dans un cas public** (`real`) : l'incident
// ou la CVE est nommé dans l'explication du bon correctif.

import { defineSeries, type SeriesProfile } from '../lib/series';

export type PatchLevel = 1 | 2 | 3;

export interface PatchOption { label: string; code?: string; holds: boolean; why: string }
export interface PatchScenario {
  /** Identifiant stable : il sert à composer les séries. */
  id: string;
  level: PatchLevel;
  title: string;
  module: string;
  context: string;
  lang: string;
  vulnerable: string;
  options: PatchOption[];
  /** Cas public dont s'inspire le scénario (nom, année) ; cité dans l'explication. */
  real?: string;
  /** Scénarios de même structure à ne pas réunir dans une série. */
  avoid?: string[];
}

export const patchScenarios: PatchScenario[] = [
  // ── N1 ─────────────────────────────────────────────────────────────────────
  {
    id: 'sql-concat', level: 1, title: 'Recherche de clients', module: 'm02', lang: 'ts',
    context: 'Le terme de recherche vient de la requête et part directement dans le SQL.',
    vulnerable: "db.query(`SELECT id, name FROM customers WHERE name LIKE '%${req.query.q}%'`)",
    options: [
      { label: 'Passer la valeur en paramètre lié, motif compris', code: "db.query('… WHERE name LIKE $1', [`%${q}%`])", holds: true, why: 'La valeur ne fait plus partie du texte de la requête : le pilote l’envoie séparément et la base ne l’interprète jamais comme du SQL. Le motif LIKE se construit autour du paramètre, pas dans la chaîne exécutée.' },
      { label: 'Doubler les apostrophes de la saisie avant de l’insérer', code: "const q = req.query.q.replaceAll(\"'\", \"''\")", holds: false, why: 'L’échappement manuel oublie toujours un cas : un antislash selon le moteur, une apostrophe déjà encodée, un commentaire. On refait à la main ce que le pilote fait sans faille.' },
      { label: 'Refuser la saisie si elle contient un mot-clé SQL', code: "if (/\\b(union|select|drop)\\b/i.test(q)) return res.sendStatus(400)", holds: false, why: 'La liste noire de mots-clés bloque les charges d’école et rien d’autre : une sous-requête, un encodage, un nom de client contenant « select » légitime passent ou cassent. On filtre le vocabulaire, pas la grammaire.' },
      { label: 'Tronquer la saisie à 64 caractères avant la requête', code: 'const q = String(req.query.q).slice(0, 64)', holds: false, why: 'Limiter la longueur réduit une charge utile, pas sa nature : une injection tient en bien moins de 64 caractères. La donnée reste concaténée dans le texte exécuté.' },
    ],
  },
  {
    id: 'command-exec', level: 1, title: 'Génération d’une miniature', module: 'm02', lang: 'ts',
    context: 'Le nom du fichier importé est passé à un utilitaire de conversion via le shell.',
    vulnerable: 'exec(`convert uploads/${name} -resize 200x thumbs/${name}`)',
    options: [
      { label: 'Appeler le binaire sans shell, arguments en tableau', code: "execFile('convert', [`uploads/${name}`, '-resize', '200x', out])", holds: true, why: 'Sans shell, il n’y a plus de métacaractères à interpréter : chaque argument est passé tel quel au programme, un point-virgule ou un $() reste une suite de lettres. La classe entière disparaît.' },
      { label: 'Échapper les caractères spéciaux du shell dans le nom', code: "const safe = name.replace(/[;&|`$()<>]/g, '\\\\$&')", holds: false, why: 'La liste des métacaractères à échapper dépend du shell et n’est jamais complète : sauts de ligne, expansion d’accolades, guillemets imbriqués. On sécurise une syntaxe qu’on ne maîtrise pas entièrement.' },
      { label: 'Entourer le nom de guillemets simples dans la commande', code: "exec(`convert 'uploads/${name}' -resize 200x '…'`)", holds: false, why: 'Les guillemets simples se referment : un nom contenant lui-même une apostrophe rouvre le contexte shell. Le quoting manuel se contourne dès qu’on peut injecter le délimiteur.' },
      { label: 'Vérifier que le fichier existe avant de convertir', code: 'if (!fs.existsSync(`uploads/${name}`)) return res.sendStatus(404)', holds: false, why: 'Le test d’existence ne dit rien de la dangerosité du nom, et il crée même une fenêtre : le fichier peut disparaître entre la vérification et l’appel. La commande reste construite par concaténation.' },
    ],
  },
  {
    id: 'dom-innerhtml', level: 1, title: 'Message de bienvenue', module: 'm04', lang: 'ts',
    context: 'Le prénom, lu depuis le profil, est inséré dans la page côté navigateur.',
    vulnerable: 'el.innerHTML = `Bonjour ${user.firstName}`;',
    options: [
      { label: 'Affecter le texte plutôt que le HTML', code: 'el.textContent = `Bonjour ${user.firstName}`;', holds: true, why: 'textContent traite la valeur comme du texte pur : le navigateur ne construit aucun nœud à partir d’elle, donc une balise reste des caractères affichés. On ne filtre pas le HTML, on n’en produit pas.' },
      { label: 'Retirer les balises script de la valeur', code: "const safe = name.replace(/<script.*?>.*?<\\/script>/gi, '')", holds: false, why: 'Le XSS ne passe pas que par <script> : un <img onerror>, un <svg onload>, un attribut suffisent. Filtrer une balise, c’est laisser toutes les autres.' },
      { label: 'Encoder les chevrons de la valeur', code: "const safe = name.replace(/</g, '&lt;').replace(/>/g, '&gt;')", holds: false, why: 'Cet encodage protège le contenu entre balises, mais innerHTML place ici la valeur là où un attribut ou un gestionnaire d’événement peut se glisser. L’échappement vise le mauvais contexte.' },
      { label: 'Limiter le prénom à 50 caractères', code: 'const safe = String(user.firstName).slice(0, 50)', holds: false, why: 'La longueur n’a aucun rapport avec l’exécution : une charge XSS tient largement dans 50 caractères. La valeur reste interprétée comme du HTML.' },
    ],
  },
  {
    id: 'password-hash', level: 1, title: 'Stockage des mots de passe', module: 'm08', lang: 'ts',
    real: 'LinkedIn 2012',
    context: 'À la création de compte, le mot de passe est haché avant d’être écrit en base.',
    vulnerable: "const hash = crypto.createHash('sha256').update(password).digest('hex');",
    options: [
      { label: 'Hacher avec un algorithme conçu pour les mots de passe', code: 'const hash = await argon2.hash(password) // ou bcrypt', holds: true, why: 'argon2 et bcrypt sont lents et salés par conception : chaque essai coûte cher à l’attaquant, et deux mots de passe identiques donnent deux empreintes. C’est la leçon de la fuite LinkedIn de 2012, où 6,5 millions de SHA-1 non salés ont été cassés en masse.' },
      { label: 'Ajouter un sel aléatoire au SHA-256', code: 'sha256(salt + password) // sel stocké à côté', holds: false, why: 'Le sel empêche les tables précalculées mais ne ralentit rien : un GPU teste des milliards de SHA-256 par seconde. Contre un mot de passe faible, le sel ne gagne que quelques minutes.' },
      { label: 'Appliquer le SHA-256 plusieurs milliers de fois', code: 'let h = password; for (let i = 0; i < 5000; i++) h = sha256(h)', holds: false, why: 'L’idée du coût répété est la bonne, mais un SHA-256 itéré maison n’a pas de sel, se parallélise très bien sur GPU et n’a pas la résistance mémoire d’argon2. Mieux vaut PBKDF2/scrypt/argon2 éprouvés qu’une boucle artisanale.' },
      { label: 'Chiffrer le mot de passe avec une clé du serveur', code: 'const enc = aesGcmEncrypt(password, SERVER_KEY)', holds: false, why: 'Le chiffrement est réversible : quiconque obtient la clé récupère tous les mots de passe en clair. On doit stocker une empreinte à sens unique, pas un secret qu’une seule clé déverrouille.' },
    ],
  },
  {
    id: 'token-random', level: 1, title: 'Jeton de partage de facture', module: 'm02', lang: 'ts',
    context: 'Un lien public de partage est signé par un jeton généré à la volée.',
    vulnerable: "const token = Math.random().toString(36).slice(2);",
    options: [
      { label: 'Tirer le jeton d’un générateur cryptographique', code: "const token = crypto.randomBytes(32).toString('base64url')", holds: true, why: 'randomBytes puise dans le générateur du système d’exploitation, imprévisible par construction. Math.random est un PRNG rapide non cryptographique : son état se reconstitue à partir de quelques sorties, et les jetons suivants se prédisent.' },
      { label: 'Concaténer l’horodatage et un nombre aléatoire', code: "const token = Date.now() + '-' + Math.random()", holds: false, why: 'L’horodatage est devinable à la seconde près et Math.random reste prédictible : on additionne deux sources faibles sans en obtenir une forte. La surface à deviner ne grandit qu’en apparence.' },
      { label: 'Utiliser un UUID de version 1', code: "const token = uuidv1() // horodaté + adresse MAC", holds: false, why: 'L’UUIDv1 encode l’heure et l’adresse matérielle : il est unique mais non secret, deux jetons émis coup sur coup ne diffèrent que de quelques bits. Pour un secret, il faut de l’aléa, pas de l’unicité.' },
      { label: 'Allonger la sortie de Math.random', code: "const token = [0,0,0].map(() => Math.random()).join('')", holds: false, why: 'Empiler trois tirages du même générateur ne le rend pas imprévisible : ils partagent le même état interne, qui se reconstruit d’un seul coup. Un jeton plus long issu d’une source faible reste faible.' },
    ],
  },
  {
    id: 'cors-reflect', level: 1, title: 'CORS de l’API', module: 'm04', lang: 'ts',
    context: 'L’API renvoie des données de session et doit être appelée par le front avec cookies.',
    vulnerable: "res.set('Access-Control-Allow-Origin', req.get('origin'))",
    options: [
      { label: 'N’autoriser qu’une origine d’une liste connue', code: "if (ALLOWED.has(origin)) res.set('Access-Control-Allow-Origin', origin)", holds: true, why: 'Refléter l’origine reçue revient à tout autoriser : le navigateur voit sa propre origine renvoyée et laisse la réponse, cookies compris, être lue par n’importe quel site. Une liste fermée n’accorde l’accès qu’aux fronts qu’on a décidé de servir.' },
      { label: 'Mettre l’origine à l’étoile', code: "res.set('Access-Control-Allow-Origin', '*')", holds: false, why: 'L’étoile est incompatible avec les requêtes authentifiées : le navigateur refuse de renvoyer la réponse quand les identifiants sont inclus. Soit l’API cesse de fonctionner, soit on retire les cookies et on casse la session.' },
      { label: 'Accepter les origines se terminant par novafact.example', code: "if (origin.endsWith('novafact.example')) res.set(...)", holds: false, why: 'La vérification par suffixe se contourne : evil-novafact.example et novafact.example.attacker.com passent le test. On compare une chaîne au lieu de comparer une origine.' },
      { label: 'Ajouter Vary: Origin à la réponse', code: "res.set('Vary', 'Origin')", holds: false, why: 'Vary: Origin est nécessaire pour que les caches ne mélangent pas les réponses par origine, mais il n’autorise ni ne refuse personne. Le reflet de l’origine reste en place, donc le trou aussi.' },
    ],
  },
  {
    id: 'hardcoded-secret', level: 1, title: 'Clé d’accès au stockage', module: 'm14', lang: 'ts',
    real: 'Uber 2016, Toyota 2022',
    context: 'Le client S3 est initialisé dans le dépôt applicatif.',
    vulnerable: "const s3 = new S3({ accessKeyId: 'AKIA…', secretAccessKey: 'wJal…' });",
    options: [
      { label: 'Laisser le SDK résoudre un rôle, sans clé en dur', code: 'const s3 = new S3(); // rôle IAM de la tâche', holds: true, why: 'Une clé écrite dans le code finit dans l’historique Git pour toujours, même supprimée ensuite. Le SDK sait prendre les identifiants temporaires du rôle attaché à l’instance ou à la tâche : rien à stocker, rotation automatique. Uber (2016) et Toyota T-Connect (2017-2022) ont fuité par une clé restée dans un dépôt.' },
      { label: 'Charger la clé depuis une variable d’environnement', code: 'accessKeyId: process.env.AWS_ACCESS_KEY_ID', holds: false, why: 'Sortir la clé du code est un progrès, mais une clé statique reste une clé statique : elle traîne dans un fichier .env, dans la config CI, et il faut la faire tourner à la main. Un rôle sans clé long terme évite tout ça.' },
      { label: 'Encoder la clé en base64 dans le code', code: "const key = atob('QUtJQS4uLg==')", holds: false, why: 'Le base64 n’est pas du chiffrement : c’est un encodage réversible que tout scanner de secrets décode. La clé est toujours dans le dépôt, juste un peu moins lisible à l’œil nu.' },
      { label: 'Déplacer la clé dans un fichier config versionné', code: "import { awsKey } from './config/secrets'", holds: false, why: 'Le fichier reste dans le dépôt : on a seulement changé de ligne. Ajouter le chemin à .gitignore après coup ne retire pas la clé de l’historique déjà poussé.' },
    ],
  },
  {
    id: 'ssrf-fetch', level: 1, title: 'Import d’avatar par URL', module: 'm03', lang: 'ts',
    real: 'Capital One 2019',
    context: 'L’utilisateur fournit l’URL d’une image que le serveur va télécharger.',
    vulnerable: 'const img = await fetch(req.body.avatarUrl);',
    options: [
      { label: 'N’autoriser que des hôtes publics d’une liste, IMDS bloqué', code: "assertPublicHost(url); // refuse 169.254.169.254, IP privées", holds: true, why: 'Le serveur peut joindre des adresses que le client ne peut pas : le service de métadonnées à 169.254.169.254 rend les identifiants du rôle. C’est la chaîne de la brèche Capital One (2019) : SSRF → IMDS → clés IAM → S3. Il faut résoudre l’hôte et refuser tout ce qui n’est pas public.' },
      { label: 'Refuser les URL contenant « localhost » ou « 127.0.0.1 »', code: "if (/localhost|127\\.0\\.0\\.1/.test(url)) return res.sendStatus(400)", holds: false, why: 'La liste noire de chaînes rate presque tout : 169.254.169.254, 0.0.0.0, la notation décimale 2130706433, l’IPv6 [::1], un nom DNS qui résout en privé. On bloque deux écritures d’une infinité.' },
      { label: 'Bloquer la seule adresse du service de métadonnées', code: "if (url.includes('169.254.169.254')) return res.sendStatus(400)", holds: false, why: 'On ferme la cible la plus connue et on laisse tout le réseau interne : bases de données, services d’administration, autres instances. Et l’adresse elle-même s’écrit autrement pour contourner la comparaison littérale.' },
      { label: 'Forcer le schéma en HTTPS avant la requête', code: "if (!url.startsWith('https://')) return res.sendStatus(400)", holds: false, why: 'Le schéma ne dit rien de la destination : un service interne peut très bien répondre en HTTPS. On contraint la forme de l’URL sans limiter l’endroit où elle mène.' },
    ],
  },
  {
    id: 'node-serialize', level: 1, title: 'Reprise de panier', module: 'm03', lang: 'ts',
    real: 'CVE-2017-5941',
    context: 'Le panier est renvoyé au client dans un cookie, puis rechargé côté serveur.',
    vulnerable: "const cart = serialize.unserialize(req.cookies.cart);",
    options: [
      { label: 'Relire le panier avec un analyseur de données pur', code: 'const cart = JSON.parse(req.cookies.cart)', holds: true, why: 'unserialize de node-serialize reconstruit des fonctions : une charge en expression immédiatement invoquée s’exécute au décodage (CVE-2017-5941). JSON.parse ne produit que des données inertes, jamais de code. Le format qui porte du comportement doit disparaître.' },
      { label: 'Envelopper le décodage dans un try/catch', code: 'try { cart = serialize.unserialize(c) } catch { cart = [] }', holds: false, why: 'Le try/catch attrape une erreur, pas une exécution : la charge tourne pendant le décodage, avant qu’une exception soit levée. On journalise l’attaque après qu’elle a réussi.' },
      { label: 'Vérifier que le panier est bien un tableau ensuite', code: 'if (!Array.isArray(cart)) cart = []', holds: false, why: 'Le contrôle de type arrive trop tard : le code malveillant s’est déjà exécuté au moment du unserialize, la vérification ne fait que trier le résultat. Le mal est fait avant la ligne.' },
      { label: 'Signer le cookie pour détecter les modifications', code: 'if (!verifyHmac(raw, sig)) return res.sendStatus(400)', holds: false, why: 'Signer le cookie est utile mais règle un autre problème : ici on remplace un format dangereux, pas on authentifie une valeur. Et si la signature saute un jour, le unserialize reste une exécution de code.' },
    ],
  },
  {
    id: 'idor-findbyid', level: 1, title: 'Détail d’une facture', module: 'm03', lang: 'ts',
    context: 'La route lit une facture par son identifiant pour un utilisateur authentifié.',
    vulnerable: 'const invoice = await Invoice.findById(req.params.id);',
    options: [
      { label: 'Charger la facture en contraignant le tenant', code: 'Invoice.findOne({ _id: id, tenantId: tenantOf(req) })', holds: true, why: 'La requête elle-même refuse de rendre une facture d’un autre tenant : l’autorisation est dans la condition, pas dans un test après coup. Sans cela, changer l’identifiant dans l’URL suffit à lire la facture du voisin (BOLA).' },
      { label: 'Utiliser des identifiants aléatoires difficiles à deviner', code: 'invoiceId = crypto.randomUUID()', holds: false, why: 'Un identifiant imprévisible complique l’énumération mais n’est pas un contrôle d’accès : dès qu’il fuite dans un lien, un journal ou une référence, la facture reste lisible par n’importe qui. L’obscurité ne remplace pas l’autorisation.' },
      { label: 'Vérifier que l’identifiant est un ObjectId valide', code: 'if (!isValidObjectId(id)) return res.sendStatus(400)', holds: false, why: 'Valider le format évite une erreur de requête, pas un accès non autorisé : un ObjectId parfaitement valide peut désigner la facture d’un autre tenant. On filtre la forme, pas le droit.' },
      { label: 'Limiter le nombre de lectures par minute', code: "rateLimit({ windowMs: 60_000, limit: 60 })", holds: false, why: 'Le quota ralentit une énumération massive mais laisse chaque lecture ciblée réussir : un identifiant connu rend la facture du premier coup. La limite protège du volume, pas de l’accès lui-même.' },
    ],
  },
  {
    id: 'xxe-parser', level: 1, title: 'Import de factures XML', module: 'm02', lang: 'ts',
    context: 'Un lot de factures est envoyé au format XML puis analysé côté serveur.',
    vulnerable: 'const doc = new DOMParser().parseFromString(xml); // entités actives',
    options: [
      { label: 'Analyser en désactivant DTD et entités externes', code: 'libxml.parseXml(xml, { noent: false, dtdload: false, nonet: true })', holds: true, why: 'Une entité externe fait lire un fichier local ou joindre une URL interne au moment de l’analyse (XXE). Couper le chargement de DTD et la résolution réseau retire la capacité elle-même : l’analyseur ne suit plus aucune référence externe.' },
      { label: 'Refuser les documents contenant la chaîne « <!ENTITY »', code: "if (xml.includes('<!ENTITY')) return res.sendStatus(400)", holds: false, why: 'Le filtre textuel se contourne par l’encodage, les espaces, les DTD externes référencées par une simple URL. On cherche un mot dans le document au lieu de configurer l’analyseur qui le lit.' },
      { label: 'Valider le XML contre un schéma XSD après analyse', code: 'validateAgainstSchema(doc, invoiceSchema)', holds: false, why: 'La validation de schéma juge la structure une fois le document analysé : les entités ont déjà été résolues à ce moment. Le fichier a été lu, la requête interne partie, avant même que le schéma se prononce.' },
      { label: 'Limiter la taille du document à 1 Mo', code: 'if (xml.length > 1_000_000) return res.sendStatus(413)', holds: false, why: 'La limite de taille protège d’une expansion d’entités par déni de service, pas d’une lecture de fichier : une charge XXE utile tient dans quelques centaines d’octets. Deux problèmes distincts, une seule couverture.' },
    ],
  },

  // ── N2 ─────────────────────────────────────────────────────────────────────
  {
    id: 'href-scheme', level: 2, title: 'Lien « Site web » d’un client', module: 'm02', lang: 'tsx',
    context: 'Le champ website est saisi librement par le client puis rendu dans la fiche.',
    vulnerable: `<a href={client.website}>Site web</a>`,
    avoid: ['login-redirect'],
    options: [
      { label: 'Refuser les schémas dangereux connus : javascript, data, vbscript', code: `DANGEROUS.some((s) => u.trim().toLowerCase().startsWith(s))`, holds: false, why: 'Liste noire, donc une course sans fin : un caractère de contrôle avant le schéma, une tabulation au milieu de « java\\tscript: », ou un schéma qu’on n’a pas listé. Le navigateur normalise avant d’interpréter, ta comparaison non.' },
      { label: 'Encoder la valeur avec encodeURI avant de la poser dans href', code: `href={encodeURI(client.website)}`, holds: false, why: 'encodeURI laisse les deux-points intacts parce qu’ils sont structurels dans une URL : javascript:alert(1) en ressort identique. L’encodage traite le contenu, pas le schéma qui décide de ce que le navigateur fera.' },
      { label: 'Liste blanche de schémas, sur l’URL analysée', code: `['http:', 'https:'].includes(new URL(u).protocol)`, holds: true, why: 'C’est le parser du navigateur qui donne le protocole, donc la même normalisation que celle qui s’appliquera au clic. La liste est fermée : ce qui n’y est pas est refusé, sans avoir à prévoir les schémas de demain.' },
      { label: 'Ajouter rel="noopener noreferrer" et target="_blank"', code: `<a href={client.website} rel="noopener noreferrer" target="_blank">`, holds: false, why: 'Ces attributs coupent l’accès à window.opener et la fuite de référent : de bons réflexes pour un lien externe, et sans effet ici. Une URL javascript: s’exécute dans la page qui la porte, pas dans l’onglet ouvert.' },
    ],
  },
  {
    id: 'reset-host-header', level: 2, title: 'Lien de réinitialisation de mot de passe', module: 'm09', lang: 'ts',
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
    id: 'login-redirect', level: 2, title: 'Redirection après connexion', module: 'm09', lang: 'ts',
    context: 'Le paramètre next indique où renvoyer l’utilisateur après connexion.',
    vulnerable: `res.redirect(req.query.next ?? '/')`,
    avoid: ['href-scheme', 'oauth-redirect-uri'],
    options: [
      { label: 'Exiger que next commence par une barre oblique et pas deux', code: `if (!next.startsWith('/') || next.startsWith('//')) next = '/'`, holds: false, why: 'Les deux pièges connus sont couverts, et le navigateur en connaît d’autres : « /\\attacker.example » est traité comme un chemin réseau par plusieurs moteurs, et « /%09/attacker.example » selon la normalisation.' },
      { label: 'Résoudre next contre APP_URL et exiger la même origine', code: `new URL(next, APP_URL).origin === APP_URL.origin`, holds: true, why: 'On compare deux origines produites par le même analyseur que celui du navigateur, au lieu d’inspecter une chaîne. Toutes les variantes d’écriture se ramènent à la même origine, donc il n’y a plus de cas à prévoir.' },
      { label: 'Vérifier que next contient le domaine de Novafact', code: `if (!next.includes('novafact.example')) next = '/'`, holds: false, why: 'Le domaine apparaît bien dans la chaîne, mais pas forcément à la place qui compte : « https://attacker.example/?r=novafact.example » passe le test et redirige ailleurs. Chercher une sous-chaîne, c’est ignorer la grammaire des URL.' },
      { label: 'N’accepter qu’une clé de destination, traduite côté serveur', code: `res.redirect(DESTINATIONS[req.query.to] ?? '/')`, holds: false, why: 'Techniquement le plus sûr de tous — aucune URL ne vient du client. Ce n’est simplement plus le même correctif : les liens de reprise profonde cessent de fonctionner, et il faut réécrire tous les appelants.' },
    ],
  },
  {
    id: 'cache-key', level: 2, title: 'Clé de cache CloudFront', module: 'm03', lang: 'ts',
    context: 'Des pages de compte ont été servies à d’autres utilisateurs depuis le cache.',
    vulnerable: `cachePolicy: CachePolicy.CACHING_OPTIMIZED // sur /*`,
    options: [
      { label: 'Réduire la durée de vie par défaut à dix secondes', code: `defaultTtl: Duration.seconds(10), maxTtl: Duration.seconds(30)`, holds: false, why: 'La fenêtre rétrécit sans se fermer, et dix secondes sont une éternité pour un script qui interroge l’URL en boucle. Le cache continue par ailleurs de servir à tout le monde une réponse calculée pour une seule session.' },
      { label: 'Ajouter le cookie de session à la clé de cache', code: `cookieBehavior: CacheCookieBehavior.allowList('sid')`, holds: false, why: 'Chaque session obtient bien son entrée, donc le symptôme disparaît. Le taux de succès du cache tombe à zéro sur ces pages, et la moindre variation de délimiteur d’URL recrée une entrée partagée entre deux sessions.' },
      { label: 'Ne cacher que les chemins statiques, l’origine déclarant le reste', code: `/assets/* → cache ; /* → CACHING_DISABLED + no-store`, holds: true, why: 'Le cache cesse de deviner ce qui est public à partir de l’extension, et l’origine énonce elle-même ce qui ne doit jamais être stocké. Les deux couches disent la même chose, donc un désaccord de délimiteur ne crée plus de trou.' },
      { label: 'Bloquer au WAF les URL de /account se terminant par .css', code: `waf: block /account/*.css`, holds: false, why: 'On ferme la forme exacte du rapport d’incident, pas la classe : le délimiteur suivant — un point-virgule, un %00, une autre extension — passe à côté de la règle. Et le WAF ne voit rien des réponses déjà en cache.' },
    ],
  },
  {
    id: 'mass-assignment', level: 2, title: 'Mise à jour de profil', module: 'm02', lang: 'ts',
    real: 'Homakov / GitHub 2012',
    context: 'La route recopie le corps de la requête sur l’enregistrement utilisateur.',
    vulnerable: `Object.assign(user, req.body); await user.save();`,
    avoid: ['proto-merge', 'mongo-operator'],
    options: [
      { label: 'Ne recopier que les champs explicitement autorisés', code: "const { displayName, bio } = req.body; Object.assign(user, { displayName, bio })", holds: true, why: 'On choisit ce qui entre au lieu de retirer ce qui ne doit pas : un champ sensible ajouté demain (role, tenantId, isAdmin) reste dehors par défaut. C’est l’affaire Homakov sur GitHub en 2012 — un champ non prévu recopié depuis le formulaire donnait les droits de commit.' },
      { label: 'Retirer les champs sensibles connus du corps', code: "delete req.body.role; delete req.body.isAdmin; Object.assign(user, req.body)", holds: false, why: 'La liste noire de champs est toujours en retard d’un champ : il suffit d’en oublier un, ou qu’un nouveau attribut sensible apparaisse dans le modèle. On énumère ce qu’on interdit au lieu d’énoncer ce qu’on permet.' },
      { label: 'Valider le corps contre un schéma de profil', code: "const data = ProfileSchema.parse(req.body); Object.assign(user, data)", holds: false, why: 'La validation par schéma est le bon outil, mais sans .strict() zod laisse passer les champs non déclarés : role et isAdmin traversent la validation et arrivent dans Object.assign. Il manque un mot — le schéma valide ce qu’il connaît et ignore le reste.' },
      { label: 'Geler l’objet utilisateur après l’avoir chargé', code: "const user = Object.freeze(await User.findById(id))", holds: false, why: 'Un objet gelé refuse les écritures directes, mais Object.assign lèvera juste en mode strict ou échouera silencieusement : la mise à jour légitime ne fonctionne plus. On casse la fonctionnalité sans filtrer l’entrée.' },
    ],
  },
  {
    id: 'proto-merge', level: 2, title: 'Fusion des préférences', module: 'm03', lang: 'ts',
    real: 'lodash CVE-2019-10744',
    context: 'Les préférences envoyées sont fusionnées récursivement dans l’objet stocké.',
    vulnerable: `deepMerge(settings, req.body); // fusion profonde maison`,
    avoid: ['proto-merge', 'mass-assignment', 'mongo-operator'],
    options: [
      { label: 'Valider le corps par un schéma strict avant la fusion', code: "PrefsSchema.strict().parse(req.body)", holds: true, why: 'Le schéma n’accepte que les clés déclarées : __proto__ et constructor n’en font pas partie, donc ils sont rejetés avant la fusion. On borne la forme de l’entrée au lieu d’espérer que la fusion se défende seule.' },
      { label: 'Refuser la clé __proto__ pendant la fusion', code: "if (key === '__proto__') continue;", holds: false, why: 'On ferme une porte et on en laisse une ouverte : la charge { constructor: { prototype: { … } } } pollue le prototype sans jamais employer __proto__. C’est exactement le contournement de lodash (CVE-2019-10744).' },
      { label: 'Fusionner vers un objet sans prototype', code: "deepMerge(Object.create(null), req.body)", holds: false, why: 'Une cible sans prototype protège cette cible, mais une clé __proto__ dans une branche imbriquée retombe sur le vrai Object.prototype dès qu’un sous-objet ordinaire est créé pendant la descente. Le trou se déplace, il ne se ferme pas.' },
      { label: 'Cloner le corps avec structuredClone d’abord', code: "deepMerge(settings, structuredClone(req.body))", holds: false, why: 'structuredClone recopie fidèlement, y compris une clé propre nommée __proto__ issue de JSON.parse : le clone porte la même charge. On duplique le problème au lieu de le retirer.' },
    ],
  },
  {
    id: 'gcm-nonce', level: 2, title: 'Chiffrement des champs sensibles', module: 'm08', lang: 'ts',
    real: 'Nonce-Disrespecting Adversaries 2016',
    context: 'Les numéros de compte sont chiffrés en AES-GCM avant stockage.',
    vulnerable: `const iv = Buffer.alloc(12, 0); // même IV pour tout`,
    options: [
      { label: 'Tirer un nonce aléatoire par message, stocké à côté', code: "const iv = crypto.randomBytes(12)", holds: true, why: 'En GCM, réutiliser un nonce avec la même clé révèle le sous-produit qui authentifie les messages : l’attaquant peut alors forger des chiffrés valides (l’attaque « forbidden »). Un nonce unique par message, conservé avec le chiffré, retire cette réutilisation. La recherche Nonce-Disrespecting (2016) a trouvé des serveurs HTTPS réels vulnérables ainsi.' },
      { label: 'Incrémenter un compteur en mémoire pour le nonce', code: "const iv = counterToIv(nextCounter++)", holds: false, why: 'Un compteur en mémoire garantit l’unicité tant qu’un seul processus vit : au redémarrage il repart de zéro, et trois tâches parallèles distribuent les mêmes valeurs. La réutilisation revient par le déploiement.' },
      { label: 'Passer la clé AES de 128 à 256 bits', code: "createCipheriv('aes-256-gcm', key32, iv)", holds: false, why: 'La taille de clé ne change rien au problème : la faiblesse est la réutilisation du nonce, pas la force de l’algorithme. Un GCM à 256 bits avec IV fixe reste tout aussi forgeable.' },
      { label: 'Revenir à AES-CBC, plus ancien et éprouvé', code: "createCipheriv('aes-256-cbc', key, iv)", holds: false, why: 'CBC n’authentifie rien par lui-même : sans MAC on s’expose au remplissage malléable et aux oracles de padding. On échange un mauvais usage de GCM contre un mode qui demande encore plus de précautions.' },
    ],
  },
  {
    id: 'csrf-token', level: 2, title: 'Changement d’adresse e-mail', module: 'm02', lang: 'ts',
    context: 'Un POST authentifié par cookie de session change l’adresse du compte.',
    vulnerable: `router.post('/account/email', requireSession, updateEmail);`,
    options: [
      { label: 'Exiger un jeton anti-CSRF lié à la session et le vérifier', code: "verifyCsrf(req.body._csrf, req.session.csrf)", holds: true, why: 'Un site tiers peut déclencher une requête avec le cookie de la victime, mais il ne peut pas lire le jeton propre à la session pour le renvoyer. Le contrôle repose sur quelque chose que l’attaquant n’a pas, pas sur la provenance de la requête.' },
      { label: 'Poser le cookie de session en SameSite=Lax', code: "cookie: { sameSite: 'lax' }", holds: false, why: 'SameSite=Lax coupe la plupart des CSRF, mais laisse passer les navigations de premier niveau et certains cas de sous-domaines ou d’anciens navigateurs. C’est une défense en profondeur utile, pas une garantie sur une action sensible.' },
      { label: 'Vérifier que l’en-tête Referer vient du site', code: "if (!req.get('referer')?.startsWith(APP_URL)) return res.sendStatus(403)", holds: false, why: 'Le Referer est absent quand la politique de référent le supprime, et sa vérification par préfixe se contourne (attacker.com/novafact.example…). S’appuyer sur un en-tête optionnel et falsifiable donne une protection intermittente.' },
      { label: 'Comparer un cookie et un champ de formulaire identiques', code: "if (req.cookies.csrf !== req.body.csrf) return res.sendStatus(403)", holds: false, why: 'Le double envoi sans liaison à la session se casse dès qu’un sous-domaine peut écrire le cookie csrf : l’attaquant fixe la même valeur des deux côtés. Sans ancrage à la session, l’égalité ne prouve rien.' },
    ],
  },
  {
    id: 'redos-search', level: 2, title: 'Filtre de produits par motif', module: 'm03', lang: 'ts',
    context: 'La recherche accepte un motif que le serveur transforme en expression régulière.',
    vulnerable: `const re = new RegExp(req.query.q); items.filter((i) => re.test(i.label))`,
    options: [
      { label: 'Échapper la saisie et chercher une sous-chaîne littérale', code: "const needle = String(q).toLowerCase(); label.toLowerCase().includes(needle)", holds: true, why: 'Une recherche littérale n’a pas de retour arrière : elle balaie la chaîne une fois. Le problème n’est pas la longueur du motif mais le moteur de regex lui-même ; le retirer supprime la classe de déni de service.' },
      { label: 'Compiler la regex avec une limite de longueur du motif', code: "if (q.length > 50) return res.sendStatus(400); new RegExp(q)", holds: false, why: 'Un motif catastrophique tient en très peu de caractères : (a+)+$ suffit à geler la boucle d’événements sur une entrée bien choisie. Limiter la longueur ne borne pas le temps d’exécution.' },
      { label: 'Exécuter la regex dans un délai maximal', code: "await withTimeout(() => re.test(label), 50)", holds: false, why: 'JavaScript exécute la regex sur le fil principal, sans point d’interruption : le délai ne se déclenche qu’une fois le moteur rendu, c’est-à-dire trop tard. La boucle d’événements reste gelée pendant le retour arrière.' },
      { label: 'Ajouter le drapeau insensible à la casse', code: "new RegExp(q, 'i')", holds: false, why: 'Le drapeau i ne change que la casse : il n’a aucun effet sur le retour arrière catastrophique, qui vient de la structure du motif. Le motif reste fourni par l’utilisateur et le moteur reste vulnérable.' },
    ],
  },
  {
    id: 'upload-avatar', level: 2, title: 'Téléversement d’avatar', module: 'm02', lang: 'ts',
    context: 'L’avatar est enregistré sous le nom envoyé, dans un dossier servi statiquement.',
    vulnerable: `fs.writeFile(path.join(PUBLIC, file.originalname), file.buffer)`,
    options: [
      { label: 'Vérifier le type réel, renommer, stocker hors racine servie', code: "assertImage(file.buffer); writeFile(join(PRIVATE, randomId() + ext))", holds: true, why: 'On vérifie le contenu réel du fichier, pas sa déclaration, on lui donne un nom généré, et on le range hors du dossier servi. Un fichier .html ou .svg piégé ne peut plus être écrit sous un nom exécutable ni atteint directement par URL.' },
      { label: 'N’accepter que les extensions .png, .jpg et .webp', code: "if (!/\\.(png|jpg|webp)$/i.test(name)) return res.sendStatus(400)", holds: false, why: 'L’extension ne dit rien du contenu : un script renommé en .png passe, et le nom d’origine sert toujours de chemin, avec ses éventuels « ../ ». On valide une étiquette, pas le fichier ni l’endroit où il atterrit.' },
      { label: 'Se fier au type MIME annoncé par le client', code: "if (!file.mimetype.startsWith('image/')) return res.sendStatus(400)", holds: false, why: 'Le type MIME est envoyé par le client : il se falsifie librement. Un exécutable annoncé image/png franchit le test sans être une image.' },
      { label: 'Limiter la taille de l’avatar à 2 Mo', code: "if (file.size > 2_000_000) return res.sendStatus(413)", holds: false, why: 'La limite de taille protège du remplissage disque, pas du contenu : une charge utile malveillante tient largement sous 2 Mo. Le nom d’origine et le dossier servi restent les vrais problèmes.' },
    ],
  },

  // ── N3 ─────────────────────────────────────────────────────────────────────
  {
    id: 'attachment-traversal', level: 3, title: 'Téléchargement de pièce jointe', module: 'm02', lang: 'ts',
    context: 'Le nom du fichier vient de l’URL.',
    vulnerable: `res.sendFile(path.join(UPLOADS, req.params.name));`,
    options: [
      { label: 'Normaliser le chemin puis retirer les séquences de remontée', code: `path.normalize(name).replaceAll('../', '').replaceAll('..\\\\', '')`, holds: false, why: 'Un remplacement en une passe se contourne par imbrication : « ....// » perd son « ../ » du milieu et redevient « ../ ». Et normalize ne connaît pas les encodages que la couche HTTP a déjà décodés — c’est le motif du contournement d’Apache 2.4.50 (CVE-2021-42013), corrigé par double décodage.' },
      { label: 'Refuser tout nom qui ne correspond pas à /^[\\w.-]+\\.pdf$/', code: `if (!/^[\\w.-]+\\.pdf$/.test(name)) return res.sendStatus(400)`, holds: false, why: 'Bien meilleur que la liste noire, et le point reste autorisé : « ..pdf » passe, et surtout le motif ne dit rien du chemin final. On valide la forme du nom au lieu de contrôler l’endroit où il mène.' },
      { label: 'Résoudre le chemin et exiger qu’il reste sous la racine', code: `const t = path.resolve(base, name);\nif (!t.startsWith(base + path.sep)) throw new Error()`, holds: true, why: 'On contrôle le résultat de la résolution, c’est-à-dire le fichier qui sera réellement ouvert, quelles que soient les astuces employées pour y arriver. Encore mieux : un identifiant généré à la place d’un nom fourni.' },
      { label: 'Encoder le nom avec encodeURIComponent avant de le joindre', code: `res.sendFile(path.join(UPLOADS, encodeURIComponent(name)))`, holds: false, why: 'Express a déjà décodé le paramètre : ré-encoder ici produit « %2E%2E%2F » comme nom de fichier littéral, qui n’existe pas. Les téléchargements légitimes avec un accent cassent, et la cause n’est pas traitée.' },
    ],
  },
  {
    id: 'mongo-operator', level: 3, title: 'Connexion avec MongoDB', module: 'm02', lang: 'ts',
    context: 'Le corps JSON est passé au filtre Mongo.',
    vulnerable: `users.findOne({ email: req.body.email })`,
    avoid: ['proto-merge', 'mass-assignment'],
    options: [
      { label: 'Refuser récursivement toute clé commençant par « $ » ou contenant un point', code: `if (hasOperatorKey(req.body)) return res.sendStatus(400)`, holds: false, why: 'C’est la version sérieuse de la liste noire, et elle tient contre $ne comme contre $gt. Mais elle vit à côté du typage : un tableau reste un tableau, et il suffit d’une route qui oublie d’appeler le garde pour tout rouvrir.' },
      { label: 'Valider le corps par un schéma strict', code: `z.object({ email: z.string().email().max(254) }).strict().parse(req.body)`, holds: true, why: 'Après validation, email est une chaîne — un objet ne peut plus prendre sa place, quel que soit l’opérateur imaginé. Et .strict() refuse les champs inconnus : la classe entière disparaît, pour cette route et les suivantes.' },
      { label: 'Forcer la conversion en chaîne avec un gabarit littéral', code: 'users.findOne({ email: `${req.body.email}` })', holds: false, why: 'Le champ est effectivement neutralisé, et un objet devient « [object Object] », ce qui ne trouve rien. Mais c’est un correctif d’une ligne pour un champ : la route voisine, écrite le mois prochain, repartira de zéro.' },
      { label: 'Limiter les tentatives à 5 par minute et par adresse IP', code: `app.use('/api/auth/login', rateLimit({ windowMs: 60_000, limit: 5 }))`, holds: false, why: 'Utile contre le bourrage d’identifiants, et sans rapport avec celui-ci : l’injection d’opérateur réussit du premier coup. Cinq tentatives suffisent largement à extraire un compte avec un $regex bien choisi.' },
    ],
  },
  {
    id: 'webhook-hmac', level: 3, title: 'Signature des webhooks entrants', module: 'm02', lang: 'ts',
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
    id: 'coupon-race', level: 3, title: 'Coupon à usage limité', module: 'm03', lang: 'ts',
    context: 'Un coupon est limité à 100 utilisations. L’API tourne sur trois instances ECS.',
    vulnerable: `if (coupon.used < coupon.max) await incrementUsed(coupon.id);`,
    avoid: ['rate-limit-race'],
    options: [
      { label: 'Sérialiser l’accès par un mutex en mémoire autour du bloc', code: `await mutex.runExclusive(async () => { … })`, holds: false, why: 'Correct sur une instance, et c’est précisément le piège : en développement, avec un seul processus, le défaut disparaît complètement. Les deux autres tâches ECS ne connaissent pas ce verrou et entrent en même temps.' },
      { label: 'Mise à jour conditionnelle atomique', code: `UPDATE coupon SET used = used + 1 WHERE id = $1 AND used < max`, holds: true, why: 'La vérification et l’écriture deviennent une seule opération, arbitrée par la base — le seul point que les trois instances partagent. Zéro ligne modifiée veut dire limite atteinte : la réponse est dans le résultat.' },
      { label: 'Relire le compteur juste avant l’incrément, dans la même fonction', code: `const fresh = await getCoupon(id);\nif (fresh.used >= fresh.max) return;`, holds: false, why: 'La fenêtre passe de quelques millisecondes à quelques microsecondes, donc le bug devient difficile à reproduire en test. C’est exactement ce que vise la single-packet attack, qui fait arriver les requêtes dans la même fenêtre.' },
      { label: 'Poser un verrou distribué dans Redis pendant la transaction', code: `await redlock.acquire([\`coupon:\${id}\`], 5_000)`, holds: false, why: 'Cette fois le verrou est bien partagé entre les instances, et ça marchera la plupart du temps. Mais l’invariant dépend maintenant de la disponibilité de Redis et d’une expiration bien choisie, alors que la base le garantit gratuitement.' },
    ],
  },
  {
    id: 'jwt-verify', level: 3, title: 'Vérification d’un JWT', module: 'm09', lang: 'ts',
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
    id: 'ejs-render', level: 3, title: 'Aperçu de facture', module: 'm03', lang: 'ts',
    real: 'CVE-2022-29078',
    context: 'La page d’aperçu utilise EJS.',
    vulnerable: `res.render('invoice', req.query)`,
    options: [
      { label: 'Échapper toutes les valeurs de req.query avant le rendu', code: `res.render('invoice', mapValues(req.query, escapeHtml))`, holds: false, why: 'On traite les valeurs, et le danger est dans les clés : l’objet passé au rendu sert aussi à porter les options du moteur. Une clé bien choisie (outputFunctionName) change le comportement d’EJS et exécute du code — c’est CVE-2022-29078.' },
      { label: 'Construire un objet de vue explicite', code: `res.render('invoice', { invoice: toView(inv) })`, holds: true, why: 'Le moteur ne reçoit plus que les champs qu’on a nommés, à partir d’une facture déjà chargée et vérifiée. Ce n’est pas un filtre sur ce qui entre : la requête ne touche tout simplement plus le rendu.' },
      { label: 'Ne garder que les clés attendues de req.query', code: `res.render('invoice', pick(req.query, ['id', 'lang', 'format']))`, holds: false, why: 'Une liste blanche de clés, et c’est presque la bonne réponse : les options du moteur sont écartées. Mais ces trois valeurs restent contrôlées par le client et partent telles quelles dans la vue, sans être résolues contre la base.' },
      { label: 'Passer à Pug, dont la syntaxe n’interpole pas les options', code: `app.set('view engine', 'pug')`, holds: false, why: 'Changer de moteur déplace le problème : Pug a son propre jeu d’options locales, et surtout on continue de lui passer la requête. Une réécriture complète des gabarits pour ne rien corriger.' },
    ],
  },
  {
    id: 'unicode-reset', level: 3, title: 'Réinitialisation par e-mail', module: 'm09', lang: 'ts',
    real: 'GitHub 2019 (case mapping collision)',
    context: 'La réinitialisation retrouve le compte par e-mail normalisé, puis envoie le lien à l’adresse saisie.',
    vulnerable: `const u = findByEmail(email.toLowerCase());\nsendReset(email, u.token);`,
    options: [
      { label: 'Normaliser l’adresse en NFKC avant la recherche', code: `const key = email.normalize('NFKC').toLowerCase()`, holds: false, why: 'La normalisation paraît la réponse la plus rigoureuse, et elle rate la cible : le problème n’est pas la recherche mais l’envoi à l’adresse saisie. Un « ı » sans point majuscule en « I » entre en collision de casse — c’est la faille GitHub de 2019, où le lien partait vers l’adresse de l’attaquant.' },
      { label: 'Envoyer le lien à l’adresse enregistrée du compte trouvé', code: `sendReset(u.email, u.token)`, holds: true, why: 'On dissocie l’identification de la destination : peu importe l’écriture saisie, le lien part vers l’adresse vérifiée en base. L’attaquant peut faire correspondre le compte d’un autre, il ne recevra jamais le jeton.' },
      { label: 'Refuser toute adresse contenant un caractère non ASCII', code: `if (/[^\\x00-\\x7f]/.test(email)) return res.sendStatus(400)`, holds: false, why: 'On ferme une écriture du contournement et on casse les adresses internationalisées légitimes. Et la collision existe aussi entre caractères ASCII selon les règles de casse : le fond du problème — envoyer à l’adresse saisie — demeure.' },
      { label: 'Limiter les demandes de réinitialisation par compte', code: `rateLimit({ keyGenerator: () => u.id, limit: 3 })`, holds: false, why: 'Le quota gêne un abus massif, pas une attaque ciblée qui réussit du premier coup : une seule demande bien formée envoie le jeton au mauvais destinataire. La limite ne touche pas la cause.' },
    ],
  },
  {
    id: 'oauth-redirect-uri', level: 3, title: 'Validation du redirect_uri', module: 'm09', lang: 'ts',
    real: 'Homakov / GitHub OAuth 2014',
    context: 'Le serveur d’autorisation vérifie l’URI de redirection reçue avant d’émettre le code.',
    vulnerable: `if (redirectUri.startsWith(client.registeredUri)) issueCode();`,
    avoid: ['login-redirect'],
    options: [
      { label: 'Décoder l’URI puis vérifier que l’hôte est celui enregistré', code: `new URL(decodeURIComponent(redirectUri)).host === client.host`, holds: false, why: 'Comparer l’hôte laisse le chemin libre : une redirection ouverte sur le domaine légitime renvoie le code ailleurs, et un « /../ » dans le chemin change la cible réelle. C’est le contournement de la chaîne OAuth de GitHub trouvée par Homakov en 2014.' },
      { label: 'Exiger une correspondance exacte avec une URI pré-enregistrée', code: `if (!client.redirectUris.includes(redirectUri)) return reject()`, holds: true, why: 'La RFC demande une comparaison exacte de chaîne avec une valeur pré-enregistrée. Aucune place pour un suffixe, un chemin ou un paramètre ajouté : le code d’autorisation ne peut partir que vers une URI que le client a lui-même déclarée.' },
      { label: 'Vérifier que l’URI commence par l’URI enregistrée, décodée', code: `decodeURIComponent(redirectUri).startsWith(client.registeredUri)`, holds: false, why: 'Le préfixe reste vulnérable : https://app.example.attacker.com commence bien par https://app.example et détourne le code. Décoder d’abord ne change pas la faiblesse de la comparaison par préfixe.' },
      { label: 'Refuser les URI dont l’hôte n’est pas dans une liste de domaines', code: `if (!ALLOWED_DOMAINS.has(new URL(redirectUri).hostname)) reject()`, holds: false, why: 'Une liste de domaines autorise n’importe quel chemin et n’importe quelle sous-page de ces domaines : une page à redirection ouverte ou un contenu contrôlé par l’utilisateur y suffit à voler le code. Trop large là où l’exactitude est requise.' },
    ],
  },
  {
    id: 'rate-limit-race', level: 3, title: 'Vérification du code à usage unique', module: 'm10', lang: 'ts',
    real: 'Instagram 2019 (L. Muthiyah)',
    context: 'Un code à 6 chiffres valide la connexion. Une limite plafonne les essais par adresse IP.',
    vulnerable: `if (attemptsByIp(req.ip) < 250 && code === expected) grant();`,
    avoid: ['coupon-race'],
    options: [
      { label: 'Compter les essais par compte, de façon atomique, et verrouiller', code: `if (incrCodeAttempts(user.id) > 5) lockCode(user.id)`, holds: true, why: 'Le budget d’essais est attaché à ce qu’on protège — le compte — et non à l’adresse qui essaie. Cinq essais épuisés, le code est invalidé, quelle que soit la provenance. Sur Instagram (2019), Muthiyah a contourné une limite par IP en distribuant ~200 000 essais sur des milliers d’adresses et en lançant les requêtes en parallèle.' },
      { label: 'Abaisser le plafond par IP de 250 à 20 essais', code: `if (attemptsByIp(req.ip) < 20) …`, holds: false, why: 'Un plafond par IP se contourne en changeant d’IP : avec assez d’adresses, chacune reste sous la limite et la somme couvre l’espace des codes. Baisser le chiffre augmente le nombre d’IP nécessaires, pas la sécurité du compte.' },
      { label: 'Ajouter un délai croissant entre les essais d’une même IP', code: `await sleep(2 ** attemptsByIp(req.ip) * 100)`, holds: false, why: 'Le délai freine une seule IP et ne touche pas les requêtes concurrentes venues d’ailleurs. Il ouvre même une fenêtre de concurrence : plusieurs essais partis ensemble lisent le même compteur avant qu’il monte.' },
      { label: 'Rallonger le code de 6 à 8 chiffres', code: `expected = randomDigits(8)`, holds: false, why: 'Agrandir l’espace des codes rend l’attaque plus longue sans la rendre impossible tant que les essais ne sont pas bornés par compte. La faille est l’absence de limite efficace, pas la taille du secret.' },
    ],
  },
];

// ── Les séries ──────────────────────────────────────────────────────────────

const mix = (n1: number, n2: number, n3: number): [number, number, number] => [n1, n2, n3];

const PROFILES: SeriesProfile<PatchScenario>[] = [
  { id: 'prise-en-main', title: 'Prise en main', mix: mix(6, 0, 0), level: 1,
    text: 'Un seul correctif tient, les trois autres échouent pour une raison qu’on peut nommer. On apprend la forme du bon geste.' },
  { id: 'bons-reflexes', title: 'Bons réflexes', mix: mix(4, 2, 0), level: 1,
    text: 'Encore des cas nets, avec deux scénarios où un distracteur commence à se défendre. On lit un peu plus le contexte.' },
  { id: 'revue-de-pr', title: 'Revue de PR', mix: mix(0, 6, 0), level: 2,
    text: 'Six correctifs de niveau relecture : au moins deux options sérieuses par scénario, dont une se contourne par un détail.' },
  { id: 'presque-bon', title: 'Presque bon', mix: mix(1, 4, 1), level: 2,
    text: 'La bonne réponse et le piège se ressemblent : liste blanche mal posée, mesure qui protège une instance et pas le déploiement.' },
  { id: 'contournements', title: 'Contournements', mix: mix(0, 2, 4), level: 3,
    text: 'Le correctif qui paraît le plus blindé se contourne : normalisation, double décodage, TOCTOU, confusion d’algorithme.' },
  { id: 'le-piege', title: 'Le piège', mix: mix(0, 0, 6), level: 3,
    text: 'Que du niveau 3 : celui qui tient est le plus sobre, jamais le plus impressionnant. Il faut suivre la donnée jusqu’au bout.' },
  { id: 'cas-reels', title: 'D’après nature', filter: (s) => Boolean(s.real), mix: mix(2, 2, 2), level: 2,
    text: 'Six scénarios inspirés d’incidents et de CVE publics — de LinkedIn 2012 à Capital One 2019. Le cas est nommé dans le correctif qui tient.' },
  { id: 'melee', title: 'Mêlée', mix: mix(2, 2, 2), level: 2, shuffleEachTime: true,
    text: 'Tous niveaux confondus, recomposée à chaque partie. La seule série qu’on ne peut pas réviser.' },
];

export const patchSeries = defineSeries(patchScenarios, PROFILES);

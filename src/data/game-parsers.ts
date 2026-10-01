// Scénarios du jeu « Parser Wars » : plusieurs composants lisent différemment la même entrée.
// Les scénarios décrivent les divergences de façon conceptuelle ; la pratique se fait sur les labs PortSwigger.
//
// Règle d'écriture : **les trois propositions doivent être des lectures
// défendables de la chaîne affichée**. Un distracteur du type « sans rapport »
// s'élimine sans réfléchir, et le joueur trouve la bonne réponse par
// soustraction. Ici les mauvaises réponses décrivent un vrai comportement des
// composants, ou un vrai impact — simplement pas celui que produit CETTE
// divergence. Idem pour les correctifs : trois d'entre eux durcissent quelque
// chose, un seul supprime l'ambiguïté.
//
// `npm run games` vérifie que la bonne réponse n'est pas la plus longue.
//
// ── Les trois niveaux ────────────────────────────────────────────────────────
//
// La difficulté d'une divergence de parsers ne tient pas au sujet : un smuggling
// n'est pas « plus dur » qu'une clé JSON dupliquée. Elle tient à la **distance**
// entre l'indice affiché et la bonne réponse, au nombre de composants qu'il faut
// tenir en tête, et à la présence de correctifs qui marchent à moitié.
//
//   N1 · Deux composants, une seule divergence. La chaîne l'affiche presque en
//        clair, et les distracteurs décrivent un comportement voisin qui n'est
//        pas celui de CE scénario. On apprend à reconnaître la forme.
//
//   N2 · Deux composants, mais il faut lire le contexte : au moins un correctif
//        est la « deuxième meilleure réponse » (il rétrécit l'écart sans le
//        fermer, ou il durcit la mauvaise couche), et l'impact se confond avec
//        un symptôme qu'on remarquerait à sa place.
//
//   N3 · Trois composants ou plus, ou une divergence subtile. La lecture juste
//        dépend d'un détail — l'ordre du downgrade HTTP/2, la limite d'octets
//        d'un WAF, un appariement de champ insensible à la casse — et le
//        correctif « le plus complet en apparence » est souvent le piège.
//
// Beaucoup de scénarios s'appuient sur des recherches publiées ou des CVE ; la
// source est citée dans l'explication (nom, année). Les autres sont fictifs, sur
// l'infrastructure de Novafact.

import { defineSeries, type SeriesProfile, type Level } from '../lib/series';

export type ParserLevel = Level;

export interface ParserOption { text: string; right: boolean; why: string }
export interface ParserScenario {
  /** Identifiant stable : il sert à composer les séries. */
  id: string;
  level: ParserLevel;
  /** Famille de divergence, pour les séries thématiques. */
  family: string;
  title: string;
  chain: { name: string; reads: string }[];
  input: string;
  divergence: ParserOption[];
  impact: ParserOption[];
  fix: ParserOption[];
  /** Scénarios de même structure à ne pas réunir dans une même série. */
  avoid?: string[];
}

export const parserScenarios: ParserScenario[] = [

  {
    id: 'cl-te-generique', level: 1, family: 'smuggling',
    title: 'Longueur de requête ambiguë',
    chain: [
      { name: 'Proxy frontal', reads: 'Délimite la requête avec Content-Length' },
      { name: 'Ancien backend HTTP/1.1', reads: 'Délimite la même requête avec Transfer-Encoding' },
    ],
    input: 'Une requête contient à la fois un en-tête Content-Length et un en-tête Transfer-Encoding, et les deux composants partagent une connexion.',
    divergence: [
      { text: 'Les deux ne s’accordent pas sur la fin de la requête', right: true, why: 'La norme donne la priorité à Transfer-Encoding, mais tous les composants ne l’appliquent pas : deux règles de délimitation pour le même flux d’octets.' },
      { text: 'Le backend lit un corps plus court que celui annoncé au proxy', right: false, why: 'C’est une conséquence possible parmi d’autres, pas la divergence elle-même — selon l’ordre des deux composants, le corps peut aussi être plus long.' },
      { text: 'Le proxy réécrit l’en-tête Host avant de transmettre au backend', right: false, why: 'Il le fait généralement, et c’est une autre famille de problèmes. La réécriture d’en-tête ne dit rien de l’endroit où la requête se termine.' },
    ],
    impact: [
      { text: 'Des octets sont lus comme le début de la requête d’un autre', right: true, why: 'C’est une désynchronisation de la connexion partagée : contournement des contrôles de la bordure, vol de requêtes en cours, empoisonnement du cache.' },
      { text: 'La connexion se bloque jusqu’à expiration du délai d’attente', right: false, why: 'Cela arrive quand le backend attend des octets qui ne viennent pas — un symptôme réel de désynchronisation, et celui qu’on remarque au lieu de l’attaque.' },
      { text: 'Le backend rejette la requête comme malformée et renvoie une 400', right: false, why: 'C’est le comportement correct, celui des implémentations strictes. S’il se produisait, il n’y aurait pas de divergence à exploiter.' },
    ],
    fix: [
      { text: 'HTTP/2 de bout en bout, et rejet des requêtes ambiguës', right: true, why: 'HTTP/2 délimite par trames, donc l’ambiguïté n’existe plus dans le protocole. Et ce qui reste en HTTP/1.1 est refusé au lieu d’être interprété.' },
      { text: 'Une règle de bordure par variante connue de l’en-tête Transfer-Encoding', right: false, why: 'Les variantes se comptent par dizaines — espace avant le deux-points, casse, valeurs multiples — et chacune se découvre après coup. On filtre une ambiguïté au lieu de la supprimer.' },
      { text: 'Fermer les connexions au backend après chaque requête transmise', right: false, why: 'Sans connexion réutilisée, il n’y a plus de requête suivante à empoisonner, donc la mesure fonctionne. Le coût en latence et en ressources la rend intenable à l’échelle.' },
    ],
  },
  {
    id: 'casse-express-cdn', level: 1, family: 'chemin',
    title: 'Chemin protégé à la bordure',
    chain: [
      { name: 'Règle du CDN', reads: 'Bloque le chemin /admin, en respectant la casse' },
      { name: 'Routeur Express', reads: 'Associe /ADMIN à la route /admin (casse ignorée par défaut)' },
    ],
    input: 'Une règle à la bordure protège le back-office en bloquant les URL qui commencent par /admin. Une requête arrive sur /Admin/users.',
    divergence: [
      { text: 'Les deux ne normalisent pas le chemin de la même façon', right: true, why: 'Express compare les routes sans tenir compte de la casse, la règle du CDN compare deux chaînes. Le même chemin appartient donc à la route protégée pour l’un et pas pour l’autre.' },
      { text: 'Express refuse les chemins contenant des majuscules et redirige', right: false, why: 'Certains frameworks redirigent effectivement vers la forme canonique, ce qui fermerait le trou. Express, par défaut, sert directement la route.' },
      { text: 'Le CDN met en cache la réponse du back-office pour les visiteurs suivants', right: false, why: 'Un vrai risque, et une autre histoire : il faudrait que la réponse soit jugée cachable. La divergence porte ici sur le blocage, pas sur le stockage.' },
    ],
    impact: [
      { text: 'La route d’administration est atteinte sans passer par la bordure', right: true, why: 'Le contrôle d’accès reposait sur une comparaison de chaînes faite loin de la ressource. Ce n’était pas une autorisation, c’était un filtre de nom.' },
      { text: 'Le back-office demande quand même une authentification, donc rien ne passe', right: false, why: 'On l’espère, et c’est exactement la leçon : si la bordure est le seul contrôle, il n’y en a plus. Le scénario décrit le cas où elle l’est.' },
      { text: 'Les journaux de la bordure ne montrent pas les accès au back-office', right: false, why: 'C’est vrai et secondaire : la perte de visibilité accompagne le contournement, elle n’en est pas l’impact principal.' },
    ],
    fix: [
      { text: 'L’autorisation se décide dans l’application, la bordure n’est qu’une couche', right: true, why: 'Le contrôle vit là où la ressource est servie, donc il voit le chemin tel qu’il sera réellement routé. La bordure garde son intérêt, elle cesse d’être la seule.' },
      { text: 'Ajouter des règles de bordure pour /Admin, /ADMIN et les variantes encodées', right: false, why: 'On ferme les formes connues, et il en reste : double barre oblique, %2f, point-virgule, espace de fin. Chaque variante trouvée en ajoute une à écrire.' },
      { text: 'Normaliser le chemin à la bordure avant d’appliquer la règle de blocage', right: false, why: 'Bien meilleur que d’énumérer, et presque suffisant : encore faut-il que la normalisation du CDN soit exactement celle d’Express, ce qui ne se vérifie qu’en testant.' },
    ],
  },
  {
    id: 'x-forwarded-host-cache', level: 1, family: 'cache',
    title: 'En-tête hors de la clé de cache',
    chain: [
      { name: 'CDN', reads: 'Clé de cache : hôte + chemin. Ignore X-Forwarded-Host' },
      { name: 'Application', reads: 'Construit l’URL absolue des scripts à partir de X-Forwarded-Host' },
    ],
    input: 'Une requête arrive avec un en-tête X-Forwarded-Host choisi par le client, sur une page que le CDN met en cache.',
    divergence: [
      { text: 'La réponse dépend d’une entrée absente de la clé de cache', right: true, why: 'Le cache croit que hôte et chemin déterminent la réponse. L’application y ajoute un en-tête qu’il ne regarde pas, donc deux réponses différentes partagent une entrée.' },
      { text: 'Le CDN transmet un en-tête que l’application n’aurait pas dû recevoir', right: false, why: 'C’est la moitié du problème, et la formulation inverse la responsabilité : le CDN peut légitimement transmettre cet en-tête, à condition qu’il entre dans la clé.' },
      { text: 'L’application ignore la valeur de l’en-tête et utilise l’hôte réel', right: false, why: 'Ce serait le comportement sûr, et il n’y aurait alors aucune divergence : la réponse ne dépendrait que de ce que le cache connaît.' },
    ],
    impact: [
      { text: 'Tous les visiteurs reçoivent une page qui charge un script étranger', right: true, why: 'La réponse empoisonnée est stockée puis servie à qui demande la même URL. Une requête suffit à toucher tout le monde, sans jamais parler à la victime.' },
      { text: 'Seul l’auteur de la requête voit la page modifiée par son en-tête', right: false, why: 'Ce serait le cas si la réponse n’était pas stockée — la même manipulation existe alors, et elle ne vaut rien puisqu’elle n’atteint que soi.' },
      { text: 'Le CDN sert une réponse expirée aux visiteurs pendant le rafraîchissement', right: false, why: 'Un comportement normal du cache, sans rapport avec la provenance du contenu servi.' },
    ],
    fix: [
      { text: 'L’URL absolue vient de la configuration, et le CDN filtre les en-têtes', right: true, why: 'L’application cesse de dépendre d’une entrée, et le cache cesse de transmettre ce qu’il ne prend pas en compte. Les deux couches se remettent d’accord.' },
      { text: 'Ajouter X-Forwarded-Host à la clé de cache du CDN pour cette page', right: false, why: 'Correct sur le principe, et le taux de succès du cache s’effondre puisqu’un en-tête libre crée une entrée par valeur. On paie cher pour garder une dépendance inutile.' },
      { text: 'Ramener la durée de conservation en cache de dix minutes à une minute', right: false, why: 'La fenêtre rétrécit, et une minute suffit largement pour un site à fort trafic. La réponse empoisonnée touche simplement moins de monde à chaque tour.' },
    ],
  },
  {
    id: 'cache-deception-css', level: 1, family: 'cache',
    title: 'Page privée prise pour un fichier statique',
    chain: [
      { name: 'CDN', reads: 'Met en cache tout ce qui se termine par .css' },
      { name: 'Application', reads: 'La route /account/* renvoie la page du compte, quel que soit le suffixe' },
    ],
    input: 'Un lien vers /account/details.css est envoyé à un utilisateur connecté, qui le visite.',
    divergence: [
      { text: 'L’un juge la ressource à son extension, l’autre à sa route', right: true, why: 'Le CDN déduit « statique donc public » d’un suffixe, l’application sert une page personnalisée. La même URL appartient à deux catégories différentes.' },
      { text: 'L’application sert une feuille de style au lieu de la page du compte', right: false, why: 'Elle ne consulte pas le suffixe du tout : la route /account/* absorbe le chemin entier et renvoie la page. Il n’y a aucune feuille de style dans ce scénario.' },
      { text: 'Le CDN retire les cookies des requêtes qu’il juge statiques', right: false, why: 'Certaines configurations le font, et cela éviterait l’attaque en rendant la réponse anonyme. Celle-ci transmet les cookies, donc la page revient personnalisée.' },
    ],
    impact: [
      { text: 'La page de la victime est stockée, puis lue par l’attaquant', right: true, why: 'Il suffit de faire visiter l’URL à la victime, puis de la demander soi-même : le cache rend la réponse personnelle à qui la demande. C’est une cache deception.' },
      { text: 'La victime voit une page mal rendue, ce qui l’alerte du problème', right: false, why: 'Rien ne l’alerte : elle voit sa page de compte normale. L’absence de signal pour la victime est ce qui rend l’attaque confortable.' },
      { text: 'Sans XSS préalable, l’attaquant ne peut rien lire de la réponse', right: false, why: 'Aucune XSS n’est nécessaire : l’attaquant demande l’URL depuis son propre navigateur et le cache lui sert la réponse stockée.' },
    ],
    fix: [
      { text: 'L’origine déclare ce qui ne se cache pas, et le cache ne devine plus', right: true, why: 'Cache-Control: private, no-store sur toute réponse authentifiée, et un cache limité à des chemins statiques énumérés. Les deux couches cessent de raisonner par extension.' },
      { text: 'Bloquer à la bordure les URL de /account qui se terminent par .css', right: false, why: 'On ferme la forme exacte observée. Le délimiteur suivant passe : .js, .jpg, un point-virgule, un %00, ou n’importe quelle extension que le cache juge statique.' },
      { text: 'Faire répondre 404 à la route /account quand le chemin porte un suffixe', right: false, why: 'Meilleur que la règle de bordure, puisque l’application décide. Mais il reste à énumérer ce qu’est un suffixe, et le cache continue de deviner pour les autres routes.' },
    ],
  },
  {
    id: 'json-cle-dupliquee', level: 1, family: 'json',
    title: 'Clé JSON dupliquée',
    chain: [
      { name: 'Passerelle de validation', reads: 'Valide la première occurrence de la clé role' },
      { name: 'Service Node', reads: 'JSON.parse retient la dernière occurrence' },
    ],
    input: 'Le corps JSON d’une inscription contient deux fois la clé role, avec deux valeurs différentes.',
    divergence: [
      { text: 'La valeur validée n’est pas celle qui sera utilisée', right: true, why: 'La norme JSON ne tranche pas sur les clés dupliquées : chaque implémentation choisit, et deux implémentations raisonnables choisissent l’inverse l’une de l’autre.' },
      { text: 'Le document est invalide, et les deux composants devraient le rejeter', right: false, why: 'C’est ce qu’on aimerait, et ce n’est pas ce que dit la norme : un objet à clés répétées reste du JSON bien formé pour la plupart des analyseurs.' },
      { text: 'Node fusionne les deux valeurs de role dans un tableau', right: false, why: 'Aucun analyseur courant ne le fait. JSON.parse écrase au fur et à mesure : c’est la dernière occurrence qui reste dans l’objet.' },
    ],
    impact: [
      { text: 'Un rôle non autorisé traverse la validation sans être vu', right: true, why: 'La passerelle valide « user » et le service lit « admin » : les journaux de la passerelle montreront une inscription parfaitement conforme.' },
      { text: 'Le service revalide le corps et rejette la seconde valeur', right: false, why: 'S’il revalidait avec un schéma strict sur l’objet déjà analysé, il n’y aurait pas de problème. C’est justement le correctif, pas le comportement actuel.' },
      { text: 'La passerelle et le service divergent sur tous les champs du document', right: false, why: 'Seuls les champs dupliqués divergent. C’est ce qui rend la charge utile discrète : le reste du document est lu de façon identique des deux côtés.' },
    ],
    fix: [
      { text: 'Rejeter les clés dupliquées, ou transmettre l’objet déjà analysé', right: true, why: 'Deux façons de n’analyser qu’une fois : refuser l’ambiguïté à l’entrée, ou faire circuler la structure au lieu du texte. Dans les deux cas, plus de seconde lecture.' },
      { text: 'Faire revalider le corps par le service avec le même schéma que la passerelle', right: false, why: 'Bien meilleur que rien, et la validation du service porte sur sa propre lecture : il validera « admin » comme un rôle bien formé. Le schéma ne connaît pas l’autre occurrence.' },
      { text: 'Limiter la taille du corps et le nombre de clés acceptées par document', right: false, why: 'Une protection utile contre l’abus de ressources. Deux clés et quarante octets suffisent ici, donc aucune limite raisonnable ne gêne l’attaque.' },
    ],
  },
  {
    id: 'unicode-nfkc-tardif', level: 1, family: 'unicode',
    title: 'Normalisation Unicode tardive',
    chain: [
      { name: 'Validation à l’inscription', reads: 'Refuse le nom d’utilisateur « admin »' },
      { name: 'Stockage', reads: 'Normalise en NFKC : les caractères pleine largeur deviennent ASCII' },
    ],
    input: 'Un utilisateur s’inscrit avec un nom écrit en caractères pleine largeur, visuellement identique à « admin ».',
    divergence: [
      { text: 'On valide une forme et on en enregistre une autre', right: true, why: 'La normalisation a lieu après le contrôle : la chaîne refusée par la validation n’est pas celle qui arrive en base, alors que c’est la même donnée.' },
      { text: 'La base de données refuse les caractères hors du jeu ASCII', right: false, why: 'Elle les accepte, puis les transforme. Un refus pur et simple serait restrictif et, au moins, cohérent.' },
      { text: 'La validation compare les chaînes sans tenir compte de la casse', right: false, why: 'Une autre source classique de collision, et pas celle-ci : ici les deux chaînes n’ont pas les mêmes points de code, quelle que soit la casse.' },
    ],
    impact: [
      { text: 'Deux comptes partagent la même forme canonique après stockage', right: true, why: 'Selon ce que fait l’application de ce nom — mentions, recherche, contrôle d’accès, affichage dans un journal — la collision permet d’usurper l’autre compte ou de le masquer.' },
      { text: 'Le nom s’affiche avec des caractères illisibles dans l’interface', right: false, why: 'Il s’affichera au contraire parfaitement, puisqu’il a été normalisé. L’absence de trace visuelle est précisément ce qui rend la collision utile.' },
      { text: 'Le contrôle d’unicité rejette l’inscription, la forme existant déjà', right: false, why: 'Il le ferait s’il portait sur la forme normalisée. Il s’exécute avant la normalisation, donc sur deux chaînes qu’il voit comme différentes.' },
    ],
    fix: [
      { text: 'Normaliser avant de valider et de vérifier l’unicité, puis n’utiliser que cette forme', right: true, why: 'Canonicaliser d’abord, décider ensuite : les contrôles et le stockage regardent la même chaîne. La forme d’origine ne sert plus qu’à l’affichage, si elle sert.' },
      { text: 'N’accepter que les caractères ASCII dans les noms d’utilisateur', right: false, why: 'La collision disparaît, et avec elle les noms de la moitié du monde. Une restriction défendable pour un identifiant technique, pas pour un nom affiché.' },
      { text: 'Interdire explicitement les noms réservés dans toutes leurs variantes Unicode', right: false, why: 'Une liste noire de formes visuellement proches, à maintenir contre l’ensemble du jeu Unicode. Et elle ne dit rien des collisions entre comptes ordinaires.' },
    ],
  },
  {
    id: 'url-parse-whatwg', level: 2, family: 'url',
    title: 'Deux parsers d’URL',
    chain: [
      { name: 'Filtre anti-SSRF', reads: 'Extrait l’hôte avec l’ancienne API url.parse et le compare à une liste blanche' },
      { name: 'Client HTTP (fetch)', reads: 'Analyse l’URL avec l’API standard WHATWG URL' },
    ],
    input: 'Une URL de webhook fournie par un client est construite pour être lue différemment par les deux parsers.',
    divergence: [
      { text: 'Les deux ne trouvent pas le même hôte dans la même URL', right: true, why: 'Les deux API traitent différemment l’arobase, les barres obliques inversées et les caractères de contrôle : ce qui est un hôte pour l’une est une information d’identification pour l’autre.' },
      { text: 'Le client HTTP suit une redirection que le filtre n’a pas examinée', right: false, why: 'Un contournement bien réel du même filtre, et un autre mécanisme : ici l’URL initiale suffit, sans aucune redirection.' },
      { text: 'Le filtre résout le nom de domaine, et le client le résout à nouveau', right: false, why: 'C’est la course DNS, une troisième façon de passer ce filtre. Elle suppose deux résolutions ; la divergence décrite ici est purement syntaxique.' },
    ],
    impact: [
      { text: 'Le filtre valide un hôte public, le client atteint un service interne', right: true, why: 'La vérification n’a pas porté sur ce qui est réellement contacté : c’est la définition même du problème. Le service de métadonnées de l’instance est à un saut de là.' },
      { text: 'Le webhook est émis vers les deux hôtes, l’autorisé et l’interne', right: false, why: 'Une seule requête part, vers l’hôte que le client a extrait. Le filtre ne se connecte à rien, il se contente de valider.' },
      { text: 'Aucun impact, le client refusant par défaut les adresses privées', right: false, why: 'fetch ne filtre rien du tout : il ouvre la connexion qu’on lui demande, y compris vers 169.254.169.254 ou une adresse de boucle locale.' },
    ],
    fix: [
      { text: 'Un seul parser, et un filtrage de l’adresse IP au moment de la connexion', right: true, why: 'Analyser une fois supprime la divergence syntaxique ; vérifier l’adresse effectivement contactée couvre en plus les redirections et la course DNS.' },
      { text: 'Ajouter une expression régulière de contrôle sur l’URL avant le filtre', right: false, why: 'On introduit un troisième analyseur, avec sa propre interprétation : la probabilité d’un désaccord augmente au lieu de diminuer.' },
      { text: 'Faire sortir les appels sortants par un mandataire dédié en liste blanche', right: false, why: 'Une très bonne mesure d’architecture, et la deuxième meilleure réponse ici : elle couvre le trafic même quand le code se trompe. Elle demande simplement plus qu’un correctif.' },
    ],
  },
  {
    id: 'multipart-frontiere', level: 2, family: 'multipart',
    title: 'Frontière multipart',
    chain: [
      { name: 'Inspection à la bordure', reads: 'Découpe le corps multipart sur la frontière déclarée dans Content-Type' },
      { name: 'Framework applicatif', reads: 'Tolère les espaces et les guillemets autour de la frontière' },
    ],
    input: 'Un téléversement déclare une frontière multipart entourée de guillemets, avec un espace de fin, et contient deux parties « file ».',
    divergence: [
      { text: 'Les deux ne découpent pas le corps aux mêmes endroits', right: true, why: 'La tolérance du framework aux guillemets et aux espaces lui fait voir deux parties là où l’inspection n’en voit qu’une, ou l’inverse selon la construction.' },
      { text: 'La bordure refuse le document parce que la frontière est mal formée', right: false, why: 'Une implémentation stricte le ferait, et c’est ce qu’on voudrait. Celle-ci accepte et interprète, ce qui est le comportement le plus répandu.' },
      { text: 'Le framework concatène les deux parties « file » en un seul fichier', right: false, why: 'Certains frameworks conservent la dernière, d’autres en font un tableau ; aucun ne colle les contenus bout à bout.' },
    ],
    impact: [
      { text: 'Le fichier analysé n’est pas celui que l’application enregistre', right: true, why: 'L’inspection valide une partie anodine, le framework retient l’autre. Tout contrôle de type ou d’antivirus placé à la bordure porte alors sur le mauvais contenu.' },
      { text: 'Le téléversement échoue avec une erreur que l’attaquant peut observer', right: false, why: 'Un échec serait la bonne issue. L’attaque n’a d’intérêt que parce que les deux composants acceptent le document, chacun à sa manière.' },
      { text: 'Le fichier est enregistré deux fois, sous deux noms différents', right: false, why: 'Le framework n’en retient qu’un. La duplication serait au pire un problème de stockage, pas un contournement de contrôle.' },
    ],
    fix: [
      { text: 'Analyser une fois, et faire porter les contrôles sur les parties obtenues', right: true, why: 'Le composant qui enregistre est celui qui a découpé : il n’y a plus deux lectures à réconcilier. Les contrôles voient exactement l’octet qui sera écrit.' },
      { text: 'Rejeter les requêtes dont la frontière contient guillemets ou espaces', right: false, why: 'On ferme cette construction, et la famille est vaste : frontières vides, préfixes dupliqués, en-têtes de partie repliés sur plusieurs lignes.' },
      { text: 'Refuser tout corps multipart contenant plus d’une partie nommée « file »', right: false, why: 'Une bonne règle de robustesse, et elle suppose de savoir compter les parties — ce qui est précisément ce sur quoi les deux composants ne s’accordent pas.' },
    ],
  },
  {
    id: 'double-encodage', level: 2, family: 'chemin',
    title: 'Chemin encodé deux fois',
    chain: [
      { name: 'Mandataire inverse', reads: 'Décode le chemin une fois, puis applique ses règles de routage' },
      { name: 'Serveur d’application', reads: 'Décode ce qu’il reçoit, une seconde fois' },
    ],
    input: 'Une requête vise /files/..%252f..%252fetc/passwd, sur une route de téléchargement de pièces jointes.',
    divergence: [
      { text: 'Le nombre de décodages appliqués n’est pas le même des deux côtés', right: true, why: 'Le mandataire transforme %252f en %2f, qu’il voit comme un caractère ordinaire ; le serveur le décode à son tour en barre oblique, ce qui crée un segment de chemin après le routage.' },
      { text: 'Le mandataire refuse le chemin parce qu’il contient des points doublés', right: false, why: 'Après un seul décodage il ne voit pas de remontée : les deux points sont là, la barre oblique qui les rendrait dangereux ne l’est pas encore.' },
      { text: 'Le serveur d’application rejette les séquences de remontée de répertoire', right: false, why: 'Beaucoup de serveurs le font sur le chemin brut de l’URL. Ici la remontée n’apparaît qu’après son propre décodage, donc après ce contrôle.' },
    ],
    impact: [
      { text: 'Un fichier hors du répertoire des pièces jointes est servi', right: true, why: 'La route de téléchargement reçoit un nom qui remonte l’arborescence, et elle l’a reçu par un chemin que le routage jugeait inoffensif.' },
      { text: 'Le mandataire met en cache une réponse destinée à une autre route', right: false, why: 'Un risque réel quand le routage diverge, et ce n’est pas ce qui se joue ici : la réponse est bien celle de la route visée, avec un mauvais paramètre.' },
      { text: 'La requête est routée vers un service interne différent du service attendu', right: false, why: 'Cela arriverait si la divergence portait sur le préfixe de routage. Ici les deux composants s’accordent sur la route ; ils divergent sur ce qui la suit.' },
    ],
    fix: [
      { text: 'Décoder une fois, refuser ce qui reste encodé, et résoudre le chemin final', right: true, why: 'Trois gestes qui se complètent : plus de second décodage, plus d’ambiguïté acceptée, et un contrôle sur le fichier réellement ouvert plutôt que sur la chaîne demandée.' },
      { text: 'Faire refuser au mandataire tout chemin contenant le caractère pourcent', right: false, why: 'Efficace et coûteux : les noms de fichiers légitimes avec accents ou espaces arrivent encodés. On casse des téléchargements valides pour fermer une forme.' },
      { text: 'Servir les pièces jointes par identifiant, sans jamais accepter de nom', right: false, why: 'C’est la meilleure conception, et elle ne corrige pas la divergence : toutes les autres routes derrière ce mandataire gardent leur double décodage.' },
    ],
  },
  {
    id: 'saml-enveloppement', level: 2, family: 'xml',
    title: 'Signature XML et second parcours',
    chain: [
      { name: 'Bibliothèque de signature', reads: 'Vérifie la signature de l’élément désigné par son identifiant' },
      { name: 'Code applicatif', reads: 'Lit l’identité avec //Assertion/Subject/NameID, la première trouvée' },
    ],
    input: 'Une réponse SAML contient deux éléments Assertion : l’original signé, et une copie non signée placée avant lui.',
    divergence: [
      { text: 'L’élément vérifié n’est pas celui que l’application lit', right: true, why: 'La vérification suit une référence par identifiant, la lecture suit une position dans le document. Les deux parcours désignent des nœuds différents du même arbre.' },
      { text: 'La signature devient invalide parce que le document a été modifié', right: false, why: 'Elle reste valide : elle porte sur l’assertion d’origine, qui est intacte. L’ajout se fait à côté, sans toucher à ce qui est signé.' },
      { text: 'L’analyseur XML rejette un document contenant deux assertions', right: false, why: 'Le schéma SAML autorise plusieurs assertions dans une réponse, donc le document est valide. C’est ce qui rend l’enveloppement possible.' },
    ],
    impact: [
      { text: 'L’identité retenue est celle que l’attaquant a écrite', right: true, why: 'Il suffit de copier une assertion légitime, d’en changer le NameID et de la placer en premier : l’application accorde une session au nom de qui elle veut.' },
      { text: 'La session est créée puis invalidée à la première vérification suivante', right: false, why: 'Rien ne revérifie : la signature a été contrôlée une fois, à l’ouverture de session. La session qui en découle est ordinaire.' },
      { text: 'L’attaquant doit d’abord obtenir la clé privée du fournisseur d’identité', right: false, why: 'C’est tout l’intérêt de l’attaque : aucune signature n’est forgée. On réutilise une signature authentique sur un élément qu’elle ne couvre pas.' },
    ],
    fix: [
      { text: 'Lire l’identité dans le nœud que la vérification a renvoyé, pas dans le document', right: true, why: 'Le parcours disparaît : on ne cherche plus l’assertion, on utilise celle qui vient d’être validée. La question « laquelle ? » ne se pose plus.' },
      { text: 'Refuser les réponses SAML contenant plus d’un élément Assertion', right: false, why: 'Ferme cette construction, et l’enveloppement a d’autres formes : l’élément dupliqué peut vivre dans la signature elle-même, ou dans un conteneur que le schéma autorise.' },
      { text: 'Valider la réponse contre le schéma XML officiel avant toute vérification', right: false, why: 'Une bonne hygiène qui écarte les documents malformés. Celui-ci est parfaitement conforme au schéma : la validation ne dit rien de ce qui est signé.' },
    ],
  },
  {
    id: 'yaml-cle-dupliquee', level: 2, family: 'yaml',
    title: 'Deux lectures du même YAML',
    chain: [
      { name: 'Contrôle en intégration continue', reads: 'Analyse le manifeste avec un chargeur qui garde la première clé' },
      { name: 'Outil de déploiement', reads: 'Analyse le même fichier avec un chargeur qui garde la dernière' },
    ],
    input: 'Un manifeste Kubernetes déclare deux fois la clé securityContext dans le même conteneur.',
    divergence: [
      { text: 'Ce qui est contrôlé n’est pas ce qui sera appliqué', right: true, why: 'La spécification YAML interdit les clés dupliquées, mais laisse le comportement à l’implémentation : les chargeurs courants avertissent, gardent la première, ou gardent la dernière.' },
      { text: 'Le fichier n’est pas du YAML valide et devrait échouer à l’analyse', right: false, why: 'Formellement, une duplication rend le document non conforme — et en pratique la plupart des chargeurs l’acceptent, ce qui est toute la difficulté.' },
      { text: 'Les deux valeurs de securityContext sont fusionnées champ par champ', right: false, why: 'Aucun des deux chargeurs ne fusionne. La fusion existe dans les outils de surcharge, mais elle s’applique entre fichiers, pas entre clés d’un même document.' },
    ],
    impact: [
      { text: 'Un conteneur privilégié est déployé après un contrôle au vert', right: true, why: 'La politique lit la première déclaration, restrictive, et l’outil applique la seconde. Le journal d’audit montrera une chaîne de livraison entièrement conforme.' },
      { text: 'Le déploiement échoue au moment de l’application du manifeste', right: false, why: 'L’outil de déploiement trouve un manifeste qu’il sait lire, avec un contexte de sécurité valide. Rien ne signale l’anomalie.' },
      { text: 'La divergence est visible dans le différentiel de la pull request', right: false, why: 'Les deux clés y figurent, et rien ne dit laquelle gagnera : c’est justement l’information que le différentiel ne porte pas.' },
    ],
    fix: [
      { text: 'Un seul chargeur strict, qui refuse les clés dupliquées, partout dans la chaîne', right: true, why: 'L’ambiguïté est rejetée à l’entrée plutôt qu’arbitrée deux fois. Et un seul chargeur veut dire une seule interprétation, y compris pour les autres pièges du format.' },
      { text: 'Contrôler la politique à l’admission, sur l’objet reçu par l’interface', right: false, why: 'Très bonne défense, et la deuxième meilleure réponse : le contrôle voit l’objet final. Le décalage entre la revue et le déploiement subsiste pour tout le reste.' },
      { text: 'Générer les manifestes plutôt que de les écrire, pour éviter les doublons', right: false, why: 'Cela supprime la duplication accidentelle, pas la duplication délibérée : un manifeste généré peut être modifié en chemin, et la divergence attend toujours.' },
    ],
  },
  {
    id: 'adresse-double-arobase', level: 2, family: 'email',
    title: 'Adresse électronique lue deux fois',
    chain: [
      { name: 'Contrôle du domaine', reads: 'Prend ce qui suit le dernier arobase pour décider de l’appartenance au tenant' },
      { name: 'Envoi du courriel', reads: 'La bibliothèque SMTP retient l’adresse jusqu’au premier arobase' },
    ],
    input: 'Une invitation est envoyée à « victime@novafact.example@attaquant.example ».',
    divergence: [
      { text: 'Les deux ne délimitent pas l’adresse au même endroit', right: true, why: 'La grammaire des adresses autorise des formes que presque personne n’implémente pareil : ce qui est le domaine pour l’un fait partie de la partie locale pour l’autre.' },
      { text: 'L’adresse est syntaxiquement invalide et devrait être refusée partout', right: false, why: 'Sans guillemets, cette forme est effectivement douteuse — et la plupart des bibliothèques l’acceptent en appliquant leur propre règle de découpe.' },
      { text: 'Le serveur SMTP destinataire rejettera le message comme non délivrable', right: false, why: 'Il le délivrera à ce que sa propre lecture désigne, qui n’est pas forcément celle de l’expéditeur : une troisième interprétation s’ajoute à la chaîne.' },
    ],
    impact: [
      { text: 'L’invitation à rejoindre un tenant part vers un domaine étranger', right: true, why: 'Le contrôle conclut que l’adresse appartient au tenant et autorise l’envoi ; le message, lui, arrive ailleurs. Le lien d’invitation vaut un accès au tenant.' },
      { text: 'Le courriel part vers les deux domaines, dont celui du tenant', right: false, why: 'Un seul message est émis, vers l’adresse que la bibliothèque a extraite. Le domaine du tenant ne reçoit rien, donc personne ne s’étonne.' },
      { text: 'L’invitation est créée mais aucun message ne part, faute de destinataire', right: false, why: 'Ce serait le cas si la bibliothèque refusait l’adresse. Elle l’accepte, ce qui rend l’attaque silencieuse des deux côtés.' },
    ],
    fix: [
      { text: 'Normaliser l’adresse une fois, la rejeter si elle est ambiguë, puis n’utiliser qu’elle', right: true, why: 'Une seule représentation circule dans tout le traitement : celle sur laquelle le contrôle a statué est celle qu’on remet à la bibliothèque d’envoi.' },
      { text: 'Refuser les adresses contenant plus d’un arobase avant toute décision', right: false, why: 'Une règle raisonnable, qui ferme cette forme précise. Restent les guillemets, les commentaires entre parenthèses et les caractères Unicode qui se replient sur l’arobase.' },
      { text: 'Exiger une confirmation du destinataire avant d’activer l’accès au tenant', right: false, why: 'Bonne pratique, et sans effet : c’est le destinataire non prévu qui reçoit le message, donc c’est lui qui confirmera.' },
    ],
  },
  {
    id: 'hpp-dup-params', level: 1, family: 'hpp',
    title: 'Paramètre répété deux fois',
    chain: [
      { name: 'Règle de la passerelle', reads: 'Inspecte la première valeur du paramètre role' },
      { name: 'Express (qs)', reads: 'Regroupe les occurrences répétées dans un tableau ["user", "admin"]' },
    ],
    input: 'Une requête répète le paramètre : ?role=user&role=admin. La route lit req.query.role, et prend le dernier élément si c’est un tableau.',
    divergence: [
      { text: 'Les deux ne retiennent pas la même valeur du paramètre', right: true, why: 'Express, via qs, agrège les occurrences en tableau ; la passerelle ne regarde que la première entrée. La valeur inspectée n’est pas celle que le code manipule.' },
      { text: 'Express ne conserve que la dernière occurrence du paramètre', right: false, why: 'C’est le comportement de PHP ou d’ASP.NET ; qs, lui, construit un tableau. Rien n’est écrasé : les deux valeurs arrivent, et c’est le code qui choisit laquelle lire.' },
      { text: 'La passerelle refuse toute requête au paramètre dupliqué', right: false, why: 'Ce serait une défense possible, et ce n’est pas celle décrite : elle valide la première valeur et transmet la requête telle quelle.' },
    ],
    impact: [
      { text: 'La valeur contrôlée diffère de la valeur appliquée', right: true, why: 'La passerelle voit « user » et le laisse passer ; la route applique « admin ». Le contrôle a porté sur une donnée que le code n’utilise pas.' },
      { text: 'La route échoue, req.query.role étant un tableau et non une chaîne', right: false, why: 'Elle échouerait si le code comparait role à une chaîne sans le prévoir. Ici il lit le dernier élément, donc il obtient « admin » sans erreur.' },
      { text: 'Les deux valeurs sont concaténées en « user,admin »', right: false, why: 'C’est ce que fait la couche de certains serveurs, pas qs : il produit un tableau, jamais une chaîne jointe par des virgules.' },
    ],
    fix: [
      { text: 'Fixer une seule valeur par paramètre en amont, puis la faire circuler', right: true, why: 'Un paramètre répété est réduit à une valeur unique une fois pour toutes, avant tout contrôle. Les deux composants lisent alors la même chose, parce qu’il n’y a plus qu’une chose à lire.' },
      { text: 'Configurer la passerelle pour rejeter les paramètres répétés connus', right: false, why: 'On ferme la liste des paramètres qu’on a pensé à protéger. Le suivant — un filtre, un tri, un identifiant de tenant — passe avec la même technique.' },
      { text: 'Lire toujours la première occurrence côté application', right: false, why: 'Les deux composants s’accordent enfin… sur une valeur que l’attaquant contrôle tout autant : il lui suffit de mettre sa charge en premier.' },
    ],
  },
  {
    id: 'json-grand-nombre', level: 1, family: 'json',
    title: 'Montant au-delà du safe integer',
    chain: [
      { name: 'Service comptable (JSON.parse)', reads: 'Lit amountCents comme un number JavaScript' },
      { name: 'Grand livre (BigInt / Postgres bigint)', reads: 'Conserve l’entier exact sur 64 bits' },
    ],
    input: 'Un avoir déclare "amountCents": 9007199254740993 dans son corps JSON.',
    divergence: [
      { text: 'Le nombre lu par le service n’est pas l’entier écrit', right: true, why: 'Au-delà de 2^53, un number JavaScript perd des unités : JSON.parse rend 9007199254740992, pas 993. Le grand livre, sur 64 bits, garde la valeur exacte.' },
      { text: 'JSON.parse rejette un entier trop grand pour un number', right: false, why: 'Il ne rejette rien : il arrondit silencieusement à l’entier représentable le plus proche. C’est justement l’absence d’erreur qui rend le décalage discret.' },
      { text: 'Le service transforme le grand nombre en chaîne de caractères', right: false, why: 'Il faudrait un reviver ou un parseur en mode « bigint » pour cela. JSON.parse par défaut produit un number, avec sa précision limitée.' },
    ],
    impact: [
      { text: 'Deux composants persistent deux montants différents', right: true, why: 'Le service valide et journalise une valeur, la base en stocke une autre. Un écart d’un centime sur un rapprochement comptable est exactement le genre de chose qu’on ne cherche pas là.' },
      { text: 'Le calcul lève une exception de dépassement de capacité', right: false, why: 'JavaScript n’a pas de dépassement d’entier : il glisse vers l’imprécision sans prévenir, ce qui est pire qu’une exception.' },
      { text: 'Le montant s’affiche en notation scientifique dans l’interface', right: false, why: 'Un entier de cet ordre s’affiche normalement ; seuls ses derniers chiffres sont faux. Rien à l’écran ne signale le problème.' },
    ],
    fix: [
      { text: 'Transporter les montants en chaîne, décodés à l’identique partout', right: true, why: 'Le type qui circule n’a plus de zone d’imprécision : chaque composant lit le même entier parce qu’aucun ne le fait passer par un number flottant.' },
      { text: 'Plafonner le champ amountCents à une valeur inférieure à 2^53 partout', right: false, why: 'Le seuil écarte les cas extrêmes, et rien ne garantit qu’un montant légitime ne les atteindra jamais — une facture en centimes de roupie, un cumul. On repousse la limite, on ne la supprime pas.' },
      { text: 'Arrondir le montant au centime juste après sa lecture, des deux côtés', right: false, why: 'L’imprécision est déjà là avant l’arrondi : on arrondirait une valeur déjà fausse. Le mal est fait au moment du parse, pas après.' },
    ],
  },
  {
    id: 'json-bom-pipeline', level: 1, family: 'json',
    title: 'Corps JSON précédé d’un BOM',
    chain: [
      { name: 'Pipeline d’analytics (JSON.parse brut)', reads: 'Analyse le corps avec JSON.parse, sans prétraitement' },
      { name: 'API Express (body-parser)', reads: 'Retire le BOM en tête avant d’analyser le corps' },
    ],
    input: 'Un webhook envoie un corps JSON précédé d’un caractère BOM (U+FEFF) : \\uFEFF{"event":"paid"}.',
    divergence: [
      { text: 'Un composant analyse le corps, l’autre échoue', right: true, why: 'JSON.parse d’un texte commençant par U+FEFF lève une SyntaxError ; body-parser retire ce BOM avant d’appeler l’analyseur. Le même octet est du bruit pour l’un et une erreur pour l’autre.' },
      { text: 'Les deux composants analysent le BOM comme une clé vide dans l’objet', right: false, why: 'Aucun des deux : soit il est retiré, soit il fait échouer l’analyse entière. Le BOM ne devient jamais une clé.' },
      { text: 'Le pipeline retire le BOM et Express le conserve', right: false, why: 'C’est l’inverse : body-parser tolère le BOM, JSON.parse brut ne le tolère pas. La formulation intervertit les deux comportements.' },
    ],
    impact: [
      { text: 'L’événement est traité par l’API mais absent des analytics', right: true, why: 'L’API paie la facture, le pipeline d’analytics rejette silencieusement le message. Le suivi de fraude et la comptabilité voient deux réalités différentes.' },
      { text: 'Les deux composants rejettent le message pour syntaxe invalide', right: false, why: 'Express l’accepte : il a nettoyé le BOM. Un rejet des deux côtés serait au moins cohérent, ce que ce scénario n’est pas.' },
      { text: 'Le BOM est stocké et corrompt le premier champ en base', right: false, why: 'Express l’a retiré avant l’analyse : rien de corrompu n’atteint la base côté API. Le pipeline, lui, n’écrit rien du tout.' },
    ],
    fix: [
      { text: 'Normaliser l’encodage en un seul endroit, puis diffuser ce texte', right: true, why: 'Le nettoyage du BOM cesse d’être une particularité de body-parser : chaque consommateur reçoit un texte déjà normalisé, et lit donc la même chose.' },
      { text: 'Faire tolérer le BOM au pipeline d’analytics, comme le fait déjà Express', right: false, why: 'On aligne ces deux composants-là, et le troisième qui lira le flux demain aura sa propre tolérance. On rattrape les divergences une à une.' },
      { text: 'Rejeter à la bordure tout corps ne commençant pas par une accolade', right: false, why: 'Une règle stricte, qui casse les corps légitimes émis par des clients qui ajoutent un BOM par défaut — et il y en a. On échange une divergence contre des faux refus.' },
    ],
  },
  {
    id: 'cache-deception-chatgpt', level: 2, family: 'cache',
    title: 'Point de terminaison de session en .css',
    chain: [
      { name: 'CDN', reads: 'Met en cache les réponses dont l’URL se termine par une extension statique' },
      { name: 'Application', reads: 'La route /api/auth/session ignore le suffixe et renvoie le jeton de session' },
    ],
    input: 'Un lien vers /api/auth/session/x.css est envoyé à un utilisateur connecté (cf. la web cache deception de ChatGPT, Gal Nagli, 2023).',
    divergence: [
      { text: 'L’un juge la ressource à son extension, l’autre à sa route', right: true, why: 'Le cas ChatGPT de 2023 : le CDN déduit « .css donc statique donc public » d’un suffixe, l’application sert un JSON de session. La même URL appartient à deux catégories.' },
      { text: 'L’application renvoie une feuille de style au lieu du jeton', right: false, why: 'Elle ne consulte pas le suffixe : la route absorbe le chemin et renvoie la session. Il n’y a aucune feuille de style dans cette réponse.' },
      { text: 'Le CDN retire l’en-tête Cookie des requêtes qu’il juge statiques', right: false, why: 'Certaines configurations le font, et cela anonymiserait la réponse. Celle-ci transmet le cookie, donc la session revient personnalisée.' },
    ],
    impact: [
      { text: 'La session de la victime est stockée, puis lue par l’attaquant', right: true, why: 'Il fait visiter l’URL à la victime, puis la demande lui-même : le cache lui sert le jeton stocké. Chez ChatGPT, cela donnait accès au compte et à l’historique.' },
      { text: 'La victime voit une page cassée, ce qui finit par l’alerter', right: false, why: 'Rien ne l’alerte : le navigateur ignore un JSON servi comme CSS, et l’utilisateur ne voit aucune différence. L’absence de signal fait tout l’intérêt de l’attaque.' },
      { text: 'Sans une XSS préalable, l’attaquant ne peut rien lire de la réponse', right: false, why: 'Aucune XSS n’intervient : il demande l’URL depuis son propre navigateur et récupère la réponse mise en cache.' },
    ],
    fix: [
      { text: 'Marquer non cachable toute réponse authentifiée, et ne cacher que des chemins déclarés', right: true, why: 'Cache-Control: private, no-store sur les réponses de session, et un cache qui ne devine plus par extension. Les deux couches cessent de raisonner sur le suffixe.' },
      { text: 'Ajouter à la bordure une règle qui exclut du cache toutes les URL contenant /api/', right: false, why: 'On ferme le préfixe observé. Une autre route authentifiée sans /api/, ou un point de terminaison ajouté plus tard, retombe dans le piège du suffixe.' },
      { text: 'Interdire à la bordure les chemins de /api/ qui portent une extension', right: false, why: 'Meilleur que la règle de préfixe, et toujours une énumération : il reste à définir ce qu’est une extension, et le cache continue de deviner pour tout le reste du site.' },
    ],
    avoid: ['cache-deception-css'],
  },
  {
    id: 'ssrf-decimal-ip', level: 2, family: 'url',
    title: 'Adresse IP en notation décimale',
    chain: [
      { name: 'Filtre anti-SSRF', reads: 'Extrait l’hôte, le compare à une liste de plages internes interdites' },
      { name: 'Client HTTP + résolveur', reads: 'Interprète 2130706433 et 0x7f.1 comme 127.0.0.1' },
    ],
    input: 'Un webhook pointe vers http://2130706433/ (ou http://0x7f.1/). Le filtre compare la chaîne d’hôte à « 127.0.0.1 » et « 10.0.0.0/8 ».',
    divergence: [
      { text: 'Le filtre compare une chaîne, la pile réseau résout une adresse', right: true, why: 'La fonction de résolution accepte les formes décimale et hexadécimale abrégées d’IPv4 : 2130706433 et 0x7f.1 donnent 127.0.0.1. Le filtre, lui, ne voit qu’une chaîne qui ne ressemble à aucune plage interdite.' },
      { text: 'Le client HTTP suit une redirection que le filtre n’a pas vue', right: false, why: 'Un vrai contournement du même filtre, et un autre mécanisme : ici l’URL initiale suffit, sans aucune redirection.' },
      { text: 'Le filtre résout d’abord le nom, et le client le résout à nouveau', right: false, why: 'C’est la course DNS, une troisième façon de passer. Elle suppose deux résolutions d’un nom ; ici il n’y a pas de nom, seulement un entier qui est déjà une adresse.' },
    ],
    impact: [
      { text: 'Le filtre valide un hôte inconnu, le client joint la boucle', right: true, why: 'La vérification a porté sur une représentation, la connexion sur une autre. Le service de métadonnées de l’instance ou une API d’administration en local sont alors joignables.' },
      { text: 'La connexion échoue, car l’hôte n’est pas un nom d’hôte valide', right: false, why: 'La pile réseau accepte parfaitement ces formes : dns.lookup et le client résolvent 2130706433 en 127.0.0.1. Rien n’échoue.' },
      { text: 'Le webhook part finalement vers l’adresse publique équivalente', right: false, why: 'Il n’y a pas d’équivalent public : 2130706433 est 127.0.0.1, une adresse de boucle locale. La requête reste dans la machine.' },
    ],
    fix: [
      { text: 'Résoudre l’hôte une fois, filtrer l’adresse obtenue, s’y connecter', right: true, why: 'On ne compare plus des chaînes mais l’adresse réellement contactée : décimale, hexadécimale ou nom, toutes convergent vers le même octet, et c’est lui qu’on vérifie.' },
      { text: 'Rejeter tous les hôtes qui ne sont pas en notation décimale pointée classique', right: false, why: 'On ferme deux formes et il en reste : IPv6 abrégé, adresses mappées, zéros de tête octaux. Chaque notation exotique en ajoute une à interdire.' },
      { text: 'Faire sortir les appels par un mandataire en liste blanche de domaines', right: false, why: 'Une excellente mesure d’architecture, et la deuxième meilleure réponse : elle protège même quand le code se trompe. Elle demande simplement plus qu’un correctif de parsing.' },
    ],
    avoid: ['url-parse-whatwg'],
  },
  {
    id: 'unicode-github-dotless-i', level: 2, family: 'unicode',
    title: 'Collision de casse à la réinitialisation',
    chain: [
      { name: 'Recherche du compte', reads: 'Met l’adresse en majuscules pour retrouver l’utilisateur' },
      { name: 'Envoi du courriel', reads: 'Expédie le lien à l’adresse telle qu’elle a été saisie' },
    ],
    input: 'Une réinitialisation est demandée pour « victime@novafact.example » écrite avec un « ı » sans point (cf. la collision de casse Unicode signalée sur GitHub, 2019).',
    divergence: [
      { text: 'La casse fait converger deux adresses distinctes vers une seule', right: true, why: 'Le cas GitHub de 2019 : « ı » (U+0131) passé en majuscules devient « I ». La recherche trouve le compte de la victime, mais le lien part vers l’adresse d’origine, celle de l’attaquant.' },
      { text: 'La base refuse les adresses hors du jeu ASCII', right: false, why: 'Elle les accepte : c’est la mise en majuscules au moment de la recherche qui crée la collision, pas un filtre sur les caractères.' },
      { text: 'La comparaison ignore la casse sans transformer les points de code', right: false, why: 'Une autre source de collision, et pas celle-ci : ici c’est la conversion de casse elle-même qui replie « ı » sur « I », indépendamment de toute comparaison.' },
    ],
    impact: [
      { text: 'Le lien de réinitialisation d’un compte part vers une autre adresse', right: true, why: 'La recherche a désigné le compte de la victime, l’envoi a visé l’adresse saisie par l’attaquant. Le lien vaut une prise de contrôle du compte.' },
      { text: 'Deux comptes distincts fusionnent en base après la réinitialisation', right: false, why: 'Rien ne fusionne : un seul compte est trouvé, et c’est vers un tiers que le lien est envoyé. Le compte de la victime reste intact, mais son lien est parti ailleurs.' },
      { text: 'L’adresse s’affiche avec un caractère illisible dans le corps de l’e-mail', right: false, why: 'Le « ı » s’affiche normalement, et de toute façon la victime ne reçoit rien. L’absence de trace est ce qui rend l’attaque silencieuse.' },
    ],
    fix: [
      { text: 'N’écrire qu’à l’adresse enregistrée en base, pas à la saisie', right: true, why: 'La collision peut survenir sans conséquence : le destinataire est l’adresse réelle du compte trouvé, pas celle que l’attaquant a tapée. Les deux étapes lisent la même valeur.' },
      { text: 'Normaliser l’adresse en casefold Unicode avant de rechercher le compte', right: false, why: 'Utile pour comparer, et insuffisant seul : si l’envoi continue de viser la saisie, une collision de casefold rouvre exactement le même écart.' },
      { text: 'N’accepter que les adresses en caractères ASCII', right: false, why: 'La collision disparaît, et avec elle des adresses parfaitement valides d’une bonne partie du monde. Défendable pour un identifiant technique, pas pour une adresse de courriel.' },
    ],
    avoid: ['unicode-nfkc-tardif'],
  },
  {
    id: 'go-json-last-key', level: 2, family: 'json',
    title: 'Clé dupliquée entre deux langages',
    chain: [
      { name: 'Service d’autorisation (Go)', reads: 'encoding/json retient la dernière occurrence de la clé' },
      { name: 'Proxy applicatif (Node)', reads: 'JSON.parse retient aussi la dernière — mais valide la première' },
    ],
    input: 'Un corps déclare deux fois "action" ; le proxy valide "action":"read" trouvée d’abord, le service Go lit l’objet décodé (cf. Trail of Bits, « footguns in Go’s parsers », Vasco Franco, 2025).',
    divergence: [
      { text: 'La valeur validée n’est pas celle que le service décode', right: true, why: 'Trail of Bits (2025) : encoding/json de Go garde la dernière occurrence, sans moyen de l’en empêcher. Si le proxy valide la première valeur du texte, les deux composants divergent.' },
      { text: 'Go fusionne les deux valeurs de « action » dans un tableau', right: false, why: 'Aucun des deux ne fusionne : Go écrase au profit de la dernière, exactement comme JSON.parse. C’est la couche de validation qui regarde ailleurs.' },
      { text: 'Le service Go rejette un objet à clés dupliquées', right: false, why: 'La norme JSON laisse le choix, et encoding/json accepte sans broncher. Un rejet serait le correctif, pas le comportement observé.' },
    ],
    impact: [
      { text: 'Une action refusée passe le contrôle sous une action permise', right: true, why: 'Le proxy voit « read » et autorise ; le service exécute « delete ». Le journal du proxy montrera une requête parfaitement conforme.' },
      { text: 'Le service et le proxy divergent sur l’ensemble du document', right: false, why: 'Seule la clé dupliquée diverge. C’est ce qui rend la charge discrète : le reste du corps est lu de façon identique des deux côtés.' },
      { text: 'Le proxy transmet au service un document que Go ne sait pas décoder', right: false, why: 'Go le décode très bien : il choisit simplement la dernière valeur. Il n’y a pas d’erreur de décodage à observer.' },
    ],
    fix: [
      { text: 'Refuser les clés dupliquées à l’entrée, ou transmettre l’objet déjà décodé', right: true, why: 'Deux façons de n’analyser qu’une fois : interdire l’ambiguïté, ou faire circuler la structure plutôt que le texte. Dans les deux cas, plus de seconde lecture divergente.' },
      { text: 'Faire valider le corps par le service Go avec exactement le même schéma que le proxy', right: false, why: 'Mieux que rien, et le schéma portera sur la lecture de Go : il validera « delete » comme une action bien formée. Il ne connaît pas l’autre occurrence.' },
      { text: 'Aligner le proxy pour qu’il lise lui aussi la dernière occurrence', right: false, why: 'Les deux s’accordent enfin sur la même valeur — celle que l’attaquant a placée en dernier. On a supprimé la divergence sans supprimer le contrôle qu’elle contournait.' },
    ],
    avoid: ['json-cle-dupliquee'],
  },
  {
    id: 'go-json-case', level: 3, family: 'json',
    title: 'Champ apparié sans égard à la casse',
    chain: [
      { name: 'Passerelle (liste noire de clés)', reads: 'Refuse un corps contenant la clé exacte "isAdmin"' },
      { name: 'Service Go (struct)', reads: 'Associe "isadmin", "ISADMIN" ou "isAdmın" au champ IsAdmin' },
    ],
    input: 'Un corps contient "isadmin": true, ou une variante Unicode comme "ısadmin" (cf. Trail of Bits, « footguns in Go’s parsers », 2025).',
    divergence: [
      { text: 'Le service apparie un champ que la passerelle ne reconnaît pas', right: true, why: 'Trail of Bits (2025) : encoding/json apparie les noms de champ sans égard à la casse, et jusqu’à des variantes Unicode (le « ſ » long, le K Kelvin). La liste noire cherche une chaîne exacte ; Go, lui, la retrouve déguisée.' },
      { text: 'Go refuse les clés dont la casse ne correspond pas au champ', right: false, why: 'C’est l’inverse de son comportement documenté : il préfère la correspondance exacte, mais accepte une correspondance insensible à la casse. C’est cette tolérance qui ouvre la brèche.' },
      { text: 'La passerelle normalise elle-même la casse avant de comparer les clés', right: false, why: 'Si elle le faisait, elle verrait « isadmin » comme « isAdmin » et le bloquerait. Le scénario est précisément celui où elle compare des chaînes brutes.' },
    ],
    impact: [
      { text: 'Un champ interdit est peuplé via une casse que le contrôle ne couvre pas', right: true, why: 'La passerelle laisse passer « isadmin », que sa liste noire ne connaît pas ; Go le range dans IsAdmin. Le mass assignment se fait sur un nom que personne n’a filtré.' },
      { text: 'Le champ conserve sa valeur par défaut, faute de correspondance exacte de casse', right: false, why: 'Go trouve la correspondance malgré la casse : le champ est bien affecté. C’est l’attente d’un appariement strict qui trompe le défenseur.' },
      { text: 'Le service lève une erreur de décodage en rencontrant un champ inconnu', right: false, why: 'Par défaut, encoding/json ignore les champs vraiment inconnus et apparie ceux qui correspondent à la casse près. Aucune erreur n’est levée.' },
    ],
    fix: [
      { text: 'Décoder en mode strict et n’accepter que les champs attendus', right: true, why: 'On cesse de deviner les noms interdits : on n’accepte que les champs explicitement prévus, dans une structure d’entrée dédiée. La casse et l’Unicode n’ont plus de prise, faute de liste à contourner.' },
      { text: 'Allonger la liste noire avec toutes les variantes de casse déjà connues', right: false, why: 'Insensible à la casse veut dire une infinité de formes, sans compter les équivalences Unicode. La liste ne rattrapera jamais l’ensemble des graphies que Go, lui, apparie.' },
      { text: 'Comparer les clés en minuscules dans la passerelle', right: false, why: 'On rattrape la casse ASCII, pas les replis Unicode que Go accepte : « ſ » vers « s », le K Kelvin vers « k ». La passerelle et le service ne normalisent toujours pas de la même façon.' },
    ],
    avoid: ['json-cle-dupliquee', 'go-json-last-key'],
  },
  {
    id: 'h2-cl-netflix', level: 3, family: 'smuggling',
    title: 'Downgrade HTTP/2 vers HTTP/1.1',
    chain: [
      { name: 'Terminaison HTTP/2', reads: 'Reçoit la requête en trames, avec une longueur implicite' },
      { name: 'Réécriture en HTTP/1.1', reads: 'Reconstruit la requête et fait confiance au Content-Length fourni' },
      { name: 'Backend HTTP/1.1', reads: 'Délimite la requête sur ce Content-Length' },
    ],
    input: 'Une requête HTTP/2 déclare un Content-Length plus court que son corps réel (cf. Netflix, H2.CL, James Kettle « HTTP/2: The Sequel is Always Worse », 2021).',
    divergence: [
      { text: 'Le downgrade fait confiance à une longueur que HTTP/2 rendait pourtant inutile', right: true, why: 'Le cas Netflix (2021) : en HTTP/2 la longueur est implicite, mais la couche de traduction recopie le Content-Length du client dans la requête HTTP/1.1 sans le recalculer. Le reste du corps devient un préfixe de la requête suivante.' },
      { text: 'La terminaison HTTP/2 et le backend ne parlent pas la même version', right: false, why: 'C’est vrai de toute architecture avec downgrade, et sans conséquence en soi : le problème naît de la longueur recopiée, pas de la différence de version.' },
      { text: 'Le backend applique Transfer-Encoding là où la terminaison applique Content-Length', right: false, why: 'C’est la variante H2.TE, une autre divergence. Ici il n’y a pas de Transfer-Encoding : la faille tient au seul Content-Length propagé.' },
    ],
    impact: [
      { text: 'Des octets sont lus comme le début de la requête d’un autre client', right: true, why: 'La connexion HTTP/1.1 vers le backend est partagée et désynchronisée : chez Netflix, cela permettait de rediriger des victimes et de voler leurs identifiants.' },
      { text: 'La requête est simplement tronquée, puis renvoie une erreur au client', right: false, why: 'Une troncature isolée ne donne rien : c’est la réutilisation de la connexion qui transforme le corps résiduel en requête pour la victime suivante.' },
      { text: 'Seule la terminaison HTTP/2 est affectée, le backend restant sain', right: false, why: 'C’est le backend qui reçoit une requête mal délimitée : la terminaison, elle, a fait son travail sur des trames valides. Le mal apparaît après la traduction.' },
    ],
    fix: [
      { text: 'Recalculer la longueur au downgrade, et refuser les requêtes ambiguës', right: true, why: 'La couche de traduction ne fait plus confiance au client : elle mesure le corps qu’elle a réellement reçu. L’ambiguïté ne survit pas au passage en HTTP/1.1.' },
      { text: 'Filtrer les en-têtes Content-Length qui ne correspondent pas à la taille annoncée', right: false, why: 'En HTTP/2 la « taille annoncée » est justement la longueur réelle des trames : le bon geste est de l’utiliser, pas de comparer deux valeurs dont une est fausse par construction.' },
      { text: 'Maintenir HTTP/2 jusqu’au backend pour tout le trafic', right: false, why: 'La meilleure architecture, et la deuxième meilleure réponse ici : elle supprime le downgrade, donc la classe entière. Elle suppose de refaire la chaîne, ce qu’un correctif immédiat ne peut pas exiger.' },
    ],
    avoid: ['cl-te-generique', 'h2-te-alb'],
  },
  {
    id: 'h2-te-alb', level: 3, family: 'smuggling',
    title: 'Transfer-Encoding accepté en HTTP/2',
    chain: [
      { name: 'Client HTTP/2', reads: 'Envoie un en-tête Transfer-Encoding: chunked, interdit par la norme HTTP/2' },
      { name: 'Load balancer', reads: 'Recopie cet en-tête dans la requête HTTP/1.1 au lieu de le rejeter' },
      { name: 'Backend HTTP/1.1', reads: 'Délimite la requête sur Transfer-Encoding, ignorant le Content-Length' },
    ],
    input: 'Une requête HTTP/2 porte Transfer-Encoding: chunked (cf. AWS ALB, H2.TE, James Kettle 2021, chaîne OAuth de Verizon).',
    divergence: [
      { text: 'Un en-tête que HTTP/2 interdit est propagé au lieu d’être rejeté', right: true, why: 'Le cas ALB (2021) : la norme HTTP/2 interdit Transfer-Encoding, mais le load balancer le recopiait dans la requête HTTP/1.1. Le backend délimitait alors sur ce chunked, pas sur la longueur calculée.' },
      { text: 'Le client et le backend divergent parce qu’ils ne parlent pas la même version', right: false, why: 'La différence de version est le décor, pas la cause : c’est la propagation d’un en-tête proscrit qui crée la désynchronisation.' },
      { text: 'Le backend recalcule le Content-Length et ignore le corps chunké', right: false, why: 'Il fait l’inverse : présenté avec Transfer-Encoding, il l’applique en priorité sur Content-Length. C’est ce choix qui rend l’attaque possible.' },
    ],
    impact: [
      { text: 'Le trafic d’autres utilisateurs est capté sur la connexion', right: true, why: 'La désynchronisation permet de préfixer la requête suivante : dans la chaîne OAuth de Verizon (2021), cela menait à la fuite de codes d’autorisation via le Referer.' },
      { text: 'Le load balancer plante aussitôt en recevant un en-tête interdit', right: false, why: 'Il ne plante pas : il accepte et transmet, ce qui est justement le défaut. Un plantage aurait fermé la brèche.' },
      { text: 'Seules les requêtes dépourvues de corps sont réellement concernées', right: false, why: 'C’est le contraire : l’attaque repose sur un corps chunké interprété différemment. Une requête sans corps ne porte aucune divergence de délimitation.' },
    ],
    fix: [
      { text: 'Faire rejeter par la bordure tout Transfer-Encoding reçu en HTTP/2', right: true, why: 'La norme le proscrit : la bordure applique la règle au lieu de la contourner. L’en-tête n’atteint jamais la requête HTTP/1.1, donc il n’y a plus rien à réconcilier.' },
      { text: 'Normaliser le corps en Content-Length au moment du downgrade', right: false, why: 'Bon réflexe pour la longueur, et il laisse la porte au chunked propagé : tant que l’en-tête Transfer-Encoding survit, le backend le préférera au Content-Length recalculé.' },
      { text: 'Interdire au backend d’appliquer un Transfer-Encoding sur du HTTP/1.1', right: false, why: 'On durcit le mauvais composant : le backend a raison d’implémenter HTTP/1.1. C’est la bordure qui aurait dû ne jamais laisser passer cet en-tête.' },
    ],
    avoid: ['cl-te-generique', 'h2-cl-netflix'],
  },
  {
    id: 'crlf-cache-netlify', level: 3, family: 'cache',
    title: 'Retour à la ligne injecté en HTTP/2',
    chain: [
      { name: 'Client HTTP/2', reads: 'Place un retour à la ligne dans la valeur d’un en-tête' },
      { name: 'CDN', reads: 'Traduit en HTTP/1.1 sans valider les caractères de contrôle' },
      { name: 'Backend', reads: 'Interprète la valeur repliée comme un en-tête distinct' },
    ],
    input: 'Une requête HTTP/2 glisse « \\r\\nTransfer-Encoding: chunked » dans la valeur d’un en-tête (cf. la page d’accueil de Firefox via Netlify, James Kettle 2021).',
    divergence: [
      { text: 'Un retour à la ligne toléré devient un séparateur d’en-têtes', right: true, why: 'Le cas Firefox/Netlify (2021) : en HTTP/2 les valeurs peuvent contenir des octets qu’HTTP/1.1 traite comme des délimiteurs. La traduction sans validation transforme une valeur en en-tête supplémentaire.' },
      { text: 'Le CDN et le backend ne s’accordent pas sur le nom exact de l’en-tête', right: false, why: 'Ils s’accordent sur les noms : c’est l’injection d’une ligne entière, via le retour à la ligne, qui crée un en-tête que le client n’était pas censé pouvoir poser.' },
      { text: 'Le backend rejette la requête à cause du caractère de contrôle injecté', right: false, why: 'Après traduction, le backend ne voit plus un caractère de contrôle mais deux lignes valides. Le contrôle aurait dû avoir lieu à la bordure, avant la conversion.' },
    ],
    impact: [
      { text: 'Une réponse empoisonnée est mise en cache et servie à tous', right: true, why: 'L’en-tête injecté permet un empoisonnement du cache : chez Firefox/Netlify, l’attaque pouvait prendre le contrôle de chaque page servie depuis le CDN.' },
      { text: 'Seul l’auteur de la requête voit l’en-tête qui a été ajouté', right: false, why: 'Si la réponse est cachable, elle est servie aux visiteurs suivants. C’est la mise en cache qui transforme une manipulation locale en attaque de masse.' },
      { text: 'Le cache se contente de renvoyer une simple erreur pour cette URL', right: false, why: 'L’attaque vise une réponse valide et cachable, pas une erreur : c’est son stockage puis sa rediffusion qui font le dégât.' },
    ],
    fix: [
      { text: 'Valider les caractères de contrôle à la bordure, avant toute traduction', right: true, why: 'Une valeur d’en-tête contenant un retour à la ligne est refusée avant d’être reconstruite : elle ne peut plus se scinder en deux lignes puisqu’elle n’est jamais recopiée telle quelle.' },
      { text: 'Retirer l’en-tête Transfer-Encoding des requêtes juste après la traduction', right: false, why: 'On nettoie l’en-tête connu de cet exemple ; l’injection sert à en poser d’autres — Host, en-têtes de routage internes. Le vecteur, c’est le retour à la ligne, pas l’en-tête précis.' },
      { text: 'Réduire la durée de conservation en cache des pages concernées', right: false, why: 'La fenêtre rétrécit, la faille demeure : sur un site à fort trafic, quelques secondes de cache empoisonné touchent déjà beaucoup de monde.' },
    ],
  },
  {
    id: 'response-queue-jira', level: 3, family: 'smuggling',
    title: 'File des réponses désynchronisée',
    chain: [
      { name: 'Client', reads: 'Envoie une requête qui en contient une seconde, cachée' },
      { name: 'Proxy frontal', reads: 'Termine la requête sur un double retour à la ligne et en transmet deux' },
      { name: 'Backend', reads: 'Répond aux deux, décalant la file des réponses' },
    ],
    input: 'Une requête est construite pour que le frontal en voie deux (cf. Atlassian Jira, response queue poisoning, James Kettle 2021).',
    divergence: [
      { text: 'Le frontal compte une requête de plus que le client n’en a envoyé', right: true, why: 'Le cas Jira (2021) : le frontal terminait une requête sur un double retour à la ligne et en transmettait deux au backend. Les réponses reviennent alors décalées d’un cran par rapport aux demandes.' },
      { text: 'Le backend et le frontal divergent sur la version du protocole employée', right: false, why: 'La version n’est pas en cause : c’est la façon de compter la fin d’une requête qui diffère, et donc le nombre de réponses attendues.' },
      { text: 'Le proxy met en cache une réponse pour une mauvaise URL', right: false, why: 'Un empoisonnement de cache est une autre issue possible. Ici le défaut est dans la file des réponses de la connexion, pas dans un cache.' },
    ],
    impact: [
      { text: 'Chaque utilisateur reçoit la réponse destinée au précédent', right: true, why: 'Le décalage se propage sur la connexion partagée : chez Jira, des utilisateurs recevaient des réponses d’autrui, dont des Set-Cookie qui les connectaient à des comptes tiers.' },
      { text: 'La connexion se ferme après la première réponse décalée', right: false, why: 'Elle reste ouverte et réutilisée, ce qui fait durer le décalage. Une fermeture aurait limité les dégâts à une seule réponse.' },
      { text: 'Seules les requêtes de l’attaquant reçoivent de mauvaises réponses', right: false, why: 'C’est l’inverse qui fait la gravité : ce sont les autres utilisateurs qui reçoivent des réponses qui ne leur étaient pas destinées.' },
    ],
    fix: [
      { text: 'Faire refuser au frontal les requêtes à terminaison ambiguë', right: true, why: 'Une requête qui semble en contenir deux est rejetée plutôt qu’éclatée : la file des réponses ne peut plus se décaler, puisque le nombre de requêtes n’est plus manipulable.' },
      { text: 'Vider systématiquement la file des réponses entre chaque requête', right: false, why: 'On traite le symptôme sur une connexion, pas la cause : tant que le frontal accepte de voir deux requêtes là où il y en a une, le décalage se recrée.' },
      { text: 'Chiffrer les cookies de session pour qu’ils ne soient pas réutilisables', right: false, why: 'Bonne hygiène, hors sujet : le cookie livré à la mauvaise personne reste un cookie valide pour la victime, chiffré ou non. Le problème est qu’il change de destinataire.' },
    ],
    avoid: ['cl-te-generique'],
  },
  {
    id: 'apache-method-space', level: 3, family: 'smuggling',
    title: 'Espace dans la méthode de requête',
    chain: [
      { name: 'Règle du mandataire', reads: 'N’autorise vers l’origine que certains chemins, comparés au chemin reçu' },
      { name: 'mod_proxy (Apache)', reads: 'Tolère une espace dans la pseudo-méthode et reconstruit la ligne de requête' },
      { name: 'Serveur d’origine', reads: 'Lit une ligne de requête où le chemin a changé' },
    ],
    input: 'Une requête HTTP/2 place une espace dans sa méthode, ce qui décale le chemin après reconstruction (cf. Apache mod_proxy, CVE-2021-33193).',
    divergence: [
      { text: 'Le chemin contrôlé n’est pas celui de la ligne de requête reconstruite', right: true, why: 'CVE-2021-33193 : mod_proxy tolérait une espace dans la pseudo-méthode HTTP/2. Reconstruite en HTTP/1.1, la ligne de requête voyait son chemin décalé, échappant à la règle qui l’avait examiné.' },
      { text: 'Le mandataire et l’origine divergent sur la méthode HTTP réellement employée', right: false, why: 'La méthode n’est qu’un moyen : l’injection d’espace sert à déplacer le chemin. C’est sur le chemin, pas sur le verbe, que porte la divergence utile.' },
      { text: 'L’origine décode le chemin une fois de plus que le mandataire', right: false, why: 'C’est le double décodage, une autre divergence. Ici rien n’est ré-encodé : c’est la structure même de la ligne de requête qui est manipulée.' },
    ],
    impact: [
      { text: 'Un chemin interdit par la règle est atteint sur l’origine', right: true, why: 'Le contrôle a examiné un chemin, l’origine en a routé un autre : la CVE permettait de sortir des répertoires autorisés et d’atteindre des ressources censées être bloquées.' },
      { text: 'La requête est rejetée pour méthode inconnue', right: false, why: 'mod_proxy acceptait la méthode malformée au lieu de la rejeter : c’est cette tolérance qui est la faille. Un rejet aurait tout fermé.' },
      { text: 'Seule la journalisation est faussée, l’accès restant correct', right: false, why: 'L’accès lui-même change de cible : ce n’est pas qu’une question de trace, c’est une ressource protégée qui devient joignable.' },
    ],
    fix: [
      { text: 'Mettre à jour le mandataire pour qu’il rejette une méthode à espace', right: true, why: 'Le correctif d’Apache : une pseudo-méthode malformée est refusée avant toute reconstruction. La ligne de requête ne peut plus être décalée, donc la règle et l’origine voient le même chemin.' },
      { text: 'Ajouter à la règle toutes les variantes de chemin déjà observées jusqu’ici', right: false, why: 'On ferme les formes connues, et l’injection en produit d’autres à volonté : le vecteur est la méthode manipulable, pas une liste finie de chemins.' },
      { text: 'Déplacer le contrôle d’accès dans l’application d’origine', right: false, why: 'Excellent principe de défense en profondeur, et deuxième meilleure réponse : l’application voit le chemin réellement routé. Mais tant que le mandataire accepte la méthode malformée, il reste manipulable pour d’autres usages.' },
    ],
    avoid: ['double-encodage'],
  },
  {
    id: 'path-normalization-orange', level: 3, family: 'chemin',
    title: 'Chemin normalisé de deux façons',
    chain: [
      { name: 'nginx (bordure)', reads: 'Compare le chemin brut à une règle protégeant /admin' },
      { name: 'Serveur d’application', reads: 'Résout . et .. et fusionne les barres avant de router' },
    ],
    input: 'Une requête vise /static/..;/admin ou /admin/..%2f..%2fadmin selon la pile (cf. Orange Tsai, « Breaking Parser Logic », Black Hat USA 2018).',
    divergence: [
      { text: 'La bordure et l’application ne résolvent pas le chemin au même moment', right: true, why: 'Orange Tsai (2018) : nginx compare une chaîne brute, l’application résout d’abord les segments . et .. et les délimiteurs de paramètres. Le chemin qui n’était pas /admin pour l’une le devient pour l’autre.' },
      { text: 'L’application décode le chemin une fois de plus que ne le fait la bordure', right: false, why: 'Le double décodage est un cousin, et ce n’est pas ce qui se joue : ici c’est la résolution des segments relatifs et des séparateurs, pas un décodage supplémentaire.' },
      { text: 'nginx redirige d’abord vers la forme canonique du chemin', right: false, why: 'Certains serveurs le font, ce qui fermerait le trou. Dans ce scénario nginx compare et transmet sans canonicaliser.' },
    ],
    impact: [
      { text: 'La zone protégée est atteinte par un chemin que la règle ne reconnaît pas', right: true, why: 'La protection reposait sur une comparaison de chaînes faite avant la résolution. Ce n’était pas une autorisation, c’était un filtre de nom, contourné par une écriture équivalente.' },
      { text: 'L’application sert un fichier statique au lieu de la page d’administration', right: false, why: 'La résolution mène bien à /admin : c’est le but. Aucun fichier statique n’est renvoyé une fois le chemin normalisé.' },
      { text: 'La bordure met en cache la page d’administration', right: false, why: 'Un risque distinct, qui suppose une réponse jugée cachable. La divergence porte ici sur le contrôle d’accès, pas sur le stockage.' },
    ],
    fix: [
      { text: 'Décider l’autorisation dans l’application, sur le chemin déjà résolu', right: true, why: 'Le contrôle voit le chemin tel qu’il sera réellement routé, segments relatifs et séparateurs compris. La bordure garde son rôle, elle cesse d’être le seul juge.' },
      { text: 'Énumérer à la bordure les encodages et séparateurs équivalents à bloquer', right: false, why: 'La famille est vaste — ..;, %2e%2e, barres multiples, séparateurs de matrice — et chaque pile en interprète sa part. On ferme ce qu’on a vu, jamais ce qu’on n’a pas vu.' },
      { text: 'Faire canonicaliser le chemin par nginx avant d’appliquer la règle', right: false, why: 'Bien mieux qu’énumérer, et presque suffisant : encore faut-il que la canonicalisation de nginx soit exactement celle de l’application, ce qui ne se vérifie qu’en testant les deux.' },
    ],
    avoid: ['casse-express-cdn', 'double-encodage'],
  },
  {
    id: 'trust-proxy-spoof', level: 3, family: 'headers',
    title: 'X-Forwarded-For de confiance',
    chain: [
      { name: 'Client', reads: 'Envoie un X-Forwarded-For choisi, prétendant venir d’une IP interne' },
      { name: 'Load balancer', reads: 'Ajoute la vraie IP du client à la fin de l’en-tête (mode append par défaut)' },
      { name: 'Express (trust proxy: true)', reads: 'Fait confiance à toute la chaîne et prend req.ip en tête de liste' },
    ],
    input: 'Une allow-list réserve une route d’administration aux IP internes. Le client envoie X-Forwarded-For: 10.0.0.5.',
    divergence: [
      { text: 'L’application se fie à une part de l’en-tête que le client contrôle', right: true, why: 'L’ALB ajoute la vraie IP à la fin (mode append par défaut), mais avec trust proxy: true Express remonte la chaîne jusqu’au début — donc jusqu’à la valeur forgée par le client. req.ip devient 10.0.0.5.' },
      { text: 'Le load balancer écrase entièrement l’en-tête entrant, donc rien ne passe', right: false, why: 'En mode append, il n’écrase pas : il ajoute son observation à la suite de ce que le client a envoyé. La valeur forgée reste présente, en tête.' },
      { text: 'Express retient systématiquement la dernière IP de la liste', right: false, why: 'Avec trust proxy: true, il considère tous les mandataires comme fiables et retient la première IP non fiable — celle du client. C’est ce réglage trop permissif qui fait la faille.' },
    ],
    impact: [
      { text: 'Une IP interne est usurpée et l’allow-list contournée', right: true, why: 'req.ip reflète une valeur choisie par le client : l’allow-list, qui croyait vérifier l’origine réseau, vérifie une donnée d’entrée. La route d’administration s’ouvre.' },
      { text: 'La journalisation est faussée mais l’accès reste correct', right: false, why: 'L’accès lui-même dépend de req.ip : ce n’est pas qu’un problème de trace, c’est le contrôle qui prend une décision sur une valeur usurpée.' },
      { text: 'Seuls les clients derrière le load balancer sont concernés', right: false, why: 'Tout client passe par le load balancer : c’est justement pour cela que l’application ne voit plus l’IP réelle et doit s’en remettre à l’en-tête.' },
    ],
    fix: [
      { text: 'Régler trust proxy sur le nombre exact de mandataires', right: true, why: 'Express ne fait plus confiance qu’au dernier saut réellement présent : il compte les mandataires et prend l’IP qu’ils ont ajoutée, pas celle que le client a écrite devant.' },
      { text: 'Faire retirer le X-Forwarded-For entrant directement par le load balancer', right: false, why: 'Utile, et à combiner : si trust proxy reste à true, la moindre couche qui réintroduit l’en-tête rouvre la faille. Le réglage applicatif reste à corriger.' },
      { text: 'Vérifier l’allow-list dans le code du front avant l’appel', right: false, why: 'La décision quitte le serveur : un appel direct ne consulte pas le front. C’est le contrôle le plus facile à contourner de la liste.' },
    ],
  },
  {
    id: 'waf-8kb-smuggling', level: 3, family: 'smuggling',
    title: 'Charge au-delà de la fenêtre du WAF',
    chain: [
      { name: 'AWS WAF', reads: 'N’inspecte que les 8 premiers Ko du corps derrière un ALB' },
      { name: 'ALB', reads: 'Transmet le corps entier, inspecté ou non' },
      { name: 'Backend', reads: 'Analyse la totalité du corps' },
    ],
    input: 'Une requête place 8 Ko de remplissage avant sa charge utile, sur une pile ALB + AWS WAF (limite d’inspection documentée : 8 Ko pour l’ALB).',
    divergence: [
      { text: 'Le composant qui inspecte ne voit pas tout ce que le backend lit', right: true, why: 'Derrière un ALB, AWS WAF n’inspecte que les 8 premiers Ko du corps ; l’ALB transmet ensuite le corps entier. La charge placée après le remplissage n’est jamais soumise aux règles.' },
      { text: 'Le WAF et le backend divergent sur l’encodage employé pour le corps', right: false, why: 'L’encodage n’est pas en cause : les deux lisent le même corps. C’est la portion inspectée qui diffère, à cause d’une limite d’octets.' },
      { text: 'L’ALB tronque le corps à 8 Ko avant de le transmettre', right: false, why: 'C’est le piège : la limite de 8 Ko porte sur l’inspection, pas sur la transmission. L’ALB envoie tout, y compris ce que le WAF n’a pas pu voir.' },
    ],
    impact: [
      { text: 'Une charge malveillante atteint le backend sans inspection', right: true, why: 'Injection, désérialisation, motif interdit : tout ce qui tient après les 8 premiers Ko passe le WAF sans examen, puis est analysé normalement par l’application.' },
      { text: 'Le WAF bloque par précaution tout corps qui dépasse les 8 Ko', right: false, why: 'Par défaut, le dépassement est géré en mode « Continue » : le WAF inspecte ce qu’il peut et laisse passer le reste. Bloquer suppose une règle explicite de gestion du surdimensionnement.' },
      { text: 'Le backend finit par rejeter le corps pour une taille excessive', right: false, why: 'Rien dans la pile ne l’impose ici : 8 Ko de remplissage restent modestes pour un corps applicatif ordinaire.' },
    ],
    fix: [
      { text: 'Bloquer le surdimensionnement, et borner la taille des corps', right: true, why: 'Le WAF cesse de laisser filer ce qu’il ne peut pas lire : un corps qui dépasse la limite d’inspection est refusé, et l’application n’accepte plus de corps qu’elle n’a pas de raison de recevoir.' },
      { text: 'Faire passer la limite d’inspection du corps de 8 à 64 Ko partout', right: false, why: 'Sur CloudFront on peut monter à 64 Ko, mais derrière un ALB la limite reste 8 Ko — et même 64 Ko se dépassent. On repousse la fenêtre sans supprimer le fait qu’elle a un bord.' },
      { text: 'Ajouter beaucoup plus de règles WAF sur les 8 premiers Ko du corps', right: false, why: 'Aussi fines soient-elles, elles ne verront jamais l’octet 8193. Le problème n’est pas la qualité des règles, c’est la portion du corps qu’elles peuvent atteindre.' },
    ],
    avoid: ['cl-te-generique'],
  },
];

// ── Les séries ────────────────────────────────────────────────────────────────
//
// La difficulté se joue au niveau, pas au sujet : une série N1 réunit des
// divergences à deux composants qu'on lit presque en clair, une série N3 des
// chaînes à trois composants où le bon correctif n'est pas le plus complet. Les
// séries thématiques regroupent une famille (smuggling, cache, formats de
// données, normalisation) tous niveaux confondus, pour comparer les variantes.

const mix = (n1: number, n2: number, n3: number): [number, number, number] => [n1, n2, n3];

const PROFILES: SeriesProfile<ParserScenario>[] = [
  { id: 'decouverte', title: 'Découverte', mix: mix(5, 0, 0), level: 1,
    text: 'Deux composants, une seule divergence, affichée presque en clair. On apprend à repérer où deux lectures d’une même entrée se séparent.' },
  { id: 'deux-lectures', title: 'Deux lectures', mix: mix(4, 1, 0), level: 1,
    text: 'Encore du niveau 1, d’autres familles, et un cas plus tendu se glisse dans le lot pour préparer la suite.' },
  { id: 'lire-le-contexte', title: 'Lire le contexte', mix: mix(1, 4, 0), level: 2,
    text: 'Un correctif sur deux marche à moitié : il rétrécit l’écart sans le fermer, ou durcit la mauvaise couche. Il faut lire toute la chaîne avant de choisir.' },
  { id: 'trois-composants', title: 'Trois composants', mix: mix(0, 1, 4), level: 3,
    text: 'Des chaînes à trois maillons ou plus : downgrade HTTP/2, WAF à fenêtre limitée, mandataires en cascade. La divergence se cache entre deux traductions.' },
  { id: 'expert', title: 'Expert', mix: mix(0, 0, 5), level: 3,
    text: 'Rien ne se devine à la forme. Le « plus sécurisé en apparence » est souvent le piège, et la bonne lecture tient à un détail du contexte.' },
  { id: 'smuggling', title: 'Désynchronisation', filter: (s) => s.family === 'smuggling', level: 3,
    text: 'Toute la famille request smuggling : CL.TE, downgrade HTTP/2, file des réponses, méthode injectée, contournement de WAF. Beaucoup de cas réels.' },
  { id: 'caches', title: 'Caches trompés', filter: (s) => s.family === 'cache', level: 2,
    text: 'Empoisonnement et cache deception : ce que le cache stocke n’est pas ce que l’application croyait servir. De ChatGPT à la page d’accueil de Firefox.' },
  { id: 'formats-de-donnees', title: 'Formats de données', filter: (s) => s.family === 'json', level: 2,
    text: 'JSON lu deux fois : clé dupliquée, grand nombre, BOM, appariement insensible à la casse. Le corps validé n’est pas toujours le corps décodé.' },
  { id: 'normalisation', title: 'Normalisation', filter: (s) => ['chemin', 'url', 'unicode'].includes(s.family), level: 3,
    text: 'Chemins, URL et Unicode : la même chaîne, normalisée à des moments différents, désigne deux ressources ou deux identités.' },
  { id: 'melee', title: 'Mêlée', mix: mix(2, 2, 1), level: 2, shuffleEachTime: true,
    text: 'Tous niveaux et toutes familles, recomposée à chaque partie. La seule série qu’on ne peut pas réviser.' },
];

/** Les séries, au format commun à tous les jeux (écran de choix partagé). */
export const parserSeries = defineSeries(parserScenarios, PROFILES);

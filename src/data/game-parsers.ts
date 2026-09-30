// Scénarios du jeu « Parser Wars » : deux composants lisent différemment la même entrée.
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

export interface ParserOption { text: string; right: boolean; why: string }
export interface ParserScenario {
  title: string;
  chain: { name: string; reads: string }[];
  input: string;
  divergence: ParserOption[];
  impact: ParserOption[];
  fix: ParserOption[];
}

export const parserScenarios: ParserScenario[] = [
  {
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
    title: 'Clé JSON dupliquée',
    chain: [
      { name: 'Passerelle de validation', reads: 'Valide la première occurrence de la clé role' },
      { name: 'Service Node', reads: 'JSON.parse retient la dernière occurrence' },
    ],
    input: 'Le corps JSON d’une inscription contient deux fois la clé role, avec deux valeurs différentes.',
    divergence: [
      { text: 'La valeur validée n’est pas celle qui sera utilisée', right: true, why: 'La norme JSON ne tranche pas sur les clés dupliquées : chaque implémentation choisit, et deux implémentations raisonnables choisissent l’inverse l’une de l’autre.' },
      { text: 'Le document est invalide, et les deux composants devraient le rejeter', right: false, why: 'C’est ce qu’on aimerait, et ce n’est pas ce que dit la norme : un objet à clés répétées reste du JSON bien formé pour la plupart des analyseurs.' },
      { text: 'Node fusionne les deux valeurs de role dans un tableau', right: false, why: 'Certains analyseurs d’autres langages le font, ce qui produit une troisième lecture encore. JSON.parse, lui, écrase au fur et à mesure.' },
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
];

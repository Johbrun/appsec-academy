// Données de Novafact à classer (jeu « Data Map »), et le contrôle le plus pertinent pour chacune.
//
// Règle d'écriture : **les quatre contrôles sont de longueur comparable**. Tant
// que le bon était le seul à détailler sa mise en œuvre — « isolation par
// tenant, chiffrement au repos et journal d'audit » face à « accès restreint
// aux employés » — il se désignait tout seul. Les mauvais contrôles sont donc
// eux aussi précis : ce qui les disqualifie est qu'ils protègent la mauvaise
// propriété, visent la mauvaise classe, ou coûtent plus qu'ils ne rapportent.
//
// `npm run games` vérifie que le bon contrôle n'est pas le plus long.

export type DataClass = 'publique' | 'interne' | 'confidentielle' | 'secrete';

export const classes: { id: DataClass; label: string; hint: string }[] = [
  { id: 'publique', label: 'Publique', hint: 'Peut être publiée sans dommage' },
  { id: 'interne', label: 'Interne', hint: 'Réservée aux employés, dommage limité' },
  { id: 'confidentielle', label: 'Confidentielle', hint: 'Données clients ou personnelles' },
  { id: 'secrete', label: 'Secrète', hint: 'Sa fuite compromet d’autres protections ou de l’argent' },
];

export interface DataItem { name: string; detail: string; cls: DataClass; controls: string[]; best: number; why: string }

export const dataItems: DataItem[] = [
  { name: 'Page de tarifs', detail: 'Le site marketing de Novafact', cls: 'publique', best: 0,
    controls: [
      'Déploiement par un pipeline de confiance, sans modification manuelle',
      'Chiffrement au repos avec une clé KMS dédiée à la page et rotation annuelle',
      'Accès en lecture réservé aux employés authentifiés par le SSO de l’entreprise',
      'Masquage de la valeur des tarifs dans les journaux applicatifs et d’accès',
    ],
    why: 'Une donnée publique ne demande aucune confidentialité — les trois autres contrôles en achètent, à des prix variés, pour rien. Son intégrité, en revanche, compte : une page de tarifs modifiée est un incident, commercial et parfois contractuel.' },

  { name: 'Volume de factures émises par mois', detail: 'Agrégé, tous clients confondus', cls: 'interne', best: 1,
    controls: [
      'Publication sur le site, en indicateur de traction pour les prospects',
      'Accès réservé aux employés via le SSO, sans restriction supplémentaire',
      'Chiffrement par une clé KMS distincte pour chaque client concerné',
      'Conservation limitée à trente jours puis agrégation annuelle irréversible',
    ],
    why: 'Une métrique d’activité : sa fuite renseigne un concurrent sur la santé de l’entreprise, sans toucher aucun client. Le SSO suffit. La clé par client n’a pas de sens sur une donnée déjà agrégée, et la rétention courte détruirait l’usage qu’on en fait.' },

  { name: 'Factures des clients', detail: 'PDF et données structurées', cls: 'confidentielle', best: 2,
    controls: [
      'Lien de partage public mais non devinable, valable soixante-douze heures',
      'Accès réservé aux employés de Novafact, avec traçabilité des consultations',
      'Isolation par tenant, chiffrement au repos et journal d’audit des accès',
      'Copie systématique dans les journaux applicatifs, pour faciliter le support',
    ],
    why: 'Le cœur des données clients. Le lien non devinable est une autorisation par le secret de l’URL, qui survit à un transfert de courriel ; l’accès employé oublie que le vrai risque est entre tenants ; et la copie dans les journaux déplace la donnée là où elle est le moins protégée.' },

  { name: 'Coordonnées des clients finaux', detail: 'Nom, adresse e-mail et postale des destinataires de factures', cls: 'confidentielle', best: 3,
    controls: [
      'Chiffrement en transit systématique, la base restant en clair au repos',
      'Une clé de chiffrement distincte par personne, dérivée de son identifiant',
      'Accès limité aux équipes support, avec validation d’un responsable',
      'Minimisation, masquage dans les journaux et prise en charge des droits RGPD',
    ],
    why: 'Des données personnelles : ce qui compte est de ne pas les collecter au-delà du nécessaire, de ne pas les répandre dans les journaux, et de savoir répondre à une demande d’accès ou d’effacement. La clé par personne est ingérable ; le chiffrement en transit seul laisse la base entière lisible.' },

  { name: 'IBAN des clients', detail: 'Pour les prélèvements', cls: 'secrete', best: 0,
    controls: [
      'Chiffré par une clé KMS dédiée, déchiffré au seul moment du prélèvement',
      'Stocké en clair, dans une table dont l’accès est restreint et journalisé',
      'Affiché en entier dans le back-office, pour que le support puisse vérifier',
      'Recopié dans les exports comptables mensuels, au format du plan comptable',
    ],
    why: 'Minimiser l’exposition (K3) : l’IBAN n’existe en clair qu’à l’instant où il sert, ce qui rend inutile toute discussion sur qui peut lire la table. Les trois autres options augmentent chacune le nombre d’endroits et de personnes qui le voient.' },

  { name: 'Clé d’API du prestataire de paiement', detail: 'Permet de créer des paiements et des remboursements', cls: 'secrete', best: 2,
    controls: [
      'Dans un fichier de configuration chiffré, versionné avec le code source',
      'Dans une variable VITE_ du front, pour que le paiement parte du navigateur',
      'Dans Secrets Manager, lue par le seul rôle du service, avec rotation',
      'Dans le gestionnaire de mots de passe de l’équipe, partagé aux arrivants',
    ],
    why: 'Un secret actif, qui déplace de l’argent : il doit vivre dans un gestionnaire de secrets, n’être lisible que par le rôle qui s’en sert, et tourner. Le fichier chiffré versionné pose la question de la clé qui le déchiffre ; la variable VITE_ le publie à tous les visiteurs.' },

  { name: 'Journaux applicatifs', detail: 'Adresses IP, identifiants utilisateurs, routes appelées', cls: 'confidentielle', best: 1,
    controls: [
      'Lecture ouverte à tous les développeurs, pour raccourcir le diagnostic',
      'Accès restreint et audité, avec une durée de conservation définie',
      'Purge quotidienne, afin de ne jamais accumuler de données personnelles',
      'Publication d’un extrait anonymisé, au nom de la transparence technique',
    ],
    why: 'Les journaux contiennent des données personnelles : leur interface de consultation est une interface de données, et se protège comme telle. La purge quotidienne est tentante et supprime la capacité d’enquêter, alors que le temps de résidence médian se compte en semaines.' },

  { name: 'Documentation de l’API publique', detail: 'Pour les intégrateurs', cls: 'publique', best: 3,
    controls: [
      'Accès sur invitation, pour garder la maîtrise de qui intègre le produit',
      'Chiffrement de bout en bout entre le site et le navigateur du lecteur',
      'Une clé KMS dédiée pour le compartiment qui héberge les pages générées',
      'Publication, en veillant à n’y documenter aucune route interne',
    ],
    why: 'Publique par nature : la protéger dessert son objet. Le seul risque réel est d’y décrire par mégarde une route d’administration — un défaut de contenu, que ni le chiffrement ni la restriction d’accès ne corrigent.' },

  { name: 'Conversations avec l’assistant IA', detail: 'Questions des utilisateurs et réponses, qui citent des factures', cls: 'confidentielle', best: 1,
    controls: [
      'Conservation illimitée, pour améliorer le modèle sur les cas réels',
      'Même classe que les factures citées, rétention courte, hors entraînement',
      'Accès ouvert aux employés, comme les autres journaux applicatifs',
      'Publication anonymisée, les réponses étant générées et non rédigées',
    ],
    why: 'Une donnée non structurée hérite de la classe la plus sensible qu’elle contient : une réponse qui cite un montant et un client vaut la facture. L’anonymisation d’un texte libre ne tient pas — le contexte suffit à réidentifier.' },

  { name: 'Clé maîtresse de chiffrement des sauvegardes', detail: 'Protège toutes les sauvegardes de la base', cls: 'secrete', best: 0,
    controls: [
      'Dans KMS, sur un compte séparé, politique minimale et usage surveillé',
      'Dans KMS, sur le compte de production, pour simplifier l’exploitation',
      'Exportée et conservée hors ligne sur le poste d’un administrateur',
      'Partagée avec le prestataire de sauvegarde, qui en assure la garde',
    ],
    why: 'Sa compromission compromet toutes les sauvegardes, c’est-à-dire le dernier recours après un incident. Le compte séparé est précisément ce qui empêche un attaquant qui tient la production de déchiffrer ce à partir de quoi on la reconstruira.' },

  { name: 'Jetons de session des utilisateurs', detail: 'En base et dans les cookies', cls: 'secrete', best: 2,
    controls: [
      'Stockés tels quels, avec une durée de vie de trente jours glissants',
      'Chiffrés en base, et consultables par le support pour reproduire un bug',
      'Hachés en base, cookie HttpOnly et Secure, révocables individuellement',
      'Recopiés dans les journaux d’accès, pour relier une requête à sa session',
    ],
    why: 'Un jeton vaut le compte qu’il ouvre : on n’a jamais besoin de le relire, seulement de le comparer, d’où le hachage. La deuxième option est la plus instructive — chiffrer plutôt que hacher, c’est se ménager la possibilité de le lire, donc en faire un secret de plus.' },

  { name: 'Code source de l’application', detail: 'Dépôt privé, historique complet', cls: 'interne', best: 1,
    controls: [
      'Dépôt public, la sécurité ne devant pas reposer sur le secret du code',
      'Dépôt privé, accès par équipe, analyse des secrets à chaque poussée',
      'Chiffrement du dépôt au repos avec une clé gérée par l’équipe',
      'Copie chiffrée hors ligne, remise à jour à chaque version publiée',
    ],
    why: 'Le code n’est pas un secret, et son historique en contient souvent : la détection de secrets à la poussée traite le vrai risque. L’argument de la première option est juste sur le principe de Kerckhoffs, et il ne dit rien des clés déjà commises.' },

  { name: 'Rapport de pentest annuel', detail: 'Findings détaillés, avec les chemins d’exploitation', cls: 'confidentielle', best: 3,
    controls: [
      'Diffusé à toute l’équipe technique, pour que chacun corrige sa partie',
      'Publié après correction, en contribution à la transparence du secteur',
      'Chiffré et conservé sans limite de durée dans le coffre de l’entreprise',
      'Diffusion nominative, extraits actionnables poussés dans les tickets',
    ],
    why: 'C’est une carte des chemins d’attaque encore ouverts : elle se diffuse à ceux qui en ont besoin, sous forme de tickets plutôt que de document complet. Sa valeur pour un attaquant décroît à mesure que les findings sont corrigés — pas avant.' },

  { name: 'Statistiques d’usage anonymisées', detail: 'Pages vues, parcours, sans identifiant', cls: 'publique', best: 2,
    controls: [
      'Accès restreint à l’équipe produit, via un tableau de bord authentifié',
      'Chiffrement au repos et conservation limitée à treize mois glissants',
      'Publication possible, après vérification que l’agrégat ne réidentifie pas',
      'Stockage dans la même base que les données clients, pour les corréler',
    ],
    why: 'Anonymisé veut dire publiable, à une condition qu’il faut vérifier : un agrégat sur une population trop petite réidentifie. La dernière option est le piège classique — corréler avec les données clients désanonymise ce qu’on venait d’anonymiser.' },

  { name: 'Clé de signature des webhooks sortants', detail: 'Prouve aux clients que l’appel vient de Novafact', cls: 'secrete', best: 0,
    controls: [
      'Une clé par client, dans le gestionnaire de secrets, rotation annoncée',
      'Une clé unique partagée, simple à gérer et à documenter côté client',
      'Publiée dans la documentation, puisqu’elle sert à vérifier une signature',
      'Régénérée à chaque déploiement, pour réduire la fenêtre d’exploitation',
    ],
    why: 'C’est un secret symétrique : le publier revient à laisser n’importe qui forger vos webhooks — la confusion avec une clé publique est l’erreur à éviter. Une clé par client limite l’effet d’une fuite chez l’un d’eux ; la rotation s’annonce, sinon elle casse les intégrations.' },

  { name: 'Sauvegardes de la base de production', detail: 'Instantanés quotidiens, conservés un an', cls: 'confidentielle', best: 1,
    controls: [
      'Dans le compte de production, chiffrées par la clé gérée par AWS',
      'Compte séparé, écriture unique, restauration testée périodiquement',
      'Répliquées chez un second fournisseur, pour éviter la dépendance',
      'Conservées sept ans, afin de couvrir toute obligation comptable',
    ],
    why: 'Une sauvegarde ne vaut que si elle survit à la compromission de ce qu’elle sauvegarde, et que si on sait la restaurer : compte séparé, écriture unique, test régulier. La conservation à sept ans confond la sauvegarde technique avec l’archivage légal, qui n’a pas les mêmes contraintes.' },

  { name: 'Adresses e-mail des employés', detail: 'Annuaire interne, format prenom.nom@', cls: 'interne', best: 3,
    controls: [
      'Publiées sur le site, page « équipe », avec photo et intitulé de poste',
      'Chiffrées au repos et accessibles par le seul service d’authentification',
      'Supprimées de l’annuaire au départ, conservées un an dans les journaux',
      'Accès interne, hors du site public, et pas d’énumération par l’API',
    ],
    why: 'Le format est devinable, donc le secret n’est pas l’enjeu : ce qui compte est de ne pas offrir la liste, qui sert à cibler l’hameçonnage. Empêcher l’énumération par l’API est le contrôle le plus souvent oublié, et le plus utile.' },

  { name: 'SBOM de l’application', detail: 'Inventaire des dépendances et de leurs versions', cls: 'interne', best: 2,
    controls: [
      'Publié avec chaque version, comme le font les projets open source',
      'Chiffré et conservé dans le coffre, au même titre qu’un secret',
      'Interne, versionné avec la livraison, et comparé à chaque publication',
      'Régénéré à la demande, sans être conservé, pour éviter qu’il ne périme',
    ],
    why: 'Le SBOM sert surtout après coup : quand une CVE tombe, la question est « quelle version avions-nous livrée le 3 mars ». Ne pas le conserver, c’est perdre cette réponse. Le publier renseigne un attaquant sur les versions exactes à viser.' },

  { name: 'Journaux d’audit des actions administrateurs', detail: 'Qui a fait quoi sur quel tenant, et quand', cls: 'confidentielle', best: 0,
    controls: [
      'Écriture unique, compte séparé, lecture tracée et conservation définie',
      'Même stockage que les journaux applicatifs, pour croiser les recherches',
      'Modifiables par un administrateur, afin de corriger une entrée erronée',
      'Purgés à quatre-vingt-dix jours, alignés sur les autres journaux',
    ],
    why: 'Un journal d’audit n’a de valeur que si celui qu’il surveille ne peut pas le réécrire : l’écriture unique et le compte séparé sont la propriété, pas un luxe. La deuxième option est commode et met la preuve à portée de celui qu’elle accuse.' },

  { name: 'Modèles de facture des clients', detail: 'Gabarits HTML personnalisés, téléversés par les clients', cls: 'confidentielle', best: 1,
    controls: [
      'Rendus tels quels, la personnalisation étant l’intérêt de la fonction',
      'Isolés par tenant, rendus dans un moteur sans accès au contexte serveur',
      'Analysés à l’envoi par une liste noire de balises et d’attributs connus',
      'Validés manuellement par le support avant leur première utilisation',
    ],
    why: 'Un gabarit téléversé est du code fourni par l’utilisateur : le risque n’est pas seulement ce qu’il affiche, mais ce à quoi le moteur de rendu lui donne accès. La validation manuelle ne passe pas à l’échelle et n’attrape pas ce qu’un relecteur ne sait pas lire.' },
];

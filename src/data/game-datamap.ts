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
//
// Les niveaux. Le jeu pose deux questions — la classe, puis le contrôle — et
// la difficulté vient de ce qu'il faut lire pour répondre à la première, et de
// la qualité des mauvaises réponses à la seconde :
//
//   N1 · Le nom suffit à classer : la donnée est l'exemple type de sa classe
//        (une page de tarifs, un IBAN, un mot de passe). Les trois mauvais
//        contrôles protègent visiblement la mauvaise propriété ou achètent une
//        confidentialité dont la donnée n'a pas besoin. On apprend l'échelle.
//
//   N2 · Il faut lire le détail pour classer — un agrégat, le contenu réel
//        d'un journal, un usage — et un des contrôles est **à moitié juste** :
//        la bonne idée mal appliquée (chiffrer au lieu de hacher, KMS sur le
//        compte qu'on veut protéger), ou une bonne pratique qui traite un autre
//        risque que celui de cette donnée.
//
//   N3 · La classe se décide sur un détail qui **renverse** la première
//        lecture : une combinaison de colonnes anodines qui ré-identifie, une
//        donnée dérivée qui hérite de sa source, un secret déguisé en
//        configuration ou en URL, une « clé » qui est publique. Le contrôle le
//        plus protecteur en apparence est souvent le piège.
//
// Les cas réels (incidents publics, recherches publiées) sont cités par nom et
// année dans les explications, fidèles aux sources.

import { defineSeries, type Leveled, type SeriesProfile } from '../lib/series';

export type DataClass = 'publique' | 'interne' | 'confidentielle' | 'secrete';

export const classes: { id: DataClass; label: string; hint: string }[] = [
  { id: 'publique', label: 'Publique', hint: 'Peut être publiée sans dommage' },
  { id: 'interne', label: 'Interne', hint: 'Réservée aux employés, dommage limité' },
  { id: 'confidentielle', label: 'Confidentielle', hint: 'Données clients ou personnelles' },
  { id: 'secrete', label: 'Secrète', hint: 'Sa fuite compromet d’autres protections ou de l’argent' },
];

/** Où vit la donnée : sert aux séries thématiques. */
export type DataWhere = 'produit' | 'paiement' | 'entreprise' | 'infra' | 'journaux' | 'analytics' | 'ia' | 'support';

export interface DataItem extends Leveled {
  name: string;
  detail: string;
  cls: DataClass;
  controls: string[];
  best: number;
  why: string;
  where: DataWhere;
}

export const dataItems: DataItem[] = [
  { id: 'page-de-tarifs', level: 1, where: 'entreprise',
    name: 'Page de tarifs', detail: 'Le site marketing de Novafact', cls: 'publique', best: 0,
    controls: [
      'Déploiement par un pipeline de confiance, sans modification manuelle',
      'Chiffrement au repos avec une clé KMS dédiée à la page et rotation annuelle',
      'Accès en lecture réservé aux employés authentifiés par le SSO de l’entreprise',
      'Masquage de la valeur des tarifs dans les journaux applicatifs et d’accès',
    ],
    why: 'Une donnée publique ne demande aucune confidentialité — les trois autres contrôles en achètent, à des prix variés, pour rien. Son intégrité, en revanche, compte : une page de tarifs modifiée est un incident, commercial et parfois contractuel.' },

  { id: 'volume-factures-mensuel', level: 2, where: 'analytics',
    name: 'Volume de factures émises par mois', detail: 'Agrégé, tous clients confondus', cls: 'interne', best: 1,
    controls: [
      'Publication sur le site, en indicateur de traction pour les prospects',
      'Accès réservé aux employés via le SSO, sans restriction supplémentaire',
      'Chiffrement par une clé KMS distincte pour chaque client concerné',
      'Conservation limitée à trente jours puis agrégation annuelle irréversible',
    ],
    why: 'Une métrique d’activité : sa fuite renseigne un concurrent sur la santé de l’entreprise, sans toucher aucun client. Le SSO suffit. La clé par client n’a pas de sens sur une donnée déjà agrégée, et la rétention courte détruirait l’usage qu’on en fait.' },

  { id: 'factures-clients', level: 1, where: 'produit',
    name: 'Factures des clients', detail: 'PDF et données structurées', cls: 'confidentielle', best: 2,
    controls: [
      'Lien de partage public mais non devinable, valable soixante-douze heures',
      'Accès réservé aux employés de Novafact, avec traçabilité des consultations',
      'Isolation par tenant, chiffrement au repos et journal d’audit des accès',
      'Copie systématique dans les journaux applicatifs, pour faciliter le support',
    ],
    why: 'Le cœur des données clients. Le lien non devinable est une autorisation par le secret de l’URL, qui survit à un transfert de courriel ; l’accès employé oublie que le vrai risque est entre tenants ; et la copie dans les journaux déplace la donnée là où elle est le moins protégée.' },

  { id: 'coordonnees-clients-finaux', level: 1, where: 'produit',
    name: 'Coordonnées des clients finaux', detail: 'Nom, adresse e-mail et postale des destinataires de factures', cls: 'confidentielle', best: 3,
    controls: [
      'Chiffrement en transit systématique, la base restant en clair au repos',
      'Une clé de chiffrement distincte par personne, dérivée de son identifiant',
      'Accès limité aux équipes support, avec validation d’un responsable',
      'Minimisation, masquage dans les journaux et prise en charge des droits RGPD',
    ],
    why: 'Des données personnelles : ce qui compte est de ne pas les collecter au-delà du nécessaire, de ne pas les répandre dans les journaux, et de savoir répondre à une demande d’accès ou d’effacement. La clé par personne est ingérable ; le chiffrement en transit seul laisse la base entière lisible.' },

  { id: 'iban-clients', level: 1, where: 'paiement',
    name: 'IBAN des clients', detail: 'Pour les prélèvements', cls: 'secrete', best: 0,
    controls: [
      'Chiffré par une clé KMS dédiée, déchiffré au seul moment du prélèvement',
      'Stocké en clair, dans une table dont l’accès est restreint et journalisé',
      'Affiché en entier dans le back-office, pour que le support puisse vérifier',
      'Recopié dans les exports comptables mensuels, au format du plan comptable',
    ],
    why: 'Minimiser l’exposition (K3) : l’IBAN n’existe en clair qu’à l’instant où il sert, ce qui rend inutile toute discussion sur qui peut lire la table. Les trois autres options augmentent chacune le nombre d’endroits et de personnes qui le voient.' },

  { id: 'cle-api-paiement', level: 1, where: 'infra',
    name: 'Clé d’API du prestataire de paiement', detail: 'Permet de créer des paiements et des remboursements', cls: 'secrete', best: 2,
    controls: [
      'Dans un fichier de configuration chiffré, versionné avec le code source',
      'Dans une variable VITE_ du front, pour que le paiement parte du navigateur',
      'Dans Secrets Manager, lue par le seul rôle du service, avec rotation',
      'Dans le gestionnaire de mots de passe de l’équipe, partagé aux arrivants',
    ],
    why: 'Un secret actif, qui déplace de l’argent : il doit vivre dans un gestionnaire de secrets, n’être lisible que par le rôle qui s’en sert, et tourner. Le fichier chiffré versionné pose la question de la clé qui le déchiffre ; la variable VITE_ le publie à tous les visiteurs.' },

  { id: 'journaux-applicatifs', level: 2, where: 'journaux',
    name: 'Journaux applicatifs', detail: 'Adresses IP, identifiants utilisateurs, routes appelées', cls: 'confidentielle', best: 1,
    controls: [
      'Lecture ouverte à tous les développeurs, pour raccourcir le diagnostic',
      'Accès restreint et audité, avec une durée de conservation définie',
      'Purge quotidienne, afin de ne jamais accumuler de données personnelles',
      'Publication d’un extrait anonymisé, au nom de la transparence technique',
    ],
    why: 'Les journaux contiennent des données personnelles : leur interface de consultation est une interface de données, et se protège comme telle. La purge quotidienne est tentante et supprime la capacité d’enquêter, alors que le temps de résidence médian se compte en semaines.' },

  { id: 'doc-api-publique', level: 1, where: 'entreprise',
    name: 'Documentation de l’API publique', detail: 'Pour les intégrateurs', cls: 'publique', best: 3,
    controls: [
      'Accès sur invitation, pour garder la maîtrise de qui intègre le produit',
      'Chiffrement de bout en bout entre le site et le navigateur du lecteur',
      'Une clé KMS dédiée pour le compartiment qui héberge les pages générées',
      'Publication, en veillant à n’y documenter aucune route interne',
    ],
    why: 'Publique par nature : la protéger dessert son objet. Le seul risque réel est d’y décrire par mégarde une route d’administration — un défaut de contenu, que ni le chiffrement ni la restriction d’accès ne corrigent.' },

  { id: 'conversations-ia', level: 2, where: 'ia',
    name: 'Conversations avec l’assistant IA', detail: 'Questions des utilisateurs et réponses, qui citent des factures', cls: 'confidentielle', best: 1,
    controls: [
      'Conservation illimitée, pour améliorer le modèle sur les cas réels',
      'Même classe que les factures citées, rétention courte, hors entraînement',
      'Accès ouvert aux employés, comme les autres journaux applicatifs',
      'Publication anonymisée, les réponses étant générées et non rédigées',
    ],
    why: 'Une donnée non structurée hérite de la classe la plus sensible qu’elle contient : une réponse qui cite un montant et un client vaut la facture. L’anonymisation d’un texte libre ne tient pas — le contexte suffit à réidentifier.' },

  { id: 'cle-maitresse-sauvegardes', level: 2, where: 'infra',
    name: 'Clé maîtresse de chiffrement des sauvegardes', detail: 'Protège toutes les sauvegardes de la base', cls: 'secrete', best: 0,
    controls: [
      'Dans KMS, sur un compte séparé, politique minimale et usage surveillé',
      'Dans KMS, sur le compte de production, pour simplifier l’exploitation',
      'Exportée et conservée hors ligne sur le poste d’un administrateur',
      'Partagée avec le prestataire de sauvegarde, qui en assure la garde',
    ],
    why: 'Sa compromission compromet toutes les sauvegardes, c’est-à-dire le dernier recours après un incident. Le compte séparé est précisément ce qui empêche un attaquant qui tient la production de déchiffrer ce à partir de quoi on la reconstruira.' },

  { id: 'jetons-session', level: 2, where: 'produit',
    name: 'Jetons de session des utilisateurs', detail: 'En base et dans les cookies', cls: 'secrete', best: 2,
    controls: [
      'Stockés tels quels, avec une durée de vie de trente jours glissants',
      'Chiffrés en base, et consultables par le support pour reproduire un bug',
      'Hachés en base, cookie HttpOnly et Secure, révocables individuellement',
      'Recopiés dans les journaux d’accès, pour relier une requête à sa session',
    ],
    why: 'Un jeton vaut le compte qu’il ouvre : on n’a jamais besoin de le relire, seulement de le comparer, d’où le hachage. Le chiffrement en base est le distracteur le plus instructif — chiffrer plutôt que hacher, c’est se ménager la possibilité de le lire, donc en faire un secret de plus.' },

  { id: 'code-source', level: 2, where: 'infra',
    name: 'Code source de l’application', detail: 'Dépôt privé, historique complet', cls: 'interne', best: 1,
    controls: [
      'Dépôt public, la sécurité ne devant pas reposer sur le secret du code',
      'Dépôt privé, accès par équipe, analyse des secrets à chaque poussée',
      'Chiffrement du dépôt au repos avec une clé gérée par l’équipe',
      'Copie chiffrée hors ligne, remise à jour à chaque version publiée',
    ],
    why: 'Le code n’est pas un secret, et son historique en contient souvent : la détection de secrets à la poussée traite le vrai risque. L’argument du dépôt public est juste sur le principe de Kerckhoffs, et il ne dit rien des clés déjà commises.' },

  { id: 'rapport-pentest', level: 2, where: 'entreprise',
    name: 'Rapport de pentest annuel', detail: 'Findings détaillés, avec les chemins d’exploitation', cls: 'confidentielle', best: 3,
    controls: [
      'Diffusé à toute l’équipe technique, pour que chacun corrige sa partie',
      'Publié après correction, en contribution à la transparence du secteur',
      'Chiffré et conservé sans limite de durée dans le coffre de l’entreprise',
      'Diffusion nominative, extraits actionnables poussés dans les tickets',
    ],
    why: 'C’est une carte des chemins d’attaque encore ouverts : elle se diffuse à ceux qui en ont besoin, sous forme de tickets plutôt que de document complet. Sa valeur pour un attaquant décroît à mesure que les findings sont corrigés — pas avant.' },

  { id: 'stats-usage-anonymisees', level: 3, where: 'analytics',
    name: 'Statistiques d’usage anonymisées', detail: 'Pages vues, parcours, sans identifiant', cls: 'publique', best: 2,
    controls: [
      'Accès restreint à l’équipe produit, via un tableau de bord authentifié',
      'Chiffrement au repos et conservation limitée à treize mois glissants',
      'Publication possible, après vérification que l’agrégat ne réidentifie pas',
      'Stockage dans la même base que les données clients, pour les corréler',
    ],
    why: 'Anonymisé veut dire publiable, à une condition qu’il faut vérifier : un agrégat sur une population trop petite réidentifie. Le stockage commun est le piège classique — corréler avec les données clients désanonymise ce qu’on venait d’anonymiser.' },

  { id: 'cle-signature-webhooks', level: 2, where: 'infra',
    name: 'Clé de signature des webhooks sortants', detail: 'Prouve aux clients que l’appel vient de Novafact', cls: 'secrete', best: 0,
    controls: [
      'Une clé par client, dans le gestionnaire de secrets, rotation annoncée',
      'Une clé unique partagée, simple à gérer et à documenter côté client',
      'Publiée dans la documentation, puisqu’elle sert à vérifier une signature',
      'Régénérée à chaque déploiement, pour réduire la fenêtre d’exploitation',
    ],
    why: 'C’est un secret symétrique : le publier revient à laisser n’importe qui forger vos webhooks — la confusion avec une clé publique est l’erreur à éviter. Une clé par client limite l’effet d’une fuite chez l’un d’eux ; la rotation s’annonce, sinon elle casse les intégrations.' },

  { id: 'sauvegardes-base', level: 2, where: 'infra', avoid: ['cle-maitresse-sauvegardes'],
    name: 'Sauvegardes de la base de production', detail: 'Instantanés quotidiens, conservés un an', cls: 'confidentielle', best: 1,
    controls: [
      'Dans le compte de production, chiffrées par la clé gérée par AWS',
      'Compte séparé, écriture unique, restauration testée périodiquement',
      'Répliquées chez un second fournisseur, pour éviter la dépendance',
      'Conservées sept ans, afin de couvrir toute obligation comptable',
    ],
    why: 'Une sauvegarde ne vaut que si elle survit à la compromission de ce qu’elle sauvegarde, et que si on sait la restaurer : compte séparé, écriture unique, test régulier. La conservation à sept ans confond la sauvegarde technique avec l’archivage légal, qui n’a pas les mêmes contraintes.' },

  { id: 'emails-employes', level: 2, where: 'entreprise',
    name: 'Adresses e-mail des employés', detail: 'Annuaire interne, format prenom.nom@', cls: 'interne', best: 3,
    controls: [
      'Publiées sur le site, page « équipe », avec photo et intitulé de poste',
      'Chiffrées au repos et accessibles par le seul service d’authentification',
      'Supprimées de l’annuaire au départ, conservées un an dans les journaux',
      'Accès interne, hors du site public, et pas d’énumération par l’API',
    ],
    why: 'Le format est devinable, donc le secret n’est pas l’enjeu : ce qui compte est de ne pas offrir la liste, qui sert à cibler l’hameçonnage. Empêcher l’énumération par l’API est le contrôle le plus souvent oublié, et le plus utile.' },

  { id: 'sbom', level: 2, where: 'infra',
    name: 'SBOM de l’application', detail: 'Inventaire des dépendances et de leurs versions', cls: 'interne', best: 2,
    controls: [
      'Publié avec chaque version, comme le font les projets open source',
      'Chiffré et conservé dans le coffre, au même titre qu’un secret',
      'Interne, versionné avec la livraison, et comparé à chaque publication',
      'Régénéré à la demande, sans être conservé, pour éviter qu’il ne périme',
    ],
    why: 'Le SBOM sert surtout après coup : quand une CVE tombe, la question est « quelle version avions-nous livrée le 3 mars ». Ne pas le conserver, c’est perdre cette réponse. Le publier renseigne un attaquant sur les versions exactes à viser.' },

  { id: 'journaux-audit-admin', level: 2, where: 'journaux',
    name: 'Journaux d’audit des actions administrateurs', detail: 'Qui a fait quoi sur quel tenant, et quand', cls: 'confidentielle', best: 0,
    controls: [
      'Écriture unique, compte séparé, lecture tracée et conservation définie',
      'Même stockage que les journaux applicatifs, pour croiser les recherches',
      'Modifiables par un administrateur, afin de corriger une entrée erronée',
      'Purgés à quatre-vingt-dix jours, alignés sur les autres journaux',
    ],
    why: 'Un journal d’audit n’a de valeur que si celui qu’il surveille ne peut pas le réécrire : l’écriture unique et le compte séparé sont la propriété, pas un luxe. Le stockage partagé avec les journaux applicatifs est commode, et met la preuve à portée de celui qu’elle accuse.' },

  { id: 'modeles-facture', level: 3, where: 'produit',
    name: 'Modèles de facture des clients', detail: 'Gabarits HTML personnalisés, téléversés par les clients', cls: 'confidentielle', best: 1,
    controls: [
      'Rendus tels quels, la personnalisation étant l’intérêt de la fonction',
      'Isolés par tenant, rendus dans un moteur sans accès au contexte serveur',
      'Analysés à l’envoi par une liste noire de balises et d’attributs connus',
      'Validés manuellement par le support avant leur première utilisation',
    ],
    why: 'Un gabarit téléversé est du code fourni par l’utilisateur : le risque n’est pas seulement ce qu’il affiche, mais ce à quoi le moteur de rendu lui donne accès. La validation manuelle ne passe pas à l’échelle et n’attrape pas ce qu’un relecteur ne sait pas lire.' },

  // ── Niveau 1 : le nom suffit à classer ────────────────────────────────────

  { id: 'mots-de-passe', level: 1, where: 'produit',
    name: 'Mots de passe des utilisateurs', detail: 'Saisis à chaque connexion à l’application', cls: 'secrete', best: 0,
    controls: [
      'Hachés par Argon2id avec un sel propre à chaque compte, jamais journalisés',
      'Chiffrés par une clé KMS, pour pouvoir les renvoyer à qui les oublie',
      'Stockés en clair, dans une table dont l’accès est restreint et audité',
      'Transmis au support en copie, pour dépanner les clients plus vite',
    ],
    why: 'Un mot de passe ne se relit jamais : on compare une empreinte, calculée par une fonction lente et salée, pour qu’une base volée ne se casse pas en une nuit. Le chiffrement réversible suppose que quelqu’un puisse déchiffrer — précisément ce qu’on veut éviter. Et comme les gens réutilisent leurs mots de passe, la fuite de celui-ci ouvre d’autres comptes : c’est un secret.' },

  { id: 'mentions-legales', level: 1, where: 'entreprise', avoid: ['page-de-tarifs'],
    name: 'Mentions légales de Novafact', detail: 'SIREN, numéro de TVA et adresse du siège, imprimés sur chaque facture', cls: 'publique', best: 1,
    controls: [
      'Chiffrées au repos, et déchiffrées au seul moment de générer une facture',
      'Modifiables par un seul processus relu, puisqu’elles figurent sur les factures',
      'Réservées aux employés via le SSO, avec un journal des consultations',
      'Retirées des journaux applicatifs et des exports comptables mensuels',
    ],
    why: 'Le SIREN et le numéro de TVA se consultent dans les registres publics : aucune confidentialité à acheter. Leur exactitude, en revanche, est une obligation — une facture aux mentions erronées pose un problème légal. C’est l’intégrité qui se protège, par un changement rare, relu, et propagé partout à la fois.' },

  { id: 'salaires', level: 1, where: 'entreprise',
    name: 'Salaires des employés', detail: 'Fichier de paie mensuel, une ligne par personne', cls: 'confidentielle', best: 2,
    controls: [
      'Ouvert à toute l’équipe, au nom de la transparence salariale',
      'Hachés en base, pour que personne ne puisse jamais les relire',
      'Accès nominatif pour la paie et la direction, consultations tracées',
      'Rangés dans le tableur des objectifs commerciaux, déjà restreint',
    ],
    why: 'Des données personnelles, parmi celles dont la fuite abîme le plus la confiance interne : peu de personnes en ont besoin, et chacune est nommée. Hacher une donnée qu’il faut relire pour faire la paie la rend inutilisable ; la transparence salariale se fait par grilles et fourchettes, pas en ouvrant le fichier nominatif.' },

  { id: 'cle-privee-tls', level: 1, where: 'infra',
    name: 'Clé privée du certificat TLS de l’API', detail: 'Celle qui prouve aux navigateurs qu’ils parlent bien à api.novafact.fr', cls: 'secrete', best: 3,
    controls: [
      'Commitée dans le dépôt d’infrastructure, à côté du certificat',
      'Copiée sur le poste de chaque développeur, pour tester en local',
      'Publiée avec le certificat, puisque les deux forment une paire',
      'Gérée par ACM sur l’équilibreur de charge, sans être exportée',
    ],
    why: 'Qui détient la clé privée peut se faire passer pour l’API. Le mieux est de ne jamais la manipuler : un certificat géré par ACM et attaché à l’équilibreur se renouvelle seul, et la clé ne quitte pas le service. La confusion inverse est fréquente — le certificat est public, la clé qui l’accompagne ne l’est jamais.' },

  { id: 'page-de-statut', level: 1, where: 'entreprise',
    name: 'Page de statut du service', detail: 'Disponibilité de l’API et incidents en cours, pour les clients', cls: 'publique', best: 0,
    controls: [
      'Hébergée hors de l’infrastructure qu’elle décrit, pour rester joignable',
      'Réservée aux clients connectés, derrière l’authentification du produit',
      'Chiffrée par une clé KMS dédiée, avec une rotation annuelle automatique',
      'Masquée dans les journaux d’accès, pour ne pas révéler les incidents',
    ],
    why: 'Publique par destination, sa valeur est d’être lisible au pire moment : pendant une panne. Hébergée sur la même infrastructure, elle tombe avec elle. La réserver aux clients connectés est le même défaut sous une autre forme — l’authentification est souvent la première chose qui casse.' },

  { id: 'procedure-astreinte', level: 1, where: 'entreprise',
    name: 'Procédure d’astreinte', detail: 'Qui appeler, comment escalader, liens vers les tableaux de bord', cls: 'interne', best: 2,
    controls: [
      'Publiée sur le site, pour montrer aux clients le sérieux de l’équipe',
      'Réservée aux deux responsables techniques, chiffrée sur leur poste',
      'Wiki interne sous SSO, et aucun mot de passe écrit dans les pages',
      'Imprimée et rangée au bureau, pour éviter toute copie numérique',
    ],
    why: 'Sa fuite renseigne un attaquant sur l’organisation sans lui ouvrir aucun accès : c’est interne. Le vrai piège de ce genre de page est d’y coller « temporairement » un mot de passe d’urgence. La restreindre à deux personnes ou au papier la rend introuvable pour celui qui est d’astreinte à trois heures du matin, c’est-à-dire au moment où elle sert.' },

  { id: 'cgv', level: 1, where: 'entreprise', avoid: ['page-de-tarifs', 'mentions-legales'],
    name: 'Conditions générales de vente', detail: 'Acceptées par chaque client à la souscription', cls: 'publique', best: 1,
    controls: [
      'Réservées aux clients signés, pour ne pas renseigner la concurrence',
      'Versionnées, chaque version datée, conservée et reliée aux clients',
      'Chiffrées au repos, chaque version sous une clé KMS distincte',
      'Retirées du site dès qu’une nouvelle version entre en vigueur',
    ],
    why: 'Des CGV se publient : le Code de commerce oblige même à les communiquer à tout acheteur professionnel qui les demande. Ce qui compte en cas de litige est de prouver quelle version un client a acceptée, et quand — l’intégrité et la traçabilité, pas la confidentialité. Retirer l’ancienne version sans la conserver détruit cette preuve.' },

  { id: 'contrats-clients', level: 1, where: 'entreprise', avoid: ['salaires'],
    name: 'Contrats des clients grands comptes', detail: 'Tarifs négociés, remises, clauses particulières', cls: 'confidentielle', best: 0,
    controls: [
      'Accès nominatif pour les ventes et le juridique, consultations tracées',
      'Déposés dans le dossier partagé de l’entreprise, lisible par tous',
      'Publiés en version caviardée, au nom de l’équité entre les clients',
      'Chiffrés sous une clé que seul le signataire côté client détient',
    ],
    why: 'Un tarif négocié est un secret des affaires pour le client autant que pour Novafact, et les clauses de confidentialité le disent souvent. L’accès se limite à ceux qui négocient et gèrent le contrat. Confier la seule clé au client empêcherait Novafact de relire ses propres engagements.' },

  { id: 'jeton-github', level: 1, where: 'infra',
    name: 'Jeton GitHub personnel d’un développeur', detail: 'Droits d’écriture sur tous les dépôts de l’organisation, sans expiration', cls: 'secrete', best: 3,
    controls: [
      'Placé dans le fichier .npmrc du dépôt, pour que la CI puisse s’en servir',
      'Partagé dans le canal de l’équipe, pour dépanner pendant les absences',
      'Conservé tel quel, mais consigné dans le registre des accès de l’équipe',
      'Remplacé par un jeton à portée fine, limité aux dépôts utiles, qui expire',
    ],
    why: 'Un jeton qui écrit sur tous les dépôts permet de glisser du code dans ce qui part en production : c’est un secret, et un gros. La mesure qui compte réduit ce qu’il ouvre et combien de temps — les jetons à portée fine de GitHub se limitent à des dépôts et des permissions choisis, avec une date d’expiration. Le consigner dans un registre documente le risque sans le réduire.' },

  { id: 'historique-connexions', level: 1, where: 'produit',
    name: 'Historique de connexion d’un utilisateur', detail: 'Date, adresse IP et appareil de chaque session', cls: 'confidentielle', best: 1,
    controls: [
      'Visible par tous les membres du tenant, pour repérer les intrus',
      'Visible par l’utilisateur lui-même, avec une durée de conservation',
      'Publié sous forme agrégée, pour prouver la fiabilité du service',
      'Chiffré par une clé que l’utilisateur ne peut pas lire lui-même',
    ],
    why: 'Des adresses IP rattachées à une personne et à des horaires : des données personnelles, qui dessinent ses habitudes. Les montrer à l’utilisateur a un vrai intérêt de sécurité — il repère une connexion qu’il n’a pas faite — sans qu’il faille les ouvrir à tout le tenant. Et on ne les garde pas indéfiniment.' },

  // ── Niveau 2 : le détail décide, un contrôle est à moitié juste ────────────

  { id: 'numerotation-factures', level: 2, where: 'produit',
    name: 'Numérotation des factures', detail: 'FA-2026-000001, FA-2026-000002… une séquence par tenant, imprimée sur chaque facture', cls: 'interne', best: 1,
    controls: [
      'Remplacée par des identifiants aléatoires, pour ne rien laisser deviner',
      'Séquence garantie par la base, sans trou ni doublon, jamais recalculée',
      'Chiffrée sur le PDF, le destinataire disposant de la clé pour la lire',
      'Masquée dans les journaux, au même titre qu’une donnée personnelle',
    ],
    why: 'La numérotation n’a presque rien de confidentiel, mais la loi impose une séquence chronologique et continue : un trou ou un doublon se remarque lors d’un contrôle fiscal. Le contrôle qui compte protège son intégrité. L’identifiant aléatoire est le bon réflexe pour une clé d’URL — et il est ici interdit.' },

  { id: 'numeros-carte', level: 2, where: 'paiement', avoid: ['iban-clients'],
    name: 'Numéros de carte bancaire', detail: 'Saisis par les clients pour payer leur abonnement Novafact', cls: 'secrete', best: 2,
    controls: [
      'Chiffrés par une clé KMS dédiée, déchiffrés au seul moment du débit',
      'Conservés avec le cryptogramme, pour les paiements récurrents',
      'Jamais reçus : saisis dans le champ hébergé par le prestataire',
      'Tronqués aux quatre derniers chiffres dans l’administration',
    ],
    why: 'La meilleure protection d’un numéro de carte est de ne jamais le toucher : avec un champ hébergé par le prestataire, il part du navigateur vers lui, et Novafact ne manipule qu’un jeton. Le chiffrement KMS, juste pour un IBAN, ferait entrer tout le système dans le périmètre de PCI DSS. Quant au cryptogramme, la norme interdit de le conserver après l’autorisation.' },

  { id: 'cles-api-clients', level: 2, where: 'produit', avoid: ['jetons-session'],
    name: 'Clés d’API émises aux clients', detail: 'Permettent aux intégrateurs d’appeler l’API au nom de leur tenant', cls: 'secrete', best: 0,
    controls: [
      'Hachées en base, montrées une seule fois à la création, révocables',
      'Chiffrées en base, pour pouvoir les réafficher au client qui la perd',
      'Préfixées par le nom du tenant, pour les reconnaître dans les journaux',
      'Valables sans limite, pour ne pas casser les intégrations existantes',
    ],
    why: 'Une clé d’API se vérifie, elle ne se relit pas. GitHub l’a rappelé en 2022, quand des jetons OAuth émis à Heroku et Travis CI ont été volés puis utilisés pour cloner des dépôts privés : il a précisé ne pas stocker ces jetons sous une forme utilisable, si bien que le vol ne pouvait venir que de chez les intégrateurs. Le réaffichage est une commodité qui oblige à garder la clé lisible quelque part.' },

  { id: 'jeu-de-demo', level: 2, where: 'produit',
    name: 'Jeu de données de démonstration', detail: 'Tenants et factures fictifs, générés par un script pour les démos commerciales', cls: 'publique', best: 3,
    controls: [
      'Accès réservé à l’équipe commerciale, via le SSO de l’entreprise',
      'Pseudonymisé avant chaque démo, noms et montants remplacés',
      'Chiffré au repos, avec la même clé KMS que la base de production',
      'Toujours régénéré par le script, jamais tiré d’un export réel',
    ],
    why: 'Des données fictives se montrent à qui on veut : c’est leur raison d’être. Le seul risque est qu’elles cessent de l’être — un jour de démo pressé, quelqu’un recharge un export réel « pour que ça ait l’air vrai ». Pseudonymiser avant chaque démo suppose justement qu’on part de données réelles, ce qu’il faut éviter.' },

  { id: 'pj-tickets', level: 2, where: 'support',
    name: 'Pièces jointes des tickets de support', detail: 'Captures d’écran envoyées par les clients pour illustrer un bug', cls: 'confidentielle', best: 2,
    controls: [
      'Même traitement que le texte du ticket, qui ne contient pas de facture',
      'Floutées automatiquement par reconnaissance de texte avant stockage',
      'Même classe que les factures, supprimées trente jours après clôture',
      'Transmises par lien public à l’éditeur de l’outil, pour escalader',
    ],
    why: 'Une capture d’écran de Novafact montre presque toujours une facture, avec son client et son montant : elle hérite de cette classe, même rangée dans l’outil de support. Le floutage automatique rate ce qu’il ne reconnaît pas et donne une fausse assurance. La rétention courte limite ce qu’une compromission de l’outil exposerait.' },

  { id: 'ca-par-tenant', level: 2, where: 'analytics', avoid: ['volume-factures-mensuel'],
    name: 'Chiffre d’affaires facturé par tenant', detail: 'Tableau de bord interne : le classement de tous les clients', cls: 'confidentielle', best: 1,
    controls: [
      'Ouvert à tous les employés, comme les autres tableaux de bord',
      'Réservé à la direction et à la finance, exports journalisés',
      'Arrondi au millier d’euros, ce qui suffit à le rendre anonyme',
      'Publié en partie, les dix premiers clients servant de références',
    ],
    why: 'Le volume global est interne ; le classement de tous les clients avec ce qu’ils facturent révèle la clientèle et l’activité de chacun — l’agrégation fait monter la classe. Arrondir ne change rien, le nom du client reste en face. Et citer des clients en référence exige leur accord, pas un classement.' },

  // ── Niveau 3 : un détail renverse la première lecture ─────────────────────

  { id: 'base-de-recette', level: 3, where: 'infra',
    name: 'Base de recette', detail: 'Copie de la production de la semaine dernière, pour tester une migration', cls: 'confidentielle', best: 1,
    controls: [
      'Ouverte à tous les développeurs, puisque c’est un environnement de test',
      'Remplacée par des données synthétiques, ou protégée comme la production',
      'Isolée dans un VPC sans accès à internet, ce qui suffit pour des tests',
      'Recopiée chaque nuit depuis la dernière sauvegarde, puis effacée',
    ],
    why: 'Une copie de la production contient les mêmes factures et les mêmes personnes : la classe suit le contenu, pas le nom de l’environnement. Soit on ne copie pas, soit on protège comme en production. L’isolation réseau protège d’internet, pas des développeurs qui y ont accès, ni des exports et des journaux qu’on produit en testant.' },

  { id: 'jwks-cognito', level: 3, where: 'infra',
    name: 'Clés de vérification des jetons (JWKS)', detail: 'Utilisées par l’API pour vérifier les JWT émis par le user pool Cognito', cls: 'publique', best: 2,
    controls: [
      'Stockées dans Secrets Manager, lues par le seul rôle de l’API',
      'Retirées des journaux et des traces, comme tout matériel de clé',
      'Lues à l’URL de l’émetteur attendu, jamais celle que cite le jeton',
      'Copiées dans le code, puis remplacées à chaque nouvelle version',
    ],
    why: 'Ce sont des clés publiques : Cognito les publie lui-même à une adresse connue, et elles ne servent qu’à vérifier. Les ranger dans Secrets Manager protège ce qui n’a pas besoin de l’être. Leur risque est ailleurs : si l’API accepte une clé désignée par le jeton lui-même (en-têtes jku ou x5u), un attaquant signe avec sa propre clé et indique où la trouver.' },

  { id: 'reinitialisation-mfa', level: 3, where: 'support',
    name: 'Procédure de réinitialisation de la MFA', detail: 'Macro du support pour un client qui a perdu son téléphone : étapes et vérifications', cls: 'interne', best: 0,
    controls: [
      'Documentée en interne, et exigeant une preuve d’identité hors bande',
      'Classée secrète et limitée à deux agents, pour que nul ne la connaisse',
      'Publiée dans l’aide en ligne, pour que les clients s’y préparent',
      'Supprimée : un client qui perd son second facteur recrée un compte',
    ],
    why: 'Une procédure n’est pas un secret : si la connaître suffit à la détourner, c’est elle qui est faible. En 2023, Okta a alerté ses clients sur des attaquants qui appelaient leur support informatique pour faire réinitialiser la MFA de super-administrateurs ; ce qui les arrête est la vérification imposée, hors du canal qu’ils contrôlent, pas le secret de la macro.' },

  { id: 'export-quasi-identifiants', level: 3, where: 'analytics',
    name: 'Export pour l’équipe data', detail: 'Clients auto-entrepreneurs : code postal, code d’activité et date de création, sans nom ni e-mail', cls: 'confidentielle', best: 3,
    controls: [
      'Identifiants hachés avant l’export, pour qu’aucune ligne ne soit nominative',
      'Classé interne et partagé librement, puisqu’il ne contient aucun nom',
      'Chiffré pendant le transfert, puis stocké en clair dans l’outil de BI',
      'Généralisé (département, année) jusqu’à ce que chaque profil soit commun',
    ],
    why: 'Pour un auto-entrepreneur, l’entreprise est la personne, et le registre SIRENE, public, donne pour la plupart la commune, l’activité et la date de création : les trois colonnes suffisent souvent à retrouver le nom. C’est la leçon de Latanya Sweeney, qui retrouva en 1997 le dossier médical du gouverneur du Massachusetts avec le code postal, la date de naissance et le sexe. L’export reste une donnée personnelle.' },

  { id: 'embeddings-factures', level: 3, where: 'ia',
    name: 'Vecteurs d’embeddings des factures', detail: 'Calculés pour la recherche sémantique de l’assistant IA, stockés dans une base vectorielle', cls: 'confidentielle', best: 0,
    controls: [
      'Même isolation par tenant que les factures, et effacés avec elles',
      'Classés internes : une suite de nombres ne se relit pas comme un texte',
      'Base vectorielle unique, le tenant étant précisé dans le prompt',
      'Recalculés chaque nuit, ce qui empêche d’en reconstituer le contenu',
    ],
    why: 'Un embedding est une donnée dérivée qui hérite de sa source : des travaux publiés en 2023 reconstruisent une grande partie du texte à partir du seul vecteur, et surtout, l’index répond aux questions sur les factures. Il se protège comme elles, jusqu’à l’effacement. Préciser le tenant dans le prompt confie l’isolation au modèle, qui se laisse convaincre ; le filtre appartient à la requête sur la base.' },

  { id: 'url-presignee', level: 3, where: 'produit',
    name: 'Lien de téléchargement d’une facture', detail: 'URL S3 présignée, envoyée par e-mail au client final, valable sept jours', cls: 'secrete', best: 1,
    controls: [
      'Même classe que la facture, et même accès : le client final la lit',
      'Valable quelques minutes, générée au clic, absente des journaux',
      'Rendue plus sûre par un nom de fichier aléatoire dans le bucket',
      'Protégée par le chiffrement SSE-KMS du bucket qui contient le PDF',
    ],
    why: 'L’URL présignée est un jeton au porteur : quiconque la détient lit la facture, sans autre contrôle. Sa fuite contourne toutes les autres protections, d’où la classe secrète, alors que la facture elle-même est confidentielle. Elle fuit par les transferts de courriel et les journaux, qui gardent l’URL entière. SSE-KMS n’y change rien : S3 déchiffre pour toute requête correctement signée.' },

  { id: 'database-url', level: 3, where: 'infra',
    name: 'Variable DATABASE_URL', detail: 'Dans le fichier de configuration du service, à côté du port et du niveau de log', cls: 'secrete', best: 2,
    controls: [
      'Versionnée avec le reste de la configuration, lisible par l’équipe',
      'Masquée dans les journaux, le fichier restant versionné tel quel',
      'Mot de passe retiré de l’URL, injecté depuis Secrets Manager',
      'Encodée en base64, pour qu’elle ne se lise pas d’un coup d’œil',
    ],
    why: 'postgres://novafact:motdepasse@… : la chaîne de connexion contient un identifiant et son mot de passe, c’est un secret habillé en paramètre. La masquer dans les journaux traite une fuite parmi d’autres, pas le dépôt où elle est écrite ; le base64 est un encodage, pas une protection. On sort le secret de la configuration, ou on le supprime avec l’authentification IAM de RDS.' },

  { id: 'cognito-client-id', level: 3, where: 'infra', avoid: ['jwks-cognito'],
    name: 'Identifiant client de l’application web', detail: 'client_id Cognito de l’application React, présent dans le bundle JavaScript', cls: 'publique', best: 3,
    controls: [
      'Déplacé dans Secrets Manager et servi par une Lambda intermédiaire',
      'Changé à chaque version du front, pour limiter sa durée de validité',
      'Obfusqué dans le bundle, pour qu’un scanner ne le trouve pas',
      'Client public sans secret, flux code avec PKCE, redirections listées',
    ],
    why: 'Un client_id désigne une application, pas un utilisateur : toute application qui tourne dans le navigateur le livre à ses visiteurs, et OAuth le prévoit. La sécurité repose sur ce qui l’entoure — aucun secret client dans le front, PKCE pour lier le code à qui l’a demandé, liste exacte des adresses de redirection. Le cacher ou le faire tourner protège une donnée publique.' },

  { id: 'emails-haches', level: 3, where: 'analytics',
    name: 'E-mails des clients hachés en SHA-256', detail: 'Envoyés à une régie publicitaire pour cibler des profils similaires', cls: 'confidentielle', best: 2,
    controls: [
      'Classés anonymes : un hachage ne se renverse pas mathématiquement',
      'Salés avec une valeur aléatoire propre à chaque envoi à la régie',
      'Traités comme les e-mails : base légale, contrat, droit d’opposition',
      'Tronqués aux huit premiers caractères du hachage avant l’envoi',
    ],
    why: 'Un e-mail haché reste une donnée personnelle : la régie retrouve la personne en hachant les adresses qu’elle connaît déjà — c’est le principe même de l’appariement. La FTC américaine l’a rappelé en 2024 dans un billet dont le titre dit en substance que hacher ne rend toujours pas les données anonymes. Saler à chaque envoi casserait l’appariement attendu ; tronquer rend le hachage moins précis, pas moins personnel.' },

  { id: 'event-lambda-connexion', level: 3, where: 'journaux',
    name: 'Événements journalisés par la Lambda de connexion', detail: 'Un console.log(event) ajouté pour déboguer, toujours en place', cls: 'secrete', best: 1,
    controls: [
      'Accès aux journaux restreint et audité, comme pour les autres logs',
      'Journalisation par liste de champs, et purge du groupe de journaux',
      'Rétention du groupe CloudWatch ramenée de trente à sept jours',
      'Chiffrement du groupe de journaux par une clé KMS dédiée',
    ],
    why: 'L’événement d’API Gateway contient les en-têtes et le corps de la requête : sur la route de connexion, des mots de passe en clair. Ces journaux ne sont plus confidentiels, ils sont secrets. Facebook l’a reconnu en 2019 : des applications internes avaient journalisé en clair les mots de passe de centaines de millions de comptes, lisibles par des milliers d’employés. On ne range pas mieux ces secrets, on cesse de les écrire.' },

  { id: 'tfstate-production', level: 3, where: 'infra',
    name: 'État Terraform de la production', detail: 'Fichier terraform.tfstate dans un bucket S3, qui décrit l’infrastructure déployée', cls: 'secrete', best: 3,
    controls: [
      'Lisible par tous les développeurs, pour comprendre l’infrastructure',
      'Commité dans le dépôt d’infrastructure, pour garder l’historique',
      'Classé interne, les valeurs sensibles étant marquées sensitive',
      'Bucket dédié, chiffré, lecture limitée aux rôles qui déploient',
    ],
    why: 'L’état Terraform contient les attributs de toutes les ressources, y compris le mot de passe maître d’une base ou une valeur générée par random_password, en clair. L’attribut sensitive masque la valeur à l’affichage du plan, pas dans l’état : c’est le piège. Le fichier se protège donc comme les secrets qu’il contient.' },

  { id: 'urls-analytics', level: 3, where: 'analytics', avoid: ['url-presignee'],
    name: 'URL des pages vues, envoyées à l’outil d’analytics', detail: 'Collectées telles quelles, chaîne de requête comprise, sur toute l’application', cls: 'secrete', best: 0,
    controls: [
      'Paramètres filtrés par liste blanche avant l’envoi à l’outil',
      'Accès à l’outil d’analytics limité à l’équipe produit',
      'Adresse IP tronquée, pour que les visites restent anonymes',
      'Cookies de mesure limités à treize mois, comme le veut la CNIL',
    ],
    why: 'Les liens d’invitation, de réinitialisation de mot de passe ou de connexion par e-mail portent un jeton dans leur chaîne de requête : collectées telles quelles, les URL envoient des secrets actifs chez un tiers. La classe se décide sur ces quelques pages, pas sur la moyenne. Tronquer l’IP ou limiter les cookies traite la vie privée des visiteurs, pas les comptes qu’on ouvre avec ces jetons.' },

  { id: 'factures-apres-resiliation', level: 3, where: 'produit',
    name: 'Factures d’un auto-entrepreneur qui résilie', detail: 'Celles que Novafact lui a émises pour son abonnement ; il demande l’effacement de ses données', cls: 'confidentielle', best: 1,
    controls: [
      'Effacées sur-le-champ, le droit à l’effacement primant sur le reste',
      'Archivées à part, accès restreint, supprimées à l’échéance légale',
      'Anonymisées en retirant son nom, les montants restant exploitables',
      'Conservées sans limite, au cas où un litige surviendrait plus tard',
    ],
    why: 'Le droit à l’effacement cède devant une obligation légale de conservation (article 17 du RGPD), et les pièces comptables se gardent dix ans. La donnée reste confidentielle ; ce qui change est son usage, réduit à la preuve : on l’isole de la production, on en restreint l’accès, et on la supprime vraiment le jour où l’obligation tombe. Retirer le nom laisse le SIREN et l’adresse.' },

  { id: 'prompt-systeme', level: 3, where: 'ia',
    name: 'Prompt système de l’assistant IA', detail: 'Ses instructions, dont les règles sur ce qu’il peut montrer à chaque rôle', cls: 'interne', best: 2,
    controls: [
      'Classé secret, avec consigne au modèle de ne jamais le révéler',
      'Chiffré dans le dépôt, déchiffré en mémoire au démarrage',
      'Écrit comme s’il allait fuiter : droits vérifiés hors du modèle',
      'Réécrit chaque semaine, pour qu’une version extraite soit périmée',
    ],
    why: 'Un prompt système s’extrait : en 2023, un étudiant a obtenu celui de Bing Chat en lui demandant d’ignorer ses instructions et de réciter le début du document, et Microsoft en a confirmé l’authenticité. Il ne doit contenir ni clé ni règle d’accès qui n’existerait que là. Les droits par rôle se vérifient dans le code qui appelle les outils ; le reste, ton et format, est interne.' },
];

// ── Les séries ──────────────────────────────────────────────────────────────

const mix = (n1: number, n2: number, n3: number): [number, number, number] => [n1, n2, n3];
const inWhere = (...w: DataWhere[]) => (d: DataItem) => w.includes(d.where);

const PROFILES: SeriesProfile<DataItem>[] = [
  { id: 'decouverte', title: 'Découverte', mix: mix(8, 0, 0), level: 1,
    text: 'Le nom suffit à classer, et les mauvais contrôles protègent visiblement la mauvaise chose. On apprend l’échelle.' },
  { id: 'premiers-pieges', title: 'Premiers pièges', mix: mix(5, 3, 0), level: 1,
    text: 'Trois données demandent de lire le détail, avec un contrôle à moitié juste parmi les réponses.' },
  { id: 'lire-le-detail', title: 'Lire le détail', mix: mix(2, 6, 0), level: 2,
    text: 'Un agrégat, le contenu réel d’un journal, un usage : la classe tient à la ligne sous le nom.' },
  { id: 'coulisses', title: 'Les coulisses', filter: inWhere('infra', 'journaux'), mix: mix(2, 3, 3), level: 2,
    text: 'Clés, journaux, sauvegardes, CI et infrastructure as code : les données que personne ne voit, et qui ouvrent tout.' },
  { id: 'hors-de-la-base', title: 'Hors de la base', filter: inWhere('analytics', 'ia', 'support'), mix: mix(0, 3, 5), level: 3,
    text: 'Exports, analytics, support, assistant IA : des copies et des dérivés qui héritent de leur source sans le dire.' },
  { id: 'faux-semblants', title: 'Faux-semblants', mix: mix(0, 2, 6), level: 3,
    text: 'Un secret déguisé en configuration, une « clé » publique, trois colonnes anodines qui ré-identifient.' },
  { id: 'expert', title: 'Expert', mix: mix(0, 0, 8), level: 3,
    text: 'Huit données dont la classe se renverse sur un détail. Le contrôle le plus protecteur en apparence est souvent le piège.' },
  { id: 'melee', title: 'Mêlée', mix: mix(3, 3, 2), level: 2, shuffleEachTime: true,
    text: 'Tous niveaux confondus, recomposée à chaque partie. C’est la seule série qu’on ne peut pas réviser.' },
];

export const dataMapSeries = defineSeries(dataItems, PROFILES);

// Jeu « Red vs Blue : Novafact » (capstone) : analyser une chaîne d'attaque complète côté Red,
// puis défendre en profondeur côté Blue avec un budget limité.
//
// Deux règles d'écriture, et la seconde est celle qui fait la difficulté :
//
//   · **plusieurs chaînes**, tirées au sort. Une chaîne unique se rejoue de
//     mémoire dès la deuxième partie ;
//
//   · **ce qu'un contrôle casse ne s'affiche pas avant l'attaque**. Tant que le
//     bouton annonçait « casse : pp, imds », le joueur résolvait un problème de
//     sac à dos, pas une question de sécurité. Le champ `cuts` est donc réservé
//     à l'écran de résultat : pendant la phase Blue, on décide sur le nom du
//     contrôle, son étage et son coût — comme dans un vrai arbitrage.
//
// Chaque jeu de contrôles contient des leurres : des mesures réelles, utiles
// ailleurs, qui ne coupent rien de CETTE chaîne.

export type Link = {
  id: string;
  step: string;         // ce que fait l'attaquant
  technique: string;    // nom court de la technique
  module: string;       // module du parcours qui la traite
};

export type Control = {
  id: string;
  name: string;
  stage: 'code' | 'build' | 'infra' | 'runtime';
  cost: number;
  cuts: string[];       // liens de la chaîne que ce contrôle brise — masqué pendant le jeu
  /** Ne casse rien, mais raccourcit le temps de résidence. */
  detects?: boolean;
  desc: string;
};

export interface RedBlueScenario {
  id: string;
  title: string;
  intro: string;
  budget: number;
  chain: Link[];        // ordre chronologique canonique
  controls: Control[];
}

export const scenarios: RedBlueScenario[] = [
  {
    id: 'app-to-cloud',
    title: 'De la requête au bucket',
    intro: 'Une chaîne qui part d’une prototype pollution dans une route de réglages et finit sur l’exfiltration du compartiment des factures. Cinq maillons, quatre étages de défense.',
    budget: 100,
    chain: [
      { id: 'pp', step: 'Le corps JSON d’une route de réglages pollue Object.prototype via __proto__.', technique: 'Prototype pollution', module: 'M3' },
      { id: 'rce', step: 'La pollution modifie une option d’un moteur de rendu et aboutit à une exécution de code sur l’API.', technique: 'RCE par gadget', module: 'M3' },
      { id: 'imds', step: 'Depuis l’API, une requête vers 169.254.169.254 récupère les identifiants du rôle de l’instance.', technique: 'Accès IMDS', module: 'M15' },
      { id: 'iam', step: 'Le rôle, trop permissif, permet d’assumer un rôle plus privilégié.', technique: 'Escalade IAM', module: 'M15' },
      { id: 's3', step: 'Le rôle privilégié lit et exfiltre le bucket des factures.', technique: 'Exfiltration S3', module: 'M15' },
    ],
    controls: [
      { id: 'schema', name: 'Validation stricte des entrées (zod, refus de __proto__)', stage: 'code', cost: 30, cuts: ['pp'], desc: 'Casse la chaîne à la racine : sans pollution, rien ne suit.' },
      { id: 'nullproto', name: 'Fusion vers des objets sans prototype', stage: 'code', cost: 20, cuts: ['pp'], desc: 'Neutralise la pollution même si une clé __proto__ passe la validation.' },
      { id: 'semgrep', name: 'Règle SAST sur les fusions récursives d’entrées', stage: 'build', cost: 15, cuts: [], desc: 'Empêche la réintroduction de la classe en pull request — et pas l’instance déjà déployée, qui est celle qu’on exploite ici.' },
      { id: 'imdsv2', name: 'IMDSv2 obligatoire (http_tokens = required)', stage: 'infra', cost: 20, cuts: ['imds'], desc: 'Une exécution de code ne suffit plus à lire les identifiants d’instance : il faut une requête en deux temps, que le gadget ne sait pas faire.' },
      { id: 'egress', name: 'Filtrage du trafic sortant de l’API', stage: 'runtime', cost: 25, cuts: ['imds', 's3'], desc: 'Deux maillons d’un coup : l’accès au service de métadonnées et la sortie des données.' },
      { id: 'leastpriv', name: 'Rôle au moindre privilège (pas de PassRole large)', stage: 'infra', cost: 30, cuts: ['iam'], desc: 'Même avec les identifiants du rôle, aucune escalade n’est possible.' },
      { id: 'scp', name: 'SCP et RCP (régions, périmètre de données)', stage: 'infra', cost: 25, cuts: ['iam', 's3'], desc: 'Un plafond d’organisation : il borne l’escalade et refuse l’accès hors périmètre.' },
      { id: 'detect', name: 'Détection Elastic (IAM anormal, exfiltration S3)', stage: 'runtime', cost: 15, cuts: [], detects: true, desc: 'Ne casse aucun maillon et réduit le temps de résidence : indispensable en complément, jamais à la place.' },
      { id: 'waf', name: 'WAF générique en frontal', stage: 'runtime', cost: 20, cuts: [], desc: 'Utile contre les charges connues, et sans prise sur un corps JSON parfaitement bien formé : c’est le leurre le plus coûteux de la liste.' },
    ],
  },
  {
    id: 'supply-chain',
    title: 'Du titre de PR au poste du client',
    intro: 'Une chaîne qui part d’un titre de pull request et finit sur les secrets des clients de Novafact. La défense ne se joue pas là où on l’attend : une partie des contrôles protège vos clients, pas vous.',
    budget: 100,
    chain: [
      { id: 'inject', step: 'Le titre d’une pull request externe est interpolé dans une commande run du workflow.', technique: 'Injection de workflow', module: 'M14' },
      { id: 'secrets', step: 'Le workflow tourne avec le contexte de la branche cible : les secrets du dépôt sont lisibles.', technique: 'Vol de secrets de CI', module: 'M14' },
      { id: 'publish', step: 'Le jeton volé sert à publier une version piégée de @novafact/sdk.', technique: 'Publication malveillante', module: 'M14' },
      { id: 'install', step: 'Les clients installent la version ; un script de post-installation s’exécute chez eux.', technique: 'Exécution à l’installation', module: 'M14' },
      { id: 'exfil', step: 'Le script lit les variables d’environnement des postes et des CI clientes.', technique: 'Exfiltration de secrets', module: 'M14' },
    ],
    controls: [
      { id: 'noninterp', name: 'Aucune donnée de PR interpolée dans un bloc run', stage: 'code', cost: 30, cuts: ['inject'], desc: 'La racine : les données passent par l’environnement, où elles ne sont plus du code.' },
      { id: 'trigger', name: 'pull_request au lieu de pull_request_target pour les tests', stage: 'build', cost: 20, cuts: ['secrets'], desc: 'Le workflow perd l’accès aux secrets : l’injection reste possible et ne rapporte plus rien.' },
      { id: 'oidc', name: 'Trusted publishing, plus de jeton dans le dépôt', stage: 'build', cost: 25, cuts: ['publish'], desc: 'Il n’y a plus de secret de longue durée à voler, et la publication devient liée au workflow.' },
      { id: 'pin', name: 'Actions tierces épinglées par SHA de commit', stage: 'build', cost: 15, cuts: [], desc: 'Le bon réflexe contre une action compromise, et la chaîne ne passe par aucune action tierce : le vecteur est votre propre workflow.' },
      { id: 'noscripts', name: 'ignore-scripts imposé par la configuration npm publiée', stage: 'code', cost: 20, cuts: ['install'], desc: 'Un maillon chez vos clients : le paquet piégé arrive et ne s’exécute pas.' },
      { id: 'egressci', name: 'Filtrage du réseau sortant des runners', stage: 'runtime', cost: 25, cuts: ['secrets', 'exfil'], desc: 'Les secrets ne peuvent plus quitter le runner, et le script de post-installation non plus si les clients l’adoptent.' },
      { id: 'review', name: 'Deux approbations obligatoires avant fusion', stage: 'build', cost: 20, cuts: [], desc: 'Excellente pratique, hors sujet ici : rien n’est fusionné. Le workflow se déclenche à l’ouverture de la pull request.' },
      { id: 'detectpub', name: 'Alerte sur toute publication hors pipeline', stage: 'runtime', cost: 15, cuts: [], detects: true, desc: 'Ne coupe rien et réduit de plusieurs heures le délai entre la publication piégée et son retrait.' },
      { id: 'scan', name: 'Analyse antivirus des paquets avant publication', stage: 'build', cost: 20, cuts: [], desc: 'Le paquet n’est pas publié depuis votre pipeline : il est poussé directement au registre avec un jeton volé, sans passer par cette étape.' },
    ],
  },
  {
    id: 'identity',
    title: 'Du lien de déconnexion à l’export comptable',
    intro: 'Deux findings classés « faible » et une session d’administrateur. La chaîne est courte, les contrôles sont peu coûteux — et la moitié d’entre eux protège une étape que l’attaquant ne franchit jamais.',
    budget: 90,
    chain: [
      { id: 'prefix', step: 'Le fournisseur d’identité valide la redirect_uri par préfixe, pas par égalité.', technique: 'Validation par préfixe', module: 'M9' },
      { id: 'redirect', step: 'Un open redirect sur /logout?next= renvoie le code d’autorisation vers un domaine externe.', technique: 'Redirection ouverte', module: 'M9' },
      { id: 'token', step: 'Le code est échangé : l’attaquant tient une session d’administrateur de tenant.', technique: 'Vol de code OAuth', module: 'M9' },
      { id: 'invite', step: 'Depuis cette session, une invitation est envoyée vers une adresse contrôlée.', technique: 'Persistance par invitation', module: 'M8' },
      { id: 'export', step: 'L’export comptable complet du tenant est téléchargé.', technique: 'Exfiltration de données', module: 'M8' },
    ],
    controls: [
      { id: 'exacturi', name: 'redirect_uri comparée par égalité exacte', stage: 'code', cost: 25, cuts: ['prefix'], desc: 'La racine, et le seul contrôle qui couvre aussi les redirections ouvertes pas encore découvertes.' },
      { id: 'fixredirect', name: 'Destinations de redirection en liste fermée', stage: 'code', cost: 20, cuts: ['redirect'], desc: 'Casse cette chaîne ; une nouvelle page de retour en créera une autre un jour.' },
      { id: 'pkce', name: 'PKCE S256 sur le flux d’autorisation', stage: 'code', cost: 20, cuts: ['token'], desc: 'Le code intercepté ne s’échange pas sans le vérificateur, qui n’a jamais quitté le client légitime.' },
      { id: 'notify', name: 'Notification et validation de toute nouvelle invitation', stage: 'code', cost: 15, cuts: ['invite'], desc: 'Coupe la persistance : la session volée expire sans laisser de porte ouverte.' },
      { id: 'mfa', name: 'Second facteur obligatoire à la connexion', stage: 'infra', cost: 25, cuts: [], desc: 'Un contrôle de premier ordre, contourné ici sans être attaqué : personne ne se connecte, on vole une session déjà authentifiée.' },
      { id: 'dlp', name: 'Limite de volume et validation sur les exports', stage: 'runtime', cost: 20, cuts: ['export'], desc: 'Le dernier maillon : l’export massif demande une confirmation hors bande.' },
      { id: 'ratelimit', name: 'Limitation du débit sur la route d’authentification', stage: 'runtime', cost: 15, cuts: [], desc: 'Indispensable contre le bourrage d’identifiants, inopérant ici : la chaîne ne tente aucun mot de passe.' },
      { id: 'alertexport', name: 'Alerte sur les exports inhabituels par tenant', stage: 'runtime', cost: 10, cuts: [], detects: true, desc: 'Ne casse rien et fait la différence entre découvrir la fuite le jour même ou par un client.' },
      { id: 'hsts', name: 'HSTS avec préchargement sur tous les domaines', stage: 'infra', cost: 15, cuts: [], desc: 'De l’hygiène de transport, sans prise : toute la chaîne se déroule déjà en HTTPS, sur des domaines valides.' },
    ],
  },
];

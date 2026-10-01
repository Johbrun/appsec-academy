// Jeu « Red vs Blue : Novafact » (capstone) : analyser une chaîne d'attaque complète côté Red,
// puis défendre en profondeur côté Blue avec un budget limité.
//
// Deux règles d'écriture, et la seconde est celle qui fait la difficulté :
//
//   · **plusieurs chaînes**, une par série. Une chaîne unique se rejoue de
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
//
// Les maillons restent abstraits : une phrase qui dit l'étape et sa technique,
// jamais de charge utile ni de commande. La substance est côté défense : ce
// que chaque contrôle casse, et surtout pourquoi les autres ne cassent rien.
//
// Une partie des scénarios est calquée sur des incidents publics (champ
// `source`), fidèles aux post-mortems ; la transposition à Novafact est dite
// dans la note. Les autres sont fictifs, et ne s'en cachent pas.
//
// ── Les niveaux ─────────────────────────────────────────────────────────────
//
// La difficulté ne tient pas au sujet mais à la **forme de la chaîne** et à la
// qualité des leurres :
//
//   N1 · 4 maillons, un seul chemin. Un contrôle bon marché coupe la chaîne
//        tôt, et les leurres sont faux pour une raison visible : ils protègent
//        un autre actif, un autre canal, une autre étape que celles de la
//        chaîne. On apprend la forme : un maillon rompu, et rien ne suit.
//
//   N2 · 5 à 6 maillons, un seul chemin. Les leurres sont **crédibles** : de
//        bonnes pratiques, souvent celles qu'on cite en premier (second
//        facteur, chiffrement au repos, masquage des secrets), qui ne coupent
//        rien ICI pour une raison qu'il faut lire dans la chaîne. Deux
//        contrôles au nom voisin peuvent avoir des effets opposés.
//
//   N3 · 5 à 6 étapes, dont plusieurs à **deux voies** (champ `or`) : un
//        contrôle qui ne ferme qu'une voie ne coupe pas l'étape. Le budget ne
//        permet pas de tout fermer, le contrôle le plus cher n'est pas le
//        meilleur, et certaines étapes ne se ferment pas du tout : la
//        détection devient une vraie décision, pas un bonus.

import type { Level } from './catalog';
import { defineSeries } from '../lib/series';

export type Link = {
  id: string;
  step: string;         // ce que fait l'attaquant
  technique: string;    // nom court de la technique
  module: string;       // module du parcours qui la traite
  /**
   * Voie alternative à la même étape (N3) : l'id du maillon voisin qui mène au
   * même point. Les deux sont adjacents dans `chain`, et l'étape n'est coupée
   * que si les deux voies le sont.
   */
  or?: string;
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

/** Le cas réel dont un scénario est calqué. */
export type RealCase = {
  name: string;
  year: number;
  /** Ce qui est fidèle au cas, et ce qui a été transposé à Novafact. */
  note: string;
  url: string;
};

export interface RedBlueScenario {
  id: string;
  level: Level;
  title: string;
  intro: string;
  budget: number;
  chain: Link[];        // ordre chronologique canonique
  controls: Control[];
  source?: RealCase;
  avoid?: string[];
}

/**
 * Les étapes d'une chaîne : un maillon seul, ou deux voies alternatives
 * (`or`) regroupées. Sans voie alternative, une étape = un maillon.
 */
export function stagesOf(chain: Link[]): Link[][] {
  const out: Link[][] = [];
  chain.forEach((l) => {
    const prev = out[out.length - 1];
    if (prev && prev.some((p) => p.or === l.id || l.or === p.id)) prev.push(l);
    else out.push([l]);
  });
  return out;
}

export const scenarios: RedBlueScenario[] = [
  // ── N1 ────────────────────────────────────────────────────────────────────
  {
    id: 'cle-du-depot',
    level: 1,
    title: 'La clé du dépôt privé',
    intro: 'Un dépôt privé, un mot de passe déjà vu ailleurs, une clé AWS oubliée dans le code. Quatre maillons, et l’entrée ne passe pas du tout par l’application.',
    budget: 60,
    source: {
      name: 'Uber',
      year: 2016,
      note: 'Selon la plainte de la FTC, les intrus ont ouvert un dépôt GitHub privé d’ingénieurs d’Uber avec des mots de passe exposés dans d’autres fuites (pas de second facteur exigé), y ont trouvé une clé d’accès AWS en clair et s’en sont servis pour télécharger des fichiers depuis S3. Uber l’a appris par une demande de rançon. Transposé : le dépôt est celui de Novafact.',
      url: 'https://www.ftc.gov/legal-library/browse/cases-proceedings/152-3054-c-4662-uber-technologies-inc-matter',
    },
    chain: [
      { id: 'reuse', step: 'Des mots de passe issus de fuites d’autres services sont essayés sur les comptes GitHub des ingénieurs.', technique: 'Réutilisation d’identifiants', module: 'M10' },
      { id: 'repo', step: 'Un compte sans second facteur donne accès au dépôt privé de l’équipe.', technique: 'Accès au dépôt', module: 'M14' },
      { id: 'key', step: 'Le code contient une clé d’accès AWS longue durée, écrite en clair.', technique: 'Secret dans le code', module: 'M14' },
      { id: 's3', step: 'La clé sert à télécharger des fichiers de données personnelles depuis S3.', technique: 'Exfiltration S3', module: 'M15' },
    ],
    controls: [
      { id: 'orgmfa', name: 'Second facteur exigé par l’organisation GitHub', stage: 'build', cost: 10, cuts: ['repo'], desc: 'Le mot de passe réutilisé ne suffit plus à ouvrir le dépôt. C’est la coupure la plus précoce qui soit à la portée de Novafact : la fuite d’origine, elle, a eu lieu ailleurs.' },
      { id: 'roles', name: 'Plus aucune clé longue durée : rôles et identifiants temporaires', stage: 'infra', cost: 25, cuts: ['key'], desc: 'Le dépôt peut fuiter, il n’y a plus rien d’utilisable dedans. Un identifiant temporaire expire en quelques heures ; une clé d’accès vit jusqu’à ce qu’on pense à la révoquer.' },
      { id: 'secretscan', name: 'Analyse de secrets sur tout l’historique, révocation de ce qu’elle trouve', stage: 'build', cost: 15, cuts: ['key'], desc: 'Elle trouve la clé déjà commitée, pas seulement les prochaines. La révocation est la moitié qui compte : supprimer le fichier laisse la clé dans l’historique.' },
      { id: 'breached', name: 'Refus des mots de passe compromis sur la connexion à Novafact', stage: 'code', cost: 15, cuts: [], desc: 'Un bon contrôle anti-ATO pour les clients, sur le mauvais système : la chaîne vise des comptes GitHub, pas l’application.' },
      { id: 'sse', name: 'Chiffrement côté serveur des compartiments S3', stage: 'infra', cost: 10, cuts: [], desc: 'Transparent pour qui a le droit de lire : la clé volée lit l’objet, S3 le déchiffre pour elle. Le chiffrement au repos protège le support, pas l’accès.' },
      { id: 'waf', name: 'WAF géré devant l’API', stage: 'runtime', cost: 20, cuts: [], desc: 'Aucune requête de la chaîne ne passe par l’API : l’attaquant parle à GitHub, puis directement à S3.' },
      { id: 'alertkey', name: 'Alerte sur l’usage d’une clé depuis une adresse inhabituelle', stage: 'runtime', cost: 10, cuts: [], detects: true, desc: 'Ne casse rien. En 2016, Uber l’a appris quand l’attaquant a réclamé une rançon, un mois après le premier téléchargement.' },
    ],
  },
  {
    id: 'mot-de-passe-client',
    level: 1,
    title: 'Le mot de passe de la comptable',
    intro: 'Aucune faille dans Novafact : un mot de passe client volé il y a longtemps, sur un poste qui n’est pas le vôtre. La question est ce que la plateforme laisse faire avec.',
    budget: 60,
    source: {
      name: 'Snowflake (UNC5537)',
      year: 2024,
      note: 'Mandiant a relié le vol de données chez des clients de Snowflake (environ 165 organisations notifiées) à des identifiants récoltés par des infostealers, parfois depuis 2020 et jamais changés, sur des comptes sans second facteur ni liste de réseaux autorisés. Aucune faille du produit n’était en cause. Transposé : la plateforme est Novafact, le compte celui d’un tenant client.',
      url: 'https://cloud.google.com/blog/topics/threat-intelligence/unc5537-snowflake-data-theft-extortion',
    },
    chain: [
      { id: 'stealer', step: 'Un logiciel voleur d’identifiants, sur un poste qui sert aussi à un usage personnel, récolte le mot de passe Novafact d’une comptable cliente.', technique: 'Infostealer', module: 'M10' },
      { id: 'login', step: 'Des mois plus tard, le mot de passe, jamais changé, ouvre le compte depuis un réseau inconnu : aucun second facteur n’est demandé.', technique: 'Connexion valide', module: 'M10' },
      { id: 'export', step: 'Le compte lance l’export complet des factures et des coordonnées du tenant.', technique: 'Export massif', module: 'M8' },
      { id: 'extort', step: 'Les données servent à faire chanter le client, puis sont mises en vente.', technique: 'Extorsion', module: 'M17' },
    ],
    controls: [
      { id: 'mfa', name: 'Second facteur imposé à tous les comptes des tenants', stage: 'code', cost: 20, cuts: ['login'], desc: 'Le mot de passe seul n’ouvre plus rien. Pour un éditeur SaaS, c’est le point clé du cas : l’ATO des comptes clients devient ton incident, et c’est ta plateforme qui peut l’empêcher.' },
      { id: 'allowlist', name: 'Réseaux autorisés configurables par tenant', stage: 'code', cost: 20, cuts: ['login'], desc: 'La connexion depuis un réseau inconnu est refusée, mot de passe valide ou non. Efficace pour les tenants qui l’activent, ce qui en fait un complément du second facteur plutôt qu’un substitut.' },
      { id: 'exportcap', name: 'Confirmation hors bande des exports complets', stage: 'runtime', cost: 15, cuts: ['export'], desc: 'Coupe tard mais coupe : la session volée doit encore convaincre un canal qu’elle ne tient pas.' },
      { id: 'edr', name: 'EDR sur les postes des employés de Novafact', stage: 'runtime', cost: 20, cuts: [], desc: 'Le poste infecté est celui d’une cliente, hors de ton parc : l’EDR protège tes propres postes, pas ceux de tes clients.' },
      { id: 'kms', name: 'Chiffrement au repos de la base de production', stage: 'infra', cost: 15, cuts: [], desc: 'L’export passe par l’application, avec une session valide : les données sortent déchiffrées, comme pour n’importe quel utilisateur légitime.' },
      { id: 'pentest', name: 'Test d’intrusion annuel de l’API', stage: 'build', cost: 15, cuts: [], desc: 'Il cherche des failles, et la chaîne n’en utilise aucune : chaque requête est celle d’un utilisateur authentifié qui fait ce qu’il a le droit de faire.' },
      { id: 'newnet', name: 'Alerte « connexion depuis un réseau nouveau, puis export »', stage: 'runtime', cost: 10, cuts: [], detects: true, desc: 'Ne casse rien. C’est exactement la séquence que les clients touchés en 2024 n’ont pas vue à temps.' },
    ],
  },

  // ── N2 ────────────────────────────────────────────────────────────────────
  {
    id: 'identity',
    level: 2,
    title: 'Du lien de déconnexion à l’export comptable',
    intro: 'Deux findings classés « faible » et une session d’administrateur. La chaîne est courte, les contrôles sont peu coûteux — et plusieurs d’entre eux protègent une étape que l’attaquant ne franchit jamais.',
    budget: 90,
    chain: [
      { id: 'prefix', step: 'Le fournisseur d’identité valide la redirect_uri par préfixe, pas par égalité.', technique: 'Validation par préfixe', module: 'M9' },
      { id: 'redirect', step: 'Un open redirect sur /logout?next= renvoie le code d’autorisation vers un domaine externe.', technique: 'Redirection ouverte', module: 'M9' },
      { id: 'token', step: 'Le code est échangé : l’attaquant tient une session d’administrateur de tenant.', technique: 'Vol de code OAuth', module: 'M9' },
      { id: 'invite', step: 'Depuis cette session, une invitation est envoyée vers une adresse contrôlée.', technique: 'Persistance par invitation', module: 'M8' },
      { id: 'export', step: 'L’export comptable complet du tenant est téléchargé.', technique: 'Exfiltration de données', module: 'M8' },
    ],
    controls: [
      { id: 'exacturi', name: 'redirect_uri comparée par égalité exacte', stage: 'code', cost: 25, cuts: ['prefix'], desc: 'La racine, et le seul contrôle qui couvre aussi les redirections ouvertes pas encore découvertes. C’est la contre-mesure que la RFC 9700 impose pour ce vecteur.' },
      { id: 'fixredirect', name: 'Destinations de redirection en liste fermée', stage: 'code', cost: 20, cuts: ['redirect'], desc: 'Casse cette chaîne ; une nouvelle page de retour en créera une autre un jour.' },
      { id: 'pkce', name: 'PKCE S256 sur le flux d’autorisation', stage: 'code', cost: 20, cuts: [], desc: 'Le leurre le plus crédible. PKCE lie le code à la session qui a lancé le flux ; or c’est l’attaquant qui fabrique le lien d’autorisation, à partir d’une connexion qu’il a lui-même ouverte sur Novafact. Le code volé est lié à SA session, où le client légitime détient le bon vérificateur. Seule l’égalité exacte de redirect_uri ferme ce vecteur.' },
      { id: 'notify', name: 'Notification et validation de toute nouvelle invitation', stage: 'code', cost: 15, cuts: ['invite'], desc: 'Coupe la persistance : la session volée expire sans laisser de porte ouverte.' },
      { id: 'mfa', name: 'Second facteur obligatoire à la connexion', stage: 'infra', cost: 25, cuts: [], desc: 'Un contrôle de premier ordre, contourné ici sans être attaqué : l’administrateur s’authentifie lui-même, second facteur compris, et c’est le code émis ensuite qui part ailleurs.' },
      { id: 'dlp', name: 'Limite de volume et validation sur les exports', stage: 'runtime', cost: 20, cuts: ['export'], desc: 'Le dernier maillon : l’export massif demande une confirmation hors bande.' },
      { id: 'ratelimit', name: 'Limitation du débit sur la route d’authentification', stage: 'runtime', cost: 15, cuts: [], desc: 'Indispensable contre le bourrage d’identifiants, inopérant ici : la chaîne ne tente aucun mot de passe.' },
      { id: 'alertexport', name: 'Alerte sur les exports inhabituels par tenant', stage: 'runtime', cost: 10, cuts: [], detects: true, desc: 'Ne casse rien et fait la différence entre découvrir la fuite le jour même ou par un client.' },
      { id: 'hsts', name: 'HSTS avec préchargement sur tous les domaines', stage: 'infra', cost: 15, cuts: [], desc: 'De l’hygiène de transport, sans prise : toute la chaîne se déroule déjà en HTTPS, sur des domaines valides.' },
    ],
  },
  {
    id: 'pare-feu-bavard',
    level: 2,
    title: 'Le pare-feu qui relayait tout',
    intro: 'Le seul serveur EC2 qui reste chez Novafact héberge le pare-feu applicatif auto-géré d’un ancien portail. Il est mal configuré, et son rôle IAM a été écrit « pour que ça marche ».',
    budget: 90,
    source: {
      name: 'Capital One',
      year: 2019,
      note: 'Un pare-feu applicatif mal configuré, sur EC2, a relayé une requête vers le service de métadonnées (IMDSv1), qui a rendu les identifiants de son rôle. Ce rôle pouvait lister et lire les compartiments S3 ; les données, chiffrées, restaient déchiffrables avec cet accès. Environ 100 millions de personnes aux États-Unis et 6 millions au Canada. Transposé : le pare-feu protège un ancien portail de Novafact.',
      url: 'https://www.capitalone.com/digital/facts2019/',
    },
    chain: [
      { id: 'scan', step: 'Un balayage mené derrière Tor et un VPN repère un pare-feu applicatif mal configuré, exposé sur Internet.', technique: 'Reconnaissance', module: 'M11' },
      { id: 'ssrf', step: 'Le pare-feu accepte de relayer des requêtes vers des destinations internes choisies par l’appelant.', technique: 'SSRF', module: 'M3' },
      { id: 'imds', step: 'Une simple requête relayée vers le service de métadonnées (IMDSv1) renvoie les identifiants temporaires du rôle de l’instance.', technique: 'Accès IMDS', module: 'M15' },
      { id: 'list', step: 'Le rôle du pare-feu, bien plus large que son besoin, liste et lit des centaines de compartiments S3 ; les objets chiffrés sont déchiffrés au passage.', technique: 'Rôle trop large', module: 'M15' },
      { id: 'outside', step: 'Les identifiants sont utilisés depuis la machine de l’attaquant, hors d’AWS, pour copier les données.', technique: 'Exfiltration S3', module: 'M15' },
    ],
    controls: [
      { id: 'proxycfg', name: 'Pare-feu reconfiguré : aucun relais vers une destination arbitraire', stage: 'infra', cost: 25, cuts: ['ssrf'], desc: 'La racine exploitable. Le balayage, lui, ne se coupe pas : tout ce qui est exposé sur Internet est balayé en permanence.' },
      { id: 'imdsv2', name: 'IMDSv2 obligatoire (http_tokens = required)', stage: 'infra', cost: 10, cuts: ['imds'], desc: 'Ici, il coupe : la SSRF ne fait que relayer une requête simple, sans choisir la méthode ni les en-têtes, et ne peut pas obtenir le jeton de session que demande IMDSv2. C’est le contrôle bon marché de ce scénario.' },
      { id: 'leastpriv', name: 'Rôle du pare-feu réduit à ses seuls besoins (aucun accès S3)', stage: 'infra', cost: 20, cuts: ['list'], desc: 'Un pare-feu n’a aucune raison de lire des données de clients. Les identifiants volés existent toujours, ils n’ouvrent plus rien d’utile.' },
      { id: 'cmk', name: 'Clé KMS gérée par le client, déchiffrement réservé aux rôles métier', stage: 'infra', cost: 20, cuts: ['list'], desc: 'Le rôle du pare-feu lit l’objet chiffré et ne peut pas le déchiffrer : la politique de la clé ne l’autorise pas. C’est le chiffrement qui protège contre un accès, parce qu’il ajoute une seconde autorisation.' },
      { id: 'awskey', name: 'Chiffrement SSE-KMS avec la clé gérée par AWS (aws/s3)', stage: 'infra', cost: 10, cuts: [], desc: 'Même nom, effet opposé. La clé gérée par AWS s’utilise via S3 par tout principal du compte autorisé à lire l’objet : le déchiffrement suit l’accès, comme chez Capital One où l’accès obtenu permettait aussi de déchiffrer.' },
      { id: 'perimeter', name: 'SCP de périmètre réseau (refus hors des VPC et adresses attendus)', stage: 'infra', cost: 20, cuts: ['outside'], desc: 'Des identifiants de rôle utilisés depuis une adresse extérieure sont refusés, même valides. Coupe tard, et ne dispense pas du reste.' },
      { id: 'bpa', name: 'Blocage de l’accès public sur tous les compartiments', stage: 'infra', cost: 10, cuts: [], desc: 'Aucun compartiment n’était public : l’accès passe par des identifiants valides du compte, que ce réglage ne regarde pas.' },
      { id: 'consolemfa', name: 'Second facteur pour les accès console des administrateurs', stage: 'infra', cost: 15, cuts: [], desc: 'Personne ne se connecte à la console : les identifiants d’un rôle s’emploient directement sur l’API, sans mot de passe ni second facteur.' },
      { id: 'credexfil', name: 'Alerte sur des identifiants d’instance utilisés hors d’AWS', stage: 'runtime', cost: 10, cuts: [], detects: true, desc: 'Ne casse rien. Capital One a découvert l’intrusion de mars près de quatre mois plus tard, sur un signalement externe.' },
    ],
  },
  {
    id: 'script-de-couverture',
    level: 2,
    title: 'Le script de couverture',
    intro: 'Le pipeline de Novafact envoie ses résultats de couverture à un service tiers, via un script téléchargé à chaque job. Le fournisseur a un problème qu’il ignore encore. Tu ne peux rien chez lui : tout se joue chez toi.',
    budget: 90,
    source: {
      name: 'Codecov',
      year: 2021,
      note: 'Une erreur dans la fabrication d’une image Docker de Codecov a laissé fuiter une clé qui permettait de modifier son script Bash Uploader. Du 31 janvier au 1er avril 2021, le script a envoyé l’environnement des CI et l’adresse du dépôt vers un serveur tiers ; un client l’a repéré en comparant l’empreinte du script. Des victimes ont ensuite constaté l’accès à des dépôts privés (Rapid7 notamment). Transposé : la CI est celle de Novafact.',
      url: 'https://about.codecov.io/security-update/',
    },
    chain: [
      { id: 'vendor', step: 'Une clé fuit du processus de fabrication d’image du fournisseur ; elle sert à modifier le script qu’il distribue.', technique: 'Compromission du fournisseur', module: 'M14' },
      { id: 'run', step: 'Chaque job de la CI de Novafact télécharge la dernière version du script et l’exécute sans en vérifier l’empreinte.', technique: 'Exécution non vérifiée', module: 'M14' },
      { id: 'env', step: 'Le script modifié envoie toutes les variables d’environnement du job, et l’adresse du dépôt, vers un serveur tiers.', technique: 'Collecte de l’environnement', module: 'M14' },
      { id: 'tokens', step: 'L’environnement du job contient un jeton d’accès aux dépôts et une clé de déploiement, tous deux longue durée.', technique: 'Secrets longue durée', module: 'M14' },
      { id: 'repos', step: 'Le jeton sert à cloner des dépôts privés, où traînent d’autres identifiants internes.', technique: 'Accès au code source', module: 'M14' },
    ],
    controls: [
      { id: 'checksum', name: 'Script tiers figé à une version, empreinte vérifiée avant exécution', stage: 'build', cost: 15, cuts: ['run'], desc: 'La coupure la plus précoce à ta portée. C’est littéralement ce qui a fait découvrir l’incident : un client a comparé l’empreinte publiée à celle du script téléchargé.' },
      { id: 'egress', name: 'Runners derrière une liste fermée de destinations sortantes', stage: 'runtime', cost: 30, cuts: ['env'], desc: 'Le script s’exécute, et son envoi vers une adresse inconnue échoue. Efficace ici parce que la fuite passe par le réseau ; plus cher et plus lourd à maintenir que la vérification d’empreinte.' },
      { id: 'oidc', name: 'Identifiants de courte durée par OIDC, plus rien de longue durée dans le job', stage: 'build', cost: 25, cuts: ['tokens'], desc: 'La collecte réussit et ne rapporte que des jetons qui expirent avec le job, liés au dépôt et à l’environnement prévus.' },
      { id: 'ipallow', name: 'Liste d’adresses autorisées sur l’organisation Git', stage: 'infra', cost: 20, cuts: ['repos'], desc: 'Le jeton volé est refusé depuis une adresse extérieure. Coupe tard : la liste des secrets de la CI est déjà partie.' },
      { id: 'lockfile', name: 'Lockfile strict et audit des dépendances npm', stage: 'build', cost: 15, cuts: [], desc: 'Le leurre typique : le script n’est pas une dépendance npm. Il est téléchargé à la volée par le job, hors de tout ce que le lockfile et l’audit voient.' },
      { id: 'masking', name: 'Masquage des secrets dans les journaux de la CI', stage: 'build', cost: 10, cuts: [], desc: 'Le masquage filtre ce qui s’affiche dans les journaux ; le script, lui, lit l’environnement en mémoire et l’envoie par le réseau, sans rien afficher.' },
      { id: 'sast', name: 'Analyse statique à chaque pull request', stage: 'build', cost: 15, cuts: [], desc: 'Elle analyse ton code ; le code malveillant n’est jamais dans ton dépôt, il arrive au moment de l’exécution.' },
      { id: 'review', name: 'Deux approbations obligatoires avant fusion', stage: 'build', cost: 15, cuts: [], desc: 'Aucune modification ne passe par une pull request : le fichier de workflow est inchangé, c’est le contenu servi par le fournisseur qui a changé.' },
      { id: 'alerttok', name: 'Alerte sur l’usage des jetons de CI hors des adresses des runners', stage: 'runtime', cost: 10, cuts: [], detects: true, desc: 'Ne casse rien. Le script modifié est resté en place environ deux mois avant d’être repéré.' },
    ],
  },
  {
    id: 'cookie-ingenieur',
    level: 2,
    title: 'Le cookie de l’ingénieur',
    intro: 'Novafact conserve les jetons que ses clients lui confient pour synchroniser leur logiciel comptable. Tout est chiffré, l’accès à la production passe par un SSO avec second facteur. Six maillons, et l’attaquant ne se connecte jamais.',
    budget: 100,
    source: {
      name: 'CircleCI',
      year: 2023,
      note: 'Un logiciel malveillant, non détecté par l’antivirus, a volé sur le portable d’un ingénieur un cookie de session SSO déjà validé par le second facteur. L’attaquant a usurpé la session, généré des jetons d’accès à la production, exfiltré des variables d’environnement, jetons et clés de clients, et extrait les clés de chiffrement d’un processus en cours d’exécution. Un client a donné l’alerte. Transposé : les secrets sont les jetons d’intégration des clients de Novafact.',
      url: 'https://circleci.com/blog/jan-4-2023-incident-report/',
    },
    chain: [
      { id: 'malware', step: 'Un logiciel malveillant, que l’antivirus ne détecte pas, s’installe sur le portable d’un ingénieur.', technique: 'Poste compromis', module: 'M14' },
      { id: 'cookie', step: 'Il vole le cookie de la session SSO de l’ingénieur, déjà validée par le second facteur.', technique: 'Vol de session', module: 'M9' },
      { id: 'replay', step: 'L’attaquant rejoue la session depuis sa propre machine et se fait passer pour l’ingénieur.', technique: 'Usurpation de session', module: 'M9' },
      { id: 'prodtok', step: 'Les droits de l’ingénieur lui permettent de générer des jetons d’accès à la base et au stockage de production.', technique: 'Accès production', module: 'M15' },
      { id: 'decrypt', step: 'Il copie les jetons d’intégration des clients, chiffrés au repos, et récupère la clé dans la mémoire d’un processus en cours d’exécution.', technique: 'Contournement du chiffrement', module: 'M17' },
      { id: 'abuse', step: 'Les jetons des clients servent à accéder à leurs propres systèmes.', technique: 'Rebond chez les clients', module: 'M14' },
    ],
    controls: [
      { id: 'bound', name: 'Sessions d’accès liées à un appareil géré et vérifié', stage: 'infra', cost: 25, cuts: ['replay'], desc: 'Le cookie volé ne vaut rien sur une autre machine : la session exige un appareil que l’attaquant n’a pas. C’est le contrôle qui vise le cœur du cas.' },
      { id: 'stepup', name: 'Réauthentification par clé FIDO2 pour générer un jeton de production', stage: 'code', cost: 20, cuts: ['prodtok'], desc: 'La session volée suffit pour naviguer, pas pour l’action sensible : la clé physique est restée sur le bureau de l’ingénieur.' },
      { id: 'jit', name: 'Accès production juste-à-temps, approuvé par un pair', stage: 'infra', cost: 30, cuts: ['prodtok'], desc: 'Coupe le même maillon que la réauthentification, pour plus cher. Son vrai gain est ailleurs : moins de personnes détiennent en permanence le droit de générer ces jetons.' },
      { id: 'iprange', name: 'Jetons d’intégration utilisables seulement depuis les adresses de Novafact', stage: 'infra', cost: 20, cuts: ['abuse'], desc: 'Le dernier filet, et il dépend des clients : il faut que leur système accepte de restreindre les adresses. C’est l’une des recommandations faites après l’incident de 2023, avec OIDC.' },
      { id: 'mfapush', name: 'Second facteur obligatoire sur le SSO', stage: 'infra', cost: 15, cuts: [], desc: 'Il était déjà là. Le cookie volé est émis après le second facteur : le rejouer, c’est hériter d’une authentification déjà complète.' },
      { id: 'atrest', name: 'Chiffrement au repos des jetons clients', stage: 'infra', cost: 15, cuts: [], desc: 'Déjà en place aussi. Un processus qui déchiffre a la clé en mémoire ; qui contrôle la production la trouve là.' },
      { id: 'rotate', name: 'Rotation trimestrielle des jetons clients', stage: 'runtime', cost: 15, cuts: [], desc: 'Utile pour borner la durée de vie, sans prise sur une attaque qui va du vol à l’exfiltration en moins d’une semaine.' },
      { id: 'av', name: 'Deuxième antivirus sur les postes', stage: 'runtime', cost: 15, cuts: [], desc: 'Empiler les moteurs de signatures n’achète pas grand-chose contre un logiciel conçu pour passer inaperçu ; la chaîne suppose précisément qu’il ne l’est pas.' },
      { id: 'alertprod', name: 'Alerte sur la génération de jetons de production depuis un appareil inconnu', stage: 'runtime', cost: 10, cuts: [], detects: true, desc: 'Ne casse rien. Chez CircleCI, l’exfiltration date du 22 décembre 2022 et l’alerte est venue d’un client le 29.' },
    ],
  },

  // ── N3 ────────────────────────────────────────────────────────────────────
  {
    id: 'app-to-cloud',
    level: 3,
    title: 'De la requête au bucket',
    intro: 'L’API de Novafact tourne sur ECS Fargate et lit les factures dans S3. Deux entrées mènent à une exécution de code dans la tâche, deux voies mènent aux factures, deux voies les font sortir. Le budget ne ferme pas tout : choisis où tu coupes, et ce que tu regardes.',
    budget: 90,
    chain: [
      { id: 'pp', or: 'ssti', step: 'Le corps JSON d’une route de réglages pollue Object.prototype via une fusion récursive maison.', technique: 'Prototype pollution', module: 'M3' },
      { id: 'ssti', or: 'pp', step: 'Un modèle de facture personnalisé, fourni par un client, glisse une expression que le moteur de gabarits évalue.', technique: 'SSTI', module: 'M3' },
      { id: 'rce', step: 'Par l’une ou l’autre voie, le moteur de gabarits exécute du code dans la tâche Fargate de l’API.', technique: 'Exécution de code', module: 'M3' },
      { id: 'creds', step: 'Le code lit les identifiants temporaires du rôle de tâche auprès du point de terminaison de l’agent ECS, comme le fait le SDK.', technique: 'Identifiants de tâche', module: 'M15' },
      { id: 'escalate', or: 'broad', step: 'Le rôle de tâche peut transmettre un rôle d’administration à une fonction qu’il crée, et l’emprunter ainsi.', technique: 'Escalade IAM', module: 'M15' },
      { id: 'broad', or: 'escalate', step: 'Plus simple : le rôle de tâche lit déjà tout le compartiment des factures, pour tous les tenants.', technique: 'Rôle trop large', module: 'M15' },
      { id: 'direct', or: 'outside', step: 'Les factures sont envoyées depuis la tâche vers un serveur externe.', technique: 'Exfiltration directe', module: 'M17' },
      { id: 'outside', or: 'direct', step: 'Les identifiants sont renvoyés dans une réponse de l’API, puis utilisés depuis l’extérieur d’AWS.', technique: 'Identifiants rejoués', module: 'M15' },
    ],
    controls: [
      { id: 'nullproto', name: 'Fusion vers des objets sans prototype, clés dangereuses refusées', stage: 'code', cost: 15, cuts: ['pp'], desc: 'Ferme la voie de la pollution pour pas cher. Seule, elle ne coupe pas l’étape : les modèles clients restent une seconde porte vers le même moteur.' },
      { id: 'schema', name: 'Validation stricte des entrées de toutes les routes (zod)', stage: 'code', cost: 25, cuts: ['pp'], desc: 'Même effet que la fusion sans prototype sur cette chaîne, pour plus cher : un modèle de facture est un texte valide, que le schéma laisse passer.' },
      { id: 'logicless', name: 'Modèles clients rendus par un moteur sans logique ni évaluation', stage: 'code', cost: 30, cuts: ['ssti'], desc: 'Un modèle client ne peut plus rien évaluer. Avec la fusion sans prototype, les deux entrées sont fermées : c’est la seule coupure à la racine de ce scénario, et elle coûte la moitié du budget.' },
      { id: 'imdsv2', name: 'IMDSv2 obligatoire (http_tokens = required)', stage: 'infra', cost: 10, cuts: [], desc: 'Deux fois hors sujet. Sur Fargate, le rôle de tâche ne passe pas par l’IMDS d’EC2 mais par le point de terminaison de l’agent ECS. Et IMDSv2 bloque des SSRF simples, pas du code qui s’exécute sur place et peut faire la requête en deux temps.' },
      { id: 'distroless', name: 'Image distroless, système de fichiers en lecture seule', stage: 'runtime', cost: 20, cuts: [], desc: 'Réduit ce qu’un attaquant trouve dans le conteneur et l’empêche d’y écrire, mais le code injecté s’exécute dans le processus Node lui-même : il n’a besoin ni de shell ni de disque.' },
      { id: 'nopassrole', name: 'Rôle de tâche sans iam:PassRole ni création de fonction', stage: 'infra', cost: 20, cuts: ['escalate'], desc: 'Ferme l’escalade, pas l’étape : le rôle lit déjà toutes les factures. Le moindre privilège, ici, c’est surtout le périmètre des données, et il se conçoit dans l’application.' },
      { id: 'egress', name: 'Sortie de la tâche limitée à une liste fermée de destinations', stage: 'runtime', cost: 25, cuts: ['direct'], desc: 'L’envoi vers un serveur inconnu échoue. Mais les réponses de l’API sortent par définition : le filtrage de sortie ne voit pas ce canal-là.' },
      { id: 'perimeter', name: 'SCP de périmètre réseau sur les rôles applicatifs', stage: 'infra', cost: 20, cuts: ['outside'], desc: 'Des identifiants de tâche rejoués depuis l’extérieur des VPC attendus sont refusés. Avec le filtrage de sortie, l’étape finale est fermée — tant que l’attaquant ne travaille pas depuis la tâche elle-même, lentement, par les réponses de l’API.' },
      { id: 'detect', name: 'Détection Elastic : appels IAM et lectures S3 anormaux du rôle de tâche', stage: 'runtime', cost: 15, cuts: [], detects: true, desc: 'Ne casse rien, et c’est le seul contrôle qui voie les étapes qu’aucun budget ne ferme ici : la lecture des identifiants et un rôle qui lit soudain les factures de tous les tenants.' },
      { id: 'waf', name: 'WAF géré avec règles d’injection en frontal', stage: 'runtime', cost: 35, cuts: [], desc: 'Le plus cher de la liste. Un corps JSON bien formé et un modèle de facture sont du contenu légitime ; des règles génériques n’y voient rien de fiable. Le coût n’achète pas la pertinence.' },
    ],
  },
  {
    id: 'supply-chain',
    level: 3,
    title: 'De la pull request au poste du client',
    intro: 'Une chaîne qui part d’une pull request externe sur le dépôt public du SDK et finit sur les secrets des clients de Novafact. Deux façons d’entrer, deux façons de faire sortir les secrets, deux façons de s’exécuter chez le client. Une partie des contrôles protège vos clients, pas vous.',
    budget: 80,
    chain: [
      { id: 'inject', or: 'checkout', step: 'Le titre d’une pull request externe est interpolé dans une commande run du workflow.', technique: 'Injection de workflow', module: 'M14' },
      { id: 'checkout', or: 'inject', step: 'Le workflow extrait le code de la pull request et lance ses scripts de test.', technique: 'Code de PR exécuté', module: 'M14' },
      { id: 'secrets', step: 'Le workflow est déclenché par pull_request_target : il tourne avec les secrets du dépôt, dont le jeton de publication npm.', technique: 'Vol de secrets de CI', module: 'M14' },
      { id: 'egress', or: 'logs', step: 'Les secrets sont envoyés vers un serveur externe.', technique: 'Exfiltration réseau', module: 'M14' },
      { id: 'logs', or: 'egress', step: 'Les secrets sont écrits, encodés pour échapper au masquage, dans le journal public du workflow.', technique: 'Fuite par les journaux', module: 'M14' },
      { id: 'publish', step: 'Le jeton volé sert à publier une version piégée de @novafact/sdk.', technique: 'Publication malveillante', module: 'M14' },
      { id: 'postinstall', or: 'import', step: 'Chez les clients, un script de cycle de vie s’exécute à l’installation.', technique: 'Exécution à l’installation', module: 'M14' },
      { id: 'import', or: 'postinstall', step: 'Chez les clients, le code piégé s’exécute au premier import du SDK.', technique: 'Exécution à l’import', module: 'M14' },
      { id: 'exfil', step: 'Le code lit les variables d’environnement des postes et des CI clientes.', technique: 'Exfiltration de secrets', module: 'M14' },
    ],
    controls: [
      { id: 'noninterp', name: 'Aucune donnée de PR interpolée dans un bloc run', stage: 'code', cost: 20, cuts: ['inject'], desc: 'Les données passent par l’environnement, où elles ne sont plus du code. Ferme une entrée sur deux : le code de la pull request, lui, s’exécute toujours.' },
      { id: 'nocheckout', name: 'Jamais d’extraction du code de la PR dans un workflow privilégié', stage: 'build', cost: 15, cuts: ['checkout'], desc: 'Ferme l’autre entrée. Avec la précédente, l’étape est coupée — pour 35, là où un seul contrôle un cran plus loin coupe tout pour moins.' },
      { id: 'trigger', name: 'pull_request au lieu de pull_request_target pour les tests', stage: 'build', cost: 15, cuts: ['secrets'], desc: 'Le point d’étranglement : quelle que soit l’entrée, un workflow déclenché depuis un fork par pull_request ne reçoit pas les secrets du dépôt. L’injection reste possible et ne rapporte plus rien.' },
      { id: 'oidc', name: 'Trusted publishing, plus aucun jeton npm dans le dépôt', stage: 'build', cost: 20, cuts: ['publish'], desc: 'Il n’y a plus de jeton de longue durée à voler : la publication passe par OIDC et n’est acceptée que depuis le workflow de publication déclaré. À condition de révoquer les anciens jetons.' },
      { id: 'egressci', name: 'Runners derrière une liste fermée de destinations sortantes', stage: 'runtime', cost: 35, cuts: ['egress'], desc: 'Le plus cher, et il ne ferme qu’une voie : les journaux d’un dépôt public se lisent sans rien franchir. C’est ainsi que tj-actions/changed-files (mars 2025) a laissé fuiter des secrets, encodés dans les journaux des workflows.' },
      { id: 'noscripts', name: 'Recommander ignore-scripts dans le .npmrc des intégrateurs', stage: 'code', cost: 10, cuts: ['postinstall'], desc: 'Un paquet ne peut pas imposer ce réglage : c’est le .npmrc du projet ou de la CI qui installe qui le fixe. Même adopté, il ne ferme qu’une voie : le code piégé placé dans le module s’exécute au premier import.' },
      { id: 'pin', name: 'Actions tierces épinglées par SHA de commit', stage: 'build', cost: 10, cuts: [], desc: 'Le bon réflexe contre une action compromise ; ici, la chaîne ne passe par aucune action tierce, le vecteur est votre propre workflow.' },
      { id: 'review', name: 'Deux approbations obligatoires avant fusion', stage: 'build', cost: 15, cuts: [], desc: 'Rien n’est fusionné : le workflow se déclenche à l’ouverture de la pull request, avant toute revue.' },
      { id: 'scan', name: 'Analyse antivirus des paquets avant publication', stage: 'build', cost: 15, cuts: [], desc: 'La version piégée ne passe pas par votre pipeline : elle est poussée directement au registre avec le jeton volé.' },
      { id: 'detectpub', name: 'Alerte sur toute publication hors du workflow de publication', stage: 'runtime', cost: 15, cuts: [], detects: true, desc: 'Ne casse rien, et chaque heure gagnée entre la publication piégée et son retrait est une heure de moins d’installations chez les clients. Avec ce budget, elle se paie en renonçant à un maillon.' },
    ],
  },
];

// ── Les séries ──────────────────────────────────────────────────────────────
//
// Une série = un scénario : une chaîne se joue d'une traite, et c'est le
// scénario lui-même qui porte la difficulté. L'ordre suit la progression.

export const redBlueSeries = defineSeries(scenarios, [
  { id: 'cle-du-depot', ids: ['cle-du-depot'], title: 'La clé du dépôt privé',
    text: 'Uber, 2016. Quatre maillons, un seul chemin, et l’application n’est jamais touchée : les leurres protègent tous autre chose.' },
  { id: 'mot-de-passe-client', ids: ['mot-de-passe-client'], title: 'Le mot de passe de la comptable',
    text: 'Snowflake, 2024. Aucune faille exploitée, un poste compromis qui n’est pas le tien : que peut faire la plateforme ?' },
  { id: 'identity', ids: ['identity'], title: 'Du lien de déconnexion à l’export',
    text: 'Deux findings « faibles » enchaînés. Les leurres sont des contrôles d’authentification sérieux : il faut lire qui fabrique quoi.' },
  { id: 'pare-feu-bavard', ids: ['pare-feu-bavard'], title: 'Le pare-feu qui relayait tout',
    text: 'Capital One, 2019. Cinq maillons, et des contrôles au nom voisin dont les effets divergent. Lis ce que chaque rôle a le droit de faire.' },
  { id: 'script-de-couverture', ids: ['script-de-couverture'], title: 'Le script de couverture',
    text: 'Codecov, 2021. Le premier maillon se passe chez un fournisseur, hors de ta portée. Les leurres sont les contrôles de CI qu’on cite d’habitude.' },
  { id: 'cookie-ingenieur', ids: ['cookie-ingenieur'], title: 'Le cookie de l’ingénieur',
    text: 'CircleCI, 2023. Six maillons, et une défense qui avait déjà tout ce qu’on cite en premier.' },
  { id: 'app-to-cloud', ids: ['app-to-cloud'], title: 'De la requête au bucket',
    text: 'Trois étapes à deux voies : fermer une voie ne coupe pas l’étape. Le budget ne ferme pas tout, et certaines étapes ne se ferment pas.' },
  { id: 'supply-chain', ids: ['supply-chain'], title: 'De la pull request au client',
    text: 'Neuf maillons, trois étapes à deux voies, un budget serré : entre couper plus et voir plus tôt, il faut trancher.' },
]);

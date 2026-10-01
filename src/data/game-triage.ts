// Données du jeu « Triage Room » : des files de findings à trier avec la grille
// de Novafact (leçon M05-3), et, pour les files les plus dures, un budget de
// sprint à répartir.
//
// La grille (`decide`) est celle de la leçon, mot pour mot : le jeu ne l'invente
// pas, il l'entraîne. Ce qui fait la difficulté n'est donc jamais la règle —
// elle tient en cinq lignes — mais la **lecture du finding** : quel signal
// compte, lequel est un leurre, et si l'affirmation qu'on te présente tient.
//
//   N1 · Un critère tranche, et il saute aux yeux : inscrit au KEV sur une
//        image exposée, composant absent de ce qu'on livre, aucun signal du
//        tout. Les autres champs ne tirent pas en sens contraire. On apprend
//        l'ordre des règles.
//
//   N2 · Des critères **en tension** : CVSS critique mais code non atteignable,
//        EPSS bas mais preuve de concept publique, KEV mais actif interne,
//        EPSS « 88e percentile » qui n'est que 2 %, un seuil atteint tout juste,
//        un « back-office » servi sur Internet. Il faut appliquer les règles
//        dans l'ordre sans se laisser tirer par le chiffre le plus gros.
//
//   N3 · L'atteignabilité n'est plus un fait mais une **affirmation** : l'équipe
//        propose un VEX, et la justification tient ou ne tient pas (une
//        recherche qui ne voit pas les dépendances transitives, une règle WAF
//        prise pour une absence de code, `devDependencies` pris pour « pas
//        livré », l'exposition confondue avec l'atteignabilité). Un VEX bien
//        justifié l'emporte sur un KEV ; un VEX mal justifié est le piège. Ces
//        files se terminent par un budget de sprint où l'ancienneté des
//        findings et l'ordre des règles forcent des arbitrages fins.
//
// Les composants sont réels. Les findings sans identifiant sont fictifs : ils
// décrivent une classe de défaut plausible pour le composant, sans renvoyer à
// un avis publié. Ceux qui portent un identifiant CVE sont réels et vérifiés
// (React2Shell, tj-actions/changed-files, libwebp, Next.js, Git) ; leurs
// signaux KEV et EPSS sont un instantané (catalogue KEV de la CISA et API EPSS
// de FIRST, 29-30 septembre 2026), qui aura bougé depuis.

import { defineSeries, type Leveled } from '../lib/series';

export type Decision = 'act' | 'attend' | 'trackstar' | 'track' | 'vex';
export type Cvss = 'Critique' | 'Haute' | 'Moyenne' | 'Faible';
export type Queue = 'front' | 'images' | 'api' | 'interne' | 'sprint-38' | 'sprint-39';

export interface Finding extends Leveled {
  queue: Queue;
  title: string;
  component: string;
  /** Seulement pour les CVE réelles et vérifiées. */
  cve?: string;
  cvss: Cvss;
  epss: number;       // probabilité, en %
  /** Le rang EPSS, quand le scanner l'affiche à côté : un leurre fréquent. */
  percentile?: number;
  kev: boolean;
  poc: boolean;
  /** L'atteignabilité réelle, celle que lit la grille. */
  reach: 'oui' | 'non' | 'inconnue';
  /** Ce que la file affiche quand c'est une affirmation de l'équipe (N3). */
  reachShown?: string;
  exposure: 'Internet' | 'Interne';
  asset: 'Critique' | 'Standard';
  /** Le contexte : ce que fait le composant chez Novafact, ou la justification proposée. */
  note?: string;
  /** Ce que la décision apprend, au-delà de la règle appliquée. */
  explain: string;
  /** Files avec budget : l'ancienneté du finding, en jours. */
  age?: number;
  /** Files avec budget : l'effort, en jours-développeur. */
  effort?: number;
  /** Nom court, pour le tableau du sprint. */
  short?: string;
}

export const decisions: { id: Decision; label: string; sla: string }[] = [
  { id: 'act', label: 'Act', sla: '24 à 72 h' },
  { id: 'attend', label: 'Attend', sla: '7 jours' },
  { id: 'trackstar', label: 'Track*', sla: '30 jours' },
  { id: 'track', label: 'Track', sla: 'cycle normal' },
  { id: 'vex', label: 'Clore (VEX)', sla: 'not_affected' },
];

// La grille de Novafact, identique à celle de la leçon M05-3.
export function decide(f: Finding): { d: Decision; rule: string } {
  const signal = f.poc || f.epss >= 10;
  if (f.reach === 'non') return { d: 'vex', rule: 'Code vulnérable non atteignable : on clôt avec un VEX not_affected justifié.' };
  if (f.kev && f.exposure === 'Internet') return { d: 'act', rule: 'Exploitée activement (KEV) et exposée sur Internet : Act.' };
  if (f.kev || (signal && f.exposure === 'Internet')) return { d: 'attend', rule: f.kev ? 'Exploitée activement mais interne : Attend.' : 'Preuve de concept ou EPSS élevé, et exposée : Attend.' };
  if (signal || (f.exposure === 'Internet' && f.asset === 'Critique' && (f.cvss === 'Critique' || f.cvss === 'Haute')))
    return { d: 'trackstar', rule: signal ? 'Signal d’exploitation, mais composant interne : Track*.' : 'Gravité haute sur un actif critique exposé, sans signal d’exploitation : Track*.' };
  return { d: 'track', rule: 'Aucun signal d’exploitation, pas d’actif critique exposé : Track, cycle normal.' };
}

/** Délai de chaque décision, en jours, pour le calcul des échéances du sprint. */
export const SLA_DAYS: Partial<Record<Decision, number>> = { act: 3, attend: 7, trackstar: 30 };
/** Durée d'un sprint : ce qui échoit avant le suivant doit entrer dans celui-ci. */
export const SPRINT_DAYS = 14;

const WEBP = ['img-libwebp', 'api-sharp-libwebp', 'int-chromium-webp'];
const R2S = ['int-backoffice-r2s', 's38-r2s-pages'];
const others = (group: string[], id: string) => group.filter((x) => x !== id);

export const findings: Finding[] = [
  // ── File 1 · Dépendances du front (N1) ────────────────────────────────────
  {
    id: 'front-vite-dev', level: 1, queue: 'front',
    title: 'Lecture de fichiers hors de la racine par le serveur de développement', component: 'vite (devDependency)',
    cvss: 'Haute', epss: 2.1, kev: false, poc: true, reach: 'non', exposure: 'Interne', asset: 'Standard',
    note: 'Le serveur de développement ne tourne que sur les postes. En production, CloudFront sert les fichiers statiques produits par vite build : ce serveur n’y existe pas.',
    explain: 'La règle 1 passe avant tout le reste : le produit livré ne contient pas le code vulnérable, et un VEX not_affected le dit aux clients. Les postes des développeurs, eux, restent exposés si le serveur écoute sur le réseau (--host) : la mise à jour se fait quand même, au cycle normal.',
  },
  {
    id: 'front-dompurify', level: 1, queue: 'front',
    title: 'Contournement de l’assainissement HTML par mutation (mXSS)', component: 'dompurify (notes riches de l’espace client)',
    cvss: 'Moyenne', epss: 0.8, kev: false, poc: true, reach: 'oui', exposure: 'Internet', asset: 'Critique',
    note: 'Les notes riches saisies par un client sont assainies par DOMPurify avant d’être affichées à ses collaborateurs.',
    explain: 'Une preuve de concept publique sur un composant exposé suffit pour la règle 3 : Attend, sept jours. L’EPSS bas et la gravité moyenne ne changent rien : la grille lit le signal d’exploitation avant la gravité.',
  },
  {
    id: 'front-recharts', level: 1, queue: 'front',
    title: 'Plantage du rendu sur une série de données malformée', component: 'recharts (tableau de bord de trésorerie)',
    cvss: 'Moyenne', epss: 0.3, kev: false, poc: false, reach: 'oui', exposure: 'Internet', asset: 'Standard',
    note: 'Les graphiques du tableau de bord affichent les montants renvoyés par l’API de facturation.',
    explain: 'Aucun signal d’exploitation, gravité moyenne, actif standard : aucune règle ne s’applique avant la dernière. Track : la mise à jour suivra le prochain lot de Renovate.',
  },
  {
    id: 'front-axios', level: 1, queue: 'front',
    title: 'En-tête d’authentification envoyé à un hôte tiers sur une URL absolue', component: 'axios (client HTTP de l’espace client)',
    cvss: 'Haute', epss: 1.5, kev: false, poc: false, reach: 'oui', exposure: 'Internet', asset: 'Critique',
    note: 'L’espace client appelle l’API avec un jeton porté par l’instance axios partagée.',
    explain: 'Pas de preuve de concept, EPSS bas : ni la règle 2 ni la règle 3. Mais la seconde condition de la règle 4 s’applique : gravité haute sur un actif critique exposé. Track*, trente jours.',
  },
  {
    id: 'front-react-router', level: 1, queue: 'front',
    title: 'Empoisonnement de cache dans le rendu côté serveur', component: 'react-router (routage de l’espace client)',
    cvss: 'Haute', epss: 3.4, kev: false, poc: true, reach: 'non', exposure: 'Internet', asset: 'Critique',
    note: 'L’espace client est une application monopage : aucun rendu côté serveur, CloudFront ne sert que des fichiers statiques. Le code vulnérable n’appartient qu’au mode serveur du framework.',
    explain: 'Preuve de concept, Internet, actif critique : tout pousse vers Attend, mais la règle 1 est évaluée d’abord. Le mode serveur ne s’exécute jamais : VEX « code vulnérable hors du chemin d’exécution », à réviser le jour où l’équipe passera au rendu serveur.',
  },
  {
    id: 'front-pdfjs', level: 1, queue: 'front',
    title: 'Exécution de JavaScript à l’ouverture d’un PDF piégé', component: 'pdfjs-dist (aperçu des factures fournisseurs)',
    cvss: 'Haute', epss: 18, kev: false, poc: true, reach: 'oui', exposure: 'Internet', asset: 'Critique',
    note: 'L’espace client affiche l’aperçu des factures fournisseurs que les clients importent.',
    explain: 'EPSS de 18 % : au-dessus du seuil de 10 %, sur un composant exposé. Règle 3, Attend. Un PDF importé par un client et affiché à ses collaborateurs est exactement le chemin qu’emprunterait l’attaque.',
  },
  {
    id: 'front-babel', level: 1, queue: 'front',
    title: 'Exécution de code en compilant un fichier source piégé', component: '@babel/traverse (compilation en CI)',
    cvss: 'Critique', epss: 0.6, kev: false, poc: true, reach: 'oui', exposure: 'Interne', asset: 'Standard',
    note: 'Babel tourne sur les runners de CI, pendant la compilation du front.',
    explain: 'Preuve de concept publique, mais sur un composant interne : règle 4, Track*. La gravité critique ne suffit pas à monter plus haut, puisque rien n’est exposé sur Internet.',
  },
  {
    id: 'front-postcss', level: 1, queue: 'front',
    title: 'Mauvaise analyse des retours à la ligne dans les commentaires CSS', component: 'postcss (compilation des feuilles de style)',
    cvss: 'Moyenne', epss: 0.2, kev: false, poc: false, reach: 'oui', exposure: 'Interne', asset: 'Standard',
    explain: 'Outil de compilation, aucun signal, gravité moyenne : Track. C’est le cas le plus fréquent d’une file de dépendances, et il ne mérite pas plus que la prochaine mise à jour groupée.',
  },

  // ── File 2 · Images de conteneur (N1) ─────────────────────────────────────
  {
    id: 'img-build-python', level: 1, queue: 'images',
    title: 'Débordement de tampon dans l’interpréteur Python', component: 'python3 (étape de build, Dockerfile multi-stage)',
    cvss: 'Haute', epss: 1.2, kev: false, poc: true, reach: 'non', exposure: 'Interne', asset: 'Standard',
    note: 'Python ne sert qu’à compiler des modules natifs dans l’étape de build. L’image finale ne copie que dist/ et les node_modules de production : le scanner a analysé l’image de build.',
    explain: 'Le composant est absent de l’image déployée : c’est la justification VEX la plus solide. La vraie correction est ailleurs : scanner l’image publiée, pas celle de build, pour ne plus produire ce finding.',
  },
  {
    id: 'img-libwebp', level: 1, queue: 'images', avoid: others(WEBP, 'img-libwebp'),
    title: 'Dépassement de tas dans le décodage d’images WebP', component: 'libwebp (image de base de l’API, figée depuis 2023)', cve: 'CVE-2023-4863',
    cvss: 'Haute', epss: 99.9, kev: true, poc: true, reach: 'inconnue', exposure: 'Internet', asset: 'Critique',
    note: 'L’image de base n’a pas été reconstruite depuis l’été 2023. Personne ne sait si un processus de l’API décode du WebP avec la bibliothèque système.',
    explain: 'Inscrite au KEV dès septembre 2023, sur une image exposée : Act, et l’atteignabilité inconnue n’y change rien, puisqu’elle compte comme atteignable. Le correctif est une reconstruction sur une base à jour ; la leçon, qu’une image figée depuis deux ans accumule ce genre de finding.',
  },
  {
    id: 'img-libxml2', level: 1, queue: 'images',
    title: 'Lecture hors limites en analysant un document XML', component: 'libxml2 (image de l’API)',
    cvss: 'Haute', epss: 1.0, kev: false, poc: true, reach: 'inconnue', exposure: 'Internet', asset: 'Critique',
    note: 'L’API reçoit les factures XML du connecteur Chorus Pro ; on ne sait pas encore si le parseur utilisé s’appuie sur libxml2.',
    explain: 'Une atteignabilité inconnue compte comme atteignable : on ne clôt pas sur un doute. Preuve de concept et exposition Internet : règle 3, Attend. Si l’analyse montre ensuite que le parseur est en JavaScript pur, le finding passera en VEX — après, pas avant.',
  },
  {
    id: 'img-minizip', level: 1, queue: 'images',
    title: 'Dépassement d’entier dans une fonction de décompression d’archives ZIP', component: 'zlib (image de base node:20-bookworm-slim)',
    cvss: 'Critique', epss: 0.9, kev: false, poc: true, reach: 'non', exposure: 'Internet', asset: 'Critique',
    note: 'La fonction vulnérable appartient à minizip, distribué dans un paquet à part. L’image n’installe que la bibliothèque zlib : minizip n’y est pas.',
    explain: 'Critique, preuve de concept, exposée : sans la règle 1, ce serait Attend. Le scanner a rapproché un nom de paquet d’un avis qui vise un composant absent de l’image ; la liste des paquets de l’image publiée justifie le VEX.',
  },
  {
    id: 'img-curl', level: 1, queue: 'images',
    title: 'Fuite d’identifiants lors d’une redirection', component: 'curl (image du worker d’e-mails)',
    cvss: 'Moyenne', epss: 0.6, kev: false, poc: false, reach: 'inconnue', exposure: 'Interne', asset: 'Standard',
    note: 'curl sert au contrôle de santé du conteneur.',
    explain: 'Inconnue compte comme atteignable, mais rien d’autre ne s’applique : pas de signal, pas d’exposition, gravité moyenne. Track. Remplacer curl par un contrôle de santé en Node ferait disparaître la question.',
  },
  {
    id: 'img-busybox', level: 1, queue: 'images',
    title: 'Injection de séquences d’échappement dans la sortie d’un utilitaire', component: 'busybox (image alpine du worker de relances)',
    cvss: 'Moyenne', epss: 0.4, kev: false, poc: true, reach: 'inconnue', exposure: 'Interne', asset: 'Standard',
    explain: 'Preuve de concept publique, composant interne : règle 4, Track*. Le signal d’exploitation suffit, même sur une gravité moyenne.',
  },
  {
    id: 'img-ncurses', level: 1, queue: 'images',
    title: 'Corruption mémoire en lisant une description de terminal', component: 'ncurses (image de base de l’API)',
    cvss: 'Moyenne', epss: 0.1, kev: false, poc: false, reach: 'inconnue', exposure: 'Internet', asset: 'Critique',
    explain: 'L’image est exposée et l’actif critique, mais la seconde condition de la règle 4 exige une gravité haute ou critique. Gravité moyenne, aucun signal : Track.',
  },
  {
    id: 'img-node-smuggling', level: 1, queue: 'images',
    title: 'Désynchronisation de requêtes HTTP (request smuggling)', component: 'node 20 (runtime de l’API)',
    cvss: 'Haute', epss: 2.7, kev: false, poc: false, reach: 'oui', exposure: 'Internet', asset: 'Critique',
    explain: 'Gravité haute sur un actif critique exposé, sans signal d’exploitation : seconde condition de la règle 4, Track*. Le correctif est une montée de version mineure de l’image de base.',
  },

  // ── File 3 · API de facturation (N2) ──────────────────────────────────────
  {
    id: 'api-sharp-libwebp', level: 2, queue: 'api', avoid: others(WEBP, 'api-sharp-libwebp'),
    title: 'Dépassement de tas dans le décodage d’images WebP', component: 'sharp 0.32.1 (vignettes des logos clients)', cve: 'CVE-2023-4863',
    cvss: 'Haute', epss: 99.9, kev: true, poc: true, reach: 'oui', exposure: 'Internet', asset: 'Critique',
    note: 'La CVE vise libwebp, que sharp embarque avec libvips ; les versions de sharp antérieures à 0.32.6 sont touchées. L’API redimensionne les logos que les clients téléversent.',
    explain: 'Le piège est de lire « libwebp » et de conclure que notre code n’est pas concerné : sharp embarque la bibliothèque, et chaque logo WebP téléversé passe par le décodeur vulnérable. KEV et Internet : Act. Cette CVE ne visait pas que les navigateurs, mais tout logiciel qui décode du WebP avec libwebp.',
  },
  {
    id: 'api-xml2js', level: 2, queue: 'api',
    title: 'Pollution de prototype à l’analyse de XML', component: 'xml2js (connecteur Chorus Pro)',
    cvss: 'Critique', epss: 2.4, percentile: 88, kev: false, poc: false, reach: 'oui', exposure: 'Internet', asset: 'Critique',
    explain: 'Deux leurres : la gravité critique et le 88e percentile. Le seuil de la grille porte sur la probabilité (2,4 %), pas sur le rang ; sans preuve de concept, les règles 2 et 3 ne s’appliquent pas. Reste la seconde condition de la règle 4 : Track*.',
  },
  {
    id: 'api-jsonwebtoken', level: 2, queue: 'api',
    title: 'Confusion d’algorithme lors de la vérification de signature', component: 'jsonwebtoken (dépendance transitive)',
    cvss: 'Critique', epss: 0.9, kev: false, poc: true, reach: 'non', exposure: 'Internet', asset: 'Critique',
    note: 'L’API vérifie les jetons Cognito avec aws-jwt-verify. jsonwebtoken n’arrive que par un outil d’administration en ligne de commande, jamais importé par le serveur : graphe d’appels du SCA, confirmé par une règle ESLint en CI.',
    explain: 'Critique, preuve de concept, actif le plus exposé : tout pousse vers Attend. Mais la règle 1 passe d’abord, et la justification est solide : un graphe d’appels, et un contrôle qui la maintient vraie. Un VEX est un engagement, pas un raccourci.',
  },
  {
    id: 'api-express-redirect', level: 2, queue: 'api',
    title: 'Redirection ouverte sur des URL malformées', component: 'express (res.redirect après déconnexion)',
    cvss: 'Moyenne', epss: 0.5, kev: false, poc: true, reach: 'oui', exposure: 'Internet', asset: 'Standard',
    explain: 'Une redirection ouverte paraît anodine ; elle sert surtout à l’hameçonnage, en empruntant notre domaine. Preuve de concept et exposition : règle 3, Attend. La grille ne regarde pas la gravité quand un signal d’exploitation existe.',
  },
  {
    id: 'api-undici', level: 2, queue: 'api',
    title: 'En-tête d’autorisation conservé après une redirection vers une autre origine', component: 'undici (appels au prestataire de paiement)',
    cvss: 'Moyenne', epss: 11, kev: false, poc: false, reach: 'oui', exposure: 'Internet', asset: 'Critique',
    note: 'L’API appelle le prestataire de paiement avec une clé secrète dans l’en-tête Authorization.',
    explain: 'EPSS de 11 % : juste au-dessus du seuil, sur un actif exposé. Règle 3, Attend, malgré une gravité moyenne. Si le seuil de 10 % semble arbitraire, c’est la grille qu’on rediscute, pas ce finding.',
  },
  {
    id: 'api-cookie-faible', level: 2, queue: 'api',
    title: 'Caractères hors limites acceptés dans le nom d’un cookie', component: 'cookie (analyse des cookies de session)',
    cvss: 'Faible', epss: 0.2, kev: false, poc: false, reach: 'oui', exposure: 'Internet', asset: 'Critique',
    explain: 'Exposée, actif critique… et gravité faible : la seconde condition de la règle 4 exige une gravité haute ou critique. Sans signal d’exploitation, Track.',
  },
  {
    id: 'api-body-parser', level: 2, queue: 'api',
    title: 'Déni de service par un encodage d’URL très imbriqué', component: 'body-parser (formulaires encodés)',
    cvss: 'Haute', epss: 0.5, kev: false, poc: false, reach: 'inconnue', exposure: 'Internet', asset: 'Critique',
    note: 'L’équipe pense que l’API n’accepte que du JSON, mais le parseur urlencoded est monté globalement dans app.ts.',
    explain: 'L’atteignabilité est inconnue, et la note montre même un chemin probable : pas de VEX. Sans signal, c’est la seconde condition de la règle 4 qui joue : Track*.',
  },
  {
    id: 'api-multer', level: 2, queue: 'api',
    title: 'Déni de service par une requête multipart malformée', component: 'multer (import des pièces jointes)',
    cvss: 'Haute', epss: 0.4, kev: false, poc: true, reach: 'oui', exposure: 'Internet', asset: 'Critique',
    explain: 'EPSS de 0,4 % : on serait tenté de classer Track*. Mais une preuve de concept publique suffit, sur un composant exposé : règle 3, Attend. L’EPSS estime une probabilité ; la preuve de concept est un fait.',
  },

  // ── File 4 · Outils internes et workers (N2) ──────────────────────────────
  {
    id: 'int-backoffice-r2s', level: 2, queue: 'interne', avoid: others(R2S, 'int-backoffice-r2s'),
    title: 'Exécution de code à distance dans les React Server Components (React2Shell)', component: 'Next.js 15, App Router (back-office financier)', cve: 'CVE-2025-55182',
    cvss: 'Critique', epss: 99.8, kev: true, poc: true, reach: 'oui', exposure: 'Internet', asset: 'Critique',
    note: 'Le back-office de l’équipe finance est servi sur admin.novafact.fr ; l’authentification se fait dans l’application.',
    explain: 'La file s’appelle « outils internes », et c’est le piège : ce back-office est joignable depuis Internet, et la faille s’exploite sans authentification, par une requête HTTP. KEV et exposé : Act. Publiée le 3 décembre 2025, React2Shell est entrée au KEV deux jours plus tard.',
  },
  {
    id: 'int-chromium-webp', level: 2, queue: 'interne', avoid: others(WEBP, 'int-chromium-webp'),
    title: 'Dépassement de tas dans le décodage d’images WebP', component: 'chromium (service de rendu PDF, via Puppeteer)', cve: 'CVE-2023-4863',
    cvss: 'Haute', epss: 99.9, kev: true, poc: true, reach: 'oui', exposure: 'Interne', asset: 'Critique',
    note: 'Le service PDF, joignable seulement depuis l’API, rend les factures avec Chromium ; les logos des clients y sont intégrés.',
    explain: 'Exploitée activement, mais sur un service non exposé : règle 3, Attend, pas Act. « Interne » ne veut pas dire « inaccessible » pour autant : le logo vient d’un client et atteint Chromium à travers l’API. Même CVE que dans sharp ou dans une image de base, et pas la même décision.',
  },
  {
    id: 'int-next-middleware', level: 2, queue: 'interne',
    title: 'Contournement du middleware par l’en-tête x-middleware-subrequest', component: 'Next.js 14, next start (outil de support)', cve: 'CVE-2025-29927',
    cvss: 'Critique', epss: 99.2, kev: false, poc: true, reach: 'oui', exposure: 'Interne', asset: 'Standard',
    note: 'L’outil de support n’est joignable que par le VPN ; son contrôle d’accès est fait dans le middleware Next.js.',
    explain: 'EPSS à 99 % et preuve de concept : on voudrait Act. Mais la CVE n’est pas au KEV, et l’outil n’est pas exposé : règle 4, Track*. En attendant le correctif, filtrer l’en-tête au proxy, comme le recommandait l’avis de Next.js, coûte une ligne.',
  },
  {
    id: 'int-knex-vex', level: 2, queue: 'interne',
    title: 'Injection SQL dans la fonction de requête brute', component: 'knex (outil de reporting)',
    cvss: 'Critique', epss: 5, kev: false, poc: true, reach: 'non', exposure: 'Interne', asset: 'Critique',
    note: 'Le reporting n’utilise que le constructeur de requêtes : la fonction raw n’est appelée nulle part, et une règle ESLint l’interdit dans le dépôt.',
    explain: 'Critique avec preuve de concept, sur un actif critique : la tentation est Track* ou plus. La justification tient pourtant, et elle est maintenue par un contrôle : règle 1, VEX. C’est aussi le moyen d’arrêter de revoir ce finding à chaque scan.',
  },
  {
    id: 'int-nodemailer', level: 2, queue: 'interne',
    title: 'Injection d’en-têtes dans la composition des e-mails', component: 'nodemailer (worker de relances)',
    cvss: 'Moyenne', epss: 0.6, kev: false, poc: false, reach: 'oui', exposure: 'Interne', asset: 'Critique',
    explain: 'Actif critique, mais interne, et gravité moyenne sans signal : aucune condition de la règle 4 n’est remplie, la seconde exigeant l’exposition. Track. L’importance métier des relances justifierait de réécrire la grille, pas de l’ignorer.',
  },
  {
    id: 'int-ws', level: 2, queue: 'interne',
    title: 'Déni de service par un grand nombre d’en-têtes', component: 'ws (notifications temps réel)',
    cvss: 'Haute', epss: 14, kev: false, poc: true, reach: 'oui', exposure: 'Internet', asset: 'Standard',
    note: 'Le serveur WebSocket, déployé avec les workers, pousse les notifications de paiement vers l’espace client.',
    explain: 'Rangé avec les workers, mais c’est l’espace client qui s’y connecte : exposé. EPSS de 14 % et preuve de concept : règle 3, Attend. Un « simple » déni de service sur un actif standard reste dans le délai de sept jours.',
  },
  {
    id: 'int-fontkit', level: 2, queue: 'interne',
    title: 'Lecture hors limites en analysant une police de caractères', component: 'fontkit (service de rendu PDF)',
    cvss: 'Haute', epss: 0.7, kev: false, poc: false, reach: 'inconnue', exposure: 'Interne', asset: 'Critique',
    explain: 'Inconnue compte comme atteignable, et l’actif est critique, mais interne : la seconde condition de la règle 4 ne vaut que pour un actif exposé. Sans signal : Track. Si les clients pouvaient un jour téléverser leurs polices, la question de l’exposition se reposerait.',
  },
  {
    id: 'int-lodash-worker', level: 2, queue: 'interne',
    title: 'Pollution de prototype dans une fonction de fusion', component: 'lodash (worker de relances)',
    cvss: 'Haute', epss: 35, kev: false, poc: true, reach: 'oui', exposure: 'Interne', asset: 'Critique',
    explain: 'EPSS de 35 % et preuve de concept : le signal est fort, l’exposition faible. Règle 4, Track*. Le worker ne lit que la file interne, mais les messages portent des champs saisis par les clients : à surveiller.',
  },

  // ── File 5 · Sprint 38 : API et services de rendu (N3) ────────────────────
  {
    id: 's38-saml-waf', level: 3, queue: 'sprint-38', short: 'xml-crypto',
    title: 'Contournement de la vérification de signature SAML', component: 'xml-crypto (SSO des grands comptes)',
    cvss: 'Critique', epss: 71, kev: false, poc: true, reach: 'oui', reachShown: 'non, selon l’équipe', exposure: 'Internet', asset: 'Critique',
    note: 'Proposition de VEX : « une règle WAF rejette désormais les assertions qui contiennent plusieurs signatures ».',
    explain: 'Une règle WAF ne rend pas le code inatteignable : elle filtre une forme d’attaque, et la suivante passera à côté. Le format VEX connaît bien la justification « mesures compensatoires », mais la grille de Novafact ne clôt que le code non atteignable. Preuve de concept et Internet : Attend, et le WAF sert de pansement en attendant.',
    age: 1, effort: 1.5,
  },
  {
    id: 's38-r2s-pages', level: 3, queue: 'sprint-38', short: 'React2Shell', avoid: others(R2S, 's38-r2s-pages'),
    title: 'Exécution de code à distance dans les React Server Components (React2Shell)', component: 'Next.js 15, Pages Router (portail des experts-comptables)', cve: 'CVE-2025-55182',
    cvss: 'Critique', epss: 99.8, kev: true, poc: true, reach: 'non', reachShown: 'non, selon l’équipe', exposure: 'Internet', asset: 'Standard',
    note: 'Proposition de VEX : le portail n’utilise que le Pages Router, aucun dossier app/. L’avis de Next.js déclare ces applications non affectées ; un test en CI échoue si un dossier app/ apparaît.',
    explain: 'KEV, Internet, EPSS à 99,8 %, CVSS 10 : tout crie Act, et la règle 1 passe pourtant avant. La justification tient : l’avis de Next.js exclut le Pages Router, et un contrôle en CI la maintient vraie. Monter de version reste souhaitable, au cycle normal.',
    age: 0, effort: 0.5,
  },
  {
    id: 's38-libxmljs', level: 3, queue: 'sprint-38', short: 'libxmljs2',
    title: 'Confusion de type en analysant un document XML piégé', component: 'libxmljs2 (validation XSD du connecteur Chorus Pro)',
    cvss: 'Haute', epss: 3, kev: false, poc: true, reach: 'oui', reachShown: 'non, selon l’équipe', exposure: 'Internet', asset: 'Critique',
    note: 'Proposition de VEX : « aucun fichier du dépôt n’importe libxmljs2 », recherche dans le code à l’appui. Le paquet est une dépendance du validateur XSD qu’appelle le connecteur.',
    explain: 'Une recherche dans le code trouve les imports directs, pas les appels qui passent par une dépendance : le validateur XSD appelle libxmljs2 pour chaque facture reçue. La justification ne tient pas, l’atteignabilité est réelle ; preuve de concept et Internet : Attend.',
    age: 2, effort: 1,
  },
  {
    id: 's38-send', level: 2, queue: 'sprint-38', short: 'send',
    title: 'Déni de service par un en-tête Range malformé', component: 'send (fichiers statiques de l’API)',
    cvss: 'Moyenne', epss: 10, kev: false, poc: false, reach: 'oui', exposure: 'Internet', asset: 'Standard',
    explain: 'EPSS de 10 % tout juste, et la grille dit « 10 % ou plus ». Règle 3, Attend. Les seuils se lisent à la lettre, sinon chacun les déplace d’un demi-point dans le sens qui l’arrange.',
    age: 0, effort: 0.5,
  },
  {
    id: 's38-busboy', level: 2, queue: 'sprint-38', short: 'busboy',
    title: 'Pièces jointes acceptées au-delà de la taille maximale', component: 'busboy (import de pièces jointes)',
    cvss: 'Haute', epss: 0.6, kev: false, poc: false, reach: 'oui', exposure: 'Internet', asset: 'Critique',
    explain: 'Gravité haute sur un actif critique exposé, sans signal : seconde condition de la règle 4, Track*. Retiens son ancienneté : vingt jours déjà, sur un délai de trente.',
    age: 20, effort: 1,
  },
  {
    id: 's38-pdfkit', level: 2, queue: 'sprint-38', short: 'pdfkit',
    title: 'Injection de contenu dans les métadonnées des PDF générés', component: 'pdfkit (factures PDF)',
    cvss: 'Critique', epss: 1.1, kev: false, poc: false, reach: 'oui', exposure: 'Internet', asset: 'Critique',
    explain: 'Critique sur un actif critique exposé, mais aucun signal d’exploitation : seconde condition de la règle 4, Track*. La gravité ne fait pas monter plus haut sans signal.',
    age: 2, effort: 2,
  },
  {
    id: 's38-handlebars', level: 3, queue: 'sprint-38', short: 'handlebars',
    title: 'Exécution de code à la compilation d’un modèle piégé', component: 'handlebars (modèles de relance)',
    cvss: 'Critique', epss: 6, kev: false, poc: true, reach: 'oui', reachShown: 'non, selon l’équipe', exposure: 'Interne', asset: 'Standard',
    note: 'Proposition de VEX : « handlebars est en devDependencies ». Le worker compile pourtant les modèles de relance, que les clients personnalisent, et le bundler embarque tout ce que le code importe.',
    explain: 'devDependencies est une étiquette de package.json, pas une propriété du code livré : un bundler embarque tout ce qui est importé. Le code vulnérable tourne, sur des modèles écrits par les clients. Preuve de concept, composant interne : Track*.',
    age: 0, effort: 1,
  },
  {
    id: 's38-json-errors', level: 2, queue: 'sprint-38', short: 'body-parser', avoid: ['api-cookie-faible'],
    title: 'Message d’erreur trop détaillé sur un JSON invalide', component: 'body-parser (API publique)',
    cvss: 'Faible', epss: 0.1, kev: false, poc: false, reach: 'oui', exposure: 'Internet', asset: 'Critique',
    explain: 'Actif critique exposé, mais gravité faible et aucun signal : Track. Il n’entre pas dans le budget du sprint ; il partira avec la prochaine mise à jour groupée.',
    age: 4, effort: 0.5,
  },

  // ── File 6 · Sprint 39 : CI, runners et infrastructure (N3) ───────────────
  {
    id: 's39-tj-actions', level: 3, queue: 'sprint-39', short: 'tj-actions',
    title: 'Action GitHub compromise : ses tags pointaient vers un commit qui exfiltre les secrets', component: 'tj-actions/changed-files (workflows de CI)', cve: 'CVE-2025-30066',
    cvss: 'Haute', epss: 72.1, kev: true, poc: true, reach: 'non', reachShown: 'non, selon l’équipe', exposure: 'Interne', asset: 'Critique',
    note: 'Proposition de VEX : les trois workflows qui l’utilisent l’épinglent par SHA complet, sur un commit antérieur à la compromission de mars 2025 ; zizmor refuse en CI toute action référencée par tag.',
    explain: 'En mars 2025, un attaquant a déplacé les tags de cette action vers un commit malveillant qui écrivait les secrets de CI dans les journaux. Un workflow épinglé par SHA sur un commit antérieur n’a jamais exécuté ce code : VEX, KEV ou pas. C’est exactement le cas que l’épinglage devait couvrir.',
    age: 0, effort: 0.5,
  },
  {
    id: 's39-lodash-lambda', level: 3, queue: 'sprint-39', short: 'lodash (Lambda)',
    title: 'Pollution de prototype dans la fusion des paramètres d’export', component: 'lodash (Lambda d’export comptable)',
    cvss: 'Haute', epss: 12, kev: false, poc: true, reach: 'oui', reachShown: 'non, selon l’équipe', exposure: 'Interne', asset: 'Critique',
    note: 'Proposition de VEX : « la Lambda n’est déclenchée que par EventBridge, rien ne vient d’Internet ». Les paramètres d’export qu’elle fusionne viennent pourtant du formulaire rempli par le client.',
    explain: 'L’équipe confond exposition et atteignabilité. La Lambda n’est pas exposée, et la grille en tient compte : Track* plutôt qu’Attend. Mais le code vulnérable s’exécute sur des données fournies par le client : un VEX not_affected serait faux.',
    age: 20, effort: 1,
  },
  {
    id: 's39-git', level: 2, queue: 'sprint-39', short: 'git',
    title: 'Exécution d’un hook au clonage récursif d’un dépôt piégé', component: 'git (runners auto-hébergés)', cve: 'CVE-2025-48384',
    cvss: 'Haute', epss: 4.2, kev: true, poc: true, reach: 'oui', exposure: 'Interne', asset: 'Critique',
    note: 'Les runners Linux clonent les dépôts de l’organisation, dont un qui utilise des sous-modules.',
    explain: 'Inscrite au KEV en août 2025, sur des runners internes : règle 3, Attend. L’EPSS de 4 % ne compte plus quand l’exploitation est avérée. Le correctif est une mise à jour de git dans l’image des runners.',
    age: 1, effort: 0.5,
  },
  {
    id: 's39-serve-static', level: 2, queue: 'sprint-39', short: 'serve-static',
    title: 'Traversée de chemin dans le service de fichiers statiques', component: 'serve-static (page de statut publique)',
    cvss: 'Moyenne', epss: 13, kev: false, poc: false, reach: 'oui', exposure: 'Internet', asset: 'Standard',
    explain: 'EPSS de 13 %, au-dessus du seuil, sur une page publique : règle 3, Attend. L’actif est « standard », et la grille ne regarde l’actif que dans la règle 4.',
    age: 0, effort: 0.5,
  },
  {
    id: 's39-aws-sdk', level: 2, queue: 'sprint-39', short: 'aws-sdk v2',
    title: 'Pollution de prototype au chargement de la configuration partagée', component: 'aws-sdk v2 (scripts de déploiement)',
    cvss: 'Moyenne', epss: 0.3, kev: false, poc: true, reach: 'oui', exposure: 'Interne', asset: 'Standard',
    explain: 'Preuve de concept, composant interne : Track*. Rien d’inquiétant en apparence, sauf l’ancienneté : ouvert depuis vingt-cinq jours, il lui en reste cinq.',
    age: 25, effort: 0.5,
  },
  {
    id: 's39-tar', level: 3, queue: 'sprint-39', short: 'tar',
    title: 'Écriture hors du répertoire de destination à l’extraction d’une archive', component: 'tar (réception des archives de justificatifs)',
    cvss: 'Haute', epss: 15, kev: false, poc: true, reach: 'non', reachShown: 'non, selon l’équipe', exposure: 'Interne', asset: 'Critique',
    note: 'Proposition de VEX : le service ne fait que lister le contenu des archives avant de les transmettre à l’antivirus ; une règle Semgrep interdit toute fonction d’extraction de tar dans le dépôt.',
    explain: 'Le défaut ne se déclenche qu’en écrivant des fichiers, à l’extraction ; lister une archive n’écrit rien. La justification est précise, vérifiable, et un contrôle en CI la maintient : le VEX tient malgré l’EPSS de 15 %.',
    age: 3, effort: 0.5,
  },
  {
    id: 's39-ua-parser', level: 2, queue: 'sprint-39', short: 'ua-parser-js',
    title: 'Déni de service par expression régulière sur un User-Agent', component: 'ua-parser-js (journalisation des accès)',
    cvss: 'Moyenne', epss: 0.5, kev: false, poc: false, reach: 'oui', exposure: 'Internet', asset: 'Standard',
    explain: 'Exposé, mais gravité moyenne, actif standard et aucun signal : Track. Le budget du sprint ne lui doit rien.',
    age: 6, effort: 0.5,
  },
  {
    id: 's39-tf-provider', level: 2, queue: 'sprint-39', short: 'provider Terraform',
    title: 'Valeurs sensibles écrites dans les journaux en mode debug', component: 'provider Terraform AWS (pipeline d’infrastructure)',
    cvss: 'Moyenne', epss: 0.2, kev: false, poc: true, reach: 'oui', exposure: 'Interne', asset: 'Critique',
    explain: 'Preuve de concept, composant interne : Track*. Ouvert depuis trois jours, il a encore vingt-sept jours devant lui.',
    age: 3, effort: 1,
  },
];

// ── Le budget de sprint (files N3) ──────────────────────────────────────────

export interface SprintPlan { text: string; right: boolean; why: string }
export interface Sprint { budget: number; plans: SprintPlan[] }

/**
 * Une fois la file triée, on répartit le budget. L'ordre de remplissage est
 * celui de la leçon : ce dont l'échéance tombe avant le sprint suivant (Act,
 * Attend, et les Track* déjà anciens), puis les clôtures VEX, puis le reste
 * des Track*. Track n'a pas de budget : la mise à jour suit le cycle normal.
 */
export const sprints: Record<string, Sprint> = {
  'sprint-38': {
    budget: 4.5,
    plans: [
      { text: 'xml-crypto, libxmljs2, send et busboy (4 j), plus le VEX de React2Shell (0,5 j). pdfkit et handlebars au sprint suivant.', right: true,
        why: 'Les trois Attend échoient dans la semaine ; busboy, ouvert depuis vingt jours, n’a plus que dix jours. Le VEX de React2Shell tient et ne coûte qu’une demi-journée. pdfkit et handlebars ont encore vingt-huit et trente jours : le sprint suivant les tient.' },
      { text: 'Par gravité : pdfkit et handlebars, les critiques (3 j), puis xml-crypto (1,5 j). libxmljs2, send et busboy au sprint suivant.', right: false,
        why: 'Le tri par CVSS repousse deux Attend, dont le délai de sept jours tombe avant la fin du sprint, et busboy, qui expire dans dix jours. pdfkit et handlebars, eux, pouvaient attendre.' },
      { text: 'send et busboy (1,5 j), puis les quatre VEX proposés par l’équipe : xml-crypto, React2Shell, libxmljs2 et handlebars (2 j).', right: false,
        why: 'Trois de ces quatre justifications ne tiennent pas : une règle WAF, une recherche qui ignore les dépendances transitives, une étiquette devDependencies. xml-crypto et libxmljs2 sont des Attend, et on les clôt au lieu de les corriger.' },
      { text: 'xml-crypto, libxmljs2 et send (3 j), handlebars (1 j) et le VEX de React2Shell (0,5 j). busboy au suivant : un Track* a trente jours.', right: false,
        why: 'Trente jours à partir de l’ouverture, pas d’aujourd’hui : busboy en a déjà consommé vingt, il échoit au milieu du sprint suivant. handlebars, tout juste ouvert, pouvait lui céder la place.' },
    ],
  },
  'sprint-39': {
    budget: 3.5,
    plans: [
      { text: 'git, serve-static, la Lambda d’export et aws-sdk (2,5 j), plus les VEX de tj-actions et de tar (1 j). Le provider Terraform au suivant.', right: true,
        why: 'Les deux Attend échoient dans la semaine, la Lambda dans dix jours et aws-sdk dans cinq. Les deux VEX tiennent et se ferment pour un jour. Le provider Terraform, ouvert il y a trois jours, a le temps d’attendre.' },
      { text: 'tj-actions en urgence : remplacer l’action et renouveler tous les secrets de CI (1,5 j), puis git, serve-static et la Lambda (2 j).', right: false,
        why: 'Le KEV affole, mais les workflows épinglés par SHA n’ont jamais exécuté le commit malveillant : un jour et demi dépensé contre un risque absent, pendant qu’aws-sdk dépasse son échéance dans cinq jours.' },
      { text: 'git, serve-static et aws-sdk (1,5 j), et les VEX proposés pour tj-actions, tar et la Lambda d’export (1,5 j).', right: false,
        why: 'Le VEX de la Lambda confond exposition et atteignabilité : les paramètres viennent du client, le code vulnérable s’exécute. On clôt un Track* qui échoit dans dix jours au lieu de le corriger.' },
      { text: 'Les actifs critiques d’abord : la Lambda, le provider Terraform et git (2,5 j), puis les deux VEX (1 j). serve-static et aws-sdk au suivant.', right: false,
        why: 'La criticité de l’actif ne sert qu’à la règle 4. serve-static est un Attend à sept jours et aws-sdk expire dans cinq : les repousser rate deux échéances, pour avancer un provider qui en avait vingt-sept.' },
    ],
  },
};

// ── Les séries ──────────────────────────────────────────────────────────────

const inQueue = (q: Queue) => (f: Finding) => f.queue === q;
const mix = (n1: number, n2: number, n3: number): [number, number, number] => [n1, n2, n3];

export const triageSeries = defineSeries(findings, [
  { id: 'front', title: 'Dépendances du front', filter: inQueue('front'), level: 1,
    text: 'Le scanner de l’espace client React. Un critère tranche chaque finding : on apprend l’ordre des règles.' },
  { id: 'images', title: 'Images de conteneur', filter: inQueue('images'), level: 1,
    text: 'Les paquets système des images. Le piège classique : un composant signalé qui n’est pas dans l’image livrée.' },
  { id: 'api', title: 'API de facturation', filter: inQueue('api'), level: 2,
    text: 'L’actif le plus exposé. CVSS critique mais code non atteignable, EPSS bas mais preuve de concept : les signaux se contredisent.' },
  { id: 'interne', title: 'Outils internes et workers', filter: inQueue('interne'), level: 2,
    text: 'KEV sur un service interne, back-office servi sur Internet, EPSS à 99 % sans KEV. « Interne » ne dit pas tout.' },
  { id: 'sprint-38', title: 'Sprint 38 : API et rendu', filter: inQueue('sprint-38'), level: 3,
    text: 'L’équipe propose des VEX ; à toi de dire lesquels tiennent. Puis 4,5 jours de budget à répartir selon les échéances.' },
  { id: 'sprint-39', title: 'Sprint 39 : CI et infrastructure', filter: inQueue('sprint-39'), level: 3,
    text: 'Actions GitHub, runners, Lambda. Un KEV qui ne touche pas, un VEX qui confond exposition et atteignabilité, 3,5 jours de budget.' },
  { id: 'melee', title: 'Mêlée', mix: mix(3, 3, 2), level: 2, shuffleEachTime: true,
    text: 'Toutes files confondues, recomposée à chaque partie, sans budget de sprint. La seule série qu’on ne peut pas réviser.' },
]);

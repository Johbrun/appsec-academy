import type { Level, Palette } from './catalog';

/**
 * Les jeux sont rangés par **geste du métier**, pas par module : le parcours
 * offre déjà l'axe « module », et 29 jeux en liste plate ne se choisissent pas.
 * Un apprenant sait dire « je veux m'entraîner à lire du code » bien avant de
 * savoir quel module il lui faut.
 */
export type GameCategoryId = 'fondamentaux' | 'reperer' | 'concevoir' | 'observer' | 'arbitrer' | 'crise';

export interface GameCategoryMeta {
  id: GameCategoryId;
  title: string;
  short: string;   // libellé court, pour la navigation
  text: string;
  palette: Palette;
  icon: string;
}

export const gameCategories: GameCategoryMeta[] = [
  { id: 'fondamentaux', title: 'Fondamentaux', short: 'Fondamentaux', palette: 'dawn', icon: 'Library',
    text: 'Les référentiels, le vocabulaire et la carte des données : ce qu’il faut avoir en tête avant de discuter avec qui que ce soit.' },
  { id: 'reperer', title: 'Repérer', short: 'Repérer', palette: 'ember', icon: 'Crosshair',
    text: 'Lire du code, un diff, un workflow ou un rapport d’outil, et trouver ce qui cloche — le geste le plus fréquent du métier.' },
  { id: 'concevoir', title: 'Concevoir', short: 'Concevoir', palette: 'iris', icon: 'PenTool',
    text: 'Choisir le contrôle qui élimine la classe entière, puis le défendre en revue devant ceux qui l’implémenteront.' },
  { id: 'observer', title: 'Observer', short: 'Observer', palette: 'cobalt', icon: 'GitBranch',
    text: 'Regarder ce qui se passe réellement sous l’application : protocoles, concurrence, analyseurs qui divergent, décisions IAM.' },
  { id: 'arbitrer', title: 'Arbitrer', short: 'Arbitrer', palette: 'gold', icon: 'ListChecks',
    text: 'Prioriser sous contrainte, chaîner des findings mineurs, et faire passer la décision sans braquer l’équipe.' },
  { id: 'crise', title: 'Détecter & répondre', short: 'Détecter', palette: 'aurora', icon: 'Radar',
    text: 'Voir l’attaque dans les journaux, écrire la règle qui l’attrape, et tenir la barre quand l’horloge tourne.' },
];

export interface GameMeta {
  id: string;
  title: string;
  text: string;
  category: GameCategoryId;
  level: Level;
  modules: string[];   // ids de modules ; vide = tous
  palette: Palette;
  icon: string;
  time: string;
  xp: number;          // XP maximale, accordée sur l'amélioration du record
  available: boolean;
}

export const games: GameMeta[] = [
  { id: 'flashcards', title: 'Flashcards espacées', text: 'Des paquets par thème du parcours, deux paquets transverses et la révision du jour : les cartes ratées reviennent plus souvent.', category: 'fondamentaux', level: 1, modules: [], palette: 'dawn', icon: 'Layers', time: '5 min', xp: 40, available: true },
  { id: 'referentiel', title: 'Quel référentiel ?', text: 'Huit séries, des intitulés qui portent le nom de leur liste jusqu’aux faux amis : range chaque risque dans le bon référentiel OWASP avant la fin du chrono.', category: 'fondamentaux', level: 1, modules: ['m01', 'm10', 'm19'], palette: 'moss', icon: 'Shapes', time: '4 min', xp: 50, available: true },
  { id: 'spot-the-sink', title: 'Spot the Sink', text: 'Dix séries, de la reconnaissance de motif à la revue de code : trouve la ligne vulnérable dans un vrai fichier, puis nomme sa CWE.', category: 'reperer', level: 1, modules: ['m02'], palette: 'ember', icon: 'Crosshair', time: '6 min', xp: 70, available: true },
  { id: 'patch-or-pwn', title: 'Patch or Pwn', text: 'Huit séries, de la prise en main aux contournements : quatre correctifs, un seul tient, et chaque mauvais choix montre comment il se contourne.', category: 'arbitrer', level: 2, modules: ['m02', 'm03', 'm09'], palette: 'crimson', icon: 'Swords', time: '8 min', xp: 90, available: true },
  { id: 'stepping-stones', title: 'Stepping Stones', text: 'Huit séries, de la chaîne évidente à l’arbitrage où le meilleur correctif n’est pas sur le maillon le plus grave : relie des findings « faibles », puis casse la chaîne.', category: 'arbitrer', level: 2, modules: ['m03', 'm05'], palette: 'iris', icon: 'Link', time: '8 min', xp: 90, available: true },
  { id: 'parser-wars', title: 'Parser Wars', text: 'Dix séries, de la divergence entre deux composants aux chaînes CDN, load balancer, Node et cache : où les lectures se séparent-elles, et quel réglage les réaccorde ?', category: 'observer', level: 3, modules: ['m03'], palette: 'ink', icon: 'GitBranch', time: '10 min', xp: 120, available: true },
  { id: 'race-window', title: 'Race Window', text: 'Neuf séries, du check-then-act évident aux limites distribuées : combien de requêtes concurrentes passent, et quel correctif tient à l’échelle ?', category: 'observer', level: 2, modules: ['m03'], palette: 'cobalt', icon: 'Timer', time: '7 min', xp: 90, available: true },
  { id: 'csp-builder', title: 'CSP Builder', text: 'Sept pages de Novafact, du site vitrine à l’éditeur sous Trusted Types : compose la CSP qui bloque les attaques sans casser les scripts utiles.', category: 'concevoir', level: 3, modules: ['m04'], palette: 'dawn', icon: 'ShieldCheck', time: '10 min', xp: 120, available: true },
  { id: 'triage-room', title: 'Triage Room', text: 'Six files de findings, du front aux runners de CI : la grille tranche d’abord seule, puis il faut juger les VEX de l’équipe et répartir un budget de sprint.', category: 'arbitrer', level: 2, modules: ['m05'], palette: 'gold', icon: 'ListChecks', time: '8 min', xp: 90, available: true },
  { id: 'pushback', title: 'Pushback', text: 'Neuf séries, par interlocuteur puis par difficulté : des objections bâties sur une idée fausse jusqu’à celles qui ont en partie raison, où la réponse la plus ferme est le piège.', category: 'arbitrer', level: 2, modules: ['m06'], palette: 'aurora', icon: 'Handshake', time: '8 min', xp: 90, available: true },
  { id: 'data-map', title: 'Data Map', text: 'Huit séries, de la donnée qui se classe à son nom à celle dont la classe tient à un détail : classe les données de Novafact et choisis le contrôle qui compte.', category: 'fondamentaux', level: 2, modules: ['m07'], palette: 'pearl', icon: 'Map', time: '8 min', xp: 90, available: true },
  { id: 'pattern-match', title: 'Pattern Match', text: 'Huit séries, de la définition presque mot pour mot aux cas où deux patterns se défendent : nomme le pattern ou l’anti-pattern de Kohnfelder qui décrit la situation.', category: 'concevoir', level: 2, modules: ['m08'], palette: 'iris', icon: 'Puzzle', time: '6 min', xp: 80, available: true },
  { id: 'design-review', title: 'Design Review Simulator', text: 'Huit design docs de Novafact, du lien de partage au SSO SAML : relis, puis défends tes constats face au designer, jusqu’aux documents où le défaut se cache entre deux phrases.', category: 'concevoir', level: 3, modules: ['m08'], palette: 'sand', icon: 'PenTool', time: '15 min', xp: 120, available: true },
  { id: 'oauth-debugger', title: 'OAuth Flow Debugger', text: 'Huit séries, du paramètre manquant à la revue d’architecture : sur un flux OAuth, OIDC ou SAML animé pas à pas, trouve l’étape faible et nomme l’attaque.', category: 'observer', level: 3, modules: ['m09'], palette: 'cobalt', icon: 'KeyRound', time: '10 min', xp: 120, available: true },
  { id: 'abuse-desk', title: 'Abuse Desk', text: 'Sept scénarios, de la page de connexion au SMS pumping : règle limites et contrôles face à un flux mêlant clients, bots et fraudeurs.', category: 'concevoir', level: 3, modules: ['m10'], palette: 'purple', icon: 'ShieldAlert', time: '12 min', xp: 120, available: true },
  { id: 'stride-cards', title: 'STRIDE Cards', text: 'Sept DFD de Novafact, de l’application web au SSO des grands comptes : pose chaque carte de menace sur le bon nœud ou le bon flux, puis nomme sa catégorie STRIDE.', category: 'concevoir', level: 2, modules: ['m11'], palette: 'dusk', icon: 'Waypoints', time: '10 min', xp: 90, available: true },
  { id: 'diff-review', title: 'Diff Review', text: 'Huit séries de PR affichées comme sur GitHub : du défaut net dans les lignes ajoutées à celui qui n’existe que par ce que la PR retire, jusqu’à la PR qu’il faut approuver.', category: 'reperer', level: 2, modules: ['m12'], palette: 'moss', icon: 'FileCode', time: '10 min', xp: 100, available: true },
  { id: 'right-tool', title: 'Right Tool, Right Stage', text: 'Neuf séries, des outils dont la description dit le moment jusqu’aux contre-emplois : place chaque outil sur la bonne étape du pipeline.', category: 'fondamentaux', level: 1, modules: ['m13'], palette: 'ocean', icon: 'Workflow', time: '5 min', xp: 50, available: true },
  { id: 'true-false-positive', title: 'True or False Positive', text: 'Huit séries, du premier tri au sanitizer appliqué au mauvais contexte : des findings SAST, secrets et IA avec leur trace, vrai ou faux positif ?', category: 'reperer', level: 3, modules: ['m13'], palette: 'ocean', icon: 'ScanSearch', time: '10 min', xp: 120, available: true },
  { id: 'workflow-audit', title: 'Workflow Audit', text: 'Sept séries de workflows GitHub Actions : repère les lignes dangereuses et leur risque OWASP CI/CD, sans signaler les bonnes pratiques qui les entourent.', category: 'reperer', level: 2, modules: ['m14'], palette: 'glacier', icon: 'GitBranch', time: '8 min', xp: 90, available: true },
  { id: 'supply-chain', title: 'Supply Chain Kill Chain', text: 'Sept séries d’incidents réels, des registres npm et PyPI au build de l’éditeur : remets la chaîne dans l’ordre et place le contrôle qui l’aurait cassée.', category: 'arbitrer', level: 2, modules: ['m14'], palette: 'glacier', icon: 'Link', time: '8 min', xp: 90, available: true },
  { id: 'allow-deny', title: 'Allow or Deny ?', text: 'Neuf séries, d’une politique d’identité isolée à l’évaluation cross-account : prédis la décision d’AWS et l’étape qui tranche.', category: 'observer', level: 2, modules: ['m15'], palette: 'ink', icon: 'Fingerprint', time: '8 min', xp: 90, available: true },
  { id: 'iam-pathfinder', title: 'IAM Privesc Pathfinder', text: 'Huit séries, du saut unique vers admin aux chaînes de trois sauts avec impasse leurre : trouve le chemin, puis coupe-le.', category: 'observer', level: 3, modules: ['m15'], palette: 'ink', icon: 'Waypoints', time: '12 min', xp: 120, available: true },
  { id: 'iac-hunt', title: 'IaC Misconfig Hunt', text: 'Sept séries de fichiers Terraform, CloudFormation ou CDK : du réglage qui se lit seul à l’attribut qui manque et à la condition qui ne protège rien.', category: 'reperer', level: 2, modules: ['m16'], palette: 'signal', icon: 'Blocks', time: '8 min', xp: 90, available: true },
  { id: 'log-detective', title: 'Log Detective AppSec', text: 'Huit séries, de la ligne qui signe l’attaque à la corrélation « low and slow » : sur des événements Elastic, identifie l’attaque et la technique ATT&CK.', category: 'crise', level: 2, modules: ['m18'], palette: 'aurora', icon: 'ScrollText', time: '8 min', xp: 90, available: true },
  { id: 'detection-builder', title: 'Detection Builder', text: 'Sept séries, du champ unique qui suffit à la règle à seuil qui corrèle plusieurs actions : assemble une règle et teste-la, précision et rappel.', category: 'crise', level: 3, modules: ['m18'], palette: 'aurora', icon: 'Radar', time: '12 min', xp: 120, available: true },
  { id: 'agent-blast-radius', title: 'Agent Blast Radius', text: 'Six agents IA, de l’assistant du support au poste MCP multi-serveurs : règle leurs outils pour couper la lethal trifecta sans casser les usages légitimes.', category: 'concevoir', level: 3, modules: ['m19'], palette: 'purple', icon: 'BrainCircuit', time: '12 min', xp: 120, available: true },
  { id: 'crise-j0', title: 'Crise J+0', text: 'Huit crises, de la clé AWS publiée par erreur à l’assistant IA détourné : chaque décision compte, sous horloge, et l’option radicale devient un piège.', category: 'crise', level: 3, modules: ['m04', 'm05', 'm14', 'm17'], palette: 'crimson', icon: 'Siren', time: '20 min', xp: 150, available: true },
  { id: 'red-blue', title: 'Red vs Blue : Novafact', text: 'Huit chaînes d’attaque, dont plusieurs calquées sur des incidents réels : analyse-les côté Red, puis défends Novafact avec un budget limité.', category: 'crise', level: 3, modules: ['m20'], palette: 'purple', icon: 'Swords', time: '20 min', xp: 150, available: true },
];

export const gameById = (id: string) => games.find((g) => g.id === id);
export const availableGames = games.filter((g) => g.available);
export const categoryById = (id: string) => gameCategories.find((c) => c.id === id);
export const gamesInCategory = (id: GameCategoryId) => games.filter((g) => g.category === id);

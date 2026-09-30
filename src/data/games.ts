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
  { id: 'flashcards', title: 'Flashcards espacées', text: 'Révise les notions clés en répétition espacée : les cartes ratées reviennent plus souvent.', category: 'fondamentaux', level: 1, modules: [], palette: 'dawn', icon: 'Layers', time: '5 min', xp: 40, available: true },
  { id: 'referentiel', title: 'Quel référentiel ?', text: 'Un risque apparaît : range-le dans le bon référentiel OWASP, avant la fin du chrono.', category: 'fondamentaux', level: 1, modules: ['m01'], palette: 'moss', icon: 'Shapes', time: '4 min', xp: 50, available: true },
  { id: 'spot-the-sink', title: 'Spot the Sink', text: 'Dix séries, de la reconnaissance de motif à la revue de code : trouve la ligne vulnérable dans un vrai fichier, puis nomme sa CWE.', category: 'reperer', level: 1, modules: ['m02'], palette: 'ember', icon: 'Crosshair', time: '6 min', xp: 70, available: true },
  { id: 'patch-or-pwn', title: 'Patch or Pwn', text: 'Quatre correctifs, un seul tient. Chaque mauvais choix montre comment il se contourne.', category: 'arbitrer', level: 2, modules: ['m02', 'm03', 'm09'], palette: 'crimson', icon: 'Swords', time: '8 min', xp: 90, available: true },
  { id: 'stepping-stones', title: 'Stepping Stones', text: 'Relie des findings « faibles » en une chaîne critique, puis casse-la avec un seul correctif.', category: 'arbitrer', level: 2, modules: ['m03', 'm05'], palette: 'iris', icon: 'Link', time: '8 min', xp: 90, available: true },
  { id: 'parser-wars', title: 'Parser Wars', text: 'Une requête traverse CDN, load balancer, Node et cache : où les lectures divergent-elles ?', category: 'observer', level: 3, modules: ['m03'], palette: 'ink', icon: 'GitBranch', time: '10 min', xp: 120, available: true },
  { id: 'race-window', title: 'Race Window', text: 'Des requêtes concurrentes sur un endpoint Express : combien passent, et quel correctif tient ?', category: 'observer', level: 2, modules: ['m03'], palette: 'cobalt', icon: 'Timer', time: '7 min', xp: 90, available: true },
  { id: 'csp-builder', title: 'CSP Builder', text: 'Compose la CSP de la page de paiement : bloque les attaques sans casser les scripts utiles.', category: 'concevoir', level: 3, modules: ['m04'], palette: 'dawn', icon: 'ShieldCheck', time: '10 min', xp: 120, available: true },
  { id: 'triage-room', title: 'Triage Room', text: 'Une file de findings, un budget de sprint : priorise selon l’exploitation, l’exposition et l’impact.', category: 'arbitrer', level: 2, modules: ['m05'], palette: 'gold', icon: 'ListChecks', time: '8 min', xp: 90, available: true },
  { id: 'pushback', title: 'Pushback', text: 'Réponds aux objections des devs, du produit et de la direction sans braquer personne.', category: 'arbitrer', level: 2, modules: ['m06'], palette: 'aurora', icon: 'Handshake', time: '8 min', xp: 90, available: true },
  { id: 'data-map', title: 'Data Map', text: 'Classe les données de Novafact et choisis les contrôles exigés pour chaque classe.', category: 'fondamentaux', level: 2, modules: ['m07'], palette: 'pearl', icon: 'Map', time: '8 min', xp: 90, available: true },
  { id: 'pattern-match', title: 'Pattern Match', text: 'Une situation de conception : nomme le pattern ou l’anti-pattern de Kohnfelder qui la décrit.', category: 'concevoir', level: 2, modules: ['m08'], palette: 'iris', icon: 'Puzzle', time: '6 min', xp: 80, available: true },
  { id: 'design-review', title: 'Design Review Simulator', text: 'Relis un design doc en six étapes et défends tes constats face au designer.', category: 'concevoir', level: 3, modules: ['m08'], palette: 'sand', icon: 'PenTool', time: '15 min', xp: 120, available: true },
  { id: 'oauth-debugger', title: 'OAuth Flow Debugger', text: 'Un flux OIDC ou SAML animé pas à pas : trouve l’étape faible et nomme l’attaque.', category: 'observer', level: 3, modules: ['m09'], palette: 'cobalt', icon: 'KeyRound', time: '10 min', xp: 120, available: true },
  { id: 'abuse-desk', title: 'Abuse Desk', text: 'Règle limites et contrôles face à un flux mêlant clients, bots et fraudeurs.', category: 'concevoir', level: 3, modules: ['m10'], palette: 'purple', icon: 'ShieldAlert', time: '12 min', xp: 120, available: true },
  { id: 'stride-cards', title: 'STRIDE Cards', text: 'Pose les cartes de menaces sur le DFD de Novafact, puis choisis les contre-mesures.', category: 'concevoir', level: 2, modules: ['m11'], palette: 'dusk', icon: 'Waypoints', time: '10 min', xp: 90, available: true },
  { id: 'diff-review', title: 'Diff Review', text: 'Une PR affichée comme sur GitHub : commente les lignes à risque et décide.', category: 'reperer', level: 2, modules: ['m12'], palette: 'moss', icon: 'FileCode', time: '10 min', xp: 100, available: true },
  { id: 'right-tool', title: 'Right Tool, Right Stage', text: 'Place chaque outil sur la bonne étape du pipeline.', category: 'fondamentaux', level: 1, modules: ['m13'], palette: 'ocean', icon: 'Workflow', time: '5 min', xp: 50, available: true },
  { id: 'true-false-positive', title: 'True or False Positive', text: 'Des findings SAST et IA avec leur trace : vrai ou faux positif ?', category: 'reperer', level: 3, modules: ['m13'], palette: 'ocean', icon: 'ScanSearch', time: '10 min', xp: 120, available: true },
  { id: 'workflow-audit', title: 'Workflow Audit', text: 'Un workflow GitHub Actions : repère les lignes dangereuses et le risque CI/CD associé.', category: 'reperer', level: 2, modules: ['m14'], palette: 'glacier', icon: 'GitBranch', time: '8 min', xp: 90, available: true },
  { id: 'supply-chain', title: 'Supply Chain Kill Chain', text: 'Remets un incident réel dans l’ordre et place le contrôle qui l’aurait cassé.', category: 'arbitrer', level: 2, modules: ['m14'], palette: 'glacier', icon: 'Link', time: '8 min', xp: 90, available: true },
  { id: 'allow-deny', title: 'Allow or Deny ?', text: 'Politiques IAM, SCP et boundary : prédis la décision et l’étape qui tranche.', category: 'observer', level: 2, modules: ['m15'], palette: 'ink', icon: 'Fingerprint', time: '8 min', xp: 90, available: true },
  { id: 'iam-pathfinder', title: 'IAM Privesc Pathfinder', text: 'Trouve le chemin vers admin dans un graphe de permissions, puis coupe-le.', category: 'observer', level: 3, modules: ['m15'], palette: 'ink', icon: 'Waypoints', time: '12 min', xp: 120, available: true },
  { id: 'iac-hunt', title: 'IaC Misconfig Hunt', text: 'Terraform ou CDK : repère les misconfigurations et la règle qui les attrape.', category: 'reperer', level: 2, modules: ['m16'], palette: 'signal', icon: 'Blocks', time: '8 min', xp: 90, available: true },
  { id: 'log-detective', title: 'Log Detective AppSec', text: 'Des événements Elastic : identifie l’attaque et la technique ATT&CK.', category: 'crise', level: 2, modules: ['m18'], palette: 'aurora', icon: 'ScrollText', time: '8 min', xp: 90, available: true },
  { id: 'detection-builder', title: 'Detection Builder', text: 'Assemble une règle et teste-la sur des événements : précision et rappel.', category: 'crise', level: 3, modules: ['m18'], palette: 'aurora', icon: 'Radar', time: '12 min', xp: 120, available: true },
  { id: 'agent-blast-radius', title: 'Agent Blast Radius', text: 'Configure les outils de l’assistant IA pour bloquer les injections sans casser les usages.', category: 'concevoir', level: 3, modules: ['m19'], palette: 'purple', icon: 'BrainCircuit', time: '12 min', xp: 120, available: true },
  { id: 'crise-j0', title: 'Crise J+0', text: 'Une vulnérabilité critique frappe Novafact : chaque décision compte, sous horloge.', category: 'crise', level: 3, modules: ['m04', 'm05', 'm14', 'm17'], palette: 'crimson', icon: 'Siren', time: '20 min', xp: 150, available: true },
  { id: 'red-blue', title: 'Red vs Blue : Novafact', text: 'Analyse une chaîne complète côté Red, puis défends Novafact avec un budget limité.', category: 'crise', level: 3, modules: ['m20'], palette: 'purple', icon: 'Swords', time: '20 min', xp: 150, available: true },
];

export const gameById = (id: string) => games.find((g) => g.id === id);
export const availableGames = games.filter((g) => g.available);
export const categoryById = (id: string) => gameCategories.find((c) => c.id === id);
export const gamesInCategory = (id: GameCategoryId) => games.filter((g) => g.category === id);

// Catalogue du parcours : blocs, modules et leçons. Source : PROGRAMME.md.
// Le contenu rédigé d'une leçon vit dans src/content/<module>/<leçon>.mdx ;
// une leçon sans fichier s'affiche « en rédaction ».

export type Palette =
  | 'ember' | 'iris' | 'signal' | 'glacier' | 'sand' | 'dusk' | 'moss' | 'cobalt'
  | 'ocean' | 'ink' | 'crimson' | 'purple' | 'gold' | 'pearl' | 'aurora' | 'dawn';

export type Level = 1 | 2 | 3;
export type Csslp = 'D1' | 'D2' | 'D3' | 'D4' | 'D5' | 'D6' | 'D7' | 'D8';
export type BlockId = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'Z';

export interface LessonMeta {
  id: string;        // "l03"
  title: string;
  level: Level;
  csslp: Csslp[];
  summary: string;
  k?: number[];      // chapitres de Designing Secure Software (Kohnfelder)
}

export interface ModuleMeta {
  id: string;        // "m02"
  num: number;
  block: BlockId;
  title: string;
  short: string;
  icon: string;
  palette: Palette;
  summary: string;
  lessons: LessonMeta[];
}

export interface BlockMeta {
  id: BlockId;
  title: string;
  text: string;
}

export const blocks: BlockMeta[] = [
  { id: 'A', title: 'Le métier', text: 'La menace et ATT&CK, ce qu’est l’AppSec, ses métiers, et la maturité d’une organisation.' },
  { id: 'B', title: 'Le web et ses vulnérabilités', text: 'Le fonctionnement du web et du navigateur, puis les vulnérabilités côté serveur, côté client et avancées.' },
  { id: 'C', title: 'Concevoir', text: 'Premières phases du cycle : analyse de risques, threat modeling, exigences, spécifications, identité et anti-abus.' },
  { id: 'D', title: 'Construire & vérifier', text: 'Revue de code, tests et analyse, pipeline et supply chain.' },
  { id: 'E', title: 'Déployer', text: 'IAM AWS, infrastructure as code, déploiement et résilience.' },
  { id: 'F', title: 'Security Operations', text: 'SOC et renseignement, journalisation, détection, réponse à incident et gestion des vulnérabilités.' },
  { id: 'G', title: 'Sécurité de l’IA', text: 'Un bloc vivant, mis à jour au fil de la veille : applications LLM, agents et MCP, autorisation OAuth de MCP.' },
  { id: 'H', title: 'Piloter', text: 'Faire adopter la sécurité et bâtir le programme : la synthèse de tous les blocs.' },
  { id: 'Z', title: 'Capstone', text: 'La revue de sécurité complète de Novafact, dans l’ordre du cycle.' },
];

const L = (id: string, title: string, level: Level, csslp: Csslp[], summary: string, k?: number[]): LessonMeta => ({ id, title, level, csslp, summary, k });

export const modules: ModuleMeta[] = [
  {
    id: 'm21', num: 1, block: 'A', title: 'Cybersécurité et panorama de la menace', short: 'Panorama', icon: 'Newspaper', palette: 'ember',
    summary: 'La cybersécurité en grand angle : qui attaque, comment, ce que disent les chiffres 2025-2026 et ce que la menace dit à l’AppSec.',
    lessons: [
      L('l01', 'La cybersécurité en un coup d’œil', 1, ['D1'], 'Les six fonctions du NIST CSF 2.0, les grands domaines du métier et la place de l’AppSec.'),
      L('l02', 'Qui attaque, et pourquoi', 1, ['D1'], 'Rançongiciel en service, courtiers d’accès, acteurs étatiques, hacktivistes et menaces internes.'),
      L('l03', 'Le panorama 2025-2026 en chiffres', 1, ['D1'], 'Ce que disent l’ANSSI, l’ENISA, le DBIR et M-Trends, et comment lire un rapport annuel.'),
      L('l04', 'Les portes d’entrée qui passent par l’application', 2, ['D1', 'D5'], 'Vulnérabilités exposées, identifiants volés, supply chain et SaaS : ce que la menace dit à l’AppSec.'),
      L('l05', 'Les affaires qui ont façonné le métier', 2, ['D1', 'D7'], 'Equifax, SolarWinds, Log4Shell, MOVEit et xz : ce que chacune a changé.'),
      L('l06', 'Pourquoi le logiciel reste vulnérable', 2, ['D2'], 'Économie de la sécurité, incitations mal alignées, Secure by Design, et une veille qui tient dans la semaine.'),
    ],
  },
  {
    id: 'm22', num: 2, block: 'A', title: 'MITRE ATT&CK et la menace SaaS', short: 'ATT&CK SaaS', icon: 'Grid3x3', palette: 'signal',
    summary: 'Le vocabulaire commun de l’attaque : tactiques et techniques, la matrice SaaS et identité, les mitigations et les cas réels.',
    lessons: [
      L('l01', 'ATT&CK : histoire et logique', 1, ['D4'], 'Tactiques, techniques, procédures, et ce qu’ont changé les versions 18 et 19.'),
      L('l02', 'Les quatre usages d’ATT&CK', 1, ['D4', 'D7'], 'Renseignement, détection, émulation et évaluation : un même vocabulaire pour quatre métiers.'),
      L('l03', 'La menace SaaS et identité', 2, ['D4'], 'Fatigue MFA, consentement OAuth, sessions rejouées, règles de boîte mail et partage externe.'),
      L('l04', 'Se protéger : les mitigations qui comptent', 2, ['D4', 'D7'], 'Les mesures qui couvrent le plus de techniques, et l’ordre dans lequel les déployer.'),
      L('l05', 'Cas réels décortiqués', 2, ['D7'], 'Uber, MGM, CircleCI, Snowflake, Midnight Blizzard et Storm-0558, étape par étape.'),
      L('l06', 'Du TTP à la classe de bug', 3, ['D4', 'D5'], 'Relier une technique ATT&CK aux CWE et CAPEC qui la rendent possible dans ton code.'),
    ],
  },
  {
    id: 'm01', num: 3, block: 'A', title: 'Présentation de l’AppSec', short: 'Présentation', icon: 'Compass', palette: 'sand',
    summary: 'Ce qu’est l’AppSec vue par un pentester : ses fondations (confiance, C-I-A), le cycle de développement sécurisé et les principes DevSecOps.',
    lessons: [
      L('l01', 'Du pentest à l’AppSec', 1, ['D2'], 'Changer d’échelle, penser en classes de bugs, choisir le bon référentiel.'),
      L('l02', 'La confiance', 1, ['D1'], 'Un spectre, des composants implicitement fiables, et moins de parties à qui se fier.', [1]),
      L('l03', 'C-I-A et Gold Standard', 1, ['D1'], 'Authentification, autorisation et audit appliqués à Novafact.', [1]),
      L('l04', 'Le SSDLC et la carte du parcours', 1, ['D2'], 'SDL, NIST SSDF et OWASP SAMM : les phases du cycle et comment le parcours les suit.'),
      L('l05', 'Principes DevSecOps', 1, ['D2'], 'Shift left et shift right, paved road, secure by default et safe coding.'),
    ],
  },
  {
    id: 'm23', num: 4, block: 'A', title: 'Les métiers de l’AppSec', short: 'Métiers', icon: 'Users', palette: 'aurora',
    summary: 'Qui fait quoi : les rôles de la sécurité applicative, l’organisation de l’équipe, les champions, le cadre juridique et la carrière.',
    lessons: [
      L('l01', 'Le rôle : une équipe qui rend capable', 1, ['D2'], 'De l’auditeur au partenaire des équipes produit.'),
      L('l02', 'Panorama des rôles', 1, ['D2'], 'AppSec et product security, architecte, DevSecOps, PSIRT, pentester, SOC : qui intervient où dans le cycle.'),
      L('l03', 'Organiser l’équipe', 2, ['D2'], 'Rattachement, structures, ratios réels de BSIMM16 et équipe qui rend capable.'),
      L('l04', 'Security Champions', 2, ['D2'], 'Recruter, animer, reconnaître et mesurer.'),
      L('l05', 'Travailler avec les autres fonctions', 2, ['D2'], 'SOC, DPO, juridique, achats et produit : les interfaces, et qui décide quoi.'),
      L('l06', 'Le cadre juridique du métier', 2, ['D2', 'D3'], 'Autorisation de tester, divulgation, signalement de bonne foi et responsabilité du produit.'),
      L('l07', 'Compétences, certifications et carrière', 1, ['D2'], 'Ce qui se transfère du pentest, ce qui s’apprend, et les certifications qui comptent.'),
    ],
  },
  {
    id: 'm24', num: 5, block: 'A', title: 'Maturité et posture de sécurité', short: 'Maturité', icon: 'Gauge', palette: 'gold',
    summary: 'Le diagnostic avant le plan : modèles de maturité, mesure de la posture applicative et état des lieux d’une organisation.',
    lessons: [
      L('l01', 'Maturité ou posture ?', 1, ['D2'], 'La capacité des processus et l’exposition à un instant : pourquoi chacune ment quand on la regarde seule.'),
      L('l02', 'OWASP SAMM v2', 2, ['D2'], 'Cinq fonctions, quinze pratiques : mesurer et piloter un programme.'),
      L('l03', 'BSIMM16 : se comparer', 2, ['D2'], 'Un modèle descriptif, bâti sur 111 organisations réelles.'),
      L('l04', 'Les autres modèles', 2, ['D2'], 'DSOMM, profils du CSF 2.0, SOC-CMM : choisir un modèle sans les collectionner.'),
      L('l05', 'Mesurer la posture applicative', 2, ['D2', 'D7'], 'Inventaire, surface d’attaque, ASPM, OpenSSF Scorecard et notations externes.'),
      L('l06', 'Un état des lieux en deux semaines', 3, ['D2'], 'Entretiens, échantillon de dépôts, preuves et restitution : le diagnostic qui ouvre le programme.'),
    ],
  },
  {
    id: 'm25', num: 6, block: 'B', title: 'Le web et ses protections', short: 'Rappels web', icon: 'Network', palette: 'glacier',
    summary: 'Les rappels qui servent tout le bloc : de l’URL au pixel, HTTP, origines, TLS, modèle de sécurité du navigateur, cookies et en-têtes.',
    lessons: [
      L('l01', 'De l’URL au pixel', 1, ['D1', 'D5'], 'Ce qui se passe entre la frappe d’une URL et l’affichage de la page, et la protection à chaque étape.'),
      L('l02', 'HTTP de bout en bout', 1, ['D5'], 'HTTP/1.1, 2 et 3, la chaîne CDN, répartiteur et application, et qui interprète quoi.'),
      L('l03', 'URL, origine, site et DNS', 1, ['D5'], 'Deux parseurs d’URL, l’origine et le site, la liste des suffixes publics et la résolution DNS.'),
      L('l04', 'TLS et certificats en pratique', 2, ['D1', 'D5'], 'Vérification du nom, confidentialité persistante, CAA et Certificate Transparency, et le cas DigiNotar.', [5, 11]),
      L('l05', 'Le modèle de sécurité du navigateur', 1, ['D5'], 'Same-origin policy, lire ou envoyer, CORS comme assouplissement et isolation des sites.'),
      L('l06', 'Cookies et état', 2, ['D5'], 'Attributs, SameSite, préfixes __Host-, partitionnement et stockage côté client.'),
      L('l07', 'La carte des en-têtes de sécurité', 2, ['D5', 'D7'], 'HSTS, CSP, frame-ancestors, COOP et les autres : ce que chacun ferme.'),
      L('l08', 'Top 10 2025, API Top 10 et CWE Top 25', 1, ['D5'], 'Ce qui a changé en 2025 et comment se servir de chaque liste.'),
    ],
  },
  {
    id: 'm02', num: 7, block: 'B', title: 'Vulnérabilités côté serveur', short: 'Côté serveur', icon: 'Bug', palette: 'ember',
    summary: 'Express, Node.js et Next.js vus du côté défenseur : cause racine, et contrôle qui élimine la classe.',
    lessons: [
      L('l01', 'Entrées non fiables dans Express', 1, ['D5'], 'Injections SQL et NoSQL, mass assignment, BOLA et validation par schéma.', [10]),
      L('l02', 'Footguns JavaScript et argent', 1, ['D5'], 'Les pièges du langage et des nombres dans une application de facturation.', [8, 9]),
      L('l03', 'Spécificités Node.js', 2, ['D5'], 'Prototype pollution, ReDoS, chemins, SSRF, sous-processus et modèle de menaces de Node.'),
      L('l04', 'Erreurs, exceptions et atomicité', 2, ['D5'], 'Échouer de façon sûre, TOCTOU, comparaisons à temps constant et sérialisation.', [8, 13]),
      L('l05', 'XML, DTD et XXE', 2, ['D5'], 'Entités externes, expansion d’entités et parseurs XML sûrs dans Node.', [10]),
      L('l06', 'HTML côté serveur, XSS et jetons CSRF', 2, ['D4', 'D5'], 'Contexte de sortie, moteurs de templates, jetons liés à la session et secrets dans l’URL.', [11]),
      L('l07', 'Fichiers : upload, téléchargement et chemins', 2, ['D5'], 'Type réel, stockage isolé, noms de fichiers et traversée de chemin.'),
      L('l08', 'Next.js, RSC et Server Actions', 3, ['D5'], 'Des endpoints publics qui ne se voient pas, et trois CVE récentes à connaître.'),
      L('l09', 'Éliminer une classe entière', 3, ['D5'], 'Wrappers sûrs, règles de lint et paved roads plutôt que correctifs au cas par cas.'),
    ],
  },
  {
    id: 'm04', num: 8, block: 'B', title: 'Vulnérabilités côté client & scripts tiers', short: 'Côté client', icon: 'Globe', palette: 'dawn',
    summary: 'Le navigateur exécute ton code et celui des autres : sinks React, CSP, Trusted Types, isolation et exigences PCI sur la page de paiement.',
    lessons: [
      L('l01', 'Le client n’est pas sous ton contrôle', 1, ['D5'], 'Validation côté client, secrets dans le bundle et source maps.'),
      L('l02', 'React et le navigateur', 2, ['D4', 'D5'], 'Sinks XSS de React, jetons, CSRF, CORS et postMessage.', [11]),
      L('l03', 'Scripts tiers', 1, ['D4', 'D8'], 'Un script tiers a les droits de ton code : Magecart et polyfill.io.', [4]),
      L('l04', 'Réduire la confiance', 2, ['D4', 'D5'], 'Inventaire, auto-hébergement, SRI, iframes en sandbox.'),
      L('l05', 'CSP stricte en pratique', 2, ['D5', 'D7'], 'Nonces, strict-dynamic, report-only puis blocage, et rapports utiles.'),
      L('l06', 'Trusted Types et Sanitizer API', 2, ['D5'], 'Des défenses DOM qui ferment les sinks par construction.'),
      L('l07', 'Isolation d’origine', 2, ['D5'], 'Fetch Metadata, COOP/COEP/CORP, cookies et service workers.'),
      L('l08', 'PCI DSS 4.0.1 : 6.4.3 et 11.6.1', 3, ['D3', 'D7'], 'Inventaire et intégrité des scripts de la page de paiement.'),
      L('l09', 'Surveiller le client', 3, ['D7', 'D8'], 'Détecter un changement de script et réagir à un skimmer.'),
    ],
  },
  {
    id: 'm03', num: 9, block: 'B', title: 'Web avancé : le programme PortSwigger', short: 'Web avancé', icon: 'Microscope', palette: 'crimson',
    summary: 'Les sujets avancés de la Web Security Academy et la recherche 2023-2026, relus avec l’angle architecture et défense.',
    lessons: [
      L('l01', 'Race conditions', 2, ['D5'], 'Pourquoi un await suffit, et les contraintes qui garantissent l’atomicité.'),
      L('l02', 'En-tête Host', 2, ['D5'], 'D’où vient l’URL absolue de l’application, et pourquoi pas de la requête.'),
      L('l03', 'API avancée et GraphQL', 2, ['D5'], 'Appels internes, pollution de paramètres, batching et coût des requêtes.'),
      L('l04', 'Chaînes de vulnérabilités', 2, ['D5', 'D6'], 'Des bugs mineurs qui, ensemble, deviennent critiques.', [8]),
      L('l05', 'Request smuggling et désynchronisation', 3, ['D5', 'D7'], 'Quand deux composants ne s’accordent pas sur la fin d’une requête.'),
      L('l06', 'Cache poisoning et cache deception', 3, ['D5', 'D7'], 'Qui définit la clé de cache, et ce qu’on accepte d’y mettre.'),
      L('l07', 'Parser differentials et fuites via l’ORM', 3, ['D5'], 'Deux lectures d’une même donnée, et des filtres trop généreux.'),
      L('l08', 'SSTI et injection de code', 3, ['D5'], 'Templates avec logique, bacs à sable JS et isolation réelle.'),
      L('l09', 'Désérialisation et prototype pollution avancées', 3, ['D5'], 'Formats qui reconstruisent des objets et gadgets côté serveur.'),
      L('l10', 'Protocoles d’authentification avancés', 3, ['D5'], 'JWT, OAuth et SAML : qui décide de ce qui est vérifié.'),
      L('l11', 'SSRF avancée', 3, ['D5', 'D7'], 'Redirections, résolution DNS et proxy de sortie.'),
      L('l12', 'Client avancé : DOM, CSP et XS-Leaks', 3, ['D5'], 'Ce qui reste exploitable côté navigateur, et comment le réduire.'),
      L('l13', 'Web LLM attacks et recherche assistée par IA', 3, ['D5'], 'Le sujet LLM de l’Academy et l’IA qui invente des variantes.'),
    ],
  },
  {
    id: 'm26', num: 10, block: 'C', title: 'Analyse de risques', short: 'Risques', icon: 'Scale', palette: 'crimson',
    summary: 'Avant de modéliser les menaces : partir du métier, évaluer, quantifier, traiter et accepter le risque au bon niveau.',
    lessons: [
      L('l01', 'Le vocabulaire du risque', 1, ['D2', 'D3'], 'Menace, vulnérabilité, vraisemblance, impact, risque résiduel, et pourquoi CVSS mesure une sévérité.'),
      L('l02', 'EBIOS Risk Manager appliqué à Novafact', 2, ['D2', 'D3'], 'Partir des valeurs métier et des événements redoutés, jusqu’aux scénarios et au plan de traitement.'),
      L('l03', 'Noter sans se mentir', 2, ['D2'], 'OWASP Risk Rating, les biais des matrices de risque et l’abandon de DREAD.'),
      L('l04', 'Quantifier avec FAIR', 3, ['D2'], 'Fréquence et ampleur des pertes, distributions et simulation : un risque en euros.'),
      L('l05', 'Traiter le risque et tenir le registre', 2, ['D2', 'D7'], 'Réduire, transférer, éviter ou accepter, et un registre qui vit.'),
      L('l06', 'Risque et acceptation', 3, ['D2', 'D7'], 'Risque technique contre risque métier, et un sign-off au bon niveau.'),
    ],
  },
  {
    id: 'm11', num: 11, block: 'C', title: 'Threat modeling & MITRE', short: 'Threat modeling', icon: 'Waypoints', palette: 'dusk',
    summary: 'Les 4 questions, STRIDE, méthodes, ATT&CK, CAPEC et D3FEND, et le threat modeling au rythme agile.',
    lessons: [
      L('l01', 'Les 4 questions et la démarche', 1, ['D4'], 'Actifs, surfaces, frontières de confiance, menaces et mitigations.', [2]),
      L('l02', 'STRIDE par élément', 1, ['D4'], 'La propriété violée par chaque menace.', [2]),
      L('l03', 'Choisir sa méthode', 2, ['D4'], 'Arbres d’attaque, PASTA, hybrides et LINDDUN.'),
      L('l04', 'MITRE pour l’AppSec', 2, ['D4'], 'ATT&CK, CAPEC, D3FEND et la chaîne CWE → CAPEC → ATT&CK.'),
      L('l05', 'Threat modeling agile et as code', 2, ['D4'], 'Incrémental, dans la PR, avec Threat Composer ou Threat Dragon.'),
      L('l06', 'Modéliser l’IA, la supply chain et le dev', 3, ['D4', 'D8'], 'Des systèmes où le code source est l’actif principal.', [13]),
    ],
  },
  {
    id: 'm07', num: 12, block: 'C', title: 'Exigences, vie privée & conformité', short: 'Exigences', icon: 'ClipboardList', palette: 'pearl',
    summary: 'Exigences et abuse cases, traçabilité, classification des données, RGPD, conformité et provisionnement des accès.',
    lessons: [
      L('l01', 'Exigences et abuse cases', 1, ['D3'], 'Tirer ses exigences d’ASVS 5.0 et écrire des cas d’abus.'),
      L('l02', 'Matrice de traçabilité', 2, ['D3', 'D6'], 'De l’exigence à la preuve, dans le dépôt.'),
      L('l03', 'Classification des données', 2, ['D3'], 'Propriétaire, sensibilité, cycle de vie.'),
      L('l04', 'Vie privée et RGPD', 2, ['D3'], 'Minimisation, droits des personnes, rétention et transferts.', [1, 6]),
      L('l05', 'Conformité : NIS2, CRA, PCI DSS', 2, ['D3', 'D8'], 'Ce que chaque texte impose au code et au produit.'),
      L('l06', 'Provisionnement des accès', 3, ['D3'], 'Comptes, comptes de service, recertification et départs.'),
    ],
  },
  {
    id: 'm08', num: 13, block: 'C', title: 'Spécifier et concevoir', short: 'Conception', icon: 'PenTool', palette: 'iris',
    summary: 'De la spécification fonctionnelle à la spécification technique : patterns de Kohnfelder, architecture, crypto, design doc et revue de conception.',
    lessons: [
      L('l01', 'La spécification fonctionnelle de sécurité', 1, ['D3', 'D4'], 'User stories, critères d’acceptation testables, matrice des droits et parcours sensibles, écrits avec le produit.'),
      L('l02', 'Mitigations structurelles', 1, ['D1', 'D4'], 'Surface, fenêtre de vulnérabilité et exposition des données.', [3]),
      L('l03', 'Les 14 patterns', 1, ['D1'], 'Cinq familles de patterns de conception sécurisée.', [4]),
      L('l04', 'Les 4 anti-patterns', 1, ['D4'], 'Confused deputy, backflow of trust, third-party hooks, composants non patchables.', [4]),
      L('l05', 'Patterns d’architecture', 3, ['D4', 'D5'], 'Gateway, BFF, services, upload isolé et tokenisation.'),
      L('l06', 'Conception d’interfaces', 3, ['D4'], 'Interfaces d’administration, de logs et entre services.'),
      L('l07', 'Crypto pour développeurs', 2, ['D1', 'D5'], 'CSPRNG, MAC, signatures, KMS et agilité cryptographique.', [5]),
      L('l08', 'Crypto : hash, nonces et métadonnées', 2, ['D1', 'D5'], 'Ce qu’un hash ne prouve pas, ce que fuit un nonce réutilisé, RSA brut et ce que le chiffrement laisse voir.', [5]),
      L('l09', 'La spécification technique : le design doc', 2, ['D2', 'D4'], 'Hypothèses, périmètre, interfaces et données : le comment, relié à chaque exigence.', [6]),
      L('l10', 'Mener une Security Design Review', 2, ['D4'], 'Six étapes et une priorisation Must / Ought / Should.', [7]),
    ],
  },
  {
    id: 'm09', num: 14, block: 'C', title: 'Identité : authentification, autorisation, OAuth & SAML', short: 'Identité', icon: 'KeyRound', palette: 'cobalt',
    summary: 'Authentification et autorisation applicatives, OAuth 2.1, RFC 10017 pour les SPA, validation des JWT, attaques, RFC 9700 et SAML.',
    lessons: [
      L('l01', 'Authentification applicative', 2, ['D1', 'D5'], 'Sessions, argon2id, passkeys et flux de réinitialisation.'),
      L('l02', 'Autorisation et multi-tenant', 2, ['D5'], 'RBAC, ABAC, ReBAC, moteurs de politiques et isolation des tenants.'),
      L('l03', 'OAuth 2.1 et Authorization Code + PKCE', 1, ['D1'], 'Ce qui est mort, et le flux à connaître par cœur.'),
      L('l04', 'SPA : RFC 10017 et BFF', 2, ['D5'], 'Garder les jetons hors du navigateur.'),
      L('l05', 'Valider un JWT dans Express', 2, ['D5'], 'Algorithme, émetteur, audience, expiration et JWKS.'),
      L('l06', 'Attaques OAuth et OIDC', 2, ['D5'], 'Redirections, mix-up, CSRF de connexion et consentement abusif.'),
      L('l07', 'RFC 9700, DPoP, PAR et FAPI', 3, ['D5'], 'L’état de l’art et les jetons liés à l’émetteur.'),
      L('l08', 'SAML en entreprise', 3, ['D4'], 'Signature, parsers XML et choix d’une librairie Node.'),
    ],
  },
  {
    id: 'm10', num: 15, block: 'C', title: 'Anti-abus, ATO & fraude', short: 'Anti-abus', icon: 'ShieldAlert', palette: 'purple',
    summary: 'Tout ce qui est fonctionnellement correct mais utilisé contre toi : bots, credential stuffing, abus de fonctionnalités et fraude.',
    lessons: [
      L('l01', 'Taxonomie des menaces automatisées', 1, ['D3', 'D4'], 'OWASP OAT et API6:2023.'),
      L('l02', 'Credential stuffing et prise de contrôle', 1, ['D5'], 'Signaux et défense en couches.'),
      L('l03', 'Limitation de débit bien conçue', 2, ['D4', 'D5'], 'Quoi limiter, comment, et sans créer un DoS.'),
      L('l04', 'Bots et Fraud Control', 2, ['D7'], 'CAPTCHA, Turnstile et AWS WAF Bot Control.'),
      L('l05', 'Abus de fonctionnalités', 2, ['D3', 'D4'], 'L’envoi de factures détourné pour du phishing.'),
      L('l06', 'Invariants métier', 2, ['D4', 'D5'], 'Montants, états, avoirs et idempotence.'),
      L('l07', 'Détecter et répondre à la fraude', 3, ['D7'], 'Signaux, score de risque et authentification adaptative.'),
    ],
  },
  {
    id: 'm12', num: 16, block: 'D', title: 'Revue de code sécurité', short: 'Revue de code', icon: 'FileCode', palette: 'moss',
    summary: 'Le geste le plus fréquent du métier : méthode, revue de PR, lecture de correctifs et code généré par IA.',
    lessons: [
      L('l01', 'Pourquoi et quand relire', 1, ['D5'], 'Ce que la revue trouve et que les outils ratent.', [13]),
      L('l02', 'Méthode sur une base inconnue', 1, ['D5'], 'Cartographier, lister sources et sinks, suivre les flux.'),
      L('l03', 'Revoir une PR en 10 minutes', 1, ['D5'], 'Repérer les changements sensibles et commenter utilement.'),
      L('l04', 'Lire des correctifs de CVE', 2, ['D5'], 'Cause racine et recherche de variantes.'),
      L('l05', 'Revue orientée autorisation', 2, ['D5'], 'La BOLA ne se voit pas au scanner.'),
      L('l06', 'Revoir du code généré par IA', 2, ['D5'], 'Erreurs typiques et gestion du volume.'),
      L('l07', 'Audit ciblé et limité dans le temps', 3, ['D5', 'D6'], 'Prioriser sur un gros dépôt et capitaliser.'),
    ],
  },
  {
    id: 'm13', num: 17, block: 'D', title: 'Tests & analyse de code', short: 'Tests & analyse', icon: 'ScanSearch', palette: 'ocean',
    summary: 'Stratégie de test, tests écrits par les devs, SAST, fuzzing, SCA, SBOM, DAST et IA.',
    lessons: [
      L('l01', 'Stratégie de test de sécurité', 1, ['D6'], 'WSTG, OSSTMM et place de chaque technique.'),
      L('l02', 'Tests de sécurité écrits par les devs', 1, ['D6'], 'Tester qu’un contrôle refuse, et les tests de régression.', [12]),
      L('l03', 'SAST pour JavaScript', 1, ['D5'], 'Semgrep, CodeQL, ESLint et TypeScript strict.'),
      L('l04', 'Écrire ses règles', 2, ['D5'], 'Taint mode, models as data et variant analysis.'),
      L('l05', 'Fuzzing et tests de disponibilité', 2, ['D6'], 'Jazzer.js, fast-check, k6 et injection de fautes.', [12]),
      L('l06', 'SCA et SBOM', 2, ['D5', 'D8'], 'Atteignabilité, paquets malveillants, CycloneDX et VEX.'),
      L('l07', 'DAST et secrets', 2, ['D6'], 'ZAP, Nuclei et détection de secrets.'),
      L('l08', 'Données de test', 2, ['D6'], 'Ne pas copier la production.'),
      L('l09', 'Inspecter du code malveillant', 3, ['D5', 'D8'], 'Backdoors, bombes logiques et le cas xz utils.', [12]),
      L('l10', 'L’IA dans l’analyse de code', 3, ['D5', 'D6'], 'Revue par LLM, agents de pentest et leurs limites.'),
      L('l11', 'Bâtir la plateforme', 3, ['D6'], 'Orchestration, dédoublonnage et critères de blocage.'),
      L('l12', 'Tests de limites, de ressources et de fuites', 2, ['D6'], 'Extrapoler un coût non linéaire, tester sous contrainte, alerter avant la limite et chercher une fuite par sentinelle.', [12]),
    ],
  },
  {
    id: 'm14', num: 18, block: 'D', title: 'Pipeline, supply chain & fournisseurs', short: 'Supply chain', icon: 'Workflow', palette: 'glacier',
    summary: 'Top 10 CI/CD, GitHub Actions, npm, SLSA, Sigstore, fournisseurs et réponse aux incidents supply chain.',
    lessons: [
      L('l01', 'OWASP Top 10 CI/CD', 1, ['D7', 'D8'], 'Les dix risques appliqués à GitHub Actions.'),
      L('l02', 'Durcir GitHub Actions', 1, ['D7', 'D8'], 'Permissions, déclencheurs, injection, OIDC et épinglage.'),
      L('l03', 'Sécuriser l’environnement de dev', 1, ['D8'], 'Le poste du dev et le runner CI sont des cibles.', [13]),
      L('l04', 'Outils du pipeline', 2, ['D8'], 'zizmor, actionlint, harden-runner et Scorecard.'),
      L('l05', 'npm : installer et publier', 2, ['D8'], 'Lockfile, scripts, trusted publishing et staged publishing.'),
      L('l06', 'Choisir un composant', 2, ['D5', 'D8'], 'Maintenance, historique, surface et licences.', [13]),
      L('l07', 'Vérifier qu’un paquet n’est pas vérolé', 2, ['D8'], 'Pourquoi auditer l’archive publiée et pas le dépôt GitHub, et les étapes du tarball au verdict.', [13]),
      L('l08', 'Cas réels de supply chain', 2, ['D8'], 'De event-stream à Shai-Hulud.'),
      L('l09', 'Fournisseurs et tiers', 2, ['D8'], 'Évaluer, contractualiser et intégrer au SIEM.'),
      L('l10', 'SLSA, Sigstore et provenance', 3, ['D7', 'D8'], 'Build track, source track et attestations.'),
      L('l11', 'Répondre à un incident supply chain', 3, ['D7', 'D8'], 'Versions touchées, rotation des secrets et nettoyage.'),
    ],
  },
  {
    id: 'm15', num: 19, block: 'E', title: 'IAM AWS', short: 'IAM AWS', icon: 'Fingerprint', palette: 'ink',
    summary: 'Logique d’évaluation, rôles et identifiants temporaires, workloads Node, escalade, moindre privilège et data perimeter.',
    lessons: [
      L('l01', 'Le modèle IAM et la logique d’évaluation', 1, ['D1', 'D7'], 'Politiques, deny explicite et clés de condition.'),
      L('l02', 'Zéro utilisateur IAM', 1, ['D7'], 'Identity Center, rôles, STS et compte root.'),
      L('l03', 'Workloads Node.js', 2, ['D7'], 'Lambda, ECS, EKS, IMDSv2 et le SDK v3.'),
      L('l04', 'Escalade et abus', 2, ['D7'], 'PassRole, trust policies, confused deputy et OIDC GitHub.'),
      L('l05', 'Moindre privilège en pratique', 2, ['D7'], 'Access Analyzer, iamlive et last accessed.'),
      L('l06', 'Multi-comptes et data perimeter', 3, ['D4', 'D7'], 'Organizations, SCP, RCP et périmètres.'),
    ],
  },
  {
    id: 'm16', num: 20, block: 'E', title: 'Infrastructure as Code', short: 'IaC', icon: 'Blocks', palette: 'signal',
    summary: 'Terraform, CDK TypeScript et CloudFormation : scanners, policy as code, state et dérive.',
    lessons: [
      L('l01', 'L’IaC comme surface', 1, ['D7'], 'Misconfigurations, secrets dans le state et dérive.'),
      L('l02', 'Scanners IaC', 1, ['D7'], 'Checkov, Trivy, KICS et cdk-nag.'),
      L('l03', 'Policy as code', 2, ['D7'], 'OPA, Conftest et stratégie d’exceptions.'),
      L('l04', 'State, pipeline et supply chain IaC', 2, ['D7', 'D8'], 'Backend, rôles plan/apply et épinglage.'),
      L('l05', 'Dérive et runtime', 3, ['D7'], 'CSPM, AWS Config, préventif et détectif.'),
    ],
  },
  {
    id: 'm17', num: 21, block: 'E', title: 'Déploiement, exploitation & résilience', short: 'Déploiement', icon: 'Rocket', palette: 'ember',
    summary: 'Configuration de production, conteneurs, publication, AWS, en-têtes, continuité, fin de vie et protection à l’exécution.',
    lessons: [
      L('l01', 'Configuration de production', 1, ['D7'], 'Secrets, erreurs, helmet, en-têtes et cookies.'),
      L('l02', 'Conteneurs Node.js', 1, ['D7'], 'Images minimales, utilisateur non root et scan.'),
      L('l03', 'Publier en sécurité', 2, ['D7'], 'Signature, admission, changements et mise en production.'),
      L('l04', 'Plateformes AWS', 2, ['D7'], 'ECS, Lambda, EKS, CloudFront et WAF.'),
      L('l05', 'En-têtes en production', 2, ['D7'], 'Appliquer et vérifier la politique conçue en M8.'),
      L('l06', 'Résilience et continuité', 2, ['D7'], 'Sauvegardes immuables, reprise et ransomware cloud.'),
      L('l07', 'Fin de vie', 2, ['D2', 'D7'], 'Décommissionner un service et disposer des données.', [4]),
      L('l08', 'Protection à l’exécution', 3, ['D7'], 'Livraison progressive, virtual patching et permissions Node.'),
    ],
  },
  {
    id: 'm27', num: 22, block: 'F', title: 'SOC et renseignement sur la menace', short: 'SOC & CTI', icon: 'Eye', palette: 'ocean',
    summary: 'Ce que l’AppSec doit savoir du SOC et du renseignement, sans devenir analyste : modèles, attentes envers l’application, CTI et chasse.',
    lessons: [
      L('l01', 'Ce que fait un SOC', 1, ['D7'], 'Missions, modèles interne, MSSP et MDR, métriques et maturité.'),
      L('l02', 'Ce que le SOC attend de l’application', 1, ['D5', 'D7'], 'Journaux exploitables, runbooks, contacts et contexte : l’interface entre l’AppSec et le SOC.'),
      L('l03', 'Le renseignement utile à l’AppSec', 2, ['D7'], 'Pyramid of Pain, modèle en diamant, STIX, MISP et TLP : consommer le renseignement sans s’y noyer.'),
      L('l04', 'Chasser dans les journaux', 3, ['D7'], 'PEAK et TaHiTI appliqués à CloudTrail et aux journaux applicatifs, jusqu’à la détection.'),
    ],
  },
  {
    id: 'm18', num: 23, block: 'F', title: 'Journalisation & SIEM (Elastic)', short: 'SIEM', icon: 'Radar', palette: 'aurora',
    summary: 'Journaliser pour la sécurité, concevoir la collecte, ingérer dans Elastic et chercher avec KQL, EQL et ES|QL.',
    lessons: [
      L('l01', 'Journaliser pour la sécurité', 1, ['D5', 'D7'], 'Logging Vocabulary, pino au format ECS et ce qu’on ne journalise jamais.', [1]),
      L('l02', 'Architecture de journalisation', 2, ['D7'], 'Centraliser, protéger l’intégrité, retenir et payer, et les angles morts de CloudTrail.'),
      L('l03', 'Ingestion dans Elastic', 1, ['D7'], 'Elastic Agent, intégrations AWS et ECS.'),
      L('l04', 'KQL, EQL et ES|QL', 2, ['D7'], 'Chercher, séquencer et analyser.'),
    ],
  },
  {
    id: 'm28', num: 24, block: 'F', title: 'Detection engineering', short: 'Détection', icon: 'Crosshair', palette: 'iris',
    summary: 'Écrire, tester et faire vivre des détections : cycle de vie, couverture ATT&CK, detection-as-code, détections applicatives et maturité.',
    lessons: [
      L('l01', 'Le cycle de vie d’une détection', 1, ['D7'], 'Hypothèse, règle, test, réglage et retrait, documentés au format ADS.'),
      L('l02', 'Couverture ATT&CK', 2, ['D7'], 'Detection Strategies, versions 18 et 19, Pyramid of Pain et robustesse d’une règle.'),
      L('l03', 'Règles, Sigma et detection-as-code', 2, ['D7'], 'Règles, Sigma, ADS, detection-as-code et tests.'),
      L('l04', 'Tester ses détections', 2, ['D6', 'D7'], 'Atomic Red Team, Stratus Red Team et jeux de données : une détection non testée est une hypothèse.'),
      L('l05', 'Détections applicatives', 2, ['D7'], 'ATO, énumération, rejeu, exfiltration et honeytokens.'),
      L('l06', 'Maturité et réponse à incident', 3, ['D7'], 'DEBMM, forensique CloudTrail et confinement.'),
    ],
  },
  {
    id: 'm29', num: 25, block: 'F', title: 'Réponse à incident', short: 'Réponse', icon: 'Siren', palette: 'crimson',
    summary: 'Du premier signal au post-mortem : cadre, playbooks, réponse dans AWS, gestion de crise et notifications réglementaires.',
    lessons: [
      L('l01', 'Le cadre de la réponse à incident', 1, ['D7'], 'NIST SP 800-61r3 et CSF 2.0, rôles, préparation, et ce qui change pour une application.'),
      L('l02', 'Playbooks et runbooks applicatifs', 2, ['D7'], 'Des procédures qu’on peut suivre à trois heures du matin, et les playbooks AWS à adapter.'),
      L('l03', 'Répondre dans AWS', 2, ['D7'], 'Enquêter dans CloudTrail, contenir sans détruire les preuves et révoquer les sessions.'),
      L('l04', 'Crise et communication', 2, ['D7'], 'Cellule de crise, décisions sous incertitude et communication, avec les guides de l’ANSSI.'),
      L('l05', 'Notifier dans les délais', 2, ['D3', 'D7'], 'RGPD, NIS2 et CRA : qui notifier, quand, et avec quoi.'),
      L('l06', 'Exercices et post-mortem', 3, ['D7'], 'Exercices sur table, post-mortem sans recherche de coupable et cause racine.'),
    ],
  },
  {
    id: 'm05', num: 26, block: 'F', title: 'Gestion des vulnérabilités', short: 'Vulnérabilités', icon: 'ListChecks', palette: 'gold',
    summary: 'Du finding au correctif vérifié : CVSS 4.0, EPSS, KEV, SSVC, VEX, SLA, divulgation et gestion de crise.',
    lessons: [
      L('l01', 'Cycle de vie d’une vulnérabilité', 1, ['D6', 'D7'], 'De la découverte à la vérification, et les sources de findings.'),
      L('l02', 'CVSS 4.0', 1, ['D6'], 'Les quatre groupes de métriques, et pourquoi le score de base ne suffit pas.'),
      L('l03', 'Prioriser par le risque', 2, ['D6', 'D7'], 'EPSS, KEV, SSVC, atteignabilité et VEX.', [13]),
      L('l04', 'Faut-il un exploit pour faire corriger ?', 2, ['D6'], 'Un débat pour pentester reconverti.', [13]),
      L('l05', 'Outillage, SLA et dépendances npm', 2, ['D7'], 'DefectDojo, Dependency-Track, exceptions et limites de npm audit.'),
      L('l06', 'Divulgation, bug bounty et CRA', 3, ['D6', 'D7', 'D8'], 'VDP, security.txt, écosystème CVE et obligations européennes.'),
      L('l07', 'Gérer une critique à J+0', 3, ['D7'], 'React2Shell comme cas d’école de la première journée.'),
    ],
  },
  {
    id: 'm19', num: 27, block: 'G', title: 'Sécurité des applications LLM', short: 'Applications LLM', icon: 'BrainCircuit', palette: 'purple',
    summary: 'OWASP LLM Top 10 2026, prompt injection, patterns pour agents, applications JS, ATLAS, red teaming et IA dans le SDLC.',
    lessons: [
      L('l01', 'OWASP LLM Top 10 2026', 1, ['D4'], 'Les dix risques et la correspondance avec 2025.'),
      L('l02', 'Prompt injection et règle de deux', 1, ['D4'], 'Pourquoi elle ne se patche pas, et comment limiter l’impact.'),
      L('l03', 'Patterns de conception pour agents', 2, ['D4'], 'Dual LLM, plan-then-execute et CaMeL.', [4]),
      L('l04', 'Applications JS avec LLM', 2, ['D5'], 'Sortie du modèle, RAG et consommation.'),
      L('l05', 'MITRE ATLAS et OWASP AI Exchange', 2, ['D4'], 'Techniques, études de cas et référentiels.'),
      L('l06', 'Red teaming des LLM', 3, ['D6'], 'promptfoo, garak, PyRIT et évaluations en CI.'),
      L('l07', 'L’IA dans le SDLC', 3, ['D8'], 'Code généré, agents de code et gouvernance.'),
    ],
  },
  {
    id: 'm30', num: 28, block: 'G', title: 'Agents & MCP', short: 'Agents & MCP', icon: 'Bot', palette: 'dusk',
    summary: 'Le Model Context Protocol en profondeur : architecture, menaces, serveurs locaux et distants, supply chain et gouvernance.',
    lessons: [
      L('l01', 'Agents et MCP : vue d’ensemble', 2, ['D4'], 'Agentic Top 10 2026 et sécurité de MCP.'),
      L('l02', 'Anatomie de MCP', 1, ['D4'], 'Hôte, client, serveur, primitives et transports, et le protocole sans état de la révision 2026-07-28.'),
      L('l03', 'Ce que le modèle lit, l’attaquant l’écrit', 2, ['D4'], 'Tool poisoning, rug pull, shadowing et lethal trifecta, à travers les cas GitHub et Supabase.'),
      L('l04', 'Écrire un serveur MCP local sûr', 2, ['D5'], 'Injection de commande, chemins et liens symboliques, DNS rebinding : les CVE de 2025 relues.'),
      L('l05', 'Serveur MCP distant et multi-tenant', 3, ['D5'], 'En-têtes contre corps, state handles, isolation des tenants et SSRF.'),
      L('l06', 'La supply chain MCP', 2, ['D8'], 'Registres, serveurs malveillants, configurations qui exécutent du code, et épinglage.'),
      L('l07', 'Gouverner MCP dans l’entreprise', 3, ['D7', 'D8'], 'Inventaire, serveurs fantômes, passerelles, journalisation des appels d’outils et OWASP MCP Top 10.'),
    ],
  },
  {
    id: 'm31', num: 29, block: 'G', title: 'MCP & OAuth', short: 'MCP & OAuth', icon: 'Plug', palette: 'cobalt',
    summary: 'L’autorisation de MCP pas à pas : resource server OAuth 2.1, découverte, enregistrement du client, audience, confused deputy et entreprise.',
    lessons: [
      L('l01', 'Comment MCP a adopté OAuth', 1, ['D1', 'D4'], 'De la révision 2025-03-26 à 2026-07-28 : le serveur MCP devient un resource server.'),
      L('l02', 'Découverte : PRM et métadonnées', 2, ['D5'], 'La réponse 401, RFC 9728, RFC 8414 et OIDC, et la validation de l’émetteur.'),
      L('l03', 'Enregistrer le client', 2, ['D5'], 'Client pré-enregistré, Client ID Metadata Document, DCR déprécié, et la SSRF des URL de métadonnées.'),
      L('l04', 'Le flux et ses vérifications', 2, ['D5'], 'PKCE, resource indicators, paramètre iss, et la leçon de CVE-2025-6514.'),
      L('l05', 'Audience, passthrough et API en aval', 2, ['D5'], 'Valider l’audience, refuser le token passthrough, obtenir un jeton distinct pour l’aval.'),
      L('l06', 'Le confused deputy des proxys MCP', 3, ['D4', 'D5'], 'Client statique, cookie de consentement et redirect_uri : l’attaque et ses parades.'),
      L('l07', 'Scopes minimaux et step-up', 2, ['D5'], 'insufficient_scope, union des scopes et hiérarchie : demander peu, puis davantage.'),
      L('l08', 'MCP en entreprise', 3, ['D4'], 'Enterprise-Managed Authorization, ID-JAG et identité des agents.'),
      L('l09', 'Implémenter en Express', 3, ['D5', 'D6'], 'Le SDK TypeScript, la PRM et la vérification des jetons, et les tests qui prouvent le refus.'),
    ],
  },
  {
    id: 'm06', num: 30, block: 'H', title: 'Faire adopter la sécurité', short: 'Adoption', icon: 'Handshake', palette: 'aurora',
    summary: 'Les contrôles ne valent rien s’ils ne sont pas adoptés : findings, négociation, dirigeants, formation, paved road et sécurité offensive.',
    lessons: [
      L('l01', 'Écrire un finding qui sera corrigé', 1, ['D2', 'D6'], 'Titre, reproduction, correctif et test de régression.'),
      L('l02', 'Négocier avec le produit', 2, ['D2'], 'SLA, dette de sécurité, exceptions et désaccords.', [7]),
      L('l03', 'Parler aux dirigeants', 2, ['D2'], 'Traduire en risque métier et quantifier avec FAIR.'),
      L('l04', 'Former au code sécurisé', 2, ['D2'], 'Partir des vrais bugs de l’entreprise.'),
      L('l05', 'Le paved road comme produit', 2, ['D2'], 'Rendre le chemin sûr plus facile que l’autre.'),
      L('l06', 'Piloter la sécurité offensive', 3, ['D6', 'D8'], 'Cadrer un pentest, choisir un prestataire, exploiter le rapport.'),
    ],
  },
  {
    id: 'm32', num: 31, block: 'H', title: 'Le programme AppSec', short: 'Programme', icon: 'Map', palette: 'sand',
    summary: 'La synthèse du parcours : chaque bloc devient une pratique, gouvernée, jalonnée, mesurée et planifiée sur douze mois.',
    lessons: [
      L('l01', 'Du parcours au programme', 2, ['D2'], 'Chaque bloc du parcours rangé dans SAMM et le SSDF : ce qui manque quand un bloc manque.'),
      L('l02', 'Gouvernance : politiques, standards et comités', 2, ['D2'], 'Ce qui s’écrit, qui le décide, et la revue annuelle qui empêche la politique de mourir.'),
      L('l03', 'Jalons, portes et exceptions', 2, ['D2'], 'Où bloquer, qui peut déroger, comment documenter et rendre compte.'),
      L('l04', 'Mesurer un programme', 2, ['D2'], 'MTTR, taux d’échappement, couverture et expérience développeur.'),
      L('l05', 'Cyber Resilience Act et roadmap', 3, ['D2'], 'Les obligations de signalement depuis le 11/09/2026 et une feuille de route à 12 mois.'),
    ],
  },
  {
    id: 'm20', num: 32, block: 'Z', title: 'Capstone : revue de sécurité de Novafact', short: 'Capstone', icon: 'Trophy', palette: 'gold',
    summary: 'Quinze étapes guidées, dans l’ordre du cycle de développement, qui assemblent le parcours en un livrable présentable.',
    lessons: [
      L('l01', 'Analyse de risques', 3, ['D2', 'D3'], 'Les valeurs métier de Novafact, ses événements redoutés et son registre des risques.'),
      L('l02', 'Threat model', 3, ['D4'], 'Le modèle de Novafact.'),
      L('l03', 'Exigences et traçabilité', 3, ['D3'], 'ASVS L2, classification des données et matrice.'),
      L('l04', 'Design doc et revue de conception', 3, ['D4'], 'Une nouvelle fonctionnalité passée en SDR.'),
      L('l05', 'Contrôles anti-abus', 3, ['D4'], 'Inscription, connexion et envoi de factures.'),
      L('l06', 'Revue de PR, règles et tests', 3, ['D5', 'D6'], 'Relire, écrire les règles et les tests de régression.'),
      L('l07', 'Vulnérabilités avancées', 3, ['D5'], 'Corriger les sujets de M9.'),
      L('l08', 'Page de paiement', 3, ['D5', 'D7'], 'Inventaire des scripts, CSP et PCI.'),
      L('l09', 'Pipeline et supply chain', 3, ['D8'], 'Durcir la chaîne de livraison.'),
      L('l10', 'IAM au moindre privilège', 3, ['D7'], 'Les rôles de Novafact.'),
      L('l11', 'Cinq détections Elastic', 3, ['D7'], 'Écrites et testées.'),
      L('l12', 'Exercice de crise', 3, ['D7'], 'Un incident simulé, la cellule de crise et les notifications dans les délais.'),
      L('l13', 'Le serveur MCP d’Ask Novafact', 3, ['D4', 'D5'], 'Threat model, autorisation OAuth et tests du serveur MCP de l’assistant.'),
      L('l14', 'Roadmap SAMM à 12 mois', 3, ['D2'], 'Le plan du programme.'),
      L('l15', 'Plan d’adoption et restitution', 3, ['D2'], 'Champions, formation, SLA et synthèse pour la direction.'),
    ],
  },
];

export const moduleById = (id: string) => modules.find((m) => m.id === id);
export const lessonKey = (moduleId: string, lessonId: string) => `${moduleId}-${lessonId}`;
export const lessonMinutes = (l: LessonMeta) => (l.level === 1 ? 20 : l.level === 2 ? 25 : 30);
export const moduleMinutes = (m: ModuleMeta) => m.lessons.reduce((s, l) => s + lessonMinutes(l), 0);
export const formatDuration = (min: number) => (min < 60 ? `${min} min` : `${Math.floor(min / 60)} h${min % 60 ? ` ${String(min % 60).padStart(2, '0')}` : ''}`);
export const pad2 = (n: number) => String(n).padStart(2, '0');
export const totalLessons = modules.reduce((s, m) => s + m.lessons.length, 0);

/**
 * Séries de jeu à réussir pour valider une leçon, en plus de son quiz : un ou
 * deux jeux par leçon, chacun avec ses séries exigées. Clé : `lessonKey`.
 *
 * Une série se désigne par son `id` dans `defineSeries`, pas par son rang à
 * l'écran : le rang bouge dès qu'on insère une série, et la leçon exigerait
 * alors en silence une autre série que celle choisie. `check-games` vérifie que
 * leçon, jeu et série existent, et qu'aucune série n'est exigée deux fois par la
 * même leçon.
 */
export const lessonGames: Record<string, Record<string, string[]>> = {
  // Bloc A
  'm01-l05': { flashcards: ['vocabulaire'] },
  'm32-l05': { flashcards: ['programme'] },
  // Bloc B
  'm25-l08': { referentiel: ['decouverte', 'echauffement'] },
  'm02-l01': { 'spot-the-sink': ['decouverte', 'mise-en-jambe'] },
  'm02-l03': { 'patch-or-pwn': ['prise-en-main', 'bons-reflexes'] },
  'm02-l09': { 'spot-the-sink': ['montee', 'revue-de-pr'], flashcards: ['js'] },
  'm04-l05': { 'csp-builder': ['vitrine', 'tableau-de-bord'] },
  'm04-l08': { 'csp-builder': ['paiement'] },
  'm04-l09': { flashcards: ['client'] },
  'm03-l01': { 'race-window': ['bases', 'reconnaitre', 'transactions'] },
  'm03-l04': { 'stepping-stones': ['rapport', 'arbitrage'] },
  'm03-l05': { 'parser-wars': ['decouverte', 'smuggling'] },
  'm03-l06': { 'parser-wars': ['caches'] },
  'm03-l07': { 'parser-wars': ['deux-lectures', 'formats-de-donnees'], 'patch-or-pwn': ['contournements'] },
  'm03-l13': { flashcards: ['web-avance'] },
  // Bloc C
  'm11-l02': { 'stride-cards': ['web', 'mobile'] },
  'm11-l04': { 'red-blue': ['identity'] },
  'm11-l06': { 'stride-cards': ['rag', 'cicd'] },
  'm07-l03': { 'data-map': ['decouverte', 'premiers-pieges'] },
  'm07-l04': { 'data-map': ['hors-de-la-base'] },
  'm08-l03': { 'pattern-match': ['premiers-reperes', 'mise-en-jambe'] },
  'm08-l04': { 'pattern-match': ['anti-patterns'] },
  'm08-l09': { 'design-review': ['export'] },
  'm08-l10': { 'design-review': ['partage', 'import-csv'], flashcards: ['concevoir'] },
  'm09-l03': { 'oauth-debugger': ['bases'] },
  'm09-l05': { 'oauth-debugger': ['oidc-jwt'] },
  'm09-l06': { 'oauth-debugger': ['montee'], 'patch-or-pwn': ['cas-reels'] },
  'm09-l08': { 'oauth-debugger': ['saml'], flashcards: ['identite'] },
  'm10-l01': { referentiel: ['conventions'] },
  'm10-l02': { 'abuse-desk': ['connexion'] },
  'm10-l03': { 'abuse-desk': ['inscription', 'journee'] },
  'm10-l05': { 'abuse-desk': ['scraping'] },
  'm10-l06': { 'race-window': ['soldes', 'idempotence'] },
  // Bloc D
  'm12-l02': { 'spot-the-sink': ['audit'] },
  'm12-l03': { 'diff-review': ['premieres-pr', 'mise-en-jambe'] },
  'm12-l05': { 'diff-review': ['approuver-ou-pas'] },
  'm13-l01': { 'right-tool': ['decouverte', 'premiers-choix'] },
  'm13-l03': { 'true-false-positive': ['premier-tri', 'sast-du-jour'] },
  'm13-l10': { 'true-false-positive': ['revue-ia'] },
  'm13-l11': { 'right-tool': ['deux-etapes', 'montee'] },
  'm14-l02': { 'workflow-audit': ['decouverte', 'mise-en-jambe'] },
  'm14-l04': { 'workflow-audit': ['faux-amis'] },
  'm14-l05': { 'supply-chain': ['registres'] },
  'm14-l08': { 'supply-chain': ['initiation', 'panorama'] },
  'm14-l11': { 'crise-j0': ['ver-npm'], flashcards: ['outiller'] },
  // Bloc E
  'm15-l01': { 'allow-deny': ['bases', 'sous-conditions'] },
  'm15-l04': { 'iam-pathfinder': ['primitives', 'premiers-pas', 'passrole'] },
  'm15-l06': { 'allow-deny': ['cross-account'] },
  'm16-l01': { 'iac-hunt': ['decouverte', 'mise-en-jambe'] },
  'm16-l02': { 'iac-hunt': ['faux-amis'] },
  'm17-l08': { flashcards: ['cloud'] },
  // Bloc F
  'm18-l01': { 'log-detective': ['signature'] },
  'm28-l03': { 'detection-builder': ['un-champ', 'le-bon-champ'] },
  'm28-l05': { 'log-detective': ['bruit', 'identite'], 'detection-builder': ['exclusions'] },
  'm05-l02': { flashcards: ['vulnerabilites'] },
  'm05-l03': { 'stepping-stones': ['decouverte', 'montee'], 'triage-room': ['interne', 'sprint-38'] },
  'm05-l05': { 'triage-room': ['front', 'images'] },
  'm05-l07': { 'crise-j0': ['cle-publiee', 'react2shell'] },
  // Bloc G
  'm19-l01': { referentiel: ['llm-ou-agent'] },
  'm19-l03': { 'agent-blast-radius': ['support', 'facturation'] },
  'm19-l07': { flashcards: ['ia'] },
  'm30-l01': { 'agent-blast-radius': ['ide-mcp'] },
  // Bloc H
  'm06-l01': { pushback: ['developpeurs'] },
  'm06-l02': { pushback: ['premiers-echanges', 'produit'] },
  'm06-l03': { pushback: ['direction'] },
  // Capstone
  'm20-l02': { 'red-blue': ['cle-du-depot', 'mot-de-passe-client'] },
  'm20-l15': { flashcards: ['pieges'] },
};

export const lessonSeries = (moduleId: string, lessonId: string) =>
  Object.entries(lessonGames[lessonKey(moduleId, lessonId)] ?? {})
    .flatMap(([game, ids]) => ids.map((series) => ({ game, series })));

export const levelNames: Record<Level, string> = { 1: 'Opérationnel', 2: 'Avancé', 3: 'Expert' };

export const csslpDomains: { id: Csslp; name: string; weight: number }[] = [
  { id: 'D1', name: 'Secure Software Concepts', weight: 12 },
  { id: 'D2', name: 'Secure Software Lifecycle Management', weight: 11 },
  { id: 'D3', name: 'Secure Software Requirements', weight: 13 },
  { id: 'D4', name: 'Secure Software Architecture and Design', weight: 15 },
  { id: 'D5', name: 'Secure Software Implementation', weight: 14 },
  { id: 'D6', name: 'Secure Software Testing', weight: 14 },
  { id: 'D7', name: 'Secure Software Deployment, Operations, Maintenance', weight: 11 },
  { id: 'D8', name: 'Secure Software Supply Chain', weight: 10 },
];

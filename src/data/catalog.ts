// Catalogue du parcours : blocs, modules et leçons. Source : PROGRAMME.md.
// Le contenu rédigé d'une leçon vit dans src/content/<module>/<leçon>.mdx ;
// une leçon sans fichier s'affiche « en rédaction ».

export type Palette =
  | 'ember' | 'iris' | 'signal' | 'glacier' | 'sand' | 'dusk' | 'moss' | 'cobalt'
  | 'ocean' | 'ink' | 'crimson' | 'purple' | 'gold' | 'pearl' | 'aurora' | 'dawn';

export type Level = 1 | 2 | 3;
export type Csslp = 'D1' | 'D2' | 'D3' | 'D4' | 'D5' | 'D6' | 'D7' | 'D8';
export type BlockId = 'A' | 'B' | 'C' | 'D' | 'E' | 'Z';

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
  { id: 'A', title: 'Le métier', text: 'Vulnérabilités de l’écosystème JS, recherche avancée, gestion des vulnérabilités et adoption par les équipes.' },
  { id: 'B', title: 'Concevoir', text: 'Exigences, conception sécurisée, identité, anti-abus et threat modeling.' },
  { id: 'C', title: 'Vérifier & outiller', text: 'Revue de code, tests et analyse, pipeline et supply chain.' },
  { id: 'D', title: 'Cloud & production', text: 'IAM AWS, infrastructure as code, déploiement et détection dans Elastic.' },
  { id: 'E', title: 'Continu', text: 'Sécurité de l’IA : un module vivant, mis à jour au fil de la veille.' },
  { id: 'Z', title: 'Capstone', text: 'La revue de sécurité complète de Novafact.' },
];

const L = (id: string, title: string, level: Level, csslp: Csslp[], summary: string, k?: number[]): LessonMeta => ({ id, title, level, csslp, summary, k });

export const modules: ModuleMeta[] = [
  {
    id: 'm01', num: 1, block: 'A', title: 'Programme AppSec & DevSecOps', short: 'Programme', icon: 'Compass', palette: 'sand',
    summary: 'Passer du pentest à l’AppSec : référentiels, maturité, jalons, métriques, risque et Cyber Resilience Act.',
    lessons: [
      L('l01', 'Du pentest à l’AppSec', 1, ['D2'], 'Changer d’échelle, penser en classes de bugs, choisir le bon référentiel — et la carte des vingt modules.'),
      L('l02', 'Principes DevSecOps', 1, ['D2'], 'Shift left et shift right, paved road, secure by default et safe coding.'),
      L('l03', 'OWASP SAMM v2', 2, ['D2'], 'Cinq fonctions, quinze pratiques : mesurer et piloter un programme.'),
      L('l04', 'BSIMM16 : se comparer', 2, ['D2'], 'Un modèle descriptif, bâti sur 111 organisations réelles.'),
      L('l05', 'Jalons, portes et exceptions', 2, ['D2'], 'Où bloquer, qui peut déroger, comment documenter et rendre compte.'),
      L('l06', 'Mesurer un programme', 2, ['D2'], 'MTTR, taux d’échappement, couverture et expérience développeur.'),
      L('l07', 'Risque et acceptation', 3, ['D2', 'D7'], 'Risque technique contre risque métier, et un sign-off au bon niveau.'),
      L('l08', 'Cyber Resilience Act et roadmap', 3, ['D2'], 'Les obligations de signalement depuis le 11/09/2026 et une feuille de route à 12 mois.'),
    ],
  },
  {
    id: 'm02', num: 2, block: 'A', title: 'Vulnérabilités web, écosystème JS', short: 'Vulnérabilités JS', icon: 'Bug', palette: 'ember',
    summary: 'Les vulnérabilités d’Express, React et Next.js vues du côté défenseur : cause racine et contrôle qui élimine la classe.',
    lessons: [
      L('l01', 'Top 10 2025, API Top 10 et CWE Top 25', 1, ['D5'], 'Ce qui a changé en 2025 et comment se servir de chaque liste.'),
      L('l02', 'Entrées non fiables dans Express', 1, ['D5'], 'Injections SQL et NoSQL, mass assignment, BOLA et validation par schéma.', [10]),
      L('l03', 'Footguns JavaScript et argent', 1, ['D5'], 'Les pièges du langage et des nombres dans une application de facturation.', [8, 9]),
      L('l04', 'Spécificités Node.js', 2, ['D5'], 'Prototype pollution, ReDoS, chemins, SSRF, sous-processus et modèle de menaces de Node.'),
      L('l05', 'Erreurs, exceptions et atomicité', 2, ['D5'], 'Échouer de façon sûre, TOCTOU, comparaisons à temps constant et sérialisation.', [8, 13]),
      L('l06', 'React et le navigateur', 2, ['D4', 'D5'], 'Sinks XSS de React, jetons, CSRF, CORS et postMessage.', [11]),
      L('l07', 'Next.js, RSC et Server Actions', 3, ['D5'], 'Des endpoints publics qui ne se voient pas, et trois CVE récentes à connaître.'),
      L('l08', 'Éliminer une classe entière', 3, ['D5'], 'Wrappers sûrs, règles de lint et paved roads plutôt que correctifs au cas par cas.'),
    ],
  },
  {
    id: 'm03', num: 3, block: 'A', title: 'Web avancé : le programme PortSwigger', short: 'Web avancé', icon: 'Microscope', palette: 'crimson',
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
    id: 'm04', num: 4, block: 'A', title: 'Sécurité côté client & scripts tiers', short: 'Côté client', icon: 'Globe', palette: 'dawn',
    summary: 'Le navigateur exécute ton code et celui des autres : CSP, Trusted Types, isolation et exigences PCI sur la page de paiement.',
    lessons: [
      L('l01', 'Le client n’est pas sous ton contrôle', 1, ['D5'], 'Validation côté client, secrets dans le bundle et source maps.'),
      L('l02', 'Scripts tiers', 1, ['D4', 'D8'], 'Un script tiers a les droits de ton code : Magecart et polyfill.io.', [4]),
      L('l03', 'Réduire la confiance', 2, ['D4', 'D5'], 'Inventaire, auto-hébergement, SRI, iframes en sandbox.'),
      L('l04', 'CSP stricte en pratique', 2, ['D5', 'D7'], 'Nonces, strict-dynamic, report-only puis blocage, et rapports utiles.'),
      L('l05', 'Trusted Types et Sanitizer API', 2, ['D5'], 'Des défenses DOM qui ferment les sinks par construction.'),
      L('l06', 'Isolation d’origine', 2, ['D5'], 'Fetch Metadata, COOP/COEP/CORP, cookies et service workers.'),
      L('l07', 'PCI DSS 4.0.1 : 6.4.3 et 11.6.1', 3, ['D3', 'D7'], 'Inventaire et intégrité des scripts de la page de paiement.'),
      L('l08', 'Surveiller le client', 3, ['D7', 'D8'], 'Détecter un changement de script et réagir à un skimmer.'),
    ],
  },
  {
    id: 'm05', num: 5, block: 'A', title: 'Gestion des vulnérabilités', short: 'Vulnérabilités', icon: 'ListChecks', palette: 'gold',
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
    id: 'm06', num: 6, block: 'A', title: 'Faire adopter la sécurité', short: 'Adoption', icon: 'Handshake', palette: 'aurora',
    summary: 'Les contrôles ne valent rien s’ils ne sont pas adoptés : findings, négociation, champions, formation et paved road.',
    lessons: [
      L('l01', 'Le rôle : une équipe qui rend capable', 1, ['D2'], 'De l’auditeur au partenaire des équipes produit.'),
      L('l02', 'Écrire un finding qui sera corrigé', 1, ['D2', 'D6'], 'Titre, reproduction, correctif et test de régression.'),
      L('l03', 'Négocier avec le produit', 2, ['D2'], 'SLA, dette de sécurité, exceptions et désaccords.', [7]),
      L('l04', 'Parler aux dirigeants', 2, ['D2'], 'Traduire en risque métier et quantifier avec FAIR.'),
      L('l05', 'Security Champions', 2, ['D2'], 'Recruter, animer, reconnaître et mesurer.'),
      L('l06', 'Former au code sécurisé', 2, ['D2'], 'Partir des vrais bugs de l’entreprise.'),
      L('l07', 'Le paved road comme produit', 2, ['D2'], 'Rendre le chemin sûr plus facile que l’autre.'),
      L('l08', 'Piloter la sécurité offensive', 3, ['D6', 'D8'], 'Cadrer un pentest, choisir un prestataire, exploiter le rapport.'),
    ],
  },
  {
    id: 'm07', num: 7, block: 'B', title: 'Fondations, exigences & vie privée', short: 'Exigences', icon: 'ClipboardList', palette: 'pearl',
    summary: 'Confiance, C-I-A et Gold Standard, exigences traçables, classification des données, RGPD et conformité.',
    lessons: [
      L('l01', 'La confiance', 1, ['D1'], 'Un spectre, des composants implicitement fiables, et moins de parties à qui se fier.', [1]),
      L('l02', 'C-I-A et Gold Standard', 1, ['D1'], 'Authentification, autorisation et audit appliqués à Novafact.', [1]),
      L('l03', 'Exigences et abuse cases', 1, ['D3'], 'Tirer ses exigences d’ASVS 5.0 et écrire des cas d’abus.'),
      L('l04', 'Matrice de traçabilité', 2, ['D3', 'D6'], 'De l’exigence à la preuve, dans le dépôt.'),
      L('l05', 'Classification des données', 2, ['D3'], 'Propriétaire, sensibilité, cycle de vie.'),
      L('l06', 'Vie privée et RGPD', 2, ['D3'], 'Minimisation, droits des personnes, rétention et transferts.', [1, 6]),
      L('l07', 'Conformité : NIS2, CRA, PCI DSS', 2, ['D3', 'D8'], 'Ce que chaque texte impose au code et au produit.'),
      L('l08', 'Provisionnement des accès', 3, ['D3'], 'Comptes, comptes de service, recertification et départs.'),
    ],
  },
  {
    id: 'm08', num: 8, block: 'B', title: 'Conception sécurisée & architecture', short: 'Conception', icon: 'PenTool', palette: 'iris',
    summary: 'Le cœur de Designing Secure Software appliqué à Novafact : patterns, design doc, revue de conception, authn, authz et crypto.',
    lessons: [
      L('l01', 'Mitigations structurelles', 1, ['D1', 'D4'], 'Surface, fenêtre de vulnérabilité et exposition des données.', [3]),
      L('l02', 'Les 14 patterns', 1, ['D1'], 'Cinq familles de patterns de conception sécurisée.', [4]),
      L('l03', 'Les 4 anti-patterns', 1, ['D4'], 'Confused deputy, backflow of trust, third-party hooks, composants non patchables.', [4]),
      L('l04', 'Écrire un design doc sécurisé', 2, ['D2', 'D4'], 'Hypothèses explicites, périmètre, interfaces et données.', [6]),
      L('l05', 'Mener une Security Design Review', 2, ['D4'], 'Six étapes et une priorisation Must / Ought / Should.', [7]),
      L('l06', 'Authentification applicative', 2, ['D1', 'D5'], 'Sessions, argon2id, passkeys et flux de réinitialisation.'),
      L('l07', 'Autorisation et multi-tenant', 2, ['D5'], 'RBAC, ABAC, ReBAC, moteurs de politiques et isolation des tenants.'),
      L('l08', 'Crypto pour développeurs', 2, ['D1', 'D5'], 'CSPRNG, MAC, signatures, KMS et agilité cryptographique.', [5]),
      L('l09', 'Conception d’interfaces', 3, ['D4'], 'Interfaces d’administration, de logs et entre services.'),
      L('l10', 'Patterns d’architecture', 3, ['D4', 'D5'], 'Gateway, BFF, services, upload isolé et tokenisation.'),
    ],
  },
  {
    id: 'm09', num: 9, block: 'B', title: 'OAuth 2.x / OIDC / SAML', short: 'OAuth & SAML', icon: 'KeyRound', palette: 'cobalt',
    summary: 'OAuth 2.1, RFC 10017 pour les SPA, validation des JWT, attaques, RFC 9700 et SAML en entreprise.',
    lessons: [
      L('l01', 'OAuth 2.1 et Authorization Code + PKCE', 1, ['D1'], 'Ce qui est mort, et le flux à connaître par cœur.'),
      L('l02', 'SPA : RFC 10017 et BFF', 2, ['D5'], 'Garder les jetons hors du navigateur.'),
      L('l03', 'Valider un JWT dans Express', 2, ['D5'], 'Algorithme, émetteur, audience, expiration et JWKS.'),
      L('l04', 'Attaques OAuth et OIDC', 2, ['D5'], 'Redirections, mix-up, CSRF de connexion et consentement abusif.'),
      L('l05', 'RFC 9700, DPoP, PAR et FAPI', 3, ['D5'], 'L’état de l’art et les jetons liés à l’émetteur.'),
      L('l06', 'SAML en entreprise', 3, ['D4'], 'Signature, parsers XML et choix d’une librairie Node.'),
    ],
  },
  {
    id: 'm10', num: 10, block: 'B', title: 'Anti-abus, ATO & fraude', short: 'Anti-abus', icon: 'ShieldAlert', palette: 'purple',
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
    id: 'm11', num: 11, block: 'B', title: 'Threat modeling & MITRE', short: 'Threat modeling', icon: 'Waypoints', palette: 'dusk',
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
    id: 'm12', num: 12, block: 'C', title: 'Revue de code sécurité', short: 'Revue de code', icon: 'FileCode', palette: 'moss',
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
    id: 'm13', num: 13, block: 'C', title: 'Tests & analyse de code', short: 'Tests & analyse', icon: 'ScanSearch', palette: 'ocean',
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
    ],
  },
  {
    id: 'm14', num: 14, block: 'C', title: 'Pipeline, supply chain & fournisseurs', short: 'Supply chain', icon: 'Workflow', palette: 'glacier',
    summary: 'Top 10 CI/CD, GitHub Actions, npm, SLSA, Sigstore, fournisseurs et réponse aux incidents supply chain.',
    lessons: [
      L('l01', 'OWASP Top 10 CI/CD', 1, ['D7', 'D8'], 'Les dix risques appliqués à GitHub Actions.'),
      L('l02', 'Durcir GitHub Actions', 1, ['D7', 'D8'], 'Permissions, déclencheurs, injection, OIDC et épinglage.'),
      L('l03', 'Sécuriser l’environnement de dev', 1, ['D8'], 'Le poste du dev et le runner CI sont des cibles.', [13]),
      L('l04', 'Outils du pipeline', 2, ['D8'], 'zizmor, actionlint, harden-runner et Scorecard.'),
      L('l05', 'npm : installer et publier', 2, ['D8'], 'Lockfile, scripts, trusted publishing et staged publishing.'),
      L('l06', 'Choisir un composant', 2, ['D5', 'D8'], 'Maintenance, historique, surface et licences.', [13]),
      L('l07', 'Cas réels de supply chain', 2, ['D8'], 'De event-stream à Shai-Hulud.'),
      L('l08', 'Fournisseurs et tiers', 2, ['D8'], 'Évaluer, contractualiser et intégrer au SIEM.'),
      L('l09', 'SLSA, Sigstore et provenance', 3, ['D7', 'D8'], 'Build track, source track et attestations.'),
      L('l10', 'Répondre à un incident supply chain', 3, ['D7', 'D8'], 'Versions touchées, rotation des secrets et nettoyage.'),
    ],
  },
  {
    id: 'm15', num: 15, block: 'D', title: 'IAM AWS', short: 'IAM AWS', icon: 'Fingerprint', palette: 'ink',
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
    id: 'm16', num: 16, block: 'D', title: 'Infrastructure as Code', short: 'IaC', icon: 'Blocks', palette: 'signal',
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
    id: 'm17', num: 17, block: 'D', title: 'Déploiement, exploitation & résilience', short: 'Déploiement', icon: 'Rocket', palette: 'ember',
    summary: 'Configuration de production, conteneurs, publication, AWS, en-têtes, continuité, fin de vie et protection à l’exécution.',
    lessons: [
      L('l01', 'Configuration de production', 1, ['D7'], 'Secrets, erreurs, helmet, en-têtes et cookies.'),
      L('l02', 'Conteneurs Node.js', 1, ['D7'], 'Images minimales, utilisateur non root et scan.'),
      L('l03', 'Publier en sécurité', 2, ['D7'], 'Signature, admission, changements et mise en production.'),
      L('l04', 'Plateformes AWS', 2, ['D7'], 'ECS, Lambda, EKS, CloudFront et WAF.'),
      L('l05', 'En-têtes en production', 2, ['D7'], 'Appliquer et vérifier la politique conçue en M4.'),
      L('l06', 'Résilience et continuité', 2, ['D7'], 'Sauvegardes immuables, reprise et ransomware cloud.'),
      L('l07', 'Fin de vie', 2, ['D2', 'D7'], 'Décommissionner un service et disposer des données.', [4]),
      L('l08', 'Protection à l’exécution', 3, ['D7'], 'Livraison progressive, virtual patching et permissions Node.'),
    ],
  },
  {
    id: 'm18', num: 18, block: 'D', title: 'Surveillance, logging & SIEM (Elastic)', short: 'SIEM', icon: 'Radar', palette: 'aurora',
    summary: 'Journaliser pour la sécurité, ingérer dans Elastic, écrire des détections et répondre aux incidents applicatifs.',
    lessons: [
      L('l01', 'Journaliser pour la sécurité', 1, ['D5', 'D7'], 'Logging Vocabulary, pino au format ECS et ce qu’on ne journalise jamais.', [1]),
      L('l02', 'Ingestion dans Elastic', 1, ['D7'], 'Elastic Agent, intégrations AWS et ECS.'),
      L('l03', 'KQL, EQL et ES|QL', 2, ['D7'], 'Chercher, séquencer et analyser.'),
      L('l04', 'Detection engineering', 2, ['D7'], 'Règles, Sigma, ADS, detection-as-code et tests.'),
      L('l05', 'Détections applicatives', 2, ['D7'], 'ATO, énumération, rejeu, exfiltration et honeytokens.'),
      L('l06', 'Maturité et réponse à incident', 3, ['D7'], 'DEBMM, forensique CloudTrail et confinement.'),
    ],
  },
  {
    id: 'm19', num: 19, block: 'E', title: 'Sécurité de l’IA', short: 'IA', icon: 'BrainCircuit', palette: 'purple',
    summary: 'OWASP LLM Top 10 2026, Agentic Top 10, prompt injection, MCP, ATLAS, red teaming et IA dans le SDLC.',
    lessons: [
      L('l01', 'OWASP LLM Top 10 2026', 1, ['D4'], 'Les dix risques et la correspondance avec 2025.'),
      L('l02', 'Prompt injection et règle de deux', 1, ['D4'], 'Pourquoi elle ne se patche pas, et comment limiter l’impact.'),
      L('l03', 'Patterns de conception pour agents', 2, ['D4'], 'Dual LLM, plan-then-execute et CaMeL.', [4]),
      L('l04', 'Applications JS avec LLM', 2, ['D5'], 'Sortie du modèle, RAG et consommation.'),
      L('l05', 'Agents et MCP', 2, ['D4'], 'Agentic Top 10 2026 et sécurité de MCP.'),
      L('l06', 'MITRE ATLAS et OWASP AI Exchange', 2, ['D4'], 'Techniques, études de cas et référentiels.'),
      L('l07', 'Red teaming des LLM', 3, ['D6'], 'promptfoo, garak, PyRIT et évaluations en CI.'),
      L('l08', 'L’IA dans le SDLC', 3, ['D8'], 'Code généré, agents de code et gouvernance.'),
    ],
  },
  {
    id: 'm20', num: 20, block: 'Z', title: 'Capstone : revue de sécurité de Novafact', short: 'Capstone', icon: 'Trophy', palette: 'gold',
    summary: 'Douze étapes guidées qui assemblent tout le parcours en un livrable présentable.',
    lessons: [
      L('l01', 'Exigences et traçabilité', 3, ['D3'], 'ASVS L2, classification des données et matrice.'),
      L('l02', 'Design doc et revue de conception', 3, ['D4'], 'Une nouvelle fonctionnalité passée en SDR.'),
      L('l03', 'Threat model', 3, ['D4'], 'Le modèle de Novafact.'),
      L('l04', 'Revue de PR, règles et tests', 3, ['D5', 'D6'], 'Relire, écrire les règles et les tests de régression.'),
      L('l05', 'Page de paiement', 3, ['D5', 'D7'], 'Inventaire des scripts, CSP et PCI.'),
      L('l06', 'Contrôles anti-abus', 3, ['D4'], 'Inscription, connexion et envoi de factures.'),
      L('l07', 'Pipeline et supply chain', 3, ['D8'], 'Durcir la chaîne de livraison.'),
      L('l08', 'IAM au moindre privilège', 3, ['D7'], 'Les rôles de Novafact.'),
      L('l09', 'Vulnérabilités avancées', 3, ['D5'], 'Corriger les sujets de M3.'),
      L('l10', 'Cinq détections Elastic', 3, ['D7'], 'Écrites et testées.'),
      L('l11', 'Roadmap SAMM à 12 mois', 3, ['D2'], 'Le plan du programme.'),
      L('l12', 'Plan d’adoption et restitution', 3, ['D2'], 'Champions, formation, SLA et synthèse pour la direction.'),
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

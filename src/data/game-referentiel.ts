// Items du jeu « Quel référentiel ? » : un intitulé exact à ranger dans sa liste.
//
// Chaque item est le titre officiel d'une catégorie, d'une menace ou d'un
// chapitre, tel qu'il figure dans l'édition citée. Un seul référentiel le porte
// sous cet intitulé : c'est ce qui rend la réponse unique, même quand le sujet
// est traité ailleurs. « Security Misconfiguration » est volontairement absent :
// il existe mot pour mot dans le Top 10:2025 (A02) et dans l'API Top 10 (API8).
//
// La difficulté ne vient pas de la notoriété du risque, mais de la **distance
// entre l'intitulé et sa liste** :
//
//   N1 · L'intitulé contient le mot qui trahit sa liste (Pipeline, Agent,
//        Prompt, WebRTC, APIs…), ou c'est le titre phare d'une liste, sans
//        voisin plausible ailleurs. On apprend les six listes.
//
//   N2 · Aucun mot ne trahit la liste. Il faut reconnaître sa manière de nommer
//        — « … Failures » pour le Top 10, « Insufficient … » pour le CI/CD, un
//        nom de domaine nu pour un chapitre ASVS — ou savoir ce qu'elle couvre.
//        Une seconde liste est concevable, mais un trait connu tranche.
//
//   N3 · Un quasi-homonyme existe dans une autre liste, ou l'intitulé évoque le
//        domaine d'une autre liste : « Excessive Agency » sonne agentique et
//        vient du Top 10 LLM, « API and Web Service » est un chapitre ASVS,
//        « Server Side Request Forgery » n'est plus un titre du Top 10 depuis
//        2025. Deux réponses semblent possibles ; seul l'intitulé exact décide.
//
// Les quasi-homonymes se déclarent dans `avoid` : vus l'un après l'autre, le
// second se résout par élimination au lieu d'être reconnu.

import type { Level } from './catalog';
import { defineSeries, type Leveled, type SeriesProfile } from '../lib/series';

export type RefId = 'top10' | 'api' | 'cicd' | 'llm' | 'agentic' | 'asvs' | 'oat';

export const referentiels: { id: RefId; name: string; short: string }[] = [
  { id: 'top10', name: 'OWASP Top 10:2025', short: 'Top 10' },
  { id: 'api', name: 'OWASP API Security Top 10 2023', short: 'API' },
  { id: 'cicd', name: 'OWASP Top 10 CI/CD Security Risks', short: 'CI/CD' },
  { id: 'llm', name: 'OWASP Top 10 for LLM Applications 2026', short: 'LLM' },
  { id: 'agentic', name: 'OWASP Top 10 for Agentic Applications 2026', short: 'Agentic' },
  { id: 'asvs', name: 'OWASP ASVS 5.0 (chapitres)', short: 'ASVS' },
  { id: 'oat', name: 'OWASP Automated Threats to Web Applications', short: 'OAT' },
];

export interface RefItem extends Leveled {
  label: string;
  ref: RefId;
  note: string;
}

const r = (id: string, level: Level, ref: RefId, label: string, note: string, avoid?: string[]): RefItem =>
  ({ id, level, ref, label, note, ...(avoid ? { avoid } : {}) });

export const refItems: RefItem[] = [
  // ── OWASP Top 10:2025 ────────────────────────────────────────────────────
  r('top10-supply-chain', 2, 'top10', 'Software Supply Chain Failures', 'A03:2025, nouvelle catégorie. Le Top 10 LLM dit seulement « Supply Chain », l’Agentic « Agentic Supply Chain Vulnerabilities » : le suffixe « Failures » signe le Top 10. Elle cite le ver npm Shai-Hulud (2025).', ['llm-supply-chain', 'agentic-supply-chain']),
  r('top10-exceptional', 2, 'top10', 'Mishandling of Exceptional Conditions', 'A10:2025, nouvelle catégorie : erreurs, exceptions et états inattendus, comme un contrôle qui échoue en ouvert.'),
  r('top10-crypto', 2, 'top10', 'Cryptographic Failures', 'A04:2025. Le chapitre ASVS s’appelle simplement « Cryptography ». Cas d’école : Adobe (2013), des mots de passe chiffrés en 3DES mode ECB au lieu d’être hachés.', ['asvs-crypto']),
  r('top10-insecure-design', 2, 'top10', 'Insecure Design', 'A06:2025. Aucun mot ne trahit la liste ; c’est une catégorie de 2021 qui vise les contrôles absents dès la conception, pas les bugs d’implémentation.'),
  r('top10-logging', 3, 'top10', 'Security Logging & Alerting Failures', 'A09:2025, renommée pour mettre l’alerte au niveau de la journalisation. Le CI/CD dit « Insufficient Logging and Visibility », l’ASVS « Security Logging and Error Handling ».', ['cicd-logging', 'asvs-logging']),
  r('top10-integrity', 3, 'top10', 'Software or Data Integrity Failures', 'A08:2025. Son voisin CI/CD est « Improper Artifact Integrity Validation » (CICD-SEC-9). L’exemple classique est SolarWinds (2020) : du code injecté pendant le build d’une mise à jour signée.', ['cicd-artifact-integrity']),
  r('top10-access-control', 1, 'top10', 'Broken Access Control', 'A01:2025, en tête depuis 2021. Elle absorbe désormais la SSRF.'),
  r('top10-injection', 2, 'top10', 'Injection', 'A05:2025. « Prompt Injection » est LLM01 : le mot seul, sans qualificatif, est la catégorie du Top 10. MOVEit Transfer (2023) en est un cas massif, par injection SQL.', ['llm-prompt-injection']),
  r('top10-authn', 3, 'top10', 'Authentication Failures', 'A07:2025. L’API Top 10 dit « Broken Authentication » (API2), l’ASVS nomme son chapitre « Authentication » : trois listes, trois intitulés.', ['api-broken-authn', 'asvs-authn']),

  // ── OWASP API Security Top 10 2023 ───────────────────────────────────────
  r('api-bopla', 1, 'api', 'Broken Object Property Level Authorization', 'API3:2023 : mass assignment et exposition excessive des propriétés d’un objet.'),
  r('api-business-flows', 2, 'api', 'Unrestricted Access to Sensitive Business Flows', 'API6:2023. Le sujet recoupe les menaces OAT, mais cet intitulé est celui de l’API Top 10 : un préjudice métier, parfois à faible volume.'),
  r('api-resource', 3, 'api', 'Unrestricted Resource Consumption', 'API4:2023. Le Top 10 LLM dit « Unbounded Consumption », OAT parle de « Denial of Service » : ici, c’est l’épuisement d’une ressource technique par une API.', ['llm-unbounded', 'oat-dos']),
  r('api-inventory', 2, 'api', 'Improper Inventory Management', 'API9:2023. Optus (2022) : une API inutilisée, restée exposée sur un sous-domaine avec un contrôle d’accès cassé depuis 2018, a livré les données de 9,5 millions de clients.'),
  r('api-unsafe-consumption', 1, 'api', 'Unsafe Consumption of APIs', 'API10:2023 : faire trop confiance aux réponses des API tierces.'),
  r('api-bfla', 1, 'api', 'Broken Function Level Authorization', 'API5:2023 : une action interdite à ce rôle, comme une route d’administration.'),
  r('api-bola', 1, 'api', 'Broken Object Level Authorization', 'API1:2023. USPS (2018) : une API permettait à tout utilisateur connecté de consulter les données de comptes d’autres utilisateurs.'),
  r('api-broken-authn', 3, 'api', 'Broken Authentication', 'API2:2023. C’était aussi le titre du Top 10 de 2017 ; l’édition 2025 dit « Authentication Failures ».', ['top10-authn', 'asvs-authn']),
  r('api-ssrf', 3, 'api', 'Server Side Request Forgery', 'API7:2023. Le Top 10 lui consacrait A10 en 2021, mais l’édition 2025 l’a fondue dans A01. Capital One (2019) reste le cas de référence.'),

  // ── OWASP Top 10 CI/CD Security Risks ────────────────────────────────────
  r('cicd-ppe', 1, 'cicd', 'Poisoned Pipeline Execution', 'CICD-SEC-4. Ultralytics (2024) : un workflow pull_request_target a exécuté le contenu d’une PR malveillante, jusqu’à des versions piégées sur PyPI.'),
  r('cicd-flow-control', 2, 'cicd', 'Insufficient Flow Control Mechanisms', 'CICD-SEC-1 : pousser jusqu’en production sans revue ni approbation. Le préfixe « Insufficient » revient souvent dans cette liste.'),
  r('cicd-dependency-chain', 2, 'cicd', 'Dependency Chain Abuse', 'CICD-SEC-3 : dependency confusion, typosquatting, prise de contrôle de paquets. Alex Birsan (2021) a fait installer ses paquets de démonstration chez Apple, Microsoft ou PayPal.'),
  r('cicd-credential-hygiene', 2, 'cicd', 'Insufficient Credential Hygiene', 'CICD-SEC-6. Après l’intrusion de janvier 2023, CircleCI a demandé à tous ses clients de faire tourner les secrets stockés sur sa plateforme.'),
  r('cicd-third-party', 2, 'cicd', 'Ungoverned Usage of 3rd Party Services', 'CICD-SEC-8. En 2022, des jetons OAuth émis pour Heroku et Travis CI ont servi à lire des dépôts privés sur GitHub.'),
  r('cicd-artifact-integrity', 2, 'cicd', 'Improper Artifact Integrity Validation', 'CICD-SEC-9. Codecov (2021) : le script d’upload modifié a été repéré par un client qui a comparé son empreinte à celle publiée.', ['top10-integrity']),
  r('cicd-iam', 3, 'cicd', 'Inadequate Identity and Access Management', 'CICD-SEC-2 : comptes et identités des systèmes du pipeline. L’Agentic Top 10 a « Identity and Privilege Abuse » (ASI03), pour les agents.', ['agentic-identity']),
  r('cicd-pbac', 1, 'cicd', 'Insufficient PBAC (Pipeline-Based Access Controls)', 'CICD-SEC-5 : ce qu’un job de pipeline peut atteindre une fois compromis.'),
  r('cicd-system-config', 3, 'cicd', 'Insecure System Configuration', 'CICD-SEC-7 : configuration des systèmes du pipeline (serveur CI, SCM, registre). Le chapitre ASVS s’appelle « Configuration », sans adjectif.', ['asvs-config']),
  r('cicd-logging', 3, 'cicd', 'Insufficient Logging and Visibility', 'CICD-SEC-10. Le Top 10 dit « Security Logging & Alerting Failures » : même sujet, autre liste, autre intitulé.', ['top10-logging', 'asvs-logging']),

  // ── OWASP Top 10 for LLM Applications 2026 ───────────────────────────────
  r('llm-prompt-injection', 1, 'llm', 'Prompt Injection', 'LLM01, inchangé en 2026 mais élargi au multimodal et à la persistance.', ['top10-injection']),
  r('llm-excessive-agency', 3, 'llm', 'Excessive Agency', 'LLM03:2026, et non l’Agentic Top 10 malgré le mot. L’agent de Replit qui a effacé une base de production (juillet 2025) y avait un accès en écriture, en plein gel du code.'),
  r('llm-hidden-context', 2, 'llm', 'Hidden Context Exposure', 'LLM08:2026, nouveau nom de System Prompt Leakage. En 2023, une simple injection a fait réciter à Bing Chat ses consignes internes et son nom de code, « Sydney ».'),
  r('llm-vector', 1, 'llm', 'Vector and Embedding Weaknesses', 'LLM09:2026 : risques propres au RAG et aux index vectoriels.'),
  r('llm-poisoning', 3, 'llm', 'Data and Model Poisoning', 'LLM05:2026 : les données d’entraînement ou de réglage. La mémoire d’un agent relève d’ASI06. Microsoft Tay (2016), qui apprenait de ses conversations, a été retiré en moins d’une journée après une campagne d’utilisateurs.', ['agentic-memory']),
  r('llm-sensitive-info', 2, 'llm', 'Sensitive Information Disclosure', 'LLM02:2026. Le chapitre ASVS voisin s’appelle « Data Protection ».'),
  r('llm-supply-chain', 3, 'llm', 'Supply Chain', 'LLM04:2026 : modèles, jeux de données, SDK. Sans « Software » ni « Failures », ce n’est pas le Top 10 ; sans « Agentic », ce n’est pas ASI04.', ['top10-supply-chain', 'agentic-supply-chain']),
  r('llm-unbounded', 3, 'llm', 'Unbounded Consumption', 'LLM06:2026 : du trafic conçu pour coûter. L’API Top 10 dit « Unrestricted Resource Consumption ».', ['api-resource', 'oat-dos']),
  r('llm-misinformation', 2, 'llm', 'Misinformation', 'LLM07:2026. Air Canada (2024) a été condamnée à indemniser un client trompé par une politique de remboursement inventée par son chatbot.'),
  r('llm-output-handling', 2, 'llm', 'Improper Output Handling', 'LLM10:2026 : la sortie du modèle traitée comme sûre. EchoLeak (2025) exfiltrait des données de Copilot par une URL d’image générée.'),

  // ── OWASP Top 10 for Agentic Applications 2026 ───────────────────────────
  r('agentic-goal-hijack', 1, 'agentic', 'Agent Goal Hijack', 'ASI01.'),
  r('agentic-tool-misuse', 2, 'agentic', 'Tool Misuse and Exploitation', 'ASI02. Le Top 10 LLM traite les outils sous « Excessive Agency » ; cet intitulé-ci est agentique.'),
  r('agentic-identity', 3, 'agentic', 'Identity & Privilege Abuse', 'ASI03 : l’identité sous laquelle agit l’agent. Le CI/CD a « Inadequate Identity and Access Management » (CICD-SEC-2).', ['cicd-iam']),
  r('agentic-memory', 3, 'agentic', 'Memory & Context Poisoning', 'ASI06. SpAIware (2024) : une page piégée faisait inscrire dans la mémoire de ChatGPT une consigne qui exfiltrait toutes les conversations suivantes.', ['llm-poisoning']),
  r('agentic-inter-agent', 1, 'agentic', 'Insecure Inter-Agent Communication', 'ASI07.'),
  r('agentic-rogue', 1, 'agentic', 'Rogue Agents', 'ASI10.'),
  r('agentic-supply-chain', 1, 'agentic', 'Agentic Supply Chain Vulnerabilities', 'ASI04. En septembre 2025, le paquet npm postmark-mcp s’est mis à copier en BCC chaque e-mail envoyé par les agents qui l’utilisaient.', ['top10-supply-chain', 'llm-supply-chain']),
  r('agentic-code-exec', 3, 'agentic', 'Unexpected Code Execution', 'ASI05 : un outil qui évalue ce qu’écrit le modèle. On pense au Top 10 (Injection), mais l’intitulé est agentique.'),
  r('agentic-cascading', 3, 'agentic', 'Cascading Failures', 'ASI08 : une erreur propagée d’agent en agent. Le suffixe « Failures » évoque le Top 10, qui n’a pas cette catégorie.'),
  r('agentic-trust', 1, 'agentic', 'Human-Agent Trust Exploitation', 'ASI09 : un écran de confirmation rédigé par le modèle qui minimise l’action.'),

  // ── OWASP ASVS 5.0 ───────────────────────────────────────────────────────
  r('asvs-tokens', 2, 'asvs', 'Self-contained Tokens', 'Chapitre V9, nouveau dans ASVS 5.0.'),
  r('asvs-oauth', 1, 'asvs', 'OAuth and OIDC', 'Chapitre V10, nouveau dans ASVS 5.0.'),
  r('asvs-frontend', 2, 'asvs', 'Web Frontend Security', 'Chapitre V3, nouveau dans ASVS 5.0.'),
  r('asvs-logging', 3, 'asvs', 'Security Logging and Error Handling', 'Chapitre V16. Le Top 10 dit « Security Logging & Alerting Failures » : même début, fin différente.', ['top10-logging', 'cicd-logging']),
  r('asvs-webrtc', 1, 'asvs', 'WebRTC', 'Chapitre V17, nouveau dans ASVS 5.0.'),
  r('asvs-encoding', 2, 'asvs', 'Encoding and Sanitization', 'Chapitre V1.'),
  r('asvs-validation', 2, 'asvs', 'Validation and Business Logic', 'Chapitre V2. Le mot « Business » évoque l’API6 de l’API Top 10, mais ici c’est un chapitre d’exigences.'),
  r('asvs-api', 3, 'asvs', 'API and Web Service', 'Chapitre V4. Le mot « API » attire vers l’API Top 10, dont aucun titre ne ressemble à celui-ci.'),
  r('asvs-files', 1, 'asvs', 'File Handling', 'Chapitre V5.'),
  r('asvs-authn', 2, 'asvs', 'Authentication', 'Chapitre V6. Un nom de domaine nu est la marque d’un chapitre ASVS ; les listes de risques disent « Failures » ou « Broken ».', ['top10-authn', 'api-broken-authn']),
  r('asvs-session', 1, 'asvs', 'Session Management', 'Chapitre V7.'),
  r('asvs-authz', 2, 'asvs', 'Authorization', 'Chapitre V8. Le Top 10 dit « Broken Access Control ».'),
  r('asvs-crypto', 2, 'asvs', 'Cryptography', 'Chapitre V11. Le Top 10 dit « Cryptographic Failures ».', ['top10-crypto']),
  r('asvs-comms', 1, 'asvs', 'Secure Communication', 'Chapitre V12.'),
  r('asvs-config', 2, 'asvs', 'Configuration', 'Chapitre V13. Le CI/CD dit « Insecure System Configuration ».', ['cicd-system-config']),
  r('asvs-data-protection', 2, 'asvs', 'Data Protection', 'Chapitre V14.'),
  r('asvs-secure-coding', 2, 'asvs', 'Secure Coding and Architecture', 'Chapitre V15. Le Top 10 parle de « Insecure Design ».'),

  // ── OWASP Automated Threats (OAT) ────────────────────────────────────────
  r('oat-credential-stuffing', 3, 'oat', 'Credential Stuffing', 'OAT-008. Le Top 10 en parle dans A07, mais ce n’est pas un de ses titres. 23andMe (2023) : environ 14 000 comptes pris par stuffing, et par eux les profils de près de 7 millions d’utilisateurs.'),
  r('oat-credential-cracking', 2, 'oat', 'Credential Cracking', 'OAT-007 : deviner le mot de passe d’un compte précis. Le stuffing (OAT-008) fait l’inverse.'),
  r('oat-scalping', 1, 'oat', 'Scalping', 'OAT-005 : rafler des biens en quantité limitée pour les revendre. Ticketmaster a mis en cause des bots lors de la prévente de l’Eras Tour (2022).'),
  r('oat-scraping', 2, 'oat', 'Scraping', 'OAT-011. Facebook (2021) : 533 millions de profils aspirés par l’outil d’import de contacts, avant sa correction en 2019.'),
  r('oat-dos', 3, 'oat', 'Denial of Service', 'OAT-015. Le Top 10:2025 n’a pas cette catégorie ; l’API Top 10 dit « Unrestricted Resource Consumption ».', ['api-resource', 'llm-unbounded']),
  r('oat-account-creation', 2, 'oat', 'Account Creation', 'OAT-019 : créer des comptes en masse pour abuser des fonctions gratuites.'),
  r('oat-token-cracking', 3, 'oat', 'Token Cracking', 'OAT-002 : énumérer des codes promo ou de parrainage. Rien à voir avec les jetons autoporteurs du chapitre ASVS V9.'),
  r('oat-carding', 1, 'oat', 'Carding', 'OAT-001 : tester des cartes volées par petits paiements.'),
  r('oat-captcha', 1, 'oat', 'CAPTCHA Defeat', 'OAT-009.'),
  r('oat-vuln-scanning', 2, 'oat', 'Vulnerability Scanning', 'OAT-014 : un automate qui cherche des failles connues. Vu du défenseur, c’est une menace, pas un outil.'),
  r('oat-spamming', 1, 'oat', 'Spamming', 'OAT-017 : du contenu non sollicité envoyé par la plateforme, comme de fausses factures.'),
  r('oat-sniping', 1, 'oat', 'Sniping', 'OAT-013 : agir à la dernière seconde, comme une enchère emportée in extremis.'),
  r('oat-aggregation', 2, 'oat', 'Account Aggregation', 'OAT-020 : un agrégateur qui se connecte avec les identifiants de tes clients. Pas forcément hostile, c’est une décision produit.'),
  r('oat-expediting', 2, 'oat', 'Expediting', 'OAT-006 : enchaîner plus vite qu’un humain des étapes normalement lentes.'),
  r('oat-cashing-out', 1, 'oat', 'Cashing Out', 'OAT-012 : convertir en argent ou en biens des comptes ou des cartes compromis.'),
];

// ── Les séries ──────────────────────────────────────────────────────────────

const mix = (n1: number, n2: number, n3: number): [number, number, number] => [n1, n2, n3];

const PROFILES: SeriesProfile<RefItem>[] = [
  { id: 'decouverte', title: 'Découverte', mix: mix(12, 0, 0), level: 1,
    text: 'Chaque intitulé contient le mot qui trahit sa liste. On apprend les sept référentiels.' },
  { id: 'echauffement', title: 'Échauffement', mix: mix(8, 4, 0), level: 1,
    text: 'Quatre intitulés sans mot-clé se glissent dans le lot : il faut reconnaître la manière de nommer.' },
  { id: 'conventions', title: 'Conventions de nommage', mix: mix(0, 12, 0), level: 2,
    text: '« Failures » pour le Top 10, « Insufficient » pour le CI/CD, un nom nu pour l’ASVS : rien d’autre pour trancher.' },
  { id: 'llm-ou-agent', title: 'LLM ou agent ?', filter: (it) => it.ref === 'llm' || it.ref === 'agentic', mix: mix(2, 5, 5), level: 2,
    text: 'Deux listes d’OWASP sur l’IA, des sujets qui se recouvrent : outils, mémoire, empoisonnement, chaîne d’approvisionnement.' },
  { id: 'transition', title: 'Transition', mix: mix(3, 5, 4), level: 2,
    text: 'Les trois niveaux mêlés. Un tiers des intitulés ont un sosie dans une autre liste.' },
  { id: 'sosies', title: 'Sosies', mix: mix(0, 5, 7), level: 3,
    text: 'Majorité de quasi-homonymes : le même sujet existe ailleurs sous un intitulé presque identique.' },
  { id: 'faux-amis', title: 'Faux amis', mix: mix(0, 0, 12), level: 3,
    text: 'Que du niveau 3 : l’intitulé évoque une autre liste que la sienne. Seul le mot exact décide.' },
  { id: 'melee', title: 'Mêlée', mix: mix(4, 4, 4), level: 2, shuffleEachTime: true,
    text: 'Tous niveaux confondus, recomposée à chaque partie.' },
];

export const refSeries = defineSeries(refItems, PROFILES);

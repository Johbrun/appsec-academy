# AppSec Academy : programme de formation

> Cahier des charges du site. Même design et même stack que ATT&CK SaaS Academy (Vite + React + TS, XP, badges, jeux, examen, certificat).
> Dernière mise à jour des sources : 27/09/2026.

## Décisions validées

| # | Décision |
| --- | --- |
| 1 | Référence IA : **OWASP LLM Top 10 2026**, avec la correspondance 2025 affichée. |
| 2 | La pratique s'appuie sur des **labs reconnus** (PortSwigger, Juice Shop, CI/CD Goat, flAWS, CloudGoat…), qui restent la pratique principale. **Amendée le 28/09/2026** : s'y ajoute **Novafact Lab** (dossier `lab/`), l'application fil rouge rendue exécutable et vulnérable, pour le geste que les labs externes couvrent mal ici — corriger dans du code Express/React qu'on possède, et le prouver par un test de régression (voir §9). |
| 3 | Contenu des leçons en **MDX**. |
| 4 | SIEM des labs : **Elastic** (Elastic Security, Kibana, Elastic Agent). |
| 5 | Les **8 domaines du CSSLP** servent de grille de couverture (voir §4). |
| 6 | *Designing Secure Software* (Loren Kohnfelder, No Starch, 2021) est intégré comme ouvrage de référence pour la conception (voir §5). Le contenu est reformulé et référencé par chapitre, jamais recopié. |
| 7 | Quatre modules ajoutés : **Sécurité côté client et scripts tiers** (M4), **Faire adopter la sécurité** (M6), **Anti-abus, prise de contrôle de comptes et fraude** (M10), **Revue de code sécurité** (M12). |

---

## 1. Positionnement

**Public** : pentester web + développeur. On ne réexplique pas ce qu'est une XSS, une SQLi ou un JWT.

**Le fil conducteur** : passer de *celui qui trouve un bug* à *celui qui fait disparaître une classe de bugs, à l'échelle, sans bloquer les devs*. Chaque leçon répond à trois questions :

1. **Ce que tu sais déjà** (côté offensif) : 3 lignes, repliables.
2. **Ce qui change côté AppSec** : cause racine, contrôle qui élimine la classe, outil qui la détecte, règle Elastic qui la voit en prod.
3. **Dans le code** : extrait Express / React / Next / Terraform / GitHub Actions *vulnérable → corrigé*, avec le payload qui casse le mauvais correctif. Les extraits illustrent Novafact.

**Écosystème** : Node.js, Express, React, Next.js (App Router, RSC), npm/pnpm, TypeScript, Prisma, AWS CDK, GitHub Actions. Un seul cloud : AWS.

### Application fil rouge : **Novafact** (fictive, `novafact.example`)

Un SaaS de facturation multi-tenant, réutilisé dans tous les modules :

| Couche | Techno |
| --- | --- |
| Front | React (Vite) + back-office Next.js (RSC, Server Actions, cache) |
| API | Express + MongoDB (factures) + PostgreSQL via Prisma (comptes), GraphQL interne, webhooks |
| Auth | OIDC (Cognito), SPA via un BFF, API en JWT, SSO SAML pour les clients entreprise |
| Paiement | Page de paiement qui embarque l'iframe d'un prestataire externe (périmètre PCI DSS réduit), montants et TVA calculés côté serveur |
| E-mail | Envoi des factures aux clients finaux via Amazon SES, depuis le domaine de Novafact |
| Front tiers | Tag manager, analytics, widget de chat |
| IA | Assistant « Ask Novafact » : RAG sur les factures + outils (envoyer un e-mail, créer un avoir), serveur MCP interne |
| Infra | AWS : CloudFront + WAF, ALB, ECS Fargate, Lambda, S3, RDS, Secrets Manager, AWS Backup. IaC en CDK (TS) et Terraform |
| CI/CD | GitHub Actions, OIDC vers AWS, publication d'un SDK npm `@novafact/sdk` |
| Détection | Logs pino + CloudTrail + WAF → Elastic |

Novafact a aussi un **document de conception** (modèle de l'annexe A de Kohnfelder) qui sert de support aux revues de conception et au threat modeling.

### Niveaux

| Niveau | Nom | Attendu |
| --- | --- | --- |
| N1 | **Opérationnel** | Tu appliques les référentiels et outils correctement sur un projet. |
| N2 | **Avancé** | Tu écris tes propres règles, tu arbitres, tu conçois les contrôles. |
| N3 | **Expert** | Tu conçois le programme, tu gères la crise, tu raisonnes sur les cas limites et la recherche récente. |

---

## 2. Architecture du parcours

5 blocs, 20 modules, ~150 leçons, 29 jeux. Estimation : **130 à 150 h** de cours, **250 h+** avec les labs.

```text
Bloc A · Le métier            M1 Programme AppSec & DevSecOps · M2 Vulnérabilités web JS · M3 Web avancé (PortSwigger)
                              M4 Côté client & scripts tiers · M5 Gestion des vulnérabilités · M6 Faire adopter la sécurité
Bloc B · Concevoir            M7 Fondations, exigences & vie privée · M8 Conception sécurisée & architecture · M9 OAuth / OIDC / SAML
                              M10 Anti-abus, ATO & fraude · M11 Threat modeling & MITRE
Bloc C · Vérifier & outiller  M12 Revue de code sécurité · M13 Tests & analyse de code (SAST/DAST/SCA/SBOM/IA) · M14 Pipeline, supply chain & fournisseurs
Bloc D · Cloud & production   M15 IAM AWS · M16 IaC · M17 Déploiement, exploitation & résilience · M18 Surveillance & SIEM (Elastic)
Bloc E · Continu              M19 Sécurité de l'IA (veille datée)
Capstone                      M20 Revue de sécurité complète de Novafact
```

Ordre conseillé : A → B → C → D, M19 en parallèle dès le bloc B. M6 (adoption) se lit aussi bien au début qu'à la fin : il prend tout son sens une fois les contrôles connus. Tout reste accessible, le site suggère le prochain module. Chaque leçon affiche ses étiquettes **CSSLP** (D1 à D8) et, le cas échéant, **Kohnfelder** (chapitre).

---

## 3. Programme détaillé

Chaque leçon liste ses **labs** (PortSwigger, Juice Shop, CI/CD Goat…) et ses **sources primaires**. La bibliothèque complète est au §8. Entre crochets : domaines CSSLP et chapitres Kohnfelder (K1 à K13).

### Bloc A · Le métier

#### M1 · Programme AppSec & DevSecOps

| Niv. | Leçon |
| --- | --- |
| N1 | Du pentest à l'AppSec : échelle, classes de bugs, relation aux devs, ROI. « La sécurité est l'affaire de tous » (Kohnfelder, postface). Carte des référentiels et de leur usage (Top 10 = sensibiliser, ASVS = exiger/vérifier, SAMM = piloter, BSIMM = se comparer, DSOMM = piloter un pipeline, SSDF = conformité, CRA = réglementation). [D2] |
| N1 | Principes DevSecOps : shift left *et* shift right, paved road (Netflix), secure by default, *safe coding* (Google : éliminer les classes de bugs par les API et frameworks), garde-fous plutôt que barrières. [D2] |
| N2 | **OWASP SAMM v2** : 5 fonctions, 15 pratiques, 2 streams, 3 niveaux. Mener une évaluation (SAMM Toolbox). [D2] |
| N2 | **BSIMM16** (janv. 2026, 111 organisations) : modèle descriptif vs SAMM prescriptif. Ce que font vraiment les programmes matures, et la montée de l'IA et des SBOM. SAFECode *Fundamental Practices*. [D2] |
| N2 | Jalons et critères *break/build* : où placer les portes de contrôle, qui peut accorder une exception. Documentation de sécurité et reporting (tableaux de bord, boucles de feedback). [D2] |
| N2 | Métriques : MTTR par criticité, taux d'échappement, couverture, KPI et OKR, expérience développeur. OWASP DSOMM. Le volet humain (champions, formation, négociation) est traité en M6. [D2] |
| N3 | Gestion des risques intégrée : risque technique vs risque métier, analyse et appréciation, acceptation formelle et *sign-off* au bon niveau. NIST SSDF (SP 800-218), CISA Secure by Design. [D2, D7] |
| N3 | **EU Cyber Resilience Act** : signalement obligatoire depuis le 11/09/2026 (alerte 24 h, notification 72 h, rapport 14 j via la plateforme unique ENISA). Construire une roadmap à 12 mois. [D2] |

#### M2 · Vulnérabilités web, écosystème JS (angle défenseur)

| Niv. | Leçon |
| --- | --- |
| N1 | Rappel éclair : **OWASP Top 10:2025** (A03 Software Supply Chain Failures, A10 Mishandling of Exceptional Conditions, SSRF intégrée à A01), **API Security Top 10 2023**, CWE Top 25. [D5] |
| N1 | Entrées non fiables (K10) : définir la validité, rejeter ou corriger, longueur et Unicode. Express : SQLi via query builders et ORM (`knex.raw`, `sequelize.literal`, `$queryRawUnsafe`), **injection NoSQL**, mass assignment, BOLA/BFLA. Validation par schéma (zod, ajv) intégrée au framework pour qu'on ne puisse pas l'oublier. [D5] |
| N1 | **Footguns JavaScript** (K8) : `==`, `parseInt`, tri par défaut, `Date` permissif, clés d'objet, `Number` et la limite 2^53. **Arithmétique et argent** (K9) : montants en flottants, arrondis, quantités négatives, dépassements. Chez Novafact : centimes entiers, `BigInt` ou décimal, calcul côté serveur. [D5] |
| N2 | Spécificités Node : **prototype pollution** serveur, **ReDoS** et boucle d'événements, path traversal (`join` vs `resolve`), SSRF (IMDS, DNS rebinding), SSTI, `vm`/`vm2` ne sont pas des bacs à sable, `exec` vs `execFile`, `url.parse` vs WHATWG `URL`. Le **modèle de menaces officiel de Node.js**. [D5] |
| N2 | Erreurs et exceptions (A10, K13) : promesses non gérées, échec sûr, messages d'erreur qui fuient, état incohérent après exception. **Atomicité et TOCTOU**, attaques temporelles (`crypto.timingSafeEqual`), sérialisation (K8). [D5] |
| N2 | React et navigateur (K11) : modèle de sécurité web (SOP, cookies), sinks XSS (`dangerouslySetInnerHTML`, `href="javascript:"`, rendu Markdown), DOMPurify, stockage des jetons, CSRF et SameSite, CORS, `postMessage`. S'appuyer sur le framework plutôt que le contourner. Les défenses navigateur (Trusted Types, CSP, Sanitizer API) et les scripts tiers sont approfondis en M4. [D4, D5] |
| N3 | Méta-frameworks : Server Actions = endpoints publics, **CVE-2025-29927** (middleware Next.js), **CVE-2024-34351** (SSRF via Host dans les Server Actions), **React2Shell CVE-2025-55182** (désérialisation Flight, CVSS 10). La doc Next.js « How to think about security ». [D5] |
| N3 | Éliminer une classe entière : wrappers sûrs, règles ESLint (`eslint-plugin-security`, `no-unsanitized`), sécurité déclarative vs impérative, *paved roads*. [D5] |

#### M3 · Web avancé : le programme PortSwigger (N3)

Les sujets « Advanced » de la Web Security Academy et la recherche 2023-2026, relus avec deux questions : *pourquoi l'architecture le permet* et *quel contrôle ou quelle détection le rend impossible chez Novafact*. Labs Practitioner et Expert uniquement (voir §6).

| Niv. | Leçon |
| --- | --- |
| N2 | **Race conditions** : single-packet attack (*Smashing the state machine*, 2023), limit overrun, multi-endpoint, partial construction. En Node, un `await` entre la vérification et l'action suffit. Correctifs : contraintes uniques, transactions, `SELECT … FOR UPDATE`, opérations atomiques Mongo, clés d'idempotence. Cas : *Eclipse on Next.js* (zhero). [D5] |
| N2 | **HTTP Host header** : empoisonnement de reset de mot de passe, `trust proxy` et `X-Forwarded-Host` dans Express, SSRF par routage. Correctif : URL absolues issues de la config, liste blanche d'hôtes. |
| N2 | **API avancée et GraphQL** : server-side parameter pollution, mass assignment, brute force par batching/alias, contournement d'introspection, limites de profondeur et de coût. |
| N2 | **Chaînes de vulnérabilités** (K8, *vulnerability chains*) : des bugs mineurs qui, combinés, deviennent critiques. Ce que ça change pour le triage (M5) et la revue de conception (M8). |
| N3 | **Request smuggling et desync** : CL.TE, TE.CL, rétrogradation H2, client-side desync, pause-based, **0.CL et Expect** (*HTTP/1.1 must die*, 2025), **CRLF-powered desync** (2026). Côté Novafact : llhttp strict, mode *desync mitigation* de l'ALB, HTTP/2 de bout en bout. |
| N3 | **Web cache poisoning et deception** : entrées hors clé, parameter cloaking, fat GET, divergences de normalisation (*Gotta cache 'em all*, 2024). Série Next.js de Rachid Allam : CVE-2024-46982, CVE-2025-49826, *the stale elixir* (Top 10 2025, n° 7). Correctif : politiques de cache CloudFront, `Cache-Control: private`, clés de cache conçues. |
| N3 | **Parser differentials** : normalisation Unicode (*Lost in Translation*, Top 10 2025), *Splitting the email atom* (2024), JSON à clés dupliquées, parsers d'URL, cookies (*phantom $Version*), *Parser Differentials* (joernchen, Top 10 2025). **Fuite via ORM** (*ORM Leaking More Than You Joined For*, Top 10 2025, n° 2) appliquée aux filtres Prisma. |
| N3 | **SSTI et injection de code** : SSTI aveugle par erreurs (*Successful Errors*, Top 10 2025, n° 1), évasions de bac à sable JS, la mort de `vm2`. Correctif : isolation par processus ou `isolated-vm`, templates sans logique. |
| N3 | **Désérialisation et prototype pollution avancées** : `node-serialize`, `js-yaml` ancien, Flight (React2Shell). Détection non destructive (Heyes, 2023), gadgets (*Silent Spring* 2023, *GHunter* 2024). Correctif : `Object.create(null)`, `Map`, `--disable-proto`, schémas stricts. |
| N3 | **Protocoles d'auth avancés** : JWT (`jwk`/`jku`/`kid`, confusion d'algorithme), OAuth *dirty dancing* (Frans Rosén), **SAML** : *SAML roulette*, *The Fragile Lock* (PortSwigger, 2025), **SAMLStorm** (xml-crypto, CVE-2025-29775). Pont vers M9. |
| N3 | **SSRF avancée** : boucles de redirection (Top 10 2025, n° 3), DNS rebinding, HTTP/2 CONNECT (Top 10 2025, n° 9), SSRF dans Next.js (Assetnote). Correctif : egress proxy, IMDSv2, filtrage après résolution. |
| N3 | **Client avancé** : DOM Invader, DOM clobbering, contournements de CSP (script gadgets, dangling markup), **XS-Leaks** (xsleaks.dev, *ETag length leak* et *XSS-Leak*, Top 10 2025), CSWSH, *CSS: the bomb inside your inbox* et *What's in a tag name?* (PortSwigger, 2026). |
| N3 | **Web LLM attacks** (sujet Academy), approfondi en M19. *Meet the HTTP Terminator* (Kettle, 2026) : une IA qui invente des variantes de desync, et ce que ça change pour la défense. |

#### M4 · Sécurité côté client & scripts tiers

Le navigateur exécute ton code et celui des autres, avec les mêmes droits. Le sujet est propre à l'écosystème JS et touche directement la page de paiement de Novafact.

| Niv. | Leçon |
| --- | --- |
| N1 | Le client n'est pas sous ton contrôle : validation côté client = confort, pas sécurité. Secrets exposés dans le bundle (`VITE_*`, `NEXT_PUBLIC_*`), source maps en production, clés d'API dans le JS. [D5] |
| N1 | **Scripts tiers** : analytics, chat, tag manager, A/B testing, CDN. Un script tiers a les droits de ton code (l'anti-pattern *third-party hooks*, K4). Cas : British Airways et Ticketmaster (Magecart, 2018), polyfill.io (domaine racheté, 2024). [D4, D8] |
| N2 | Réduire la confiance : inventaire et propriétaire de chaque script, auto-hébergement, SRI et ses limites, iframes en `sandbox` avec `allow` minimal, tag manager sous contrôle, `Permissions-Policy`. Isoler le paiement dans l'iframe du prestataire. [D4, D5] |
| N2 | **CSP stricte en pratique** pour React, Vite et Next (nonce, `strict-dynamic`, hashes pour une SPA statique), déploiement *report-only* puis bloquant, Reporting API. La CSP comme **capteur** : les rapports envoyés vers Elastic. [D5, D7] |
| N2 | Défenses DOM modernes : **Trusted Types** (politique par défaut, intégration React), **Sanitizer API** et `setHTML()` (Firefox 148 le premier, en février 2026 ; support encore partiel), DOMPurify en repli. [D5] |
| N2 | Isolation d'origine : **Fetch Metadata** (`Sec-Fetch-*`) et *resource isolation policy* dans Express, COOP/COEP/CORP, cookies `__Host-` et partitionnés, XS-Leaks vus côté défense. Service workers : portée, cache, persistance d'une XSS. [D5] |
| N3 | **PCI DSS 4.0.1** : exigences 6.4.3 (inventaire, autorisation et intégrité des scripts de la page de paiement) et 11.6.1 (détection de modification des scripts et en-têtes), obligatoires depuis le 31/03/2025. Depuis janvier 2025, elles sont retirées du SAQ A au profit d'un critère d'éligibilité : la page qui embarque l'iframe du prestataire ne doit pas être exposée aux attaques par script. Ce que ça impose à Novafact. [D3, D7] |
| N3 | Surveiller le client : détection de changement de scripts (empreintes, rapports CSP, outils de protection côté client), réponse à un skimmer (retrait, investigation, notification), supply chain du front (lockfile, bundle, CDN). [D7, D8] |

#### M5 · Gestion des vulnérabilités

| Niv. | Leçon |
| --- | --- |
| N1 | Cycle de vie : découverte → dédoublonnage → triage → priorisation → correction → vérification → reporting. Défauts, erreurs et vulnérabilités dans le même bug tracker. [D6, D7] |
| N1 | CVSS 4.0 (Base / Threat / Environmental / Supplemental) : pourquoi le score de base ne suffit pas. [D6] |
| N2 | Prioriser par le risque : **EPSS**, **CISA KEV**, **SSVC**, atteignabilité, exposition. **VEX** pour déclarer « non affecté ». Débat : DREAD (K13) vs CVSS vs SSVC. Kohnfelder rappelle qu'on sous-estime plus souvent qu'on ne surestime. [D6, D7] |
| N2 | **Faut-il un exploit pour faire corriger ?** Kohnfelder soutient que rarement, et qu'un test de régression qui déclenche le bug suffit. Confronter cette position à ta pratique de pentester et savoir quand la PoC vaut l'effort. [D6] |
| N2 | Outillage : DefectDojo, Dependency-Track, SLA, exceptions et acceptation du risque. Côté npm : limites de `npm audit`, GHSA/OSV/deps.dev, `overrides`, que faire sans correctif. Gestion des correctifs : tester, publier, vérifier. [D7] |
| N3 | Divulgation : VDP, `security.txt` (RFC 9116), concevoir un bug bounty, écosystème CVE/NVD (crise 2024-2025), EUVD d'ENISA, GCVE, obligations CRA. [D6, D7, D8] |
| N3 | Gérer une critique à J+0 : React2Shell comme cas (inventaire via SBOM, virtual patching WAF, correctif, chasse aux IOC dans Elastic, communication, signalement CRA). [D7] |

#### M6 · Faire adopter la sécurité

Le module de la reconversion : les contrôles ne valent rien s'ils ne sont pas adoptés. C'est aussi là que ton expérience de pentester devient un atout plutôt qu'un réflexe d'auditeur.

| Niv. | Leçon |
| --- | --- |
| N1 | Le rôle : l'AppSec comme *enabling team* (Team Topologies), de l'auditeur au partenaire. Ce qui change quand on passe du rapport de pentest au backlog d'une équipe produit. [D2] |
| N1 | **Écrire un finding qui sera corrigé** : titre orienté impact, reproduction minimale, correctif dans le code et le style de l'équipe, test de régression fourni, priorité justifiée. Une PR de correctif vaut mieux qu'un PDF. [D2, D6] |
| N2 | **Négocier avec le produit** : SLA, dette de sécurité, exceptions à durée limitée, arbitrage par le risque métier. Gérer le désaccord et l'escalade (K7) : le designer a le dernier mot, les positions divergentes sont documentées. [D2] |
| N2 | **Parler aux dirigeants** : traduire en risque métier, quantifier (FAIR), tableaux de bord utiles plutôt que métriques de vanité, rendre compte du programme. [D2] |
| N2 | **Security Champions** : recruter, animer, reconnaître, mesurer (OWASP Security Champions Guide). Répartir les rôles entre AppSec, champions et équipes. [D2] |
| N2 | **Former au code sécurisé** : partir des bugs réels de l'entreprise, formats courts, CTF internes, labs Juice Shop, mesure de l'effet sur les findings suivants. [D2] |
| N2 | **Le paved road comme produit** : expérience développeur, templates (`create-novafact-service`), documentation, adoption mesurée. Rendre le chemin sûr plus facile que l'autre. *Security Chaos Engineering* (Shortridge). [D2] |
| N3 | **Piloter la sécurité offensive côté client** : cadrer un pentest (périmètre, boîte blanche ou noire, comptes, données), choisir un prestataire (qualification PASSI, CREST), exploiter le rapport, retests. Pentest, bug bounty ou red team : lequel, quand. Tu connais l'autre côté : ce qu'un bon client fournit. [D6, D8] |

### Bloc B · Concevoir

#### M7 · Fondations, exigences & vie privée

Le module qui couvre le domaine « exigences » du CSSLP (13 %) et les fondations de Kohnfelder (K1).

| Niv. | Leçon |
| --- | --- |
| N1 | **Confiance** (K1) : la confiance est un spectre, les composants implicitement fiables (OS, runtime Node, registre npm, cloud), réduire le nombre de parties à qui on fait confiance, être digne de confiance. [D1] |
| N1 | **C-I-A et le Gold Standard** (K1) : authentification, autorisation, audit. Non-répudiation, responsabilité. Ce que chaque propriété exige concrètement de Novafact. [D1] |
| N1 | Exigences de sécurité : fonctionnelles (stories, use cases) et non fonctionnelles (performance, continuité, déploiement). Les tirer d'ASVS 5.0 (niveaux L1–L3, 17 chapitres). **Misuse et abuse cases**, avec le contrôle qui les neutralise. [D3] |
| N2 | **Matrice de traçabilité des exigences** (SRTM) : exigence → conception → code → test → preuve. La tenir dans le dépôt (ASVS ID dans les tests). [D3, D6] |
| N2 | **Classification des données** : propriétaire, dépositaire, dictionnaire de données, étiquetage par sensibilité et impact, cycle de vie (création, stockage, rétention, destruction). Cartographier les données de Novafact (factures, IBAN, données personnelles, secrets). [D3] |
| N2 | **Vie privée** : RGPD (minimisation, base légale, droits des personnes dont l'effacement, durées de conservation), pseudonymisation vs anonymisation, transferts hors UE et résidence des données, *privacy by design* (K1, K2, K6). LINDDUN en pont vers M11. [D3] |
| N2 | Conformité : réglementaire (RGPD, NIS2, CRA), sectorielle (**PCI DSS 4.0.1** pour le paiement, périmètre réduit par tokenisation), interne (standards, outils imposés). Exigences envers les fournisseurs tiers. [D3, D8] |
| N3 | Provisionnement des accès : comptes utilisateurs, comptes de service, recertification périodique, départs. Du besoin métier à la politique IAM (pont vers M15). [D3] |

#### M8 · Conception sécurisée & architecture

Le cœur de *Designing Secure Software* (K3 à K7), appliqué à Novafact.

| Niv. | Leçon |
| --- | --- |
| N1 | **Mitigations structurelles** (K3) : réduire la surface d'attaque, **réduire la fenêtre de vulnérabilité** (le code à haute confiance fait le minimum et rend la main), **minimiser l'exposition des données** (durée de vie des secrets en mémoire, suppression réelle). Politiques d'accès, interfaces, communication, stockage. [D1, D4] |
| N1 | **Les 14 patterns de Kohnfelder** (K4), regroupés : attributs de conception (économie, transparence), minimisation de l'exposition (moindre privilège, moindre information, sûr par défaut, listes blanches, imprévisibilité, échec sûr), application stricte (médiation complète, mécanisme le moins commun), redondance (défense en profondeur, séparation des privilèges), confiance et responsabilité (réticence à faire confiance, assumer sa part). Correspondance avec Saltzer & Schroeder et les principes du CSSLP (conception ouverte, acceptabilité psychologique, réutilisation de composants). [D1] |
| N1 | **Les 4 anti-patterns** (K4) en version JS/cloud : *confused deputy* (un endpoint qui agit avec ses droits pour le compte de l'appelant, un serveur MCP), *backflow of trust* (un runner CI peu fiable qui pilote la prod, un poste perso qui administre), *third-party hooks* (scripts tiers dans le front, polyfill.io), *unpatchable components* (paquet npm abandonné, Node en fin de vie, code vendorisé). [D4] |
| N2 | **Écrire un design doc sécurisé** (K6, annexe A) : rendre les hypothèses explicites, définir le périmètre et les non-objectifs, exigences, threat model, conception des interfaces et du traitement des données, vie privée, tout le cycle de vie, compromis, simplicité. Exercice : le design doc de l'export comptable de Novafact. [D2, D4] |
| N2 | **Mener une Security Design Review** (K7) : Study, Inquire, Identify, Collaborate, Write, Follow up. Où creuser, priorisation *Must / Ought / Should*, revue des évolutions, gérer le désaccord et l'escalade. Le designer a le dernier mot : documenter les positions divergentes. [D4] |
| N2 | Authentification applicative : sessions vs jetons, argon2id, **passkeys/WebAuthn** (SimpleWebAuthn), flux de réinitialisation, limitation de débit, énumération. NIST SP 800-63-4. Acceptabilité psychologique. [D1, D5] |
| N2 | Autorisation : RBAC / ABAC / ReBAC (et DAC/MAC pour le vocabulaire CSSLP), moteur de politiques (OPA, **Cedar** / Verified Permissions, OpenFGA), isolation multi-tenant (RLS PostgreSQL), middleware anti-BOLA. [D5] |
| N2 | **Crypto pour développeurs** (K5) : CSPRNG (`crypto.randomUUID`, jamais `Math.random`), MAC et rejeu (webhooks signés avec horodatage), chiffrement symétrique et asymétrique, signatures, certificats, échange de clés. `node:crypto` et WebCrypto, KMS, chiffrement d'enveloppe, **agilité cryptographique**, rotation. Envelopper une API crypto pour la rendre difficile à mal utiliser (exercice K5). [D1, D5] |
| N3 | Conception d'interfaces : interfaces d'administration et hors bande, interfaces de logs, dépendances amont/aval (clés et données partagées), choix de protocoles et gestion d'état. Sécurité des bases (vues, privilèges, connexions chiffrées). [D4] |
| N3 | Patterns d'architecture : API gateway, BFF, microservices et messages (files, événements), authentification service à service (mTLS, identité de workload), pipeline d'upload isolé, **tokenisation**, isolation (bacs à sable, conteneurs). Modéliser les propriétés non fonctionnelles, architecture opérationnelle (topologie, CI/CD). [D4, D5] |

#### M9 · OAuth 2.x / OIDC / SAML

| Niv. | Leçon |
| --- | --- |
| N1 | Ce qui est mort (implicit, ROPC) et **OAuth 2.1**. Authorization Code + PKCE pas à pas : `state`, `nonce`, `redirect_uri` exact. Identité fédérée et SSO. [D1] |
| N2 | SPA React : **RFC 10017** *OAuth 2.0 for Browser-Based Applications* (BCP, août 2026). BFF vs token-mediating backend vs client navigateur pur, rotation des refresh tokens, où ne pas stocker les jetons. [D5] |
| N2 | Valider un JWT dans Express (`jose`) : `alg`, `iss`, `aud`, `exp`, JWKS/`kid`, confusion d'algorithme. Access token ≠ ID token. Opaque + introspection. RFC 8725 (JWT BCP). |
| N2 | Attaques : interception de code, `redirect_uri` + open redirect, mix-up, login CSRF, fuite par Referer/logs, *dirty dancing*, consent phishing (lien avec ATT&CK SaaS T1528/T1671), claim `email` non vérifié (nOAuth). |
| N3 | **RFC 9700** (Security BCP, janv. 2025), jetons liés (**DPoP** RFC 9449, mTLS RFC 8705), PAR (RFC 9126), RAR (RFC 9396), FAPI 2.0, token exchange (RFC 8693) pour microservices et agents. Autorisation MCP. |
| N3 | **SAML** pour le SSO entreprise : signature wrapping, parsers XML divergents, SAMLStorm (xml-crypto), *The Fragile Lock*. Choisir et durcir une librairie Node (`@node-saml/node-saml`). Gestion des certificats X.509. Pièges Cognito / Auth0 / Keycloak. [D4] |

#### M10 · Anti-abus, prise de contrôle de comptes & fraude

Tout ce qui est « fonctionnellement correct » mais utilisé contre toi. Frontière entre AppSec et Trust & Safety, et vrai risque métier pour un SaaS qui envoie des factures.

| Niv. | Leçon |
| --- | --- |
| N1 | Taxonomie : **OWASP Automated Threats to Web Applications** (OAT-001 à OAT-021 : credential stuffing, credential cracking, création de comptes, scraping…) et **API6:2023** *Unrestricted Access to Sensitive Business Flows*. [D3, D4] |
| N1 | **Credential stuffing et ATO** : signaux, défense en couches (MFA et passkeys, mots de passe compromis via Pwned Passwords et k-anonymat, limitation des échecs selon NIST SP 800-63B, notification de connexion, révocation de sessions). [D5] |
| N2 | **Limitation de débit bien conçue** : quoi limiter (compte, IP, tenant, empreinte), algorithmes (token bucket, fenêtre glissante), `express-rate-limit` + Redis, vraie IP derrière CloudFront, réponses graduées (429, ralentissement, défi). Éviter que le verrouillage de compte devienne une arme de DoS. [D4, D5] |
| N2 | **Bots** : CAPTCHA et alternatives (Cloudflare Turnstile, défis invisibles), **AWS WAF Bot Control et Fraud Control** (ATP pour la connexion, ACFP pour l'inscription), empreinte d'appareil et ses limites RGPD. [D7] |
| N2 | **Abus de fonctionnalités** : l'envoi de factures de Novafact détourné pour du phishing depuis un domaine légitime, comme avec QuickBooks et PayPal (+36,5 % d'attaques via le domaine QuickBooks en 2025 selon KnowBe4). Contrôles : vérification des nouveaux comptes, quotas d'envoi, réputation, analyse du contenu, SPF/DKIM/DMARC, canal de signalement. Abus d'essais gratuits, de coupons, de parrainage. [D3, D4] |
| N2 | **Invariants métier** : montants, états d'une facture, avoirs, remboursements. Machines à états côté serveur, idempotence des paiements, rapprochement. Ponts vers les race conditions (M3) et l'arithmétique (M2). [D4, D5] |
| N3 | Détecter et répondre : signaux dans Elastic (vélocité, nouvel appareil, voyage impossible, séquences EQL), score de risque et authentification adaptative (*step-up*), boucle avec le support client, suspension et preuve. [D7] |

#### M11 · Threat modeling & MITRE

| Niv. | Leçon |
| --- | --- |
| N1 | Les 4 questions (Shostack, K2), Threat Modeling Manifesto. La démarche de Kohnfelder : partir d'un modèle, identifier actifs, surfaces d'attaque, frontières de confiance, menaces, mitigations. [D4] |
| N1 | STRIDE par élément (et la propriété que chaque menace viole), abuse cases, jeux de cartes (Elevation of Privilege, OWASP Cornucopia). [D4] |
| N2 | Arbres d'attaque, PASTA, Hybrid Threat Modeling Method, LINDDUN (vie privée) : choisir la méthode. Prioriser sans DREAD. Menaces courantes : APT, initié malveillant, fournisseurs tiers. [D4] |
| N2 | MITRE pour l'AppSec : ATT&CK Enterprise et Cloud (T1190, T1195…), **CAPEC**, **D3FEND**, chaîne CWE → CAPEC → ATT&CK. Threat intelligence utile à la conception. Pont vers l'ATT&CK SaaS Academy. [D4] |
| N2 | Threat modeling agile et « as code » : incrémental, dans la PR/l'ADR. **AWS Threat Composer**, OWASP Threat Dragon, pytm, Threagile. « Threat modeling everywhere » (K2). [D4] |
| N3 | Modéliser l'IA (ATLAS, agents, MCP), la supply chain (modèle SLSA), le cloud, **l'environnement de développement lui-même** (K13 : le code source comme actif principal). Animer un atelier avec des devs. Revue de risque architecturale. [D4, D8] |

### Bloc C · Vérifier & outiller

#### M12 · Revue de code sécurité

Le geste le plus fréquent du métier, et le meilleur pont depuis le pentest : tu sais déjà ce qui est exploitable, il reste à le trouver dans le code avant la mise en production.

| Niv. | Leçon |
| --- | --- |
| N1 | Pourquoi et quand : revue de PR, revue ciblée, audit complet. Ce que la revue trouve et que les outils ratent (autorisation, logique, conception). La « deuxième passe sécurité » (K13). [D5] |
| N1 | **Méthode sur une base inconnue** : cartographier (routes, middlewares, modèles, configuration), lister les sources (`req.body`/`query`/`params`/`headers`, webhooks, fichiers, variables d'env) et les sinks (requêtes brutes, `exec`, templates, `res.redirect`, `fetch`, `innerHTML`), suivre les flux, repérer les contrôles centraux et ce qui les contourne. Outils : ripgrep, Semgrep en exploration, graphe de dépendances. [D5] |
| N1 | **Revoir une PR en 10 minutes** : lire le diff dans son contexte, repérer les changements sensibles (auth, crypto, requêtes brutes, nouvelles routes, dépendances, workflows CI), checklists Express, React, Next, Prisma et GitHub Actions, commentaires actionnables. CODEOWNERS pour router vers l'AppSec. [D5] |
| N2 | **Lire des correctifs de CVE** : diffs de corrections réelles (Next.js, xml-crypto, body-parser, advisories GHSA), cause racine, puis recherche des variantes ailleurs (variant analysis, pont vers M13). [D5] |
| N2 | Revue orientée autorisation et logique : la BOLA ne se voit pas au scanner. Vérifier chaque accès par tenant et par propriétaire, tables de décision, cas limites des machines à états. [D5] |
| N2 | **Revoir du code généré par IA** et les PR d'agents : erreurs typiques (validation absente, dépendances inventées, secrets, crypto approximative), gestion du volume, CodeRabbit ou Claude en appui sans leur déléguer la décision. [D5] |
| N3 | Audit ciblé et limité dans le temps : prioriser sur un gros dépôt (de la surface exposée vers les actifs de valeur, comme en SDR), notes réutilisables, rapport de revue, constats transformés en règles et en tests. Recherche de code malveillant (lien avec M13). [D5, D6] |

#### M13 · Tests & analyse de code

| Niv. | Leçon |
| --- | --- |
| N1 | Stratégie et plan de test de sécurité : tests fonctionnels et non fonctionnels, boîte blanche et boîte noire, recette, environnement de test. OWASP **WSTG** et OSSTMM comme référentiels. Où placer chaque technique (pre-commit, PR, nightly, release). [D6] |
| N1 | **Tests de sécurité écrits par les devs** (K12) : le cas GotoFail, tests qui vérifient qu'un contrôle refuse (pas seulement qu'il accepte), validation d'entrées, XSS avec Playwright, autorisation avec supertest, **tests de régression de sécurité**, TDD, rattrapage d'une base sans tests. Exercice K12 : écrire le test de régression d'un CVE passé (CVE-2025-29927) avant et après le correctif. [D6] |
| N1 | SAST JS : **Semgrep** (règles `javascript`, `express`, `react`), **CodeQL** (JS/TS, taint tracking), ESLint sécurité, TypeScript strict et avertissements traités comme erreurs. Trier les faux positifs. La revue manuelle est traitée en M12. [D5] |
| N2 | Écrire ses règles : Semgrep taint mode sur vos helpers maison, CodeQL *models as data*. **Variant analysis** : transformer un finding de pentest en règle qui trouve toutes ses variantes. Référence : Trail of Bits Testing Handbook. [D5] |
| N2 | **Fuzzing et tests de propriétés** : Jazzer.js, fast-check. **Disponibilité** (K12) : consommation de ressources, seuils, tests de charge et d'abus avec k6, injection de fautes. Validation cryptographique (entropie, PRNG). [D6] |
| N2 | SCA et SBOM : npm audit / OSV-Scanner / Snyk / Dependabot / Renovate, atteignabilité, paquets malveillants (Socket, GuardDog). SBOM **CycloneDX 1.6** (`cdxgen`, `cyclonedx-npm`), SPDX 3.0, Syft. **CISA 2026 Minimum Elements**. Dependency-Track + VEX. [D5, D8] |
| N2 | DAST et IAST : **ZAP** (automation framework, scan authentifié, OpenAPI), **Nuclei** et templates maison, DAST en CI sur environnement éphémère. Secrets : Gitleaks, TruffleHog, push protection ; corriger = révoquer. [D6] |
| N2 | **Données de test** : générer des données représentatives, ne pas copier la prod, sinon anonymiser, tokeniser, agréger. Fonctionnalités non documentées et vérification de la documentation (messages d'erreur, notes de version). [D6] |
| N3 | **Inspecter du code malveillant** : backdoors, bombes logiques, chaînes à forte entropie, `postinstall` obfusqué. Le test caché de GotoFail (`if (hash[0] == 0x23)`, exercice K12) et le cas xz utils. [D5, D8] |
| N3 | **IA** : revue de code LLM (**CodeRabbit**, Claude Code `/security-review`, Copilot Autofix, Semgrep Assistant) et agents de pentest (**Strix**, XBOW…). Les évaluer sur Juice Shop ou une application de test : détection, faux positifs, non-déterminisme, fuite de code, prompt injection *via le code analysé*. [D5, D6] |
| N3 | Bâtir la plateforme : orchestration/ASPM, dédoublonnage, critères *break/build*, vérification et validation indépendantes, métriques. [D6] |

#### M14 · Pipeline, supply chain & fournisseurs

| Niv. | Leçon |
| --- | --- |
| N1 | **OWASP Top 10 CI/CD Security Risks** (CICD-SEC-1 à 10) appliqué à GitHub Actions. [D7, D8] |
| N1 | Durcir GitHub Actions : `permissions` minimales, *pwn requests*, injection via `${{ github.event.* }}`, cache poisoning, runners self-hosted, environnements, **OIDC vers AWS**, rulesets, CODEOWNERS. Politiques d'organisation : **épinglage SHA imposé** (août 2025), immutable releases, verrouillage des dépendances de workflow (feuille de route 2026). [D7, D8] |
| N1 | **Sécuriser l'environnement de développement** (K13) : séparer dev et prod, vérifier les outils avant de les installer, bac à sable pour les essais, postes à jour. Shai-Hulud a montré que le poste du dev et le runner CI sont les cibles. [D8] |
| N2 | Outils : **zizmor**, actionlint, StepSecurity harden-runner, **OpenSSF Scorecard**, poutine. [D8] |
| N2 | npm : `npm ci` et lockfile, scripts d'installation (`--ignore-scripts`, pnpm 10), délai de quarantaine des nouvelles versions, dependency confusion, typosquatting, *slopsquatting*. **Trusted publishing** (OIDC), **provenance**, **staged publishing**, fin des jetons qui contournent la 2FA (restreints depuis août 2026, plus de publication directe prévue vers janv. 2027). [D8] |
| N2 | Choisir un composant (K13) : maintenance, historique de sécurité, surface, licence. Ne pas réinventer la sécurité, gérer l'héritage. **Licences open source** (copyleft, AGPL) suivies via le SBOM. [D5, D8] |
| N2 | Cas réels : event-stream, ua-parser-js, Codecov, xz utils, polyfill.io, Ultralytics, **tj-actions/changed-files** (mars 2025), chalk/debug (sept. 2025), Nx « s1ngularity » (août 2025), **Shai-Hulud** (sept. 2025 → vagues 2026 dont CHAINDROP, août 2026). [D8] |
| N2 | **Fournisseurs et tiers** (SaaS, prestataire de paiement, fournisseur d'IA) : évaluer (SOC 2, ISO 27001, CSA CCM/CAIQ), responsabilité partagée, notification d'incident et de vulnérabilité, logs vers le SIEM, droit d'audit. Clauses contractuelles : propriété intellectuelle, séquestre de code, responsabilité, SLA. NIST SP 800-161r1, ISO/IEC 27036. [D8] |
| N3 | **SLSA v1.2** (Build track L0–L3 + Source track), attestations in-toto, **Sigstore** (cosign, Fulcio, Rekor), GitHub artifact attestations, `npm audit signatures`, S2C2F, builds reproductibles. Chaîne de conservation et provenance. [D7, D8] |
| N3 | Répondre à un incident supply chain (playbook Shai-Hulud : versions touchées, rotation massive des secrets, nettoyage des runners, chasse dans Elastic). [D7, D8] |

### Bloc D · Cloud & production

#### M15 · IAM AWS

| Niv. | Leçon |
| --- | --- |
| N1 | Le modèle : principals, politiques (identité, ressource, SCP, **RCP**, permission boundary, session policy), **logique d'évaluation**, clés de condition utiles (`aws:PrincipalOrgID`, `aws:SourceArn`, `aws:SecureTransport`…). [D1, D7] |
| N1 | Zéro utilisateur IAM : IAM Identity Center, rôles, STS, identifiants temporaires, hygiène du compte root. [D7] |
| N2 | Workloads Node : rôle Lambda, *task role* vs *execution role* ECS, EKS Pod Identity, **IMDSv2** (Capital One 2019 : SSRF → IMDSv1 → S3), chaîne d'identifiants du SDK v3, pièges des Cognito identity pools. [D7] |
| N2 | Escalade et abus : `iam:PassRole` + `lambda:CreateFunction`, `CreatePolicyVersion`, trust policies trop larges, *confused deputy* et `ExternalId` (l'anti-pattern K4 en version AWS), **trust policy OIDC GitHub mal filtrée**. [D7] |
| N2 | Moindre privilège en pratique : IAM Access Analyzer (génération depuis CloudTrail, accès inutilisés, custom policy checks en CI), iamlive, last accessed. [D7] |
| N3 | Multi-comptes et **data perimeter** : Organizations, SCP, RCP, périmètres identité/ressource/réseau, break-glass. Côté attaque : Pacu, CloudFox, PMapper, Prowler. [D4, D7] |

#### M16 · Infrastructure as Code

| Niv. | Leçon |
| --- | --- |
| N1 | L'IaC comme surface : misconfigurations (A02), secrets dans le code et le state, dérive. Terraform/OpenTofu, CloudFormation, **AWS CDK en TypeScript**. Configuration de référence (*baseline*). [D7] |
| N1 | Scanners : **Checkov**, **Trivy**, KICS, **cdk-nag**, cfn-lint/cfn-guard. Où les placer. [D7] |
| N2 | Policy as code : **OPA/Rego + Conftest**, politiques Checkov maison, cfn-guard. Stratégie de blocage et d'exceptions. [D7] |
| N2 | State et pipeline : backend S3 chiffré avec verrou, rôles OIDC séparés plan/apply, revue du plan comme artefact. Supply chain IaC : épinglage des modules et providers, `.terraform.lock.hcl`. [D7, D8] |
| N3 | Dérive et runtime : CSPM (Prowler, Security Hub), AWS Config, préventif vs détectif. Modules « paved road ». Manifests Kubernetes et Kyverno (pont vers M17). [D7] |

#### M17 · Déploiement, exploitation & résilience

| Niv. | Leçon |
| --- | --- |
| N1 | Configuration de prod : secrets (Secrets Manager plutôt que variables d'env), `NODE_ENV`, erreurs verbeuses (A10), **helmet**, en-têtes (HSTS, CSP, COOP, CORP, Permissions-Policy), cookies `__Host-`. Gestion des certificats (ACM). [D7] |
| N1 | Conteneurs Node : multi-stage, `npm ci --omit=dev`, `USER node`, images distroless/minimales, FS en lecture seule, secrets BuildKit, scan d'image (Trivy, Grype). [D7] |
| N2 | Publier en sécurité : signature et admission (cosign, AWS Signer, Kyverno), vérification des artefacts (signatures, empreintes), gestion des changements, autorisation de mise en production (*approval to operate*). [D7] |
| N2 | AWS : ECS Fargate, Lambda, EKS (Pod Security Standards, NetworkPolicy), **CloudFront + AWS WAF** (règles managées, rate-based), mode *desync mitigation* de l'ALB, S3 + OAC. [D7] |
| N2 | En-têtes en production : appliquer la CSP et les en-têtes conçus en M4 au bon endroit (Express/helmet ou *response headers policy* CloudFront), vérifier après chaque déploiement, rapports vers Elastic. [D7] |
| N2 | **Résilience et continuité** : sauvegardes immuables (AWS Backup Vault Lock, S3 Object Lock, copie inter-comptes), plans de reprise et de continuité, tests de restauration, résistance au DoS, SLO et SLA. Le ransomware cloud comme scénario. [D7] |
| N2 | **Fin de vie** : décommissionner un service (révoquer les identifiants, supprimer configuration et DNS, archiver), disposition des données (rétention, destruction, dépendances). Éviter les composants non patchables (K4). [D2, D7] |
| N3 | Protection à l'exécution : livraison progressive (feature flags, canary, kill switch), virtual patching WAF, RASP, modèle de permissions Node (`--permission`), Falco, rotation de secrets sans coupure. [D7] |

#### M18 · Surveillance, logging & SIEM (Elastic)

| Niv. | Leçon |
| --- | --- |
| N1 | Quoi journaliser dans l'app (OWASP Logging Cheat Sheet et **Logging Vocabulary**), quoi ne jamais journaliser (confidentialité et vie privée des logs), logs structurés **pino** au format **ECS**, IDs de corrélation, OpenTelemetry. A09:2025. Les *detection points* d'OWASP AppSensor. Le « A » d'audit du Gold Standard (K1). [D5, D7] |
| N1 | Ingestion : Elastic Agent et Fleet, intégrations **AWS** (CloudTrail via S3/SQS, GuardDuty, WAF, VPC Flow Logs, CloudFront), logs applicatifs. Elastic Common Schema. [D7] |
| N2 | Langages : KQL pour chercher, **EQL** pour les séquences (connexion → changement de MFA → export), **ES\|QL** pour l'analyse. Timelines et cas dans Elastic Security. [D7] |
| N2 | Detection engineering : hypothèse → règle → test → réglage. Règles Elastic (query, threshold, EQL, new terms, ML), **Sigma** converti via pySigma, framework ADS (Palantir), couverture ATT&CK. **Detection-as-code** avec `elastic/detection-rules`. Tests avec **Stratus Red Team** et Atomic Red Team. [D7] |
| N2 | Détections applicatives : credential stuffing, ATO, énumération BOLA, rejeu de jeton, desync et cache poisoning vus dans les logs WAF/ALB, exfiltration S3, usage anormal de clés. **Honeytokens** (Canarytokens). Threat intelligence. [D7] |
| N3 | Maturité : **DEBMM** d'Elastic (5 paliers), MTTD/MTTR, bruit vs couverture. Réponse à incident applicative : triage, forensique CloudTrail, confinement IAM (`aws:TokenIssueTime`), remédiation, **analyse de cause racine**, post-mortem. [D7] |

### Bloc E · Continu

#### M19 · Sécurité de l'IA (module vivant, entrées datées)

| Niv. | Leçon |
| --- | --- |
| N1 | **OWASP Top 10 for LLM Applications 2026** (3 août 2026) avec la correspondance 2025 : Excessive Agency en LLM03, Unbounded Consumption en LLM06, Misinformation en LLM07, Improper Output Handling en LLM10, System Prompt Leakage renommé *Hidden Context Exposure*. LLM01 élargi au multimodal et à la persistance (mémoire, RAG). [D4] |
| N1 | Prompt injection directe et indirecte : pourquoi elle ne se « patche » pas. La **lethal trifecta** (Willison) et l'**Agents Rule of Two** (Meta, oct. 2025). *The Attacker Moves Second* (2025) : les défenses évaluées contre des attaques adaptatives tombent. |
| N2 | Patterns de conception : dual LLM, plan-then-execute, **CaMeL**, *Design Patterns for Securing LLM Agents against Prompt Injections* (2025). Relecture avec les anti-patterns de Kohnfelder : un agent est un *confused deputy*, un serveur MCP tiers est un *third-party hook*. |
| N2 | Apps JS avec LLM (Vercel AI SDK, LangChain.js, SDK OpenAI/Anthropic) : sortie du modèle = entrée non fiable (XSS via Markdown, SSRF via outils, text-to-SQL), sécurité du RAG (ACL sur les embeddings, empoisonnement), consommation illimitée. Labs PortSwigger *Web LLM attacks*. |
| N2 | Agents et MCP : **OWASP Top 10 for Agentic Applications 2026** (ASI01–ASI10), tool poisoning, rug pull, *token passthrough*, bonnes pratiques de sécurité de la spec MCP, bac à sable. |
| N2 | **MITRE ATLAS** : tactiques, techniques (dont les ajouts agentiques 2025-2026, ex. AML.T0086), études de cas. **OWASP AI Exchange** (source de l'ISO/IEC 27090). |
| N3 | Red teaming : **promptfoo** (natif JS/TS), garak, PyRIT. Évaluations en CI, limites des guardrails. Leçons de Microsoft AI Red Team. |
| N3 | L'IA dans le SDLC : code généré, paquets hallucinés, agents de code avec accès (permissions, secrets, injection via issues/PR). Cas Nx « s1ngularity ». **AI SBOM** (éléments minimaux CISA/G7, 2026). L'IA offensive : HTTP Terminator, Strix, XBOW. Gouvernance : NIST AI RMF, NIST AI 100-2, Google SAIF, ISO 42001, AI Act (survol). [D8] |

### M20 · Capstone : revue de sécurité de Novafact

Livrable guidé en 12 étapes, chacune avec checklist et auto-évaluation, réalisées sur l'architecture de Novafact (documents fournis) et des labs reconnus :

1. Exigences ASVS L2, classification des données et matrice de traçabilité.
2. Design doc et Security Design Review d'une nouvelle fonctionnalité (processus K7, rapport *Must / Ought / Should*).
3. Threat model.
4. Revue de code d'une PR sensible, règles Semgrep maison et tests de régression de sécurité.
5. Page de paiement : inventaire des scripts, CSP stricte, conformité aux exigences PCI 6.4.3 et 11.6.1.
6. Contrôles anti-abus sur l'inscription, la connexion et l'envoi de factures.
7. Durcissement du pipeline et de la supply chain.
8. IAM au moindre privilège.
9. Correctifs des vulnérabilités avancées (M3).
10. Cinq détections Elastic testées.
11. Roadmap SAMM à 12 mois.
12. Plan d'adoption (champions, formation, SLA négociés) et restitution en une page à la direction.

---

## 4. Grille CSSLP : couverture des 8 domaines

Exam outline ISC2 en vigueur depuis le 15/09/2023. Le parcours couvre les 8 domaines. Les leçons ajoutées pour combler les manques de la version précédente sont en gras.

| Domaine CSSLP | Poids | Modules | Leçons ajoutées grâce au CSSLP |
| --- | --- | --- | --- |
| D1 Secure Software Concepts | 12 % | M7, M8, M9 | **Confiance, C-I-A et Gold Standard**, principes complets (conception ouverte, acceptabilité psychologique, réutilisation) |
| D2 Secure Software Lifecycle Management | 11 % | M1, M6, M8, M17 | **Jalons break/build, documentation, métriques KPI/OKR, risque technique vs métier, fin de vie des applications, sensibilisation et reporting (M6)** |
| D3 Secure Software Requirements | 13 % | **M7**, M10 | **Exigences fonctionnelles et non fonctionnelles, SRTM, classification des données, vie privée, conformité, provisionnement** |
| D4 Secure Software Architecture and Design | 15 % | M4, M8, M9, M10, M11 | **Conception d'interfaces, sécurité des bases, revue de risque architecturale, propriétés non fonctionnelles** |
| D5 Secure Software Implementation | 14 % | M2, M3, M4, M8, M12, M13 | **Concurrence, sécurité déclarative, tokenisation, agilité crypto, inspection de code malveillant, revue de code manuelle (M12)** |
| D6 Secure Software Testing | 14 % | M5, M6, M12, M13 | **Stratégie de test, tests de sécurité écrits par les devs, fuzzing, tests de disponibilité, données de test, fonctionnalités non documentées** |
| D7 Secure Software Deployment, Operations, Maintenance | 11 % | M4, M10, M14–M18 | **Approbation de mise en production, résilience et continuité (sauvegardes, PRA/PCA), SLO/SLA, analyse de cause racine** |
| D8 Secure Software Supply Chain | 10 % | M4, M6, M13, M14 | **Évaluation des fournisseurs, clauses contractuelles, licences OSS, droit d'audit, NIST SP 800-161r1** |

**Mode CSSLP** dans le site : un filtre par domaine sur toutes les leçons, et un **examen blanc** de 100 questions de mise en situation, pondérées selon les poids officiels. Les questions sont rédigées pour la formation : aucune question réelle de l'examen. Hors du périmètre du parcours (mentionné pour mémoire) : embarqué, IoT industriel, matériel (secure boot, TPM, exécution spéculative), sujets du CSSLP sans rapport avec l'écosystème JS/AWS.

---

## 5. Intégration de *Designing Secure Software* (Kohnfelder)

| Chapitre | Idée clé | Où dans le parcours |
| --- | --- | --- |
| K1 Foundations | Confiance (spectre, composants implicitement fiables), C-I-A, Gold Standard (authN, authZ, audit), vie privée | M7, M18 |
| K2 Threats | Perspective adverse, 4 questions, actifs → surfaces → frontières → menaces → mitigations, threat modeling partout | M11 |
| K3 Mitigation | Réduire surface, fenêtre de vulnérabilité, exposition des données ; politiques d'accès, interfaces, communication, stockage | M8 |
| K4 Patterns | 14 patterns en 5 familles, 4 anti-patterns (confused deputy, backflow of trust, third-party hooks, unpatchable components) | M4, M8, M15, M17, M19 + jeu *Pattern Match* |
| K5 Cryptography | CSPRNG, MAC et rejeu, symétrique/asymétrique, signatures, certificats, échange de clés, bien utiliser la crypto | M8 |
| K6 Secure Design | Hypothèses explicites, périmètre, exigences, interfaces, données, vie privée, cycle de vie, compromis, simplicité | M8 + design doc Novafact |
| K7 Security Design Reviews | Study, Inquire, Identify, Collaborate, Write, Follow up ; Must/Ought/Should ; gérer le désaccord | M6, M8, M20 + jeu *Design Review Simulator* |
| K8 Secure Programming | Influence malveillante, chaînes de vulnérabilités, entropie des bugs, footguns (GotoFail), atomicité, attaques temporelles, sérialisation | M2, M3 + jeu *Stepping Stones* |
| K9 Low-Level Coding Flaws | Arithmétique : entiers et flottants. Mémoire : hors périmètre JS, sauf pour les modules natifs | M2 (arithmétique et argent) |
| K10 Untrusted Input | Validité, rejeter ou corriger, chaînes et Unicode, injections, regex, XML | M2 |
| K11 Web Security | S'appuyer sur un framework, modèle de sécurité web, XSS, CSRF | M2 (rappel éclair), M4 |
| K12 Security Testing | Cas de test de sécurité, fuzzing, régression, disponibilité, TDD, rattrapage | M13 |
| K13 Best Practices | Hygiène du code, exceptions, documenter la sécurité, revue de code, dépendances, triage (DREAD, faut-il un exploit ?), environnement de dev | M5, M12, M13, M14 |
| Annexe A | Modèle de document de conception | M8 (gabarit du design doc Novafact) |
| Annexe C | Exercices | Adaptés en JS dans les leçons : coder puis exploiter un confused deputy en Express, envelopper `node:crypto`, écrire un test de régression sur un CVE, rétro-documenter un composant, chercher la backdoor façon GotoFail |

---

## 6. Parcours PortSwigger intégré

Sur la Web Security Academy, on vise les labs **Practitioner** et **Expert** : les Apprentice sont des bases que tu maîtrises déjà. Jalon optionnel : **Burp Suite Certified Practitioner (BSCP)** si tu ne l'as pas.

| Sujet Academy | Module | Question côté AppSec |
| --- | --- | --- |
| Authentication | M10 | Quelles limites arrêtent le brute force et le credential stuffing sans bloquer les clients ? |
| NoSQL injection | M2 | Quel schéma de validation rend l'opérateur Mongo impossible ? |
| Access control, Business logic | M2, M8, M10 | Où centraliser l'autorisation pour que la BOLA ne dépende pas de chaque route ? |
| API testing | M3 | Comment les appels internes deviennent-ils une surface (server-side parameter pollution) ? |
| Race conditions | M3 | Quelle contrainte en base garantit l'atomicité, peu importe le code ? |
| HTTP Host header attacks | M3 | D'où vient l'URL absolue de l'application ? |
| HTTP request smuggling (dont advanced et browser-powered) | M3, M17 | Quel protocole de bout en bout, quel réglage de l'ALB, quelle trace dans Elastic ? |
| Web cache poisoning, Web cache deception | M3, M17 | Qui définit la clé de cache et que met-on en cache ? |
| Server-side template injection | M3 | Pourquoi les templates avec logique sont-ils une dette ? |
| Insecure deserialization | M3 | Quels formats n'acceptent jamais de types arbitraires ? |
| Prototype pollution (client et serveur) | M2, M3 | Comment l'empêcher en structure plutôt que par filtrage ? |
| JWT attacks | M3, M9 | Qui choisit l'algorithme : le jeton ou le serveur ? |
| OAuth authentication | M9 | Qu'impose RFC 9700 / RFC 10017 que ce lab viole ? |
| GraphQL API vulnerabilities | M3 | Limites de coût, désactivation de l'introspection, autorisation par résolveur. |
| SSRF, XXE | M3, M15 | IMDSv2, proxy de sortie, parsers sans entités externes. |
| DOM-based vulnerabilities, XSS avancé, CSP | M2, M3, M4 | Trusted Types + CSP stricte : que reste-t-il d'exploitable ? |
| CORS, CSRF, Clickjacking, WebSockets | M2, M3, M4 | Quelles valeurs par défaut du framework et du navigateur suffisent ? |
| File upload | M8 | Pipeline d'upload isolé (S3, scan, service de rendu séparé). |
| Web LLM attacks | M19 | Quel outil de l'agent donne l'impact, et comment le retirer ? |

**Piste recherche** (lectures N3, résumées dans le site) : les Top 10 web hacking techniques de PortSwigger (2023, 2024 et 2025 en priorité), *Smashing the state machine*, *HTTP/1.1 must die*, *CRLF-Powered Desync Attacks*, *Gotta cache 'em all*, *Splitting the email atom*, *Listen to the whispers* (timing), *Server-side prototype pollution* (Heyes), *The Fragile Lock*, *CSS: the bomb inside your inbox*, *Meet the HTTP Terminator*. Hors PortSwigger : la série Next.js de zhero, *Silent Spring*, *GHunter*, les contournements de DOMPurify (Kévin Mizu), *Account hijacking using dirty dancing* (Frans Rosén).

---

## 7. Jeux pédagogiques

Même logique que l'ATT&CK SaaS Academy : difficulté croissante, score en %, XP, badges. Les mécaniques reproduisent des gestes réels du métier.

### 7.1 Six catégories

Les 29 jeux sont rangés par **geste du métier**, pas par module : le parcours offre déjà l'axe « module », et une
liste plate de 29 entrées ne se choisit pas. Un apprenant sait dire « je veux m'entraîner à lire du code » bien
avant de savoir quel module il lui faut. Les catégories sont l'entrée du menu de navigation et de la page Jeux.

| Catégorie | Jeux | Ce qu'on y travaille |
| --- | --- | --- |
| **Fondamentaux** | 4 | Les référentiels, le vocabulaire et la carte des données : ce qu'il faut avoir en tête avant de discuter avec qui que ce soit. |
| **Repérer** | 5 | Lire du code, un diff, un workflow ou un rapport d'outil, et trouver ce qui cloche — le geste le plus fréquent du métier. |
| **Concevoir** | 6 | Choisir le contrôle qui élimine la classe entière, puis le défendre en revue devant ceux qui l'implémenteront. |
| **Observer** | 5 | Regarder ce qui se passe réellement sous l'application : protocoles, concurrence, analyseurs qui divergent, décisions IAM. |
| **Arbitrer** | 5 | Prioriser sous contrainte, chaîner des findings mineurs, et faire passer la décision sans braquer l'équipe. |
| **Détecter & répondre** | 4 | Voir l'attaque dans les journaux, écrire la règle qui l'attrape, et tenir la barre quand l'horloge tourne. |

Sur la page d'un jeu, le sous-menu montre ses **voisins de catégorie** plutôt que les catégories : c'est ce dont on
a besoin à cet endroit-là.

### 7.2 Le catalogue

| # | Jeu | Module | Niv. | Mécanique |
| --- | --- | --- | --- | --- |
| 1 | **Flashcards espacées** | Tous | N1 | Cartes sur les référentiels (CICD-SEC-x, LLMxx, ASIxx, chapitres ASVS, niveaux SLSA, RFC OAuth, domaines CSSLP, patterns Kohnfelder). **Répétition espacée (Leitner)** : une « révision du jour » sur l'accueil. |
| 2 | **Quel référentiel ?** | M1 | N1 | Tri rapide : un risque apparaît, le ranger dans Top 10 / API / CI/CD / LLM / Agentic / ASVS. |
| 3 | **Spot the Sink** | M2 | N1-N2 | Un extrait Express/React/Next : cliquer la ligne vulnérable, puis choisir la CWE. Chronométré. Inclut des footguns JS. |
| 4 | **Patch or Pwn** | M2, M3, M9 | N2 | Quatre correctifs proposés, un seul tient. Chaque mauvais choix révèle le payload qui le contourne. |
| 5 | **Stepping Stones** | M3, M5 | N2 | Une liste de findings « faibles ». Relier ceux qui forment une chaîne jusqu'à un impact critique, puis choisir le correctif unique qui casse le plus de chaînes. |
| 6 | **Parser Wars** | M3 | N3 | Une requête HTTP brute ou une URL : prédire comment CloudFront, l'ALB, llhttp (Node) et le cache la lisent. Trouver la divergence (desync, cache poisoning, contournement), puis le réglage qui l'annule. |
| 7 | **Race Window** | M3 | N2 | Une frise de requêtes concurrentes : placer l'attaque single-packet qui dépasse la limite, puis choisir le correctif qui tient. |
| 8 | **CSP Builder** | M4 | N3 | Composer la CSP de la page de paiement de Novafact, avec ses scripts tiers, directive par directive. Un banc de tests montre en direct quels payloads passent et quelles fonctionnalités cassent. |
| 9 | **Triage Room** | M5 | N2 | Une file de findings (CVSS, EPSS, KEV, atteignabilité, exposition, VEX). Classer P0–P3, faux positif ou risque accepté, avec un budget de sprint. Noté contre SSVC. |
| 10 | **Pushback** | M6 | N2 | Des objections réelles de devs, de product owners et de dirigeants (« pas le temps », « c'est interne », « le pentest n'a rien trouvé »). Choisir la réponse qui fait avancer sans braquer : le score mesure le risque réduit *et* la relation préservée. |
| 11 | **Data Map** | M7 | N2 | Classer les données de Novafact (sensibilité, propriétaire, rétention, base légale), puis choisir les contrôles et la traçabilité exigés pour chaque classe. |
| 12 | **Pattern Match** | M8 | N1-N2 | Une situation de conception Novafact : nommer le pattern appliqué ou l'anti-pattern présent (parmi les 14 + 4 de Kohnfelder), puis choisir la correction. |
| 13 | **Design Review Simulator** | M8 | N3 | Lire le design doc d'une nouvelle fonctionnalité, suivre les 6 étapes de Kohnfelder, classer ses constats en *Must / Ought / Should*, puis gérer par choix de dialogue un designer qui conteste. |
| 14 | **OAuth Flow Debugger** | M9 | N2-N3 | Un diagramme de séquence animé d'un flux réel (OIDC ou SAML) : trouver l'étape faible et nommer l'attaque. |
| 15 | **Abuse Desk** | M10 | N2-N3 | Un flux d'événements (connexions, inscriptions, envois de factures) qui mêle clients légitimes, bots et fraudeurs. Régler limites de débit, règles WAF et contrôles d'envoi : le score combine abus bloqués et clients légitimes gênés. |
| 16 | **STRIDE Cards** | M11 | N2 | Inspiré d'Elevation of Privilege : un DFD de Novafact, des cartes de menaces à poser sur le bon élément ou la bonne frontière, puis la contre-mesure. |
| 17 | **Diff Review** | M12 | N1-N3 | Une PR de Novafact affichée comme sur GitHub : commenter les lignes à risque, qualifier chaque commentaire (bloquant, à corriger, suggestion), approuver ou refuser. Trois paliers : diff court, diff avec contexte à ouvrir, PR générée par une IA. |
| 18 | **Right Tool, Right Stage** | M13 | N1 | Glisser SAST, DAST, SCA, secrets, IaC, SBOM, fuzzing, test de régression, revue IA sur le bon scénario et la bonne étape d'un schéma de pipeline. |
| 19 | **True or False Positive** | M13 | N3 | Des findings Semgrep, CodeQL ou d'un reviewer IA avec leur trace de taint : vrai ou faux positif, et pourquoi. Certains findings IA sont hallucinés. |
| 20 | **Workflow Audit** | M14 | N2 | Un workflow GitHub Actions : cliquer les lignes dangereuses et les rattacher au bon CICD-SEC. |
| 21 | **Supply Chain Kill Chain** | M14 | N2 | Remettre en ordre un incident réel (xz, tj-actions, Shai-Hulud…), puis placer le contrôle (SLSA, pinning, trusted/staged publishing) qui casse la chaîne le plus tôt. |
| 22 | **Allow or Deny ?** | M15 | N2 | Politique d'identité + politique de ressource + SCP/RCP + boundary + contexte : prédire la décision et justifier par l'étape de l'algorithme. |
| 23 | **IAM Privesc Pathfinder** | M15 | N3 | Un graphe de permissions : trouver le chemin vers admin, puis le couper avec le moins de changements possible. |
| 24 | **IaC Misconfig Hunt** | M16 | N2 | Terraform ou CDK : repérer les misconfigurations, puis choisir la règle Checkov/Rego qui les attrape sans faux positif. |
| 25 | **Log Detective AppSec** | M18 | N2 | Événements Elastic (pino/ECS, CloudTrail, WAF) : identifier l'attaque et la technique ATT&CK. |
| 26 | **Detection Builder** | M18 | N3 | Assembler une règle (KQL, seuil ou séquence EQL) par blocs et la tester sur un jeu d'événements : précision et rappel affichés. |
| 27 | **Agent Blast Radius** | M19 | N2-N3 | Configurer outils, permissions et validations humaines de l'assistant Novafact en respectant la Rule of Two. Des injections sont rejouées : bloquer les attaques sans casser les cas d'usage. |
| 28 | **Crise J+0** | M4, M5, M14, M17 | N3 | Scénario à embranchements, sous horloge : React2Shell, Shai-Hulud, skimmer sur la page de paiement ou ransomware cloud frappe Novafact. Chaque décision (inventaire, WAF, rotation, restauration, communication, signalement CRA) a des conséquences. |
| 29 | **Red vs Blue : Novafact** | Capstone | N3 | Le boss final : prototype pollution → RCE → IMDS → escalade IAM → exfiltration S3, analysée côté Red, puis défense en profondeur côté Blue avec un budget limité réparti sur tout le SDLC. |

Le **SAMM Planner** de la version précédente devient un exercice guidé du module M1 (évaluation + roadmap), plutôt qu'un jeu.

**Évaluation** : un quiz par module, un examen par bloc (A à D), un examen final (40 questions, 25 min, 75 %), l'**examen blanc façon CSSLP** (100 questions pondérées par domaine), certificat imprimable.

**Progression** : 6 niveaux (Recrue AppSec → Security Champion → AppSec Engineer → Senior AppSec → Product Security Lead → Architecte DevSecOps), un badge par module et par jeu maîtrisé, une carte de progression façon roadmap, une jauge de couverture CSSLP par domaine, un compteur de labs PortSwigger cochés à la main.

---

## 8. Bibliothèque de sources

### 8.1 Référentiels et standards

| Source | Modules |
| --- | --- |
| [OWASP Top 10:2025](https://owasp.org/Top10/2025/) · [API Security Top 10 2023](https://owasp.org/API-Security/) · [CWE Top 25](https://cwe.mitre.org/top25/) | M2 |
| [OWASP ASVS 5.0](https://github.com/OWASP/ASVS) · [Proactive Controls](https://top10proactive.owasp.org/) · [Developer Guide](https://owasp.org/www-project-developer-guide/) | M1, M7, M8 |
| [OWASP SAMM v2](https://owaspsamm.org/model/) · [BSIMM16](https://www.blackduck.com/resources/analyst-reports/bsimm.html) · [OWASP DSOMM](https://dsomm.owasp.org/) · [Security Champions Guide](https://securitychampions.owasp.org/) · [SAFECode Fundamental Practices](https://safecode.org/) | M1, M6 |
| [ISC2 CSSLP Exam Outline](https://www.isc2.org/certifications/csslp/csslp-certification-exam-outline) | Grille §4 |
| [NIST SSDF SP 800-218](https://csrc.nist.gov/pubs/sp/800/218/final) · [CISA Secure by Design](https://www.cisa.gov/securebydesign) · [EU CRA, signalement](https://digital-strategy.ec.europa.eu/en/policies/cra-reporting) · [ENISA SRP](https://www.enisa.europa.eu/topics/product-security-and-certification/single-reporting-platform-srp) | M1, M5 |
| RGPD ([CNIL, guide RGPD du développeur](https://www.cnil.fr/fr/guide-rgpd-du-developpeur)) · [PCI DSS 4.0.1](https://www.pcisecuritystandards.org/) · NIS2 | M7 |
| [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/) (Node.js, Prototype Pollution, XSS, DOM XSS, CSP, OAuth2, SAML, JWT, Logging, Logging Vocabulary, CI/CD, Docker, NodeJS Docker, Secrets, Threat Modeling, Mass Assignment, GraphQL, Cryptographic Storage, User Privacy Protection) | Tous |
| [OWASP WSTG](https://owasp.org/www-project-web-security-testing-guide/) · [OWASP Code Review Guide](https://owasp.org/www-project-code-review-guide/) · [OSSTMM](https://www.isecom.org/OSSTMM.3.pdf) | M12, M13 |
| [PCI DSS 4.0.1](https://www.pcisecuritystandards.org/) exigences 6.4.3 et 11.6.1 · [MDN Sanitizer API](https://developer.mozilla.org/en-US/docs/Web/API/HTML_Sanitizer_API) · [web.dev Fetch Metadata](https://web.dev/articles/fetch-metadata) · [web.dev Trusted Types](https://web.dev/articles/trusted-types) · [Sansec](https://sansec.io/research) (recherche Magecart) | M4 |
| [OWASP Automated Threats to Web Applications](https://owasp.org/www-project-automated-threats-to-web-applications/) · [OWASP Credential Stuffing Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Credential_Stuffing_Prevention_Cheat_Sheet.html) · [API6:2023](https://owasp.org/API-Security/editions/2023/en/0xa6-unrestricted-access-to-sensitive-business-flows/) · [AWS WAF Fraud Control ATP](https://docs.aws.amazon.com/waf/latest/developerguide/waf-atp.html) · [Pwned Passwords](https://haveibeenpwned.com/Passwords) · [KnowBe4 : phishing via QuickBooks](https://blog.knowbe4.com/invoice-or-impersonation-36.5-spike-in-phishing-attacks-leveraging-quickbooks-legitimate-domain-in-2025) | M10 |
| [FAIR Institute](https://www.fairinstitute.org/) (quantification du risque) · [ANSSI, prestataires qualifiés PASSI](https://cyber.gouv.fr/produits-services-qualifies) · [CREST](https://www.crest-approved.org/) | M6 |
| [FIRST CVSS 4.0](https://www.first.org/cvss/v4-0/) · [EPSS](https://www.first.org/epss/) · [CISA KEV](https://www.cisa.gov/known-exploited-vulnerabilities-catalog) · [SSVC](https://certcc.github.io/SSVC/) · [OpenVEX](https://github.com/openvex/spec) · [RFC 9116](https://www.rfc-editor.org/rfc/rfc9116) · [EUVD](https://euvd.enisa.europa.eu/) | M5 |
| RFC [9700](https://www.rfc-editor.org/rfc/rfc9700) (OAuth BCP), [10017](https://www.rfc-editor.org/info/rfc10017/) (Browser-based apps), [8725](https://www.rfc-editor.org/rfc/rfc8725) (JWT BCP), [9449](https://www.rfc-editor.org/rfc/rfc9449) (DPoP), [9126](https://www.rfc-editor.org/rfc/rfc9126) (PAR), [8693](https://www.rfc-editor.org/rfc/rfc8693) (Token Exchange) · [OAuth 2.1](https://oauth.net/2.1/) · [NIST SP 800-63-4](https://pages.nist.gov/800-63-4/) | M8, M9 |
| [MITRE ATT&CK](https://attack.mitre.org/) · [CAPEC](https://capec.mitre.org/) · [D3FEND](https://d3fend.mitre.org/) · [ATLAS](https://atlas.mitre.org/) · [Threat Modeling Manifesto](https://www.threatmodelingmanifesto.org/) · [LINDDUN](https://linddun.org/) | M11, M19 |
| [OWASP Top 10 CI/CD Security Risks](https://owasp.org/www-project-top-10-ci-cd-security-risks/) · [SLSA v1.2](https://slsa.dev/spec/v1.2/) · [OpenSSF](https://openssf.org/) (Scorecard, S2C2F, npm Best Practices Guide) · [Sigstore](https://www.sigstore.dev/) · [CISA SBOM Minimum Elements 2026](https://www.cisa.gov/resources-tools/resources/2026-minimum-elements-software-bill-materials-sbom) · [CNCF TAG Security](https://github.com/cncf/tag-security) | M13, M14 |
| [NIST SP 800-161r1](https://csrc.nist.gov/pubs/sp/800/161/r1/final) (C-SCRM) · ISO/IEC 27036 · [CSA CCM et CAIQ](https://cloudsecurityalliance.org/research/cloud-controls-matrix) | M14 |
| AWS : [Policy evaluation logic](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_evaluation-logic.html), [Data perimeters](https://aws.amazon.com/identity/data-perimeters-on-aws/), [Security Reference Architecture](https://docs.aws.amazon.com/prescriptive-guidance/latest/security-reference-architecture/), Well-Architected Security et Reliability Pillars, [Security Incident Response Guide](https://docs.aws.amazon.com/security-ir/latest/userguide/), [CIRT playbooks](https://github.com/aws-samples/aws-customer-playbook-framework) | M15–M18 |
| [OWASP GenAI Security Project](https://genai.owasp.org/) (LLM Top 10 2025/2026, Agentic Top 10 2026, AI Testing Guide) · [OWASP AI Exchange](https://owaspai.org/) · [NIST AI 100-2](https://csrc.nist.gov/pubs/ai/100/2/e2025/final) · [Google SAIF](https://saif.google/) · [MCP Security Best Practices](https://modelcontextprotocol.io/specification/draft/basic/security_best_practices) | M19 |

### 8.2 Écosystème JS

- [Node.js Security Best Practices](https://nodejs.org/en/learn/getting-started/security-best-practices) et [modèle de menaces de Node.js](https://github.com/nodejs/node/blob/main/SECURITY.md), [Permission Model](https://nodejs.org/api/permissions.html)
- [Next.js : How to Think About Security](https://nextjs.org/blog/security-nextjs-server-components-actions), [postmortem CVE-2025-29927](https://vercel.com/blog/postmortem-on-next-js-middleware-bypass)
- Recherche Next.js de [zhero](https://zhero-web-sec.github.io/research-and-things/) et d'Assetnote
- [React2Shell](https://www.rapid7.com/blog/post/etr-react2shell-cve-2025-55182-critical-unauthenticated-rce-affecting-react-server-components/), [SAMLStorm](https://workos.com/blog/samlstorm)
- *Silent Spring* (USENIX Security 2023) et *GHunter* (USENIX Security 2024)
- [BlackFan : client-side prototype pollution](https://github.com/BlackFan/client-side-prototype-pollution)
- [Snyk Learn](https://learn.snyk.io/), [Pragmatic Web Security](https://pragmaticwebsecurity.com/) (Philippe De Ryck)
- Liran Tal, *Node.js Secure Coding* ; [web.dev : strict CSP](https://web.dev/articles/strict-csp) et [Trusted Types](https://web.dev/articles/trusted-types)
- Tests : [Jazzer.js](https://github.com/CodeIntelligenceTesting/jazzer.js), [fast-check](https://fast-check.dev/), [k6](https://k6.io/), Playwright, supertest

### 8.3 PortSwigger et recherche web

- [Web Security Academy, tous les sujets](https://portswigger.net/web-security/all-topics)
- [PortSwigger Research](https://portswigger.net/research) et [Top 10 web hacking techniques](https://portswigger.net/research/top-10-web-hacking-techniques) ([édition 2025](https://portswigger.net/research/top-10-web-hacking-techniques-of-2025))
- [HTTP/1.1 must die](https://portswigger.net/research/http1-must-die), [The Fragile Lock](https://portswigger.net/research/the-fragile-lock), *CRLF-Powered Desync Attacks* (2026), *Meet the HTTP Terminator* (2026)
- [xsleaks.dev](https://xsleaks.dev/), [Hacktricks](https://book.hacktricks.wiki/) (aide-mémoire offensif)

### 8.4 Outillage

- [Trail of Bits Testing Handbook](https://appsec.guide/), [Semgrep Academy](https://academy.semgrep.dev/), [GitHub Security Lab](https://securitylab.github.com/), [CodeQL docs](https://codeql.github.com/docs/)
- [ZAP automation framework](https://www.zaproxy.org/docs/automate/automation-framework/), [Nuclei templates](https://github.com/projectdiscovery/nuclei-templates)
- [CycloneDX](https://cyclonedx.org/), [cdxgen](https://github.com/CycloneDX/cdxgen), [Dependency-Track](https://dependencytrack.org/), [DefectDojo](https://github.com/DefectDojo/django-DefectDojo), [OSV](https://osv.dev/), [deps.dev](https://deps.dev/)
- [zizmor](https://docs.zizmor.sh/), [StepSecurity](https://www.stepsecurity.io/blog), [Socket](https://socket.dev/blog), [GuardDog](https://github.com/DataDog/guarddog)
- GitHub : [épinglage SHA imposé](https://github.blog/changelog/2025-08-15-github-actions-policy-now-supports-blocking-and-sha-pinning-actions/), [feuille de route sécurité Actions 2026](https://github.blog/news-insights/product-news/whats-coming-to-our-github-actions-2026-security-roadmap/)
- npm : [trusted publishing](https://docs.npmjs.com/trusted-publishers/), [changements de sept. 2025](https://github.blog/changelog/2025-09-29-strengthening-npm-security-important-changes-to-authentication-and-token-management/), [install-time security, juil. 2026](https://github.blog/changelog/2026-07-08-npm-install-time-security-and-gat-bypass2fa-deprecation/)
- [Checkov](https://www.checkov.io/), [Trivy](https://trivy.dev/), [cdk-nag](https://github.com/cdklabs/cdk-nag), [OPA](https://www.openpolicyagent.org/) + [Styra Academy](https://academy.styra.com/), [Kyverno](https://kyverno.io/)
- [Prowler](https://github.com/prowler-cloud/prowler), [Pacu](https://github.com/RhinoSecurityLabs/pacu), [CloudFox](https://github.com/BishopFox/cloudfox), [PMapper](https://github.com/nccgroup/PMapper), [AWS Threat Composer](https://github.com/awslabs/threat-composer)
- IA : [Strix](https://github.com/usestrix/strix), [CodeRabbit](https://docs.coderabbit.ai/), [promptfoo](https://www.promptfoo.dev/), [garak](https://github.com/NVIDIA/garak), [PyRIT](https://github.com/Azure/PyRIT)

### 8.5 Elastic et détection

- [Elastic Security docs](https://www.elastic.co/docs/solutions/security), [detection-rules](https://github.com/elastic/detection-rules), [Elastic Security Labs](https://www.elastic.co/security-labs)
- [DEBMM](https://www.elastic.co/security-labs/elastic-releases-debmm), [State of Detection Engineering 2025](https://www.elastic.co/security-labs/state-of-detection-engineering-at-elastic-2025)
- [ECS](https://www.elastic.co/docs/reference/ecs), [ecs-logging-nodejs](https://github.com/elastic/ecs-logging-nodejs), intégration [AWS](https://www.elastic.co/docs/reference/integrations/aws)
- [SigmaHQ](https://github.com/SigmaHQ/sigma) + [pySigma Elasticsearch](https://github.com/SigmaHQ/pySigma-backend-elasticsearch), [Palantir ADS](https://github.com/palantir/alerting-detection-strategy-framework), [Stratus Red Team](https://stratus-red-team.cloud/), [Atomic Red Team](https://github.com/redcanaryco/atomic-red-team)

### 8.6 Labs pratiques

| Lab | Pour |
| --- | --- |
| **Novafact Lab** (`lab/`, fourni) | M2, M3, M4, M10, M19 : exploiter, puis corriger avec tests de régression |
| **PortSwigger Web Security Academy** (Practitioner/Expert) | M2, M3, M9, M19 |
| **OWASP Juice Shop** + *Pwning OWASP Juice Shop* | Base JS, coding challenges (choisir le bon correctif) |
| OWASP NodeGoat, DVNA | Vulnérabilités spécifiques Node |
| **CI/CD Goat**, GitHub Security Lab CTF | Top 10 CI/CD, pwn requests, CodeQL |
| **flAWS / flAWS2**, **CloudGoat**, Big IAM Challenge, iam-vulnerable | IAM AWS attaque/défense |
| TerraGoat, CfnGoat | IaC |
| Kubernetes Goat | Déploiement |
| Stratus Red Team | Générer des attaques cloud pour tester les détections Elastic |
| **Gandalf** (Lakera), Damn Vulnerable LLM Agent, Crucible | Prompt injection, agents |
| OWASP WrongSecrets | Gestion des secrets |
| Advisories GHSA et diffs de correctifs (Next.js, xml-crypto, body-parser…) | M12 : lire des correctifs réels, chercher les variantes |
| PentesterLab, exercices de code review (payant) | M12 |

### 8.7 Livres

- **Loren Kohnfelder, *Designing Secure Software: A Guide for Developers*** (No Starch, 2021) : ouvrage de référence du bloc B (fourni, voir §5)
- Tanya Janca, *Alice and Bob Learn Application Security* (Wiley) et *Alice and Bob Learn Secure Coding* (Wiley, 2025 : Express, React, revue de code)
- Mark Dowd, John McDonald & Justin Schuh, *The Art of Software Security Assessment* (Addison-Wesley) : la référence de la revue de code
- Kelly Shortridge & Aaron Rinehart, *Security Chaos Engineering* (O'Reilly, 2023)
- Matthew Skelton & Manuel Pais, *Team Topologies* (IT Revolution) : l'AppSec comme *enabling team*
- Jack Freund & Jack Jones, *Measuring and Managing Information Risk: A FAIR Approach* (Butterworth-Heinemann)
- Adam Shostack, *Threat Modeling: Designing for Security* et *Threats: What Every Engineer Should Learn From Star Wars*
- Izar Tarandach & Matthew Coles, *Threat Modeling: A Practical Guide for Development Teams* (O'Reilly)
- Johnsson, Deogun & Sawano, *Secure by Design* (Manning)
- Andrew Hoffman, *Web Application Security*, 2e éd. (O'Reilly, 2024)
- Dafydd Stuttard & Marcus Pinto, *The Web Application Hacker's Handbook*
- Justin Richer & Antonio Sanso, *OAuth 2 in Action* (Manning)
- Cassie Crossley, *Software Supply Chain Security* (O'Reilly, 2024)
- Chris Hughes & Nikki Robinson, *Effective Vulnerability Management* (Wiley, 2024)
- Jimmy Ray, *Policy as Code* (O'Reilly, 2024)
- Conklin & Shoemaker, *CSSLP Certification All-in-One Exam Guide*, 3e éd. (McGraw Hill), et le *Official ISC2 Guide to the CSSLP CBK*
- Google, *Building Secure and Reliable Systems* (gratuit en ligne)

### 8.8 Référentiels de formation (pour vérifier la couverture)

**CSSLP** (grille officielle, §4), plans de cours de SANS SEC522 (AppSec web et API) et SEC540 (Cloud Native & DevSecOps), Practical DevSecOps (CDP), AWS Certified Security – Specialty, Burp Suite Certified Practitioner.

### 8.9 Veille

tl;dr sec (Clint Gibler), Simon Willison (prompt injection), Embrace The Red (Johann Rehberger), PortSwigger Research, GitHub Security Lab, Wiz Research, Datadog Security Labs, Elastic Security Labs, StepSecurity, Socket, Sansec, Detection Engineering Weekly, hackingthe.cloud, breaches.cloud. Conférences : OWASP Global AppSec, fwd:cloudsec, Black Hat / DEF CON (AppSec Village), LocoMocoSec.

---

## 9. Labs pratiques

La pratique s'appuie sur des labs reconnus, listés au §8.6 et dans la page **Labs** du site : sujets Practitioner et Expert de la Web Security Academy, applications volontairement vulnérables (Juice Shop, NodeGoat, DVNA, WrongSecrets, CI/CD Goat), scénarios cloud (flAWS, CloudGoat, Big IAM Challenge, TerraGoat, Stratus Red Team) et IA (Gandalf, Damn Vulnerable LLM Agent, Crucible). Chaque lab se coche dans le site et rapporte de l'XP.

**Novafact Lab** (dossier `lab/`) complète ce dispositif. L'application fil rouge y est rendue exécutable et
volontairement vulnérable : même stack que le site (Vite + React + TypeScript, API Express), tout en mémoire,
boucle locale, faux service de métadonnées local pour la SSRF. **74 challenges jouables**, listés dans
`lab/CHALLENGES.md` : 17 s'exploitent contre l'application qui tourne (M2, M3, M4, M10, M19), et 57 se
corrigent dans un dépôt fixture — workflows GitHub Actions (M14), politiques IAM (M15), Terraform et CDK
(M16), conteneurs et Kubernetes (M17). S'y ajoute une feuille de route de 278 challenges spécifiés
(`lab/ROADMAP.md`) couvrant les 20 modules : 158 des 162 leçons du parcours y sont rattachées à au moins un
challenge, et les quatre exceptions sont documentées avec leur raison.

Ce qui le distingue des labs externes, et justifie de revenir sur la décision initiale : le drapeau ne
récompense pas l'exploitation seule. Le serveur constate lui-même la violation d'invariant, puis
`npm run verify` exige les deux moitiés du métier — **le contrôle refuse l'attaque, et le cas légitime marche
encore**. C'est l'exercice K12 de Kohnfelder et le cœur de M13, appliqué à du code qu'on possède. Les modules
M14 à M18 continuent de s'appuyer sur CloudGoat, TerraGoat, CI/CD Goat et Stratus Red Team, qu'aucun lab local
ne remplace.

Les exemples de code des leçons illustrent Novafact ; ceux du lab en sont la version exécutable.

## 10. Choix techniques du site

- **Base** : copie du socle de l'ATT&CK SaaS Academy (styles, `ui.tsx`, Layout, progression, toasts, certificat), rebrandé.
- **Contenu** : MDX (`@mdx-js/rollup`) avec composants maison : `<YouKnow>` (ce que tu sais déjà), `<Diff>` (vulnérable → corrigé), `<Lab>` (lab reconnu, case « fait »), `<Source>`, `<Quiz>` inline, `<PrDiff>` (diff commentable façon GitHub), `<Csslp domain="D4">`, `<Kohnfelder ch={7}>`.
- **Code** : coloration syntaxique légère (`prism-react-renderer`), avec vues diff.
- **Diagrammes** : SVG inline (DFD, séquences OAuth/SAML, pipeline, graphe IAM, chaîne de proxys, carte des patterns), thèmes clair et sombre.
- **Progression** : `localStorage`, clé propre au nouveau site. Répétition espacée, labs cochés et couverture CSSLP gérés dans le store.

## 11. Livraison par phases

| Phase | Contenu | Jeux |
| --- | --- | --- |
| 1 ✅ | Socle du site, MDX, progression, M1, M2, M3, M5 (livrée) | Flashcards espacées, Quel référentiel ?, Spot the Sink, Patch or Pwn, Stepping Stones, Race Window, Triage Room |
| 2 ✅ | M4, M6, M7, M8 (livrée) | CSP Builder, Pushback, Data Map, Pattern Match, Design Review Simulator, Parser Wars |
| 3 ✅ | M9, M10, M11, M12 (livrée) | OAuth Flow Debugger, Abuse Desk, STRIDE Cards, Diff Review |
| 4 ✅ | M13, M14 (livrée) | Right Tool, True or False Positive, Workflow Audit, Supply Chain Kill Chain |
| 5 ✅ | M15 à M18 (livrée) | Allow or Deny, IAM Pathfinder, IaC Hunt, Log Detective, Detection Builder |
| 6 ✅ | M19, capstone, examens, examen blanc CSSLP, certificat (livrée) | Agent Blast Radius, Crise J+0, Red vs Blue |
| 7 ✅ | **Novafact Lab** : 17 exercices, drapeaux constatés par le serveur, suite de régression, corrigé (livrée) | — |
| Continu | Entrées datées dans M19 et la page Veille | — |

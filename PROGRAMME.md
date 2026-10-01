# AppSec Academy : programme de formation

> Cahier des charges du site. Même design et même stack que ATT&CK SaaS Academy (Vite + React + TS, XP, badges, jeux, examen, certificat).
> Dernière mise à jour des sources : 01/10/2026.
>
> **À revérifier avant publication** : la transposition française de NIS2 (examen à l'Assemblée nationale à partir du 7 octobre 2026) et les délais de notification NIS2 et CRA, à recouper sur EUR-Lex. Détail au §8.14.

## Décisions validées

| # | Décision |
| --- | --- |
| 1 | Référence IA : **OWASP LLM Top 10 2026**, avec la correspondance 2025 affichée. |
| 2 | La pratique s'appuie sur des **labs reconnus** (PortSwigger, Juice Shop, CI/CD Goat, flAWS, CloudGoat…), qui restent la pratique principale. **Amendée le 28/09/2026** : s'y ajoute **Novafact Lab** (dossier `lab/`), l'application fil rouge rendue exécutable et vulnérable, pour le geste que les labs externes couvrent mal ici — corriger dans du code Express/React qu'on possède, et le prouver par un test de régression (voir §9). |
| 3 | Contenu des leçons en **MDX**. |
| 4 | SIEM des labs : **Elastic** (Elastic Security, Kibana, Elastic Agent). |
| 5 | Les **8 domaines du CSSLP** servent de grille de couverture (voir §4). |
| 6 | *Designing Secure Software* (Loren Kohnfelder, No Starch, 2021) est intégré comme ouvrage de référence pour la conception (voir §5). Le contenu est reformulé et référencé par chapitre, jamais recopié. |
| 7 | Quatre modules ajoutés : **Sécurité côté client et scripts tiers** (aujourd'hui M8), **Faire adopter la sécurité** (M30), **Anti-abus, prise de contrôle de comptes et fraude** (M15), **Revue de code sécurité** (M16). |
| 8 | **01/10/2026 · Parcours restructuré selon le SSDLC.** Neuf blocs au lieu de cinq. A (le métier) et B (le web et ses vulnérabilités) posent les bases ; C (Concevoir), D (Construire & vérifier), E (Déployer) et F (Security Operations) suivent le cycle de développement sécurisé ; G (Sécurité de l'IA) court en parallèle ; H (Piloter) fait la synthèse avant le capstone. Dans C, l'analyse de risques précède le threat modeling, et « Spécifier et concevoir » sépare la spécification fonctionnelle (le quoi, avec le produit) de la spécification technique (le comment, le design doc). Nouveaux modules : panorama de la menace (M1), ATT&CK et menace SaaS (M2), métiers (M4), maturité et posture (M5), le web et ses protections (M6), analyse de risques (M10), SOC et renseignement (M22), detection engineering (M24), réponse à incident (M25), agents & MCP (M28), MCP & OAuth (M29), le programme AppSec (M31). Les anciens modules sont redécoupés ; leur `id` ne change pas, seul le numéro affiché suit l'ordre du catalogue, et la progression des leçons déplacées est migrée. Chaque module s'ouvre sur un diagnostic d'entrée, repassé après la dernière leçon ; une leçon peut exiger des séries de jeu en plus de son quiz. Un examen par bloc, de A à H. |

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

9 blocs, 32 modules. Le site calcule la durée de chaque module à partir de ses leçons (20 min en N1, 25 en N2, 30 en N3), labs non compris.

```text
Bloc A · Le métier                     M1 Cybersécurité et panorama de la menace · M2 MITRE ATT&CK et la menace SaaS
                                       M3 Présentation de l'AppSec · M4 Les métiers de l'AppSec · M5 Maturité et posture
Bloc B · Le web et ses vulnérabilités  M6 Le web et ses protections · M7 Côté serveur · M8 Côté client & scripts tiers
                                       M9 Web avancé (PortSwigger)
Bloc C · Concevoir                     M10 Analyse de risques · M11 Threat modeling & MITRE · M12 Exigences, vie privée & conformité
                                       M13 Spécifier et concevoir · M14 Identité (authN, authZ, OAuth, SAML) · M15 Anti-abus, ATO & fraude
Bloc D · Construire & vérifier         M16 Revue de code · M17 Tests & analyse de code · M18 Pipeline, supply chain & fournisseurs
Bloc E · Déployer                      M19 IAM AWS · M20 IaC · M21 Déploiement, exploitation & résilience
Bloc F · Security Operations           M22 SOC & renseignement · M23 Journalisation & SIEM (Elastic) · M24 Detection engineering
                                       M25 Réponse à incident · M26 Gestion des vulnérabilités
Bloc G · Sécurité de l'IA              M27 Applications LLM · M28 Agents & MCP · M29 MCP & OAuth
Bloc H · Piloter                       M30 Faire adopter la sécurité · M31 Le programme AppSec
Capstone                               M32 Revue de sécurité complète de Novafact
```

Ordre conseillé : A → B → C → D → E → F → H, **G en parallèle dès le bloc C**, capstone à la fin. Les blocs C à F suivent le SSDLC : on apprécie le risque (M10) avant de modéliser les menaces (M11), on en tire les exigences (M12), puis la spécification fonctionnelle et technique (M13) ; on construit et vérifie (D), on déploie (E), on exploite et on répond (F). La gestion des vulnérabilités (M26) clôt F parce qu'elle reçoit les findings de tous les blocs précédents. H vient en dernier : faire adopter (M30) et bâtir le programme (M31) supposent de connaître les contrôles. Tout reste accessible, le site suggère le prochain module ; les leçons d'un module s'ouvrent après son diagnostic d'entrée. Chaque leçon affiche ses étiquettes **CSSLP** (D1 à D8) et, le cas échéant, **Kohnfelder** (chapitre).

---

## 3. Programme détaillé

Chaque leçon liste ses **labs** (PortSwigger, Juice Shop, CI/CD Goat…) et ses **sources primaires**. La bibliothèque complète est au §8. Entre crochets : domaines CSSLP et chapitres Kohnfelder (K1 à K13).

### Bloc A · Le métier

#### M1 · Cybersécurité et panorama de la menace

La cybersécurité en grand angle, avant de zoomer sur l'application : qui attaque, par où, et ce que les rapports annuels disent à l'AppSec.

| Niv. | Leçon |
| --- | --- |
| N1 | **La cybersécurité en un coup d'œil** : les six fonctions du **NIST CSF 2.0** (Govern, Identify, Protect, Detect, Respond, Recover), les grands domaines du métier (SOC, GRC, sécurité cloud, réponse à incident, sécurité offensive) et la place de l'AppSec parmi eux. [D1] |
| N1 | **Qui attaque, et pourquoi** : rançongiciel en service et courtiers d'accès initial, acteurs étatiques, hacktivistes, menaces internes. Motivations, moyens, et ce que chacun cherche dans une application. [D1] |
| N1 | **Le panorama en chiffres** et comment lire un rapport annuel (période couverte, échantillon, biais de celui qui publie). **Verizon DBIR 2026** : l'exploitation d'une vulnérabilité est à l'origine de 31 % des violations, un rançongiciel est impliqué dans 48 % (période nov. 2024 – oct. 2025). **Mandiant M-Trends 2026** : dwell time médian de 14 jours. **ENISA Threat Landscape 2025** (juillet 2024 – juin 2025), **Panorama de la cybermenace 2025** de l'ANSSI. [D1] |
| N2 | **Les portes d'entrée qui passent par l'application** : vulnérabilités exposées (premier vecteur initial dans M-Trends 2026, à 32 %, devant le vishing), identifiants volés, supply chain, SaaS et identité. Ce que la menace dit des priorités de l'AppSec. [D1, D5] |
| N2 | **Les affaires qui ont façonné le métier** : Equifax, SolarWinds, Log4Shell, MOVEit, xz utils. Pour chacune, le mécanisme, ce qu'elle a changé (réglementation, pratiques, outils) et la classe de bugs qu'elle illustre ; chronologies établies sur les rapports publics lors de la rédaction. [D1, D7] |
| N2 | **Pourquoi le logiciel reste vulnérable** : économie de la sécurité, incitations mal alignées entre éditeur et client, dette, **CISA Secure by Design** comme réponse. Organiser une veille qui tient dans la semaine (§8.9). [D2] |

#### M2 · MITRE ATT&CK et la menace SaaS

Le vocabulaire commun de l'attaque, et le pont avec l'ATT&CK SaaS Academy.

| Niv. | Leçon |
| --- | --- |
| N1 | **ATT&CK : histoire et logique** : tactiques, techniques, sous-techniques, procédures, groupes, campagnes. **v18** (28/10/2025) : les *Detections* et *Data Sources* des techniques laissent la place aux **Detection Strategies** et aux **Analytics**. **v19** (28/04/2026) : *Defense Evasion* est scindée en **Stealth** et **Defense Impairment** ; un texte qui cite TA0005 comme tactique actuelle est daté. [D4] |
| N1 | **Les quatre usages d'ATT&CK** : renseignement, détection, émulation d'adversaire, évaluation de couverture. Un même vocabulaire pour quatre métiers, et pour parler au SOC (M22). [D4, D7] |
| N2 | **La menace SaaS et identité** : fatigue MFA, consentement OAuth abusif (T1528), sessions et jetons rejoués, règles de boîte mail, partage externe. Ce qui relève de l'application que tu conçois (pont vers M14). [D4] |
| N2 | **Se protéger : les mitigations qui comptent** : les mesures qui couvrent le plus de techniques (MFA résistante au phishing, durcissement des consentements, journalisation), et l'ordre dans lequel les déployer. [D4, D7] |
| N2 | **Cas réels décortiqués** : Uber, MGM, CircleCI, Snowflake, Midnight Blizzard et **Storm-0558**, étape par étape, technique par technique. Pour Storm-0558, le rapport du **CSRB** (daté du 20/03/2024) : une clé de signature MSA de 2016 volée, la rotation manuelle des clés arrêtée en 2021. [D7] |
| N3 | **Du TTP à la classe de bug** : relier une technique ATT&CK aux CWE et CAPEC qui la rendent possible dans ton code (chaîne CWE → CAPEC → ATT&CK, approfondie en M11). [D4, D5] |

#### M3 · Présentation de l'AppSec

| Niv. | Leçon |
| --- | --- |
| N1 | Du pentest à l'AppSec : échelle, classes de bugs, relation aux devs, ROI. « La sécurité est l'affaire de tous » (Kohnfelder, postface). Carte des référentiels et de leur usage (Top 10 = sensibiliser, ASVS = exiger/vérifier, SAMM = piloter, BSIMM = se comparer, DSOMM = piloter un pipeline, SSDF = conformité, CRA = réglementation). [D2] |
| N1 | **Confiance** (K1) : la confiance est un spectre, les composants implicitement fiables (OS, runtime Node, registre npm, cloud), réduire le nombre de parties à qui on fait confiance, être digne de confiance. [D1] |
| N1 | **C-I-A et le Gold Standard** (K1) : authentification, autorisation, audit. Non-répudiation, responsabilité. Ce que chaque propriété exige concrètement de Novafact. [D1] |
| N1 | **Le SSDLC et la carte du parcours** : SDL, **NIST SSDF** (SP 800-218) et **OWASP SAMM** décrivent les mêmes phases (exigences, conception, implémentation, vérification, déploiement, exploitation) avec des mots différents. Comment les blocs C à F du parcours les suivent, et où se placent l'IA (G) et le pilotage (H). [D2] |
| N1 | Principes DevSecOps : shift left *et* shift right, paved road (Netflix), secure by default, *safe coding* (Google : éliminer les classes de bugs par les API et frameworks), garde-fous plutôt que barrières. [D2] |

#### M4 · Les métiers de l'AppSec

Qui fait quoi, où se range l'équipe, et ce qui se transfère d'une carrière de pentester.

| Niv. | Leçon |
| --- | --- |
| N1 | Le rôle : l'AppSec comme *enabling team* (Team Topologies), de l'auditeur au partenaire. Ce qui change quand on passe du rapport de pentest au backlog d'une équipe produit. [D2] |
| N1 | **Panorama des rôles** : AppSec et product security, architecte sécurité, DevSecOps, PSIRT, pentester, SOC, et qui intervient où dans le cycle. Trois référentiels pour les nommer : le **NICE Framework** (NIST SP 800-181r1, rôle *Secure Software Development*, DD-WRL-003), l'**ECSF** de l'ENISA (douze profils, aucun « AppSec engineer » : le plus proche, *Cybersecurity Implementer*, cite « DevSecOps Engineer » parmi ses intitulés) et le **Panorama des métiers** de l'ANSSI (édition 2020, fiche « Spécialiste en développement sécurisé »). [D2] |
| N2 | **Organiser l'équipe** : rattachement (dans BSIMM16, le dirigeant le plus proche de l'équipe sécurité logicielle est un CISO dans 49 % des cas), cinq structures qui se recouvrent, centralisée ou fédérée. Les ratios réels : la moyenne de 5,63 membres pour 100 développeurs est tirée par des valeurs extrêmes, la **médiane est de 1,8**, et de 1,13 au-delà de 650 développeurs. Le modèle de Netflix (*Appsec Partnerships* et *Appsec Engineering*, 2022). [D2] |
| N2 | **Security Champions** : recruter, animer, reconnaître, mesurer (OWASP Security Champions Guide et ses dix principes ; *Security Champions Playbook* et ses six étapes). Répartir les rôles entre AppSec, champions et équipes. [D2] |
| N2 | **Travailler avec les autres fonctions** : SOC (journaux, runbooks), DPO (vie privée), juridique (contrats, divulgation), achats (fournisseurs), produit (priorités). Les interfaces, et qui décide quoi. *Building Secure and Reliable Systems*, ch. 20 et 21. [D2] |
| N2 | **Le cadre juridique du métier** : l'autorisation écrite avant de tester (périmètre, mandat, données), la divulgation coordonnée, la protection du signalement de bonne foi, la responsabilité du fabricant que crée le CRA. Ce qu'un pentester devenu AppSec doit encore vérifier avant d'agir. [D2, D3] |
| N1 | **Compétences, certifications et carrière** : ce qui se transfère du pentest, ce qui s'apprend. Certifications : **CSSLP** (8 domaines, 4 ans d'expérience), GIAC **GWEB** (SEC522) et **GCSA** (SEC540), OffSec **OSWE** (examen surveillé de 48 h, en boîte blanche), qualification **PASSI** côté prestataire, formations labellisées **SecNumedu**. Le marché : l'*ISC2 Workforce Study 2025* place le manque de compétences devant le manque d'effectifs ; l'Observatoire des métiers de l'ANSSI (2025) compte 52 % de reconversions. [D2] |

#### M5 · Maturité et posture de sécurité

Le diagnostic avant le plan : où en est l'organisation, et comment le savoir sans se raconter d'histoire.

| Niv. | Leçon |
| --- | --- |
| N1 | **Maturité ou posture ?** La maturité mesure la capacité des processus, la posture l'exposition à un instant. Une organisation mature peut être exposée (un service oublié), une organisation exposée peut sembler sûre (pas encore de pentest) : chacune ment quand on la regarde seule. [D2] |
| N2 | **OWASP SAMM v2** : 5 fonctions, 15 pratiques, 2 streams, 3 niveaux. Mener une évaluation (SAMM Toolbox). [D2] |
| N2 | **BSIMM16** (janv. 2026, 111 organisations) : modèle descriptif vs SAMM prescriptif. Ce que font vraiment les programmes matures, et la montée de l'IA et des SBOM. SAFECode *Fundamental Practices*. [D2] |
| N2 | **Les autres modèles** : OWASP **DSOMM** pour le pipeline, profils du **NIST CSF 2.0**, **SOC-CMM** (cinq domaines : Business, People, Process, Technology, Services). Choisir un modèle selon la question posée, sans les collectionner. [D2] |
| N2 | **Mesurer la posture applicative** : inventaire des applications et de leurs propriétaires, surface d'attaque exposée, ASPM, **OpenSSF Scorecard** sur les dépôts, notations externes et leurs limites. [D2, D7] |
| N3 | **Un état des lieux en deux semaines** : entretiens, échantillon de dépôts, preuves plutôt que déclarations, restitution. Le diagnostic qui ouvre le programme (M31). [D2] |

### Bloc B · Le web et ses vulnérabilités

#### M6 · Le web et ses protections

Les rappels qui servent tout le bloc. Le public les connaît côté attaque ; on les relit pour savoir quelle protection agit à quelle étape.

| Niv. | Leçon |
| --- | --- |
| N1 | **De l'URL au pixel** : DNS, TCP et TLS, requête HTTP, CDN et répartiteur, application, rendu. À chaque étape, la protection qui s'applique et celui qui la configure. [D1, D5] |
| N1 | **HTTP de bout en bout** : HTTP/1.1, 2 et 3, la chaîne CDN → répartiteur → application de Novafact, et qui interprète quoi (en-têtes, longueur du corps, hôte). La base des désynchronisations de M9. [D5] |
| N1 | **URL, origine, site et DNS** : deux parseurs d'URL (WHATWG et historique) qui ne s'accordent pas, l'origine et le site, la liste des suffixes publics, la résolution DNS et ce qu'elle permet (rebinding). [D5] |
| N2 | **TLS et certificats en pratique** (K5, K11) : ce que « vérifier un certificat » veut dire (chaîne, nom, validité, révocation), le défaut sûr de Node qu'on désactive pour « dépanner » (`rejectUnauthorized`), la confidentialité persistante, **CAA** et **Certificate Transparency**, les certificats de courte durée. Cas **DigiNotar** (2011) : 531 certificats frauduleux selon le rapport de Fox-IT. [D1, D5] |
| N1 | **Le modèle de sécurité du navigateur** : same-origin policy, lire ou envoyer, CORS comme assouplissement (pas comme protection), isolation des sites. [D5] |
| N2 | **Cookies et état** : attributs, SameSite, préfixes `__Host-`, partitionnement, stockage côté client et ce qui y fuit. [D5] |
| N2 | **La carte des en-têtes de sécurité** : HSTS, CSP, `frame-ancestors`, COOP, CORP, `Permissions-Policy`, `Referrer-Policy` : ce que chacun ferme. Leur conception est en M8, leur application en production en M21. [D5, D7] |
| N1 | Rappel éclair : **OWASP Top 10:2025** (A03 Software Supply Chain Failures, A10 Mishandling of Exceptional Conditions, SSRF intégrée à A01), **API Security Top 10 2023**, CWE Top 25. [D5] |

#### M7 · Vulnérabilités côté serveur

Express, Node.js et Next.js vus du côté défenseur.

| Niv. | Leçon |
| --- | --- |
| N1 | Entrées non fiables (K10) : définir la validité, rejeter ou corriger, longueur et Unicode. Express : SQLi via query builders et ORM (`knex.raw`, `sequelize.literal`, `$queryRawUnsafe`), **injection NoSQL**, mass assignment, BOLA/BFLA. Validation par schéma (zod, ajv) intégrée au framework pour qu'on ne puisse pas l'oublier. [D5] |
| N1 | **Footguns JavaScript** (K8) : `==`, `parseInt`, tri par défaut, `Date` permissif, clés d'objet, `Number` et la limite 2^53. **Arithmétique et argent** (K9) : montants en flottants, arrondis, quantités négatives, dépassements. Chez Novafact : centimes entiers, `BigInt` ou décimal, calcul côté serveur. [D5] |
| N2 | Spécificités Node : **prototype pollution** serveur, **ReDoS** et boucle d'événements, path traversal (`join` vs `resolve`), SSRF (IMDS, DNS rebinding), SSTI, `vm`/`vm2` ne sont pas des bacs à sable, `exec` vs `execFile`, `url.parse` vs WHATWG `URL`. Le **modèle de menaces officiel de Node.js**. [D5] |
| N2 | Erreurs et exceptions (A10, K13) : promesses non gérées, échec sûr, messages d'erreur qui fuient, état incohérent après exception. **Atomicité et TOCTOU**, attaques temporelles (`crypto.timingSafeEqual`), sérialisation (K8). [D5] |
| N2 | **XML, DTD et XXE** (K10) : ce que XML sait faire et que JSON ne sait pas (entités, DTD), lecture de fichiers et SSRF par entité externe, **expansion d'entités** sans récursion. Ce que font vraiment les parseurs Node. Cas : **CVE-2026-26278** (fast-xml-parser, une entité interne citée cent fois suffit, sans aucune entité externe) et son correctif incomplet CVE-2026-33036 ; **CVE-2025-66516** (Apache Tika, XXE par un fichier XFA embarqué dans un PDF). Défense en couches : parseur sans DTD, limites, isolation. [D5] |
| N2 | **HTML côté serveur, XSS et jetons CSRF** (K11) : contexte de sortie (corps, attribut, URL, script), pourquoi un seul échappement ne suffit pas, moteurs de templates et leurs échappatoires, jeton CSRF lié à la session, secrets et identifiants dans l'URL (`Referer`). Cas : **CVE-2024-43796** (`res.redirect()` d'Express : ce qu'on a nettoyé n'est pas ce qu'on a validé), **CVE-2015-2286** (Open edX, jeton de réinitialisation fuité par `Referer`). [D4, D5] |
| N2 | **Fichiers : upload, téléchargement et chemins** : type réel contre extension et `Content-Type` déclarés, stockage isolé hors de l'application (S3, URL présignées), noms de fichiers générés, traversée de chemin au téléchargement, `Content-Disposition` et rendu dans une origine séparée. Le pipeline d'upload isolé est conçu en M13. [D5] |
| N3 | Méta-frameworks : Server Actions = endpoints publics, **CVE-2025-29927** (middleware Next.js), **CVE-2024-34351** (SSRF via Host dans les Server Actions), **React2Shell CVE-2025-55182** (désérialisation Flight, CVSS 10). La doc Next.js « How to think about security ». [D5] |
| N3 | Éliminer une classe entière : wrappers sûrs, règles ESLint (`eslint-plugin-security`, `no-unsanitized`), sécurité déclarative vs impérative, *paved roads*. [D5] |

#### M8 · Vulnérabilités côté client & scripts tiers

Le navigateur exécute ton code et celui des autres, avec les mêmes droits. Le sujet est propre à l'écosystème JS et touche directement la page de paiement de Novafact.

| Niv. | Leçon |
| --- | --- |
| N1 | Le client n'est pas sous ton contrôle : validation côté client = confort, pas sécurité. Secrets exposés dans le bundle (`VITE_*`, `NEXT_PUBLIC_*`), source maps en production, clés d'API dans le JS. [D5] |
| N2 | React et navigateur (K11) : modèle de sécurité web (SOP, cookies, vus en M6), sinks XSS (`dangerouslySetInnerHTML`, `href="javascript:"`, rendu Markdown), DOMPurify, stockage des jetons, CSRF et SameSite, CORS, `postMessage`. S'appuyer sur le framework plutôt que le contourner. Les défenses navigateur (Trusted Types, CSP, Sanitizer API) et les scripts tiers sont approfondis dans la suite du module. [D4, D5] |
| N1 | **Scripts tiers** : analytics, chat, tag manager, A/B testing, CDN. Un script tiers a les droits de ton code (l'anti-pattern *third-party hooks*, K4). Cas : British Airways et Ticketmaster (Magecart, 2018), polyfill.io (domaine racheté, 2024). [D4, D8] |
| N2 | Réduire la confiance : inventaire et propriétaire de chaque script, auto-hébergement, SRI et ses limites, iframes en `sandbox` avec `allow` minimal, tag manager sous contrôle, `Permissions-Policy`. Isoler le paiement dans l'iframe du prestataire. [D4, D5] |
| N2 | **CSP stricte en pratique** pour React, Vite et Next (nonce, `strict-dynamic`, hashes pour une SPA statique), déploiement *report-only* puis bloquant, Reporting API. La CSP comme **capteur** : les rapports envoyés vers Elastic. [D5, D7] |
| N2 | Défenses DOM modernes : **Trusted Types** (politique par défaut, intégration React), **Sanitizer API** et `setHTML()` (Firefox 148 le premier, en février 2026 ; support encore partiel), DOMPurify en repli. [D5] |
| N2 | Isolation d'origine : **Fetch Metadata** (`Sec-Fetch-*`) et *resource isolation policy* dans Express, COOP/COEP/CORP, cookies `__Host-` et partitionnés, XS-Leaks vus côté défense. Service workers : portée, cache, persistance d'une XSS. [D5] |
| N3 | **PCI DSS 4.0.1** : exigences 6.4.3 (inventaire, autorisation et intégrité des scripts de la page de paiement) et 11.6.1 (détection de modification des scripts et en-têtes), obligatoires depuis le 31/03/2025. Depuis janvier 2025, elles sont retirées du SAQ A au profit d'un critère d'éligibilité : la page qui embarque l'iframe du prestataire ne doit pas être exposée aux attaques par script. Ce que ça impose à Novafact. [D3, D7] |
| N3 | Surveiller le client : détection de changement de scripts (empreintes, rapports CSP, outils de protection côté client), réponse à un skimmer (retrait, investigation, notification), supply chain du front (lockfile, bundle, CDN). [D7, D8] |

#### M9 · Web avancé : le programme PortSwigger (N3)

Les sujets « Advanced » de la Web Security Academy et la recherche 2023-2026, relus avec deux questions : *pourquoi l'architecture le permet* et *quel contrôle ou quelle détection le rend impossible chez Novafact*. Labs Practitioner et Expert uniquement (voir §6).

| Niv. | Leçon |
| --- | --- |
| N2 | **Race conditions** : single-packet attack (*Smashing the state machine*, 2023), limit overrun, multi-endpoint, partial construction. En Node, un `await` entre la vérification et l'action suffit. Correctifs : contraintes uniques, transactions, `SELECT … FOR UPDATE`, opérations atomiques Mongo, clés d'idempotence. Cas : *Eclipse on Next.js* (zhero). [D5] |
| N2 | **HTTP Host header** : empoisonnement de reset de mot de passe, `trust proxy` et `X-Forwarded-Host` dans Express, SSRF par routage. Correctif : URL absolues issues de la config, liste blanche d'hôtes. [D5] |
| N2 | **API avancée et GraphQL** : server-side parameter pollution, mass assignment, brute force par batching/alias, contournement d'introspection, limites de profondeur et de coût. [D5] |
| N2 | **Chaînes de vulnérabilités** (K8, *vulnerability chains*) : des bugs mineurs qui, combinés, deviennent critiques. Ce que ça change pour le triage (M26) et la revue de conception (M13). [D5, D6] |
| N3 | **Request smuggling et desync** : CL.TE, TE.CL, rétrogradation H2, client-side desync, pause-based, **0.CL et Expect** (*HTTP/1.1 must die*, 2025), **CRLF-powered desync** (2026). Côté Novafact : llhttp strict, mode *desync mitigation* de l'ALB, HTTP/2 de bout en bout. [D5, D7] |
| N3 | **Web cache poisoning et deception** : entrées hors clé, parameter cloaking, fat GET, divergences de normalisation (*Gotta cache 'em all*, 2024). Série Next.js de Rachid Allam : CVE-2024-46982, CVE-2025-49826, *the stale elixir* (Top 10 2025, n° 7). Correctif : politiques de cache CloudFront, `Cache-Control: private`, clés de cache conçues. [D5, D7] |
| N3 | **Parser differentials** : normalisation Unicode (*Lost in Translation*, Top 10 2025), *Splitting the email atom* (2024), JSON à clés dupliquées, parsers d'URL, cookies (*phantom $Version*), *Parser Differentials* (joernchen, Top 10 2025). **Fuite via ORM** (*ORM Leaking More Than You Joined For*, Top 10 2025, n° 2) appliquée aux filtres Prisma. [D5] |
| N3 | **SSTI et injection de code** : SSTI aveugle par erreurs (*Successful Errors*, Top 10 2025, n° 1), évasions de bac à sable JS, la mort de `vm2`. Correctif : isolation par processus ou `isolated-vm`, templates sans logique. [D5] |
| N3 | **Désérialisation et prototype pollution avancées** : `node-serialize`, `js-yaml` ancien, Flight (React2Shell). Détection non destructive (Heyes, 2023), gadgets (*Silent Spring* 2023, *GHunter* 2024). Correctif : `Object.create(null)`, `Map`, `--disable-proto`, schémas stricts. [D5] |
| N3 | **Protocoles d'auth avancés** : JWT (`jwk`/`jku`/`kid`, confusion d'algorithme), OAuth *dirty dancing* (Frans Rosén), **SAML** : *SAML roulette*, *The Fragile Lock* (PortSwigger, 2025), **SAMLStorm** (xml-crypto, CVE-2025-29775). Pont vers M14. [D5] |
| N3 | **SSRF avancée** : boucles de redirection (Top 10 2025, n° 3), DNS rebinding, HTTP/2 CONNECT (Top 10 2025, n° 9), SSRF dans Next.js (Assetnote). Correctif : egress proxy, IMDSv2, filtrage après résolution. [D5, D7] |
| N3 | **Client avancé** : DOM Invader, DOM clobbering, contournements de CSP (script gadgets, dangling markup), **XS-Leaks** (xsleaks.dev, *ETag length leak* et *XSS-Leak*, Top 10 2025), CSWSH, *CSS: the bomb inside your inbox* et *What's in a tag name?* (PortSwigger, 2026). [D5] |
| N3 | **Web LLM attacks** (sujet Academy), approfondi en M27. *Meet the HTTP Terminator* (Kettle, 2026) : une IA qui invente des variantes de desync, et ce que ça change pour la défense. [D5] |

### Bloc C · Concevoir

#### M10 · Analyse de risques

Avant de modéliser les menaces : partir du métier, apprécier, quantifier, traiter, et faire accepter le risque résiduel par quelqu'un qui en a l'autorité.

| Niv. | Leçon |
| --- | --- |
| N1 | **Le vocabulaire du risque** : menace, vulnérabilité, vraisemblance, impact, risque inhérent et résiduel, appétence. **CVSS mesure une sévérité, pas un risque** : c'est le guide utilisateur de FIRST qui le dit (v3.1 §2.1, repris en v4.0). ISO/IEC 27005:2022 et ISO 31000:2018 comme cadre. [D2, D3] |
| N2 | **EBIOS Risk Manager appliqué à Novafact** (guide ANSSI v1.5) : cinq ateliers, des valeurs métier et événements redoutés jusqu'aux scénarios stratégiques et opérationnels, puis au plan de traitement. Trois classes d'acceptation (acceptable en l'état, tolérable sous contrôle, inacceptable). La méthode se déclare conforme à l'ISO/IEC 27005:2022. Les événements redoutés alimentent le threat model de M11. [D2, D3] |
| N2 | **Noter sans se mentir** : OWASP Risk Rating Methodology (vraisemblance × impact, facteurs notés de 0 à 9), les biais des matrices de risque (Cox, *What's Wrong with Risk Matrices?*, 2008 : une matrice départage correctement moins de 10 % des paires de risques tirées au hasard), l'abandon de **DREAD** : Microsoft est passé aux *bug bars*, selon Shostack (2018), faute d'échelles définies. [D2] |
| N3 | **Quantifier avec FAIR** : fréquence et ampleur des pertes, distributions plutôt que points, simulation Monte-Carlo, un risque exprimé en euros. Open FAIR (O-RT v3.1 et O-RA v2.1, mai 2025), FAIR-CAM pour l'effet des contrôles, Hubbard et Seiersen (2e éd., 2023). [D2] |
| N2 | **Traiter le risque et tenir le registre** : réduire, transférer, éviter ou accepter ; un registre des risques cyber qui vit (NIST IR 8286r1, déc. 2025), relié aux décisions et revu. Outils : MONARC (libre), MEHARI (CLUSIF). [D2, D7] |
| N3 | Gestion des risques intégrée : risque technique vs risque métier, analyse et appréciation, acceptation formelle et *sign-off* au bon niveau. NIST SSDF (SP 800-218), CISA Secure by Design. L'ancrage français : l'**homologation de sécurité** (guide ANSSI/DINUM v2.2, mars 2026, « homologuer en quatre étapes »). Cas : Storm-0558, où le CSRB décrit des décisions qui n'ont pas priorisé la gestion du risque ; Capital One, sanctionnée par l'OCC (80 M$, 2020) pour ne pas avoir apprécié le risque avant la migration vers le cloud. [D2, D7] |

#### M11 · Threat modeling & MITRE

| Niv. | Leçon |
| --- | --- |
| N1 | Les 4 questions (Shostack, K2), Threat Modeling Manifesto. La démarche de Kohnfelder : partir d'un modèle, identifier actifs, surfaces d'attaque, frontières de confiance, menaces, mitigations. Les actifs et événements redoutés viennent de l'analyse de risques (M10). [D4] |
| N1 | STRIDE par élément (et la propriété que chaque menace viole), abuse cases, jeux de cartes (Elevation of Privilege, OWASP Cornucopia). [D4] |
| N2 | Arbres d'attaque, PASTA, Hybrid Threat Modeling Method, LINDDUN (vie privée) : choisir la méthode. Prioriser sans DREAD. Menaces courantes : APT, initié malveillant, fournisseurs tiers. [D4] |
| N2 | MITRE pour l'AppSec : ATT&CK Enterprise et Cloud (T1190, T1195…), **CAPEC**, **D3FEND**, chaîne CWE → CAPEC → ATT&CK. Threat intelligence utile à la conception. Pont vers M2 et l'ATT&CK SaaS Academy. [D4] |
| N2 | Threat modeling agile et « as code » : incrémental, dans la PR/l'ADR. **AWS Threat Composer**, OWASP Threat Dragon, pytm, Threagile. « Threat modeling everywhere » (K2). [D4] |
| N3 | Modéliser l'IA (ATLAS, agents, MCP), la supply chain (modèle SLSA), le cloud, **l'environnement de développement lui-même** (K13 : le code source comme actif principal). Animer un atelier avec des devs. Revue de risque architecturale. [D4, D8] |

#### M12 · Exigences, vie privée & conformité

Le module qui couvre le domaine « exigences » du CSSLP (13 %). Les fondations de Kohnfelder (K1) sont posées en M3.

| Niv. | Leçon |
| --- | --- |
| N1 | Exigences de sécurité : fonctionnelles (stories, use cases) et non fonctionnelles (performance, continuité, déploiement). Les tirer d'ASVS 5.0 (niveaux L1–L3, 17 chapitres). **Misuse et abuse cases**, avec le contrôle qui les neutralise. [D3] |
| N2 | **Matrice de traçabilité des exigences** (SRTM) : exigence → conception → code → test → preuve. La tenir dans le dépôt (ASVS ID dans les tests). [D3, D6] |
| N2 | **Classification des données** : propriétaire, dépositaire, dictionnaire de données, étiquetage par sensibilité et impact, cycle de vie (création, stockage, rétention, destruction). Cartographier les données de Novafact (factures, IBAN, données personnelles, secrets). [D3] |
| N2 | **Vie privée** : RGPD (minimisation, base légale, droits des personnes dont l'effacement, durées de conservation), pseudonymisation vs anonymisation, transferts hors UE et résidence des données, *privacy by design* (K1, K2, K6). LINDDUN en pont vers M11. [D3] |
| N2 | Conformité : réglementaire (RGPD, NIS2, CRA), sectorielle (**PCI DSS 4.0.1** pour le paiement, périmètre réduit par tokenisation), interne (standards, outils imposés). Exigences envers les fournisseurs tiers. La transposition française de NIS2 n'est pas encore adoptée : voir §8.14. Les obligations de notification sont traitées en M25. [D3, D8] |
| N3 | Provisionnement des accès : comptes utilisateurs, comptes de service, recertification périodique, départs. Du besoin métier à la politique IAM (pont vers M19). [D3] |

#### M13 · Spécifier et concevoir

De la spécification fonctionnelle (le *quoi*, écrit avec le produit) à la spécification technique (le *comment*, le design doc), avec le cœur de *Designing Secure Software* (K3 à K7) appliqué à Novafact.

| Niv. | Leçon |
| --- | --- |
| N1 | **La spécification fonctionnelle de sécurité** : user stories de sécurité, critères d'acceptation testables (« étant donné… quand… alors » : le refus est un critère, pas un détail), matrice des droits (rôle × action × objet × tenant), parcours sensibles (réinitialisation, changement d'IBAN, export). Écrite avec le produit, à partir des exigences de M12 et des menaces de M11 ; c'est elle que les tests de M17 vérifient. [D3, D4] |
| N1 | **Mitigations structurelles** (K3) : réduire la surface d'attaque, **réduire la fenêtre de vulnérabilité** (le code à haute confiance fait le minimum et rend la main), **minimiser l'exposition des données** (durée de vie des secrets en mémoire, suppression réelle). Politiques d'accès, interfaces, communication, stockage. [D1, D4] |
| N1 | **Les 14 patterns de Kohnfelder** (K4), regroupés : attributs de conception (économie, transparence), minimisation de l'exposition (moindre privilège, moindre information, sûr par défaut, listes blanches, imprévisibilité, échec sûr), application stricte (médiation complète, mécanisme le moins commun), redondance (défense en profondeur, séparation des privilèges), confiance et responsabilité (réticence à faire confiance, assumer sa part). Correspondance avec Saltzer & Schroeder et les principes du CSSLP (conception ouverte, acceptabilité psychologique, réutilisation de composants). [D1] |
| N1 | **Les 4 anti-patterns** (K4) en version JS/cloud : *confused deputy* (un endpoint qui agit avec ses droits pour le compte de l'appelant, un serveur MCP), *backflow of trust* (un runner CI peu fiable qui pilote la prod, un poste perso qui administre), *third-party hooks* (scripts tiers dans le front, polyfill.io), *unpatchable components* (paquet npm abandonné, Node en fin de vie, code vendorisé). [D4] |
| N3 | Patterns d'architecture : API gateway, BFF, microservices et messages (files, événements), authentification service à service (mTLS, identité de workload), pipeline d'upload isolé, **tokenisation**, isolation (bacs à sable, conteneurs). Modéliser les propriétés non fonctionnelles, architecture opérationnelle (topologie, CI/CD). [D4, D5] |
| N3 | Conception d'interfaces : interfaces d'administration et hors bande, interfaces de logs, dépendances amont/aval (clés et données partagées), choix de protocoles et gestion d'état. Sécurité des bases (vues, privilèges, connexions chiffrées). [D4] |
| N2 | **Crypto pour développeurs** (K5) : CSPRNG (`crypto.randomUUID`, jamais `Math.random`), MAC et rejeu (webhooks signés avec horodatage), chiffrement symétrique et asymétrique, signatures, certificats, échange de clés. `node:crypto` et WebCrypto, KMS, chiffrement d'enveloppe, **agilité cryptographique**, rotation. Envelopper une API crypto pour la rendre difficile à mal utiliser (exercice K5). [D1, D5] |
| N2 | **Crypto : hash, nonces et métadonnées** (K5) : ce qu'un hash prouve et ce qu'il ne prouve pas (collisions : SHAttered, 2017 ; Flame, 2012), l'extension de longueur qui rend `sha256(secret + message)` forgeable et justifie HMAC, ce que fuit un nonce réutilisé, RSA brut et le rembourrage PKCS#1 v1.5 (Node l'a désactivé dans `privateDecrypt` après CVE-2023-46809, attaque Marvin), ce que le chiffrement laisse voir (taille et compression : CRIME, BREACH). Chiffrer dès l'entrée ou tokeniser. [D1, D5] |
| N2 | **La spécification technique : écrire un design doc sécurisé** (K6, annexe A) : rendre les hypothèses explicites, définir le périmètre et les non-objectifs, exigences, threat model, conception des interfaces et du traitement des données, vie privée, tout le cycle de vie, compromis, simplicité. Chaque choix technique renvoie à une exigence de la spécification fonctionnelle. Exercice : le design doc de l'export comptable de Novafact. [D2, D4] |
| N2 | **Mener une Security Design Review** (K7) : Study, Inquire, Identify, Collaborate, Write, Follow up. Où creuser, priorisation *Must / Ought / Should*, revue des évolutions, gérer le désaccord et l'escalade. Le designer a le dernier mot : documenter les positions divergentes. [D4] |

#### M14 · Identité : authentification, autorisation, OAuth & SAML

| Niv. | Leçon |
| --- | --- |
| N2 | Authentification applicative : sessions vs jetons, argon2id, **passkeys/WebAuthn** (SimpleWebAuthn), flux de réinitialisation, limitation de débit, énumération. NIST SP 800-63-4. Acceptabilité psychologique. [D1, D5] |
| N2 | Autorisation : RBAC / ABAC / ReBAC (et DAC/MAC pour le vocabulaire CSSLP), moteur de politiques (OPA, **Cedar** / Verified Permissions, OpenFGA), isolation multi-tenant (RLS PostgreSQL), middleware anti-BOLA. [D5] |
| N1 | Ce qui est mort (implicit, ROPC) et **OAuth 2.1**. Authorization Code + PKCE pas à pas : `state`, `nonce`, `redirect_uri` exact. Identité fédérée et SSO. [D1] |
| N2 | SPA React : **RFC 10017** *OAuth 2.0 for Browser-Based Applications* (BCP, août 2026). BFF vs token-mediating backend vs client navigateur pur, rotation des refresh tokens, où ne pas stocker les jetons. [D5] |
| N2 | Valider un JWT dans Express (`jose`) : `alg`, `iss`, `aud`, `exp`, JWKS/`kid`, confusion d'algorithme. Access token ≠ ID token. Opaque + introspection. RFC 8725 (JWT BCP). [D5] |
| N2 | Attaques : interception de code, `redirect_uri` + open redirect, mix-up, login CSRF, fuite par Referer/logs, *dirty dancing*, consent phishing (lien avec ATT&CK SaaS T1528/T1671 et M2), claim `email` non vérifié (nOAuth). [D5] |
| N3 | **RFC 9700** (Security BCP, janv. 2025), jetons liés (**DPoP** RFC 9449, mTLS RFC 8705), PAR (RFC 9126), RAR (RFC 9396), FAPI 2.0, token exchange (RFC 8693) pour microservices et agents. L'autorisation MCP est traitée en M29. [D5] |
| N3 | **SAML** pour le SSO entreprise : signature wrapping, parsers XML divergents, SAMLStorm (xml-crypto), *The Fragile Lock*. Choisir et durcir une librairie Node (`@node-saml/node-saml`). Gestion des certificats X.509. Pièges Cognito / Auth0 / Keycloak. [D4] |

#### M15 · Anti-abus, prise de contrôle de comptes & fraude

Tout ce qui est « fonctionnellement correct » mais utilisé contre toi. Frontière entre AppSec et Trust & Safety, et vrai risque métier pour un SaaS qui envoie des factures.

| Niv. | Leçon |
| --- | --- |
| N1 | Taxonomie : **OWASP Automated Threats to Web Applications** (OAT-001 à OAT-021 : credential stuffing, credential cracking, création de comptes, scraping…) et **API6:2023** *Unrestricted Access to Sensitive Business Flows*. [D3, D4] |
| N1 | **Credential stuffing et ATO** : signaux, défense en couches (MFA et passkeys, mots de passe compromis via Pwned Passwords et k-anonymat, limitation des échecs selon NIST SP 800-63B, notification de connexion, révocation de sessions). [D5] |
| N2 | **Limitation de débit bien conçue** : quoi limiter (compte, IP, tenant, empreinte), algorithmes (token bucket, fenêtre glissante), `express-rate-limit` + Redis, vraie IP derrière CloudFront, réponses graduées (429, ralentissement, défi). Éviter que le verrouillage de compte devienne une arme de DoS. [D4, D5] |
| N2 | **Bots** : CAPTCHA et alternatives (Cloudflare Turnstile, défis invisibles), **AWS WAF Bot Control et Fraud Control** (ATP pour la connexion, ACFP pour l'inscription), empreinte d'appareil et ses limites RGPD. [D7] |
| N2 | **Abus de fonctionnalités** : l'envoi de factures de Novafact détourné pour du phishing depuis un domaine légitime, comme avec QuickBooks et PayPal (+36,5 % d'attaques via le domaine QuickBooks en 2025 selon KnowBe4). Contrôles : vérification des nouveaux comptes, quotas d'envoi, réputation, analyse du contenu, SPF/DKIM/DMARC, canal de signalement. Abus d'essais gratuits, de coupons, de parrainage. [D3, D4] |
| N2 | **Invariants métier** : montants, états d'une facture, avoirs, remboursements. Machines à états côté serveur, idempotence des paiements, rapprochement. Ponts vers les race conditions (M9) et l'arithmétique (M7). [D4, D5] |
| N3 | Détecter et répondre : signaux dans Elastic (vélocité, nouvel appareil, voyage impossible, séquences EQL), score de risque et authentification adaptative (*step-up*), boucle avec le support client, suspension et preuve. [D7] |

### Bloc D · Construire & vérifier

#### M16 · Revue de code sécurité

Le geste le plus fréquent du métier, et le meilleur pont depuis le pentest : tu sais déjà ce qui est exploitable, il reste à le trouver dans le code avant la mise en production.

| Niv. | Leçon |
| --- | --- |
| N1 | Pourquoi et quand : revue de PR, revue ciblée, audit complet. Ce que la revue trouve et que les outils ratent (autorisation, logique, conception). La « deuxième passe sécurité » (K13). [D5] |
| N1 | **Méthode sur une base inconnue** : cartographier (routes, middlewares, modèles, configuration), lister les sources (`req.body`/`query`/`params`/`headers`, webhooks, fichiers, variables d'env) et les sinks (requêtes brutes, `exec`, templates, `res.redirect`, `fetch`, `innerHTML`), suivre les flux, repérer les contrôles centraux et ce qui les contourne. Outils : ripgrep, Semgrep en exploration, graphe de dépendances. [D5] |
| N1 | **Revoir une PR en 10 minutes** : lire le diff dans son contexte, repérer les changements sensibles (auth, crypto, requêtes brutes, nouvelles routes, dépendances, workflows CI), checklists Express, React, Next, Prisma et GitHub Actions, commentaires actionnables. CODEOWNERS pour router vers l'AppSec. [D5] |
| N2 | **Lire des correctifs de CVE** : diffs de corrections réelles (Next.js, xml-crypto, body-parser, advisories GHSA), cause racine, puis recherche des variantes ailleurs (variant analysis, pont vers M17). [D5] |
| N2 | Revue orientée autorisation et logique : la BOLA ne se voit pas au scanner. Vérifier chaque accès par tenant et par propriétaire, tables de décision, cas limites des machines à états. [D5] |
| N2 | **Revoir du code généré par IA** et les PR d'agents : erreurs typiques (validation absente, dépendances inventées, secrets, crypto approximative), gestion du volume, CodeRabbit ou Claude en appui sans leur déléguer la décision. [D5] |
| N3 | Audit ciblé et limité dans le temps : prioriser sur un gros dépôt (de la surface exposée vers les actifs de valeur, comme en SDR), notes réutilisables, rapport de revue, constats transformés en règles et en tests. Recherche de code malveillant (lien avec M17 et M18). [D5, D6] |

#### M17 · Tests & analyse de code

| Niv. | Leçon |
| --- | --- |
| N1 | Stratégie et plan de test de sécurité : tests fonctionnels et non fonctionnels, boîte blanche et boîte noire, recette, environnement de test. OWASP **WSTG** et OSSTMM comme référentiels. Où placer chaque technique (pre-commit, PR, nightly, release). [D6] |
| N1 | **Tests de sécurité écrits par les devs** (K12) : le cas GotoFail, tests qui vérifient qu'un contrôle refuse (pas seulement qu'il accepte), validation d'entrées, XSS avec Playwright, autorisation avec supertest, **tests de régression de sécurité**, TDD, rattrapage d'une base sans tests. Exercice K12 : écrire le test de régression d'un CVE passé (CVE-2025-29927) avant et après le correctif. [D6] |
| N1 | SAST JS : **Semgrep** (règles `javascript`, `express`, `react`), **CodeQL** (JS/TS, taint tracking), ESLint sécurité, TypeScript strict et avertissements traités comme erreurs. Trier les faux positifs. La revue manuelle est traitée en M16. [D5] |
| N2 | Écrire ses règles : Semgrep taint mode sur vos helpers maison, CodeQL *models as data*. **Variant analysis** : transformer un finding de pentest en règle qui trouve toutes ses variantes. Référence : Trail of Bits Testing Handbook. [D5] |
| N2 | **Fuzzing et tests de propriétés** : Jazzer.js, fast-check. **Disponibilité** (K12) : consommation de ressources, seuils, tests de charge et d'abus avec k6, injection de fautes. Validation cryptographique (entropie, PRNG). [D6] |
| N2 | SCA et SBOM : npm audit / OSV-Scanner / Snyk / Dependabot / Renovate, atteignabilité, paquets malveillants (Socket, GuardDog). SBOM **CycloneDX 1.6** (`cdxgen`, `cyclonedx-npm`), SPDX 3.0, Syft. **CISA 2026 Minimum Elements**. Dependency-Track + VEX. [D5, D8] |
| N2 | DAST et IAST : **ZAP** (automation framework, scan authentifié, OpenAPI), **Nuclei** et templates maison, DAST en CI sur environnement éphémère. Secrets : Gitleaks, TruffleHog, push protection ; corriger = révoquer. [D6] |
| N2 | **Données de test** : générer des données représentatives, ne pas copier la prod, sinon anonymiser, tokeniser, agréger. Fonctionnalités non documentées et vérification de la documentation (messages d'erreur, notes de version). [D6] |
| N3 | **Inspecter du code malveillant** : backdoors, bombes logiques, chaînes à forte entropie, `postinstall` obfusqué. Le test caché de GotoFail (`if (hash[0] == 0x23)`, exercice K12) et le cas xz utils. L'audit d'un paquet npm publié est traité en M18. [D5, D8] |
| N3 | **IA** : revue de code LLM (**CodeRabbit**, Claude Code `/security-review`, Copilot Autofix, Semgrep Assistant) et agents de pentest (**Strix**, XBOW…). Les évaluer sur Juice Shop ou une application de test : détection, faux positifs, non-déterminisme, fuite de code, prompt injection *via le code analysé*. [D5, D6] |
| N3 | Bâtir la plateforme : orchestration/ASPM, dédoublonnage, critères *break/build*, vérification et validation indépendantes, métriques. [D6] |
| N2 | **Tests de limites, de ressources et de fuites** (K12) : les défauts qui ne font jamais échouer le chemin heureux. Extrapoler un coût non linéaire à partir de mesures plutôt que de l'exécuter, tester sous ressources contraintes, alerter avant la limite dure (une colonne `serial` en `integer` qui arrive au bout, un disque qui se remplit), chercher une fuite de donnée privée par une valeur sentinelle. Cas : la consigne de la FAA du 1er mai 2015 sur le Boeing 787, dont un compteur interne débordait après 248 jours sous tension. [D6] |

#### M18 · Pipeline, supply chain & fournisseurs

| Niv. | Leçon |
| --- | --- |
| N1 | **OWASP Top 10 CI/CD Security Risks** (CICD-SEC-1 à 10) appliqué à GitHub Actions. [D7, D8] |
| N1 | Durcir GitHub Actions : `permissions` minimales, *pwn requests*, injection via `${{ github.event.* }}`, cache poisoning, runners self-hosted, environnements, **OIDC vers AWS**, rulesets, CODEOWNERS. Politiques d'organisation : **épinglage SHA imposé** (août 2025), immutable releases, verrouillage des dépendances de workflow (feuille de route 2026). [D7, D8] |
| N1 | **Sécuriser l'environnement de développement** (K13) : séparer dev et prod, vérifier les outils avant de les installer, bac à sable pour les essais, postes à jour. Shai-Hulud a montré que le poste du dev et le runner CI sont les cibles. [D8] |
| N2 | Outils : **zizmor**, actionlint, StepSecurity harden-runner, **OpenSSF Scorecard**, poutine. [D8] |
| N2 | npm : `npm ci` et lockfile, scripts d'installation (`--ignore-scripts`, pnpm 10), délai de quarantaine des nouvelles versions, dependency confusion, typosquatting, *slopsquatting*. **Trusted publishing** (OIDC), **provenance**, **staged publishing**, fin des jetons qui contournent la 2FA (restreints depuis août 2026, plus de publication directe prévue vers janv. 2027). [D8] |
| N2 | Choisir un composant (K13) : maintenance, historique de sécurité, surface, licence. Ne pas réinventer la sécurité, gérer l'héritage. **Licences open source** (copyleft, AGPL) suivies via le SBOM. [D5, D8] |
| N2 | **Vérifier qu'un paquet n'est pas vérolé** (K13) : auditer l'**archive publiée sur npm**, pas le dépôt GitHub. L'archive est ce qui s'installe ; rien n'oblige à ce qu'elle corresponde au dépôt ; une étape de build ajoute du code absent des sources ; un jeton de publication volé publie sans toucher au dépôt. Les étapes, du tarball au verdict : version résolue et `dist.integrity` ; `npm pack` pour récupérer l'archive ; comparaison de l'empreinte sha512 avec celle du lockfile ; `npm audit signatures` et attestation de provenance ; diff de l'archive contre le commit annoncé ; lecture des scripts d'installation et du code minifié ou obfusqué ; contexte (mainteneurs, âge de la version, dépendances nouvelles) ; installation `--ignore-scripts` en bac à sable ; décision, et quarantaine de la version. Cas d'appui (event-stream, xz utils, ua-parser-js, chalk/debug en sept. 2025, Shai-Hulud) : mécanismes et dates à vérifier à la source lors de la rédaction. [D8] |
| N2 | Cas réels : event-stream, ua-parser-js, Codecov, xz utils, polyfill.io, Ultralytics, **tj-actions/changed-files** (mars 2025), chalk/debug (sept. 2025), Nx « s1ngularity » (août 2025), **Shai-Hulud** (sept. 2025 → vagues 2026 dont CHAINDROP, août 2026). [D8] |
| N2 | **Fournisseurs et tiers** (SaaS, prestataire de paiement, fournisseur d'IA) : évaluer (SOC 2, ISO 27001, CSA CCM/CAIQ), responsabilité partagée, notification d'incident et de vulnérabilité, logs vers le SIEM, droit d'audit. Clauses contractuelles : propriété intellectuelle, séquestre de code, responsabilité, SLA. NIST SP 800-161r1, ISO/IEC 27036. [D8] |
| N3 | **SLSA v1.2** (Build track L0–L3 + Source track), attestations in-toto, **Sigstore** (cosign, Fulcio, Rekor), GitHub artifact attestations, `npm audit signatures`, S2C2F, builds reproductibles. Chaîne de conservation et provenance. [D7, D8] |
| N3 | Répondre à un incident supply chain (playbook Shai-Hulud : versions touchées, rotation massive des secrets, nettoyage des runners, chasse dans Elastic). [D7, D8] |

### Bloc E · Déployer

#### M19 · IAM AWS

| Niv. | Leçon |
| --- | --- |
| N1 | Le modèle : principals, politiques (identité, ressource, SCP, **RCP**, permission boundary, session policy), **logique d'évaluation**, clés de condition utiles (`aws:PrincipalOrgID`, `aws:SourceArn`, `aws:SecureTransport`…). [D1, D7] |
| N1 | Zéro utilisateur IAM : IAM Identity Center, rôles, STS, identifiants temporaires, hygiène du compte root. [D7] |
| N2 | Workloads Node : rôle Lambda, *task role* vs *execution role* ECS, EKS Pod Identity, **IMDSv2** (Capital One 2019 : SSRF → IMDSv1 → S3), chaîne d'identifiants du SDK v3, pièges des Cognito identity pools. [D7] |
| N2 | Escalade et abus : `iam:PassRole` + `lambda:CreateFunction`, `CreatePolicyVersion`, trust policies trop larges, *confused deputy* et `ExternalId` (l'anti-pattern K4 en version AWS), **trust policy OIDC GitHub mal filtrée**. [D7] |
| N2 | Moindre privilège en pratique : IAM Access Analyzer (génération depuis CloudTrail, accès inutilisés, custom policy checks en CI), iamlive, last accessed. [D7] |
| N3 | Multi-comptes et **data perimeter** : Organizations, SCP, RCP, périmètres identité/ressource/réseau, break-glass. Côté attaque : Pacu, CloudFox, PMapper, Prowler. [D4, D7] |

#### M20 · Infrastructure as Code

| Niv. | Leçon |
| --- | --- |
| N1 | L'IaC comme surface : misconfigurations (A02), secrets dans le code et le state, dérive. Terraform/OpenTofu, CloudFormation, **AWS CDK en TypeScript**. Configuration de référence (*baseline*). [D7] |
| N1 | Scanners : **Checkov**, **Trivy**, KICS, **cdk-nag**, cfn-lint/cfn-guard. Où les placer. [D7] |
| N2 | Policy as code : **OPA/Rego + Conftest**, politiques Checkov maison, cfn-guard. Stratégie de blocage et d'exceptions. [D7] |
| N2 | State et pipeline : backend S3 chiffré avec verrou, rôles OIDC séparés plan/apply, revue du plan comme artefact. Supply chain IaC : épinglage des modules et providers, `.terraform.lock.hcl`. [D7, D8] |
| N3 | Dérive et runtime : CSPM (Prowler, Security Hub), AWS Config, préventif vs détectif. Modules « paved road ». Manifests Kubernetes et Kyverno (pont vers M21). [D7] |

#### M21 · Déploiement, exploitation & résilience

| Niv. | Leçon |
| --- | --- |
| N1 | Configuration de prod : secrets (Secrets Manager plutôt que variables d'env), `NODE_ENV`, erreurs verbeuses (A10), **helmet**, en-têtes (HSTS, CSP, COOP, CORP, Permissions-Policy), cookies `__Host-`. Gestion des certificats (ACM). [D7] |
| N1 | Conteneurs Node : multi-stage, `npm ci --omit=dev`, `USER node`, images distroless/minimales, FS en lecture seule, secrets BuildKit, scan d'image (Trivy, Grype). [D7] |
| N2 | Publier en sécurité : signature et admission (cosign, AWS Signer, Kyverno), vérification des artefacts (signatures, empreintes), gestion des changements, autorisation de mise en production (*approval to operate*). [D7] |
| N2 | AWS : ECS Fargate, Lambda, EKS (Pod Security Standards, NetworkPolicy), **CloudFront + AWS WAF** (règles managées, rate-based), mode *desync mitigation* de l'ALB, S3 + OAC. [D7] |
| N2 | En-têtes en production : appliquer la CSP et les en-têtes conçus en M8 au bon endroit (Express/helmet ou *response headers policy* CloudFront), vérifier après chaque déploiement, rapports vers Elastic. [D7] |
| N2 | **Résilience et continuité** : sauvegardes immuables (AWS Backup Vault Lock, S3 Object Lock, copie inter-comptes), plans de reprise et de continuité, tests de restauration, résistance au DoS, SLO et SLA. Le ransomware cloud comme scénario. [D7] |
| N2 | **Fin de vie** : décommissionner un service (révoquer les identifiants, supprimer configuration et DNS, archiver), disposition des données (rétention, destruction, dépendances). Éviter les composants non patchables (K4). [D2, D7] |
| N3 | Protection à l'exécution : livraison progressive (feature flags, canary, kill switch), virtual patching WAF, RASP, modèle de permissions Node (`--permission`), Falco, rotation de secrets sans coupure. [D7] |

### Bloc F · Security Operations

#### M22 · SOC et renseignement sur la menace

Ce que l'AppSec doit savoir du SOC et du renseignement, sans devenir analyste : ce que fait l'autre côté, ce qu'il attend de l'application, et ce que le renseignement change à tes priorités.

| Niv. | Leçon |
| --- | --- |
| N1 | **Ce que fait un SOC** : missions, tiers d'analyse, modèles interne, MSSP et MDR, métriques et maturité. Références : MITRE *11 Strategies of a World-Class Cybersecurity Operations Center* (2022), **SOC-CMM**, FIRST *CSIRT Services Framework* v2.1, et côté France le référentiel **PDIS** de l'ANSSI pour un SOC externalisé qualifié. [D7] |
| N1 | **Ce que le SOC attend de l'application** : des journaux exploitables (OWASP **A09:2025**, renommé *Security Logging and Alerting Failures* ; *Logging Vocabulary* pour nommer les événements), des runbooks par application, des contacts joignables, le contexte (actifs, propriétaires, flux normaux). L'interface entre l'AppSec et le SOC, et qui écrit quoi. [D5, D7] |
| N2 | **Le renseignement utile à l'AppSec** : la *Pyramid of Pain* (Bianco, 2013) pour préférer les TTP aux indicateurs, le modèle en diamant (Caltagirone et al., 2013), **STIX/TAXII 2.1**, **MISP** et OpenCTI, **TLP 2.0** (FIRST, 2022, avec AMBER+STRICT). Consommer le renseignement sans s'y noyer : ce qui change une décision de conception ou de priorisation. Lecture recommandée : The DFIR Report. [D7] |
| N3 | **Chasser dans les journaux** : **PEAK** (Splunk SURGe, 2023 : chasse par hypothèse, par baseline, assistée par modèle), **TaHiTI** (2018), le *Hunting Maturity Model* (Bianco, 2015), le Threat Hunter Playbook de l'OTRF. Appliqués à CloudTrail et aux journaux applicatifs de Novafact ; une chasse qui trouve quelque chose finit en détection (M24). [D7] |

#### M23 · Journalisation & SIEM (Elastic)

| Niv. | Leçon |
| --- | --- |
| N1 | Quoi journaliser dans l'app (OWASP Logging Cheat Sheet et **Logging Vocabulary**), quoi ne jamais journaliser (confidentialité et vie privée des logs), logs structurés **pino** au format **ECS**, IDs de corrélation, OpenTelemetry. A09:2025. Les *detection points* d'OWASP AppSensor. Le « A » d'audit du Gold Standard (K1). [D5, D7] |
| N2 | **Architecture de journalisation** : centraliser et corréler, protéger l'intégrité et le stockage, retenir et payer (volumes, niveaux de stockage, ce qu'on échantillonne), stratégie de détection. Références : *Best Practices for Event Logging and Threat Detection* (ACSC, CISA, FBI, NSA et partenaires, août 2024), recommandations de l'ANSSI pour l'architecture d'un système de journalisation (janv. 2022), NIST SP 800-92 (2006, sa révision 1 n'étant qu'un brouillon). Les angles morts de CloudTrail : ce qu'il ne journalise pas par défaut, et les contournements publiés par Datadog Security Labs. [D7] |
| N1 | Ingestion : Elastic Agent et Fleet, intégrations **AWS** (CloudTrail via S3/SQS, GuardDuty, WAF, VPC Flow Logs, CloudFront), logs applicatifs. Elastic Common Schema. [D7] |
| N2 | Langages : KQL pour chercher, **EQL** pour les séquences (connexion → changement de MFA → export), **ES\|QL** pour l'analyse. Timelines et cas dans Elastic Security. [D7] |

#### M24 · Detection engineering

| Niv. | Leçon |
| --- | --- |
| N1 | **Le cycle de vie d'une détection** : hypothèse, règle, test, réglage, mise en production, retrait. Documenter chaque détection au format **ADS** de Palantir (neuf sections, des objectifs aux angles morts et à la réponse attendue). La *Detection Engineering Maturity Matrix* (Kyle Bailey) pour situer l'équipe. [D7] |
| N2 | **Couverture ATT&CK** : depuis la v18, les **Detection Strategies** et **Analytics** remplacent les sources de données des techniques ; la v19 scinde *Defense Evasion*. Mesurer une couverture sans la confondre avec un nombre de règles. Robustesse d'une règle : remonter la *Pyramid of Pain*, raisonner en procédures (série *On Detection* de SpecterOps). [D7] |
| N2 | Detection engineering : hypothèse → règle → test → réglage. Règles Elastic (query, threshold, EQL, new terms, ML), **Sigma** converti via pySigma, framework ADS (Palantir), couverture ATT&CK. **Detection-as-code** avec `elastic/detection-rules` (guide Elastic de février 2026). Tests avec **Stratus Red Team** et Atomic Red Team. [D7] |
| N2 | **Tester ses détections** : une détection non testée est une hypothèse. **Atomic Red Team**, **Stratus Red Team** et Grimoire (Datadog) pour rejouer des techniques cloud, jeux de données rejouables (OTRF Security-Datasets ; Splunk BOTSv3, au format Splunk, à convertir pour Elastic), tests de non-régression des règles en CI. [D6, D7] |
| N2 | Détections applicatives : credential stuffing, ATO, énumération BOLA, rejeu de jeton, desync et cache poisoning vus dans les logs WAF/ALB, exfiltration S3, usage anormal de clés. **Honeytokens** (Canarytokens). Threat intelligence (M22). [D7] |
| N3 | Maturité : **DEBMM** d'Elastic (5 paliers), MTTD/MTTR, bruit vs couverture. Réponse à incident applicative : triage, forensique CloudTrail, confinement IAM (`aws:TokenIssueTime`), remédiation, **analyse de cause racine**, post-mortem, approfondis en M25. [D7] |

#### M25 · Réponse à incident

Du premier signal au post-mortem, avec ce qu'une application change à la réponse : les données métier, les jetons, les clients à prévenir.

| Niv. | Leçon |
| --- | --- |
| N1 | **Le cadre de la réponse à incident** : **NIST SP 800-61r3** (avril 2025), qui remplace la Rev. 2 de 2012 et range la réponse sur les six fonctions du CSF 2.0 plutôt que sur un cycle à part ; ISO/IEC 27035-1:2023. Rôles, préparation, qualification. Ce qui change pour une application : périmètre des données, jetons et sessions, clients finaux. [D7] |
| N2 | **Playbooks et runbooks applicatifs** : des procédures qu'on peut suivre à trois heures du matin. Partir des playbooks d'AWS (identifiants IAM compromis, rançongiciel sur S3 ou RDS…) et du *Threat Technique Catalog for AWS* (AWS CIRT, juin 2025), les adapter à Novafact (fuite de jeton OAuth, compte client détourné, dépendance vérolée). [D7] |
| N2 | **Répondre dans AWS** : enquêter dans CloudTrail, contenir sans détruire les preuves (instantanés, isolement plutôt que suppression), révoquer les sessions (`aws:TokenIssueTime`), éradiquer et restaurer. *AWS Security Incident Response Guide*, outils d'Invictus IR. [D7] |
| N2 | **Crise et communication** : cellule de crise, décisions sous incertitude, communication interne, clients et autorités. Guides de l'ANSSI : *Crise cyber, les clés d'une gestion opérationnelle et stratégique* (2021), *Cyberattaques et remédiation : les clés de décision* (2024), *Anticiper et gérer sa communication de crise cyber* (nouvelle version, juin 2026), *L'investigation et la qualification d'incidents* (septembre 2026). [D7] |
| N2 | **Notifier dans les délais** : **RGPD** art. 33 et 34 (CNIL sous 72 h si risque pour les personnes, possible en deux temps ; information des personnes si risque élevé). **NIS2** art. 23 (alerte précoce sous 24 h, notification sous 72 h, rapport final un mois après), le règlement d'exécution (UE) 2024/2690 précisant ce qu'est un incident significatif pour les fournisseurs cloud et de services gérés. **CRA** art. 14, applicable aux fabricants depuis le 11/09/2026 via la plateforme unique de l'ENISA : vulnérabilité activement exploitée (24 h, 72 h, rapport final au plus tard 14 jours après la mise à disposition d'un correctif) et incident grave (24 h, 72 h, rapport final dans le mois). **À revérifier avant publication** : la transposition française de NIS2 et le texte EUR-Lex des délais (§8.14). [D3, D7] |
| N3 | **Exercices et post-mortem** : exercice sur table (guide de l'ANSSI *Organiser un exercice de gestion de crise cyber*, 2020, et ses kits), post-mortem sans recherche de coupable, analyse de cause racine, actions suivies jusqu'à leur clôture. [D7] |

#### M26 · Gestion des vulnérabilités

| Niv. | Leçon |
| --- | --- |
| N1 | Cycle de vie : découverte → dédoublonnage → triage → priorisation → correction → vérification → reporting. Défauts, erreurs et vulnérabilités dans le même bug tracker. [D6, D7] |
| N1 | CVSS 4.0 (Base / Threat / Environmental / Supplemental) : pourquoi le score de base ne suffit pas. [D6] |
| N2 | Prioriser par le risque : **EPSS**, **CISA KEV**, **SSVC**, atteignabilité, exposition. **VEX** pour déclarer « non affecté ». Débat : DREAD (K13) vs CVSS vs SSVC (voir M10). Kohnfelder rappelle qu'on sous-estime plus souvent qu'on ne surestime. [D6, D7] |
| N2 | **Faut-il un exploit pour faire corriger ?** Kohnfelder soutient que rarement, et qu'un test de régression qui déclenche le bug suffit. Confronter cette position à ta pratique de pentester et savoir quand la PoC vaut l'effort. [D6] |
| N2 | Outillage : DefectDojo, Dependency-Track, SLA, exceptions et acceptation du risque. Côté npm : limites de `npm audit`, GHSA/OSV/deps.dev, `overrides`, que faire sans correctif. Gestion des correctifs : tester, publier, vérifier. [D7] |
| N3 | Divulgation : VDP, `security.txt` (RFC 9116), concevoir un bug bounty, écosystème CVE/NVD (crise 2024-2025), EUVD d'ENISA, GCVE, obligations CRA. [D6, D7, D8] |
| N3 | Gérer une critique à J+0 : React2Shell comme cas (inventaire via SBOM, virtual patching WAF, correctif, chasse aux IOC dans Elastic, communication, signalement CRA). [D7] |

### Bloc G · Sécurité de l'IA (module vivant, entrées datées)

Un bloc qui se lit en parallèle dès le bloc C, mis à jour au fil de la veille.

#### M27 · Sécurité des applications LLM

| Niv. | Leçon |
| --- | --- |
| N1 | **OWASP Top 10 for LLM Applications 2026** (3 août 2026) avec la correspondance 2025 : Excessive Agency en LLM03, Unbounded Consumption en LLM06, Misinformation en LLM07, Improper Output Handling en LLM10, System Prompt Leakage renommé *Hidden Context Exposure*. LLM01 élargi au multimodal et à la persistance (mémoire, RAG). [D4] |
| N1 | Prompt injection directe et indirecte : pourquoi elle ne se « patche » pas. La **lethal trifecta** (Willison) et l'**Agents Rule of Two** (Meta, oct. 2025). *The Attacker Moves Second* (2025) : les défenses évaluées contre des attaques adaptatives tombent. [D4] |
| N2 | Patterns de conception : dual LLM, plan-then-execute, **CaMeL**, *Design Patterns for Securing LLM Agents against Prompt Injections* (2025). Relecture avec les anti-patterns de Kohnfelder : un agent est un *confused deputy*, un serveur MCP tiers est un *third-party hook*. [D4] |
| N2 | Apps JS avec LLM (Vercel AI SDK, LangChain.js, SDK OpenAI/Anthropic) : sortie du modèle = entrée non fiable (XSS via Markdown, SSRF via outils, text-to-SQL), sécurité du RAG (ACL sur les embeddings, empoisonnement), consommation illimitée. Labs PortSwigger *Web LLM attacks*. [D5] |
| N2 | **MITRE ATLAS** : tactiques, techniques (dont les ajouts agentiques 2025-2026, ex. AML.T0086), études de cas. **OWASP AI Exchange** (source de l'ISO/IEC 27090). [D4] |
| N3 | Red teaming : **promptfoo** (natif JS/TS), garak, PyRIT. Évaluations en CI, limites des guardrails. Leçons de Microsoft AI Red Team. [D6] |
| N3 | L'IA dans le SDLC : code généré, paquets hallucinés, agents de code avec accès (permissions, secrets, injection via issues/PR). Cas Nx « s1ngularity ». **AI SBOM** (éléments minimaux CISA/G7, 2026). L'IA offensive : HTTP Terminator, Strix, XBOW. Gouvernance : NIST AI RMF, NIST AI 100-2, Google SAIF, ISO 42001, AI Act (survol). [D8] |

#### M28 · Agents & MCP

Le Model Context Protocol en profondeur. La révision courante de la spécification est **2026-07-28** : tout contenu bâti sur 2025-06-18 ou 2025-11-25 se relit à cette aune.

| Niv. | Leçon |
| --- | --- |
| N2 | Agents et MCP : **OWASP Top 10 for Agentic Applications 2026** (ASI01–ASI10, publié en décembre 2025), tool poisoning, rug pull, *token passthrough*, bonnes pratiques de sécurité de la spec MCP, bac à sable. [D4] |
| N1 | **Anatomie de MCP** : hôte, client, serveur ; primitives côté serveur (Tools, Resources, Prompts) et côté client (Elicitation ; Sampling et Roots dépréciés) ; transports stdio et Streamable HTTP (HTTP+SSE déprécié). La révision 2026-07-28 rend le protocole **sans état** : plus d'`initialize` ni de `Mcp-Session-Id`, un état transmis par des *handles* émis par le serveur, des en-têtes `Mcp-Method` et `Mcp-Name` que le serveur doit confronter au corps. Les annotations d'outils (`readOnly`, `destructive`) ne sont pas fiables par défaut. [D4] |
| N2 | **Ce que le modèle lit, l'attaquant l'écrit** : *tool poisoning* (Invariant Labs, avril 2025 : des instructions dans la description d'un outil, invisibles pour l'utilisateur), *rug pull*, *shadowing* d'un serveur par un autre (cas WhatsApp MCP). Le *toxic agent flow* de GitHub MCP (mai 2025 : une issue publique pousse l'agent à publier le contenu de dépôts privés, sans aucun bug de code) et Supabase MCP (juillet 2025 : une clé `service_role` qui contourne la RLS, un ticket de support piégé). La **lethal trifecta** (Willison, juin 2025) comme grille de lecture. [D4] |
| N2 | **Écrire un serveur MCP local sûr** : **CVE-2025-49596** (MCP Inspector : proxy local sans authentification, joignable par DNS rebinding ou par 0.0.0.0, d'où une RCE ; corrigé en 0.14.1), **CVE-2025-53110** et **CVE-2025-53109** (serveur Filesystem officiel : contrôle de préfixe naïf, puis contournement par lien symbolique), CVE-2025-68143 à 68145 (serveur git officiel : chemins et injection d'arguments), CVE-2025-53967 (injection de commande). Parades : valider `Origin` (403 sinon), écouter sur 127.0.0.1, `execFile` et `realpath`, la protection anti-rebinding du SDK TypeScript. [D5] |
| N3 | **Serveur MCP distant et multi-tenant** : un répartiteur qui route sur l'en-tête pendant que le serveur exécute selon le corps (d'où le rejet obligatoire des incohérences en 2026), *state handles* (« posséder un handle n'est pas une authentification » : le lier à l'utilisateur), isolation des tenants (la fuite inter-organisations d'Asana MCP en juin 2025, connue par BleepingComputer), SSRF (CVE-2026-26118, Azure MCP Server) et traversée de chemin sans authentification en HTTP (CVE-2026-40576). [D5] |
| N2 | **La supply chain MCP** : registre officiel (en préversion depuis septembre 2025, vérification de l'espace de noms), serveurs malveillants (**postmark-mcp**, sept. 2025 : une version 1.0.16 qui ajoute en copie cachée tous les e-mails envoyés), hébergeurs compromis (Smithery.ai, divulgation en juin 2025), configurations qui exécutent du code (Cursor : CVE-2025-54136 pour une config approuvée remplacée en silence, CVE-2025-54135 pour une config créée par injection ; avis d'OX Security, avril 2026). Épingler et scanner (mcp-scan, devenu Snyk Agent Scan). [D8] |
| N3 | **Gouverner MCP dans l'entreprise** : inventaire, serveurs fantômes, passerelles, journalisation des appels d'outils, politique d'approbation. **OWASP MCP Top 10** (en bêta), *A Practical Guide for Secure MCP Server Development* (OWASP, février 2026), la gouvernance du protocole (confié en décembre 2025 à l'Agentic AI Foundation, sous la Linux Foundation). [D7, D8] |

#### M29 · MCP & OAuth

L'autorisation de MCP pas à pas, telle que la fixe la révision 2026-07-28. Elle ne s'applique qu'aux transports HTTP : en stdio, les identifiants viennent de l'environnement.

| Niv. | Leçon |
| --- | --- |
| N1 | **Comment MCP a adopté OAuth** : 2025-03-26, premier cadre OAuth 2.1, où le serveur MCP joue aussi le serveur d'autorisation (critiques de Christian Posta et d'Aaron Parecki, mars-avril 2025) ; 2025-06-18, le serveur devient **resource server** avec Protected Resource Metadata et *resource indicators* obligatoires ; 2025-11-25, découverte OIDC, consentement incrémental, CIMD recommandé ; 2026-07-28, validation de `iss` et **DCR déprécié au profit de CIMD**. [D1, D4] |
| N2 | **Découverte : PRM et métadonnées** : la réponse 401 et son `WWW-Authenticate` (`resource_metadata`, `scope`), le document **RFC 9728** et ses `authorization_servers`, la découverte de l'AS par **RFC 8414** et OpenID Connect (ordre des URL quand l'émetteur a un chemin). Si l'`issuer` du document diffère de celui attendu, le client ne doit pas l'utiliser ; sans `code_challenge_methods_supported`, il doit refuser de continuer. [D5] |
| N2 | **Enregistrer le client** : ordre de préférence (client pré-enregistré, **Client ID Metadata Document**, DCR RFC 7591 en repli avec `application_type` obligatoire, saisie manuelle). Identifiants liés à l'émetteur. La **SSRF** des URL de métadonnées, côté client (`resource_metadata`, endpoints de l'AS, jusqu'à 169.254.169.254) comme côté AS (récupération du document CIMD). [D5] |
| N2 | **Le flux et ses vérifications** : PKCE S256, `resource` (RFC 8707) dans la requête d'autorisation et dans celle de jeton, émetteur attendu conservé avec le `code_verifier`, validation de `iss` (RFC 9207) par comparaison stricte avant d'utiliser le code, rotation des refresh tokens pour les clients publics, jeton en `Authorization: Bearer` sur chaque requête, jamais dans l'URL. La leçon de **CVE-2025-6514** (mcp-remote, CVSS 9.6) : un `authorization_endpoint` piégé, ouvert sans contrôle, devient une injection de commande ; refuser `javascript:` et `file:`, ne jamais ouvrir une URL par le shell. [D5] |
| N2 | **Audience, passthrough et API en aval** : le serveur MCP valide que le jeton lui a été émis, refuse tout autre jeton (*token passthrough* interdit) et, pour appeler une API en aval, agit en client OAuth distinct avec son propre jeton. [D5] |
| N3 | **Le confused deputy des proxys MCP** (K4) : un proxy qui utilise un `client_id` statique auprès d'un AS tiers, plus l'enregistrement dynamique et le cookie de consentement de cet AS, permet de voler un code d'autorisation. Parades : consentement par `client_id`, cookie `__Host-`, `state` à usage unique posé après le consentement, `redirect_uri` comparé à l'identique. [D4, D5] |
| N2 | **Scopes minimaux et step-up** : `403` avec `error="insufficient_scope"` et tous les scopes nécessaires dans un seul challenge, demande de l'**union** des scopes déjà obtenus et des nouveaux, limite de tentatives, hiérarchie des scopes côté serveur. Demander peu, puis davantage. [D5] |
| N3 | **MCP en entreprise** : l'extension *Enterprise-Managed Authorization* (stable, juin 2026) : SSO auprès de l'IdP, échange RFC 8693 contre un **ID-JAG**, puis assertion RFC 7523 auprès de l'AS du serveur MCP, qui émet un jeton restreint à ce serveur. Brouillons IETF associés (ID-JAG, WIMSE pour l'identité des agents), livre blanc de l'OpenID Foundation sur l'identité des agents (octobre 2025), feuille de route MCP (DPoP, fédération d'identité de workload). [D4] |
| N3 | **Implémenter en Express** : SDK TypeScript v2 (`@modelcontextprotocol/server` et son adaptateur Express) : `requireBearerAuth` avec un vérificateur de jetons (piège : un `expiresAt` absent donne un 401), publication de la PRM, `requireScopes` pour un step-up par outil, `createMcpExpressApp` contre le DNS rebinding. Les helpers de serveur d'autorisation de la v1 sont gelés : un IdP dédié émet les jetons. Les tests qui prouvent le refus (sans jeton, mauvaise audience, scope insuffisant) et que le cas légitime passe. [D5, D6] |

### Bloc H · Piloter

#### M30 · Faire adopter la sécurité

Le module de la reconversion : les contrôles ne valent rien s'ils ne sont pas adoptés. C'est aussi là que ton expérience de pentester devient un atout plutôt qu'un réflexe d'auditeur. Le rôle de l'AppSec et les Security Champions sont posés en M4.

| Niv. | Leçon |
| --- | --- |
| N1 | **Écrire un finding qui sera corrigé** : titre orienté impact, reproduction minimale, correctif dans le code et le style de l'équipe, test de régression fourni, priorité justifiée. Une PR de correctif vaut mieux qu'un PDF. [D2, D6] |
| N2 | **Négocier avec le produit** : SLA, dette de sécurité, exceptions à durée limitée, arbitrage par le risque métier. Gérer le désaccord et l'escalade (K7) : le designer a le dernier mot, les positions divergentes sont documentées. [D2] |
| N2 | **Parler aux dirigeants** : traduire en risque métier, quantifier (FAIR, vu en M10), tableaux de bord utiles plutôt que métriques de vanité, rendre compte du programme. [D2] |
| N2 | **Former au code sécurisé** : partir des bugs réels de l'entreprise, formats courts, CTF internes, labs Juice Shop, mesure de l'effet sur les findings suivants. [D2] |
| N2 | **Le paved road comme produit** : expérience développeur, templates (`create-novafact-service`), documentation, adoption mesurée. Rendre le chemin sûr plus facile que l'autre. *Security Chaos Engineering* (Shortridge). [D2] |
| N3 | **Piloter la sécurité offensive côté client** : cadrer un pentest (périmètre, boîte blanche ou noire, comptes, données), choisir un prestataire (qualification PASSI, CREST), exploiter le rapport, retests. Pentest, bug bounty ou red team : lequel, quand. Tu connais l'autre côté : ce qu'un bon client fournit. [D6, D8] |

#### M31 · Le programme AppSec

La synthèse du parcours : chaque bloc devient une pratique, gouvernée, jalonnée, mesurée et planifiée.

| Niv. | Leçon |
| --- | --- |
| N2 | **Du parcours au programme** : chaque bloc du parcours rangé dans les fonctions de SAMM et les groupes de pratiques du SSDF, et ce qui manque quand un bloc manque (pas d'analyse de risques : des priorités au doigt mouillé ; pas de SOC : des détections que personne ne lit). Le point de départ est l'état des lieux de M5. [D2] |
| N2 | **Gouvernance : politiques, standards et comités** : ce qui s'écrit (politique, standard, guide), qui le décide et qui le fait appliquer, comment une exception remonte. La revue annuelle qui empêche la politique de mourir. [D2] |
| N2 | Jalons et critères *break/build* : où placer les portes de contrôle, qui peut accorder une exception. Documentation de sécurité et reporting (tableaux de bord, boucles de feedback). [D2] |
| N2 | Métriques : MTTR par criticité, taux d'échappement, couverture, KPI et OKR, expérience développeur. OWASP DSOMM. Le volet humain (champions, formation, négociation) est traité en M4 et M30. [D2] |
| N3 | **EU Cyber Resilience Act** : signalement obligatoire depuis le 11/09/2026 (alerte 24 h, notification 72 h, rapport final via la plateforme unique ENISA ; détail des délais en M25, à recouper sur EUR-Lex). Construire une roadmap à 12 mois. [D2] |

### M32 · Capstone : revue de sécurité de Novafact

Livrable guidé, dans l'ordre du cycle de développement : chaque étape a sa checklist et son auto-évaluation, et se réalise sur l'architecture de Novafact (documents fournis) et des labs reconnus.

1. Analyse de risques : valeurs métier, événements redoutés et registre des risques (M10).
2. Threat model.
3. Exigences ASVS L2, classification des données et matrice de traçabilité.
4. Design doc et Security Design Review d'une nouvelle fonctionnalité (processus K7, rapport *Must / Ought / Should*).
5. Contrôles anti-abus sur l'inscription, la connexion et l'envoi de factures.
6. Revue de code d'une PR sensible, règles Semgrep maison et tests de régression de sécurité.
7. Correctifs des vulnérabilités avancées (M9).
8. Page de paiement : inventaire des scripts, CSP stricte, conformité aux exigences PCI 6.4.3 et 11.6.1.
9. Durcissement du pipeline et de la supply chain.
10. IAM au moindre privilège.
11. Cinq détections Elastic testées.
12. Exercice de crise : un incident simulé, la cellule de crise et les notifications dans les délais (M25).
13. Le serveur MCP d'Ask Novafact : threat model, autorisation OAuth et tests (M28, M29).
14. Roadmap SAMM à 12 mois.
15. Plan d'adoption (champions, formation, SLA négociés) et restitution en une page à la direction.

---

## 4. Grille CSSLP : couverture des 8 domaines

Exam outline ISC2 en vigueur depuis le 15/09/2023. Le parcours couvre les 8 domaines. Les leçons ajoutées pour combler les manques de la version précédente sont en gras. La colonne « Modules » reprend les étiquettes des leçons du catalogue.

| Domaine CSSLP | Poids | Modules | Leçons ajoutées grâce au CSSLP |
| --- | --- | --- | --- |
| D1 Secure Software Concepts | 12 % | M1, M3, M6, M13, M14, M19, M29 | **Confiance, C-I-A et Gold Standard**, principes complets (conception ouverte, acceptabilité psychologique, réutilisation) |
| D2 Secure Software Lifecycle Management | 11 % | M1, M3–M5, M10, M13, M21, M30–M32 | **Jalons break/build, documentation, métriques KPI/OKR, risque technique vs métier, fin de vie des applications, sensibilisation et reporting (M30)** |
| D3 Secure Software Requirements | 13 % | M4, M8, M10, **M12**, M13, M15, M25, M32 | **Exigences fonctionnelles et non fonctionnelles, SRTM, classification des données, vie privée, conformité, provisionnement** |
| D4 Secure Software Architecture and Design | 15 % | M2, M7, M8, M11, M13–M15, M19, M27–M29, M32 | **Conception d'interfaces, sécurité des bases, revue de risque architecturale, propriétés non fonctionnelles** |
| D5 Secure Software Implementation | 14 % | M1, M2, M6–M9, M13–M18, M22, M23, M27–M29, M32 | **Concurrence, sécurité déclarative, tokenisation, agilité crypto, inspection de code malveillant, revue de code manuelle (M16)** |
| D6 Secure Software Testing | 14 % | M9, M12, M16, M17, M24, M26, M27, M29, M30, M32 | **Stratégie de test, tests de sécurité écrits par les devs, fuzzing, tests de disponibilité, données de test, fonctionnalités non documentées** |
| D7 Secure Software Deployment, Operations, Maintenance | 11 % | M1, M2, M5, M6, M8–M10, M15, M18–M26, M28, M32 | **Approbation de mise en production, résilience et continuité (sauvegardes, PRA/PCA), SLO/SLA, analyse de cause racine** |
| D8 Secure Software Supply Chain | 10 % | M8, M11, M12, M17, M18, M20, M26–M28, M30, M32 | **Évaluation des fournisseurs, clauses contractuelles, licences OSS, droit d'audit, NIST SP 800-161r1** |

**Mode CSSLP** dans le site : un filtre par domaine sur toutes les leçons, et un **examen blanc** de 100 questions de mise en situation, pondérées selon les poids officiels. Les questions sont rédigées pour la formation : aucune question réelle de l'examen. Hors du périmètre du parcours (mentionné pour mémoire) : embarqué, IoT industriel, matériel (secure boot, TPM, exécution spéculative), sujets du CSSLP sans rapport avec l'écosystème JS/AWS.

---

## 5. Intégration de *Designing Secure Software* (Kohnfelder)

| Chapitre | Idée clé | Où dans le parcours |
| --- | --- | --- |
| K1 Foundations | Confiance (spectre, composants implicitement fiables), C-I-A, Gold Standard (authN, authZ, audit), vie privée | M3, M12, M23 |
| K2 Threats | Perspective adverse, 4 questions, actifs → surfaces → frontières → menaces → mitigations, threat modeling partout | M11 |
| K3 Mitigation | Réduire surface, fenêtre de vulnérabilité, exposition des données ; politiques d'accès, interfaces, communication, stockage | M13 |
| K4 Patterns | 14 patterns en 5 familles, 4 anti-patterns (confused deputy, backflow of trust, third-party hooks, unpatchable components) | M8, M13, M19, M21, M27, M29 + jeu *Pattern Match* |
| K5 Cryptography | CSPRNG, MAC et rejeu, symétrique/asymétrique, signatures, certificats, échange de clés, bien utiliser la crypto | M6 (TLS et certificats), M13 |
| K6 Secure Design | Hypothèses explicites, périmètre, exigences, interfaces, données, vie privée, cycle de vie, compromis, simplicité | M12, M13 + design doc Novafact |
| K7 Security Design Reviews | Study, Inquire, Identify, Collaborate, Write, Follow up ; Must/Ought/Should ; gérer le désaccord | M13, M30, M32 + jeu *Design Review Simulator* |
| K8 Secure Programming | Influence malveillante, chaînes de vulnérabilités, entropie des bugs, footguns (GotoFail), atomicité, attaques temporelles, sérialisation | M7, M9 + jeu *Stepping Stones* |
| K9 Low-Level Coding Flaws | Arithmétique : entiers et flottants. Mémoire : hors périmètre JS, sauf pour les modules natifs | M7 (arithmétique et argent) |
| K10 Untrusted Input | Validité, rejeter ou corriger, chaînes et Unicode, injections, regex, XML | M7 |
| K11 Web Security | S'appuyer sur un framework, modèle de sécurité web, XSS, CSRF | M6 (rappels, TLS), M7 (HTML côté serveur), M8 |
| K12 Security Testing | Cas de test de sécurité, fuzzing, régression, disponibilité, TDD, rattrapage | M17 |
| K13 Best Practices | Hygiène du code, exceptions, documenter la sécurité, revue de code, dépendances, triage (DREAD, faut-il un exploit ?), environnement de dev | M7, M11, M16, M17, M18, M26 |
| Annexe A | Modèle de document de conception | M13 (gabarit du design doc Novafact) |
| Annexe C | Exercices | Adaptés en JS dans les leçons : coder puis exploiter un confused deputy en Express, envelopper `node:crypto`, écrire un test de régression sur un CVE, rétro-documenter un composant, chercher la backdoor façon GotoFail |

---

## 6. Parcours PortSwigger intégré

Sur la Web Security Academy, on vise les labs **Practitioner** et **Expert** : les Apprentice sont des bases que tu maîtrises déjà. Jalon optionnel : **Burp Suite Certified Practitioner (BSCP)** si tu ne l'as pas.

| Sujet Academy | Module | Question côté AppSec |
| --- | --- | --- |
| Authentication | M14, M15 | Quelles limites arrêtent le brute force et le credential stuffing sans bloquer les clients ? |
| NoSQL injection | M7 | Quel schéma de validation rend l'opérateur Mongo impossible ? |
| Access control, Business logic | M7, M14, M15 | Où centraliser l'autorisation pour que la BOLA ne dépende pas de chaque route ? |
| API testing | M9 | Comment les appels internes deviennent-ils une surface (server-side parameter pollution) ? |
| Race conditions | M9 | Quelle contrainte en base garantit l'atomicité, peu importe le code ? |
| HTTP Host header attacks | M9 | D'où vient l'URL absolue de l'application ? |
| HTTP request smuggling (dont advanced et browser-powered) | M9, M21 | Quel protocole de bout en bout, quel réglage de l'ALB, quelle trace dans Elastic ? |
| Web cache poisoning, Web cache deception | M9, M21 | Qui définit la clé de cache et que met-on en cache ? |
| Server-side template injection | M9 | Pourquoi les templates avec logique sont-ils une dette ? |
| Insecure deserialization | M9 | Quels formats n'acceptent jamais de types arbitraires ? |
| Prototype pollution (client et serveur) | M7, M9 | Comment l'empêcher en structure plutôt que par filtrage ? |
| JWT attacks | M9, M14 | Qui choisit l'algorithme : le jeton ou le serveur ? |
| OAuth authentication | M14 | Qu'impose RFC 9700 / RFC 10017 que ce lab viole ? |
| GraphQL API vulnerabilities | M9 | Limites de coût, désactivation de l'introspection, autorisation par résolveur. |
| SSRF, XXE | M7, M9, M19 | IMDSv2, proxy de sortie, parsers sans entités externes. |
| DOM-based vulnerabilities, XSS avancé, CSP | M7, M8, M9 | Trusted Types + CSP stricte : que reste-t-il d'exploitable ? |
| CORS, CSRF, Clickjacking, WebSockets | M6, M7, M8, M9 | Quelles valeurs par défaut du framework et du navigateur suffisent ? |
| File upload | M7, M13 | Pipeline d'upload isolé (S3, scan, service de rendu séparé). |
| Web LLM attacks | M9, M27 | Quel outil de l'agent donne l'impact, et comment le retirer ? |

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
| 2 | **Quel référentiel ?** | M3, M6, M27 | N1 | Tri rapide : un risque apparaît, le ranger dans Top 10 / API / CI/CD / LLM / Agentic / ASVS. |
| 3 | **Spot the Sink** | M7 | N1-N2 | Un extrait Express/React/Next : cliquer la ligne vulnérable, puis choisir la CWE. Chronométré. Inclut des footguns JS. |
| 4 | **Patch or Pwn** | M7, M9, M14 | N2 | Quatre correctifs proposés, un seul tient. Chaque mauvais choix révèle le payload qui le contourne. |
| 5 | **Stepping Stones** | M9, M26 | N2 | Une liste de findings « faibles ». Relier ceux qui forment une chaîne jusqu'à un impact critique, puis choisir le correctif unique qui casse le plus de chaînes. |
| 6 | **Parser Wars** | M9 | N3 | Une requête HTTP brute ou une URL : prédire comment CloudFront, l'ALB, llhttp (Node) et le cache la lisent. Trouver la divergence (desync, cache poisoning, contournement), puis le réglage qui l'annule. |
| 7 | **Race Window** | M9 | N2 | Une frise de requêtes concurrentes : placer l'attaque single-packet qui dépasse la limite, puis choisir le correctif qui tient. |
| 8 | **CSP Builder** | M8 | N3 | Composer la CSP de la page de paiement de Novafact, avec ses scripts tiers, directive par directive. Un banc de tests montre en direct quels payloads passent et quelles fonctionnalités cassent. |
| 9 | **Triage Room** | M26 | N2 | Une file de findings (CVSS, EPSS, KEV, atteignabilité, exposition, VEX). Classer P0–P3, faux positif ou risque accepté, avec un budget de sprint. Noté contre SSVC. |
| 10 | **Pushback** | M30 | N2 | Des objections réelles de devs, de product owners et de dirigeants (« pas le temps », « c'est interne », « le pentest n'a rien trouvé »). Choisir la réponse qui fait avancer sans braquer : le score mesure le risque réduit *et* la relation préservée. |
| 11 | **Data Map** | M12 | N2 | Classer les données de Novafact (sensibilité, propriétaire, rétention, base légale), puis choisir les contrôles et la traçabilité exigés pour chaque classe. |
| 12 | **Pattern Match** | M13 | N1-N2 | Une situation de conception Novafact : nommer le pattern appliqué ou l'anti-pattern présent (parmi les 14 + 4 de Kohnfelder), puis choisir la correction. |
| 13 | **Design Review Simulator** | M13 | N3 | Lire le design doc d'une nouvelle fonctionnalité, suivre les 6 étapes de Kohnfelder, classer ses constats en *Must / Ought / Should*, puis gérer par choix de dialogue un designer qui conteste. |
| 14 | **OAuth Flow Debugger** | M14 | N2-N3 | Un diagramme de séquence animé d'un flux réel (OIDC ou SAML) : trouver l'étape faible et nommer l'attaque. |
| 15 | **Abuse Desk** | M15 | N2-N3 | Un flux d'événements (connexions, inscriptions, envois de factures) qui mêle clients légitimes, bots et fraudeurs. Régler limites de débit, règles WAF et contrôles d'envoi : le score combine abus bloqués et clients légitimes gênés. |
| 16 | **STRIDE Cards** | M11 | N2 | Inspiré d'Elevation of Privilege : un DFD de Novafact, des cartes de menaces à poser sur le bon élément ou la bonne frontière, puis la contre-mesure. |
| 17 | **Diff Review** | M16 | N1-N3 | Une PR de Novafact affichée comme sur GitHub : commenter les lignes à risque, qualifier chaque commentaire (bloquant, à corriger, suggestion), approuver ou refuser. Trois paliers : diff court, diff avec contexte à ouvrir, PR générée par une IA. |
| 18 | **Right Tool, Right Stage** | M17 | N1 | Glisser SAST, DAST, SCA, secrets, IaC, SBOM, fuzzing, test de régression, revue IA sur le bon scénario et la bonne étape d'un schéma de pipeline. |
| 19 | **True or False Positive** | M17 | N3 | Des findings Semgrep, CodeQL ou d'un reviewer IA avec leur trace de taint : vrai ou faux positif, et pourquoi. Certains findings IA sont hallucinés. |
| 20 | **Workflow Audit** | M18 | N2 | Un workflow GitHub Actions : cliquer les lignes dangereuses et les rattacher au bon CICD-SEC. |
| 21 | **Supply Chain Kill Chain** | M18 | N2 | Remettre en ordre un incident réel (xz, tj-actions, Shai-Hulud…), puis placer le contrôle (SLSA, pinning, trusted/staged publishing) qui casse la chaîne le plus tôt. |
| 22 | **Allow or Deny ?** | M19 | N2 | Politique d'identité + politique de ressource + SCP/RCP + boundary + contexte : prédire la décision et justifier par l'étape de l'algorithme. |
| 23 | **IAM Privesc Pathfinder** | M19 | N3 | Un graphe de permissions : trouver le chemin vers admin, puis le couper avec le moins de changements possible. |
| 24 | **IaC Misconfig Hunt** | M20 | N2 | Terraform ou CDK : repérer les misconfigurations, puis choisir la règle Checkov/Rego qui les attrape sans faux positif. |
| 25 | **Log Detective AppSec** | M23, M24 | N2 | Événements Elastic (pino/ECS, CloudTrail, WAF) : identifier l'attaque et la technique ATT&CK. |
| 26 | **Detection Builder** | M24 | N3 | Assembler une règle (KQL, seuil ou séquence EQL) par blocs et la tester sur un jeu d'événements : précision et rappel affichés. |
| 27 | **Agent Blast Radius** | M27, M28 | N2-N3 | Configurer outils, permissions et validations humaines de l'assistant Novafact en respectant la Rule of Two. Des injections sont rejouées : bloquer les attaques sans casser les cas d'usage. |
| 28 | **Crise J+0** | M8, M18, M21, M25, M26 | N3 | Scénario à embranchements, sous horloge : React2Shell, Shai-Hulud, skimmer sur la page de paiement ou ransomware cloud frappe Novafact. Chaque décision (inventaire, WAF, rotation, restauration, communication, signalement CRA) a des conséquences. |
| 29 | **Red vs Blue : Novafact** | Capstone (M32) | N3 | Le boss final : prototype pollution → RCE → IMDS → escalade IAM → exfiltration S3, analysée côté Red, puis défense en profondeur côté Blue avec un budget limité réparti sur tout le SDLC. |

Le **SAMM Planner** de la version précédente devient un exercice guidé, en deux temps : l'évaluation en M5, la roadmap en M31.

**Évaluation** : un diagnostic d'entrée et de sortie par module (le même questionnaire, sans XP : c'est l'écart qui compte), un quiz par leçon, des séries de jeu exigées par certaines leçons, un examen par bloc (A à H), un examen final (40 questions, 25 min, 75 %), l'**examen blanc façon CSSLP** (100 questions pondérées par domaine), certificat imprimable.

**Progression** : 6 niveaux (Recrue AppSec → Security Champion → AppSec Engineer → Senior AppSec → Product Security Lead → Architecte DevSecOps), un badge par module et par jeu maîtrisé, une carte de progression façon roadmap, une jauge de couverture CSSLP par domaine, un compteur de labs PortSwigger cochés à la main.

---

## 8. Bibliothèque de sources

### 8.1 Référentiels et standards

| Source | Modules |
| --- | --- |
| [OWASP Top 10:2025](https://owasp.org/Top10/2025/) · [API Security Top 10 2023](https://owasp.org/API-Security/) · [CWE Top 25](https://cwe.mitre.org/top25/) | M6, M7 |
| [OWASP ASVS 5.0](https://github.com/OWASP/ASVS) · [Proactive Controls](https://top10proactive.owasp.org/) · [Developer Guide](https://owasp.org/www-project-developer-guide/) | M3, M12, M13 |
| [OWASP SAMM v2](https://owaspsamm.org/model/) · [BSIMM16](https://www.blackduck.com/resources/analyst-reports/bsimm.html) · [OWASP DSOMM](https://dsomm.owasp.org/) · [Security Champions Guide](https://securitychampions.owasp.org/) · [SAFECode Fundamental Practices](https://safecode.org/) | M4, M5, M31 |
| [ISC2 CSSLP Exam Outline](https://www.isc2.org/certifications/csslp/csslp-certification-exam-outline) | Grille §4 |
| [NIST SSDF SP 800-218](https://csrc.nist.gov/pubs/sp/800/218/final) · [CISA Secure by Design](https://www.cisa.gov/securebydesign) · [EU CRA, signalement](https://digital-strategy.ec.europa.eu/en/policies/cra-reporting) · [ENISA SRP](https://www.enisa.europa.eu/topics/product-security-and-certification/single-reporting-platform-srp) | M1, M3, M10, M25, M26, M31 |
| RGPD ([CNIL, guide RGPD du développeur](https://www.cnil.fr/fr/guide-rgpd-du-developpeur)) · [PCI DSS 4.0.1](https://www.pcisecuritystandards.org/) · NIS2 | M12, M25 |
| [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/) (Node.js, Prototype Pollution, XSS, DOM XSS, CSP, OAuth2, SAML, JWT, Logging, Logging Vocabulary, CI/CD, Docker, NodeJS Docker, Secrets, Threat Modeling, Mass Assignment, GraphQL, Cryptographic Storage, User Privacy Protection) | Tous |
| [OWASP WSTG](https://owasp.org/www-project-web-security-testing-guide/) · [OWASP Code Review Guide](https://owasp.org/www-project-code-review-guide/) · [OSSTMM](https://www.isecom.org/OSSTMM.3.pdf) | M16, M17 |
| [PCI DSS 4.0.1](https://www.pcisecuritystandards.org/) exigences 6.4.3 et 11.6.1 · [MDN Sanitizer API](https://developer.mozilla.org/en-US/docs/Web/API/HTML_Sanitizer_API) · [web.dev Fetch Metadata](https://web.dev/articles/fetch-metadata) · [web.dev Trusted Types](https://web.dev/articles/trusted-types) · [Sansec](https://sansec.io/research) (recherche Magecart) | M8 |
| [OWASP Automated Threats to Web Applications](https://owasp.org/www-project-automated-threats-to-web-applications/) · [OWASP Credential Stuffing Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Credential_Stuffing_Prevention_Cheat_Sheet.html) · [API6:2023](https://owasp.org/API-Security/editions/2023/en/0xa6-unrestricted-access-to-sensitive-business-flows/) · [AWS WAF Fraud Control ATP](https://docs.aws.amazon.com/waf/latest/developerguide/waf-atp.html) · [Pwned Passwords](https://haveibeenpwned.com/Passwords) · [KnowBe4 : phishing via QuickBooks](https://blog.knowbe4.com/invoice-or-impersonation-36.5-spike-in-phishing-attacks-leveraging-quickbooks-legitimate-domain-in-2025) | M15 |
| [FAIR Institute](https://www.fairinstitute.org/) (quantification du risque) · [ANSSI, prestataires qualifiés PASSI](https://cyber.gouv.fr/produits-services-qualifies) · [CREST](https://www.crest-approved.org/) | M4, M10, M30 |
| [FIRST CVSS 4.0](https://www.first.org/cvss/v4-0/) · [EPSS](https://www.first.org/epss/) · [CISA KEV](https://www.cisa.gov/known-exploited-vulnerabilities-catalog) · [SSVC](https://certcc.github.io/SSVC/) · [OpenVEX](https://github.com/openvex/spec) · [RFC 9116](https://www.rfc-editor.org/rfc/rfc9116) · [EUVD](https://euvd.enisa.europa.eu/) | M10, M26 |
| RFC [9700](https://www.rfc-editor.org/rfc/rfc9700) (OAuth BCP), [10017](https://www.rfc-editor.org/info/rfc10017/) (Browser-based apps), [8725](https://www.rfc-editor.org/rfc/rfc8725) (JWT BCP), [9449](https://www.rfc-editor.org/rfc/rfc9449) (DPoP), [9126](https://www.rfc-editor.org/rfc/rfc9126) (PAR), [8693](https://www.rfc-editor.org/rfc/rfc8693) (Token Exchange) · [OAuth 2.1](https://oauth.net/2.1/) · [NIST SP 800-63-4](https://pages.nist.gov/800-63-4/) | M14, M29 |
| [MITRE ATT&CK](https://attack.mitre.org/) · [CAPEC](https://capec.mitre.org/) · [D3FEND](https://d3fend.mitre.org/) · [ATLAS](https://atlas.mitre.org/) · [Threat Modeling Manifesto](https://www.threatmodelingmanifesto.org/) · [LINDDUN](https://linddun.org/) | M2, M11, M24, M27 |
| [OWASP Top 10 CI/CD Security Risks](https://owasp.org/www-project-top-10-ci-cd-security-risks/) · [SLSA v1.2](https://slsa.dev/spec/v1.2/) · [OpenSSF](https://openssf.org/) (Scorecard, S2C2F, npm Best Practices Guide) · [Sigstore](https://www.sigstore.dev/) · [CISA SBOM Minimum Elements 2026](https://www.cisa.gov/resources-tools/resources/2026-minimum-elements-software-bill-materials-sbom) · [CNCF TAG Security](https://github.com/cncf/tag-security) | M17, M18 |
| [NIST SP 800-161r1](https://csrc.nist.gov/pubs/sp/800/161/r1/final) (C-SCRM) · ISO/IEC 27036 · [CSA CCM et CAIQ](https://cloudsecurityalliance.org/research/cloud-controls-matrix) | M18 |
| AWS : [Policy evaluation logic](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_evaluation-logic.html), [Data perimeters](https://aws.amazon.com/identity/data-perimeters-on-aws/), [Security Reference Architecture](https://docs.aws.amazon.com/prescriptive-guidance/latest/security-reference-architecture/), Well-Architected Security et Reliability Pillars, [Security Incident Response Guide](https://docs.aws.amazon.com/security-ir/latest/userguide/), [CIRT playbooks](https://github.com/aws-samples/aws-customer-playbook-framework) | M19–M21, M25 |
| [OWASP GenAI Security Project](https://genai.owasp.org/) (LLM Top 10 2025/2026, Agentic Top 10 2026, AI Testing Guide) · [OWASP AI Exchange](https://owaspai.org/) · [NIST AI 100-2](https://csrc.nist.gov/pubs/ai/100/2/e2025/final) · [Google SAIF](https://saif.google/) · [MCP Security Best Practices](https://modelcontextprotocol.io/specification/draft/basic/security_best_practices) | M27–M29 |

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
| **Novafact Lab** (`lab/`, fourni) | M7, M8, M9, M15, M27, M28 : exploiter, puis corriger avec tests de régression ; M18 à M21 pour les challenges de correction sur le dépôt fixture |
| **PortSwigger Web Security Academy** (Practitioner/Expert) | M7, M8, M9, M14, M27 |
| **OWASP Juice Shop** + *Pwning OWASP Juice Shop* | Base JS, coding challenges (choisir le bon correctif) |
| OWASP NodeGoat, DVNA | Vulnérabilités spécifiques Node |
| **CI/CD Goat**, GitHub Security Lab CTF | Top 10 CI/CD, pwn requests, CodeQL |
| **flAWS / flAWS2**, **CloudGoat**, Big IAM Challenge, iam-vulnerable | IAM AWS attaque/défense |
| TerraGoat, CfnGoat | IaC |
| Kubernetes Goat | Déploiement |
| Stratus Red Team | Générer des attaques cloud pour tester les détections Elastic |
| **Gandalf** (Lakera), Damn Vulnerable LLM Agent, Crucible | Prompt injection, agents |
| OWASP WrongSecrets | Gestion des secrets |
| Advisories GHSA et diffs de correctifs (Next.js, xml-crypto, body-parser…) | M16 : lire des correctifs réels, chercher les variantes |
| PentesterLab, exercices de code review (payant) | M16 |

Les labs de Security Operations (SOC, Elastic, jeux de données) sont listés au §8.10.

### 8.7 Livres

- **Loren Kohnfelder, *Designing Secure Software: A Guide for Developers*** (No Starch, 2021) : ouvrage de référence du bloc C (fourni, voir §5)
- Tanya Janca, *Alice and Bob Learn Application Security* (Wiley) et *Alice and Bob Learn Secure Coding* (Wiley, 2025 : Express, React, revue de code)
- Mark Dowd, John McDonald & Justin Schuh, *The Art of Software Security Assessment* (Addison-Wesley) : la référence de la revue de code
- Kelly Shortridge & Aaron Rinehart, *Security Chaos Engineering* (O'Reilly, 2023)
- Matthew Skelton & Manuel Pais, *Team Topologies* (IT Revolution, 2e éd. 2025) : l'AppSec comme *enabling team*
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

Les ouvrages propres à la Security Operations, aux métiers et au risque sont listés aux §8.10, §8.12 et §8.13.

### 8.8 Référentiels de formation (pour vérifier la couverture)

**CSSLP** (grille officielle, §4), plans de cours de SANS SEC522 (AppSec web et API) et SEC540 (Cloud Native & DevSecOps), Practical DevSecOps (CDP), AWS Certified Security – Specialty, Burp Suite Certified Practitioner.

### 8.9 Veille

tl;dr sec (Clint Gibler), Simon Willison (prompt injection), Embrace The Red (Johann Rehberger), PortSwigger Research, GitHub Security Lab, Wiz Research, Datadog Security Labs, Elastic Security Labs, StepSecurity, Socket, Sansec, Detection Engineering Weekly, hackingthe.cloud, breaches.cloud, The DFIR Report. Conférences : OWASP Global AppSec, fwd:cloudsec, Black Hat / DEF CON (AppSec Village), LocoMocoSec.

### 8.10 Security Operations

#### SOC et organisation

| Source | Modules |
| --- | --- |
| MITRE, [*11 Strategies of a World-Class Cybersecurity Operations Center*](https://www.mitre.org/news-insights/publication/11-strategies-world-class-cybersecurity-operations-center) (Knerler, Parker, Zimmerman, 2022 ; livre gratuit et résumé) | M22 |
| [SOC-CMM](https://www.soc-cmm.com/) (auto-évaluation, cinq domaines) · [FIRST CSIRT Services Framework v2.1](https://www.first.org/standards/frameworks/csirts/csirt_services_framework_v2.1) | M5, M22 |
| ANSSI, [référentiel PDIS v2.0](https://cyber.gouv.fr/sites/default/files/2022-10/pdis_referentiel_v2.0%5B1%5D.pdf) (détection d'incidents, 2017) · [page des référentiels de qualification](https://cyber.gouv.fr/referentiels-dexigences-pour-la-qualification) | M22 |
| [NIST CSF 2.0](https://doi.org/10.6028/NIST.CSWP.29) (CSWP 29, février 2024) | M1, M5, M25 |
| [SANS SOC Survey](https://www.sans.org/research/security-operations-report) (chiffres de l'édition 2026 relevés de seconde main : à relire avant citation) | M22 |
| [OWASP A09:2025 Security Logging and Alerting Failures](https://owasp.org/Top10/2025/A09_2025-Security_Logging_and_Alerting_Failures) · [Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html) · [Logging Vocabulary Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Vocabulary_Cheat_Sheet.html) | M22, M23 |

#### Journalisation

| Source | Modules |
| --- | --- |
| ACSC, CISA, FBI, NSA et partenaires, [*Best Practices for Event Logging and Threat Detection*](https://www.cisa.gov/resources-tools/resources/best-practices-event-logging-and-threat-detection) (août 2024) | M23 |
| ANSSI, [*Recommandations de sécurité pour l'architecture d'un système de journalisation*](https://messervices.cyber.gouv.fr/guides/recommandations-de-securite-pour-larchitecture-dun-systeme-de-journalisation) (janv. 2022) | M23 |
| [NIST SP 800-92](https://csrc.nist.gov/Projects/log-management/publications) (2006, seule version finale) ; SP 800-92 Rev. 1, *Cybersecurity Log Management Planning Guide* : **brouillon** (2023), à citer comme tel | M23 |
| [OpenTelemetry : convergence d'ECS et des conventions sémantiques](https://opentelemetry.io/blog/2023/ecs-otel-semconv-convergence/) (2023) | M23 |
| Datadog Security Labs, [contournements de la journalisation CloudTrail](https://securitylabs.datadoghq.com/articles/bypass-cloudtrail-aws-service-catalog-and-other/) · [Invictus IR](https://github.com/invictus-ir) (aws-cheatsheet, Invictus-AWS) | M23, M25 |

#### Detection engineering

| Source | Modules |
| --- | --- |
| MITRE ATT&CK, notes de version [v18](https://attack.mitre.org/resources/updates/updates-october-2025/) (oct. 2025), [v19](https://attack.mitre.org/resources/updates/updates-april-2026/) (avr. 2026) et [suivantes](https://attack.mitre.org/resources/updates/) | M2, M24 |
| [Sigma specification](https://github.com/SigmaHQ/sigma-specification) (règles, corrélations, filtres) | M24 |
| Elastic, [*The Engineer's Guide to Elastic Detections as Code*](https://www.elastic.co/security-labs/detection-as-code-timeline-and-new-features) (févr. 2026) · [validation et test des règles](https://www.elastic.co/docs/solutions/security/detect-and-alert/validate-and-test-rules) | M24 |
| Kyle Bailey, [*Detection Engineering Maturity Matrix*](https://detectionengineering.io/) · SpecterOps, série [*On Detection*](https://specterops.io/blog/2022/09/08/part-6-what-is-a-procedure/) (Jared Atkinson) | M24 |
| [Stratus Red Team](https://github.com/DataDog/stratus-red-team) · [Grimoire](https://github.com/DataDog/grimoire) (Datadog) | M24 |
| Livres : Roddie, Deyalsingh & Katz, *Practical Threat Detection Engineering* (Packt, 2023) ; Dennis Chow, *Automating Security Detection Engineering* (Packt, 2024) | M24 |
| [MITRE CAR](https://car.mitre.org/) (à présenter comme historique : ATT&CK a désormais ses propres Analytics) | M24 |

#### Renseignement et chasse

| Source | Modules |
| --- | --- |
| David J. Bianco, [*The Pyramid of Pain*](https://detect-respond.blogspot.com/2013/03/the-pyramid-of-pain.html) (2013) et [*A Simple Hunting Maturity Model*](https://detect-respond.blogspot.com/2015/10/a-simple-hunting-maturity-model.html) (2015) | M22, M24 |
| Splunk SURGe, [PEAK Threat Hunting Framework](https://www.splunk.com/en_us/blog/security/peak-threat-hunting-framework.html) (avril 2023) · [TaHiTI](https://www.betaalvereniging.nl/en/safety/tahiti/) (2018) · [OTRF Threat Hunter Playbook](https://threathunterplaybook.com/) | M22 |
| Caltagirone, Pendergast & Betz, [*The Diamond Model of Intrusion Analysis*](https://apps.dtic.mil/sti/pdfs/ADA586960.pdf) (2013) · Brown & Roberts, *Intelligence-Driven Incident Response*, 2e éd. (O'Reilly, 2023) · Heuer, [*Psychology of Intelligence Analysis*](https://www.cia.gov/resources/csi/static/Pyschology-of-Intelligence-Analysis.pdf) (CIA, 1999) | M22 |
| [FIRST TLP 2.0](https://www.first.org/tlp/) · STIX/TAXII 2.1 (OASIS) · [MISP](https://github.com/MISP/MISP) · [OpenCTI](https://github.com/OpenCTI-Platform/opencti) | M22 |
| [The DFIR Report](https://thedfirreport.com/) · [formation CTI de MITRE ATT&CK](https://attack.mitre.org/resources/learn-more-about-attack/training/cti/) | M22 |

#### Réponse à incident

| Source | Modules |
| --- | --- |
| [NIST SP 800-61 Rev. 3](https://csrc.nist.gov/pubs/sp/800/61/r3/final) (avril 2025) · ISO/IEC 27035-1:2023 (payant) | M25 |
| [*AWS Security Incident Response Guide*](https://docs.aws.amazon.com/whitepapers/latest/aws-security-incident-response-guide/aws-security-incident-response-guide.pdf) (2023) · [*Threat Technique Catalog for AWS*](https://aws-samples.github.io/threat-technique-catalog-for-aws/) (AWS CIRT, juin 2025) · [playbooks AWS](https://github.com/aws-samples/aws-customer-playbook-framework) | M24, M25 |
| Invictus IR, [*Cloud native incident response in AWS*](https://www.invictus-ir.com/news/cloud-native-incident-response-in-aws---part-i) · SANS [FOR509](https://www.sans.org/cyber-security-courses/enterprise-cloud-forensics-incident-response) (payant) | M25 |
| ANSSI : [*Organiser un exercice de gestion de crise cyber*](https://messervices.cyber.gouv.fr/guides/organiser-un-exercice-de-gestion-de-crise-cyber) (2020), [*Crise cyber, les clés d'une gestion opérationnelle et stratégique*](https://messervices.cyber.gouv.fr/guides/crise-cyber-les-cles-dune-gestion-operationnelle-et-strategique) (2021), [*Cyberattaques et remédiation : les clés de décision*](https://messervices.cyber.gouv.fr/guides/cyberattaques-et-remediation-les-cles-de-decision) (2024), [*Anticiper et gérer sa communication de crise cyber*](https://messervices.cyber.gouv.fr/guides/anticiper-et-gerer-sa-communication-de-crise-cyber) (nouvelle version, juin 2026), [*L'investigation et la qualification d'incidents*](https://messervices.cyber.gouv.fr/guides/investigation-qualification-incidents) (sept. 2026) | M25 |
| ANSSI, référentiel **PRIS** (prestataires de réponse aux incidents ; la page des référentiels indique la v3.2) | M25, M30 |
| Livres : Luttgens, Pepe & Mandia, *Incident Response & Computer Forensics*, 3e éd. (2014) ; Bollinger, Enright & Valites, *Crafting the InfoSec Playbook* (O'Reilly, 2015) ; Bejtlich, *The Practice of Network Security Monitoring* (No Starch, 2013) | M25 |

#### Notifications réglementaires

| Source | Modules |
| --- | --- |
| [CNIL, notifier une violation de données personnelles](https://www.cnil.fr/fr/notifier-une-violation-de-donnees-personnelles) (RGPD art. 33 et 34) | M25 |
| NIS2 art. 23 (lu sur un [miroir non officiel](https://www.nis-2-directive.com/NIS_2_Directive_Article_23.html) ; texte EUR-Lex à recouper) · règlement d'exécution (UE) 2024/2690 · ENISA, [*NIS2 Technical Implementation Guidance*](https://www.enisa.europa.eu/publications/nis2-technical-implementation-guidance) (juin 2025) | M12, M25 |
| CRA art. 14 : [page de la Commission](https://digital-strategy.ec.europa.eu/en/policies/cra-reporting) et [miroir non officiel](https://www.european-cyber-resilience-act.com/Cyber_Resilience_Act_Article_14.html) ; texte EUR-Lex à recouper | M25, M26, M31 |
| Projet de loi « résilience » (transposition française de NIS2), [texte à l'Assemblée nationale](https://www.assemblee-nationale.fr/dyn/docs/PRJLANR5L17B1112) · [Next, 23/09/2026](https://next.ink/brief-article/alleluia-la-transposition-de-nis2-est-enfin-a-lordre-du-jour-de-lassemblee-nationale/) : **statut à revérifier** (§8.14) | M12, M25 |

#### Labs SecOps

| Lab | Pour |
| --- | --- |
| [CyberDefenders](https://cyberdefenders.org/) (freemium, dont des labs sous Elastic) · [Blue Team Labs Online](https://blueteamlabs.online/) (challenges gratuits, investigations payantes) · [LetsDefend](https://letsdefend.io/) (racheté par Hack The Box en septembre 2025) | M22–M25 |
| [OTRF Security-Datasets](https://github.com/OTRF/Security-Datasets) (JSON, ingérable dans Elastic) · [Splunk BOTSv3](https://github.com/splunk/botsv3) (CloudTrail, GuardDuty, VPC Flow ; format Splunk, conversion nécessaire) | M23, M24 |

#### Rapports annuels (dernières éditions parues)

| Source | Modules |
| --- | --- |
| [Verizon DBIR 2026](https://www.verizon.com/business/resources/reports/dbir/) (31 % des violations par exploitation de vulnérabilité, 48 % avec rançongiciel) | M1 |
| [Mandiant M-Trends 2026](https://cloud.google.com/blog/topics/threat-intelligence/m-trends-2026) (mars 2026 ; dwell time médian de 14 jours, exploits à 32 % des vecteurs initiaux) | M1, M22 |
| [ENISA Threat Landscape 2025](https://www.enisa.europa.eu/publications/enisa-threat-landscape-2025) (oct. 2025, juillet 2024 – juin 2025) · ANSSI, [Panorama de la cybermenace 2025](https://cyber.gouv.fr/nous-connaitre/publications/panoramas-de-la-cybermenace/panorama-de-la-cybermenace-2025/) (mars 2026) | M1 |
| [CrowdStrike 2026 Global Threat Report](https://www.crowdstrike.com/en-us/global-threat-report/) (février 2026) · [Red Canary 2026 Threat Detection Report](https://redcanary.com/threat-detection-report/) (volumes divergents selon les sources : ne pas les citer) | M1, M24 |

### 8.11 MCP et OAuth

| Source | Modules |
| --- | --- |
| Spécification MCP : [versionnage](https://modelcontextprotocol.io/specification/versioning), changelogs [2025-03-26](https://modelcontextprotocol.io/specification/2025-03-26/changelog), [2025-06-18](https://modelcontextprotocol.io/specification/2025-06-18/changelog), [2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25/changelog), [2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/changelog) (révision courante) | M28, M29 |
| Révision 2026-07-28 : [autorisation](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization) et ses sous-pages, [Streamable HTTP](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http), [Security Best Practices](https://modelcontextprotocol.io/docs/2026-07-28/tutorials/security/security_best_practices) | M28, M29 |
| [Blog MCP](https://blog.modelcontextprotocol.io/) : [spécification 2026-07-28](https://blog.modelcontextprotocol.io/posts/2026-07-28/), [Enterprise-Managed Authorization](https://blog.modelcontextprotocol.io/posts/enterprise-managed-auth/) (juin 2026), [feuille de route](https://blog.modelcontextprotocol.io/posts/mcp-roadmap/) (août 2026), [annotations d'outils](https://blog.modelcontextprotocol.io/posts/2026-03-16-tool-annotations/) (mars 2026) · [extension EMA](https://modelcontextprotocol.io/extensions/auth/enterprise-managed-authorization) ([ext-auth](https://github.com/modelcontextprotocol/ext-auth)) | M28, M29 |
| Gouvernance : [annonce de l'Agentic AI Foundation](https://www.anthropic.com/news/donating-the-model-context-protocol-and-establishing-of-the-agentic-ai-foundation) (déc. 2025) · [registre MCP](https://github.com/modelcontextprotocol/registry) (préversion) | M28 |
| RFC [9728](https://www.rfc-editor.org/rfc/rfc9728) (PRM), [8414](https://www.rfc-editor.org/rfc/rfc8414), [8707](https://www.rfc-editor.org/rfc/rfc8707) (resource indicators), [7591](https://www.rfc-editor.org/rfc/rfc7591) (DCR), [9207](https://www.rfc-editor.org/rfc/rfc9207) (`iss`), [8693](https://www.rfc-editor.org/rfc/rfc8693), [7523](https://www.rfc-editor.org/rfc/rfc7523), [6750](https://www.rfc-editor.org/rfc/rfc6750) | M29 |
| **Brouillons IETF** (aucun n'est une RFC) : [OAuth 2.1](https://datatracker.ietf.org/doc/draft-ietf-oauth-v2-1/) (-16, sept. 2026), [OAuth Client ID Metadata Document](https://datatracker.ietf.org/doc/draft-ietf-oauth-client-id-metadata-document/) (-02, juil. 2026), [Identity Assertion Authorization Grant](https://datatracker.ietf.org/doc/draft-ietf-oauth-identity-assertion-authz-grant/) (-04, mai 2026), [WIMSE AI Identity Management System](https://datatracker.ietf.org/doc/draft-ietf-wimse-aims/) (-00, sept. 2026) | M29 |
| OpenID Foundation, [*Identity Management for Agentic AI*](https://openid.net/new-whitepaper-tackles-ai-agent-identity-challenges/) (oct. 2025) | M29 |
| [SDK TypeScript MCP, autorisation côté serveur](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/serving/authorization.md) (v2) | M29 |
| OWASP : [Top 10 for Agentic Applications 2026](https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/) (déc. 2025), [*A Practical Guide for Secure MCP Server Development*](https://genai.owasp.org/resource/a-practical-guide-for-secure-mcp-server-development/) (févr. 2026), [cheat sheet sur les serveurs MCP tiers](https://genai.owasp.org/resource/cheatsheet-a-practical-guide-for-securely-using-third-party-mcp-servers-1-0/), [MCP Top 10](https://owasp.org/www-project-mcp-top-10/) (bêta) | M28 |
| Avis de sécurité : [CVE-2025-49596](https://github.com/advisories/GHSA-7f8r-222p-6f5g) (MCP Inspector), [CVE-2025-53110](https://github.com/advisories/GHSA-hc55-p739-j48w) et [CVE-2025-53109](https://github.com/advisories/GHSA-q66q-fx2p-7w4m) (Filesystem), [CVE-2025-53967](https://github.com/advisories/GHSA-gxw4-4fc5-9gr5), CVE-2025-68143 à 68145 (git), [CVE-2026-26118](https://msrc.microsoft.com/update-guide/vulnerability/CVE-2026-26118) (Azure MCP Server), [CVE-2026-40576](https://github.com/advisories/GHSA-j98m-w3xp-9f56), CVE-2025-54135 et 54136 (Cursor, descriptions NVD) | M28 |
| [CVE-2025-6514](https://github.com/advisories/GHSA-6xpm-ggf7-wc3p) (mcp-remote) · [analyse de JFrog](https://research.jfrog.com/vulnerabilities/mcp-remote-command-injection-rce-jfsa-2025-001290844) | M29 |
| Recherche : Invariant Labs ([tool poisoning](https://invariantlabs.ai/blog/mcp-security-notification-tool-poisoning-attacks), [WhatsApp MCP](https://invariantlabs.ai/blog/whatsapp-mcp-exploited), [GitHub MCP](https://invariantlabs.ai/blog/mcp-github-vulnerability)), Simon Willison ([lethal trifecta](https://simonwillison.net/2025/Jun/16/the-lethal-trifecta/), [Supabase MCP](https://simonwillison.net/2025/Jul/6/supabase-mcp-lethal-trifecta/)), [Oligo](https://www.oligo.security/blog/critical-rce-vulnerability-in-anthropic-mcp-inspector-cve-2025-49596), [Cymulate](https://cymulate.com/blog/cve-2025-53109-53110-escaperoute-anthropic/), [GitGuardian](https://blog.gitguardian.com/breaking-mcp-server-hosting/) | M28 |
| Sources d'opinion, à l'origine du modèle actuel : Christian Posta (mars 2025), [Aaron Parecki, *Let's fix OAuth in MCP*](https://aaronparecki.com/2025/04/03/15/oauth-for-model-context-protocol) (avril 2025), [Posta & Ryan, *MCP Authorization is a Non-Starter for Enterprise*](https://solo.io/blog/mcp-authorization-is-a-non-starter-for-enterprise) (août 2025) | M29 |
| Sources secondaires, à citer avec prudence : BleepingComputer ([Asana](https://www.bleepingcomputer.com/news/security/asana-warns-mcp-ai-feature-exposed-customer-data-to-other-orgs/), [postmark-mcp](https://www.bleepingcomputer.com/news/security/unofficial-postmark-mcp-npm-silently-stole-users-emails/)), [OX Security, *MCP Supply Chain Advisory*](https://www.ox.security/blog/mcp-supply-chain-advisory-rce-vulnerabilities-across-the-ai-ecosystem/) (avril 2026) | M28 |

### 8.12 Métiers

| Source | Modules |
| --- | --- |
| [BSIMM16](https://www.blackduck.com/resources/analyst-reports/bsimm.html) : taille, rattachement et structure des équipes (tableaux 5 et 6 ; citer la médiane, pas la seule moyenne) | M4, M5 |
| NIST [SP 800-181 Rev. 1](https://csrc.nist.gov/pubs/sp/800/181/r1/final) (NICE Framework, 2020) · [composants du NICE Framework](https://www.nist.gov/itl/applied-cybersecurity/nice/nice-framework-resource-center/nice-framework-latest-updates) (v2.2.0, avril 2026) · [rôle Secure Software Development](https://niccs.cisa.gov/tools/nice-framework/work-role/secure-software-development) | M4 |
| ENISA, [European Cybersecurity Skills Framework](https://www.enisa.europa.eu/topics/skills-and-competences/skills-development/european-cybersecurity-skills-framework-ecsf) (2022 ; révision en cours) | M4 |
| ANSSI, [Panorama des métiers de la cybersécurité](https://cyber.gouv.fr/sites/default/files/2021/10/anssi-panorama_metiers_cybersecurite-2020.pdf) (2020, dernière édition) · [Observatoire des métiers](https://cyber.gouv.fr/offre-de-service/formations-entrainement-et-decouverte-des-metiers/observatoires-des-metiers/) (4e édition, 2025) | M4 |
| [*Security Champions Playbook*](https://github.com/c0rdis/security-champions-playbook) (Alexander Antukh) · [OWASP Security Culture](https://owasp.org/www-project-security-culture/) (contenu remanié : relire avant de citer) | M4, M30 |
| Netflix, [*Scaling Appsec at Netflix (Part 2)*](https://netflixtechblog.com/scaling-appsec-at-netflix-part-2-c9e0f1488bc5) (2022) · tl;dr sec, [résumé du talk Netflix sur les partenariats internes](https://tldrsec.com/p/appsec-a-pragmatic-approach-for-internal-security-partnerships) (2020) · Clint Gibler, [*How to 10X your Security*](https://infocondb.org/con/security-bsides/bsidessf-2021/how-to-10x-your-security-without-the-series-d) (BSidesSF 2021) | M4, M30 |
| Google, [*Building Secure and Reliable Systems*](https://google.github.io/building-secure-and-reliable-systems/raw/toc.html), ch. 20 (rôles) et 21 (culture) | M4 |
| ISC2, [*Cybersecurity Workforce Study 2025*](https://www.isc2.org/insights/2025/12/isc2-publishes-2025-cybersecurity-workforce-study) (déc. 2025) | M4 |
| Certifications : [CSSLP](https://www.isc2.org/certifications/csslp), [GIAC GWEB](https://www.giac.org/certifications/certified-web-application-defender-gweb), [GIAC GCSA](https://www.giac.org/certifications/cloud-security-automation-gcsa/), [OffSec OSWE](https://www.offsec.com/courses/web-300/), [PASSI v2.2](https://cyber.gouv.fr/actualites/lanssi-met-%C3%A0-jour-les-referentiels-passi-version-22-et-pris-version-30/) (nov. 2024), [SecNumedu](https://cyber.gouv.fr/offre-de-service/formations-entrainement-et-decouverte-des-metiers/formations/formation-labellisees-par-lanssi/) | M4 |
| Livres : Bell, Brunton-Spall, Smith & Bird, *Agile Application Security* (O'Reilly, 2017) ; Zane Lackey & Rebecca Huehls, *Building a Modern Security Program* (O'Reilly, 2018) | M4, M31 |

### 8.13 Analyse de risques

| Source | Modules |
| --- | --- |
| ANSSI, [*La méthode EBIOS Risk Manager – Le guide*](https://messervices.cyber.gouv.fr/guides/la-methode-ebios-risk-manager-le-guide) (v1.5) · [Club EBIOS](https://club-ebios.org/site/) | M10, M32 |
| ANSSI / DINUM, [*Le guide de l'homologation de sécurité des systèmes d'information*](https://messervices.cyber.gouv.fr/documents-guides/guide-homologation-securite-web-04-2025.pdf) (v2.2, mars 2026) | M10 |
| [ISO/IEC 27005:2022](https://webstore.iec.ch/publication/79713) (non certifiable) · [ISO 31000:2018](https://www.iso.org/standard/65694.html) | M10 |
| [NIST SP 800-30 Rev. 1](https://csrc.nist.gov/pubs/sp/800/30/r1/final) (2012) · [NIST IR 8286 Rev. 1](https://csrc.nist.gov/pubs/ir/8286/r1/final) et ses compagnons 8286A et 8286C (déc. 2025) | M10 |
| [OWASP Risk Rating Methodology](https://owasp.org/www-community/OWASP_Risk_Rating_Methodology) | M10 |
| [Open FAIR](https://blog.opengroup.org/2025/05/22/exciting-updates-for-the-open-fair-body-of-knowledge-and-certification-program) (O-RT v3.1, O-RA v2.1, mai 2025) · [FAIR-CAM](https://www.fairinstitute.org/fair-newsroom/fair-institute-introduces-fair-cam-to-help-cybersecurity-teams-assess-effectiveness-of-risk-management-controls-to-make-more-cost-effective-business-decisions) (2021) · Hubbard & Seiersen, [*How to Measure Anything in Cybersecurity Risk*](https://www.wiley.com/en-us/How+to+Measure+Anything+in+Cybersecurity+Risk,+2nd+Edition-p-9781119892304), 2e éd. (Wiley, 2023) | M10, M30 |
| Louis Anthony Cox Jr., [*What's Wrong with Risk Matrices?*](https://ideas.repec.org/a/wly/riskan/v28y2008i2p497-512.html) (*Risk Analysis*, 2008) | M10 |
| FIRST, guides utilisateur [CVSS v3.1](https://www.first.org/cvss/v3.1/user-guide) (§2.1) et [CVSS v4.0](https://www.first.org/cvss/v4.0/user-guide) : une sévérité, pas un risque | M10, M26 |
| Adam Shostack, [*The DREAD Pirates*](https://shostack.org/blog/tmt-the-dread-pirates/) (2018) et [*Experiences Threat Modeling at Microsoft*](https://shostack.org/files/papers/modsec08/Shostack-ModSec08-Experiences-Threat-Modeling-At-Microsoft.pdf) (2008) | M10, M11 |
| [MONARC](https://www.monarc.lu) (NC3 Luxembourg, libre) · [MEHARI](https://clusif.fr/analyse-de-risques-mises-a-jour-de-la-methode-mehari-du-clusif/) (CLUSIF) | M10 |
| Cas : CSRB, [rapport sur l'intrusion Storm-0558](https://www.cisa.gov/sites/default/files/2025-03/CSRBReviewOfTheSummer2023MEOIntrusion508.pdf) (2024) · OCC, [sanction de Capital One](https://www.occ.gov/news-issuances/news-releases/2020/nr-occ-2020-101.html) (2020) · SEC contre SolarWinds ([plainte](https://www.sec.gov/litigation/litreleases/lr-25887), 2023 ; griefs abandonnés en 2025 : des allégations jamais jugées, à présenter comme telles) | M2, M10 |

### 8.14 Points à revérifier avant publication

1. **Transposition française de NIS2.** Le projet de loi « résilience » a été adopté par le Sénat le 12/03/2025 ; son examen en séance publique à l'Assemblée nationale commence le **7 octobre 2026**. Au 1er octobre 2026, il n'est ni adopté définitivement ni promulgué (le délai de transposition était le 17/10/2024). Revérifier le statut, une éventuelle promulgation et les décrets avant de publier M12 et M25.
2. **Délais NIS2 et CRA.** Les délais de NIS2 (art. 23) et du CRA (art. 14) cités en M25 et M31 viennent de la page de la Commission et de miroirs non officiels : EUR-Lex n'a pas pu être consulté. Les recouper sur EUR-Lex avant de citer un article mot pour mot.

Autres réserves connues : les incidents MCP d'Asana et de postmark-mcp ne sont connus que par des sources secondaires ; les chiffres du SANS SOC Survey 2026 et la date de sortie du DBIR 2026 sont de seconde main ; depuis ATT&CK v19, tout contenu qui présente *Defense Evasion* (TA0005) comme une tactique actuelle est daté.

---

## 9. Labs pratiques

La pratique s'appuie sur des labs reconnus, listés au §8.6 et dans la page **Labs** du site : sujets Practitioner et Expert de la Web Security Academy, applications volontairement vulnérables (Juice Shop, NodeGoat, DVNA, WrongSecrets, CI/CD Goat), scénarios cloud (flAWS, CloudGoat, Big IAM Challenge, TerraGoat, Stratus Red Team) et IA (Gandalf, Damn Vulnerable LLM Agent, Crucible). Chaque lab se coche dans le site et rapporte de l'XP.

**Novafact Lab** (dossier `lab/`) complète ce dispositif. L'application fil rouge y est rendue exécutable et
volontairement vulnérable : même stack que le site (Vite + React + TypeScript, API Express), tout en mémoire,
boucle locale, faux service de métadonnées local pour la SSRF. Les challenges jouables sont listés dans
`lab/CHALLENGES.md`, généré depuis `lab/shared/exercises.ts` avec son décompte à jour : on n'en recopie pas le
nombre ici, il a déjà divergé d'un document à l'autre. Trois familles : *exploit*, contre l'application qui
tourne (vulnérabilités serveur et client, web avancé, identité, anti-abus, IA : M7 à M9, M14, M15, M27, M28) ;
*fix*, sur un dépôt fixture — workflows GitHub Actions (M18), politiques IAM (M19), Terraform et CDK (M20),
conteneurs et Kubernetes (M21) ; *artifact*, un livrable que le harnais juge (règle, test, document VEX, modèle
de menaces). La feuille de route `lab/ROADMAP.md`, générée elle aussi, spécifie les challenges à venir module
par module, et CHALLENGES.md donne la raison de chaque leçon qui n'est rattachée à aucun challenge.

Ce qui le distingue des labs externes, et justifie de revenir sur la décision initiale : le drapeau ne
récompense pas l'exploitation seule. Le serveur constate lui-même la violation d'invariant, puis
`npm run verify` exige les deux moitiés du métier — **le contrôle refuse l'attaque, et le cas légitime marche
encore**. C'est l'exercice K12 de Kohnfelder et le cœur de M17, appliqué à du code qu'on possède. Le pipeline
et les blocs E et F continuent de s'appuyer sur CI/CD Goat (M18), CloudGoat (M19), TerraGoat (M20) et Stratus
Red Team (M24), qu'aucun lab local ne remplace.

Les exemples de code des leçons illustrent Novafact ; ceux du lab en sont la version exécutable.

## 10. Choix techniques du site

- **Base** : copie du socle de l'ATT&CK SaaS Academy (styles, `ui.tsx`, Layout, progression, toasts, certificat), rebrandé.
- **Contenu** : MDX (`@mdx-js/rollup`) avec composants maison : `<YouKnow>` (ce que tu sais déjà), `<Diff>` (vulnérable → corrigé), `<Lab>` (lab reconnu, case « fait »), `<Source>`, `<Quiz>` inline, `<PrDiff>` (diff commentable façon GitHub), `<Csslp domain="D4">`, `<Kohnfelder ch={7}>`.
- **Code** : coloration syntaxique légère (`prism-react-renderer`), avec vues diff.
- **Diagrammes** : SVG inline (DFD, séquences OAuth/SAML, pipeline, graphe IAM, chaîne de proxys, carte des patterns), thèmes clair et sombre.
- **Progression** : document JSON par compte, enregistré côté serveur (Express + SQLite) avec concurrence optimiste et fusion monotone entre onglets. Son format est versionné : une restructuration qui déplace des leçons migre les anciennes clés au chargement (`src/store/migrate.ts`). Répétition espacée, labs cochés, diagnostics et séries exigées par les leçons vivent dans ce document.

## 11. Livraison par phases

Les phases livrées sont décrites avec la numérotation actuelle des modules.

| Phase | Contenu | Jeux |
| --- | --- | --- |
| 1 ✅ | Socle du site, MDX, progression ; programme et DevSecOps (contenu aujourd'hui réparti entre M3, M5, M10 et M31), vulnérabilités côté serveur (M7, avec le rappel Top 10 désormais en M6), web avancé (M9), gestion des vulnérabilités (M26) (livrée) | Flashcards espacées, Quel référentiel ?, Spot the Sink, Patch or Pwn, Stepping Stones, Race Window, Triage Room |
| 2 ✅ | Côté client (M8), adoption (M30, avec le rôle et les champions désormais en M4), fondations et exigences (M3, M12), conception (M13, avec l'authentification et l'autorisation désormais en M14) (livrée) | CSP Builder, Pushback, Data Map, Pattern Match, Design Review Simulator, Parser Wars |
| 3 ✅ | M14 (OAuth, OIDC, SAML), M15, M11, M16 (livrée) | OAuth Flow Debugger, Abuse Desk, STRIDE Cards, Diff Review |
| 4 ✅ | M17, M18 (livrée) | Right Tool, True or False Positive, Workflow Audit, Supply Chain Kill Chain |
| 5 ✅ | M19 à M21, journalisation et détection (M23, M24) (livrée) | Allow or Deny, IAM Pathfinder, IaC Hunt, Log Detective, Detection Builder |
| 6 ✅ | Applications LLM (M27, avec la leçon agents et MCP désormais en M28), capstone (M32), examens, examen blanc CSSLP, certificat (livrée) | Agent Blast Radius, Crise J+0, Red vs Blue |
| 7 ✅ | **Novafact Lab** : 17 exercices, drapeaux constatés par le serveur, suite de régression, corrigé (livrée) | — |
| 8 | **Restructuration SSDLC** (01/10/2026) : neuf blocs, diagnostics par module, examens par bloc de A à H, migration de la progression ; nouveaux modules M1, M2, M4, M5, M6, M10, M22, M24, M25, M28, M29, M31 au catalogue, leurs nouvelles leçons en rédaction | — |
| Continu | Entrées datées dans le bloc G (M27 à M29) et la page Veille | — |

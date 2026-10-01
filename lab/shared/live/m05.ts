// m05 · Gestion des vulnérabilités — challenges jouables.
//
// Challenges « artifact » : il n'y a rien à attaquer et rien à corriger dans le
// dépôt. L'apprenant PRODUIT un fichier dans `workspace/`, au chemin donné par
// `file`, et c'est ce fichier qui est jugé. On relance l'audit depuis la page du
// challenge, ou par POST /api/lab/audit/<id>.
//
// Les données de référence sont embarquées dans `fixtures/m05/` : extrait du
// catalogue d'exploitation connue, scores de probabilité, table de décision
// SSVC, schémas OpenVEX et CycloneDX, rapports d'outils à fusionner. Elles sont
// lisibles par l'apprenant — c'est le point : la correction est un recalcul ou
// un lookup, jamais une appréciation.
//
// Ce qui relève du jugement n'est pas noté, et chaque énoncé le dit.
//
// Les vérifications correspondantes sont dans server/audit/m05.ts.

import type { ExerciseDef } from '../exercises.ts';

export const m05: ExerciseDef[] = [
  {
    id: 'finding-dedupe', module: 'm05', title: 'Le doublon qui coûte cher',
    status: 'live', kind: 'artifact', level: 2, csslp: ['D6'], cwe: 'CWE-1059',
    brief:
      'Trois outils remontent le même défaut sous trois formes, et la file de triage compte trois fois le même travail. Les rapports bruts sont dans `fixtures/m05/dedupe/` (semgrep.json, njsscan.json, snyk.json), l’échelle de sévérité commune dans `fixtures/m05/severity-map.json`.',
    goal:
      'Écrire `workspace/scripts/dedupe.mjs`, qui prend un dossier de rapports en argument et écrit sur la sortie standard la liste fusionnée, en JSON.',
    file: 'scripts/dedupe.mjs',
    lessons: ['m05/l01', 'm13/l11'],
    hints: [
      'Commence par ramener les trois formats au même vocabulaire : outil, sévérité normalisée, CWE, fichier, ligne, titre. Tout le reste en découle.',
      'La clé de dédoublonnage identifie le DÉFAUT, pas l’outil : ni le nom de règle ni le message n’y entrent. Le harnais rejoue ton script sur un jeu qu’il fabrique au moment du contrôle — une réponse codée en dur ne passera pas.',
      'Clé = sha256 hexadécimal de `cwe|fichier|ligne`, avec le chemin en POSIX sans `./` et le CWE sous la forme `CWE-nnn`. Sortie : `{"constats":[{"cle","severite","cwe","fichier","ligne","outils","titre","occurrences"}]}`, triée par `cle` croissante ; `severite` = la plus haute rapportée (low < medium < high < critical), `outils` = la liste triée et dédoublonnée, `titre` = le message de l’outil premier dans l’ordre alphabétique, `occurrences` = le nombre de constats bruts fusionnés.',
    ],
    fix: 'Le dédoublonnage est une décision de plateforme, pas un script par équipe : la clé se déclare une fois, et tout ce qui entre dans l’outil de suivi passe par elle. Sans ça, trois scanners produisent trois fois le même ticket, et la file perd sa crédibilité avant sa première revue.',
  },

  {
    id: 'triage-kev-epss', module: 'm05', title: 'Le triage qui va chercher la donnée',
    status: 'live', kind: 'artifact', level: 2, csslp: ['D6'], cwe: 'CWE-1059',
    brief:
      'Vingt vulnérabilités du SBOM de Novafact (`fixtures/m05/sbom-vulns.json`), toutes « critiques » ou « hautes » selon leur score de base. L’équipe a deux jours.',
    goal:
      'Produire `workspace/vulns/triage.csv` : les vingt vulnérabilités dans leur ordre de traitement réel, avec l’exploitation observée et la probabilité d’exploitation allées chercher à la source.',
    file: 'vulns/triage.csv',
    lessons: ['m05/l03', 'm05/l02'],
    hints: [
      'Le score de base est le point de départ du triage, pas son résultat. Deux fichiers du dossier de fixtures disent ce qu’il ne dit pas.',
      '`fixtures/m05/kev.json` dit ce qui est exploité pour de bon ; `fixtures/m05/epss.json` donne la probabilité d’exploitation à trente jours. Recopie les valeurs exactes : le harnais les recoupe une à une.',
      'En-tête exact : `rang,cve,composant,cvss_base,kev,epss,justification`. Vingt lignes, rang de 1 à 20 dans l’ordre. Tri : d’abord `kev` (oui avant non), puis `epss` décroissante, puis `cvss_base` décroissante, puis l’identifiant CVE croissant. La colonne `kev` vaut « oui » ou « non ». La justification doit être présente et faire au moins dix caractères — son contenu n’est pas noté.',
    ],
    fix: 'Un score de base est une propriété du défaut, pas de ton exposition. Ce qui décide de l’ordre, c’est l’exploitation observée puis la probabilité d’exploitation — et ces deux données se vont chercher, elles ne se devinent pas. C’est la différence entre une file de vingt « critiques » et une liste de six choses à faire aujourd’hui.',
  },

  {
    id: 'ssvc-decision', module: 'm05', title: 'L’arbre SSVC, appliqué',
    status: 'live', kind: 'artifact', level: 2, csslp: ['D6'], cwe: 'CWE-1059',
    brief:
      'Cinq vulnérabilités (`fixtures/m05/ssvc-cases.json`), et une décision à rendre pour chacune : différer, planifier, sortir du cycle, ou traiter immédiatement. La table de décision est dans `fixtures/m05/ssvc-deployer.json`.',
    goal:
      'Produire `workspace/vulns/ssvc-selections.json` : pour chaque cas, les quatre points de décision retenus et le résultat que la table en tire.',
    file: 'vulns/ssvc-selections.json',
    lessons: ['m05/l03', 'm05/l01'],
    hints: [
      'Deux des quatre points ne relèvent pas de ton appréciation : ce sont des faits, et les données les donnent.',
      '`exploitation` se déduit du catalogue KEV puis de l’existence d’une preuve de concept publique : « active », sinon « poc », sinon « none ». `exposure` est l’exposition constatée en production, donnée dans chaque cas. `utility` et `human_impact` sont ton jugement — ils ne sont pas notés, mais la décision qu’ils produisent l’est.',
      'Forme attendue : `{"tree":"Deployer","version":"2.0.0","selections":[{"id","exploitation","exposure","utility","human_impact","decision","rationale"}]}`. Aucune clé en trop, les cinq identifiants de cas, et `decision` exactement la ligne que la table rend pour tes quatre points.',
    ],
    fix: 'Un arbre de décision ne sert pas à remplacer le jugement, il sert à le rendre traçable : chaque décision porte les points qui l’ont produite, et une décision se conteste en contestant un point, pas en refaisant tout le débat. C’est ce qui permet de rendre la même décision six mois plus tard, et d’expliquer pourquoi elle a changé.',
  },

  {
    id: 'vex-not-affected', module: 'm05', title: 'Le VEX qui dit non, et le prouve',
    status: 'live', kind: 'artifact', level: 2, csslp: ['D6', 'D8'], cwe: 'CWE-1059',
    brief:
      'Trois avis de sécurité (`fixtures/m05/advisories.json`, identifiants NF-ADV-2026-001, -004 et -005) visent des composants internes de Novafact. Chacun désigne un symbole vulnérable : un fichier et une fonction. La fonction est-elle seulement appelée quelque part ?',
    goal:
      'Lire le code de `server/` pour chaque symbole, puis produire `workspace/vulns/novafact.openvex.json` — le document VEX qui déclare le statut, avec la justification qui correspond.',
    file: 'vulns/novafact.openvex.json',
    lessons: ['m05/l03', 'm05/l05'],
    hints: [
      'Trois questions, dans cet ordre : le fichier existe-t-il ? la fonction y est-elle définie ? une route montée par `server/index.ts` finit-elle par l’appeler ?',
      'Le schéma est dans `fixtures/m05/openvex.schema.json` : un statut « not_affected » exige une justification prise dans une liste fermée, un statut « affected » exige un `action_statement`. Le harnais connaît la vérité terrain — il la recalcule sur le code au moment du contrôle — et refuse une justification qui ne correspond pas.',
      'Un statement par avis, pas un de plus. Symbole atteint → `affected` + `action_statement`. Symbole présent mais qu’aucune route n’atteint → `not_affected` + `vulnerable_code_not_in_execute_path`. Fichier ou fonction absents de l’arbre → `not_affected` + `vulnerable_code_not_present`. Le produit se désigne par un purl (`pkg:npm/%40novafact/settings@3.1.0`).',
    ],
    fix: 'Un VEX n’est pas un document de communication : c’est une affirmation vérifiable, et elle engage. « Non affecté » sans justification prise dans l’énumération, c’est du bruit ; avec la mauvaise justification, c’est un mensonge qui sera découvert au premier incident. La justification force à dire POURQUOI, et c’est là que le travail se fait.',
  },

  {
    id: 'vex-to-cyclonedx', module: 'm05', title: 'Traduire un VEX d’un dialecte à l’autre',
    status: 'live', kind: 'artifact', level: 3, csslp: ['D6', 'D8'], cwe: 'CWE-1059',
    brief:
      'Le client veut le VEX dans son SBOM CycloneDX. Le document source est `fixtures/m05/vex-exemple.json`, le schéma cible `fixtures/m05/cyclonedx-vex.schema.json`. Une conversion naïve produit un document rejeté.',
    goal:
      'Écrire `workspace/scripts/vex2cdx.mjs`, qui prend un document OpenVEX en argument et écrit le document CycloneDX correspondant sur la sortie standard.',
    file: 'scripts/vex2cdx.mjs',
    lessons: ['m05/l05', 'm13/l06'],
    hints: [
      'Ouvre les deux énumérations côte à côte. Ce ne sont pas les mêmes mots, et ce ne sont pas non plus les mêmes cases.',
      'Les statuts se traduisent un pour un. Les justifications, non : quatre des cinq ont une correspondance univoque, deux d’entre elles tombent sur la MÊME valeur CycloneDX — c’est une perte d’information, et c’est la leçon. La cinquième (`vulnerable_code_cannot_be_controlled_by_adversary`) accepte deux traductions, le harnais les prend toutes les deux.',
      '`not_affected` → `not_affected`, `affected` → `exploitable`, `fixed` → `resolved`, `under_investigation` → `in_triage`. Document produit : `{"bomFormat":"CycloneDX","specVersion":"1.6","version":1,"vulnerabilities":[{"id","affects":[{"ref"}],"analysis":{"state","justification"}}]}`. Un statut qui ne porte pas de justification ne doit pas s’en voir ajouter une. Le harnais rejoue ton script sur un document qu’il fabrique au moment du contrôle.',
    ],
    fix: 'Les formats d’échange de sécurité ne sont pas interchangeables : ils encodent des modèles différents, et la traduction perd. Le savoir évite deux choses — livrer un document invalide à un client, et croire qu’on a dit ce qu’on n’a pas dit. Quand la traduction perd, on le documente plutôt que de la laisser passer en silence.',
  },

  {
    id: 'reachability-ast', module: 'm05', title: 'L’atteignabilité, à la main',
    status: 'live', kind: 'artifact', level: 3, csslp: ['D6'], cwe: 'CWE-1059',
    brief:
      'Cinq composants internes signalés vulnérables (`fixtures/m05/advisories.json`). Aucun outil hors ligne ne sait dire, en JavaScript, si le code vulnérable est réellement appelé — il faut lire.',
    goal:
      'Produire `workspace/vulns/reachability.yaml` : pour chaque avis, la chaîne d’appel du point d’entrée HTTP jusqu’au symbole, ou la démonstration qu’elle n’existe pas.',
    file: 'vulns/reachability.yaml',
    lessons: ['m05/l03', 'm12/l02'],
    hints: [
      'Pars de `server/index.ts` : ce qui n’est pas monté n’est atteint par personne. Puis descends, appel par appel, jusqu’au symbole de l’avis.',
      'Le harnais rejoue chaque maillon contre le code : la route doit exister, chaque fonction doit être définie dans le fichier annoncé, et chacune doit appeler la suivante. Un chemin plausible mais faux ne tient pas trente secondes.',
      'Forme attendue : `avis: [{ id, statut, route, chaine, raison, note }]`, les cinq avis. `statut: atteignable` exige `route` (par exemple `PUT /api/settings`) et `chaine`, une liste de `chemin/fichier.ts#fonction` qui se termine sur le symbole de l’avis. `statut: non_atteignable` exige `raison` : `jamais_appelee` quand la fonction existe mais qu’aucune route n’y mène, `symbole_absent` quand le fichier ou la fonction n’existent pas.',
    ],
    fix: 'L’atteignabilité est ce qui distingue une file de mille alertes d’une liste de dix vrais problèmes. Elle ne se sous-traite pas à un outil qui ne sait pas la calculer : pour le JavaScript, aujourd’hui, c’est de la lecture de code — et cette lecture se documente, sinon elle est à refaire au prochain scan.',
  },

  {
    id: 'sla-policy', module: 'm05', title: 'Le SLA qui se mesure',
    status: 'live', kind: 'artifact', level: 2, csslp: ['D6', 'D7'], cwe: 'CWE-1059',
    brief:
      'La politique de remédiation existe en diapositives. Personne ne sait qui est hors délai aujourd’hui. Les constats horodatés sont dans `fixtures/m05/sla-findings.json`, et le harnais connaît le verdict attendu pour chacun.',
    goal:
      'Écrire `workspace/vulns/sla-policy.yaml` (la politique, lisible par une machine) et `workspace/scripts/sla-report.mjs` (ce qui la mesure).',
    file: 'vulns/sla-policy.yaml',
    lessons: ['m05/l05', 'm32/l04'],
    hints: [
      'Depuis juin 2026, la directive de référence adosse les délais à la décision SSVC plutôt qu’à une échéance unique : trois, quatorze ou soixante jours. Et « différer », c’est ne pas poser d’échéance.',
      'Une vulnérabilité activement exploitée n’attend pas le délai d’une critique ordinaire : le plafond du catalogue s’applique en plus, et il ne peut pas dépasser l’échéance officielle (regarde l’écart entre `dateAdded` et `dueDate` dans `fixtures/m05/kev.json`).',
      'Politique : `{version, unite: jours, delais: {immediate, out-of-cycle, scheduled, defer: null}, plafond_kev}`. Règle appliquée : délai = min(delais[ssvc], plafond_kev si la vulnérabilité est au catalogue), `null` = aucune échéance ; âge = (date de correction ou aujourd’hui) − date de constat, en jours ; hors délai quand l’âge dépasse strictement le délai. Script : `node scripts/sla-report.mjs <constats.json> <politique.yaml>` écrit `{"hors_delai":[…]}` sur la sortie standard. Le harnais le rejoue sur des constats qu’il fabrique, et le compare à TA politique.',
    ],
    fix: 'Un SLA qu’on ne mesure pas est une intention. La politique lisible par une machine, le script qui la rejoue et le tableau qui en sort sont un même objet : dès qu’ils se séparent, la politique devient une diapositive et le retard devient invisible.',
  },

  {
    id: 'findings-aggregate', module: 'm05', title: 'Le constat qui agrège tout',
    status: 'live', kind: 'artifact', level: 2, csslp: ['D6'], cwe: 'CWE-1059',
    brief:
      'Les notes CVSS, les scores de probabilité et le statut d’exploitation vivent dans trois fichiers séparés de `fixtures/m05/`, et l’outil de suivi n’en voit aucun.',
    goal:
      'Produire `workspace/vulns/findings.json` : le fichier d’import qui agrège, pour chaque composant vulnérable, tout ce qui sert à décider.',
    file: 'vulns/findings.json',
    lessons: ['m05/l05', 'm05/l03'],
    hints: [
      'Trois fichiers, une jointure par identifiant CVE. Les vingt vulnérabilités du SBOM, aucune de plus, aucune de moins.',
      'Le format d’import est lui-même le validateur : trois champs obligatoires (`cve`, `kev`, `epss`) et une liste blanche stricte — toute clé inventée fait rejeter le document entier. Le harnais recoupe ensuite chaque valeur avec les données embarquées.',
      'Clés permises : `cve`, `composant`, `version`, `cwe`, `cvss_base`, `cvss_severite`, `cvss_vecteur`, `kev` (booléen), `epss` (nombre entre 0 et 1), `epss_percentile`. Document : `{"genere_le","source","constats":[…]}`.',
    ],
    fix: 'C’est le geste qui transforme trois exports en une file de travail. Et la liste blanche stricte n’est pas une coquetterie : un champ mal nommé qui passe en silence, c’est une donnée qui manquera au moment de décider, sans que personne ne s’en aperçoive.',
  },

  {
    id: 'disclosure-policy', module: 'm05', title: 'Publier sa politique de divulgation',
    status: 'live', kind: 'artifact', level: 1, csslp: ['D6', 'D8'], cwe: 'CWE-1059',
    brief:
      'Un chercheur trouve une faille dans Novafact et ne sait pas à qui l’envoyer. Il la publie.',
    goal:
      'Produire `workspace/public/.well-known/security.txt`, conforme à la RFC 9116.',
    file: 'public/.well-known/security.txt',
    lessons: ['m05/l06', 'm06/l06'],
    hints: [
      'La RFC 9116 n’impose que deux champs, mais elle impose leur forme : des URI, et une date.',
      '`Contact` peut apparaître plusieurs fois (mailto:, https:// ou tel:) ; `Expires` une seule, en ISO 8601. Une échéance passée est pire qu’un fichier absent : elle dit que personne ne s’en occupe. Une échéance à cinq ans dit la même chose.',
      'Champs attendus : au moins un `Contact`, exactement un `Expires` situé dans le futur et à moins d’un an, et un `Policy`. Les champs `Policy`, `Canonical`, `Encryption`, `Acknowledgments`, `Hiring` et `CSAF`, s’ils sont présents, portent une URI https. Le harnais ne fait aucune requête réseau : il juge le fichier, pas les serveurs qu’il désigne.',
    ],
    fix: 'Publier la politique coûte une heure et supprime la classe entière des divulgations sauvages « parce que personne ne répondait ». Ce qui coûte, c’est de la tenir : la date d’expiration est le mécanisme qui force la relecture. Le CRA rend l’adresse de signalement obligatoire — autant la rendre utile.',
  },
];

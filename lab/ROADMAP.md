# Feuille de route du Novafact Lab

> Généré depuis `shared/planned/` par `npm run challenges` — ne pas éditer à la main.

**49 challenges spécifiés, pas encore implémentés.** Les challenges jouables sont dans
[CHALLENGES.md](CHALLENGES.md), avec la couverture par leçon et ce que le lab ne couvre pas.

Écrire la spécification avant le code a une raison : c’est elle qui dit si un challenge a sa place ici. Un
défaut qui ne peut être ni exploité par une requête, ni constaté sur un artefact du dépôt, ni produit comme
livrable vérifiable n’est pas un exercice de lab — c’est un jeu ou un atelier, et sa place est sur le site.

Ils vivent dans `shared/planned/`, un fichier par module, séparés du registre jouable : l’API, l’interface et
les tests de régression les ignorent. Les en-têtes de ces fichiers portent les réserves d’implémentation —
formats non confirmés, outils absents de npm, instabilités connues — à lever avant d’écrire le code.

Légende : ⚙ *fix* (corriger un artefact du dépôt) · ✎ *artifact* (produire un livrable). Sans marque : *exploit*.

## M7 · Vulnérabilités côté serveur

| Challenge | Niv. | CWE | Objectif | Dans le cours |
| --- | --- | --- | --- | --- |
| **Cartographier les défauts du lab** ⚙ | N1 | CWE-1008 | Produire la table de correspondance de chaque défaut vers OWASP Top 10:2025, API Top 10 et CWE Top 25, et la garder juste. | [Top 10 2025, API Top 10 et CWE Top 25](http://127.0.0.1:5173/#/modules/m25/l08)<br>[Cycle de vie d’une vulnérabilité](http://127.0.0.1:5173/#/modules/m05/l01) |
| **Injection d’en-tête dans l’e-mail de facture** | N2 | CWE-93 | Faire partir une copie de la facture vers une adresse qui ne figure dans aucun champ destinataire. | [Entrées non fiables dans Express](http://127.0.0.1:5173/#/modules/m02/l01)<br>[Abus de fonctionnalités](http://127.0.0.1:5173/#/modules/m10/l05) |

<details>
<summary>Détail des 2 challenges de ce module</summary>

**Cartographier les défauts du lab** — `inventory.json` · fix · D5 · D6

Le lab contient des dizaines de défauts connus, mais aucun inventaire : personne ne sait ce qu’il couvre ni ce qu’il laisse de côté.

*Classe à éliminer.* Les référentiels ne servent pas à classer pour classer : le Top 10 sensibilise, l’API Top 10 cible les endpoints, le CWE Top 25 nomme la cause racine. C’est la correspondance qui révèle les angles morts — et c’est elle qu’on présente à une direction.

**Injection d’en-tête dans l’e-mail de facture** — `server/store.ts` · exploit · D5 · K10

Le nom du destinataire est interpolé dans les en-têtes du message sans filtrer les retours à la ligne.

*Classe à éliminer.* Tout protocole à en-têtes séparés par des retours de ligne est injectable : refuser `\r` et `\n` dans les valeurs, et construire le message avec une bibliothèque qui encode les en-têtes plutôt que par concaténation.

</details>

## M9 · Web avancé

| Challenge | Niv. | CWE | Objectif | Dans le cours |
| --- | --- | --- | --- | --- |
| **Chaîne de vulnérabilités** | N2 | CWE-691 | Les enchaîner jusqu’à une prise de contrôle de compte, puis désigner le correctif unique qui casse le plus de chaînes. | [Chaînes de vulnérabilités](http://127.0.0.1:5173/#/modules/m03/l04)<br>[Prioriser par le risque](http://127.0.0.1:5173/#/modules/m05/l03) |

<details>
<summary>Détail des 1 challenges de ce module</summary>

**Chaîne de vulnérabilités** — `server/` · exploit · D5 · D6 · K8

Trois défauts jugés mineurs cohabitent : une énumération, une redirection ouverte et une fuite d’identifiant dans un en-tête. Chacun a été classé « informatif » au triage.

*Classe à éliminer.* La sévérité ne s’additionne pas, elle se compose : c’est ce que le triage par CVSS de base rate systématiquement. Chercher les chaînes fait partie de la revue de conception, et un seul contrôle bien placé en coupe souvent plusieurs.

</details>

## M8 · Vulnérabilités côté client & scripts tiers

| Challenge | Niv. | CWE | Objectif | Dans le cours |
| --- | --- | --- | --- | --- |
| **Iframe de paiement sans sandbox** ⚙ | N2 | CWE-1021 | Depuis le contenu de l’iframe, faire naviguer la page de Novafact vers une origine choisie — puis empêcher que ce soit possible. | [Réduire la confiance](http://127.0.0.1:5173/#/modules/m04/l04)<br>[PCI DSS 4.0.1 : 6.4.3 et 11.6.1](http://127.0.0.1:5173/#/modules/m04/l08) |
| **Jeton anti-CSRF non lié à la session** | N2 | CWE-352 | Exécuter une mutation sur le compte d’un autre utilisateur avec un jeton obtenu depuis le tien. | [Isolation d’origine](http://127.0.0.1:5173/#/modules/m04/l07)<br>[React et le navigateur](http://127.0.0.1:5173/#/modules/m04/l02) |
| **Page de paiement sans CSP** ⚙ | N2 | CWE-1021 | Écrire la CSP stricte de la page de paiement : les fonctionnalités marchent toujours, les charges utiles connues ne passent plus. | [CSP stricte en pratique](http://127.0.0.1:5173/#/modules/m04/l05)<br>[En-têtes en production](http://127.0.0.1:5173/#/modules/m17/l05) |
| **Cookie de session mal attribué** | N2 | CWE-1004 | Voler la session depuis une XSS, puis déclencher une action authentifiée depuis un autre site. | [Isolation d’origine](http://127.0.0.1:5173/#/modules/m04/l07)<br>[React et le navigateur](http://127.0.0.1:5173/#/modules/m04/l02) |
| **Surveiller ce que la page charge** ⚙ | N3 | CWE-778 | Mettre en place la collecte des rapports de CSP et la surveillance d’intégrité des scripts, et le prouver en modifiant un script. | [Surveiller le client](http://127.0.0.1:5173/#/modules/m04/l09)<br>[Détections applicatives](http://127.0.0.1:5173/#/modules/m28/l05) |

<details>
<summary>Détail des 5 challenges de ce module</summary>

**Iframe de paiement sans sandbox** — `src/pages/Checkout.tsx` · fix · D4 · D5

L’iframe du prestataire est chargée sans attribut `sandbox` ni `allow`, et peut naviguer la fenêtre parente.

*Classe à éliminer.* `sandbox` avec les seules capacités nécessaires, `allow` minimal, et `frame-ancestors` côté prestataire. Isoler le paiement dans une iframe n’a de valeur que si l’iframe est réellement contrainte — c’est l’esprit de l’exigence PCI 6.4.3.

**Jeton anti-CSRF non lié à la session** — `server/lib/auth.ts` · exploit · D5

Les jetons anti-CSRF sont tirés d’un pool commun et validés sans être rattachés à la session qui les a reçus.

*Classe à éliminer.* Le jeton est lié à la session et vérifié comme tel. Un jeton « valide dans l’absolu » ne prouve rien sur l’auteur de la requête. Et Fetch Metadata offre une défense qui ne dépend d’aucun jeton.

**Page de paiement sans CSP** — `server/index.ts` · fix · D5 · D7

Aucune politique de sécurité du contenu n’est servie : une XSS stockée s’exécute sans rencontrer la moindre barrière.

*Classe à éliminer.* CSP à nonce avec `strict-dynamic`, déployée en observation puis en blocage, rapports collectés. La CSP est aussi un capteur : ses rapports disent ce qui tente de s’exécuter.

**Cookie de session mal attribué** — `server/lib/auth.ts` · exploit · D5

Le cookie de session n’a ni restriction de transport, ni protection contre la lecture par script, ni politique d’envoi inter-sites.

*Classe à éliminer.* Préfixe `__Host-` (donc `Secure`, `Path=/`, sans `Domain`), `HttpOnly`, `SameSite`. Les valeurs par défaut du framework devraient suffire : si l’on doit y penser, c’est que le chemin sûr n’est pas le plus facile.

**Surveiller ce que la page charge** — `server/routes/lab.ts` · fix · D7 · D8

Rien ne détecte qu’un script de la page de paiement a changé : ni empreinte, ni rapport, ni alerte. Un skimmer y vivrait indéfiniment.

*Classe à éliminer.* Point de collecte des rapports (Reporting API), inventaire des scripts avec leur empreinte, comparaison à chaque déploiement, et alerte sur écart. C’est l’exigence PCI 11.6.1, et c’est ce qui aurait raccourci Magecart et polyfill.io de plusieurs mois.

</details>

## M26 · Gestion des vulnérabilités

| Challenge | Niv. | CWE | Objectif | Dans le cours |
| --- | --- | --- | --- | --- |
| **Le vecteur CVSS 4.0 qui se recalcule** ✎ | N1 | CWE-1059 | Écrire le vecteur CVSS 4.0 de chacun, métriques environnementales de Novafact comprises, et mesurer l’écart avec le score de base seul. | [CVSS 4.0](http://127.0.0.1:5173/#/modules/m05/l02)<br>[Prioriser par le risque](http://127.0.0.1:5173/#/modules/m05/l03) |
| **Le test de régression plutôt que la preuve d’exploitation** ✎ | N2 | CWE-1059 | Fournir à la place le test de régression qui déclenche le bug, et montrer qu’il suffit à emporter la décision. | [Faut-il un exploit pour faire corriger ?](http://127.0.0.1:5173/#/modules/m05/l04)<br>[Tests de sécurité écrits par les devs](http://127.0.0.1:5173/#/modules/m13/l02) |

<details>
<summary>Détail des 2 challenges de ce module</summary>

**Le vecteur CVSS 4.0 qui se recalcule** — `vulns/cvss.yaml` · artifact · D6

Trois défauts jouables du lab — BOLA, SSRF vers les métadonnées, jeton forgé — n’ont pas de note. Chacun « semble critique » à celui qui vient de l’exploiter.

*Classe à éliminer.* La bibliothèque rejette un vecteur dont les métriques sont dans le désordre, hors énumération ou incomplètes : la nomenclature est notée en même temps que le score. Et c’est l’écart entre le score de base et le score environnemental qui porte la leçon — un même défaut ne vaut pas la même chose selon où il vit.

**Le test de régression plutôt que la preuve d’exploitation** — `verify/bola.regression.test.ts` · artifact · D6

L’équipe produit refuse de prioriser un défaut « tant qu’on n’a pas vu qu’il est exploitable ». Écrire la preuve d’exploitation prendrait deux jours.

*Classe à éliminer.* Le test doit échouer contre le code livré et passer contre le corrigé : c’est la même démonstration qu’une preuve d’exploitation, pour une fraction du coût, et il reste dans la CI après la correction. Kohnfelder soutient qu’une preuve d’exploitation est rarement nécessaire — c’est l’occasion de confronter cette position à ta pratique de pentester.

</details>

## M30 · Faire adopter la sécurité

| Challenge | Niv. | CWE | Objectif | Dans le cours |
| --- | --- | --- | --- | --- |
| **Le correctif qu’on peut fusionner** ✎ | N2 | CWE-1059 | Accompagner le finding du test de régression qui échoue aujourd’hui et passera après correction. | [Écrire un finding qui sera corrigé](http://127.0.0.1:5173/#/modules/m06/l01)<br>[Tests de sécurité écrits par les devs](http://127.0.0.1:5173/#/modules/m13/l02) |

<details>
<summary>Détail des 1 challenges de ce module</summary>

**Le correctif qu’on peut fusionner** — `findings/bola-invoice.test.ts` · artifact · D2 · D6

Le constat est juste, mais il arrive seul. L’équipe doit deviner comment prouver qu’elle l’a corrigé.

*Classe à éliminer.* Double passage : le test doit échouer contre le code livré et passer contre le corrigé. Un test qui passe partout ne prouve rien, un test qui échoue partout casse la fonctionnalité. C’est la vérification la plus solide du lab — et une PR de correctif vaut mieux qu’un PDF.

</details>

## M12 · Exigences, vie privée & conformité

| Challenge | Niv. | CWE | Objectif | Dans le cours |
| --- | --- | --- | --- | --- |
| **L’abuse case exécutable** ✎ | N2 | CWE-1059 | Écrire trois cas d’abus de Novafact et le code qui les incarne, sur trois routes distinctes. | [Exigences et abuse cases](http://127.0.0.1:5173/#/modules/m07/l01)<br>[STRIDE par élément](http://127.0.0.1:5173/#/modules/m11/l02) |

<details>
<summary>Détail des 1 challenges de ce module</summary>

**L’abuse case exécutable** — `requirements/abuse-cases.feature` · artifact · D3 · D6

Les user stories décrivent ce que l’utilisateur veut faire. Rien ne décrit ce qu’un utilisateur malveillant voudrait en faire.

*Classe à éliminer.* Chaque scénario doit échouer contre le code livré et passer contre le corrigé. Un abuse case qu’on ne sait pas exécuter n’est pas un abuse case : c’est une inquiétude. Le passage à l’exécutable est ce qui le fait entrer dans la définition de « terminé ».

</details>

## M13 · Spécifier et concevoir

| Challenge | Niv. | CWE | Objectif | Dans le cours |
| --- | --- | --- | --- | --- |
| **Webhook signé mais rejouable** | N2 | CWE-294 | Rejouer une notification de paiement pour créditer deux fois la même facture. | [Crypto pour développeurs](http://127.0.0.1:5173/#/modules/m08/l07)<br>[Invariants métier](http://127.0.0.1:5173/#/modules/m10/l06) |
| **Mots de passe hachés trop vite** ⚙ | N2 | CWE-916 | Migrer vers argon2id sans déconnecter les comptes existants ni stocker un seul mot de passe en clair. | [Authentification applicative](http://127.0.0.1:5173/#/modules/m09/l01)<br>[Crypto pour développeurs](http://127.0.0.1:5173/#/modules/m08/l07) |
| **Clé de signature unique et éternelle** ⚙ | N3 | CWE-321 | Rendre la clé rotative sans invalider les jetons en cours, et sans redéploiement. | [Crypto pour développeurs](http://127.0.0.1:5173/#/modules/m08/l07)<br>[Protection à l’exécution](http://127.0.0.1:5173/#/modules/m17/l08) |
| **Nommer les patterns déjà présents** ✎ | N1 | CWE-1059 | Rattacher chaque contrôle existant au pattern qu’il implémente, et chaque défaut structurel à son anti-pattern. | [Les 14 patterns](http://127.0.0.1:5173/#/modules/m08/l03)<br>[Les 4 anti-patterns](http://127.0.0.1:5173/#/modules/m08/l04) |

<details>
<summary>Détail des 4 challenges de ce module</summary>

**Webhook signé mais rejouable** — `server/routes/webhooks.ts` · exploit · D1 · D5 · K5

Les webhooks entrants du prestataire de paiement sont signés, mais la signature ne couvre ni horodatage ni identifiant unique.

*Classe à éliminer.* Un MAC ne prouve que l’origine, pas la fraîcheur : horodatage signé et fenêtre d’acceptation courte, identifiant d’événement conservé pour rejeter les doublons. L’idempotence est la vraie défense.

**Mots de passe hachés trop vite** — `server/store.ts` · fix · D1 · D5 · K5

Les mots de passe sont stockés en SHA-256 sans sel. Rapide à vérifier, donc rapide à casser hors ligne.

*Classe à éliminer.* argon2id avec des paramètres tenus à jour, sel par compte, et migration opportuniste au prochain login. Le coût de vérification est un paramètre de sécurité, pas de performance.

**Clé de signature unique et éternelle** — `server/lib/jwt.ts` · fix · D1 · D7 · K5

Une seule clé signe les jetons de tous les tenants, codée en dur, sans identifiant de version ni moyen de rotation.

*Classe à éliminer.* Agilité cryptographique : identifiant de clé (`kid`) dans l’en-tête, trousseau qui accepte l’ancienne et la nouvelle pendant la transition, clés dans Secrets Manager, rotation planifiée et testée. Une clé qu’on ne sait pas tourner est une clé qu’on ne tournera pas après une fuite.

**Nommer les patterns déjà présents** — `threats/patterns.yaml` · artifact · D1 · D4 · K4

Novafact applique déjà plusieurs patterns de conception sans les nommer, et souffre d’au moins trois anti-patterns que personne n’a qualifiés.

*Classe à éliminer.* Le harnais vérifie que chaque pattern cité appartient aux quatorze, chaque anti-pattern aux quatre, et que le fichier désigné existe et contient bien le contrôle. Nommer sert à discuter : « c’est un confused deputy » fait avancer une revue là où « ce n’est pas très propre » l’enlise.

</details>

## M14 · Identité : authentification, autorisation, OAuth & SAML

| Challenge | Niv. | CWE | Objectif | Dans le cours |
| --- | --- | --- | --- | --- |
| **Lier le jeton à son porteur** ⚙ | N3 | CWE-294 | Lier chaque jeton à une clé détenue par le client, et refuser sa réutilisation ailleurs. | [RFC 9700, DPoP, PAR et FAPI](http://127.0.0.1:5173/#/modules/m09/l07)<br>[Protocoles d’authentification avancés](http://127.0.0.1:5173/#/modules/m03/l10) |

<details>
<summary>Détail des 1 challenges de ce module</summary>

**Lier le jeton à son porteur** — `server/lib/jwt.ts` · fix · D1 · D5 · K5

Les jetons d’accès sont au porteur : quiconque en vole un peut l’utiliser, depuis n’importe où.

*Classe à éliminer.* Un jeton lié transforme un vol de jeton en vol inutile : il faut aussi la clé privée. C’est ce que résolvent DPoP et les jetons liés à mTLS, et ce que le BCP de sécurité OAuth recommande pour tout ce qui compte. Le harnais rejoue un jeton volé depuis un autre client et exige un refus.

</details>

## M15 · Anti-abus, ATO & fraude

| Challenge | Niv. | CWE | Objectif | Dans le cours |
| --- | --- | --- | --- | --- |
| **Nommer l’abus qu’on subit** ✎ | N1 | CWE-1059 | Classer le trafic observé dans les catégories de la taxonomie des menaces automatisées, et associer à chacune son contrôle. | [Taxonomie des menaces automatisées](http://127.0.0.1:5173/#/modules/m10/l01)<br>[Détecter et répondre à la fraude](http://127.0.0.1:5173/#/modules/m10/l07) |
| **Distinguer un bot d’un client** ⚙ | N2 | CWE-799 | Poser des défis proportionnés au risque, et mesurer ce qu’ils bloquent contre ce qu’ils coûtent aux vrais clients. | [Bots et Fraud Control](http://127.0.0.1:5173/#/modules/m10/l04)<br>[Limitation de débit bien conçue](http://127.0.0.1:5173/#/modules/m10/l03) |

<details>
<summary>Détail des 2 challenges de ce module</summary>

**Nommer l’abus qu’on subit** — `abuse/oat-classification.yaml` · artifact · D3 · D4

Le support signale « des comportements bizarres ». Les journaux contiennent en réalité quatre abus automatisés distincts, qui n’appellent pas les mêmes contrôles.

*Classe à éliminer.* Le harnais connaît la vérité terrain du corpus et note le classement. Nommer sert à choisir : un scraping ne se traite pas comme un bourrage d’identifiants, et confondre les deux fait poser le mauvais contrôle — souvent celui qui gêne les vrais clients.

**Distinguer un bot d’un client** — `server/routes/auth.ts` · fix · D4 · D7

L’inscription et la connexion sont ouvertes à l’automatisation. Un CAPTCHA a été ajouté partout, et les clients légitimes s’en plaignent.

*Classe à éliminer.* Défi invisible par défaut, visible seulement au-dessus d’un score de risque : le coût se paie sur le trafic suspect, pas sur tout le monde. L’empreinte d’appareil aide, avec ses limites — c’est une donnée personnelle, et elle entre dans la classification des données.

</details>

## M16 · Revue de code sécurité

| Challenge | Niv. | CWE | Objectif | Dans le cours |
| --- | --- | --- | --- | --- |
| **Chasse aux variantes** ⚙ | N2 | CWE-1006 | Trouver les trois variantes restantes et les corriger toutes — le test ne passe que si aucune ne subsiste. | [Méthode sur une base inconnue](http://127.0.0.1:5173/#/modules/m12/l02)<br>[Écrire ses règles](http://127.0.0.1:5173/#/modules/m13/l04) |

<details>
<summary>Détail des 1 challenges de ce module</summary>

**Chasse aux variantes** — `server/` · fix · D5 · D6

Une des classes déjà corrigées subsiste à trois autres endroits, sous une forme un peu différente.

*Classe à éliminer.* Le seuil « toutes ou rien » est exactement l’enjeu : un finding est une classe, pas une instance. Après chaque correctif, chercher le même motif ailleurs (ripgrep, puis une règle), et transformer la règle en garde-fou de CI pour que la classe ne revienne pas.

</details>

## M17 · Tests & analyse de code

| Challenge | Niv. | CWE | Objectif | Dans le cours |
| --- | --- | --- | --- | --- |
| **Le test qui prouve qu’un contrôle refuse** ✎ | N1 | CWE-1059 | Écrire, pour trois challenges déjà corrigés, le couple de tests qui manque. | [Tests de sécurité écrits par les devs](http://127.0.0.1:5173/#/modules/m13/l02)<br>[Écrire un finding qui sera corrigé](http://127.0.0.1:5173/#/modules/m06/l01) |
| **La même règle, en mode taint** ✎ | N2 | CWE-1059 | Porter la règle en mode taint : source, sink, et le schéma de validation comme assainisseur. | [Écrire ses règles](http://127.0.0.1:5173/#/modules/m13/l04)<br>[Méthode sur une base inconnue](http://127.0.0.1:5173/#/modules/m12/l02) |
| **La propriété qui trouve le bug d’argent** ✎ | N2 | CWE-1059 | Écrire la propriété qui doit tenir sur tout total de facture, et la laisser chercher le contre-exemple. | [Fuzzing et tests de disponibilité](http://127.0.0.1:5173/#/modules/m13/l05)<br>[Footguns JavaScript et argent](http://127.0.0.1:5173/#/modules/m02/l02) |
| **Le fuzz qui casse le parseur** ✎ | N2 | CWE-1333 | Écrire la cible de fuzz, trouver l’entrée qui fait exploser le temps de calcul, et la figer en régression. | [Fuzzing et tests de disponibilité](http://127.0.0.1:5173/#/modules/m13/l05)<br>[Spécificités Node.js](http://127.0.0.1:5173/#/modules/m02/l03) |
| **Le DAST sur environnement éphémère** ✎ | N2 | CWE-1059 | Le brancher en CI sur une instance éphémère, authentifié, avec le périmètre et le seuil de blocage. | [DAST et secrets](http://127.0.0.1:5173/#/modules/m13/l07)<br>[Jalons, portes et exceptions](http://127.0.0.1:5173/#/modules/m32/l03) |
| **Secrets dans le dépôt** ⚙ | N1 | CWE-798 | Les trouver tous, les sortir du code, et mettre en place ce qui empêche le prochain d’entrer. | [DAST et secrets](http://127.0.0.1:5173/#/modules/m13/l07)<br>[Configuration de production](http://127.0.0.1:5173/#/modules/m17/l01) |

<details>
<summary>Détail des 6 challenges de ce module</summary>

**Le test qui prouve qu’un contrôle refuse** — `verify/` · artifact · D6

Les tests existants vérifient tous que la fonctionnalité marche. Aucun ne vérifie qu’un contrôle refuse.

*Classe à éliminer.* Double passage, plus une contrainte structurelle : chaque suite doit contenir au moins un cas qui refuse et un cas qui autorise. Un test qui ne vérifie que le chemin heureux est rejeté — ce qui est exactement la leçon de l’exercice K12 de Kohnfelder.

**La même règle, en mode taint** — `rules/tainted-body.yaml` · artifact · D5 · D6

La règle de lint attrape un motif syntaxique. Elle ne sait pas suivre une donnée du corps de la requête jusqu’au sink, à travers trois fonctions.

*Classe à éliminer.* Le fichier de test annoté est le correcteur : l’outil compare ses findings aux annotations et sort en erreur au moindre écart. Le suivi de teinte est ce qui transforme une règle « qui trouve des mots » en une règle qui trouve des chemins — et donc la variant analysis en geste systématique.

**La propriété qui trouve le bug d’argent** — `verify/money.property.test.ts` · artifact · D6

Les tests de calcul de total passent : ils portent tous sur des cas que le développeur avait en tête.

*Classe à éliminer.* Graine fixée, donc reproductible : la propriété doit échouer contre le code livré et passer contre le corrigé. Le harnais exige de surcroît que l’espace exploré couvre les quantités négatives et les flottants — sinon la propriété est trop faible pour trouver quoi que ce soit.

**Le fuzz qui casse le parseur** — `fuzz/invoice-ref.fuzz.ts` · artifact · D6

La validation de référence de facture n’a jamais vu autre chose que des références de facture.

*Classe à éliminer.* Le harnais rejoue le corpus trouvé en mode régression — pas en mode recherche, c’est ce qui rend le résultat déterministe — et exige qu’au moins une entrée dépasse le seuil contre le code livré et aucune contre le corrigé. Le budget de temps est le verdict.

**Le DAST sur environnement éphémère** — `.github/workflows/dast.yml` · artifact · D6

Le scanner dynamique tourne une fois par trimestre, sur un environnement qui ne ressemble plus à la production.

*Classe à éliminer.* Le harnais lance le lab, exécute le scan et vérifie qu’il trouve les défauts connus sans dépasser le budget de temps. Un DAST non authentifié ne voit qu’une page de connexion : l’authentification est ce qui fait la différence entre un scan et une figure de style.

**Secrets dans le dépôt** — `.env.example` · fix · D6 · D7

Des identifiants traînent dans la configuration, dans un fichier d’exemple et dans un test.

*Classe à éliminer.* Détection en pre-commit et en CI, protection côté forge. Et surtout : corriger un secret exposé, c’est le **révoquer** — le retirer du fichier ne le retire ni de l’historique ni des clones déjà faits.

</details>

## M18 · Pipeline, supply chain & fournisseurs

| Challenge | Niv. | CWE | Objectif | Dans le cours |
| --- | --- | --- | --- | --- |
| **Répondre à un incident supply chain** ⚙ | N3 | CWE-1395 | Produire la réponse : versions réellement installées, secrets à tourner, runners à nettoyer, et la requête qui chasse les indicateurs de compromission. | [Répondre à un incident supply chain](http://127.0.0.1:5173/#/modules/m14/l11)<br>[Gérer une critique à J+0](http://127.0.0.1:5173/#/modules/m05/l07) |
| **Exigences de sécurité envers un fournisseur** ⚙ | N2 | CWE-1059 | Écrire les exigences vérifiables de chaque fournisseur et les rattacher aux contrôles techniques qui les constatent. | [Fournisseurs et tiers](http://127.0.0.1:5173/#/modules/m14/l09)<br>[Conformité : NIS2, CRA, PCI DSS](http://127.0.0.1:5173/#/modules/m07/l05) |

<details>
<summary>Détail des 2 challenges de ce module</summary>

**Répondre à un incident supply chain** — `incident/` · fix · D7 · D8

Un avis annonce qu’une version d’une dépendance directe a été compromise pendant six heures. Le dépôt contient le lockfile, le SBOM et les journaux de CI de cette période.

*Classe à éliminer.* Le SBOM sert enfin à quelque chose : il répond en minutes à « sommes-nous touchés ». Le reste est un ordre de priorité — rotation des secrets d’abord (ils sont peut-être déjà partis), puis nettoyage des runners, puis correctif. Playbook Shai-Hulud.

**Exigences de sécurité envers un fournisseur** — `vendors/` · fix · D3 · D8

L’intégration du prestataire de paiement et celle du fournisseur d’IA n’ont aucune exigence écrite : ni notification d’incident, ni journalisation vers le SIEM, ni résidence des données.

*Classe à éliminer.* Une exigence fournisseur ne vaut que si elle est vérifiable : « notification sous 72 h » se teste par un exercice, « logs vers le SIEM » se constate par une ingestion. Le reste relève du contrat (droit d’audit, séquestre, responsabilité). NIST SP 800-161r1, ISO/IEC 27036, CSA CAIQ.

</details>

## M20 · Infrastructure as Code

| Challenge | Niv. | CWE | Objectif | Dans le cours |
| --- | --- | --- | --- | --- |
| **La dérive entre le code et le réel** ✎ | N3 | CWE-1059 | Détecter l’écart à partir de l’état réel fourni, dire ce qui a dérivé, et décider pour chaque écart : ramener au code, ou reprendre dans le code. | [Dérive et runtime](http://127.0.0.1:5173/#/modules/m16/l05)<br>[Protection à l’exécution](http://127.0.0.1:5173/#/modules/m17/l08) |

<details>
<summary>Détail des 1 challenges de ce module</summary>

**La dérive entre le code et le réel** — `scripts/drift.mjs` · artifact · D7

Un correctif d’urgence a été appliqué à la main en production. Le code décrit une infrastructure qui n’existe plus.

*Classe à éliminer.* Le harnais fournit l’état réel et connaît les écarts. La dérive est inévitable ; ce qui distingue une équipe, c’est de la voir en jours plutôt qu’en trimestres. Le préventif — les politiques qui refusent — ne remplace pas le détectif.

</details>

## M21 · Déploiement, exploitation & résilience

| Challenge | Niv. | CWE | Objectif | Dans le cours |
| --- | --- | --- | --- | --- |
| **En-têtes de sécurité absents** ⚙ | N1 | CWE-693 | Poser les en-têtes au bon endroit et vérifier qu’ils survivent au déploiement. | [Configuration de production](http://127.0.0.1:5173/#/modules/m17/l01)<br>[En-têtes en production](http://127.0.0.1:5173/#/modules/m17/l05) |
| **Le secret de repli** ⚙ | N1 | CWE-1188 | Faire échouer le démarrage plutôt que de continuer avec une valeur connue de tous. | [Configuration de production](http://127.0.0.1:5173/#/modules/m17/l01)<br>[Crypto pour développeurs](http://127.0.0.1:5173/#/modules/m08/l07) |
| **La CSP qui ne protège de rien** ⚙ | N2 | CWE-693 | La resserrer jusqu’à ce qu’elle arrête réellement les charges utiles, sans casser l’application. | [En-têtes en production](http://127.0.0.1:5173/#/modules/m17/l05)<br>[CSP stricte en pratique](http://127.0.0.1:5173/#/modules/m04/l05) |
| **Aucun garde-fou de disponibilité** ⚙ | N2 | CWE-770 | Poser les limites et l’arrêt gracieux, et le prouver par une requête surdimensionnée et un signal d’arrêt. | [Résilience et continuité](http://127.0.0.1:5173/#/modules/m17/l06)<br>[Fuzzing et tests de disponibilité](http://127.0.0.1:5173/#/modules/m13/l05) |
| **Éteindre un service proprement** ✎ | N2 | CWE-1059 | Écrire et exécuter la procédure de mise hors service, et prouver qu’il ne reste rien d’atteignable. | [Fin de vie](http://127.0.0.1:5173/#/modules/m17/l07)<br>[Classification des données](http://127.0.0.1:5173/#/modules/m07/l03) |

<details>
<summary>Détail des 5 challenges de ce module</summary>

**En-têtes de sécurité absents** — `server/index.ts` · fix · D7

Aucun en-tête de sécurité n’est servi : ni transport strict, ni non-reniflage, ni politique de référent, ni politique de permissions.

*Classe à éliminer.* Une bibliothèque d’en-têtes pour la base, puis ceux conçus en M8 appliqués soit dans l’application, soit dans la politique de réponse du CDN — mais à un seul endroit, et vérifiés après chaque déploiement. Deux endroits qui posent des en-têtes finissent par se contredire.

**Le secret de repli** — `server/lib/jwt.ts` · fix · D7 · K5

La clé de signature a une valeur de repli codée en dur, utilisée quand la variable d’environnement est absente. Elle l’a été une fois en production.

*Classe à éliminer.* Un repli sur une valeur de développement est un échec silencieux, donc le pire type d’échec : l’application démarre, sert, et tous ses jetons sont forgeables. Échouer bruyamment au démarrage est ici le comportement sûr.

**La CSP qui ne protège de rien** — `server/index.ts` · fix · D7

Une politique de sécurité du contenu existe, mais elle autorise l’inline, l’évaluation dynamique et toutes les origines en HTTPS.

*Classe à éliminer.* Une CSP permissive est pire qu’aucune : elle rassure les audits et n’arrête rien. Nonce plutôt qu’inline, diffusion dynamique plutôt que liste d’origines, et déploiement en observation d’abord pour mesurer ce qui casse.

**Aucun garde-fou de disponibilité** — `server/index.ts` · fix · D7

Pas de limite de taille de corps, pas de délai d’expiration serveur, pas d’arrêt gracieux : une coupure de tâche perd les requêtes en vol.

*Classe à éliminer.* La disponibilité est une propriété de sécurité : une limite de corps absente, c’est une mémoire épuisable par une requête. Et un arrêt gracieux est ce qui rend un déploiement invisible pour les clients, donc fréquent, donc sûr.

**Éteindre un service proprement** — `runbooks/decommission.md` · artifact · D2 · D7 · K4

L’ancien service d’export a été remplacé il y a six mois. Son enregistrement DNS, son rôle, sa clé d’API et ses données sont toujours là.

*Classe à éliminer.* Le harnais vérifie chaque étape sur l’état fourni : enregistrement retiré, identifiants révoqués, données archivées selon leur durée de conservation, dépendances prévenues. Un service oublié est une surface qui n’est plus patchée et que plus personne ne surveille — c’est l’anti-pattern du composant non patchable.

</details>

## M23 · Journalisation & SIEM (Elastic)

| Challenge | Niv. | CWE | Objectif | Dans le cours |
| --- | --- | --- | --- | --- |
| **Le journal infalsifiable** | N2 | CWE-778 | Effacer la trace d’une action, puis poser le contrôle d’intégrité qui nomme l’endroit exact où la chaîne rompt. | [Journaliser pour la sécurité](http://127.0.0.1:5173/#/modules/m18/l01)<br>[C-I-A et Gold Standard](http://127.0.0.1:5173/#/modules/m01/l03) |

<details>
<summary>Détail des 1 challenges de ce module</summary>

**Le journal infalsifiable** — `server/routes/admin.ts` · exploit · D7 · K1

Une route d’administration permet de supprimer des lignes d’audit après coup. Rien ne le détecte.

*Classe à éliminer.* Chaînage par empreinte, ou export en écriture seule vers un stockage verrouillé. Effacer ses traces est une étape standard : si le journal est altérable par le compte compromis, il ne prouve rien. Le « A » du Gold Standard suppose l’intégrité.

</details>

## M27 · Sécurité des applications LLM

| Challenge | Niv. | CWE | Objectif | Dans le cours |
| --- | --- | --- | --- | --- |
| **Le profil de la session** ✎ | N2 | CWE-1059 | Configurer l’agent pour qu’une même charge utile réussisse avec les trois, et échoue dès qu’on en retire une seule, quelle qu’elle soit. | [Patterns de conception pour agents](http://127.0.0.1:5173/#/modules/m19/l03)<br>[OWASP LLM Top 10 2026](http://127.0.0.1:5173/#/modules/m19/l01) |
| **Cartographier avec ATLAS** ✎ | N2 | CWE-1059 | Rattacher chaque challenge à sa technique ATLAS et au risque du Top 10 correspondant, et repérer les trous. | [MITRE ATLAS et OWASP AI Exchange](http://127.0.0.1:5173/#/modules/m19/l05)<br>[MITRE pour l’AppSec](http://127.0.0.1:5173/#/modules/m11/l04) |

<details>
<summary>Détail des 2 challenges de ce module</summary>

**Le profil de la session** — `server/routes/assistant.ts` · artifact · D4

Chaque session de l’assistant cumule trois capacités : lire du contenu non fiable, accéder à des données sensibles, agir vers l’extérieur.

*Classe à éliminer.* C’est la démonstration expérimentale de la lethal trifecta et de la Rule of Two : ce n’est pas une capacité qui est dangereuse, c’est leur cumul. Et c’est ce qui donne un critère de conception plutôt qu’une liste de bonnes intentions.

**Cartographier avec ATLAS** — `threats/atlas-coverage.csv` · artifact · D4

Les challenges IA du lab ne sont rattachés à aucun référentiel : impossible de dire ce que la défense couvre.

*Classe à éliminer.* Le harnais vérifie que chaque technique citée existe et n’est pas dépréciée. ATLAS est à l’IA ce qu’ATT&CK est au reste : il donne un vocabulaire commun aux équipes de détection et de développement — dont les ajouts agentiques récents.

</details>

## M32 · Capstone : revue de sécurité de Novafact

| Challenge | Niv. | CWE | Objectif | Dans le cours |
| --- | --- | --- | --- | --- |
| **Étape 1 · Exigences et traçabilité** ✎ | N3 | CWE-1059 | Produire le sous-ensemble ASVS L2, la classification des données, et la matrice qui relie chaque exigence à sa preuve. | [Exigences et traçabilité](http://127.0.0.1:5173/#/modules/m20/l03)<br>[Matrice de traçabilité](http://127.0.0.1:5173/#/modules/m07/l02) |
| **Étape 2 · Design doc et revue de conception** ✎ | N3 | CWE-1059 | Écrire le design doc, mener la revue selon les six étapes, et classer les constats en Must / Ought / Should. | [Design doc et revue de conception](http://127.0.0.1:5173/#/modules/m20/l04)<br>[Mener une Security Design Review](http://127.0.0.1:5173/#/modules/m08/l10)<br>[La spécification technique : le design doc](http://127.0.0.1:5173/#/modules/m08/l09) |
| **Étape 3 · Threat model** ✎ | N3 | CWE-1059 | Produire le modèle de menaces complet de Novafact, avec les frontières de confiance et une mitigation par menace retenue. | [Threat model](http://127.0.0.1:5173/#/modules/m20/l02)<br>[Les 4 questions et la démarche](http://127.0.0.1:5173/#/modules/m11/l01) |
| **Étape 4 · Revue de PR, règles et tests** ✎ | N3 | CWE-1059 | Rendre la revue, écrire la règle qui trouve toutes les variantes, et le test de régression qui les ferme. | [Revue de PR, règles et tests](http://127.0.0.1:5173/#/modules/m20/l06)<br>[Revoir une PR en 10 minutes](http://127.0.0.1:5173/#/modules/m12/l03) |
| **Étape 5 · Page de paiement** ✎ | N3 | CWE-1021 | Inventorier les scripts, écrire la CSP stricte, et satisfaire les exigences d’inventaire et de détection de modification. | [Page de paiement](http://127.0.0.1:5173/#/modules/m20/l08)<br>[PCI DSS 4.0.1 : 6.4.3 et 11.6.1](http://127.0.0.1:5173/#/modules/m04/l08) |
| **Étape 6 · Contrôles anti-abus** ✎ | N3 | CWE-1059 | Poser les contrôles sur les trois parcours, et mesurer ce qu’ils bloquent et ce qu’ils gênent. | [Contrôles anti-abus](http://127.0.0.1:5173/#/modules/m20/l05)<br>[Limitation de débit bien conçue](http://127.0.0.1:5173/#/modules/m10/l03) |
| **Étape 7 · Pipeline et supply chain** ✎ | N3 | CWE-1059 | Durcir les workflows, la publication et les dépendances, et produire le SBOM qui répondra le jour de l’incident. | [Pipeline et supply chain](http://127.0.0.1:5173/#/modules/m20/l09)<br>[OWASP Top 10 CI/CD](http://127.0.0.1:5173/#/modules/m14/l01) |
| **Étape 8 · IAM au moindre privilège** ✎ | N3 | CWE-732 | Réécrire les politiques à partir de l’usage réel, et poser le périmètre de données qui rattrape ce qu’elles laissent passer. | [IAM au moindre privilège](http://127.0.0.1:5173/#/modules/m20/l10)<br>[Moindre privilège en pratique](http://127.0.0.1:5173/#/modules/m15/l05) |
| **Étape 9 · Vulnérabilités avancées** ⚙ | N3 | CWE-1059 | Les corriger tous, et faire passer au vert la suite de régression complète. | [Vulnérabilités avancées](http://127.0.0.1:5173/#/modules/m20/l07)<br>[Chaînes de vulnérabilités](http://127.0.0.1:5173/#/modules/m03/l04) |
| **Étape 10 · Cinq détections testées** ✎ | N3 | CWE-1059 | Écrire cinq détections couvrant les attaques du capstone, avec leurs fixtures et leur recette de validation. | [Cinq détections Elastic](http://127.0.0.1:5173/#/modules/m20/l11)<br>[Règles, Sigma et detection-as-code](http://127.0.0.1:5173/#/modules/m28/l03) |
| **Étape 11 · Roadmap à 12 mois** ✎ | N3 | CWE-1059 | Produire l’évaluation de maturité et la feuille de route qui referme les écarts, trimestre par trimestre. | [Roadmap SAMM à 12 mois](http://127.0.0.1:5173/#/modules/m20/l14)<br>[OWASP SAMM v2](http://127.0.0.1:5173/#/modules/m24/l02) |
| **Étape 12 · Adoption et restitution** ✎ | N3 | CWE-1059 | Produire le plan d’adoption — champions, formation, SLA, portes de contrôle — et la restitution en une page. | [Plan d’adoption et restitution](http://127.0.0.1:5173/#/modules/m20/l15)<br>[Le paved road comme produit](http://127.0.0.1:5173/#/modules/m06/l05) |

<details>
<summary>Détail des 12 challenges de ce module</summary>

**Étape 1 · Exigences et traçabilité** — `capstone/01-requirements/` · artifact · D3

Novafact part en revue complète. Rien n’est écrit de ce qu’elle doit tenir.

*Classe à éliminer.* Reprend les livrables de M12 et les consolide. Le harnais vérifie la cohérence interne : toute donnée classée sensible doit être couverte par au moins une exigence, et toute exigence doit avoir un test qui passe.

**Étape 2 · Design doc et revue de conception** — `capstone/02-design/` · artifact · D4 · K6, K7

Une nouvelle fonctionnalité — l’export comptable multi-tenant — arrive en conception. C’est le moment le moins cher pour la corriger.

*Classe à éliminer.* Le harnais vérifie la présence des rubriques du gabarit, que chaque constat cite un élément du design, et que les positions divergentes sont documentées. Le designer a le dernier mot : ce qui compte est que le désaccord soit tracé, pas qu’il soit gagné.

**Étape 3 · Threat model** — `capstone/03-threats/` · artifact · D4 · K2

La conception est arrêtée. Reste à savoir ce qui peut mal tourner.

*Classe à éliminer.* Le harnais exige la cohérence avec l’étape 1 — tout actif classé sensible apparaît dans le modèle — et avec le code : chaque route réellement montée est couverte par un élément du schéma. Un modèle qui ignore la moitié de l’application est un modèle qui rassure.

**Étape 4 · Revue de PR, règles et tests** — `capstone/04-review/` · artifact · D5 · D6

Une pull request sensible attend. Et le même défaut existe probablement ailleurs.

*Classe à éliminer.* Trois livrables qui se tiennent : le constat localisé, la règle notée contre des jeux valides et invalides, et le test en double passage. C’est la boucle complète — trouver, généraliser, empêcher le retour.

**Étape 5 · Page de paiement** — `capstone/05-payment/` · artifact · D4 · D7

La page de paiement embarque l’iframe du prestataire, un tag manager et un widget de chat. Le périmètre PCI est censé être réduit.

*Classe à éliminer.* Le harnais vérifie que chaque script chargé figure à l’inventaire avec son propriétaire et son empreinte, que la CSP bloque les charges utiles connues sans casser le paiement, et qu’une modification de script lève une alerte. Exigences 6.4.3 et 11.6.1.

**Étape 6 · Contrôles anti-abus** — `capstone/06-abuse/` · artifact · D4 · D5

L’inscription, la connexion et l’envoi de factures sont ouverts. Un concurrent scrape, un fraudeur teste des identifiants, un spammeur envoie.

*Classe à éliminer.* Le harnais rejoue un flux mêlant clients légitimes, bots et fraudeurs : le score combine abus bloqués et clients gênés. Un contrôle qui bloque tout gagne sur la première moitié et perd sur la seconde — c’est l’arbitrage réel du métier.

**Étape 7 · Pipeline et supply chain** — `capstone/07-pipeline/` · artifact · D7 · D8

Le pipeline publie un SDK npm et déploie en production, avec des permissions larges et des actions non épinglées.

*Classe à éliminer.* Le harnais rejoue les scénarios d’attaque du module : injection de template, pwn request, action repointée, paquet inventé. Chacun doit échouer, et la CI doit continuer de passer sur une contribution légitime.

**Étape 8 · IAM au moindre privilège** — `capstone/08-iam/` · artifact · D1 · D7

Les rôles ont été écrits pendant la mise en production, au plus large, et jamais relus.

*Classe à éliminer.* Le harnais vérifie qu’aucune action d’escalade ne subsiste, que chaque politique d’approbation est filtrée, et que l’application continue de fonctionner — une politique trop stricte casse la production aussi sûrement qu’une trop large la met en danger.

**Étape 9 · Vulnérabilités avancées** — `capstone/09-fixes/` · fix · D5

Les défauts avancés du module M9 sont toujours là : course, cache, analyseurs divergents, jetons.

*Classe à éliminer.* C’est la seule étape purement corrective, et elle est volontairement placée après la conception : on corrige plus vite quand on sait ce qu’on protège. La suite exige, comme toujours, que l’attaque échoue et que la fonctionnalité survive.

**Étape 10 · Cinq détections testées** — `capstone/10-detections/` · artifact · D7

L’application est durcie. Rien ne dit ce qui se passera quand quelqu’un essaiera quand même.

*Classe à éliminer.* Chaque règle est accompagnée de son atomique : avant détonation elle se tait, après elle lève, après retour arrière elle se tait de nouveau. Précision et rappel mesurés sur le corpus. Cinq règles testées valent mieux que cinquante importées.

**Étape 11 · Roadmap à 12 mois** — `capstone/11-roadmap/` · artifact · D2

La revue a produit soixante constats. L’équipe a quatre personnes et un an.

*Classe à éliminer.* Le harnais vérifie la cohérence avec l’évaluation et avec les constats des étapes précédentes : toute classe de bugs trouvée doit être adressée par une activité du plan. Un plan qui ignore ce que la revue vient de trouver n’est pas un plan.

**Étape 12 · Adoption et restitution** — `capstone/12-adoption/` · artifact · D2

Tout est écrit. Rien ne sera appliqué si l’équipe et la direction ne suivent pas.

*Classe à éliminer.* Le harnais vérifie ce qui est vérifiable : les portes existent dans la CI, les SLA sont mesurables, les chemins sensibles sont routés vers les bonnes personnes. La restitution elle-même n’est pas notée — savoir parler à une direction ne s’automatise pas, et c’est le jeu Pushback qui l’entraîne.

</details>

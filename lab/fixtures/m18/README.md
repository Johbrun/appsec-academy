# M18 — corpus et langage de requête du lab

Ce dossier contient tout ce que les challenges de détection font tourner : des
corpus d'événements étiquetés, une bibliothèque de règles, des scénarios
d'attaque, et les catalogues auxquels les livrables doivent se conformer.

---

## Pourquoi un langage maison, et pas KQL, EQL ou ES|QL

Parce que le lab ne peut pas exécuter Elastic — et **une règle qu'on n'exécute
pas ne s'évalue pas**. Elle se relit, ce qui revient à noter de la prose.

Or ce qui s'apprend ici n'est pas la syntaxe d'un produit. La syntaxe s'apprend
en une heure, et elle change tous les dix-huit mois. Ce qui s'apprend, et qui
ne s'apprend nulle part parce qu'il faut un corpus étiqueté pour le pratiquer,
c'est le **réglage précision/rappel** : choisir un axe d'agrégation, une
fenêtre et un seuil qui attrapent l'attaque sans attraper le test de charge.
Ce geste-là se transpose tel quel à Elastic, Splunk, Sentinel ou Sigma.

Le langage du lab tient donc en cinq clés, et s'arrête là volontairement.

---

## Le format des événements

Les corpus sont au format NDJSON — un événement JSON par ligne — dans un
sous-ensemble d'**ECS** (Elastic Common Schema) :

```json
{
  "@timestamp": "2026-03-04T09:12:03.114Z",
  "event": { "id": "cs00412", "kind": "event", "category": ["authentication"],
             "type": ["info"], "action": "authn_login_fail", "outcome": "failure",
             "dataset": "novafact.auth" },
  "user": { "name": "marie.dupont@acme.example" },
  "source": { "ip": "203.0.113.44" },
  "http": { "request": { "method": "POST" }, "response": { "status_code": 401 } },
  "url": { "path": "/api/auth/login" },
  "user_agent": { "original": "Mozilla/5.0 (Windows NT 10.0; Win64) Chrome/133.0 Safari/537.36" },
  "_case": "attaque-04"
}
```

### `_case` : la vérité terrain

Un corpus n'est pas une liste d'événements, c'est une liste de **cas**. Un cas,
c'est un acteur qui se comporte dans le temps : une campagne de bourrage
d'identifiants, un test de charge, une passerelle SSO, un utilisateur qui se
trompe. Chaque événement porte le cas auquel il appartient dans `_case`, et le
fichier `cases.json` dit lesquels sont malveillants :

```json
[ { "id": "attaque-04", "malicious": true,  "label": "l’attaque n°4" },
  { "id": "test-de-charge-1", "malicious": false, "label": "le test de charge" } ]
```

**Le moteur ne voit jamais `_case`.** Les clés de tête `_` sont retirées de
l'événement avant évaluation : la vérité terrain sert au scoreur, pas à la
règle. Écrire `{ field: _case, op: … }` ne trouve rien.

---

## Le langage de requête

Un fichier de règle est un document YAML avec cinq clés, toutes facultatives
sauf qu'il en faut au moins une :

```yaml
id: credential-stuffing        # un nom, pour les messages
window: 10m                    # fenêtre glissante — absente = tout le corpus
where:                         # le filtre, événement par événement
  - { field: event.action, op: eq, value: authn_login_fail }
group_by: [source.ip]          # l'axe d'agrégation
having:                        # la condition sur le groupe dans la fenêtre
  - { metric: count, op: gte, value: 20 }
  - { metric: distinct, field: user.name, op: gte, value: 10 }
```

### `where` — les conditions

Une liste de conditions, toutes vraies en même temps (ET). Chaque condition est
`{ field, op, value }`, où `field` est un chemin pointé (`http.response.status_code`).
Un champ qui vaut un tableau correspond dès qu'un de ses éléments correspond,
ce qui est le cas de `event.category` et `event.type`.

Les groupes logiques s'imbriquent :

```yaml
where:
  - any_of:                    # OU
      - { field: http.response.status_code, op: eq, value: 401 }
      - { field: http.response.status_code, op: eq, value: 403 }
  - none_of:                   # NI … NI …
      - { field: user_agent.original, op: contains, value: healthcheck }
```

`all_of` existe aussi, pour la symétrie.

**Opérateurs :** `eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `in`, `not_in`,
`exists`, `missing`, `contains`, `not_contains`, `starts_with`, `ends_with`,
`matches`, `not_matches` (expression régulière, 200 caractères au plus).

Un champ **absent** ne satisfait aucune comparaison, pas même une négation :
« pas égal à X » sur un champ qui n'existe pas est une question sans objet.
Pour tester l'absence, il y a `missing`.

### `window` — la fenêtre

`30s`, `5m`, `2h`, `1d`. Sans `window`, la fenêtre est le corpus entier — ce
qui est presque toujours une erreur : une passerelle qui produit trente échecs
étalés sur trois heures ressemble alors à une attaque de trois minutes.

### `group_by` — l'axe

Une liste de champs. Les événements qui n'ont pas tous ces champs n'entrent
dans aucun groupe. Changer d'axe est souvent la vraie réponse : le pulvérisage
de mot de passe est invisible par compte et évident par source.

### `having` — la condition d'agrégat

| métrique   | paramètre | ce qu'elle mesure                                     |
|------------|-----------|-------------------------------------------------------|
| `count`    | —         | le nombre d'événements de la fenêtre                  |
| `distinct` | `field`   | le nombre de valeurs distinctes du champ              |
| `sum`      | `field`   | la somme des valeurs numériques du champ              |
| `ratio`    | `where`   | la part des événements de la fenêtre qui correspondent |

```yaml
having:
  - { metric: count, op: gte, value: 20 }
  - { metric: distinct, field: user.name, op: gte, value: 10 }
  - { metric: ratio, where: { field: event.outcome, op: eq, value: success }, op: lte, value: 0.05 }
```

### Comment la règle est évaluée

1. Les événements passent le `where`.
2. **Sans `having`**, chaque événement retenu est une alerte. C'est la règle
   atomique : celle des honeytokens, où un seul accès suffit.
3. **Avec `having`**, les événements retenus sont groupés par `group_by`, puis
   la fenêtre glisse : pour chaque événement du groupe pris comme borne haute,
   on regarde les événements des `window` précédentes. Le groupe lève dès
   qu'une de ces fenêtres satisfait toutes les conditions — une fois, pas mille.

---

## Comment une règle est notée

La note se fait **par cas**, jamais par événement :

- un cas malveillant touché par au moins une alerte est un **vrai positif** ;
- un cas légitime touché par au moins une alerte est un **faux positif** ;
- un cas malveillant qu'aucune alerte ne touche est un **faux négatif**.

`précision = VP / (VP + FP)` — la part des alertes qui méritaient de sonner.
`rappel = VP / (VP + FN)` — la part des attaques qu'on a vues.

Compter ainsi, et non par événement, est ce qui rend la note lisible. « 412
alertes » ne dit rien ; « 9 vrais positifs sur 12, et 3 faux positifs — la règle
attrape le test de charge » indique la modification suivante.

---

## Ce qui est refusé

Une règle qui **désigne** ce qu'elle devrait décrire n'apprend rien. Deux
garde-fous :

1. **Champs interdits en filtre** : `event.id`, `_case`, `labels`, `@timestamp`
   et leurs variantes. L'horodatage est interdit parce qu'il permet de découper
   l'attaque à la minute près, ce qui est du codage en dur déguisé.
2. **Valeurs interdites** : toute chaîne littérale qui coïncide avec un
   identifiant d'événement ou de cas du corpus fait rejeter la règle.

Et surtout : les règles notées sont rejouées sur un **second corpus**, tiré des
mêmes générateurs avec une autre graine (`cs-holdout/`, `spray-holdout/`). Les
adresses, les comptes et les horaires y sont différents. Une règle qui énumère
les douze adresses du premier corpus n'y trouve rien.

---

## Les corpus

| dossier | ce qu'il contient |
|---|---|
| `cs/`, `cs-holdout/` | bourrage d'identifiants : 12 attaques, 40 leurres |
| `cs-hard/` | le même, plus 3 attaques discrètes et un test d'intrusion autorisé — la séparation parfaite n'existe pas |
| `spray/`, `spray-holdout/` | pulvérisage de mot de passe : 6 campagnes, 33 leurres |
| `graduated/` | sessions à classer par palier de réponse, avec les paliers attendus |
| `redaction/` | corpus portant des secrets en clair, plus la règle qui doit continuer à lever |
| `ecs-fields/` | le même trafic, émis avec les mauvais noms de champs, plus la règle fournie |
| `ecs-lint/` | 24 lignes dont 9 fautives |
| `inventory/` | ce que la suite de bout en bout fait réellement émettre |
| `assistant/` | appels d'outils de l'assistant, avec l'origine de l'instruction |
| `honeytoken/` | accès aux leurres et leurs quasi-jumeaux légitimes |
| `appsensor/` | six trafics hostiles, un pour chaque point de détection, et le parcours légitime |
| `silent-before/`, `silent-after/` | le même trafic avant et après le correctif d'autorisation |
| `incident/` | 914 lignes, un incident de 14 événements dedans |
| `rules/` | la bibliothèque de douze règles, dont cinq portent un défaut de métadonnée |
| `coverage/` | huit scénarios d'attaque et le catalogue ATT&CK réduit |
| `vocabulary/` | huit scénarios en texte libre, et le vocabulaire d'OWASP |
| `atomic/` | l'état initial de l'environnement simulé, et la règle que l'atomique doit faire lever |
| `appsensor/catalogue.yaml` | l'extrait du catalogue de points de détection d'AppSensor |

## Régénérer

```bash
node --import tsx fixtures/m18/_gen/generate.mjs
```

Le tirage est déterministe : relancer le générateur reproduit les fixtures à
l'octet près. Il réécrit aussi les deux corrigés de référence qui en dérivent
(la bibliothèque de règles réparée et le corpus ECS corrigé), pour que la
correction et la fixture ne puissent pas diverger. Il imprime enfin la vérité
terrain de l'incident, qui vit dans `server/audit/m18.ts` — pas ici, pour que
la réponse ne soit pas à côté de la question.

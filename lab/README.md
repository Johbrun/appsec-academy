# Novafact Lab

> ⚠ **Application volontairement vulnérable.** Elle accompagne AppSec Academy comme support d'exercices.
> Données fictives, en mémoire, boucle locale. **Ne jamais l'exposer sur un réseau, ne jamais y mettre de
> données réelles, ne jamais réutiliser ce code** : il est faux exprès.

C'est **Novafact**, l'application fil rouge du programme, rendue exécutable — et défectueuse. Même stack que
le site : Vite + React + TypeScript, avec une API Express. 17 exercices répartis sur cinq modules du
programme.

## Lancer

```bash
npm install
npm run dev      # API sur 127.0.0.1:4317 + interface sur 127.0.0.1:5199
```

Aucune base de données à installer : tout vit en mémoire et repart à zéro au redémarrage. Un faux service de
métadonnées d'instance tourne sur `127.0.0.1:4318` pour que l'exercice SSRF ait une cible réaliste **sans que
rien ne sorte de la machine**.

Compte de départ : `dev@acme.example` / `dev`.

## Comment fonctionne un exercice

Chaque exercice se déroule en deux temps, et c'est le second qui compte.

**1. Exploiter.** L'objectif est formulé comme une violation d'invariant observable (« lire une facture d'un
autre tenant », « créer une facture au total négatif »). Le serveur constate lui-même la violation, au point
exact où elle se produit, et délivre le drapeau. Rien ne repose sur une déclaration de l'apprenant. Des indices
progressifs sont disponibles dans la page **Exercices**, le dernier donnant la marche à suivre.

**1 bis. Ou auditer, pour les challenges « fix ».** Le défaut vit alors dans le dépôt fixture `novafact/` —
un workflow, un `.npmrc`, un lockfile. Il n'y a rien à exploiter : on corrige le fichier, puis on relance
l'audit depuis la page du challenge (ou par `POST /api/lab/audit`). Le drapeau récompense la correction.

**2. Corriger, et le prouver.**

```bash
npm run verify
```

Une suite de tests de régression qui, pour chaque exercice, exige **deux** choses :

- le contrôle **refuse** l'attaque ;
- le cas légitime **marche encore**.

Sur le code livré, les 17 suites échouent — c'est leur rôle. Un correctif qui casse la fonctionnalité fait
échouer le test aussi sûrement qu'un correctif absent. C'est l'exercice K12 de Kohnfelder et le cœur du module
M13 : un test qui vérifie qu'un contrôle refuse, pas seulement qu'il accepte.

Deux exercices vivent dans le navigateur (XSS stockée, script tiers) : aucune requête ne peut les constater
depuis les tests, ils sont donc vérifiés sur le code source, comme le ferait une règle Semgrep.

## Les exercices

Les 238 challenges jouables, avec leur objectif et les leçons du site qui les traitent :
**[CHALLENGES.md](CHALLENGES.md)**. Les 57 challenges spécifiés mais pas encore implémentés :
**[ROADMAP.md](ROADMAP.md)**.

Les 238 jouables, par nature :

| Nature | Combien | Ce que tu fais |
| --- | --- | --- |
| **exploit** | 122 | Tu attaques l'application qui tourne ; le serveur constate la violation d'invariant |
| **fix** ⚙ | 57 | Tu corriges un fichier du dépôt fixture `novafact/` ; une vérification le relit |
| **artifact** ✎ | 59 | Tu écris un livrable dans `workspace/` ; le harnais le juge |

Seize des vingt modules du parcours ont des challenges jouables. M7 et M20 ont leurs vérifications
écrites mais pas encore leur registre : ils restent dans la feuille de route.

La feuille de route couvre les 20 modules du parcours : **158 des 162 leçons** y sont rattachées à au moins un
challenge. Les quatre restantes ne le sont pas et ne le seront pas — la raison est écrite pour chacune dans
CHALLENGES.md.

Trois familles : **exploit** (une requête, le serveur constate), **fix** ⚙ (le défaut est dans un workflow, un
Terraform, un Dockerfile ou une politique IAM) et **artifact** ✎ (on produit une règle, un test, un document VEX
ou un modèle de menaces, et c'est lui qui est jugé). Chacun porte ses étiquettes **CSSLP** (D1–D8) et, le cas
échéant, son chapitre **Kohnfelder**, comme les leçons du site.

Les deux fichiers sont générés depuis `shared/exercises.ts` et `shared/planned/` :

```bash
npm run challenges
```

`npm run verify` échoue si l'un des deux fichiers ne correspond plus au registre, et si un titre de leçon
recopié a divergé du catalogue du site.

## Organisation

```
shared/exercises.ts     Le registre : objectif, indices, fichier fautif, correctif attendu.
                        Source de vérité partagée par l'API, l'interface et les tests.
server/                 L'API Express vulnérable. Chaque défaut est commenté « VULNÉRABLE (id) »
                        et suivi du correctif attendu.
  safety.ts             Garde-fous de démarrage : refuse NODE_ENV=production, refuse d'écouter
                        hors boucle locale sans LAB_ALLOW_NETWORK=1.
  imds.ts               Faux service de métadonnées, local et inerte.
  routes/lab.ts         L'échafaudage pédagogique. Pas vulnérable, ne pas y chercher de défaut.
src/                    L'interface React : l'application Novafact + la console du lab.
verify/                 Les tests de régression.
CHALLENGES.md           Les challenges jouables, générés, reliés aux leçons du site.
ROADMAP.md              Les challenges spécifiés, générés eux aussi.
novafact/               Le dépôt fixture : workflows, .npmrc, lockfile, CODEOWNERS — tous
                        volontairement défectueux. Support des challenges « fix » de M14.
server/audit/           Les vérifications de ces challenges. Une vérification porte sur la
                        PROPRIÉTÉ, jamais sur la forme du correctif : plusieurs façons de
                        corriger doivent passer, une reformulation qui ne corrige rien non.
solutions/              Le corrigé de référence : les mêmes fichiers, corrigés, aux mêmes chemins.
                        À consulter après avoir essayé.
```

Les fichiers de `solutions/` sont des remplacements directs. Pour comparer sans tout écraser :

```bash
diff -u server/routes/invoices.ts solutions/server/routes/invoices.ts
```

## Garde-fous

- Refuse de démarrer si `NODE_ENV=production`.
- Écoute sur `127.0.0.1` ; sortir de la boucle locale exige `LAB_ALLOW_NETWORK=1` et affiche un avertissement
  nommant les interfaces exposées.
- Aucune donnée persistée, aucun appel sortant réel, aucun identifiant valide nulle part.
- Bandeau d'avertissement permanent dans l'interface et à chaque démarrage du serveur.

## Ce que le lab ne remplace pas

Il ne se substitue pas aux labs reconnus de la page **Labs** du site (PortSwigger, Juice Shop, CI/CD Goat,
flAWS, CloudGoat…), qui restent la pratique principale du programme. Il couvre ce qu'ils couvrent mal pour ce
parcours précis : **la correction dans du code Express/React qu'on possède**, avec le test de régression qui
prouve que la classe de bugs a disparu.

Hors périmètre, faute de pouvoir les reproduire fidèlement en local : request smuggling (il faut une vraie
chaîne de proxys), IAM AWS, IaC et détection Elastic — les modules M14 à M18 continuent de s'appuyer sur
CloudGoat, TerraGoat et Stratus Red Team.

---

Contenu pédagogique non officiel. OWASP, MITRE ATT&CK®, CSSLP® (ISC2) et Burp Suite (PortSwigger) sont des
marques de leurs détenteurs respectifs.

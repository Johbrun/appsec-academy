# ADS — Bourrage d'identifiants depuis une source unique

Fiche de stratégie de détection (*Alerting and Detection Strategy*) de la règle
`credential-stuffing`. Rédigée pour l'analyste qui reçoit l'alerte à trois
heures du matin, pas pour l'auditeur.

## Objectif

Détecter une campagne de bourrage d'identifiants : un attaquant rejoue une
liste de couples identifiant/mot de passe issue d'une fuite tierce contre le
formulaire de connexion de Novafact, en espérant que des clients aient réutilisé
leur mot de passe. On veut l'attraper avant la première prise de compte, ou à
défaut dans les minutes qui suivent.

## Catégorisation

MITRE ATT&CK — T1110.004 (Credential Stuffing), sous-technique de T1110
(Brute Force), tactique *Credential Access*. Côté OWASP, il s'agit de OAT-008
(Credential Stuffing) dans la taxonomie des menaces automatisées.

## Résumé de la stratégie

La règle regroupe les échecs d'authentification par adresse source sur une
fenêtre glissante de dix minutes, et lève quand une même source dépasse vingt
échecs répartis sur au moins dix comptes distincts. Le second critère est
l'essentiel : c'est lui qui distingue une campagne d'un client qui se trompe,
et c'est lui qui écarte les tests de charge et les applications mobiles
bloquées sur un jeton périmé, qui martèlent un seul compte.

## Contexte technique

La source est `novafact.auth`, alimentée par le middleware d'authentification
de l'API. Les champs nécessaires sont `event.action`, `source.ip`, `user.name`
et `@timestamp` ; ils sont garantis par l'inventaire de journalisation du
programme. L'adresse source vient de l'en-tête normalisé par le répartiteur de
charge, pas de la connexion TCP directe.

## Angles morts et hypothèses

La règle suppose que l'attaquant reste sur un petit nombre d'adresses. Une
campagne distribuée sur un réseau résidentiel de plusieurs milliers d'adresses
la contourne entièrement : un échec par adresse ne franchit aucun seuil. C'est
le cas que couvre `password-spray` côté compte, et qui justifie une détection
par empreinte de client plutôt que par adresse. Second angle mort : une
campagne très lente, étalée sur plusieurs heures, sort de la fenêtre.

## Faux positifs attendus

Un test d'intrusion autorisé produit exactement la même trace et lèvera —
c'est voulu : on préfère le faux positif au trou. Tenir à jour la fenêtre de
test convenue avec le client permet de le fermer en une minute. Une passerelle
SSO en panne d'annuaire peut aussi produire un pic d'échecs sur des comptes
distincts ; le taux de succès sur les minutes précédentes permet de trancher.

## Validation

Recette exécutée par le harnais contre le corpus étiqueté du lab
(`fixtures/m18/cs/`), qui contient douze campagnes et quarante leurres :

```yaml
id: credential-stuffing
window: 10m
where:
  - { field: event.action, op: eq, value: authn_login_fail }
group_by: [source.ip]
having:
  - { metric: count, op: gte, value: 20 }
  - { metric: distinct, field: user.name, op: gte, value: 10 }
```

La règle doit lever sur les douze campagnes et sur aucun leurre. En production,
la même validation se rejoue avec l'atomique `detections/atomics/credential-stuffing.yaml`.

## Priorité

Haute (score de risque 73). Une campagne réussie mène directement à une prise
de compte, et le compte comptable de Novafact donne accès aux factures et aux
coordonnées bancaires des clients du tenant.

## Réponse

1. Confronter l'adresse source aux listes de proxys et de sorties Tor connues.
2. Lister les comptes visés et chercher un `authn_login_success` dans la même
   fenêtre : c'est la question qui décide de la gravité.
3. Pour tout compte pris : révoquer les sessions, forcer la réinitialisation,
   prévenir le tenant.
4. Appliquer la réponse graduée (`detections/response-policy.yaml`) plutôt
   qu'un blocage sec, pour ne pas couper un bureau partagé.

## Ressources complémentaires

OWASP Automated Threats to Web Applications (OAT-008), NIST SP 800-63B §5.2.2,
et la liste Pwned Passwords pour la remédiation côté produit.

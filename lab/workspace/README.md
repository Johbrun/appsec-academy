# Ton espace de travail

C'est ici que tu écris les **livrables** des challenges de type *artifact* ✎ :
une règle de lint, un test de régression, un document VEX, un modèle de
menaces, un fichier de triage.

Le chemin attendu est donné par chaque challenge — par exemple
`vulns/novafact.openvex.json` signifie `workspace/vulns/novafact.openvex.json`.

Quand tu as écrit ton fichier, relance l'audit depuis la page du challenge, ou :

```bash
curl -XPOST http://127.0.0.1:4317/api/lab/audit/<id-du-challenge>
```

## Ce qui est jugé, et ce qui ne l'est pas

Le harnais juge ce qui est **décidable** : la conformité à un schéma, un calcul
refait, une décision retrouvée dans une table publiée, la cohérence avec le
code du dépôt. Il ne juge **pas** la prose, ni la pertinence d'un arbitrage, ni
la perspicacité d'un modèle de menaces — passer un test ne veut pas dire « bon
travail », ça veut dire « rien d'incohérent détecté ».

Chaque énoncé dit explicitement où s'arrête la vérification. Quand un sujet
résiste entièrement à l'automatisation, il n'y a pas de challenge : il est
traité par les jeux du site.

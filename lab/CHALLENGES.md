# Challenges du Novafact Lab

> Généré depuis `shared/exercises.ts` par `npm run challenges` — ne pas éditer à la main.
>
> ⚠ **Application volontairement vulnérable.** Boucle locale, données fictives. Voir [README.md](README.md).

**246 challenges jouables**, et **49 spécifiés** dans la
[feuille de route](ROADMAP.md). Chaque leçon renvoie au site lancé en local
(`npm run dev` à la racine du site, http://127.0.0.1:5173) et à sa source `.mdx` pour une lecture hors ligne.

Trois familles de challenges :

- **exploit** — on atteint l’objectif par des requêtes, et le serveur constate lui-même la violation d’invariant ;
- **fix** ⚙ — le défaut est dans un artefact du dépôt (workflow, Terraform, Dockerfile, politique IAM). Il n’y a
  rien à exploiter depuis le navigateur : on l’audite et on le corrige, et c’est la correction qui est vérifiée ;
- **artifact** ✎ — on **produit** un fichier (une règle, un test, un document VEX, un modèle de menaces) et c’est
  ce fichier qui est jugé. C’est ce qui rend praticables les domaines qui résistent autrement.

Deux motifs de correction tiennent ces challenges, et aucun autre n’est aussi solide. Le **double passage** :
l’artefact doit échouer contre le code vulnérable et passer contre `solutions/` — un test qui passe partout ne
prouve rien, un test qui échoue partout casse la fonctionnalité. Et le **différentiel valide/invalide** : ce qui
est écrit est exécuté contre des jeux que le harnais détient, ce qui interdit de coder le résultat en dur.

Un challenge jouable se valide quand **le serveur constate lui-même** la violation. Vient ensuite le vrai
travail : corriger, puis `npm run verify`, qui exige que l’attaque échoue **et** que la fonctionnalité légitime
marche encore. Le corrigé est dans [SOLUTIONS.md](SOLUTIONS.md).

## Les challenges jouables

| # | Challenge | Mod. | Niv. | CWE | CSSLP | Leçon de référence |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | [Injection NoSQL dans la connexion](#nosql-auth) | M2 | N1 | CWE-943 | D5 | [Entrées non fiables dans Express](http://127.0.0.1:5173/#/modules/m02/l01) |
| 2 | [Mass assignment sur le profil](#mass-assignment) | M2 | N1 | CWE-915 | D5 | [Entrées non fiables dans Express](http://127.0.0.1:5173/#/modules/m02/l01) |
| 3 | [BOLA : la facture du voisin](#bola-invoice) | M2 | N1 | CWE-639 | D5 | [Entrées non fiables dans Express](http://127.0.0.1:5173/#/modules/m02/l01) |
| 4 | [Prototype pollution côté serveur](#proto-pollution) | M2 | N2 | CWE-1321 | D5 | [Spécificités Node.js](http://127.0.0.1:5173/#/modules/m02/l03) |
| 5 | [Arithmétique de l’argent](#money-float) | M2 | N1 | CWE-681 | D5 | [Footguns JavaScript et argent](http://127.0.0.1:5173/#/modules/m02/l02) |
| 6 | [ReDoS sur la référence de facture](#redos) | M2 | N2 | CWE-1333 | D5 | [Spécificités Node.js](http://127.0.0.1:5173/#/modules/m02/l03) |
| 7 | [Traversée de chemin sur les pièces jointes](#path-traversal) | M2 | N2 | CWE-22 | D5 | [Spécificités Node.js](http://127.0.0.1:5173/#/modules/m02/l03) |
| 8 | [SSRF vers le service de métadonnées](#ssrf-imds) | M2 | N2 | CWE-918 | D5, D7 | [Spécificités Node.js](http://127.0.0.1:5173/#/modules/m02/l03) |
| 9 | [Race condition : l’avoir dépensé deux fois](#race-credit) | M3 | N2 | CWE-362 | D5 | [Race conditions](http://127.0.0.1:5173/#/modules/m03/l01) |
| 10 | [Empoisonnement du lien de réinitialisation](#host-header) | M3 | N2 | CWE-640 | D5 | [En-tête Host](http://127.0.0.1:5173/#/modules/m03/l02) |
| 11 | [JWT : décoder n’est pas vérifier](#jwt-decode) | M3 | N2 | CWE-347 | D1, D5 | [Valider un JWT dans Express](http://127.0.0.1:5173/#/modules/m09/l05) |
| 12 | [Empoisonnement du cache par une entrée hors clé](#cache-poison) | M3 | N3 | CWE-444 | D5, D7 | [Cache poisoning et cache deception](http://127.0.0.1:5173/#/modules/m03/l06) |
| 13 | [XSS stockée dans la note de facture](#dom-xss) | M4 | N1 | CWE-79 | D5 | [React et le navigateur](http://127.0.0.1:5173/#/modules/m04/l02) |
| 14 | [Script tiers piloté par la configuration](#third-party-script) | M4 | N2 | CWE-829 | D4, D8 | [Scripts tiers](http://127.0.0.1:5173/#/modules/m04/l03) |
| 15 | [Credential stuffing sans limite](#no-rate-limit) | M10 | N1 | CWE-307 | D5 | [Credential stuffing et prise de contrôle](http://127.0.0.1:5173/#/modules/m10/l02) |
| 16 | [Invariant métier : rouvrir une facture payée](#invoice-state) | M10 | N2 | CWE-840 | D4, D5 | [Invariants métier](http://127.0.0.1:5173/#/modules/m10/l06) |
| 17 | [Injection indirecte dans « Ask Novafact »](#prompt-injection) | M19 | N2 | CWE-1427 | D4 | [Prompt injection et règle de deux](http://127.0.0.1:5173/#/modules/m19/l02) |
| 18 | [La fausse observation](#synthetic-observation) | M19 | N2 | CWE-1427 | D4 | [Prompt injection et règle de deux](http://127.0.0.1:5173/#/modules/m19/l02) |
| 19 | [L’outil de débogage branché sur l’assistant](#excessive-agency-tool) | M19 | N2 | CWE-250 | D4, D5 | [Agents et MCP : vue d’ensemble](http://127.0.0.1:5173/#/modules/m30/l01) |
| 20 | [L’action qui porte l’identité de la victime](#indirect-victim-session) | M19 | N2 | CWE-1427 | D4 | [Prompt injection et règle de deux](http://127.0.0.1:5173/#/modules/m19/l02) |
| 21 | [L’image qui part toute seule](#markdown-image-exfil) | M19 | N2 | CWE-200 | D4, D5 | [Applications JS avec LLM](http://127.0.0.1:5173/#/modules/m19/l04) |
| 22 | [Le filtre de liens et la forme référence](#reference-link-bypass) | M19 | N3 | CWE-200 | D4, D5 | [Applications JS avec LLM](http://127.0.0.1:5173/#/modules/m19/l04) |
| 23 | [L’outil « sûr » comme canal](#dns-exfil-tool) | M19 | N3 | CWE-200 | D4, D7 | [Agents et MCP : vue d’ensemble](http://127.0.0.1:5173/#/modules/m30/l01) |
| 24 | [Le produit lui-même comme canal](#product-as-channel) | M30 | N3 | CWE-200 | D4 | [Agents et MCP : vue d’ensemble](http://127.0.0.1:5173/#/modules/m30/l01) |
| 25 | [La défense cassée par son propre délimiteur](#spotlighting-bypass) | M19 | N3 | CWE-1427 | D4 | [Patterns de conception pour agents](http://127.0.0.1:5173/#/modules/m19/l03) |
| 26 | [L’empoisonnement de description d’outil](#tool-poisoning-mcp) | M30 | N2 | CWE-1427 | D4, D8 | [Agents et MCP : vue d’ensemble](http://127.0.0.1:5173/#/modules/m30/l01) |
| 27 | [Le rug pull](#rug-pull-mcp) | M30 | N3 | CWE-494 | D4, D8 | [Agents et MCP : vue d’ensemble](http://127.0.0.1:5173/#/modules/m30/l01) |
| 28 | [Le tool shadowing](#tool-shadowing) | M30 | N3 | CWE-1427 | D4, D8 | [Agents et MCP : vue d’ensemble](http://127.0.0.1:5173/#/modules/m30/l01) |
| 29 | [Nuire avant le premier appel](#line-jumping) | M30 | N3 | CWE-1427 | D4, D8 | [Agents et MCP : vue d’ensemble](http://127.0.0.1:5173/#/modules/m30/l01) |
| 30 | [Combien de documents pour retourner une réponse](#poisoned-rag) | M19 | N2 | CWE-1427 | D4 | [Applications JS avec LLM](http://127.0.0.1:5173/#/modules/m19/l04) |
| 31 | [RAG sans contrôle d’accès](#rag-acl) | M19 | N2 | CWE-285 | D4, D5 | [Applications JS avec LLM](http://127.0.0.1:5173/#/modules/m19/l04) |
| 32 | [L’index survit à la suppression](#index-after-deletion) | M19 | N2 | CWE-212 | D3, D4 | [Applications JS avec LLM](http://127.0.0.1:5173/#/modules/m19/l04) |
| 33 | [La citation qui ment](#citation-laundering) | M19 | N3 | CWE-345 | D4 | [Applications JS avec LLM](http://127.0.0.1:5173/#/modules/m19/l04) |
| 34 | [Le canari du prompt système](#system-prompt-canary) | M19 | N1 | CWE-200 | D4 | [OWASP LLM Top 10 2026](http://127.0.0.1:5173/#/modules/m19/l01) |
| 35 | [La fuite d’une session à l’autre](#cross-session-leak) | M19 | N2 | CWE-524 | D4, D5 | [Applications JS avec LLM](http://127.0.0.1:5173/#/modules/m19/l04) |
| 36 | [La mémoire à effet différé](#memory-poisoning) | M19 | N3 | CWE-1427 | D4 | [Prompt injection et règle de deux](http://127.0.0.1:5173/#/modules/m19/l02) |
| 37 | [La boucle sous le radar du quota](#tool-loop-quota) | M19 | N2 | CWE-770 | D4, D7 | [OWASP LLM Top 10 2026](http://127.0.0.1:5173/#/modules/m19/l01) |
| 38 | [Consommation illimitée](#unbounded-consumption) | M19 | N2 | CWE-770 | D4, D7 | [OWASP LLM Top 10 2026](http://127.0.0.1:5173/#/modules/m19/l01) |
| 39 | [Le décodeur obéissant](#encoded-bypass) | M19 | N2 | CWE-176 | D4 | [Red teaming des LLM](http://127.0.0.1:5173/#/modules/m19/l06) |
| 40 | [L’approbation humaine trompée](#human-approval-spoof) | M19 | N3 | CWE-451 | D4 | [Patterns de conception pour agents](http://127.0.0.1:5173/#/modules/m19/l03) |
| 41 | [Sortie du modèle rendue en HTML](#llm-markdown-xss) | M19 | N2 | CWE-79 | D4, D5 | [Applications JS avec LLM](http://127.0.0.1:5173/#/modules/m19/l04) |
| 42 | [SSRF par un outil de l’agent](#llm-tool-ssrf) | M19 | N2 | CWE-918 | D4, D5 | [Applications JS avec LLM](http://127.0.0.1:5173/#/modules/m19/l04) |
| 43 | [Le paquet qui n’existe pas](#package-hallucination) | M19 | N2 | CWE-1104 | D5, D8 | [L’IA dans le SDLC](http://127.0.0.1:5173/#/modules/m19/l07) |
| 44 | [Le bot de revue qui approuve](#ai-review-bot-approve) | M19 | N2 | CWE-1427 | D5, D8 | [L’IA dans le SDLC](http://127.0.0.1:5173/#/modules/m19/l07) |
| 45 | [Le secret de CI dans un titre de PR](#ci-secret-in-pr-title) | M19 | N3 | CWE-1427 | D7, D8 | [L’IA dans le SDLC](http://127.0.0.1:5173/#/modules/m19/l07) |
| 46 | [Exfiltrer sans se faire remarquer](#stealth-attack) | M19 | N3 | CWE-1427 | D4, D7 | [Red teaming des LLM](http://127.0.0.1:5173/#/modules/m19/l06) |
| 47 | [BFLA : la méthode oubliée](#bfla-method) | M2 | N1 | CWE-285 | D5 | [Entrées non fiables dans Express](http://127.0.0.1:5173/#/modules/m02/l01) |
| 48 | [BOLA sur un identifiant imbriqué](#bola-nested) | M2 | N2 | CWE-639 | D5 | [Entrées non fiables dans Express](http://127.0.0.1:5173/#/modules/m02/l01) |
| 49 | [Erreur non gérée et état incohérent](#error-leak) | M2 | N2 | CWE-209 | D5 | [Erreurs, exceptions et atomicité](http://127.0.0.1:5173/#/modules/m02/l04) |
| 50 | [Au-delà de 2^53](#max-safe-integer) | M2 | N2 | CWE-190 | D5 | [Footguns JavaScript et argent](http://127.0.0.1:5173/#/modules/m02/l02) |
| 51 | [Number() permissif sur les montants](#number-coercion) | M2 | N1 | CWE-1287 | D5 | [Footguns JavaScript et argent](http://127.0.0.1:5173/#/modules/m02/l02) |
| 52 | [Fuite par l’ORM sur un filtre](#orm-leak) | M3 | N3 | CWE-200 | D5 | [Parser differentials et fuites via l’ORM](http://127.0.0.1:5173/#/modules/m03/l07) |
| 53 | [Confusion de type sur la query string](#qs-type-confusion) | M3 | N2 | CWE-843 | D5 | [Parser differentials et fuites via l’ORM](http://127.0.0.1:5173/#/modules/m03/l07) |
| 54 | [Course entre paiement et annulation](#race-multi-endpoint) | M3 | N2 | CWE-362 | D5 | [Race conditions](http://127.0.0.1:5173/#/modules/m03/l01) |
| 55 | [Envoi de factures détourné](#send-quota) | M10 | N2 | CWE-770 | D3, D4 | [Abus de fonctionnalités](http://127.0.0.1:5173/#/modules/m10/l05) |
| 56 | [Jeton d’accès passé dans l’URL](#token-in-url) | M9 | N1 | CWE-598 | D5, D7 | [SPA : RFC 10017 et BFF](http://127.0.0.1:5173/#/modules/m09/l04) |
| 57 | [Réponse authentifiée mise en cache](#vary-missing) | M3 | N2 | CWE-524 | D5, D7 | [Cache poisoning et cache deception](http://127.0.0.1:5173/#/modules/m03/l06) |
| 58 | [Autorisation sur une seule étape du flux](#multistep-authz) | M2 | N2 | CWE-841 | D5 | [Entrées non fiables dans Express](http://127.0.0.1:5173/#/modules/m02/l01) |
| 59 | [Endpoint à double usage mal isolé](#dual-use-endpoint) | M2 | N2 | CWE-284 | D5 | [Entrées non fiables dans Express](http://127.0.0.1:5173/#/modules/m02/l01) |
| 60 | [eval dans le calcul des pénalités](#eval-formula) | M2 | N2 | CWE-95 | D5 | [Spécificités Node.js](http://127.0.0.1:5173/#/modules/m02/l03) |
| 61 | [node:vm n’est pas un bac à sable](#vm-escape) | M2 | N3 | CWE-265 | D5 | [Spécificités Node.js](http://127.0.0.1:5173/#/modules/m02/l03) |
| 62 | [Pièce jointe servie sur l’origine de l’application](#attachment-same-origin) | M4 | N2 | CWE-79 | D4, D5 | [Isolation d’origine](http://127.0.0.1:5173/#/modules/m04/l07) |
| 63 | [Logo SVG exécutable](#svg-logo) | M4 | N2 | CWE-79 | D4, D5 | [Trusted Types et Sanitizer API](http://127.0.0.1:5173/#/modules/m04/l06) |
| 64 | [TOCTOU sur le téléversement](#toctou-upload) | M3 | N2 | CWE-367 | D5 | [Race conditions](http://127.0.0.1:5173/#/modules/m03/l01) |
| 65 | [Pipeline d’upload non isolé](#upload-pipeline) | M8 | N2 | CWE-434 | D4, D5 | [Patterns d’architecture](http://127.0.0.1:5173/#/modules/m08/l05) |
| 66 | [Cache deception sur le PDF de facture](#cache-deception-pdf) | M3 | N3 | CWE-525 | D5, D7 | [Cache poisoning et cache deception](http://127.0.0.1:5173/#/modules/m03/l06) |
| 67 | [Injection de commande dans l’export](#cmd-injection) | M2 | N2 | CWE-78 | D5 | [Spécificités Node.js](http://127.0.0.1:5173/#/modules/m02/l03) |
| 68 | [Injection de formule dans l’export CSV](#csv-formula-injection) | M2 | N1 | CWE-1236 | D5 | [Entrées non fiables dans Express](http://127.0.0.1:5173/#/modules/m02/l01) |
| 69 | [SSRF par le générateur de PDF](#ssrf-pdf-renderer) | M3 | N3 | CWE-918 | D5 | [SSRF avancée](http://127.0.0.1:5173/#/modules/m03/l11) |
| 70 | [SSTI par les options de rendu](#ssti-render-options) | M3 | N3 | CWE-94 | D5 | [SSTI et injection de code](http://127.0.0.1:5173/#/modules/m03/l08) |
| 71 | [Expansion d’entités sur le même import](#xml-entity-expansion) | M2 | N2 | CWE-776 | D5, D6 | [Entrées non fiables dans Express](http://127.0.0.1:5173/#/modules/m02/l01) |
| 72 | [XXE à l’import de facture électronique](#xxe-import) | M2 | N2 | CWE-611 | D5 | [Entrées non fiables dans Express](http://127.0.0.1:5173/#/modules/m02/l01) |
| 73 | [Zip Slip à l’import d’un lot de factures](#zip-slip) | M2 | N2 | CWE-22 | D5 | [Spécificités Node.js](http://127.0.0.1:5173/#/modules/m02/l03) |
| 74 | [Clés JSON dupliquées](#json-duplicate-keys) | M2 | N2 | CWE-436 | D5 | [Entrées non fiables dans Express](http://127.0.0.1:5173/#/modules/m02/l01) |
| 75 | [Désérialisation de types arbitraires](#deserialization) | M3 | N3 | CWE-502 | D5 | [Désérialisation et prototype pollution avancées](http://127.0.0.1:5173/#/modules/m03/l09) |
| 76 | [SSTI dans le gabarit de relance](#ssti-email-template) | M3 | N3 | CWE-1336 | D5 | [SSTI et injection de code](http://127.0.0.1:5173/#/modules/m03/l08) |
| 77 | [Pollution de paramètres côté serveur](#param-pollution) | M3 | N2 | CWE-235 | D5 | [API avancée et GraphQL](http://127.0.0.1:5173/#/modules/m03/l03) |
| 78 | [Contrôle d’accès par préfixe d’URL](#url-prefix-authz) | M2 | N2 | CWE-289 | D5 | [Entrées non fiables dans Express](http://127.0.0.1:5173/#/modules/m02/l01) |
| 79 | [Confusion de Content-Type sur une mutation](#content-type-confusion) | M3 | N2 | CWE-352 | D5 | [Parser differentials et fuites via l’ORM](http://127.0.0.1:5173/#/modules/m03/l07) |
| 80 | [GraphQL : introspection et coût](#graphql-introspection) | M3 | N2 | CWE-200 | D5 | [API avancée et GraphQL](http://127.0.0.1:5173/#/modules/m03/l03) |
| 81 | [GraphQL : reconstruire le schéma sans introspection](#graphql-clairvoyance) | M3 | N3 | CWE-209 | D5 | [API avancée et GraphQL](http://127.0.0.1:5173/#/modules/m03/l03) |
| 82 | [CSRF sur le point d’accès GraphQL](#graphql-csrf) | M3 | N2 | CWE-352 | D5 | [API avancée et GraphQL](http://127.0.0.1:5173/#/modules/m03/l03) |
| 83 | [SSRF par redirection](#ssrf-redirect-bypass) | M3 | N3 | CWE-918 | D5, D7 | [SSRF avancée](http://127.0.0.1:5173/#/modules/m03/l11) |
| 84 | [GraphQL : force brute par alias](#graphql-batching) | M3 | N2 | CWE-307 | D5 | [API avancée et GraphQL](http://127.0.0.1:5173/#/modules/m03/l03) |
| 85 | [URL javascript: rendue par React](#react-javascript-url) | M4 | N1 | CWE-79 | D5 | [Trusted Types et Sanitizer API](http://127.0.0.1:5173/#/modules/m04/l06) |
| 86 | [Pollution de prototype côté client](#client-proto-pollution) | M4 | N3 | CWE-1321 | D5 | [Trusted Types et Sanitizer API](http://127.0.0.1:5173/#/modules/m04/l06) |
| 87 | [DOM clobbering sur la configuration](#dom-clobbering) | M4 | N3 | CWE-1321 | D5 | [Trusted Types et Sanitizer API](http://127.0.0.1:5173/#/modules/m04/l06) |
| 88 | [postMessage sans contrôle d’origine](#postmessage-origin) | M4 | N2 | CWE-346 | D4, D5 | [Isolation d’origine](http://127.0.0.1:5173/#/modules/m04/l07) |
| 89 | [Fuite par l’en-tête Referer](#referrer-leak) | M4 | N1 | CWE-200 | D5 | [Isolation d’origine](http://127.0.0.1:5173/#/modules/m04/l07) |
| 90 | [Nonce de CSP réutilisé](#csp-nonce-reuse) | M4 | N2 | CWE-330 | D5 | [CSP stricte en pratique](http://127.0.0.1:5173/#/modules/m04/l05) |
| 91 | [Gadget dans une origine autorisée](#csp-gadget) | M4 | N3 | CWE-693 | D5 | [CSP stricte en pratique](http://127.0.0.1:5173/#/modules/m04/l05) |
| 92 | [Trusted Types en trompe-l’œil](#trusted-types-default) | M4 | N3 | CWE-693 | D5 | [Trusted Types et Sanitizer API](http://127.0.0.1:5173/#/modules/m04/l06) |
| 93 | [Clickjacking sur les coordonnées bancaires](#clickjacking-prefilled) | M4 | N2 | CWE-1021 | D4, D5 | [Isolation d’origine](http://127.0.0.1:5173/#/modules/m04/l07) |
| 94 | [SameSite contourné par surcharge de méthode](#samesite-method-override) | M4 | N2 | CWE-352 | D5 | [Isolation d’origine](http://127.0.0.1:5173/#/modules/m04/l07) |
| 95 | [CORS : origine reflétée avec identifiants](#cors-origin-reflection) | M4 | N1 | CWE-942 | D5 | [Isolation d’origine](http://127.0.0.1:5173/#/modules/m04/l07) |
| 96 | [CORS : origine null autorisée](#cors-null-origin) | M4 | N2 | CWE-942 | D5 | [Isolation d’origine](http://127.0.0.1:5173/#/modules/m04/l07) |
| 97 | [XS-Leak par comptage de cadres](#xsleak-frame-count) | M4 | N3 | CWE-200 | D5 | [Isolation d’origine](http://127.0.0.1:5173/#/modules/m04/l07) |
| 98 | [XS-Leak par événements d’erreur](#xsleak-error-events) | M4 | N3 | CWE-200 | D5 | [Isolation d’origine](http://127.0.0.1:5173/#/modules/m04/l07) |
| 99 | [Validation de paiement encadrable](#clickjacking) | M4 | N1 | CWE-1021 | D4, D5 | [Isolation d’origine](http://127.0.0.1:5173/#/modules/m04/l07) |
| 100 | [Secret livré dans le bundle](#secret-in-bundle) | M4 | N1 | CWE-615 | D5, D7 | [Le client n’est pas sous ton contrôle](http://127.0.0.1:5173/#/modules/m04/l01) |
| 101 | [Endpoint de diagnostic laissé ouvert](#debug-endpoint) | M17 | N1 | CWE-489 | D7 | [Configuration de production](http://127.0.0.1:5173/#/modules/m17/l01) |
| 102 | [Expression de validation non ancrée](#regex-unanchored) | M2 | N1 | CWE-625 | D5 | [Entrées non fiables dans Express](http://127.0.0.1:5173/#/modules/m02/l01) |
| 103 | [Normalisation après le contrôle d’unicité](#unicode-normalization) | M2 | N2 | CWE-178 | D5 | [Footguns JavaScript et argent](http://127.0.0.1:5173/#/modules/m02/l02) |
| 104 | [Le catch qui échoue ouvert](#try-catch-fail-open) | M2 | N2 | CWE-636 | D5 | [Erreurs, exceptions et atomicité](http://127.0.0.1:5173/#/modules/m02/l04) |
| 105 | [Troncature après validation](#input-truncation) | M2 | N2 | CWE-1284 | D5 | [Erreurs, exceptions et atomicité](http://127.0.0.1:5173/#/modules/m02/l04) |
| 106 | [Comparaison de jeton à temps variable](#timing-attack) | M2 | N2 | CWE-208 | D5 | [Erreurs, exceptions et atomicité](http://127.0.0.1:5173/#/modules/m02/l04) |
| 107 | [Redirection ouverte après connexion](#open-redirect) | M4 | N1 | CWE-601 | D5 | [React et le navigateur](http://127.0.0.1:5173/#/modules/m04/l02) |
| 108 | [Course à la construction du compte](#race-partial-construction) | M3 | N3 | CWE-362 | D5 | [Race conditions](http://127.0.0.1:5173/#/modules/m03/l01) |
| 109 | [Jetons de réinitialisation collidants](#reset-token-collision) | M3 | N2 | CWE-330 | D5 | [Race conditions](http://127.0.0.1:5173/#/modules/m03/l01) |
| 110 | [Différentiel d’analyse d’adresse](#email-parsing-differential) | M3 | N3 | CWE-436 | D5 | [Parser differentials et fuites via l’ORM](http://127.0.0.1:5173/#/modules/m03/l07) |
| 111 | [Cookie de préférences désérialisé](#cookie-deserialization) | M3 | N3 | CWE-502 | D5 | [Désérialisation et prototype pollution avancées](http://127.0.0.1:5173/#/modules/m03/l09) |
| 112 | [JWT : kid en traversée de chemin](#jwt-kid-traversal) | M3 | N3 | CWE-22 | D1, D5 | [Protocoles d’authentification avancés](http://127.0.0.1:5173/#/modules/m03/l10) |
| 113 | [JWT : jku et jwk honorés](#jwt-jku-jwk) | M3 | N3 | CWE-347 | D1, D5 | [Protocoles d’authentification avancés](http://127.0.0.1:5173/#/modules/m03/l10) |
| 114 | [Jeton valable d’un tenant à l’autre](#jwt-no-audience) | M3 | N2 | CWE-863 | D1, D5 | [Protocoles d’authentification avancés](http://127.0.0.1:5173/#/modules/m03/l10) |
| 115 | [Session qu’on ne peut pas révoquer](#session-not-revocable) | M3 | N2 | CWE-613 | D1, D5 | [Protocoles d’authentification avancés](http://127.0.0.1:5173/#/modules/m03/l10) |
| 116 | [Jeton tiré de Math.random](#weak-random) | M8 | N2 | CWE-338 | D1, D5 | [Crypto pour développeurs](http://127.0.0.1:5173/#/modules/m08/l08) |
| 117 | [redirect_uri validée par préfixe](#oauth-redirect) | M9 | N2 | CWE-601 | D1, D5 | [OAuth 2.1 et Authorization Code + PKCE](http://127.0.0.1:5173/#/modules/m09/l03) |
| 118 | [Connexion fédérée sans state](#oauth-state) | M9 | N2 | CWE-352 | D1, D5 | [OAuth 2.1 et Authorization Code + PKCE](http://127.0.0.1:5173/#/modules/m09/l03) |
| 119 | [nOAuth : e-mail non vérifié](#oauth-email-unverified) | M9 | N2 | CWE-287 | D1, D5 | [Attaques OAuth et OIDC](http://127.0.0.1:5173/#/modules/m09/l06) |
| 120 | [SAML : envelopper la signature](#saml-wrapping) | M9 | N3 | CWE-347 | D1, D4 | [SAML en entreprise](http://127.0.0.1:5173/#/modules/m09/l08) |
| 121 | [Énumération de comptes](#user-enumeration) | M10 | N1 | CWE-204 | D5 | [Credential stuffing et prise de contrôle](http://127.0.0.1:5173/#/modules/m10/l02) |
| 122 | [Limitation contournée par X-Forwarded-For](#xff-spoof) | M10 | N2 | CWE-290 | D5, D7 | [Limitation de débit bien conçue](http://127.0.0.1:5173/#/modules/m10/l03) |
| 123 | [Du finding au backlog](#pentest-to-appsec) | M1 | N1 | CWE-1059 | D2, D6 | [Du pentest à l’AppSec](http://127.0.0.1:5173/#/modules/m01/l01) |
| 124 | [Le gabarit de route qui naît sûr](#paved-road-template) | M1 | N2 | CWE-1188 | D2, D5 | [Principes DevSecOps](http://127.0.0.1:5173/#/modules/m01/l05) |
| 125 | [Évaluation SAMM qui se calcule](#samm-assessment) | M24 | N2 | CWE-1059 | D2 | [OWASP SAMM v2](http://127.0.0.1:5173/#/modules/m24/l02) |
| 126 | [La feuille de route dérivée de l’écart](#samm-roadmap) | M32 | N2 | CWE-1059 | D2 | [OWASP SAMM v2](http://127.0.0.1:5173/#/modules/m24/l02) |
| 127 | [La porte qui casse le build](#break-build-gate) | M32 | N2 | CWE-1059 | D2, D6 | [Jalons, portes et exceptions](http://127.0.0.1:5173/#/modules/m32/l03) |
| 128 | [L’exception qui expire](#risk-exception) | M32 | N2 | CWE-1059 | D2, D6 | [Jalons, portes et exceptions](http://127.0.0.1:5173/#/modules/m32/l03) |
| 129 | [Attestation SSDF adossée au dépôt](#ssdf-attestation) | M32 | N3 | CWE-1059 | D2 | [Risque et acceptation](http://127.0.0.1:5173/#/modules/m26/l06) |
| 130 | [Le signalement CRA, en test](#cra-notification) | M32 | N3 | CWE-1059 | D2, D8 | [Cyber Resilience Act et roadmap](http://127.0.0.1:5173/#/modules/m32/l05) |
| 131 | [Se comparer plutôt que se noter](#bsimm-compare) | M24 | N2 | CWE-1059 | D2 | [BSIMM16 : se comparer](http://127.0.0.1:5173/#/modules/m24/l03) |
| 132 | [Le doublon qui coûte cher](#finding-dedupe) | M5 | N2 | CWE-1059 | D6 | [Cycle de vie d’une vulnérabilité](http://127.0.0.1:5173/#/modules/m05/l01) |
| 133 | [Le triage qui va chercher la donnée](#triage-kev-epss) | M5 | N2 | CWE-1059 | D6 | [Prioriser par le risque](http://127.0.0.1:5173/#/modules/m05/l03) |
| 134 | [L’arbre SSVC, appliqué](#ssvc-decision) | M5 | N2 | CWE-1059 | D6 | [Prioriser par le risque](http://127.0.0.1:5173/#/modules/m05/l03) |
| 135 | [Le VEX qui dit non, et le prouve](#vex-not-affected) | M5 | N2 | CWE-1059 | D6, D8 | [Prioriser par le risque](http://127.0.0.1:5173/#/modules/m05/l03) |
| 136 | [Traduire un VEX d’un dialecte à l’autre](#vex-to-cyclonedx) | M5 | N3 | CWE-1059 | D6, D8 | [Outillage, SLA et dépendances npm](http://127.0.0.1:5173/#/modules/m05/l05) |
| 137 | [L’atteignabilité, à la main](#reachability-ast) | M5 | N3 | CWE-1059 | D6 | [Prioriser par le risque](http://127.0.0.1:5173/#/modules/m05/l03) |
| 138 | [Le SLA qui se mesure](#sla-policy) | M5 | N2 | CWE-1059 | D6, D7 | [Outillage, SLA et dépendances npm](http://127.0.0.1:5173/#/modules/m05/l05) |
| 139 | [Le constat qui agrège tout](#findings-aggregate) | M5 | N2 | CWE-1059 | D6 | [Outillage, SLA et dépendances npm](http://127.0.0.1:5173/#/modules/m05/l05) |
| 140 | [Publier sa politique de divulgation](#disclosure-policy) | M5 | N1 | CWE-1059 | D6, D8 | [Divulgation, bug bounty et CRA](http://127.0.0.1:5173/#/modules/m05/l06) |
| 141 | [Le finding à la bonne ligne](#finding-sarif) | M6 | N2 | CWE-1059 | D2, D6 | [Écrire un finding qui sera corrigé](http://127.0.0.1:5173/#/modules/m06/l01) |
| 142 | [Router la revue vers les bonnes personnes](#codeowners-sensitive) | M23 | N1 | CWE-1391 | D2, D7 | [Security Champions](http://127.0.0.1:5173/#/modules/m23/l04) |
| 143 | [Former à partir d’un vrai bug](#training-from-bug) | M6 | N2 | CWE-1059 | D2, D6 | [Former au code sécurisé](http://127.0.0.1:5173/#/modules/m06/l04) |
| 144 | [Cadrer un test d’intrusion](#pentest-scope) | M6 | N3 | CWE-1059 | D6, D8 | [Piloter la sécurité offensive](http://127.0.0.1:5173/#/modules/m06/l06) |
| 145 | [À qui fait-on confiance, au juste](#trust-inventory) | M1 | N1 | CWE-1059 | D1, D3 | [La confiance](http://127.0.0.1:5173/#/modules/m01/l02) |
| 146 | [Authentifier, autoriser, journaliser](#gold-standard-audit) | M1 | N1 | CWE-778 | D1, D5 | [C-I-A et Gold Standard](http://127.0.0.1:5173/#/modules/m01/l03) |
| 147 | [Le sous-ensemble ASVS de Novafact](#asvs-subset) | M7 | N2 | CWE-1059 | D3 | [Exigences et abuse cases](http://127.0.0.1:5173/#/modules/m07/l01) |
| 148 | [La matrice qui ne ment pas](#traceability-matrix) | M7 | N2 | CWE-1059 | D3, D6 | [Matrice de traçabilité](http://127.0.0.1:5173/#/modules/m07/l02) |
| 149 | [La carte des données, confrontée au code](#data-classification) | M7 | N2 | CWE-1059 | D3 | [Classification des données](http://127.0.0.1:5173/#/modules/m07/l03) |
| 150 | [L’effacement qui efface pour de bon](#erasure-test) | M7 | N2 | CWE-359 | D3, D6 | [Vie privée et RGPD](http://127.0.0.1:5173/#/modules/m07/l04) |
| 151 | [Ce que la conformité impose vraiment](#compliance-matrix) | M7 | N2 | CWE-1059 | D3, D8 | [Conformité : NIS2, CRA, PCI DSS](http://127.0.0.1:5173/#/modules/m07/l05) |
| 152 | [Recertifier les accès](#access-recertification) | M7 | N3 | CWE-1059 | D3, D7 | [Provisionnement des accès](http://127.0.0.1:5173/#/modules/m07/l06) |
| 153 | [Le DFD qui remonte la bonne menace](#dfd-as-code) | M11 | N2 | CWE-1059 | D4 | [Les 4 questions et la démarche](http://127.0.0.1:5173/#/modules/m11/l01) |
| 154 | [STRIDE par élément, sans trou](#stride-per-element) | M11 | N1 | CWE-1059 | D4 | [STRIDE par élément](http://127.0.0.1:5173/#/modules/m11/l02) |
| 155 | [L’arbre d’attaque coupé](#attack-tree) | M11 | N2 | CWE-1059 | D4 | [Choisir sa méthode](http://127.0.0.1:5173/#/modules/m11/l03) |
| 156 | [Du CWE à la technique ATT&CK](#cwe-capec-attack) | M11 | N2 | CWE-1059 | D4 | [MITRE pour l’AppSec](http://127.0.0.1:5173/#/modules/m11/l04) |
| 157 | [LINDDUN sur le parcours de facturation](#linddun-privacy) | M11 | N2 | CWE-1059 | D3, D4 | [Choisir sa méthode](http://127.0.0.1:5173/#/modules/m11/l03) |
| 158 | [Le modèle qui bloque la PR](#tm-drift-ci) | M11 | N2 | CWE-1059 | D2, D4 | [Threat modeling agile et as code](http://127.0.0.1:5173/#/modules/m11/l05) |
| 159 | [Modéliser l’agent, la chaîne et le poste](#tm-ai-supply-dev) | M11 | N3 | CWE-1059 | D4, D8 | [Modéliser l’IA, la supply chain et le dev](http://127.0.0.1:5173/#/modules/m11/l06) |
| 160 | [La carte des sources et des sinks](#attack-surface-map) | M12 | N1 | CWE-1059 | D5, D6 | [Méthode sur une base inconnue](http://127.0.0.1:5173/#/modules/m12/l02) |
| 161 | [Trouver le sink d’une vraie CVE](#secbench-sink) | M12 | N2 | CWE-1059 | D5, D6 | [Lire des correctifs de CVE](http://127.0.0.1:5173/#/modules/m12/l04) |
| 162 | [La revue de PR notée sur ses verdicts](#review-pr-verdicts) | M12 | N2 | CWE-1059 | D5, D6 | [Revoir une PR en 10 minutes](http://127.0.0.1:5173/#/modules/m12/l03) |
| 163 | [Revoir une PR écrite par une IA](#review-ai-pr) | M12 | N2 | CWE-1078 | D5, D6 | [Revoir du code généré par IA](http://127.0.0.1:5173/#/modules/m12/l06) |
| 164 | [Quatre heures, et on rend](#timeboxed-audit) | M12 | N3 | CWE-1059 | D5, D6 | [Audit ciblé et limité dans le temps](http://127.0.0.1:5173/#/modules/m12/l07) |
| 165 | [Où placer chaque technique](#test-strategy) | M13 | N1 | CWE-1059 | D6 | [Stratégie de test de sécurité](http://127.0.0.1:5173/#/modules/m13/l01) |
| 166 | [La règle qui attrape la classe](#eslint-rule) | M13 | N2 | CWE-1059 | D5, D6 | [SAST pour JavaScript](http://127.0.0.1:5173/#/modules/m13/l03) |
| 167 | [Générer le SBOM, et le garder juste](#sbom-generate) | M13 | N2 | CWE-1059 | D6, D8 | [SCA et SBOM](http://127.0.0.1:5173/#/modules/m13/l06) |
| 168 | [Des données de test qui ne viennent pas de la prod](#test-data-generator) | M13 | N2 | CWE-359 | D6, D3 | [Données de test](http://127.0.0.1:5173/#/modules/m13/l08) |
| 169 | [Script d’installation malveillant](#malicious-postinstall) | M13 | N3 | CWE-506 | D5, D8 | [Inspecter du code malveillant](http://127.0.0.1:5173/#/modules/m13/l09) |
| 170 | [Évaluer un relecteur IA](#ai-review-eval) | M13 | N3 | CWE-1059 | D5, D6 | [L’IA dans l’analyse de code](http://127.0.0.1:5173/#/modules/m13/l10) |
| 171 | [Permissions de workflow trop larges](#gha-permissions) | M14 | N1 | CWE-732 | D7, D8 | [Durcir GitHub Actions](http://127.0.0.1:5173/#/modules/m14/l02) |
| 172 | [Injection de template dans un run](#gha-injection) | M14 | N2 | CWE-94 | D7, D8 | [Durcir GitHub Actions](http://127.0.0.1:5173/#/modules/m14/l02) |
| 173 | [Pwn request sur pull_request_target](#gha-pwn-request) | M14 | N2 | CWE-269 | D7, D8 | [Durcir GitHub Actions](http://127.0.0.1:5173/#/modules/m14/l02) |
| 174 | [Actions non épinglées au SHA](#gha-unpinned) | M14 | N1 | CWE-1357 | D7, D8 | [Durcir GitHub Actions](http://127.0.0.1:5173/#/modules/m14/l02) |
| 175 | [Action typosquattée](#gha-typosquat-action) | M14 | N2 | CWE-1357 | D8 | [Choisir un composant](http://127.0.0.1:5173/#/modules/m14/l06) |
| 176 | [Identifiants git publiés dans un artefact](#gha-artipacked) | M14 | N2 | CWE-522 | D7, D8 | [Durcir GitHub Actions](http://127.0.0.1:5173/#/modules/m14/l02) |
| 177 | [Script tiers exécuté sans vérification](#gha-curl-bash) | M14 | N2 | CWE-494 | D7, D8 | [Outils du pipeline](http://127.0.0.1:5173/#/modules/m14/l04) |
| 178 | [npm install en intégration continue](#npm-ci-lockfile) | M14 | N1 | CWE-1104 | D8 | [npm : installer et publier](http://127.0.0.1:5173/#/modules/m14/l05) |
| 179 | [secrets: inherit vers un workflow réutilisable](#gha-secrets-inherit) | M14 | N2 | CWE-668 | D7, D8 | [Durcir GitHub Actions](http://127.0.0.1:5173/#/modules/m14/l02) |
| 180 | [Empoisonnement du cache Actions](#gha-cache-poisoning) | M14 | N3 | CWE-349 | D7, D8 | [Durcir GitHub Actions](http://127.0.0.1:5173/#/modules/m14/l02) |
| 181 | [Publication sans provenance](#npm-provenance) | M14 | N2 | CWE-345 | D7, D8 | [SLSA, Sigstore et provenance](http://127.0.0.1:5173/#/modules/m14/l10) |
| 182 | [Condition « acteur bot » usurpable](#gha-bot-condition) | M14 | N2 | CWE-290 | D7, D8 | [Durcir GitHub Actions](http://127.0.0.1:5173/#/modules/m14/l02) |
| 183 | [Runner self-hosted ouvert aux forks](#gha-self-hosted) | M14 | N2 | CWE-668 | D7, D8 | [Durcir GitHub Actions](http://127.0.0.1:5173/#/modules/m14/l02) |
| 184 | [CODEOWNERS qui ne couvre pas la CI](#codeowners-ci) | M14 | N1 | CWE-1391 | D7, D8 | [Durcir GitHub Actions](http://127.0.0.1:5173/#/modules/m14/l02) |
| 185 | [Scripts d’installation non neutralisés](#npmrc-ignore-scripts) | M14 | N2 | CWE-506 | D8 | [Sécuriser l’environnement de dev](http://127.0.0.1:5173/#/modules/m14/l03) |
| 186 | [Jeton de publication dans le dépôt](#npm-token-in-repo) | M14 | N1 | CWE-798 | D7, D8 | [npm : installer et publier](http://127.0.0.1:5173/#/modules/m14/l05) |
| 187 | [Confusion de dépendances sur le scope interne](#dependency-confusion) | M14 | N2 | CWE-427 | D8 | [npm : installer et publier](http://127.0.0.1:5173/#/modules/m14/l05) |
| 188 | [Lockfile détourné](#lockfile-integrity) | M14 | N2 | CWE-494 | D8 | [npm : installer et publier](http://127.0.0.1:5173/#/modules/m14/l05) |
| 189 | [Fuite de fichiers dans le paquet publié](#npm-pack-leak) | M14 | N1 | CWE-538 | D8 | [SLSA, Sigstore et provenance](http://127.0.0.1:5173/#/modules/m14/l10) |
| 190 | [L’artefact ne correspond pas au source](#vendor-build-mismatch) | M14 | N3 | CWE-506 | D8 | [Cas réels de supply chain](http://127.0.0.1:5173/#/modules/m14/l08) |
| 191 | [Politique en joker](#iam-wildcard) | M15 | N1 | CWE-732 | D1, D7 | [Le modèle IAM et la logique d’évaluation](http://127.0.0.1:5173/#/modules/m15/l01) |
| 192 | [Zéro utilisateur IAM](#iam-no-users) | M15 | N1 | CWE-522 | D1, D7 | [Zéro utilisateur IAM](http://127.0.0.1:5173/#/modules/m15/l02) |
| 193 | [Le joker sous le mauvais opérateur](#iam-stringequals-wildcard) | M15 | N1 | CWE-183 | D1, D7 | [Le modèle IAM et la logique d’évaluation](http://127.0.0.1:5173/#/modules/m15/l01) |
| 194 | [Chemin d’escalade par PassRole](#iam-passrole) | M15 | N2 | CWE-269 | D1, D7 | [Escalade et abus](http://127.0.0.1:5173/#/modules/m15/l04) |
| 195 | [Le rôle qui peut se réécrire](#iam-create-policy-version) | M15 | N2 | CWE-269 | D1, D7 | [Escalade et abus](http://127.0.0.1:5173/#/modules/m15/l04) |
| 196 | [Trust policy OIDC mal filtrée](#iam-oidc-trust) | M15 | N2 | CWE-1220 | D1, D7, D8 | [Escalade et abus](http://127.0.0.1:5173/#/modules/m15/l04) |
| 197 | [Le joker d’organisation](#iam-oidc-org-wildcard) | M15 | N2 | CWE-1220 | D1, D7 | [Escalade et abus](http://127.0.0.1:5173/#/modules/m15/l04) |
| 198 | [Accès inter-comptes sans ExternalId](#iam-external-id) | M15 | N2 | CWE-441 | D1, D7 | [Multi-comptes et data perimeter](http://127.0.0.1:5173/#/modules/m15/l06) |
| 199 | [Le Deny qui ne refuse rien](#iam-not-action) | M15 | N2 | CWE-183 | D1, D7 | [Le modèle IAM et la logique d’évaluation](http://127.0.0.1:5173/#/modules/m15/l01) |
| 200 | [L’opérateur qui échoue en ouvert](#iam-forallvalues) | M15 | N3 | CWE-183 | D1, D7 | [Le modèle IAM et la logique d’évaluation](http://127.0.0.1:5173/#/modules/m15/l01) |
| 201 | [Politique de bucket ouverte](#s3-bucket-policy-public) | M15 | N1 | CWE-732 | D1, D7 | [Le modèle IAM et la logique d’évaluation](http://127.0.0.1:5173/#/modules/m15/l01) |
| 202 | [Rôle de tâche et rôle d’exécution confondus](#ecs-task-vs-execution) | M15 | N2 | CWE-269 | D1, D7 | [Workloads Node.js](http://127.0.0.1:5173/#/modules/m15/l03) |
| 203 | [Politique de clé trop permissive](#kms-key-policy) | M15 | N2 | CWE-732 | D1, D7 | [Le modèle IAM et la logique d’évaluation](http://127.0.0.1:5173/#/modules/m15/l01) |
| 204 | [La CI qui peut se fabriquer un admin](#permission-boundary) | M15 | N3 | CWE-269 | D1, D7 | [Escalade et abus](http://127.0.0.1:5173/#/modules/m15/l04) |
| 205 | [Le périmètre de données](#data-perimeter) | M15 | N3 | CWE-732 | D4, D7 | [Multi-comptes et data perimeter](http://127.0.0.1:5173/#/modules/m15/l06) |
| 206 | [Bucket des pièces jointes exposé](#tf-public-bucket) | M16 | N1 | CWE-1188 | D7 | [L’IaC comme surface](http://127.0.0.1:5173/#/modules/m16/l01) |
| 207 | [Groupe de sécurité ouvert](#tf-open-sg) | M16 | N1 | CWE-284 | D7 | [L’IaC comme surface](http://127.0.0.1:5173/#/modules/m16/l01) |
| 208 | [Base de données non durcie](#tf-rds-hardening) | M16 | N2 | CWE-1188 | D7 | [Scanners IaC](http://127.0.0.1:5173/#/modules/m16/l02) |
| 209 | [Secret dans le code et dans le state](#tf-state-secret) | M16 | N2 | CWE-798 | D7, D8 | [State, pipeline et supply chain IaC](http://127.0.0.1:5173/#/modules/m16/l04) |
| 210 | [Le state versionné](#tf-state-committed) | M16 | N1 | CWE-538 | D7, D8 | [State, pipeline et supply chain IaC](http://127.0.0.1:5173/#/modules/m16/l04) |
| 211 | [Backend non chiffré et non verrouillé](#tf-backend) | M16 | N2 | CWE-311 | D7 | [State, pipeline et supply chain IaC](http://127.0.0.1:5173/#/modules/m16/l04) |
| 212 | [Provider et module non épinglés](#tf-unpinned-provider) | M16 | N2 | CWE-1357 | D7, D8 | [State, pipeline et supply chain IaC](http://127.0.0.1:5173/#/modules/m16/l04) |
| 213 | [Répartiteur en clair et TLS obsolète](#tf-alb-tls) | M16 | N2 | CWE-319 | D7 | [Scanners IaC](http://127.0.0.1:5173/#/modules/m16/l02) |
| 214 | [Distribution sans WAF ni TLS minimum](#cloudfront-waf) | M16 | N2 | CWE-693 | D7 | [Scanners IaC](http://127.0.0.1:5173/#/modules/m16/l02) |
| 215 | [IMDSv1 laissé actif](#imdsv1-terraform) | M16 | N2 | CWE-918 | D7 | [L’IaC comme surface](http://127.0.0.1:5173/#/modules/m16/l01) |
| 216 | [Joker IAM dans le code CDK](#cdk-wildcard) | M16 | N2 | CWE-732 | D7 | [L’IaC comme surface](http://127.0.0.1:5173/#/modules/m16/l01) |
| 217 | [Les garde-fous débranchés](#cdk-nag-disabled) | M16 | N2 | CWE-1059 | D7 | [Policy as code](http://127.0.0.1:5173/#/modules/m16/l03) |
| 218 | [Bootstrap CDK par défaut](#cdk-bootstrap) | M16 | N3 | CWE-732 | D7, D8 | [State, pipeline et supply chain IaC](http://127.0.0.1:5173/#/modules/m16/l04) |
| 219 | [Journalisation d’infrastructure absente](#tf-logging) | M16 | N2 | CWE-778 | D7 | [Dérive et runtime](http://127.0.0.1:5173/#/modules/m16/l05) |
| 220 | [Image de conteneur trop permissive](#dockerfile) | M17 | N2 | CWE-250 | D7 | [Conteneurs Node.js](http://127.0.0.1:5173/#/modules/m17/l02) |
| 221 | [Image de base non épinglée](#docker-base-pinning) | M17 | N1 | CWE-1357 | D7, D8 | [Conteneurs Node.js](http://127.0.0.1:5173/#/modules/m17/l02) |
| 222 | [Tout le dépôt dans l’image](#dockerignore) | M17 | N1 | CWE-538 | D7 | [Conteneurs Node.js](http://127.0.0.1:5173/#/modules/m17/l02) |
| 223 | [Pod sans contexte de sécurité](#k8s-securitycontext) | M17 | N2 | CWE-250 | D7 | [Plateformes AWS](http://127.0.0.1:5173/#/modules/m17/l04) |
| 224 | [RBAC avec des jokers](#k8s-rbac) | M17 | N2 | CWE-732 | D7 | [Plateformes AWS](http://127.0.0.1:5173/#/modules/m17/l04) |
| 225 | [Socket Docker monté dans le conteneur](#docker-socket) | M17 | N2 | CWE-250 | D7 | [Plateformes AWS](http://127.0.0.1:5173/#/modules/m17/l04) |
| 226 | [Sauvegardes qu’un attaquant peut effacer](#backup-immutable) | M17 | N2 | CWE-1188 | D7 | [Résilience et continuité](http://127.0.0.1:5173/#/modules/m17/l06) |
| 227 | [Publier en sécurité](#signed-artifacts) | M17 | N2 | CWE-345 | D7, D8 | [Publier en sécurité](http://127.0.0.1:5173/#/modules/m17/l03) |
| 228 | [Le vocabulaire imposé](#logging-vocabulary) | M18 | N1 | CWE-778 | D5, D7 | [Journaliser pour la sécurité](http://127.0.0.1:5173/#/modules/m18/l01) |
| 229 | [Ce qu’il ne faut jamais journaliser](#never-log) | M18 | N1 | CWE-532 | D3, D7 | [Journaliser pour la sécurité](http://127.0.0.1:5173/#/modules/m18/l01) |
| 230 | [Les champs qui manquent à la corrélation](#ecs-fields) | M18 | N2 | CWE-778 | D7 | [Ingestion dans Elastic](http://127.0.0.1:5173/#/modules/m18/l03) |
| 231 | [Le lint sémantique du schéma](#ecs-lint) | M18 | N2 | CWE-1059 | D7 | [Ingestion dans Elastic](http://127.0.0.1:5173/#/modules/m18/l03) |
| 232 | [L’inventaire de journalisation](#logging-inventory) | M18 | N2 | CWE-778 | D3, D7 | [Journaliser pour la sécurité](http://127.0.0.1:5173/#/modules/m18/l01) |
| 233 | [Écrire la règle : bourrage d’identifiants](#rule-credential-stuffing) | M18 | N2 | CWE-1059 | D7 | [KQL, EQL et ES|QL](http://127.0.0.1:5173/#/modules/m18/l04) |
| 234 | [Régler le seuil](#rule-threshold) | M28 | N2 | CWE-1059 | D7 | [Règles, Sigma et detection-as-code](http://127.0.0.1:5173/#/modules/m28/l03) |
| 235 | [La corrélation temporelle](#rule-temporal-spray) | M18 | N3 | CWE-1059 | D7 | [KQL, EQL et ES|QL](http://127.0.0.1:5173/#/modules/m18/l04) |
| 236 | [Le piège à miel](#honeytoken) | M28 | N2 | CWE-1059 | D7 | [Détections applicatives](http://127.0.0.1:5173/#/modules/m28/l05) |
| 237 | [Détecter l’injection indirecte](#detect-prompt-injection) | M28 | N3 | CWE-1059 | D4, D7 | [Détections applicatives](http://127.0.0.1:5173/#/modules/m28/l05) |
| 238 | [La règle qui se tait après le correctif](#rule-silent-after-fix) | M28 | N2 | CWE-1059 | D6, D7 | [Maturité et réponse à incident](http://127.0.0.1:5173/#/modules/m28/l06) |
| 239 | [Deux fixtures par règle](#rule-fixtures) | M28 | N1 | CWE-1059 | D6, D7 | [Règles, Sigma et detection-as-code](http://127.0.0.1:5173/#/modules/m28/l03) |
| 240 | [Le lint de règle](#rule-lint) | M28 | N2 | CWE-1059 | D6, D7 | [Règles, Sigma et detection-as-code](http://127.0.0.1:5173/#/modules/m28/l03) |
| 241 | [L’atomique qui valide la règle](#atomic-test) | M28 | N2 | CWE-1059 | D6, D7 | [Règles, Sigma et detection-as-code](http://127.0.0.1:5173/#/modules/m28/l03) |
| 242 | [Les points de détection applicatifs](#appsensor-points) | M28 | N2 | CWE-778 | D5, D7 | [Détections applicatives](http://127.0.0.1:5173/#/modules/m28/l05) |
| 243 | [La réponse graduée](#graduated-response) | M28 | N2 | CWE-1059 | D5, D7 | [Détections applicatives](http://127.0.0.1:5173/#/modules/m28/l05) |
| 244 | [La fiche de stratégie de détection](#ads-documentation) | M28 | N2 | CWE-1059 | D7 | [Règles, Sigma et detection-as-code](http://127.0.0.1:5173/#/modules/m28/l03) |
| 245 | [La couverture qui se prouve](#detection-coverage) | M28 | N3 | CWE-1059 | D7 | [Règles, Sigma et detection-as-code](http://127.0.0.1:5173/#/modules/m28/l03) |
| 246 | [La chronologie de l’incident](#incident-timeline) | M28 | N3 | CWE-1059 | D7 | [Maturité et réponse à incident](http://127.0.0.1:5173/#/modules/m28/l06) |

## M3 · Présentation de l’AppSec

<a id="pentest-to-appsec"></a>

### Du finding au backlog

**N1** · CWE-1059 · D2 Cycle de vie · D6 Tests

Le lab contient un rapport de pentest classique : `fixtures/m01/pentest-report.json`, treize constats triés par sévérité, sans classe de bugs, sans propriétaire et sans échéance.

**Objectif.** Le transformer en backlog d’équipe : regrouper les constats par classe de bugs, et donner pour chaque classe le CWE, le fichier fautif, le correctif structurel, le test de régression qui l’établit, l’équipe propriétaire et l’échéance.

**Où.** `program/backlog.yaml`

**Dans le cours.**
- [Du pentest à l’AppSec](http://127.0.0.1:5173/#/modules/m01/l01) · [source](../src/content/m01/l01.mdx)
- [Écrire un finding qui sera corrigé](http://127.0.0.1:5173/#/modules/m06/l01) · [source](../src/content/m06/l01.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Passer de « voici 13 bugs » à « voici 9 classes et les contrôles qui les éliminent » est tout le métier. Le harnais vérifie que chaque constat du rapport est repris une fois, que sa classe correspond au CWE du registre, que le fichier cité est bien celui qui porte le défaut, et que le test cité existe et couvre la classe. La qualité rédactionnelle du correctif n’est pas notée — seulement qu’il existe et qu’il n’a pas été recopié d’une autre classe.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/program/backlog.yaml`](solutions/program/backlog.yaml)
</details>

<a id="paved-road-template"></a>

### Le gabarit de route qui naît sûr

**N2** · CWE-1188 · D2 Cycle de vie · D5 Implémentation

Chaque nouvelle route de Novafact réimplémente à sa façon l’authentification, la validation et le filtrage par tenant. Trois d’entre elles s’y sont trompées.

**Objectif.** Écrire le squelette de route que toute nouvelle route reprendra, et prouver qu’il est sûr par défaut : le harnais s’en sert pour générer une ressource qu’il est seul à connaître, puis l’attaque.

**Où.** `templates/route.ts`

**Dans le cours.**
- [Principes DevSecOps](http://127.0.0.1:5173/#/modules/m01/l05) · [source](../src/content/m01/l05.mdx)
- [Le paved road comme produit](http://127.0.0.1:5173/#/modules/m06/l05) · [source](../src/content/m06/l05.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Le harnais génère une route neuve depuis le gabarit et lui applique une batterie d’attaques génériques : les cinq doivent être refusées et l’appel légitime répondre. On mesure que le chemin par défaut est sûr — c’est la définition du paved road. Un gabarit qui refuse tout échoue au sixième cas, et c’est voulu : une route que personne ne peut utiliser ne sera pas reprise.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/templates/route.ts`](solutions/templates/route.ts)
</details>

<a id="trust-inventory"></a>

### À qui fait-on confiance, au juste

**N1** · CWE-1059 · D1 Concepts · D3 Exigences

Novafact fait implicitement confiance à des dizaines de parties : registre npm, CDN, prestataire de paiement, fournisseur d’IA, runner de CI, poste des développeurs. Aucune liste n’existe.

**Objectif.** Établir l’inventaire des composants implicitement fiables, avec ce que chacun pourrait faire s’il se retournait.

**Où.** `requirements/trust.yaml`

**Dans le cours.**
- [La confiance](http://127.0.0.1:5173/#/modules/m01/l02) · [source](../src/content/m01/l02.mdx)
- [Les 4 anti-patterns](http://127.0.0.1:5173/#/modules/m08/l04) · [source](../src/content/m08/l04.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Le harnais confronte l’inventaire au code : chaque origine externe chargée, chaque dépendance directe, chaque action de CI doit y figurer, et rien d’imaginaire. La confiance est un spectre, et le premier geste de conception est de réduire le nombre de parties à qui l’on est obligé de faire confiance.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/requirements/trust.yaml`](solutions/requirements/trust.yaml)
</details>

<a id="gold-standard-audit"></a>

### Authentifier, autoriser, journaliser

**N1** · CWE-778 · D1 Concepts · D5 Implémentation

Le Gold Standard demande trois choses de chaque opération sensible. Les routes de Novafact en offrent une, deux, ou zéro, sans logique apparente.

**Objectif.** Établir pour chaque route mutante ce qui est présent et ce qui manque — et faire tomber l’écart à zéro.

**Où.** `requirements/gold-standard.csv`

**Dans le cours.**
- [C-I-A et Gold Standard](http://127.0.0.1:5173/#/modules/m01/l03) · [source](../src/content/m01/l03.mdx)
- [Journaliser pour la sécurité](http://127.0.0.1:5173/#/modules/m18/l01) · [source](../src/content/m18/l01.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Le harnais extrait les routes réellement montées et vérifie ligne à ligne. Le « A » d’audit est celui qu’on oublie — et c’est celui qui permet de répondre après coup à « qui a fait ça ».

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/requirements/gold-standard.csv`](solutions/requirements/gold-standard.csv)
</details>

## M7 · Vulnérabilités côté serveur

<a id="nosql-auth"></a>

### Injection NoSQL dans la connexion

**N1** · CWE-943 · D5 Implémentation · Kohnfelder K10

Le formulaire de connexion passe `req.body` tel quel au moteur de requêtes des comptes. Le moteur du lab reproduit les opérateurs de Mongo ($ne, $gt, $regex, $in).

**Objectif.** Te connecter en tant que admin@novafact.example sans connaître son mot de passe.

**Où.** `server/routes/auth.ts`

**Dans le cours.**
- [Entrées non fiables dans Express](http://127.0.0.1:5173/#/modules/m02/l01) · [source](../src/content/m02/l01.mdx)
- [Éliminer une classe entière](http://127.0.0.1:5173/#/modules/m02/l09) · [source](../src/content/m02/l09.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Valider par schéma (zod/ajv) avant la couche de données, et refuser toute clé commençant par $. Le schéma doit être imposé par le framework, pas rappelé dans chaque route.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/routes/auth.ts`](solutions/server/routes/auth.ts)
</details>

<a id="mass-assignment"></a>

### Mass assignment sur le profil

**N1** · CWE-915 · D5 Implémentation

La mise à jour du profil fusionne le corps de la requête dans l’objet utilisateur, pour « ne pas avoir à lister les champs ».

**Objectif.** Faire passer ton compte dev@acme.example au rôle admin.

**Où.** `server/routes/profile.ts`

**Dans le cours.**
- [Entrées non fiables dans Express](http://127.0.0.1:5173/#/modules/m02/l01) · [source](../src/content/m02/l01.mdx)
- [Revoir une PR en 10 minutes](http://127.0.0.1:5173/#/modules/m12/l03) · [source](../src/content/m12/l03.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Construire explicitement l’objet des champs autorisés (liste blanche), jamais Object.assign / spread du corps brut. Séparer le DTO d’entrée du modèle persisté.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/routes/profile.ts`](solutions/server/routes/profile.ts)
</details>

<a id="bola-invoice"></a>

### BOLA : la facture du voisin

**N1** · CWE-639 · D5 Implémentation

GET /api/invoices/:id vérifie que tu es authentifié, puis charge la facture par son identifiant. L’autorisation est laissée « à la charge de chaque route ».

**Objectif.** Lire une facture du tenant globex depuis ton compte acme.

**Où.** `server/routes/invoices.ts`

**Dans le cours.**
- [Entrées non fiables dans Express](http://127.0.0.1:5173/#/modules/m02/l01) · [source](../src/content/m02/l01.mdx)
- [Autorisation et multi-tenant](http://127.0.0.1:5173/#/modules/m09/l02) · [source](../src/content/m09/l02.mdx)
- [Revue orientée autorisation](http://127.0.0.1:5173/#/modules/m12/l05) · [source](../src/content/m12/l05.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Filtrer par tenant dans la couche d’accès aux données elle-même (un repository qui exige le tenant, ou RLS PostgreSQL), pour qu’aucune route ne puisse l’oublier.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/routes/invoices.ts`](solutions/server/routes/invoices.ts)
</details>

<a id="proto-pollution"></a>

### Prototype pollution côté serveur

**N2** · CWE-1321 · D5 Implémentation · Kohnfelder K8

Les préférences utilisateur sont fusionnées récursivement dans les réglages stockés, avec un deepMerge maison.

**Objectif.** Polluer Object.prototype pour que le contrôle d’accès de l’export comptable te croie autorisé, puis déclencher GET /api/export.

**Où.** `server/routes/settings.ts`

**Dans le cours.**
- [Spécificités Node.js](http://127.0.0.1:5173/#/modules/m02/l03) · [source](../src/content/m02/l03.mdx)
- [Désérialisation et prototype pollution avancées](http://127.0.0.1:5173/#/modules/m03/l09) · [source](../src/content/m03/l09.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Objets sans prototype (Object.create(null)) ou Map pour les données venant du réseau, rejet des clés __proto__ / constructor / prototype, schéma strict. Ne jamais faire dépendre une décision d’autorisation d’une propriété héritée.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/routes/settings.ts`](solutions/server/routes/settings.ts)
</details>

<a id="money-float"></a>

### Arithmétique de l’argent

**N1** · CWE-681 · D5 Implémentation · Kohnfelder K9

Les lignes de facture sont calculées en flottants et les quantités ne sont pas bornées côté serveur.

**Objectif.** Créer une facture dont le total est strictement négatif.

**Où.** `server/routes/invoices.ts`

**Dans le cours.**
- [Footguns JavaScript et argent](http://127.0.0.1:5173/#/modules/m02/l02) · [source](../src/content/m02/l02.mdx)
- [Invariants métier](http://127.0.0.1:5173/#/modules/m10/l06) · [source](../src/content/m10/l06.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Montants en centimes entiers (ou décimal), quantités entières positives imposées par le schéma, total recalculé côté serveur et invariant « total >= 0 » vérifié avant persistance.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/routes/invoices.ts`](solutions/server/routes/invoices.ts)
</details>

<a id="redos"></a>

### ReDoS sur la référence de facture

**N2** · CWE-1333 · D5 Implémentation

La recherche de factures valide la référence fournie avec une expression régulière à quantificateurs imbriqués, sur la boucle d’événements.

**Objectif.** Faire dépasser 1 seconde de calcul à la route de recherche avec une seule requête.

**Où.** `server/routes/invoices.ts`

**Dans le cours.**
- [Spécificités Node.js](http://127.0.0.1:5173/#/modules/m02/l03) · [source](../src/content/m02/l03.mdx)
- [Fuzzing et tests de disponibilité](http://127.0.0.1:5173/#/modules/m13/l05) · [source](../src/content/m13/l05.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Regex linéaires (pas de quantificateur imbriqué), longueur d’entrée bornée avant le test, ou moteur RE2. Le CPU de la boucle d’événements est une ressource partagée : la disponibilité est une exigence de sécurité (K12).

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/routes/invoices.ts`](solutions/server/routes/invoices.ts)
</details>

<a id="path-traversal"></a>

### Traversée de chemin sur les pièces jointes

**N2** · CWE-22 · D5 Implémentation

Le téléchargement d’une pièce jointe concatène le nom demandé au dossier des pièces jointes du lab.

**Objectif.** Lire le fichier server/secrets/aws-credentials.txt via la route de téléchargement.

**Où.** `server/routes/attachments.ts`

**Dans le cours.**
- [Spécificités Node.js](http://127.0.0.1:5173/#/modules/m02/l03) · [source](../src/content/m02/l03.mdx)
- [Mitigations structurelles](http://127.0.0.1:5173/#/modules/m08/l02) · [source](../src/content/m08/l02.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Ne jamais dériver un chemin du client : identifiant opaque → chemin résolu depuis un index côté serveur. À défaut, path.resolve puis vérifier que le résultat commence par la racine autorisée.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/routes/attachments.ts`](solutions/server/routes/attachments.ts)
</details>

<a id="ssrf-imds"></a>

### SSRF vers le service de métadonnées

**N2** · CWE-918 · D5 Implémentation · D7 Déploiement & exploitation

Le test de webhook récupère l’URL fournie par le client pour montrer la réponse. Le lab héberge un faux service de métadonnées d’instance (IMDSv1) sur la boucle locale — rien ne sort de ta machine.

**Objectif.** Récupérer le rôle de la tâche ECS de Novafact depuis le faux IMDS, via la route de test de webhook.

**Où.** `server/routes/webhooks.ts`

**Dans le cours.**
- [Spécificités Node.js](http://127.0.0.1:5173/#/modules/m02/l03) · [source](../src/content/m02/l03.mdx)
- [SSRF avancée](http://127.0.0.1:5173/#/modules/m03/l11) · [source](../src/content/m03/l11.mdx)
- [Workloads Node.js](http://127.0.0.1:5173/#/modules/m15/l03) · [source](../src/content/m15/l03.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Proxy de sortie avec liste blanche de destinations, résolution DNS puis vérification de l’IP obtenue (et re-vérification après redirection), IMDSv2 exigé au niveau de l’instance, pas de réponse renvoyée au client.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/routes/webhooks.ts`](solutions/server/routes/webhooks.ts)
</details>

<a id="bfla-method"></a>

### BFLA : la méthode oubliée

**N1** · CWE-285 · D5 Implémentation

Le contrôle d’appartenance au tenant est monté sur la lecture d’une facture, mais pas sur sa suppression.

**Objectif.** Supprimer une facture appartenant à un autre tenant.

**Où.** `server/routes/invoices.ts`

**Dans le cours.**
- [Entrées non fiables dans Express](http://127.0.0.1:5173/#/modules/m02/l01) · [source](../src/content/m02/l01.mdx)
- [Autorisation et multi-tenant](http://127.0.0.1:5173/#/modules/m09/l02) · [source](../src/content/m09/l02.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Un contrôle posé méthode par méthode sera oublié à la prochaine méthode. Il se pose sur la ressource, dans la couche d’accès aux données. API5:2023.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/routes/invoices.ts`](solutions/server/routes/invoices.ts)
</details>

<a id="bola-nested"></a>

### BOLA sur un identifiant imbriqué

**N2** · CWE-639 · D5 Implémentation

La création de facture vérifie le tenant de l’appelant, mais pas celui du client auquel la facture est rattachée.

**Objectif.** Créer une facture rattachée au client d’un autre tenant.

**Où.** `server/routes/invoices.ts`

**Dans le cours.**
- [Entrées non fiables dans Express](http://127.0.0.1:5173/#/modules/m02/l01) · [source](../src/content/m02/l01.mdx)
- [Autorisation et multi-tenant](http://127.0.0.1:5173/#/modules/m09/l02) · [source](../src/content/m09/l02.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Chaque identifiant qui entre dans une requête est à autoriser, pas seulement celui de la route. Le contrôle appartient au repository : `findCustomer(id, tenantId)` ne peut pas être appelé sans le tenant.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/routes/invoices.ts`](solutions/server/routes/invoices.ts)
</details>

<a id="error-leak"></a>

### Erreur non gérée et état incohérent

**N2** · CWE-209 · D5 Implémentation · Kohnfelder K13

Une promesse non gérée dans la création de facture laisse la trace d’exécution remonter au client, et la facture à moitié écrite.

**Objectif.** Obtenir une trace d’exécution du serveur, et laisser une facture dans un état impossible.

**Où.** `server/routes/invoices.ts`

**Dans le cours.**
- [Erreurs, exceptions et atomicité](http://127.0.0.1:5173/#/modules/m02/l04) · [source](../src/content/m02/l04.mdx)
- [Configuration de production](http://127.0.0.1:5173/#/modules/m17/l01) · [source](../src/content/m17/l01.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Échec sûr : gestionnaire qui ne révèle rien, transaction qui annule tout ou rien, rejets de promesses traités comme fatals. A10:2025 est entrée au Top 10 pour cette raison.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/routes/invoices.ts`](solutions/server/routes/invoices.ts)
</details>

<a id="max-safe-integer"></a>

### Au-delà de 2^53

**N2** · CWE-190 · D5 Implémentation · Kohnfelder K9

Le produit quantité × prix est calculé en nombre flottant : passé la limite des entiers sûrs, l’addition cesse d’incrémenter.

**Objectif.** Faire émettre une facture dont le total est inférieur au prix d’un seul article.

**Où.** `server/routes/invoices.ts`

**Dans le cours.**
- [Footguns JavaScript et argent](http://127.0.0.1:5173/#/modules/m02/l02) · [source](../src/content/m02/l02.mdx)
- [Invariants métier](http://127.0.0.1:5173/#/modules/m10/l06) · [source](../src/content/m10/l06.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Montants en centimes entiers ou en décimal exact, quantités bornées par le métier bien avant la limite du langage. Un total qui cesse de croître quand la quantité croît est un invariant testable.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/routes/invoices.ts`](solutions/server/routes/invoices.ts)
</details>

<a id="number-coercion"></a>

### Number() permissif sur les montants

**N1** · CWE-1287 · D5 Implémentation · Kohnfelder K9

Le montant est converti par `Number()`, qui accepte la notation exponentielle, l’hexadécimal, les espaces, et produit `Infinity` ou `NaN`.

**Objectif.** Persister une facture dont le total n’est ni fini ni comparable.

**Où.** `server/routes/invoices.ts`

**Dans le cours.**
- [Footguns JavaScript et argent](http://127.0.0.1:5173/#/modules/m02/l02) · [source](../src/content/m02/l02.mdx)
- [Erreurs, exceptions et atomicité](http://127.0.0.1:5173/#/modules/m02/l04) · [source](../src/content/m02/l04.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Le schéma dit ce qu’est un montant valide — entier, borné, fini — et le rejet est la seule autre issue. `Number()` n’est pas une validation, c’est une conversion qui réussit presque toujours.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/routes/invoices.ts`](solutions/server/routes/invoices.ts)
</details>

<a id="multistep-authz"></a>

### Autorisation sur une seule étape du flux

**N2** · CWE-841 · D5 Implémentation

L’émission d’un avoir se fait en trois requêtes ; seule la première vérifie le rôle comptable.

**Objectif.** Faire émettre un avoir validé sans jamais avoir eu le rôle comptable.

**Où.** `server/routes/credits.ts`

**Dans le cours.**
- [Entrées non fiables dans Express](http://127.0.0.1:5173/#/modules/m02/l01) · [source](../src/content/m02/l01.mdx)
- [Invariants métier](http://127.0.0.1:5173/#/modules/m10/l06) · [source](../src/content/m10/l06.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Chaque étape d’un flux est un endpoint public : elle vérifie le droit **et** l’état attendu. Un jeton d’étape signé, ou une machine à états côté serveur, rend l’ordre non contournable.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/routes/credits.ts`](solutions/server/routes/credits.ts)
</details>

<a id="dual-use-endpoint"></a>

### Endpoint à double usage mal isolé

**N2** · CWE-284 · D5 Implémentation

Une même route sert les réglages du tenant et ceux de la plateforme, discriminés par un champ du corps de la requête.

**Objectif.** Modifier un réglage global de la plateforme depuis un compte tenant ordinaire.

**Où.** `server/routes/settings.ts`

**Dans le cours.**
- [Entrées non fiables dans Express](http://127.0.0.1:5173/#/modules/m02/l01) · [source](../src/content/m02/l01.mdx)
- [Conception d’interfaces](http://127.0.0.1:5173/#/modules/m08/l07) · [source](../src/content/m08/l07.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Deux niveaux de privilège, deux routes, deux contrôles. Un champ du corps qui décide du périmètre est une décision d’autorisation prise par le client.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/routes/settings.ts`](solutions/server/routes/settings.ts)
</details>

<a id="eval-formula"></a>

### eval dans le calcul des pénalités

**N2** · CWE-95 · D5 Implémentation

La formule de pénalité de retard, configurable par le tenant, est évaluée avec `eval()` pour calculer le montant.

**Objectif.** Faire exécuter du JavaScript arbitraire côté serveur depuis la formule d’un tenant.

**Où.** `server/routes/settings.ts`

**Dans le cours.**
- [Spécificités Node.js](http://127.0.0.1:5173/#/modules/m02/l03) · [source](../src/content/m02/l03.mdx)
- [Éliminer une classe entière](http://127.0.0.1:5173/#/modules/m02/l09) · [source](../src/content/m02/l09.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Une expression métier n’a pas besoin d’un interpréteur complet : un mini-évaluateur à grammaire fermée (opérateurs et variables déclarés) suffit et ne peut rien faire d’autre. L’injection JS côté serveur est le A1 de NodeGoat.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/routes/settings.ts`](solutions/server/routes/settings.ts)
</details>

<a id="vm-escape"></a>

### node:vm n’est pas un bac à sable

**N3** · CWE-265 · D5 Implémentation

La même formule est « isolée » dans `vm.runInNewContext`, dont on s’échappe en remontant par `this.constructor.constructor`.

**Objectif.** Depuis la formule, lire une valeur du processus hôte hors du contexte — le secret de signature des jetons.

**Où.** `server/routes/settings.ts`

**Dans le cours.**
- [Spécificités Node.js](http://127.0.0.1:5173/#/modules/m02/l03) · [source](../src/content/m02/l03.mdx)
- [SSTI et injection de code](http://127.0.0.1:5173/#/modules/m03/l08) · [source](../src/content/m03/l08.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

`node:vm` isole les variables globales, pas les capacités : la documentation de Node le dit elle-même. Isolation par processus séparé, `isolated-vm`, ou pas d’exécution de code du tout. `vm2`, qui prétendait le contraire, est abandonné après une série d’évasions.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/routes/settings.ts`](solutions/server/routes/settings.ts)
</details>

<a id="cmd-injection"></a>

### Injection de commande dans l’export

**N2** · CWE-78 · D5 Implémentation

L’export comptable produit un PDF en appelant un binaire externe, avec un nom de fichier construit à partir du client.

**Objectif.** Faire exécuter une commande arbitraire par le serveur via le nom de l’export.

**Où.** `server/routes/export.ts`

**Dans le cours.**
- [Spécificités Node.js](http://127.0.0.1:5173/#/modules/m02/l03) · [source](../src/content/m02/l03.mdx)
- [Éliminer une classe entière](http://127.0.0.1:5173/#/modules/m02/l09) · [source](../src/content/m02/l09.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

`execFile` avec un tableau d’arguments plutôt qu’`exec` avec une chaîne : il n’y a plus de shell à échapper. Et le nom de fichier se génère côté serveur, il ne se reprend pas du client.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/routes/export.ts`](solutions/server/routes/export.ts)
</details>

<a id="csv-formula-injection"></a>

### Injection de formule dans l’export CSV

**N1** · CWE-1236 · D5 Implémentation

Le nom du client est écrit tel quel dans la cellule du CSV comptable, sans neutralisation.

**Objectif.** Obtenir un export dont une cellule commence par un caractère de formule, depuis un champ saisi dans l’application.

**Où.** `server/routes/export.ts`

**Dans le cours.**
- [Entrées non fiables dans Express](http://127.0.0.1:5173/#/modules/m02/l01) · [source](../src/content/m02/l01.mdx)
- [Classification des données](http://127.0.0.1:5173/#/modules/m07/l03) · [source](../src/content/m07/l03.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Le tableur du destinataire est un interpréteur : préfixer les cellules commençant par `=`, `+`, `-`, `@`, tabulation ou retour chariot, ou produire un format qui n’exécute rien. La vulnérabilité ne s’exécute pas chez toi — elle s’exécute chez ton client.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/routes/export.ts`](solutions/server/routes/export.ts)
</details>

<a id="xml-entity-expansion"></a>

### Expansion d’entités sur le même import

**N2** · CWE-776 · D5 Implémentation · D6 Tests · Kohnfelder K10

Aucune limite d’expansion ni de profondeur sur le parseur XML : un document de quelques kilo-octets en produit des gigaoctets.

**Objectif.** Faire dépasser au parseur le budget mémoire et temps que le serveur mesure sur la requête d’import.

**Où.** `server/routes/import.ts`

**Dans le cours.**
- [Entrées non fiables dans Express](http://127.0.0.1:5173/#/modules/m02/l01) · [source](../src/content/m02/l01.mdx)
- [Fuzzing et tests de disponibilité](http://127.0.0.1:5173/#/modules/m13/l05) · [source](../src/content/m13/l05.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Limites d’expansion, de profondeur et de taille fixées avant le parsing, et traitement hors de la boucle d’événements. La disponibilité est une exigence de sécurité : un parseur sans budget est un déni de service en attente.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/routes/import.ts`](solutions/server/routes/import.ts)
</details>

<a id="xxe-import"></a>

### XXE à l’import de facture électronique

**N2** · CWE-611 · D5 Implémentation · Kohnfelder K10

Le parseur XML des factures entrantes (format Factur-X) a les entités externes et le DOCTYPE activés.

**Objectif.** Faire apparaître le contenu d’un fichier local du serveur dans un champ de la facture créée.

**Où.** `server/routes/import.ts`

**Dans le cours.**
- [Entrées non fiables dans Express](http://127.0.0.1:5173/#/modules/m02/l01) · [source](../src/content/m02/l01.mdx)
- [Parser differentials et fuites via l’ORM](http://127.0.0.1:5173/#/modules/m03/l07) · [source](../src/content/m03/l07.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Entités externes et DOCTYPE désactivés par défaut dans le parseur — c’est un réglage, pas un filtrage. Le XML reste un format à surface large : si le besoin le permet, préférer un format sans entités ni références.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/routes/import.ts`](solutions/server/routes/import.ts)
</details>

<a id="zip-slip"></a>

### Zip Slip à l’import d’un lot de factures

**N2** · CWE-22 · D5 Implémentation

L’archive d’import est extraite en concaténant le nom de chaque entrée au dossier cible, sans normaliser ni vérifier le résultat.

**Objectif.** Faire écrire par le serveur un fichier hors du dossier d’import, et écraser la configuration d’un autre tenant.

**Où.** `server/routes/import.ts`

**Dans le cours.**
- [Spécificités Node.js](http://127.0.0.1:5173/#/modules/m02/l03) · [source](../src/content/m02/l03.mdx)
- [Patterns d’architecture](http://127.0.0.1:5173/#/modules/m08/l05) · [source](../src/content/m08/l05.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Le nom d’entrée d’une archive est une donnée d’attaquant comme une autre : `path.resolve` puis vérification du préfixe avec séparateur, et refus des entrées absolues comme des liens symboliques. Recherche Zip Slip (Snyk).

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/routes/import.ts`](solutions/server/routes/import.ts)
</details>

<a id="json-duplicate-keys"></a>

### Clés JSON dupliquées

**N2** · CWE-436 · D5 Implémentation · Kohnfelder K8

Le schéma valide le corps brut par une passe textuelle, puis l’analyseur JSON retient la dernière occurrence de chaque clé.

**Objectif.** Créer une ligne de facture dont le montant stocké est précisément celui que le schéma venait de refuser.

**Où.** `server/lib/validate.ts`

**Dans le cours.**
- [Entrées non fiables dans Express](http://127.0.0.1:5173/#/modules/m02/l01) · [source](../src/content/m02/l01.mdx)
- [Parser differentials et fuites via l’ORM](http://127.0.0.1:5173/#/modules/m03/l07) · [source](../src/content/m03/l07.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Valider l’objet **issu** du parsing, jamais le texte : deux analyseurs d’un même format ne sont jamais d’accord sur les cas limites. C’est la famille des parser differentials, appliquée au plus banal des formats.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/lib/validate.ts`](solutions/server/lib/validate.ts)
</details>

<a id="url-prefix-authz"></a>

### Contrôle d’accès par préfixe d’URL

**N2** · CWE-289 · D5 Implémentation

La protection des routes d’administration est montée sur un préfixe de chemin, que le routeur normalise après l’avoir comparé.

**Objectif.** Atteindre une route d’administration depuis un compte ordinaire, sans changer de rôle.

**Où.** `server/index.ts`

**Dans le cours.**
- [Entrées non fiables dans Express](http://127.0.0.1:5173/#/modules/m02/l01) · [source](../src/content/m02/l01.mdx)
- [Revue orientée autorisation](http://127.0.0.1:5173/#/modules/m12/l05) · [source](../src/content/m12/l05.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

L’autorisation ne se décide pas sur une chaîne d’URL : elle se décide sur la ressource et l’action, après résolution de la route. Casse, doubles séparateurs et encodages divergent toujours entre la comparaison et le routage.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/index.ts`](solutions/server/index.ts)
</details>

<a id="regex-unanchored"></a>

### Expression de validation non ancrée

**N1** · CWE-625 · D5 Implémentation · Kohnfelder K10

La liste blanche de domaines d’inscription teste une expression sans ancres : elle accepte tout ce qui *contient* le domaine.

**Objectif.** Créer un compte avec une adresse que la liste blanche devait refuser, et hériter de l’appartenance au tenant.

**Où.** `server/routes/auth.ts`

**Dans le cours.**
- [Entrées non fiables dans Express](http://127.0.0.1:5173/#/modules/m02/l01) · [source](../src/content/m02/l01.mdx)
- [Credential stuffing et prise de contrôle](http://127.0.0.1:5173/#/modules/m10/l02) · [source](../src/content/m10/l02.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Une expression de validation s’ancre (`^…$`), sinon elle décrit une sous-chaîne et non la valeur. Plus sûr encore : ne pas valider un domaine par expression, mais comparer la partie droite après un découpage explicite.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/routes/auth.ts`](solutions/server/routes/auth.ts)
</details>

<a id="unicode-normalization"></a>

### Normalisation après le contrôle d’unicité

**N2** · CWE-178 · D5 Implémentation · Kohnfelder K8

L’adresse est vérifiée comme unique, puis normalisée et mise en minuscules — ce qui la fait collisionner avec un compte existant.

**Objectif.** Créer un second compte qui résout vers l’adresse de l’administrateur, et recevoir un message qui lui était destiné.

**Où.** `server/routes/auth.ts`

**Dans le cours.**
- [Footguns JavaScript et argent](http://127.0.0.1:5173/#/modules/m02/l02) · [source](../src/content/m02/l02.mdx)
- [Parser differentials et fuites via l’ORM](http://127.0.0.1:5173/#/modules/m03/l07) · [source](../src/content/m03/l07.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Normaliser **avant** de comparer, une seule fois, et stocker la forme normalisée. Les pièges classiques : le İ turc sous `toLowerCase`, les équivalences NFKC, les caractères invisibles. Deux couches qui normalisent différemment, c’est une faille d’authentification.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/routes/auth.ts`](solutions/server/routes/auth.ts)
</details>

<a id="try-catch-fail-open"></a>

### Le catch qui échoue ouvert

**N2** · CWE-636 · D5 Implémentation · Kohnfelder K13

L’appel au moteur d’autorisation est enveloppé dans un `catch` vide, et l’exécution continue comme si l’accès était accordé.

**Objectif.** Provoquer l’exception par une entrée malformée, puis lire une ressource d’un autre tenant.

**Où.** `server/lib/auth.ts`

**Dans le cours.**
- [Erreurs, exceptions et atomicité](http://127.0.0.1:5173/#/modules/m02/l04) · [source](../src/content/m02/l04.mdx)
- [Revue orientée autorisation](http://127.0.0.1:5173/#/modules/m12/l05) · [source](../src/content/m12/l05.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Un contrôle qui ne sait pas répondre doit refuser : l’échec sûr est le comportement par défaut, pas une option. Et un `catch` vide dans un chemin d’autorisation est un motif que Semgrep trouve en une règle.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/lib/auth.ts`](solutions/server/lib/auth.ts)
</details>

<a id="input-truncation"></a>

### Troncature après validation

**N2** · CWE-1284 · D5 Implémentation · Kohnfelder K10

L’adresse est validée, puis tronquée à la longueur de la colonne — ce qui change le domaine et donc le tenant de rattachement.

**Objectif.** S’inscrire et se retrouver rattaché au tenant d’un autre, avec ses droits.

**Où.** `server/routes/auth.ts`

**Dans le cours.**
- [Erreurs, exceptions et atomicité](http://127.0.0.1:5173/#/modules/m02/l04) · [source](../src/content/m02/l04.mdx)
- [Exigences et abuse cases](http://127.0.0.1:5173/#/modules/m07/l01) · [source](../src/content/m07/l01.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Toute transformation postérieure à la validation invalide la validation. Longueurs contraintes par le schéma d’entrée, jamais par la base, et le rejet plutôt que la correction silencieuse.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/routes/auth.ts`](solutions/server/routes/auth.ts)
</details>

<a id="timing-attack"></a>

### Comparaison de jeton à temps variable

**N2** · CWE-208 · D5 Implémentation · Kohnfelder K8

Le jeton de réinitialisation est comparé avec `===`, qui s’arrête au premier octet différent.

**Objectif.** Retrouver un jeton de réinitialisation octet par octet, en mesurant le temps de réponse.

**Où.** `server/routes/auth.ts`

**Dans le cours.**
- [Erreurs, exceptions et atomicité](http://127.0.0.1:5173/#/modules/m02/l04) · [source](../src/content/m02/l04.mdx)
- [Crypto pour développeurs](http://127.0.0.1:5173/#/modules/m08/l08) · [source](../src/content/m08/l08.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

`crypto.timingSafeEqual` sur des tampons de longueur fixe, ou comparaison d’empreintes plutôt que de secrets. Et un jeton assez court-vécu pour que la mesure n’ait pas le temps d’aboutir.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/routes/auth.ts`](solutions/server/routes/auth.ts)
</details>

## M9 · Web avancé

<a id="race-credit"></a>

### Race condition : l’avoir dépensé deux fois

**N2** · CWE-362 · D5 Implémentation

L’application d’un avoir lit le solde, vérifie qu’il est suffisant, puis débite. Il y a un await entre la vérification et l’écriture.

**Objectif.** Consommer plus que le solde de ton avoir en le dépensant plusieurs fois en parallèle.

**Où.** `server/routes/credits.ts`

**Dans le cours.**
- [Race conditions](http://127.0.0.1:5173/#/modules/m03/l01) · [source](../src/content/m03/l01.mdx)
- [Erreurs, exceptions et atomicité](http://127.0.0.1:5173/#/modules/m02/l04) · [source](../src/content/m02/l04.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Rendre l’opération atomique : contrainte unique, transaction avec SELECT … FOR UPDATE, update conditionnel (WHERE solde >= montant), opérateur atomique Mongo, ou clé d’idempotence. Le correctif est dans la base, pas dans le code applicatif.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/routes/credits.ts`](solutions/server/routes/credits.ts)
</details>

<a id="host-header"></a>

### Empoisonnement du lien de réinitialisation

**N2** · CWE-640 · D5 Implémentation

Le mail de réinitialisation construit son lien absolu à partir de l’en-tête Host de la requête, « pour marcher dans tous les environnements ».

**Objectif.** Provoquer un mail de réinitialisation pour admin@novafact.example dont le lien pointe vers un domaine que tu contrôles.

**Où.** `server/routes/auth.ts`

**Dans le cours.**
- [En-tête Host](http://127.0.0.1:5173/#/modules/m03/l02) · [source](../src/content/m03/l02.mdx)
- [Authentification applicative](http://127.0.0.1:5173/#/modules/m09/l01) · [source](../src/content/m09/l01.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

L’URL publique vient de la configuration, jamais de la requête. Si un en-tête doit être lu, liste blanche d’hôtes attendus et trust proxy réglé au nombre exact de proxys.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/routes/auth.ts`](solutions/server/routes/auth.ts)
</details>

<a id="jwt-decode"></a>

### JWT : décoder n’est pas vérifier

**N2** · CWE-347 · D1 Concepts · D5 Implémentation

Le middleware d’API lit les revendications du jeton avec un décodage sans vérification, et accepte l’algorithme annoncé par le jeton.

**Objectif.** Obtenir une réponse de GET /api/admin/audit avec un jeton que tu as forgé toi-même.

**Où.** `server/lib/jwt.ts`

**Dans le cours.**
- [Valider un JWT dans Express](http://127.0.0.1:5173/#/modules/m09/l05) · [source](../src/content/m09/l05.mdx)
- [Protocoles d’authentification avancés](http://127.0.0.1:5173/#/modules/m03/l10) · [source](../src/content/m03/l10.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

verify() avec la liste d’algorithmes attendue fixée côté serveur, et contrôle de iss / aud / exp. Ne jamais lire de revendication avant vérification de la signature (RFC 8725).

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/lib/jwt.ts`](solutions/server/lib/jwt.ts)
</details>

<a id="cache-poison"></a>

### Empoisonnement du cache par une entrée hors clé

**N3** · CWE-444 · D5 Implémentation · D7 Déploiement & exploitation

Le lab place un cache devant /api/branding. La clé de cache est l’URL ; la réponse, elle, reflète un en-tête.

**Objectif.** Empoisonner l’entrée de cache de /api/branding pour qu’elle serve ta charge utile à la requête suivante, faite sans ton en-tête.

**Où.** `server/routes/branding.ts`

**Dans le cours.**
- [Cache poisoning et cache deception](http://127.0.0.1:5173/#/modules/m03/l06) · [source](../src/content/m03/l06.mdx)
- [Parser differentials et fuites via l’ORM](http://127.0.0.1:5173/#/modules/m03/l07) · [source](../src/content/m03/l07.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Ne jamais refléter une entrée hors clé dans une réponse mise en cache. Clé de cache conçue explicitement (Vary maîtrisé, politique CloudFront), Cache-Control: private sur tout ce qui dépend de l’utilisateur.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/routes/branding.ts`](solutions/server/routes/branding.ts)
</details>

<a id="orm-leak"></a>

### Fuite par l’ORM sur un filtre

**N3** · CWE-200 · D5 Implémentation

Le filtre de recherche est passé à l’ORM presque tel quel, et les relations jointes reviennent en entier.

**Objectif.** Lire, via une relation, un champ qu’aucune route n’expose — l’empreinte du mot de passe d’un utilisateur.

**Où.** `server/routes/invoices.ts`

**Dans le cours.**
- [Parser differentials et fuites via l’ORM](http://127.0.0.1:5173/#/modules/m03/l07) · [source](../src/content/m03/l07.mdx)
- [Classification des données](http://127.0.0.1:5173/#/modules/m07/l03) · [source](../src/content/m07/l03.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Sélection explicite des champs, jamais d’inclusion d’une relation entière. Le filtre accepté est une liste blanche d’opérateurs et de colonnes, pas l’objet du client. *ORM Leaking More Than You Joined For*, Top 10 2025.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/routes/invoices.ts`](solutions/server/routes/invoices.ts)
</details>

<a id="qs-type-confusion"></a>

### Confusion de type sur la query string

**N2** · CWE-843 · D5 Implémentation · Kohnfelder K8

La syntaxe de tableau de la query string transforme une chaîne attendue en tableau, qui traverse une validation fondée sur la longueur et atterrit dans le filtre de recherche.

**Objectif.** Faire remonter dans la recherche des factures d’un tenant auquel tu n’appartiens pas.

**Où.** `server/routes/invoices.ts`

**Dans le cours.**
- [Parser differentials et fuites via l’ORM](http://127.0.0.1:5173/#/modules/m03/l07) · [source](../src/content/m03/l07.mdx)
- [Entrées non fiables dans Express](http://127.0.0.1:5173/#/modules/m02/l01) · [source](../src/content/m02/l01.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Valider le **type** avant tout le reste, par schéma : `typeof` et `.length` mentent sur un tableau. Et configurer l’analyseur de query string pour qu’il ne fabrique ni tableaux ni objets imbriqués quand on n’en attend pas.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/routes/invoices.ts`](solutions/server/routes/invoices.ts)
</details>

<a id="race-multi-endpoint"></a>

### Course entre paiement et annulation

**N2** · CWE-362 · D5 Implémentation

La confirmation de paiement et l’annulation lisent puis écrivent l’état de la facture, chacune dans son coin, sans verrou.

**Objectif.** Obtenir une facture simultanément payée et remboursée — deux états qui s’excluent.

**Où.** `server/routes/invoices.ts`

**Dans le cours.**
- [Race conditions](http://127.0.0.1:5173/#/modules/m03/l01) · [source](../src/content/m03/l01.mdx)
- [Chaînes de vulnérabilités](http://127.0.0.1:5173/#/modules/m03/l04) · [source](../src/content/m03/l04.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Une transition d’état est une écriture conditionnelle unique (`WHERE status = ?`), pas une lecture suivie d’une écriture. Les courses multi-endpoints se ferment dans la base, jamais dans le code applicatif.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/routes/invoices.ts`](solutions/server/routes/invoices.ts)
</details>

<a id="vary-missing"></a>

### Réponse authentifiée mise en cache

**N2** · CWE-524 · D5 Implémentation · D7 Déploiement & exploitation

La liste des factures est mise en cache sans `Vary` sur l’identité ni `Cache-Control: private`.

**Objectif.** Obtenir la liste des factures d’un autre tenant sans présenter le moindre jeton.

**Où.** `server/routes/invoices.ts`

**Dans le cours.**
- [Cache poisoning et cache deception](http://127.0.0.1:5173/#/modules/m03/l06) · [source](../src/content/m03/l06.mdx)
- [En-têtes en production](http://127.0.0.1:5173/#/modules/m17/l05) · [source](../src/content/m17/l05.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Ce qui dépend de l’appelant ne se met pas en cache partagé : `private`, et une clé de cache conçue explicitement. `Vary` est un correctif fragile — il fragmente le cache sans supprimer la cause.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/routes/invoices.ts`](solutions/server/routes/invoices.ts)
</details>

<a id="toctou-upload"></a>

### TOCTOU sur le téléversement

**N2** · CWE-367 · D5 Implémentation · Kohnfelder K8

Le fichier est écrit sur disque et rendu accessible, puis validé et supprimé s’il ne convient pas.

**Objectif.** Télécharger le contenu d’un fichier que la validation a ensuite refusé.

**Où.** `server/routes/attachments.ts`

**Dans le cours.**
- [Race conditions](http://127.0.0.1:5173/#/modules/m03/l01) · [source](../src/content/m03/l01.mdx)
- [Patterns d’architecture](http://127.0.0.1:5173/#/modules/m08/l05) · [source](../src/content/m08/l05.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Valider avant de rendre disponible : écriture dans un emplacement non servi, validation, puis publication atomique. Entre le contrôle et l’usage, tout peut arriver — c’est la définition du TOCTOU.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/routes/attachments.ts`](solutions/server/routes/attachments.ts)
</details>

<a id="cache-deception-pdf"></a>

### Cache deception sur le PDF de facture

**N3** · CWE-525 · D5 Implémentation · D7 Déploiement & exploitation

Le cache décide de stocker sur l’extension du chemin ; l’origine, elle, ignore le suffixe et sert la facture authentifiée.

**Objectif.** Récupérer dans le cache, sans session, le PDF d’une facture d’un autre tenant.

**Où.** `server/routes/export.ts`

**Dans le cours.**
- [Cache poisoning et cache deception](http://127.0.0.1:5173/#/modules/m03/l06) · [source](../src/content/m03/l06.mdx)
- [Plateformes AWS](http://127.0.0.1:5173/#/modules/m17/l04) · [source](../src/content/m17/l04.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Les deux couches doivent lire le chemin pareil : normalisation identique, `Cache-Control: private` sur tout ce qui dépend de l’utilisateur, et pas de stockage décidé sur une extension devinée. *Gotta cache ’em all*, 2024.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/routes/export.ts`](solutions/server/routes/export.ts)
</details>

<a id="ssrf-pdf-renderer"></a>

### SSRF par le générateur de PDF

**N3** · CWE-918 · D5 Implémentation

Le PDF de facture est rendu depuis du HTML dont le tenant contrôle un bloc, et le moteur de rendu accepte les schémas locaux et les cadres.

**Objectif.** Faire apparaître dans le PDF produit le contenu d’un fichier local du serveur.

**Où.** `server/routes/export.ts`

**Dans le cours.**
- [SSRF avancée](http://127.0.0.1:5173/#/modules/m03/l11) · [source](../src/content/m03/l11.mdx)
- [Patterns d’architecture](http://127.0.0.1:5173/#/modules/m08/l05) · [source](../src/content/m08/l05.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Un moteur de rendu HTML est un navigateur : il fait des requêtes. Rendu dans un processus isolé, sans accès réseau ni système de fichiers, à partir d’un gabarit dont les données sont échappées.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/routes/export.ts`](solutions/server/routes/export.ts)
</details>

<a id="ssti-render-options"></a>

### SSTI par les options de rendu

**N3** · CWE-94 · D5 Implémentation

Les paramètres de requête sont étalés dans les options de rendu de la vue, ce qui laisse le client injecter une option de compilation du moteur.

**Objectif.** Obtenir une exécution de code serveur sans jamais toucher au contenu du gabarit.

**Où.** `server/routes/export.ts`

**Dans le cours.**
- [SSTI et injection de code](http://127.0.0.1:5173/#/modules/m03/l08) · [source](../src/content/m03/l08.mdx)
- [Entrées non fiables dans Express](http://127.0.0.1:5173/#/modules/m02/l01) · [source](../src/content/m02/l01.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Ne jamais étaler `req.query` ni `req.body` dans un objet d’options : les options de configuration d’un moteur sont aussi dangereuses que son gabarit. CVE-2022-29078 (EJS) repose exactement là-dessus.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/routes/export.ts`](solutions/server/routes/export.ts)
</details>

<a id="deserialization"></a>

### Désérialisation de types arbitraires

**N3** · CWE-502 · D5 Implémentation · Kohnfelder K8

L’import d’un modèle de facture accepte un format qui reconstruit des objets typés.

**Objectif.** Obtenir une exécution de code en important un modèle forgé.

**Où.** `server/routes/templates.ts`

**Dans le cours.**
- [Désérialisation et prototype pollution avancées](http://127.0.0.1:5173/#/modules/m03/l09) · [source](../src/content/m03/l09.mdx)
- [Choisir un composant](http://127.0.0.1:5173/#/modules/m14/l06) · [source](../src/content/m14/l06.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Des formats qui n’acceptent jamais de types arbitraires : JSON avec schéma strict, `js-yaml` en schéma sûr. La désérialisation reconstruit des données, pas des objets vivants.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/routes/templates.ts`](solutions/server/routes/templates.ts)
</details>

<a id="ssti-email-template"></a>

### SSTI dans le gabarit de relance

**N3** · CWE-1336 · D5 Implémentation

Le gabarit d’e-mail éditable par le tenant est compilé par le moteur de template : l’entrée arrive dans la partie *gabarit*, pas dans les données.

**Objectif.** Faire apparaître dans le message rendu une valeur du processus serveur — le secret de signature des jetons.

**Où.** `server/routes/templates.ts`

**Dans le cours.**
- [SSTI et injection de code](http://127.0.0.1:5173/#/modules/m03/l08) · [source](../src/content/m03/l08.mdx)
- [Conception d’interfaces](http://127.0.0.1:5173/#/modules/m08/l07) · [source](../src/content/m08/l07.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Un template fourni par l’utilisateur est du code. Moteur sans logique (Mustache strict), liste de variables autorisées, et rendu dans un processus séparé. La donnée va dans le contexte, jamais dans le gabarit.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/routes/templates.ts`](solutions/server/routes/templates.ts)
</details>

<a id="param-pollution"></a>

### Pollution de paramètres côté serveur

**N2** · CWE-235 · D5 Implémentation

La recherche de clients relaie la requête vers une API interne en concaténant les paramètres reçus.

**Objectif.** Injecter un paramètre supplémentaire dans l’appel interne pour obtenir des champs non prévus.

**Où.** `server/routes/clients.ts`

**Dans le cours.**
- [API avancée et GraphQL](http://127.0.0.1:5173/#/modules/m03/l03) · [source](../src/content/m03/l03.mdx)
- [Conception d’interfaces](http://127.0.0.1:5173/#/modules/m08/l07) · [source](../src/content/m08/l07.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Construire la requête sortante à partir de valeurs validées, avec un encodeur, jamais par concaténation. Les appels internes sont une surface d’attaque au même titre que l’API publique.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/routes/clients.ts`](solutions/server/routes/clients.ts)
</details>

<a id="content-type-confusion"></a>

### Confusion de Content-Type sur une mutation

**N2** · CWE-352 · D5 Implémentation

La route accepte JSON et formulaire encodé, mais la vérification anti-CSRF ne s’applique qu’à la branche JSON.

**Objectif.** Modifier l’IBAN de facturation d’un utilisateur connecté depuis une page d’une autre origine.

**Où.** `server/index.ts`

**Dans le cours.**
- [Parser differentials et fuites via l’ORM](http://127.0.0.1:5173/#/modules/m03/l07) · [source](../src/content/m03/l07.mdx)
- [React et le navigateur](http://127.0.0.1:5173/#/modules/m04/l02) · [source](../src/content/m04/l02.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Un contrôle qui dépend du format d’entrée a autant de trous que de formats acceptés. N’accepter qu’un format par route, et faire porter la défense CSRF par le cookie (`SameSite`) et Fetch Metadata plutôt que par un jeton conditionnel.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/index.ts`](solutions/server/index.ts)
</details>

<a id="graphql-introspection"></a>

### GraphQL : introspection et coût

**N2** · CWE-200 · D5 Implémentation

L’API GraphQL interne est exposée au front avec l’introspection active et sans limite de profondeur ni de coût.

**Objectif.** Cartographier le schéma, puis faire tomber le serveur avec une requête profondément imbriquée.

**Où.** `server/routes/graphql.ts`

**Dans le cours.**
- [API avancée et GraphQL](http://127.0.0.1:5173/#/modules/m03/l03) · [source](../src/content/m03/l03.mdx)
- [Fuzzing et tests de disponibilité](http://127.0.0.1:5173/#/modules/m13/l05) · [source](../src/content/m13/l05.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Introspection désactivée hors développement, budget de complexité calculé avant exécution, profondeur bornée. Et l’autorisation vérifiée dans chaque résolveur, pas à l’entrée du point d’accès.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/routes/graphql.ts`](solutions/server/routes/graphql.ts)
</details>

<a id="graphql-clairvoyance"></a>

### GraphQL : reconstruire le schéma sans introspection

**N3** · CWE-209 · D5 Implémentation

L’introspection est coupée, mais les suggestions « vouliez-vous dire… » des messages d’erreur permettent de reconstituer le schéma champ par champ.

**Objectif.** Lire la valeur d’un champ non documenté en le devinant à partir des seuls messages d’erreur.

**Où.** `server/routes/graphql.ts`

**Dans le cours.**
- [API avancée et GraphQL](http://127.0.0.1:5173/#/modules/m03/l03) · [source](../src/content/m03/l03.mdx)
- [Erreurs, exceptions et atomicité](http://127.0.0.1:5173/#/modules/m02/l04) · [source](../src/content/m02/l04.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Désactiver les suggestions en production et renvoyer des erreurs génériques : couper l’introspection sans couper les suggestions ne fait que ralentir la cartographie. L’obscurité n’est de toute façon pas le contrôle — l’autorisation par résolveur l’est.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/routes/graphql.ts`](solutions/server/routes/graphql.ts)
</details>

<a id="graphql-csrf"></a>

### CSRF sur le point d’accès GraphQL

**N2** · CWE-352 · D5 Implémentation

Le point d’accès GraphQL accepte un formulaire encodé, ce qui rend les mutations atteignables depuis une page tierce.

**Objectif.** Changer l’adresse de facturation d’un utilisateur connecté depuis une autre origine.

**Où.** `server/routes/graphql.ts`

**Dans le cours.**
- [API avancée et GraphQL](http://127.0.0.1:5173/#/modules/m03/l03) · [source](../src/content/m03/l03.mdx)
- [React et le navigateur](http://127.0.0.1:5173/#/modules/m04/l02) · [source](../src/content/m04/l02.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

N’accepter que `application/json` sur le point d’accès — un type que le navigateur ne peut pas envoyer en formulaire simple sans contrôle préalable — et refuser les mutations en `GET`.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/routes/graphql.ts`](solutions/server/routes/graphql.ts)
</details>

<a id="ssrf-redirect-bypass"></a>

### SSRF par redirection

**N3** · CWE-918 · D5 Implémentation · D7 Déploiement & exploitation

L’URL de webhook est validée contre une liste blanche, puis le client HTTP suit les redirections sans revalider la destination.

**Objectif.** Faire atteindre au serveur une route d’administration sur sa propre boucle locale, et en obtenir l’effet.

**Où.** `server/routes/webhooks.ts`

**Dans le cours.**
- [SSRF avancée](http://127.0.0.1:5173/#/modules/m03/l11) · [source](../src/content/m03/l11.mdx)
- [Workloads Node.js](http://127.0.0.1:5173/#/modules/m15/l03) · [source](../src/content/m15/l03.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Vérifier l’adresse **après chaque** résolution et chaque redirection, ou interdire les redirections. Une liste blanche évaluée une seule fois, au début, ne protège que la première requête.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/routes/webhooks.ts`](solutions/server/routes/webhooks.ts)
</details>

<a id="graphql-batching"></a>

### GraphQL : force brute par alias

**N2** · CWE-307 · D5 Implémentation

Le code de validation est vérifié par une mutation GraphQL, et la limitation de débit compte les requêtes HTTP.

**Objectif.** Tester des milliers de codes en une seule requête HTTP.

**Où.** `server/routes/graphql.ts`

**Dans le cours.**
- [API avancée et GraphQL](http://127.0.0.1:5173/#/modules/m03/l03) · [source](../src/content/m03/l03.mdx)
- [Limitation de débit bien conçue](http://127.0.0.1:5173/#/modules/m10/l03) · [source](../src/content/m10/l03.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Compter les opérations, pas les requêtes : désactiver le batching sur les mutations sensibles et limiter par compte. Une limite qui compte la mauvaise unité ne limite rien.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/routes/graphql.ts`](solutions/server/routes/graphql.ts)
</details>

<a id="race-partial-construction"></a>

### Course à la construction du compte

**N3** · CWE-362 · D5 Implémentation

Le compte est inséré, puis son empreinte de mot de passe écrite dans un second temps. Pendant la fenêtre, le champ est vide et la comparaison le laisse passer.

**Objectif.** Se connecter à un compte pendant sa création, sans en connaître le mot de passe.

**Où.** `server/routes/auth.ts`

**Dans le cours.**
- [Race conditions](http://127.0.0.1:5173/#/modules/m03/l01) · [source](../src/content/m03/l01.mdx)
- [Authentification applicative](http://127.0.0.1:5173/#/modules/m09/l01) · [source](../src/content/m09/l01.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Un enregistrement à moitié construit est visible : créer en une transaction, ou insérer d’abord dans un état inutilisable. Et une comparaison de mot de passe refuse une valeur absente au lieu de l’accepter. *Partial construction*, Smashing the state machine.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/routes/auth.ts`](solutions/server/routes/auth.ts)
</details>

<a id="reset-token-collision"></a>

### Jetons de réinitialisation collidants

**N2** · CWE-330 · D5 Implémentation · Kohnfelder K5

Le jeton est dérivé de l’horloge et d’un générateur non cryptographique : deux demandes dans la même milliseconde produisent le même jeton.

**Objectif.** Obtenir un jeton valide pour le compte d’un autre utilisateur en déclenchant deux réinitialisations simultanées.

**Où.** `server/routes/auth.ts`

**Dans le cours.**
- [Race conditions](http://127.0.0.1:5173/#/modules/m03/l01) · [source](../src/content/m03/l01.mdx)
- [Crypto pour développeurs](http://127.0.0.1:5173/#/modules/m08/l08) · [source](../src/content/m08/l08.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Un jeton vient d’un générateur cryptographique, et rien d’autre. L’unicité se garantit par une contrainte en base, pas par l’espoir que deux appels ne tombent pas au même instant.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/routes/auth.ts`](solutions/server/routes/auth.ts)
</details>

<a id="email-parsing-differential"></a>

### Différentiel d’analyse d’adresse

**N3** · CWE-436 · D5 Implémentation

L’appartenance au tenant est déduite par un découpage naïf sur l’arobase, alors que la couche d’envoi lit un autre domaine dans la même adresse.

**Objectif.** Faire reconnaître comme membre du tenant Novafact une adresse dont le courrier part ailleurs.

**Où.** `server/routes/auth.ts`

**Dans le cours.**
- [Parser differentials et fuites via l’ORM](http://127.0.0.1:5173/#/modules/m03/l07) · [source](../src/content/m03/l07.mdx)
- [Attaques OAuth et OIDC](http://127.0.0.1:5173/#/modules/m09/l06) · [source](../src/content/m09/l06.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Deux composants qui analysent la même chaîne différemment forment une faille d’autorisation. Une seule bibliothèque d’analyse, une forme canonique stockée, et l’appartenance au tenant décidée par une invitation — pas devinée depuis un domaine. *Splitting the email atom*, 2024.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/routes/auth.ts`](solutions/server/routes/auth.ts)
</details>

<a id="cookie-deserialization"></a>

### Cookie de préférences désérialisé

**N3** · CWE-502 · D5 Implémentation · Kohnfelder K8

Les préférences sont un objet sérialisé, signé avec une clé faible, puis désérialisé sans liste de types autorisés.

**Objectif.** Forger un cookie qui, à la désérialisation, élève le rôle de son porteur.

**Où.** `server/lib/auth.ts`

**Dans le cours.**
- [Désérialisation et prototype pollution avancées](http://127.0.0.1:5173/#/modules/m03/l09) · [source](../src/content/m03/l09.mdx)
- [Crypto pour développeurs](http://127.0.0.1:5173/#/modules/m08/l08) · [source](../src/content/m08/l08.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Un format qui reconstruit des objets typés ne se met pas dans un cookie. JSON avec schéma strict, état côté serveur, et signature avec une clé issue d’un générateur cryptographique. La signature ne sauve pas un format dangereux — elle retarde seulement.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/lib/auth.ts`](solutions/server/lib/auth.ts)
</details>

<a id="jwt-kid-traversal"></a>

### JWT : kid en traversée de chemin

**N3** · CWE-22 · D1 Concepts · D5 Implémentation

L’en-tête `kid` du jeton désigne le fichier de clé à charger, sans normalisation du chemin.

**Objectif.** Forger un jeton accepté comme administrateur, en pointant l’identifiant de clé vers un fichier au contenu prévisible.

**Où.** `server/lib/jwt.ts`

**Dans le cours.**
- [Protocoles d’authentification avancés](http://127.0.0.1:5173/#/modules/m03/l10) · [source](../src/content/m03/l10.mdx)
- [Valider un JWT dans Express](http://127.0.0.1:5173/#/modules/m09/l05) · [source](../src/content/m09/l05.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

`kid` est un identifiant opaque : il sert à chercher dans un trousseau, jamais à construire un chemin ni une requête. Les clés viennent d’un JWKS connu d’avance.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/lib/jwt.ts`](solutions/server/lib/jwt.ts)
</details>

<a id="jwt-jku-jwk"></a>

### JWT : jku et jwk honorés

**N3** · CWE-347 · D1 Concepts · D5 Implémentation

Le vérificateur récupère la clé publique à l’URL indiquée dans le jeton, ou l’accepte directement en en-tête.

**Objectif.** Forger un jeton signé avec ta propre paire de clés et être accepté comme un autre utilisateur.

**Où.** `server/lib/jwt.ts`

**Dans le cours.**
- [Protocoles d’authentification avancés](http://127.0.0.1:5173/#/modules/m03/l10) · [source](../src/content/m03/l10.mdx)
- [Valider un JWT dans Express](http://127.0.0.1:5173/#/modules/m09/l05) · [source](../src/content/m09/l05.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Le jeton ne choisit jamais sa clé de vérification : le serveur connaît son JWKS, son émetteur et ses algorithmes. RFC 8725, qui dit exactement cela.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/lib/jwt.ts`](solutions/server/lib/jwt.ts)
</details>

<a id="jwt-no-audience"></a>

### Jeton valable d’un tenant à l’autre

**N2** · CWE-863 · D1 Concepts · D5 Implémentation

Tous les tenants partagent la clé de signature, et le jeton ne porte aucune revendication d’audience ni d’émetteur.

**Objectif.** Présenter sur l’API d’un tenant un jeton émis pour un autre, et y agir.

**Où.** `server/lib/jwt.ts`

**Dans le cours.**
- [Protocoles d’authentification avancés](http://127.0.0.1:5173/#/modules/m03/l10) · [source](../src/content/m03/l10.mdx)
- [Valider un JWT dans Express](http://127.0.0.1:5173/#/modules/m09/l05) · [source](../src/content/m09/l05.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Vérifier `iss` et `aud` fait partie de la vérification, au même titre que la signature : une signature valide prouve l’origine, pas la destination. Et une clé par périmètre quand les périmètres sont distincts.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/lib/jwt.ts`](solutions/server/lib/jwt.ts)
</details>

<a id="session-not-revocable"></a>

### Session qu’on ne peut pas révoquer

**N2** · CWE-613 · D1 Concepts · D5 Implémentation

La déconnexion efface le cookie côté client ; le jeton reste valide, et son expiration n’est pas vérifiée côté serveur.

**Objectif.** Réutiliser un jeton après déconnexion, et au-delà de sa date d’expiration.

**Où.** `server/lib/jwt.ts`

**Dans le cours.**
- [Protocoles d’authentification avancés](http://127.0.0.1:5173/#/modules/m03/l10) · [source](../src/content/m03/l10.mdx)
- [SPA : RFC 10017 et BFF](http://127.0.0.1:5173/#/modules/m09/l04) · [source](../src/content/m09/l04.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Un jeton sans état ne se révoque pas : durée de vie courte, rotation du jeton de rafraîchissement, et liste de révocation pour les cas qui comptent (changement de mot de passe, compromission). Se déconnecter doit avoir un effet côté serveur.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/lib/jwt.ts`](solutions/server/lib/jwt.ts)
</details>

## M8 · Vulnérabilités côté client & scripts tiers

<a id="dom-xss"></a>

### XSS stockée dans la note de facture

**N1** · CWE-79 · D5 Implémentation · Kohnfelder K11

Les notes de facture acceptent du Markdown, rendu par un convertisseur maison puis injecté avec dangerouslySetInnerHTML.

**Objectif.** Faire exécuter du script dans le navigateur d’un autre utilisateur qui consulte la facture — le lab détecte l’exécution.

**Où.** `src/pages/InvoiceDetail.tsx`

**Dans le cours.**
- [React et le navigateur](http://127.0.0.1:5173/#/modules/m04/l02) · [source](../src/content/m04/l02.mdx)
- [Trusted Types et Sanitizer API](http://127.0.0.1:5173/#/modules/m04/l06) · [source](../src/content/m04/l06.mdx)
- [CSP stricte en pratique](http://127.0.0.1:5173/#/modules/m04/l05) · [source](../src/content/m04/l05.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Laisser React échapper (pas de dangerouslySetInnerHTML), ou assainir avec DOMPurify / la Sanitizer API avant rendu. Puis CSP stricte avec nonce et Trusted Types comme deuxième barrière.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/src/pages/InvoiceDetail.tsx`](solutions/src/pages/InvoiceDetail.tsx)
</details>

<a id="third-party-script"></a>

### Script tiers piloté par la configuration

**N2** · CWE-829 · D4 Architecture · D8 Supply chain · Kohnfelder K4

Le tag manager charge son script depuis une URL stockée dans les réglages du tenant, modifiable par n’importe quel utilisateur du tenant. C’est l’anti-pattern « third-party hooks » de Kohnfelder.

**Objectif.** Faire charger par la page de paiement un script d’une origine que tu choisis, et qu’il s’exécute.

**Où.** `src/pages/Checkout.tsx`

**Dans le cours.**
- [Scripts tiers](http://127.0.0.1:5173/#/modules/m04/l03) · [source](../src/content/m04/l03.mdx)
- [Réduire la confiance](http://127.0.0.1:5173/#/modules/m04/l04) · [source](../src/content/m04/l04.mdx)
- [PCI DSS 4.0.1 : 6.4.3 et 11.6.1](http://127.0.0.1:5173/#/modules/m04/l08) · [source](../src/content/m04/l08.mdx)
- [Les 4 anti-patterns](http://127.0.0.1:5173/#/modules/m08/l04) · [source](../src/content/m08/l04.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Inventaire et propriétaire par script, origines en liste blanche dans la CSP (pas de configuration qui pilote une origine), SRI, auto-hébergement, et isolation du paiement dans l’iframe du prestataire (PCI DSS 6.4.3).

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/src/pages/Checkout.tsx`](solutions/src/pages/Checkout.tsx)
</details>

<a id="attachment-same-origin"></a>

### Pièce jointe servie sur l’origine de l’application

**N2** · CWE-79 · D4 Architecture · D5 Implémentation

Les pièces jointes sont servies depuis l’origine de Novafact, sans en-tête de non-reniflage ni disposition de téléchargement, avec un type deviné.

**Objectif.** Exécuter du script sur l’origine de Novafact dans la session d’un utilisateur qui ouvre une pièce jointe.

**Où.** `server/routes/attachments.ts`

**Dans le cours.**
- [Isolation d’origine](http://127.0.0.1:5173/#/modules/m04/l07) · [source](../src/content/m04/l07.mdx)
- [Patterns d’architecture](http://127.0.0.1:5173/#/modules/m08/l05) · [source](../src/content/m08/l05.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Servir depuis une origine distincte — c’est la seule défense complète —, sinon `Content-Disposition: attachment`, `X-Content-Type-Options: nosniff`, type déduit du contenu. Un fichier téléversé est du contenu d’attaquant hébergé par toi.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/routes/attachments.ts`](solutions/server/routes/attachments.ts)
</details>

<a id="svg-logo"></a>

### Logo SVG exécutable

**N2** · CWE-79 · D4 Architecture · D5 Implémentation

Le logo du tenant accepte le format SVG et le sert tel quel, avec ses scripts et ses gestionnaires d’événements.

**Objectif.** Exécuter du script dans la session d’un administrateur plateforme qui consulte la fiche du tenant.

**Où.** `server/routes/attachments.ts`

**Dans le cours.**
- [Trusted Types et Sanitizer API](http://127.0.0.1:5173/#/modules/m04/l06) · [source](../src/content/m04/l06.mdx)
- [Patterns d’architecture](http://127.0.0.1:5173/#/modules/m08/l05) · [source](../src/content/m08/l05.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Le SVG est un document XML actif, pas une image : le rendre en `<img>` (qui n’exécute pas de script), le rasteriser à l’envoi, ou l’assainir avec une bibliothèque dédiée. Et le servir depuis une autre origine.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/routes/attachments.ts`](solutions/server/routes/attachments.ts)
</details>

<a id="react-javascript-url"></a>

### URL javascript: rendue par React

**N1** · CWE-79 · D5 Implémentation · Kohnfelder K11

Le lien de paiement d’une facture est rendu dans un attribut `href`. React échappe le HTML, pas les URL.

**Objectif.** Exécuter du script dans la session d’un autre utilisateur qui ouvre la facture.

**Où.** `src/pages/InvoiceDetail.tsx`

**Dans le cours.**
- [Trusted Types et Sanitizer API](http://127.0.0.1:5173/#/modules/m04/l06) · [source](../src/content/m04/l06.mdx)
- [React et le navigateur](http://127.0.0.1:5173/#/modules/m04/l02) · [source](../src/content/m04/l02.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Valider le schéma de l’URL à la construction (`http:`/`https:` seulement, via `new URL`), pas à l’affichage. React protège du HTML injecté et le dit — il n’a jamais prétendu protéger des URL.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/src/pages/InvoiceDetail.tsx`](solutions/src/pages/InvoiceDetail.tsx)
</details>

<a id="client-proto-pollution"></a>

### Pollution de prototype côté client

**N3** · CWE-1321 · D5 Implémentation · Kohnfelder K8

Les préférences d’affichage lues dans le fragment d’URL sont fusionnées par un `deepMerge` maison qui accepte les clés spéciales.

**Objectif.** Faire rendre par l’application un attribut d’événement qu’aucun champ de données ne permet, et exécuter du script.

**Où.** `src/api.ts`

**Dans le cours.**
- [Trusted Types et Sanitizer API](http://127.0.0.1:5173/#/modules/m04/l06) · [source](../src/content/m04/l06.mdx)
- [Client avancé : DOM, CSP et XS-Leaks](http://127.0.0.1:5173/#/modules/m03/l12) · [source](../src/content/m03/l12.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Même correctif que côté serveur — objets sans prototype, clés refusées, schéma — plus une deuxième barrière : Trusted Types, qui transforme le passage par un puits DOM en erreur d’exécution. Recherche BlackFan sur les gadgets clients.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/src/api.ts`](solutions/src/api.ts)
</details>

<a id="dom-clobbering"></a>

### DOM clobbering sur la configuration

**N3** · CWE-1321 · D5 Implémentation

L’assainisseur des notes conserve les attributs `id` et `name`, et le code lit une configuration globale sans l’avoir déclarée.

**Objectif.** Détourner les appels d’API de l’application vers une origine que tu contrôles.

**Où.** `src/api.ts`

**Dans le cours.**
- [Trusted Types et Sanitizer API](http://127.0.0.1:5173/#/modules/m04/l06) · [source](../src/content/m04/l06.mdx)
- [Client avancé : DOM, CSP et XS-Leaks](http://127.0.0.1:5173/#/modules/m03/l12) · [source](../src/content/m03/l12.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Déclarer ses variables (`const config = …`) plutôt que de les lire sur `window`, et retirer `id`/`name` de l’assainissement. Le DOM écrit dans l’espace global : tout élément nommé devient une variable.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/src/api.ts`](solutions/src/api.ts)
</details>

<a id="postmessage-origin"></a>

### postMessage sans contrôle d’origine

**N2** · CWE-346 · D4 Architecture · D5 Implémentation

Le récepteur de messages de la page de paiement accepte tout message dont la forme ressemble à une confirmation, sans vérifier son origine.

**Objectif.** Faire passer une facture à l’état payé depuis une page d’une autre origine.

**Où.** `src/pages/Checkout.tsx`

**Dans le cours.**
- [Isolation d’origine](http://127.0.0.1:5173/#/modules/m04/l07) · [source](../src/content/m04/l07.mdx)
- [Client avancé : DOM, CSP et XS-Leaks](http://127.0.0.1:5173/#/modules/m03/l12) · [source](../src/content/m03/l12.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Vérifier `event.origin` contre une liste d’origines attendues, et le contenu contre un schéma. Un message n’est pas une preuve de paiement : la confirmation vient du serveur du prestataire, par webhook signé.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/src/pages/Checkout.tsx`](solutions/src/pages/Checkout.tsx)
</details>

<a id="referrer-leak"></a>

### Fuite par l’en-tête Referer

**N1** · CWE-200 · D5 Implémentation

Le lien public de facture porte son jeton dans le chemin, et la page ne déclare aucune politique de référent.

**Objectif.** Retrouver un jeton d’accès à une facture dans les journaux d’un service tiers chargé par la page.

**Où.** `server/index.ts`

**Dans le cours.**
- [Isolation d’origine](http://127.0.0.1:5173/#/modules/m04/l07) · [source](../src/content/m04/l07.mdx)
- [SPA : RFC 10017 et BFF](http://127.0.0.1:5173/#/modules/m09/l04) · [source](../src/content/m09/l04.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

`Referrer-Policy: strict-origin-when-cross-origin` au minimum, et surtout aucun secret dans une URL : une URL part en `Referer`, dans les journaux, dans l’historique et dans le presse-papier.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/index.ts`](solutions/server/index.ts)
</details>

<a id="csp-nonce-reuse"></a>

### Nonce de CSP réutilisé

**N2** · CWE-330 · D5 Implémentation · Kohnfelder K5

Le nonce est une constante du build au lieu d’être tiré à chaque réponse.

**Objectif.** Faire exécuter un script inline injecté malgré une CSP active et apparemment stricte.

**Où.** `server/index.ts`

**Dans le cours.**
- [CSP stricte en pratique](http://127.0.0.1:5173/#/modules/m04/l05) · [source](../src/content/m04/l05.mdx)
- [Client avancé : DOM, CSP et XS-Leaks](http://127.0.0.1:5173/#/modules/m03/l12) · [source](../src/content/m03/l12.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Un nonce est un nombre utilisé une fois : tiré par réponse, depuis un générateur cryptographique. Un nonce constant est un `unsafe-inline` qui se cache. C’est l’un des contournements les plus fréquents des CSP « strictes ».

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/index.ts`](solutions/server/index.ts)
</details>

<a id="csp-gadget"></a>

### Gadget dans une origine autorisée

**N3** · CWE-693 · D5 Implémentation

La CSP autorise en bloc le répertoire de bibliothèques servi localement, dont l’une exécute ce qu’elle lit dans des attributs de données.

**Objectif.** Exécuter du script arbitraire sans charger un seul fichier hors de la liste autorisée.

**Où.** `server/index.ts`

**Dans le cours.**
- [CSP stricte en pratique](http://127.0.0.1:5173/#/modules/m04/l05) · [source](../src/content/m04/l05.mdx)
- [Client avancé : DOM, CSP et XS-Leaks](http://127.0.0.1:5173/#/modules/m03/l12) · [source](../src/content/m03/l12.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Une liste blanche d’origines ne vaut que ce que valent les fichiers qu’elle couvre : `strict-dynamic` avec nonce, plutôt que des chemins autorisés en bloc. Recherche Google/Securitum sur les gadgets d’allowlist.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/index.ts`](solutions/server/index.ts)
</details>

<a id="trusted-types-default"></a>

### Trusted Types en trompe-l’œil

**N3** · CWE-693 · D5 Implémentation

Trusted Types est exigé par la CSP, mais la politique par défaut renvoie la chaîne d’entrée telle quelle.

**Objectif.** Réussir une XSS dans un puits DOM alors que Trusted Types est déclaré actif.

**Où.** `src/main.tsx`

**Dans le cours.**
- [Trusted Types et Sanitizer API](http://127.0.0.1:5173/#/modules/m04/l06) · [source](../src/content/m04/l06.mdx)
- [Client avancé : DOM, CSP et XS-Leaks](http://127.0.0.1:5173/#/modules/m03/l12) · [source](../src/content/m03/l12.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

La politique par défaut est le dernier recours, pas le passe-droit : elle assainit ou elle jette. Une politique qui rend l’identité désactive le mécanisme tout en le laissant visible dans les en-têtes — le pire des deux mondes.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/src/main.tsx`](solutions/src/main.tsx)
</details>

<a id="clickjacking-prefilled"></a>

### Clickjacking sur les coordonnées bancaires

**N2** · CWE-1021 · D4 Architecture · D5 Implémentation

La page des coordonnées bancaires est encadrable et accepte des valeurs pré-remplies par l’URL.

**Objectif.** Faire enregistrer à un utilisateur connecté un IBAN que tu as choisi, en deux clics sur ta page.

**Où.** `server/index.ts`

**Dans le cours.**
- [Isolation d’origine](http://127.0.0.1:5173/#/modules/m04/l07) · [source](../src/content/m04/l07.mdx)
- [Abus de fonctionnalités](http://127.0.0.1:5173/#/modules/m10/l05) · [source](../src/content/m10/l05.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

`frame-ancestors 'none'`, et pas de pré-remplissage d’un champ sensible depuis l’URL. Les actions irréversibles demandent une confirmation qui ne peut pas être obtenue par un clic aveugle — ressaisie, ou second facteur.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/index.ts`](solutions/server/index.ts)
</details>

<a id="samesite-method-override"></a>

### SameSite contourné par surcharge de méthode

**N2** · CWE-352 · D5 Implémentation

Un intergiciel de surcharge de méthode est monté globalement : une navigation de premier niveau exécute une mutation.

**Objectif.** Modifier les coordonnées bancaires d’un utilisateur connecté depuis un simple lien sur un site tiers.

**Où.** `server/index.ts`

**Dans le cours.**
- [Isolation d’origine](http://127.0.0.1:5173/#/modules/m04/l07) · [source](../src/content/m04/l07.mdx)
- [React et le navigateur](http://127.0.0.1:5173/#/modules/m04/l02) · [source](../src/content/m04/l02.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Retirer la surcharge de méthode, ou ne jamais l’appliquer aux requêtes en `GET`. `SameSite=Lax` protège les mutations parce qu’elles sont censées ne pas être des navigations — l’hypothèse doit rester vraie.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/index.ts`](solutions/server/index.ts)
</details>

<a id="cors-origin-reflection"></a>

### CORS : origine reflétée avec identifiants

**N1** · CWE-942 · D5 Implémentation

L’en-tête d’origine autorisée est recopié depuis la requête, accompagné de l’autorisation d’envoyer les identifiants.

**Objectif.** Lire les factures d’un utilisateur connecté depuis une page servie sur une autre origine.

**Où.** `server/index.ts`

**Dans le cours.**
- [Isolation d’origine](http://127.0.0.1:5173/#/modules/m04/l07) · [source](../src/content/m04/l07.mdx)
- [En-têtes en production](http://127.0.0.1:5173/#/modules/m17/l05) · [source](../src/content/m17/l05.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Liste blanche d’origines explicite, comparée par égalité. Refléter l’origine avec `Allow-Credentials` revient à désactiver la politique de même origine pour tout le monde.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/index.ts`](solutions/server/index.ts)
</details>

<a id="cors-null-origin"></a>

### CORS : origine null autorisée

**N2** · CWE-942 · D5 Implémentation

La liste des origines autorisées contient `null`, « pour laisser passer les outils locaux ».

**Objectif.** Lire la même API depuis une iframe en bac à sable, dont l’origine est justement `null`.

**Où.** `server/index.ts`

**Dans le cours.**
- [Isolation d’origine](http://127.0.0.1:5173/#/modules/m04/l07) · [source](../src/content/m04/l07.mdx)
- [Client avancé : DOM, CSP et XS-Leaks](http://127.0.0.1:5173/#/modules/m03/l12) · [source](../src/content/m03/l12.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

`null` n’est pas une origine de confiance : n’importe qui peut la produire avec une iframe `sandbox` ou une redirection. Aucune exception de confort dans une liste d’origines.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/index.ts`](solutions/server/index.ts)
</details>

<a id="xsleak-frame-count"></a>

### XS-Leak par comptage de cadres

**N3** · CWE-200 · D5 Implémentation

La recherche de clients rend un nombre de cadres proportionnel au nombre de résultats, et la page n’a ni isolation d’origine ni restriction d’encadrement.

**Objectif.** Déterminer, depuis une page tierce, si le tenant de la victime possède une facture pour un client donné.

**Où.** `server/index.ts`

**Dans le cours.**
- [Isolation d’origine](http://127.0.0.1:5173/#/modules/m04/l07) · [source](../src/content/m04/l07.mdx)
- [Client avancé : DOM, CSP et XS-Leaks](http://127.0.0.1:5173/#/modules/m03/l12) · [source](../src/content/m03/l12.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

COOP, CORP et `frame-ancestors` ferment la plupart des canaux d’observation ; le reste se traite en rendant les réponses indiscernables. Les XS-Leaks fuient par des effets de bord, pas par le contenu — xsleaks.dev en tient le catalogue.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/index.ts`](solutions/server/index.ts)
</details>

<a id="xsleak-error-events"></a>

### XS-Leak par événements d’erreur

**N3** · CWE-200 · D5 Implémentation

L’API répond différemment selon que la ressource existe ou non, sans politique de ressource inter-origines.

**Objectif.** Déterminer depuis une origine tierce l’existence d’une facture d’un autre tenant.

**Où.** `server/index.ts`

**Dans le cours.**
- [Isolation d’origine](http://127.0.0.1:5173/#/modules/m04/l07) · [source](../src/content/m04/l07.mdx)
- [Client avancé : DOM, CSP et XS-Leaks](http://127.0.0.1:5173/#/modules/m03/l12) · [source](../src/content/m03/l12.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

`Cross-Origin-Resource-Policy: same-origin`, et des réponses uniformes : même code, même taille, même temps, que la ressource existe ou non. L’existence d’une ressource est elle-même une information.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/index.ts`](solutions/server/index.ts)
</details>

<a id="clickjacking"></a>

### Validation de paiement encadrable

**N1** · CWE-1021 · D4 Architecture · D5 Implémentation

Rien n’empêche la page de paiement d’être chargée dans une iframe sur un site tiers.

**Objectif.** Faire valider un paiement par un utilisateur qui croit cliquer ailleurs.

**Où.** `server/index.ts`

**Dans le cours.**
- [Isolation d’origine](http://127.0.0.1:5173/#/modules/m04/l07) · [source](../src/content/m04/l07.mdx)
- [En-têtes en production](http://127.0.0.1:5173/#/modules/m17/l05) · [source](../src/content/m17/l05.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

`frame-ancestors 'none'` dans la CSP — et rien d’autre : `X-Frame-Options` est un héritage, pas une défense à concevoir aujourd’hui.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/index.ts`](solutions/server/index.ts)
</details>

<a id="secret-in-bundle"></a>

### Secret livré dans le bundle

**N1** · CWE-615 · D5 Implémentation · D7 Déploiement & exploitation

Une clé d’API est exposée côté client par une variable d’environnement publique, et les source maps sont publiées.

**Objectif.** Récupérer une clé d’API utilisable en lisant ce que le navigateur télécharge.

**Où.** `src/api.ts`

**Dans le cours.**
- [Le client n’est pas sous ton contrôle](http://127.0.0.1:5173/#/modules/m04/l01) · [source](../src/content/m04/l01.mdx)
- [DAST et secrets](http://127.0.0.1:5173/#/modules/m13/l07) · [source](../src/content/m13/l07.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Le préfixe `VITE_` ou `NEXT_PUBLIC_` est une déclaration de publication. Ce qui exige un secret passe par le serveur. Source maps non publiées, et la clé se révoque — la retirer du code ne suffit pas.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/src/api.ts`](solutions/src/api.ts)
</details>

<a id="open-redirect"></a>

### Redirection ouverte après connexion

**N1** · CWE-601 · D5 Implémentation

Le paramètre de retour est suivi tel quel après une connexion réussie.

**Objectif.** Faire rediriger un utilisateur connecté vers un domaine que tu contrôles.

**Où.** `server/routes/auth.ts`

**Dans le cours.**
- [React et le navigateur](http://127.0.0.1:5173/#/modules/m04/l02) · [source](../src/content/m04/l02.mdx)
- [Attaques OAuth et OIDC](http://127.0.0.1:5173/#/modules/m09/l06) · [source](../src/content/m09/l06.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Chemins relatifs seulement, ou liste blanche de destinations. Une redirection ouverte est rarement isolée : elle sert de tremplin au vol de code OAuth et au contournement de filtres SSRF.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/routes/auth.ts`](solutions/server/routes/auth.ts)
</details>

## M26 · Gestion des vulnérabilités

<a id="finding-dedupe"></a>

### Le doublon qui coûte cher

**N2** · CWE-1059 · D6 Tests

Trois outils remontent le même défaut sous trois formes, et la file de triage compte trois fois le même travail. Les rapports bruts sont dans `fixtures/m05/dedupe/` (semgrep.json, njsscan.json, snyk.json), l’échelle de sévérité commune dans `fixtures/m05/severity-map.json`.

**Objectif.** Écrire `workspace/scripts/dedupe.mjs`, qui prend un dossier de rapports en argument et écrit sur la sortie standard la liste fusionnée, en JSON.

**Où.** `scripts/dedupe.mjs`

**Dans le cours.**
- [Cycle de vie d’une vulnérabilité](http://127.0.0.1:5173/#/modules/m05/l01) · [source](../src/content/m05/l01.mdx)
- [Bâtir la plateforme](http://127.0.0.1:5173/#/modules/m13/l11) · [source](../src/content/m13/l11.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Le dédoublonnage est une décision de plateforme, pas un script par équipe : la clé se déclare une fois, et tout ce qui entre dans l’outil de suivi passe par elle. Sans ça, trois scanners produisent trois fois le même ticket, et la file perd sa crédibilité avant sa première revue.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/scripts/dedupe.mjs`](solutions/scripts/dedupe.mjs)
</details>

<a id="triage-kev-epss"></a>

### Le triage qui va chercher la donnée

**N2** · CWE-1059 · D6 Tests

Vingt vulnérabilités du SBOM de Novafact (`fixtures/m05/sbom-vulns.json`), toutes « critiques » ou « hautes » selon leur score de base. L’équipe a deux jours.

**Objectif.** Produire `workspace/vulns/triage.csv` : les vingt vulnérabilités dans leur ordre de traitement réel, avec l’exploitation observée et la probabilité d’exploitation allées chercher à la source.

**Où.** `vulns/triage.csv`

**Dans le cours.**
- [Prioriser par le risque](http://127.0.0.1:5173/#/modules/m05/l03) · [source](../src/content/m05/l03.mdx)
- [CVSS 4.0](http://127.0.0.1:5173/#/modules/m05/l02) · [source](../src/content/m05/l02.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Un score de base est une propriété du défaut, pas de ton exposition. Ce qui décide de l’ordre, c’est l’exploitation observée puis la probabilité d’exploitation — et ces deux données se vont chercher, elles ne se devinent pas. C’est la différence entre une file de vingt « critiques » et une liste de six choses à faire aujourd’hui.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/vulns/triage.csv`](solutions/vulns/triage.csv)
</details>

<a id="ssvc-decision"></a>

### L’arbre SSVC, appliqué

**N2** · CWE-1059 · D6 Tests

Cinq vulnérabilités (`fixtures/m05/ssvc-cases.json`), et une décision à rendre pour chacune : différer, planifier, sortir du cycle, ou traiter immédiatement. La table de décision est dans `fixtures/m05/ssvc-deployer.json`.

**Objectif.** Produire `workspace/vulns/ssvc-selections.json` : pour chaque cas, les quatre points de décision retenus et le résultat que la table en tire.

**Où.** `vulns/ssvc-selections.json`

**Dans le cours.**
- [Prioriser par le risque](http://127.0.0.1:5173/#/modules/m05/l03) · [source](../src/content/m05/l03.mdx)
- [Cycle de vie d’une vulnérabilité](http://127.0.0.1:5173/#/modules/m05/l01) · [source](../src/content/m05/l01.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Un arbre de décision ne sert pas à remplacer le jugement, il sert à le rendre traçable : chaque décision porte les points qui l’ont produite, et une décision se conteste en contestant un point, pas en refaisant tout le débat. C’est ce qui permet de rendre la même décision six mois plus tard, et d’expliquer pourquoi elle a changé.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/vulns/ssvc-selections.json`](solutions/vulns/ssvc-selections.json)
</details>

<a id="vex-not-affected"></a>

### Le VEX qui dit non, et le prouve

**N2** · CWE-1059 · D6 Tests · D8 Supply chain

Trois avis de sécurité (`fixtures/m05/advisories.json`, identifiants NF-ADV-2026-001, -004 et -005) visent des composants internes de Novafact. Chacun désigne un symbole vulnérable : un fichier et une fonction. La fonction est-elle seulement appelée quelque part ?

**Objectif.** Lire le code de `server/` pour chaque symbole, puis produire `workspace/vulns/novafact.openvex.json` — le document VEX qui déclare le statut, avec la justification qui correspond.

**Où.** `vulns/novafact.openvex.json`

**Dans le cours.**
- [Prioriser par le risque](http://127.0.0.1:5173/#/modules/m05/l03) · [source](../src/content/m05/l03.mdx)
- [Outillage, SLA et dépendances npm](http://127.0.0.1:5173/#/modules/m05/l05) · [source](../src/content/m05/l05.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Un VEX n’est pas un document de communication : c’est une affirmation vérifiable, et elle engage. « Non affecté » sans justification prise dans l’énumération, c’est du bruit ; avec la mauvaise justification, c’est un mensonge qui sera découvert au premier incident. La justification force à dire POURQUOI, et c’est là que le travail se fait.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/vulns/novafact.openvex.json`](solutions/vulns/novafact.openvex.json)
</details>

<a id="vex-to-cyclonedx"></a>

### Traduire un VEX d’un dialecte à l’autre

**N3** · CWE-1059 · D6 Tests · D8 Supply chain

Le client veut le VEX dans son SBOM CycloneDX. Le document source est `fixtures/m05/vex-exemple.json`, le schéma cible `fixtures/m05/cyclonedx-vex.schema.json`. Une conversion naïve produit un document rejeté.

**Objectif.** Écrire `workspace/scripts/vex2cdx.mjs`, qui prend un document OpenVEX en argument et écrit le document CycloneDX correspondant sur la sortie standard.

**Où.** `scripts/vex2cdx.mjs`

**Dans le cours.**
- [Outillage, SLA et dépendances npm](http://127.0.0.1:5173/#/modules/m05/l05) · [source](../src/content/m05/l05.mdx)
- [SCA et SBOM](http://127.0.0.1:5173/#/modules/m13/l06) · [source](../src/content/m13/l06.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Les formats d’échange de sécurité ne sont pas interchangeables : ils encodent des modèles différents, et la traduction perd. Le savoir évite deux choses — livrer un document invalide à un client, et croire qu’on a dit ce qu’on n’a pas dit. Quand la traduction perd, on le documente plutôt que de la laisser passer en silence.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/scripts/vex2cdx.mjs`](solutions/scripts/vex2cdx.mjs)
</details>

<a id="reachability-ast"></a>

### L’atteignabilité, à la main

**N3** · CWE-1059 · D6 Tests

Cinq composants internes signalés vulnérables (`fixtures/m05/advisories.json`). Aucun outil hors ligne ne sait dire, en JavaScript, si le code vulnérable est réellement appelé — il faut lire.

**Objectif.** Produire `workspace/vulns/reachability.yaml` : pour chaque avis, la chaîne d’appel du point d’entrée HTTP jusqu’au symbole, ou la démonstration qu’elle n’existe pas.

**Où.** `vulns/reachability.yaml`

**Dans le cours.**
- [Prioriser par le risque](http://127.0.0.1:5173/#/modules/m05/l03) · [source](../src/content/m05/l03.mdx)
- [Méthode sur une base inconnue](http://127.0.0.1:5173/#/modules/m12/l02) · [source](../src/content/m12/l02.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

L’atteignabilité est ce qui distingue une file de mille alertes d’une liste de dix vrais problèmes. Elle ne se sous-traite pas à un outil qui ne sait pas la calculer : pour le JavaScript, aujourd’hui, c’est de la lecture de code — et cette lecture se documente, sinon elle est à refaire au prochain scan.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/vulns/reachability.yaml`](solutions/vulns/reachability.yaml)
</details>

<a id="sla-policy"></a>

### Le SLA qui se mesure

**N2** · CWE-1059 · D6 Tests · D7 Déploiement & exploitation

La politique de remédiation existe en diapositives. Personne ne sait qui est hors délai aujourd’hui. Les constats horodatés sont dans `fixtures/m05/sla-findings.json`, et le harnais connaît le verdict attendu pour chacun.

**Objectif.** Écrire `workspace/vulns/sla-policy.yaml` (la politique, lisible par une machine) et `workspace/scripts/sla-report.mjs` (ce qui la mesure).

**Où.** `vulns/sla-policy.yaml`

**Dans le cours.**
- [Outillage, SLA et dépendances npm](http://127.0.0.1:5173/#/modules/m05/l05) · [source](../src/content/m05/l05.mdx)
- [Mesurer un programme](http://127.0.0.1:5173/#/modules/m32/l04) · [source](../src/content/m32/l04.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Un SLA qu’on ne mesure pas est une intention. La politique lisible par une machine, le script qui la rejoue et le tableau qui en sort sont un même objet : dès qu’ils se séparent, la politique devient une diapositive et le retard devient invisible.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/vulns/sla-policy.yaml`](solutions/vulns/sla-policy.yaml)
</details>

<a id="findings-aggregate"></a>

### Le constat qui agrège tout

**N2** · CWE-1059 · D6 Tests

Les notes CVSS, les scores de probabilité et le statut d’exploitation vivent dans trois fichiers séparés de `fixtures/m05/`, et l’outil de suivi n’en voit aucun.

**Objectif.** Produire `workspace/vulns/findings.json` : le fichier d’import qui agrège, pour chaque composant vulnérable, tout ce qui sert à décider.

**Où.** `vulns/findings.json`

**Dans le cours.**
- [Outillage, SLA et dépendances npm](http://127.0.0.1:5173/#/modules/m05/l05) · [source](../src/content/m05/l05.mdx)
- [Prioriser par le risque](http://127.0.0.1:5173/#/modules/m05/l03) · [source](../src/content/m05/l03.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

C’est le geste qui transforme trois exports en une file de travail. Et la liste blanche stricte n’est pas une coquetterie : un champ mal nommé qui passe en silence, c’est une donnée qui manquera au moment de décider, sans que personne ne s’en aperçoive.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/vulns/findings.json`](solutions/vulns/findings.json)
</details>

<a id="disclosure-policy"></a>

### Publier sa politique de divulgation

**N1** · CWE-1059 · D6 Tests · D8 Supply chain

Un chercheur trouve une faille dans Novafact et ne sait pas à qui l’envoyer. Il la publie.

**Objectif.** Produire `workspace/public/.well-known/security.txt`, conforme à la RFC 9116.

**Où.** `public/.well-known/security.txt`

**Dans le cours.**
- [Divulgation, bug bounty et CRA](http://127.0.0.1:5173/#/modules/m05/l06) · [source](../src/content/m05/l06.mdx)
- [Piloter la sécurité offensive](http://127.0.0.1:5173/#/modules/m06/l06) · [source](../src/content/m06/l06.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Publier la politique coûte une heure et supprime la classe entière des divulgations sauvages « parce que personne ne répondait ». Ce qui coûte, c’est de la tenir : la date d’expiration est le mécanisme qui force la relecture. Le CRA rend l’adresse de signalement obligatoire — autant la rendre utile.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/public/.well-known/security.txt`](solutions/public/.well-known/security.txt)
</details>

## M30 · Faire adopter la sécurité

<a id="finding-sarif"></a>

### Le finding à la bonne ligne

**N2** · CWE-1059 · D2 Cycle de vie · D6 Tests

Le rapport annonce « contrôle d’accès insuffisant sur l’API ». L’équipe ne sait pas quel fichier ouvrir.

**Objectif.** Transformer le défaut `bola-invoice` du lab en constat structuré au format SARIF 2.1.0 : emplacement exact, classe de bug, et correctif qui s’applique vraiment.

**Où.** `findings/bola-invoice.sarif`

**Dans le cours.**
- [Écrire un finding qui sera corrigé](http://127.0.0.1:5173/#/modules/m06/l01) · [source](../src/content/m06/l01.mdx)
- [Revoir une PR en 10 minutes](http://127.0.0.1:5173/#/modules/m12/l03) · [source](../src/content/m12/l03.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Le harnais valide le format, vérifie que l’emplacement désigne le fichier réellement fautif et que la ligne tombe sur le point d’entrée du défaut à deux lignes près, puis **applique le correctif proposé** et relit le résultat. La prose n’est pas notée, et il faut le dire : la persuasion ne s’automatise pas, la précision si. Un finding précis se corrige ; un finding vague se discute.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/findings/bola-invoice.sarif`](solutions/findings/bola-invoice.sarif)
</details>

<a id="training-from-bug"></a>

### Former à partir d’un vrai bug

**N2** · CWE-1059 · D2 Cycle de vie · D6 Tests

La formation annuelle parle d’injection SQL. L’équipe écrit du TypeScript et vient de livrer trois mass assignments.

**Objectif.** Construire l’exercice court qui enseigne la classe de bug que l’équipe vient réellement d’introduire : l’extrait vulnérable, son correctif, et le test qui les sépare.

**Où.** `training/mass-assignment/`

**Dans le cours.**
- [Former au code sécurisé](http://127.0.0.1:5173/#/modules/m06/l04) · [source](../src/content/m06/l04.mdx)
- [Tests de sécurité écrits par les devs](http://127.0.0.1:5173/#/modules/m13/l02) · [source](../src/content/m13/l02.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Double passage local : le test produit doit échouer contre l’extrait vulnérable et passer contre son correctif — les deux étant fournis par l’apprenant. Un test qui passe partout ne prouve rien, un test qui échoue partout casse la fonctionnalité. Le harnais vérifie en plus que l’extrait vulnérable porte bien un mass assignment et que le correctif n’en porte plus. Partir des bugs réels de l’entreprise est ce qui distingue une formation suivie d’une formation subie, et la mesure est dans les findings suivants.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/training/mass-assignment/`](solutions/training/mass-assignment/)
</details>

<a id="pentest-scope"></a>

### Cadrer un test d’intrusion

**N3** · CWE-1059 · D6 Tests · D8 Supply chain

Le prestataire arrive lundi. Il n’a ni comptes, ni périmètre écrit, ni environnement, et la production est hors limites — ce que personne ne lui a dit.

**Objectif.** Écrire le cadrage : périmètre, exclusions, comptes fournis par rôle, fenêtre, conditions d’arrêt, et modalité de retest.

**Où.** `pentest/scope.yaml`

**Dans le cours.**
- [Piloter la sécurité offensive](http://127.0.0.1:5173/#/modules/m06/l06) · [source](../src/content/m06/l06.mdx)
- [Exigences et abuse cases](http://127.0.0.1:5173/#/modules/m07/l01) · [source](../src/content/m07/l01.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Le harnais vérifie la complétude structurelle et la cohérence avec le code : chaque hôte du périmètre existe dans la configuration, la production est exclue et pas seulement absente, chaque rôle du modèle de données a un compte, et le retest est daté après la fenêtre. Le choix du périmètre, la durée et le montant ne sont pas jugés — ce sont des arbitrages. Tu connais l’autre côté : c’est l’occasion d’écrire ce qu’un bon client fournit, et que tu n’as presque jamais reçu.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/pentest/scope.yaml`](solutions/pentest/scope.yaml)
</details>

## M12 · Exigences, vie privée & conformité

<a id="asvs-subset"></a>

### Le sous-ensemble ASVS de Novafact

**N2** · CWE-1059 · D3 Exigences

ASVS compte plusieurs centaines d’exigences. Les appliquer toutes est impossible, les ignorer toutes est confortable.

**Objectif.** Choisir les exigences de niveau L2 qui s’appliquent réellement à Novafact, et les inscrire dans le dépôt.

**Où.** `requirements/asvs.yaml`

**Dans le cours.**
- [Exigences et abuse cases](http://127.0.0.1:5173/#/modules/m07/l01) · [source](../src/content/m07/l01.mdx)
- [Matrice de traçabilité](http://127.0.0.1:5173/#/modules/m07/l02) · [source](../src/content/m07/l02.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Le harnais vérifie que chaque identifiant existe, qu’il est bien de niveau L2, et que les chapitres structurellement obligatoires sont couverts. On mesure la lecture du standard, pas la justesse du découpage — qui dépend du métier.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/requirements/asvs.yaml`](solutions/requirements/asvs.yaml)
</details>

<a id="traceability-matrix"></a>

### La matrice qui ne ment pas

**N2** · CWE-1059 · D3 Exigences · D6 Tests

Les exigences sont écrites. Rien ne dit lesquelles sont réellement tenues, ni par quoi.

**Objectif.** Relier chaque exigence retenue au test qui l’établit — et dire honnêtement lequel passe.

**Où.** `requirements/traceability.csv`

**Dans le cours.**
- [Matrice de traçabilité](http://127.0.0.1:5173/#/modules/m07/l02) · [source](../src/content/m07/l02.mdx)
- [Stratégie de test de sécurité](http://127.0.0.1:5173/#/modules/m13/l01) · [source](../src/content/m13/l01.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Pour chaque ligne, le harnais vérifie que l’exigence existe, que le fichier existe, que le test du nom donné existe, et qu’il passe ou échoue comme annoncé ; puis il exige la couverture inverse, aucune exigence sans ligne. Une matrice bien remplie mais fausse est détectée — c’est tout l’intérêt de la tenir dans le dépôt plutôt que dans un tableur.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/requirements/traceability.csv`](solutions/requirements/traceability.csv)
</details>

<a id="data-classification"></a>

### La carte des données, confrontée au code

**N2** · CWE-1059 · D3 Exigences

Novafact manipule des IBAN, des adresses, des notes internes et des secrets. Aucun dictionnaire de données, donc aucune règle de traitement.

**Objectif.** Classer chaque champ réellement manipulé — sensibilité, propriétaire, base légale, durée — et vérifier que rien d’interne ne sort par l’API.

**Où.** `privacy/data-classification.yaml`

**Dans le cours.**
- [Classification des données](http://127.0.0.1:5173/#/modules/m07/l03) · [source](../src/content/m07/l03.mdx)
- [Vie privée et RGPD](http://127.0.0.1:5173/#/modules/m07/l04) · [source](../src/content/m07/l04.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Le harnais extrait les champs réellement présents dans le modèle, exige que chacun soit classé, puis confronte la carte à ce que l’API renvoie. Classer tout en « client » pour n’avoir rien à protéger est le raccourci que la vérification refuse : une application de facturation a des données internes.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/privacy/data-classification.yaml`](solutions/privacy/data-classification.yaml)
</details>

<a id="erasure-test"></a>

### L’effacement qui efface pour de bon

**N2** · CWE-359 · D3 Exigences · D6 Tests

La suppression d’un compte pose un drapeau. Les exports, la boîte d’envoi et les journaux gardent tout.

**Objectif.** Écrire la politique de rétention, puis le test qui cherche les données du compte supprimé dans tous les magasins et n’en trouve aucune.

**Où.** `verify/erasure.test.ts`

**Dans le cours.**
- [Vie privée et RGPD](http://127.0.0.1:5173/#/modules/m07/l04) · [source](../src/content/m07/l04.mdx)
- [Tests de sécurité écrits par les devs](http://127.0.0.1:5173/#/modules/m13/l02) · [source](../src/content/m13/l02.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Le harnais exige que le test couvre les cinq magasins et que la politique déclare une durée pour chaque classe. Le droit à l’effacement porte sur toutes les copies : cartographier où la donnée se propage vient avant de promettre de l’effacer.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/verify/erasure.test.ts`](solutions/verify/erasure.test.ts)
</details>

<a id="compliance-matrix"></a>

### Ce que la conformité impose vraiment

**N2** · CWE-1059 · D3 Exigences · D8 Supply chain

PCI DSS, RGPD, NIS2, CRA : quatre textes cités en réunion, aucune trace de ce qu’ils imposent concrètement à Novafact.

**Objectif.** Établir la matrice exigence réglementaire → contrôle technique → preuve dans le dépôt.

**Où.** `requirements/compliance.yaml`

**Dans le cours.**
- [Conformité : NIS2, CRA, PCI DSS](http://127.0.0.1:5173/#/modules/m07/l05) · [source](../src/content/m07/l05.mdx)
- [PCI DSS 4.0.1 : 6.4.3 et 11.6.1](http://127.0.0.1:5173/#/modules/m04/l08) · [source](../src/content/m04/l08.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Le harnais vérifie que chaque preuve citée existe, et pousse sur un sous-ensemble décidable. Une exigence sans contrôle est une case cochée ; un contrôle sans preuve est une intention. Déclarer une obligation non couverte avec un plan écrit vaut mieux que de la déclarer couverte sans preuve.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/requirements/compliance.yaml`](solutions/requirements/compliance.yaml)
</details>

<a id="access-recertification"></a>

### Recertifier les accès

**N3** · CWE-1059 · D3 Exigences · D7 Déploiement & exploitation

Des comptes de service et des comptes humains ont des droits que personne n’a revus depuis leur création. Certains n’ont jamais servi.

**Objectif.** Produire la revue : qui a quoi, qui s’en est servi, ce qui doit être retiré.

**Où.** `requirements/access-review.csv`

**Dans le cours.**
- [Provisionnement des accès](http://127.0.0.1:5173/#/modules/m07/l06) · [source](../src/content/m07/l06.mdx)
- [Moindre privilège en pratique](http://127.0.0.1:5173/#/modules/m15/l05) · [source](../src/content/m15/l05.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Le harnais croise la liste des comptes avec le journal et connaît la réponse : les droits jamais exercés sur la période sont à retirer. C’est le même geste que le moindre privilège côté IAM — partir de l’usage réel plutôt que de la demande initiale.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/requirements/access-review.csv`](solutions/requirements/access-review.csv)
</details>

## M13 · Spécifier et concevoir

<a id="upload-pipeline"></a>

### Pipeline d’upload non isolé

**N2** · CWE-434 · D4 Architecture · D5 Implémentation

Les pièces jointes sont stockées et servies depuis la même origine que l’application, avec le `Content-Type` annoncé par le client.

**Objectif.** Faire servir un fichier qui s’exécute dans l’origine de l’application.

**Où.** `server/routes/attachments.ts`

**Dans le cours.**
- [Patterns d’architecture](http://127.0.0.1:5173/#/modules/m08/l05) · [source](../src/content/m08/l05.mdx)
- [Isolation d’origine](http://127.0.0.1:5173/#/modules/m04/l07) · [source](../src/content/m04/l07.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Servir depuis une origine distincte (ou `Content-Disposition: attachment` et `X-Content-Type-Options: nosniff`), type déduit du contenu et non de l’annonce, nom généré, analyse antivirus, et rendu dans un service séparé.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/routes/attachments.ts`](solutions/server/routes/attachments.ts)
</details>

<a id="weak-random"></a>

### Jeton tiré de Math.random

**N2** · CWE-338 · D1 Concepts · D5 Implémentation · Kohnfelder K5

Le jeton de réinitialisation vient de `Math.random()`. Le générateur de V8 n’est pas cryptographique et son état se reconstruit.

**Objectif.** Prédire le prochain jeton de réinitialisation après en avoir observé quelques-uns.

**Où.** `server/routes/auth.ts`

**Dans le cours.**
- [Crypto pour développeurs](http://127.0.0.1:5173/#/modules/m08/l08) · [source](../src/content/m08/l08.mdx)
- [Footguns JavaScript et argent](http://127.0.0.1:5173/#/modules/m02/l02) · [source](../src/content/m02/l02.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

`crypto.randomUUID()` ou `crypto.randomBytes` pour tout ce qui doit être imprévisible — jamais `Math.random`, dont ce n’est pas le contrat. Envelopper la génération de secrets dans une fonction maison, pour que le mauvais choix ne soit plus à portée de main.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/routes/auth.ts`](solutions/server/routes/auth.ts)
</details>

## M14 · Identité : authentification, autorisation, OAuth & SAML

<a id="token-in-url"></a>

### Jeton d’accès passé dans l’URL

**N1** · CWE-598 · D5 Implémentation · D7 Déploiement & exploitation

Le lien de consultation d’une facture porte le jeton d’accès en paramètre de requête.

**Objectif.** Récupérer un jeton valide dans l’en-tête Referer d’un script tiers, puis dans les journaux d’accès.

**Où.** `server/routes/invoices.ts`

**Dans le cours.**
- [SPA : RFC 10017 et BFF](http://127.0.0.1:5173/#/modules/m09/l04) · [source](../src/content/m09/l04.mdx)
- [Journaliser pour la sécurité](http://127.0.0.1:5173/#/modules/m18/l01) · [source](../src/content/m18/l01.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Les secrets voyagent dans les en-têtes ou les cookies, jamais dans l’URL : une URL est journalisée, mise en cache, partagée et transmise en Referer. Pour un lien partageable, un jeton à usage unique et à courte durée, distinct de la session.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/routes/invoices.ts`](solutions/server/routes/invoices.ts)
</details>

<a id="oauth-redirect"></a>

### redirect_uri validée par préfixe

**N2** · CWE-601 · D1 Concepts · D5 Implémentation

Le serveur d’autorisation du lab accepte toute `redirect_uri` qui commence par l’URL enregistrée.

**Objectif.** Détourner un code d’autorisation vers une destination que tu contrôles.

**Où.** `server/routes/oauth.ts`

**Dans le cours.**
- [OAuth 2.1 et Authorization Code + PKCE](http://127.0.0.1:5173/#/modules/m09/l03) · [source](../src/content/m09/l03.mdx)
- [Attaques OAuth et OIDC](http://127.0.0.1:5173/#/modules/m09/l06) · [source](../src/content/m09/l06.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Comparaison exacte de la `redirect_uri`, chaîne par chaîne — jamais par préfixe, jamais avec des jokers. PKCE limite les dégâts mais ne remplace pas ce contrôle. RFC 9700.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/routes/oauth.ts`](solutions/server/routes/oauth.ts)
</details>

<a id="oauth-state"></a>

### Connexion fédérée sans state

**N2** · CWE-352 · D1 Concepts · D5 Implémentation

Le flux Authorization Code n’émet ni ne vérifie de `state`.

**Objectif.** Lier le compte fédéré de l’attaquant à la session d’un autre utilisateur (login CSRF).

**Où.** `server/routes/oauth.ts`

**Dans le cours.**
- [OAuth 2.1 et Authorization Code + PKCE](http://127.0.0.1:5173/#/modules/m09/l03) · [source](../src/content/m09/l03.mdx)
- [Attaques OAuth et OIDC](http://127.0.0.1:5173/#/modules/m09/l06) · [source](../src/content/m09/l06.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

`state` aléatoire lié à la session et vérifié au retour, `nonce` pour l’ID token. Ce ne sont pas des options du flux : sans eux, le flux ne prouve rien sur l’origine de la requête.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/routes/oauth.ts`](solutions/server/routes/oauth.ts)
</details>

<a id="oauth-email-unverified"></a>

### nOAuth : e-mail non vérifié

**N2** · CWE-287 · D1 Concepts · D5 Implémentation

Le rapprochement de comptes se fait sur le claim `email` du fournisseur, sans regarder `email_verified`.

**Objectif.** Prendre le contrôle d’un compte existant en déclarant son adresse chez un fournisseur complaisant.

**Où.** `server/routes/oauth.ts`

**Dans le cours.**
- [Attaques OAuth et OIDC](http://127.0.0.1:5173/#/modules/m09/l06) · [source](../src/content/m09/l06.mdx)
- [Authentification applicative](http://127.0.0.1:5173/#/modules/m09/l01) · [source](../src/content/m09/l01.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Ne jamais rapprocher deux comptes sur un identifiant que l’utilisateur choisit. Clé de rapprochement = `iss` + `sub`, et `email_verified` exigé avant toute liaison — avec confirmation explicite côté utilisateur.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/routes/oauth.ts`](solutions/server/routes/oauth.ts)
</details>

<a id="saml-wrapping"></a>

### SAML : envelopper la signature

**N3** · CWE-347 · D1 Concepts · D4 Architecture

Le SSO entreprise accepte une assertion SAML dont la signature est valide — mais le traitement lit un autre nœud que celui qui a été signé.

**Objectif.** Se connecter en tant qu’un autre utilisateur avec une assertion dont la signature reste parfaitement valide.

**Où.** `server/routes/saml.ts`

**Dans le cours.**
- [SAML en entreprise](http://127.0.0.1:5173/#/modules/m09/l08) · [source](../src/content/m09/l08.mdx)
- [Parser differentials et fuites via l’ORM](http://127.0.0.1:5173/#/modules/m03/l07) · [source](../src/content/m03/l07.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Vérifier la signature ne suffit pas : il faut vérifier que ce qu’on lit est **ce qui a été signé**, et refuser les documents à plusieurs assertions. Bibliothèque à jour, schéma strict, et certificats gérés. C’est la famille de SAMLStorm et de *The Fragile Lock*.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/routes/saml.ts`](solutions/server/routes/saml.ts)
</details>

## M15 · Anti-abus, ATO & fraude

<a id="no-rate-limit"></a>

### Credential stuffing sans limite

**N1** · CWE-307 · D5 Implémentation

La connexion n’a ni limitation de débit, ni verrouillage, ni délai croissant. Le lab fournit une liste de mots de passe courants.

**Objectif.** Trouver le mot de passe de compta@globex.example par force brute sur la wordlist du lab.

**Où.** `server/routes/auth.ts`

**Dans le cours.**
- [Credential stuffing et prise de contrôle](http://127.0.0.1:5173/#/modules/m10/l02) · [source](../src/content/m10/l02.mdx)
- [Limitation de débit bien conçue](http://127.0.0.1:5173/#/modules/m10/l03) · [source](../src/content/m10/l03.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Limitation par compte ET par IP ET par tenant (token bucket ou fenêtre glissante, Redis), réponses graduées, MFA/passkeys, mots de passe comparés à Pwned Passwords. Sans jamais faire du verrouillage une arme de déni de service (NIST SP 800-63B).

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/routes/auth.ts`](solutions/server/routes/auth.ts)
</details>

<a id="invoice-state"></a>

### Invariant métier : rouvrir une facture payée

**N2** · CWE-840 · D4 Architecture · D5 Implémentation

Le statut d’une facture est envoyé par le client à chaque mise à jour, et le montant reste modifiable quel que soit le statut.

**Objectif.** Faire baisser le montant d’une facture déjà payée, puis la remettre en payé.

**Où.** `server/routes/invoices.ts`

**Dans le cours.**
- [Invariants métier](http://127.0.0.1:5173/#/modules/m10/l06) · [source](../src/content/m10/l06.mdx)
- [Abus de fonctionnalités](http://127.0.0.1:5173/#/modules/m10/l05) · [source](../src/content/m10/l05.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Machine à états côté serveur : transitions autorisées déclarées, champs immuables après paid, opérations d’annulation par avoir plutôt que par édition, journal d’audit et rapprochement.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/routes/invoices.ts`](solutions/server/routes/invoices.ts)
</details>

<a id="send-quota"></a>

### Envoi de factures détourné

**N2** · CWE-770 · D3 Exigences · D4 Architecture

Un compte fraîchement créé peut envoyer autant de factures qu’il veut, avec un texte libre, depuis le domaine de Novafact.

**Objectif.** Envoyer cent messages de phishing depuis un domaine légitime et authentifié SPF/DKIM.

**Où.** `server/routes/invoices.ts`

**Dans le cours.**
- [Abus de fonctionnalités](http://127.0.0.1:5173/#/modules/m10/l05) · [source](../src/content/m10/l05.mdx)
- [Conformité : NIS2, CRA, PCI DSS](http://127.0.0.1:5173/#/modules/m07/l05) · [source](../src/content/m07/l05.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Quotas progressifs liés à l’ancienneté et à la vérification du compte, analyse du contenu sortant, réputation par tenant, canal de signalement, et sous-domaine distinct pour les envois transactionnels. Le cas QuickBooks : +36,5 % d’attaques via un domaine légitime en 2025.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/routes/invoices.ts`](solutions/server/routes/invoices.ts)
</details>

<a id="user-enumeration"></a>

### Énumération de comptes

**N1** · CWE-204 · D5 Implémentation

L’inscription, la connexion et la réinitialisation répondent différemment selon que le compte existe.

**Objectif.** Déterminer, parmi une liste de mille adresses, lesquelles ont un compte.

**Où.** `server/routes/auth.ts`

**Dans le cours.**
- [Credential stuffing et prise de contrôle](http://127.0.0.1:5173/#/modules/m10/l02) · [source](../src/content/m10/l02.mdx)
- [Authentification applicative](http://127.0.0.1:5173/#/modules/m09/l01) · [source](../src/content/m09/l01.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Réponses et temps de réponse identiques dans les trois parcours, message neutre, et la différence communiquée par e-mail plutôt que par la réponse HTTP. L’énumération est rarement critique seule : elle alimente le credential stuffing.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/routes/auth.ts`](solutions/server/routes/auth.ts)
</details>

<a id="xff-spoof"></a>

### Limitation contournée par X-Forwarded-For

**N2** · CWE-290 · D5 Implémentation · D7 Déploiement & exploitation

La limitation de débit prend la première valeur de `X-Forwarded-For`, que le client contrôle entièrement.

**Objectif.** Mener une rafale de connexions sans jamais être limité.

**Où.** `server/routes/auth.ts`

**Dans le cours.**
- [Limitation de débit bien conçue](http://127.0.0.1:5173/#/modules/m10/l03) · [source](../src/content/m10/l03.mdx)
- [En-tête Host](http://127.0.0.1:5173/#/modules/m03/l02) · [source](../src/content/m03/l02.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Derrière CloudFront, la vraie IP est à une position connue de la chaîne : `trust proxy` réglé au nombre exact de proxys, ou lecture de l’en-tête signé du CDN. Et limiter aussi par compte, qui ne se falsifie pas.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/routes/auth.ts`](solutions/server/routes/auth.ts)
</details>

## M11 · Threat modeling & MITRE

<a id="dfd-as-code"></a>

### Le DFD qui remonte la bonne menace

**N2** · CWE-1059 · D4 Architecture · Kohnfelder K2

Novafact n’a pas de schéma de flux de données. Chacun a sa version de l’architecture, et aucune ne mentionne le service de métadonnées.

**Objectif.** Modéliser l’application — acteurs, processus, magasins, flux, frontières de confiance — dans `threats/novafact.dfd.yaml`, et faire remonter par le moteur de règles les menaces attendues. Un flux porte un faisceau de routes (`routes:`) : aucune route montée ne doit rester dehors, et le champ `authenticated` de chaque flux doit correspondre au middleware du code.

**Où.** `threats/novafact.dfd.yaml`

**Dans le cours.**
- [Les 4 questions et la démarche](http://127.0.0.1:5173/#/modules/m11/l01) · [source](../src/content/m11/l01.mdx)
- [Threat modeling agile et as code](http://127.0.0.1:5173/#/modules/m11/l05) · [source](../src/content/m11/l05.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Le harnais impose un modèle minimal, vérifie qu’aucune route montée n’est absente du schéma, que l’authentification déclarée est celle du code, puis rejoue son moteur de règles : le flux non authentifié vers les métadonnées doit produire sa menace. Ce qui n’est pas noté : la pertinence des menaces que tu as choisi de décrire. Passer ce test ne veut pas dire « bon modèle » — ça veut dire « rien d’incohérent détecté ».

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/threats/novafact.dfd.yaml`](solutions/threats/novafact.dfd.yaml)
</details>

<a id="stride-per-element"></a>

### STRIDE par élément, sans trou

**N1** · CWE-1059 · D4 Architecture · Kohnfelder K2

L’atelier de threat modeling a produit onze menaces, toutes sur l’API, aucune sur le stockage ni sur les flux.

**Objectif.** Dans `threats/stride.yaml`, énumérer pour chaque élément du schéma de référence (fixtures/m11/stride-elements.json) les catégories STRIDE applicables, la mitigation, et le fichier qui l’implémente.

**Où.** `threats/stride.yaml`

**Dans le cours.**
- [STRIDE par élément](http://127.0.0.1:5173/#/modules/m11/l02) · [source](../src/content/m11/l02.mdx)
- [Mitigations structurelles](http://127.0.0.1:5173/#/modules/m08/l02) · [source](../src/content/m08/l02.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

La complétude est mécanique, et c’est exactement ce que STRIDE apporte à un atelier : zéro trou, zéro catégorie hors-sujet. Ce qui n’est pas noté : la qualité des menaces décrites. Le harnais refuse en revanche une analyse recopiée — si la même phrase revient d’un élément à l’autre, il le dit.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/threats/stride.yaml`](solutions/threats/stride.yaml)
</details>

<a id="attack-tree"></a>

### L’arbre d’attaque coupé

**N2** · CWE-1059 · D4 Architecture

On sait qu’un locataire ne doit pas lire les factures d’un autre. On ne sait pas par combien de chemins il le pourrait.

**Objectif.** Construire dans `threats/tenant-breach.deciduous.yaml` l’arbre qui mène au vol d’une facture d’un autre tenant, et montrer que chaque chemin est coupé par une mitigation réellement implémentée.

**Où.** `threats/tenant-breach.deciduous.yaml`

**Dans le cours.**
- [Choisir sa méthode](http://127.0.0.1:5173/#/modules/m11/l03) · [source](../src/content/m11/l03.mdx)
- [Mener une Security Design Review](http://127.0.0.1:5173/#/modules/m08/l11) · [source](../src/content/m08/l11.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Le harnais fait de la théorie des graphes : le graphe est acyclique, chaque objectif est atteignable depuis un fait, et tout chemin d’un fait vers un objectif traverse au moins une mitigation implémentée. Une mitigation déclarée mais pas faite laisse le chemin ouvert, et le test nomme le chemin qui reste. Ce qui n’est pas noté : le choix des attaques que tu as mises dans l’arbre.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/threats/tenant-breach.deciduous.yaml`](solutions/threats/tenant-breach.deciduous.yaml)
</details>

<a id="cwe-capec-attack"></a>

### Du CWE à la technique ATT&CK

**N2** · CWE-1059 · D4 Architecture

Les développeurs parlent CWE, les équipes de détection parlent ATT&CK, et personne ne fait le lien.

**Objectif.** Remonter, pour cinq challenges jouables du lab, du défaut au motif d’attaque puis à la technique ATT&CK, dans un CSV `threats/attack-chain.csv` aux colonnes challenge, cwe, capec, attack, attack_name.

**Où.** `threats/attack-chain.csv`

**Dans le cours.**
- [MITRE pour l’AppSec](http://127.0.0.1:5173/#/modules/m11/l04) · [source](../src/content/m11/l04.mdx)
- [Règles, Sigma et detection-as-code](http://127.0.0.1:5173/#/modules/m28/l03) · [source](../src/content/m28/l03.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Aucune interprétation : ce sont des jointures, et le harnais vérifie chaque maillon. L’intérêt est ailleurs — c’est cette chaîne qui permet de dire à une équipe de détection ce qu’elle doit voir passer quand ce défaut-là est exploité.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/threats/attack-chain.csv`](solutions/threats/attack-chain.csv)
</details>

<a id="linddun-privacy"></a>

### LINDDUN sur le parcours de facturation

**N2** · CWE-1059 · D3 Exigences · D4 Architecture

Le threat model couvre la sécurité. Les menaces sur la vie privée — traçabilité, détectabilité, non-conformité — n’ont jamais été regardées.

**Objectif.** Dans `threats/linddun.yaml`, analyser chaque flux du parcours de facturation qui transporte une donnée personnelle, et proposer la mesure pour chacun.

**Où.** `threats/linddun.yaml`

**Dans le cours.**
- [Choisir sa méthode](http://127.0.0.1:5173/#/modules/m11/l03) · [source](../src/content/m11/l03.mdx)
- [Vie privée et RGPD](http://127.0.0.1:5173/#/modules/m07/l04) · [source](../src/content/m07/l04.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Le harnais croise avec la classification : tout flux qui transporte un champ personnel doit être analysé, les catégories doivent appartenir aux sept, et la mesure citée doit pointer un fichier existant. La couverture est décidable ; la pertinence de la mesure ne l’est pas et n’est pas notée. Une même mesure recopiée sur plusieurs flux est en revanche rejetée.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/threats/linddun.yaml`](solutions/threats/linddun.yaml)
</details>

<a id="tm-drift-ci"></a>

### Le modèle qui bloque la PR

**N2** · CWE-1059 · D2 Cycle de vie · D4 Architecture · Kohnfelder K2

Le modèle de menaces a été fait une fois, il y a huit mois. Quinze routes ont été ajoutées depuis.

**Objectif.** Écrire `scripts/tm-drift.mjs`, appelé « node tm-drift.mjs <dossier-server> <modele.json> » : sortie 0 si toute route montée sous ce dossier figure dans le modèle, sortie non nulle sinon, en nommant les routes manquantes.

**Où.** `scripts/tm-drift.mjs`

**Dans le cours.**
- [Threat modeling agile et as code](http://127.0.0.1:5173/#/modules/m11/l05) · [source](../src/content/m11/l05.mdx)
- [Jalons, portes et exceptions](http://127.0.0.1:5173/#/modules/m32/l03) · [source](../src/content/m32/l03.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Le harnais exécute ton script trois fois : sur un arbre conforme (il doit passer), sur un arbre où une route a été ajoutée (il doit bloquer et nommer la route), et sur un modèle incomplet (il doit bloquer). Binaire. C’est ce qui transforme le threat modeling d’un atelier annuel en une vérification continue.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/scripts/tm-drift.mjs`](solutions/scripts/tm-drift.mjs)
</details>

<a id="tm-ai-supply-dev"></a>

### Modéliser l’agent, la chaîne et le poste

**N3** · CWE-1059 · D4 Architecture · D8 Supply chain · Kohnfelder K13

Trois surfaces n’ont jamais été modélisées : l’assistant et ses outils, la chaîne de construction, et l’environnement de développement lui-même.

**Objectif.** Produire `threats/agent.yaml`, `threats/supply-chain.yaml` et `threats/workstation.yaml`, avec pour chacun les frontières de confiance et les menaces que les deux autres ne couvrent pas.

**Où.** `threats/`

**Dans le cours.**
- [Modéliser l’IA, la supply chain et le dev](http://127.0.0.1:5173/#/modules/m11/l06) · [source](../src/content/m11/l06.mdx)
- [Agents et MCP : vue d’ensemble](http://127.0.0.1:5173/#/modules/m30/l01) · [source](../src/content/m30/l01.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Le harnais vérifie la couverture structurelle et la cohérence avec le dépôt : chaque outil de l’agent est modélisé, chaque job du pipeline apparaît, chaque secret joignable depuis un poste est listé, et rien d’inventé. Kohnfelder insiste sur le troisième : le code source est l’actif principal, et le poste du développeur y accède. Ce qui n’est pas noté : la qualité des menaces décrites.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/threats/`](solutions/threats/)
</details>

## M16 · Revue de code sécurité

<a id="attack-surface-map"></a>

### La carte des sources et des sinks

**N1** · CWE-1059 · D5 Implémentation · D6 Tests

Personne n’a de vue d’ensemble de Novafact : ni la liste des routes réellement montées, ni celle des sinks dangereux.

**Objectif.** Cartographier la base dans `review/attack-surface.yaml` comme on le ferait sur un dépôt inconnu : `entrypoints` (route et authentification) et `sinks` (fichier, ligne, famille).

**Où.** `review/attack-surface.yaml`

**Dans le cours.**
- [Méthode sur une base inconnue](http://127.0.0.1:5173/#/modules/m12/l02) · [source](../src/content/m12/l02.mdx)
- [Pourquoi et quand relire](http://127.0.0.1:5173/#/modules/m12/l01) · [source](../src/content/m12/l01.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Le harnais extrait la vérité terrain par analyse du code et mesure les deux erreurs : ce qui a été manqué et ce qui a été inventé. Les seuils sont 90 % des routes, 80 % des sinks, au plus une entrée inventée de chaque côté — tout lister n’est donc pas une stratégie gagnante. C’est l’exercice de méthode le plus automatisable du métier, et celui par lequel commence tout audit.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/review/attack-surface.yaml`](solutions/review/attack-surface.yaml)
</details>

<a id="secbench-sink"></a>

### Trouver le sink d’une vraie CVE

**N2** · CWE-1059 · D5 Implémentation · D6 Tests

On te donne trois paquets npm vulnérables (fixtures/m12/packages/) et leurs avis de sécurité (fixtures/m12/advisories.json). Pas le correctif.

**Objectif.** Localiser le sink de chacun — fichier, ligne, colonne — et nommer la classe de vulnérabilité, dans `review/cve-sink.yaml`.

**Où.** `review/cve-sink.yaml`

**Dans le cours.**
- [Lire des correctifs de CVE](http://127.0.0.1:5173/#/modules/m12/l04) · [source](../src/content/m12/l04.mdx)
- [Méthode sur une base inconnue](http://127.0.0.1:5173/#/modules/m12/l02) · [source](../src/content/m12/l02.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

L’emplacement du sink est recalculé dans les sources à chaque audit : déplacer une ligne déplace la bonne réponse, aucune liste n’est stockée. Et l’exploit sert d’oracle. C’est la méthode de lecture d’un correctif de CVE, jouée à l’envers : on part de l’effet décrit par l’avis et on remonte à l’opération.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/review/cve-sink.yaml`](solutions/review/cve-sink.yaml)
</details>

<a id="review-pr-verdicts"></a>

### La revue de PR notée sur ses verdicts

**N2** · CWE-1059 · D5 Implémentation · D6 Tests

Une pull request touche l’autorisation (fixtures/m12/pr-42.diff). Elle contient de vrais défauts bloquants, et plusieurs leurres plausibles.

**Objectif.** Rendre un verdict par constat dans `review/pr-42.yaml` : bloquant, a-corriger, suggestion, ou acceptable.

**Où.** `review/pr-42.yaml`

**Dans le cours.**
- [Revoir une PR en 10 minutes](http://127.0.0.1:5173/#/modules/m12/l03) · [source](../src/content/m12/l03.mdx)
- [Revue orientée autorisation](http://127.0.0.1:5173/#/modules/m12/l05) · [source](../src/content/m12/l05.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

La PR est fabriquée pour ça : le harnais sait quelles lignes portent le défaut et lesquelles sont des leurres. Un bloquant manqué échoue, un leurre marqué bloquant échoue aussi — parce que bloquer à tort coûte la confiance de l’équipe, et qu’on ne la récupère pas. C’est la seule façon honnête d’automatiser une revue : la qualité du commentaire, elle, relève de la persuasion et n’est pas notée.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/review/pr-42.yaml`](solutions/review/pr-42.yaml)
</details>

<a id="review-ai-pr"></a>

### Revoir une PR écrite par une IA

**N2** · CWE-1078 · D5 Implémentation · D6 Tests

Une pull request générée par un agent (fixtures/m12/ai-pr.diff) ajoute une fonctionnalité plausible : validation absente, dépendance inventée, secret en dur, crypto approximative.

**Objectif.** Rendre la revue dans `review/ai-pr.yaml`, et refuser la PR pour les bonnes raisons.

**Où.** `review/ai-pr.yaml`

**Dans le cours.**
- [Revoir du code généré par IA](http://127.0.0.1:5173/#/modules/m12/l06) · [source](../src/content/m12/l06.mdx)
- [Revoir une PR en 10 minutes](http://127.0.0.1:5173/#/modules/m12/l03) · [source](../src/content/m12/l03.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Deux constats sur quatre sont mécaniquement décidables et c’est sur eux qu’on note : le paquet ajouté n’existe pas dans l’instantané, et le secret est détecté par motif — aucun des deux n’est stocké comme réponse, les deux sont recalculés depuis le diff. Les deux autres sont vérifiés par le test de régression après correction. Le volume change, la méthode non : vérifier l’existence de chaque dépendance ajoutée devient un réflexe.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/review/ai-pr.yaml`](solutions/review/ai-pr.yaml)
</details>

<a id="timeboxed-audit"></a>

### Quatre heures, et on rend

**N3** · CWE-1059 · D5 Implémentation · D6 Tests

Un dépôt qu’on ne connaît pas, une journée, et une question : qu’est-ce qui peut faire perdre de l’argent à ce client ?

**Objectif.** Rendre dans `review/audit-report.yaml` les trois constats de plus fort impact, avec leur chemin d’exploitation.

**Où.** `review/audit-report.yaml`

**Dans le cours.**
- [Audit ciblé et limité dans le temps](http://127.0.0.1:5173/#/modules/m12/l07) · [source](../src/content/m12/l07.mdx)
- [Pourquoi et quand relire](http://127.0.0.1:5173/#/modules/m12/l01) · [source](../src/content/m12/l01.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Le harnais connaît le classement de référence par impact et note le résultat — pas la stratégie, qui n’est pas observable et n’est donc pas notée. Aller de la surface exposée vers les actifs de valeur, comme en revue de conception, reste la méthode qui rend le mieux sur un temps court.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/review/audit-report.yaml`](solutions/review/audit-report.yaml)
</details>

## M17 · Tests & analyse de code

<a id="test-strategy"></a>

### Où placer chaque technique

**N1** · CWE-1059 · D6 Tests

Tout tourne à chaque commit : la CI met dix-huit minutes et l’équipe la contourne. Six techniques à replacer — analyse statique, composition, secrets, DAST, fuzzing, régression.

**Objectif.** Produire `workspace/program/test-strategy.yaml` : pour chaque technique, l’étape, le caractère bloquant, le budget de temps et le déclencheur, en cohérence avec les workflows réels de `novafact/.github/workflows/`.

**Où.** `program/test-strategy.yaml`

**Dans le cours.**
- [Stratégie de test de sécurité](http://127.0.0.1:5173/#/modules/m13/l01) · [source](../src/content/m13/l01.mdx)
- [Jalons, portes et exceptions](http://127.0.0.1:5173/#/modules/m32/l03) · [source](../src/content/m32/l03.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Une technique au mauvais endroit est soit un frein qu’on contourne, soit un filet qui arrive trop tard. Le budget de temps sur le chemin critique est une contrainte de conception, pas un détail d’exploitation : c’est lui qui décide de ce qui peut y entrer.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/program/test-strategy.yaml`](solutions/program/test-strategy.yaml)
</details>

<a id="eslint-rule"></a>

### La règle qui attrape la classe

**N2** · CWE-1059 · D5 Implémentation · D6 Tests

Le mass assignment a été corrigé à un endroit. Rien n’empêche le prochain développeur de le réintroduire ailleurs.

**Objectif.** Écrire `workspace/rules/no-body-spread.js`, la règle d’analyse statique qui interdit la classe, et la faire passer sur les pièges de `fixtures/m13/eslint-cases.json`.

**Où.** `rules/no-body-spread.js`

**Dans le cours.**
- [SAST pour JavaScript](http://127.0.0.1:5173/#/modules/m13/l03) · [source](../src/content/m13/l03.mdx)
- [Écrire ses règles](http://127.0.0.1:5173/#/modules/m13/l04) · [source](../src/content/m13/l04.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Corriger une instance protège une route ; écrire la règle protège la classe, y compris le code qui n’est pas encore écrit. Et le différentiel valide/invalide est ce qui rend la règle honnête : une règle qui signale tout est aussi inutile qu’une règle qui ne signale rien, et seuls les faux positifs décident de sa survie en CI.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/rules/no-body-spread.js`](solutions/rules/no-body-spread.js)
</details>

<a id="sbom-generate"></a>

### Générer le SBOM, et le garder juste

**N2** · CWE-1059 · D6 Tests · D8 Supply chain

Le SBOM a été produit une fois, à la main, il y a quatre mois. Personne ne sait s’il décrit encore l’application. Son arbre de dépendances est dans `fixtures/m13/app/` (package.json et package-lock.json).

**Objectif.** Produire `workspace/sbom.cdx.json` : le SBOM CycloneDX de cette application, fidèle à son lockfile.

**Où.** `sbom.cdx.json`

**Dans le cours.**
- [SCA et SBOM](http://127.0.0.1:5173/#/modules/m13/l06) · [source](../src/content/m13/l06.mdx)
- [Outillage, SLA et dépendances npm](http://127.0.0.1:5173/#/modules/m05/l05) · [source](../src/content/m05/l05.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Un SBOM faux est pire qu’absent : il répond faux le jour de l’incident, quand la question « est-ce qu’on a ce paquet ? » doit trouver sa réponse en trente secondes. Ce qui le garde juste, c’est de le régénérer à chaque build depuis le lockfile, et de faire échouer la CI quand il diverge.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/sbom.cdx.json`](solutions/sbom.cdx.json)
</details>

<a id="test-data-generator"></a>

### Des données de test qui ne viennent pas de la prod

**N2** · CWE-359 · D6 Tests · D3 Exigences

Le jeu de test a été extrait de la production « pour être réaliste ». Il contient de vrais IBAN et de vraies adresses. Dix de ces enregistrements sont dans `fixtures/m13/seed-suspects.json`, à côté de dix enregistrements synthétiques conformes.

**Objectif.** Écrire `workspace/scripts/seed.mjs`, qui exporte `generate({ graine, nombre })` — des données représentatives et déterministes — et `suspect(enregistrement)` — la règle qui interdit d’y remettre du réel.

**Où.** `scripts/seed.mjs`

**Dans le cours.**
- [Données de test](http://127.0.0.1:5173/#/modules/m13/l08) · [source](../src/content/m13/l08.mdx)
- [Classification des données](http://127.0.0.1:5173/#/modules/m07/l03) · [source](../src/content/m07/l03.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Copier la production, c’est étendre le périmètre de conformité — RGPD, PCI DSS — à l’environnement de test, à ses sauvegardes et aux postes des développeurs. Le générateur déterministe règle en plus le problème d’à côté : une régression ne se rejoue que si la donnée qui l’a déclenchée se reproduit.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/scripts/seed.mjs`](solutions/scripts/seed.mjs)
</details>

<a id="malicious-postinstall"></a>

### Script d’installation malveillant

**N3** · CWE-506 · D5 Implémentation · D8 Supply chain

Une dépendance embarquée (`fixtures/m13/suspect-package/`) déclare un script d’installation obfusqué — inerte, mais représentatif de ce qu’on trouve dans une vague Shai-Hulud.

**Objectif.** Produire `workspace/review/postinstall.yaml` : le paquet et le script en cause, ce que le script ferait, et le garde-fou qui l’empêche de s’exécuter.

**Où.** `review/postinstall.yaml`

**Dans le cours.**
- [Inspecter du code malveillant](http://127.0.0.1:5173/#/modules/m13/l09) · [source](../src/content/m13/l09.mdx)
- [Sécuriser l’environnement de dev](http://127.0.0.1:5173/#/modules/m14/l03) · [source](../src/content/m14/l03.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Le verdict est un effet observable, pas une déclaration : c’est la seule façon de savoir si un garde-fou tient. Et celui-ci se pose une fois pour toutes, sur le poste comme sur le runner — c’est le vecteur d’exécution des vers qui frappent npm depuis 2025, d’event-stream à Shai-Hulud.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/review/postinstall.yaml`](solutions/review/postinstall.yaml)
</details>

<a id="ai-review-eval"></a>

### Évaluer un relecteur IA

**N3** · CWE-1059 · D5 Implémentation · D6 Tests

Un relecteur IA a rendu trente constats sur Novafact (`fixtures/m13/ai-review.json`). Certains sont justes, d’autres sont des hallucinations plausibles. Les défauts réellement présents sont listés dans `fixtures/m13/known-defects.json`.

**Objectif.** Trancher chaque constat dans `workspace/review/ai-eval.csv`, puis mesurer précision et rappel dans `workspace/review/ai-eval-metrics.json`.

**Où.** `review/ai-eval.csv`

**Dans le cours.**
- [L’IA dans l’analyse de code](http://127.0.0.1:5173/#/modules/m13/l10) · [source](../src/content/m13/l10.mdx)
- [Revoir du code généré par IA](http://127.0.0.1:5173/#/modules/m12/l06) · [source](../src/content/m12/l06.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Ce qu’on mesure au passage, c’est le coût réel de l’outil. Un relecteur qui rend trois constats à écarter pour un constat juste consomme plus de temps d’ingénieur qu’il n’en fait gagner — et c’est la seule façon de le savoir avant de l’imposer à toute l’organisation. La mesure se refait à chaque changement de modèle.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/review/ai-eval.csv`](solutions/review/ai-eval.csv)
</details>

## M18 · Pipeline, supply chain & fournisseurs

<a id="gha-permissions"></a>

### Permissions de workflow trop larges

**N1** · CWE-732 · D7 Déploiement & exploitation · D8 Supply chain

Les workflows tournent avec le jeton par défaut, en écriture sur tout le dépôt.

**Objectif.** Déclarer les permissions au minimum nécessaire dans chaque workflow, sans laisser de write-all.

**Où.** `novafact/.github/workflows/ci.yml`

**Dans le cours.**
- [Durcir GitHub Actions](http://127.0.0.1:5173/#/modules/m14/l02) · [source](../src/content/m14/l02.mdx)
- [OWASP Top 10 CI/CD](http://127.0.0.1:5173/#/modules/m14/l01) · [source](../src/content/m14/l01.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Le minimum au niveau du workflow, puis le strict nécessaire par job. Une permission accordée « au cas où » est une permission qu’un script compromis utilisera. CICD-SEC-5, OpenSSF Scorecard `Token-Permissions`.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/novafact/.github/workflows/ci.yml`](solutions/novafact/.github/workflows/ci.yml)
</details>

<a id="gha-injection"></a>

### Injection de template dans un run

**N2** · CWE-94 · D7 Déploiement & exploitation · D8 Supply chain

Un workflow interpole le titre d’une issue directement dans un bloc `run`. Ce titre devient une commande shell.

**Objectif.** Faire passer la donnée non fiable par l’environnement, et la citer dans le script.

**Où.** `novafact/.github/workflows/triage.yml`

**Dans le cours.**
- [Durcir GitHub Actions](http://127.0.0.1:5173/#/modules/m14/l02) · [source](../src/content/m14/l02.mdx)
- [Outils du pipeline](http://127.0.0.1:5173/#/modules/m14/l04) · [source](../src/content/m14/l04.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Les entrées non fiables passent par l’environnement et sont citées, jamais interpolées dans le script. `zizmor` (règle `template-injection`) et `actionlint` attrapent le motif. Cas Ultralytics, déc. 2024.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/novafact/.github/workflows/triage.yml`](solutions/novafact/.github/workflows/triage.yml)
</details>

<a id="gha-pwn-request"></a>

### Pwn request sur pull_request_target

**N2** · CWE-269 · D7 Déploiement & exploitation · D8 Supply chain

Un workflow `pull_request_target` fait un checkout du commit de la pull request puis lance le build — donc exécute du code de fork avec les secrets du dépôt.

**Objectif.** Faire en sorte qu’aucun code non revu ne s’exécute dans un contexte qui a les secrets.

**Où.** `novafact/.github/workflows/pr-check.yml`

**Dans le cours.**
- [Durcir GitHub Actions](http://127.0.0.1:5173/#/modules/m14/l02) · [source](../src/content/m14/l02.mdx)
- [Cas réels de supply chain](http://127.0.0.1:5173/#/modules/m14/l08) · [source](../src/content/m14/l08.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Séparer le job qui construit (déclenché par `pull_request`, sans secret) du job qui commente (avec un jeton minimal), ou exiger une approbation via `environment`. Cas « s1ngularity » sur nx, août 2025.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/novafact/.github/workflows/pr-check.yml`](solutions/novafact/.github/workflows/pr-check.yml)
</details>

<a id="gha-unpinned"></a>

### Actions non épinglées au SHA

**N1** · CWE-1357 · D7 Déploiement & exploitation · D8 Supply chain

Les actions tierces sont référencées par étiquette mobile, que leur mainteneur peut repointer à tout moment.

**Objectif.** Épingler chaque action tierce à un SHA de commit de 40 caractères.

**Où.** `novafact/.github/workflows/ci.yml`

**Dans le cours.**
- [Durcir GitHub Actions](http://127.0.0.1:5173/#/modules/m14/l02) · [source](../src/content/m14/l02.mdx)
- [SLSA, Sigstore et provenance](http://127.0.0.1:5173/#/modules/m14/l10) · [source](../src/content/m14/l10.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

SHA de 40 caractères, Renovate pour les mises à jour, et la politique d’organisation qui l’impose. Cas `tj-actions/changed-files` (CVE-2025-30066, mars 2025).

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/novafact/.github/workflows/ci.yml`](solutions/novafact/.github/workflows/ci.yml)
</details>

<a id="gha-typosquat-action"></a>

### Action typosquattée

**N2** · CWE-1357 · D8 Supply chain

Un workflow référence une action dont le nom de propriétaire est presque celui de l’action officielle.

**Objectif.** Corriger la référence, pour que toutes les actions viennent de propriétaires connus.

**Où.** `novafact/.github/workflows/ci.yml`

**Dans le cours.**
- [Choisir un composant](http://127.0.0.1:5173/#/modules/m14/l06) · [source](../src/content/m14/l06.mdx)
- [Durcir GitHub Actions](http://127.0.0.1:5173/#/modules/m14/l02) · [source](../src/content/m14/l02.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Une lettre manquante suffit : le typosquat vise le pipeline comme il vise npm. Liste blanche d’actions au niveau de l’organisation, épinglage par SHA. `zizmor` : `typosquat-uses`.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/novafact/.github/workflows/ci.yml`](solutions/novafact/.github/workflows/ci.yml)
</details>

<a id="gha-artipacked"></a>

### Identifiants git publiés dans un artefact

**N2** · CWE-522 · D7 Déploiement & exploitation · D8 Supply chain

Le checkout laisse le jeton dans `.git/config`, et l’étape d’upload téléverse la racine du dépôt.

**Objectif.** Empêcher la persistance des identifiants et restreindre le chemin téléversé.

**Où.** `novafact/.github/workflows/ci.yml`

**Dans le cours.**
- [Durcir GitHub Actions](http://127.0.0.1:5173/#/modules/m14/l02) · [source](../src/content/m14/l02.mdx)
- [Sécuriser l’environnement de dev](http://127.0.0.1:5173/#/modules/m14/l03) · [source](../src/content/m14/l03.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Un artefact est souvent public : tout ce qui y entre est publié. Recherche ArtiPACKED (Unit 42, août 2024), règle `zizmor` `artipacked`.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/novafact/.github/workflows/ci.yml`](solutions/novafact/.github/workflows/ci.yml)
</details>

<a id="gha-curl-bash"></a>

### Script tiers exécuté sans vérification

**N2** · CWE-494 · D7 Déploiement & exploitation · D8 Supply chain

Une étape de CI télécharge un script et l’exécute directement, sans contrôle d’empreinte.

**Objectif.** Supprimer l’exécution directe d’un script téléchargé à la volée.

**Où.** `novafact/.github/workflows/ci.yml`

**Dans le cours.**
- [Outils du pipeline](http://127.0.0.1:5173/#/modules/m14/l04) · [source](../src/content/m14/l04.mdx)
- [Cas réels de supply chain](http://127.0.0.1:5173/#/modules/m14/l08) · [source](../src/content/m14/l08.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Un script téléchargé à chaque exécution est une dépendance non versionnée. Empreinte épinglée, ou paquet installé depuis un registre avec lockfile. Compromission du Bash Uploader Codecov (2021).

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/novafact/.github/workflows/ci.yml`](solutions/novafact/.github/workflows/ci.yml)
</details>

<a id="npm-ci-lockfile"></a>

### npm install en intégration continue

**N1** · CWE-1104 · D8 Supply chain

La CI lance une installation qui réécrit le lockfile et autorise des résolutions que personne n’a validées.

**Objectif.** Rendre l’installation reproductible dans tous les workflows.

**Où.** `novafact/.github/workflows/ci.yml`

**Dans le cours.**
- [npm : installer et publier](http://127.0.0.1:5173/#/modules/m14/l05) · [source](../src/content/m14/l05.mdx)
- [SCA et SBOM](http://127.0.0.1:5173/#/modules/m13/l06) · [source](../src/content/m13/l06.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

`npm ci` installe exactement le lockfile, ou échoue. Sans cela, la CI et le poste du développeur n’exécutent pas le même code. OpenSSF Scorecard `Pinned-Dependencies`, CICD-SEC-3.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/novafact/.github/workflows/ci.yml`](solutions/novafact/.github/workflows/ci.yml)
</details>

<a id="gha-secrets-inherit"></a>

### secrets: inherit vers un workflow réutilisable

**N2** · CWE-668 · D7 Déploiement & exploitation · D8 Supply chain

Un job appelle un workflow réutilisable en lui transmettant tous les secrets du dépôt, alors qu’il n’en utilise qu’un.

**Objectif.** Ne transmettre nommément que le secret nécessaire.

**Où.** `novafact/.github/workflows/release.yml`

**Dans le cours.**
- [Durcir GitHub Actions](http://127.0.0.1:5173/#/modules/m14/l02) · [source](../src/content/m14/l02.mdx)
- [Fournisseurs et tiers](http://127.0.0.1:5173/#/modules/m14/l09) · [source](../src/content/m14/l09.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Mapping explicite. `inherit` est commode et c’est exactement son problème. `zizmor` : `secrets-inherit`, `overprovisioned-secrets`. CICD-SEC-6.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/novafact/.github/workflows/release.yml`](solutions/novafact/.github/workflows/release.yml)
</details>

<a id="gha-cache-poisoning"></a>

### Empoisonnement du cache Actions

**N3** · CWE-349 · D7 Déploiement & exploitation · D8 Supply chain

La clé du cache contient une valeur contrôlée par l’auteur d’une PR, et ce cache est restauré par le workflow qui publie le SDK.

**Objectif.** Faire qu’aucun job de publication ne restaure un cache dont la clé dépend d’une entrée contrôlable.

**Où.** `novafact/.github/workflows/release.yml`

**Dans le cours.**
- [Durcir GitHub Actions](http://127.0.0.1:5173/#/modules/m14/l02) · [source](../src/content/m14/l02.mdx)
- [Cas réels de supply chain](http://127.0.0.1:5173/#/modules/m14/l08) · [source](../src/content/m14/l08.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Ce qu’un job faiblement privilégié dépose dans le cache, un job privilégié le restaure et l’exécute. `zizmor` : `cache-poisoning`. Cas Ultralytics, déc. 2024.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/novafact/.github/workflows/release.yml`](solutions/novafact/.github/workflows/release.yml)
</details>

<a id="npm-provenance"></a>

### Publication sans provenance

**N2** · CWE-345 · D7 Déploiement & exploitation · D8 Supply chain

Le job de release publie le SDK avec un jeton de longue durée, sans provenance ni publication de confiance.

**Objectif.** Publier par OIDC avec attestation de provenance, et supprimer le jeton de longue durée.

**Où.** `novafact/.github/workflows/release.yml`

**Dans le cours.**
- [SLSA, Sigstore et provenance](http://127.0.0.1:5173/#/modules/m14/l10) · [source](../src/content/m14/l10.mdx)
- [npm : installer et publier](http://127.0.0.1:5173/#/modules/m14/l05) · [source](../src/content/m14/l05.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

La publication de confiance supprime le secret à voler ; la provenance permet de vérifier d’où vient le paquet et par quel workflow il a été construit.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/novafact/.github/workflows/release.yml`](solutions/novafact/.github/workflows/release.yml)
</details>

<a id="gha-bot-condition"></a>

### Condition « acteur bot » usurpable

**N2** · CWE-290 · D7 Déploiement & exploitation · D8 Supply chain

Une fusion automatique est gardée par une comparaison sur le nom de l’acteur, dans un contexte où cette valeur ne prouve rien.

**Objectif.** Retirer la garde usurpable, ou l’auto-merge qu’elle protège.

**Où.** `novafact/.github/workflows/automerge.yml`

**Dans le cours.**
- [Durcir GitHub Actions](http://127.0.0.1:5173/#/modules/m14/l02) · [source](../src/content/m14/l02.mdx)
- [OWASP Top 10 CI/CD](http://127.0.0.1:5173/#/modules/m14/l01) · [source](../src/content/m14/l01.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Vérifier le type de l’auteur de la PR et le déclencheur, ou exiger une revue humaine. CICD-SEC-1. `zizmor` : `bot-conditions`.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/novafact/.github/workflows/automerge.yml`](solutions/novafact/.github/workflows/automerge.yml)
</details>

<a id="gha-self-hosted"></a>

### Runner self-hosted ouvert aux forks

**N2** · CWE-668 · D7 Déploiement & exploitation · D8 Supply chain

Un workflow déclenché par les pull requests tourne sur un runner self-hosted, sans approbation préalable.

**Objectif.** Empêcher qu’un code de fork s’exécute sur une machine persistante qu’on possède.

**Où.** `novafact/.github/workflows/e2e.yml`

**Dans le cours.**
- [Durcir GitHub Actions](http://127.0.0.1:5173/#/modules/m14/l02) · [source](../src/content/m14/l02.mdx)
- [Sécuriser l’environnement de dev](http://127.0.0.1:5173/#/modules/m14/l03) · [source](../src/content/m14/l03.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Runners hébergés pour tout ce qui vient d’un fork, ou approbation obligatoire via `environment`, et runners jetables sinon.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/novafact/.github/workflows/e2e.yml`](solutions/novafact/.github/workflows/e2e.yml)
</details>

<a id="codeowners-ci"></a>

### CODEOWNERS qui ne couvre pas la CI

**N1** · CWE-1391 · D7 Déploiement & exploitation · D8 Supply chain

Le fichier protège `src/` mais pas les workflows, ni la configuration npm, ni le lockfile : on peut modifier le pipeline sans revue dédiée.

**Objectif.** Router les chemins sensibles — et seulement eux — vers l’équipe sécurité.

**Où.** `novafact/.github/CODEOWNERS`

**Dans le cours.**
- [Durcir GitHub Actions](http://127.0.0.1:5173/#/modules/m14/l02) · [source](../src/content/m14/l02.mdx)
- [Revoir une PR en 10 minutes](http://127.0.0.1:5173/#/modules/m12/l03) · [source](../src/content/m12/l03.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Le pipeline est du code de production : il mérite la même revue, par les bonnes personnes. CODEOWNERS route aussi vers l’AppSec ce qui touche l’authentification et la crypto. CICD-SEC-1.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/novafact/.github/CODEOWNERS`](solutions/novafact/.github/CODEOWNERS)
</details>

<a id="npmrc-ignore-scripts"></a>

### Scripts d’installation non neutralisés

**N2** · CWE-506 · D8 Supply chain

Rien n’empêche les scripts d’installation des dépendances de s’exécuter, ni sur le poste ni sur le runner.

**Objectif.** Neutraliser par défaut les scripts d’installation.

**Où.** `novafact/.npmrc`

**Dans le cours.**
- [Sécuriser l’environnement de dev](http://127.0.0.1:5173/#/modules/m14/l03) · [source](../src/content/m14/l03.mdx)
- [npm : installer et publier](http://127.0.0.1:5173/#/modules/m14/l05) · [source](../src/content/m14/l05.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

`ignore-scripts=true` (pnpm 10 le fait déjà), plus une allowlist pour les rares paquets à compiler. Vecteur du ver Shai-Hulud comme d’event-stream.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/novafact/.npmrc`](solutions/novafact/.npmrc)
</details>

<a id="npm-token-in-repo"></a>

### Jeton de publication dans le dépôt

**N1** · CWE-798 · D7 Déploiement & exploitation · D8 Supply chain

Un `.npmrc` versionné contient un jeton d’authentification en clair.

**Objectif.** Sortir le jeton du dépôt, en gardant une configuration qui marche en CI.

**Où.** `novafact/.npmrc`

**Dans le cours.**
- [npm : installer et publier](http://127.0.0.1:5173/#/modules/m14/l05) · [source](../src/content/m14/l05.mdx)
- [DAST et secrets](http://127.0.0.1:5173/#/modules/m13/l07) · [source](../src/content/m13/l07.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Un secret exposé se **révoque** d’abord : le retirer du fichier ne le retire ni de l’historique ni des clones. Détection en pre-commit et push protection côté forge.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/novafact/.npmrc`](solutions/novafact/.npmrc)
</details>

<a id="dependency-confusion"></a>

### Confusion de dépendances sur le scope interne

**N2** · CWE-427 · D8 Supply chain

Le projet dépend d’un paquet interne sans que son scope soit associé à un registre privé.

**Objectif.** Associer chaque scope interne à son registre.

**Où.** `novafact/.npmrc`

**Dans le cours.**
- [npm : installer et publier](http://127.0.0.1:5173/#/modules/m14/l05) · [source](../src/content/m14/l05.mdx)
- [Choisir un composant](http://127.0.0.1:5173/#/modules/m14/l06) · [source](../src/content/m14/l06.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Publier une version très haute sur le registre public suffit à détourner l’installation. Scope épinglé au registre privé, et nom de scope réservé publiquement. Alex Birsan (2021).

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/novafact/.npmrc`](solutions/novafact/.npmrc)
</details>

<a id="lockfile-integrity"></a>

### Lockfile détourné

**N2** · CWE-494 · D8 Supply chain

Une entrée du lockfile pointe vers un registre tiers et n’a pas d’empreinte d’intégrité.

**Objectif.** Rétablir le registre officiel et une empreinte pour chaque entrée.

**Où.** `novafact/package-lock.json`

**Dans le cours.**
- [npm : installer et publier](http://127.0.0.1:5173/#/modules/m14/l05) · [source](../src/content/m14/l05.mdx)
- [Choisir un composant](http://127.0.0.1:5173/#/modules/m14/l06) · [source](../src/content/m14/l06.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Un lockfile se relit comme du code : une PR qui modifie `resolved` ou `integrity` sans raison est un signal. Recherche « lockfile injection » (Liran Tal, Snyk, 2022).

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/novafact/package-lock.json`](solutions/novafact/package-lock.json)
</details>

<a id="npm-pack-leak"></a>

### Fuite de fichiers dans le paquet publié

**N1** · CWE-538 · D8 Supply chain

Le `package.json` ne déclare pas ce qui doit être publié : tests, scripts et fichiers de configuration partent dans le tarball.

**Objectif.** Restreindre le contenu publié aux seuls artefacts de distribution.

**Où.** `novafact/package.json`

**Dans le cours.**
- [SLSA, Sigstore et provenance](http://127.0.0.1:5173/#/modules/m14/l10) · [source](../src/content/m14/l10.mdx)
- [npm : installer et publier](http://127.0.0.1:5173/#/modules/m14/l05) · [source](../src/content/m14/l05.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Un champ `files` en liste blanche, et `npm pack --dry-run` lu en revue comme un diff. Ce qui part dans le tarball est public et définitif.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/novafact/package.json`](solutions/novafact/package.json)
</details>

<a id="vendor-build-mismatch"></a>

### L’artefact ne correspond pas au source

**N3** · CWE-506 · D8 Supply chain

Un paquet vendorisé livre un build « minifié » qui ne correspond pas à ses sources : une ligne s’y est ajoutée.

**Objectif.** Repérer l’écart entre le build livré et les sources, et rétablir un artefact fidèle.

**Où.** `novafact/vendor/novafact-parser/build/index.min.js`

**Dans le cours.**
- [Cas réels de supply chain](http://127.0.0.1:5173/#/modules/m14/l08) · [source](../src/content/m14/l08.mdx)
- [Répondre à un incident supply chain](http://127.0.0.1:5173/#/modules/m14/l11) · [source](../src/content/m14/l11.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

C’est la leçon d’xz-utils (CVE-2024-3094) et d’event-stream : le code malveillant était dans le tarball publié, pas dans le dépôt git. Builds reproductibles, attestations de provenance, vérification à l’installation. On ne relit pas ce qu’on n’a pas construit.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/novafact/vendor/novafact-parser/build/index.min.js`](solutions/novafact/vendor/novafact-parser/build/index.min.js)
</details>

## M19 · IAM AWS

<a id="iam-wildcard"></a>

### Politique en joker

**N1** · CWE-732 · D1 Concepts · D7 Déploiement & exploitation

Le rôle de la tâche ECS porte une autorisation totale sur toutes les ressources, « le temps de faire marcher le déploiement ».

**Objectif.** Réécrire la politique au moindre privilège à partir des appels réellement faits par l’application.

**Où.** `novafact/infra/iam/task-role.json`

**Dans le cours.**
- [Le modèle IAM et la logique d’évaluation](http://127.0.0.1:5173/#/modules/m15/l01) · [source](../src/content/m15/l01.mdx)
- [Moindre privilège en pratique](http://127.0.0.1:5173/#/modules/m15/l05) · [source](../src/content/m15/l05.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Partir de l’usage : Access Analyzer génère une politique depuis les appels observés, et les accès inutilisés se lisent dans la console. Puis figer avec des clés de condition et vérifier en CI. Une politique écrite à la main part toujours trop large.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/novafact/infra/iam/task-role.json`](solutions/novafact/infra/iam/task-role.json)
</details>

<a id="iam-no-users"></a>

### Zéro utilisateur IAM

**N1** · CWE-522 · D1 Concepts · D7 Déploiement & exploitation

Trois utilisateurs IAM portent des clés d’accès permanentes, dont une créée il y a deux ans et jamais tournée.

**Objectif.** Supprimer les identifiants de longue durée au profit de rôles et d’identifiants temporaires, sans couper l’intégration continue.

**Où.** `novafact/infra/iam/users.json`

**Dans le cours.**
- [Zéro utilisateur IAM](http://127.0.0.1:5173/#/modules/m15/l02) · [source](../src/content/m15/l02.mdx)
- [Moindre privilège en pratique](http://127.0.0.1:5173/#/modules/m15/l05) · [source](../src/content/m15/l05.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Un identifiant permanent finit dans un dépôt, un journal ou un poste. Identity Center pour les humains, rôles et OIDC pour les machines, et le compte racine verrouillé. Le harnais vérifie qu’aucune clé permanente ne subsiste et que chaque accès passe par une assomption de rôle.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/novafact/infra/iam/users.json`](solutions/novafact/infra/iam/users.json)
</details>

<a id="iam-stringequals-wildcard"></a>

### Le joker sous le mauvais opérateur

**N1** · CWE-183 · D1 Concepts · D7 Déploiement & exploitation

Une condition compare une valeur contenant un joker avec un opérateur d’égalité stricte : elle ne correspond jamais, ce qui pousse à l’élargir jusqu’à ce que « ça marche ».

**Objectif.** Corriger l’opérateur et vérifier que la condition filtre réellement ce qu’elle prétend filtrer.

**Où.** `novafact/infra/iam/deploy-role.json`

**Dans le cours.**
- [Le modèle IAM et la logique d’évaluation](http://127.0.0.1:5173/#/modules/m15/l01) · [source](../src/content/m15/l01.mdx)
- [Escalade et abus](http://127.0.0.1:5173/#/modules/m15/l04) · [source](../src/content/m15/l04.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Un joker exige l’opérateur de correspondance de motif ; sous l’opérateur d’égalité il est pris au pied de la lettre. Une condition qui ne correspond jamais est pire qu’absente : elle donne l’impression d’un contrôle, et on la retire au premier incident de production.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/novafact/infra/iam/deploy-role.json`](solutions/novafact/infra/iam/deploy-role.json)
</details>

<a id="iam-passrole"></a>

### Chemin d’escalade par PassRole

**N2** · CWE-269 · D1 Concepts · D7 Déploiement & exploitation

Un rôle de déploiement cumule le droit de passer un rôle et celui de créer une fonction. Deux permissions anodines, un chemin vers l’administration.

**Objectif.** Décrire le chemin d’escalade, puis le couper avec le moins de changements possible.

**Où.** `novafact/infra/iam/deploy-role.json`

**Dans le cours.**
- [Escalade et abus](http://127.0.0.1:5173/#/modules/m15/l04) · [source](../src/content/m15/l04.mdx)
- [Le modèle IAM et la logique d’évaluation](http://127.0.0.1:5173/#/modules/m15/l01) · [source](../src/content/m15/l01.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Restreindre le passage de rôle aux ARN précis qu’on a le droit de passer, avec la condition de service destinataire. Les escalades IAM ne viennent presque jamais d’une permission unique : elles viennent de combinaisons que personne n’a regardées ensemble.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/novafact/infra/iam/deploy-role.json`](solutions/novafact/infra/iam/deploy-role.json)
</details>

<a id="iam-create-policy-version"></a>

### Le rôle qui peut se réécrire

**N2** · CWE-269 · D1 Concepts · D7 Déploiement & exploitation

La politique du rôle applicatif autorise la création et l’activation d’une version de politique : il peut se donner tous les droits.

**Objectif.** Retirer les actions auto-référençantes et vérifier qu’aucune ne subsiste dans le périmètre applicatif.

**Où.** `novafact/infra/iam/app-policy.json`

**Dans le cours.**
- [Escalade et abus](http://127.0.0.1:5173/#/modules/m15/l04) · [source](../src/content/m15/l04.mdx)
- [Moindre privilège en pratique](http://127.0.0.1:5173/#/modules/m15/l05) · [source](../src/content/m15/l05.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Il existe une liste connue d’actions qui permettent l’escalade — créer une version de politique, attacher une politique, mettre à jour une politique d’approbation, créer une clé d’accès, créer un profil de connexion. Aucune n’a sa place dans un rôle applicatif, et le harnais les refuse toutes.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/novafact/infra/iam/app-policy.json`](solutions/novafact/infra/iam/app-policy.json)
</details>

<a id="iam-oidc-trust"></a>

### Trust policy OIDC mal filtrée

**N2** · CWE-1220 · D1 Concepts · D7 Déploiement & exploitation · D8 Supply chain · Kohnfelder K4

Le rôle assumé par la CI fait confiance au fournisseur d’identité sans filtrer le dépôt ni la branche : n’importe quel dépôt GitHub du monde peut le prendre.

**Objectif.** Restreindre au dépôt et à la référence exacts, puis vérifier qu’aucune politique d’approbation ne reste ouverte.

**Où.** `novafact/infra/iam/github-oidc.json`

**Dans le cours.**
- [Escalade et abus](http://127.0.0.1:5173/#/modules/m15/l04) · [source](../src/content/m15/l04.mdx)
- [Durcir GitHub Actions](http://127.0.0.1:5173/#/modules/m14/l02) · [source](../src/content/m14/l02.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Condition sur le sujet avec le dépôt **et** la référence attendus, audience vérifiée. C’est le confused deputy de Kohnfelder en version AWS : le rôle agit pour le compte de qui le demande. Des recherches ont trouvé en 2023 des rôles de production assumables par tout dépôt public.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/novafact/infra/iam/github-oidc.json`](solutions/novafact/infra/iam/github-oidc.json)
</details>

<a id="iam-oidc-org-wildcard"></a>

### Le joker d’organisation

**N2** · CWE-1220 · D1 Concepts · D7 Déploiement & exploitation

La condition autorise tous les dépôts de l’organisation : un prototype créé par un stagiaire obtient le rôle de déploiement en production.

**Objectif.** Restreindre au dépôt et à l’environnement exacts, et prouver qu’un autre dépôt est refusé.

**Où.** `novafact/infra/iam/github-oidc.json`

**Dans le cours.**
- [Escalade et abus](http://127.0.0.1:5173/#/modules/m15/l04) · [source](../src/content/m15/l04.mdx)
- [Multi-comptes et data perimeter](http://127.0.0.1:5173/#/modules/m15/l06) · [source](../src/content/m15/l06.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Un joker d’organisation transforme chaque nouveau dépôt en chemin d’accès à la production. L’environnement GitHub, avec son approbation, est le bon grain de séparation — et il se lit dans le sujet du jeton.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/novafact/infra/iam/github-oidc.json`](solutions/novafact/infra/iam/github-oidc.json)
</details>

<a id="iam-external-id"></a>

### Accès inter-comptes sans ExternalId

**N2** · CWE-441 · D1 Concepts · D7 Déploiement & exploitation · Kohnfelder K4

Un rôle partenaire fait confiance au compte d’un tiers sans condition d’identifiant externe ni d’organisation.

**Objectif.** Ajouter la condition, et vérifier qu’aucune politique d’approbation inter-comptes n’en est dépourvue.

**Où.** `novafact/infra/iam/partner-role.json`

**Dans le cours.**
- [Multi-comptes et data perimeter](http://127.0.0.1:5173/#/modules/m15/l06) · [source](../src/content/m15/l06.mdx)
- [Les 4 anti-patterns](http://127.0.0.1:5173/#/modules/m08/l04) · [source](../src/content/m08/l04.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Sans identifiant externe, tout client du même prestataire peut demander à ce prestataire d’agir sur ton compte : c’est le confused deputy dans sa forme canonique, et AWS a créé cette condition exactement pour ça.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/novafact/infra/iam/partner-role.json`](solutions/novafact/infra/iam/partner-role.json)
</details>

<a id="iam-not-action"></a>

### Le Deny qui ne refuse rien

**N2** · CWE-183 · D1 Concepts · D7 Déploiement & exploitation

Un refus est écrit avec une négation d’action sur toutes les ressources : il ne protège rien d’utile et donne l’impression d’un garde-fou.

**Objectif.** Réécrire le refus en énumérant les actions sensibles, et justifier toute négation qui subsiste.

**Où.** `novafact/infra/iam/scp.json`

**Dans le cours.**
- [Le modèle IAM et la logique d’évaluation](http://127.0.0.1:5173/#/modules/m15/l01) · [source](../src/content/m15/l01.mdx)
- [Multi-comptes et data perimeter](http://127.0.0.1:5173/#/modules/m15/l06) · [source](../src/content/m15/l06.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Une politique en négation se lit à l’envers et se trompe de sens dès qu’on l’édite. Les refus explicites sont relisibles, testables, et se comparent d’une revue à l’autre.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/novafact/infra/iam/scp.json`](solutions/novafact/infra/iam/scp.json)
</details>

<a id="iam-forallvalues"></a>

### L’opérateur qui échoue en ouvert

**N3** · CWE-183 · D1 Concepts · D7 Déploiement & exploitation

Une politique restreint l’accès par un opérateur d’ensemble sur une clé mono-valuée : quand la clé est absente, l’opérateur renvoie vrai et l’appelant anonyme passe.

**Objectif.** Corriger l’opérateur, ou ajouter le refus qui traite explicitement l’absence de la clé.

**Où.** `novafact/infra/iam/invoices-bucket-policy.json`

**Dans le cours.**
- [Le modèle IAM et la logique d’évaluation](http://127.0.0.1:5173/#/modules/m15/l01) · [source](../src/content/m15/l01.mdx)
- [Multi-comptes et data perimeter](http://127.0.0.1:5173/#/modules/m15/l06) · [source](../src/content/m15/l06.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Les opérateurs d’ensemble ont un comportement contre-intuitif sur une clé absente : c’est le piège du sixième challenge du Big IAM Challenge. Tester une politique avec le simulateur, et refuser explicitement ce qui n’est pas identifié.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/novafact/infra/iam/invoices-bucket-policy.json`](solutions/novafact/infra/iam/invoices-bucket-policy.json)
</details>

<a id="s3-bucket-policy-public"></a>

### Politique de bucket ouverte

**N1** · CWE-732 · D1 Concepts · D7 Déploiement & exploitation

La politique du bucket des factures accorde la lecture à tout le monde, sans condition.

**Objectif.** Restreindre à la distribution qui doit y accéder, et retirer le droit de lister.

**Où.** `novafact/infra/iam/invoices-bucket-policy.json`

**Dans le cours.**
- [Le modèle IAM et la logique d’évaluation](http://127.0.0.1:5173/#/modules/m15/l01) · [source](../src/content/m15/l01.mdx)
- [L’IaC comme surface](http://127.0.0.1:5173/#/modules/m16/l01) · [source](../src/content/m16/l01.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Un principal universel sans condition est une publication. Accès par contrôle d’origine, condition sur l’ARN source, blocage d’accès public au niveau du compte. Le droit de lister un bucket est ce qui transforme une fuite en inventaire — c’est le premier niveau de flAWS.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/novafact/infra/iam/invoices-bucket-policy.json`](solutions/novafact/infra/iam/invoices-bucket-policy.json)
</details>

<a id="ecs-task-vs-execution"></a>

### Rôle de tâche et rôle d’exécution confondus

**N2** · CWE-269 · D1 Concepts · D7 Déploiement & exploitation

La définition de tâche utilise le même rôle pour tirer l’image et pour exécuter le code, et ce rôle lit tous les secrets du compte.

**Objectif.** Séparer les deux rôles et restreindre la lecture de secret à ceux dont l’application a besoin.

**Où.** `novafact/infra/ecs/task-definition.json`

**Dans le cours.**
- [Workloads Node.js](http://127.0.0.1:5173/#/modules/m15/l03) · [source](../src/content/m15/l03.mdx)
- [Plateformes AWS](http://127.0.0.1:5173/#/modules/m17/l04) · [source](../src/content/m17/l04.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Le rôle d’exécution sert à l’agent pour démarrer le conteneur ; le rôle de tâche est celui que le code obtient. Les confondre donne au code applicatif les droits de la plateforme — et une exécution de code arbitraire lit alors tous les secrets. C’est la structure de la brèche Capital One.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/novafact/infra/ecs/task-definition.json`](solutions/novafact/infra/ecs/task-definition.json)
</details>

<a id="kms-key-policy"></a>

### Politique de clé trop permissive

**N2** · CWE-732 · D1 Concepts · D7 Déploiement & exploitation · Kohnfelder K5

La politique de la clé de chiffrement accorde toutes les opérations à un principal universel, « parce que c’est plus simple ».

**Objectif.** Restreindre aux rôles nommés et au service appelant, sans casser le déchiffrement applicatif.

**Où.** `novafact/infra/iam/kms-key-policy.json`

**Dans le cours.**
- [Le modèle IAM et la logique d’évaluation](http://127.0.0.1:5173/#/modules/m15/l01) · [source](../src/content/m15/l01.mdx)
- [Crypto pour développeurs](http://127.0.0.1:5173/#/modules/m08/l08) · [source](../src/content/m08/l08.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Le chiffrement au repos ne vaut que ce que vaut la politique de la clé : si tout le monde peut déchiffrer, le chiffrement ne fait que cocher une case d’audit. Condition sur le service appelant, et séparation entre qui administre la clé et qui l’utilise.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/novafact/infra/iam/kms-key-policy.json`](solutions/novafact/infra/iam/kms-key-policy.json)
</details>

<a id="permission-boundary"></a>

### La CI qui peut se fabriquer un admin

**N3** · CWE-269 · D1 Concepts · D7 Déploiement & exploitation

Le rôle assumé par la CI peut créer des rôles et leur attacher des politiques, sans limite supérieure.

**Objectif.** Poser la limite de permission qui empêche la CI de créer plus de droits qu’elle n’en a.

**Où.** `novafact/infra/iam/deploy-role.json`

**Dans le cours.**
- [Escalade et abus](http://127.0.0.1:5173/#/modules/m15/l04) · [source](../src/content/m15/l04.mdx)
- [Multi-comptes et data perimeter](http://127.0.0.1:5173/#/modules/m15/l06) · [source](../src/content/m15/l06.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Une limite de permission borne ce qu’un rôle créé peut obtenir, quelle que soit la politique qu’on lui attache. Sans elle, « créer un rôle » vaut « devenir administrateur » en deux appels. Condition imposant la limite sur les actions de création.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/novafact/infra/iam/deploy-role.json`](solutions/novafact/infra/iam/deploy-role.json)
</details>

<a id="data-perimeter"></a>

### Le périmètre de données

**N3** · CWE-732 · D4 Architecture · D7 Déploiement & exploitation

Rien n’empêche une identité du compte d’écrire dans un bucket qui n’appartient pas à l’organisation, ni une identité extérieure de lire les nôtres.

**Objectif.** Poser les trois périmètres — identité, ressource, réseau — et vérifier qu’ils tiennent ensemble.

**Où.** `novafact/infra/iam/scp.json`

**Dans le cours.**
- [Multi-comptes et data perimeter](http://127.0.0.1:5173/#/modules/m15/l06) · [source](../src/content/m15/l06.mdx)
- [Le modèle IAM et la logique d’évaluation](http://127.0.0.1:5173/#/modules/m15/l01) · [source](../src/content/m15/l01.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Les conditions d’organisation, d’ARN source et de point de terminaison forment un filet qui rattrape ce que les politiques individuelles laissent passer. C’est ce qui transforme « chaque politique est juste » en « l’exfiltration est structurellement impossible » — et qui survit à la prochaine politique mal écrite.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/novafact/infra/iam/scp.json`](solutions/novafact/infra/iam/scp.json)
</details>

## M20 · Infrastructure as Code

<a id="tf-public-bucket"></a>

### Bucket des pièces jointes exposé

**N1** · CWE-1188 · D7 Déploiement & exploitation

Le bucket des pièces jointes n’a ni blocage d’accès public, ni chiffrement, ni versioning, ni journalisation des accès.

**Objectif.** Corriger le module et faire passer le scanner sans la moindre exception.

**Où.** `novafact/infra/terraform/storage.tf`

**Dans le cours.**
- [L’IaC comme surface](http://127.0.0.1:5173/#/modules/m16/l01) · [source](../src/content/m16/l01.mdx)
- [Scanners IaC](http://127.0.0.1:5173/#/modules/m16/l02) · [source](../src/content/m16/l02.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Blocage d’accès public au niveau du compte, chiffrement par défaut, versioning, journalisation, et accès par contrôle d’origine plutôt que par politique publique. Le scanner en CI n’est utile que s’il bloque : en mode avertissement, il devient du bruit qu’on apprend à ignorer.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/novafact/infra/terraform/storage.tf`](solutions/novafact/infra/terraform/storage.tf)
</details>

<a id="tf-open-sg"></a>

### Groupe de sécurité ouvert

**N1** · CWE-284 · D7 Déploiement & exploitation

Un groupe de sécurité autorise le monde entier sur les ports d’administration et de base de données.

**Objectif.** Refermer sans couper l’accès légitime, puis écrire la règle qui empêche la récidive.

**Où.** `novafact/infra/terraform/network.tf`

**Dans le cours.**
- [L’IaC comme surface](http://127.0.0.1:5173/#/modules/m16/l01) · [source](../src/content/m16/l01.mdx)
- [Policy as code](http://127.0.0.1:5173/#/modules/m16/l03) · [source](../src/content/m16/l03.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Pas d’accès administratif entrant du tout — la session managée le remplace —, base de données en sous-réseau privé joignable par le seul groupe de l’application. Puis une politique en code qui refuse l’ouverture au monde sur un port d’administration.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/novafact/infra/terraform/network.tf`](solutions/novafact/infra/terraform/network.tf)
</details>

<a id="tf-rds-hardening"></a>

### Base de données non durcie

**N2** · CWE-1188 · D7 Déploiement & exploitation

L’instance de base est accessible publiquement, non chiffrée, sans protection contre la suppression, sans sauvegarde et sans instantané final.

**Objectif.** Inverser les cinq réglages, et vérifier qu’aucun n’est réintroduit par une variante d’environnement.

**Où.** `novafact/infra/terraform/database.tf`

**Dans le cours.**
- [Scanners IaC](http://127.0.0.1:5173/#/modules/m16/l02) · [source](../src/content/m16/l02.mdx)
- [Résilience et continuité](http://127.0.0.1:5173/#/modules/m17/l06) · [source](../src/content/m17/l06.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Ces cinq attributs sont la définition d’une base de production. Les scanners les connaissent tous — la valeur de l’exercice est de voir qu’un module peut être juste en préproduction et faux en production, parce que le défaut est dans la variable, pas dans la ressource.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/novafact/infra/terraform/database.tf`](solutions/novafact/infra/terraform/database.tf)
</details>

<a id="tf-state-secret"></a>

### Secret dans le code et dans le state

**N2** · CWE-798 · D7 Déploiement & exploitation · D8 Supply chain

Le mot de passe de la base est écrit en clair dans le code. Il se retrouve donc aussi dans le state.

**Objectif.** Sortir le secret du code et du state, et le lire depuis le gestionnaire de secrets.

**Où.** `novafact/infra/terraform/database.tf`

**Dans le cours.**
- [State, pipeline et supply chain IaC](http://127.0.0.1:5173/#/modules/m16/l04) · [source](../src/content/m16/l04.mdx)
- [Policy as code](http://127.0.0.1:5173/#/modules/m16/l03) · [source](../src/content/m16/l03.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Le state contient en clair tout ce que les ressources connaissent : un secret qui passe par une variable y arrive quand même. Secret généré et stocké côté gestionnaire, référencé par source de données, et variable marquée sensible.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/novafact/infra/terraform/database.tf`](solutions/novafact/infra/terraform/database.tf)
</details>

<a id="tf-state-committed"></a>

### Le state versionné

**N1** · CWE-538 · D7 Déploiement & exploitation · D8 Supply chain

Un fichier de state est suivi par le dépôt. Il contient le mot de passe de la base et la valeur d’un secret.

**Objectif.** Le retirer, l’exclure, déclarer un backend distant — et considérer les secrets qu’il contenait comme brûlés.

**Où.** `novafact/infra/terraform/.gitignore`

**Dans le cours.**
- [State, pipeline et supply chain IaC](http://127.0.0.1:5173/#/modules/m16/l04) · [source](../src/content/m16/l04.mdx)
- [DAST et secrets](http://127.0.0.1:5173/#/modules/m13/l07) · [source](../src/content/m13/l07.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Le harnais vérifie qu’aucun fichier de state n’est suivi et qu’une règle d’exclusion existe. Et comme pour tout secret exposé : le retirer du dépôt ne le retire pas de l’historique. Ce qui est dans le state est à révoquer.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/novafact/infra/terraform/.gitignore`](solutions/novafact/infra/terraform/.gitignore)
</details>

<a id="tf-backend"></a>

### Backend non chiffré et non verrouillé

**N2** · CWE-311 · D7 Déploiement & exploitation

Le backend distant n’a ni chiffrement, ni clé gérée, ni table de verrouillage : deux applications concurrentes peuvent corrompre l’état.

**Objectif.** Chiffrer, verrouiller, et restreindre l’accès au bucket de state.

**Où.** `novafact/infra/terraform/backend.tf`

**Dans le cours.**
- [State, pipeline et supply chain IaC](http://127.0.0.1:5173/#/modules/m16/l04) · [source](../src/content/m16/l04.mdx)
- [Policy as code](http://127.0.0.1:5173/#/modules/m16/l03) · [source](../src/content/m16/l03.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Le state est l’actif le plus sensible de l’IaC : il décrit toute l’infrastructure et contient ses secrets. Chiffrement, verrou, accès séparé entre le rôle qui planifie et celui qui applique.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/novafact/infra/terraform/backend.tf`](solutions/novafact/infra/terraform/backend.tf)
</details>

<a id="tf-unpinned-provider"></a>

### Provider et module non épinglés

**N2** · CWE-1357 · D7 Déploiement & exploitation · D8 Supply chain

La contrainte de version du provider est ouverte vers le haut, et un module est tiré d’un dépôt git sans référence figée.

**Objectif.** Épingler le provider avec son fichier de verrouillage, et le module sur une empreinte de commit.

**Où.** `novafact/infra/terraform/versions.tf`

**Dans le cours.**
- [State, pipeline et supply chain IaC](http://127.0.0.1:5173/#/modules/m16/l04) · [source](../src/content/m16/l04.mdx)
- [SLSA, Sigstore et provenance](http://127.0.0.1:5173/#/modules/m14/l10) · [source](../src/content/m14/l10.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

La supply chain de l’IaC obéit aux mêmes règles que celle du code : une référence mobile peut être repointée, et le premier `apply` qui suit part en production. C’est la transposition directe de l’incident tj-actions.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/novafact/infra/terraform/versions.tf`](solutions/novafact/infra/terraform/versions.tf)
</details>

<a id="tf-alb-tls"></a>

### Répartiteur en clair et TLS obsolète

**N2** · CWE-319 · D7 Déploiement & exploitation

Le répartiteur sert le port 80 au lieu de rediriger, utilise une politique TLS de 2016, et n’écrit pas de journaux d’accès.

**Objectif.** Rediriger vers HTTPS, remonter la politique TLS, activer les journaux.

**Où.** `novafact/infra/terraform/alb.tf`

**Dans le cours.**
- [Scanners IaC](http://127.0.0.1:5173/#/modules/m16/l02) · [source](../src/content/m16/l02.mdx)
- [Plateformes AWS](http://127.0.0.1:5173/#/modules/m17/l04) · [source](../src/content/m17/l04.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Les journaux d’accès du répartiteur sont souvent la seule trace d’une attaque protocolaire — désynchronisation, empoisonnement de cache. Les activer relève autant de la détection que du durcissement.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/novafact/infra/terraform/alb.tf`](solutions/novafact/infra/terraform/alb.tf)
</details>

<a id="cloudfront-waf"></a>

### Distribution sans WAF ni TLS minimum

**N2** · CWE-693 · D7 Déploiement & exploitation

La distribution accepte le HTTP en clair, n’est associée à aucun pare-feu applicatif, et son WAF est en mode comptage avec une action par défaut permissive.

**Objectif.** Forcer HTTPS, associer les règles managées, passer en blocage, ajouter une limite de débit.

**Où.** `novafact/infra/terraform/cloudfront.tf`

**Dans le cours.**
- [Scanners IaC](http://127.0.0.1:5173/#/modules/m16/l02) · [source](../src/content/m16/l02.mdx)
- [Plateformes AWS](http://127.0.0.1:5173/#/modules/m17/l04) · [source](../src/content/m17/l04.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Un WAF en mode comptage ne bloque rien : c’est utile deux semaines pour régler les faux positifs, pas neuf mois. Et une limite de débit au bord protège l’application de ce que la limitation applicative ne voit jamais.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/novafact/infra/terraform/cloudfront.tf`](solutions/novafact/infra/terraform/cloudfront.tf)
</details>

<a id="imdsv1-terraform"></a>

### IMDSv1 laissé actif

**N2** · CWE-918 · D7 Déploiement & exploitation

Le modèle de lancement autorise la version 1 du service de métadonnées : une SSRF suffit à obtenir les identifiants de l’instance.

**Objectif.** Exiger la version 2 et limiter le nombre de sauts, sur toutes les ressources concernées.

**Où.** `novafact/infra/terraform/compute.tf`

**Dans le cours.**
- [L’IaC comme surface](http://127.0.0.1:5173/#/modules/m16/l01) · [source](../src/content/m16/l01.mdx)
- [Workloads Node.js](http://127.0.0.1:5173/#/modules/m15/l03) · [source](../src/content/m15/l03.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

La version 2 exige une requête préalable qu’une SSRF simple ne sait pas faire, et la limite de sauts empêche un conteneur d’atteindre les métadonnées de son hôte. C’est le contrôle qui aurait cassé la chaîne de Capital One.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/novafact/infra/terraform/compute.tf`](solutions/novafact/infra/terraform/compute.tf)
</details>

<a id="cdk-wildcard"></a>

### Joker IAM dans le code CDK

**N2** · CWE-732 · D7 Déploiement & exploitation

Une politique écrite en TypeScript accorde toutes les actions d’un service sur toutes les ressources, et une méthode d’octroi automatique va trop large.

**Objectif.** Restreindre aux actions et aux ressources nécessaires, et le vérifier sur le template généré.

**Où.** `novafact/infra/cdk/lib/api-stack.ts`

**Dans le cours.**
- [L’IaC comme surface](http://127.0.0.1:5173/#/modules/m16/l01) · [source](../src/content/m16/l01.mdx)
- [Moindre privilège en pratique](http://127.0.0.1:5173/#/modules/m15/l05) · [source](../src/content/m15/l05.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Le harnais génère le template hors ligne et l’inspecte : c’est ce que la plateforme verra réellement. Les méthodes d’octroi du CDK sont pratiques et souvent plus larges qu’on ne croit — il faut lire ce qu’elles produisent.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/novafact/infra/cdk/lib/api-stack.ts`](solutions/novafact/infra/cdk/lib/api-stack.ts)
</details>

<a id="cdk-nag-disabled"></a>

### Les garde-fous débranchés

**N2** · CWE-1059 · D7 Déploiement & exploitation

L’analyse de conformité n’est pas branchée sur l’application CDK, et plusieurs suppressions sont posées avec un motif vide.

**Objectif.** Rebrancher l’analyse et ne garder que les suppressions réellement justifiées.

**Où.** `novafact/infra/cdk/bin/app.ts`

**Dans le cours.**
- [Policy as code](http://127.0.0.1:5173/#/modules/m16/l03) · [source](../src/content/m16/l03.mdx)
- [Jalons, portes et exceptions](http://127.0.0.1:5173/#/modules/m32/l03) · [source](../src/content/m32/l03.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Une suppression sans motif est une dette anonyme : le harnais exige un motif substantiel référençant un ticket, et refuse toute annotation d’erreur non supprimée. C’est le même problème que les exceptions de scanner — sans date ni motif, elles deviennent permanentes.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/novafact/infra/cdk/bin/app.ts`](solutions/novafact/infra/cdk/bin/app.ts)
</details>

<a id="cdk-bootstrap"></a>

### Bootstrap CDK par défaut

**N3** · CWE-732 · D7 Déploiement & exploitation · D8 Supply chain

Le bootstrap utilise le qualificatif par défaut, et le rôle de publication d’artefacts n’a pas de condition sur le compte propriétaire.

**Objectif.** Définir un qualificatif propre et ajouter la condition de compte sur le rôle de publication.

**Où.** `novafact/infra/cdk/cdk.json`

**Dans le cours.**
- [State, pipeline et supply chain IaC](http://127.0.0.1:5173/#/modules/m16/l04) · [source](../src/content/m16/l04.mdx)
- [Escalade et abus](http://127.0.0.1:5173/#/modules/m15/l04) · [source](../src/content/m15/l04.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Le qualificatif par défaut rend les noms de ressources prévisibles à l’échelle de tout le cloud : une recherche de 2024 a montré qu’un bucket de bootstrap supprimé pouvait être repris par un tiers, qui contrôlait alors les déploiements. Corrigé depuis côté CDK, mais le motif se retrouve partout où un nom est devinable.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/novafact/infra/cdk/cdk.json`](solutions/novafact/infra/cdk/cdk.json)
</details>

<a id="tf-logging"></a>

### Journalisation d’infrastructure absente

**N2** · CWE-778 · D7 Déploiement & exploitation

Ni journaux de flux réseau, ni piste d’audit multi-région avec validation d’intégrité, ni pilote de journalisation sur les conteneurs.

**Objectif.** Poser les trois, et vérifier qu’aucune ressource n’échappe à la collecte.

**Où.** `novafact/infra/terraform/logging.tf`

**Dans le cours.**
- [Dérive et runtime](http://127.0.0.1:5173/#/modules/m16/l05) · [source](../src/content/m16/l05.mdx)
- [Ingestion dans Elastic](http://127.0.0.1:5173/#/modules/m18/l03) · [source](../src/content/m18/l03.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Ce qui n’est pas journalisé n’existera pas le jour de l’investigation. La validation d’intégrité de la piste d’audit est ce qui permet de prouver qu’elle n’a pas été retouchée — c’est la première chose qu’un attaquant essaie de couper.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/novafact/infra/terraform/logging.tf`](solutions/novafact/infra/terraform/logging.tf)
</details>

## M21 · Déploiement, exploitation & résilience

<a id="debug-endpoint"></a>

### Endpoint de diagnostic laissé ouvert

**N1** · CWE-489 · D7 Déploiement & exploitation

Une route de diagnostic, ajoutée pour une investigation, renvoie la configuration et les variables d’environnement.

**Objectif.** Récupérer la configuration complète du service, secrets compris, sans être authentifié.

**Où.** `server/index.ts`

**Dans le cours.**
- [Configuration de production](http://127.0.0.1:5173/#/modules/m17/l01) · [source](../src/content/m17/l01.mdx)
- [DAST et secrets](http://127.0.0.1:5173/#/modules/m13/l07) · [source](../src/content/m13/l07.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Les fonctionnalités non documentées sont une surface : inventaire des routes réellement montées en production, et rien de diagnostique qui ne soit authentifié et tracé. Vérifier la documentation fait partie des tests de sécurité.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/index.ts`](solutions/server/index.ts)
</details>

<a id="dockerfile"></a>

### Image de conteneur trop permissive

**N2** · CWE-250 · D7 Déploiement & exploitation

L’image tourne en root, embarque les dépendances de développement et reçoit un secret par argument de build.

**Objectif.** Réécrire l’image : minimale, utilisateur non privilégié, aucun secret dans les couches.

**Où.** `novafact/Dockerfile`

**Dans le cours.**
- [Conteneurs Node.js](http://127.0.0.1:5173/#/modules/m17/l02) · [source](../src/content/m17/l02.mdx)
- [npm : installer et publier](http://127.0.0.1:5173/#/modules/m14/l05) · [source](../src/content/m14/l05.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Construction multi-étapes, dépendances de production seulement, utilisateur non privilégié, système de fichiers en lecture seule, secrets montés au build. Un secret passé par argument reste dans l’historique des couches même si le fichier est supprimé ensuite.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/novafact/Dockerfile`](solutions/novafact/Dockerfile)
</details>

<a id="docker-base-pinning"></a>

### Image de base non épinglée

**N1** · CWE-1357 · D7 Déploiement & exploitation · D8 Supply chain

L’image de base est référencée par étiquette mobile : deux constructions à une semaine d’écart ne produisent pas le même système.

**Objectif.** Épingler par empreinte, et brancher le renouvellement automatique.

**Où.** `novafact/Dockerfile`

**Dans le cours.**
- [Conteneurs Node.js](http://127.0.0.1:5173/#/modules/m17/l02) · [source](../src/content/m17/l02.mdx)
- [SLSA, Sigstore et provenance](http://127.0.0.1:5173/#/modules/m14/l10) · [source](../src/content/m14/l10.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Une étiquette est un alias qui bouge ; l’empreinte est l’image. Sans épinglage, ni la reproductibilité ni l’attestation de provenance ne veulent dire grand-chose.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/novafact/Dockerfile`](solutions/novafact/Dockerfile)
</details>

<a id="dockerignore"></a>

### Tout le dépôt dans l’image

**N1** · CWE-538 · D7 Déploiement & exploitation

L’image copie la racine du dépôt sans exclusion : l’historique git, les fichiers d’environnement et le state IaC partent dedans.

**Objectif.** Restreindre ce qui entre dans l’image, et le vérifier sur l’image construite.

**Où.** `novafact/.dockerignore`

**Dans le cours.**
- [Conteneurs Node.js](http://127.0.0.1:5173/#/modules/m17/l02) · [source](../src/content/m17/l02.mdx)
- [DAST et secrets](http://127.0.0.1:5173/#/modules/m13/l07) · [source](../src/content/m13/l07.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Le dossier git embarqué contient souvent des identifiants — c’est le mécanisme d’ArtiPACKED. Une liste d’exclusion, ou mieux, des copies explicites de ce dont l’image a besoin.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/novafact/.dockerignore`](solutions/novafact/.dockerignore)
</details>

<a id="k8s-securitycontext"></a>

### Pod sans contexte de sécurité

**N2** · CWE-250 · D7 Déploiement & exploitation

Le déploiement ne déclare ni utilisateur non privilégié, ni interdiction d’élévation, ni système de fichiers en lecture seule, et partage le réseau de l’hôte.

**Objectif.** Poser le contexte complet et retirer le partage réseau, sans casser le démarrage.

**Où.** `novafact/infra/k8s/deployment.yaml`

**Dans le cours.**
- [Plateformes AWS](http://127.0.0.1:5173/#/modules/m17/l04) · [source](../src/content/m17/l04.mdx)
- [Policy as code](http://127.0.0.1:5173/#/modules/m16/l03) · [source](../src/content/m16/l03.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Les valeurs par défaut de Kubernetes sont permissives ; les standards de sécurité des pods existent pour les remplacer d’un bloc. Et une politique d’admission rend le durcissement obligatoire plutôt que recommandé.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/novafact/infra/k8s/deployment.yaml`](solutions/novafact/infra/k8s/deployment.yaml)
</details>

<a id="k8s-rbac"></a>

### RBAC avec des jokers

**N2** · CWE-732 · D7 Déploiement & exploitation

Le compte de service de l’API a tous les verbes sur toutes les ressources, et le jeton est monté dans des pods qui n’en ont pas besoin.

**Objectif.** Énumérer les droits réellement nécessaires et couper le montage automatique du jeton.

**Où.** `novafact/infra/k8s/rbac.yaml`

**Dans le cours.**
- [Plateformes AWS](http://127.0.0.1:5173/#/modules/m17/l04) · [source](../src/content/m17/l04.mdx)
- [Moindre privilège en pratique](http://127.0.0.1:5173/#/modules/m15/l05) · [source](../src/content/m15/l05.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Un jeton de compte de service monté dans un pod est un identifiant accessible à toute exécution de code dans ce pod. Le couper quand il ne sert pas est le geste le plus rentable du durcissement Kubernetes.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/novafact/infra/k8s/rbac.yaml`](solutions/novafact/infra/k8s/rbac.yaml)
</details>

<a id="docker-socket"></a>

### Socket Docker monté dans le conteneur

**N2** · CWE-250 · D7 Déploiement & exploitation

Le service de construction monte le socket du démon et tourne en mode privilégié, et la base est exposée sur toutes les interfaces.

**Objectif.** Retirer le montage et le privilège, et lier la base à la boucle locale.

**Où.** `novafact/docker-compose.yml`

**Dans le cours.**
- [Plateformes AWS](http://127.0.0.1:5173/#/modules/m17/l04) · [source](../src/content/m17/l04.mdx)
- [Sécuriser l’environnement de dev](http://127.0.0.1:5173/#/modules/m14/l03) · [source](../src/content/m14/l03.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Le socket du démon équivaut à un accès root sur l’hôte : le monter dans un conteneur annule l’isolation qu’on croyait avoir. C’est le scénario d’évasion le plus fréquent, et il est presque toujours mis là « pour faire tourner les tests ».

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/novafact/docker-compose.yml`](solutions/novafact/docker-compose.yml)
</details>

<a id="backup-immutable"></a>

### Sauvegardes qu’un attaquant peut effacer

**N2** · CWE-1188 · D7 Déploiement & exploitation

Les sauvegardes vivent dans le même compte, avec un rôle qui peut les supprimer, et aucune restauration n’a jamais été testée.

**Objectif.** Rendre les sauvegardes immuables et inter-comptes, et écrire le test de restauration.

**Où.** `novafact/infra/terraform/backup.tf`

**Dans le cours.**
- [Résilience et continuité](http://127.0.0.1:5173/#/modules/m17/l06) · [source](../src/content/m17/l06.mdx)
- [Multi-comptes et data perimeter](http://127.0.0.1:5173/#/modules/m15/l06) · [source](../src/content/m15/l06.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Un rançongiciel cloud commence par les sauvegardes : verrou d’immuabilité, copie dans un compte séparé dont le premier ne peut rien supprimer, et restauration testée — une sauvegarde jamais restaurée est une hypothèse, pas un plan.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/novafact/infra/terraform/backup.tf`](solutions/novafact/infra/terraform/backup.tf)
</details>

<a id="signed-artifacts"></a>

### Publier en sécurité

**N2** · CWE-345 · D7 Déploiement & exploitation · D8 Supply chain

N’importe quelle image portant le bon nom part en production : rien ne vérifie qui l’a construite ni depuis quel commit.

**Objectif.** Signer les artefacts à la construction, et n’admettre au déploiement que ceux dont la signature est vérifiée.

**Où.** `novafact/.github/workflows/deploy.yml`

**Dans le cours.**
- [Publier en sécurité](http://127.0.0.1:5173/#/modules/m17/l03) · [source](../src/content/m17/l03.mdx)
- [SLSA, Sigstore et provenance](http://127.0.0.1:5173/#/modules/m14/l10) · [source](../src/content/m14/l10.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Signature à la construction, vérification à l’admission — sans la seconde, la première ne protège de rien. Et la chaîne de provenance doit dire quel commit, quel workflow, quel runner.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/novafact/.github/workflows/deploy.yml`](solutions/novafact/.github/workflows/deploy.yml)
</details>

## M23 · Journalisation & SIEM (Elastic)

<a id="logging-vocabulary"></a>

### Le vocabulaire imposé

**N1** · CWE-778 · D5 Implémentation · D7 Déploiement & exploitation

Les journaux racontent en texte libre : « échec de connexion pour untel », « accès refusé ». Aucune règle ne peut s’appuyer dessus. Huit scénarios sont dans `fixtures/m18/vocabulary/scenarios.json`, avec le contexte dont le code dispose au moment d’écrire la ligne.

**Objectif.** Écrire le catalogue qui donne à chaque scénario son identifiant d’événement normalisé et les champs obligatoires de sa ligne.

**Où.** `logging/vocabulary.yaml`

**Dans le cours.**
- [Journaliser pour la sécurité](http://127.0.0.1:5173/#/modules/m18/l01) · [source](../src/content/m18/l01.mdx)
- [C-I-A et Gold Standard](http://127.0.0.1:5173/#/modules/m01/l03) · [source](../src/content/m01/l03.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Un journal est une interface : il a un schéma, des consommateurs, et il se casse comme une API. Le vocabulaire d’OWASP existe précisément pour que la règle écrite sur une application marche sur la suivante. Ce qui n’est pas noté : le niveau de gravité que vous attribuez, et les champs de contexte au-delà du socle.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/logging/vocabulary.yaml`](solutions/logging/vocabulary.yaml)
</details>

<a id="never-log"></a>

### Ce qu’il ne faut jamais journaliser

**N1** · CWE-532 · D3 Exigences · D7 Déploiement & exploitation

Mots de passe, jetons, IBAN et numéros de carte se retrouvent dans les lignes de journal, parce qu’on journalise le corps des requêtes. Le corpus `fixtures/m18/redaction/` en est plein.

**Objectif.** Écrire les règles de caviardage : plus aucun secret dans le corpus, et la détection de référence lève toujours ses douze vrais positifs.

**Où.** `logging/redaction.yaml`

**Dans le cours.**
- [Journaliser pour la sécurité](http://127.0.0.1:5173/#/modules/m18/l01) · [source](../src/content/m18/l01.mdx)
- [Vie privée et RGPD](http://127.0.0.1:5173/#/modules/m07/l04) · [source](../src/content/m07/l04.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

La formulation canonique du vocabulaire OWASP est la bonne : journaliser l’identifiant de règle et le **nom** du paramètre, jamais sa valeur. Un journal est une copie de la donnée : il hérite de sa classification, de sa durée de conservation et de son périmètre d’accès.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/logging/redaction.yaml`](solutions/logging/redaction.yaml)
</details>

<a id="ecs-fields"></a>

### Les champs qui manquent à la corrélation

**N2** · CWE-778 · D7 Déploiement & exploitation

Une règle de détection fournie (`fixtures/m18/ecs-fields/rule.yaml`) a besoin de l’adresse source, de l’utilisateur, du résultat et de la méthode. L’application émet bien ces informations, mais sous ses propres noms : `ip`, `who`, `ok`, `verb`.

**Objectif.** Écrire la correspondance qui normalise le journal brut, pour que la règle, inchangée, se mette à lever ses douze alertes.

**Où.** `logging/field-mapping.yaml`

**Dans le cours.**
- [Ingestion dans Elastic](http://127.0.0.1:5173/#/modules/m18/l03) · [source](../src/content/m18/l03.mdx)
- [Journaliser pour la sécurité](http://127.0.0.1:5173/#/modules/m18/l01) · [source](../src/content/m18/l01.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

La règle passe de zéro à douze alertes sans qu’une ligne de règle ne bouge : une détection est un contrat sur le schéma des journaux. C’est pour ça que le schéma vient avant les règles, et pas l’inverse — et pour ça qu’un renommage de champ est un changement cassant.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/logging/field-mapping.yaml`](solutions/logging/field-mapping.yaml)
</details>

<a id="ecs-lint"></a>

### Le lint sémantique du schéma

**N2** · CWE-1059 · D7 Déploiement & exploitation

Les vingt-quatre lignes de `fixtures/m18/ecs-lint/events.ndjson` portent les bons noms de champs, mais neuf d’entre elles ont des valeurs hors énumération ou des combinaisons incohérentes.

**Objectif.** Produire le corpus réparé : énumérations respectées, contraintes croisées tenues, et les vingt-quatre lignes toujours là.

**Où.** `logging/events.ndjson`

**Dans le cours.**
- [Ingestion dans Elastic](http://127.0.0.1:5173/#/modules/m18/l03) · [source](../src/content/m18/l03.mdx)
- [Stratégie de test de sécurité](http://127.0.0.1:5173/#/modules/m13/l01) · [source](../src/content/m13/l01.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Une catégorie d’authentification impose un type dans une liste fermée et un résultat renseigné. Ces contraintes croisées sont ce qui permet aux requêtes d’être écrites une fois et de marcher partout — un champ juste dans un schéma faux ne sert à rien. C’est aussi ce que valide le lint du dépôt de règles d’Elastic, à l’ingestion.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/logging/events.ndjson`](solutions/logging/events.ndjson)
</details>

<a id="logging-inventory"></a>

### L’inventaire de journalisation

**N2** · CWE-778 · D3 Exigences · D7 Déploiement & exploitation

Personne ne sait ce que l’application journalise. Les exigences demandent un inventaire documenté. Ce que la suite de bout en bout fait réellement émettre est dans `fixtures/m18/inventory/emitted.ndjson`.

**Objectif.** Documenter l’inventaire, et le faire coïncider exactement avec ce que l’application émet.

**Où.** `program/logging-inventory.yaml`

**Dans le cours.**
- [Journaliser pour la sécurité](http://127.0.0.1:5173/#/modules/m18/l01) · [source](../src/content/m18/l01.mdx)
- [Matrice de traçabilité](http://127.0.0.1:5173/#/modules/m07/l02) · [source](../src/content/m07/l02.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

C’est l’exigence de journalisation d’ASVS, rendue vérifiable. Un inventaire qu’on ne confronte pas à la réalité vieillit en trois sprints. Ce qui n’est pas noté : la durée de conservation et la destination que vous déclarez — elles relèvent de la politique de l’entreprise, pas du code.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/program/logging-inventory.yaml`](solutions/program/logging-inventory.yaml)
</details>

<a id="rule-credential-stuffing"></a>

### Écrire la règle : bourrage d’identifiants

**N2** · CWE-1059 · D7 Déploiement & exploitation

Le corpus `fixtures/m18/cs/` contient douze vrais positifs et quarante leurres : deux tests de charge, trois passerelles SSO, dix applications mobiles qui réessaient, quinze utilisateurs maladroits, cinq mots de passe oubliés, trois sondes de supervision et deux suites d’intégration.

**Objectif.** Écrire la requête qui attrape exactement les douze, et aucun des quarante.

**Où.** `detections/credential-stuffing.yaml`

**Dans le cours.**
- [KQL, EQL et ES|QL](http://127.0.0.1:5173/#/modules/m18/l04) · [source](../src/content/m18/l04.mdx)
- [Règles, Sigma et detection-as-code](http://127.0.0.1:5173/#/modules/m28/l03) · [source](../src/content/m28/l03.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Les leurres sont l’exercice : une règle qui attrape tout est facile, une règle qui ne lève jamais l’est aussi. C’est entre les deux que vit le detection engineering. La règle est rejouée sur un second corpus tiré des mêmes générateurs avec une autre graine — énumérer les douze adresses du premier n’y trouve rien.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/detections/credential-stuffing.yaml`](solutions/detections/credential-stuffing.yaml)
</details>

<a id="rule-temporal-spray"></a>

### La corrélation temporelle

**N3** · CWE-1059 · D7 Déploiement & exploitation

Un seul échec par compte, sur près de deux cents comptes, depuis une même adresse : aucune règle par compte ne le verra jamais. Le corpus `fixtures/m18/spray/` contient six campagnes et trente-trois leurres, dont un test de charge qui produit trois cents échecs sur un seul compte.

**Objectif.** Écrire la corrélation qui compte les comptes distincts par source et par fenêtre, et ignore les échecs isolés.

**Où.** `detections/password-spray.yaml`

**Dans le cours.**
- [KQL, EQL et ES|QL](http://127.0.0.1:5173/#/modules/m18/l04) · [source](../src/content/m18/l04.mdx)
- [Credential stuffing et prise de contrôle](http://127.0.0.1:5173/#/modules/m10/l02) · [source](../src/content/m10/l02.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Le pulvérisage est conçu pour passer sous les seuils par compte : il faut changer d’axe d’agrégation. C’est le cas d’école qui justifie les langages de corrélation plutôt que la simple recherche — et la raison pour laquelle une limitation de débit par compte, seule, ne protège de rien.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/detections/password-spray.yaml`](solutions/detections/password-spray.yaml)
</details>

## M27 · Sécurité des applications LLM

<a id="prompt-injection"></a>

### Injection indirecte dans « Ask Novafact »

**N2** · CWE-1427 · D4 Architecture

L’assistant fait du RAG sur les factures et dispose d’outils (envoyer un mail, créer un avoir). Le contenu des factures arrive dans son contexte sans séparation de confiance. Le « modèle » du lab est un simulateur déterministe : il suit les instructions qu’il lit, exactement comme le ferait un vrai LLM.

**Objectif.** Par une note de facture seule — sans jamais le demander toi-même dans le chat — faire envoyer par l’assistant un mail à attacker@evil.example.

**Où.** `server/routes/assistant.ts`

**Dans le cours.**
- [Prompt injection et règle de deux](http://127.0.0.1:5173/#/modules/m19/l02) · [source](../src/content/m19/l02.mdx)
- [Patterns de conception pour agents](http://127.0.0.1:5173/#/modules/m19/l03) · [source](../src/content/m19/l03.mdx)
- [Les 4 anti-patterns](http://127.0.0.1:5173/#/modules/m08/l04) · [source](../src/content/m08/l04.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

La sortie du modèle est une entrée non fiable. Séparer données et instructions, outils à effet de bord derrière une validation humaine explicite, Rule of Two (Meta), plan-then-execute / CaMeL, et périmètre de l’agent réduit (un agent est un confused deputy, K4).

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/routes/assistant.ts`](solutions/server/routes/assistant.ts)
</details>

<a id="synthetic-observation"></a>

### La fausse observation

**N2** · CWE-1427 · D4 Architecture

La trace de raisonnement de l’assistant est du texte plat : rien n’empêche l’utilisateur d’écrire lui-même les lignes censées venir des outils.

**Objectif.** Obtenir un appel d’outil sur un tenant qui n’est pas celui de la session, alors qu’aucun outil n’a renvoyé cet identifiant.

**Où.** `server/routes/assistant.ts`

**Dans le cours.**
- [Prompt injection et règle de deux](http://127.0.0.1:5173/#/modules/m19/l02) · [source](../src/content/m19/l02.mdx)
- [Agents et MCP : vue d’ensemble](http://127.0.0.1:5173/#/modules/m30/l01) · [source](../src/content/m30/l01.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Les sorties d’outil doivent être structurées et distinguées du texte utilisateur par le transport, pas par une convention typographique. Le modèle ne peut pas distinguer deux chaînes qui se ressemblent — c’est au système de le faire.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/routes/assistant.ts`](solutions/server/routes/assistant.ts)
</details>

<a id="excessive-agency-tool"></a>

### L’outil de débogage branché sur l’assistant

**N2** · CWE-250 · D4 Architecture · D5 Implémentation

Un outil « support » accepte une requête brute et hérite du périmètre complet de l’agent.

**Objectif.** Supprimer la donnée d’un autre utilisateur en ne parlant qu’à l’assistant.

**Où.** `server/routes/assistant.ts`

**Dans le cours.**
- [Agents et MCP : vue d’ensemble](http://127.0.0.1:5173/#/modules/m30/l01) · [source](../src/content/m30/l01.mdx)
- [OWASP LLM Top 10 2026](http://127.0.0.1:5173/#/modules/m19/l01) · [source](../src/content/m19/l01.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Chaque outil a son propre périmètre, distinct de celui de l’agent et plus étroit que lui. Un outil « juste pour le support » est un outil de production dès qu’un agent peut l’appeler — et l’agence excessive est le troisième risque du Top 10 LLM.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/routes/assistant.ts`](solutions/server/routes/assistant.ts)
</details>

<a id="indirect-victim-session"></a>

### L’action qui porte l’identité de la victime

**N2** · CWE-1427 · D4 Architecture

Un autre utilisateur interroge l’assistant sur ses factures à intervalle régulier. Ta note l’attend dans l’une d’elles.

**Objectif.** Faire créer un avoir depuis **sa** session à lui : l’exercice ne compte que si l’action porte son identité, pas la tienne.

**Où.** `server/routes/assistant.ts`

**Dans le cours.**
- [Prompt injection et règle de deux](http://127.0.0.1:5173/#/modules/m19/l02) · [source](../src/content/m19/l02.mdx)
- [Applications JS avec LLM](http://127.0.0.1:5173/#/modules/m19/l04) · [source](../src/content/m19/l04.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

C’est ce qui distingue l’injection indirecte d’une simple injection : l’attaquant n’a jamais accès à la session de la victime, il y dépose seulement du contenu. La confirmation humaine doit donc afficher ce que l’outil va vraiment faire.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/routes/assistant.ts`](solutions/server/routes/assistant.ts)
</details>

<a id="markdown-image-exfil"></a>

### L’image qui part toute seule

**N2** · CWE-200 · D4 Architecture · D5 Implémentation

La réponse de l’assistant est rendue en Markdown, et une image distante est chargée au rendu, sans clic.

**Objectif.** Obtenir sur le collecteur local une requête contenant une donnée d’une facture, avec zéro interaction de l’utilisateur.

**Où.** `src/pages/Assistant.tsx`

**Dans le cours.**
- [Applications JS avec LLM](http://127.0.0.1:5173/#/modules/m19/l04) · [source](../src/content/m19/l04.mdx)
- [CSP stricte en pratique](http://127.0.0.1:5173/#/modules/m04/l05) · [source](../src/content/m04/l05.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Le rendu Markdown d’une sortie de modèle est un canal d’exfiltration : chaque ressource distante emporte ce qu’on met dans son URL. Interdire les origines externes par la CSP, ou ne pas rendre d’images du tout dans une réponse d’assistant.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/src/pages/Assistant.tsx`](solutions/src/pages/Assistant.tsx)
</details>

<a id="reference-link-bypass"></a>

### Le filtre de liens et la forme référence

**N3** · CWE-200 · D4 Architecture · D5 Implémentation

Un filtre de sortie supprime les liens Markdown en ligne. Il ne connaît pas la syntaxe par référence.

**Objectif.** Réussir l’exfiltration précédente **avec le filtre activé**.

**Où.** `server/routes/assistant.ts`

**Dans le cours.**
- [Applications JS avec LLM](http://127.0.0.1:5173/#/modules/m19/l04) · [source](../src/content/m19/l04.mdx)
- [Red teaming des LLM](http://127.0.0.1:5173/#/modules/m19/l06) · [source](../src/content/m19/l06.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Un filtre qui énumère les formes connues est toujours en retard d’une syntaxe. La défense est structurelle — CSP qui interdit les origines externes — pas lexicale. C’est le mécanisme d’EchoLeak (CVE-2025-32711) sur Microsoft 365 Copilot.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/routes/assistant.ts`](solutions/server/routes/assistant.ts)
</details>

<a id="dns-exfil-tool"></a>

### L’outil « sûr » comme canal

**N3** · CWE-200 · D4 Architecture · D7 Déploiement & exploitation

La sortie HTTP est entièrement bloquée. Un outil de diagnostic réseau, auto-approuvé parce qu’« il ne fait que regarder », prend un nom d’hôte.

**Objectif.** Faire apparaître dans le journal du résolveur local un nom qui encode un secret.

**Où.** `server/routes/assistant.ts`

**Dans le cours.**
- [Agents et MCP : vue d’ensemble](http://127.0.0.1:5173/#/modules/m30/l01) · [source](../src/content/m30/l01.mdx)
- [Patterns de conception pour agents](http://127.0.0.1:5173/#/modules/m19/l03) · [source](../src/content/m19/l03.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Un outil auto-approuvé parce qu’il paraît inoffensif reste un canal : ce qui compte est la capacité de sortie, pas l’intention de l’outil. C’est le mécanisme de CVE-2025-55284, et c’est pourquoi la Rule of Two compte les capacités, pas les outils.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/routes/assistant.ts`](solutions/server/routes/assistant.ts)
</details>

<a id="spotlighting-bypass"></a>

### La défense cassée par son propre délimiteur

**N3** · CWE-1427 · D4 Architecture

Les sorties d’outil sont encadrées par un délimiteur, avec consigne de ne jamais obéir à l’intérieur. Une note de facture contient ce délimiteur.

**Objectif.** Obtenir un appel d’outil d’origine document **alors que la défense est active**.

**Où.** `server/routes/assistant.ts`

**Dans le cours.**
- [Patterns de conception pour agents](http://127.0.0.1:5173/#/modules/m19/l03) · [source](../src/content/m19/l03.mdx)
- [Red teaming des LLM](http://127.0.0.1:5173/#/modules/m19/l06) · [source](../src/content/m19/l06.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Toute défense par délimiteur se casse si l’attaquant peut écrire le délimiteur : il faut l’échapper dans le contenu, ou changer de mécanisme. Et *The Attacker Moves Second* rappelle que les défenses évaluées contre des attaques fixes tombent contre des attaques adaptatives.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/routes/assistant.ts`](solutions/server/routes/assistant.ts)
</details>

<a id="poisoned-rag"></a>

### Combien de documents pour retourner une réponse

**N2** · CWE-1427 · D4 Architecture

Le moteur de récupération classe par similarité seule. Tu peux planter autant de factures que tu veux dans ton propre espace.

**Objectif.** Trouver le nombre minimal de documents injectés pour lequel la réponse cible sort.

**Où.** `server/routes/assistant.ts`

**Dans le cours.**
- [Applications JS avec LLM](http://127.0.0.1:5173/#/modules/m19/l04) · [source](../src/content/m19/l04.mdx)
- [OWASP LLM Top 10 2026](http://127.0.0.1:5173/#/modules/m19/l01) · [source](../src/content/m19/l01.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

La recherche montre que cinq textes suffisent parmi des millions : la similarité n’est pas une mesure de confiance. Pondérer par la provenance, cloisonner l’index, et plafonner la part d’un seul auteur dans les documents récupérés.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/routes/assistant.ts`](solutions/server/routes/assistant.ts)
</details>

<a id="rag-acl"></a>

### RAG sans contrôle d’accès

**N2** · CWE-285 · D4 Architecture · D5 Implémentation

L’index contient les factures de tous les tenants, et le filtrage se fait après la récupération, dans le prompt.

**Objectif.** Obtenir le contenu d’une facture d’un autre tenant par une question bien tournée.

**Où.** `server/routes/assistant.ts`

**Dans le cours.**
- [Applications JS avec LLM](http://127.0.0.1:5173/#/modules/m19/l04) · [source](../src/content/m19/l04.mdx)
- [Autorisation et multi-tenant](http://127.0.0.1:5173/#/modules/m09/l02) · [source](../src/content/m09/l02.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Les droits s’appliquent **à la récupération**, pas dans le prompt : index partitionné, filtre porté par la requête vectorielle. Un contrôle d’accès qu’on demande poliment au modèle de respecter n’est pas un contrôle d’accès.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/routes/assistant.ts`](solutions/server/routes/assistant.ts)
</details>

<a id="index-after-deletion"></a>

### L’index survit à la suppression

**N2** · CWE-212 · D3 Exigences · D4 Architecture

Les fragments d’une facture supprimée restent dans l’index vectoriel et dans le cache de réponses.

**Objectif.** Faire ressortir la réponse empoisonnée après que le document source a été supprimé.

**Où.** `server/routes/assistant.ts`

**Dans le cours.**
- [Applications JS avec LLM](http://127.0.0.1:5173/#/modules/m19/l04) · [source](../src/content/m19/l04.mdx)
- [Vie privée et RGPD](http://127.0.0.1:5173/#/modules/m07/l04) · [source](../src/content/m07/l04.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Un index dérivé est une copie : il entre dans le périmètre de l’effacement, comme les sauvegardes et les journaux. Le mécanisme est celui de ConfusedPilot, et il vaut aussi pour le droit à l’effacement.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/routes/assistant.ts`](solutions/server/routes/assistant.ts)
</details>

<a id="citation-laundering"></a>

### La citation qui ment

**N3** · CWE-345 · D4 Architecture

L’assistant choisit sa citation par ressemblance avec sa propre sortie, pas par provenance réelle.

**Objectif.** Faire échouer un test d’ancrage : le passage cité n’existe pas dans le document affiché comme source.

**Où.** `server/routes/assistant.ts`

**Dans le cours.**
- [Applications JS avec LLM](http://127.0.0.1:5173/#/modules/m19/l04) · [source](../src/content/m19/l04.mdx)
- [OWASP LLM Top 10 2026](http://127.0.0.1:5173/#/modules/m19/l01) · [source](../src/content/m19/l01.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Une citation est une affirmation vérifiable, ou elle n’est rien. Lier chaque affirmation au fragment exact qui l’appuie, et tester l’ancrage — sinon l’interface fabrique une confiance que le système ne mérite pas.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/routes/assistant.ts`](solutions/server/routes/assistant.ts)
</details>

<a id="system-prompt-canary"></a>

### Le canari du prompt système

**N1** · CWE-200 · D4 Architecture

Un jeton unique est planté dans le prompt système de l’assistant.

**Objectif.** Le faire apparaître dans une réponse rendue à l’utilisateur.

**Où.** `server/routes/assistant.ts`

**Dans le cours.**
- [OWASP LLM Top 10 2026](http://127.0.0.1:5173/#/modules/m19/l01) · [source](../src/content/m19/l01.mdx)
- [Red teaming des LLM](http://127.0.0.1:5173/#/modules/m19/l06) · [source](../src/content/m19/l06.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Le prompt système n’est pas un secret : tout ce qu’il contient finira par sortir. Ce qui doit rester caché n’entre pas dans le contexte — le renommage en « exposition de contexte caché » dans le Top 10 2026 dit exactement cela.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/routes/assistant.ts`](solutions/server/routes/assistant.ts)
</details>

<a id="cross-session-leak"></a>

### La fuite d’une session à l’autre

**N2** · CWE-524 · D4 Architecture · D5 Implémentation

Le cache de réponses de l’assistant est indexé sur la question, pas sur le tenant.

**Objectif.** Faire ressortir dans la session d’un autre compte un canari planté dans la tienne.

**Où.** `server/routes/assistant.ts`

**Dans le cours.**
- [Applications JS avec LLM](http://127.0.0.1:5173/#/modules/m19/l04) · [source](../src/content/m19/l04.mdx)
- [Cache poisoning et cache deception](http://127.0.0.1:5173/#/modules/m03/l06) · [source](../src/content/m03/l06.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

C’est un empoisonnement de cache classique, avec l’identité comme entrée hors clé — la même erreur que sur une réponse HTTP. Tout cache qui touche à des données utilisateur porte le tenant dans sa clé.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/routes/assistant.ts`](solutions/server/routes/assistant.ts)
</details>

<a id="memory-poisoning"></a>

### La mémoire à effet différé

**N3** · CWE-1427 · D4 Architecture

L’assistant conserve des préférences alimentées par le contenu des documents lus.

**Objectif.** Faire se déclencher dans une **nouvelle session** une instruction plantée au tour précédent, le document source ayant été supprimé entre-temps.

**Où.** `server/routes/assistant.ts`

**Dans le cours.**
- [Prompt injection et règle de deux](http://127.0.0.1:5173/#/modules/m19/l02) · [source](../src/content/m19/l02.mdx)
- [Agents et MCP : vue d’ensemble](http://127.0.0.1:5173/#/modules/m30/l01) · [source](../src/content/m30/l01.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

La persistance transforme une injection ponctuelle en porte dérobée : la mémoire est un magasin qui mérite son propre contrôle d’écriture et sa revue. Le Top 10 2026 a élargi LLM01 précisément à la persistance.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/routes/assistant.ts`](solutions/server/routes/assistant.ts)
</details>

<a id="tool-loop-quota"></a>

### La boucle sous le radar du quota

**N2** · CWE-770 · D4 Architecture · D7 Déploiement & exploitation

La limitation compte les requêtes HTTP. Une réponse d’outil peut dire à l’agent d’appeler l’outil suivant.

**Objectif.** Produire plus de deux cents appels d’outils depuis une seule requête utilisateur, sans franchir la limite.

**Où.** `server/routes/assistant.ts`

**Dans le cours.**
- [OWASP LLM Top 10 2026](http://127.0.0.1:5173/#/modules/m19/l01) · [source](../src/content/m19/l01.mdx)
- [Fuzzing et tests de disponibilité](http://127.0.0.1:5173/#/modules/m13/l05) · [source](../src/content/m13/l05.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Compter la bonne unité : appels d’outils, profondeur de chaîne, coût cumulé — et détecter les cycles dans le graphe d’appels. Une limite qui compte les requêtes ne voit rien de ce qu’un agent fait entre deux.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/routes/assistant.ts`](solutions/server/routes/assistant.ts)
</details>

<a id="unbounded-consumption"></a>

### Consommation illimitée

**N2** · CWE-770 · D4 Architecture · D7 Déploiement & exploitation

L’assistant n’a ni limite de contexte, ni quota par compte, ni plafond de dépense.

**Objectif.** Faire exploser le coût d’inférence et rendre l’assistant indisponible pour les autres clients.

**Où.** `server/routes/assistant.ts`

**Dans le cours.**
- [OWASP LLM Top 10 2026](http://127.0.0.1:5173/#/modules/m19/l01) · [source](../src/content/m19/l01.mdx)
- [Fuzzing et tests de disponibilité](http://127.0.0.1:5173/#/modules/m13/l05) · [source](../src/content/m13/l05.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Contexte borné avant l’appel, quotas par compte et par tenant, plafond de dépense avec coupure, et surveillance du coût comme métrique de sécurité. La disponibilité et le budget sont des propriétés à défendre.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/routes/assistant.ts`](solutions/server/routes/assistant.ts)
</details>

<a id="encoded-bypass"></a>

### Le décodeur obéissant

**N2** · CWE-176 · D4 Architecture

Un filtre d’entrée bloque une liste de mots. Le modèle, lui, décode base64, ROT13 et caractères invisibles avant d’obéir.

**Objectif.** Obtenir la chaîne déclencheuse avec la liste de blocage active, puis écrire le filtre qui normalise avant de décider.

**Où.** `server/routes/assistant.ts`

**Dans le cours.**
- [Red teaming des LLM](http://127.0.0.1:5173/#/modules/m19/l06) · [source](../src/content/m19/l06.mdx)
- [Footguns JavaScript et argent](http://127.0.0.1:5173/#/modules/m02/l02) · [source](../src/content/m02/l02.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Un filtre qui décide avant la normalisation décide sur autre chose que ce qui sera interprété : c’est la même erreur que la normalisation Unicode après contrôle d’unicité, transposée au modèle.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/routes/assistant.ts`](solutions/server/routes/assistant.ts)
</details>

<a id="human-approval-spoof"></a>

### L’approbation humaine trompée

**N3** · CWE-451 · D4 Architecture

La boîte de confirmation affiche le destinataire extrait de la question. L’appel d’outil, lui, utilise celui extrait du document.

**Objectif.** Faire approuver un envoi vers une adresse qui n’est jamais apparue dans la boîte de validation.

**Où.** `src/pages/Assistant.tsx`

**Dans le cours.**
- [Patterns de conception pour agents](http://127.0.0.1:5173/#/modules/m19/l03) · [source](../src/content/m19/l03.mdx)
- [Agents et MCP : vue d’ensemble](http://127.0.0.1:5173/#/modules/m30/l01) · [source](../src/content/m30/l01.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

La validation humaine doit porter sur **l’appel réellement effectué**, sérialisé, pas sur un résumé reconstruit à côté. Sinon elle transfère la responsabilité à l’utilisateur sans lui donner l’information — ce qui est pire que pas de validation.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/src/pages/Assistant.tsx`](solutions/src/pages/Assistant.tsx)
</details>

<a id="llm-markdown-xss"></a>

### Sortie du modèle rendue en HTML

**N2** · CWE-79 · D4 Architecture · D5 Implémentation

La réponse de l’assistant est rendue en Markdown puis injectée dans la page. Le modèle répète ce qu’il lit dans les factures.

**Objectif.** Obtenir une exécution de script dans le navigateur, par une note de facture qui traverse le modèle.

**Où.** `src/pages/Assistant.tsx`

**Dans le cours.**
- [Applications JS avec LLM](http://127.0.0.1:5173/#/modules/m19/l04) · [source](../src/content/m19/l04.mdx)
- [Trusted Types et Sanitizer API](http://127.0.0.1:5173/#/modules/m04/l06) · [source](../src/content/m04/l06.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

La sortie du modèle est une entrée non fiable, exactement comme un champ de formulaire : l’assainir avant rendu, et ne jamais lui accorder le bénéfice du doute parce qu’elle « vient de chez nous ».

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/src/pages/Assistant.tsx`](solutions/src/pages/Assistant.tsx)
</details>

<a id="llm-tool-ssrf"></a>

### SSRF par un outil de l’agent

**N2** · CWE-918 · D4 Architecture · D5 Implémentation

L’assistant dispose d’un outil « consulter une page » qui accepte n’importe quelle URL.

**Objectif.** Faire joindre le service de métadonnées à l’agent, par une instruction cachée dans une facture.

**Où.** `server/routes/assistant.ts`

**Dans le cours.**
- [Applications JS avec LLM](http://127.0.0.1:5173/#/modules/m19/l04) · [source](../src/content/m19/l04.mdx)
- [Agents et MCP : vue d’ensemble](http://127.0.0.1:5173/#/modules/m30/l01) · [source](../src/content/m30/l01.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Un outil hérite du périmètre réseau de l’agent : chaque outil a sa propre liste blanche. L’enchaînement injection → outil → réseau interne est la lethal trifecta dans sa forme la plus directe.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/routes/assistant.ts`](solutions/server/routes/assistant.ts)
</details>

<a id="package-hallucination"></a>

### Le paquet qui n’existe pas

**N2** · CWE-1104 · D5 Implémentation · D8 Supply chain

L’assistant de code propose une commande d’installation pour un paquet plausible qui n’existe pas au registre.

**Objectif.** Montrer que le paquet suggéré est absent du registre local — ou créé la veille, sans dépendant — et que rien ne l’a arrêté.

**Où.** `server/routes/assistant.ts`

**Dans le cours.**
- [L’IA dans le SDLC](http://127.0.0.1:5173/#/modules/m19/l07) · [source](../src/content/m19/l07.mdx)
- [npm : installer et publier](http://127.0.0.1:5173/#/modules/m14/l05) · [source](../src/content/m14/l05.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Près d’un paquet sur cinq suggéré par un modèle n’existe pas : il suffit à un attaquant de l’enregistrer. Vérifier l’existence, l’âge et l’adoption de toute dépendance suggérée, automatiquement, avant qu’elle n’entre dans un lockfile.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/routes/assistant.ts`](solutions/server/routes/assistant.ts)
</details>

<a id="ai-review-bot-approve"></a>

### Le bot de revue qui approuve

**N2** · CWE-1427 · D5 Implémentation · D8 Supply chain

Un bot de revue lit le diff des pull requests et peut rendre un verdict d’approbation.

**Objectif.** Faire approuver une PR dont le diff contient l’instruction — puis retirer l’approbation du vocabulaire du bot.

**Où.** `server/routes/assistant.ts`

**Dans le cours.**
- [L’IA dans le SDLC](http://127.0.0.1:5173/#/modules/m19/l07) · [source](../src/content/m19/l07.mdx)
- [Revoir du code généré par IA](http://127.0.0.1:5173/#/modules/m12/l06) · [source](../src/content/m12/l06.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Le correctif n’est pas un meilleur prompt : c’est de retirer la capacité. Un relecteur automatique commente, il n’approuve pas — la décision reste à un humain qui, lui, ne lit pas les instructions cachées dans le code.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/routes/assistant.ts`](solutions/server/routes/assistant.ts)
</details>

<a id="ci-secret-in-pr-title"></a>

### Le secret de CI dans un titre de PR

**N3** · CWE-1427 · D7 Déploiement & exploitation · D8 Supply chain

Un job de CI agentique interpole le titre de la pull request dans son prompt, et dispose des secrets du dépôt.

**Objectif.** Faire apparaître la valeur d’une variable canari dans le journal de build.

**Où.** `novafact/.github/workflows/ai-triage.yml`

**Dans le cours.**
- [L’IA dans le SDLC](http://127.0.0.1:5173/#/modules/m19/l07) · [source](../src/content/m19/l07.mdx)
- [Durcir GitHub Actions](http://127.0.0.1:5173/#/modules/m14/l02) · [source](../src/content/m14/l02.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

C’est l’injection de template des workflows, avec un modèle au milieu : la donnée non fiable atteint un contexte privilégié. Un agent en CI se traite comme un runner — périmètre minimal, pas de secret, pas d’écriture. C’est le mécanisme de s1ngularity.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/novafact/.github/workflows/ai-triage.yml`](solutions/novafact/.github/workflows/ai-triage.yml)
</details>

<a id="stealth-attack"></a>

### Exfiltrer sans se faire remarquer

**N3** · CWE-1427 · D4 Architecture · D7 Déploiement & exploitation

Une attaque qui casse la tâche demandée se fait repérer tout de suite : l’utilisateur voit que sa réponse est absurde.

**Objectif.** Réussir l’exfiltration **et** produire le résumé légitimement demandé, dans le même tour.

**Où.** `server/routes/assistant.ts`

**Dans le cours.**
- [Red teaming des LLM](http://127.0.0.1:5173/#/modules/m19/l06) · [source](../src/content/m19/l06.mdx)
- [Détections applicatives](http://127.0.0.1:5173/#/modules/m28/l05) · [source](../src/content/m28/l05.mdx)
- [Web LLM attacks et recherche assistée par IA](http://127.0.0.1:5173/#/modules/m03/l13) · [source](../src/content/m03/l13.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

C’est le double critère d’AgentDojo — utilité et sécurité mesurées ensemble — et c’est ce qui rend les évaluations réalistes : une attaque qui dégrade le service est détectée par l’usage, pas par la sécurité. Côté défense, cela veut dire que l’absence de plainte utilisateur ne prouve rien.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/routes/assistant.ts`](solutions/server/routes/assistant.ts)
</details>

## M4 · Les métiers de l’AppSec

<a id="codeowners-sensitive"></a>

### Router la revue vers les bonnes personnes

**N1** · CWE-1391 · D2 Cycle de vie · D7 Déploiement & exploitation

Les fichiers d’authentification, de jeton et les workflows se font relire par qui passe. L’AppSec découvre les changements en production.

**Objectif.** Écrire le CODEOWNERS du dépôt pour que les chemins sensibles — et seulement eux — exigent la revue de l’équipe sécurité.

**Où.** `.github/CODEOWNERS`

**Dans le cours.**
- [Security Champions](http://127.0.0.1:5173/#/modules/m23/l04) · [source](../src/content/m23/l04.mdx)
- [Le rôle : une équipe qui rend capable](http://127.0.0.1:5173/#/modules/m23/l01) · [source](../src/content/m23/l01.mdx)
- [Revoir une PR en 10 minutes](http://127.0.0.1:5173/#/modules/m12/l03) · [source](../src/content/m12/l03.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Le harnais applique la vraie règle de résolution et vérifie trois choses : les chemins sensibles résolvent vers l’équipe sécurité, un fichier ordinaire ne l’encombre pas, et il a quand même un relecteur. Le double critère empêche la règle paresseuse qui met tout le dépôt sur le dos de l’AppSec — et qui garantit qu’elle ne relira rien. Le découpage entre les autres équipes n’est pas noté : il dépend de l’organisation.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/.github/CODEOWNERS`](solutions/.github/CODEOWNERS)
</details>

## M5 · Maturité et posture de sécurité

<a id="samm-assessment"></a>

### Évaluation SAMM qui se calcule

**N2** · CWE-1059 · D2 Cycle de vie

Novafact n’a jamais été évaluée. Les avis divergent sur la maturité réelle du programme, faute de grille commune. Le modèle est embarqué : `fixtures/m01/samm-model.yaml`, 5 fonctions, 15 pratiques, 30 flux, 90 activités.

**Objectif.** Remplir l’évaluation de l’équipe — une réponse par activité — et produire les scores par flux, par pratique, par fonction et le score global, cohérents avec les réponses.

**Où.** `program/samm-assessment.yaml`

**Dans le cours.**
- [OWASP SAMM v2](http://127.0.0.1:5173/#/modules/m24/l02) · [source](../src/content/m24/l02.mdx)
- [Mesurer un programme](http://127.0.0.1:5173/#/modules/m32/l04) · [source](../src/content/m32/l04.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Le harnais recalcule tous les scores depuis les seules réponses et vérifie la complétude : chaque identifiant d’activité existe dans le modèle, aucun flux n’est laissé vide, aucune évaluation n’est incohérente. Ce qui est jugé, c’est l’arithmétique et la complétude — pas la sincérité des réponses, qui n’est pas vérifiable et qu’il faut assumer comme telle. C’est aussi pour cela qu’une auto-évaluation se contre-expertise.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/program/samm-assessment.yaml`](solutions/program/samm-assessment.yaml)
</details>

<a id="bsimm-compare"></a>

### Se comparer plutôt que se noter

**N2** · CWE-1059 · D2 Cycle de vie

L’évaluation de maturité dit où en est Novafact par rapport au modèle. Elle ne dit pas où en sont les autres. `fixtures/m01/bsimm-observed.yaml` donne, pour trente et une activités, la proportion d’organisations qui les pratiquent réellement.

**Objectif.** Confronter Novafact aux activités réellement observées, calculer l’écart sur celles qui sont très répandues, et nommer les trois qui comptent.

**Où.** `program/bsimm-gap.yaml`

**Dans le cours.**
- [BSIMM16 : se comparer](http://127.0.0.1:5173/#/modules/m24/l03) · [source](../src/content/m24/l03.mdx)
- [OWASP SAMM v2](http://127.0.0.1:5173/#/modules/m24/l02) · [source](../src/content/m24/l02.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Le harnais vérifie que chaque activité citée existe dans l’étude, que chaque preuve existe dans le dépôt, et que l’écart est calculé à partir de tes propres réponses — pas déclaré. Le choix des trois priorités, lui, n’est pas noté : il dépend du contexte métier, et c’est précisément la conversation qu’on veut avoir. Les deux modèles ensemble évitent autant la complaisance que la course au niveau 3.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/program/bsimm-gap.yaml`](solutions/program/bsimm-gap.yaml)
</details>

## M24 · Detection engineering

<a id="rule-threshold"></a>

### Régler le seuil

**N2** · CWE-1059 · D7 Déploiement & exploitation

Le corpus `fixtures/m18/cs-hard/` ajoute trois attaques discrètes, juste sous le seuil évident, et un test d’intrusion autorisé qui se comporte exactement comme une attaque. La séparation parfaite n’existe pas. La règle est écrite (`cs-hard/skeleton.yaml`) : seuls la fenêtre et les deux seuils sont à toi.

**Objectif.** Trouver le réglage qui tient les cibles annoncées : 90 % de précision et 85 % de rappel.

**Où.** `detections/thresholds.yaml`

**Dans le cours.**
- [Règles, Sigma et detection-as-code](http://127.0.0.1:5173/#/modules/m28/l03) · [source](../src/content/m28/l03.mdx)
- [Maturité et réponse à incident](http://127.0.0.1:5173/#/modules/m28/l06) · [source](../src/content/m28/l06.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Le harnais calcule et affiche les deux métriques, et n’accepte la règle qu’au-dessus des deux cibles. Régler un seuil est la partie du métier qu’on n’enseigne jamais, parce qu’elle demande un corpus — le voici. Et accepter un faux positif connu et documenté vaut mieux que fermer les yeux sur trois attaques.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/detections/thresholds.yaml`](solutions/detections/thresholds.yaml)
</details>

<a id="honeytoken"></a>

### Le piège à miel

**N2** · CWE-1059 · D7 Déploiement & exploitation

Trois leurres n’existent que dans le HTML et le bundle : une route d’export total, une facture qui n’a jamais été émise, et une clé d’API jamais distribuée. Aucun usage légitime ne les atteint. Le corpus `fixtures/m18/honeytoken/` contient quarante parcours légitimes qui passent tout autour.

**Objectif.** Faire lever une alerte à tout accès à l’un des trois leurres, avec exactement zéro faux positif sur le corpus légitime complet.

**Où.** `detections/honeytoken.yaml`

**Dans le cours.**
- [Détections applicatives](http://127.0.0.1:5173/#/modules/m28/l05) · [source](../src/content/m28/l05.mdx)
- [Détecter et répondre à la fraude](http://127.0.0.1:5173/#/modules/m10/l07) · [source](../src/content/m10/l07.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Un honeytoken a le meilleur rapport signal sur bruit du métier : il n’a aucune raison d’être touché. C’est aussi ce qui détecte un attaquant **déjà à l’intérieur**, que les règles de périmètre laissent passer — et ce qui rend la détection indépendante de la sophistication de l’attaque.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/detections/honeytoken.yaml`](solutions/detections/honeytoken.yaml)
</details>

<a id="detect-prompt-injection"></a>

### Détecter l’injection indirecte

**N3** · CWE-1059 · D4 Architecture · D7 Déploiement & exploitation

L’assistant appelle des outils. Le journal porte désormais `novafact.assistant.origin` — l’origine de l’instruction qui a déclenché l’appel. Le corpus `fixtures/m18/assistant/` contient six appels d’origine document visant l’extérieur, et trente usages légitimes.

**Objectif.** Écrire la règle qui attrape les six, sans lever sur les trente.

**Où.** `detections/prompt-injection.yaml`

**Dans le cours.**
- [Détections applicatives](http://127.0.0.1:5173/#/modules/m28/l05) · [source](../src/content/m28/l05.mdx)
- [Agents et MCP : vue d’ensemble](http://127.0.0.1:5173/#/modules/m30/l01) · [source](../src/content/m30/l01.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Le vocabulaire OWASP porte désormais des événements dédiés — injection de prompt, empoisonnement d’outil, épuisement de ressource — qui font le pont entre les deux domaines. L’origine de l’instruction est le champ qui rend l’injection indirecte détectable, et l’instrumenter coûte trois lignes dans la couche d’outils.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/detections/prompt-injection.yaml`](solutions/detections/prompt-injection.yaml)
</details>

<a id="rule-silent-after-fix"></a>

### La règle qui se tait après le correctif

**N2** · CWE-1059 · D6 Tests · D7 Déploiement & exploitation

Le défaut d’autorisation a été corrigé : le sondage d’identifiants d’un autre tenant reçoit maintenant un 403 au lieu d’un 200. La règle qui l’attrapait (`fixtures/m18/silent-before/rule-origine.yaml`) lève encore sur le corpus d’après correctif, et personne ne sait pourquoi.

**Objectif.** Réécrire la règle : muette sur le corpus d’après correctif, et toujours levée sur celui d’avant.

**Où.** `detections/idor-probing.yaml`

**Dans le cours.**
- [Maturité et réponse à incident](http://127.0.0.1:5173/#/modules/m28/l06) · [source](../src/content/m28/l06.mdx)
- [Tests de sécurité écrits par les devs](http://127.0.0.1:5173/#/modules/m13/l02) · [source](../src/content/m13/l02.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

C’est le pendant détection du contrat de `npm run verify` : le contrôle refuse **et** la fonctionnalité marche encore. Une règle qu’on n’a pas retirée après correction est une alerte que l’équipe apprendra à ignorer — et avec elle, les suivantes. Une détection a un cycle de vie, avec une date de revue.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/detections/idor-probing.yaml`](solutions/detections/idor-probing.yaml)
</details>

<a id="rule-fixtures"></a>

### Deux fixtures par règle

**N1** · CWE-1059 · D6 Tests · D7 Déploiement & exploitation

Cinq règles de la bibliothèque (`fixtures/m18/rules/`) sont livrées sans test. Personne ne sait si elles lèvent encore après un changement de schéma.

**Objectif.** Accompagner chacune d’un événement qu’elle doit attraper et d’un quasi-jumeau qu’elle ne doit pas attraper.

**Où.** `detections/fixtures/`

**Dans le cours.**
- [Règles, Sigma et detection-as-code](http://127.0.0.1:5173/#/modules/m28/l03) · [source](../src/content/m28/l03.mdx)
- [Tests de sécurité écrits par les devs](http://127.0.0.1:5173/#/modules/m13/l02) · [source](../src/content/m13/l02.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

La CI refuse une règle sans ses deux fixtures, et refuse une règle qui attrape sa propre fixture négative. C’est exactement le contrat du reste du lab — le contrôle refuse, et le légitime passe — appliqué à la détection. C’est aussi ce qui permet de changer une règle sans peur six mois plus tard.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/detections/fixtures/`](solutions/detections/fixtures/)
</details>

<a id="rule-lint"></a>

### Le lint de règle

**N2** · CWE-1059 · D6 Tests · D7 Déploiement & exploitation

Douze fichiers de règles dans `fixtures/m18/rules/`, cinq cassés : score de risque hors de la plage de sa sévérité, étiquette dupliquée, note sans section de triage, fenêtre d’historique absente.

**Objectif.** Produire la bibliothèque corrigée, et faire passer le lint à zéro échec.

**Où.** `detections/rules/`

**Dans le cours.**
- [Règles, Sigma et detection-as-code](http://127.0.0.1:5173/#/modules/m28/l03) · [source](../src/content/m28/l03.mdx)
- [Stratégie de test de sécurité](http://127.0.0.1:5173/#/modules/m13/l01) · [source](../src/content/m13/l01.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Les assertions sont celles du dépôt de règles d’Elastic, réimplémentées. Une règle est du code : elle se lint, elle se teste, elle se revoit. C’est ce qui fait la différence entre une bibliothèque de règles et un dossier de requêtes.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/detections/rules/`](solutions/detections/rules/)
</details>

<a id="atomic-test"></a>

### L’atomique qui valide la règle

**N2** · CWE-1059 · D6 Tests · D7 Déploiement & exploitation

La règle `fixtures/m18/atomic/rule.yaml` a été écrite d’après une hypothèse. Personne n’a vérifié qu’une vraie attaque la déclenche. Le lab fournit un environnement simulé — un annuaire de comptes et une horloge — sur lequel un test d’attaque s’exécute.

**Objectif.** Écrire le test en trois temps — mise en place, détonation, retour arrière — et prouver le cycle complet.

**Où.** `detections/atomics/credential-stuffing.yaml`

**Dans le cours.**
- [Règles, Sigma et detection-as-code](http://127.0.0.1:5173/#/modules/m28/l03) · [source](../src/content/m28/l03.mdx)
- [Stratégie de test de sécurité](http://127.0.0.1:5173/#/modules/m13/l01) · [source](../src/content/m13/l01.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Avant détonation la règle est muette, après elle lève, après retour arrière l’état est identique à l’initial. Le retour arrière est ce qui rend le test rejouable en continu — et une validation de détection qu’on ne rejoue pas en continu est une validation qui vieillit. C’est le modèle d’Atomic Red Team.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/detections/atomics/credential-stuffing.yaml`](solutions/detections/atomics/credential-stuffing.yaml)
</details>

<a id="appsensor-points"></a>

### Les points de détection applicatifs

**N2** · CWE-778 · D5 Implémentation · D7 Déploiement & exploitation

L’application ne distingue pas une erreur d’un comportement hostile : un utilisateur qui essaie dix identifiants d’objet à la suite ne déclenche rien. Le corpus `fixtures/m18/appsensor/` contient six trafics hostiles — un par point du catalogue — et un parcours légitime complet.

**Objectif.** Déclarer les six points de détection du catalogue, et vérifier qu’aucun ne se déclenche sur le parcours légitime.

**Où.** `detections/appsensor.yaml`

**Dans le cours.**
- [Détections applicatives](http://127.0.0.1:5173/#/modules/m28/l05) · [source](../src/content/m28/l05.mdx)
- [Détecter et répondre à la fraude](http://127.0.0.1:5173/#/modules/m10/l07) · [source](../src/content/m10/l07.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Les points de détection d’AppSensor sont la contribution la plus sous-estimée d’OWASP : l’application sait des choses que le réseau ignore. Elle sait qu’une session a changé d’adresse, et que la chaîne d’intégrité de son propre journal est rompue. Ce qui n’est pas noté : la réponse associée à chaque point — elle fait l’objet du challenge suivant.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/detections/appsensor.yaml`](solutions/detections/appsensor.yaml)
</details>

<a id="graduated-response"></a>

### La réponse graduée

**N2** · CWE-1059 · D5 Implémentation · D7 Déploiement & exploitation

Une détection ne sait faire qu’une chose : écrire une ligne. Personne ne la lit avant le lendemain. Le corpus `fixtures/m18/graduated/` contient dix-neuf sessions et, à côté, le palier que chacune doit atteindre.

**Objectif.** Écrire la politique qui fait passer le même signal de la trace à l’alerte, puis au ralentissement, puis au verrouillage — sans gêner un compte légitime.

**Où.** `detections/response-policy.yaml`

**Dans le cours.**
- [Détections applicatives](http://127.0.0.1:5173/#/modules/m28/l05) · [source](../src/content/m28/l05.mdx)
- [Limitation de débit bien conçue](http://127.0.0.1:5173/#/modules/m10/l03) · [source](../src/content/m10/l03.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Détecter sans répondre, c’est documenter l’incident pendant qu’il se déroule. La graduation est ce qui rend la réponse automatique acceptable : elle laisse une marge avant la mesure qui gêne un vrai client, et elle évite de transformer le verrouillage en arme de déni de service (NIST SP 800-63B).

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/detections/response-policy.yaml`](solutions/detections/response-policy.yaml)
</details>

<a id="ads-documentation"></a>

### La fiche de stratégie de détection

**N2** · CWE-1059 · D7 Déploiement & exploitation

Les règles existent sans contexte : personne ne sait ce qu’elles couvrent, ce qu’elles ratent, ni quoi faire quand elles lèvent.

**Objectif.** Documenter la règle de bourrage d’identifiants selon les rubriques du cadre ADS, dont une recette de validation que le harnais exécute.

**Où.** `detections/ads/credential-stuffing.md`

**Dans le cours.**
- [Règles, Sigma et detection-as-code](http://127.0.0.1:5173/#/modules/m28/l03) · [source](../src/content/m28/l03.mdx)
- [Maturité et réponse à incident](http://127.0.0.1:5173/#/modules/m28/l06) · [source](../src/content/m28/l06.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

La rubrique de validation est celle qui compte : le harnais l’exécute et exige que la règle lève réellement. Les angles morts et les faux positifs attendus sont ce qui permet à l’analyste de trier à trois heures du matin. Ce qui n’est pas noté : la qualité de la prose — le harnais vérifie la présence et la longueur minimale des rubriques, pas leur pertinence.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/detections/ads/credential-stuffing.md`](solutions/detections/ads/credential-stuffing.md)
</details>

<a id="detection-coverage"></a>

### La couverture qui se prouve

**N3** · CWE-1059 · D7 Déploiement & exploitation

Douze règles, huit scénarios d’attaque, et aucune idée de ce qui est couvert ni de ce qui ne l’est pas.

**Objectif.** Faire déclarer à chaque scénario les règles qu’il déclenche, et à chaque règle sa technique, puis nommer le trou.

**Où.** `detections/coverage.yaml`

**Dans le cours.**
- [Règles, Sigma et detection-as-code](http://127.0.0.1:5173/#/modules/m28/l03) · [source](../src/content/m28/l03.mdx)
- [MITRE pour l’AppSec](http://127.0.0.1:5173/#/modules/m11/l04) · [source](../src/content/m11/l04.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Le test échoue si un scénario cite une règle inexistante, si une technique citée est inconnue ou dépréciée, ou si la déclaration ne correspond pas au rejeu. La couverture ATT&CK se mesure alors pour de vrai, au lieu d’être une carte de chaleur décorative que personne n’ose contredire.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/detections/coverage.yaml`](solutions/detections/coverage.yaml)
</details>

<a id="incident-timeline"></a>

### La chronologie de l’incident

**N3** · CWE-1059 · D7 Déploiement & exploitation

Neuf cent quatorze lignes de journal dans `fixtures/m18/incident/log.ndjson`, un incident de quatorze événements dedans. Il faut dire par où c’est entré, ce qui a été touché, et ce qui est sorti.

**Objectif.** Reconstituer la liste ordonnée des événements de l’incident — aucun manquant, aucun en trop.

**Où.** `incident/timeline.yaml`

**Dans le cours.**
- [Maturité et réponse à incident](http://127.0.0.1:5173/#/modules/m28/l06) · [source](../src/content/m28/l06.mdx)
- [Gérer une critique à J+0](http://127.0.0.1:5173/#/modules/m05/l07) · [source](../src/content/m05/l07.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Le harnais connaît la vérité terrain et compare, dans les deux sens. Les identifiants de corrélation sont ce qui rend l’exercice faisable en minutes plutôt qu’en jours — et leur absence est ce qui transforme une investigation en archéologie. C’est pour ça qu’ils sont une exigence de conception, pas un détail d’implémentation.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/incident/timeline.yaml`](solutions/incident/timeline.yaml)
</details>

## M28 · Agents & MCP

<a id="product-as-channel"></a>

### Le produit lui-même comme canal

**N3** · CWE-200 · D4 Architecture

L’assistant peut publier une note de litige visible par tous les tenants. Aucun trafic ne sort du réseau.

**Objectif.** Faire apparaître dans une note publique une chaîne qui n’existe que dans une facture privée d’un autre tenant.

**Où.** `server/routes/assistant.ts`

**Dans le cours.**
- [Agents et MCP : vue d’ensemble](http://127.0.0.1:5173/#/modules/m30/l01) · [source](../src/content/m30/l01.mdx)
- [Autorisation et multi-tenant](http://127.0.0.1:5173/#/modules/m09/l02) · [source](../src/content/m09/l02.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Les défenses réseau sont aveugles : l’exfiltration passe par une fonctionnalité légitime du produit. Toute capacité d’écriture visible par d’autres est un canal de sortie — c’est le mécanisme de l’exploit GitHub MCP.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/routes/assistant.ts`](solutions/server/routes/assistant.ts)
</details>

<a id="tool-poisoning-mcp"></a>

### L’empoisonnement de description d’outil

**N2** · CWE-1427 · D4 Architecture · D8 Supply chain · Kohnfelder K4

La description d’un outil d’un serveur MCP tiers contient un bloc d’instructions demandant de recopier la configuration dans un paramètre annexe.

**Objectif.** Obtenir un appel d’outil portant un argument que l’utilisateur n’a jamais fourni et qui contient un secret.

**Où.** `server/routes/mcp.ts`

**Dans le cours.**
- [Agents et MCP : vue d’ensemble](http://127.0.0.1:5173/#/modules/m30/l01) · [source](../src/content/m30/l01.mdx)
- [Fournisseurs et tiers](http://127.0.0.1:5173/#/modules/m14/l09) · [source](../src/content/m14/l09.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

La description d’un outil entre dans le contexte au même titre que le reste : c’est du contenu fourni par un tiers. Un serveur MCP tiers est un third-party hook au sens de Kohnfelder — il a les droits de celui qui l’installe.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/routes/mcp.ts`](solutions/server/routes/mcp.ts)
</details>

<a id="rug-pull-mcp"></a>

### Le rug pull

**N3** · CWE-494 · D4 Architecture · D8 Supply chain

La description d’un outil MCP mute après quelques utilisations, une fois l’approbation de l’utilisateur obtenue.

**Objectif.** Montrer que l’empreinte de la description diffère entre le premier et le énième appel, et que le comportement change après la mutation.

**Où.** `server/routes/mcp.ts`

**Dans le cours.**
- [Agents et MCP : vue d’ensemble](http://127.0.0.1:5173/#/modules/m30/l01) · [source](../src/content/m30/l01.mdx)
- [Cas réels de supply chain](http://127.0.0.1:5173/#/modules/m14/l08) · [source](../src/content/m14/l08.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Approuver une fois ne vaut pas approuver pour toujours : empreinte enregistrée à la première vue, comparaison à chaque listage, et nouvelle approbation si elle change. C’est le modèle de confiance à la première utilisation, et c’est la seule défense contre une dépendance qui se retourne.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/routes/mcp.ts`](solutions/server/routes/mcp.ts)
</details>

<a id="tool-shadowing"></a>

### Le tool shadowing

**N3** · CWE-1427 · D4 Architecture · D8 Supply chain · Kohnfelder K4

Un second serveur MCP déclare un outil homonyme de celui du serveur de confiance, et altère son comportement.

**Objectif.** Faire appeler l’outil **de confiance** avec un destinataire caché que personne n’a demandé.

**Où.** `server/routes/mcp.ts`

**Dans le cours.**
- [Agents et MCP : vue d’ensemble](http://127.0.0.1:5173/#/modules/m30/l01) · [source](../src/content/m30/l01.mdx)
- [Les 4 anti-patterns](http://127.0.0.1:5173/#/modules/m08/l04) · [source](../src/content/m08/l04.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Les outils de plusieurs serveurs partagent un espace de noms sans frontière : un serveur peut décrire ceux d’un autre. Nommer les outils par leur serveur, isoler les contextes, et n’activer que les serveurs nécessaires à la tâche.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/routes/mcp.ts`](solutions/server/routes/mcp.ts)
</details>

<a id="line-jumping"></a>

### Nuire avant le premier appel

**N3** · CWE-1427 · D4 Architecture · D8 Supply chain

Les descriptions d’outils entrent dans le contexte dès le listage, avant tout consentement et avant toute invocation.

**Objectif.** Faire porter à toutes les réponses produites un comportement jamais demandé, sans qu’un seul outil ait été invoqué.

**Où.** `server/routes/mcp.ts`

**Dans le cours.**
- [Agents et MCP : vue d’ensemble](http://127.0.0.1:5173/#/modules/m30/l01) · [source](../src/content/m30/l01.mdx)
- [Modéliser l’IA, la supply chain et le dev](http://127.0.0.1:5173/#/modules/m11/l06) · [source](../src/content/m11/l06.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Le consentement à l’invocation arrive trop tard : le mal est fait au listage. Il faut valider les descriptions avant de les charger, et traiter l’ajout d’un serveur MCP comme l’ajout d’une dépendance — avec revue.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/server/routes/mcp.ts`](solutions/server/routes/mcp.ts)
</details>

## M31 · Le programme AppSec

<a id="samm-roadmap"></a>

### La feuille de route dérivée de l’écart

**N2** · CWE-1059 · D2 Cycle de vie

L’évaluation est faite. Reste à en tirer un plan à douze mois qui ne soit ni une liste de vœux ni un copier-coller du modèle.

**Objectif.** Produire la feuille de route qui fait progresser d’un niveau chaque flux des pratiques sous le seuil de 1,5 — tous, et aucun autre.

**Où.** `program/roadmap.yaml`

**Dans le cours.**
- [OWASP SAMM v2](http://127.0.0.1:5173/#/modules/m24/l02) · [source](../src/content/m24/l02.mdx)
- [Cyber Resilience Act et roadmap](http://127.0.0.1:5173/#/modules/m32/l05) · [source](../src/content/m32/l05.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Le harnais calcule l’ensemble des pratiques sous le seuil depuis ton évaluation et exige que la feuille de route les couvre exactement, par les activités du niveau immédiatement supérieur. La cohérence avec l’évaluation est objective ; la pertinence pour le métier, l’ordre des trimestres et la faisabilité ne le sont pas et ne sont pas notés.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/program/roadmap.yaml`](solutions/program/roadmap.yaml)
</details>

<a id="break-build-gate"></a>

### La porte qui casse le build

**N2** · CWE-1059 · D2 Cycle de vie · D6 Tests

Aucune porte de contrôle : la CI passe au vert quel que soit le résultat des scanners.

**Objectif.** Écrire la porte qui bloque sur un seuil de sévérité — et seulement là. Le harnais l’exécute contre quatorze rapports d’analyse, dont douze fabriqués à la volée.

**Où.** `scripts/gate.mjs`

**Dans le cours.**
- [Jalons, portes et exceptions](http://127.0.0.1:5173/#/modules/m32/l03) · [source](../src/content/m32/l03.mdx)
- [Bâtir la plateforme](http://127.0.0.1:5173/#/modules/m13/l11) · [source](../src/content/m13/l11.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Le harnais exécute la porte sur deux rapports de référence — un à bloquer, un à laisser passer — puis sur douze rapports fabriqués à la volée, moitié-moitié. Une porte qui bloque toujours échoue sur les seconds ; un `|| true` échoue sur les premiers. C’est le même couple refuse/autorise que les tests de régression, et c’est ce qui distingue une porte d’un affichage. Le seuil retenu, lui, est un arbitrage : il est donné par l’énoncé, il n’est pas noté.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/scripts/gate.mjs`](solutions/scripts/gate.mjs)
</details>

<a id="risk-exception"></a>

### L’exception qui expire

**N2** · CWE-1059 · D2 Cycle de vie · D6 Tests

Des vulnérabilités bloquent la CI et ne peuvent pas être corrigées cette semaine — `fixtures/m01/osv-scan.json` dit lesquelles. L’équipe veut « juste désactiver la règle ».

**Objectif.** Déposer les exceptions : motivées, datées, bornées dans le temps, et refusées quand la vulnérabilité est activement exploitée ou quand un correctif existe.

**Où.** `osv-scanner.toml`

**Dans le cours.**
- [Jalons, portes et exceptions](http://127.0.0.1:5173/#/modules/m32/l03) · [source](../src/content/m32/l03.mdx)
- [Prioriser par le risque](http://127.0.0.1:5173/#/modules/m05/l03) · [source](../src/content/m05/l03.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Le harnais exige pour chaque exception un motif substantiel et propre à elle, une date d’expiration dans le futur et à moins de quatre-vingt-dix jours, et il refuse l’exception dès que l’identifiant figure au catalogue d’exploitation connue ou qu’une version corrigée existe. Il exige aussi la complétude : une vulnérabilité sans correctif laissée sans exception bloque toujours la CI. La pertinence du motif n’est pas jugée — sa présence, sa longueur et son unicité le sont. Une exception sans date n’est pas une exception, c’est un abandon.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/osv-scanner.toml`](solutions/osv-scanner.toml)
</details>

<a id="ssdf-attestation"></a>

### Attestation SSDF adossée au dépôt

**N3** · CWE-1059 · D2 Cycle de vie

Un client exige l’attestation de conformité au cadre de développement sécurisé du NIST — non plus comme obligation fédérale, rescindée en janvier 2026, mais comme clause de contrat. Le premier réflexe est de cocher les cases.

**Objectif.** Remplir la matrice des vingt-deux tâches de `fixtures/m01/ssdf-tasks.yaml` en citant, pour chaque tâche revendiquée, la preuve qui existe réellement dans le dépôt.

**Où.** `program/ssdf.yaml`

**Dans le cours.**
- [Risque et acceptation](http://127.0.0.1:5173/#/modules/m26/l06) · [source](../src/content/m26/l06.mdx)
- [Cyber Resilience Act et roadmap](http://127.0.0.1:5173/#/modules/m32/l05) · [source](../src/content/m32/l05.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Le harnais vérifie que chaque chemin cité existe, et pousse plus loin sur un sous-ensemble : la revue est-elle réellement routée, la suite de tests réellement appelée en CI, l’analyse de dépendances réellement lancée. Une preuve inventée est détectée ; une preuve faible mais réelle passe — et c’est exactement la limite d’une attestation, qui se signe sur l’honneur. Il refuse en revanche les deux raccourcis : plus de trois tâches « non applicable », ou moins de six tâches réellement revendiquées. Ce qui a changé en 2026, c’est qui l’exige, pas ce qu’elle vaut.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/program/ssdf.yaml`](solutions/program/ssdf.yaml)
</details>

<a id="cra-notification"></a>

### Le signalement CRA, en test

**N3** · CWE-1059 · D2 Cycle de vie · D8 Supply chain

Le Cyber Resilience Act impose depuis le 11/09/2026 une alerte sous 24 h et une notification sous 72 h pour une vulnérabilité activement exploitée dans un produit.

**Objectif.** Implémenter le déclencheur qui décide si une vulnérabilité du SBOM déclenche l’obligation, et calcule les deux échéances.

**Où.** `scripts/cra-report.mjs`

**Dans le cours.**
- [Cyber Resilience Act et roadmap](http://127.0.0.1:5173/#/modules/m32/l05) · [source](../src/content/m32/l05.mdx)
- [Divulgation, bug bounty et CRA](http://127.0.0.1:5173/#/modules/m05/l06) · [source](../src/content/m05/l06.mdx)

<details>
<summary>La classe de bugs à éliminer (spoiler)</summary>

Trois SBOM d’essai, trois décisions attendues, puis huit couples SBOM/catalogue tirés au hasard : une fonction pure sur des données passées en argument, donc entièrement déterministe. Le harnais refuse aussi le déclencheur qui rend la même réponse partout. La qualification juridique — ce qui compte comme « produit », ce qui compte comme « connaissance » du fait — n’est pas automatisable et n’est pas jugée ici.

Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [`solutions/scripts/cra-report.mjs`](solutions/scripts/cra-report.mjs)
</details>

## Couverture

### Par domaine CSSLP

| Domaine | Jouables | À venir | Total |
| --- | --- | --- | --- |
| D1 Concepts | 26 | 6 | 32 |
| D2 Cycle de vie | 13 | 4 | 17 |
| D3 Exigences | 13 | 4 | 17 |
| D4 Architecture | 46 | 10 | 56 |
| D5 Implémentation | 110 | 15 | 125 |
| D6 Tests | 32 | 14 | 46 |
| D7 Déploiement & exploitation | 86 | 17 | 103 |
| D8 Supply chain | 44 | 4 | 48 |

### Par module

| Module | Jouables | À venir |
| --- | --- | --- |
| M3 · Présentation de l’AppSec | 4 | — |
| M7 · Vulnérabilités côté serveur | 29 | 2 |
| M9 · Web avancé | 29 | 1 |
| M8 · Vulnérabilités côté client & scripts tiers | 21 | 5 |
| M26 · Gestion des vulnérabilités | 9 | 2 |
| M30 · Faire adopter la sécurité | 3 | 1 |
| M12 · Exigences, vie privée & conformité | 6 | 1 |
| M13 · Spécifier et concevoir | 2 | 4 |
| M14 · Identité : authentification, autorisation, OAuth & SAML | 5 | 1 |
| M15 · Anti-abus, ATO & fraude | 5 | 2 |
| M11 · Threat modeling & MITRE | 7 | — |
| M16 · Revue de code sécurité | 5 | 1 |
| M17 · Tests & analyse de code | 6 | 6 |
| M18 · Pipeline, supply chain & fournisseurs | 20 | 2 |
| M19 · IAM AWS | 15 | — |
| M20 · Infrastructure as Code | 14 | 1 |
| M21 · Déploiement, exploitation & résilience | 9 | 5 |
| M23 · Journalisation & SIEM (Elastic) | 7 | 1 |
| M27 · Sécurité des applications LLM | 25 | 2 |
| M32 · Capstone : revue de sécurité de Novafact | — | 12 |
| M4 · Les métiers de l’AppSec | 1 | — |
| M5 · Maturité et posture de sécurité | 2 | — |
| M24 · Detection engineering | 12 | — |
| M28 · Agents & MCP | 5 | — |
| M31 · Le programme AppSec | 5 | — |

### Par chapitre de *Designing Secure Software*

| Chapitre | Challenges |
| --- | --- |
| K1 | Le journal infalsifiable |
| K2 | Le DFD qui remonte la bonne menace, STRIDE par élément, sans trou, Le modèle qui bloque la PR, Étape 3 · Threat model |
| K4 | Script tiers piloté par la configuration, L’empoisonnement de description d’outil, Le tool shadowing, Trust policy OIDC mal filtrée, Accès inter-comptes sans ExternalId, Nommer les patterns déjà présents, Éteindre un service proprement |
| K5 | Nonce de CSP réutilisé, Jetons de réinitialisation collidants, Jeton tiré de Math.random, Politique de clé trop permissive, Webhook signé mais rejouable, Mots de passe hachés trop vite, Clé de signature unique et éternelle, Lier le jeton à son porteur, Le secret de repli |
| K6 | Étape 2 · Design doc et revue de conception |
| K7 | Étape 2 · Design doc et revue de conception |
| K8 | Prototype pollution côté serveur, Confusion de type sur la query string, TOCTOU sur le téléversement, Clés JSON dupliquées, Désérialisation de types arbitraires, Pollution de prototype côté client, Normalisation après le contrôle d’unicité, Comparaison de jeton à temps variable, Cookie de préférences désérialisé, Chaîne de vulnérabilités |
| K9 | Arithmétique de l’argent, Au-delà de 2^53, Number() permissif sur les montants |
| K10 | Injection NoSQL dans la connexion, Expansion d’entités sur le même import, XXE à l’import de facture électronique, Expression de validation non ancrée, Troncature après validation, Injection d’en-tête dans l’e-mail de facture |
| K11 | XSS stockée dans la note de facture, URL javascript: rendue par React |
| K13 | Erreur non gérée et état incohérent, Le catch qui échoue ouvert, Modéliser l’agent, la chaîne et le poste |

### Par leçon

**158 des 238 leçons** du parcours sont rattachées à au moins un challenge.

<details>
<summary><strong>M1 · Cybersécurité et panorama de la menace</strong> — 0/6 leçons couvertes</summary>

| Leçon | Challenges |
| --- | --- |
| [La cybersécurité en un coup d’œil](http://127.0.0.1:5173/#/modules/m21/l01) | — |
| [Qui attaque, et pourquoi](http://127.0.0.1:5173/#/modules/m21/l02) | — |
| [Le panorama 2025-2026 en chiffres](http://127.0.0.1:5173/#/modules/m21/l03) | — |
| [Les portes d’entrée qui passent par l’application](http://127.0.0.1:5173/#/modules/m21/l04) | — |
| [Les affaires qui ont façonné le métier](http://127.0.0.1:5173/#/modules/m21/l05) | — |
| [Pourquoi le logiciel reste vulnérable](http://127.0.0.1:5173/#/modules/m21/l06) | — |

</details>

<details>
<summary><strong>M2 · MITRE ATT&CK et la menace SaaS</strong> — 0/6 leçons couvertes</summary>

| Leçon | Challenges |
| --- | --- |
| [ATT&CK : histoire et logique](http://127.0.0.1:5173/#/modules/m22/l01) | — |
| [Les quatre usages d’ATT&CK](http://127.0.0.1:5173/#/modules/m22/l02) | — |
| [La menace SaaS et identité](http://127.0.0.1:5173/#/modules/m22/l03) | — |
| [Se protéger : les mitigations qui comptent](http://127.0.0.1:5173/#/modules/m22/l04) | — |
| [Cas réels décortiqués](http://127.0.0.1:5173/#/modules/m22/l05) | — |
| [Du TTP à la classe de bug](http://127.0.0.1:5173/#/modules/m22/l06) | — |

</details>

<details>
<summary><strong>M3 · Présentation de l’AppSec</strong> — 4/5 leçons couvertes</summary>

| Leçon | Challenges |
| --- | --- |
| [Du pentest à l’AppSec](http://127.0.0.1:5173/#/modules/m01/l01) | [Du finding au backlog](#pentest-to-appsec) |
| [La confiance](http://127.0.0.1:5173/#/modules/m01/l02) | [À qui fait-on confiance, au juste](#trust-inventory) |
| [C-I-A et Gold Standard](http://127.0.0.1:5173/#/modules/m01/l03) | [Authentifier, autoriser, journaliser](#gold-standard-audit)<br>[Le vocabulaire imposé](#logging-vocabulary)<br>Le journal infalsifiable *(à venir)* |
| [Le SSDLC et la carte du parcours](http://127.0.0.1:5173/#/modules/m01/l04) | — |
| [Principes DevSecOps](http://127.0.0.1:5173/#/modules/m01/l05) | [Le gabarit de route qui naît sûr](#paved-road-template) |

</details>

<details>
<summary><strong>M4 · Les métiers de l’AppSec</strong> — 2/7 leçons couvertes</summary>

| Leçon | Challenges |
| --- | --- |
| [Le rôle : une équipe qui rend capable](http://127.0.0.1:5173/#/modules/m23/l01) | [Router la revue vers les bonnes personnes](#codeowners-sensitive) |
| [Panorama des rôles](http://127.0.0.1:5173/#/modules/m23/l02) | — |
| [Organiser l’équipe](http://127.0.0.1:5173/#/modules/m23/l03) | — |
| [Security Champions](http://127.0.0.1:5173/#/modules/m23/l04) | [Router la revue vers les bonnes personnes](#codeowners-sensitive) |
| [Travailler avec les autres fonctions](http://127.0.0.1:5173/#/modules/m23/l05) | — |
| [Le cadre juridique du métier](http://127.0.0.1:5173/#/modules/m23/l06) | — |
| [Compétences, certifications et carrière](http://127.0.0.1:5173/#/modules/m23/l07) | — |

</details>

<details>
<summary><strong>M5 · Maturité et posture de sécurité</strong> — 2/6 leçons couvertes</summary>

| Leçon | Challenges |
| --- | --- |
| [Maturité ou posture ?](http://127.0.0.1:5173/#/modules/m24/l01) | — |
| [OWASP SAMM v2](http://127.0.0.1:5173/#/modules/m24/l02) | [Évaluation SAMM qui se calcule](#samm-assessment)<br>[La feuille de route dérivée de l’écart](#samm-roadmap)<br>[Se comparer plutôt que se noter](#bsimm-compare)<br>Étape 11 · Roadmap à 12 mois *(à venir)* |
| [BSIMM16 : se comparer](http://127.0.0.1:5173/#/modules/m24/l03) | [Se comparer plutôt que se noter](#bsimm-compare) |
| [Les autres modèles](http://127.0.0.1:5173/#/modules/m24/l04) | — |
| [Mesurer la posture applicative](http://127.0.0.1:5173/#/modules/m24/l05) | — |
| [Un état des lieux en deux semaines](http://127.0.0.1:5173/#/modules/m24/l06) | — |

</details>

<details>
<summary><strong>M6 · Le web et ses protections</strong> — 1/8 leçons couvertes</summary>

| Leçon | Challenges |
| --- | --- |
| [De l’URL au pixel](http://127.0.0.1:5173/#/modules/m25/l01) | — |
| [HTTP de bout en bout](http://127.0.0.1:5173/#/modules/m25/l02) | — |
| [URL, origine, site et DNS](http://127.0.0.1:5173/#/modules/m25/l03) | — |
| [TLS et certificats en pratique](http://127.0.0.1:5173/#/modules/m25/l04) | — |
| [Le modèle de sécurité du navigateur](http://127.0.0.1:5173/#/modules/m25/l05) | — |
| [Cookies et état](http://127.0.0.1:5173/#/modules/m25/l06) | — |
| [La carte des en-têtes de sécurité](http://127.0.0.1:5173/#/modules/m25/l07) | — |
| [Top 10 2025, API Top 10 et CWE Top 25](http://127.0.0.1:5173/#/modules/m25/l08) | Cartographier les défauts du lab *(à venir)* |

</details>

<details>
<summary><strong>M7 · Vulnérabilités côté serveur</strong> — 5/9 leçons couvertes</summary>

| Leçon | Challenges |
| --- | --- |
| [Entrées non fiables dans Express](http://127.0.0.1:5173/#/modules/m02/l01) | [Injection NoSQL dans la connexion](#nosql-auth)<br>[Mass assignment sur le profil](#mass-assignment)<br>[BOLA : la facture du voisin](#bola-invoice)<br>[BFLA : la méthode oubliée](#bfla-method)<br>[BOLA sur un identifiant imbriqué](#bola-nested)<br>[Confusion de type sur la query string](#qs-type-confusion)<br>[Autorisation sur une seule étape du flux](#multistep-authz)<br>[Endpoint à double usage mal isolé](#dual-use-endpoint)<br>[Injection de formule dans l’export CSV](#csv-formula-injection)<br>[SSTI par les options de rendu](#ssti-render-options)<br>[Expansion d’entités sur le même import](#xml-entity-expansion)<br>[XXE à l’import de facture électronique](#xxe-import)<br>[Clés JSON dupliquées](#json-duplicate-keys)<br>[Contrôle d’accès par préfixe d’URL](#url-prefix-authz)<br>[Expression de validation non ancrée](#regex-unanchored)<br>Injection d’en-tête dans l’e-mail de facture *(à venir)* |
| [Footguns JavaScript et argent](http://127.0.0.1:5173/#/modules/m02/l02) | [Arithmétique de l’argent](#money-float)<br>[Le décodeur obéissant](#encoded-bypass)<br>[Au-delà de 2^53](#max-safe-integer)<br>[Number() permissif sur les montants](#number-coercion)<br>[Normalisation après le contrôle d’unicité](#unicode-normalization)<br>[Jeton tiré de Math.random](#weak-random)<br>La propriété qui trouve le bug d’argent *(à venir)* |
| [Spécificités Node.js](http://127.0.0.1:5173/#/modules/m02/l03) | [Prototype pollution côté serveur](#proto-pollution)<br>[ReDoS sur la référence de facture](#redos)<br>[Traversée de chemin sur les pièces jointes](#path-traversal)<br>[SSRF vers le service de métadonnées](#ssrf-imds)<br>[eval dans le calcul des pénalités](#eval-formula)<br>[node:vm n’est pas un bac à sable](#vm-escape)<br>[Injection de commande dans l’export](#cmd-injection)<br>[Zip Slip à l’import d’un lot de factures](#zip-slip)<br>Le fuzz qui casse le parseur *(à venir)* |
| [Erreurs, exceptions et atomicité](http://127.0.0.1:5173/#/modules/m02/l04) | [Race condition : l’avoir dépensé deux fois](#race-credit)<br>[Erreur non gérée et état incohérent](#error-leak)<br>[Number() permissif sur les montants](#number-coercion)<br>[GraphQL : reconstruire le schéma sans introspection](#graphql-clairvoyance)<br>[Le catch qui échoue ouvert](#try-catch-fail-open)<br>[Troncature après validation](#input-truncation)<br>[Comparaison de jeton à temps variable](#timing-attack) |
| [XML, DTD et XXE](http://127.0.0.1:5173/#/modules/m02/l05) | — |
| [HTML côté serveur, XSS et jetons CSRF](http://127.0.0.1:5173/#/modules/m02/l06) | — |
| [Fichiers : upload, téléchargement et chemins](http://127.0.0.1:5173/#/modules/m02/l07) | — |
| [Next.js, RSC et Server Actions](http://127.0.0.1:5173/#/modules/m02/l08) | — |
| [Éliminer une classe entière](http://127.0.0.1:5173/#/modules/m02/l09) | [Injection NoSQL dans la connexion](#nosql-auth)<br>[eval dans le calcul des pénalités](#eval-formula)<br>[Injection de commande dans l’export](#cmd-injection) |

</details>

<details>
<summary><strong>M8 · Vulnérabilités côté client & scripts tiers</strong> — 9/9 leçons couvertes</summary>

| Leçon | Challenges |
| --- | --- |
| [Le client n’est pas sous ton contrôle](http://127.0.0.1:5173/#/modules/m04/l01) | [Secret livré dans le bundle](#secret-in-bundle) |
| [React et le navigateur](http://127.0.0.1:5173/#/modules/m04/l02) | [XSS stockée dans la note de facture](#dom-xss)<br>[Confusion de Content-Type sur une mutation](#content-type-confusion)<br>[CSRF sur le point d’accès GraphQL](#graphql-csrf)<br>[URL javascript: rendue par React](#react-javascript-url)<br>[SameSite contourné par surcharge de méthode](#samesite-method-override)<br>[Redirection ouverte après connexion](#open-redirect)<br>Jeton anti-CSRF non lié à la session *(à venir)*<br>Cookie de session mal attribué *(à venir)* |
| [Scripts tiers](http://127.0.0.1:5173/#/modules/m04/l03) | [Script tiers piloté par la configuration](#third-party-script) |
| [Réduire la confiance](http://127.0.0.1:5173/#/modules/m04/l04) | [Script tiers piloté par la configuration](#third-party-script)<br>Iframe de paiement sans sandbox *(à venir)* |
| [CSP stricte en pratique](http://127.0.0.1:5173/#/modules/m04/l05) | [XSS stockée dans la note de facture](#dom-xss)<br>[L’image qui part toute seule](#markdown-image-exfil)<br>[Nonce de CSP réutilisé](#csp-nonce-reuse)<br>[Gadget dans une origine autorisée](#csp-gadget)<br>Page de paiement sans CSP *(à venir)*<br>La CSP qui ne protège de rien *(à venir)* |
| [Trusted Types et Sanitizer API](http://127.0.0.1:5173/#/modules/m04/l06) | [XSS stockée dans la note de facture](#dom-xss)<br>[Sortie du modèle rendue en HTML](#llm-markdown-xss)<br>[Logo SVG exécutable](#svg-logo)<br>[URL javascript: rendue par React](#react-javascript-url)<br>[Pollution de prototype côté client](#client-proto-pollution)<br>[DOM clobbering sur la configuration](#dom-clobbering)<br>[Trusted Types en trompe-l’œil](#trusted-types-default) |
| [Isolation d’origine](http://127.0.0.1:5173/#/modules/m04/l07) | [Pièce jointe servie sur l’origine de l’application](#attachment-same-origin)<br>[Pipeline d’upload non isolé](#upload-pipeline)<br>[postMessage sans contrôle d’origine](#postmessage-origin)<br>[Fuite par l’en-tête Referer](#referrer-leak)<br>[Clickjacking sur les coordonnées bancaires](#clickjacking-prefilled)<br>[SameSite contourné par surcharge de méthode](#samesite-method-override)<br>[CORS : origine reflétée avec identifiants](#cors-origin-reflection)<br>[CORS : origine null autorisée](#cors-null-origin)<br>[XS-Leak par comptage de cadres](#xsleak-frame-count)<br>[XS-Leak par événements d’erreur](#xsleak-error-events)<br>[Validation de paiement encadrable](#clickjacking)<br>Jeton anti-CSRF non lié à la session *(à venir)*<br>Cookie de session mal attribué *(à venir)* |
| [PCI DSS 4.0.1 : 6.4.3 et 11.6.1](http://127.0.0.1:5173/#/modules/m04/l08) | [Script tiers piloté par la configuration](#third-party-script)<br>[Ce que la conformité impose vraiment](#compliance-matrix)<br>Iframe de paiement sans sandbox *(à venir)*<br>Étape 5 · Page de paiement *(à venir)* |
| [Surveiller le client](http://127.0.0.1:5173/#/modules/m04/l09) | Surveiller ce que la page charge *(à venir)* |

</details>

<details>
<summary><strong>M9 · Web avancé : le programme PortSwigger</strong> — 12/13 leçons couvertes</summary>

| Leçon | Challenges |
| --- | --- |
| [Race conditions](http://127.0.0.1:5173/#/modules/m03/l01) | [Race condition : l’avoir dépensé deux fois](#race-credit)<br>[Course entre paiement et annulation](#race-multi-endpoint)<br>[TOCTOU sur le téléversement](#toctou-upload)<br>[Course à la construction du compte](#race-partial-construction)<br>[Jetons de réinitialisation collidants](#reset-token-collision) |
| [En-tête Host](http://127.0.0.1:5173/#/modules/m03/l02) | [Empoisonnement du lien de réinitialisation](#host-header)<br>[Limitation contournée par X-Forwarded-For](#xff-spoof) |
| [API avancée et GraphQL](http://127.0.0.1:5173/#/modules/m03/l03) | [Pollution de paramètres côté serveur](#param-pollution)<br>[GraphQL : introspection et coût](#graphql-introspection)<br>[GraphQL : reconstruire le schéma sans introspection](#graphql-clairvoyance)<br>[CSRF sur le point d’accès GraphQL](#graphql-csrf)<br>[GraphQL : force brute par alias](#graphql-batching) |
| [Chaînes de vulnérabilités](http://127.0.0.1:5173/#/modules/m03/l04) | [Course entre paiement et annulation](#race-multi-endpoint)<br>Chaîne de vulnérabilités *(à venir)*<br>Étape 9 · Vulnérabilités avancées *(à venir)* |
| [Request smuggling et désynchronisation](http://127.0.0.1:5173/#/modules/m03/l05) | — |
| [Cache poisoning et cache deception](http://127.0.0.1:5173/#/modules/m03/l06) | [Empoisonnement du cache par une entrée hors clé](#cache-poison)<br>[La fuite d’une session à l’autre](#cross-session-leak)<br>[Réponse authentifiée mise en cache](#vary-missing)<br>[Cache deception sur le PDF de facture](#cache-deception-pdf) |
| [Parser differentials et fuites via l’ORM](http://127.0.0.1:5173/#/modules/m03/l07) | [Empoisonnement du cache par une entrée hors clé](#cache-poison)<br>[Fuite par l’ORM sur un filtre](#orm-leak)<br>[Confusion de type sur la query string](#qs-type-confusion)<br>[XXE à l’import de facture électronique](#xxe-import)<br>[Clés JSON dupliquées](#json-duplicate-keys)<br>[Confusion de Content-Type sur une mutation](#content-type-confusion)<br>[Normalisation après le contrôle d’unicité](#unicode-normalization)<br>[Différentiel d’analyse d’adresse](#email-parsing-differential)<br>[SAML : envelopper la signature](#saml-wrapping) |
| [SSTI et injection de code](http://127.0.0.1:5173/#/modules/m03/l08) | [node:vm n’est pas un bac à sable](#vm-escape)<br>[SSTI par les options de rendu](#ssti-render-options)<br>[SSTI dans le gabarit de relance](#ssti-email-template) |
| [Désérialisation et prototype pollution avancées](http://127.0.0.1:5173/#/modules/m03/l09) | [Prototype pollution côté serveur](#proto-pollution)<br>[Désérialisation de types arbitraires](#deserialization)<br>[Cookie de préférences désérialisé](#cookie-deserialization) |
| [Protocoles d’authentification avancés](http://127.0.0.1:5173/#/modules/m03/l10) | [JWT : décoder n’est pas vérifier](#jwt-decode)<br>[JWT : kid en traversée de chemin](#jwt-kid-traversal)<br>[JWT : jku et jwk honorés](#jwt-jku-jwk)<br>[Jeton valable d’un tenant à l’autre](#jwt-no-audience)<br>[Session qu’on ne peut pas révoquer](#session-not-revocable)<br>Lier le jeton à son porteur *(à venir)* |
| [SSRF avancée](http://127.0.0.1:5173/#/modules/m03/l11) | [SSRF vers le service de métadonnées](#ssrf-imds)<br>[SSRF par le générateur de PDF](#ssrf-pdf-renderer)<br>[SSRF par redirection](#ssrf-redirect-bypass) |
| [Client avancé : DOM, CSP et XS-Leaks](http://127.0.0.1:5173/#/modules/m03/l12) | [Pollution de prototype côté client](#client-proto-pollution)<br>[DOM clobbering sur la configuration](#dom-clobbering)<br>[postMessage sans contrôle d’origine](#postmessage-origin)<br>[Nonce de CSP réutilisé](#csp-nonce-reuse)<br>[Gadget dans une origine autorisée](#csp-gadget)<br>[Trusted Types en trompe-l’œil](#trusted-types-default)<br>[CORS : origine null autorisée](#cors-null-origin)<br>[XS-Leak par comptage de cadres](#xsleak-frame-count)<br>[XS-Leak par événements d’erreur](#xsleak-error-events) |
| [Web LLM attacks et recherche assistée par IA](http://127.0.0.1:5173/#/modules/m03/l13) | [Exfiltrer sans se faire remarquer](#stealth-attack) |

</details>

<details>
<summary><strong>M10 · Analyse de risques</strong> — 1/6 leçons couvertes</summary>

| Leçon | Challenges |
| --- | --- |
| [Le vocabulaire du risque](http://127.0.0.1:5173/#/modules/m26/l01) | — |
| [EBIOS Risk Manager appliqué à Novafact](http://127.0.0.1:5173/#/modules/m26/l02) | — |
| [Noter sans se mentir](http://127.0.0.1:5173/#/modules/m26/l03) | — |
| [Quantifier avec FAIR](http://127.0.0.1:5173/#/modules/m26/l04) | — |
| [Traiter le risque et tenir le registre](http://127.0.0.1:5173/#/modules/m26/l05) | — |
| [Risque et acceptation](http://127.0.0.1:5173/#/modules/m26/l06) | [Attestation SSDF adossée au dépôt](#ssdf-attestation) |

</details>

<details>
<summary><strong>M11 · Threat modeling & MITRE</strong> — 6/6 leçons couvertes</summary>

| Leçon | Challenges |
| --- | --- |
| [Les 4 questions et la démarche](http://127.0.0.1:5173/#/modules/m11/l01) | [Le DFD qui remonte la bonne menace](#dfd-as-code)<br>Étape 3 · Threat model *(à venir)* |
| [STRIDE par élément](http://127.0.0.1:5173/#/modules/m11/l02) | [STRIDE par élément, sans trou](#stride-per-element)<br>L’abuse case exécutable *(à venir)* |
| [Choisir sa méthode](http://127.0.0.1:5173/#/modules/m11/l03) | [L’arbre d’attaque coupé](#attack-tree)<br>[LINDDUN sur le parcours de facturation](#linddun-privacy) |
| [MITRE pour l’AppSec](http://127.0.0.1:5173/#/modules/m11/l04) | [Du CWE à la technique ATT&CK](#cwe-capec-attack)<br>[La couverture qui se prouve](#detection-coverage)<br>Cartographier avec ATLAS *(à venir)* |
| [Threat modeling agile et as code](http://127.0.0.1:5173/#/modules/m11/l05) | [Le DFD qui remonte la bonne menace](#dfd-as-code)<br>[Le modèle qui bloque la PR](#tm-drift-ci) |
| [Modéliser l’IA, la supply chain et le dev](http://127.0.0.1:5173/#/modules/m11/l06) | [Nuire avant le premier appel](#line-jumping)<br>[Modéliser l’agent, la chaîne et le poste](#tm-ai-supply-dev) |

</details>

<details>
<summary><strong>M12 · Exigences, vie privée & conformité</strong> — 6/6 leçons couvertes</summary>

| Leçon | Challenges |
| --- | --- |
| [Exigences et abuse cases](http://127.0.0.1:5173/#/modules/m07/l01) | [Troncature après validation](#input-truncation)<br>[Cadrer un test d’intrusion](#pentest-scope)<br>[Le sous-ensemble ASVS de Novafact](#asvs-subset)<br>L’abuse case exécutable *(à venir)* |
| [Matrice de traçabilité](http://127.0.0.1:5173/#/modules/m07/l02) | [Le sous-ensemble ASVS de Novafact](#asvs-subset)<br>[La matrice qui ne ment pas](#traceability-matrix)<br>[L’inventaire de journalisation](#logging-inventory)<br>Étape 1 · Exigences et traçabilité *(à venir)* |
| [Classification des données](http://127.0.0.1:5173/#/modules/m07/l03) | [Fuite par l’ORM sur un filtre](#orm-leak)<br>[Injection de formule dans l’export CSV](#csv-formula-injection)<br>[La carte des données, confrontée au code](#data-classification)<br>[Des données de test qui ne viennent pas de la prod](#test-data-generator)<br>Éteindre un service proprement *(à venir)* |
| [Vie privée et RGPD](http://127.0.0.1:5173/#/modules/m07/l04) | [L’index survit à la suppression](#index-after-deletion)<br>[La carte des données, confrontée au code](#data-classification)<br>[L’effacement qui efface pour de bon](#erasure-test)<br>[LINDDUN sur le parcours de facturation](#linddun-privacy)<br>[Ce qu’il ne faut jamais journaliser](#never-log) |
| [Conformité : NIS2, CRA, PCI DSS](http://127.0.0.1:5173/#/modules/m07/l05) | [Envoi de factures détourné](#send-quota)<br>[Ce que la conformité impose vraiment](#compliance-matrix)<br>Exigences de sécurité envers un fournisseur *(à venir)* |
| [Provisionnement des accès](http://127.0.0.1:5173/#/modules/m07/l06) | [Recertifier les accès](#access-recertification) |

</details>

<details>
<summary><strong>M13 · Spécifier et concevoir</strong> — 8/11 leçons couvertes</summary>

| Leçon | Challenges |
| --- | --- |
| [La spécification fonctionnelle de sécurité](http://127.0.0.1:5173/#/modules/m08/l01) | — |
| [Mitigations structurelles](http://127.0.0.1:5173/#/modules/m08/l02) | [Traversée de chemin sur les pièces jointes](#path-traversal)<br>[STRIDE par élément, sans trou](#stride-per-element) |
| [Les 14 patterns](http://127.0.0.1:5173/#/modules/m08/l03) | Nommer les patterns déjà présents *(à venir)* |
| [Les 4 anti-patterns](http://127.0.0.1:5173/#/modules/m08/l04) | [Script tiers piloté par la configuration](#third-party-script)<br>[Injection indirecte dans « Ask Novafact »](#prompt-injection)<br>[Le tool shadowing](#tool-shadowing)<br>[À qui fait-on confiance, au juste](#trust-inventory)<br>[Accès inter-comptes sans ExternalId](#iam-external-id)<br>Nommer les patterns déjà présents *(à venir)* |
| [Patterns d’architecture](http://127.0.0.1:5173/#/modules/m08/l05) | [Pièce jointe servie sur l’origine de l’application](#attachment-same-origin)<br>[Logo SVG exécutable](#svg-logo)<br>[TOCTOU sur le téléversement](#toctou-upload)<br>[Pipeline d’upload non isolé](#upload-pipeline)<br>[SSRF par le générateur de PDF](#ssrf-pdf-renderer)<br>[Zip Slip à l’import d’un lot de factures](#zip-slip) |
| [Architectures multi-tenant : silo, pool, bridge](http://127.0.0.1:5173/#/modules/m08/l06) | — |
| [Conception d’interfaces](http://127.0.0.1:5173/#/modules/m08/l07) | [Endpoint à double usage mal isolé](#dual-use-endpoint)<br>[SSTI dans le gabarit de relance](#ssti-email-template)<br>[Pollution de paramètres côté serveur](#param-pollution) |
| [Crypto pour développeurs](http://127.0.0.1:5173/#/modules/m08/l08) | [Comparaison de jeton à temps variable](#timing-attack)<br>[Jetons de réinitialisation collidants](#reset-token-collision)<br>[Cookie de préférences désérialisé](#cookie-deserialization)<br>[Jeton tiré de Math.random](#weak-random)<br>[Politique de clé trop permissive](#kms-key-policy)<br>Webhook signé mais rejouable *(à venir)*<br>Mots de passe hachés trop vite *(à venir)*<br>Clé de signature unique et éternelle *(à venir)*<br>Le secret de repli *(à venir)* |
| [Crypto : hash, nonces et métadonnées](http://127.0.0.1:5173/#/modules/m08/l09) | — |
| [La spécification technique : le design doc](http://127.0.0.1:5173/#/modules/m08/l10) | Étape 2 · Design doc et revue de conception *(à venir)* |
| [Mener une Security Design Review](http://127.0.0.1:5173/#/modules/m08/l11) | [L’arbre d’attaque coupé](#attack-tree)<br>Étape 2 · Design doc et revue de conception *(à venir)* |

</details>

<details>
<summary><strong>M14 · Identité : authentification, autorisation, OAuth & SAML</strong> — 8/8 leçons couvertes</summary>

| Leçon | Challenges |
| --- | --- |
| [Authentification applicative](http://127.0.0.1:5173/#/modules/m09/l01) | [Empoisonnement du lien de réinitialisation](#host-header)<br>[Course à la construction du compte](#race-partial-construction)<br>[nOAuth : e-mail non vérifié](#oauth-email-unverified)<br>[Énumération de comptes](#user-enumeration)<br>Mots de passe hachés trop vite *(à venir)* |
| [Autorisation et multi-tenant](http://127.0.0.1:5173/#/modules/m09/l02) | [BOLA : la facture du voisin](#bola-invoice)<br>[Le produit lui-même comme canal](#product-as-channel)<br>[RAG sans contrôle d’accès](#rag-acl)<br>[BFLA : la méthode oubliée](#bfla-method)<br>[BOLA sur un identifiant imbriqué](#bola-nested) |
| [OAuth 2.1 et Authorization Code + PKCE](http://127.0.0.1:5173/#/modules/m09/l03) | [redirect_uri validée par préfixe](#oauth-redirect)<br>[Connexion fédérée sans state](#oauth-state) |
| [SPA : RFC 10017 et BFF](http://127.0.0.1:5173/#/modules/m09/l04) | [Jeton d’accès passé dans l’URL](#token-in-url)<br>[Fuite par l’en-tête Referer](#referrer-leak)<br>[Session qu’on ne peut pas révoquer](#session-not-revocable) |
| [Valider un JWT dans Express](http://127.0.0.1:5173/#/modules/m09/l05) | [JWT : décoder n’est pas vérifier](#jwt-decode)<br>[JWT : kid en traversée de chemin](#jwt-kid-traversal)<br>[JWT : jku et jwk honorés](#jwt-jku-jwk)<br>[Jeton valable d’un tenant à l’autre](#jwt-no-audience) |
| [Attaques OAuth et OIDC](http://127.0.0.1:5173/#/modules/m09/l06) | [Redirection ouverte après connexion](#open-redirect)<br>[Différentiel d’analyse d’adresse](#email-parsing-differential)<br>[redirect_uri validée par préfixe](#oauth-redirect)<br>[Connexion fédérée sans state](#oauth-state)<br>[nOAuth : e-mail non vérifié](#oauth-email-unverified) |
| [RFC 9700, DPoP, PAR et FAPI](http://127.0.0.1:5173/#/modules/m09/l07) | Lier le jeton à son porteur *(à venir)* |
| [SAML en entreprise](http://127.0.0.1:5173/#/modules/m09/l08) | [SAML : envelopper la signature](#saml-wrapping) |

</details>

<details>
<summary><strong>M15 · Anti-abus, ATO & fraude</strong> — 7/7 leçons couvertes</summary>

| Leçon | Challenges |
| --- | --- |
| [Taxonomie des menaces automatisées](http://127.0.0.1:5173/#/modules/m10/l01) | Nommer l’abus qu’on subit *(à venir)* |
| [Credential stuffing et prise de contrôle](http://127.0.0.1:5173/#/modules/m10/l02) | [Credential stuffing sans limite](#no-rate-limit)<br>[Expression de validation non ancrée](#regex-unanchored)<br>[Énumération de comptes](#user-enumeration)<br>[La corrélation temporelle](#rule-temporal-spray) |
| [Limitation de débit bien conçue](http://127.0.0.1:5173/#/modules/m10/l03) | [Credential stuffing sans limite](#no-rate-limit)<br>[GraphQL : force brute par alias](#graphql-batching)<br>[Limitation contournée par X-Forwarded-For](#xff-spoof)<br>[La réponse graduée](#graduated-response)<br>Distinguer un bot d’un client *(à venir)*<br>Étape 6 · Contrôles anti-abus *(à venir)* |
| [Bots et Fraud Control](http://127.0.0.1:5173/#/modules/m10/l04) | Distinguer un bot d’un client *(à venir)* |
| [Abus de fonctionnalités](http://127.0.0.1:5173/#/modules/m10/l05) | [Invariant métier : rouvrir une facture payée](#invoice-state)<br>[Envoi de factures détourné](#send-quota)<br>[Clickjacking sur les coordonnées bancaires](#clickjacking-prefilled)<br>Injection d’en-tête dans l’e-mail de facture *(à venir)* |
| [Invariants métier](http://127.0.0.1:5173/#/modules/m10/l06) | [Arithmétique de l’argent](#money-float)<br>[Invariant métier : rouvrir une facture payée](#invoice-state)<br>[Au-delà de 2^53](#max-safe-integer)<br>[Autorisation sur une seule étape du flux](#multistep-authz)<br>Webhook signé mais rejouable *(à venir)* |
| [Détecter et répondre à la fraude](http://127.0.0.1:5173/#/modules/m10/l07) | [Le piège à miel](#honeytoken)<br>[Les points de détection applicatifs](#appsensor-points)<br>Nommer l’abus qu’on subit *(à venir)* |

</details>

<details>
<summary><strong>M16 · Revue de code sécurité</strong> — 7/7 leçons couvertes</summary>

| Leçon | Challenges |
| --- | --- |
| [Pourquoi et quand relire](http://127.0.0.1:5173/#/modules/m12/l01) | [La carte des sources et des sinks](#attack-surface-map)<br>[Quatre heures, et on rend](#timeboxed-audit) |
| [Méthode sur une base inconnue](http://127.0.0.1:5173/#/modules/m12/l02) | [L’atteignabilité, à la main](#reachability-ast)<br>[La carte des sources et des sinks](#attack-surface-map)<br>[Trouver le sink d’une vraie CVE](#secbench-sink)<br>Chasse aux variantes *(à venir)*<br>La même règle, en mode taint *(à venir)* |
| [Revoir une PR en 10 minutes](http://127.0.0.1:5173/#/modules/m12/l03) | [Mass assignment sur le profil](#mass-assignment)<br>[Le finding à la bonne ligne](#finding-sarif)<br>[Router la revue vers les bonnes personnes](#codeowners-sensitive)<br>[La revue de PR notée sur ses verdicts](#review-pr-verdicts)<br>[Revoir une PR écrite par une IA](#review-ai-pr)<br>[CODEOWNERS qui ne couvre pas la CI](#codeowners-ci)<br>Étape 4 · Revue de PR, règles et tests *(à venir)* |
| [Lire des correctifs de CVE](http://127.0.0.1:5173/#/modules/m12/l04) | [Trouver le sink d’une vraie CVE](#secbench-sink) |
| [Revue orientée autorisation](http://127.0.0.1:5173/#/modules/m12/l05) | [BOLA : la facture du voisin](#bola-invoice)<br>[Contrôle d’accès par préfixe d’URL](#url-prefix-authz)<br>[Le catch qui échoue ouvert](#try-catch-fail-open)<br>[La revue de PR notée sur ses verdicts](#review-pr-verdicts) |
| [Revoir du code généré par IA](http://127.0.0.1:5173/#/modules/m12/l06) | [Le bot de revue qui approuve](#ai-review-bot-approve)<br>[Revoir une PR écrite par une IA](#review-ai-pr)<br>[Évaluer un relecteur IA](#ai-review-eval) |
| [Audit ciblé et limité dans le temps](http://127.0.0.1:5173/#/modules/m12/l07) | [Quatre heures, et on rend](#timeboxed-audit) |

</details>

<details>
<summary><strong>M17 · Tests & analyse de code</strong> — 11/12 leçons couvertes</summary>

| Leçon | Challenges |
| --- | --- |
| [Stratégie de test de sécurité](http://127.0.0.1:5173/#/modules/m13/l01) | [La matrice qui ne ment pas](#traceability-matrix)<br>[Où placer chaque technique](#test-strategy)<br>[Le lint sémantique du schéma](#ecs-lint)<br>[Le lint de règle](#rule-lint)<br>[L’atomique qui valide la règle](#atomic-test) |
| [Tests de sécurité écrits par les devs](http://127.0.0.1:5173/#/modules/m13/l02) | [Former à partir d’un vrai bug](#training-from-bug)<br>[L’effacement qui efface pour de bon](#erasure-test)<br>[La règle qui se tait après le correctif](#rule-silent-after-fix)<br>[Deux fixtures par règle](#rule-fixtures)<br>Le test de régression plutôt que la preuve d’exploitation *(à venir)*<br>Le correctif qu’on peut fusionner *(à venir)*<br>Le test qui prouve qu’un contrôle refuse *(à venir)* |
| [SAST pour JavaScript](http://127.0.0.1:5173/#/modules/m13/l03) | [La règle qui attrape la classe](#eslint-rule) |
| [Écrire ses règles](http://127.0.0.1:5173/#/modules/m13/l04) | [La règle qui attrape la classe](#eslint-rule)<br>Chasse aux variantes *(à venir)*<br>La même règle, en mode taint *(à venir)* |
| [Fuzzing et tests de disponibilité](http://127.0.0.1:5173/#/modules/m13/l05) | [ReDoS sur la référence de facture](#redos)<br>[La boucle sous le radar du quota](#tool-loop-quota)<br>[Consommation illimitée](#unbounded-consumption)<br>[Expansion d’entités sur le même import](#xml-entity-expansion)<br>[GraphQL : introspection et coût](#graphql-introspection)<br>La propriété qui trouve le bug d’argent *(à venir)*<br>Le fuzz qui casse le parseur *(à venir)*<br>Aucun garde-fou de disponibilité *(à venir)* |
| [SCA et SBOM](http://127.0.0.1:5173/#/modules/m13/l06) | [Traduire un VEX d’un dialecte à l’autre](#vex-to-cyclonedx)<br>[Générer le SBOM, et le garder juste](#sbom-generate)<br>[npm install en intégration continue](#npm-ci-lockfile) |
| [DAST et secrets](http://127.0.0.1:5173/#/modules/m13/l07) | [Secret livré dans le bundle](#secret-in-bundle)<br>[Endpoint de diagnostic laissé ouvert](#debug-endpoint)<br>[Jeton de publication dans le dépôt](#npm-token-in-repo)<br>[Le state versionné](#tf-state-committed)<br>[Tout le dépôt dans l’image](#dockerignore)<br>Le DAST sur environnement éphémère *(à venir)*<br>Secrets dans le dépôt *(à venir)* |
| [Données de test](http://127.0.0.1:5173/#/modules/m13/l08) | [Des données de test qui ne viennent pas de la prod](#test-data-generator) |
| [Inspecter du code malveillant](http://127.0.0.1:5173/#/modules/m13/l09) | [Script d’installation malveillant](#malicious-postinstall) |
| [L’IA dans l’analyse de code](http://127.0.0.1:5173/#/modules/m13/l10) | [Évaluer un relecteur IA](#ai-review-eval) |
| [Bâtir la plateforme](http://127.0.0.1:5173/#/modules/m13/l11) | [La porte qui casse le build](#break-build-gate)<br>[Le doublon qui coûte cher](#finding-dedupe) |
| [Tests de limites, de ressources et de fuites](http://127.0.0.1:5173/#/modules/m13/l12) | — |

</details>

<details>
<summary><strong>M18 · Pipeline, supply chain & fournisseurs</strong> — 10/11 leçons couvertes</summary>

| Leçon | Challenges |
| --- | --- |
| [OWASP Top 10 CI/CD](http://127.0.0.1:5173/#/modules/m14/l01) | [Permissions de workflow trop larges](#gha-permissions)<br>[Condition « acteur bot » usurpable](#gha-bot-condition)<br>Étape 7 · Pipeline et supply chain *(à venir)* |
| [Durcir GitHub Actions](http://127.0.0.1:5173/#/modules/m14/l02) | [Le secret de CI dans un titre de PR](#ci-secret-in-pr-title)<br>[Permissions de workflow trop larges](#gha-permissions)<br>[Injection de template dans un run](#gha-injection)<br>[Pwn request sur pull_request_target](#gha-pwn-request)<br>[Actions non épinglées au SHA](#gha-unpinned)<br>[Action typosquattée](#gha-typosquat-action)<br>[Identifiants git publiés dans un artefact](#gha-artipacked)<br>[secrets: inherit vers un workflow réutilisable](#gha-secrets-inherit)<br>[Empoisonnement du cache Actions](#gha-cache-poisoning)<br>[Condition « acteur bot » usurpable](#gha-bot-condition)<br>[Runner self-hosted ouvert aux forks](#gha-self-hosted)<br>[CODEOWNERS qui ne couvre pas la CI](#codeowners-ci)<br>[Trust policy OIDC mal filtrée](#iam-oidc-trust) |
| [Sécuriser l’environnement de dev](http://127.0.0.1:5173/#/modules/m14/l03) | [Script d’installation malveillant](#malicious-postinstall)<br>[Identifiants git publiés dans un artefact](#gha-artipacked)<br>[Runner self-hosted ouvert aux forks](#gha-self-hosted)<br>[Scripts d’installation non neutralisés](#npmrc-ignore-scripts)<br>[Socket Docker monté dans le conteneur](#docker-socket) |
| [Outils du pipeline](http://127.0.0.1:5173/#/modules/m14/l04) | [Injection de template dans un run](#gha-injection)<br>[Script tiers exécuté sans vérification](#gha-curl-bash) |
| [npm : installer et publier](http://127.0.0.1:5173/#/modules/m14/l05) | [Le paquet qui n’existe pas](#package-hallucination)<br>[npm install en intégration continue](#npm-ci-lockfile)<br>[Publication sans provenance](#npm-provenance)<br>[Scripts d’installation non neutralisés](#npmrc-ignore-scripts)<br>[Jeton de publication dans le dépôt](#npm-token-in-repo)<br>[Confusion de dépendances sur le scope interne](#dependency-confusion)<br>[Lockfile détourné](#lockfile-integrity)<br>[Fuite de fichiers dans le paquet publié](#npm-pack-leak)<br>[Image de conteneur trop permissive](#dockerfile) |
| [Choisir un composant](http://127.0.0.1:5173/#/modules/m14/l06) | [Désérialisation de types arbitraires](#deserialization)<br>[Action typosquattée](#gha-typosquat-action)<br>[Confusion de dépendances sur le scope interne](#dependency-confusion)<br>[Lockfile détourné](#lockfile-integrity) |
| [Vérifier qu’un paquet n’est pas vérolé](http://127.0.0.1:5173/#/modules/m14/l07) | — |
| [Cas réels de supply chain](http://127.0.0.1:5173/#/modules/m14/l08) | [Le rug pull](#rug-pull-mcp)<br>[Pwn request sur pull_request_target](#gha-pwn-request)<br>[Script tiers exécuté sans vérification](#gha-curl-bash)<br>[Empoisonnement du cache Actions](#gha-cache-poisoning)<br>[L’artefact ne correspond pas au source](#vendor-build-mismatch) |
| [Fournisseurs et tiers](http://127.0.0.1:5173/#/modules/m14/l09) | [L’empoisonnement de description d’outil](#tool-poisoning-mcp)<br>[secrets: inherit vers un workflow réutilisable](#gha-secrets-inherit)<br>Exigences de sécurité envers un fournisseur *(à venir)* |
| [SLSA, Sigstore et provenance](http://127.0.0.1:5173/#/modules/m14/l10) | [Actions non épinglées au SHA](#gha-unpinned)<br>[Publication sans provenance](#npm-provenance)<br>[Fuite de fichiers dans le paquet publié](#npm-pack-leak)<br>[Provider et module non épinglés](#tf-unpinned-provider)<br>[Image de base non épinglée](#docker-base-pinning)<br>[Publier en sécurité](#signed-artifacts) |
| [Répondre à un incident supply chain](http://127.0.0.1:5173/#/modules/m14/l11) | [L’artefact ne correspond pas au source](#vendor-build-mismatch)<br>Répondre à un incident supply chain *(à venir)* |

</details>

<details>
<summary><strong>M19 · IAM AWS</strong> — 6/6 leçons couvertes</summary>

| Leçon | Challenges |
| --- | --- |
| [Le modèle IAM et la logique d’évaluation](http://127.0.0.1:5173/#/modules/m15/l01) | [Politique en joker](#iam-wildcard)<br>[Le joker sous le mauvais opérateur](#iam-stringequals-wildcard)<br>[Chemin d’escalade par PassRole](#iam-passrole)<br>[Le Deny qui ne refuse rien](#iam-not-action)<br>[L’opérateur qui échoue en ouvert](#iam-forallvalues)<br>[Politique de bucket ouverte](#s3-bucket-policy-public)<br>[Politique de clé trop permissive](#kms-key-policy)<br>[Le périmètre de données](#data-perimeter) |
| [Zéro utilisateur IAM](http://127.0.0.1:5173/#/modules/m15/l02) | [Zéro utilisateur IAM](#iam-no-users) |
| [Workloads Node.js](http://127.0.0.1:5173/#/modules/m15/l03) | [SSRF vers le service de métadonnées](#ssrf-imds)<br>[SSRF par redirection](#ssrf-redirect-bypass)<br>[Rôle de tâche et rôle d’exécution confondus](#ecs-task-vs-execution)<br>[IMDSv1 laissé actif](#imdsv1-terraform) |
| [Escalade et abus](http://127.0.0.1:5173/#/modules/m15/l04) | [Le joker sous le mauvais opérateur](#iam-stringequals-wildcard)<br>[Chemin d’escalade par PassRole](#iam-passrole)<br>[Le rôle qui peut se réécrire](#iam-create-policy-version)<br>[Trust policy OIDC mal filtrée](#iam-oidc-trust)<br>[Le joker d’organisation](#iam-oidc-org-wildcard)<br>[La CI qui peut se fabriquer un admin](#permission-boundary)<br>[Bootstrap CDK par défaut](#cdk-bootstrap) |
| [Moindre privilège en pratique](http://127.0.0.1:5173/#/modules/m15/l05) | [Recertifier les accès](#access-recertification)<br>[Politique en joker](#iam-wildcard)<br>[Zéro utilisateur IAM](#iam-no-users)<br>[Le rôle qui peut se réécrire](#iam-create-policy-version)<br>[Joker IAM dans le code CDK](#cdk-wildcard)<br>[RBAC avec des jokers](#k8s-rbac)<br>Étape 8 · IAM au moindre privilège *(à venir)* |
| [Multi-comptes et data perimeter](http://127.0.0.1:5173/#/modules/m15/l06) | [Le joker d’organisation](#iam-oidc-org-wildcard)<br>[Accès inter-comptes sans ExternalId](#iam-external-id)<br>[Le Deny qui ne refuse rien](#iam-not-action)<br>[L’opérateur qui échoue en ouvert](#iam-forallvalues)<br>[La CI qui peut se fabriquer un admin](#permission-boundary)<br>[Le périmètre de données](#data-perimeter)<br>[Sauvegardes qu’un attaquant peut effacer](#backup-immutable) |

</details>

<details>
<summary><strong>M20 · Infrastructure as Code</strong> — 5/5 leçons couvertes</summary>

| Leçon | Challenges |
| --- | --- |
| [L’IaC comme surface](http://127.0.0.1:5173/#/modules/m16/l01) | [Politique de bucket ouverte](#s3-bucket-policy-public)<br>[Bucket des pièces jointes exposé](#tf-public-bucket)<br>[Groupe de sécurité ouvert](#tf-open-sg)<br>[IMDSv1 laissé actif](#imdsv1-terraform)<br>[Joker IAM dans le code CDK](#cdk-wildcard) |
| [Scanners IaC](http://127.0.0.1:5173/#/modules/m16/l02) | [Bucket des pièces jointes exposé](#tf-public-bucket)<br>[Base de données non durcie](#tf-rds-hardening)<br>[Répartiteur en clair et TLS obsolète](#tf-alb-tls)<br>[Distribution sans WAF ni TLS minimum](#cloudfront-waf) |
| [Policy as code](http://127.0.0.1:5173/#/modules/m16/l03) | [Groupe de sécurité ouvert](#tf-open-sg)<br>[Secret dans le code et dans le state](#tf-state-secret)<br>[Backend non chiffré et non verrouillé](#tf-backend)<br>[Les garde-fous débranchés](#cdk-nag-disabled)<br>[Pod sans contexte de sécurité](#k8s-securitycontext) |
| [State, pipeline et supply chain IaC](http://127.0.0.1:5173/#/modules/m16/l04) | [Secret dans le code et dans le state](#tf-state-secret)<br>[Le state versionné](#tf-state-committed)<br>[Backend non chiffré et non verrouillé](#tf-backend)<br>[Provider et module non épinglés](#tf-unpinned-provider)<br>[Bootstrap CDK par défaut](#cdk-bootstrap) |
| [Dérive et runtime](http://127.0.0.1:5173/#/modules/m16/l05) | [Journalisation d’infrastructure absente](#tf-logging)<br>La dérive entre le code et le réel *(à venir)* |

</details>

<details>
<summary><strong>M21 · Déploiement, exploitation & résilience</strong> — 8/8 leçons couvertes</summary>

| Leçon | Challenges |
| --- | --- |
| [Configuration de production](http://127.0.0.1:5173/#/modules/m17/l01) | [Erreur non gérée et état incohérent](#error-leak)<br>[Endpoint de diagnostic laissé ouvert](#debug-endpoint)<br>Secrets dans le dépôt *(à venir)*<br>En-têtes de sécurité absents *(à venir)*<br>Le secret de repli *(à venir)* |
| [Conteneurs Node.js](http://127.0.0.1:5173/#/modules/m17/l02) | [Image de conteneur trop permissive](#dockerfile)<br>[Image de base non épinglée](#docker-base-pinning)<br>[Tout le dépôt dans l’image](#dockerignore) |
| [Publier en sécurité](http://127.0.0.1:5173/#/modules/m17/l03) | [Publier en sécurité](#signed-artifacts) |
| [Plateformes AWS](http://127.0.0.1:5173/#/modules/m17/l04) | [Cache deception sur le PDF de facture](#cache-deception-pdf)<br>[Rôle de tâche et rôle d’exécution confondus](#ecs-task-vs-execution)<br>[Répartiteur en clair et TLS obsolète](#tf-alb-tls)<br>[Distribution sans WAF ni TLS minimum](#cloudfront-waf)<br>[Pod sans contexte de sécurité](#k8s-securitycontext)<br>[RBAC avec des jokers](#k8s-rbac)<br>[Socket Docker monté dans le conteneur](#docker-socket) |
| [En-têtes en production](http://127.0.0.1:5173/#/modules/m17/l05) | [Réponse authentifiée mise en cache](#vary-missing)<br>[CORS : origine reflétée avec identifiants](#cors-origin-reflection)<br>[Validation de paiement encadrable](#clickjacking)<br>Page de paiement sans CSP *(à venir)*<br>En-têtes de sécurité absents *(à venir)*<br>La CSP qui ne protège de rien *(à venir)* |
| [Résilience et continuité](http://127.0.0.1:5173/#/modules/m17/l06) | [Base de données non durcie](#tf-rds-hardening)<br>[Sauvegardes qu’un attaquant peut effacer](#backup-immutable)<br>Aucun garde-fou de disponibilité *(à venir)* |
| [Fin de vie](http://127.0.0.1:5173/#/modules/m17/l07) | Éteindre un service proprement *(à venir)* |
| [Protection à l’exécution](http://127.0.0.1:5173/#/modules/m17/l08) | Clé de signature unique et éternelle *(à venir)*<br>La dérive entre le code et le réel *(à venir)* |

</details>

<details>
<summary><strong>M22 · SOC et renseignement sur la menace</strong> — 0/4 leçons couvertes</summary>

| Leçon | Challenges |
| --- | --- |
| [Ce que fait un SOC](http://127.0.0.1:5173/#/modules/m27/l01) | — |
| [Ce que le SOC attend de l’application](http://127.0.0.1:5173/#/modules/m27/l02) | — |
| [Le renseignement utile à l’AppSec](http://127.0.0.1:5173/#/modules/m27/l03) | — |
| [Chasser dans les journaux](http://127.0.0.1:5173/#/modules/m27/l04) | — |

</details>

<details>
<summary><strong>M23 · Journalisation & SIEM (Elastic)</strong> — 3/4 leçons couvertes</summary>

| Leçon | Challenges |
| --- | --- |
| [Journaliser pour la sécurité](http://127.0.0.1:5173/#/modules/m18/l01) | [Jeton d’accès passé dans l’URL](#token-in-url)<br>[Authentifier, autoriser, journaliser](#gold-standard-audit)<br>[Le vocabulaire imposé](#logging-vocabulary)<br>[Ce qu’il ne faut jamais journaliser](#never-log)<br>[Les champs qui manquent à la corrélation](#ecs-fields)<br>[L’inventaire de journalisation](#logging-inventory)<br>Le journal infalsifiable *(à venir)* |
| [Architecture de journalisation](http://127.0.0.1:5173/#/modules/m18/l02) | — |
| [Ingestion dans Elastic](http://127.0.0.1:5173/#/modules/m18/l03) | [Journalisation d’infrastructure absente](#tf-logging)<br>[Les champs qui manquent à la corrélation](#ecs-fields)<br>[Le lint sémantique du schéma](#ecs-lint) |
| [KQL, EQL et ES|QL](http://127.0.0.1:5173/#/modules/m18/l04) | [Écrire la règle : bourrage d’identifiants](#rule-credential-stuffing)<br>[La corrélation temporelle](#rule-temporal-spray) |

</details>

<details>
<summary><strong>M24 · Detection engineering</strong> — 3/6 leçons couvertes</summary>

| Leçon | Challenges |
| --- | --- |
| [Le cycle de vie d’une détection](http://127.0.0.1:5173/#/modules/m28/l01) | — |
| [Couverture ATT&CK](http://127.0.0.1:5173/#/modules/m28/l02) | — |
| [Règles, Sigma et detection-as-code](http://127.0.0.1:5173/#/modules/m28/l03) | [Du CWE à la technique ATT&CK](#cwe-capec-attack)<br>[Écrire la règle : bourrage d’identifiants](#rule-credential-stuffing)<br>[Régler le seuil](#rule-threshold)<br>[Deux fixtures par règle](#rule-fixtures)<br>[Le lint de règle](#rule-lint)<br>[L’atomique qui valide la règle](#atomic-test)<br>[La fiche de stratégie de détection](#ads-documentation)<br>[La couverture qui se prouve](#detection-coverage)<br>Étape 10 · Cinq détections testées *(à venir)* |
| [Tester ses détections](http://127.0.0.1:5173/#/modules/m28/l04) | — |
| [Détections applicatives](http://127.0.0.1:5173/#/modules/m28/l05) | [Exfiltrer sans se faire remarquer](#stealth-attack)<br>[Le piège à miel](#honeytoken)<br>[Détecter l’injection indirecte](#detect-prompt-injection)<br>[Les points de détection applicatifs](#appsensor-points)<br>[La réponse graduée](#graduated-response)<br>Surveiller ce que la page charge *(à venir)* |
| [Maturité et réponse à incident](http://127.0.0.1:5173/#/modules/m28/l06) | [Régler le seuil](#rule-threshold)<br>[La règle qui se tait après le correctif](#rule-silent-after-fix)<br>[La fiche de stratégie de détection](#ads-documentation)<br>[La chronologie de l’incident](#incident-timeline) |

</details>

<details>
<summary><strong>M25 · Réponse à incident</strong> — 0/6 leçons couvertes</summary>

| Leçon | Challenges |
| --- | --- |
| [Le cadre de la réponse à incident](http://127.0.0.1:5173/#/modules/m29/l01) | — |
| [Playbooks et runbooks applicatifs](http://127.0.0.1:5173/#/modules/m29/l02) | — |
| [Répondre dans AWS](http://127.0.0.1:5173/#/modules/m29/l03) | — |
| [Crise et communication](http://127.0.0.1:5173/#/modules/m29/l04) | — |
| [Notifier dans les délais](http://127.0.0.1:5173/#/modules/m29/l05) | — |
| [Exercices et post-mortem](http://127.0.0.1:5173/#/modules/m29/l06) | — |

</details>

<details>
<summary><strong>M26 · Gestion des vulnérabilités</strong> — 7/7 leçons couvertes</summary>

| Leçon | Challenges |
| --- | --- |
| [Cycle de vie d’une vulnérabilité](http://127.0.0.1:5173/#/modules/m05/l01) | [Le doublon qui coûte cher](#finding-dedupe)<br>[L’arbre SSVC, appliqué](#ssvc-decision)<br>Cartographier les défauts du lab *(à venir)* |
| [CVSS 4.0](http://127.0.0.1:5173/#/modules/m05/l02) | [Le triage qui va chercher la donnée](#triage-kev-epss)<br>Le vecteur CVSS 4.0 qui se recalcule *(à venir)* |
| [Prioriser par le risque](http://127.0.0.1:5173/#/modules/m05/l03) | [L’exception qui expire](#risk-exception)<br>[Le triage qui va chercher la donnée](#triage-kev-epss)<br>[L’arbre SSVC, appliqué](#ssvc-decision)<br>[Le VEX qui dit non, et le prouve](#vex-not-affected)<br>[L’atteignabilité, à la main](#reachability-ast)<br>[Le constat qui agrège tout](#findings-aggregate)<br>Chaîne de vulnérabilités *(à venir)*<br>Le vecteur CVSS 4.0 qui se recalcule *(à venir)* |
| [Faut-il un exploit pour faire corriger ?](http://127.0.0.1:5173/#/modules/m05/l04) | Le test de régression plutôt que la preuve d’exploitation *(à venir)* |
| [Outillage, SLA et dépendances npm](http://127.0.0.1:5173/#/modules/m05/l05) | [Le VEX qui dit non, et le prouve](#vex-not-affected)<br>[Traduire un VEX d’un dialecte à l’autre](#vex-to-cyclonedx)<br>[Le SLA qui se mesure](#sla-policy)<br>[Le constat qui agrège tout](#findings-aggregate)<br>[Générer le SBOM, et le garder juste](#sbom-generate) |
| [Divulgation, bug bounty et CRA](http://127.0.0.1:5173/#/modules/m05/l06) | [Le signalement CRA, en test](#cra-notification)<br>[Publier sa politique de divulgation](#disclosure-policy) |
| [Gérer une critique à J+0](http://127.0.0.1:5173/#/modules/m05/l07) | [La chronologie de l’incident](#incident-timeline)<br>Répondre à un incident supply chain *(à venir)* |

</details>

<details>
<summary><strong>M27 · Sécurité des applications LLM</strong> — 7/7 leçons couvertes</summary>

| Leçon | Challenges |
| --- | --- |
| [OWASP LLM Top 10 2026](http://127.0.0.1:5173/#/modules/m19/l01) | [L’outil de débogage branché sur l’assistant](#excessive-agency-tool)<br>[Combien de documents pour retourner une réponse](#poisoned-rag)<br>[La citation qui ment](#citation-laundering)<br>[Le canari du prompt système](#system-prompt-canary)<br>[La boucle sous le radar du quota](#tool-loop-quota)<br>[Consommation illimitée](#unbounded-consumption)<br>Le profil de la session *(à venir)* |
| [Prompt injection et règle de deux](http://127.0.0.1:5173/#/modules/m19/l02) | [Injection indirecte dans « Ask Novafact »](#prompt-injection)<br>[La fausse observation](#synthetic-observation)<br>[L’action qui porte l’identité de la victime](#indirect-victim-session)<br>[La mémoire à effet différé](#memory-poisoning) |
| [Patterns de conception pour agents](http://127.0.0.1:5173/#/modules/m19/l03) | [Injection indirecte dans « Ask Novafact »](#prompt-injection)<br>[L’outil « sûr » comme canal](#dns-exfil-tool)<br>[La défense cassée par son propre délimiteur](#spotlighting-bypass)<br>[L’approbation humaine trompée](#human-approval-spoof)<br>Le profil de la session *(à venir)* |
| [Applications JS avec LLM](http://127.0.0.1:5173/#/modules/m19/l04) | [L’action qui porte l’identité de la victime](#indirect-victim-session)<br>[L’image qui part toute seule](#markdown-image-exfil)<br>[Le filtre de liens et la forme référence](#reference-link-bypass)<br>[Combien de documents pour retourner une réponse](#poisoned-rag)<br>[RAG sans contrôle d’accès](#rag-acl)<br>[L’index survit à la suppression](#index-after-deletion)<br>[La citation qui ment](#citation-laundering)<br>[La fuite d’une session à l’autre](#cross-session-leak)<br>[Sortie du modèle rendue en HTML](#llm-markdown-xss)<br>[SSRF par un outil de l’agent](#llm-tool-ssrf) |
| [MITRE ATLAS et OWASP AI Exchange](http://127.0.0.1:5173/#/modules/m19/l05) | Cartographier avec ATLAS *(à venir)* |
| [Red teaming des LLM](http://127.0.0.1:5173/#/modules/m19/l06) | [Le filtre de liens et la forme référence](#reference-link-bypass)<br>[La défense cassée par son propre délimiteur](#spotlighting-bypass)<br>[Le canari du prompt système](#system-prompt-canary)<br>[Le décodeur obéissant](#encoded-bypass)<br>[Exfiltrer sans se faire remarquer](#stealth-attack) |
| [L’IA dans le SDLC](http://127.0.0.1:5173/#/modules/m19/l07) | [Le paquet qui n’existe pas](#package-hallucination)<br>[Le bot de revue qui approuve](#ai-review-bot-approve)<br>[Le secret de CI dans un titre de PR](#ci-secret-in-pr-title) |

</details>

<details>
<summary><strong>M28 · Agents & MCP</strong> — 1/7 leçons couvertes</summary>

| Leçon | Challenges |
| --- | --- |
| [Agents et MCP : vue d’ensemble](http://127.0.0.1:5173/#/modules/m30/l01) | [La fausse observation](#synthetic-observation)<br>[L’outil de débogage branché sur l’assistant](#excessive-agency-tool)<br>[L’outil « sûr » comme canal](#dns-exfil-tool)<br>[Le produit lui-même comme canal](#product-as-channel)<br>[L’empoisonnement de description d’outil](#tool-poisoning-mcp)<br>[Le rug pull](#rug-pull-mcp)<br>[Le tool shadowing](#tool-shadowing)<br>[Nuire avant le premier appel](#line-jumping)<br>[La mémoire à effet différé](#memory-poisoning)<br>[L’approbation humaine trompée](#human-approval-spoof)<br>[SSRF par un outil de l’agent](#llm-tool-ssrf)<br>[Modéliser l’agent, la chaîne et le poste](#tm-ai-supply-dev)<br>[Détecter l’injection indirecte](#detect-prompt-injection) |
| [Anatomie de MCP](http://127.0.0.1:5173/#/modules/m30/l02) | — |
| [Ce que le modèle lit, l’attaquant l’écrit](http://127.0.0.1:5173/#/modules/m30/l03) | — |
| [Écrire un serveur MCP local sûr](http://127.0.0.1:5173/#/modules/m30/l04) | — |
| [Serveur MCP distant et multi-tenant](http://127.0.0.1:5173/#/modules/m30/l05) | — |
| [La supply chain MCP](http://127.0.0.1:5173/#/modules/m30/l06) | — |
| [Gouverner MCP dans l’entreprise](http://127.0.0.1:5173/#/modules/m30/l07) | — |

</details>

<details>
<summary><strong>M29 · MCP & OAuth</strong> — 0/9 leçons couvertes</summary>

| Leçon | Challenges |
| --- | --- |
| [Comment MCP a adopté OAuth](http://127.0.0.1:5173/#/modules/m31/l01) | — |
| [Découverte : PRM et métadonnées](http://127.0.0.1:5173/#/modules/m31/l02) | — |
| [Enregistrer le client](http://127.0.0.1:5173/#/modules/m31/l03) | — |
| [Le flux et ses vérifications](http://127.0.0.1:5173/#/modules/m31/l04) | — |
| [Audience, passthrough et API en aval](http://127.0.0.1:5173/#/modules/m31/l05) | — |
| [Le confused deputy des proxys MCP](http://127.0.0.1:5173/#/modules/m31/l06) | — |
| [Scopes minimaux et step-up](http://127.0.0.1:5173/#/modules/m31/l07) | — |
| [MCP en entreprise](http://127.0.0.1:5173/#/modules/m31/l08) | — |
| [Implémenter en Express](http://127.0.0.1:5173/#/modules/m31/l09) | — |

</details>

<details>
<summary><strong>M30 · Faire adopter la sécurité</strong> — 4/6 leçons couvertes</summary>

| Leçon | Challenges |
| --- | --- |
| [Écrire un finding qui sera corrigé](http://127.0.0.1:5173/#/modules/m06/l01) | [Du finding au backlog](#pentest-to-appsec)<br>[Le finding à la bonne ligne](#finding-sarif)<br>Le correctif qu’on peut fusionner *(à venir)*<br>Le test qui prouve qu’un contrôle refuse *(à venir)* |
| [Négocier avec le produit](http://127.0.0.1:5173/#/modules/m06/l02) | — |
| [Parler aux dirigeants](http://127.0.0.1:5173/#/modules/m06/l03) | — |
| [Former au code sécurisé](http://127.0.0.1:5173/#/modules/m06/l04) | [Former à partir d’un vrai bug](#training-from-bug) |
| [Le paved road comme produit](http://127.0.0.1:5173/#/modules/m06/l05) | [Le gabarit de route qui naît sûr](#paved-road-template)<br>Étape 12 · Adoption et restitution *(à venir)* |
| [Piloter la sécurité offensive](http://127.0.0.1:5173/#/modules/m06/l06) | [Publier sa politique de divulgation](#disclosure-policy)<br>[Cadrer un test d’intrusion](#pentest-scope) |

</details>

<details>
<summary><strong>M31 · Le programme AppSec</strong> — 3/5 leçons couvertes</summary>

| Leçon | Challenges |
| --- | --- |
| [Du parcours au programme](http://127.0.0.1:5173/#/modules/m32/l01) | — |
| [Gouvernance : politiques, standards et comités](http://127.0.0.1:5173/#/modules/m32/l02) | — |
| [Jalons, portes et exceptions](http://127.0.0.1:5173/#/modules/m32/l03) | [La porte qui casse le build](#break-build-gate)<br>[L’exception qui expire](#risk-exception)<br>[Le modèle qui bloque la PR](#tm-drift-ci)<br>[Où placer chaque technique](#test-strategy)<br>[Les garde-fous débranchés](#cdk-nag-disabled)<br>Le DAST sur environnement éphémère *(à venir)* |
| [Mesurer un programme](http://127.0.0.1:5173/#/modules/m32/l04) | [Évaluation SAMM qui se calcule](#samm-assessment)<br>[Le SLA qui se mesure](#sla-policy) |
| [Cyber Resilience Act et roadmap](http://127.0.0.1:5173/#/modules/m32/l05) | [La feuille de route dérivée de l’écart](#samm-roadmap)<br>[Attestation SSDF adossée au dépôt](#ssdf-attestation)<br>[Le signalement CRA, en test](#cra-notification) |

</details>

<details>
<summary><strong>M32 · Capstone : revue de sécurité de Novafact</strong> — 12/15 leçons couvertes</summary>

| Leçon | Challenges |
| --- | --- |
| [Analyse de risques](http://127.0.0.1:5173/#/modules/m20/l01) | — |
| [Threat model](http://127.0.0.1:5173/#/modules/m20/l02) | Étape 3 · Threat model *(à venir)* |
| [Exigences et traçabilité](http://127.0.0.1:5173/#/modules/m20/l03) | Étape 1 · Exigences et traçabilité *(à venir)* |
| [Design doc et revue de conception](http://127.0.0.1:5173/#/modules/m20/l04) | Étape 2 · Design doc et revue de conception *(à venir)* |
| [Contrôles anti-abus](http://127.0.0.1:5173/#/modules/m20/l05) | Étape 6 · Contrôles anti-abus *(à venir)* |
| [Revue de PR, règles et tests](http://127.0.0.1:5173/#/modules/m20/l06) | Étape 4 · Revue de PR, règles et tests *(à venir)* |
| [Vulnérabilités avancées](http://127.0.0.1:5173/#/modules/m20/l07) | Étape 9 · Vulnérabilités avancées *(à venir)* |
| [Page de paiement](http://127.0.0.1:5173/#/modules/m20/l08) | Étape 5 · Page de paiement *(à venir)* |
| [Pipeline et supply chain](http://127.0.0.1:5173/#/modules/m20/l09) | Étape 7 · Pipeline et supply chain *(à venir)* |
| [IAM au moindre privilège](http://127.0.0.1:5173/#/modules/m20/l10) | Étape 8 · IAM au moindre privilège *(à venir)* |
| [Cinq détections Elastic](http://127.0.0.1:5173/#/modules/m20/l11) | Étape 10 · Cinq détections testées *(à venir)* |
| [Exercice de crise](http://127.0.0.1:5173/#/modules/m20/l12) | — |
| [Le serveur MCP d’Ask Novafact](http://127.0.0.1:5173/#/modules/m20/l13) | — |
| [Roadmap SAMM à 12 mois](http://127.0.0.1:5173/#/modules/m20/l14) | Étape 11 · Roadmap à 12 mois *(à venir)* |
| [Plan d’adoption et restitution](http://127.0.0.1:5173/#/modules/m20/l15) | Étape 12 · Adoption et restitution *(à venir)* |

</details>

## Ce que le lab ne couvre pas, et pourquoi

Ces leçons n’ont aucun challenge, et c’est délibéré. Une seule des raisons est technique.

| Leçon | Raison |
| --- | --- |
| **M1** · [La cybersécurité en un coup d’œil](http://127.0.0.1:5173/#/modules/m21/l01) | Sujet de jugement ou d’animation : traité par les jeux du site. |
| **M1** · [Qui attaque, et pourquoi](http://127.0.0.1:5173/#/modules/m21/l02) | Sujet de jugement ou d’animation : traité par les jeux du site. |
| **M1** · [Le panorama 2025-2026 en chiffres](http://127.0.0.1:5173/#/modules/m21/l03) | Sujet de jugement ou d’animation : traité par les jeux du site. |
| **M1** · [Les portes d’entrée qui passent par l’application](http://127.0.0.1:5173/#/modules/m21/l04) | Sujet de jugement ou d’animation : traité par les jeux du site. |
| **M1** · [Les affaires qui ont façonné le métier](http://127.0.0.1:5173/#/modules/m21/l05) | Sujet de jugement ou d’animation : traité par les jeux du site. |
| **M1** · [Pourquoi le logiciel reste vulnérable](http://127.0.0.1:5173/#/modules/m21/l06) | Sujet de jugement ou d’animation : traité par les jeux du site. |
| **M2** · [ATT&CK : histoire et logique](http://127.0.0.1:5173/#/modules/m22/l01) | Sujet de jugement ou d’animation : traité par les jeux du site. |
| **M2** · [Les quatre usages d’ATT&CK](http://127.0.0.1:5173/#/modules/m22/l02) | Sujet de jugement ou d’animation : traité par les jeux du site. |
| **M2** · [La menace SaaS et identité](http://127.0.0.1:5173/#/modules/m22/l03) | Sujet de jugement ou d’animation : traité par les jeux du site. |
| **M2** · [Se protéger : les mitigations qui comptent](http://127.0.0.1:5173/#/modules/m22/l04) | Sujet de jugement ou d’animation : traité par les jeux du site. |
| **M2** · [Cas réels décortiqués](http://127.0.0.1:5173/#/modules/m22/l05) | Sujet de jugement ou d’animation : traité par les jeux du site. |
| **M2** · [Du TTP à la classe de bug](http://127.0.0.1:5173/#/modules/m22/l06) | Sujet de jugement ou d’animation : traité par les jeux du site. |
| **M3** · [Le SSDLC et la carte du parcours](http://127.0.0.1:5173/#/modules/m01/l04) | Sujet de jugement ou d’animation : traité par les jeux du site. |
| **M4** · [Panorama des rôles](http://127.0.0.1:5173/#/modules/m23/l02) | Sujet de jugement ou d’animation : traité par les jeux du site. |
| **M4** · [Organiser l’équipe](http://127.0.0.1:5173/#/modules/m23/l03) | Sujet de jugement ou d’animation : traité par les jeux du site. |
| **M4** · [Travailler avec les autres fonctions](http://127.0.0.1:5173/#/modules/m23/l05) | Sujet de jugement ou d’animation : traité par les jeux du site. |
| **M4** · [Le cadre juridique du métier](http://127.0.0.1:5173/#/modules/m23/l06) | Sujet de jugement ou d’animation : traité par les jeux du site. |
| **M4** · [Compétences, certifications et carrière](http://127.0.0.1:5173/#/modules/m23/l07) | Sujet de jugement ou d’animation : traité par les jeux du site. |
| **M5** · [Maturité ou posture ?](http://127.0.0.1:5173/#/modules/m24/l01) | Sujet de jugement ou d’animation : traité par les jeux du site. |
| **M5** · [Les autres modèles](http://127.0.0.1:5173/#/modules/m24/l04) | Sujet de jugement ou d’animation : traité par les jeux du site. |
| **M5** · [Mesurer la posture applicative](http://127.0.0.1:5173/#/modules/m24/l05) | Sujet de jugement ou d’animation : traité par les jeux du site. |
| **M5** · [Un état des lieux en deux semaines](http://127.0.0.1:5173/#/modules/m24/l06) | Sujet de jugement ou d’animation : traité par les jeux du site. |
| **M6** · [De l’URL au pixel](http://127.0.0.1:5173/#/modules/m25/l01) | Sujet de jugement ou d’animation : traité par les jeux du site. |
| **M6** · [HTTP de bout en bout](http://127.0.0.1:5173/#/modules/m25/l02) | Sujet de jugement ou d’animation : traité par les jeux du site. |
| **M6** · [URL, origine, site et DNS](http://127.0.0.1:5173/#/modules/m25/l03) | Sujet de jugement ou d’animation : traité par les jeux du site. |
| **M6** · [TLS et certificats en pratique](http://127.0.0.1:5173/#/modules/m25/l04) | Sujet de jugement ou d’animation : traité par les jeux du site. |
| **M6** · [Le modèle de sécurité du navigateur](http://127.0.0.1:5173/#/modules/m25/l05) | Sujet de jugement ou d’animation : traité par les jeux du site. |
| **M6** · [Cookies et état](http://127.0.0.1:5173/#/modules/m25/l06) | Sujet de jugement ou d’animation : traité par les jeux du site. |
| **M6** · [La carte des en-têtes de sécurité](http://127.0.0.1:5173/#/modules/m25/l07) | Sujet de jugement ou d’animation : traité par les jeux du site. |
| **M7** · [XML, DTD et XXE](http://127.0.0.1:5173/#/modules/m02/l05) | Sujet de jugement ou d’animation : traité par les jeux du site. |
| **M7** · [HTML côté serveur, XSS et jetons CSRF](http://127.0.0.1:5173/#/modules/m02/l06) | Sujet de jugement ou d’animation : traité par les jeux du site. |
| **M7** · [Fichiers : upload, téléchargement et chemins](http://127.0.0.1:5173/#/modules/m02/l07) | Les Server Actions et les composants serveur n’existent pas sur un socle Express + Vite. Simuler leurs CVE enseignerait une fiction. |
| **M7** · [Next.js, RSC et Server Actions](http://127.0.0.1:5173/#/modules/m02/l08) | Sujet de jugement ou d’animation : traité par les jeux du site. |
| **M9** · [Request smuggling et désynchronisation](http://127.0.0.1:5173/#/modules/m03/l05) | Le request smuggling demande une vraie chaîne de proxys dont les analyseurs HTTP divergent. Le simuler en local donnerait une fausse intuition du mécanisme. |
| **M10** · [Le vocabulaire du risque](http://127.0.0.1:5173/#/modules/m26/l01) | Sujet de jugement ou d’animation : traité par les jeux du site. |
| **M10** · [EBIOS Risk Manager appliqué à Novafact](http://127.0.0.1:5173/#/modules/m26/l02) | Sujet de jugement ou d’animation : traité par les jeux du site. |
| **M10** · [Noter sans se mentir](http://127.0.0.1:5173/#/modules/m26/l03) | Sujet de jugement ou d’animation : traité par les jeux du site. |
| **M10** · [Quantifier avec FAIR](http://127.0.0.1:5173/#/modules/m26/l04) | Sujet de jugement ou d’animation : traité par les jeux du site. |
| **M10** · [Traiter le risque et tenir le registre](http://127.0.0.1:5173/#/modules/m26/l05) | Sujet de jugement ou d’animation : traité par les jeux du site. |
| **M13** · [La spécification fonctionnelle de sécurité](http://127.0.0.1:5173/#/modules/m08/l01) | Sujet de jugement ou d’animation : traité par les jeux du site. |
| **M13** · [Architectures multi-tenant : silo, pool, bridge](http://127.0.0.1:5173/#/modules/m08/l06) | Sujet de jugement ou d’animation : traité par les jeux du site. |
| **M13** · [Crypto : hash, nonces et métadonnées](http://127.0.0.1:5173/#/modules/m08/l09) | Sujet de jugement ou d’animation : traité par les jeux du site. |
| **M17** · [Tests de limites, de ressources et de fuites](http://127.0.0.1:5173/#/modules/m13/l12) | Sujet de jugement ou d’animation : traité par les jeux du site. |
| **M18** · [Vérifier qu’un paquet n’est pas vérolé](http://127.0.0.1:5173/#/modules/m14/l07) | Sujet de jugement ou d’animation : traité par les jeux du site. |
| **M22** · [Ce que fait un SOC](http://127.0.0.1:5173/#/modules/m27/l01) | Sujet de jugement ou d’animation : traité par les jeux du site. |
| **M22** · [Ce que le SOC attend de l’application](http://127.0.0.1:5173/#/modules/m27/l02) | Sujet de jugement ou d’animation : traité par les jeux du site. |
| **M22** · [Le renseignement utile à l’AppSec](http://127.0.0.1:5173/#/modules/m27/l03) | Sujet de jugement ou d’animation : traité par les jeux du site. |
| **M22** · [Chasser dans les journaux](http://127.0.0.1:5173/#/modules/m27/l04) | Sujet de jugement ou d’animation : traité par les jeux du site. |
| **M23** · [Architecture de journalisation](http://127.0.0.1:5173/#/modules/m18/l02) | Sujet de jugement ou d’animation : traité par les jeux du site. |
| **M24** · [Le cycle de vie d’une détection](http://127.0.0.1:5173/#/modules/m28/l01) | Sujet de jugement ou d’animation : traité par les jeux du site. |
| **M24** · [Couverture ATT&CK](http://127.0.0.1:5173/#/modules/m28/l02) | Sujet de jugement ou d’animation : traité par les jeux du site. |
| **M24** · [Tester ses détections](http://127.0.0.1:5173/#/modules/m28/l04) | Sujet de jugement ou d’animation : traité par les jeux du site. |
| **M25** · [Le cadre de la réponse à incident](http://127.0.0.1:5173/#/modules/m29/l01) | Sujet de jugement ou d’animation : traité par les jeux du site. |
| **M25** · [Playbooks et runbooks applicatifs](http://127.0.0.1:5173/#/modules/m29/l02) | Sujet de jugement ou d’animation : traité par les jeux du site. |
| **M25** · [Répondre dans AWS](http://127.0.0.1:5173/#/modules/m29/l03) | Sujet de jugement ou d’animation : traité par les jeux du site. |
| **M25** · [Crise et communication](http://127.0.0.1:5173/#/modules/m29/l04) | Sujet de jugement ou d’animation : traité par les jeux du site. |
| **M25** · [Notifier dans les délais](http://127.0.0.1:5173/#/modules/m29/l05) | Sujet de jugement ou d’animation : traité par les jeux du site. |
| **M25** · [Exercices et post-mortem](http://127.0.0.1:5173/#/modules/m29/l06) | Sujet de jugement ou d’animation : traité par les jeux du site. |
| **M28** · [Anatomie de MCP](http://127.0.0.1:5173/#/modules/m30/l02) | Sujet de jugement ou d’animation : traité par les jeux du site. |
| **M28** · [Ce que le modèle lit, l’attaquant l’écrit](http://127.0.0.1:5173/#/modules/m30/l03) | Sujet de jugement ou d’animation : traité par les jeux du site. |
| **M28** · [Écrire un serveur MCP local sûr](http://127.0.0.1:5173/#/modules/m30/l04) | Sujet de jugement ou d’animation : traité par les jeux du site. |
| **M28** · [Serveur MCP distant et multi-tenant](http://127.0.0.1:5173/#/modules/m30/l05) | Sujet de jugement ou d’animation : traité par les jeux du site. |
| **M28** · [La supply chain MCP](http://127.0.0.1:5173/#/modules/m30/l06) | Sujet de jugement ou d’animation : traité par les jeux du site. |
| **M28** · [Gouverner MCP dans l’entreprise](http://127.0.0.1:5173/#/modules/m30/l07) | Sujet de jugement ou d’animation : traité par les jeux du site. |
| **M29** · [Comment MCP a adopté OAuth](http://127.0.0.1:5173/#/modules/m31/l01) | Sujet de jugement ou d’animation : traité par les jeux du site. |
| **M29** · [Découverte : PRM et métadonnées](http://127.0.0.1:5173/#/modules/m31/l02) | Sujet de jugement ou d’animation : traité par les jeux du site. |
| **M29** · [Enregistrer le client](http://127.0.0.1:5173/#/modules/m31/l03) | Sujet de jugement ou d’animation : traité par les jeux du site. |
| **M29** · [Le flux et ses vérifications](http://127.0.0.1:5173/#/modules/m31/l04) | Sujet de jugement ou d’animation : traité par les jeux du site. |
| **M29** · [Audience, passthrough et API en aval](http://127.0.0.1:5173/#/modules/m31/l05) | Sujet de jugement ou d’animation : traité par les jeux du site. |
| **M29** · [Le confused deputy des proxys MCP](http://127.0.0.1:5173/#/modules/m31/l06) | Sujet de jugement ou d’animation : traité par les jeux du site. |
| **M29** · [Scopes minimaux et step-up](http://127.0.0.1:5173/#/modules/m31/l07) | Sujet de jugement ou d’animation : traité par les jeux du site. |
| **M29** · [MCP en entreprise](http://127.0.0.1:5173/#/modules/m31/l08) | Sujet de jugement ou d’animation : traité par les jeux du site. |
| **M29** · [Implémenter en Express](http://127.0.0.1:5173/#/modules/m31/l09) | Sujet de jugement ou d’animation : traité par les jeux du site. |
| **M30** · [Négocier avec le produit](http://127.0.0.1:5173/#/modules/m06/l02) | Sujet de jugement ou d’animation : traité par les jeux du site. |
| **M30** · [Parler aux dirigeants](http://127.0.0.1:5173/#/modules/m06/l03) | Négocier avec une équipe produit se juge sur l’issue d’un échange humain. Le jeu Pushback du site le travaille déjà. |
| **M31** · [Du parcours au programme](http://127.0.0.1:5173/#/modules/m32/l01) | Sujet de jugement ou d’animation : traité par les jeux du site. |
| **M31** · [Gouvernance : politiques, standards et comités](http://127.0.0.1:5173/#/modules/m32/l02) | Sujet de jugement ou d’animation : traité par les jeux du site. |
| **M32** · [Analyse de risques](http://127.0.0.1:5173/#/modules/m20/l01) | Sujet de jugement ou d’animation : traité par les jeux du site. |
| **M32** · [Exercice de crise](http://127.0.0.1:5173/#/modules/m20/l12) | Sujet de jugement ou d’animation : traité par les jeux du site. |
| **M32** · [Le serveur MCP d’Ask Novafact](http://127.0.0.1:5173/#/modules/m20/l13) | Sujet de jugement ou d’animation : traité par les jeux du site. |

Plus généralement : **les scénarios cloud exécutés** restent chez CloudGoat, TerraGoat et Stratus Red Team. Le
lab n’en prend que la partie qui vit dans le dépôt — politiques IAM, Terraform, Dockerfile, workflows — parce
que c’est là que le défaut est introduit et que le correctif se relit.

Tous ces labs sont listés dans la page [Labs](http://127.0.0.1:5173/#/labs) du site.

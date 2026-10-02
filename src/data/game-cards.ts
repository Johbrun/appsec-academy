// Cartes de révision espacée, rangées en paquets.
//
// Une carte appartient à un module ; un paquet regroupe les modules d'un même
// bloc du parcours. La progression Leitner est indexée par l'identifiant de
// carte (`m02-c7`) : un identifiant ne change jamais, même si le texte évolue,
// sinon la boîte de la carte est perdue. Les nouvelles cartes prennent le
// numéro suivant dans leur module.
//
// Le niveau ne dit pas si le sujet est pointu : il dit quel **geste de
// mémoire** la carte demande. Une carte sur SLSA peut être un N1 si elle ne
// demande qu'une définition ; une carte sur la validation côté client peut être
// un N3 si elle demande pourquoi l'évidence échoue.
//
//   N1 · Rappel direct. La question nomme la notion, la réponse est une
//        définition, une liste, une date. Un seul fait à retrouver.
//
//   N2 · Discrimination ou application. Deux notions voisines à séparer
//        (« X contre Y »), ou une notion à appliquer à un cas précis. Connaître
//        chaque définition ne suffit pas : il faut savoir où passe la frontière.
//
//   N3 · Arbitrage ou piège. La question avance un contrôle plausible — celui
//        qu'on mettrait spontanément — et demande pourquoi il ne suffit pas, ou
//        oblige à trancher entre deux bonnes pratiques. La réponse nomme le
//        mécanisme qui fait échouer l'évidence.
//
// Les paquets sont thématiques (un bloc du parcours) ; deux paquets transverses
// piochent dans tout le pool, l'un au niveau 1, l'autre au niveau 3. La
// « Révision du jour », elle, dépend de la progression du joueur : elle est
// composée dans le composant, pas ici.

import type { Level } from './catalog';
import { defineSeries, type Leveled, type SeriesProfile } from '../lib/series';

export interface Card extends Leveled {
  module: string;
  front: string;
  back: string;
}

const c = (module: string, n: number, level: Level, front: string, back: string, avoid?: string[]): Card =>
  ({ id: `${module}-c${n}`, module, level, front, back, ...(avoid ? { avoid } : {}) });

export const cards: Card[] = [
  // ── m01 · Programme AppSec ────────────────────────────────────────────────
  c('m01', 1, 1, 'Quelles sont les quatre questions à poser face à chaque finding ?', 'Cause racine, variantes, contrôle de classe, détection.'),
  c('m01', 2, 2, 'OWASP Top 10, ASVS, SAMM, BSIMM : à quoi sert chacun ?', 'Top 10 pour sensibiliser, ASVS pour exiger et vérifier, SAMM pour piloter la maturité, BSIMM pour se comparer.'),
  c('m01', 3, 1, 'Qu’est-ce qu’un paved road ?', 'Un chemin de développement outillé et sûr par défaut, plus facile à suivre que les alternatives.'),
  c('m01', 4, 2, 'Shift left contre shift right ?', 'Trouver plus tôt dans le cycle, contre apprendre de la production. Les deux se nourrissent.'),
  c('m01', 5, 1, 'Structure de SAMM v2 ?', '5 fonctions (Governance, Design, Implementation, Verification, Operations), 15 pratiques, 2 streams par pratique, 3 niveaux.'),
  c('m01', 6, 2, 'Différence fondamentale entre SAMM et BSIMM ?', 'SAMM est prescriptif (ce qu’il faudrait faire) ; BSIMM est descriptif (ce que font réellement des organisations observées).'),
  c('m01', 7, 1, 'Les trois propriétés d’un bon contrôle DevSecOps ?', 'Rapide, précis (peu de faux positifs), actionnable.'),
  c('m01', 8, 1, 'Que mesure le taux d’échappement ?', 'La part des vulnérabilités trouvées en production qu’un contrôle amont aurait dû attraper.'),
  c('m01', 9, 1, 'Les cinq éléments d’une bonne exception de sécurité ?', 'Écrite, justifiée, un propriétaire du risque au bon niveau, une date d’expiration, un plan de sortie.'),
  c('m01', 10, 1, 'Les quatre groupes du NIST SSDF ?', 'PO (Prepare the Organization), PS (Protect the Software), PW (Produce Well-Secured Software), RV (Respond to Vulnerabilities).'),
  c('m01', 11, 1, 'CRA : délais de signalement d’une vulnérabilité activement exploitée ?', 'Alerte sous 24 h, notification sous 72 h, rapport final sous 14 jours après disponibilité d’une mesure corrective.', ['m07-c8']),
  c('m01', 12, 1, 'CRA : à partir de quelle date le signalement est-il obligatoire ?', 'Le 11/09/2026, via la plateforme unique de signalement d’ENISA.'),

  // ── m02 · Vulnérabilités web, écosystème JS ───────────────────────────────
  c('m02', 1, 1, 'Les deux nouvelles catégories du Top 10:2025 ?', 'A03 Software Supply Chain Failures et A10 Mishandling of Exceptional Conditions.'),
  c('m02', 2, 1, 'Où est passée la SSRF dans le Top 10:2025 ?', 'Elle est intégrée à A01 Broken Access Control.'),
  c('m02', 3, 2, 'API1, API3, API5 de l’API Security Top 10 2023 ?', 'BOLA, Broken Object Property Level Authorization, BFLA : trois problèmes d’autorisation.'),
  c('m02', 4, 2, 'Contrôle de classe contre l’injection d’opérateurs Mongo ?', 'Un schéma strict (types, longueurs, champs connus) à l’entrée de chaque route.'),
  c('m02', 5, 1, 'Parser de query string par défaut dans Express 5 ?', 'simple (querystring de Node), qui ne construit pas d’objets imbriqués.'),
  c('m02', 6, 2, 'Comment représenter un montant de facture ?', 'Un entier en centimes (ou une bibliothèque décimale), calculé côté serveur.'),
  c('m02', 7, 3, 'Pourquoi Object.hasOwn plutôt que in ?', 'in remonte la chaîne de prototypes : \'toString\' in {} vaut true.'),
  c('m02', 8, 2, 'Pourquoi le ReDoS est-il grave en Node ?', 'Une requête qui bloque la boucle d’événements gèle toutes les autres requêtes du processus.'),
  c('m02', 9, 2, 'Vérification correcte d’un chemin fourni par l’utilisateur ?', 'path.resolve(base, nom), puis vérifier que le résultat commence par base + path.sep.'),
  c('m02', 10, 3, 'node:vm est-il un bac à sable ?', 'Non, la documentation le dit explicitement. Isolation par processus ou conteneur.'),
  c('m02', 11, 1, 'Que se passe-t-il pour un rejet de promesse non géré sur Node récent ?', 'Le processus s’arrête par défaut (depuis Node 15). Express 5 transmet les rejets au middleware d’erreur.'),
  c('m02', 12, 2, 'Contrainte de crypto.timingSafeEqual ?', 'Deux Buffers de même longueur, sinon il lève une exception.'),
  c('m02', 13, 3, 'Sink XSS de React qui n’utilise pas dangerouslySetInnerHTML ?', 'href ou src avec une URL javascript:. Valider le schéma avec new URL().'),
  c('m02', 14, 3, 'Pourquoi cors({ origin: true, credentials: true }) est-il dangereux ?', 'Il reflète n’importe quelle origine : tout site peut lire les réponses authentifiées.'),
  c('m02', 15, 3, 'Une Server Action Next.js est-elle privée ?', 'Non : c’est un endpoint POST public. Elle authentifie, autorise et valide elle-même.'),
  c('m02', 16, 1, 'React2Shell : CVE et versions corrigées ?', 'CVE-2025-55182, corrigée en React 19.0.1, 19.1.2 et 19.2.1.'),

  // ── m03 · Web avancé ──────────────────────────────────────────────────────
  c('m03', 1, 1, 'Qu’a changé la single-packet attack ?', 'Plusieurs requêtes arrivent quasi simultanément : des fenêtres de quelques millisecondes deviennent exploitables.'),
  c('m03', 2, 2, 'Contrôle qui garantit « au plus N utilisations » ?', 'Une mise à jour conditionnelle atomique côté base (WHERE used < max).', ['m07-c3']),
  c('m03', 3, 2, 'D’où vient l’URL d’un lien de réinitialisation ?', 'D’une configuration (APP_URL), jamais de Host ou de X-Forwarded-Host.'),
  c('m03', 4, 2, 'Réglage sûr de trust proxy dans Express ?', 'Le nombre exact de sauts de proxy (ou leurs adresses), jamais true.'),
  c('m03', 5, 1, 'Qu’est-ce que la server-side parameter pollution ?', 'Une entrée concaténée dans un appel interne qui ajoute des paramètres ou change la ressource.'),
  c('m03', 6, 2, 'Contrôles GraphQL contre le DoS et le contournement des limites ?', 'Limites de profondeur, de coût et d’alias ; requêtes persistées ; autorisation par résolveur.'),
  c('m03', 7, 1, 'Cause racine du request smuggling ?', 'Deux composants ne délimitent pas une requête de la même façon.'),
  c('m03', 8, 3, 'Le CDN parle HTTP/2 au navigateur. La désynchronisation est-elle écartée ?', 'Non, si le proxy rétrograde en HTTP/1.1 vers le backend : c’est là que les délimitations divergent. La recommandation de « HTTP/1.1 must die » : HTTP/2 de bout en bout, y compris entre le proxy et le backend.'),
  c('m03', 9, 2, 'Cache poisoning contre cache deception ?', 'Poisoning : une réponse contaminée servie à tous. Deception : une page privée de la victime mise en cache.'),
  c('m03', 10, 1, 'Qu’est-ce qu’un parser differential ?', 'Deux composants lisent différemment la même entrée : l’un valide, l’autre agit.'),
  c('m03', 11, 3, 'Qu’est-ce qu’une fuite via l’ORM ?', 'Le client choisit les champs de filtre et déduit des valeurs sensibles, même avec des requêtes paramétrées.'),
  c('m03', 12, 2, 'Règle pour res.render ?', 'Ne jamais lui passer req.query ou req.body : un objet de vue construit explicitement.'),
  c('m03', 13, 1, 'Qu’est-ce qu’un gadget de prototype pollution ?', 'Un code légitime qui lit une propriété absente de son objet et la trouve dans le prototype pollué.'),
  c('m03', 14, 3, 'JWT : qui choisit l’algorithme et la clé ?', 'Le serveur, par configuration. Les en-têtes alg, jwk, jku et un kid libre ne décident rien.'),
  c('m03', 15, 1, 'Bibliothèque au cœur de SAMLStorm ?', 'xml-crypto (CVE-2025-29775), corrigée en 6.0.1.'),
  c('m03', 16, 3, 'Défense SSRF qui ne dépend pas des astuces ?', 'Vérifier l’adresse IP réellement contactée à chaque connexion, sans redirections implicites.', ['m15-c5']),

  // ── m04 · Côté client & scripts tiers ─────────────────────────────────────
  c('m04', 1, 1, 'Que deviennent les variables VITE_* ou NEXT_PUBLIC_* au build ?', 'Elles sont inlinées dans le bundle envoyé au navigateur : jamais de secret dedans, et un scan de secrets sur le bundle construit.'),
  c('m04', 2, 2, 'Validation côté client, validation côté serveur : laquelle protège, et à quoi sert l’autre ?', 'Seul le serveur protège : on rejoue la requête sans le formulaire. La validation client est un confort ; le serveur recalcule montants et droits au lieu de les recevoir.'),
  c('m04', 3, 1, 'Que garantit l’attribut integrity (SRI) sur un script ?', 'Que le fichier reçu a exactement l’empreinte attendue, sinon le navigateur refuse de l’exécuter. Pour une autre origine, il faut aussi CORS (attribut crossorigin).'),
  c('m04', 4, 3, 'Pourquoi SRI ne pouvait-il pas protéger les sites qui chargeaient polyfill.io (2024) ?', 'Le service renvoyait un contenu différent selon le navigateur : aucune empreinte fixe possible. Quand le domaine a changé de propriétaire, le code malveillant est arrivé par le canal de confiance. Seuls le retrait du script ou l’auto-hébergement d’une version figée protégeaient.'),
  c('m04', 5, 3, 'Pourquoi une CSP à liste de domaines protège-t-elle mal ?', 'Elle autorise tout ce que ces domaines servent : un endpoint JSONP ou une bibliothèque vulnérable sur un domaine autorisé suffit à la contourner. La CSP stricte repose sur un nonce et strict-dynamic.'),
  c('m04', 6, 1, 'Les trois propriétés d’un nonce CSP ?', 'Au moins 128 bits d’aléa, nouveau à chaque réponse, jamais dans une page servie depuis un cache partagé.'),
  c('m04', 7, 2, 'Content-Security-Policy contre Content-Security-Policy-Report-Only ?', 'La première bloque et signale ; la seconde ne fait que signaler. Les deux coexistent : une politique bloquante, et une plus stricte en observation.'),
  c('m04', 8, 1, 'Que change Trusted Types ?', 'Les sinks dangereux du DOM (innerHTML, eval…) refusent les chaînes et exigent un objet typé produit par une politique : un DOM XSS devient une erreur de type.'),
  c('m04', 9, 3, 'Iframe en sandbox sur sa propre origine : pourquoi jamais allow-scripts avec allow-same-origin ?', 'Le contenu encadré peut alors atteindre le DOM parent et retirer lui-même l’attribut sandbox : l’isolation disparaît. Un contenu à isoler se sert depuis une autre origine.'),
  c('m04', 10, 2, 'PCI DSS 4.0.1 : exigence 6.4.3 contre 11.6.1 ?', '6.4.3 est préventive : inventaire, justification, autorisation et intégrité des scripts de la page de paiement. 11.6.1 est détective : repérer les modifications des scripts et des en-têtes tels que reçus par le navigateur.'),
  c('m04', 11, 3, 'Une CSP stricte protège la page de paiement. Pourquoi ne suffit-elle pas pour l’exigence 11.6.1 ?', 'Elle ne voit ni le contenu modifié d’un script qu’elle autorise, ni la disparition de son propre en-tête. Il faut un contrôle qui observe la page telle que le navigateur la reçoit.'),
  c('m04', 12, 1, 'Que dit l’en-tête Sec-Fetch-Site ?', 'D’où vient la requête par rapport à la cible : same-origin, same-site, cross-site ou none. Une resource isolation policy refuse le cross-site sur les ressources privées.'),
  c('m04', 13, 1, 'Cookie préfixé __Host- : quelles contraintes ?', 'Secure, Path=/ et aucun attribut Domain : un sous-domaine ne peut ni le poser ni l’écraser.'),

  // ── m05 · Gestion des vulnérabilités ──────────────────────────────────────
  c('m05', 1, 1, 'Les sept étapes du cycle de vie d’une vulnérabilité ?', 'Découverte, dédoublonnage, triage, priorisation, correction, vérification, reporting.'),
  c('m05', 2, 1, 'Nouvelle métrique d’exploitabilité de CVSS 4.0 ?', 'Attack Requirements (AT).'),
  c('m05', 3, 1, 'Que signifie CVSS-BTE ?', 'Un score calculé avec les métriques Base, Threat et Environmental.'),
  c('m05', 4, 1, 'Que mesure l’EPSS ?', 'La probabilité d’une activité d’exploitation dans les 30 prochains jours (v4 depuis mars 2025).'),
  c('m05', 5, 1, 'Les quatre décisions de SSVC (CISA) ?', 'Track, Track*, Attend, Act.'),
  c('m05', 6, 1, 'Les quatre statuts VEX ?', 'not_affected, affected, fixed, under_investigation.'),
  c('m05', 7, 1, 'Champs obligatoires de security.txt ?', 'Contact et Expires (RFC 9116).'),
  c('m05', 8, 1, 'Que fait le NVD depuis avril 2026 ?', 'Il n’enrichit plus que les CVE du KEV, des logiciels fédéraux et des logiciels critiques.'),
  c('m05', 9, 2, 'Imposer une version corrigée d’une dépendance transitive avec npm ?', 'Le champ overrides de package.json.'),
  c('m05', 10, 2, 'Deux indicateurs de réaction à une crise de type React2Shell ?', 'Temps d’inventaire et temps de correction en production.'),
  c('m05', 11, 2, 'EPSS contre KEV ?', 'EPSS est une probabilité d’exploitation à 30 jours, calculée pour toutes les CVE. Le KEV de la CISA liste les CVE dont l’exploitation est constatée : une CVE du KEV se traite même si son EPSS paraît modeste.'),
  c('m05', 12, 3, 'Un CVSS de base à 9,8 : pourquoi ne suffit-il pas à fixer la priorité ?', 'Le score de base décrit la faille dans l’absolu. Il ignore l’exploitation observée (Threat, EPSS, KEV), l’exposition et la criticité dans le contexte de l’organisation (Environmental), et l’atteignabilité du code vulnérable.'),
  c('m05', 13, 3, 'npm audit ne remonte rien. Pourquoi n’est-ce pas une garantie ?', 'Il compare l’arbre installé aux avis publiés : un paquet malveillant publié il y a une heure n’a pas encore d’avis. Contre ce risque : délai d’adoption, scripts d’installation désactivés, analyse comportementale.'),
  c('m05', 14, 2, 'VEX : que faut-il fournir avec un statut not_affected ?', 'Une justification (code vulnérable absent, non atteignable, non exécuté…). C’est un engagement à maintenir : il devient faux si le code change.'),

  // ── m06 · Faire adopter la sécurité ───────────────────────────────────────
  c('m06', 1, 2, 'Enabling team contre plateforme : quelle différence pour une équipe AppSec ?', 'L’enabling team accompagne une équipe pendant un temps limité pour la rendre autonome ; la plateforme offre un service stable en libre-service. Aucune des deux n’est une file d’attente.'),
  c('m06', 2, 1, 'Les cinq éléments d’un finding qui sera corrigé ?', 'Un titre qui dit l’impact, une reproduction minimale, une priorité justifiée, un correctif dans le style de l’équipe, un test de régression.'),
  c('m06', 3, 3, 'Mesure compensatoire proposée : « on ajoute une alerte ». Pourquoi est-ce souvent insuffisant ?', 'Une mesure compensatoire doit changer le risque, en probabilité ou en impact : une alerte que personne ne traite ne change rien. Et le correctif définitif garde une date et un propriétaire.'),
  c('m06', 4, 2, 'Pentest, bug bounty, red team : quelle question pose chacun ?', 'Pentest : quelles failles sur ce périmètre, dans ce temps ? Bug bounty : que trouvent des chercheurs variés, en continu, sur ce qui est exposé ? Red team : la détection et la réponse arrêtent-elles un attaquant qui vise un objectif ?'),

  // ── m07 · Fondations, exigences & vie privée ──────────────────────────────
  c('m07', 1, 1, 'Les trois piliers du Gold Standard ?', 'Authentification, autorisation, audit — pour tous les principaux, y compris les services et les agents IA.'),
  c('m07', 2, 2, 'C-I-A contre Gold Standard ?', 'C-I-A décrit les objectifs (confidentialité, intégrité, disponibilité) ; le Gold Standard décrit les moyens d’y parvenir (authentification, autorisation, audit).'),
  c('m07', 3, 3, 'Le code lit le solde, vérifie qu’il suffit, puis écrit. Pourquoi l’invariant n’est-il pas garanti ?', 'Entre la lecture et l’écriture, une autre requête peut modifier la donnée. L’invariant se vérifie dans l’écriture elle-même : mise à jour conditionnelle, contrainte CHECK, verrou de ligne.', ['m03-c2']),
  c('m07', 4, 2, 'Pourquoi citer une exigence ASVS avec la version du standard ?', 'La numérotation change d’une version à l’autre : V2 désignait l’authentification en 4.0, c’est la validation et la logique métier en 5.0.'),
  c('m07', 5, 3, 'Les e-mails sont remplacés par leur SHA-256, sans clé. Sont-ils anonymisés ?', 'Non : les e-mails se devinent, le hash se renverse par dictionnaire. Même un HMAC à clé séparée n’est qu’une pseudonymisation : la donnée reste personnelle au sens du RGPD.'),
  c('m07', 6, 1, 'Joiner, mover, leaver : quelle étape est la plus souvent ratée ?', 'Le mover : les droits de l’ancien poste s’ajoutent à ceux du nouveau au lieu d’être retirés.'),
  c('m07', 7, 3, 'Le compte SSO d’un salarié parti est désactivé. Pourquoi son accès n’est-il pas forcément coupé ?', 'Le SSO ne coupe ni les jetons personnels, ni les clés d’API, ni les secrets qu’il connaissait, ni les JWT déjà émis, valides jusqu’à leur expiration.'),
  c('m07', 8, 1, 'NIS2 : délais de notification d’un incident important ?', 'Alerte précoce sous 24 h, notification sous 72 h, rapport final sous un mois.', ['m01-c11']),

  // ── m08 · Conception sécurisée ────────────────────────────────────────────
  c('m08', 1, 1, 'Les trois stratégies de mitigation structurelle ?', 'Réduire la surface d’attaque, la fenêtre de vulnérabilité et l’exposition des données.'),
  c('m08', 2, 2, 'Confused deputy contre backflow of trust ?', 'Confused deputy : un composant privilégié agit au-delà des droits de celui qui le sollicite. Backflow of trust : un composant peu fiable pilote un composant très fiable.'),
  c('m08', 3, 3, 'Deux couches reposent sur la même vérification. Est-ce de la défense en profondeur ?', 'Non : la défense en profondeur ne vaut que pour des couches indépendantes : si elles partagent le même contrôle ou la même donnée, une seule erreur les fait tomber ensemble.'),
  c('m08', 4, 2, 'Complete Mediation appliquée aux factures de Novafact ?', 'Tous les chemins vers une facture — API, export CSV, PDF, webhook, outil d’IA — passent par le même contrôle d’autorisation.'),
  c('m08', 5, 1, 'Les six étapes d’une Security Design Review ?', 'Study, Inquire, Identify, Collaborate, Write, Follow up.'),
  c('m08', 6, 3, 'La RLS PostgreSQL est activée sur la table des factures. Pourquoi peut-elle ne rien filtrer ?', 'Le propriétaire de la table et les rôles BYPASSRLS l’ignorent. Il faut un rôle applicatif non propriétaire, FORCE ROW LEVEL SECURITY, et le tenant positionné dans la transaction.'),
  c('m08', 7, 3, 'Un MAC authentifie le webhook. Pourquoi ne suffit-il pas contre le rejeu ?', 'Le MAC prouve l’origine et l’intégrité, pas la fraîcheur : un message capturé reste valide. Il faut un horodatage signé, une fenêtre courte et les identifiants déjà vus mémorisés.'),
  c('m08', 8, 2, 'RBAC, ABAC, ReBAC : à quoi sert chacun chez Novafact ?', 'RBAC pour la base (rôles dans le tenant), ABAC pour les cas sensibles (montant, statut de la facture), ReBAC pour le partage (qui a accès à quel dossier).'),

  // ── m09 · OAuth / OIDC / SAML ─────────────────────────────────────────────
  c('m09', 1, 1, 'Que supprime OAuth 2.1 ?', 'Les flux Implicit et Resource Owner Password Credentials ; PKCE devient obligatoire et les redirect_uri se comparent exactement.'),
  c('m09', 2, 2, 'state, nonce, code_verifier : contre quoi protège chacun ?', 'state : le CSRF de connexion. nonce : le rejeu de l’ID token. code_verifier (PKCE) : l’interception du code d’autorisation.'),
  c('m09', 3, 2, 'ID token, access token, refresh token : à qui est destiné chacun ?', 'L’ID token au client, l’access token à l’API, le refresh token au serveur d’autorisation.'),
  c('m09', 4, 3, 'La signature du JWT est valide. Qu’est-ce qui peut encore le rendre inacceptable pour l’API qui le reçoit ?', 'Un émetteur hors liste, une audience qui n’est pas celle de l’API, une expiration dépassée, un nbf dans le futur, ou le mauvais type de jeton — un ID token présenté comme access token.'),
  c('m09', 5, 3, 'nOAuth (2023) : pourquoi identifier un utilisateur fédéré par son e-mail est-il dangereux ?', 'L’e-mail fourni par l’IdP n’est ni stable ni toujours vérifié : dans des applications Azure AD, un attaquant a pu se connecter en mettant l’e-mail de sa victime sur son propre compte. On identifie par le couple (iss, sub).'),
  c('m09', 6, 1, 'Que lie DPoP, et comment ?', 'Le jeton à une clé du client : chaque requête porte une preuve signée (méthode, URL, horodatage, jti, empreinte du jeton). Un jeton volé seul ne sert à rien.'),
  c('m09', 7, 2, 'OAuth contre OpenID Connect ?', 'OAuth autorise un client à accéder à une API ; OIDC ajoute l’authentification : l’ID token dit au client qui est l’utilisateur.'),

  // ── m10 · Anti-abus ──────────────────────────────────────────────────────
  c('m10', 1, 2, 'Credential cracking contre credential stuffing ?', 'Cracking (OAT-007) : beaucoup d’essais sur peu de comptes, arrêté par une limite par compte. Stuffing (OAT-008) : deux ou trois essais sur des milliers de comptes, avec des identifiants volés ailleurs.'),
  c('m10', 2, 3, 'Snowflake (2024) : pourquoi aucune limite de tentatives n’a-t-elle vu venir les intrusions ?', 'Les identifiants, volés par des infostealers, étaient valides : il n’y avait aucune série d’échecs à détecter. Les comptes touchés n’avaient pas de MFA, le seul contrôle qui arrêtait l’attaque.'),
  c('m10', 3, 3, 'La requête contient un jeton Turnstile. Pourquoi ne prouve-t-il rien tel quel ?', 'Il ne vaut qu’après validation côté serveur, avec contrôle du hostname et de l’action ; il est à usage unique et expire vite.'),
  c('m10', 4, 2, 'API4 contre API6 de l’API Security Top 10 ?', 'API4 : épuiser une ressource technique (CPU, mémoire, facture cloud). API6 : un préjudice métier causé par un flux sensible utilisé à la mauvaise échelle, parfois à faible volume.'),
  c('m10', 5, 3, 'SPF, DKIM et DMARC en place : empêchent-ils un client d’envoyer du phishing par Novafact ?', 'Non : ils empêchent l’usurpation du domaine, pas l’abus par un client légitime. Contre l’abus : confiance fondée sur des preuves coûteuses, quotas, isolation de la réputation d’envoi.'),

  // ── m11 · Threat modeling & MITRE ────────────────────────────────────────
  c('m11', 1, 1, 'STRIDE : les six menaces et la propriété violée ?', 'Spoofing (authentification), Tampering (intégrité), Repudiation (non-répudiation), Information disclosure (confidentialité), Denial of service (disponibilité), Elevation of privilege (autorisation).'),
  c('m11', 2, 2, 'STRIDE par élément : quelles menaces pour un flux de données ?', 'Tampering, Information disclosure, Denial of service. Une entité externe : S et R ; un stockage : T, R, I, D ; un processus : les six.'),
  c('m11', 3, 2, 'Arbre d’attaque : que faut-il couper sous un nœud ET ? Sous un OU ?', 'Sous un ET, couper un seul enfant suffit ; sous un OU, il faut les couper tous.'),
  c('m11', 4, 1, 'La chaîne CWE → CAPEC → ATT&CK ?', 'CWE nomme la faiblesse, CAPEC le motif d’attaque qui l’exploite, ATT&CK le comportement de l’attaquant ; D3FEND décrit les contre-mesures.'),

  // ── m12 · Revue de code ──────────────────────────────────────────────────
  c('m12', 1, 2, 'Dans un diff, pourquoi les lignes supprimées méritent-elles le plus d’attention ?', 'Un contrôle retiré ne laisse aucune trace dans le code ajouté : pour chaque vérification supprimée, demander où elle est reprise.'),
  c('m12', 2, 3, 'Pourquoi un scanner ne trouve-t-il presque jamais une BOLA ?', 'Il ignore la règle métier « cette facture appartient à ce tenant » : la requête est bien formée et renvoie 200. Il faut une table de décision et un test à deux tenants.'),
  c('m12', 3, 1, 'Qu’est-ce que la variant analysis ?', 'Partir d’un bug corrigé, en extraire le motif sans nom de produit, chercher toutes ses variantes dans la base, puis en faire une règle.'),
  c('m12', 4, 1, 'Qu’est-ce que le slopsquatting ?', 'Publier sur un registre les noms de paquets que les assistants de code inventent : ces noms hallucinés sont nombreux et reviennent d’une génération à l’autre.'),

  // ── m13 · Tests & analyse ────────────────────────────────────────────────
  c('m13', 1, 1, 'Les quatre couches de l’analyse statique en JavaScript ?', 'Types stricts, lint, SAST par motifs, SAST par flux (taint).'),
  c('m13', 2, 2, 'Semgrep Community Edition contre CodeQL ?', 'Semgrep est rapide et lisible, mais sa Community Edition reste intra-fonction ; CodeQL suit les données entre fonctions et fichiers, plus lentement.'),
  c('m13', 3, 3, 'GotoFail (Apple, 2014) : pourquoi aucun test n’a-t-il vu que TLS ne refusait plus rien ?', 'Un goto fail; dupliqué sautait la vérification de signature, et les tests ne couvraient que le chemin heureux. Chaque contrôle mérite au moins un test qui vérifie le refus.'),
  c('m13', 4, 2, 'Test de régression d’une vulnérabilité : quelle preuve exige-t-on ?', 'L’avoir vu échouer avant le correctif, et qu’il couvre les variantes, pas seulement la charge utile du rapport.'),
  c('m13', 5, 3, 'Un secret a fuité dans un commit. Pourquoi réécrire l’historique Git ne suffit-il pas ?', 'Le secret a pu être copié : clones, forks, caches, journaux de CI. Corriger, c’est révoquer et remplacer, puis enquêter sur son usage.'),
  c('m13', 6, 3, 'xz utils (2024) : pourquoi relire le dépôt Git ne montrait-il pas la porte dérobée ?', 'Le déclencheur n’existait que dans les archives de release (un script de build modifié), et la charge était cachée dans des fichiers de test binaires. Ce qui était construit n’était pas ce qui était relu.'),

  // ── m14 · Pipeline & supply chain ────────────────────────────────────────
  c('m14', 1, 2, 'PPE directe contre PPE indirecte ?', 'Directe : la PR modifie le fichier de workflow. Indirecte : elle modifie ce que le workflow exécute — package.json, scripts de test, Makefile. En JS, npm install et npm test suffisent.'),
  c('m14', 2, 1, 'Réglage du GITHUB_TOKEN dans un workflow durci ?', 'permissions: {} au niveau du workflow, puis les droits nécessaires job par job ; persist-credentials: false au checkout.'),
  c('m14', 3, 3, 'Ultralytics (2024) : comment un workflow pull_request_target a-t-il mené à un paquet piégé ?', 'Il s’exécutait dans le contexte du dépôt cible, avec un nom de branche injecté dans le shell : l’attaquant a empoisonné le cache partagé, puis le workflow de publication a produit des versions piégées.'),
  c('m14', 4, 2, 'Épingler une action GitHub par tag ou par SHA ?', 'Par SHA complet de commit : un tag se déplace, comme l’ont montré les tags réécrits de tj-actions/changed-files (2025). Le tag peut rester en commentaire.'),
  c('m14', 5, 3, 'Le paquet a une provenance npm valide. Qu’est-ce que ça ne prouve pas ?', 'Que la construction était saine : la provenance dit quel workflow, depuis quel commit, a produit le paquet. Un workflow empoisonné produit une provenance parfaitement valide.'),
  c('m14', 6, 1, 'SLSA Build L1, L2, L3 ?', 'L1 : une provenance existe. L2 : elle est produite et signée par une plateforme de build hébergée. L3 : un build durci et isolé, qui empêche les exécutions de falsifier la provenance.'),

  // ── m15 · IAM AWS ────────────────────────────────────────────────────────
  c('m15', 1, 1, 'La logique d’évaluation IAM en une phrase ?', 'Un Deny explicite gagne toujours ; ensuite chaque plafond (SCP, RCP, boundary, session policy) doit dire oui, et au moins une politique doit accorder.'),
  c('m15', 2, 3, 'Comment une politique de ressource peut-elle contourner une permission boundary ?', 'Si elle nomme directement la session de rôle comme principal, l’accès est accordé sans que la boundary ni la session policy ne s’appliquent. Un garde-fou solide est un Deny explicite.'),
  c('m15', 3, 2, 'SCP contre RCP ?', 'Une SCP plafonne ce que les principaux de l’organisation peuvent faire ; une RCP plafonne ce qu’on peut faire sur les ressources de l’organisation, quel que soit l’appelant. Aucune n’accorde.'),
  c('m15', 4, 2, 'Pourquoi iam:PassRole est-il si sensible ?', 'Il permet de confier un rôle existant à un service (Lambda, EC2, ECS) : passer un rôle plus puissant que soi revient à obtenir ses droits. On le limite par ARN et par iam:PassedToService.'),
  c('m15', 5, 3, 'Capital One (2019) a mené à IMDSv2. Pourquoi l’imposer ne suffit-il pas contre une SSRF ?', 'IMDSv2 exige un jeton obtenu par un PUT avec en-tête : il arrête les SSRF simples, comme celle qui a lu les identifiants du rôle en 2019. Une SSRF qui maîtrise méthode et en-têtes passe encore : la défense reste dans l’application, avec un rôle minimal.', ['m03-c16']),

  // ── m16 · Infrastructure as Code ─────────────────────────────────────────
  c('m16', 1, 3, 'La variable Terraform est marquée sensitive = true. Le secret est-il protégé ?', 'Non : sensitive masque l’affichage, mais la valeur est écrite en clair dans le state. Secret géré par le service, arguments write-only, state chiffré à accès restreint.'),
  c('m16', 2, 2, 'Scanner le code Terraform ou le plan ?', 'Le code pour la précision (la ligne fautive), le plan pour la réalité (variables, modules résolus). Les valeurs calculées pendant l’apply échappent aux deux.'),
  c('m16', 3, 2, 'Pourquoi deux rôles OIDC distincts pour terraform plan et terraform apply ?', 'Le plan exécute du code (providers, data sources) à partir d’une PR : il reste en lecture seule. L’apply, en écriture, est réservé à main et à un environnement protégé.'),

  // ── m17 · Déploiement & résilience ───────────────────────────────────────
  c('m17', 1, 2, 'ECS : rôle de tâche contre rôle d’exécution ?', 'Le rôle de tâche sert au code de l’application ; le rôle d’exécution sert à l’agent ECS (tirer l’image, lire les secrets, écrire les logs). On ne les fusionne jamais.'),
  c('m17', 2, 3, 'L’image est signée, et on déploie son tag. Pourquoi est-ce insuffisant ?', 'Un tag se déplace : on signe, vérifie et déploie un digest. Et la vérification doit imposer l’identité attendue du signataire, sinon n’importe quelle signature valide passe.'),
  c('m17', 3, 3, 'Bucket répliqué en continu vers un autre compte : est-ce une sauvegarde contre le ransomware ?', 'Non : la réplication recopie aussi les versions chiffrées ou corrompues par l’attaquant, et rien ne la rend immuable. Il faut des copies ponctuelles, verrouillées en mode compliance, dans un autre compte, avec une autre clé.'),
  c('m17', 4, 2, 'Object Lock : mode governance contre mode compliance ?', 'Governance : un principal doté d’une permission spéciale peut lever le verrou, il protège de l’erreur. Compliance : personne, pas même root, ne supprime avant l’échéance, il résiste à un administrateur compromis.'),

  // ── m18 · SIEM ───────────────────────────────────────────────────────────
  c('m18', 1, 2, 'KQL, EQL, ES|QL : lequel pour quelle question ?', 'KQL filtre, EQL enchaîne des événements en séquence, ES|QL agrège, compte et enrichit.'),
  c('m18', 2, 3, 'La règle est mappée sur une technique ATT&CK. Pourquoi ne prouve-t-elle pas la couverture ?', 'Le mapping dit ce que la règle vise, pas qu’elle se déclenche : seule une exécution de la technique (Stratus Red Team, Atomic Red Team, test de recette) le prouve.'),
  c('m18', 3, 1, 'Que ne journalise-t-on jamais ?', 'Mots de passe, jetons, secrets et données sensibles : une allowlist de champs, la redaction en filet, une empreinte HMAC quand il faut corréler.'),
  c('m18', 4, 3, 'CloudTrail est activé sur tous les comptes. Pourquoi ne voit-il pas l’aspiration d’un bucket S3 ?', 'Les événements de données (GetObject, PutObject) ne sont pas journalisés par défaut : il faut les activer sur les buckets critiques.'),

  // ── m19 · Sécurité de l’IA ───────────────────────────────────────────────
  c('m19', 1, 1, 'Les trois pieds de la lethal trifecta ?', 'Accès à des données privées, exposition à du contenu non fiable, capacité de communiquer vers l’extérieur. Couper un pied casse l’exfiltration.'),
  c('m19', 2, 1, 'Agents Rule of Two (Meta, 2025) ?', 'Un agent cumule au plus deux propriétés parmi : traiter des entrées non fiables, accéder à des données ou systèmes sensibles, changer d’état ou communiquer vers l’extérieur. Au-delà, supervision humaine.'),
  c('m19', 3, 3, 'Le prompt système interdit d’obéir aux documents. Pourquoi l’injection reste-t-elle possible ?', 'Consignes et données partagent le même contexte, sans canal séparé : un attaquant adaptatif finit par passer. La défense est dans l’architecture : privilèges séparés, outils minimaux, confirmation exécutée par le code.'),
  c('m19', 4, 3, 'Pourquoi ne rien mettre de secret dans le prompt système, même s’il est caché ?', 'Tout le contexte caché est supposé découvrable (LLM08:2026 Hidden Context Exposure) : ni secret, ni règle d’autorisation, qui doit vivre dans le code.'),
  c('m19', 5, 2, 'EchoLeak (2025) : quels contrôles pour une sortie de modèle rendue en Markdown ?', 'La traiter comme une saisie utilisateur : pas de HTML brut, images externes bloquées, liens en liste blanche, CSP en seconde ligne. Dans EchoLeak, une URL d’image construite par Copilot emportait les données.'),
  c('m19', 6, 2, 'Plan-then-execute contre CaMeL ?', 'Plan-then-execute fige la suite d’outils avant de lire les données non fiables : il protège le flux de contrôle, pas les valeurs. CaMeL suit aussi la provenance des valeurs et applique une politique avant chaque outil.'),
  c('m19', 7, 1, 'Tool poisoning, shadowing, rug pull : de quoi parle-t-on ?', 'D’attaques par les définitions d’outils MCP : une description piégée qui entre dans le contexte, un outil qui détourne l’usage d’un autre, une définition modifiée après approbation.'),
  c('m19', 8, 3, 'Le serveur MCP relaie vers l’API le jeton reçu du client. Quel est le problème ?', 'Le token passthrough : ce jeton n’a pas été émis pour ce serveur, et l’API aval perd la trace de qui agit. Le serveur n’accepte que ses propres jetons et fait un token exchange vers l’aval.'),
  c('m19', 9, 2, 'RAG multi-tenant : où appliquer les droits ?', 'À la récupération, par un filtre de tenant obligatoire dans la requête vectorielle. Filtrer la réponse après génération arrive trop tard : le modèle a déjà lu le document.'),
  c('m19', 10, 1, 'Que décrit MITRE ATLAS ?', 'Les tactiques et techniques d’attaque contre les systèmes d’IA, sur le modèle d’ATT&CK, avec des études de cas et des mitigations.'),
  c('m19', 11, 2, 'promptfoo : campagne générée contre suite de régression ?', 'La campagne générée sert à découvrir, en préproduction ; la suite de régression est figée et bloquante en CI, pour ne pas revenir en arrière.'),
  c('m19', 12, 3, 'MCP GitHub (2025) : sans faille de code, comment un ticket public a-t-il fait fuiter un dépôt privé ?', 'L’agent lisait un contenu non fiable (le ticket), avait accès à des données privées et pouvait publier : la lethal trifecta complète. La consigne du ticket a suffi ; la parade est de couper un pied, pas de corriger le serveur.'),

  // ── m22 · MITRE ATT&CK et la menace SaaS ──────────────────────────────────
  c('m22', 1, 1, 'Tactique, technique, procédure : qui répond à quelle question ?', 'La tactique dit le pourquoi (l’objectif), la technique le comment, la procédure la mise en œuvre concrète par un acteur donné.'),
  c('m22', 2, 2, 'ATT&CK v19 : qu’est devenue la tactique Defense Evasion (TA0005) ?', 'Elle est scindée : TA0005 devient Stealth (se fondre sans toucher aux contrôles) et une nouvelle tactique Defense Impairment (TA0112) réunit ce qui casse ou aveugle les contrôles.'),
  c('m22', 3, 2, 'Stealth ou Defense Impairment : où ranger la coupure d’un journal cloud ?', 'Defense Impairment : couper la journalisation casse un contrôle. C’est T1685.002 (ex-T1562.008, révoquée). Se cacher sans rien désactiver, lui, reste dans Stealth.'),
  c('m22', 4, 1, 'Les quatre usages d’ATT&CK ?', 'Renseignement sur la menace, détection, émulation d’adversaire, évaluation : un même vocabulaire pour quatre métiers.'),
  c('m22', 5, 3, 'La règle de détection est mappée sur une technique ATT&CK. Prouve-t-elle qu’on la verrait ?', 'Non : le mapping dit ce que la règle vise, pas qu’elle se déclenche. Seule une exécution de la technique (Atomic Red Team, Stratus) prouve la couverture.'),
  c('m22', 6, 2, 'Pourquoi la plupart des intrusions SaaS passent-elles par l’identité, pas par une faille de code ?', 'Le SaaS expose des fonctions, pas du code applicatif : l’attaquant abuse de l’authentification et des autorisations (comptes, jetons, consentements), rarement d’une vulnérabilité de la plateforme.'),
  c('m22', 7, 2, 'Fatigue MFA : quelle technique, et quelle parade ?', 'T1621 (Multi-Factor Authentication Request Generation). La parade : une MFA à correspondance de nombre ou FIDO2, qui ne s’approuve pas d’un simple geste.'),
  c('m22', 8, 3, 'Une application OAuth a été autorisée par un salarié. Pourquoi réinitialiser son mot de passe ne suffit-il pas ?', 'Le jeton accordé (T1671) ne dépend ni du mot de passe ni de la MFA de l’utilisateur : il survit jusqu’à sa révocation. Seul révoquer l’application coupe l’accès.'),
  c('m22', 9, 3, 'Un cookie de session déjà validé par la 2FA est volé puis rejoué. Quelles techniques, et quelle tactique pour le rejeu ?', 'Vol : T1539 (accès aux identifiants). Rejeu : T1550.004, rattaché en v19 au seul Mouvement latéral. Une session validée par la 2FA vaut la 2FA.'),
  c('m22', 10, 2, 'T1078 Valid Accounts sert quatre tactiques : lesquelles ?', 'Initial Access, Persistence, Privilege Escalation et Stealth. Une technique peut servir plusieurs tactiques : la question « laquelle ? » dépend du contexte.'),
  c('m22', 11, 2, 'Les mitigations ATT&CK qui couvrent le plus de techniques SaaS ?', 'La MFA (M1032), la gestion des comptes et des comptes à privilèges (M1018, M1026) et l’audit (M1047) reviennent sur le plus grand nombre de techniques d’identité.'),
  c('m22', 12, 3, 'Storm-0558 (2023) : pourquoi la détection est-elle venue d’un client et non de Microsoft ?', 'Le client (Département d’État) avait une règle sur le journal MailItemsAccessed, accessible seulement avec une licence haut de gamme. Une détection n’existe que si la source de journaux existe (recommandation du CSRB).'),
];

// ── Les paquets ─────────────────────────────────────────────────────────────

const inModules = (...ids: string[]) => (card: Card) => ids.includes(card.module);

const PROFILES: SeriesProfile<Card>[] = [
  { id: 'programme', title: 'Programme et pilotage', filter: inModules('m01', 'm06'),
    text: 'Référentiels, SAMM, SSDF, CRA, exceptions : le vocabulaire du métier, avant les arbitrages avec le produit.' },
  { id: 'vulnerabilites', title: 'Gestion des vulnérabilités', filter: inModules('m05'),
    text: 'CVSS, EPSS, SSVC, VEX : d’abord les définitions, puis ce que chaque score ne dit pas.' },
  { id: 'js', title: 'Vulnérabilités JS', filter: inModules('m02'),
    text: 'Express, Node, React, Next.js : un tiers de cartes où la réponse évidente est la mauvaise.' },
  { id: 'web-avance', title: 'Web avancé', filter: inModules('m03'),
    text: 'Races, smuggling, cache, parsers, JWT : des mécanismes à distinguer deux à deux.' },
  { id: 'client', title: 'Côté client', filter: inModules('m04'),
    text: 'CSP, SRI, Trusted Types, PCI : ce que chaque en-tête garantit, et ce qu’il laisse passer.' },
  { id: 'concevoir', title: 'Exigences et conception', filter: inModules('m07', 'm08'),
    text: 'Gold Standard, RGPD, patterns, RLS : surtout des contrôles qui ont l’air suffisants.' },
  { id: 'identite', title: 'Identité, abus et menaces', filter: inModules('m09', 'm10', 'm11'),
    text: 'OAuth, anti-abus, STRIDE : beaucoup de paires à ne pas confondre.' },
  { id: 'outiller', title: 'Vérifier et outiller', filter: inModules('m12', 'm13', 'm14'),
    text: 'Revue, SAST, tests, pipeline : des définitions d’outils, puis des incidents réels qui les mettent en défaut.' },
  { id: 'cloud', title: 'Cloud et production', filter: inModules('m15', 'm16', 'm17', 'm18'),
    text: 'IAM, Terraform, déploiement, Elastic : presque que des garde-fous qui ne gardent pas ce qu’on croit.' },
  { id: 'ia', title: 'Sécurité de l’IA', filter: inModules('m19'), level: 2,
    text: 'Lethal trifecta, MCP, RAG : les notions d’abord, puis EchoLeak et le serveur MCP GitHub.' },
  { id: 'attack', title: 'ATT&CK et menace SaaS', filter: inModules('m22'), level: 2,
    text: 'Tactiques et techniques v19, scission Stealth / Defense Impairment, menace par l’identité : les notions, puis les pièges.' },
  { id: 'vocabulaire', title: 'Vocabulaire', mix: [14, 0, 0],
    text: 'Tous les blocs, niveau 1 seulement : une définition, une liste ou une date par carte.' },
  { id: 'pieges', title: 'Les pièges', mix: [0, 0, 14],
    text: 'Tous les blocs, niveau 3 seulement : chaque carte propose un contrôle plausible et demande pourquoi il ne suffit pas.' },
];

export const cardSeries = defineSeries(cards, PROFILES);

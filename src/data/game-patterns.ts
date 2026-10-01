// Situations du jeu « Pattern Match » : les 14 patterns et 4 anti-patterns de
// Kohnfelder (Designing Secure Software, chapitre 4 ; K4 dans le parcours).
//
// Le jeu demande de nommer le pattern qu'une situation applique, ou celui
// qu'elle viole, ou l'anti-pattern qu'elle illustre. Tous les noms sont pris au
// sens exact du livre : Least Common Mechanism parle d'isoler des utilisateurs
// ou des processus indépendants, pas de « partager moins » en général ; Backflow
// of Trust est un composant de faible confiance qui en **pilote** un de haute
// confiance, pas n'importe quel excès de droits.
//
// La difficulté ne vient pas du pattern — tous sont vus dans la même leçon —
// mais de la **distance** entre ce que dit la situation et la définition, et
// de la présence d'un voisin défendable parmi les réponses :
//
//   N1 · La situation décrit le mécanisme presque dans les termes de la
//        définition (« juste les droits », « liste explicite », « en cas de
//        panne, on refuse »). Les autres réponses sont tirées loin du pattern :
//        aucun de ses voisins n'est proposé. On apprend les noms.
//
//   N2 · La situation décrit un effet ou un contexte, pas le mécanisme, ou
//        bien c'est une violation (le pattern manquant plutôt que présent). Un
//        voisin plausible est **toujours** parmi les réponses (`near`) : juste
//        sur un mot-clé, faux pour une raison que l'explication nomme.
//
//   N3 · Deux patterns voisins se défendent, et un seul décrit vraiment la
//        situation : c'est un détail du texte qui tranche (le sens du contrôle,
//        la nature d'une erreur, ce qui est partagé). Souvent, la lecture la
//        plus évidente — le mot-clé, la bonne pratique visible — est le piège.
//
// Les cas réels (incidents publics, recherches publiées) sont cités par nom et
// année, fidèles aux sources ; le reste se passe chez Novafact.

import { defineSeries, type Leveled, type SeriesProfile } from '../lib/series';

export const patternNames = [
  'Economy of Design', 'Transparent Design', 'Least Privilege', 'Least Information', 'Secure by Default',
  'Allowlists over Blocklists', 'Avoid Predictability', 'Fail Securely', 'Complete Mediation', 'Least Common Mechanism',
  'Defense in Depth', 'Separation of Privilege', 'Reluctance to Trust', 'Accept Security Responsibility',
  'Confused Deputy', 'Backflow of Trust', 'Third-Party Hooks', 'Unpatchable Components',
] as const;

export type PatternName = typeof patternNames[number];
export const antiPatterns: PatternName[] = ['Confused Deputy', 'Backflow of Trust', 'Third-Party Hooks', 'Unpatchable Components'];

export interface Situation extends Leveled {
  text: string;
  answer: PatternName;
  /**
   * Les voisins défendables, toujours proposés parmi les réponses (N2 et N3).
   * L'explication dit pourquoi ce n'est pas eux.
   */
  near?: PatternName[];
  /** La situation décrit un défaut, et la réponse est le pattern qui manque. */
  violated?: boolean;
  why: string;
}

export const situations: Situation[] = [
  // ── Niveau 1 : la définition, presque mot pour mot ─────────────────────────

  { id: 'pdf-prefixe-lecture', level: 1, answer: 'Least Privilege',
    text: 'Le service PDF n’a accès qu’au préfixe pdf/ du bucket des factures, en lecture seule.',
    why: 'Juste les droits nécessaires à sa tâche : compromis, le service ne lit rien d’autre et n’écrit nulle part.' },
  { id: 'profil-nom-langue', level: 1, answer: 'Least Information',
    text: 'L’API de profil ne renvoie que le nom et la langue, alors que l’appelant n’a besoin de rien d’autre.',
    why: 'Ne fournir que l’information nécessaire réduit ce qui peut fuir — Kohnfelder l’appelle l’équivalent de Least Privilege pour les données privées.' },
  { id: 'tenant-mfa-defaut', level: 1, answer: 'Secure by Default',
    text: 'Un nouveau tenant démarre avec la MFA obligatoire pour ses administrateurs.',
    why: 'La configuration initiale est la plus sûre ; l’assouplir demande une action explicite. L’inaction de l’opérateur ne crée aucun risque.' },
  { id: 'factures-uuid', level: 1, answer: 'Avoid Predictability',
    text: 'Les identifiants de factures sont des UUID aléatoires plutôt que des numéros séquentiels.',
    why: 'Ce qui est prévisible ne reste pas privé : un numéro séquentiel révèle le volume d’activité et invite à parcourir les objets voisins.' },
  { id: 'authz-panne-403', level: 1, answer: 'Fail Securely',
    text: 'Si le service d’autorisation ne répond pas, l’API refuse la requête.',
    why: 'En cas de doute ou de panne, on finit dans un état sûr : le refus. Le chemin d’erreur est le moins testé, et l’attaquant sait le provoquer.' },
  { id: 'repository-unique', level: 1, answer: 'Complete Mediation',
    text: 'Toutes les lectures de factures passent par un seul repository qui vérifie le tenant.',
    why: 'Un seul point de passage vérifié vers la ressource : c’est le « goulot » que Kohnfelder range au plus haut niveau de conformité.' },
  { id: 'remboursement-deux-admins', level: 1, answer: 'Separation of Privilege',
    text: 'Un remboursement de plus de 5 000 € doit être validé par un second administrateur.',
    why: 'Une action critique exige deux parties : une erreur ou une malveillance isolée ne suffit plus.' },
  { id: 'csp-et-react', level: 1, answer: 'Defense in Depth',
    text: 'Une CSP stricte s’ajoute à l’échappement automatique de React.',
    why: 'Deux couches indépendantes, de nature différente : si l’une cède, l’autre tient.' },
  { id: 'webhooks-signes', level: 1, answer: 'Reluctance to Trust',
    text: 'Les webhooks entrants sont refusés s’ils ne sont pas signés et horodatés.',
    why: 'La confiance est un choix explicite, fondé sur une preuve : ici la signature, et l’horodatage contre le rejeu.' },
  { id: 'cors-liste', level: 1, answer: 'Allowlists over Blocklists',
    text: 'Les origines autorisées par CORS sont listées explicitement.',
    why: 'Lister ce qui est permis plutôt que ce qui est interdit : un oubli refuse une origine légitime, il n’en ouvre pas une dangereuse.' },
  { id: 'cle-par-tenant', level: 1, answer: 'Least Common Mechanism',
    text: 'Chaque tenant a sa propre clé de chiffrement de données, plutôt qu’une clé commune à tous.',
    why: 'Moins de mécanismes partagés entre utilisateurs indépendants, moins d’occasions qu’une erreur sur l’un touche les autres.' },
  { id: 'assistant-compte-service', level: 1, answer: 'Confused Deputy',
    text: 'L’assistant IA exécute les actions avec son compte de service, quel que soit l’utilisateur qui les demande.',
    why: 'Un composant privilégié agit pour un demandeur qui l’est moins, sans porter ses droits : il suffit de le convaincre pour dépasser les siens.' },
  { id: 'export-pdf-abandonne', level: 1, answer: 'Unpatchable Components',
    text: 'L’export PDF dépend d’une bibliothèque dont le dernier commit date d’il y a quatre ans.',
    why: 'Un composant qu’on ne peut plus corriger devient une dette permanente : la prochaine faille publiée n’aura pas de correctif.' },
  { id: 'acces-astreinte-temporaire', level: 1, answer: 'Least Privilege',
    text: 'Les ingénieurs d’astreinte n’ont aucun droit en production ; pendant un incident, ils obtiennent un accès d’une heure, tracé.',
    why: 'Kohnfelder insiste sur la durée autant que sur l’étendue : le privilège élevé ne s’utilise que le temps strictement nécessaire, comme sudo.' },
  { id: 'logo-malforme', level: 1, answer: 'Fail Securely',
    text: 'Un logo téléversé qui n’est pas une image valide est supprimé du stockage aussitôt, et la requête entière est refusée.',
    why: 'C’est l’exemple même du livre : une image malformée est souvent un vecteur d’attaque, et l’erreur doit se conclure par un rejet complet, pas par un fichier à moitié accepté.' },
  { id: 'prix-relu-serveur', level: 1, answer: 'Reluctance to Trust',
    text: 'Le prix unitaire envoyé par le navigateur est ignoré : le serveur le relit dans le catalogue.',
    why: 'Le client n’a aucune obligation de renvoyer ce qu’on lui a donné — c’est l’exemple des cookies chez Kohnfelder. Une valeur qui revient du navigateur se revérifie.' },
  { id: 'checkm8', level: 1, answer: 'Unpatchable Components',
    text: 'En 2019, la faille checkm8 touche le code de démarrage gravé en mémoire morte des iPhone équipés des puces A5 à A11 : aucune mise à jour logicielle ne peut la corriger.',
    why: 'Du code en ROM est l’exemple extrême : la correction exige une nouvelle révision de la puce, et les appareils déjà vendus restent vulnérables à vie. Kohnfelder cite le matériel à logiciel préinstallé comme première famille de composants non corrigeables.' },

  // ── Niveau 2 : un effet, une violation, un voisin plausible ───────────────

  { id: 'console-url-cachee', violated: true, level: 2, answer: 'Transparent Design', near: ['Avoid Predictability'],
    text: 'La sécurité de la console d’administration repose sur le fait que son URL n’est documentée nulle part.',
    why: 'Pattern violé : une protection forte ne repose jamais sur le secret de la conception, et l’anti-pattern s’appelle sécurité par l’obscurité. Avoid Predictability parle de valeurs devinables ; ici, rien n’est deviné, on compte sur le silence.' },
  { id: 'runner-ci-externe', level: 2, answer: 'Backflow of Trust', near: ['Confused Deputy'],
    text: 'Le runner CI des pull requests externes possède les identifiants de déploiement en production.',
    why: 'Un composant peu fiable — du code non relu, venu de n’importe qui — contrôle un composant très fiable. Ce n’est pas un Confused Deputy : personne ne trompe le runner, c’est la structure même qui lui confie la production.' },
  { id: 'widget-chat-paiement', level: 2, answer: 'Third-Party Hooks', near: ['Reluctance to Trust'],
    text: 'Un widget de chat tiers est chargé directement dans la page de paiement.',
    why: 'Un tiers dispose d’un accès direct au cœur du système : son script lit tout ce que la page affiche et saisit. Reluctance to Trust est violé aussi, mais le livre nomme précisément cette forme de confiance mal placée.' },
  { id: 'grand-livre-verifie', level: 2, answer: 'Accept Security Responsibility', near: ['Reluctance to Trust'],
    text: 'Le service interne de grand livre vérifie lui-même l’autorisation, sans supposer que l’API publique l’a fait.',
    why: 'Chaque composant assume sa part : c’est la réponse à « je pensais que tu gérais la sécurité ». Reluctance to Trust porte sur la preuve qu’on exige d’une entrée ; ici, la question est qui prend en charge le contrôle.' },
  { id: 'trois-roles-partage', level: 2, answer: 'Economy of Design', near: ['Least Privilege'],
    text: 'Des ACL par facture auraient couvert tous les cas imaginables ; l’équipe retient trois rôles et un partage explicite, que chacun comprend en revue.',
    why: 'La complexité ne s’accepte que si elle rapporte : c’est la comparaison de Kohnfelder entre permissions Unix et ACL Windows. Least Privilege pousserait plutôt vers la granularité fine — et le livre prévient justement contre cet excès.' },
  { id: 'bucket-blocage-public', level: 2, answer: 'Secure by Default', near: ['Least Privilege'],
    text: 'Un nouveau bucket d’export est créé avec le blocage de l’accès public activé ; l’ouvrir exige une modification explicite.',
    why: 'L’état initial est sûr sans que personne n’agisse. Least Privilege porte sur les droits qu’on accorde à un composant pour sa tâche ; ici, c’est le point de départ qu’on protège de l’oubli.' },
  { id: 'concurrent-comptes-essai', level: 2, answer: 'Avoid Predictability', near: ['Least Information'], avoid: ['factures-uuid'],
    text: 'Chaque lundi, un concurrent crée un compte d’essai et note l’identifiant qu’il reçoit : 18 412, puis 18 530, puis 18 671.',
    why: 'L’exemple de Kohnfelder : un identifiant séquentiel donne à qui crée un compte jetable le rythme d’inscription de l’entreprise. Least Information ne s’applique pas — personne n’envoie de donnée privée, c’est la prévisibilité de la valeur qui la trahit.' },
  { id: 'antivirus-delai', violated: true, level: 2, answer: 'Fail Securely', near: ['Defense in Depth'],
    text: 'Quand l’analyse antivirus d’une pièce jointe dépasse son délai, le fichier est quand même publié, avec la mention « non analysé ».',
    why: 'Pattern violé : l’erreur — ici un délai dépassé — se conclut dans l’état ouvert. L’antivirus est bien une couche de défense, mais le défaut n’est pas le nombre de couches, c’est ce qui se passe quand l’une d’elles échoue.' },
  { id: 'redis-cle-sans-tenant', violated: true, level: 2, answer: 'Least Common Mechanism', near: ['Complete Mediation'],
    text: 'Le cache Redis construit ses clés avec le seul numéro de facture ; deux tenants ont chacun une facture 2026-0042.',
    why: 'Pattern violé : le cache est le bureau du comptable de Kohnfelder, où traînent les dossiers de tous les clients. Le contrôle d’accès a bien eu lieu sur la base ; c’est le mécanisme partagé qui relie ensuite deux tenants.' },
  { id: 'rls-en-plus', level: 2, answer: 'Defense in Depth', near: ['Complete Mediation'],
    text: 'Le code filtre chaque requête par tenant, et la sécurité au niveau des lignes de PostgreSQL rejette de toute façon les lignes d’un autre tenant.',
    why: 'Deux mécanismes indépendants — l’un dans l’application, l’autre dans la base — pour la même décision critique. Complete Mediation demande que tous les chemins passent par le même contrôle ; ici, il y a deux contrôles différents sur un même chemin.' },
  { id: 'upload-liste-noire', violated: true, level: 2, answer: 'Allowlists over Blocklists', near: ['Reluctance to Trust'],
    text: 'Le filtre de téléversement refuse les extensions .exe, .bat et .js ; un client dépose un logo .svg qui contient du script.',
    why: 'Pattern violé : chaque omission d’une liste noire est une faille, et le SVG en était une. Le filtre témoigne bien d’une méfiance envers le fichier ; c’est sa forme, énumérer le mal, qui a échoué.' },
  { id: 'event-stream', violated: true, level: 2, answer: 'Reluctance to Trust', near: ['Third-Party Hooks'],
    text: 'En 2018, le mainteneur du paquet npm event-stream cède la publication à un contributeur récent qui le lui demande ; une nouvelle dépendance, flatmap-stream, embarque un code qui vise les portefeuilles Bitcoin Copay.',
    why: 'Pattern violé : la confiance a été accordée sur quelques contributions et une demande, pas sur une preuve. Third-Party Hooks décrit un accès que la conception réserve à un tiers ; ici, aucune conception ne l’avait prévu, c’est une décision de confiance qui a mal tourné.' },
  { id: 'contrat-interface', level: 2, answer: 'Accept Security Responsibility', near: ['Defense in Depth'], avoid: ['grand-livre-verifie'],
    text: 'Le contrat d’interface entre l’API publique et le service de facturation écrit qui valide les montants, et ce que chaque côté garantit à l’autre.',
    why: 'Kohnfelder recommande exactement cet accord explicite, pour que personne ne suppose que l’autre s’en charge. Defense in Depth serait une validation des deux côtés — le livre la propose en complément, mais la situation décrit le partage des responsabilités, pas le doublement.' },
  { id: 'revue-par-un-autre', level: 2, answer: 'Separation of Privilege', near: ['Least Privilege'],
    text: 'La branche principale exige l’approbation d’une autre personne que l’auteur : personne ne fusionne seul son propre code.',
    why: 'Deux parties pour une action critique. L’auteur garde tous ses droits d’écriture — Least Privilege n’a rien retiré ; c’est l’action qui demande désormais deux personnes.' },
  { id: 'iban-quatre-derniers', level: 2, answer: 'Least Information', near: ['Least Privilege'],
    text: 'L’écran du support n’affiche que les quatre derniers caractères de l’IBAN ; le reste n’apparaît que sur demande explicite, tracée.',
    why: 'Afficher un sous-ensemble jusqu’à ce que l’utilisateur demande le détail : c’est un exemple du livre. Les droits de l’agent n’ont pas changé — il peut voir l’IBAN — donc ce n’est pas Least Privilege ; c’est la quantité d’information exposée qui baisse.' },
  { id: 'editeur-tunnel-vpn', level: 2, answer: 'Third-Party Hooks', near: ['Backflow of Trust'], avoid: ['widget-chat-paiement'],
    text: 'L’éditeur du module de rapprochement bancaire exige un tunnel VPN permanent vers la production pour le maintenir lui-même.',
    why: 'C’est l’exemple de Kohnfelder : un accès direct au cœur du système, hors du regard des administrateurs. Il présente lui-même ce cas comme une forme de Backflow of Trust ; le nom précis, quand la partie peu maîtrisée est un tiers, est Third-Party Hooks.' },
  { id: 'binaire-tva-editeur-ferme', level: 2, answer: 'Unpatchable Components', near: ['Third-Party Hooks'], avoid: ['export-pdf-abandonne'],
    text: 'Le calcul de TVA intracommunautaire repose sur un binaire fourni par un éditeur qui a cessé son activité ; le code source n’a jamais été livré.',
    why: 'Logiciel livré en binaire seul, éditeur disparu : deux cas que le livre range parmi les composants non corrigeables. Le tiers n’a plus aucun accès à Novafact, donc pas de Third-Party Hooks ; le problème est que personne ne peut plus corriger ce code.' },
  { id: 'export-chemin-client', level: 2, answer: 'Confused Deputy', near: ['Least Privilege'],
    text: 'Le service d’export dépose le fichier au chemin S3 que le client indique, avec ses propres droits sur tout le bucket ; un client indique le préfixe d’un autre tenant.',
    why: 'Le client dirige l’autorité du service vers ses propres fins : c’est le shérif qui arrête le mauvais homme. Réduire les droits du service limiterait les dégâts, mais le défaut est ailleurs — le contexte du demandeur s’est perdu avant l’écriture.' },
  { id: 'console-poste-perso', level: 2, answer: 'Backflow of Trust', near: ['Least Privilege'], avoid: ['runner-ci-externe'],
    text: 'Un administrateur se connecte à la console AWS de production depuis son ordinateur personnel, hors de la flotte gérée.',
    why: 'L’exemple même du livre : la personne est digne de confiance, sa machine ne l’est pas, et c’est elle qui pilote la production. Ses droits sont peut-être minimaux ; ce qui compte ici est le niveau de confiance du composant qui les exerce.' },
  { id: 'mongodb-2017', violated: true, level: 2, answer: 'Secure by Default', near: ['Accept Security Responsibility'],
    text: 'Début 2017, des dizaines de milliers de bases MongoDB exposées sur internet sont vidées et rançonnées. Les versions antérieures à 2.6 écoutaient sur toutes les interfaces, sans authentification, dès l’installation.',
    why: 'Pattern violé : l’inaction de l’opérateur suffisait à exposer la base. Accept Security Responsibility est proche — l’éditeur laissait l’opérateur porter le risque — mais le défaut précis, corrigé depuis par une écoute locale par défaut, est la configuration de départ.' },

  // ── Niveau 3 : deux voisins défendables, un détail tranche ────────────────

  { id: 'comptable-mandat-sepa', violated: true, level: 3, answer: 'Complete Mediation', near: ['Least Information'],
    text: 'Le rôle « comptable junior » ne voit pas les IBAN dans la fiche client, mais peut régénérer le mandat SEPA en PDF, qui les contient.',
    why: 'La politique existe et l’écran l’applique ; un second chemin vers la même donnée l’ignore. C’est l’exemple du formulaire fiscal de Kohnfelder. Least Information est tentant parce que le PDF en montre trop, mais le défaut est l’incohérence entre deux chemins d’accès.' },
  { id: 'sauvegarde-double-cle', level: 3, answer: 'Separation of Privilege', near: ['Defense in Depth'],
    text: 'Les sauvegardes sont chiffrées deux fois, avec deux clés confiées à deux équipes différentes : il faut les deux pour restaurer.',
    why: 'Deux couches de chiffrement ressemblent à Defense in Depth, mais ce qui compte est qui tient les clés : aucune équipe seule ne peut lire la sauvegarde. Kohnfelder donne exactement cet exemple pour Separation of Privilege.' },
  { id: 'audit-compte-securite', level: 3, answer: 'Separation of Privilege', near: ['Least Privilege'], avoid: ['sauvegarde-double-cle'],
    text: 'Les journaux d’audit sont écrits dans un compte AWS administré par l’équipe sécurité, où les administrateurs de production n’ont aucun droit.',
    why: 'Le livre applique ce pattern aux journaux d’audit : ceux qui agissent ne sont pas ceux qui enregistrent. Least Privilege se défend — les administrateurs n’ont rien dans ce compte — mais le but n’est pas de réduire leurs droits pour leur tâche, c’est que la trace dépende d’une autre partie.' },
  { id: 'etes-vous-sur-mfa', violated: true, level: 3, answer: 'Accept Security Responsibility', near: ['Secure by Default'],
    text: 'Pour désactiver la MFA d’un tenant, l’interface affiche « Êtes-vous sûr ? » et un lien « En savoir plus ».',
    why: 'Pattern violé : Kohnfelder consacre un encadré à ces boîtes de dialogue, qui transfèrent la responsabilité à un utilisateur qui n’a pas les moyens de juger. Le défaut n’est pas l’état par défaut — la MFA est active — mais la façon dont le concepteur se défausse au moment de la désactiver.' },
  { id: 'sdk-verify-optionnel', violated: true, level: 3, answer: 'Secure by Default', near: ['Reluctance to Trust'],
    text: 'Le SDK Novafact ne vérifie la signature des webhooks que si l’intégrateur passe l’option verify: true.',
    why: 'Pattern violé : la vérification existe, et c’est bien de la méfiance — mais elle est désactivée quand on ne dit rien. Le livre étend Secure by Default aux paramètres d’API omis : leur valeur doit être la plus sûre.' },
  { id: 'cors-fichier-illisible', level: 3, answer: 'Fail Securely', near: ['Secure by Default'],
    text: 'Si le fichier des origines CORS est illisible au démarrage, l’API démarre sans aucune origine autorisée plutôt qu’avec « * ».',
    why: 'Secure by Default décrit l’état initial quand personne n’a rien configuré ; ici, quelqu’un a configuré, et c’est une erreur qui survient. Finir dans l’état fermé quand un problème se produit, c’est Fail Securely.' },
  { id: 'waf-et-requetes', level: 3, answer: 'Defense in Depth', near: ['Allowlists over Blocklists'],
    text: 'Le pare-feu applicatif bloque les motifs d’injection SQL connus, et toutes les requêtes restent paramétrées dans le code.',
    why: 'Les règles du pare-feu forment bien une liste noire, fragile à elle seule. Mais la situation décrit deux mécanismes de nature différente pour une même décision — un filtre réseau et une requête qui ne peut pas être injectée — soit l’analyseur et l’interpréteur du bac à sable de Kohnfelder.' },
  { id: 'ip-dans-en-tete', violated: true, level: 3, answer: 'Reluctance to Trust', near: ['Allowlists over Blocklists'],
    text: 'Un webhook de la banque est accepté si l’en-tête X-Forwarded-For contient une adresse de la liste publiée par la banque ; aucune signature n’est vérifiée.',
    why: 'Pattern violé. Il y a bien une liste blanche, et c’est le piège : ce qu’elle filtre est un en-tête que l’expéditeur écrit lui-même. La confiance doit reposer sur une preuve solide, et seule la signature en est une.' },
  { id: 'second-systeme-authz', level: 3, answer: 'Economy of Design', near: ['Defense in Depth'],
    text: 'L’équipe renonce à un second moteur d’autorisation maison, dont les règles recoupaient à moitié celles du premier, et durcit l’unique middleware existant.',
    why: 'Defense in Depth exige des couches indépendantes ; deux moteurs aux règles à moitié identiques partagent leurs bugs et doublent le coût de chaque changement. Préférer le mécanisme le plus simple quand la complexité ne rapporte rien, c’est Economy of Design.' },
  { id: 'mifare-crypto1', violated: true, level: 3, answer: 'Transparent Design', near: ['Avoid Predictability'],
    text: 'La carte sans contact MIFARE Classic reposait sur Crypto-1, un algorithme de chiffrement propriétaire jamais publié. Entre fin 2007 et 2008, des chercheurs le reconstituent à partir de la puce et le cassent.',
    why: 'Pattern violé : la sécurité tenait au secret de la conception, et le secret a cédé à l’analyse du silicium. Le générateur pseudo-aléatoire de la carte était bien faible, ce qui évoque Avoid Predictability, mais c’est justement ce qu’une publication aurait révélé des années plus tôt.' },
  { id: 'format-jetons-secret', violated: true, level: 3, answer: 'Transparent Design', near: ['Avoid Predictability'], avoid: ['mifare-crypto1', 'console-url-cachee'],
    text: 'L’équipe refuse de documenter le format de ses jetons d’API, de peur qu’un attaquant apprenne à en forger.',
    why: 'Si connaître le format suffit à forger un jeton, c’est la conception qu’il faut corriger : des jetons aléatoires ou signés se publient sans risque. Avoid Predictability décrit ce correctif ; la situation, elle, décrit le réflexe de cacher plutôt que de corriger.' },
  { id: 'lien-invitation-base64', violated: true, level: 3, answer: 'Avoid Predictability', near: ['Least Information'],
    text: 'Le lien d’invitation d’un collaborateur est l’e-mail de l’invité encodé en base64, suivi de la date du jour.',
    why: 'Le lien révèle l’e-mail, ce qui évoque Least Information, mais le défaut grave est ailleurs : quiconque connaît l’adresse et la date fabrique le lien. Kohnfelder range les identifiants construits à partir de données personnelles sous Avoid Predictability.' },
  { id: 'first-american-2019', violated: true, level: 3, answer: 'Avoid Predictability', near: ['Complete Mediation'], avoid: ['concurrent-comptes-essai'],
    text: 'En 2019, First American Financial envoie à ses clients des liens vers leurs documents immobiliers ; en modifiant un chiffre du numéro dans l’URL, on lisait ceux des autres — environ 885 millions de fichiers.',
    why: 'Le lien envoyé par courriel était la seule autorisation : un secret, qui ne l’est plus dès qu’il se devine. On peut objecter qu’il manquait un contrôle d’accès, mais la conception reposait sur l’imprévisibilité du lien ; un numéro séquentiel l’a rendue nulle.' },
  { id: 'relance-lignes-entieres', violated: true, level: 3, answer: 'Least Information', near: ['Least Privilege'],
    text: 'Le service de relance lit la table des clients avec un rôle limité à la lecture ; il récupère les lignes entières alors qu’il n’envoie que le nom et l’e-mail.',
    why: 'Pattern violé. Le rôle en lecture seule est un leurre : les droits sont justes, c’est l’information qui circule en trop. Chaque champ inutile qui transite élargit la surface d’une fuite, dans le service, ses journaux et ses traces.' },
  { id: 'role-par-lambda', level: 3, answer: 'Least Privilege', near: ['Least Common Mechanism'],
    text: 'Chaque Lambda reçoit son propre rôle IAM, limité à ce qu’elle fait, au lieu d’un rôle commun qui cumulait les droits des douze fonctions.',
    why: 'Un rôle commun est bien un mécanisme partagé, d’où la tentation. Mais le risque décrit est la somme des droits — chaque fonction compromise disposait de tout — et non un canal entre utilisateurs indépendants. C’est Least Privilege.' },
  { id: 'chromium-par-rendu', level: 3, answer: 'Least Common Mechanism', near: ['Least Privilege'], avoid: ['role-par-lambda'],
    text: 'Le rendu des factures utilisait un seul processus Chromium pour tous les tenants ; chaque rendu a désormais son propre processus, jeté à la fin.',
    why: 'Les droits du processus n’ont pas changé, donc ce n’est pas Least Privilege. Ce qui disparaît est l’état partagé — cache, fichiers temporaires, session — qui pouvait faire passer quelque chose d’un tenant à l’autre.' },
  { id: 'chatgpt-redis-2023', level: 3, answer: 'Least Common Mechanism', near: ['Fail Securely'], avoid: ['redis-cle-sans-tenant'],
    text: 'En mars 2023, un bug de la bibliothèque redis-py fait voir à des utilisateurs de ChatGPT les titres de conversations d’autres utilisateurs, et à certains abonnés les coordonnées de paiement d’autres abonnés.',
    why: 'Le déclencheur était bien une erreur mal gérée — une requête annulée laissait une connexion corrompue —, ce qui évoque Fail Securely. Mais la fuite n’existe que parce que des utilisateurs indépendants partageaient le même pool de connexions et le même cache : c’est le mécanisme commun qui les a reliés.' },
  { id: 'journal-retour-ligne', level: 3, answer: 'Confused Deputy', near: ['Reluctance to Trust'],
    text: 'Le motif de rejet saisi par un client est écrit tel quel dans le journal d’audit ; un retour à la ligne y fabrique une fausse entrée.',
    why: 'Le client n’a aucun accès au journal, mais il fait écrire le service à sa place : il utilise le privilège du délégué. Kohnfelder donne cet exemple d’effet de bord pour le Confused Deputy. Le manque de méfiance envers l’entrée explique comment, pas ce qui est détourné.' },
  { id: 'echoleak-2025', level: 3, answer: 'Confused Deputy', near: ['Backflow of Trust'], avoid: ['assistant-compte-service'],
    text: 'En 2025, la faille EchoLeak (CVE-2025-32711) : un simple e-mail aux instructions déguisées amène Microsoft 365 Copilot à lire des fichiers internes et à en envoyer le contenu vers un serveur de l’attaquant.',
    why: 'L’assistant agit avec l’accès de l’utilisateur, et l’auteur de l’e-mail détourne cette autorité : c’est un délégué trompé. Backflow of Trust décrit un composant peu fiable qui en pilote un fiable par construction ; un e-mail n’est pas un composant, c’est la requête d’un tiers qui a su parler au délégué.' },
  { id: 'capital-one-2019', violated: true, level: 3, answer: 'Least Privilege', near: ['Confused Deputy'],
    text: 'En 2019, chez Capital One, une requête forgée amène le pare-feu applicatif à interroger le service de métadonnées d’EC2. Avec les identifiants de son rôle, l’attaquante copie plus de 700 dossiers S3 : les demandes de crédit de plus de cent millions de personnes.',
    why: 'L’entrée est un SSRF, c’est-à-dire un délégué trompé, et c’est tentant. Mais ce qui a changé une faille de configuration en fuite massive est un rôle dont les droits sur S3 dépassaient de loin la tâche d’un pare-feu. Le détail qui tranche est l’ampleur de ce que les identifiants ouvraient.' },
  { id: 'bucket-config-preview', level: 3, answer: 'Backflow of Trust', near: ['Least Common Mechanism'],
    text: 'L’API de production lit sa configuration dans un bucket où le pipeline des environnements de preview, lancé sur chaque branche, peut aussi écrire.',
    why: 'Le bucket est partagé, d’où Least Common Mechanism ; mais ce pattern parle d’isoler des pairs indépendants. Ici, il y a un sens : n’importe quelle branche, de faible confiance, pilote la production. C’est un Backflow of Trust.' },
  { id: 'signature-jeton-admin', level: 3, answer: 'Third-Party Hooks', near: ['Least Privilege'], avoid: ['editeur-tunnel-vpn'],
    text: 'Pour « simplifier l’intégration », le prestataire de signature électronique reçoit un jeton administrateur qui lui permet d’appeler n’importe quelle route de l’API.',
    why: 'Le jeton est trop large, et Least Privilege est violé. Mais la situation a un nom plus précis : un point d’entrée taillé pour un tiers, qui lui donne un accès direct au cœur du système, hors du contrôle des administrateurs. S’il est compromis, rien ne le distingue de Novafact.' },
  { id: 'codecov-2021', level: 3, answer: 'Third-Party Hooks', near: ['Reluctance to Trust'], avoid: ['widget-chat-paiement', 'signature-jeton-admin'],
    text: 'En 2021, le script d’envoi de Codecov, téléchargé et exécuté à chaque build par ses clients, est modifié : pendant deux mois, il envoie les variables d’environnement de leurs CI vers un serveur tiers.',
    why: 'Vérifier l’empreinte du script, c’est ce qu’a fait le client qui a découvert l’attaque — Reluctance to Trust. Mais la conception elle-même donnait à un tiers la main sur un environnement qui contient les secrets de déploiement : c’est le crochet qui a été détourné.' },
  { id: 'qr-sans-mainteneur', level: 3, answer: 'Unpatchable Components', near: ['Third-Party Hooks'], avoid: ['export-pdf-abandonne', 'binaire-tva-editeur-ferme'],
    text: 'La bibliothèque de QR codes des factures n’a plus de mainteneur depuis trois ans, et son compte npm pourrait être repris par n’importe qui.',
    why: 'La reprise possible du compte fait penser à un tiers qui mettrait la main sur le code. Mais la situation décrit d’abord un composant que personne ne corrigera : la prochaine faille restera ouverte, et un paquet abandonné devient même un point d’entrée.' },
];

// ── Voisins ─────────────────────────────────────────────────────────────────

/**
 * Les couples de patterns qu'on confond, déduits des `near` du pool. Au
 * niveau 1, aucun voisin de la bonne réponse n'est tiré parmi les
 * distracteurs : une réponse défendable que l'explication ne traite pas
 * ruinerait la manche. Aux niveaux 2 et 3, seuls les voisins déclarés
 * apparaissent.
 */
export const kin: Record<string, PatternName[]> = (() => {
  const out: Record<string, Set<PatternName>> = {};
  const link = (a: PatternName, b: PatternName) => { (out[a] ??= new Set()).add(b); };
  situations.forEach((s) => (s.near ?? []).forEach((n) => { link(s.answer, n); link(n, s.answer); }));
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, [...v]]));
})();

// ── Les séries ──────────────────────────────────────────────────────────────

const mix = (n1: number, n2: number, n3: number): [number, number, number] => [n1, n2, n3];
const isAnti = (s: Situation) => antiPatterns.includes(s.answer);
const isViolation = (s: Situation) => Boolean(s.violated);

const PROFILES: SeriesProfile<Situation>[] = [
  { id: 'premiers-reperes', title: 'Premiers repères', mix: mix(8, 0, 0), level: 1,
    text: 'La situation dit presque la définition, et aucun voisin du bon pattern n’est proposé. On apprend les noms.' },
  { id: 'mise-en-jambe', title: 'Mise en jambe', mix: mix(5, 3, 0), level: 1,
    text: 'Trois situations décrivent un effet plutôt qu’un mécanisme, avec un voisin plausible parmi les réponses.' },
  { id: 'voisins', title: 'Les voisins', mix: mix(2, 6, 0), level: 2,
    text: 'Un pattern proche est presque toujours proposé : juste sur un mot-clé, faux pour une raison qu’il faut nommer.' },
  { id: 'anti-patterns', title: 'Les quatre anti-patterns', filter: isAnti, mix: mix(1, 4, 3), level: 2,
    text: 'Confused Deputy, Backflow of Trust, Third-Party Hooks, Unpatchable Components : les distinguer entre eux, et d’un pattern violé.' },
  { id: 'ce-qui-manque', title: 'Ce qui manque', filter: isViolation, mix: mix(0, 4, 4), level: 3,
    text: 'Chaque situation décrit un défaut : il faut nommer le pattern absent, sans anti-pattern pour servir de raccourci.' },
  { id: 'deux-lectures', title: 'Deux lectures', mix: mix(0, 3, 5), level: 3,
    text: 'Deux patterns se défendent, un seul décrit la situation. Le détail qui tranche est dans le texte.' },
  { id: 'expert', title: 'Expert', mix: mix(0, 0, 8), level: 3,
    text: 'Huit situations de niveau 3, dont plusieurs incidents réels. La lecture évidente est souvent le piège.' },
  { id: 'melee', title: 'Mêlée', mix: mix(3, 3, 2), level: 2, shuffleEachTime: true,
    text: 'Tous niveaux confondus, recomposée à chaque partie. C’est la seule série qu’on ne peut pas réviser.' },
];

export const patternSeries = defineSeries(situations, PROFILES);

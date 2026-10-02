// Diagnostic d'entrée et de sortie de chaque module.
//
// Le MÊME questionnaire est proposé avant d'ouvrir la première leçon et après
// avoir validé la dernière. L'intérêt n'est pas la note : c'est l'écart entre
// les deux passages, qui dit ce que le module a réellement changé. D'où trois
// règles d'écriture :
//
//   · **les questions portent sur le jugement, pas sur le vocabulaire.** Une
//     définition s'apprend en relisant la question ; un arbitrage, non ;
//
//   · **aucune n'est devinable sans le module**, et aucune n'est hors de portée
//     après lui. Une question que tout le monde rate deux fois ne mesure rien,
//     une question que tout le monde réussit d'emblée non plus ;
//
//   · **les distracteurs sont des erreurs que les gens commettent vraiment**,
//     de longueur comparable à la bonne réponse. `npm run quiz` le vérifie.
//
// Aucune XP n'est attribuée : récompenser le diagnostic d'entrée pousserait à y
// répondre au mieux avant d'avoir rien lu, et l'écart ne voudrait plus rien dire.

export interface CheckpointQuestion {
  q: string;
  options: string[];
  answer: number;
  explain: string;
}

export const checkpoints: Record<string, CheckpointQuestion[]> = {
  m21: [
    {
      q: 'Un rapport annuel classe le phishing en tête des vecteurs d’accès, un autre l’exploitation de vulnérabilités. Que faut-il faire avant de citer l’un ou l’autre en comité ?',
      options: [
        'Comparer période, échantillon et unité : les deux mesurent des populations différentes',
        'Retenir le rapport le plus récent, puisque la menace évolue d’une année à l’autre',
        'Faire la moyenne des deux pour obtenir une estimation plus robuste',
        'Retenir le rapport public plutôt que celui d’un éditeur, qui est commercialement biaisé',
      ],
      answer: 0,
      explain: 'Un écart entre rapports s’explique d’abord par la méthode : violations confirmées, intrusions investiguées par un prestataire ou incidents publics ne sont pas les mêmes populations. Moyenner deux pourcentages de bases différentes n’a aucun sens, la date de parution ne dit rien de la représentativité, et un rapport public a lui aussi ses biais, comme celui de déclaration.',
    },
    {
      q: 'Les rapports estiment que l’exploitation précède souvent la disponibilité du correctif. Quelle priorité en tirer pour l’AppSec d’un SaaS ?',
      options: [
        'Réduire la surface exposée et éliminer des classes de bugs en amont',
        'Raccourcir le délai de correction des critiques à vingt-quatre heures',
        'Placer un WAF en mode bloquant devant toutes les routes publiques',
        'Souscrire à un flux de renseignement pour connaître les exploits plus tôt',
      ],
      answer: 0,
      explain: 'Si l’exploit arrive avant le correctif, aucun délai de correction ne couvre la fenêtre : il faut que la faille soit inatteignable ou qu’elle n’existe pas. Un WAF filtre des formes connues et se contourne, comme l’a montré Log4Shell. Le renseignement accélère la réaction mais ne supprime pas la fenêtre. Ces mesures restent utiles, en seconde ligne.',
    },
    {
      q: 'Un attaquant appelle le support en se faisant passer pour un client et obtient la réinitialisation de sa MFA. Où se trouve d’abord le défaut ?',
      options: [
        'Dans le parcours de réinitialisation, qui repose sur ce que l’appelant peut savoir',
        'Dans la formation du support, qui aurait dû repérer un appel suspect',
        'Dans le choix du facteur MFA, qui aurait dû être une clé matérielle',
        'Dans l’absence de détection, qui aurait dû alerter le SOC en temps réel',
      ],
      answer: 0,
      explain: 'Le vishing exploite un parcours applicatif : si une réinitialisation s’obtient avec des informations présentes sur une facture ou dans une fuite, la formation ne fait que retarder l’échec. Une clé matérielle ne protège rien si le support peut la retirer sur simple appel. La détection est un complément ; le correctif consiste à prévenir le vrai titulaire, retarder l’effet et exiger un second approbateur.',
    },
    {
      q: 'Après xz utils, une équipe veut s’assurer qu’une dépendance npm n’est pas piégée. Quelle vérification correspond à la leçon de l’affaire ?',
      options: [
        'Auditer l’archive publiée sur le registre, pas seulement le dépôt GitHub',
        'Vérifier que le dépôt GitHub du paquet a des commits signés',
        'Exiger un score OpenSSF élevé avant toute nouvelle dépendance',
        'Relire les différences de code entre deux tags du dépôt GitHub',
      ],
      answer: 0,
      explain: 'Dans xz utils, le déclencheur n’existait que dans les archives publiées : le dépôt Git était propre. Des commits signés, un bon score de maintenance ou une relecture des différences entre tags portent tous sur le dépôt, donc ne voient pas ce qui a été ajouté au moment de la publication. C’est l’artefact installé qu’il faut comparer et auditer.',
    },
    {
      q: 'Les mêmes classes de bugs reviennent d’un pentest à l’autre chez un éditeur. Selon l’analyse économique d’Anderson, quel levier a le plus de chances de changer la situation ?',
      options: [
        'Faire peser le coût d’un défaut sur ceux qui décident de la façon de construire',
        'Former tous les développeurs aux vulnérabilités les plus fréquentes',
        'Multiplier les pentests pour détecter les défauts plus tôt',
        'Acheter un outil de SAST plus complet que l’outil actuel',
      ],
      answer: 0,
      explain: 'Anderson montre que la protection suit la responsabilité : quand celui qui peut protéger ne paie pas l’échec, il n’investit pas. Rendre le coût visible et le faire porter par ceux qui décident change les arbitrages. La formation, les pentests et un meilleur SAST agissent sur la capacité ou la détection, pas sur l’incitation : les mêmes arbitrages produiront les mêmes défauts.',
    },
  ],

  m22: [
    {
      q: 'Une règle de détection écrite en 2024 signale la désactivation d’un journal d’audit cloud et l’associe à « TA0005 Defense Evasion ». Que faut-il faire en rechargeant ATT&CK v19 ?',
      options: [
        'La rattacher à Defense Impairment (TA0112) : TA0005 désigne désormais Stealth',
        'Ne rien changer : TA0005 reste un identifiant valide en v19, avec le même sens',
        'La supprimer : TA0005 a été révoquée et n’existe plus dans la version 19',
        'La rattacher à T1562.008, qui reste la technique de référence pour ce comportement',
      ],
      answer: 0,
      explain: 'En v19, Defense Evasion est scindée : TA0005 survit sous le nom Stealth (se fondre dans l’activité normale), et ce qui empêche les défenseurs de voir passe dans Defense Impairment (TA0112). L’identifiant ne casse pas, il change de sens sans bruit. T1562.008 a elle-même été révoquée au profit de T1685.002.',
    },
    {
      q: 'Un rapport décrit un acteur qui cible les éditeurs SaaS de facturation. Quelle traduction de ce rapport sert le plus durablement l’AppSec de Novafact ?',
      options: [
        'Ses comportements, traduits en techniques, avec la phrase source et la version d’ATT&CK',
        'Ses adresses IP et ses domaines, à bloquer dès aujourd’hui dans le WAF de production',
        'La technique parente de chaque action, plus stable d’une version d’ATT&CK à l’autre',
        'Le classement de ses techniques par fréquence d’apparition dans la matrice Enterprise',
      ],
      answer: 0,
      explain: 'Les indicateurs réseau sont périmés dès que l’acteur change d’infrastructure ; le comportement, lui, survit et pose une question de conception. Traduire est un jugement : garder la phrase source et la version permet à d’autres de vérifier. Remonter au parent perd la précision qui sert à détecter, et la fréquence dans la matrice entière ignore la pertinence pour un SaaS.',
    },
    {
      q: 'Pour protéger la création de webhooks contre une session volée par un proxy de phishing (AiTM), quelle mesure tient réellement ?',
      options: [
        'Une confirmation WebAuthn récente, liée à l’origine, juste avant la création',
        'Redemander le mot de passe de l’administrateur juste avant la création',
        'Exiger un code TOTP frais au moment de la création du webhook',
        'Envoyer un lien de confirmation à l’adresse e-mail de l’administrateur',
      ],
      answer: 0,
      explain: 'Le proxy AiTM voit passer le mot de passe et relaie un code TOTP en temps réel : redemander l’un ou l’autre ne prouve rien. La boîte mail de l’utilisateur est peut-être déjà sous le contrôle de l’attaquant, qui y pose une règle de masquage. Seule une preuve WebAuthn refuse de signer pour le domaine du proxy.',
    },
    {
      q: 'Dans ATT&CK v19, M1017 User Training et M1047 Audit sont reliées à plus de techniques SaaS que M1032 Multi-factor Authentication. Que déployer en premier sur les comptes d’administration ?',
      options: [
        'Une MFA résistante au phishing, avec les replis SMS et e-mail retirés',
        'La formation des utilisateurs, reliée au plus grand nombre de techniques',
        'La journalisation d’audit, mieux classée que la MFA dans le décompte',
        'Une MFA par SMS pour tous, la plus rapide à déployer à grande échelle',
      ],
      answer: 0,
      explain: 'Le nombre de relations « mitigates » mesure la largeur d’une mitigation, pas sa force : une clé FIDO2 rend la fatigue MFA et le proxy AiTM sans objet, là où la formation réduit seulement la probabilité d’erreur. L’audit aide à voir, pas à empêcher. Et laisser un repli SMS permet à l’attaquant de choisir le facteur le plus faible.',
    },
    {
      q: 'Un intégrateur tiers qui détient des jetons OAuth donnant accès aux comptes de clients de Novafact est compromis. Quelle capacité du produit compte le plus ?',
      options: [
        'Permettre au client de voir, restreindre et révoquer les jetons de chaque intégration',
        'Imposer une vérification MFA à chaque appel d’API effectué par l’intégration',
        'Réinitialiser les mots de passe de tous les utilisateurs des tenants touchés',
        'Exiger de l’intégrateur un rapport d’audit SOC 2 récent avant de le réactiver',
      ],
      answer: 0,
      explain: 'Un jeton délivré à une intégration représente un consentement déjà donné : aucune MFA ne s’applique aux appels d’API, et changer les mots de passe ne l’invalide pas. Le contrôle porte sur le cycle de vie du jeton (portée, durée, restrictions d’origine, révocation), comme l’a montré Salesloft Drift en août 2025. Un rapport d’audit du fournisseur n’arrête pas les jetons déjà volés.',
    },
  ],

  m01: [
    {
      q: 'Un rapport de pentest remonte une XSS sur le champ « notes ». Quel réflexe distingue un programme AppSec d’une simple correction ?',
      options: [
        'Corriger le champ, puis chercher les variantes du même défaut dans tout le code',
        'Corriger le champ et ajouter une règle WAF qui bloque les charges connues',
        'Corriger le champ et demander un nouveau pentest de vérification',
        'Corriger le champ et documenter la faille dans le registre des risques',
      ],
      answer: 0,
      explain: 'Un pentest voit une instance ; un programme cherche la classe. Les trois autres réponses traitent bien le finding et laissent les vingt occurrences que personne n’a regardées.',
    },
    {
      q: 'Un client envoie un questionnaire qui cite le NIST SSDF. Quel référentiel sert à écrire les exigences de l’API ?',
      options: [
        'Le Top 10 de l’OWASP, qui couvre les risques les plus répandus',
        'OWASP ASVS, dont les exigences sont numérotées et vérifiables',
        'OWASP SAMM, qui structure les pratiques en cinq fonctions',
        'Le NIST SSDF lui-même, pour rester aligné sur la demande du client',
      ],
      answer: 1,
      explain: 'Chaque référentiel répond à une question différente. SSDF sert à répondre au client, SAMM à piloter le programme, le Top 10 à sensibiliser — seul ASVS donne des exigences qu’on peut citer dans un ticket.',
    },
    {
      q: 'Le Gold Standard demande trois choses de chaque opération sensible. Laquelle oublie-t-on le plus ?',
      options: [
        'L’authentification, qui vérifie qui appelle',
        'L’autorisation, qui vérifie ce qu’il a le droit de faire',
        'L’audit, qui garde la trace de ce qui a été fait',
        'Le chiffrement, qui protège la donnée en transit',
      ],
      answer: 2,
      explain: 'C’est celle dont l’absence ne se voit jamais en test : tout fonctionne. Elle ne manque qu’au moment où l’on cherche à répondre à « qui a fait ça », et il est alors trop tard. Le chiffrement ne fait pas partie du Gold Standard.',
    },
    {
      q: 'Novafact intègre un widget de chat tiers chargé dans toutes les pages. Quelle question pose le principe de confiance ?',
      options: [
        'Ce que ce composant peut faire s’il se comporte mal, et comment réduire ce qu’il atteint',
        'Si l’éditeur du widget a obtenu une certification de sécurité reconnue sur son produit',
        'Si le widget a été analysé par le SAST de Novafact avant sa mise en production',
        'Si le contrat engage l’éditeur à notifier toute faille dans un délai court et défini',
      ],
      answer: 0,
      explain: 'Faire confiance, c’est accepter qu’un composant puisse nuire à l’application. La certification et le contrat déplacent la responsabilité sans réduire ce que le script peut faire dans la page, et le SAST ne voit pas un code chargé depuis un autre domaine. La bonne question porte sur le pouvoir réel du composant et sur la façon de le réduire.',
    },
    {
      q: 'Une équipe fait un pentest complet une semaine avant chaque mise en production. Que lui manque-t-il pour parler de cycle de développement sécurisé ?',
      options: [
        'Des activités de sécurité aux phases amont : risques, conception, exigences et revue du code',
        'Un second pentest, mené par un autre prestataire, pour croiser les résultats obtenus',
        'Un scanner DAST qui rejoue les tests du pentest à chaque déploiement en préproduction',
        'Une politique qui bloque la mise en production tant qu’un finding critique reste ouvert',
      ],
      answer: 0,
      explain: 'Un SSDLC répartit la sécurité sur tout le cycle : ce qu’on décide en conception coûte moins cher à corriger que ce qu’on découvre la semaine de la livraison. Doubler le pentest, l’automatiser ou en faire une porte améliore la vérification finale sans rien changer aux phases où les défauts naissent.',
    },
  ],

  m23: [
    {
      q: 'Quel est le meilleur format pour lancer un programme de Security Champions ?',
      options: [
        'Un pilote d’un trimestre sur une équipe, avec un objectif mesurable',
        'Cinq pour cent du temps sur toutes les équipes, dès le mois prochain',
        'Une formation obligatoire suivie d’une certification interne',
        'Un référent désigné par équipe, sans temps dédié au départ',
      ],
      answer: 0,
      explain: 'Petit, mesurable, réversible : trois raisons de dire oui, et le chiffre vend le trimestre suivant. Étalé sur quatre équipes, l’effort ne produit d’effet nulle part et l’échec sert d’argument contre le programme.',
    },
    {
      q: 'Une équipe AppSec de trois personnes accompagne 400 développeurs. Quel mode de travail tient à cette échelle ?',
      options: [
        'Outiller et former les équipes pour qu’elles traitent seules la majorité des cas',
        'Relire elle-même chaque pull request qui touche à l’authentification ou aux droits',
        'Réaliser un pentest interne de chaque application avant chaque mise en production',
        'Centraliser la correction des vulnérabilités dans un sprint de sécurité par trimestre',
      ],
      answer: 0,
      explain: 'À cette échelle, l’équipe AppSec ne peut pas être sur le chemin de chaque changement : elle rend les équipes capables, avec des outils, une paved road et des champions. Relire chaque PR sensible ou pentester chaque livraison crée une file d’attente ; un sprint trimestriel laisse les défauts vivre des mois.',
    },
    {
      q: 'Un chercheur externe signale une faille dans le SDK publié de Novafact. Quelle fonction prend le signalement en charge ?',
      options: [
        'La réponse aux vulnérabilités produit (PSIRT), qui coordonne correctif et divulgation',
        'Le SOC, qui surveille les alertes de sécurité et déclenche la réponse à incident',
        'L’équipe juridique, qui évalue d’abord le risque de publication par le chercheur',
        'Les security champions de l’équipe SDK, qui connaissent le mieux le code concerné',
      ],
      answer: 0,
      explain: 'Un signalement de vulnérabilité dans un produit relève du PSIRT : accuser réception, qualifier, coordonner le correctif et la divulgation et, depuis le 11 septembre 2026, notifier une vulnérabilité activement exploitée (CRA). Le SOC répond aux attaques en cours ; le juridique et les champions interviennent, sans piloter.',
    },
  ],

  m24: [
    {
      q: 'Une auto-évaluation SAMM donne Novafact au niveau 2 en Security Testing. Qu’est-ce que ce score ne dit pas ?',
      options: [
        'Combien de vulnérabilités exploitables sont aujourd’hui en production',
        'Quelles activités de test sont en place et avec quelle régularité',
        'Ce qu’il faudrait mettre en place pour atteindre le niveau suivant',
        'Comment la pratique se compare aux autres pratiques du même modèle',
      ],
      answer: 0,
      explain: 'SAMM mesure des activités et leur régularité : c’est une maturité, pas une posture. Un niveau élevé peut cohabiter avec des failles ouvertes, et l’inverse. Les activités en place, la marche suivante et la comparaison entre pratiques, c’est précisément ce que le modèle décrit.',
    },
    {
      q: 'La direction lit dans BSIMM16 une moyenne de 5,6 personnes de l’équipe sécurité logicielle pour 100 développeurs et veut s’aligner. Que lui répondre ?',
      options: [
        'Que cette moyenne est tirée par des cas extrêmes et que la médiane est bien plus basse',
        'Que BSIMM ne publie que des chiffres déclaratifs et qu’on ne peut pas s’en servir',
        'Que ce ratio est un plancher recommandé par BSIMM pour atteindre la maturité',
        'Que le ratio n’a de sens qu’en comptant aussi les security champions des équipes',
      ],
      answer: 0,
      explain: 'BSIMM16 donne 5,63 pour 100 en moyenne, mais une médiane de 1,8, et de 1,13 pour les organisations de 650 développeurs ou plus : quelques valeurs extrêmes tirent la moyenne. BSIMM est descriptif et ne fixe aucun plancher, ses données viennent d’évaluations menées dans les organisations, et il compte les champions à part.',
    },
    {
      q: 'Deux équipes ont le même nombre de vulnérabilités ouvertes. Laquelle est la mieux placée pour la suite ?',
      options: [
        'Celle dont les vulnérabilités sont trouvées tôt et corrigées vite, de façon régulière',
        'Celle dont les vulnérabilités ouvertes ont le score CVSS moyen le plus faible ce mois-ci',
        'Celle qui a réalisé le plus grand nombre de pentests externes depuis le début de l’année',
        'Celle qui utilise le plus d’outils d’analyse différents dans son pipeline d’intégration',
      ],
      answer: 0,
      explain: 'Un instantané (la posture) peut être identique ; la capacité à trouver tôt et à corriger vite (la maturité) dit comment l’écart évoluera. Le CVSS moyen du mois, le nombre de pentests ou d’outils mesurent un état ou un effort, pas un processus qui tient dans la durée.',
    },
    {
      q: 'Un tableau de bord de posture agrège les findings de six outils. Quel défaut fausse d’abord ses chiffres ?',
      options: [
        'Le même défaut vu par plusieurs outils, compté plusieurs fois faute de dédoublonnage',
        'Des findings affichés dans un format différent de celui de l’outil qui les a produits',
        'L’absence d’historique des findings déjà corrigés au cours des trimestres passés',
        'Le besoin d’un accès en lecture aux dépôts pour relier chaque finding à son équipe',
      ],
      answer: 0,
      explain: 'Un même défaut remonté par le SAST, le SCA et le DAST devient trois lignes : sans dédoublonnage, le tableau mesure le nombre d’outils plus que le risque. L’historique et le lien vers l’équipe sont utiles et le format d’affichage secondaire ; aucun ne fausse le compte.',
    },
  ],

  m25: [
    {
      q: 'Un utilisateur tape novafact.example pour la première fois. Qu’est-ce qui empêche une interception avant même la première requête HTTPS ?',
      options: [
        'La présence du domaine dans la liste HSTS preload intégrée au navigateur',
        'L’en-tête Strict-Transport-Security renvoyé par la réponse du serveur',
        'La redirection 301 de HTTP vers HTTPS configurée sur l’équilibreur',
        'Le certificat TLS, que le navigateur vérifie dès la résolution DNS du nom',
      ],
      answer: 0,
      explain: 'À la première visite, le navigateur ne connaît pas encore l’en-tête HSTS : la première requête part en HTTP et la redirection arrive trop tard, sur un canal déjà interceptable. Seule la liste de préchargement, livrée avec le navigateur, impose HTTPS dès le départ. Le certificat se vérifie pendant la poignée de main TLS, pas à la résolution DNS.',
    },
    {
      q: 'Une page piégée soumet un formulaire POST vers l’API de Novafact. Que bloque la same-origin policy, à elle seule ?',
      options: [
        'La lecture de la réponse par la page piégée, pas l’envoi de la requête',
        'L’envoi de la requête, puisque son origine diffère de celle de l’API',
        'L’envoi comme la lecture, sauf si l’API répond avec un en-tête CORS permissif',
        'Rien, car la same-origin policy ne concerne que les iframes et les fenêtres',
      ],
      answer: 0,
      explain: 'La same-origin policy protège la lecture : la requête de formulaire part, avec ses effets côté serveur, mais la page piégée ne voit pas la réponse. C’est pourquoi le CSRF existe malgré elle. CORS assouplit la lecture, il ne bloque pas un envoi que la politique n’empêchait pas ; l’envoi des cookies dépend, lui, de SameSite.',
    },
    {
      q: 'Un client HTTP Node désactive la vérification des certificats pour joindre un service interne. Que perd-on exactement ?',
      options: [
        'La preuve que le serveur joint est celui qu’on voulait, donc la protection contre l’interception',
        'Le chiffrement du trafic, qui passe alors en clair entre le client et le service interne',
        'La confidentialité persistante, puisque les clés de session deviennent prévisibles',
        'La compatibilité avec TLS 1.3, qui exige une chaîne de certificats vérifiée',
      ],
      answer: 0,
      explain: 'Le trafic reste chiffré, mais avec n’importe qui : sans vérification de la chaîne et du nom, un intermédiaire présente son propre certificat et lit tout. La confidentialité persistante et la version du protocole ne dépendent pas de cette vérification.',
    },
    {
      q: 'Une équipe Express doit prioriser ses règles SAST. Quelle liste sert le mieux de point de départ ?',
      options: [
        'Le CWE Top 25, parce qu’il nomme des faiblesses précises qu’un outil sait chercher',
        'L’OWASP Top 10, parce que chacune de ses catégories correspond à une règle d’outil',
        'L’API Security Top 10, parce que l’équipe ne développe qu’une API REST',
        'Le catalogue KEV de la CISA, parce qu’il recense ce qui est réellement exploité',
      ],
      answer: 0,
      explain: 'Le Top 10 OWASP sert à sensibiliser : ses catégories larges regroupent des dizaines de CWE. Le CWE Top 25 nomme des faiblesses de code, au grain d’une règle. L’API Top 10 guide les tests d’une API plus que le SAST, et KEV liste des vulnérabilités de produits, pas des faiblesses du code de l’équipe.',
    },
  ],

  m02: [
    {
      q: 'Quelle défense supprime une classe entière de XSS plutôt qu’une occurrence ?',
      options: [
        'Échapper la valeur au moment où elle est écrite dans la page',
        'Refuser les chaînes qui contiennent des balises ou des attributs d’événement',
        'Un type de données qui ne peut être construit que par un constructeur sûr',
        'Une CSP stricte qui n’autorise que les scripts portant le nonce du serveur',
      ],
      answer: 2,
      explain: 'C’est le safe coding : le compilateur refuse le code dangereux, donc il n’y a plus rien à ne pas oublier. L’échappement dépend de la vigilance, la liste noire se contourne, et la CSP est une seconde barrière — utile, mais elle n’empêche pas l’injection.',
    },
    {
      q: 'Une requête SQL classe les factures par une colonne choisie par le client. Que fait-on ?',
      options: [
        'Un paramètre lié, comme pour toute valeur venant de la requête',
        'Une liste blanche fermée de noms de colonnes autorisés',
        'Un échappement des caractères spéciaux avant l’interpolation',
        'Une validation par expression régulière sur le nom de colonne',
      ],
      answer: 1,
      explain: 'Un nom de colonne ne peut pas être un paramètre lié : c’est de la structure, pas une valeur. L’échappement et la regex laissent passer des identifiants valides mais non prévus — la liste fermée est la seule défense de classe.',
    },
    {
      q: 'Pourquoi `JSON.parse` suivi d’une fusion récursive expose-t-il à la prototype pollution ?',
      options: [
        'Parce que `JSON.parse` évalue le contenu de la chaîne reçue',
        'Parce que la fusion récursive ne vérifie pas la profondeur de l’objet',
        'Parce que le typage `any` désactive les contrôles du compilateur',
        'Parce que `__proto__` devient une clé propre que la fusion suit',
      ],
      answer: 3,
      explain: '`JSON.parse` n’évalue rien et crée une clé propre nommée `__proto__` ; c’est la fusion qui la suit et écrit dans le prototype partagé. Un littéral TypeScript, lui, poserait le prototype — ce qui fait échouer les tests écrits à la main.',
    },
    {
      q: 'Un téléchargement construit un chemin à partir d’un nom fourni par l’URL. Quel contrôle tient ?',
      options: [
        'Retirer les séquences `../` du nom avant de l’utiliser',
        'Résoudre le chemin et exiger qu’il reste sous la racine',
        'Vérifier que le nom se termine par une extension autorisée',
        'Encoder le nom avec `encodeURIComponent` avant de le joindre',
      ],
      answer: 1,
      explain: 'On contrôle le fichier réellement ouvert, après résolution — pas la chaîne demandée. Un remplacement en une passe se contourne par imbrication, et l’extension ne dit rien de l’endroit où le chemin mène.',
    },
    {
      q: 'Une connexion Mongo passe `req.body.email` au filtre. Quelle correction supprime la classe ?',
      options: [
        'Refuser récursivement les clés commençant par un dollar',
        'Convertir la valeur en chaîne avec un gabarit littéral',
        'Valider le corps avec un schéma strict qui refuse l’inattendu',
        'Limiter les tentatives de connexion par adresse et par minute',
      ],
      answer: 2,
      explain: 'Après validation, le champ est une chaîne : aucun opérateur ne peut prendre sa place, ici et sur les routes à venir. Le filtre d’opérateurs vit à côté du typage, et le gabarit ne corrige qu’un champ.',
    },
  ],

  m04: [
    {
      q: 'Une CSP est en `Report-Only` depuis dix-huit mois. Quel est le principal problème ?',
      options: [
        'Les rapports finissent par saturer le point de collecte',
        'La politique ne bloque rien, donc elle ne protège personne',
        'Les navigateurs finissent par ignorer une politique non appliquée',
        'Le mode rapport dégrade les performances de rendu de la page',
      ],
      answer: 1,
      explain: '`Report-Only` est une étape de mesure, pas une destination : il documente ce qui aurait été bloqué. Dix-huit mois de rapports suffisent largement à basculer.',
    },
    {
      q: 'Un script tiers est chargé depuis un CDN. Quand l’attribut d’intégrité (SRI) ne protège-t-il pas ?',
      options: [
        'Quand le script est servi en HTTP au lieu de HTTPS',
        'Quand le script dépasse la taille maximale gérée par le navigateur',
        'Quand le contenu servi varie légitimement d’un client à l’autre',
        'Quand le CDN utilise un certificat émis par une autorité interne',
      ],
      answer: 2,
      explain: 'Un polyfill servi selon le navigateur n’a pas d’empreinte stable : le SRI casserait le site. C’est pour cela que l’auto-hébergement était la bonne réponse dans l’affaire Polyfill.io.',
    },
    {
      q: 'Quelle mesure protège le mieux une page de paiement contre un skimmer ?',
      options: [
        'Poser HSTS avec préchargement sur le domaine de paiement',
        'Ajouter un WAF devant la page et bloquer les charges connues',
        'Retirer de cette page tout script qui n’y est pas indispensable',
        'Chiffrer les champs du formulaire avant leur envoi au serveur',
      ],
      answer: 2,
      explain: 'Le skimmer a besoin d’exécuter du script dans la page : moins il y en a, moins il y a de portes. Le chiffrement côté client est contourné par un script de la même page, et HSTS ne dit rien de l’origine du code.',
    },
    {
      q: 'Qu’est-ce qu’une XS-leak exploite ?',
      options: [
        'Une différence observable entre deux réponses inter-origines',
        'Une fuite de mémoire dans le moteur de rendu du navigateur',
        'Un cookie transmis sans l’attribut `SameSite` par le serveur',
        'Une erreur de configuration du partage de ressources CORS',
      ],
      answer: 0,
      explain: 'On ne lit pas la réponse — on observe une différence : un nombre de cadres, un événement d’erreur, un délai. D’où des défenses comme COOP, CORP et des réponses indiscernables.',
    },
    {
      q: 'Pourquoi `HttpOnly` sur le cookie de session est-il un contrôle de classe ?',
      options: [
        'Il empêche le cookie de partir sur une requête inter-site',
        'Il oblige le navigateur à ne transmettre le cookie qu’en HTTPS',
        'Il neutralise le vol de session par script, y compris futur',
        'Il limite la durée de vie du cookie à la session du navigateur',
      ],
      answer: 2,
      explain: 'Une ligne de configuration, et toutes les XSS — y compris celles qu’on n’a pas trouvées — cessent de donner la session. Les autres descriptions sont celles de `SameSite`, `Secure` et d’un cookie de session.',
    },
  ],

  m03: [
    {
      q: 'Deux composants délimitent une même requête HTTP différemment. Quel est l’impact ?',
      options: [
        'La requête est rejetée par le composant le plus strict',
        'Des octets sont lus comme le début de la requête d’un autre',
        'La connexion se bloque jusqu’à expiration du délai d’attente',
        'Le proxy met en cache une réponse destinée à un autre chemin',
      ],
      answer: 1,
      explain: 'C’est la désynchronisation : le reliquat d’une requête préfixe la suivante, sur une connexion partagée. Le blocage et le rejet sont des symptômes possibles, pas ce qu’on exploite.',
    },
    {
      q: 'Une règle de bordure bloque `/admin`. Une requête arrive sur `/Admin/users` et passe. Pourquoi ?',
      options: [
        'Le CDN ne normalise pas le chemin comme le routeur applicatif',
        'Le routeur applicatif décode le chemin une seconde fois',
        'Le CDN ne transmet pas l’en-tête qui porte le chemin d’origine',
        'La règle s’applique après la décision de mise en cache',
      ],
      answer: 0,
      explain: 'Express ignore la casse des routes par défaut, la règle du CDN compare deux chaînes : le même chemin appartient à la route protégée pour l’un et pas pour l’autre. Le double décodage est une autre divergence, sur un autre vecteur.',
    },
    {
      q: 'Une page authentifiée est servie à d’autres utilisateurs depuis le cache. Quelle correction tient ?',
      options: [
        'Ramener la durée de conservation en cache à dix secondes',
        'Ajouter le cookie de session à la clé de cache de la page',
        'Bloquer à la bordure toute URL de compte suivie d’une extension statique',
        'Déclarer `private, no-store` sur les réponses authentifiées',
      ],
      answer: 3,
      explain: 'Le cache cesse de deviner ce qui est public à partir d’une extension, et l’origine dit elle-même ce qui ne se stocke pas. Le TTL court laisse une fenêtre, la clé par cookie détruit le taux de succès, la règle de bordure ferme une forme parmi beaucoup.',
    },
    {
      q: 'Cinq requêtes concurrentes passent une vérification « une fois par compte ». Combien de fois au pire ?',
      options: [
        'Deux, le temps que la première écriture arrive',
        'Cinq, autant que de requêtes envoyées ensemble',
        'Une, la vérification en base fait office de verrou',
        'Trois, selon l’ordonnancement des instances applicatives',
      ],
      answer: 1,
      explain: 'La vérification lit sans réserver : il n’y a pas de limite structurelle, seulement le nombre de requêtes qu’on place dans la fenêtre. C’est ce que vise l’attaque en paquet unique.',
    },
    {
      q: 'Un filtre anti-SSRF valide l’hôte, et la requête part quand même vers un service interne. Pourquoi ?',
      options: [
        'Le filtre n’a pas résolu le nom de domaine avant de comparer',
        'Le client HTTP suit une redirection après la validation',
        'Le filtre et le client n’analysent pas l’URL avec le même parser',
        'La liste blanche contient un domaine que l’attaquant contrôle',
      ],
      answer: 2,
      explain: 'Deux analyseurs d’URL traitent différemment l’arobase et les barres obliques inversées : ce qui est un hôte pour l’un est une information d’identification pour l’autre. La redirection et la course DNS sont d’autres contournements du même filtre.',
    },
  ],

  m26: [
    {
      q: 'Une équipe veut livrer avec une BOLA connue. Qui décide ?',
      options: [
        'La sécurité, qui est responsable du niveau de risque du produit',
        'Le propriétaire du risque métier, sur des options chiffrées',
        'Le comité d’architecture, qui arbitre les écarts techniques',
        'L’équipe elle-même, qui connaît le mieux son périmètre',
      ],
      answer: 1,
      explain: 'La sécurité éclaire la décision et ne la prend pas : elle ne porte pas les conséquences commerciales. Décider à la place du métier fait de l’AppSec une porte que le produit apprendra à contourner.',
    },
    {
      q: 'Un finding a un score CVSS de base de 9,8. Qu’en déduire sur le risque pour Novafact ?',
      options: [
        'Rien encore : il faut l’exposition, la valeur de l’actif et la menace réelle',
        'Que le risque est critique et doit passer avant toute autre vulnérabilité',
        'Que la probabilité d’exploitation est forte, puisque le score dépasse neuf',
        'Que l’impact métier est maximal, car le score intègre la confidentialité',
      ],
      answer: 0,
      explain: 'Le guide de CVSS de FIRST le dit : le score de base mesure une sévérité, pas un risque. La probabilité d’exploitation (EPSS, KEV) et l’impact métier (valeur de l’actif, exposition) n’y sont pas ; un 9,8 sur un composant non exposé peut peser moins qu’un 6 sur la page de paiement.',
    },
    {
      q: 'Une matrice 5 × 5 classe deux risques dans la même case « élevé ». Quel est le défaut connu de cet outil ?',
      options: [
        'Elle agrège des risques d’ampleur très différente et peut même inverser leur ordre',
        'Elle impose de connaître la fréquence exacte de chaque événement avant de classer',
        'Elle ne sait pas représenter un risque dont l’impact touche plusieurs métiers',
        'Elle oblige à recalculer tous les risques dès que l’échelle d’impact change',
      ],
      answer: 0,
      explain: 'Cox (2008) a montré qu’une matrice de risque départage mal les risques et peut noter plus haut un risque quantitativement plus faible. Elle ne demande justement pas de fréquence exacte, c’est ce qui la rend populaire ; un impact multiple se ramène au plus fort, et changer l’échelle impose de reclasser, pas de tout recalculer.',
    },
  ],

  m11: [
    {
      q: 'À quel moment un modèle de menaces perd-il sa valeur ?',
      options: [
        'Quand il n’a pas été relu depuis plus de six mois',
        'Quand il décrit une architecture qui a changé depuis',
        'Quand il ne couvre pas toutes les catégories STRIDE',
        'Quand il n’est pas validé par l’équipe d’architecture',
      ],
      answer: 1,
      explain: 'Un modèle suit l’architecture livrée : corriger un composant rend le modèle faux, et c’est normal. Le vrai risque est la dérive silencieuse, d’où l’intérêt de la détecter automatiquement.',
    },
    {
      q: 'Dans STRIDE, à quel besoin de sécurité le « R » (répudiation) s’oppose-t-il ?',
      options: [
        'À la confidentialité des échanges',
        'À l’intégrité des données stockées et transmises',
        'À la traçabilité des actions',
        'À la disponibilité du service',
      ],
      answer: 2,
      explain: 'Chaque lettre de STRIDE est la violation d’une propriété : usurpation contre authentification, altération contre intégrité, répudiation contre traçabilité. C’est ce qui rend la méthode systématique.',
    },
    {
      q: 'Que représente une frontière de confiance sur un diagramme de flux de données ?',
      options: [
        'Un endroit où la donnée change de propriétaire',
        'Un endroit où le niveau de privilège change',
        'La limite du périmètre couvert par le modèle',
        'Un point de passage obligé pour tous les flux',
      ],
      answer: 1,
      explain: 'C’est là que les menaces se concentrent, parce que c’est là qu’une donnée cesse d’être contrôlée par celui qui la reçoit. Le périmètre du modèle est autre chose : il se dessine en dehors du diagramme.',
    },
    {
      q: 'À quoi sert MITRE ATT&CK dans un travail de modélisation ?',
      options: [
        'À nommer les techniques observées, pour relier modèle et détection',
        'À classer les vulnérabilités selon leur gravité intrinsèque',
        'À décrire les faiblesses de conception d’un composant logiciel',
        'À prioriser les correctifs selon la probabilité d’exploitation',
      ],
      answer: 0,
      explain: 'ATT&CK est un vocabulaire de comportements d’attaquants : il permet de dire « cette menace du modèle correspond à cette détection ». Les faiblesses relèvent de CWE, la priorisation d’EPSS et de SSVC.',
    },
    {
      q: 'Qu’ajoute LINDDUN par rapport à STRIDE ?',
      options: [
        'Une couverture des menaces sur la chaîne d’approvisionnement',
        'Une méthode de cotation quantitative du risque résiduel',
        'Une analyse des menaces sur la vie privée des personnes',
        'Un catalogue de contre-mesures associé à chaque menace',
      ],
      answer: 2,
      explain: 'STRIDE regarde la sécurité du système ; LINDDUN regarde ce que le système fait subir aux personnes — liaison, identification, inférence, non-conformité. Deux questions différentes sur le même diagramme.',
    },
  ],

  m07: [
    {
      q: 'Pourquoi vaut-il mieux une énumération fermée qu’une chaîne libre pour classer la sensibilité d’une donnée ?',
      options: [
        'Parce qu’elle permet d’écrire des règles de traitement décidables',
        'Parce qu’elle réduit la taille du dictionnaire de données produit',
        'Parce que les outils de conformité n’acceptent pas le texte libre',
        'Parce qu’elle évite les fautes de frappe dans les fiches de données',
      ],
      answer: 0,
      explain: 'Avec une chaîne libre, « sensible », « plutôt sensible » et « à protéger » cohabitent, et plus rien ne se décide automatiquement. La classification n’a d’intérêt que si une règle peut s’y accrocher.',
    },
    {
      q: 'Une matrice de traçabilité relie les exigences aux tests. Qu’est-ce qui l’empêche de mentir ?',
      options: [
        'Une revue trimestrielle par le responsable de chaque exigence',
        'Un identifiant d’exigence cité en commentaire dans chaque test',
        'L’exécution réelle des tests cités, confrontée au statut déclaré',
        'Un taux de couverture minimal imposé sur les fichiers concernés',
      ],
      answer: 2,
      explain: 'Une matrice bien remplie mais fausse passe toutes les revues : c’est la raison de la tenir dans le dépôt plutôt que dans un tableur. Un commentaire ou un taux de couverture ne disent rien du verdict.',
    },
    {
      q: 'Le droit à l’effacement porte sur quoi, exactement ?',
      options: [
        'La ligne utilisateur, et les copies qui en dépendent directement',
        'Toutes les copies de la donnée, où qu’elle se soit propagée',
        'Les données identifiantes, les données d’usage restant anonymisées',
        'Les traitements actifs, les sauvegardes suivant leur propre cycle',
      ],
      answer: 1,
      explain: 'C’est l’étape qu’on saute : cartographier où la donnée est partie — journaux, boîte d’envoi, exports, traces de remise — vient avant de promettre de l’effacer. Un test qui ne regarde que la table utilisateurs passe au vert pour rien.',
    },
    {
      q: 'Une revue d’accès constate qu’un droit n’a jamais été exercé sur la période. Que fait-on ?',
      options: [
        'On le retire : l’usage réel prime sur la demande initiale',
        'On le conserve et on repousse la décision à la revue suivante',
        'On demande au titulaire s’il compte s’en servir prochainement',
        'On le conserve si le compte est un compte de service',
      ],
      answer: 0,
      explain: 'C’est le moindre privilège en pratique : on part de ce qui a servi, pas de ce qui avait été demandé. Interroger le titulaire produit invariablement un « oui, au cas où ».',
    },
  ],

  m08: [
    {
      q: 'Qu’est-ce que le principe de « complete mediation » implique concrètement ?',
      options: [
        'Chaque accès est vérifié, sans se fier à une décision antérieure',
        'Chaque composant valide les entrées qu’il reçoit de ses voisins',
        'Chaque flux traverse un point de contrôle unique et journalisé',
        'Chaque droit est accordé explicitement et refusé par défaut',
      ],
      answer: 0,
      explain: 'Le piège est la mise en cache d’une décision d’autorisation : elle était vraie au moment où elle a été prise. Les trois autres descriptions sont celles de la validation aux frontières, du point d’étranglement et du fail-safe default.',
    },
    {
      q: 'Où passe une frontière de confiance dans une architecture ?',
      options: [
        'Entre le réseau public et le réseau interne de l’entreprise',
        'Entre deux composants qui n’ont pas le même niveau de privilège',
        'Là où la donnée change de format ou de représentation',
        'À l’entrée de chaque service exposé par une interface réseau',
      ],
      answer: 1,
      explain: 'La frontière suit le privilège, pas la topologie : deux services du même VPC peuvent en être séparés, et le reflux de confiance vient justement de l’idée que « l’interne est fiable ».',
    },
    {
      q: 'Un contrôle échoue à cause d’une exception inattendue. Quel comportement est sûr ?',
      options: [
        'Journaliser l’erreur et laisser passer pour ne pas casser le service',
        'Réessayer le contrôle une fois, puis refuser en cas de nouvel échec',
        'Refuser l’accès, l’absence de décision valant refus',
        'Appliquer la dernière décision connue pour ce principal',
      ],
      answer: 2,
      explain: 'Un `try/catch` qui laisse passer est un contrôle d’accès qui s’ouvre dès qu’on le perturbe — et perturber un contrôle est souvent plus facile que de le franchir. C’est le fail-safe default.',
    },
    {
      q: 'Quelle question distingue une revue de conception d’une revue de code ?',
      options: [
        'Ce composant est-il correctement isolé de ses voisins ?',
        'Cette entrée est-elle validée avant d’atteindre la requête ?',
        'Ce secret est-il stocké ailleurs que dans le dépôt ?',
        'Cette dépendance est-elle épinglée à une version connue ?',
      ],
      answer: 0,
      explain: 'La conception décide de ce qui peut mal tourner et jusqu’où ça va ; le code décide de ce qui tourne mal aujourd’hui. Les trois autres questions se répondent en lisant un fichier.',
    },
    {
      q: 'Pourquoi le moindre privilège se conçoit-il plutôt qu’il ne se configure ?',
      options: [
        'Parce que les outils de configuration diffèrent d’un cloud à l’autre',
        'Parce que les droits accordés tardivement ne se retirent jamais',
        'Parce qu’un découpage en composants détermine ce qu’il y a à accorder',
        'Parce que la configuration est écrasée à chaque déploiement',
      ],
      answer: 2,
      explain: 'Un service monolithique qui touche à tout ne peut pas recevoir de droits étroits, quelle que soit la qualité de la politique écrite ensuite. Le découpage décide du plafond.',
    },
  ],

  m09: [
    {
      q: 'À quoi sert le paramètre `state` dans un flux d’autorisation ?',
      options: [
        'À transporter l’identité du fournisseur choisi par l’utilisateur',
        'À lier la réponse à la demande émise par cette session',
        'À empêcher le rejeu d’un code d’autorisation déjà échangé',
        'À transmettre le périmètre demandé au serveur d’autorisation',
      ],
      answer: 1,
      explain: 'Sans lui, une réponse fabriquée par un tiers est acceptée comme si l’utilisateur l’avait demandée : c’est du CSRF sur le flux. Le rejeu du code relève de PKCE et de l’usage unique.',
    },
    {
      q: 'Pourquoi une `redirect_uri` validée par préfixe est-elle dangereuse ?',
      options: [
        'Parce qu’un chemin de l’application peut rediriger ailleurs',
        'Parce que le préfixe ne couvre pas les sous-domaines du service',
        'Parce que le fournisseur ne vérifie alors pas le schéma HTTPS',
        'Parce que la comparaison est sensible à la casse du domaine',
      ],
      answer: 0,
      explain: 'Il suffit d’une redirection ouverte quelque part sous le préfixe autorisé pour que le code d’autorisation parte vers un domaine externe. Deux findings faibles, un vol de compte — d’où l’égalité exacte de la RFC 9700.',
    },
    {
      q: 'Qu’est-ce que la confusion d’algorithme sur un JWT ?',
      options: [
        'Accepter un jeton dont l’en-tête déclare `alg: none`',
        'Vérifier un jeton RS256 avec une clé issue d’un JWKS tiers',
        'Utiliser la clé publique RSA comme secret HMAC valide',
        'Accepter un jeton dont l’identifiant de clé est inconnu',
      ],
      answer: 2,
      explain: 'La clé publique est connue de tous : si le serveur accepte HS256, elle devient un secret de signature valide et le jeton se forge sans rien voler. Épingler l’algorithme côté serveur ferme la porte.',
    },
    {
      q: 'Dans une attaque par enveloppement de signature SAML, que fait l’attaquant ?',
      options: [
        'Il forge une signature à partir d’une clé privée dérobée',
        'Il rejoue une réponse valide interceptée sur un autre service',
        'Il place une assertion non signée avant l’assertion signée',
        'Il modifie l’assertion signée sans en casser la signature',
      ],
      answer: 2,
      explain: 'Aucune signature n’est forgée : la vérification suit une référence par identifiant, l’application lit la première assertion trouvée, et les deux parcours désignent des nœuds différents. D’où la règle : lire l’identité dans le nœud que la vérification a renvoyé.',
    },
    {
      q: 'Où stocker les jetons d’une application web monopage ?',
      options: [
        'Dans `localStorage`, chiffrés avec une clé dérivée de la session',
        'Dans `sessionStorage`, effacé à la fermeture de l’onglet',
        'Côté serveur, la page ne portant qu’un cookie `HttpOnly`',
        'En mémoire, rechargés par un jeton de rafraîchissement tournant',
      ],
      answer: 2,
      explain: 'Tant que le jeton est accessible au script, une XSS le prend — chiffré ou non, dans l’un ou l’autre des stockages. Le BFF le sort de la page ; la rotation des jetons de rafraîchissement est le repli, pas l’idéal.',
    },
  ],

  m10: [
    {
      q: 'Des milliers de comptes distincts, un seul essai chacun, depuis peu d’adresses. De quoi s’agit-il ?',
      options: [
        'D’une force brute distribuée sur un petit nombre de comptes',
        'D’un rejeu d’identifiants volés ailleurs',
        'D’une énumération de comptes existants',
        'D’un déni de service visant le service d’authentification',
      ],
      answer: 1,
      explain: 'La signature est le rapport entre comptes et essais : la force brute s’acharne sur un compte, le bourrage teste une paire connue sur des milliers. Un succès isolé indique une réutilisation de mot de passe.',
    },
    {
      q: 'Quelle mesure anti-abus a le meilleur rapport coût-efficacité contre la création de comptes en masse ?',
      options: [
        'Un captcha sur le formulaire d’inscription',
        'Une vérification de l’adresse électronique avant le premier usage',
        'Un quota d’activité sur les comptes de moins de sept jours',
        'Un blocage des plages d’adresses des fournisseurs de cloud',
      ],
      answer: 2,
      explain: 'Le fraudeur veut agir vite et en volume ; une PME réelle envoie rarement trente factures le premier jour. Les captchas se résolvent pour quelques centimes, et le blocage d’adresses touche des utilisateurs légitimes.',
    },
    {
      q: 'Pourquoi le SMS reste-t-il un second facteur acceptable dans certains cas ?',
      options: [
        'Parce que le détournement de carte SIM est devenu rare',
        'Parce qu’il résiste à l’hameçonnage aussi bien qu’un code TOTP',
        'Parce que l’attaque qui le contourne vise des comptes à forte valeur',
        'Parce qu’il est chiffré de bout en bout par l’opérateur',
      ],
      answer: 2,
      explain: 'Le SIM swap est ciblé et coûteux : il ne vise pas la PME qui émet douze factures par mois. Exiger le facteur fort partout revient souvent à n’en obtenir aucun — d’où la segmentation plutôt que le compromis.',
    },
    {
      q: 'Quel signal trahit le mieux une prise de contrôle de compte en cours ?',
      options: [
        'Un changement de mot de passe suivi d’une reconnexion immédiate',
        'Une session qui change de pays et de type de client en quelques minutes',
        'Une série d’échecs d’authentification sur un compte unique',
        'Une connexion depuis une adresse absente de l’historique du compte',
      ],
      answer: 1,
      explain: 'Un jeton rejoué ailleurs ne produit aucun échec d’authentification : c’est la discontinuité du contexte qui le dénonce. Une nouvelle adresse seule est trop fréquente pour alerter.',
    },
    {
      q: 'Quelle défense vise la fraude plutôt que l’abus technique ?',
      options: [
        'Une limite de débit sur les routes de paiement',
        'Une validation humaine au-delà d’un seuil de remboursement',
        'Une détection des clients automatisés par empreinte',
        'Un quota d’appels par compte et par jour',
      ],
      answer: 1,
      explain: 'Les trois autres freinent un automate ; la fraude, elle, passe souvent par des actions parfaitement normales en volume et en rythme. Le seuil métier est ce qui distingue une opération légitime d’une opération coûteuse.',
    },
  ],

  m12: [
    {
      q: 'Par où commencer une revue de code de sécurité sur un dépôt inconnu ?',
      options: [
        'Par les dépendances et leurs vulnérabilités connues',
        'Par les points d’entrée et le chemin de la donnée vers les sinks',
        'Par les fichiers modifiés le plus souvent dans l’historique',
        'Par les tests, pour comprendre ce que le code garantit',
      ],
      answer: 1,
      explain: 'La revue de sécurité suit la donnée : d’où elle entre, jusqu’où elle va, ce qu’elle traverse. Les trois autres entrées sont utiles et ne disent rien du chemin qu’un attaquant emprunte.',
    },
    {
      q: 'Qu’est-ce qui rend une revue de code répétable d’un relecteur à l’autre ?',
      options: [
        'Une liste de contrôle issue des classes de défauts déjà rencontrées',
        'Un temps minimal imposé par fichier ou par millier de lignes',
        'Deux relecteurs obligatoires sur toute modification sensible',
        'Un outil d’analyse statique exécuté avant la relecture humaine',
      ],
      answer: 0,
      explain: 'Sans liste, chacun cherche ce qu’il connaît, et la couverture dépend de qui relit. Le second relecteur et l’outil ajoutent des yeux ; ils ne disent pas où regarder.',
    },
    {
      q: 'Un relecteur voit une interpolation de chaîne dans une requête SQL. Quelle question vient d’abord ?',
      options: [
        'La valeur interpolée peut-elle venir d’une entrée utilisateur ?',
        'La bibliothèque utilisée échappe-t-elle automatiquement les valeurs ?',
        'Le moteur de base de données autorise-t-il les requêtes empilées ?',
        'Le code est-il couvert par un test qui exercerait cette ligne ?',
      ],
      answer: 0,
      explain: 'Sans source contrôlable, il n’y a pas de vulnérabilité — une constante interpolée est du bruit. C’est ce qui distingue un vrai positif d’un faux : le chemin depuis l’entrée, pas la forme de la ligne.',
    },
    {
      q: 'Comment qualifier un signalement d’outil qui pointe une ligne protégée par une liste blanche maison ?',
      options: [
        'Vrai positif : la liste blanche peut être contournée',
        'Faux positif, et il faut déclarer ce sanitizer à la règle',
        'À ignorer : la ligne est protégée, il n’y a rien à faire',
        'Vrai positif de faible sévérité, à corriger sans urgence',
      ],
      answer: 1,
      explain: 'L’outil ne connaît pas la garde maison, et il le signalera à chaque fois. Se contenter de fermer le ticket garantit qu’on le rouvrira au prochain passage : déclarer le sanitizer supprime le faux positif définitivement.',
    },
    {
      q: 'Quel constat justifie d’écrire une règle d’analyse maison plutôt que de corriger ligne à ligne ?',
      options: [
        'Le défaut est jugé critique par l’équipe de sécurité',
        'Le défaut apparaît dans plusieurs dépôts et réapparaît après correction',
        'Le défaut n’est détecté par aucun outil du marché',
        'Le défaut concerne une bibliothèque interne largement utilisée',
      ],
      answer: 1,
      explain: 'La règle maison a un coût d’écriture et de maintenance : elle se justifie quand la classe se réintroduit, pas quand une instance est grave. Une occurrence unique se corrige et se teste.',
    },
  ],

  m13: [
    {
      q: 'Qu’est-ce qu’un test de régression de sécurité doit établir, qu’un test fonctionnel n’établit pas ?',
      options: [
        'Que le contrôle refuse l’attaque, et que le cas légitime marche encore',
        'Que le code couvre toutes les branches de la fonction corrigée',
        'Que la correction n’introduit pas de régression de performance',
        'Que le défaut est absent des autres fichiers du même module',
      ],
      answer: 0,
      explain: 'Les deux moitiés comptent : un correctif qui casse la fonctionnalité échoue aussi sûrement qu’un correctif absent. C’est ce qui distingue un test de sécurité d’une assertion sur un cas nominal.',
    },
    {
      q: 'Quand un SAST est-il plus pertinent qu’un DAST ?',
      options: [
        'Quand on cherche des défauts de configuration de l’environnement',
        'Quand on veut confirmer qu’une vulnérabilité est exploitable',
        'Quand on veut bloquer une classe de défauts à l’écriture du code',
        'Quand on veut mesurer l’exposition réelle d’une application en ligne',
      ],
      answer: 2,
      explain: 'Le SAST voit le code et pas l’exécution : il excelle à refuser un motif en pull request, il conclut mal sur l’exploitabilité. Les trois autres besoins appellent un outil qui parle à l’application qui tourne.',
    },
    {
      q: 'Un outil signale trois cents alertes sur un dépôt. Quelle première action ?',
      options: [
        'Trier par sévérité et traiter les critiques en priorité',
        'Regrouper par règle et qualifier les règles les plus bruyantes',
        'Désactiver les règles dont le taux de faux positifs dépasse un seuil',
        'Répartir les alertes entre les équipes propriétaires des fichiers',
      ],
      answer: 1,
      explain: 'Trois cents alertes viennent souvent de dix règles : qualifier la règle traite cent alertes d’un coup. Trier par sévérité fait traiter cent fois le même faux positif, et désactiver avant d’avoir regardé retire aussi les vrais.',
    },
    {
      q: 'À quoi sert un fuzzer sur une application web ?',
      options: [
        'À découvrir des entrées que personne n’a pensé à tester',
        'À mesurer la robustesse du service sous forte charge',
        'À vérifier la conformité des réponses au schéma de l’API',
        'À parcourir automatiquement toutes les routes exposées',
      ],
      answer: 0,
      explain: 'Le fuzzing explore l’espace des entrées malformées, là où la revue et les tests écrits n’ont pas d’idées. Le parcours des routes est du crawl, la charge est un test de performance.',
    },
    {
      q: 'Pourquoi un test écrit par l’apprenant doit-il échouer avant de passer ?',
      options: [
        'Pour vérifier que le test s’exécute réellement dans la CI',
        'Pour garantir qu’il mesure le défaut et non la présence du code',
        'Pour permettre de mesurer le temps gagné par la correction',
        'Pour documenter le comportement avant et après le correctif',
      ],
      answer: 1,
      explain: 'Un test qui passe des deux côtés ne prouve rien : il affirme peut-être que la fonction existe. Le double passage — rouge contre le code vulnérable, vert contre le corrigé — est ce qui le rend probant.',
    },
  ],

  m14: [
    {
      q: 'Pourquoi épingler une action de CI par empreinte de commit plutôt que par étiquette ?',
      options: [
        'Parce qu’une étiquette est un alias que son propriétaire peut déplacer',
        'Parce que l’empreinte permet de vérifier la signature de l’auteur',
        'Parce que les étiquettes ne sont pas conservées par tous les registres',
        'Parce que l’empreinte accélère la résolution au démarrage du workflow',
      ],
      answer: 0,
      explain: 'C’est exactement ce qui s’est produit avec tj-actions : le tag repointé vers un commit malveillant, exécuté par tout ce qui le référençait. L’empreinte, elle, EST le contenu.',
    },
    {
      q: 'Qu’est-ce que le trusted publishing ne garantit pas ?',
      options: [
        'Que le paquet vient bien du dépôt et du workflow déclarés',
        'Qu’aucun jeton de longue durée n’a servi à la publication',
        'Que le contenu publié correspond au code source relu',
        'Que la publication est traçable jusqu’à une exécution précise',
      ],
      answer: 2,
      explain: 'Il prouve la provenance, pas la sainteté du build : un workflow compromis publie légitimement un paquet piégé. C’est ce qui est arrivé chez PyTorch, et c’est pourquoi l’isolation du build compte autant.',
    },
    {
      q: 'Un titre de pull request est interpolé dans une commande `run`. Quel est le risque ?',
      options: [
        'Le workflow échoue si le titre contient des caractères spéciaux',
        'Le contributeur externe exécute du code sur le runner',
        'Le journal de build expose le contenu de la pull request',
        'Le cache de dépendances est pollué entre deux branches',
      ],
      answer: 1,
      explain: 'Le titre devient du shell. Avec un déclencheur qui donne accès aux secrets, le runner exfiltre les jetons du dépôt — d’où la règle : les données de PR passent par l’environnement, jamais dans `run`.',
    },
    {
      q: 'Que protège concrètement la désactivation des scripts d’installation côté consommateur ?',
      options: [
        'Contre l’exécution de code au moment où le paquet est installé',
        'Contre l’installation d’une version non épinglée du paquet',
        'Contre la présence de dépendances transitives inconnues',
        'Contre la publication d’un paquet au nom d’un tiers',
      ],
      answer: 0,
      explain: 'C’est le point de contact où le paquet piégé agit : sans exécution automatique, il arrive et ne fait rien. Combiné à un délai d’adoption, la plupart des versions malveillantes sont retirées avant usage.',
    },
    {
      q: 'Quel signal, visible d’un consommateur, précède souvent une compromission de dépendance ?',
      options: [
        'Une hausse du nombre de vulnérabilités connues du paquet',
        'Un changement de mainteneur ou une nouvelle dépendance transitive',
        'Une baisse de la fréquence des publications du projet',
        'Une divergence entre la documentation et le code publié',
      ],
      answer: 1,
      explain: 'C’est la signature d’event-stream : un mainteneur qui passe la main, puis une dépendance transitive qui apparaît dans le lockfile. La santé du projet est un critère de choix, pas seulement un indicateur.',
    },
  ],

  m15: [
    {
      q: 'Dans l’évaluation d’une politique AWS, qu’est-ce qui l’emporte sur tout le reste ?',
      options: [
        'La politique de ressource, quand elle nomme explicitement le principal',
        'La politique d’identité la plus spécifique sur la ressource visée',
        'Un Deny explicite, où qu’il soit déclaré',
        'La permissions boundary attachée au rôle',
      ],
      answer: 2,
      explain: 'Il n’existe pas de règle du plus spécifique en IAM : un Deny gagne, même dans la même politique qu’un Allow plus précis, et quel que soit l’ordre des instructions.',
    },
    {
      q: 'Pourquoi `iam:PassRole` sur `*` est-il un chemin d’élévation ?',
      options: [
        'Parce qu’il permet de modifier la politique de n’importe quel rôle',
        'Parce qu’il permet de confier n’importe quel rôle à un service qu’on crée',
        'Parce qu’il permet d’assumer directement n’importe quel rôle du compte',
        'Parce qu’il permet de créer des rôles sans permissions boundary',
      ],
      answer: 1,
      explain: 'On ne prend pas le rôle : on le donne à une fonction qu’on écrit, puis on l’invoque. D’où la condition `iam:PassedToService` et la désignation explicite du rôle transmis.',
    },
    {
      q: 'À quoi sert une permissions boundary ?',
      options: [
        'À accorder des droits communs à un ensemble de rôles',
        'À plafonner ce qu’une politique d’identité peut accorder',
        'À restreindre les régions dans lesquelles un rôle peut agir',
        'À imposer la MFA sur les actions sensibles d’un rôle',
      ],
      answer: 1,
      explain: 'Elle n’accorde rien : elle borne. C’est ce qui permet de déléguer la création de rôles sans qu’un rôle créé reçoive plus de droits que son créateur.',
    },
    {
      q: 'Un rôle peut publier une nouvelle version de sa propre politique. Quel est le problème ?',
      options: [
        'La politique peut devenir incohérente avec le modèle Terraform',
        'Le rôle peut s’accorder n’importe quel droit du compte',
        'Les versions précédentes restent exploitables par un attaquant',
        'Le changement échappe au journal d’audit de l’organisation',
      ],
      answer: 1,
      explain: 'La ressource est pourtant bien nommée — c’est le piège. Modifier sa propre politique et la rendre active revient à s’écrire un accès administrateur : la gestion d’IAM se réserve au pipeline relu.',
    },
    {
      q: 'Un service accède à une clé KMS. Que faut-il vérifier en plus de sa politique d’identité ?',
      options: [
        'Que la clé est dans la même région que le service appelant',
        'Que la clé n’est pas déjà en attente de suppression programmée',
        'Que la politique de la clé l’autorise, même indirectement',
        'Que le service utilise la version la plus récente du SDK',
      ],
      answer: 2,
      explain: 'KMS est le service où la politique de ressource est obligatoire : sans elle, aucune politique d’identité ne suffit. Une ligne qui délègue au compte rend la politique d’identité opérante.',
    },
  ],

  m16: [
    {
      q: 'Qu’est-ce que la dérive (drift) en infrastructure as code ?',
      options: [
        'Un écart entre l’état réel et ce que le code décrit',
        'Un changement de version du fournisseur entre deux exécutions',
        'Une divergence entre deux environnements décrits par le même module',
        'Un retard d’application des modifications validées en revue',
      ],
      answer: 0,
      explain: 'Elle vient d’une modification manuelle en console, souvent faite en urgence. Le danger est qu’elle rend le code faux sans que rien ne le signale, jusqu’à ce qu’un plan la supprime.',
    },
    {
      q: 'Pourquoi le fichier d’état Terraform est-il un actif sensible ?',
      options: [
        'Parce qu’il permet de détruire l’infrastructure décrite',
        'Parce qu’il contient en clair les valeurs générées, mots de passe compris',
        'Parce qu’il révèle la topologie complète du compte cloud',
        'Parce qu’il permet de rejouer des modifications déjà appliquées',
      ],
      answer: 1,
      explain: 'Tout ce que les ressources ont produit y figure : mots de passe de base, clés, chaînes de connexion. Ce n’est pas une action IAM qui élève les droits, c’est une simple lecture.',
    },
    {
      q: 'Quel est l’intérêt de la policy as code par rapport à une revue humaine ?',
      options: [
        'Elle remplace la revue de conception sur les changements sensibles',
        'Elle applique la même règle à chaque changement, sans fatigue',
        'Elle détecte les vulnérabilités connues des modules employés',
        'Elle garantit la cohérence entre les environnements déployés',
      ],
      answer: 1,
      explain: 'Une règle écrite une fois s’applique à trois heures du matin comme en revue du lundi. Elle ne remplace pas le jugement sur la conception — elle libère du temps pour ce jugement.',
    },
    {
      q: 'Un job de plan Terraform tourne sur chaque pull request, y compris externes. Quel est le risque principal ?',
      options: [
        'La consommation de ressources par des plans inutiles',
        'La lecture de l’état, donc des secrets qu’il contient',
        'L’application accidentelle des modifications proposées',
        'Le verrouillage de l’état par un plan concurrent',
      ],
      answer: 1,
      explain: 'Le plan a besoin de lire l’état, et l’état contient les secrets en clair. Le déclencheur externe n’est que le chemin ; c’est le contenu de l’état qui fait la gravité.',
    },
    {
      q: 'Quel contrôle empêche qu’une ressource déployée soit publique par inadvertance ?',
      options: [
        'Un scan périodique du compte à la recherche d’expositions',
        'Une revue obligatoire de toute modification d’infrastructure',
        'Un refus à l’admission, avant que la ressource n’existe',
        'Une alerte sur la création de ressources de ce type',
      ],
      answer: 2,
      explain: 'Les trois autres constatent après coup, avec une fenêtre d’exposition entre la création et la détection. Refuser avant création supprime la fenêtre.',
    },
  ],

  m17: [
    {
      q: 'Pourquoi un secret passé par `ARG` au moment du build reste-t-il exposé ?',
      options: [
        'Parce que l’instruction suivante ne supprime pas la couche créée',
        'Parce que la valeur figure dans l’historique des couches de l’image',
        'Parce que le fichier est recréé à chaque démarrage du conteneur',
        'Parce que le registre conserve les arguments de construction',
      ],
      answer: 1,
      explain: '`docker history` le montre même si le fichier qu’il a servi à écrire a été effacé ensuite : les couches sont immuables. D’où le montage de secrets au build plutôt que leur passage en argument.',
    },
    {
      q: 'Quel est l’intérêt principal d’une construction d’image en plusieurs étapes ?',
      options: [
        'Accélérer la construction grâce à la mise en cache des couches',
        'Permettre de compiler le code dans plusieurs langages différents',
        'Ne garder dans l’image finale que ce qui sert à l’exécution',
        'Isoler les dépendances de production de celles de développement',
      ],
      answer: 2,
      explain: 'Le compilateur, les outils et les sources restent dans l’étape de build : la surface d’attaque de l’image livrée tombe. La séparation des dépendances en est une conséquence, pas le but.',
    },
    {
      q: 'Une configuration `helmet` irréprochable est montée après les routes. Que se passe-t-il ?',
      options: [
        'Les en-têtes sont posés sur les réponses d’erreur seulement',
        'Aucune réponse de l’API ne porte les en-têtes configurés',
        'Les en-têtes sont posés mais écrasés par le serveur frontal',
        'Les en-têtes ne s’appliquent qu’aux routes déclarées après',
      ],
      answer: 1,
      explain: 'Les intergiciels d’Express s’appliquent dans l’ordre de montage : celui-ci arrive trop tard pour tout le monde. Le défaut traverse une revue de configuration et ne se voit qu’en regardant les en-têtes réellement servis.',
    },
    {
      q: 'Qu’est-ce qui rend une sauvegarde réellement utile après un incident ?',
      options: [
        'Sa fréquence, qui détermine la quantité de données perdues',
        'Son chiffrement, qui la protège en cas de vol du support',
        'Le fait qu’elle survive à la compromission de ce qu’elle sauvegarde',
        'Sa durée de conservation, alignée sur les obligations légales',
      ],
      answer: 2,
      explain: 'Une sauvegarde accessible depuis le compte compromis est chiffrée avec les données : compte séparé, écriture unique, et restauration testée. Les trois autres critères comptent, et aucun ne sauve ce cas.',
    },
    {
      q: 'Quelle pratique d’exploitation réduit le plus la fenêtre d’un secret volé ?',
      options: [
        'Une rotation planifiée des secrets à intervalle régulier',
        'Des identifiants de courte durée, émis à la demande',
        'Un stockage des secrets dans un gestionnaire dédié',
        'Une surveillance des usages anormaux des identifiants',
      ],
      answer: 1,
      explain: 'Un secret qui expire en une heure ne vaut presque rien volé. La rotation trimestrielle est le premier rituel abandonné, et le gestionnaire protège le stockage, pas l’usage.',
    },
  ],

  m27: [
    {
      q: 'Novafact confie sa surveillance 24 h/24 à un prestataire de détection et réponse managées (MDR). Que doit-elle garder en interne ?',
      options: [
        'La connaissance du normal de l’application et les décisions métier comme bloquer un tenant',
        'L’écriture de toutes les règles de détection, que le prestataire ne peut pas maintenir',
        'La collecte des journaux, que le prestataire ne doit jamais recevoir en clair',
        'Le tri de niveau 1, pour garder la maîtrise des faux positifs de l’application',
      ],
      answer: 0,
      explain: 'Le prestataire peut collecter, détecter et même contenir dans un périmètre convenu ; il ne sait pas ce qui est normal pour l’application, ni s’il faut couper le service d’un client. Le contrat dit qui joindre et quels gestes il fait seul. Les règles d’infrastructure, la collecte et le tri sont précisément ce qu’on lui confie ; seules les détections applicatives demandent l’équipe interne.',
    },
    {
      q: 'Qu’est-ce qui rend un événement applicatif exploitable par un analyste du SOC ?',
      options: [
        'Un nom d’action stable, l’utilisateur, son tenant et le propriétaire de l’objet visé',
        'Un message libre détaillé, qui décrit en phrases complètes ce qui s’est passé',
        'L’URL complète de la requête, avec ses paramètres, pour rejouer l’appel',
        'Le corps de la requête et de la réponse, pour reconstituer toute l’interaction',
      ],
      answer: 0,
      explain: 'L’analyste doit décider vite sans ouvrir le code : quoi, qui, sur quoi, d’où, dans quel contexte. Un champ d’action stable se compte et se corrèle ; un message libre ne se règle pas dans une détection. L’URL complète peut porter un jeton de partage, et les corps de requête contiennent des données personnelles qu’on ne journalise pas.',
    },
    {
      q: 'Un avis décrit une campagne avec des empreintes de webshell et un comportement : création d’un compte administrateur au nom anodin. Quelle détection durera le plus longtemps ?',
      options: [
        'Une règle sur la création d’un compte privilégié hors du processus normal, dans l’application',
        'Une recherche des empreintes publiées dans les journaux de tous les serveurs exposés',
        'Un blocage des adresses IP sources listées dans l’avis sur le pare-feu applicatif',
        'Un blocage du nom de fichier du webshell sur tous les serveurs de l’application',
      ],
      answer: 0,
      explain: 'Le comportement se situe en haut de la Pyramid of Pain : l’attaquant doit changer de méthode pour l’éviter, et c’est l’application qui le voit la première si elle journalise la création de comptes. Les empreintes, les IP et les noms de fichiers changent d’une variante à l’autre ; ils servent à une recherche rétroactive, pas à une détection durable.',
    },
    {
      q: 'Un pair partage un rapport d’incident marqué TLP:AMBER+STRICT. Qui peut le lire chez Novafact ?',
      options: [
        'Les personnes de Novafact qui en ont besoin, mais pas ses clients',
        'Les personnes de Novafact et les clients concernés, au besoin d’en connaître',
        'Seul le destinataire nommé, sans aucune rediffusion en interne',
        'Toute la communauté sectorielle de Novafact, mais pas le public',
      ],
      answer: 0,
      explain: 'AMBER+STRICT limite la diffusion à l’organisation destinataire, au besoin d’en connaître. AMBER sans STRICT autorise aussi ses clients ; RED limite au destinataire individuel ; GREEN ouvre à la communauté. Le rapport ne peut donc pas finir dans un message aux tenants ni dans un post-mortem publié.',
    },
    {
      q: 'Une chasse vérifie si des objets S3 ont été copiés par un rôle volé, mais les événements de données S3 n’étaient pas activés sur ce bucket. Comment la conclure ?',
      options: [
        'Échouée faute de données, avec une demande d’activer la journalisation manquante',
        'Réfutée, puisque CloudTrail ne montre aucune copie d’objet sur la période',
        'Prouvée par précaution, puisque l’absence de journal ne permet pas d’exclure la copie',
        'Abandonnée sans trace écrite, puisqu’elle n’a produit aucun résultat exploitable',
      ],
      answer: 0,
      explain: 'Sans événements de données, CloudTrail ne voit que les appels de gestion : l’absence de copie n’est pas une observation, c’est un angle mort. Conclure à une réfutation serait faux, et à une preuve aussi. La chasse échouée produit pourtant la recommandation la plus utile, activer la journalisation, et sa fiche évite de la refaire à l’aveugle.',
    },
  ],

  m18: [
    {
      q: 'Pourquoi normaliser les journaux dans un schéma commun avant de les indexer ?',
      options: [
        'Pour réduire le volume stocké et le coût de l’indexation',
        'Pour pouvoir écrire une détection qui traverse plusieurs sources',
        'Pour respecter les obligations de conservation réglementaires',
        'Pour permettre le chiffrement homogène des champs sensibles',
      ],
      answer: 1,
      explain: 'Sans champs communs, une règle doit être réécrite pour chaque source, et une corrélation devient impossible. La normalisation est ce qui rend la détection transposable.',
    },
    {
      q: 'Douze requêtes saturent trois instances. Qu’est-ce que cela indique ?',
      options: [
        'Un déni de service distribué de faible volume',
        'Une fuite de mémoire déclenchée par une entrée particulière',
        'Un coût unitaire de requête anormalement élevé',
        'Une défaillance du répartiteur de charge en amont',
      ],
      answer: 2,
      explain: 'Ce n’est pas le volume qui fait le déni de service, c’est le prix d’une requête — ici probablement un motif à retour arrière catastrophique. Une boucle d’événements bloquée avec un tas stable écarte la fuite mémoire.',
    },
    {
      q: 'Un développeur journalise le corps complet des requêtes de connexion pour faciliter le débogage. Quel est le problème principal ?',
      options: [
        'Les mots de passe se retrouvent dans les journaux, lisibles par bien plus de monde',
        'Le volume des journaux explose et le coût du SIEM devient difficile à justifier',
        'Les journaux ne sont plus au format ECS et les règles de détection ne les lisent plus',
        'Le temps de réponse de l’API augmente à cause de l’écriture synchrone des journaux',
      ],
      answer: 0,
      explain: 'Un journal est copié, indexé, exporté et lu par des équipes qui n’ont aucun besoin des secrets : y écrire des mots de passe en fait une seconde base d’identifiants, moins protégée. Le volume, le format et la latence sont de vrais sujets, mais se corrigent ; une fuite d’identifiants, non.',
    },
  ],

  m28: [
    {
      q: 'Qu’est-ce qu’un honeytoken apporte qu’une règle de détection classique n’apporte pas ?',
      options: [
        'Une alerte sans faux positif, puisque rien de légitime n’y touche',
        'Une couverture des techniques d’attaque encore inconnues',
        'Une preuve recevable de l’intention malveillante de l’auteur',
        'Une détection plus rapide que l’analyse des journaux applicatifs',
      ],
      answer: 0,
      explain: 'Personne n’a de raison légitime de lire un identifiant qui n’existe pour rien : le signal est net là où les seuils produisent du bruit. C’est ce qui en fait une des rares détections qu’on peut mettre en alerte immédiate.',
    },
    {
      q: 'Une détection alerte sur cinquante connexions échouées par minute. Quel est le principal défaut ?',
      options: [
        'Le seuil est trop bas et générera trop de faux positifs',
        'Le seuil compte une unité que l’attaquant contrôle',
        'La fenêtre d’une minute est trop courte pour être fiable',
        'La règle ne distingue pas les comptes à privilège des autres',
      ],
      answer: 1,
      explain: 'Un bourrage d’identifiants répartit ses essais : quarante-neuf par minute passent indéfiniment. Un seuil n’est bon que si l’unité comptée est coûteuse pour l’attaquant.',
    },
    {
      q: 'Que mesure le temps de résidence (dwell time) ?',
      options: [
        'Le délai entre l’alerte et la prise en charge par l’astreinte',
        'La durée pendant laquelle un attaquant est resté inaperçu',
        'Le temps nécessaire pour restaurer le service après un incident',
        'La durée de conservation des journaux dans l’index chaud',
      ],
      answer: 1,
      explain: 'C’est la métrique qui dit si la détection sert à quelque chose : elle se compte en semaines dans la plupart des incidents, et l’absence de signalement client n’en est pas une preuve.',
    },
  ],

  m29: [
    {
      q: 'Une clé d’accès AWS d’un pipeline de CI est signalée comme exposée. Quel est le premier geste le plus sûr ?',
      options: [
        'La désactiver sans la supprimer, puis chercher ce qu’elle a pu créer comme autre accès',
        'La supprimer immédiatement, pour qu’elle ne puisse plus jamais être utilisée',
        'Attendre la fin de l’enquête pour ne pas alerter l’attaquant qui l’utilise',
        'Changer le mot de passe console de l’utilisateur IAM propriétaire de la clé',
      ],
      answer: 0,
      explain: 'Désactiver coupe l’accès de façon réversible et garde l’identifiant pour la recherche dans CloudTrail ; la vraie question vient ensuite : l’attaquant a-t-il créé une autre clé, un profil de connexion, une relation de confiance ? Supprimer tout de suite fait perdre la réversibilité si une application casse. Attendre laisse l’accès ouvert. Le mot de passe console n’a aucun effet sur une clé d’accès.',
    },
    {
      q: 'Vendredi à 19 h, Novafact établit qu’un tiers a lu des factures de plusieurs tenants. Pour ces données, elle est sous-traitant au sens du RGPD. Que faut-il faire ce soir-là ?',
      options: [
        'Prévenir chaque tenant touché avec ce qui est établi, sans attendre la fin de l’enquête',
        'Notifier la CNIL au nom des tenants, puisque c’est Novafact qui a subi l’incident',
        'Attendre le rapport complet de lundi pour ne transmettre que des faits certains',
        'Publier un communiqué général à tous les clients, sans distinguer les tenants touchés',
      ],
      answer: 0,
      explain: 'Le sous-traitant prévient le responsable du traitement dans les meilleurs délais ; chaque tenant a ensuite ses propres 72 heures pour notifier la CNIL, et le retard du sous-traitant ne l’excuse pas. Notifier à sa place n’est pas le rôle de Novafact. Attendre lundi consomme le délai des tenants. Un communiqué général n’apporte pas à chaque tenant ce dont il a besoin pour notifier.',
    },
    {
      q: 'En pleine crise, un client demande si ses données ont été lues ; l’enquête ne le sait pas encore. Quelle réponse protège le mieux la suite de la crise ?',
      options: [
        'Dire ce qui est établi, ce qui ne l’est pas, ce qui est fait, et fixer le prochain point',
        'Répondre que rien n’indique un accès à ses données, pour éviter une inquiétude inutile',
        'Ne rien dire tant que l’enquête n’a pas conclu, pour ne pas engager l’entreprise',
        'Transmettre le détail technique de l’attaque, pour montrer que la situation est maîtrisée',
      ],
      answer: 0,
      explain: 'Un message sous incertitude sépare l’établi de l’inconnu et donne un rendez-vous : il reste vrai quand l’enquête avance. Une réponse rassurante qu’il faudra corriger détruit la crédibilité des messages suivants. Le silence prive le client des moyens de protéger ses propres clients. Le détail technique n’aide pas le client et peut servir à d’autres attaquants.',
    },
    {
      q: 'Un client a été victime d’une prise de contrôle de compte. Son mot de passe a été réinitialisé. Qu’est-ce qui peut encore donner accès à l’attaquant ?',
      options: [
        'Les sessions déjà ouvertes, les jetons de rafraîchissement et les clés d’API émis',
        'Rien : la réinitialisation du mot de passe invalide tous les accès du compte',
        'Uniquement le cookie de la session courante du client, qui expirera de lui-même',
        'Uniquement un second facteur ajouté par l’attaquant, si le client en a un',
      ],
      answer: 0,
      explain: 'Changer un mot de passe ne révoque ni les sessions en cours, ni les jetons OAuth de rafraîchissement, ni les clés d’API d’intégration, sauf si l’application le prévoit explicitement. D’où la nécessité d’un geste de révocation par utilisateur et par tenant, testé à l’avance. Le second facteur ajouté est un risque réel, mais pas le seul, et une session volée n’attend pas d’expirer pour servir.',
    },
    {
      q: 'Le post-mortem d’une fuite inter-tenants conclut à une « erreur humaine : contrôle d’appartenance oublié ». Que faut-il en faire ?',
      options: [
        'Chercher ce qui a permis l’oubli, ce qui ne l’a pas arrêté et ce qui a retardé sa détection',
        'Nommer le développeur dans le rapport, pour qu’il porte lui-même l’action corrective',
        'Clore le post-mortem, puisque la cause racine est identifiée et le correctif déployé',
        'Programmer une formation de toute l’équipe, seule action à la hauteur de la cause',
      ],
      answer: 0,
      explain: 'L’oubli est le point de départ de l’analyse : une couche d’accès aux données qui n’impose pas le tenant, l’absence de test inter-tenants, une détection absente produisent des actions qui ne dépendent plus de la vigilance d’une personne. Nommer un coupable apprend surtout aux équipes à se taire. Clore sur l’erreur humaine laisse les causes en place, et une formation sans critère de clôture n’est pas vérifiable.',
    },
  ],

  m05: [
    {
      q: 'Deux vulnérabilités ont un score CVSS de 9,8. Qu’est-ce qui doit départager leur priorité ?',
      options: [
        'La date de publication : la plus ancienne se corrige en premier',
        'Le nombre de dépôts de l’organisation qui embarquent le composant',
        'L’exploitation observée et l’atteignabilité du code vulnérable',
        'La facilité de la mise à jour et le risque de régression associé',
      ],
      answer: 2,
      explain: 'CVSS mesure la gravité intrinsèque, pas le risque : EPSS dit la probabilité d’exploitation, l’analyse d’atteignabilité dit si le chemin existe dans l’application. Le coût de correction arbitre ensuite, il ne priorise pas.',
    },
    {
      q: 'À quoi sert un document VEX ?',
      options: [
        'À déclarer qu’une vulnérabilité connue n’est pas exploitable chez soi',
        'À inventorier les composants livrés dans une version du produit',
        'À publier le correctif et les versions affectées d’un produit',
        'À prouver la provenance d’un artefact produit par le pipeline',
      ],
      answer: 0,
      explain: 'Le VEX porte une affirmation d’exploitabilité, et c’est ce qui le rend dangereux : il propage une erreur avec autorité si on l’émet sans avoir vérifié. Les trois autres descriptions sont celles du SBOM, de l’avis de sécurité et de l’attestation.',
    },
    {
      q: 'Un SLA de correction est régulièrement dépassé. Quelle réaction est la plus saine ?',
      options: [
        'Remonter le dépassement au comité de direction chaque mois',
        'Allonger le SLA pour qu’il corresponde à la capacité réelle',
        'Comprendre où le délai se consume avant de toucher au chiffre',
        'Automatiser les mises à jour pour retirer l’humain de la boucle',
      ],
      answer: 2,
      explain: 'Un SLA dépassé est un symptôme : l’attente est peut-être dans la qualification, la recette ou la fenêtre de déploiement. Allonger ou escalader avant de savoir ne change que le ressenti.',
    },
    {
      q: 'Pourquoi conserver le SBOM de chaque version publiée plutôt que de le générer à la demande ?',
      options: [
        'Parce que la génération est trop coûteuse pour être refaite souvent',
        'Parce que le format évolue et qu’un ancien SBOM reste lisible',
        'Parce que le règlement impose de le publier avec le produit',
        'Parce qu’on doit pouvoir dire ce qu’on avait livré à une date passée',
      ],
      answer: 3,
      explain: 'Quand une CVE tombe, la question est « quelle version avions-nous livrée le 3 mars ». Un SBOM régénéré aujourd’hui décrit l’arbre d’aujourd’hui, et cette réponse-là est perdue.',
    },
    {
      q: 'Une CVE critique touche une bibliothèque XML que l’équipe dit ne jamais utiliser. Que faut-il faire ?',
      options: [
        'Enregistrer la qualification en VEX et la revalider plus tard',
        'Vérifier avec l’équipe les points d’entrée qui reçoivent du XML',
        'Mettre à jour quand même, le correctif coûtant peu de temps',
        'Classer la CVE en attente jusqu’à la prochaine revue mensuelle',
      ],
      answer: 1,
      explain: 'Leur conclusion est une hypothèse testable, et un contre-exemple concret vaut mieux qu’un arbitrage. Patcher systématiquement apprend à l’équipe à ne plus qualifier — ce qu’on veut précisément leur faire faire.',
    },
  ],

  m19: [
    {
      q: 'Pourquoi l’injection de prompt indirecte est-elle plus dangereuse que la directe ?',
      options: [
        'Parce qu’elle contourne les garde-fous entraînés dans le modèle',
        'Parce que l’instruction arrive par une donnée que la victime a demandée',
        'Parce qu’elle est plus difficile à détecter dans les journaux',
        'Parce qu’elle permet d’extraire le prompt système de l’application',
      ],
      answer: 1,
      explain: 'L’utilisateur n’a rien écrit de malveillant : l’instruction vit dans un document, une page ou un ticket, et l’action se déclenche avec SON identité. C’est ce qui en fait un problème d’autorisation autant que de modèle.',
    },
    {
      q: 'Quelle défense contre l’injection de prompt tient le mieux ?',
      options: [
        'Un encadrement du contenu externe par des délimiteurs explicites',
        'Un filtre qui détecte les formulations d’instruction dans l’entrée',
        'Une limitation des droits de l’agent, indépendante du modèle',
        'Un second modèle qui vérifie la sortie avant de l’exécuter',
      ],
      answer: 2,
      explain: 'Les trois autres sont probabilistes : un délimiteur se referme, un filtre se contourne par encodage, un vérificateur se trompe. Seule la réduction du rayon d’action ne dépend pas de la réussite du modèle.',
    },
    {
      q: 'Qu’est-ce que l’empoisonnement d’un index RAG ?',
      options: [
        'L’insertion de documents qui orientent les réponses du système',
        'La saturation de l’index par un volume anormal de documents',
        'La suppression de documents pour provoquer des réponses fausses',
        'L’extraction des documents indexés par des requêtes successives',
      ],
      answer: 0,
      explain: 'Peu de documents bien placés suffisent à retourner une réponse, et l’index survit souvent à la suppression de la source. D’où l’importance de la provenance des documents et de la fraîcheur de l’index.',
    },
    {
      q: 'Une sortie de modèle est rendue en HTML dans l’interface. Quel est le risque ?',
      options: [
        'Le modèle peut révéler des données d’autres utilisateurs',
        'La sortie peut contenir du balisage exécuté par le navigateur',
        'Le rendu peut dépasser la limite de contexte du modèle',
        'La mise en forme peut trahir le prompt système utilisé',
      ],
      answer: 1,
      explain: 'Une sortie de modèle est une entrée utilisateur comme une autre : la traiter comme du contenu de confiance produit une XSS, et une image en Markdown suffit à exfiltrer vers un domaine externe.',
    },
  ],

  m30: [
    {
      q: 'Un agent dispose d’un outil de remboursement. Quel contrôle est proportionné ?',
      options: [
        'Interdire l’outil et traiter les remboursements manuellement',
        'Exiger une confirmation humaine avant l’exécution de l’action',
        'Limiter le nombre d’appels à l’outil par conversation',
        'Journaliser chaque appel pour analyse a posteriori',
      ],
      answer: 1,
      explain: 'Interdire rend l’outil inutile ; compter les appels et journaliser ne bloquent pas le premier remboursement frauduleux. La confirmation place un humain là où l’action devient irréversible.',
    },
    {
      q: 'Un serveur MCP tiers déjà approuvé modifie la description d’un de ses outils. Pourquoi est-ce un risque, même si le code de l’outil ne change pas ?',
      options: [
        'La description est lue par le modèle et peut lui donner des instructions cachées',
        'La description modifiée invalide la signature du paquet installé par l’hôte',
        'Le client MCP doit alors renégocier la session et perd l’historique de l’agent',
        'L’utilisateur reçoit une nouvelle demande d’approbation qu’il risque de refuser',
      ],
      answer: 0,
      explain: 'Le modèle lit les descriptions d’outils comme du contexte : une description changée après approbation (rug pull) peut lui ordonner de lire ou d’envoyer des données sans qu’aucune ligne de code ne bouge. Rien n’oblige un client à redemander l’approbation, et la révision 2026-07-28 de la spécification n’a plus de session au niveau du protocole.',
    },
    {
      q: 'Un serveur MCP reçoit un jeton d’accès de l’utilisateur et doit appeler l’API GitHub. Que fait-il du jeton reçu ?',
      options: [
        'Il vérifie qu’il lui est destiné, puis obtient un jeton distinct pour appeler GitHub',
        'Il le transmet tel quel à GitHub, qui vérifiera lui-même sa validité et ses droits',
        'Il l’échange contre un jeton GitHub de même durée, signé avec sa propre clé',
        'Il le stocke chiffré et le réutilise pour les appels suivants de cet utilisateur',
      ],
      answer: 0,
      explain: 'La spécification MCP interdit le token passthrough : le serveur vérifie l’audience et n’accepte que les jetons émis pour lui ; pour l’API en aval, il agit comme un client OAuth distinct, avec son propre jeton. Relayer le jeton brouille les journaux et contourne les contrôles de l’aval, et un serveur MCP ne peut pas signer un jeton GitHub.',
    },
  ],

  m31: [
    {
      q: 'Un serveur MCP distant reçoit un jeton signé par le bon serveur d’autorisation, non expiré, émis pour l’API des factures de la même entreprise. Que doit-il faire ?',
      options: [
        'Le refuser par un 401 : il n’a pas été émis pour ce serveur MCP',
        'L’accepter, puis le relayer à l’API des factures dont il est l’audience',
        'L’accepter en lecture seule, puisque l’émetteur est de confiance',
        'Répondre 403 insufficient_scope pour obtenir un jeton plus large',
      ],
      answer: 0,
      explain: 'Le serveur MCP doit vérifier que le jeton lui est destiné et refuser tout autre jeton ; le relayer vers l’aval serait du token passthrough, interdit par la spec. Le 403 insufficient_scope concerne un jeton valide pour ce serveur mais aux scopes insuffisants.',
    },
    {
      q: 'Au retour d’autorisation, le paramètre iss vaut https://auth.example.com/ alors que le client a enregistré https://auth.example.com. Que fait un client conforme à la révision 2026-07-28 ?',
      options: [
        'Il rejette la réponse sans utiliser le code ni afficher l’erreur',
        'Il accepte, la normalisation d’URL rendant les deux valeurs égales',
        'Il accepte le code et vérifie plutôt l’issuer de l’ID token reçu',
        'Il relance la découverte pour savoir quelle forme est la bonne',
      ],
      answer: 0,
      explain: 'La comparaison de iss est une comparaison de chaînes simple, sans aucune normalisation, faite avant d’envoyer le code à un endpoint de jeton. Vérifier l’ID token arrive trop tard, et relancer la découverte laisserait la réponse suspecte guider le client.',
    },
    {
      q: 'Un client MCP ouvre l’URL d’autorisation par exec(`start ${url}`). Quel correctif ferme réellement la classe de CVE-2025-6514 ?',
      options: [
        'N’accepter que https (http en boucle locale) et ouvrir sans shell',
        'Refuser les URL qui commencent par javascript: ou par file:',
        'Échapper les guillemets de l’URL avant de construire la commande',
        'Vérifier que l’URL est servie en HTTPS avec un certificat valide',
      ],
      answer: 0,
      explain: 'Le problème est double : un schéma dangereux et un interpréteur de commandes qui lit l’URL. Une liste noire laisse passer d’autres schémas et les sous-expressions du shell ; l’échappement des guillemets ne neutralise pas $(…) ; un certificat valide ne dit rien du contenu de l’URL.',
    },
    {
      q: 'Un proxy MCP utilise un client_id statique auprès d’une API tierce et accepte l’enregistrement dynamique de clients. Quelle mesure bloque le vol de code par confused deputy ?',
      options: [
        'Un consentement propre au proxy, par client_id, avant d’aller chez l’AS tiers',
        'Un cookie de consentement global qui retient que l’utilisatrice a approuvé le proxy',
        'Un state posé dès l’arrivée sur /authorize, puis vérifié au retour de l’AS tiers',
        'Une redirect_uri vérifiée par préfixe contre celle déclarée à l’enregistrement',
      ],
      answer: 0,
      explain: 'L’attaque exploite le consentement déjà donné au client_id statique du proxy : seul un consentement par client MCP, demandé avant la redirection, l’interrompt. Un cookie global reproduit le défaut, un state posé avant le consentement rend l’écran décoratif, et une comparaison par préfixe laisse passer un hôte d’attaquant.',
    },
    {
      q: 'Le serveur MCP de Novafact publie ses quarante scopes dans scopes_supported et n’envoie pas de scope dans son 401. Quel est l’effet sur les clients ?',
      options: [
        'Ils demandent les quarante scopes d’emblée et obtiennent des jetons maximaux',
        'Ils demandent le scope du premier outil appelé, puis élèvent au fil de l’eau',
        'Ils refusent de continuer, faute de savoir quel scope demander en premier',
        'Ils laissent le serveur d’autorisation choisir le sous-ensemble minimal utile',
      ],
      answer: 0,
      explain: 'Sans scope dans le challenge, la spec fait demander tout scopes_supported, censé être l’ensemble minimal d’un usage de base : publier le catalogue produit donc des jetons omnipotents. Le step-up par outil suppose que le serveur émette des challenges ciblés, et rien n’oblige l’AS à réduire la demande.',
    },
  ],

  m06: [
    {
      q: 'Un lead dev demande de désactiver une règle SAST pour un faux positif, une heure avant une démo. Que faut-il faire ?',
      options: [
        'Poser l’annotation d’exception avec une échéance à 90 jours',
        'Regarder le code avec lui, puis annoter ou corriger ensemble',
        'Désactiver la règle sur son dépôt et la remettre après la démo',
        'Maintenir le blocage : les règles existent pour une raison',
      ],
      answer: 1,
      explain: 'Trente secondes de lecture décident, et débloquent aussi vite dans les deux cas. Signer un faux positif sans l’avoir vu engage la signature de l’AppSec ; désactiver la règle retire le contrôle pour des lignes que personne n’a regardées.',
    },
    {
      q: 'Qu’est-ce qu’une « paved road » en sécurité applicative ?',
      options: [
        'Un ensemble de règles obligatoires appliquées par la CI',
        'Un catalogue de solutions validées, documentées pour les équipes',
        'Le chemin le plus simple, qui se trouve être le plus sûr',
        'Une architecture de référence imposée aux nouveaux services',
      ],
      answer: 2,
      explain: 'La route pavée ne se décrète pas, elle s’emprunte : si le template sûr demande plus d’effort que le raccourci, personne ne le prend. C’est un problème d’ergonomie avant d’être un problème de politique.',
    },
    {
      q: 'La direction demande « combien de vulnérabilités avons-nous ». Quelle réponse sert le mieux le programme ?',
      options: [
        'Le décompte exact, ventilé par sévérité et par équipe',
        'Un objectif de zéro critique à six mois, avec un plan associé',
        'Le délai de correction des critiques exposées, et sa tendance',
        'La couverture des outils d’analyse sur le parc applicatif',
      ],
      answer: 2,
      explain: 'Un décompte mélange une dépendance de test et une BOLA exposée, et se fait baisser en reclassant des tickets. S’engager sur zéro critique revient à promettre ce qu’une CVE de demain peut démentir.',
    },
    {
      q: 'Une développeuse affirme qu’une XSS est du self-XSS et refuse de corriger. Quelle réponse fait avancer ?',
      options: [
        'Rappeler que toute XSS est traitée comme une vulnérabilité réelle',
        'Montrer que l’absence de protection CSRF en fait une XSS stockée',
        'Fermer le ticket et le rouvrir si un cas d’exploitation apparaît',
        'Le classer en faible et le revoir lors du prochain audit annuel',
      ],
      answer: 1,
      explain: 'Elle a raison sur son finding et tort sur le périmètre : on n’oppose pas une règle, on ajoute le maillon qui manquait — vérifiable en une minute. Traiter toutes les XSS pareil coûte la crédibilité sur les priorités.',
    },
  ],

  m32: [
    {
      q: 'Quelle métrique reflète le mieux l’effet d’un programme AppSec ?',
      options: [
        'Le nombre de vulnérabilités découvertes par trimestre',
        'Le taux de couverture du SAST sur les dépôts de l’organisation',
        'Le délai de correction des critiques réellement exposées',
        'Le nombre de développeurs formés à la sécurité applicative',
      ],
      answer: 2,
      explain: 'Les trois autres mesurent l’activité, pas le résultat — et elles montent quand on outille davantage, même si rien ne s’améliore. Un délai de correction se dégrade honnêtement quand ça va mal.',
    },
    {
      q: 'Le Cyber Resilience Act impose une alerte précoce. Quel est le déclencheur ?',
      options: [
        'La découverte d’une vulnérabilité critique dans le produit',
        'La publication d’un correctif pour une vulnérabilité connue',
        'Un incident ayant entraîné une fuite de données personnelles',
        'Une vulnérabilité activement exploitée dans une version publiée',
      ],
      answer: 3,
      explain: 'Ce n’est ni la gravité ni la découverte qui déclenche : c’est l’exploitation active d’une version mise sur le marché. La fuite de données relève du RGPD, avec ses propres délais.',
    },
    {
      q: 'Une équipe demande une exception pour livrer malgré un finding élevé. Qu’est-ce qui rend l’exception acceptable ?',
      options: [
        'Un propriétaire du risque nommé, une date d’expiration et une mesure compensatoire',
        'L’accord écrit du lead dev de l’équipe qui porte la fonctionnalité à livrer',
        'Une note CVSS environnementale recalculée qui ramène le finding au niveau moyen',
        'L’ajout du finding au backlog de l’équipe avec une priorité haute et un ticket',
      ],
      answer: 0,
      explain: 'Une exception est une acceptation de risque temporaire : sans propriétaire au bon niveau, sans échéance et sans compensation, elle devient permanente. L’accord du lead dev n’est pas celui de qui porte le risque, un recalcul de score change l’étiquette et pas l’exposition, et un ticket sans date reste un ticket.',
    },
  ],

  m20: [
    {
      q: 'Un rapport de pentest liste trente findings. Comment le présenter au produit ?',
      options: [
        'Les trois critiques d’abord, le reste au trimestre suivant',
        'Un atelier de qualification des trente avec l’équipe produit',
        'Les classes auxquelles ils appartiennent, corrigées à la racine',
        'La liste complète, triée par effort de correction croissant',
      ],
      answer: 2,
      explain: 'Vingt-deux findings sur trente tombent souvent dans trois classes : trois corrections de fond valent mieux que trente correctifs. Et le produit obtient ce qu’il demandait — trois lignes dans son backlog.',
    },
    {
      q: 'Qu’est-ce qui distingue une revue de sécurité complète d’une somme d’exercices ?',
      options: [
        'Le nombre de domaines techniques qu’elle couvre',
        'Le fait que chaque étape réutilise les livrables des précédentes',
        'La présence d’une restitution formelle à la direction',
        'Le recours à des outils d’analyse sur l’ensemble du code',
      ],
      answer: 1,
      explain: 'C’est le chaînage qui la rend vérifiable : le modèle de menaces relit la classification, le plan relit les constats de la revue de code. Une incohérence entre deux étapes se voit alors toute seule.',
    },
    {
      q: 'Deux travaux se disputent le même trimestre. Sur quoi arbitrer ?',
      options: [
        'Sur la sévérité la plus élevée des défauts concernés',
        'Sur la réduction de risque obtenue par unité d’effort',
        'Sur l’ancienneté des constats dans le backlog de sécurité',
        'Sur la préférence exprimée par l’équipe qui portera le travail',
      ],
      answer: 1,
      explain: 'La sévérité ignore le coût, et un contrôle de classe peu coûteux bat souvent la correction d’un défaut critique isolé. C’est l’essentiel du métier : choisir, et savoir dire pourquoi.',
    },
    {
      q: 'Comment mesurer l’adoption d’un contrôle de classe ?',
      options: [
        'Au nombre d’équipes formées à son usage',
        'À la part des services qui empruntent le chemin sûr par défaut',
        'Au nombre de correctifs appliqués depuis son introduction',
        'À la réduction du nombre d’alertes de l’outil d’analyse',
      ],
      answer: 1,
      explain: 'Un contrôle n’existe que s’il est impossible à oublier : ce qui compte est la proportion de code qui passe par le template sûr, pas le nombre de personnes qui savent qu’il existe.',
    },
    {
      q: 'Une restitution à la direction doit se terminer par quoi ?',
      options: [
        'Un état des lieux chiffré de la posture de sécurité',
        'Une décision demandée, avec ses options et leur coût',
        'Une liste des risques acceptés sur la période écoulée',
        'Une comparaison avec les pratiques du secteur',
      ],
      answer: 1,
      explain: 'Une direction n’a pas besoin d’un tableau de bord, elle a besoin d’arbitrer. Une restitution qui ne demande rien est un rapport d’activité, et elle sera lue comme tel.',
    },
  ],
};

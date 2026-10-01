// Documents du jeu « Design Review Simulator ».
//
// Le jeu suit la revue de conception de Kohnfelder (*Designing Secure
// Software*, chapitre 7) : lire le document et repérer les phrases qui posent un
// problème (Study, Inquire, Identify), prioriser les constats en Must, Ought ou
// Should (Write), puis les défendre face au designer qui conteste
// (Collaborate). Une série = un design doc.
//
// La difficulté ne vient pas du sujet. Elle vient de l'endroit où se cache le
// défaut — dans la phrase, entre deux phrases, ou dans ce que le document ne
// dit pas — et du nombre de phrases qui ont l'air fautives sans l'être.
//
//   N1 · Doc court. Chaque défaut est écrit en toutes lettres dans une seule
//        phrase (« public », « n'expire pas », « séquentiel »), et les bonnes
//        décisions sont évidentes. On apprend le geste : lire phrase à phrase,
//        signaler, prioriser.
//
//   N2 · Doc plus long. Certains défauts demandent de relier deux phrases (un
//        lien au porteur, et ce que la page permet de faire), et le document
//        contient au moins une demi-mesure (une limite par IP, un suivi des
//        plaintes) ou une décision saine qui ressemble à une faute. Les
//        objections du designer ont chacune une réponse à moitié juste.
//
//   N3 · Doc solide en apparence : les réflexes classiques sont cochés
//        (signature, ré-authentification, bibliothèque maintenue). Les défauts
//        sont dans l'interaction entre deux composants ou dans une hypothèse
//        implicite, et au moins un constat « tentant » ne tient pas : le
//        signaler coûte des points, et la note dit pourquoi.

import { defineSeries, type Leveled, type SeriesProfile } from '../lib/series';

export type Priority = 'must' | 'ought' | 'should';

export interface Statement {
  id: string;
  text: string;
  issue?: { priority: Priority; finding: string };
  /** Pour une phrase saine : pourquoi elle l'est, surtout quand elle a l'air fautive. */
  note?: string;
}
export interface DocSection { title: string; statements: Statement[] }
export interface Pushback { statementId: string; objection: string; replies: { text: string; points: 0 | 1 | 2; why: string }[] }
export interface ReviewDoc extends Leveled {
  title: string;
  intro: string;
  /** Qui défend le document pendant la revue. */
  designer: string;
  sections: DocSection[];
  pushbacks: Pushback[];
}

export const reviewDocs: ReviewDoc[] = [
  // ── N1 ────────────────────────────────────────────────────────────────────
  {
    id: 'partage', title: 'Partage public de factures', level: 1, designer: 'Inès, développeuse front',
    intro: 'Inès propose un lien de partage pour montrer une facture à un client final qui n’a pas de compte Novafact.',
    sections: [
      { title: 'Objectif', statements: [
        { id: 'p1', text: 'Un utilisateur peut générer un lien de partage d’une facture, pour l’envoyer à un client final qui n’a pas de compte Novafact.' },
      ] },
      { title: 'Le lien', statements: [
        { id: 'p2', text: 'Le lien a la forme /share/{invoiceId}, où invoiceId est le numéro séquentiel de la facture.',
          issue: { priority: 'must', finding: 'Un numéro séquentiel se devine : le lien doit porter un jeton aléatoire d’au moins 128 bits, sans rapport avec l’identifiant. En 2019, First American Financial a exposé ainsi quelque 885 millions de documents : il suffisait de changer un chiffre dans l’URL.' } },
        { id: 'p3', text: 'Le lien n’expire jamais, pour que le client retrouve sa facture quand il le souhaite.',
          issue: { priority: 'ought', finding: 'Durée de vie bornée et lien régénérable : un lien oublié dans une boîte mail ne doit pas rester une porte ouverte.' } },
        { id: 'p4', text: 'L’émetteur peut révoquer un lien depuis la fiche de la facture.',
          note: 'La révocation est le complément indispensable d’un lien au porteur : la citer comme bonne décision aide à la garder.' },
      ] },
      { title: 'La page publique', statements: [
        { id: 'p5', text: 'La page publique affiche la facture en lecture seule, sans menu ni lien vers le reste de l’application.' },
        { id: 'p6', text: 'La page affiche aussi l’historique des relances et les notes internes de la facture, pour donner du contexte au client.',
          issue: { priority: 'must', finding: 'Least Information : les notes internes ne sont pas destinées au client. La page n’affiche que ce que le PDF contient déjà.' } },
        { id: 'p7', text: 'La page est servie avec les en-têtes Referrer-Policy: no-referrer et X-Robots-Tag: noindex.',
          note: 'Le lien ne fuit pas vers les sites tiers par l’en-tête Referer et n’est pas indexé : deux protections peu coûteuses d’un lien au porteur.' },
      ] },
      { title: 'Exploitation', statements: [
        { id: 'p8', text: 'Les consultations des liens ne sont pas journalisées, pour ne pas stocker de données sur des personnes sans compte.',
          issue: { priority: 'should', finding: 'Journaliser le minimum (horodatage, adresse tronquée, lien concerné) pour repérer un lien qui circule : c’est compatible avec la minimisation.' } },
        { id: 'p9', text: 'Aucune limite de débit n’est appliquée sur /share/.',
          issue: { priority: 'ought', finding: 'Limiter le débit par adresse : c’est ce qui freine une énumération, et ça protège le service même avec des jetons aléatoires.' } },
        { id: 'p10', text: 'Le PDF téléchargé depuis la page est généré à la volée, avec les mêmes contrôles que la page.' },
      ] },
    ],
    pushbacks: [
      { statementId: 'p2', objection: 'Nos numéros de facture ont huit chiffres : personne ne tombera dessus par hasard, et un lien court passe mieux dans un e-mail.',
        replies: [
          { text: 'Huit chiffres qui se suivent se parcourent en une nuit. Un jeton aléatoire de 128 bits tient en 22 caractères : le lien reste court et ne se devine plus.', points: 2, why: 'Tu réponds à l’argument du designer (la longueur du lien) tout en retirant la cause (la prévisibilité).' },
          { text: 'Ajoutons une limite de débit sur /share/ : sans pouvoir essayer en masse, personne ne trouvera un numéro valide en un temps raisonnable.', points: 1, why: 'Ça ralentit sans corriger : un attaquant patient, réparti sur plusieurs adresses, parcourt quand même la plage, et chaque numéro trouvé reste valide.' },
          { text: 'Gardons le numéro, mais cachons-le derrière un lien court de redirection sur notre domaine, du type nfct.fr/x7Kq, pour qu’il n’apparaisse jamais dans l’e-mail.', points: 0, why: 'La redirection mène toujours à /share/{numéro} : masquer l’identifiant ne vérifie rien.' },
        ] },
      { statementId: 'p3', objection: 'Nos clients se plaignent des liens expirés chez nos concurrents ; un lien permanent, c’est un argument commercial.',
        replies: [
          { text: 'Faisons expirer le lien au bout de 15 minutes, comme les URL présignées de nos téléchargements : c’est notre standard.', points: 1, why: 'Sûr mais inutilisable : le client ouvre l’e-mail le lendemain, trouve un lien mort, et le designer aura raison de refuser.' },
          { text: 'Un lien de 90 jours, régénérable d’un clic et révoqué à l’annulation de la facture : le client ne perd rien, un lien oublié finit par mourir.', points: 2, why: 'Tu gardes l’argument commercial et tu bornes l’exposition, avec un geste simple pour le cas rare.' },
          { text: 'Un lien permanent reste acceptable, puisque l’émetteur peut toujours le révoquer depuis la fiche de la facture s’il apprend qu’il a trop circulé.', points: 0, why: 'La révocation manuelle suppose que quelqu’un sache que le lien a fuité : en pratique, personne ne révoque.' },
        ] },
    ],
  },
  {
    id: 'import-csv', title: 'Import CSV massif', level: 1, designer: 'Hugo, développeur back',
    intro: 'Hugo conçoit l’import des clients et de l’historique de factures pour les tenants qui arrivent d’un autre logiciel.',
    sections: [
      { title: 'Objectif', statements: [
        { id: 'c1', text: 'Les nouveaux tenants importent leurs clients et leurs factures historiques depuis un fichier CSV exporté de leur ancien logiciel.' },
      ] },
      { title: 'Envoi', statements: [
        { id: 'c2', text: 'Le fichier est envoyé par le navigateur au BFF, qui le transmet à l’API ; il n’y a pas de limite de taille, certains clients ayant dix ans d’historique.',
          issue: { priority: 'must', finding: 'Taille maximale et import asynchrone découpé en lots : un fichier de plusieurs gigaoctets ne doit pas occuper l’API de tous les tenants.' } },
        { id: 'c3', text: 'Le fichier est enregistré dans /tmp/imports/ sous le nom fourni par le navigateur.',
          issue: { priority: 'must', finding: 'Nom généré par le serveur : un nom comme ../../app/config.json écrit hors du dossier (traversée de chemin).' } },
        { id: 'c10', text: 'Seuls les administrateurs du tenant peuvent lancer un import.' },
      ] },
      { title: 'Traitement', statements: [
        { id: 'c4', text: 'Chaque ligne est validée par le même schéma Zod que la création manuelle d’un client.',
          note: 'Une seule règle de validation pour les deux chemins d’entrée : l’import ne devient pas une porte dérobée.' },
        { id: 'c5', text: 'La colonne tenant_id du fichier désigne le tenant de destination de chaque ligne, pour les groupes à plusieurs sociétés.',
          issue: { priority: 'must', finding: 'Le tenant vient de la session. Un import multi-sociétés vérifie chaque tenant du fichier contre ceux que l’utilisateur administre.' } },
        { id: 'c6', text: 'Les lignes en erreur sont rejetées, et le rapport indique leur numéro et la règle violée.' },
        { id: 'c8', text: 'Les factures importées sont marquées « importées » et ne peuvent plus être modifiées.' },
      ] },
      { title: 'Restitution et support', statements: [
        { id: 'c7', text: 'Le rapport d’erreurs est un CSV qui recopie telles quelles les valeurs des lignes rejetées.',
          issue: { priority: 'ought', finding: 'Injection de formules : une cellule qui commence par =, +, - ou @ s’évalue à l’ouverture dans un tableur. Neutraliser ces cellules dans tout CSV produit.' } },
        { id: 'c9', text: 'En cas d’erreur, la ligne complète est écrite dans les logs pour faciliter le support.',
          issue: { priority: 'ought', finding: 'Les lignes contiennent des IBAN et des adresses : journaliser le numéro de ligne et la règle, jamais la valeur.' } },
      ] },
    ],
    pushbacks: [
      { statementId: 'c5', objection: 'Nos clients groupes veulent importer leurs cinq filiales d’un coup ; sans la colonne tenant_id, ils font cinq imports.',
        replies: [
          { text: 'Vérifions que tous les tenant_id du fichier appartiennent au même groupe de sociétés que celui de la première ligne, et rejetons le fichier entier sinon.', points: 0, why: 'La première ligne est écrite par l’utilisateur : il choisit lui-même le groupe qu’on vérifie. La référence doit venir de la session.' },
          { text: 'Gardons l’import groupé : l’API vérifie que chaque tenant_id du fichier fait partie des sociétés que l’utilisateur administre, et rejette la ligne sinon.', points: 2, why: 'Le besoin reste servi ; le fichier choisit, le serveur autorise.' },
          { text: 'Supprimons la colonne : un import par filiale, c’est plus sûr, et cinq imports ne prennent pas beaucoup plus de temps qu’un seul.', points: 1, why: 'Sûr, mais tu refuses un besoin réel au lieu de le sécuriser : le designer reviendra avec une autre version, sans toi.' },
        ] },
      { statementId: 'c3', objection: 'On vide /tmp après chaque import, et le conteneur est éphémère : le nom du fichier n’a aucune importance.',
        replies: [
          { text: 'Le nettoyage vient après l’écriture : un nom en ../../ atterrit hors du dossier. Un nom généré par le serveur coûte une ligne, l’original reste en métadonnée.', points: 2, why: 'Tu montres pourquoi l’argument ne tient pas, et la correction ne coûte presque rien.' },
          { text: 'Retirons les « ../ » du nom avant d’écrire : le fichier restera forcément dans /tmp/imports/, et on garde le nom d’origine que l’utilisateur reconnaît.', points: 1, why: 'Une liste noire se contourne (chemin absolu, « ....// » qui redevient « ../ » après filtrage, antislash) : ne jamais construire un chemin avec un nom reçu.' },
          { text: 'D’accord : comme le conteneur est éphémère, un fichier mal placé disparaîtra de toute façon au prochain déploiement.', points: 0, why: 'Entre-temps, il a pu écraser de la configuration ou du code chargé à la volée : éphémère ne veut pas dire inoffensif.' },
        ] },
    ],
  },
  {
    id: 'export', title: 'Export comptable', level: 1, designer: 'Sacha, lead API',
    intro: 'Alix (PO) et Sacha (lead API) proposent un export CSV des factures pour les logiciels comptables des clients.',
    sections: [
      { title: 'Vue d’ensemble', statements: [
        { id: 'e1', text: 'L’export génère un fichier CSV des factures d’une période, pour le logiciel comptable du client.' },
        { id: 'e2', text: 'Le tenant est lu dans le paramètre tenantId de la requête, pour que les experts-comptables puissent gérer plusieurs clients.',
          issue: { priority: 'must', finding: 'Le tenant doit venir de la session ; l’accès multi-clients d’un expert-comptable se modélise comme une relation vérifiée côté serveur.' } },
      ] },
      { title: 'Accès', statements: [
        { id: 'e3', text: 'Tout utilisateur connecté du tenant peut déclencher un export.',
          issue: { priority: 'ought', finding: 'Restreindre l’export aux rôles administrateur et comptable (moindre privilège).' } },
        { id: 'e4', text: 'L’authentification réutilise la session existante du BFF.' },
      ] },
      { title: 'Données', statements: [
        { id: 'e5', text: 'Le CSV contient toutes les colonnes de la table invoice, y compris l’IBAN du client, pour ne rien oublier.',
          issue: { priority: 'must', finding: 'Least Information : ne pas exporter l’IBAN ni les colonnes inutiles au logiciel comptable.' } },
        { id: 'e6', text: 'Les montants sont exportés en centimes, au format entier.' },
      ] },
      { title: 'Stockage et partage', statements: [
        { id: 'e7', text: 'Le fichier est déposé dans le bucket public-exports, avec un nom aléatoire, pour simplifier le téléchargement.',
          issue: { priority: 'must', finding: 'Bucket privé et URL présignée ; un nom aléatoire n’est pas un contrôle (Transparent Design).' } },
        { id: 'e8', text: 'Le lien de téléchargement n’expire pas, pour que le client puisse le retrouver plus tard.',
          issue: { priority: 'ought', finding: 'Lien à durée courte (15 minutes) ; l’export se relance à la demande.' } },
      ] },
      { title: 'Journalisation', statements: [
        { id: 'e9', text: 'Chaque export est journalisé avec l’utilisateur, le tenant, la période et le nombre de lignes.' },
        { id: 'e10', text: 'Le contenu du CSV est aussi écrit dans les logs, pour faciliter le support.',
          issue: { priority: 'must', finding: 'Jamais de données de facturation dans les logs : ils ont une autre classification et d’autres accès.' } },
      ] },
      { title: 'Évolutions', statements: [
        { id: 'e11', text: 'Une version ultérieure enverra le fichier par e-mail à une adresse saisie par l’utilisateur.',
          issue: { priority: 'should', finding: 'Limiter l’envoi aux adresses vérifiées du tenant, sinon c’est un canal d’exfiltration.' } },
        { id: 'e12', text: 'Le traitement tourne dans le worker existant, avec son rôle IAM actuel.',
          issue: { priority: 'should', finding: 'Vérifier que le rôle du worker n’a pas plus de droits que nécessaire pour l’export.' } },
      ] },
    ],
    pushbacks: [
      { statementId: 'e2', objection: 'Les experts-comptables gèrent plusieurs clients. Si on lit le tenant dans la session, on les bloque.',
        replies: [
          { text: 'Créons un compte séparé par client pour chaque expert-comptable : une session, un tenant, et le paramètre disparaît de l’API.', points: 1, why: 'Sûr, mais l’expert jongle entre dix comptes : il finira par partager ses mots de passe ou par réclamer le paramètre.' },
          { text: 'Le besoin est légitime : modélisons la relation entre l’expert-comptable et ses clients, vérifiée côté serveur. Le paramètre choisit, il n’autorise jamais.', points: 2, why: 'Tu gardes le besoin et tu déplaces la décision au bon endroit (ReBAC, M8).' },
          { text: 'Gardons le paramètre, mais masquons-le dans l’interface et remplaçons les identifiants de tenant par des UUID aléatoires, impossibles à deviner ou à énumérer.', points: 0, why: 'Un identifiant difficile à deviner n’est pas une autorisation : il fuit dans les URL et les logs, et l’API l’accepte toujours de n’importe qui.' },
        ] },
      { statementId: 'e7', objection: 'Le bucket public simplifie tout, et les noms de fichiers sont aléatoires : personne ne les devinera.',
        replies: [
          { text: 'D’accord : avec 128 bits d’aléa dans le nom, la probabilité qu’un attaquant devine un fichier est négligeable.', points: 0, why: 'Le risque n’est pas la devinette : un nom finit par fuir (logs, historique, en-tête Referer), et un bucket public ne demande rien d’autre.' },
          { text: 'Gardons le bucket public, mais chiffrons chaque fichier avec un mot de passe envoyé par e-mail au demandeur.', points: 1, why: 'Ça réduit le risque, mais complique l’usage et laisse le bucket public.' },
          { text: 'Un nom aléatoire n’est pas un contrôle. Un bucket privé avec une URL présignée de 15 minutes garde la même simplicité pour l’utilisateur.', points: 2, why: 'Même ergonomie, vrai contrôle d’accès.' },
        ] },
    ],
  },

  // ── N2 ────────────────────────────────────────────────────────────────────
  {
    id: 'relances', title: 'Relances automatiques par e-mail', level: 2, designer: 'Claire, PM croissance',
    intro: 'Claire veut que les tenants relancent automatiquement leurs clients finaux pour les factures impayées, avec un lien de paiement dans chaque e-mail.',
    sections: [
      { title: 'Fonctionnement', statements: [
        { id: 'r1', text: 'Chaque tenant définit un calendrier de relances (J+7, J+15, J+30) et un modèle de message.' },
        { id: 'r2', text: 'Le modèle n’accepte qu’une liste fermée de variables ({{client.nom}}, {{facture.montant}}, {{lien_paiement}}), remplacées par simple substitution et échappées pour le HTML.',
          note: 'Aucun moteur de templates n’évalue le texte du tenant : l’injection de template n’a pas de prise. C’est la bonne réponse à une crainte légitime.' },
        { id: 'r5', text: 'Le reste du texte du modèle est libre, liens compris.',
          issue: { priority: 'ought', finding: 'Avec l’envoi immédiat, un texte libre avec liens fait de Novafact un relais d’hameçonnage : liens limités au domaine de paiement, analyse du contenu. En 2022, des escrocs ont ainsi glissé de faux numéros de support dans le champ libre de vraies factures PayPal (KrebsOnSecurity).' } },
      ] },
      { title: 'Envoi', statements: [
        { id: 'r3', text: 'Les e-mails partent de relances@novafact.example par Amazon SES, avec le nom du tenant comme nom d’expéditeur.',
          note: 'Envoyer depuis un domaine que Novafact contrôle est normal. Le risque est ailleurs : qui peut s’en servir, et pour dire quoi.' },
        { id: 'r4', text: 'Les destinataires sont les adresses saisies dans les fiches clients, et un compte peut envoyer dès son inscription.',
          issue: { priority: 'must', finding: 'Un fraudeur s’inscrit et envoie de fausses factures depuis le domaine de Novafact : quota bas pour les nouveaux comptes, levé après vérification.' } },
        { id: 'r11', text: 'Le taux de plainte de chaque tenant est suivi, et ses envois sont suspendus au-delà d’un seuil.',
          note: 'Bonne mesure, mais elle réagit après les premiers envois : elle complète le quota des nouveaux comptes, elle ne le remplace pas.' },
      ] },
      { title: 'Lien de paiement', statements: [
        { id: 'r6', text: 'Le lien de paiement contient un jeton signé (HMAC) qui identifie la facture et ouvre la page de paiement sans connexion.',
          note: 'Un lien au porteur est adapté au paiement : régler la facture de quelqu’un d’autre ne nuit à personne. Tout dépend de ce que la page permet d’autre.' },
        { id: 'r7', text: 'Le jeton n’expire pas et reste valide après le paiement.',
          issue: { priority: 'should', finding: 'Expiration alignée sur l’échéance et invalidation une fois la facture payée : un lien qui circule des années révèle la facture à qui le trouve.' } },
        { id: 'r8', text: 'La page ouverte par ce lien permet aussi au client final de modifier l’adresse e-mail de facturation, sans créer de compte.',
          issue: { priority: 'must', finding: 'Le lien est au porteur : qui le possède redirige toutes les factures futures. Une modification d’adresse exige une confirmation par l’ancienne adresse ou la validation du tenant.' } },
      ] },
      { title: 'Suivi', statements: [
        { id: 'r9', text: 'Chaque e-mail contient un lien de désinscription en un clic, qui ne coupe que les relances automatiques.' },
        { id: 'r10', text: 'Les ouvertures et les clics sont suivis par un pixel et des liens de redirection, conservés sans limite de durée.',
          issue: { priority: 'should', finding: 'Le suivi des clients finaux est une donnée personnelle : durée de conservation bornée et information des destinataires.' } },
      ] },
    ],
    pushbacks: [
      { statementId: 'r4', objection: 'Bloquer les nouveaux comptes, c’est tuer la conversion : un client qui s’inscrit veut relancer tout de suite.',
        replies: [
          { text: 'Le suivi du taux de plainte suffit : Amazon SES suspendra de lui-même les tenants qui envoient des fausses factures, sans que nous ayons à coder quoi que ce soit.', points: 0, why: 'SES ne connaît pas tes tenants : c’est tout le compte d’envoi de Novafact qu’il pénalise, et seulement après que les victimes ont reçu les messages.' },
          { text: 'Exigeons une pièce d’identité et un extrait Kbis avant le premier envoi : un fraudeur ne passera pas cette étape.', points: 1, why: 'Efficace mais disproportionné : tous les nouveaux clients paient pour quelques fraudeurs, et le designer refusera à juste titre.' },
          { text: 'Pas de blocage : un quota bas les premiers jours, levé après vérification du domaine ou un premier paiement. Le vrai client relance ses dix factures.', points: 2, why: 'La friction ne touche que le volume dont un nouveau client légitime n’a pas besoin, et c’est ce volume qui intéresse le fraudeur.' },
        ] },
      { statementId: 'r8', objection: 'Le client final doit pouvoir corriger son e-mail sans créer de compte, c’est tout l’intérêt du lien.',
        replies: [
          { text: 'Le besoin tient : la correction part en demande, confirmée depuis l’ancienne adresse ou validée par le tenant. Le lien sert à payer, pas à rediriger.', points: 2, why: 'Tu sépares ce que le porteur du lien peut faire sans risque (payer) de ce qui exige une preuve (changer le destinataire).' },
          { text: 'Autorisons la modification seulement vers une adresse du même domaine que l’ancienne : un client qui change de boîte reste ainsi dans la même entreprise.', points: 1, why: 'Ça réduit la surface pour les entreprises, mais pas pour les clients en gmail.com, et un intrus du même domaine passe.' },
          { text: 'Ajoutons un CAPTCHA sur le formulaire de modification, pour empêcher les robots de changer les adresses en masse.', points: 0, why: 'Le risque n’est pas un robot, c’est un humain qui détient le lien : un CAPTCHA ne dit pas qui il est.' },
        ] },
    ],
  },
  {
    id: 'api-publique', title: 'API publique à clés', level: 2, designer: 'Sacha, lead API',
    intro: 'Sacha ouvre une API REST publique pour que les clients connectent leur ERP à Novafact, avec des webhooks sortants.',
    sections: [
      { title: 'Clés', statements: [
        { id: 'k1', text: 'Les clients connectent leur ERP à Novafact par une API REST publique, authentifiée par clé.' },
        { id: 'k2', text: 'Une clé aléatoire de 256 bits est générée par l’admin du tenant, affichée une seule fois, et stockée sous forme d’empreinte SHA-256.',
          note: 'Tentant, mais juste : pour un secret tiré au hasard sur 256 bits, une empreinte rapide suffit. bcrypt ou Argon2 ralentissent la recherche exhaustive de mots de passe humains, qui n’a pas d’objet ici.' },
        { id: 'k3', text: 'Chaque clé a tous les droits de l’admin qui l’a créée.',
          issue: { priority: 'ought', finding: 'Clés à portée limitée (lecture seule, factures, clients) choisie à la création : une intégration comptable n’a pas à gérer les utilisateurs.' } },
        { id: 'k4', text: 'Les clés n’expirent pas et restent actives si leur créateur quitte l’entreprise.',
          issue: { priority: 'ought', finding: 'Clé rattachée au tenant avec un propriétaire nommé, inventaire visible, rotation et alerte sur les clés inutilisées.' } },
        { id: 'k5', text: 'La clé passe dans l’en-tête Authorization, ou dans le paramètre ?api_key= pour les outils qui ne savent pas envoyer d’en-têtes.',
          issue: { priority: 'ought', finding: 'Une clé dans l’URL finit dans les journaux d’accès, les proxys et l’historique : réserver ce mode à des clés dédiées, en lecture seule.' } },
      ] },
      { title: 'Autorisation et données', statements: [
        { id: 'k6', text: 'Le tenant est déduit de la clé, jamais d’un paramètre de la requête.' },
        { id: 'k7', text: 'Les réponses renvoient l’objet complet de la base, pour ne pas maintenir de DTO séparés.',
          issue: { priority: 'must', finding: 'Exposition excessive : champs internes, IBAN, empreintes. Une liste blanche de champs par ressource publique.' } },
      ] },
      { title: 'Limites', statements: [
        { id: 'k8', text: 'Une limite de 100 requêtes par minute est appliquée par adresse IP.',
          issue: { priority: 'ought', finding: 'La limite suit la clé et le tenant : une IP partagée bride des clients légitimes, et un attaquant change d’adresse.' } },
        { id: 'k9', text: 'La pagination accepte un paramètre limit sans maximum.',
          issue: { priority: 'ought', finding: 'Plafonner limit : sinon une seule requête extrait ou calcule toute la base du tenant.' } },
      ] },
      { title: 'Webhooks sortants', statements: [
        { id: 'k10', text: 'Les événements envoyés aux webhooks des clients sont signés en HMAC avec un secret propre à chaque abonnement.' },
        { id: 'k11', text: 'L’URL de webhook est libre ; Novafact l’appelle depuis les tâches ECS de l’API, dans le VPC de production.',
          issue: { priority: 'must', finding: 'SSRF : l’appel part du réseau de production. Résoudre le nom, refuser les plages privées et de métadonnées, sortir par un proxy dédié. C’est une SSRF vers le service de métadonnées qui a ouvert la brèche de Capital One en 2019.' } },
        { id: 'k12', text: 'Chaque appel est journalisé avec l’identifiant de la clé (jamais la clé elle-même), la route et le code de réponse.' },
      ] },
    ],
    pushbacks: [
      { statementId: 'k5', objection: 'Certains ERP anciens ne savent pas envoyer d’en-têtes : sans le paramètre, on perd ces clients.',
        replies: [
          { text: 'Acceptons le paramètre uniquement en HTTPS : l’URL complète, chaîne de requête comprise, est alors chiffrée pendant tout le transport, comme un en-tête.', points: 1, why: 'Vrai en transit, mais l’URL est écrite en clair aux deux bouts : journaux d’accès, proxys, historique.' },
          { text: 'Chiffrons la clé dans l’URL avec une clé publique que nous fournissons aux clients, pour qu’elle ne circule jamais en clair.', points: 0, why: 'La valeur chiffrée se rejoue telle quelle : elle devient simplement la nouvelle clé, avec les mêmes fuites.' },
          { text: 'Gardons ce mode pour eux, avec des clés dédiées, en lecture seule et à durée limitée : elles finiront dans des journaux, limitons ce qu’elles ouvrent.', points: 2, why: 'Tu acceptes la contrainte métier et tu réduis ce que coûte la fuite, puisque la fuite est probable.' },
        ] },
      { statementId: 'k11', objection: 'Les clients doivent pouvoir pointer vers leurs propres serveurs, et on ne peut pas deviner lesquels sont internes chez nous.',
        replies: [
          { text: 'On ne devine pas : on résout le nom, on refuse les plages privées et de métadonnées, on se connecte à l’adresse vérifiée, via un proxy de sortie.', points: 2, why: 'Se connecter à l’adresse vérifiée ferme le rebond DNS, et le proxy de sortie limite ce qu’une erreur de filtrage peut atteindre.' },
          { text: 'Refusons les URL qui contiennent localhost, 127.0.0.1 ou 169.254.169.254 : ce sont les cibles sensibles, et la règle tient en une ligne de code.', points: 1, why: 'Une liste de chaînes se contourne : un nom DNS qui pointe vers 10.0.0.5, une adresse en décimal, une redirection.' },
          { text: 'Exigeons HTTPS pour les webhooks : nos services internes ne parlent qu’en HTTP, ils seront donc hors d’atteinte.', points: 0, why: 'Le protocole n’est pas une frontière réseau : des services internes parlent HTTPS, et une redirection change la donne.' },
        ] },
      { statementId: 'k8', objection: 'La limite par IP est déjà en place sur le WAF ; la faire par clé demande du développement.',
        replies: [
          { text: 'Baissons plutôt la limite à 20 requêtes par minute et par IP sur le WAF : un attaquant ira cinq fois moins vite, sans aucun développement.', points: 1, why: 'Plus strict pour tout le monde, y compris les clients derrière un NAT, et toujours contournable en changeant d’adresse.' },
          { text: 'Gardons le WAF comme premier filet et ajoutons un compteur par clé dans l’API : la limite doit suivre l’identité, pas le réseau.', points: 2, why: 'Tu gardes l’existant et tu ajoutes le seul contrôle qui suit ce qu’on veut limiter.' },
          { text: 'Exigeons que chaque client déclare ses adresses IP sortantes : seules celles-là pourront appeler l’API.', points: 0, why: 'Une liste d’adresses autorisées ne limite pas le débit : un ERP légitime qui boucle sature toujours l’API.' },
        ] },
    ],
  },
  {
    id: 'assistant', title: 'Assistant IA « Ask Novafact »', level: 2, designer: 'Alix, PO',
    intro: 'L’équipe produit veut un assistant qui répond aux questions sur les factures et peut envoyer des relances par e-mail.',
    sections: [
      { title: 'Fonctionnement', statements: [
        { id: 'a1', text: 'L’assistant lit les factures du tenant, y compris celles importées depuis les fournisseurs, et peut envoyer des e-mails de relance.',
          issue: { priority: 'must', finding: 'Contenu non fiable, données sensibles et communication externe réunis : la règle de deux impose une validation humaine avant tout envoi.' } },
        { id: 'a2', text: 'Les e-mails peuvent être envoyés à n’importe quelle adresse proposée par l’assistant.',
          issue: { priority: 'must', finding: 'Envoi limité aux contacts enregistrés du tenant, avec confirmation explicite.' } },
        { id: 'a3', text: 'Le texte des factures importées est inclus tel quel dans le contexte du modèle.',
          issue: { priority: 'ought', finding: 'Marquer et séparer le contenu non fiable, et ne jamais lui donner autorité sur les outils (injection indirecte).' } },
      ] },
      { title: 'Identité et droits', statements: [
        { id: 'a4', text: 'L’assistant utilise un compte de service qui accède à tous les tenants, et filtre ensuite les résultats.',
          issue: { priority: 'must', finding: 'Adjoint confus : l’assistant agit avec les droits de l’utilisateur, propagés jusqu’à la DAL.' } },
        { id: 'a5', text: 'Chaque action de l’assistant est journalisée avec la conversation qui l’a déclenchée.' },
      ] },
      { title: 'Affichage', statements: [
        { id: 'a6', text: 'Les réponses sont rendues en Markdown, avec le HTML autorisé pour les tableaux.',
          issue: { priority: 'must', finding: 'La sortie du modèle est une entrée non fiable : pas de HTML brut, rendu assaini (XSS). Même prudence pour les images et liens externes : EchoLeak (Microsoft 365 Copilot, 2025) exfiltrait des données par ce canal.' } },
      ] },
      { title: 'Données', statements: [
        { id: 'a7', text: 'Les conversations sont conservées indéfiniment pour améliorer le produit.',
          issue: { priority: 'ought', finding: 'Durée de conservation courte et justifiée ; les conversations héritent de la classe des factures citées.' } },
        { id: 'a8', text: 'Le fournisseur du modèle est hébergé dans l’Union européenne et s’engage par contrat à ne pas entraîner ses modèles sur nos données.' },
        { id: 'a9', text: 'Le prompt système contient la clé d’API du service d’envoi d’e-mails, pour que l’assistant puisse l’utiliser.',
          issue: { priority: 'must', finding: 'Aucun secret dans le contexte du modèle : les outils s’authentifient côté serveur (Hidden Context Exposure).' } },
      ] },
      { title: 'Exploitation', statements: [
        { id: 'a10', text: 'Une limite de 200 requêtes par utilisateur et par jour est appliquée.' },
        { id: 'a11', text: 'Aucune alerte n’est prévue sur le volume d’e-mails envoyés par l’assistant.',
          issue: { priority: 'should', finding: 'Alerte sur les envois inhabituels : c’est le signal d’un détournement.' } },
      ] },
    ],
    pushbacks: [
      { statementId: 'a1', objection: 'Si l’utilisateur doit valider chaque relance, l’assistant perd tout son intérêt.',
        replies: [
          { text: 'Gardons l’envoi automatique, mais seulement vers les contacts déjà enregistrés du tenant, avec un plafond de dix e-mails par jour et par utilisateur.', points: 1, why: 'Ça réduit la portée, mais une facture piégée peut toujours faire écrire à ses vrais clients, au nom de l’utilisateur, un message qu’il n’a pas voulu.' },
          { text: 'L’assistant prépare les relances, l’utilisateur les valide en un clic dans un aperçu groupé. Sans cette étape, une facture piégée écrit à sa place.', points: 2, why: 'L’usage reste fluide, et l’action à effet garde un humain dans la boucle.' },
          { text: 'Ajoutons au prompt système une consigne ferme : ne jamais suivre une instruction trouvée dans le contenu d’une facture.', points: 0, why: 'L’injection de prompt ne se corrige pas par une consigne : le modèle ne sépare pas de façon fiable données et instructions.' },
        ] },
      { statementId: 'a4', objection: 'Filtrer après coup marche très bien, et un seul compte de service est plus simple à gérer.',
        replies: [
          { text: 'Le modèle peut contourner un filtre après coup. Propageons l’identité de l’utilisateur jusqu’à la DAL : l’assistant ne lira jamais plus que lui.', points: 2, why: 'Tu expliques le risque propre aux agents, et la solution reste simple : réutiliser la DAL existante.' },
          { text: 'Gardons le compte de service, mais ajoutons un second filtre, indépendant du premier et écrit par une autre équipe, sur les réponses avant l’affichage.', points: 1, why: 'Mieux, mais toujours un filtre après coup, avec des droits trop larges en amont.' },
          { text: 'Restreignons le compte de service à la lecture seule : sans droit d’écriture, un accès trop large ne fera pas de dégâts.', points: 0, why: 'La lecture de tous les tenants est précisément la fuite à éviter.' },
        ] },
    ],
  },

  // ── N3 ────────────────────────────────────────────────────────────────────
  {
    id: 'rgpd', title: 'Suppression de compte (RGPD)', level: 3, designer: 'Maël, lead back-end',
    intro: 'Maël a conçu le droit à l’effacement : demande, délai de grâce, effacement réparti entre les services, sauvegardes. Le document a déjà été relu par le DPO.',
    sections: [
      { title: 'Contexte', statements: [
        { id: 'g1', text: 'Un utilisateur peut demander la suppression de son compte, au titre de l’article 17 du RGPD.' },
        { id: 'g2', text: 'L’assistant IA indexe les factures et les notes des utilisateurs dans un index pgvector, pour répondre aux questions.' },
      ] },
      { title: 'Demande', statements: [
        { id: 'g3', text: 'La demande se fait depuis la page Profil, après une nouvelle authentification.' },
        { id: 'g4', text: 'Les demandes reçues par e-mail au DPO sont exécutées par le support depuis le back-office, après vérification que l’e-mail provient bien de l’adresse du compte.',
          issue: { priority: 'must', finding: 'L’adresse d’expédition d’un e-mail se falsifie : un inconnu peut faire supprimer le compte de n’importe qui. Répondre par un lien de confirmation envoyé à l’adresse du compte.' } },
        { id: 'g5', text: 'La suppression est différée de 30 jours, pendant lesquels l’utilisateur peut l’annuler en se reconnectant.',
          note: 'Tentant, mais juste : le RGPD demande de répondre dans le mois. Un délai de grâce annoncé le respecte et protège contre les suppressions par erreur ou sous la contrainte.' },
      ] },
      { title: 'Effacement', statements: [
        { id: 'g6', text: 'L’événement account.deleted est publié sur EventBridge ; Postgres (comptes) et MongoDB (factures) y sont abonnés, seuls endroits où vivent des données personnelles.',
          issue: { priority: 'must', finding: 'L’hypothèse est fausse, et le document le dit lui-même : l’index pgvector de l’assistant contient factures et notes. Inventorier chaque stockage (index, logs, caches, conversations) et l’abonner.' } },
        { id: 'g7', text: 'Si un abonné échoue, l’événement est retenté trois fois puis abandonné, et l’utilisateur reçoit la confirmation de suppression.',
          issue: { priority: 'ought', finding: 'La confirmation attend l’accusé de chaque abonné ; un échec part en file de reprise avec alerte. Sinon, on certifie une suppression qui n’a pas eu lieu.' } },
        { id: 'g8', text: 'Quand l’utilisateur supprimé est le dernier administrateur de son tenant, le tenant et toutes ses factures sont supprimés avec lui.',
          issue: { priority: 'must', finding: 'Les factures appartiennent à l’entreprise cliente, pas au salarié, et leur conservation est une obligation légale. Et un admin sur le départ pourrait tout effacer d’un clic.' } },
        { id: 'g9', text: 'Les factures émises restent conservées 10 ans après la suppression du compte, avec le nom et l’adresse des clients finaux.',
          note: 'Tentant, mais juste : les pièces comptables se conservent dix ans (Code de commerce, art. L123-22), et l’article 17.3 du RGPD écarte l’effacement quand une obligation légale impose la conservation.' },
        { id: 'g10', text: 'Dans les journaux d’audit, l’identifiant de l’utilisateur est remplacé par l’empreinte SHA-256 de son adresse e-mail.',
          issue: { priority: 'ought', finding: 'Une empreinte d’e-mail se retrouve en hachant les adresses connues : c’est une pseudonymisation, les journaux restent des données personnelles. La FTC l’a rappelé en 2024 : hacher ne rend pas anonyme. Préférer un identifiant aléatoire dont la correspondance est détruite.' } },
        { id: 'g12', text: 'Un e-mail confirme la suppression à l’adresse du compte, puis l’adresse est effacée.' },
      ] },
      { title: 'Sauvegardes', statements: [
        { id: 'g11', text: 'Les sauvegardes AWS Backup sont conservées 35 jours et restaurées en cas d’incident.',
          issue: { priority: 'ought', finding: 'Hypothèse implicite : une restauration ressusciterait les comptes supprimés depuis la sauvegarde. Tenir un registre des suppressions et le rejouer après toute restauration.' } },
      ] },
    ],
    pushbacks: [
      { statementId: 'g4', objection: 'Le support vérifie l’adresse d’expédition : si l’e-mail vient de l’adresse du compte, c’est bien la personne.',
        replies: [
          { text: 'Vérifions aussi que l’e-mail passe SPF et DKIM pour le domaine de l’adresse : un expéditeur falsifié sera alors écarté avant d’arriver au support.', points: 1, why: 'Mieux, mais SPF et DKIM authentifient un domaine, pas une personne, et beaucoup de domaines n’imposent pas DMARC. La confirmation par lien vérifie la possession de la boîte.' },
          { text: 'L’en-tête From se falsifie. Gardons le canal : le support répond par un lien de confirmation envoyé à l’adresse du compte, que seul son titulaire lit.', points: 2, why: 'Le canal reste ouvert au DPO, et la preuve devient la possession de la boîte, pas une ligne d’en-tête.' },
          { text: 'Exigeons une copie de pièce d’identité jointe à chaque demande par e-mail, comparée au nom du compte par le support.', points: 0, why: 'Le RGPD ne permet de demander des informations supplémentaires qu’en cas de doute raisonnable (art. 12.6), et une pièce jointe ne prouve pas qu’on contrôle le compte.' },
        ] },
      { statementId: 'g8', objection: 'Si le dernier admin part, le tenant n’a plus personne pour le gérer : autant tout supprimer proprement.',
        replies: [
          { text: 'Gardons la suppression du tenant, mais demandons une confirmation explicite au dernier admin avant d’effacer les factures.', points: 1, why: 'La confirmation évite l’erreur, pas l’abus : un admin qui part fâché confirme volontiers, et l’obligation de conservation n’est toujours pas respectée.' },
          { text: 'Transférons automatiquement l’administration du tenant au support de Novafact, jusqu’à ce que le client se manifeste et désigne un nouvel administrateur.', points: 0, why: 'Le support n’a pas à devenir administrateur d’un client : tu crées un accès privilégié permanent à ses données, sans mandat.' },
          { text: 'Le salarié part, les données de l’entreprise restent : le tenant passe en attente et un autre représentant est invité ; les factures sont gardées.', points: 2, why: 'Tu sépares les droits du salarié de ceux de l’entreprise : chacun a son cycle de vie.' },
        ] },
      { statementId: 'g10', objection: 'Une empreinte SHA-256 est irréversible : les journaux sont anonymes, on peut les garder aussi longtemps qu’on veut.',
        replies: [
          { text: 'Ajoutons un sel secret, commun à toutes les entrées, avant le hachage : sans ce sel, personne ne pourra recalculer les empreintes à partir d’une adresse.', points: 1, why: 'Mieux face à un tiers, mais Novafact garde le sel : les journaux restent reliables à la personne, donc personnels. Et si le sel fuit, tout redevient réversible.' },
          { text: 'SHA-256 ne s’inverse pas, mais une adresse e-mail se devine : on hache les adresses connues et on compare. C’est un pseudonyme, pas un anonymat.', points: 2, why: 'Tu corriges la prémisse sans contester l’algorithme : le problème est l’entrée, pas le hachage.' },
          { text: 'Remplaçons SHA-256 par bcrypt : un hachage lent rendra la recherche des adresses bien trop coûteuse pour un attaquant.', points: 0, why: 'Les adresses candidates sont peu nombreuses pour une cible donnée : même lent, le calcul aboutit, et l’empreinte reste un identifiant stable.' },
        ] },
    ],
  },
  {
    id: 'sso-saml', title: 'SSO SAML des grands comptes', level: 3, designer: 'Nadia, architecte',
    intro: 'Nadia ouvre le SSO SAML aux clients entreprise : chaque tenant branche son propre IdP. La bibliothèque SAML a déjà passé un audit.',
    sections: [
      { title: 'Principe', statements: [
        { id: 's1', text: 'Les clients entreprise se connectent par SAML avec leur propre IdP ; chaque tenant configure le sien (métadonnées, certificat).' },
        { id: 's2', text: 'Le service SAML s’appuie sur une bibliothèque maintenue, configurée pour exiger une signature et vérifier Audience, Destination et InResponseTo.' },
        { id: 's3', text: 'Les assertions sont refusées après NotOnOrAfter, avec une tolérance de trois minutes pour la dérive d’horloge.' },
        { id: 's12', text: 'Les identifiants d’assertion déjà vus sont mémorisés jusqu’à leur expiration, pour refuser un rejeu.' },
      ] },
      { title: 'Routage', statements: [
        { id: 's4', text: 'À la connexion, l’utilisateur saisit son e-mail ; son domaine (par exemple @acme.fr) le redirige vers l’IdP du tenant qui a déclaré ce domaine.' },
        { id: 's5', text: 'Le domaine est déclaré par l’admin du tenant dans l’écran de configuration SSO.',
          issue: { priority: 'must', finding: 'Rien ne prouve que le tenant possède ce domaine : un tenant qui déclare @acme.fr capte les connexions des salariés d’Acme vers son IdP. Exiger une preuve de propriété (enregistrement DNS TXT), un domaine par tenant.' } },
        { id: 's13', text: 'L’admin peut aussi fournir l’URL des métadonnées de son IdP ; le service SAML la télécharge chaque nuit, depuis le VPC de production, pour suivre les rotations de certificat.',
          issue: { priority: 'ought', finding: 'Une URL fournie par le client, appelée depuis la production : SSRF. Mêmes protections qu’un webhook sortant, et tout changement de certificat notifié aux admins du tenant.' } },
      ] },
      { title: 'Comptes et rôles', statements: [
        { id: 's6', text: 'Un utilisateur qui a déjà un compte Novafact (e-mail et mot de passe) est lié automatiquement à son identité SSO quand l’e-mail de l’assertion correspond.',
          issue: { priority: 'must', finding: 'L’admin de n’importe quel IdP peut émettre une assertion avec l’e-mail d’une victime d’un autre tenant. Ne lier que si l’IdP est celui du tenant du compte, après confirmation. C’est le schéma de nOAuth (Descope, 2023).' } },
        { id: 's7', text: 'Les rôles Novafact sont attribués d’après l’attribut groups de l’assertion, par une table de correspondance que l’admin du tenant définit, limitée aux rôles de son tenant.',
          note: 'Tentant, mais juste : l’IdP choisit les droits, mais seulement parmi ceux du tenant, et c’est l’admin du tenant qui fixe la table. La confiance ne franchit pas la frontière.' },
        { id: 's8', text: 'Les comptes SSO gardent leur mot de passe Novafact, en secours si l’IdP est indisponible.',
          issue: { priority: 'ought', finding: 'Le mot de passe contourne la MFA et les départs gérés par l’IdP : secours réservé à un compte d’urgence par tenant, tracé.' } },
      ] },
      { title: 'Sessions et traces', statements: [
        { id: 's9', text: 'Les sessions Novafact durent 30 jours et sont prolongées à chaque visite.',
          issue: { priority: 'ought', finding: 'Hypothèse implicite : désactiver un salarié dans l’IdP lui retirerait l’accès. Retour périodique à l’IdP, ou déprovisionnement SCIM qui révoque les sessions.' } },
        { id: 's10', text: 'Les assertions ne sont pas chiffrées ; elles transitent en HTTPS par le navigateur de l’utilisateur.',
          note: 'Tentant, mais juste : chiffrer l’assertion la cache au navigateur, qui appartient à la personne dont elle parle. TLS et une signature vérifiée suffisent tant qu’elle ne porte pas d’attribut à cacher à l’utilisateur.' },
        { id: 's11', text: 'Chaque connexion SSO est journalisée avec l’IdP, l’identifiant de l’assertion, le NameID et l’adresse IP.' },
      ] },
    ],
    pushbacks: [
      { statementId: 's6', objection: 'Sans liaison automatique, nos utilisateurs existants se retrouvent avec deux comptes le jour où leur entreprise active le SSO.',
        replies: [
          { text: 'Lions automatiquement, mais seulement si l’assertion indique que l’e-mail a été vérifié par l’IdP qui l’émet.', points: 0, why: 'L’IdP qui affirme la vérification est celui de l’attaquant : un attribut « vérifié » ne vaut que ce que vaut son émetteur.' },
          { text: 'Désactivons la liaison : chaque salarié recrée son compte au premier passage par le SSO, et le support fusionne les historiques à la demande.', points: 1, why: 'Sûr, mais tu freines l’adoption du SSO, et la fusion manuelle posera au support la même question d’identité.' },
          { text: 'Lions, mais seulement vers les comptes du tenant qui a configuré cet IdP, après confirmation avec l’ancien mot de passe.', points: 2, why: 'Le besoin reste servi, et la liaison ne franchit plus la frontière entre tenants.' },
        ] },
      { statementId: 's5', objection: 'Seul l’admin du tenant peut déclarer un domaine, et nos admins sont des clients vérifiés : ils ne vont pas déclarer le domaine d’un autre.',
        replies: [
          { text: 'Le risque n’est pas l’admin honnête, c’est le compte d’essai d’un attaquant. Une preuve DNS se fait une fois ; un domaine, un seul tenant.', points: 2, why: 'Tu nommes l’attaquant réel et la vérification ne coûte qu’une fois au client légitime.' },
          { text: 'Refusons au moins les domaines de messagerie publics, comme gmail.com ou outlook.fr, dans la déclaration.', points: 1, why: 'Utile, mais l’attaquant déclare acme.fr, pas gmail.com : seule la preuve de propriété empêche de capter un domaine d’entreprise.' },
          { text: 'Affichons sur l’écran de connexion le nom du tenant vers lequel l’utilisateur est redirigé, pour qu’il puisse réagir s’il ne reconnaît pas son entreprise.', points: 0, why: 'L’utilisateur ne lira pas, et l’attaquant nomme son tenant « Acme SSO » : un avertissement ne remplace pas une vérification.' },
        ] },
      { statementId: 's9', objection: 'Les clients désactivent leurs salariés dans leur IdP ; c’est à eux de gérer les départs, pas à nous.',
        replies: [
          { text: 'Ajoutons dans la documentation que les clients doivent aussi supprimer les comptes Novafact de leurs salariés partis.', points: 0, why: 'Une consigne que personne n’appliquera : la décision du client doit nous parvenir automatiquement.' },
          { text: 'C’est leur décision, mais elle doit nous parvenir : retour à l’IdP toutes les huit heures, ou SCIM pour révoquer à la désactivation.', points: 2, why: 'Tu respectes la répartition des rôles tout en fermant l’hypothèse implicite du document.' },
          { text: 'Réduisons la session à 24 heures, sans prolongation possible : un salarié parti perdra l’accès au plus tard le lendemain de sa désactivation.', points: 1, why: 'Mieux, mais un jour après un départ conflictuel suffit à exporter tout un portefeuille ; SCIM supprime le délai.' },
        ] },
    ],
  },
];

// ── Les séries ──────────────────────────────────────────────────────────────

const one = (id: string) => [id];

const PROFILES: SeriesProfile<ReviewDoc>[] = [
  { id: 'partage', title: 'Partage public', level: 1, ids: one('partage'),
    text: 'Dix phrases, des défauts écrits en toutes lettres : un numéro séquentiel, un lien qui n’expire pas. On apprend le geste.' },
  { id: 'import-csv', title: 'Import CSV massif', level: 1, ids: one('import-csv'),
    text: 'Un fichier fourni par le client traverse tout le système : nom, taille, tenant, et ce qu’on renvoie dans le rapport.' },
  { id: 'export', title: 'Export comptable', level: 1, ids: one('export'),
    text: 'Douze phrases, huit défauts, dont deux à ranger en Should : l’enjeu devient la priorité autant que la détection.' },
  { id: 'relances', title: 'Relances par e-mail', level: 2, ids: one('relances'),
    text: 'Un défaut se lit entre deux phrases : un lien au porteur, et ce que la page permet. Une demi-mesure s’y cache.' },
  { id: 'api-publique', title: 'API publique à clés', level: 2, ids: one('api-publique'),
    text: 'Une phrase saine a l’air fautive, une limite marche à moitié, et le designer conteste trois constats.' },
  { id: 'assistant', title: 'Assistant IA', level: 2, ids: one('assistant'),
    text: 'Contenu non fiable, outils et données sensibles réunis : il faut connaître la règle de deux pour prioriser juste.' },
  { id: 'rgpd', title: 'Suppression RGPD', level: 3, ids: one('rgpd'),
    text: 'Un document déjà relu par le DPO. Les défauts naissent entre deux sections, et deux phrases tentantes sont justes.' },
  { id: 'sso-saml', title: 'SSO SAML', level: 3, ids: one('sso-saml'),
    text: 'La bibliothèque est auditée, la signature vérifiée. Le défaut est à la frontière entre la confiance du client et la tienne.' },
];

export const reviewSeries = defineSeries(reviewDocs, PROFILES);

// Scénarios du jeu « Race Window » : des requêtes concurrentes sur un endpoint.
//
// Règle d'écriture : **les quatre correctifs doivent viser le bon endroit**.
// Un distracteur réduit à « désactiver le bouton » s'écarte sans avoir lu le
// code. Ici trois correctifs sur quatre sont des mesures qu'on rencontre en
// revue et qui rétrécissent la fenêtre au lieu de la fermer — verrou local,
// relecture, transaction sans verrou, compensation après coup. Seul un rend
// l'invariant atomique.
//
// `npm run games` vérifie que le bon correctif n'est pas le plus long.
//
// ── Les trois niveaux ────────────────────────────────────────────────────────
//
// La difficulté ne tient pas au domaine (un solde n'est pas « plus dur » qu'un
// quota) mais à ce qui rend le bon correctif difficile à isoler : combien de
// distracteurs sont des demi-vérités, et jusqu'où il faut penser l'échelle.
//
//   N1 · Check-then-act évident, sur une seule base de données. La lecture
//        précède l'écriture, la fenêtre saute aux yeux, et le correctif atomique
//        (UPDATE … WHERE, contrainte unique) est clairement le bon. Les
//        distracteurs durcissent visiblement la mauvaise couche.
//
//   N2 · Le piège est le correctif « transaction ». Sur Postgres, l'isolation
//        par défaut est READ COMMITTED : envelopper la lecture et l'écriture
//        dans une transaction ne suffit pas, car deux transactions lisent la
//        même valeur sans se gêner. Il faut un SELECT … FOR UPDATE, un UPDATE
//        conditionnel, ou une contrainte — et savoir pourquoi la transaction
//        seule échoue.
//
//   N3 · Limites distribuées. Plusieurs instances (Lambda, ECS), un compteur
//        dans Redis, une livraison SQS « au moins une fois », une clé
//        d'idempotence : un verrou en mémoire ne voit qu'un processus, et
//        l'atomicité doit vivre dans le magasin partagé. Le correctif « le plus
//        robuste en apparence » est souvent local, donc faux.
//
// Plusieurs scénarios s'appuient sur des incidents ou des recherches publiés ;
// la source est citée dans une explication (nom, année). Les autres sont
// fictifs, sur l'infrastructure de Novafact.

import { defineSeries, type SeriesProfile, type Level } from '../lib/series';

export type RaceLevel = Level;

export interface RaceOption { label: string; right: boolean; why: string }
export interface RaceScenario {
  /** Identifiant stable : il sert à composer les séries. */
  id: string;
  level: RaceLevel;
  /** Famille de course, pour les séries thématiques. */
  family: string;
  title: string;
  context: string;
  code: string;
  requests: number;
  question: string;
  outcomes: RaceOption[];
  timeline: string;   // ce que montre l'entrelacement
  fixes: RaceOption[];
  /** Scénarios de même structure à ne pas réunir dans une même série. */
  avoid?: string[];
}

export const raceScenarios: RaceScenario[] = [
  {
    id: 'coupon-welcome', level: 3, family: 'distribue', avoid: ['referral-bonus'],
    title: 'Coupon « une fois par compte »',
    context: 'Un coupon de bienvenue ne peut être utilisé qu’une fois par compte. L’API tourne sur trois instances.',
    code: `router.post('/coupons/welcome/redeem', async (req, res) => {
  if (await redemptions.exists(req.user.id, 'WELCOME')) return res.status(409).end();
  await billing.applyCredit(req.user.id, 2000);           // 20 €
  await redemptions.insert(req.user.id, 'WELCOME');
  res.status(204).end();
});`,
    requests: 5,
    question: 'Cinq requêtes arrivent dans la même milliseconde (single-packet attack). Combien de crédits peuvent être appliqués au pire ?',
    outcomes: [
      { label: 'Un seul : la vérification initiale couvre le cas', right: false, why: 'Elle le couvrirait si elle réservait quelque chose. Elle ne fait que lire, et les cinq lectures ont lieu avant la première écriture.' },
      { label: 'Cinq, autant que de requêtes envoyées', right: true, why: 'Les cinq vérifications passent avant la première insertion. Il n’y a pas de limite structurelle : autant de requêtes dans la fenêtre, autant de crédits.' },
      { label: 'Deux, le temps que la première écriture arrive', right: false, why: 'C’est l’intuition d’une fenêtre « courte mais réelle ». Avec des paquets alignés, la fenêtre contient toutes les requêtes qu’on y met.' },
    ],
    timeline: 'Les cinq requêtes lisent l’état avant que la première n’écrive.',
    fixes: [
      { label: 'Insérer la redemption d’abord, sous contrainte unique (user, coupon)', right: true, why: 'La base arbitre à la place du code : la deuxième insertion échoue, quelle que soit l’instance qui l’a tentée. Le crédit se pose dans la même transaction.' },
      { label: 'Tenir en mémoire un Set des comptes en cours de traitement du coupon', right: false, why: 'Le verrou existe, dans un seul processus : les trois instances ECS ont chacune leur Set. Le bug disparaît en développement et reste en production.' },
      { label: 'Revérifier l’existence juste après avoir appliqué le crédit, et annuler', right: false, why: 'Une compensation après coup : les cinq requêtes voient un doublon et annulent toutes, ou aucune ne le voit. Et le crédit a déjà été appliqué entre-temps.' },
      { label: 'Ouvrir une transaction autour de la vérification et de l’insertion', right: false, why: 'Le bon réflexe, et il manque le verrou : en read committed, deux transactions lisent toutes les deux « pas encore utilisé » sans se gêner.' },
    ],
  },
  {
    id: 'giftcard-balance', level: 2, family: 'solde', avoid: ['starbucks-giftcard', 'loyalty-points-rc'],
    title: 'Solde d’une carte cadeau',
    context: 'Une carte a un solde de 100 €. Chaque requête débite 50 €.',
    code: `router.post('/giftcards/:id/spend', async (req, res) => {
  const card = await db.giftCard.findUnique({ where: { id: req.params.id } });
  if (card.balance < 5000) return res.status(402).end();
  await db.giftCard.update({ where: { id: card.id }, data: { balance: card.balance - 5000 } });
  await orders.pay(req.user.id, 5000);
  res.status(204).end();
});`,
    requests: 3,
    question: 'Trois requêtes simultanées de 50 €. Combien de paiements peuvent passer ?',
    outcomes: [
      { label: 'Deux, puisque le solde ne couvre que deux débits', right: false, why: 'Le solde couvrirait deux débits s’ils étaient séquentiels. Les trois requêtes lisent 100 € et passent toutes la vérification.' },
      { label: 'Trois, et le solde final est incohérent', right: true, why: 'Les trois écrivent 100 − 50 = 50 € en écrasant le calcul des autres : trois paiements encaissés, et une carte qui affiche encore 50 €.' },
      { label: 'Un seul, les autres lisent un solde déjà débité', right: false, why: 'Ce serait vrai si la lecture d’une requête attendait l’écriture de la précédente. Rien n’impose cet ordre.' },
    ],
    timeline: 'Les trois lectures voient 100 € ; les écritures s’écrasent entre elles.',
    fixes: [
      { label: 'UPDATE … SET balance = balance - 5000 WHERE id = $1 AND balance >= 5000', right: true, why: 'La vérification est dans le WHERE : elle et le débit forment une seule opération. Zéro ligne modifiée veut dire solde insuffisant, et le calcul part de la valeur en base.' },
      { label: 'Recharger la carte et revérifier le solde juste avant l’appel à orders.pay', right: false, why: 'Une lecture de plus, donc une fenêtre plus étroite entre la vérification et le débit. Trois requêtes alignées la traversent exactement comme la première.' },
      { label: 'Envelopper la lecture et la mise à jour dans une transaction Prisma', right: false, why: 'Sans SELECT FOR UPDATE, l’isolation par défaut laisse les trois transactions lire le même solde. La transaction garantit l’atomicité de l’écriture, pas celle de la décision.' },
      { label: 'Sérialiser les débits par carte avec un verrou applicatif en mémoire', right: false, why: 'Correct sur une instance. Les deux autres n’ont jamais entendu parler de ce verrou, et le solde d’une carte est partagé par les trois.' },
    ],
  },
  {
    id: 'team-members-limit', level: 1, family: 'quota', avoid: ['stock-oversell', 'seat-booking'],
    title: 'Limite de membres du plan',
    context: 'Le plan Starter autorise 5 membres. L’équipe en a 4. Un administrateur envoie des invitations en rafale.',
    code: `router.post('/team/invitations/accept', async (req, res) => {
  const count = await db.member.count({ where: { tenantId: req.invite.tenantId } });
  if (count >= plan(req.invite.tenantId).maxMembers) return res.status(403).end();
  await db.member.create({ data: { tenantId: req.invite.tenantId, userId: req.user.id } });
  res.status(204).end();
});`,
    requests: 6,
    question: 'Six invitations sont acceptées simultanément. Combien de membres l’équipe peut-elle compter au pire ?',
    outcomes: [
      { label: 'Cinq, la limite du plan est respectée', right: false, why: 'La limite est vérifiée, jamais réservée : compter n’empêche personne d’entrer après le comptage.' },
      { label: 'Dix : quatre membres plus six acceptations', right: true, why: 'Les six comptages voient 4, donc les six créations passent. Le dépassement n’est pas de un ou deux : il vaut le nombre de requêtes qu’on envoie.' },
      { label: 'Six, une par invitation acceptée', right: false, why: 'C’est oublier les quatre membres déjà présents : les créations s’ajoutent à l’existant, elles ne le remplacent pas.' },
    ],
    timeline: 'Six comptages lisent 4 avant la première création.',
    fixes: [
      { label: 'Un compteur members_count mis à jour sous WHERE members_count < max', right: true, why: 'La place se réserve au lieu de se vérifier, dans la même transaction que la création. L’invariant est porté par la base, pas par l’ordre d’arrivée des requêtes.' },
      { label: 'Recompter après la création et retirer le membre si la limite est dépassée', right: false, why: 'Les six requêtes constatent le dépassement au même instant et retirent toutes leur membre : l’équipe tombe à quatre. La compensation a sa propre course.' },
      { label: 'Désactiver le bouton d’acceptation côté interface pendant l’envoi', right: false, why: 'Le contrôle vit chez le client, donc il ne contrôle rien : les invitations s’acceptent par appel direct, et c’est même plus simple à automatiser.' },
      { label: 'Limiter le débit à une acceptation par seconde et par tenant', right: false, why: 'Cela rend l’exploitation moins commode et n’interdit rien : deux requêtes dans la même seconde suffisent à dépasser, et la limite porte sur le rythme.' },
    ],
  },
  {
    id: 'invoice-double-pay', level: 2, family: 'idempotence', avoid: ['stripe-webhook-replay'],
    title: 'Paiement en double',
    context: 'Le bouton « Payer » déclenche un appel au prestataire de paiement. Un utilisateur double-clique, ou un réseau instable rejoue la requête.',
    code: `router.post('/invoices/:id/pay', async (req, res) => {
  const invoice = await invoices.get(tenantOf(req), req.params.id);
  if (invoice.status === 'paid') return res.status(409).end();
  await psp.charge(invoice.amountCents, req.body.paymentMethod);
  await invoices.markPaid(invoice.id);
  res.status(204).end();
});`,
    requests: 2,
    question: 'Deux requêtes identiques arrivent en même temps. Combien de débits au pire ?',
    outcomes: [
      { label: 'Un seul, le statut de la facture l’assure', right: false, why: 'Le statut est lu avant l’appel au prestataire et écrit après : les deux requêtes lisent « envoyée » et débitent.' },
      { label: 'Deux débits, pour une seule facture', right: true, why: 'La fenêtre entre la lecture du statut et markPaid contient tout l’appel réseau au prestataire, c’est-à-dire des centaines de millisecondes.' },
    ],
    timeline: 'Les deux requêtes lisent status = sent avant le premier markPaid.',
    fixes: [
      { label: 'Une clé d’idempotence enregistrée sous contrainte unique avant le débit', right: true, why: 'La seconde requête échoue à l’insertion, donc avant l’appel au prestataire. En transmettant la même clé au prestataire, le doublon est refusé des deux côtés.' },
      { label: 'Appeler markPaid avant psp.charge, quitte à annuler si le débit échoue', right: false, why: 'L’ordre inversé fait réapparaître la fenêtre à l’identique entre la lecture et l’écriture, et ajoute un cas où une facture est payée sans débit.' },
      { label: 'Désactiver le bouton dès le premier clic et afficher un indicateur', right: false, why: 'Cela règle le double-clic, qui est le symptôme le plus visible et pas le plus grave : un rejeu réseau ou un script ne passent jamais par le bouton.' },
      { label: 'Relire le statut de la facture juste avant d’appeler le prestataire', right: false, why: 'La fenêtre passe de quelques centaines de millisecondes à quelques-unes. C’est précisément la taille de fenêtre que vise une attaque en paquet unique.' },
    ],
  },
  {
    id: 'account-two-step', level: 2, family: 'etat',
    title: 'Compte créé en deux temps',
    context: 'À l’inscription par invitation, l’utilisateur est créé, puis rattaché à son tenant et à son rôle. Le middleware d’autorisation traite tenantId === null comme « compte interne Novafact ».',
    code: `export async function acceptInvite(invite: Invite, email: string) {
  const user = await db.user.create({ data: { email } });
  await sendWelcomeEmail(user);
  await db.user.update({ where: { id: user.id }, data: { tenantId: invite.tenantId, role: invite.role } });
  return user;
}`,
    requests: 2,
    question: 'Que peut faire une requête authentifiée qui arrive entre la création et la mise à jour ?',
    outcomes: [
      { label: 'Rien : tant que le rattachement n’a pas eu lieu, le compte est inutilisable', right: false, why: 'Le compte existe et s’authentifie dès le create. C’est son rattachement qui manque, pas son existence.' },
      { label: 'Agir comme un compte interne, que le middleware ne rattache à aucun tenant', right: true, why: 'L’objet est publié à moitié construit, et l’état intermédiaire tombe justement du bon côté du test d’autorisation. La fenêtre dure le temps d’un envoi d’e-mail.' },
      { label: 'Lire son propre profil, et rien d’autre tant que le rôle est absent', right: false, why: 'Un rôle absent devrait tout refuser ; ici c’est le tenant absent qui décide, et il ouvre au lieu de fermer.' },
    ],
    timeline: 'Pendant l’envoi de l’e-mail, le compte existe sans tenant.',
    fixes: [
      { label: 'Créer l’utilisateur complet en une écriture, puis envoyer l’e-mail', right: true, why: 'L’état intermédiaire n’existe plus du tout, au lieu d’être plus court. À corriger en même temps : le middleware doit refuser un tenant absent, par défaut.' },
      { label: 'Déplacer l’envoi de l’e-mail après la mise à jour du tenant et du rôle', right: false, why: 'La fenêtre passe d’un appel SMTP à deux requêtes SQL consécutives. Elle reste ouverte, et le jour où une ligne s’ajoute entre les deux, elle se rouvre en grand.' },
      { label: 'Rendre l’envoi de l’e-mail asynchrone, par un message dans la file', right: false, why: 'Une bonne idée pour la latence, qui ne change rien ici : les deux écritures restent séparées, et l’état intermédiaire reste visible entre elles.' },
      { label: 'Vérifier la présence du tenant dans l’application front avant tout appel', right: false, why: 'La décision d’autorisation quitte le serveur : un appel direct à l’API ne consulte pas le front. C’est le contrôle le plus facile à contourner de la liste.' },
    ],
  },
  {
    id: 'invoice-number-sequential', level: 2, family: 'etat',
    title: 'Numéro de facture séquentiel',
    context: 'La réglementation impose une numérotation continue et sans trou par tenant. Le numéro est calculé avant l’insertion.',
    code: `router.post('/invoices', async (req, res) => {
  const last = await db.invoice.findFirst({
    where: { tenantId: tenantOf(req) }, orderBy: { number: 'desc' },
  });
  const number = (last?.number ?? 0) + 1;
  const invoice = await db.invoice.create({ data: { ...req.body, tenantId: tenantOf(req), number } });
  res.status(201).json(invoice);
});`,
    requests: 4,
    question: 'Quatre factures sont créées en même temps par le même tenant. Que se passe-t-il ?',
    outcomes: [
      { label: 'Les quatre reçoivent le même numéro, sans que rien ne le signale', right: true, why: 'Les quatre lectures voient le même dernier numéro et calculent le même suivant. Aucune contrainte ne s’y oppose, donc l’erreur ne se découvre qu’à la comptabilité.' },
      { label: 'Les numéros se suivent : la base ordonne les écritures', right: false, why: 'La base ordonne les écritures, pas les lectures qui les précèdent. Le numéro est décidé côté application, avant.' },
      { label: 'Une facture est créée et les trois autres échouent en conflit', right: false, why: 'Il n’y a pas de contrainte d’unicité sur (tenant, number) : rien ne fait échouer quoi que ce soit.' },
    ],
    timeline: 'Les quatre lectures du dernier numéro ont lieu avant la première insertion.',
    fixes: [
      { label: 'Une séquence par tenant, incrémentée dans la transaction d’insertion', right: true, why: 'Le numéro est attribué par la base au moment de l’écriture, donc jamais deux fois. Une contrainte unique sur (tenant, number) fait de l’invariant une règle vérifiable.' },
      { label: 'Poser une contrainte unique sur (tenantId, number) et réessayer en cas d’échec', right: false, why: 'Bien mieux que rien : les doublons deviennent impossibles. Mais sous rafale, les réessais recalculent tous le même numéro suivant et se battent indéfiniment.' },
      { label: 'Utiliser un identifiant aléatoire comme numéro, ce qui supprime la course', right: false, why: 'La course disparaît avec la contrainte réglementaire : une numérotation de facture doit être continue et sans trou. Le correctif casse ce qu’il protège.' },
      { label: 'Verrouiller la table des factures du tenant le temps du calcul', right: false, why: 'Correct sur le fond et brutal en pratique : toutes les créations du tenant se sérialisent, et un verrou de table oublié suffit à bloquer la facturation.' },
    ],
  },
  {
    id: 'mfa-code-onetime', level: 2, family: 'idempotence',
    title: 'Code à usage unique',
    context: 'La connexion à deux facteurs valide un code TOTP, puis le marque comme consommé pour empêcher le rejeu.',
    code: `router.post('/auth/mfa', async (req, res) => {
  const used = await db.usedCode.findFirst({ where: { userId: req.user.id, code: req.body.code } });
  if (used) return res.status(401).end();
  if (!totp.verify(req.user.secret, req.body.code)) return res.status(401).end();
  await db.usedCode.create({ data: { userId: req.user.id, code: req.body.code } });
  res.json({ session: await issueSession(req.user) });
});`,
    requests: 3,
    question: 'Un code intercepté est rejoué trois fois dans la même milliseconde. Que se passe-t-il ?',
    outcomes: [
      { label: 'Trois sessions sont émises à partir d’un seul code', right: true, why: 'Les trois requêtes ne trouvent pas le code dans la table, le vérifient avec succès, puis l’enregistrent. La protection anti-rejeu arrive après la décision.' },
      { label: 'Une seule session : la table des codes consommés joue son rôle', right: false, why: 'Elle le jouera pour un rejeu ultérieur, pas pour un rejeu simultané : la lecture précède l’écriture des trois côtés.' },
      { label: 'Aucune : trois usages simultanés déclenchent le verrouillage du compte', right: false, why: 'Rien dans ce code ne compte les tentatives, et les trois sont d’ailleurs des succès.' },
    ],
    timeline: 'Les trois lectures de usedCode ont lieu avant la première insertion.',
    fixes: [
      { label: 'Insérer le code sous contrainte unique (user, code) avant de le vérifier', right: true, why: 'La consommation précède la décision, donc une seule requête peut aller plus loin. L’ordre compte autant que l’atomicité : vérifier puis marquer laisse toujours une fenêtre.' },
      { label: 'Réduire la fenêtre TOTP acceptée de trois pas de temps à un seul', right: false, why: 'Cela limite le délai pendant lequel un code intercepté vaut quelque chose, ce qui est bon à prendre. Trois requêtes simultanées tiennent dans n’importe quelle fenêtre.' },
      { label: 'Enregistrer le code consommé avant d’émettre la session, pas après', right: false, why: 'L’écriture se rapproche de la lecture sans la rejoindre : la vérification TOTP reste entre les deux, et c’est là que passent les requêtes concurrentes.' },
      { label: 'Limiter à cinq tentatives de validation par minute et par compte', right: false, why: 'Une mesure indispensable contre le devinage, et hors sujet ici : les trois tentatives réussissent, et trois est bien en dessous de la limite.' },
    ],
  },
  {
    id: 'quota-redis', level: 3, family: 'distribue', avoid: ['distributed-ratelimit'],
    title: 'Quota d’appels API',
    context: 'Le plan Business autorise 10 000 appels par jour. Le compteur est tenu dans Redis.',
    code: `export async function checkQuota(tenantId: string) {
  const key = \`quota:\${tenantId}:\${today()}\`;
  const current = Number(await redis.get(key) ?? 0);
  if (current >= plan(tenantId).dailyCalls) throw new QuotaExceeded();
  await redis.set(key, current + 1, { EX: 86_400 });
}`,
    requests: 50,
    question: 'Cinquante appels arrivent simultanément alors que le compteur est à 9 990. Que vaut le compteur ensuite ?',
    outcomes: [
      { label: '9 991, et les quarante-neuf autres appels ne sont pas comptés', right: true, why: 'Chaque requête lit 9 990 et écrit 9 991 par-dessus les autres : ce sont des mises à jour perdues. Le quota se contourne en envoyant en parallèle plutôt qu’en série.' },
      { label: '10 000, la limite est atteinte et les appels suivants sont refusés', right: false, why: 'Il faudrait que les cinquante incréments s’additionnent. Ils s’écrasent, car chacun écrit une valeur calculée à partir de sa propre lecture.' },
      { label: '10 040, le compteur dépasse la limite de quarante appels', right: false, why: 'Ce serait le résultat si les incréments s’additionnaient tous malgré la vérification. C’est le symptôme de l’autre famille de courses, pas de celle-ci.' },
    ],
    timeline: 'Les cinquante lectures voient 9 990 ; les cinquante écritures posent 9 991.',
    fixes: [
      { label: 'Incrémenter avec INCR et comparer la valeur renvoyée à la limite', right: true, why: 'INCR lit et écrit en une opération côté Redis, et retourne la nouvelle valeur : la décision se prend sur un compteur qui a déjà intégré l’appel en cours.' },
      { label: 'Remplacer set par un script Lua qui relit la clé puis écrit la somme', right: false, why: 'Le script s’exécute bien de façon atomique dans Redis, donc la solution marcherait — mais écrire un script pour refaire INCR ajoute du code à maintenir sans rien gagner.' },
      { label: 'Vérifier le quota une seconde fois après l’écriture et refuser si dépassé', right: false, why: 'Le compteur est faux au moment de la relecture, puisque les écritures se sont écrasées : la seconde vérification lit la même valeur erronée que la première.' },
      { label: 'Tenir le compteur en mémoire dans chaque instance et agréger la nuit', right: false, why: 'Le quota devient approximatif et découvert après coup, ce qui est parfois acceptable pour de la facturation. Pour une limite qui doit refuser un appel, non.' },
    ],
  },
  {
    id: 'email-change-confirm', level: 2, family: 'etat',
    title: 'Changement d’adresse e-mail',
    context: 'Le changement d’e-mail est confirmé par un lien. La vérification du mot de passe actuel a lieu à la demande, la bascule à la confirmation.',
    code: `router.post('/account/email/confirm', async (req, res) => {
  const request = await db.emailChange.findFirst({ where: { token: req.body.token } });
  if (!request || request.expiresAt < new Date()) return res.status(400).end();
  await db.user.update({ where: { id: request.userId }, data: { email: request.newEmail } });
  await db.session.deleteMany({ where: { userId: request.userId } });
  res.status(204).end();
});`,
    requests: 2,
    question: 'Une demande de réinitialisation de mot de passe est en cours pour l’ancienne adresse. Que permet la fenêtre ?',
    outcomes: [
      { label: 'Recevoir sur la nouvelle adresse un lien émis pour l’ancienne', right: true, why: 'Le lien de réinitialisation est résolu au moment du clic, pas de l’envoi : s’il se résout après la bascule, il aboutit à un compte dont l’adresse a changé.' },
      { label: 'Rien : la suppression des sessions ferme l’accès à l’ancien propriétaire', right: false, why: 'Elle ferme les sessions ouvertes, ce qui est bien, et n’a aucun effet sur un jeton de réinitialisation déjà émis, qui ne dépend d’aucune session.' },
      { label: 'Confirmer deux fois le changement, ce qui duplique l’adresse en base', right: false, why: 'Une seconde confirmation réécrit la même valeur. La duplication d’adresse est un autre défaut, qui viendrait d’une contrainte unique manquante.' },
    ],
    timeline: 'Le jeton de réinitialisation survit à la bascule de l’adresse.',
    fixes: [
      { label: 'Invalider les jetons de réinitialisation en cours dans la transaction', right: true, why: 'Les deux états incompatibles cessent de coexister : changer d’adresse annule tout ce qui avait été émis vers l’ancienne, en une seule écriture indivisible.' },
      { label: 'Exiger le mot de passe actuel au moment de la confirmation, pas de la demande', right: false, why: 'Un durcissement réel, et il porte sur le changement d’adresse. Le jeton de réinitialisation, lui, existe justement pour les gens qui n’ont plus leur mot de passe.' },
      { label: 'Ramener la durée de validité du lien de confirmation à quinze minutes', right: false, why: 'La fenêtre se réduit et ne se ferme pas : quinze minutes suffisent très largement à demander une réinitialisation et à attendre le courriel.' },
      { label: 'Notifier l’ancienne adresse du changement, avec un lien d’annulation', right: false, why: 'Une excellente pratique, qui donne à la victime les moyens de réagir. Elle détecte l’attaque après coup au lieu d’empêcher la collision des deux états.' },
    ],
  },
  {
    id: 'export-during-delete', level: 2, family: 'toctou',
    title: 'Export pendant une suppression',
    context: 'La suppression d’un tenant efface ses données. Un export comptable peut être en cours au même moment.',
    code: `export async function exportLedger(tenantId: string, res: Response) {
  const tenant = await db.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant || tenant.deletedAt) throw new NotFound();
  for await (const row of db.ledger.stream({ where: { tenantId } })) {
    res.write(toCsv(row));                       // dure plusieurs minutes
  }
  res.end();
}`,
    requests: 2,
    question: 'Le tenant est supprimé pendant que l’export s’écoule. Que produit l’export ?',
    outcomes: [
      { label: 'Un fichier partiel, sans erreur visible pour celui qui l’a demandé', right: true, why: 'La vérification a eu lieu au début et la suppression avance en parallèle : le flux se termine normalement sur un contenu tronqué, que rien ne distingue d’un export complet.' },
      { label: 'Une erreur : la vérification du tenant protège toute la durée de l’export', right: false, why: 'Elle protège l’instant où elle s’exécute. Les minutes qui suivent ne sont couvertes par aucun contrôle.' },
      { label: 'Un export complet, la transaction figeant les données lues', right: false, why: 'Il n’y a pas de transaction ici, et un flux qui dure plusieurs minutes ne tient pas dans une transaction longue sans coût sérieux.' },
    ],
    timeline: 'La vérification du tenant précède de plusieurs minutes la fin de la lecture.',
    fixes: [
      { label: 'Marquer l’export en cours et faire échouer la suppression tant qu’il dure', right: true, why: 'Les deux opérations cessent de s’ignorer : l’une déclare son intention, l’autre la respecte. La suppression est différée de quelques minutes, ce qui ne coûte rien.' },
      { label: 'Revérifier l’état du tenant toutes les mille lignes et interrompre le flux', right: false, why: 'Le fichier est alors tronqué avec une erreur au lieu de l’être en silence, ce qui vaut mieux. Mais l’export échoue quand même, et la fenêtre de mille lignes demeure.' },
      { label: 'Produire l’export en tâche de fond et le déposer dans un compartiment', right: false, why: 'La bonne architecture pour un export long, et la course survit au déplacement : la tâche de fond lit toujours pendant que la suppression efface.' },
      { label: 'Appliquer une suppression logique et purger les données après trente jours', right: false, why: 'Le délai donne de la marge et déplace le problème : la purge à J+30 rencontrera un export lancé le trentième jour, avec exactement la même fenêtre.' },
    ],
  },
  {
    id: 'credit-note-invoice', level: 2, family: 'solde',
    title: 'Avoir sur une facture',
    context: 'Un avoir ne peut pas dépasser le montant restant de la facture. Plusieurs gestionnaires peuvent traiter le même dossier.',
    code: `router.post('/invoices/:id/credit-notes', async (req, res) => {
  const invoice = await invoices.get(tenantOf(req), req.params.id);
  const credited = await creditNotes.sum(invoice.id);
  if (credited + req.body.amountCents > invoice.amountCents) return res.status(422).end();
  await creditNotes.create({ invoiceId: invoice.id, amountCents: req.body.amountCents });
  res.status(201).end();
});`,
    requests: 2,
    question: 'Deux avoirs de 60 % du montant sont créés simultanément sur une facture. Que se passe-t-il ?',
    outcomes: [
      { label: 'Les deux passent : la facture est créditée à 120 % de son montant', right: true, why: 'Les deux somment les avoirs existants avant que l’autre n’ait inséré le sien. La vérification porte sur un total qui n’inclut pas l’avoir en cours de création.' },
      { label: 'Le second est refusé, car la somme des avoirs est recalculée', right: false, why: 'Elle est bien recalculée, et avant l’insertion du premier : les deux requêtes lisent le même total.' },
      { label: 'Les deux sont refusés, chacun voyant l’autre dans la somme', right: false, why: 'Ce serait le cas si chacun insérait avant de sommer. Ici la somme précède l’insertion des deux côtés.' },
    ],
    timeline: 'Les deux sommes d’avoirs sont calculées avant la première insertion.',
    fixes: [
      { label: 'Insérer l’avoir puis laisser une contrainte différée vérifier le total', right: true, why: 'La vérification porte sur l’état final, une fois les deux lignes présentes : la seconde transaction échoue au commit. L’invariant devient une propriété de la base.' },
      { label: 'Verrouiller la facture avec SELECT … FOR UPDATE avant de sommer les avoirs', right: false, why: 'Cela fonctionne, et c’est la deuxième meilleure réponse : les deux requêtes se sérialisent. Le coût est un verrou tenu pendant toute la logique métier.' },
      { label: 'Stocker un total crédité dénormalisé sur la facture et le comparer', right: false, why: 'Le calcul est plus rapide, la course intacte : lire un champ dénormalisé puis l’écrire, c’est exactement le motif lecture-puis-écriture qu’on cherche à supprimer.' },
      { label: 'Exiger une validation par un second gestionnaire au-delà de 50 % du montant', right: false, why: 'Un contrôle métier utile contre la fraude interne, et sans effet sur la concurrence : les deux avoirs validés arriveront simplement tous les deux.' },
    ],
  },
  {
    id: 'receipt-upload', level: 1, family: 'toctou',
    title: 'Téléversement de justificatif',
    context: 'Le fichier est écrit sur le disque partagé, puis son type est vérifié avant publication.',
    code: `router.post('/expenses/:id/receipt', upload.single('file'), async (req, res) => {
  const target = path.join(PUBLIC_DIR, \`\${req.params.id}.\${ext(req.file.originalname)}\`);
  await fs.rename(req.file.path, target);
  if (!ALLOWED.includes(await fileType(target))) {
    await fs.unlink(target);
    return res.status(415).end();
  }
  res.status(201).json({ url: \`/receipts/\${path.basename(target)}\` });
});`,
    requests: 2,
    question: 'Le fichier est un script, et une seconde requête demande son URL en boucle. Que se passe-t-il ?',
    outcomes: [
      { label: 'Le fichier est servi pendant l’intervalle entre le dépôt et la suppression', right: true, why: 'Il est publié avant d’être vérifié : la lecture du type et la suppression prennent quelques millisecondes, largement assez pour une requête qui attend.' },
      { label: 'Rien : le fichier est supprimé avant d’avoir pu être atteint', right: false, why: 'Il existe dans le répertoire public dès le rename. Tout ce qui lit ce répertoire pendant l’intervalle le trouve.' },
      { label: 'Le téléversement échoue, le type étant vérifié avant l’écriture', right: false, why: 'C’est ce que le code devrait faire, et l’ordre des lignes montre l’inverse : le renommage précède l’appel à fileType.' },
    ],
    timeline: 'Le fichier existe dans le répertoire public avant d’être analysé.',
    fixes: [
      { label: 'Vérifier le type dans le répertoire temporaire, avant toute publication', right: true, why: 'Rien n’atteint l’espace servi sans avoir été accepté : il n’y a plus d’intervalle, parce qu’il n’y a plus d’état publié-mais-non-vérifié.' },
      { label: 'Servir les justificatifs par une route authentifiée plutôt qu’en statique', right: false, why: 'Excellente mesure, à prendre de toute façon : elle transforme une exposition publique en exposition authentifiée. L’intervalle reste, pour qui a un compte.' },
      { label: 'Générer le nom du fichier au hasard au lieu de reprendre l’identifiant', right: false, why: 'L’URL n’est plus devinable, ce qui rend la course difficile à gagner pour un tiers — mais pas pour celui qui téléverse, puisque la réponse lui donne le nom.' },
      { label: 'Refuser les extensions exécutables connues avant d’écrire sur le disque', right: false, why: 'Une liste noire d’extensions, avec les contournements habituels, et surtout : le type réel du contenu n’a toujours aucun rapport avec l’extension annoncée.' },
    ],
  },
  {
    id: 'stock-oversell', level: 1, family: 'quota',
    title: 'Dernière unité en stock',
    context: 'Il reste une unité d’un article en édition limitée. Chaque commande décrémente le stock.',
    code: `router.post('/products/:id/order', async (req, res) => {
  const p = await db.product.findUnique({ where: { id: req.params.id } });
  if (p.stock < 1) return res.status(409).end();
  await db.product.update({ where: { id: p.id }, data: { stock: p.stock - 1 } });
  await orders.create(req.user.id, p.id);
  res.status(201).end();
});`,
    requests: 4,
    question: 'Quatre commandes arrivent en même temps sur la dernière unité. Combien peuvent aboutir ?',
    outcomes: [
      { label: 'Quatre : les quatre lectures voient stock = 1', right: true, why: 'Toutes lisent 1 avant la première écriture, donc toutes passent le test. Le stock final tombe à −3, ou à 0 selon l’ordre des écritures, mais quatre commandes sont créées.' },
      { label: 'Une seule, la vérification protège la dernière unité', right: false, why: 'Elle protégerait si elle réservait l’unité. Elle se contente de lire, et rien n’empêche trois autres lectures identiques avant l’écriture.' },
      { label: 'Deux, le temps que la première écriture s’applique', right: false, why: 'L’intuition d’une fenêtre courte mais réelle. Avec des requêtes alignées, la fenêtre contient toutes celles qu’on y met.' },
    ],
    timeline: 'Les quatre lectures voient stock = 1 avant la première décrémentation.',
    fixes: [
      { label: 'UPDATE … SET stock = stock - 1 WHERE id = $1 AND stock >= 1', right: true, why: 'La vérification passe dans le WHERE : décider et décrémenter deviennent une seule opération. Zéro ligne modifiée signale la rupture, et le calcul part de la valeur en base.' },
      { label: 'Relire le stock juste avant de créer la commande', right: false, why: 'Une lecture de plus rétrécit la fenêtre sans la fermer : quatre requêtes alignées la traversent comme la première.' },
      { label: 'Sérialiser les commandes de l’article avec un verrou en mémoire', right: false, why: 'Le verrou ne vit que dans un processus. Dès qu’une seconde instance sert l’article, elle n’en sait rien, et le stock est partagé.' },
      { label: 'Afficher « bientôt épuisé » et masquer le bouton d’achat', right: false, why: 'Le contrôle passe côté client : un appel direct à l’API ignore le bouton, et l’achat automatisé encore plus.' },
    ],
    avoid: ['team-members-limit', 'seat-booking'],
  },
  {
    id: 'username-unique', level: 1, family: 'etat',
    title: 'Nom d’utilisateur unique',
    context: 'À l’inscription, l’application vérifie qu’un identifiant n’est pas déjà pris, puis crée le compte.',
    code: `router.post('/signup', async (req, res) => {
  const taken = await db.user.findUnique({ where: { username: req.body.username } });
  if (taken) return res.status(409).end();
  await db.user.create({ data: { username: req.body.username, email: req.body.email } });
  res.status(201).end();
});`,
    requests: 2,
    question: 'Deux inscriptions au même identifiant arrivent en même temps. Que se passe-t-il ?',
    outcomes: [
      { label: 'Les deux comptes sont créés avec le même identifiant', right: true, why: 'Les deux findUnique ne trouvent rien, puis les deux create s’exécutent. Sans contrainte en base, aucune des deux ne gêne l’autre.' },
      { label: 'La seconde échoue, l’identifiant étant déjà pris', right: false, why: 'Il ne l’est pas encore au moment où elle vérifie : les deux lectures précèdent les deux écritures.' },
      { label: 'Les deux échouent, chacune voyant l’autre compte', right: false, why: 'Ce serait le cas si chacune écrivait avant de lire. Ici la lecture précède l’écriture des deux côtés.' },
    ],
    timeline: 'Les deux vérifications d’unicité ont lieu avant la première création.',
    fixes: [
      { label: 'Poser une contrainte unique sur username et créer sans vérifier d’abord', right: true, why: 'La base arbitre : la seconde insertion viole la contrainte et échoue, quel que soit l’ordre. La vérification préalable devient inutile.' },
      { label: 'Revérifier l’unicité juste après la création', right: false, why: 'Les deux requêtes constatent le doublon en même temps et l’annulent toutes, ou aucune ne le voit : la compensation a sa propre course.' },
      { label: 'Envelopper la lecture et la création dans une transaction', right: false, why: 'En READ COMMITTED, les deux transactions lisent « libre » sans se voir. La transaction rend l’écriture atomique, pas la décision qui la précède.' },
      { label: 'Mettre en cache les identifiants pris et consulter le cache', right: false, why: 'Le cache est en retard d’au moins une écriture, et il n’est pas partagé entre instances. Il rate exactement le cas concurrent.' },
    ],
    avoid: ['slug-unique'],
  },
  {
    id: 'vote-once', level: 1, family: 'idempotence',
    title: 'Un vote par personne',
    context: 'Un sondage n’autorise qu’un vote par utilisateur. Le compteur est incrémenté après vérification.',
    code: `router.post('/polls/:id/vote', async (req, res) => {
  const already = await db.vote.findFirst({ where: { pollId: req.params.id, userId: req.user.id } });
  if (already) return res.status(409).end();
  await db.vote.create({ data: { pollId: req.params.id, userId: req.user.id, choice: req.body.choice } });
  await db.poll.update({ where: { id: req.params.id }, data: { total: { increment: 1 } } });
  res.status(204).end();
});`,
    requests: 5,
    question: 'Cinq votes du même utilisateur arrivent simultanément. Combien peuvent être comptés ?',
    outcomes: [
      { label: 'Cinq : aucune vérification ne voit encore de vote', right: true, why: 'Les cinq findFirst ne trouvent rien, puis les cinq create passent. Le compteur bondit de cinq pour un seul électeur.' },
      { label: 'Un seul : le premier vote bloque les autres', right: false, why: 'Il les bloquerait s’il était écrit avant qu’elles ne lisent. Les cinq lectures ont lieu d’abord.' },
      { label: 'Aucun : cinq requêtes identiques déclenchent un rejet', right: false, why: 'Rien ici ne détecte la rafale : chaque requête suit son cours et réussit sa vérification.' },
    ],
    timeline: 'Les cinq vérifications ont lieu avant la première création de vote.',
    fixes: [
      { label: 'Contrainte unique sur (pollId, userId), et compter les lignes', right: true, why: 'Un seul vote peut exister par personne, la base y veille. Le total se calcule sur les votes réels plutôt que sur un compteur incrémenté à part.' },
      { label: 'Vérifier une seconde fois avant d’incrémenter le total', right: false, why: 'La seconde lecture tombe dans la même fenêtre que la première : les cinq requêtes la franchissent ensemble.' },
      { label: 'Désactiver le bouton de vote après le premier clic', right: false, why: 'Le double-clic disparaît, le rejeu par appel direct reste : c’est le symptôme visible qu’on traite, pas la cause.' },
      { label: 'Limiter à un vote par seconde et par utilisateur', right: false, why: 'Cinq requêtes dans la même milliseconde tiennent dans n’importe quel intervalle : la limite porte sur le rythme, pas sur l’unicité.' },
    ],
    avoid: ['coupon-welcome', 'referral-bonus'],
  },
  {
    id: 'flexcoin-withdraw', level: 1, family: 'solde',
    title: 'Retrait supérieur au solde',
    context: 'Un portefeuille interne autorise les retraits dans la limite du solde disponible.',
    code: `router.post('/wallet/withdraw', async (req, res) => {
  const w = await db.wallet.findUnique({ where: { userId: req.user.id } });
  if (w.balance < req.body.amount) return res.status(402).end();
  await db.wallet.update({ where: { id: w.id }, data: { balance: w.balance - req.body.amount } });
  await payouts.send(req.user.id, req.body.amount);
  res.status(204).end();
});`,
    requests: 8,
    question: 'Le solde est de 100. Huit retraits de 100 arrivent ensemble. Que peut-il sortir ?',
    outcomes: [
      { label: 'Jusqu’à huit retraits de 100, le compte passant en négatif', right: true, why: 'C’est le schéma qui a coulé Flexcoin en 2014 : des retraits concurrents lus avant toute écriture vident le portefeuille au-delà de son solde.' },
      { label: 'Un seul, le solde ne couvrant qu’un retrait', right: false, why: 'Il ne couvrirait qu’un retrait en série. Les huit lectures voient 100 et passent toutes la vérification.' },
      { label: 'Aucun retrait, la vérification bloquant tout dépassement du solde', right: false, why: 'Elle bloque un dépassement déjà écrit, pas huit lectures simultanées d’un solde encore intact.' },
    ],
    timeline: 'Les huit lectures voient 100 avant le premier débit.',
    fixes: [
      { label: 'UPDATE … SET balance = balance - $1 WHERE balance >= $1', right: true, why: 'Le débit et sa condition ne font qu’un : la base refuse toute écriture qui rendrait le solde négatif. Zéro ligne modifiée veut dire fonds insuffisants.' },
      { label: 'Relire le solde une fois de plus avant l’envoi', right: false, why: 'La fenêtre rétrécit et subsiste : les retraits alignés lisent tous le même solde intact.' },
      { label: 'Journaliser chaque retrait pour repérer les dépassements', right: false, why: 'On détecte l’argent parti après coup. Chez Flexcoin, la détection après coup n’a pas ramené les 896 bitcoins.' },
      { label: 'Envelopper lecture et débit dans une transaction Prisma', right: false, why: 'Sans SELECT … FOR UPDATE, l’isolation par défaut laisse les huit transactions lire le même solde. La transaction protège l’écriture, pas la décision.' },
    ],
    avoid: ['starbucks-giftcard', 'giftcard-balance'],
  },
  {
    id: 'seat-booking', level: 1, family: 'quota',
    title: 'Créneau de rendez-vous',
    context: 'Un créneau de démonstration n’accepte qu’un seul client. La réservation vérifie qu’il est libre.',
    code: `router.post('/slots/:id/book', async (req, res) => {
  const slot = await db.slot.findUnique({ where: { id: req.params.id } });
  if (slot.bookedBy) return res.status(409).end();
  await db.slot.update({ where: { id: slot.id }, data: { bookedBy: req.user.id } });
  res.status(204).end();
});`,
    requests: 3,
    question: 'Trois clients réservent le même créneau libre en même temps. Que se passe-t-il ?',
    outcomes: [
      { label: 'Les trois obtiennent le créneau, le dernier écrasant les autres', right: true, why: 'Les trois lisent bookedBy vide, puis les trois écrivent : chacun croit avoir réservé, et le créneau finit au nom d’un seul, choisi par l’ordre d’écriture.' },
      { label: 'Un seul réserve, les deux autres voient le créneau pris', right: false, why: 'Ils le verraient pris si l’écriture d’un précédait leur lecture. Les trois lisent le créneau libre avant toute écriture.' },
      { label: 'Aucun, le conflit annulant les trois réservations', right: false, why: 'Rien n’annule : chaque update réussit et écrase le précédent, sans erreur.' },
    ],
    timeline: 'Les trois lectures voient le créneau libre avant la première réservation.',
    fixes: [
      { label: 'UPDATE … SET bookedBy = $1 WHERE id = $2 AND bookedBy IS NULL', right: true, why: 'La condition « encore libre » est dans le WHERE : une seule écriture modifie une ligne, les autres en modifient zéro et reçoivent un 409.' },
      { label: 'Relire l’état du créneau juste avant de l’attribuer', right: false, why: 'La relecture retombe dans la même fenêtre : les trois requêtes la franchissent ensemble.' },
      { label: 'Poser un verrou en mémoire par identifiant de créneau', right: false, why: 'Le verrou est local à une instance ; une seconde instance attribue le même créneau sans le voir.' },
      { label: 'Griser le créneau dans l’agenda dès qu’il est cliqué', right: false, why: 'Le grisage vit dans le navigateur : deux onglets, ou un appel direct, réservent quand même.' },
    ],
    avoid: ['team-members-limit', 'stock-oversell'],
  },
  {
    id: 'referral-bonus', level: 1, family: 'idempotence',
    title: 'Prime de parrainage',
    context: 'Un filleul rapporte une prime unique à son parrain, versée à la première connexion du filleul.',
    code: `router.post('/referrals/:code/claim', async (req, res) => {
  const ref = await db.referral.findUnique({ where: { code: req.params.code } });
  if (ref.rewarded) return res.status(409).end();
  await credits.grant(ref.referrerId, 1000);
  await db.referral.update({ where: { id: ref.id }, data: { rewarded: true } });
  res.status(204).end();
});`,
    requests: 4,
    question: 'Quatre requêtes réclament la même prime au même instant. Combien de primes au pire ?',
    outcomes: [
      { label: 'Quatre : les quatre lisent rewarded = false', right: true, why: 'Les quatre vérifications passent avant la première mise à jour de rewarded. La prime se verse autant de fois qu’il y a de requêtes.' },
      { label: 'Une seule, le drapeau rewarded l’assure', right: false, why: 'Il l’assurerait s’il était écrit avant les lectures. Il ne l’est qu’après le versement.' },
      { label: 'Deux, le temps que le drapeau bascule', right: false, why: 'La bascule arrive après les quatre lectures : la fenêtre les contient toutes.' },
    ],
    timeline: 'Les quatre lectures de rewarded ont lieu avant la première mise à jour.',
    fixes: [
      { label: 'Basculer rewarded sous WHERE rewarded = false, puis créditer', right: true, why: 'La réservation du drapeau précède le versement : une seule requête modifie une ligne et va plus loin, les autres en modifient zéro.' },
      { label: 'Recompter les primes versées et rembourser les doublons', right: false, why: 'Le remboursement a sa propre course, et l’argent a déjà été crédité entre-temps.' },
      { label: 'Envelopper la vérification et le crédit dans une transaction', right: false, why: 'En READ COMMITTED, les quatre transactions lisent rewarded = false sans se gêner : la transaction ne sérialise pas la décision.' },
      { label: 'Limiter les réclamations à une par minute et par code', right: false, why: 'Quatre requêtes simultanées passent avant que la limite ne s’applique : elle vise le rythme, pas l’unicité.' },
    ],
    avoid: ['coupon-welcome', 'vote-once'],
  },
  {
    id: 'slug-unique', level: 1, family: 'etat',
    title: 'Adresse d’article générée',
    context: 'À la publication, l’application fabrique un slug unique à partir du titre, puis crée l’article.',
    code: `router.post('/articles', async (req, res) => {
  const base = slugify(req.body.title);
  const clash = await db.article.findFirst({ where: { slug: base } });
  const slug = clash ? \`\${base}-\${Date.now()}\` : base;
  await db.article.create({ data: { slug, title: req.body.title } });
  res.status(201).json({ slug });
});`,
    requests: 2,
    question: 'Deux articles au même titre sont publiés en même temps. Que se passe-t-il ?',
    outcomes: [
      { label: 'Les deux reçoivent le slug de base, en double', right: true, why: 'Les deux findFirst ne voient aucun conflit, donc aucun n’ajoute de suffixe. Deux articles partagent la même adresse.' },
      { label: 'Le second reçoit un suffixe, le conflit étant détecté', right: false, why: 'Le conflit n’existe pas encore quand il vérifie : le premier article n’est pas inséré.' },
      { label: 'Le second échoue, le slug étant déjà pris', right: false, why: 'Aucune contrainte unique sur slug : rien ne fait échouer la seconde insertion.' },
    ],
    timeline: 'Les deux recherches de conflit ont lieu avant la première insertion.',
    fixes: [
      { label: 'Contrainte unique sur slug, et réessayer avec un suffixe en cas d’échec', right: true, why: 'La base garantit l’unicité ; le suffixe n’est ajouté qu’au vrai conflit, détecté à l’écriture et non par une lecture en avance.' },
      { label: 'Recalculer le slug après coup si un doublon apparaît', right: false, why: 'Changer l’adresse d’un article déjà publié casse les liens, et la détection retombe dans la même course.' },
      { label: 'Envelopper la vérification et l’insertion dans une transaction', right: false, why: 'En READ COMMITTED, les deux transactions lisent « pas de conflit ». Sans contrainte, elles insèrent toutes les deux le même slug.' },
      { label: 'Toujours ajouter un suffixe horodaté au slug', right: false, why: 'Les adresses deviennent illisibles pour tous les articles, alors que le conflit est rarissime : on dégrade le cas courant pour un cas de bord.' },
    ],
    avoid: ['username-unique'],
  },
  {
    id: 'starbucks-giftcard', level: 2, family: 'solde',
    title: 'Transfert entre deux cartes',
    context: 'On peut transférer le solde d’une carte cadeau vers une autre. La somme est lue, puis déplacée.',
    code: `async function transfer(fromId, toId, amount) {
  return db.$transaction(async (tx) => {
    const from = await tx.card.findUnique({ where: { id: fromId } });
    if (from.balance < amount) throw new Insufficient();
    await tx.card.update({ where: { id: fromId }, data: { balance: from.balance - amount } });
    await tx.card.update({ where: { id: toId }, data: { balance: { increment: amount } } });
  });
}`,
    requests: 2,
    question: 'Deux transferts du même montant depuis la même carte partent ensemble. Que peut-on obtenir ?',
    outcomes: [
      { label: 'Les deux crédits passent, la carte source débitée une seule fois', right: true, why: 'C’est le tour de Homakov sur Starbucks (2015) : les deux transactions lisent le même solde source, créditent chacune la cible, et le débit de l’une écrase celui de l’autre. On gagne un solde net.' },
      { label: 'Un seul transfert, la transaction garantissant l’exactitude', right: false, why: 'La transaction garantit que ses écritures sont atomiques, pas que les deux ne lisent pas la même valeur de départ.' },
      { label: 'Les deux échouent, la carte source étant verrouillée', right: false, why: 'Rien ne la verrouille : $transaction sans SELECT … FOR UPDATE ne pose aucun verrou de ligne à la lecture.' },
    ],
    timeline: 'Les deux transactions lisent le même solde source ; un débit écrase l’autre.',
    fixes: [
      { label: 'Débiter par UPDATE … WHERE balance >= amount, et créditer si une ligne a bougé', right: true, why: 'Le débit conditionnel est atomique : le second échoue à modifier une ligne et n’émet aucun crédit. La décision vit dans l’écriture, pas avant.' },
      { label: 'Verrouiller la carte source par SELECT … FOR UPDATE avant de lire', right: false, why: 'Cela fonctionne, et c’est la deuxième meilleure réponse : les transferts se sérialisent, au prix d’un verrou tenu pendant toute la logique.' },
      { label: 'Élever l’isolation de la transaction à SERIALIZABLE', right: false, why: 'Cela ferme la course en faisant échouer l’une des deux — mais il faut alors gérer le rejeu sur erreur de sérialisation, ce que le code ne fait pas.' },
      { label: 'Ajouter un historique des transferts pour audit', right: false, why: 'On trace le double transfert au lieu de l’empêcher : l’audit constate le solde créé sans le refuser.' },
    ],
    avoid: ['giftcard-balance', 'flexcoin-withdraw'],
  },
  {
    id: 'loyalty-points-rc', level: 2, family: 'solde',
    title: 'Points de fidélité dépensés',
    context: 'Un compte a 500 points. Chaque échange en dépense 300. La lecture et la mise à jour sont dans une transaction.',
    code: `await db.$transaction(async (tx) => {
  const acc = await tx.loyalty.findUnique({ where: { userId } });
  if (acc.points < 300) throw new NotEnough();
  await tx.loyalty.update({ where: { userId }, data: { points: acc.points - 300 } });
  await rewards.grant(userId, req.body.rewardId);
});`,
    requests: 2,
    question: 'Deux échanges de 300 points partent en même temps sur un solde de 500. Que se passe-t-il ?',
    outcomes: [
      { label: 'Les deux passent, le solde tombant à −100', right: true, why: 'En READ COMMITTED, les deux transactions lisent 500, chacune écrit 500 − 300 = 200 par-dessus l’autre. Deux récompenses accordées, un solde faux.' },
      { label: 'Un seul, le solde ne couvrant qu’un échange', right: false, why: 'Il ne le couvre qu’en série. La transaction ne fait pas attendre la seconde lecture que la première écriture soit posée.' },
      { label: 'Les deux échouent sur une erreur de sérialisation', right: false, why: 'READ COMMITTED ne lève pas d’erreur de sérialisation : c’est le comportement de SERIALIZABLE, qui n’est pas activé ici.' },
    ],
    timeline: 'Les deux transactions lisent 500 points avant la première écriture.',
    fixes: [
      { label: 'UPDATE … SET points = points - 300 WHERE points >= 300', right: true, why: 'La condition passe dans l’écriture : la base sert d’arbitre, le second échange ne modifie aucune ligne. La transaction n’avait rien réglé faute de verrou.' },
      { label: 'Verrouiller la ligne par SELECT … FOR UPDATE dans la transaction', right: false, why: 'Correct, et deuxième meilleure réponse : les deux transactions se sérialisent sur le verrou de ligne. Le coût est ce verrou tenu pendant l’octroi de la récompense.' },
      { label: 'Garder la transaction, mais relire le solde juste avant l’écriture', right: false, why: 'La relecture reste en READ COMMITTED : elle rend la même valeur que la première. On ajoute une lecture sans rien verrouiller.' },
      { label: 'Découper la logique en deux transactions plus courtes', right: false, why: 'Raccourcir les transactions ne change pas l’isolation : deux transactions courtes lisent le même solde tout aussi bien que deux longues.' },
    ],
    avoid: ['giftcard-balance'],
  },
  {
    id: 'lambda-dynamo-cond', level: 3, family: 'distribue',
    title: 'Idempotence sur Lambda',
    context: 'Une fonction Lambda applique un crédit une seule fois par identifiant d’opération. La table est dans DynamoDB.',
    code: `export const handler = async (event) => {
  const { opId, userId, amount } = JSON.parse(event.body);
  const seen = await ddb.get({ TableName: 'ops', Key: { opId } });
  if (seen.Item) return ok();
  await billing.credit(userId, amount);
  await ddb.put({ TableName: 'ops', Item: { opId, userId } });
};`,
    requests: 20,
    question: 'Vingt invocations concurrentes portent le même opId. Combien de crédits au pire ?',
    outcomes: [
      { label: 'Jusqu’à vingt : chacune lit avant la première écriture', right: true, why: 'Le pic de trafic déclenche plusieurs conteneurs Lambda en parallèle : leurs get renvoient tous « absent » avant le premier put. Rien de partagé ne les sérialise.' },
      { label: 'Un seul, la table DynamoDB empêchant tout doublon d’opération', right: false, why: 'Elle l’empêcherait pour un rejeu ultérieur. Un get suivi d’un put n’est pas atomique : entre les deux, vingt invocations passent.' },
      { label: 'Un crédit par conteneur Lambda réutilisé au fil du temps', right: false, why: 'La réutilisation de conteneurs ne coordonne rien : chaque invocation refait son get. Le nombre de crédits suit le nombre d’invocations, pas de conteneurs.' },
    ],
    timeline: 'Les vingt lectures de la clé opId ont lieu avant le premier put.',
    fixes: [
      { label: 'PutItem conditionnel attribute_not_exists(opId) avant crédit', right: true, why: 'DynamoDB écrit et vérifie en une opération atomique : une seule invocation réussit le put conditionnel, les autres échouent et s’arrêtent avant le crédit.' },
      { label: 'Garder en mémoire les opId déjà vus dans la fonction', right: false, why: 'La mémoire d’un conteneur ne suit pas les autres exécutions parallèles : chaque conteneur froid repart avec un cache vide.' },
      { label: 'Réduire à un la concurrence réservée de la fonction Lambda', right: false, why: 'La facturation s’effondre à une opération à la fois, et les rejeux ultérieurs du même opId passent quand même : la limite de débit n’est pas une clé d’unicité.' },
      { label: 'Envelopper le get et le put dans une transaction DynamoDB unique', right: false, why: 'Une TransactWriteItems n’ajoute pas de verrou de lecture-avant-écriture : sans condition, les vingt écrivent la même clé et créditent chacune.' },
    ],
    avoid: ['sqs-at-least-once', 'stripe-webhook-replay'],
  },
  {
    id: 'sqs-at-least-once', level: 3, family: 'distribue',
    title: 'Message livré deux fois',
    context: 'Une file SQS déclenche l’expédition d’une commande. SQS garantit une livraison « au moins une fois ».',
    code: `export const handler = async (event) => {
  for (const record of event.Records) {
    const { orderId } = JSON.parse(record.body);
    const order = await db.order.findUnique({ where: { id: orderId } });
    if (order.shipped) continue;
    await warehouse.ship(orderId);
    await db.order.update({ where: { id: orderId }, data: { shipped: true } });
  }
};`,
    requests: 2,
    question: 'Le même message est livré deux fois (visibilité expirée, ou doublon SQS). Que peut-il arriver ?',
    outcomes: [
      { label: 'La commande est expédiée deux fois', right: true, why: 'SQS standard livre « au moins une fois » : un traitement plus long que le délai de visibilité fait redélivrer le message, et deux consommateurs lisent shipped = false avant d’écrire.' },
      { label: 'Rien : SQS ne livre jamais deux fois le même message', right: false, why: 'C’est la garantie « au moins une fois », pas « exactement une fois » : les doublons font partie du contrat de la file standard.' },
      { label: 'Le second traitement échoue, le message étant consommé', right: false, why: 'Tant qu’il n’est pas supprimé de la file, un message redélivré est bien retraité : la consommation n’est pas l’unicité.' },
    ],
    timeline: 'Les deux livraisons lisent shipped = false avant la première mise à jour.',
    fixes: [
      { label: 'Marquer l’expédition sous contrainte unique avant d’expédier', right: true, why: 'La réservation atomique en base précède l’appel à l’entrepôt : la seconde livraison échoue à réserver et n’expédie pas, quelle que soit l’instance qui la traite.' },
      { label: 'Basculer la file SQS en mode FIFO avec déduplication de contenu', right: false, why: 'La déduplication FIFO ne couvre que cinq minutes et les doublons d’envoi ; une redélivraison après expiration de visibilité retraite quand même le message.' },
      { label: 'Allonger le délai de visibilité des messages', right: false, why: 'On rend la redélivraison moins fréquente sans l’exclure : un traitement anormalement long, ou un doublon d’envoi, déclenche toujours un second passage.' },
      { label: 'Retirer le message de la file avant de l’expédier', right: false, why: 'Supprimer avant d’agir crée le défaut inverse : si l’expédition échoue, la commande n’est jamais envoyée et le message est perdu.' },
    ],
    avoid: ['lambda-dynamo-cond', 'stripe-webhook-replay'],
  },
  {
    id: 'distributed-ratelimit', level: 3, family: 'distribue',
    title: 'Limite d’envoi par minute',
    context: 'Un tenant ne peut envoyer que 100 e-mails par minute. Chaque instance ECS tient son propre compteur en mémoire.',
    code: `const counters = new Map(); // tenantId -> { count, resetAt }
export function allowSend(tenantId) {
  const c = counters.get(tenantId) ?? { count: 0, resetAt: minuteBucket() };
  if (c.count >= 100) return false;
  c.count += 1;
  counters.set(tenantId, c);
  return true;
}`,
    requests: 4,
    question: 'Le service tourne sur quatre instances ECS. Combien d’e-mails par minute au pire ?',
    outcomes: [
      { label: 'Jusqu’à 400 : chaque instance compte 100 pour elle seule', right: true, why: 'La limite est locale à un processus : quatre instances, quatre compteurs indépendants. Le total autorisé est multiplié par le nombre d’instances.' },
      { label: '100, l’équilibrage répartissant équitablement les requêtes', right: false, why: 'La répartition n’additionne pas les compteurs : elle envoie une part du trafic à chaque instance, qui compte chacune jusqu’à 100 de son côté.' },
      { label: '100, chaque instance lisant le même compteur', right: false, why: 'Les compteurs ne sont pas partagés : une Map en mémoire ne franchit pas la frontière du processus.' },
    ],
    timeline: 'Chaque instance atteint 100 sans connaître le total des trois autres.',
    fixes: [
      { label: 'Tenir le compteur dans Redis avec INCR et un TTL par minute', right: true, why: 'INCR est atomique et le compteur est partagé : toutes les instances incrémentent la même clé et lisent le même total, quelle que soit celle qui traite la requête.' },
      { label: 'Fixer une limite locale de 25 par instance', right: false, why: 'Le compte du nombre d’instances change à chaque montée en charge : la limite globale dérive dès qu’une instance est ajoutée ou retirée.' },
      { label: 'Faire remonter les compteurs locaux toutes les dix secondes', right: false, why: 'Entre deux agrégations, chaque instance dépasse librement : la limite devient approximative et découverte en retard.' },
      { label: 'Activer des sessions persistantes sur l’équilibreur', right: false, why: 'Router un tenant vers une instance ne suffit pas : un tenant actif dépasse 100 sur son instance, et une bascule repart d’un compteur neuf.' },
    ],
    avoid: ['quota-redis'],
  },
  {
    id: 'stripe-webhook-replay', level: 3, family: 'idempotence',
    title: 'Webhook de paiement rejoué',
    context: 'Un webhook Stripe crédite l’abonnement à la réception d’un paiement. Stripe peut renvoyer le même événement.',
    code: `router.post('/webhooks/stripe', async (req, res) => {
  const event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], SECRET);
  if (event.type === 'invoice.paid') {
    await subscriptions.extend(event.data.object.customer, 30);
  }
  res.status(200).end();
});`,
    requests: 3,
    question: 'Stripe renvoie trois fois le même événement invoice.paid. Que se passe-t-il ?',
    outcomes: [
      { label: 'L’abonnement est prolongé trois fois', right: true, why: 'Stripe peut livrer un événement plusieurs fois, et documente qu’il faut traiter les webhooks de façon idempotente. Ici rien ne mémorise l’identifiant de l’événement.' },
      { label: 'Rien : la vérification de signature écarte les doublons', right: false, why: 'La signature prouve l’origine et l’intégrité, pas l’unicité : un événement authentique rejoué a une signature valide à chaque fois.' },
      { label: 'Rien : Stripe n’envoie chaque événement qu’une fois', right: false, why: 'Stripe indique explicitement qu’un même événement peut arriver plusieurs fois ; le consommateur doit s’en prémunir.' },
    ],
    timeline: 'Les trois réceptions prolongent l’abonnement, faute de mémoire de l’événement.',
    fixes: [
      { label: 'Enregistrer event.id sous contrainte unique avant d’agir', right: true, why: 'La première réception insère l’identifiant ; les suivantes échouent à l’insérer et s’arrêtent. L’idempotence repose sur la clé de l’événement, partagée par toutes les instances.' },
      { label: 'Ne traiter que le premier webhook reçu par instance', right: false, why: 'Chaque instance a sa propre mémoire : un doublon routé ailleurs est traité comme un premier. Le dédoublonnage doit être partagé.' },
      { label: 'Vérifier que l’abonnement n’a pas déjà été prolongé aujourd’hui', right: false, why: 'Une heuristique de date laisse passer deux paiements légitimes le même jour, et retombe en course entre trois requêtes simultanées.' },
      { label: 'Répondre 200 plus vite pour éviter les renvois de Stripe', right: false, why: 'Répondre vite réduit les renvois pour cause de délai, sans supprimer les doublons volontaires de Stripe ni la course entre eux.' },
    ],
    avoid: ['invoice-double-pay', 'lambda-dynamo-cond'],
  },
  {
    id: 'ecs-cron-double', level: 3, family: 'distribue',
    title: 'Tâche planifiée en double',
    context: 'Une tâche nocturne clôture les factures échues. Le planificateur tourne sur chaque instance ECS.',
    code: `cron.schedule('0 2 * * *', async () => {
  const due = await db.invoice.findMany({ where: { status: 'due', dueDate: { lt: today() } } });
  for (const inv of due) {
    await penalties.apply(inv.id);
    await db.invoice.update({ where: { id: inv.id }, data: { status: 'closed' } });
  }
});`,
    requests: 2,
    question: 'Deux instances ECS déclenchent le cron à 2 h. Que subissent les factures échues ?',
    outcomes: [
      { label: 'Chaque facture reçoit deux pénalités', right: true, why: 'Les deux instances planifient le même horaire et lisent le même lot de factures « due » avant que l’autre n’écrive « closed ». Chacune applique sa pénalité.' },
      { label: 'Rien : une seule instance exécute la tâche planifiée', right: false, why: 'Un cron embarqué s’exécute sur chaque instance qui l’héberge : rien ne désigne un unique exécutant.' },
      { label: 'La seconde exécution ne trouve plus de facture « due »', right: false, why: 'Elle n’en trouve plus seulement si la première a fini d’écrire avant qu’elle ne lise — ce que rien ne garantit sous exécution simultanée.' },
    ],
    timeline: 'Les deux instances lisent le même lot de factures avant la première clôture.',
    fixes: [
      { label: 'Prendre un advisory lock Postgres, n’exécuter que si on l’obtient', right: true, why: 'Une seule instance acquiert le verrou et exécute la tâche ; les autres échouent à le prendre et passent leur tour. L’exclusion vit dans un magasin partagé.' },
      { label: 'Marquer chaque facture avec un drapeau « en cours » avant d’agir', right: false, why: 'Le drapeau se lit et s’écrit en deux temps : les deux instances le voient à false et le posent chacune. La course se déplace sur le drapeau.' },
      { label: 'Décaler le cron de quelques secondes selon l’instance', right: false, why: 'Un décalage réduit la probabilité sans l’annuler : une exécution qui traîne rencontre encore l’autre, et le décalage dérive.' },
      { label: 'Sortir le planificateur dans un conteneur applicatif entièrement dédié', right: false, why: 'Bonne architecture, et si ce conteneur passe à deux répliques pour la disponibilité, la course revient à l’identique.' },
    ],
    avoid: ['coupon-welcome'],
  },
  {
    id: 's3-conditional-write', level: 3, family: 'distribue',
    title: 'Écriture unique sur S3',
    context: 'Deux traitements peuvent générer le même rapport et l’écrire sous la même clé S3, une seule fois attendue.',
    code: `export async function writeReport(key, body) {
  const existing = await s3.headObject({ Bucket: B, Key: key }).catch(() => null);
  if (existing) return;                    // déjà généré
  await notify.reportReady(key);
  await s3.putObject({ Bucket: B, Key: key, Body: body });
}`,
    requests: 2,
    question: 'Deux workers génèrent le même rapport en parallèle. Que se passe-t-il ?',
    outcomes: [
      { label: 'Les deux notifient et écrivent, la seconde écrasant la première', right: true, why: 'Les deux headObject renvoient « absent » avant le premier putObject : chacun notifie puis écrit. Deux notifications partent, et le dernier corps l’emporte.' },
      { label: 'Un seul écrit, la vérification headObject l’assurant', right: false, why: 'Elle l’assurerait si lecture et écriture étaient atomiques. Entre le head et le put, l’autre worker passe.' },
      { label: 'La seconde écriture échoue, la clé existant déjà', right: false, why: 'Par défaut, putObject écrase sans condition : rien ne fait échouer la seconde.' },
    ],
    timeline: 'Les deux headObject renvoient « absent » avant le premier putObject.',
    fixes: [
      { label: 'putObject conditionnel If-None-Match, notifier si succès', right: true, why: 'Depuis 2024, S3 refuse un putObject conditionnel si la clé existe : un seul worker réussit, l’autre reçoit une erreur et s’arrête. La notification suit l’écriture qui a gagné.' },
      { label: 'Garder en mémoire les clés déjà écrites par le worker', right: false, why: 'La mémoire d’un worker ignore les autres : deux workers distincts ont chacun leur cache vide.' },
      { label: 'Générer un suffixe aléatoire dans la clé S3 du rapport généré', right: false, why: 'On évite l’écrasement en créant deux objets au lieu d’un : le doublon de rapport et de notification demeure, sous deux noms.' },
      { label: 'Refaire un headObject juste avant d’appeler le putObject final', right: false, why: 'La seconde vérification retombe dans la même fenêtre non atomique : les deux head peuvent encore renvoyer « absent ».' },
    ],
    avoid: ['s3-last-writer'],
  },
  {
    id: 's3-last-writer', level: 3, family: 'distribue',
    title: 'Paramètres écrasés sur S3',
    context: 'Les préférences d’un tenant sont un objet JSON sur S3. Chaque mise à jour lit l’objet, modifie un champ, réécrit.',
    code: `export async function setPref(tenantId, patch) {
  const cur = await s3.getObject({ Bucket: B, Key: \`prefs/\${tenantId}.json\` });
  const prefs = { ...JSON.parse(await cur.Body.transformToString()), ...patch };
  await s3.putObject({ Bucket: B, Key: \`prefs/\${tenantId}.json\`, Body: JSON.stringify(prefs) });
}`,
    requests: 2,
    question: 'Deux administrateurs changent chacun un champ différent en même temps. Que reste-t-il ?',
    outcomes: [
      { label: 'Une seule des deux modifications, l’autre est perdue', right: true, why: 'Les deux lisent la même version de l’objet, appliquent leur patch chacun de leur côté, et le dernier putObject écrase l’autre : c’est une mise à jour perdue.' },
      { label: 'Les deux champs sont conservés, S3 fusionnant les objets', right: false, why: 'S3 stocke des objets opaques : il ne fusionne pas deux JSON, il remplace l’objet entier par le dernier écrit.' },
      { label: 'La seconde écriture échoue, l’objet ayant changé', right: false, why: 'Sans écriture conditionnelle, putObject remplace l’objet quel que soit son état : rien ne détecte qu’il a changé entre-temps.' },
    ],
    timeline: 'Les deux lectures voient la même version ; la dernière écriture écrase l’autre.',
    fixes: [
      { label: 'Réécrire avec If-Match sur l’ETag lu, et réessayer si l’objet a changé', right: true, why: 'S3 refuse le putObject si l’ETag ne correspond plus (2024) : l’écriture perdante est rejetée, relit la version à jour et réapplique son patch. C’est un contrôle de concurrence optimiste.' },
      { label: 'Recharger l’objet juste avant de le réécrire', right: false, why: 'La relecture retombe dans la même fenêtre : les deux workers peuvent encore lire la même version avant d’écrire.' },
      { label: 'Écrire chaque préférence dans une clé S3 distincte', right: false, why: 'C’est une refonte du modèle de données, qui règle ce cas et laisse entier tout objet JSON encore mis à jour de façon lecture-modification-réécriture.' },
      { label: 'Activer le versionnement du bucket pour garder l’historique', right: false, why: 'Le versionnement conserve la version écrasée sans l’empêcher : la valeur perdue est archivée, pas appliquée.' },
    ],
    avoid: ['s3-conditional-write'],
  },
];

// ── Les séries ────────────────────────────────────────────────────────────────
//
// Les séries de niveau font monter la difficulté du geste : reconnaître une
// course évidente (N1), démasquer le correctif « transaction » qui ne tient pas
// en READ COMMITTED (N2), puis raisonner à l'échelle distribuée (N3). Les séries
// thématiques regroupent un même domaine — soldes, idempotence, systèmes
// distribués — pour comparer les correctifs d'une famille.

const mix = (n1: number, n2: number, n3: number): [number, number, number] => [n1, n2, n3];

const PROFILES: SeriesProfile<RaceScenario>[] = [
  { id: 'bases', title: 'Prise en main', mix: mix(5, 0, 0), level: 1,
    text: 'Des courses check-then-act évidentes, sur une seule base : la lecture précède l’écriture, et le correctif atomique saute aux yeux.' },
  { id: 'reconnaitre', title: 'Reconnaître la fenêtre', mix: mix(4, 1, 0), level: 1,
    text: 'Encore du niveau 1, d’autres domaines, et un premier cas où le bon correctif se choisit entre deux réponses défendables.' },
  { id: 'transactions', title: 'La transaction ne suffit pas', mix: mix(1, 5, 0), level: 2,
    text: 'Le piège récurrent : envelopper dans une transaction. En READ COMMITTED, deux transactions lisent la même valeur — il faut un verrou, un UPDATE conditionnel ou une contrainte.' },
  { id: 'a-l-echelle', title: 'À l’échelle', mix: mix(0, 1, 4), level: 3,
    text: 'Plusieurs instances, Redis, files SQS, clés d’idempotence : le correctif local paraît robuste et ne voit qu’un processus. L’atomicité doit vivre dans le magasin partagé.' },
  { id: 'expert', title: 'Systèmes distribués', mix: mix(0, 0, 5), level: 3,
    text: 'Que du niveau 3. Lambda, ECS, SQS « au moins une fois », écritures conditionnelles S3 : rien ne se règle en mémoire.' },
  { id: 'soldes', title: 'Courses sur l’argent', filter: (s) => s.family === 'solde', level: 2,
    text: 'Soldes, débits, transferts : cinq façons de dépenser deux fois le même montant, du bug Flexcoin au tour de Starbucks.' },
  { id: 'idempotence', title: 'Idempotence', filter: (s) => s.family === 'idempotence', level: 2,
    text: 'Une action qui ne doit compter qu’une fois : coupon, vote, double-clic, webhook rejoué. La clé d’unicité contre le rejeu.' },
  { id: 'distribue', title: 'Distribué', filter: (s) => s.family === 'distribue', level: 3,
    text: 'Toute la famille des limites distribuées : instances multiples, compteurs Redis, livraison SQS, verrous et écritures conditionnelles.' },
  { id: 'melee', title: 'Mêlée', mix: mix(2, 2, 1), level: 2, shuffleEachTime: true,
    text: 'Tous niveaux et tous domaines, recomposée à chaque partie. La seule série qu’on ne peut pas réviser.' },
];

/** Les séries, au format commun à tous les jeux (écran de choix partagé). */
export const raceSeries = defineSeries(raceScenarios, PROFILES);

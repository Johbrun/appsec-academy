// Scénarios du jeu « Race Window » : des requêtes concurrentes sur un endpoint Express.
//
// Règle d'écriture : **les quatre correctifs doivent viser le bon endroit**.
// Un distracteur réduit à « désactiver le bouton » s'écarte sans avoir lu le
// code. Ici trois correctifs sur quatre sont des mesures qu'on rencontre en
// revue et qui rétrécissent la fenêtre au lieu de la fermer — verrou local,
// relecture, transaction sans verrou, compensation après coup. Seul le premier
// rend l'invariant atomique.
//
// `npm run games` vérifie que le bon correctif n'est pas le plus long.

export interface RaceOption { label: string; right: boolean; why: string }
export interface RaceScenario {
  title: string;
  context: string;
  code: string;
  requests: number;
  question: string;
  outcomes: RaceOption[];
  timeline: string;   // ce que montre l'entrelacement
  fixes: RaceOption[];
}

export const raceScenarios: RaceScenario[] = [
  {
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
];

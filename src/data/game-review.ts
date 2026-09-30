// Documents du jeu « Design Review Simulator ».

export type Priority = 'must' | 'ought' | 'should';

export interface Statement { id: string; text: string; issue?: { priority: Priority; finding: string } }
export interface DocSection { title: string; statements: Statement[] }
export interface Pushback { statementId: string; objection: string; replies: { text: string; points: 0 | 1 | 2; why: string }[] }
export interface ReviewDoc { id: string; title: string; level: string; intro: string; sections: DocSection[]; pushbacks: Pushback[] }

export const reviewDocs: ReviewDoc[] = [
  {
    id: 'export', title: 'Export comptable', level: 'N2',
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
          { text: 'Tant pis pour les experts-comptables, la sécurité d’abord.', points: 0, why: 'Tu nies un besoin métier réel : le designer contournera ta recommandation.' },
          { text: 'Le besoin est légitime : modélisons la relation expert-comptable vers ses clients et vérifions-la côté serveur. Le paramètre devient un choix parmi les tenants autorisés, jamais une autorité.', points: 2, why: 'Tu gardes le besoin et tu déplaces la décision au bon endroit (ReBAC, M8).' },
          { text: 'Gardons le paramètre, mais cachons-le dans l’interface.', points: 0, why: 'Masquer n’est pas autoriser.' },
        ] },
      { statementId: 'e7', objection: 'Le bucket public simplifie tout, et les noms de fichiers sont aléatoires : personne ne les devinera.',
        replies: [
          { text: 'Vous avez raison, c’est suffisant.', points: 0, why: 'Un nom finit toujours par fuir : logs, historique, en-tête Referer.' },
          { text: 'Chiffrons le fichier avec un mot de passe envoyé par e-mail.', points: 1, why: 'Ça réduit le risque, mais complique l’usage et laisse le bucket public.' },
          { text: 'Un nom aléatoire n’est pas un contrôle. Un bucket privé avec une URL présignée de 15 minutes garde la même simplicité pour l’utilisateur.', points: 2, why: 'Même ergonomie, vrai contrôle d’accès.' },
        ] },
    ],
  },
  {
    id: 'assistant', title: 'Assistant IA « Ask Novafact »', level: 'N3',
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
          issue: { priority: 'must', finding: 'Confused deputy : l’assistant agit avec les droits de l’utilisateur, propagés jusqu’à la DAL.' } },
        { id: 'a5', text: 'Chaque action de l’assistant est journalisée avec la conversation qui l’a déclenchée.' },
      ] },
      { title: 'Affichage', statements: [
        { id: 'a6', text: 'Les réponses sont rendues en Markdown, avec le HTML autorisé pour les tableaux.',
          issue: { priority: 'must', finding: 'La sortie du modèle est une entrée non fiable : pas de HTML brut, rendu assaini (XSS).' } },
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
          { text: 'Alors on abandonne l’envoi d’e-mails.', points: 0, why: 'Tu tues la fonctionnalité au lieu de la sécuriser.' },
          { text: 'L’assistant prépare les relances, l’utilisateur les valide en un clic dans un aperçu groupé. Sans cette étape, une facture piégée suffit à envoyer des e-mails à sa place.', points: 2, why: 'L’usage reste fluide, et l’action à effet garde un humain dans la boucle.' },
          { text: 'Faisons confiance au modèle, il est bien entraîné.', points: 0, why: 'L’injection de prompt ne se corrige pas par l’entraînement.' },
        ] },
      { statementId: 'a4', objection: 'Filtrer après coup marche très bien, et un seul compte de service est plus simple à gérer.',
        replies: [
          { text: 'Un filtrage après coup peut être contourné par le modèle lui-même ; en propageant l’identité de l’utilisateur jusqu’à la DAL, l’assistant ne peut jamais lire plus que lui.', points: 2, why: 'Tu expliques le risque propre aux agents et la solution reste simple : réutiliser la DAL existante.' },
          { text: 'Ajoutons un deuxième filtre.', points: 1, why: 'Mieux, mais toujours un filtre après coup avec des droits trop larges.' },
          { text: 'C’est vrai, gardons ça.', points: 0, why: 'Un agent avec les droits de tous les tenants est la cible idéale.' },
        ] },
    ],
  },
];

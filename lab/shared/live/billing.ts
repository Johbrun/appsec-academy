// Challenges « exploit de facturation et de données » — jouables.
//
// Trente et un défauts répartis sur neuf fichiers du serveur : la facture
// elle-même (arithmétique, états, cloisonnement, cache), les avoirs, les
// réglages, les pièces jointes, l'export, l'import et l'annuaire des clients.
//
// Chacun se valide de la même façon : le serveur CONSTATE lui-même la
// violation d'invariant, au point exact où elle se produit, et appelle
// solve(id) là. Jamais sur déclaration.
//
// Les tests de régression correspondants sont dans verify/billing.test.ts, et
// le code corrigé dans solutions/, aux mêmes chemins.

import type { ExerciseDef } from '../exercises.ts';

export const billing: ExerciseDef[] = [
  {
    id: 'bfla-method', module: 'm02', title: 'BFLA : la méthode oubliée',
    status: 'live', kind: 'exploit', level: 1, csslp: ['D5'], cwe: 'CWE-285',
    brief: 'Le contrôle d’appartenance au tenant est monté sur la lecture d’une facture, mais pas sur sa suppression.',
    goal: 'Supprimer une facture appartenant à un autre tenant.',
    file: 'server/routes/invoices.ts',
    lessons: ['m02/l02', 'm08/l07'],
    hints: [
      'Le contrôle d’appartenance au tenant est bien posé sur GET et sur PATCH d’une facture.',
      'Énumère les méthodes que la route accepte, pas seulement celles que l’interface utilise.',
      'DELETE /api/invoices/INV-1003 depuis un compte acme : la facture de Globex disparaît.',
    ],
    fix: 'Un contrôle posé méthode par méthode sera oublié à la prochaine méthode. Il se pose sur la ressource, dans la couche d’accès aux données. API5:2023.',
  },

  {
    id: 'bola-nested', module: 'm02', title: 'BOLA sur un identifiant imbriqué',
    status: 'live', kind: 'exploit', level: 2, csslp: ['D5'], cwe: 'CWE-639',
    brief: 'La création de facture vérifie le tenant de l’appelant, mais pas celui du client auquel la facture est rattachée.',
    goal: 'Créer une facture rattachée au client d’un autre tenant.',
    file: 'server/routes/invoices.ts',
    lessons: ['m02/l02', 'm08/l07'],
    hints: [
      'La création de facture accepte un `clientId` en plus des lignes.',
      'Le tenant de l’appelant est vérifié ; celui du client rattaché ne l’est jamais.',
      'POST /api/invoices avec { "clientId": "CLI-9", "lines": [{ "qty": 1, "unitPrice": 10 }] } — CLI-9 appartient à Globex.',
    ],
    fix: 'Chaque identifiant qui entre dans une requête est à autoriser, pas seulement celui de la route. Le contrôle appartient au repository : `findCustomer(id, tenantId)` ne peut pas être appelé sans le tenant.',
  },

  {
    id: 'error-leak', module: 'm02', title: 'Erreur non gérée et état incohérent',
    status: 'live', kind: 'exploit', level: 2, csslp: ['D5'], cwe: 'CWE-209',
    brief: 'Une promesse non gérée dans la création de facture laisse la trace d’exécution remonter au client, et la facture à moitié écrite.',
    goal: 'Obtenir une trace d’exécution du serveur, et laisser une facture dans un état impossible.',
    file: 'server/routes/invoices.ts',
    lessons: ['m02/l05', 'm17/l01'],
    hints: [
      'POST /api/invoices/:id/reissue prend un champ `spec` qui doit contenir du JSON.',
      'La facture est écrite AVANT que la validation n’ait lieu : si l’étape jette, elle reste à mi-chemin.',
      'POST /api/invoices/INV-1001/reissue avec { "spec": "pas du json" } : la réponse porte la pile, et INV-1001 garde un total NaN.',
    ],
    fix: 'Échec sûr : gestionnaire qui ne révèle rien, transaction qui annule tout ou rien, rejets de promesses traités comme fatals. A10:2025 est entrée au Top 10 pour cette raison.',
    k: [13],
  },

  {
    id: 'max-safe-integer', module: 'm02', title: 'Au-delà de 2^53',
    status: 'live', kind: 'exploit', level: 2, csslp: ['D5'], cwe: 'CWE-190',
    brief: 'Le produit quantité × prix est calculé en nombre flottant : passé la limite des entiers sûrs, l’addition cesse d’incrémenter.',
    goal: 'Faire émettre une facture dont le total est inférieur au prix d’un seul article.',
    file: 'server/routes/invoices.ts',
    lessons: ['m02/l03', 'm10/l06'],
    hints: [
      'Le total est une somme de flottants. Au-delà de 2^53, l’addition cesse d’incrémenter.',
      'Il faut une ligne assez grosse pour que la suivante disparaisse dans l’arrondi.',
      'POST /api/invoices avec "lines": [{ "qty": 1, "unitPrice": 1e17 }, { "qty": 1, "unitPrice": 1 }] : la seconde ligne est gratuite.',
    ],
    fix: 'Montants en centimes entiers ou en décimal exact, quantités bornées par le métier bien avant la limite du langage. Un total qui cesse de croître quand la quantité croît est un invariant testable.',
    k: [9],
  },

  {
    id: 'number-coercion', module: 'm02', title: 'Number() permissif sur les montants',
    status: 'live', kind: 'exploit', level: 1, csslp: ['D5'], cwe: 'CWE-1287',
    brief: 'Le montant est converti par `Number()`, qui accepte la notation exponentielle, l’hexadécimal, les espaces, et produit `Infinity` ou `NaN`.',
    goal: 'Persister une facture dont le total n’est ni fini ni comparable.',
    file: 'server/routes/invoices.ts',
    lessons: ['m02/l03', 'm02/l05'],
    hints: [
      'Les quantités et les prix passent par `Number()` avant d’être additionnés.',
      '`Number()` ne refuse presque rien : notation exponentielle, hexadécimal, espaces — et il rend `Infinity` ou `NaN` sans jamais lever.',
      'POST /api/invoices avec "lines": [{ "qty": "1e999", "unitPrice": 1 }] : le total persisté n’est plus un nombre comparable.',
    ],
    fix: 'Le schéma dit ce qu’est un montant valide — entier, borné, fini — et le rejet est la seule autre issue. `Number()` n’est pas une validation, c’est une conversion qui réussit presque toujours.',
    k: [9],
  },

  {
    id: 'orm-leak', module: 'm03', title: 'Fuite par l’ORM sur un filtre',
    status: 'live', kind: 'exploit', level: 3, csslp: ['D5'], cwe: 'CWE-200',
    brief: 'Le filtre de recherche est passé à l’ORM presque tel quel, et les relations jointes reviennent en entier.',
    goal: 'Lire, via une relation, un champ qu’aucune route n’expose — l’empreinte du mot de passe d’un utilisateur.',
    file: 'server/routes/invoices.ts',
    lessons: ['m03/l07', 'm07/l05'],
    hints: [
      'POST /api/invoices/query prend un `where` et un `include`.',
      'Le `where` est étalé APRÈS la clause de tenant, et les relations demandées reviennent avec toutes leurs colonnes.',
      'POST /api/invoices/query avec { "where": { "tenantId": { "$ne": "acme" } }, "include": ["owner", "customer"] }.',
    ],
    fix: 'Sélection explicite des champs, jamais d’inclusion d’une relation entière. Le filtre accepté est une liste blanche d’opérateurs et de colonnes, pas l’objet du client. *ORM Leaking More Than You Joined For*, Top 10 2025.',
  },

  {
    id: 'qs-type-confusion', module: 'm03', title: 'Confusion de type sur la query string',
    status: 'live', kind: 'exploit', level: 2, csslp: ['D5'], cwe: 'CWE-843',
    brief: 'La syntaxe de tableau de la query string transforme une chaîne attendue en tableau, qui traverse une validation fondée sur la longueur et atterrit dans le filtre de recherche.',
    goal: 'Faire remonter dans la recherche des factures d’un tenant auquel tu n’appartiens pas.',
    file: 'server/routes/invoices.ts',
    lessons: ['m03/l07', 'm02/l02'],
    hints: [
      'GET /api/invoices/lookup accepte un paramètre `tenant`, et le valide avant de filtrer.',
      'La validation s’appuie sur `.length` et `.includes()` — un tableau répond aux deux, et pas de la même façon.',
      'GET /api/invoices/lookup?tenant[]=acme&tenant[]=globex : la validation passe, le filtre s’élargit.',
    ],
    fix: 'Valider le **type** avant tout le reste, par schéma : `typeof` et `.length` mentent sur un tableau. Et configurer l’analyseur de query string pour qu’il ne fabrique ni tableaux ni objets imbriqués quand on n’en attend pas.',
    k: [8],
  },

  {
    id: 'race-multi-endpoint', module: 'm03', title: 'Course entre paiement et annulation',
    status: 'live', kind: 'exploit', level: 2, csslp: ['D5'], cwe: 'CWE-362',
    brief: 'La confirmation de paiement et l’annulation lisent puis écrivent l’état de la facture, chacune dans son coin, sans verrou.',
    goal: 'Obtenir une facture simultanément payée et remboursée — deux états qui s’excluent.',
    file: 'server/routes/invoices.ts',
    lessons: ['m03/l01', 'm03/l04'],
    hints: [
      'Deux routes écrivent le même état : /pay et /refund.',
      'Chacune lit l’état, attend, puis écrit. L’une après l’autre elles se bloquent ; ensemble, non.',
      'Envoie POST /api/invoices/INV-1002/pay et POST /api/invoices/INV-1002/refund en parallèle (Promise.all).',
    ],
    fix: 'Une transition d’état est une écriture conditionnelle unique (`WHERE status = ?`), pas une lecture suivie d’une écriture. Les courses multi-endpoints se ferment dans la base, jamais dans le code applicatif.',
  },

  {
    id: 'send-quota', module: 'm10', title: 'Envoi de factures détourné',
    status: 'live', kind: 'exploit', level: 2, csslp: ['D3', 'D4'], cwe: 'CWE-770',
    brief: 'Un compte fraîchement créé peut envoyer autant de factures qu’il veut, avec un texte libre, depuis le domaine de Novafact.',
    goal: 'Envoyer cent messages de phishing depuis un domaine légitime et authentifié SPF/DKIM.',
    file: 'server/routes/invoices.ts',
    lessons: ['m10/l05', 'm07/l07'],
    hints: [
      'POST /api/invoices/:id/send prend un destinataire, un sujet et un corps entièrement libres.',
      'Rien ne compte les envois. Le domaine expéditeur, lui, est authentifié SPF/DKIM.',
      'Boucle cent fois sur POST /api/invoices/INV-1001/send avec des destinataires différents, puis regarde /api/lab/mails.',
    ],
    fix: 'Quotas progressifs liés à l’ancienneté et à la vérification du compte, analyse du contenu sortant, réputation par tenant, canal de signalement, et sous-domaine distinct pour les envois transactionnels. Le cas QuickBooks : +36,5 % d’attaques via un domaine légitime en 2025.',
  },

  {
    id: 'token-in-url', module: 'm09', title: 'Jeton d’accès passé dans l’URL',
    status: 'live', kind: 'exploit', level: 1, csslp: ['D5', 'D7'], cwe: 'CWE-598',
    brief: 'Le lien de consultation d’une facture porte le jeton d’accès en paramètre de requête.',
    goal: 'Récupérer un jeton valide dans l’en-tête Referer d’un script tiers, puis dans les journaux d’accès.',
    file: 'server/routes/invoices.ts',
    lessons: ['m09/l02', 'm18/l01'],
    hints: [
      'GET /api/invoices/:id/share fabrique un lien de consultation. Regarde où le jeton y est posé.',
      'Une URL part en `Referer` vers tout ce que la page charge — et elle est écrite telle quelle dans le journal d’accès.',
      'Récupère le lien, ouvre-le, puis appelle GET /api/invoices/track.gif avec cette URL en en-tête `Referer`.',
    ],
    fix: 'Les secrets voyagent dans les en-têtes ou les cookies, jamais dans l’URL : une URL est journalisée, mise en cache, partagée et transmise en Referer. Pour un lien partageable, un jeton à usage unique et à courte durée, distinct de la session.',
  },

  {
    id: 'vary-missing', module: 'm03', title: 'Réponse authentifiée mise en cache',
    status: 'live', kind: 'exploit', level: 2, csslp: ['D5', 'D7'], cwe: 'CWE-524',
    brief: 'La liste des factures est mise en cache sans `Vary` sur l’identité ni `Cache-Control: private`.',
    goal: 'Obtenir la liste des factures d’un autre tenant sans présenter le moindre jeton.',
    file: 'server/routes/invoices.ts',
    lessons: ['m03/l06', 'm17/l05'],
    hints: [
      'GET /api/invoices répond avec `Cache-Control: public` et un en-tête `X-Lab-Cache`.',
      'La clé du cache ne contient que le chemin : l’identité de l’appelant n’y entre pas, et `Vary` non plus.',
      'Appelle GET /api/invoices avec un jeton, puis rappelle exactement la même URL sans aucun en-tête Authorization.',
    ],
    fix: 'Ce qui dépend de l’appelant ne se met pas en cache partagé : `private`, et une clé de cache conçue explicitement. `Vary` est un correctif fragile — il fragmente le cache sans supprimer la cause.',
  },

  {
    id: 'multistep-authz', module: 'm02', title: 'Autorisation sur une seule étape du flux',
    status: 'live', kind: 'exploit', level: 2, csslp: ['D5'], cwe: 'CWE-841',
    brief: 'L’émission d’un avoir se fait en trois requêtes ; seule la première vérifie le rôle comptable.',
    goal: 'Faire émettre un avoir validé sans jamais avoir eu le rôle comptable.',
    file: 'server/routes/credits.ts',
    lessons: ['m02/l02', 'm10/l06'],
    hints: [
      'L’émission d’un avoir passe par POST /credits/drafts, puis /drafts/:id/lines, puis /drafts/:id/issue.',
      'Seule la première étape regarde le rôle — et les deux autres n’exigent pas qu’elle ait eu lieu.',
      'Depuis un compte sans rôle comptable : POST /api/credits/drafts/CND-99/lines { "amount": 5000 }, puis POST /api/credits/drafts/CND-99/issue.',
    ],
    fix: 'Chaque étape d’un flux est un endpoint public : elle vérifie le droit **et** l’état attendu. Un jeton d’étape signé, ou une machine à états côté serveur, rend l’ordre non contournable.',
  },

  {
    id: 'dual-use-endpoint', module: 'm02', title: 'Endpoint à double usage mal isolé',
    status: 'live', kind: 'exploit', level: 2, csslp: ['D5'], cwe: 'CWE-284',
    brief: 'Une même route sert les réglages du tenant et ceux de la plateforme, discriminés par un champ du corps de la requête.',
    goal: 'Modifier un réglage global de la plateforme depuis un compte tenant ordinaire.',
    file: 'server/routes/settings.ts',
    lessons: ['m02/l02', 'm08/l09'],
    hints: [
      'PUT /api/settings ne sert pas que les réglages du tenant.',
      'Un champ du corps de la requête décide du périmètre de l’écriture.',
      'PUT /api/settings avec { "scope": "platform", "maintenanceMode": true } depuis un compte ordinaire.',
    ],
    fix: 'Deux niveaux de privilège, deux routes, deux contrôles. Un champ du corps qui décide du périmètre est une décision d’autorisation prise par le client.',
  },

  {
    id: 'eval-formula', module: 'm02', title: 'eval dans le calcul des pénalités',
    status: 'live', kind: 'exploit', level: 2, csslp: ['D5'], cwe: 'CWE-95',
    brief: 'La formule de pénalité de retard, configurable par le tenant, est évaluée avec `eval()` pour calculer le montant.',
    goal: 'Faire exécuter du JavaScript arbitraire côté serveur depuis la formule d’un tenant.',
    file: 'server/routes/settings.ts',
    lessons: ['m02/l04', 'm02/l08'],
    hints: [
      'La formule de pénalité est un réglage du tenant, et elle finit dans un interpréteur.',
      'Cet interpréteur est le langage entier, pas un évaluateur d’expressions : tout ce que Node sait faire est à portée.',
      'POST /api/settings/penalty avec { "formula": "process.pid" } — puis essaie `process.env`.',
    ],
    fix: 'Une expression métier n’a pas besoin d’un interpréteur complet : un mini-évaluateur à grammaire fermée (opérateurs et variables déclarés) suffit et ne peut rien faire d’autre. L’injection JS côté serveur est le A1 de NodeGoat.',
  },

  {
    id: 'vm-escape', module: 'm02', title: 'node:vm n’est pas un bac à sable',
    status: 'live', kind: 'exploit', level: 3, csslp: ['D5'], cwe: 'CWE-265',
    brief: 'La même formule est « isolée » dans `vm.runInNewContext`, dont on s’échappe en remontant par `this.constructor.constructor`.',
    goal: 'Depuis la formule, lire une valeur du processus hôte hors du contexte — le secret de signature des jetons.',
    file: 'server/routes/settings.ts',
    lessons: ['m02/l04', 'm03/l08'],
    hints: [
      'Le mode `sandbox` évalue la même formule dans `vm.runInNewContext`. Le contexte n’a ni `process` ni `require`.',
      'L’objet passé en contexte vient du realm hôte : `this.constructor` y renvoie son `Object`, et `Object.constructor` son `Function`.',
      'POST /api/settings/penalty avec { "engine": "sandbox", "formula": "this.constructor.constructor(\'return process.env.NOVAFACT_JWT_SECRET\')()" }.',
    ],
    fix: '`node:vm` isole les variables globales, pas les capacités : la documentation de Node le dit elle-même. Isolation par processus séparé, `isolated-vm`, ou pas d’exécution de code du tout. `vm2`, qui prétendait le contraire, est abandonné après une série d’évasions.',
  },

  {
    id: 'attachment-same-origin', module: 'm04', title: 'Pièce jointe servie sur l’origine de l’application',
    status: 'live', kind: 'exploit', level: 2, csslp: ['D4', 'D5'], cwe: 'CWE-79',
    brief: 'Les pièces jointes sont servies depuis l’origine de Novafact, sans en-tête de non-reniflage ni disposition de téléchargement, avec un type deviné.',
    goal: 'Exécuter du script sur l’origine de Novafact dans la session d’un utilisateur qui ouvre une pièce jointe.',
    file: 'server/routes/attachments.ts',
    lessons: ['m04/l06', 'm08/l10'],
    hints: [
      'Les pièces jointes sont servies depuis l’origine de l’application, avec le type annoncé au téléversement.',
      'Ni `X-Content-Type-Options: nosniff`, ni `Content-Disposition` : le navigateur parse ce qu’on lui dit de parser.',
      'Téléverse un `text/html` contenant un script, puis ouvre /api/attachments/u/<id> comme document ou iframe de l’application.',
    ],
    fix: 'Servir depuis une origine distincte — c’est la seule défense complète —, sinon `Content-Disposition: attachment`, `X-Content-Type-Options: nosniff`, type déduit du contenu. Un fichier téléversé est du contenu d’attaquant hébergé par toi.',
  },

  {
    id: 'svg-logo', module: 'm04', title: 'Logo SVG exécutable',
    status: 'live', kind: 'exploit', level: 2, csslp: ['D4', 'D5'], cwe: 'CWE-79',
    brief: 'Le logo du tenant accepte le format SVG et le sert tel quel, avec ses scripts et ses gestionnaires d’événements.',
    goal: 'Exécuter du script dans la session d’un administrateur plateforme qui consulte la fiche du tenant.',
    file: 'server/routes/attachments.ts',
    lessons: ['m04/l05', 'm08/l10'],
    hints: [
      'POST /api/attachments/logo accepte n’importe quel type, SVG compris, et le sert tel quel.',
      'Un SVG rendu comme document exécute ses `<script>` ; le même SVG dans une balise `<img>`, non.',
      'Téléverse un SVG contenant `<script>`, puis fais charger /api/attachments/logo/acme comme document ou iframe depuis un autre compte.',
    ],
    fix: 'Le SVG est un document XML actif, pas une image : le rendre en `<img>` (qui n’exécute pas de script), le rasteriser à l’envoi, ou l’assainir avec une bibliothèque dédiée. Et le servir depuis une autre origine.',
  },

  {
    id: 'toctou-upload', module: 'm03', title: 'TOCTOU sur le téléversement',
    status: 'live', kind: 'exploit', level: 2, csslp: ['D5'], cwe: 'CWE-367',
    brief: 'Le fichier est écrit sur disque et rendu accessible, puis validé et supprimé s’il ne convient pas.',
    goal: 'Télécharger le contenu d’un fichier que la validation a ensuite refusé.',
    file: 'server/routes/attachments.ts',
    lessons: ['m03/l01', 'm08/l10'],
    hints: [
      'POST /api/attachments répond immédiatement, en annonçant une analyse « en cours ».',
      'L’URL rendue est utilisable tout de suite ; la validation, elle, arrive quelques centaines de millisecondes plus tard.',
      'Téléverse un fichier que la validation refusera ({ "name": "facture.html", "contentType": "text/html" }) et télécharge-le dans la foulée.',
    ],
    fix: 'Valider avant de rendre disponible : écriture dans un emplacement non servi, validation, puis publication atomique. Entre le contrôle et l’usage, tout peut arriver — c’est la définition du TOCTOU.',
    k: [8],
  },

  {
    id: 'upload-pipeline', module: 'm08', title: 'Pipeline d’upload non isolé',
    status: 'live', kind: 'exploit', level: 2, csslp: ['D4', 'D5'], cwe: 'CWE-434',
    brief: 'Les pièces jointes sont stockées et servies depuis la même origine que l’application, avec le `Content-Type` annoncé par le client.',
    goal: 'Faire servir un fichier qui s’exécute dans l’origine de l’application.',
    file: 'server/routes/attachments.ts',
    lessons: ['m08/l10', 'm04/l06'],
    hints: [
      'Le pipeline de téléversement ne regarde ni le contenu ni l’extension avant de servir.',
      'Le `Content-Type` servi est exactement celui que le client a annoncé, sans confrontation avec le fichier.',
      'Téléverse { "name": "note.pdf", "contentType": "text/html", "content": "<script>1</script>" } et récupère /api/attachments/u/<id>.',
    ],
    fix: 'Servir depuis une origine distincte (ou `Content-Disposition: attachment` et `X-Content-Type-Options: nosniff`), type déduit du contenu et non de l’annonce, nom généré, analyse antivirus, et rendu dans un service séparé.',
  },

  {
    id: 'cache-deception-pdf', module: 'm03', title: 'Cache deception sur le PDF de facture',
    status: 'live', kind: 'exploit', level: 3, csslp: ['D5', 'D7'], cwe: 'CWE-525',
    brief: 'Le cache décide de stocker sur l’extension du chemin ; l’origine, elle, ignore le suffixe et sert la facture authentifiée.',
    goal: 'Récupérer dans le cache, sans session, le PDF d’une facture d’un autre tenant.',
    file: 'server/routes/export.ts',
    lessons: ['m03/l06', 'm17/l04'],
    hints: [
      'Compare ce que le cache regarde pour décider de stocker, et ce que l’origine regarde pour servir.',
      'L’origine retire le suffixe avant de chercher la facture ; le cache, lui, le garde dans sa clé.',
      'Avec un jeton valide : GET /api/export/invoice/INV-1001.pdf. Puis rejoue exactement la même URL sans aucun jeton.',
    ],
    fix: 'Les deux couches doivent lire le chemin pareil : normalisation identique, `Cache-Control: private` sur tout ce qui dépend de l’utilisateur, et pas de stockage décidé sur une extension devinée. *Gotta cache ’em all*, 2024.',
  },

  {
    id: 'cmd-injection', module: 'm02', title: 'Injection de commande dans l’export',
    status: 'live', kind: 'exploit', level: 2, csslp: ['D5'], cwe: 'CWE-78',
    brief: 'L’export comptable produit un PDF en appelant un binaire externe, avec un nom de fichier construit à partir du client.',
    goal: 'Faire exécuter une commande arbitraire par le serveur via le nom de l’export.',
    file: 'server/routes/export.ts',
    lessons: ['m02/l04', 'm02/l08'],
    hints: [
      'La réponse te rend la commande exacte que le serveur a lancée. Lis comment elle est assemblée.',
      'Le nom du document est placé entre guillemets doubles — un shell y interprète encore la substitution de commande.',
      'POST /api/export/pdf avec { "invoiceId": "INV-1001", "name": "$(id)" } : la sortie de `id` se retrouve dans le document produit.',
    ],
    fix: '`execFile` avec un tableau d’arguments plutôt qu’`exec` avec une chaîne : il n’y a plus de shell à échapper. Et le nom de fichier se génère côté serveur, il ne se reprend pas du client.',
  },

  {
    id: 'csv-formula-injection', module: 'm02', title: 'Injection de formule dans l’export CSV',
    status: 'live', kind: 'exploit', level: 1, csslp: ['D5'], cwe: 'CWE-1236',
    brief: 'Le nom du client est écrit tel quel dans la cellule du CSV comptable, sans neutralisation.',
    goal: 'Obtenir un export dont une cellule commence par un caractère de formule, depuis un champ saisi dans l’application.',
    file: 'server/routes/export.ts',
    lessons: ['m02/l02', 'm07/l05'],
    hints: [
      'L’export CSV recopie les champs texte de la facture sans rien leur faire.',
      'Une cellule qui commence par `=`, `+`, `-` ou `@` n’est plus une donnée pour le tableur qui l’ouvre.',
      'PATCH /api/invoices/INV-1001 avec { "client": "=HYPERLINK(\\"http://attaquant.invalid\\",\\"Facture\\")" }, puis GET /api/export/csv.',
    ],
    fix: 'Le tableur du destinataire est un interpréteur : préfixer les cellules commençant par `=`, `+`, `-`, `@`, tabulation ou retour chariot, ou produire un format qui n’exécute rien. La vulnérabilité ne s’exécute pas chez toi — elle s’exécute chez ton client.',
  },

  {
    id: 'ssrf-pdf-renderer', module: 'm03', title: 'SSRF par le générateur de PDF',
    status: 'live', kind: 'exploit', level: 3, csslp: ['D5'], cwe: 'CWE-918',
    brief: 'Le PDF de facture est rendu depuis du HTML dont le tenant contrôle un bloc, et le moteur de rendu accepte les schémas locaux et les cadres.',
    goal: 'Faire apparaître dans le PDF produit le contenu d’un fichier local du serveur.',
    file: 'server/routes/export.ts',
    lessons: ['m03/l11', 'm08/l10'],
    hints: [
      'Le bloc d’en-tête du PDF est du HTML que tu fournis, et le moteur de rendu le suit.',
      'Un moteur de rendu est un navigateur : il va chercher les `src` des `<img>` et des `<iframe>`, quel que soit le schéma.',
      'POST /api/export/render avec { "header": "<iframe src=\\"file:///etc/passwd\\"></iframe>" } : le fichier revient dans le PDF.',
    ],
    fix: 'Un moteur de rendu HTML est un navigateur : il fait des requêtes. Rendu dans un processus isolé, sans accès réseau ni système de fichiers, à partir d’un gabarit dont les données sont échappées.',
  },

  {
    id: 'ssti-render-options', module: 'm03', title: 'SSTI par les options de rendu',
    status: 'live', kind: 'exploit', level: 3, csslp: ['D5'], cwe: 'CWE-94',
    brief: 'Les paramètres de requête sont étalés dans les options de rendu de la vue, ce qui laisse le client injecter une option de compilation du moteur.',
    goal: 'Obtenir une exécution de code serveur sans jamais toucher au contenu du gabarit.',
    file: 'server/routes/export.ts',
    lessons: ['m03/l08', 'm02/l02'],
    hints: [
      'Le gabarit est en dur, le client n’y touche jamais. Regarde plutôt d’où viennent les options passées au moteur.',
      'Les valeurs d’`outputFunctionName` et d’`escape` sont recopiées verbatim dans la source compilée.',
      'GET /api/export/preview?escape=String(globalThis.x%3D1)%2BString — le « nom de fonction » est du code, et il s’exécute.',
    ],
    fix: 'Ne jamais étaler `req.query` ni `req.body` dans un objet d’options : les options de configuration d’un moteur sont aussi dangereuses que son gabarit. CVE-2022-29078 (EJS) repose exactement là-dessus.',
  },

  {
    id: 'xml-entity-expansion', module: 'm02', title: 'Expansion d’entités sur le même import',
    status: 'live', kind: 'exploit', level: 2, csslp: ['D5', 'D6'], cwe: 'CWE-776',
    brief: 'Aucune limite d’expansion ni de profondeur sur le parseur XML : un document de quelques kilo-octets en produit des gigaoctets.',
    goal: 'Faire dépasser au parseur le budget mémoire et temps que le serveur mesure sur la requête d’import.',
    file: 'server/routes/import.ts',
    lessons: ['m02/l02', 'm13/l05'],
    hints: [
      'Le même parseur n’a aucune limite d’expansion — et le serveur, lui, mesure ce qu’il produit.',
      'Une entité qui en référence dix, sur plusieurs niveaux, multiplie la taille par dix à chaque niveau.',
      'Envoie un « billion laughs » : `lol` de trente caractères, puis `lol1`…`lol6` référençant chacun dix fois le précédent, et `&lol6;` dans `<note>`.',
    ],
    fix: 'Limites d’expansion, de profondeur et de taille fixées avant le parsing, et traitement hors de la boucle d’événements. La disponibilité est une exigence de sécurité : un parseur sans budget est un déni de service en attente.',
    k: [10],
  },

  {
    id: 'xxe-import', module: 'm02', title: 'XXE à l’import de facture électronique',
    status: 'live', kind: 'exploit', level: 2, csslp: ['D5'], cwe: 'CWE-611',
    brief: 'Le parseur XML des factures entrantes (format Factur-X) a les entités externes et le DOCTYPE activés.',
    goal: 'Faire apparaître le contenu d’un fichier local du serveur dans un champ de la facture créée.',
    file: 'server/routes/import.ts',
    lessons: ['m02/l02', 'm03/l07'],
    hints: [
      'L’import Factur-X attend un document XML brut (Content-Type: application/xml).',
      'Le DOCTYPE est accepté, et les entités déclarées SYSTEM sont résolues par le parseur.',
      'Déclare `<!ENTITY xxe SYSTEM "file:///etc/passwd">` et référence `&xxe;` dans `<note>` : le fichier atterrit dans la facture créée.',
    ],
    fix: 'Entités externes et DOCTYPE désactivés par défaut dans le parseur — c’est un réglage, pas un filtrage. Le XML reste un format à surface large : si le besoin le permet, préférer un format sans entités ni références.',
    k: [10],
  },

  {
    id: 'zip-slip', module: 'm02', title: 'Zip Slip à l’import d’un lot de factures',
    status: 'live', kind: 'exploit', level: 2, csslp: ['D5'], cwe: 'CWE-22',
    brief: 'L’archive d’import est extraite en concaténant le nom de chaque entrée au dossier cible, sans normaliser ni vérifier le résultat.',
    goal: 'Faire écrire par le serveur un fichier hors du dossier d’import, et écraser la configuration d’un autre tenant.',
    file: 'server/routes/import.ts',
    lessons: ['m02/l04', 'm08/l10'],
    hints: [
      'L’import d’archive écrit chaque entrée dans le dossier du tenant, sous le nom que porte l’entrée.',
      '`path.join` résout les `..` : le chemin final peut sortir du dossier, et rien ne le vérifie après coup.',
      'POST /api/import/archive avec { "entries": [{ "name": "../../tenants/globex/settings.json", "content": "{}" }] }.',
    ],
    fix: 'Le nom d’entrée d’une archive est une donnée d’attaquant comme une autre : `path.resolve` puis vérification du préfixe avec séparateur, et refus des entrées absolues comme des liens symboliques. Recherche Zip Slip (Snyk).',
  },

  {
    id: 'json-duplicate-keys', module: 'm02', title: 'Clés JSON dupliquées',
    status: 'live', kind: 'exploit', level: 2, csslp: ['D5'], cwe: 'CWE-436',
    brief: 'Le schéma valide le corps brut par une passe textuelle, puis l’analyseur JSON retient la dernière occurrence de chaque clé.',
    goal: 'Créer une ligne de facture dont le montant stocké est précisément celui que le schéma venait de refuser.',
    file: 'server/lib/validate.ts',
    lessons: ['m02/l02', 'm03/l07'],
    hints: [
      'POST /api/import/invoice-json prend le document en text/plain, et le schéma le regarde avant JSON.parse.',
      'La passe de schéma s’arrête à la première occurrence d’une clé ; JSON.parse, lui, retient la dernière.',
      'Envoie {"client":"X","lines":[{"label":"L","qty":1,"unitPrice":10,"unitPrice":999999999}]} : le schéma voit 10, la facture stocke 999999999.',
    ],
    fix: 'Valider l’objet **issu** du parsing, jamais le texte : deux analyseurs d’un même format ne sont jamais d’accord sur les cas limites. C’est la famille des parser differentials, appliquée au plus banal des formats.',
    k: [8],
  },

  {
    id: 'deserialization', module: 'm03', title: 'Désérialisation de types arbitraires',
    status: 'live', kind: 'exploit', level: 3, csslp: ['D5'], cwe: 'CWE-502',
    brief: 'L’import d’un modèle de facture accepte un format qui reconstruit des objets typés.',
    goal: 'Obtenir une exécution de code en important un modèle forgé.',
    file: 'server/routes/templates.ts',
    lessons: ['m03/l09', 'm14/l06'],
    hints: [
      'POST /api/templates/import accepte un modèle « novamodel » : du JSON, plus un champ `$type` par nœud.',
      'C’est le document qui choisit le type à reconstruire, et l’un des types produit un objet appelable.',
      '{ "model": { "$type": "Template", "name": "x", "onLoad": { "$type": "Function", "source": "return process.env.NOVAFACT_JWT_SECRET" } } }',
    ],
    fix: 'Des formats qui n’acceptent jamais de types arbitraires : JSON avec schéma strict, `js-yaml` en schéma sûr. La désérialisation reconstruit des données, pas des objets vivants.',
    k: [8],
  },

  {
    id: 'ssti-email-template', module: 'm03', title: 'SSTI dans le gabarit de relance',
    status: 'live', kind: 'exploit', level: 3, csslp: ['D5'], cwe: 'CWE-1336',
    brief: 'Le gabarit d’e-mail éditable par le tenant est compilé par le moteur de template : l’entrée arrive dans la partie *gabarit*, pas dans les données.',
    goal: 'Faire apparaître dans le message rendu une valeur du processus serveur — le secret de signature des jetons.',
    file: 'server/routes/templates.ts',
    lessons: ['m03/l08', 'm08/l09'],
    hints: [
      'PUT /api/templates/TPL-1 laisse réécrire le gabarit de relance, et l’aperçu le compile.',
      'Ce que tu écris entre `{{` et `}}` n’est pas une donnée du rendu : c’est une expression du programme qui rend.',
      'Mets `{{ process.env.NOVAFACT_JWT_SECRET }}` dans le corps du gabarit, puis POST /api/templates/TPL-1/preview.',
    ],
    fix: 'Un template fourni par l’utilisateur est du code. Moteur sans logique (Mustache strict), liste de variables autorisées, et rendu dans un processus séparé. La donnée va dans le contexte, jamais dans le gabarit.',
  },

  {
    id: 'param-pollution', module: 'm03', title: 'Pollution de paramètres côté serveur',
    status: 'live', kind: 'exploit', level: 2, csslp: ['D5'], cwe: 'CWE-235',
    brief: 'La recherche de clients relaie la requête vers une API interne en concaténant les paramètres reçus.',
    goal: 'Injecter un paramètre supplémentaire dans l’appel interne pour obtenir des champs non prévus.',
    file: 'server/routes/clients.ts',
    lessons: ['m03/l03', 'm08/l09'],
    hints: [
      'GET /api/clients relaie ta recherche vers un service interne — et la réponse te montre la requête sortante.',
      'Elle est construite par concaténation : un `&` dans ton terme de recherche y devient un séparateur de paramètres.',
      'GET /api/clients?q=Dupont%26fields=* — puis essaie %26tenant=globex.',
    ],
    fix: 'Construire la requête sortante à partir de valeurs validées, avec un encodeur, jamais par concaténation. Les appels internes sont une surface d’attaque au même titre que l’API publique.',
  },
];

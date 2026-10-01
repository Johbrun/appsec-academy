import { defineSeries, type SeriesProfile } from '../lib/series';

// Modèle du jeu « Abuse Desk » (M15) : du trafic sur Novafact, des contrôles, des compromis.
// Le modèle est volontairement simple et déterministe : chaque contrôle bloque une fraction d'un segment d'abus
// et gêne une fraction d'un segment légitime. Les effets de plusieurs contrôles se combinent : 1 - Π(1 - e).
// Le score pondère l'abus bloqué (60 %) et les clients épargnés (40 %) ; 0 % = ne rien faire, 100 % = le
// meilleur réglage, calculé par parcours exhaustif des configurations de chaque scénario.
//
// Une série = un scénario. La difficulté ne vient pas du nombre de contrôles : elle vient de ce qu'il faut
// lire dans la description du trafic pour savoir quel contrôle porte.
//
//   N1 · Chaque abus a un contrôle qui le vise, et le texte du segment le désigne (« depuis 2 adresses IP »,
//        « adresses jetables »). Le seul piège est un réglage maximal dont le coût pour les clients est
//        écrit dans son indice. On apprend la forme : bloquer sans casser.
//
//   N2 · Un contrôle d'apparence pertinente ne touche pas l'attaque (une limite par IP face à un botnet ou à
//        des proxys résidentiels), ou un segment légitime ressemble à l'abus (un cabinet derrière un NAT, un
//        partenaire serveur à serveur). Il faut croiser le texte des segments et celui des indices.
//
//   N3 · Aucun contrôle ne suffit seul : le meilleur réglage empile des contrôles partiels, et l'option
//        radicale (supprimer l'essai gratuit, supprimer le SMS) est le piège — elle « règle » l'abus en
//        coûtant plus aux clients qu'elle ne rapporte. Un détail du scénario (des plages surtaxées aussi
//        dans les pays des clients, des sessions qui changent toutes les deux cartes) décide du réglage.

export type ControlId = string;
export type Config = Record<ControlId, number>; // index de l'option choisie

export type Control = {
  id: ControlId;
  name: string;
  where: string;
  options: string[];
  hint: string;
  /** Effet de chaque option : blocage (segments d'abus) ou gêne (segments légitimes), entre 0 et 1. */
  effects: Record<string, number>[];
};

export type Segment = {
  id: string;
  name: string;
  kind: 'abuse' | 'legit';
  weight: number;
  text: string;
  /** Abus : bloqué en dessous de ce seuil = échec. Légitime : gêné au-delà = échec. */
  threshold: number;
  /** Message du journal quand le seuil n'est pas tenu. `e` = part bloquée ou gênée. */
  ko: (e: number) => string;
  /** Message du journal quand il l'est (facultatif pour les segments légitimes). */
  ok?: (e: number) => string;
};

export type LogLine = { good: boolean; text: string };

export interface AbuseScenario {
  /** Identifiant stable : il sert à composer les séries. */
  id: string;
  level: 1 | 2 | 3;
  title: string;
  context: string;
  controls: Control[];
  segments: Segment[];
  /** Lignes de journal propres au scénario, ajoutées après celles des segments. */
  extraLog?: (cfg: Config, e: Record<string, number>) => LogLine[];
  /** Ce qu'il fallait voir, affiché en fin de partie. */
  debrief: string;
  /** Un cas réel documenté, quand il y en a un qui colle. */
  realCase?: string;
}

const pct = (x: number) => Math.round(x * 100);

// ── N1 · La connexion ───────────────────────────────────────────────────────

const connexion: AbuseScenario = {
  id: 'connexion',
  level: 1,
  title: 'La connexion',
  context: 'La page de connexion seule, un mardi ordinaire. Deux attaques la visent, chacune depuis une poignée d’adresses IP. Trois réglages.',
  controls: [
    { id: 'perIp', name: 'Limite par IP', where: 'POST /login', options: ['Aucune', '100 / 15 min', '20 / 15 min'], hint: 'Efficace quand l’attaque vient de peu d’adresses. Ici, aucun client ne partage son IP avec des centaines d’autres.',
      effects: [{}, { brute: 0.6, spray: 0.5 }, { brute: 0.9, spray: 0.85, users: 0.01 }] },
    { id: 'perAccount', name: 'Échecs par compte', where: 'POST /login', options: ['Aucune', 'Ralentir après 5', 'Verrouiller après 3'], hint: 'Un délai croissant protège le compte visé. Un verrouillage le protège aussi… de son propriétaire, surtout s’il hésite.',
      effects: [{}, { brute: 0.9, hesitants: 0.03 }, { brute: 0.97, hesitants: 0.7, users: 0.02 }] },
    { id: 'common', name: 'Mots de passe courants', where: 'Connexion et changement', options: ['Non', 'Oui'], hint: 'Refuse les mots de passe des listes de fuites et fait changer ceux qui y figurent déjà.',
      effects: [{}, { spray: 0.75, users: 0.03 }] },
  ],
  segments: [
    { id: 'brute', name: 'Force brute ciblée', kind: 'abuse', weight: 0.55, threshold: 0.7,
      text: 'Des milliers d’essais sur 15 comptes de gérants, depuis 2 adresses IP.',
      ko: (e) => `${Math.max(1, Math.round((1 - e) * 4))} compte(s) de gérant cède(nt) : rien ne borne les essais sur un même compte ni depuis une même adresse.`,
      ok: () => 'La force brute s’épuise : chaque essai coûte de plus en plus cher à l’attaquant.' },
    { id: 'spray', name: 'Pulvérisation', kind: 'abuse', weight: 0.45, threshold: 0.6,
      text: '« Novafact2024! » et deux variantes, essayés une fois sur chacun de 3 000 comptes, depuis 4 adresses IP.',
      ko: (e) => `La pulvérisation trouve ${Math.round((1 - e) * 60)} comptes au mot de passe prévisible.`,
      ok: () => 'La pulvérisation échoue : ses mots de passe sont refusés ou ses adresses ralenties.' },
    { id: 'users', name: 'Utilisateurs', kind: 'legit', weight: 0.75, threshold: 0.05,
      text: '8 000 connexions, dont quelques fautes de frappe.',
      ko: () => 'Le support signale une hausse des utilisateurs bloqués à la connexion.' },
    { id: 'hesitants', name: 'Mémoires hésitantes', kind: 'legit', weight: 0.25, threshold: 0.2,
      text: '300 utilisateurs qui essaient trois ou quatre mots de passe avant le bon.',
      ko: (e) => `${Math.round(e * 300)} utilisateurs se retrouvent verrouillés dehors après leur troisième essai et appellent le support.` },
  ],
  debrief: 'Chaque attaque avait son contrôle, écrit dans son texte : peu d’adresses IP pour la limite par IP, peu de comptes pour la limite par compte, un mot de passe prévisible pour la liste des mots de passe courants. Le seul piège était le verrouillage : il protège le compte en le rendant inutilisable, pour l’attaquant comme pour son propriétaire — et il offre à n’importe qui le moyen de bloquer un compte en échouant trois fois. Un délai croissant obtient presque le même blocage sans ce coût.',
};

// ── N1 · L'inscription ──────────────────────────────────────────────────────

const inscription: AbuseScenario = {
  id: 'inscription',
  level: 1,
  title: 'L’inscription',
  context: 'Le formulaire d’inscription. Des comptes créés en masse servent à envoyer de fausses factures depuis l’infrastructure de Novafact. Les vraies inscriptions viennent de PME, avec l’adresse de leur domaine, et d’indépendants, souvent avec un webmail.',
  controls: [
    { id: 'turnstile', name: 'Turnstile', where: 'Inscription', options: ['Non', 'Oui'], hint: 'Défi invisible pour la plupart des humains, coûteux pour un script à bas prix. Il ne ralentit pas un humain qui s’inscrit à la main.',
      effects: [{}, { bots: 0.8, pme: 0.02, indep: 0.02 }] },
    { id: 'disposable', name: 'Domaines jetables', where: 'Inscription', options: ['Autorisés', 'Refusés'], hint: 'Une liste tenue à jour des services d’e-mail jetable.',
      effects: [{}, { jetables: 0.75, bots: 0.2 }] },
    { id: 'webmail', name: 'Webmails', where: 'Inscription', options: ['Autorisés', 'Refusés'], hint: 'Exige une adresse de domaine d’entreprise : Gmail, Outlook ou Orange sont refusés.',
      effects: [{}, { jetables: 0.1, bots: 0.3, indep: 0.9, pme: 0.02 }] },
    { id: 'verify', name: 'E-mail vérifié', where: 'Avant le premier envoi', options: ['Non', 'Oui'], hint: 'Un lien à cliquer avant d’envoyer une facture. Une boîte jetable le reçoit aussi.',
      effects: [{}, { bots: 0.3, pme: 0.03, indep: 0.03 }] },
  ],
  segments: [
    { id: 'bots', name: 'Inscriptions scriptées', kind: 'abuse', weight: 0.6, threshold: 0.6,
      text: 'Un script crée des centaines de comptes par heure depuis des serveurs loués.',
      ko: (e) => `${Math.round((1 - e) * 900)} comptes scriptés passent et envoient leurs fausses factures.`,
      ok: () => 'Le script d’inscription ne passe presque plus : chaque compte lui coûte trop cher.' },
    { id: 'jetables', name: 'Adresses jetables', kind: 'abuse', weight: 0.4, threshold: 0.5,
      text: 'Des inscriptions faites à la main, chacune avec l’adresse d’un service d’e-mail jetable.',
      ko: () => 'Les inscriptions à la main passent : ni un défi ni un lien de vérification n’arrêtent un humain avec une boîte jetable.',
      ok: () => 'Les adresses jetables sont refusées dès le formulaire.' },
    { id: 'pme', name: 'PME', kind: 'legit', weight: 0.7, threshold: 0.1,
      text: 'Des inscriptions avec l’adresse du domaine de l’entreprise.',
      ko: () => 'Des PME abandonnent l’inscription en route.' },
    { id: 'indep', name: 'Indépendants', kind: 'legit', weight: 0.3, threshold: 0.1,
      text: 'Des artisans et des consultants inscrits avec leur adresse Gmail ou Orange.',
      ko: (e) => `${pct(e)} % des indépendants ne peuvent plus s’inscrire : leur seule adresse est un webmail.` },
  ],
  debrief: 'Deux abus, deux contrôles : un défi contre le script, une liste de domaines jetables contre les humains qui s’inscrivent à la main. La vérification de l’e-mail ajoute un peu de coût au script, rien contre une boîte jetable. Le piège était le refus des webmails : il frappe plus fort les indépendants que les fraudeurs, qui ont d’autres adresses sous la main.',
};

// ── N2 · Une journée ordinaire ──────────────────────────────────────────────

const journee: AbuseScenario = {
  id: 'journee',
  level: 2,
  title: 'Une journée ordinaire',
  context: 'Une journée de trafic complète : clients, réseaux partagés, bots et fraudeurs. Trois attaques à la fois, sur la connexion et sur l’envoi de factures.',
  controls: [
    { id: 'perIp', name: 'Limite par IP', where: 'POST /login', options: ['Aucune', '100 / 15 min', '20 / 15 min', '5 / 15 min'], hint: 'Efficace contre une source unique, aveugle face à un botnet, et brutale pour les bureaux derrière un NAT.',
      effects: [{}, { brute: 0.5, nat: 0.3 }, { brute: 0.85, stuffing: 0.02, nat: 0.8 }, { brute: 0.95, stuffing: 0.1, nat: 1, users: 0.05 }] },
    { id: 'perAccount', name: 'Échecs par compte', where: 'POST /login', options: ['Aucune', 'Ralentir après 10', 'Ralentir après 5'], hint: 'Protège un compte ciblé. Un ralentissement progressif évite de verrouiller le compte au profit de l’attaquant.',
      effects: [{}, { brute: 0.8, users: 0.01 }, { brute: 0.95, users: 0.03 }] },
    { id: 'breached', name: 'Mots de passe fuités', where: 'Connexion et changement', options: ['Non', 'Oui'], hint: 'Vérification par k-anonymat : un compte au mot de passe fuité est invité à le changer.',
      effects: [{}, { stuffing: 0.6, brute: 0.2, users: 0.04 }] },
    { id: 'atp', name: 'AWS WAF ATP', where: 'POST /login', options: ['Non', 'Oui'], hint: 'Détection d’identifiants volés connus et de signaux de volume par client, gérée par AWS.',
      effects: [{}, { stuffing: 0.7, brute: 0.3, users: 0.01 }] },
    { id: 'turnstile', name: 'Turnstile', where: 'Inscription', options: ['Non', 'Oui'], hint: 'Défi invisible pour la plupart des humains, coûteux pour l’automatisation à bas prix.',
      effects: [{}, { fraud: 0.5, smb: 0.03 }] },
    { id: 'verify', name: 'E-mail vérifié', where: 'Avant le premier envoi', options: ['Non', 'Oui'], hint: 'Les adresses jetables passent, mais l’inscription en masse devient plus chère.',
      effects: [{}, { fraud: 0.3, smb: 0.05 }] },
    { id: 'quota', name: 'Quota d’envoi des nouveaux comptes', where: '7 premiers jours', options: ['Aucun', '50 / jour', '10 / jour'], hint: 'Les fraudeurs veulent envoyer beaucoup et vite. Une vraie PME envoie rarement plus de 30 factures le premier jour.',
      effects: [{}, { fraud: 0.4, smb: 0.1 }, { fraud: 0.8, smb: 0.7 }] },
  ],
  segments: [
    { id: 'stuffing', name: 'Credential stuffing', kind: 'abuse', weight: 0.45, threshold: 0.5,
      text: '40 000 tentatives depuis 6 000 IP résidentielles, une seule tentative par compte.',
      ko: (e) => `Le credential stuffing aboutit sur ${Math.round((1 - e) * 40)} comptes : une limite par IP ne voit pas un botnet qui ne fait qu’un essai par adresse.`,
      ok: (e) => `Le stuffing est largement contenu (${pct(e)} % bloqué) : les signaux sur les identifiants fuités fonctionnent là où les limites de volume échouent.` },
    { id: 'brute', name: 'Attaque ciblée', kind: 'abuse', weight: 0.2, threshold: 0.7,
      text: 'Des milliers d’essais sur les comptes de 12 administrateurs, depuis quelques IP.',
      ko: () => 'Deux comptes administrateurs cèdent à l’attaque ciblée : rien ne limite les essais sur un même compte.' },
    { id: 'fraud', name: 'Fraude à la facture', kind: 'abuse', weight: 0.35, threshold: 0.6,
      text: 'Des comptes créés en série envoient de fausses factures au nom de Novafact.',
      ko: (e) => `${Math.round((1 - e) * 1200)} fausses factures partent depuis l’infrastructure d’envoi de Novafact ; la réputation du domaine d’envoi chute.`,
      ok: () => 'La fraude à la facture devient trop coûteuse : les comptes créés en série n’envoient presque rien.' },
    { id: 'users', name: 'Utilisateurs', kind: 'legit', weight: 0.6, threshold: 0.05,
      text: '10 000 connexions légitimes, dont quelques fautes de frappe.',
      ko: () => 'Le support signale une hausse des utilisateurs bloqués à la connexion.' },
    { id: 'nat', name: 'Cabinet Durand', kind: 'legit', weight: 0.2, threshold: 0.5,
      text: '300 comptables derrière une seule IP de sortie.',
      ko: () => 'Le cabinet Durand ouvre un ticket prioritaire : la moitié de ses comptables ne peut plus se connecter. Une limite par IP punit les réseaux partagés.' },
    { id: 'smb', name: 'Nouvelles PME', kind: 'legit', weight: 0.2, threshold: 0.3,
      text: 'Des inscriptions réelles qui envoient leurs premières factures dans la journée.',
      ko: () => 'Des PME fraîchement inscrites ne peuvent pas envoyer leurs factures d’ouverture : plusieurs abandonnent l’essai.' },
  ],
  extraLog: (cfg, e) => (cfg.perAccount === 2 && cfg.perIp <= 1 && e.nat < 0.5
    ? [{ good: true, text: 'Le ralentissement par compte protège les administrateurs sans gêner le cabinet Durand.' }]
    : []),
  debrief: 'Le meilleur réglage combine des signaux qualitatifs (identifiants fuités, ATP) contre le stuffing, un ralentissement par compte contre l’attaque ciblée, une friction à l’inscription et un quota modéré pour les nouveaux comptes. Le leurre est la limite par IP : elle ne voit pas 6 000 adresses qui ne font qu’un essai chacune, et elle frappe de plein fouet 300 comptables derrière une seule adresse.',
  realCase: 'PayPal, décembre 2022 : 34 942 comptes consultés par credential stuffing entre le 6 et le 8 décembre, sans compromission des systèmes de PayPal selon sa notification aux personnes concernées. 23andMe, 2023 : environ 14 000 comptes pris par la même technique, et, par la fonction DNA Relatives, les profils de 6,9 millions de personnes exposés (dépôt 8-K modifié auprès de la SEC).',
};

// ── N2 · La réinitialisation ────────────────────────────────────────────────

const reinitialisation: AbuseScenario = {
  id: 'reinitialisation',
  level: 2,
  title: 'Le mot de passe oublié',
  context: 'Le formulaire « mot de passe oublié » répond « Aucun compte associé à cette adresse » quand l’adresse est inconnue, et envoie l’e-mail pendant la requête : la réponse prend 900 ms si le compte existe, 40 ms sinon. Le formulaire d’inscription, lui, affiche « Cette adresse est déjà utilisée ».',
  controls: [
    { id: 'uniform', name: 'Réponse uniforme', where: 'Réinitialisation', options: ['Non', 'Oui'], hint: '« Si un compte existe, un e-mail vient d’être envoyé. » Celui qui s’est trompé d’adresse ne le saura plus.',
      effects: [{}, { enum: 0.45, users: 0.02 }] },
    { id: 'async', name: 'Envoi en file d’attente', where: 'Réinitialisation', options: ['Non', 'Oui'], hint: 'La réponse part avant l’envoi de l’e-mail : même durée, que le compte existe ou non.',
      effects: [{}, { enum: 0.25 }] },
    { id: 'signup', name: 'Inscription neutre', where: 'Inscription', options: ['Non', 'Oui'], hint: '« Vérifiez votre boîte » dans tous les cas ; le titulaire d’une adresse déjà inscrite reçoit un e-mail qui le lui dit.',
      effects: [{}, { enum: 0.45, users: 0.01 }] },
    { id: 'perTarget', name: 'Limite par destinataire', where: 'Réinitialisation', options: ['Aucune', '3 / heure', '1 / jour'], hint: 'Borne le nombre d’e-mails envoyés à une même adresse, quelle que soit l’origine des demandes.',
      effects: [{}, { bomb: 0.9, users: 0.01 }, { bomb: 0.97, users: 0.15 }] },
    { id: 'perIp', name: 'Limite par IP', where: 'Réinitialisation et inscription', options: ['Aucune', '30 / heure', '5 / heure'], hint: 'Des proxys résidentiels changent d’adresse à chaque requête ; un cabinet partage la sienne entre tous ses employés.',
      effects: [{}, { enum: 0.1, bomb: 0.2, office: 0.2 }, { enum: 0.2, bomb: 0.4, office: 0.8, users: 0.01 }] },
    { id: 'turnstile', name: 'Turnstile', where: 'Réinitialisation et inscription', options: ['Non', 'Oui'], hint: 'Renchérit chaque essai automatisé, sans le rendre impossible.',
      effects: [{}, { enum: 0.5, bomb: 0.5, users: 0.02, office: 0.02 }] },
  ],
  segments: [
    { id: 'enum', name: 'Énumération de comptes', kind: 'abuse', weight: 0.55, threshold: 0.7,
      text: 'Un script teste 200 000 adresses issues d’une fuite, à travers des proxys résidentiels, pour savoir lesquelles sont clientes de Novafact : la liste nourrira un hameçonnage ciblé.',
      ko: (e) => `L’attaquant repart avec ${Math.round((1 - e) * 12000)} adresses confirmées comme clientes — par le message, par le temps de réponse ou par l’inscription.`,
      ok: () => 'L’énumération ne rapporte presque plus rien : message, durée et inscription répondent pareil pour tout le monde.' },
    { id: 'bomb', name: 'Bombardement d’e-mails', kind: 'abuse', weight: 0.45, threshold: 0.7,
      text: 'Des milliers de demandes visent 40 comptes : boîtes saturées, et le domaine d’envoi de Novafact signalé comme spam.',
      ko: () => 'Les 40 boîtes visées débordent, et plusieurs fournisseurs d’e-mail classent les messages de Novafact en indésirables.',
      ok: () => 'Les boîtes visées ne reçoivent plus que quelques messages.' },
    { id: 'users', name: 'Oublis ordinaires', kind: 'legit', weight: 0.7, threshold: 0.1,
      text: 'Des utilisateurs qui ont oublié leur mot de passe, dont certains redemandent l’e-mail qui tarde.',
      ko: () => 'Des utilisateurs attendent un second e-mail qui ne viendra pas avant demain, et appellent le support.' },
    { id: 'office', name: 'Cabinet Durand', kind: 'legit', weight: 0.3, threshold: 0.3,
      text: 'Une vague de réinitialisations derrière une seule IP, le lundi où le cabinet impose le changement des mots de passe.',
      ko: () => 'Le cabinet Durand ne peut plus réinitialiser au-delà des premiers employés : la limite par IP le prend pour un attaquant.' },
  ],
  debrief: 'L’énumération a trois canaux, et fermer le message ne ferme que le premier : la durée de réponse trahit encore l’existence du compte, et l’inscription le dit en toutes lettres. Seules la réponse uniforme, l’envoi en file et l’inscription neutre ensemble l’assèchent. Le bombardement, lui, se borne par destinataire — c’est la victime qui est constante, pas l’adresse IP. La limite par IP semble couvrir les deux ; elle ne voit pas des proxys résidentiels et elle bloque le cabinet Durand.',
  realCase: 'Twitter, 2022 : une modification de juin 2021 faisait répondre l’API avec le compte associé à une adresse e-mail ou à un numéro de téléphone. Signalée en janvier 2022 par le programme de bug bounty et corrigée, elle avait déjà servi à constituer un fichier de 5,4 millions de comptes, mis en vente en juillet 2022.',
};

// ── N2 · L'aspiration de l'API ──────────────────────────────────────────────

const scraping: AbuseScenario = {
  id: 'scraping',
  level: 2,
  title: 'L’API publique',
  context: 'L’API expose un annuaire d’entreprises — recherche par nom ou SIREN, pour l’autocomplétion des clients — et, pour les comptes connectés, l’export complet des factures. Les partenaires ERP synchronisent chaque nuit depuis quelques IP fixes, avec des clés de plan payant.',
  controls: [
    { id: 'perIp', name: 'Limite par IP', where: 'API', options: ['Aucune', '600 / min', '60 / min'], hint: 'Borne le débit de chaque adresse, quelle que soit la clé utilisée.',
      effects: [{}, { scrape: 0.1, partners: 0.3 }, { scrape: 0.3, partners: 0.9, users: 0.01 }] },
    { id: 'planQuota', name: 'Quota par clé, selon le plan', where: 'API', options: ['Non', 'Oui'], hint: 'Gratuit : 1 000 requêtes par jour. Payant : selon contrat. L’aspiration doit alors payer ses clés.',
      effects: [{}, { scrape: 0.6, partners: 0.02 }] },
    { id: 'cursor', name: 'Pagination bornée', where: 'Annuaire', options: ['Non', 'Oui'], hint: '50 résultats par page, curseurs opaques au lieu d’identifiants séquentiels, pas de recherche vide.',
      effects: [{}, { scrape: 0.3, partners: 0.03 }] },
    { id: 'bot', name: 'Détection de bots', where: 'API', options: ['Non', 'Oui', 'Oui, clés partenaires exemptées'], hint: 'Signaux de navigateur et de comportement. Un client serveur à serveur ressemble à un bot, sauf s’il est déclaré.',
      effects: [{}, { scrape: 0.45, exfil: 0.15, partners: 0.4, users: 0.01 }, { scrape: 0.45, exfil: 0.15, partners: 0.02, users: 0.01 }] },
    { id: 'reauth', name: 'Réauthentification avant export', where: 'Export', options: ['Non', 'Oui'], hint: 'Mot de passe ou second facteur redemandé, et e-mail d’alerte au titulaire du compte.',
      effects: [{}, { exfil: 0.75, accountants: 0.05 }] },
    { id: 'exportCap', name: 'Un export complet par jour', where: 'Export', options: ['Non', 'Oui'], hint: 'Limite ce qu’un compte volé emporte en une fois. Un cabinet exporte plusieurs clients à la suite.',
      effects: [{}, { exfil: 0.3, accountants: 0.4 }] },
  ],
  segments: [
    { id: 'scrape', name: 'Aspiration de l’annuaire', kind: 'abuse', weight: 0.6, threshold: 0.6,
      text: 'Un concurrent parcourt tout l’annuaire depuis 400 IP de fournisseurs cloud, avec 300 clés d’API de comptes gratuits créés pour l’occasion.',
      ko: (e) => `${pct(1 - e)} % de l’annuaire est aspiré dans la journée : 400 adresses et 300 clés se partagent la charge.`,
      ok: () => 'L’aspiration devient lente et chère : les clés gratuites s’épuisent, les pages ne s’enchaînent plus.' },
    { id: 'exfil', name: 'Export depuis des comptes volés', kind: 'abuse', weight: 0.4, threshold: 0.6,
      text: 'Des comptes pris par credential stuffing exportent toutes leurs factures en quelques secondes.',
      ko: (e) => `${Math.round((1 - e) * 80)} comptes volés exportent l’historique complet de leurs factures, coordonnées bancaires des clients comprises.`,
      ok: () => 'Les exports depuis des comptes volés butent sur la réauthentification, et les titulaires sont prévenus.' },
    { id: 'partners', name: 'Partenaires ERP', kind: 'legit', weight: 0.35, threshold: 0.1,
      text: 'Des synchronisations nocturnes de gros volume, depuis 3 IP fixes, avec des clés de plan payant.',
      ko: (e) => `${pct(e)} % des synchronisations nocturnes échouent : les partenaires ERP ouvrent des incidents.` },
    { id: 'users', name: 'Autocomplétion', kind: 'legit', weight: 0.45, threshold: 0.05,
      text: 'Les utilisateurs qui cherchent un client en tapant son nom.',
      ko: () => 'L’autocomplétion échoue par moments dans l’application.' },
    { id: 'accountants', name: 'Clôtures comptables', kind: 'legit', weight: 0.2, threshold: 0.2,
      text: 'Des cabinets qui exportent l’année entière de leurs clients en janvier.',
      ko: () => 'Les cabinets ne peuvent exporter qu’un client par jour en pleine clôture annuelle.' },
  ],
  debrief: 'L’aspiration distribuée ne se voit pas par adresse : c’est sa matière première — les clés gratuites, la pagination — qu’il faut rendre chère. La limite par IP, elle, tombe sur les seuls clients qui concentrent leur trafic sur peu d’adresses : les partenaires. Même logique pour la détection de bots, utile à condition d’exempter les clés partenaires déclarées. L’export se protège au moment de l’export, par une réauthentification et une alerte au titulaire ; le plafond quotidien gêne les cabinets en pleine clôture plus qu’il ne gêne les voleurs.',
  realCase: 'Facebook, avril 2021 : des données de plus de 530 millions d’utilisateurs (numéros de téléphone, dates de naissance) publiées en ligne. Selon Facebook, elles avaient été aspirées avant septembre 2019 par l’importateur de contacts, qui permettait de téléverser de grands volumes de numéros pour voir lesquels correspondaient à un compte.',
};

// ── N3 · Essais gratuits et cartes testées ──────────────────────────────────

const essaisCartes: AbuseScenario = {
  id: 'essais-cartes',
  level: 3,
  title: 'Essais gratuits et cartes testées',
  context: 'L’essai gratuit de 14 jours demande une carte, vérifiée par une autorisation de 0 € chez le prestataire de paiement. Depuis une semaine, le taux de refus explose : quelqu’un teste des numéros de cartes volées à travers le formulaire, et le prestataire menace de suspendre le compte marchand. En parallèle, des habitués enchaînent les essais gratuits sous de nouvelles adresses.',
  controls: [
    { id: 'perSession', name: 'Tentatives par session', where: 'Formulaire de carte', options: ['Aucune', '5 / heure', '2 / heure'], hint: 'Les testeurs ouvrent une nouvelle session toutes les deux cartes. Un client qui s’est trompé réessaie dans la même.',
      effects: [{}, { cardtest: 0.15, typos: 0.02 }, { cardtest: 0.25, typos: 0.35 }] },
    { id: 'perIp', name: 'Limite par IP', where: 'Formulaire de carte', options: ['Aucune', '10 / heure'], hint: 'Les proxys résidentiels donnent une adresse par tentative, ou presque.',
      effects: [{}, { cardtest: 0.1, newcust: 0.01 }] },
    { id: 'turnstile', name: 'Turnstile', where: 'Formulaire de carte', options: ['Non', 'Oui'], hint: 'Renchérit chaque tentative automatisée ; les services de résolution existent, à un coût.',
      effects: [{}, { cardtest: 0.55, trials: 0.05, newcust: 0.02 }] },
    { id: 'radar', name: 'Règles du prestataire', where: 'Autorisation', options: ['Désactivées', 'Bloquer le risque élevé', 'Bloquer risque élevé et moyen'], hint: 'Le score de risque du prestataire voit les cartes testées ailleurs sur son réseau. Le seuil moyen attrape aussi des clients.',
      effects: [{}, { cardtest: 0.6, trials: 0.05, newcust: 0.01, typos: 0.01 }, { cardtest: 0.8, trials: 0.1, newcust: 0.09, typos: 0.12 }] },
    { id: 'fingerprint', name: 'Un essai par carte', where: 'Inscription', options: ['Non', 'Oui'], hint: 'L’empreinte de carte fournie par le prestataire — pas le numéro — sert de clé d’unicité de l’essai.',
      effects: [{}, { trials: 0.75, newcust: 0.01 }] },
    { id: 'threeDS', name: '3-D Secure', where: 'Enregistrement de la carte', options: ['Non', 'Oui'], hint: 'Le porteur valide auprès de sa banque. Un testeur n’a pas le téléphone du porteur ; un vrai client l’a, s’il ne lâche pas en route.',
      effects: [{}, { cardtest: 0.85, trials: 0.1, newcust: 0.09, typos: 0.03 }] },
    { id: 'noTrial', name: 'Supprimer l’essai gratuit', where: 'Offre', options: ['Non', 'Oui'], hint: 'Plus d’essai, plus d’abus d’essai. Et beaucoup moins d’inscriptions.',
      effects: [{}, { trials: 1, cardtest: 0.2, newcust: 0.6 }] },
  ],
  segments: [
    { id: 'cardtest', name: 'Test de cartes volées', kind: 'abuse', weight: 0.65, threshold: 0.7,
      text: 'Des milliers d’autorisations à 0 €, depuis des proxys résidentiels ; chaque session n’essaie que deux cartes.',
      ko: (e) => `${Math.round((1 - e) * 5000)} cartes volées sont validées à travers le formulaire ; le taux de refus reste au-dessus du seuil que tolère le prestataire.`,
      ok: () => 'Le taux de refus retombe : le formulaire ne sert plus de banc d’essai.' },
    { id: 'trials', name: 'Essais en série', kind: 'abuse', weight: 0.35, threshold: 0.6,
      text: 'Une nouvelle adresse e-mail tous les 14 jours, mais la même carte et le même navigateur.',
      ko: () => 'Les habitués de l’essai gratuit en sont à leur sixième essai consécutif.',
      ok: () => 'Les essais en série butent sur la carte déjà utilisée.' },
    { id: 'newcust', name: 'Nouveaux clients', kind: 'legit', weight: 0.75, threshold: 0.15,
      text: 'Des PME qui démarrent un essai ; beaucoup abandonnent à la moindre friction.',
      ko: (e) => `${pct(e)} % des nouveaux clients abandonnent avant la fin de l’inscription.` },
    { id: 'typos', name: 'Cartes refusées de bonne foi', kind: 'legit', weight: 0.25, threshold: 0.2,
      text: 'Un chiffre inversé, une date d’expiration fausse : on réessaie deux ou trois fois.',
      ko: () => 'Des clients qui s’étaient trompés d’un chiffre sont bloqués pour l’heure et partent.' },
  ],
  debrief: 'Aucun contrôle ne suffit seul, et les limites de volume sont presque aveugles : une session toutes les deux cartes, une adresse par tentative. Ce qui porte, c’est ce que le testeur n’a pas : la banque du porteur (3-D Secure), un réseau qui a déjà vu ses cartes (le score du prestataire au seuil élevé), un coût par tentative (Turnstile). Les essais en série se reconnaissent à la carte, pas à l’adresse. Supprimer l’essai gratuit « règle » l’abus d’essai en perdant plus de clients qu’il n’en protège, et laisse le test de cartes continuer sur le paiement.',
};

// ── N3 · SMS pumping ────────────────────────────────────────────────────────

const smsPumping: AbuseScenario = {
  id: 'sms-pumping',
  level: 3,
  title: 'SMS pumping',
  context: 'Novafact envoie un code par SMS pour vérifier le numéro à l’inscription et pour la double authentification. Ses clients sont en France, en Belgique, en Suisse, au Luxembourg, au Maroc et en Tunisie. La facture SMS du mois a triplé, sans hausse des inscriptions.',
  controls: [
    { id: 'geo', name: 'Pays autorisés', where: 'Envoi de SMS', options: ['Tous', 'Pays des clients', 'France seule'], hint: 'Les plages surtaxées sont rarement dans les pays où vivent les clients. Rarement, pas jamais.',
      effects: [{}, { pumping: 0.7 }, { pumping: 0.8, abroad: 0.95 }] },
    { id: 'perNumber', name: 'Codes par numéro', where: 'Envoi de SMS', options: ['Aucune', '3 / heure', '1 / heure'], hint: 'Arrête le harcèlement d’un numéro. Les pompeurs, eux, changent de numéro à chaque envoi dans une plage de milliers.',
      effects: [{}, { bombing: 0.9, pumping: 0.05, slow: 0.02 }, { bombing: 0.95, pumping: 0.07, slow: 0.4 }] },
    { id: 'range', name: 'Surveillance des plages', where: 'Envoi de SMS', options: ['Non', 'Oui'], hint: 'Codes envoyés contre codes saisis, par préfixe : une plage qui reçoit cent codes et n’en valide aucun est suspendue.',
      effects: [{}, { pumping: 0.65, abroad: 0.02 }] },
    { id: 'turnstile', name: 'Turnstile', where: 'Avant tout envoi', options: ['Non', 'Oui'], hint: 'Un défi coûte peu face au revenu d’un SMS surtaxé, mais il écarte les bots les moins chers.',
      effects: [{}, { pumping: 0.4, bombing: 0.5, fr: 0.02, abroad: 0.02 }] },
    { id: 'breaker', name: 'Coupe-circuit de dépense', where: 'Fournisseur SMS', options: ['Non', 'Oui'], hint: 'Au-delà de trois fois la dépense horaire habituelle, les envois hors de France sont suspendus et l’équipe alertée.',
      effects: [{}, { pumping: 0.35, abroad: 0.1 }] },
    { id: 'noSms', name: 'Supprimer le SMS', where: 'Inscription et double authentification', options: ['Non', 'Oui'], hint: 'Plus de SMS, plus de pumping. Reste à vérifier les numéros autrement, et à offrir un second facteur à ceux qui n’ont pas d’application.',
      effects: [{}, { pumping: 1, bombing: 1, fr: 0.35, abroad: 0.35, slow: 0.35 }] },
  ],
  segments: [
    { id: 'pumping', name: 'SMS pumping', kind: 'abuse', weight: 0.75, threshold: 0.7,
      text: 'Des bots lancent des inscriptions vers des plages de numéros surtaxés, gérées avec un opérateur complice qui reverse une part de chaque SMS. La plupart des plages sont hors de la zone des clients ; certaines sont dedans.',
      ko: (e) => `La facture SMS reste ${e < 0.3 ? 'au triple' : 'au double'} de la normale : ${pct(1 - e)} % du trafic surtaxé passe encore.`,
      ok: () => 'La dépense SMS revient près de la normale : les plages surtaxées ne reçoivent presque plus rien.' },
    { id: 'bombing', name: 'Harcèlement par SMS', kind: 'abuse', weight: 0.25, threshold: 0.7,
      text: 'Le bouton « Renvoyer le code » sert à inonder de SMS le téléphone d’une personne.',
      ko: () => 'Une personne harcelée reçoit des centaines de codes Novafact dans la journée, et le signale publiquement.',
      ok: () => 'Le renvoi de code ne permet plus d’inonder un téléphone.' },
    { id: 'fr', name: 'Clients en France', kind: 'legit', weight: 0.7, threshold: 0.05,
      text: 'Inscriptions et double authentification.',
      ko: (e) => `${pct(e)} % des clients en France ne reçoivent plus de code ou renoncent au second facteur.` },
    { id: 'abroad', name: 'Clients hors de France', kind: 'legit', weight: 0.15, threshold: 0.2,
      text: 'Belgique, Suisse, Luxembourg, Maroc, Tunisie.',
      ko: (e) => `${pct(e)} % des clients hors de France ne peuvent plus recevoir leur code.` },
    { id: 'slow', name: 'Codes en retard', kind: 'legit', weight: 0.15, threshold: 0.2,
      text: 'Des SMS qui arrivent après 30 secondes : on redemande un code, parfois trois fois.',
      ko: () => 'Des utilisateurs dont le premier SMS tarde ne peuvent plus en redemander et restent bloqués.' },
  ],
  debrief: 'Le pompage se joue sur des milliers de numéros différents : la limite par numéro, parfaite contre le harcèlement, ne l’effleure pas. Ce qui porte, c’est ce que le fraudeur ne contrôle pas : la géographie (restreindre aux pays des clients, pas à la France seule, qui coupe les clients belges et marocains), le taux de conversion par plage, le coût d’un défi, et un plafond de dépense qui borne la perte quand le reste échoue. Supprimer le SMS « règle » tout en retirant à un tiers des clients leur moyen de connexion ou de second facteur.',
  realCase: 'Twitter, février 2023 : Elon Musk a affirmé que l’entreprise perdait 60 millions de dollars par an en SMS de double authentification artificiellement gonflés, et que 390 opérateurs y participaient. Twitter a ensuite réservé la double authentification par SMS à ses abonnés payants, à partir du 20 mars 2023.',
};

// ── Le pool et les séries ───────────────────────────────────────────────────

export const abuseScenarios: AbuseScenario[] = [connexion, inscription, journee, reinitialisation, scraping, essaisCartes, smsPumping];

const PROFILES: SeriesProfile<AbuseScenario>[] = [
  { id: 'connexion', title: 'La connexion', ids: ['connexion'],
    text: 'Deux attaques depuis une poignée d’adresses, trois réglages. Chaque abus a son contrôle ; le seul piège est le verrouillage de compte.' },
  { id: 'inscription', title: 'L’inscription', ids: ['inscription'],
    text: 'Des comptes créés en masse pour envoyer de fausses factures. Un défi, une liste de domaines jetables, et un refus des webmails qui coûte cher.' },
  { id: 'journee', title: 'Une journée ordinaire', ids: ['journee'],
    text: 'Stuffing, attaque ciblée et fraude à la facture en même temps. La limite par IP ne voit pas le botnet et bloque un cabinet entier.' },
  { id: 'reinitialisation', title: 'Le mot de passe oublié', ids: ['reinitialisation'],
    text: 'Énumération et bombardement d’e-mails. Le message n’est qu’un des trois canaux qui trahissent un compte.' },
  { id: 'scraping', title: 'L’API publique', ids: ['scraping'],
    text: 'Un annuaire aspiré depuis 400 adresses et des exports depuis des comptes volés. Les partenaires ressemblent aux bots.' },
  { id: 'essais-cartes', title: 'Essais gratuits et cartes testées', ids: ['essais-cartes'],
    text: 'Aucun contrôle ne suffit seul, les limites de volume sont aveugles, et supprimer l’essai gratuit est le piège.' },
  { id: 'sms-pumping', title: 'SMS pumping', ids: ['sms-pumping'],
    text: 'Une facture SMS triplée. Des contrôles partiels à empiler, une géographie à doser, et le SMS à ne pas supprimer.' },
];

export const abuseSeries = defineSeries(abuseScenarios, PROFILES);

// ── Simulation ──────────────────────────────────────────────────────────────

export type DayResult = { effect: Record<string, number>; blocked: number; harmed: number; score: number };

export const initialConfigOf = (s: AbuseScenario): Config => Object.fromEntries(s.controls.map((c) => [c.id, 0]));

export function simulate(cfg: Config, s: AbuseScenario = journee): DayResult {
  const effect: Record<string, number> = {};
  for (const seg of s.segments) {
    let pass = 1;
    for (const c of s.controls) pass *= 1 - (c.effects[cfg[c.id] ?? 0][seg.id] ?? 0);
    effect[seg.id] = 1 - pass;
  }
  const blocked = s.segments.filter((g) => g.kind === 'abuse').reduce((a, g) => a + g.weight * effect[g.id], 0);
  const harmed = s.segments.filter((g) => g.kind === 'legit').reduce((a, g) => a + g.weight * effect[g.id], 0);
  return { effect, blocked, harmed, score: blocked * 60 + (1 - harmed) * 40 };
}

/** Score sans aucune défense : tous les clients épargnés, aucun abus bloqué. */
export const baselineOf = (s: AbuseScenario) => simulate(initialConfigOf(s), s).score;

const bestCache = new Map<string, { score: number; cfg: Config }>();

/** Meilleur score atteignable et réglage correspondant, par parcours de toutes les configurations. */
export function bestOf(s: AbuseScenario): { score: number; cfg: Config } {
  const hit = bestCache.get(s.id);
  if (hit) return hit;
  let best = { score: -1, cfg: initialConfigOf(s) };
  const walk = (k: number, cfg: Config) => {
    if (k === s.controls.length) {
      const score = simulate(cfg, s).score;
      if (score > best.score + 1e-9) best = { score, cfg };
      return;
    }
    const c = s.controls[k];
    for (let o = 0; o < c.options.length; o++) walk(k + 1, { ...cfg, [c.id]: o });
  };
  walk(0, initialConfigOf(s));
  bestCache.set(s.id, best);
  return best;
}

/** 0 % = ne rien faire, 100 % = meilleur réglage possible. */
export const pctOf = (s: AbuseScenario, r: DayResult) => {
  const base = baselineOf(s);
  return Math.max(0, Math.round(((r.score - base) / (bestOf(s).score - base)) * 100));
};

/** Un segment est-il en échec ? */
export const failing = (seg: Segment, e: number) => (seg.kind === 'abuse' ? e < seg.threshold : e >= seg.threshold);

// Messages du journal de la journée, selon les résultats.
export function dayLog(cfg: Config, r: DayResult, s: AbuseScenario = journee): LogLine[] {
  const log: LogLine[] = [];
  for (const seg of s.segments) {
    const e = r.effect[seg.id];
    if (failing(seg, e)) log.push({ good: false, text: seg.ko(e) });
    else if (seg.ok) log.push({ good: true, text: seg.ok(e) });
  }
  return [...log, ...(s.extraLog?.(cfg, r.effect) ?? [])];
}

// Compatibilité : la journée historique du jeu.
export const controls = journee.controls;
export const segments = journee.segments;
export const initialConfig: Config = initialConfigOf(journee);
export const baselineScore = baselineOf(journee);
export const bestScore = bestOf(journee).score;

// m20 · Capstone — challenges spécifiés.
//
// Le capstone n'est pas une somme d'exercices : c'est la revue de sécurité
// complète de Novafact, en douze étapes, dont chacune réutilise les livrables
// des précédentes. Ce qui le rend vérifiable, c'est justement le chaînage — un
// threat model qui ignore une route découverte à l'étape 1 est incohérent, et
// le harnais le voit.

import { P } from './helper.ts';
import type { ExerciseDef } from '../exercises.ts';

export const m20: ExerciseDef[] = [
  P('capstone-requirements', 'm20', 'Étape 1 · Exigences et traçabilité', 3, 'artifact', 'CWE-1059', ['D3'],
    'Novafact part en revue complète. Rien n’est écrit de ce qu’elle doit tenir.',
    'Produire le sous-ensemble ASVS L2, la classification des données, et la matrice qui relie chaque exigence à sa preuve.',
    'capstone/01-requirements/', ['m20/l03', 'm07/l02'],
    'Reprend les livrables de M12 et les consolide. Le harnais vérifie la cohérence interne : toute donnée classée sensible doit être couverte par au moins une exigence, et toute exigence doit avoir un test qui passe.'),

  P('capstone-design-review', 'm20', 'Étape 2 · Design doc et revue de conception', 3, 'artifact', 'CWE-1059', ['D4'],
    'Une nouvelle fonctionnalité — l’export comptable multi-tenant — arrive en conception. C’est le moment le moins cher pour la corriger.',
    'Écrire le design doc, mener la revue selon les six étapes, et classer les constats en Must / Ought / Should.',
    'capstone/02-design/', ['m20/l04', 'm08/l10', 'm08/l09'],
    'Le harnais vérifie la présence des rubriques du gabarit, que chaque constat cite un élément du design, et que les positions divergentes sont documentées. Le designer a le dernier mot : ce qui compte est que le désaccord soit tracé, pas qu’il soit gagné.', [6, 7]),

  P('capstone-threat-model', 'm20', 'Étape 3 · Threat model', 3, 'artifact', 'CWE-1059', ['D4'],
    'La conception est arrêtée. Reste à savoir ce qui peut mal tourner.',
    'Produire le modèle de menaces complet de Novafact, avec les frontières de confiance et une mitigation par menace retenue.',
    'capstone/03-threats/', ['m20/l02', 'm11/l01'],
    'Le harnais exige la cohérence avec l’étape 1 — tout actif classé sensible apparaît dans le modèle — et avec le code : chaque route réellement montée est couverte par un élément du schéma. Un modèle qui ignore la moitié de l’application est un modèle qui rassure.', [2]),

  P('capstone-code-review', 'm20', 'Étape 4 · Revue de PR, règles et tests', 3, 'artifact', 'CWE-1059', ['D5', 'D6'],
    'Une pull request sensible attend. Et le même défaut existe probablement ailleurs.',
    'Rendre la revue, écrire la règle qui trouve toutes les variantes, et le test de régression qui les ferme.',
    'capstone/04-review/', ['m20/l06', 'm12/l03'],
    'Trois livrables qui se tiennent : le constat localisé, la règle notée contre des jeux valides et invalides, et le test en double passage. C’est la boucle complète — trouver, généraliser, empêcher le retour.'),

  P('capstone-payment-page', 'm20', 'Étape 5 · Page de paiement', 3, 'artifact', 'CWE-1021', ['D4', 'D7'],
    'La page de paiement embarque l’iframe du prestataire, un tag manager et un widget de chat. Le périmètre PCI est censé être réduit.',
    'Inventorier les scripts, écrire la CSP stricte, et satisfaire les exigences d’inventaire et de détection de modification.',
    'capstone/05-payment/', ['m20/l08', 'm04/l08'],
    'Le harnais vérifie que chaque script chargé figure à l’inventaire avec son propriétaire et son empreinte, que la CSP bloque les charges utiles connues sans casser le paiement, et qu’une modification de script lève une alerte. Exigences 6.4.3 et 11.6.1.'),

  P('capstone-anti-abuse', 'm20', 'Étape 6 · Contrôles anti-abus', 3, 'artifact', 'CWE-1059', ['D4', 'D5'],
    'L’inscription, la connexion et l’envoi de factures sont ouverts. Un concurrent scrape, un fraudeur teste des identifiants, un spammeur envoie.',
    'Poser les contrôles sur les trois parcours, et mesurer ce qu’ils bloquent et ce qu’ils gênent.',
    'capstone/06-abuse/', ['m20/l05', 'm10/l03'],
    'Le harnais rejoue un flux mêlant clients légitimes, bots et fraudeurs : le score combine abus bloqués et clients gênés. Un contrôle qui bloque tout gagne sur la première moitié et perd sur la seconde — c’est l’arbitrage réel du métier.'),

  P('capstone-pipeline', 'm20', 'Étape 7 · Pipeline et supply chain', 3, 'artifact', 'CWE-1059', ['D7', 'D8'],
    'Le pipeline publie un SDK npm et déploie en production, avec des permissions larges et des actions non épinglées.',
    'Durcir les workflows, la publication et les dépendances, et produire le SBOM qui répondra le jour de l’incident.',
    'capstone/07-pipeline/', ['m20/l09', 'm14/l01'],
    'Le harnais rejoue les scénarios d’attaque du module : injection de template, pwn request, action repointée, paquet inventé. Chacun doit échouer, et la CI doit continuer de passer sur une contribution légitime.'),

  P('capstone-iam', 'm20', 'Étape 8 · IAM au moindre privilège', 3, 'artifact', 'CWE-732', ['D1', 'D7'],
    'Les rôles ont été écrits pendant la mise en production, au plus large, et jamais relus.',
    'Réécrire les politiques à partir de l’usage réel, et poser le périmètre de données qui rattrape ce qu’elles laissent passer.',
    'capstone/08-iam/', ['m20/l10', 'm15/l05'],
    'Le harnais vérifie qu’aucune action d’escalade ne subsiste, que chaque politique d’approbation est filtrée, et que l’application continue de fonctionner — une politique trop stricte casse la production aussi sûrement qu’une trop large la met en danger.'),

  P('capstone-advanced-fixes', 'm20', 'Étape 9 · Vulnérabilités avancées', 3, 'fix', 'CWE-1059', ['D5'],
    'Les défauts avancés du module M9 sont toujours là : course, cache, analyseurs divergents, jetons.',
    'Les corriger tous, et faire passer au vert la suite de régression complète.',
    'capstone/09-fixes/', ['m20/l07', 'm03/l04'],
    'C’est la seule étape purement corrective, et elle est volontairement placée après la conception : on corrige plus vite quand on sait ce qu’on protège. La suite exige, comme toujours, que l’attaque échoue et que la fonctionnalité survive.'),

  P('capstone-detections', 'm20', 'Étape 10 · Cinq détections testées', 3, 'artifact', 'CWE-1059', ['D7'],
    'L’application est durcie. Rien ne dit ce qui se passera quand quelqu’un essaiera quand même.',
    'Écrire cinq détections couvrant les attaques du capstone, avec leurs fixtures et leur recette de validation.',
    'capstone/10-detections/', ['m20/l11', 'm28/l03'],
    'Chaque règle est accompagnée de son atomique : avant détonation elle se tait, après elle lève, après retour arrière elle se tait de nouveau. Précision et rappel mesurés sur le corpus. Cinq règles testées valent mieux que cinquante importées.'),

  P('capstone-roadmap', 'm20', 'Étape 11 · Roadmap à 12 mois', 3, 'artifact', 'CWE-1059', ['D2'],
    'La revue a produit soixante constats. L’équipe a quatre personnes et un an.',
    'Produire l’évaluation de maturité et la feuille de route qui referme les écarts, trimestre par trimestre.',
    'capstone/11-roadmap/', ['m20/l14', 'm24/l02'],
    'Le harnais vérifie la cohérence avec l’évaluation et avec les constats des étapes précédentes : toute classe de bugs trouvée doit être adressée par une activité du plan. Un plan qui ignore ce que la revue vient de trouver n’est pas un plan.'),

  P('capstone-adoption', 'm20', 'Étape 12 · Adoption et restitution', 3, 'artifact', 'CWE-1059', ['D2'],
    'Tout est écrit. Rien ne sera appliqué si l’équipe et la direction ne suivent pas.',
    'Produire le plan d’adoption — champions, formation, SLA, portes de contrôle — et la restitution en une page.',
    'capstone/12-adoption/', ['m20/l15', 'm06/l05'],
    'Le harnais vérifie ce qui est vérifiable : les portes existent dans la CI, les SLA sont mesurables, les chemins sensibles sont routés vers les bonnes personnes. La restitution elle-même n’est pas notée — savoir parler à une direction ne s’automatise pas, et c’est le jeu Pushback qui l’entraîne.'),
];

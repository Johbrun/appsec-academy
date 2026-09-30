// M14 · Pipeline, supply chain & fournisseurs — challenges spécifiés.
//
// Presque tous sont des exercices « fix » : le défaut vit dans un fichier du
// dépôt (workflow, .npmrc, lockfile, package.json), pas dans une requête HTTP.
// C'est aussi là que la plupart des incidents réels ont commencé.

import { P } from './helper.ts';
import type { ExerciseDef } from '../exercises.ts';

export const m14: ExerciseDef[] = [
  P('supply-chain-response', 'm14', 'Répondre à un incident supply chain', 3, 'fix', 'CWE-1395', ['D7', 'D8'],
    'Un avis annonce qu’une version d’une dépendance directe a été compromise pendant six heures. Le dépôt contient le lockfile, le SBOM et les journaux de CI de cette période.',
    'Produire la réponse : versions réellement installées, secrets à tourner, runners à nettoyer, et la requête qui chasse les indicateurs de compromission.',
    'incident/', ['m14/l10', 'm05/l07'],
    'Le SBOM sert enfin à quelque chose : il répond en minutes à « sommes-nous touchés ». Le reste est un ordre de priorité — rotation des secrets d’abord (ils sont peut-être déjà partis), puis nettoyage des runners, puis correctif. Playbook Shai-Hulud.'),

  P('vendor-requirements', 'm14', 'Exigences de sécurité envers un fournisseur', 2, 'fix', 'CWE-1059', ['D3', 'D8'],
    'L’intégration du prestataire de paiement et celle du fournisseur d’IA n’ont aucune exigence écrite : ni notification d’incident, ni journalisation vers le SIEM, ni résidence des données.',
    'Écrire les exigences vérifiables de chaque fournisseur et les rattacher aux contrôles techniques qui les constatent.',
    'vendors/', ['m14/l08', 'm07/l07'],
    'Une exigence fournisseur ne vaut que si elle est vérifiable : « notification sous 72 h » se teste par un exercice, « logs vers le SIEM » se constate par une ingestion. Le reste relève du contrat (droit d’audit, séquestre, responsabilité). NIST SP 800-161r1, ISO/IEC 27036, CSA CAIQ.'),
];

// M16 · Infrastructure as Code — challenges spécifiés.
//
// Tout se joue sur des fichiers : Terraform, CDK en TypeScript, et le template
// CloudFormation produit par `cdk synth` — qui se génère hors ligne, sans
// compte AWS. C'est ce qui rend le module entièrement praticable en local.

import { P } from './helper.ts';
import type { ExerciseDef } from '../exercises.ts';

export const m16: ExerciseDef[] = [
  P('iac-drift', 'm16', 'La dérive entre le code et le réel', 3, 'artifact', 'CWE-1059', ['D7'],
    'Un correctif d’urgence a été appliqué à la main en production. Le code décrit une infrastructure qui n’existe plus.',
    'Détecter l’écart à partir de l’état réel fourni, dire ce qui a dérivé, et décider pour chaque écart : ramener au code, ou reprendre dans le code.',
    'scripts/drift.mjs', ['m16/l05', 'm17/l08'],
    'Le harnais fournit l’état réel et connaît les écarts. La dérive est inévitable ; ce qui distingue une équipe, c’est de la voir en jours plutôt qu’en trimestres. Le préventif — les politiques qui refusent — ne remplace pas le détectif.'),
];

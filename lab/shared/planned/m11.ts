// m11 · Threat modeling & MITRE — challenges spécifiés.
//
// Formats vérifiés en exécution réelle (pytm 1.4.0 lancé, Threagile lancé en
// conteneur sans réseau, schémas lus dans les dépôts) :
//   · pytm — pur Python, hors ligne, sortie **identique au bit près** d'une
//     exécution à l'autre. C'est le meilleur oracle du domaine : le modèle de
//     l'apprenant passe dans le moteur de règles et produit une liste de
//     menaces déterministe.
//   · Threagile — conteneur hors ligne, l'**ensemble** des risques est stable
//     mais leur **ordre** ne l'est pas : comparer des ensembles, jamais des
//     listes, sinon le test sera instable.
//   · Deciduous — format YAML confirmé.
//   · Threat Composer et Threat Dragon n'offrent qu'une validation de
//     structure, pas de recalcul : pas d'oracle, donc pas d'exercice noté.
//   · threatspec est abandonné depuis 2020 : à écarter.
//
// Limite à dire dans l'énoncé : tout ce qui suit mesure la complétude
// structurelle et la cohérence avec le code. La PERSPICACITÉ d'un modèle — a-t-on
// vu la bonne menace ? — reste hors de portée. Passer le test ne veut pas dire
// « bon modèle », et l'apprenant doit le savoir.

import type { ExerciseDef } from '../exercises.ts';

export const m11: ExerciseDef[] = [];

// Livrable de référence — challenge paved-road-template (M1).
//
// Le gabarit dont toute nouvelle route de Novafact part. Il n'est pas « une
// route bien écrite » : c'est le chemin par défaut. Tout ce qui compte y est
// fait une fois, au même endroit, de sorte que la route suivante ne puisse pas
// l'oublier — c'est la seule différence entre une bonne pratique et un paved
// road.
//
// Les cinq refus que le gabarit porte, et qu'aucune route dérivée n'aura à
// réécrire :
//
//   1. pas de principal → 401. L'authentification n'est pas « à la charge de
//      chaque route », elle est dans le routeur.
//   2. cloisonnement par tenant appliqué à la lecture comme à la liste, et
//      réponse 404 plutôt que 403 : on ne confirme pas l'existence d'une
//      ressource qu'on n'a pas le droit de voir.
//   3. le corps entrant n'est jamais fusionné. L'enregistrement est CONSTRUIT
//      champ par champ depuis la liste blanche déclarée — ce qui règle d'un
//      coup le hors-schéma, le mass assignment et les clés de prototype.
//   4. `tenantId` vient du principal, jamais du corps.
//   5. le type de chaque champ est vérifié avant écriture.
//
// Et un sixième point, qui n'est pas un refus : l'appel légitime doit marcher.
// Un gabarit qui refuse tout ne sera repris par personne, et la route suivante
// repartira de zéro.

import { Router, type NextFunction, type Request, type Response } from 'express';

export type TypeChamp = 'string' | 'number' | 'boolean';

export interface OptionsRessource {
  /** Nom de la ressource, pour les messages et l'identifiant généré. */
  nom: string;
  /** Liste blanche des champs acceptés à l'écriture, et leur type. */
  champs: Record<string, TypeChamp>;
  /** Les enregistrements. Chacun porte au moins `id` et `tenantId`. */
  magasin: Record<string, unknown>[];
}

/** Le principal que l'intergiciel d'authentification a posé sur la requête. */
interface Principal { tenantId: string; role: string; email: string }

const principalDe = (req: Request): Principal | undefined =>
  (req as Request & { user?: Principal }).user;

/** Aucune route dérivée ne décide elle-même si l'appelant est authentifié. */
function exigeUnPrincipal(req: Request, res: Response, next: NextFunction): void {
  if (!principalDe(req)) {
    res.status(401).json({ erreur: 'authentification requise' });
    return;
  }
  next();
}

/**
 * Construit l'enregistrement à partir des seuls champs déclarés.
 *
 * C'est ici que tout se joue. On ne part pas du corps pour en retirer ce qui
 * gêne — on part du schéma pour n'y prendre que ce qui est prévu. Une clé
 * `__proto__`, un `tenantId`, un `role` glissés dans le corps ne sont pas
 * « filtrés » : ils ne sont jamais lus.
 */
function construire(
  champs: Record<string, TypeChamp>,
  corps: unknown,
): { valeurs: Record<string, unknown> } | { erreur: string } {
  if (corps === null || typeof corps !== 'object' || Array.isArray(corps)) {
    return { erreur: 'le corps de la requête doit être un objet' };
  }
  const source = corps as Record<string, unknown>;
  const valeurs: Record<string, unknown> = Object.create(null);

  for (const [nom, type] of Object.entries(champs)) {
    // hasOwn : une valeur héritée du prototype n'est pas une valeur fournie.
    const valeur = Object.hasOwn(source, nom) ? source[nom] : undefined;
    if (valeur === undefined) return { erreur: `le champ « ${nom} » est requis` };
    if (typeof valeur !== type) return { erreur: `le champ « ${nom} » doit être de type ${type}` };
    valeurs[nom] = valeur;
  }
  return { valeurs };
}

export function createResourceRouter(options: OptionsRessource): Router {
  const { nom, champs, magasin } = options;
  const routeur = Router();

  routeur.use(exigeUnPrincipal);

  // Le cloisonnement est posé une fois, au niveau du routeur : les trois routes
  // ci-dessous ne peuvent plus lire le magasin autrement.
  const aMoi = (req: Request) =>
    magasin.filter((e) => e.tenantId === principalDe(req)!.tenantId);

  routeur.get('/', (req, res) => {
    res.json(aMoi(req));
  });

  routeur.post('/', (req, res) => {
    const construit = construire(champs, req.body);
    if ('erreur' in construit) {
      res.status(400).json({ erreur: construit.erreur });
      return;
    }

    const enregistrement: Record<string, unknown> = {
      id: `${nom.toUpperCase()}-${magasin.length + 1}`,
      // Jamais depuis le corps : l'appartenance vient du jeton, point.
      tenantId: principalDe(req)!.tenantId,
      ...construit.valeurs,
    };
    magasin.push(enregistrement);
    res.status(201).json(enregistrement);
  });

  routeur.get('/:id', (req, res) => {
    const enregistrement = aMoi(req).find((e) => e.id === req.params.id);
    if (!enregistrement) {
      // 404 et non 403 : la réponse ne dit pas si la ressource existe ailleurs.
      res.status(404).json({ erreur: `${nom} introuvable` });
      return;
    }
    res.json(enregistrement);
  });

  return routeur;
}

export default createResourceRouter;

// Livrable de référence du challenge « eslint-rule ».
//
// Interdit de faire entrer le corps ENTIER de la requête dans un objet : c'est
// la classe du mass assignment, pas son instance. Corriger une route ne protège
// pas la suivante ; une règle, si.
//
// Format ESLint : { meta, create(context) }. Le visiteur est purement
// syntaxique — aucune analyse de portée n'est nécessaire.

export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'interdit d’étaler ou d’affecter le corps entier de la requête dans un objet (mass assignment)',
      recommended: true,
    },
    schema: [],
    messages: {
      corpsEntier:
        'Le corps entier de la requête entre dans cet objet : construis explicitement la liste des champs autorisés.',
    },
  },

  create(context) {
    /** `req`, `request`, ou `ctx.request`. */
    const estObjetRequete = (node) => {
      if (!node) return false;
      if (node.type === 'Identifier') return node.name === 'req' || node.name === 'request';
      return (
        node.type === 'MemberExpression' &&
        !node.computed &&
        node.object.type === 'Identifier' &&
        node.object.name === 'ctx' &&
        node.property.type === 'Identifier' &&
        node.property.name === 'request'
      );
    };

    /** Le nom de la propriété lue, que la notation soit pointée ou entre crochets. */
    const nomPropriete = (node) => {
      if (!node.computed) return node.property.type === 'Identifier' ? node.property.name : null;
      return node.property.type === 'Literal' && typeof node.property.value === 'string'
        ? node.property.value
        : null;
    };

    const estCorpsEntier = (node) =>
      Boolean(node) &&
      node.type === 'MemberExpression' &&
      nomPropriete(node) === 'body' &&
      estObjetRequete(node.object);

    const signaler = (node) => context.report({ node, messageId: 'corpsEntier' });

    return {
      // `{ ...req.body }`. La déstructuration (`const { a, ...reste } = req.body`)
      // passe par RestElement : elle n'est pas concernée.
      SpreadElement(node) {
        if (node.parent?.type !== 'ObjectExpression') return;
        if (estCorpsEntier(node.argument)) signaler(node);
      },

      // `Object.assign(cible, …, req.body, …)` — à partir du deuxième argument.
      CallExpression(node) {
        const callee = node.callee;
        if (callee.type !== 'MemberExpression' || callee.computed) return;
        if (callee.object.type !== 'Identifier' || callee.object.name !== 'Object') return;
        if (callee.property.type !== 'Identifier' || callee.property.name !== 'assign') return;
        for (const argument of node.arguments.slice(1)) {
          if (estCorpsEntier(argument)) signaler(argument);
        }
      },
    };
  },
};

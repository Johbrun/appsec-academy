'use strict';

// nova-validate — valide les références saisies dans les formulaires Novafact.

/** Une référence est une suite de groupes alphanumériques séparés par des tirets. */
const REFERENCE = /^([A-Za-z0-9]+-?)+$/;

/** Un identifiant de tenant : lettres minuscules, trois à vingt caractères. */
const TENANT = /^[a-z]{3,20}$/;

function isReference(value) {
  if (typeof value !== 'string') return false;
  return REFERENCE.test(value);
}

function isTenant(value) {
  return typeof value === 'string' && TENANT.test(value);
}

/** Normalise une référence avant comparaison. */
function normalize(value) {
  return String(value).trim().toUpperCase().replace(/\s+/g, '');
}

module.exports = { isReference, isTenant, normalize };

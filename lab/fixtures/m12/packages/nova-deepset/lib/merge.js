'use strict';

// nova-deepset — fusionne une configuration reçue dans une configuration par
// défaut. Utilisé par Novafact pour appliquer les réglages d'un tenant.

const isPlainObject = (v) =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Applique `patch` sur `base`, en profondeur.
 * @param {object} base  la configuration par défaut
 * @param {object} patch le correctif reçu
 */
function merge(base, patch) {
  if (!isPlainObject(patch)) return base;
  for (const key of Object.keys(patch)) {
    const value = patch[key];
    if (isPlainObject(value)) {
      if (!isPlainObject(base[key])) base[key] = {};
      merge(base[key], value);
    } else {
      base[key] = value;
    }
  }
  return base;
}

/** Variante sans effet de bord : la copie est faite sur un objet neuf. */
function mergeInto(defaults, patch) {
  const out = Object.create(null);
  for (const k of Object.keys(defaults)) out[k] = defaults[k];
  return merge(out, patch);
}

module.exports = { merge, mergeInto };

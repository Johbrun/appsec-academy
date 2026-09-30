'use strict';

// nova-static — sert les documents d'un dossier. Utilisé par Novafact pour
// les pièces jointes de facture.

const fs = require('node:fs');
const path = require('node:path');

const MIME = { '.txt': 'text/plain', '.pdf': 'application/pdf', '.png': 'image/png' };

/** Décode le nom demandé et retire la barre de tête. */
function requested(url) {
  const raw = decodeURIComponent(String(url || ''));
  return raw.replace(/^\/+/, '');
}

/**
 * Renvoie le contenu du document demandé.
 * @param {string} root le dossier servi
 * @param {string} url  l'URL demandée par le client
 */
function read(root, url) {
  const name = requested(url);
  if (name === '') throw new Error('nom de document vide');
  const file = path.join(root, name);
  if (!fs.existsSync(file)) throw new Error('document introuvable');
  return { body: fs.readFileSync(file), type: MIME[path.extname(file)] || 'application/octet-stream' };
}

/** Liste les documents du dossier servi. Le nom du client n'entre pas ici. */
function list(root) {
  return fs.readdirSync(path.resolve(root)).sort();
}

module.exports = { read, list };

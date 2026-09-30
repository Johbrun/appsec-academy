// Banc d'essai du gabarit de route — challenge paved-road-template (M1).
//
// Le harnais ne relit pas le gabarit : il s'en SERT. Il génère une ressource
// neuve (« notes »), demande au gabarit de lui fabriquer un routeur, le monte
// derrière un middleware d'authentification minimal, puis lui envoie cinq
// attaques génériques et un appel légitime. C'est la définition opérationnelle
// du paved road : ce n'est pas qu'on peut écrire une route sûre, c'est que le
// chemin par défaut l'est.
//
// Exécuté par la vérification via `node --import tsx <ce fichier>`. Il écrit un
// unique objet JSON sur la sortie standard, en dernière ligne.

import express from 'express';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const LAB_ROOT = path.resolve(import.meta.dirname, '../../..');
const TEMPLATE = path.join(LAB_ROOT, 'workspace/templates/route.ts');

const cas = [];
const note = (id, ok, detail) => cas.push({ id, ok, detail });
const fin = (erreur) => {
  console.log(JSON.stringify({ erreur: erreur ?? null, cas }));
  process.exit(0);
};

// ── Le jeton du banc d'essai ────────────────────────────────────────────────
// « Bearer <tenant>:<role>:<email> ». Suffisant : ce qui est mesuré est ce que
// le gabarit fait de `req.user`, pas la cryptographie du jeton.
function authentification(req, _res, next) {
  const header = req.headers.authorization ?? '';
  if (header.startsWith('Bearer ')) {
    const [tenantId, role, email] = header.slice(7).split(':');
    if (tenantId && role && email) req.user = { tenantId, role, email };
  }
  next();
}

let mod;
try {
  mod = await import(pathToFileURL(TEMPLATE).href);
} catch (err) {
  fin(`le gabarit ne s’importe pas : ${String(err).split('\n')[0]}`);
}

const fabrique = mod.createResourceRouter ?? mod.default;
if (typeof fabrique !== 'function') {
  fin('le gabarit n’exporte pas de fonction `createResourceRouter` (ni d’export par défaut qui en soit une)');
}

// La ressource neuve : elle n'existe nulle part dans le lab, le gabarit ne peut
// donc pas la connaître.
const magasin = [
  { id: 'NOTE-1', tenantId: 'acme', titre: 'Relance Dupont', corps: 'Rappeler lundi', priorite: 2 },
  { id: 'NOTE-2', tenantId: 'globex', titre: 'Conditions négociées', corps: 'Confidentiel Globex', priorite: 1 },
];

let routeur;
try {
  routeur = fabrique({
    nom: 'notes',
    champs: { titre: 'string', corps: 'string', priorite: 'number' },
    magasin,
  });
} catch (err) {
  fin(`la fabrique du gabarit a levé une erreur : ${String(err).split('\n')[0]}`);
}

const app = express();
app.use(express.json());
app.use(authentification);
app.use('/notes', routeur);
app.use((err, _req, res, _next) => {
  res.status(500).json({ erreur: String(err?.message ?? err) });
});

const serveur = app.listen(0, '127.0.0.1');
await new Promise((r) => serveur.once('listening', r));
const base = `http://127.0.0.1:${serveur.address().port}/notes`;

const ACME = 'acme:user:dev@acme.example';

async function appel(chemin, { jeton, methode = 'GET', corps } = {}) {
  try {
    const res = await fetch(`${base}${chemin}`, {
      method: methode,
      headers: {
        'Content-Type': 'application/json',
        ...(jeton ? { Authorization: `Bearer ${jeton}` } : {}),
      },
      body: corps === undefined ? undefined : JSON.stringify(corps),
      signal: AbortSignal.timeout(5000),
    });
    const texte = await res.text();
    let json = null;
    try { json = texte ? JSON.parse(texte) : null; } catch { /* réponse non JSON */ }
    return { status: res.status, json, texte };
  } catch (err) {
    return { status: 0, json: null, texte: String(err) };
  }
}

const refuse = (s) => s >= 400 && s < 500;

// 1 · Appel sans jeton.
{
  const r = await appel('/', { });
  note('sans-jeton', r.status === 401,
    `GET /notes sans en-tête d’autorisation → ${r.status} (401 attendu)`);
}

// 2 · Jeton d'un autre tenant sur un enregistrement qui ne lui appartient pas.
{
  const r = await appel('/NOTE-2', { jeton: ACME });
  note('autre-tenant', refuse(r.status),
    `GET /notes/NOTE-2 (globex) avec un jeton acme → ${r.status} (4xx attendu)`);
}

// 3 · Corps hors schéma : un champ que la ressource ne déclare pas.
{
  const r = await appel('/', {
    jeton: ACME, methode: 'POST',
    corps: { titre: 'Note', corps: 'Texte', priorite: 1, interne: 'ne devrait pas entrer' },
  });
  const cree = r.json && typeof r.json === 'object' ? r.json : {};
  const accepte = Object.prototype.hasOwnProperty.call(cree, 'interne');
  note('hors-schema', refuse(r.status) || !accepte,
    refuse(r.status)
      ? `POST /notes avec un champ non déclaré → ${r.status} (refus explicite)`
      : `POST /notes avec un champ non déclaré → ${r.status}, et le champ « interne » ${accepte ? 'a été conservé' : 'a été ignoré'}`);
}

// 4 · Mass assignment sur le champ qui décide de l'appartenance.
{
  const r = await appel('/', {
    jeton: ACME, methode: 'POST',
    corps: { titre: 'Note', corps: 'Texte', priorite: 1, tenantId: 'globex', role: 'admin' },
  });
  const cree = r.json && typeof r.json === 'object' ? r.json : {};
  const vole = cree.tenantId === 'globex' || cree.role === 'admin';
  note('mass-assignment', refuse(r.status) || !vole,
    refuse(r.status)
      ? `POST /notes avec tenantId et role dans le corps → ${r.status} (refus explicite)`
      : `POST /notes avec tenantId=globex et role=admin → ${r.status}, enregistrement rattaché à ${JSON.stringify(cree.tenantId)}${cree.role ? `, role=${JSON.stringify(cree.role)}` : ''}`);
}

// 5 · Clé de prototype.
{
  const r = await appel('/', {
    jeton: ACME, methode: 'POST',
    corps: JSON.parse('{"titre":"Note","corps":"Texte","priorite":1,"__proto__":{"pollue":true}}'),
  });
  const pollue = {}.pollue !== undefined;
  note('prototype', !pollue && r.status !== 500 && r.status !== 0,
    pollue
      ? 'POST /notes avec une clé __proto__ → Object.prototype a été pollué'
      : `POST /notes avec une clé __proto__ → ${r.status}, prototype intact`);
  if (pollue) delete Object.prototype.pollue;
}

// 6 · L'appel légitime doit continuer à marcher — sans quoi « tout refuser »
//     suffirait à passer les cinq premiers cas.
{
  const creation = await appel('/', {
    jeton: ACME, methode: 'POST',
    corps: { titre: 'Relance Martin', corps: 'Appeler mardi', priorite: 3 },
  });
  const cree = creation.json && typeof creation.json === 'object' ? creation.json : {};
  const creationOk = creation.status >= 200 && creation.status < 300
    && cree.titre === 'Relance Martin' && cree.priorite === 3;

  const liste = await appel('/', { jeton: ACME });
  const items = Array.isArray(liste.json) ? liste.json : Array.isArray(liste.json?.items) ? liste.json.items : null;
  const listeOk = liste.status === 200 && Array.isArray(items)
    && items.some((i) => i && i.id === 'NOTE-1')
    && items.every((i) => !i || i.tenantId === undefined || i.tenantId === 'acme');

  const unitaire = await appel('/NOTE-1', { jeton: ACME });
  const unitaireOk = unitaire.status === 200 && unitaire.json?.id === 'NOTE-1';

  const details = [];
  if (!creationOk) details.push(`création légitime → ${creation.status}, ${JSON.stringify(cree).slice(0, 120)}`);
  if (!listeOk) details.push(`liste légitime → ${liste.status}, ${JSON.stringify(liste.json).slice(0, 120)}`);
  if (!unitaireOk) details.push(`lecture de sa propre note → ${unitaire.status}, ${JSON.stringify(unitaire.json).slice(0, 120)}`);

  note('legitime', creationOk && listeOk && unitaireOk,
    details.length ? details.join(' · ') : 'création, liste et lecture unitaire répondent correctement');
}

serveur.close();
fin(null);

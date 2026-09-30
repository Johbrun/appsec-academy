// Livrable de référence du challenge « test-data-generator ».
//
// Deux exports :
//   · `generate({ graine, nombre })` — des enregistrements représentatifs,
//     déterministes à graine égale, et dont aucune valeur ne PEUT être réelle ;
//   · `suspect(enregistrement)` — les raisons de croire qu'un enregistrement
//     vient de la production. Tableau vide quand il n'y en a pas.
//
// Le point qui compte : ce ne sont pas des valeurs « qui ont l'air fausses »,
// ce sont des valeurs dont on démontre qu'elles ne peuvent pas être vraies.
// Un IBAN qui échoue la clé ISO 7064 n'est l'IBAN de personne ; un numéro de
// carte qui échoue Luhn n'est la carte de personne.

// ── Germe déterministe ──────────────────────────────────────────────────────

function empreinte(chaine) {
  let h = 1779033703 ^ String(chaine).length;
  for (let i = 0; i < String(chaine).length; i++) {
    h = Math.imul(h ^ String(chaine).charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

function hasard(graine) {
  let a = empreinte(graine)();
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Clés de contrôle ────────────────────────────────────────────────────────

export function mod97(iban) {
  const s = String(iban).replace(/\s+/g, '').toUpperCase();
  if (!/^[A-Z]{2}[0-9A-Z]{6,32}$/.test(s)) return -1;
  const r = (s.slice(4) + s.slice(0, 4)).replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  let reste = 0;
  for (const ch of r) reste = (reste * 10 + Number(ch)) % 97;
  return reste;
}

export function luhn(valeur) {
  const d = String(valeur).replace(/\D/g, '');
  if (d.length < 8) return false;
  let somme = 0;
  for (let i = 0; i < d.length; i++) {
    let x = Number(d[d.length - 1 - i]);
    if (i % 2 === 1) { x *= 2; if (x > 9) x -= 9; }
    somme += x;
  }
  return somme % 10 === 0;
}

/** Décale le dernier chiffre tant que la clé passe : la valeur devient invérifiable. */
const casseLaCle = (valeur, passe) => {
  let v = valeur;
  for (let i = 0; i < 10 && passe(v); i++) {
    v = v.slice(0, -1) + String((Number(v.slice(-1)) + 1) % 10);
  }
  return v;
};

// ── Génération ──────────────────────────────────────────────────────────────

const PRENOMS = ['Camille', 'Yanis', 'Élodie', 'Tarek', 'Marion', 'Hugo', 'Sarah', 'Paul', 'Inès', 'Bastien', 'Léa', 'Nadir'];
const NOMS = ['Dubreuil', 'Bakkali', 'Marchand', 'Benali', 'Leclercq', 'Pereira', 'Nguyen', 'Ferrand', 'Roussel', 'Ollivier', 'Vasseur', 'Dacosta'];

export function generate({ graine, nombre } = {}) {
  if (typeof graine !== 'string' || graine === '') throw new Error('une graine (chaîne non vide) est requise');
  const n = Number(nombre ?? 10);
  const tirage = hasard(graine);
  const chiffres = (k) => Array.from({ length: k }, () => String(Math.floor(tirage() * 10))).join('');

  const out = [];
  for (let i = 0; i < n; i++) {
    const prenom = PRENOMS[Math.floor(tirage() * PRENOMS.length)];
    const nom = NOMS[Math.floor(tirage() * NOMS.length)];
    const rang = String(i + 1).padStart(4, '0');
    const paire = () => chiffres(2);

    out.push({
      id: `T-${graine}-${rang}`,
      nom: `${prenom} ${nom}`,
      // RFC 2606 : example.com est réservé, il ne recevra jamais de courrier.
      email: `${prenom.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')}.${nom.toLowerCase()}${rang}@example.com`,
      // Plage de fiction de l'ARCEP : aucun abonné ne l'a.
      telephone: `+33 6 39 98 ${paire()} ${paire()}`,
      iban: casseLaCle(`FR${chiffres(2)}${chiffres(10)}${chiffres(11)}`, (v) => mod97(v) === 1),
      carte: casseLaCle(`4000${chiffres(12)}`, luhn),
      siret: casseLaCle(chiffres(14), luhn),
    });
  }
  return out;
}

// ── Détection de données réelles ────────────────────────────────────────────

const DOMAINES_RESERVES = /@(example\.(com|org|net)|[^@]*\.(test|invalid|localhost))$/i;
const TELEPHONE_FICTION = /^\+33\s?6\s?39\s?98(\s?\d{2}){2}$/;

export function suspect(enregistrement = {}) {
  const raisons = [];
  const { email, telephone, iban, carte, siret } = enregistrement;

  if (typeof email !== 'string' || !DOMAINES_RESERVES.test(email)) {
    raisons.push(`email hors des domaines réservés aux tests : ${email}`);
  }
  if (typeof telephone !== 'string' || !TELEPHONE_FICTION.test(telephone.trim())) {
    raisons.push(`téléphone hors de la plage de fiction +33 6 39 98 XX XX : ${telephone}`);
  }
  if (typeof iban === 'string' && mod97(iban) === 1) {
    raisons.push(`IBAN valide au sens de la clé ISO 7064 : ${iban}`);
  }
  if (typeof carte === 'string' && luhn(carte)) {
    raisons.push(`numéro de carte valide au sens de la clé de Luhn : ${carte}`);
  }
  if (typeof siret === 'string' && luhn(siret)) {
    raisons.push(`SIRET valide au sens de la clé de Luhn : ${siret}`);
  }
  return raisons;
}

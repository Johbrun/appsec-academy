// Livrable de référence du challenge « sla-policy ».
//
//   node scripts/sla-report.mjs <constats.json> <politique.yaml>
//
// Écrit sur la sortie standard la liste des constats hors délai, triée.
// Un SLA qu'on ne mesure pas est une intention : c'est ce script qui en fait
// une politique.

import fs from 'node:fs';
import { load as chargeYaml } from 'js-yaml';

const [, , fichierConstats, fichierPolitique] = process.argv;
if (!fichierConstats || !fichierPolitique) {
  console.error('usage : node scripts/sla-report.mjs <constats.json> <politique.yaml>');
  process.exit(1);
}

const { aujourdhui, constats } = JSON.parse(fs.readFileSync(fichierConstats, 'utf8'));
const politique = chargeYaml(fs.readFileSync(fichierPolitique, 'utf8'));

const jours = (debut, fin) =>
  Math.round((Date.parse(`${fin}T00:00:00Z`) - Date.parse(`${debut}T00:00:00Z`)) / 86400000);

/** Le délai qui s'applique vraiment : celui de la décision, plafonné par le KEV. */
function delaiApplicable(constat) {
  const base = politique.delais[constat.ssvc] ?? null;
  if (!constat.kev) return base;
  return base === null ? politique.plafond_kev : Math.min(base, politique.plafond_kev);
}

const hors_delai = constats
  .filter((c) => {
    const limite = delaiApplicable(c);
    if (limite === null) return false;
    return jours(c.constate_le, c.corrige_le ?? aujourdhui) > limite;
  })
  .map((c) => c.id)
  .sort();

process.stdout.write(JSON.stringify({ aujourdhui, hors_delai }, null, 2));

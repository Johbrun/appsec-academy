// Livrable de référence — challenge cra-notification (M1).
//
// Le déclencheur d'obligation de signalement. Il ne dit pas si une
// vulnérabilité est grave : il dit si elle est **activement exploitée** et si
// elle touche un composant du produit. C'est ce couple-là que le règlement
// retient, et c'est ce que la plupart des implémentations ratent — signaler sur
// « CRITICAL » revient à signaler tout le temps, donc à ne rien signaler.
//
// Deux échéances courent à partir du moment où l'éditeur a connaissance du
// fait : une alerte précoce sous 24 heures, une notification sous 72 heures.
//
//   node cra-report.mjs <sbom.json> <catalogue-kev.json> <date-iso>

import fs from 'node:fs';

const HEURE = 3600_000;
const DELAI_ALERTE_H = 24;
const DELAI_NOTIFICATION_H = 72;

const [, , cheminSbom, cheminKev, dateReference] = process.argv;
if (!cheminSbom || !cheminKev || !dateReference) {
  console.error('usage : node cra-report.mjs <sbom.json> <catalogue-kev.json> <date-iso>');
  process.exit(2);
}

const lire = (chemin) => JSON.parse(fs.readFileSync(chemin, 'utf8'));

const sbom = lire(cheminSbom);
const catalogue = lire(cheminKev);

const connuExploite = new Set((catalogue.vulnerabilities ?? []).map((v) => v.cveID));

// La nomenclature indexée par identifiant de paquet : c'est par lui que les
// vulnérabilités désignent ce qu'elles affectent.
const composants = new Map((sbom.components ?? []).map((c) => [c.purl, c]));

const instant = new Date(dateReference).getTime();
if (Number.isNaN(instant)) {
  console.error(`date de référence illisible : ${dateReference}`);
  process.exit(2);
}
const alerteAvant = new Date(instant + DELAI_ALERTE_H * HEURE).toISOString();
const notificationAvant = new Date(instant + DELAI_NOTIFICATION_H * HEURE).toISOString();

const obligations = (sbom.vulnerabilities ?? [])
  .filter((v) => connuExploite.has(v.id))
  .flatMap((v) =>
    (v.affects ?? []).map((a) => {
      const composant = composants.get(a.ref);
      return {
        composant: composant?.name ?? '',
        version: composant?.version ?? '',
        vulnerabilite: v.id,
        alerteAvant,
        notificationAvant,
      };
    }),
  )
  .sort((a, b) => a.vulnerabilite.localeCompare(b.vulnerabilite));

console.log(JSON.stringify({ notification: obligations.length > 0, obligations }));

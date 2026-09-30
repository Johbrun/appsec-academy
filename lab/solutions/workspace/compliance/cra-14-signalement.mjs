// CRA article 14 — décide du signalement, au lieu de le décrire.
//
// L'exigence impose une alerte précoce sous 24 heures et une notification sous
// 72 heures pour une vulnérabilité ACTIVEMENT EXPLOITÉE dans le produit. La
// question « faut-il signaler ? » se pose en pleine crise, à 2 h du matier, et
// c'est la pire heure pour relire un texte réglementaire. D'où un exécutable :
//
//   node workspace/compliance/cra-14-signalement.mjs incident.json
//
// Il lit un dossier d'incident et répond ce qu'il faut faire, avec les
// échéances calculées depuis l'instant de la connaissance des faits.

const HEURE = 3_600_000;

/** La décision, isolée pour être testable sans passer par la ligne de commande. */
export function decide(incident) {
  const { exploitee, produitPublie, connuLe } = incident;
  const t0 = Date.parse(connuLe);
  if (Number.isNaN(t0)) return { erreur: 'connuLe doit être une date ISO' };

  // Le déclencheur du CRA n'est pas la gravité : c'est l'exploitation active
  // d'une vulnérabilité d'un produit mis sur le marché.
  if (!produitPublie) {
    return { signaler: false, motif: 'la vulnérabilité ne touche aucune version publiée du produit' };
  }
  if (!exploitee) {
    return { signaler: false, motif: 'aucune exploitation active constatée : le CRA n’impose pas de délai' };
  }
  return {
    signaler: true,
    motif: 'vulnérabilité activement exploitée dans une version publiée',
    alertePrecoce: new Date(t0 + 24 * HEURE).toISOString(),
    notification: new Date(t0 + 72 * HEURE).toISOString(),
  };
}

const fichier = process.argv[2];
if (fichier) {
  const { readFileSync } = await import('node:fs');
  console.log(JSON.stringify(decide(JSON.parse(readFileSync(fichier, 'utf8'))), null, 2));
}

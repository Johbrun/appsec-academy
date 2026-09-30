// Livrable de référence du challenge « vex-to-cyclonedx ».
//
//   node scripts/vex2cdx.mjs <document.openvex.json>
//
// Traduit un document OpenVEX en document CycloneDX (profil VEX) sur la sortie
// standard. Le piège est là : les deux formats disent la même chose avec des
// mots différents, et le schéma CycloneDX rejette les mots d'OpenVEX.

import crypto from 'node:crypto';
import fs from 'node:fs';

const source = process.argv[2];
if (!source) {
  console.error('usage : node scripts/vex2cdx.mjs <document.openvex.json>');
  process.exit(1);
}

const vex = JSON.parse(fs.readFileSync(source, 'utf8'));

// OpenVEX « status » → CycloneDX « analysis.state ».
const ETATS = {
  not_affected: 'not_affected',
  affected: 'exploitable',
  fixed: 'resolved',
  under_investigation: 'in_triage',
};

// OpenVEX « justification » → CycloneDX « analysis.justification ».
// Deux justifications OpenVEX tombent sur la même valeur CycloneDX : la
// distinction « le composant est absent » / « le code vulnérable est absent »
// n'existe pas de l'autre côté. C'est une perte d'information, et c'est exactement
// pour ça qu'un format d'échange ne se traduit pas mot à mot.
const JUSTIFICATIONS = {
  component_not_present: 'code_not_present',
  vulnerable_code_not_present: 'code_not_present',
  vulnerable_code_not_in_execute_path: 'code_not_reachable',
  vulnerable_code_cannot_be_controlled_by_adversary: 'requires_configuration',
  inline_mitigations_already_exist: 'protected_by_mitigating_control',
};

const vulnerabilities = (vex.statements ?? []).map((s) => {
  const etat = ETATS[s.status];
  if (!etat) throw new Error(`statut OpenVEX inconnu : ${s.status}`);

  const analysis = { state: etat };
  if (s.justification) {
    const traduite = JUSTIFICATIONS[s.justification];
    if (!traduite) throw new Error(`justification OpenVEX inconnue : ${s.justification}`);
    analysis.justification = traduite;
  }
  const detail = s.impact_statement ?? s.action_statement ?? s.status_notes;
  if (detail) analysis.detail = detail;

  return {
    id: s.vulnerability.name,
    affects: (s.products ?? []).map((p) => ({ ref: p['@id'] })),
    analysis,
  };
});

const document = {
  bomFormat: 'CycloneDX',
  specVersion: '1.6',
  serialNumber: `urn:uuid:${crypto.randomUUID()}`,
  version: 1,
  metadata: {
    timestamp: new Date().toISOString(),
    authors: [{ name: vex.author ?? 'inconnu' }],
  },
  vulnerabilities,
};

process.stdout.write(JSON.stringify(document, null, 2));

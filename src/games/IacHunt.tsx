import { LineAudit } from '../components/LineAudit';
import { iacCategories, iacFiles } from '../data/game-iac';

export default function IacHunt() {
  return (
    <LineAudit
      gameId="iac-hunt"
      title="IaC Misconfig Hunt"
      items={iacFiles}
      rounds={3}
      categories={iacCategories}
      lang="hcl"
      legendTitle="Catégories"
      hint="Clique sur chaque ligne mal configurée, puis choisis la catégorie de risque."
      falseFlagHint="Block Public Access, deletion_protection, une piste multi-régions ou une politique AWS en lecture seule sont de bonnes décisions : ne les signale pas."
      nextLabel="Fichier suivant"
    />
  );
}

import { LineAudit } from '../components/LineAudit';
import { SeriesGame } from '../components/Series';
import { iacCategories, iacSeries } from '../data/game-iac';

export default function IacHunt() {
  return (
    <SeriesGame
      gameId="iac-hunt"
      title="IaC Misconfig Hunt"
      set={iacSeries}
      unit="fichiers"
      intro="Sept séries de trois fichiers, Terraform surtout, avec un peu de CloudFormation et de CDK. Plus on monte, plus les bons réglages côtoient les mauvais, et plus le défaut est un attribut qui manque ou une condition qui ne protège rien."
    >
      {(play) => (
        <LineAudit
          gameId="iac-hunt"
          title="IaC Misconfig Hunt"
          play={play}
          categories={iacCategories}
          lang="hcl"
          legendTitle="Catégories"
          hint="Clique sur chaque ligne mal configurée, puis choisis la catégorie de risque."
          falseFlagHint="Block Public Access, deletion_protection, une piste multi-régions ou une politique AWS en lecture seule sont de bonnes décisions : ne les signale pas."
          nextLabel="Fichier suivant"
        />
      )}
    </SeriesGame>
  );
}

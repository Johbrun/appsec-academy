import { LineAudit, type AuditItem } from '../components/LineAudit';
import { SeriesGame } from '../components/Series';
import { cicdRisks, workflowSeries } from '../data/game-workflows';
import type { Workflow } from '../data/game-workflows';

const categories = cicdRisks.map((r) => ({ id: r.id, name: r.name, short: `CICD-SEC-${r.id}` }));
const toItem = (w: Workflow): AuditItem => ({ ...w, issues: w.issues.map((i) => ({ match: i.match, cats: i.risks, text: i.text })) });

export default function WorkflowAudit() {
  return (
    <SeriesGame
      gameId="workflow-audit"
      title="Workflow Audit"
      set={workflowSeries}
      unit="workflows"
      intro="Sept séries de trois workflows. Plus on monte, plus les fichiers appliquent déjà de bonnes pratiques qu’il ne faut pas signaler, et plus le défaut tient à une combinaison de lignes."
    >
      {(play) => (
        <LineAudit
          gameId="workflow-audit"
          title="Workflow Audit"
          play={{ ...play, items: play.items.map(toItem) }}
          categories={categories}
          lang="yaml"
          legendTitle="OWASP Top 10 CI/CD"
          hint="Clique sur chaque ligne dangereuse, puis rattache-la au risque OWASP CI/CD correspondant."
          falseFlagHint="Épingler par SHA, limiter les permissions ou utiliser l’OIDC sont de bonnes pratiques : ne les signale pas comme des risques."
          nextLabel="Workflow suivant"
          unit="workflows audités"
        />
      )}
    </SeriesGame>
  );
}

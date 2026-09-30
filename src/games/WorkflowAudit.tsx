import { LineAudit } from '../components/LineAudit';
import { cicdRisks, workflows } from '../data/game-workflows';

const categories = cicdRisks.map((r) => ({ id: r.id, name: r.name, short: `CICD-SEC-${r.id}` }));
const items = workflows.map((w) => ({ ...w, issues: w.issues.map((i) => ({ match: i.match, cats: i.risks, text: i.text })) }));

export default function WorkflowAudit() {
  return (
    <LineAudit
      gameId="workflow-audit"
      title="Workflow Audit"
      items={items}
      rounds={3}
      categories={categories}
      lang="yaml"
      legendTitle="OWASP Top 10 CI/CD"
      hint="Clique sur chaque ligne dangereuse, puis rattache-la au risque OWASP CI/CD correspondant."
      falseFlagHint="Épingler par SHA, limiter les permissions ou utiliser l’OIDC sont de bonnes pratiques : ne les signale pas comme des risques."
      nextLabel="Workflow suivant"
    />
  );
}

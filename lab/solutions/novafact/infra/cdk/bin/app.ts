import { App, Aspects } from 'aws-cdk-lib';
import { AwsSolutionsChecks, NagSuppressions } from 'cdk-nag';
import { ApiStack } from '../lib/api-stack';

const app = new App();

const api = new ApiStack(app, 'NovafactApi', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: 'eu-west-3' },
});

// CORRIGÉ : l'analyse de conformité est rebranchée sur l'application entière.
// Un aspect débranché « le temps de la release » ne se rebranche jamais tout
// seul : c'est le même mécanisme qu'un scanner passé en mode avertissement.
Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }));

// CORRIGÉ : il ne reste qu'une suppression, et elle se lit.
//
// Les trois autres — motif vide, « TODO », « à voir avec la plateforme » —
// ont été retirées : ce n'étaient pas des décisions, c'étaient des silences.
// Une suppression sans motif est une dette anonyme ; six mois plus tard,
// personne ne sait si le risque a été accepté, contourné, ou simplement pas
// vu. Le motif dit quoi, pourquoi, sous quel ticket et jusqu'à quand.
//
// `addResourceSuppressions` sur la ressource concernée vaut mieux que
// `addStackSuppressions` sur la pile entière : la portée d'une exception fait
// partie de l'exception.
NagSuppressions.addStackSuppressions(api, [
  {
    id: 'AwsSolutions-L1',
    reason:
      'Runtime figé par l’agent APM du fournisseur, qui ne supporte pas encore Node 22. Suivi dans NOVA-2184, réexamen au 2026-03-31.',
  },
]);

app.synth();

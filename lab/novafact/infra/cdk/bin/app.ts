// VULNÉRABLE — fixture du lab, ne pas réutiliser

import { App, Aspects } from 'aws-cdk-lib';
import { AwsSolutionsChecks, NagSuppressions } from 'cdk-nag';
import { ApiStack } from '../lib/api-stack';

const app = new App();

const api = new ApiStack(app, 'NovafactApi', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: 'eu-west-3' },
});

// L'analyse de conformité a été débranchée « le temps de la release de
// novembre ». Le commentaire est plus vieux que la release.
//
// Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }));

NagSuppressions.addStackSuppressions(api, [
  { id: 'AwsSolutions-IAM5', reason: '' },
  { id: 'AwsSolutions-IAM4', reason: 'TODO' },
  { id: 'AwsSolutions-S1', reason: 'à voir avec la plateforme' },
  {
    id: 'AwsSolutions-L1',
    reason:
      'Runtime figé par l’agent APM du fournisseur, qui ne supporte pas encore Node 22. Suivi dans NOVA-2184, réexamen au 2026-03-31.',
  },
]);

app.synth();

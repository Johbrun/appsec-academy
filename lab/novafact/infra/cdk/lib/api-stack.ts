// VULNÉRABLE — fixture du lab, ne pas réutiliser
//
// Pile CDK de l'API Novafact. Rien n'est déployé : ce fichier est lu, pas
// exécuté. Les identifiants de compte sont inventés.

import { Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import type { Construct } from 'constructs';

export class ApiStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const attachments = new s3.Bucket(this, 'Attachments', {
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      versioned: true,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    const invoices = new dynamodb.Table(this, 'Invoices', {
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    const api = new lambda.Function(this, 'Api', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('../../dist'),
      timeout: Duration.seconds(10),
      memorySize: 512,
      environment: {
        ATTACHMENTS_BUCKET: attachments.bucketName,
        INVOICES_TABLE: invoices.tableName,
      },
    });

    // « Le temps de débugger le 403 », disait la pull request. C'était il y a
    // quatorze mois.
    api.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['s3:*', 'dynamodb:*', 'logs:*', 'kms:Decrypt'],
        resources: ['*'],
      }),
    );

    // L'API dépose des pièces jointes et les relit. Elle n'a jamais eu besoin
    // d'en supprimer, ni de toucher aux paramètres de la table.
    attachments.grantReadWrite(api);
    invoices.grantFullAccess(api);
  }
}

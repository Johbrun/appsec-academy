// Pile CDK de l'API Novafact — corrigée.

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

    // CORRIGÉ : les actions sont nommées et les ressources désignées.
    //
    // `s3:*` sur `*` ne veut pas dire « accès au bucket » : ça veut dire
    // lecture, écriture, suppression, changement de politique et de
    // chiffrement, sur tous les buckets du compte — y compris celui des
    // sauvegardes et celui du state Terraform.
    //
    // `arnForObjects('*')` reste un joker, mais un joker *de chemin* à
    // l'intérieur d'une ressource nommée : c'est la différence entre « tous les
    // objets de ce bucket » et « toutes les ressources du compte ».
    api.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['kms:Decrypt', 'kms:GenerateDataKey'],
        resources: [`arn:aws:kms:${this.region}:${this.account}:key/novafact-data`],
        conditions: {
          StringEquals: { 'kms:ViaService': `s3.${this.region}.amazonaws.com` },
        },
      }),
    );

    // CORRIGÉ : l'API dépose des pièces jointes et les relit. Elle n'a jamais
    // eu besoin d'en supprimer — `grantReadWrite` accorde pourtant
    // `s3:DeleteObject*`. Deux octrois étroits disent ce que le service fait.
    attachments.grantRead(api);
    attachments.grantPut(api);

    // CORRIGÉ : `grantFullAccess` accorde `dynamodb:*`, c'est-à-dire aussi
    // `DeleteTable`, `UpdateTable` et `RestoreTableFromBackup`. Les méthodes
    // d'octroi du CDK sont pratiques et souvent plus larges qu'on ne croit :
    // il faut lire le template qu'elles produisent, pas se fier à leur nom.
    invoices.grantReadWriteData(api);
  }
}

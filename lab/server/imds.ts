// Faux service de métadonnées d'instance, servi sur la boucle locale.
//
// Il existe pour que l'exercice ssrf-imds ait une cible réaliste SANS que rien
// ne sorte de la machine : le lab est sa propre victime. Les identifiants
// renvoyés sont inertes.
//
// Il imite IMDSv1 : aucun jeton n'est demandé. C'est précisément ce qu'IMDSv2
// corrige, en exigeant un PUT préalable qu'une SSRF simple ne sait pas faire.

import http from 'node:http';
import { HOST, IMDS_PORT } from './safety.ts';

const ROLE = 'novafact-task-role';

const CREDENTIALS = JSON.stringify(
  {
    Code: 'Success',
    LastUpdated: new Date().toISOString(),
    Type: 'AWS-HMAC',
    AccessKeyId: 'ASIAFAKELABONLY00000',
    SecretAccessKey: 'fAkE/LabOnly/NotARealSecret/0000000000',
    Token: 'FAKE-SESSION-TOKEN-LAB-ONLY',
    Expiration: new Date(Date.now() + 3600_000).toISOString(),
  },
  null,
  2,
);

export function startImds(): http.Server {
  const server = http.createServer((req, res) => {
    const url = req.url ?? '/';
    res.setHeader('Server', 'EC2ws');

    if (url === '/latest/meta-data/iam/security-credentials/') {
      res.end(ROLE);
    } else if (url === `/latest/meta-data/iam/security-credentials/${ROLE}`) {
      res.setHeader('Content-Type', 'text/plain');
      res.end(CREDENTIALS);
    } else if (url === '/latest/meta-data/instance-id') {
      res.end('i-0fakelab00000000');
    } else if (url === '/latest/meta-data/') {
      res.end('instance-id\niam/\nplacement/');
    } else {
      res.statusCode = 404;
      res.end('');
    }
  });
  server.listen(IMDS_PORT, HOST);
  return server;
}

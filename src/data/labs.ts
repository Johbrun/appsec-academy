// Labs reconnus utilisés pour la pratique. Les sujets PortSwigger se cochent
// une fois leurs labs Practitioner et Expert terminés.

export interface LabDef {
  id: string;
  title: string;
  provider: string;
  url: string;
  modules: string[];
  text: string;
  kind: 'portswigger' | 'app' | 'cloud' | 'ai' | 'course';
}

const ps = (id: string, title: string, slug: string, modules: string[], text: string): LabDef => ({
  id: `ps-${id}`, title, provider: 'PortSwigger', url: `https://portswigger.net/web-security/${slug}`, modules, text, kind: 'portswigger',
});

export const labs: LabDef[] = [
  ps('authentication', 'Authentication', 'authentication', ['m10'], 'Quelles limites arrêtent le brute force et le credential stuffing sans bloquer les clients ?'),
  ps('nosql', 'NoSQL injection', 'nosql-injection', ['m02'], 'Quel schéma de validation rend l’opérateur Mongo impossible ?'),
  ps('access-control', 'Access control', 'access-control', ['m02', 'm08'], 'Où centraliser l’autorisation pour que la BOLA ne dépende pas de chaque route ?'),
  ps('logic', 'Business logic vulnerabilities', 'logic-flaws', ['m02', 'm10'], 'Quels invariants métier le serveur doit-il garantir seul ?'),
  ps('api', 'API testing', 'api-testing', ['m03'], 'Comment les appels internes deviennent-ils une surface ?'),
  ps('race', 'Race conditions', 'race-conditions', ['m03'], 'Quelle contrainte en base garantit l’atomicité, peu importe le code ?'),
  ps('host', 'HTTP Host header attacks', 'host-header', ['m03'], 'D’où vient l’URL absolue de l’application ?'),
  ps('smuggling', 'HTTP request smuggling', 'request-smuggling', ['m03', 'm17'], 'Quel protocole de bout en bout, quel réglage de l’ALB, quelle trace dans Elastic ?'),
  ps('cache-poisoning', 'Web cache poisoning', 'web-cache-poisoning', ['m03', 'm17'], 'Qui définit la clé de cache ?'),
  ps('cache-deception', 'Web cache deception', 'web-cache-deception', ['m03', 'm17'], 'Que met-on en cache, et qui en décide ?'),
  ps('ssti', 'Server-side template injection', 'server-side-template-injection', ['m03'], 'Pourquoi les templates avec logique sont-ils une dette ?'),
  ps('deserialization', 'Insecure deserialization', 'deserialization', ['m03'], 'Quels formats n’acceptent jamais de types arbitraires ?'),
  ps('prototype-pollution', 'Prototype pollution', 'prototype-pollution', ['m02', 'm03'], 'Comment l’empêcher en structure plutôt que par filtrage ?'),
  ps('jwt', 'JWT attacks', 'jwt', ['m03', 'm09'], 'Qui choisit l’algorithme : le jeton ou le serveur ?'),
  ps('oauth', 'OAuth authentication', 'oauth', ['m09'], 'Qu’imposent RFC 9700 et RFC 10017 que ces labs violent ?'),
  ps('graphql', 'GraphQL API vulnerabilities', 'graphql', ['m03'], 'Limites de coût, introspection et autorisation par résolveur.'),
  ps('ssrf', 'Server-side request forgery', 'ssrf', ['m03', 'm15'], 'IMDSv2, proxy de sortie et filtrage après résolution.'),
  ps('xxe', 'XXE injection', 'xxe', ['m03'], 'Des parsers sans entités externes, par défaut.'),
  ps('dom', 'DOM-based vulnerabilities', 'dom-based', ['m02', 'm04'], 'Trusted Types et CSP stricte : que reste-t-il ?'),
  ps('xss', 'Cross-site scripting', 'cross-site-scripting', ['m02', 'm04'], 'Les labs Practitioner et Expert, lus avec l’œil du défenseur.'),
  ps('cors', 'CORS', 'cors', ['m02', 'm04'], 'Quelles valeurs par défaut suffisent ?'),
  ps('csrf', 'CSRF', 'csrf', ['m02'], 'SameSite, jetons et Fetch Metadata.'),
  ps('clickjacking', 'Clickjacking', 'clickjacking', ['m04'], 'frame-ancestors, et rien d’autre.'),
  ps('websockets', 'WebSockets', 'websockets', ['m03', 'm04'], 'Vérifier l’origine et l’authentification à l’ouverture.'),
  ps('file-upload', 'File upload vulnerabilities', 'file-upload', ['m08'], 'Un pipeline d’upload isolé.'),
  ps('llm', 'Web LLM attacks', 'llm-attacks', ['m03', 'm19'], 'Quel outil de l’agent donne l’impact, et comment le retirer ?'),

  { id: 'novafact-lab', title: 'Novafact Lab', provider: 'AppSec Academy', url: 'http://127.0.0.1:5199', modules: ['m02', 'm03', 'm04', 'm10', 'm19'], text: 'L’application fil rouge du parcours, rendue exécutable et vulnérable : 17 exercices, drapeaux constatés par le serveur, puis une suite de tests de régression qui exige que l’attaque échoue et que la fonctionnalité survive. Dans le dossier lab/ : npm install && npm run dev.', kind: 'app' },
  { id: 'juice-shop', title: 'OWASP Juice Shop', provider: 'OWASP', url: 'https://owasp.org/www-project-juice-shop/', modules: ['m02', 'm12'], text: 'Application Node/Express/Angular volontairement vulnérable, avec des « coding challenges » où l’on choisit le bon correctif.', kind: 'app' },
  { id: 'nodegoat', title: 'OWASP NodeGoat', provider: 'OWASP', url: 'https://github.com/OWASP/NodeGoat', modules: ['m02'], text: 'Le Top 10 appliqué à une application Node.js, avec tutoriels de correction.', kind: 'app' },
  { id: 'dvna', title: 'Damn Vulnerable NodeJS Application', provider: 'Appsecco', url: 'https://github.com/appsecco/dvna', modules: ['m02'], text: 'Vulnérabilités spécifiques à Node et leurs correctifs documentés.', kind: 'app' },
  { id: 'wrongsecrets', title: 'OWASP WrongSecrets', provider: 'OWASP', url: 'https://owasp.org/www-project-wrongsecrets/', modules: ['m13', 'm17'], text: 'Tout ce qu’il ne faut pas faire avec des secrets, niveau par niveau.', kind: 'app' },
  { id: 'cicd-goat', title: 'CI/CD Goat', provider: 'Cider Security', url: 'https://github.com/cider-security-research/cicd-goat', modules: ['m14'], text: 'Les risques du Top 10 CI/CD dans un environnement de pipeline complet.', kind: 'app' },
  { id: 'semgrep-academy', title: 'Semgrep Academy', provider: 'Semgrep', url: 'https://academy.semgrep.dev/', modules: ['m12', 'm13'], text: 'Cours gratuits sur l’écriture de règles et l’analyse statique.', kind: 'course' },
  { id: 'snyk-learn', title: 'Snyk Learn', provider: 'Snyk', url: 'https://learn.snyk.io/', modules: ['m02', 'm13'], text: 'Leçons courtes et gratuites, avec des exemples JavaScript.', kind: 'course' },
  { id: 'gh-securitylab', title: 'GitHub Security Lab', provider: 'GitHub', url: 'https://securitylab.github.com/', modules: ['m12', 'm13', 'm14'], text: 'Articles sur la variant analysis, CodeQL et la sécurité des workflows.', kind: 'course' },
  { id: 'flaws', title: 'flAWS', provider: 'Scott Piper', url: 'http://flaws.cloud/', modules: ['m15'], text: 'Les erreurs AWS classiques, niveau par niveau.', kind: 'cloud' },
  { id: 'flaws2', title: 'flAWS 2', provider: 'Scott Piper', url: 'http://flaws2.cloud/', modules: ['m15', 'm18'], text: 'Un parcours attaquant et un parcours défenseur.', kind: 'cloud' },
  { id: 'cloudgoat', title: 'CloudGoat', provider: 'Rhino Security Labs', url: 'https://github.com/RhinoSecurityLabs/cloudgoat', modules: ['m15'], text: 'Scénarios AWS volontairement vulnérables, dont des escalades IAM.', kind: 'cloud' },
  { id: 'big-iam', title: 'The Big IAM Challenge', provider: 'Wiz', url: 'https://bigiamchallenge.com/', modules: ['m15'], text: 'Lire et contourner des politiques IAM mal écrites.', kind: 'cloud' },
  { id: 'iam-vulnerable', title: 'IAM Vulnerable', provider: 'Bishop Fox', url: 'https://github.com/BishopFox/iam-vulnerable', modules: ['m15'], text: 'Les chemins d’escalade de privilèges IAM, déployés dans ton propre compte de test.', kind: 'cloud' },
  { id: 'terragoat', title: 'TerraGoat', provider: 'Bridgecrew', url: 'https://github.com/bridgecrewio/terragoat', modules: ['m16'], text: 'Terraform volontairement mal configuré, à scanner et corriger.', kind: 'cloud' },
  { id: 'cfngoat', title: 'CfnGoat', provider: 'Bridgecrew', url: 'https://github.com/bridgecrewio/cfngoat', modules: ['m16'], text: 'La même chose en CloudFormation.', kind: 'cloud' },
  { id: 'k8s-goat', title: 'Kubernetes Goat', provider: 'Madhu Akula', url: 'https://madhuakula.com/kubernetes-goat/', modules: ['m17'], text: 'Scénarios de sécurité Kubernetes, du conteneur au cluster.', kind: 'cloud' },
  { id: 'stratus', title: 'Stratus Red Team', provider: 'Datadog', url: 'https://stratus-red-team.cloud/', modules: ['m18'], text: 'Rejouer des techniques d’attaque cloud pour tester ses détections.', kind: 'cloud' },
  { id: 'gandalf', title: 'Gandalf', provider: 'Lakera', url: 'https://gandalf.lakera.ai/', modules: ['m19'], text: 'Faire révéler un secret à un LLM, niveau par niveau : pourquoi les garde-fous par prompt cèdent.', kind: 'ai' },
  { id: 'dvla', title: 'Damn Vulnerable LLM Agent', provider: 'WithSecure', url: 'https://github.com/WithSecureLabs/damn-vulnerable-llm-agent', modules: ['m19'], text: 'Un agent avec outils, vulnérable à l’injection indirecte.', kind: 'ai' },
  { id: 'crucible', title: 'Crucible', provider: 'Dreadnode', url: 'https://crucible.dreadnode.io/', modules: ['m19'], text: 'Défis de sécurité des modèles et des applications d’IA.', kind: 'ai' },
];

export const labById = (id: string) => labs.find((l) => l.id === id);
export const labsForModule = (moduleId: string) => labs.filter((l) => l.modules.includes(moduleId));

// M16 · Infrastructure as Code — challenges jouables.
//
// Comme en M14, le défaut vit dans le dépôt fixture `novafact/` et pas dans
// une requête : on l'audite, on corrige le fichier, et on relance l'audit —
// depuis la page du challenge ou par POST /api/lab/audit.
//
// Particularité du module : la correction n'est presque jamais « retirer la
// ressource ». Un bucket supprimé n'est pas un bucket privé, une base
// supprimée n'est pas une base chiffrée. Les vérifications commencent donc
// toutes par constater que la ressource est encore là.
//
// Les vérifications correspondantes sont dans server/audit/m16.ts.

import type { ExerciseDef } from '../exercises.ts';

export const m16: ExerciseDef[] = [
  {
    id: 'tf-public-bucket', module: 'm16', title: 'Bucket des pièces jointes exposé',
    status: 'live', kind: 'fix', level: 1, csslp: ['D7'], cwe: 'CWE-1188',
    brief: 'Le bucket des pièces jointes n’a ni blocage d’accès public, ni chiffrement, ni versioning, ni journalisation des accès.',
    goal: 'Corriger le module et faire passer le scanner sans la moindre exception.',
    file: 'novafact/infra/terraform/storage.tf',
    lessons: ['m16/l01', 'm16/l02'],
    hints: [
      'Cinq choses manquent ou sont à l’envers — et les annotations en tête de fichier disent lesquelles.',
      'Les quatre drapeaux du blocage d’accès public sont indépendants : trois sur quatre laissent un chemin ouvert. Et une politique qui accorde à `Principal = "*"` rouvre ce que les drapeaux ferment.',
      'Passe les quatre drapeaux à `true`, ajoute les ressources `aws_s3_bucket_server_side_encryption_configuration`, `aws_s3_bucket_versioning` (status `Enabled`) et `aws_s3_bucket_logging`, remplace la politique publique par une politique de contrôle d’origine (`Principal = { Service = "cloudfront.amazonaws.com" }`), et retire les `checkov:skip` / `tfsec:ignore`.',
    ],
    fix: 'Blocage d’accès public au niveau du compte, chiffrement par défaut, versioning, journalisation, et accès par contrôle d’origine plutôt que par politique publique. Le scanner en CI n’est utile que s’il bloque : en mode avertissement, il devient du bruit qu’on apprend à ignorer.',
  },
  {
    id: 'tf-open-sg', module: 'm16', title: 'Groupe de sécurité ouvert',
    status: 'live', kind: 'fix', level: 1, csslp: ['D7'], cwe: 'CWE-284',
    brief: 'Un groupe de sécurité autorise le monde entier sur les ports d’administration et de base de données.',
    goal: 'Refermer sans couper l’accès légitime, puis écrire la règle qui empêche la récidive.',
    file: 'novafact/infra/terraform/network.tf',
    lessons: ['m16/l01', 'm16/l03'],
    hints: [
      'Les ports 80 et 443 du répartiteur sont légitimes. Trois autres règles ne le sont pas.',
      'Une des trois ne montre pas son CIDR : elle le prend dans une variable. Et rétrécir `0.0.0.0/0` en `0.0.0.0/1` ne referme rien — l’audit compare à la plage privée du VPC, pas au texte.',
      'Supprime les règles SSH et RDP — la session managée remplace le rebond — et remplace le `cidr_ipv4 = "0.0.0.0/0"` de la règle PostgreSQL par `referenced_security_group_id = aws_security_group.app.id`, pour que la base reste joignable par l’application seule.',
    ],
    fix: 'Pas d’accès administratif entrant du tout — la session managée le remplace —, base de données en sous-réseau privé joignable par le seul groupe de l’application. Puis une politique en code qui refuse l’ouverture au monde sur un port d’administration.',
  },
  {
    id: 'tf-rds-hardening', module: 'm16', title: 'Base de données non durcie',
    status: 'live', kind: 'fix', level: 2, csslp: ['D7'], cwe: 'CWE-1188',
    brief: 'L’instance de base est accessible publiquement, non chiffrée, sans protection contre la suppression, sans sauvegarde et sans instantané final.',
    goal: 'Inverser les cinq réglages, et vérifier qu’aucun n’est réintroduit par une variante d’environnement.',
    file: 'novafact/infra/terraform/database.tf',
    lessons: ['m16/l02', 'm17/l06'],
    hints: [
      'Trois des cinq réglages se lisent directement dans la ressource. Les deux autres ont l’air corrects.',
      'Deux attributs valent `var.quelque_chose`. Une variable n’est pas une valeur : suis-la jusqu’à sa valeur effective.',
      'Passe `publicly_accessible` à `false`, `storage_encrypted` à `true`, `skip_final_snapshot` à `false` (avec un `final_snapshot_identifier`) — puis corrige `prod.auto.tfvars`, qui écrase les bonnes valeurs par défaut de `variables.tf` : c’est lui qui est chargé en production.',
    ],
    fix: 'Ces cinq attributs sont la définition d’une base de production. Les scanners les connaissent tous — la valeur de l’exercice est de voir qu’un module peut être juste en préproduction et faux en production, parce que le défaut est dans la variable, pas dans la ressource.',
  },
  {
    id: 'tf-state-secret', module: 'm16', title: 'Secret dans le code et dans le state',
    status: 'live', kind: 'fix', level: 2, csslp: ['D7', 'D8'], cwe: 'CWE-798',
    brief: 'Le mot de passe de la base est écrit en clair dans le code. Il se retrouve donc aussi dans le state.',
    goal: 'Sortir le secret du code et du state, et le lire depuis le gestionnaire de secrets.',
    file: 'novafact/infra/terraform/database.tf',
    lessons: ['m16/l04', 'm16/l03'],
    hints: [
      'Le state contient en clair tout ce que les ressources connaissent. Déplacer la valeur dans une variable ne la sort donc pas du state.',
      'Trois corrections passent : une source de données du gestionnaire de secrets, une variable marquée `sensitive` et sans valeur par défaut, ou un mot de passe que Terraform ne voit jamais.',
      'Remplace `password = "…"` par `manage_master_user_password = true` (AWS génère et fait tourner le secret, la valeur ne traverse pas Terraform), ou par `data.aws_secretsmanager_secret_version.db.secret_string`. Et considère le mot de passe actuel comme brûlé.',
    ],
    fix: 'Le state contient en clair tout ce que les ressources connaissent : un secret qui passe par une variable y arrive quand même. Secret généré et stocké côté gestionnaire, référencé par source de données, et variable marquée sensible.',
  },
  {
    id: 'tf-state-committed', module: 'm16', title: 'Le state versionné',
    status: 'live', kind: 'fix', level: 1, csslp: ['D7', 'D8'], cwe: 'CWE-538',
    brief: 'Un fichier de state est suivi par le dépôt. Il contient le mot de passe de la base et la valeur d’un secret.',
    goal: 'Le retirer, l’exclure, déclarer un backend distant — et considérer les secrets qu’il contenait comme brûlés.',
    file: 'novafact/infra/terraform/.gitignore',
    lessons: ['m16/l04', 'm13/l07'],
    hints: [
      'Ouvre `infra/terraform/terraform.tfstate` et regarde ce qu’il contient avant de le supprimer.',
      'Le fichier d’exclusion exclut le dossier de travail, pas le state. Et le state de secours n’a pas le même nom que le state.',
      'Supprime `terraform.tfstate`, ajoute `*.tfstate` et `*.tfstate.*` à `infra/terraform/.gitignore` (ou `*.tfstate*`), et garde le backend distant déclaré. Puis révoque le mot de passe de la base et la clé qui étaient dedans : les retirer du dépôt ne les retire pas de l’historique ni des clones.',
    ],
    fix: 'Le harnais vérifie qu’aucun fichier de state n’est suivi et qu’une règle d’exclusion existe. Et comme pour tout secret exposé : le retirer du dépôt ne le retire pas de l’historique. Ce qui est dans le state est à révoquer.',
  },
  {
    id: 'tf-backend', module: 'm16', title: 'Backend non chiffré et non verrouillé',
    status: 'live', kind: 'fix', level: 2, csslp: ['D7'], cwe: 'CWE-311',
    brief: 'Le backend distant n’a ni chiffrement, ni clé gérée, ni table de verrouillage : deux applications concurrentes peuvent corrompre l’état.',
    goal: 'Chiffrer, verrouiller, et restreindre l’accès au bucket de state.',
    file: 'novafact/infra/terraform/backend.tf',
    lessons: ['m16/l04', 'm16/l03'],
    hints: [
      'Le bloc `backend "s3"` tient en quatre lignes. Il en manque trois.',
      'Le verrou peut venir d’une table DynamoDB ou du verrou natif S3 de Terraform 1.10. Et le bucket qui porte le state est un bucket comme un autre : il se durcit.',
      'Ajoute `encrypt = true`, un `kms_key_id`, et soit `dynamodb_table`, soit `use_lockfile = true` — puis passe les quatre drapeaux de `aws_s3_bucket_public_access_block.tfstate` à `true` et active le versioning du bucket.',
    ],
    fix: 'Le state est l’actif le plus sensible de l’IaC : il décrit toute l’infrastructure et contient ses secrets. Chiffrement, verrou, accès séparé entre le rôle qui planifie et celui qui applique.',
  },
  {
    id: 'tf-unpinned-provider', module: 'm16', title: 'Provider et module non épinglés',
    status: 'live', kind: 'fix', level: 2, csslp: ['D7', 'D8'], cwe: 'CWE-1357',
    brief: 'La contrainte de version du provider est ouverte vers le haut, et un module est tiré d’un dépôt git sans référence figée.',
    goal: 'Épingler le provider avec son fichier de verrouillage, et le module sur une empreinte de commit.',
    file: 'novafact/infra/terraform/versions.tf',
    lessons: ['m16/l04', 'm14/l09'],
    hints: [
      'Quatre dépendances sont déclarées : deux providers et deux modules. Aucune n’est réellement figée.',
      '`?ref=main` est un alias, exactement comme `@v4` sur une action GitHub : celui qui pousse sur la branche décide de ce que le prochain `apply` déploie. C’est l’incident tj-actions transposé à l’IaC.',
      'Borne chaque contrainte vers le haut (`~> 5.82`, `= 5.82.2` ou `>= 5.82, < 6.0`), donne une `version` au module du registre, et remplace `?ref=main` par un SHA de commit de 40 caractères. Puis versionne le `.terraform.lock.hcl` que produit `terraform init` : c’est lui qui fige les empreintes réellement téléchargées.',
    ],
    fix: 'La supply chain de l’IaC obéit aux mêmes règles que celle du code : une référence mobile peut être repointée, et le premier `apply` qui suit part en production. C’est la transposition directe de l’incident tj-actions.',
  },
  {
    id: 'tf-alb-tls', module: 'm16', title: 'Répartiteur en clair et TLS obsolète',
    status: 'live', kind: 'fix', level: 2, csslp: ['D7'], cwe: 'CWE-319',
    brief: 'Le répartiteur sert le port 80 au lieu de rediriger, utilise une politique TLS de 2016, et n’écrit pas de journaux d’accès.',
    goal: 'Rediriger vers HTTPS, remonter la politique TLS, activer les journaux.',
    file: 'novafact/infra/terraform/alb.tf',
    lessons: ['m16/l02', 'm17/l04'],
    hints: [
      'Le listener du port 80 a une action par défaut. Regarde laquelle.',
      'Une politique TLS porte sa date dans son nom. Celle de 2016 accepte encore TLS 1.0 et 1.1.',
      'Passe l’action du listener 80 en `type = "redirect"` avec un bloc `redirect { protocol = "HTTPS" }`, remplace `ssl_policy` par `ELBSecurityPolicy-TLS13-1-2-2021-06`, et ajoute un bloc `access_logs { bucket = …, enabled = true }` sur l’`aws_lb`.',
    ],
    fix: 'Les journaux d’accès du répartiteur sont souvent la seule trace d’une attaque protocolaire — désynchronisation, empoisonnement de cache. Les activer relève autant de la détection que du durcissement.',
  },
  {
    id: 'cloudfront-waf', module: 'm16', title: 'Distribution sans WAF ni TLS minimum',
    status: 'live', kind: 'fix', level: 2, csslp: ['D7'], cwe: 'CWE-693',
    brief: 'La distribution accepte le HTTP en clair, n’est associée à aucun pare-feu applicatif, et son WAF est en mode comptage avec une action par défaut permissive.',
    goal: 'Forcer HTTPS, associer les règles managées, passer en blocage, ajouter une limite de débit.',
    file: 'novafact/infra/terraform/cloudfront.tf',
    lessons: ['m16/l02', 'm17/l04'],
    hints: [
      'Le pare-feu existe déjà, mais rien ne le relie à la distribution — et il n’y a pas qu’un seul comportement de cache à corriger.',
      '`override_action { count {} }` rend un groupe de règles managé purement observationnel : il voit tout et ne bloque rien.',
      'Mets `viewer_protocol_policy = "redirect-to-https"` sur les deux comportements, `minimum_protocol_version = "TLSv1.2_2021"`, ajoute `web_acl_id = aws_wafv2_web_acl.app.arn`, remplace chaque `count {}` par `none {}`, et ajoute une règle `rate_based_statement` avec `action { block {} }`.',
    ],
    fix: 'Un WAF en mode comptage ne bloque rien : c’est utile deux semaines pour régler les faux positifs, pas neuf mois. Et une limite de débit au bord protège l’application de ce que la limitation applicative ne voit jamais.',
  },
  {
    id: 'imdsv1-terraform', module: 'm16', title: 'IMDSv1 laissé actif',
    status: 'live', kind: 'fix', level: 2, csslp: ['D7'], cwe: 'CWE-918',
    brief: 'Le modèle de lancement autorise la version 1 du service de métadonnées : une SSRF suffit à obtenir les identifiants de l’instance.',
    goal: 'Exiger la version 2 et limiter le nombre de sauts, sur toutes les ressources concernées.',
    file: 'novafact/infra/terraform/compute.tf',
    lessons: ['m16/l01', 'm15/l03'],
    hints: [
      'Deux ressources font tourner du code. Une seule a un bloc `metadata_options` — et l’autre n’en a pas du tout, ce qui est pire.',
      'La version 2 exige une requête préalable qu’une SSRF simple ne sait pas faire. La limite de sauts, elle, empêche un conteneur d’atteindre les métadonnées de son hôte.',
      'Mets `http_tokens = "required"` et `http_put_response_hop_limit = 1` dans le bloc `metadata_options` du modèle de lancement, et traite aussi l’instance qui n’a pas de bloc du tout — ou supprime-la, si le rebond n’a plus de raison d’être.',
    ],
    fix: 'La version 2 exige une requête préalable qu’une SSRF simple ne sait pas faire, et la limite de sauts empêche un conteneur d’atteindre les métadonnées de son hôte. C’est le contrôle qui aurait cassé la chaîne de Capital One.',
  },
  {
    id: 'cdk-wildcard', module: 'm16', title: 'Joker IAM dans le code CDK',
    status: 'live', kind: 'fix', level: 2, csslp: ['D7'], cwe: 'CWE-732',
    brief: 'Une politique écrite en TypeScript accorde toutes les actions d’un service sur toutes les ressources, et une méthode d’octroi automatique va trop large.',
    goal: 'Restreindre aux actions et aux ressources nécessaires, et le vérifier sur le template généré.',
    file: 'novafact/infra/cdk/lib/api-stack.ts',
    lessons: ['m16/l01', 'm15/l05'],
    hints: [
      'Regarde ce que la fonction fait réellement : elle dépose des pièces jointes, les relit, et lit et écrit des lignes de facture.',
      '`s3:*` ne veut pas dire « accès au bucket » : ça veut dire lecture, écriture, suppression, et changement de politique — sur tous les buckets du compte. Et une des deux méthodes d’octroi accorde `dynamodb:*`, `DeleteTable` compris.',
      'Remplace les actions jokers par les actions nommées et `resources: ["*"]` par des ARN désignés (`bucket.arnForObjects("*")` reste acceptable : le joker est dans le chemin, pas dans la ressource), et remplace `grantFullAccess` par `grantReadWriteData` — ou par deux octrois plus étroits.',
    ],
    fix: 'Le harnais génère le template hors ligne et l’inspecte : c’est ce que la plateforme verra réellement. Les méthodes d’octroi du CDK sont pratiques et souvent plus larges qu’on ne croit — il faut lire ce qu’elles produisent.',
  },
  {
    id: 'cdk-nag-disabled', module: 'm16', title: 'Les garde-fous débranchés',
    status: 'live', kind: 'fix', level: 2, csslp: ['D7'], cwe: 'CWE-1059',
    brief: 'L’analyse de conformité n’est pas branchée sur l’application CDK, et plusieurs suppressions sont posées avec un motif vide.',
    goal: 'Rebrancher l’analyse et ne garder que les suppressions réellement justifiées.',
    file: 'novafact/infra/cdk/bin/app.ts',
    lessons: ['m16/l03', 'm01/l05'],
    hints: [
      'Une ligne du fichier a été mise en commentaire « le temps de la release ». Le commentaire est plus vieux que la release.',
      'Quatre suppressions sont déclarées. Une seule dit quoi, pourquoi, sous quel ticket et jusqu’à quand.',
      'Décommente `Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }))`, puis supprime les trois suppressions dont le motif est vide, « TODO » ou évasif — il ne doit rester que celles dont le motif est substantiel et référence un ticket.',
    ],
    fix: 'Une suppression sans motif est une dette anonyme : le harnais exige un motif substantiel référençant un ticket, et refuse toute annotation d’erreur non supprimée. C’est le même problème que les exceptions de scanner — sans date ni motif, elles deviennent permanentes.',
  },
  {
    id: 'cdk-bootstrap', module: 'm16', title: 'Bootstrap CDK par défaut',
    status: 'live', kind: 'fix', level: 3, csslp: ['D7', 'D8'], cwe: 'CWE-732',
    brief: 'Le bootstrap utilise le qualificatif par défaut, et le rôle de publication d’artefacts n’a pas de condition sur le compte propriétaire.',
    goal: 'Définir un qualificatif propre et ajouter la condition de compte sur le rôle de publication.',
    file: 'novafact/infra/cdk/cdk.json',
    lessons: ['m16/l04', 'm15/l04'],
    hints: [
      'Le qualificatif est la chaîne de dix caractères qui apparaît dans le nom de toutes les ressources de bootstrap. Celui-ci est le même pour tout le monde.',
      'Le second défaut n’est pas dans `cdk.json` : il est dans `infra/cdk/bootstrap/bootstrap-template.yaml`, sur le rôle qui publie les artefacts. Rien ne l’empêche d’écrire dans un bucket qui n’appartient pas au compte.',
      'Remplace `"@aws-cdk/core:bootstrapQualifier": "hnb659fds"` par une valeur propre (dix caractères alphanumériques au plus), et ajoute au rôle `FilePublishingRole` une `Condition: StringEquals: aws:ResourceAccount: !Ref AWS::AccountId`.',
    ],
    fix: 'Le qualificatif par défaut rend les noms de ressources prévisibles à l’échelle de tout le cloud : une recherche de 2024 a montré qu’un bucket de bootstrap supprimé pouvait être repris par un tiers, qui contrôlait alors les déploiements. Corrigé depuis côté CDK, mais le motif se retrouve partout où un nom est devinable.',
  },
  {
    id: 'tf-logging', module: 'm16', title: 'Journalisation d’infrastructure absente',
    status: 'live', kind: 'fix', level: 2, csslp: ['D7'], cwe: 'CWE-778',
    brief: 'Ni journaux de flux réseau, ni piste d’audit multi-région avec validation d’intégrité, ni pilote de journalisation sur les conteneurs.',
    goal: 'Poser les trois, et vérifier qu’aucune ressource n’échappe à la collecte.',
    file: 'novafact/infra/terraform/logging.tf',
    lessons: ['m16/l05', 'm18/l02'],
    hints: [
      'Trois collectes manquent, et la troisième concerne deux conteneurs, pas un.',
      'Une piste d’audit sur une seule région ne voit pas ce qui se passe dans les autres — et sans validation d’intégrité, rien ne prouvera qu’elle n’a pas été retouchée.',
      'Ajoute une ressource `aws_flow_log` sur le VPC avec `traffic_type = "ALL"`, passe `is_multi_region_trail` et `enable_log_file_validation` à `true`, et ajoute un bloc `logConfiguration` avec un `logDriver` à chaque conteneur de la définition de tâche.',
    ],
    fix: 'Ce qui n’est pas journalisé n’existera pas le jour de l’investigation. La validation d’intégrité de la piste d’audit est ce qui permet de prouver qu’elle n’a pas été retouchée — c’est la première chose qu’un attaquant essaie de couper.',
  },
];

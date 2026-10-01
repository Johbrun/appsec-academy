// Jeu « Right Tool, Right Stage » (M17) : chaque outil à sa place dans le pipeline de Novafact.
//
// Une carte décrit un outil réel et l'usage précis qu'on en fait. Le joueur
// choisit l'étape où cet usage apporte le plus ; une étape défendable mais moins
// bonne rapporte un demi-point (`ok`).
//
// Ce qui rend une carte difficile n'est pas l'outil, c'est **l'écart entre ce
// que le nom de l'outil évoque et ce que l'usage décrit exige** :
//
//   N1 · La description porte l'indice décisif : un moment (« avant le
//        commit », « à chaque changement de ressource »), une durée, une cible
//        déployée. Les autres étapes sont fausses pour une raison visible.
//
//   N2 · L'outil sert légitimement à deux étapes, et la description ne dit pas
//        laquelle. Il faut raisonner sur ce dont l'usage a besoin : une
//        application déployée, des heures de calcul, un diff, des mois d'usage
//        réel.
//
//   N3 · Contre-emploi. Le nom appelle une étape par réflexe (Gitleaks au
//        pre-commit, Terraform plan dans la PR, Jazzer.js la nuit, Access
//        Analyzer en production), mais l'usage décrit en exige une autre. Ces
//        cartes ont presque toutes une jumelle au réflexe attendu : elles sont
//        déclarées dans `avoid` pour ne pas tomber dans la même série.

import { defineSeries, type Leveled, type SeriesProfile } from '../lib/series';

export type Stage = 'poste' | 'pr' | 'nightly' | 'release' | 'prod';

export const stages: { id: Stage; name: string; hint: string }[] = [
  { id: 'poste', name: 'Poste du dev', hint: 'IDE, pre-commit : secondes' },
  { id: 'pr', name: 'Pull request', hint: 'CI de la PR : quelques minutes' },
  { id: 'nightly', name: 'Nightly', hint: 'Tâches longues : heures' },
  { id: 'release', name: 'Release', hint: 'Avant mise en production' },
  { id: 'prod', name: 'Production', hint: 'En continu, après déploiement' },
];

/** Code et tests, chaîne d'approvisionnement, ou cloud et exploitation. */
export type ToolFamily = 'code' | 'supply' | 'cloud';

export type ToolCard = Leveled & {
  tool: string;
  what: string;
  best: Stage;
  ok?: Stage[];
  why: string;
  family: ToolFamily;
};

export const toolCards: ToolCard[] = [
  // ── Poste du dev ─────────────────────────────────────────────────────────
  { id: 'gitleaks-precommit', level: 1, family: 'supply', tool: 'Gitleaks (hook pre-commit)', what: 'Détecter un secret avant qu’il n’entre dans l’historique Git.', best: 'poste', why: 'Un secret arrêté avant le commit n’a jamais besoin d’être révoqué. La push protection et le scan CI servent de filets derrière.', avoid: ['gitleaks-history'] },
  { id: 'eslint-no-unsanitized', level: 1, family: 'code', tool: 'ESLint + no-unsanitized', what: 'Signaler innerHTML ou dangerouslySetInnerHTML pendant la frappe.', best: 'poste', ok: ['pr'], why: 'Le retour le plus rapide possible, dans l’éditeur. La CI de la PR rejoue le lint pour ceux qui l’ont désactivé.' },
  { id: 'npm-ignore-scripts', level: 2, family: 'supply', tool: 'npm config set ignore-scripts true', what: 'Empêcher les scripts preinstall et postinstall de s’exécuter à l’installation.', best: 'poste', ok: ['pr'], why: 'Le poste du dev détient les jetons les plus précieux : le ver Shai-Hulud (2025) s’exécutait dans un postinstall et y volait les jetons npm et GitHub. La CI applique la même règle avec npm ci --ignore-scripts.' },

  // ── Pull request ─────────────────────────────────────────────────────────
  { id: 'semgrep-diff', level: 1, family: 'code', tool: 'Semgrep différentiel', what: 'Règles maison bloquantes, seulement sur les nouveaux findings.', best: 'pr', why: 'Le mode --baseline-commit ne montre que ce que la PR introduit, en quelques secondes : idéal pour un blocage juste.', avoid: ['semgrep-full'] },
  { id: 'sca-lockfile', level: 2, family: 'supply', tool: 'SCA sur le lockfile', what: 'Vérifier les dépendances ajoutées ou mises à jour par la PR.', best: 'pr', ok: ['nightly'], why: 'La décision d’ajouter un paquet se prend dans la PR ; c’est là qu’on veut savoir s’il est vulnérable ou suspect.' },
  { id: 'zizmor', level: 1, family: 'supply', tool: 'zizmor', what: 'Auditer les workflows GitHub Actions modifiés.', best: 'pr', ok: ['poste'], why: 'Un workflow dangereux doit être arrêté avant la fusion : une fois sur la branche principale, il s’exécute avec ses secrets.', avoid: ['actionlint'] },
  { id: 'checkov', level: 1, family: 'cloud', tool: 'Checkov / Trivy config', what: 'Scanner le Terraform modifié : buckets publics, IAM trop large.', best: 'pr', why: 'Une misconfiguration IaC se corrige dans la PR, avant le terraform apply.' },
  { id: 'regression-cve-2025-29927', level: 2, family: 'code', tool: 'Test de régression CVE-2025-29927', what: 'Vérifier que l’en-tête interne ne saute plus le middleware.', best: 'pr', why: 'Un test de régression tourne à chaque PR avec la suite de tests : la vulnérabilité ne peut pas revenir silencieusement.' },
  { id: 'ai-reviewer', level: 2, family: 'code', tool: 'Relecteur IA de PR', what: 'Commenter le diff : autorisation oubliée, dépendance inconnue.', best: 'pr', why: 'Il commente la PR en mode informatif ; l’humain tranche et les critères bloquants restent déterministes.' },
  { id: 'actionlint', level: 2, family: 'supply', tool: 'actionlint', what: 'Vérifier la syntaxe des workflows et passer leurs blocs run: à shellcheck.', best: 'pr', ok: ['poste'], why: 'Un workflow ne s’exécute qu’une fois poussé : le vérifier dans la PR qui le modifie évite de découvrir l’erreur, ou l’injection de shell, sur la branche principale.', avoid: ['zizmor'] },
  { id: 'hadolint', level: 1, family: 'cloud', tool: 'hadolint', what: 'Relire le Dockerfile modifié : FROM non épinglé, USER absent, RUN risqués.', best: 'pr', ok: ['poste'], why: 'Un lint de quelques secondes sur le fichier changé : sa place naturelle est la CI de la PR, et l’extension d’éditeur donne le même retour plus tôt.' },
  { id: 'lockfile-lint', level: 2, family: 'supply', tool: 'lockfile-lint', what: 'Refuser un lockfile qui pointe vers un registre inconnu ou une URL non HTTPS.', best: 'pr', why: 'Une PR peut rediriger une dépendance vers un autre hôte en ne modifiant que le lockfile, que personne ne relit. Le contrôle doit tomber sur ce diff-là, avant la fusion.' },
  { id: 'cdk-nag', level: 2, family: 'cloud', tool: 'cdk-nag', what: 'Appliquer les règles AwsSolutions aux constructions CDK à la synthèse.', best: 'pr', ok: ['poste'], why: 'Il s’exécute à chaque cdk synth, donc aussi sur le poste ; c’est dans la CI de la PR qu’il devient un critère partagé, avec des exceptions justifiées sur la construction concernée.' },
  { id: 'conftest-plan', level: 2, family: 'cloud', tool: 'Conftest sur le plan Terraform', what: 'Évaluer des politiques Rego sur la sortie de terraform show -json.', best: 'pr', ok: ['release'], why: 'Le plan reflète les valeurs réelles de l’environnement : l’évaluer dans la PR bloque une règle transverse avant l’apply. Le rejouer à l’apply ne sert que si le plan a changé entre-temps.' },
  { id: 'access-analyzer-checks', level: 3, family: 'cloud', tool: 'IAM Access Analyzer (custom policy checks)', what: 'check-no-new-access et check-access-not-granted sur les politiques IAM.', best: 'pr', why: 'Access Analyzer évoque la surveillance des comptes, mais ces deux contrôles comparent une politique à sa référence ou à une liste d’actions interdites : ils tranchent sur un diff, avant que la politique n’existe dans le compte.', avoid: ['access-analyzer-unused'] },
  { id: 'npm-audit-signatures', level: 2, family: 'supply', tool: 'npm audit signatures', what: 'Vérifier les signatures du registre et les attestations des paquets installés.', best: 'pr', ok: ['release'], why: 'Il vérifie ce que npm ci vient d’installer : une signature invalide se voit dans la PR qui modifie le lockfile. Le build de release peut le rejouer, mais le problème est déjà entré.' },
  { id: 'fast-check', level: 2, family: 'code', tool: 'fast-check', what: 'Vérifier qu’aucune suite d’opérations ne produit un avoir supérieur à la facture.', best: 'pr', ok: ['nightly'], why: 'Des milliers de cas générés en quelques secondes, dans la suite de tests : l’invariant est vérifié à chaque PR. La nuit, on peut seulement augmenter le nombre d’exécutions.' },
  { id: 'jazzer-regression', level: 3, family: 'code', tool: 'Jazzer.js (mode régression)', what: 'Rejouer les entrées du corpus qui ont déjà fait planter le parseur d’import.', best: 'pr', why: 'Le fuzzing évoque des heures de calcul, mais rejouer un corpus prend quelques secondes : c’est un test comme un autre, qui garantit à chaque PR que les plantages connus ne reviennent pas.', avoid: ['jazzer-campaign'] },
  { id: 'promptfoo-regression', level: 3, family: 'code', tool: 'promptfoo (suite de régression)', what: 'Rejouer les injections de prompt déjà trouvées sur l’assistant de facturation.', best: 'pr', ok: ['nightly'], why: 'Un outil de red teaming fait penser à la nuit, mais une suite figée de quelques dizaines de cas est un test bloquant : elle échoue dans la PR qui modifie le prompt ou les outils.', avoid: ['promptfoo-redteam'] },

  // ── Nightly ──────────────────────────────────────────────────────────────
  { id: 'codeql-extended', level: 2, family: 'code', tool: 'CodeQL security-extended', what: 'Taint tracking complet sur toute la base.', best: 'nightly', ok: ['pr'], why: 'L’analyse complète est plus longue ; en nightly elle couvre toute la base, la PR se contente du différentiel ou de la suite par défaut.' },
  { id: 'jazzer-campaign', level: 1, family: 'code', tool: 'Jazzer.js (campagne de fuzzing)', what: 'Explorer les parseurs d’import pendant des heures.', best: 'nightly', why: 'Le fuzzing gagne à tourner longtemps ; une PR ne peut pas attendre des heures.', avoid: ['jazzer-regression'] },
  { id: 'zap-active', level: 2, family: 'code', tool: 'ZAP actif authentifié', what: 'Scanner l’application déployée avec deux comptes de test.', best: 'nightly', ok: ['release'], why: 'Il faut une application déployée et du temps ; un environnement jetable nocturne ou de recette convient.' },
  { id: 'semgrep-full', level: 3, family: 'code', tool: 'Semgrep (scan complet, règles en rodage)', what: 'Passer les nouvelles règles, encore non bloquantes, sur l’ensemble du dépôt.', best: 'nightly', ok: ['pr'], why: 'Semgrep appelle la PR par réflexe, mais une règle en rodage se juge sur toute la base, sans bloquer personne : le rapport nocturne mesure son bruit avant qu’elle ne devienne bloquante.', avoid: ['semgrep-diff'] },
  { id: 'gitleaks-history', level: 3, family: 'supply', tool: 'Gitleaks (historique complet)', what: 'Parcourir tous les commits de tous les dépôts de l’organisation.', best: 'nightly', why: 'Le hook pre-commit ne protège que les nouveaux commits, et se contourne. Un scan planifié de l’historique retrouve ce qui est déjà passé : Toyota (2022) a découvert une clé d’accès publiée près de cinq ans plus tôt dans un dépôt public.', avoid: ['gitleaks-precommit'] },
  { id: 'k6-rate-limit', level: 2, family: 'code', tool: 'k6', what: 'Vérifier que la limite de débit de /login se déclenche sous 500 requêtes par seconde.', best: 'nightly', ok: ['release'], why: 'Un test de charge demande un environnement déployé et représentatif, et du temps : la nuit, sur la recette, sans ralentir les PR.' },
  { id: 'terraform-drift', level: 3, family: 'cloud', tool: 'terraform plan -detailed-exitcode', what: 'Repérer un changement fait à la main dans la console AWS.', best: 'nightly', ok: ['prod'], why: 'terraform plan appelle la PR, mais ici le code n’a pas bougé, c’est le compte qui a changé : seul un plan planifié, hors de toute PR, voit la dérive. Le code de sortie 2 signale un écart.', avoid: ['aws-config'] },
  { id: 'stryker', level: 2, family: 'code', tool: 'StrykerJS (mutation testing)', what: 'Vérifier que les tests échoueraient si un contrôle d’autorisation disparaissait.', best: 'nightly', ok: ['pr'], why: 'Muter le code et relancer la suite pour chaque mutant prend du temps : la nuit, ciblé sur les modules de contrôle. En PR, seulement sur les fichiers touchés, si le budget le permet.' },
  { id: 'promptfoo-redteam', level: 2, family: 'code', tool: 'promptfoo redteam (campagne générée)', what: 'Générer des centaines d’attaques adaptées à l’objectif de l’assistant.', best: 'nightly', ok: ['release'], why: 'Une campagne générée sert à découvrir : longue, coûteuse en appels au modèle, non déterministe. Elle tourne sur la préproduction, et ses trouvailles alimentent la suite de régression.', avoid: ['promptfoo-regression'] },
  { id: 'stratus-red-team', level: 3, family: 'cloud', tool: 'Stratus Red Team', what: 'Déclencher des techniques d’attaque AWS pour vérifier que les règles Elastic se déclenchent.', best: 'nightly', ok: ['release'], why: 'Tester une détection fait penser à la production, mais l’outil crée ses propres ressources, déclenche la technique puis nettoie : on le lance régulièrement sur un compte dédié relié au SIEM, pour prouver que chaque règle se déclenche encore.' },

  // ── Release ──────────────────────────────────────────────────────────────
  { id: 'pentest', level: 1, family: 'code', tool: 'Pentest externe ciblé', what: 'Un regard indépendant sur la nouvelle fonctionnalité de paiement.', best: 'release', why: 'Humain, coûteux et long : réservé aux changements majeurs, avant leur mise en production.' },
  { id: 'slsa-attestation', level: 2, family: 'supply', tool: 'Attestation SLSA + signature', what: 'Prouver quel workflow a produit l’image et depuis quel commit.', best: 'release', why: 'La provenance est générée au build de l’artefact publié, puis vérifiée au déploiement.', avoid: ['npm-provenance', 'kyverno-verify'] },
  { id: 'trivy-image', level: 3, family: 'cloud', tool: 'Trivy (image construite)', what: 'Refuser une image qui embarque une CVE critique pour laquelle un correctif existe.', best: 'release', ok: ['pr'], why: 'On pense à la surveillance continue, mais refuser suppose de décider avant de publier : l’image candidate est scannée dans le build de release, avant d’être poussée vers le registre de production. Surveiller ce qui tourne est le travail d’un autre outil.', avoid: ['inspector'] },
  { id: 'syft-sbom', level: 2, family: 'supply', tool: 'Syft', what: 'Produire le SBOM CycloneDX de l’image.', best: 'release', ok: ['pr'], why: 'Un SBOM décrit un artefact précis : on le génère au build de la version publiée et on le garde avec elle. Log4Shell (2021) a montré le prix de ne pas savoir quelles images embarquaient log4j.' },
  { id: 'kyverno-verify', level: 3, family: 'supply', tool: 'Kyverno (vérification d’image)', what: 'Refuser sur EKS tout pod dont l’image n’est pas signée par le workflow de release.', best: 'release', ok: ['prod'], why: 'Kyverno tourne dans le cluster de production, d’où le réflexe, mais il agit à l’admission : c’est la dernière porte avant la mise en production. Il ne vaut que s’il impose l’identité du signataire.', avoid: ['slsa-attestation'] },
  { id: 'npm-provenance', level: 1, family: 'supply', tool: 'npm publish --provenance', what: 'Publier une version de @novafact/sdk avec une attestation liée au workflow.', best: 'release', why: 'La provenance est produite au moment de la publication, depuis la CI : elle dit quel workflow et quel commit ont produit cette version.', avoid: ['slsa-attestation'] },

  // ── Production ───────────────────────────────────────────────────────────
  { id: 'nuclei-templates', level: 2, family: 'code', tool: 'Templates Nuclei maison', what: 'Vérifier que les findings connus ne reviennent pas.', best: 'prod', ok: ['release'], why: 'Ils tournent après chaque déploiement, sur tous les environnements réels, en quelques secondes.' },
  { id: 'dependency-track', level: 1, family: 'supply', tool: 'Dependency-Track', what: 'Surveiller les SBOM des versions déployées face aux nouvelles CVE.', best: 'prod', why: 'Une CVE publiée demain concerne le code déjà en production : la surveillance est continue.', avoid: ['inspector'] },
  { id: 'bug-bounty', level: 1, family: 'code', tool: 'Programme de bug bounty', what: 'Des chercheurs externes testent en continu.', best: 'prod', why: 'Il porte sur ce qui est réellement exposé, en continu, une fois le reste du programme en place.' },
  { id: 'access-analyzer-unused', level: 2, family: 'cloud', tool: 'IAM Access Analyzer (accès non utilisés)', what: 'Repérer les rôles, clés et permissions qui n’ont servi à rien.', best: 'prod', why: 'Dire qu’une permission ne sert pas demande des mois d’usage réel : l’analyse ne peut porter que sur les comptes où tournent les workloads.', avoid: ['access-analyzer-checks'] },
  { id: 'aws-config', level: 1, family: 'cloud', tool: 'AWS Config (règles gérées)', what: 'Évaluer chaque changement de configuration d’une ressource, dès qu’il se produit.', best: 'prod', why: 'Config enregistre les changements des ressources déployées et les évalue en continu : c’est le filet détectif derrière les scanners IaC, qui ne voient que le code.', avoid: ['terraform-drift'] },
  { id: 'inspector', level: 2, family: 'cloud', tool: 'Amazon Inspector', what: 'Rescanner les images ECR et les fonctions Lambda quand une CVE est publiée.', best: 'prod', ok: ['nightly'], why: 'Une image saine le jour du build ne l’est plus le jour où une CVE sort : en décembre 2021, Log4Shell a rendu vulnérables des images déployées depuis des mois. Le rescan continu porte sur ce qui tourne.', avoid: ['trivy-image', 'dependency-track'] },
  { id: 'guardduty', level: 1, family: 'cloud', tool: 'Amazon GuardDuty', what: 'Signaler des identifiants d’instance EC2 utilisés depuis une adresse extérieure à AWS.', best: 'prod', why: 'Il analyse en continu CloudTrail, les flux VPC et le DNS des comptes réels. Le finding InstanceCredentialExfiltration.OutsideAWS vise exactement le scénario de Capital One (2019).' },
  { id: 'waf-bot-control', level: 1, family: 'cloud', tool: 'AWS WAF Bot Control', what: 'Classer et limiter les bots qui visent le formulaire d’inscription en ligne.', best: 'prod', why: 'Il agit sur le trafic réel, à la bordure : on le déploie en comptage, on observe, puis on bloque.' },
  { id: 'canarytokens', level: 3, family: 'cloud', tool: 'Canarytokens (clé AWS piège)', what: 'Une fausse clé d’accès laissée dans un dépôt interne, qui alerte dès qu’on s’en sert.', best: 'prod', why: 'Le mot « dépôt » attire vers le poste ou la PR, mais un honeytoken ne teste rien : il attend. C’est une détection toujours armée, dont chaque alerte est fiable parce qu’aucun usage légitime n’existe.' },
  { id: 'csp-new-terms', level: 2, family: 'code', tool: 'Règle Elastic New Terms sur les rapports CSP', what: 'Alerter quand une source bloquée jamais vue apparaît sur la page de paiement.', best: 'prod', why: 'Les rapports CSP viennent des navigateurs des vrais clients : il n’y a rien à analyser tant que la page n’est pas en ligne. C’est le signal d’un skimmer ou d’un script modifié.' },
  { id: 'playwright-synthetic', level: 2, family: 'code', tool: 'Playwright (contrôle synthétique)', what: 'Charger la page de paiement dans un vrai navigateur et comparer ses scripts à la référence.', best: 'prod', ok: ['release'], why: 'L’exigence PCI 11.6.1 porte sur la page telle que les clients la reçoivent : le contrôle tourne sur la production, à intervalle régulier, avec une référence produite par le pipeline.' },
];

// ── Les séries ──────────────────────────────────────────────────────────────

const mix = (n1: number, n2: number, n3: number): [number, number, number] => [n1, n2, n3];

const PROFILES: SeriesProfile<ToolCard>[] = [
  { id: 'decouverte', title: 'Découverte', mix: mix(8, 0, 0), level: 1,
    text: 'La description dit le moment : avant le commit, pendant des heures, sur ce qui tourne. On apprend les cinq étapes.' },
  { id: 'premiers-choix', title: 'Premiers choix', mix: mix(5, 3, 0), level: 1,
    text: 'Trois outils qui pourraient servir à deux étapes se glissent dans le lot.' },
  { id: 'deux-etapes', title: 'Deux étapes possibles', mix: mix(0, 8, 0), level: 2,
    text: 'Chaque outil a une étape défendable et une meilleure. Il faut se demander de quoi l’usage a besoin.' },
  { id: 'montee', title: 'Montée en charge', mix: mix(2, 4, 2), level: 2,
    text: 'Les trois niveaux mêlés, dont deux contre-emplois : le nom de l’outil appelle la mauvaise étape.' },
  { id: 'supply', title: 'Supply chain', filter: (t) => t.family === 'supply', mix: mix(2, 4, 2), level: 2,
    text: 'Secrets, dépendances, workflows, signatures : la chaîne d’approvisionnement, du poste jusqu’à l’admission.' },
  { id: 'cloud', title: 'Cloud et IaC', filter: (t) => t.family === 'cloud', mix: mix(2, 3, 3), level: 2,
    text: 'Terraform, IAM, images, GuardDuty : le même service AWS change d’étape selon l’usage.' },
  { id: 'contre-emploi', title: 'Contre-emploi', mix: mix(0, 3, 5), level: 3,
    text: 'Cinq outils utilisés loin de leur étape habituelle. Le réflexe est le piège.' },
  { id: 'expert', title: 'Expert', mix: mix(0, 0, 8), level: 3,
    text: 'Que des contre-emplois : chaque nom d’outil appelle une autre étape que la bonne.' },
  { id: 'melee', title: 'Mêlée', mix: mix(3, 3, 2), level: 2, shuffleEachTime: true,
    text: 'Tous niveaux et toutes familles, recomposée à chaque partie.' },
];

export const toolSeries = defineSeries(toolCards, PROFILES);

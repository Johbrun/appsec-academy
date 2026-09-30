// Jeu « Right Tool, Right Stage » (M13) : chaque outil à sa place dans le pipeline de Novafact.

export type Stage = 'poste' | 'pr' | 'nightly' | 'release' | 'prod';

export const stages: { id: Stage; name: string; hint: string }[] = [
  { id: 'poste', name: 'Poste du dev', hint: 'IDE, pre-commit : secondes' },
  { id: 'pr', name: 'Pull request', hint: 'CI de la PR : quelques minutes' },
  { id: 'nightly', name: 'Nightly', hint: 'Tâches longues : heures' },
  { id: 'release', name: 'Release', hint: 'Avant mise en production' },
  { id: 'prod', name: 'Production', hint: 'En continu, après déploiement' },
];

export type ToolCard = { tool: string; what: string; best: Stage; ok?: Stage[]; why: string };

export const toolCards: ToolCard[] = [
  { tool: 'Gitleaks (hook pre-commit)', what: 'Détecter un secret avant qu’il n’entre dans l’historique Git.', best: 'poste', why: 'Un secret arrêté avant le commit n’a jamais besoin d’être révoqué. La push protection et le scan CI servent de filets derrière.' },
  { tool: 'ESLint + no-unsanitized', what: 'Signaler innerHTML ou dangerouslySetInnerHTML pendant la frappe.', best: 'poste', ok: ['pr'], why: 'Le retour le plus rapide possible, dans l’éditeur. La CI de la PR rejoue le lint pour ceux qui l’ont désactivé.' },
  { tool: 'Semgrep différentiel', what: 'Règles maison bloquantes, seulement sur les nouveaux findings.', best: 'pr', why: 'Le mode --baseline-commit ne montre que ce que la PR introduit, en quelques secondes : idéal pour un blocage juste.' },
  { tool: 'SCA sur le lockfile', what: 'Vérifier les dépendances ajoutées ou mises à jour par la PR.', best: 'pr', ok: ['nightly'], why: 'La décision d’ajouter un paquet se prend dans la PR ; c’est là qu’on veut savoir s’il est vulnérable ou suspect.' },
  { tool: 'zizmor', what: 'Auditer les workflows GitHub Actions modifiés.', best: 'pr', ok: ['poste'], why: 'Un workflow dangereux doit être arrêté avant la fusion : une fois sur la branche principale, il s’exécute avec ses secrets.' },
  { tool: 'Checkov / Trivy config', what: 'Scanner le Terraform modifié : buckets publics, IAM trop large.', best: 'pr', why: 'Une misconfiguration IaC se corrige dans la PR, avant le terraform apply.' },
  { tool: 'CodeQL security-extended', what: 'Taint tracking complet sur toute la base.', best: 'nightly', ok: ['pr'], why: 'L’analyse complète est plus longue ; en nightly elle couvre toute la base, la PR se contente du différentiel ou de la suite par défaut.' },
  { tool: 'Jazzer.js (campagne de fuzzing)', what: 'Explorer les parseurs d’import pendant des heures.', best: 'nightly', why: 'Le fuzzing gagne à tourner longtemps ; une PR ne peut pas attendre des heures.' },
  { tool: 'ZAP actif authentifié', what: 'Scanner l’application déployée avec deux comptes de test.', best: 'nightly', ok: ['release'], why: 'Il faut une application déployée et du temps ; un environnement jetable nocturne ou de recette convient.' },
  { tool: 'Pentest externe ciblé', what: 'Un regard indépendant sur la nouvelle fonctionnalité de paiement.', best: 'release', why: 'Humain, coûteux et long : réservé aux changements majeurs, avant leur mise en production.' },
  { tool: 'Attestation SLSA + signature', what: 'Prouver quel workflow a produit l’image et depuis quel commit.', best: 'release', why: 'La provenance est générée au build de l’artefact publié, puis vérifiée au déploiement.' },
  { tool: 'Templates Nuclei maison', what: 'Vérifier que les findings connus ne reviennent pas.', best: 'prod', ok: ['release'], why: 'Ils tournent après chaque déploiement, sur tous les environnements réels, en quelques secondes.' },
  { tool: 'Dependency-Track', what: 'Surveiller les SBOM des versions déployées face aux nouvelles CVE.', best: 'prod', why: 'Une CVE publiée demain concerne le code déjà en production : la surveillance est continue.' },
  { tool: 'Programme de bug bounty', what: 'Des chercheurs externes testent en continu.', best: 'prod', why: 'Il porte sur ce qui est réellement exposé, en continu, une fois le reste du programme en place.' },
  { tool: 'Test de régression CVE-2025-29927', what: 'Vérifier que l’en-tête interne ne saute plus le middleware.', best: 'pr', why: 'Un test de régression tourne à chaque PR avec la suite de tests : la vulnérabilité ne peut pas revenir silencieusement.' },
  { tool: 'Relecteur IA de PR', what: 'Commenter le diff : autorisation oubliée, dépendance inconnue.', best: 'pr', why: 'Il commente la PR en mode informatif ; l’humain tranche et les critères bloquants restent déterministes.' },
];

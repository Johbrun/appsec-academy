import type { BlockId } from './catalog';

export interface ExamDef {
  id: string;          // clé de stockage : "exam-a", "exam-final", "exam-csslp"
  title: string;
  kind: 'block' | 'final' | 'csslp';
  block?: BlockId;
  count: number;       // nombre de questions
  minutes: number;     // durée
  pass: number;        // seuil de réussite en %
  xp: number;          // XP accordée à la réussite complète
  text: string;
  icon: string;
}

export const exams: ExamDef[] = [
  { id: 'exam-a', title: 'Examen · Bloc A', kind: 'block', block: 'A', count: 20, minutes: 15, pass: 75, xp: 150, icon: 'Compass', text: 'Le métier : menace et ATT&CK, l’AppSec et ses métiers, maturité et posture.' },
  { id: 'exam-b', title: 'Examen · Bloc B', kind: 'block', block: 'B', count: 20, minutes: 15, pass: 75, xp: 150, icon: 'Bug', text: 'Le web : fonctionnement et protections, vulnérabilités côté serveur, côté client et avancées.' },
  { id: 'exam-c', title: 'Examen · Bloc C', kind: 'block', block: 'C', count: 20, minutes: 15, pass: 75, xp: 150, icon: 'PenTool', text: 'Concevoir : risques, threat modeling, exigences, spécifications, identité, anti-abus.' },
  { id: 'exam-d', title: 'Examen · Bloc D', kind: 'block', block: 'D', count: 20, minutes: 15, pass: 75, xp: 150, icon: 'ScanSearch', text: 'Construire et vérifier : revue de code, tests et analyse, pipeline et supply chain.' },
  { id: 'exam-e', title: 'Examen · Bloc E', kind: 'block', block: 'E', count: 20, minutes: 15, pass: 75, xp: 150, icon: 'Rocket', text: 'Déployer : IAM AWS, infrastructure as code, déploiement et résilience.' },
  { id: 'exam-f', title: 'Examen · Bloc F', kind: 'block', block: 'F', count: 20, minutes: 15, pass: 75, xp: 150, icon: 'Radar', text: 'Security Operations : journalisation, détection, réponse et gestion des vulnérabilités.' },
  { id: 'exam-g', title: 'Examen · Bloc G', kind: 'block', block: 'G', count: 20, minutes: 15, pass: 75, xp: 150, icon: 'BrainCircuit', text: 'Sécurité de l’IA : applications LLM, agents et MCP.' },
  { id: 'exam-h', title: 'Examen · Bloc H', kind: 'block', block: 'H', count: 20, minutes: 15, pass: 75, xp: 150, icon: 'Handshake', text: 'Piloter : adoption de la sécurité et programme AppSec.' },
  { id: 'exam-final', title: 'Examen final', kind: 'final', count: 40, minutes: 25, pass: 75, xp: 400, icon: 'GraduationCap', text: 'Quarante questions sur tout le parcours. 75 % pour valider le diplôme AppSec Academy.' },
  { id: 'exam-csslp', title: 'Examen blanc CSSLP', kind: 'csslp', count: 100, minutes: 90, pass: 70, xp: 500, icon: 'ScrollText', text: 'Cent questions réparties selon le poids des huit domaines CSSLP. Un entraînement grandeur nature.' },
];

export const examById = (id: string) => exams.find((e) => e.id === id);

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
  { id: 'exam-a', title: 'Examen · Bloc A', kind: 'block', block: 'A', count: 20, minutes: 15, pass: 75, xp: 150, icon: 'Compass', text: 'Le métier : vulnérabilités JS, recherche avancée, gestion des vulnérabilités, adoption.' },
  { id: 'exam-b', title: 'Examen · Bloc B', kind: 'block', block: 'B', count: 20, minutes: 15, pass: 75, xp: 150, icon: 'PenTool', text: 'Concevoir : exigences, conception, identité, anti-abus, threat modeling.' },
  { id: 'exam-c', title: 'Examen · Bloc C', kind: 'block', block: 'C', count: 20, minutes: 15, pass: 75, xp: 150, icon: 'ScanSearch', text: 'Vérifier et outiller : revue de code, tests et analyse, pipeline et supply chain.' },
  { id: 'exam-d', title: 'Examen · Bloc D', kind: 'block', block: 'D', count: 20, minutes: 15, pass: 75, xp: 150, icon: 'Radar', text: 'Cloud et production : IAM AWS, IaC, déploiement, détection Elastic.' },
  { id: 'exam-final', title: 'Examen final', kind: 'final', count: 40, minutes: 25, pass: 75, xp: 400, icon: 'GraduationCap', text: 'Quarante questions sur tout le parcours. 75 % pour valider le diplôme AppSec Academy.' },
  { id: 'exam-csslp', title: 'Examen blanc CSSLP', kind: 'csslp', count: 100, minutes: 90, pass: 70, xp: 500, icon: 'ScrollText', text: 'Cent questions réparties selon le poids des huit domaines CSSLP. Un entraînement grandeur nature.' },
];

export const examById = (id: string) => exams.find((e) => e.id === id);

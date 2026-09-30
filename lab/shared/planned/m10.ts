// M10 · Anti-abus, ATO & fraude — challenges spécifiés, pas encore implémentés.

import { P } from './helper.ts';
import type { ExerciseDef } from '../exercises.ts';

export const m10: ExerciseDef[] = [
  P('oat-taxonomy', 'm10', 'Nommer l’abus qu’on subit', 1, 'artifact', 'CWE-1059', ['D3', 'D4'],
    'Le support signale « des comportements bizarres ». Les journaux contiennent en réalité quatre abus automatisés distincts, qui n’appellent pas les mêmes contrôles.',
    'Classer le trafic observé dans les catégories de la taxonomie des menaces automatisées, et associer à chacune son contrôle.',
    'abuse/oat-classification.yaml', ['m10/l01', 'm10/l07'],
    'Le harnais connaît la vérité terrain du corpus et note le classement. Nommer sert à choisir : un scraping ne se traite pas comme un bourrage d’identifiants, et confondre les deux fait poser le mauvais contrôle — souvent celui qui gêne les vrais clients.'),

  P('bot-control', 'm10', 'Distinguer un bot d’un client', 2, 'fix', 'CWE-799', ['D4', 'D7'],
    'L’inscription et la connexion sont ouvertes à l’automatisation. Un CAPTCHA a été ajouté partout, et les clients légitimes s’en plaignent.',
    'Poser des défis proportionnés au risque, et mesurer ce qu’ils bloquent contre ce qu’ils coûtent aux vrais clients.',
    'server/routes/auth.ts', ['m10/l04', 'm10/l03'],
    'Défi invisible par défaut, visible seulement au-dessus d’un score de risque : le coût se paie sur le trafic suspect, pas sur tout le monde. L’empreinte d’appareil aide, avec ses limites — c’est une donnée personnelle, et elle entre dans la classification des données.'),
];

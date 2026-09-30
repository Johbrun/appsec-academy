// Modèle du jeu « Abuse Desk » (M10) : une journée de trafic sur Novafact, des contrôles, des compromis.
// Le modèle est volontairement simple et déterministe : chaque contrôle bloque une fraction d'un segment d'abus
// et gêne une fraction d'un segment légitime. Les effets de plusieurs contrôles se combinent : 1 - Π(1 - e).

export type ControlId = 'perIp' | 'perAccount' | 'breached' | 'atp' | 'turnstile' | 'verify' | 'quota';
export type Config = Record<ControlId, number>; // index de l'option choisie

export type Control = { id: ControlId; name: string; where: string; options: string[]; hint: string };

export const controls: Control[] = [
  { id: 'perIp', name: 'Limite par IP', where: 'POST /login', options: ['Aucune', '100 / 15 min', '20 / 15 min', '5 / 15 min'], hint: 'Efficace contre une source unique, aveugle face à un botnet, et brutale pour les bureaux derrière un NAT.' },
  { id: 'perAccount', name: 'Échecs par compte', where: 'POST /login', options: ['Aucune', 'Ralentir après 10', 'Ralentir après 5'], hint: 'Protège un compte ciblé. Un ralentissement progressif évite de verrouiller le compte au profit de l’attaquant.' },
  { id: 'breached', name: 'Mots de passe fuités', where: 'Connexion et changement', options: ['Non', 'Oui'], hint: 'Vérification par k-anonymat : un compte au mot de passe fuité est invité à le changer.' },
  { id: 'atp', name: 'AWS WAF ATP', where: 'POST /login', options: ['Non', 'Oui'], hint: 'Détection d’identifiants volés connus et de signaux de volume par client, gérée par AWS.' },
  { id: 'turnstile', name: 'Turnstile', where: 'Inscription', options: ['Non', 'Oui'], hint: 'Défi invisible pour la plupart des humains, coûteux pour l’automatisation à bas prix.' },
  { id: 'verify', name: 'E-mail vérifié', where: 'Avant le premier envoi', options: ['Non', 'Oui'], hint: 'Les adresses jetables passent, mais l’inscription en masse devient plus chère.' },
  { id: 'quota', name: 'Quota d’envoi des nouveaux comptes', where: '7 premiers jours', options: ['Aucun', '50 / jour', '10 / jour'], hint: 'Les fraudeurs veulent envoyer beaucoup et vite. Une vraie PME envoie rarement plus de 30 factures le premier jour.' },
];

export type Segment = { id: string; name: string; kind: 'abuse' | 'legit'; weight: number; text: string };

export const segments: Segment[] = [
  { id: 'stuffing', name: 'Credential stuffing', kind: 'abuse', weight: 0.45, text: '40 000 tentatives depuis 6 000 IP résidentielles, une seule tentative par compte.' },
  { id: 'brute', name: 'Attaque ciblée', kind: 'abuse', weight: 0.2, text: 'Des milliers d’essais sur les comptes de 12 administrateurs, depuis quelques IP.' },
  { id: 'fraud', name: 'Fraude à la facture', kind: 'abuse', weight: 0.35, text: 'Des comptes créés en série envoient de fausses factures au nom de Novafact.' },
  { id: 'users', name: 'Utilisateurs', kind: 'legit', weight: 0.6, text: '10 000 connexions légitimes, dont quelques fautes de frappe.' },
  { id: 'nat', name: 'Cabinet Durand', kind: 'legit', weight: 0.2, text: '300 comptables derrière une seule IP de sortie.' },
  { id: 'smb', name: 'Nouvelles PME', kind: 'legit', weight: 0.2, text: 'Des inscriptions réelles qui envoient leurs premières factures dans la journée.' },
];

// Effet de chaque option : blocage (segments d'abus) ou gêne (segments légitimes), entre 0 et 1.
const effects: Record<ControlId, Record<string, number>[]> = {
  perIp: [
    {},
    { brute: 0.5, nat: 0.3 },
    { brute: 0.85, stuffing: 0.02, nat: 0.8 },
    { brute: 0.95, stuffing: 0.1, nat: 1, users: 0.05 },
  ],
  perAccount: [
    {},
    { brute: 0.8, users: 0.01 },
    { brute: 0.95, users: 0.03 },
  ],
  breached: [{}, { stuffing: 0.6, brute: 0.2, users: 0.04 }],
  atp: [{}, { stuffing: 0.7, brute: 0.3, users: 0.01 }],
  turnstile: [{}, { fraud: 0.5, smb: 0.03 }],
  verify: [{}, { fraud: 0.3, smb: 0.05 }],
  quota: [{}, { fraud: 0.4, smb: 0.1 }, { fraud: 0.8, smb: 0.7 }],
};

export const initialConfig: Config = { perIp: 0, perAccount: 0, breached: 0, atp: 0, turnstile: 0, verify: 0, quota: 0 };

export type DayResult = { effect: Record<string, number>; blocked: number; harmed: number; score: number };

export function simulate(cfg: Config): DayResult {
  const effect: Record<string, number> = {};
  for (const seg of segments) {
    let pass = 1;
    for (const c of controls) pass *= 1 - (effects[c.id][cfg[c.id]][seg.id] ?? 0);
    effect[seg.id] = 1 - pass;
  }
  const blocked = segments.filter((s) => s.kind === 'abuse').reduce((a, s) => a + s.weight * effect[s.id], 0);
  const harmed = segments.filter((s) => s.kind === 'legit').reduce((a, s) => a + s.weight * effect[s.id], 0);
  return { effect, blocked, harmed, score: blocked * 60 + (1 - harmed) * 40 };
}

// Score sans aucune défense : tous les clients épargnés, aucun abus bloqué.
export const baselineScore = 40;

// Meilleur score atteignable, calculé une fois sur toutes les configurations (576).
export const bestScore = (() => {
  let best = 0;
  const walk = (k: number, cfg: Config) => {
    if (k === controls.length) { best = Math.max(best, simulate(cfg).score); return; }
    const c = controls[k];
    for (let o = 0; o < c.options.length; o++) walk(k + 1, { ...cfg, [c.id]: o });
  };
  walk(0, initialConfig);
  return best;
})();

// Messages du journal de la journée, selon les résultats.
export function dayLog(cfg: Config, r: DayResult): { good: boolean; text: string }[] {
  const log: { good: boolean; text: string }[] = [];
  const e = r.effect;
  if (e.stuffing < 0.5) log.push({ good: false, text: `Le credential stuffing aboutit sur ${Math.round((1 - e.stuffing) * 40)} comptes : une limite par IP ne voit pas un botnet qui ne fait qu’un essai par adresse.` });
  else log.push({ good: true, text: `Le stuffing est largement contenu (${Math.round(e.stuffing * 100)} % bloqué) : les signaux sur les identifiants fuités fonctionnent là où les limites de volume échouent.` });
  if (e.brute < 0.7) log.push({ good: false, text: 'Deux comptes administrateurs cèdent à l’attaque ciblée : rien ne limite les essais sur un même compte.' });
  if (e.fraud < 0.6) log.push({ good: false, text: `${Math.round((1 - e.fraud) * 1200)} fausses factures partent depuis l’infrastructure d’envoi de Novafact ; la réputation du domaine d’envoi chute.` });
  else log.push({ good: true, text: 'La fraude à la facture devient trop coûteuse : les comptes créés en série n’envoient presque rien.' });
  if (e.nat >= 0.5) log.push({ good: false, text: 'Le cabinet Durand ouvre un ticket prioritaire : la moitié de ses comptables ne peut plus se connecter. Une limite par IP punit les réseaux partagés.' });
  if (e.smb >= 0.3) log.push({ good: false, text: 'Des PME fraîchement inscrites ne peuvent pas envoyer leurs factures d’ouverture : plusieurs abandonnent l’essai.' });
  if (e.users >= 0.05) log.push({ good: false, text: 'Le support signale une hausse des utilisateurs bloqués à la connexion.' });
  if (cfg.perAccount === 2 && cfg.perIp <= 1 && e.nat < 0.5) log.push({ good: true, text: 'Le ralentissement par compte protège les administrateurs sans gêner le cabinet Durand.' });
  return log;
}

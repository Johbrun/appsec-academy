// Vérifications des challenges M7 · Fondations, exigences & vie privée.
//
// Un module d'exigences se met en lab à une condition : que l'exigence soit
// confrontée au code, et pas à elle-même. C'est le fil de tout ce fichier —
// l'inventaire de confiance est confronté aux dépendances réellement
// déclarées, la carte des données aux champs réellement présents dans le
// modèle ET à ce que les routes renvoient réellement, la matrice de
// traçabilité aux tests réellement exécutés, la revue d'accès au journal.
//
// Ce qui ne se vérifie PAS, et que les énoncés disent :
//
//   · la JUSTESSE d'une base légale. On peut vérifier qu'elle est déclarée et
//     qu'elle appartient à l'énumération du règlement. La qualification
//     juridique — celle-ci plutôt que celle-là — n'est pas automatisable ;
//   · la pertinence d'un découpage d'exigences, qui dépend du métier ;
//   · l'opportunité de retirer un droit : on constate qu'il n'a pas servi.
//
// `abuse-cases` reste spécifié dans shared/planned/m07.ts : il demande le
// double passage contre deux arbres, que le moteur d'audit synchrone ne sait
// pas encore faire.
//
// Les vérifications de ce module réutilisent les outils exportés par m01.ts.

import fs from 'node:fs';
import path from 'node:path';
import { LAB_ROOT, missing, run, wsExists, wsText } from './workspace.ts';
import {
  FIXTURES, asArray, asRecord, asText, equipeHandles, fixtureJson, fixtureYaml, joined, labExists,
  labText, lastJson, needText, needYaml, parseCsv, stripComments, uniq, type Check,
} from './m01.ts';

// ── Ce que le modèle de données contient vraiment ───────────────────────────

/** Les entités dont la carte des données doit rendre compte. */
const ENTITES = ['User', 'Invoice', 'Client', 'Mail'];

/** Les champs d'une interface de `server/store.ts`, lus dans le code. */
function champsDeLEntite(source: string, nom: string): string[] {
  const bloc = source.match(new RegExp(`interface ${nom}\\s*\\{([\\s\\S]*?)\\n\\}`))?.[1];
  if (!bloc) return [];
  return uniq(
    stripComments(bloc)
      .split('\n')
      .map((l) => l.trim().match(/^([A-Za-z_$][\w$]*)\??\s*:/)?.[1])
      .filter((v): v is string => Boolean(v)),
  );
}

/** La carte « entité.champ » attendue, déduite du modèle. */
export function champsDuModele(): { entite: string; champ: string }[] {
  const source = labText('server/store.ts') ?? '';
  return ENTITES.flatMap((entite) =>
    champsDeLEntite(source, entite).map((champ) => ({ entite, champ })),
  );
}

// ── Les routes mutantes réellement montées ──────────────────────────────────
//
// Le périmètre est déclaré — les trois fichiers du domaine facturation — mais
// la LISTE, elle, se lit dans le code. Une route ajoutée demain à l'un de ces
// fichiers entre d'elle-même dans le périmètre, et la matrice de l'apprenant
// devient fausse. C'est le but : une matrice tenue à la main ment vite.

const FICHIERS_GOLD = ['server/routes/invoices.ts', 'server/routes/credits.ts', 'server/routes/profile.ts'];

export interface RouteMutante {
  route: string;
  methode: string;
  authentification: boolean;
  autorisation: boolean;
  audit: boolean;
}

function montages(): Map<string, string> {
  const index = labText('server/index.ts') ?? '';
  const mounts = new Map<string, string>();
  for (const m of index.matchAll(/app\.use\(\s*'([^']+)'\s*,\s*([A-Za-z_$][\w$]*)\s*\)/g)) {
    if (!mounts.has(m[2])) mounts.set(m[2], m[1]);
  }
  return mounts;
}

export function routesMutantes(): RouteMutante[] {
  const mounts = montages();
  const routes: RouteMutante[] = [];

  for (const fichier of FICHIERS_GOLD) {
    const source = labText(fichier);
    if (source === null) continue;
    const lignes = source.split('\n');

    for (let i = 0; i < lignes.length; i += 1) {
      const decl = lignes[i].match(
        /^(\s*)([A-Za-z_$][\w$]*)\.(post|put|patch|delete)\(\s*'([^']*)'\s*,\s*(.*)$/,
      );
      if (!decl) continue;
      const [, indent, routeur, methode, chemin, reste] = decl;
      const prefixe = mounts.get(routeur);
      if (prefixe === undefined) continue;

      // Le corps : jusqu'au `});` à la même indentation que la déclaration.
      let fin = lignes.findIndex((l, j) => j > i && new RegExp(`^${indent}\\}\\);`).test(l));
      if (fin === -1) fin = lignes.length;
      const corps = stripComments(lignes.slice(i, fin).join('\n'));

      const surLeRouteur = new RegExp(`^\\s*${routeur}\\.use\\(requireUser\\)`, 'm').test(stripComments(source));
      const authentification = surLeRouteur || /requireUser/.test(reste);
      // Une décision d'autorisation, c'est un refus explicite fondé sur le
      // principal — pas la simple lecture de `req.user`.
      const autorisation = /res\.status\(\s*40[13]\s*\)/.test(corps) && /req\.user/.test(corps);
      // Un audit, c'est une entrée écrite SUR LE CHEMIN NORMAL. Un appel niché
      // dans un `if` est l'instrumentation d'une violation, pas une trace.
      const audit = new RegExp(`^${indent}  audit\\(`, 'm').test(corps);

      const chemin_complet = `${prefixe}${chemin === '/' ? '' : chemin}` || '/';
      routes.push({ route: chemin_complet, methode: methode.toUpperCase(), authentification, autorisation, audit });
    }
  }
  return routes.sort((a, b) => `${a.route} ${a.methode}`.localeCompare(`${b.route} ${b.methode}`));
}

// ── Énumérations ────────────────────────────────────────────────────────────

/**
 * La sensibilité, en énumération stricte.
 *
 * Une chaîne libre ferait du dictionnaire de données un document mort :
 * « sensible », « plutôt sensible » et « à protéger » cohabiteraient et rien
 * ne serait décidable. L'énumération fermée est ce qui permet d'écrire ensuite
 * des règles de traitement.
 */
const SENSIBILITES = new Set(['public', 'client', 'interne', 'secret']);
/** Les deux classes qui ne doivent jamais sortir par l'API. */
const NE_SORT_PAS = new Set(['interne', 'secret']);

/** Les six bases légales du règlement. Fermée, parce que le texte l'est. */
const BASES_LEGALES = new Set([
  'consentement', 'contrat', 'obligation-legale', 'interets-vitaux',
  'mission-interet-public', 'interets-legitimes',
]);

const DUREE = /^(\d+\s*(jours?|mois|ans?)|duree-du-compte|illimitee)$/;

// ── Vérifications ───────────────────────────────────────────────────────────

export const m07Checks: Record<string, Check> = {
  // ── À qui fait-on confiance, au juste ─────────────────────────────────────

  'trust-inventory': () => {
    const doc = needYaml<Record<string, unknown>>('requirements/trust.yaml');
    if ('error' in doc) return doc.error;

    // Les parties auxquelles Novafact fait confiance, lues dans le dépôt.
    const attendues = new Map<string, string>();
    const pkg = labText('novafact/package.json');
    if (pkg) {
      const json = JSON.parse(pkg) as { dependencies?: object; devDependencies?: object };
      for (const nom of [...Object.keys(json.dependencies ?? {}), ...Object.keys(json.devDependencies ?? {})]) {
        attendues.set(nom, 'dependance');
      }
    }
    const workflows = path.join(LAB_ROOT, 'novafact/.github/workflows');
    if (fs.existsSync(workflows)) {
      for (const f of fs.readdirSync(workflows)) {
        const texte = fs.readFileSync(path.join(workflows, f), 'utf8');
        for (const m of texte.matchAll(/uses:\s*([^\s@]+)@/g)) {
          if (!m[1].startsWith('.')) attendues.set(m[1], 'action-ci');
        }
        for (const m of texte.matchAll(/https?:\/\/([A-Za-z0-9.-]+)/g)) {
          attendues.set(m[1], 'origine-externe');
        }
      }
    }
    if (attendues.size === 0) return 'aucune partie de confiance n’a pu être lue dans le dépôt : la vérification ne peut pas se prononcer';

    const parties = asArray(asRecord(doc.value).parties).map(asRecord);
    if (parties.length === 0) return 'l’inventaire ne contient aucune entrée sous la clé `parties`';

    const bad: string[] = [];
    const vues = new Set<string>();
    const pouvoirs = new Set<string>();

    for (const p of parties) {
      const nom = asText(p.partie);
      const type = attendues.get(nom);
      if (type === undefined) {
        bad.push(`« ${nom || '(sans nom)'} » n’est pas une partie à laquelle le dépôt fait confiance : on n’inventorie pas des fournisseurs imaginaires`);
        continue;
      }
      if (vues.has(nom)) { bad.push(`${nom} est inventorié deux fois`); continue; }
      vues.add(nom);

      if (asText(p.type) !== type) {
        bad.push(`${nom} est une partie de type « ${type} », pas « ${asText(p.type) || 'rien'} »`);
      }
      const pouvoir = asText(p['ce-qu-il-pourrait-faire']);
      if (pouvoir.length < 60) {
        bad.push(`${nom} : ce qu’il pourrait faire s’il se retournait n’est pas écrit (au moins 60 caractères)`);
      } else if (pouvoirs.has(pouvoir)) {
        bad.push(`${nom} : le pouvoir décrit est recopié d’une autre partie — elles n’ont pourtant pas le même`);
      } else pouvoirs.add(pouvoir);

      if (asText(p.mitigation).length < 30) {
        bad.push(`${nom} : aucune mitigation écrite — l’inventaire sert à réduire la confiance, pas à la constater`);
      }
    }

    const oubliees = [...attendues.keys()].filter((n) => !vues.has(n));
    if (oubliees.length) {
      bad.push(`${oubliees.length} partie(s) de confiance absente(s) de l’inventaire : ${oubliees.slice(0, 5).join(', ')}`);
    }

    return joined(bad);
  },

  // ── Authentifier, autoriser, journaliser ──────────────────────────────────

  'gold-standard-audit': () => {
    const fichier = needText('requirements/gold-standard.csv');
    if ('error' in fichier) return fichier.error;

    const attendues = routesMutantes();
    if (attendues.length === 0) return 'aucune route mutante n’a pu être lue dans le code : la vérification ne peut pas se prononcer';

    const { header, rows } = parseCsv(fichier.value);
    const colonnes = ['route', 'methode', 'authentification', 'autorisation', 'audit', 'manque'];
    const absentes = colonnes.filter((c) => !header.includes(c));
    if (absentes.length) return `l’en-tête du CSV doit porter les colonnes ${colonnes.join(', ')} — il manque ${absentes.join(', ')}`;

    const bad: string[] = [];
    const vues = new Map<string, Record<string, string>>();
    const cle = (route: string, methode: string) => `${methode.toUpperCase()} ${route}`;
    const parClé = new Map(attendues.map((r) => [cle(r.route, r.methode), r]));

    for (const row of rows) {
      const k = cle(row.route, row.methode);
      const attendue = parClé.get(k);
      if (!attendue) { bad.push(`${k} n’est pas une route mutante du périmètre`); continue; }
      if (vues.has(k)) { bad.push(`${k} apparaît deux fois`); continue; }
      vues.set(k, row);

      const controles: [keyof RouteMutante, string][] = [
        ['authentification', 'authentification'],
        ['autorisation', 'autorisation'],
        ['audit', 'audit'],
      ];
      const manquants: string[] = [];
      for (const [champ, libelle] of controles) {
        const declare = row[libelle];
        if (declare !== 'oui' && declare !== 'non') {
          bad.push(`${k} : la colonne ${libelle} vaut oui ou non, pas « ${declare || 'rien'} »`);
          continue;
        }
        const reel = attendue[champ] as boolean;
        if ((declare === 'oui') !== reel) {
          bad.push(`${k} : ${libelle} déclarée « ${declare} », le code dit « ${reel ? 'oui' : 'non'} »`);
        }
        if (!reel) manquants.push(libelle);
      }

      // L'écart déclaré doit être exactement celui que le code donne.
      const declareManque = uniq((row.manque ?? '').split(/[,+]/).map((s) => s.trim()).filter((s) => s && s !== '-')).sort();
      if (JSON.stringify(declareManque) !== JSON.stringify(manquants.slice().sort())) {
        bad.push(`${k} : ce qui manque est « ${manquants.join(', ') || '-'} », le CSV annonce « ${declareManque.join(', ') || '-'} »`);
      }
    }

    const oubliees = [...parClé.keys()].filter((k) => !vues.has(k));
    if (oubliees.length) {
      bad.push(`${oubliees.length} route(s) mutante(s) absente(s) du relevé : ${oubliees.slice(0, 4).join(' · ')}`);
    }

    return joined(bad);
  },

  // ── Le sous-ensemble ASVS de Novafact ─────────────────────────────────────

  'asvs-subset': () => {
    const doc = needYaml<Record<string, unknown>>('requirements/asvs.yaml');
    if ('error' in doc) return doc.error;

    const standard = fixtureJson<{
      obligatoires: string[];
      chapitres: Record<string, string>;
      exigences: { id: string; chapitre: string; niveau: string }[];
    }>('m07/asvs-5.0.json');
    const connues = new Map(standard.exigences.map((e) => [e.id, e]));

    const retenues = asArray(asRecord(doc.value).exigences).map(asRecord);
    if (retenues.length === 0) return 'le livrable ne contient aucune entrée sous la clé `exigences`';

    const bad: string[] = [];
    const vues = new Set<string>();
    const chapitres = new Set<string>();

    for (const e of retenues) {
      const id = asText(e.id);
      const ref = connues.get(id);
      if (!ref) { bad.push(`l’exigence « ${id || '(sans nom)'} » n’existe pas dans le standard`); continue; }
      if (vues.has(id)) { bad.push(`l’exigence ${id} est retenue deux fois`); continue; }
      vues.add(id);
      chapitres.add(ref.chapitre);

      if (ref.niveau !== 'L2') {
        bad.push(`${id} est de niveau ${ref.niveau} dans le standard : le périmètre demandé est L2`);
      }
      if (asText(e.justification).length < 40) {
        bad.push(`${id} : aucune justification d’applicabilité (au moins 40 caractères)`);
      }
    }

    const manquants = standard.obligatoires.filter((c) => !chapitres.has(c));
    if (manquants.length) {
      bad.push(`aucune exigence retenue dans le(s) chapitre(s) ${manquants.map((c) => `${c} (${standard.chapitres[c]})`).join(', ')} — ces chapitres ne sont pas facultatifs pour une application de facturation`);
    }
    if (vues.size < 8) {
      bad.push(`${vues.size} exigence(s) retenue(s) : en deçà de huit, le sous-ensemble n’est pas un périmètre, c’est un échantillon`);
    }
    if (vues.size > 25) {
      bad.push(`${vues.size} exigences retenues : au-delà de vingt-cinq, plus personne ne les tient — le tri n’a pas été fait`);
    }

    return joined(bad);
  },

  // ── La matrice qui ne ment pas ────────────────────────────────────────────

  'traceability-matrix': () => {
    const fichier = needText('requirements/traceability.csv');
    if ('error' in fichier) return fichier.error;

    const asvs = needYaml<Record<string, unknown>>('requirements/asvs.yaml');
    if ('error' in asvs) {
      return `la matrice se trace sur les exigences retenues, qui ne sont pas exploitables — ${asvs.error}`;
    }
    const retenues = asArray(asRecord(asvs.value).exigences).map(asRecord).map((e) => asText(e.id)).filter(Boolean);
    if (retenues.length === 0) return 'aucune exigence retenue dans `requirements/asvs.yaml` : il n’y a rien à tracer';

    const { header, rows } = parseCsv(fichier.value);
    const colonnes = ['exigence', 'fichier', 'test', 'statut'];
    const absentes = colonnes.filter((c) => !header.includes(c));
    if (absentes.length) return `l’en-tête du CSV doit porter les colonnes ${colonnes.join(', ')} — il manque ${absentes.join(', ')}`;

    const bad: string[] = [];
    const vues = new Set<string>();
    const aJouer = new Map<string, { exigence: string; test: string; statut: string }[]>();

    for (const row of rows) {
      const exigence = row.exigence;
      if (!retenues.includes(exigence)) {
        bad.push(`${exigence || '(sans nom)'} ne figure pas parmi les exigences retenues`);
        continue;
      }
      if (vues.has(exigence)) { bad.push(`${exigence} est tracée deux fois`); continue; }
      vues.add(exigence);

      const statut = row.statut;
      if (statut !== 'tenue' && statut !== 'non-tenue') {
        bad.push(`${exigence} : le statut vaut tenue ou non-tenue, pas « ${statut || 'rien'} »`);
        continue;
      }
      if (!labExists(row.fichier)) {
        bad.push(`${exigence} : le fichier de test \`${row.fichier || 'rien'}\` n’existe pas dans le dépôt`);
        continue;
      }
      if (!row.test) { bad.push(`${exigence} : aucun nom de test cité`); continue; }
      (aJouer.get(row.fichier) ?? aJouer.set(row.fichier, []).get(row.fichier)!).push({
        exigence, test: row.test, statut,
      });
    }

    const oubliees = retenues.filter((id) => !vues.has(id));
    if (oubliees.length) {
      bad.push(`${oubliees.length} exigence(s) retenue(s) sans ligne dans la matrice : ${oubliees.slice(0, 5).join(', ')}`);
    }
    if (bad.length) return joined(bad);

    const statuts = [...aJouer.values()].flat().map((l) => l.statut);
    if (!statuts.includes('tenue')) {
      bad.push('aucune exigence n’est déclarée tenue : une matrice qui ne trace que des échecs ne prouve pas qu’on sait tester');
    }
    if (!statuts.includes('non-tenue')) {
      bad.push('aucune exigence n’est déclarée non tenue : sur le code livré, c’est invraisemblable — une matrice qui ne ment pas dit aussi ce qui ne tient pas');
    }
    if (bad.length) return joined(bad);

    // ── Les tests cités sont réellement exécutés ────────────────────────────
    const resultat = run(
      'node',
      ['--import', 'tsx', path.join(FIXTURES, 'm07/harness.mjs'), 'tests', ...aJouer.keys()],
      { maxOutput: 400_000, timeoutMs: 240_000 },
    );
    if (resultat.timedOut) return 'les tests cités n’ont pas terminé dans le temps imparti';

    const verdict = lastJson<{
      erreur: string | null;
      resultats: Record<string, { verdicts: Record<string, boolean>; demarre: boolean; sortie: string }>;
    }>(resultat.output);
    if (!verdict) return `le banc d’essai n’a rien pu conclure :\n${resultat.output.slice(0, 600)}`;
    if (verdict.erreur) return verdict.erreur;

    for (const [fichierTest, lignes] of aJouer) {
      const execution = verdict.resultats[fichierTest];
      if (!execution || !execution.demarre) {
        bad.push(`\`${fichierTest}\` ne s’exécute pas : ${execution?.sortie.split('\n').filter(Boolean).slice(-1)[0] ?? 'aucune sortie'}`);
        continue;
      }
      for (const { exigence, test, statut } of lignes) {
        if (!(test in execution.verdicts)) {
          const proches = Object.keys(execution.verdicts).filter((n) => n.includes(test.slice(0, 12)));
          bad.push(`${exigence} : aucun test nommé « ${test} » dans \`${fichierTest} \`${proches.length ? ` (le plus proche : « ${proches[0]} »)` : ''}`);
          continue;
        }
        const passe = execution.verdicts[test];
        if (passe !== (statut === 'tenue')) {
          bad.push(`${exigence} : la matrice dit « ${statut} », le test « ${test} » ${passe ? 'passe' : 'échoue'}`);
        }
      }
    }

    return joined(bad);
  },

  // ── La carte des données, confrontée au code ──────────────────────────────

  'data-classification': () => {
    const doc = needYaml<Record<string, unknown>>('privacy/data-classification.yaml');
    if ('error' in doc) return doc.error;

    const attendus = champsDuModele();
    if (attendus.length === 0) return 'aucun champ n’a pu être lu dans le modèle de données : la vérification ne peut pas se prononcer';

    const handles = equipeHandles();
    const champs = asArray(asRecord(doc.value).champs).map(asRecord);
    if (champs.length === 0) return 'la carte ne contient aucune entrée sous la clé `champs`';

    const bad: string[] = [];
    const vus = new Map<string, string>(); // « entité.champ » → sensibilité
    const attendusSet = new Set(attendus.map((a) => `${a.entite}.${a.champ}`));

    for (const c of champs) {
      const cle = `${asText(c.entite)}.${asText(c.champ)}`;
      if (!attendusSet.has(cle)) {
        bad.push(`« ${cle} » n’existe pas dans le modèle de données : la carte décrit un champ inventé`);
        continue;
      }
      if (vus.has(cle)) { bad.push(`${cle} est classé deux fois`); continue; }

      const sensibilite = asText(c.sensibilite);
      if (!SENSIBILITES.has(sensibilite)) {
        bad.push(`${cle} : « ${sensibilite || 'rien'} » n’est pas une sensibilité admise (${[...SENSIBILITES].join(' · ')})`);
        continue;
      }
      vus.set(cle, sensibilite);

      if (!handles.has(asText(c.proprietaire))) {
        bad.push(`${cle} : « ${asText(c.proprietaire) || 'rien'} » n’est pas une équipe de Novafact`);
      }
      if (!DUREE.test(asText(c.conservation))) {
        bad.push(`${cle} : la conservation doit être une durée (« 36 mois », « 3 ans », « duree-du-compte » ou « illimitee »)`);
      }

      const personnelle = asText(c['donnee-personnelle']);
      if (personnelle !== 'oui' && personnelle !== 'non') {
        bad.push(`${cle} : « donnee-personnelle » vaut oui ou non, pas « ${personnelle || 'rien'} »`);
      } else {
        const base = asText(c['base-legale']);
        if (personnelle === 'oui' && !BASES_LEGALES.has(base)) {
          bad.push(`${cle} : « ${base || 'rien'} » n’est pas une base légale du règlement (${[...BASES_LEGALES].join(' · ')})`);
        }
        if (personnelle === 'non' && base !== '' && base !== 'non-applicable') {
          bad.push(`${cle} : une donnée qui n’est pas personnelle n’a pas de base légale`);
        }
      }
    }

    const oublies = [...attendusSet].filter((c) => !vus.has(c));
    if (oublies.length) {
      bad.push(`${oublies.length} champ(s) du modèle ne sont pas classés : ${oublies.slice(0, 6).join(', ')}`);
    }
    // Le raccourci paresseux : tout classer « client » pour n'avoir rien à
    // protéger. Une application de facturation a des données internes.
    if (bad.length === 0 && ![...vus.values()].some((s) => NE_SORT_PAS.has(s))) {
      bad.push('aucun champ n’est classé interne ni secret : une application qui n’aurait que des données servies au client n’existe pas');
    }
    if (bad.length) return joined(bad);

    // ── Confrontation à ce que l'API renvoie vraiment ───────────────────────
    const resultat = run(
      'node',
      ['--import', 'tsx', path.join(FIXTURES, 'm07/harness.mjs'), 'champs'],
      { maxOutput: 400_000, timeoutMs: 120_000 },
    );
    if (resultat.timedOut) return 'le banc d’essai n’a pas terminé : impossible de confronter la carte aux réponses de l’API';

    const verdict = lastJson<{ erreur: string | null; champs: string[]; routes: string[] }>(resultat.output);
    if (!verdict) return `le banc d’essai n’a rien pu conclure :\n${resultat.output.slice(0, 600)}`;
    if (verdict.erreur) return verdict.erreur;
    if (verdict.routes.length === 0) return 'aucune route n’a répondu au banc d’essai : la confrontation ne peut pas se faire';

    const exposes = new Set(verdict.champs);
    const fuites = [...vus.entries()]
      .filter(([cle, s]) => NE_SORT_PAS.has(s) && exposes.has(cle.split('.')[1]))
      .map(([cle, s]) => `${cle} est classé « ${s} » mais apparaît dans une réponse de l’API`);
    if (fuites.length) {
      bad.push(...fuites, `routes sondées : ${verdict.routes.join(', ')}`);
    }

    return joined(bad);
  },

  // ── L'effacement qui efface pour de bon ───────────────────────────────────

  'erasure-test': () => {
    const politique = needYaml<Record<string, unknown>>('privacy/retention.yaml');
    if ('error' in politique) {
      return `${politique.error} — la politique de rétention se dépose dans \`workspace/privacy/retention.yaml\`, avant le test`;
    }
    const test = needText('verify/erasure.test.ts');
    if ('error' in test) return test.error;

    const bad: string[] = [];

    // ── La politique : une durée par classe de données ──────────────────────
    const classes = [...SENSIBILITES];
    const declarees = asRecord(asRecord(politique.value).conservation);
    for (const classe of classes) {
      const duree = asText(declarees[classe]);
      if (duree === '') bad.push(`la politique ne déclare aucune durée de conservation pour la classe « ${classe} »`);
      else if (!DUREE.test(duree)) {
        bad.push(`classe « ${classe} » : « ${duree} » n’est pas une durée (« 36 mois », « 3 ans », « duree-du-compte » ou « illimitee »)`);
      }
    }
    const inconnues = Object.keys(declarees).filter((c) => !SENSIBILITES.has(c));
    if (inconnues.length) bad.push(`classe(s) inconnue(s) dans la politique : ${inconnues.join(', ')}`);

    // ── Le test : les cinq magasins, et pas trois ───────────────────────────
    const magasins = fixtureYaml<{ magasins: { nom: string; contient: string }[] }>('m07/magasins.yaml').magasins;
    const etat = labText('server/store.ts') ?? '';
    const bloc = etat.match(/interface State \{([\s\S]*?)\n\}/)?.[1] ?? '';
    const disparus = magasins.filter((m) => !new RegExp(`^\\s*${m.nom}[?:]`, 'm').test(bloc)).map((m) => m.nom);
    if (disparus.length) {
      return `le(s) magasin(s) ${disparus.join(', ')} ne figurent plus dans le modèle : la vérification ne peut pas se prononcer`;
    }

    const code = stripComments(test.value);
    if (!/\bassert\b/.test(code)) {
      bad.push('le test ne contient aucune assertion : un test qui n’affirme rien ne cherche rien');
    }
    const nonCouverts = magasins.filter((m) => !new RegExp(`\\b${m.nom}\\b`).test(code)).map((m) => m.nom);
    if (nonCouverts.length) {
      bad.push(`le test ne cherche rien dans le(s) magasin(s) ${nonCouverts.join(', ')} — le droit à l’effacement porte sur toutes les copies`);
    }
    // Chaque magasin doit porter sa propre assertion : citer les cinq noms dans
    // un commentaire ou une seule ligne ne prouve pas qu'on a regardé.
    const sansAssertion = magasins
      .filter((m) => !code.split('\n').some((l) => /assert/.test(l) && new RegExp(`\\b${m.nom}\\b`).test(l)))
      .map((m) => m.nom);
    if (!nonCouverts.length && sansAssertion.length) {
      bad.push(`le(s) magasin(s) ${sansAssertion.join(', ')} sont cités mais aucune assertion ne porte dessus`);
    }
    // Et le test doit chercher une valeur identifiante, pas un drapeau.
    if (!/@/.test(code)) {
      bad.push('le test ne cherche aucune valeur identifiante du compte supprimé (une adresse, par exemple) : chercher un drapeau « supprimé » ne prouve pas que la donnée est partie');
    }

    return joined(bad);
  },

  // ── Ce que la conformité impose vraiment ──────────────────────────────────

  'compliance-matrix': () => {
    const doc = needYaml<Record<string, unknown>>('requirements/compliance.yaml');
    if ('error' in doc) return doc.error;

    const reglement = fixtureYaml<{
      obligations: { id: string; texte: string }[];
      approfondies: Record<string, string>;
    }>('m07/obligations.yaml');
    const attendues = new Map(reglement.obligations.map((o) => [o.id, o]));

    const lignes = asArray(asRecord(doc.value).obligations).map(asRecord);
    if (lignes.length === 0) return 'la matrice ne contient aucune entrée sous la clé `obligations`';

    const bad: string[] = [];
    const vues = new Set<string>();
    const controles = new Set<string>();

    for (const l of lignes) {
      const id = asText(l.id);
      if (!attendues.has(id)) { bad.push(`l’obligation « ${id || '(sans nom)'} » n’existe pas dans le référentiel`); continue; }
      if (vues.has(id)) { bad.push(`l’obligation ${id} est traitée deux fois`); continue; }
      vues.add(id);

      const controle = asText(l['controle-technique']);
      if (controle.length < 40) {
        bad.push(`${id} : le contrôle technique n’est pas décrit (au moins 40 caractères) — une exigence sans contrôle est une case cochée`);
      } else if (controles.has(controle)) {
        bad.push(`${id} : le contrôle technique est recopié d’une autre obligation`);
      } else controles.add(controle);

      const couverte = asText(l.couverte);
      if (couverte !== 'oui' && couverte !== 'non') {
        bad.push(`${id} : « couverte » vaut oui ou non, pas « ${couverte || 'rien'} »`);
        continue;
      }
      if (couverte === 'non') {
        if (asText(l.plan).length < 30) bad.push(`${id} : obligation non couverte sans plan écrit`);
        continue;
      }

      const preuves = asArray(l.preuves).map(asText).filter(Boolean);
      if (preuves.length === 0) { bad.push(`${id} : obligation déclarée couverte sans preuve — un contrôle sans preuve est une intention`); continue; }
      const absentes = preuves.filter((p) => !labExists(p) && !wsExists(p.replace(/^workspace\//, '')));
      if (absentes.length) {
        bad.push(`${id} : ${absentes.map((p) => `\`${p}\``).join(', ')} n’existe pas`);
        continue;
      }

      // Sur trois obligations, la preuve doit établir ce qu'elle prétend.
      if (id in reglement.approfondies) {
        const contenus = preuves.map((p) => labText(p) ?? wsText(p.replace(/^workspace\//, '')) ?? '');
        const ok = contenus.some((texte) => {
          if (id === 'PCI-6.4.3') {
            // L'inventaire doit nommer les scripts que la page de paiement charge.
            const page = stripComments(labText('src/pages/Checkout.tsx') ?? '');
            const pilote = [...page.matchAll(/\b([A-Za-z]+Url)\b/g)].map((m) => m[1]);
            return pilote.length > 0 && pilote.some((nom) => texte.includes(nom)) && /script/i.test(texte);
          }
          if (id === 'RGPD-5.1.e') {
            return /conservation/i.test(texte) && DUREE.test(
              (texte.match(/^\s*(?:public|client|interne|secret)\s*:\s*(.+)$/m)?.[1] ?? '').trim(),
            );
          }
          // CRA-14 : un exécutable, pas un document.
          return /\.(mjs|js|ts)$/.test(preuves[contenus.indexOf(texte)] ?? '') && /process\.argv/.test(texte);
        });
        if (!ok) bad.push(`${id} : ${reglement.approfondies[id]} — la preuve citée ne l’établit pas`);
      }
    }

    const oubliees = [...attendues.keys()].filter((id) => !vues.has(id));
    if (oubliees.length) {
      bad.push(`${oubliees.length} obligation(s) du référentiel ne sont pas traitées : ${oubliees.slice(0, 5).join(', ')}`);
    }

    return joined(bad);
  },

  // ── Recertifier les accès ─────────────────────────────────────────────────

  'access-recertification': () => {
    const fichier = needText('requirements/access-review.csv');
    if ('error' in fichier) return fichier.error;

    const inventaire = fixtureJson<{
      periode: { du: string; au: string };
      comptes: { identifiant: string; droits: string[] }[];
    }>('m07/comptes.json');
    const journal = fixtureJson<{ evenements: { at: string; identifiant: string; droit: string }[] }>(
      'm07/journal-acces.json',
    );

    const du = Date.parse(inventaire.periode.du);
    const au = Date.parse(inventaire.periode.au);

    // La réponse : le dernier exercice de chaque droit DANS la période.
    const dernier = new Map<string, number>();
    for (const e of journal.evenements) {
      const t = Date.parse(e.at);
      if (Number.isNaN(t) || t < du || t > au) continue;
      const k = `${e.identifiant}|${e.droit}`;
      if (!dernier.has(k) || dernier.get(k)! < t) dernier.set(k, t);
    }

    const attendus = new Map<string, { utilise: string | null }>();
    for (const c of inventaire.comptes) {
      for (const droit of c.droits) {
        const k = `${c.identifiant}|${droit}`;
        const t = dernier.get(k);
        attendus.set(k, { utilise: t === undefined ? null : new Date(t).toISOString().slice(0, 10) });
      }
    }

    const { header, rows } = parseCsv(fichier.value);
    const colonnes = ['compte', 'droit', 'derniere-utilisation', 'decision'];
    const absentes = colonnes.filter((c) => !header.includes(c));
    if (absentes.length) return `l’en-tête du CSV doit porter les colonnes ${colonnes.join(', ')} — il manque ${absentes.join(', ')}`;

    const bad: string[] = [];
    const vus = new Set<string>();

    for (const row of rows) {
      const k = `${row.compte}|${row.droit}`;
      const attendu = attendus.get(k);
      if (!attendu) { bad.push(`${row.compte} n’a pas le droit « ${row.droit} » : la revue porte sur les droits accordés`); continue; }
      if (vus.has(k)) { bad.push(`${row.compte} / ${row.droit} apparaît deux fois`); continue; }
      vus.add(k);

      const decision = row.decision;
      if (decision !== 'conserver' && decision !== 'retirer') {
        bad.push(`${row.compte} / ${row.droit} : la décision vaut conserver ou retirer, pas « ${decision || 'rien'} »`);
        continue;
      }
      const attendue = attendu.utilise === null ? 'retirer' : 'conserver';
      if (decision !== attendue) {
        bad.push(attendue === 'retirer'
          ? `${row.compte} / ${row.droit} : ce droit n’a pas servi sur la période, il se retire`
          : `${row.compte} / ${row.droit} : ce droit a servi le ${attendu.utilise}, le retirer casserait un usage réel`);
        continue;
      }

      const declaree = (row['derniere-utilisation'] ?? '').trim();
      if (attendu.utilise === null) {
        if (declaree !== '' && declaree !== '-' && declaree.toLowerCase() !== 'jamais') {
          bad.push(`${row.compte} / ${row.droit} : aucune utilisation sur la période, « ${declaree} » sort d’où ?`);
        }
      } else if (declaree !== attendu.utilise) {
        bad.push(`${row.compte} / ${row.droit} : dernière utilisation le ${attendu.utilise}, le relevé dit « ${declaree || 'rien'} »`);
      }
    }

    const oublies = [...attendus.keys()].filter((k) => !vus.has(k));
    if (oublies.length) {
      bad.push(`${oublies.length} couple(s) compte/droit absents de la revue : ${oublies.slice(0, 4).map((k) => k.replace('|', ' / ')).join(' · ')}`);
    }

    return joined(bad);
  },
};

// Le livrable d'effacement cite un fichier de test qui n'existe pas encore dans
// le dépôt : la fonction ci-dessous garde le message d'absence uniforme.
export const cheminEffacement = () => missing('verify/erasure.test.ts');

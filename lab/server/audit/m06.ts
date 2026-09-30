// Vérifications des challenges M6 · Faire adopter la sécurité.
//
// Le module le plus rétif au lab, et il faut le dire franchement : négocier
// avec le produit et traduire un risque pour une direction NE SE VÉRIFIENT PAS.
// Une charte de champions, un modèle FAIR, un argumentaire de priorisation se
// jugent sur des estimations d'expert — c'est-à-dire précisément sur le
// jugement qu'on voudrait évaluer. Ces leçons restent au site.
//
// Ce qui suit est ce qui reste, et qui se vérifie vraiment :
//
//   · un constat se juge sur sa PRÉCISION — le fichier, la ligne, la classe,
//     le correctif qui s'applique. Pas sur sa prose ;
//   · un exercice de formation se juge par DOUBLE PASSAGE local : le test
//     produit doit échouer contre l'extrait vulnérable et passer contre son
//     correctif, les deux étant fournis par l'apprenant ;
//   · un routage de revue se juge par DOUBLE CRITÈRE — les chemins sensibles
//     vers la sécurité, et un fichier ordinaire qui n'y va pas ;
//   · un cadrage de pentest se confronte à la configuration réelle.
//
// Les vérifications de ce module réutilisent les outils exportés par m01.ts.

import fs from 'node:fs';
import path from 'node:path';
import Ajv from 'ajv';
import { exerciseById } from '../../shared/exercises.ts';
import { LAB_ROOT, missing, run, wsText } from './workspace.ts';
import {
  asArray, asNumber, asRecord, asText, equipeHandles, fixtureYaml, joined,
  labText, needText, needYaml, organisation, stripComments, uniq, withTempDir,
  type Check,
} from './m01.ts';

// ── SARIF ───────────────────────────────────────────────────────────────────
//
// Le schéma officiel fait plusieurs milliers de lignes. Celui-ci ne retient que
// ce dont un constat a besoin pour être actionnable : un outil qui se nomme, un
// résultat qui porte une règle, un niveau, un message, un emplacement précis au
// fichier et à la ligne, et un correctif qui s'applique.

const SARIF_SCHEMA = {
  type: 'object',
  required: ['version', 'runs'],
  properties: {
    version: { const: '2.1.0' },
    runs: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['tool', 'results'],
        properties: {
          tool: {
            type: 'object',
            required: ['driver'],
            properties: {
              driver: {
                type: 'object',
                required: ['name'],
                properties: { name: { type: 'string', minLength: 1 } },
              },
            },
          },
          results: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              required: ['ruleId', 'level', 'message', 'locations'],
              properties: {
                ruleId: { type: 'string', minLength: 1 },
                level: { enum: ['error', 'warning', 'note', 'none'] },
                message: {
                  type: 'object',
                  required: ['text'],
                  properties: { text: { type: 'string', minLength: 20 } },
                },
                locations: {
                  type: 'array',
                  minItems: 1,
                  items: {
                    type: 'object',
                    required: ['physicalLocation'],
                    properties: {
                      physicalLocation: {
                        type: 'object',
                        required: ['artifactLocation', 'region'],
                        properties: {
                          artifactLocation: {
                            type: 'object',
                            required: ['uri'],
                            properties: { uri: { type: 'string', minLength: 1 } },
                          },
                          region: {
                            type: 'object',
                            required: ['startLine'],
                            properties: { startLine: { type: 'integer', minimum: 1 } },
                          },
                        },
                      },
                    },
                  },
                },
                fixes: {
                  type: 'array',
                  minItems: 1,
                  items: {
                    type: 'object',
                    required: ['artifactChanges'],
                    properties: {
                      artifactChanges: {
                        type: 'array',
                        minItems: 1,
                        items: {
                          type: 'object',
                          required: ['artifactLocation', 'replacements'],
                          properties: {
                            artifactLocation: {
                              type: 'object',
                              required: ['uri'],
                              properties: { uri: { type: 'string' } },
                            },
                            replacements: {
                              type: 'array',
                              minItems: 1,
                              items: {
                                type: 'object',
                                required: ['deletedRegion', 'insertedContent'],
                                properties: {
                                  deletedRegion: {
                                    type: 'object',
                                    required: ['startLine'],
                                    properties: {
                                      startLine: { type: 'integer', minimum: 1 },
                                      endLine: { type: 'integer', minimum: 1 },
                                    },
                                  },
                                  insertedContent: {
                                    type: 'object',
                                    required: ['text'],
                                    properties: { text: { type: 'string' } },
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
} as const;

// Ajv est publié en CommonJS : le constructeur traverse l'interop en `default`.
const AjvCtor = (Ajv as unknown as { default?: typeof Ajv }).default ?? Ajv;
const ajv = new AjvCtor({ allErrors: true, strict: false });
const valideSarif = ajv.compile(SARIF_SCHEMA as unknown as object);

/**
 * L'emplacement du défaut, CALCULÉ depuis la source.
 *
 * Coder la ligne en dur ferait échouer la vérification à la première
 * reformatage du fichier, et surtout : le harnais doit savoir où est le défaut
 * pour la même raison que l'apprenant, en le lisant.
 */
function sinkBola(): { fichier: string; ligne: number; debut: number; fin: number } | null {
  const fichier = exerciseById('bola-invoice')?.file ?? 'server/routes/invoices.ts';
  const source = labText(fichier);
  if (source === null) return null;
  const lignes = source.split('\n');

  const debut = lignes.findIndex((l) => /invoiceRoutes\.get\(\s*['"]\/:id['"]/.test(l));
  if (debut === -1) return null;
  // Fin du gestionnaire : le premier `});` à la colonne 0 après la déclaration.
  let fin = lignes.findIndex((l, i) => i > debut && /^\}\);/.test(l));
  if (fin === -1) fin = lignes.length - 1;

  // Le sink : la ligne qui charge la facture sans regarder à qui elle est.
  const ligne = lignes.findIndex((l, i) => i > debut && i < fin && /db\.invoices\.find\(/.test(l));
  return ligne === -1 ? null : { fichier, ligne: ligne + 1, debut: debut + 1, fin: fin + 1 };
}

// ── Résolution CODEOWNERS ───────────────────────────────────────────────────
//
// La vraie règle de GitHub : la DERNIÈRE règle qui correspond l'emporte. C'est
// contre-intuitif et c'est la source d'erreur numéro un des fichiers CODEOWNERS
// — une règle générale placée en bas annule toutes les règles précises.

interface RegleOwners { pattern: string; owners: string[] }

function reglesOwners(raw: string): RegleOwners[] {
  return raw
    .split('\n')
    .map((l) => l.replace(/#.*$/, '').trim())
    .filter(Boolean)
    .map((l) => {
      const [pattern, ...owners] = l.split(/\s+/);
      return { pattern, owners };
    });
}

function correspond(pattern: string, fichier: string): boolean {
  if (pattern === '*' || pattern === '**') return true;
  const p = pattern.replace(/^\//, '');
  if (p.endsWith('/')) return fichier.startsWith(p);
  const rx = new RegExp(
    `^${p
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*\*/g, '\u0000')
      .replace(/\*/g, '[^/]*')
      .replace(/\u0000/g, '.*')}$`,
  );
  return rx.test(fichier) || fichier.startsWith(`${p}/`);
}

const proprietairesDe = (regles: RegleOwners[], fichier: string): string[] =>
  regles.filter((r) => correspond(r.pattern, fichier)).slice(-1)[0]?.owners ?? [];

/**
 * Les chemins sensibles, DÉDUITS du code plutôt que listés.
 *
 * Trois familles : le socle d'authentification, tout ce qui s'en sert, et tout
 * ce qui décide d'un privilège. La liste bouge donc avec le code — c'est le
 * but : un fichier qui se met à lire `req.user.role` doit se mettre à passer
 * par la sécurité, sans que personne ait à y penser.
 */
export function cheminsSensibles(): string[] {
  const sensibles: string[] = [];

  const lib = path.join(LAB_ROOT, 'server/lib');
  if (fs.existsSync(lib)) {
    for (const f of fs.readdirSync(lib)) if (f.endsWith('.ts')) sensibles.push(`server/lib/${f}`);
  }

  const routes = path.join(LAB_ROOT, 'server/routes');
  if (fs.existsSync(routes)) {
    for (const f of fs.readdirSync(routes)) {
      if (!f.endsWith('.ts') || f === 'lab.ts') continue;
      const code = stripComments(fs.readFileSync(path.join(routes, f), 'utf8'));
      const utiliseLeJeton = /from\s+['"]\.\.\/lib\/jwt\.ts['"]/.test(code);
      const decideDunPrivilege = /req\.user!?\.role\s*[!=]==/.test(code);
      if (utiliseLeJeton || decideDunPrivilege) sensibles.push(`server/routes/${f}`);
    }
  }

  const workflows = path.join(LAB_ROOT, 'novafact/.github/workflows');
  if (fs.existsSync(workflows)) {
    for (const f of fs.readdirSync(workflows)) sensibles.push(`novafact/.github/workflows/${f}`);
  }

  return sensibles;
}

/**
 * Des fichiers qui n'ont rien de sensible : le second critère du routage.
 *
 * Ils se déduisent eux aussi du code — une route qui ne touche ni au jeton ni
 * au rôle n'a pas à encombrer la file de l'AppSec. Les carter en dur ferait que
 * la vérification se tromperait dès qu'une route change de nature.
 */
export function cheminsOrdinaires(): string[] {
  const ordinaires = ['src/pages/Invoices.tsx', 'src/pages/Mails.tsx', 'README.md'];
  const sensibles = new Set(cheminsSensibles());
  const routes = path.join(LAB_ROOT, 'server/routes');
  if (fs.existsSync(routes)) {
    const banales = fs.readdirSync(routes)
      .filter((f) => f.endsWith('.ts') && f !== 'lab.ts' && !sensibles.has(`server/routes/${f}`))
      .sort()
      .slice(0, 2);
    ordinaires.push(...banales.map((f) => `server/routes/${f}`));
  }
  return ordinaires.filter((f) => fs.existsSync(path.join(LAB_ROOT, f)));
}

// ── Rôles du modèle de données ──────────────────────────────────────────────

/** Les rôles réellement déclarés par le modèle, extraits de server/store.ts. */
export function rolesDuModele(): string[] {
  const source = labText('server/store.ts') ?? '';
  const interfaceUser = source.match(/interface User \{[\s\S]*?\}/)?.[0] ?? '';
  const ligne = interfaceUser.match(/role:\s*([^;]+);/)?.[1] ?? '';
  return uniq([...ligne.matchAll(/'([a-z]+)'/g)].map((m) => m[1]));
}

// ── Vérifications ───────────────────────────────────────────────────────────

export const m06Checks: Record<string, Check> = {
  // ── Le finding à la bonne ligne ───────────────────────────────────────────

  'finding-sarif': () => {
    const brut = wsText('findings/bola-invoice.sarif');
    if (brut === null) return missing('findings/bola-invoice.sarif');
    if (brut.trim() === '') return 'le livrable `workspace/findings/bola-invoice.sarif` est vide';

    let doc: unknown;
    try {
      doc = JSON.parse(brut);
    } catch (err) {
      return `le livrable \`workspace/findings/bola-invoice.sarif\` n’est pas du JSON valide (${(err as Error).message.split('\n')[0]})`;
    }

    if (!valideSarif(doc)) {
      const erreurs = (valideSarif.errors ?? [])
        .slice(0, 4)
        .map((e) => `${e.instancePath || '(racine)'} ${e.message}`);
      return `le document n’est pas un SARIF exploitable : ${erreurs.join(' · ')}`;
    }

    const sink = sinkBola();
    if (sink === null) return 'le défaut visé est introuvable dans le code : la vérification ne peut pas se prononcer';

    const exercice = exerciseById('bola-invoice')!;
    const runs = asArray(asRecord(doc).runs).map(asRecord);
    const resultats = runs.flatMap((r) => asArray(r.results).map(asRecord));

    const bad: string[] = [];

    // Le constat qui désigne le bon fichier. C'est lui qu'on examine ensuite.
    const vise = resultats.find((r) =>
      asArray(r.locations).map(asRecord).some((l) => {
        const phys = asRecord(l.physicalLocation);
        return asText(asRecord(phys.artifactLocation).uri).replace(/^\.\//, '') === sink.fichier;
      }));

    if (!vise) {
      const uris = resultats.flatMap((r) =>
        asArray(r.locations).map(asRecord).map((l) => asText(asRecord(asRecord(l.physicalLocation).artifactLocation).uri)));
      return `aucun résultat ne désigne \`${sink.fichier}\` — le constat pointe ${uris.length ? uris.map((u) => `\`${u}\`` ).join(', ') : 'nulle part'}`;
    }

    const emplacement = asArray(vise.locations).map(asRecord)
      .map((l) => asRecord(l.physicalLocation))
      .find((p) => asText(asRecord(p.artifactLocation).uri).replace(/^\.\//, '') === sink.fichier)!;
    const ligne = asNumber(asRecord(emplacement.region).startLine) ?? 0;
    if (Math.abs(ligne - sink.ligne) > 2) {
      bad.push(`la ligne ${ligne} ne tombe pas sur le point d’entrée du défaut (attendu autour de la ligne ${sink.ligne}, dans le gestionnaire des lignes ${sink.debut} à ${sink.fin})`);
    }

    const classe = `${asText(vise.ruleId)} ${JSON.stringify(vise.properties ?? {})}`.toUpperCase();
    if (!classe.includes(exercice.cwe.toUpperCase())) {
      bad.push(`la classe de bug n’est pas nommée : ni \`ruleId\` ni \`properties\` ne portent ${exercice.cwe}`);
    }
    if (asText(vise.level) === 'note' || asText(vise.level) === 'none') {
      bad.push('un accès non autorisé aux données d’un autre client ne se signale pas en « note »');
    }

    // ── Le correctif proposé est APPLIQUÉ ───────────────────────────────────
    const correctifs = asArray(vise.fixes).map(asRecord);
    if (correctifs.length === 0) {
      bad.push('aucun `fixes` : un constat qui n’arrive pas avec son correctif se discute au lieu de se corriger');
      return joined(bad);
    }

    const source = labText(sink.fichier)!;
    const lignes = source.split('\n');
    let patch = lignes.slice();
    let applique = false;
    let toucheLeSink = false;
    /** Le filtre doit être INTRODUIT par le correctif, pas déjà présent ailleurs. */
    const introduitLeFiltre = (texte: string) => {
      const code = stripComments(texte);
      return /tenantId[^\n;]*req\.user/.test(code) || /req\.user[^\n;]*tenantId/.test(code);
    };
    let filtreIntroduit = false;

    for (const correctif of correctifs) {
      for (const changement of asArray(correctif.artifactChanges).map(asRecord)) {
        const uri = asText(asRecord(changement.artifactLocation).uri).replace(/^\.\//, '');
        if (uri !== sink.fichier) {
          bad.push(`le correctif porte sur \`${uri}\`, pas sur le fichier fautif`);
          continue;
        }
        // Du bas vers le haut : appliquer dans l'ordre décalerait les suivantes.
        const remplacements = asArray(changement.replacements).map(asRecord)
          .map((r) => ({
            debut: asNumber(asRecord(r.deletedRegion).startLine) ?? 0,
            fin: asNumber(asRecord(r.deletedRegion).endLine) ?? asNumber(asRecord(r.deletedRegion).startLine) ?? 0,
            texte: asText(asRecord(r.insertedContent).text),
          }))
          .sort((a, b) => b.debut - a.debut);

        for (const r of remplacements) {
          if (r.debut < 1 || r.fin > lignes.length || r.fin < r.debut) {
            bad.push(`le remplacement porte sur les lignes ${r.debut}–${r.fin}, hors du fichier`);
            continue;
          }
          if (r.texte.trim() === '') {
            bad.push('le correctif proposé supprime du code sans rien mettre à la place');
            continue;
          }
          patch = [...patch.slice(0, r.debut - 1), ...r.texte.split('\n'), ...patch.slice(r.fin)];
          applique = true;
          if (r.debut <= sink.ligne + 2 && r.fin >= sink.ligne - 2) toucheLeSink = true;
          if (introduitLeFiltre(r.texte)) filtreIntroduit = true;
        }
      }
    }
    if (!applique) return joined(bad) ?? 'aucun remplacement applicable dans le correctif proposé';

    const patchStr = patch.join('\n');
    if (patchStr === source) bad.push('le correctif proposé ne change rien au fichier');
    if (!toucheLeSink) {
      bad.push(`le correctif ne touche pas le point d’entrée du défaut (ligne ${sink.ligne}) : il corrige autre chose`);
    }
    // Le filtre doit venir du correctif. Le fichier livré contient déjà une
    // comparaison de tenant — c'est l'instrumentation du lab, sur le chemin de
    // la violation. La lire ne prouverait donc rien.
    if (!filtreIntroduit) {
      bad.push('le texte inséré par le correctif ne fait dépendre la lecture d’aucune comparaison entre le tenant de la facture et celui de l’appelant');
    }

    const corrige = stripComments(patchStr);
    const debut = corrige.split('\n').findIndex((l) => /invoiceRoutes\.get\(\s*['"]\/:id['"]/.test(l));
    const gestionnaire = debut === -1 ? '' : corrige.split('\n').slice(debut, debut + 40).join('\n');
    // Le second critère : un correctif qui casse la route n'est pas un correctif.
    if (!/res\.json\(/.test(gestionnaire)) {
      bad.push('une fois appliqué, le gestionnaire ne répond plus rien — le correctif casse la fonctionnalité au lieu de la cloisonner');
    }

    return joined(bad);
  },

  // ── Router la revue vers les bonnes personnes ─────────────────────────────

  'codeowners-sensitive': () => {
    const fichier = needText('.github/CODEOWNERS');
    if ('error' in fichier) return fichier.error;

    const regles = reglesOwners(fichier.value);
    if (regles.length === 0) return 'le fichier ne contient aucune règle exploitable';

    const { securite } = organisation();
    const handles = equipeHandles();
    const bad: string[] = [];

    const inconnus = uniq(regles.flatMap((r) => r.owners)).filter((o) => !handles.has(o));
    if (inconnus.length) {
      bad.push(`${inconnus.join(', ')} n’est pas une équipe de Novafact — une revue routée vers une équipe qui n’existe pas n’est pas routée`);
    }

    const sensibles = cheminsSensibles();
    const orphelins = sensibles.filter((f) => !proprietairesDe(regles, f).includes(securite));
    if (orphelins.length) {
      bad.push(`${orphelins.length} chemin(s) sensible(s) ne résolvent pas vers ${securite} : ${orphelins.slice(0, 4).join(', ')}`);
    }

    // Le second critère : la règle paresseuse « tout à la sécurité » garantit
    // surtout que plus rien n'est relu sérieusement.
    const ordinaires = cheminsOrdinaires();
    const surcharges = ordinaires.filter((f) => proprietairesDe(regles, f).includes(securite));
    if (surcharges.length) {
      bad.push(`${surcharges.join(', ')} est aussi routé vers ${securite} : la règle est trop large`);
    }
    // Et le troisième : un fichier ordinaire doit quand même avoir un relecteur.
    const sansPersonne = ordinaires.filter((f) => proprietairesDe(regles, f).length === 0);
    if (sansPersonne.length) {
      bad.push(`${sansPersonne.join(', ')} n’a aucun propriétaire — il faut une règle par défaut en tête de fichier`);
    }

    return joined(bad);
  },

  // ── Former à partir d'un vrai bug ─────────────────────────────────────────

  'training-from-bug': () => {
    const base = 'training/mass-assignment';
    const attendus = [`${base}/vulnerable.ts`, `${base}/corrige.ts`, `${base}/exercice.test.ts`];
    for (const rel of attendus) {
      const f = needText(rel);
      if ('error' in f) return f.error;
    }

    const vulnerable = stripComments(wsText(`${base}/vulnerable.ts`)!);
    const corrige = stripComments(wsText(`${base}/corrige.ts`)!);
    const test = wsText(`${base}/exercice.test.ts`)!;
    const bad: string[] = [];

    // L'extrait doit porter la classe de bug que l'équipe vient d'introduire,
    // pas une autre. Sinon l'exercice enseigne autre chose.
    const fusionAveugle = /Object\.assign\s*\(/.test(vulnerable) || /\{\s*\.\.\.[A-Za-z_$][\w$]*\s*\.\.\./.test(vulnerable)
      || /\.\.\.(corps|body|donnees|entree|payload|req\.body)\b/.test(vulnerable);
    if (!fusionAveugle) {
      bad.push('l’extrait vulnérable ne fusionne aucune entrée dans l’entité : ce n’est pas un mass assignment');
    }
    if (/Object\.assign\s*\(/.test(corrige) || /\.\.\.(corps|body|donnees|entree|payload|req\.body)\b/.test(corrige)) {
      bad.push('le correctif fusionne encore l’entrée brute : c’est le même défaut, écrit autrement');
    }
    if (!/\bassert\b/.test(stripComments(test))) {
      bad.push('l’exercice ne contient aucune assertion : un test qui n’affirme rien ne sépare rien');
    }
    if (bad.length) return joined(bad);

    // ── Double passage, local ───────────────────────────────────────────────
    // Les deux modules sont recopiés sous des noms tirés au hasard : un test
    // qui regarderait le nom de sa cible plutôt que son comportement échoue.
    return withTempDir('novafact-training-', (dir) => {
      const jeton = Math.random().toString(36).slice(2, 10);
      const cibles = {
        vulnerable: path.join(dir, `cible-${jeton}-a.ts`),
        corrige: path.join(dir, `cible-${jeton}-b.ts`),
      };
      fs.writeFileSync(cibles.vulnerable, wsText(`${base}/vulnerable.ts`)!);
      fs.writeFileSync(cibles.corrige, wsText(`${base}/corrige.ts`)!);
      const fichierTest = path.join(dir, `exercice-${jeton}.test.ts`);
      fs.writeFileSync(fichierTest, test);
      // Sans ça, le dossier temporaire est hors de toute arborescence de paquet
      // et les modules y seraient transformés en CommonJS — l'import
      // dynamique du test échouerait pour une raison sans rapport avec lui.
      fs.writeFileSync(path.join(dir, 'package.json'), '{ "type": "module" }\n');

      const passe = (cible: string) =>
        run('node', ['--import', 'tsx', '--test', '--test-reporter=tap', fichierTest], {
          timeoutMs: 60_000,
          env: { CIBLE: cible },
        });

      const contre = passe(cibles.vulnerable);
      if (contre.timedOut) return 'l’exercice ne termine pas contre l’extrait vulnérable';
      if (contre.ok) {
        return 'l’exercice passe déjà contre l’extrait vulnérable : il ne sépare pas le défaut de son correctif, il vérifie seulement que la fonction rend quelque chose';
      }

      const avec = passe(cibles.corrige);
      if (avec.timedOut) return 'l’exercice ne termine pas contre le correctif';
      if (!avec.ok) {
        return `l’exercice échoue aussi contre le correctif : il casse le comportement légitime au lieu d’isoler le défaut\n${avec.output.slice(0, 500)}`;
      }

      // Deux tests au moins : celui qui attrape le défaut, et celui qui vérifie
      // que la fonction rend toujours le service attendu.
      const nb = Number(avec.output.match(/^#\s*tests?\s+(\d+)/m)?.[1] ?? '0');
      if (nb < 2) {
        return `l’exercice ne contient que ${nb} test : il en faut au moins deux, celui qui attrape le défaut et celui qui vérifie que le comportement légitime tient toujours`;
      }
      return null;
    });
  },

  // ── Cadrer un test d'intrusion ────────────────────────────────────────────

  'pentest-scope': () => {
    const doc = needYaml<Record<string, unknown>>('pentest/scope.yaml');
    if ('error' in doc) return doc.error;
    const racine = asRecord(doc.value);
    const bad: string[] = [];

    const environnements = fixtureYaml<{ environnements: { hote: string; production: boolean }[] }>(
      'm06/environnements.yaml',
    ).environnements;
    const connus = new Map(environnements.map((e) => [e.hote, e]));
    const production = environnements.filter((e) => e.production).map((e) => e.hote);

    const hotesDe = (cle: string) =>
      asArray(racine[cle]).map((v) => (typeof v === 'string' ? v : asText(asRecord(v).hote)))
        .map((h) => h.replace(/^https?:\/\//, '').replace(/\/$/, ''))
        .filter(Boolean);

    const perimetre = hotesDe('perimetre');
    const exclusions = hotesDe('exclusions');

    if (perimetre.length === 0) bad.push('aucun hôte dans le `perimetre` : il n’y a rien à tester');
    const inventes = perimetre.filter((h) => !connus.has(h));
    if (inventes.length) {
      bad.push(`${inventes.join(', ')} ne figure dans aucun environnement déclaré de Novafact`);
    }
    // Le double critère : la production est hors limites, et il faut le dire —
    // pas seulement ne pas la mettre dans le périmètre.
    const dansLePerimetre = production.filter((h) => perimetre.includes(h));
    if (dansLePerimetre.length) {
      bad.push(`${dansLePerimetre.join(', ')} est un hôte de production : il n’a rien à faire dans le périmètre`);
    }
    const nonExclus = production.filter((h) => !exclusions.includes(h));
    if (nonExclus.length) {
      bad.push(`${nonExclus.join(', ')} n’apparaît pas dans les exclusions : ce qui n’est pas écrit n’a pas été dit au prestataire`);
    }

    // Les comptes : un rôle du modèle de données sans compte fourni, c'est une
    // partie de l'application que personne ne testera.
    const roles = rolesDuModele();
    const comptes = asArray(racine.comptes).map(asRecord);
    const fournis = new Set(comptes.map((c) => asText(c.role)));
    const inconnus = [...fournis].filter((r) => r && !roles.includes(r));
    if (inconnus.length) bad.push(`${inconnus.join(', ')} n’est pas un rôle du modèle de données (${roles.join(' · ')})`);
    const manquants = roles.filter((r) => !fournis.has(r));
    if (manquants.length) bad.push(`aucun compte fourni pour le(s) rôle(s) ${manquants.join(', ')}`);
    const sansIdentifiant = comptes.filter((c) => asText(c.identifiant) === '').map((c) => asText(c.role));
    if (sansIdentifiant.length) bad.push(`le(s) compte(s) ${sansIdentifiant.join(', ')} n’ont pas d’identifiant : « on vous les créera » veut dire « vous perdrez la matinée de lundi »`);

    // La fenêtre et le retest.
    const periode = asRecord(racine.periode);
    const du = asText(periode.du);
    const au = asText(periode.au);
    const date = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? Date.parse(v) : NaN);
    if (Number.isNaN(date(du)) || Number.isNaN(date(au))) {
      bad.push('la `periode` doit porter deux dates AAAA-MM-JJ (`du` et `au`)');
    } else if (date(du) >= date(au)) {
      bad.push('la fenêtre de test se termine avant de commencer');
    }

    const retest = asRecord(racine.retest);
    const dateRetest = asText(retest.date);
    if (Number.isNaN(date(dateRetest))) bad.push('le retest n’est pas daté — un retest « quand on aura le temps » n’a jamais lieu');
    else if (!Number.isNaN(date(au)) && date(dateRetest) <= date(au)) {
      bad.push('le retest est daté avant la fin du test initial');
    }
    if (asText(retest.modalite).length < 30) {
      bad.push('la modalité du retest n’est pas écrite : qui revérifie quoi, sur quel périmètre, et compris dans quel budget');
    }

    const brutes = asArray(racine['conditions-arret']);
    const arrets = brutes.map(asText).filter(Boolean);
    if (brutes.length > arrets.length) {
      bad.push('une condition d’arrêt n’est pas une chaîne — un deux-points dans une valeur YAML non quotée ouvre une table : mets-la entre guillemets');
    }
    if (arrets.length < 3) bad.push(`${arrets.length} condition(s) d’arrêt : il en faut au moins trois, et elles doivent dire quoi faire, pas seulement quand s’arrêter`);
    const trop_courtes = arrets.filter((a) => a.length < 30);
    if (trop_courtes.length) bad.push(`${trop_courtes.length} condition(s) d’arrêt tiennent en moins de 30 caractères`);

    if (asText(racine.prestataire) === '') bad.push('le prestataire n’est pas nommé');

    return joined(bad);
  },
};

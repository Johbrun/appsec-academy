// Livrable de référence — challenge training-from-bug (M6), le test qui sépare.
//
// Le même test s'exécute contre les deux extraits : sa cible lui arrive par
// l'environnement. C'est ce qui permet de faire vivre l'exercice — on donne
// `vulnerable.ts` à l'apprenant, il doit le faire passer au vert sans casser le
// second test.
//
// Deux tests, et il en faut deux : le premier attrape le défaut, le second
// vérifie que la fonction rend toujours le service attendu. Avec le premier
// seul, « ne rien écrire du tout » passerait — et on aurait enseigné à casser
// la fonctionnalité.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const cible = process.env.CIBLE ?? new URL('./vulnerable.ts', import.meta.url).pathname;
const { majProfil } = (await import(cible)) as typeof import('./vulnerable.ts');

const utilisateur = () => ({
  id: 'u1',
  email: 'dev@acme.example',
  nom: 'Toi',
  role: 'user' as const,
  tenantId: 'acme',
});

describe('mass assignment · mise à jour du profil', () => {
  it('n’écrit pas un champ que le client n’a pas à écrire', () => {
    const u = utilisateur();
    majProfil(u, { nom: 'Nouveau nom', role: 'admin', tenantId: 'globex' });
    assert.equal(u.role, 'user', 'le rôle a été écrit depuis le corps de la requête');
    assert.equal(u.tenantId, 'acme', 'l’appartenance a été écrite depuis le corps de la requête');
  });

  it('modifie toujours le champ prévu', () => {
    const u = utilisateur();
    majProfil(u, { nom: 'Nouveau nom' });
    assert.equal(u.nom, 'Nouveau nom', 'le champ modifiable ne se modifie plus');
  });
});

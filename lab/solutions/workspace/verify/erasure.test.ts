// Le droit à l'effacement ne porte pas sur « la ligne utilisateur » : il porte
// sur toutes les copies. Ce test supprime un compte, puis cherche son adresse
// dans les cinq magasins où la donnée se propage — et il cherche une valeur
// identifiante, pas un drapeau « supprimé », qui ne prouverait rien.

import assert from 'node:assert/strict';
import test from 'node:test';
import { state, eraseUser } from '../../server/store.ts';

const ADRESSE = 'a.effacer@acme.example';
const cite = (x: unknown, v: string) => JSON.stringify(x ?? null).includes(v);

test('l’effacement retire l’adresse de tous les magasins', () => {
  const compte = state.users.find((u) => u.email === ADRESSE) ?? state.users[0];
  const adresse = compte.email;

  eraseUser(compte.id);

  // Une assertion par magasin : citer les cinq noms dans un commentaire ne
  // prouve pas qu'on est allé regarder.
  assert.equal(state.users.filter((u) => cite(u, adresse)).length, 0, 'users garde encore l’adresse');
  assert.equal(state.invoices.filter((i) => cite(i, adresse)).length, 0, 'invoices garde encore l’adresse');
  assert.equal(state.mails.filter((m) => cite(m, adresse)).length, 0, 'mails garde encore l’adresse');
  assert.equal(state.audit.filter((a) => cite(a, adresse)).length, 0, 'audit garde encore l’adresse');
  assert.equal((state.sends ?? []).filter((s) => cite(s, adresse)).length, 0, 'sends garde encore l’adresse');
});

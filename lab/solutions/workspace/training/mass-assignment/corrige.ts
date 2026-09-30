// Livrable de référence — challenge training-from-bug (M6), correctif.
//
// Le correctif ne « filtre » pas le corps : il ne le lit pas. On construit la
// mise à jour depuis la liste des champs modifiables, un par un. Un champ
// ajouté demain au modèle ne devient pas modifiable par accident — il faut
// venir l'écrire ici, et c'est exactement ce qu'on veut.

export interface Utilisateur {
  id: string;
  email: string;
  nom: string;
  role: 'user' | 'accountant' | 'admin';
  tenantId: string;
}

export function majProfil(utilisateur: Utilisateur, corps: Record<string, unknown>): Utilisateur {
  if (typeof corps.nom === 'string' && corps.nom.trim() !== '') {
    utilisateur.nom = corps.nom.trim();
  }
  return utilisateur;
}

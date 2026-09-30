// Livrable de référence — challenge training-from-bug (M6), extrait vulnérable.
//
// Le défaut que l'équipe vient de livrer trois fois, réduit à douze lignes :
// le corps de la requête est fusionné dans l'entité persistée « pour ne pas
// avoir à lister les champs ». Tout ce que le client envoie est écrit, y
// compris ce qu'il n'a pas le droit d'écrire.
//
// L'exercice part de ce code-là, et non d'un exemple d'injection SQL dans un
// langage que personne ici n'utilise. C'est toute la différence entre une
// formation suivie et une formation subie.

export interface Utilisateur {
  id: string;
  email: string;
  nom: string;
  role: 'user' | 'accountant' | 'admin';
  tenantId: string;
}

export function majProfil(utilisateur: Utilisateur, corps: Record<string, unknown>): Utilisateur {
  Object.assign(utilisateur, corps);
  return utilisateur;
}

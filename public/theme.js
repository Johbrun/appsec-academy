// Applique le thème mémorisé avant le premier rendu pour éviter un flash.
// Fichier externe : la CSP interdit les scripts en ligne.
try {
  if (localStorage.getItem('appsec-academy-theme') === 'dark') document.documentElement.dataset.theme = 'dark';
} catch (e) { /* stockage indisponible */ }

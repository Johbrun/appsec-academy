import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Le client tourne sur 5199 pour ne pas entrer en conflit avec le site (5173).
// Tout /api part vers l'API vulnérable, sur la boucle locale uniquement.
export default defineConfig({
  server: {
    host: '127.0.0.1',
    port: 5199,
    proxy: { '/api': 'http://127.0.0.1:4317' },
  },
  base: './',
});

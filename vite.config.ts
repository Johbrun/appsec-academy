import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import mdx from '@mdx-js/rollup';
import remarkGfm from 'remark-gfm';

export default defineConfig({
  plugins: [
    { enforce: 'pre', ...mdx({ remarkPlugins: [remarkGfm] }) },
    react({ include: /\.(mdx|jsx|tsx|ts|js)$/ }),
  ],
  base: './',
  // En développement, l'API tourne à part (npm run dev:server) ; le navigateur ne voit qu'une seule origine.
  server: { proxy: { '/api': 'http://127.0.0.1:4300' } },
});

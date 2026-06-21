// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://securitystandardsmap.org',
  integrations: [
    react(),
    sitemap(),
  ],
  vite: {
    optimizeDeps: {
      include: ['react', 'react-dom', 'react-dom/client'],
    },
  },
});

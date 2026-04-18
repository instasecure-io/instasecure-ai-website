import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import icon from 'astro-icon';
import mdx from '@astrojs/mdx';

export default defineConfig({
  site: 'https://instasecure.ai',
  output: 'static',
  prefetch: { prefetchAll: true, defaultStrategy: 'viewport' },
  integrations: [icon(), mdx()],
  vite: {
    plugins: [tailwindcss()],
  },
});

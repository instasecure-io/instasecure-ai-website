import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import icon from 'astro-icon';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel/serverless';

export default defineConfig({
  site: 'https://instasecure.ai',
  output: 'server',
  adapter: vercel(),
  prefetch: { prefetchAll: true, defaultStrategy: 'viewport' },
  integrations: [
    icon(),
    mdx(),
    sitemap({
      filter: (page) => !page.includes('/404') && !page.includes('/private/'),
      changefreq: 'weekly',
      priority: 0.7,
      customPages: [
        'https://instasecure.ai/',
      ],
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});

import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';

export default defineConfig({
  output: 'static',
  integrations: [mdx()],
  // Preserve fractional channels and 10% alpha from Figma; hex minification rounds them.
  vite: { build: { cssMinify: false } },
});

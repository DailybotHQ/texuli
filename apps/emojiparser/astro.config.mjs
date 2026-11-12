import svelte from '@astrojs/svelte';
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://emojiparser.com',
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory' },
  integrations: [svelte()],
  vite: {
    ssr: { noExternal: ['@texuli/core', /^@texuli\//] },
  },
});

import svelte from '@astrojs/svelte';
import { texuli } from '@texuli/astro';
import { defineConfig } from 'astro/config';

export default defineConfig({
  integrations: [svelte(), texuli({ namespace: 'astro-consumer', fallbackMode: 'dark' })],
  vite: {
    ssr: { noExternal: ['texuli', /^@texuli\//] },
  },
});

/**
 * Exact third-party versions for consumer fixtures (no ^ or ~).
 * Keep aligned with the monorepo lock where the same tools are used.
 */
export const PINNED = {
  svelte: '5.57.2',
  vite: '8.3.4',
  '@sveltejs/vite-plugin-svelte': '7.3.1',
  '@sveltejs/kit': '2.70.3',
  '@sveltejs/adapter-static': '3.0.8',
  astro: '7.4.2',
  '@astrojs/svelte': '9.1.1',
  typescript: '5.9.3',
  tailwindcss: '4.3.3',
  '@tailwindcss/vite': '4.3.3',
  'svelte-check': '4.7.7',
} as const;

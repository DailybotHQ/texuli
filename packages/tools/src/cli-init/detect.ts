import type { Framework } from './types.ts';

export const FRAMEWORKS: readonly Framework[] = ['sveltekit', 'astro', 'vite'];

/**
 * The framework a `package.json` declares, most specific first: SvelteKit
 * (it also uses Vite), then Astro, then Vite. `null` when none is declared.
 */
export function detectFramework(packageJson: unknown): Framework | null {
  if (typeof packageJson !== 'object' || packageJson === null) return null;
  const record = packageJson as Record<string, unknown>;
  const names = new Set<string>();
  for (const field of ['dependencies', 'devDependencies', 'peerDependencies']) {
    const deps = record[field];
    if (typeof deps === 'object' && deps !== null)
      for (const name of Object.keys(deps)) names.add(name);
  }
  if (names.has('@sveltejs/kit')) return 'sveltekit';
  if (names.has('astro')) return 'astro';
  if (names.has('vite')) return 'vite';
  return null;
}

/** Default file locations per framework (relative, forward slashes). */
export const DEFAULTS: Record<
  Framework,
  { css: string; entries: readonly string[]; document: readonly string[] }
> = {
  vite: {
    css: 'src/texuli.css',
    entries: ['src/main.ts', 'src/main.js'],
    document: ['index.html'],
  },
  sveltekit: {
    css: 'src/texuli.css',
    entries: ['src/routes/+layout.svelte'],
    document: ['src/app.html'],
  },
  astro: {
    css: 'src/styles/texuli.css',
    entries: ['src/layouts/Layout.astro', 'src/layouts/BaseLayout.astro'],
    document: ['src/layouts/Layout.astro', 'src/layouts/BaseLayout.astro'],
  },
};

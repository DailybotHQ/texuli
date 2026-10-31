import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

// `@texuli/charts`, `@texuli/player`, `@texuli/media`, `@texuli/pages`,
// `@texuli/document`, `@texuli/canvas`, `@texuli/catalog`, `@texuli/forms`,
// `@texuli/sheets` and `@texuli/tools` are not fixture-app dependencies (adding one needs the
// lockfile owner), so their export maps become exact aliases for the pages
// that import them directly (worker.html, responsive.html, pages-editor.html, pages-print.html, canvas.html, ds-conformance.html). The packed tarballs are covered by tests/consumers.
function exportAliases(name: string, dir: string) {
  const root = new URL(`../../../packages/${dir}/`, import.meta.url);
  const exports = JSON.parse(readFileSync(new URL('package.json', root), 'utf8')).exports as Record<
    string,
    string | { default: string }
  >;
  return Object.entries(exports).map(([subpath, target]) => ({
    find: new RegExp(`^${name}${subpath.slice(1).replaceAll('/', '\\/')}$`),
    replacement: fileURLToPath(new URL(typeof target === 'string' ? target : target.default, root)),
  }));
}

export default defineConfig({
  plugins: [svelte()],
  resolve: {
    alias: [
      ...exportAliases('@texuli/charts', 'charts'),
      ...exportAliases('@texuli/player', 'player'),
      ...exportAliases('@texuli/media', 'media'),
      ...exportAliases('@texuli/pages', 'pages'),
      ...exportAliases('@texuli/document', 'document'),
      ...exportAliases('@texuli/canvas', 'canvas'),
      // tests/e2e/ds-conformance.spec.ts (ds-conformance.html).
      ...exportAliases('@texuli/catalog', 'catalog'),
      ...exportAliases('@texuli/forms', 'forms'),
      ...exportAliases('@texuli/sheets', 'sheets'),
      ...exportAliases('@texuli/tools', 'tools'),
    ],
  },
  server: { fs: { allow: ['../../..'] } },
});

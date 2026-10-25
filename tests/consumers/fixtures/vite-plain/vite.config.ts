import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [svelte()],
  server: { host: '127.0.0.1', strictPort: true },
  preview: { host: '127.0.0.1', strictPort: true },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // worker.html proves the packed @texuli/charts/worker entry bundles as a module worker.
    rollupOptions: { input: { main: 'index.html', worker: 'worker.html' } },
  },
  worker: { format: 'es' },
});

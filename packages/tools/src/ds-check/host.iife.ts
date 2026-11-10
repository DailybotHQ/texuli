/**
 * Published as `@texuli/tools/ds-check/host.iife.js`. In the packed package
 * `pnpm verify:packages` overwrites `dist/ds-check/host.iife.js` with the
 * Vite IIFE (`scripts/ds-check-host.ts`) so a prototype page can load it
 * without a bundler:
 *
 *   <script src="./node_modules/@texuli/tools/ds-check/host.iife.js"></script>
 */
export {
  dsCheckComponentSelector,
  installDsCheckHost,
} from './host.ts';

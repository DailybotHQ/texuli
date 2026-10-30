import '@texuli/tokens/base.css';
import { applyTheme } from '@texuli/tokens';
import { loadLibraryTheme } from '@texuli/tokens/library';
import { mount } from 'svelte';
import ThemeScopes from './ThemeScopes.svelte';

/*
 * tests/e2e/theme-scopes.spec.ts (T-scope-portals, ADR-023): two subtrees,
 * each themed with `applyTheme(el)`, side by side on a page with a third
 * theme. `?mode=light|dark` sets the page mode and subtree A's; subtree B
 * always takes the other mode, so one subtree is dark in every run.
 */

const params = new URLSearchParams(location.search);
const mode = params.get('mode') === 'dark' ? 'dark' : 'light';
const other = mode === 'dark' ? 'light' : 'dark';
const [page, themeA, themeB] = await Promise.all([
  loadLibraryTheme('enterprise-neutral'),
  loadLibraryTheme('health-clinic'),
  loadLibraryTheme('gaming-neon'),
]);
applyTheme(document.documentElement, { theme: page, mode });

const target = document.getElementById('app');
if (!target) throw new Error('missing #app');
mount(ThemeScopes, {
  target,
  props: {
    scopes: {
      a: { theme: themeA, mode },
      b: { theme: themeB, mode: other },
    },
  },
});

import '@texuli/tokens/base.css';
import { applyTheme } from '@texuli/tokens';
import { loadLibraryTheme } from '@texuli/tokens/library';
import { mount } from 'svelte';
import Bugs from './Bugs7579.svelte';

/*
 * tests/e2e/bugs-75-79.spec.ts: one case per Protoyard bug, `?case=` picks it
 * (dialog-select, board, toaster, reveal, avatar). `?motion=attr` sets
 * `data-tx-motion="reduce"` on <html>; `?hidden-rule=1` adds a host
 * `@layer base { [hidden] { display: none !important } }` rule (Tailwind v4's
 * preflight) before anything mounts.
 */

const params = new URLSearchParams(location.search);
if (params.get('hidden-rule') === '1') {
  const style = document.createElement('style');
  style.textContent = '@layer base { [hidden] { display: none !important; } }';
  document.head.append(style);
}
applyTheme(document.documentElement, {
  theme: await loadLibraryTheme('enterprise-neutral'),
  mode: 'light',
});
// After applyTheme, which writes its own `data-tx-motion`.
if (params.get('motion') === 'attr') document.documentElement.dataset.txMotion = 'reduce';

const target = document.getElementById('app');
if (!target) throw new Error('missing #app');
mount(Bugs, { target, props: { which: params.get('case') ?? 'dialog-select' } });

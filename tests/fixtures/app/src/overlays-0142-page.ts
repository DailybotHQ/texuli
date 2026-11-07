import '@texuli/tokens/base.css';
import { applyTheme } from '@texuli/tokens';
import { loadLibraryTheme } from '@texuli/tokens/library';
import { mount } from 'svelte';
import Overlays from './Overlays0142.svelte';

/*
 * tests/e2e/overlays-0142.spec.ts: `?case=` picks one case (dialog-open,
 * sheet-open, popover-handoff, toggle-controlled). `?motion=reduce` sets
 * `data-tx-motion="reduce"` on <html>.
 */

const params = new URLSearchParams(location.search);
applyTheme(document.documentElement, {
  theme: await loadLibraryTheme('enterprise-neutral'),
  mode: 'light',
});
if (params.get('motion') === 'reduce') document.documentElement.dataset.txMotion = 'reduce';

const target = document.getElementById('app');
if (!target) throw new Error('missing #app');
mount(Overlays, { target, props: { which: params.get('case') ?? 'dialog-open' } });

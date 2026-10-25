import '@texuli/tokens/base.css';
import { applyTheme } from '@texuli/tokens';
import { loadLibraryTheme } from '@texuli/tokens/library';
import { mount } from 'svelte';
import App from './App.svelte';

const target = document.getElementById('app');
if (!target) throw new Error('missing #app');

// `?behavior=<primitive>` renders a behavior scenario (tests/behavior/README.md).
// It loads lazily, so other fixtures never pull scenario code.
const params = new URLSearchParams(location.search);

// Every fixture renders on a real theme: `?theme=<library id>` (default
// enterprise-neutral) and `?mode=light|dark` (default: the emulated or system
// color scheme), so visual baselines and axe runs see real tokens in both modes.
const requestedMode = params.get('mode');
const mode =
  requestedMode === 'light' || requestedMode === 'dark'
    ? requestedMode
    : matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
applyTheme(document.documentElement, {
  theme: await loadLibraryTheme(params.get('theme') ?? 'enterprise-neutral'),
  mode,
});
const behavior = params.get('behavior');
// `?layout-slot=<layout id>` mounts one layout with a wide routed screen
// (tests/e2e/layout-slot-minsize.spec.ts). It loads lazily too.
const layoutSlot = params.get('layout-slot');
if (layoutSlot) {
  const { default: LayoutSlots } = await import('./LayoutSlots.svelte');
  mount(LayoutSlots, { target, props: { id: layoutSlot } });
} else if (behavior) {
  const { default: BehaviorHost } = await import('../../behavior/BehaviorHost.svelte');
  mount(BehaviorHost, {
    target,
    props: { primitive: behavior },
  });
} else {
  mount(App, { target });
}

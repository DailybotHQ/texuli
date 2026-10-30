import '@texuli/tokens/base.css';
import { applyTheme } from '@texuli/tokens';
import { loadLibraryTheme } from '@texuli/tokens/library';
import { mount } from 'svelte';

/*
 * tests/e2e/canvas.spec.ts: the canvas editor over a fictional retro board
 * (`?mode=dark` paints the dark theme). `window.txCanvas` reads the canvas
 * and runs the exports.
 */

const params = new URLSearchParams(location.search);
applyTheme(document.documentElement, {
  theme: await loadLibraryTheme('enterprise-neutral'),
  mode: params.get('mode') === 'dark' ? 'dark' : 'light',
});

const target = document.getElementById('canvas-app');
if (!target) throw new Error('missing #canvas-app');
const { default: CanvasFixture } = await import('./CanvasFixture.svelte');
mount(CanvasFixture, { target });

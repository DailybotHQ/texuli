import '@texuli/tokens/base.css';
import { applyTheme } from '@texuli/tokens';
import { loadLibraryTheme } from '@texuli/tokens/library';
import { mount } from 'svelte';
import PagesPrintFixture from './PagesPrintFixture.svelte';

/*
 * tests/e2e/pages-print.spec.ts: the @texuli/pages paged view over a
 * fictional report (`?mode=dark` paints the dark theme, `?size=letter`
 * switches the page size). `window.txPaged` reads the paged layout.
 */

const params = new URLSearchParams(location.search);
applyTheme(document.documentElement, {
  theme: await loadLibraryTheme('enterprise-neutral'),
  mode: params.get('mode') === 'dark' ? 'dark' : 'light',
});

const target = document.getElementById('paged-app');
if (!target) throw new Error('missing #paged-app');
mount(PagesPrintFixture, {
  target,
  props: { size: params.get('size') === 'letter' ? 'letter' : 'a4' },
});
const status = document.getElementById('paged-status');
if (status) status.textContent = 'Ready';

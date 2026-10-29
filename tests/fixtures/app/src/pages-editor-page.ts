import '@texuli/tokens/base.css';
import { applyTheme } from '@texuli/tokens';
import { loadLibraryTheme } from '@texuli/tokens/library';
import { mount } from 'svelte';
import PagesEditorFixture from './PagesEditorFixture.svelte';

/*
 * tests/e2e/pages-editor.spec.ts: the @texuli/pages editor over a fictional
 * page (`?mode=dark` paints the dark theme). `window.txPages` reads the
 * document, the op log and the pages the editor asked to open.
 */

const params = new URLSearchParams(location.search);
applyTheme(document.documentElement, {
  theme: await loadLibraryTheme('enterprise-neutral'),
  mode: params.get('mode') === 'dark' ? 'dark' : 'light',
});

const target = document.getElementById('pages-app');
if (!target) throw new Error('missing #pages-app');
mount(PagesEditorFixture, { target });
const status = document.getElementById('pages-status');
if (status) status.textContent = 'Ready';

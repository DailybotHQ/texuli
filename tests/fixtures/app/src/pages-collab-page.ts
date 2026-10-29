import '@texuli/tokens/base.css';
import { applyTheme } from '@texuli/tokens';
import { loadLibraryTheme } from '@texuli/tokens/library';
import { mount } from 'svelte';

/*
 * tests/e2e/pages-collab.spec.ts: two collaborative page editors (Ada and
 * Lin) on one in-memory sync hub, over a fictional page (`?mode=dark`
 * paints the dark theme). `@texuli/pages/collab` loads lazily, as a host
 * would load it. `window.txCollab` reads each session.
 */

const params = new URLSearchParams(location.search);
applyTheme(document.documentElement, {
  theme: await loadLibraryTheme('enterprise-neutral'),
  mode: params.get('mode') === 'dark' ? 'dark' : 'light',
});

const target = document.getElementById('pages-app');
if (!target) throw new Error('missing #pages-app');
const { default: PagesCollabFixture } = await import('./PagesCollabFixture.svelte');
mount(PagesCollabFixture, { target });

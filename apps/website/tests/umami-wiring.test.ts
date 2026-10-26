/**
 * The wired surfaces (T-38): each stable surface calls the catalog event
 * with the exact typed name via the track seam (mocked here — the off
 * path's silence is track.ts's own tested behavior). CopyPage is an
 * unbundled .astro script the root config cannot compile; its wiring is
 * pinned structurally and behaviorally by the built-site specs (T-39).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const track = vi.fn();
vi.mock('../src/lib/track.ts', () => ({
  UMAMI_READY_EVENT: 'tx-umami-ready',
  track: (...args: unknown[]) => track(...args),
  // Mirrors the real guard's shape; the real behavior is proven against
  // the actual module in umami-track.test.ts.
  oncePerInstance: (eventName: string) => {
    let done = false;
    return (data?: unknown) => {
      if (done) return;
      done = true;
      track(eventName, data);
    };
  },
  resetTrackQueueForTests: () => {},
}));

import ThemeSwitch from '../src/components/foundation/ThemeSwitch.svelte';
import SearchResults from '../src/components/search/SearchResults.svelte';
import { setupOutboundDocTracking } from '../src/lib/outbound-links.ts';

beforeEach(() => {
  track.mockClear();
});
afterEach(() => {
  cleanup();
});

describe('ThemeSwitch wires theme_switch', () => {
  it('emits from/to on each choice', async () => {
    render(ThemeSwitch);
    await fireEvent.click(screen.getByText('Dark'));
    expect(track).toHaveBeenCalledWith('theme_switch', { from: 'system', to: 'dark' });
    await fireEvent.click(screen.getByText('Light'));
    expect(track).toHaveBeenCalledWith('theme_switch', { from: 'dark', to: 'light' });
  });
});

describe('SearchResults wires search', () => {
  it('emits the query and hit count for a submitted search', async () => {
    window.history.replaceState(null, '', '/search/?q=button');
    render(SearchResults);
    // onMount reads the query synchronously; flush the effect queue.
    await vi.waitFor(() => {
      expect(track).toHaveBeenCalledWith('search', {
        query: 'button',
        results: expect.any(Number),
      });
    });
  });

  it('emits nothing without a query', () => {
    window.history.replaceState(null, '', '/search/');
    render(SearchResults);
    expect(track).not.toHaveBeenCalled();
  });
});

describe('the demo open guard (LiveDemo wiring)', () => {
  it('LiveDemo wires the once-guard to its control changes (structural pin)', () => {
    const source = readFileSync(
      resolve('apps/website/src/components/live/LiveDemo.svelte'),
      'utf8'
    );
    expect(source).toContain("oncePerInstance('component_demo_open')");
    expect(source).toContain('trackDemoOpen({ component: componentId })');
  });
});

describe('CopyPage wires code_copy (structural pin; behavior via T-39)', () => {
  it('tracks the page path on successful copy only', () => {
    const source = readFileSync(resolve('apps/website/src/components/docs/CopyPage.astro'), 'utf8');
    expect(source).toContain('track(EVENTS.CODE_COPY,');
    expect(source).toContain('{ page: location.pathname }');
    // The failure path must stay silent.
    const catchBlock = source.split('} catch {')[1] ?? '';
    expect(catchBlock).not.toContain('track(');
  });
});

describe('outbound_doc_link wires external anchors', () => {
  it('emits the resolved URL for external links only', () => {
    setupOutboundDocTracking();
    document.body.innerHTML = `
      <a id="ext" href="https://developer.mozilla.org/docs/Web">MDN</a>
      <a id="int" href="/guides/">Internal</a>
      <a id="anchor" href="#section">Anchor</a>
      <a id="mail" href="mailto:hi@example.com">Mail</a>`;
    fireEvent.click(document.getElementById('ext') as HTMLElement);
    expect(track).toHaveBeenCalledWith('outbound_doc_link', {
      url: 'https://developer.mozilla.org/docs/Web',
    });
    fireEvent.click(document.getElementById('int') as HTMLElement);
    fireEvent.click(document.getElementById('anchor') as HTMLElement);
    fireEvent.click(document.getElementById('mail') as HTMLElement);
    expect(track).toHaveBeenCalledTimes(1);
  });

  it('is idempotent: a second setup call adds no listener', () => {
    setupOutboundDocTracking();
    setupOutboundDocTracking();
    document.body.innerHTML = `<a href="https://example.com/docs">Ext</a>`;
    fireEvent.click(document.querySelector('a') as HTMLElement);
    expect(track).toHaveBeenCalledTimes(1);
  });
});

// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanup, render, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { unregisterLayout } from '../src/layouts/host/registry.ts';
import SidebarHeightHarness from './fixtures/SidebarHeightHarness.svelte';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sidebarCss = readFileSync(join(root, 'src/components/sidebar/sidebar.css'), 'utf8');
const appCss = readFileSync(join(root, 'src/layouts/app/app.css'), 'utf8');

afterEach(() => {
  cleanup();
  unregisterLayout('sidebar');
  unregisterLayout('dual-sidebar');
  unregisterLayout('rail');
});

async function ready(container: HTMLElement, attr: string): Promise<HTMLElement> {
  await waitFor(
    () => {
      expect(container.querySelector(`[data-tx-app-layout="${attr}"]`)).toBeTruthy();
    },
    { timeout: 10_000 }
  );
  return container.querySelector(`[data-tx-app-layout="${attr}"]`) as HTMLElement;
}

describe('sidebar / rail column height CSS contract', () => {
  it('defines definite app-height and stretch chains for sidebar shells', () => {
    expect(appCss).toMatch(/\.tx-app-layout\s*\{[^}]*block-size:\s*var\(--tx-app-height/s);
    expect(appCss).toMatch(/\.tx-app-layout--sidebar/);
    expect(appCss).toMatch(/\.tx-app-layout--three-pane/);
    expect(appCss).toMatch(/\.tx-app-layout--sidebar\s*>\s*\.tx-app-nav[\s\S]*block-size:\s*100%/);
    expect(sidebarCss).toMatch(/\.tx-app-nav\s*\{[^}]*block-size:\s*100%/s);
    expect(sidebarCss).toMatch(/\.tx-app-nav__sidebar\s*\{[^}]*align-self:\s*stretch/s);
    expect(sidebarCss).toMatch(
      /\.tx-app-nav__sidebar\s*>\s*\.tx-sidebar\s*\{[^}]*block-size:\s*100%/s
    );
    expect(appCss).toMatch(/\.tx-app-layout__rail\s*\{[^}]*block-size:\s*100%/s);
  });
});

describe('sidebar / rail column height DOM', () => {
  it('mounts sidebar at 1280×800 with short content and stretch class chain', async () => {
    const { container } = render(SidebarHeightHarness, { props: { layout: 'sidebar' } });
    const layout = await ready(container, 'sidebar');
    const frame = container.querySelector('[data-sidebar-height-frame]') as HTMLElement;
    expect(frame.style.width).toBe('1280px');
    expect(frame.style.height).toBe('800px');

    const nav = layout.querySelector('.tx-app-nav');
    const side = layout.querySelector('.tx-app-nav__sidebar');
    const sidebar = layout.querySelector('.tx-sidebar');
    expect(nav).toBeTruthy();
    expect(side).toBeTruthy();
    expect(sidebar).toBeTruthy();

    // When the test engine reports geometry, sidebar matches layout height.
    const layoutH = layout.getBoundingClientRect().height;
    const sideH = side!.getBoundingClientRect().height;
    if (layoutH >= 790 && sideH > 0) {
      expect(Math.abs(sideH - layoutH)).toBeLessThanOrEqual(2);
    }
  });

  it('mounts dual-sidebar and rail stretch shells', async () => {
    for (const layout of ['dual-sidebar', 'rail'] as const) {
      cleanup();
      const attr = layout === 'dual-sidebar' ? 'three-pane' : 'rail';
      const { container } = render(SidebarHeightHarness, { props: { layout } });
      const root = await ready(container, attr);
      if (layout === 'rail') {
        expect(root.querySelector('.tx-app-layout__rail')).toBeTruthy();
        expect(root.querySelector('.tx-app-layout__rail-shell')).toBeTruthy();
      } else {
        expect(root.querySelector('.tx-app-nav__sidebar')).toBeTruthy();
        expect(root.querySelector('.tx-sidebar')).toBeTruthy();
      }
    }
  });
});

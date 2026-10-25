import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, render, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerAppLayouts } from '../src/layouts/app/entry.ts';
import { layoutForWidth } from '../src/layouts/host/contract.ts';
import {
  clearLayoutRegistry,
  LAYOUT_OWNERS,
  LAYOUT_REGISTRY,
  registerLayout,
  unregisterLayout,
} from '../src/layouts/host/registry.ts';
import { registerMobileLayouts } from '../src/layouts/mobile/register.ts';
import LayoutHostHarness from './fixtures/LayoutHostHarness.svelte';
import TestSidebarLayout from './fixtures/TestSidebarLayout.svelte';

const layoutsRoot = join(process.cwd(), 'packages/texuli/src/layouts');

afterEach(() => {
  cleanup();
  clearLayoutRegistry();
  vi.restoreAllMocks();
});

function walkCss(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walkCss(path, out);
    else if (name.endsWith('.css')) out.push(path);
  }
  return out;
}

describe('layout registration ownership', () => {
  it('app layouts never claim mobile ids and own rail + master-detail', () => {
    registerAppLayouts();
    expect(LAYOUT_REGISTRY['mobile-drawer']).toBeUndefined();
    expect(LAYOUT_REGISTRY['mobile-tabs']).toBeUndefined();
    expect(LAYOUT_OWNERS.sidebar).toBe('app');
    expect(LAYOUT_OWNERS.rail).toBe('app');
    expect(LAYOUT_OWNERS['master-detail']).toBe('app');
    expect(LAYOUT_REGISTRY.sidebar?.load).toBeTypeOf('function');
    expect(LAYOUT_REGISTRY.rail?.load).toBeTypeOf('function');
    expect(LAYOUT_REGISTRY['master-detail']?.load).toBeTypeOf('function');
  });

  it('any registration order yields the same owner map for app + mobile', () => {
    registerAppLayouts();
    registerMobileLayouts();
    const forward = {
      sidebar: LAYOUT_REGISTRY.sidebar?.load,
      'top-nav': LAYOUT_REGISTRY['top-nav']?.load,
      'dual-sidebar': LAYOUT_REGISTRY['dual-sidebar']?.load,
      rail: LAYOUT_REGISTRY.rail?.load,
      'master-detail': LAYOUT_REGISTRY['master-detail']?.load,
      'mobile-drawer': LAYOUT_REGISTRY['mobile-drawer']?.load,
      'mobile-tabs': LAYOUT_REGISTRY['mobile-tabs']?.load,
    };

    clearLayoutRegistry();
    registerMobileLayouts();
    registerAppLayouts();
    expect(LAYOUT_REGISTRY.sidebar?.load).toBe(forward.sidebar);
    expect(LAYOUT_REGISTRY['top-nav']?.load).toBe(forward['top-nav']);
    expect(LAYOUT_REGISTRY['dual-sidebar']?.load).toBe(forward['dual-sidebar']);
    expect(LAYOUT_REGISTRY.rail?.load).toBe(forward.rail);
    expect(LAYOUT_REGISTRY['master-detail']?.load).toBe(forward['master-detail']);
    expect(LAYOUT_REGISTRY['mobile-drawer']?.load).toBe(forward['mobile-drawer']);
    expect(LAYOUT_REGISTRY['mobile-tabs']?.load).toBe(forward['mobile-tabs']);
    expect(LAYOUT_OWNERS.sidebar).toBe('app');
    expect(LAYOUT_OWNERS.rail).toBe('app');
    expect(LAYOUT_OWNERS['master-detail']).toBe('app');
    expect(LAYOUT_OWNERS['mobile-drawer']).toBe('mobile');
    expect(LAYOUT_OWNERS['mobile-tabs']).toBe('mobile');
  });

  it('warns when a different owner re-registers an id with another loader', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    registerLayout('sidebar', {
      load: async () => ({ default: TestSidebarLayout }),
      owner: 'app',
    });
    registerLayout('sidebar', {
      load: async () => ({ default: TestSidebarLayout }),
      owner: 'other',
    });
    expect(warn).toHaveBeenCalled();
    expect(String(warn.mock.calls[0]?.[0])).toMatch(/re-registered by owner "other"/);
  });

  it('does not warn when the same owner re-registers the same loader', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const load = async () => ({ default: TestSidebarLayout });
    registerLayout('sidebar', { load, owner: 'app' });
    registerLayout('sidebar', { load, owner: 'app' });
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('layout CSS host contract', () => {
  it('layouts and shells never use raw 100dvh/100vh or env(safe-area-*)', () => {
    const files = walkCss(layoutsRoot);
    expect(files.length).toBeGreaterThan(5);
    const offenders: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      const lines = text.split('\n');
      lines.forEach((line, index) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('/*') || trimmed.startsWith('*') || trimmed.startsWith('//')) return;
        if (/env\s*\(\s*safe-area-inset-/.test(line)) {
          offenders.push(`${file}:${index + 1}: raw env(safe-area)`);
        }
        // Bare viewport units (not as the default inside var(--tx-app-height, …)).
        if (
          /(?<![\w-])100(?:dvh|vh)(?![\w-])/.test(line) &&
          !/var\(\s*--tx-app-height/.test(line)
        ) {
          offenders.push(`${file}:${index + 1}: raw viewport unit`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });
});

describe('LayoutHost width seed (no narrow flash)', () => {
  it('uses a desktop-width seed so sidebar does not flash mobile-drawer before RO', async () => {
    // Viewport-wide seed before the host box is measured.
    Object.defineProperty(globalThis, 'innerWidth', {
      configurable: true,
      get: () => 1200,
    });
    registerLayout('sidebar', {
      load: async () => ({ default: TestSidebarLayout }),
      owner: 'test',
    });
    // mobile-drawer must exist for fallback path if width were narrow
    registerLayout('mobile-drawer', {
      load: async () => ({ default: TestSidebarLayout }),
      owner: 'mobile',
    });

    expect(layoutForWidth('sidebar', 1200)).toBe('sidebar');
    expect(layoutForWidth('sidebar', 0)).toBe('sidebar');

    const view = render(LayoutHostHarness, { props: { layout: 'sidebar' } });
    // First resolved layout must be sidebar (not mobile-drawer) at desktop seed.
    await waitFor(() =>
      expect(view.container.querySelector('[data-test-layout="sidebar"]')).toBeTruthy()
    );
    expect(view.container.querySelector('[data-layout="mobile-drawer"]')).toBeNull();
    unregisterLayout('sidebar');
    unregisterLayout('mobile-drawer');
  });
});

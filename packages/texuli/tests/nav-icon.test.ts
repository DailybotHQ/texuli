import { cleanup, render } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { iconPath } from '../src/components/icons/icons.ts';
import NavIcon from '../src/layouts/host/NavIcon.svelte';
import {
  NAV_ICON_BUILTINS,
  NAV_ICON_FALLBACK_PATH,
  NAV_ICON_PATHS,
  navIconPath,
} from '../src/layouts/host/nav-icons.ts';
import type { NavIconName } from '../src/layouts/host/nav-model.ts';

afterEach(cleanup);

const MENU = iconPath('menu');

/** Exhaustive list from the type — keeps Record and type in lockstep. */
const ALL_NAMES = Object.keys(NAV_ICON_PATHS) as NavIconName[];

describe('nav icon glyphs', () => {
  it('maps every NavIconName to its own non-fallback glyph (full Record)', () => {
    expect(ALL_NAMES.length).toBe(NAV_ICON_BUILTINS.length);
    expect(ALL_NAMES.length).toBeGreaterThanOrEqual(53);
    for (const name of ALL_NAMES) {
      const glyph = navIconPath(name);
      expect(glyph.known, name).toBe(true);
      expect(glyph.path, name).not.toBe(MENU);
      expect(glyph.path, name).not.toBe(NAV_ICON_FALLBACK_PATH);
      expect(glyph.path.length, name).toBeGreaterThan(4);
    }
    const paths = ALL_NAMES.map((name) => navIconPath(name).path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('draws unknown names with the neutral dot, not the menu glyph', () => {
    for (const name of ['definitely-not-an-icon', 'not-a-real-name', '']) {
      expect(navIconPath(name)).toEqual({ path: NAV_ICON_FALLBACK_PATH, known: false });
    }
    expect(NAV_ICON_FALLBACK_PATH).not.toBe(MENU);
  });

  it('renders every catalog name as a known glyph (no fallback path)', () => {
    for (const name of ALL_NAMES) {
      const { container, unmount } = render(NavIcon, { props: { icon: name } });
      const svg = container.querySelector('svg') as SVGElement;
      expect(svg.getAttribute('data-tx-nav-icon')).toBe(name);
      expect(svg.getAttribute('data-known')).toBe('true');
      expect(svg.querySelector('path')?.getAttribute('d')).toBe(NAV_ICON_PATHS[name]);
      expect(svg.querySelector('path')?.getAttribute('d')).not.toBe(NAV_ICON_FALLBACK_PATH);
      unmount();
    }
  });

  it('renders the glyph decoratively, or named with a label', () => {
    const { container } = render(NavIcon, { props: { icon: 'inbox' } });
    const svg = container.querySelector('svg') as SVGElement;
    expect(svg.getAttribute('data-tx-nav-icon')).toBe('inbox');
    expect(svg.getAttribute('data-known')).toBe('true');
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.querySelector('path')?.getAttribute('d')).toBe(navIconPath('inbox').path);
    cleanup();
    const named = render(NavIcon, {
      props: { icon: 'definitely-not-an-icon' as NavIconName, label: 'Automations' },
    });
    const unknown = named.container.querySelector('svg') as SVGElement;
    expect(unknown.getAttribute('role')).toBe('img');
    expect(unknown.getAttribute('aria-label')).toBe('Automations');
    expect(unknown.getAttribute('data-known')).toBe('false');
    expect(unknown.querySelector('path')?.getAttribute('d')).toBe(NAV_ICON_FALLBACK_PATH);
  });

  it('renders nothing without an icon', () => {
    const { container } = render(NavIcon, { props: {} });
    expect(container.querySelector('svg, [data-tx-nav-icon]')).toBeNull();
  });
});

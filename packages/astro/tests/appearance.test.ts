import { cleanup, fireEvent, render, waitFor } from '@testing-library/svelte';
import { appearanceCacheKey, cacheAppearance } from '@texuli/tokens/no-flash';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  AppearanceSwitcher,
  applyAppearanceChoice,
  readAppearanceChoice,
} from '../src/appearance/index.ts';

// G16: a light/dark/system appearance island that persists per site through
// the token appearance cache the integration's bootstrap already reads.

type Media = { matches: boolean; listeners: Set<() => void> };

function fakeMatchMedia(dark: boolean) {
  const media: Media = { matches: dark, listeners: new Set() };
  const matchMedia = (query: string) => ({
    matches: query.includes('dark') ? media.matches : false,
    media: query,
    addEventListener: (_: string, listener: () => void) => media.listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => media.listeners.delete(listener),
  });
  return { media, matchMedia: matchMedia as unknown as typeof globalThis.matchMedia };
}

function radios(container: HTMLElement): HTMLInputElement[] {
  return Array.from(container.querySelectorAll<HTMLInputElement>('input[type="radio"]'));
}

describe('@texuli/astro appearance switcher (G16)', () => {
  const root = document.documentElement;
  const priorMatchMedia = globalThis.matchMedia;

  beforeEach(() => {
    localStorage.clear();
    root.removeAttribute('data-tx-mode');
    root.removeAttribute('style');
    root.className = '';
    root.dataset.txTheme = 'ocean';
  });

  afterEach(() => {
    cleanup();
    globalThis.matchMedia = priorMatchMedia;
    delete root.dataset.txTheme;
  });

  it('reads the choice from the namespaced cache; malformed or missing is system', () => {
    const cases: Array<[string | null, string]> = [
      [null, 'system'],
      ['{bad', 'system'],
      [JSON.stringify({ v: 1, themeId: 'ocean', mode: 'dark', vars: {} }), 'dark'],
      [JSON.stringify({ v: 1, themeId: 'ocean', mode: 'light', vars: {} }), 'light'],
      [
        JSON.stringify({ v: 1, themeId: 'ocean', mode: 'high-contrast', vars: {} }),
        'high-contrast',
      ],
    ];
    for (const [raw, expected] of cases) {
      localStorage.clear();
      if (raw !== null) localStorage.setItem(appearanceCacheKey('docs'), raw);
      expect(readAppearanceChoice('docs'), String(raw)).toBe(expected);
    }
    expect(readAppearanceChoice('other')).toBe('system');
  });

  it('caches light and dark per namespace, applies them, and clears the cache for system', () => {
    const { matchMedia } = fakeMatchMedia(true);
    for (const mode of ['light', 'dark'] as const) {
      expect(applyAppearanceChoice('docs', mode, { root, matchMedia })).toBe(mode);
      expect(JSON.parse(localStorage.getItem(appearanceCacheKey('docs')) ?? 'null')).toEqual({
        v: 1,
        themeId: 'ocean',
        mode,
        vars: {},
      });
      expect(root.dataset.txMode).toBe(mode);
      expect(root.classList.contains(mode)).toBe(true);
      expect(root.style.colorScheme).toBe(mode);
    }
    expect(localStorage.getItem(appearanceCacheKey('site'))).toBeNull();
    expect(applyAppearanceChoice('docs', 'system', { root, matchMedia })).toBe('dark');
    expect(localStorage.getItem(appearanceCacheKey('docs'))).toBeNull();
    expect(root.dataset.txMode).toBe('dark');
  });

  it('keeps a cached theme, drops the old mode variables and falls back to the default theme id', () => {
    const { matchMedia } = fakeMatchMedia(false);
    cacheAppearance('docs', {
      themeId: 'forest',
      mode: 'dark',
      vars: { '--tx-background': 'oklch(0.2 0 0)' },
      surface: 'glass',
    });
    root.style.setProperty('--tx-background', 'oklch(0.2 0 0)');
    applyAppearanceChoice('docs', 'light', { root, matchMedia });
    expect(JSON.parse(localStorage.getItem(appearanceCacheKey('docs')) ?? 'null')).toEqual({
      v: 1,
      themeId: 'forest',
      mode: 'light',
      vars: {},
      surface: 'glass',
    });
    expect(root.style.getPropertyValue('--tx-background')).toBe('');

    localStorage.clear();
    delete root.dataset.txTheme;
    applyAppearanceChoice('docs', 'dark', { root, matchMedia, themeId: 'Not valid' });
    expect(JSON.parse(localStorage.getItem(appearanceCacheKey('docs')) ?? 'null').themeId).toBe(
      'default'
    );
  });

  it('renders a labelled radio group that switches, persists and follows the system', async () => {
    const { media, matchMedia } = fakeMatchMedia(false);
    globalThis.matchMedia = matchMedia;
    cacheAppearance('docs', { themeId: 'ocean', mode: 'dark', vars: {} });
    const view = render(AppearanceSwitcher, { props: { namespace: 'docs', label: 'Theme' } });
    const group = view.getByRole('radiogroup', { name: 'Theme' });
    expect(group).toBeTruthy();
    expect(radios(view.container).map((radio) => radio.labels?.[0]?.textContent?.trim())).toEqual([
      'Light',
      'Dark',
      'System',
    ]);
    await waitFor(() =>
      expect(view.getByRole('radio', { name: 'Dark' })).toHaveProperty('checked', true)
    );
    expect(new Set(radios(view.container).map((radio) => radio.name)).size).toBe(1);

    await fireEvent.click(view.getByRole('radio', { name: 'Light' }));
    expect(root.dataset.txMode).toBe('light');
    expect(readAppearanceChoice('docs')).toBe('light');

    await fireEvent.click(view.getByRole('radio', { name: 'System' }));
    expect(localStorage.getItem(appearanceCacheKey('docs'))).toBeNull();
    expect(root.dataset.txMode).toBe('light');
    media.matches = true;
    for (const listener of media.listeners) listener();
    expect(root.dataset.txMode).toBe('dark');

    // Another tab writes the same namespace: the selection follows.
    cacheAppearance('docs', { themeId: 'ocean', mode: 'light', vars: {} });
    window.dispatchEvent(new StorageEvent('storage', { key: appearanceCacheKey('docs') }));
    await waitFor(() =>
      expect(view.getByRole('radio', { name: 'Light' })).toHaveProperty('checked', true)
    );
    view.unmount();
    expect(media.listeners.size).toBe(0);
  });

  it('renders no inline style or script and accepts custom option labels', () => {
    const view = render(AppearanceSwitcher, {
      props: { labels: { light: 'Claro', dark: 'Oscuro', system: 'Sistema' } },
    });
    expect(view.container.querySelector('script, [style]')).toBeNull();
    expect(view.getByRole('radiogroup', { name: 'Appearance' })).toBeTruthy();
    expect(view.getByRole('radio', { name: 'Oscuro' })).toBeTruthy();
  });
});

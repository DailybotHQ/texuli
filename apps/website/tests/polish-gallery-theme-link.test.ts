/**
 * T-83 — theme-gallery deep links (`?theme=<id>&mode=<mode>`).
 *
 * The share loop is page-owned (PLAN_006 design-punchlist gallery row 2): the
 * island is untouched, and `components/gallery-themes/theme-link.ts` parses the
 * query, applies the linked appearance through the same site-appearance path
 * the island uses, mirrors the painted `data-tx-theme` / `data-tx-mode` back
 * into the address bar, and powers the copy-link button. These tests run the
 * real module in happy-dom with injected fakes for CSS loading, clipboard and
 * history — the island contract (attributes on `<html>`) is the seam.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  applyThemeFromLink,
  parseThemeLink,
  type ThemeLinkEnv,
  type ThemeLinkSyncEnv,
  themeLinkSearch,
  wireCopyLink,
  wireThemeLinkSync,
} from '../src/components/gallery-themes/theme-link.ts';
import {
  applySiteAppearance,
  readModePreference,
  writeModePreference,
} from '../src/components/theme-switcher/appearance.ts';

const IDS = ['enterprise-neutral', 'violet', 'midnight-ocean'];

function baseEnv(overrides: Partial<ThemeLinkEnv> = {}): ThemeLinkEnv {
  return {
    document,
    validThemeIds: IDS,
    defaultThemeId: 'enterprise-neutral',
    currentSearch: () => '',
    replaceSearch: vi.fn(),
    ensureCss: vi.fn(() => Promise.resolve(true)),
    apply: vi.fn(),
    storedModeChoice: () => 'system',
    ...overrides,
  };
}

afterEach(() => {
  document.documentElement.removeAttribute('data-tx-theme');
  document.documentElement.removeAttribute('data-tx-mode');
});

describe('parseThemeLink', () => {
  it('reads a theme and mode pair', () => {
    expect(parseThemeLink('?theme=violet&mode=dark', IDS)).toEqual({
      themeId: 'violet',
      mode: 'dark',
    });
  });

  it('accepts theme only and mode only', () => {
    expect(parseThemeLink('?theme=midnight-ocean', IDS)).toEqual({
      themeId: 'midnight-ocean',
      mode: null,
    });
    expect(parseThemeLink('?mode=high-contrast', IDS)).toEqual({
      themeId: null,
      mode: 'high-contrast',
    });
  });

  it('fails closed on an unknown theme id, keeping a valid mode', () => {
    expect(parseThemeLink('?theme=not-a-theme&mode=dark', IDS)).toEqual({
      themeId: null,
      mode: 'dark',
    });
  });

  it('ignores unknown modes and returns null when nothing valid is asked', () => {
    expect(parseThemeLink('?theme=violet&mode=neon', IDS)).toEqual({
      themeId: 'violet',
      mode: null,
    });
    expect(parseThemeLink('?theme=not-a-theme', IDS)).toBeNull();
    expect(parseThemeLink('', IDS)).toBeNull();
    expect(parseThemeLink('?q=gallery', IDS)).toBeNull();
  });
});

describe('themeLinkSearch', () => {
  it('keeps a non-default theme and a non-light mode', () => {
    expect(themeLinkSearch('violet', 'dark', 'enterprise-neutral')).toBe('?theme=violet&mode=dark');
    expect(themeLinkSearch('violet', 'high-contrast', 'enterprise-neutral')).toBe(
      '?theme=violet&mode=high-contrast'
    );
  });

  it('drops the site default theme and the light mode', () => {
    expect(themeLinkSearch('enterprise-neutral', 'light', 'enterprise-neutral')).toBe('');
    expect(themeLinkSearch('violet', 'light', 'enterprise-neutral')).toBe('?theme=violet');
    expect(themeLinkSearch('enterprise-neutral', 'dark', 'enterprise-neutral')).toBe('?mode=dark');
  });
});

describe('applyThemeFromLink', () => {
  it('ensures the linked theme CSS, then applies it with the painted mode preserved', async () => {
    document.documentElement.dataset.txTheme = 'enterprise-neutral';
    document.documentElement.dataset.txMode = 'dark';
    const ensureCss = vi.fn(() => Promise.resolve(true));
    const apply = vi.fn();
    const applied = await applyThemeFromLink(
      baseEnv({
        currentSearch: () => '?theme=violet',
        ensureCss,
        apply,
        storedModeChoice: () => 'dark',
      })
    );
    expect(applied).toEqual({ themeId: 'violet', mode: null });
    expect(ensureCss).toHaveBeenCalledWith('violet');
    const ensureOrder = ensureCss.mock.invocationCallOrder[0] ?? 0;
    const applyOrder = (apply as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0] ?? 0;
    expect(ensureOrder).toBeLessThan(applyOrder);
    expect(apply).toHaveBeenCalledWith('violet', 'dark');
  });

  it('keeps a "system" mode choice for a theme-only link instead of pinning the painted mode', async () => {
    document.documentElement.dataset.txTheme = 'enterprise-neutral';
    document.documentElement.dataset.txMode = 'dark';
    const apply = vi.fn();
    await applyThemeFromLink(baseEnv({ currentSearch: () => '?theme=violet', apply }));
    expect(apply).toHaveBeenCalledWith('violet', 'system');
  });

  it('never rewrites the stored mode preference when a link names only a theme', async () => {
    const namespace = 't84-theme-link';
    writeModePreference('system', namespace);
    document.documentElement.dataset.txTheme = 'enterprise-neutral';
    document.documentElement.dataset.txMode = 'dark';
    await applyThemeFromLink(
      baseEnv({
        currentSearch: () => '?theme=violet',
        apply: (themeId, mode) => {
          applySiteAppearance({ themeId, mode, varNames: [], namespace });
        },
        storedModeChoice: () => readModePreference(namespace),
      })
    );
    expect(document.documentElement.dataset.txTheme).toBe('violet');
    expect(readModePreference(namespace)).toBe('system');
  });

  it('applies the linked mode onto the painted theme', async () => {
    document.documentElement.dataset.txTheme = 'midnight-ocean';
    document.documentElement.dataset.txMode = 'light';
    const apply = vi.fn();
    await applyThemeFromLink(baseEnv({ currentSearch: () => '?mode=high-contrast', apply }));
    expect(apply).toHaveBeenCalledWith('midnight-ocean', 'high-contrast');
  });

  it('applies nothing when the link carries no valid params', async () => {
    const apply = vi.fn();
    expect(
      await applyThemeFromLink(baseEnv({ currentSearch: () => '?theme=nope', apply }))
    ).toBeNull();
    expect(apply).not.toHaveBeenCalled();
  });

  it('fails closed when the theme CSS never loads: no apply, no repaint', async () => {
    document.documentElement.dataset.txTheme = 'enterprise-neutral';
    document.documentElement.dataset.txMode = 'light';
    const apply = vi.fn();
    expect(
      await applyThemeFromLink(
        baseEnv({
          currentSearch: () => '?theme=violet',
          ensureCss: () => Promise.resolve(false),
          apply,
        })
      )
    ).toBeNull();
    expect(apply).not.toHaveBeenCalled();
  });
});

describe('wireThemeLinkSync', () => {
  function syncEnv(overrides: Partial<ThemeLinkSyncEnv> = {}): ThemeLinkSyncEnv {
    return {
      document,
      defaultThemeId: 'enterprise-neutral',
      currentSearch: () => '',
      replaceSearch: vi.fn(),
      ...overrides,
    };
  }

  it('mirrors an applied theme into the address bar', async () => {
    document.documentElement.dataset.txTheme = 'enterprise-neutral';
    document.documentElement.dataset.txMode = 'light';
    const replaceSearch = vi.fn();
    const stop = wireThemeLinkSync(syncEnv({ replaceSearch }));
    document.documentElement.dataset.txTheme = 'violet';
    await Promise.resolve();
    expect(replaceSearch).toHaveBeenCalledWith('?theme=violet');
    stop();
  });

  it('rewrites to the bare query when the appearance returns to the site default', async () => {
    document.documentElement.dataset.txTheme = 'violet';
    document.documentElement.dataset.txMode = 'dark';
    const replaceSearch = vi.fn();
    const stop = wireThemeLinkSync(
      syncEnv({ currentSearch: () => '?theme=violet&mode=dark', replaceSearch })
    );
    document.documentElement.dataset.txTheme = 'enterprise-neutral';
    document.documentElement.dataset.txMode = 'light';
    await Promise.resolve();
    expect(replaceSearch).toHaveBeenCalledWith('');
    stop();
  });

  it('does not rewrite while nothing changed', async () => {
    document.documentElement.dataset.txTheme = 'enterprise-neutral';
    document.documentElement.dataset.txMode = 'light';
    const replaceSearch = vi.fn();
    const stop = wireThemeLinkSync(syncEnv({ currentSearch: () => '', replaceSearch }));
    document.documentElement.dataset.txMode = 'light';
    await Promise.resolve();
    expect(replaceSearch).not.toHaveBeenCalled();
    stop();
  });
});

describe('wireCopyLink', () => {
  function host(): { button: HTMLButtonElement; status: HTMLElement } {
    const button = document.createElement('button');
    const status = document.createElement('p');
    document.body.append(button, status);
    return { button, status };
  }

  it('copies the current URL and reports through the status region', async () => {
    const { button, status } = host();
    const write = vi.fn(() => Promise.resolve());
    wireCopyLink({
      button,
      status,
      getHref: () => 'https://texuli.com/gallery-themes/?theme=violet',
      write,
    });
    button.click();
    await Promise.resolve();
    expect(write).toHaveBeenCalledWith('https://texuli.com/gallery-themes/?theme=violet');
    expect(status.textContent).toBe('Link copied.');
  });

  it('reports a blocked clipboard without throwing', async () => {
    const { button, status } = host();
    wireCopyLink({ button, status, write: () => Promise.reject(new Error('blocked')) });
    button.click();
    await Promise.resolve();
    expect(status.textContent).toBe('Copy failed: your browser blocked the clipboard.');
  });
});

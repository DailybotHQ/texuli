/**
 * Gallery surfaces (T-83, PLAN_006 gallery rows): curated showcase screens,
 * start-here starters and example lanes fail closed on ids that no longer
 * exist; theme deep links (?theme=&mode=) parse and apply fail-closed through
 * the site appearance path and mirror the painted appearance into the URL.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildExampleCatalog,
  type ExampleCatalogItem,
} from '../src/components/examples/catalog.ts';
import { exampleLanes, examplePackageCounts } from '../src/components/examples/lanes.ts';
import { pickStartHere, START_HERE_IDS } from '../src/components/gallery-components/start-here.ts';
import {
  applyThemeFromLink,
  parseThemeLink,
  type ThemeLinkEnv,
  type ThemeLinkSyncEnv,
  themeLinkSearch,
  wireCopyLink,
  wireThemeLinkSync,
} from '../src/components/gallery-themes/theme-link.ts';
import { HERO_IDS, heroScreens } from '../src/components/showcase/hero-screens.ts';
import { SHOWCASE_SCREENS, showcasePath } from '../src/components/showcase/showcase.ts';
import {
  applySiteAppearance,
  readModePreference,
  writeModePreference,
} from '../src/components/theme-switcher/appearance.ts';

describe('gallery curation', () => {
  /**
   * T-83 — gallery-area curation (PLAN_006 design-punchlist rows 1, 3 and 6).
   *
   * Three curation modules put curation on the proof surfaces without touching
   * another lane's islands:
   *
   * - `components/showcase/hero-screens.ts` picks the "start here" screens of the
   *   showcase index and fails closed when a curated id stops existing;
   * - `components/gallery-components/start-here.ts` picks the starter components;
   * - `components/examples/lanes.ts` groups the 157-example catalog into curated
   *   lanes and counts families.
   *
   * Each module runs against the real catalogs so a renamed id or a new example
   * family cannot silently drop out of the pages.
   */

  describe('showcase hero screens', () => {
    it('curates three existing hero screens and fails closed on unknown ids', () => {
      // curates three screens that all exist, in a stable order
      {
        const heroes = heroScreens(SHOWCASE_SCREENS);
        expect(heroes.map((hero) => hero.screen.id)).toEqual([...HERO_IDS]);
        expect(heroes).toHaveLength(3);
        for (const hero of heroes) {
          expect(showcasePath(hero.screen.id)).toBe(`/showcase/${hero.screen.id}/`);
          expect(hero.why.length).toBeGreaterThan(20);
        }
      }
      // fails closed: unknown curated ids never render
      {
        const heroes = heroScreens(SHOWCASE_SCREENS.filter((s) => s.id !== 'kanban'));
        expect(heroes.map((hero) => hero.screen.id)).not.toContain('kanban');
      }
      for (const hero of heroScreens(SHOWCASE_SCREENS)) {
        expect(hero.why).toMatch(/fictional|Harbor|widget|board|slide|deck/i);
      }
    });
  });

  describe('component gallery start-here row', () => {
    const card = (id: string, label = id, category = 'display') => ({
      id,
      label,
      summary: `${label} summary`,
      category,
      package: 'texuli',
      tier: 'component',
      agentEmittable: false,
      tags: [],
      variants: [],
      href: `/component-pages/${id}/`,
      examples: [],
      controls: [],
      initial: {},
    });

    it('keeps the curated starters in order, real, and skips removed ids', async () => {
      // keeps the curated order and resolves real cards
      {
        const picked = pickStartHere(
          [card('card'), card('button'), card('dialog')],
          ['button', 'card', 'dialog']
        );
        expect(picked.map((c) => c.id)).toEqual(['button', 'card', 'dialog']);
      }
      // skips curated ids that no longer exist instead of rendering dead links
      {
        const picked = pickStartHere([card('button')], ['button', 'removed-thing']);
        expect(picked.map((c) => c.id)).toEqual(['button']);
      }
      // every curated starter id exists in the real catalog
      {
        const { buildGalleryComponentCards } = await import(
          '../src/components/gallery-components/catalog.ts'
        );
        const cards = buildGalleryComponentCards();
        const picked = pickStartHere(cards);
        expect(picked.map((c) => c.id)).toEqual([...START_HERE_IDS]);
        for (const entry of picked) {
          expect(entry.href).toBe(`/component-pages/${entry.id}/`);
        }
      }
    });
  });

  function item(partial: Partial<ExampleCatalogItem>): ExampleCatalogItem {
    return {
      id: 'texuli-button',
      title: 'Button',
      description: 'A button.',
      tags: ['texuli'],
      component: 'texuli/button',
      packageId: 'texuli',
      kind: 'button',
      props: [],
      source: null,
      sourcePath: null,
      ...partial,
    };
  }

  describe('examples lanes', () => {
    const items: ExampleCatalogItem[] = [
      item({ id: 'data-grid', kind: 'grid', packageId: 'data', component: 'data/grid' }),
      item({ id: 'data-stat', kind: 'stat', packageId: 'data' }),
      item({ id: 'texuli-input', kind: 'input', packageId: 'texuli', component: 'texuli/input' }),
      item({ id: 'slides-deck', kind: 'deck', packageId: 'slides' }),
      item({ id: 'blocks-code', kind: 'code', packageId: 'blocks' }),
    ];

    it('groups the real catalog into capped job lanes whose counts add up', () => {
      // groups examples into the curated job lanes, capped, in catalog order
      {
        const lanes = exampleLanes(items);
        const byId = new Map(lanes.map((lane) => [lane.id, lane]));
        expect(byId.get('dashboards')?.items.map((i) => i.id)).toEqual(['data-grid', 'data-stat']);
        expect(byId.get('forms')?.items.map((i) => i.id)).toEqual(['texuli-input']);
        expect(byId.get('decks')?.items.map((i) => i.id)).toEqual(['slides-deck']);
        expect(byId.get('docs-content')?.items.map((i) => i.id)).toEqual(['blocks-code']);
      }
      // caps each lane so the shelf stays a shelf
      {
        const many = Array.from({ length: 20 }, (_, i) => item({ id: `deck-${i}`, kind: 'deck' }));
        const lanes = exampleLanes(many);
        expect(lanes[0]?.items).toHaveLength(6);
      }
      // counts families over the real catalog: totals add up, decks exist
      {
        const catalog = buildExampleCatalog();
        const lanes = exampleLanes(catalog);
        expect(lanes.length).toBeGreaterThanOrEqual(4);
        for (const lane of lanes) {
          expect(lane.items.length).toBeGreaterThan(0);
          expect(lane.items.length).toBeLessThanOrEqual(6);
          for (const entry of lane.items) {
            expect(catalog.some((c) => c.id === entry.id)).toBe(true);
          }
        }
        const decks = lanes.find((lane) => lane.id === 'decks');
        expect(decks).toBeDefined();

        const counts = examplePackageCounts(catalog);
        expect(counts.reduce((sum, entry) => sum + entry.count, 0)).toBe(catalog.length);
        expect(counts[0]?.count).toBe(Math.max(...counts.map((c) => c.count)));
      }
    });
  });
});

describe('theme-gallery deep links', () => {
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
    it('reads valid theme and mode pairs and fails closed on unknown values', () => {
      expect(parseThemeLink('?theme=violet&mode=dark', IDS)).toEqual({
        themeId: 'violet',
        mode: 'dark',
      });
      expect(parseThemeLink('?theme=midnight-ocean', IDS)).toEqual({
        themeId: 'midnight-ocean',
        mode: null,
      });
      expect(parseThemeLink('?mode=high-contrast', IDS)).toEqual({
        themeId: null,
        mode: 'high-contrast',
      });
      expect(parseThemeLink('?theme=not-a-theme&mode=dark', IDS)).toEqual({
        themeId: null,
        mode: 'dark',
      });
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
    it('keeps only non-default theme and non-light mode in the query', () => {
      expect(themeLinkSearch('violet', 'dark', 'enterprise-neutral')).toBe(
        '?theme=violet&mode=dark'
      );
      expect(themeLinkSearch('violet', 'high-contrast', 'enterprise-neutral')).toBe(
        '?theme=violet&mode=high-contrast'
      );
      expect(themeLinkSearch('enterprise-neutral', 'light', 'enterprise-neutral')).toBe('');
      expect(themeLinkSearch('violet', 'light', 'enterprise-neutral')).toBe('?theme=violet');
      expect(themeLinkSearch('enterprise-neutral', 'dark', 'enterprise-neutral')).toBe(
        '?mode=dark'
      );
    });
  });

  describe('applyThemeFromLink', () => {
    it('applies the linked appearance after its CSS loads, never rewriting the stored mode, and fails closed', async () => {
      // ensures the linked theme CSS, then applies it with the painted mode preserved
      {
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
      }
      // keeps a "system" mode choice for a theme-only link instead of pinning the painted mode
      {
        document.documentElement.dataset.txTheme = 'enterprise-neutral';
        document.documentElement.dataset.txMode = 'dark';
        const apply = vi.fn();
        await applyThemeFromLink(baseEnv({ currentSearch: () => '?theme=violet', apply }));
        expect(apply).toHaveBeenCalledWith('violet', 'system');
      }
      // never rewrites the stored mode preference when a link names only a theme
      {
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
      }
      // applies the linked mode onto the painted theme
      {
        document.documentElement.dataset.txTheme = 'midnight-ocean';
        document.documentElement.dataset.txMode = 'light';
        const apply = vi.fn();
        await applyThemeFromLink(baseEnv({ currentSearch: () => '?mode=high-contrast', apply }));
        expect(apply).toHaveBeenCalledWith('midnight-ocean', 'high-contrast');
      }
      // applies nothing when the link carries no valid params
      {
        const apply = vi.fn();
        expect(
          await applyThemeFromLink(baseEnv({ currentSearch: () => '?theme=nope', apply }))
        ).toBeNull();
        expect(apply).not.toHaveBeenCalled();
      }
      // fails closed when the theme CSS never loads: no apply, no repaint
      {
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
      }
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

    it('mirrors the painted appearance into the address bar only on change', async () => {
      // mirrors an applied theme into the address bar
      {
        document.documentElement.dataset.txTheme = 'enterprise-neutral';
        document.documentElement.dataset.txMode = 'light';
        const replaceSearch = vi.fn();
        const stop = wireThemeLinkSync(syncEnv({ replaceSearch }));
        document.documentElement.dataset.txTheme = 'violet';
        await Promise.resolve();
        expect(replaceSearch).toHaveBeenCalledWith('?theme=violet');
        stop();
      }
      // rewrites to the bare query when the appearance returns to the site default
      {
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
      }
      // does not rewrite while nothing changed
      {
        document.documentElement.dataset.txTheme = 'enterprise-neutral';
        document.documentElement.dataset.txMode = 'light';
        const replaceSearch = vi.fn();
        const stop = wireThemeLinkSync(syncEnv({ currentSearch: () => '', replaceSearch }));
        document.documentElement.dataset.txMode = 'light';
        await Promise.resolve();
        expect(replaceSearch).not.toHaveBeenCalled();
        stop();
      }
    });
  });

  describe('wireCopyLink', () => {
    function host(): { button: HTMLButtonElement; status: HTMLElement } {
      const button = document.createElement('button');
      const status = document.createElement('p');
      document.body.append(button, status);
      return { button, status };
    }

    it('copies the URL and reports success or a blocked clipboard through the status region', async () => {
      // copies the current URL and reports through the status region
      {
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
      }
      // reports a blocked clipboard without throwing
      {
        const { button, status } = host();
        wireCopyLink({ button, status, write: () => Promise.reject(new Error('blocked')) });
        button.click();
        await Promise.resolve();
        expect(status.textContent).toBe('Copy failed: your browser blocked the clipboard.');
      }
    });
  });
});

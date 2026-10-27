/**
 * T-81 — punch-list row 4: the "in your theme" strip on component pages.
 *
 * The T-06 census found the 210-theme engine invisible on component pages.
 * The strip shows three real library themes with token values computed by
 * the token engine at build (`themes-sample.ts`), rendered as static HTML.
 * The vitest suite cannot compile .astro templates, so `ThemeStrip.astro` is
 * pinned at its seams as source (the pattern of `web-hero.test.ts`).
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  libraryThemeCount,
  loadStripThemes,
  STRIP_THEME_IDS,
  STRIP_VARS,
  stripVarsStyle,
} from '../src/components/component-pages/themes-sample.ts';

const srcDir = resolve(dirname(fileURLToPath(import.meta.url)), '../src');
const readSource = (fromSrc: string) => readFileSync(resolve(srcDir, fromSrc), 'utf8');

const stripSource = readSource('components/component-pages/ThemeStrip.astro');
const bodySource = readSource('components/component-pages/ComponentPageBody.astro');

// Loaded once; every test below awaits the same build-time computation.
const stripThemes = loadStripThemes();

describe('the curated strip set', () => {
  it('names three distinct themes', () => {
    expect(STRIP_THEME_IDS).toHaveLength(3);
    expect(new Set(STRIP_THEME_IDS).size).toBe(3);
  });
});

describe('the strip themes come from the real library', () => {
  it('loads one card per curated id, in order', async () => {
    const themes = await stripThemes;
    expect(themes.map((theme) => theme.id)).toEqual([...STRIP_THEME_IDS]);
  });

  it('carries a full set of real token variables on every card', async () => {
    const themes = await stripThemes;
    for (const theme of themes) {
      for (const name of STRIP_VARS) {
        const value = theme.vars[name];
        expect(value, `${theme.id} misses ${name}`).toBeTruthy();
        expect(typeof value).toBe('string');
      }
    }
  });

  it('paints colors with the engine’s values and radius with a length', async () => {
    const themes = await stripThemes;
    for (const theme of themes) {
      for (const [name, value] of Object.entries(theme.vars)) {
        if (name === '--tx-radius') {
          expect(value.endsWith('rem') || value.endsWith('px')).toBe(true);
        } else {
          expect(value.startsWith('#'), `${name}=${value} is not a hex color`).toBe(true);
        }
      }
    }
  });

  it('spreads the gamut: saturated light, muted light and dark AAA', async () => {
    const themes = await stripThemes;
    // Distinct primaries: violet is saturated, monochrome is muted.
    const primaries = new Set(themes.map((theme) => theme.vars['--tx-primary']));
    expect(primaries.size).toBe(themes.length);
    // Both modes appear, and one card is dark.
    const modes = new Set(themes.map((theme) => theme.mode));
    expect(modes.has('light')).toBe(true);
    expect(modes.has('dark')).toBe(true);
    expect(themes.some((theme) => theme.mode === 'dark')).toBe(true);
    // The dark card carries the library's own contrast gate above AA.
    expect(themes.some((theme) => theme.contrastLevel === 'AAA')).toBe(true);
    // Dark-first themes show their dark values, not their light ones.
    for (const theme of themes) {
      if (theme.mode === 'dark') {
        const background = theme.vars['--tx-background'];
        expect(parseInt(background.slice(1, 3), 16)).toBeLessThan(0x60);
      }
    }
  });

  it('every library theme the strip shows exists with its metadata', async () => {
    const themes = await stripThemes;
    for (const theme of themes) {
      expect(theme.name).not.toBe(theme.id);
      expect(theme.category.length).toBeGreaterThan(0);
      expect(['AA', 'AAA']).toContain(theme.contrastLevel);
    }
  });
});

describe('the strip stays budgeted and static', () => {
  it('the library count is computed, not hardcoded', async () => {
    const count = await libraryThemeCount();
    expect(count).toBeGreaterThanOrEqual(210);
  });

  it('serializes card variables as a flat style value', () => {
    const style = stripVarsStyle({ '--tx-background': '#ffffff', '--tx-radius': '0.5rem' });
    expect(style).toBe('--tx-background:#ffffff;--tx-radius:0.5rem');
  });
});

describe('the strip template keeps the site contract', () => {
  it('renders statically: no island, no HTML sink', () => {
    expect(stripSource).not.toContain('client:');
    expect(stripSource).not.toContain('@html');
    expect(stripSource).not.toContain('innerHTML');
  });

  it('is labeled, listed and linked honestly', () => {
    expect(stripSource).toContain('aria-labelledby="cp-themes-title"');
    expect(stripSource).toContain('role="list"');
    expect(stripSource).toContain('href="/theme-studio/"');
    expect(stripSource).toContain('data-theme-count');
  });

  it('decorative color chips hide from assistive technology', () => {
    expect(stripSource).toContain('aria-hidden="true"');
  });

  it('uses logical CSS and never animates (reduced motion by construction)', () => {
    const style = stripSource.slice(stripSource.lastIndexOf('<style>'));
    expect(style).not.toMatch(/(padding|margin)-(left|right):/);
    expect(style).not.toMatch(/[^-](left|right):\s/);
    expect(style).not.toMatch(/transition|animation|@keyframes/);
    expect(style).toContain('inline-size');
  });

  it('the component page body mounts the strip', () => {
    expect(bodySource).toContain('<ThemeStrip />');
  });

  it('mounts the strip after the live examples, so the first demo stays in the first screen', () => {
    // The first LiveDemo is client:visible: a strip above it (7996bbd7) moved
    // it below the fold, and no component page mounted its stage on load.
    const strip = bodySource.indexOf('<ThemeStrip />');
    const examplesEnd = bodySource.indexOf('aria-labelledby="cp-props"');
    expect(bodySource.indexOf('aria-labelledby="cp-examples"')).toBeLessThan(strip);
    expect(bodySource.indexOf('<LiveDemo')).toBeLessThan(strip);
    expect(strip).toBeLessThan(examplesEnd);
  });
});

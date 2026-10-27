/**
 * T-40 — the unified landing's hero section (`WebHero.astro` +
 * `web-hero-content.ts`).
 *
 * The vitest suite cannot compile .astro templates, so the tests pin the
 * section at its two seams:
 *
 *  1. the content module — the copy is the narrative blueprint's recorded
 *     hero decision (eyebrow, h1, sub-message, CTA pair), every link target
 *     is a real site route on disk, and the theme loader serves real themes
 *     from the real token engine (no fake product shots);
 *  2. the section template, read as source — landmark and heading shape,
 *     the URL policy on every rendered link, no HTML sinks, no screenshots,
 *     logical CSS, and a fully static visual (reduced motion is respected
 *     by construction: nothing moves).
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  countAllThemes,
  loadHeroThemes,
  WEB_HERO_ACTIONS,
  WEB_HERO_EYEBROW,
  WEB_HERO_GRID_CAPTION,
  WEB_HERO_GRID_LINKS,
  WEB_HERO_IDS,
  WEB_HERO_SUB,
  WEB_HERO_THEME_IDS,
  WEB_HERO_TITLE,
} from '../src/components/sections/web/web-hero-content.ts';

/**
 * Vitest (vite-node) does not expose `import.meta.url` as a file URL, so
 * the repository root is found by walking up from the working directory to
 * the `pnpm-workspace.yaml` marker — robust to any cwd inside the checkout.
 */
function findRepoRoot(): string {
  let dir = process.cwd();
  for (;;) {
    if (existsSync(resolve(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) throw new Error(`repository root not found from ${process.cwd()}`);
    dir = parent;
  }
}

const REPO_ROOT = findRepoRoot();
const SECTION_FILE = 'apps/website/src/components/sections/web/WebHero.astro';

const readRepo = (relativePath: string): string =>
  readFileSync(resolve(REPO_ROOT, relativePath), 'utf8');

const sectionSource = readRepo(SECTION_FILE);
const template = sectionSource.slice(
  sectionSource.indexOf('---', sectionSource.indexOf('---') + 3) + 3
);
const style = sectionSource.slice(sectionSource.lastIndexOf('<style>'));

describe('hero copy is the blueprint decision, verbatim', () => {
  it('keeps the recorded eyebrow and h1 from narrative blueprint §1', () => {
    expect(WEB_HERO_EYEBROW).toBe('One catalog · web and native');
    expect(WEB_HERO_TITLE).toBe('Interfaces from texels.');
  });

  it('tells the platform story in the sub-message: web today, native in development', () => {
    expect(WEB_HERO_SUB).toContain('texels compose into primitives');
    expect(WEB_HERO_SUB).toContain('Svelte 5');
    expect(WEB_HERO_SUB).toContain('in development');
    expect(WEB_HERO_SUB).toContain('agents render through it');
  });

  it('renders the eyebrow, title and sub from the module, not from template literals', () => {
    expect(template).toContain('{WEB_HERO_EYEBROW}');
    expect(template).toContain('id={WEB_HERO_IDS.hero}>{WEB_HERO_TITLE}</h1>');
    expect(template).toContain('{WEB_HERO_SUB}');
  });
});

describe('every hero link is a real site route passed through the URL policy', () => {
  const links = [...WEB_HERO_ACTIONS, ...WEB_HERO_GRID_LINKS];

  it('has one primary start-building CTA and one native-story CTA', () => {
    expect(WEB_HERO_ACTIONS.map((link) => link.role)).toEqual(['primary', 'secondary']);
    expect(WEB_HERO_ACTIONS[0]).toMatchObject({ href: '/guides/getting-started/' });
    expect(WEB_HERO_ACTIONS[1]).toMatchObject({ href: '/native/' });
  });

  it.each(links.map((link) => [link.href, link.label] as const))(
    'route %s (%s) exists as a page in this checkout',
    (href) => {
      expect(existsSync(resolve(REPO_ROOT, `apps/website/src/pages${href}`, 'index.astro'))).toBe(
        true
      );
    }
  );

  it('resolves every rendered link through safeHref at the developer tier', () => {
    expect(sectionSource).toContain("safeHref(href, 'developer')");
    expect(template).toContain('href={resolveHref(link.href)}');
    expect(template.match(/href="\/[^"]*"/g) ?? []).toEqual([]);
  });
});

describe('the visual moment is real product data, not a product shot', () => {
  it('loads exactly the six builtin preset themes by id', () => {
    expect(WEB_HERO_THEME_IDS).toEqual([
      'violet',
      'ocean',
      'emerald',
      'rose',
      'amber',
      'monochrome',
    ]);
  });

  it('the loader returns real library themes with real names and five palette values', async () => {
    const themes = await loadHeroThemes();
    expect(themes.map((theme) => theme.id)).toEqual([...WEB_HERO_THEME_IDS]);
    for (const theme of themes) {
      expect(theme.name.trim().length).toBeGreaterThan(0);
      expect(theme.name).not.toBe(theme.id);
      for (const value of Object.values(theme.swatches)) {
        expect(typeof value).toBe('string');
        expect(value.length).toBeGreaterThan(0);
        expect(value).toMatch(/^(oklch|#[0-9a-fA-F]{3,8}|color\(|lab\(|lch\()/);
      }
    }
  });

  it('the theme count is computed from the library, not hardcoded', async () => {
    const count = await countAllThemes();
    expect(count).toBeGreaterThanOrEqual(200);
    expect(template).toContain('{themeCount}');
    expect(template).not.toMatch(/>\s*210 themes/);
  });

  it('renders no images, screenshots or remote visuals', () => {
    expect(template).not.toContain('<img');
    expect(template).not.toContain('<picture');
    expect(template).not.toContain('<video');
    expect(style).not.toMatch(/background-image:\s*url\(/);
    expect(sectionSource).toContain('loadHeroThemes()');
  });

  it('feeds palette values through per-card custom properties built from the loader data', () => {
    expect(template).toMatch(/--swatch-background:\s*\$\{theme\.swatches\.background\}/);
    expect(template).toMatch(/--swatch-foreground:\s*\$\{theme\.swatches\.foreground\}/);
    expect(template).toMatch(/--swatch-primary:\s*\$\{theme\.swatches\.primary\}/);
    expect(template).toContain('var(--swatch-');
  });
});

describe('section structure and landmarks', () => {
  it('renders one labelled section landmark named by its h1', () => {
    const sections = template.match(/<section[^>]*>/g) ?? [];
    expect(sections).toHaveLength(1);
    expect(sections[0]).toContain(`aria-labelledby={WEB_HERO_IDS.hero}`);
    expect(sections[0]).toContain('data-tx-web-hero');
    expect(template).toContain(`<h1 id={WEB_HERO_IDS.hero}>`);
  });

  it('keeps heading order h1 then the theme-grid h2', () => {
    const levels = [...template.matchAll(/<h([1-6])\b/g)].map((match) => match[1]);
    expect(levels).toEqual(['1', '2']);
    expect(template).toContain('<h2');
    expect(template).toContain(`id={WEB_HERO_IDS.themes}`);
  });

  it('binds every aria/heading id to a module constant', () => {
    expect(WEB_HERO_IDS.hero).toBe('web-hero-title');
    expect(WEB_HERO_IDS.themes).toBe('web-hero-themes-title');
  });
});

describe('the honesty contract', () => {
  const copy = `${WEB_HERO_EYEBROW} ${WEB_HERO_TITLE} ${WEB_HERO_SUB} ${WEB_HERO_GRID_CAPTION}`;

  it('claims the system, not released artifacts: no version or npm claim in the hero', () => {
    // Blueprint §6: the footer status line is the single place "preview on
    // npm" is claimed sitewide; the hero stays version-free.
    expect(copy).not.toMatch(/0\.1\.0/);
    expect(copy).not.toMatch(/\bnpm\b/);
    expect(copy).not.toMatch(/dist-tag/i);
  });

  it.each([/coming soon/i, /production-ready/i, /write once/i, /\b20\d\d\b/])(
    'never matches the banned claim %s',
    (banned) => {
      expect(banned.test(copy)).toBe(false);
    }
  );

  it('says the native half is in development', () => {
    expect(WEB_HERO_SUB).toContain('in development');
  });
});

describe('a11y and style baseline', () => {
  it('renders no HTML sink anywhere', () => {
    expect(template).not.toContain('{@html');
    expect(template).not.toContain('set:html');
    expect(sectionSource).not.toContain('innerHTML');
  });

  it('labels the decorative swatch chips so color-only elements stay out of the tree', () => {
    expect(template).toMatch(/<span class="web-hero__chips" aria-hidden="true">/);
    expect(template).toContain('>Aa</span>');
  });

  it('styles through --tx-* tokens and logical properties only', () => {
    expect(style).toMatch(/var\(--tx-/);
    expect(style).toMatch(/inline-size/);
    for (const physical of [
      /[^-]margin-left:/,
      /[^-]margin-right:/,
      /[^-]padding-left:/,
      /[^-]padding-right:/,
      /[^-](left|right):/,
      /text-align:\s*(left|right)/,
    ]) {
      expect(physical.test(style)).toBe(false);
    }
  });

  it('is fluid at 360px and adapts at the desktop breakpoint', () => {
    expect(style).toMatch(/clamp\(/);
    expect(style).toMatch(/@media \(min-width: 56rem\)/);
    expect(style).toMatch(/@media \(forced-colors: active\)/);
  });

  it('is fully static: nothing animates, so reduced motion is respected by construction', () => {
    expect(style).not.toMatch(/animation/);
    expect(style).not.toMatch(/transition/);
    expect(sectionSource).not.toMatch(/<script/);
  });
});

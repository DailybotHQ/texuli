/**
 * Brand surfaces, read as source (no Astro renderer in the unit environment;
 * the a11y-site and site-brand e2e specs check the built pages): the T-92
 * asset diet (WebP with PNG fallbacks, density copies, every named file
 * exists), the BrandLogo switch under forced colors and site modes with one
 * image in the accessibility tree, and the W18 fixed logo surfaces.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('brand assets (T-92)', () => {
  /**
   * T-92 — brand asset diet (PLAN_006 perf-assets): the logo and brand-page
   * images ship as lossless WebP inside <picture>, each with its PNG fallback;
   * the header logo picks a copy sized for the screen density; every brand file
   * a template names exists; and the light/dark logo switch is intact.
   *
   * The vitest suite cannot compile .astro templates, so templates are read as
   * source, and image sizes are read from the file headers.
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

  const WEBSITE = resolve(findRepoRoot(), 'apps/website');
  const BRAND = resolve(WEBSITE, 'public/brand');
  const read = (path: string): string => readFileSync(resolve(WEBSITE, path), 'utf8');

  const logo = read('src/components/brand/BrandLogo.astro');
  const head = read('src/components/brand/BrandHead.astro');
  const page = read('src/pages/brand/index.astro');
  const manifest = read('public/site.webmanifest');

  /** Width and height of a PNG or WebP (VP8L, VP8X or VP8) from its header. */
  function dimensions(file: string): { width: number; height: number } {
    const b = readFileSync(resolve(BRAND, file));
    if (b.toString('ascii', 1, 4) === 'PNG')
      return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
    const chunk = b.toString('ascii', 12, 16);
    if (chunk === 'VP8L') {
      const bits = b.readUInt32LE(21);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
    if (chunk === 'VP8X')
      return { width: b.readUIntLE(24, 3) + 1, height: b.readUIntLE(27, 3) + 1 };
    if (chunk === 'VP8 ')
      return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
    throw new Error(`${file}: not a PNG or WebP`);
  }

  describe('brand assets (T-92)', () => {
    it('names only existing brand files, each WebP with its same-size PNG fallback and density copies', () => {
      // names only brand files that exist
      {
        const named = new Set<string>();
        for (const source of [head, page, manifest]) {
          for (const match of source.matchAll(/texuli-[a-z0-9-]+\.(?:png|webp)/g))
            named.add(match[0]);
        }
        for (const variant of ['logo', 'isotype']) {
          for (const mode of ['light', 'dark']) {
            named.add(`texuli-${variant}-${mode}.png`);
            named.add(`texuli-${variant}-${mode}.webp`);
          }
        }
        for (const mode of ['light', 'dark']) {
          named.add(`texuli-logo-${mode}-72.png`);
          for (const h of [24, 48, 72]) named.add(`texuli-logo-${mode}-${h}.webp`);
        }
        expect(named.size).toBeGreaterThan(20);
        for (const file of named) expect(existsSync(resolve(BRAND, file)), file).toBe(true);
      }
      // gives every WebP a PNG fallback of the same artwork
      {
        const webps = readdirSync(BRAND).filter((name) => name.endsWith('.webp'));
        expect(webps.length).toBeGreaterThanOrEqual(10);
        for (const webp of webps) {
          // Density copies (-24, -48) fall back to the 72 px PNG.
          const png = webp.replace(/-(?:24|48)\.webp$/, '-72.webp').replace(/\.webp$/, '.png');
          expect(existsSync(resolve(BRAND, png)), `${webp} → ${png}`).toBe(true);
          const w = dimensions(webp);
          const p = dimensions(png);
          // Same aspect ratio within a pixel of rounding.
          expect(Math.abs(w.width / w.height - p.width / p.height), webp).toBeLessThan(0.05);
        }
      }
      // serves the brand-page marks as WebP with the PNG in the img
      {
        const pictures = [...page.matchAll(/<picture>([\s\S]*?)<\/picture>/g)].map(
          (m) => m[1] ?? ''
        );
        expect(pictures).toHaveLength(4);
        for (const body of pictures) {
          const webp = body.match(
            /<source srcset=\{asset\('([^']+\.webp)'\)\} type="image\/webp" \/>/
          )?.[1];
          const png = body.match(/<img[\s\S]*?src=\{asset\('([^']+\.png)'\)\}/)?.[1];
          expect(webp, body).toBeDefined();
          expect(png).toBe(webp?.replace(/\.webp$/, '.png'));
        }
        // Downloads stay PNG.
        expect(page).toMatch(/href=\{asset\('texuli-logo-light\.png'\)\} download/);
      }
      // keeps the site header on the WebP logo (load-bearing for /web-and-native/)
      {
        // The header renders the small logo path (24 px tall or less)...
        const header = read('src/components/foundation/SiteHeader.astro');
        const height = Number(header.match(/<BrandLogo height=\{(\d+)\} \/>/)?.[1]);
        expect(height).toBeGreaterThan(0);
        expect(height).toBeLessThanOrEqual(24);
        expect(logo).toContain("const small = variant === 'logo' && height <= 24;");
        // ...whose WebP source comes first in each <picture>, the 72 px PNG only as
        // the <img> fallback. Back to PNG-only, a 1x page loads 3.7 KB instead of
        // 1.1 KB gzip and /web-and-native/ goes over its 96 KB page budget (T-92).
        expect(logo).toMatch(
          /const file = \(mode: Mode\) => `\$\{stem\(mode\)\}\$\{small \? '-72' : ''\}\.png`;/
        );
        for (const mode of ['light', 'dark']) {
          expect(logo).toMatch(
            new RegExp(
              `<picture>\\s*<source srcset=\\{webp\\('${mode}'\\)\\} type="image/webp" />\\s*<img class="brand-logo__${mode}" src=\\{file\\('${mode}'\\)\\}`
            )
          );
        }
        expect(logo).toMatch(/small\s*\?\s*`\$\{stem\(mode\)\}-24\.webp 1x/);
      }
      // gives the header logo a 1x, 2x and 3x WebP copy, PNG fallback
      {
        expect(logo).toMatch(
          /-24\.webp 1x, \$\{stem\(mode\)\}-48\.webp 2x, \$\{stem\(mode\)\}-72\.webp 3x/
        );
        expect(
          logo.match(/<source srcset=\{webp\('(light|dark)'\)\} type="image\/webp" \/>/g)
        ).toHaveLength(2);
        for (const mode of ['light', 'dark']) {
          for (const h of [24, 48, 72]) {
            const { width, height } = dimensions(`texuli-logo-${mode}-${h}.webp`);
            expect(height, `${mode}-${h}`).toBe(h);
            expect(width, `${mode}-${h}`).toBe(Math.round((h * 3332) / 972));
          }
          expect(dimensions(`texuli-logo-${mode}-72.png`).height).toBe(72);
        }
        // A 1x screen loads well under half the 72 px PNG.
        const bytes = (file: string) => readFileSync(resolve(BRAND, file)).length;
        expect(bytes('texuli-logo-light-24.webp')).toBeLessThan(
          bytes('texuli-logo-light-72.png') / 2
        );
      }
      expect(logo).toMatch(/<img class="brand-logo__light"[^>]*alt="Texuli"[^>]*loading="lazy"/);
      expect(logo).toMatch(
        /<img class="brand-logo__dark"[^>]*alt="" aria-hidden="true"[^>]*loading="lazy"/
      );
      expect(logo).toMatch(/\.brand-logo picture \{\s*display: contents;/);
      expect(logo).toMatch(/\.brand-logo__dark \{\s*display: none;/);
      expect(logo).toMatch(
        /:root\[data-tx-mode='dark'\]\) \.brand-logo__light \{\s*display: none;/
      );
      expect(logo).toMatch(
        /:root\[data-tx-mode='dark'\]\) \.brand-logo__dark \{\s*display: block;/
      );
    });
  });
});

describe('BrandLogo color switch', () => {
  /**
   * PLAN_006 Final Review P2-6: the header logo under forced colors.
   *
   * The logo's light and dark images are raster artwork (black on light
   * modes, white on dark ones), which forced colors never recolor. The variant
   * followed the site's chosen `data-tx-mode`, so a visitor who chose Light
   * while their system forced a dark palette got the black logo on a black
   * Canvas. Under `forced-colors: active` the variant must follow the forced
   * palette instead, which `prefers-color-scheme` reports.
   *
   * The unit environment has no Astro renderer, so the cascade is resolved
   * from the component source (the docs-reading.test.ts convention). Only one
   * image may display at a time: `display: none` keeps the other out of the
   * accessibility tree, so the alt="Texuli" / aria-hidden pairing still exposes
   * at most one image. The WebP <picture> structure stays pinned by
   * the brand assets describe in this file.
   */

  const HERE = dirname(fileURLToPath(import.meta.url));
  const logo = readFileSync(resolve(HERE, '../src/components/brand/BrandLogo.astro'), 'utf8');

  interface Env {
    forced: boolean;
    scheme: 'light' | 'dark';
    mode: 'light' | 'dark' | undefined;
  }

  interface Rule {
    selector: string;
    display: string;
    query: string;
    order: number;
  }

  function parseRules(source: string): Rule[] {
    const css = (source.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? '').replace(
      /\/\*[\s\S]*?\*\//g,
      ''
    );
    const rules: Rule[] = [];
    let order = 0;
    const pushBlock = (body: string, query: string) => {
      for (const match of body.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        const display = match[2].match(/(?:^|;)\s*display:\s*([^;]+)/)?.[1]?.trim();
        if (!display) continue;
        for (const selector of match[1].split(',')) {
          rules.push({ selector: selector.trim(), display, query, order: order++ });
        }
      }
    };
    let rest = css;
    for (;;) {
      const at = rest.search(/@media\b/);
      if (at === -1) {
        pushBlock(rest, '');
        break;
      }
      pushBlock(rest.slice(0, at), '');
      const open = rest.indexOf('{', at);
      const query = rest.slice(at + '@media'.length, open).trim();
      let depth = 1;
      let index = open + 1;
      while (depth > 0) {
        if (rest[index] === '{') depth += 1;
        if (rest[index] === '}') depth -= 1;
        index += 1;
      }
      pushBlock(rest.slice(open + 1, index - 1), query);
      rest = rest.slice(index);
    }
    return rules;
  }

  function queryMatches(query: string, env: Env): boolean {
    if (!query) return true;
    return query.split(/\s+and\s+/).every((feature) => {
      const [name, value] = feature
        .replace(/[()]/g, '')
        .split(':')
        .map((part) => part.trim());
      if (name === 'forced-colors') return (value === 'active') === env.forced;
      if (name === 'prefers-color-scheme') return value === env.scheme;
      return false;
    });
  }

  /** Match `.x`, `:global(:root[data-tx-mode]) .x` and `:global(:root[data-tx-mode='dark']) .x`. */
  function selectorMatches(selector: string, target: string, env: Env): boolean {
    const plain = selector.replace(/:global\(([^)]*\]?)\)/g, '$1');
    const parts = plain.split(/\s+/);
    if (parts.at(-1) !== `.${target}`) return false;
    const ancestor = parts.slice(0, -1).join(' ');
    if (!ancestor) return true;
    const mode = ancestor.match(/^:root\[data-tx-mode(?:='(\w+)')?\]$/);
    if (!mode) return false;
    return mode[1] === undefined ? env.mode !== undefined : env.mode === mode[1];
  }

  const specificity = (selector: string) =>
    (selector.replace(/:global\(|\)/g, '').match(/\.[\w-]+|\[[^\]]*\]|:root/g) ?? []).length;

  function displayOf(target: string, env: Env): string {
    let best: Rule | undefined;
    for (const rule of parseRules(logo)) {
      if (!queryMatches(rule.query, env) || !selectorMatches(rule.selector, target, env)) continue;
      if (
        !best ||
        specificity(rule.selector) > specificity(best.selector) ||
        (specificity(rule.selector) === specificity(best.selector) && rule.order > best.order)
      ) {
        best = rule;
      }
    }
    return best?.display ?? 'inline';
  }

  const shown = (env: Env) => ({
    light: displayOf('brand-logo__light', env) !== 'none',
    dark: displayOf('brand-logo__dark', env) !== 'none',
  });

  const modes = ['light', 'dark', undefined] as const;

  describe('BrandLogo follows the forced palette, else the site mode', () => {
    it('shows the logo that contrasts with the forced Canvas, or with the site mode', () => {
      for (const mode of modes) {
        const where = `site mode ${mode ?? 'unset'}`;
        expect(shown({ forced: true, scheme: 'dark', mode }), `forced dark, ${where}`).toEqual({
          light: false,
          dark: true,
        });
        expect(shown({ forced: true, scheme: 'light', mode }), `forced light, ${where}`).toEqual({
          light: true,
          dark: false,
        });
      }
      for (const scheme of ['light', 'dark'] as const) {
        for (const [mode, expected] of [
          ['light', { light: true, dark: false }],
          [undefined, { light: true, dark: false }],
          ['dark', { light: false, dark: true }],
        ] as const) {
          expect(shown({ forced: false, scheme, mode }), `system ${scheme}, mode ${mode}`).toEqual(
            expected
          );
        }
      }
    });
  });

  describe('BrandLogo keeps one image in the accessibility tree', () => {
    it('never displays both images, and pairs alt with aria-hidden', () => {
      for (const forced of [true, false]) {
        for (const scheme of ['light', 'dark'] as const) {
          for (const mode of modes) {
            const { light, dark } = shown({ forced, scheme, mode });
            expect(Number(light) + Number(dark), JSON.stringify({ forced, scheme, mode })).toBe(1);
          }
        }
      }
      expect(logo).toMatch(/<img class="brand-logo__light"[^>]*alt="Texuli"/);
      expect(logo).toMatch(/<img class="brand-logo__dark"[^>]*alt="" aria-hidden="true"/);
    });
  });
});

describe('brand page surfaces (W18)', () => {
  /**
   * PLAN_006 W18: the /brand/ mark figures sat on `var(--tx-background)`, the
   * theme background, so in each color mode one of the light and dark
   * variants was near-invisible (black on the dark theme, white on the light
   * one). Each variant now sits on a fixed surface that matches it, in every
   * site mode and under forced colors. The figcaptions stay on the theme
   * colors outside that surface, so their contrast is unchanged.
   *
   * Source-level, like the other page tests (no Astro renderer in the unit
   * environment); the a11y-site and site-brand specs check the built page.
   */

  const HERE = dirname(fileURLToPath(import.meta.url));
  const page = readFileSync(resolve(HERE, '../src/pages/brand/index.astro'), 'utf8');
  const style = (page.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? '').replace(
    /\/\*[\s\S]*?\*\//g,
    ''
  );

  const figures = [...page.matchAll(/<figure\b([^>]*)>([\s\S]*?)<\/figure>/g)].map((match) => ({
    attrs: match[1] ?? '',
    body: match[2] ?? '',
  }));

  /** The declarations of the first rule whose selector list is exactly `selector`. */
  function rule(selector: string): string {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return style.match(new RegExp(`(?:^|\\})\\s*${escaped}\\s*\\{([^}]*)\\}`))?.[1] ?? '';
  }

  describe('brand page: each logo variant sits on its matching fixed surface', () => {
    it('puts each logo variant on its own fixed surface, forced colors included, captions on theme colors', () => {
      expect(figures).toHaveLength(4);
      for (const { attrs, body } of figures) {
        const variant = body.match(/texuli-(?:logo|isotype)-(light|dark)\.png/)?.[1];
        expect(variant, body).toBeDefined();
        expect(attrs).toContain(`class="mark-on-${variant}"`);
      }
      expect(rule('figure')).not.toMatch(/background:\s*var\(--tx-background\)/);
      expect(rule('.mark-on-light picture')).toMatch(/background:\s*#ffffff;/);
      expect(rule('.mark-on-dark picture')).toMatch(/background:\s*#111111;/);
      for (const selector of ['.mark-on-light picture', '.mark-on-dark picture']) {
        expect(rule(selector), selector).not.toContain('var(--tx-');
      }
      expect(rule('figure picture')).toMatch(/forced-color-adjust:\s*none;/);
      expect(rule('figure picture')).toMatch(/display:\s*block;/);
      for (const { body } of figures) {
        expect(body).toMatch(/<\/picture>\s*<figcaption>/);
      }
      expect(rule('figcaption')).toMatch(/color:\s*var\(--tx-muted-foreground\)/);
    });
  });
});

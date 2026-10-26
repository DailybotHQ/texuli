/**
 * T-92 — brand asset diet (PLAN_006 perf-assets): the logo and brand-page
 * images ship as lossless WebP inside <picture>, each with its PNG fallback;
 * the header logo picks a copy sized for the screen density; every brand file
 * a template names exists; and the light/dark logo switch is intact.
 *
 * The vitest suite cannot compile .astro templates, so templates are read as
 * source, and image sizes are read from the file headers.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

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
  if (chunk === 'VP8X') return { width: b.readUIntLE(24, 3) + 1, height: b.readUIntLE(27, 3) + 1 };
  if (chunk === 'VP8 ')
    return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
  throw new Error(`${file}: not a PNG or WebP`);
}

describe('brand assets (T-92)', () => {
  it('names only brand files that exist', () => {
    const named = new Set<string>();
    for (const source of [head, page, manifest]) {
      for (const match of source.matchAll(/texuli-[a-z0-9-]+\.(?:png|webp)/g)) named.add(match[0]);
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
  });

  it('gives every WebP a PNG fallback of the same artwork', () => {
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
  });

  it('serves the brand-page marks as WebP with the PNG in the img', () => {
    const pictures = [...page.matchAll(/<picture>([\s\S]*?)<\/picture>/g)].map((m) => m[1] ?? '');
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
  });

  it('keeps the site header on the WebP logo (load-bearing for /web-and-native/)', () => {
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
  });

  it('gives the header logo a 1x, 2x and 3x WebP copy, PNG fallback', () => {
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
    expect(bytes('texuli-logo-light-24.webp')).toBeLessThan(bytes('texuli-logo-light-72.png') / 2);
  });

  it('keeps one logo per color mode visible and in the accessibility tree', () => {
    expect(logo).toMatch(/<img class="brand-logo__light"[^>]*alt="Texuli"[^>]*loading="lazy"/);
    expect(logo).toMatch(
      /<img class="brand-logo__dark"[^>]*alt="" aria-hidden="true"[^>]*loading="lazy"/
    );
    expect(logo).toMatch(/\.brand-logo picture \{\s*display: contents;/);
    expect(logo).toMatch(/\.brand-logo__dark \{\s*display: none;/);
    expect(logo).toMatch(/:root\[data-tx-mode='dark'\]\) \.brand-logo__light \{\s*display: none;/);
    expect(logo).toMatch(/:root\[data-tx-mode='dark'\]\) \.brand-logo__dark \{\s*display: block;/);
  });
});

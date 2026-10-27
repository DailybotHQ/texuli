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
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

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
  it('marks every figure with the surface its variant was drawn for', () => {
    expect(figures).toHaveLength(4);
    for (const { attrs, body } of figures) {
      const variant = body.match(/texuli-(?:logo|isotype)-(light|dark)\.png/)?.[1];
      expect(variant, body).toBeDefined();
      expect(attrs).toContain(`class="mark-on-${variant}"`);
    }
  });

  it('no longer paints the figures with the theme background', () => {
    expect(rule('figure')).not.toMatch(/background:\s*var\(--tx-background\)/);
  });

  it('gives the light variant a fixed light surface and the dark one a fixed dark surface', () => {
    expect(rule('.mark-on-light picture')).toMatch(/background:\s*#ffffff;/);
    expect(rule('.mark-on-dark picture')).toMatch(/background:\s*#111111;/);
    for (const selector of ['.mark-on-light picture', '.mark-on-dark picture']) {
      expect(rule(selector), selector).not.toContain('var(--tx-');
    }
  });

  it('keeps the fixed surface under forced colors, where a system Canvas would hide one mark', () => {
    expect(rule('figure picture')).toMatch(/forced-color-adjust:\s*none;/);
    expect(rule('figure picture')).toMatch(/display:\s*block;/);
  });

  it('keeps the figcaption on the theme colors, outside the fixed surface', () => {
    for (const { body } of figures) {
      expect(body).toMatch(/<\/picture>\s*<figcaption>/);
    }
    expect(rule('figcaption')).toMatch(/color:\s*var\(--tx-muted-foreground\)/);
  });
});

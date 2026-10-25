import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const layoutSource = readFileSync('packages/astro/src/layouts/ContentLayout.astro', 'utf8');
const heroSource = readFileSync('packages/astro/src/sections/Hero.astro', 'utf8');
const sectionSource = readFileSync('packages/astro/src/sections/Section.astro', 'utf8');

describe('ContentLayout polish', () => {
  it('sets static token density and radius variants on the root element', () => {
    expect(layoutSource).toContain('data-tx-density={density}');
    expect(layoutSource).toContain('data-tx-radius={radius}');
    // The attribute names must stay the static counterparts of the
    // integration's script-driven dataset names (txDensity / txRadius).
    const integration = readFileSync('packages/astro/src/integration/index.ts', 'utf8');
    expect(integration).toContain('txDensity');
    expect(integration).toContain('txRadius');
    // ...and the stylesheet must keep consuming the same attribute names.
    const css = readFileSync('packages/astro/src/styles.css', 'utf8');
    expect(css).toContain(':root[data-tx-density="compact"]');
    expect(css).toContain(':root[data-tx-radius="rounded"]');
  });

  it('validates density and radius values against the integration variants', () => {
    expect(layoutSource).toContain("'compact', 'comfortable', 'spacious'");
    expect(layoutSource).toContain("'compact', 'comfortable', 'rounded'");
    expect(layoutSource).toContain('Density must be compact, comfortable, or spacious.');
    expect(layoutSource).toContain('Radius must be compact, comfortable, or rounded.');
  });

  it('adds Open Graph metadata and a noindex robots meta', () => {
    expect(layoutSource).toContain('<meta property="og:title" content={ogTitle} />');
    expect(layoutSource).toContain('<meta property="og:description" content={ogDescription} />');
    expect(layoutSource).toContain('<meta property="og:image" content={ogImageHref} />');
    expect(layoutSource).toContain('<meta name="robots" content="noindex" />');
  });

  it('checks the Open Graph image with the developer URL policy', () => {
    expect(layoutSource).toContain("safeHref(ogImage, 'developer')");
    // A rejected image must not render: the guard uses the sanitized value.
    expect(layoutSource).toContain('{ogImageHref &&');
    expect(layoutSource).not.toContain('{ogImage &&');
  });
});

describe('Hero polish', () => {
  it('offers the compact size variant next to the lede default', () => {
    expect(heroSource).toContain("size?: 'lede' | 'compact'");
    expect(heroSource).toContain("size = 'lede'");
    expect(heroSource).toMatch(/tx-astro-hero--\$\{size\}/);
  });

  it('ships compact styles with logical properties and responsive clamps', () => {
    expect(heroSource).toContain(
      '.tx-astro-hero--compact { gap: 0.75rem; padding-block: clamp(1.5rem, 5vw, 3rem); }'
    );
    expect(heroSource).toContain(
      '.tx-astro-hero--compact h1 { font-size: clamp(1.75rem, 4.5vw, 2.75rem); }'
    );
    expect(heroSource).toContain(
      '.tx-astro-hero--compact .tx-astro-hero__description { font-size: 1rem; }'
    );
  });
});

describe('Section polish', () => {
  it('offers the surface tone on the theme surface color', () => {
    expect(sectionSource).toContain("tone?: 'default' | 'surface'");
    expect(sectionSource).toContain("tone = 'default'");
    expect(sectionSource).toMatch(/tx-astro-section--\$\{tone\}/);
    expect(sectionSource).toContain(
      '.tx-astro-section--surface { background: var(--tx-surface); }'
    );
    const css = readFileSync('packages/astro/src/styles.css', 'utf8');
    expect(css).toContain('@import "@texuli/tokens/base.css"');
  });

  it('offers the none padding variant for nested sections', () => {
    expect(sectionSource).toContain("padding?: 'normal' | 'none'");
    expect(sectionSource).toContain("padding = 'normal'");
    expect(sectionSource).toMatch(/tx-astro-section--padding-\$\{padding\}/);
    expect(sectionSource).toContain('.tx-astro-section--padding-none { padding-inline: 0; }');
  });
});

/// <reference types="node" />
/**
 * Typography and surfaces, round 2 (T-typography-2, ADR-032; gaps from lock-clean templates):
 * Box `primary` and `brand` surfaces (fill and on-color from tokens) and `translucent` (glass
 * opacity and blur, for sticky headers); Heading sizes `2xl`, `3xl` and `4xl` between `xl` and
 * `display`, a `responsive` fluid size between two scale tokens, `tight` tracking and the
 * display weight; Text `inherit` for size, line height and color. Catalog components and
 * tokens only.
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanup, render } from '@testing-library/svelte';
import { checkTokenReads } from '@texuli/tokens/components';
import { createRawSnippet } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import {
  boxManifest,
  headingManifest,
  textManifest,
} from '../../catalog/src/manifests/display/index.ts';
import { checkDesignSystemAllow } from '../../spec/src/design-system/allow.ts';
import {
  BOX_SURFACES,
  Box,
  HEADING_SIZES,
  HEADING_TRACKINGS,
  Heading,
  TEXT_SIZES,
  TEXT_TONES,
  Text,
} from '../src/components/typography/index.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');
const css = read('packages/texuli/src/components/typography/typography.css');
const catalog = JSON.parse(read('packages/spec/catalog/components.json')) as {
  components: {
    id: string;
    axes?: Record<string, { prop: string; values: string[]; default: string }>;
    props: { name: string; kind: string; enumValues?: string[] }[];
    examples?: unknown;
  }[];
};
const component = (id: string) => catalog.components.find((c) => c.id === id);
/** One CSS rule's body, by its selector. */
const rule = (selector: string) => {
  const at = css.indexOf(`${selector} {`);
  expect(at, selector).toBeGreaterThan(-1);
  return css.slice(at, css.indexOf('}', at));
};

afterEach(() => cleanup());

describe('Box surfaces: primary, brand and translucent', () => {
  it('adds the three surfaces to the closed list and the catalog variant axis', () => {
    expect(BOX_SURFACES).toEqual(expect.arrayContaining(['primary', 'brand', 'translucent']));
    expect(component('box')?.axes?.variant).toMatchObject({
      prop: 'surface',
      values: [...BOX_SURFACES],
    });
    expect(boxManifest.examples.map((e) => e.id)).toEqual(
      expect.arrayContaining(['logo-tile', 'sticky-header'])
    );
  });

  it('paints fill and on-color from role tokens, and the translucent glass from the glass tokens', () => {
    expect(rule('.tx-box--surface-primary')).toMatch(
      /background-color: var\(--tx-primary,[\s\S]*color: var\(--tx-primary-foreground,/
    );
    expect(rule('.tx-box--surface-brand')).toMatch(
      /background-color: var\(--tx-primary-soft,[\s\S]*color: var\(--tx-primary-soft-foreground,/
    );
    const glass = css.slice(css.indexOf('@supports (backdrop-filter'));
    expect(glass).toContain('var(--tx-surface-glass-alpha)');
    expect(glass).toContain('backdrop-filter: blur(var(--tx-surface-glass-blur))');
    // Opaque without backdrop-filter, with reduced transparency and in forced colors.
    expect(rule('.tx-box--surface-translucent')).toContain(
      'background-color: var(--tx-background, Canvas)'
    );
    expect(css).toMatch(
      /prefers-reduced-transparency: reduce\) \{\s*\.tx-box--surface-translucent/
    );
    expect(css).toMatch(
      /forced-colors: active\)[\s\S]*\.tx-box--surface-translucent \{\s*background-color: Canvas;/
    );
  });

  it('renders each surface as its class and variant attribute', () => {
    for (const surface of ['primary', 'brand', 'translucent'] as const) {
      const { container } = render(Box, { props: { surface, as: 'header' } });
      const el = container.querySelector('header');
      expect(el?.classList.contains(`tx-box--surface-${surface}`), surface).toBe(true);
      expect(el?.getAttribute('data-tx-variant')).toBe(surface);
      cleanup();
    }
  });
});

describe('Heading: 2xl–4xl, responsive, tight tracking, display weight', () => {
  it('orders the sizes from display down, with 4xl, 3xl and 2xl between display and xl', () => {
    expect(HEADING_SIZES).toEqual(['display', '4xl', '3xl', '2xl', 'xl', 'lg', 'md', 'sm', 'xs']);
    expect(component('heading')?.axes?.size?.values).toEqual([...HEADING_SIZES]);
  });

  it('takes the steps from the font-size scale with the display role’s family and weight', () => {
    expect(rule('.tx-heading--4xl')).toContain(
      '--tx-heading-size: var(--tx-font-size-4xl, 2.25rem)'
    );
    expect(rule('.tx-heading--3xl')).toContain(
      '--tx-heading-size: var(--tx-font-size-3xl, 1.875rem)'
    );
    expect(rule('.tx-heading--2xl')).toContain(
      '--tx-heading-size: var(--tx-font-size-2xl, 1.5rem)'
    );
    const shared = rule('.tx-heading--4xl,\n  .tx-heading--3xl,\n  .tx-heading--2xl');
    expect(shared).toContain('font-weight: var(--tx-type-display-weight)');
    expect(shared).toContain('font-family: var(--tx-type-display-family)');
    expect(shared).toContain('font-size: var(--tx-heading-size)');
  });

  it('scales a responsive heading fluidly between two scale tokens, never past either', () => {
    expect(css).toMatch(
      /\.tx-heading\.tx-heading--responsive \{\s*font-size: clamp\(\s*var\(--tx-heading-min\),\s*calc\(var\(--tx-heading-min\) \+ 2\.5vw\),\s*var\(--tx-heading-size\)\s*\);/
    );
    for (const size of HEADING_SIZES) {
      const body =
        size === '2xl' || size === '3xl' || size === '4xl'
          ? rule(`.tx-heading--${size}`)
          : rule(`.tx-heading--${size}`);
      expect(body, size).toContain('--tx-heading-size:');
      expect(body, size).toContain('--tx-heading-min: var(--tx-font-size-');
    }
  });

  it('reads tight tracking from its token', () => {
    expect(HEADING_TRACKINGS).toEqual(['default', 'tight']);
    expect(rule('.tx-heading.tx-heading--tracking-tight')).toContain(
      'letter-spacing: var(--tx-letter-spacing-tight, -0.02em)'
    );
  });

  it('renders the level, the size, responsive and tracking', () => {
    const { container } = render(Heading, {
      props: {
        level: 1,
        size: '4xl',
        responsive: true,
        tracking: 'tight',
        label: 'Plan the quarter',
      },
    });
    const h1 = container.querySelector('h1');
    expect(h1?.textContent).toBe('Plan the quarter');
    expect(h1?.getAttribute('data-tx-size')).toBe('4xl');
    for (const name of ['tx-heading--4xl', 'tx-heading--responsive', 'tx-heading--tracking-tight'])
      expect(h1?.classList.contains(name), name).toBe(true);
    cleanup();
    const plain = render(Heading, {
      props: { level: 2, label: 'Details', tracking: 'loose' as never },
    });
    const h2 = plain.container.querySelector('h2');
    expect(h2?.classList.contains('tx-heading--responsive')).toBe(false);
    expect(h2?.classList.contains('tx-heading--tracking-default')).toBe(true);
  });

  it('lists responsive and tracking in the catalog', () => {
    const props = component('heading')?.props ?? [];
    expect(props.find((p) => p.name === 'responsive')).toMatchObject({ kind: 'boolean' });
    expect(props.find((p) => p.name === 'tracking')).toMatchObject({
      kind: 'enum',
      enumValues: ['default', 'tight'],
    });
    expect(headingManifest.examples.some((e) => e.id === 'hero')).toBe(true);
  });
});

describe('Text: inherit', () => {
  it('adds inherit to the size and tone lists and the catalog', () => {
    expect(TEXT_SIZES).toContain('inherit');
    expect(TEXT_TONES).toContain('inherit');
    expect(component('text')?.axes?.size?.values).toEqual([...TEXT_SIZES]);
    expect(component('text')?.axes?.tone?.values).toEqual([...TEXT_TONES]);
    expect(textManifest.examples.some((e) => e.id === 'inherit')).toBe(true);
  });

  it('inherits the size, line height and color of its parent', () => {
    expect(rule('.tx-text.tx-text--inherit')).toMatch(
      /font-size: inherit;\s*line-height: inherit;/
    );
    expect(rule('.tx-type-tone--inherit')).toContain('color: inherit');
    const { container } = render(Text, {
      props: { as: 'span', size: 'inherit', tone: 'inherit', label: 'Pro' },
    });
    const span = container.querySelector('span');
    expect(span?.classList.contains('tx-text--inherit')).toBe(true);
    expect(span?.classList.contains('tx-type-tone--inherit')).toBe(true);
  });

  it('nests inside a heading', () => {
    const children = createRawSnippet(() => ({ render: () => '<span>Plan</span>' }));
    const { container } = render(Heading, { props: { level: 2, size: '3xl', children } });
    expect(container.querySelector('h2 span')?.textContent).toBe('Plan');
  });
});

describe('tokens only, and the allow set governs the new values', () => {
  it('reads tokens with their fallbacks and logical properties only', () => {
    expect(checkTokenReads(css)).toEqual([]);
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(|hsl\(|oklch\(/i);
    expect(css).not.toMatch(/(?:margin|padding|border)-(?:left|right|top|bottom)\b/);
  });

  it('lets an allow set enable or refuse the new values against the catalog', () => {
    const allow = {
      box: { variants: ['translucent', 'primary'] },
      heading: { sizes: ['4xl', '2xl'] },
      text: { sizes: ['inherit'], tones: ['inherit'] },
    };
    const ok = checkDesignSystemAllow({ allow }, catalog as never);
    expect(ok.errors).toEqual([]);
    const bad = checkDesignSystemAllow(
      { allow: { heading: { sizes: ['5xl'] } } },
      catalog as never
    );
    expect(bad.errors.map((e) => e.code)).toEqual(['unknown-size']);
  });
});

/// <reference types="node" />
/**
 * Heading, Text, Prose and Box (`texuli/typography`, T-typography, ADR-032): the typography
 * and surface components a locked prototype uses instead of typography and visual utilities.
 * Heading renders the semantic h1–h6 with a size independent of the level; Text never renders
 * a heading; every value is a closed list driven by `--tx-*` tokens; each root carries its
 * `data-tx-*` attributes; the catalog lists each with its axes, and the allow set governs them.
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
  proseManifest,
  textManifest,
} from '../../catalog/src/manifests/display/index.ts';
import { checkDesignSystemAllow } from '../../spec/src/design-system/allow.ts';
import {
  BOX_BORDERS,
  BOX_SURFACES,
  Box,
  HEADING_SIZES,
  HEADING_TONES,
  Heading,
  headingSizeOf,
  PROSE_SIZES,
  Prose,
  TEXT_SIZES,
  TEXT_TONES,
  TEXT_TRACKINGS,
  TEXT_TRANSFORMS,
  Text,
} from '../src/components/typography/index.ts';
import * as root from '../src/index.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');
const children = (html: string) => createRawSnippet(() => ({ render: () => html }));

afterEach(() => cleanup());

describe('Heading', () => {
  it('renders the semantic h1–h6 for its level, with a size independent of the level', () => {
    for (const level of [1, 2, 3, 4, 5, 6] as const) {
      const { container } = render(Heading, { level, label: `Level ${level}` });
      const heading = container.querySelector(`h${level}`);
      expect(heading?.textContent).toBe(`Level ${level}`);
      expect(heading?.getAttribute('data-tx-component')).toBe('heading');
      expect(heading?.getAttribute('data-tx-size')).toBe(headingSizeOf(level));
      cleanup();
    }
    const { container } = render(Heading, { level: 4, size: 'display', label: 'Big but h4' });
    const heading = container.querySelector('h4');
    expect(heading?.classList.contains('tx-heading--display')).toBe(true);
    expect(heading?.getAttribute('data-tx-size')).toBe('display');
  });

  it('keeps hostile or stale values inside the closed lists', () => {
    const { container } = render(Heading, {
      level: 9 as never,
      size: 'huge' as never,
      tone: 'red' as never,
      label: '<img src=x onerror=alert(1)>',
    });
    const heading = container.querySelector('h2');
    expect(heading).not.toBeNull();
    expect(heading?.getAttribute('data-tx-size')).toBe('lg');
    expect(heading?.getAttribute('data-tx-tone')).toBe('default');
    expect(container.querySelector('img')).toBeNull();
    expect(heading?.textContent).toBe('<img src=x onerror=alert(1)>');
  });

  it('mutes and truncates', () => {
    const { container } = render(Heading, { level: 2, tone: 'muted', truncate: true, label: 'x' });
    const heading = container.querySelector('h2');
    expect(heading?.className).toContain('tx-type-tone--muted');
    expect(heading?.className).toContain('tx-type--truncate');
    expect(heading?.getAttribute('data-tx-tone')).toBe('muted');
  });
});

describe('Text', () => {
  it('renders only text elements, never a heading', () => {
    for (const as of ['p', 'span', 'div', 'label', 'small', 'strong'] as const) {
      const { container } = render(Text, { as, label: as });
      expect(container.querySelector(as)?.getAttribute('data-tx-component')).toBe('text');
      cleanup();
    }
    const { container } = render(Text, { as: 'h1' as never, label: 'Not a heading' });
    expect(container.querySelector('h1, h2, h3, h4, h5, h6')).toBeNull();
    expect(container.querySelector('p')?.textContent).toBe('Not a heading');
  });

  it('maps size, tone, weight, align, transform and tracking to token classes and attributes', () => {
    const { container } = render(Text, {
      size: 'sm',
      tone: 'warning',
      weight: 'semibold',
      align: 'end',
      transform: 'capitalize',
      tracking: 'wide',
      mono: true,
      tabular: true,
      label: 'x',
    });
    const text = container.querySelector('p') as HTMLElement;
    for (const name of [
      'tx-text--sm',
      'tx-type-tone--warning',
      'tx-text--weight-semibold',
      'tx-text--align-end',
      'tx-text--transform-capitalize',
      'tx-text--tracking-wide',
      'tx-text--mono',
      'tx-text--tabular',
    ])
      expect(text.classList.contains(name), name).toBe(true);
    expect(text.getAttribute('data-tx-size')).toBe('sm');
    expect(text.getAttribute('data-tx-tone')).toBe('warning');
  });

  it('is an eyebrow and a large figure from props alone', () => {
    const eyebrow = render(Text, {
      as: 'span',
      size: 'xs',
      tone: 'muted',
      transform: 'uppercase',
      tracking: 'wide',
      label: 'Revenue',
    }).container.querySelector('span') as HTMLElement;
    expect(eyebrow.className).toContain('tx-text--transform-uppercase');
    expect(eyebrow.className).toContain('tx-text--tracking-wide');
    cleanup();
    const figure = render(Text, {
      as: 'span',
      size: 'figure',
      tabular: true,
      label: '1,284',
    }).container.querySelector('span') as HTMLElement;
    expect(figure.getAttribute('data-tx-size')).toBe('figure');
    expect(figure.className).toContain('tx-text--tabular');
  });

  it('clamps 1 to 10 lines through a style property, and labels a control', () => {
    const clamped = render(Text, { lineClamp: 3, label: 'x' }).container.querySelector(
      'p'
    ) as HTMLElement;
    expect(clamped.classList.contains('tx-type--clamp')).toBe(true);
    expect(clamped.style.getPropertyValue('--tx-text-line-clamp')).toBe('3');
    cleanup();
    const ignored = render(Text, {
      lineClamp: 40,
      truncate: true,
      label: 'x',
    }).container.querySelector('p') as HTMLElement;
    expect(ignored.classList.contains('tx-type--clamp')).toBe(false);
    expect(ignored.classList.contains('tx-type--truncate')).toBe(true);
    cleanup();
    const label = render(Text, {
      as: 'label',
      for: 'email',
      label: 'Email',
    }).container.querySelector('label') as HTMLLabelElement;
    expect(label.htmlFor).toBe('email');
  });
});

describe('Prose and Box', () => {
  it('renders the host markup in a prose region with the size attribute', () => {
    const { container } = render(Prose, {
      as: 'article',
      size: 'lg',
      children: children('<div><h2>Intro</h2><p>Body</p></div>'),
    });
    const prose = container.querySelector('article') as HTMLElement;
    expect(prose.getAttribute('data-tx-component')).toBe('prose');
    expect(prose.getAttribute('data-tx-size')).toBe('lg');
    expect(prose.querySelector('h2')?.textContent).toBe('Intro');
  });

  it('frames a panel from tokens, and an app header with one logical border side', () => {
    const panel = render(Box, {
      padding: 'lg',
      radius: 'xl',
      border: 'default',
      elevation: 'md',
      surface: 'default',
      children: children('<span>Panel</span>'),
    }).container.querySelector('div') as HTMLElement;
    for (const name of [
      'tx-box--pad-lg',
      'tx-box--radius-xl',
      'tx-box--border-default',
      'tx-box--elevation-md',
      'tx-box--surface-default',
    ])
      expect(panel.classList.contains(name), name).toBe(true);
    expect(panel.getAttribute('data-tx-component')).toBe('box');
    expect(panel.getAttribute('data-tx-variant')).toBe('default');
    cleanup();
    const header = render(Box, {
      as: 'header',
      radius: 'none',
      border: 'block-end',
      surface: 'default',
      children: children('<span>App</span>'),
    }).container.querySelector('header') as HTMLElement;
    expect(header.classList.contains('tx-box--border-block-end')).toBe(true);
    expect(header.classList.contains('tx-box--radius-none')).toBe(true);
  });
});

describe('tokens only, no literal colors', () => {
  const css = read('packages/texuli/src/components/typography/typography.css');

  it('reads system tokens plain and role inks with fallbacks, and uses logical properties', () => {
    expect(checkTokenReads(css)).toEqual([]);
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(|hsl\(|oklch\(/i);
    expect(css).not.toMatch(/(?:margin|padding|border)-(?:left|right|top|bottom)\b/);
    expect(css).toContain('border-block-end');
    for (const size of HEADING_SIZES) expect(css).toContain(`.tx-heading--${size}`);
    for (const size of TEXT_SIZES) expect(css).toContain(`.tx-text--${size}`);
    for (const tone of TEXT_TONES) expect(css).toContain(`.tx-type-tone--${tone}`);
    for (const surface of BOX_SURFACES.filter((s) => s !== 'transparent'))
      expect(css).toContain(`.tx-box--surface-${surface}`);
    for (const border of BOX_BORDERS.filter((b) => b !== 'none'))
      expect(css).toContain(`.tx-box--border-${border}`);
  });
});

describe('catalog, root attributes and the allow set', () => {
  const catalog = JSON.parse(read('packages/spec/catalog/components.json')) as {
    components: { id: string; axes?: Record<string, { prop: string; values: string[] }> }[];
  };
  const component = (id: string) => catalog.components.find((c) => c.id === id);

  it('lists each component with axes equal to the component constants', () => {
    expect(component('heading')?.axes?.size?.values).toEqual([...HEADING_SIZES]);
    expect(component('heading')?.axes?.tone?.values).toEqual([...HEADING_TONES]);
    expect(component('text')?.axes?.size?.values).toEqual([...TEXT_SIZES]);
    expect(component('text')?.axes?.tone?.values).toEqual([...TEXT_TONES]);
    expect(component('prose')?.axes?.size?.values).toEqual([...PROSE_SIZES]);
    expect(component('box')?.axes?.variant).toMatchObject({
      prop: 'surface',
      values: [...BOX_SURFACES],
    });
    const enumOf = (
      props: readonly { name: string; enumValues?: readonly string[] }[],
      name: string
    ) => props.find((p) => p.name === name)?.enumValues;
    expect(enumOf(textManifest.props, 'transform')).toEqual([...TEXT_TRANSFORMS]);
    expect(enumOf(textManifest.props, 'tracking')).toEqual([...TEXT_TRACKINGS]);
    expect(enumOf(boxManifest.props, 'border')).toEqual([...BOX_BORDERS]);
    for (const manifest of [headingManifest, textManifest, proseManifest, boxManifest]) {
      expect(manifest.package).toBe('texuli');
      expect(manifest.examples.length).toBeGreaterThan(0);
    }
  });

  it('stamps the component id and axes on each root as literals', () => {
    for (const [file, id, axes] of [
      ['Heading', 'heading', ['size', 'tone']],
      ['Text', 'text', ['size', 'tone']],
      ['Prose', 'prose', ['size']],
      ['Box', 'box', []],
    ] as const) {
      const source = read(`packages/texuli/src/components/typography/${file}.svelte`);
      expect(source, file).toContain(`data-tx-component="${id}"`);
      for (const axis of axes) expect(source, file).toContain(`data-tx-${axis}={${axis}}`);
    }
    expect(read('packages/texuli/src/components/typography/Box.svelte')).toContain(
      'data-tx-variant={surface}'
    );
  });

  it('is governed by the allow set: unknown values are refused, allowed ones pass', () => {
    const doc = (allow: Record<string, unknown>) => ({ allow });
    expect(
      checkDesignSystemAllow(
        doc({ heading: { sizes: ['xl', 'md'] }, text: { tones: ['muted'] }, box: {}, prose: {} }),
        catalog as never
      ).errors
    ).toEqual([]);
    const refused = checkDesignSystemAllow(
      doc({ heading: { sizes: ['huge'] }, text: { tones: ['red'] } }),
      catalog as never
    ).errors.map((e) => [e.code, e.path]);
    expect(refused).toEqual([
      ['unknown-size', '$.allow.heading.sizes[0]'],
      ['unknown-tone', '$.allow.text.tones[0]'],
    ]);
  });

  it('exports the components from the root and from texuli/typography', () => {
    expect(root.Heading).toBe(Heading);
    expect(root.Text).toBe(Text);
    expect(root.Prose).toBe(Prose);
    expect(root.Box).toBe(Box);
    const pkg = JSON.parse(read('packages/texuli/package.json')) as {
      exports: Record<string, unknown>;
    };
    expect(pkg.exports['./typography']).toEqual({
      types: './src/components/typography/index.ts',
      svelte: './src/components/typography/index.ts',
      default: './src/components/typography/index.ts',
    });
  });
});

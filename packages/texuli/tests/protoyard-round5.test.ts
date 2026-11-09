/// <reference types="node" />
/**
 * Protoyard round 5 (T-protoyard-round5, ADR-032): Prose list markers, an inline
 * Link with safeHref, ColorSwatch from the closed color-reference type, and Box
 * dashed borders. Catalog components and tokens only.
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanup, render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import {
  boxManifest,
  colorSwatchManifest,
  linkManifest,
  proseManifest,
} from '../../catalog/src/manifests/display/index.ts';
import { BOX_BORDERS, Box, ColorSwatch, Link, Prose } from '../src/components/typography/index.ts';
import { colorRefInk, colorRefVar, isColorRef } from '../src/internal/color-ref.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');
const css = read('packages/texuli/src/components/typography/typography.css');
const catalog = JSON.parse(read('packages/spec/catalog/components.json')) as {
  components: {
    id: string;
    axes?: Record<string, { prop: string; values: string[]; default: string }>;
    props: { name: string; kind: string; enumValues?: string[]; required?: boolean }[];
    states?: string[];
  }[];
};
const component = (id: string) => catalog.components.find((c) => c.id === id);

afterEach(() => cleanup());

describe('Prose list markers', () => {
  it('sets disc and decimal list styles from tokens so markers show under every theme', () => {
    expect(css).toMatch(/\.tx-prose :where\(ul\) \{\s*list-style-type: disc;/);
    expect(css).toMatch(/\.tx-prose :where\(ol\) \{\s*list-style-type: decimal;/);
    expect(css).toContain('list-style-position: outside');
    expect(css).toMatch(/\.tx-prose :where\(li::marker\) \{\s*color: var\(--tx-muted-foreground,/);
  });

  it('paints bullets and numbers on host markup lists', () => {
    const lists = createRawSnippet(() => ({
      render: () =>
        '<div><ul data-testid="bullets"><li>North Pier</li></ul><ol data-testid="numbers"><li>First</li></ol></div>',
    }));
    const { container } = render(Prose, { props: { as: 'article', children: lists } });
    expect(container.querySelector('[data-tx-component="prose"]')?.tagName).toBe('ARTICLE');
    expect(container.querySelector('[data-testid="bullets"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="numbers"]')).toBeTruthy();
    expect(proseManifest.summary).toMatch(/list/i);
  });
});

describe('inline Link', () => {
  it('wraps as an inline link with a token underline and a safe href', () => {
    render(Link, { props: { href: 'https://example.com/guide', label: 'the harbor guide' } });
    const link = screen.getByRole('link', { name: 'the harbor guide' });
    expect(link.tagName).toBe('A');
    expect(link.getAttribute('href')).toBe('https://example.com/guide');
    expect(link.getAttribute('rel')).toMatch(/noopener/);
    expect(link.getAttribute('rel')).toMatch(/noreferrer/);
    expect(link.className).toContain('tx-link');
    expect(link.getAttribute('data-tx-component')).toBe('link');
    expect(css).toMatch(/\.tx-link \{\s*display: inline;/);
    expect(css).toContain('text-decoration-line: underline');
    expect(css).toContain('text-decoration-color: var(--tx-link, LinkText)');
  });

  it('refuses a hostile href and still shows the label as text', () => {
    const { container } = render(Link, {
      props: { href: 'javascript:alert(1)', label: 'Harbor notes' },
    });
    expect(container.querySelector('a')).toBeNull();
    const text = container.querySelector('[data-href-blocked="true"]');
    expect(text?.textContent).toBe('Harbor notes');
    expect(text?.getAttribute('data-tx-component')).toBe('link');
  });

  it('lists href as required and developer-tier in the catalog', () => {
    const href = linkManifest.props.find((prop) => prop.name === 'href');
    expect(href).toMatchObject({ kind: 'string', required: true, trust: 'developer' });
    expect(linkManifest.states).toEqual(['hover', 'focus-visible']);
    expect(component('link')?.id).toBe('link');
  });
});

describe('ColorSwatch', () => {
  it('paints a closed color reference with contrast ink from tokens', () => {
    const { container } = render(ColorSwatch, {
      props: { color: 'chart-1', label: 'North' },
    });
    const swatch = container.querySelector('[data-tx-component="color-swatch"]') as HTMLElement;
    expect(swatch.textContent).toBe('North');
    expect(swatch.getAttribute('data-tx-variant')).toBe('chart-1');
    expect(swatch.getAttribute('data-tx-size')).toBe('md');
    expect(swatch.style.getPropertyValue('--tx-swatch-fill')).toBe(colorRefVar('chart-1'));
    expect(swatch.style.getPropertyValue('--tx-swatch-ink')).toBe(colorRefInk('chart-1'));
    expect(colorRefVar('primary')).toBe('var(--tx-primary)');
    expect(colorRefInk('primary')).toBe('var(--tx-primary-foreground)');
  });

  it('drops a free CSS color and never writes it into a declaration', () => {
    for (const hostile of ['#fff', 'red', 'url(https://example.com/x)', 'chart-9']) {
      expect(isColorRef(hostile)).toBe(false);
      const { container } = render(ColorSwatch, { props: { color: hostile, label: 'X' } });
      const swatch = container.querySelector('[data-tx-component="color-swatch"]') as HTMLElement;
      expect(swatch.getAttribute('data-tx-variant')).toBeNull();
      expect(swatch.getAttribute('style') ?? '').not.toContain(String(hostile));
      cleanup();
    }
    expect(colorSwatchManifest.axes?.variant).toBe('color');
    expect(component('color-swatch')?.axes?.variant?.prop).toBe('color');
  });
});

describe('Box dashed border', () => {
  it('is a closed border value painted from border-width and border-color tokens', () => {
    expect(BOX_BORDERS).toContain('dashed');
    const { container } = render(Box, { props: { border: 'dashed' } });
    const el = container.querySelector('[data-tx-component="box"]');
    expect(el?.classList.contains('tx-box--border-dashed')).toBe(true);
    expect(css).toMatch(
      /\.tx-box--border-dashed \{\s*border: var\(--tx-border-width-thin\) dashed var\(--tx-border,/
    );
    expect(boxManifest.props.find((prop) => prop.name === 'border')?.enumValues).toEqual([
      ...BOX_BORDERS,
    ]);
  });
});

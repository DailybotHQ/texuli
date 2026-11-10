/// <reference types="node" />
/**
 * Protoyard round 3 (T-protoyard-round3, ADR-032): Box canvas and inline
 * borders, Heading xs, Text italic/strikethrough, divided List/ListItem, Mark
 * highlights, density-independent layout widths. Charts: sparkline bar is the
 * compact bar for cards.
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanup, render } from '@testing-library/svelte';
import { checkTokenReads } from '@texuli/tokens/components';
import { afterEach, describe, expect, it } from 'vitest';
import {
  boxManifest,
  headingManifest,
  textManifest,
} from '../../catalog/src/manifests/display/index.ts';
import { checkDesignSystemAllow } from '../../spec/src/design-system/allow.ts';
import { List, ListItem } from '../src/components/list-item/index.ts';
import {
  BOX_BORDERS,
  BOX_SURFACES,
  Box,
  HEADING_SIZES,
  Heading,
  MARK_TONES,
  Mark,
  Text,
} from '../src/components/typography/index.ts';
import { LAYOUT_WIDTH_UTILITIES } from '../src/styles/layout-widths.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');
const css = read('packages/texuli/src/components/typography/typography.css');
const listCss = read('packages/texuli/src/components/list-item/list-item.css');
const widthCss = read('packages/texuli/src/styles/layout-widths.css');
const catalog = JSON.parse(read('packages/spec/catalog/components.json')) as {
  components: {
    id: string;
    axes?: Record<string, { prop: string; values: string[]; default: string }>;
    props: { name: string; kind: string; enumValues?: string[] }[];
  }[];
};
const component = (id: string) => catalog.components.find((c) => c.id === id);
const rule = (selector: string, source = css) => {
  const at = source.indexOf(`${selector} {`);
  expect(at, selector).toBeGreaterThan(-1);
  return source.slice(at, source.indexOf('}', at));
};

afterEach(() => cleanup());

describe('Box canvas and inline borders', () => {
  it('adds canvas to the surface axis and inline-start/end to borders', () => {
    expect(BOX_SURFACES).toContain('canvas');
    expect(BOX_BORDERS).toEqual(expect.arrayContaining(['inline-start', 'inline-end']));
    expect(component('box')?.axes?.variant?.values).toContain('canvas');
    expect(boxManifest.examples.map((e) => e.id)).toContain('page-canvas');
  });

  it('paints canvas from the page background token', () => {
    expect(rule('.tx-box--surface-canvas')).toContain(
      'background-color: var(--tx-background, Canvas)'
    );
    expect(rule('.tx-box--border-inline-start')).toContain('border-inline-start:');
    expect(rule('.tx-box--border-inline-end')).toContain('border-inline-end:');
    const { container } = render(Box, { props: { surface: 'canvas', border: 'inline-start' } });
    const el = container.firstElementChild;
    expect(el?.classList.contains('tx-box--surface-canvas')).toBe(true);
    expect(el?.classList.contains('tx-box--border-inline-start')).toBe(true);
    expect(el?.getAttribute('data-tx-variant')).toBe('canvas');
  });
});

describe('Heading xs and Text italic/strikethrough', () => {
  it('adds heading xs at 0.875rem from the font-size scale', () => {
    expect(HEADING_SIZES.at(-1)).toBe('xs');
    expect(component('heading')?.axes?.size?.values).toContain('xs');
    expect(rule('.tx-heading--xs')).toContain('--tx-font-size-sm, 0.875rem');
    const { container } = render(Heading, { props: { size: 'xs', label: 'Open tasks' } });
    expect(container.querySelector('h2')?.classList.contains('tx-heading--xs')).toBe(true);
    expect(headingManifest.examples.map((e) => e.id)).toContain('card-title');
  });

  it('renders italic and strikethrough from boolean props', () => {
    expect(textManifest.props.map((p) => p.name)).toEqual(
      expect.arrayContaining(['italic', 'strikethrough'])
    );
    const { container } = render(Text, {
      props: { italic: true, strikethrough: true, label: '$48' },
    });
    const el = container.querySelector('[data-tx-component="text"]');
    expect(el?.classList.contains('tx-text--italic')).toBe(true);
    expect(el?.classList.contains('tx-text--strike')).toBe(true);
    expect(rule('.tx-text--italic')).toContain('font-style: italic');
    expect(rule('.tx-text--strike')).toContain('text-decoration-line: line-through');
  });
});

describe('divided lists and Mark highlights', () => {
  it('draws a token hairline between list items when divided', () => {
    expect(component('list')).toBeDefined();
    expect(listCss).toContain('.tx-list--divided');
    expect(listCss).toContain('var(--tx-border');
    const { container } = render(List, { props: { divided: true } });
    expect(container.querySelector('ul')?.classList.contains('tx-list--divided')).toBe(true);
    expect(container.querySelector('ul')?.getAttribute('data-tx-component')).toBe('list');
    cleanup();
    const row = render(ListItem, { props: { title: 'One', divided: true } });
    expect(row.container.querySelector('li')?.classList.contains('tx-list-item--divided')).toBe(
      true
    );
  });

  it('paints Mark from role soft tokens, default warning for search', () => {
    expect(MARK_TONES).toEqual(['warning', 'primary', 'success', 'info']);
    expect(component('mark')?.axes?.tone?.values).toEqual([...MARK_TONES]);
    expect(rule('.tx-mark--warning')).toContain('var(--tx-warning-soft');
    expect(rule('.tx-mark--primary')).toContain('var(--tx-primary-soft');
    const { container } = render(Mark, { props: { label: 'quarter' } });
    const el = container.querySelector('mark');
    expect(el?.getAttribute('data-tx-component')).toBe('mark');
    expect(el?.getAttribute('data-tx-tone')).toBe('warning');
    expect(el?.classList.contains('tx-mark--warning')).toBe(true);
  });
});

describe('layout widths stay density-independent', () => {
  it('uses rem and --tx-layout-* tokens, never --tx-density or the space scale', () => {
    expect(LAYOUT_WIDTH_UTILITIES).toEqual([
      'tx-w-content',
      'tx-w-wide',
      'tx-w-full',
      'tx-w-pane',
      'tx-w-column',
    ]);
    expect(widthCss).toContain('var(--tx-layout-content-max)');
    expect(widthCss).toContain('inline-size: 20rem');
    expect(widthCss).toContain('inline-size: 16rem');
    expect(widthCss).not.toContain('--tx-density');
    expect(widthCss).not.toContain('--tx-space-');
  });
});

describe('compact bar in cards', () => {
  it('documents charts-sparkline variant bar as the compact bar for cards', () => {
    const spark = component('charts-sparkline');
    expect(spark?.axes?.variant?.values).toEqual(expect.arrayContaining(['bar']));
  });
});

describe('token reads and the allow set', () => {
  it('reads only tokens for the new CSS and allows the new catalog ids', () => {
    expect(checkTokenReads(css)).toEqual([]);
    expect(checkTokenReads(listCss)).toEqual([]);
    expect(checkTokenReads(widthCss)).toEqual([]);
    expect(
      checkDesignSystemAllow(
        { allow: { box: {}, heading: {}, text: {}, list: {}, mark: {} } },
        { components: catalog.components }
      ).ok
    ).toBe(true);
  });
});

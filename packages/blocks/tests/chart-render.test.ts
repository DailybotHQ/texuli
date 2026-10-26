import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cleanup, render, screen, waitFor } from '@testing-library/svelte';
import { compile } from 'svelte/compiler';
import { afterEach, describe, expect, it } from 'vitest';
import DataBlockView from '../src/data/DataBlockView.svelte';

afterEach(() => cleanup());

const base = { type: 'chart', title: 'Fictional chart', description: 'A fictional summary.' };
const points = [{ id: 'a', label: 'Alpha', x: 1, y: 2, seriesId: 'core' }];

/** Reads a family view source relative to the blocks package root. */
const sourceOf = (relative: string) => readFileSync(resolve(__dirname, '../src', relative), 'utf8');

describe('chart block rendering', () => {
  it('does not apply matrix frame SVG sizing to a chart legend symbol', () => {
    const source = readFileSync(
      resolve(__dirname, '../../charts/src/matrix/MatrixFrame.svelte'),
      'utf8'
    );
    const compiled = compile(source, { filename: 'MatrixFrame.svelte', css: 'external' });
    const style = document.createElement('style');
    style.textContent = compiled.css?.code ?? '';
    document.head.append(style);

    const chart = document.createElement('figure');
    chart.className = 'chart';
    const legend = document.createElement('ul');
    legend.className = 'legend';
    const item = document.createElement('li');
    const symbol = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    symbol.classList.add('tx-chart-legend__symbol');
    item.append(symbol);
    legend.append(item);
    chart.append(legend);

    const matchingRules = Array.from(style.sheet?.cssRules ?? []).filter((rule) => {
      if (!('selectorText' in rule)) return false;
      const cssRule = rule as CSSStyleRule;
      if (cssRule.style.getPropertyValue('inline-size') !== '100%') return false;
      const selector = cssRule.selectorText.replace(/\.svelte-[a-z0-9]+/g, '');
      return symbol.matches(selector);
    });

    style.remove();
    expect(matchingRules).toHaveLength(0);
  });

  it('keeps chart text from breaking at every character (legends stay readable)', () => {
    // jsdom does not inject component styles, so cascade the compiled CSS by hand.
    const source = readFileSync(resolve(__dirname, '../src/data/DataBlockView.svelte'), 'utf8');
    const style = document.createElement('style');
    style.textContent =
      compile(source, { filename: 'DataBlockView.svelte', css: 'external' }).css?.code ?? '';
    document.head.append(style);
    const overflowWrap = (classes: string) => {
      const element = document.createElement('div');
      element.className = classes;
      let value = '';
      for (const rule of style.sheet?.cssRules ?? []) {
        if (!('selectorText' in rule)) continue;
        const { selectorText, style: declarations } = rule as CSSStyleRule;
        const selector = selectorText.replace(/\.svelte-[a-z0-9]+/g, '');
        const declared = declarations.getPropertyValue('overflow-wrap');
        if (declared && element.matches(selector)) value = declared;
      }
      return value;
    };
    const chart = overflowWrap('tx-block tx-block-chart');
    const table = overflowWrap('tx-block tx-block-table');
    style.remove();
    expect(chart).not.toBe('anywhere');
    // Tables and stats keep breaking long unspaced values.
    expect(table).toBe('anywhere');
  });

  it('shows the invalid notice for duplicate x instead of crashing the chart render', async () => {
    const issues: unknown[] = [];
    render(DataBlockView, {
      props: {
        block: {
          ...base,
          kind: 'bar',
          series: [
            {
              id: 'signups',
              label: 'Signups',
              points: [
                { x: 'Mon', y: 1 },
                { x: 'Mon', y: 2 },
              ],
            },
          ],
        },
        oninvalid: (found: unknown) => issues.push(found),
      },
    });
    expect(await screen.findByRole('note')).toBeTruthy();
    expect(document.querySelector('[data-tx-block="invalid"]')).not.toBeNull();
    expect(document.querySelector('figure')).toBeNull();
    expect(issues).toHaveLength(1);
  });

  it('shows a visible title and description for compact kinds', async () => {
    render(DataBlockView, {
      props: {
        block: { ...base, title: 'Check-in completion', kind: 'gauge', props: { value: 40 } },
      },
    });
    expect(await screen.findByRole('heading', { name: 'Check-in completion' })).toBeTruthy();
    expect(screen.getAllByText('A fictional summary.').length).toBeGreaterThan(0);
  });

  it('adds theme fallbacks to bare chart tokens so missing tokens never render black', async () => {
    render(DataBlockView, {
      props: {
        block: {
          ...base,
          kind: 'scatter',
          points: [{ ...points[0], color: 'var(--tx-chart-2)' }],
          props: { series: [{ id: 'core', label: 'Core', color: 'var(--tx-chart-2)' }] },
        },
      },
    });
    await waitFor(() => expect(document.querySelector('circle[fill]')).not.toBeNull());
    const fill = document.querySelector('circle[fill]')?.getAttribute('fill') ?? '';
    expect(fill).toBe('var(--tx-chart-2, var(--tx-success, CanvasText))');
  });

  it('keeps the data invalid notice in the family grammar (dashed border, padding, em size)', () => {
    // jsdom does not inject component styles, so cascade the compiled CSS by hand.
    const style = document.createElement('style');
    style.textContent =
      compile(sourceOf('data/DataBlockView.svelte'), {
        filename: 'DataBlockView.svelte',
        css: 'external',
      }).css?.code ?? '';
    document.head.append(style);
    const notice = document.createElement('p');
    notice.className = 'tx-block tx-block-invalid';
    const declarations = new Map<string, string>();
    for (const rule of style.sheet?.cssRules ?? []) {
      if (!('selectorText' in rule)) continue;
      const cssRule = rule as CSSStyleRule;
      const selector = cssRule.selectorText.replace(/\.svelte-[a-z0-9]+/g, '');
      if (!notice.matches(selector)) continue;
      for (const property of ['border-style', 'padding', 'border-radius', 'font-size']) {
        const value = cssRule.style.getPropertyValue(property);
        if (value) declarations.set(property, value);
      }
    }
    style.remove();
    // The text, code, structure and media families all paint the invalid
    // notice with a dashed currentColor border, inner padding and an em size.
    expect(declarations.get('border-style')).toBe('dashed');
    expect(declarations.get('padding')).not.toBe('');
    expect(declarations.get('border-radius')).not.toBe('');
    expect(declarations.get('font-size')).toBe('0.875em');
  });

  it('routes standard text sizes through the font-size tokens like the sibling families', () => {
    const raw: string[] = [];
    const sources: Array<[string, string]> = [
      [sourceOf('data/DataBlockView.svelte'), 'DataBlockView.svelte'],
      [sourceOf('data/ChartBlockView.svelte'), 'ChartBlockView.svelte'],
      [sourceOf('media/MediaBlockView.svelte'), 'MediaBlockView.svelte'],
    ];
    for (const [source, filename] of sources) {
      const style = document.createElement('style');
      style.textContent = compile(source, { filename, css: 'external' }).css?.code ?? '';
      document.head.append(style);
      for (const rule of style.sheet?.cssRules ?? []) {
        if (!('selectorText' in rule)) continue;
        const value = (rule as CSSStyleRule).style.getPropertyValue('font-size');
        // 0.875rem and 1rem are the standard sm and base sizes; code, diagram
        // and media route them through --tx-font-size-sm / --tx-font-size-base.
        if (value === '0.875rem' || value === '1rem') {
          raw.push(`${filename}: ${(rule as CSSStyleRule).selectorText} { font-size: ${value} }`);
        }
      }
      style.remove();
    }
    expect(raw).toEqual([]);
  });
});

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cleanup, render, screen, waitFor } from '@testing-library/svelte';
import { compile } from 'svelte/compiler';
import { afterEach, describe, expect, it } from 'vitest';
import DataBlockView from '../src/data/DataBlockView.svelte';

afterEach(() => cleanup());

const base = { type: 'chart', title: 'Fictional chart', description: 'A fictional summary.' };
const points = [{ id: 'a', label: 'Alpha', x: 1, y: 2, seriesId: 'core' }];

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
});

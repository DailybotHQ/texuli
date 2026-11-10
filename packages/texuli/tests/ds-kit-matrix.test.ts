/**
 * T-t4-matrix (kit API §5.2, §11.4): exactly the enabled combinations (allow ∩ catalog), light
 * and dark; disallowed values marked, never rendered; unlocked shows every component; unknown
 * allow ids reported; grid and full with the 128 cap; built-in samples for texuli ids, host
 * snippets above, a placeholder otherwise; deterministic and crawlable.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanup, render } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  KitAllowManifest,
  KitCatalog,
  KitSampleContext,
  KitState,
} from '../src/ds-kit/index.ts';
import {
  KIT_BUILTIN_SAMPLES,
  KitMatrix,
  type MatrixComponent,
  matrixAttributes,
  matrixCells,
  matrixModel,
  matrixProps,
  staticStates,
} from '../src/ds-kit/matrix/index.ts';
import { KIT_LIMITS } from '../src/ds-kit/shared/limits.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const MATRIX_DIR = join(ROOT, 'packages/texuli/src/ds-kit/matrix');
const catalog = JSON.parse(
  readFileSync(join(ROOT, 'packages/spec/catalog/components.json'), 'utf8')
) as KitCatalog;
const byId = new Map(catalog.components.map((c) => [c.id, c]));

const allow: KitAllowManifest = {
  version: '1.0.0',
  allow: {
    button: {
      variants: ['default', 'outline'],
      sizes: ['sm', 'md', 'lg'],
      // Pinned: the catalog gives button a tone axis, and an omitted list allows every tone.
      tones: ['default'],
      states: ['hover', 'disabled'],
    },
    badge: {},
    'data-grid': { densities: ['compact'] },
    alert: { tones: [] },
    'no-such-component': {},
    card: { variants: ['elevated', 'glass'], states: ['pressed' as KitState] },
  },
};

afterEach(() => cleanup());

const component = (id: string): MatrixComponent => {
  const found = matrixModel(catalog, allow).enabled.find((c) => c.id === id);
  if (!found) throw new Error(id);
  return found;
};

describe('matrix model', () => {
  it('enables exactly the allowed catalog ids, in catalog order, and lists the rest', () => {
    const model = matrixModel(catalog, allow);
    expect(model.locked).toBe(true);
    expect(model.enabled.map((c) => c.id)).toEqual([
      'alert',
      'badge',
      'button',
      'card',
      'data-grid',
    ]);
    expect(model.disallowedComponents).toHaveLength(catalog.components.length - 5);
    expect(model.disallowedComponents).not.toContain('button');
    expect(model.issues).toEqual([
      { code: 'unknown-component', id: 'no-such-component' },
      { code: 'unknown-value', id: 'card', detail: 'variant glass' },
      { code: 'unknown-state', id: 'card', detail: 'pressed' },
    ]);
  });

  it('enables every catalog component when unlocked', () => {
    for (const manifest of [undefined, { version: '1.0.0' }]) {
      const model = matrixModel(catalog, manifest);
      expect(model.locked).toBe(false);
      expect(model.enabled).toHaveLength(catalog.components.length);
      expect(model.disallowedComponents).toEqual([]);
    }
  });

  it('splits each axis into allowed and disallowed values, and picks the default combination', () => {
    const button = component('button');
    const variant = button.axes.find((a) => a.axis === 'variant');
    expect(variant).toMatchObject({
      prop: 'variant',
      allowed: ['default', 'outline'],
      disallowed: ['secondary', 'ghost', 'destructive', 'link'],
      default: 'default',
    });
    expect(button.axes.find((a) => a.axis === 'size')?.disallowed).toEqual(['icon']);
    expect(button.states).toEqual({
      allowed: ['hover', 'disabled'],
      disallowed: ['focus-visible', 'loading'],
    });
    // An omitted list allows every value; an empty list allows none.
    expect(component('badge').axes[0]?.disallowed).toEqual([]);
    expect(component('alert').axes[0]).toMatchObject({
      allowed: [],
      disallowed: byId.get('alert')?.axes?.tone?.values,
    });
    // The catalog default when allowed, otherwise the first allowed value.
    expect(component('data-grid').defaults).toEqual({ density: 'compact' });
  });

  it('builds grid cells: variants × sizes, then prop-backed states, tones and densities', () => {
    const button = component('button');
    const grid = matrixCells(button);
    expect(grid.view).toBe('grid');
    expect(grid.cells.filter((c) => c.kind === 'grid').map((c) => c.key)).toEqual([
      'variant=default,size=sm,tone=default',
      'variant=default,size=md,tone=default',
      'variant=default,size=lg,tone=default',
      'variant=outline,size=sm,tone=default',
      'variant=outline,size=md,tone=default',
      'variant=outline,size=lg,tone=default',
    ]);
    // Hover is a pseudo-state: one live sample, not a static cell.
    expect(staticStates(button)).toEqual(['disabled']);
    expect(grid.cells.filter((c) => c.kind === 'state').map((c) => c.key)).toEqual([
      'variant=default,size=md,tone=default,state=disabled',
    ]);
    expect(matrixCells(component('data-grid')).cells.map((c) => c.key)).toEqual([
      'density=compact',
      'density=compact,state=disabled',
      'density=compact,state=loading',
      'density=compact,state=selected',
      'density=compact,state=checked',
      'density=compact,state=readonly',
    ]);
  });

  it('adds a strip per other allowed tone, after the grid, at the default variant and size', () => {
    const toned = matrixModel(catalog, {
      version: '1.0.0',
      allow: {
        button: {
          variants: ['default'],
          sizes: ['md'],
          tones: ['default', 'destructive'],
          states: [],
        },
      },
    }).enabled[0];
    if (!toned) throw new Error('button');
    expect(matrixCells(toned).cells.map((c) => [c.kind, c.key])).toEqual([
      ['grid', 'variant=default,size=md,tone=default'],
      ['tone', 'variant=default,size=md,tone=destructive'],
    ]);
    // Full: every allowed combination of the four axes.
    expect(matrixCells(toned, 'full').cells.map((c) => c.key)).toEqual([
      'variant=default,size=md,tone=default',
      'variant=default,size=md,tone=destructive',
    ]);
  });

  it('models category colors as their own allow axis and omits the none root attribute', () => {
    const badge = matrixModel(catalog, {
      version: '1.0.0',
      allow: { badge: { colors: ['none', 'chart-3'] } },
    }).enabled.find((entry) => entry.id === 'badge');
    if (!badge) throw new Error('badge');
    expect(badge.axes.find((axis) => axis.axis === 'color')).toMatchObject({
      prop: 'color',
      allowed: ['none', 'chart-3'],
      default: 'none',
    });
    const colorCell = matrixCells(badge).cells.find((cell) => cell.values.color === 'chart-3');
    if (!colorCell) throw new Error('chart-3 cell');
    expect(matrixProps(badge, colorCell.values)).toMatchObject({ color: 'chart-3' });
    expect(matrixAttributes(badge, { color: 'none' })).toEqual({ 'data-tx-component': 'badge' });
    expect(matrixAttributes(badge, { color: 'chart-3' })).toEqual({
      'data-tx-component': 'badge',
      'data-tx-color': 'chart-3',
    });
  });

  it('builds the full product, and falls back to the grid over the cap', () => {
    const full = matrixCells(component('button'), 'full');
    expect(full).toMatchObject({ view: 'full', capped: false });
    // Two variants × three sizes × one tone, each at rest and disabled.
    expect(full.cells).toHaveLength(2 * 3 * 1 * 2);
    const wide: MatrixComponent = {
      id: 'wide',
      label: 'Wide',
      group: 'test',
      axes: [
        {
          axis: 'variant',
          prop: 'variant',
          allowed: Array.from({ length: 12 }, (_, i) => `v${i}`),
          disallowed: [],
        },
        {
          axis: 'size',
          prop: 'size',
          allowed: Array.from({ length: 12 }, (_, i) => `s${i}`),
          disallowed: [],
        },
      ],
      states: { allowed: [], disallowed: [] },
      defaults: { variant: 'v0', size: 's0' },
    };
    const capped = matrixCells(wide, 'full');
    expect(capped).toMatchObject({ view: 'grid', capped: true });
    expect(capped.cells.length).toBeLessThanOrEqual(KIT_LIMITS.cellsPerComponent);
  });

  it('gives each combination its props and root attributes', () => {
    const button = component('button');
    expect(matrixProps(button, { variant: 'outline', size: 'sm' })).toEqual({
      variant: 'outline',
      size: 'sm',
    });
    expect(matrixAttributes(button, { variant: 'outline', size: 'sm' })).toEqual({
      'data-tx-component': 'button',
      'data-tx-variant': 'outline',
      'data-tx-size': 'sm',
    });
  });

  it('is total over a missing or hostile catalog', () => {
    expect(matrixModel(undefined).enabled).toEqual([]);
    expect(
      matrixModel({ catalogHash: '', components: [] }, { version: '1', allow: { x: {} } }).issues
    ).toEqual([{ code: 'unknown-component', id: 'x' }]);
  });
});

describe('built-in samples', () => {
  it('cover texuli catalog ids only, with states the catalog lists', () => {
    for (const [id, sample] of Object.entries(KIT_BUILTIN_SAMPLES)) {
      const entry = byId.get(id);
      expect(entry, id).toBeDefined();
      for (const state of Object.keys(sample.stateProps))
        expect(entry?.states, `${id} ${state}`).toContain(state);
      expect(typeof sample.load).toBe('function');
    }
  });
});

/** Waits until the lazily loaded samples have painted. */
async function settled(container: HTMLElement, selector: string, count: number) {
  await vi.waitFor(() => expect(container.querySelectorAll(selector)).toHaveLength(count), {
    timeout: 5000,
  });
}

describe('KitMatrix', () => {
  it('renders exactly the enabled combinations, light and dark, with the components’ own root attributes', async () => {
    const { container } = render(KitMatrix, { props: { catalog, allow } });
    // button: 6 grid cells + 1 disabled + 1 live sample, per mode.
    await settled(container, '[data-tx-component="button"]', (6 + 1 + 1) * 2);
    for (const mode of ['light', 'dark']) {
      const grid = container.querySelector(
        `#tx-ds-kit-matrix-button [data-tx-ds-kit-grid="${mode}"]`
      );
      expect(grid?.querySelectorAll('[data-tx-ds-kit-cell-kind="grid"]')).toHaveLength(6);
    }
    const variants = [...container.querySelectorAll('[data-tx-component="button"]')].map((el) =>
      el.getAttribute('data-tx-variant')
    );
    expect(new Set(variants)).toEqual(new Set(['default', 'outline']));
    // The disabled cell really is disabled.
    const disabled = container.querySelector(
      '[data-tx-ds-kit-cell="variant=default,size=md,tone=default,state=disabled"] [data-tx-component="button"]'
    );
    expect(
      disabled?.hasAttribute('disabled') || disabled?.getAttribute('aria-disabled') === 'true'
    ).toBe(true);
  });

  it('marks disallowed values and components as text, never as samples', async () => {
    const { container } = render(KitMatrix, { props: { catalog, allow, modeView: 'light' } });
    const marked = container.querySelector(
      '#tx-ds-kit-matrix-button [data-tx-ds-kit-disallowed="variant"]'
    );
    expect(marked?.textContent).toContain('Not allowed');
    expect(marked?.textContent).toContain('secondary, ghost, destructive, link');
    expect(
      container.querySelector('#tx-ds-kit-matrix-button [data-tx-ds-kit-disallowed="state"]')
        ?.textContent
    ).toContain('focus-visible, loading');
    await settled(container, '[data-tx-component="button"]', 6 + 1 + 1);
    expect(
      container.querySelector('[data-tx-component="button"][data-tx-variant="ghost"]')
    ).toBeNull();
    expect(container.querySelector('[data-tx-component="button"][data-tx-size="icon"]')).toBeNull();
    const list = container.querySelector('[data-tx-ds-kit-disallowed-components]');
    expect(list?.textContent).toContain('dialog');
    expect(list?.querySelector('[data-tx-component]')).toBeNull();
    expect(
      container.querySelector('[data-tx-ds-kit-issue="unknown-component"]')?.textContent
    ).toContain('no-such-component');
  });

  it('renders host samples for ids above texuli with their context, and a placeholder otherwise', () => {
    const contexts: KitSampleContext[] = [];
    const grid = createRawSnippet((ctx: () => KitSampleContext) => ({
      render: () => {
        contexts.push(ctx());
        return `<div data-host-sample="${ctx().mode}"></div>`;
      },
    }));
    const { container } = render(KitMatrix, {
      props: { catalog, allow, samples: { 'data-grid': grid } },
    });
    // Per mode: the density cell, five prop-backed states and the live pseudo-state sample.
    expect(container.querySelectorAll('[data-host-sample="light"]')).toHaveLength(7);
    expect(container.querySelectorAll('[data-host-sample="dark"]')).toHaveLength(7);
    expect(
      contexts
        .filter((c) => c.state)
        .map((c) => c.state)
        .slice(0, 5)
    ).toEqual(['disabled', 'loading', 'selected', 'checked', 'readonly']);
    expect(contexts[0]).toMatchObject({
      id: 'data-grid',
      props: { density: 'compact' },
      attributes: { 'data-tx-component': 'data-grid', 'data-tx-density': 'compact' },
    });
    cleanup();
    const bare = render(KitMatrix, { props: { catalog, allow, modeView: 'dark' } });
    expect(
      bare.container.querySelector(
        '#tx-ds-kit-matrix-data-grid [data-tx-ds-kit-placeholder="host"]'
      )?.textContent
    ).toContain('Live sample supplied by the host app');
  });

  it('is deterministic and deep-linkable, and hides the disallowed list on request', () => {
    const order = () =>
      [...document.querySelectorAll('[data-tx-ds-kit-component]')].map((el) =>
        el.getAttribute('data-tx-ds-kit-component')
      );
    render(KitMatrix, {
      props: { catalog, allow, currentItem: 'card', idPrefix: 'kit', showDisallowed: false },
    });
    const first = order();
    expect(first).toEqual(['alert', 'badge', 'button', 'card', 'data-grid']);
    expect(document.querySelector('#kit-matrix-card')?.getAttribute('aria-current')).toBe('true');
    expect(document.querySelector('[data-tx-ds-kit-disallowed-components]')).toBeNull();
    cleanup();
    render(KitMatrix, { props: { catalog, allow, idPrefix: 'kit' } });
    expect(order()).toEqual(first);
  });

  it('shows the full product on request', async () => {
    const { container } = render(KitMatrix, {
      props: {
        catalog,
        allow: { version: '1', allow: { button: allow.allow?.button ?? {} } },
        matrix: 'full',
        modeView: 'light',
      },
    });
    expect(container.querySelectorAll('[data-tx-ds-kit-cell-kind="full"]')).toHaveLength(
      2 * 3 * 1 * 2
    );
  });
});

describe('matrix sources', () => {
  it('are sink-free, fetch nothing and use logical CSS', () => {
    for (const file of readdirSync(MATRIX_DIR)) {
      const source = readFileSync(join(MATRIX_DIR, file), 'utf8');
      expect(source, file).not.toMatch(/\{@html|innerHTML|set:html|eval\(|new Function|fetch\(/u);
      if (file.endsWith('.css'))
        expect(source, file).not.toMatch(
          /margin-(left|right)|padding-(left|right)|\b(left|right|top|bottom):/u
        );
    }
  });
});

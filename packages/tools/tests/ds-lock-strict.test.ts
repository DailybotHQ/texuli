/**
 * The strict lock of Texuli 0.17.1 (PLAN_016 T-0171-lock, amendment r31, from the Protoyard
 * 0.17.0 adoption findings):
 *
 * 1. a catalog root nested inside an allowed root is covered by it only when it is a declared
 *    part (compound `select-trigger` of `select`) or a composed id of that parent; a data-grid
 *    inside an allowed card is `not-allowed`, as in 0.16.1;
 * 2. the render host reads the root attribute the caller chose (default `data-tx-component`);
 *    a page cannot switch the color check to `data-ds-check-component` with its own markup;
 * 3. `render-disabled-value`, `not-allowed` and `unmapped` findings each keep their own cap.
 */
import { Window } from 'happy-dom';
import { afterEach, describe, expect, it } from 'vitest';
import {
  DS_CHECK_COMPONENT_ATTRIBUTE,
  DS_TX_COMPONENT_ATTRIBUTE,
  dsCheckComponentSelector,
  installDsCheckHost,
} from '../src/ds-check/host.ts';
import {
  DS_MAP_MAX_ISSUES,
  mapDesignSystemTree,
  resolveAllowedComponentId,
} from '../src/ds-check/map.ts';

let window: Window | undefined;
const saved: Record<string, unknown> = {};
afterEach(async () => {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete (globalThis as Record<string, unknown>)[key];
    else (globalThis as Record<string, unknown>)[key] = value;
  }
  for (const key of Object.keys(saved)) delete saved[key];
  await window?.happyDOM.close();
  window = undefined;
});

function tree(markup: string) {
  window ??= new Window();
  const scope = window.document.createElement('main');
  // Test fixture markup (fictional), parsed by happy-dom; never page or agent input.
  scope.innerHTML = markup;
  window.document.body.append(scope);
  return scope as unknown as HTMLElement;
}

const allow = (ids: readonly string[], extra?: Record<string, Record<string, unknown>>) => ({
  allow: Object.fromEntries(ids.map((id) => [id, extra?.[id] ?? {}])),
});

describe('a nested catalog root is covered only as a declared part or composed id', () => {
  it('refuses a data-grid inside an allowed card (0.16.1 behavior)', () => {
    const report = mapDesignSystemTree(
      tree(
        '<div data-tx-component="card"><div data-tx-component="data-grid" role="grid"><button>Sort</button></div></div>'
      ),
      { allowManifest: allow(['card']) }
    );
    expect(report.ok).toBe(false);
    expect(report.errors.map((issue) => [issue.code, issue.source])).toEqual([
      ['not-allowed', 'data-grid'],
    ]);
    expect(resolveAllowedComponentId('data-grid', new Set(['card']), { ancestor: 'card' })).toBe(
      undefined
    );
  });

  it('refuses an independent id nested in a compound parent', () => {
    // button-group is its own catalog id, not a part of select.
    const report = mapDesignSystemTree(
      tree(
        '<div data-tx-component="select"><div data-tx-component="button-group"><button>A</button></div></div>'
      ),
      { allowManifest: allow(['select']) }
    );
    expect(report.codes).toEqual(['not-allowed']);
  });

  it('keeps declared parts and composed ids under their allowed parent', () => {
    const parts = tree(
      '<div data-tx-component="select"><button data-tx-component="select-trigger">Open</button></div>'
    );
    expect(mapDesignSystemTree(parts, { allowManifest: allow(['select']) }).ok).toBe(true);

    const namespaced = tree(
      '<div data-tx-component="acme:select"><button data-tx-component="acme:select-trigger">Open</button></div>'
    );
    expect(mapDesignSystemTree(namespaced, { allowManifest: allow(['acme:select']) }).ok).toBe(
      true
    );

    const composed = tree(
      '<div data-tx-component="acme:kpi-strip"><span data-tx-component="kpi"><button>Details</button></span></div>'
    );
    expect(
      mapDesignSystemTree(composed, {
        allowManifest: allow(['acme:kpi-strip']),
        composed: { kpi: 'acme:kpi-strip' },
      }).ok
    ).toBe(true);
    // A composed id of another parent is not covered by this one.
    expect(
      mapDesignSystemTree(composed, {
        allowManifest: allow(['acme:kpi-strip']),
        composed: { kpi: 'acme:other' },
      }).codes
    ).toEqual(['not-allowed']);
  });
});

describe('the host reads the attribute the caller chose', () => {
  function host(markup: string, componentAttribute?: string) {
    const scope = tree(markup);
    const win = window as Window;
    // The host builds one constructable stylesheet and waits two frames: lend happy-dom's.
    for (const key of ['CSSStyleSheet', 'requestAnimationFrame', 'getComputedStyle'] as const) {
      saved[key] = (globalThis as Record<string, unknown>)[key];
      (globalThis as Record<string, unknown>)[key] = (win as unknown as Record<string, unknown>)[
        key
      ];
    }
    return installDsCheckHost(scope, componentAttribute ? { componentAttribute } : {});
  }

  const PAGE =
    '<div data-tx-component="button"><button>Save</button></div>' +
    // Page content that tries to steer the check onto its own marks.
    '<section data-ds-check-component="blocks-text"><p>Hello</p></section>';

  it('defaults to data-tx-component even when the page carries data-ds-check-component', async () => {
    expect(await host(PAGE).ready()).toEqual(['button']);
  });

  it('reads data-ds-check-component only when the caller passes it (the conformance sheet)', async () => {
    expect(await host(PAGE, DS_CHECK_COMPONENT_ATTRIBUTE).ready()).toEqual(['blocks-text']);
  });

  it('selects one attribute only; any other value reads data-tx-component', () => {
    expect(dsCheckComponentSelector()).toBe(`[${DS_TX_COMPONENT_ATTRIBUTE}]`);
    expect(dsCheckComponentSelector(DS_TX_COMPONENT_ATTRIBUTE)).toBe(
      `[${DS_TX_COMPONENT_ATTRIBUTE}]`
    );
    expect(dsCheckComponentSelector(DS_CHECK_COMPONENT_ATTRIBUTE)).toBe(
      `[${DS_CHECK_COMPONENT_ATTRIBUTE}]`
    );
    expect(dsCheckComponentSelector('data-anything')).toBe(`[${DS_TX_COMPONENT_ATTRIBUTE}]`);
  });
});

describe('each finding code keeps its own cap', () => {
  it('unmapped findings are never crowded out by render-disabled-value', () => {
    const disabled = Array.from(
      { length: DS_MAP_MAX_ISSUES + 10 },
      (_, i) => `<span data-tx-component="badge" data-tx-variant="loud" id="b${i}"></span>`
    ).join('');
    const loose = Array.from(
      { length: DS_MAP_MAX_ISSUES + 10 },
      (_, i) => `<button id="u${i}">Loose ${i}</button>`
    ).join('');
    const report = mapDesignSystemTree(tree(disabled + loose), {
      allowManifest: allow(['badge'], { badge: { variants: ['default'] } }),
    });
    const count = (code: string) => report.errors.filter((issue) => issue.code === code).length;
    expect(count('render-disabled-value')).toBe(DS_MAP_MAX_ISSUES);
    expect(count('unmapped')).toBe(DS_MAP_MAX_ISSUES);
    expect(report.codes).toEqual(['render-disabled-value', 'unmapped']);
  });

  it('not-allowed findings keep their own cap too', () => {
    const roots = Array.from(
      { length: DS_MAP_MAX_ISSUES + 5 },
      (_, i) => `<div data-tx-component="data-grid" id="g${i}"></div>`
    ).join('');
    const loose = '<button id="loose">Loose</button>';
    const report = mapDesignSystemTree(tree(roots + loose), { allowManifest: allow(['card']) });
    expect(report.errors.filter((issue) => issue.code === 'not-allowed')).toHaveLength(
      DS_MAP_MAX_ISSUES
    );
    expect(report.errors.filter((issue) => issue.code === 'unmapped')).toHaveLength(1);
  });
});

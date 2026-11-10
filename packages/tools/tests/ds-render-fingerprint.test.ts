/**
 * Render findings in baselines and the disabled-value rule (PLAN_018 T-render, Texuli 0.17.3,
 * from the Protoyard findings 5 and 6):
 *
 * 5. `dsReportFingerprint` and `compareDsReport` key a finding by code, path, route, viewport
 *    and mode, so render findings never merge across them. A finding with none of the three
 *    keys as before, and a field an older baseline does not record matches any value.
 * 6. `render-disabled-value` checks a root against its own allow entry, like the static rule,
 *    and reports once per root: a part inside its parent's root is not reported again, and
 *    several disabled axes on one root are one finding.
 */
import { createHash } from 'node:crypto';
import { Window } from 'happy-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { compareDsReport, dsReportFingerprint } from '../src/ds-check/baseline.ts';
import { renderLockedDesignSystemCheck, renderWhere } from '../src/ds-check/locked-render.ts';
import { mapDesignSystemTree } from '../src/ds-check/map.ts';
import type { DsCheckPage } from '../src/ds-check/render.ts';
import { checkDesignSystem } from '../src/ds-check/static.ts';
import { MINIMAL_DESIGN_SYSTEM } from '../src/ops/design-system.ts';

const finding = (extra: Record<string, unknown> = {}) => ({
  code: 'render-literal',
  path: '$.render["button"] button',
  severity: 'error',
  ...extra,
});
const report = (...findings: unknown[]) => ({ findings });

describe('baseline keys: code, path, route, viewport and mode', () => {
  it('keeps findings on different routes, viewports and modes apart', () => {
    const variants = [
      finding({ route: '/billing', viewport: '1280x720', mode: 'light' }),
      finding({ route: '/settings', viewport: '1280x720', mode: 'light' }),
      finding({ route: '/billing', viewport: '390x844', mode: 'light' }),
      finding({ route: '/billing', viewport: '1280x720', mode: 'dark' }),
    ];
    const prints = new Set(variants.map((item) => dsReportFingerprint(report(item))));
    expect(prints.size).toBe(4);
    // A finding on one more route (or viewport, or mode) is a regression.
    for (const added of variants.slice(1)) {
      const compare = compareDsReport(report(variants[0]), report(variants[0], added));
      expect(compare.ok).toBe(false);
      expect(compare.added).toHaveLength(1);
    }
    // Order does not matter.
    expect(dsReportFingerprint(report(...variants))).toBe(
      dsReportFingerprint(report(...[...variants].reverse()))
    );
  });

  it('reads a { width, height } viewport like its <width>x<height> text', () => {
    expect(dsReportFingerprint(report(finding({ viewport: { width: 390, height: 844 } })))).toBe(
      dsReportFingerprint(report(finding({ viewport: '390x844' })))
    );
  });

  it('keys a finding without route, viewport or mode exactly as before 0.17.3', () => {
    const legacy = createHash('sha256')
      .update(['a-code\t$.a', 'b-code\t$.b'].join('\n'))
      .digest('hex');
    expect(
      dsReportFingerprint(report({ code: 'b-code', path: '$.b' }, { code: 'a-code', path: '$.a' }))
    ).toBe(legacy);
  });

  it('reads an older baseline: a field it does not record matches any value', () => {
    // Saved before 0.17.3: render findings had no route or viewport.
    const older = report(finding({ mode: 'light' }), { code: 'unmapped', path: 'main>button' });
    const now = report(
      finding({ route: '/billing', viewport: '1280x720', mode: 'light' }),
      finding({ route: '/settings', viewport: '1280x720', mode: 'light' }),
      { code: 'unmapped', path: 'main>button', route: '/billing', viewport: '1280x720' }
    );
    const compare = compareDsReport(older, now);
    expect(compare.ok).toBe(true);
    expect(compare.added).toEqual([]);
    expect(compare.removed).toEqual([]);
    // A mode the baseline does record still separates.
    const dark = compareDsReport(older, report(finding({ route: '/billing', mode: 'dark' })));
    expect(dark.added).toEqual([
      {
        code: 'render-literal',
        path: '$.render["button"] button',
        route: '/billing',
        mode: 'dark',
      },
    ]);
    expect(dark.removed.map((item) => item.code)).toEqual(['render-literal', 'unmapped']);
  });

  it('ignores malformed findings and bounds the key fields', () => {
    const hostile = report(
      null,
      { code: 3 },
      { code: 'x', path: '$', route: 'r'.repeat(10_000), viewport: { width: 'w' } }
    );
    expect(dsReportFingerprint(hostile)).toBe(
      dsReportFingerprint(report({ code: 'x', path: '$', route: 'r'.repeat(512) }))
    );
    expect(dsReportFingerprint('nope')).toBe(dsReportFingerprint(report()));
  });
});

describe('render findings carry their route and viewport', () => {
  it('derives the route from the URL path and query, and the viewport from the page', () => {
    const page = { viewportSize: () => ({ width: 1280, height: 720 }) };
    expect(renderWhere('http://127.0.0.1:9/app/billing?tab=2#top', page)).toEqual({
      route: '/app/billing?tab=2',
      viewport: '1280x720',
    });
    expect(renderWhere('not a url', {})).toEqual({});
    expect(
      renderWhere('http://127.0.0.1:9/', {
        viewportSize: () => {
          throw new Error('closed');
        },
      })
    ).toEqual({ route: '/' });
  });

  it('labels every locked render finding of a served page', async () => {
    const checked = await checkDesignSystem(MINIMAL_DESIGN_SYSTEM, { modes: ['light'] });
    const page = {
      goto: async () => undefined,
      emulateMedia: async () => undefined,
      waitForFunction: async () => true,
      viewportSize: () => ({ width: 390, height: 844 }),
      evaluate: (async (_fn: unknown, arg: unknown) => {
        if (!Array.isArray(arg)) return ['button'];
        if (arg.length === 2)
          return {
            ok: false,
            codes: ['not-allowed'],
            errors: [{ code: 'not-allowed', path: 'main>div', message: 'Not allowed.' }],
          };
        return { components: ['button'], checked: 1, pairs: [], literals: [] };
      }) as DsCheckPage['evaluate'],
    };
    const load = async (specifier: string) => {
      if (specifier === 'playwright')
        return {
          chromium: {
            launch: async () => ({
              newContext: async () => ({ newPage: async () => page }),
              close: async () => undefined,
            }),
          },
        };
      if (specifier === '@axe-core/playwright')
        return {
          default: class {
            include() {
              return this;
            }
            withTags() {
              return this;
            }
            async analyze() {
              return { violations: [] };
            }
          },
        };
      throw new Error(`not installed: ${specifier}`);
    };
    const { locked } = await renderLockedDesignSystemCheck(
      checked,
      { allow: { button: {} } },
      { url: 'http://127.0.0.1:9/billing', load }
    );
    expect(locked.errors.length).toBeGreaterThan(0);
    for (const issue of locked.errors) {
      expect(issue.route).toBe('/billing');
      expect(issue.viewport).toBe('390x844');
    }
  });
});

let window: Window | undefined;
afterEach(async () => {
  await window?.happyDOM.close();
  window = undefined;
});

function tree(markup: string): HTMLElement {
  window ??= new Window();
  const scope = window.document.createElement('main');
  // Test fixture markup (fictional), parsed by happy-dom.
  scope.innerHTML = markup;
  window.document.body.append(scope);
  return scope as unknown as HTMLElement;
}

const disabled = (markup: string, allow: Record<string, unknown>) =>
  mapDesignSystemTree(tree(markup), { allowManifest: { allow } }).errors.filter(
    (issue) => issue.code === 'render-disabled-value'
  );

describe('render-disabled-value follows the static rule, once per root', () => {
  it('checks a part with its own entry against that entry, not the parent', () => {
    const markup =
      '<div data-tx-component="select" data-tx-size="sm">' +
      '<button data-tx-component="select-trigger" data-tx-size="lg">Open</button></div>';
    const found = disabled(markup, {
      select: { sizes: ['sm'] },
      'select-trigger': { sizes: ['lg'] },
    });
    expect(found).toEqual([]);
    const own = disabled(markup, {
      select: { sizes: ['sm', 'lg'] },
      'select-trigger': { sizes: ['sm'] },
    });
    expect(own.map((issue) => issue.source)).toEqual(['select-trigger']);
  });

  it('reports a part without its own entry once, on its parent root', () => {
    // The trigger repeats its parent's size: one finding, on the select root.
    const found = disabled(
      '<div data-tx-component="select" data-tx-size="lg">' +
        '<button data-tx-component="select-trigger" data-tx-size="lg">Open</button>' +
        '<div data-tx-component="select-content" data-tx-size="lg"></div></div>',
      { select: { sizes: ['sm'] } }
    );
    expect(found).toHaveLength(1);
    expect(found[0]?.source).toBe('select');
    expect(found[0]?.path).not.toContain('select-trigger');
  });

  it('checks a part standing alone against its covering parent entry', () => {
    const found = disabled(
      '<button data-tx-component="select-trigger" data-tx-size="lg">Open</button>',
      { select: { sizes: ['sm'] } }
    );
    expect(found.map((issue) => issue.source)).toEqual(['select']);
  });

  it('joins several disabled axes of one root into one finding', () => {
    const found = disabled(
      '<button data-tx-component="button" data-tx-variant="ghost" data-tx-size="lg">Go</button>',
      { button: { variants: ['default'], sizes: ['sm'] } }
    );
    expect(found).toHaveLength(1);
    expect(found[0]?.message).toBe(
      'Rendered variant "ghost", size "lg" are not allowed for "button".'
    );
  });
});

// @vitest-environment node
import { type Schema, validateBlueprint } from '@texuli/spec';
import { projectCatalog } from '@texuli/spec/codegen';
import { validateWorkflowGraph } from '@texuli/spec/workflow';
import { describe, expect, it } from 'vitest';
import { DASHBOARD_LIMITS } from '../../data/src/dashboard/engine/index.ts';
import blueprintJson from '../../spec/schemas/blueprint.schema.json';
import workflowJson from '../../spec/schemas/workflow.schema.json';
import { buildCatalog } from '../src/build/build.ts';
import { discoverManifestGroups } from '../src/build/node.ts';
import { renderCatalogFromBuild } from '../src/render/renderer/index.ts';
import {
  DRAFT_FRAME_IDS,
  type DraftValidation,
  MAX_DASHBOARD_WIDGETS,
  validateDraft,
} from '../src/validate/index.ts';

/**
 * Dashboards in blueprints (spec 0.8.0, PLAN_010 T-dashboard): agents build a
 * dashboard as data (a data-dashboard of data-dashboard-widget nodes whose
 * content is ordinary catalog nodes); the composition rules hold at the
 * untrusted tier, and widget data comes only from host-registered sources.
 */

const build = await buildCatalog(await discoverManifestGroups());
const catalog = renderCatalogFromBuild(build.catalog);
const documents = {
  blueprintSchema: blueprintJson as unknown as Schema,
  catalog: projectCatalog(build.catalog, build.hash),
  workflowSchema: workflowJson as unknown as Schema,
  validateWorkflowGraph,
};
/** The full check a host runs: the catalog's own checks plus the spec (prop value schemas). */
const withSpec = (tree: unknown) =>
  validateDraft(
    {
      format: 'texuli-blueprint',
      version: 1,
      id: 'dashboard-test',
      catalog: build.hash,
      status: 'draft',
      createdAt: '2026-10-29T09:00:00Z',
      updatedAt: '2026-10-29T09:00:00Z',
      generator: { kind: 'tool', name: 'dashboard test' },
      spec: '0.8.0',
      tree,
    },
    {
      catalog,
      catalogHash: build.hash,
      checkSpec: (value) => validateBlueprint(value, documents, { catalogHash: build.hash }),
    }
  );
const codes = (result: DraftValidation) =>
  result.diagnostics.filter((d) => d.severity === 'error').map((d) => `${d.check}:${d.code}`);

const widget = (
  widgetId: unknown,
  extra: Record<string, unknown> = {},
  children: unknown[] = []
) => ({
  id: 'data-dashboard-widget',
  props: {
    widgetId,
    title: `Widget ${String(widgetId)}`,
    place: { x: 0, y: 0, w: 4, h: 2 },
    ...extra,
  },
  children,
});
const dashboard = (children: unknown[], props: Record<string, unknown> = {}) => ({
  id: 'data-dashboard',
  props: { label: 'Operations', editable: true, ...props },
  children,
});

describe('dashboards in validateDraft', () => {
  it('accepts a dashboard of widgets as a frame root at the untrusted tier', () => {
    expect(DRAFT_FRAME_IDS).toContain('data-dashboard');
    const result = withSpec(
      dashboard(
        [
          widget('revenue', {}, [
            { id: 'charts-gauge', props: { label: 'Uptime', value: 99, min: 0, max: 100 } },
          ]),
          widget('signups', { place: { x: 4, y: 0, w: 8, h: 3, minW: 2, locked: true } }),
        ],
        { layout: [{ id: 'revenue', x: 0, y: 0, w: 4, h: 2 }], columns: 12, compaction: 'none' }
      )
    );
    expect(codes(result)).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('refuses broken composition: strangers in a dashboard, widgets outside, bad and duplicate ids', () => {
    const cases: [string, unknown, string[]][] = [
      [
        'a stranger child',
        dashboard([widget('a'), { id: 'charts-gauge', props: { label: 'x', value: 1 } }]),
        ['render:dashboard-child'],
      ],
      [
        'a widget outside a dashboard',
        { id: 'layout-page', props: { title: 'Page' }, children: [widget('a')] },
        ['render:dashboard-parent'],
      ],
      [
        'a duplicate widget id',
        dashboard([widget('a'), widget('a')]),
        ['render:dashboard-widget-id'],
      ],
      ['an id with spaces', dashboard([widget('two words')]), ['render:dashboard-widget-id']],
      ['an id too long', dashboard([widget('x'.repeat(65))]), ['render:dashboard-widget-id']],
    ];
    for (const [name, tree, expected] of cases) {
      expect(codes(validateDraft(tree, { catalog })), name).toEqual(expected);
    }
  });

  it('refuses out-of-grid places and layouts through the prop schemas', () => {
    // The renderer paints only clamped grid units anyway (the engine normalizes
    // every layout); the spec check refuses them up front.
    const wide = withSpec(dashboard([widget('a', { place: { x: 0, y: 0, w: 99, h: 2 } })]));
    expect(codes(wide)).toContain('spec:prop-type');
    const layout = withSpec(
      dashboard([widget('a')], { layout: [{ id: 'a', x: -1, y: 0, w: 4, h: 2 }] })
    );
    expect(codes(layout)).toContain('spec:prop-type');
    const extra = withSpec(
      dashboard([widget('a', { place: { x: 0, y: 0, w: 4, h: 2, style: 'color:red' } })])
    );
    expect(extra.ok).toBe(false);
  });

  it('keeps widget data to host-registered sources: no URLs, no code', () => {
    const fetched = validateDraft(
      dashboard([
        widget('orders', {}, [
          {
            id: 'data-grid',
            props: {
              caption: 'Orders',
              columns: [{ key: 'id', header: 'Order' }],
              rows: { $source: 'https://evil.example/orders', query: {} },
            },
          },
        ]),
      ]),
      { catalog }
    );
    expect(fetched.ok).toBe(false);
    const handler = validateDraft(dashboard([widget('a', { onclick: 'alert(1)' })]), { catalog });
    expect(handler.ok).toBe(false);
  });

  it('caps widgets at the engine’s limit, linearly on a hostile tree', () => {
    expect(MAX_DASHBOARD_WIDGETS).toBe(DASHBOARD_LIMITS.widgets);
    const many = Array.from({ length: 300 }, (_, i) => widget(`w${i}`));
    const started = performance.now();
    const result = validateDraft(dashboard(many), {
      catalog,
      limits: { maxNodes: 5000, maxBranching: 400 },
    });
    expect(performance.now() - started).toBeLessThan(2000);
    expect(codes(result)).toContain('render:dashboard-widgets');
  });
});

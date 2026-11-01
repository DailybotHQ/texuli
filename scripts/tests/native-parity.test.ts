/**
 * The web ↔ native parity generator (PLAN_012 T-native-parity-audit): the
 * registry parser, the matrix built from fixtures (an id native lacks, an
 * id native names that the catalog does not), the rendered page, and the
 * committed matrix matching the repository.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildParity,
  CAPABILITIES,
  loadParity,
  PATHS,
  parseNativeRegistry,
  renderParityJson,
  renderParityMarkdown,
  traceIds,
} from '../native-parity.ts';

const ROOT = resolve(import.meta.dirname, '../..');

const REGISTRY = [
  'object NativeRegistry {',
  '  private val compactCharts = setOf("charts-gauge")',
  '  val implemented: Set<String> = setOf(',
  '    "layout-page",',
  '    // 0.8.0 (ADR-016): a comment with parentheses',
  '    "blocks-code",',
  '    "ghost-widget",',
  '  ) + compactCharts',
  '}',
].join('\n');

const CATALOG = [
  { id: 'layout-page', group: 'layouts', capability: 'portable', emit: ['developer', 'untrusted'] },
  { id: 'blocks-code', group: 'content', capability: 'portable', emit: ['developer', 'untrusted'] },
  { id: 'charts-gauge', group: 'content', emit: ['developer', 'untrusted'] },
  { id: 'data-grid', group: 'data', capability: 'web-only', emit: ['developer', 'untrusted'] },
  { id: 'overlay-dialog', group: 'overlays', emit: [] },
];

describe('native parity', () => {
  it('parses NativeRegistry, comments with parentheses and the chart set included', () => {
    expect(parseNativeRegistry(REGISTRY)).toEqual([
      'blocks-code',
      'charts-gauge',
      'ghost-widget',
      'layout-page',
    ]);
    expect(parseNativeRegistry(REGISTRY.replace(' + compactCharts', ''))).not.toContain(
      'charts-gauge'
    );
  });

  it('builds the matrix: painted, placeholders, agent tiers, rules, goldens and unknown native ids', () => {
    const report = buildParity({
      specVersion: '9.9.9',
      catalog: CATALOG,
      registry: REGISTRY,
      semantics: {
        components: [
          { id: 'layout-page', role: 'main' },
          { prefix: 'charts-', role: 'figure' },
        ],
      },
      traces: [{ golden: 'g', trace: [{ id: 'layout-page', children: [{ id: 'data-grid' }] }] }],
      capabilities: [],
    });
    expect(report.totals).toEqual({
      catalog: 5,
      painted: 3,
      placeholder: 2,
      agentEmittable: 4,
      agentEmittablePainted: 3,
      semanticRules: 2,
      goldenTraces: 1,
      goldenCovered: 2,
    });
    expect(report.unknownNativeIds).toEqual(['ghost-widget']);
    const row = (id: string) => report.components.find((entry) => entry.id === id);
    expect(row('data-grid')).toMatchObject({
      native: 'placeholder',
      web: 'renders',
      golden: true,
      agentEmittable: true,
    });
    expect(row('overlay-dialog')).toMatchObject({
      native: 'placeholder',
      agentEmittable: false,
      capability: 'unknown',
    });
    expect(row('charts-gauge')).toMatchObject({ native: 'painted', semanticRule: true });
    expect(report.groups).toEqual([
      { group: 'content', total: 2, painted: 2 },
      { group: 'data', total: 1, painted: 0 },
      { group: 'layouts', total: 1, painted: 1 },
      { group: 'overlays', total: 1, painted: 0 },
    ]);
    const page = renderParityMarkdown(report);
    expect(page).toContain('| Painted natively | 3 |');
    expect(page).toContain('(3 of 5 components)');
    expect(page).toContain('| `data-grid` | data | yes | renders | placeholder | — | yes |');
    expect(page).toContain('NativeRegistry ids missing from the catalog: ghost-widget.');
  });

  it('walks nested trace trees for ids', () => {
    expect([
      ...traceIds({ trace: [{ id: 'a', children: [{ id: 'b', children: [{ id: 'c' }] }] }] }),
    ]).toEqual(['a', 'b', 'c']);
  });

  it('keeps the committed matrix equal to the repository, with every capability cited', () => {
    const report = loadParity(ROOT);
    expect(report.unknownNativeIds).toEqual([]);
    expect(report.totals.painted).toBeGreaterThan(0);
    expect(report.totals.painted).toBeLessThan(report.totals.catalog);
    expect(readFileSync(resolve(ROOT, PATHS.json), 'utf8')).toBe(renderParityJson(report, ROOT));
    expect(readFileSync(resolve(ROOT, PATHS.markdown), 'utf8')).toBe(renderParityMarkdown(report));
    for (const capability of CAPABILITIES)
      expect(capability.evidence.length, capability.name).toBeGreaterThan(0);
    expect(new Set(CAPABILITIES.map((capability) => capability.status))).toEqual(
      new Set(['parity', 'partial', 'validation-only', 'none'])
    );
  });
});

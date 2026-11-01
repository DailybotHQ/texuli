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
  parseReadOnly,
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
      parityTraces: 0,
      traceCovered: 2,
      readOnly: 0,
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
    expect(page).toContain('| `data-grid` | data | yes | renders | placeholder | — | yes | — |');
    expect(page).toContain('NativeRegistry ids missing from the catalog: ghost-widget.');
  });

  it('adds every named set to implemented and reads the read-only set', () => {
    const source = [
      'object NativeRegistry {',
      '  private val cartesian = setOf("charts-line")',
      '  private val tables = setOf("data-grid")',
      '  val implemented: Set<String> = setOf("layout-page") + cartesian + tables',
      '  val readOnly: Set<String> = setOf("data-grid")',
      '}',
    ].join('\n');
    expect(parseNativeRegistry(source)).toEqual(['charts-line', 'data-grid', 'layout-page']);
    expect(parseReadOnly(source)).toEqual(['data-grid']);
  });

  it('refuses a painted id with no semantic rule or no trace, and marks read-only ids (ADR-025)', () => {
    const catalog = [
      { id: 'charts-line', group: 'content', emit: ['developer', 'untrusted'] },
      { id: 'data-grid', group: 'data', emit: ['developer', 'untrusted'] },
      { id: 'data-board', group: 'data', emit: ['developer', 'untrusted'] },
      { id: 'blocks-code', group: 'content', emit: ['developer', 'untrusted'] },
    ];
    const registry = [
      'object NativeRegistry {',
      '  val implemented: Set<String> = setOf("charts-line", "data-grid", "data-board", "blocks-code")',
      '  val readOnly: Set<String> = setOf("data-grid", "data-board")',
      '}',
    ].join('\n');
    const report = buildParity({
      specVersion: '9.9.9',
      catalog,
      registry,
      semantics: {
        components: [
          { prefix: 'charts-', role: 'figure' },
          { id: 'data-grid', role: 'table' },
        ],
      },
      traces: [{ golden: 'g', trace: [{ id: 'charts-line' }] }],
      parityTraces: [{ fixture: 'p', trace: [{ id: 'data-grid' }, { id: 'blocks-code' }] }],
      capabilities: [],
    });
    // data-board has no rule and no trace; blocks-code takes its block's rule.
    expect(report.uncovered).toEqual(['data-board']);
    expect(report.totals).toMatchObject({ parityTraces: 1, traceCovered: 3, readOnly: 2 });
    const row = (id: string) => report.components.find((entry) => entry.id === id);
    expect(row('data-grid')).toMatchObject({ readOnly: true, parityTrace: true, golden: false });
    const page = renderParityMarkdown(report);
    expect(page).toContain(
      '| `data-grid` | data | yes | renders | painted (read-only) | yes | — | yes |'
    );
    expect(page).toContain('Painted without a semantic rule or a trace: data-board.');
  });

  it('walks nested trace trees for ids', () => {
    expect([
      ...traceIds({ trace: [{ id: 'a', children: [{ id: 'b', children: [{ id: 'c' }] }] }] }),
    ]).toEqual(['a', 'b', 'c']);
  });

  it('keeps the committed matrix equal to the repository, with every capability cited', () => {
    const report = loadParity(ROOT);
    expect(report.unknownNativeIds).toEqual([]);
    expect(report.uncovered).toEqual([]);
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

describe('native docs quote the current matrix', () => {
  it('states the painted, vocabulary, emittable and golden counts the matrix reports', () => {
    const { totals, components } = loadParity(ROOT);
    const adoption = readFileSync(resolve(ROOT, 'native/docs/ADOPTION.md'), 'utf8').replace(
      /\s+/g,
      ' '
    );
    const readme = readFileSync(resolve(ROOT, 'native/README.md'), 'utf8').replace(/\s+/g, ' ');
    const other = totals.catalog - totals.agentEmittable;
    const unknown = components.filter((row) => row.capability === 'unknown').length;
    const webOnly = components.filter((row) => row.capability === 'web-only').length;
    for (const phrase of [
      `Registry.kt\`), ${totals.painted} ids`,
      `Of the ${totals.catalog} spec vocabulary ids, ${totals.agentEmittable} may be emitted`,
      `The other ${other} have an empty \`emit\` list`,
      `the ${totals.agentEmittable} emittable ids allow both, and the other ${other}`,
      `${unknown} are \`unknown\` and ${webOnly} are \`web-only\``,
    ])
      expect(adoption, phrase).toContain(phrase);
    expect(readme).toContain(`all ${totals.goldenTraces} spec goldens`);
  });
});

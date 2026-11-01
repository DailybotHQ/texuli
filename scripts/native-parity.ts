/**
 * The web ↔ native parity matrix (PLAN_012 T-native-parity-audit),
 * generated from the files that decide it, so it cannot drift:
 *
 * - `packages/spec/catalog/components.json`: every catalog id, its group,
 *   capability and emit tiers (the web renders every id);
 * - `NativeRegistry.implemented` in
 *   `native/texuli-compose/.../Registry.kt`: the ids Compose paints (every
 *   other id paints a visible placeholder);
 * - `native/conformance/semantics.json`: the ids with a shared semantic rule;
 * - `native/conformance/expected/*.trace.json`: the ids the golden traces
 *   cover on both targets;
 * - the capability rows below, each citing the files that prove it (the
 *   generator fails when a cited file is missing).
 *
 * Writes `native/docs/parity.json` and `native/docs/PARITY.md`.
 *
 * Usage:
 *   pnpm exec tsx scripts/native-parity.ts           # write both files
 *   pnpm exec tsx scripts/native-parity.ts --check   # exit 1 on drift
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { biomeFormat } from './generate-surfaces.ts';

const ROOT = resolve(import.meta.dirname, '..');
export const PATHS = {
  catalog: 'packages/spec/catalog/components.json',
  spec: 'packages/spec/manifest.json',
  registry: 'native/texuli-compose/src/commonMain/kotlin/com/texuli/compose/Registry.kt',
  semantics: 'native/conformance/semantics.json',
  traces: 'native/conformance/expected',
  json: 'native/docs/parity.json',
  markdown: 'native/docs/PARITY.md',
} as const;

export type CapabilityStatus = 'parity' | 'partial' | 'validation-only' | 'none';

export interface Capability {
  name: string;
  web: string;
  native: string;
  status: CapabilityStatus;
  /** Repository files that prove the row; each must exist. */
  evidence: readonly string[];
}

/**
 * What each side does per capability, beyond painting individual ids.
 * Verified against the code on 2026-11-01 (main 90f2721b, spec 0.10.0).
 */
export const CAPABILITIES: readonly Capability[] = [
  {
    name: 'Blueprint contract and validation',
    web: 'Validates and renders the spec through @texuli/spec and @texuli/player.',
    native:
      'Validates the same spec version from the generated Kotlin; invalid fixtures are refused identically.',
    status: 'parity',
    evidence: [
      'native/texuli-spec/src/commonMain/kotlin/com/texuli/spec/runtime/SpecValidator.kt',
      'native/conformance/src/jvmTest/kotlin/com/texuli/conformance/InvalidFixtureParityTest.kt',
    ],
  },
  {
    name: 'Semantic conformance (golden traces)',
    web: 'Writes one semantic trace per golden blueprint.',
    native: 'Produces the same trace for every golden; a semantic gate, not a pixel test.',
    status: 'parity',
    evidence: [
      'native/conformance/web/trace.ts',
      'native/conformance/src/jvmTest/kotlin/com/texuli/conformance/GoldenConformanceTest.kt',
    ],
  },
  {
    name: 'Label interpolation (i18n messages)',
    web: 'Interpolates component labels with @texuli/core/i18n.',
    native: 'Produces the same strings on the shared interpolation vectors.',
    status: 'parity',
    evidence: [
      'packages/core/tests/fixtures/i18n-vectors.json',
      'native/conformance/src/jvmTest/kotlin/com/texuli/conformance/MessagesParityTest.kt',
    ],
  },
  {
    name: 'Painting catalog components',
    web: 'Every catalog component.',
    native:
      'The ids in NativeRegistry; every other id paints a visible placeholder (see the table).',
    status: 'partial',
    evidence: [
      PATHS.registry,
      'native/texuli-compose/src/commonMain/kotlin/com/texuli/compose/BlueprintView.kt',
    ],
  },
  {
    name: 'Design systems and tokens',
    web: 'Validates, compiles and applies any design-system document (@texuli/tokens).',
    native:
      'Decodes documents and validates the envelope reference; ships token sets compiled on the web side (Default and Acme); no Kotlin compiler for a brand document yet.',
    status: 'partial',
    evidence: [
      'native/texuli-spec/src/commonMain/kotlin/com/texuli/spec/tokens/DesignTokens.kt',
      'native/conformance/src/jvmTest/kotlin/com/texuli/conformance/DesignSystemFixtureTest.kt',
      'native/conformance/src/jvmTest/kotlin/com/texuli/conformance/DesignTokensConformanceTest.kt',
    ],
  },
  {
    name: 'Decks',
    web: 'Deck model v2 with masters, transitions, notes and aspect (@texuli/deck, @texuli/slides).',
    native:
      'Paints the deck layout and slides as titled sections; masters, transitions, notes and aspect paint a placeholder.',
    status: 'partial',
    evidence: ['native/texuli-compose/src/commonMain/kotlin/com/texuli/compose/BlueprintView.kt'],
  },
  {
    name: 'Workflows',
    web: 'Workflow editor, viewer and model (@texuli/workflows).',
    native: 'Validates workflow graphs identically; the graph does not paint natively.',
    status: 'validation-only',
    evidence: [
      'native/texuli-spec/src/commonMain/kotlin/com/texuli/spec/runtime/WorkflowValidator.kt',
      'native/conformance/src/jvmTest/kotlin/com/texuli/conformance/WorkflowFixtureParityTest.kt',
    ],
  },
  {
    name: 'Documents, forms, canvas and sheets',
    web: 'Editors and readers (@texuli/pages, @texuli/forms, @texuli/canvas, @texuli/sheets).',
    native:
      'Validates their envelopes and caps; no painter, no form expressions, no sheet formulas.',
    status: 'validation-only',
    evidence: ['native/texuli-spec/src/commonMain/kotlin/com/texuli/spec/runtime/SpecValidator.kt'],
  },
  {
    name: 'Data sources and dashboards',
    web: 'Host data sources and the dashboard (@texuli/data).',
    native: 'Validates sources; data components paint a placeholder.',
    status: 'validation-only',
    evidence: ['native/texuli-spec/src/commonMain/kotlin/com/texuli/spec/runtime/Source.kt'],
  },
  {
    name: 'Agent tools (MCP)',
    web: 'The local and remote MCP servers (@texuli/mcp, texuli.com/mcp).',
    native: 'None: the tools run in Node and on the edge, not inside an app.',
    status: 'none',
    evidence: ['packages/mcp/package.json'],
  },
];

export interface CatalogEntry {
  id: string;
  group: string;
  capability?: string;
  emit: readonly string[];
}

export interface ParityRow {
  id: string;
  group: string;
  capability: string;
  agentEmittable: boolean;
  web: 'renders';
  native: 'painted' | 'placeholder';
  semanticRule: boolean;
  golden: boolean;
}

export interface ParityReport {
  specVersion: string;
  totals: {
    catalog: number;
    painted: number;
    placeholder: number;
    agentEmittable: number;
    agentEmittablePainted: number;
    semanticRules: number;
    goldenTraces: number;
    goldenCovered: number;
  };
  /** NativeRegistry ids the catalog does not know (should stay empty). */
  unknownNativeIds: string[];
  groups: { group: string; total: number; painted: number }[];
  capabilities: Capability[];
  components: ParityRow[];
}

/** The ids `NativeRegistry.implemented` lists, with the compact chart set when it is added in. */
export function parseNativeRegistry(source: string): string[] {
  // Comments first: one names "(ADR-016)", whose parenthesis would end a set early.
  const code = source.replace(/\/\/[^\n]*/g, '');
  const block = (name: string): string =>
    new RegExp(`val ${name}(?::[^=]+)?\\s*=\\s*setOf\\(([^)]*)\\)`).exec(code)?.[1] ?? '';
  const ids = (text: string): string[] =>
    [...text.matchAll(/"([a-z0-9-]+)"/g)].map((match) => match[1] ?? '');
  const own = ids(block('implemented'));
  const charts = /val implemented[^=]*=\s*setOf\([^)]*\)\s*\+\s*compactCharts/.test(code)
    ? ids(block('compactCharts'))
    : [];
  return [...new Set([...own, ...charts])].sort();
}

interface SemanticRules {
  components: readonly ({ id?: string; prefix?: string } & Record<string, unknown>)[];
}

/** Every catalog id a golden trace names, walking the trace tree. */
export function traceIds(trace: unknown, into = new Set<string>()): Set<string> {
  if (Array.isArray(trace)) for (const item of trace) traceIds(item, into);
  else if (trace && typeof trace === 'object') {
    const node = trace as Record<string, unknown>;
    if (typeof node.id === 'string') into.add(node.id);
    for (const value of Object.values(node)) if (typeof value === 'object') traceIds(value, into);
  }
  return into;
}

export interface ParityInputs {
  specVersion: string;
  catalog: readonly CatalogEntry[];
  registry: string;
  semantics: SemanticRules;
  traces: readonly unknown[];
  capabilities?: readonly Capability[];
}

/** Build the matrix from its inputs (pure; the CLI reads the files). */
export function buildParity(inputs: ParityInputs): ParityReport {
  const painted = new Set(parseNativeRegistry(inputs.registry));
  const known = new Set(inputs.catalog.map((entry) => entry.id));
  const golden = new Set<string>();
  for (const trace of inputs.traces) traceIds(trace, golden);
  const hasRule = (id: string): boolean =>
    inputs.semantics.components.some(
      (rule) => rule.id === id || (rule.prefix !== undefined && id.startsWith(rule.prefix))
    );
  const components: ParityRow[] = [...inputs.catalog]
    .sort((a, b) => a.id.localeCompare(b.id, 'en'))
    .map((entry) => ({
      id: entry.id,
      group: entry.group,
      capability: entry.capability ?? 'unknown',
      agentEmittable: entry.emit.includes('untrusted'),
      web: 'renders',
      native: painted.has(entry.id) ? 'painted' : 'placeholder',
      semanticRule: hasRule(entry.id),
      golden: golden.has(entry.id),
    }));
  const groupNames = [...new Set(components.map((row) => row.group))].sort((a, b) =>
    a.localeCompare(b, 'en')
  );
  const count = (rows: readonly ParityRow[], test: (row: ParityRow) => boolean): number =>
    rows.filter(test).length;
  return {
    specVersion: inputs.specVersion,
    totals: {
      catalog: components.length,
      painted: count(components, (row) => row.native === 'painted'),
      placeholder: count(components, (row) => row.native === 'placeholder'),
      agentEmittable: count(components, (row) => row.agentEmittable),
      agentEmittablePainted: count(
        components,
        (row) => row.agentEmittable && row.native === 'painted'
      ),
      semanticRules: count(components, (row) => row.semanticRule),
      goldenTraces: inputs.traces.length,
      goldenCovered: count(components, (row) => row.golden),
    },
    unknownNativeIds: [...painted].filter((id) => !known.has(id)).sort(),
    groups: groupNames.map((group) => {
      const rows = components.filter((row) => row.group === group);
      return { group, total: rows.length, painted: count(rows, (row) => row.native === 'painted') };
    }),
    capabilities: [...(inputs.capabilities ?? CAPABILITIES)],
    components,
  };
}

const STATUS_LABEL: Record<CapabilityStatus, string> = {
  parity: 'Parity',
  partial: 'Partial',
  'validation-only': 'Validation only',
  none: 'None',
};

const yes = (value: boolean): string => (value ? 'yes' : '—');

/** The Markdown page for a report (deterministic). */
export function renderParityMarkdown(report: ParityReport): string {
  const { totals } = report;
  const lines = [
    '# Web ↔ native parity',
    '',
    '<!-- Generated by scripts/native-parity.ts from the spec catalog, NativeRegistry,',
    '     native/conformance/semantics.json and the golden traces. Do not edit by hand. -->',
    '',
    `Spec ${report.specVersion}. The web (Svelte 5) renders every catalog component. The native`,
    'renderer (Kotlin Multiplatform, Compose) validates the same contract and paints a slice;',
    'every other component paints a visible placeholder. Native is in development.',
    '',
    '## Summary',
    '',
    '| Measure | Count |',
    '| --- | --- |',
    `| Catalog components | ${totals.catalog} |`,
    `| Painted natively | ${totals.painted} |`,
    `| Placeholder natively | ${totals.placeholder} |`,
    `| Agent-emittable components | ${totals.agentEmittable} |`,
    `| Agent-emittable and painted natively | ${totals.agentEmittablePainted} |`,
    `| Components with a shared semantic rule | ${totals.semanticRules} |`,
    `| Golden traces (web = native) | ${totals.goldenTraces} |`,
    `| Components covered by a golden trace | ${totals.goldenCovered} |`,
    '',
    'So the answer to "is web and native at 1:1 parity?" is: **for the contract, yes**',
    '(validation, label interpolation and the golden semantic traces match); **for painting, not yet**',
    `(${totals.painted} of ${totals.catalog} components).`,
    '',
    '## Capabilities',
    '',
    '| Capability | Web | Native | Status | Evidence |',
    '| --- | --- | --- | --- | --- |',
    ...report.capabilities.map(
      (row) =>
        `| ${row.name} | ${row.web} | ${row.native} | ${STATUS_LABEL[row.status]} | ${row.evidence
          .map((file) => `\`${file}\``)
          .join('<br>')} |`
    ),
    '',
    '## By group',
    '',
    '| Group | Components | Painted natively |',
    '| --- | --- | --- |',
    ...report.groups.map((row) => `| ${row.group} | ${row.total} | ${row.painted} |`),
    '',
    '## Every component',
    '',
    '| Id | Group | Agent-emittable | Web | Native | Semantic rule | Golden trace |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...report.components.map(
      (row) =>
        `| \`${row.id}\` | ${row.group} | ${yes(row.agentEmittable)} | ${row.web} | ${row.native} | ${yes(row.semanticRule)} | ${yes(row.golden)} |`
    ),
  ];
  if (report.unknownNativeIds.length > 0)
    lines.push(
      '',
      `NativeRegistry ids missing from the catalog: ${report.unknownNativeIds.join(', ')}.`
    );
  return `${lines.join('\n')}\n`;
}

/** The JSON twin, formatted as the repository's formatter writes it. */
export function renderParityJson(report: ParityReport, root = ROOT): string {
  return biomeFormat(PATHS.json, `${JSON.stringify(report, null, 2)}\n`, root);
}

/** Read the inputs from the repository and build the report. */
export function loadParity(root = ROOT): ParityReport {
  const read = (path: string): string => readFileSync(join(root, path), 'utf8');
  const traceDir = join(root, PATHS.traces);
  const traces = readdirSync(traceDir)
    .filter((file) => file.endsWith('.trace.json'))
    .sort()
    .map((file) => JSON.parse(readFileSync(join(traceDir, file), 'utf8')) as unknown);
  for (const capability of CAPABILITIES)
    for (const file of capability.evidence)
      if (!existsSync(join(root, file)))
        throw new Error(`capability "${capability.name}" cites a missing file: ${file}`);
  return buildParity({
    specVersion: (JSON.parse(read(PATHS.spec)) as { specVersion: string }).specVersion,
    catalog: (JSON.parse(read(PATHS.catalog)) as { components: CatalogEntry[] }).components,
    registry: read(PATHS.registry),
    semantics: JSON.parse(read(PATHS.semantics)) as SemanticRules,
    traces,
  });
}

function main(argv: readonly string[]): number {
  const report = loadParity();
  const json = renderParityJson(report);
  const markdown = renderParityMarkdown(report);
  if (report.unknownNativeIds.length > 0) {
    console.error(
      `NativeRegistry names ids the catalog does not know: ${report.unknownNativeIds.join(', ')}`
    );
    return 1;
  }
  if (argv.includes('--check')) {
    const current = (path: string): string => {
      const file = join(ROOT, path);
      return existsSync(file) ? readFileSync(file, 'utf8') : '';
    };
    if (current(PATHS.json) !== json || current(PATHS.markdown) !== markdown) {
      console.error('native parity is out of date: run pnpm exec tsx scripts/native-parity.ts');
      return 1;
    }
    console.log(
      `native parity is current: ${report.totals.painted} of ${report.totals.catalog} components paint natively`
    );
    return 0;
  }
  writeFileSync(join(ROOT, PATHS.json), json);
  writeFileSync(join(ROOT, PATHS.markdown), markdown);
  console.log(
    `wrote native parity: ${report.totals.painted} of ${report.totals.catalog} components paint natively`
  );
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  process.exitCode = main(process.argv.slice(2));
}

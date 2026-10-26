/**
 * Deterministic theme-sweep planning and evidence reporting.
 *
 * Browser captures are produced by the visual harness; this module selects
 * the fixed theme sample, checks captured signals, and formats a stable
 * example × theme matrix for the sweep consumer.
 */
import type { ColorModeName } from '../packages/tokens/src/contract/types.ts';
import { listFullThemeLibrary } from '../packages/tokens/src/library-expand/index.ts';

export const THEME_SAMPLE_CONFIG = Object.freeze([
  { id: 'accessible-high-contrast', hue: 'blue', tone: 'high-contrast', contrast: 'AAA' },
  { id: 'accessible-dark-contrast', hue: 'cyan', tone: 'dark-first', contrast: 'AAA' },
  { id: 'aqua-foam', hue: 'cyan', tone: 'pastel', contrast: 'AA' },
  { id: 'amber', hue: 'yellow-orange', tone: 'saturated', contrast: 'AA' },
  { id: 'clay-river', hue: 'orange', tone: 'muted', contrast: 'AA' },
  { id: 'devtools-night', hue: 'indigo', tone: 'dark-first', contrast: 'AA' },
  { id: 'emerald', hue: 'green', tone: 'saturated', contrast: 'AA' },
  { id: 'graphite', hue: 'neutral', tone: 'mono', contrast: 'AA' },
  { id: 'lavender-room', hue: 'violet', tone: 'pastel', contrast: 'AA' },
  { id: 'neon-magenta', hue: 'magenta', tone: 'saturated', contrast: 'AA' },
  { id: 'ocean', hue: 'blue', tone: 'saturated', contrast: 'AA' },
  { id: 'rose', hue: 'red', tone: 'saturated', contrast: 'AA' },
  { id: 'sepia-print', hue: 'warm-neutral', tone: 'muted', contrast: 'AA' },
  { id: 'sunset-pier', hue: 'orange', tone: 'bright', contrast: 'AA' },
] as const);

export const CONTRAST_FLOORS = Object.freeze({
  normalText: 4.5,
  largeText: 3,
  nonText: 3,
});

/** Load the actual workspace manifest, keeping sample policy in one place. */
export async function loadThemeSample(full = false): Promise<ThemeSample[]> {
  return selectThemeSample(await listFullThemeLibrary(), full);
}

export type ThemeSweepStatus = 'pass' | 'fail' | 'incomplete' | 'pending';

export interface ThemeMetadata {
  id: string;
  seed: string;
  collection: string;
  contrastLevel: string;
  darkFirst: boolean;
}

export interface ThemeSample {
  id: string;
  seed: string;
  collection: string;
  contrastLevel: string;
  darkFirst: boolean;
  sample: (typeof THEME_SAMPLE_CONFIG)[number] | null;
}

export interface ThemeSweepExample {
  id: string;
  title?: string;
}

export interface ThemeSweepEvidence {
  modesRendered: readonly string[];
  contrastRatios: {
    normalText: readonly number[];
    largeText: readonly number[];
    nonText: readonly number[];
  };
  forcedColorsRendered: boolean;
  unresolvedVariables: readonly string[];
  evidencePointers: readonly string[];
}

export interface ThemeSweepCell {
  exampleId: string;
  themeId: string;
  status: ThemeSweepStatus;
  issues: readonly string[];
  evidencePointers: readonly string[];
}

export interface ThemeSweepReport {
  schema: 'texuli-theme-sweep-v1';
  sampleThemeIds: readonly string[];
  exampleIds: readonly string[];
  cells: readonly ThemeSweepCell[];
}

const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ORDER = (left: string, right: string) => (left < right ? -1 : left > right ? 1 : 0);

/** Select the fixed gamut sample or every theme in stable ID order. */
export function selectThemeSample(metadata: readonly ThemeMetadata[], full = false): ThemeSample[] {
  const byId = new Map<string, ThemeMetadata>();
  for (const item of metadata) {
    if (!ID.test(item.id)) throw new TypeError(`Invalid theme id in metadata: ${item.id}`);
    if (byId.has(item.id)) throw new TypeError(`Duplicate theme metadata id: ${item.id}`);
    byId.set(item.id, item);
  }

  if (full) {
    return [...byId.values()]
      .sort((left, right) => ORDER(left.id, right.id))
      .map((item) => ({ ...item, sample: null }));
  }

  return THEME_SAMPLE_CONFIG.map((sample) => {
    const item = byId.get(sample.id);
    if (!item) throw new Error(`Theme sample is missing from the tokens manifest: ${sample.id}`);
    if (
      item.contrastLevel !== sample.contrast ||
      item.darkFirst !== (sample.tone === 'dark-first')
    ) {
      throw new Error(`Theme sample metadata changed unexpectedly: ${sample.id}`);
    }
    return { ...item, sample };
  });
}

/** Normalize examples by stable ID and reject malformed or repeated entries. */
export function selectExamples(examples: readonly ThemeSweepExample[]): ThemeSweepExample[] {
  const byId = new Map<string, ThemeSweepExample>();
  for (const example of examples) {
    if (!ID.test(example.id)) throw new TypeError(`Invalid example id: ${example.id}`);
    if (byId.has(example.id)) throw new TypeError(`Duplicate example id: ${example.id}`);
    const title =
      typeof example.title === 'string' && example.title.trim()
        ? example.title.trim().replace(/\s+/g, ' ').slice(0, 120)
        : example.id;
    byId.set(example.id, { id: example.id, title });
  }
  return [...byId.values()].sort((left, right) => ORDER(left.id, right.id));
}

export function evaluateThemeEvidence(
  evidence: ThemeSweepEvidence | undefined
): Pick<ThemeSweepCell, 'status' | 'issues' | 'evidencePointers'> {
  if (!evidence) return { status: 'pending', issues: [], evidencePointers: [] };
  const issues: string[] = [];
  const expectedModes: readonly ColorModeName[] = ['light', 'dark'];
  if (!expectedModes.every((mode) => evidence.modesRendered.includes(mode))) {
    issues.push('Both light and dark modes must be rendered.');
  }

  let incomplete = false;
  const checks = [
    { kind: 'normalText', floor: CONTRAST_FLOORS.normalText },
    { kind: 'largeText', floor: CONTRAST_FLOORS.largeText },
    { kind: 'nonText', floor: CONTRAST_FLOORS.nonText },
  ] as const;
  for (const { kind, floor } of checks) {
    const ratios = evidence.contrastRatios[kind];
    if (ratios.length === 0) {
      incomplete = true;
      issues.push(`No ${kind} contrast measurements were captured.`);
      continue;
    }
    ratios.forEach((ratio, index) => {
      if (!Number.isFinite(ratio) || ratio < floor) {
        issues.push(`${kind} contrast measurement ${index + 1} is below ${floor}:1.`);
      }
    });
  }
  if (!evidence.forcedColorsRendered) {
    issues.push('Forced-colors rendering did not pass.');
  }
  for (const variable of [...evidence.unresolvedVariables].sort(ORDER)) {
    issues.push(`Unresolved CSS variable: ${variable}.`);
  }

  const failed = issues.some(
    (issue) =>
      issue.includes('below') ||
      issue.startsWith('Forced-colors') ||
      issue.startsWith('Unresolved CSS')
  );
  return {
    status: failed ? 'fail' : incomplete || issues.length > 0 ? 'incomplete' : 'pass',
    issues,
    evidencePointers: [...new Set(evidence.evidencePointers)].sort(ORDER),
  };
}

/** Build a sorted example × theme matrix; absent browser evidence stays pending. */
export function buildThemeSweepReport(
  examples: readonly ThemeSweepExample[],
  metadata: readonly ThemeMetadata[],
  evidenceByCell: Readonly<Record<string, ThemeSweepEvidence>> = {},
  full = false
): ThemeSweepReport {
  const themes = selectThemeSample(metadata, full);
  const orderedExamples = selectExamples(examples);
  const cells = orderedExamples.flatMap((example) =>
    themes.map((theme) => {
      const result = evaluateThemeEvidence(evidenceByCell[`${example.id}:${theme.id}`]);
      return { exampleId: example.id, themeId: theme.id, ...result };
    })
  );
  return {
    schema: 'texuli-theme-sweep-v1',
    sampleThemeIds: themes.map((theme) => theme.id),
    exampleIds: orderedExamples.map((example) => example.id),
    cells,
  };
}

/** Render a stable Markdown table with compact per-cell evidence pointers. */
export function formatThemeSweepMarkdown(report: ThemeSweepReport): string {
  const headers = ['Example', ...report.sampleThemeIds];
  const lines = [
    '# Theme sweep matrix',
    '',
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
  ];

  for (const exampleId of report.exampleIds) {
    const cells = report.cells.filter((cell) => cell.exampleId === exampleId);
    const byTheme = new Map(cells.map((cell) => [cell.themeId, cell]));
    const values = report.sampleThemeIds.map((themeId) => {
      const cell = byTheme.get(themeId);
      if (!cell || cell.status === 'pending') return 'PENDING';
      return cell.status.toUpperCase();
    });
    lines.push(`| ${[exampleId, ...values].join(' | ')} |`);
  }
  lines.push('', 'Cell evidence and issues:', '');
  for (const cell of report.cells) {
    if (cell.status === 'pass' && cell.evidencePointers.length === 0) continue;
    const evidence = cell.evidencePointers.length
      ? ` Evidence: ${cell.evidencePointers.map((pointer) => `\u0060${pointer.replaceAll('\u0060', '\\u0060')}\u0060`).join(', ')}.`
      : '';
    const issues = cell.issues.length ? ` ${cell.issues.join(' ')}` : '';
    lines.push(`- ${cell.exampleId} × ${cell.themeId}: ${cell.status}.${issues}${evidence}`);
  }
  return `${lines.join('\n')}\n`;
}

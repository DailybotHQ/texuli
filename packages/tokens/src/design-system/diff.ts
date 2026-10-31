/**
 * `@texuli/tokens/design-system/diff` (T-ds-io): what changed between two
 * compiled design systems, for the CLI, the MCP and pull-request review:
 * variables per mode, contrast regressions, component defaults and
 * attributes. Pure and deterministic: lists are sorted (light before dark,
 * then by name), so the same pair always gives the same diff. Never throws:
 * a malformed side reads as empty.
 *
 * A lazy entry: the `@texuli/tokens` root never imports it.
 */

import type { CompiledDesignSystem } from './compiler.ts';
import {
  type DesignSystemContrast,
  type DesignSystemMode,
  type DesignSystemPairResult,
  evaluateDesignSystemContrast,
} from './guarantees.ts';

export interface DesignSystemTokenChange {
  mode: DesignSystemMode;
  variable: string;
  change: 'added' | 'removed' | 'changed';
  before?: string;
  after?: string;
}

/** A pair that held the baseline's target in `a` and falls below it in `b`. */
export interface DesignSystemContrastRegression {
  mode: DesignSystemMode;
  foreground: string;
  background: string;
  kind: DesignSystemPairResult['kind'];
  before: number;
  after: number;
  /** The baseline requirement (`a`'s contrast target for text, 3:1 otherwise). */
  required: number;
}

export interface DesignSystemDefaultChange {
  component: string;
  key: 'variant' | 'size';
  before?: string;
  after?: string;
}

export interface DesignSystemAttributeChange {
  attribute: string;
  before?: string;
  after?: string;
}

export interface DesignSystemDiff {
  /** No variable, default or attribute changed and no pair regressed. */
  identical: boolean;
  tokens: DesignSystemTokenChange[];
  contrast: DesignSystemContrastRegression[];
  defaults: DesignSystemDefaultChange[];
  attrs: DesignSystemAttributeChange[];
  summary: { added: number; removed: number; changed: number; regressions: number };
}

type Loose = Record<string, unknown>;
const record = (value: unknown): Loose =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Loose) : {};
const text = (value: unknown) => (typeof value === 'string' ? value : undefined);
const byText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const keysOf = (...records: Loose[]) =>
  [...new Set(records.flatMap((r) => Object.keys(r)))].sort(byText);

const MODES = ['light', 'dark'] as const;

/** Compare two compiled design systems (`a` is the baseline). */
export function diffDesignSystems(
  a: CompiledDesignSystem,
  b: CompiledDesignSystem
): DesignSystemDiff {
  const before = record(a);
  const after = record(b);
  const tokens: DesignSystemTokenChange[] = [];
  const contrast: DesignSystemContrastRegression[] = [];
  const target: DesignSystemContrast =
    record(before.accessibility).contrast === 'AAA' ? 'AAA' : 'AA';

  for (const mode of MODES) {
    const left = record(record(before.vars)[mode]);
    const right = record(record(after.vars)[mode]);
    for (const variable of keysOf(left, right)) {
      const x = text(left[variable]);
      const y = text(right[variable]);
      if (x === y) continue;
      if (x === undefined) tokens.push({ mode, variable, change: 'added', after: y as string });
      else if (y === undefined) tokens.push({ mode, variable, change: 'removed', before: x });
      else tokens.push({ mode, variable, change: 'changed', before: x, after: y });
    }
    if (Object.keys(left).length === 0 || Object.keys(right).length === 0) continue;
    const strings = (vars: Loose) =>
      Object.fromEntries(Object.entries(vars).filter(([, v]) => typeof v === 'string')) as Record<
        string,
        string
      >;
    const was = evaluateDesignSystemContrast(strings(left), target);
    const now = new Map(
      evaluateDesignSystemContrast(strings(right), target).map((pair) => [
        `${pair.foreground} ${pair.background}`,
        pair,
      ])
    );
    for (const pair of was) {
      const next = now.get(`${pair.foreground} ${pair.background}`);
      if (!pair.pass || !next || next.pass) continue;
      contrast.push({
        mode,
        foreground: pair.foreground,
        background: pair.background,
        kind: pair.kind,
        before: pair.ratio,
        after: next.ratio,
        required: pair.required,
      });
    }
  }
  contrast.sort(
    (x, y) =>
      MODES.indexOf(x.mode) - MODES.indexOf(y.mode) ||
      byText(x.foreground, y.foreground) ||
      byText(x.background, y.background)
  );

  const defaults: DesignSystemDefaultChange[] = [];
  const left = record(before.defaults);
  const right = record(after.defaults);
  for (const component of keysOf(left, right))
    for (const key of ['size', 'variant'] as const) {
      const x = text(record(left[component])[key]);
      const y = text(record(right[component])[key]);
      if (x !== y)
        defaults.push({
          component,
          key,
          ...(x === undefined ? {} : { before: x }),
          ...(y === undefined ? {} : { after: y }),
        });
    }

  const attrs: DesignSystemAttributeChange[] = [];
  const la = record(before.attrs);
  const ra = record(after.attrs);
  for (const attribute of keysOf(la, ra)) {
    const x = text(la[attribute]);
    const y = text(ra[attribute]);
    if (x !== y)
      attrs.push({
        attribute,
        ...(x === undefined ? {} : { before: x }),
        ...(y === undefined ? {} : { after: y }),
      });
  }

  const count = (change: DesignSystemTokenChange['change']) =>
    tokens.filter((t) => t.change === change).length;
  return {
    identical:
      tokens.length === 0 && contrast.length === 0 && defaults.length === 0 && attrs.length === 0,
    tokens,
    contrast,
    defaults,
    attrs,
    summary: {
      added: count('added'),
      removed: count('removed'),
      changed: count('changed'),
      regressions: contrast.length,
    },
  };
}

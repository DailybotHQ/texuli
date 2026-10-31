/**
 * The design-system guarantees of ADR-022 over a compiled variable map: text
 * pairs at the declared contrast target, non-text boundaries and the focus
 * ring at 3:1, a focus ring at least 2 px wide, and interactive control
 * sizes at `accessibility.targetMin`. The compiler runs these as its last
 * gate; `@texuli/tokens/design-system/validate` exposes them so a host can
 * re-check a cached compiled map without loading the compiler.
 */

import type { DesignSystemIssue } from '@texuli/spec/design-system';
import { semanticTokenToCssVar } from '../contract/prefix.ts';
import { THEME_CONTRAST_PAIRS } from '../generator/contrast.ts';
import { contrastRatio } from '../palette/contrast.ts';
import type { DesignSystemMode } from './attributes.ts';
import { composite, parseDsColor } from './color.ts';

export {
  DESIGN_SYSTEM_ATTRIBUTES,
  type DesignSystemAttribute,
  type DesignSystemMode,
} from './attributes.ts';

export type DesignSystemContrast = 'AA' | 'AAA';

/** One checked pair: `kind` `text` needs the target, `ui` and `focus` need 3:1. */
export interface DesignSystemPair {
  foreground: string;
  background: string;
  kind: 'text' | 'ui' | 'focus';
  /** Also check the background's `-hover` and `-active` variables. */
  states: boolean;
}

/** Every contrast pair, as `--tx-*` names: the generator's guaranteed pairs plus the status set. */
export const DESIGN_SYSTEM_PAIRS: readonly DesignSystemPair[] = [
  ...THEME_CONTRAST_PAIRS.map(
    (pair): DesignSystemPair => ({
      foreground: semanticTokenToCssVar(pair.foreground),
      background: semanticTokenToCssVar(pair.background),
      kind: pair.foreground === 'ring' ? 'focus' : pair.kind,
      states: pair.states === true,
    })
  ),
  ...['success', 'warning', 'danger', 'info', 'neutral'].flatMap((status): DesignSystemPair[] => [
    {
      foreground: `--tx-status-${status}-foreground`,
      background: `--tx-status-${status}`,
      kind: 'text',
      states: false,
    },
    {
      foreground: `--tx-status-${status}-soft-foreground`,
      background: `--tx-status-${status}-soft`,
      kind: 'text',
      states: false,
    },
  ]),
];

/**
 * Interactive sizes held to `targetMin`: the system control heights and the
 * component tokens that size a pointer target (`component.key`).
 */
export const DESIGN_SYSTEM_TARGETS: readonly string[] = [
  ...['xs', 'sm', 'md', 'lg'].map((size) => `--tx-size-control-${size}`),
  ...[
    'button height-sm height-md height-lg height-touch',
    'combobox height-sm height-md height-lg',
    'input height height-touch',
    'menu trigger-height-sm trigger-height-md trigger-height-lg',
    'select height-sm height-md height-lg',
    'toggle height-sm height-md height-lg',
    'toolbar item-height-sm',
    'tags-input height height-touch',
    'tabs trigger-height-touch',
    'file-upload browse-height',
    'number-field stepper-size',
    'pin-input cell-block-size',
  ].flatMap((row) => {
    const [component, ...keys] = row.split(' ');
    return keys.map((key) => `--tx-${component}-${key}`);
  }),
];

/** The smallest focus ring width (px) ADR-022 accepts. */
export const MIN_FOCUS_WIDTH = 2;

/** CSS px of a compiled length (`px`, `rem`/`em` at 16 px, `max(…)`), or `undefined`. */
export function lengthPx(value: string | undefined): number | undefined {
  if (value === undefined) return;
  const v = value.trim();
  const max = /^max\((.*)\)$/.exec(v);
  if (max) {
    const parts = (max[1] as string).split(',').map((part) => lengthPx(part));
    return parts.some((part) => part === undefined) ? undefined : Math.max(...(parts as number[]));
  }
  const m = /^(-?\d*\.?\d+)(px|rem|em)?$/.exec(v);
  if (!m) return;
  const n = Number(m[1]);
  return m[2] === 'rem' || m[2] === 'em' ? n * 16 : n;
}

/** The result of one contrast check. */
export interface DesignSystemPairResult {
  foreground: string;
  background: string;
  kind: 'text' | 'ui' | 'focus';
  /** Rounded down to two decimals, so a reported pass never rounds up. */
  ratio: number;
  required: number;
  pass: boolean;
}

/** The text minimum of a contrast target. */
export const textMinimum = (contrast: DesignSystemContrast): number =>
  contrast === 'AAA' ? 7 : 4.5;

/**
 * Every pair of {@link DESIGN_SYSTEM_PAIRS} present in `colors` (a `--tx-*`
 * name to an authored color). Translucent colors are composited over the
 * pair's background, and the background over `--tx-background`.
 */
export function evaluateDesignSystemContrast(
  colors: Readonly<Record<string, string>>,
  contrast: DesignSystemContrast
): DesignSystemPairResult[] {
  const page = parseDsColor(colors['--tx-background'] ?? '')?.hex ?? '#ffffff';
  const solid = (name: string, under: string): string | undefined => {
    const parsed = parseDsColor(colors[name] ?? '');
    return parsed ? composite(parsed, under) : undefined;
  };
  const results: DesignSystemPairResult[] = [];
  for (const pair of DESIGN_SYSTEM_PAIRS) {
    const backgrounds = pair.states
      ? [pair.background, `${pair.background}-hover`, `${pair.background}-active`]
      : [pair.background];
    for (const background of backgrounds) {
      const bg = solid(background, page);
      const fg = bg && solid(pair.foreground, bg);
      if (!bg || !fg) continue;
      const ratio = contrastRatio(fg, bg);
      const required = pair.kind === 'text' ? textMinimum(contrast) : 3;
      results.push({
        foreground: pair.foreground,
        background,
        kind: pair.kind,
        ratio: Math.floor(ratio * 100) / 100,
        required,
        pass: ratio >= required,
      });
    }
  }
  return results;
}

/** The accessibility targets a compiled design system was held to. */
export interface DesignSystemTargets {
  contrast: DesignSystemContrast;
  targetMin: number;
}

/** The part of a compiled design system the guarantee check reads. */
export interface DesignSystemGuaranteeInput {
  vars: Partial<Record<DesignSystemMode, Readonly<Record<string, string>>>>;
  accessibility: DesignSystemTargets;
}

const at = (mode: string, name: string) => `$.vars.${mode}[${JSON.stringify(name)}]`;

/**
 * Re-check the ADR-022 guarantees over compiled variables, per mode: every
 * issue carries `aa-text`, `aa-focus` or `target-size` and the variable's
 * path. An empty list means the map holds every guarantee.
 */
export function checkDesignSystemGuarantees(
  input: DesignSystemGuaranteeInput
): DesignSystemIssue[] {
  const issues: DesignSystemIssue[] = [];
  const { contrast, targetMin } = input.accessibility;
  for (const mode of ['light', 'dark'] as const) {
    const vars = input.vars[mode];
    if (!vars) continue;
    for (const pair of evaluateDesignSystemContrast(vars, contrast)) {
      if (pair.pass) continue;
      issues.push({
        code: pair.kind === 'focus' ? 'aa-focus' : 'aa-text',
        path: at(mode, pair.foreground),
        message: `${pair.foreground} on ${pair.background} is ${pair.ratio}:1 in ${mode}; ${pair.required}:1 is required.`,
      });
    }
    const width = lengthPx(vars['--tx-focus-ring-width']);
    if (width !== undefined && width < MIN_FOCUS_WIDTH)
      issues.push({
        code: 'aa-focus',
        path: at(mode, '--tx-focus-ring-width'),
        message: `The focus ring is ${width}px wide; at least ${MIN_FOCUS_WIDTH}px is required.`,
      });
    for (const name of DESIGN_SYSTEM_TARGETS) {
      const px = lengthPx(vars[name]);
      if (px !== undefined && px < targetMin)
        issues.push({
          code: 'target-size',
          path: at(mode, name),
          message: `${name} is ${px}px; targets need at least ${targetMin}px.`,
        });
    }
  }
  return issues;
}

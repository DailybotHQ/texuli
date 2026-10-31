/**
 * Design values for the DOCX and PDF writers (ADR-024, option B). A plain,
 * structurally typed input: colors as sRGB `#rrggbb` per role and CSS font
 * stacks, which callers build from a compiled design system (for example
 * `designValues(compiled, mode)` from `@texuli/tools/print`). The document
 * engine never imports `@texuli/tokens` or the compiler. Every value is
 * checked again here: a color outside `#rrggbb` or a family name outside a
 * plain grammar is ignored, so hand-built input cannot reach the output.
 */
import type { CalloutTone } from '../model/types.ts';

/** The color roles the document writers read. */
export type DocumentDesignRole =
  | 'background'
  | 'foreground'
  | 'muted'
  | 'mutedForeground'
  | 'border'
  | 'borderStrong'
  | 'link'
  | 'primary'
  | 'primarySoft'
  | 'info'
  | 'infoSoft'
  | 'success'
  | 'successSoft'
  | 'warning'
  | 'warningSoft'
  | 'destructive'
  | 'destructiveSoft';

/** What the DOCX and PDF writers take from a design system. */
export interface DocumentDesign {
  /** sRGB `#rrggbb` per role; missing roles keep the writer's default. */
  colors?: Readonly<Partial<Record<DocumentDesignRole, string>>>;
  /** CSS font stacks: body (`sans`), headings and code. */
  fonts?: Readonly<{ sans?: string; heading?: string; mono?: string }>;
}

/** A role's color as `RRGGBB` (upper case), or `null` when absent or not `#rrggbb`. */
export function designHex(
  design: DocumentDesign | null | undefined,
  role: DocumentDesignRole
): string | null {
  const value = design?.colors?.[role];
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value)
    ? value.slice(1).toUpperCase()
    : null;
}

/** The fill and bar roles of each callout tone. */
export const DESIGN_TONES: Readonly<
  Record<CalloutTone, { fill: DocumentDesignRole; bar: DocumentDesignRole }>
> = Object.freeze({
  neutral: { fill: 'muted', bar: 'borderStrong' },
  accent: { fill: 'primarySoft', bar: 'primary' },
  info: { fill: 'infoSoft', bar: 'info' },
  success: { fill: 'successSoft', bar: 'success' },
  warning: { fill: 'warningSoft', bar: 'warning' },
  danger: { fill: 'destructiveSoft', bar: 'destructive' },
});

const GENERIC = new Set([
  'serif',
  'sans-serif',
  'monospace',
  'cursive',
  'fantasy',
  'system-ui',
  'ui-serif',
  'ui-sans-serif',
  'ui-monospace',
  'ui-rounded',
  'math',
  'emoji',
  'fangsong',
  '-apple-system',
  'blinkmacsystemfont',
]);

function names(stack: unknown): string[] {
  if (typeof stack !== 'string' || stack.length > 400) return [];
  return stack
    .split(',')
    .slice(0, 8)
    .map((part) =>
      part
        .trim()
        .replace(/^["']|["']$/g, '')
        .trim()
    )
    .filter((name) => /^[\p{L}\p{N} ._-]{1,64}$/u.test(name));
}

/** The first concrete family of a CSS stack (no generics), or `undefined`. */
export function firstFamily(stack: unknown): string | undefined {
  return names(stack).find((name) => !GENERIC.has(name.toLowerCase()));
}

const SERIF =
  /^(?:georgia|times|times new roman|garamond|cambria|palatino|palatino linotype|book antiqua|baskerville|charter|merriweather|lora|playfair display|source serif.*|noto serif.*|pt serif|libre baskerville|crimson.*|eb garamond|iowan old style)$/i;

/** Whether a stack reads as serif: its first known serif family or generic comes before any sans one. */
export function isSerifStack(stack: unknown): boolean {
  for (const name of names(stack)) {
    const lower = name.toLowerCase();
    if (lower === 'serif' || lower === 'ui-serif' || SERIF.test(name)) return true;
    if (GENERIC.has(lower)) return false;
  }
  return false;
}

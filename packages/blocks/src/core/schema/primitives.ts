import { hasUnsafeText } from '../safety.ts';
import {
  BLOCK_ICON_NAME,
  type BlockReveal,
  type BlockTone,
  isBlockReveal,
  isBlockTone,
} from './vocabulary.ts';

/**
 * Content limits per block. They follow layout limits so a block always fits a
 * slide, a page section or a doc. Owned validators — no third-party schema lib.
 */
export const BLOCK_CONTENT_LIMITS = Object.freeze({
  markdown: 4_000,
  shortMarkdown: 600,
  listItems: 12,
  statItems: 6,
  tableColumns: 8,
  tableRows: 50,
  timelineEvents: 12,
  steps: 8,
  comparisonColumns: 4,
  comparisonRows: 8,
  cards: 12,
  people: 24,
  ctaActions: 3,
  columns: 4,
  blocksPerColumn: 12,
  containerDepth: 3,
  tabPanels: 6,
  pollOptions: 8,
  formFields: 20,
  formTextLength: 4_000,
  code: 20_000,
  codeLines: 400,
  /** Highlight steps per code block, characters per line spec, caption length. */
  codeHighlightSteps: 16,
  codeHighlightSpec: 120,
  codeCaption: 200,
  mediaDimension: 4_096,
  galleryItems: 12,
  href: 2_048,
  heading: 200,
  plain: 500,
  /** Points in a stat item's trend sparkline. */
  trendPoints: 60,
  /** Characters in an icon name. */
  iconName: 48,
});

/** Blueprint-style JSONPath, e.g. `$[0]["text"]`. */
export function toJsonPath(path: readonly (string | number)[]): string {
  let result = '$';
  for (const segment of path) {
    result += typeof segment === 'number' ? `[${segment}]` : `[${JSON.stringify(segment)}]`;
  }
  return result;
}

export interface FieldIssue {
  path: (string | number)[];
  message: string;
}

export type ParseOk<T> = { success: true; data: T; issues: [] };
export type ParseFail = { success: false; data: null; issues: FieldIssue[] };
export type ParseResult<T> = ParseOk<T> | ParseFail;

export function ok<T>(data: T): ParseOk<T> {
  return { success: true, data, issues: [] };
}

export function fail(path: (string | number)[], message: string): ParseFail {
  return { success: false, data: null, issues: [{ path, message }] };
}

export function failMany(issues: FieldIssue[]): ParseFail {
  return { success: false, data: null, issues };
}

/** A stable block id: deep links and interactive state keys use it. */
const BLOCK_ID = /^[a-z][a-z0-9-]{0,47}$/;

export function parseBlockId(
  value: unknown,
  path: (string | number)[]
): ParseResult<string | undefined> {
  if (value === undefined) return ok(undefined);
  if (typeof value !== 'string' || !BLOCK_ID.test(value)) {
    return fail(path, 'Use 1–48 lowercase letters, digits or hyphens, starting with a letter');
  }
  return ok(value);
}

export function parseStep(
  value: unknown,
  path: (string | number)[]
): ParseResult<number | undefined> {
  if (value === undefined) return ok(undefined);
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 32) {
    return fail(path, 'step must be an integer from 0 to 32');
  }
  return ok(value);
}

export function parseTone(
  value: unknown,
  path: (string | number)[]
): ParseResult<BlockTone | undefined> {
  if (value === undefined) return ok(undefined);
  if (!isBlockTone(value)) return fail(path, 'tone must be a block tone token');
  return ok(value);
}

export function parseReveal(
  value: unknown,
  path: (string | number)[]
): ParseResult<BlockReveal | undefined> {
  if (value === undefined) return ok(undefined);
  if (!isBlockReveal(value)) return fail(path, 'reveal must be a known animation token');
  return ok(value);
}

/** One line of plain text: no line breaks, control or bidi override characters. */
export function parsePlainText(
  value: unknown,
  path: (string | number)[],
  max: number
): ParseResult<string> {
  if (typeof value !== 'string') return fail(path, 'Expected a string');
  if (value.length === 0) return fail(path, 'Text must not be empty');
  if ([...value].length > max) return fail(path, `Text must be at most ${max} characters`);
  if (hasUnsafeText(value, false, false)) {
    return fail(path, 'Text contains control or bidi override characters');
  }
  if (/[\r\n]/.test(value)) return fail(path, 'Plain text must be a single line');
  return ok(value);
}

/** Multiline markdown-ish body: newlines allowed; tabs only when allowTabs. */
export function parseMultilineText(
  value: unknown,
  path: (string | number)[],
  max: number,
  allowTabs = false
): ParseResult<string> {
  if (typeof value !== 'string') return fail(path, 'Expected a string');
  if (value.length === 0) return fail(path, 'Text must not be empty');
  if ([...value].length > max) return fail(path, `Text must be at most ${max} characters`);
  if (hasUnsafeText(value, true, allowTabs)) {
    return fail(path, 'Text contains control or bidi override characters');
  }
  return ok(value);
}

export interface BlockBase {
  id?: string;
  step?: number;
  reveal?: BlockReveal;
  tone?: BlockTone;
}

export function parseBlockBase(
  record: Record<string, unknown>,
  path: (string | number)[]
): ParseResult<BlockBase> {
  const id = parseBlockId(record.id, [...path, 'id']);
  if (!id.success) return id;
  const step = parseStep(record.step, [...path, 'step']);
  if (!step.success) return step;
  const reveal = parseReveal(record.reveal, [...path, 'reveal']);
  if (!reveal.success) return reveal;
  const tone = parseTone(record.tone, [...path, 'tone']);
  if (!tone.success) return tone;
  const base: BlockBase = {};
  if (id.data !== undefined) base.id = id.data;
  if (step.data !== undefined) base.step = step.data;
  if (reveal.data !== undefined) base.reveal = reveal.data;
  if (tone.data !== undefined) base.tone = tone.data;
  return ok(base);
}

/** An optional field of {@link parsePlainText}: `undefined` stays `undefined`. */
export function parseOptionalPlainText(
  value: unknown,
  path: (string | number)[],
  max: number
): ParseResult<string | undefined> {
  if (value === undefined) return ok(undefined);
  return parsePlainText(value, path, max);
}

/** An optional value from a closed list of words. */
export function parseOptionalEnum<T extends string>(
  value: unknown,
  path: (string | number)[],
  allowed: readonly T[],
  field: string
): ParseResult<T | undefined> {
  if (value === undefined) return ok(undefined);
  if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) {
    return fail(path, `${field} must be one of ${allowed.map((word) => `"${word}"`).join(', ')}`);
  }
  return ok(value as T);
}

/** An optional icon name: lowercase kebab-case, at most `iconName` characters. */
export function parseOptionalIconName(
  value: unknown,
  path: (string | number)[]
): ParseResult<string | undefined> {
  if (value === undefined) return ok(undefined);
  if (
    typeof value !== 'string' ||
    value.length > BLOCK_CONTENT_LIMITS.iconName ||
    !BLOCK_ICON_NAME.test(value)
  ) {
    return fail(path, 'icon must be a kebab-case icon name, as "circle-check"');
  }
  return ok(value);
}

import type { CodeBlock } from './blocks.ts';
import { parseLineSpec } from './line-spec.ts';
import {
  BLOCK_CONTENT_LIMITS,
  type BlockBase,
  fail,
  ok,
  type ParseResult,
  parseMultilineText,
  parsePlainText,
} from './primitives.ts';

function parseCode(
  record: Record<string, unknown>,
  path: (string | number)[],
  base: BlockBase
): ParseResult<CodeBlock> {
  const code = parseMultilineText(record.code, [...path, 'code'], BLOCK_CONTENT_LIMITS.code, true);
  if (!code.success) return code;
  const lines = code.data.split('\n').length;
  if (lines > BLOCK_CONTENT_LIMITS.codeLines) {
    return fail([...path, 'code'], `code may have at most ${BLOCK_CONTENT_LIMITS.codeLines} lines`);
  }
  let lang: string | undefined;
  if (record.lang !== undefined) {
    if (typeof record.lang !== 'string' || !/^[a-z][a-z0-9+-]{0,31}$/.test(record.lang)) {
      return fail([...path, 'lang'], 'lang must be a short lowercase token');
    }
    lang = record.lang;
  }
  let filename: string | undefined;
  if (record.filename !== undefined) {
    const parsed = parsePlainText(
      record.filename,
      [...path, 'filename'],
      BLOCK_CONTENT_LIMITS.plain
    );
    if (!parsed.success) return parsed;
    filename = parsed.data;
  }
  let caption: string | undefined;
  if (record.caption !== undefined) {
    const parsed = parsePlainText(
      record.caption,
      [...path, 'caption'],
      BLOCK_CONTENT_LIMITS.codeCaption
    );
    if (!parsed.success) return parsed;
    caption = parsed.data;
  }
  if (record.lineNumbers !== undefined && typeof record.lineNumbers !== 'boolean') {
    return fail([...path, 'lineNumbers'], 'lineNumbers must be a boolean');
  }
  const highlights = parseCodeHighlights(record.highlights, [...path, 'highlights'], lines);
  if (!highlights.success) return highlights;
  return ok({
    ...base,
    type: 'code',
    code: code.data,
    ...(lang !== undefined ? { lang } : {}),
    ...(filename !== undefined ? { filename } : {}),
    ...(caption !== undefined ? { caption } : {}),
    ...(record.lineNumbers !== undefined ? { lineNumbers: record.lineNumbers } : {}),
    ...(highlights.data !== undefined ? { highlights: highlights.data } : {}),
  });
}

/** 1 to 16 line specs (`"1-2,4"`), each within the code's lines. */
function parseCodeHighlights(
  value: unknown,
  path: (string | number)[],
  lines: number
): ParseResult<string[] | undefined> {
  if (value === undefined) return ok(undefined);
  const max = BLOCK_CONTENT_LIMITS.codeHighlightSteps;
  if (!Array.isArray(value) || value.length === 0 || value.length > max) {
    return fail(path, `highlights must list 1 to ${max} line specs`);
  }
  for (const [index, spec] of value.entries()) {
    const ranges =
      typeof spec === 'string' && spec.length <= BLOCK_CONTENT_LIMITS.codeHighlightSpec
        ? parseLineSpec(spec)
        : null;
    if (!ranges || ranges.some(([, end]) => end > lines)) {
      return fail([...path, index], `Use line specs like "1-2,4" within the ${lines} lines`);
    }
  }
  return ok([...value] as string[]);
}

/** Code family: code blocks. */
export function parseCodeFamilyBlock(
  type: string,
  record: Record<string, unknown>,
  path: (string | number)[],
  base: BlockBase
): ParseResult<CodeBlock> | null {
  switch (type) {
    case 'code':
      return parseCode(record, path, base);
    default:
      return null;
  }
}

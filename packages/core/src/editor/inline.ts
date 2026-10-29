import {
  EDITOR_MARK_ORDER,
  type EditorInline,
  type EditorMark,
  type EditorMarkType,
} from './types.ts';

type Text = Extract<EditorInline, { type: 'text' }>;

// C0/C1 controls, bidi marks, embeddings, overrides and isolates, BOM, zero-width
// space, word joiner and line/paragraph separators: the characters the block
// schemas refuse. ZWJ/ZWNJ stay (emoji, some scripts).
const UNSAFE: readonly (readonly [number, number])[] = [
  [0x00, 0x1f],
  [0x7f, 0x9f],
  [0x061c, 0x061c],
  [0x200b, 0x200b],
  [0x200e, 0x200f],
  [0x2028, 0x2029],
  [0x202a, 0x202e],
  [0x2060, 0x2060],
  [0x2066, 0x2069],
  [0xfeff, 0xfeff],
];

function unsafe(code: number, keep: string): boolean {
  if (keep.includes(String.fromCharCode(code))) return false;
  return UNSAFE.some(([low, high]) => code >= low && code <= high);
}

/**
 * Remove the characters the model never stores. `keep` lists control
 * characters that stay (`'\n\t'` for code). Line and paragraph separators and
 * `\r\n` become `\n` first.
 */
export function cleanText(text: string, keep = ''): { text: string; stripped: boolean } {
  const source = text.replace(/\r\n?|[\u2028\u2029]/g, '\n');
  let out = '';
  let stripped = false;
  for (const char of source) {
    if (unsafe(char.codePointAt(0) ?? 0, keep)) stripped = true;
    else out += char;
  }
  return { text: out, stripped };
}

/** The identity of a mark: its type, plus the href for links and the entity for extensions. */
export const markKey = (mark: EditorMark): string =>
  mark.type === 'link'
    ? `link:${mark.href}`
    : mark.type === 'extension'
      ? `extension:${mark.name}:${mark.id}`
      : mark.type;

export const hasMark = (marks: readonly EditorMark[], type: EditorMarkType): boolean =>
  marks.some((mark) => mark.type === type);

/**
 * Canonical mark set: one mark per type (the first wins), sorted in
 * `EDITOR_MARK_ORDER`; `extension` excludes `link` and `code`, and `code`
 * excludes every other mark but `link`.
 */
export function sortMarks(marks: readonly EditorMark[]): readonly EditorMark[] {
  const byType = new Map<EditorMarkType, EditorMark>();
  for (const mark of marks) if (!byType.has(mark.type)) byType.set(mark.type, mark);
  const extension = byType.has('extension');
  const code = !extension && byType.has('code');
  const keep = (type: EditorMarkType) =>
    extension ? type !== 'link' && type !== 'code' : !code || type === 'link' || type === 'code';
  const out = EDITOR_MARK_ORDER.flatMap((type) => {
    const mark = byType.get(type);
    return mark && keep(type) ? [mark] : [];
  });
  return out.length === marks.length && out.every((mark, i) => mark === marks[i]) ? marks : out;
}

export const sameMarks = (a: readonly EditorMark[], b: readonly EditorMark[]): boolean =>
  a.length === b.length && a.every((mark, i) => markKey(mark) === markKey(b[i] as EditorMark));

export const withMark = (marks: readonly EditorMark[], mark: EditorMark) =>
  sortMarks([mark, ...marks.filter((m) => m.type !== mark.type)]);

export const withoutMark = (marks: readonly EditorMark[], type: EditorMarkType) =>
  marks.filter((mark) => mark.type !== type);

const length = (node: EditorInline) => (node.type === 'text' ? node.text.length : 1);

/** Length in UTF-16 code units; a break counts 1. */
export const inlineLength = (content: readonly EditorInline[]): number =>
  content.reduce((sum, node) => sum + length(node), 0);

/** The text of inline content; a break is `\n`. */
export const inlineText = (content: readonly EditorInline[]): string =>
  content.map((node) => (node.type === 'text' ? node.text : '\n')).join('');

/**
 * Canonical inline content: marks sorted, empty runs dropped, neighbors with
 * equal marks merged. Returns `content` itself when it is already canonical.
 */
export function normalizeInline(content: readonly EditorInline[]): readonly EditorInline[] {
  const out: EditorInline[] = [];
  let changed = false;
  for (const node of content) {
    if (node.type === 'break') {
      out.push(node);
      continue;
    }
    if (node.text === '') {
      changed = true;
      continue;
    }
    const marks = sortMarks(node.marks);
    const previous = out.at(-1);
    if (previous?.type === 'text' && sameMarks(previous.marks, marks)) {
      out[out.length - 1] = {
        type: 'text',
        text: previous.text + node.text,
        marks: previous.marks,
      };
      changed = true;
      continue;
    }
    if (marks !== node.marks) changed = true;
    out.push(marks === node.marks ? node : { type: 'text', text: node.text, marks });
  }
  return changed ? out : content;
}

/** Inline content between two offsets. */
export function sliceInline(
  content: readonly EditorInline[],
  from: number,
  to = Number.POSITIVE_INFINITY
): EditorInline[] {
  const out: EditorInline[] = [];
  let at = 0;
  for (const node of content) {
    const end = at + length(node);
    if (end > from && at < to) {
      out.push(
        node.type === 'text'
          ? {
              ...node,
              text: node.text.slice(Math.max(0, from - at), Math.min(node.text.length, to - at)),
            }
          : node
      );
    }
    at = end;
  }
  return out;
}

export const concatInline = (...parts: (readonly EditorInline[])[]) =>
  normalizeInline(parts.flat());

/** Replace `[from, to)` with `insert`. */
export const spliceInline = (
  content: readonly EditorInline[],
  from: number,
  to: number,
  insert: readonly EditorInline[] = []
) => concatInline(sliceInline(content, 0, from), insert, sliceInline(content, to));

/** The run covering the character at `offset`, if it is text. */
function textAt(content: readonly EditorInline[], offset: number): Text | undefined {
  let at = 0;
  for (const node of content) {
    const end = at + length(node);
    if (offset >= at && offset < end) return node.type === 'text' ? node : undefined;
    at = end;
  }
  return undefined;
}

/**
 * The marks text typed at `offset` gets: those of the character before (the
 * first character at offset 0). A link or an extension entity continues only
 * strictly inside it.
 */
export function inheritedMarks(
  content: readonly EditorInline[],
  offset: number
): readonly EditorMark[] {
  const before = offset > 0 ? textAt(content, offset - 1) : undefined;
  const after = textAt(content, offset);
  let marks = (offset > 0 ? before : after)?.marks ?? [];
  for (const type of ['link', 'extension'] as const) {
    const edge = marks.find((mark) => mark.type === type);
    const inside =
      edge !== undefined &&
      before !== undefined &&
      after?.marks.some((mark) => markKey(mark) === markKey(edge)) === true;
    if (edge && !inside) marks = withoutMark(marks, type);
  }
  return marks;
}

/** Apply `update` to the marks of every text character in `[from, to)`. */
export function mapMarks(
  content: readonly EditorInline[],
  from: number,
  to: number,
  update: (marks: readonly EditorMark[]) => readonly EditorMark[]
): readonly EditorInline[] {
  const middle = sliceInline(content, from, to).map((node) =>
    node.type === 'text' ? { ...node, marks: sortMarks(update(node.marks)) } : node
  );
  return concatInline(sliceInline(content, 0, from), middle, sliceInline(content, to));
}

/** Every text run in `[from, to)` (sliced). */
export const textRuns = (content: readonly EditorInline[], from: number, to: number): Text[] =>
  sliceInline(content, from, to).filter((node): node is Text => node.type === 'text');

/**
 * Inline content for plain text: `\n` becomes a break, unsafe characters are
 * stripped (`stripped` reports it), and every run gets `marks`.
 */
export function textToInline(
  text: string,
  marks: readonly EditorMark[] = []
): { content: readonly EditorInline[]; stripped: boolean } {
  const clean = cleanText(text, '\n');
  const content: EditorInline[] = [];
  clean.text.split('\n').forEach((part, i) => {
    if (i > 0) content.push({ type: 'break' });
    if (part) content.push({ type: 'text', text: part, marks: sortMarks(marks) });
  });
  return { content: normalizeInline(content), stripped: clean.stripped };
}

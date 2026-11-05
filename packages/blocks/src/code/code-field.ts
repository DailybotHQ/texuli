import type { HTMLTextareaAttributes } from 'svelte/elements';

/**
 * The editable code field's framework-free half (D-G-022): its limits,
 * labels, prop types and the text edits behind Tab, Shift+Tab and Enter.
 * Every edit is data (`{ start, end, text }` plus the next selection), so the
 * component applies it through the browser's own editing (undo keeps working)
 * and the tests check it without a DOM.
 */

/**
 * Past this many characters the field stops highlighting and shows a plain
 * textarea (the tokenizer's own cap): typing stays fast on any input.
 */
export const CODE_FIELD_HIGHLIGHT_LIMIT = 20_000;

/**
 * Up to this many characters the overlay re-tokenizes on every input. Past it
 * the work moves to the next animation frame, which still runs before the
 * frame is painted, so several inputs in one frame tokenize once.
 */
export const CODE_FIELD_SYNC_LIMIT = 4_000;

/** Every string the field renders that does not come from the host. */
export interface CodeFieldLabels {
  /** Describes the keyboard contract (announced with the field). */
  keyboardHint: string;
}

export const DEFAULT_CODE_FIELD_LABELS: Readonly<CodeFieldLabels> = /* @__PURE__ */ Object.freeze({
  keyboardHint: 'Tab inserts indentation. To leave the field, press Escape, then Tab.',
});

/** Merges host overrides over the defaults; non-string overrides are ignored. */
export function resolveCodeFieldLabels(
  overrides: Partial<CodeFieldLabels> = {},
  defaults: Readonly<CodeFieldLabels> = DEFAULT_CODE_FIELD_LABELS
): CodeFieldLabels {
  const labels = { ...defaults };
  for (const key of Object.keys(labels) as (keyof CodeFieldLabels)[]) {
    const value = overrides[key];
    if (typeof value === 'string') labels[key] = value;
  }
  return labels;
}

export type CodeFieldProps = Omit<
  HTMLTextareaAttributes,
  'value' | 'class' | 'style' | 'hidden' | 'rows' | 'wrap' | 'children' | 'dir'
> & {
  /** The source text (bindable). */
  value?: string;
  /** A language id or alias (`ts`, `python`, `yml`…); anything else is plain text. */
  language?: string;
  /** A visible label tied to the textarea. Or name it with `aria-label` / `aria-labelledby`. */
  label?: string;
  /** Overrides for the field's own strings (the label dictionary in context is the default). */
  labels?: Partial<CodeFieldLabels>;
  /** Visible lines before the field grows with its content. */
  rows?: number;
  /** Wraps long lines instead of scrolling sideways. */
  wrap?: boolean;
  /** Columns per tab stop (1 to 8), and the spaces one Tab inserts. */
  tabSize?: number;
  /** What Tab inserts: `tabSize` spaces, or one tab character. */
  indentWith?: 'spaces' | 'tab';
  /** Shows line numbers (decorative: hidden from assistive technology). */
  lineNumbers?: boolean;
  /** Characters past which highlighting turns off (at most `CODE_FIELD_HIGHLIGHT_LIMIT`). */
  highlightLimit?: number;
  /** Shows the keyboard hint under the field (it is always the textarea's description). */
  showKeyboardHint?: boolean;
  /** Classes, style and `hidden` land on the wrapper. */
  class?: string;
  style?: string;
  hidden?: boolean;
  /** The wrapper element (bindable). */
  ref?: HTMLElement | null;
  /** The textarea (bindable). */
  textareaRef?: HTMLTextAreaElement | null;
  /** Called with the new value after every edit. */
  onValueChange?: (value: string) => void;
};

/** A text replacement and the selection after it. */
export interface CodeFieldEdit {
  start: number;
  end: number;
  text: string;
  selectionStart: number;
  selectionEnd: number;
}

/** The indentation one Tab inserts. */
export function indentUnit(indentWith: 'spaces' | 'tab' = 'spaces', tabSize = 2): string {
  const size = Number.isFinite(tabSize) ? Math.min(8, Math.max(1, Math.floor(tabSize))) : 2;
  return indentWith === 'tab' ? '\t' : ' '.repeat(size);
}

/** The leading whitespace one Shift+Tab removes from a line. */
function outdentWidth(line: string, unit: string): number {
  if (line.startsWith('\t')) return 1;
  let count = 0;
  const max = unit === '\t' ? 8 : unit.length;
  while (count < max && line[count] === ' ') count += 1;
  return count;
}

/**
 * Tab (`outdent` false) or Shift+Tab (`outdent` true) on a selection. A Tab
 * with no line break selected replaces the selection with one indent; a
 * selection across lines, or any Shift+Tab, indents or outdents every line
 * it touches (empty lines stay empty). `null` when nothing would change.
 */
export function indentEdit(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  unit: string,
  outdent = false
): CodeFieldEdit | null {
  const from = Math.max(0, Math.min(selectionStart, selectionEnd, value.length));
  const to = Math.min(value.length, Math.max(selectionStart, selectionEnd));
  const multiline = value.slice(from, to).includes('\n');
  if (!outdent && !multiline) {
    const caret = from + unit.length;
    return { start: from, end: to, text: unit, selectionStart: caret, selectionEnd: caret };
  }
  const blockStart = value.lastIndexOf('\n', from - 1) + 1;
  // A selection that ends at the start of a line leaves that line alone.
  const last = to > from && value[to - 1] === '\n' ? to - 1 : to;
  const newline = value.indexOf('\n', last);
  const blockEnd = newline === -1 ? value.length : newline;
  const lines = value.slice(blockStart, blockEnd).split('\n');
  const deltas: number[] = [];
  const next = lines.map((line) => {
    if (outdent) {
      const width = outdentWidth(line, unit);
      deltas.push(-width);
      return line.slice(width);
    }
    if (line === '') {
      deltas.push(0);
      return line;
    }
    deltas.push(unit.length);
    return unit + line;
  });
  if (deltas.every((delta) => delta === 0)) return null;
  const text = next.join('\n');
  // Maps an old offset inside the block to its new offset.
  const map = (offset: number, keepLineStart: boolean): number => {
    let oldStart = blockStart;
    let newStart = blockStart;
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i] as string;
      const delta = deltas[i] as number;
      if (offset <= oldStart + line.length || i === lines.length - 1) {
        const column = offset - oldStart;
        if (delta >= 0) {
          return newStart + (column === 0 && keepLineStart ? 0 : column + delta);
        }
        return newStart + Math.max(0, column + delta);
      }
      oldStart += line.length + 1;
      newStart += line.length + delta + 1;
    }
    return newStart;
  };
  const collapsed = from === to;
  const start = map(from, !collapsed);
  const end = collapsed ? start : map(to, false);
  return { start: blockStart, end: blockEnd, text, selectionStart: start, selectionEnd: end };
}

/** Enter: a line break that keeps the current line's indentation. */
export function newlineEdit(
  value: string,
  selectionStart: number,
  selectionEnd: number
): CodeFieldEdit {
  const from = Math.max(0, Math.min(selectionStart, selectionEnd, value.length));
  const to = Math.min(value.length, Math.max(selectionStart, selectionEnd));
  const lineStart = value.lastIndexOf('\n', from - 1) + 1;
  let indentEnd = lineStart;
  while (indentEnd < from && (value[indentEnd] === ' ' || value[indentEnd] === '\t')) {
    indentEnd += 1;
  }
  const text = `\n${value.slice(lineStart, indentEnd)}`;
  const caret = from + text.length;
  return { start: from, end: to, text, selectionStart: caret, selectionEnd: caret };
}

/** Applies an edit to a string (what the textarea holds after it). */
export function applyCodeFieldEdit(value: string, edit: CodeFieldEdit): string {
  return value.slice(0, edit.start) + edit.text + value.slice(edit.end);
}

/**
 * The line scanner: input bounds, line endings and hidden characters, the
 * frontmatter block, and the split into slides at `---` (horizontal) and
 * `--` (vertical) lines outside code and math fences. One pass over the
 * lines (a second, fence-bounded pass only after an unclosed fence).
 */
import { utf8Length } from '../model/plain.ts';
import type { IssueSink } from './issues.ts';
import { DECK_MARKDOWN_LIMITS } from './limits.ts';
import { isHiddenCode } from './text.ts';

export interface Line {
  text: string;
  /** 1-based line number in the source. */
  n: number;
}

export interface RawSlide {
  lines: Line[];
  /** Came after a `--` line: part of the previous horizontal slide's stack. */
  vertical: boolean;
  /** The line where the slide starts (its first line, or its separator + 1). */
  line: number;
}

export interface Scanned {
  frontmatter: Line[] | null;
  /** Line of the opening `---` of the frontmatter. */
  frontmatterLine: number;
  slides: RawSlide[];
}

/**
 * Line endings normalized (CR LF, CR, U+2028 and U+2029 become line feeds),
 * size bounds applied, hidden characters reported and removed.
 */
export function normalizeLines(text: string, sink: IssueSink): Line[] | null {
  if (utf8Length(text) > DECK_MARKDOWN_LIMITS.bytes) {
    sink.report(
      'md-too-large',
      `The document is over ${DECK_MARKDOWN_LIMITS.bytes} bytes; nothing was read.`,
      { line: 1, column: 1 },
      [],
      'Split the deck, or move large data out of the Markdown.'
    );
    return null;
  }
  let source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  // U+2028 and U+2029 are line terminators to JavaScript regexes (`.` and `$`
  // stop at them), so they end a line here too: no line holds one.
  source = source.replace(/\r\n?|[\u2028\u2029]/g, '\n');
  const raw = source.split('\n');
  if (raw.length > DECK_MARKDOWN_LIMITS.lines) {
    sink.report(
      'md-too-large',
      `The document is over ${DECK_MARKDOWN_LIMITS.lines} lines; the rest was not read.`,
      { line: DECK_MARKDOWN_LIMITS.lines + 1, column: 1 }
    );
    raw.length = DECK_MARKDOWN_LIMITS.lines;
  }
  const lines: Line[] = [];
  for (let index = 0; index < raw.length; index++) {
    let line = raw[index] ?? '';
    const n = index + 1;
    if (line.length > DECK_MARKDOWN_LIMITS.lineLength) {
      sink.report(
        'md-too-large',
        `A line is at most ${DECK_MARKDOWN_LIMITS.lineLength} characters; the rest was cut.`,
        { line: n, column: DECK_MARKDOWN_LIMITS.lineLength + 1 }
      );
      line = line.slice(0, DECK_MARKDOWN_LIMITS.lineLength);
    }
    let clean = '';
    let start = 0;
    let reported = false;
    for (let i = 0; i < line.length; i++) {
      const code = line.charCodeAt(i);
      if (code === 0x09 || !isHiddenCode(code)) continue;
      if (!reported) {
        sink.report(
          'md-invisible-char',
          `Hidden character U+${code.toString(16).toUpperCase().padStart(4, '0')} (control, bidi or invisible formatting).`,
          { line: n, column: i + 1 },
          [],
          'Delete the character; it can hide or reorder text (Trojan Source).'
        );
        reported = true;
      }
      clean += line.slice(start, i);
      start = i + 1;
    }
    lines.push({ text: start === 0 ? line : clean + line.slice(start), n });
  }
  return lines;
}

const H_SEP = /^-{3,}[ \t]*$/;
const V_SEP = /^--[ \t]*$/;
const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})/;
const MATH_FENCE = /^ {0,3}\$\$[ \t]*$/;

function closesFence(text: string, char: string, length: number): boolean {
  const match = /^ {0,3}(`{3,}|~{3,})[ \t]*$/.exec(text);
  return match?.[1] !== undefined && match[1][0] === char && match[1].length >= length;
}

/** Split the frontmatter and the slides. */
export function scanDocument(lines: Line[], sink: IssueSink): Scanned {
  let start = 0;
  let frontmatter: Line[] | null = null;
  if (lines.length > 0 && /^---[ \t]*$/.test(lines[0]?.text ?? '')) {
    let close = -1;
    const end = Math.min(lines.length, DECK_MARKDOWN_LIMITS.frontmatterLines + 2);
    for (let i = 1; i < end; i++) {
      if (/^---[ \t]*$/.test(lines[i]?.text ?? '')) {
        close = i;
        break;
      }
    }
    if (close === -1) {
      sink.report(
        'md-frontmatter-unclosed',
        `The frontmatter has no closing \`---\` within ${DECK_MARKDOWN_LIMITS.frontmatterLines} lines.`,
        { line: 1, column: 1 },
        [],
        'Close the frontmatter with a `---` line.'
      );
    } else {
      frontmatter = lines.slice(1, close);
      start = close + 1;
    }
  }
  const slides = splitSlides(lines, start, false);
  return {
    frontmatter,
    frontmatterLine: 1,
    slides: slides ?? splitSlides(lines, start, true) ?? [],
  };
}

/**
 * Split at separators. Returns null when a fence is still open at the end of
 * the document; the caller then splits again with `bounded`, where every
 * fence ends at the next separator line (so one bad fence cannot swallow the
 * rest of the deck).
 */
function splitSlides(lines: Line[], from: number, bounded: boolean): RawSlide[] | null {
  const slides: RawSlide[] = [];
  let current: RawSlide = { lines: [], vertical: false, line: lines[from]?.n ?? 1 };
  let fence: { char: string; length: number } | null = null;
  let math = false;
  for (let i = from; i < lines.length; i++) {
    const line = lines[i] as Line;
    const text = line.text;
    if (fence !== null || math) {
      const separator = H_SEP.test(text) || V_SEP.test(text);
      if (bounded && separator) {
        fence = null;
        math = false;
      } else {
        if (fence !== null && closesFence(text, fence.char, fence.length)) fence = null;
        else if (math && MATH_FENCE.test(text)) math = false;
        current.lines.push(line);
        continue;
      }
    }
    if (H_SEP.test(text) || V_SEP.test(text)) {
      slides.push(current);
      current = { lines: [], vertical: V_SEP.test(text), line: line.n + 1 };
      continue;
    }
    const open = FENCE_OPEN.exec(text);
    if (
      open?.[1] !== undefined &&
      !(open[1][0] === '`' && text.slice(open[0].length).includes('`'))
    ) {
      fence = { char: open[1][0] ?? '`', length: open[1].length };
    } else if (MATH_FENCE.test(text)) {
      math = true;
    }
    current.lines.push(line);
  }
  if ((fence !== null || math) && !bounded) return null;
  slides.push(current);
  return slides;
}

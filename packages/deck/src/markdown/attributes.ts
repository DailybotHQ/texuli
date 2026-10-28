/**
 * The attribute lexer for `<!-- .slide: … -->`, `<!-- .element: … -->` and
 * `{#id name=value flag}` brace lists. One left-to-right pass; values are
 * quoted (`"…"`, `'…'`, no escapes) or bare tokens. The closed attribute sets
 * themselves live with the code that reads them.
 */
import type { IssueSink } from './issues.ts';
import { DECK_MARKDOWN_LIMITS } from './limits.ts';

export interface Attr {
  name: string;
  /** `true` for a bare flag (`hidden`, `numbers`). */
  value: string | true;
  line: number;
  /** 1-based column of the attribute name. */
  column: number;
}

const NAME_START = /[A-Za-z_]/;
const NAME_CHAR = /[A-Za-z0-9_.:-]/;
const BARE_CHAR = /[^\s"'=<>`{}]/;

/**
 * Read attributes from `text`, which starts at `column` on `line`. In brace
 * mode `#slug` is an `id` and `.name` is a `class`.
 */
export function readAttributes(
  text: string,
  line: number,
  column: number,
  sink: IssueSink,
  brace = false
): Attr[] {
  const out: Attr[] = [];
  let i = 0;
  const bad = (message: string) => {
    sink.report('md-attr-value', message, { line, column: column + i });
  };
  while (i < text.length) {
    const c = text[i] ?? '';
    if (c === ' ' || c === '\t') {
      i++;
      continue;
    }
    if (out.length >= DECK_MARKDOWN_LIMITS.attributes) {
      bad(`At most ${DECK_MARKDOWN_LIMITS.attributes} attributes per comment or brace list.`);
      return out;
    }
    const start = i;
    if (brace && (c === '#' || c === '.')) {
      i++;
      while (i < text.length && NAME_CHAR.test(text[i] ?? '')) i++;
      const value = text.slice(start + 1, i);
      if (value === '') {
        bad(`\`${c}\` needs a name after it.`);
        continue;
      }
      out.push({ name: c === '#' ? 'id' : 'class', value, line, column: column + start });
      continue;
    }
    if (!NAME_START.test(c)) {
      bad(`Unexpected \`${c}\`; attributes look like name="value".`);
      return out;
    }
    while (i < text.length && NAME_CHAR.test(text[i] ?? '')) i++;
    const name = text.slice(start, i);
    if (text[i] !== '=') {
      out.push({ name, value: true, line, column: column + start });
      continue;
    }
    i++;
    const quote = text[i];
    let value: string;
    if (quote === '"' || quote === "'") {
      const end = text.indexOf(quote, i + 1);
      if (end === -1) {
        bad(`The value of "${name.slice(0, 40)}" has no closing ${quote}.`);
        return out;
      }
      value = text.slice(i + 1, end);
      i = end + 1;
    } else {
      const valueStart = i;
      while (i < text.length && BARE_CHAR.test(text[i] ?? '')) i++;
      value = text.slice(valueStart, i);
      if (value === '') {
        bad(`"${name.slice(0, 40)}=" needs a value.`);
        return out;
      }
    }
    if (value.length > DECK_MARKDOWN_LIMITS.attributeValue) {
      bad(`An attribute value is at most ${DECK_MARKDOWN_LIMITS.attributeValue} characters.`);
      continue;
    }
    out.push({ name, value, line, column: column + start });
  }
  return out;
}

/** An attribute value as written in canonical output: bare when it is a plain token. */
export function writeAttribute(name: string, value: string | number | true): string {
  if (value === true) return name;
  const text = String(value);
  if (/^[A-Za-z0-9._/:#+-]+$/.test(text)) return `${name}=${text}`;
  return text.includes('"') ? `${name}='${text}'` : `${name}="${text}"`;
}

/** True when a value can be written as an attribute at all (one quote style fits). */
export function attributeWritable(value: string): boolean {
  return (
    value.length <= DECK_MARKDOWN_LIMITS.attributeValue &&
    !value.includes('\n') &&
    !value.includes('-->') &&
    !(value.includes('"') && value.includes("'"))
  );
}

/**
 * The owned TeX subset → MathML node tree. A small recursive-descent reader
 * over the source with explicit bounds (`MATH_LIMITS`): source length,
 * nesting depth and output nodes. Unknown and refused commands fail the
 * whole formula, which then shows its source as text.
 */
import {
  ACCENTS,
  BIG_OPERATORS,
  DELIMITERS,
  ENVIRONMENTS,
  ESCAPED,
  FONTS,
  FUNCTIONS,
  GREEK,
  IDENTIFIERS,
  OPERATORS,
  REFUSED,
  SIZING,
  SPACES,
  UNDER_ACCENTS,
} from './symbols.ts';
import {
  MATH_CODES,
  MATH_LIMITS,
  type MathCode,
  type MathIssue,
  type MathNode,
  type MathResult,
  type TexToMathOptions,
} from './types.ts';

class TexError extends Error {
  readonly code: MathCode;
  readonly offset: number;
  constructor(code: MathCode, message: string, offset: number) {
    super(message);
    this.code = code;
    this.offset = offset;
  }
}

/** Characters read as operators (`-` becomes a minus sign). */
const OPERATOR_CHARS: Readonly<Record<string, string>> = Object.freeze({
  '+': '+',
  '-': '−',
  '*': '∗',
  '=': '=',
  '<': '<',
  '>': '>',
  '/': '/',
  '!': '!',
  '(': '(',
  ')': ')',
  '[': '[',
  ']': ']',
  '|': '|',
  ',': ',',
  ';': ';',
  ':': ':',
  '.': '.',
  '?': '?',
  '@': '@',
});

/** `\not` before these reads as the negated relation. */
const NEGATED: Readonly<Record<string, string>> = Object.freeze({
  '=': '≠',
  '<': '≮',
  '>': '≯',
  in: '∉',
  subset: '⊄',
  supset: '⊅',
  equiv: '≢',
  sim: '≁',
  approx: '≉',
  le: '≰',
  ge: '≱',
});

const TEXT_COMMANDS: Readonly<Record<string, string | undefined>> = Object.freeze({
  text: undefined,
  textrm: undefined,
  textnormal: undefined,
  mbox: undefined,
  textup: undefined,
  textbf: 'bold',
  textit: 'italic',
  textsf: 'sans-serif',
  texttt: 'monospace',
});

type Stop = '}' | ']' | 'right' | 'cell' | 'eof';

interface Scripted {
  node: MathNode;
  /** Big operator or limits function: limits go under/over in display math. */
  limits: boolean;
}

class TexParser {
  readonly src: string;
  readonly display: boolean;
  i = 0;
  nodes = 0;
  depth = 0;

  constructor(src: string, display: boolean) {
    this.src = src;
    this.display = display;
  }

  fail(code: MathCode, message: string, offset = this.i): never {
    throw new TexError(code, message, offset);
  }

  make(node: MathNode): MathNode {
    this.nodes++;
    if (this.nodes > MATH_LIMITS.nodes) {
      this.fail(MATH_CODES.limit, `A formula produces at most ${MATH_LIMITS.nodes} nodes.`);
    }
    return node;
  }

  token(tag: 'mi' | 'mn' | 'mo' | 'mtext', text: string, attrs?: MathNode['attrs']): MathNode {
    return this.make(attrs ? { tag, text, attrs } : { tag, text });
  }

  enter(): void {
    this.depth++;
    if (this.depth > MATH_LIMITS.depth) {
      this.fail(MATH_CODES.limit, `Groups nest at most ${MATH_LIMITS.depth} deep.`);
    }
  }

  skipSpace(): void {
    while (this.i < this.src.length) {
      const c = this.src[this.i];
      if (c === ' ' || c === '\t' || c === '\n') this.i++;
      else if (c === '%') {
        while (this.i < this.src.length && this.src[this.i] !== '\n') this.i++;
      } else break;
    }
  }

  /** The command name at `this.i` (just after a backslash), without consuming it. */
  peekCommand(at = this.i): string {
    if (this.src[at] !== '\\') return '';
    let end = at + 1;
    while (end < this.src.length && /[A-Za-z]/.test(this.src[end] ?? '')) end++;
    if (end === at + 1) return this.src[at + 1] ?? '';
    return this.src.slice(at + 1, end);
  }

  readCommand(): string {
    const name = this.peekCommand();
    this.i += 1 + Math.max(1, name.length);
    return name;
  }

  atStop(stop: Stop): boolean {
    this.skipSpace();
    if (this.i >= this.src.length) return true;
    const c = this.src[this.i];
    if (c === '}') return true;
    if (stop === ']' && c === ']') return true;
    if (c === '&')
      return stop === 'cell' ? true : this.fail(MATH_CODES.syntax, '`&` is only for matrix cells.');
    if (c === '\\') {
      const name = this.peekCommand();
      if (name === 'right') return true;
      if (name === 'end') return true;
      if (name === '\\' && stop === 'cell') return true;
    }
    return false;
  }

  list(stop: Stop): MathNode[] {
    const out: MathNode[] = [];
    while (!this.atStop(stop)) {
      if (this.src[this.i] === '\\' && this.peekCommand() === '\\') {
        // A line break outside a matrix: no visible effect in inline MathML.
        this.i += 2;
        continue;
      }
      const atom = this.atom();
      if (atom === null) continue;
      out.push(this.scripts(atom));
    }
    return out;
  }

  row(children: MathNode[]): MathNode {
    if (children.length === 1 && children[0]) return children[0];
    return this.make({ tag: 'mrow', children });
  }

  group(): MathNode {
    const start = this.i;
    this.i++; // {
    this.enter();
    const children = this.list('}');
    this.depth--;
    if (this.src[this.i] !== '}') this.fail(MATH_CODES.syntax, 'A `{` is never closed.', start);
    this.i++;
    return this.row(children);
  }

  /** One argument: a braced group or a single token. */
  argument(name: string): MathNode {
    this.skipSpace();
    if (this.i >= this.src.length || this.src[this.i] === '}') {
      this.fail(MATH_CODES.syntax, `\\${name} needs an argument.`);
    }
    if (this.src[this.i] === '{') return this.group();
    const c = this.src[this.i] ?? '';
    if (/[0-9]/.test(c)) {
      this.i++;
      return this.token('mn', c);
    }
    const atom = this.atom();
    if (atom === null) this.fail(MATH_CODES.syntax, `\\${name} needs an argument.`);
    return atom.node;
  }

  /** The raw text of a braced argument (for `\text`, `\operatorname`, environment names). */
  rawGroup(name: string): string {
    this.skipSpace();
    if (this.src[this.i] !== '{') this.fail(MATH_CODES.syntax, `\\${name} needs {…}.`);
    const start = this.i;
    this.i++;
    let level = 1;
    let out = '';
    while (this.i < this.src.length) {
      const c = this.src[this.i] ?? '';
      if (c === '\\') {
        const next = this.src[this.i + 1] ?? '';
        if (Object.hasOwn(ESCAPED, next) && next !== '|') {
          out += next;
          this.i += 2;
          continue;
        }
        if (next === ' ') {
          out += ' ';
          this.i += 2;
          continue;
        }
        this.fail(MATH_CODES.unsupported, `Commands are not read inside \\${name}.`);
      }
      if (c === '{') level++;
      else if (c === '}') {
        level--;
        if (level === 0) {
          this.i++;
          return out;
        }
      }
      out += c;
      this.i++;
    }
    return this.fail(MATH_CODES.syntax, 'A `{` is never closed.', start);
  }

  delimiter(after: string): string {
    this.skipSpace();
    const c = this.src[this.i] ?? '';
    if (c === '\\') {
      const name = this.peekCommand();
      const key = `\\${name}`;
      if (Object.hasOwn(DELIMITERS, key)) {
        this.readCommand();
        return DELIMITERS[key] ?? '';
      }
    } else if (Object.hasOwn(DELIMITERS, c)) {
      this.i++;
      return DELIMITERS[c] ?? '';
    }
    return this.fail(MATH_CODES.syntax, `\\${after} needs a delimiter such as ( [ \\{ | or .`);
  }

  fence(text: string): MathNode | null {
    if (text === '') return null;
    return this.token('mo', text, { fence: 'true', stretchy: 'true' });
  }

  atom(): Scripted | null {
    const start = this.i;
    const c = this.src[this.i] ?? '';
    if (c === '{') return { node: this.group(), limits: false };
    if (c === '^' || c === '_') {
      // A script with no base: an empty base row.
      return { node: this.make({ tag: 'mrow', children: [] }), limits: false };
    }
    if (c === "'") {
      this.i++;
      return { node: this.token('mo', '′'), limits: false };
    }
    if (/[0-9]/.test(c)) {
      const match = /^[0-9]+(?:\.[0-9]+)?/.exec(this.src.slice(this.i, this.i + 64));
      const digits = match?.[0] ?? c;
      this.i += digits.length;
      return { node: this.token('mn', digits), limits: false };
    }
    if (c === '\\') return this.command(start);
    if (c === '~') {
      this.i++;
      return { node: this.make({ tag: 'mspace', attrs: { width: '0.3333em' } }), limits: false };
    }
    if (c === '#' || c === '$') {
      this.fail(MATH_CODES.syntax, `\`${c}\` is not allowed in a formula.`);
    }
    this.i += c.length;
    if (Object.hasOwn(OPERATOR_CHARS, c)) {
      return { node: this.token('mo', OPERATOR_CHARS[c] ?? c), limits: false };
    }
    const code = this.src.codePointAt(start) ?? 0;
    const char = String.fromCodePoint(code);
    this.i = start + char.length;
    if (/\p{L}/u.test(char)) return { node: this.token('mi', char), limits: false };
    return { node: this.token('mo', char), limits: false };
  }

  command(start: number): Scripted | null {
    const name = this.readCommand();
    if (name === '') this.fail(MATH_CODES.syntax, 'A formula cannot end with `\\`.', start);
    if (REFUSED.has(name)) {
      this.fail(
        MATH_CODES.unsupported,
        `\\${name} is refused: math cannot link, color, load, label or define macros.`,
        start
      );
    }
    if (Object.hasOwn(GREEK, name)) {
      const upper = name[0] !== undefined && name[0] === name[0].toUpperCase();
      return {
        node: this.token('mi', GREEK[name] ?? '', upper ? { mathvariant: 'normal' } : undefined),
        limits: false,
      };
    }
    if (Object.hasOwn(IDENTIFIERS, name)) {
      return { node: this.token('mi', IDENTIFIERS[name] ?? ''), limits: false };
    }
    if (Object.hasOwn(OPERATORS, name)) {
      return { node: this.token('mo', OPERATORS[name] ?? ''), limits: false };
    }
    if (Object.hasOwn(ESCAPED, name)) {
      return { node: this.token('mo', ESCAPED[name] ?? ''), limits: false };
    }
    if (Object.hasOwn(SPACES, name)) {
      return {
        node: this.make({ tag: 'mspace', attrs: { width: SPACES[name] ?? '0' } }),
        limits: false,
      };
    }
    if (Object.hasOwn(BIG_OPERATORS, name)) {
      const op = BIG_OPERATORS[name];
      return {
        node: this.token('mo', op?.text ?? '', { largeop: 'true', movablelimits: 'false' }),
        limits: op?.integral !== true,
      };
    }
    if (Object.hasOwn(FUNCTIONS, name)) {
      return { node: this.token('mi', name), limits: FUNCTIONS[name]?.limits === true };
    }
    if (name === 'operatorname') {
      const text = this.rawGroup(name).trim();
      if (!/^[A-Za-z][A-Za-z0-9 ]{0,31}$/.test(text)) {
        this.fail(MATH_CODES.syntax, '\\operatorname takes letters only.', start);
      }
      return { node: this.token('mi', text, { mathvariant: 'normal' }), limits: false };
    }
    if (Object.hasOwn(TEXT_COMMANDS, name)) {
      const text = this.rawGroup(name);
      const variant = TEXT_COMMANDS[name];
      return {
        node: this.token('mtext', text, variant ? { mathvariant: variant } : undefined),
        limits: false,
      };
    }
    if (name === 'frac' || name === 'dfrac' || name === 'tfrac' || name === 'cfrac') {
      this.enter();
      const top = this.argument(name);
      const bottom = this.argument(name);
      this.depth--;
      const frac = this.make({ tag: 'mfrac', children: [top, bottom] });
      if (name === 'frac') return { node: frac, limits: false };
      return {
        node: this.make({
          tag: 'mstyle',
          attrs: { displaystyle: name === 'tfrac' ? 'false' : 'true' },
          children: [frac],
        }),
        limits: false,
      };
    }
    if (name === 'binom' || name === 'dbinom' || name === 'tbinom') {
      this.enter();
      const top = this.argument(name);
      const bottom = this.argument(name);
      this.depth--;
      const frac = this.make({
        tag: 'mfrac',
        attrs: { linethickness: '0' },
        children: [top, bottom],
      });
      return {
        node: this.make({
          tag: 'mrow',
          children: [this.token('mo', '('), frac, this.token('mo', ')')],
        }),
        limits: false,
      };
    }
    if (name === 'sqrt') {
      this.enter();
      this.skipSpace();
      let index: MathNode | null = null;
      if (this.src[this.i] === '[') {
        const open = this.i;
        this.i++;
        const children = this.list(']');
        if (this.src[this.i] !== ']') this.fail(MATH_CODES.syntax, 'A `[` is never closed.', open);
        this.i++;
        index = this.row(children);
      }
      const base = this.argument(name);
      this.depth--;
      return {
        node: index
          ? this.make({ tag: 'mroot', children: [base, index] })
          : this.make({ tag: 'msqrt', children: [base] }),
        limits: false,
      };
    }
    if (Object.hasOwn(ACCENTS, name)) {
      this.enter();
      const base = this.argument(name);
      this.depth--;
      const stretchy = name.startsWith('over') || name.startsWith('wide') ? 'true' : 'false';
      return {
        node: this.make({
          tag: 'mover',
          attrs: { accent: 'true' },
          children: [base, this.token('mo', ACCENTS[name] ?? '', { stretchy })],
        }),
        limits: false,
      };
    }
    if (Object.hasOwn(UNDER_ACCENTS, name)) {
      this.enter();
      const base = this.argument(name);
      this.depth--;
      return {
        node: this.make({
          tag: 'munder',
          attrs: { accentunder: 'true' },
          children: [base, this.token('mo', UNDER_ACCENTS[name] ?? '', { stretchy: 'true' })],
        }),
        limits: false,
      };
    }
    if (Object.hasOwn(FONTS, name)) {
      this.enter();
      const base = this.argument(name);
      this.depth--;
      applyVariant(base, FONTS[name] ?? 'normal');
      return { node: base, limits: false };
    }
    if (name === 'left') {
      const open = this.delimiter(name);
      this.enter();
      const children = this.list('right');
      this.depth--;
      if (this.peekCommand() !== 'right')
        this.fail(MATH_CODES.syntax, '\\left has no \\right.', start);
      this.readCommand();
      const close = this.delimiter('right');
      const parts = [this.fence(open), ...children, this.fence(close)].filter(
        (node): node is MathNode => node !== null
      );
      return { node: this.make({ tag: 'mrow', children: parts }), limits: false };
    }
    if (name === 'right') this.fail(MATH_CODES.syntax, '\\right has no \\left.', start);
    if (SIZING.has(name)) {
      const text = this.delimiter(name);
      return { node: this.token('mo', text, { stretchy: 'false' }), limits: false };
    }
    if (name === 'not') {
      this.skipSpace();
      const next = this.src[this.i] === '\\' ? this.peekCommand() : (this.src[this.i] ?? '');
      if (!Object.hasOwn(NEGATED, next)) {
        this.fail(
          MATH_CODES.unsupported,
          '\\not works before =, <, >, \\in, \\subset, \\equiv…',
          start
        );
      }
      this.i += this.src[this.i] === '\\' ? 1 + next.length : 1;
      return { node: this.token('mo', NEGATED[next] ?? ''), limits: false };
    }
    if (name === 'begin') return { node: this.environment(start), limits: false };
    if (name === 'end') this.fail(MATH_CODES.syntax, '\\end has no \\begin.', start);
    if (
      name === 'limits' ||
      name === 'nolimits' ||
      name === 'displaystyle' ||
      name === 'textstyle' ||
      name === 'scriptstyle' ||
      name === 'nonumber' ||
      name === 'notag'
    ) {
      return null;
    }
    return this.fail(
      MATH_CODES.unsupported,
      `\\${name} is not in the supported TeX subset.`,
      start
    );
  }

  environment(start: number): MathNode {
    const name = this.rawGroup('begin').trim();
    const env = Object.hasOwn(ENVIRONMENTS, name) ? ENVIRONMENTS[name] : undefined;
    if (!env) {
      this.fail(
        MATH_CODES.unsupported,
        `The environment "${name.slice(0, 32)}" is not supported.`,
        start
      );
    }
    if (name === 'array') this.rawGroup('array'); // column spec: alignment only
    this.enter();
    const rows: MathNode[] = [];
    let cells = 0;
    let row: MathNode[] = [];
    for (;;) {
      const children = this.list('cell');
      cells++;
      if (cells > MATH_LIMITS.cells) {
        this.fail(MATH_CODES.limit, `A matrix has at most ${MATH_LIMITS.cells} cells.`);
      }
      row.push(this.make({ tag: 'mtd', children }));
      if (this.i >= this.src.length)
        this.fail(MATH_CODES.syntax, `\\begin{${name}} has no \\end.`, start);
      const c = this.src[this.i];
      if (c === '&') {
        this.i++;
        continue;
      }
      const command = this.peekCommand();
      if (command === '\\') {
        this.i += 2;
        rows.push(this.make({ tag: 'mtr', children: row }));
        row = [];
        if (rows.length > MATH_LIMITS.rows) {
          this.fail(MATH_CODES.limit, `A matrix has at most ${MATH_LIMITS.rows} rows.`);
        }
        continue;
      }
      if (command === 'end') {
        this.readCommand();
        const closing = this.rawGroup('end').trim();
        if (closing !== name) {
          this.fail(
            MATH_CODES.syntax,
            `\\begin{${name}} ends with \\end{${closing.slice(0, 32)}}.`,
            start
          );
        }
        break;
      }
      this.fail(MATH_CODES.syntax, `Unexpected \`${c ?? ''}\` in \\begin{${name}}.`);
    }
    // A trailing `\\` leaves an empty last row: drop it.
    const last = row.length === 1 ? row[0] : undefined;
    if (!(last && (last.children?.length ?? 0) === 0 && rows.length > 0)) {
      rows.push(this.make({ tag: 'mtr', children: row }));
    }
    this.depth--;
    const table = this.make({
      tag: 'mtable',
      attrs: env.align ? { columnalign: env.align } : {},
      children: rows,
    });
    if (table.attrs && Object.keys(table.attrs).length === 0) delete table.attrs;
    const parts = [this.fence(env.open), table, this.fence(env.close)].filter(
      (node): node is MathNode => node !== null
    );
    return parts.length === 1 && parts[0] ? parts[0] : this.make({ tag: 'mrow', children: parts });
  }

  scripts(base: Scripted): MathNode {
    let sub: MathNode | null = null;
    let sup: MathNode | null = null;
    let primes = '';
    for (;;) {
      this.skipSpace();
      const c = this.src[this.i];
      if (c === "'") {
        primes += '′';
        this.i++;
        continue;
      }
      if (c !== '^' && c !== '_') break;
      const at = this.i;
      this.i++;
      this.enter();
      const arg = this.argument(c === '^' ? 'superscript' : 'subscript');
      this.depth--;
      if (c === '^') {
        if (sup !== null) this.fail(MATH_CODES.syntax, 'Double superscript: use braces.', at);
        sup = arg;
      } else {
        if (sub !== null) this.fail(MATH_CODES.syntax, 'Double subscript: use braces.', at);
        sub = arg;
      }
    }
    if (primes) {
      const prime = this.token('mo', primes);
      sup = sup ? this.make({ tag: 'mrow', children: [prime, sup] }) : prime;
    }
    if (sub === null && sup === null) return base.node;
    const under = base.limits && this.display;
    if (sub && sup) {
      return this.make({ tag: under ? 'munderover' : 'msubsup', children: [base.node, sub, sup] });
    }
    if (sub) return this.make({ tag: under ? 'munder' : 'msub', children: [base.node, sub] });
    return this.make({ tag: under ? 'mover' : 'msup', children: [base.node, sup as MathNode] });
  }
}

function applyVariant(node: MathNode, variant: string): void {
  if (node.tag === 'mi' || node.tag === 'mn' || node.tag === 'mtext') {
    node.attrs = { ...node.attrs, mathvariant: variant };
    return;
  }
  for (const child of node.children ?? []) applyVariant(child, variant);
}

function fallback(source: string, display: boolean): MathNode {
  return {
    tag: 'math',
    attrs: { display: display ? 'block' : 'inline' },
    children: [{ tag: 'mtext', text: source }],
  };
}

/**
 * Convert a TeX formula (without its `$`/`$$` delimiters) to a MathML node
 * tree. Never throws: an unsupported command, a syntax error or a bound
 * gives `ok: false`, one issue and a node that shows the source as text.
 */
export function texToMath(tex: string, options: TexToMathOptions = {}): MathResult {
  const display = options.display === true;
  const source = String(tex);
  if (source.length > MATH_LIMITS.source) {
    return {
      ok: false,
      node: fallback(source.slice(0, MATH_LIMITS.source), display),
      issues: [
        {
          code: MATH_CODES.limit,
          message: `A formula is at most ${MATH_LIMITS.source} characters.`,
          offset: MATH_LIMITS.source,
        },
      ],
    };
  }
  const parser = new TexParser(source, display);
  try {
    const children = parser.list('eof');
    if (parser.i < source.length) {
      parser.fail(MATH_CODES.syntax, 'A `}` has no matching `{`.');
    }
    return {
      ok: true,
      node: { tag: 'math', attrs: { display: display ? 'block' : 'inline' }, children },
      issues: [],
    };
  } catch (error) {
    const issue: MathIssue =
      error instanceof TexError
        ? { code: error.code, message: error.message, offset: error.offset }
        : { code: MATH_CODES.syntax, message: 'The formula could not be read.', offset: 0 };
    return { ok: false, node: fallback(source, display), issues: [issue] };
  }
}

/** The plain text of a math tree (for accessible names, text twins and PPTX). */
export function mathText(node: MathNode): string {
  if (node.text !== undefined) return node.text;
  return (node.children ?? []).map(mathText).join('');
}

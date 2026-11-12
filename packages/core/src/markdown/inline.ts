/**
 * CommonMark 0.31.2 inline parser (§6): code spans, emphasis and strong emphasis (the delimiter
 * run algorithm of appendix A, linear with per-class opener bottoms), links and images (inline
 * and reference), autolinks, raw HTML, hard and soft line breaks, backslash escapes and
 * character references. It builds a small linked tree that `parse.ts` turns into the AST.
 * Every pathological shape stays linear: backtick runs are indexed once, failed searches are
 * memoized, link labels are capped at 999 characters, and failed link destination scans draw on
 * a work budget proportional to the paragraph.
 */
import { autolinkBoundary, emailAutolinks, urlAutolink, wwwAutolinkEnd } from './gfm/autolink.ts';
import { GFM_OFF, type GfmFlags } from './gfm/options.ts';
import {
  decodeEntity,
  entityLength,
  htmlTagLength,
  isAsciiPunctuation,
  NextIndex,
  normalizeLabel,
  punctuationAround,
  unescapeString,
  whitespaceAround,
} from './scan.ts';

export type InlineKind =
  | 'text'
  | 'softbreak'
  | 'linebreak'
  | 'emph'
  | 'strong'
  | 'code'
  | 'html'
  | 'link'
  | 'image'
  | 'delete'
  | 'footnoteReference';

export interface InlineNode {
  kind: InlineKind;
  value: string;
  url?: string;
  title?: string;
  /** Text from an escape or a character reference: never part of an extended autolink. */
  literal?: boolean;
  parent: InlineNode | null;
  prev: InlineNode | null;
  next: InlineNode | null;
  first: InlineNode | null;
  last: InlineNode | null;
}

export interface LinkReference {
  readonly url: string;
  readonly title?: string;
}

export type ReferenceMap = Map<string, LinkReference>;

interface Delimiter {
  cc: number;
  numdelims: number;
  origdelims: number;
  node: InlineNode;
  previous: Delimiter | null;
  next: Delimiter | null;
  canOpen: boolean;
  canClose: boolean;
}

interface Bracket {
  node: InlineNode;
  previous: Bracket | null;
  previousDelimiter: Delimiter | null;
  index: number;
  image: boolean;
  active: boolean;
  bracketAfter: boolean;
}

export function inlineNode(kind: InlineKind, value = ''): InlineNode {
  return { kind, value, parent: null, prev: null, next: null, first: null, last: null };
}

function append(parent: InlineNode, child: InlineNode): void {
  unlink(child);
  child.parent = parent;
  if (parent.last) {
    parent.last.next = child;
    child.prev = parent.last;
    parent.last = child;
  } else {
    parent.first = child;
    parent.last = child;
  }
}

function insertAfter(node: InlineNode, sibling: InlineNode): void {
  unlink(sibling);
  sibling.next = node.next;
  if (sibling.next) sibling.next.prev = sibling;
  sibling.prev = node;
  node.next = sibling;
  sibling.parent = node.parent;
  if (sibling.parent && !sibling.next) sibling.parent.last = sibling;
}

function unlink(node: InlineNode): void {
  if (node.prev) node.prev.next = node.next;
  else if (node.parent) node.parent.first = node.next;
  if (node.next) node.next.prev = node.prev;
  else if (node.parent) node.parent.last = node.prev;
  node.parent = null;
  node.next = null;
  node.prev = null;
}

const C_NEWLINE = 0x0a;
const C_ASTERISK = 0x2a;
const C_UNDERSCORE = 0x5f;
const C_BACKTICK = 0x60;
const C_OPEN_BRACKET = 0x5b;
const C_CLOSE_BRACKET = 0x5d;
const C_LESSTHAN = 0x3c;
const C_BANG = 0x21;
const C_BACKSLASH = 0x5c;
const C_AMPERSAND = 0x26;
const C_OPEN_PAREN = 0x28;
const C_CLOSE_PAREN = 0x29;
const C_COLON = 0x3a;
const C_TILDE = 0x7e;
const C_W = 0x77;

/** Characters that end a run of plain text. */
function isSpecial(c: number): boolean {
  return (
    c === C_NEWLINE ||
    c === C_BACKTICK ||
    c === C_OPEN_BRACKET ||
    c === C_CLOSE_BRACKET ||
    c === C_BACKSLASH ||
    c === C_BANG ||
    c === C_LESSTHAN ||
    c === C_AMPERSAND ||
    c === C_ASTERISK ||
    c === C_UNDERSCORE
  );
}

// Sticky: matched in place at a position, never by slicing the rest of the paragraph.
// biome-ignore lint/suspicious/noControlCharactersInRegex: the spec excludes ASCII controls and space.
const URI_AUTOLINK = /<[A-Za-z][A-Za-z0-9.+-]{1,31}:[^<>\u0000-\u0020]*>/y;
const EMAIL_AUTOLINK =
  /<([a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*)>/y;

/** The longest link label (between the brackets), CommonMark §4.7. */
const MAX_LABEL = 999;

export interface InlineParseOptions {
  readonly gfm: GfmFlags;
  /** Footnote definition labels by normalized label (GFM footnotes). */
  readonly footnotes: ReadonlyMap<string, string>;
}

export class InlineParser {
  private subject = '';
  private pos = 0;
  private delimiters: Delimiter | null = null;
  private brackets: Bracket | null = null;
  private next = new NextIndex('');
  /** Backtick runs by length: their start positions, and a cursor into each list. */
  private ticks: Map<number, { starts: number[]; cursor: number }> | null = null;
  /** Work left for link destination scans that fail (linear-time guard). */
  private budget = 0;

  private readonly refmap: ReferenceMap;
  private readonly gfm: GfmFlags;
  private readonly footnotes: ReadonlyMap<string, string>;

  constructor(refmap: ReferenceMap, options?: InlineParseOptions) {
    this.refmap = refmap;
    this.gfm = options?.gfm ?? GFM_OFF;
    this.footnotes = options?.footnotes ?? new Map();
  }

  /** Parse `subject` (a paragraph or heading's raw content) into the children of a new node. */
  parse(subject: string): InlineNode {
    const root = inlineNode('text');
    this.reset(subject);
    while (this.pos < this.subject.length) this.parseInline(root);
    this.processEmphasis(null);
    this.brackets = null;
    if (this.gfm.autolink) linkEmails(root);
    return root;
  }

  private reset(subject: string): void {
    this.subject = subject;
    this.pos = 0;
    this.delimiters = null;
    this.brackets = null;
    this.next = new NextIndex(subject);
    this.ticks = null;
    this.budget = 4 * subject.length + 4096;
  }

  private peek(at = this.pos): number {
    return at < this.subject.length ? this.subject.charCodeAt(at) : -1;
  }

  private text(parent: InlineNode, value: string): InlineNode {
    const node = inlineNode('text', value);
    append(parent, node);
    return node;
  }

  private parseInline(parent: InlineNode): void {
    const c = this.peek();
    let handled = false;
    switch (c) {
      case C_NEWLINE:
        handled = this.parseNewline(parent);
        break;
      case C_BACKSLASH:
        handled = this.parseBackslash(parent);
        break;
      case C_BACKTICK:
        handled = this.parseBackticks(parent);
        break;
      case C_ASTERISK:
      case C_UNDERSCORE:
        handled = this.handleDelim(c, parent);
        break;
      case C_OPEN_BRACKET:
        handled = this.parseOpenBracket(parent);
        break;
      case C_BANG:
        handled = this.parseBang(parent);
        break;
      case C_CLOSE_BRACKET:
        handled = this.parseCloseBracket(parent);
        break;
      case C_LESSTHAN:
        handled = this.parseAutolink(parent) || this.parseHtmlTag(parent);
        break;
      case C_AMPERSAND:
        handled = this.parseEntity(parent);
        break;
      case C_TILDE:
        handled = this.gfm.strikethrough && this.handleDelim(c, parent);
        break;
      case C_W:
        handled = this.gfm.autolink && this.parseWww(parent);
        break;
      case C_COLON:
        handled = this.gfm.autolink && this.parseUrl(parent);
        break;
      default:
        handled = this.parseString(parent);
    }
    if (!handled) {
      this.pos++;
      this.text(parent, String.fromCharCode(c));
    }
  }

  /** Whether `c` at `i` may start something other than plain text. */
  private stopsText(c: number, i: number): boolean {
    if (isSpecial(c)) return true;
    if (c === C_TILDE) return this.gfm.strikethrough;
    if (!this.gfm.autolink) return false;
    if (c === C_W) return autolinkBoundary(this.subject, i) && this.subject.startsWith('www.', i);
    if (c === C_COLON) return this.subject.startsWith('://', i);
    return false;
  }

  /** A GFM `www.` autolink at `pos`. */
  private parseWww(parent: InlineNode): boolean {
    // Like cmark-gfm: no extended autolink while a link or image bracket is open.
    if (this.brackets !== null || !autolinkBoundary(this.subject, this.pos)) return false;
    const end = wwwAutolinkEnd(this.subject, this.pos);
    if (end === 0) return false;
    const text = this.subject.slice(this.pos, end);
    const node = inlineNode('link');
    node.url = `http://${text}`;
    append(node, literalText(text));
    append(parent, node);
    this.pos = end;
    return true;
  }

  /** A GFM `http://`, `https://` or `ftp://` autolink whose `:` is at `pos`. */
  private parseUrl(parent: InlineNode): boolean {
    if (this.brackets !== null) return false;
    const found = urlAutolink(this.subject, this.pos);
    if (!found) return false;
    // The scheme was read as text just before: take it back from the last text node.
    const scheme = this.pos - found.start;
    const last = parent.last;
    if (last?.kind !== 'text' || last.literal || last.value.length < scheme) return false;
    if (
      last.value.slice(-scheme).toLowerCase() !==
      this.subject.slice(found.start, this.pos).toLowerCase()
    )
      return false;
    last.value = last.value.slice(0, -scheme);
    if (last.value === '') unlink(last);
    const text = this.subject.slice(found.start, found.end);
    const node = inlineNode('link');
    node.url = text;
    append(node, literalText(text));
    append(parent, node);
    this.pos = found.end;
    return true;
  }

  private parseString(parent: InlineNode): boolean {
    const start = this.pos;
    let i = start;
    while (i < this.subject.length && !this.stopsText(this.subject.charCodeAt(i), i)) i++;
    if (i === start) return false;
    this.pos = i;
    this.text(parent, this.subject.slice(start, i));
    return true;
  }

  private parseNewline(parent: InlineNode): boolean {
    this.pos++;
    const last = parent.last;
    if (last && last.kind === 'text' && last.value.endsWith(' ')) {
      let end = last.value.length;
      while (end > 0 && last.value.charCodeAt(end - 1) === 0x20) end--;
      const hard = last.value.length - end >= 2;
      last.value = last.value.slice(0, end);
      append(parent, inlineNode(hard ? 'linebreak' : 'softbreak'));
    } else append(parent, inlineNode('softbreak'));
    while (this.peek() === 0x20) this.pos++;
    return true;
  }

  private parseBackslash(parent: InlineNode): boolean {
    this.pos++;
    const c = this.peek();
    if (c === C_NEWLINE) {
      this.pos++;
      append(parent, inlineNode('linebreak'));
    } else if (c !== -1 && isAsciiPunctuation(c)) {
      this.text(parent, this.subject.charAt(this.pos)).literal = true;
      this.pos++;
    } else this.text(parent, '\\');
    return true;
  }

  private indexTicks(): Map<number, { starts: number[]; cursor: number }> {
    const runs = new Map<number, { starts: number[]; cursor: number }>();
    const s = this.subject;
    let i = 0;
    while (i < s.length) {
      if (s.charCodeAt(i) !== C_BACKTICK) {
        i++;
        continue;
      }
      const start = i;
      while (s.charCodeAt(i) === C_BACKTICK) i++;
      const length = i - start;
      let entry = runs.get(length);
      if (!entry) {
        entry = { starts: [], cursor: 0 };
        runs.set(length, entry);
      }
      entry.starts.push(start);
    }
    return runs;
  }

  private parseBackticks(parent: InlineNode): boolean {
    const start = this.pos;
    let i = start;
    while (this.peek(i) === C_BACKTICK) i++;
    const length = i - start;
    this.ticks ??= this.indexTicks();
    const entry = this.ticks.get(length);
    let close = -1;
    if (entry) {
      while (entry.cursor < entry.starts.length && (entry.starts[entry.cursor] as number) < i)
        entry.cursor++;
      if (entry.cursor < entry.starts.length) close = entry.starts[entry.cursor] as number;
    }
    if (close < 0) {
      this.pos = i;
      this.text(parent, this.subject.slice(start, i));
      return true;
    }
    let contents = this.subject.slice(i, close).replace(/\n/g, ' ');
    // One space is stripped from each side when both are spaces and not every character is.
    if (
      contents.length >= 2 &&
      contents.charCodeAt(0) === 0x20 &&
      contents.charCodeAt(contents.length - 1) === 0x20 &&
      /[^ ]/.test(contents)
    )
      contents = contents.slice(1, -1);
    append(parent, inlineNode('code', contents));
    this.pos = close + length;
    return true;
  }

  private handleDelim(cc: number, parent: InlineNode): boolean {
    const start = this.pos;
    let i = start;
    while (this.peek(i) === cc) i++;
    const count = i - start;
    const s = this.subject;
    const afterWhite = whitespaceAround(s, i, false);
    const afterPunct = punctuationAround(s, i, false);
    const beforeWhite = whitespaceAround(s, start, true);
    const beforePunct = punctuationAround(s, start, true);
    const left = !afterWhite && (!afterPunct || beforeWhite || beforePunct);
    const right = !beforeWhite && (!beforePunct || afterWhite || afterPunct);
    let canOpen: boolean;
    let canClose: boolean;
    if (cc === C_UNDERSCORE) {
      canOpen = left && (!right || beforePunct);
      canClose = right && (!left || afterPunct);
    } else {
      canOpen = left;
      canClose = right;
    }
    this.pos = i;
    const node = this.text(parent, s.slice(start, i));
    // GFM strikethrough takes runs of one or two tildes.
    if ((canOpen || canClose) && (cc !== C_TILDE || count <= 2)) {
      const delimiter: Delimiter = {
        cc,
        numdelims: count,
        origdelims: count,
        node,
        previous: this.delimiters,
        next: null,
        canOpen,
        canClose,
      };
      if (delimiter.previous) delimiter.previous.next = delimiter;
      this.delimiters = delimiter;
    }
    return true;
  }

  private removeDelimiter(delimiter: Delimiter): void {
    if (delimiter.previous) delimiter.previous.next = delimiter.next;
    if (delimiter.next) delimiter.next.previous = delimiter.previous;
    else this.delimiters = delimiter.previous;
  }

  private processEmphasis(bottom: Delimiter | null): void {
    const openersBottom: (Delimiter | null)[] = new Array(16).fill(bottom);
    let closer = this.delimiters;
    while (closer !== null && closer.previous !== bottom) closer = closer.previous;
    while (closer !== null) {
      if (!closer.canClose) {
        closer = closer.next;
        continue;
      }
      const tilde = closer.cc === C_TILDE;
      const index = tilde
        ? 12 + (closer.canOpen ? 2 : 0) + (closer.origdelims - 1)
        : (closer.cc === C_UNDERSCORE ? 0 : 6) + (closer.canOpen ? 3 : 0) + (closer.origdelims % 3);
      let opener = closer.previous;
      let found = false;
      while (opener !== null && opener !== bottom && opener !== openersBottom[index]) {
        const odd = tilde
          ? opener.origdelims !== closer.origdelims
          : (closer.canOpen || opener.canClose) &&
            closer.origdelims % 3 !== 0 &&
            (opener.origdelims + closer.origdelims) % 3 === 0;
        if (opener.cc === closer.cc && opener.canOpen && !odd) {
          found = true;
          break;
        }
        opener = opener.previous;
      }
      const oldCloser = closer;
      if (!found || opener === null) {
        closer = closer.next;
        openersBottom[index] = oldCloser.previous;
        if (!oldCloser.canOpen) this.removeDelimiter(oldCloser);
        continue;
      }
      const use = tilde ? closer.numdelims : closer.numdelims >= 2 && opener.numdelims >= 2 ? 2 : 1;
      const openerNode = opener.node;
      const closerNode = closer.node;
      opener.numdelims -= use;
      closer.numdelims -= use;
      openerNode.value = openerNode.value.slice(0, openerNode.value.length - use);
      closerNode.value = closerNode.value.slice(0, closerNode.value.length - use);
      const emph = inlineNode(tilde ? 'delete' : use === 1 ? 'emph' : 'strong');
      let tmp = openerNode.next;
      while (tmp && tmp !== closerNode) {
        const following: InlineNode | null = tmp.next;
        append(emph, tmp);
        tmp = following;
      }
      insertAfter(openerNode, emph);
      // Remove the delimiters between opener and closer.
      if (closer.previous !== opener) {
        opener.next = closer;
        closer.previous = opener;
      }
      if (opener.numdelims === 0) {
        unlink(openerNode);
        this.removeDelimiter(opener);
      }
      if (closer.numdelims === 0) {
        unlink(closerNode);
        const following = closer.next;
        this.removeDelimiter(closer);
        closer = following;
      }
    }
    while (this.delimiters !== null && this.delimiters !== bottom)
      this.removeDelimiter(this.delimiters);
  }

  private addBracket(node: InlineNode, index: number, image: boolean): void {
    if (this.brackets) this.brackets.bracketAfter = true;
    this.brackets = {
      node,
      previous: this.brackets,
      previousDelimiter: this.delimiters,
      index,
      image,
      active: true,
      bracketAfter: false,
    };
  }

  private parseOpenBracket(parent: InlineNode): boolean {
    const start = this.pos;
    this.pos++;
    this.addBracket(this.text(parent, '['), start, false);
    return true;
  }

  private parseBang(parent: InlineNode): boolean {
    const start = this.pos;
    this.pos++;
    if (this.peek() === C_OPEN_BRACKET) {
      this.pos++;
      this.addBracket(this.text(parent, '!['), start + 1, true);
    } else this.text(parent, '!');
    return true;
  }

  /** Skip spaces or tabs with at most one line ending. */
  private spnl(): void {
    while (this.peek() === 0x20 || this.peek() === 0x09) this.pos++;
    if (this.peek() === C_NEWLINE) {
      this.pos++;
      while (this.peek() === 0x20 || this.peek() === 0x09) this.pos++;
    }
  }

  /** A link destination at `pos` (decoded), or `null`; advances `pos` past it on success. */
  parseLinkDestination(): string | null {
    const s = this.subject;
    if (this.peek() === C_LESSTHAN) {
      let i = this.pos + 1;
      while (i < s.length) {
        const c = s.charCodeAt(i);
        if (c === C_BACKSLASH && i + 1 < s.length && isAsciiPunctuation(s.charCodeAt(i + 1)))
          i += 2;
        else if (c === 0x3e) {
          const raw = s.slice(this.pos + 1, i);
          this.pos = i + 1;
          return unescapeString(raw);
        } else if (c === C_LESSTHAN || c === C_NEWLINE) return null;
        else i++;
      }
      return null;
    }
    const start = this.pos;
    let i = start;
    let parens = 0;
    while (i < s.length) {
      const c = s.charCodeAt(i);
      if (c === C_BACKSLASH && i + 1 < s.length && isAsciiPunctuation(s.charCodeAt(i + 1))) i += 2;
      else if (c === C_OPEN_PAREN) {
        parens++;
        i++;
      } else if (c === C_CLOSE_PAREN) {
        if (parens < 1) break;
        parens--;
        i++;
      } else if (c <= 0x20 || c === 0x7f) break;
      else i++;
      if (this.budget <= 0) return null;
    }
    if ((i === start && this.peek(i) !== C_CLOSE_PAREN) || parens !== 0) {
      this.budget -= i - start;
      return null;
    }
    this.pos = i;
    return unescapeString(s.slice(start, i));
  }

  /** A link title at `pos` (decoded), or `null`. */
  parseLinkTitle(): string | null {
    const s = this.subject;
    const open = this.peek();
    const close = open === C_OPEN_PAREN ? C_CLOSE_PAREN : open;
    if (open !== 0x22 && open !== 0x27 && open !== C_OPEN_PAREN) return null;
    let i = this.pos + 1;
    while (i < s.length) {
      const c = s.charCodeAt(i);
      if (c === C_BACKSLASH && i + 1 < s.length) i += 2;
      else if (c === close) {
        const raw = s.slice(this.pos + 1, i);
        this.pos = i + 1;
        return unescapeString(raw);
      } else if (open === C_OPEN_PAREN && c === C_OPEN_PAREN) return null;
      else i++;
    }
    return null;
  }

  /** Length of a link label at `pos` (with brackets), or 0. */
  parseLinkLabel(): number {
    const s = this.subject;
    if (this.peek() !== C_OPEN_BRACKET) return 0;
    let i = this.pos + 1;
    while (i < s.length && i - this.pos - 1 <= MAX_LABEL) {
      const c = s.charCodeAt(i);
      if (c === C_BACKSLASH && i + 1 < s.length && isAsciiPunctuation(s.charCodeAt(i + 1))) i += 2;
      else if (c === C_OPEN_BRACKET) return 0;
      else if (c === C_CLOSE_BRACKET) {
        if (i - this.pos - 1 > MAX_LABEL) return 0;
        // `[]` (length 2) is a collapsed reference; a blank label never matches a definition.
        const length = i + 1 - this.pos;
        this.pos = i + 1;
        return length;
      } else i++;
    }
    return 0;
  }

  private parseCloseBracket(parent: InlineNode): boolean {
    this.pos++;
    const start = this.pos;
    const opener = this.brackets;
    if (opener === null) {
      this.text(parent, ']');
      return true;
    }
    if (!opener.active) {
      this.text(parent, ']');
      this.brackets = opener.previous;
      return true;
    }
    let matched = false;
    let url: string | null = null;
    let title: string | null = null;
    // An inline link: `(` destination title `)`.
    if (this.peek() === C_OPEN_PAREN) {
      this.pos++;
      this.spnl();
      url = this.parseLinkDestination();
      if (url !== null) {
        this.spnl();
        const c = this.subject.charCodeAt(this.pos - 1);
        if (c === 0x20 || c === 0x09 || c === C_NEWLINE) title = this.parseLinkTitle();
        this.spnl();
        if (this.peek() === C_CLOSE_PAREN) {
          this.pos++;
          matched = true;
        }
      }
      if (!matched) {
        this.pos = start;
        title = null;
      }
    }
    if (!matched) {
      // A reference link: full, collapsed or shortcut.
      const before = this.pos;
      const n = this.parseLinkLabel();
      let label: string | undefined;
      if (n > 2) label = this.subject.slice(before, before + n);
      else if (!opener.bracketAfter && start - opener.index <= MAX_LABEL + 2)
        label = this.subject.slice(opener.index, start);
      if (n === 0) this.pos = start;
      if (label !== undefined) {
        const found = this.refmap.get(normalizeLabel(label.slice(1, -1)));
        if (found) {
          url = found.url;
          title = found.title ?? null;
          matched = true;
        }
      }
    }
    if (!matched && this.gfm.footnote && this.footnoteReference(opener, start)) return true;
    if (!matched) {
      this.brackets = opener.previous;
      this.pos = start;
      this.text(parent, ']');
      return true;
    }
    const node = inlineNode(opener.image ? 'image' : 'link');
    node.url = url ?? '';
    if (title) node.title = title;
    let tmp = opener.node.next;
    while (tmp) {
      const following: InlineNode | null = tmp.next;
      append(node, tmp);
      tmp = following;
    }
    append(parent, node);
    this.processEmphasis(opener.previousDelimiter);
    this.brackets = opener.previous;
    unlink(opener.node);
    // No links in links: deactivate earlier link openers (stop at one already inactive).
    if (!opener.image) {
      let earlier = this.brackets;
      while (earlier !== null) {
        if (!earlier.image) {
          if (!earlier.active) break;
          earlier.active = false;
        }
        earlier = earlier.previous;
      }
    }
    return true;
  }

  /**
   * GFM footnote reference: `[^label]` whose label has a definition becomes a reference; what
   * was parsed inside the brackets is dropped. After `!` the `!` stays text, as in cmark-gfm.
   */
  private footnoteReference(opener: Bracket, start: number): boolean {
    if (this.subject.charCodeAt(opener.index + 1) !== 0x5e) return false;
    const raw = this.subject.slice(opener.index + 2, start - 1);
    if (raw === '' || raw.length > MAX_LABEL) return false;
    const label = this.footnotes.get(normalizeLabel(raw));
    if (label === undefined) return false;
    // Drop the delimiters and nodes opened inside the brackets.
    while (this.delimiters !== null && this.delimiters !== opener.previousDelimiter)
      this.removeDelimiter(this.delimiters);
    while (opener.node.next) unlink(opener.node.next);
    const node = inlineNode('footnoteReference', label);
    if (opener.image) {
      opener.node.value = '!';
      insertAfter(opener.node, node);
    } else {
      insertAfter(opener.node, node);
      unlink(opener.node);
    }
    this.brackets = opener.previous;
    this.pos = start;
    return true;
  }

  private parseAutolink(parent: InlineNode): boolean {
    EMAIL_AUTOLINK.lastIndex = this.pos;
    let m = EMAIL_AUTOLINK.exec(this.subject);
    if (m) {
      const address = m[1] as string;
      const node = inlineNode('link');
      node.url = `mailto:${address}`;
      append(node, inlineNode('text', address));
      append(parent, node);
      this.pos += m[0].length;
      return true;
    }
    URI_AUTOLINK.lastIndex = this.pos;
    m = URI_AUTOLINK.exec(this.subject);
    if (m) {
      const target = m[0].slice(1, -1);
      const node = inlineNode('link');
      node.url = target;
      append(node, inlineNode('text', target));
      append(parent, node);
      this.pos += m[0].length;
      return true;
    }
    return false;
  }

  private parseHtmlTag(parent: InlineNode): boolean {
    const length = htmlTagLength(this.subject, this.pos, this.next);
    if (length === 0) return false;
    append(parent, inlineNode('html', this.subject.slice(this.pos, this.pos + length)));
    this.pos += length;
    return true;
  }

  private parseEntity(parent: InlineNode): boolean {
    const length = entityLength(this.subject, this.pos);
    if (length === 0) return false;
    this.text(parent, decodeEntity(this.subject.slice(this.pos, this.pos + length))).literal = true;
    this.pos += length;
    return true;
  }

  /**
   * Parse link reference definitions at the start of `text` (a paragraph's raw content) into the
   * map (the first definition of a label wins). Returns each definition found and where the
   * remaining content starts.
   */
  parseReferences(text: string): {
    readonly definitions: { label: string; url: string; title?: string }[];
    /** Where each definition ends (an offset into `text`). */
    readonly ends: number[];
    readonly rest: number;
  } {
    this.reset(text);
    const definitions: { label: string; url: string; title?: string }[] = [];
    const ends: number[] = [];
    while (this.peek() === C_OPEN_BRACKET) {
      const start = this.pos;
      const found = this.parseReference();
      if (!found) {
        this.pos = start;
        break;
      }
      definitions.push(found);
      ends.push(this.pos);
    }
    return { definitions, ends, rest: this.pos };
  }

  private atLineEnd(): boolean {
    let i = this.pos;
    while (this.peek(i) === 0x20 || this.peek(i) === 0x09) i++;
    const c = this.peek(i);
    if (c === C_NEWLINE || c === -1) {
      this.pos = c === -1 ? i : i + 1;
      return true;
    }
    return false;
  }

  private parseReference(): { label: string; url: string; title?: string } | null {
    const start = this.pos;
    const n = this.parseLinkLabel();
    if (n === 0) return null;
    const raw = this.subject.slice(start + 1, start + n - 1);
    if (this.peek() !== C_COLON) return null;
    this.pos++;
    this.spnl();
    const opensAngle = this.peek() === C_LESSTHAN;
    const url = this.parseLinkDestination();
    if (url === null || (url === '' && !opensAngle)) return null;
    const beforeTitle = this.pos;
    this.spnl();
    let title: string | null = null;
    if (this.pos !== beforeTitle) title = this.parseLinkTitle();
    if (title === null) this.pos = beforeTitle;
    if (!this.atLineEnd()) {
      if (title === null) return null;
      title = null;
      this.pos = beforeTitle;
      if (!this.atLineEnd()) return null;
    }
    const label = normalizeLabel(raw);
    if (label === '') return null;
    if (!this.refmap.has(label)) this.refmap.set(label, title === null ? { url } : { url, title });
    return title === null ? { label, url } : { label, url, title };
  }
}

function literalText(value: string): InlineNode {
  const node = inlineNode('text', value);
  node.literal = true;
  return node;
}

/**
 * GFM post-pass: link emails, `mailto:` and `xmpp:` addresses in runs of plain text (escaped and
 * referenced characters break a run), outside links and images. Iterative.
 */
function linkEmails(root: InlineNode): void {
  const stack: InlineNode[] = [root];
  while (stack.length > 0) {
    const parent = stack.pop() as InlineNode;
    let node = parent.first;
    while (node !== null) {
      if (node.kind !== 'text' || node.literal) {
        if (node.first && node.kind !== 'link' && node.kind !== 'image') stack.push(node);
        node = node.next;
        continue;
      }
      // A run of plain text nodes.
      const first = node;
      let value = '';
      let last = node;
      for (
        let run: InlineNode | null = node;
        run !== null && run.kind === 'text' && !run.literal;
        run = run.next
      ) {
        value += run.value;
        last = run;
      }
      const after = last.next;
      const pieces = value.indexOf('@') < 0 ? null : emailAutolinks(value);
      if (pieces) {
        let anchor: InlineNode | null = first.prev;
        for (let run: InlineNode | null = first; run !== after; ) {
          const next: InlineNode | null = run?.next ?? null;
          if (run) unlink(run);
          run = next;
        }
        for (const piece of pieces) {
          let created: InlineNode;
          if (piece.kind === 'text') created = inlineNode('text', piece.value);
          else {
            created = inlineNode('link');
            created.url = piece.url;
            append(created, literalText(piece.value));
          }
          if (anchor) insertAfter(anchor, created);
          else if (parent.first) {
            // Insert before the first child.
            const head = parent.first;
            created.parent = parent;
            created.next = head;
            head.prev = created;
            parent.first = created;
          } else append(parent, created);
          anchor = created;
        }
      }
      node = after;
    }
  }
}

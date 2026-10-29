/**
 * Escaped markup builders (ADR-016): typed element and text nodes that
 * serialize to XML or HTML. Content only enters through these nodes, so
 * there is no raw-markup API: every text and attribute value is escaped,
 * element and attribute names are checked, and URL-valued HTML attributes
 * accept only a `MarkupUrl` made by `linkUrl` or `imageUrl`, which call the
 * URL policy with an explicit tier. Serialization is iterative and linear in
 * the size of the tree.
 */
import { type HrefTrust, safeHref } from '../url/safe-href.ts';
import { safeImageSrc } from '../url-policy/safe-image-src.ts';

export interface MarkupText {
  readonly kind: 'text';
  readonly value: string;
}

/** A URL that passed the URL policy. Only `linkUrl` and `imageUrl` make one the serializers accept. */
export interface MarkupUrl {
  readonly kind: 'url';
  readonly value: string;
}

export type MarkupAttributeValue = string | number | boolean | MarkupUrl | null | undefined;
export type MarkupAttribute = readonly [string, string | boolean | MarkupUrl];

export interface MarkupElement {
  readonly kind: 'element';
  readonly name: string;
  readonly attributes: readonly MarkupAttribute[];
  readonly children: readonly MarkupNode[];
}

export type MarkupNode = MarkupElement | MarkupText;

/** A child: a node, a string or number (escaped text), a nested list, or a skipped `null`, `undefined` or `false`. */
export type MarkupChild =
  | MarkupNode
  | string
  | number
  | null
  | undefined
  | false
  | readonly MarkupChild[];

export interface XmlSerializeOptions {
  /** Prefix the UTF-8 declaration (`standalone="yes"`, as Office packages use). Default true. */
  declaration?: boolean;
  /** An allowlist for element and attribute names, on top of the XML name grammar. */
  allow?: (name: string, what: 'element' | 'attribute') => boolean;
}

export interface HtmlSerializeOptions {
  /** Prefix `<!doctype html>`. Default false. */
  doctype?: boolean;
}

const XML_NAME = /^[A-Za-z_][A-Za-z0-9._-]*(?::[A-Za-z_][A-Za-z0-9._-]*)?$/;
const HTML_NAME = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const HTML_ATTRIBUTE = /^[a-z][a-z0-9]*(?:[-:][a-z0-9]+)*$/;

/**
 * The HTML elements `serializeHtml` writes: document structure, text,
 * lists, tables, links and images. No scripts, styles, frames, objects,
 * forms, templates, SVG or MathML.
 */
export const HTML_ELEMENTS: ReadonlySet<string> = new Set(
  (
    'html head body title meta main article section header footer nav aside div span p br hr ' +
    'h1 h2 h3 h4 h5 h6 strong b em i u s del ins code pre kbd samp small sub sup mark blockquote ' +
    'q cite abbr time ul ol li dl dt dd a img figure figcaption table caption thead tbody tfoot ' +
    'tr th td colgroup col center font address details summary wbr'
  ).split(' ')
);

/** HTML elements written without children or an end tag. */
const HTML_VOID = new Set(['br', 'hr', 'img', 'meta', 'col', 'wbr']);

/** HTML attributes that hold a URL: only a `MarkupUrl` value is written. */
export const HTML_URL_ATTRIBUTES: ReadonlySet<string> = new Set(
  (
    'href src srcset action formaction poster cite data background xlink:href ping manifest ' +
    'codebase longdesc usemap lowsrc dynsrc'
  ).split(' ')
);

/** HTML attributes no output carries: event handlers are refused by prefix, these by name. */
const HTML_DENIED_ATTRIBUTES = new Set(['srcdoc', 'http-equiv', 'is', 'nonce']);

const urls = new WeakSet<object>();

function makeUrl(value: string | undefined): MarkupUrl | null {
  if (value === undefined) return null;
  const url: MarkupUrl = Object.freeze({ kind: 'url', value });
  urls.add(url);
  return url;
}

/** A link URL through `safeHref` at `trust`, or `null` when the policy refuses it. */
export function linkUrl(value: string, trust: HrefTrust): MarkupUrl | null {
  return makeUrl(safeHref(value, trust));
}

/** An image URL through `safeImageSrc` at `trust`, or `null` when the policy refuses it. */
export function imageUrl(value: string, trust: HrefTrust): MarkupUrl | null {
  return makeUrl(safeImageSrc(value, trust));
}

/** True only for a URL `linkUrl` or `imageUrl` made (a hand-built object is not one). */
export function isMarkupUrl(value: unknown): value is MarkupUrl {
  return typeof value === 'object' && value !== null && urls.has(value);
}

/**
 * Drop characters XML 1.0 cannot carry: C0 controls other than tab,
 * newline and carriage return, U+FFFE and U+FFFF, and unpaired surrogates.
 */
export function sanitizeMarkupChars(value: string): string {
  // Fast path: most text has nothing to drop.
  // biome-ignore lint/suspicious/noControlCharactersInRegex: matching the controls is the point.
  if (!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ud800-\udfff￾￿]/.test(value)) return value;
  let out = '';
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    if (code === 0x09 || code === 0x0a || code === 0x0d) out += character;
    else if (code < 0x20 || code === 0xfffe || code === 0xffff) continue;
    else if (code >= 0xd800 && code <= 0xdfff) continue;
    else out += character;
  }
  return out;
}

export function escapeMarkupText(value: string): string {
  return sanitizeMarkupChars(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function escapeMarkupAttribute(value: string): string {
  return escapeMarkupText(value)
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .replace(/\t/g, '&#9;')
    .replace(/\n/g, '&#10;')
    .replace(/\r/g, '&#13;');
}

export function text(value: string | number): MarkupText {
  return { kind: 'text', value: String(value) };
}

function pushChildren(out: MarkupNode[], children: readonly MarkupChild[]): void {
  // Iterative flattening, so a deeply nested child list cannot overflow the stack.
  const stack: (readonly MarkupChild[] | number)[] = [children, 0];
  while (stack.length > 0) {
    const index = stack.pop() as number;
    const list = stack.pop() as readonly MarkupChild[];
    if (index >= list.length) continue;
    stack.push(list, index + 1);
    const child = list[index];
    if (child === null || child === undefined || child === false) continue;
    if (Array.isArray(child)) stack.push(child, 0);
    else if (typeof child === 'string' || typeof child === 'number') out.push(text(child));
    else out.push(child as MarkupNode);
  }
}

function assertXmlName(name: string, what: string): void {
  if (typeof name !== 'string' || !XML_NAME.test(name)) {
    throw new TypeError(`Invalid markup ${what} name: ${JSON.stringify(name)}`);
  }
}

/** Build an element. String and number children become escaped text; nullish and `false` children are skipped. */
export function el(
  name: string,
  attributes: Readonly<Record<string, MarkupAttributeValue>> = {},
  ...children: MarkupChild[]
): MarkupElement {
  assertXmlName(name, 'element');
  const attrs: MarkupAttribute[] = [];
  for (const key of Object.keys(attributes)) {
    const value = attributes[key];
    if (value === undefined || value === null) continue;
    assertXmlName(key, 'attribute');
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) throw new TypeError(`Attribute ${key} must be a finite number.`);
      attrs.push([key, String(value)]);
    } else if (typeof value === 'object') {
      if (!isMarkupUrl(value))
        throw new TypeError(`Attribute ${key} holds an unchecked URL object.`);
      attrs.push([key, value]);
    } else attrs.push([key, value]);
  }
  const nodes: MarkupNode[] = [];
  pushChildren(nodes, children);
  return { kind: 'element', name, attributes: attrs, children: nodes };
}

type Frame = { node: MarkupElement; index: number };

function walk(
  root: MarkupNode,
  open: (node: MarkupElement) => string,
  close: (node: MarkupElement) => string,
  leaf: (node: MarkupText) => string
): string {
  if (root.kind === 'text') return leaf(root);
  const parts: string[] = [open(root)];
  const stack: Frame[] = [{ node: root, index: 0 }];
  while (stack.length > 0) {
    const frame = stack[stack.length - 1] as Frame;
    const child = frame.node.children[frame.index];
    if (child === undefined) {
      parts.push(close(frame.node));
      stack.pop();
      continue;
    }
    frame.index += 1;
    if (child.kind === 'text') parts.push(leaf(child));
    else if (child.kind === 'element') {
      parts.push(open(child));
      stack.push({ node: child, index: 0 });
    } else throw new TypeError('Unknown markup node.');
  }
  return parts.join('');
}

/** Serialize to XML: booleans become `1` and `0` (the Office convention); childless elements self-close. */
export function serializeXml(root: MarkupElement, options: XmlSerializeOptions = {}): string {
  const allow = options.allow;
  const check = (name: string, what: 'element' | 'attribute') => {
    assertXmlName(name, what);
    if (allow && !allow(name, what)) {
      throw new TypeError(`Markup ${what} not allowed: ${JSON.stringify(name)}`);
    }
  };
  const body = walk(
    root,
    (node) => {
      // Re-check names, so a hand-built node object cannot smuggle markup.
      check(node.name, 'element');
      let out = `<${node.name}`;
      for (const [key, value] of node.attributes) {
        check(key, 'attribute');
        const raw =
          typeof value === 'boolean' ? (value ? '1' : '0') : xmlValue(value as string | MarkupUrl);
        out += ` ${key}="${escapeMarkupAttribute(raw)}"`;
      }
      return node.children.length === 0 ? `${out}/>` : `${out}>`;
    },
    (node) => (node.children.length === 0 ? '' : `</${node.name}>`),
    (node) => escapeMarkupText(String(node.value))
  );
  return options.declaration === false
    ? body
    : `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n${body}`;
}

function xmlValue(value: string | MarkupUrl): string {
  if (typeof value === 'string') return value;
  if (!isMarkupUrl(value)) throw new TypeError('Unchecked URL object in markup.');
  return value.value;
}

function htmlAttribute(name: string, value: string | boolean | MarkupUrl): string {
  if (!HTML_ATTRIBUTE.test(name) || name.startsWith('on') || HTML_DENIED_ATTRIBUTES.has(name)) {
    throw new TypeError(`HTML attribute not allowed: ${JSON.stringify(name)}`);
  }
  if (HTML_URL_ATTRIBUTES.has(name)) {
    if (!isMarkupUrl(value)) {
      throw new TypeError(`HTML attribute ${name} takes a URL from linkUrl or imageUrl.`);
    }
    return ` ${name}="${escapeMarkupAttribute(value.value)}"`;
  }
  if (typeof value === 'boolean') return value ? ` ${name}` : '';
  if (typeof value !== 'string') throw new TypeError(`HTML attribute ${name} is not text.`);
  return ` ${name}="${escapeMarkupAttribute(value)}"`;
}

/**
 * Serialize to HTML: only `HTML_ELEMENTS`, no event handler or `srcdoc`
 * attributes, URL attributes only from `linkUrl` or `imageUrl`, booleans as
 * bare attributes, and void elements without an end tag.
 */
export function serializeHtml(root: MarkupElement, options: HtmlSerializeOptions = {}): string {
  const body = walk(
    root,
    (node) => {
      if (!HTML_NAME.test(node.name) || !HTML_ELEMENTS.has(node.name)) {
        throw new TypeError(`HTML element not allowed: ${JSON.stringify(node.name)}`);
      }
      if (HTML_VOID.has(node.name) && node.children.length > 0) {
        throw new TypeError(`HTML element ${node.name} takes no children.`);
      }
      let out = `<${node.name}`;
      for (const [key, value] of node.attributes) out += htmlAttribute(key, value);
      return `${out}>`;
    },
    (node) => (HTML_VOID.has(node.name) ? '' : `</${node.name}>`),
    (node) => escapeMarkupText(String(node.value))
  );
  return options.doctype ? `<!doctype html>${body}` : body;
}

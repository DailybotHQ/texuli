/**
 * A minimal XML writer for export packages. Content only enters through
 * typed nodes: every text and attribute value is escaped, element and
 * attribute names are checked, and there is no raw-markup API.
 */
export interface XmlElement {
  readonly kind: 'element';
  readonly name: string;
  readonly attributes: readonly (readonly [string, string])[];
  readonly children: readonly XmlNode[];
}

export interface XmlText {
  readonly kind: 'text';
  readonly value: string;
}

export type XmlNode = XmlElement | XmlText;
export type XmlAttributeValue = string | number | boolean | null | undefined;
export type XmlChild = XmlNode | string | null | undefined | false;

const NAME = /^[A-Za-z_][A-Za-z0-9._-]*(?::[A-Za-z_][A-Za-z0-9._-]*)?$/;

function assertName(name: string, what: string): void {
  if (!NAME.test(name)) throw new TypeError(`Invalid XML ${what} name: ${JSON.stringify(name)}`);
}

/**
 * Drop characters XML 1.0 cannot carry: C0 controls other than tab, newline
 * and carriage return, U+FFFE/U+FFFF, and unpaired surrogates.
 */
export function sanitizeXmlChars(value: string): string {
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

export function escapeXmlText(value: string): string {
  return sanitizeXmlChars(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function escapeXmlAttribute(value: string): string {
  return escapeXmlText(value)
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .replace(/\t/g, '&#9;')
    .replace(/\n/g, '&#10;')
    .replace(/\r/g, '&#13;');
}

export function xmlText(value: string): XmlText {
  return { kind: 'text', value: String(value) };
}

/** Build an element. String children become escaped text; nullish and `false` children are skipped. */
export function el(
  name: string,
  attributes: Readonly<Record<string, XmlAttributeValue>> = {},
  ...children: XmlChild[]
): XmlElement {
  assertName(name, 'element');
  const attrs: (readonly [string, string])[] = [];
  for (const [key, value] of Object.entries(attributes)) {
    if (value === undefined || value === null) continue;
    assertName(key, 'attribute');
    if (typeof value === 'number' && !Number.isFinite(value)) {
      throw new TypeError(`XML attribute ${key} must be a finite number.`);
    }
    attrs.push([key, typeof value === 'boolean' ? (value ? '1' : '0') : String(value)]);
  }
  const nodes: XmlNode[] = [];
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    nodes.push(typeof child === 'string' ? xmlText(child) : child);
  }
  return { kind: 'element', name, attributes: attrs, children: nodes };
}

function serializeNode(node: XmlNode): string {
  if (node.kind === 'text') return escapeXmlText(node.value);
  // Re-check names so a hand-built node object cannot smuggle markup.
  assertName(node.name, 'element');
  let out = `<${node.name}`;
  for (const [key, value] of node.attributes) {
    assertName(key, 'attribute');
    out += ` ${key}="${escapeXmlAttribute(value)}"`;
  }
  if (node.children.length === 0) return `${out}/>`;
  out += '>';
  for (const child of node.children) out += serializeNode(child);
  return `${out}</${node.name}>`;
}

/** Serialize a document with the standalone UTF-8 declaration Office packages use. */
export function serializeXml(root: XmlElement): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n${serializeNode(root)}`;
}

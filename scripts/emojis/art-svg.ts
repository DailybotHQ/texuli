export interface SvgValidation {
  readonly nodeCount: number;
  readonly bytes: number;
  readonly viewBox: '0 0 64 64';
  readonly title: string;
}

const ELEMENTS = new Set([
  'svg',
  'title',
  'g',
  'circle',
  'rect',
  'ellipse',
  'line',
  'polygon',
  'polyline',
  'path',
]);
const ATTRIBUTES = new Set([
  'xmlns',
  'viewBox',
  'width',
  'height',
  'x',
  'y',
  'x1',
  'y1',
  'x2',
  'y2',
  'cx',
  'cy',
  'r',
  'rx',
  'ry',
  'd',
  'points',
  'fill',
  'stroke',
  'stroke-width',
  'stroke-linecap',
  'stroke-linejoin',
  'fill-rule',
  'opacity',
  'transform',
]);
const NUMBER = /^-?(?:\d+\.?\d*|\.\d+)$/;
const COLOR = /^(?:none|#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8}))$/i;
const PATH = /^[MmLlHhVvCcSsQqTtAaZz0-9.,\s+-]+$/;

function fail(reason: string): never {
  throw new Error(`unsafe SVG: ${reason}`);
}

function decodeTitleText(value: string): string {
  const encoded = value.replace(/&(amp|lt|gt|quot|apos);/g, '');
  if (encoded.includes('&')) fail('unknown entity in <title>');
  const decoded = value.replace(/&(amp|lt|gt|quot|apos);/g, (_match, name: string) => {
    switch (name) {
      case 'amp':
        return '&';
      case 'lt':
        return '<';
      case 'gt':
        return '>';
      case 'quot':
        return '"';
      default:
        return "'";
    }
  });
  if (
    [...decoded].some((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint < 0x20 || codePoint === 0x7f;
    })
  )
    fail('control character in <title>');
  return decoded;
}

function encodeTitleText(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function validAttribute(name: string, value: string, tag: string): boolean {
  if (!ATTRIBUTES.has(name)) return false;
  if (tag === 'title') return false;
  if (tag === 'svg' && !['xmlns', 'viewBox', 'width', 'height'].includes(name)) return false;
  if (name === 'xmlns') return tag === 'svg' && value === 'http://www.w3.org/2000/svg';
  if (name === 'viewBox') return tag === 'svg' && value === '0 0 64 64';
  if (name === 'width' || name === 'height') {
    return tag === 'svg'
      ? value === '64'
      : NUMBER.test(value) && Number(value) >= 0 && Number(value) <= 64;
  }
  if (name === 'd') return tag === 'path' && value.length <= 12_000 && PATH.test(value);
  if (name === 'points')
    return (tag === 'polygon' || tag === 'polyline') && /^[\d.,\s+-]+$/.test(value);
  if (name === 'fill' || name === 'stroke') return COLOR.test(value);
  if (name === 'stroke-width')
    return NUMBER.test(value) && Number(value) >= 0 && Number(value) <= 16;
  if (name === 'stroke-linecap') return ['butt', 'round', 'square'].includes(value);
  if (name === 'stroke-linejoin') return ['miter', 'round', 'bevel'].includes(value);
  if (name === 'fill-rule') return value === 'nonzero' || value === 'evenodd';
  if (name === 'opacity') return NUMBER.test(value) && Number(value) >= 0 && Number(value) <= 1;
  if (name === 'transform') return /^(?:translate|rotate|scale)\([\d.,\s+-]+\)$/.test(value);
  return NUMBER.test(value) && Math.abs(Number(value)) <= 128;
}

function readAttributes(source: string, tag: string): [string, string][] {
  const attributes: [string, string][] = [];
  let rest = source;
  const pattern = /\s+([A-Za-z][\w-]*)="([^"]*)"/y;
  while (rest.length > 0) {
    pattern.lastIndex = 0;
    const match = pattern.exec(rest);
    if (!match) {
      if (rest.trim() === '') break;
      fail(`malformed attribute on <${tag}>`);
    }
    const name = match[1];
    const value = match[2];
    if (!name || value === undefined) fail('missing attribute name or value');
    if (attributes.some(([previous]) => previous === name)) fail(`duplicate attribute ${name}`);
    if (/[&<>]/.test(value)) fail(`entity or markup in ${name}`);
    if (!validAttribute(name, value, tag)) fail(`disallowed ${name} on <${tag}>`);
    attributes.push([name, value]);
    rest = rest.slice(match[0].length);
  }
  return attributes.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}

/** Validate and canonically serialize the deliberately small SVG vocabulary used by the art pack. */
export function sanitizeSvg(source: unknown): string {
  if (typeof source !== 'string') fail('input must be text');
  const bytes = new TextEncoder().encode(source).byteLength;
  if (bytes > 32_768) fail('file exceeds 32 KiB');
  if (/<!|<\?|url\s*\(/i.test(source)) fail('declarations and CSS URLs are forbidden');
  const tokens = /<[^>]*>/g;
  const stack: string[] = [];
  const output: string[] = [];
  let cursor = 0;
  let nodeCount = 0;
  let rootOpened = false;
  let rootClosed = false;
  let titleText: string | undefined;
  for (const match of source.matchAll(tokens)) {
    const index = match.index;
    const token = match[0];
    if (index === undefined || token === undefined) fail('malformed token');
    const text = source.slice(cursor, index);
    if (text.trim() !== '') {
      if (stack.at(-1) !== 'title') fail('text nodes are only allowed inside <title>');
      if (titleText !== undefined) fail('<title> must contain one text node');
      titleText = decodeTitleText(text);
      if (!titleText.trim()) fail('<title> must not be empty');
      output.push(encodeTitleText(titleText));
    } else if (stack.at(-1) === 'title' && text.length > 0) {
      fail('<title> cannot contain formatting whitespace');
    }
    cursor = index + token.length;
    if (rootClosed) fail('multiple roots or trailing markup');
    const close = /^<\/([A-Za-z][\w-]*)\s*>$/.exec(token);
    if (close) {
      const tag = close[1];
      if (!tag || stack.pop() !== tag) fail(`unbalanced closing tag ${tag ?? ''}`);
      output.push(`</${tag}>`);
      if (tag === 'svg') rootClosed = true;
      continue;
    }
    const open = /^<([A-Za-z][\w-]*)([\s\S]*?)(\/?)>$/.exec(token);
    if (!open) fail('malformed element');
    const tag = open[1];
    const attrSource = open[2];
    const selfClosing = open[3] === '/';
    if (!tag || attrSource === undefined || !ELEMENTS.has(tag))
      fail(`disallowed element ${tag ?? ''}`);
    if (!rootOpened && tag !== 'svg') fail('root element must be <svg>');
    if (rootOpened && tag === 'svg') fail('nested <svg> is forbidden');
    if (stack.at(-1) === 'title') fail('<title> cannot contain child elements');
    if (tag === 'title') {
      if (stack.length !== 1 || stack[0] !== 'svg' || titleText !== undefined || selfClosing)
        fail('<title> must be one non-empty direct child of <svg>');
    }
    const attributes = readAttributes(attrSource, tag);
    if (tag === 'title' && attributes.length !== 0) fail('<title> cannot have attributes');
    if (tag === 'svg') {
      rootOpened = true;
      const values = new Map(attributes);
      if (
        values.get('xmlns') !== 'http://www.w3.org/2000/svg' ||
        values.get('width') !== '64' ||
        values.get('height') !== '64' ||
        values.get('viewBox') !== '0 0 64 64'
      ) {
        fail('root must use the canonical 64 by 64 transparent canvas');
      }
      if (selfClosing) fail('root cannot be empty');
    }
    nodeCount += 1;
    if (nodeCount > 256) fail('node limit exceeded');
    const attrs = attributes.map(([name, value]) => `${name}="${value}"`).join(' ');
    output.push(`<${tag}${attrs ? ` ${attrs}` : ''}${selfClosing ? ' />' : '>'}`);
    if (!selfClosing) {
      stack.push(tag);
      if (stack.length > 24) fail('nesting limit exceeded');
    }
  }
  if (source.slice(cursor).trim() !== '') fail('trailing text is not allowed');
  if (!rootOpened || !rootClosed || stack.length !== 0) fail('incomplete SVG document');
  if (titleText === undefined) fail('SVG must include a non-empty <title>');
  return `${output.join('')}\n`;
}

export function validateSvg(source: unknown): SvgValidation {
  const sanitized = sanitizeSvg(source);
  const titleMatch = /<title>([\s\S]*?)<\/title>/.exec(sanitized);
  if (titleMatch?.[1] === undefined) fail('SVG title could not be read');
  return {
    nodeCount: (sanitized.match(/<\/?[a-z]/g) ?? []).filter((part) => !part.startsWith('</'))
      .length,
    bytes: new TextEncoder().encode(sanitized).byteLength,
    viewBox: '0 0 64 64',
    title: decodeTitleText(titleMatch[1]),
  };
}

/** Canonical serialization doubles as the deterministic, dependency-free optimizer. */
export function optimizeSvg(source: unknown): string {
  return sanitizeSvg(source);
}

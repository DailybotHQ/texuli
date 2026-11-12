export interface SvgValidation {
  readonly nodeCount: number;
  readonly bytes: number;
  readonly viewBox: '0 0 64 64';
}

const ELEMENTS = new Set([
  'svg',
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

function validAttribute(name: string, value: string, tag: string): boolean {
  if (!ATTRIBUTES.has(name)) return false;
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
  if (/<!|<\?|&|url\s*\(/i.test(source)) fail('declarations, entities and CSS URLs are forbidden');
  const tokens = /<[^>]*>/g;
  const stack: string[] = [];
  const output: string[] = [];
  let cursor = 0;
  let nodeCount = 0;
  let rootOpened = false;
  let rootClosed = false;
  for (const match of source.matchAll(tokens)) {
    const index = match.index;
    const token = match[0];
    if (index === undefined || token === undefined) fail('malformed token');
    if (source.slice(cursor, index).trim() !== '') fail('text nodes are not allowed');
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
    const attributes = readAttributes(attrSource, tag);
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
  return `${output.join('')}\n`;
}

export function validateSvg(source: unknown): SvgValidation {
  const sanitized = sanitizeSvg(source);
  return {
    nodeCount: (sanitized.match(/<\/?[a-z]/g) ?? []).filter((part) => !part.startsWith('</'))
      .length,
    bytes: new TextEncoder().encode(sanitized).byteLength,
    viewBox: '0 0 64 64',
  };
}

/** Canonical serialization doubles as the deterministic, dependency-free optimizer. */
export function optimizeSvg(source: unknown): string {
  return sanitizeSvg(source);
}

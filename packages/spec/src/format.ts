import { canonicalJson } from './canonical.ts';

/** The repository formatter's line width (biome.json). */
export const LINE_WIDTH = 100;

/**
 * Committed JSON in the repository formatter's style, so generated files
 * stay byte-stable under `pnpm lint`: keys sorted, two-space indent, objects
 * always expanded, and an array of scalars kept on one line when it fits the
 * line width. Ends with a newline.
 */
export function formatJson(value: unknown): string {
  // Round-trip through canonical JSON: sorted keys, undefined dropped.
  return escapeInvisible(`${print(JSON.parse(canonicalJson(value)), 0, '', 0)}\n`);
}

/**
 * Invisible and bidi control characters as `\u` escapes (the same JSON
 * value): the repository's Trojan Source check refuses them literally in
 * committed files.
 */
const INVISIBLE = /[\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g;
function escapeInvisible(text: string): string {
  return text.replace(INVISIBLE, (ch) => `\\u${ch.charCodeAt(0).toString(16).padStart(4, '0')}`);
}

function isScalar(value: unknown): boolean {
  return value === null || typeof value !== 'object';
}

/**
 * `prefix` is what precedes the value on its line (indent and key) and
 * `suffix` the length of what follows it (a comma, or nothing for the last
 * entry), for the width check.
 */
function print(value: unknown, indent: number, prefix: string, suffix: number): string {
  if (isScalar(value)) return JSON.stringify(value);
  const pad = '  '.repeat(indent + 1);
  const close = '  '.repeat(indent);
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    if (value.every(isScalar)) {
      const inline = `[${value.map((item) => JSON.stringify(item)).join(', ')}]`;
      if (prefix.length + inline.length + suffix <= LINE_WIDTH) return inline;
    }
    const last = value.length - 1;
    const items = value.map(
      (item, index) => `${pad}${print(item, indent + 1, pad, index < last ? 1 : 0)}`
    );
    return `[\n${items.join(',\n')}\n${close}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) return '{}';
  const last = entries.length - 1;
  const lines = entries.map(([key, child], index) => {
    const head = `${pad}${JSON.stringify(key)}: `;
    return `${head}${print(child, indent + 1, head, index < last ? 1 : 0)}`;
  });
  return `{\n${lines.join(',\n')}\n${close}}`;
}
